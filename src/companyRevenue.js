import {getMobilePlan} from './mobilePlans.js';
import {PRIMARY_PERMISSION_ADMIN_ID} from './permissionScopes.js';

// Owner-confirmed company revenue, independent of employee commission policies.
export const COMPANY_BASE_FEE=22000;
export const COMPANY_PLAN_FEES=Object.freeze({130:154000,115:154000,105:143000,95:132000,85:121000,75:88000,70:44000,61:22000});
export const canViewCompanyRevenue=id=>id===PRIMARY_PERMISSION_ADMIN_ID;
export const COMPANY_REVENUE_START_MONTH='2026-10';
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
 const result={count:0,base:0,plan:0,sim:0,total:0,pending:0,reasons:{},rows:[],unclassified:0},seen=new Set();
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
  const fee=companyPlanFee(meta),pendingCount=second?count:(fee.pending?1:0)+bundles;
  result.count+=count;result.base+=count*COMPANY_BASE_FEE;if(meta.ri===5)result.sim+=fee.amount;else result.plan+=fee.amount;result.pending+=pendingCount;
  if(fee.pending)result.reasons[fee.pending]=(result.reasons[fee.pending]||0)+(second?count:1);
  if(!second&&bundles)result.reasons['2ND 추가 수수료 미설정']=(result.reasons['2ND 추가 수수료 미설정']||0)+bundles;
  result.rows.push({id:sale.id,date:sale.sale_date,count,base:count*COMPANY_BASE_FEE,plan:fee.amount,total:count*COMPANY_BASE_FEE+fee.amount,pending:pendingCount});
 }
 result.total=result.base+result.plan+result.sim;return result;
}
