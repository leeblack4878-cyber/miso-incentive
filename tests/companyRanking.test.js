import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateCompanyMonthlyRanking} from '../supabase/functions/monthly-ranking/calculator.js';
import {monthlyRankingRequest} from '../supabase/functions/monthly-ranking/handler.js';
const source=()=>({config:[],profiles:[{id:'me',store_name:'A',position:'사원'},{id:'other',store_name:'B',position:'사원'}],monthly:[],daily:[{user_id:'me',work_date:'2026-10-01',data:{matrix:[[15]],secret:'customer private'}},{user_id:'other',work_date:'2026-10-01',data:{matrix:[[20]]}}],home_orders:[],home_links:[],team_credits:[]});
test('public monthly company ranking includes other stores without private sales/pay fields',()=>{
 const rows=calculateCompanyMonthlyRanking(source(),'2026-10',[{id:'me',name:'본인'},{id:'other',name:'다른직원'}]);
 assert.equal(rows.length,2);assert.equal(rows[0].publicMetrics.hs,15);assert.equal(rows[1].publicMetrics.hs,20);
 assert.deepEqual(Object.keys(rows[0]).sort(),['id','name','branch','position','publicMetrics'].sort());
 assert.deepEqual(Object.keys(rows[0].publicMetrics).sort(),['hs','home','free','smart','productivity','upsell'].sort());
 assert.equal(JSON.stringify(rows).includes('customer private'),false);
});
function client({approved=true,fail=false}={}){let calls=0;return {get calls(){return calls},auth:{getUser:async token=>({data:{user:token==='valid'?{id:'me'}:null},error:token==='valid'?null:Error('bad')})},from:()=>{const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:{active:approved,status:approved?'approved':'pending'}}),then:r=>Promise.resolve({data:[{id:'me',name:'본인'},{id:'other',name:'다른직원'}]}).then(r)};return q;},rpc:async(name,args)=>{calls++;assert.equal(args.p_user_id,'me');return fail?{error:Error('private database error')}:{data:{source:source()}};}};}
const req=(body={month:'2026-10'},token='valid')=>new Request('https://example.test',{method:'POST',headers:token?{Authorization:'Bearer '+token}:{},body:JSON.stringify(body)});
test('company ranking rejects missing/bad auth, unapproved profiles and caller-supplied targets',async()=>{
 for(const token of ['', 'invalid'])assert.equal((await monthlyRankingRequest(req(undefined,token),client(),calculateCompanyMonthlyRanking)).status,401);
 const denied=client({approved:false});assert.equal((await monthlyRankingRequest(req(),denied,calculateCompanyMonthlyRanking)).status,403);assert.equal(denied.calls,0);
 assert.equal((await monthlyRankingRequest(req({month:'2026-10',userId:'other'}),client(),calculateCompanyMonthlyRanking)).status,400);
});
test('company ranking returns safe full company rows and explicit unavailable errors',async()=>{
 const r=await monthlyRankingRequest(req(),client(),calculateCompanyMonthlyRanking);assert.equal(r.status,200);assert.equal((await r.json()).rows.length,2);
 const failed=await monthlyRankingRequest(req(),client({fail:true}),calculateCompanyMonthlyRanking);assert.equal(failed.status,503);assert.deepEqual(await failed.json(),{error:'RANKING_UNAVAILABLE'});
});

test('scheduled report serves only the latest saved snapshot and limits amount fields', async () => {
 const {progressSlot}=await import('../supabase/functions/monthly-ranking/manager-progress.js');
 for(const [utc,kst] of [['01','10'],['06','15'],['12','21']]) {
  assert.deepEqual(progressSlot(new Date(`2026-11-04T${utc}:00:00Z`)),{month:'2026-11',slotAt:`2026-11-04T${kst}:00:00+09:00`});
 }
 assert.equal(progressSlot(new Date('2026-11-04T06:11:00Z')),null);
 const snapshot={slot_at:'2026-11-04T06:00:00Z',rows:[
  {store_name:'A',metrics:{hs:2},amounts:{current:50000,forecast:100000}},
  {store_name:'B',metrics:{hs:5},amounts:{current:400000,forecast:600000}},
 ]};
 const reportRequest=req({month:'2026-11',view:'manager-progress'});
 const call=async profile=>{
  const admin=client();
  admin.from=table=>{
   const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:table==='profiles'?profile:snapshot})};
   return q;
  };
  const r=await monthlyRankingRequest(reportRequest.clone(),admin,calculateCompanyMonthlyRanking);
  assert.equal(admin.calls,0);
  return {status:r.status,data:await r.json()};
 };
 const employee={id:'me',active:true,status:'approved',role:'employee',store_name:'A'};
 assert.equal((await call(employee)).status,403);
 const leader=await call({...employee,role:'manager',position:'점장'});
 assert.equal(leader.status,200);
 assert.equal(leader.data.slotAt,snapshot.slot_at);
 assert.deepEqual(leader.data.rows[0].amounts,snapshot.rows[0].amounts);
 assert.equal('amounts' in leader.data.rows[1],false);
 const executive=await call({...employee,id:'a50a0979-acef-40b1-98b7-f05074f1c835',role:'admin'});
 assert.equal(executive.data.rows[1].amounts.current,400000);
 const captureClient=client();
 captureClient.rpc=async (name,args)=>{
  assert.equal(name,'authorize_manager_progress_capture');
  assert.equal(args.p_token,'valid');
  return {data:false};
 };
 const unauthorizedCapture=await monthlyRankingRequest(req({view:'capture-manager-progress'}),captureClient,calculateCompanyMonthlyRanking);
 assert.equal(unauthorizedCapture.status,401);
});

test('employee projection uses daily input and keeps missing manager-confirmed counts distinct from zero', async () => {
 const {calculateEmployeeManagerProgress}=await import('../supabase/functions/monthly-ranking/calculator.js');
 const input=source();
 input.daily.forEach(row=>{row.work_date="2026-11-01"});
 input.profiles[0].store_name='신천동_삼미시장2호점';
 input.profiles[1].store_name='신천동_삼미시장점';
 const rows=calculateEmployeeManagerProgress(input,'2026-11',[],new Date('2026-11-04T06:00:00Z'));
 assert.equal(rows.length,1);
 assert.equal(rows[0].metrics.hs,15);
 assert.equal(rows[0].quality.managerBundleCount,null);
 assert.equal(rows[0].quality.strategyModelCount,null);
 assert.equal(rows[0].quality.mnpRatio,0);
 assert.ok(rows[0].amounts.forecast>rows[0].amounts.current);
 assert.equal(JSON.stringify(rows).includes('customer private'),false);
});
