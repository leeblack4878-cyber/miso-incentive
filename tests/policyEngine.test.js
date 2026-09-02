import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSecondPolicy, calculateActivitySupport, calculateFreePhoneSpecialOutcome,
  summarizeHomeStatuses, summarizeVasQuality, calculateMobileCommissionParts,
  calculateHomePolicyFromOrders,
  homeMainTvPlanAdjustment,
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

test('TV(주) 요금제에 따라 가정망·소호망 그레이드 수수료를 차감한다', () => {
  assert.equal(homeMainTvPlanAdjustment('household', 'broadcastPass'), 0);
  assert.equal(homeMainTvPlanAdjustment('household', 'premium'), 100000);
  assert.equal(homeMainTvPlanAdjustment('household', 'belowPremium'), 200000);
  assert.equal(homeMainTvPlanAdjustment('soho', 'premium'), 0);
  assert.equal(homeMainTvPlanAdjustment('soho', 'belowPremium'), 200000);
  const base = { customer_id: 'plan-test', source_work_date: '2026-09-02', status: 'completed', network_type: 'household' };
  const result = calculateHomePolicyFromOrders([
    { ...base, id: 1, product_type: 'internet1g' },
    { ...base, id: 2, product_type: 'homeTv', main_tv_plan: 'premium' },
  ]);
  assert.equal(result.gradePay, 150000);
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

test('요금제·VAS·보험·2ND 제외액과 홈 미판매 50% 규칙을 숫자로 계산한다', () => {
  const result = calculateMobileCommissionParts({
    matrix: [[2, 1]], matrixRates: [[50000, 30000]], specialMatrixOffset: 50000,
    vasCounts: { insurance: 1, strategic: 2 },
    vasRates: [{ key: 'insurance', rate: 10000 }, { key: 'strategic', rate: 20000 }],
    specialVasOffset: 10000, bundleFreeVasOffset: 5000,
    bundleCounts: { watch: 1 }, bundleRates: [{ key: 'watch', rate: 200000 }],
    bundleFreeOffset: 50000, penaltyFactor: 0.5,
  });
  assert.equal(result.matrixTotal, 130000);
  assert.equal(result.adjustedMatrixTotal, 80000);
  assert.equal(result.rawVasPay, 50000);
  assert.equal(result.vasPay, 35000);
  assert.equal(result.rawBundle2ndTotal, 200000);
  assert.equal(result.bundle2ndTotal, 150000);
  assert.equal(result.mobilePlanPay, 40000);
  assert.equal(result.bundle2ndPay, 75000);
  assert.equal(result.mobileMatrixPay, 115000);
});

test('가정망 1GB+TV·MNP·스마트홈 동시판매 수수료는 고객 묶음당 70만원이다', () => {
  const base = { customer_id: 'home-a', customer_name: '홈고객', source_work_date: '2026-08-10', status: 'completed', network_type: 'household' };
  const result = calculateHomePolicyFromOrders([
    { ...base, id: 1, product_type: 'internet1g' },
    { ...base, id: 2, product_type: 'homeTv' },
    { ...base, id: 3, product_type: 'simulMnp' },
    { ...base, id: 4, product_type: 'smartHome' },
  ]);
  assert.equal(result.totalInternetCount, 1);
  assert.equal(result.gradePay, 250000);
  assert.equal(result.simulPay, 300000);
  assert.equal(result.smartHomePay, 100000);
  assert.equal(result.smartHomeSimulPay, 50000);
  assert.equal(result.total, 700000);
});

test('가정망 500MB+TV 1건은 1건 구간 27만원이고 취소 건은 제외한다', () => {
  const result = calculateHomePolicyFromOrders([
    { id: 1, customer_id: 'a', source_work_date: '2026-08-10', status: 'completed', network_type: 'household', product_type: 'internet500' },
    { id: 2, customer_id: 'a', source_work_date: '2026-08-10', status: 'completed', network_type: 'household', product_type: 'homeTv' },
    { id: 3, customer_id: 'b', source_work_date: '2026-08-11', status: 'cancelled', network_type: 'soho', product_type: 'internet1g' },
  ]);
  assert.equal(result.totalInternetCount, 1);
  assert.equal(result.gradePay, 270000);
  assert.equal(result.total, 270000);
});

test('올인원 홈은 성과 묶음에는 남지만 수수료는 0원이다', () => {
  const base = { customer_id: 'allinone', source_work_date: '2026-08-12', status: 'completed', sale_type: 'allinone', network_type: 'soho' };
  const result = calculateHomePolicyFromOrders([
    { ...base, id: 1, product_type: 'internet1g' },
    { ...base, id: 2, product_type: 'homeTv' },
    { ...base, id: 3, product_type: 'smartHome' },
  ]);
  assert.equal(result.totalInternetCount, 1);
  assert.equal(result.total, 0);
});
