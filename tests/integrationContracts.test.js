import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

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

test('오늘 휴무일이면 미입력으로 안내하지 않는다', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(source, /todayIsDayOff[\s\S]*label:'오늘 휴무'/);
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
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(source, /smartHomeSimulRate=.*key==='smartHomeSimul'/);
  assert.match(source, /b\.types\.has\('smartHome'\)&&b\.simul!=='none'&&smartHomeSimulRate/);
  assert.match(source, /homeAddonPay=simulPay\+smartHomeSimulPay\+subSetTopPay/);
  assert.match(source, /item:'스마트홈 동시판매'/);
});

test('판매 완료 카드에 성과P 전략P 생산성 증가분을 함께 표시한다', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(source, /strategicPointDelta:mobileStrategicPoint/);
  assert.match(source, /productivityDelta:Number\(afterPay\.kpiScore/);
  assert.match(source, /성과P \+\$\{fmtNum\(toast\.pointDelta,1\)\}P · 전략P \+\$\{fmtNum\(toast\.strategicPointDelta,1\)\}P · 생산성 \+\$\{fmtNum\(toast\.productivityDelta,1\)\}P/);
  assert.match(source, /vasVcolorBundle:1/);
  assert.match(source, /vasVcolorMusic:\.3/);
});

test('명예의 전당은 누적순위 바로 위에 있고 프로필 카드는 한줄 상태 없이 간결하다', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const sql = await readFile(new URL('../supabase_employee_public_profiles.sql', import.meta.url), 'utf8');
  assert.match(source, /function HallOfFame/);
  assert.match(source, /전체 직원 프로필 보기/);
  assert.match(source, /employee_public_profiles.*status_message/);
  assert.match(source, /오늘의 응원[\s\S]*dailyEncouragement/);
  const hub = source.match(/function GamificationHub[\s\S]*?function SpecialBadgeAwardPanel/)?.[0]||'';
  assert.doesNotMatch(hub, /동료에게 공개되는 나의 한줄 상태/);
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
