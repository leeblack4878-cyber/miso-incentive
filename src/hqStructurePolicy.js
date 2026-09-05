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
  return ['selfStore', 'retail', 'salesMetric', 'award']
    .reduce((sum, key) => sum + Number(bundle[key]?.totalAmount || 0), 0);
}

export function calculateHqStructureProjection({
  month = '',
  asOf = new Date(),
  selfStoreInput = {},
  retailInput = {},
  salesMetricInput = {},
  awardInput = {},
} = {}) {
  const runRate = calculateMonthlyRunRate(month, asOf);
  const current = {
    selfStore: calculateSelfStoreOperatingSupport(selfStoreInput),
    retail: calculateRetailPartnerMonthlyPolicy(retailInput),
    salesMetric: calculateSalesMetricActivation(salesMetricInput),
    award: calculateRetailMonthlyAward(awardInput),
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
  };

  return {
    runRate,
    current,
    forecast,
    currentTotalAmount: sumPolicyAmounts(current),
    forecastTotalAmount: sumPolicyAmounts(forecast),
  };
}
