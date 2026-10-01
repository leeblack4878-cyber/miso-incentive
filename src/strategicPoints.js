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
  let strategicPoints = 0, daemyungCount = 0, insurance = 0, strategicVas = 0;
  (sales || []).forEach(sale => {
    const keys = strategicProductKeys(sale?.source_meta || {});
    strategicPoints += keys.reduce((sum, key) => sum + productPoint(key,sale.sale_date||sale.source_meta?.saleDate), 0);
    daemyungCount += keys.includes('vasDaemyung') ? 1 : 0;
    insurance += keys.filter(key => key === 'vasPhonePass' || key === 'vasSafePass').length;
    strategicVas += keys.filter(key => ['vasKyobo', 'vasVcolor', 'vasVcolorBundle'].includes(key)).length;
  });
  return { insurance, strategicVas, daemyungCount, insurancePoints:Number((insurance*.8).toFixed(10)),
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
