import {calculateNovemberManagerIncentive,novemberManagerGoals,NOVEMBER_MANAGER_POLICY_VERSION} from './novemberManagerPolicy.js';
export const SIMULATION_FIELDS=[
 ['basePay','기본급 (세전·원)'],['hs','HS 개통건'],['simMnpCount','SIM MNP'],['secondCount','전체 2ND'],['home','홈 (소호 포함)'],['tvFree','프리(부)'],['smartHome','스마트홈'],['strategicRatio','전략P 비중 (%)'],['tailoredCount','맞춤제안 업셀'],['managerScore','종합 평가 점수'],['bundledSecondCount','개인판매 제외 2ND 번들'],['hsMnpCount','HS MNP (SIM 제외)'],['strategyModelCount','개인판매 제외 S26·폴더블8'],['subTvHousehold','가정용 부셋탑+TV프리 건수'],['noExperienceRate','매장 U+ONE 무체험률 (%)'],['companyNoExperienceRate','회사 U+ONE 무체험률 (%)'],['aixioRate','매장 익시오 활성화율 (%)'],['companyAixioRate','회사 익시오 활성화율 (%)'],['tailTagCount','인정 꼬리표 환산건수'],['companyTailTagCount','회사 꼬리표 건수'],['strongNegativeCount','강비추 건수'],['complaintCount','대외민원·가개통 건수'],['unkindCount','불친절 건수'],['npsScore','매장 NPS 점수'],['companyNpsScore','회사 NPS 점수'],['auditScore','오딧 점수'],['impactPercent','매장 AA 지급률 (%)'],['companyAaScore','회사 AA 점수']
];
const number=value=>value!==''&&value!=null&&Number.isFinite(Number(value))?Number(value):null;
export function simulateManagerPay(values,store,{deputy=false,storeType='owned'}={}){
 const n=Object.fromEntries(SIMULATION_FIELDS.map(([key])=>[key,number(values[key])]));
 const required=['hs','simMnpCount','secondCount','home','tvFree','smartHome','strategicRatio','tailoredCount','managerScore','bundledSecondCount','hsMnpCount','strategyModelCount','subTvHousehold','noExperienceRate','aixioRate','tailTagCount','strongNegativeCount','complaintCount','unkindCount','npsScore','auditScore'];
 if(n.noExperienceRate>=40)required.push('companyNoExperienceRate');
 if(n.aixioRate!=null&&n.aixioRate<90)required.push('companyAixioRate');
 if(n.tailTagCount>0)required.push('companyTailTagCount');
 if(n.strongNegativeCount>0||(n.npsScore!=null&&n.npsScore<97))required.push('companyNpsScore');
 if(values.closing&&n.companyAaScore!==100)required.push('impactPercent');
 const missing=required.filter(key=>n[key]===null);
 if(!['4','below4'].includes(values.leveling))missing.push('leveling');
 if(!['no','yes'].includes(values.privacy))missing.push('privacy');
 const invalid=Object.entries(n).filter(([key,v])=>v!==null&&((!['npsScore','companyNpsScore'].includes(key)&&v<0)||(!['basePay','strategicRatio','noExperienceRate','companyNoExperienceRate','aixioRate','companyAixioRate','npsScore','companyNpsScore','auditScore','managerScore','impactPercent','companyAaScore'].includes(key)&&!Number.isSafeInteger(v)))).map(([key])=>key);
 if(!novemberManagerGoals(store).hs||missing.length||invalid.length)return {missing,invalid,result:null,total:null};
 const result=calculateNovemberManagerIncentive({...n,actual:{hs:n.hs,home:n.home,tvFree:n.tvFree,smartHome:n.smartHome},targets:novemberManagerGoals(store),homeRatio:n.hs>0?n.home/n.hs*100:null,subTvSmartRatio:n.hs>0?(n.subTvHousehold+n.smartHome)/n.hs*100:null,levelBelow4:values.leveling==='below4',privacyViolation:values.privacy==='yes',impactRate:n.impactPercent==null?null:n.impactPercent/100,closing:!!values.closing,deputy,storeType});
 return {missing,invalid,result,total:n.basePay==null?null:n.basePay+result.finalAmount};
}
export function managerSimulationKey(userId,month,store){return `miso.manager-simulation.v1:${userId}:${month}:${store}`;}
export function managerSimulationSnapshot(input,calculation,store){return {version:NOVEMBER_MANAGER_POLICY_VERSION,targets:{...novemberManagerGoals(store)},input:{...input},calculation,savedAt:new Date().toISOString()};}
