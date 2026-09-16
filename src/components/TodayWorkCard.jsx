import React,{useState,useEffect} from 'react';
import {supabase} from '../supabase';
export default function TodayWorkCard({userId,onNavigate,onGoInput,onOpenApprovals,todayInputDone=false,approvalPending=0,approvalDone=0}){
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
    ['오늘 고객 약속',state.todayTasks,'today'],['기한 경과',state.overdue,'overdue'],
    ['오늘 홈 설치',state.installs,'home'],['일정 미정 홈',state.unscheduled,'home'],
  ];
  return <div className="bg-white rounded-2xl border border-gray-100 p-4">
    <div className="flex items-center justify-between"><div><div className="text-xs font-bold text-violet-600">오늘 할 일</div><div className="text-sm font-bold text-gray-900 mt-0.5">먼저 확인할 업무</div></div><button onClick={onGoInput} className={`px-2.5 py-1.5 rounded-full text-xs font-bold ${todayInputDone?'bg-emerald-50 text-emerald-700':'bg-amber-50 text-amber-700'}`}>{todayInputDone?'오늘 실적 입력 완료':'오늘 실적 미입력'}</button></div>
    <>{state.error&&<p role="alert" className="mt-2 text-xs text-red-600">업무 현황을 불러오지 못했어요. 고객관리에서 확인해주세요.</p>}</>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-3 text-center">
      {items.map(([label,count,type])=><button key={label} onClick={()=>onNavigate(type)} className={`rounded-xl px-1 py-2.5 ${Number(count)>0?'bg-violet-50':'bg-gray-50'}`}><div className={`text-lg font-black ${Number(count)>0?'text-violet-700':'text-gray-300'}`}>{state.loading?'·':state.error?'—':count}</div><div className="text-xs text-gray-500 mt-0.5 leading-tight">{label} ›</div></button>)}
    </div>
    <button onClick={onOpenApprovals} className="w-full mt-2 rounded-xl bg-amber-50 px-3 py-2.5 flex items-center justify-between text-[11px]"><span className="font-semibold text-amber-800">승인 현황</span><span className="text-amber-700">대기 {approvalPending} · 완료 {approvalDone} ›</span></button>
    {!todayInputDone&&<button onClick={onGoInput} className="w-full mt-2 rounded-xl bg-red-50 px-3 py-2.5 flex items-center justify-between text-[11px] text-red-700"><b>마감 전 확인할 누락</b><span>오늘 실적 미입력 ›</span></button>}
  </div>;
}
