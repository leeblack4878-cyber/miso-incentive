import test from 'node:test';
import assert from 'node:assert/strict';
import {OB_RESULTS,obSummary,latestObCustomers,subscriptionKey,validateObDraft,koreaDate,obTel} from '../src/obActivity.js';
test('only completed calls connect, all five results are activity; empty has no division error',()=>{
 const rows=OB_RESULTS.map(call_result=>({call_result,reaction:'관심 있음'}));
 assert.deepEqual(obSummary(rows),{activity:5,connected:1,rate:20,interested:1,visits:0});
 assert.equal(obSummary([]).rate,0);
});
test('subscription grouping is independent of name and phone, latest followup replaces old reminder',()=>{
 const rows=[{id:'1',subscription_number:'a 1',customer_name:'동명',phone:'01000000000',contacted_at:'2026-10-08',follow_up_date:'2026-10-10'},
 {id:'2',subscription_number:'A1',contacted_at:'2026-10-10',follow_up_date:null},
 {id:'3',subscription_number:'A2',customer_name:'동명',phone:'01000000000',contacted_at:'2026-10-10'}];
 const latest=latestObCustomers(rows);assert.equal(latest.length,2);assert.equal(latest.find(r=>subscriptionKey(r.subscription_number)==='A1').follow_up_date,null);
});
test('all customer fields and completion reaction are required; telephone URI is digits only; date uses Korea',()=>{
 const d={customer_name:'고객',subscription_number:'U001',phone:'010-1234-5678',purpose:'선약 안내',call_result:'통화 완료',reaction:'관심 있음'};
 assert.equal(validateObDraft(d),null);for(const key of ['customer_name','subscription_number','phone','reaction'])assert.ok(validateObDraft({...d,[key]:''}));
 assert.equal(validateObDraft({...d,call_result:'부재',reaction:''}),null);
 assert.equal(obTel('010-1234-5678'),'tel:01012345678');assert.equal(obTel('javascript:alert(1)'),null);
 assert.equal(koreaDate(new Date('2026-10-10T16:00:00Z')),'2026-10-11');
});
