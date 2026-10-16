import {getMobilePlan} from './mobilePlans.js';
export const OCTOBER16_START='2026-10-16';
export const OCTOBER16_END='2026-10-19';
export const isOctober16Date=date=>/^\d{4}-\d{2}-\d{2}$/.test(String(date))&&date>=OCTOBER16_START;
export const isOctober16Bundle=key=>String(key).endsWith('_1016');
export const isAppleBundle=key=>/^b_(AppleWatch|iPad)/.test(String(key));
export const OCTOBER16_BUNDLES=[
 ['L335',250000],['X216',200000],['X236',200000],['X236NP',250000],['L505',300000],['L345',300000],['L355',300000],['L715',250000],
 ['AppleWatch',200000],['AppleWatch11_12',200000],['AppleWatchUltra3_4',200000],['iPadUIDA16',200000],
].map(([model,rate])=>({key:`b_${model}_1016`,rate,label:`2ND · ${{X236NP:'X236-NP',L345:'L345(40mm)',L355:'L355(44mm)',AppleWatch:'애플워치 SE3 40/44mm',AppleWatch11_12:'애플워치 11~12',AppleWatchUltra3_4:'애플워치 울트라 3~4',iPadUIDA16:'아이패드 UIDA16'}[model]||model}`}));
export function bundleAvailableForDate(key,date){return isOctober16Bundle(key)?isOctober16Date(date):!isOctober16Date(date)||key==='b_R825FA';}
const amounts=[['S942-256/512',250000,200000],['S947-256/512',200000,150000],['S948-256/512',200000,150000],['F776-256',200000,150000],['F776-512',350000,300000],['F971-256',300000,250000],['F971-512',130000,80000],['F976-256',200000,150000],['F976-512',350000,300000],['S741',200000,200000]];
export const OCTOBER16_SPECIAL_SALES=amounts.flatMap(([model,mnp,change],i)=>[['MNP',mnp],['기기변경',change]].map(([saleType,additionalAmount],j)=>({key:`oct16_model_${i}_${j}`,model,saleType,additionalAmount,requiredStrategicPoints:2,startDate:OCTOBER16_START,endDate:'2099-12-31',policyVersion:'2026-10-16-v2',revision16:true,conditionLabel:'115군(청소년85 인정) · 전략2P · 기변C 추가금 -5만원 · 93일 유지'})));
export const OCTOBER16_BUDDY_SALES=['MNP','기기변경'].flatMap((saleType,i)=>[false,true].map(unpaid=>({key:`oct16_buddy_${i}_${unpaid?'free':'normal'}`,model:'10/16~19 · A176 버디5',saleType,additionalAmount:unpaid?0:i?40000:80000,policyType:unpaid?'incentive_unpaid':'additive',customerZeroPrice:unpaid,buddy16:true,revision16:true,startDate:OCTOBER16_START,endDate:OCTOBER16_END,policyVersion:'2026-10-16-buddy',conditionLabel:'55군 이상(고객유형 공통) · 요금제6개월 · 보험+전략VAS 1가지 · 1.8P↑ · 기변A~B만'})));
export function calculateOctober16Sale(args={},policy){
 const plan=getMobilePlan(args.planDetail),level=Number(plan?.key.split('_')[1]||0),keys=new Set(args.vasKeys||[]);
 const dateEligible=args.saleDate>=policy.startDate&&args.saleDate<=policy.endDate;
 const typeEligible=args.saleType===policy.saleType&&(!policy.buddy16||Number(args.ri)!==4);
 const planEligible=policy.buddy16?!!plan&&level>=55:args.planGroup==='115'||args.planGroup==='youth85';
 const insuranceEligible=!policy.buddy16||keys.has('vasPhonePass')||keys.has('vasSafePass');
 const vasEligible=!policy.buddy16||keys.has('vasKyobo')||keys.has('vasVcolorBundle');
 const pointEligible=Number(args.strategicPoints||0)>=(policy.buddy16?1.8:2);
 const eligible=dateEligible&&typeEligible&&planEligible&&insuranceEligible&&vasEligible&&pointEligible;
 const amount=Math.max(0,policy.additionalAmount-(!policy.buddy16&&args.saleType==='기기변경'&&Number(args.ri)===4?50000:0));
 return {policy,dateEligible,typeEligible,planEligible,insuranceEligible,vasEligible,pointEligible,eligible,additionalAmount:eligible?amount:0};
}
export function plan115Threshold(date){return isOctober16Date(date)?70:60;}
