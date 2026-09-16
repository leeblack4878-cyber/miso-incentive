import test from 'node:test';
import assert from 'node:assert/strict';
import {COMPANY_SCOPE_VIEWERS,NON_EXECUTIVE_COMPANY_CONTROLLERS,SALES_MANAGER_AREAS,PRIMARY_PERMISSION_ADMIN_ID,scopedEmployeesFor,teamSupportEligibleFor} from '../src/permissionScopes.js';

const executives=[...COMPANY_SCOPE_VIEWERS].map(id=>({id,branch:'운영진'}));
const controllers=[...NON_EXECUTIVE_COMPANY_CONTROLLERS].map(id=>({id,branch:'운영진'}));
const areas=Object.entries(SALES_MANAGER_AREAS).map(([id,area])=>({id,area,branch:'운영진'}));
const workers=[{id:'a',branch:'안산1'},{id:'b',branch:'시흥1'},{id:'c',branch:'외부'}];
const employees=[...executives,...controllers,...areas,...workers];
const select=(viewer,extra={})=>scopedEmployeesFor({viewer,authUserId:viewer.id,employees,areaStores:{ansan:['안산1'],siheung:['시흥1']},...extra}).map(e=>e.id);

test('전사·임원제외·담당상권·점장·직원 범위가 기존 대상과 일치한다',()=>{
 for(const v of executives)assert.deepEqual(select(v),employees.map(e=>e.id));
 for(const v of controllers)assert.deepEqual(select(v),employees.filter(e=>!COMPANY_SCOPE_VIEWERS.has(e.id)).map(e=>e.id));
 assert.deepEqual(select(areas[0]),[areas[0].id,'a']);
 assert.deepEqual(select(areas[1]),[areas[1].id,'b']);
 assert.deepEqual(select({id:'leader',branch:'시흥1'},{isStoreLeader:true}),['b']);
 assert.deepEqual(select(workers[0]),['a']);
});
test('이름 변경 후에도 기존 범위와 임원 제외를 유지한다',()=>{
 for(const v of [...executives,...controllers,...areas])assert.deepEqual(select({...v,name:'새이름'}),select(v));
 assert.equal(COMPANY_SCOPE_VIEWERS.has(PRIMARY_PERMISSION_ADMIN_ID),true);
});
test('동명이인 계정은 전사·담당상권·지원판매 권한을 얻지 않는다',()=>{
 for(const name of ['이강진','김진문','정유미','김솔이','김진백','임성준']){
  const impostor={id:'a',name,position:'사원',branch:'안산1'};
  assert.deepEqual(select(impostor),['a']);
  assert.equal(teamSupportEligibleFor(impostor),false);
 }
});
test('지원판매는 기존 지정계정 또는 담당 직급만 유지한다',()=>{
 for(const v of executives)assert.equal(teamSupportEligibleFor({...v,name:'변경',position:'실장'}),true);
 assert.equal(teamSupportEligibleFor({id:'9d1db3e4-1292-49bf-89f7-6d04a439a7e2',position:'사원'}),true);
 assert.equal(teamSupportEligibleFor({id:'other',position:'영업담당'}),true);
 assert.equal(teamSupportEligibleFor({id:'other',position:'점장'}),false);
 assert.equal(teamSupportEligibleFor(null),false);
});
