import test from 'node:test';
import assert from 'node:assert/strict';
import {OCTOBER_SPECIAL_SALES,octoberConfig,octoberQuality,specialSalesForDate,calculateMonthlySpecialSale} from '../src/octoberPolicy.js';
import {septemberConfig,calculateSeptemberBundleSale} from '../src/septemberPolicy.js';
import {resolvePolicyConfigForMonth,isPolicyInputBlocked} from '../src/policyCalendar.js';
import {calculateHomePolicyFromOrders,enrichHomeOrdersForPolicy} from '../src/policyEngine.js';

test('October 115 SIM MNP 90k; frozen September 80k; next month still locked',()=>{
 const september=resolvePolicyConfigForMonth('2026-09'),october=resolvePolicyConfigForMonth('2026-10');
 assert.equal(september.matrix[5][0],80000);assert.equal(october.matrix[5][0],90000);
 assert.deepEqual(october.matrix.slice(0,5),september.matrix.slice(0,5));
 assert.equal(isPolicyInputBlocked('2026-11',{loaded:true,readyMonths:['2026-10']}),true);
});
test('all 20 October model/type amounts, date boundary and eligibility',()=>{
 const expected=[[150000,100000],[150000,80000],[150000,80000],[150000,50000],[200000,100000],[200000,100000],[100000,30000],[150000,70000],[150000,70000],[100000,100000]].flat();
 assert.deepEqual(OCTOBER_SPECIAL_SALES.map(p=>p.additionalAmount),expected);
 for(const p of OCTOBER_SPECIAL_SALES){
  const args={policyKey:p.key,planGroup:'115',strategicPoints:2,saleDate:'2026-10-01',saleType:p.saleType};
  assert.equal(calculateMonthlySpecialSale(args).additionalAmount,p.additionalAmount);
  for(const override of [{saleDate:'2026-09-30'},{planGroup:'85'},{strategicPoints:1.9},{saleType:'010 신규'}])assert.equal(calculateMonthlySpecialSale({...args,...override}).additionalAmount,0);
  assert.equal(calculateMonthlySpecialSale({...args,planGroup:'youth85'}).eligible,true);
 }
 const old=specialSalesForDate('2026-09-30').find(p=>p.model==='F971-256'&&p.saleType==='MNP');
 assert.equal(old.additionalAmount,100000);
 assert.equal(calculateMonthlySpecialSale({policyKey:old.key,saleDate:'2026-10-01',planGroup:'115',strategicPoints:2}).eligible,false);
});
test('October 170% boundary, all SIM MNP demerit, 115 ratio and no-home halves positive pay',()=>{
 const matrix=Array.from({length:8},()=>Array(6).fill(0));matrix[0][0]=6;matrix[1][2]=4;matrix[5][0]=2;
 const q=p=>octoberQuality({matrix,strategicPoints:p});
 assert.equal(q(16.9).amount,-120000);assert.equal(q(17).amount,0);assert.equal(q(20).amount,100000);
 assert.equal(q(20).plan115Bonus,60000);
 const half=octoberQuality({matrix,strategicPoints:20,homeNoPerformance:true});
 assert.equal(half.amount,50000);assert.equal(half.plan115Bonus,30000);
 matrix[0][0]=5;matrix[1][2]=5;assert.equal(q(20).plan115Bonus,0);
});
test('Lite is still one smartHome order; 50k only in October, September normal 100k',()=>{
 const orders=[{id:'lite',customer_name:'A',product_type:'smartHome',source_work_date:'2026-10-01',status:'completed'}];
 const enriched=enrichHomeOrdersForPolicy(orders,[{source_ref:'lite',source_meta:{smartHomeKind:'lite'}}]);
 assert.equal(enriched[0].product_type,'smartHome');
 assert.equal(calculateHomePolicyFromOrders(enriched,octoberConfig()).smartHomePay,50000);
 assert.equal(calculateHomePolicyFromOrders(enriched,septemberConfig()).smartHomePay,100000);
 assert.equal(calculateHomePolicyFromOrders(orders,octoberConfig()).smartHomePay,100000);
});
test('Apple Watch insurance exemption and parent 115 requirement retained',()=>{
 const rate=octoberConfig().bundle2nd.find(p=>p.key==='b_AppleWatch').rate;
 assert.equal(calculateSeptemberBundleSale({rate,isAppleWatch:true,parent115:true,insuranceJoined:false}).paid,150000);
 assert.equal(calculateSeptemberBundleSale({rate,isAppleWatch:true,parent115:false,insuranceJoined:true}).paid,0);
});

test('confirmed dual-number correction uses October 0.3P with no direct fee and September retains 0.4P',()=>{
 const oct=octoberConfig().vas.find(v=>v.key==='vasDualNumber'),sep=septemberConfig().vas.find(v=>v.key==='vasDualNumber');
 assert.equal(oct.point,0.3);assert.equal(oct.rate,0);assert.equal(sep.point,0.4);assert.equal(sep.rate,0);
});
