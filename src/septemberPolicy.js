export const SEPTEMBER_POLICY_VERSION = '2026-09-v1';
export const SEPTEMBER_POLICY_MONTH = '2026-09';
export const SEPTEMBER_TV_PLAN = '방송패스';
export const SEPTEMBER_SOHO_TV_PLAN = '프리미엄';

export function septemberMainTvPlan(networkType = '') {
  return networkType === 'soho' ? SEPTEMBER_SOHO_TV_PLAN : SEPTEMBER_TV_PLAN;
}

export const SEPTEMBER_MATRIX_COLUMNS = ['115군↑', '청소년85군', '일반85군', '33~84군', '약자47군↑', '그 외'];

export const SEPTEMBER_MATRIX = [
  [50000, 40000, 20000, 0, 20000, 0],
  [90000, 70000, 50000, 40000, 40000, 0],
  [50000, 40000, 20000, 0, 20000, 0],
  [50000, 40000, 20000, 0, 20000, 0],
  [25000, 20000, 10000, 0, 10000, 0],
  [80000, 70000, 50000, 40000, 40000, 0],
  [0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0],
];

export const SEPTEMBER_VAS = [
  { key: 'vasKyobo', label: '교보문고 sam + 구글 원', rate: 20000, point: 1 },
  { key: 'vasVcolorBundle', label: 'V컬러링 음악감상 플러스 + 벨링 콘텐츠 팩', rate: 20000, point: 1 },
  { key: 'vasPhonePass', label: '폰교체패스', rate: 10000, point: 0.8 },
  { key: 'vasSafePass', label: '폰안심패스', rate: 0, point: 0.8 },
  { key: 'vasVcolorMusic', label: 'V컬러링 음악감상 플러스', rate: 0, point: 0.3 },
  { key: 'vasBellMoya', label: '벨링모아 A/B', rate: 0, point: 0.3 },
  { key: 'vasDualNumber', label: '듀얼넘버 온앤오프', rate: 0, point: 0.4 },
  { key: 'vasDesignatedNumber', label: '지정번호필터링', rate: 0, point: 0.2 },
  { key: 'vasDaemyung', label: '소노', rate: 0, point: 2 },
  { key: 'vasStrategicPlan', label: '전략 요금제', rate: 0, point: 0.5 },
];

export const SEPTEMBER_BUNDLE_2ND = [
  ['b_L335', '2ND · L335', 200000],
  ['b_X216', '2ND · X216', 150000],
  ['b_X236', '2ND · X236', 150000],
  ['b_X236NP', '2ND · X236-NP', 200000],
  ['b_L505', '2ND · L505', 150000],
  ['b_L345', '2ND · L345(40mm)', 150000],
  ['b_L355', '2ND · L355(44mm)', 100000],
  ['b_L715', '2ND · L715', 150000],
  ['b_AppleWatch', '2ND · 애플워치SE3 (아이폰14~17)', 150000],
].map(([key, label, rate]) => ({ key, label, rate }));

export const SEPTEMBER_RENEW = [
  { key: 'renewPremiumSafe1G', label: '재약정 · 프리미엄 안심보상 1GB', rate: 80000 },
  { key: 'renewPremiumSafe500', label: '재약정 · 프리미엄 안심보상 500MB', rate: 80000 },
  { key: 'renewPremiumSafe100', label: '재약정 · 프리미엄 안심보상 100MB', rate: 80000 },
  { key: 'renewOther1G', label: '재약정 · 동일/기타 요금제 1GB', rate: 60000 },
  { key: 'renewOther500', label: '재약정 · 동일/기타 요금제 500MB', rate: 60000 },
  { key: 'renewOther100', label: '재약정 · 동일/기타 요금제 100MB', rate: 60000 },
  { key: 'renewSpeedUp', label: '재약정 · 속도 상향', rate: 30000 },
  { key: 'renewSimul1G', label: '재약정 · HS 동시판매 1GB', rate: 80000 },
  { key: 'renewSimul500', label: '재약정 · HS 동시판매 500MB', rate: 50000 },
  { key: 'renewTvUpsell', label: 'TV 업셀 수수료', rate: 20000 },
];

const SEPTEMBER_SPECIAL_SALES_BASE = [
  ['s26_256_512_mnp', 'S26-256/512', 'MNP', 50000, 'high', 2],
  ['s26_256_512_change', 'S26-256/512', '기기변경', 50000, 'high', 2],
  ['s26_plus_256_512_mnp', 'S26+ 256/512', 'MNP', 50000, 'high', 2, '2026-09-05'],
  ['s26_plus_256_512_change', 'S26+ 256/512', '기기변경', 50000, 'high', 2, '2026-09-05'],
  ['s26_ultra_mnp', 'S26울트라 256/512', 'MNP', 50000, 'high', 2],
  ['s26_ultra_change', 'S26울트라 256/512', '기기변경', 50000, 'high', 2],
  ['s937_mnp', 'S937', 'MNP', 100000, 'high', 2],
  ['s937_new', 'S937', '010 신규', 50000, 'high', 2],
  ['s937_change', 'S937', '기기변경', 100000, 'high', 2],
  ['f776_mnp', 'F776-256/512', 'MNP', 50000, 'high', 2],
  ['f776_change', 'F776-256/512', '기기변경', 50000, 'high', 2],
  ['f971_256_mnp', 'F971-256', 'MNP', 0, 'high', 2, '2026-09-11', '2026-09-14'],
  ['f971_256_change', 'F971-256', '기기변경', 0, 'high', 2, '2026-09-11', '2026-09-14'],
  ['f971_256_mnp_0915', 'F971-256', 'MNP', 50000, 'high', 2, '2026-09-15', '2099-12-31', '2026-09-v2'],
  ['f971_256_change_0915', 'F971-256', '기기변경', 50000, 'high', 2, '2026-09-15', '2099-12-31', '2026-09-v2'],
  ['f971_mnp', 'F971-512', 'MNP', 50000, 'high', 2],
  ['f971_change', 'F971-512', '기기변경', 50000, 'high', 2],
  ['f976_mnp', 'F976-256/512', 'MNP', 0, 'high', 2],
  ['f976_change', 'F976-256/512', '기기변경', 0, 'high', 2],
  ['a175_m2_new', 'A175-M2', '010 신규', 50000, 'junior', 1.8],
  ['a176_mnp', 'A176', 'MNP', 0, '33plus', 2],
].map(([key, model, saleType, additionalAmount, planRule, requiredStrategicPoints, startDate = '2026-09-01', endDate = '2099-12-31', policyVersion = SEPTEMBER_POLICY_VERSION]) => ({
  key, model, saleType, additionalAmount, planRule, requiredStrategicPoints, startDate, endDate, policyVersion,
}));

// Each revision has its own key so a saved earlier sale keeps its agreed amount.
const SEPTEMBER_18_AMOUNTS = {
  s26_256_512_mnp:100000,s26_256_512_change:100000,
  s26_plus_256_512_mnp:80000,s26_plus_256_512_change:80000,
  s26_ultra_mnp:80000,s26_ultra_change:80000,f971_256_mnp_0915:100000,f971_256_change_0915:100000,
  f976_mnp:50000,f976_change:50000,
};
export const SEPTEMBER_IPHONE18_SALES = [
  {key:'iphone18_preorder_mnp_0918',saleType:'MNP',customerDiscount:300000},
  {key:'iphone18_preorder_change_0918',saleType:'기기변경',customerDiscount:150000},
].map(p=>({...p,model:'아이폰18 사전예약 특가',additionalAmount:0,policyType:'incentive_unpaid',planRule:'high',requiredStrategicPoints:2,startDate:'2026-09-18',endDate:'2026-09-21',policyVersion:'2026-09-18-iphone18'}));
export const SEPTEMBER_SPECIAL_SALES = [
  ...SEPTEMBER_SPECIAL_SALES_BASE.map(p=>Object.hasOwn(SEPTEMBER_18_AMOUNTS,p.key)?{...p,endDate:'2026-09-17'}:p),
  ...SEPTEMBER_SPECIAL_SALES_BASE.filter(p=>Object.hasOwn(SEPTEMBER_18_AMOUNTS,p.key)).map(p=>({...p,key:`${p.key}_0918`,additionalAmount:SEPTEMBER_18_AMOUNTS[p.key],startDate:'2026-09-18',endDate:'2099-12-31',policyVersion:'2026-09-v3'})),
  ...SEPTEMBER_IPHONE18_SALES,
];
export function septemberMobileSaleType(row){
  return Number(row)===0?'010 신규':Number(row)===1?'MNP':[2,3,4].includes(Number(row))?'기기변경':null;
}

export function calculateSeptemberSpecialSale({ policyKey, planGroup, strategicPoints = 0, saleDate = '', saleType } = {}) {
  const policy = SEPTEMBER_SPECIAL_SALES.find(item => item.key === policyKey);
  if (!policy) return { eligible: false, additionalAmount: 0, reason: '정책 미선택' };
  const normalizedSaleDate = String(saleDate || '').slice(0, 10);
  const dateEligible = !normalizedSaleDate
    || ((!policy.startDate || normalizedSaleDate >= policy.startDate) && (!policy.endDate || normalizedSaleDate <= policy.endDate));
  const planEligible = policy.planRule === 'high'
    ? ['115', 'youth85'].includes(planGroup)
    : policy.planRule === 'junior'
      ? planGroup === 'junior'
      : policy.planRule === '33plus' && ['115', 'youth85', '85', '33plus', 'weak47'].includes(planGroup);
  const pointEligible = Number(strategicPoints || 0) >= policy.requiredStrategicPoints;
  const typeEligible = saleType===undefined || saleType===policy.saleType;
  return {
    policy,
    dateEligible,
    planEligible,
    pointEligible,
    typeEligible,
    eligible: dateEligible && planEligible && pointEligible && typeEligible,
    additionalAmount: dateEligible && planEligible && pointEligible && typeEligible ? policy.additionalAmount : 0,
  };
}

export function september18HomeApplication(date){return date>='2026-09-18'&&date<='2026-09-21';}
export function calculateSeptember18WeekendHomeBonus(bundles=[]){
  const eligible=bundles.filter(b=>september18HomeApplication(b.date)
    &&b.hasInternet&&['500','1g'].includes(b.speed)&&b.hasTv
    &&((b.networkType==='household'&&b.mainTvPlan==='broadcastPass')||(b.networkType==='soho'&&b.mainTvPlan==='premium'))
    &&b.actualInstallDate>=b.date&&b.actualInstallDate<='2026-09-30'&&b.saleType!=='allinone'
    &&(!b.orders||b.orders.filter(o=>['internet500','internet1g','homeTv'].includes(o.product_type)).every(o=>o.actual_install_date>=b.date&&o.actual_install_date<='2026-09-30')));
  const paid=eligible.filter(b=>b.networkType==='household'),rate=eligible.length>=3?150000:eligible.length?100000:0;
  const mnpCount=paid.filter(b=>['mnp','usedMnp'].includes(b.simul)).length;
  const payouts=paid.map(b=>({date:b.date,customer:b.customer,amount:rate+(['mnp','usedMnp'].includes(b.simul)?100000:0)}));
  return {gradeCount:eligible.length,paidCount:paid.length,rate,baseBonus:paid.length*rate,mnpCount,mnpBonus:mnpCount*100000,total:paid.length*rate+mnpCount*100000,payouts};
}

export function calculateSeptemberSono(count, baseRate, achievedRate) {
  const safeCount = Math.max(0, Number(count || 0));
  return safeCount * (safeCount >= 5 ? achievedRate : baseRate);
}

export function calculateSeptemberBundleSale({ rate = 0, saleType = 'normal', insuranceJoined = true, parent115 = true, isAppleWatch = false } = {}) {
  const normalRate = Math.max(0, Number(rate || 0));
  const eligible = !!insuranceJoined && (!isAppleWatch || !!parent115);
  const paid = !eligible ? 0 : saleType === 'discount' ? Math.min(20000, normalRate) : normalRate;
  return { eligible, paid, offset: Math.max(0, normalRate - paid), performanceCount: 1, activityCount: 1, performancePoints: 0.2 };
}

export function calculateSeptemberTailoredTier(count) {
  const safeCount = Math.max(0, Number(count || 0));
  const perCase = safeCount >= 30 ? 10000 : safeCount >= 20 ? 7000 : safeCount >= 10 ? 5000 : 0;
  return { count: safeCount, perCase, amount: safeCount * perCase };
}

export function septemberConfig(base = {}) {
  return {
    ...base,
    matrix: SEPTEMBER_MATRIX.map(row => [...row]),
    vas: SEPTEMBER_VAS.map(item => ({ ...item })),
    bundle2nd: SEPTEMBER_BUNDLE_2ND.map(item => ({ ...item })),
    renew: SEPTEMBER_RENEW.map(item => ({ ...item })),
    sono: [
      { key: 'sonoBasic', label: '소노 NEW 라이프케어', rate: 80000, achievedRate: 100000 },
      { key: 'sono594', label: '594만 상품', rate: 60000, achievedRate: 80000 },
    ],
    tailoredTiers: [
      { min: 10, bonus: 5000, perCase: true },
      { min: 20, bonus: 7000, perCase: true },
      { min: 30, bonus: 10000, perCase: true },
    ],
    policyVersion: SEPTEMBER_POLICY_VERSION,
  };
}
