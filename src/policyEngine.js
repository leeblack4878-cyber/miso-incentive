export const SECOND_PERFORMANCE_POINT = 0.2;
export const INSURANCE_QUALITY_POINT = 0.8;
export const SECOND_ALLOWED_VAS_KEYS = Object.freeze(['vasPhonePass', 'vasSafePass']);

const countValues = (values = {}) => (Array.isArray(values) ? values : Object.values(values || {}))
  .reduce((sum, value) => sum + Number(value || 0), 0);

export function calculateSecondPolicy({ secondOnlyCount = 0, bundleCounts = {}, pointRate = SECOND_PERFORMANCE_POINT } = {}) {
  const standalone = Number(secondOnlyCount || 0);
  const bundled = countValues(bundleCounts);
  const totalCount = standalone + bundled;
  return {
    standalone,
    bundled,
    totalCount,
    activityCount: totalCount,
    performancePoints: Number((totalCount * Number(pointRate || 0)).toFixed(10)),
  };
}

export function calculateActivitySupport({
  monthsEmployed = 0,
  activityCount = 0,
  rate = 0,
  cap = 2300000,
} = {}) {
  const safeCap = Math.max(0, Number(cap || 0));
  if (Number(monthsEmployed || 0) < 6) return safeCap;
  return Math.min(Math.max(0, Number(rate || 0)) * Math.max(0, Number(activityCount || 0)), safeCap);
}

export function allowedSecondVas(items = []) {
  return (items || []).filter(item => SECOND_ALLOWED_VAS_KEYS.includes(item?.key));
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

export function calculateFreePhoneSpecialOutcome({
  planIncentive = 0,
  vasIncentive = 0,
  insuranceIncentive = 0,
  secondIncentive = 0,
  approvedSpotIncentive = 0,
  isFreePhoneSpecial = false,
} = {}) {
  const requested = {
    plan: Math.max(0, Number(planIncentive || 0)),
    vas: Math.max(0, Number(vasIncentive || 0)),
    insurance: Math.max(0, Number(insuranceIncentive || 0)),
    second: Math.max(0, Number(secondIncentive || 0)),
    spot: Math.max(0, Number(approvedSpotIncentive || 0)),
  };
  const paid = isFreePhoneSpecial
    ? { ...requested, plan: 0, vas: 0, insurance: 0 }
    : requested;
  return {
    requested,
    paid,
    excluded: {
      plan: requested.plan - paid.plan,
      vas: requested.vas - paid.vas,
      insurance: requested.insurance - paid.insurance,
    },
    total: Object.values(paid).reduce((sum, value) => sum + value, 0),
    countsAsPerformance: true,
    countsAsActivitySupport: true,
  };
}

export function summarizeHomeStatuses(orders = [], month) {
  const monthRows = (orders || []).filter(order => {
    const dateMonth = String(order?.source_work_date || order?.actual_install_date || '').slice(0, 7);
    return dateMonth === month && order?.status !== 'cancelled';
  });
  const bundleKey = row => {
    const date = String(row?.source_work_date || row?.actual_install_date || '').slice(0, 10);
    return `${date}|${row?.customer_id || row?.customer_name || row?.id}`;
  };
  const uniqueCount = rows => new Set(rows.map(bundleKey)).size;
  const completedRows = monthRows.filter(row => row?.status === 'completed');
  const pendingRows = monthRows.filter(row => row?.status === 'pending');
  return {
    rows: monthRows,
    completedRows,
    pendingRows,
    completedCount: uniqueCount(completedRows),
    pendingCount: uniqueCount(pendingRows),
    totalCount: uniqueCount(monthRows),
  };
}
