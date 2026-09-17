import {test,expect,result,snapshot,openEmployee} from './fixtures.js';
for(const action of ['exclude','keep'])test(`home cancellation ${action}: UI choice, dependent tasks, reload`,async({page,world})=>{
 await world.seed(world.employee);await openEmployee(page,world);
 await page.getByRole('button',{name:'고객관리',exact:true}).click();
 await page.getByRole('button',{name:'여러 상품 취소',exact:true}).click();
 await page.getByRole('button',{name:'선택 2개 처리',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'홈 청약 취소'});
 await expect(dialog.getByRole('button',{name:'취소 확정'})).toBeDisabled();
 await dialog.locator(`input[value=${action}]`).check();
 const response=page.waitForResponse(r=>r.url().endsWith('/rpc/cancel_home_orders_atomic'));
 await dialog.getByRole('button',{name:'취소 확정'}).click();expect((await response).ok()).toBe(true);
 await expect(dialog).toHaveCount(0);
 const saved=await snapshot(world.admin,world.employee.id);
 expect(saved.home_orders.every(x=>x.status==='cancelled')).toBe(true);
 expect(saved.customer_tasks.every(x=>x.status==='cancelled')).toBe(true);
 expect(saved.sales_expenses).toHaveLength(1);expect(Number(saved.sales_expenses[0].amount)).toBe(33000);
 expect(Boolean(saved.sales_expenses[0].voided_at)).toBe(action==='exclude');
 await page.reload();await page.getByRole('button',{name:'내역',exact:true}).click();
 await expect(page.getByText('배지 확인을 완료하지 못했어요.',{exact:false})).toHaveCount(0);
});

test('authenticated badge verification rejects forged grants and isolates employee performance',async({world})=>{
 const {employee,other,admin}=world;
 const before=await result(admin.from('user_achievements').select('*').eq('user_id',employee.id));
 try{
  await result(admin.from('user_achievements').delete().eq('user_id',employee.id));
  const forged=await employee.client.from('user_achievements').insert({user_id:employee.id,badge_key:'hs_m100',awarded_by:null});expect(forged.error).toBeTruthy();
  await result(other.client.from('daily_records').insert({user_id:other.id,work_date:'2026-09-16',data:{matrix:[[100]]}}));
  const first=await result(employee.client.functions.invoke('sync-badges',{body:{month:'2026-09'}}));
  expect(first.badges.filter(x=>!x.badge_key.startsWith('tenure'))).toHaveLength(0);
  const impostor=await employee.client.functions.invoke('sync-badges',{body:{month:'2026-09',user_id:other.id}});expect(impostor.error).toBeTruthy();
  const snapshot=await employee.client.rpc('badge_source_snapshot',{p_user_id:employee.id,p_month:'2026-09'});expect(snapshot.error).toBeTruthy();
  await result(employee.client.from('daily_records').insert({user_id:employee.id,work_date:'2026-09-16',data:{matrix:[[20]]}}));
  const next=await result(employee.client.functions.invoke('sync-badges',{body:{month:'2026-09'}}));
  expect(next.badges.some(x=>x.badge_key==='hs_m20'&&x.verified_at)).toBe(true);
  expect(next.badges.some(x=>x.badge_key==='hs_m100'||x.badge_key==='hs_rank1')).toBe(false);
  const twice=await result(employee.client.functions.invoke('sync-badges',{body:{month:'2026-09'}}));expect(twice.badges.length).toBe(next.badges.length);
 }finally{
  await result(admin.from('user_achievements').delete().eq('user_id',employee.id));
  if(before.length)await result(admin.from('user_achievements').insert(before));
 }
});
