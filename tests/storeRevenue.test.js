import test from 'node:test';
import assert from 'node:assert/strict';
import {canViewStoreRevenue,summarizeStoreRevenue} from '../src/storeRevenue.js';
const month='2026-10',profiles=[{id:'a',store_name:'A'},{id:'b',store_name:'B'}];
const mobile=(id,user_id,extra={})=>({id,user_id,source_type:'mobile',sale_date:'2026-10-03',source_meta:{ri:1,ci:0,planDetail:{key:'general_115',type:'general'},...extra}});
test('only the two verified executive IDs may view store revenue; names and other managers cannot',()=>{
 assert.equal(canViewStoreRevenue('a50a0979-acef-40b1-98b7-f05074f1c835'),true);assert.equal(canViewStoreRevenue('f0329992-ced4-4407-b71d-ed58c5d74aaf'),true);
 for(const id of [null,'김진문','이강진','6ba6651a-8e5b-4e21-a00d-1d2e0ff492bb','employee'])assert.equal(canViewStoreRevenue(id),false);
});
test('store income follows support credit, keeps empty stores, excludes cancel and preserves sources',()=>{
 const sales=[mobile('1','a'),mobile('2','a',{teamOnly:true,creditedStore:'B'}),{...mobile('3','b'),status:'cancelled'},mobile('4','inactive')];const before=structuredClone(sales);
 const r=summarizeStoreRevenue({sales,profiles,stores:['A','B','C'],month});
 assert.equal(r.rows.find(x=>x.store==='A').mobile,176000);assert.equal(r.rows.find(x=>x.store==='B').mobile,176000);assert.equal(r.rows.find(x=>x.store==='C').total,0);assert.equal(r.rows.find(x=>x.store==='매장 미확인').mobile,176000);assert.deepEqual(sales,before);
 assert.equal(r.total,r.rows.reduce((n,row)=>n+row.total,0)+r.commonTotal);
});
test('monthly IPTV grade uses company-wide threshold and contribution per store, never a separate small-store tier',()=>{
 const orders=Array.from({length:20},(_,i)=>({id:`o${i}`,user_id:i<10?'a':'b',customer_id:`c${i}`,status:'completed',product_type:'homeTv',network_type:'household',main_tv_plan:'broadcastPass',actual_install_date:'2026-10-05'}));
 const r=summarizeStoreRevenue({orders,profiles,stores:['A','B'],month});
 assert.equal(r.policy.iptvGrade.pointRate,11000);assert.equal(r.rows.find(x=>x.store==='A').awards.iptvGrade,110000);assert.equal(r.rows.find(x=>x.store==='B').awards.iptvGrade,110000);
 assert.equal(r.rows.reduce((n,row)=>n+row.awards.iptvGrade,0),r.policy.iptvGrade.totalAmount);
});
test('home basic income and existing monthly policies are additive and reconcile with company awards',()=>{
 const orders=Array.from({length:20},(_,i)=>({id:`o${i}`,user_id:i<10?'a':'b',customer_id:`c${i}`,source_work_date:'2026-10-03',status:'completed',product_type:'internet1g',network_type:'household',actual_install_date:'2026-10-05'}));
 const sales=orders.map(o=>({id:`s${o.id}`,user_id:o.user_id,customer_id:o.customer_id,source_type:'home_order',source_ref:o.id,sale_date:'2026-10-03',source_meta:{}}));sales.push(mobile('hs','a'));
 const r=summarizeStoreRevenue({sales,orders,profiles,stores:['A','B'],month});assert.equal(r.rows.find(x=>x.store==='A').home,990000);assert.ok(r.rows[0].monthly>0);
 const awards=['award','salesMetric','homeGrade','homeInternetRatio','homeAward','iptvGrade'].reduce((n,k)=>n+r.policy[k].totalAmount,0);assert.equal(r.rows.reduce((n,row)=>n+row.monthly,0)+r.common.monthlyReconciliation,awards);
});
test('category subtotals reconcile: child-line base belongs to 2ND, household/Soho fees appear once',()=>{
 const s=mobile('hs','a',{vasKeys:['vasKyobo'],bundle2ndKeys:['b_L335'],specialPolicy:{policyId:'oct_s942_256_512_mnp'}});
 const r=summarizeStoreRevenue({sales:[s],profiles,stores:['A'],month});const row=r.rows[0];
 assert.equal(row.mobileBreakdown.base,22000);assert.equal(row.mobileBreakdown.plan,154000);assert.equal(row.mobileBreakdown.second,308000);assert.equal(row.mobileBreakdown.vas,19800);
 assert.equal(Object.values(row.mobileBreakdown).reduce((a,b)=>a+b,0),row.mobile);
 assert.equal(Object.values(row.homeBreakdown).reduce((a,b)=>a+b,0),row.home);
 assert.equal(row.mobile+row.home+row.monthly,row.total);
});
test('home categories keep internet, TV and combined-sale fees separate without double counting',()=>{
 const orders=['internet500','homeTv','simulMnp','tvFree'].map((product_type,i)=>({id:`o${i}`,user_id:'a',customer_id:'c',source_work_date:'2026-10-03',status:'completed',actual_install_date:'2026-10-05',network_type:'household',product_type}));
 const sales=orders.map(o=>({id:`s${o.id}`,source_type:'home_order',source_ref:o.id,user_id:'a',customer_id:'c',sale_date:'2026-10-03',source_meta:{}}));
 const row=summarizeStoreRevenue({sales,orders,profiles,stores:['A'],month}).rows.find(r=>r.store==='A');
 assert.equal(row.homeBreakdown.internet,33000);assert.equal(row.homeBreakdown.tv,220000);assert.equal(row.homeBreakdown.combined,330000);assert.equal(row.home,583000);
});
test('store 2ND count includes standalone and follow-up bundle once and ignores previous-month parent',()=>{
 const sales=[mobile('main','a',{bundle2ndKeys:['watch','tablet']}),mobile('solo','a',{ri:7,bundle2ndKeys:[]}),mobile('later','a',{ri:7,secondOnlyBundle:true,bundle2ndKeys:['watch'],secondParent:{date:'2026-09-10'}}),{...mobile('prior','a',{bundle2ndKeys:['watch']}),sale_date:'2026-09-10'}];
 const r=summarizeStoreRevenue({sales,profiles,stores:['A'],month});assert.equal(r.rows.find(x=>x.store==='A').second,4);
});
