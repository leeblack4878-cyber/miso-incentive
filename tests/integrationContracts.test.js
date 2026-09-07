import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('비밀번호 초기화는 관리자 승인과 첫 로그인 강제 변경을 사용한다', async () => {
  const [auth, admin, edge, sql] = await Promise.all([
    readFile(new URL('../src/AuthGate.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/PasswordResetAdmin.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../supabase/functions/password-reset-flow/index.ts', import.meta.url), 'utf8'),
    readFile(new URL('../sql/password_reset_flow.sql', import.meta.url), 'utf8'),
  ]);
  assert.match(auth, /비밀번호를 잃어버렸나요/);
  assert.match(auth, /must_change_password/);
  assert.match(auth, /session && !profile/);
  assert.match(admin, /임시 비밀번호 발급/);
  assert.match(edge, /updateUserById/);
  assert.match(edge, /user\.id!==ADMIN_ID/);
  assert.match(sql, /password_reset_requests_admin_select/);
});

test('본사 데이터 RLS는 관리자 전체조회와 직원 본인조회만 허용한다', async () => {
  const sql = await readFile(new URL('../supabase_head_office_performance.sql', import.meta.url), 'utf8');
  assert.match(sql, /head_office_performance_admin_select/);
  assert.match(sql, /head_office_performance_own_select/);
  assert.match(sql, /auth\.uid\(\)\)\s*=\s*user_id/);
});

test('직접 고객 약속은 판매건 source_sale_id와 연결해 저장한다', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(source, /source_sale_id:\s*(?:sale\.id|saved\.saleId|primarySaleId|editingSale\.id)/);
  assert.match(source, /task_type:\s*'custom'/);
});

test('93일·183일 변경 약속은 실적 입력일 기준으로 자동 계산한다', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(source, /key:'plan93'[\s\S]*retentionDays:93/);
  assert.match(source, /key:'plan183'[\s\S]*retentionDays:183/);
  assert.match(source, /base_date:saleDate[\s\S]*due_date:addDaysDate\(saleDate,t\.retentionDays\)/);
});

test('N개월 요금 수납은 추가한 월수만큼 저장하고 완료 전까지 반복 표시한다', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(source, /key:'payment3'[\s\S]*repeatCount:3/);
  assert.match(source, /N개월간 요금 수납 약속/);
  assert.match(source, /\+ 다음 회차 추가/);
  assert.match(source, /− 마지막 회차 삭제/);
  assert.match(source, /for\(let i=0;i<paymentCount;i\+\+\)/);
  assert.match(source, /task_type:`\$\{key\}_\$\{i\+1\}`/);
  assert.match(source, /due_date:addMonthsDate\(paymentFirstDate,i\)/);
  assert.match(source, /한 회차를 완료해도 다음 회차는 그대로 유지되며, 모든 회차를 완료할 때까지 각 기한에 반복 표시돼요/);
  assert.match(source, /completedPaymentTypes\.has\(taskType\)/);
});

test('제휴카드 약속은 신청·수령·승인·자동이체 후 최종 완료한다', async () => {
  const [source, sql] = await Promise.all([
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../sql/customer_task_affiliate_card.sql', import.meta.url), 'utf8'),
  ]);
  assert.match(source, /key:'affiliateCard'/);
  assert.match(source, /\['신한카드','국민카드','현대카드','우리카드','삼성카드','롯데카드','하나카드','농협카드'\]/);
  assert.match(source, /카드사를 선택해주세요/);
  assert.match(source, /before_application:'신청 전'/);
  assert.match(source, /applied_unreceived:'신청완료 · 미수령'/);
  assert.match(source, /received_not_visited:'수령 · 미방문'/);
  assert.match(source, /approval_required/);
  assert.match(source, /autopay_registered/);
  assert.match(source, /최종 약속 완료/);
  assert.match(source, /이전 단계 되돌리기/);
  assert.match(source, /✓ 신청 완료/);
  assert.match(source, /✓ 수령 완료/);
  assert.match(source, /✓ 승인 확인/);
  assert.match(source, /✓ 자동이체 등록/);
  assert.match(sql, /task_meta jsonb not null default/);
});

test('판매 수정 중 여러 약속을 다시 저장해도 task_meta를 null로 보내지 않는다', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(source, /insert\(taskRows\.map\(row=>\(\{\.\.\.row,task_meta:row\.task_meta\|\|\{\}\}\)\)\)/);
  assert.match(source, /insert\(rows\.map\(row=>\(\{\.\.\.row,task_meta:row\.task_meta\|\|\{\}\}\)\)\)/);
});

test('고객 약속은 제휴카드·수납지원·변경·케이스로 구분해 표시한다', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(source, /function careTaskCategory/);
  assert.match(source, /return '제휴카드'/);
  assert.match(source, /return '수납지원'/);
  assert.match(source, /return '변경'/);
  assert.match(source, /return '케이스 및 기타'/);
});

test('제휴카드 거절 약속은 삭제하지 않고 취소 이력과 다시 진행을 제공한다', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(source, /function cancelAffiliateCard|const cancelAffiliateCard/);
  assert.match(source, /status:'cancelled'/);
  assert.match(source, /cancel_reason:'고객 거절'/);
  assert.match(source, /완료·취소/);
  assert.match(source, /다시 진행/);
});

test('판매 없이 기존·신규 고객에게 독립 약속을 등록할 수 있다', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(source, /function StandalonePromiseModal/);
  assert.match(source, /미완료 약속 고객과 \{month\} 판매 고객을 검색/);
  assert.match(source, /source_sale_id:null/);
  assert.match(source, /function ensurePromiseCustomer/);
  assert.match(source, /insert\(\{user_id:userId,customer_name:clean\}\)/);
  assert.match(source, /기존 고객을 선택하거나 신규 고객명을 입력/);
  assert.match(source, /고객 약속 등록/);
  assert.match(source, /eq\('status','pending'\)/);
  assert.match(source, /gte\('sale_date',`\$\{month\}-01`\)/);
});

test('직원 실적입력 화면에는 스팟 추가 인센티브 카드를 표시하지 않는다', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /<SpotClaimPanel\s+userId=/);
});

test('과거 판매 수정은 이전 source_meta를 보존 병합한다', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(source, /mergeSaleMetaPreservingLegacy\(editingSale\.source_meta/);
  assert.match(source, /legacySchemaVersion:\s*saleSchemaVersion\(editingSale\)/);
});

test('신규 판매는 정책 스냅샷을 저장하고 수정 시 기존 정책을 유지한다', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(source, /policySnapshot:salePolicySnapshot/);
  assert.match(source, /editingSale\.source_meta\?\.policySnapshot\|\|currentPolicySnapshot\(config\)/);
});

test('관리자 계산 검증은 기존 급여를 바꾸지 않고 판매별 그림자 원장을 비교한다', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(source, /function CalculationAuditPanel/);
  assert.match(source, /SHADOW LEDGER LOAD ERROR/);
  assert.match(source, /직원에게 표시되는 급여는 변경하지 않고/);
  assert.match(source, /missingSnapshots===0/);
  assert.match(source, /판매 저장·수정·삭제로 일일 집계가 바뀌면 관리자 그림자 원장도 즉시/);
  assert.match(source, /정책 준비 중이라 직원 실적 입력이 잠겨/);
  assert.match(source, /policy_blocked_months/);
});

test('저장 전에 모바일과 홈 중복 가능성을 확인한다', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(source, /중복 등록 가능성이 있어요/);
  assert.match(source, /from\('home_orders'\)[\s\S]*source_work_date/);
  assert.match(source, /from\('customer_sales'\)[\s\S]*sale_date/);
  assert.match(source, /homeSubmitGuardRef\.current/);
  assert.match(source, /mobileSubmitGuardRef\.current/);
});

test('홈 설치완료는 완료일을 필수로 저장한다', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(source, /homeDirectComplete && !homeActualCompleteDate/);
  assert.match(source, /actual_install_date:homeDirectComplete\?homeActualCompleteDate:null/);
});

test('관리자 홈 케어는 고객 묶음과 실시간 갱신을 사용한다', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(source, /function AdminHomeCare\(\{ employees, month \}\)/);
  assert.match(source, /postgres_changes[\s\S]*table:'home_orders'/);
  assert.match(source, /repeatedBundleCount=Math\.min\(mainHomeCount,internetCount\)/);
  assert.match(source, /동일 홈 구성 \$\{o\.repeatedBundleCount\}회 저장 확인/);
  assert.match(source, /repeatedProducts\.map/);
});

test('근속 배지는 계산된 근속개월에 따라 자동 획득한다', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(source, /const tenureMonths=Number\(pay\?\.months\|\|0\)/);
  assert.match(source, /\[\[1,'tenure1'\],[\s\S]*\[108,'tenure108'\],[\s\S]*\[180,'tenure180'\]\]/);
  assert.match(source, /if\(tenureMonths>=months\)earned\.add\(key\)/);
});

test('기존 기록을 포함한 통산 부가지표 배지를 150개 체계로 운영한다', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(source, /supabase\.from\('daily_records'\)\.select\('id,data'\)\.eq\('user_id',userId\)\.order\('id'\)\.range\(offset,offset\+999\)/);
  assert.match(source, /totals\.sono\+=Object\.values\(d\.groups\?\.sono\|\|\{\}\)/);
  assert.match(source, /career_home_\$\{threshold\}/);
  assert.match(source, /career_free_\$\{threshold\}/);
  assert.match(source, /career_smart_\$\{threshold\}/);
  assert.match(source, /career_upsell_\$\{threshold\}/);
  assert.match(source, /career_sono_\$\{threshold\}/);
  assert.match(source, /\/ \{BADGE_DEFS\.length\}/);
  assert.match(source, /b\.progressMetric==='tenure'/);
});

test('관리자 고객 약속은 관리 범위·진행단계·월별 이행률을 함께 제공한다', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const view = source.match(/function AdminCustomerCareOverview[\s\S]*?function AdminManagementAlerts/)?.[0]||'';
  assert.match(view, /\.in\('user_id',employeeIds\)/);
  assert.match(view, /기한 내 완료/);
  assert.match(view, /전체 카테고리/);
  assert.match(view, /제휴카드/);
  assert.match(view, /수납지원/);
  assert.match(view, /고객 거절/);
  assert.match(view, /자동이체 미등록/);
  assert.match(view, /회 완료/);
  assert.match(source, /setCustomerCareFilter\('overdue'\)/);
});

test('직원 전환 시 선택한 직원의 고객·약속·홈 설치를 일관되게 관리한다', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const employeeView = source.match(/function EmployeeView[\s\S]*?function DailyInputTab/)?.[0]||'';
  assert.match(employeeView, /const viewedUserId=currentEmp\?\.id\|\|authUser\?\.id/);
  assert.match(employeeView, /직원 대리 관리 중/);
  assert.match(employeeView, /<CustomerCareManager[\s\S]*?userId=\{viewedUserId\}/);
  assert.match(employeeView, /homeProps=\{\{[\s\S]*?userId:viewedUserId/);
  assert.match(employeeView, /<SalesExpensePanel[\s\S]*?userId=\{viewedUserId\}/);

  const sql = await readFile(new URL('../supabase/migrations/20260907140000_manager_target_data_write_access.sql', import.meta.url), 'utf8');
  for (const table of ['customers','customer_sales','customer_tasks','home_orders','sales_expenses']) {
    assert.match(sql, new RegExp(`${table}_manager_(?:insert|update|delete)`));
  }
  assert.match(sql, /can_write_target\(user_id\)/);
});

test('대리관리 직원 목록은 대표·실장, 담당 상권, 임원 제외 전사 범위를 구분한다', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(source, /NON_EXECUTIVE_COMPANY_CONTROLLERS = new Set\(\['정유미', '김솔이'\]\)/);
  assert.match(source, /COMPANY_SCOPE_VIEWERS\.has\(loginName\)[\s\S]*?employees/);
  assert.match(source, /NON_EXECUTIVE_COMPANY_CONTROLLERS\.has\(loginName\)[\s\S]*?!COMPANY_SCOPE_VIEWERS\.has/);
  assert.match(source, /loginAreaKey[\s\S]*?e\.id===authUser\?\.id\|\|SALES_AREA_STORES\[loginAreaKey\]/);

  const sql = await readFile(new URL('../supabase/migrations/20260907165135_refine_employee_proxy_scope.sql', import.meta.url), 'utf8');
  assert.match(sql, /v\.name in \('이강진', '김진문'\)/);
  assert.match(sql, /v\.name in \('정유미', '김솔이'\)/);
  assert.match(sql, /v\.name = '김진백'/);
  assert.match(sql, /v\.name = '임성준'/);
});

test('직원 시스템 권한 변경은 이강진 계정만 가능하고 변경 이력을 남긴다', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(source, /PRIMARY_PERMISSION_ADMIN_ID = 'a50a0979-acef-40b1-98b7-f05074f1c835'/);
  assert.match(source, /canManagePermissions=\{authUser\?\.id===PRIMARY_PERMISSION_ADMIN_ID\}/);
  assert.match(source, /canManagePermissions \? \[\{ key: 'permissions'/);
  assert.match(source, /adminTab === 'permissions' && canManagePermissions/);

  const sql = await readFile(new URL('../supabase/migrations/20260907170712_permission_admin_and_role_audit.sql', import.meta.url), 'utf8');
  assert.match(sql, /create or replace function public\.is_permission_admin\(\)/);
  assert.match(sql, /new\.role := old\.role/);
  assert.match(sql, /create table if not exists public\.profile_role_audit/);
  assert.match(sql, /changed_by/);
});

test('직원 홈 설치 처리 내역은 완료와 취소를 별도로 조회한다', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const homeManager = source.match(/function HomeOrderManager[\s\S]*?function [A-Z]/)?.[0]||'';
  assert.match(homeManager, /archiveFilter/);
  assert.match(homeManager, /설치완료 \$\{fmtCount\(completed\.length\)\}건/);
  assert.match(homeManager, /취소 \$\{fmtCount\(cancelled\.length\)\}건/);
  assert.match(homeManager, /archiveFilter==='completed'\?completed:cancelled/);
});

test('관리자 고객 통합검색은 판매 이력과 약속을 함께 찾는다', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const customerCare = source.match(/function AdminCustomerCareOverview[\s\S]*?function AdminManagementAlerts/)?.[0]||'';
  assert.match(customerCare, /customer_sales/);
  assert.match(customerCare, /고객 통합검색/);
  assert.match(customerCare, /판매 이력과 약속을 한 번에 찾아요/);
  assert.match(customerCare, /판매 \{customerSales\.length\} · 약속 \{customerTasks\.length\}/);
  assert.doesNotMatch(customerCare, /customer_sales'\)\.select\('[^']*status/);
});

test('오늘 휴무일이면 미입력으로 안내하지 않는다', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(source, /todayIsDayOff=isCurrentHomeMonth[\s\S]*\.dayOff/);
  assert.match(source, /todayInputDone=\{todayHasInput\|\|todayIsDayOff\}/);
});

test('판매 저장 피드백은 최저보장 마감액이 아닌 실제 누적 증가분을 사용한다', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(source, /afterPay\.currentPerformanceAmount[\s\S]*beforePay\.currentPerformanceAmount/);
  assert.match(source, /이번 판매로 총 \+\{won\(toast\.payDelta\)\}/);
  assert.match(source, /판매 인센티브.*활동지원금/);
  assert.doesNotMatch(source, /예상 인센티브 \+\{won\(toast\.payDelta\)\}/);
});

test('직원 오늘 할 일은 항목별 화면과 필터로 바로 이동한다', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(source, /goCustomerCare=\(type\)=>/);
  assert.match(source, /navIntent\.type==='today'/);
  assert.match(source, /navIntent\.type==='overdue'/);
  assert.match(source, /navIntent\.type==='home'/);
  assert.match(source, /마감 전 확인할 누락/);
});

test('취소된 고객 약속은 직원 홈의 오늘·기한경과 건수에서 제외한다', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(source, /const pending=\(tasks\|\|\[\]\)\.filter\(x=>x\.status!==['"]completed['"]&&x\.status!==['"]cancelled['"]\)/);
  assert.match(source, /window\.dispatchEvent\(new CustomEvent\('customer-tasks-changed'/);
  assert.match(source, /window\.addEventListener\('customer-tasks-changed',refresh\)/);
});

test('월 목표 현황은 기존 핵심지표의 목표 실적 진척도 예상마감을 한 줄로 표시한다', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(source, /<span>목표<\/span><span>실적<\/span><span>진척도<\/span><span>예상 마감<\/span>/);
  for (const label of ['HS','SIM MNP','2ND','생산성','홈','프리','스홈','소노','맞춤제안 매출액','업셀건']) assert.match(source, new RegExp(`label:'${label}'`));
  assert.match(source, />입력 필요<\/button>/);
});

test('관리자 홈은 처리할 업무를 실제 관리 메뉴에 연결한다', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  for (const tab of ['performanceApproval', 'customerCareAdmin', 'homeCare', 'spot', 'headOfficeData', 'settlement', 'employees']) {
    assert.match(source, new RegExp(`onGo\\('${tab}'\\)`));
  }
  assert.match(source, /status==='checked'\|\|x\.status==='final'/);
});

test('관리자 홈은 월말 예상 HS가 목표에 못 미치는 매장을 바로 표시한다', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(source, /const goalRisk=\(goals\|\|\[\]\)\.filter/);
  assert.match(source, /actual\*forecastFactor<target/);
  assert.match(source, /onGo\('storeGoals'\)[\s\S]*?HS 목표 위험 매장/);
});

test('관리자 홈은 푸시 미설정과 최근 발송 성공·실패를 구독 비밀값 없이 표시한다', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const migration = await readFile(new URL('../supabase/migrations/20260907130000_push_delivery_overview_rpc.sql', import.meta.url), 'utf8');
  assert.match(source, /supabase\.rpc\('get_push_delivery_overview'\)/);
  assert.match(source, /푸시 알림 미설정/);
  assert.match(source, /최근 푸시 발송 실패/);
  assert.match(source, /최근 발송 성공/);
  assert.doesNotMatch(migration, /select\s+[^;]*endpoint[^_]/i);
  assert.match(migration, /revoke all on function public\.get_push_delivery_overview\(\) from public/);
});

test('관리자 큰 카테고리 아래 세부 탭은 아이콘과 선택 표시가 분명한 버튼으로 보인다', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(source, /세부 메뉴/);
  assert.match(source, /<n\.icon size=\{12\}/);
  assert.match(source, /border-violet-300 bg-white text-violet-700 shadow-sm ring-1 ring-violet-100/);
  assert.match(source, /rounded-full bg-violet-500/);
});

test('관리자 세부 메뉴는 최대 3개의 개인 바로가기를 제공한다', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(source, /miso_admin_favorites_v1:/);
  assert.match(source, /내 바로가기/);
  assert.match(source, /최대 3개까지 지정할 수 있어요/);
  assert.match(source, /favoriteTabs\.map/);
  assert.match(source, /즐겨찾기 추가/);
  assert.match(source, /min-h-11/);
});

test('중요한 성취 축하는 사용자별 한 번만 표시한다', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(source, /miso-celebration-badge-/);
  assert.match(source, /HS \$\{v\}건 돌파!/);
  assert.match(source, /전체 순위 TOP\$\{rank\} 진입!/);
  assert.match(source, /새로운 배지 획득!/);
});

test('알림센터는 본인 조회와 관리 범위 발송 RLS를 함께 사용한다', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const sql = await readFile(new URL('../supabase_employee_notifications.sql', import.meta.url), 'utf8');
  assert.match(source, /<NotificationBell userId=\{authUser\?\.id\}/);
  assert.match(source, /special_(approved|rejected)/);
  assert.match(source, /spot_(approved|rejected)/);
  assert.match(source, /settlement_reviewed/);
  assert.match(sql, /notifications_insert_own_event/);
  assert.match(sql, /notifications_insert_managed_employee/);
  assert.match(sql, /actor\.store_name = recipient\.store_name/);
});

test('스마트홈과 HS 동시판매는 고객 묶음당 추가 수수료를 한 번 반영한다', async () => {
  const [app, engine] = await Promise.all([
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/policyEngine.js', import.meta.url), 'utf8'),
  ]);
  assert.match(app, /calculateHomePolicyFromOrders as calculateHomePolicyEngine/);
  assert.doesNotMatch(app, /function calculateHomePolicyFromOrders\(/);
  assert.match(engine, /smartHomeSimulRate[\s\S]*key === 'smartHomeSimul'/);
  assert.match(engine, /bundle\.types\.has\('smartHome'\)[\s\S]*bundle\.simul !== 'none'/);
  assert.match(engine, /homeAddonPay = simulPay \+ smartHomeSimulPay \+ subSetTopPay \+ limitedPolicyPay/);
  assert.match(engine, /item: '스마트홈 동시판매'/);
});

test('정책 달력과 DB 기준 스냅샷으로 지난달 지급기준을 보존한다', async () => {
  const [app, calendar, migration] = await Promise.all([
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/policyCalendar.js', import.meta.url), 'utf8'),
    readFile(new URL('../supabase/migrations/20260905010000_policy_history_and_function_hardening.sql', import.meta.url), 'utf8'),
  ]);
  assert.match(app, /resolvePolicyConfigForMonth\(month,legacy,values\[POLICY_HISTORY_CONFIG_KEY\]\)/);
  assert.match(app, /policySnapshot:salePolicySnapshot/);
  assert.match(calendar, /effectiveFrom: `\$\{SEPTEMBER_POLICY_MONTH\}-01`/);
  assert.match(calendar, /history\?\.baseSnapshots/);
  assert.match(migration, /'policy_history_v1'/);
  assert.match(migration, /'2026-08-v1'/);
  assert.match(migration, /on conflict \(config_key\) do nothing/);
});

test('판매 완료 카드에 성과P 전략P 생산성 증가분을 함께 표시한다', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const strategicSource = await readFile(new URL('../src/strategicPoints.js', import.meta.url), 'utf8');
  assert.match(source, /strategicPointDelta:mobileStrategicPoint/);
  assert.match(source, /productivityDelta:Number\(afterPay\.kpiScore/);
  assert.match(source, /bundle2ndKpiPoints=Number/);
  assert.match(source, /const kpiScore=baseKpiScore\+bundle2ndKpiPoints/);
  assert.match(source, /성과P \+\$\{fmtNum\(toast\.pointDelta,1\)\}P · 전략P \+\$\{fmtNum\(toast\.strategicPointDelta,1\)\}P · 생산성 \+\$\{fmtNum\(toast\.productivityDelta,1\)\}P/);
  assert.match(strategicSource, /vasVcolorBundle: 1/);
  assert.match(strategicSource, /vasVcolorMusic: 0\.3/);
});

test('모바일 빠른 입력은 최근 조합·단계형 추가항목·계산근거·완전한 실행취소를 제공한다', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(source, /const \[mobileSaleKind,setMobileSaleKind\]=useState\('\'\)/);
  assert.match(source, /const addOne = \(ri=null,ci=null\)/);
  assert.match(source, /if\(!mobileSaleDraft\|\|!mobileSaleKind\|\|!Number\.isInteger\(mobileSaleDraft\.ri\)/);
  assert.match(source, /miso_recent_mobile_combos_v1/);
  assert.match(source, /최근 판매 조합 빠른 선택/);
  assert.match(source, /2ND·고객약속·영업비용 추가/);
  assert.match(source, /계산 근거 보기/);
  assert.match(source, /\['생산성',mobilePreview\.productivity\]/);
  assert.match(source, /\['전략P',mobilePreview\.strategicPoints\]/);
  assert.match(source, /sales_expenses'\)\.delete\(\)\.eq\('source_sale_id',toast\.customerSaleId\)/);
  assert.match(source, /if\(toast\.usedMnpBundle\)nextMnpBundle\.usedMnpBundle/);
  assert.match(source, /방금 등록 취소/);
  assert.match(source, /VAS·보험 \$\{vasLabels\.length\}개/);
  assert.match(source, /홈 실적 기준 예상 조정/);
  assert.match(source, /전략포인트 비중 예상 조정/);
  assert.match(source, /정산 시 최종 반영액은 달라질 수 있습니다/);
  assert.doesNotMatch(source, /2ND 회선 VAS 수수료 제외/);
  assert.match(source, /bundleVasCommissionExcluded:true/);
  assert.match(source, /vasKeys:\[\.\.\.mobileVasKeys\], bundleVasMap:mobileBundleVasMap/);
});

test('일일 입력은 기기 임시저장과 온라인 복구 재시도를 제공한다', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(source, /miso_pending_daily_v1:/);
  assert.match(source, /localStorage\.setItem\(pendingDayStorageKey/);
  assert.match(source, /window\.addEventListener\('online',syncConnection\)/);
  assert.match(source, /저장되지 않은 일일 입력을 복원했어요/);
  assert.match(source, /저장 실패 · 다시 시도/);
  assert.match(source, /오프라인 · 임시저장/);
  assert.match(source, /동기화 정상/);
});

test('9월 모바일 입력은 사용하지 않는 33~84군을 숨기고 기존 선택을 그 외로 전환한다', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(source, /option\.ci===3/);
  assert.match(source, /storedCi===3\?5:storedCi/);
  assert.match(source, /Number\(meta\.ci\)===3\?5:meta\.ci/);
  assert.match(source, /activeMatrixOptions\.map/);
});

test('9월 VAS 입력은 구형 V컬러링 중복을 숨기고 기타 전략 항목을 접어 표시한다', async () => {
  const [source, september, hq] = await Promise.all([
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/septemberPolicy.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/HqStructurePolicyView.jsx', import.meta.url), 'utf8'),
  ]);
  assert.match(source, /v\.key==='vasVcolor'/);
  assert.match(source, /k==='vasVcolor'\?'vasVcolorBundle':k/);
  assert.match(source, /기타 전략 항목 \{mobileMoreVasOpen\?'접기':'펼치기'\}/);
  assert.match(source, /primaryMainVas/);
  assert.match(source, /additionalMainVas/);
  assert.match(september, /key: 'vasDaemyung', label: '소노'/);
  assert.doesNotMatch(hq, /대명 2P/);
  assert.match(hq, /소노 2P/);
});

test('명예의 전당 위치와 프로필·실적 통합 카드를 간결하게 유지한다', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const sql = await readFile(new URL('../supabase_employee_public_profiles.sql', import.meta.url), 'utf8');
  assert.match(source, /function HallOfFame/);
  assert.match(source, /function RecognitionRankingHub/);
  assert.match(source, /명예의 전당 · 월간 순위/);
  const recognitionHub = source.match(/function RecognitionRankingHub[\s\S]*?function GamificationHub/)?.[0]||'';
  assert.match(recognitionHub, /<HallOfFame/);
  assert.match(recognitionHub, /<MonthlyPerformanceRankingCard/);
  assert.doesNotMatch(recognitionHub, /setActiveTab|role="tab"/);
  assert.match(source, /전체 직원 프로필 보기/);
  assert.match(source, /employee_public_profiles.*status_message/);
  const hub = source.match(/function GamificationHub[\s\S]*?function SpecialBadgeAwardPanel/)?.[0]||'';
  assert.doesNotMatch(hub, /동료에게 공개되는 나의 한줄 상태/);
  assert.doesNotMatch(hub, /오늘의 응원/);
  assert.match(hub, /현재 실적 금액/);
  assert.match(hub, /급여 확인·비교/);
  assert.match(hub, /실적 입력/);
  assert.ok(source.lastIndexOf('<HallOfFame') < source.lastIndexOf('<MonthlyPerformanceRankingCard'));
  assert.doesNotMatch(source.match(/function HallOfFame[\s\S]*?function GamificationHub/)?.[0]||'', /dailyEncouragement/);
  assert.match(sql, /employee_public_profiles_read_authenticated/);
  assert.match(sql, /user_id = \(select auth\.uid\(\)\)/);
  assert.match(sql, /char_length\(coalesce\(status_message, ''\)\) <= 40/);
});

test('설치형 웹앱은 manifest 서비스워커 기기별 설치 안내를 제공한다', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const main = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8');
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const manifest = JSON.parse(await readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));
  const sw = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.name, '미소페이');
  assert.equal(manifest.icons.length, 2);
  assert.match(html, /rel="manifest"/);
  assert.match(html, /apple-touch-icon/);
  assert.match(main, /serviceWorker\.register\('\/sw\.js'\)/);
  assert.match(source, /beforeinstallprompt/);
  assert.match(source, /홈 화면에 추가/);
  assert.match(sw, /event\.request\.mode === 'navigate'/);
  assert.match(sw, /fetch\(event\.request\)/);
});

test('첫 사용자는 역할별 빠른 안내를 보고 언제든 다시 열 수 있다', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(source, /function AppQuickGuide/);
  assert.match(source, /miso_quick_guide_v1:/);
  assert.match(source, /미소페이, 이렇게 사용하세요/);
  assert.match(source, /isManager=\{role==='admin'\}/);
  assert.match(source, /title="사용 안내"/);
});

test('휴대폰 푸시는 본인 구독 RLS와 알림 클릭 이동 및 고객 약속 예약을 제공한다', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const sw = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
  const sql = await readFile(new URL('../sql/push_notifications.sql', import.meta.url), 'utf8');
  assert.match(source, /pushManager\.subscribe/);
  assert.match(source, /push_subscriptions/);
  assert.match(source, /테스트 알림/);
  assert.match(sw, /addEventListener\('push'/);
  assert.match(sw, /notificationclick/);
  assert.match(sw, /vibrate: \[180, 80, 180\]/);
  assert.match(sql, /auth\.uid\(\)\) = user_id/);
  assert.match(sql, /miso-due-customer-task-push/);
  assert.match(sql, /'0 0 \* \* \*'/);
});

test('인센미지급 특가는 요금제 VAS 보험만 제외하고 과거 무료폰 기록도 호환한다', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const sql = await readFile(new URL('../sql/free_phone_special_policy.sql', import.meta.url), 'utf8');
  assert.match(source, /FREE_PHONE_SPECIAL_TITLE = '무료폰 특가'/);
  assert.match(source, /policyType:'incentive_unpaid'/);
  assert.match(source, /판매 실적·성과P·영업 활동 지원비 건수는 인정/);
  assert.match(source, /isIncentiveUnpaidSpecial/);
  assert.match(source, /VAS·보험 제외/);
  assert.match(sql, /replacement_amount/);
  assert.match(sql, /2099-12-31/);
});

test('본사 구조정책은 현재 기준액과 월말 예상액을 정책별로 비교한다', async () => {
  const [view, policy] = await Promise.all([
    readFile(new URL('../src/HqStructurePolicyView.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/hqStructurePolicy.js', import.meta.url), 'utf8'),
  ]);
  assert.match(view, /현재 실적 기준 합계/);
  assert.match(view, /월말 예상 합계/);
  assert.match(view, /자가매장 운영비 · 월간판매량 · 매출지표 · 월간 시상 · 홈 구조정책 합계/);
  assert.match(view, /<ForecastAmountStrip[\s\S]*forecastSelfStore/);
  assert.match(view, /<ForecastAmountStrip[\s\S]*forecastRetail/);
  assert.match(view, /<ForecastAmountStrip[\s\S]*forecastSalesMetric/);
  assert.match(view, /<ForecastAmountStrip[\s\S]*forecastAward/);
  assert.match(view, /<ForecastAmountStrip[\s\S]*forecastHomeGrade/);
  assert.match(view, /<ForecastAmountStrip[\s\S]*forecastHomeInternetRatio/);
  assert.match(view, /<ForecastAmountStrip[\s\S]*forecastHomeAward/);
  assert.match(view, /<ForecastAmountStrip[\s\S]*forecastIptvGrade/);
  assert.match(view, /기존 구조정책/);
  assert.match(view, /홈 구조정책/);
  assert.match(view, /policyTab === 'home'/);
  assert.match(view, /policyTab === 'base'/);
  assert.match(view, /function BenefitGuide/);
  assert.match(view, /다음 수혜 구간/);
  assert.match(view, /예상 증가/);
  assert.match(view, /<BenefitGuide \{\.\.\.homeGradeGuide\}/);
  assert.match(view, /<BenefitGuide \{\.\.\.selfGuide\}/);
  assert.match(view, /row\.main_tv_plan === 'broadcastPass'/);
  assert.match(view, /인터넷 100M 단독은 지표에는 포함하되 지급 인터넷에서는 제외/);
  assert.match(view, /\['subSetTop', 'tvFree'\]\.includes\(row\.product_type\)/);
  assert.match(policy, /calculateHqStructureProjection/);
  assert.match(policy, /runRate\.isCurrentMonth \? runRate\.factor : 1/);
});

test('무거운 관리자 도구는 선택할 때 분리 로딩한다', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(source, /React\.lazy\(\(\)=>import\('\.\/HqStructurePolicyView'\)\)/);
  assert.match(source, /React\.lazy\(\(\)=>import\('\.\/PendingApprovals'\)\)/);
  assert.match(source, /React\.lazy\(\(\)=>import\('\.\/ProfileEditRequests'\)\)/);
  assert.match(source, /React\.lazy\(\(\)=>import\('\.\/PasswordResetAdmin'\)\)/);
  assert.match(source, /React\.Suspense fallback=\{<DeferredAdminPanelFallback label="본사 구조정책"\/>\}/);
});

test('일일 브리핑은 이강진 전용이며 0건 확인과 매장별 전달을 제공한다', async () => {
  const [source, briefing] = await Promise.all([
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/dailyBriefing.js', import.meta.url), 'utf8'),
  ]);
  assert.match(source, /canViewDailyBriefing=\{canViewDailyBriefing\}/);
  assert.match(source, /adminTab === 'dailyBriefing' && canViewDailyBriefing/);
  assert.match(source, /카카오 전달/);
  assert.match(source, /0건 확인 ✓/);
  assert.match(source, /inputConfirmedAt/);
  assert.match(briefing, /a50a0979-acef-40b1-98b7-f05074f1c835/);
  assert.match(briefing, /DAILY_BRIEFING_SEND_TIME = '08:30'/);
});

test('일일 브리핑은 카카오 공유와 미입력 직원 푸시 알림을 제공한다', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const sw = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
  assert.match(source, /navigator\.share/);
  assert.match(source, /카카오로 전달/);
  assert.match(source, /daily_input_reminder/);
  assert.match(source, /실적 입력 알림 보내기/);
  assert.match(source, /playMisoNotificationSound/);
  assert.match(source, /\?open=daily/);
  assert.match(sw, /silent: false/);
});

test('특가 판매 미리보기는 선택한 날짜를 정책 계산에 전달한다', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(source, /const mobilePreview=\(\(\)=>\{[\s\S]*?const saleDate=`\$\{month\}-\$\{selectedDay\}`;[\s\S]*?calculateSeptemberSpecialSale\(\{policyKey:mobileSpecialPolicyId,planGroup:septemberPlanGroup\(mobileSaleDraft\.ci\),strategicPoints,saleDate\}\)/);
});

test('월말 예상에서 건당 지급 수량은 정수 반올림하고 포인트와 금액은 소수를 유지한다', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(source, /m\.unit==='count'\?Math\.round\(value\):value/);
  assert.match(source, /m\.unit==='count'\?Math\.round\(rawForecast\):rawForecast/);
  assert.match(source, /forecastCompany=Object\.fromEntries[\s\S]*Math\.round\(Number\(value\|\|0\)\*forecastFactor\)/);
  assert.match(source, /forecastPlan115Count=Math\.round/);
  assert.match(source, /key==='productivity'\|\|key==='tailoredAmount'\?value:Math\.round\(value\)/);
});

test('지원 판매는 선택 매장 팀 실적에만 반영하고 개인 계산에서 제외한다', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const schema = await readFile(new URL('../sql/team_sales_credits.sql', import.meta.url), 'utf8');
  assert.match(source, /\['김솔이','이강진','김진문'\]\.includes\(loginEmp\.name\)/);
  assert.match(source, /from\('team_sales_credits'\)\.insert\(\{seller_id:authUser\.id,credited_store:teamSupportStore/);
  assert.match(source, /if\(sale\.source_meta\?\.teamOnly\)return/);
  assert.match(source, /const personalSalesRows=salesRows\.filter\(\(r\)=>!r\.teamOnly\)/);
  assert.match(source, /source_type==='home'&&!credit\.is_completed/);
  assert.match(source, /storeName:activeTeamSupport\?teamSupportStore:null/);
  assert.match(source, /const resetTeamSupportSelection=\(\)=>\{setTeamSupportMode\(false\);setTeamSupportStore\(''\);\}/);
  assert.equal((source.match(/resetTeamSupportSelection\(\);/g)||[]).length, 2);
  assert.match(source, /onChange=\{event=>\{setTeamSupportMode\(event\.target\.checked\);setTeamSupportStore\(''\)\}\}/);
  assert.match(schema, /max\(h\.actual_install_date\)/);
  assert.match(schema, /source_sale_id uuid references public\.customer_sales\(id\) on delete cascade/);
});

test('신규 홈 입력은 판매유형 없이 상품별 세부항목을 바로 선택한다', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const modal = source.match(/\{homeOrderDraft && \([\s\S]*?\{homeExpenseOpen&&/)?.[0] || '';
  assert.doesNotMatch(modal, /판매 유형|HOME_SALE_TYPES|올인원/);
  assert.match(modal, /상품을 누른 뒤 바로 세부 선택/);
  assert.match(modal, /homeInternet&&!homeInternetSpeed/);
  assert.match(modal, /homeMainTv&&!homeMainTvPlan/);
  assert.match(modal, /homeSubTv&&!homeSubTvType/);
  assert.match(source, /sale_type:'normal'/);
  assert.match(source, /homeTv:'TV\(주\)'/);
});

test('같은 고객의 홈 상품은 선택 항목만 묶음 완료·취소한다', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const manager = source.match(/function HomeOrderManager[\s\S]*?function NotificationBell/)?.[0] || '';
  assert.match(manager, /여러 상품 완료/);
  assert.match(manager, /여러 상품 취소/);
  assert.match(manager, /homeBatchSelected\.includes\(String\(o\.id\)\)/);
  assert.match(manager, /선택하지 않은 상품은 진행중으로 남습니다/);
  assert.match(manager, /\.in\('id',selected\.map\(o=>o\.id\)\)\.eq\('user_id',userId\)\.eq\('status','pending'\)/);
  assert.match(manager, /countable\.forEach\(order=>/);
});

test('홈 판매는 저장 직후 묶음 취소와 작성 중 이탈 방지를 제공한다', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(source, /const undoHomeToast = async \(\) =>/);
  assert.match(source, /방금 등록한 홈 판매를 취소할까요/);
  assert.match(source, /deleteSale\(data,\{skipConfirm:true\}\)/);
  assert.match(source, /toast\.source==='home'\?undoHomeToast:undoToast/);
  assert.match(source, /const closeHomeOrder = async \(\) =>/);
  assert.match(source, /아직 등록하지 않은 작성 내용은 사라집니다/);
  assert.match(source, /onClick=\{closeHomeOrder\}/);
});
