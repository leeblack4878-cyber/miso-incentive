import React,{useEffect,useRef,useState} from 'react';
import {monthLabel} from '../appShared';
import {companyGoalDefaults} from '../viewShared';
import {supabase} from '../supabase';
import {comparisonChange,comparisonPeriods} from '../performancePeriod';
import {loadPerformanceComparison} from '../performanceComparison';

export function metricText(metric,value){
  const n=Number(value||0);
  return `${new Intl.NumberFormat('ko-KR',{maximumFractionDigits:metric.unit==='won'?0:1,minimumFractionDigits:metric.unit==='point'?1:0}).format(n)}${metric.unit==='won'?'원':metric.unit==='point'?'P':'건'}`;
}
const goalKey={free:'tvFree',smart:'smartHome',upsell:'tailoredCount',upsellAmount:'tailoredAmount',tailored:'tailoredCount'};

export default function PerformanceCard({month,title,scopeLabel,metrics,scopeRows=[],branches=[],config,mode='personal',onMetricClick,goalEditor,onEditGoals,loadStoreGoals=false,testPrefix='performance',children}){
  const [open,setOpen]=useState(false),[comparison,setComparison]=useState({status:'idle'});
  const [goals,setGoals]=useState({}),[goalStatus,setGoalStatus]=useState('idle');
  const dialog=useRef(null);
  const scopeKey=scopeRows.map(r=>`${r.id}:${r.branch}`).sort().join('|');
  const branchKey=branches.slice().sort().join('|');
  useEffect(()=>{setOpen(false);setComparison({status:'idle'});setGoals({});},[month,scopeKey,branchKey]);
  useEffect(()=>{
    if(open&&!dialog.current?.open)dialog.current?.showModal();
    if(!open&&dialog.current?.open)dialog.current.close();
  },[open]);
  useEffect(()=>{
    if(!open)return;
    let alive=true;setComparison({status:'loading'});
    loadPerformanceComparison({month,rows:scopeRows,branches,config,mode})
      .then(value=>{if(alive)setComparison({status:'ready',...value});})
      .catch(()=>{if(alive)setComparison({status:'error'});});
    return()=>{alive=false;};
  },[open,month,scopeKey,branchKey,config,mode]);
  useEffect(()=>{
    if(!open||!loadStoreGoals)return;
    let alive=true;setGoalStatus('loading');setGoals({});
    if(!branches.length){setGoalStatus('ready');return;}
    supabase.from('store_goals').select('store_name,company_goals,challenge_goals').eq('month',month).in('store_name',branches).then(({data,error})=>{
      if(!alive)return;if(error){setGoalStatus('error');return;}
      const result={};
      for(const branch of branches){const saved=(data||[]).find(x=>x.store_name===branch);const values={...companyGoalDefaults(branch),...(saved?.company_goals||{}),...(saved?.challenge_goals||{})};for(const [key,value] of Object.entries(values))result[key]=(result[key]||0)+Number(value||0);}
      setGoals(result);setGoalStatus('ready');
    });return()=>{alive=false;};
  },[open,month,branchKey,loadStoreGoals]);
  const periods=comparisonPeriods(month);
  const previousText=metric=>{
    if(comparison.status==='loading')return '비교 자료 확인 중';
    if(comparison.status==='error')return '비교 자료 조회 실패';
    const key=metric.compareKey||metric.key;
    const before=comparison.previous?.[key],current=comparison.current?.[key];
    const change=comparisonChange(current,before);
    if(!change)return '비교 자료 없음';
    const delta=`${change.difference>0?'+':change.difference<0?'−':''}${metricText(metric,Math.abs(change.difference))}`;
    return `${metricText(metric,before)} → ${metricText(metric,current)} · ${delta}${change.percent===null?'':` (${change.percent>0?'+':''}${change.percent.toFixed(1)}%)`}`;
  };
  return <section className="surface-card p-4" aria-label={title}>
    <div className="flex items-start justify-between gap-3 mb-3"><div><div className="text-xs text-gray-500">{scopeLabel} · {monthLabel(month)}</div><h2 className="text-base font-bold text-gray-900 mt-1">{title}</h2></div>{children}</div>
    <div className="performance-grid">
      {metrics.map(metric=><div key={metric.key} data-testid={`${testPrefix}-metric-${metric.key}`} className="performance-tile"><div className="text-xs text-gray-500">{metric.label}</div><div className="metric-value text-lg font-bold text-gray-900 mt-1">{metricText(metric,metric.value)}</div></div>)}
    </div>
    <button type="button" onClick={()=>setOpen(true)} className="w-full mt-3 py-2 text-sm font-semibold text-brand-700" aria-haspopup="dialog">진척도 상세보기 <span aria-hidden="true">›</span></button>
    <dialog ref={dialog} onClose={()=>setOpen(false)} onClick={e=>{if(e.target===e.currentTarget)setOpen(false);}} className="performance-dialog" aria-label={`${scopeLabel} 진척도 상세`}>
      <div className="performance-dialog-header"><div><h2 className="text-lg font-bold">{scopeLabel} 진척도 상세</h2><p className="text-xs text-gray-500 mt-1">{monthLabel(month)}</p></div><button type="button" onClick={()=>setOpen(false)} aria-label="진척도 상세 닫기" className="rounded-full bg-gray-50 w-11 h-11 text-xl">×</button></div>
      {open&&<div className="p-4 space-y-4">
        <p className="text-xs text-gray-500">전월 대비: {month.slice(5)}월 1~{periods.end}일 / {periods.previous.slice(5)}월 1~{periods.previousEnd}일. 같은 조회 대상의 일일 입력·설치 완료 기준이며, 월 단위 입력과 본사 확정값은 비교에서 제외돼요.</p>
        {comparison.status==='error'&&<p role="alert" className="text-sm text-red-600">전월 비교 자료를 불러오지 못했어요. 상세보기를 다시 열어주세요.</p>}
        {loadStoreGoals&&goalStatus==='error'&&<p role="alert" className="text-sm text-red-600">목표를 불러오지 못했어요.</p>}
        {goalEditor}
        {onEditGoals&&<button type="button" onClick={()=>{setOpen(false);onEditGoals();}} className="text-sm font-semibold text-brand-700">목표 설정</button>}
        {metrics.map(metric=>{
          const target=loadStoreGoals?(goals[goalKey[metric.key]||metric.key]||goals[metric.key]||(metric.key==='productivity'?goals.kpi:['tailored','upsell'].includes(metric.key)?goals.tailored:0)):metric.target;
          const targetReady=!loadStoreGoals||goalStatus==='ready';
          const rate=targetReady&&target>0?`${Math.round(metric.value/target*100)}%`:'—';
          return <section key={metric.key} className="performance-detail" data-testid={`${testPrefix}-detail-${metric.key}`}>
            <h3 className="font-semibold text-gray-800">{metric.label}</h3>
            <dl className="performance-detail-grid">
              <div><dt>목표</dt><dd>{!targetReady?(goalStatus==='error'?'조회 실패':'확인 중'):target>0?metricText(metric,target):'미설정'}</dd></div>
              <div><dt>실적</dt><dd>{metricText(metric,metric.value)}</dd></div>
              <div><dt>달성률</dt><dd>{rate}</dd></div>
              <div><dt>예상 마감</dt><dd>{metricText(metric,metric.forecast)}</dd></div>
              <div className="col-span-2"><dt>전월 대비</dt><dd className="text-sm">{previousText(metric)}</dd></div>
            </dl>
            {onMetricClick&&<button type="button" className="mt-3 text-sm text-brand-700" onClick={()=>{setOpen(false);onMetricClick(metric);}}>{metric.label} 날짜별 내역 ›</button>}
          </section>;
        })}
      </div>}
    </dialog>
  </section>;
}
