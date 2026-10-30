import {getMobilePlan} from './mobilePlans.js';
import {specialSalesForDate} from './octoberPolicy.js';
// Company amounts (VAT included), restricted to existing staff product keys.
export const COMPANY_BUNDLE_FEES=Object.freeze({L335:242000,L505:308000,L345:352000,L355:352000,L715:308000,X216:220000,X236:231000,X236NP:297000,AppleWatch:220000,AppleWatch11_12:220000,AppleWatchUltra3_4:220000});
const galaxy=/S(?:942|947|948|931|936|938|937|921|926|928|911|916|918|901|906|908)|F(?:721|936|731|946|741|956|761|766|966|776|971|976)|S2[2-6]|Z플립[4-8]|Z폴드[4-8]/i;
const extraGalaxy=/S(?:942|947|948|931|936|938|937|921|926|928)|F(?:731|946|741|956|761|766|966|776|971|976)|S2[4-6]|Z플립[5-8]|Z폴드[5-8]/i;
export function companyBundleRevenue(sale,sales=[]){
 const meta=sale.source_meta||{},keys=[...new Set(Array.isArray(meta.bundle2ndKeys)?meta.bundle2ndKeys:[])];
 const result={amount:0,pending:0,reasons:[],rows:[]};
 const later=meta.secondOnlyBundle===true&&meta.ri===7;
 const parent=later?(meta.secondParent?.sourceSaleId?sales.find(s=>s.id===meta.secondParent.sourceSaleId):undefined):sale;
 const pm=parent?.source_meta||{},date=parent?.sale_date||meta.secondParent?.date;
 const policy=specialSalesForDate(date||'').find(p=>p.key===pm.specialPolicy?.policyId);
 const manualModel=later?meta.secondParent?.model:'';
 // Owner confirms the staff S-series category means S26; older S models are not sold.
 const model=manualModel==='galaxy_s'?'S26':policy?.deviceModel||policy?.model||'';
 const plan=getMobilePlan(pm.planDetail||meta.secondParent?.planDetail);
 const high=plan?.type==='general'&&Number(plan.key.split('_')[1])>=115;
 for(const key of keys){
  const product=key.replace(/^b_/,'').replace(/_1016$/,'');
  const amount=COMPANY_BUNDLE_FEES[product];
  let reason='';let value=0;
  if(amount===undefined)reason='번들 회사 단가 미설정';
  else if(!date||date<'2026-09-01'||date>sale.sale_date||!/^\d{4}-\d{2}-\d{2}$/.test(date))reason='모단말 개통일 확인 필요';
  else if(parent&&(!Number.isInteger(pm.ri)||pm.ri<0||pm.ri>4||pm.secondOnlyBundle)||parent&&(parent.deleted||['deleted','cancelled'].includes(parent.status)))reason='모단말 HS 대상 확인 필요';
  else if(product.startsWith('AppleWatch')){
   const eligible18=['iphone18_pro','iphone18_pro_max'].includes(manualModel)||/아이폰18.*프로|iphone18.*pro/i.test(model);
   const older=/아이폰1[4-7]|iphone1[4-7]/i.test(model);
   if(!eligible18&&!older)reason='애플 모단말 세부 모델 확인 필요';
   else if(!plan)reason='모단말 실제 요금제 확인 필요';
   else if(high&&(eligible18||date>='2026-10-01'))value=amount;
  }else if(!model)reason='갤럭시 모단말 세부 모델 확인 필요';
  else if(galaxy.test(model)){
   value=amount;
   if(['L335','L505','X216'].includes(product)&&extraGalaxy.test(model)){
    if(!plan)reason='115군 번들 추가금 확인 필요';
    else if(high)value+=44000;
   }
  }
  if(reason){result.pending++;result.reasons.push(reason);}
  result.amount+=value;result.rows.push({key,amount:value,pending:reason||null});
 }
 if(!keys.length&&meta.ri===7){result.pending=1;result.reasons.push('2ND 번들 모델·모단말 확인 필요');}
 return result;
}
