import test from 'node:test';
import assert from 'node:assert/strict';
import {OCTOBER9_SPECIAL_SALES as policies} from '../src/october9Policy.js';
import {specialSalesForDate,calculateMonthlySpecialSale,octoberConfig} from '../src/octoberPolicy.js';
import {MOBILE_PLANS} from '../src/mobilePlans.js';
import {calculateHomePolicyFromOrders,calculateMobileSale} from '../src/policyEngine.js';
const plan=key=>MOBILE_PLANS.find(p=>p.key===key);
test('10/9 notices: all 24 model/type customer supports, no employee extra, exact period',()=>{
 assert.equal(policies.length,24);
 assert.deepEqual(policies.map(p=>p.customerDiscount),[0,0,500000,300000,500000,300000,500000,300000,0,300000,600000,400000,600000,400000,600000,400000,400000,200000,400000,200000,400000,200000,350000,200000]);
 for(const p of policies){
  const args={policyKey:p.key,saleDate:'2026-10-09',saleType:p.saleType,planDetail:plan('general_115'),strategicPoints:2,vasKeys:['vasKyobo','vasPhonePass']};
  for(const saleDate of ['2026-10-09','2026-10-12']){const result=calculateMonthlySpecialSale({...args,saleDate});assert.equal(result.eligible,true);assert.equal(result.additionalAmount,0);}
  for(const saleDate of ['2026-10-08','2026-10-13','2026-10-16']){assert(!specialSalesForDate(saleDate).some(x=>x.key===p.key));assert.equal(calculateMonthlySpecialSale({...args,saleDate}).eligible,false);}
  assert.equal(calculateMonthlySpecialSale({...args,saleType:'010 신규'}).eligible,false);
 }
 assert(policies.find(p=>p.deviceModel==='S741'&&p.saleType==='MNP').customerZeroPrice);
 assert(!policies.find(p=>p.deviceModel==='S741'&&p.saleType==='기기변경').customerZeroPrice);
});
test('10/9 A176 low plan exceptions require insurance and specified VAS; others actual high plan and2P',()=>{
 const a=policies[0],h=policies[2],base={saleDate:'2026-10-09',saleType:'MNP',strategicPoints:2,vasKeys:['vasKyobo','vasPhonePass']};
 for(const key of ['general_55','senior_47','junior_47'])assert(calculateMonthlySpecialSale({...base,policyKey:a.key,planDetail:plan(key)}).eligible);
 for(const key of ['general_47','senior_44','junior_37'])assert(!calculateMonthlySpecialSale({...base,policyKey:a.key,planDetail:plan(key)}).eligible);
 for(const vasKeys of [[],['vasKyobo'],['vasPhonePass']])assert(!calculateMonthlySpecialSale({...base,policyKey:a.key,planDetail:plan('general_55'),vasKeys}).eligible);
 for(const key of ['general_115','junior_85'])assert(calculateMonthlySpecialSale({...base,policyKey:h.key,planDetail:plan(key)}).eligible);
 assert(!calculateMonthlySpecialSale({...base,policyKey:h.key,planDetail:plan('general_105')}).eligible);
 assert(!calculateMonthlySpecialSale({...base,policyKey:h.key,planDetail:plan('general_115'),strategicPoints:1.9}).eligible);
});
const orders=(name,date,network='household',install='2026-10-30')=>['internet500','homeTv'].map((product_type,i)=>({id:name+i,customer_id:name,customer_name:name,product_type,source_work_date:date,network_type:network,main_tv_plan:network==='soho'?'premium':'broadcastPass',actual_install_date:install,status:'completed'}));
test('10/9 home1/2/3=100k/300k/450k incl SOHO; periods separate and cancellation regrades',()=>{
 const calc=o=>calculateHomePolicyFromOrders(o,octoberConfig());const a=orders('a','2026-10-09'),b=orders('b','2026-10-12','soho'),c=orders('c','2026-10-10');
 assert.equal(calc(a).october9Weekend.total,100000);assert.equal(calc([...a,...b]).october9Weekend.total,300000);assert.equal(calc([...a,...b,...c]).october9Weekend.total,450000);
 for(const date of ['2026-10-08','2026-10-13'])assert.equal(calc(orders('x',date)).october9Weekend.total,0);
 assert.equal(calc(orders('x','2026-10-09','household','2026-11-01')).october9Weekend.total,0);
 b[1].status='cancelled';assert.equal(calc([...a,...b]).october9Weekend.total,100000);
 const all=calc([...a,...orders('old','2026-10-02'),...orders('new','2026-10-16')]);assert.equal(all.limitedPolicyPay,300000);assert.equal(all.october9Weekend.total,100000);assert.equal(all.octoberWeekend.total,100000);assert.equal(all.october16Weekend.total,100000);
 assert.equal(all.details.filter(x=>x.item==='10월 9~12일 주말 홈 추가 지급').length,1);
});
test('10/9 unpaid ledger never pays customer support, plan or VAS; keeps activity and points',()=>{
 const cfg=octoberConfig(),p=policies[2];const value=calculateMobileSale({source_meta:{ri:1,ci:0,vasKeys:['vasKyobo','vasPhonePass'],specialPolicy:{policyId:p.key,policyType:p.policyType,replacementAmount:0,customerDiscount:p.customerDiscount}}},{matrixRates:cfg.matrix,vasRates:cfg.vas,bundleRates:cfg.bundle2nd});
 assert.equal(value.paid.plan,0);assert.equal(value.paid.vas,0);assert.equal(value.activityCount,1);assert.equal(value.insurancePoints,0.8);
});
