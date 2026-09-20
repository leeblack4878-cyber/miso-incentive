// These are display filters over already permission-scoped data, not access grants.
export function resolveDashboardStore(selected, available, canSwitch, loginBranch, areaStores = {}) {
  if (!canSwitch) return available.includes(loginBranch) ? loginBranch : (available[0] || '');
  const area = selected?.startsWith('area:') ? areaStores[selected.slice(5)] : null;
  return selected === 'all' || available.includes(selected) || area?.some(branch => available.includes(branch)) ? selected : 'all';
}

export function performanceForecastFactor(month, now = new Date()) {
  const date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(now);
  if (date.slice(0, 7) !== month) return 1;
  const [year, monthNumber, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate() / day;
}

// Intersect every area with the stores already authorized for this viewer.
export function dashboardScopeBranches(selected, available, areaStores = {}) {
  if (selected === 'all') return available;
  if (selected?.startsWith('area:')) return available.filter(branch => (areaStores[selected.slice(5)] || []).includes(branch));
  return available.filter(branch => branch === selected);
}
export function dashboardAreaOptions(available, areaStores, areaLabels) {
  return Object.entries(areaStores).filter(([,branches]) => branches.some(branch => available.includes(branch)))
    .map(([area]) => ({key:`area:${area}`,label:areaLabels[area] || area}));
}
