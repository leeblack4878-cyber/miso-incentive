// These are display filters over already permission-scoped data, not access grants.
export function resolveDashboardStore(selected, available, canSwitch, loginBranch) {
  if (!canSwitch) return available.includes(loginBranch) ? loginBranch : (available[0] || '');
  return selected === 'all' || available.includes(selected) ? selected : 'all';
}

export function performanceForecastFactor(month, now = new Date()) {
  const date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(now);
  if (date.slice(0, 7) !== month) return 1;
  const [year, monthNumber, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate() / day;
}
