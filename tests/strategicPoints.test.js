import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSaleStrategicPoints, summarizeStrategicProducts, calculateEmployeeStrategicAdjustment } from '../src/strategicPoints.js';

test('본회선과 각 2ND 회선의 보험 전략P를 각각 반영한다', () => {
  assert.equal(calculateSaleStrategicPoints({strategicPlan:true,vasKeys:['vasStrategicPlan','vasPhonePass'],bundleVasMap:{a:['vasPhonePass','vasDualNumber'],b:['vasPhonePass']}}),3.3);
});

test('같은 회선 안에서 동일 상품이 중복 저장된 경우만 한 번 반영한다', () => {
  assert.equal(calculateSaleStrategicPoints({vasKeys:['vasSafePass','vasSafePass'],bundleVasMap:{a:['vasPhonePass','vasPhonePass']}}),1.6);
});

test('월 전략P 집계는 정책표의 모든 상품 점수를 사용한다', () => {
  const result=summarizeStrategicProducts([{source_meta:{vasKeys:['vasKyobo','vasVcolorBundle','vasSafePass','vasVcolorMusic','vasBellMoya','vasDualNumber','vasDesignatedNumber','vasDaemyung'],strategicPlan:true}}]);
  assert.equal(result.strategicPoints,6.5);
  assert.equal(result.strategicPointsWithoutDaemyung,4.5);
  assert.equal(result.daemyungCount,1);
});

test('일반 직원 전략P 200% 이상은 HS당 1만원 지급한다', () => {
  assert.deepEqual(calculateEmployeeStrategicAdjustment({hsCount:10,simMnpCount:2,strategicPoints:20}),{ratio:200,amount:100000,band:'bonus'});
});

test('일반 직원 전략P 160% 미만은 HS와 SIM MNP당 1만원 차감한다', () => {
  assert.deepEqual(calculateEmployeeStrategicAdjustment({hsCount:10,simMnpCount:2,strategicPoints:15.9}),{ratio:159,amount:-120000,band:'demerit'});
  assert.equal(calculateEmployeeStrategicAdjustment({hsCount:10,simMnpCount:2,strategicPoints:18}).amount,0);
});
