import { useState, useEffect } from 'react';
import { Check, AlertTriangle, UploadCloud } from 'lucide-react';
import { supabase } from './supabase';
import { friendlyError } from './errorMessages';
import { showAppToast } from './feedback';


import { DEFAULT_ACTIVITY_SUPPORT_MAX, MATRIX_ROW_DEFS, MATRIX_COLS, fmtNum } from './uiDefinitions';
import { SECOND_PERFORMANCE_POINT, completedHomeCount, calculateSecondPolicy, calculateActivitySupport, calculateSeptemberWeekendSimMnpBonus, countSeptemberWeekendSimMnp, calculateFlatIncentive, calculateMobileCommissionParts, calculatePayrollSettlement, CURRENT_POLICY_VERSION, createPolicySnapshot } from './policyRules';
import { SEPTEMBER_POLICY_MONTH, SEPTEMBER_POLICY_VERSION, septemberMainTvPlan, calculateSeptemberSono, calculateSeptemberTailoredTier } from './septemberPolicy';
import { calculateSaleStrategicPoints, calculateEmployeeStrategicAdjustment } from './strategicPoints';

const CURRENT_SALE_SCHEMA_VERSION = 3;

const FREE_PHONE_SPECIAL_TITLE = '무료폰 특가';

function isIncentiveUnpaidSpecial(policy={}){
  return policy?.policyType==='incentive_unpaid'||policy?.policy_type==='incentive_unpaid'
    ||policy?.policyType==='free_phone'||policy?.policy_type==='free_phone'
    ||policy?.policyTitle===FREE_PHONE_SPECIAL_TITLE||policy?.title===FREE_PHONE_SPECIAL_TITLE;
}

function septemberPlanGroup(ci){return ['115','youth85','85','33plus','weak47','other'][Number(ci)]||'other'}

function saleSchemaVersion(sale){
  return Number(sale?.schema_version || sale?.source_meta?.schemaVersion || 1);
}

function withCurrentSaleSchema(meta={}){
  return {...(meta||{}), schemaVersion:CURRENT_SALE_SCHEMA_VERSION};
}

function currentPolicySnapshot(config={}){
  return createPolicySnapshot({
    version:config.policyVersion||CURRENT_POLICY_VERSION,
    matrixRates:config.matrix||[],
    vasRates:config.vas||[],
    bundleRates:config.bundle2nd||[],
  });
}

function legacySaleBadge(sale){
  return saleSchemaVersion(sale) < CURRENT_SALE_SCHEMA_VERSION;
}

function inferHomeProductTypeFromLabel(label=''){
  const t=String(label||'').replace(/\s+/g,' ');
  if(t.includes('TV프리')) return 'tvFree';
  if(t.includes('스마트홈')) return 'smartHome';
  if(t.includes('일반 부셋탑') || t.includes('부셋탑')) return 'subSetTop';
  if(t.includes('중고MNP') || t.includes('중고 MNP')) return 'simulUsedMnp';
  if(t.includes('MNP 동시')) return 'simulMnp';
  if(t.includes('신규/기변') || t.includes('신규·기변')) return 'simulNewChange';
  if(t.includes('1GB') || t.includes('1G')) return 'internet1g';
  if(t.includes('500MB') || t.includes('500M')) return 'internet500';
  if(t.includes('100MB') || t.includes('100M')) return 'internet100';
  if(t.includes('홈+TV') || t.includes('홈 + TV')) return 'homeTv';
  if(t.includes('홈 단독') || t==='홈') return 'homeOnly';
  return '';
}

function compatHomeRows(homeSales=[], orders=[]){
  if((orders||[]).length) return orders;
  return (homeSales||[]).map(sale=>({
    id:sale.source_ref||sale.id,
    product_type:inferHomeProductTypeFromLabel(sale.metric_label),
    network_type:sale.source_meta?.networkType||'',
    status:sale.source_meta?.directComplete?'completed':'pending',
    planned_install_date:null,
    source_group:null,
    source_key:null,
    _legacy:true,
  })).filter(x=>x.product_type);
}

const NON_SALES_STORES = ['운영진', '영업지원팀'];

const HOME_GATE_MIN = 3;

const ADDON_GATE = 35;

const HOME_GATE_WEIGHTS = { homeOnly: 1, homeTv: 1, tvFree: 0.3, smartHome: 0.2 };

const DEFAULT_MOBILE_POINT_ITEMS = [
  { key: 'mnp', label: 'MNP', point: 1.5, countsTenure: true },
  { key: 'new010', label: '010 신규', point: 1, countsTenure: true },
  { key: 'gibyeon115', label: '기기변경 (115군↑)', point: 1, countsTenure: true },
  { key: 'gibyeon85', label: '기기변경 (85군↑)', point: 0.7, countsTenure: true },
  { key: 'gibyeonWeak', label: '기변 (약자요금제)', point: 0.5, countsTenure: true },
  { key: 'gibyeonLVC', label: '기변 (85군 미만)', point: 0.3, countsTenure: true },
  { key: 'usedMnp', label: '중고 MNP (선약가입건)', point: 1, countsTenure: true },
  { key: 'secondOnly', label: '2ND단독', point: SECOND_PERFORMANCE_POINT, countsTenure: true },
];

const DEFAULT_KPI_ITEMS = [
  { key: 'kpiMnp', label: 'MNP', point: 1.7 },
  { key: 'kpiNew010', label: '010 신규', point: 1.5 },
  { key: 'kpiGibyeonA', label: '기변A', point: 1 },
  { key: 'kpiGibyeonB', label: '기변B', point: 0.8 },
  { key: 'kpiGibyeonC', label: '기변C', point: 0.5 },
  { key: 'kpiSecond', label: '2ND', point: 0.2 },
  { key: 'kpiSimMnp', label: 'SIM MNP', point: 1 },
  { key: 'kpiUsedNew010', label: '중고 010신규 (66군 이상)', point: 0.5 },
  { key: 'kpiHome', label: '홈', point: 1 },
  { key: 'kpiTv', label: 'TV', point: 1 },
  { key: 'kpiTvSetTop', label: 'TV부셋탑', point: 0.5 },
  { key: 'kpiSmartHome', label: '스마트홈', point: 0.5 },
  { key: 'kpiInternetRenew', label: '인터넷 재약정', point: 0.3 },
  { key: 'kpiTvRenew', label: 'TV 재약정', point: 0.3 },
];

const HOME_BASE_ITEMS = [
  { key: 'homeOnly', label: '홈 단독', point: 1 },
  { key: 'homeTv', label: 'TV(주)', point: 2 },
];

const HOME_NETWORK_TYPES = [
  { key: 'household', label: '가정망' },
  { key: 'soho', label: '소호망' },
];

function homeNetworkLabel(value) {
  return HOME_NETWORK_TYPES.find(x=>x.key===value)?.label || '망 미지정';
}

function homeMainTvPlanLabel(value,networkType=''){
  if(value==='broadcastPass')return '방송패스';
  if(value==='premium')return '프리미엄';
  if(value==='belowPremium')return '프리미엄 미만';
  return septemberMainTvPlan(networkType);
}

const DEFAULT_RENEW = [
  { key: 'renewPremiumSafe1G', label: '재약정 - 프리미엄 안심보상 1GB', rate: 120000 },
  { key: 'renewPremiumSafe500', label: '재약정 - 프리미엄 안심보상 500MB', rate: 90000 },
  { key: 'renewPremium1G', label: '재약정 - 프리미엄 안심 1GB', rate: 110000 },
  { key: 'renewPremium500', label: '재약정 - 프리미엄 안심 500MB', rate: 80000 },
  { key: 'renewSmart1G', label: '재약정 - 스마트 1GB', rate: 20000 },
  { key: 'renewSimul1G', label: '재약정 - 동시판매 1GB', rate: 80000 },
  { key: 'renewSimul500', label: '재약정 - 동시판매 500MB', rate: 50000 },
  { key: 'renewTvUpsell', label: 'TV 업셀 수수료', rate: 20000 },
];

const HOUSEHOLD_RENEW_PLANS = [
  { key:'premiumSafe', label:'프리미엄 안심 보상' },
  { key:'premium', label:'프리미엄 안심' },
  { key:'smart', label:'스마트' },
];

function householdRenewBaseKey(speed, plan){
  if(speed==='1g'&&plan==='premiumSafe')return 'renewPremiumSafe1G';
  if(speed==='500'&&plan==='premiumSafe')return 'renewPremiumSafe500';
  if(speed==='1g'&&plan==='premium')return 'renewPremium1G';
  if(speed==='500'&&plan==='premium')return 'renewPremium500';
  if(speed==='1g'&&plan==='smart')return 'renewSmart1G';
  return '';
}

function renewRate(config,key){ return Number((config?.renew||DEFAULT_RENEW).find(x=>x.key===key)?.rate||0); }

function calculateHouseholdRenew(item,config){
  const speed=item?.speed||'1g';
  if(config?.policyVersion===SEPTEMBER_POLICY_VERSION){
    const invalid=!!item?.downSpeed;
    const premiumSafe=item?.plan==='premiumSafe';
    const baseKey=premiumSafe
      ? `renewPremiumSafe${speed==='1g'?'1G':speed==='500'?'500':'100'}`
      : `renewOther${speed==='1g'?'1G':speed==='500'?'500':'100'}`;
    const base=invalid?0:renewRate(config,baseKey);
    const speedUpPay=!invalid&&item?.speedUp?renewRate(config,'renewSpeedUp'):0;
    const hsKey=speed==='1g'?'renewSimul1G':speed==='500'?'renewSimul500':'';
    const hsPay=!invalid&&item?.hsSimul&&hsKey?renewRate(config,hsKey):0;
    const tvPay=!invalid&&item?.tvUpsell?renewRate(config,'renewTvUpsell'):0;
    return {invalid,baseKey,base,soloDiscount:0,hsKey,hsPay,tvPay,speedUpPay,amount:Math.max(0,base+speedUpPay+hsPay+tvPay)};
  }
  const invalid=speed==='100'||!!item?.downSpeed||!!item?.temporaryUpgradeSame;
  const baseKey=householdRenewBaseKey(speed,item?.plan||'premiumSafe');
  const base=invalid?0:renewRate(config,baseKey);
  const soloDiscount=invalid?0:(item?.homeOnly?Math.min(50000,base):0);
  const hsKey=speed==='1g'?'renewSimul1G':speed==='500'?'renewSimul500':'';
  const hsPay=(!invalid&&item?.hsSimul)?renewRate(config,hsKey):0;
  const tvPay=(!invalid&&!item?.homeOnly&&item?.tvUpsell)?renewRate(config,'renewTvUpsell'):0;
  return {invalid,baseKey,base,soloDiscount,hsKey,hsPay,tvPay,amount:Math.max(0,base-soloDiscount+hsPay+tvPay)};
}

function aggregateHouseholdRenewals(items,config){
  const counts={}; let soloDiscount=0;
  (items||[]).forEach(item=>{
    const c=calculateHouseholdRenew(item,config);
    if(c.invalid)return;
    if(c.baseKey&&c.base>0)counts[c.baseKey]=(counts[c.baseKey]||0)+1;
    if(item.hsSimul&&c.hsKey&&c.hsPay>0)counts[c.hsKey]=(counts[c.hsKey]||0)+1;
    if(item.speedUp&&c.speedUpPay>0)counts.renewSpeedUp=(counts.renewSpeedUp||0)+1;
    if(item.tvUpsell&&c.tvPay>0)counts.renewTvUpsell=(counts.renewTvUpsell||0)+1;
    soloDiscount+=c.soloDiscount;
  });
  return {counts,soloDiscount};
}

function emptyHouseholdRenewForm(){
  return {customer:'',speed:'1g',plan:'premiumSafe',homeOnly:false,hsSimul:false,tvUpsell:false,speedUp:false,downSpeed:false,temporaryUpgradeSame:false};
}

const MATRIX_ROWS = MATRIX_ROW_DEFS.map((r) => r.label);

const DEFAULT_GIBYEON_COLUMN_MAP = ['gibyeon115', 'gibyeon85', 'gibyeon85', 'gibyeonLVC', 'gibyeonWeak', 'gibyeonLVC'];

const DEFAULT_VAS = [
  { key: 'vasKyobo', label: '교보문고sam + 구글원', rate: 20000 },
  { key: 'vasVcolor', label: 'V컬러링 + 벨링콘텐츠팩', rate: 20000 },
  { key: 'vasPhonePass', label: '폰교체패스', rate: 10000 },
  { key: 'vasSafePass', label: '폰안심패스', rate: 0 },
];

const DEFAULT_BUNDLE2ND = [
  { key: 'b_L335', label: '2ND · L335', rate: 200000 },
  { key: 'b_X216', label: '2ND · X216', rate: 200000 },
  { key: 'b_X236', label: '2ND · X236', rate: 150000 },
  { key: 'b_X236NP', label: '2ND · X236-NP', rate: 200000 },
  { key: 'b_L505', label: '2ND · L505', rate: 200000 },
  { key: 'b_L705', label: '2ND · L705(2025)', rate: 200000 },
  { key: 'b_L345', label: '2ND · L345(40mm)', rate: 200000 },
  { key: 'b_L355', label: '2ND · L355(44mm)', rate: 200000 },
  { key: 'b_L715', label: '2ND · L715', rate: 200000 },
  { key: 'b_AppleWatch', label: '2ND · 애플워치SE3 (아이폰14~17)', rate: 150000 },
];

const DEFAULT_SONO = [
  { key: 'sonoBasic', label: '소노 NEW 라이프케어', rate: 80000 },
  { key: 'sono594', label: '594만 상품', rate: 60000 },
];

const DEFAULT_MNP_BUNDLE = [
  { key: 'usedMnpBundle', label: '중고 MNP 결합 활성화 (61군↑ 개통·결합완료)', rate: 100000 },
];

function fmtCount(n) { return fmtNum(Math.round(Number(n || 0))); }

function fmtShortDate(v) {
  if (!v) return '';
  const d = String(v).slice(0,10);
  const [y,m,day] = d.split('-');
  return y && m && day ? `${y}.${m}.${day}` : d;
}

function monthKeyOf(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }

function monthLabel(key) { const [y, m] = key.split('-'); return `${y}년 ${parseInt(m, 10)}월`; }

function sumPoint(counts, table) { return table.reduce((s, t) => s + (counts[t.key] || 0) * t.point, 0); }

function tierBonus(count, tiers) {
  const sorted = [...tiers].sort((a, b) => b.min - a.min);
  const hit = sorted.find((t) => count >= t.min);
  return hit ? hit.bonus : 0;
}

function homeGradeTotal(tierCount, payableCount, tiers) {
  if (tierCount <= 0 || payableCount <= 0) return 0;
  const sorted = [...tiers].sort((a, b) => b.min - a.min);
  const hit = sorted.find((t) => tierCount >= t.min) || tiers[0];
  return payableCount * hit.rate;
}

function monthsSince(hireDate, monthKey) {
  if (!hireDate) return 0;
  const [y, m] = monthKey.split('-').map(Number);
  const monthEnd = new Date(y, m, 0);
  const hire = new Date(hireDate);
  if (isNaN(hire.getTime())) return 0;
  return Math.max(0, (monthEnd.getFullYear() - hire.getFullYear()) * 12 + (monthEnd.getMonth() - hire.getMonth()));
}

function tenureBucketOf(months) {
  if (months < 6) return 'under6';
  if (months < 12) return 'under12';
  if (months < 24) return 'over12';
  return 'over24';
}

function daysInMonth(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

function emptyDayMatrix() { return MATRIX_ROWS.map(() => MATRIX_COLS.map(() => 0)); }

const DAILY_GROUP_DEFS = [
  { key: 'homeBase', label: '홈 실적 (그레이드 대상)', bucket: 'home' },
  { key: 'homeFlat', label: '홈 단독 / TV프리 / 스마트홈', bucket: 'home' },
  { key: 'homeAddon', label: '동시판매 수수료', bucket: 'home' },
  { key: 'renew', label: '인터넷 재약정', bucket: 'home' },
  { key: 'bundle2nd', label: '2ND 번들 판매', bucket: 'extra' },
  { key: 'vas', label: '전략 부가서비스 (VAS)', bucket: 'extra' },
  { key: 'sono', label: '소노', bucket: 'extra' },
  { key: 'mnpBundle', label: '중고MNP 결합', bucket: 'extra' },
];

const DAILY_GROUP_KEYS = DAILY_GROUP_DEFS.map((g) => g.key);

const DAILY_NUMERIC_KEYS = ['custRegCount', 'tailoredCount', 'tailoredAmount', 'specialMatrixOffset', 'specialVasOffset', 'specialReplacementPay', 'bundleFreeOffset', 'bundleFreeVasOffset', 'renewSoloDiscountAmount'];

const HOME_KPI_MAP = [
  { kpiKey: 'kpiHome', sources: ['homeBase.homeOnly', 'homeBase.homeTv'] },
  { kpiKey: 'kpiTv', sources: ['homeBase.homeTv'] },
  { kpiKey: 'kpiTvSetTop', sources: ['homeAddon.addSetTop', 'homeFlat.tvFree'] },
  { kpiKey: 'kpiSmartHome', sources: ['homeFlat.smartHome', 'homeAddon.smartHomeSimul'] },
  { kpiKey: 'kpiInternetRenew', sources: [] },
  { kpiKey: 'kpiTvRenew', sources: [] },
];

function emptyDay() {
  return {
    matrix: emptyDayMatrix(),
    groups: Object.fromEntries(DAILY_GROUP_KEYS.map((k) => [k, {}])),
    custRegCount: 0, tailoredCount: 0, tailoredAmount: 0, specialMatrixOffset: 0, specialVasOffset: 0, specialReplacementPay: 0, bundleFreeOffset: 0, bundleFreeVasOffset: 0, renewSoloDiscountAmount: 0,
    householdRenewals: [], householdRenewLegacyCounts: {},
    dayOff: false, inputConfirmed: false, inputConfirmedAt: null,
  };
}

function normalizeDay(raw) {
  const base = emptyDay();
  if (!raw) return base;
  if (Array.isArray(raw)) return { ...base, matrix: raw };
  return {
    ...base,
    matrix: raw.matrix || base.matrix,
    groups: { ...base.groups, ...(raw.groups || {}) },
    custRegCount: raw.custRegCount || 0,
    tailoredCount: raw.tailoredCount || 0,
    tailoredAmount: raw.tailoredAmount || 0,
    specialMatrixOffset: raw.specialMatrixOffset || 0,
    specialVasOffset: raw.specialVasOffset || 0,
    specialReplacementPay: raw.specialReplacementPay || 0,
    bundleFreeOffset: raw.bundleFreeOffset || 0,
    bundleFreeVasOffset: raw.bundleFreeVasOffset || 0,
    renewSoloDiscountAmount: raw.renewSoloDiscountAmount || 0,
    householdRenewals: Array.isArray(raw.householdRenewals) ? raw.householdRenewals : [],
    householdRenewLegacyCounts: raw.householdRenewLegacyCounts && typeof raw.householdRenewLegacyCounts==='object' ? raw.householdRenewLegacyCounts : {},
    dayOff: !!raw.dayOff,
    inputConfirmed: !!raw.inputConfirmed,
    inputConfirmedAt: raw.inputConfirmedAt || null,
  };
}

function mobileTeamCreditMetrics({ri,ci,vasKeys=[],bundle2ndKeys=[],usedMnpBundle=false,specialMatrixOffset=0,specialVasOffset=0,specialReplacementPay=0,bundleFreeOffset=0,bundleFreeVasOffset=0}){
  const day=emptyDay();
  day.matrix[ri][ci]=1;
  vasKeys.filter(key=>key!=='vasNone').forEach(key=>{day.groups.vas[key]=Number(day.groups.vas[key]||0)+1});
  bundle2ndKeys.forEach(key=>{day.groups.bundle2nd[key]=Number(day.groups.bundle2nd[key]||0)+1});
  if(usedMnpBundle)day.groups.mnpBundle.usedMnpBundle=1;
  return {...day,specialMatrixOffset,specialVasOffset,specialReplacementPay,bundleFreeOffset,bundleFreeVasOffset};
}

function homeTeamCreditMetrics(products=[]){
  const day=emptyDay();
  products.forEach(product=>{day.groups[product.groupKey][product.itemKey]=Number(day.groups[product.groupKey][product.itemKey]||0)+1});
  return day;
}

function calendarCoreMetrics(raw){
  const d=normalizeDay(raw);
  const rawObj=(raw && !Array.isArray(raw) && typeof raw==='object')?raw:{};

  const matrix=Array.isArray(raw)?raw:(rawObj.matrix||d.matrix||[]);
  const hs=[0,1,2,3,4].reduce((sum,ri)=>sum+(matrix?.[ri]||[]).reduce((a,v)=>a+Number(v||0),0),0);
  const sim=(matrix?.[5]||[]).reduce((a,v)=>a+Number(v||0),0);

  // 현행 groups.homeBase / 구형 top-level homeBase 모두 호환
  const groupedHome={
    ...(rawObj.homeBase||{}),
    ...(rawObj.groups?.homeBase||{}),
    ...(d.groups?.homeBase||{}),
  };
  const flatHome={
    ...(rawObj.homeFlat||{}),
    ...(rawObj.groups?.homeFlat||{}),
    ...(d.groups?.homeFlat||{}),
  };

  // 홈은 본 판매 기준. 구형 데이터 중 본상품 키 없이 속도 단독키만 남은 경우도 1건으로 인식.
  const baseHome=Number(groupedHome.homeOnly||0)+Number(groupedHome.homeTv||0);
  const speedHome=Number(flatHome.home100Only||0)+Number(flatHome.home500Only||0)+Number(flatHome.home1GBOnly||0);
  const home=baseHome>0?baseHome:speedHome;

  return {hs,sim,home};
}

function dayHasPerformanceData(raw) {
  if (!raw) return false;
  const d = normalizeDay(raw);
  if (d.matrix.some((row) => row.some((v) => v > 0))) return true;
  if (DAILY_GROUP_KEYS.some((k) => Object.values(d.groups[k] || {}).some((v) => v > 0))) return true;
  if ((d.householdRenewals||[]).length > 0) return true;
  return DAILY_NUMERIC_KEYS.some((k) => (d[k] || 0) > 0);
}

function dayHasData(raw) {
  if (!raw) return false;
  const d = normalizeDay(raw);
  return d.inputConfirmed || dayHasPerformanceData(d);
}

function aggregateDaily(daysMap, monthKey) {
  const agg = emptyDay();
  const n = daysInMonth(monthKey);
  for (let i = 1; i <= n; i++) {
    const raw = daysMap && daysMap[String(i).padStart(2, '0')];
    if (!raw) continue;
    const d = normalizeDay(raw);
    d.matrix.forEach((row, ri) => row.forEach((v, ci) => { agg.matrix[ri][ci] += v || 0; }));
    DAILY_GROUP_KEYS.forEach((gk) => {
      Object.entries(d.groups[gk] || {}).forEach(([k, v]) => { agg.groups[gk][k] = (agg.groups[gk][k] || 0) + (v || 0); });
    });
    DAILY_NUMERIC_KEYS.forEach((k) => { agg[k] += d[k] || 0; });
  }
  return agg;
}

function applyDailyToDraft(draft, dailyDaysMap, month, categoryMap, gibyeonColumnMap) {
  const agg = aggregateDaily(dailyDaysMap, month);
  const aggMatrix = agg.matrix;
  const colMap = gibyeonColumnMap || DEFAULT_GIBYEON_COLUMN_MAP;

  // 이 항목들은 이제 일일입력이 유일한 입력 경로라, "0이면 옛 값 유지" 하지 않고
  // 매번 그 달 일일 합계로 완전히 덮어씀 (삭제/정정이 그대로 반영되게)
  const trackedMobileKeys = new Set([
    ...(categoryMap || []).map((m) => m?.mobilePointKey).filter(Boolean),
    ...colMap.filter(Boolean),
  ]);
  const trackedKpiKeys = new Set([
    ...(categoryMap || []).map((m) => m?.kpiKey).filter(Boolean),
    ...HOME_KPI_MAP.map((m) => m.kpiKey),
  ]);

  const autoMobilePoint = Object.fromEntries([...trackedMobileKeys].map((k) => [k, 0]));
  const autoKpi = Object.fromEntries([...trackedKpiKeys].map((k) => [k, 0]));

  aggMatrix.forEach((row, ri) => {
    const rowTotal = row.reduce((s, v) => s + v, 0);
    const map = categoryMap?.[ri];
    if (!map) return;
    if (MATRIX_ROW_DEFS[ri]?.isGibyeon) {
      // 기변A/B/C 공통: 타겟과 무관하게 요금제군(열) 기준으로 성과등급P 배분
      row.forEach((cnt, ci) => {
        const key = colMap[ci];
        if (key) autoMobilePoint[key] = (autoMobilePoint[key] || 0) + (cnt || 0);
      });
    } else if (map.mobilePointKey) {
      autoMobilePoint[map.mobilePointKey] = (autoMobilePoint[map.mobilePointKey] || 0) + rowTotal;
    }
    if (map.kpiKey) autoKpi[map.kpiKey] = (autoKpi[map.kpiKey] || 0) + rowTotal;
  });

  // 홈/2ND/VAS/소노 등 건수 그룹 — 이제 일일입력이 유일한 입력 경로라 그 달 합계로 완전히 교체
  const mergedGroups = {};
  DAILY_GROUP_KEYS.forEach((gk) => { mergedGroups[gk] = { ...(agg.groups[gk] || {}) }; });

  const pick = (path) => {
    const [gk, k] = path.split('.');
    return (mergedGroups[gk] || {})[k] || 0;
  };
  HOME_KPI_MAP.forEach((m) => {
    const total = m.sources.reduce((s, p) => s + pick(p), 0);
    autoKpi[m.kpiKey] = (autoKpi[m.kpiKey] || 0) + total;
  });

  // v21.54: 재약정 KPI는 실제 계약 건수 기준으로 계산
  let internetRenewKpiCount = 0;
  let tvRenewKpiCount = 0;
  Object.values(dailyDaysMap || {}).forEach((raw) => {
    const rec = normalizeDay(raw);
    (rec.householdRenewals || []).forEach((item) => {
      internetRenewKpiCount += 1;
      if (!item.homeOnly) tvRenewKpiCount += 1;
    });
  });
  autoKpi.kpiInternetRenew = internetRenewKpiCount;
  autoKpi.kpiTvRenew = tvRenewKpiCount;

  const numeric = {};
  DAILY_NUMERIC_KEYS.forEach((k) => { numeric[k] = agg[k] || 0; });
  const septemberWeekendSimMnpCount = month === '2026-09'
    ? countSeptemberWeekendSimMnp(Object.fromEntries(
        Object.entries(dailyDaysMap || {}).map(([dayKey, raw]) => [dayKey, normalizeDay(raw)])
      ))
    : 0;

  return {
    ...draft,
    ...mergedGroups,
    ...numeric,
    matrix: aggMatrix,
    mobilePoint: { ...draft.mobilePoint, ...autoMobilePoint },
    kpi: { ...draft.kpi, ...autoKpi },
    septemberWeekendSimMnpCount,
  };
}

function computePay(draft, position, hireDate, month, config, mobileSpotPay = 0, strategicMetric = null) {
  const months = monthsSince(hireDate, month);
  const bucketKey = tenureBucketOf(months);
  const bucket = config.tenure.find((t) => t.key === bucketKey) || config.tenure[0];

  const mobileItems = config.mobilePointItems || DEFAULT_MOBILE_POINT_ITEMS;
  const kpiItems = config.kpiItems || DEFAULT_KPI_ITEMS;
  const baseKpiScore = sumPoint(draft.kpi || {}, kpiItems);

  // 영업 활동 지원 정책 대상 = HS + SIM MNP + 2ND
  // mobilePoint에는 HS/SIM MNP/2ND단독이 들어오고, 2ND 번들 판매건은 별도 그룹이므로 추가 합산합니다.
  const baseActivityCount = mobileItems
    .filter((i) => i.countsTenure !== false)
    .reduce((sum, item) => sum + Number(draft.mobilePoint?.[item.key] || 0), 0);
  const secondPolicy = calculateSecondPolicy({
    secondOnlyCount: draft.mobilePoint?.secondOnly,
    bundleCounts: draft.bundle2nd || {},
    pointRate: Number(mobileItems.find((item) => item.key === 'secondOnly')?.point || 0),
  });
  const bundle2ndActivityCount = secondPolicy.bundled;
  const activityCount = baseActivityCount + bundle2ndActivityCount;
  // 2ND 번들도 단독 2ND와 동일하게 생산성 0.2P를 인정합니다.
  // 단독은 draft.kpi에 이미 들어오므로 번들 건만 추가합니다.
  const bundle2ndKpiPoints=Number((secondPolicy.bundled*Number(kpiItems.find(item=>item.key==='kpiSecond')?.point||0.2)).toFixed(10));
  const kpiScore=baseKpiScore+bundle2ndKpiPoints;

  const supportCap = Number(config.tenureCap ?? DEFAULT_ACTIVITY_SUPPORT_MAX);
  // 6개월 미만: 실적 무관 230만원
  // 6~12개월: 건당 20만원 / 12~24개월: 15만원 / 24개월 이상: 10만원, 공통 MAX 230만원
  const tenurePay = calculateActivitySupport({monthsEmployed:months,activityCount,rate:bucket?.rate,cap:supportCap});

  // 2ND 성과등급P는 단독/번들 구분 없이 동일하게 인정합니다.
  // 단독은 mobilePoint.secondOnly에 포함되고, 번들은 bundle2nd에 별도 저장되므로
  // 번들 건수에 현재 2ND 성과등급 배점을 곱해 추가합니다. 무료판매도 실적은 인정됩니다.
  const bundle2ndPoints = Number((secondPolicy.bundled * Number(mobileItems.find((item) => item.key === 'secondOnly')?.point || 0)).toFixed(10));
  const mobilePoints = sumPoint(draft.mobilePoint || {}, mobileItems) + bundle2ndPoints;
  const homeAddonPoints = sumPoint(draft.homeBase || {}, HOME_BASE_ITEMS)
    + Number(draft.homeFlat?.tvFree || 0) * 0.5
    + Number(draft.homeFlat?.smartHome || 0) * 0.5;
  const homeGatePoints = Number(draft.homeBase?.homeOnly || 0) * HOME_GATE_WEIGHTS.homeOnly
    + Number(draft.homeBase?.homeTv || 0) * HOME_GATE_WEIGHTS.homeTv
    + Number(draft.homeFlat?.tvFree || 0) * HOME_GATE_WEIGHTS.tvFree
    + Number(draft.homeFlat?.smartHome || 0) * HOME_GATE_WEIGHTS.smartHome;
  const addonApplies = mobilePoints > ADDON_GATE;
  const totalPoints = mobilePoints + (addonApplies ? homeAddonPoints : 0);
  const gradeEligible = homeGatePoints >= HOME_GATE_MIN;
  const gradeSorted = [...config.grades].sort((a, b) => b.min - a.min);
  const gradeHit = gradeEligible
    ? (gradeSorted.find((g) => totalPoints >= g.min) || config.grades[config.grades.length - 1])
    : config.grades[config.grades.length - 1];
  const gradeBonus = gradeEligible ? Number(gradeHit.bonus || 0) : 0;
  const gradeAsc = [...config.grades].sort((a, b) => a.min - b.min);
  const nextGrade = gradeAsc.find((g) => g.min > totalPoints) || null;
  const currentTierMin = gradeHit.min || 0;
  const gradeProgress = nextGrade
    ? Math.max(0, Math.min(1, (totalPoints - currentTierMin) / (nextGrade.min - currentTierMin)))
    : 1;

  const specialMatrixOffset = Number(draft.specialMatrixOffset || 0);
  const specialVasOffset = Number(draft.specialVasOffset || 0);
  const specialReplacementPay = Number(draft.specialReplacementPay || 0);
  const bundleFreeOffset = Number(draft.bundleFreeOffset || 0);
  const bundleFreeVasOffset = Number(draft.bundleFreeVasOffset || 0);

  const legacyHomeAnyCount = Number(draft.homeBase?.homeOnly || 0) + Number(draft.homeBase?.homeTv || 0)
    + Number(draft.homeFlat?.home1GBOnly || 0) + Number(draft.homeFlat?.home500Only || 0) + Number(draft.homeFlat?.home100Only || 0)
    + Number(draft.homeFlat?.tvFree || 0) + Number(draft.homeFlat?.smartHome || 0);
  const homeAnyCount = draft.homePolicy?.source === 'orders'
    ? Math.max(legacyHomeAnyCount, completedHomeCount(draft))
    : legacyHomeAnyCount;
  const homeNoPerformance = homeAnyCount === 0;
  const penaltyFactor = homeNoPerformance ? 0.5 : 1;

  const commissionParts = calculateMobileCommissionParts({
    matrix:draft.matrix||[],matrixRates:config.matrix||[],specialMatrixOffset,
    vasCounts:draft.vas||{},vasRates:config.vas||[],specialVasOffset,bundleFreeVasOffset,
    bundleCounts:draft.bundle2nd||{},bundleRates:config.bundle2nd||[],bundleFreeOffset,
    penaltyFactor,
  });
  const {matrixTotal,adjustedMatrixTotal,rawBundle2ndTotal,bundle2ndTotal,rawVasPay,vasPay,mobilePlanPay,bundle2ndPay,mobileMatrixPay}=commissionParts;

  const positionAllowance = Number(config.positionAllowance?.[position] || 0);
  const activityPenalty = draft.activityTimeMet ? 0 : Number(config.basePenalty || 0);
  const minimumGuarantee = Math.max(0, Number(config.basePay?.[position] || 0) - activityPenalty);

  // 최저보장 비교 대상:
  // 영업 활동 지원 정책 + 요금제 + VAS + 2ND + 모바일 승인 스팟 + 직책수당
  // 특판·지인판매 대체 인센티브는 요금제/VAS 대체 성격이므로 모바일 비교 대상에 포함합니다.
  const approvedMobileSpotPay = Math.max(0, Number(mobileSpotPay || 0));
  // 최저보장 비교 후 별도로 추가되는 항목
  // v21.63: 고객별 home_orders가 있으면 새 홈 정책으로 재계산하고,
  // 구버전 집계만 존재하면 기존 계산을 fallback으로 유지합니다.
  const legacyHomeGradeQualCount = Number(draft.homeBase?.homeTv || 0);
  const legacyHomeTierCount = Number(draft.homeBase?.homeOnly || 0) + Number(draft.homeBase?.homeTv || 0)
    + Number(draft.homeFlat?.home1GBOnly || 0) + Number(draft.homeFlat?.home500Only || 0) + Number(draft.homeFlat?.home100Only || 0);
  const homePolicy = draft.homePolicy?.source==='orders' ? draft.homePolicy : null;
  const homeCaseCount = homePolicy ? Number(homePolicy.totalInternetCount||0) : legacyHomeTierCount;
  const homeGradePay = homePolicy ? Number(homePolicy.gradePay||0) : homeGradeTotal(legacyHomeTierCount, legacyHomeGradeQualCount, config.homeTiers);
  const homeFlatPay = homePolicy ? Number(homePolicy.homeFlatPay||0) : calculateFlatIncentive(draft.homeFlat || {}, config.homeFlat || []);
  const tvFreeRate = config.homeFlat.find((t) => t.key === 'tvFree')?.rate || 0;
  const smartHomeRate = config.homeFlat.find((t) => t.key === 'smartHome')?.rate || 0;
  const tvFreePay = homePolicy ? Number(homePolicy.tvFreePay||0) : Number(draft.homeFlat?.tvFree || 0) * tvFreeRate;
  const smartHomePay = homePolicy ? Number(homePolicy.smartHomePay||0) : Number(draft.homeFlat?.smartHome || 0) * smartHomeRate;
  // 홈 동시판매 수수료는 본 홈 상품이 존재할 때만 지급합니다.
  // 구버전 홈 건을 삭제한 뒤 addMnp 같은 부가 집계만 남아 30만원이 표시되는 것을 방지합니다.
  const homeAddonPay = homePolicy
    ? Number(homePolicy.homeAddonPay||0)
    : homeAnyCount>0 ? calculateFlatIncentive(draft.homeAddon || {}, config.homeAddon || []) : 0;
  const renewPay = Math.max(0, calculateFlatIncentive(draft.renew || {}, config.renew || []) - Number(draft.renewSoloDiscountAmount || 0));
  const mnpBundlePay = calculateFlatIncentive(draft.mnpBundle || {}, config.mnpBundle || []);
  const septemberPolicy=config.policyVersion===SEPTEMBER_POLICY_VERSION;
  const sonoPay = septemberPolicy
    ? (config.sono||[]).reduce((sum,item)=>sum+calculateSeptemberSono(Number(draft.sono?.[item.key]||0),Number(item.rate||0),Number(item.achievedRate||item.rate||0)),0)
    : calculateFlatIncentive(draft.sono || {}, config.sono || []);
  const custRegBonus = tierBonus(Number(draft.custRegCount || 0), config.custRegTiers);
  const tailoredBonus = septemberPolicy
    ? calculateSeptemberTailoredTier(Number(draft.tailoredCount||0)).amount
    : tierBonus(Number(draft.tailoredCount || 0), config.tailoredTiers);
  const tailoredAmountBonus = Number(draft.tailoredAmount || 0);
  const sonoCount = Object.values(draft.sono || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  const strategicPoints = Number(strategicMetric?.strategicPointsWithoutDaemyung || 0)
    + Math.max(Number(strategicMetric?.daemyungCount || 0), sonoCount) * 2;
  const employeeStrategic = month >= SEPTEMBER_POLICY_MONTH
    ? calculateEmployeeStrategicAdjustment({hsCount:hsCount(draft),simMnpCount:Object.values(draft.mnpBundle||{}).reduce((s,v)=>s+Number(v||0),0),strategicPoints})
    : {ratio:null,amount:0,band:'not_applicable'};
  const septemberWeekendSimMnpPolicy = calculateSeptemberWeekendSimMnpBonus(
    month === '2026-09' ? draft.septemberWeekendSimMnpCount : 0
  );

  const settlement=calculatePayrollSettlement({
    minimumGuarantee,tenurePay,mobilePlanPay,bundle2ndPay,vasPay,approvedMobileSpotPay,
    specialReplacementPay,strategicAdjustment:employeeStrategic.amount,positionAllowance,
    extras:{gradeBonus,homeGradePay,homeFlatPay,homeAddonPay,renewPay,mnpBundlePay,septemberWeekendSimMnpBonus:septemberWeekendSimMnpPolicy.amount,sonoPay,custRegBonus,tailoredBonus,tailoredAmountBonus},
  });
  const {mobileGuaranteeBasis,guaranteedComponent,postGuaranteeExtras,currentPerformanceAmount,closingAmount,total}=settlement;

  // 기존 화면/RAW 호환용
  const positionBase = minimumGuarantee;
  const otherComponents = mobileGuaranteeBasis - positionAllowance;
  const activitySupportFloor = supportCap;
  const performanceComponents = mobileGuaranteeBasis - positionAllowance;
  const performanceWithAllowance = mobileGuaranteeBasis;

  return {
    months, bucket, activityCount, baseActivityCount, bundle2ndActivityCount, tenurePay,
    mobilePoints, bundle2ndPoints, homeGatePoints, homeAddonPoints, addonApplies, totalPoints,
    gradeEligible, grade: gradeHit.grade, gradeBonus, nextGrade, gradeProgress, currentTierMin,
    matrixTotal, adjustedMatrixTotal, specialMatrixOffset, specialVasOffset, specialReplacementPay,
    rawBundle2ndTotal, bundleFreeOffset, bundleFreeVasOffset, bundle2ndTotal,
    rawVasPay, vasPay, approvedMobileSpotPay, mobileMatrixPay, mobilePlanPay, bundle2ndPay,
    positionBase, positionAllowance, otherComponents, activitySupportFloor, minimumGuarantee,
    performanceComponents, performanceWithAllowance, mobileGuaranteeBasis, guaranteedComponent,
    currentPerformanceAmount, closingAmount, postGuaranteeExtras,
    homeAnyCount, homeNoPerformance,
    homeCaseCount, homeGradePay, homeFlatPay, tvFreePay, smartHomePay, homeAddonPay, homePolicy, renewPay,
    mnpBundlePay, septemberWeekendSimMnpPolicy, sonoPay, custRegBonus, tailoredBonus, tailoredAmountBonus, kpiScore, bundle2ndKpiPoints,
    strategicPoints, strategicRatio:employeeStrategic.ratio, strategicAdjustment:employeeStrategic.amount,
    strategicAdjustmentBand:employeeStrategic.band, total,
  };
}

function mobileStrategicPoint({strategicPlan=false,vasKeys=[],bundleVasMap={}}={}){
  return calculateSaleStrategicPoints({strategicPlan,vasKeys,bundleVasMap});
}

const HOME_ORDER_PRODUCTS = [
  { key: 'homeOnly', label: '홈 단독' },
  { key: 'homeTv', label: 'TV(주)' },
  { key: 'internet1g', label: '인터넷 1GB' },
  { key: 'internet500', label: '인터넷 500MB' },
  { key: 'internet100', label: '인터넷 100MB' },
  { key: 'tvFree', label: 'TV프리(부)' },
  { key: 'smartHome', label: '스마트홈' },
  { key: 'subSetTop', label: 'TV부셋탑' },
  { key: 'simulNewChange', label: '홈 + HS 신규/기변 동시판매' },
  { key: 'simulMnp', label: '홈 + HS MNP 동시판매' },
  { key: 'simulUsedMnp', label: '홈 + 중고MNP 동시판매' },
];

async function notifyStoreManagers({ actorId, type, title, message, payload = {}, storeName = null }) {
  if (!actorId) return;

  try {
    const { data: actor, error: actorError } = await supabase
      .from('profiles')
      .select('id, name, store_name')
      .eq('id', actorId)
      .maybeSingle();

    if (actorError || !(storeName||actor?.store_name)) return;

    const { data: managers, error: managersError } = await supabase
      .from('profiles')
      .select('id')
      .eq('store_name', storeName||actor.store_name)
      .eq('active', true)
      .eq('status', 'approved')
      .in('position', ['점장', '부점장']);

    if (managersError || !managers?.length) return;

    const rows = managers
      .filter((m) => m.id !== actorId)
      .map((m) => ({
        recipient_id: m.id,
        actor_id: actorId,
        type,
        title,
        message,
        payload,
      }));

    if (!rows.length) return;

    const { error } = await supabase.from('notifications').insert(rows);
    if (error) console.error('NOTIFICATION INSERT ERROR:', error);
  } catch (e) {
    console.error('NOTIFICATION ERROR:', e);
  }
}

const CARE_TEMPLATES = [
  { key:'plan93', category:'변경', label:'📱 93일 유지 후 요금제 변경', title:'요금제 변경 안내', retentionDays:93 },
  { key:'addon93', category:'변경', label:'🧾 93일 유지 후 부가서비스 해지', title:'부가서비스 해지 안내', retentionDays:93 },
  { key:'plan183', category:'변경', label:'📱 183일 유지 후 요금제 변경', title:'요금제 변경 안내', retentionDays:183 },
  { key:'payment3', category:'수납지원', label:'💳 N개월간 요금 수납 약속', title:'요금 수납', repeatCount:3 },
  { key:'affiliateCard', category:'제휴카드', label:'💳 통신사 제휴카드 할인', title:'제휴카드 할인 진행', staged:true },
];

const AFFILIATE_CARD_STAGES = {
  before_application:'신청 전',
  applied_unreceived:'신청완료 · 미수령',
  received_not_visited:'수령 · 미방문',
};

const AFFILIATE_CARD_NAMES = ['신한카드','국민카드','현대카드','우리카드','삼성카드','롯데카드','하나카드','농협카드'];

function careTaskCategory(task){
  const type=String(task?.task_type||'');
  if(type==='affiliateCard')return '제휴카드';
  if(type.startsWith('payment3_'))return '수납지원';
  if(['plan93','addon93','plan183'].includes(type))return '변경';
  return '케이스 및 기타';
}

function addDaysDate(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + Number(days || 0));
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function addMonthsDate(dateStr, months) {
  const [year,month,day]=String(dateStr||'').split('-').map(Number);
  if(!year||!month||!day)return '';
  const target=new Date(year,month-1+Number(months||0),1,12);
  const lastDay=new Date(target.getFullYear(),target.getMonth()+1,0).getDate();
  target.setDate(Math.min(day,lastDay));
  return `${target.getFullYear()}-${String(target.getMonth()+1).padStart(2,'0')}-${String(target.getDate()).padStart(2,'0')}`;
}

async function ensureCustomer(userId, customerName, saleDate) {
  const clean=String(customerName||'').trim();
  if(!userId||!clean)return null;

  const {data:found,error:findError}=await supabase
    .from('customers')
    .select('id')
    .eq('user_id',userId)
    .eq('customer_name',clean)
    .maybeSingle();

  if(findError) throw findError;
  if(found?.id){
    const {error}=await supabase.from('customers').update({last_sale_date:saleDate,updated_at:new Date().toISOString()}).eq('id',found.id).eq('user_id',userId).select('id').single();
    if(error)throw error;
    return found.id;
  }

  const {data,error}=await supabase
    .from('customers')
    .insert({user_id:userId,customer_name:clean,first_sale_date:saleDate,last_sale_date:saleDate})
    .select('id')
    .single();

  if(error) throw error;
  return data?.id||null;
}

async function ensurePromiseCustomer(userId,customerName){
  const clean=String(customerName||'').trim();
  if(!userId||!clean)return null;
  const {data:found,error:findError}=await supabase.from('customers').select('id').eq('user_id',userId).eq('customer_name',clean).maybeSingle();
  if(findError)throw findError;
  if(found?.id)return found.id;
  const {data,error}=await supabase.from('customers').insert({user_id:userId,customer_name:clean}).select('id').single();
  if(error)throw error;
  return data?.id||null;
}

function buildMobileTasks({userId,customerId=null,saleId, saleDate,templateKeys=[],customTitle='',customDueDate='',note='',targetPlan='',paymentFirstDate='',paymentCount=3,affiliateCard=null}) {
  const rows=[];
  templateKeys.forEach(key=>{
    const t=CARE_TEMPLATES.find(x=>x.key===key);
    if(!t)return;
    if(t.repeatCount){
      if(!paymentFirstDate)return;
      const repeatCount=Math.max(1,Number(paymentCount||t.repeatCount));
      for(let i=0;i<repeatCount;i++)rows.push({
        user_id:userId,customer_id:customerId,source_sale_id:saleId,
        task_type:`${key}_${i+1}`,title:`${t.title} (${i+1}/${repeatCount}회)`,base_date:saleDate,
        retention_days:null,due_date:addMonthsDate(paymentFirstDate,i),status:'pending',
        note:'모든 회차를 완료할 때까지 각 기한에 반복 표시'
      });
      return;
    }
    if(key==='affiliateCard'){
      rows.push({
        user_id:userId,customer_id:customerId,source_sale_id:saleId,
        task_type:key,title:t.title,base_date:saleDate,retention_days:null,due_date:saleDate,status:'pending',
        task_meta:{
          card_name:String(affiliateCard?.cardName||'').trim(),
          card_stage:'before_application',
          approval_required:!!affiliateCard?.approvalRequired,
          approval_completed:false,
          autopay_registered:false
        }
      });
      return;
    }
    rows.push({
      user_id:userId,customer_id:customerId,source_sale_id:saleId,
      task_type:key,title:t.title,base_date:saleDate,retention_days:t.retentionDays,
      due_date:addDaysDate(saleDate,t.retentionDays),status:'pending',note:note||null,
      target_plan:(key==='plan93'||key==='plan183') ? String(targetPlan||'').trim()||null : null
    });
  });

  if(String(customTitle||'').trim() && customDueDate){
    rows.push({
      user_id:userId,customer_id:customerId,source_sale_id:saleId,
      task_type:'custom',title:String(customTitle).trim(),base_date:saleDate,
      retention_days:null,due_date:customDueDate,status:'pending',note:note||null
    });
  }

  return rows.map(row=>({...row,task_meta:row.task_meta||{}}));
}

function CareTemplatePicker({
  selected, setSelected, customTitle, setCustomTitle, customDueDate, setCustomDueDate, saleDate,
  targetPlan='', setTargetPlan=()=>{}, paymentFirstDate='', setPaymentFirstDate=()=>{}, paymentCount=3, setPaymentCount=()=>{},
  affiliateCard={cardName:'',approvalRequired:false}, setAffiliateCard=()=>{}
}) {
  const toggle=(key)=>setSelected(selected.includes(key)?selected.filter(x=>x!==key):[...selected,key]);
  return <div className="space-y-2">
    <div className="text-xs font-semibold text-gray-600">📌 고객 약속 / 유지조건 <span className="font-normal text-gray-400">(선택)</span></div>
    <div className="grid grid-cols-1 gap-1.5">
      {CARE_TEMPLATES.map(t=>{
        const on=selected.includes(t.key);
        return <button key={t.key} type="button" onClick={()=>toggle(t.key)}
          className={`text-left px-3 py-2 rounded-xl border text-xs ${on?'bg-brand-50 border-brand-200 text-brand-700':'bg-white border-gray-100 text-gray-600'}`}>
          <div className="flex items-center gap-1.5"><span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{t.category}</span><span className="font-semibold">{on?'✓ ':''}{t.label}</span></div>
          {on&&t.retentionDays&&<div className="text-[10px] mt-0.5 opacity-70">변경 가능일 {addDaysDate(saleDate,t.retentionDays)} · {t.retentionDays===93?'94일째':'184일째'}</div>}
        </button>
      })}
    </div>
    {selected.includes('payment3')&&<div className="rounded-xl border border-brand-100 bg-brand-50/50 p-3">
      <div className="flex items-center justify-between"><div className="text-[11px] font-semibold text-gray-600">첫 수납 예정일</div><b className="text-[11px] text-brand-700">총 {paymentCount}개월</b></div>
      <input type="date" value={paymentFirstDate} onChange={e=>setPaymentFirstDate(e.target.value)} className="mt-1.5 w-full border rounded-lg px-2.5 py-2 text-xs bg-white"/>
      {paymentFirstDate&&<div className="mt-2 text-[10px] leading-relaxed text-brand-700">{Array.from({length:paymentCount},(_,i)=>`${i+1}회 ${addMonthsDate(paymentFirstDate,i)}`).join(' · ')}</div>}
      <div className="grid grid-cols-2 gap-2 mt-2"><button type="button" disabled={paymentCount<=1} onClick={()=>setPaymentCount(Math.max(1,paymentCount-1))} className="py-2 rounded-lg bg-white border text-[11px] font-semibold text-gray-500 disabled:opacity-40">− 마지막 회차 삭제</button><button type="button" onClick={()=>setPaymentCount(paymentCount+1)} className="py-2 rounded-lg bg-brand-600 text-white text-[11px] font-bold">+ 다음 회차 추가</button></div>
      <div className="mt-1.5 text-[10px] leading-relaxed text-gray-500">한 회차를 완료해도 다음 회차는 그대로 유지되며, 모든 회차를 완료할 때까지 각 기한에 반복 표시돼요.</div>
    </div>}
    {selected.includes('affiliateCard')&&<div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 space-y-2">
      <div className="text-[11px] font-semibold text-gray-700">통신사 제휴카드</div>
      <select value={affiliateCard.cardName||''} onChange={e=>setAffiliateCard({...affiliateCard,cardName:e.target.value})} className="w-full border rounded-lg px-2.5 py-2 text-xs bg-white">
        <option value="">카드사를 선택해주세요</option>
        {AFFILIATE_CARD_NAMES.map(name=><option key={name} value={name}>{name}</option>)}
      </select>
      <label className="flex items-center gap-2 rounded-lg bg-white border border-blue-100 px-3 py-2 text-xs text-gray-600">
        <input type="checkbox" checked={!!affiliateCard.approvalRequired} onChange={e=>setAffiliateCard({...affiliateCard,approvalRequired:e.target.checked})}/>
        카드 수령 후 별도 승인이 필요해요
      </label>
      <div className="text-[10px] leading-relaxed text-gray-500">신청 → 수령 → 승인(필요 시) → 자동이체 등록 → 최종 완료까지 단계별로 관리해요.</div>
    </div>}
    {(selected.includes('plan93')||selected.includes('plan183'))&&(
      <div className="pt-1">
        <div className="text-[11px] font-semibold text-gray-500 mb-1.5">변경 예정 요금제</div>
        <input
          value={targetPlan}
          onChange={e=>setTargetPlan(e.target.value)}
          placeholder="예: 유쓰 55 / 5G 슬림+"
          className="w-full border rounded-lg px-2.5 py-2 text-xs"
        />
        <div className="text-[10px] text-gray-400 mt-1">요금제 종류가 많아 자유롭게 입력해요.</div>
      </div>
    )}
    <div className="pt-1 text-[10px] font-semibold text-gray-400">케이스 · 직접 약속</div>
    <div className="grid grid-cols-2 gap-2">
      <input value={customTitle} onChange={e=>setCustomTitle(e.target.value)} placeholder="직접 약속 내용" className="border rounded-lg px-2 py-2 text-xs"/>
      <input type="date" value={customDueDate} onChange={e=>setCustomDueDate(e.target.value)} className="border rounded-lg px-2 py-2 text-xs"/>
    </div>
  </div>;
}

function StandalonePromiseModal({userId,month,selectedDay,onClose}){
  const [customers,setCustomers]=useState([]);
  const [query,setQuery]=useState('');
  const [selectedCustomer,setSelectedCustomer]=useState(null);
  const [newCustomer,setNewCustomer]=useState('');
  const [careKeys,setCareKeys]=useState([]);
  const [customTitle,setCustomTitle]=useState('');
  const [customDueDate,setCustomDueDate]=useState('');
  const [targetPlan,setTargetPlan]=useState('');
  const [paymentFirstDate,setPaymentFirstDate]=useState('');
  const [paymentCount,setPaymentCount]=useState(3);
  const [affiliateCard,setAffiliateCard]=useState({cardName:'',approvalRequired:false});
  const [saving,setSaving]=useState(false);
  const baseDate=`${month}-${selectedDay}`;

  useEffect(()=>{let alive=true;(async()=>{
    const [y,m]=String(month).split('-').map(Number),next=new Date(y,m,1);
    const monthEnd=`${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}-01`;
    const [{data:all},{data:sales},{data:tasks}]=await Promise.all([
      supabase.from('customers').select('id,customer_name,last_sale_date').eq('user_id',userId),
      supabase.from('customer_sales').select('customer_id').eq('user_id',userId).gte('sale_date',`${month}-01`).lt('sale_date',monthEnd),
      supabase.from('customer_tasks').select('customer_id').eq('user_id',userId).eq('status','pending')
    ]);
    if(!alive)return;
    const eligible=new Set([...(sales||[]).map(x=>x.customer_id),...(tasks||[]).map(x=>x.customer_id)]);
    setCustomers((all||[]).filter(c=>eligible.has(c.id)).sort((a,b)=>String(a.customer_name).localeCompare(String(b.customer_name),'ko')));
  })();return()=>{alive=false}},[userId,month]);

  const save=async()=>{
    const customerName=selectedCustomer?.customer_name||newCustomer.trim();
    if(!customerName)return showAppToast('기존 고객을 선택하거나 신규 고객명을 입력해주세요.',{tone:'error'});
    if(!careKeys.length&&!(customTitle.trim()&&customDueDate))return showAppToast('등록할 약속을 하나 이상 선택해주세요.',{tone:'error'});
    if(careKeys.includes('payment3')&&!paymentFirstDate)return showAppToast('3개월 요금 수납의 첫 수납 예정일을 선택해주세요.',{tone:'error'});
    if(careKeys.includes('affiliateCard')&&!affiliateCard.cardName)return showAppToast('제휴카드사를 선택해주세요.',{tone:'error'});
    setSaving(true);
    try{
      const customerId=selectedCustomer?.id||await ensurePromiseCustomer(userId,customerName);
      const rows=[];
      careKeys.forEach(key=>{
        const t=CARE_TEMPLATES.find(x=>x.key===key);if(!t)return;
        if(t.repeatCount){for(let i=0;i<paymentCount;i++)rows.push({user_id:userId,customer_id:customerId,source_sale_id:null,task_type:`${key}_${i+1}`,title:`${t.title} (${i+1}/${paymentCount}회)`,base_date:baseDate,retention_days:null,due_date:addMonthsDate(paymentFirstDate,i),status:'pending',note:'모든 회차를 완료할 때까지 각 기한에 반복 표시'});return;}
        if(key==='affiliateCard'){rows.push({user_id:userId,customer_id:customerId,source_sale_id:null,task_type:key,title:t.title,base_date:baseDate,retention_days:null,due_date:baseDate,status:'pending',task_meta:{card_name:affiliateCard.cardName,card_stage:'before_application',approval_required:!!affiliateCard.approvalRequired,approval_completed:false,autopay_registered:false}});return;}
        rows.push({user_id:userId,customer_id:customerId,source_sale_id:null,task_type:key,title:t.title,base_date:baseDate,retention_days:t.retentionDays,due_date:addDaysDate(baseDate,t.retentionDays),status:'pending',target_plan:(key==='plan93'||key==='plan183')?targetPlan.trim()||null:null});
      });
      if(customTitle.trim()&&customDueDate)rows.push({user_id:userId,customer_id:customerId,source_sale_id:null,task_type:'custom',title:customTitle.trim(),base_date:baseDate,retention_days:null,due_date:customDueDate,status:'pending'});
      const {error}=await supabase.from('customer_tasks').insert(rows.map(row=>({...row,task_meta:row.task_meta||{}})));if(error)throw error;
      showAppToast(`${customerName} 고객 약속을 등록했어요.`);onClose();
    }catch(error){showAppToast(friendlyError(error),{tone:'error',title:'고객 약속 등록 실패'});}finally{setSaving(false)}
  };
  const matches=customers.filter(c=>!query.trim()||String(c.customer_name||'').includes(query.trim()));

  return <div className="fixed inset-0 z-[120] bg-black/45 flex items-end sm:items-center justify-center" onClick={onClose}><div className="w-full max-w-sm max-h-[92vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl p-5" onClick={e=>e.stopPropagation()}>
    <div className="text-xs font-semibold text-brand-500">판매 없이도 등록 가능</div><div className="text-lg font-bold text-gray-900 mt-1">고객 약속 등록</div><div className="text-xs text-gray-400 mt-1">미완료 약속 고객과 {month} 판매 고객을 검색할 수 있어요.</div>
    <div className="mt-4 text-xs font-semibold text-gray-600">기존 고객 검색</div>
    <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="고객명 검색" className="mt-1.5 w-full border rounded-xl px-3 py-2.5 text-sm"/>
    {query.trim()&&<div className="mt-2 max-h-36 overflow-y-auto rounded-xl border divide-y">{matches.length?matches.map(c=><button key={c.id} type="button" onClick={()=>{setSelectedCustomer(c);setNewCustomer('')}} className={`w-full px-3 py-2.5 text-left text-xs ${selectedCustomer?.id===c.id?'bg-brand-50 text-brand-700 font-bold':'bg-white text-gray-600'}`}>{selectedCustomer?.id===c.id?'✓ ':''}{c.customer_name}</button>):<div className="px-3 py-3 text-xs text-gray-400">검색되는 기존 고객이 없어요.</div>}</div>}
    {selectedCustomer&&<div className="mt-2 rounded-xl bg-brand-50 border border-brand-100 px-3 py-2 text-xs text-brand-700">선택 고객 · <b>{selectedCustomer.customer_name}</b></div>}
    <div className="my-3 flex items-center gap-2 text-[10px] text-gray-400"><div className="h-px bg-gray-100 flex-1"/>또는 신규 고객<div className="h-px bg-gray-100 flex-1"/></div>
    <input value={newCustomer} onChange={e=>{setNewCustomer(e.target.value);setSelectedCustomer(null)}} placeholder="신규 고객명 입력" className="w-full border rounded-xl px-3 py-2.5 text-sm"/>
    <div className="mt-5"><CareTemplatePicker selected={careKeys} setSelected={setCareKeys} customTitle={customTitle} setCustomTitle={setCustomTitle} customDueDate={customDueDate} setCustomDueDate={setCustomDueDate} saleDate={baseDate} targetPlan={targetPlan} setTargetPlan={setTargetPlan} paymentFirstDate={paymentFirstDate} setPaymentFirstDate={setPaymentFirstDate} paymentCount={paymentCount} setPaymentCount={setPaymentCount} affiliateCard={affiliateCard} setAffiliateCard={setAffiliateCard}/></div>
    <div className="grid grid-cols-2 gap-2 mt-5"><button type="button" onClick={onClose} className="py-3 rounded-xl bg-gray-100 text-gray-600 text-sm font-bold">취소</button><button type="button" disabled={saving} onClick={save} className="py-3 rounded-xl bg-brand-600 text-white text-sm font-bold disabled:opacity-50">{saving?'등록 중...':'약속 등록'}</button></div>
  </div></div>;
}

function DailySaveBadge({ state, isOnline=true, onRetry }) {
  const base='inline-flex min-h-7 items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold whitespace-nowrap';
  if (!isOnline) return <button type="button" onClick={onRetry} className={`${base} border-red-100 bg-red-50 text-red-600`}><AlertTriangle size={11} />오프라인 · 임시저장</button>;
  if (state === 'error') return <button type="button" onClick={onRetry} className={`${base} border-red-100 bg-red-50 text-red-600`}><AlertTriangle size={11} />저장 실패 · 다시 시도</button>;
  if (state === 'pending') return <span className={`${base} border-amber-100 bg-amber-50 text-amber-700`}><UploadCloud size={11} />동기화 대기</span>;
  if (state === 'saved') return <span className={`${base} border-emerald-100 bg-emerald-50 text-emerald-700`}><Check size={11} />저장 완료</span>;
  return <span className={`${base} border-gray-100 bg-gray-50 text-gray-500`}><Check size={11} />동기화 정상</span>;
}

const HS_ROWS = [
  { label: '일반모델 MNP', short: 'MNP' },
  { label: '일반모델 기변A', short: '기변A' },
  { label: '일반모델 기변B', short: '기변B' },
  { label: '일반모델 기변C', short: '기변C' },
  { label: '일반모델 신규', short: '신규' },
];

const HS_PARTS = HS_ROWS.map((r) => ({ short: r.short, idx: MATRIX_ROWS.indexOf(r.label) })).filter((r) => r.idx >= 0);

const matrixRowCount = (d, ri) => ((d && d.matrix && d.matrix[ri]) || []).reduce((s, v) => s + (v || 0), 0);

const hsCount = (d) => HS_PARTS.reduce((s, p) => s + matrixRowCount(d, p.idx), 0);
export { CURRENT_SALE_SCHEMA_VERSION, FREE_PHONE_SPECIAL_TITLE, isIncentiveUnpaidSpecial, septemberPlanGroup, saleSchemaVersion, withCurrentSaleSchema, currentPolicySnapshot, legacySaleBadge, inferHomeProductTypeFromLabel, compatHomeRows, NON_SALES_STORES, HOME_GATE_MIN, ADDON_GATE, HOME_GATE_WEIGHTS, DEFAULT_MOBILE_POINT_ITEMS, DEFAULT_KPI_ITEMS, HOME_BASE_ITEMS, HOME_NETWORK_TYPES, homeNetworkLabel, homeMainTvPlanLabel, DEFAULT_RENEW, HOUSEHOLD_RENEW_PLANS, householdRenewBaseKey, renewRate, calculateHouseholdRenew, aggregateHouseholdRenewals, emptyHouseholdRenewForm, MATRIX_ROWS, DEFAULT_GIBYEON_COLUMN_MAP, DEFAULT_VAS, DEFAULT_BUNDLE2ND, DEFAULT_SONO, DEFAULT_MNP_BUNDLE, fmtCount, fmtShortDate, monthKeyOf, monthLabel, sumPoint, tierBonus, homeGradeTotal, monthsSince, tenureBucketOf, daysInMonth, emptyDayMatrix, DAILY_GROUP_DEFS, DAILY_GROUP_KEYS, DAILY_NUMERIC_KEYS, HOME_KPI_MAP, emptyDay, normalizeDay, mobileTeamCreditMetrics, homeTeamCreditMetrics, calendarCoreMetrics, dayHasPerformanceData, dayHasData, aggregateDaily, applyDailyToDraft, computePay, mobileStrategicPoint, HOME_ORDER_PRODUCTS, notifyStoreManagers, CARE_TEMPLATES, AFFILIATE_CARD_STAGES, AFFILIATE_CARD_NAMES, careTaskCategory, addDaysDate, addMonthsDate, ensureCustomer, ensurePromiseCustomer, buildMobileTasks, CareTemplatePicker, StandalonePromiseModal, DailySaveBadge, HS_ROWS, HS_PARTS, matrixRowCount, hsCount };
