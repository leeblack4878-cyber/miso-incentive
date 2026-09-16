import test from 'node:test';
import assert from 'node:assert/strict';
import { dayAfterSaleDeletion, deleteExpense, deleteSaleAtomic } from '../src/saleMutations.js';
import { friendlyError } from '../src/errorMessages.js';
import { policyDisplayFor, policyPeriodFor } from '../src/policyCalendar.js';

const base = () => ({matrix:[[2]],groups:{vas:{insurance:2},bundle2nd:{watch:1},mnpBundle:{usedMnpBundle:1},homeBase:{homeTv:3}},specialReplacementPay:70000,specialMatrixOffset:30000,specialVasOffset:10000,bundleFreeOffset:20000,bundleFreeVasOffset:5000});
test('판매 삭제는 해당 건만 차감하고 홈·다른 판매 실적은 보존한다',()=>{
 const before=base();
 const next=dayAfterSaleDeletion(before,{source_type:'mobile',source_meta:{ri:0,ci:0,vasKeys:['insurance'],bundle2ndKeys:['watch'],usedMnpBundle:true,specialPolicy:{exceptionStatus:'approved',exceptionApprovedAmount:50000,normalMatrixFee:30000,normalVasFee:10000}}},{bundleOffset:20000,vasOffset:5000});
 assert.equal(next.matrix[0][0],1);assert.equal(next.groups.vas.insurance,1);assert.equal(next.groups.bundle2nd.watch,0);
 assert.equal(next.groups.homeBase.homeTv,3);assert.equal(next.specialReplacementPay,20000);
 assert.equal(next.specialMatrixOffset,0);assert.equal(next.bundleFreeOffset,0);
 assert.equal(before.specialReplacementPay,70000);assert.equal(before.matrix[0][0],2);
});
test('대기 예외금액·지원 판매는 개인 지급액에서 차감하지 않는다',()=>{
 assert.equal(dayAfterSaleDeletion(base(),{source_type:'mobile',source_meta:{ri:0,ci:0,specialPolicy:{exceptionStatus:'pending',replacementAmount:50000}}}).specialReplacementPay,70000);
 assert.equal(dayAfterSaleDeletion(base(),{source_type:'mobile',source_meta:{teamOnly:true}}),null);
});
test('구버전 번들 VAS와 신규 제외 플래그를 구분한다',()=>{
 const sale={source_type:'mobile',source_meta:{ri:0,ci:0,vasKeys:[],bundleVasMap:{watch:['insurance']}}};
 assert.equal(dayAfterSaleDeletion(base(),sale).groups.vas.insurance,1);
 sale.source_meta.bundleVasCommissionExcluded=true;
 assert.equal(dayAfterSaleDeletion(base(),sale).groups.vas.insurance,2);
});
test('기타 실적 삭제와 잘못된 원본은 구분한다',()=>{
 const before={...base(),tailoredCount:2,tailoredAmount:120000};
 const next=dayAfterSaleDeletion(before,{source_type:'extra',source_meta:{extraType:'tailored',count:1,amount:40000}});
 assert.equal(next.tailoredAmount,80000);assert.equal(next.tailoredCount,1);
 assert.throws(()=>dayAfterSaleDeletion(before,{source_type:'mobile',source_meta:{ri:99,ci:0}}),/SALE_UNSUPPORTED_SOURCE/);
});
function expenseClient(result){const chain={delete(){return this},eq(){return this},select:async()=>result};return {from:()=>chain};}
test('비용 삭제는 RLS 0건·DB 오류를 성공으로 처리하지 않는다',async()=>{
 await assert.rejects(deleteExpense(expenseClient({data:[],error:null}),'id','user'),/EXPENSE_DELETE_MISMATCH/);
 await assert.rejects(deleteExpense(expenseClient({data:null,error:new Error('denied')}),'id','user'),/denied/);
 await deleteExpense(expenseClient({data:[{id:'id'}],error:null}),'id','user');
});
test('삭제 RPC 실패 시 추가 저장 요청은 발생하지 않는다',async()=>{
 const calls=[];const before=base();
 const chain={select(){return this},eq(){return this},maybeSingle:async()=>({data:{data:before},error:null})};
 const client={from:()=>chain,rpc:async(name,args)=>{calls.push({name,args});return {error:new Error('SALE_STALE_DATA')}}};
 await assert.rejects(deleteSaleAtomic(client,{userId:'u',sale:{id:'s',sale_date:'2026-09-16',source_type:'mobile',source_meta:{ri:0,ci:0}},normalizeDay:x=>x}),/SALE_STALE_DATA/);
 assert.equal(calls.length,1);assert.equal(calls[0].name,'delete_sale_atomic');assert.deepEqual(calls[0].args.p_expected_day,before);
});
test('권한 오류를 월 마감으로 단정하지 않고 홈 내부 오류는 안내로 변환한다',()=>{
 assert.match(friendlyError({message:'new row violates row-level security policy'}),/권한.*마감 여부/);
 assert.match(friendlyError('is_month_locked'),/마감되어/);
 assert.doesNotMatch(friendlyError('HOME_REPLACE_ORDERS_MISMATCH'),/HOME_/);
});
test('10월은 기존 9월 정책 유지 사실만 표시하며 정책 선택을 변경하지 않는다',()=>{
 assert.equal(policyDisplayFor('2026-09').carriedForward,false);
 assert.equal(policyDisplayFor('2026-10').carriedForward,true);
 assert.equal(policyDisplayFor('2026-10').version,policyPeriodFor('2026-10').version);
 assert.equal(policyPeriodFor('2026-10').version,'2026-09-v1');
});

test('atomic save rejects a zero-row result and preserves the original database error',async()=>{
 const {saveSaleAtomic}=await import('../src/saleMutations.js');
 const params={userId:'owner',saleId:'sale',customerName:'customer',saleDate:'2026-09-16',sourceType:'mobile',meta:{ri:0,ci:0},expectedDay:null,nextDay:{matrix:[[1]]}};
 await assert.rejects(saveSaleAtomic({rpc:async()=>({data:{sale_count:0},error:null})},params),/SALE_SAVE_MISMATCH/);
 const original=new Error('db rollback');
 await assert.rejects(saveSaleAtomic({rpc:async()=>({data:null,error:original})},params),e=>e===original);
});

test('mobile edit refuses an unreadable expense snapshot instead of opening an empty form',async()=>{
 const {readSaleChildren}=await import('../src/saleMutations.js');
 const client={from(table){const q={select(){return q},eq(){return q},order(){return q},then(resolve){return Promise.resolve({data:[],error:table==='sales_expenses'?new Error('expense lookup failed'):null}).then(resolve)}};return q;}};
 await assert.rejects(readSaleChildren(client,'owner','sale'),/expense lookup failed/);
});
