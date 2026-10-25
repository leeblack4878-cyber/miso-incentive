import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {OCTOBER23_MODEL_SALES,OCTOBER23_WEEKEND_SALES,october23SimBonus} from '../src/october23Policy.js';
import {calculateMonthlySpecialSale,specialSalesForDate,octoberConfig} from '../src/octoberPolicy.js';
import {calculateHomePolicyFromOrders,calculateMobileSale} from '../src/policyEngine.js';
import {summarizeStrategicProducts} from '../src/strategicPoints.js';
import {changeStrategicMetric,estimateMobileSale} from '../src/mobileSaleEstimate.js';
const bundled=await build({stdin:{contents:"export {normalizeDay,applyDailyToDraft,computePay,currentPolicySnapshot} from './src/appShared.jsx';export {defaultConfig} from './src/policyDefaults.js';export {emptyDraft} from './src/viewShared.js';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'db-stub',setup(b){b.onResolve({filter:/\/supabase$/},()=>({path:'db',namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:'export const supabase={};'}));}}]});
const mod={exports:{}};new Function('require','module','exports',bundled.outputFiles[0].text)(createRequire(import.meta.url),mod,mod.exports);const api=mod.exports,config=octoberConfig(api.defaultConfig());

const plan=key=>({key,type:key.split('_')[0]});
test('23rd model rates, historical boundary, C clamps and Buddy any plan1.8',()=>{
 assert.deepEqual(OCTOBER23_MODEL_SALES.map(p=>p.additionalAmount),[200000,100000,200000,100000,200000,100000,200000,100000,300000,200000,200000,100000,50000,0,200000,100000,300000,200000,200000,100000,50000,30000]);
 for(const p of OCTOBER23_MODEL_SALES){const a={policyKey:p.key,saleDate:'2026-10-23',saleType:p.saleType,ri:1,planDetail:plan('general_115'),vasKeys:['vasKyobo','vasSafePass'],strategicPoints:2};
  assert.equal(calculateMonthlySpecialSale(a).additionalAmount,p.additionalAmount);
  assert.equal(calculateMonthlySpecialSale({...a,saleDate:'2026-10-22'}).eligible,false);
  if(p.saleType==='기기변경')assert.equal(calculateMonthlySpecialSale({...a,ri:4}).additionalAmount,Math.max(0,p.additionalAmount-50000));
  assert.equal(calculateMonthlySpecialSale({...a,planDetail:plan('general_28'),strategicPoints:1.8}).eligible,p.model==='A176');
 }
 assert.equal(specialSalesForDate('2026-10-22').find(p=>p.model==='F971-256'&&p.saleType==='기기변경').additionalAmount,150000);
 assert.equal(specialSalesForDate('2026-10-23').filter(p=>p.model==='F971-256'&&p.saleType==='기기변경').length,1);
});
test('weekend customer supports never become employee extras; Buddy only unpaid',()=>{
 assert.deepEqual(OCTOBER23_WEEKEND_SALES.map(p=>p.customerDiscount),[0,0,400000,300000,400000,300000,400000,300000,350000,250000,350000,250000,450000,350000,450000,350000,300000,200000,300000,200000,250000,150000]);
 for(const p of OCTOBER23_WEEKEND_SALES){const a={policyKey:p.key,saleDate:'2026-10-23',saleType:p.saleType,ri:1,planDetail:plan('general_115'),vasKeys:['vasKyobo','vasSafePass'],strategicPoints:2};
  const r=calculateMonthlySpecialSale(a);assert(r.eligible);assert.equal(r.additionalAmount,0);assert.equal(p.policyType==='incentive_unpaid',p.deviceModel==='A176');
  assert.equal(calculateMonthlySpecialSale({...a,saleDate:'2026-10-27'}).eligible,false);
  assert.equal(calculateMonthlySpecialSale({...a,planDetail:plan('senior_47')}).eligible,p.deviceModel==='A176');
  assert.equal(calculateMonthlySpecialSale({...a,planDetail:plan('junior_85')}).eligible,true);
  const sp={policyType:p.policyType,replacementAmount:0,customerDiscount:p.customerDiscount,normalMatrixFee:p.deviceModel==='A176'?90000:0,normalVasFee:p.deviceModel==='A176'?20000:0};
  const ledger=calculateMobileSale({source_meta:{ri:1,ci:0,vasKeys:['vasKyobo'],specialPolicy:sp,policySnapshot:api.currentPolicySnapshot(config)}});
  assert.equal(ledger.paid.spot,0);assert.equal(ledger.paid.plan,p.deviceModel==='A176'?0:90000);
 }
 const c=OCTOBER23_WEEKEND_SALES.find(p=>p.deviceModel==='S741'&&p.saleType==='기기변경');assert.equal(calculateMonthlySpecialSale({policyKey:c.key,saleDate:'2026-10-26',saleType:'기기변경',ri:4,planDetail:plan('general_115'),strategicPoints:2}).customerDiscount,250000);
});
const sim=(day='23',extra={})=>({sale_date:`2026-10-${day}`,source_type:'mobile',source_meta:{ri:5,ci:5,planDetail:plan('general_55'),simMnpPolicyEligible:true,...extra}});
test('individual SIM1/2/3 grades reprice all; explicit policy flag, dates, deletion and payroll/preview match',()=>{
 for(const [n,rate] of [[0,0],[1,30000],[2,40000],[3,50000],[4,50000]])assert.equal(october23SimBonus(n).amount,n*rate);
 const sales=[sim(),sim('24'),sim('26'),sim('22'),sim('27'),sim('24',{teamOnly:true}),sim('24',{simMnpPolicyEligible:false}),sim('24',{simMnpPolicyEligible:undefined})];
 const metric=summarizeStrategicProducts(sales);assert.equal(metric.october23SimCount,3);assert.equal(metric.october23SimMissing,1);
 const pay=api.computePay(api.emptyDraft(),'기타',null,'2026-10',config,0,metric);const without=api.computePay(api.emptyDraft(),'기타',null,'2026-10',config,0,{...metric,october23SimCount:0});assert.equal(pay.total-without.total,150000);
 const reduced=changeStrategicMetric(metric,{...sim().source_meta,saleDate:'2026-10-23'},-1,'2026-10');assert.equal(reduced.october23SimCount,2);assert.equal(api.computePay(api.emptyDraft(),'기타',null,'2026-10',config,0,reduced).october23SimPolicy.amount,80000);
 const e=estimateMobileSale({meta:{...sim().source_meta,saleDate:'2026-10-23'},dayKey:'23',dailyDays:{},draft:api.emptyDraft(),strategicMetric:metric,month:'2026-10',config,employee:{position:'기타'},september:true},api);assert.equal(e.rows.find(r=>r[0]==='주말 SIM MNP · 해당 판매')[1],50000);
});
function orders(name,date='2026-10-23',network='household',installed='2026-10-31',extra=[]){return ['internet500','homeTv',...extra].map((product_type,i)=>({id:`${name}-${i}`,customer_name:name,source_work_date:date,actual_install_date:installed,status:'completed',network_type:network,main_tv_plan:network==='soho'?'premium':'broadcastPass',product_type}));}
test('home1/2 retroactive, MNP50k, household TVfree1/2/3/4, dates and cancellation',()=>{
 const one=orders('a','2026-10-23','household','2026-10-31',['simulMnp','tvFree']);assert.equal(calculateHomePolicyFromOrders(one,config).october23Weekend.total,170000);
 const two=[...one,...orders('b','2026-10-26','soho')];assert.equal(calculateHomePolicyFromOrders(two,config).october23Weekend.total,370000);
 for(const [n,rate] of [[1,20000],[2,30000],[3,30000],[4,50000]]){const tv=Array.from({length:n},(_,i)=>orders(String(i)).find(o=>o.product_type==='homeTv')).map(o=>({...o,product_type:'tvFree'}));const p=calculateHomePolicyFromOrders(tv,config).october23Weekend;assert.equal(p.total,n*rate);}
 assert.equal(calculateHomePolicyFromOrders(orders('old','2026-10-22'),config).october23Weekend.total,0);
 assert.equal(calculateHomePolicyFromOrders(orders('late','2026-10-23','household','2026-11-01'),config).october23Weekend.total,0);
 assert.equal(calculateHomePolicyFromOrders(two.filter(o=>o.customer_name!=='b'),config).october23Weekend.total,170000);
 assert.equal(calculateHomePolicyFromOrders(two.map(o=>o.customer_name==='b'?{...o,status:'cancelled'}:o),config).october23Weekend.count,1);
});
