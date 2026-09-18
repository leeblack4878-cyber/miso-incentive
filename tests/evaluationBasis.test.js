import test from 'node:test';
import assert from 'node:assert/strict';
import {PostgrestClient} from '@supabase/postgrest-js';
import {evaluationBasis,evaluationMetric,companyMetricsForSave,validCompanyDate,reportedEvaluation} from '../src/evaluationBasis.js';
import {saveEvaluationSnapshot} from '../src/evaluationSave.js';

test('employee/company selection keeps 0 distinct from missing, without mixing sources',()=>{
 const input={live:{hs:20,home:3},verified:{hs:0}};
 assert.equal(evaluationMetric({...input,basis:'employee'},'hs'),20);
 assert.equal(evaluationMetric({...input,basis:'company'},'hs'),0);
 assert.equal(evaluationMetric({...input,basis:'company'},'home'),null);
 assert.equal(evaluationBasis(null,'2026-09','2026-09-18'),'employee');
 assert.equal(evaluationBasis({external_inputs:{evaluationBasis:'company'}},'2026-09','2026-09-18'),'company');
});
test('blank legacy 115 values can be cleared, invalid amounts and dates are rejected',()=>{
 assert.deepEqual(companyMetricsForSave({hs:0,home:'',plan115:'',plan115Count:12}),{hs:0});
 assert.throws(()=>companyMetricsForSave({hs:-1}));
 assert.throws(()=>companyMetricsForSave({hs:'abc'}));
 assert.equal(validCompanyDate('2026-09-16','2026-09','2026-09-18'),true);
 for(const day of ['2026-09-19','2026-08-16','2026-09-31'])assert.equal(validCompanyDate(day,'2026-09','2026-09-18'),false);
});
test('company report survives JSONB key reordering but expires after input edits',()=>{
 const report={asOfDate:'2026-09-16',core100:42.6,aa100:42,verifiedMetrics:{hs:24,simMnp:3},externalInputs:{npsScore:91.3}};
 const snapshot={verified_metrics:{simMnp:3,hs:24},external_inputs:{companyAsOfDate:'2026-09-16',npsScore:91.3,companyEvaluationReport:report}};
 assert.equal(reportedEvaluation(snapshot).core100,42.6);
 assert.equal(reportedEvaluation({...snapshot,verified_metrics:{simMnp:3,hs:25}}),null);
 assert.equal(reportedEvaluation({...snapshot,external_inputs:{...snapshot.external_inputs,npsScore:100}}),null);
});
test('SDK update includes original JSON and timestamp guards and returns persisted data',async()=>{
 const previous={month:'2026-09',store_name:'test-store',verified_metrics:{hs:0},external_inputs:{evaluationBasis:'employee'},verified_at:null};
 const payload={...previous,external_inputs:{evaluationBasis:'company'}};
 const client=new PostgrestClient('https://example.supabase.co/rest/v1',{fetch:async(url,options)=>{
  const q=new URL(url).searchParams;
  assert.equal(options.method,'PATCH');
  assert.equal(q.get('verified_metrics'),'eq.{"hs":0}');
  assert.equal(q.get('external_inputs'),'eq.{"evaluationBasis":"employee"}');
  assert.equal(q.get('verified_at'),'is.null');
  assert.deepEqual(JSON.parse(options.body),payload);
  return new Response(JSON.stringify(payload),{status:200,headers:{'Content-Type':'application/json'}});
 }});
 assert.deepEqual(await saveEvaluationSnapshot(client,{previous,payload}),payload);
});
test('stale update and denied save do not report success',async()=>{
 for(const code of ['PGRST116','23505','42501']){
  const client=new PostgrestClient('https://example.supabase.co/rest/v1',{fetch:async()=>new Response(JSON.stringify({code,message:'not saved'}),{status:code==='42501'?403:406,headers:{'Content-Type':'application/json'}})});
  await assert.rejects(saveEvaluationSnapshot(client,{previous:null,payload:{month:'2026-09',store_name:'test-store'}}));
 }
});
