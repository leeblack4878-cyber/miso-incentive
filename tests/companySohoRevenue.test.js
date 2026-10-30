import test from 'node:test';
import assert from 'node:assert/strict';
import {companySohoGradeRate,companySohoInternetCount} from '../src/companySohoRevenue.js';
import {summarizeCompanyHomeRevenue} from '../src/companyHomeRevenue.js';
import {summarizeStoreRevenue} from '../src/storeRevenue.js';
function bundle(speed='internet500',tv=true,kind='simulMnp'){
 const orders=[speed,...tv?['homeTv']:[],...kind?[kind]:[]].map((product_type,i)=>({id:`o${i}`,user_id:'u',customer_id:'c',source_work_date:'2026-10-03',status:'completed',actual_install_date:'2026-10-05',product_type,network_type:'soho'}));
 const sales=orders.map(o=>({id:`s${o.id}`,source_type:'home_order',source_ref:o.id,user_id:'u',customer_id:'c',sale_date:'2026-10-03',source_meta:{networkType:'soho'}}));return {orders,sales};
}
const run=b=>summarizeCompanyHomeRevenue(b.orders,b.sales,'2026-10');
test('owner confirmed Soho totals are additive and independent of employee rates',()=>{
 assert.equal(run(bundle()).total,616000);assert.equal(run(bundle('internet1g')).total,704000);assert.equal(run(bundle('internet500',false)).total,275000);
 assert.equal(run(bundle('internet500',false,'simulNewChange')).total,209000);assert.equal(run(bundle('internet500',true,'simulNewChange')).total,451000);
 assert.equal(run(bundle('internet100',false,null)).total,33000);assert.equal(run(bundle('internet1g',false,null)).total,66000);
 assert.equal(run(bundle('internet500',true,null)).total,341000);
});
test('Soho grade tiers apply to every installed internet, TV does not increase grade count',()=>{
 for(const [count,rate] of [[0,0],[2,0],[3,88000],[4,88000],[5,110000],[9,110000],[10,132000],[14,132000],[15,143000],[19,143000],[20,154000],[25,154000]])assert.equal(companySohoGradeRate(count),rate);
 const b=bundle();assert.equal(companySohoInternetCount([...b.orders,...b.orders],'2026-10'),1);
 b.orders[0].status='cancelled';assert.equal(companySohoInternetCount(b.orders,'2026-10'),0);
});
test('company Soho grade is shared by actual store installation contributions and excluded from household awards',()=>{
 const orders=Array.from({length:5},(_,i)=>({...bundle().orders[0],id:`i${i}`,customer_id:`c${i}`,user_id:i<3?'a':'b'}));
 const sales=orders.map(o=>({id:`s${o.id}`,source_type:'home_order',source_ref:o.id,customer_id:o.customer_id,user_id:o.user_id,sale_date:'2026-10-03',source_meta:{}}));
 const before=structuredClone({orders,sales});const r=summarizeStoreRevenue({orders,sales,month:'2026-10',profiles:[{id:'a',store_name:'A'},{id:'b',store_name:'B'}]});
 assert.equal(r.rows.find(x=>x.store==='A').awards.sohoGrade,330000);assert.equal(r.rows.find(x=>x.store==='B').awards.sohoGrade,220000);assert.equal(r.policy.homeGrade.internet,0);assert.equal(r.common.monthlyReconciliation,0);assert.deepEqual({orders,sales},before);
});
test('Soho split installation only awards package after TV completion and excludes cancellation',()=>{
 const b=bundle();b.orders[1].actual_install_date='2026-11-01';assert.equal(run(b).total,55000);assert.equal(summarizeCompanyHomeRevenue(b.orders,b.sales,'2026-11').total,561000);
 b.orders[1].status='cancelled';assert.equal(run(b).total,55000);assert.equal(summarizeCompanyHomeRevenue(b.orders,b.sales,'2026-11').total,0);
});
