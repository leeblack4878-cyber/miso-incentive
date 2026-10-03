import React,{useEffect,useState} from 'react';
import {supabase} from '../supabase';
import {readAllPages} from '../performanceRoster';
import {canViewCompanyRevenue,summarizeCompanyRevenue,COMPANY_PLAN_FEES,COMPANY_REVENUE_START_MONTH} from '../companyRevenue';
const won=n=>`${n.toLocaleString('ko-KR')}원`;
export default function CompanyRevenue({month,authUserId}){
 const [open,setOpen]=useState(false),[retry,setRetry]=useState(0),[state,setState]=useState({key:'',sales:[],loading:false,error:false});
 const allowed=canViewCompanyRevenue(authUserId),key=`${authUserId}:${month}`;
 useEffect(()=>{
  if(!allowed||!open||month<COMPANY_REVENUE_START_MONTH)return;let alive=true;setState({key,sales:[],loading:true,error:false});
  const [y,m]=month.split('-').map(Number),end=new Date(Date.UTC(y,m,1)).toISOString().slice(0,10);
  (async()=>{
   const {data,error}=await readAllPages(()=>supabase.from('customer_sales').select('id,source_type,source_meta,sale_date').in('source_type',['mobile','daily']).gte('sale_date',`${month}-01`).lt('sale_date',end).order('id'));
   if(alive)setState({key,sales:error?[]:data||[],loading:false,error:!!error});
  })().catch(()=>{if(alive)setState({key,sales:[],loading:false,error:true});});
  return()=>{alive=false;};
 },[allowed,open,key,retry]);
 if(!allowed)return null;
 const result=summarizeCompanyRevenue(state.sales,month),pending=state.key!==key||state.loading;
 return <section aria-label="회사 예상 수익" className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
  <button type="button" aria-expanded={open} onClick={()=>setOpen(v=>!v)} className="w-full px-4 py-3 flex justify-between items-center text-left"><span><span className="block text-sm font-bold">회사 예상 수익</span><span className="block mt-1 text-[11px] text-gray-500">대표 전용 · 회사 전체 · {month}</span></span><span className="text-gray-400 text-xs">{open?'▲':'▼'}</span></button>
  {open&&<div className="p-4 border-t border-gray-100">
   {month<COMPANY_REVENUE_START_MONTH?<p className="text-xs text-gray-500">회사 수익 기준은 2026년 10월 개통 건부터 적용해요. 이전 월 기준은 미설정입니다.</p>:pending?<p className="text-xs text-gray-500">수익을 불러오는 중...</p>:state.error?<div role="alert" className="text-xs text-red-600">회사 수익을 불러오지 못했어요. <button onClick={()=>setRetry(v=>v+1)} className="underline">다시 확인</button></div>:<>
    <div className="rounded-xl bg-brand-50 p-4"><div className="text-xs text-brand-700">입력된 수수료 합계</div><div className="text-2xl font-bold text-gray-900 mt-1 break-all" data-testid="company-revenue-total">{won(result.total)}</div><div className="text-[11px] text-gray-500 mt-2">모바일 {result.count}건 · 개통월 기준</div></div>
    <div className="mt-3 space-y-2 text-xs">{[['기본 유치 수수료',result.base],['요금제 수수료 (일반·시니어·주니어)',result.plan],['SIM MNP 수수료',result.sim]].map(([label,value])=><div key={label} className="flex justify-between gap-3"><span className="text-gray-500">{label}</span><b>{won(value)}</b></div>)}</div>
    {result.pending>0&&<div className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800"><b>추가 수수료 확인 필요 {result.pending}건</b>{Object.entries(result.reasons).map(([label,count])=><div key={label} className="mt-1">{label} · {count}건</div>)}</div>}
    {result.unclassified>0&&<p className="mt-2 text-xs text-amber-700">가입구분 미입력 {result.unclassified}건은 계산에서 제외했어요.</p>}
    <p className="mt-3 text-[11px] text-gray-500 leading-relaxed">현재 입력한 회사 수수료만 계산한 예상액이에요. 시상금·기타 수익·비용·환수는 아직 포함하지 않아 최종 매출이나 손익이 아니에요. 취소·삭제된 판매는 제외하며, 일일 합계만 있는 과거 실적은 추정하지 않아요.</p>
    <details className="mt-3 text-xs"><summary className="cursor-pointer font-semibold text-brand-700">수익 계산 기준 보기</summary><div className="mt-2 space-y-2 text-gray-600"><p>2026년 10월부터 · 모든 모바일 가입: 기본 22,000원</p>{Object.entries(COMPANY_PLAN_FEES).sort((a,b)=>Number(b[0])-Number(a[0])).map(([tier,value])=><div key={tier} className="flex justify-between"><span>{tier}군</span><span>{won(value)}</span></div>)}<p>일반 33~55군: MNP만 22,000원 추가. 33군 미만: 요금제 수수료 없음.</p><p>주니어:85군143,000원 / 44~75군66,000원 / 37군 이하22,000원. 시니어:61·47·44군66,000원 / 37·33군MNP만22,000원 / 그 외0원.</p><p>SIM MNP(선택약정):일반33~55군99,000원 / 61·70·75군143,000원 / 85군 이상198,000원. 주니어61군 미만99,000원 / 61·70·75군143,000원 / 85군198,000원. 시니어47군99,000원. 표에 없는 요금제 추가금0원. 일반 모바일 수수료와 중복 합산하지 않아요.</p><p>2ND 추가 수수료는 미설정. 기본 수수료는 반영해요.</p></div></details>
   </>}
  </div>}
 </section>;
}
