import {test} from 'node:test';
import assert from 'node:assert/strict';
import {comparisonPeriods,comparisonChange} from '../src/performancePeriod.js';
test('전월 비교는 한국 날짜의 같은 기간이며 짧은 달·연도 전환을 처리한다',()=>{
  const september=comparisonPeriods('2026-09',new Date('2026-09-16T16:00:00Z'));
  assert.equal(september.end,17);assert.equal(september.previousEnd,17);
  assert.equal(comparisonPeriods('2026-03',new Date('2026-03-31T03:00:00Z')).previousEnd,28);
  assert.equal(comparisonPeriods('2026-01',new Date('2026-01-01T03:00:00Z')).previous,'2025-12');
  assert.equal(comparisonPeriods('2024-03',new Date('2024-03-31T03:00:00Z')).previousEnd,29);
});
test('과거 월은 각각 전체 기간, 미래 월은 비교 불가',()=>{
  const past=comparisonPeriods('2026-08',new Date('2026-09-17T03:00:00Z'));
  assert.equal(past.end,31);assert.equal(past.previousEnd,31);
  assert.equal(comparisonPeriods('2026-10',new Date('2026-09-17T03:00:00Z')).future,true);
});
test('비교 자료 없음과 0건을 구분하고 0분모에 무한대 비율을 표시하지 않는다',()=>{
  assert.equal(comparisonChange(10,null),null);
  assert.equal(comparisonChange(undefined,10),null);
  assert.deepEqual(comparisonChange(10,0),{difference:10,percent:null});
  assert.deepEqual(comparisonChange(0,10),{difference:-10,percent:-100});
  assert.deepEqual(comparisonChange(10,8),{difference:2,percent:25});
});
