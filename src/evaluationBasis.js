export const EVALUATION_BASIS_LABELS = Object.freeze({employee:'직원입력기준',company:'회사입력기준'});
export const EVALUATION_METRICS = [
  ['HS(SIM 제외)','hs','count'],['HS+SIM','hsWithSim','count'],['홈','home','count'],['생산성','productivity','point'],
  ['MNP(HS+SIM)','mnp','count'],['SIM MNP','simMnp','count'],['TV부셋탑(가정망)','subTvHousehold','count'],
  ['TV프리(가정망)','tvFree','count'],['스마트홈(가정망)','smartHome','count'],['타사 고객 등록','otherCustomer','count'],
  ['맞춤제안 매출액','tailoredAmount','won'],['소노','daemyung','count'],['MNP 타사 가망 개통','prospectMnp','count'],
  ['2ND 번들','second','count'],['맞춤제안 건수','tailoredCount','count'],['전략P','strategicPoints','point'],['115군','plan115','count'],
];
export const koreaToday = (now=new Date()) => new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(now);
export function metricNumber(value){
  if(value===null||value===undefined||(typeof value==='string'&&!value.trim())||typeof value==='boolean')return null;
  const number=Number(value);return Number.isFinite(number)&&number>=0?number:null;
}
export function companyMetric(metrics={},key){
  const value=metricNumber(metrics[key]);
  return value??(key==='plan115'?metricNumber(metrics.plan115Count):null);
}
export function evaluationBasis(snapshot,month,today=koreaToday()){
  const basis=snapshot?.external_inputs?.evaluationBasis;
  if(basis==='employee'||basis==='company')return basis;
  // Keep historical unconfigured views on the pre-existing company preference.
  return month<today.slice(0,7)?'company':'employee';
}
export function evaluationMetric({live={},verified={},basis='employee'},key){
  // This metric has no employee input path; its source remains the company.
  if(key==='prospectMnp')return companyMetric(verified,key);
  return basis==='company'?companyMetric(verified,key):metricNumber(live[key]);
}
export function validCompanyDate(date,month,today=koreaToday()){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||date.slice(0,7)!==month||date>today)return false;
  const parsed=new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===date;
}
export function companyAge(date,today=koreaToday()){
  if(!validCompanyDate(date,date?.slice(0,7),today))return null;
  return Math.floor((Date.parse(`${today}T00:00:00Z`)-Date.parse(`${date}T00:00:00Z`))/86400000);
}
export function companyMetricsForSave(edited={}){
  const result={};
  for(const [key,value] of Object.entries(edited)){
    if(value===''||value==null)continue;
    const number=metricNumber(value);
    if(number===null)throw new Error('회사 실적은 0 이상의 숫자로 입력해주세요.');
    result[key]=number;
  }
  if(Object.hasOwn(edited,'plan115'))delete result.plan115Count;
  return result;
}
function sameJson(left,right){
  if(left===right)return true;
  if(!left||!right||typeof left!=='object'||typeof right!=='object')return false;
  if(Array.isArray(left)!==Array.isArray(right))return false;
  const keys=Object.keys(left);
  return keys.length===Object.keys(right).length&&keys.every(key=>Object.hasOwn(right,key)&&sameJson(left[key],right[key]));
}
export function reportedEvaluation(snapshot){
  const ext=snapshot?.external_inputs||{},report=ext.companyEvaluationReport;
  if(!report||report.asOfDate!==ext.companyAsOfDate)return null;
  // A provided evaluation sheet is evidence for precisely the supplied inputs.
  if(!sameJson(report.verifiedMetrics,snapshot.verified_metrics))return null;
  if(Object.entries(report.externalInputs||{}).some(([key,value])=>!sameJson(ext[key],value)))return null;
  if(metricNumber(report.core100)===null||metricNumber(report.aa100)===null)return null;
  return {...report,core100:Number(report.core100),aa100:Number(report.aa100)};
}
