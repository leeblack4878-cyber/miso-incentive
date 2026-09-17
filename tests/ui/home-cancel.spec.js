import {test,expect} from '@playwright/test';
for(const action of ['exclude','keep'])test(`320px cancellation requires explicit ${action} decision and refreshes cost total`,async({page})=>{
 await page.setViewportSize({width:320,height:844});let cancelled=false,calls=0;
 const order={id:1,user_id:'fixture',customer_name:'취소 점검 고객',product_type:'internet500',network_type:'household',status:'pending',applied_at:'2026-09-16T03:00:00Z'};
 await page.route('https://placeholder.supabase.co/**',async route=>{
  const name=new URL(route.request().url()).pathname.split('/').pop();
  if(name==='home_orders')return route.fulfill({json:[{...order,status:cancelled?'cancelled':'pending'}]});
  if(name==='sales_expenses')return route.fulfill({json:[{id:'cost',amount:33000,category:'오퍼',expense_date:'2026-09-16',voided_at:cancelled&&action==='exclude'?'2026-09-17':null}]});
  if(name==='cancel_home_orders_atomic'){
   expect(route.request().postDataJSON()).toEqual({p_user_id:'fixture',p_order_ids:[1],p_expense_action:action});calls++;cancelled=true;return route.fulfill({json:{updated_count:1,status:'cancelled'}});
  }
  return route.fulfill({json:[]});
 });
 await page.goto('/tests/ui/home-cancel.html');await expect(page.getByText('이번 달 33,000원',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'취소',exact:true}).click();const dialog=page.getByRole('dialog',{name:'홈 청약 취소'});
 await expect(dialog.getByRole('button',{name:'취소 확정'})).toBeDisabled();
 await dialog.locator(`input[value=${action}]`).check();
 expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 await dialog.getByRole('button',{name:'취소 확정'}).click();await expect(dialog).toHaveCount(0);expect(calls).toBe(1);
 await expect(page.getByText(`이번 달 ${action==='exclude'?'0':'33,000'}원`,{exact:true})).toBeVisible();
 await page.getByRole('button',{name:/영업비용/}).click();
 if(action==='exclude')await expect(page.getByText('정산 제외 · 33,000원',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
