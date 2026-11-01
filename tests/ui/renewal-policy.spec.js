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
  if(table==='app_config'&&u.searchParams.get('config_key')?.startsWith('in.'))return route.fulfill({json:[{config_key:'policy_ready_months',value:['2026-10','2026-11']},{config_key:'policy_blocked_months',value:[]}]});
  if(table==='save_sale_atomic'){
   const p=req.postDataJSON();state.writes.push(p);state.day=p.p_next_day;
   state.sales=[{id:p.p_sale_id,user_id:p.p_user_id,sale_date:p.p_sale_date,source_type:p.p_source_type,source_meta:p.p_meta,metric_label:p.p_metric_label,schema_version:3,customers:{customer_name:p.p_customer_name}}];
   return route.fulfill({json:{sale_count:1,daily_data:state.day}});
  }
  if(table==='delete_sale_atomic'){const p=req.postDataJSON();state.writes.push(p);state.day=p.p_next_day;state.sales=[];return route.fulfill({json:{sale_count:1,daily_data:state.day}});}
  if(table==='customer_sales')return route.fulfill({json:state.sales});
  if(table==='daily_records'&&req.method()==='POST'){state.day=req.postDataJSON().data;return route.fulfill({json:{user_id:employeeId,work_date:date}});}
  if(table==='daily_records')return route.fulfill({json:u.searchParams.get('work_date')?.startsWith('eq.')?(state.day?{data:state.day}:null):(state.day?[{user_id:employeeId,work_date:date,data:state.day}]:[])});
  return route.fulfill({json:[]});
 });
 await page.goto(`/tests/ui/calendar.html?actor=${actor}&open=daily`);
 return state;
}
for(const width of [320,390])test(`${width}px 재약정 화면 선택과 8만/6만 지급액이 일치한다`,async({page})=>{
 const state=await open(page,{width,date:'2026-11-01'});await page.getByRole('button',{name:/인터넷 재약정/}).click();
 const modal=page.getByText('재약정 실적 입력',{exact:true}).locator('..');
 const amount=()=>modal.getByText('자동 계산 지급액',{exact:true}).locator('..').locator('div.text-2xl');
 await expect(amount()).toHaveText('80,000원');
 await modal.getByRole('button',{name:/동일 또는 그 외 요금제 · 60,000원/}).click();await expect(amount()).toHaveText('60,000원');
 await modal.getByRole('checkbox',{name:/속도 상향 재약정/}).check();await expect(amount()).toHaveText('90,000원');
 await modal.getByRole('checkbox',{name:/HS 동시판매/}).check();await expect(amount()).toHaveText('170,000원');
 await modal.getByRole('checkbox',{name:/TV 업셀/}).check();await expect(amount()).toHaveText('190,000원');
 expect(await modal.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 await modal.getByRole('button',{name:'등록',exact:true}).click();await expect(page.getByText('재약정 실적 입력',{exact:true})).toHaveCount(0);
 await expect.poll(()=>state.day?.groups?.renew?.renewOther1G).toBe(1);expect(state.day.groups.renew.renewPremiumSafe1G||0).toBe(0);
});
