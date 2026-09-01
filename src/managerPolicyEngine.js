export const SEPTEMBER_MANAGER_POLICY_VERSION = '2026-09-v1';

export const SEPTEMBER_MANAGER_OPERATORS = [
  { match: ['삼미시장2호', '삼미2'], name: '김민지', position: '부점장' },
  { match: ['삼미시장', '삼미'], name: '최재원', position: '점장' },
  { match: ['상록수역', '상록'], name: '주정민', position: '점장' },
  { match: ['롯데마트', '대야'], name: '박민경', position: '부점장' },
  { match: ['주민센터', '주민'], name: '하윤식', position: '부점장' },
  { match: ['장곡역', '장곡'], name: '이민우', position: '점장' },
  { match: ['도일시장', '거모'], name: '임지혜', position: '점장' },
  { match: ['월곶'], name: '황성휘', position: '점장' },
  { match: ['성포역', '성포'], name: '김소원', position: '점장' },
  { match: ['산본'], name: '최재혁', position: '부점장' },
  { match: ['법조타운', '법조', '범조'], name: null, position: null },
  { match: ['은계사거리', '은계'], name: '전민혁', position: '부점장' },
  { match: ['본오중학교', '본오'], name: '박성민', position: '부점장' },
];

export const SEPTEMBER_CONSIGNMENT_STORES = [
  ['삼미시장점', '신천동_삼미시장점'],
  ['상록수역점', '본오3동_상록수역점'],
  ['주민센터점', '본오3동_주민센터점'],
  ['도일시장점', '거모동_도일시장점'],
  ['산본점', '광정동_산본점'],
];

export function septemberManagerStoreType(storeName = '') {
  const value = String(storeName);
  return SEPTEMBER_CONSIGNMENT_STORES.some(names => names.some(name => value.includes(name)))
    ? 'consignment'
    : 'owned';
}

export function managerOperatorForStore(storeName = '') {
  const value = String(storeName);
  return SEPTEMBER_MANAGER_OPERATORS.find(row => row.match.some(key => value.includes(key))) || null;
}

export function managerAchievementTier(actual = 0, target = 0) {
  const achievement = Number(target) > 0 ? Number(actual || 0) / Number(target) * 100 : 0;
  if (achievement >= 120) return { achievement, threshold: 120, tier: '120% 이상' };
  if (achievement >= 100) return { achievement, threshold: 100, tier: '100% 이상' };
  if (achievement >= 90) return { achievement, threshold: 90, tier: '90% 이상' };
  return { achievement, threshold: 0, tier: '지급 전' };
}

export function managerCompanyGoalShare(storeHsTarget = 0, allStoreHsTargets = []) {
  const total = (allStoreHsTargets || []).reduce((sum, value) => sum + Number(value || 0), 0);
  return total > 0 ? Number(storeHsTarget || 0) / total : 0;
}

const RATES = {
  hs: { 90: 10000, 100: 20000, 120: 30000 },
  home: { 90: 30000, 100: 50000, 120: 60000 },
  tvFree: { 90: 10000, 100: 20000, 120: 35000 },
  smartHome: { 90: 10000, 100: 20000, 120: 35000 },
};

function amountForMetric(key, actual, target) {
  const tier = managerAchievementTier(actual, target);
  const rate = RATES[key]?.[tier.threshold] || 0;
  return { key, actual: Number(actual || 0), target: Number(target || 0), rate, amount: Number(actual || 0) * rate, ...tier };
}

export function calculateSeptemberManagerIncentive({
  actual = {}, targets = {}, managerScore = 0, strategicRatio = null,
  homeRatio = null, plan115Count = 0, plan115Ratio = null,
  tailoredCount = 0, bundledSecondCount = 0, storeType = 'unknown',
  subTvSmartRatio = null, levelBelow4 = false, noExperienceRate = null,
  tailTagCount = 0, strongNegativeCount = 0, complaintCount = 0,
  unkindCount = 0, noExperienceCount = 0, npsScore = null, auditScore = null,
  privacyViolation = false, impactRate = null, closing = false,
} = {}) {
  const metrics = ['hs', 'home', 'tvFree', 'smartHome'].map(key => amountForMetric(key, actual[key], targets[key]));
  const hs = metrics.find(row => row.key === 'hs');
  const resolvedHomeRatio = homeRatio ?? (Number(actual.hs) > 0 ? Number(actual.home || 0) / Number(actual.hs) * 100 : 0);
  const hsHomeBonus = resolvedHomeRatio >= 12 ? hs.amount * .2 : 0;
  const strategicKnown = strategicRatio !== null && strategicRatio !== undefined && strategicRatio !== '';
  const hsWithheld = strategicKnown && Number(strategicRatio) < 160;
  hs.baseAmount = hs.amount;
  hs.homeBonus = hsHomeBonus;
  hs.amount = hsWithheld ? 0 : hs.amount + hsHomeBonus;
  hs.withheld = hsWithheld;
  hs.strategicKnown = strategicKnown;

  const performanceTotal = metrics.reduce((sum, row) => sum + row.amount, 0);
  const bonuses = [
    { key: 'excellent', label: '우수 관리자', achieved: Number(managerScore) >= 95, amount: Number(managerScore) >= 95 ? 300000 : 0 },
    { key: 'plan115', label: '115군 60% 이상', achieved: Number(plan115Ratio) >= 60, amount: Number(plan115Ratio) >= 60 ? Number(plan115Count || 0) * 10000 : 0 },
    { key: 'strategic200', label: '전략P 비중 200% 이상', achieved: strategicKnown && Number(strategicRatio) >= 200, amount: strategicKnown && Number(strategicRatio) >= 200 ? 300000 : 0 },
    { key: 'tailored', label: '맞춤제안 업셀 30건 이상', achieved: Number(tailoredCount) >= 30, amount: Number(tailoredCount) >= 30 ? 300000 : 0 },
  ];
  const secondTarget = storeType === 'consignment' ? 20 : storeType === 'owned' ? 10 : null;
  bonuses.push({ key: 'second', label: '2ND 번들판매', achieved: secondTarget !== null && Number(bundledSecondCount) >= secondTarget, amount: secondTarget !== null && Number(bundledSecondCount) >= secondTarget ? Number(bundledSecondCount) * 10000 : 0, target: secondTarget });
  const bonusTotal = bonuses.reduce((sum, row) => sum + row.amount, 0);

  const deductions = [];
  if (resolvedHomeRatio < 6) deductions.push({ key: 'homeRatio', label: '홈 비중 6% 미만', amount: 600000 });
  else if (resolvedHomeRatio < 8) deductions.push({ key: 'homeRatio', label: '홈 비중 8% 미만', amount: 400000 });
  if (subTvSmartRatio !== null && Number(subTvSmartRatio) < 10) deductions.push({ key: 'subTvSmart', label: '부셋탑+스마트홈 10% 미만', amount: 300000 });
  if (levelBelow4) deductions.push({ key: 'level', label: '매장 레벨 LV4 미만', amount: 300000 });
  if (noExperienceRate !== null && Number(noExperienceRate) >= 40) deductions.push({ key: 'noExperienceRate', label: 'U+ONE 무체험 40% 이상', amount: 300000 });
  if (Number(tailTagCount) > 0) deductions.push({ key: 'tailTag', label: '꼬리표', amount: Number(tailTagCount) * 200000 });
  if (Number(strongNegativeCount) > 0) deductions.push({ key: 'strongNegative', label: '강비추', amount: Number(strongNegativeCount) * 200000 });
  if (Number(complaintCount) > 0) deductions.push({ key: 'complaint', label: '대외 민원·가개통·불친절', amount: Number(complaintCount) * 500000 });
  if (Number(unkindCount) > 0) deductions.push({ key: 'unkind', label: '불친절', amount: Number(unkindCount) * 500000 });
  if (Number(noExperienceCount) > 0) deductions.push({ key: 'noExperience', label: '무체험 발생', amount: Number(noExperienceCount) * 300000 });
  if (npsScore !== null && Number(npsScore) < 97) deductions.push({ key: 'nps', label: 'NPS 97점 미만', amount: Math.min(500000, (97 - Number(npsScore)) * 50000) });
  if (auditScore !== null && Number(auditScore) < 105) deductions.push({ key: 'audit', label: '오딧 105점 미만', amount: (105 - Number(auditScore)) * 30000 });
  const deductionTotal = deductions.reduce((sum, row) => sum + row.amount, 0);
  const beforeImpact = Math.max(0, performanceTotal + bonusTotal - deductionTotal);
  const finalRate = closing && impactRate !== null ? Math.max(0, Number(impactRate)) : 1;
  const finalAmount = privacyViolation ? 0 : Math.round(beforeImpact * finalRate);
  return { metrics, bonuses, deductions, performanceTotal, bonusTotal, deductionTotal, beforeImpact, finalAmount, finalRate, impactApplied: closing && impactRate !== null, privacyViolation, homeRatio: resolvedHomeRatio };
}
