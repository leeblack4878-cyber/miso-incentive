import {test,expect} from '@playwright/test';
const employeeId='00000000-0000-4000-8000-000000000001';
const stores=['대야동_롯데마트점','장곡동_장곡역점'];
async function open(page,{actor='',sales=[],width=390}={}){
 const state={sales,day:null,writes:[]};await page.setViewportSize({width,height:844});await page.clock.setFixedTime(new Date('2026-10-01T03:00:00Z'));
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
  if(table==='daily_records')return route.fulfill({json:u.searchParams.get('work_date')?.startsWith('eq.')?(state.day?{data:state.day}:null):(state.day?[{user_id:employeeId,work_date:'2026-10-01',data:state.day}]:[])});
  return route.fulfill({json:[]});
 });
 await page.goto(`/tests/ui/calendar.html?actor=${actor}&open=daily`);
 return state;
}
for(const width of [320,390])test(`${width}px 실제 요금제 선택·수정·삭제와 지급 구간 보존`,async({page})=>{
 const state=await open(page,{width});await page.getByRole('button',{name:/모바일 실적 입력/}).click();
 const dialog=page.getByRole('dialog',{name:'모바일 실적 입력',exact:true});
 await dialog.getByRole('button',{name:'일반 판매',exact:true}).click();await dialog.getByPlaceholder('고객명을 입력해주세요').fill('요금제 고객');
 await dialog.getByLabel('가입구분',{exact:true}).selectOption('1');await dialog.getByLabel('요금제군',{exact:true}).selectOption('2');
 await page.getByRole('dialog',{name:'요금제 변경 안내',exact:true}).getByRole('button',{name:'유지',exact:true}).click();
 await dialog.getByRole('button',{name:'실적 등록',exact:true}).click();await expect(page.getByText('요금제 유형과 세부 요금제를 선택해주세요.',{exact:true})).toBeVisible();expect(state.writes).toHaveLength(0);
 await dialog.getByRole('group',{name:'요금제 유형',exact:true}).getByRole('button',{name:'시니어',exact:true}).click();
 await expect(dialog.getByLabel('세부 요금제').locator('option')).toHaveCount(7);await dialog.getByLabel('세부 요금제').selectOption('senior_under28');
 await dialog.getByRole('group',{name:'요금제 유형',exact:true}).getByRole('button',{name:'주니어',exact:true}).click();
 await expect(dialog.getByLabel('세부 요금제')).toHaveValue('');await expect(dialog.getByLabel('세부 요금제').locator('option')).toHaveCount(11);
 await dialog.getByRole('group',{name:'요금제 유형',exact:true}).getByRole('button',{name:'일반',exact:true}).click();
 await expect(dialog.getByLabel('세부 요금제').locator('option')).toHaveCount(14);await dialog.getByLabel('세부 요금제').selectOption('general_95');
 await expect(dialog.getByLabel('요금제군',{exact:true})).toHaveValue('2');expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 await dialog.getByRole('button',{name:'실적 등록',exact:true}).click();await expect(dialog).toHaveCount(0);
 expect(state.writes[0].p_meta.planDetail.key).toBe('general_95');expect(state.day.matrix[1][2]).toBe(1);
 const original=structuredClone(state.day);
 await page.getByRole('button',{name:'판매건 수정',exact:true}).click();await expect(dialog.getByLabel('세부 요금제')).toHaveValue('general_95');
 await dialog.getByLabel('세부 요금제').selectOption('general_105');await dialog.getByRole('button',{name:'수정 저장',exact:true}).click();await expect(dialog).toHaveCount(0);
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
 const sale={id:'old-sale',user_id:employeeId,sale_date:'2026-10-01',source_type:'mobile',schema_version:3,metric_label:'MNP · 115군↑',customers:{customer_name:'기존 고객'},source_meta:{ri:1,ci:0,strategicPlan:true,vasKeys:[],bundle2ndKeys:[],bundleVasMap:{},bundleVasCommissionExcluded:true}};
 const state=await open(page,{sales:[sale]});state.day={matrix:[[0],[1]],groups:{}};
 await expect(page.getByText('세부 요금제 미입력',{exact:true})).toBeVisible();await page.getByRole('button',{name:'판매건 수정',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'모바일 실적 입력',exact:true});
 await expect(dialog.getByRole('button',{name:/본사 전략요금제/})).toContainText('✓');await expect(dialog.getByLabel('세부 요금제')).toHaveValue('');
 await dialog.getByRole('group',{name:'요금제 유형',exact:true}).getByRole('button',{name:'일반',exact:true}).click();await dialog.getByLabel('세부 요금제').selectOption('general_130');
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
