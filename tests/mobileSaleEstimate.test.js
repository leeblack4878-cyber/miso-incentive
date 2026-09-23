import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {estimateMobileSale,changeStrategicMetric,mobileSaleOffsets} from '../src/mobileSaleEstimate.js';
import {septemberConfig} from '../src/septemberPolicy.js';
// Use the actual payroll engine; replace only its unrelated database client.
const result=await build({stdin:{contents:"export {normalizeDay,applyDailyToDraft,computePay} from './src/appShared.jsx'; export {defaultConfig} from './src/policyDefaults.js'; export {emptyDraft} from './src/viewShared.js';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'no-database',setup(b){b.onResolve({filter:/\/supabase$/},()=>({path:'db',namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:'export const supabase={};'}));}}]});
const mod={exports:{}};new Function('require','module','exports',result.outputFiles[0].text)(createRequire(import.meta.url),mod,mod.exports);
const api=mod.exports;
const config=septemberConfig(api.defaultConfig());
const meta={ri:2,ci:0,vasKeys:['vasKyobo','vasPhonePass','vasDesignatedNumber'],bundle2ndKeys:['b_X236NP','b_L345'],bundleVasMap:{b_X236NP:['vasPhonePass'],b_L345:['vasPhonePass']},bundleSaleTypeMap:{b_X236NP:'discount',b_L345:'discount'},bundleVasCommissionExcluded:true,specialPolicy:{replacementAmount:100000}};
function fixture(){const day=api.normalizeDay();day.matrix[2][0]=23;day.groups.vas={vasKyobo:1,vasPhonePass:1,vasDesignatedNumber:1};day.groups.bundle2nd={b_X236NP:1,b_L345:1,b_L355:3};day.groups.sono={sono:1};day.bundleFreeOffset=310000;day.specialReplacementPay=100000;const draft=api.emptyDraft();draft.homePolicy={source:'orders',completedInternetCount:1,totalInternetCount:1,gradePay:0,homeFlatPay:0,total:0};day.groups.homeBase={homeOnly:1};return {meta,existingSale:{source_type:'mobile',source_meta:meta},dayKey:'20',dailyDays:{'20':day},draft,strategicMetric:{strategicPointsWithoutDaemyung:44.2,daemyungCount:0},month:'2026-09',config,employee:{position:'점장',hireDate:'2020-01-01'},september:true};}
test('23 HS / 46.2P: list and unchanged edit both apply only 10,000 for this sale at the current band',()=>{const args=fixture();const list=estimateMobileSale(args,api);const edit=estimateMobileSale({...args,meta:structuredClone(meta)},api);assert.deepEqual(list,edit);assert.ok(Math.abs(list.afterRatio-200.869565)<.001);assert.deepEqual(list.rows.find(x=>x[0]==='전략포인트 비중 · 해당 판매'),['전략포인트 비중 · 해당 판매',10000]);assert.equal(list.incentive,230000);assert.equal(list.rows.reduce((s,[,v])=>s+v,0),list.incentive);assert.equal(args.dailyDays['20'].matrix[2][0],23);});
test('new sale and existing sale use identical without/with month totals',()=>{const args=fixture(),saved=estimateMobileSale(args,api);const old=args.dailyDays['20'];const day=structuredClone(old);day.matrix[2][0]--;day.groups.vas={};day.groups.bundle2nd={b_L355:3};day.bundleFreeOffset=0;day.specialReplacementPay=0;const fresh=estimateMobileSale({...args,existingSale:null,dailyDays:{'20':day},strategicMetric:changeStrategicMetric(args.strategicMetric,meta,-1)},api);assert.deepEqual(fresh,saved);});
test('editing strategy and crossing below 200% recalculates, no duplicated sale',()=>{const args=fixture();const value=estimateMobileSale({...args,meta:{...meta,vasKeys:[]}},api);assert.ok(value.afterRatio<200);assert.equal(value.rows.some(x=>x[0]==='전략포인트 비중 · 해당 판매'),false);});
test('missing monthly strategy is not silently treated as zero; team support excluded',()=>{const args=fixture();assert.equal(estimateMobileSale({...args,strategicMetric:null},api),null);assert.equal(estimateMobileSale({...args,meta:{...meta,teamOnly:true}},api).incentive,0);});
test('discount second insurance offsets match policy and preserve unpaid insurance',()=>{assert.equal(mobileSaleOffsets(meta,config,true).bundleOffset,310000);assert.equal(mobileSaleOffsets({...meta,bundleVasMap:{b_X236NP:['vasNone'],b_L345:['vasPhonePass']}},config,true).bundleOffset,330000);});
test('monthly grade bonus never changes customer estimate, payroll still awards it',()=>{
 const args=fixture();args.dailyDays['20'].groups.homeBase={homeOnly:3};
 const withGrade={...args,config:{...config,grades:[{grade:'C',min:24,bonus:300000},{grade:'D',min:0,bonus:0}]}};
 const withoutGrade={...args,config:{...config,grades:[{grade:'C',min:24,bonus:0},{grade:'D',min:0,bonus:0}]}};
 assert.equal(estimateMobileSale(withGrade,api).incentive,estimateMobileSale(withoutGrade,api).incentive);
 const draft=api.applyDailyToDraft(args.draft,args.dailyDays,args.month,config.categoryMap,config.gibyeonColumnMap);
 assert.equal(api.computePay(draft,'점장','2020-01-01',args.month,withGrade.config,0,args.strategicMetric).gradeBonus,300000);
});
