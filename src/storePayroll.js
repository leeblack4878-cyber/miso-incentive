import {payDisplay} from './payDisplay.js';
import {readAllPages} from './performanceRoster.js';
export async function loadStorePayrollAdjustments(client,month,ids=[]){
 const spots={},expenses={};if(!ids.length)return {spots,expenses};
 const end=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),1)).toISOString().slice(0,10);
 for(let i=0;i<ids.length;i+=100){
  const part=ids.slice(i,i+100);
  const [s,e]=await Promise.all([
   readAllPages(()=>client.from('spot_claims').select('id,user_id,final_amount,direct_amount,source_context,spot_policies(amount)').in('user_id',part).eq('status','approved').gte('claim_date',`${month}-01`).lt('claim_date',end).order('id')),
   readAllPages(()=>client.from('sales_expenses').select('id,user_id,amount').is('voided_at',null).in('user_id',part).gte('expense_date',`${month}-01`).lt('expense_date',end).order('id')),
  ]);
  if(s.error||e.error)throw s.error||e.error;
  for(const row of s.data||[])if(row.source_context!=='mobile')spots[row.user_id]=(spots[row.user_id]||0)+Number(row.final_amount??row.direct_amount??row.spot_policies?.amount??0);
  for(const row of e.data||[])expenses[row.user_id]=(expenses[row.user_id]||0)+Number(row.amount||0);
 }
 return {spots,expenses};
}
export function summarizeStorePayroll(rows=[],{spots={},expenses={}}={}){
 const byStore={},seen=new Set();
 for(const row of rows){
  if(!row.id||row.teamOnly||row.position==='기타'||seen.has(row.id))continue;seen.add(row.id);
  const store=row.branch||'매장 미확인';
  if(!byStore[store])byStore[store]={total:0,employees:[],pending:0};
  const group=byStore[store];
  if(!row.pay||!Number.isFinite(row.pay.total)){group.pending++;continue;}
  const amount=payDisplay(row.pay,spots[row.id]||0,expenses[row.id]||0).total;
  group.total+=amount;group.employees.push({id:row.id,name:row.name||'이름 미설정',employeeCode:row.employeeCode||'',amount});
 }
 for(const group of Object.values(byStore))group.employees.sort((a,b)=>b.amount-a.amount||a.name.localeCompare(b.name,'ko'));
 return byStore;
}
