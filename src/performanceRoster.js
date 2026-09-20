// Activity controls today's roster, never ownership of historical sales.
export function activeRoster(employees = []) {
  return employees.filter(employee => employee.active !== false);
}

export function hasMonthHistory(employee, {dailyRecords = {}, monthRecords = {}, homePolicyMap = {}, shadowLedgerMap = {}, approvedMobileSpotMap = {}} = {}) {
  const id = employee.id;
  return employee.active !== false
    || Object.keys(dailyRecords[id] || {}).length > 0
    || Boolean(monthRecords[id]?.updatedAt)
    || Boolean(homePolicyMap[id])
    || Number(shadowLedgerMap[id]?.totalSales || 0) > 0
    || Number(approvedMobileSpotMap[id] || 0) !== 0;
}

// PostgREST caps each response; historical staff can push a month past that cap.
export async function readAllPages(query, pageSize = 1000) {
  const data = [];
  for (let offset = 0; ; offset += pageSize) {
    const result = await query().range(offset, offset + pageSize - 1);
    if (result.error) return {data: null, error: result.error};
    data.push(...(result.data || []));
    if ((result.data || []).length < pageSize) return {data, error: null};
  }
}
