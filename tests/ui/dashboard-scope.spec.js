import {test,expect} from '@playwright/test';
const stores=['대야동_롯데마트점','장곡동_장곡역점'];
const ids=['00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002'];
const matrix=n=>[[n]];
async function setup(page,{actor='admin',hq=null,hqFail=false,final=false}={}){
 await page.clock.setFixedTime(new Date('2026-09-15T03:00:00Z'));
 const adminId='a50a0979-acef-40b1-98b7-f05074f1c835',areaId='471280af-a046-4d25-a27d-63a0c5978403';
 const profiles=ids.map((id,i)=>({id,name:`직원${i+1}`,store_name:stores[i],position:actor==='manager'&&i===0?'점장':'사원',role:actor==='manager'&&i===0?'manager':'employee',active:true,hire_date:'2026-01-01'}));
 if(actor==='area')profiles.push({id:'outside-area',name:'타상권직원',store_name:'성포동_성포역점',position:'사원',role:'employee',active:true});
 if(actor==='admin'||actor==='area')profiles.push({id:actor==='admin'?adminId:areaId,name:'조회관리자',store_name:'운영진',position:actor==='admin'?'대표':'담당',role:actor==='admin'?'admin':'manager',active:true,hire_date:'2026-01-01'});
 await page.route('https://placeholder.supabase.co/**',async route=>{
  const req=route.request(),u=new URL(req.url()),table=u.pathname.split('/').pop();
  if(table==='profiles')return route.fulfill({json:profiles});
  if(table==='daily_records')return route.fulfill({json:ids.map((id,i)=>({user_id:id,work_date:'2026-09-15',data:{matrix:matrix(i?20:10)}}))});
  if(table==='head_office_performance')return route.fulfill(hqFail?{status:403,json:{message:'failed'}}:{json:hq});
  if(table==='head_office_store_performance'){
   const rows=final?[{month:'2026-09',store_name:stores[0],as_of_date:'2026-09-30',metrics:{hs:12,status:'final'}}]:[];
   return route.fulfill({json:req.headers().accept?.includes('vnd.pgrst.object')?(rows.find(r=>`eq.${r.store_name}`===u.searchParams.get('store_name'))||null):rows});
  }
  return route.fulfill({json:[]});
 });
 await page.addLocatorHandler(page.getByRole('button',{name:'좋아요!',exact:true}),b=>b.click());
 await page.goto(`/tests/ui/calendar.html?actor=${actor}`);
 if(process.env.UI_FONT_CSS){await page.addStyleTag({path:process.env.UI_FONT_CSS});await page.evaluate(()=>document.fonts.ready);}
 if(actor!=='employee')await page.getByRole('button',{name:'관리자',exact:true}).click();
}
async function checkForecast(page,value){
 await expect(page.getByTestId('admin-metric-hs')).not.toContainText('예상 마감');
 await page.getByRole('button',{name:'진척도 상세보기'}).click();
 await expect(page.getByTestId('admin-detail-hs').getByText('예상 마감',{exact:true}).locator('..')).toContainText(`${value}건`);
 await page.getByRole('button',{name:'진척도 상세 닫기'}).click();
}
test('매장 선택은 핵심 성과·예상 마감·직원 목록을 함께 바꾼다',async({page},info)=>{
 await page.setViewportSize({width:390,height:844});await setup(page);
 const hs=page.getByTestId('admin-metric-hs');await expect(hs).toContainText('30건');await checkForecast(page,60);
 await page.getByLabel('운영 현황 매장').selectOption(stores[0]);await expect(hs).toContainText('10건');await checkForecast(page,20);
 await page.getByLabel('운영 현황 매장').selectOption(stores[1]);await expect(hs).toContainText('20건');await checkForecast(page,40);
 const staff=page.getByText(/· 직원 현황/).locator('..').locator('..');
 await expect(staff).toContainText('직원2');await expect(staff).not.toContainText('직원1');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:info.outputPath('selected-store.png'),fullPage:true});
 await page.getByLabel('운영 현황 매장').selectOption('all');await checkForecast(page,60);
});
test('매장 관리자는 본인 매장만 보고 마감 확정 실적을 재환산하지 않는다',async({page})=>{
 await setup(page,{actor:'manager',final:true});await expect(page.getByLabel('운영 현황 매장')).toHaveCount(0);
 await expect(page.getByTestId('admin-metric-hs')).toContainText('12건');await checkForecast(page,12);
});
test('영업담당 선택 목록은 담당 상권 안에서만 제공한다',async({page})=>{
 await setup(page,{actor:'area'});
 const picker=page.getByLabel('운영 현황 매장');
 await expect(picker.locator('option')).toHaveCount(3);
 await expect(picker).not.toContainText('성포');
 await picker.selectOption(stores[1]);await checkForecast(page,40);
});
for(const state of ['empty','different','error'])test(`본사 비교 ${state}: 홈 안내와 내역 상세`,async({page})=>{
 await setup(page,{actor:'employee',hq:state==='different'?{metrics:{matrix:matrix(12)},as_of_date:'2026-09-15'}:null,hqFail:state==='error'});
 await expect(page.getByText('오늘 할 일',{exact:true})).toBeVisible();
 await expect(page.getByText('본사 실적 비교',{exact:true})).toHaveCount(0);
 const notice=page.getByRole('button',{name:/확인할 실적 차이/});
 if(state==='different'){await expect(notice).toBeVisible();await notice.click();}
 else{await expect(notice).toHaveCount(0);await page.locator('.app-bottom-nav').getByRole('button',{name:'내역',exact:true}).click();}
 await expect(page.getByText('본사 실적 비교',{exact:true})).toBeVisible();
 if(state==='error')await expect(page.getByRole('alert')).toContainText('본사 데이터를 불러오지 못했어요');
 if(state==='empty')await expect(page.getByText('본사 데이터 등록 전 · 직원 입력 기준')).toBeVisible();
});
