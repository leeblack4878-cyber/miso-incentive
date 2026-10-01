import React from 'react';
import {MOBILE_PLAN_TYPES,MOBILE_PLANS} from '../mobilePlans';
export default function MobilePlanFields({value,onChange,prefix='',required=false,automatic=false}){
 const type=value?.type||'';
 return <fieldset className="mt-3 rounded-xl border border-gray-100 bg-gray-50 p-3 min-w-0">
  <legend className="px-1 text-xs font-semibold text-gray-600">{automatic?'고객유형':`${prefix}실제 요금제`}{required?' *':''}</legend>
  <div className="grid grid-cols-3 gap-1.5" role="group" aria-label={`${prefix}요금제 유형`}>
   {MOBILE_PLAN_TYPES.map(item=><button type="button" key={item.key} aria-pressed={type===item.key} onClick={()=>onChange({type:item.key,key:''})} className={`rounded-lg border py-2 text-xs font-semibold ${type===item.key?'bg-brand-50 border-brand-300 text-brand-700':'bg-white border-gray-200 text-gray-600'}`}>{item.label}</button>)}
  </div>
  <label className="mt-3 block text-xs text-gray-600">{automatic?'4. 요금제':'세부 요금제'}
   <select aria-label={`${prefix}세부 요금제`} disabled={!type} value={value?.key||''} onChange={e=>onChange(MOBILE_PLANS.find(p=>p.key===e.target.value)||null)} className="mt-1 w-full min-w-0 max-w-full rounded-lg border border-gray-200 bg-white px-2 py-2.5 text-xs">
    <option value="">{type?'선택해주세요':'유형을 먼저 선택해주세요'}</option>{MOBILE_PLANS.filter(p=>p.type===type).map(plan=><option key={plan.key} value={plan.key}>{plan.label}</option>)}
   </select>
  </label>
  <p className="mt-2 text-[10px] leading-relaxed text-gray-500">{automatic?'선택한 요금제와 판매 정책으로 급여를 자동 계산해요.':'집계용 정보예요. 수수료는 선택한 지급 기준 구간을 적용해요.'}</p>
 </fieldset>;
}
