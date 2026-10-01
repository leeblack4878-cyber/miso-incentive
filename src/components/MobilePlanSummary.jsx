import React,{useEffect,useMemo,useState} from 'react';
import {supabase} from '../supabase';
import {readAllPages} from '../performanceRoster';
import {MOBILE_PLANS,MOBILE_PLAN_TYPES,summarizeMobilePlans} from '../mobilePlans';
export default function MobilePlanSummary({month,employees=[],branches=null,personal=false,scopeLabel=''}){
 const [open,setOpen]=useState(false),[type,setType]=useState('general'),[kind,setKind]=useState('all');
 const [result,setResult]=useState({key:'',sales:[],error:false});
 const ids=[...new Set(employees.map(e=>e.id).filter(Boolean))].sort(),key=`${month}:${ids.join(',')}`;
 const employeeBranches=Object.fromEntries(employees.map(e=>[e.id,e.branch]));
 useEffect(()=>{
  if(!open)return;let alive=true;
  if(!ids.length){setResult({key,sales:[],error:false});return;}
  setResult({key,sales:[],error:false,loading:true});
  const [y,m]=month.split('-').map(Number),end=new Date(Date.UTC(y,m,1)).toISOString().slice(0,10);
  (async()=>{
   const {data,error}=await readAllPages(()=>supabase.from('customer_sales').select('id,user_id,source_type,source_meta,sale_date')
    .in('user_id',ids).in('source_type',['mobile','daily']).gte('sale_date',`${month}-01`).lt('sale_date',end).order('id'));
   if(alive)setResult({key,sales:error?[]:data||[],error:!!error});
  })().catch(()=>{if(alive)setResult({key,sales:[],error:true});});
  return()=>{alive=false;};
 },[open,key]); // Only permission-scoped employee IDs are queried.
 const summary=useMemo(()=>summarizeMobilePlans(result.sales,{userIds:ids,branches,employeeBranches,personal,kind}),[result, key, JSON.stringify(branches),JSON.stringify(employeeBranches),personal,kind]);
 const pending=result.key!==key||result.loading;
 return <section aria-label="요금제별 집계" className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
  <button type="button" aria-expanded={open} onClick={()=>setOpen(v=>!v)} className="w-full px-4 py-3 text-left flex items-center justify-between gap-3">
   <span className="min-w-0"><span className="block text-sm font-bold text-gray-900">요금제별 집계</span><span className="mt-1 block text-[11px] text-gray-500">{scopeLabel} · {month}</span></span><span aria-hidden className="text-xs text-gray-400">{open?'▲':'▼'}</span>
  </button>
  {open&&<div className="border-t border-gray-100 p-4">
   {pending?<p className="text-xs text-gray-500">집계를 불러오는 중...</p>:result.error?<p role="alert" className="text-xs text-red-600">요금제 집계를 불러오지 못했어요. 닫았다 다시 열어주세요.</p>:<>
    <label className="flex justify-between items-center gap-3 mb-3 text-xs text-gray-600">집계 대상<select aria-label="요금제 집계 대상" value={kind} onChange={e=>setKind(e.target.value)} className="rounded-lg border px-2 py-2 bg-white"><option value="all">모바일 전체</option><option value="hs">HS</option><option value="sim">SIM MNP</option></select></label>
    <div className="grid grid-cols-3 gap-2">{MOBILE_PLAN_TYPES.map(t=><button type="button" key={t.key} aria-pressed={type===t.key} onClick={()=>setType(t.key)} className={`rounded-xl py-3 text-center border ${type===t.key?'bg-brand-50 border-brand-200 text-brand-700':'bg-gray-50 border-transparent text-gray-600'}`}><span className="block text-xs">{t.label}</span><b className="mt-1 block text-base">{summary.types[t.key]}건</b></button>)}</div>
    <div className="mt-3 divide-y divide-gray-50">{MOBILE_PLANS.filter(p=>p.type===type).map(p=><div key={p.key} className="flex items-start justify-between gap-3 py-2 text-xs"><span className="min-w-0 break-words text-gray-600">{p.label}</span><b className="shrink-0 text-gray-900">{summary.counts[p.key]}건</b></div>)}</div>
    <div className="mt-3 border-t border-gray-100 pt-3 flex justify-between gap-3 text-xs font-semibold"><span>합계</span><span>{summary.total}건</span></div>
    <div className="mt-2 text-[11px] text-gray-500">세부 요금제 미입력 {summary.missing}건</div>
    <p className="mt-2 text-[10px] leading-relaxed text-gray-400">고객별 판매내역 기준 · 기존 기록의 요금제는 추정하지 않아요. 전월 모단말과 2ND는 제외해요.{personal?' 지원 판매는 매장 집계에 반영해요.':''}</p>
   </>}
  </div>}
 </section>;
}
