import {test,expect} from '@playwright/test';
async function openApp(page,{admin=false,failLedger=false}={}){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.setFixedTime(new Date('2026-09-16T03:00:00Z'));
 const id=admin?'a50a0979-acef-40b1-98b7-f05074f1c835':'00000000-0000-4000-8000-000000000001';
 const profile={id,name:'긴이름화면검증',store_name:'대야동_롯데마트점',position:admin?'대표':'사원',role:admin?'admin':'employee',active:true,hire_date:'2026-01-01'};
 await page.route('https://placeholder.supabase.co/**',async route=>{
  const req=route.request(),u=new URL(req.url()),table=u.pathname.split('/').pop();
  if(table==='profiles')return route.fulfill({json:req.headers().accept?.includes('vnd.pgrst.object')?profile:[profile]});
  if(table==='sales_expenses')return route.fulfill(failLedger?{status:403,json:{message:'unavailable'}}:{json:[{id:'expense',amount:10000,expense_date:'2026-09-16',category:'케이스'}]});
  if(table==='spot_claims')return route.fulfill({json:u.searchParams.get('status')==='eq.approved'?[{id:'spot',source_context:'home',status:'approved',final_amount:30000,claim_date:'2026-09-16'}]:[]});
  return route.fulfill({json:[]});
 });
 await page.addLocatorHandler(page.getByRole('button',{name:'좋아요!',exact:true}),async b=>{await b.click()});
 await page.goto(`/tests/ui/calendar.html${admin?'?actor=admin':''}`);
 if(process.env.UI_FONT_CSS){await page.addStyleTag({path:process.env.UI_FONT_CSS});await page.evaluate(()=>document.fonts.ready);}
 await expect(page.locator('.app-bottom-nav').getByRole('button',{name:'홈',exact:true})).toBeVisible();
 return errors;
}
for(const width of [320,390,768])test(`${width}px 직원 홈·고객관리·평가·내역의 화면과 지연로딩`,async({page},info)=>{
 await page.setViewportSize({width,height:844});const errors=await openApp(page);
 await expect(page.getByRole('heading',{name:'오늘 할 일'})).toBeVisible();
 for(const tab of ['홈','고객관리','평가','내역']){
  await page.locator('.app-bottom-nav').getByRole('button',{name:tab,exact:true}).click();
  if(tab==='평가')await expect(page.getByRole('button',{name:'개인 커리어 등급',exact:true})).toBeVisible();
  if(tab==='고객관리')await expect(page.getByRole('button',{name:'완료·취소',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${tab} horizontal overflow`).toBe(true);
  if(tab==='홈'){await expect(page.locator('.performance-tile')).toHaveCount(10);expect(await page.locator('.performance-tile').evaluateAll(rows=>rows.every(row=>row.scrollWidth<=row.clientWidth))).toBe(true);}
  if(width===390)await page.screenshot({path:info.outputPath(`${tab}.png`),fullPage:true});
 }
 expect(errors).toEqual([]);
});
for(const width of [320,390])test(`${width}px 관리자 주요 메뉴와 평가·급여 표시`,async({page},info)=>{
 await page.setViewportSize({width,height:844});const errors=await openApp(page,{admin:true});
 await page.getByRole('button',{name:'관리자',exact:true}).click();
 await expect(page.getByText('핵심 성과',{exact:false})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 if(width===390)await page.screenshot({path:info.outputPath('admin.png'),fullPage:true});
 await page.getByRole('button',{name:'평가·급여',exact:true}).click();
 await expect(page.getByRole('button',{name:'관리자 평가',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'관리자 급여',exact:true}).click();
 await expect(page.getByText('불러오는 중...',{exact:false})).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});
test('홈 예상 마감과 내역 합계는 승인된 홈 스팟·영업비용까지 일치한다',async({page})=>{
 await openApp(page);await page.getByRole('button',{name:'급여 확인·비교 ›',exact:true}).click();
 const closing=await page.getByTestId('closing-pay').innerText();expect(closing).not.toBe('—');
 await page.getByRole('button',{name:'급여 창 닫기'}).click();await page.locator('.app-bottom-nav').getByRole('button',{name:'내역',exact:true}).click();
 await expect(page.getByTestId('history-pay')).toHaveText(closing);
});
test('비용 조회 실패 시 합계를 0원 차감으로 표시하지 않는다',async({page})=>{
 await openApp(page,{failLedger:true});await expect(page.getByRole('alert')).toContainText('합계 표시를 보류');
 await page.locator('.app-bottom-nav').getByRole('button',{name:'내역',exact:true}).click();await expect(page.getByTestId('history-pay')).toHaveText('—');
});
