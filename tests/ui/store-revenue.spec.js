import {test,expect} from '@playwright/test';
for(const actor of ['admin','owner'])for(const width of [320,390])test(`${actor} ${width}px 매장별 수익·회사 공통 보상·상세 조회`,async({page})=>{
 await page.setViewportSize({width,height:844});
 await page.route('https://placeholder.supabase.co/**',async route=>{
  const url=new URL(route.request().url()),table=url.pathname.split('/').pop();
  if(table==='profiles')return route.fulfill({json:[{id:'a',store_name:'A'},{id:'b',store_name:'B'}]});
  if(table==='hq_structure_monthly_inputs')return route.fulfill({json:{change_support_ratio:20}});
  if(table==='customer_sales')return route.fulfill({json:[{id:'s',user_id:'a',sale_date:'2026-10-03',source_type:'mobile',source_meta:{ri:1,ci:0,planDetail:{key:'general_115',type:'general'}}}]});
  return route.fulfill({json:[]});
 });
 await page.goto(`/tests/ui/store-revenue.html?actor=${actor}`);
 const panel=page.getByRole('region',{name:'매장별 수익 현황'});
 await expect(panel.getByTestId('store-revenue-total')).toContainText('원');
 await expect(panel.getByRole('heading',{name:'A',exact:true})).toBeVisible();await expect(panel.getByRole('heading',{name:'B',exact:true})).toBeVisible();
 const card=panel.locator('details').filter({has:page.getByRole('heading',{name:'A',exact:true})});await card.locator('summary').click();await expect(card.getByText('홈 월간 시상',{exact:true})).toBeVisible();
 await expect(panel.getByText('회사 공통 수익 · 매장 미배분',{exact:true})).toBeVisible();
 expect(await panel.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
});
test('직원·다른 관리자에게 화면과 데이터 요청이 없다',async({page})=>{
 const requests=[];page.on('request',r=>{if(r.url().includes('placeholder.supabase.co'))requests.push(r.url());});
 await page.goto('/tests/ui/store-revenue.html?actor=employee');await expect(page.getByRole('region',{name:'매장별 수익 현황'})).toHaveCount(0);expect(requests).toEqual([]);
});
test('회사 수익 조회 실패는 합계와 매장별 0원 대신 오류와 재시도를 표시한다',async({page})=>{
 await page.route('https://placeholder.supabase.co/**',r=>r.fulfill({status:403,json:{message:'denied'}}));
 await page.goto('/tests/ui/store-revenue.html?actor=owner');await expect(page.getByRole('alert')).toContainText('수익 자료를 불러오지 못했어요');await expect(page.getByTestId('store-revenue-total')).toHaveCount(0);
});
