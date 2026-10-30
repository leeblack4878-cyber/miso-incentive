import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeStorePayroll,loadStorePayrollAdjustments} from '../src/storePayroll.js';
test('store salaries reuse settlement pay, add only non-mobile spots and deduct recorded expense once',()=>{
 const rows=[{id:'a',name:'가',branch:'A',pay:{total:3000000,approvedMobileSpotPay:50000}},{id:'b',name:'나',branch:'A',pay:{total:2500000},active:false},{id:'c',name:'다',branch:'B',pay:{total:2000000}},{id:'support',branch:'A',teamOnly:true,pay:{total:1000000}},{id:'other',branch:'A',position:'기타',pay:{total:1000000}}];const before=structuredClone(rows);
 const r=summarizeStorePayroll([...rows,rows[0]],{spots:{a:100000},expenses:{a:30000,b:20000}});
 assert.equal(r.A.total,5550000);assert.equal(r.A.employees.length,2);assert.equal(r.A.employees[0].amount,3070000);assert.equal(r.B.total,2000000);assert.deepEqual(rows,before);
});
test('missing payroll source never becomes a confirmed zero salary',()=>{const r=summarizeStorePayroll([{id:'a',branch:'A'}]);assert.equal(r.A.pending,1);assert.equal(r.A.employees.length,0);});
test('failed payroll ledger lookup rejects instead of returning unadjusted salary',async()=>{
 const client={from(){return {select(){return this;},in(){return this;},eq(){return this;},is(){return this;},gte(){return this;},lt(){return this;},order(){return this;},async range(){return {error:new Error('denied')}}}}};
 await assert.rejects(loadStorePayrollAdjustments(client,'2026-10',['a']),/denied/);assert.deepEqual(await loadStorePayrollAdjustments(client,'2026-10',[]),{spots:{},expenses:{}});
});
