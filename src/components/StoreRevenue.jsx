import React,{useEffect,useState} from 'react';
import {supabase} from '../supabase';
import {readAllPages} from '../performanceRoster';
import {loadCompanyRevenue} from '../companyRevenueLoader';
import {canViewStoreRevenue,summarizeStoreRevenue} from '../storeRevenue';
const won=n=>`${Math.round(n||0).toLocaleString('ko-KR')}원`;
const awardLabels={sohoGrade:'소호 Grade',retailAward:'소매 월간 시상',salesMetric:'매출지표',homeGrade:'홈 Grade',homeInternetRatio:'HS 대비 인터넷',homeAward:'홈 월간 시상',iptvGrade:'IPTV Grade'};
export default function StoreRevenue({month,authUserId,stores=[]}){
 const allowed=canViewStoreRevenue(authUserId),key=`${authUserId}:${month}`;
 const [retry,setRetry]=useState(0),[state,setState]=useState({key:'',loading:true,error:false,data:null});
 useEffect(()=>{
  if(!allowed||month<'2026-10')return;let alive=true;
  setState({key,loading:true,error:false,data:null});
  (async()=>{
   const end=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),1)).toISOString().slice(0,10);
   const [income,profiles,daily,input]=await Promise.all([
    loadCompanyRevenue(supabase,month),
    readAllPages(()=>supabase.from('profiles').select('id,store_name').order('id')),
    readAllPages(()=>supabase.from('daily_records').select('user_id,work_date,data').gte('work_date',`${month}-01`).lt('work_date',end).order('user_id').order('work_date')),
    supabase.from('hq_structure_monthly_inputs').select('change_support_ratio').eq('month',month).maybeSingle(),
   ]);
   if(profiles.error||daily.error||input.error)throw profiles.error||daily.error||input.error;
   const data=summarizeStoreRevenue({...income,profiles:profiles.data||[],daily:daily.data||[],stores,month,changeSupportRatio:input.data?.change_support_ratio});
   if(alive)setState({key,loading:false,error:false,data});
  })().catch(()=>{if(alive)setState({key,loading:false,error:true,data:null});});
  return()=>{alive=false;};
 },[allowed,key,retry,stores.join('|')]);
 if(!allowed)return null;
 if(month<'2026-10')return <p className="p-4 text-sm text-gray-500">매장별 수익은 회사 수수료 기준이 있는 2026년 10월부터 조회할 수 있어요.</p>;
 return <section aria-label="매장별 수익 현황" className="space-y-4">
  <div className="rounded-2xl bg-brand-50 p-4"><h2 className="text-lg font-bold">매장별 수익 현황</h2><p className="mt-1 text-xs text-gray-500">{month}</p></div>
  {state.key!==key||state.loading?<p role="status" className="p-4 text-sm">수익을 계산하는 중...</p>:state.error?<div role="alert" className="p-4 text-sm text-red-600">수익 자료를 불러오지 못했어요. <button className="underline" onClick={()=>setRetry(v=>v+1)}>다시 확인</button></div>:<>
   <div className="rounded-2xl bg-white border p-4"><div className="text-xs text-gray-500">전체 예상 수익</div><div data-testid="store-revenue-total" className="mt-2 break-all text-2xl font-bold">{won(state.data.total)}</div></div>
   {state.data.ratioMissing&&<p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">기변지원금 활용 비중 미입력</p>}
   <div className="space-y-3">{state.data.rows.map(row=><article key={row.store} className="rounded-2xl border bg-white p-4"><div><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-sm font-bold">{row.store}</h3><p className="mt-1 text-[11px] text-gray-500">HS {row.hs}건 · 인터넷 가정망 {row.internet}건 / 소호 {row.sohoInternet}건</p></div><b className="break-all text-lg text-brand-700">{won(row.total)}</b></div><div className="mt-3 grid grid-cols-1 gap-1 text-xs text-gray-500"><span>모바일 예상 총 수수료 {won(row.mobile)}</span><span>홈 예상 총 수수료 {won(row.home)}</span></div>{row.pending>0&&<p className="mt-2 text-xs text-amber-700">확인 필요 {row.pending}건</p>}</div><div className="mt-3 border-t pt-3 space-y-2 text-xs">{Object.entries(row.awards).map(([key,value])=><div key={key} className="flex flex-wrap justify-between gap-2"><span>{awardLabels[key]}</span><b>{won(value)}</b></div>)}</div></article>)}</div>
   <div className="rounded-2xl border bg-gray-50 p-4"><h3 className="text-sm font-bold">회사 공통 수익 · 매장 미배분</h3><div className="mt-2 text-xs">자가매장 운영비 지원 {won(state.data.common.selfStore)}</div><div className="mt-1 text-xs">월간판매량 정책 {won(state.data.common.retail)}</div>{Math.abs(state.data.common.monthlyReconciliation)>0.01&&<div className="mt-2 text-xs text-amber-700">월간 보상 집계 차이 {won(state.data.common.monthlyReconciliation)} · 원본 대조 필요</div>}</div>
  </>}
 </section>;
}
