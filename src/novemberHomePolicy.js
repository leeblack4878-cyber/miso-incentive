export const NOVEMBER_HOME_PROMOTION={id:'2026-11-05-home',start:'2026-11-05',end:'2026-11-09',installEnd:'2026-11-30'};
const validDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(String(d))&&!Number.isNaN(Date.parse(`${d}T00:00:00Z`))&&new Date(`${d}T00:00:00Z`).toISOString().slice(0,10)===d;
export function calculateNovemberHomeBonusFromOrders(orders=[]){
 const unique=new Map(),conflicts=new Set(),pending=[],groups=new Map();
 for(const row of orders){if(!row?.id)continue;const old=unique.get(String(row.id));if(old&&JSON.stringify(old)!==JSON.stringify(row))conflicts.add(String(row.id));unique.set(String(row.id),row)}
 for(const row of unique.values()){
  const date=String(row.source_work_date||'').slice(0,10);
  if(!validDate(date)){if(String(row.actual_install_date||'').startsWith('2026-11'))pending.push({id:row.id,reason:'청약일 확인 필요'});continue}
  if(date<NOVEMBER_HOME_PROMOTION.start||date>NOVEMBER_HOME_PROMOTION.end||row.status==='cancelled')continue;
  if(!['internet500','internet1g','homeTv'].includes(row.product_type))continue;
  if(!row.customer_id||conflicts.has(String(row.id))){pending.push({id:row.id,reason:conflicts.has(String(row.id))?'동일 원본 ID 충돌':'고객 원본 연결 확인 필요'});continue}
  const key=JSON.stringify([row.user_id||'scoped-user',row.customer_id,date]);const group=groups.get(key)||[];group.push(row);groups.set(key,group);
 }
 const eligible=[];
 for(const [key,rows] of groups){const internet=rows.filter(r=>['internet500','internet1g'].includes(r.product_type)),tv=rows.filter(r=>r.product_type==='homeTv');
  if(internet.length!==1||tv.length!==1){pending.push({key,reason:'인터넷·메인 TV 묶음 또는 중복회선 확인 필요'});continue}
  const required=[internet[0],tv[0]],date=internet[0].source_work_date.slice(0,10),network=internet[0].network_type;
  if(required.some(r=>r.status!=='completed')){pending.push({key,reason:'설치 완료 대기'});continue}
  if(required.some(r=>!validDate(String(r.actual_install_date||'').slice(0,10)))){pending.push({key,reason:'설치일 확인 필요'});continue}
  if(required.some(r=>String(r.actual_install_date).slice(0,10)<date||String(r.actual_install_date).slice(0,10)>'2026-11-30'))continue;
  if(!['household','soho'].includes(network)){pending.push({key,reason:'망 구분 확인 필요'});continue}
  if((network==='household'&&tv[0].main_tv_plan!=='broadcastPass')||(network==='soho'&&tv[0].main_tv_plan!=='premium'))continue;
  if(internet[0].internet_plan!=='premiumSafe'){pending.push({key,reason:'안심보상 인터넷 요금제 확인 필요'});continue}
  eligible.push({key,userId:internet[0].user_id||'scoped-user',date,customer:internet[0].customer_name||'이름 없음'});
 }
 const counts=new Map();for(const row of eligible)counts.set(row.userId,(counts.get(row.userId)||0)+1);
 const payouts=eligible.map(row=>({...row,amount:counts.get(row.userId)>=2?150000:100000}));
 return {count:eligible.length,rate:counts.size<=1?(eligible.length>=2?150000:eligible.length?100000:0):null,total:payouts.reduce((s,row)=>s+row.amount,0),payouts,pending,pendingCount:pending.length,policyId:NOVEMBER_HOME_PROMOTION.id};
}
