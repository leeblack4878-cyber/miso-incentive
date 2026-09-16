import React from 'react';
import { policyInputPendingLabel } from '../policyCalendar';

export default function PolicyInputNotice({ month }) {
  return <div role="status" data-testid="policy-input-pending" className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
    <div className="text-sm font-bold">{policyInputPendingLabel(month)}</div>
    <p className="mt-1 text-xs leading-relaxed">해당 월 정책이 반영될 때까지 실적을 입력할 수 없어요. 기존 내역은 확인할 수 있어요.</p>
  </div>;
}
