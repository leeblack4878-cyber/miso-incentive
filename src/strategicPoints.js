import {getMobilePlan} from './mobilePlans.js';
import {ADDITIONAL_STRATEGIC_SERVICES} from './additionalStrategicServices.js';
export const STRATEGIC_PRODUCT_POINTS = Object.freeze({
  vasStrategicPlan: 0.5, vasKyobo: 1, vasVcolor: 1, vasVcolorBundle: 1,
  vasPhonePass: 0.8, vasSafePass: 0.8, vasVcolorMusic: 0.3, vasBellMoya: 0.3,
  vasDualNumber: 0.3, vasDesignatedNumber: 0.2, vasDaemyung: 2,
  ...Object.fromEntries(ADDITIONAL_STRATEGIC_SERVICES.map(item=>[item.key,item.point])),
});

export function strategicProductKeys(meta = {}) {
  const mainKeys = new Set(meta.vasKeys || []);
  if (meta.strategicPlan) mainKeys.add('vasStrategicPlan');
  const bundleKeys = Object.values(meta.bundleVasMap || {}).flatMap(keys => [...new Set(keys || [])]);
  return [...mainKeys, ...bundleKeys].filter(key => Object.hasOwn(STRATEGIC_PRODUCT_POINTS, key));
}

function productPoint(key,date) {
  return key==='vasDualNumber'&&date&&String(date).slice(0,7)<'2026-10'?0.4:STRATEGIC_PRODUCT_POINTS[key];
}

export function calculateSaleStrategicPoints(meta = {}, date = meta.saleDate) {
  return Number(strategicProductKeys(meta).reduce((sum, key) => sum + productPoint(key,date), 0).toFixed(10));
}

export function summarizeStrategicProducts(sales = []) {
  const plan115Counts={general:0,high:0,known:0,missing:0};
  let strategicPoints = 0, daemyungCount = 0, insurance = 0, strategicVas = 0;
  (sales || []).forEach(sale => {
    const meta=sale?.source_meta||{};
    if(!meta.teamOnly&&!meta.secondOnlyBundle&&!meta.cancelled&&!meta.deleted&&!['cancelled','deleted'].includes(sale.status)&&Number.isInteger(meta.ri)&&meta.ri>=0&&meta.ri<=4){
      const plan=getMobilePlan(meta.planDetail);
      if(!plan)plan115Counts.missing++;
      else {plan115Counts.known++;if(plan.type==='general'){plan115Counts.general++;if(['general_115','general_130'].includes(plan.key))plan115Counts.high++;}}
    }
    const keys = strategicProductKeys(meta);
    strategicPoints += keys.reduce((sum, key) => sum + productPoint(key,sale.sale_date||sale.source_meta?.saleDate), 0);
    daemyungCount += keys.includes('vasDaemyung') ? 1 : 0;
    insurance += keys.filter(key => key === 'vasPhonePass' || key === 'vasSafePass').length;
    strategicVas += keys.filter(key => ['vasKyobo', 'vasVcolor', 'vasVcolorBundle'].includes(key)).length;
  });
  return { plan115Counts, insurance, strategicVas, daemyungCount, insurancePoints:Number((insurance*.8).toFixed(10)),
    strategicPoints:Number(strategicPoints.toFixed(10)), strategicPointsWithoutDaemyung:Number((strategicPoints-daemyungCount*2).toFixed(10)) };
}

export function calculateEmployeeStrategicAdjustment({ hsCount = 0, simMnpCount = 0, strategicPoints = 0 } = {}) {
  const hs=Math.max(0,Number(hsCount||0)), simMnp=Math.max(0,Number(simMnpCount||0)), points=Math.max(0,Number(strategicPoints||0));
  if(hs<=0)return {ratio:null,amount:0,band:'not_applicable'};
  const ratio=points/hs*100;
  if(ratio>=200)return {ratio,amount:hs*10000,band:'bonus'};
  if(ratio<160)return {ratio,amount:-(hs+simMnp)*10000,band:'demerit'};
  return {ratio,amount:0,band:'neutral'};
}
