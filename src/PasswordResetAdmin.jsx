import React, { useCallback, useEffect, useState } from 'react';
import { Check, Clipboard, KeyRound, Loader2, RefreshCw, X } from 'lucide-react';
import { supabase } from './supabase';

const RESET_ADMIN_ID='a50a0979-acef-40b1-98b7-f05074f1c835';
const storeName=value=>String(value||'').split('_').pop();
const timeText=value=>value?new Date(value).toLocaleString('ko-KR'):'-';

export default function PasswordResetAdmin({authUserId}){
  const [rows,setRows]=useState([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(''),[issued,setIssued]=useState(null);
  const load=useCallback(async()=>{
    if(authUserId!==RESET_ADMIN_ID)return;
    setLoading(true);
    const {data,error}=await supabase.from('password_reset_requests')
      .select('id,target_user_id,requested_email,status,requested_at,reviewed_at,completed_at,profiles!password_reset_requests_target_user_id_fkey(name,store_name,position)')
      .order('requested_at',{ascending:false}).limit(30);
    if(error)console.error('PASSWORD RESET REQUEST LOAD ERROR',error);
    setRows(data||[]);setLoading(false);
  },[authUserId]);
  useEffect(()=>{load()},[load]);
  if(authUserId!==RESET_ADMIN_ID)return null;
  const decide=async(row,action)=>{
    setBusy(row.id);
    const {data,error}=await supabase.functions.invoke('password-reset-flow',{body:{action,requestId:row.id}});
    setBusy('');
    if(error)return window.alert(`처리하지 못했어요: ${error.message}`);
    if(action==='issue')setIssued({name:row.profiles?.name||'직원',password:data?.temporaryPassword||''});
    await load();
  };
  const pending=rows.filter(row=>row.status==='pending'),history=rows.filter(row=>row.status!=='pending').slice(0,10);
  return <div className="rounded-2xl border border-violet-100 bg-white overflow-hidden">
    <div className="flex items-center justify-between bg-violet-50 px-4 py-4"><div><div className="flex items-center gap-2 text-sm font-black text-violet-900"><KeyRound size={16}/> 비밀번호 초기화 요청</div><div className="mt-1 text-[10px] text-violet-600">본인 확인 후 임시 비밀번호를 발급하세요.</div></div><button onClick={load} className="rounded-lg bg-white p-2 text-violet-600"><RefreshCw size={14}/></button></div>
    {loading?<div className="flex items-center justify-center gap-2 p-6 text-xs text-gray-400"><Loader2 size={14} className="animate-spin"/> 불러오는 중</div>:pending.length===0?<div className="p-5 text-center text-xs text-gray-400">대기 중인 요청이 없어요.</div>:<div className="divide-y divide-gray-50">{pending.map(row=><div key={row.id} className="p-4"><div className="flex justify-between gap-3"><div><div className="text-sm font-bold text-gray-900">{row.profiles?.name||'직원'} · {row.profiles?.position||''}</div><div className="mt-1 text-[10px] text-gray-500">{storeName(row.profiles?.store_name)} · {row.requested_email}</div><div className="mt-1 text-[10px] text-gray-400">요청 {timeText(row.requested_at)}</div></div><div className="flex gap-1.5"><button disabled={busy===row.id} onClick={()=>decide(row,'reject')} className="h-9 rounded-lg bg-gray-100 px-3 text-xs font-bold text-gray-500">반려</button><button disabled={busy===row.id} onClick={()=>decide(row,'issue')} className="h-9 rounded-lg bg-violet-600 px-3 text-xs font-bold text-white">{busy===row.id?'처리 중':'임시 비밀번호 발급'}</button></div></div></div>)}</div>}
    {history.length>0&&<div className="border-t px-4 py-3"><div className="text-[10px] font-bold text-gray-400 mb-2">최근 처리 이력</div>{history.map(row=><div key={row.id} className="flex justify-between py-1.5 text-[11px]"><span>{row.profiles?.name||'직원'} · {timeText(row.requested_at)}</span><b className={row.status==='completed'?'text-emerald-600':row.status==='issued'?'text-violet-600':'text-gray-400'}>{{completed:'변경 완료',issued:'임시 비밀번호 발급',rejected:'반려'}[row.status]||row.status}</b></div>)}</div>}
    {issued&&<div className="fixed inset-0 z-[140] flex items-end sm:items-center justify-center bg-black/50" onClick={()=>setIssued(null)}><div className="w-full max-w-sm rounded-t-3xl sm:rounded-3xl bg-white p-5" onClick={e=>e.stopPropagation()}><div className="flex justify-between"><div><div className="text-lg font-black">임시 비밀번호 발급 완료</div><div className="mt-1 text-xs text-gray-500">{issued.name}님에게 전달해주세요. 닫으면 다시 볼 수 없어요.</div></div><button onClick={()=>setIssued(null)}><X size={18}/></button></div><div className="mt-4 rounded-2xl bg-violet-50 p-4 text-center text-xl font-black tracking-wider text-violet-800">{issued.password}</div><button onClick={async()=>{await navigator.clipboard.writeText(issued.password)}} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-sm font-bold text-white"><Clipboard size={15}/> 복사하기</button><div className="mt-3 flex items-center gap-1.5 text-[10px] text-emerald-600"><Check size={12}/> 직원은 로그인 직후 새 비밀번호로 반드시 변경하게 됩니다.</div></div></div>}
  </div>;
}
