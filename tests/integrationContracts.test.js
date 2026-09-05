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
  assert.match(source, /duplicateCount:g\.rows\.length-unique\.length/);
  assert.match(source, /중복 저장 의심/);
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
  assert.match(source, /성과P \+\$\{fmtNum\(toast\.pointDelta,1\)\}P · 전략P \+\$\{fmtNum\(toast\.strategicPointDelta,1\)\}P · 생산성 \+\$\{fmtNum\(toast\.productivityDelta,1\)\}P/);
  assert.match(strategicSource, /vasVcolorBundle: 1/);
  assert.match(strategicSource, /vasVcolorMusic: 0\.3/);
});

test('명예의 전당 위치와 프로필·실적 통합 카드를 간결하게 유지한다', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const sql = await readFile(new URL('../supabase_employee_public_profiles.sql', import.meta.url), 'utf8');
  assert.match(source, /function HallOfFame/);
  assert.match(sourc