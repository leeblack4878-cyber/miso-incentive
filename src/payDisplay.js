// computePay already contains approved mobile spots. Only other approved spots
// are added here, once, alongside recorded expenses. Policy rates stay upstream.
export function payDisplay(pay, nonMobileSpot = 0, expenses = 0) {
 const adjustment = Number(nonMobileSpot || 0) - Number(expenses || 0);
 return {
  current: Number(pay.currentPerformanceAmount || 0) + adjustment,
  closing: Number(pay.closingAmount || 0) + adjustment,
  total: Number(pay.total || 0) + adjustment,
 };
}
