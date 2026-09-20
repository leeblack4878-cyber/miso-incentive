import test from 'node:test';
import assert from 'node:assert/strict';
import {activeRoster,hasMonthHistory,readAllPages} from '../src/performanceRoster.js';
import {scopedEmployeesFor} from '../src/permissionScopes.js';
test('deactivation preserves historical totals while excluding staff from active roster and empty months',()=>{
 const staff=[{id:'a',active:true,branch:'산본점'},{id:'b',active:false,branch:'산본점'},{id:'c',active:false,branch:'다른점'}];
 const dailyRecords={a:{'01':{count:5}},b:{'01':{count:3}}};
 const included=staff.filter(e=>hasMonthHistory(e,{dailyRecords}));
 assert.equal(included.reduce((s,e)=>s+dailyRecords[e.id]['01'].count,0),8);
 assert.deepEqual(activeRoster(staff).map(e=>e.id),['a']);
 assert.deepEqual(staff.filter(e=>hasMonthHistory(e)).map(e=>e.id),['a']);
 assert.deepEqual(scopedEmployeesFor({viewer:{id:'a',branch:'산본점'},authUserId:'a',isStoreLeader:true,employees:included,areaStores:{}}).map(e=>e.id),['a','b']);
});
test('monthly legacy, home installations, ledger and spot records retain inactive contributors',()=>{
 const e={id:'x',active:false};
 for(const state of [{monthRecords:{x:{updatedAt:'2026-09-01'}}},{homePolicyMap:{x:{source:'orders'}}},{shadowLedgerMap:{x:{totalSales:1}}},{approvedMobileSpotMap:{x:50000}}]) assert.equal(hasMonthHistory(e,state),true);
 assert.equal(hasMonthHistory(e,{monthRecords:{x:{status:'none',draft:{}}}}),false);
});
test('daily record pagination includes rows beyond the API cap and refuses partial totals on error',async()=>{
 const all=Array.from({length:1003},(_,i)=>i);
 assert.deepEqual((await readAllPages(()=>({range:async(a,b)=>({data:all.slice(a,b+1)})}))).data,all);
 const error={message:'offline'};
 assert.deepEqual(await readAllPages(()=>({range:async(a,b)=>a?{error}:{data:all.slice(a,b+1)}})),{data:null,error});
});
