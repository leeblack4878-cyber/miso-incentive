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
