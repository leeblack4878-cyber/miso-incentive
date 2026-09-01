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
