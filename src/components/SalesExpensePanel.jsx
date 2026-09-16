import React,{useState,useEffect,useCallback} from 'react';
import {Trash2} from 'lucide-react';
import {supabase} from '../supabase';
import {friendlyError} from '../errorMessages';
import {showAppToast,showAppConfirm} from '../feedback';
import {deleteExpense} from '../saleMutations';
export default function SalesExpensePanel({ userId, month, onTotal, won, fmtInputNumber }) {
  const [items,setItems]=useState([]), [open,setOpen]=useState(false);
  const [form,setForm]=useState({amount:'',category:'케이스',customer_name:'',expense_date:`${month}-01`,memo:''});
  const load=useCallback(async()=>{
    if(!userId)return;
    const {data,error}=await supabase.from('sales_expenses').select('*').eq('user_id',userId).gte('expense_date',`${month}-01`).lt('expense_date',(()=>{const [y,m]=month.split('-').map(Number);const d=new Date(y,m,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`})()).order('expense_date',{ascending:false});
    if(error){showAppToast(friendlyError(error),{tone:'error',title:'비용 조회 실패'});return;}
    const rows=data||[];setItems(rows);onTotal?.(rows.reduce((s,x)=>s+Number(x.amount||0),0));
  },[userId,month,onTotal]);
  useEffect(()=>{load()},[load]);
  useEffect(()=>setForm(f=>({...f,expense_date:`${month}-${String(new Date().getDate()).padStart(2,'0')}`})),[month]);
  const add=async()=>{
    const amount=Number(form.amount); if(!amount||amount<=0)return showAppToast('비용 금액을 입력해주세요.',{tone:'error'});
    const {error}=await supabase.from('sales_expenses').insert({...form,amount,user_id:userId,customer_name:form.customer_name.trim()||null,memo:form.memo.trim()||null});
    if(error)return showAppToast(friendlyError(error),{tone:'error',title:'비용 등록 실패'});
    setForm(f=>({...f,amount:'',customer_name:'',memo:''}));load();
  };
  const remove=async(id)=>{if(!await showAppConfirm({title:'영업비용을 삭제할까요?',message:'삭제하면 이번 달 비용 합계에서도 즉시 빠집니다.',confirmLabel:'비용 삭제',tone:'danger'}))return;try{await deleteExpense(supabase,id,userId);showAppToast('영업비용을 삭제했어요.');await load();}catch(error){showAppToast(friendlyError(error),{tone:'error',title:'비용 삭제 실패'});}};
  const total=items.reduce((s,x)=>s+Number(x.amount||0),0);
  return <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
    <button onClick={()=>setOpen(v=>!v)} className="w-full p-4 flex justify-between items-center text-left">
      <div><div className="text-sm font-bold text-gray-800">💳 영업비용</div><div className="text-xs text-gray-400 mt-0.5">이번 달 {won(total)} · 고객명은 선택</div></div>
      <span className="text-xs text-violet-600">{open?'접기':'등록/내역'}</span>
    </button>
    {open&&<div className="px-4 pb-4 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <input type="date" value={form.expense_date} onChange={e=>setForm({...form,expense_date:e.target.value})} className="border rounded-lg px-2 py-2 text-xs"/>
        <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} className="border rounded-lg px-2 py-2 text-xs"><option>케이스</option><option>오퍼</option><option>고객 사은품</option><option>판촉</option><option>기타</option></select>
        <input inputMode="numeric" placeholder="금액" value={fmtInputNumber(form.amount)} onChange={e=>setForm({...form,amount:e.target.value.replace(/\D/g,'')})} className="border rounded-lg px-2 py-2 text-xs"/>
        <input placeholder="고객명 (선택)" value={form.customer_name} onChange={e=>setForm({...form,customer_name:e.target.value})} className="border rounded-lg px-2 py-2 text-xs"/>
      </div>
      <input placeholder="메모 (선택)" value={form.memo} onChange={e=>setForm({...form,memo:e.target.value})} className="w-full border rounded-lg px-2 py-2 text-xs"/>
      <button onClick={add} className="w-full py-2 rounded-lg bg-violet-600 text-white text-xs font-bold">비용 등록</button>
      <div className="divide-y">
        {items.slice(0,20).map(x=><div key={x.id} className="py-2 flex justify-between gap-2 text-xs"><div><b>{x.category}</b> · {x.customer_name||'일반'}<div className="text-[10px] text-gray-400">{x.expense_date}{x.memo?` · ${x.memo}`:''}</div></div><div className="flex items-center gap-2"><b>{won(x.amount)}</b><button onClick={()=>remove(x.id)} className="text-gray-300">삭제</button></div></div>)}
      </div>
    </div>}
  </div>;
}
