import {test,expect} from '@playwright/test';
async function choosePlan(page,dialog,key){
 await dialog.getByLabel('세부 요금제').selectOption(key);
 await page.getByRole('dialog',{name:'요금제 변경 안내',exact:true}).getByRole('button',{name:'유지',exact:true}).click();
}
const employeeId='00000000-0000-4000-8000-000000000001';
const stores=['대야동_롯데마트점','장곡동_장곡역점'];
async function open(page,{actor='',sales=[],width=390,date='2026-10-01'}={}){
 const state={sales,day:null,writes:[]};await page.setViewportSize({width,height:844});await page.clock.setFixedTime(new Date(`${date}T03:00:00Z`));
 await page.route('https://placeholder.supabase.co/**',async route=>{
  const req=route.request(),u=new URL(req.url()),table=u.pathname.split('/').pop();
  if(table==='profiles')return route.fulfill({json:[{id:employeeId,name:'요금제검증',store_name:stores[0],position:'사원',role:'employee',active:true,hire_date:'2026-01-01'},{id:'second',name:'두번째직원',store_name:stores[1],position:'사원',role:'employee',active:true,hire_date:'2026-01-01'},...(actor==='admin'?[{id:'a50a0979-acef-40b1-98b7-f05074f1c835',name:'조회관리자',store_name:'운영진',position:'대표',role:'admin',active:true}]:[])]});
  if(table==='app_config'&&u.searchParams.get('config_key')?.startsWith('in.'))return route.fulfill({json:[{config_key:'policy_ready_months',value:['2026-10']},{config_key:'policy_blocked_months',value:[]}]});
  if(table==='save_sale_atomic'){
   const p=req.postDataJSON();state.writes.push(p);state.day=p.p_next_day;
   state.sales=[{id:p.p_sale_id,user_id:p.p_user_id,sale_date:p.p_sale_date,source_type:p.p_source_type,source_meta:p.p_meta,metric_label:p.p_metric_label,schema_version:3,customers:{customer_name:p.p_customer_name}}];
   return route.fulfill({json:{sale_count:1,daily_data:state.day}});
  }
  if(table==='delete_sale_atomic'){const p=req.postDataJSON();state.writes.push(p);state.day=p.p_next_day;state.sales=[];return route.fulfill({json:{sale_count:1,daily_data:state.day}});}
  if(table==='customer_sales')return route.fulfill({json:state.sales});
  if(table==='daily_records')return route.fulfill({json:u.searchParams.get('work_date')?.startsWith('eq.')?(state.day?{data:state.day}:null):(state.day?[{user_id:employeeId,work_date:date,data:state.day}]:[])});
  return route.fulfill({json:[]});
 });
 await page.goto(`/tests/ui/calendar.html?actor=${actor}&open=daily`);
 return state;
}
for(const width of [320,390])test(`${width}px 실제 요금제 선택·수정·삭제와 지급 구간 보존`,async({page})=>{
 const state=await open(page,{width});await page.getByRole('button',{name:/모바일 실적 입력/}).click();
 const dialog=page.getByRole('dialog',{name:'모바일 실적 입력',exact:true});
 await dialog.getByRole('button',{name:'일반 판매',exact:true}).click();await dialog.getByPlaceholder('고객명을 입력해주세요').fill('요금제 고객');
 await dialog.getByLabel('가입구분',{exact:true}).selectOption('1');
 await expect(dialog.getByRole('button',{name:'실적 등록',exact:true})).toBeDisabled();expect(state.writes).toHaveLength(0);
 await dialog.getByRole('group',{name:'요금제 유형',exact:true}).getByRole('button',{name:'시니어',exact:true}).click();
 await expect(dialog.getByLabel('세부 요금제').locator('option')).toHaveCount(7);await choosePlan(page,dialog,'senior_under28');
 await dialog.getByRole('group',{name:'요금제 유형',exact:true}).getByRole('button',{name:'주니어',exact:true}).click();
 await expect(dialog.getByLabel('세부 요금제')).toHaveValue('');await expect(dialog.getByLabel('세부 요금제').locator('option')).toHaveCount(11);
 await dialog.getByRole('group',{name:'요금제 유형',exact:true}).getByRole('button',{name:'일반',exact:true}).click();
 await expect(dialog.getByLabel('세부 요금제').locator('option')).toHaveCount(14);await choosePlan(page,dialog,'general_95');
 await expect(dialog.getByLabel('요금제군',{exact:true})).toHaveCount(0);expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 await dialog.getByRole('button',{name:'실적 등록',exact:true}).click();await expect(dialog).toHaveCount(0);
 expect(state.writes[0].p_meta.planDetail.key).toBe('general_95');expect(state.day.matrix[1][2]).toBe(1);
 const original=structuredClone(state.day);
 await page.getByRole('button',{name:'판매건 수정',exact:true}).click();await expect(dialog.getByLabel('세부 요금제')).toHaveValue('general_95');
 await choosePlan(page,dialog,'general_105');await dialog.getByRole('button',{name:'수정 저장',exact:true}).click();await expect(dialog).toHaveCount(0);
 expect(state.writes[1].p_meta.planDetail.key).toBe('general_105');expect(state.day).toEqual(original);
 await page.getByRole('button',{name:'내역',exact:true}).click();const panel=page.getByRole('region',{name:'요금제별 집계'});await panel.getByRole('button',{name:/요금제별 집계/}).click();await expect(panel.getByRole('button',{name:/일반 1건/})).toBeVisible();await expect(panel.getByText('105군',{exact:true}).locator('..')).toContainText('1건');
 await page.getByRole('button',{name:'실적입력',exact:true}).click();await page.getByRole('button',{name:'삭제',exact:true}).click();await page.getByRole('button',{name:'판매건 삭제',exact:true}).click();await expect.poll(()=>state.writes.length).toBe(3);expect(state.day.matrix[1][2]).toBe(0);
});
test('관리자 집계는 매장 전환·유형·SIM 구분과 미입력 건수를 정확히 반영한다',async({page})=>{
 const mk=(id,user_id,key,type,ri=1)=>({id,user_id,sale_date:'2026-10-01',source_type:'mobile',source_meta:{ri,ci:2,planDetail:key?{key,type}:null}});
 await open(page,{actor:'admin',width:320,sales:[mk('1',employeeId,'general_130','general'),mk('2','second','senior_44','senior'),mk('3','second','junior_85','junior',5),mk('4',employeeId,null,null)]});
 await page.getByRole('button',{name:'관리자',exact:true}).click();
 const panel=page.getByRole('region',{name:'요금제별 집계'});await panel.getByRole('button',{name:/요금제별 집계/}).click();
 await expect(panel.getByText('세부 요금제 미입력 1건')).toBeVisible();await expect(panel.getByRole('button',{name:/일반 1건/})).toBeVisible();
 await page.getByLabel('운영 현황 매장').selectOption(stores[1]);await expect(panel.getByRole('button',{name:/일반 0건/})).toBeVisible();await expect(panel.getByRole('button',{name:/시니어 1건/})).toBeVisible();
 await panel.getByLabel('요금제 집계 대상').selectOption('sim');await expect(panel.getByRole('button',{name:/시니어 0건/})).toBeVisible();await expect(panel.getByRole('button',{name:/주니어 1건/})).toBeVisible();
 expect(await panel.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
});
test('기존 세부 미입력 판매 수정은 전략요금제 체크와 지급 구간을 보존한다',async({page})=>{
 const sale={id:'old-sale',user_id:employeeId,sale_date:'2026-10-01',source_type:'mobile',schema_version:3,metric_label:'MNP · 115군↑',customers:{customer_name:'기존 고객'},source_meta:{ri:1,ci:0,strategicPlan:false,vasKeys:['vasStrategicPlan'],bundle2ndKeys:[],bundleVasMap:{},bundleVasCommissionExcluded:true}};
 const state=await open(page,{sales:[sale]});state.day={matrix:[[0],[1]],groups:{}};
 await expect(page.getByText('세부 요금제 미입력',{exact:true})).toBeVisible();await page.getByRole('button',{name:'판매건 수정',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'모바일 실적 입력',exact:true});
 await expect(dialog.getByRole('button',{name:/본사 전략요금제/})).toContainText('✓');await expect(dialog.getByLabel('세부 요금제')).toHaveValue('');
 await expect(dialog.getByRole('button',{name:'전략 요금제',exact:true})).toHaveCount(0);
 await dialog.getByRole('group',{name:'요금제 유형',exact:true}).getByRole('button',{name:'일반',exact:true}).click();await choosePlan(page,dialog,'general_130');
 await dialog.getByRole('button',{name:'수정 저장',exact:true}).click();await expect(dialog).toHaveCount(0);
 expect(state.writes[0].p_meta.strategicPlan).toBe(true);expect(state.writes[0].p_meta.ci).toBe(0);expect(state.day.matrix[1][0]).toBe(1);
});
test('조회 실패는 요금제 0건으로 표시하지 않는다',async({page})=>{
 await open(page);await page.getByRole('button',{name:'내역',exact:true}).click();
 await page.route('https://placeholder.supabase.co/**',async route=>{
  const u=new URL(route.request().url());
  if(u.pathname.endsWith('/customer_sales')&&u.searchParams.get('source_type')?.startsWith('in.'))return route.fulfill({status:403,json:{message:'forbidden'}});
  return route.fallback();
 });
 const panel=page.getByRole('region',{name:'요금제별 집계'});await panel.getByRole('button',{name:/요금제별 집계/}).click();await expect(panel.getByRole('alert')).toContainText('불러오지 못했어요');await expect(panel.getByRole('button',{name:/일반 0건/})).toHaveCount(0);
});

test('시니어 저가 MNP 자동 지급·가입구분 변경·일반 미지급 수정·삭제',async({page})=>{
 const state=await open(page);await page.getByRole('button',{name:/모바일 실적 입력/}).click();
 const dialog=page.getByRole('dialog',{name:'모바일 실적 입력',exact:true});
 await dialog.getByRole('button',{name:'일반 판매',exact:true}).click();await dialog.getByPlaceholder('고객명을 입력해주세요').fill('자동지급 고객');
 await dialog.getByLabel('가입구분',{exact:true}).selectOption('1');
 await dialog.getByRole('group',{name:'요금제 유형',exact:true}).getByRole('button',{name:'시니어',exact:true}).click();await choosePlan(page,dialog,'senior_44');
 await dialog.getByRole('button',{name:'실적 등록',exact:true}).click();await expect(dialog).toHaveCount(0);
 expect(state.writes[0].p_meta.ci).toBe(3);expect(state.day.matrix[1][3]).toBe(1);
 await page.getByRole('button',{name:'판매건 수정',exact:true}).click();await expect(dialog.getByLabel('세부 요금제')).toHaveValue('senior_44');
 await dialog.getByLabel('가입구분',{exact:true}).selectOption('0');await dialog.getByRole('button',{name:'수정 저장',exact:true}).click();await expect(dialog).toHaveCount(0);
 expect(state.writes[1].p_meta.ci).toBe(5);expect(state.day.matrix[1][3]).toBe(0);expect(state.day.matrix[0][5]).toBe(1);
 await page.getByRole('button',{name:'판매건 수정',exact:true}).click();await dialog.getByLabel('가입구분',{exact:true}).selectOption('5');
 await expect(dialog.getByRole('button',{name:/중고 MNP 61군/})).toHaveCount(0);
 await dialog.getByRole('button',{name:'수정 저장',exact:true}).click();await expect(dialog).toHaveCount(0);expect(state.writes[2].p_meta.ci).toBe(3);expect(state.day.matrix[5][3]).toBe(1);
 await page.getByRole('button',{name:'판매건 수정',exact:true}).click();await dialog.getByRole('group',{name:'요금제 유형',exact:true}).getByRole('button',{name:'일반',exact:true}).click();await choosePlan(page,dialog,'general_75');
 await expect(dialog.getByRole('button',{name:/중고 MNP 61군/})).toBeVisible();
 await dialog.getByRole('button',{name:'수정 저장',exact:true}).click();await expect(dialog).toHaveCount(0);expect(state.writes[3].p_meta.ci).toBe(5);expect(state.day.matrix[5][3]).toBe(0);expect(state.day.matrix[5][5]).toBe(1);
 await page.getByRole('button',{name:'삭제',exact:true}).click();await page.getByRole('button',{name:'판매건 삭제',exact:true}).click();await expect.poll(()=>state.writes.length).toBe(5);expect(state.day.matrix[5][5]).toBe(0);
});

test('중고 신규 실제 요금제 61→70 전환과 삭제는 생산성 인정 구간을 이동한다',async({page})=>{
 const state=await open(page);await page.getByRole('button',{name:/모바일 실적 입력/}).click();const dialog=page.getByRole('dialog',{name:'모바일 실적 입력',exact:true});
 await dialog.getByRole('button',{name:'일반 판매',exact:true}).click();await dialog.getByPlaceholder('고객명을 입력해주세요').fill('중고 신규 고객');
 await dialog.getByLabel('가입구분',{exact:true}).selectOption('6');await expect(dialog.getByLabel('가입구분',{exact:true}).locator('option:checked')).toHaveText('중고 신규');
 await dialog.getByRole('group',{name:'요금제 유형',exact:true}).getByRole('button',{name:'일반',exact:true}).click();await choosePlan(page,dialog,'general_61');
 await expect(dialog.getByText('생산성 미반영 요금제')).toBeVisible();await dialog.getByRole('button',{name:'실적 등록',exact:true}).click();await expect(dialog).toHaveCount(0);expect(state.day.matrix[6][5]).toBe(1);
 await page.getByRole('button',{name:'판매건 수정',exact:true}).click();await choosePlan(page,dialog,'general_70');await expect(dialog.getByText('생산성 반영 대상')).toBeVisible();await dialog.getByRole('button',{name:'수정 저장',exact:true}).click();await expect(dialog).toHaveCount(0);
 expect(state.day.matrix[6][5]).toBe(0);expect(state.day.matrix[6][0]).toBe(1);
 await page.getByRole('button',{name:'삭제',exact:true}).click();await page.getByRole('button',{name:'판매건 삭제',exact:true}).click();await expect.poll(()=>state.writes.length).toBe(3);expect(state.day.matrix[6][0]).toBe(0);
});
for(const width of [320,390])test(`${width}px 신규 부가서비스 0원·포인트·필링 교체·수정·삭제`,async({page})=>{
 const state=await open(page,{width});await page.getByRole('button',{name:/모바일 실적 입력/}).click();const dialog=page.getByRole('dialog',{name:'모바일 실적 입력',exact:true});
 await dialog.getByRole('button',{name:'일반 판매',exact:true}).click();await dialog.getByPlaceholder('고객명을 입력해주세요').fill('부가서비스 고객');await dialog.getByLabel('가입구분',{exact:true}).selectOption('1');
 await dialog.getByRole('group',{name:'요금제 유형',exact:true}).getByRole('button',{name:'일반',exact:true}).click();await choosePlan(page,dialog,'general_115');
 await dialog.getByRole('button',{name:/기타 전략 항목 펼치기/}).click();
 for(const [label,point] of [['벨링모아A + AI보이스링(인사말)','0.3P'],['벨링모아A + AI보이스링 캐릭터플러스','0.5P'],['V컬러링 기본','0.3P'],['V프로필','0.3P'],['통화편의팩','0.6P'],['통화기능안내','0.1P']]){
  const button=dialog.getByRole('button').filter({hasText:label});await expect(button).toContainText(point);await expect(button).not.toContainText('원');
 }
 async function select(label){await dialog.getByRole('button').filter({hasText:label}).click();await page.getByRole('dialog',{name:'부가서비스 삭제 안내',exact:true}).getByRole('button',{name:'유지',exact:true}).click();}
 await select('V프로필');await select('V컬러링 기본');await select('통화편의팩');
 expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 await dialog.getByRole('button',{name:'실적 등록',exact:true}).click();await expect(dialog).toHaveCount(0);expect(state.writes[0].p_meta.vasKeys).toEqual(['vasVcolorBasic','vasCallConvenience']);expect(state.day.groups.vas.vasVprofile||0).toBe(0);
 await page.getByRole('button',{name:'판매건 수정',exact:true}).click();if(await dialog.getByRole('button',{name:/기타 전략 항목 펼치기/}).count())await dialog.getByRole('button',{name:/기타 전략 항목 펼치기/}).click();await select('벨링모아A + AI보이스링 캐릭터플러스');
 await dialog.getByRole('button',{name:'수정 저장',exact:true}).click();await expect(dialog).toHaveCount(0);expect(state.writes[1].p_meta.vasKeys).toEqual(['vasCallConvenience','vasBellAiCharacter']);expect(state.day.groups.vas.vasVcolorBasic).toBe(0);expect(state.day.groups.vas.vasBellAiCharacter).toBe(1);
 await page.getByRole('button',{name:'삭제',exact:true}).click();await page.getByRole('button',{name:'판매건 삭제',exact:true}).click();await expect.poll(()=>state.writes.length).toBe(3);expect(state.day.groups.vas.vasCallConvenience).toBe(0);expect(state.day.groups.vas.vasBellAiCharacter).toBe(0);
});

for(const width of [320,390])test(`${width}px October weekend unpaid sale validates, preserves plan115 bonus inputs and edits/deletes`,async({page})=>{
 const state=await open(page,{width,date:'2026-10-02'});await page.getByRole('button',{name:/모바일 실적 입력/}).click();const dialog=page.getByRole('dialog',{name:'모바일 실적 입력',exact:true});
 await dialog.getByRole('button',{name:'인센미지급 특가',exact:true}).click();
 await dialog.getByRole('button',{name:/10\/2~5 주말 · S942-256\/512 · MNP/}).click();
 await expect(dialog.getByText(/115군 비중 60% 추가금/)).toBeVisible();
 await dialog.getByPlaceholder('고객명을 입력해주세요').fill('주말 특가');await dialog.getByLabel('가입구분',{exact:true}).selectOption('1');
 await dialog.getByRole('group',{name:'요금제 유형',exact:true}).getByRole('button',{name:'일반',exact:true}).click();await choosePlan(page,dialog,'general_115');
 await dialog.getByRole('button',{name:/교보문고 sam/}).click();await page.getByRole('dialog',{name:'부가서비스 삭제 안내',exact:true}).getByRole('button',{name:'유지',exact:true}).click();
 await dialog.getByRole('button',{name:/V컬러링 음악감상 플러스.*벨링/}).click();await page.getByRole('dialog',{name:'부가서비스 삭제 안내',exact:true}).getByRole('button',{name:'유지',exact:true}).click();
 expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);await dialog.getByRole('button',{name:'실적 등록',exact:true}).click();await expect(dialog).toHaveCount(0);
 expect(state.writes[0].p_meta.specialPolicy.customerDiscount).toBe(350000);expect(state.writes[0].p_meta.specialPolicy.replacementAmount).toBe(0);expect(state.writes[0].p_meta.specialPolicy.preorder).toBe(false);expect(state.writes[0].p_sale_date).toBe('2026-10-02');expect(state.day.matrix[1][0]).toBe(1);expect(state.day.specialVasOffset).toBe(40000);
 await page.getByRole('button',{name:'판매건 수정',exact:true}).click();await dialog.getByRole('button',{name:'수정 저장',exact:true}).click();await expect(dialog).toHaveCount(0);expect(state.day.matrix[1][0]).toBe(1);expect(state.day.specialVasOffset).toBe(40000);
 await page.getByRole('button',{name:'삭제',exact:true}).click();await page.getByRole('button',{name:'판매건 삭제',exact:true}).click();await expect.poll(()=>state.writes.length).toBe(3);expect(state.day.matrix[1][0]).toBe(0);expect(state.day.specialVasOffset).toBe(0);
});
for(const width of [320,390])test(`${width}px 대표 회사수익은 전체 매장·기본/요금제·미설정·재조회 반영`,async({page})=>{
 const mk=(id,ri,key,type='general',extra={})=>({id,user_id:employeeId,sale_date:'2026-10-03',source_type:'mobile',source_meta:{ri,planDetail:{key,type},...extra}});
 const state=await open(page,{actor:'admin',width,sales:[mk('1',1,'general_115'),mk('2',5,'general_115'),mk('3',1,'senior_47','senior'),mk('4',7,null,'general',{secondOnlyBundle:true,bundle2ndKeys:['watch']})]});
 await page.getByRole('button',{name:'관리자',exact:true}).click();
 const panel=page.getByRole('region',{name:'회사 예상 수익'});await panel.getByRole('button',{name:/회사 예상 수익/}).click();
 await expect(panel.getByTestId('company-revenue-total')).toHaveText('506,000원');await expect(panel.getByText('추가 수수료 확인 필요 1건')).toBeVisible();
 await page.getByLabel('운영 현황 매장').selectOption(stores[1]);await expect(panel.getByTestId('company-revenue-total')).toHaveText('506,000원');
 expect(await panel.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 state.sales=[mk('1',1,'general_105')];await panel.getByRole('button',{name:/회사 예상 수익/}).click();await panel.getByRole('button',{name:/회사 예상 수익/}).click();await expect(panel.getByTestId('company-revenue-total')).toHaveText('165,000원');
 state.sales=[];await panel.getByRole('button',{name:/회사 예상 수익/}).click();await panel.getByRole('button',{name:/회사 예상 수익/}).click();await expect(panel.getByTestId('company-revenue-total')).toHaveText('0원');
});
test('일반 직원에게 회사 수익 화면이 없다',async({page})=>{await open(page);await expect(page.getByRole('region',{name:'회사 예상 수익'})).toHaveCount(0);});
test('회사수익 조회 오류는 0원으로 표시하지 않는다',async({page})=>{
 await open(page,{actor:'admin'});await page.getByRole('button',{name:'관리자',exact:true}).click();
 await page.route('https://placeholder.supabase.co/**',async route=>{if(new URL(route.request().url()).pathname.endsWith('/customer_sales'))return route.fulfill({status:403,json:{message:'forbidden'}});return route.fallback();});
 const panel=page.getByRole('region',{name:'회사 예상 수익'});await panel.getByRole('button',{name:/회사 예상 수익/}).click();await expect(panel.getByRole('alert')).toContainText('회사 수익을 불러오지 못했어요');await expect(panel.getByTestId('company-revenue-total')).toHaveCount(0);
});
test('회사수익 9월은 계산하지 않고 적용기간 미설정을 표시한다',async({page})=>{
 await open(page,{actor:'admin'});await page.getByRole('button',{name:'관리자',exact:true}).click();
 await page.locator('select').filter({has:page.locator('option[value="2026-09"]')}).first().selectOption('2026-09');
 const panel=page.getByRole('region',{name:'회사 예상 수익'});await panel.getByRole('button',{name:/회사 예상 수익/}).click();
 await expect(panel.getByText('회사 수익 기준은 2026년 10월 개통 건부터 적용해요. 이전 월 기준은 미설정입니다.')).toBeVisible();await expect(panel.getByTestId('company-revenue-total')).toHaveCount(0);
});
