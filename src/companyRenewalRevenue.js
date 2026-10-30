// Company 3-year household renewal fees (VAT included). Employee pay is independent.
export function summarizeCompanyRenewals(daily=[],month){
 const result={internet:0,tv:0,total:0,count:0,pending:0};
 if(!/^\d{4}-\d{2}$/.test(month||'')||month<'2026-10')return result;
 const seenDays=new Set(),seenItems=new Set();
 for(const row of daily){
  if(!row.work_date?.startsWith(`${month}-`))continue;
  const dayKey=`${row.user_id}:${row.work_date}`;if(seenDays.has(dayKey))continue;seenDays.add(dayKey);
  const items=row.data?.householdRenewals||[];
  for(const [index,item] of items.entries()){
   const key=`${dayKey}:${item.id||index}`;if(seenItems.has(key))continue;seenItems.add(key);
   if(item.deleted||['cancelled','deleted'].includes(item.status)||item.downSpeed)continue;
   if(!['premiumSafe','premium','smart'].includes(item.plan)||!['100','200','500','1g'].includes(item.speed)){result.pending++;continue;}
   result.count++;
   result.internet+=['premiumSafe','premium'].includes(item.plan)?99000:77000;
   // 100M -> 200M has no speed-up bonus under the supplied notice.
   if(item.speedUp&&['500','1g'].includes(item.speed))result.internet+=33000;
   if(item.homeOnly===false){result.tv+=11000;if(item.tvUpsell)result.tv+=22000;}
   else if(item.homeOnly!==true)result.pending++;
  }
  const legacy=row.data?.householdRenewLegacyCounts||(!items.length?row.data?.groups?.renew:null);
  if(Object.values(legacy||{}).some(v=>Number(v)>0))result.pending++;
 }
 result.total=result.internet+result.tv;return result;
}
