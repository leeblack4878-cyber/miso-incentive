import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SECOND_PERFORMANCE_POINT, allowedSecondVas, secondPerformancePoints,
  summarizeVasQuality, homeOrdersForMonth, homeBundleCount,
  replaceCountedSale, mergeSaleMetaPreservingLegacy,
} from '../src/policyRules.js';

test('2ND 단독과 번들은 모두 건당 0.2P다', () => {
  assert.equal(SECOND_PERFORMANCE_POINT, 0.2);
  assert.equal(secondPerformancePoints({ secondOnlyCount: 1 }), 0.2);
  assert.equal(secondPerformancePoints({ bundleCounts: { watch: 1 } }), 0.2);
  assert.equal(secondPerformancePoints({ secondOnlyCount: 1, bundleCounts: [1, 1] }), 0.6);
});

test('2ND VAS에는 폰교체패스와 폰안심패스만 노출한다', () => {
  const result = allowedSecondVas([
    { key: 'vasKyobo' }, { key: 'vasVcolor' }, { key: 'vasPhonePass' }, { key: 'vasSafePass' },
  ]).map(item => item.key);
  assert.deepEqual(result, ['vasPhonePass', 'vasSafePass']);
});

test('폰안심패스는 보험류 전략P 0.8P이며 인센티브 정책과 독립적이다', () => {
  const q = summarizeVasQuality([{ source_meta: { vasKeys: ['vasSafePass'] } }]);
  assert.equal(q.insurance, 1);
  assert.equal(q.insurancePoints, 0.8);
});

test('취소 홈은 제외하고 설치대기와 완료를 구분한다', () => {
  const rows = [
    { id: 1, source_work_date: '2026-08-01', status: 'cancelled' },
    { id: 2, source_work_date: '2026-08-02', status: 'pending' },
    { id: 3, source_work_date: '2026-08-03', status: 'completed' },
  ];
  assert.deepEqual(homeOrdersForMonth(rows, '2026-08').map(x => x.id), [2, 3]);
  assert.deepEqual(homeOrdersForMonth(rows, '2026-08', 'pending').map(x => x.id), [2]);
  assert.deepEqual(homeOrdersForMonth(rows, '2026-08', 'completed').map(x => x.id), [3]);
});

test('같은 고객의 홈 세부행은 핵심 판매 1건으로 센다', () => {
  const rows = [
    { id: 1, source_work_date: '2026-08-03', customer_id: 'a' },
    { id: 2, source_work_date: '2026-08-03', customer_id: 'a' },
  ];
  assert.equal(homeBundleCount(rows), 1);
});

test('판매 수정은 기존 1건을 빼고 새 1건을 더해 중복되지 않는다', () => {
  assert.equal(replaceCountedSale(5, true, true), 5);
});

test('과거 source_meta 필드는 수정 후에도 유지한다', () => {
  const merged = mergeSaleMetaPreservingLegacy({ legacyCode: 'old', ri: 1 }, { ri: 2, vasKeys: ['vasSafePass'] });
  assert.deepEqual(merged, { legacyCode: 'old', ri: 2, vasKeys: ['vasSafePass'] });
});
