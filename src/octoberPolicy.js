import {OCTOBER9_SPECIAL_SALES} from './october9Policy.js';
import {OCTOBER16_BUNDLES,OCTOBER16_SPECIAL_SALES,OCTOBER16_BUDDY_SALES,calculateOctober16Sale} from './october16Policy.js';
import {LONG_STOCK_SPECIAL_SALES,calculateLongStockSale} from './longStockPolicy.js';
import {OCTOBER_WEEKEND_SPECIAL_SALES,calculateOctoberWeekendSale} from './octoberWeekendPolicy.js';
import {ADDITIONAL_STRATEGIC_SERVICES} from './additionalStrategicServices.js';
import { septemberConfig, SEPTEMBER_SPECIAL_SALES, calculateSeptemberSpecialSale } from './septemberPolicy.js';

export const OCTOBER_POLICY_VERSION = '2026-10-v1';
export const OCTOBER_POLICY_MONTH = '2026-10';
// Confirmed 2026-10-01 notice. Short-term changes under six months are not
// eligible sales (owner correction); do not add denominator-only performance.
const MODEL_RATES = [
  ['S942-256/512',150000,100000], ['S947-256/512',150000,80000],
  ['S948-256/512',150000,80000], ['F776-256',150000,50000],
  ['F776-512',200000,100000], ['F971-256',200000,100000],
  ['F971-512',100000,30000], ['F976-256',150000,70000],
  ['F976-512',150000,70000], ['S741',100000,100000],
];
export const OCTOBER_SPECIAL_SALES = MODEL_RATES.flatMap(([model,mnp,change]) =>
  [['MNP',mnp],['기기변경',change]].map(([saleType,additionalAmount],index) => ({
    key:`oct_${model.replace(/[^a-z0-9]/gi,'_').toLowerCase()}_${index?'change':'mnp'}`,
    model,saleType,additionalAmount,planRule:'high',requiredStrategicPoints:2,
    startDate:'2026-10-01',endDate:'2026-10-15',policyVersion:OCTOBER_POLICY_VERSION,
  }))
);
export function specialSalesForDate(date) {
  const policies=String(date).slice(0,7)>=OCTOBER_POLICY_MONTH?[...OCTOBER_SPECIAL_SALES,...OCTOBER16_SPECIAL_SALES,...OCTOBER16_BUDDY_SALES,...OCTOBER_WEEKEND_SPECIAL_SALES,...OCTOBER9_SPECIAL_SALES,...LONG_STOCK_SPECIAL_SALES]:SEPTEMBER_SPECIAL_SALES;
  return policies.filter(p=>p.startDate<=date&&p.endDate>=date&&!(date>='2026-10-16'&&p.key==='stock_r825_free'));
}
export function calculateMonthlySpecialSale(args={}) {
  const policies=specialSalesForDate(args.saleDate||''),policy=policies.find(p=>p.key===args.policyKey);
  return policy?.revision16?calculateOctober16Sale(args,policy):policy?.stock?calculateLongStockSale(args,policy):policy?.weekend?calculateOctoberWeekendSale(args,policy):calculateSeptemberSpecialSale(args,policies);
}
export function octoberQuality({matrix=[],strategicPoints=0,homeNoPerformance=false,plan115Counts}={}) {
  const hs=matrix.slice(0,5).reduce((sum,row)=>sum+row.reduce((n,v)=>n+Number(v||0),0),0);
  const sim=(matrix[5]||[]).reduce((n,v)=>n+Number(v||0),0);
  const plan115=matrix.slice(0,5).reduce((n,row)=>n+Number(row[0]||0),0);
  const factor=homeNoPerformance?.5:1;
  const ratio=hs>0?Number(strategicPoints||0)/hs*100:null;
  // Callers with raw sale metadata pass exact customer types. Legacy direct
  // callers may still supply a matrix; payroll explicitly passes missing counts.
  const counts=plan115Counts||{general:hs,high:plan115,known:hs,missing:0};
  const plan115Missing=Math.max(Number(counts.missing||0),hs-Number(counts.known||0),0);
  const plan115Ratio=plan115Missing===0&&counts.general>0?counts.high/counts.general*100:null;
  const band=ratio===null?'not_applicable':ratio>=200?'bonus':ratio<170?'demerit':'neutral';
  return {ratio,band,amount:band==='bonus'?hs*10000*factor:band==='demerit'?-(hs+sim)*10000:0,
    plan115Ratio,plan115Missing,plan115GeneralCount:Number(counts.general||0),plan115HighCount:Number(counts.high||0),plan115Bonus:(plan115Ratio>=70?Number(counts.high||0):0)*10000*factor};
}
export function octoberConfig(base={}) {
  const september=septemberConfig(base);
  const matrix=september.matrix.map(row=>[...row]);
  matrix[5][0]=90000;
  return {...september,matrix,
    vas:[...september.vas.map(item=>item.key==='vasDualNumber'?{...item,point:0.3}:item),...ADDITIONAL_STRATEGIC_SERVICES.map(item=>({...item}))],
    bundle2nd:[...OCTOBER16_BUNDLES,...september.bundle2nd.map(item=>({...item,label:item.label.replace('14~17','14~18')})),{key:'b_R825FA',label:'2ND · R825FA 장기재고',rate:350000}],
    smartHomeLiteRate:50000,
    homeAddon:(september.homeAddon||[]).map(item=>item.key==='smartHomeSimul'?{...item,rate:0}:item),
    policyVersion:OCTOBER_POLICY_VERSION,
  };
}
