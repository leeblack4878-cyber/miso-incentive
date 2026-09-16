import test from 'node:test';
import assert from 'node:assert/strict';
import {isPolicyInputBlocked,policyInputPendingLabel} from '../src/policyCalendar.js';

test('기존 운영월을 유지하고 10월부터 새달은 정책 입력 전으로 잠근다',()=>{
 const state={loaded:true};
 assert.equal(isPolicyInputBlocked('2026-09',state),false);
 assert.equal(isPolicyInputBlocked('2026-08',state),false);
 assert.equal(isPolicyInputBlocked('2026-10',state),true);
 assert.equal(isPolicyInputBlocked('2027-01',state),true);
 assert.equal(policyInputPendingLabel('2026-10'),'10월 정책 입력 전');
});
test('정책 반영이 확인된 달만 열고 다음 달과 연도 경계는 잠근다',()=>{
 const state={loaded:true,readyMonths:['2026-10','2026-12']};
 assert.equal(isPolicyInputBlocked('2026-10',state),false);
 assert.equal(isPolicyInputBlocked('2026-11',state),true);
 assert.equal(isPolicyInputBlocked('2027-01',state),true);
});
test('관리자의 명시적 재잠금이 준비 완료 상태보다 우선한다',()=>{
 assert.equal(isPolicyInputBlocked('2026-10',{loaded:true,readyMonths:['2026-10'],blockedMonths:['2026-10']}),true);
 assert.equal(isPolicyInputBlocked('2026-09',{loaded:true,blockedMonths:['2026-09']}),true);
});
test('설정 조회 전·실패와 잘못된 월은 입력을 열지 않는다',()=>{
 assert.equal(isPolicyInputBlocked('2026-10'),true);
 assert.equal(isPolicyInputBlocked('2026-10',{loaded:false,readyMonths:['2026-10']}),true);
 assert.equal(isPolicyInputBlocked('2026-13',{loaded:true}),true);
});
