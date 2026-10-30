import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeCompanyHomeRevenue as summarize} from '../src/companyHomeRevenue.js';
const month='2026-10';
function bundle(types,extra={}){
 const orders=types.map((product_type,i)=>({id:`o${i}`,user_id:'u',customer_id:'c',source_work_date:'2026-10-03',status:'completed',actual_install_date:'2026-10-05',product_type,...extra}));
 const sales=orders.map(o=>({id:`s${o.id}`,source_type:'home_order',source_ref:o.id,user_id:'u',customer_id:'c',sale_date:o.source_work_date,source_meta:{}}));return {orders,sales};
}
const run=b=>summarize(b.orders,b.sales,month);
test('owner confirmed MNP+500+TV+premium sub-TV is 583000, all additive',()=>{
 const b=bundle(['internet500','homeTv','simulMnp','tvFree']);const before=structuredClone(b);const r=run(b);
 assert.equal(r.total,583000);assert.equal(r.equipment,33000);assert.equal(r.premium,77000);assert.equal(r.subBonus,110000);assert.equal(r.simultaneous,330000);assert.deepEqual(b,before);
});
test('internet only simultaneous is 83000; 1G adds 99000; normal sub and new/change use separate rates',()=>{
 assert.equal(run(bundle(['internet500','homeOnly','simulNewChange'])).total,83000);
 assert.equal(run(bundle(['internet1g','homeTv','simulNewChange','subSetTop'])).total,352000);
 assert.equal(run(bundle(['tvFree'])).total,110000);
 assert.equal(run(bundle(['subSetTop'])).total,33000);
});
test('SIM61 topup is 165000, SIM85 topup is 110000, speed and sub-TV remain additive',()=>{
 for(const [tier,topup] of [[61,165000],[85,110000],[55,0]]){
  const b=bundle(['internet500','homeTv','simulUsedMnp','tvFree']);b.sales.push({id:'sim',source_type:'mobile',user_id:'u',customer_id:'c',sale_date:'2026-10-03',source_meta:{ri:5,planDetail:{key:`general_${tier}`,type:'general'}}});
  const r=run(b);assert.equal(r.simTopup,topup);assert.equal(r.total,253000+topup);assert.equal(r.simultaneous,0);
 }
});
test('SIM links by stored identity, never name; ambiguous, cancelled or missing original is pending',()=>{
 const b=bundle(['internet500','homeTv','simulUsedMnp']);assert.equal(run(b).simTopup,0);assert.equal(run(b).pending,1);
 const sim={id:'sim',source_type:'mobile',user_id:'u',customer_id:'c',sale_date:'2026-10-03',source_meta:{ri:5,planDetail:{key:'general_61',type:'general'}}};b.sales.push(sim,{...sim,id:'other'});assert.equal(run(b).simTopup,0);
 b.sales.pop();sim.customer_id='other';assert.equal(run(b).simTopup,0);sim.customer_id='c';sim.source_meta.cancelled=true;assert.equal(run(b).simTopup,0);
});
test('installation month, split completions, cancellation, dedup, delete and edit recalculate',()=>{
 const b=bundle(['internet500','homeTv','simulMnp','tvFree']);b.orders[1].actual_install_date='2026-11-01';
 assert.equal(run(b).total,143000);assert.equal(summarize(b.orders,b.sales,'2026-11').total,440000);
 b.orders[1].status='cancelled';assert.equal(run(b).simultaneous,0);assert.equal(run(b).subBonus,0);
 b.orders[1].status='completed';b.orders[1].actual_install_date='2026-10-05';
 assert.equal(summarize([...b.orders,...b.orders],b.sales,month).total,583000);
 b.sales=b.sales.filter(s=>s.source_ref!=='o3');assert.equal(run(b).total,363000);
 b.orders[0].product_type='internet1g';assert.equal(run(b).total,429000);
 assert.equal(summarize(b.orders,b.sales,'2026-09').total,0);
});
