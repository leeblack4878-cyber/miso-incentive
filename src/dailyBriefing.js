export const DAILY_BRIEFING_SEND_TIME = '08:30';
export const DAILY_BRIEFING_OWNER_IDS = new Set(['a50a0979-acef-40b1-98b7-f05074f1c835']);

export function canAccessDailyBriefing(userId) {
  return DAILY_BRIEFING_OWNER_IDS.has(String(userId || ''));
}

export function dailyInputStatus({ dayOff = false, hasPerformance = false, zeroConfirmed = false } = {}) {
  if (dayOff) return 'off';
  if (hasPerformance) return 'input';
  if (zeroConfirmed) return 'zero';
  return 'missing';
}

export function projectMetric({ current = 0, target = 0, factor = 1 } = {}) {
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
  return { current: actual, target: goal, forecast, forecastRate, progressRate, state };
}

function metricText(metric) {
  const suffix = metric.unit === 'won' ? '원' : metric.unit === 'point' ? 'P' : '건';
  const round = metric.unit === 'won' ? Math.round(metric.forecast) : Math.round(metric.forecast * 10) / 10;
  const value = metric.unit === 'won' ? round.toLocaleString('ko-KR') : String(round);
  const rate = metric.forecastRate === null ? '목표 미설정' : `목표 대비 ${Math.round(metric.forecastRate)}%`;
  return `${metric.label} ${value}${suffix} (${rate})`;
}

export function buildStoreBriefingText({ dateLabel, storeName, inputRows = [], metrics = [] } = {}) {
  const count = (status) => inputRows.filter((row) => row.status === status).length;
  const missingNames = inputRows.filter((row) => row.status === 'missing').map((row) => row.name);
  const zeroNames = inputRows.filter((row) => row.status === 'zero').map((row) => row.name);
  const dailyLines = inputRows
    .filter((row) => row.status === 'input')
    .map((row) => `${row.name} ${row.summary || '입력 완료'}`);
  const good = metrics.filter((metric) => metric.state === 'good').sort((a, b) => b.forecastRate - a.forecastRate);
  const weak = metrics.filter((metric) => metric.state === 'low' || metric.state === 'watch').sort((a, b) => a.forecastRate - b.forecastRate);
  const unset = metrics.filter((metric) => metric.state === 'unset');
  const lines = [
    `[${storeName} · ${dateLabel} 피드백]`,
    `입력 ${count('input')}명 · 0건 확인 ${count('zero')}명 · 미입력 ${count('missing')}명 · 휴무 ${count('off')}명`,
  ];
  if (dailyLines.length) lines.push(`어제 실적: ${dailyLines.join(' / ')}`);
  if (zeroNames.length) lines.push(`0건 확인: ${zeroNames.join(', ')}`);
  if (missingNames.length) lines.push(`미입력 확인: ${missingNames.join(', ')}`);
  if (good.length) lines.push(`잘하고 있는 항목: ${good.slice(0, 3).map(metricText).join(' · ')}`);
  if (weak.length) lines.push(`보완할 항목: ${weak.slice(0, 3).map(metricText).join(' · ')}`);
  if (unset.length) lines.push(`목표 입력 필요: ${unset.map((metric) => metric.label).join(', ')}`);
  if (!good.length && !weak.length && unset.length === metrics.length) lines.push('매장 목표를 입력하면 예상마감과 강점·부족 항목이 표시됩니다.');
  return lines.join('\n');
}

export function buildAllBriefingText({ dateLabel, stores = [] } = {}) {
  const inputRows = stores.flatMap((store) => store.inputRows || []);
  const count = (status) => inputRows.filter((row) => row.status === status).length;
  const header = [
    `[미소모바일 ${dateLabel} 일일 브리핑]`,
    `입력 ${count('input')}명 · 0건 확인 ${count('zero')}명 · 미입력 ${count('missing')}명 · 휴무 ${count('off')}명`,
  ].join('\n');
  return [header, ...stores.map((store) => buildStoreBriefingText({ dateLabel, ...store }))].join('\n\n');
}
