import React,{useState,useEffect,useCallback,useRef} from 'react';
import {supabase} from '../supabase';
import {friendlyError} from '../errorMessages';
import {showAppToast,showLegacyAlert} from '../feedback';
export default function SpecialSalePolicyAdmin({ authUserId, won, fmtInputNumber, notifyEmployee }) {
  const [rows,setRows]=useState([]),[pending,setPending]=useState([]),[form,setForm]=useState({title:'',start_date:'',end_date:'',replacement_amount:'20000',description:''});
  const load=useCallback(async()=>{
    const {data:p,error:policyError}=await supabase.from('special_sale_policies').select('*').order('created_at',{ascending:false});if(policyError){showLegacyAlert(friendlyError(policyError));return;}setRows(p||[]);
    const {data:s,error:saleError}=await supabase.from('customer_sales').select('id,user_id,customer_id,sale_date,metric_label,source_meta').eq('source_type','mobile').eq('source_meta->specialPolicy->>exceptionStatus','pending').order('created_at',{ascending:false}).limit(500);
    if(saleError){showLegacyAlert(friendlyError(saleError));return;}
    const candidates=(s||[]).filter(x=>x.source_meta?.specialPolicy?.exceptionStatus==='pending');
    const uids=[...new Set(candidates.map(x=>x.user_id).filter(Boolean))], cids=[...new Set(candidates.map(x=>x.customer_id).filter(Boolean))];
    let ps=[],cs=[]; if(uids.length){const {data}=await supabase.from('profiles').select('id,name,store_name').in('id',uids);ps=data||[];} if(cids.length){const {data}=await supabase.from('customers').select('id,customer_name').in('id',cids);cs=data||[];}
    const pm=Object.fromEntries(ps.map(x=>[x.id,x])),cm=Object.fromEntries(cs.map(x=>[x.id,x])); setPending(candidates.map(x=>({...x,profiles:pm[x.user_id],customers:cm[x.customer_id]})));
  },[]); useEffect(()=>{load()},[load]);
  const add=async()=>{if(!form.title||!form.start_date||!form.end_date)return showLegacyAlert('정책명과 기간을 입력해주세요.');const {error}=await supabase.from('special_sale_policies').insert({...form,replacement_amount:Number(form.replacement_amount||0),created_by:authUserId});if(error)return showLegacyAlert(friendlyError(error));setForm({title:'',start_date:'',end_date:'',replacement_amount:'20000',description:''});load();};
  const toggle=async(r)=>{const {error}=await supabase.from('special_sale_policies').update({active:!r.active,updated_at:new Date().toISOString()}).eq('id',r.id).select('id').single();if(error)return showLegacyAlert(friendlyError(error));load();};
  const [reviewing,setReviewing]=useState(false);
  const reviewLock=useRef(false);
  const decide=async(sale,approve)=>{
    if(reviewLock.current)return;
    reviewLock.current=true;setReviewing(true);
    try{
      const {data,error}=await supabase.rpc('review_special_sale_atomic',{p_sale_id:sale.id,p_approve:approve});
      if(error)throw error;
      if(!data||typeof data.applied!=='boolean')throw new Error('SALE_REVIEW_MISMATCH');
      if(data.applied){
        await notifyEmployee({actorId:authUserId,recipientId:sale.user_id,type:approve?'special_approved':'special_rejected',title:`특판 예외금액 ${approve?'승인':'처리 완료'}`,message:`${sale.metric_label} · ${won(data.amount)}`,payload:{sale_id:sale.id,status:data.status}});
      }else showAppToast('이미 처리된 신청이에요. 최신 상태로 갱신합니다.',{tone:'info'});
      await load();
    }catch(error){showAppToast(friendlyError(error),{tone:'error',title:'특판 승인 실패'});}
    finally{reviewLock.current=false;setReviewing(false);}
  };

  return <div className="space-y-3"><div className="bg-amber-50 border border-amber-100 rounded-xl p-4"><div className="font-bold text-sm">🏷️ 특판·지인판매 정책</div><div className="text-xs text-gray-500 mt-1">최고관리자만 정책을 만들어요. 실적은 인정하고 요금제/VAS 수수료 대신 대체 인센티브를 적용합니다.</div><div className="grid grid-cols-2 gap-2 mt-3"><input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="정책명" className="border rounded p-2 text-xs"/><input value={fmtInputNumber(form.replacement_amount)} onChange={e=>setForm({...form,replacement_amount:e.target.value.replace(/\D/g,'')})} placeholder="건당 대체 지급금액" className="border rounded p-2 text-xs"/><input type="date" value={form.start_date} onChange={e=>setForm({...form,start_date:e.target.value})} className="border rounded p-2 text-xs"/><input type="date" value={form.end_date} onChange={e=>setForm({...form,end_date:e.target.value})} className="border rounded p-2 text-xs"/></div><input value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="설명 (선택)" className="mt-2 w-full border rounded p-2 text-xs"/><button onClick={add} className="mt-2 w-full bg-amber-500 text-white rounded-lg py-2 text-xs font-bold">정책 추가</button><div className="mt-3 divide-y">{rows.map(r=><div key={r.id} className="py-2 flex justify-between text-xs"><div><b>{r.title}</b> · {won(r.replacement_amount)}<div className="text-[10px] text-gray-400">{r.start_date}~{r.end_date}</div></div><button onClick={()=>toggle(r)} className={r.active?'text-emerald-600':'text-gray-400'}>{r.active?'활성':'비활성'}</button></div>)}</div></div><div className="bg-white border rounded-xl overflow-hidden"><div className="px-4 py-3 border-b font-bold text-sm">예외 지급금액 승인 {pending.length}건</div>{pending.length===0?<div className="py-6 text-center text-xs text-gray-400">승인 대기 예외금액이 없어요.</div>:pending.map(x=><div key={x.id} className="p-3 border-b text-xs"><b>{x.profiles?.name||'직원'} · {x.customers?.customer_name||'고객'}</b><div className="mt-1 text-gray-500">{x.metric_label} · 요청 {won(x.source_meta?.specialPolicy?.exceptionRequestedAmount)}</div><div className="grid grid-cols-2 gap-2 mt-2"><button disabled={reviewing} onClick={()=>decide(x,false)} className="py-2 bg-gray-100 rounded">기본금액 적용</button><button disabled={reviewing} onClick={()=>decide(x,true)} className="py-2 bg-amber-500 text-white rounded font-bold">요청금액 승인</button></div></div>)}</div></div>;
}
