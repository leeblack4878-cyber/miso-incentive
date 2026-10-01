import React,{useState} from 'react';
import {POLICY_CHANGE_HISTORY} from '../policyChangeHistory';

export default function PolicyHistory(){
  const [month,setMonth]=useState('all');
  const months=[...new Set(POLICY_CHANGE_HISTORY.map(item=>item.month))].sort().reverse();
  const records=POLICY_CHANGE_HISTORY.filter(item=>month==='all'||item.month===month);
  return <section aria-label="정책 히스토리" className="space-y-3">
    <div className="flex items-start justify-between gap-3 px-1">
      <div className="min-w-0"><h2 className="text-lg font-bold text-gray-900">정책 히스토리</h2><p className="mt-1 text-xs text-gray-500">적용일 기준으로 변경 내용을 확인하세요.</p></div>
      <select aria-label="정책 이력 월" value={month} onChange={e=>setMonth(e.target.value)} className="shrink-0 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700">
        <option value="all">전체</option>{months.map(value=><option key={value} value={value}>{value.slice(0,4)}년 {Number(value.slice(5))}월</option>)}
      </select>
    </div>
    <div className="space-y-3">{records.map(item=><article key={item.id} className="rounded-2xl border border-gray-100 bg-white p-4">
      <time dateTime={item.date} className="text-xs font-semibold text-brand-600">{item.date.replaceAll('-','.')}</time>
      <h3 className="mt-1.5 text-sm font-bold text-gray-900">{item.title}</h3>
      <p className="mt-1 text-[11px] leading-relaxed text-gray-500">{item.effective}</p>
      <ul className="mt-3 space-y-2 pl-4 text-xs leading-relaxed text-gray-700 list-disc marker:text-gray-300">{item.changes.map(line=><li key={line}>{line}</li>)}</ul>
      {item.details?.length>0&&<details className="mt-3 border-t border-gray-100 pt-3"><summary className="cursor-pointer text-xs font-semibold text-gray-600">세부 변경 {item.details.length}개</summary><ul className="mt-3 space-y-2 pl-4 text-xs leading-relaxed text-gray-600 list-disc marker:text-gray-300">{item.details.map(line=><li key={line}>{line}</li>)}</ul></details>}
    </article>)}</div>
    <p className="px-1 text-[11px] leading-relaxed text-gray-400">확인된 정책 변경을 정리한 기록입니다. 원본 공지는 카톡방에서 확인해주세요.</p>
  </section>;
}
