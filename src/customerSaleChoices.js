const pending = t => t.status !== 'completed' && t.status !== 'cancelled';
export const customerMonthLabel = month => /^\d{4}-\d{2}$/.test(month) ? `${month.slice(0,4)}년 ${Number(month.slice(5))}월` : '날짜 미확인';
export function saleKind(sale) {
  if(sale.source_type==='home_order'||sale.source_type==='home')return '홈';
  if(['mobile','daily'].includes(sale.source_type))return '모바일';
  return '기타';
}
export function saleReference(sale) {
  return {id:sale.id,customer_id:sale.customer_id,date:String(sale.sale_date||'').slice(0,10),kind:saleKind(sale),label:sale.metric_label||''};
}
export function taskChoiceKey(task) {
  const id=task.task_meta?.sale_reference?.id||task.source_sale_id;
  return id?`sale:${id}`:`legacy:${task.customer_id}`;
}
export function customerSaleChoices({customers=[],sales=[],tasks=[],orders=[],includeHistory=false}) {
  const names=new Map(customers.map(c=>[c.id,c.customer_name]));
  const orderStates=new Map(orders.map(o=>[String(o.id),o.status]));
  const relevantTasks=tasks.filter(t=>includeHistory||pending(t));
  const choices=new Map();
  const taskDates=new Map();
  for(const task of relevantTasks){const key=taskChoiceKey(task),date=String(task.base_date||'').slice(0,10);if(date>(taskDates.get(key)||''))taskDates.set(key,date);}
  const saleById=new Map(sales.map(s=>[s.id,s]));
  for(const sale of sales){
    if(sale.status==='cancelled'||(sale.source_type==='home_order'&&orderStates.get(String(sale.source_ref))==='cancelled'))continue;
    const ref=saleReference(sale);
    choices.set(`sale:${sale.id}`,{key:`sale:${sale.id}`,customerId:sale.customer_id,name:names.get(sale.customer_id)||'고객',date:ref.date,kind:ref.kind,label:ref.label,reference:ref});
  }
  for(const task of relevantTasks){
    const key=taskChoiceKey(task);
    if(choices.has(key))continue;
    const ref=task.task_meta?.sale_reference||(saleById.has(task.source_sale_id)?saleReference(saleById.get(task.source_sale_id)):null);
    // Never infer a sale from customer name/date: old tasks may belong to a namesake.
    choices.set(key,{key,customerId:task.customer_id,name:names.get(task.customer_id)||'고객',date:ref?.date||taskDates.get(key)||'',kind:ref?.kind||'기존 약속',label:ref?.label||'판매 연결 미확인',reference:ref||null,archived:!!ref});
  }
  const rows=[...choices.values()].map(row=>({...row,month:/^\d{4}-\d{2}-\d{2}$/.test(row.date)?row.date.slice(0,7):'unknown'})).sort((a,b)=>b.date.localeCompare(a.date)||a.name.localeCompare(b.name,'ko')||a.key.localeCompare(b.key));
  // Resolve display collisions before month/search filtering. Never change sale keys
  // or stored references, and never use a name to merge unrelated customers.
  const groups=new Map();
  for(const row of rows){
    const label=customerChoiceLabel(row);
    if(!groups.has(label))groups.set(label,[]);
    groups.get(label).push(row);
  }
  for(const group of groups.values()){
    if(group.length<2)continue;
    group.forEach((row,index)=>{
      row.choiceDetail=[row.kind,row.label,row.archived?'이전 판매':null,`${index+1}건째`].filter(Boolean).join(' · ');
    });
  }
  return rows;
}
export function customerChoiceLabel(row) {
  const date=row.date?`${row.date.slice(0,4)}.${row.date.slice(5,7)}.${row.date.slice(8,10)}`:'날짜 미확인';
  return `${row.name} · ${date}${row.choiceDetail?` · ${row.choiceDetail}`:''}`;
}
