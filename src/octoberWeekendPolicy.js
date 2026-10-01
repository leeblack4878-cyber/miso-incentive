import {getMobilePlan} from './mobilePlans.js';
export const OCTOBER_WEEKEND_START='2026-10-02';
export const OCTOBER_WEEKEND_END='2026-10-05';
const rows=[
 ...['010 신규','MNP','기기변경'].map(type=>['A176',type,0]),
 ...['S942-256/512','S947-256/512','S948-256/512'].flatMap(model=>[[model,'MNP',350000],[model,'기기변경',250000]]),
 ...['F776-512','F971-256','F976-256'].flatMap(model=>[[model,'MNP',400000],[model,'기기변경',300000]]),
 ['S741','MNP',300000],['S741','기기변경',300000],
];
export const OCTOBER_WEEKEND_SPECIAL_SALES=rows.map(([model,saleType,customerDiscount],i)=>({
 key:`oct_weekend_${i}`,model:`10/2~5 주말 · ${model}`,deviceModel:model,saleType,customerDiscount,
 customerZeroPrice:model==='A176',additionalAmount:0,policyType:'incentive_unpaid',
 requiredStrategicPoints:model==='A176'?null:2,startDate:OCTOBER_WEEKEND_START,endDate:OCTOBER_WEEKEND_END,
 policyVersion:'2026-10-02-weekend',weekend:true,
 conditionLabel:model==='A176'?'일반55군 이상 · 시니어/주니어47군 이상 · 교보 sam 또는 V컬러링 패키지 + 보험':'115군 이상(주니어85군 인정) · 전략P 2P 이상',
}));
export function calculateOctoberWeekendSale(args={},policy){
 const plan=getMobilePlan(args.planDetail),level=Number(plan?.key.split('_')[1]||0);
 const dateEligible=args.saleDate>=OCTOBER_WEEKEND_START&&args.saleDate<=OCTOBER_WEEKEND_END;
 const typeEligible=args.saleType===policy.saleType;
 const a176=policy.deviceModel==='A176';
 const planEligible=!!plan&&(a176?level>=(plan.type==='general'?55:47):(plan.type==='general'&&level>=115||plan.type==='junior'&&level>=85));
 const keys=new Set(args.vasKeys||[]);
 const vasEligible=!a176||keys.has('vasKyobo')||keys.has('vasVcolorBundle');
 const insuranceEligible=!a176||keys.has('vasPhonePass')||keys.has('vasSafePass');
 const pointEligible=a176||Number(args.strategicPoints||0)>=2;
 return {policy,dateEligible,typeEligible,planEligible,pointEligible,vasEligible,insuranceEligible,
 eligible:dateEligible&&typeEligible&&planEligible&&pointEligible&&vasEligible&&insuranceEligible,additionalAmount:0};
}
// One internet + main TV bundle is one DPS. Both required installations must
// finish in October. Helpers are called with one employee's completed orders.
export function calculateOctoberWeekendHomeBonus(bundles=[]){
 const eligible=bundles.filter(b=>b.date>=OCTOBER_WEEKEND_START&&b.date<=OCTOBER_WEEKEND_END
  &&b.hasInternet&&['500','1g'].includes(b.speed)&&b.hasTv
  &&(b.networkType==='household'&&['broadcastPass','premium'].includes(b.mainTvPlan)||b.networkType==='soho'&&b.mainTvPlan==='premium')
  &&b.orders?.filter(o=>['internet500','internet1g','homeTv'].includes(o.product_type)).every(o=>{
   const date=String(o.actual_install_date||'').slice(0,10);return o.status==='completed'&&date>=b.date&&date<='2026-10-31';
  }));
 const count=eligible.length,rate=count>=2?150000:count?100000:0;
 return {count,rate,total:count*rate,payouts:eligible.map(b=>({date:b.date,customer:b.customer,amount:rate}))};
}
