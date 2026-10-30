import test from 'node:test';
import assert from 'node:assert/strict';
import {structureProjectionFromRecords as project,companySalesMetricPoints} from '../src/companyStructureProjection.js';
import {summarizeStoreRevenue} from '../src/storeRevenue.js';
import {summarizeCompanyRevenue} from '../src/companyRevenue.js';
const month='2026-10';
const order=(id,type,date='2026-10-10',extra={})=>({id,user_id:'a',customer_id:'c',source_work_date:'2026-10-03',actual_install_date:date,status:'completed',network_type:'household',product_type:type,...extra});
const sale=(id,user_id='a',extra={})=>({id,user_id,sale_date:'2026-10-03',source_type:'mobile',source_meta:{ri:1,ci:0,planDetail:{key:'general_115',type:'general'},...extra}});
test('internet physical orders count once across different TV installation dates and months',()=>{
 const orders=[order('i','internet500','2026-10-10'),order('t','homeTv','2026-10-09')];
 assert.equal(project({orders,month}).current.homeGrade.internet,1);
 orders[1].actual_install_date='2026-11-01';assert.equal(project({orders,month}).current.homeGrade.internet,1);assert.equal(project({orders,month:'2026-11'}).current.homeGrade.internet,0);
});
test('separate internet records for one customer are not merged; repeated result IDs and cancelled records are excluded',()=>{
 const orders=[order('i','internet1g'),order('j','internet1g'),order('j','internet1g'),order('cancel','internet1g','2026-10-10',{status:'cancelled'}),order('prior','internet1g','2026-09-10')];
 assert.equal(project({orders,month}).current.homeGrade.internet,2);
 const sales=[sale('x'),sale('x'),sale('cancel','a',{cancelled:true})];assert.equal(project({sales,month}).current.retail.hs,1);assert.equal(summarizeCompanyRevenue(sales,month).count,1);
});
test('legacy Sono overlap is employee-and-date specific, never company-wide max',()=>{
 const sales=[sale('x','a',{vasKeys:['vasDaemyung']})];
 const daily=[{user_id:'b',work_date:'2026-10-03',data:{groups:{sono:{one:1}}}},{user_id:'a',work_date:'2026-10-03',data:{groups:{sono:{one:1}}}}];
 assert.equal(companySalesMetricPoints(sales,daily),4);
 daily.push({user_id:'a',work_date:'2026-10-04',data:{groups:{sono:{one:1}}}});assert.equal(companySalesMetricPoints(sales,daily),6);
});
test('supported sale does not earn legacy Sono again in the employee home store; sums reconcile',()=>{
 const sales=[sale('x','a',{vasKeys:['vasDaemyung'],teamOnly:true,creditedStore:'B'})],daily=[{user_id:'a',work_date:'2026-10-03',data:{groups:{sono:{one:1}}}}];
 const r=summarizeStoreRevenue({sales,daily,month,profiles:[{id:'a',store_name:'A'}],stores:['A','B']});
 assert.equal(r.rows.find(x=>x.store==='A').awards.salesMetric,0);assert.equal(r.rows.reduce((n,x)=>n+x.awards.salesMetric,0),r.policy.salesMetric.totalAmount);assert.equal(r.common.monthlyReconciliation,0);
});
test('deleted, cancelled and speed-down renewals do not raise company renewal grade',()=>{
 const daily=[{user_id:'a',work_date:'2026-10-03',data:{householdRenewals:[{speedUp:true},{speedUp:true,downSpeed:true},{speedUp:true,deleted:true},{speedUp:true,status:'cancelled'}]}}];
 assert.equal(project({daily,month}).current.homeGrade.renewalRecognized,1);
});
