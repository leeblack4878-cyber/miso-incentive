import test from 'node:test';
import assert from 'node:assert/strict';
import { SELF_STORE_BASELINE_TOTAL, calculateSelfStoreOperatingSupport, calculateRetailPartnerMonthlyPolicy, calculateSalesMetricActivation, calculateRetailMonthlyAward } from '../src/hqStructurePolicy.js';

test('자가매장 기준 수량 합계는 668건이다', () => assert.equal(SELF_STORE_BASELINE_TOTAL, 668));

test('초과 150건까지는 건당 5만원이다', () => {
  assert.equal(calculateSelfStoreOperatingSupport({ hs: 668 }).totalAmount, 0);
  assert.equal(calculateSelfStoreOperatingSupport({ hs: 669 }).totalAmount, 50000);
  assert.equal(calculateSelfStoreOperatingSupport({ hs: 818 }).totalAmount, 7500000);
});

test('151번째 초과 건부터만 건당 6만원이다', () => {
  const result = calculateSelfStoreOperatingSupport({ hs: 819 });
  assert.equal(result.tier1Count, 150);
  assert.equal(result.tier2Count, 1);
  assert.equal(result.totalAmount, 7560000);
});

test('상품별 인정 가중치를 합산한다', () => {
  const result = calculateSelfStoreOperatingSupport({ hs: 600, second: 100, internet: 40, smartHome: 20, extraSetTop: 10 });
  assert.equal(result.recognized, 669);
  assert.equal(result.totalAmount, 50000);
});

test('소매파트너 금액은 포인트 구간별 누진 단가를 적용한다', () => {
  const result = calculateRetailPartnerMonthlyPolicy({ mnp: 175 }); // 350P
  assert.equal(result.points, 350);
  assert.equal(result.baseAmount, 300 * 14300 + 50 * 16500);
});

test('2,000P 이상도 최고 구간 단가를 계속 적용한다', () => {
  const at2000 = calculateRetailPartnerMonthlyPolicy({ mnp: 1000 });
  const at2001 = calculateRetailPartnerMonthlyPolicy({ mnp: 1000, second: 1 });
  assert.equal(at2001.baseAmount - at2000.baseAmount, 36300);
});

test('115군 비중 지급률은 SIM MNP를 모수와 자수에서 제외한 HS 기준이다', () => {
  const result = calculateRetailPartnerMonthlyPolicy({ hs: 10, plan115Hs: 6, mnp: 100, simMnp: 100 });
  assert.equal(result.plan115Ratio, 60);
  assert.equal(result.paymentRate, 1.3);
});

test('매출지표 활성화는 달성 구간 단가를 총 P에 적용한다', () => {
  const result = calculateSalesMetricActivation({ hs: 100, salesMetricPoints: 135 });
  assert.equal(result.achievement, 135);
  assert.equal(result.pointRate, 8800);
  assert.equal(result.totalAmount, 135 * 8800);
});

test('매출지표 80% 미만은 미지급하고 200% 초과도 최고 단가를 유지한다', () => {
  assert.equal(calculateSalesMetricActivation({ hs: 100, salesMetricPoints: 79 }).totalAmount, 0);
  assert.equal(calculateSalesMetricActivation({ hs: 100, salesMetricPoints: 250 }).pointRate, 17600);
});

test('소매 월간 시상은 다섯 지표의 최고 달성점수를 합산한다', () => {
  const result=calculateRetailMonthlyAward({hs:100,new010:30,simMnp:12,salesMetricPoints:180,changeSupportRatio:55,internet:12});
  assert.equal(result.totalScore,28);
  assert.deepEqual(result.rates,{mnp:55000,new010:49500,change:16500});
});

test('소매 월간 시상 16점은 실제 MNP 신규 기변 건수별 단가를 적용한다', () => {
  const result=calculateRetailMonthlyAward({hs:100,mnp:50,new010:20,change:30,simMnp:8,salesMetricPoints:140,changeSupportRatio:35,internet:8});
  assert.equal(result.totalScore,16);
  assert.equal(result.totalAmount,50*55000+20*49500+30*16500);
});
