import {useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
export const PLAN_REMINDER_LABELS={93:'3개월 뒤 (93일)',183:'6개월 뒤 (183일)',both:'둘 다 (93일·183일)',keep:'유지'};
export default function PlanReminderDialog({value,onSelect,onClose,service=null}) {
 const ref=useRef(null);
 const labels=service?{93:service.insurance?'93일 뒤 유지·해지 확인':'93일 뒤 삭제 안내',keep:'유지'}:PLAN_REMINDER_LABELS;
 useEffect(()=>{const dialog=ref.current;dialog.showModal();return()=>dialog.close();},[]);
 return createPortal(<dialog ref={ref} aria-label={service?'부가서비스 삭제 안내':'요금제 변경 안내'} onCancel={onClose} className="rounded-3xl p-5 max-w-sm backdrop:bg-black/40" style={{width:'calc(100% - 2rem)'}}>
 <h2 className="text-lg font-bold text-gray-900">{service?(service.insurance?'보험 유지·해지를 확인할까요?':'부가서비스 삭제를 안내할까요?'):'요금제 변경을 언제 안내할까요?'}</h2>
 {service&&<p className="mt-2 text-sm font-semibold text-brand-700">{service.label}</p>}
 <p className="mt-2 text-xs text-gray-500">개통일 기준으로 약속이 자동 등록돼요.</p>
 <div className="mt-4 grid grid-cols-2 gap-2">{Object.entries(labels).map(([key,label])=><button key={key} type="button" autoFocus={key===value} aria-pressed={key===value} onClick={()=>onSelect(key)} className={`py-4 px-2 rounded-xl border text-xs font-bold ${key===value?'bg-brand-50 border-brand-300 text-brand-700':'border-gray-200 text-gray-600'}`}>{label}</button>)}</div>
 <button type="button" onClick={onClose} className="mt-3 w-full py-3 rounded-xl bg-gray-100 text-gray-600 text-xs">기존 선택 유지하고 닫기</button>
 </dialog>,document.body);
}
