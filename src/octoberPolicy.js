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
    startDate:'2026-10-01',endDate:'2099-12-31',policyVersion:OCTOBER_POLICY_VERSION,
  }))
);
export function specialSalesForDate(date) {
  const policies=String(date).slice(0,7)>=OCTOBER_POLICY_MONTH?OCTOBER_SPECIAL_SALES:SEPTEMBER_SPECIAL_SALES;
  return policies.filter(p=>p.startDate<=date&&p.endDate>=date);
}
export function calculateMonthlySpecialSale(args={}) {
  return calculateSeptemberSpecialSale(args,specialSalesForDate(args.saleDate||''));
}
export function octoberQuality({matrix=[],strategicPoints=0,homeNoPerformance=false}={}) {
  const hs=matrix.slice(0,5).reduce((sum,row)=>sum+row.reduce((n,v)=>n+Number(v||0),0),0);
  const sim=(matrix[5]||[]).reduce((n,v)=>n+Number(v||0),0);
  const plan115=matrix.slice(0,5).reduce((n,row)=>n+Number(row[0]||0),0);
  const factor=homeNoPerformance?.5:1;
  const ratio=hs>0?Number(strategicPoints||0)/hs*100:null;
  const plan115Ratio=hs>0?plan115/hs*100:null;
  const band=ratio===null?'not_applicable':ratio>=200?'bonus':ratio<170?'demerit':'neutral';
  return {ratio,band,amount:band==='bonus'?hs*10000*factor:band==='demerit'?-(hs+sim)*10000:0,
    plan115Ratio,plan115Bonus:plan115Ratio>=60?plan115*10000*factor:0};
}
export function octoberConfig(base={}) {
  const september=septemberConfig(base);
  const matrix=september.matrix.map(row=>[...row]);
  matrix[5][0]=90000;
  return {...september,matrix,
    vas:[...september.vas,...ADDITIONAL_STRATEGIC_SERVICES.map(item=>({...item}))],
    bundle2nd:september.bundle2nd.map(item=>({...item,label:item.label.replace('14~17','14~18')})),
    smartHomeLiteRate:50000,
    homeAddon:(september.homeAddon||[]).map(item=>item.key==='smartHomeSimul'?{...item,rate:0}:item),
    policyVersion:OCTOBER_POLICY_VERSION,
  };
}
