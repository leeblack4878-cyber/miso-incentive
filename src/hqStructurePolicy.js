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
