// Real App/calendar rendering with mocked configuration API; not authenticated E2E.
import {test,expect} from '@playwright/test';
async function openCalendar(page,{ready=[],failed=false}={}){
 const writes=[];
 await page.clock.setFixedTime(new Date('2026-10-01T03:00:00Z'));
 await page.route('https://placeholder.supabase.co/**',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(req.method()!=='GET'&&/daily_records|monthly_status|customer_sales|home_orders|save_home_bundle_atomic/.test(url.pathname))writes.push(url.pathname);
  if(url.pathname.endsWith('/profiles'))return route.fulfill({json:[{id:'00000000-0000-4000-8000-000000000001',name:'캘린더검증',store_name:'대야동_롯데마트점',position:'사원',role:'employee',active:true,hire_date:'2026-01-01'}]});
  if(url.pathname.endsWith('/app_config')&&url.searchParams.get('config_key')?.startsWith('in.')){
   if(failed)return route.fulfill({status:503,json:{message:'unavailable'}});
   return route.fulfill({json:[{config_key:'policy_ready_months',value:ready},{config_key:'policy_blocked_months',value:[]}]});
  }
  return route.fulfill({json:[]});
 });
 await page.goto('/tests/ui/calendar.html?open=daily');
 return writes;
}
test('10월 미반영 정책 문구와 실제 모바일·홈 입력 버튼 잠금',async({page})=>{
 const writes=await openCalendar(page);
 await expect(page.getByTestId('policy-input-pending')).toContainText('10월 정책 입력 전');
 await expect(page.getByRole('button',{name:/모바일 실적 입력/})).toBeDisabled();
 await expect(page.getByRole('button',{name:/홈 실적 입력/})).toBeDisabled();
 await page.getByTestId('sale-day-02').click();
 await expect(page.getByRole('button',{name:/모바일 실적 입력/})).toBeDisabled();
 expect(writes).toEqual([]);
});
test('10월 정책 반영 완료 설정을 받은 경우에만 입력 버튼을 연다',async({page})=>{
 await openCalendar(page,{ready:['2026-10']});
 await expect(page.getByRole('button',{name:/모바일 실적 입력/})).toBeEnabled();
 await expect(page.getByRole('button',{name:/홈 실적 입력/})).toBeEnabled();
 await expect(page.getByTestId('policy-input-pending')).toHaveCount(0);
});
test('정책 상태 조회 실패는 입력 가능 상태로 바뀌지 않는다',async({page})=>{
 const writes=await openCalendar(page,{failed:true});
 await expect(page.getByTestId('policy-input-pending')).toContainText('10월 정책 입력 전');
 await expect(page.getByRole('button',{name:/모바일 실적 입력/})).toBeDisabled();
 expect(writes).toEqual([]);
});
