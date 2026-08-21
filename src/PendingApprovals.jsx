import React, { useEffect, useState, useCallback } from 'react';
import { Edit3, Check, X, Loader2, Clock } from 'lucide-react';
import { supabase } from './supabase';
import { friendlyError } from './errorMessages';

const FIELD_LABELS = { name: '이름', employee_code: '사번', hire_date: '입사월' };

/*
  직원용 요청 폼: <ProfileEditRequestForm authUser={authUser} profile={profile} /> (홈 화면 등에 배치)
  관리자용 목록: <ProfileEditRequests /> (직원 관리 화면에 배치, admin/manager만 실제 승인 가능)
*/

export function ProfileEditRequestForm({ authUser, profile }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(profile?.name || '');
  const [employeeCode, setEmployeeCode] = useState(profile?.employee_code || '');
  const [hireDate, setHireDate] = useState(profile?.hire_date || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    setName(profile?.name || '');
    setEmployeeCode(profile?.employee_code || '');
    setHireDate(profile?.hire_date || '');
  }, [profile]);

  const submit = async () => {
    setError('');
    const changes = {};
    if (name.trim() && name.trim() !== profile?.name) changes.name = name.trim();
    if (employeeCode.trim() !== (profile?.employee_code || '')) changes.employee_code = employeeCode.trim() || null;
    if (hireDate && hireDate !== profile?.hire_date) changes.hire_date = hireDate;

    if (Object.keys(changes).length === 0) { setError('바뀐 내용이 없어요.'); return; }

    setSubmitting(true);
    const { error } = await supabase.from('profile_edit_requests').insert({ user_id: authUser.id, changes });
    if (error) { console.error('EDIT REQUEST ERROR:', error); setError(friendlyError(error)); }
    else { setDone(true); setOpen(false); }
    setSubmitting(false);
  };

  if (!open) {
    return (
      <button onClick={() => { setOpen(true); setDone(false); }} className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-400 py-2">
        <Edit3 size={12} /> {done ? '수정 요청을 또 보낼 수 있어요' : '내 정보가 잘못됐나요? 수정 요청하기'}
      </button>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
      <div className="text-sm font-semibold text-gray-700">정보 수정 요청</div>
      <div className="text-[11px] text-gray-400">바로 바뀌지 않고, 관리자가 승인해야 반영돼요.</div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">이름</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm" />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">사번</label>
        <input value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm" />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">입사월</label>
        <input type="month" value={hireDate} onChange={(e) => setHireDate(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm" />
      </div>

      {error && <div className="text-xs text-red-600 bg-red-50 rounded-lg p-2">{error}</div>}

      <div className="flex gap-2">
        <button onClick={submit} disabled={submitting} className="flex-1 flex items-center justify-center gap-1 text-sm font-medium py-2 rounded-lg bg-violet-600 text-white disabled:opacity-50">
          {submitting ? <Loader2 size={14} className="animate-spin" /> : null} 요청 보내기
        </button>
        <button onClick={() => setOpen(false)} className="px-4 text-sm text-gray-400">취소</button>
      </div>
    </div>
  );
}

export default function ProfileEditRequests() {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [names, setNames] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error } = await supabase
      .from('profile_edit_requests')
      .select('id, user_id, changes, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    if (error) { setError(friendlyError(error)); setLoading(false); return; }

    const list = data || [];
    setPending(list);

    const ids = [...new Set(list.map((r) => r.user_id))];
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('id, name, employee_code, hire_date').in('id', ids);
      setNames(Object.fromEntries((profs || []).map((p) => [p.id, p])));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const decide = async (req, approve) => {
    setBusyId(req.id);
    setError('');
    if (approve) {
      const { error: e1 } = await supabase.from('profiles').update(req.changes).eq('id', req.user_id);
      if (e1) { console.error('APPLY EDIT ERROR:', e1); setError(friendlyError(e1)); setBusyId(null); return; }
    }
    const { error: e2 } = await supabase
      .from('profile_edit_requests')
      .update({ status: approve ? 'approved' : 'rejected', decided_at: new Date().toISOString() })
      .eq('id', req.id);
    if (e2) { console.error('DECIDE EDIT REQUEST ERROR:', e2); setError(friendlyError(e2)); }
    else setPending((prev) => prev.filter((p) => p.id !== req.id));
    setBusyId(null);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-2 text-sm text-gray-400">
        <Loader2 size={14} className="animate-spin" /> 정보 수정 요청 확인 중...
      </div>
    );
  }
  if (!pending.length && !error) return null;

  return (
    <div className="bg-white rounded-xl border border-sky-200 overflow-hidden">
      <div className="px-4 py-3 bg-sky-50 flex items-center gap-2 text-sm font-semibold text-sky-700">
        <Clock size={15} /> 정보 수정 요청 {pending.length}건
      </div>
      {error && <div className="px-4 py-2 text-xs text-red-600 bg-red-50">{error}</div>}
      <div className="divide-y divide-gray-50">
        {pending.map((r) => {
          const before = names[r.user_id] || {};
          return (
            <div key={r.id} className="flex items-center justify-between px-4 py-3 gap-2 flex-wrap">
              <div>
                <div className="text-sm font-medium text-gray-800">{before.name || '(알 수 없음)'}</div>
                <div className="text-[11px] text-gray-400 space-y-0.5">
                  {Object.entries(r.changes).map(([k, v]) => (
                    <div key={k}>{FIELD_LABELS[k] || k}: {String(before[k] ?? '(없음)')} → <b className="text-sky-700">{String(v)}</b></div>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button disabled={busyId === r.id} onClick={() => decide(r, true)}
                  className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md bg-violet-600 text-white disabled:opacity-50">
                  {busyId === r.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} 승인
                </button>
                <button disabled={busyId === r.id} onClick={() => decide(r, false)}
                  className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md bg-gray-100 text-gray-500 disabled:opacity-50">
                  <X size={13} /> 거절
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
