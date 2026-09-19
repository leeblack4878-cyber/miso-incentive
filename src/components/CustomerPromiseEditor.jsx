import {useRef,useState} from 'react';
import {AFFILIATE_CARD_NAMES} from '../appShared';
import {USED_PHONE_METHODS,usedPhoneMeta} from '../customerPromises';
const kinds=[['usedPhone','중고폰 관리'],['offer','오퍼'],['affiliateCard','제휴카드'],['case','케이스'],['custom','기타']];
const inputClass='mt-1 w-full min-w-0 rounded-xl border border-gray-200 px-3 py-2.5 text-sm';
export default function CustomerPromiseEditor({customer,task,today,onSave,onClose,contextLabel}) {
 const [type,setType]=useState(task?.task_type||'usedPhone');
 const [title,setTitle]=useState(task?.title||'');
 const [date,setDate]=useState(task?.due_date||today);
 const [note,setNote]=useState(task?.note||'');
 const [meta,setMeta]=useState(task?.task_meta||{});
 const [error,setError]=useState('');
 const [saving,setSaving]=useState(false);const busy=useRef(false);
 const update=patch=>setMeta(m=>({...m,...patch}));
 const allocations=meta.allocations||[{method:'고객 입금',amount:'',note:''}];
 const save=async(complete)=>{
  if(busy.current)return;setError('');
  try{
   if(!date)throw new Error('예정일을 선택해주세요.');
   if(type==='custom'&&!title.trim())throw new Error('약속 내용을 입력해주세요.');
   let savedMeta=meta;
   if(type==='usedPhone')savedMeta={...meta,...usedPhoneMeta({...meta,allocations},complete||task?.status==='completed')};
   if(type==='affiliateCard'){
    if(!meta.card_name)throw new Error('카드사를 선택해주세요.');
    savedMeta={card_stage:'before_application',approval_completed:false,autopay_registered:false,...meta};
   }
   busy.current=true;setSaving(true);
   const ok=await onSave({task_type:type,title:title.trim()||kinds.find(k=>k[0]===type)?.[1]||task?.title,due_date:date,note:note.trim()||null,task_meta:savedMeta,...(complete?{status:'completed',completed_at:new Date().toISOString()}: {})});
   if(ok)onClose();
  }catch(e){setError(e.message);}finally{busy.current=false;setSaving(false);}
 };
 return <div className="fixed inset-0 z-[120] bg-black/45 flex items-end sm:items-center justify-center" onClick={()=>!saving&&onClose()}><div role="dialog" aria-label="고객 약속 편집" className="w-full max-w-md max-h-[92vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl p-5" onClick={e=>e.stopPropagation()}>
 <h2 className="text-lg font-bold">{customer?.customer_name||'고객'} · {task?'약속 수정':'약속 추가'}</h2>
 {contextLabel&&<div className="mt-2 text-xs text-gray-500 break-words">{contextLabel}</div>}
 {!task&&<div className="flex flex-wrap gap-2 mt-4">{kinds.map(([key,label])=><button type="button" key={key} onClick={()=>{setType(key);setMeta({});}} className={`px-3 py-2 rounded-xl text-xs ${type===key?'bg-brand-600 text-white':'bg-gray-100 text-gray-600'}`}>{label}</button>)}</div>}
 <label className="block text-xs mt-4">약속 내용<input className={inputClass} value={title} onChange={e=>setTitle(e.target.value)} placeholder={kinds.find(k=>k[0]===type)?.[1]||'약속 내용'}/></label>
 <label className="block text-xs mt-3">예정일<input type="date" className={inputClass} value={date} onChange={e=>setDate(e.target.value)}/></label>
 {type==='usedPhone'&&<div className="mt-4 space-y-3">
 <div className="grid grid-cols-2 gap-2">{[['expected_amount','예상금액'],['actual_amount','실제금액']].map(([key,label])=><label key={key} className="text-xs">{label}<input inputMode="numeric" className={inputClass} value={meta[key]??''} onChange={e=>update({[key]:e.target.value.replace(/\D/g,'')})} placeholder="원"/></label>)}</div>
 {meta.actual_amount!=null&&meta.actual_amount!==''&&meta.expected_amount!=null&&meta.expected_amount!==''&&<div className="text-xs text-brand-700">예상 대비 차액 {(Number(meta.actual_amount)-Number(meta.expected_amount)).toLocaleString()}원</div>}
 <div className="text-xs font-bold">처리 방식별 금액</div>
 {allocations.map((r,i)=><div key={i} className="rounded-xl bg-gray-50 p-3 space-y-2">
 <select aria-label={`처리 방식 ${i+1}`} className={inputClass} value={r.method} onChange={e=>update({allocations:allocations.map((v,j)=>i===j?{...v,method:e.target.value}:v)})}>{USED_PHONE_METHODS.map(m=><option key={m}>{m}</option>)}</select>
 <input aria-label={`처리 금액 ${i+1}`} inputMode="numeric" placeholder="처리 금액 (원)" className={inputClass} value={r.amount} onChange={e=>update({allocations:allocations.map((v,j)=>i===j?{...v,amount:e.target.value.replace(/\D/g,'')}:v)})}/>
 {r.method==='기타'&&<input aria-label="기타 처리 내용" className={inputClass} placeholder="기타 처리 내용" value={r.note||''} onChange={e=>update({allocations:allocations.map((v,j)=>i===j?{...v,note:e.target.value}:v)})}/>}
 {allocations.length>1&&<button type="button" className="text-xs text-red-500" onClick={()=>update({allocations:allocations.filter((_,j)=>j!==i)})}>처리 항목 삭제</button>}</div>)}
 <button type="button" className="text-xs font-bold text-brand-600" onClick={()=>update({allocations:[...allocations,{method:'고객 입금',amount:'',note:''}]})}>+ 처리 방식 추가</button>
 <div className="text-xs text-gray-600">배분 합계 {allocations.reduce((s,r)=>s+Number(r.amount||0),0).toLocaleString()}원 / 실제금액 {meta.actual_amount==null||meta.actual_amount===''?'미입력':`${Number(meta.actual_amount).toLocaleString()}원`}</div>
 <label className="block text-xs">처리 완료일<input type="date" className={inputClass} value={meta.processed_date||''} onChange={e=>update({processed_date:e.target.value})}/></label>
 <div className="text-[11px] text-gray-500">완료 처리한 건만 처리 완료일의 월 총액에 반영돼요.</div>
 </div>}
 {type==='affiliateCard'&&<div className="mt-3"><label className="text-xs">카드사<select className={inputClass} value={meta.card_name||''} onChange={e=>update({card_name:e.target.value})}><option value="">선택해주세요</option>{AFFILIATE_CARD_NAMES.map(n=><option key={n}>{n}</option>)}</select></label><label className="flex gap-2 mt-3 text-xs"><input type="checkbox" checked={!!meta.approval_required} onChange={e=>update({approval_required:e.target.checked})}/>카드 수령 후 별도 승인 필요</label></div>}
 <label className="block text-xs mt-3">메모<input className={inputClass} value={note} onChange={e=>setNote(e.target.value)}/></label>
 {error&&<div role="alert" className="text-xs text-red-600 mt-3">{error}</div>}
 <div className="flex flex-wrap gap-2 mt-5"><button disabled={saving} onClick={onClose} className="flex-1 py-3 rounded-xl bg-gray-100 text-sm">취소</button><button disabled={saving} onClick={()=>save(false)} className="flex-1 py-3 rounded-xl bg-brand-600 text-white text-sm font-bold">저장</button>{type==='usedPhone'&&task?.status!=='completed'&&<button disabled={saving} onClick={()=>save(true)} className="w-full py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold">저장 후 처리완료</button>}</div>
 </div></div>;
}
