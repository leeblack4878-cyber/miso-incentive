export const SALES_MANAGER_POLICY_VERSION = '2026-09-01';

export const SALES_MANAGER_BASE_PAY = 2500000;
export const SALES_MANAGER_POSITION_ALLOWANCE = 800000;
export const SALES_MANAGER_MINIMUM_PAY = 6000000;

const MOBILE_TIERS = [
  { min: 900, rate: 10000 },
  { min: 850, rate: 6000 },
  { min: 800, rate: 5000 },
  { min: 750, rate: 4000 },
  { min: 700, rate: 3000 },
];

const HOME_TIERS = [
  { min: 90, rate: 20000 },
  { min: 85, rate: 17000 },
  { min: 80, rate: 15000 },
  { min: 75, rate: 12000 },
  { min: 70, rate: 10000 },
];

function achievedTier(value, tiers) {
  return tiers.find(tier => Number(value || 0) >= tier.min) || { min: null, rate: 0 };
}

export function calculateSalesManagerPayroll({ hs = 0, simMnp = 0, second = 0, home = 0, upsell = 0 } = {}) {
  const actual = {
    hs: Number(hs || 0),
    simMnp: Number(simMnp || 0),
    second: Number(second || 0),
    home: Number(home || 0),
    upsell: Number(upsell || 0),
  };
  const mobileVolume = actual.hs + actual.simMnp + actual.second * 0.2;
  const mobileTier = achievedTier(mobileVolume, MOBILE_TIERS);
  const homeTier = achievedTier(actual.home, HOME_TIERS);
  const hsIncentive = actual.hs * mobileTier.rate;
  const homeIncentive = actual.home * homeTier.rate;
  const upsellRate = actual.upsell >= 500 ? 3000 : 0;
  const upsellIncentive = actual.upsell * upsellRate;
  const calculatedPay = SALES_MANAGER_BASE_PAY + SALES_MANAGER_POSITION_ALLOWANCE + hsIncentive + homeIncentive + upsellIncentive;
  const guaranteeAdjustment = Math.max(0, SALES_MANAGER_MINIMUM_PAY - calculatedPay);
  return {
    actual,
    mobileVolume,
    mobileTier,
    homeTier,
    upsellRate,
    hsIncentive,
    homeIncentive,
    upsellIncentive,
    calculatedPay,
    guaranteeAdjustment,
    finalPay: calculatedPay + guaranteeAdjustment,
  };
}
