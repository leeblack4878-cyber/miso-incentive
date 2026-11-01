import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {NOVEMBER_BUNDLES,NOVEMBER_SPECIAL_SALES,NOVEMBER_STOCK_SALES,novemberBaseAdjustment,novemberStockBundlePay} from '../src/novemberPolicy.js';
import {resolvePolicyConfigForMonth,policyPeriodFor} from '../src/policyCalendar.js';
import {calculateMonthlySpecialSale,specialSalesForDate} from '../src/octoberPolicy.js';
import {bundleAvailableForDate} from '../src/october16Policy.js';
import {calculateSeptemberBundleSale} from '../src/septemberPolicy.js';
import {calculateSaleStrategicPoints} from '../src/strategicPoints.js';
import {mobileSaleOffsets,estimateMobileSale} from '../src/mobileSaleEstimate.js';
import {dayAfterSaleDeletion} from '../src/saleMutations.js';
import {companyBundleRevenue} from '../src/companyBundleRevenue.js';
import {validatePreviousSecond} from '../src/secondParentPolicy.js';
const output=await build({stdin:{contents:"export {normalizeDay,applyDailyToDraft,computePay,calculateHouseholdRenew,aggregateHouseholdRenewals} from './src/appShared.jsx';export {defaultConfig} from './src/policyDefaults.js';export {emptyDraft} from './src/viewShared.js';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'stub',setup(b){b.onResolve({filter:/\/supabase$/},()=>({path:'db',namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:'export const supabase={};'}));}}]});
const mod={exports:{}};new Function('require','module','exports',output.outputFiles[0].text)(createRequire(import.meta.url),mod,mod.exports);const api=mod.exports;
const month='2026-11',config=resolvePolicyConfigForMonth(month,api.defaultConfig());
const plan=(key='general_115')=>({key,type:key.split('_')[0]});
function paid(meta,{home=false}={}){
 const day=api.normalizeDay();if(!meta.secondOnlyBundle)day.matrix[meta.ri][meta.ci]=1;
 const sp=meta.specialPolicy||{},offset=mobileSaleOffsets(meta,config,true);
 for(const k of meta.vasKeys||[])day.groups.vas[k]=(day.groups.vas[k]||0)+1;
 for(const k of meta.bundle2ndKeys||[])day.groups.bundle2nd[k]=1;
 Object.assign(day,{mobileBaseAdjustment:novemberBaseAdjustment(meta,config.matrix[meta.ri][meta.ci]),specialReplacementPay:sp.replacementAmount||0,novemberStockPay:sp.homePenaltyExempt?sp.replacementAmount:0,novemberStockBundlePay:novemberStockBundlePay(meta),bundleFreeOffset:offset.bundleOffset,bundleFreeVasOffset:offset.vasOffset});
 const draft=api.applyDailyToDraft(api.emptyDraft(),{'01':day},month,config.categoryMap,config.gibyeonColumnMap);if(home)draft.homeFlat.home500Only=1;
 const metric={month,strategicPointsWithoutDaemyung:2,daemyungCount:0,plan115Counts:{general:1,high:meta.ci===0?1:0,known:1,missing:0}};
 return {day,draft,metric,pay:api.computePay(draft,'기타',null,month,config,0,metric)};
}
test('November period, complete model prices and old October selection are isolated',()=>{
 assert.equal(policyPeriodFor('2026-11').version,'2026-11-v1');assert.equal(policyPeriodFor('2026-10').version,'2026-10-v1');
 assert.equal(specialSalesForDate('2026-10-31').find(p=>p.model==='S942-256/512'&&p.saleType==='MNP').additionalAmount,200000);
 assert.equal(specialSalesForDate('2026-11-01').find(p=>p.model==='S942-256/512'&&p.saleType==='MNP').additionalAmount,160000);
 assert(specialSalesForDate('2026-11-01').every(p=>p.november));assert(!specialSalesForDate('2026-11-01').some(p=>p.model.includes('F946')));
 for(const p of NOVEMBER_SPECIAL_SALES){const args={policyKey:p.key,saleDate:'2026-11-01',saleType:p.saleType,ri:4,planDetail:plan(),strategicPoints:2};assert.equal(calculateMonthlySpecialSale(args).additionalAmount,p.additionalAmount);assert.equal(calculateMonthlySpecialSale({...args,strategicPoints:1.8}).eligible,false);assert.equal(calculateMonthlySpecialSale({...args,saleDate:'2026-10-31'}).eligible,false);}
 const p=NOVEMBER_SPECIAL_SALES.find(p=>p.model==='S942-256/512'&&p.saleType==='기기변경');
 for(const [key,rate] of [['general_85',35000],['general_95',35000],['general_105',35000],['general_115',70000],['junior_85',70000],['senior_47',0]])assert.equal(calculateMonthlySpecialSale({policyKey:p.key,saleDate:'2026-11-01',saleType:'기기변경',ri:4,planDetail:plan(key),strategicPoints:2}).additionalAmount,rate);
});
test('all November 2ND rates, insurance and home factors combine to exactly 25%; old keys unavailable',()=>{
 assert.deepEqual(NOVEMBER_BUNDLES.map(b=>b.rate),[200000,200000,100000,150000,150000,100000,100000,200000,100000,100000,100000,100000]);
 for(const b of NOVEMBER_BUNDLES){assert.equal(bundleAvailableForDate(b.key,'2026-10-31'),false);assert.equal(bundleAvailableForDate(b.key,'2026-11-01'),true);
 for(const insured of [true,false])for(const home of [true,false]){const meta={ri:7,ci:0,secondOnlyBundle:true,secondParent:{ci:0},bundle2ndKeys:[b.key],bundleVasMap:{[b.key]:insured?['vasPhonePass']:['vasNone']},bundleVasCommissionExcluded:true};assert.equal(paid(meta,{home}).pay.bundle2ndPay,b.rate*(insured?1:.5)*(home?1:.5));}
 assert.equal(calculateSeptemberBundleSale({bundleKey:b.key,rate:b.rate,isAppleWatch:b.key.includes('Apple'),parent115:false}).paid,b.key.includes('Apple')||b.key.includes('iPad')?0:b.rate);
 }
 assert.equal(bundleAvailableForDate('b_L335_1016','2026-11-01'),false);
});
test('A176/A185 C base 30%, M140 flat base and foreign MNP do not change model additional amount',()=>{
 for(const baseModel of ['A176','A185'])assert.equal(paid({ri:4,ci:0,baseModel}).pay.mobilePlanPay,7500);
 assert.equal(paid({ri:4,ci:0,baseModel:'M140'}).pay.mobilePlanPay,5000);
 assert.equal(paid({ri:0,ci:5,baseModel:'M140'}).pay.mobilePlanPay,5000);
 assert.equal(paid({ri:1,ci:0,foreigner:true}).pay.mobilePlanPay,55000);
 assert.equal(paid({ri:5,ci:0,foreigner:true}).pay.mobilePlanPay,55000);
 assert.equal(paid({ri:4,ci:0,foreigner:true}).pay.mobilePlanPay,12500);
 const p=NOVEMBER_SPECIAL_SALES.find(p=>p.model==='A176'&&p.saleType==='기기변경');
 const amount=calculateMonthlySpecialSale({policyKey:p.key,saleDate:'2026-11-01',saleType:'기기변경',ri:4,planDetail:plan('general_28'),strategicPoints:2}).additionalAmount;
 const r=paid({ri:4,ci:0,baseModel:'A176',specialPolicy:{replacementAmount:amount}});assert.equal(r.pay.specialReplacementPay,15000);assert.equal(r.pay.mobilePlanPay,7500);
});
test('stock is additive with full amount even home-less C, validates inventory product conditions',()=>{
 for(const p of NOVEMBER_STOCK_SALES){const args={policyKey:p.key,saleDate:'2026-11-01',saleType:p.saleType,ri:4,planDetail:plan(p.stockRule==='kids'?'junior_28':'general_85'),vasKeys:['vasPhonePass','vasKyobo']};
 assert.equal(calculateMonthlySpecialSale(args).additionalAmount,p.additionalAmount);assert.equal(calculateMonthlySpecialSale({...args,vasKeys:[]}).additionalAmount,0);
 const r=paid({ri:p.stockRule==='watch'?7:4,ci:0,vasKeys:args.vasKeys,specialPolicy:{policyId:p.key,replacementAmount:p.additionalAmount,homePenaltyExempt:true}});assert.equal(r.pay.specialReplacementPay,p.additionalAmount);assert.equal(r.pay.mobilePlanPay,p.stockRule==='watch'?0:12500);
 }
});
test('stock R825 bundle and independent stock keep full amount with edit/delete/preview consistency',()=>{
 const meta={saleDate:'2026-11-01',ri:7,ci:0,secondOnlyBundle:true,secondParent:{ci:0},bundle2ndKeys:['b_R825FA'],bundleVasMap:{b_R825FA:['vasPhonePass']},bundleVasCommissionExcluded:true,bundleSaleTypeMap:{b_R825FA:'discount'}};
 const r=paid(meta);assert.equal(r.pay.bundle2ndPay,100000);
 const estimate=estimateMobileSale({meta,dayKey:'01',dailyDays:{},draft:api.emptyDraft(),strategicMetric:{month,strategicPointsWithoutDaemyung:0,daemyungCount:0,plan115Counts:{general:0,high:0,known:0,missing:0}},month,config,september:true,employee:{position:'기타'}},api);
 assert.equal(estimate.incentive,100000);
 const stockMeta={ri:4,ci:0,baseModel:'A176',mobileBaseAdjustment:-10000,specialPolicy:{policyId:'nov_stock_test',replacementAmount:600000,homePenaltyExempt:true}};
 const stock=paid(stockMeta);const deleted=dayAfterSaleDeletion(stock.day,{source_type:'mobile',sale_date:'2026-11-01',source_meta:stockMeta});assert.equal(deleted.novemberStockPay,0);assert.equal(deleted.mobileBaseAdjustment,0);assert.equal(deleted.specialReplacementPay,0);
});
test('strategy uses existing company product point map; demerit remains 10000 without home; renewals and gifts unchanged',()=>{
 assert.equal(calculateSaleStrategicPoints({vasKeys:['vasPhonePass','vasKyobo','vasDualNumber'],strategicPlan:true},'2026-11-01'),2.6);
 const d=api.emptyDraft();d.matrix[1][0]=1;d.matrix[5][0]=1;
 const result=api.computePay(d,'기타',null,month,config,0,{strategicPointsWithoutDaemyung:0,plan115Counts:{general:1,high:1,known:1,missing:0}});assert.equal(result.strategicAdjustment,-20000);
 assert.equal(api.calculateHouseholdRenew({speed:'500',plan:'premium',speedUp:true,hsSimul:true,tvUpsell:true},config).amount,160000);
 const oct=resolvePolicyConfigForMonth('2026-10',api.defaultConfig());assert.equal(api.calculateHouseholdRenew({speed:'500',plan:'premium'},oct).amount,60000);
 assert.equal(config.mnpBundle[0].rate,100000);
});
test('new employee bundle key preserves existing company rate, previous iPhone18 parent accepts non-Pro only in November',()=>{
 const sale={id:'s',sale_date:'2026-11-01',source_meta:{ri:1,planDetail:plan(),bundle2ndKeys:['b_L335_1101'],specialPolicy:{policyId:NOVEMBER_SPECIAL_SALES.find(p=>p.model==='S942-256/512').key}}};
 assert.equal(companyBundleRevenue(sale).amount,286000);
 const parent={model:'iphone18_other',date:'2026-10-20',ci:0};assert.equal(validatePreviousSecond({saleDate:'2026-11-01',parent,bundleKeys:['b_AppleWatch_1101']}),'');
 assert.notEqual(validatePreviousSecond({saleDate:'2026-10-31',parent:{...parent,date:'2026-09-20'},bundleKeys:['b_AppleWatch_1016']}),'');
});

test('November renewal UI other-plan key pays 60000, all posted rates and stale aggregate are reconciled from source',()=>{
 for(const speed of ['100','500','1g'])for(const [plan,base] of [['premiumSafe',80000],['premium',60000],['smart',60000]]){
 const item={id:'renew',plan,speed,homeOnly:false};assert.equal(api.calculateHouseholdRenew(item,config).amount,base);
 const options={...item,speedUp:true,hsSimul:true,tvUpsell:true};assert.equal(api.calculateHouseholdRenew(options,config).amount,base+30000+(speed==='1g'?80000:speed==='500'?50000:0)+20000);
 }
 const raw={...api.normalizeDay(),householdRenewals:[{id:'r',plan:'premium',speed:'1g',homeOnly:false}],groups:{renew:{renewPremiumSafe1G:1}}};const before=structuredClone(raw);
 const draft=api.applyDailyToDraft(api.emptyDraft(),{'01':raw},'2026-11',config.categoryMap,config.gibyeonColumnMap);
 assert.equal(api.computePay(draft,'기타',null,'2026-11',config).renewPay,60000);assert.deepEqual(raw,before);
 const oct=resolvePolicyConfigForMonth('2026-10',api.defaultConfig());const historical=api.applyDailyToDraft(api.emptyDraft(),{'01':raw},'2026-10',oct.categoryMap,oct.gibyeonColumnMap);assert.equal(api.computePay(historical,'기타',null,'2026-10',oct).renewPay,80000);
 const mixed={...raw,householdRenewLegacyCounts:{renewOther500:1}};const merged=api.applyDailyToDraft(api.emptyDraft(),{'01':mixed},'2026-11',config.categoryMap,config.gibyeonColumnMap);assert.equal(api.computePay(merged,'기타',null,'2026-11',config).renewPay,120000);
});
