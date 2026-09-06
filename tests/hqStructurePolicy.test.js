import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SELF_STORE_BASELINE_TOTAL,
  calculateSelfStoreOperatingSupport,
  calculateRetailPartnerMonthlyPolicy,
  calculateSalesMetricActivation,
  calculateRetailMonthlyAward,
  calculateMonthlyRunRate,
  calculateHqStructureProjection,
  calculateHomeGradePolicy,
  calculateHomeInternetRatioPolicy,
  calculateHomeAwardPolicy,
  calculateIptvGradePolicy,
} from '../src/hqStructurePolicy.js';

test('IPTV Grade는 가정망 주셋탑 1P와 부셋탑 0.5P의 합산 구간을 적용한다', () => {
  const result = calculateIptvGradePolicy({ mainTv: 20, extraSetTop: 20 });
  assert.equal(result.points, 30);
  assert.equal(result.pointRate, 16500);
  assert.equal(result.totalAmount, 495000);
});

test('IPTV Grade는 20P 미만 미지급이며 최고 구간 이후에도 7만7천원을 유지한다', () => {
  assert.equal(calculateIptvGradePolicy({ mainTv: 19, extraSetTop: 1 }).totalAmount, 0);
  assert.equal(calculateIptvGradePolicy({ mainTv: 600 }).pointRate, 77000);
});

test('홈 시상은 사운드바를 제외한 다섯 지표 점수를 합산해 인터넷 건당 지급한다', () => {
  const result = calculateHomeAwardPolicy({
    hs: 10, internet: 10, payableInternet: 9, mainTv: 10,
    iptv17Plus: 7, extraSetTop: 8, tvFree: 4, internet1g: 5, smartHome: 3,
  });
  assert.deepEqual(result.scores, { iptv17Plus: 3, extraSetTop: 4, tvFree: 2, internet1g: 3, smartHome: 3, soundbar: 0 });
  assert.equal(result.setTopScore, 4);
  assert.equal(result.setTopScoreSource, 'extraSetTop');
  assert.equal(result.totalScore, 13);
  assert.equal(result.pointRate, 132000);
  assert.equal(result.totalAmount, 1188000);
  assert.equal(result.internetShare, 712800);
  assert.equal(result.iptvShare, 475200);
});

test('홈 시상 고득점 지표는 최소 실적 조건을 충족해야 한다', () => {
  const result = calculateHomeAwardPolicy({ hs: 2, internet: 2, mainTv: 2, iptv17Plus: 2, extraSetTop: 2, tvFree: 2, internet1g: 2, smartHome: 2 });
  assert.equal(result.scores.extraSetTop, 5);
  assert.equal(result.scores.tvFree, 3);
  assert.equal(result.scores.internet1g, 1);
  assert.equal(result.scores.smartHome, 1);
  assert.equal(result.scores.soundbar, 0);
  assert.equal(result.totalScore, result.scores.iptv17Plus + Math.max(result.scores.extraSetTop, result.scores.tvFree) + result.scores.internet1g + result.scores.smartHome);
});

test('HS 대비 인터넷 비중 정책은 HS·인터넷 교차단가에 TV 지급률을 적용한다', () => {
  const result = calculateHomeInternetRatioPolicy({ hs: 200, internet: 20, mainTv: 16, extraSetTop: 4 });
  assert.equal(result.internetRatio, 10);
  assert.equal(result.pointRate, 56000);
  assert.equal(result.tvRatio, 9);
  assert.equal(result.paymentRate, 0.8);
  assert.equal(result.totalAmount, 896000);
});

test('인터넷 비중 7% 미만은 지급하지 않고 HS 구간 경계를 구분한다', () => {
  assert.equal(calculateHomeInternetRatioPolicy({ hs: 199, internet: 14, mainTv: 30 }).pointRate, 0);
  assert.equal(calculateHomeInternetRatioPolicy({ hs: 200, internet: 14, mainTv: 30 }).pointRate, 3000);
  assert.equal(calculateHomeInternetRatioPolicy({ hs: 300, internet: 21, mainTv: 45 }).pointRate, 7000);
});

test('홈 Grade는 인터넷·재약정 교차단가에 TV 비중 지급률을 적용한다',()=>{
  const result=calculateHomeGradePolicy({hs:100,internet:10,renewalRecognized:10,mainTv:8,extraSetTop:4});
  assert.equal(result.pointRate,33000);
  assert.equal(result.tvRatio,10);
  assert.equal(result.paymentRate,.9);
  assert.equal(result.totalAmount,297000);
});

test('동일 요금제 재약정 0.3건은 합산 후 반올림해 Grade 구간을 정한다',()=>{
  const below=calculateHomeGradePolicy({hs:100,internet:10,renewalRecognized:4.4,mainTv:11});
  const reached=calculateHomeGradePolicy({hs:100,internet:10,renewalRecognized:4.5,mainTv:11});
  assert.equal(below.roundedRenewal,4);
  assert.equal(below.pointRate,22000);
  assert.equal(reached.roundedRenewal,5);
  assert.equal(reached.pointRate,27500);
});

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

test('현재 월의 월말 예상 배수는 경과일 대비 전체 일수로 계산한다', () => {
  const runRate=calculateMonthlyRunRate('2026-09',new Date(2026,8,5,12));
  assert.equal(runRate.isCurrentMonth,true);
  assert.equal(runRate.elapsedDays,5);
  assert.equal(runRate.totalDays,30);
  assert.equal(runRate.factor,6);
});

test('지난 월은 마감값을 유지하고 다시 예상 환산하지 않는다', () => {
  const runRate=calculateMonthlyRunRate('2026-08',new Date(2026,8,5,12));
  assert.equal(runRate.isPastMonth,true);
  assert.equal(runRate.factor,1);
});

test('본사 구조정책 월말 예상은 실적을 환산한 뒤 구간과 금액을 다시 계산한다', () => {
  const projection=calculateHqStructureProjection({
    month:'2026-09',
    asOf:new Date(2026,8,5,12),
    selfStoreInput:{hs:120},
    retailInput:{hs:120,plan115Hs:72,mnp:30,new010:10},
    salesMetricInput:{hs:100,salesMetricPoints:120},
    awardInput:{hs:100,mnp:20,new010:15,change:10,simMnp:10,internet:10,salesMetricPoints:140,changeSupportRatio:35},
  });
  assert.equal(projection.forecast.selfStore.recognized,720);
  assert.equal(projection.forecast.selfStore.totalAmount,52*50000);
  assert.equal(projection.forecast.retail.points,480);
  assert.equal(projection.forecast.retail.paymentRate,1.3);
  assert.equal(projection.forecast.salesMetric.achievement,120);
  assert.equal(projection.forecast.salesMetric.totalAmount,720*8800);
  assert.equal(projection.forecast.award.totalAmount,projection.current.award.totalAmount*6);
  assert.equal(
    projection.forecastTotalAmount,
    projection.forecast.selfStore.totalAmount
      + projection.forecast.retail.totalAmount
      + projection.forecast.salesMetric.totalAmount
      + projection.forecast.award.totalAmount,
  );
});
