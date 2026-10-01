import {test,expect} from '@playwright/test';
async function open(page,{width=390,date='2026-10-01'}={}){
 await page.setViewportSize({width,height:844});await page.clock.setFixedTime(new Date(`${date}T03:00:00Z`));
 const state={sales:[],day:null,writes:[]};
 await page.route('https://placeholder.supabase.co/**',async route=>{
  const req=route.request(),url=new URL(req.url()),name=url.pathname.split('/').pop();
  if(name==='profiles')return route.fulfill({json:[{id:'00000000-0000-4000-8000-000000000001',name:'캘린더검증',store_name:'대야동_롯데마트점',position:'사원',role:'employee',active:true,hire_date:'2026-01-01'}]});
  if(name==='app_config'&&url.searchParams.get('config_key')?.startsWith('in.'))return route.fulfill({json:[{config_key:'policy_ready_months',value:['2026-10']},{config_key:'policy_blocked_months',value:[]}]});
  if(name==='save_sale_atomic'){
   const p=req.postDataJSON();state.writes.push(p);state.day=p.p_next_day;
   state.sales=[{id:p.p_sale_id,user_id:p.p_user_id,customer_id:'customer',sale_date:p.p_sale_date,source_type:p.p_source_type,source_meta:p.p_meta,metric_label:p.p_metric_label,schema_version:3,customers:{customer_name:p.p_customer_name}}];
   return route.fulfill({json:{sale_count:1,daily_data:state.day}});
  }
  if(name==='delete_sale_atomic'){
   const p=req.postDataJSON();state.writes.push(p);state.day=p.p_next_day;state.sales=[];
   return route.fulfill({json:{sale_count:1,daily_data:state.day}});
  }
  if(name==='customer_sales')return route.fulfill({json:url.searchParams.has('id')?(state.sales[0]||null):state.sales});
  if(name==='daily_records')return route.fulfill({json:url.searchParams.get('work_date')?.startsWith('eq.')?(state.day?{data:state.day}:null):(state.day?[{user_id:'00000000-0000-4000-8000-000000000001',work_date:date,data:state.day}]:[])});
  return route.fulfill({json:[]});
 });
 await page.goto('/tests/ui/calendar.html?open=daily');
 await page.getByRole('button',{name:/모바일 실적 입력/}).click();
 return state;
}
for(const [model,width] of [['iphone18_pro',320],['iphone18_pro_max',390]])test(`${model}: 전월 연결 등록·수정·삭제, ${width}px`,async({page})=>{
 const state=await open(page,{width});
 const dialog=page.getByRole('dialog',{name:'모바일 실적 입력',exact:true});
 await dialog.getByRole('button',{name:'전월 모단말에 2ND 추가'}).click();
 await dialog.getByLabel('전월 모단말 모델').selectOption(model);
 await dialog.getByLabel('모단말 판매일').fill('2026-09-18');
 await dialog.getByLabel('모단말 요금제군').selectOption('0');
 await dialog.getByPlaceholder('고객명을 입력해주세요').fill('전월 모단말 고객');
 await dialog.getByRole('button',{name:/애플워치/}).click();
 await expect(dialog.getByText(/메인회선 전략/)).toHaveCount(0);
 await expect(dialog.getByLabel('가입구분',{exact:true})).toHaveCount(0);
 expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 await dialog.getByRole('button',{name:'실적 등록',exact:true}).click();
 await expect(dialog).toHaveCount(0);
 expect(state.writes).toHaveLength(1);
 const first=state.writes[0];expect(first.p_meta.secondParent).toEqual({model,date:'2026-09-18',ci:0});
 expect(first.p_meta.secondOnlyBundle).toBe(true);expect(first.p_next_day.matrix.flat().reduce((a,b)=>a+b,0)).toBe(0);
 expect(first.p_next_day.groups.bundle2nd.b_AppleWatch).toBe(1);expect(first.p_tasks).toEqual([]);
 await page.getByRole('button',{name:'판매건 수정',exact:true}).click();
 // Use actual dialog regardless of title wording in the shared form.
 const editing=page.getByRole('dialog').filter({has:page.getByLabel('전월 모단말 모델')});
 await expect(editing.getByLabel('전월 모단말 모델')).toHaveValue(model);
 await expect(editing.getByLabel('모단말 판매일')).toHaveValue('2026-09-18');
 await editing.getByRole('button',{name:'할인판매',exact:true}).click();
 await editing.getByRole('button',{name:'수정 저장',exact:true}).click();
 await expect(editing).toHaveCount(0);expect(state.writes).toHaveLength(2);
 expect(state.day.groups.bundle2nd.b_AppleWatch).toBe(1);expect(state.day.matrix.flat().reduce((a,b)=>a+b,0)).toBe(0);
 expect(state.day.bundleFreeOffset).toBe(130000);
 await page.getByRole('button',{name:'삭제',exact:true}).click();
 await page.getByRole('button',{name:'판매건 삭제',exact:true}).click();
 await expect(page.getByRole('button',{name:'판매건 수정',exact:true})).toHaveCount(0);
 await expect.poll(()=>state.writes.length).toBe(3);expect(state.day.bundleFreeOffset).toBe(0);expect(state.day.groups.bundle2nd.b_AppleWatch).toBe(0);
 expect(state.day.matrix.flat().reduce((a,b)=>a+b,0)).toBe(0);
});
test('전월 모델·날짜·115군 조건 검사, Galaxy 자회선 선택 및 모드 전환',async({page})=>{
 const state=await open(page);
 const dialog=page.getByRole('dialog',{name:'모바일 실적 입력',exact:true});
 await dialog.getByRole('button',{name:'전월 모단말에 2ND 추가'}).click();
 await dialog.getByPlaceholder('고객명을 입력해주세요').fill('조건 점검');
 await dialog.getByLabel('전월 모단말 모델').selectOption('iphone18_pro');
 await dialog.getByLabel('모단말 판매일').fill('2026-08-31');
 await dialog.getByLabel('모단말 요금제군').selectOption('1');
 await dialog.getByRole('button',{name:/애플워치/}).click();
 await dialog.getByRole('button',{name:'실적 등록',exact:true}).click();
 await expect(page.getByText('모단말 판매일은 바로 전월 날짜로 입력해주세요.',{exact:true})).toBeVisible();
 await dialog.getByLabel('모단말 판매일').fill('2026-09-30');await dialog.getByRole('button',{name:'실적 등록',exact:true}).click();
 await expect(page.getByText('애플워치는 모단말 115군 이상 조건을 확인해주세요.',{exact:true})).toBeVisible();expect(state.writes).toEqual([]);
 await dialog.getByLabel('전월 모단말 모델').selectOption('galaxy_s');
 await expect(dialog.getByRole('button',{name:/애플워치/})).toHaveCount(0);
 await expect(dialog.getByRole('button',{name:/X216/})).toBeVisible();
 await dialog.getByRole('button',{name:'전월 모단말에 2ND 추가'}).click();
 await expect(dialog.getByLabel('전월 모단말 모델')).toHaveCount(0);
 await expect(dialog.getByLabel('가입구분',{exact:true})).toHaveValue('');
});
test('Galaxy 전월 모단말: 자회선만 저장하고 방금 등록 취소로 되돌린다',async({page})=>{
 const state=await open(page,{width:320});
 state.day={bundleFreeVasOffset:12000}; // unrelated legacy adjustment must survive
 const dialog=page.getByRole('dialog',{name:'모바일 실적 입력',exact:true});
 await dialog.getByRole('button',{name:'전월 모단말에 2ND 추가'}).click();
 await dialog.getByLabel('전월 모단말 모델').selectOption('galaxy_foldable');
 await dialog.getByLabel('모단말 판매일').fill('2026-09-15');await dialog.getByLabel('모단말 요금제군').selectOption('1');
 await dialog.getByPlaceholder('고객명을 입력해주세요').fill('갤럭시 전월 고객');
 await dialog.getByRole('button',{name:/X216/}).click();
 await dialog.getByRole('button',{name:/폰교체/}).click();
 expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 await page.screenshot({path:'/tmp/miso-second-parent.png'});
 await dialog.getByRole('button',{name:'실적 등록',exact:true}).click();await expect(dialog).toHaveCount(0);
 expect(state.day.groups.bundle2nd.b_X216).toBe(1);expect(state.day.matrix.flat().reduce((a,b)=>a+b,0)).toBe(0);
 expect(state.writes[0].p_meta.bundleVasMap.b_X216).toEqual(['vasPhonePass']);
 await page.getByRole('button',{name:'방금 등록 취소',exact:true}).click();
 await expect.poll(()=>state.writes.length).toBe(2);expect(state.day.groups.bundle2nd.b_X216).toBe(0);expect(state.day.bundleFreeVasOffset).toBe(12000);
 expect(state.day.matrix.flat().reduce((a,b)=>a+b,0)).toBe(0);
});
