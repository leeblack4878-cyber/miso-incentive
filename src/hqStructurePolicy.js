export const SELF_STORE_BASELINE = Object.freeze({
  sangnoksu: 122,
  doil: 109,
  sammi: 117,
  residentCenter: 117,
  sanbon: 153,
  ownedStore: 50,
});

export const SELF_STORE_BASELINE_TOTAL = Object.values(SELF_STORE_BASELINE)
  .reduce((sum, value) => sum + value, 0);

export const SELF_STORE_WEIGHTS = Object.freeze({
  hs: 1,
  second: 0.2,
  internet: 1,
  smartHome: 0.2,
  extraSetTop: 0.5,
});

export function calculateSelfStoreOperatingSupport(input = {}) {
  const counts = Object.fromEntries(
    Object.keys(SELF_STORE_WEIGHTS).map(key => [key, Math.max(0, Number(input[key] || 0))]),
  );
  const recognized = Object.entries(SELF_STORE_WEIGHTS)
    .reduce((sum, [key, weight]) => sum + counts[key] * weight, 0);
  const excess = Math.max(0, recognized - SELF_STORE_BASELINE_TOTAL);
  const tier1Count = Math.min(excess, 150);
  const tier2Count = Math.max(0, excess - 150);
  return {
    counts,
    recognized,
    baseline: SELF_STORE_BASELINE_TOTAL,
    excess,
    tier1Count,
    tier2Count,
    tier1Amount: tier1Count * 50000,
    tier2Amount: tier2Count * 60000,
    totalAmount: tier1Count * 50000 + tier2Count * 60000,
  };
}

export const RETAIL_PARTNER_POINT_TIERS = Object.freeze([
  { from: 150, to: 300, rate: 14300 },
  { from: 300, to: 400, rate: 16500 },
  { from: 400, to: 500, rate: 18700 },
  { from: 500, to: 700, rate: 22000 },
  { from: 700, to: 1000, rate: 25300 },
  { from: 1000, to: 1500, rate: 30800 },
  { from: 1500, to: Infinity, rate: 36300 },
]);

export function retailPartnerPaymentRate(plan115Ratio = 0) {
  const ratio = Math.max(0, Number(plan115Ratio || 0));
  if (ratio >= 60) return 1.3;
  if (ratio >= 50) return 1.2;
  if (ratio >= 40) return 1.1;
  return 1;
}

export function calculateRetailPartnerMonthlyPolicy(input = {}) {
  const hs = Math.max(0, Number(input.hs || 0));
  const plan115Hs = Math.max(0, Number(input.plan115Hs || 0));
  const points = Math.max(0,
    Number(input.mnp || 0) * 2
    + Number(input.new010 || 0) * 2
    + Number(input.change95Plus || 0)
    + Number(input.changeUnder95 || 0) * 0.3
    + Number(input.second || 0)
    + Number(input.simMnp || 0),
  );
  const tiers = RETAIL_PARTNER_POINT_TIERS.map((tier, index) => {
    const pointCount = index === 0
      ? (points >= tier.from ? Math.min(points, tier.to) : 0)
      : Math.max(0, Math.min(points, tier.to) - tier.from);
    return { ...tier, pointCount, amount: pointCount * tier.rate };
  });
  const baseAmount = tiers.reduce((sum, tier) => sum + tier.amount, 0);
  const plan115Ratio = hs > 0 ? plan115Hs / hs * 100 : 0;
  const paymentRate = retailPartnerPaymentRate(plan115Ratio);
  return { points, hs, plan115Hs, plan115Ratio, paymentRate, tiers, baseAmount, totalAmount: baseAmount * paymentRate };
}

export const SALES_METRIC_RATES = Object.freeze([
  { threshold: 200, rate: 17600 },
  { threshold: 180, rate: 15400 },
  { threshold: 160, rate: 13200 },
  { threshold: 140, rate: 11000 },
  { threshold: 120, rate: 8800 },
  { threshold: 100, rate: 6600 },
  { threshold: 80, rate: 4400 },
]);

export function calculateSalesMetricActivation({ hs = 0, salesMetricPoints = 0 } = {}) {
  const safeHs = Math.max(0, Number(hs || 0));
  const points = Math.max(0, Number(salesMetricPoints || 0));
  const achievement = safeHs > 0 ? points / safeHs * 100 : 0;
  const tier = SALES_METRIC_RATES.find(item => achievement >= item.threshold) || { threshold: 0, rate: 0 };
  return { hs: safeHs, points, achievement, threshold: tier.threshold, pointRate: tier.rate, totalAmount: points * tier.rate };
}

export const HOME_GRADE_INTERNET_TIERS = Object.freeze([
  { from:300, rates:[99000,102300,132000,137500,148500] },
  { from:250, rates:[93500,96800,126500,132000,143000] },
  { from:200, rates:[88000,91300,121000,126500,137500] },
  { from:150, rates:[82500,85800,115500,121000,132000] },
  { from:120, rates:[80300,83600,110000,115500,126500] },
  { from:100, rates:[74800,78100,104500,110000,121000] },
  { from:90, rates:[69300,72600,99000,104500,110000] },
  { from:70, rates:[61600,64900,88000,93500,99000] },
  { from:50, rates:[53900,57200,71500,77000,88000] },
  { from:30, rates:[42900,46200,60500,66000,77000] },
  { from:20, rates:[31900,38500,49500,55000,66000] },
  { from:10, rates:[22000,27500,33000,38500,44000] },
  { from:5, rates:[0,5500,11000,16500,22000] },
]);

export function homeGradeTvPaymentRate(tvRatio=0){
  const ratio=Math.max(0,Number(tvRatio||0));
  if(ratio>=15)return 1.2;
  if(ratio>=14)return 1.15;
  if(ratio>=13)return 1.1;
  if(ratio>=12)return 1.05;
  if(ratio>=11)return 1;
  if(ratio>=10)return .9;
  if(ratio>=9)return .8;
  if(ratio>=8)return .7;
  return .5;
}

export function calculateHomeGradePolicy({hs=0,internet=0,renewalRecognized=0,mainTv=0,extraSetTop=0}={}){
  const safeHs=Math.max(0,Number(hs||0));
  const safeInternet=Math.max(0,Number(internet||0));
  const renewal=Math.max(0,Number(renewalRecognized||0));
  const roundedRenewal=Math.round(renewal);
  const renewalIndex=roundedRenewal>=50?4:roundedRenewal>=30?3:roundedRenewal>=10?2:roundedRenewal>=5?1:0;
  const internetTier=HOME_GRADE_INTERNET_TIERS.find(tier=>safeInternet>=tier.from)||null;
  const pointRate=internetTier?.rates?.[renewalIndex]||0;
  const tvRecognized=Math.max(0,Number(mainTv||0))+Math.max(0,Number(extraSetTop||0))*.5;
  const tvRatio=safeHs>0?tvRecognized/safeHs*100:0;
  const paymentRate=homeGradeTvPaymentRate(tvRatio);
  const baseAmount=safeInternet*pointRate;
  return {hs:safeHs,internet:safeInternet,renewalRecognized:renewal,roundedRenewal,renewalIndex,internetTier:internetTier?.from||0,pointRate,mainTv:Math.max(0,Number(mainTv||0)),extraSetTop:Math.max(0,Number(extraSetTop||0)),tvRecognized,tvRatio,paymentRate,baseAmount,totalAmount:baseAmount*paymentRate};
}

export const HOME_INTERNET_RATIO_RATES = Object.freeze([
  { ratio: 14, rates: [104000, 112000, 119000, 127000, 131000, 134000, 138000, 142000, 149000] },
  { ratio: 12, rates: [74000, 86000, 93000, 101000, 108000, 116000, 123000, 131000, 138000] },
  { ratio: 10, rates: [44000, 56000, 63000, 78000, 82000, 89000, 97000, 104000, 112000] },
  { ratio: 9, rates: [22000, 35000, 41000, 44000, 56000, 67000, 74000, 82000, 89000] },
  { ratio: 8, rates: [11000, 14000, 26000, 29000, 37000, 44000, 52000, 59000, 67000] },
  { ratio: 7, rates: [0, 3000, 7000, 11000, 14000, 18000, 22000, 26000, 29000] },
]);

function homeInternetHsIndex(hs = 0) {
  if (hs >= 2000) return 8;
  if (hs >= 1500) return 7;
  if (hs >= 1000) return 6;
  if (hs >= 800) return 5;
  if (hs >= 500) return 4;
  if (hs >= 400) return 3;
  if (hs >= 300) return 2;
  if (hs >= 200) return 1;
  return 0;
}

export function calculateHomeInternetRatioPolicy({ hs = 0, internet = 0, mainTv = 0, extraSetTop = 0 } = {}) {
  const safeHs = Math.max(0, Number(hs || 0));
  const safeInternet = Math.max(0, Number(internet || 0));
  const internetRatio = safeHs > 0 ? safeInternet / safeHs * 100 : 0;
  const ratioTier = HOME_INTERNET_RATIO_RATES.find(tier => internetRatio >= tier.ratio) || null;
  const hsIndex = homeInternetHsIndex(safeHs);
  const pointRate = ratioTier?.rates?.[hsIndex] || 0;
  const main = Math.max(0, Number(mainTv || 0));
  const extra = Math.max(0, Number(extraSetTop || 0));
  const tvRecognized = main + extra * 0.5;
  const tvRatio = safeHs > 0 ? tvRecognized / safeHs * 100 : 0;
  const paymentRate = homeGradeTvPaymentRate(tvRatio);
  const baseAmount = safeInternet * pointRate;
  return {
    hs: safeHs, internet: safeInternet, internetRatio, ratioTier: ratioTier?.ratio || 0,
    hsIndex, pointRate, mainTv: main, extraSetTop: extra, tvRecognized, tvRatio,
    paymentRate, baseAmount, totalAmount: baseAmount * paymentRate,
  };
}

export const HOME_AWARD_POINT_RATES = Object.freeze({
  4: 55000, 5: 60500, 6: 66000, 7: 71500, 8: 77000,
  9: 88000, 10: 99000, 11: 110000, 12: 121000, 13: 132000,
  14: 143000, 15: 154000, 16: 165000, 17: 176000, 18: 187000,
});

function ratioScore(value = 0, thresholds = []) {
  return thresholds.reduce((score, threshold, index) => Number(value || 0) >= threshold ? index + 1 : score, 0);
}

export function calculateHomeAwardPolicy({
  hs = 0, internet = 0, payableInternet = internet, mainTv = 0, iptv17Plus = 0,
  extraSetTop = 0, tvFree = 0, internet1g = 0, smartHome = 0,
} = {}) {
  const safeHs = Math.max(0, Number(hs || 0));
  const safeInternet = Math.max(0, Number(internet || 0));
  const safePayableInternet = Math.max(0, Number(payableInternet || 0));
  const safeMainTv = Math.max(0, Number(mainTv || 0));
  const counts = {
    iptv17Plus: Math.max(0, Number(iptv17Plus || 0)),
    extraSetTop: Math.max(0, Number(extraSetTop || 0)),
    tvFree: Math.max(0, Number(tvFree || 0)),
    internet1g: Math.max(0, Number(internet1g || 0)),
    smartHome: Math.max(0, Number(smartHome || 0)),
  };
  const ratios = {
    iptv17Plus: safeMainTv > 0 ? counts.iptv17Plus / safeMainTv * 100 : 0,
    extraSetTop: safeMainTv > 0 ? counts.extraSetTop / safeMainTv * 100 : 0,
    tvFree: safeHs > 0 ? counts.tvFree / safeHs * 100 : 0,
    internet1g: safeInternet > 0 ? counts.internet1g / safeInternet * 100 : 0,
    smartHome: safeInternet > 0 ? counts.smartHome / safeInternet * 100 : 0,
  };
  const rawScores = {
    iptv17Plus: ratioScore(ratios.iptv17Plus, [60, 65, 70, 75]),
    extraSetTop: ratioScore(ratios.extraSetTop, [61, 67, 73, 79, 85, 93, 100]),
    tvFree: ratioScore(ratios.tvFree, [35, 40, 45, 50, 60]),
    internet1g: ratioScore(ratios.internet1g, [30, 35, 40]),
    smartHome: ratioScore(ratios.smartHome, [10, 20, 30, 40]),
  };
  const scores = {
    iptv17Plus: rawScores.iptv17Plus,
    extraSetTop: counts.extraSetTop >= 3 ? rawScores.extraSetTop : Math.min(rawScores.extraSetTop, 5),
    tvFree: counts.tvFree >= 3 ? rawScores.tvFree : Math.min(rawScores.tvFree, 3),
    internet1g: counts.internet1g >= 5 ? rawScores.internet1g : Math.min(rawScores.internet1g, 1),
    smartHome: counts.smartHome >= 3 ? rawScores.smartHome : Math.min(rawScores.smartHome, 1),
    soundbar: 0,
  };
  const setTopScore = Math.max(scores.extraSetTop, scores.tvFree);
  const setTopScoreSource = scores.tvFree > scores.extraSetTop ? 'tvFree' : 'extraSetTop';
  const totalScore = scores.iptv17Plus + setTopScore + scores.internet1g + scores.smartHome;
  const appliedScore = Math.min(18, Math.max(0, Math.floor(totalScore)));
  const pointRate = HOME_AWARD_POINT_RATES[appliedScore] || 0;
  const totalAmount = safePayableInternet * pointRate;
  return {
    hs: safeHs, internet: safeInternet, payableInternet: safePayableInternet, mainTv: safeMainTv,
    counts, ratios, rawScores, scores, setTopScore, setTopScoreSource, totalScore, appliedScore, pointRate,
    internetShare: totalAmount * 0.6, iptvShare: totalAmount * 0.4, totalAmount,
  };
}

export const IPTV_GRADE_RATES = Object.freeze([
  { from: 500, rate: 77000 },
  { from: 400, rate: 66000 },
  { from: 300, rate: 55000 },
  { from: 200, rate: 44000 },
  { from: 150, rate: 33000 },
  { from: 100, rate: 27500 },
  { from: 50, rate: 22000 },
  { from: 30, rate: 16500 },
  { from: 20, rate: 11000 },
]);

export function calculateIptvGradePolicy({ mainTv = 0, extraSetTop = 0 } = {}) {
  const main = Math.max(0, Number(mainTv || 0));
  const extra = Math.max(0, Number(extraSetTop || 0));
  const points = main + extra * 0.5;
  const tier = IPTV_GRADE_RATES.find(item => points >= item.from) || { from: 0, rate: 0 };
  return {
    mainTv: main,
    extraSetTop: extra,
    points,
    threshold: tier.from,
    pointRate: tier.rate,
    totalAmount: points * tier.rate,
  };
}

export const MONTHLY_AWARD_THRESHOLDS = Object.freeze({
  newRatio: [15, 18, 21, 24, 27, 30],
  simMnpRatio: [2, 4, 6, 8, 10, 12],
  salesMetricRatio: [80, 100, 120, 140, 160, 180],
  changeSupportRatio: [15, 25, 35, 45, 55],
  internetRatio: [4, 6, 8, 10, 12],
});

export function scoreMonthlyAwardMetric(value = 0, thresholds = []) {
  return thresholds.reduce((score, threshold, index) => Number(value || 0) >= threshold ? index + 1 : score, 0);
}

export function calculateRetailMonthlyAward(input = {}) {
  const hs = Math.max(0, Number(input.hs || 0));
  const mnp = Math.max(0, Number(input.mnp || 0));
  const new010 = Math.max(0, Number(input.new010 || 0));
  const change = Math.max(0, Number(input.change || 0));
  const simMnp = Math.max(0, Number(input.simMnp || 0));
  const internet = Math.max(0, Number(input.internet || 0));
  const salesMetricPoints = Math.max(0, Number(input.salesMetricPoints || 0));
  const ratios = {
    newRatio: hs ? new010 / hs * 100 : 0,
    simMnpRatio: hs ? simMnp / hs * 100 : 0,
    salesMetricRatio: hs ? salesMetricPoints / hs * 100 : 0,
    changeSupportRatio: Math.max(0, Number(input.changeSupportRatio || 0)),
    internetRatio: hs ? internet / hs * 100 : 0,
  };
  const scores = Object.fromEntries(Object.entries(MONTHLY_AWARD_THRESHOLDS).map(([key, thresholds]) => [key, scoreMonthlyAwardMetric(ratios[key], thresholds)]));
  const totalScore = Object.values(scores).reduce((sum, score) => sum + score, 0);
  const rates = totalScore >= 16 ? { mnp: 55000, new010: 49500, change: 16500 }
    : totalScore >= 14 ? { mnp: 49500, new010: 44000, change: 11000 }
    : totalScore >= 12 ? { mnp: 44000, new010: 38500, change: 5500 }
    : totalScore >= 10 ? { mnp: 38500, new010: 33000, change: 0 }
    : { mnp: 0, new010: 0, change: 0 };
  const amounts = { mnp: mnp * rates.mnp, new010: new010 * rates.new010, change: change * rates.change };
  return { hs, mnp, new010, change, simMnp, internet, salesMetricPoints, ratios, scores, totalScore, rates, amounts, totalAmount: amounts.mnp + amounts.new010 + amounts.change };
}

const FORECAST_KEYS = Object.freeze({
  selfStore: ['hs', 'second', 'internet', 'smartHome', 'extraSetTop'],
  retail: ['hs', 'plan115Hs', 'mnp', 'new010', 'change95Plus', 'changeUnder95', 'second', 'simMnp'],
  salesMetric: ['hs', 'salesMetricPoints'],
  award: ['hs', 'mnp', 'new010', 'change', 'simMnp', 'internet', 'salesMetricPoints'],
  homeGrade: ['hs','internet','renewalRecognized','mainTv','extraSetTop'],
  homeInternetRatio: ['hs', 'internet', 'mainTv', 'extraSetTop'],
  homeAward: ['hs', 'internet', 'payableInternet', 'mainTv', 'iptv17Plus', 'extraSetTop', 'tvFree', 'internet1g', 'smartHome'],
  iptvGrade: ['mainTv', 'extraSetTop'],
});

function monthParts(month = '') {
  const match = /^(\d{4})-(\d{2})$/.exec(String(month));
  if (!match) return null;
  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  if (monthNumber < 1 || monthNumber > 12) return null;
  return { year, monthNumber };
}

export function calculateMonthlyRunRate(month, asOf = new Date()) {
  const selected = monthParts(month);
  const now = asOf instanceof Date ? asOf : new Date(asOf);
  if (!selected || Number.isNaN(now.getTime())) {
    return { isCurrentMonth: false, isPastMonth: false, isFutureMonth: false, elapsedDays: 0, totalDays: 0, remainingDays: 0, factor: 1 };
  }

  const totalDays = new Date(selected.year, selected.monthNumber, 0).getDate();
  const selectedIndex = selected.year * 12 + selected.monthNumber;
  const currentIndex = now.getFullYear() * 12 + now.getMonth() + 1;
  const isCurrentMonth = selectedIndex === currentIndex;
  const isPastMonth = selectedIndex < currentIndex;
  const isFutureMonth = selectedIndex > currentIndex;
  const elapsedDays = isCurrentMonth ? Math.max(1, Math.min(now.getDate(), totalDays)) : (isPastMonth ? totalDays : 0);
  const factor = isCurrentMonth ? totalDays / elapsedDays : 1;

  return {
    isCurrentMonth,
    isPastMonth,
    isFutureMonth,
    elapsedDays,
    totalDays,
    remainingDays: isCurrentMonth ? totalDays - elapsedDays : 0,
    factor,
  };
}

function scaledInput(input = {}, keys = [], factor = 1, preserved = {}) {
  return {
    ...preserved,
    ...Object.fromEntries(keys.map(key => [key, Math.max(0, Number(input[key] || 0)) * factor])),
  };
}

function sumPolicyAmounts(bundle = {}) {
  return ['selfStore', 'retail', 'salesMetric', 'award', 'homeGrade', 'homeInternetRatio', 'homeAward', 'iptvGrade']
    .reduce((sum, key) => sum + Number(bundle[key]?.totalAmount || 0), 0);
}

export function calculateHqStructureProjection({
  month = '',
  asOf = new Date(),
  selfStoreInput = {},
  retailInput = {},
  salesMetricInput = {},
  awardInput = {},
  homeGradeInput = {},
  homeInternetRatioInput = {},
  homeAwardInput = {},
  iptvGradeInput = {},
} = {}) {
  const runRate = calculateMonthlyRunRate(month, asOf);
  const current = {
    selfStore: calculateSelfStoreOperatingSupport(selfStoreInput),
    retail: calculateRetailPartnerMonthlyPolicy(retailInput),
    salesMetric: calculateSalesMetricActivation(salesMetricInput),
    award: calculateRetailMonthlyAward(awardInput),
    homeGrade: calculateHomeGradePolicy(homeGradeInput),
    homeInternetRatio: calculateHomeInternetRatioPolicy(homeInternetRatioInput),
    homeAward: calculateHomeAwardPolicy(homeAwardInput),
    iptvGrade: calculateIptvGradePolicy(iptvGradeInput),
  };

  const factor = runRate.isCurrentMonth ? runRate.factor : 1;
  const forecast = {
    selfStore: calculateSelfStoreOperatingSupport(scaledInput(selfStoreInput, FORECAST_KEYS.selfStore, factor)),
    retail: calculateRetailPartnerMonthlyPolicy(scaledInput(retailInput, FORECAST_KEYS.retail, factor)),
    salesMetric: calculateSalesMetricActivation(scaledInput(salesMetricInput, FORECAST_KEYS.salesMetric, factor)),
    award: calculateRetailMonthlyAward(scaledInput(
      awardInput,
      FORECAST_KEYS.award,
      factor,
      { changeSupportRatio: Math.max(0, Number(awardInput.changeSupportRatio || 0)) },
    )),
    homeGrade: calculateHomeGradePolicy(scaledInput(homeGradeInput,FORECAST_KEYS.homeGrade,factor)),
    homeInternetRatio: calculateHomeInternetRatioPolicy(scaledInput(homeInternetRatioInput, FORECAST_KEYS.homeInternetRatio, factor)),
    homeAward: calculateHomeAwardPolicy(scaledInput(homeAwardInput, FORECAST_KEYS.homeAward, factor)),
    iptvGrade: calculateIptvGradePolicy(scaledInput(iptvGradeInput, FORECAST_KEYS.iptvGrade, factor)),
  };

  return {
    runRate,
    current,
    forecast,
    currentTotalAmount: sumPolicyAmounts(current),
    forecastTotalAmount: sumPolicyAmounts(forecast),
  };
}
