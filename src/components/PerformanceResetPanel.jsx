import {useCallback,useEffect,useState} from 'react';
import {supabase} from '../supabase';
import {friendlyError} from '../errorMessages';

const labels={pending:'승인 대기',approved:'승인 완료',rejected:'반려',cancelled:'취소',executed:'초기화 완료'};
const expired=request=>request?.status==='approved'&&new Date(request.expires_at)<=new Date();
const dateLabel=value=>value?new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'';
const field='w-full border border-gray-200 rounded-xl px-3 py-2 text-sm';
const button='px-3 py-2 rounded-lg text-xs font-bold disabled:opacity-40';

function useRequests(month,userId){
  const [requests,setRequests]=useState([]),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  const load=useCallback(async()=>{
    setLoading(true);setError('');
    let query=supabase.from('performance_reset_requests').select('*').eq('month',month).order('requested_at',{ascending:false});
    if(userId)query=query.eq('user_id',userId);
    const result=await query;
    if(result.error){setError(friendlyError(result.error));setRequests([]);}else setRequests(result.data||[]);
    setLoading(false);
  },[month,userId]);
  useEffect(()=>{load()},[load]);
  return {requests,error,setError,loading,load};
}

export default function PerformanceResetPanel({month,userId,locked=false}){
  const {requests,error,setError,loading,load}=useRequests(month,userId);
  const [reason,setReason]=useState(''),[phrase,setPhrase]=useState(''),[busy,setBusy]=useState(false);
  const request=requests[0];
  const open=request&&['pending','approved'].includes(request.status)&&!expired(request);
  async function run(name,args){
    setBusy(true);setError('');
    try{
      const {error:rpcError}=await supabase.rpc(name,args);
      if(rpcError)throw rpcError;
      if(name==='reset_my_month_performance'){window.location.reload();return;}
      setReason('');setPhrase('');await load();
    }catch(e){setError(friendlyError(e));}finally{setBusy(false);}
  }
  return <section className="mt-4 bg-white rounded-xl border border-red-100 p-4 space-y-3" aria-label="실적 초기화 요청">
    <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-bold">{month} 실적 초기화</h3><button type="button" className={`${button} bg-gray-100`} disabled={busy||loading} onClick={load}>상태 새로고침</button></div>
    <p className="text-xs text-gray-500 leading-relaxed">사유를 적어 요청하면 담당 관리자가 확인해요. 다른 관리자의 승인 후 24시간 이내에 본인이 실행할 수 있어요. 실행 직전 데이터는 자동 백업됩니다.</p>
    {loading&&<p className="text-xs text-gray-500">요청 확인 중…</p>}
    {!loading&&request&&<div className="bg-gray-50 rounded-xl p-3 text-xs space-y-1">
      <b>{expired(request)?'승인 만료 · 다시 요청해주세요':labels[request.status]}</b>
      <p className="break-words">요청 사유: {request.reason}</p>
      {request.review_note&&<p className="break-words">관리자 메모: {request.review_note}</p>}
      {request.status==='approved'&&!expired(request)&&<p>실행 기한: {dateLabel(request.expires_at)}</p>}
      {open&&<button type="button" disabled={busy} onClick={()=>run('cancel_performance_reset',{p_request_id:request.id})} className={`${button} bg-white border`}>요청 취소</button>}
    </div>}
    {!loading&&!open&&<>
      <label className="block text-xs font-semibold">초기화 사유<textarea aria-label="초기화 사유" value={reason} onChange={e=>setReason(e.target.value)} maxLength={1000} disabled={busy||locked} className={`${field} mt-1`} placeholder="잘못 입력한 내용과 초기화가 필요한 이유"/></label>
      <button type="button" disabled={busy||locked||reason.trim().length<3} onClick={()=>run('request_performance_reset',{p_month:month,p_reason:reason.trim()})} className={`${button} bg-red-50 text-red-700`}>{busy?'처리 중…':'관리자 승인 요청'}</button>
    </>}
    {!loading&&open&&request.status==='approved'&&<div className="border-t border-red-100 pt-3 space-y-2">
      <p className="text-xs text-red-700">해당 월의 실적·연결된 판매 및 자동 약속이 삭제됩니다. 별도로 등록한 수동 약속은 유지됩니다. 실행하려면 아래에 <b>당월실적초기화</b>를 입력해주세요.</p>
      <input aria-label="초기화 확인 문구" value={phrase} onChange={e=>setPhrase(e.target.value)} disabled={busy||locked} placeholder="당월실적초기화" className={field}/>
      <button type="button" disabled={busy||locked||phrase.trim()!=='당월실적초기화'} onClick={()=>run('reset_my_month_performance',{p_month:month,p_confirm_phrase:phrase.trim()})} className={`${button} bg-red-600 text-white`}>{busy?'초기화 중…':'승인된 실적 초기화 실행'}</button>
    </div>}
    {locked&&<p className="text-xs text-gray-500">마감되었거나 정책 준비 중인 월은 초기화할 수 없어요.</p>}
    {error&&<p role="alert" className="text-xs text-red-600 break-words">{error}</p>}
  </section>;
}

export function PerformanceResetApprovals({month,employees=[],authUserId,locked=false}){
  const {requests,error,setError,loading,load}=useRequests(month);
  const [notes,setNotes]=useState({}),[busy,setBusy]=useState(false);
  async function review(request,approve){
    setBusy(true);setError('');
    try{
      const {error:rpcError}=await supabase.rpc('review_performance_reset',{p_request_id:request.id,p_approve:approve,p_note:notes[request.id]||''});
      if(rpcError)throw rpcError;
      await load();
    }catch(e){setError(friendlyError(e));}finally{setBusy(false);}
  }
  return <section className="bg-white rounded-xl border border-red-100 p-4 space-y-3" aria-label="실적 초기화 승인">
    <div className="flex justify-between items-center gap-2"><h3 className="text-sm font-bold">실적 초기화 승인</h3><button type="button" className={`${button} bg-gray-100`} disabled={busy||loading} onClick={load}>새로고침</button></div>
    <p className="text-xs text-gray-500">승인하면 요청자가 24시간 이내에 직접 실행할 수 있어요. 본인 요청은 다른 관리자가 승인해야 해요.</p>
    {error&&<p role="alert" className="text-xs text-red-600 break-words">{error}</p>}
    {loading?<p className="text-xs">불러오는 중…</p>:!requests.length?<p className="text-xs text-gray-500">이 달의 초기화 요청이 없어요.</p>:requests.map(request=>{
      const employee=employees.find(e=>e.id===request.user_id);
      return <div key={request.id} className="border rounded-xl p-3 space-y-2 text-xs">
        <div className="flex flex-wrap justify-between gap-2"><b>{employee?.name||'직원'} · {employee?.branch||''} · {request.month}</b><b className="text-red-700">{expired(request)?'승인 만료':labels[request.status]}</b></div>
        <p className="text-gray-500">요청일: {dateLabel(request.requested_at)}</p>
        <p className="break-words">{request.reason}</p>
        {request.review_note&&<p className="break-words">처리 메모: {request.review_note}</p>}
        {request.status==='pending'&&(request.user_id===authUserId?<p className="text-gray-500">본인 요청은 승인할 수 없어요.</p>:<>
          <input aria-label="초기화 처리 메모" placeholder="처리 메모 (선택)" maxLength={1000} value={notes[request.id]||''} onChange={e=>setNotes({...notes,[request.id]:e.target.value})} className={field}/>
          <div className="flex gap-2"><button type="button" disabled={busy||locked} onClick={()=>review(request,true)} className={`${button} bg-brand-600 text-white`}>승인</button><button type="button" disabled={busy||locked} onClick={()=>review(request,false)} className={`${button} bg-gray-100`}>반려</button></div>
        </>)}
      </div>;
    })}
  </section>;
}
