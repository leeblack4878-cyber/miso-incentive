import React from 'react';
import { displayStoreName, MATRIX_COLS } from './uiDefinitions';
import { HOME_BASE_ITEMS, DEFAULT_RENEW, MATRIX_ROWS, DEFAULT_VAS, DEFAULT_BUNDLE2ND, DEFAULT_SONO, DEFAULT_MNP_BUNDLE } from './appShared';
import { useState, useEffect } from 'react';
import { supabase } from './supabase';
const DEFAULT_STORES = [
  '신천동_삼미시장점', '신천동_삼미시장2호점', '본오3동_상록수역점', '대야동_롯데마트점',
  '본오3동_주민센터점', '장곡동_장곡역점', '거모동_도일시장점', '월곶동_월곶점',
  '월피동_성포역점', '광정동_산본점', '고잔동_법조타운점', '은행동_은계사거리점', '본오1동_본오중학교점',
  '영업지원팀',
];

const DEFAULT_HOME_FLAT = [
  { key: 'home1GBOnly', label: '1GB 단독', rate: 200000, point: 0 },
  { key: 'home500Only', label: '500MB 단독', rate: 100000, point: 0 },
  { key: 'home100Only', label: '100MB 단독', rate: 50000, point: 0 },
  { key: 'tvFree', label: 'TV프리(부)', rate: 100000, point: 0.5 },
  { key: 'smartHome', label: '스마트홈', rate: 100000, point: 0.5 },
];

const DEFAULT_HOME_ADDON = [
  { key: 'addNewChange', label: '신규/기변 동시판매', rate: 100000 },
  { key: 'addMnp', label: 'MNP 동시판매', rate: 300000 },
  { key: 'addUsedMnp', label: '중고MNP 동시판매 (85군↑ 선약, 가정망)', rate: 200000 },
  { key: 'addSetTop', label: '부셋탑 동시청약', rate: 50000 },
  { key: 'smartHomeSimul', label: '스마트홈 동시판매', rate: 50000 },
];

function sortStoresByOpenOrder(list=[]) {
  const order = new Map(DEFAULT_STORES.map((name, idx) => [name, idx]));
  return [...new Set((list || []).filter(Boolean))].sort((a,b)=>{
    const ai = order.has(a) ? order.get(a) : 9999;
    const bi = order.has(b) ? order.get(b) : 9999;
    if (ai !== bi) return ai - bi;
    return displayStoreName(a).localeCompare(displayStoreName(b), 'ko');
  });
}

function emptyDraft() {
  return {
    activityTimeMet: true,
    homeNoPerformance: false,
    mobilePoint: {},
    kpi: {},
    homeBase: Object.fromEntries(HOME_BASE_ITEMS.map((i) => [i.key, 0])),
    homeFlat: Object.fromEntries(DEFAULT_HOME_FLAT.map((i) => [i.key, 0])),
    homeAddon: Object.fromEntries(DEFAULT_HOME_ADDON.map((i) => [i.key, 0])),
    renew: Object.fromEntries(DEFAULT_RENEW.map((i) => [i.key, 0])),
    matrix: MATRIX_ROWS.map(() => MATRIX_COLS.map(() => 0)),
    vas: Object.fromEntries(DEFAULT_VAS.map((i) => [i.key, 0])),
    bundle2nd: Object.fromEntries(DEFAULT_BUNDLE2ND.map((i) => [i.key, 0])),
    sono: Object.fromEntries(DEFAULT_SONO.map((i) => [i.key, 0])),
    mnpBundle: Object.fromEntries(DEFAULT_MNP_BUNDLE.map((i) => [i.key, 0])),
    custRegCount: 0,
    tailoredCount: 0,
    tailoredAmount: 0,
  };
}

const COMPANY_STORE_GOAL_BASE = [
  { match:['삼미시장2호','삼미2'], hs:63, home:6, productivity:78.8, tvFree:5, smartHome:3 },
  { match:['삼미시장','삼미'], hs:102, home:10, productivity:127.5, tvFree:8, smartHome:5 },
  { match:['상록수역','상록'], hs:100, home:10, productivity:123, tvFree:8, smartHome:5 },
  { match:['롯데마트','대야'], hs:52, home:5, productivity:65, tvFree:4, smartHome:3 },
  { match:['주민센터','주민'], hs:70, home:7, productivity:82, tvFree:6, smartHome:4 },
  { match:['장곡역','장곡'], hs:54, home:6, productivity:67.5, tvFree:5, smartHome:3 },
  { match:['도일시장','거모'], hs:100, home:10, productivity:123, tvFree:8, smartHome:5 },
  { match:['월곶'], hs:64, home:7, productivity:80, tvFree:5, smartHome:3 },
  { match:['성포역','성포'], hs:37, home:4, productivity:46.3, tvFree:3, smartHome:2 },
  { match:['산본'], hs:129, home:13, productivity:161.3, tvFree:9, smartHome:5 },
  { match:['법조타운','법조','범조'], hs:39, home:4, productivity:48.8, tvFree:3, smartHome:2 },
  { match:['은계사거리','은계'], hs:41, home:4, productivity:51.3, tvFree:3, smartHome:2 },
  { match:['본오중학교','본오'], hs:41, home:4, productivity:51.3, tvFree:3, smartHome:2 },
];

function companyGoalDefaults(storeName){
  const raw=String(storeName||'');
  const shown=displayStoreName(raw);
  const hit=COMPANY_STORE_GOAL_BASE.find(x=>x.match.some(k=>raw.includes(k)||shown.includes(k)));
  if(!hit)return {};
  return {
    hs:hit.hs,
    home:hit.home,
    productivity:hit.productivity,
    tvFree:hit.tvFree,
    smartHome:hit.smartHome,
    tailoredCount:Math.ceil(Number(hit.hs||0)*0.5),
  };
}

function isFinalStorePerformance(row, month) {
  if (!row || row.month !== month || !row.as_of_date) return false;
  const [year,monthNumber]=String(month).split('-').map(Number);
  const lastDay=new Date(year,monthNumber,0).getDate();
  return String(row.as_of_date) >= `${month}-${String(lastDay).padStart(2,'0')}` || row.metrics?.status==='final';
}

function finalStoreMetric(row, key, fallback=0) {
  if (!row) return Number(fallback||0);
  const metrics=row.metrics||{};
  const aliases={free:'tv',tvFree:'tv',smart:'smartHome',upsell:'tailoredCount',upsellAmount:'tailoredAmount'};
  const sourceKey=aliases[key]||key;
  return metrics[sourceKey]===undefined ? Number(fallback||0) : Number(metrics[sourceKey]||0);
}

function useFinalStorePerformance(month, storeName='') {
  const [data,setData]=useState(storeName?null:{});
  useEffect(()=>{
    let alive=true;
    let query=supabase.from('head_office_store_performance').select('month,store_name,as_of_date,metrics,note').eq('month',month);
    if(storeName)query=query.eq('store_name',storeName).maybeSingle();
    query.then(({data:rows,error})=>{
      if(!alive)return;
      if(error){console.error('FINAL STORE PERFORMANCE LOAD ERROR',error);setData(storeName?null:{});return;}
      if(storeName){setData(isFinalStorePerformance(rows,month)?rows:null);return;}
      const map={};(rows||[]).forEach(row=>{if(isFinalStorePerformance(row,month))map[row.store_name]=row});setData(map);
    });
    return()=>{alive=false};
  },[month,storeName]);
  return data;
}
export { emptyDraft, DEFAULT_HOME_FLAT, DEFAULT_HOME_ADDON, sortStoresByOpenOrder, DEFAULT_STORES, companyGoalDefaults, COMPANY_STORE_GOAL_BASE, useFinalStorePerformance, isFinalStorePerformance, finalStoreMetric };
