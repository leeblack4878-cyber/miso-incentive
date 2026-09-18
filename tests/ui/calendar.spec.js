// Real App/calendar rendering with mocked configuration API; not authenticated E2E.
import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{page.on('pageerror',error=>console.log('CALENDAR_RUNTIME_ERROR',error.message));});
test.afterEach(async({page},info)=>{if(info.status!==info.expectedStatus)console.log('CALENDAR_FAILURE_VIEW',(await page.locator('body').innerText()).slice(0,1200));});
async function openCalendar(page,{ready=[],failed=false,date='2026-10-01'}={}){
 const writes=[];
 await page.clock.setFixedTime(new Date(`${date}T03:00:00Z`));
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

for(const width of [320,390])test(`${width}px 분리된 실적입력 화면이 가로로 넘치지 않는다`,async({page})=>{
 await page.setViewportSize({width,height:844});await openCalendar(page,{ready:['2026-10']});
 await expect(page.getByRole('button',{name:/모바일 실적 입력/})).toBeEnabled();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});


test('9/18 홈 입력은 요금제를 명시적으로 선택하고 3건 전체 단가를 안내한다',async({page})=>{
 await page.setViewportSize({width:320,height:844});await openCalendar(page,{date:'2026-09-18'});
 await page.getByRole('button',{name:/홈 실적 입력/}).click();
 const dialog=page.getByRole('dialog',{name:'홈 실적 입력'});
 await dialog.getByRole('button',{name:'인터넷',exact:true}).click();
 const plan=dialog.getByRole('combobox',{name:/인터넷 요금제/});
 await expect(plan).toHaveValue('');await plan.selectOption('premiumSafe');
 await expect(plan).toHaveValue('premiumSafe');await expect(dialog).toContainText('3건 이상은 전체 건당 15만원');
 expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
});
test('9/18 아이폰18은 인센미지급 정책에서 선택하고 일반 추가지급 목록과 구분한다',async({page})=>{
 await openCalendar(page,{date:'2026-09-18'});
 await page.getByRole('button',{name:/모바일 실적 입력/}).click();
 await page.getByRole('button',{name:'인센미지급 특가',exact:true}).click();
 const iphone=page.getByRole('button',{name:/아이폰18 사전예약 특가 · MNP/});
 await expect(iphone).toContainText('300,000');await iphone.click();await expect(iphone).toContainText('✓');
 await expect(page.getByText(/선택 시 사전예약 판매로 기록됩니다/)).toBeVisible();
 await page.getByRole('button',{name:'특가&지인정책',exact:true}).click();
 await expect(iphone).toHaveCount(0);
 await expect(page.getByRole('button',{name:/S26-256\/512 · MNP/})).toContainText('100,000');
});
