import React,{useCallback,useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {supabase} from '../supabase';
import {readAllPages} from '../performanceRoster';
import {showAppToast} from '../feedback';
import {friendlyError} from '../errorMessages';
import {displayStoreName} from '../uiDefinitions';
import {OB_PURPOSES,OB_RESULTS,OB_REACTIONS,subscriptionKey,phoneDigits,koreaDate,obSummary,latestObCustomers,validateObDraft,obTel} from '../obActivity';
const inputClass='w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm';
const blank=()=>({subscription_number:'',customer_name:'',phone:'',purpose:'기변 권유',call_result:'',reaction:'',follow_up_date:'',visit_at:'',memo:''});
const time=value=>new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});
function Metrics({rows}){const s=obSummary(rows);return <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{[['활동 건수',s.activity,'건'],['연결 건수',s.connected,'건'],['연결률',s.rate,'%'],['방문 약속',s.visits,'건']].map(([label,value,unit])=><div key={label} className="rounded-2xl bg-gray-50 p-4"><div className="text-xs text-gray-500">{label}</div><div className="mt-2 text-2xl font-bold">{value}<span className="ml-1 text-xs font-normal text-gray-500">{unit}</span></div></div>)}</div>}
function Modal({title,onClose,children}){return createPortal(<div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-3" onClick={e=>e.target===e.currentTarget&&onClose()}><div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-3xl bg-white p-5"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold">{title}</h2><button aria-label="닫기" onClick={onClose} className="rounded-full bg-gray-100 px-3 py-1.5">×</button></div>{children}</div></div>,document.body)}
function CustomerCard({row,onOpen}){return <button onClick={()=>onOpen(row)} className="w-full border-b border-gray-100 py-4 text-left last:border-0"><div className="flex items-center justify-between gap-2"><span className="font-bold break-all">{row.customer_name}</span><span className="shrink-0 rounded-md bg-brand-50 px-2 py-1 text-xs text-brand-700">{row.reaction||row.call_result}</span></div><div className="mt-2 text-xs text-gray-500 break-words">{row.purpose} · {row.call_result} · {time(row.contacted_at)} · {row.employee_name}</div><div className="mt-1 text-xs text-brand-700">{row.visit_at?`${time(row.visit_at)} 방문 약속`:row.follow_up_date?`${row.follow_up_date} 재연락`:'고객 접촉 이력 보기 ›'}</div></button>}
export default function ObActivityPanel({userId,admin=false,employees=[]}){
 const [date,setDate]=useState(koreaDate),[store,setStore]=useState('all'),[rows,setRows]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 const [staff,setStaff]=useState(''),[draft,setDraft]=useState(null),[lookup,setLookup]=useState(null),[saving,setSaving]=useState(false),[formError,setFormError]=useState(''),[customer,setCustomer]=useState(null),[history,setHistory]=useState([]),[historyError,setHistoryError]=useState(''),[historyLoading,setHistoryLoading]=useState(false);
 const saveGuard=useRef(false),request=useRef(''),lookupVersion=useRef(0),historyVersion=useRef(0);
 const stores=[...new Set(employees.map(e=>e.branch).filter(Boolean))].sort();
 const load=useCallback(async()=>{
  if(!userId){setError('로그인 정보를 확인해주세요.');setLoading(false);return;}
  setLoading(true);setError('');
  const result=await readAllPages(()=>{let q=supabase.from('ob_contact_logs').select('*').order('contacted_at',{ascending:false}).order('id',{ascending:false});if(!admin)q=q.eq('user_id',userId);else {q=q.eq('contact_date',date);if(store!=='all')q=q.eq('store_name',store);}return q;});
  if(result.error)throw result.error;return result.data||[];
 },[userId,admin,date,store]);
 useEffect(()=>{let alive=true;load().then(data=>{if(alive&&data){setRows(data);setLoading(false);}}).catch(e=>{if(alive){setError(friendlyError(e));setLoading(false);}});return()=>{alive=false};},[load,revision]);
 useEffect(()=>{setStaff('');},[date,store]);
 const dayRows=rows.filter(r=>r.contact_date===date),shown=staff?dayRows.filter(r=>r.user_id===staff):dayRows;
 const roster=employees.filter(e=>e.active!==false&&(store==='all'||e.branch===store));
 const rosterMap=new Map(roster.map(e=>[e.id,{id:e.id,name:e.name,branch:e.branch}]));
 dayRows.forEach(r=>{if(!rosterMap.has(r.user_id))rosterMap.set(r.user_id,{id:r.user_id,name:r.employee_name,branch:r.store_name});});
 const due=latestObCustomers(rows).filter(r=>r.follow_up_date&&r.follow_up_date<=koreaDate());
 const openForm=(row=null)=>{historyVersion.current++;setCustomer(null);setLookup(row);setFormError('');setDraft(row?{...blank(),subscription_number:row.subscription_number,customer_name:row.customer_name,phone:row.phone}:blank());request.current=crypto.randomUUID();lookupVersion.current++;};
 const change=(key,value)=>{lookupVersion.current++;request.current=crypto.randomUUID();setDraft(d=>({...d,[key]:value,...(key==='call_result'&&value!=='통화 완료'?{reaction:''}:{})}));if(key==='subscription_number')setLookup(null);setFormError('');};
 const findCustomer=async(value)=>{
  const key=subscriptionKey(value);if(!key||saving)return;const version=++lookupVersion.current;
  const {data,error:err}=await supabase.from('ob_contact_logs').select('*').eq('user_id',userId).eq('subscription_number',key).order('contacted_at',{ascending:false}).order('id',{ascending:false}).limit(1);
  if(version!==lookupVersion.current)return;
  if(err){setFormError('기존 고객 확인에 실패했어요. 다시 확인해주세요.');return;}
  const existing=data?.[0];setLookup(existing||null);
  if(existing)setDraft(d=>({...d,subscription_number:key,customer_name:existing.customer_name,phone:existing.phone}));
 };
 const openHistory=async(row)=>{
  const version=++historyVersion.current;setCustomer(row);setHistory([]);setHistoryError('');setHistoryLoading(true);
  try{const result=await readAllPages(()=>{let q=supabase.from('ob_contact_logs').select('*').eq('subscription_number',row.subscription_number).order('contacted_at',{ascending:false}).order('id',{ascending:false});if(!admin)q=q.eq('user_id',userId);else if(store!=='all')q=q.eq('store_name',store);return q;});if(result.error)throw result.error;if(version===historyVersion.current)setHistory(result.data||[]);}catch(e){if(version===historyVersion.current)setHistoryError(friendlyError(e));}finally{if(version===historyVersion.current)setHistoryLoading(false);}
 };
 const save=async(e)=>{
  e.preventDefault();if(saveGuard.current)return;const invalid=validateObDraft(draft);if(invalid){setFormError(invalid);return;}
  const existing=lookup||rows.find(r=>r.subscription_number===subscriptionKey(draft.subscription_number));
  if(existing&&(existing.customer_name!==draft.customer_name.trim()||phoneDigits(existing.phone)!==phoneDigits(draft.phone))){setFormError('같은 가입번호의 기존 고객명·연락처와 달라요. 기존 정보를 확인해주세요.');return;}
  saveGuard.current=true;setSaving(true);setFormError('');
  try{
   const {data,error:err}=await supabase.rpc('append_ob_contact',{p_request_id:request.current,p_customer_name:draft.customer_name.trim(),p_subscription_number:subscriptionKey(draft.subscription_number),p_phone:phoneDigits(draft.phone),p_purpose:draft.purpose,p_call_result:draft.call_result,p_reaction:draft.call_result==='통화 완료'?draft.reaction:null,p_follow_up_date:draft.follow_up_date||null,p_visit_at:draft.visit_at?`${draft.visit_at}:00+09:00`:null,p_memo:draft.memo.trim()});
   if(err)throw err;if(!data)throw new Error('저장 결과를 확인할 수 없어요.');
   setDraft(null);setRevision(v=>v+1);showAppToast('OB 활동을 기록했어요.',{tone:'success'});
  }catch(err){setFormError(friendlyError(err));}finally{saveGuard.current=false;setSaving(false);}
 };
 return <section className="rounded-3xl bg-white p-4 sm:p-6 space-y-4">
  <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold">{admin?'OB 활동 현황':'OB 활동'}</h2><button onClick={()=>setRevision(v=>v+1)} className="text-xs text-brand-700">새로고침</button></div>
  <div className="flex flex-wrap gap-2">{admin&&<select aria-label="OB 매장" value={store} onChange={e=>setStore(e.target.value)} className={`${inputClass} flex-1`}><option value="all">전체 조회 가능 매장</option>{stores.map(s=><option key={s} value={s}>{displayStoreName(s)}</option>)}</select>}<input aria-label="OB 조회 날짜" type="date" value={date} onChange={e=>setDate(e.target.value)} className={`${inputClass} flex-1`}/></div>
  {loading?<p className="text-sm text-gray-500">OB 활동을 불러오는 중…</p>:error?<div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">조회하지 못했어요. {error}<button onClick={()=>setRevision(v=>v+1)} className="ml-2 underline">다시 시도</button></div>:<>
   <Metrics rows={dayRows}/><p className="text-[11px] text-gray-400">모든 결과는 활동으로 기록하고, 통화 완료만 연결로 집계해요.</p>
   {!admin&&<button onClick={()=>openForm()} className="w-full rounded-xl bg-brand-600 py-3 font-bold text-white">＋ OB 활동 기록</button>}
   {admin?<div><h3 className="mb-2 font-bold">직원별 활동</h3><div className="grid grid-cols-[minmax(0,1fr)_repeat(4,2.7rem)] gap-1 text-[11px] text-gray-400"><span>직원</span><span>활동</span><span>연결</span><span>관심</span><span>방문</span></div>{[...rosterMap.values()].map(e=>{const s=obSummary(dayRows.filter(r=>r.user_id===e.id));return <button key={e.id} onClick={()=>setStaff(v=>v===e.id?'':e.id)} aria-pressed={staff===e.id} className={`w-full grid grid-cols-[minmax(0,1fr)_repeat(4,2.7rem)] items-center gap-1 border-b border-gray-100 py-3 text-xs text-left ${staff===e.id?'text-brand-700 bg-brand-50':''}`}><span className="break-words"><b>{e.name}</b><span className="block text-[10px] text-gray-400">{displayStoreName(e.branch)}</span></span>{[s.activity,s.connected,s.interested,s.visits].map((v,i)=><b key={i}>{v}</b>)}</button>})}</div>:<div><h3 className="font-bold">재연락할 고객 <span className="text-brand-700">{due.length}</span></h3>{due.length?due.map(r=><CustomerCard key={r.id} row={r} onOpen={openHistory}/>):<p className="mt-3 text-xs text-gray-400">예정된 재연락이 없어요.</p>}</div>}
   <div><div className="flex items-center justify-between"><h3 className="font-bold">{staff?'선택한 직원의 접촉 내역':'접촉 내역'}</h3>{staff&&<button className="text-xs text-brand-700" onClick={()=>setStaff('')}>전체 직원 보기</button>}</div>{shown.length?shown.map(r=><CustomerCard key={r.id} row={r} onOpen={openHistory}/>):<p className="mt-3 text-xs text-gray-400">선택한 날짜에 기록된 활동이 없어요.</p>}</div>
  </>}
  {draft&&<Modal title="OB 활동 기록" onClose={()=>{if(!saving){lookupVersion.current++;setDraft(null);}}}><form onSubmit={save} className="space-y-3"><fieldset disabled={saving} className="space-y-3"><label className="block text-xs font-semibold">가입번호 · 필수<input required maxLength={60} className={`${inputClass} mt-2`} value={draft.subscription_number} onChange={e=>change('subscription_number',e.target.value)} onBlur={e=>findCustomer(e.target.value)}/></label>{lookup&&<div className="rounded-xl bg-brand-50 p-3 text-xs text-brand-700">기존 고객 정보를 불러왔어요. 새 통화 기록을 추가합니다.</div>}<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{[['customer_name','고객명'],['phone','연락처']].map(([key,label])=><label key={key} className="text-xs font-semibold">{label} · 필수<input type={key==='phone'?'tel':'text'} required maxLength={key==='phone'?24:80} className={`${inputClass} mt-2`} value={draft[key]} onChange={e=>change(key,e.target.value)}/></label>)}</div>
   {[['purpose','OB콜 목적',OB_PURPOSES],['call_result','통화 결과',OB_RESULTS],...(draft.call_result==='통화 완료'?[['reaction','고객 반응',OB_REACTIONS]]:[])].map(([key,label,choices])=><label key={key} className="block text-xs font-semibold">{label}<select aria-label={label} required className={`${inputClass} mt-2`} value={draft[key]} onChange={e=>change(key,e.target.value)}><option value="">선택해주세요</option>{choices.map(v=><option key={v}>{v}</option>)}</select></label>)}
   <label className="block text-xs font-semibold">재연락 날짜 · 선택<input type="date" className={`${inputClass} mt-2`} value={draft.follow_up_date} onChange={e=>change('follow_up_date',e.target.value)}/></label><label className="block text-xs font-semibold">방문 약속 · 선택<input type="datetime-local" className={`${inputClass} mt-2`} value={draft.visit_at} onChange={e=>change('visit_at',e.target.value)}/></label><label className="block text-xs font-semibold">내용 · 선택<textarea rows={3} maxLength={2000} className={`${inputClass} mt-2`} value={draft.memo} onChange={e=>change('memo',e.target.value)} placeholder="고객 반응과 다음에 확인할 내용을 적어주세요"/></label>
  </fieldset>{formError&&<p role="alert" className="text-sm text-red-600">{formError}</p>}<div className="grid grid-cols-2 gap-2"><button type="button" disabled={saving} onClick={()=>{lookupVersion.current++;setDraft(null);}} className="rounded-xl bg-gray-100 py-3">취소</button><button disabled={saving} className="rounded-xl bg-brand-600 py-3 text-white font-bold disabled:opacity-50">{saving?'저장 중…':'기록 저장'}</button></div></form></Modal>}
  {customer&&<Modal title="고객 접촉 히스토리" onClose={()=>{historyVersion.current++;setCustomer(null);}}><h3 className="font-bold text-lg">{customer.customer_name}</h3><p className="mt-2 text-xs text-gray-500 break-all">가입번호 {customer.subscription_number}<br/>연락처 {customer.phone}</p><div className="my-4 flex gap-2">{obTel(customer.phone)&&<a className="flex-1 rounded-xl bg-brand-50 p-3 text-center text-brand-700 font-bold" href={obTel(customer.phone)}>☎ 전화하기</a>}{!admin&&<button className="flex-1 rounded-xl bg-brand-600 p-3 text-white font-bold" onClick={()=>openForm(customer)}>＋ 활동 추가</button>}</div><p className="text-[11px] text-gray-400">전화 화면을 연 뒤 통화 결과를 직접 기록해주세요.</p>{historyLoading?<p className="mt-4">히스토리를 불러오는 중…</p>:historyError?<p role="alert" className="mt-4 text-red-600">히스토리 조회 실패: {historyError}</p>:<div className="mt-5 border-l-2 border-brand-100 pl-4 space-y-5">{history.map(r=><div key={r.id}><b className="text-sm">{time(r.contacted_at)} · {r.employee_name}</b><p className="mt-1 text-xs text-gray-500">{displayStoreName(r.store_name)} · {r.purpose} · {r.call_result}</p>{r.reaction&&<span className="mt-2 inline-block text-xs text-brand-700">{r.reaction}</span>}<p className="mt-2 whitespace-pre-wrap break-words text-sm">{r.memo}</p>{r.follow_up_date&&<p className="mt-1 text-xs">재연락 {r.follow_up_date}</p>}{r.visit_at&&<p className="mt-1 text-xs">방문 {time(r.visit_at)}</p>}</div>)}</div>}</Modal>}
 </section>;
}
