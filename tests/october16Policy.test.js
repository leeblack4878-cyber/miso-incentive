import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {OCTOBER16_SPECIAL_SALES,OCTOBER16_BUDDY_SALES,OCTOBER16_BUNDLES,bundleAvailableForDate} from '../src/october16Policy.js';
import {calculateMonthlySpecialSale,octoberQuality,octoberConfig,specialSalesForDate} from '../src/octoberPolicy.js';
import {calculateSeptemberBundleSale} from '../src/septemberPolicy.js';
import {calculateOctoberWeekendHomeBonus} from '../src/octoberWeekendPolicy.js';
import {calculateMobileSale,calculateHomePolicyFromOrders} from '../src/policyEngine.js';
import {mobileSaleOffsets,estimateMobileSale} from '../src/mobileSaleEstimate.js';
import {dayAfterSaleDeletion} from '../src/saleMutations.js';
const bundled=await build({stdin:{contents:"export {normalizeDay,applyDailyToDraft,computePay,currentPolicySnapshot} from './src/appShared.jsx';export {defaultConfig} from './src/policyDefaults.js';export {emptyDraft} from './src/viewShared.js';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'db-stub',setup(b){b.onResolve({filter:/\/supabase$/},()=>({path:'db',namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:'export const supabase={};'}));}}]});
const mod={exports:{}};new Function('require','module','exports',bundled.outputFiles[0].text)(createRequire(import.meta.url),mod,mod.exports);const api=mod.exports,config=octoberConfig(api.defaultConfig());
test('10/16 all twenty rates, C deduction and day boundary preserve 10/15',()=>{
 assert.deepEqual(OCTOBER16_SPECIAL_SALES.map(p=>p.additionalAmount),[250000,200000,200000,150000,200000,150000,200000,150000,350000,300000,300000,250000,130000,80000,200000,150000,350000,300000,200000,200000]);
 for(const p of OCTOBER16_SPECIAL_SALES){const a={policyKey:p.key,saleDate:'2026-10-16',saleType:p.saleType,ri:p.saleType==='MNP'?1:2,planGroup:'115',strategicPoints:2};assert.equal(calculateMonthlySpecialSale(a).additionalAmount,p.additionalAmount);
  assert.equal(calculateMonthlySpecialSale({...a,saleDate:'2026-10-15'}).eligible,false);
  assert.equal(calculateMonthlySpecialSale({...a,planGroup:'85'}).additionalAmount,0);
  for(const key of ['general_28','senior_47','junior_under28']){const low={...a,planDetail:{key,type:key.split('_')[0]}};assert.equal(calculateMonthlySpecialSale(low).eligible,p.policyType!=='incentive_unpaid');}
  if(p.saleType==='기기변경')assert.equal(calculateMonthlySpecialSale({...a,ri:4}).additionalAmount,p.additionalAmount-50000);
 }
 const old=specialSalesForDate('2026-10-15').find(p=>p.model==='F971-512'&&p.saleType==='기기변경');assert.equal(old.additionalAmount,30000);
 assert(!specialSalesForDate('2026-10-16').some(p=>p.key===old.key));
 assert(specialSalesForDate('2026-10-20').some(p=>p.key===OCTOBER16_SPECIAL_SALES[0].key));
});
test('115 ratio uses 60% for pre16 eligible units and 70% for post16 units',()=>{
 const matrix=Array.from({length:8},()=>Array(6).fill(0));matrix[0][0]=13;matrix[0][2]=7;
 const q=octoberQuality({matrix,strategicPoints:40,plan115BeforeRevision:6,plan115AfterRevision:7});assert.equal(q.plan115Bonus,60000);
 matrix[0][0]=14;matrix[0][2]=6;assert.equal(octoberQuality({matrix,strategicPoints:40,plan115BeforeRevision:6,plan115AfterRevision:8,homeNoPerformance:true}).plan115Bonus,70000);
 const d1=api.normalizeDay(),d2=api.normalizeDay();d1.matrix[0][0]=6;d1.matrix[0][2]=4;d2.matrix[0][0]=7;d2.matrix[0][2]=3;
 const draft=api.applyDailyToDraft(api.emptyDraft(),{'15':d1,'16':d2},'2026-10',config.categoryMap,config.gibyeonColumnMap);
 const pay=api.computePay(draft,'기타',null,'2026-10',config,0,{strategicPointsWithoutDaemyung:40});assert.equal(pay.plan115Bonus,30000);
});
test('all revised 2ND rates, insurance halves, normal-only and old Apple exemption',()=>{
 assert.deepEqual(OCTOBER16_BUNDLES.map(x=>x.rate),[250000,200000,200000,250000,300000,300000,300000,250000,200000,200000,200000,200000]);
 for(const b of OCTOBER16_BUNDLES){for(const insured of [true,false])assert.equal(calculateSeptemberBundleSale({bundleKey:b.key,rate:b.rate,insuranceJoined:insured}).paid,b.rate*(insured?1:.5));assert.equal(calculateSeptemberBundleSale({bundleKey:b.key,rate:b.rate,saleType:'discount'}).paid,0);assert.equal(bundleAvailableForDate(b.key,'2026-10-15'),false);assert.equal(bundleAvailableForDate(b.key,'2026-10-16'),true);}
 assert.equal(calculateSeptemberBundleSale({bundleKey:'b_AppleWatch',isAppleWatch:true,rate:150000,insuranceJoined:false,parent115:true}).paid,150000);
});
test('actual new 2ND payroll/ledger/preview and save-edit-delete offsets match; two halves =25%',()=>{
 const key='b_L335_1016',meta={ri:7,ci:0,secondOnlyBundle:true,secondParent:{ci:0},bundle2ndKeys:[key],bundleVasMap:{[key]:['vasNone']},bundleSaleTypeMap:{[key]:'normal'},bundleVasCommissionExcluded:true};
 const day=api.normalizeDay();day.groups.bundle2nd[key]=1;day.bundleFreeOffset=mobileSaleOffsets(meta,config,true).bundleOffset;
 assert.equal(day.bundleFreeOffset,125000);
 const draft=api.applyDailyToDraft(api.emptyDraft(),{'16':day},'2026-10',config.categoryMap,config.gibyeonColumnMap);
 const pay=api.computePay(draft,'기타',null,'2026-10',config,0,{strategicPointsWithoutDaemyung:0});assert.equal(pay.bundle2ndPay,62500);
 const ledger=calculateMobileSale({source_meta:{...meta,policySnapshot:api.currentPolicySnapshot(config)}});assert.equal(ledger.paid.second,125000);assert.equal(ledger.paid.vas,0);
 const sale={source_type:'mobile',source_meta:meta};const estimate=estimateMobileSale({meta,existingSale:sale,dayKey:'16',dailyDays:{'16':day},draft,strategicMetric:{strategicPointsWithoutDaemyung:0},month:'2026-10',config,employee:{position:'기타'},september:true},api);assert.equal(estimate.rows.find(([label])=>label==='2ND 기본금액')[1],250000);assert.equal(estimate.rows.find(([label])=>label==='2ND 할인·조건 미충족 제외')[1],-125000);
 const reversed=dayAfterSaleDeletion(day,sale,mobileSaleOffsets(meta,config,true));assert.equal(reversed.groups.bundle2nd[key],0);assert.equal(reversed.bundleFreeOffset,0);
 const insured={...meta,bundleVasMap:{[key]:['vasPhonePass']}};assert.equal(mobileSaleOffsets(insured,config,true).bundleOffset,0);assert.equal(calculateMobileSale({source_meta:{...insured,policySnapshot:api.currentPolicySnapshot(config)}}).paid.vas,0);
});
function orders(date,customer,network='household',installed='2026-10-30'){return ['internet500','homeTv'].map((product_type,i)=>({id:`${customer}-${i}`,customer_name:customer,source_work_date:date,actual_install_date:installed,status:'completed',network_type:network,main_tv_plan:network==='soho'?'premium':'broadcastPass',product_type}));}
test('10/16~19 home DPS bonus is additive, retroactive at2, SOHO included, November excluded',()=>{
 const one=calculateHomePolicyFromOrders(orders('2026-10-16','a'),config);assert.equal(one.october16Weekend.total,100000);
 const both=[...orders('2026-10-16','a'),...orders('2026-10-19','b','soho')];const two=calculateHomePolicyFromOrders(both,config);assert.equal(two.october16Weekend.total,300000);assert.equal(two.total,two.gradePay+two.homeFlatPay+two.homeAddonPay);
 assert.equal(calculateHomePolicyFromOrders(orders('2026-10-20','c'),config).october16Weekend.total,0);
 assert.equal(calculateHomePolicyFromOrders(orders('2026-10-16','d','household','2026-11-01'),config).october16Weekend.total,0);
 assert.equal(calculateHomePolicyFromOrders(orders('2026-10-02','old'),config).octoberWeekend.total,100000);
 const cancelled=both.filter(o=>o.customer_name!=='b');assert.equal(calculateHomePolicyFromOrders(cancelled,config).october16Weekend.total,100000);
});
test('Buddy free0 vs normal80/40, normal any plan/free55, insurance+VAS1.8, A/B only, ends19',()=>{
 for(const p of OCTOBER16_BUDDY_SALES){const a={policyKey:p.key,saleDate:'2026-10-16',saleType:p.saleType,ri:p.saleType==='MNP'?1:2,planDetail:{key:'general_55',type:'general'},strategicPoints:1.8,vasKeys:['vasKyobo','vasPhonePass']};assert.equal(calculateMonthlySpecialSale(a).additionalAmount,p.additionalAmount);
  for(const overrides of [{saleDate:'2026-10-20'},{strategicPoints:1.7},{vasKeys:['vasKyobo']}])assert.equal(calculateMonthlySpecialSale({...a,...overrides}).eligible,false);
  for(const key of ['general_28','senior_47','junior_under28']){const low={...a,planDetail:{key,type:key.split('_')[0]}};assert.equal(calculateMonthlySpecialSale(low).eligible,p.policyType!=='incentive_unpaid');}
  if(p.saleType==='기기변경')assert.equal(calculateMonthlySpecialSale({...a,ri:4}).eligible,false);
 }
});
