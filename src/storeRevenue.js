import {COMPANY_SCOPE_VIEWERS} from './permissionScopes.js';
import {summarizeCompanyRevenue} from './companyRevenue.js';
import {summarizeCompanyHomeRevenue} from './companyHomeRevenue.js';
import {structureProjectionFromRecords} from './companyStructureProjection.js';
export const canViewStoreRevenue=id=>COMPANY_SCOPE_VIEWERS.has(id);
export function summarizeStoreRevenue({sales=[],orders=[],daily=[],profiles=[],stores=[],month,changeSupportRatio}={}){
 const roster=new Map(profiles.map(p=>[p.id,p.store_name||p.branch]));
 const monthSales=sales.filter(s=>s.sale_date?.startsWith(`${month}-`)&&!s.deleted&&!s.source_meta?.deleted&&!s.source_meta?.cancelled&&!['cancelled','deleted'].includes(s.status));
 const monthOrders=orders.filter(o=>o.status==='completed'&&o.actual_install_date?.startsWith(`${month}-`));
 const projection=structureProjectionFromRecords({sales:monthSales,orders:monthOrders,daily,month,changeSupportRatio}),policy=projection.current;
 const groups=new Map(stores.filter(s=>typeof s==='string').map(store=>[store,{sales:[],orders:[],daily:[]}]));
 const salesByOrder=new Map(sales.filter(s=>s.source_type==='home_order').map(s=>[String(s.source_ref),s]));
 const branch=(record,meta=record.source_meta||{})=>meta.teamOnly?(meta.creditedStore||'매장 미확인'):(roster.get(record.user_id)||'매장 미확인');
 const group=name=>{if(!groups.has(name))groups.set(name,{sales:[],orders:[],daily:[]});return groups.get(name);};
 for(const s of sales)group(branch(s)).sales.push(s);
 for(const o of orders){const s=salesByOrder.get(String(o.id));group(branch(o,s?.source_meta||{})).orders.push(o);}
 for(const d of daily)group(branch(d)).daily.push(d);
 const rows=[];
 for(const [store,data] of groups){
  const mobile=summarizeCompanyRevenue(data.sales,month),home=summarizeCompanyHomeRevenue(data.orders,sales,month);
  const local=structureProjectionFromRecords({sales:data.sales.filter(s=>monthSales.includes(s)),orders:data.orders.filter(o=>monthOrders.includes(o)),daily:data.daily,month,changeSupportRatio}).current;
  // Company-wide grade/rate, multiplied by each store's recognized source quantities.
  const awards={
   retailAward:local.award.mnp*policy.award.rates.mnp+local.award.new010*policy.award.rates.new010+local.award.change*policy.award.rates.change,
   salesMetric:local.salesMetric.points*policy.salesMetric.pointRate,
   homeGrade:local.homeGrade.internet*policy.homeGrade.pointRate*policy.homeGrade.paymentRate,
   homeInternetRatio:local.homeInternetRatio.internet*policy.homeInternetRatio.pointRate*policy.homeInternetRatio.paymentRate,
   homeAward:local.homeAward.payableInternet*policy.homeAward.pointRate,
   iptvGrade:local.iptvGrade.points*policy.iptvGrade.pointRate,
  };
  const monthly=Object.values(awards).reduce((a,b)=>a+b,0);
  rows.push({store,mobile:mobile.total,home:home.total,monthly,awards,total:mobile.total+home.total+monthly,pending:mobile.pending+home.pending+mobile.unclassified,hs:local.retail.hs,internet:local.homeGrade.internet});
 }
 const assignedMonthly=rows.reduce((n,r)=>n+r.monthly,0);
 const companyMonthly=['award','salesMetric','homeGrade','homeInternetRatio','homeAward','iptvGrade'].reduce((n,k)=>n+policy[k].totalAmount,0);
 const common={selfStore:policy.selfStore.totalAmount,retail:policy.retail.totalAmount,monthlyReconciliation:companyMonthly-assignedMonthly};
 const commonTotal=common.selfStore+common.retail+common.monthlyReconciliation;
 return {ratioMissing:changeSupportRatio===null||changeSupportRatio===undefined,rows:rows.sort((a,b)=>b.total-a.total||a.store.localeCompare(b.store,'ko')),common,commonTotal,policy,projection,total:rows.reduce((n,r)=>n+r.total,0)+commonTotal};
}
