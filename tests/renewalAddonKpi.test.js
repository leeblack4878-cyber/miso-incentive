import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
const output=await build({stdin:{contents:"export {normalizeDay,emptyHouseholdRenewForm,applyDailyToDraft,computePay,renewalKpiItems} from './src/appShared.jsx';export {defaultConfig} from './src/policyDefaults.js';export {emptyDraft} from './src/viewShared.js';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'stub',setup(b){b.onResolve({filter:/\/supabase$/},()=>({path:'db',namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:'export const supabase={};'}));}}]});
const mod={exports:{}};new Function('require','module','exports',output.outputFiles[0].text)(createRequire(import.meta.url),mod,mod.exports);
const api=mod.exports;
const month='2026-11',config=api.defaultConfig();
const score=(items,cfg=config)=>{
  const day=api.normalizeDay();day.householdRenewals=items;
  const draft=api.applyDailyToDraft(api.emptyDraft(),{'01':day},month,cfg.categoryMap,cfg.gibyeonColumnMap);
  return {draft,score:api.computePay(draft,'기타',null,month,cfg).kpiScore};
};
const renewal=(extra={})=>({...api.emptyHouseholdRenewForm(),...extra});
test('renewal extras add 0.3P each while regular home sale rates stay intact',()=>{
  const base=score([renewal()]);
  const both=score([renewal({subSetTop:true,smartHome:true})]);
  assert.equal(both.draft.kpi.kpiRenewSubSetTop,1);
  assert.equal(both.draft.kpi.kpiRenewSmartHome,1);
  assert.ok(Math.abs((both.score-base.score)-0.6)<1e-8);
  const day=api.normalizeDay();day.groups.homeAddon.addSetTop=1;day.groups.homeFlat.smartHome=1;
  const normal=api.applyDailyToDraft(api.emptyDraft(),{'01':day},month,config.categoryMap,config.gibyeonColumnMap);
  assert.equal(normal.kpi.kpiTvSetTop,1);assert.equal(normal.kpi.kpiSmartHome,1);
  assert.equal(normal.kpi.kpiRenewSubSetTop,0);assert.equal(normal.kpi.kpiRenewSmartHome,0);
});
test('previously saved KPI settings missing new keys still recognize renewal extras',()=>{
  const old={...config,kpiItems:config.kpiItems.filter(i=>!['kpiRenewSubSetTop','kpiRenewSmartHome'].includes(i.key))};
  const diff=score([renewal({subSetTop:true,smartHome:true})],old).score-score([renewal()],old).score;
  assert.ok(Math.abs(diff-0.6)<1e-8);
  for(const items of [old.kpiItems,config.kpiItems]){
    assert.equal(api.renewalKpiItems(items).filter(i=>i.key==='kpiRenewSubSetTop').length,1);
    assert.equal(api.renewalKpiItems(items).filter(i=>i.key==='kpiRenewSmartHome').length,1);
  }
});
test('editing/deleting extras or loading legacy renewals does not retain phantom credit',()=>{
  const both=score([renewal({subSetTop:true,smartHome:true})]);
  const edited=score([renewal({subSetTop:true,smartHome:false})]);
  assert.ok(Math.abs(both.score-edited.score-0.3)<1e-8);
  assert.equal(edited.draft.kpi.kpiRenewSmartHome,0);
  assert.equal(score([]).draft.kpi.kpiRenewSubSetTop,0);
  assert.equal(score([{homeOnly:false,speed:'1g',plan:'premiumSafe'}]).draft.kpi.kpiRenewSmartHome,0);
});
