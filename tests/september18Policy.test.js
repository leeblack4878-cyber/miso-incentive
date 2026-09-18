import test from 'node:test';
import assert from 'node:assert/strict';
import {SEPTEMBER_SPECIAL_SALES, SEPTEMBER_MATRIX, SEPTEMBER_VAS, calculateSeptemberSpecialSale, septemberMobileSaleType} from '../src/septemberPolicy.js';
import {enrichHomeOrdersForPolicy,calculateHomePolicyFromOrders,createPolicySnapshot,calculateMobileSale,specialPolicyLedgerRows} from '../src/policyEngine.js';
const active=(date)=>SEPTEMBER_SPECIAL_SALES.filter(p=>p.startDate<=date&&p.endDate>=date);
const extra=(policy,date='2026-09-18',overrides={})=>calculateSeptemberSpecialSale({policyKey:policy.key,saleDate:date,saleType:policy.saleType,planGroup:policy.planRule==='junior'?'junior':policy.planRule==='33plus'?'33plus':'115',strategicPoints:2,...overrides});

test('9/18 공지의 모든 모델·가입구분 추가지급액과 9/17 과거 금액을 검증한다',()=>{
 const expected=[['S26-256/512','MNP',100000],['S26-256/512','기기변경',100000],['S26+ 256/512','MNP',80000],['S26+ 256/512','기기변경',80000],['S26울트라 256/512','MNP',50000],['S26울트라 256/512','기기변경',80000],['S937','MNP',100000],['S937','010 신규',50000],['S937','기기변경',100000],['F776-256/512','MNP',50000],['F776-256/512','기기변경',50000],['F971-256','MNP',100000],['F971-256','기기변경',100000],['F976-256/512','MNP',50000],['F976-256/512','기기변경',50000],['A175-M2','010 신규',50000],['A176','MNP',0]];
 for(const [model,type,amount] of expected){
  const matches=active('2026-09-18').filter(p=>p.model===model&&p.saleType===type);
  assert.equal(matches.length,1,`${model} ${type}`);
  assert.equal(extra(matches[0]).additionalAmount,amount,`${model} ${type}`);
 }
 for(const p of active('2026-09-17').filter(p=>['S26-256/512','S26+ 256/512','F971-256'].includes(p.model)))assert.equal(extra(p,'2026-09-17').additionalAmount,50000);
 for(const p of active('2026-09-17').filter(p=>p.model==='F976-256/512'))assert.equal(extra(p,'2026-09-17').additionalAmount,0);
 for(const p of active('2026-09-18').filter(p=>p.model==='F971-512'))assert.equal(extra(p).additionalAmount,50000);
 const revision=active('2026-09-18').find(p=>p.model==='S26-256/512');
 assert.equal(extra(revision,'2026-09-17').eligible,false);
 assert.equal(extra(revision,undefined,{strategicPoints:1.9}).additionalAmount,0);
 assert.equal(extra(revision,undefined,{planGroup:'85'}).additionalAmount,0);
 assert.equal(extra(revision,undefined,{saleType:'010 신규'}).additionalAmount,0);
 assert.equal(extra(revision,undefined,{planGroup:'youth85'}).additionalAmount,100000);
});

test('아이폰18은 사전예약 9/18~21 MNP/기변 조건과 할인액을 구분하고 직원 요금제·VAS를 미지급한다',()=>{
 for(const p of SEPTEMBER_SPECIAL_SALES.filter(p=>p.policyType==='incentive_unpaid')){
  assert.equal(p.customerDiscount,p.saleType==='MNP'?300000:150000);
  for(const date of ['2026-09-18','2026-09-21'])assert.equal(extra(p,date).eligible,true);
  for(const date of ['2026-09-17','2026-09-22'])assert.equal(extra(p,date).eligible,false);
  for(const opts of [{planGroup:'85'},{strategicPoints:1.9},{saleType:'010 신규'}])assert.equal(extra(p,undefined,opts).eligible,false);
  assert.equal(extra(p).additionalAmount,0);
  const ri=p.saleType==='MNP'?1:2;
  assert.equal(septemberMobileSaleType(ri),p.saleType);
  const snap=createPolicySnapshot({matrixRates:SEPTEMBER_MATRIX,vasRates:SEPTEMBER_VAS,bundleRates:[{key:'watch',rate:150000}]});
  const result=calculateMobileSale({id:p.key,source_meta:{ri,ci:0,policySnapshot:snap,vasKeys:['vasKyobo','vasPhonePass'],bundle2ndKeys:['watch'],specialPolicy:{policyId:p.key,policyType:p.policyType,customerDiscount:p.customerDiscount,replacementAmount:0}}});
  assert.deepEqual(result.paid,{plan:0,vas:0,insurance:0,second:150000,spot:0});
  assert.equal(result.activityCount,2);
 }
});

function home(id,changes={}){
 const base={customer_id:id,customer_name:id,source_work_date:'2026-09-18',actual_install_date:'2026-09-30',status:'completed',network_type:'household',sale_type:'normal',...changes};
 return [{...base,id:`${id}-i`,product_type:changes.speed||'internet500'},{...base,id:`${id}-t`,product_type:'homeTv',main_tv_plan:changes.tvPlan||(base.network_type==='soho'?'premium':'broadcastPass')},...(changes.mnp?[{...base,id:`${id}-m`,product_type:'simulMnp'}]:[])];
}
function result(orders,plan='premiumSafe'){
 const sales=orders.map(o=>({source_ref:o.id,source_meta:{internetPlan:plan}}));
 return calculateHomePolicyFromOrders(enrichHomeOrdersForPolicy(orders,sales));
}
test('홈 주말 1건 10만원, 3건 전체 45만원, 소호 포함 등급과 가정망 MNP 추가를 계산한다',()=>{
 assert.equal(result(home('a')).limitedPolicyPay,100000);
 assert.equal(result([...home('a'),...home('b')]).limitedPolicyPay,200000);
 assert.equal(result([...home('a'),...home('b'),...home('c')]).limitedPolicyPay,450000);
 const mixed=result([...home('a',{mnp:true}),...home('b',{speed:'internet1g'}),...home('c',{network_type:'soho',mnp:true})]);
 const {payouts,...summary}=mixed.weekendPolicy.september18;
 assert.deepEqual(summary,{gradeCount:3,paidCount:2,rate:150000,baseBonus:300000,mnpCount:1,mnpBonus:100000,total:400000});
 assert.equal(result(home('g',{speed:'internet1g'})).limitedPolicyPay,100000);
 assert.equal(result(home('soho',{network_type:'soho',mnp:true})).limitedPolicyPay,0);
 assert.deepEqual(payouts.map(p=>[p.customer,p.amount]),[['a',250000],['b',150000]]);
 assert.equal(mixed.details.filter(x=>x.item==='9월 18~21일 주말 홈 활성화').reduce((sum,x)=>sum+x.amount,0),400000);
});
test('9월 말 설치·청약일·인터넷요금제·TV·상태 조건과 구성품 설치일을 확인한다',()=>{
 for(const changes of [{source_work_date:'2026-09-17'},{source_work_date:'2026-09-22'},{actual_install_date:'2026-10-01'},{actual_install_date:'2026-09-17'},{actual_install_date:null},{status:'pending'},{status:'cancelled'},{sale_type:'allinone'},{speed:'internet100'},{tvPlan:'premium'},{tvPlan:'belowPremium'},{network_type:'soho',tvPlan:'belowPremium'}])assert.equal(result(home('x',changes)).weekendPolicy.september18.total,0,JSON.stringify(changes));
 assert.equal(result(home('a'),'other').limitedPolicyPay,0);
 assert.equal(result(home('a'),null).limitedPolicyPay,0);
 const mixedDates=home('a');mixedDates[1].actual_install_date='2026-10-01';
 assert.equal(result(mixedDates).limitedPolicyPay,0);
 assert.equal(result(home('a',{source_work_date:'2026-09-21'})).limitedPolicyPay,100000);
 const old=home('old',{source_work_date:'2026-09-11',speed:'internet1g'});
 const combined=result([...old,...home('new')]);
 assert.equal(combined.weekendPolicy.homeBonus,150000);
 assert.equal(combined.weekendPolicy.september18.total,100000);
 assert.equal(combined.limitedPolicyPay,250000);
});
test('저장된 홈 원본 메타를 참조번호로 복원하고 원본을 변경하지 않는다',()=>{
 const orders=home('a'),sales=orders.map(o=>({source_ref:o.id,source_meta:{internetPlan:'premiumSafe'}}));
 const original=structuredClone(orders);
 const enriched=enrichHomeOrdersForPolicy(orders,JSON.parse(JSON.stringify(sales)));
 assert.equal(calculateHomePolicyFromOrders(enriched).limitedPolicyPay,100000);
 assert.deepEqual(orders,original);
 assert.equal(calculateHomePolicyFromOrders(enrichHomeOrdersForPolicy(orders,[])).limitedPolicyPay,0);
});

test('정산 상세도 추가지급은 기본 수수료를 유지하며 아이폰/일반 미지급은 요금제·VAS만 제외한다',()=>{
 const base=90000+30000;
 const additive=specialPolicyLedgerRows({policyId:'s26_256_512_mnp_0918',policyType:'additive',replacementAmount:100000,normalVasFee:30000},90000);
 assert.equal(base+additive.reduce((sum,r)=>sum+r.amount,0),220000);
 for(const policyId of [null,'iphone18_preorder_mnp_0918']){
  const rows=specialPolicyLedgerRows({policyId,policyType:'incentive_unpaid',normalVasFee:30000,customerDiscount:300000,replacementAmount:0},90000);
  assert.equal(base+rows.reduce((sum,r)=>sum+r.amount,0),0);
 }
});
