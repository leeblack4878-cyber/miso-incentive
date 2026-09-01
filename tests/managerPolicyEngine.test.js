import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSeptemberManagerIncentive, managerOperatorForStore, septemberManagerStoreType } from '../src/managerPolicyEngine.js';

test('9월 관리자 운영자를 직급이 아니라 지정된 이름으로 찾는다', () => {
  assert.equal(managerOperatorForStore('광정동_산본점').name, '최재혁');
  assert.equal(managerOperatorForStore('고잔동_법조타운점').name, null);
});

test('지정한 5개 매장은 위탁, 나머지 매장은 자가 2ND 기준을 사용한다', () => {
  ['신천동_삼미시장점','본오3동_상록수역점','본오3동_주민센터점','거모동_도일시장점','광정동_산본점']
    .forEach(store => assert.equal(septemberManagerStoreType(store), 'consignment', store));
  assert.equal(septemberManagerStoreType('신천동_삼미시장2호점'), 'owned');
  assert.equal(septemberManagerStoreType('월곶동_월곶점'), 'owned');
});

test('관리자 핵심성과는 달성 구간별 실제 건수 단가로 계산한다', () => {
  const result = calculateSeptemberManagerIncentive({
    actual: { hs: 100, home: 10, tvFree: 8, smartHome: 5 },
    targets: { hs: 100, home: 10, tvFree: 8, smartHome: 5 },
    strategicRatio: 180, homeRatio: 10,
  });
  assert.equal(result.metrics.find(x => x.key === 'hs').amount, 2000000);
  assert.equal(result.metrics.find(x => x.key === 'home').amount, 500000);
});

test('홈 12% 추가는 HS에만 적용하고 전략P 160% 미만이면 HS만 미지급한다', () => {
  const paid = calculateSeptemberManagerIncentive({actual:{hs:100,home:12,tvFree:5,smartHome:3},targets:{hs:100,home:10,tvFree:5,smartHome:3},strategicRatio:180});
  assert.equal(paid.metrics.find(x => x.key === 'hs').amount, 2400000);
  const withheld = calculateSeptemberManagerIncentive({actual:{hs:100,home:12,tvFree:5,smartHome:3},targets:{hs:100,home:10,tvFree:5,smartHome:3},strategicRatio:159});
  assert.equal(withheld.metrics.find(x => x.key === 'hs').amount, 0);
  assert.ok(withheld.metrics.find(x => x.key === 'home').amount > 0);
});

test('홈 비중 차감은 중복하지 않고 가장 큰 금액 하나만 적용한다', () => {
  const below6 = calculateSeptemberManagerIncentive({actual:{hs:100,home:5},targets:{hs:100,home:10},strategicRatio:180});
  assert.equal(below6.deductions.filter(x => x.key === 'homeRatio').length, 1);
  assert.equal(below6.deductions.find(x => x.key === 'homeRatio').amount, 600000);
});

test('임팩트 지급률은 월중 제외하고 마감시에만 최종 금액에 적용한다', () => {
  const input={actual:{hs:100,home:10},targets:{hs:100,home:10},strategicRatio:180,homeRatio:10,impactRate:.96};
  const live=calculateSeptemberManagerIncentive(input);
  const closed=calculateSeptemberManagerIncentive({...input,closing:true});
  assert.equal(live.finalRate,1);
  assert.equal(closed.finalAmount,Math.round(closed.beforeImpact*.96));
});
