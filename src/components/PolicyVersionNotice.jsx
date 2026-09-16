import React from 'react';
import { policyDisplayFor } from '../policyCalendar';
import PolicyInputNotice from './PolicyInputNotice';

export default function PolicyVersionNotice({ month, blocked = false }) {
  if (blocked) return <PolicyInputNotice month={month} />;
  const policy = policyDisplayFor(month);
  return <div className="mb-3 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600" aria-label="적용 지급기준">
    <div className="font-semibold">{month} 실적 · {policy.label}</div>
    {policy.carriedForward && <p className="mt-1 leading-relaxed">현재 등록된 지급기준을 이어서 적용하고 있어요. 새 정책이 확정되면 별도로 반영됩니다.</p>}
  </div>;
}
