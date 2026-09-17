import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateVerifiedBadges} from '../supabase/functions/sync-badges/calculator.js';
function source(hs=0,otherHs=100){
 const row=(id,n)=>({user_id:id,work_date:'2026-09-16',data:{matrix:[[n]]}});
 return {config:[],profiles:[{id:'me',position:'사원',hire_date:'2026-09-01',store_name:'A'},{id:'other',position:'사원',hire_date:'2026-09-01',store_name:'B'}],monthly:[],daily:[row('me',hs),row('other',otherHs)],history:[row('me',hs)],home_orders:[],home_links:[],goals:{}};
}
test('zero personal performance never inherits another employee sales badges',()=>{
 assert.deepEqual(calculateVerifiedBadges(source(),'me','2026-09').filter(k=>!k.startsWith('tenure')),[]);
});
test('server thresholds and full company ranking use each employee own records',()=>{
 const at19=calculateVerifiedBadges(source(19),'me','2026-09');
 assert.ok(at19.includes('first_step'));assert.ok(!at19.includes('hs_m20'));assert.ok(!at19.includes('hs_rank1'));assert.ok(at19.includes('hs_rank2'));
 const at100=calculateVerifiedBadges(source(100,101),'me','2026-09');assert.ok(at100.includes('hs_m100'));assert.ok(!at100.includes('hs_rank1'));
});
test('tenure badges legitimately require no sales',()=>{
 const s=source();s.profiles[0].hire_date='2026-08-01';
 assert.deepEqual(calculateVerifiedBadges(s,'me','2026-09'),['tenure1']);
});
test('legacy cancelled home totals cannot grant first home or lifetime badges',()=>{
 const s=source();s.daily[0].data={groups:{homeBase:{homeOnly:1}}};s.history=[s.daily[0]];
 s.home_orders=[{id:1,user_id:'me',source_work_date:'2026-09-16',status:'cancelled',product_type:'homeOnly'}];
 assert.ok(!calculateVerifiedBadges(s,'me','2026-09').includes('home_first'));
});
