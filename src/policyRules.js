export {
  SECOND_PERFORMANCE_POINT, INSURANCE_QUALITY_POINT, SECOND_ALLOWED_VAS_KEYS,
  allowedSecondVas, summarizeVasQuality, calculateSecondPolicy,
  calculateActivitySupport, calculateFreePhoneSpecialOutcome, summarizeHomeStatuses,
  calculateFlatIncentive, calculateMatrixIncentive, calculateMobileCommissionParts,
  calculatePayrollSettlement,
  CURRENT_POLICY_VERSION, createPolicySnapshot, resolveSalePolicySnapshot,
  calculateMobileSale, latestActiveSales, calculateMonthlySaleLedger,
  buildHomeBundlesFromOrders, calculateHomePolicyFromOrders,
} from './policyEngine.js';

import { calculateSecondPolicy, summarizeHomeStatuses } from './policyEngine.js';

export function secondPerformancePoints({ secondOnlyCount = 0, bundleCounts = [] } = {}) {
  return calculateSecondPolicy({ secondOnlyCount, bundleCounts }).performancePoints;
}

export function homeOrdersForMonth(orders = [], month, status = null) {
  const summary = summarizeHomeStatuses(orders, month);
  return status === 'completed' ? summary.completedRows : status === 'pending' ? summary.pendingRows : summary.rows;
}

export function homeBundleCount(rows = []) {
  return new Set((rows || []).map(row => {
    const date = String(row?.source_work_date || row?.actual_install_date || '').slice(0, 10);
    return `${date}|${row?.customer_id || row?.customer_name || row?.id}`;
  })).size;
}

export function replaceCountedSale(currentCount = 0, oldIncluded = true, newIncluded = true) {
  return Math.max(0, Number(currentCount || 0) - (oldIncluded ? 1 : 0) + (newIncluded ? 1 : 0));
}

export function mergeSaleMetaPreservingLegacy(previous = {}, patch = {}) {
  return { ...(previous || {}), ...(patch || {}) };
}
