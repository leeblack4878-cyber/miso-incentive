export const NOVEMBER_MNP_HOME_PROMOTION={id:'2026-11-17-mnp-home',start:'2026-11-17',end:'2026-11-30',installEnd:'2026-11-30'};
const internetTypes=['internet100','internet500','internet1g'];
const validDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(`${d}T00:00:00Z`))&&new Date(`${d}T00:00:00Z`).toISOString().slice(0,10)===d;
export function calculateNovemberMnpHomeBonusFromOrders(orders=[],weekend,period=NOVEMBER_MNP_HOME_PROMOTION){
 const unique=new Map(),conflicts=new Set(),groups=new Map(),pending=[],payouts=[];
 const overlap=new Set([...(weekend?.payouts||[]),...(weekend?.pending||[])].map(row=>row.key).filter(Boolean));
 for(const row of orders){
  if(!row?.id||row.team_only||!['simulMnp','homeTv',...internetTypes].includes(row.product_type))continue;
  const id=String(row.id);
  if(unique.has(id)&&JSON.stringify(unique.get(id))!==JSON.stringify(row))conflicts.add(id);
  unique.set(id,row);
 }
 for(const row of unique.values()){
  if(row.status==='cancelled')continue;
  const date=String(row.source_work_date||'').slice(0,10);
  if(!validDate(date)){if(row.product_type==='simulMnp')pending.push({id:row.id,reason:'청약일 확인 필요'});continue}
  if(date<period.start||date>period.end)continue;
  if(!row.customer_id||!row.user_id){if(row.product_type==='simulMnp')pending.push({id:row.id,reason:'고객·담당자 연결 확인 필요'});continue}
  const key=JSON.stringify([row.user_id,row.customer_id,date]);
  const group=groups.get(key)||[]; group.push(row);groups.set(key,group);
 }
 for(const [key,rows] of groups){
  const markers=rows.filter(r=>r.product_type==='simulMnp');
  if(!markers.length)continue;
  const internet=rows.filter(r=>internetTypes.includes(r.product_type)),tv=rows.filter(r=>r.product_type==='homeTv');
  if(markers.length!==1||internet.length!==1||tv.length!==1||rows.some(r=>conflicts.has(String(r.id)))){
   pending.push({key,reason:'HS MNP·인터넷·메인 TV 묶음 또는 중복 원본 확인 필요'});continue
  }
  const date=String(markers[0].source_work_date).slice(0,10);
  if(rows.some(r=>r.status!=='completed')){pending.push({key,reason:'설치 완료 대기'});continue}
  const installs=rows.map(r=>String(r.actual_install_date||'').slice(0,10));
  if(installs.some(d=>!validDate(d))){pending.push({key,reason:'설치일 확인 필요'});continue}
  if(installs.some(d=>d<date||d>period.installEnd))continue;
  if(overlap.has(key)){pending.push({key,reason:'11/20~23 주말 홈 정책과 중복 지급 확인 필요'});continue}
  payouts.push({key,date,customer:internet[0].customer_name||'이름 없음',amount:100000});
 }
 return {policyId:period.id,count:payouts.length,total:payouts.length*100000,pending,pendingCount:pending.length,payouts};
}
