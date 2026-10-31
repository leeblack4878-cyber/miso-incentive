import {isSecondOnlyBundle} from './secondParentPolicy.js';
import {summarizeVasQuality} from './policyRules.js';
import {calculateHqStructureProjection} from './hqStructurePolicy.js';
const active=s=>!s.deleted&&!s.source_meta?.deleted&&!s.source_meta?.cancelled&&!['cancelled','deleted'].includes(s.status);
const unique=rows=>{const seen=new Set();return rows.filter(r=>{if(!r.id)return true;if(seen.has(r.id))return false;seen.add(r.id);return true;});};
// Legacy Sono totals overlap mobile entries only for the same employee and date.
export function companySalesMetricPoints(sales=[],daily=[],overlapSales=sales){
 const mobile=unique(sales.filter(s=>s.source_type==='mobile'&&active(s)));
 const metric=summarizeVasQuality(mobile),overlap=new Map();
 for(const sale of unique(overlapSales.filter(s=>s.source_type==='mobile'&&active(s)))){
  const key=`${sale.user_id}:${sale.sale_date}`;
  overlap.set(key,(overlap.get(key)||0)+summarizeVasQuality([sale]).daemyungCount);
 }
 let excess=0;const seen=new Set();
 for(const row of daily){const key=`${row.user_id}:${row.work_date}`;if(seen.has(key))continue;seen.add(key);
  const count=Object.values(row.data?.groups?.sono||{}).reduce((n,v)=>n+Number(v||0),0);
  excess+=Math.max(0,count-(overlap.get(key)||0));
 }
 return Number(metric.strategicPoints||0)+excess*2;
}
// Same source aggregation and policy engine as the existing HQ monthly-award view.
export function structureProjectionFromRecords({sales=[],orders=[],daily=[],changeSupportRatio,month}={}){
      sales=unique(sales.filter(s=>active(s)&&(!s.sale_date||s.sale_date.startsWith(`${month}-`))));
      orders=unique(orders);
      const seenDays=new Set();daily=daily.filter(r=>{if(r.work_date&&!r.work_date.startsWith(`${month}-`))return false;const k=`${r.user_id}:${r.work_date}`;if(seenDays.has(k))return false;seenDays.add(k);return true;});
      let hs = 0, mnp = 0, new010 = 0, change95Plus = 0, changeUnder95 = 0, simMnp = 0, plan115Hs = 0;
      let second = 0;
      sales.filter(row => row.source_type === 'mobile').forEach(row => {
        const meta = row.source_meta || {};
        const rowIndex = Number.isInteger(meta.ri)?meta.ri:-1;
        if ([0, 1, 2, 3, 4].includes(rowIndex)) {
          hs += 1;
          if (Number(meta.ci) === 0) plan115Hs += 1;
        }
        if (rowIndex === 0) new010 += 1;
        if (rowIndex === 1) mnp += 1;
        if ([2, 3, 4].includes(rowIndex)) {
          if ([0, 1].includes(Number(meta.ci))) change95Plus += 1;
          else changeUnder95 += 1;
        }
        if (rowIndex === 5) simMnp += 1;
        if (rowIndex === 7 && !isSecondOnlyBundle(meta)) second += 1;
        second += Array.isArray(meta.bundle2ndKeys) ? meta.bundle2ndKeys.length : 0;
      });

      const completed = orders.filter(o=>o.status==='completed'&&o.actual_install_date?.startsWith(`${month}-`));
      const bundleKey = row => `${row.user_id || ''}|${row.customer_id || row.id}|${row.source_work_date || ''}|${row.network_type||'household'}`;
      const physicalTypes=['internet1g','internet500','internet100'];
      const physicalBundles=new Set(orders.filter(o=>physicalTypes.includes(o.product_type)).map(bundleKey));
      // Count an installed internet order once. TV installation is never another internet.
      const internetRows=completed.filter(o=>physicalTypes.includes(o.product_type)||(o.product_type==='homeOnly'&&!physicalBundles.has(bundleKey(o))));
      const householdCompleted=completed.filter(row=>row.network_type==='household'||!row.network_type);
      const householdInternetRows=internetRows.filter(row=>row.network_type==='household'||!row.network_type);
      const internet=internetRows.length,householdInternet=householdInternetRows.length;
      const householdMainTvKeys=new Set(orders.filter(o=>o.status==='completed'&&o.actual_install_date&&o.actual_install_date.slice(0,7)<=month&&(o.network_type==='household'||!o.network_type)&&o.product_type==='homeTv').map(bundleKey));
      const homeAwardPayableInternet=householdInternetRows.filter(o=>o.product_type!=='internet100'||householdMainTvKeys.has(bundleKey(o))).length;
      const smartHome=completed.filter(row=>row.product_type==='smartHome').length;
      const extraSetTop=completed.filter(row=>['subSetTop','tvFree'].includes(row.product_type)).length;
      const mainTv=householdCompleted.filter(row=>row.product_type==='homeTv').length;
      const householdExtraSetTop=householdCompleted.filter(row=>['subSetTop','tvFree'].includes(row.product_type)).length;
      const householdTvFree=householdCompleted.filter(row=>row.product_type==='tvFree').length;
      const householdSmartHome=householdCompleted.filter(row=>row.product_type==='smartHome').length;
      const householdInternet1g=householdInternetRows.filter(row=>row.product_type==='internet1g').length;
      const iptv17Plus=householdCompleted.filter(row=>row.product_type==='homeTv'&&row.main_tv_plan === 'broadcastPass').length;
      const renewalRecognized=daily.reduce((sum,row)=>sum+(row.data?.householdRenewals||[]).filter(item=>!item.deleted&&!item.downSpeed&&!['cancelled','deleted'].includes(item.status)).reduce((n,item)=>n+(item.speedUp?1:0.3),0),0);
      const salesMetricPoints=companySalesMetricPoints(sales,daily);
      const savedChangeSupportRatio = changeSupportRatio;
      return calculateHqStructureProjection({
        month,
        selfStoreInput: { hs, second, internet, smartHome, extraSetTop },
        retailInput: { hs, plan115Hs, mnp, new010, change95Plus, changeUnder95, second, simMnp },
        salesMetricInput: { hs, salesMetricPoints },
        awardInput: { hs, mnp, new010, change:change95Plus+changeUnder95, simMnp, internet, salesMetricPoints, changeSupportRatio:savedChangeSupportRatio },
        homeGradeInput: { hs, internet: householdInternet, renewalRecognized, mainTv, extraSetTop: householdExtraSetTop },
        homeInternetRatioInput: { hs, internet: householdInternet, mainTv, extraSetTop: householdExtraSetTop },
        homeAwardInput: { hs, internet: householdInternet, payableInternet: homeAwardPayableInternet, mainTv, iptv17Plus, extraSetTop: householdExtraSetTop, tvFree: householdTvFree, internet1g: householdInternet1g, smartHome: householdSmartHome },
        iptvGradeInput: { mainTv, extraSetTop: householdExtraSetTop },
      });
}
