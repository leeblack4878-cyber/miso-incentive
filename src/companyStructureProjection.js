import {isSecondOnlyBundle} from './secondParentPolicy.js';
import {summarizeVasQuality} from './policyRules.js';
import {calculateHqStructureProjection} from './hqStructurePolicy.js';
// Same source aggregation and policy engine as the existing HQ monthly-award view.
export function structureProjectionFromRecords({sales=[],orders=[],daily=[],changeSupportRatio,month}={}){
      sales=sales.filter(s=>!s.deleted&&!s.source_meta?.deleted&&!s.source_meta?.cancelled&&!['cancelled','deleted'].includes(s.status));
      let hs = 0, mnp = 0, new010 = 0, change95Plus = 0, changeUnder95 = 0, simMnp = 0, plan115Hs = 0;
      let second = 0;
      sales.filter(row => row.source_type === 'mobile').forEach(row => {
        const meta = row.source_meta || {};
        const rowIndex = Number(meta.ri);
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

      const completed = orders;
      const bundleKey = row => `${row.user_id || ''}|${String(row.actual_install_date || '').slice(0, 10)}|${row.customer_id || row.id}`;
      const householdCompleted = completed.filter(row => row.network_type === 'household' || !row.network_type);
      const internet = new Set(completed
        .filter(row => ['internet1g', 'internet500', 'internet100', 'homeOnly', 'homeTv'].includes(row.product_type))
        .map(bundleKey)).size;
      const householdInternet = new Set(householdCompleted
        .filter(row => ['internet1g', 'internet500', 'internet100', 'homeOnly', 'homeTv'].includes(row.product_type))
        .map(bundleKey)).size;
      const householdInternetKeys = new Set(householdCompleted
        .filter(row => ['internet1g', 'internet500', 'internet100', 'homeOnly', 'homeTv'].includes(row.product_type))
        .map(bundleKey));
      const householdMainTvKeys = new Set(householdCompleted.filter(row => row.product_type === 'homeTv').map(bundleKey));
      const household100Keys = new Set(householdCompleted.filter(row => row.product_type === 'internet100').map(bundleKey));
      const homeAwardPayableInternet = [...householdInternetKeys]
        .filter(key => !household100Keys.has(key) || householdMainTvKeys.has(key)).length;
      const smartHome = completed.filter(row => row.product_type === 'smartHome').length;
      const extraSetTop = completed.filter(row => ['subSetTop', 'tvFree'].includes(row.product_type)).length;
      const mainTv = householdCompleted.filter(row => row.product_type === 'homeTv').length;
      const householdExtraSetTop = householdCompleted.filter(row => ['subSetTop', 'tvFree'].includes(row.product_type)).length;
      const householdTvFree = householdCompleted.filter(row => row.product_type === 'tvFree').length;
      const householdSmartHome = householdCompleted.filter(row => row.product_type === 'smartHome').length;
      const householdInternet1g = new Set(householdCompleted.filter(row => row.product_type === 'internet1g').map(bundleKey)).size;
      const iptv17Plus = new Set(householdCompleted
        .filter(row => row.product_type === 'homeTv' && row.main_tv_plan === 'broadcastPass')
        .map(bundleKey)).size;
      const renewalRecognized = daily.reduce((sum, row) => sum
        + (row.data?.householdRenewals || []).reduce((itemSum, item) => itemSum + (item?.speedUp ? 1 : 0.3), 0), 0);
      const mobileSales = sales.filter(row => row.source_type === 'mobile');
      const { strategicPointsWithoutDaemyung, daemyungCount } = summarizeVasQuality(mobileSales);
      const sono = daily.reduce((sum, row) => sum + Object.values(row.data?.groups?.sono || {}).reduce((a, value) => a + Number(value || 0), 0), 0);
      const salesMetricPoints = Number(strategicPointsWithoutDaemyung || 0) + Math.max(Number(daemyungCount || 0), sono) * 2;
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
