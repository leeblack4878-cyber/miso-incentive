import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeStoreRevenue as calc} from '../src/storeRevenue.js';
import {companySalesMetricPoints} from '../src/companyStructureProjection.js';
import {summarizeStorePayroll} from '../src/storePayroll.js';
const month='2026-10',profiles=[{id:'a',store_name:'A'},{id:'b',store_name:'B'}];
const mobile=(id,extra={})=>({id,user_id:'a',source_type:'mobile',sale_date:'2026-10-03',source_meta:{ri:1,ci:0,planDetail:{key:'general_115',type:'general'},vasKeys:['vasDaemyung'],...extra}});
const day=(date,count=1)=>({user_id:'a',work_date:date,data:{groups:{sono:{one:count}}}});
const run=extra=>calc({month,profiles,stores:['A','B'],...extra});
const row=(r,store='A')=>r.rows.find(r=>r.store===store);
test('audit: repeated mobile ID cannot double store monthly metric or create a negative common adjustment',()=>{
 const s=mobile('x'),single=run({sales:[s]}),duplicate=run({sales:[s,structuredClone(s)]});
 assert.equal(row(single).awards.salesMetric,35200);
 assert.deepEqual(duplicate,single);
});
test('audit: duplicate overlap source does not suppress a second legacy Sono, including support-credit store',()=>{
 const s=mobile('x',{teamOnly:true,creditedStore:'B'}),daily=[day('2026-10-03',2)];
 const single=run({sales:[s],daily}),duplicate=run({sales:[s,structuredClone(s)],daily:[...daily,...daily]});
 assert.equal(row(single).awards.salesMetric,35200);assert.equal(row(single,'B').awards.salesMetric,35200);
 assert.deepEqual(duplicate,single);assert.equal(single.common.monthlyReconciliation,0);
 assert.equal(companySalesMetricPoints([s,s],daily,[s,s]),4);
});
test('audit: prior/future daily Sono cannot enter this month store award or residual',()=>{
 const sales=[mobile('x')],baseline=run({sales});
 assert.deepEqual(run({sales,daily:[day('2026-09-03'),day('2026-11-03')]}),baseline);
});
function homes(types,{prefix='h',user_id='a',network_type='household',credit,install='2026-10-10'}={}){
 const orders=types.map((product_type,i)=>({id:`${prefix}${i}`,user_id,customer_id:prefix,source_work_date:'2026-10-03',actual_install_date:install,status:'completed',network_type,product_type}));
 const sales=orders.map(o=>({id:`s${o.id}`,source_type:'home_order',source_ref:o.id,user_id,customer_id:prefix,sale_date:'2026-10-03',source_meta:credit?{teamOnly:true,creditedStore:credit}:{}}));
 return {orders,sales};
}
test('audit: support home bundle and separate TV installation month count fees/internet exactly once',()=>{
 const h=homes(['internet500','homeTv','simulMnp','tvFree'],{credit:'B'});
 h.orders[1].actual_install_date='2026-11-01';
 const oct=run(h),nov=run({...h,month:'2026-11'});
 assert.equal(row(oct).home,0);assert.equal(row(oct,'B').home,143000);assert.equal(row(oct,'B').internet,1);
 assert.equal(row(nov,'B').home,440000);assert.equal(row(nov,'B').internet,0);
 assert.deepEqual(run({orders:[...h.orders,...h.orders],sales:[...h.sales,...h.sales]}),oct);
 h.orders[1].status='cancelled';assert.equal(row(run({...h,month:'2026-11'}),'B').home,0);
});
test('audit: company operating support is nonzero and added once; all store categories and Soho grade reconcile',()=>{
 const household=homes(['internet500','homeTv','simulMnp','tvFree']);
 const soho=Array.from({length:5},(_,i)=>homes(['internet500','homeTv','simulMnp'],{prefix:`soho${i}`,user_id:i<3?'a':'b',network_type:'soho'}));
 const sales=[...Array.from({length:800},(_,i)=>({...mobile(`m${i}`,{vasKeys:[],bundle2ndKeys:i===0?['b_L335']:[]}),user_id:i%2?'a':'b'})),...household.sales,...soho.flatMap(h=>h.sales)];
 sales.push({...mobile('cancelled'),status:'cancelled'},mobile('deleted',{deleted:true}));
 const input={sales,orders:[...household.orders,...soho.flatMap(h=>h.orders)],daily:[{...day('2026-10-03',0),data:{householdRenewals:[{id:'r',plan:'premiumSafe',speed:'500',homeOnly:false,speedUp:true,tvUpsell:true},{id:'down',plan:'premiumSafe',speed:'500',downSpeed:true}]}}]};
 const before=structuredClone(input),r=run(input);
 assert.equal(row(r).home,583000+165000+616000*3);assert.equal(row(r,'B').home,616000*2);
 assert.equal(row(r).awards.sohoGrade,330000);assert.equal(row(r,'B').awards.sohoGrade,220000);
 assert.equal(row(r).internet,1);assert.equal(r.rows.reduce((n,x)=>n+x.second,0),1);
 assert.ok(r.common.selfStore>0);assert.ok(r.common.retail>0);assert.equal(r.common.monthlyReconciliation,0);
 for(const x of r.rows){assert.equal(Object.values(x.mobileBreakdown).reduce((a,b)=>a+b,0),x.mobile);assert.equal(Object.values(x.homeBreakdown).reduce((a,b)=>a+b,0),x.home);assert.equal(x.mobile+x.home+Object.values(x.awards).reduce((a,b)=>a+b,0),x.total);}
 assert.equal(r.commonTotal,r.policy.selfStore.totalAmount+r.policy.retail.totalAmount);
 assert.equal(r.total,r.rows.reduce((n,x)=>n+x.total,0)+r.commonTotal);
 const payroll=summarizeStorePayroll([{id:'a',branch:'A',pay:{total:3000000,approvedMobileSpotPay:50000}},{id:'b',branch:'B',active:false,pay:{total:2500000}},{id:'support',branch:'B',teamOnly:true,pay:{total:999999}}],{spots:{a:100000},expenses:{a:30000}});
 assert.equal(payroll.A.total,3070000);assert.equal(payroll.B.total,2500000);
 assert.deepEqual(run(input),r);assert.deepEqual(input,before);
});
