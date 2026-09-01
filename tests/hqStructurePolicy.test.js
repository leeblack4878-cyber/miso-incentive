import test from 'node:test';
import assert from 'node:assert/strict';
import { SELF_STORE_BASELINE_TOTAL, calculateSelfStoreOperatingSupport } from '../src/hqStructurePolicy.js';

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
