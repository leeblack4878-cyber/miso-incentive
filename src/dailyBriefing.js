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
  const workingCount = inputRows.length - count('off');
  const missingNames = inputRows.filter((row) => row.status === 'missing').map((row) => row.name);
  const zeroNames = inputRows.filter((row) => row.status === 'zero').map((row) => row.name);
  const dailyLines = inputRows
    .filter((row) => row.status === 'input')
    .map((row) => `${row.name} ${row.summary || '입력 완료'}`);
  const good = metrics.filter((metric) => metric.state === 'good').sort((a, b) => b.forecastRate - a.forecastRate);
  const weak = metrics.filter((metric) => metric.state === 'low' || metric.state === 'watch').sort((a, b) => a.forecastRate - b.forecastRate);
  const unset = metrics.filter((metric) => metric.state === 'unset');
  const intro = [
    `점장님, ${dateLabel} ${storeName}은 근무 대상 ${workingCount}명 중 ${count('input')}명이 실적을 입력했습니다.`,
    count('zero') ? `${count('zero')}명은 실적 0건으로 확인했습니다.` : '',
    count('off') ? `휴무는 ${count('off')}명입니다.` : '',
  ].filter(Boolean).join(' ');
  const lines = [
    `[${storeName} | ${dateLabel} 브리핑]`,
    '',
    intro,
  ];
  if (dailyLines.length) lines.push('', `등록된 실적은 ${dailyLines.join(' / ')}입니다.`);
  else lines.push('', '등록된 실적은 없습니다.');
  if (zeroNames.length) lines.push(`실적 0건으로 확인한 직원은 ${zeroNames.join(', ')}입니다.`);
  if (missingNames.length) lines.push(`아직 입력이 확인되지 않은 직원은 ${missingNames.join(', ')}입니다.`);
  if (good.length) lines.push('', `월말 예상 기준으로 ${good.slice(0, 3).map(metricText).join(' · ')}은 좋은 흐름입니다.`);
  if (weak.length) lines.push(`반면 ${weak.slice(0, 3).map(metricText).join(' · ')}은 보완이 필요합니다.`);
  if (unset.length) lines.push(`아직 목표가 설정되지 않은 항목은 ${unset.map((metric) => metric.label).join(', ')}입니다.`);
  if (!good.length && !weak.length && unset.length === metrics.length) lines.push('매장 목표를 입력하면 예상 마감과 강점·부족 항목을 함께 판단할 수 있습니다.');

  const actions = [];
  if (weak.length) actions.push(`${weak.slice(0, 2).map((metric) => metric.label).join('·')} 실적을 우선 보완`);
  if (missingNames.length) actions.push(`${missingNames.join(', ')}님의 입력 여부를 확인`);
  if (unset.length) actions.push('미설정 목표를 입력');
  if (actions.length) lines.push('', `오늘은 ${actions.join('하고, ')}해주세요.`);
  else lines.push('', '오늘도 현재의 좋은 흐름을 이어가 주세요.');
  return lines.join('\n');
}

export function buildAllBriefingText({ dateLabel, stores = [] } = {}) {
  const inputRows = stores.flatMap((store) => store.inputRows || []);
  const count = (status) => inputRows.filter((row) => row.status === status).length;
  const workingCount = inputRows.length - count('off');
  const header = [
    `[미소모바일 | ${dateLabel} 일일 브리핑]`,
    '',
    `${dateLabel} 전체 근무 대상 ${workingCount}명 중 ${count('input')}명이 실적을 입력했고, ${count('zero')}명은 0건으로 확인했습니다. 미입력 ${count('missing')}명, 휴무 ${count('off')}명입니다.`,
    count('missing') ? '오늘은 미입력 확인과 매장별 부족 지표 보완이 우선입니다.' : '전원 입력이 확인됐습니다. 매장별 예상 마감 흐름을 점검해주세요.',
    '',
    '아래는 점장별로 바로 전달할 수 있는 매장 피드백입니다.',
  ].join('\n');
  return [header, ...stores.map((store) => buildStoreBriefingText({ dateLabel, ...store }))].join('\n\n');
}
