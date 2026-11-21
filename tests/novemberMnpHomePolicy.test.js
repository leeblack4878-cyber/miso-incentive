import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateHomePolicyFromOrders} from '../src/policyEngine.js';
const sale=(id,date='2026-11-17',changes={})=>['internet500','homeTv','simulMnp'].map((product_type,i)=>({
 id:`${id}-${i}`,user_id:'employee-a',customer_id:id,product_type, source_work_date:date,
 actual_install_date:'2026-11-30',internet_plan:'premiumSafe',network_type:'household',main_tv_plan:'broadcastPass',
 status:'completed',...changes
}));
const result=rows=>calculateHomePolicyFromOrders(rows);
test('new MNP policy pays 100k per home bundle only inside the application and installation boundaries',()=>{
 const r=result([...sale('pre','2026-11-16'),...sale('first'),...sale('last','2026-11-30'),...sale('outside','2026-12-01'),...sale('late','2026-11-30',{actual_install_date:'2026-12-01'})]);
 assert.equal(r.novemberMnpHome.total,200000);
 assert.equal(r.details.filter(x=>x.item==='11월 17~30일 HS MNP·홈 동시판매').length,2);
 assert.equal(result(sale('first')).simulPay,300000);
});
test('MNP exact attribution and eligible done source only; duplicates, SIM/other flags and uncertain rows do not inflate',()=>{
 const a=sale('a');
 for(const type of ['simulNewChange','simulUsedMnp','simulSimMnp',null])assert.equal(result(a.map((r,i)=>i===2?{...r,product_type:type}:r)).novemberMnpHome.total,0);
 for(const change of [{user_id:'employee-b'},{customer_id:null},{source_work_date:'2026-11-18'},{status:'pending'},{status:'cancelled'},{actual_install_date:null},{actual_install_date:'2026-11-16'},{team_only:true}])
  assert.equal(result(a.map((r,i)=>i===2?{...r,...change}:r)).novemberMnpHome.total,0);
 assert.equal(result([...a,...sale('a')]).novemberMnpHome.total,100000);
 assert.equal(result([...a,{...a[0],id:'b-internet'}]).novemberMnpHome.total,0);
 assert.equal(result([...a,{...a[0],actual_install_date:'2026-11-29'}]).novemberMnpHome.total,0);
});
test('only campaign MNP increment is held while weekend overlaps, retaining base and applicable weekend amount',()=>{
 const weekend=sale('weekend','2026-11-20');
 const both=result(weekend);
 assert.equal(both.simulPay,300000);
 assert.equal(both.novemberThirdWeekend.total,100000);
 assert.equal(both.novemberMnpHome.total,0);
 assert.match(both.novemberMnpHome.pending[0].reason,/중복 지급/);
 const mnpOnly=result(weekend.map(r=>({...r,main_tv_plan:'belowPremium'})));
 assert.equal(mnpOnly.novemberThirdWeekend.total,0);
 assert.equal(mnpOnly.novemberMnpHome.total,100000);
});
