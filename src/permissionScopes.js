// Existing account identities verified against production profiles on 2026-09-16.
// These IDs identify principals; role/status/store checks still apply on the server.
export const PRIMARY_PERMISSION_ADMIN_ID='a50a0979-acef-40b1-98b7-f05074f1c835';
export const COMPANY_SCOPE_VIEWERS=new Set([
  PRIMARY_PERMISSION_ADMIN_ID,'f0329992-ced4-4407-b71d-ed58c5d74aaf',
]);
export const NON_EXECUTIVE_COMPANY_CONTROLLERS=new Set([
  '6ba6651a-8e5b-4e21-a00d-1d2e0ff492bb','9d1db3e4-1292-49bf-89f7-6d04a439a7e2',
]);
export const SALES_MANAGER_AREAS=Object.freeze({
  'f2cc7718-b1f2-4cf1-8c5c-5b9ae6493da5':'ansan',
  '471280af-a046-4d25-a27d-63a0c5978403':'siheung',
});
export function teamSupportEligibleFor(employee){
  return !!employee&&(String(employee.position||'').includes('담당')||
    COMPANY_SCOPE_VIEWERS.has(employee.id)||employee.id==='9d1db3e4-1292-49bf-89f7-6d04a439a7e2');
}

// UI selection only. The database independently enforces write authorization.
export function scopedEmployeesFor({viewer,authUserId,isStoreLeader,employees,areaStores}){
  if(COMPANY_SCOPE_VIEWERS.has(viewer?.id))return employees;
  if(NON_EXECUTIVE_COMPANY_CONTROLLERS.has(viewer?.id))
    return employees.filter(employee=>!COMPANY_SCOPE_VIEWERS.has(employee.id));
  const area=SALES_MANAGER_AREAS[viewer?.id];
  if(area)return employees.filter(employee=>employee.id===authUserId||areaStores[area]?.includes(employee.branch));
  if(isStoreLeader)return employees.filter(employee=>employee.branch===viewer?.branch);
  return employees.filter(employee=>employee.id===authUserId);
}
