import {getMobilePlan} from './mobilePlans.js';
export const NOVEMBER_POLICY_VERSION='2026-11-v1';
export const NOVEMBER_START='2026-11-01';
export const isNovemberBundle=key=>String(key).endsWith('_1101');
export const NOVEMBER_BUNDLES=[['L335',200000],['X216',200000],['X236',100000],['X236NP',150000],['L505',150000],['L345',100000],['L355',100000],['L715',200000],['AppleWatch',100000],['AppleWatch11_12',100000],['AppleWatchUltra3_4',100000],['iPadUIDA16',100000]].map(([model,rate])=>({key:`b_${model}_1101`,rate,label:`2ND · ${{AppleWatch:'애플워치 SE3 40/44mm',AppleWatch11_12:'애플워치 11~12',AppleWatchUltra3_4:'애플워치 울트라 3~4',iPadUIDA16:'아이패드 UIDA16',X236NP:'X236-NP'}[model]||model}`}));
const models=[['S942-256/512',160000,70000],['S947-256/512',100000,0],['S948-256/512',140000,50000],['F776-256',140000,50000],['F776-512',180000,90000],['F971-256',160000,70000],['F971-512',100000,0],['F976-256',140000,50000],['F976-512',180000,90000],['아이폰17',100000,0],['아이폰18류',100000,0],['S741',120000,70000],['A176',60000,30000]];
const definition=(key,model,saleType,additionalAmount,extra={})=>({key,model,saleType,additionalAmount,startDate:NOVEMBER_START,endDate:'2099-12-31',policyVersion:NOVEMBER_POLICY_VERSION,november:true,requiredStrategicPoints:2,...extra});
export const NOVEMBER_SPECIAL_SALES=models.flatMap(([model,mnp,change],i)=>[['MNP',mnp],['기기변경',change]].filter(([,amount])=>amount>0).map(([type,amount],j)=>definition(`nov_model_${i}_${j}`,model,type,amount,{conditionLabel:model==='A176'?'요금제 무관 · 전략2P · 홈 무성과50% · 기변C 추가금 감액없음':'115군/청소년85군 정상 · 일반85~105군50% · 전략2P · 홈 무성과50% · 기변C 추가금 감액없음'})));
const stock=[['a165','A165N-UM',150000,null,'kids'],['iphone14pro','아이폰14프로 512 · 2890',900000,600000,'high85'],['iphone15plus','아이폰15플러스 256 · 3094',500000,300000,'high85'],['iphone16plus_demo','아이폰16플러스 데모폰 128GB',300000,200000,'high85']];
export const NOVEMBER_STOCK_SALES=stock.flatMap(([id,model,mnp,change,stockRule])=>(stockRule==='kids'?[['010 신규',mnp]]:[['MNP',mnp],['기기변경',change]]).map(([type,amount],i)=>definition(`nov_stock_${id}_${i}`,`장기재고 · ${model}`,type,amount,{stock:true,stockRule,conditionLabel:`미소 보유 재고 · ${stockRule==='kids'?'주니어28군 이상':'85군 이상'} · 보험+지정 전략VAS · 추가금은 홈/C 감액 제외`})));
NOVEMBER_STOCK_SALES.push(...[['free',100000,'무료'],['normal',350000,'일반']].map(([id,amount,label])=>definition(`nov_stock_r825_${id}`,`장기재고 · R825FA ${label}`, '2ND',amount,{stock:true,stockRule:'watch',conditionLabel:'미소 보유 재고 · 보험 필수 · 추가금은 홈/C 감액 제외 · 임의 가입 고리표 발생 시 전액 환수'})));
export function calculateNovemberSale(args={},policy){
 const plan=getMobilePlan(args.planDetail),tier=Number(plan?.key.split('_')[1]||0),keys=new Set(args.vasKeys||[]),stock=!!policy.stock;
 const dateEligible=args.saleDate>=policy.startDate&&args.saleDate<=policy.endDate,typeEligible=args.saleType===policy.saleType;
 const planEligible=stock?(policy.stockRule==='watch'||!!plan&&(policy.stockRule==='kids'?plan.type==='junior'&&tier>=28:tier>=85)):!!plan&&(policy.model==='A176'||plan.type==='general'&&tier>=85||plan.type==='junior'&&tier>=85);
 const insuranceEligible=!stock||keys.has('vasPhonePass')||keys.has('vasSafePass');
 const vasEligible=!stock||policy.stockRule==='watch'||keys.has('vasKyobo')||keys.has('vasVcolorBundle');
 const pointEligible=stock||Number(args.strategicPoints||0)>=2;
 const eligible=dateEligible&&typeEligible&&planEligible&&insuranceEligible&&vasEligible&&pointEligible;
 const factor=!stock&&policy.model!=='A176'&&plan?.type==='general'&&tier<115 ? 0.5 : 1;
 return {policy,dateEligible,typeEligible,planEligible,insuranceEligible,vasEligible,pointEligible,eligible,additionalAmount:eligible?policy.additionalAmount*factor:0};
}
// Signed difference from the month matrix; never modify historical matrix columns.
export function novemberBaseAdjustment(meta={},matrixRate=0){
 if(!Number.isInteger(meta.ri)||meta.ri<0||meta.ri>5||meta.secondOnlyBundle)return 0;
 let amount=Number(matrixRate||0);
 if(meta.baseModel==='M140')amount=10000;
 else if(['A176','A185'].includes(meta.baseModel)&&meta.ri===4)amount=Number(matrixRate||0)*.6; // matrix C=50%; these two models=30% of A/B
 if(meta.foreigner&&[1,5].includes(meta.ri)&&meta.baseModel!=='M140')amount+=20000;
 return amount-Number(matrixRate||0);
}
export function novemberConfig(october={}){
 return {...october,policyVersion:NOVEMBER_POLICY_VERSION,bundle2nd:[...NOVEMBER_BUNDLES,...(october.bundle2nd||[])],
  mnpBundle:(october.mnpBundle||[]).map(x=>({...x,rate:100000}))};
}
export function novemberStockBundlePay(meta={}){
 if(!(meta.bundle2ndKeys||[]).includes('b_R825FA'))return 0;
 const insured=(meta.bundleVasMap?.b_R825FA||[]).some(k=>['vasPhonePass','vasSafePass'].includes(k));
 return insured?(['free','discount'].includes(meta.bundleSaleTypeMap?.b_R825FA)?100000:350000):0;
}
