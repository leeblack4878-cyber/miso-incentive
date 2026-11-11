// Owner-confirmed notice, effective 2026-11-01. September engine stays unchanged.
export const NOVEMBER_MANAGER_POLICY_VERSION='2026-11-v2-1111';
export const NOVEMBER_MANAGER_GOALS=[
 [['삼미시장2호','삼미2'],65,7,83,5,3], [['삼미시장','삼미'],88,9,112.5,7,5],
 [['상록수역','상록'],95,10,122,8,4], [['롯데마트','대야'],55,6,70,5,2],
 [['주민센터','주민'],65,7,83,6,3], [['장곡역','장곡'],55,6,70,5,2],
 [['도일시장','거모'],105,11,135,8,5], [['월곶'],65,7,83,5,3],
 [['성포역','성포'],45,5,58,3,2], [['산본'],140,14,179,10,6],
 [['법조타운','법조','범조'],25,3,32,2,1], [['은계'],40,4,51,3,2], [['본오중학교','본오'],40,4,51,3,2],
].map(([match,hs,home,productivity,tvFree,smartHome])=>({match,hs,home,productivity,tvFree,smartHome}));
export function novemberManagerGoals(store){return NOVEMBER_MANAGER_GOALS.find(r=>r.match.some(s=>String(store).includes(s)))||{};}
const rates={hs:[10000,25000,35000,60000],home:[30000,40000,50000,70000],tvFree:[10000,20000,30000,40000],smartHome:[10000,20000,30000,40000]};
const known=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const n=v=>known(v)?Math.max(0,Number(v)):0;
export function calculateNovemberManagerIncentive({actual={},targets={},managerScore=0,strategicRatio=null,tailoredCount=0,bundledSecondCount=0,hsMnpCount=0,simMnpCount=0,secondCount=0,strategyModelCount=0,storeType='owned',homeRatio=null,subTvSmartRatio=null,levelBelow4=false,noExperienceRate=null,companyNoExperienceRate=null,aixioRate=null,companyAixioRate=null,tailTagCount=0,companyTailTagCount=null,strongNegativeCount=0,complaintCount=0,unkindCount=0,npsScore=null,companyNpsScore=null,auditScore=null,privacyViolation=false,impactRate=null,companyAaScore=null,closing=false,deputy=false}={}){
 const hs=n(actual.hs),sim=n(simMnpCount),second=n(secondCount);
 const recognizedHs=hs+sim+second*.5;
 const tailoredReady=n(tailoredCount)>=(storeType==='consignment'?80:40);
 const metrics=['hs','home','tvFree','smartHome'].map(key=>{
  const count=n(actual[key]),recognized=key==='hs'?recognizedHs:count,target=n(targets[key]);
  const achievement=target>0?recognized/target*100:0;
  const threshold=achievement>=150&&tailoredReady?150:achievement>=120?120:achievement>=100?100:achievement>=90?90:0;
  const rate=threshold?rates[key][[90,100,120,150].indexOf(threshold)]:0;
  const strategicKnown=known(strategicRatio),half=key==='hs'&&strategicKnown&&Number(strategicRatio)<180;
  return {key,actual:count,recognized,target,achievement,threshold,tier:threshold?`${threshold}% 이상`:'지급 전',rate,amount:count*rate*(half?.5:1),homeBonus:0,withheld:false,strategicKnown,halved:half};
 });
 const mnpRatio=hs+sim>0?(n(hsMnpCount)+sim)/(hs+sim)*100:0;
 const bonuses=[
  {key:'excellent',label:'종합 평가 95점 이상',achieved:n(managerScore)>=95,amount:n(managerScore)>=95?300000:0},
  {key:'second',label:'2ND 번들 (개인 판매 제외)',achieved:n(bundledSecondCount)>0,amount:n(bundledSecondCount)*50000},
  {key:'mnp',label:'MNP 비중 20% 이상 · HS+SIM MNP',achieved:mnpRatio>=20,amount:mnpRatio>=20?(n(hsMnpCount)+sim)*30000:0},
  {key:'strategyModel',label:'S26·폴더블8 (개인 판매 제외)',achieved:n(strategyModelCount)>0,amount:n(strategyModelCount)*30000},
 ];
 const deductions=[];const add=(key,label,amount)=>{if(amount>0)deductions.push({key,label,amount});};
 const resolvedHomeRatio=known(homeRatio)?n(homeRatio):hs>0?n(actual.home)/hs*100:0;
 add('homeRatio','홈 비중 미달',resolvedHomeRatio<6?600000:resolvedHomeRatio<8?400000:0);
 if(known(subTvSmartRatio)&&n(subTvSmartRatio)<10)add('subTvSmart','부셋탑+스마트홈 10% 미만',300000);
 if(levelBelow4)add('level','AX 매장 LV4 미만',300000);
 if(known(noExperienceRate)&&n(noExperienceRate)>=40&&!(known(companyNoExperienceRate)&&n(companyNoExperienceRate)<40))add('noExperienceRate','U+ONE 무체험 40% 이상',300000);
 if(known(aixioRate)&&n(aixioRate)<90&&!(known(companyAixioRate)&&n(companyAixioRate)>=90))add('aixio','익시오 활성화 90% 미만',300000);
 const tags=n(tailTagCount);
 if(!(known(companyTailTagCount)&&n(companyTailTagCount)<10))add('tailTag','꼬리표 (면제 제외 인정 건수)',tags*(tags>=4?300000:tags>=2?200000:100000));
 if(!(known(companyNpsScore)&&n(companyNpsScore)>=97)){
  add('strongNegative','강비추',n(strongNegativeCount)*200000);
  if(known(npsScore))add('nps','NPS 97점 미만',Math.min(500000,Math.max(0,97-n(npsScore))*50000));
 }
 add('complaint','대외 민원·가개통',n(complaintCount)*500000);add('unkind','불친절',n(unkindCount)*500000);
 if(known(auditScore))add('audit','오딧 105점 미만',Math.max(0,105-n(auditScore))*30000);
 const performanceTotal=metrics.reduce((s,r)=>s+r.amount,0),bonusTotal=bonuses.reduce((s,r)=>s+r.amount,0),deductionTotal=deductions.reduce((s,r)=>s+r.amount,0);
 const beforeImpact=Math.max(0,performanceTotal+bonusTotal-deductionTotal);
 const finalRate=closing?(known(companyAaScore)&&n(companyAaScore)>=100?1:known(impactRate)?Math.min(1,n(impactRate)):1):1;
 const finalAmount=privacyViolation?0:Math.round(beforeImpact*finalRate*(deputy?.5:1));
 return {metrics,bonuses,deductions,performanceTotal,bonusTotal,deductionTotal,beforeImpact,finalRate,finalAmount,impactApplied:closing&&known(impactRate),privacyViolation,homeRatio:resolvedHomeRatio,mnpRatio,recognizedHs,tailoredReady};
}
