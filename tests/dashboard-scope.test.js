import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveDashboardStore,performanceForecastFactor} from '../src/dashboardScope.js';

test('관리자 선택은 이미 허용된 매장 안에서만 적용한다',()=>{
  assert.equal(resolveDashboardStore('B',['A','B'],true,'A'),'B');
  assert.equal(resolveDashboardStore('C',['A','B'],true,'A'),'all');
  assert.equal(resolveDashboardStore('all',['A'],false,'A'),'A');
  assert.equal(resolveDashboardStore('B',['A'],false,'A'),'A');
  assert.equal(resolveDashboardStore('all',[],false,'A'),'');
});
test('예상 마감은 한국 날짜 경과일 기준이며 다른 월은 확대하지 않는다',()=>{
  assert.equal(performanceForecastFactor('2026-09',new Date('2026-09-15T03:00:00Z')),2);
  assert.equal(performanceForecastFactor('2026-09',new Date('2026-09-15T15:00:00Z')),30/16);
  assert.equal(performanceForecastFactor('2026-08',new Date('2026-09-15T03:00:00Z')),1);
  assert.equal(performanceForecastFactor('2026-10',new Date('2026-09-15T03:00:00Z')),1);
});
