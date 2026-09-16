import React,{useState,useEffect} from 'react';
import {supabase} from '../supabase';
import {CalendarDays,Clock3,House,CalendarClock,ChevronRight} from 'lucide-react';
export default function TodayWorkCard({userId,onNavigate,onGoInput,onOpenApprovals,todayInputDone=false,approvalPending=0,approvalDone=0,approvalError=false}){
  const [state,setState]=useState({loading:true,todayTasks:0,overdue:0,installs:0,unscheduled:0,error:false});
  useEffect(()=>{
    if(!userId){setState({loading:false,error:false,todayTasks:0,overdue:0,installs:0,unscheduled:0});return;}
    setState({loading:true,todayTasks:0,overdue:0,installs:0,unscheduled:0,error:false});
    let alive=true;
    const loadTodayWork=async()=>{
      const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date());
      const [{data:tasks,error:te},{data:homes,error:he}]=await Promise.all([
        supabase.from('customer_tasks').select('id,due_date,status').eq('user_id',userId).neq('status','completed'),
        supabase.from('home_orders').select('id,customer_id,customer_name,planned_install_date,status,source_work_date').eq('user_id',userId).eq('status','pending')
      ]);
      if(!alive)return;
      if(te||he){setState(v=>({...v,loading:false,error:true}));return;}
      // 완료뿐 아니라 고객 거절로 취소된 약속도 오늘·기한경과 집계에서 제외합니다.
      const pending=(tasks||[]).filter(x=>x.status!=='completed'&&x.status!=='cancelled');
      const homeBundles=new Map();
      (homes||[]).forEach(x=>{const key=`${x.source_work_date||''}|${x.customer_id||x.customer_name||x.id}`;if(!homeBundles.has(key))homeBundles.set(key,x)});
      const orders=[...homeBundles.values()];
      setState({loading:false,error:false,todayTasks:pending.filter(x=>x.due_date===today).length,overdue:pending.filter(x=>x.due_date&&x.due_date<today).length,installs:orders.filter(x=>String(x.planned_install_date||'').slice(0,10)===today).length,unscheduled:orders.filter(x=>!x.planned_install_date).length});
    };
    loadTodayWork();
    const refresh=(event)=>{if(!event.detail?.userId||String(event.detail.userId)===String(userId))loadTodayWork();};
    window.addEventListener('customer-tasks-changed',refresh);
    return()=>{alive=false;window.removeEventListener('customer-tasks-changed',refresh)};
  },[userId]);
  const items=[
    ['오늘 고객 약속',state.todayTasks,'today',CalendarDays],['기한 경과',state.overdue,'overdue',Clock3],
    ['오늘 홈 설치',state.installs,'home',House],['일정 미정 홈',state.unscheduled,'home',CalendarClock],
  ];
  return <section aria-label="오늘 할 일" className="surface-card p-5 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold text-ink">오늘 할 일</h2><button onClick={onGoInput} className={`px-2.5 py-1.5 rounded-full text-xs font-bold ${todayInputDone?'bg-emerald-50 text-emerald-700':'bg-gray-50 text-gray-600'}`}>{todayInputDone?'입력 완료':'실적 입력'}</button></div>
    <>{state.error&&<p role="alert" className="mt-2 text-xs text-red-600">업무 현황을 불러오지 못했어요. 고객관리에서 확인해주세요.</p>}</>
    <div className="mt-3">
      {items.map(([label,count,type,Icon])=><button key={label} onClick={()=>onNavigate(type)} className="today-work-row"><Icon size={20} className="text-gray-400 shrink-0" aria-hidden="true"/><span className="work-label">{label}</span><span className="work-count">{state.loading?'·':state.error?'—':count}</span><ChevronRight size={16} className="text-gray-300 shrink-0" aria-hidden="true"/></button>)}
    </div>
    <button onClick={onOpenApprovals} className="w-full mt-3 border-t border-gray-100 px-1 pt-3 flex flex-wrap gap-2 items-center justify-between text-xs"><span className="font-semibold text-gray-600">승인 현황</span><span className="text-gray-500">{approvalError?'조회 실패 · 다시 확인':`대기 ${approvalPending} · 완료 ${approvalDone} ›`}</span></button>
  </section>;
}
