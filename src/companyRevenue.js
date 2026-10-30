import {companyBundleRevenue} from './companyBundleRevenue.js';
import {getMobilePlan} from './mobilePlans.js';
import {PRIMARY_PERMISSION_ADMIN_ID} from './permissionScopes.js';

// Owner-confirmed company revenue, independent of employee commission policies.
export const COMPANY_BASE_FEE=22000;
export const COMPANY_PLAN_FEES=Object.freeze({130:154000,115:154000,105:143000,95:132000,85:121000,75:88000,70:44000,61:22000});
export const canViewCompanyRevenue=id=>id===PRIMARY_PERMISSION_ADMIN_ID;
export const COMPANY_REVENUE_START_MONTH='2026-10';
// October notice: VAT included. Only products already recorded by staff are mapped.
export const COMPANY_VAS_FEES=Object.freeze({
 vasKyobo:19800,vasCallConvenience:6600,vasDualNumber:3850,vasDesignatedNumber:2200,
 vasBellMoya:2200,vasBellAiGreeting:2750,vasBellAiCharacter:4700,
 vasVcolorBasic:3300,vasVcolorMusic:8800,vasVcolorBundle:19800,vasVprofile:3300,
});
export function companyVasFee(meta={}){
 // HS only: SIM, used devices and second lines are outside this notice.
 if(!Number.isInteger(meta.ri)||meta.ri<0||meta.ri>4||meta.secondOnlyBundle)return 0;
 const keys=new Set((Array.isArray(meta.vasKeys)?meta.vasKeys:[]).map(k=>k==='vasVcolor'?'vasVcolorBundle':k));
 // Package constituents cannot earn another fee under the same package.
 if(keys.has('vasVcolorBundle')){keys.delete('vasVcolorMusic');keys.delete('vasBellMoya');}
 if(keys.has('vasCallConvenience')){keys.delete('vasDualNumber');keys.delete('vasDesignatedNumber');}
 return [...keys].reduce((sum,key)=>sum+(COMPANY_VAS_FEES[key]||0),0);
}
export function companyPlanFee(meta={}){
 if(meta.ri===7||meta.secondOnlyBundle)return {amount:0,pending:'2ND 추가 수수료 미설정'};
 const plan=getMobilePlan(meta.planDetail);
 if(!plan)return {amount:0,pending:'요금제 미입력'};
 const tier=Number(plan.key.split('_')[1]);
 // ri5 is the app's SIM MNP(선약) category; its company fee replaces normal plan fees.
 if(meta.ri===5){
  const amount=plan.type==='junior'?(tier===85?198000:[61,70,75].includes(tier)?143000:99000)
   :plan.type==='senior'?(tier===47?99000:0)
   :[85,95,105,115,130].includes(tier)?198000:[61,70,75].includes(tier)?143000:[33,37,44,47,55].includes(tier)?99000:0;
  return {amount,pending:null};
 }
 if(plan.type==='junior')return {amount:tier===85?143000:tier>=44?66000:22000,pending:null};
 if(plan.type==='senior')return {amount:[61,47,44].includes(tier)?66000:[37,33].includes(tier)&&meta.ri===1?22000:0,pending:null};
 if(COMPANY_PLAN_FEES[tier]!==undefined)return {amount:COMPANY_PLAN_FEES[tier],pending:null};
 return {amount:tier>=33&&meta.ri===1?22000:0,pending:null};
}
export function summarizeCompanyRevenue(sales=[],month){
 const result={count:0,base:0,secondBase:0,plan:0,sim:0,vas:0,bundle:0,total:0,pending:0,reasons:{},rows:[],unclassified:0},seen=new Set();
 result.supported=typeof month==='string'&&/^\d{4}-\d{2}$/.test(month)&&month>=COMPANY_REVENUE_START_MONTH;
 if(!result.supported)return result;
 for(const sale of sales){
  if(!['mobile','daily'].includes(sale.source_type)||sale.deleted||['cancelled','deleted'].includes(sale.status)||!sale.sale_date?.startsWith(`${month}-`))continue;
  if(sale.id&&seen.has(sale.id))continue;
  const meta=sale.source_meta||{};
  if(!Number.isInteger(meta.ri)||meta.ri<0||meta.ri>7){result.unclassified++;continue;}
  if(sale.id)seen.add(sale.id);
  const bundles=new Set(Array.isArray(meta.bundle2ndKeys)?meta.bundle2ndKeys:[]).size;
  // Standalone/follow-up bundle has one selected child represented by bundle keys.
  const second=meta.ri===7||meta.secondOnlyBundle;
  const count=second?Math.max(1,bundles):1+bundles;
  result.secondBase+=(second?count:bundles)*COMPANY_BASE_FEE;
  const vas=companyVasFee(meta);result.vas+=vas;
  const bundle=companyBundleRevenue(sale,sales);result.bundle+=bundle.amount;
  const fee=second?{amount:0,pending:null}:companyPlanFee(meta),pendingCount=(fee.pending?1:0)+bundle.pending;
  result.count+=count;result.base+=count*COMPANY_BASE_FEE;if(meta.ri===5)result.sim+=fee.amount;else result.plan+=fee.amount;result.pending+=pendingCount;
  if(fee.pending)result.reasons[fee.pending]=(result.reasons[fee.pending]||0)+(second?count:1);
  for(const reason of bundle.reasons)result.reasons[reason]=(result.reasons[reason]||0)+1;
  result.rows.push({id:sale.id,date:sale.sale_date,count,base:count*COMPANY_BASE_FEE,plan:fee.amount,vas,bundle:bundle.amount,total:count*COMPANY_BASE_FEE+fee.amount+vas+bundle.amount,pending:pendingCount});
 }
 result.total=result.base+result.plan+result.sim+result.vas+result.bundle;return result;
}
