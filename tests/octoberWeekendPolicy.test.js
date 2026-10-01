import test from 'node:test';
import assert from 'node:assert/strict';
import {OCTOBER_WEEKEND_SPECIAL_SALES as policies,calculateOctoberWeekendSale,calculateOctoberWeekendHomeBonus} from '../src/octoberWeekendPolicy.js';
import {MOBILE_PLANS} from '../src/mobilePlans.js';
import {specialSalesForDate,calculateMonthlySpecialSale,octoberQuality,octoberConfig} from '../src/octoberPolicy.js';
import {calculateHomePolicyFromOrders,buildHomeBundlesFromOrders,calculateMobileSale,createPolicySnapshot} from '../src/policyEngine.js';
const plan=key=>MOBILE_PLANS.find(p=>p.key===key);
test('all 17 weekend model/type supports, boundary dates, zero employee extra',()=>{
 assert.equal(policies.length,17);
 assert.deepEqual(policies.map(p=>p.customerDiscount),[0,0,0,350000,250000,350000,250000,350000,250000,400000,300000,400000,300000,400000,300000,300000,300000]);
 for(const p of policies){
  const args={policyKey:p.key,saleDate:'2026-10-02',saleType:p.saleType,planDetail:plan('general_115'),strategicPoints:2,vasKeys:['vasKyobo','vasPhonePass']};
  assert.equal(calculateMonthlySpecialSale(args).eligible,true);assert.equal(calculateMonthlySpecialSale({...args,saleDate:'2026-10-05'}).eligible,true);
  assert.equal(calculateMonthlySpecialSale(args).additionalAmount,0);
  for(const saleDate of ['2026-10-01','2026-10-06']){assert.equal(specialSalesForDate(saleDate).some(x=>x.key===p.key),false);assert.equal(calculateMonthlySpecialSale({...args,saleDate}).eligible,false);}
  assert.equal(calculateMonthlySpecialSale({...args,saleType:'SIM MNP'}).eligible,false);
 }
});
test('A176 exact plan types and named one-point VAS plus insurance; other models require actual high plan and 2P',()=>{
 const a=policies.find(p=>p.deviceModel==='A176'),high=policies.find(p=>p.deviceModel==='S942-256/512');
 const args={saleDate:'2026-10-02',saleType:a.saleType,vasKeys:['vasKyobo','vasPhonePass'],strategicPoints:0};
 for(const key of ['general_55','senior_47','junior_47'])assert.equal(calculateOctoberWeekendSale({...args,planDetail:plan(key)},a).eligible,true);
 for(const key of ['general_47','senior_44','junior_37'])assert.equal(calculateOctoberWeekendSale({...args,planDetail:plan(key)},a).eligible,false);
 for(const vasKeys of [['vasKyobo'],['vasVcolorMusic','vasPhonePass'],['vasNone'],[]])assert.equal(calculateOctoberWeekendSale({...args,planDetail:plan('general_55'),vasKeys},a).eligible,false);
 assert.equal(calculateOctoberWeekendSale({...args,planDetail:plan('general_55'),vasKeys:['vasVcolorBundle','vasSafePass']},a).eligible,true);
 const h={saleDate:'2026-10-02',saleType:high.saleType,strategicPoints:2};
 for(const key of ['general_115','general_130','junior_85'])assert.equal(calculateOctoberWeekendSale({...h,planDetail:plan(key)},high).eligible,true);
 for(const key of ['general_105','junior_75','senior_47'])assert.equal(calculateOctoberWeekendSale({...h,planDetail:plan(key)},high).eligible,false);
 assert.equal(calculateOctoberWeekendSale({...h,planDetail:plan('general_115'),strategicPoints:1.9},high).eligible,false);
});
const orders=(id,{date='2026-10-02',install='2026-10-20',network='household',speed='500',tv=true,tvPlan=network==='soho'?'premium':'broadcastPass'}={})=>[
 {id:`${id}-i`,customer_id:id,customer_name:id,product_type:`internet${speed}`,network_type:network,source_work_date:date,actual_install_date:install,status:'completed'},
 ...(tv?[{id:`${id}-t`,customer_id:id,customer_name:id,product_type:'homeTv',main_tv_plan:tvPlan,network_type:network,source_work_date:date,actual_install_date:install,status:'completed'}]:[]),
];
test('personal home 1/2/3 DPS pays 100k/300k/450k; SOHO paid, no extra count for set-top',()=>{
 const a=orders('a'),b=orders('b',{network:'soho'}),c=orders('c',{speed:'1g'});
 const calc=o=>calculateHomePolicyFromOrders(o,octoberConfig());
 assert.equal(calc(a).octoberWeekend.total,100000);assert.equal(calc([...a,...b]).octoberWeekend.total,300000);assert.equal(calc([...a,...b,...c]).octoberWeekend.total,450000);
 assert.equal(calc([...a,...b]).octoberWeekend.payouts[0].amount,150000);
 const setTop={...a[1],id:'sub',product_type:'subSetTop'};assert.equal(calc([...a,setTop]).octoberWeekend.count,1);
 assert.equal(calc([...a,...b]).limitedPolicyPay,300000);
 const baseline=calc([...orders('a',{date:'2026-10-01'}),...orders('b',{date:'2026-10-01',network:'soho'})]);
 assert.equal(calc([...a,...b]).total-baseline.total,300000);
});
test('home date/speed/TV/completion boundaries and cancellation reprice',()=>{
 for(const overrides of [{date:'2026-10-01'},{date:'2026-10-06'},{speed:'100'},{tv:false},{install:'2026-11-01'},{install:'2026-10-01'},{tvPlan:'belowPremium'}])assert.equal(calculateOctoberWeekendHomeBonus(buildHomeBundlesFromOrders(orders('x',overrides))).total,0);
 assert.equal(calculateOctoberWeekendHomeBonus(buildHomeBundlesFromOrders(orders('x',{date:'2026-10-05',install:'2026-10-31'}))).total,100000);
 const split=orders('x');split[1].actual_install_date='2026-11-01';assert.equal(calculateOctoberWeekendHomeBonus(buildHomeBundlesFromOrders(split)).total,0);
 const a=orders('a'),b=orders('b');b[1].status='cancelled';assert.equal(calculateHomePolicyFromOrders([...a,...b],octoberConfig()).octoberWeekend.total,100000);
});
test('unpaid weekend keeps activity/insurance points and monthly 115 60% quality bonuses',()=>{
 const config=octoberConfig(),meta={ri:1,ci:0,vasKeys:['vasKyobo','vasPhonePass'],specialPolicy:{policyType:'incentive_unpaid',policyId:policies[3].key,replacementAmount:0}};
 const value=calculateMobileSale({source_meta:meta},{matrixRates:config.matrix,vasRates:config.vas,bundleRates:config.bundle2nd});
 assert.equal(value.paid.plan,0);assert.equal(value.paid.vas,0);assert.equal(value.activityCount,1);assert.equal(value.insurancePoints,0.8);
 const matrix=Array.from({length:8},()=>Array(6).fill(0));matrix[1][0]=1;
 assert.equal(octoberQuality({matrix,strategicPoints:2}).plan115Bonus,10000);assert.equal(octoberQuality({matrix,strategicPoints:2}).amount,10000);
 assert.equal(octoberQuality({matrix,strategicPoints:2,homeNoPerformance:true}).plan115Bonus,5000);
});
