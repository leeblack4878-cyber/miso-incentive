import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSecondPolicy, calculateActivitySupport, calculateFreePhoneSpecialOutcome,
  summarizeHomeStatuses, summarizeVasQuality,
} from '../src/policyEngine.js';

test('2ND 정책 조합표: 단독과 번들은 모두 실적·활동지원·성과P에 동일 반영된다', () => {
  const cases = [
    { name: '단독 1건', input: { secondOnlyCount: 1 }, count: 1, points: 0.2 },
    { name: '번들 1건', input: { bundleCounts: { watch: 1 } }, count: 1, points: 0.2 },
    { name: '단독 1 + 번들 2', input: { secondOnlyCount: 1, bundleCounts: { watch: 1, tablet: 1 } }, count: 3, points: 0.6 },
  ];
  cases.forEach(({ name, input, count, points }) => {
    const result = calculateSecondPolicy(input);
    assert.equal(result.totalCount, count, name);
    assert.equal(result.activityCount, count, name);
    assert.equal(result.performancePoints, points, name);
  });
});

test('영업활동 지원금은 근속구간별 단가와 230만원 상한을 적용한다', () => {
  assert.equal(calculateActivitySupport({ monthsEmployed: 5, activityCount: 0, rate: 0 }), 2300000);
  assert.equal(calculateActivitySupport({ monthsEmployed: 8, activityCount: 5, rate: 200000 }), 1000000);
  assert.equal(calculateActivitySupport({ monthsEmployed: 15, activityCount: 20, rate: 150000 }), 2300000);
  assert.equal(calculateActivitySupport({ monthsEmployed: 30, activityCount: 10, rate: 100000 }), 1000000);
});

test('무료폰 특가는 요금제·VAS·보험만 제외하고 2ND·스팟과 건수는 유지한다', () => {
  const result = calculateFreePhoneSpecialOutcome({
    planIncentive: 50000, vasIncentive: 20000, insuranceIncentive: 10000,
    secondIncentive: 200000, approvedSpotIncentive: 30000, isFreePhoneSpecial: true,
  });
  assert.deepEqual(result.paid, { plan: 0, vas: 0, insurance: 0, second: 200000, spot: 30000 });
  assert.equal(result.total, 230000);
  assert.equal(result.countsAsPerformance, true);
  assert.equal(result.countsAsActivitySupport, true);
});

test('일반 판매는 요금제·VAS·보험·2ND·스팟을 모두 유지한다', () => {
  const result = calculateFreePhoneSpecialOutcome({
    planIncentive: 50000, vasIncentive: 20000, insuranceIncentive: 10000,
    secondIncentive: 200000, approvedSpotIncentive: 30000,
  });
  assert.equal(result.total, 310000);
  assert.deepEqual(result.excluded, { plan: 0, vas: 0, insurance: 0 });
});

test('홈은 취소를 제외하고 같은 고객의 세부 상품을 완료·대기 각 1건으로 묶는다', () => {
  const rows = [
    { id: 1, source_work_date: '2026-08-01', customer_id: 'a', status: 'completed', product_type: 'internet1g' },
    { id: 2, source_work_date: '2026-08-01', customer_id: 'a', status: 'completed', product_type: 'homeTv' },
    { id: 3, source_work_date: '2026-08-02', customer_id: 'b', status: 'pending', product_type: 'smartHome' },
    { id: 4, source_work_date: '2026-08-03', customer_id: 'c', status: 'cancelled', product_type: 'internet500' },
  ];
  const result = summarizeHomeStatuses(rows, '2026-08');
  assert.equal(result.completedCount, 1);
  assert.equal(result.pendingCount, 1);
  assert.equal(result.totalCount, 2);
  assert.equal(result.rows.some(row => row.status === 'cancelled'), false);
});

test('폰안심패스와 폰교체패스는 각각 보험 전략P 0.8P로 계산한다', () => {
  const result = summarizeVasQuality([{ source_meta: { vasKeys: ['vasSafePass', 'vasPhonePass', 'vasKyobo'] } }]);
  assert.equal(result.insurance, 2);
  assert.equal(result.insurancePoints, 1.6);
  assert.equal(result.strategicVas, 1);
});
