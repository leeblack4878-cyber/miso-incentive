export const DAILY_BRIEFING_SEND_TIME = '08:30';
export const DAILY_BRIEFING_OWNER_IDS = new Set(['a50a0979-acef-40b1-98b7-f05074f1c835']);

export function briefingMobileCount(draft = {}, key) {
  const countRow = (index) => (draft.matrix?.[index] || []).reduce((sum, n) => sum + Number(n || 0), 0);
  if (key === 'simMnp') return countRow(5);
  if (key === 'second') return countRow(7) + Object.values(draft.bundle2nd || {}).reduce((sum, n) => sum + Number(n || 0), 0);
  return 0;
}

// Rebuild cumulative metrics from dated sources; never scale a full-month row
// with an earlier report day's forecast factor.
export function buildBriefingPeriodRows({ rows = [], dailyRecords = {}, orders = [], month, reportDay, rebuild }) {
  const cutoff = `${month}-${String(reportDay).padStart(2, '0')}`;
  return rows.map(row => {
    const days = Object.fromEntries(Object.entries(dailyRecords[row.id] || {})
      .filter(([day]) => Number(day) >= 1 && Number(day) <= Number(reportDay)));
    const completedOrders = orders.filter(order => order.user_id === row.id && order.status === 'completed'
      && String(order.actual_install_date || '').slice(0, 7) === month
      && String(order.actual_install_date).slice(0, 10) <= cutoff);
    return rebuild(row, days, completedOrders);
  });
}

export function canAccessDailyBriefing(userId) {
  return DAILY_BRIEFING_OWNER_IDS.has(String(userId || ''));
}

export function dailyInputStatus({ dayOff = false, hasPerformance = false, zeroConfirmed = false } = {}) {
  if (dayOff) return 'off';
  if (hasPerformance) return 'input';
  if (zeroConfirmed) return 'zero';
  return 'missing';
}

export function projectMetric({ current = 0, target = 0, factor = 1, elapsedRate } = {}) {
  const actual = Number(current || 0);
  const goal = Number(target || 0);
  const forecast = actual * Math.max(1, Number(factor || 1));
  const forecastRate = goal > 0 ? (forecast / goal) * 100 : null;
  const progressRate = goal > 0 ? (actual / goal) * 100 : null;
  let state = 'unset';
  if (forecastRate !== null) {
    if (forecastRate >= 100) state = 'good';
    else if (forecastRate >= 80) state = 'watch';
    else state = 'low';
  }
  const expectedRate = elapsedRate === undefined ? 100 / Math.max(1, Number(factor || 1)) : Number(elapsedRate);
  return { current: actual, target: goal, forecast, forecastRate, progressRate, expectedRate, state };
}

export function resolveStoreBriefingGoals({ defaults = {}, companyGoals = {}, challengeGoals = {} } = {}) {
  return { ...defaults, ...companyGoals, ...challengeGoals };
}

export function isBriefingMonthOverdueHome(order = {}, month = '', today = '') {
  const sourceMonth = String(order.source_work_date || '').slice(0, 7);
  const plannedDate = String(order.plannedDate || order.planned_install_date || '').slice(0, 10);
  return sourceMonth === month && Boolean(plannedDate) && plannedDate < today;
}

export function briefingValue(metric, value) {
  const suffix = metric.unit === 'won' ? '원' : metric.unit === 'point' ? 'P' : '건';
  const rounded = metric.unit === 'won' ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded.toLocaleString('ko-KR')}${suffix}`;
}

export function briefingMetricSummary(metric) {
  const rate = metric.progressRate === null ? '—' : `${Math.round(metric.progressRate * 10) / 10}%`;
  return `목표 ${metric.target > 0 ? briefingValue(metric, metric.target) : '미설정'} · 실적 ${briefingValue(metric, metric.current)} · 달성 ${rate}`;
}

export function briefingPaceText(metric) {
  if (metric.target <= 0 || !Number.isFinite(metric.expectedRate)) return '진척 비교 불가';
  const gap = Math.round((metric.progressRate - metric.expectedRate) * 10) / 10;
  if (gap === 0) return '진척 대비 동일';
  return `진척 대비 ${Math.abs(gap)}%p ${gap > 0 ? '초과' : '부족'}`;
}

function inputSummary(inputRows) {
  const count = (status) => inputRows.filter(row => row.status === status).length;
  return `입력 ${count('input')}명 · 0건 ${count('zero')}명 · 미입력 ${count('missing')}명 · 휴무 ${count('off')}명`;
}

export function buildStoreBriefingText({ dateLabel, storeName, inputRows = [], metrics = [], todayTasks = [], todayInstalls = [], overdueInstalls = [] } = {}) {
  const expectedRate = metrics.find(metric => Number.isFinite(metric.expectedRate))?.expectedRate;
  const lines = [
    `[${storeName} | ${dateLabel}]`,
    ...(expectedRate === undefined ? [] : [`진척 기준 ${Math.round(expectedRate * 10) / 10}%`]),
    ...metrics.map(metric => `${metric.label} | ${briefingMetricSummary(metric)} | ${briefingPaceText(metric)}`),
    inputSummary(inputRows),
  ];
  const missingNames = inputRows.filter(row => row.status === 'missing').map(row => row.name);
  if (missingNames.length) lines.push(`미입력: ${missingNames.join(', ')}`);
  lines.push(`오늘 약속 ${todayTasks.length}건 · 설치 ${todayInstalls.length}건 · 설치 지연 ${overdueInstalls.length}건`);
  return lines.join('\n');
}

export function buildAllBriefingText({ dateLabel, stores = [] } = {}) {
  return [
    `[미소모바일 | ${dateLabel}]`,
    inputSummary(stores.flatMap(store => store.inputRows || [])),
    ...stores.map(store => buildStoreBriefingText({ dateLabel, ...store })),
  ].join('\n\n');
}
