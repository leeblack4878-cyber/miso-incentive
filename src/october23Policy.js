import {getMobilePlan} from './mobilePlans.js';
export const OCTOBER23_START='2026-10-23',OCTOBER23_END='2026-10-26';
export const inOctober23=date=>date>=OCTOBER23_START&&date<=OCTOBER23_END;
const rates=[['S942-256/512',200000,100000],['S947-256/512',200000,100000],['S948-256/512',200000,100000],['F776-256',200000,100000],['F776-512',300000,200000],['F971-256',200000,100000],['F971-512',50000,0],['F976-256',200000,100000],['F976-512',300000,200000],['S741',200000,100000],['A176',50000,30000]];
export const OCTOBER23_MODEL_SALES=rates.flatMap(([model,mnp,change],i)=>[['MNP',mnp],['기기변경',change]].map(([saleType,additionalAmount],j)=>({key:`oct23_model_${i}_${j}`,model,saleType,additionalAmount,startDate:OCTOBER23_START,endDate:'2099-12-31',policyVersion:'2026-10-23-model',revision16:true,revision23:true,requiredStrategicPoints:model==='A176'?1.8:2,conditionLabel:model==='A176'?'요금제 무관 · 보험+지정전략VAS · 전략1.8P 이상 · 93일 유지':'115군(청소년85 인정) · 전략2P · 기변C 추가금 -5만원 · 93일 유지'})));
const supports=[['A176',0,0],['S942-256/512',400000,300000],['F971-256',400000,300000],['S741',400000,300000],['S947-256/512',350000,250000],['S948-256/512',350000,250000],['F776-512',450000,350000],['F976-512',450000,350000],['F776-256',300000,200000],['F976-256',300000,200000],['F971-512',250000,150000]];
export const OCTOBER23_WEEKEND_SALES=supports.flatMap(([deviceModel,mnp,change],i)=>[['MNP',mnp],['기기변경',change]].map(([saleType,customerDiscount],j)=>({key:`oct23_weekend_${i}_${j}`,model:`10/23~26 주말 · ${deviceModel}`,deviceModel,saleType,customerDiscount,customerZeroPrice:deviceModel==='A176',additionalAmount:0,policyType:deviceModel==='A176'?'incentive_unpaid':'additive',weekend:true,revision23:true,startDate:OCTOBER23_START,endDate:OCTOBER23_END,policyVersion:'2026-10-23-weekend',conditionLabel:deviceModel==='A176'?'일반55군/주니어·시니어47군 이상 · 보험+지정전략VAS1P · 직원 수수료 미지급 · 요금제6개월/보험VAS93일':'115군(청소년85 인정) · 전략2P · 직원 요금제·VAS 정상 지급 · 고객 지원금은 직원 지급액 아님 · 요금제6개월/전략93일'})));
export function calculateOctober23Sale(args={},policy){
 const plan=getMobilePlan(args.planDetail),tier=Number(plan?.key.split('_')[1]||0),keys=new Set(args.vasKeys||[]),buddy=(policy.deviceModel||policy.model)==='A176';
 const dateEligible=args.saleDate>=policy.startDate&&args.saleDate<=policy.endDate,typeEligible=args.saleType===policy.saleType;
 const planEligible=buddy&&!policy.weekend?!!plan:!!plan&&(buddy?tier>=(plan.type==='general'?55:47):plan.type==='general'&&tier>=115||plan.type==='junior'&&tier>=85);
 const insuranceEligible=!buddy||keys.has('vasPhonePass')||keys.has('vasSafePass'),vasEligible=!buddy||keys.has('vasKyobo')||keys.has('vasVcolorBundle');
 const pointEligible=Number(args.strategicPoints||0)>=(buddy?1.8:2),eligible=dateEligible&&typeEligible&&planEligible&&insuranceEligible&&vasEligible&&pointEligible;
 return {policy,dateEligible,typeEligible,planEligible,insuranceEligible,vasEligible,pointEligible,eligible,additionalAmount:eligible?Math.max(0,policy.additionalAmount-(!policy.weekend&&args.saleType==='기기변경'&&Number(args.ri)===4?50000:0)):0,customerDiscount:Math.max(0,Number(policy.customerDiscount||0)-(policy.weekend&&!buddy&&Number(args.ri)===4?50000:0))};
}
export function october23SimEligible(meta={},date){return inOctober23(date)&&Number(meta.ri)===5&&!meta.teamOnly&&!meta.secondOnlyBundle&&!meta.deleted&&!meta.cancelled&&meta.simMnpPolicyEligible===true&&!!getMobilePlan(meta.planDetail);}
export function october23SimBonus(count=0){const rate=count>=3?50000:count>=2?40000:count?30000:0;return {count,rate,amount:count*rate};}
export function october23HomeBonus(bundles=[]){
 const installed=(b,types)=>b.orders.filter(o=>types.includes(o.product_type)).every(o=>o.status==='completed'&&String(o.actual_install_date||'').slice(0,10)>=b.date&&String(o.actual_install_date||'').slice(0,10)<='2026-10-31');
 const eligible=bundles.filter(b=>inOctober23(b.date)&&b.hasInternet&&['500','1g'].includes(b.speed)&&b.hasTv&&(b.networkType==='soho'?b.mainTvPlan==='premium':['broadcastPass','premium'].includes(b.mainTvPlan))&&installed(b,['internet500','internet1g','homeTv']));
 const count=eligible.length,rate=count>=2?150000:count?100000:0,mnpCount=eligible.filter(b=>b.simul==='mnp').length;
 const free=bundles.filter(b=>inOctober23(b.date)&&b.networkType==='household'&&b.types.has('tvFree')&&installed(b,['tvFree']));
 const tvFreeCount=free.length,tvFreeRate=tvFreeCount>=4?50000:tvFreeCount>=2?30000:tvFreeCount?20000:0;
 return {count,rate,mnpCount,tvFreeCount,tvFreeRate,total:count*rate+mnpCount*50000+tvFreeCount*tvFreeRate,payouts:[...eligible.map(b=>({date:b.date,customer:b.customer,amount:rate+(b.simul==='mnp'?50000:0)})),...free.map(b=>({date:b.date,customer:b.customer,amount:tvFreeRate}))]};
}
