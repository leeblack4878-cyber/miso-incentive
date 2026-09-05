import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SEPTEMBER_MATRIX, SEPTEMBER_BUNDLE_2ND, SEPTEMBER_SPECIAL_SALES, SEPTEMBER_TV_PLAN,
  SEPTEMBER_SOHO_TV_PLAN, septemberMainTvPlan,
  calculateSeptemberSpecialSale, calculateSeptemberBundleSale, calculateSeptemberSono, calculateSeptemberTailoredTier,
} from '../src/septemberPolicy.js';

test('9월 모바일 요금제 수수료 조합을 고정한다', () => {
  assert.equal(SEPTEMBER_TV_PLAN, '방송패스');
  assert.equal(SEPTEMBER_SOHO_TV_PLAN, '프리미엄');
  assert.equal(septemberMainTvPlan('household'), '방송패스');
  assert.equal(septemberMainTvPlan('soho'), '프리미엄');
  assert.deepEqual(SEPTEMBER_MATRIX[0], [50000, 40000, 20000, 0, 20000, 0]);
  assert.deepEqual(SEPTEMBER_MATRIX[1], [90000, 70000, 50000, 40000, 40000, 0]);
  assert.deepEqual(SEPTEMBER_MATRIX[4], [25000, 20000, 10000, 0, 10000, 0]);
  assert.deepEqual(SEPTEMBER_MATRIX[5], [80000, 70000, 50000, 40000, 40000, 0]);
});

test('9월 2ND 번들 단가와 L705 제외를 고정한다', () => {
  const rates = Object.fromEntries(SEPTEMBER_BUNDLE_2ND.map(x => [x.key, x.rate]));
  assert.equal(rates.b_X216, 150000);
  assert.equal(rates.b_L355, 100000);
  assert.equal(rates.b_AppleWatch, 150000);
  assert.equal(rates.b_L705, undefined);
});

test('특가&지인정책은 요금제와 전략P를 모두 충족해야 추가 지급한다', () => {
  assert.equal(calculateSeptemberSpecialSale({ policyKey: 's937_mnp', planGroup: '115', strategicPoints: 2 }).additionalAmount, 100000);
  assert.equal(calculateSeptemberSpecialSale({ policyKey: 's937_mnp', planGroup: '85', strategicPoints: 2 }).additionalAmount, 0);
  assert.equal(calculateSeptemberSpecialSale({ policyKey: 's937_mnp', planGroup: '115', strategicPoints: 1.9 }).additionalAmount, 0);
  assert.equal(calculateSeptemberSpecialSale({ policyKey: 'a175_m2_new', planGroup: 'junior', strategicPoints: 1.8 }).additionalAmount, 50000);
  assert.equal(calculateSeptemberSpecialSale({ policyKey: 'a176_mnp', planGroup: '33plus', strategicPoints: 2 }).eligible, true);
  assert.equal(SEPTEMBER_SPECIAL_SALES.filter(x => x.key === 'f976_change').length, 1);
  const s26Plus = SEPTEMBER_SPECIAL_SALES.filter(x => x.model === 'S26+ 256/512');
  assert.deepEqual(s26Plus.map(x => x.saleType), ['MNP', '기기변경']);
  assert.ok(s26Plus.every(x => x.additionalAmount === 50000 && x.planRule === 'high' && x.requiredStrategicPoints === 2));
  assert.ok(s26Plus.every(x => x.startDate === '2026-09-05'));
  assert.equal(calculateSeptemberSpecialSale({ policyKey: 's26_plus_256_512_mnp', planGroup: '115', strategicPoints: 2, saleDate: '2026-09-04' }).eligible, false);
  assert.equal(calculateSeptemberSpecialSale({ policyKey: 's26_plus_256_512_mnp', planGroup: '115', strategicPoints: 2, saleDate: '2026-09-05' }).additionalAmount, 50000);
});

test('소노 5건 달성 시 첫 건부터 달성 단가를 적용한다', () => {
  assert.equal(calculateSeptemberSono(4, 80000, 100000), 320000);
  assert.equal(calculateSeptemberSono(5, 80000, 100000), 500000);
});

test('2ND 할인판매·보험 미가입·애플워치 115군 조건을 계산한다', () => {
  assert.equal(calculateSeptemberBundleSale({ rate: 150000, saleType: 'discount' }).paid, 20000);
  assert.equal(calculateSeptemberBundleSale({ rate: 150000, insuranceJoined: false }).paid, 0);
  assert.equal(calculateSeptemberBundleSale({ rate: 150000, isAppleWatch: true, parent115: false }).paid, 0);
  assert.equal(calculateSeptemberBundleSale({ rate: 150000, isAppleWatch: true, parent115: true }).paid, 150000);
  assert.equal(calculateSeptemberBundleSale({ rate: 150000, insuranceJoined: false }).performancePoints, 0.2);
});

test('맞춤제안은 월 전체 건수 구간의 건당 금액을 전체 건에 적용한다', () => {
  assert.equal(calculateSeptemberTailoredTier(15).amount, 75000);
  assert.equal(calculateSeptemberTailoredTier(25).amount, 175000);
  assert.equal(calculateSeptemberTailoredTier(30).amount, 300000);
});
