import React from 'react';
import { monthsSince, applyDailyToDraft, DEFAULT_KPI_ITEMS, hsCount, HS_PARTS, matrixRowCount, MATRIX_ROWS, NON_SALES_STORES, monthKeyOf, daysInMonth, monthLabel, fmtCount } from '../appShared';
import { supabase } from '../supabase';
import { useState, useEffect, useRef } from 'react';
import { EVALUATION_BASIS_LABELS, EVALUATION_METRICS, evaluationBasis, evaluationMetric, companyMetricsForSave, validCompanyDate, koreaToday, reportedEvaluation } from '../evaluationBasis';
import { saveEvaluationSnapshot } from '../evaluationSave';
import EvaluationBasisPanel, { evaluationValue } from './EvaluationBasisPanel';
import { showLegacyAlert } from '../feedback';
import { friendlyError } from '../errorMessages';
import { displayStoreName, fmtNum, won } from '../uiDefinitions';
import { completedHomeCount, homePerformanceDate, summarizeVasQuality } from '../policyRules';
import { managerCompanyGoalShare, managerOperatorForStore, calculateSeptemberManagerIncentive, septemberManagerStoreType, SEPTEMBER_MANAGER_POLICY_VERSION } from '../managerPolicyEngine';
import { calculateSalesManagerPayroll, SALES_MANAGER_POLICY_VERSION } from '../salesManagerPolicyEngine';
import { COMPANY_SCOPE_VIEWERS, SALES_MANAGER_AREAS } from '../permissionScopes';
import { emptyDraft, sortStoresByOpenOrder, companyGoalDefaults, COMPANY_STORE_GOAL_BASE, useFinalStorePerformance, finalStoreMetric } from '../viewShared';
const CAREER_PASS_SCORE = 90;
const MANAGER_GRADE = (score) => score >= 100 ? 'S' : score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : 'D';

function quarterInfoFromMonth(month){
  const [y,m]=String(month).split('-').map(Number);
  const q=Math.floor((m-1)/3)+1;
  const start=(q-1)*3+1;
  const months=[0,1,2].map(i=>`${y}-${String(start+i).padStart(2,'0')}`);
  return {year:y,quarter:q,key:`${y}-Q${q}`,label:`${y}년 ${q}분기`,months,from:`${months[0]}-01`,to:(()=>{const d=new Date(y,start+2,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;})()};
}
function previousQuarterKey(q){
  const [yStr,qStr]=String(q).split('-Q');const y=Number(yStr),n=Number(qStr);return n===1?`${y-1}-Q4`:`${y}-Q${n-1}`;
}
function careerTenureBonus(hireDate, quarterEndMonth){
  const months=monthsSince(hireDate,quarterEndMonth);
  if(months<=12)return 0;
  return Math.min(5,Math.floor((months-1)/12));
}
function roundedTarget(v,unit='count'){return unit==='won'?Math.max(0,Number(v||0)):Math.max(0,Math.round(Number(v||0)));}
function cappedAchievement(actual,target,cap=1){if(!(Number(target)>0))return 0;return Math.min(cap,Math.max(0,Number(actual||0)/Number(target||1)));}

const DEFAULT_AA_METRICS=[
  {key:'mnp',label:'MNP (HS MNP + SIM MNP)',weight:8,target:209,unit:'count'},
  {key:'simMnp',label:'SIM MNP',weight:7,target:84,unit:'count'},
  {key:'subTvHousehold',label:'TV부셋탑(가정망)',weight:7,target:77,unit:'count'},
  {key:'tvFree',label:'TV프리(부)',weight:6,target:65,unit:'count'},
  {key:'smartHome',label:'스마트홈',weight:4,target:28,unit:'count'},
  {key:'otherCustomer',label:'타사 고객 등록',weight:4,target:360,unit:'count'},
  {key:'tailoredAmount',label:'맞춤제안 매출액',weight:4,target:4120864,unit:'won'},
];
function normalizeAaWeights(metrics){
  const sum=(metrics||[]).reduce((s,x)=>s+Number(x.weight||0),0)||1;
  return (metrics||[]).map(x=>({...x,normalizedWeight:Number(x.weight||0)/sum*100}));
}
function aaMetricScore(actual,target,normalizedWeight){return cappedAchievement(actual,target,1.1)*Number(normalizedWeight||0);}
function aaAdjustments(input={}){
  const nps=Number(input.npsScore||0);
  const npsAdj=nps?Number(((nps-95)).toFixed(1)):0;
  const unkind=-5*Number(input.unkindCount||0);
  const complaints=-1*Number(input.complaintCount||0);
  const security=Number(input.securityScore||0)>0&&Number(input.securityScore)<90?-5:0;
  const privacy=input.privacyViolation?-10:0;
  const noExp=Number(input.noExperienceRate||0)>0&&Number(input.noExperienceRate)<=40?2:0;
  const leveling=String(input.leveling||'')==='4'?3:(input.leveling?-3:0);
  const internetRatio=Number(input.internetRatio||0);
  const internet=internetRatio>=10?8:internetRatio>=8?3:0;
  const daemyung=input.daemyungAchieved?3:0;
  const prospect=input.prospectMnpAchieved?3:0;
  return {npsAdj,unkind,complaints,security,privacy,noExp,leveling,internet,daemyung,prospect,total:npsAdj+unkind+complaints+security+privacy+noExp+leveling+internet+daemyung+prospect};
}

async function loadQuarterCareerKpi(userId,quarter,config){
  if(!userId)return 0;
  let total=0;
  for(const m of quarter.months){
    const [yy,mm]=m.split('-').map(Number);const next=new Date(yy,mm,1);const to=`${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}-01`;
    const [{data:ms},{data:daily}]=await Promise.all([
      supabase.from('monthly_status').select('data,activity_time_met').eq('user_id',userId).eq('month',m).maybeSingle(),
      supabase.from('daily_records').select('work_date,data').eq('user_id',userId).gte('work_date',`${m}-01`).lt('work_date',to)
    ]);
    const base={...emptyDraft(),...(ms?.data?.draft||{}),activityTimeMet:ms?.activity_time_met??true};
    const map={};(daily||[]).forEach(r=>map[String(r.work_date).slice(8,10)]=r.data);
    const merged=applyDailyToDraft(base,map,m,config?.categoryMap,config?.gibyeonColumnMap);
    const kpi=(config?.kpiItems||DEFAULT_KPI_ITEMS).reduce((s,it)=>s+Number(merged.kpi?.[it.key]||0)*Number(it.point||0),0);
    total+=kpi;
  }
  return total;
}

function CareerEvaluationPanel({ employee, month, config, canManage=false, canFinalApprove=false, managerScopeEmployees=[] }){
  const quarter=quarterInfoFromMonth(month);
  const [selectedId,setSelectedId]=useState(employee?.id||'');
  const selected=(managerScopeEmployees||[]).find(e=>e.id===selectedId)||employee;
  const [kpi,setKpi]=useState(0),[events,setEvents]=useState([]),[loading,setLoading]=useState(true),[note,setNote]=useState('');
  const [eventType,setEventType]=useState('nps_negative'),[eventDate,setEventDate]=useState(new Date().toISOString().slice(0,10)),[count,setCount]=useState(1);
  const [decision,setDecision]=useState(null),[prevDecision,setPrevDecision]=useState(null);
  useEffect(()=>{if(employee?.id&&!canManage)setSelectedId(employee.id)},[employee?.id,canManage]);
  useEffect(()=>{
    if(!selected?.id)return;
    (async()=>{setLoading(true);
      const [k,{data:e},{data:d}]=await Promise.all([
        loadQuarterCareerKpi(selected.id,quarter,config),
        supabase.from('career_eval_penalties').select('*').eq('user_id',selected.id).gte('event_date',quarter.from).lt('event_date',quarter.to).order('event_date',{ascending:false}),
        supabase.from('career_eval_decisions').select('*').eq('user_id',selected.id).in('quarter',[quarter.key,previousQuarterKey(quarter.key)])
      ]);
      const decisions=d||[];
      setKpi(Number(k||0));setEvents(e||[]);setDecision(decisions.find(x=>x.quarter===quarter.key)||null);setPrevDecision(decisions.find(x=>x.quarter===previousQuarterKey(quarter.key))||null);setLoading(false);
    })();
  },[selected?.id,quarter.key,config]);
  const active=events.filter(x=>x.status!=='cancelled');
  const penalty=active.reduce((s,x)=>s+Number(x.count||1),0);
  const tenure=careerTenureBonus(selected?.hireDate,quarter.months[2]);
  const score=Number((kpi+tenure-penalty).toFixed(1));
  const pass=score>=CAREER_PASS_SCORE;
  const streakFail=pass?0:(Number(prevDecision?.result==='FAIL'?prevDecision?.consecutive_fail_count||1:0)+1);
  const addEvent=async()=>{
    if(!selected?.id||!canManage)return;
    const {error}=await supabase.from('career_eval_penalties').insert({user_id:selected.id,event_date:eventDate,event_type:eventType,count:Math.max(1,Number(count||1)),note:note.trim()||null,status:'active'});
    if(error)return showLegacyAlert(`평가 내역 저장 실패: ${friendlyError(error)}`);
    setNote('');setCount(1);const {data}=await supabase.from('career_eval_penalties').select('*').eq('user_id',selected.id).gte('event_date',quarter.from).lt('event_date',quarter.to).order('event_date',{ascending:false});setEvents(data||[]);
  };
  const cancelEvent=async(id)=>{if(!canManage)return;const {error}=await supabase.from('career_eval_penalties').update({status:'cancelled'}).eq('id',id).select('id').single();if(error)return showLegacyAlert(friendlyError(error));setEvents(v=>v.map(x=>x.id===id?{...x,status:'cancelled'}:x));};
  const saveDecision=async(action)=>{
    if(!canManage)return;
    const nextFail=streakFail;
    const payload={quarter:quarter.key,user_id:selected.id,score,result:pass?'PASS':'FAIL',action,consecutive_fail_count:nextFail};
    const {error}=await supabase.rpc('save_career_decision_atomic',{p_payload:payload,p_expected_position:selected.position});if(error)return showLegacyAlert(friendlyError(error));setDecision({...decision,...payload});
  };
  const typeLabel={nps_negative:'NPS 비추천/강한 비추천',label:'꼬리표',home_no_experience:'홈 무체험'};
  return <div className="space-y-3">
    {canManage&&(managerScopeEmployees||[]).length>0&&<select value={selectedId} onChange={e=>setSelectedId(e.target.value)} className="w-full bg-white border rounded-xl px-3 py-2.5 text-sm">{managerScopeEmployees.map(e=><option key={e.id} value={e.id}>{e.name} · {e.position} · {displayStoreName(e.branch)}</option>)}</select>}
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <div className="flex justify-between gap-3"><div><div className="text-xs text-brand-600 font-semibold">{quarter.label} 커리어 등급</div><div className="text-lg font-bold mt-1">{selected?.name||'-'} · {selected?.position||'-'}</div></div><div className={`px-3 py-1.5 rounded-full h-fit text-xs font-bold ${pass?'bg-emerald-50 text-emerald-700':'bg-red-50 text-red-600'}`}>{loading?'계산중':pass?'PASS':'FAIL'}</div></div>
      <div className="mt-4 flex items-end gap-2"><span className="text-3xl font-bold text-gray-900">{score.toFixed(1)}P</span><span className="text-xs text-gray-400 mb-1">통과 90P</span></div>
      <div className="grid grid-cols-4 gap-2 mt-4">{[['3개월 KPI',kpi.toFixed(1)],['근속 가점',`+${tenure}`],['감점',`-${penalty}`],['연속 FAIL',`${streakFail}회`]].map(([l,v])=><div key={l} className="bg-gray-50 rounded-xl p-2.5 text-center"><div className="text-[9px] text-gray-400">{l}</div><div className="text-sm font-bold mt-1">{v}P</div></div>)}</div>
      {selected?.position==='사원'&&pass&&<div className="mt-3 bg-brand-50 text-brand-700 rounded-xl px-3 py-2 text-xs font-semibold">승급 대상 · 면담 후 매니저 승급 승인 필요</div>}
      {selected?.position==='매니저'&&!pass&&streakFail>=2&&<div className="mt-3 bg-red-50 text-red-700 rounded-xl px-3 py-2 text-xs font-semibold">⚠ 2회 연속 FAIL · 사원 전환 검토 대상</div>}
    </div>
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 border-b"><div className="text-sm font-bold">평가 근거</div><div className="text-[10px] text-gray-400">NPS · 꼬리표 · 홈 무체험은 관리자 등록 내역만 반영돼요.</div></div>
      {active.length===0?<div className="py-8 text-center text-xs text-gray-400">등록된 감점 내역이 없어요.</div>:<div className="divide-y">{active.map(x=><div key={x.id} className="px-4 py-3 flex justify-between gap-3"><div><div className="text-xs font-semibold">{x.event_date} · {typeLabel[x.event_type]||x.event_type}</div>{x.note&&<div className="text-[10px] text-gray-400 mt-1">{x.note}</div>}</div><div className="flex gap-2 items-center"><b className="text-sm text-red-500">-{x.count}P</b>{canManage&&<button onClick={()=>cancelEvent(x.id)} className="text-[10px] text-gray-400 underline">취소</button>}</div></div>)}</div>}
    </div>
    {canManage&&<div className="bg-white rounded-2xl border border-gray-100 p-4"><div className="text-sm font-bold">평가 내역 등록</div><div className="grid grid-cols-2 gap-2 mt-3"><select value={eventType} onChange={e=>setEventType(e.target.value)} className="border rounded-xl px-3 py-2 text-xs"><option value="nps_negative">NPS 비추천</option><option value="label">꼬리표</option><option value="home_no_experience">홈 무체험</option></select><input type="date" value={eventDate} onChange={e=>setEventDate(e.target.value)} className="border rounded-xl px-3 py-2 text-xs"/><input type="number" min="1" value={count} onChange={e=>setCount(e.target.value)} className="border rounded-xl px-3 py-2 text-xs"/><input value={note} onChange={e=>setNote(e.target.value)} placeholder="사유/메모" className="border rounded-xl px-3 py-2 text-xs"/></div><button onClick={addEvent} className="w-full mt-2 py-2.5 rounded-xl bg-brand-600 text-white text-xs font-bold">감점 내역 등록</button></div>}
    {canManage&&<div className="bg-white rounded-2xl border border-gray-100 p-4"><div className="text-sm font-bold">평가 처리</div><div className="text-[10px] text-gray-400 mt-1">현장 관리자는 평가 확인까지, 최고 관리자는 면담 후 승급·강등을 최종 승인합니다.</div><div className={`grid gap-2 mt-3 ${canFinalApprove?'grid-cols-2':'grid-cols-1'}`}><button onClick={()=>saveDecision('reviewed')} className="py-2.5 rounded-xl bg-gray-100 text-gray-700 text-xs font-bold">평가 확인</button>{canFinalApprove&&<button onClick={async()=>{const action=pass&&selected?.position==='사원'?'promote_manager':(!pass&&selected?.position==='매니저'&&streakFail>=2?'demote_employee':'no_change');await saveDecision(action);}} className="py-2.5 rounded-xl bg-brand-600 text-white text-xs font-bold">면담 결과 최종 승인</button>}</div></div>}
  </div>;
}

function managerActualFromDraft(d,key){
  if(key==='hs')return hsCount(d);
  if(key==='plan115')return HS_PARTS.reduce((sum,part)=>sum+Number(d.matrix?.[part.idx]?.[0]||0),0);
  const hsMnp=matrixRowCount(d,MATRIX_ROWS.indexOf('일반모델 MNP'));
  const simMnp=(d.matrix?.[5]||[]).reduce((s,v)=>s+Number(v||0),0);
  // AA 임팩트의 MNP 항목은 일반 MNP와 SIM MNP를 합산한다.
  if(key==='mnp')return hsMnp+simMnp;
  if(key==='simMnp')return simMnp;
  if(key==='subTvHousehold')return Number(d.homeAddon?.addSetTop||0)+Number(d.homeFlat?.tvFree||0);
  if(key==='tvFree')return Number(d.homeFlat?.tvFree||0);
  if(key==='smartHome')return Number(d.homeFlat?.smartHome||0);
  if(key==='second')return Object.values(d.bundle2nd||{}).reduce((s,v)=>s+Number(v||0),0);
  if(key==='tailoredCount')return Number(d.tailoredCount||0);
  if(key==='otherCustomer')return Number(d.custRegCount||0);
  if(key==='tailoredAmount')return Number(d.tailoredAmount||0);
  if(key==='daemyung')return Object.values(d.sono||{}).reduce((s,v)=>s+Number(v||0),0);
  if(key==='prospectMnp')return 0;
  if(key==='home')return completedHomeCount(d);
  return 0;
}

function ManagerEvaluationPanel({ month, employees, rows, authUserId, canSwitchStores=false, loginBranch='', payrollOnly=false }){
  const quarter=quarterInfoFromMonth(month);
  const stores=sortStoresByOpenOrder([...new Set((employees||[]).map(e=>e.branch).filter(b=>b&&!NON_SALES_STORES.includes(b)))]);
  const [store,setStore]=useState(canSwitchStores?'':(loginBranch||stores[0]||''));
  const activeStore=store||stores[0]||'';
  const [aaConfig,setAaConfig]=useState(DEFAULT_AA_METRICS),[snap,setSnap]=useState({verified_metrics:{},external_inputs:{}}),[allGoals,setAllGoals]=useState([]),[saving,setSaving]=useState(false);
  const [managerMode,setManagerMode]=useState('dashboard');
  const activeManagerMode=payrollOnly?'incentive':managerMode;
  useEffect(()=>{if(!canSwitchStores&&loginBranch)setStore(loginBranch)},[canSwitchStores,loginBranch]);
  const scopeKey=`${month}|${activeStore}`;
  const scopeRef=useRef(scopeKey);scopeRef.current=scopeKey;
  const saveGuard=useRef(false);
  const [savedSnap,setSavedSnap]=useState(null),[basis,setBasis]=useState('employee');
  const [loadState,setLoadState]=useState({key:'',status:'loading'}),[reload,setReload]=useState(0);
  useEffect(()=>{
    let alive=true;setLoadState({key:scopeKey,status:'loading'});setSavedSnap(null);
    setSnap({verified_metrics:{},external_inputs:{}});setAaConfig(DEFAULT_AA_METRICS);
    if(!activeStore){setLoadState({key:scopeKey,status:'empty'});return;}
    (async()=>{
      try{
        const results=await Promise.all([
          supabase.from('aa_impact_monthly').select('*').eq('month',month).maybeSingle(),
          supabase.from('manager_eval_monthly').select('*').eq('month',month).eq('store_name',activeStore).maybeSingle(),
          supabase.from('store_goals').select('store_name,company_goals').eq('month',month),
        ]);
        if(!alive)return;
        const failed=results.find(result=>result.error);if(failed)throw failed.error;
        const [c,record,g]=results.map(result=>result.data);
        setAaConfig(Array.isArray(c?.metrics)&&c.metrics.length?c.metrics:DEFAULT_AA_METRICS);
        setSavedSnap(record);setSnap(record||{verified_metrics:{},external_inputs:{}});
        setBasis(evaluationBasis(record,month));setAllGoals(g||[]);setLoadState({key:scopeKey,status:'ready'});
      }catch(error){if(alive)setLoadState({key:scopeKey,status:'error',message:friendlyError(error)});}
    })();return()=>{alive=false;};
  },[month,activeStore,reload]);
  const storeRows=(rows||[]).filter(r=>r.branch===activeStore);
  const live={};['hs','plan115','home','mnp','simMnp','subTvHousehold','tvFree','smartHome','second','tailoredCount','otherCustomer','tailoredAmount','daemyung','prospectMnp'].forEach(k=>live[k]=storeRows.reduce((s,r)=>s+managerActualFromDraft(r.draft,k),0));
  live.productivity=storeRows.reduce((s,r)=>s+Number(r.pay?.kpiScore||0),0);
  live.strategicPoints=storeRows.reduce((s,r)=>s+Number(r.pay?.strategicPoints||0),0);
  live.hsWithSim=live.hs+live.simMnp;
  const verified=snap?.verified_metrics||{};
  const actual=(key)=>evaluationMetric({basis,live,verified},key);
  const savedBasis=evaluationBasis(savedSnap,month);
  const companyReport=basis==='company'?reportedEvaluation(snap):null;
  const coreHsKey=snap?.external_inputs?.coreHsIncludesSim?'hsWithSim':'hs';
  const missingCore=[coreHsKey,'home','productivity'].filter(key=>actual(key)===null);
  const missingAa=aaConfig.filter(metric=>actual(metric.key)===null).map(metric=>metric.key);
  const coreReady=!!companyReport||missingCore.length===0;
  const aaReady=!!companyReport||missingAa.length===0;
  const scoreReady=coreReady&&aaReady;
  const payrollReady=['hs','home','tvFree','smartHome','strategicPoints','plan115','second','tailoredCount','subTvHousehold'].every(key=>actual(key)!==null);

  // 관리자 > 회사 목표 > 회사 기준수량을 평가의 단일 기준으로 사용합니다.
  // DB에 해당 월 저장값이 있으면 우선하고, 아직 저장 전인 매장은 회사 기본 기준수량을 보완값으로 사용합니다.
  const goalMap=Object.fromEntries(stores.map(storeName=>{
    const saved=(allGoals||[]).find(g=>g.store_name===storeName);
    return [storeName,{...companyGoalDefaults(storeName),...(saved?.company_goals||{})}];
  }));
  const storeHsTarget=Number(goalMap[activeStore]?.hs||0);
  // 현장 관리자는 권한상 자기 매장 직원만 조회하므로 `stores`에는 한 매장만 들어옵니다.
  // AA 회사 목표 배분의 분모는 조회 범위가 아니라 정책서의 전체 매장 HS 기준수량이어야 합니다.
  const allStoreHsTargets=COMPANY_STORE_GOAL_BASE.map(row=>Number(row.hs||0));
  const totalHsTarget=allStoreHsTargets.reduce((sum,value)=>sum+value,0);
  const share=managerCompanyGoalShare(storeHsTarget,allStoreHsTargets);
  const coreTargets={
    hs:Number(goalMap[activeStore]?.hs||0),
    home:Number(goalMap[activeStore]?.home||0),
    productivity:Number(goalMap[activeStore]?.productivity||0)
  };
  const hasCompanyGoalBasis=storeHsTarget>0&&totalHsTarget>0;
  const coreRaw=cappedAchievement(actual(coreHsKey),coreTargets.hs)*30+cappedAchievement(actual('home'),coreTargets.home)*30+cappedAchievement(actual('productivity'),coreTargets.productivity)*40;
  const core50=(companyReport?.core100??coreRaw)*0.5;
  const normalized=normalizeAaWeights(aaConfig);
  const aaRows=normalized.map(m=>{const reported=companyReport?.aaRows?.[m.key];const target=reported?.target??roundedTarget(Number(m.target||0)*share,m.unit);const a=actual(m.key);const score=reported?.score??aaMetricScore(a,target,m.normalizedWeight);return {...m,storeTarget:target,actual:a,score};});
  const ext=snap?.external_inputs||{};
  const hsActual=actual('hs'),householdHome=actual('home'),internetRatio=hsActual>0?householdHome/hsActual*100:0;
  const daemyungTarget=roundedTarget(35*share,'count'),prospectTarget=roundedTarget(21*share,'count');
  const computedAdj=aaAdjustments({...ext,internetRatio,daemyungAchieved:daemyungTarget>0&&actual('daemyung')>=daemyungTarget,prospectMnpAchieved:prospectTarget>0&&actual('prospectMnp')>=prospectTarget});
  const adj=companyReport?.adjustments?{...computedAdj,...companyReport.adjustments}:computedAdj;
  const aaBase=aaRows.reduce((s,x)=>s+x.score,0),aa100=companyReport?.aa100??Math.max(0,Math.min(100,aaBase+adj.total)),aa50=aa100*0.5,total=core50+aa50,grade=MANAGER_GRADE(total);
  const operator=managerOperatorForStore(activeStore);
  const viewer=(employees||[]).find(e=>e.id===authUserId);
  const canViewManagerIncentive=canSwitchStores||!!(operator?.name&&viewer?.name===operator.name&&viewer?.branch===activeStore);
  const strategicPoints=actual('strategicPoints');
  const strategicRatio=hsActual>0?strategicPoints/hsActual*100:0;
  const plan115Count=actual('plan115'),plan115Ratio=hsActual>0?plan115Count/hsActual*100:0;
  const subTvSmartRatio=hsActual>0?(actual('subTvHousehold')+actual('smartHome'))/hsActual*100:null;
  const managerEstimate=calculateSeptemberManagerIncentive({
    actual:{hs:hsActual,home:actual('home'),tvFree:actual('tvFree'),smartHome:actual('smartHome')},
    targets:{hs:coreTargets.hs,home:coreTargets.home,tvFree:Number(goalMap[activeStore]?.tvFree||0),smartHome:Number(goalMap[activeStore]?.smartHome||0)},
    managerScore:total,strategicRatio,homeRatio:internetRatio,plan115Count,plan115Ratio,
    tailoredCount:actual('tailoredCount'),bundledSecondCount:actual('second'),storeType:septemberManagerStoreType(activeStore),subTvSmartRatio,
    levelBelow4:ext.leveling==='below4',noExperienceRate:ext.noExperienceRate??null,
    complaintCount:Number(ext.complaintCount||0),unkindCount:Number(ext.unkindCount||0),
    npsScore:ext.npsScore??null,privacyViolation:!!ext.privacyViolation,
  });
  const today=koreaToday(),companyDate=ext.companyAsOfDate;
  const forecastDay=basis==='company'&&validCompanyDate(companyDate,month)?Number(companyDate.slice(8,10)):Number(today.slice(8,10));
  const forecastReady=basis!=='company'||validCompanyDate(companyDate,month);
  const managerForecastFactor=today.slice(0,7)===month&&forecastReady?daysInMonth(month)/Math.max(1,forecastDay):1;
  // 실제 급여가 건 단위로 지급되는 항목은 월말 예상도 정수 건으로 환산합니다.
  // 생산성(P)과 매출액은 본래 소수/금액 단위를 사용하므로 그대로 유지합니다.
  const forecastActual=(key,unit)=>{
    const value=Number(actual(key)||0)*managerForecastFactor;
    return unit==='won'||unit==='point'||key==='productivity'||key==='tailoredAmount'?value:Math.round(value);
  };
  const forecastCoreRaw=cappedAchievement(forecastActual(coreHsKey),coreTargets.hs)*30+cappedAchievement(forecastActual('home'),coreTargets.home)*30+cappedAchievement(forecastActual('productivity'),coreTargets.productivity)*40;
  const forecastAaBase=aaRows.reduce((sum,row)=>sum+aaMetricScore(forecastActual(row.key,row.unit),row.storeTarget,row.normalizedWeight),0);
  const forecastAa100=Math.max(0,Math.min(100,forecastAaBase+adj.total));
  const forecastManagerScore=forecastCoreRaw*.5+forecastAa100*.5;
  const forecastHs=forecastActual('hs'),forecastHome=forecastActual('home');
  const forecastStrategicPoints=Number(strategicPoints||0)*managerForecastFactor;
  const forecastPlan115Count=Math.round(Number(plan115Count||0)*managerForecastFactor);
  const forecastSubTvHousehold=forecastActual('subTvHousehold'),forecastSmartHome=forecastActual('smartHome');
  const forecastManagerEstimate=calculateSeptemberManagerIncentive({
    actual:{hs:forecastHs,home:forecastHome,tvFree:forecastActual('tvFree'),smartHome:forecastSmartHome},
    targets:{hs:coreTargets.hs,home:coreTargets.home,tvFree:Number(goalMap[activeStore]?.tvFree||0),smartHome:Number(goalMap[activeStore]?.smartHome||0)},
    managerScore:forecastManagerScore,
    strategicRatio:forecastHs>0?forecastStrategicPoints/forecastHs*100:0,
    homeRatio:forecastHs>0?forecastHome/forecastHs*100:0,
    plan115Count:forecastPlan115Count,plan115Ratio:forecastHs>0?forecastPlan115Count/forecastHs*100:0,
    tailoredCount:forecastActual('tailoredCount'),bundledSecondCount:forecastActual('second'),storeType:septemberManagerStoreType(activeStore),subTvSmartRatio:forecastHs>0?(forecastSubTvHousehold+forecastSmartHome)/forecastHs*100:null,
    levelBelow4:ext.leveling==='below4',noExperienceRate:ext.noExperienceRate??null,
    complaintCount:Number(ext.complaintCount||0),unkindCount:Number(ext.unkindCount||0),
    npsScore:ext.npsScore??null,privacyViolation:!!ext.privacyViolation,
  });
  const setVerified=(key,val)=>setSnap(v=>({...v,verified_metrics:{...(v.verified_metrics||{}),[key]:val}}));
  const setExt=(key,val)=>setSnap(v=>({...v,external_inputs:{...(v.external_inputs||{}),[key]:val}}));
  const persistSnapshot=async(payload,success)=>{
    if(!canSwitchStores||loadState.key!==scopeKey||loadState.status!=='ready'||saveGuard.current)return;
    const saveScope=scopeKey;saveGuard.current=true;setSaving(true);
    try{
      const record=await saveEvaluationSnapshot(supabase,{previous:savedSnap,payload});
      if(scopeRef.current!==saveScope)return;
      setSavedSnap(record);setSnap(record);setBasis(evaluationBasis(record,month));showLegacyAlert(success);
    }catch(error){if(scopeRef.current===saveScope)showLegacyAlert(error.message||friendlyError(error));}
    finally{saveGuard.current=false;setSaving(false);}
  };
  const saveBasis=()=>persistSnapshot({month,store_name:activeStore,
    verified_metrics:savedSnap?.verified_metrics||{},
    external_inputs:{...(savedSnap?.external_inputs||{}),evaluationBasis:basis},
    ...(savedSnap?.verified_at?{verified_at:savedSnap.verified_at}:{}),
    updated_at:new Date().toISOString(),
  },`${EVALUATION_BASIS_LABELS[basis]}으로 적용했어요.`);
  const saveSnapshot=async()=>{
    try{
      const metrics=companyMetricsForSave(snap.verified_metrics);
      if(!validCompanyDate(ext.companyAsOfDate,month))return showLegacyAlert('회사 실적 기준일을 해당 월의 오늘 이전 날짜로 입력해주세요.');
      const external={...ext};
      const cleanSnapshot={...snap,verified_metrics:metrics,external_inputs:external};
      if(!reportedEvaluation(cleanSnapshot))delete external.companyEvaluationReport;
      await persistSnapshot({month,store_name:activeStore,verified_metrics:metrics,external_inputs:external,
        verified_by:authUserId,verified_at:new Date().toISOString(),updated_at:new Date().toISOString()},'회사입력값을 저장했어요.');
    }catch(error){showLegacyAlert(error.message);}
  };
  const saveAa=async()=>{
    if(!canSwitchStores||saveGuard.current)return;
    saveGuard.current=true;setSaving(true);
    try{const {error}=await supabase.from('aa_impact_monthly').upsert({month,metrics:aaConfig,updated_by:authUserId},{onConflict:'month'}).select().single();
      if(error)throw error;showLegacyAlert('AA임팩트 월 목표를 저장했어요.');
    }catch(error){showLegacyAlert(friendlyError(error));}finally{saveGuard.current=false;setSaving(false);}
  };
  const storePicker=canSwitchStores&&<select aria-label="평가 매장" value={activeStore} disabled={saving} onChange={e=>setStore(e.target.value)} className="w-full bg-white border rounded-xl px-3 py-2.5 text-sm">{stores.map(s=><option key={s} value={s}>{displayStoreName(s)}</option>)}</select>;
  if(loadState.key!==scopeKey||loadState.status!=='ready')return <div className="space-y-3">{storePicker}<div className="bg-white border rounded-xl p-4 text-sm" role={loadState.status==='error'?'alert':'status'}>{loadState.status==='error'?<>평가 자료를 불러오지 못했어요. 점수 계산을 보류합니다.<button type="button" onClick={()=>setReload(v=>v+1)} className="block mt-3 text-brand-700 font-bold">다시 불러오기</button></>:loadState.status==='empty'?'평가할 매장이 없어요.':'평가 자료를 확인하고 있어요.'}</div></div>;
  return <div className="space-y-3">
    {!payrollOnly&&<div className={`grid gap-2 ${canSwitchStores?'grid-cols-2':'grid-cols-1'}`}><button onClick={()=>setManagerMode('dashboard')} className={`py-2 rounded-xl text-xs font-bold ${activeManagerMode==='dashboard'?'bg-brand-600 text-white':'bg-white border text-gray-500'}`}>평가 현황</button>{canSwitchStores&&<button onClick={()=>setManagerMode('settings')} className={`py-2 rounded-xl text-xs font-bold ${activeManagerMode==='settings'?'bg-brand-600 text-white':'bg-white border text-gray-500'}`}>목표·실적 최신화</button>}</div>}
    {storePicker}
    {activeManagerMode!=='settings'&&<EvaluationBasisPanel basis={basis} savedBasis={savedBasis} onChange={setBasis} onSave={saveBasis} canSave={canSwitchStores} saving={saving} live={live} verified={verified} asOfDate={ext.companyAsOfDate} verifiedAt={snap.verified_at} report={companyReport} month={month}/>}
    {activeManagerMode==='dashboard'&&!scoreReady&&<p role="status" className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-800">회사 미입력 항목이 있어 종합 점수·등급을 보류합니다. 직원입력기준으로 현재 진행 상황을 확인할 수 있어요.</p>}
    {activeManagerMode==='dashboard'?<>
      <div className="bg-white rounded-2xl border p-4"><div className="flex justify-between gap-3"><div><div className="text-xs text-brand-600 font-semibold">{quarter.label} 관리자 평가 · {monthLabel(month)} 현재 기준</div><div className="text-lg font-bold mt-1">{displayStoreName(activeStore)}</div></div><div className="text-right"><div className="text-3xl font-black text-brand-700">{scoreReady?total.toFixed(1):'—'}</div><div className="text-xs font-bold">{scoreReady?`${grade}등급`:'확인 대기'}</div></div></div><div className="grid grid-cols-2 gap-2 mt-4"><div className="bg-gray-50 rounded-xl p-3"><div className="text-[10px] text-gray-400">핵심성과 50%</div><div className="text-xl font-bold mt-1">{coreReady?core50.toFixed(1):'—'} / 50</div><div className="text-[10px] text-gray-400 mt-1">HS 30% · 홈 30% · 생산성 40%</div></div><div className="bg-gray-50 rounded-xl p-3"><div className="text-[10px] text-gray-400">AA임팩트 50%</div><div className="text-xl font-bold mt-1">{aaReady?aa50.toFixed(1):'—'} / 50</div><div className="text-[10px] text-gray-400 mt-1">AA 원점수 {aaReady?aa100.toFixed(1):'—'}점</div></div></div><div className="mt-3 text-[10px] text-gray-400">{EVALUATION_BASIS_LABELS[basis]} · {basis==='company'?(ext.companyAsOfDate?`${ext.companyAsOfDate}까지 기준`:'실적 기준일 미등록'):'현재 입력 누적'}{companyReport?' · 회사 평가표 점수':''}</div></div>
      <div className="bg-white rounded-2xl border overflow-hidden"><div className="px-4 py-3 border-b"><div className="text-sm font-bold">핵심 성과</div></div>{[[coreHsKey==='hsWithSim'?'HS+SIM':'HS',coreHsKey,30],['홈','home',30],['생산성','productivity',40]].map(([l,k,w])=>{const t=coreTargets[k==='hsWithSim'?'hs':k],a=actual(k),pct=cappedAchievement(a,t)*100;return <div key={k} className="px-4 py-3 border-b last:border-0"><div className="flex justify-between text-xs"><b>{l}</b><span>{a===null?'미입력':fmtNum(a,1)} / {fmtNum(t,1)} · {a===null?'—':`${pct.toFixed(0)}%`}</span></div><div className="h-1.5 bg-gray-100 rounded-full mt-2"><div className="h-full bg-brand-500 rounded-full" style={{width:`${pct}%`}}/></div><div className="text-[9px] text-gray-400 mt-1">반영비중 {w}% · 100% 초과 미반영</div></div>})}</div>
      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="px-4 py-3 border-b">
          <div className="text-sm font-bold">AA임팩트</div>
          {hasCompanyGoalBasis
            ? <div className="text-[10px] text-gray-400">회사 목표를 관리자 → 회사 목표의 HS 기준수량 비중({(share*100).toFixed(1)}%)으로 자동 배분 · 건수는 반올림</div>
            : <div className="text-[10px] text-red-500 font-semibold">⚠ 회사 목표의 HS 기준수량을 확인할 수 없어 AA임팩트 목표를 배분할 수 없습니다.</div>}
        </div>
        {aaRows.map(x=><div key={x.key} className="px-4 py-3 border-b flex justify-between gap-3"><div><div className="text-xs font-semibold">{x.label}</div><div className="text-[10px] text-gray-400 mt-1">목표 {x.unit==='won'?won(x.storeTarget):`${x.storeTarget}건`} · 실적 {evaluationValue(x.actual,x.unit)}</div></div><div className="text-right"><b className="text-sm text-brand-700">{x.actual===null?'—':`${x.score.toFixed(1)}점`}</b><div className="text-[9px] text-gray-400">환산비중 {x.normalizedWeight.toFixed(1)}%</div></div></div>)}
        <div className="px-4 py-3 bg-gray-50 border-t">
          <div className="flex justify-between items-center mb-2"><span className="text-xs font-bold">AA임팩트 가감점</span><b className={`text-xs ${adj.total>=0?'text-emerald-600':'text-red-500'}`}>{adj.total>=0?'+':''}{adj.total.toFixed(1)}점</b></div>
          <div className="space-y-1.5">
            {[
              ['NPS', ext.npsScore?`${fmtNum(Number(ext.npsScore),1)}점 · 95점 기준`:'미입력', adj.npsAdj],
              ['불친절', `${fmtCount(Number(ext.unkindCount||0))}건`, adj.unkind],
              ['대외민원', `${fmtCount(Number(ext.complaintCount||0))}건`, adj.complaints],
              ['정보보호', ext.securityScore?`${fmtNum(Number(ext.securityScore),1)}점`:'미입력', adj.security],
              ['개인정보보호위원회', ext.privacyViolation?'적발':'해당 없음', adj.privacy],
              ['U+one 무체험', ext.noExperienceRate!==undefined&&ext.noExperienceRate!==''?`${fmtNum(Number(ext.noExperienceRate),1)}%`:'미입력', adj.noExp],
              ['매장 레벨링', ext.leveling==='4'?'Lv4':ext.leveling?'Lv4 미만':'미입력', adj.leveling],
              ['인터넷 비중', `${internetRatio.toFixed(1)}% · 홈 ${fmtCount(householdHome)} / HS ${fmtCount(hsActual)}`, adj.internet],
              ['소노', `목표 ${daemyungTarget}건 / 실적 ${fmtCount(actual('daemyung'))}건`, adj.daemyung],
              ['MNP 타사 가망', `목표 ${prospectTarget}건 / 실적 ${fmtCount(actual('prospectMnp'))}건`, adj.prospect],
            ].map(([label,basis,point])=><div key={label} className="flex items-center justify-between gap-3 text-[10px]"><div className="min-w-0"><span className="font-semibold text-gray-600">{label}</span><span className="text-gray-400 ml-1.5">{basis}</span></div><b className={Number(point)>0?'text-emerald-600':Number(point)<0?'text-red-500':'text-gray-400'}>{Number(point)>0?'+':''}{Number(point).toFixed(1)}점</b></div>)}
          </div>
        </div>
      </div>
    </>:activeManagerMode==='incentive'&&canViewManagerIncentive?<>
      {!payrollReady||!forecastReady||!scoreReady?<div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-800">선택한 기준의 실적·기준일이 부족해 관리자 예상액을 보류합니다. 직원입력기준을 선택하거나 회사입력값을 확인해주세요.</div>:month!=='2026-09'?<div className="bg-white rounded-2xl border p-5 text-center"><div className="text-sm font-bold text-gray-700">9월 관리자 정책이에요</div><div className="text-xs text-gray-400 mt-1">상단에서 2026년 9월을 선택하면 정책과 예상액을 확인할 수 있어요.</div></div>:
       !operator?.name?<div className="bg-white rounded-2xl border p-5 text-center"><div className="text-sm font-bold text-gray-700">지정된 운영 관리자가 없어요</div><div className="text-xs text-gray-400 mt-1">{displayStoreName(activeStore)}은 9월 관리자 인센티브 지급 대상자가 없습니다.</div></div>:<>
        <div className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700 text-white p-4 shadow-sm">
          <div><div className="text-[10px] text-brand-100">{SEPTEMBER_MANAGER_POLICY_VERSION} · 월중 예상</div><div className="text-lg font-black mt-1">{operator.name} {operator.position}</div><div className="text-xs text-brand-100 mt-0.5">{displayStoreName(activeStore)} 운영 관리자</div></div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mt-4 rounded-xl bg-white/10 px-3 py-3"><div><div className="text-[10px] text-brand-100">현재 기준액</div><div className="text-xl font-black mt-1">{won(managerEstimate.finalAmount)}</div></div><div className="text-brand-200 text-xl">→</div><div className="text-right"><div className="text-[10px] text-brand-100">월말 예상액</div><div className="text-xl font-black mt-1">{won(forecastManagerEstimate.finalAmount)}</div></div></div>
          <div className="mt-2 text-[10px] text-brand-100 text-right">현재 {Math.round(managerForecastFactor===1?100:100/managerForecastFactor)}% 경과 기준 예상</div>
          <div className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-[10px] leading-relaxed">임팩트 평가 지급률은 월중 금액에 적용하지 않고 월 마감 시 최종 반영해요.</div>
        </div>
        <div className="grid grid-cols-2 gap-2"><div className="bg-white rounded-xl border p-3"><div className="text-[10px] text-gray-400">전략P 비중 · 자동</div><div className="text-base font-black text-brand-700 mt-1">{fmtNum(strategicRatio,1)}%</div><div className="text-[10px] text-gray-400 mt-1">전략P {fmtNum(strategicPoints,1)}P ÷ HS {fmtCount(hsActual)}건</div></div><div className="bg-white rounded-xl border p-3"><div className="text-[10px] text-gray-400">115군 비중 · 자동</div><div className="text-base font-black text-brand-700 mt-1">{fmtNum(plan115Ratio,1)}%</div><div className="text-[10px] text-gray-400 mt-1">115군 {fmtCount(plan115Count)}건 ÷ HS {fmtCount(hsActual)}건</div></div></div>
        <div className="bg-white rounded-2xl border overflow-hidden"><div className="px-4 py-3 border-b"><div className="text-sm font-bold">성과 인센티브</div><div className="text-[10px] text-gray-400 mt-0.5">달성 구간의 건당 금액 × 실제 완료 건수 · 보라색은 월말 예상</div></div>{managerEstimate.metrics.map((m,index)=>{const forecast=forecastManagerEstimate.metrics[index];return <div key={m.key} className="px-4 py-3 border-b last:border-0"><div className="flex justify-between gap-3"><div><div className="text-xs font-bold">{{hs:'HS',home:'홈(소호 포함)',tvFree:'TV프리(부)',smartHome:'스마트홈'}[m.key]}</div><div className="text-[10px] text-gray-400 mt-1">현재 {fmtNum(m.actual,1)} / {fmtNum(m.target,1)}건 · {m.achievement.toFixed(0)}% · {m.tier}</div><div className="text-[10px] font-semibold text-brand-600 mt-1">예상 {fmtNum(forecast.actual,1)}건 · {forecast.achievement.toFixed(0)}% · {forecast.tier}</div></div><div className="text-right"><div className="text-sm font-black text-gray-800">{won(m.amount)}</div><div className="text-[10px] font-bold text-brand-700 mt-1">예상 {won(forecast.amount)}</div><div className="text-[9px] text-gray-400">{forecast.rate?`예상 건당 ${won(forecast.rate)}`:'예상도 지급 전'}</div></div></div>{m.key==='hs'&&<div className={`mt-2 rounded-lg px-2.5 py-2 text-[10px] ${m.withheld?'bg-red-50 text-red-600':'bg-gray-50 text-gray-500'}`}>{m.homeBonus>0?`가정망 홈 12% 이상 · HS +20% ${won(m.homeBonus)}`:'가정망 홈 12% 추가 조건 미달'} · {m.strategicKnown?(m.withheld?'전략P 160% 미만으로 HS 미지급':`전략P ${fmtNum(Number(strategicRatio),1)}%`):'전략P 비중 확인 전'}</div>}</div>})}</div>
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border overflow-hidden"><div className="px-4 py-3 border-b flex items-center justify-between gap-3"><div><div className="text-xs text-gray-400">추가 정책</div><div className="text-lg font-black text-gray-800 mt-0.5">현재 +{won(managerEstimate.bonusTotal)}</div></div><div className="text-right shrink-0"><div className="text-[10px] text-brand-500">월말 예상</div><div className="text-base font-black text-brand-700">+{won(forecastManagerEstimate.bonusTotal)}</div></div></div><div className="divide-y divide-gray-100">{managerEstimate.bonuses.map((x,index)=>{const forecast=forecastManagerEstimate.bonuses[index];return <div key={x.key} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-4 py-3 text-xs"><span className={x.achieved?'font-semibold text-gray-700':'text-gray-500'}>{x.label}</span><b className={`whitespace-nowrap ${x.amount?'text-gray-700':'text-gray-300'}`}>{x.amount?`+${won(x.amount)}`:'현재 —'}</b><b className={`min-w-[88px] text-right whitespace-nowrap ${forecast?.amount?'text-brand-700':'text-gray-300'}`}>{forecast?.amount?`예상 +${won(forecast.amount)}`:'예상 —'}</b></div>})}</div></div>
          <div className="bg-white rounded-2xl border overflow-hidden"><div className="px-4 py-3 border-b flex items-center justify-between gap-3"><div className="text-xs text-gray-400">현재 확인된 차감</div><div className="text-lg font-black text-red-500 whitespace-nowrap">-{won(managerEstimate.deductionTotal)}</div></div><div className="divide-y divide-gray-100">{managerEstimate.deductions.length?managerEstimate.deductions.map(x=><div key={x.key} className="flex items-center justify-between gap-3 px-4 py-3 text-xs"><span className="text-gray-600">{x.label}</span><b className="text-red-500 whitespace-nowrap">-{won(x.amount)}</b></div>):<div className="px-4 py-4 text-xs text-gray-300">현재 확인된 차감 없음</div>}</div></div>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-[10px] text-amber-700 leading-relaxed">현재 입력·확인된 실적 기준 예상액이에요. 전략P·115군과 월말 임팩트 값이 확정되면 금액이 달라질 수 있습니다. · 2ND 기준 {septemberManagerStoreType(activeStore)==='consignment'?'위탁 20건':'자가 10건'}</div>
      </>}
    </>:<>
      <section className="bg-white rounded-2xl border p-4 space-y-3" aria-label="회사입력값 편집">
        <h3 className="text-sm font-bold">회사입력값 관리</h3>
        <p className="text-xs text-gray-500">입력한 회사값만 저장합니다. 빈칸은 미입력, 0은 확인된 0건입니다. 직원 입력값을 회사값으로 자동 복사하지 않아요.</p>
        <label className="block text-xs text-gray-600">회사 실적 기준일<input aria-label="회사 실적 기준일" type="date" min={`${month}-01`} max={month===koreaToday().slice(0,7)?koreaToday():`${month}-${String(daysInMonth(month)).padStart(2,'0')}`} value={ext.companyAsOfDate||''} onChange={e=>setExt('companyAsOfDate',e.target.value)} className="block mt-1 w-full min-w-0 border rounded-lg p-2"/></label>
        <div className="space-y-3">{EVALUATION_METRICS.map(([label,key,unit])=><label key={key} className="block text-xs text-gray-600"><span className="font-semibold">{label}</span><span className="ml-2 text-[10px] text-gray-400">직원 {key==='prospectMnp'?'회사 확인 항목':evaluationValue(live[key],unit)}</span><input aria-label={`회사 ${label}`} type="number" min="0" step={unit==='point'?'0.1':'1'} value={verified[key]??(key==='plan115'?verified.plan115Count:'')??''} placeholder="미입력" onChange={e=>setVerified(key,e.target.value)} className="block w-full min-w-0 mt-1 border rounded-lg px-3 py-2 text-sm text-right"/></label>)}</div>
        {ext.companyEvaluationReport&&<p className="text-xs text-amber-700">회사 실적이나 외부 평가값을 수정하면 제공된 평가표 점수는 해제되고 앱 계산식으로 다시 계산합니다.</p>}
        <button type="button" onClick={saveSnapshot} disabled={saving} className="w-full py-3 rounded-xl bg-brand-600 text-white text-sm font-bold disabled:opacity-50">{saving?'저장 중':'회사입력값 저장'}</button>
      </section>
      <div className="bg-white rounded-2xl border p-4"><div className="text-sm font-bold">AA임팩트 외부 평가값</div><div className="grid grid-cols-2 gap-2 mt-3">{[['NPS 점수','npsScore'],['불친절 건수','unkindCount'],['대외민원 건수','complaintCount'],['정보보호 점수','securityScore'],['U+one 무체험률(%)','noExperienceRate']].map(([l,k])=><label key={k} className="min-w-0 text-[10px] text-gray-500">{l}<input type="number" value={ext[k]??''} onChange={e=>setExt(k,e.target.value)} className="w-full min-w-0 mt-1 border rounded-lg px-2 py-2 text-xs"/></label>)}<label className="text-[10px] text-gray-500">매장 레벨링<select value={ext.leveling||''} onChange={e=>setExt('leveling',e.target.value)} className="w-full min-w-0 mt-1 border rounded-lg px-2 py-2 text-xs"><option value="">미입력</option><option value="4">Lv4</option><option value="below4">Lv4 미만</option></select></label><label className="text-[10px] text-gray-500 flex items-center gap-2 mt-4"><input type="checkbox" checked={!!ext.privacyViolation} onChange={e=>setExt('privacyViolation',e.target.checked)}/> 개인정보보호위원회 적발</label><div className="col-span-2 text-[10px] text-gray-400 bg-gray-50 rounded-lg p-2">소노 목표 {daemyungTarget}건 · MNP 타사 가망 목표 {prospectTarget}건은 회사 목표(35건/21건)를 HS 기준수량 비중으로 자동 배분해 달성 여부를 판단합니다.</div></div></div>
      <div className="bg-white rounded-2xl border p-4"><div className="flex justify-between"><div><div className="text-sm font-bold">{monthLabel(month)} AA임팩트 회사 목표</div><div className="text-[10px] text-gray-400">회사 목표 입력 후 관리자 → 회사 목표의 매장별 HS 기준수량 비중으로 자동 배분합니다. 반영비중 합계는 100점으로 환산하고 항목별 110%까지 인정합니다.</div></div><button onClick={saveAa} className="shrink-0 px-3 py-2 rounded-xl bg-gray-900 text-white text-xs font-bold h-fit">목표 저장</button></div><div className="space-y-2 mt-3">{aaConfig.map((x,i)=><div key={x.key} className="grid grid-cols-2 gap-2 items-center rounded-xl bg-gray-50 p-2"><input value={x.label} onChange={e=>setAaConfig(v=>v.map((a,j)=>j===i?{...a,label:e.target.value}:a))} className="col-span-2 w-full min-w-0 border rounded-lg px-2 py-1.5 text-xs"/><input type="number" value={x.weight} onChange={e=>setAaConfig(v=>v.map((a,j)=>j===i?{...a,weight:Number(e.target.value||0)}:a))} className="w-full min-w-0 border rounded-lg px-2 py-1.5 text-xs text-right"/><input type="number" value={x.target} onChange={e=>setAaConfig(v=>v.map((a,j)=>j===i?{...a,target:Number(e.target.value||0)}:a))} className="w-full min-w-0 border rounded-lg px-2 py-1.5 text-xs text-right"/></div>)}</div></div>
    </>}
  </div>;
}

function SalesManagerPayrollPanel({month,rows=[]}){
  const finalPerformances=useFinalStorePerformance(month);
  const branches=[...new Set(rows.map(row=>row.branch).filter(branch=>branch&&!NON_SALES_STORES.includes(branch)))];
  const branchValue=(branch,key,input)=>finalStoreMetric(finalPerformances?.[branch],key,input);
  const sumByBranch=(key,readInput)=>branches.reduce((total,branch)=>{
    const members=rows.filter(row=>row.branch===branch);
    return total+Number(branchValue(branch,key,members.reduce((sum,row)=>sum+Number(readInput(row)||0),0))||0);
  },0);
  const company={
    hs:sumByBranch('hs',row=>hsCount(row.draft||{})),
    simMnp:sumByBranch('simMnp',row=>(row.draft?.matrix?.[5]||[]).reduce((sum,value)=>sum+Number(value||0),0)),
    second:sumByBranch('second',row=>(row.draft?.matrix?.[7]||[]).reduce((sum,value)=>sum+Number(value||0),0)+Object.values(row.draft?.bundle2nd||{}).reduce((sum,value)=>sum+Number(value||0),0)),
    home:sumByBranch('home',row=>completedHomeCount(row.draft)),
    upsell:sumByBranch('upsell',row=>Number(row.draft?.tailoredCount||0)),
  };
  const result=calculateSalesManagerPayroll(company);
  const forecastFactor=monthKeyOf(new Date())===month?daysInMonth(month)/Math.max(1,new Date().getDate()):1;
  // 회사 정책의 기준 총량은 2ND만 0.2로 환산하고, 지급 대상 HS·홈·업셀은 정수 건으로 계산합니다.
  const forecastCompany=Object.fromEntries(Object.entries(company).map(([key,value])=>[key,Math.round(Number(value||0)*forecastFactor)]));
  const forecastResult=calculateSalesManagerPayroll(forecastCompany);
  const activePolicy=month>='2026-09';
  if(!activePolicy)return <div className="bg-white rounded-2xl border p-5 text-center"><div className="text-sm font-bold text-gray-700">영업담당 정책은 2026년 9월부터 적용돼요</div><div className="text-xs text-gray-400 mt-1">상단에서 2026년 9월 이후를 선택해 주세요.</div></div>;
  return <div className="space-y-3">
    <div className="rounded-2xl bg-gradient-to-br from-slate-800 to-brand-800 text-white p-4 shadow-sm">
      <div><div className="text-[11px] text-brand-100">{SALES_MANAGER_POLICY_VERSION} 정책 · 월중 예상</div><div className="text-lg font-black mt-1">영업담당 급여</div><div className="text-xs text-brand-100 mt-1">김진백 · 임성준 동일한 회사 전체 실적 적용</div></div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mt-4 rounded-xl bg-white/10 px-3 py-3"><div><div className="text-[11px] text-brand-100">현재 기준액</div><div className="text-xl font-black mt-1">{won(result.finalPay)}</div></div><div className="text-brand-200 text-xl">→</div><div className="text-right"><div className="text-[11px] text-brand-100">월말 예상액</div><div className="text-xl font-black mt-1">{won(forecastResult.finalPay)}</div></div></div>
      <div className="mt-2 text-[11px] text-brand-100 text-right">현재 {Math.round(forecastFactor===1?100:100/forecastFactor)}% 경과 기준 예상</div>
      {result.guaranteeAdjustment>0&&<div className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-xs">현재 최저 600만원 보장 차액 +{won(result.guaranteeAdjustment)} 반영</div>}
    </div>
    <div className="grid grid-cols-2 gap-2">
      {[['기본급',2500000,2500000],['직책수당',800000,800000],['HS 인센티브',result.hsIncentive,forecastResult.hsIncentive],['홈 인센티브',result.homeIncentive,forecastResult.homeIncentive],['맞춤제안 업셀',result.upsellIncentive,forecastResult.upsellIncentive],['보장 차액',result.guaranteeAdjustment,forecastResult.guaranteeAdjustment]].map(([label,value,forecast])=><div key={label} className="bg-white rounded-xl border p-3"><div className="text-[11px] text-gray-400">{label}</div><div className="text-base font-black text-gray-800 mt-1">{won(value)}</div>{Number(value)!==Number(forecast)&&<div className="text-[11px] font-bold text-brand-600 mt-1">예상 {won(forecast)}</div>}</div>)}
    </div>
    <div className="bg-white rounded-2xl border overflow-hidden">
      <div className="px-4 py-3 border-b"><div className="text-sm font-bold">회사 전체 적용 근거</div><div className="text-[11px] text-gray-400 mt-1">두 영업담당 모두 같은 회사 전체 실적과 구간 단가를 적용합니다.</div></div>
      <div className="divide-y">
        <div className="px-4 py-3 flex justify-between gap-3"><div><b className="text-sm">모바일 총량 {fmtNum(result.mobileVolume,1)}건</b><div className="text-[11px] text-gray-400 mt-1">HS {fmtCount(company.hs)} + SIM MNP {fmtCount(company.simMnp)} + 2ND {fmtNum(company.second,1)}×0.2</div><div className="text-[11px] font-semibold text-brand-600 mt-1">월말 예상 {fmtNum(forecastResult.mobileVolume,1)}건</div></div><div className="text-right"><b className="text-brand-700">HS 건당 {won(result.mobileTier.rate)}</b><div className="text-[11px] font-semibold text-brand-600 mt-1">예상 건당 {won(forecastResult.mobileTier.rate)}</div><div className="text-[10px] text-gray-400 mt-1">예상 HS {fmtCount(forecastCompany.hs)}건 적용</div></div></div>
        <div className="px-4 py-3 flex justify-between gap-3"><div><b className="text-sm">설치 완료 홈 {fmtCount(company.home)}건</b><div className="text-[11px] text-gray-400 mt-1">가정망·소호 모두 포함</div><div className="text-[11px] font-semibold text-brand-600 mt-1">월말 예상 {fmtNum(forecastCompany.home,1)}건</div></div><div className="text-right"><b className="text-brand-700">홈 건당 {won(result.homeTier.rate)}</b><div className="text-[11px] font-semibold text-brand-600 mt-1">예상 건당 {won(forecastResult.homeTier.rate)}</div><div className="text-[10px] text-gray-400 mt-1">예상 홈 전체 적용</div></div></div>
        <div className="px-4 py-3 flex justify-between gap-3"><div><b className="text-sm">맞춤제안 업셀 {fmtCount(company.upsell)}건</b><div className="text-[11px] text-gray-400 mt-1">회사 전체 500건 이상부터 전 건 적용</div><div className="text-[11px] font-semibold text-brand-600 mt-1">월말 예상 {fmtNum(forecastCompany.upsell,1)}건</div></div><div className="text-right"><b className="text-brand-700">건당 {won(result.upsellRate)}</b><div className="text-[11px] font-semibold text-brand-600 mt-1">예상 건당 {won(forecastResult.upsellRate)}</div><div className="text-[10px] text-gray-400 mt-1">{forecastResult.upsellRate?'예상 지급 구간':'예상도 지급 전'}</div></div></div>
      </div>
    </div>
    <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-800 leading-relaxed"><b>분기별 별도 정산</b><br/>담당 매장 HS·홈 합산 달성률 평균 우수 100만원, AA임팩트 평균 우수 50만원은 분기 평가 후 별도로 정산되며 현재 월 급여 예상액에는 포함되지 않습니다.</div>
  </div>;
}

function ManagerPayrollPanel({month,employees=[],rows=[],authUserId,canSwitchStores=false,loginBranch=''}){
  const viewer=employees.find(employee=>employee.id===authUserId);
  const canViewSales=COMPANY_SCOPE_VIEWERS.has(viewer?.id)||!!SALES_MANAGER_AREAS[viewer?.id];
  const [mode,setMode]=useState('store');
  return <div className="space-y-3">
    <div><div className="text-xs text-brand-600 font-semibold">관리자 급여</div><div className="text-xl font-bold text-gray-900">월 급여 예상</div><div className="text-xs text-gray-400 mt-1">현재 입력·완료 실적 기준이며 월 마감 시 최종 금액이 달라질 수 있어요.</div></div>
    {canViewSales&&<div className="grid grid-cols-2 bg-gray-100 rounded-xl p-1 gap-1"><button onClick={()=>setMode('store')} className={`py-2.5 rounded-lg text-xs font-bold ${mode==='store'?'bg-white text-brand-700 shadow-sm':'text-gray-500'}`}>매장 운영 관리자</button><button onClick={()=>setMode('sales')} className={`py-2.5 rounded-lg text-xs font-bold ${mode==='sales'?'bg-white text-brand-700 shadow-sm':'text-gray-500'}`}>영업담당</button></div>}
    {mode==='sales'&&canViewSales?<SalesManagerPayrollPanel month={month} rows={rows}/>:<ManagerEvaluationPanel month={month} employees={employees} rows={rows} authUserId={authUserId} canSwitchStores={canSwitchStores} loginBranch={loginBranch} payrollOnly/>}
  </div>;
}


function qualityPct(n,d){return d>0?Number((Number(n||0)/d*100).toFixed(1)):0}

function qualityFromSales(sales=[], homeOrders=[], sonoCount=0){
  const mobile=(sales||[]).filter(x=>x.source_type==='mobile');
  const hs=mobile.filter(x=>HS_PARTS.some(p=>p.idx===Number(x.source_meta?.ri))).length;
  const plan115=mobile.filter(x=>HS_PARTS.some(p=>p.idx===Number(x.source_meta?.ri))&&Number(x.source_meta?.ci)===0).length;
  const mnpRi=MATRIX_ROWS.indexOf('일반모델 MNP');
  const mnp=mobile.filter(x=>Number(x.source_meta?.ri)===mnpRi).length;
  const second=mobile.reduce((sum,x)=>sum+(x.source_meta?.bundle2ndKeys||[]).length,0);
  const strategicPlan=mobile.filter(x=>!!x.source_meta?.strategicPlan).length;

  // 홈은 동일 고객/날짜의 인터넷을 1건으로 계산. 올인원 포함.
  const internetKeys=new Set();
  let free=0,smart=0;
  (homeOrders||[]).forEach(o=>{
    const d=homePerformanceDate(o);
    const ck=o.customer_id||o.customer_name||o.id;
    if(['internet1g','internet500','internet100','homeOnly','homeTv'].includes(o.product_type))internetKeys.add(`${d}|${ck}`);
    if(o.product_type==='tvFree')free++;
    if(o.product_type==='smartHome')smart++;
  });

  const {insurance,strategicVas,daemyungCount,strategicPointsWithoutDaemyung}=summarizeVasQuality(mobile);
  const revenuePoints=Number(strategicPointsWithoutDaemyung||0)+Math.max(Number(daemyungCount||0),Number(sonoCount||0))*2;
  return {hs,plan115,home:internetKeys.size,freeSmart:free+smart,mnp,second,strategicPlan,insurance,strategicVas,sono:Number(sonoCount||0),revenuePoints,
    plan115Pct:qualityPct(plan115,hs),homePct:qualityPct(internetKeys.size,hs),freeSmartPct:qualityPct(free+smart,hs),mnpPct:qualityPct(mnp,hs),secondPct:qualityPct(second,hs),revenuePct:qualityPct(revenuePoints,hs)};
}

function QualityMetricCard({label,value,sub=''}){return <div className="bg-white border border-gray-100 rounded-xl p-3"><div className="text-[10px] text-gray-400">{label}</div><div className="text-xl font-black text-gray-900 mt-1">{value}</div>{sub&&<div className="text-[9px] text-gray-400 mt-1">{sub}</div>}</div>}

function SalesQualityPanel({month,employee=null,employees=[],isManager=false,loginBranch='',canSwitchStores=false}){
  const [loading,setLoading]=useState(true),[data,setData]=useState({}),[storeFilter,setStoreFilter]=useState(loginBranch||'');
  const scoped=(employees||[]).filter(e=>!NON_SALES_STORES.includes(e.branch)).filter(e=>canSwitchStores||!loginBranch?true:e.branch===loginBranch);
  const ids=isManager?scoped.map(e=>e.id):[employee?.id].filter(Boolean);
  useEffect(()=>{if(!ids.length){setData({});setLoading(false);return}
    (async()=>{setLoading(true);const [y,m]=month.split('-').map(Number),n=new Date(y,m,1),to=`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-01`;
      const [sr,hr,dr]=await Promise.all([
        supabase.from('customer_sales').select('user_id,source_type,source_meta').in('user_id',ids).gte('sale_date',`${month}-01`).lt('sale_date',to),
        supabase.from('home_orders').select('id,user_id,customer_id,customer_name,product_type,sale_type,status,source_work_date,actual_install_date').in('user_id',ids).or(`source_work_date.gte.${month}-01,actual_install_date.gte.${month}-01`),
        supabase.from('daily_records').select('user_id,work_date,data').in('user_id',ids).gte('work_date',`${month}-01`).lt('work_date',to)
      ]);
      const map={};ids.forEach(id=>map[id]={sales:[],home:[],sono:0});
      (sr.data||[]).forEach(x=>map[x.user_id]?.sales.push(x));
      (hr.data||[]).filter(x=>{const d=homePerformanceDate(x);return x.status==='completed'&&d>=`${month}-01`&&d<to}).forEach(x=>map[x.user_id]?.home.push(x));
      (dr.data||[]).forEach(x=>{const g=x.data?.groups?.sono||{};if(map[x.user_id])map[x.user_id].sono+=Object.values(g).reduce((a,v)=>a+Number(v||0),0)});
      const result={};ids.forEach(id=>result[id]=qualityFromSales(map[id]?.sales||[],map[id]?.home||[],map[id]?.sono||0));setData(result);setLoading(false);
    })().catch(err=>{console.error('SALES QUALITY LOAD ERROR',err);const result={};ids.forEach(id=>result[id]=qualityFromSales([],[],0));setData(result);setLoading(false);});
  },[month,ids.join('|')]);

  if(loading)return <div className="bg-white rounded-xl border p-4 text-sm text-gray-400">판매 퀄리티 계산 중...</div>;
  const render=(q)=>{
    const safe={
      hs:Number(q?.hs||0),plan115:Number(q?.plan115||0),home:Number(q?.home||0),
      freeSmart:Number(q?.freeSmart||0),mnp:Number(q?.mnp||0),second:Number(q?.second||0),
      revenuePoints:Number(q?.revenuePoints||0),
      plan115Pct:Number(q?.plan115Pct||0),homePct:Number(q?.homePct||0),
      freeSmartPct:Number(q?.freeSmartPct||0),mnpPct:Number(q?.mnpPct||0),
      secondPct:Number(q?.secondPct||0),revenuePct:Number(q?.revenuePct||0)
    };
    return <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      <QualityMetricCard label="115군 비중" value={`${safe.plan115Pct}%`} sub={`${safe.plan115}/${safe.hs}건`} />
      <QualityMetricCard label="홈(인터넷) 비중" value={`${safe.homePct}%`} sub={`${safe.home}/${safe.hs}건 · 올인원 포함`} />
      <QualityMetricCard label="프리+스홈 비중" value={`${safe.freeSmartPct}%`} sub={`${safe.freeSmart}/${safe.hs}건 · 상품수 기준`} />
      <QualityMetricCard label="MNP 비중" value={`${safe.mnpPct}%`} sub={`${safe.mnp}/${safe.hs}건`} />
      <QualityMetricCard label="2ND 번들 비중" value={`${safe.secondPct}%`} sub={`${safe.second}/${safe.hs}건 · 상품수 기준`} />
      <QualityMetricCard label="매출지표" value={`${safe.revenuePct}%`} sub={`총 ${safe.revenuePoints.toFixed(1)}P / HS ${safe.hs}건`} />
    </div>;
  };

  if(!isManager)return <div className="space-y-3"><div><div className="text-xs text-brand-600 font-semibold">보조지표</div><div className="text-lg font-bold">판매 퀄리티 · {monthLabel(month)}</div><div className="text-[10px] text-gray-400 mt-1">평가점수에는 반영되지 않습니다.</div></div>{render(data[employee?.id])}</div>;

  const stores=sortStoresByOpenOrder([...new Set(scoped.map(e=>e.branch))]);
  const selectedStore=storeFilter||stores[0]||'';
  const members=scoped.filter(e=>e.branch===selectedStore);
  const emptyAgg={hs:0,plan115:0,home:0,freeSmart:0,mnp:0,second:0,strategicPlan:0,insurance:0,strategicVas:0,sono:0,revenuePoints:0};
  const agg=members.reduce((a,e)=>{const q=data[e.id];if(!q)return a;Object.keys(emptyAgg).forEach(k=>a[k]=Number(a[k]||0)+Number(q[k]||0));return a},{...emptyAgg});
  const storeQ={...agg,plan115Pct:qualityPct(agg.plan115,agg.hs),homePct:qualityPct(agg.home,agg.hs),freeSmartPct:qualityPct(agg.freeSmart,agg.hs),mnpPct:qualityPct(agg.mnp,agg.hs),secondPct:qualityPct(agg.second,agg.hs),revenuePct:qualityPct(agg.revenuePoints,agg.hs)};
  if(!stores.length)return <div className="bg-white rounded-xl border p-5"><div className="text-sm font-bold text-gray-800">판매 퀄리티</div><div className="text-xs text-gray-400 mt-1">조회 가능한 매장이 없습니다.</div></div>;
  return <div className="space-y-3"><div className="flex justify-between items-end gap-2"><div><div className="text-xs text-brand-600 font-semibold">판매 퀄리티</div><div className="text-lg font-bold">매장/직원 보조지표</div><div className="text-[10px] text-gray-400 mt-1">매장 수치는 직원 비율 평균이 아니라 매장 전체 HS 기준으로 재계산합니다.</div></div><select value={selectedStore} onChange={e=>setStoreFilter(e.target.value)} className="border rounded-lg px-2 py-2 text-xs">{stores.map(st=><option key={st} value={st}>{displayStoreName(st)}</option>)}</select></div>
    <div className="bg-brand-50/50 border border-brand-100 rounded-xl p-3"><div className="text-sm font-bold mb-2">{displayStoreName(selectedStore)} 전체</div>{render(storeQ)}</div>
    <div className="space-y-2">{members.length?members.map(e=><div key={e.id} className="bg-white border rounded-xl p-3"><div className="font-bold text-sm mb-2">{e.name}</div>{render(data[e.id])}</div>):<div className="bg-white border rounded-xl p-4 text-xs text-gray-400">이 매장에 조회 가능한 직원이 없습니다.</div>}</div>
  </div>;
}

function EvaluationTab({ month, employee, config, isManagerView=false, canFinalApprove=false, employees=[], rows=[], authUserId, canSwitchStores=false, loginBranch='' }){
  const [mode,setMode]=useState('career');
  const managerEligible=isManagerView;
  return <div className="space-y-3"><div><div className="text-xs text-brand-600 font-semibold">평가</div><div className="text-xl font-bold text-gray-900">{mode==='quality'?'판매 퀄리티':'커리어 등급'}</div></div><div className={`grid ${managerEligible?'grid-cols-3':'grid-cols-2'} bg-gray-100 rounded-xl p-1 gap-1`}><button onClick={()=>setMode('career')} className={`py-2 rounded-lg text-xs font-bold ${mode==='career'?'bg-white text-brand-700 shadow-sm':'text-gray-500'}`}>개인 커리어 등급</button>{managerEligible&&<button onClick={()=>setMode('manager')} className={`py-2 rounded-lg text-xs font-bold ${mode==='manager'?'bg-white text-brand-700 shadow-sm':'text-gray-500'}`}>관리자 평가</button>}<button onClick={()=>setMode('quality')} className={`py-2 rounded-lg text-xs font-bold ${mode==='quality'?'bg-white text-brand-700 shadow-sm':'text-gray-500'}`}>판매 퀄리티</button></div>{mode==='career'?<CareerEvaluationPanel employee={employee} month={month} config={config} canManage={managerEligible} canFinalApprove={canFinalApprove} managerScopeEmployees={employees}/>:mode==='manager'?<ManagerEvaluationPanel month={month} employees={employees} rows={rows} authUserId={authUserId} canSwitchStores={canSwitchStores} loginBranch={loginBranch}/>:<SalesQualityPanel month={month} employee={employee} employees={employees} isManager={managerEligible} loginBranch={loginBranch} canSwitchStores={canSwitchStores}/>}</div>;
}
export { EvaluationTab, ManagerPayrollPanel, ManagerEvaluationPanel };
