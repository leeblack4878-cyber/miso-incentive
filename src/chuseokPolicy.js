import {septemberManagerStoreType} from './managerPolicyEngine.js';
export const CHUSEOK_MONTH='2026-09';
export function chuseokRate(count, thresholds, rates){
 let rate=0; thresholds.forEach((min,i)=>{if(Number(count)>=min)rate=rates[i];}); return rate;
}
export function chuseokMobileRate(count,store){
 return chuseokRate(count,septemberManagerStoreType(store)==='consignment'?[5,8,11,14]:[3,5,7,10],[10000,15000,20000,30000]);
}
export function chuseokPolicy(row){
 if(!row)return null;
 const mobileRate=chuseokMobileRate(row.store_mobile,row.store_name);
 const internetRate=chuseokRate(row.store_internet,[1,2,3,4],[50000,80000,100000,150000]);
 const tvRate=chuseokRate(row.store_tv,[1,3,5,7],[20000,25000,30000,40000]);
 const mobilePay=Number(row.mobile_count)*mobileRate,internetPay=Number(row.internet_count)*internetRate,tvPay=Number(row.tv_count)*tvRate;
 return {...row,month:CHUSEOK_MONTH,mobileRate,internetRate,tvRate,mobilePay,internetPay,tvPay,total:mobilePay+internetPay+tvPay};
}
export function chuseokSalePay(policy,{month,dayKey,meta,existingSale}){
 if(!policy||month!==CHUSEOK_MONTH||Number(dayKey)<22||Number(dayKey)>28||meta.teamOnly)return 0;
 const included=m=>m&&!m.teamOnly&&Number.isInteger(m.ri)&&m.ri>=0&&m.ri<=5?1:0;
 const count=Math.max(0,Number(policy.store_mobile)-included(existingSale?.source_meta)+included(meta));
 return included(meta)*chuseokMobileRate(count,policy.store_name);
}
