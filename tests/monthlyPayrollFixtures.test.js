import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateActivitySupport, calculateMobileCommissionParts, calculateHomePolicyFromOrders,
  calculateFreePhoneSpecialOutcome, calculatePayrollSettlement,
} from '../src/policyEngine.js';

test('월간 원장 A: 6개월 미만 사원은 실적이 없어도 230만원으로 마감한다', () => {
  const tenurePay = calculateActivitySupport({ monthsEmployed: 4, activityCount: 0, rate: 0, cap: 2300000 });
  const pay = calculatePayrollSettlement({ minimumGuarantee: 2300000, tenurePay });
  assert.equal(pay.mobileGuaranteeBasis, 2300000);
  assert.equal(pay.guaranteeTopUp, 0);
  assert.equal(pay.currentPerformanceAmount, 2300000);
  assert.equal(pay.closingAmount, 2300000);
});

test('월간 원장 B: 8개월 사원 10건·요금제·VAS·2ND·홈·성과급은 총 350만원이다', () => {
  const tenurePay = calculateActivitySupport({ monthsEmployed: 8, activityCount: 10, rate: 200000, cap: 2300000 });
  const commission = calculateMobileCommissionParts({
    matrix: [[5]], matrixRates: [[50000]],
    vasCounts: { safe: 1 }, vasRates: [{ key: 'safe', rate: 50000 }],
    bundleCounts: { watch: 1 }, bundleRates: [{ key: 'watch', rate: 200000 }],
  });
  const home = calculateHomePolicyFromOrders([
    { id: 1, customer_id: 'home-a', source_work_date: '2026-08-10', status: 'completed', network_type: 'household', product_type: 'internet1g' },
    { id: 2, customer_id: 'home-a', source_work_date: '2026-08-10', status: 'completed', network_type: 'household', product_type: 'homeTv' },
    { id: 3, customer_id: 'home-a', source_work_date: '2026-08-10', status: 'completed', network_type: 'household', product_type: 'simulMnp' },
    { id: 4, customer_id: 'home-a', source_work_date: '2026-08-10', status: 'completed', network_type: 'household', product_type: 'smartHome' },
  ]);
  const pay = calculatePayrollSettlement({
    minimumGuarantee: 2300000,
    tenurePay,
    mobilePlanPay: commission.mobilePlanPay,
    bundle2ndPay: commission.bundle2ndPay,
    vasPay: commission.vasPay,
    extras: { gradeBonus: 300000, homePay: home.total },
  });
  assert.equal(tenurePay, 2000000);
  assert.equal(commission.mobileMatrixPay, 450000);
  assert.equal(commission.vasPay, 50000);
  assert.equal(home.total, 700000);
  assert.equal(pay.mobileGuaranteeBasis, 2500000);
  assert.equal(pay.guaranteeTopUp, 0);
  assert.equal(pay.postGuaranteeExtras, 1000000);
  assert.equal(pay.total, 3500000);
});

test('월간 원장 C: 15개월 매니저는 실적합계 부족분을 최저보장으로 채운 뒤 홈·성과급을 더한다', () => {
  const tenurePay = calculateActivitySupport({ monthsEmployed: 15, activityCount: 8, rate: 150000, cap: 2300000 });
  const commission = calculateMobileCommissionParts({ matrix: [[2]], matrixRates: [[50000]] });
  const home = calculateHomePolicyFromOrders([
    { id: 1, customer_id: 'home-b', source_work_date: '2026-08-11', status: 'completed', network_type: 'household', product_type: 'internet500' },
    { id: 2, customer_id: 'home-b', source_work_date: '2026-08-11', status: 'completed', network_type: 'household', product_type: 'homeTv' },
  ]);
  const pay = calculatePayrollSettlement({
    minimumGuarantee: 2500000,
    tenurePay,
    mobilePlanPay: commission.mobilePlanPay,
    positionAllowance: 200000,
    extras: { gradeBonus: 500000, homePay: home.total },
  });
  assert.equal(pay.mobileGuaranteeBasis, 1500000);
  assert.equal(pay.guaranteeTopUp, 1000000);
  assert.equal(pay.currentPerformanceAmount, 2270000);
  assert.equal(pay.closingAmount, 3270000);
});

test('월간 원장 D: 무료폰 특가는 건수·2ND·스팟을 유지하고 요금제·VAS·보험은 지급하지 않는다', () => {
  const freePhone = calculateFreePhoneSpecialOutcome({
    planIncentive: 50000, vasIncentive: 20000, insuranceIncentive: 10000,
    secondIncentive: 200000, approvedSpotIncentive: 30000, isFreePhoneSpecial: true,
  });
  const tenurePay = calculateActivitySupport({ monthsEmployed: 10, activityCount: 1, rate: 200000, cap: 2300000 });
  const pay = calculatePayrollSettlement({
    minimumGuarantee: 2300000,
    tenurePay,
    mobilePlanPay: freePhone.paid.plan,
    bundle2ndPay: freePhone.paid.second,
    vasPay: freePhone.paid.vas + freePhone.paid.insurance,
    approvedMobileSpotPay: freePhone.paid.spot,
  });
  assert.equal(freePhone.countsAsActivitySupport, true);
  assert.equal(freePhone.excluded.plan + freePhone.excluded.vas + freePhone.excluded.insurance, 80000);
  assert.equal(pay.currentPerformanceAmount, 430000);
  assert.equal(pay.guaranteeTopUp, 1870000);
  assert.equal(pay.total, 2300000);
});
