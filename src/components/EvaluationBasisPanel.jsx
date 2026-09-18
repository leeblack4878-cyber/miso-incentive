import React from 'react';
import {EVALUATION_BASIS_LABELS,EVALUATION_METRICS,companyMetric,evaluationMetric,companyAge,koreaToday} from '../evaluationBasis';

export function evaluationValue(value,unit='count'){
  if(value===null||value===undefined)return '미입력';
  return `${Number(value).toLocaleString('ko-KR',{maximumFractionDigits:unit==='won'?0:1})}${unit==='won'?'원':unit==='point'?'P':'건'}`;
}
export default function EvaluationBasisPanel({basis,savedBasis,onChange,onSave,canSave,saving,live,verified,asOfDate,verifiedAt,report,month}){
  const age=companyAge(asOfDate),preview=basis!==savedBasis;
  const savedAt=verifiedAt?new Date(verifiedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'저장 이력 없음';
  return <section className="bg-white rounded-2xl border p-4 space-y-3" aria-label="평가 입력기준">
    <div className="flex justify-between items-start gap-2"><div><h3 className="text-sm font-bold">평가 입력기준</h3><p className="text-xs text-gray-500 mt-1">적용 중: {EVALUATION_BASIS_LABELS[savedBasis]}</p></div><span className="bg-blue-50 text-blue-700 rounded-full px-2 py-1 text-[10px] whitespace-nowrap">잠정 평가</span></div>
    <div className="grid grid-cols-2 gap-2" role="group" aria-label="평가 기준 선택">{Object.entries(EVALUATION_BASIS_LABELS).map(([key,label])=><button type="button" key={key} aria-pressed={basis===key} disabled={saving} onClick={()=>onChange(key)} className={`min-w-0 rounded-xl px-2 py-3 text-xs font-bold disabled:opacity-50 ${basis===key?'bg-brand-600 text-white':'bg-gray-100 text-gray-600'}`}>{label}</button>)}</div>
    {preview&&<div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800"><p>선택한 기준으로 미리 보고 있어요. 저장 전에는 적용 기준이 바뀌지 않습니다.</p>{canSave&&<button type="button" onClick={onSave} disabled={saving} className="mt-2 w-full py-2 rounded-lg bg-brand-600 text-white font-bold disabled:opacity-50">{saving?'저장 중':'이 기준으로 적용'}</button>}</div>}
    <p className="text-xs text-gray-500">회사 실적: {asOfDate?`${asOfDate}까지 기준`:'실적 기준일 미등록'}{age>0?` · ${age}일 경과`:''}<br/><span className="text-[10px]">회사값 저장: {savedAt}</span></p>
    {basis==='company'&&report&&<p className="rounded-lg bg-blue-50 p-2 text-xs text-blue-800">회사 평가표의 핵심성과 {report.core100.toFixed(1)}점 · AA {report.aa100.toFixed(1)}점을 적용합니다. 직원입력기준은 앱 계산식의 잠정 점수예요.</p>}
    <details><summary className="cursor-pointer text-sm font-semibold text-brand-700 py-2">직원·회사 실적 대조</summary>
      <p className="text-[11px] text-gray-500 my-2">직원은 {month===koreaToday().slice(0,7)?`${koreaToday()} 현재`:`${month}월`} 입력 누적, 회사는 위 기준일까지의 누적입니다. 차이는 직원−회사이며, 기간·집계 범위가 다르면 입력 오류와 구분해 확인해주세요. NPS·민원·MNP 타사 가망 개통은 회사 입력을 사용합니다.</p>
      <div className="divide-y">{EVALUATION_METRICS.map(([label,key,unit])=>{
        const employee=key==='prospectMnp'?null:live[key],company=companyMetric(verified,key);
        const applied=evaluationMetric({basis,live,verified},key);
        const difference=employee!=null&&company!==null?Math.round((Number(employee)-company)*100)/100:null;
        return <div key={key} className="py-3 space-y-2" data-testid={`evaluation-compare-${key}`}><div className="flex justify-between gap-2 text-xs"><b>{label}</b><span className="text-brand-700 font-semibold">적용 {evaluationValue(applied,unit)}</span></div><div className="grid grid-cols-2 gap-2 text-[11px]"><div className="bg-gray-50 rounded-lg p-2"><div className="text-gray-500">직원입력기준</div><b className="block break-all mt-1">{key==='prospectMnp'?'회사 확인 항목':evaluationValue(employee,unit)}</b></div><div className="bg-blue-50 rounded-lg p-2"><div className="text-gray-500">회사입력기준</div><b className="block break-all mt-1">{evaluationValue(company,unit)}</b></div></div><p className={`text-[11px] text-right ${difference?'text-amber-700':'text-gray-500'}`}>차이 {difference===null?'비교 불가':`${difference>0?'+':difference<0?'−':''}${evaluationValue(Math.abs(difference),unit)}`}</p></div>;
      })}</div>
    </details>
  </section>;
}
