import { useState, useEffect, useCallback } from 'react';

import { supabase } from '../supabase';
import { friendlyError } from '../errorMessages';
import { showAppToast, showAppConfirm } from '../feedback';


import { monthKeyOf, addDaysDate, careTaskCategory, AFFILIATE_CARD_STAGES } from "../appShared";
import HomeOrderManager from "./HomeOrderManager";

export default function CustomerCareManager({ userId, month, homeProps, navIntent }) {
  const [tasks,setTasks]=useState([]);
  const [customers,setCustomers]=useState([]);
  const [filter,setFilter]=useState('todo');
  const [query,setQuery]=useState('');
  const [loading,setLoading]=useState(true);
  const [rescheduleTask,setRescheduleTask]=useState(null);
  const [rescheduleDate,setRescheduleDate]=useState('');

  const load=useCallback(async()=>{
    if(!userId)return;
    setLoading(true);
    const [{data:t,error:te},{data:c,error:ce}]=await Promise.all([
      supabase.from('customer_tasks').select('*').eq('user_id',userId).order('due_date',{ascending:true}),
      supabase.from('customers').select('*').eq('user_id',userId).order('last_sale_date',{ascending:false})
    ]);
    setLoading(false);
    if(te||ce)return showAppToast(friendlyError(te||ce),{tone:'error',title:'고객 약속 조회 실패'});
    setTasks(t||[]);setCustomers(c||[]);
  },[userId]);

  useEffect(()=>{load()},[load]);
  useEffect(()=>{
    if(!navIntent?.type)return;
    if(navIntent.type==='today')setFilter('today');
    if(navIntent.type==='overdue')setFilter('overdue');
    if(navIntent.type==='all')setFilter('all');
    if(navIntent.type==='home')setTimeout(()=>document.getElementById('employee-home-care')?.scrollIntoView({behavior:'smooth',block:'start'}),80);
  },[navIntent]);

  const scheduleNow=new Date();
  const today=`${monthKeyOf(scheduleNow)}-${String(scheduleNow.getDate()).padStart(2,'0')}`;
  const visibleUntil=addDaysDate(today,7);
  const customerMap=Object.fromEntries(customers.map(c=>[c.id,c]));
  const pending=tasks.filter(t=>t.status!=='completed'&&t.status!=='cancelled');
  const overdue=pending.filter(t=>t.due_date<today);
  const todayTasks=pending.filter(t=>t.due_date===today);
  const next7=pending.filter(t=>t.due_date>=today&&t.due_date<=visibleUntil);
  const allFuture=pending.filter(t=>t.due_date>today);

  const updateTask=async(t,patch)=>{
    const {data,error}=await supabase.from('customer_tasks')
      .update({...patch,updated_at:new Date().toISOString()})
      .eq('id',t.id).eq('user_id',userId).eq('updated_at',t.updated_at).select('id');
    if(!error&&data?.length!==1)return showAppToast('다른 화면에서 변경됐거나 수정 권한이 없어요. 새로고침 후 확인해주세요.',{tone:'error'});
    if(error)return showAppToast(friendlyError(error),{tone:'error',title:'고객 약속 수정 실패'});
    await load();
    window.dispatchEvent(new CustomEvent('customer-tasks-changed',{detail:{userId}}));
  };

  const updateAffiliateCard=async(t,metaPatch)=>{
    await updateTask(t,{task_meta:{...(t.task_meta||{}),...metaPatch}});
  };

  const finishAffiliateCard=async(t)=>{
    const meta=t.task_meta||{};
    if(meta.card_stage!=='received_not_visited')return showAppToast('먼저 카드 수령 단계를 완료해주세요.',{tone:'error'});
    if(meta.approval_required&&!meta.approval_completed)return showAppToast('카드 승인 여부를 먼저 확인해주세요.',{tone:'error'});
    if(!meta.autopay_registered)return showAppToast('통신요금 자동이체 등록을 먼저 확인해주세요.',{tone:'error'});
    await complete(t);
  };

  const rollbackAffiliateCard=async(t)=>{
    const meta=t.task_meta||{};
    let patch=null,label='';
    if(meta.autopay_registered){patch={autopay_registered:false};label='자동이체 등록';}
    else if(meta.approval_completed){patch={approval_completed:false};label='카드 승인 확인';}
    else if(meta.card_stage==='received_not_visited'){patch={card_stage:'applied_unreceived'};label='카드 수령 완료';}
    else if(meta.card_stage==='applied_unreceived'){patch={card_stage:'before_application'};label='카드 신청 완료';}
    if(!patch)return showAppToast('되돌릴 진행 단계가 없어요.');
    if(!await showAppConfirm({title:'이전 단계로 되돌릴까요?',message:`${label} 처리를 취소합니다.`,confirmLabel:'되돌리기',tone:'warning'}))return;
    await updateAffiliateCard(t,patch);
  };

  const complete=async(t)=>{
    const name=customerMap[t.customer_id]?.customer_name||'고객';
    if(!await showAppConfirm({title:'고객 약속을 완료할까요?',message:`${name} · ${t.title}\n완료 내역에서 다시 되돌릴 수 있어요.`,confirmLabel:'완료 처리'}))return;
    await updateTask(t,{status:'completed',completed_at:new Date().toISOString()});
  };

  const undoComplete=async(t)=>{
    if(!await showAppConfirm({title:'다시 할 일로 돌릴까요?',message:'완료 표시가 취소되고 고객 약속 목록에 다시 나타납니다.',confirmLabel:'되돌리기'}))return;
    await updateTask(t,{status:'pending',completed_at:null});
  };

  const cancelAffiliateCard=async(t)=>{
    const name=customerMap[t.customer_id]?.customer_name||'고객';
    if(!await showAppConfirm({title:'제휴카드 약속을 취소할까요?',message:`${name} 고객이 카드 진행을 원하지 않는 경우 취소해주세요.\n기록은 완료·취소 내역에 남습니다.`,confirmLabel:'고객 거절로 취소',tone:'warning'}))return;
    await updateTask(t,{status:'cancelled',completed_at:null,task_meta:{...(t.task_meta||{}),cancel_reason:'고객 거절',cancelled_at:new Date().toISOString()}});
  };

  const resumeCancelledCard=async(t)=>{
    const meta={...(t.task_meta||{})};delete meta.cancel_reason;delete meta.cancelled_at;
    await updateTask(t,{status:'pending',completed_at:null,task_meta:meta});
  };

  const visible=tasks.filter(t=>{
    const isPending=t.status!=='completed'&&t.status!=='cancelled';
    if(filter==='todo' && !(isPending && t.due_date<=visibleUntil)) return false;
    if(filter==='today' && !(isPending && t.due_date===today)) return false;
    if(filter==='overdue' && !(isPending && t.due_date<today)) return false;
    if(filter==='all' && !isPending) return false;
    if(filter==='done' && !['completed','cancelled'].includes(t.status)) return false;
    const name=customerMap[t.customer_id]?.customer_name||'';
    return !query.trim()||name.includes(query.trim())||String(t.title||'').includes(query.trim());
  }).sort((a,b)=>{
    if(filter==='done') return String(b.completed_at||b.updated_at||'').localeCompare(String(a.completed_at||a.updated_at||''));
    const ao=a.due_date<today?0:a.due_date===today?1:2;
    const bo=b.due_date<today?0:b.due_date===today?1:2;
    return ao-bo || String(a.due_date).localeCompare(String(b.due_date));
  });

  const dLabel=(date)=>{
    const a=new Date(`${today}T00:00:00`),b=new Date(`${date}T00:00:00`);
    const d=Math.round((b-a)/86400000);
    return d===0?'오늘':d>0?`D-${d}`:`${Math.abs(d)}일 지남`;
  };

  return <div className="space-y-4">
    <div className="grid grid-cols-3 gap-2">
      {[['오늘',todayTasks.length],['기한 경과',overdue.length],['7일 내',next7.length]].map(([l,v])=>
        <div key={l} className="bg-white rounded-xl border border-gray-100 p-3 text-center">
          <div className={`text-lg font-bold ${l==='기한 경과'&&v>0?'text-red-600':'text-gray-900'}`}>{v}</div>
          <div className="text-[10px] text-gray-400">{l}</div>
        </div>)}
    </div>

    <div className="bg-white rounded-xl border border-gray-100 p-3">
      <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="고객명 또는 약속 검색"
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"/>
      <div className="grid grid-cols-5 gap-1 mt-2">
        {[['todo','할 일'],['today','오늘'],['overdue','경과'],['all','전체 예정'],['done','완료·취소']].map(([k,l])=>
          <button key={k} onClick={()=>setFilter(k)}
            className={`py-2 rounded-lg text-[11px] font-semibold ${filter===k?'bg-brand-600 text-white':'bg-gray-50 text-gray-500'}`}>{l}</button>)}
      </div>
      {filter==='todo'&&<div className="text-[10px] text-gray-400 mt-2">할 일에는 오늘부터 7일 이내와 기한이 지난 약속만 보여요.</div>}
    </div>

    <div id="employee-home-care" className="bg-white rounded-xl border border-gray-100 overflow-hidden scroll-mt-28">
      <div className="px-4 py-3 border-b border-gray-50">
        <div className="font-bold text-sm">고객 약속</div>

      </div>
      {loading?<div className="py-8 text-center text-xs text-gray-400">불러오는 중...</div>:
       visible.length===0?<div className="py-8 text-center text-xs text-gray-400">해당하는 고객 약속이 없어요.</div>:
       <div className="divide-y divide-gray-50">
         {visible.map(t=>{
           const c=customerMap[t.customer_id], isOver=t.status!=='completed'&&t.due_date<today;
           const card=t.task_type==='affiliateCard'?t.task_meta||{}:null,category=careTaskCategory(t);
           return <div key={t.id} className="p-4">
             <div className="flex justify-between gap-3">
               <div className="min-w-0">
                 <div className="flex items-center gap-1.5 flex-wrap"><span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-600">{category}</span><span className="text-sm font-bold text-gray-900">{c?.customer_name||'고객'} · {t.title}</span></div>
                 <div className="text-[11px] text-gray-400 mt-1">
                   {t.retention_days?`${t.retention_days}일 유지 → ${t.retention_days===93?'94':'184'}일째 변경 가능 · `:''}{t.due_date}
                 </div>
                 {t.target_plan&&<div className="text-xs text-brand-700 mt-1">변경 예정 요금제 · <b>{t.target_plan}</b></div>}
                 {card&&<div className="mt-2 rounded-xl border border-blue-100 bg-blue-50/50 p-3">
                   <div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-blue-800">{card.card_name||'카드명 미입력'}</span><span className="text-[10px] font-bold text-blue-600">{t.status==='completed'?'최종 완료':AFFILIATE_CARD_STAGES[card.card_stage]||'신청 전'}</span></div>
                   <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px]">
                     <div className={`rounded-lg px-2 py-1.5 ${card.approval_required?(card.approval_completed?'bg-emerald-100 text-emerald-700':'bg-white text-gray-500'):'bg-gray-100 text-gray-400'}`}>승인 · {card.approval_required?(card.approval_completed?'완료':'확인 필요'):'해당 없음'}</div>
                     <div className={`rounded-lg px-2 py-1.5 ${card.autopay_registered?'bg-emerald-100 text-emerald-700':'bg-white text-gray-500'}`}>자동이체 · {card.autopay_registered?'등록 완료':'미등록'}</div>
                   </div>
                 </div>}
                 {t.note&&<div className="text-xs text-gray-500 mt-1">{t.note}</div>}
               </div>
               <div className="shrink-0 flex items-center gap-1.5">{card&&t.status!=='completed'&&t.status!=='cancelled'&&<button onClick={()=>cancelAffiliateCard(t)} className="text-[10px] font-semibold text-red-400 px-1.5 py-1">약속 취소</button>}<span className={`text-[10px] font-bold px-2 py-1 rounded-full h-fit ${
                 t.status==='completed'?'bg-emerald-50 text-emerald-600':t.status==='cancelled'?'bg-gray-100 text-gray-500':isOver?'bg-red-50 text-red-600':t.due_date===today?'bg-orange-50 text-orange-600':'bg-brand-50 text-brand-600'
               }`}>{t.status==='completed'?'완료':t.status==='cancelled'?'고객 거절':dLabel(t.due_date)}</span></div>
             </div>

             {t.status==='cancelled'?(
               <button onClick={()=>resumeCancelledCard(t)} className="mt-3 w-full py-2 rounded-lg bg-brand-50 text-brand-700 text-xs font-semibold">다시 진행</button>
             ):t.status==='completed'?(
               <button onClick={()=>undoComplete(t)} className="mt-3 w-full py-2 rounded-lg bg-gray-50 text-gray-600 text-xs font-semibold">
                 완료 취소
               </button>
             ):card?(
               <div className="mt-3 space-y-1.5">
                 {(()=>{const applied=card.card_stage==='applied_unreceived'||card.card_stage==='received_not_visited',received=card.card_stage==='received_not_visited',ready=received&&(!card.approval_required||card.approval_completed)&&card.autopay_registered;return <>
                   <div className="grid grid-cols-2 gap-1.5">
                     <button disabled={applied} onClick={()=>updateAffiliateCard(t,{card_stage:'applied_unreceived'})} className={`py-2.5 rounded-lg text-xs font-bold ${applied?'bg-emerald-100 text-emerald-700':'bg-blue-600 text-white'}`}>{applied?'✓ 신청 완료':'신청 완료'}</button>
                     <button disabled={!applied||received} onClick={()=>updateAffiliateCard(t,{card_stage:'received_not_visited'})} className={`py-2.5 rounded-lg text-xs font-bold ${received?'bg-emerald-100 text-emerald-700':applied?'bg-blue-600 text-white':'bg-gray-100 text-gray-300'}`}>{received?'✓ 수령 완료':'수령 완료'}</button>
                     <button disabled={!card.approval_required||!received||card.approval_completed} onClick={()=>updateAffiliateCard(t,{approval_completed:true})} className={`py-2.5 rounded-lg text-xs font-bold ${!card.approval_required?'bg-gray-100 text-gray-400':card.approval_completed?'bg-emerald-100 text-emerald-700':received?'bg-brand-600 text-white':'bg-gray-100 text-gray-300'}`}>{!card.approval_required?'승인 해당 없음':card.approval_completed?'✓ 승인 확인':'승인 확인'}</button>
                     <button disabled={!received||card.autopay_registered} onClick={()=>updateAffiliateCard(t,{autopay_registered:true})} className={`py-2.5 rounded-lg text-xs font-bold ${card.autopay_registered?'bg-emerald-100 text-emerald-700':received?'bg-sky-600 text-white':'bg-gray-100 text-gray-300'}`}>{card.autopay_registered?'✓ 자동이체 등록':'자동이체 등록'}</button>
                   </div>
                   <button disabled={!ready} onClick={()=>finishAffiliateCard(t)} className={`w-full py-2.5 rounded-lg text-xs font-bold ${ready?'bg-emerald-600 text-white':'bg-gray-100 text-gray-300'}`}>최종 약속 완료</button>
                   {(applied||card.approval_completed||card.autopay_registered)&&<button onClick={()=>rollbackAffiliateCard(t)} className="w-full py-2 rounded-lg border border-gray-200 text-gray-500 text-xs font-semibold">↶ 이전 단계 되돌리기</button>}
                 </>})()}
                 <div className="grid grid-cols-2 gap-1.5">
                   <button onClick={()=>updateTask(t,{status:'pending',due_date:addDaysDate(today,1)})} className="py-2 rounded-lg bg-gray-50 text-gray-600 text-xs font-semibold">내일 다시</button>
                   <button onClick={()=>{setRescheduleTask(t);setRescheduleDate(t.due_date||today)}} className="py-2 rounded-lg bg-gray-50 text-gray-600 text-xs font-semibold">일정변경</button>
                 </div>
               </div>
             ):(
               <div className="grid grid-cols-3 gap-1.5 mt-3">
                 <button onClick={()=>complete(t)} className="py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold">처리완료</button>
                 <button onClick={()=>updateTask(t,{status:'pending',due_date:addDaysDate(today,1)})} className="py-2 rounded-lg bg-gray-50 text-gray-600 text-xs font-semibold">내일 다시</button>
                 <button onClick={()=>{setRescheduleTask(t);setRescheduleDate(t.due_date||today)}} className="py-2 rounded-lg bg-gray-50 text-gray-600 text-xs font-semibold">일정변경</button>
               </div>
             )}
           </div>
         })}
       </div>}
    </div>

    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-50">
        <div className="text-sm font-semibold text-gray-800">홈 설치·개통</div>

      </div>
      <div><HomeOrderManager {...homeProps}/></div>
    </div>
    {rescheduleTask&&<div className="fixed inset-0 z-[110] bg-black/45 flex items-end sm:items-center justify-center" onClick={()=>setRescheduleTask(null)}><div className="w-full max-w-sm bg-white rounded-t-3xl sm:rounded-3xl p-5" onClick={e=>e.stopPropagation()}><div className="text-lg font-bold text-gray-900">약속 날짜를 변경할까요?</div><div className="text-xs text-gray-500 mt-1">고객에게 다시 연락할 날짜를 선택해주세요.</div><input type="date" value={rescheduleDate} onChange={e=>setRescheduleDate(e.target.value)} className="mt-4 w-full border border-gray-200 rounded-xl px-3 py-3 text-sm"/><div className="grid grid-cols-2 gap-2 mt-4"><button onClick={()=>setRescheduleTask(null)} className="py-3 rounded-xl bg-gray-100 text-gray-600 text-sm font-bold">취소</button><button onClick={async()=>{if(!rescheduleDate)return showAppToast('변경할 날짜를 선택해주세요.',{tone:'error'});await updateTask(rescheduleTask,{status:'pending',due_date:rescheduleDate});setRescheduleTask(null)}} className="py-3 rounded-xl bg-brand-600 text-white text-sm font-bold">날짜 변경</button></div></div></div>}
  </div>;
}
