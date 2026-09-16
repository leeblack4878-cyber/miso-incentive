import test from 'node:test';
import assert from 'node:assert/strict';
import {payDisplay} from '../src/payDisplay.js';
test('예상 마감과 내역은 일반·홈 승인 스팟과 비용을 같은 기준으로 반영한다',()=>{
 const p={currentPerformanceAmount:800000,closingAmount:1000000,total:1000000,approvedMobileSpotPay:20000};
 assert.deepEqual(payDisplay(p,30000,10000),{current:820000,closing:1020000,total:1020000});
 assert.equal(payDisplay(p,0,0).closing,1000000); // mobile spot already included, no second addition
 assert.equal(payDisplay(p,0,1100000).total,-100000); // match existing ledger, do not hide deductions
});
