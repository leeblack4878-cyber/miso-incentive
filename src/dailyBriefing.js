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

export function resolveStoreBriefingGoals({ defaults = {}, companyGoals = {}, challengeGoals = {} } = {}) {
  return { ...defaults, ...companyGoals, ...challengeGoals };
}

function metricText(metric) {
  const suffix = metric.unit === 'won' ? '원' : metric.unit === 'point' ? 'P' : '건';
  const round = metric.unit === 'point'
    ? Math.round(metric.forecast * 10) / 10
    : Math.round(metric.forecast);
  const value = metric.unit === 'won' ? round.toLocaleString('ko-KR') : String(round);
  const rate = metric.forecastRate === null ? '목표 미설정' : `목표 대비 ${Math.round(metric.forecastRate)}%`;
  return `${metric.label} ${value}${suffix} (${rate})`;
}

function contextualCheer({ dateLabel = '', storeName = '', weak = [], missingNames = [], overdueInstalls = [], good = [] } = {}) {
  const seed = [...`${dateLabel}|${storeName}`].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const pick = (items) => items[seed % items.length];
  if (overdueInstalls.length) return pick([
    `설치 지연 건부터 차분히 풀고 좋은 흐름으로 바꿔봐요. ${storeName} 화이팅! 💪`,
    `오늘은 설치 진행 상황을 먼저 정리하면 흐름이 한결 좋아질 거예요. ${storeName} 화이팅! 🙌`,
  ]);
  if (missingNames.length) return pick([
    `입력 확인부터 빠르게 마치고 오늘 실적에 집중해봐요. ${storeName} 화이팅! 💪`,
    `누락된 입력을 챙기고 매장의 실제 흐름을 정확히 만들어봐요. ${storeName} 화이팅! ✅`,
  ]);
  if (weak.length) {
    const focus = weak.slice(0, 2).map((metric) => metric.label).join('·');
    return pick([
      `오늘은 ${focus}에 한 건씩 더 집중해 부족한 흐름을 끌어올려봐요. ${storeName} 화이팅! 💪`,
      `${focus}가 오늘의 핵심입니다. 작은 한 건부터 차근차근 채워봐요. ${storeName} 화이팅! 🔥`,
      `좋은 항목은 유지하고 ${focus}를 집중 보완해봐요. ${storeName} 화이팅! 🙌`,
    ]);
  }
  if (good.length) return pick([
    `목표를 향한 흐름이 좋습니다. 오늘도 이 기세 그대로 이어가요. ${storeName} 화이팅! 🔥`,
    `지금의 좋은 페이스를 팀 모두가 함께 이어가봐요. ${storeName} 화이팅! 🙌`,
    `쌓아온 흐름이 숫자로 보이고 있습니다. 오늘도 힘차게 가요. ${storeName} 화이팅! 💜`,
  ]);
  return `오늘의 첫 한 건부터 좋은 흐름을 만들어봐요. ${storeName} 화이팅! 💪`;
}

export function buildStoreBriefingText({ dateLabel, storeName, inputRows = [], metrics = [], todayTasks = [], todayInstalls = [], overdueInstalls = [] } = {}) {
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
    `좋은 아침입니다 😊 ${dateLabel} ${storeName} 브리핑 공유드립니다.`,
    `현재 근무 대상 ${workingCount}명 중 ${count('input')}명이 실적을 입력했습니다.`,
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
  if (good.length) lines.push('', '[월말 예상 · 좋은 흐름]', ...good.slice(0, 3).map((metric) => `- ${metricText(metric)}`));
  if (weak.length) lines.push('', '[월말 예상 · 보완 필요]', ...weak.slice(0, 3).map((metric) => `- ${metricText(metric)}`));
  if (unset.length) lines.push(`아직 목표가 설정되지 않은 항목은 ${unset.map((metric) => metric.label).join(', ')}입니다.`);
  if (!good.length && !weak.length && unset.length === metrics.length) lines.push('매장 목표를 입력하면 예상 마감과 강점·부족 항목을 함께 판단할 수 있습니다.');

  lines.push('', '[오늘 일정]');
  lines.push(todayTasks.length
    ? `고객 약속 ${todayTasks.length}건 · ${todayTasks.map((row) => `${row.customerName || '고객명 미입력'}(${row.title || '약속'}${row.employeeName ? ` · ${row.employeeName}` : ''})`).join(', ')}`
    : '오늘 고객 약속은 없습니다.');
  lines.push(todayInstalls.length
    ? `홈 설치 예정 ${todayInstalls.length}건 · ${todayInstalls.map((row) => `${row.customerName || '고객명 미입력'}${row.employeeName ? `(${row.employeeName})` : ''}`).join(', ')}`
    : '오늘 홈 설치 예정은 없습니다.');
  if (overdueInstalls.length) lines.push(`⚠️ 예정일이 지난 홈 미완료 ${overdueInstalls.length}건 · ${overdueInstalls.map((row) => `${row.customerName || '고객명 미입력'}(${row.plannedDate || '일정 미정'}${row.employeeName ? ` · ${row.employeeName}` : ''})`).join(', ')}`);

  const actions = [];
  if (weak.length) actions.push(`${weak.slice(0, 2).map((metric) => metric.label).join('·')} 실적을 우선 보완해주세요.`);
  if (missingNames.length) actions.push(`${missingNames.join(', ')}님의 입력 여부를 확인해주세요.`);
  if (unset.length) actions.push('미설정 목표도 확인해주세요.');
  if (todayTasks.length) actions.push(`고객 약속 ${todayTasks.length}건을 확인해주세요.`);
  if (todayInstalls.length) actions.push(`오늘 홈 설치 ${todayInstalls.length}건을 확인해주세요.`);
  if (overdueInstalls.length) actions.push(`설치 지연 ${overdueInstalls.length}건의 진행 상태를 확인해주세요.`);
  if (actions.length) lines.push('', `[오늘 함께 챙길 것]`, ...actions.map((action) => `- ${action}`));
  else lines.push('', '오늘도 현재의 좋은 흐름을 함께 이어가겠습니다.');
  const cheer = contextualCheer({ dateLabel, storeName, weak, missingNames, overdueInstalls, good });
  lines.push('', cheer);
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
    '아래 내용은 각 매장 단톡방에 바로 전달할 수 있는 브리핑입니다.',
  ].join('\n');
  return [header, ...stores.map((store) => buildStoreBriefingText({ dateLabel, ...store }))].join('\n\n');
}
