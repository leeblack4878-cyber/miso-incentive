import test from 'node:test';
import assert from 'node:assert/strict';
import {
  POLICY_HISTORY_CONFIG_KEY,
  isPolicyConfigReadOnly,
  isSeptemberPolicyActive,
  policyPeriodFor,
  resolvePolicyConfigForMonth,
} from '../src/policyCalendar.js';

test('월을 바꿔도 판매월에 유효한 정책 버전을 선택한다', () => {
  assert.equal(policyPeriodFor('2026-08').version, '2026-08-v1');
  assert.equal(policyPeriodFor('2026-09').version, '2026-09-v1');
  assert.equal(policyPeriodFor('2026-10').version, '2026-09-v1');
  assert.equal(isSeptemberPolicyActive('2027-01'), true);
});

test('과거 기본정책은 저장된 스냅샷을 우선하고 9월 이후에는 확정 변환을 적용한다', () => {
  const live = { marker: '현재값', matrix: [[999]], vas: [], bundle2nd: [] };
  const frozen = { marker: '8월고정', matrix: [[111]], vas: [], bundle2nd: [] };
  const history = { baseSnapshots: { '2026-08-v1': frozen } };

  const august = resolvePolicyConfigForMonth('2026-08', live, history);
  const october = resolvePolicyConfigForMonth('2026-10', live, history);

  assert.equal(POLICY_HISTORY_CONFIG_KEY, 'policy_history_v1');
  assert.equal(august.marker, '8월고정');
  assert.equal(august.matrix[0][0], 111);
  assert.equal(august.policyVersion, '2026-08-v1');
  assert.equal(october.marker, '8월고정');
  assert.equal(october.policyVersion, '2026-09-v1');
  assert.notEqual(october.matrix[0][0], 999);
});

test('지난달과 회사 확정 정책 기간은 화면에서 직접 덮어쓰지 않는다', () => {
  assert.equal(isPolicyConfigReadOnly('2026-08', '2026-09'), true);
  assert.equal(isPolicyConfigReadOnly('2026-09', '2026-09'), true);
  assert.equal(isPolicyConfigReadOnly('2026-10', '2026-09'), true);
});
