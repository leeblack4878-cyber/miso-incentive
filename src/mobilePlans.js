// Reporting taxonomy only. Never derive or overwrite a commission matrix column.
export const MOBILE_PLAN_TYPES = [{key:'general',label:'일반'},{key:'senior',label:'시니어'},{key:'junior',label:'주니어'}];
const catalog={
  general:[['130','130군'],['115','115군'],['105','105군'],['95','95군'],['85','85군(플랜MAX)'],['75','75군(플랜150GB)'],['70','70군(플랜125GB)'],['61','61군(플랜31GB/50GB/80GB)'],['55','55군(플랜14GB/24GB)'],['47','47군(플랜9GB)'],['37','37군(플랜5GB)'],['33','33군(플랜1.5GB)'],['28','28군(플랜750MB, 300MB)']],
  senior:[['47','47군_시니어(플랜9GB)'],['44','44군_시니어(라이트A)'],['37','37군_시니어(플랜5GB, 라이트B~C)'],['33','33군_시니어(플랜1.5GB)'],['28','28군_시니어(플랜300MB, 750MB)'],['under28','28군 미만_시니어(16.5)']],
  junior:[['85','85군_주니어(플랜MAX 청소년)'],['75','75군_주니어(150GB)'],['70','70군_주니어(125GB)'],['61','61군_주니어(플랜31GB/50GB/80GB)'],['55','55군_주니어(플랜14GB/24GB)'],['47','47군_주니어(플랜9GB)'],['37','37군_주니어(플랜5GB)'],['33','33군_주니어(플랜1.5GB)'],['28','28군_주니어(플랜300MB, 750MB, 키즈29)'],['under28','28군 미만_주니어(키즈22)']],
};
export const MOBILE_PLANS=Object.entries(catalog).flatMap(([type,rows])=>rows.map(([code,label])=>({type,key:`${type}_${code}`,label,version:1})));
export const getMobilePlan=value=>MOBILE_PLANS.find(plan=>plan.key===value?.key&&plan.type===value?.type)||null;
export const mobilePlanLabel=value=>{const plan=getMobilePlan(value);return plan?`${MOBILE_PLAN_TYPES.find(t=>t.key===plan.type).label} · ${plan.label}`:'';};
export function summarizeMobilePlans(sales=[],{userIds=[],branches=null,employeeBranches={},personal=false,kind='all'}={}){
 const allowed=new Set(userIds),seen=new Set(),counts=Object.fromEntries(MOBILE_PLANS.map(p=>[p.key,0]));
 const types={general:0,senior:0,junior:0};let total=0,missing=0;
 for(const sale of sales){
  if(!allowed.has(sale.user_id)||!['mobile','daily'].includes(sale.source_type)||sale.deleted||['cancelled','deleted'].includes(sale.status))continue;
  if(sale.id&&seen.has(sale.id))continue;
  const meta=sale.source_meta||{},ri=meta.ri;
  if(!Number.isInteger(ri)||ri<0||ri>6||meta.secondOnlyBundle)continue;
  if(kind==='hs'&&ri>4||kind==='sim'&&ri!==5)continue;
  if(personal&&meta.teamOnly)continue;
  const branch=meta.teamOnly?meta.creditedStore:employeeBranches[sale.user_id];
  if(branches&&!branches.includes(branch))continue;
  if(sale.id)seen.add(sale.id);total++;
  const plan=getMobilePlan(meta.planDetail);
  if(!plan){missing++;continue;}
  counts[plan.key]++;types[plan.type]++;
 }
 return {total,missing,counts,types};
}
