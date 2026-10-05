import {getMobilePlan} from './mobilePlans.js';
export const LONG_STOCK_START='2026-10-01';
const rows=[
 ['f946_black','F946-256 정상 재고 (블랙)',700000,700000,'high'],
 ['f946_dp','F946-256 DP재고 (크림)',1300000,1300000,'high'],
 ['a165','A165N-UM',150000,null,'kids'],
 ['a346','A346 DP재고 (박스 없음)',250000,250000,'any'],
 ['iphone14pro','아이폰14프로 512 · 2890',900000,600000,'high'],
 ['iphone15','아이폰15 128 · 3090',700000,250000,'high'],
 ['iphone15pro','아이폰15프로 128/256 · 3102',500000,300000,'high'],
 ['iphone15plus','아이폰15플러스 256 · 3094',500000,300000,'high'],
];
export const LONG_STOCK_SPECIAL_SALES=rows.flatMap(([id,model,mnp,change,rule])=>
 (rule==='kids'?[['010 신규',mnp]]:rule==='any'?[['010 신규',mnp],['MNP',mnp],['기기변경',change]]:[['MNP',mnp],['기기변경',change]])
 .map(([saleType,additionalAmount],i)=>({key:`stock_${id}_${i}`,model:`장기재고 · ${model}`,saleType,additionalAmount,stock:true,stockRule:rule,
 startDate:LONG_STOCK_START,endDate:'2099-12-31',policyVersion:'2026-10-stock',
 conditionLabel:`미소 보유 재고만 · ${rule==='high'?'MNP85군/기변95군 이상':rule==='kids'?'주니어28군 이상':'요금제 무관'} · 보험 + 교보 sam 또는 V컬러링 패키지 · 기존 유지 조건`})));
LONG_STOCK_SPECIAL_SALES.push(...[['free',100000,'무료판매'],['normal',350000,'일반판매']].map(([kind,additionalAmount,label])=>({key:`stock_r825_${kind}`,model:`장기재고 · R825FA ${label}`,saleType:'2ND',additionalAmount,stock:true,stockRule:'watch',startDate:LONG_STOCK_START,endDate:'2099-12-31',policyVersion:'2026-10-stock',conditionLabel:'미소 보유 재고 · 보험 가입 · 기존 2ND 수수료 대체 · 임의 가입 고리표 발생 시 전액 환수 · 기존 유지 조건'})));
export function calculateLongStockSale(args,policy){
 const plan=getMobilePlan(args.planDetail),level=Number(plan?.key.split('_')[1]||0),keys=new Set(args.vasKeys||[]);
 const dateEligible=args.saleDate>=LONG_STOCK_START&&args.saleDate<=policy.endDate;
 const typeEligible=args.saleType===policy.saleType;
 const planEligible=policy.stockRule==='watch'||!!plan&&(policy.stockRule==='any'||policy.stockRule==='kids'&&plan.type==='junior'&&level>=28||policy.stockRule==='high'&&level>=(args.saleType==='MNP'?85:95));
 const insuranceEligible=keys.has('vasPhonePass')||keys.has('vasSafePass');
 const vasEligible=policy.stockRule==='watch'||keys.has('vasKyobo')||keys.has('vasVcolorBundle');
 const eligible=dateEligible&&typeEligible&&planEligible&&insuranceEligible&&vasEligible;
 return {policy,dateEligible,typeEligible,planEligible,insuranceEligible,vasEligible,pointEligible:vasEligible,eligible,additionalAmount:eligible?policy.additionalAmount:0};
}
export function r825Payout({saleType='normal',insuranceJoined=false}={}){
 return insuranceJoined?(['free','discount'].includes(saleType)?100000:350000):0;
}
