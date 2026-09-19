export const USED_PHONE_METHODS = ['고객 입금','위약금 수납','요금 수납','잔여 할부금 수납','새 기기 기기값 수납','기타'];
export const isInsurance = key => ['vasPhonePass','vasSafePass'].includes(key);
export const isAutoReminder = task => /^(plan93|plan183)$|^(addon93|insurance93)_/.test(task.task_type);
export function reminderServices(keys, catalog) {
  return [...new Set(keys)].filter(k => !['vasNone','vasStrategicPlan'].includes(k)).map(key => ({key,label:catalog.find(v=>v.key===key)?.label||key,insurance:isInsurance(key)}));
}
const addDays = (date, days) => {const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);};
export function restoreReminders(meta={}, tasks=[]) {
  if(meta.reminders)return structuredClone(meta.reminders);
  const types=new Set(tasks.filter(t=>!['completed','cancelled'].includes(t.status)).map(t=>t.task_type));
  return {plan:types.has('plan93')?(types.has('plan183')?'both':'93'):types.has('plan183')?'183':'keep',services:{}};
}
export function buildReminderTasks({saleDate,reminders,services,previous=[]}) {
  const desired=[];
  const append=(type,title,days)=>desired.push({task_type:type,title,base_date:saleDate,retention_days:days,due_date:addDays(saleDate,days),status:'pending',task_meta:{automatic_reminder:true}});
  if(['93','both'].includes(reminders.plan))append('plan93','요금제 변경 안내 · 3개월',93);
  if(['183','both'].includes(reminders.plan))append('plan183','요금제 변경 안내 · 6개월',183);
  services.forEach(s=>{if(reminders.services?.[s.key]==='93')append(`${s.insurance?'insurance93':'addon93'}_${s.key}`,`${s.label} · ${s.insurance?'보험 유지·해지 확인':'삭제 안내'}`,93);});
  // The RPC preserves closed rows. Keep rescheduled dates and notes on surviving pending rows.
  return desired.filter(t=>!previous.some(p=>p.task_type===t.task_type&&['completed','cancelled'].includes(p.status)))
    .map(t=>{const old=previous.find(p=>p.task_type===t.task_type&&p.status==='pending');return old?{...old,task_meta:{...old.task_meta,automatic_reminder:true}}:t;})
    .concat(previous.filter(t=>!isAutoReminder(t)&&t.status==='pending'));
}
function amount(value, optional=false) {
  if(optional&&(value===''||value==null))return null;
  if(value===''||value==null||!Number.isSafeInteger(Number(value))||Number(value)<0)throw new Error('금액은 0 이상의 정수로 입력해주세요.');
  return Number(value);
}
export function usedPhoneMeta(form, complete=false) {
  const expected_amount=amount(form.expected_amount,true),actual_amount=amount(form.actual_amount,true);
  const allocations=(form.allocations||[]).filter(r=>r.amount!==''&&r.amount!=null).map(r=>{
    if(!USED_PHONE_METHODS.includes(r.method))throw new Error('처리 방식을 선택해주세요.');
    if(r.method==='기타'&&!String(r.note||'').trim())throw new Error('기타 처리 내용을 입력해주세요.');
    return {method:r.method,amount:amount(r.amount),note:String(r.note||'').trim()};
  });
  const total=allocations.reduce((s,r)=>s+r.amount,0);
  if(actual_amount!==null&&total>actual_amount)throw new Error('처리 방식별 금액이 실제금액을 초과해요.');
  if(complete&&(actual_amount===null||total!==actual_amount||!form.processed_date))throw new Error('실제금액, 처리 완료일을 입력하고 처리 방식별 합계를 실제금액과 맞춰주세요.');
  return {expected_amount,actual_amount,allocations,processed_date:form.processed_date||null};
}
export function usedPhoneSummary(tasks,month) {
  const rows=tasks.filter(t=>t.task_type==='usedPhone'&&t.status==='completed'&&String(t.task_meta?.processed_date||'').slice(0,7)===month);
  const result={count:rows.length,expected:0,actual:0,pending:tasks.filter(t=>t.task_type==='usedPhone'&&t.status==='pending').length,methods:Object.fromEntries(USED_PHONE_METHODS.map(m=>[m,0]))};
  rows.forEach(t=>{const m=t.task_meta||{};result.expected+=Number(m.expected_amount||0);result.actual+=Number(m.actual_amount||0);(m.allocations||[]).forEach(r=>{if(r.method in result.methods)result.methods[r.method]+=Number(r.amount||0);});});
  return result;
}
export async function readAllCustomerRows(client,table,userId,order) {
  const rows=[];
  for(let from=0;;from+=1000){const {data,error}=await client.from(table).select('*').eq('user_id',userId).order(order,{ascending:false}).order('id').range(from,from+999);if(error)throw error;rows.push(...(data||[]));if((data||[]).length<1000)return rows;}
}
