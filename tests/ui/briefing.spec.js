import {test,expect} from '@playwright/test';
test('브리핑 SIM·단독 2ND와 선택일 누적을 실제 화면에서 확인한다',async({page})=>{
 await page.clock.setFixedTime(new Date('2026-09-19T03:00:00Z'));
 const id='00000000-0000-4000-8000-000000000001',store='광정동_산본점';
 const day=(sim,second,smart,bundle)=>{const matrix=Array.from({length:8},()=>[0,0,0,0,0,0]);matrix[5][0]=sim;matrix[7][0]=second;return {matrix,groups:{homeFlat:{smartHome:smart},bundle2nd:{b_AppleWatch:bundle}}};};
 await page.route('https://placeholder.supabase.co/**',async route=>{
  const table=new URL(route.request().url()).pathname.split('/').pop();
  if(table==='profiles')return route.fulfill({json:[{id,name:'집계직원',store_name:store,position:'사원',role:'employee',active:true,hire_date:'2026-01-01'},{id:'a50a0979-acef-40b1-98b7-f05074f1c835',name:'조회관리자',store_name:'운영진',position:'대표',role:'admin',active:true}]});
  if(table==='daily_records')return route.fulfill({json:[[17,day(2,1,0,1)],[18,day(3,1,1,2)],[19,day(9,8,2,4)]].map(([d,data])=>({user_id:id,work_date:`2026-09-${d}`,data}))});
  if(table==='store_goals')return route.fulfill({json:[{store_name:store,company_goals:{},challenge_goals:{hs:0,home:0,sono:0,second:10,simMnp:12,tvFree:0,free:0,smartHome:6,productivity:0,kpi:0,tailoredCount:0,tailored:0,tailoredAmount:0}}]});
  return route.fulfill({json:[]});
 });
 await page.addLocatorHandler(page.getByRole('button',{name:'좋아요!',exact:true}),b=>b.click());
 await page.goto('/tests/ui/calendar.html?actor=admin');
 await page.getByRole('button',{name:'관리자',exact:true}).click();
 await page.getByRole('button',{name:'일일 브리핑',exact:true}).click();
 await expect(page.getByText('예상 8.3건 · 69%',{exact:true})).toBeVisible();
 await expect(page.getByText('예상 8.3건 · 83%',{exact:true})).toBeVisible();
 await expect(page.getByText('예상 1.7건 · 28%',{exact:true})).toBeVisible();
 const daySelect=page.locator('select').filter({has:page.locator('option[value="18"]')});
 await daySelect.selectOption('17');
 await expect(page.getByText('예상 3.5건 · 29%',{exact:true})).toBeVisible();
 await expect(page.getByText('예상 3.5건 · 35%',{exact:true})).toBeVisible();
 await expect(page.getByText('예상 0건 · 0%',{exact:true})).toBeVisible();
});
