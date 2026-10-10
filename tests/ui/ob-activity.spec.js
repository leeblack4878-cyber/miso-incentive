import {test,expect} from '@playwright/test';
async function open(page,{admin=false,width=390,fail=false}={}){
 await page.clock.setFixedTime(new Date('2026-10-10T03:00:00Z'));await page.setViewportSize({width,height:844});
 const writes=[],rows=[{id:'1',user_id:'ob-owner',employee_name:'김미소',store_name:'대야점',subscription_number:'U001',customer_name:'테스트고객',phone:'01012345678',purpose:'기변 권유',call_result:'부재',reaction:null,follow_up_date:'2026-10-10',contact_date:'2026-10-09',contacted_at:'2026-10-09T03:00:00Z',memo:'이전 통화'}];let failSave=false;
 await page.route('https://placeholder.supabase.co/**',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.pathname.endsWith('/rpc/append_ob_contact')){
   const b=req.postDataJSON();writes.push(b);if(failSave)return route.fulfill({status:500,json:{message:'fixture save failure'}});
   rows.unshift({id:String(rows.length+1),user_id:'ob-owner',employee_name:'김미소',store_name:'대야점',subscription_number:b.p_subscription_number,customer_name:b.p_customer_name,phone:b.p_phone,purpose:b.p_purpose,call_result:b.p_call_result,reaction:b.p_reaction,follow_up_date:b.p_follow_up_date,visit_at:b.p_visit_at,memo:b.p_memo,contact_date:'2026-10-10',contacted_at:'2026-10-10T03:00:00Z'});return route.fulfill({json:'saved-id'});
  }
  if(fail)return route.fulfill({status:500,json:{message:'fixture load failure'}});
  let data=rows.slice();for(const key of ['subscription_number','contact_date','store_name','user_id']){const val=url.searchParams.get(key);if(val?.startsWith('eq.'))data=data.filter(r=>r[key]===val.slice(3));}
  if(url.searchParams.get('limit')==='1')data=data.slice(0,1);return route.fulfill({json:data});
 });
 await page.goto('/tests/ui/ob-activity.html'+(admin?'?admin':''));return {rows,writes,setFailSave:v=>failSave=v};
}
for(const width of [320,390])test(`${width}px OB existing subscription autofill, append history, telephone and summary`,async({page})=>{
 const state=await open(page,{width});await page.getByRole('button',{name:'＋ OB 활동 기록',exact:true}).click();const d=page.getByRole('dialog',{name:'OB 활동 기록'});
 await d.getByLabel('가입번호 · 필수').fill('u 001');await d.getByLabel('고객명 · 필수').click();await expect(d.getByLabel('고객명 · 필수')).toHaveValue('테스트고객');
 await d.getByLabel('통화 결과',{exact:true}).selectOption('통화 완료');await d.getByLabel('고객 반응',{exact:true}).selectOption('관심 있음');await d.getByLabel('내용 · 선택').fill('방문 상담 희망');
 await d.getByRole('button',{name:'기록 저장',exact:true}).click();await expect(d).toHaveCount(0);expect(state.writes).toHaveLength(1);expect(state.writes[0].p_subscription_number).toBe('U001');
 expect(await page.locator('main').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 await page.getByRole('button',{name:/테스트고객.*관심 있음/}).click();const h=page.getByRole('dialog',{name:'고객 접촉 히스토리'});await expect(h.getByText('이전 통화',{exact:true})).toBeVisible();await expect(h.getByText('방문 상담 희망',{exact:true})).toBeVisible();await expect(h.getByRole('link',{name:'☎ 전화하기'})).toHaveAttribute('href','tel:01012345678');
 await h.getByRole('button',{name:'＋ 활동 추가',exact:true}).click();await expect(d.getByLabel('가입번호 · 필수')).toHaveValue('U001');await d.getByLabel('통화 결과',{exact:true}).selectOption('기타');await expect(d.getByLabel('고객 반응',{exact:true})).toHaveCount(0);await d.getByRole('button',{name:'기록 저장',exact:true}).click();await expect(d).toHaveCount(0);expect(state.writes[1].p_reaction).toBe(null);expect(state.rows).toHaveLength(3);
});
test('OB failed save retains input and failed load does not claim zero activity',async({page})=>{
 const s=await open(page);s.setFailSave(true);await page.getByRole('button',{name:'＋ OB 활동 기록',exact:true}).click();const d=page.getByRole('dialog',{name:'OB 활동 기록'});await d.getByLabel('가입번호 · 필수').fill('NEW');await d.getByLabel('고객명 · 필수').fill('신규고객');await d.getByLabel('연락처 · 필수').fill('01098765432');await d.getByLabel('통화 결과',{exact:true}).selectOption('통화 거절');await d.getByRole('button',{name:'기록 저장',exact:true}).click();await expect(d.getByRole('alert')).toBeVisible();await expect(d.getByLabel('고객명 · 필수')).toHaveValue('신규고객');await expect(d.getByRole('button',{name:'기록 저장',exact:true})).toBeEnabled();
 await open(page,{fail:true});await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByText('활동 건수',{exact:true})).toHaveCount(0);
});
for(const width of [320,390])test(`${width}px OB administrator shows zero-activity staff and filters store without overflow`,async({page})=>{
 const s=await open(page,{admin:true,width});await expect(page.getByRole('button',{name:/활동없는직원/})).toBeVisible();await page.getByLabel('OB 조회 날짜').fill('2026-10-09');await expect(page.getByRole('button',{name:/테스트고객/})).toBeVisible();await page.getByLabel('OB 매장').selectOption('상록점');await expect(page.getByRole('button',{name:/테스트고객/})).toHaveCount(0);await expect(page.getByRole('button',{name:/활동없는직원/})).toHaveCount(0);expect(await page.locator('main').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);expect(s.writes).toHaveLength(0);await expect(page.getByRole('button',{name:'＋ OB 활동 기록',exact:true})).toHaveCount(0);
});
