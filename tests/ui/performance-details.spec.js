import {test,expect} from '@playwright/test';
const id='00000000-0000-4000-8000-000000000001',branch='대야동_롯데마트점';
async function setup(page,{previous=8,fail=false,paginated=false,home=false}={}){
  const requests=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.setFixedTime(new Date('2026-09-17T03:00:00Z'));
  await page.route('https://placeholder.supabase.co/**',async route=>{
    const req=route.request(),u=new URL(req.url()),table=u.pathname.split('/').pop();
    requests.push({table,url:u,body:req.postDataJSON()});
    if(table==='profiles')return route.fulfill({json:[{id,name:'카드검증',store_name:branch,position:'사원',role:'employee',active:true,hire_date:'2026-01-01'}]});
    if(table==='daily_records'){
      const before=u.searchParams.getAll('work_date').includes('gte.2026-08-01');
      if(before&&fail)return route.fulfill({status:403,json:{message:'comparison unavailable'}});
      const n=before?previous:10;
      if(n===null)return route.fulfill({json:[]});
      const row={user_id:id,work_date:before?'2026-08-10':'2026-09-10',data:{matrix:[[n]],groups:home?{homeBase:{homeOnly:1}}:{}}};
      if(before&&paginated){const offset=Number(u.searchParams.get('offset')||0);return route.fulfill({json:offset?[{...row,data:{matrix:[[2]]}}]:Array.from({length:1000},(_,i)=>({...row,data:{matrix:[[i===0?8:0]]}}))});}
      return route.fulfill({json:[row]});
    }
    if(table==='home_orders'&&home){
      return route.fulfill({json:[
        {id:'cancelled',user_id:id,status:'cancelled',source_work_date:'2026-08-10',product_type:'homeOnly'},
        {id:'installed',customer_id:'customer-1',user_id:id,status:'completed',source_work_date:'2026-07-10',actual_install_date:'2026-08-16',product_type:'internet100',network_type:'household'},
        {id:'after-cutoff',customer_id:'customer-2',user_id:id,status:'completed',source_work_date:'2026-07-10',actual_install_date:'2026-08-18',product_type:'internet100',network_type:'household'},
      ]});
    }
    if(table==='get_my_store_performance_days'){
      const before=req.postDataJSON()?.p_month==='2026-08';return route.fulfill({json:[{work_date:before?'2026-08-10':'2026-09-10',data:{matrix:[[before?15:20]]}}]});
    }
    return route.fulfill({json:[]});
  });
  await page.addLocatorHandler(page.getByRole('button',{name:'좋아요!',exact:true}),b=>b.click());
  await page.goto('/tests/ui/calendar.html');
  if(process.env.UI_FONT_CSS){await page.addStyleTag({path:process.env.UI_FONT_CSS});await page.evaluate(()=>document.fonts.ready);}
  await expect(page.getByTestId('personal-metric-hs')).toContainText('10건');
  return {requests,errors};
}
for(const width of [320,390])test(`${width}px 개인 카드는 2열·조금 낮은 높이, 상세에서 5개 지표와 날짜별 내역`,async({page},info)=>{
  await page.setViewportSize({width,height:844});const {requests,errors}=await setup(page);
  await expect(page.locator('.performance-tile')).toHaveCount(10);
  expect(requests.some(r=>r.url.searchParams.getAll('work_date').includes('gte.2026-08-01'))).toBe(false);
  const card=page.getByTestId('personal-metric-hs');await expect(card).not.toContainText('예상 마감');
  const dimensions=await card.evaluate(el=>({height:el.clientHeight,padding:getComputedStyle(el).paddingTop,columns:getComputedStyle(el.parentElement).gridTemplateColumns.split(' ').length,font:getComputedStyle(el.querySelector('.metric-value')).fontSize}));
  expect(dimensions.columns).toBe(2);expect(dimensions.padding).toBe('10px');expect(dimensions.font).toBe('18px');expect(dimensions.height).toBeLessThan(85);
  await page.screenshot({path:info.outputPath('personal-compact.png'),fullPage:true});
  await page.getByRole('button',{name:'진척도 상세보기'}).click();
  const detail=page.getByTestId('personal-detail-hs');
  for(const label of ['목표','실적','달성률','예상 마감','전월 대비'])await expect(detail.getByText(label,{exact:true})).toBeVisible();
  await expect(detail).toContainText('8건 → 10건 · +2건 (+25.0%)');
  const query=requests.find(r=>r.table==='daily_records'&&r.url.searchParams.getAll('work_date').includes('gte.2026-08-01'));
  expect(query.url.searchParams.getAll('work_date')).toContain('lte.2026-08-17');expect(query.url.searchParams.get('user_id')).toBe(`in.(${id})`);
  expect(await page.getByRole('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('progress-detail.png')});
  await page.getByRole('button',{name:'목표 설정',exact:true}).click();await expect(page.getByRole('button',{name:'목표 저장'})).toBeVisible();
  await page.getByRole('button',{name:'목표 설정 닫기'}).click();
  await page.getByRole('button',{name:'HS 날짜별 내역'}).click();await expect(page.getByText('상세 합계',{exact:true})).toBeVisible();await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(errors).toEqual([]);
});
for(const state of ['missing','zero','error'])test(`전월 ${state}를 0건·무한대와 혼동하지 않는다`,async({page})=>{
  await setup(page,{previous:state==='missing'?null:0,fail:state==='error'});
  await page.getByRole('button',{name:'진척도 상세보기'}).click();const detail=page.getByTestId('personal-detail-hs');
  await expect(detail).toContainText(state==='error'?'비교 자료 조회 실패':state==='missing'?'비교 자료 없음':'0건 → 10건 · +10건');
  await expect(detail).not.toContainText('Infinity');
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('매장 비교는 직원 ID를 추가 조회하지 않고 익명 RPC를 유지한다',async({page})=>{
  const {requests,errors}=await setup(page);await page.getByRole('button',{name:'매장',exact:true}).click();await expect(page.getByTestId('store-metric-hs')).toContainText('20건');
  const start=requests.length;await page.getByRole('button',{name:'진척도 상세보기'}).click();
  await expect(page.getByTestId('store-detail-hs')).toContainText('15건 → 20건');
  expect(requests.slice(start).some(r=>r.table==='daily_records')).toBe(false);
  expect(requests.slice(start).some(r=>r.table==='get_my_store_performance_days'&&r.body.p_month==='2026-08')).toBe(true);expect(errors).toEqual([]);
});
test('전월 1000행을 넘으면 다음 페이지도 합산한다',async({page})=>{
  await setup(page,{paginated:true});await page.getByRole('button',{name:'진척도 상세보기'}).click();await expect(page.getByTestId('personal-detail-hs')).toContainText('10건 → 10건 · 0건 (0.0%)');
});
test('홈 전월 비교는 취소 잔여를 빼고 기간 안 설치 완료만 반영한다',async({page})=>{
  await setup(page,{home:true});await page.getByRole('button',{name:'진척도 상세보기'}).click();await expect(page.getByTestId('personal-detail-home')).toContainText('1건 → 1건 · 0건 (0.0%)');
});
