import { useState, useEffect, useCallback } from 'react';

import { supabase } from '../supabase';
import { friendlyError } from '../errorMessages';
import { showAppConfirm, showLegacyAlert } from '../feedback';


import { HOME_ORDER_PRODUCTS, notifyStoreManagers, homeNetworkLabel, normalizeDay, fmtCount, fmtShortDate } from "../appShared";

export default function HomeOrderManager({ userId, month, locked, dailyDays, saveDailyDay, onTeamCreditSaved, onHomeOrdersChanged }) {
  const [orders, setOrders] = useState([]);
  const [product, setProduct] = useState('homeOnly');
  const [customerName, setCustomerName] = useState('');
  const [memo, setMemo] = useState('');
  const [directComplete, setDirectComplete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [homeCompletionTarget, setHomeCompletionTarget] = useState(null);
  const [homeActualCompleteDate, setHomeActualCompleteDate] = useState('');
  // v21.23: 홈 케어 화면에서 설치예정일을 바로 수정
  const [homeScheduleTarget, setHomeScheduleTarget] = useState(null);
  const [homeScheduleDate, setHomeScheduleDate] = useState('');
  const [homeCareActionSaving, setHomeCareActionSaving] = useState(false);
  const [archiveFilter, setArchiveFilter] = useState('completed');
  const [homeBatchTarget, setHomeBatchTarget] = useState(null);
  const [homeBatchSelected, setHomeBatchSelected] = useState([]);

  const load = useCallback(async () => {
    if (!userId) return;
    const start = `${month}-01T00:00:00`;
    const d = new Date(`${month}-01T00:00:00`);
    d.setMonth(d.getMonth() + 1);
    const end = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01T00:00:00`;
    const { data, error } = await supabase.from('home_orders').select('*')
      .eq('user_id', userId).gte('applied_at', start).lt('applied_at', end)
      .order('applied_at', { ascending: false });
    if (!error) setOrders(data || []);
  }, [userId, month]);

  useEffect(() => { load(); }, [load]);


  const changeStatus = async (order, status) => {
    if (locked) return;
    if (status === 'completed') {
      const t = new Date();
      setHomeCompletionTarget(order);
      setHomeActualCompleteDate(`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`);
      return;
    }
    if (!await showAppConfirm({title:'홈 청약을 취소할까요?',message:'취소 건은 실적 요약과 정산 대상에서 제외됩니다.',confirmLabel:'취소 처리',tone:'danger'})) return;
    const { data:result, error } = await supabase.rpc('set_home_orders_status_atomic',{
      p_user_id:userId,p_order_ids:[order.id],p_expected_status:order.status,p_new_status:'cancelled'
    });
    if (error) return showLegacyAlert(`상태 변경 실패: ${friendlyError(error)}`);
    if(Number(result?.updated_count)!==1)return showLegacyAlert('상태 변경 결과를 확인하지 못했어요.');
    const productLabel=HOME_ORDER_PRODUCTS.find(p=>p.key===order.product_type)?.label||order.product_type;
    notifyStoreManagers({actorId:userId,type:'home_cancelled',title:'홈 청약 취소',
      message:`${order.customer_name ? `${order.customer_name} · ` : ''}${homeNetworkLabel(order.network_type)} · ${productLabel}`,
      payload:{order_id:order.id,product_type:order.product_type,network_type:order.network_type,status:'cancelled'}});
    await load(); await onHomeOrdersChanged?.();
  };

  const confirmCompletion = async () => {
    const order=homeCompletionTarget;
    if (!order || !homeActualCompleteDate || locked) return;
    const [y,m,d]=homeActualCompleteDate.split('-');
    const completionMonth=`${y}-${m}`;
    const completionDay=d;
    const completionWorkDate=`${completionMonth}-${completionDay}`;
    let completionDailyRecord=null;

    const {data:supportCredit,error:supportError}=await supabase.from('team_sales_credits').select('id,credited_store').eq('source_type','home').contains('source_refs',JSON.stringify([String(order.id)])).maybeSingle();
    if(supportError)return showLegacyAlert(`지원 판매 조회 실패: ${friendlyError(supportError)}`);
    if (!supportCredit&&order.source_group && order.source_key) {
      if (completionMonth === month) {
        const base=normalizeDay(dailyDays?.[completionDay]);
        const current=Number(base.groups?.[order.source_group]?.[order.source_key]||0);
        const next={...base,groups:{...base.groups,[order.source_group]:{
          ...(base.groups?.[order.source_group]||{}),[order.source_key]:current+1}}};
        completionDailyRecord=next;
      } else {
        const { data: rec, error: loadError } = await supabase
          .from('daily_records')
          .select('data')
          .eq('user_id', userId)
          .eq('work_date', completionWorkDate)
          .maybeSingle();

        if (loadError) {
          return showLegacyAlert(`완료일 실적 불러오기 실패: ${friendlyError(loadError)}`);
        }

        const base = normalizeDay(rec?.data);
        const current = Number(base.groups?.[order.source_group]?.[order.source_key] || 0);
        const next = {
          ...base,
          groups: {
            ...base.groups,
            [order.source_group]: {
              ...(base.groups?.[order.source_group] || {}),
              [order.source_key]: current + 1,
            },
          },
        };

        completionDailyRecord=next;
      }
    }

    const {data:result,error}=await supabase.rpc('set_home_orders_status_atomic',{
      p_user_id:userId,p_order_ids:[order.id],p_expected_status:order.status,p_new_status:'completed',
      p_actual_install_date:homeActualCompleteDate,p_daily_record:completionDailyRecord,p_work_date:completionDailyRecord?completionWorkDate:null
    });
    if(error)return showLegacyAlert(`완료 처리 실패: ${friendlyError(error)}`);
    if(Number(result?.updated_count)!==1)return showLegacyAlert('완료 처리 결과를 확인하지 못했어요.');

    const productLabel=HOME_ORDER_PRODUCTS.find(p=>p.key===order.product_type)?.label||order.product_type;
    notifyStoreManagers({actorId:userId,type:'home_completed',title:'홈 설치/개통 완료',
      message:`${order.customer_name ? `${order.customer_name} · ` : ''}${homeNetworkLabel(order.network_type)} · ${productLabel} · ${homeActualCompleteDate}`,
      storeName:supportCredit?.credited_store||null,
      payload:{order_id:order.id,product_type:order.product_type,network_type:order.network_type,status:'completed',actual_install_date:homeActualCompleteDate,team_only:!!supportCredit}});
    setHomeCompletionTarget(null); setHomeActualCompleteDate(''); await load(); await onHomeOrdersChanged?.();
    if(supportCredit)await onTeamCreditSaved?.();
  };

  const openBatchAction = (group, action) => {
    if (locked || !group?.items?.length) return;
    const t=new Date();
    setHomeBatchTarget({...group,action});
    setHomeBatchSelected(group.items.map(o=>String(o.id)));
    setHomeActualCompleteDate(`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`);
  };

  const confirmBatchAction = async () => {
    const selected=(homeBatchTarget?.items||[]).filter(o=>homeBatchSelected.includes(String(o.id)));
    if(!selected.length || locked) return;
    if(homeBatchTarget.action==='cancelled'){
      if(!await showAppConfirm({title:`선택한 ${selected.length}개 상품을 취소할까요?`,message:'선택하지 않은 상품은 진행중 상태로 유지됩니다.',confirmLabel:'선택 상품 취소',tone:'danger'}))return;
      setHomeCareActionSaving(true);
      try{
        const {data:result,error}=await supabase.rpc('set_home_orders_status_atomic',{
          p_user_id:userId,p_order_ids:selected.map(o=>o.id),p_expected_status:'pending',p_new_status:'cancelled'
        });
        if(error)throw error;
        if(Number(result?.updated_count)!==selected.length)throw new Error('묶음 취소 결과가 요청 수와 다릅니다.');
        selected.forEach(order=>notifyStoreManagers({actorId:userId,type:'home_cancelled',title:'홈 청약 취소',
          message:`${order.customer_name ? `${order.customer_name} · ` : ''}${homeNetworkLabel(order.network_type)} · ${HOME_ORDER_PRODUCTS.find(p=>p.key===order.product_type)?.label||order.product_type}`,
          payload:{order_id:order.id,product_type:order.product_type,network_type:order.network_type,status:'cancelled'}}));
        setHomeBatchTarget(null); setHomeBatchSelected([]); await load(); await onHomeOrdersChanged?.();
      }catch(e){showLegacyAlert(`묶음 취소 실패: ${friendlyError(e)}`);}
      finally{setHomeCareActionSaving(false);}
      return;
    }
    if(!homeActualCompleteDate)return;
    setHomeCareActionSaving(true);
    try{
      const supportById={};
      for(const order of selected){
        const {data,error}=await supabase.from('team_sales_credits').select('id,credited_store').eq('source_type','home').contains('source_refs',JSON.stringify([String(order.id)])).maybeSingle();
        if(error)throw error;
        supportById[String(order.id)]=data||null;
      }
      const [y,m,d]=homeActualCompleteDate.split('-');
      const completionMonth=`${y}-${m}`, completionDay=d, completionWorkDate=`${completionMonth}-${completionDay}`;
      const countable=selected.filter(o=>!supportById[String(o.id)]&&o.source_group&&o.source_key);
      let completionDailyRecord=null;
      if(countable.length){
        let base;
        if(completionMonth===month) base=normalizeDay(dailyDays?.[completionDay]);
        else{
          const {data:rec,error}=await supabase.from('daily_records').select('data').eq('user_id',userId).eq('work_date',completionWorkDate).maybeSingle();
          if(error)throw error;
          base=normalizeDay(rec?.data);
        }
        const groups={...base.groups};
        countable.forEach(order=>{
          groups[order.source_group]={...(groups[order.source_group]||{})};
          groups[order.source_group][order.source_key]=Number(groups[order.source_group][order.source_key]||0)+1;
        });
        const next={...base,groups};
        completionDailyRecord=next;
      }
      const {data:result,error}=await supabase.rpc('set_home_orders_status_atomic',{
        p_user_id:userId,p_order_ids:selected.map(o=>o.id),p_expected_status:'pending',p_new_status:'completed',
        p_actual_install_date:homeActualCompleteDate,p_daily_record:completionDailyRecord,p_work_date:completionDailyRecord?completionWorkDate:null
      });
      if(error)throw error;
      if(Number(result?.updated_count)!==selected.length)throw new Error('묶음 완료 결과가 요청 수와 다릅니다.');
      selected.forEach(order=>notifyStoreManagers({actorId:userId,type:'home_completed',title:'홈 설치/개통 완료',
        message:`${order.customer_name ? `${order.customer_name} · ` : ''}${homeNetworkLabel(order.network_type)} · ${HOME_ORDER_PRODUCTS.find(p=>p.key===order.product_type)?.label||order.product_type} · ${homeActualCompleteDate}`,
        storeName:supportById[String(order.id)]?.credited_store||null,
        payload:{order_id:order.id,product_type:order.product_type,network_type:order.network_type,status:'completed',actual_install_date:homeActualCompleteDate,team_only:!!supportById[String(order.id)]}}));
      setHomeBatchTarget(null); setHomeBatchSelected([]); setHomeActualCompleteDate(''); await load(); await onHomeOrdersChanged?.();
      if(selected.some(o=>supportById[String(o.id)]))await onTeamCreditSaved?.();
    }catch(e){showLegacyAlert(`묶음 완료 처리 실패: ${friendlyError(e)}`);}
    finally{setHomeCareActionSaving(false);}
  };

  const openScheduleEdit = (order) => {
    if (locked) return;
    setHomeScheduleTarget(order);
    setHomeScheduleDate(order.planned_install_date ? String(order.planned_install_date).slice(0,10) : '');
  };

  const saveScheduleEdit = async () => {
    const order=homeScheduleTarget;
    if(!order || locked) return;
    setHomeCareActionSaving(true);
    try{
      // 같은 판매일/고객의 진행중 홈 구성은 한 고객 판매 묶음으로 보고 일정도 같이 변경
      let q=supabase.from('home_orders').update({
        planned_install_date:homeScheduleDate||null,
        updated_at:new Date().toISOString()
      }).eq('user_id',userId).eq('status','pending');

      if(order.customer_id) q=q.eq('customer_id',order.customer_id);
      else q=q.eq('customer_name',order.customer_name||'');

      if(order.source_work_date) q=q.eq('source_work_date',order.source_work_date);
      else q=q.eq('id',order.id);

      const {data,error}=await q.select('id');
      if(error)throw error;
      if(!data?.some(row=>String(row.id)===String(order.id)))throw new Error('HOME_SCHEDULE_MISMATCH');
      setHomeScheduleTarget(null);
      setHomeScheduleDate('');
      await load(); await onHomeOrdersChanged?.();
    }catch(e){
      showLegacyAlert(`설치 예정일 수정 실패: ${friendlyError(e)}`);
    }finally{
      setHomeCareActionSaving(false);
    }
  };

  const decrementCompletedPerformance = async (order) => {
    if(!order?.source_group || !order?.source_key || !order?.actual_install_date) return null;
    const completedDate=String(order.actual_install_date).slice(0,10);
    const completedMonth=completedDate.slice(0,7);
    const completedDay=completedDate.slice(8,10);

    if(completedMonth===month){
      const base=normalizeDay(dailyDays?.[completedDay]);
      const current=Number(base.groups?.[order.source_group]?.[order.source_key]||0);
      const next={...base,groups:{...base.groups,[order.source_group]:{
        ...(base.groups?.[order.source_group]||{}),
        [order.source_key]:Math.max(0,current-1)
      }}};
      return {data:next,workDate:completedDate};
    }

    const {data:rec,error:loadError}=await supabase.from('daily_records')
      .select('data').eq('user_id',userId).eq('work_date',completedDate).maybeSingle();
    if(loadError) throw loadError;
    const base=normalizeDay(rec?.data);
    const current=Number(base.groups?.[order.source_group]?.[order.source_key]||0);
    const next={...base,groups:{...base.groups,[order.source_group]:{
      ...(base.groups?.[order.source_group]||{}),
      [order.source_key]:Math.max(0,current-1)
    }}};
    return {data:next,workDate:completedDate};
  };

  const undoHomeStatus = async (order) => {
    if(locked || !order || !['completed','cancelled'].includes(order.status)) return;
    const isCompleted=order.status==='completed';
    const msg=isCompleted
      ? '완료 처리를 취소하고 다시 진행중으로 돌릴까요?\n완료일에 반영된 확정 실적도 함께 원복됩니다.'
      : '취소 처리를 되돌리고 다시 진행중으로 돌릴까요?';
    if(!await showAppConfirm({title:isCompleted?'완료 처리를 되돌릴까요?':'취소 처리를 되돌릴까요?',message:msg,confirmLabel:'진행중으로 변경'}))return;

    setHomeCareActionSaving(true);
    try{
      const rollback=isCompleted?await decrementCompletedPerformance(order):null;
      const {data:result,error}=await supabase.rpc('set_home_orders_status_atomic',{
        p_user_id:userId,p_order_ids:[order.id],p_expected_status:order.status,p_new_status:'pending',
        p_daily_record:rollback?.data||null,p_work_date:rollback?.workDate||null
      });
      if(error)throw error;
      if(Number(result?.updated_count)!==1)throw new Error('상태 되돌리기 결과를 확인하지 못했어요.');
      await load(); await onHomeOrdersChanged?.();
    }catch(e){
      showLegacyAlert(`상태 되돌리기 실패: ${friendlyError(e)}`);
    }finally{
      setHomeCareActionSaving(false);
    }
  };

  const careInfo = (o) => {
    const p=o.planned_install_date ? String(o.planned_install_date).slice(0,10) : null;
    if(!p)return {rank:3,label:'일정 미정',cls:'text-gray-500 bg-gray-50'};
    const now=new Date(), a=new Date(now.getFullYear(),now.getMonth(),now.getDate()), b=new Date(`${p}T00:00:00`);
    const diff=Math.round((b-a)/86400000);
    if(diff<0)return {rank:0,label:`확인 필요 · ${Math.abs(diff)}일 경과`,cls:'text-red-600 bg-red-50'};
    if(diff===0)return {rank:1,label:'오늘 설치 예정',cls:'text-orange-600 bg-orange-50'};
    return {rank:2,label:`${diff}일 후 설치 예정`,cls:'text-brand-600 bg-brand-50'};
  };

  const pending = orders.filter(o => o.status === 'pending').sort((a,b)=>careInfo(a).rank-careInfo(b).rank || String(a.planned_install_date||'9999').localeCompare(String(b.planned_install_date||'9999')));
  const completed = orders.filter(o => o.status === 'completed');
  const cancelled = orders.filter(o => o.status === 'cancelled');

  return (
    <div className="space-y-3 mb-4">
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="text-xs text-gray-400">이번 달 진행 현황</div>
        <div className="text-sm font-bold text-gray-900 mt-0.5">
          진행중 {fmtCount(pending.length)} · 완료 {fmtCount(completed.length)} · 취소 {fmtCount(cancelled.length)}
        </div>
        {pending.length ? (
          <div className="mt-3 space-y-4">
            {Object.entries(
              pending.reduce((acc, o) => {
                const day = o.source_work_date
                  ? new Date(`${o.source_work_date}T12:00:00`).toLocaleDateString('ko-KR')
                  : new Date(o.applied_at).toLocaleDateString('ko-KR');
                const customer = o.customer_name || '고객명 미입력';
                const key = `${day}__${customer}`;
                if (!acc[key]) acc[key] = { day, customer, items: [] };
                acc[key].items.push(o);
                return acc;
              }, {})
            ).map(([key, group]) => (
              <div key={key}>
                <div className="text-[11px] font-semibold text-gray-400 mb-1.5">{group.day}</div>
                <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="text-sm font-bold text-gray-900">{group.customer} 고객</div>
                    <span className="text-[10px] font-bold text-amber-600">{fmtCount(group.items.length)}개 진행중</span>
                  </div>
                  {group.items.length>1&&<div className="grid grid-cols-2 gap-2 mb-2">
                    <button type="button" disabled={locked||homeCareActionSaving} onClick={()=>openBatchAction(group,'completed')} className="py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold disabled:opacity-50">여러 상품 완료</button>
                    <button type="button" disabled={locked||homeCareActionSaving} onClick={()=>openBatchAction(group,'cancelled')} className="py-2 rounded-lg bg-white border border-gray-200 text-gray-500 text-xs font-semibold disabled:opacity-50">여러 상품 취소</button>
                  </div>}
                  <div className="space-y-2">
                    {group.items.map(o => {
                      const def = HOME_ORDER_PRODUCTS.find(p => p.key === o.product_type);
                      return (
                        <div key={o.id} className="bg-white/80 rounded-lg p-2.5">
                          <div className="flex justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <div className="text-xs font-semibold text-gray-800">{def?.label || o.product_type}</div>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                  o.network_type==='soho'?'bg-blue-50 text-blue-600':
                                  o.network_type==='household'?'bg-brand-50 text-brand-600':'bg-gray-100 text-gray-400'
                                }`}>{homeNetworkLabel(o.network_type)}</span>
                              </div>
                              {o.memo && <div className="text-[11px] text-gray-400 mt-0.5">{o.memo}</div>}
                              <div className="text-[10px] text-gray-400 mt-1">설치예정 {o.planned_install_date ? String(o.planned_install_date).slice(0,10) : '미정'}</div>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${careInfo(o).cls}`}>{careInfo(o).label}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 mt-2">
                            <button type="button" disabled={locked||homeCareActionSaving} onClick={()=>openScheduleEdit(o)}
                              className="py-2 rounded-lg bg-brand-50 border border-brand-100 text-brand-700 text-xs font-semibold disabled:opacity-50">일정 수정</button>
                            <button type="button" disabled={locked||homeCareActionSaving} onClick={()=>changeStatus(o,'completed')}
                              className="py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold disabled:opacity-50">설치/개통 완료</button>
                            <button type="button" disabled={locked||homeCareActionSaving} onClick={()=>changeStatus(o,'cancelled')}
                              className="py-2 rounded-lg bg-white border border-gray-200 text-gray-500 text-xs font-semibold disabled:opacity-50">취소</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : <div className="mt-3 rounded-xl bg-gray-50 py-4 text-center text-xs text-gray-400">현재 케어할 진행중 청약이 없어요.</div>}
        {(completed.length>0 || cancelled.length>0) && (
          <details className="mt-3">
            <summary className="text-xs font-semibold text-brand-600 cursor-pointer">처리된 내역 보기</summary>
            <div className="mt-2 grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1">
              {[['completed',`설치완료 ${fmtCount(completed.length)}건`],['cancelled',`취소 ${fmtCount(cancelled.length)}건`]].map(([key,label])=><button key={key} type="button" onClick={()=>setArchiveFilter(key)} className={`rounded-lg py-2 text-[11px] font-bold ${archiveFilter===key?'bg-white text-brand-700 shadow-sm':'text-gray-500'}`}>{label}</button>)}
            </div>
            <div className="mt-2 space-y-1.5">
              {(archiveFilter==='completed'?completed:cancelled).sort((a,b)=>new Date(b.applied_at)-new Date(a.applied_at)).map(o=>{
                const def=HOME_ORDER_PRODUCTS.find(p=>p.key===o.product_type);
                return <div key={o.id} className="rounded-lg bg-gray-50 px-3 py-2">
                  <div className="flex justify-between gap-2 items-start">
                    <div>
                      <div className="text-xs font-semibold text-gray-700">{o.customer_name ? `${o.customer_name} · ` : ''}{homeNetworkLabel(o.network_type)} · {def?.label || o.product_type}</div>
                      {(o.status==='completed' || o.status==='cancelled')&&<div className="text-[10px] text-gray-400 mt-0.5 leading-none">
                        {o.status==='completed'
                          ? `완료일 ${fmtShortDate(o.actual_install_date || o.completed_at)}`
                          : `취소일 ${fmtShortDate(o.cancelled_at) || '기록 없음'}`}
                      </div>}
                    </div>
                    <span className={`text-[10px] font-bold ${o.status==='completed'?'text-emerald-600':'text-gray-400'}`}>{o.status==='completed'?'완료':'취소'}</span>
                  </div>
                  <div className="flex justify-end mt-2">
                    <button type="button" disabled={locked||homeCareActionSaving} onClick={()=>undoHomeStatus(o)}
                      className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-[10px] font-semibold text-brand-600 disabled:opacity-50">
                      진행중으로 되돌리기
                    </button>
                  </div>
                </div>
              })}
            </div>
          </details>
        )}
      </div>
      <div className="text-[11px] text-gray-400 px-1">
        확정 실적은 실제 설치/개통 완료일 기준으로 반영돼요.
      </div>
      {homeScheduleTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl">
            <div className="text-xs text-brand-600 font-semibold">설치 예정일 수정</div>
            <div className="text-lg font-bold text-gray-900 mt-1">
              {homeScheduleTarget.customer_name || '고객'} · {homeNetworkLabel(homeScheduleTarget.network_type)}
            </div>
            <div className="text-[11px] text-gray-400 mt-1">같은 고객의 같은 판매일 홈 구성 일정이 함께 변경됩니다.</div>
            <label className="block text-xs font-semibold text-gray-500 mt-4 mb-1.5">설치 예정일</label>
            <input type="date" value={homeScheduleDate} onChange={(e)=>setHomeScheduleDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm" />
            <button type="button" onClick={()=>setHomeScheduleDate('')}
              className="mt-2 text-[11px] font-semibold text-gray-400">일정 미정으로 변경</button>
            <div className="grid grid-cols-2 gap-2 mt-5">
              <button onClick={()=>{setHomeScheduleTarget(null);setHomeScheduleDate('');}} disabled={homeCareActionSaving}
                className="py-2.5 rounded-xl bg-gray-100 text-gray-500 text-sm font-semibold disabled:opacity-50">닫기</button>
              <button onClick={saveScheduleEdit} disabled={homeCareActionSaving}
                className="py-2.5 rounded-xl bg-brand-600 text-white text-sm font-bold disabled:opacity-50">
                {homeCareActionSaving?'저장 중...':'일정 저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {homeCompletionTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl">
            <div className="text-xs text-emerald-600 font-semibold">설치/개통 완료</div>
            <div className="text-lg font-bold text-gray-900 mt-1">
              {homeCompletionTarget.customer_name || '고객'} · {homeNetworkLabel(homeCompletionTarget.network_type)} · {HOME_ORDER_PRODUCTS.find(p=>p.key===homeCompletionTarget.product_type)?.label || homeCompletionTarget.product_type}
            </div>
            <label className="block text-xs font-semibold text-gray-500 mt-4 mb-1.5">실제 설치/개통 완료일 *</label>
            <input type="date" value={homeActualCompleteDate} onChange={(e)=>setHomeActualCompleteDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm" />
            <div className="text-[11px] text-gray-400 mt-2">선택한 실제 완료일의 확정 실적으로 반영됩니다.</div>
            <div className="grid grid-cols-2 gap-2 mt-5">
              <button onClick={()=>{setHomeCompletionTarget(null);setHomeActualCompleteDate('');}}
                className="py-2.5 rounded-xl bg-gray-100 text-gray-500 text-sm font-semibold">닫기</button>
              <button onClick={confirmCompletion} disabled={!homeActualCompleteDate}
                className="py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold disabled:opacity-50">완료 처리</button>
            </div>
          </div>
        </div>
      )}

      {homeBatchTarget&&(
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className={`text-xs font-semibold ${homeBatchTarget.action==='completed'?'text-emerald-600':'text-red-500'}`}>여러 상품 {homeBatchTarget.action==='completed'?'설치/개통 완료':'취소'}</div>
            <div className="text-lg font-bold text-gray-900 mt-1">{homeBatchTarget.customer} 고객</div>
            <div className="text-[11px] text-gray-400 mt-1">처리할 상품만 선택하세요. 선택하지 않은 상품은 진행중으로 남습니다.</div>
            <button type="button" onClick={()=>setHomeBatchSelected(homeBatchSelected.length===homeBatchTarget.items.length?[]:homeBatchTarget.items.map(o=>String(o.id)))} className="mt-4 text-xs font-bold text-brand-600">
              {homeBatchSelected.length===homeBatchTarget.items.length?'전체 선택 해제':'전체 선택'}
            </button>
            <div className="mt-2 space-y-2">
              {homeBatchTarget.items.map(o=>{const checked=homeBatchSelected.includes(String(o.id));return <label key={o.id} className={`flex items-center gap-3 rounded-xl border p-3 ${checked?'border-brand-300 bg-brand-50':'border-gray-200 bg-white'}`}><input type="checkbox" checked={checked} onChange={()=>setHomeBatchSelected(a=>checked?a.filter(id=>id!==String(o.id)):[...a,String(o.id)])}/><span className="text-sm font-semibold text-gray-700">{HOME_ORDER_PRODUCTS.find(p=>p.key===o.product_type)?.label||o.product_type}</span></label>})}
            </div>
            {homeBatchTarget.action==='completed'&&<><label className="block text-xs font-semibold text-gray-500 mt-4 mb-1.5">실제 설치/개통 완료일 *</label><input type="date" value={homeActualCompleteDate} onChange={e=>setHomeActualCompleteDate(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm"/></>}
            <div className="grid grid-cols-2 gap-2 mt-5">
              <button type="button" disabled={homeCareActionSaving} onClick={()=>{setHomeBatchTarget(null);setHomeBatchSelected([]);setHomeActualCompleteDate('')}} className="py-2.5 rounded-xl bg-gray-100 text-gray-500 text-sm font-semibold disabled:opacity-50">닫기</button>
              <button type="button" disabled={homeCareActionSaving||!homeBatchSelected.length||(homeBatchTarget.action==='completed'&&!homeActualCompleteDate)} onClick={confirmBatchAction} className={`py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-50 ${homeBatchTarget.action==='completed'?'bg-emerald-600':'bg-red-500'}`}>{homeCareActionSaving?'처리 중...':`선택 ${homeBatchSelected.length}개 처리`}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
