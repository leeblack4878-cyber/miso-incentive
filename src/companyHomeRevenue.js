import {COMPANY_BASE_FEE,companyPlanFee} from './companyRevenue.js';
import {getMobilePlan} from './mobilePlans.js';
// Owner-confirmed company income only; never used by employee payroll.
export function summarizeCompanyHomeRevenue(orders=[],sales=[],month){
 const out={total:0,equipment:0,premium:0,internet:0,simultaneous:0,subBonus:0,simTopup:0,sohoTv:0,sohoBundle:0,pending:0,reasons:{},rows:[]};
 if(!/^\d{4}-\d{2}$/.test(month||'')||month<'2026-10')return out;
 const pending=reason=>{out.pending++;out.reasons[reason]=(out.reasons[reason]||0)+1;};
 const active=s=>!s.deleted&&!['cancelled','deleted'].includes(s.status)&&!s.source_meta?.deleted&&!s.source_meta?.cancelled;
 const source=new Map(sales.filter(s=>s.source_type==='home_order'&&active(s)).map(s=>[String(s.source_ref),s]));
 const seen=new Set(),groups=new Map();
 for(const o of orders){
  if(!o.id||seen.has(o.id))continue;seen.add(o.id);
  const sale=source.get(String(o.id));if(!sale){if(o.status==='completed'&&o.actual_install_date?.startsWith(`${month}-`))pending('홈 판매 원본 연결 확인 필요');continue;}
  const customer=o.customer_id||sale.customer_id;
  if(!customer||!o.user_id||!o.source_work_date){if(o.status==='completed'&&o.actual_install_date?.startsWith(month))pending('홈 묶음 식별정보 확인 필요');continue;}
  const key=JSON.stringify([o.user_id,customer,o.source_work_date]);
  if(!groups.has(key))groups.set(key,[]);groups.get(key).push({o,sale});
 }
 const claimedSim=new Set();
 for(const [key,items] of groups){
  const done=items.filter(({o})=>o.status==='completed'&&/^\d{4}-\d{2}-\d{2}$/.test(o.actual_install_date||''));
  const inMonth=done.filter(({o})=>o.actual_install_date.startsWith(`${month}-`));
  if(!inMonth.length)continue;
  const row={key,equipment:0,premium:0,internet:0,simultaneous:0,subBonus:0,simTopup:0,sohoTv:0,sohoBundle:0};
  const soho=items[0].o.network_type==='soho';
  if(items.some(({o})=>(o.network_type==='soho')!==soho)){pending('홈 망 구분 확인 필요');continue;}
  for(const {o} of inMonth){
   if(['subSetTop','tvFree'].includes(o.product_type))row.equipment+=33000;
   if(o.product_type==='tvFree')row.premium+=77000;
   if(o.product_type==='internet500')row.internet+=soho?55000:33000;
   if(o.product_type==='internet1g')row.internet+=soho?66000:99000;
   if(o.product_type==='internet100'){if(soho)row.internet+=33000;else pending('인터넷100메가 회사 단가 미설정');}
   if(soho&&o.product_type==='homeTv')row.sohoTv+=44000;
   if(o.product_type==='smartHome')pending('스마트홈 회사 단가 미설정');
  }
  const internet=items.filter(({o})=>['internet100','internet500','internet1g'].includes(o.product_type));
  const tv=items.filter(({o})=>o.product_type==='homeTv');
  const markers=items.filter(({o})=>['simulMnp','simulNewChange','simulUsedMnp'].includes(o.product_type));
  if(soho&&internet.length===1&&tv.length===1&&[...internet,...tv].every(({o})=>o.status==='completed'&&o.actual_install_date)){
   const date=[...internet,...tv].map(({o})=>o.actual_install_date).sort().at(-1);
   if(date.startsWith(`${month}-`)){
    if(internet[0].o.product_type==='internet500')row.sohoBundle=242000;
    else if(internet[0].o.product_type==='internet1g')row.sohoBundle=319000;
    else pending('소호100메가 TV 동시유치 단가 미설정');
   }
  }
  if(internet.length>1||markers.length>1||tv.length>1){pending('홈 동시판매 묶음 중복 확인 필요');}
  else if(internet.length===1&&markers.length===1){
   const required=[...internet,...markers,...tv];
   const expectsTv=!!(internet[0].sale.source_meta?.mainTvPlanLevel||internet[0].sale.source_meta?.mainTvPlan);
   if(expectsTv&&!tv.length)pending('TV 동시판매 구성 확인 필요');
   else if(required.every(({o})=>o.status==='completed'&&o.actual_install_date)){
    const date=required.map(({o})=>o.actual_install_date).sort().at(-1);
    const kind=markers[0].o.product_type;
    if(date.startsWith(`${month}-`)){
     if(soho){
      if(kind==='simulUsedMnp')pending('소호 SIM 동시판매 단가 미설정');
      else row.simultaneous=tv.length?(kind==='simulMnp'?275000:110000):(kind==='simulMnp'?220000:154000);
     }else if(kind==='simulUsedMnp'){
      const first=internet[0];
      const matches=sales.filter(s=>active(s)&&['mobile','daily'].includes(s.source_type)&&s.user_id===first.o.user_id&&s.customer_id===(first.o.customer_id||first.sale.customer_id)&&s.sale_date===first.o.source_work_date&&s.source_meta?.ri===5);
      if(matches.length!==1)pending('SIM MNP 동시판매 모바일 연결 확인 필요');
      else{
       const sim=matches[0],plan=getMobilePlan(sim.source_meta.planDetail);
       if(!plan)pending('SIM MNP 실제 요금제 확인 필요');
       else if(Number(plan.key.split('_')[1])>=61){
        if(claimedSim.has(sim.id))pending('동일 SIM MNP 동시판매 중복 확인 필요');
        else {claimedSim.add(sim.id);row.simTopup=Math.max(0,330000-COMPANY_BASE_FEE-companyPlanFee(sim.source_meta).amount);}
       }
      }
     }else row.simultaneous=tv.length?(kind==='simulMnp'?330000:110000):50000;
    }
    // Sub-TV bonus belongs to the month the bundle and that sub-TV are both complete.
    if(!soho&&tv.length)for(const {o} of done.filter(({o})=>['subSetTop','tvFree'].includes(o.product_type))){
     const bonusDate=[date,o.actual_install_date].sort().at(-1);
     if(bonusDate.startsWith(`${month}-`))row.subBonus+=110000;
    }
   }
  }
  for(const field of ['equipment','premium','internet','simultaneous','subBonus','simTopup','sohoTv','sohoBundle'])out[field]+=row[field];
  row.total=Object.entries(row).filter(([k])=>k!=='key').reduce((n,[,v])=>n+v,0);out.rows.push(row);
 }
 out.total=out.equipment+out.premium+out.internet+out.simultaneous+out.subBonus+out.simTopup+out.sohoTv+out.sohoBundle;return out;
}
