export const SECOND_PERFORMANCE_POINT = 0.2;
export const INSURANCE_QUALITY_POINT = 0.8;
export const SECOND_ALLOWED_VAS_KEYS = Object.freeze(['vasPhonePass', 'vasSafePass']);

export function allowedSecondVas(items = []) {
  return (items || []).filter(item => SECOND_ALLOWED_VAS_KEYS.includes(item?.key));
}

export function secondPerformancePoints({ secondOnlyCount = 0, bundleCounts = [] } = {}) {
  const bundleCount = Array.isArray(bundleCounts)
    ? bundleCounts.reduce((sum, value) => sum + Number(value || 0), 0)
    : Object.values(bundleCounts || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  return Number(((Number(secondOnlyCount || 0) + bundleCount) * SECOND_PERFORMANCE_POINT).toFixed(10));
}

export function summarizeVasQuality(sales = []) {
  let insurance = 0;
  let strategicVas = 0;
  (sales || []).forEach(sale => {
    const meta = sale?.source_meta || {};
    const keys = [...(meta.vasKeys || []), ...Object.values(meta.bundleVasMap || {}).flat()];
    keys.forEach(key => {
      if (key === 'vasPhonePass' || key === 'vasSafePass') insurance += 1;
      if (key === 'vasKyobo' || key === 'vasVcolor') strategicVas += 1;
    });
  });
  return { insurance, strategicVas, insurancePoints: insurance * INSURANCE_QUALITY_POINT };
}

export function homeOrdersForMonth(orders = [], month, status = null) {
  return (orders || []).filter(order => {
    const dateMonth = String(order?.source_work_date || order?.actual_install_date || '').slice(0, 7);
    if (dateMonth !== month || order?.status === 'cancelled') return false;
    return status ? order?.status === status : true;
  });
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
