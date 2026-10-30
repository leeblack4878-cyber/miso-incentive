import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeCompanyRenewals as calc} from '../src/companyRenewalRevenue.js';
import {summarizeStoreRevenue} from '../src/storeRevenue.js';
const day=items=>({user_id:'a',work_date:'2026-10-10',data:{householdRenewals:items}});
const item=(extra={})=>({id:'x',plan:'premiumSafe',speed:'500',homeOnly:true,...extra});
test('company household renewal rates: both premium variants 99000, other 77000; customer gifts excluded',()=>{
 for(const plan of ['premiumSafe','premium','smart'])for(const speed of ['100','500','1g'])assert.equal(calc([day([item({plan,speed})])],'2026-10').total,plan==='smart'?77000:99000);
});
test('speed up plus TV renewal and upsell sum once, 100->200 adds no bonus',()=>{
 const result=calc([day([item({speedUp:true,homeOnly:false,tvUpsell:true})])],'2026-10');assert.equal(result.internet,132000);assert.equal(result.tv,33000);assert.equal(result.total,165000);
 assert.equal(calc([day([item({speed:'200',speedUp:true})])],'2026-10').total,99000);
 assert.equal(calc([day([item({homeOnly:false})])],'2026-10').total,110000);
});
test('renewals recalculate after deletion/cancellation/downspeed and never estimate legacy-only records',()=>{
 const d=day([item()]),before=structuredClone(d);assert.equal(calc([d,d],'2026-10').total,99000);assert.deepEqual(d,before);
 for(const extra of [{deleted:true},{status:'cancelled'},{downSpeed:true}])assert.equal(calc([day([item(extra)])],'2026-10').total,0);
 assert.equal(calc([d],'2026-11').total,0);assert.equal(calc([day([])],'2026-10').total,0);
 assert.equal(calc([{...day([]),data:{groups:{renew:{renewOther500:1}}}}],'2026-10').pending,1);
});
test('renewal company revenue is included in home internet/TV categories without changing payroll or monthly awards',()=>{
 const r=summarizeStoreRevenue({daily:[day([item({speedUp:true,homeOnly:false,tvUpsell:true})])],profiles:[{id:'a',store_name:'A'}],stores:['A'],month:'2026-10'}).rows[0];
 assert.equal(r.home,165000);assert.equal(r.homeBreakdown.internet,132000);assert.equal(r.homeBreakdown.tv,33000);assert.equal(r.total,r.home+r.monthly+r.mobile);
});
