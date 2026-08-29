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

test('과거 판매 수정은 이전 source_meta를 보존 병합한다', async () => {
  const source = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(source, /mergeSaleMetaPreservingLegacy\(editingSale\.source_meta/);
  assert.match(source, /legacySchemaVersion:\s*saleSchemaVersion\(editingSale\)/);
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
