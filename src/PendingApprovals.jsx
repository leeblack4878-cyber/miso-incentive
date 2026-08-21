import React, { useEffect, useState, useCallback } from 'react';
import { UserCheck, UserX, Loader2, Clock } from 'lucide-react';
import { supabase } from './supabase';
import { friendlyError } from './errorMessages';

/*
  가입 승인 전용 컴포넌트
  - profiles.status = 'pending' 인 가입 신청 목록 조회
  - 승인: status='approved', active=true
  - 거절: status='rejected', active=false
  - 관리자 화면(EmployeeManager 등)에 <PendingApprovals /> 로 사용
*/
export default function PendingApprovals() {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [managerPositions, setManagerPositions] = useState(['점장', '부점장', '담당']);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, employee_code, store_name, position, hire_date, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('PENDING LOAD ERROR:', error);
      setError(friendlyError(error));
    } else {
      setPending(data || []);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from('app_config')
          .select('value')
          .eq('config_key', 'auto_manager_positions')
          .maybeSingle();

        if (!error && Array.isArray(data?.value)) {
          setManagerPositions(data.value);
        }
      } catch (e) {
        // 설정 조회 실패 시 기본값 유지
      }
    })();
  }, []);

  const decide = async (id, approve) => {
    setBusyId(id);
    setError('');

    const target = pending.find((p) => p.id === id);

    const patch = approve
      ? {
          status: 'approved',
          active: true,
          ...(managerPositions.includes(target?.position) ? { role: 'manager' } : {}),
          ...(target?.position === '담당' ? { store_name: '운영진' } : {}),
        }
      : {
          status: 'rejected',
          active: false,
        };

    const { error } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', id);

    if (error) {
      console.error('APPROVE/REJECT ERROR:', error);
      setError(friendlyError(error));
    } else {
      setPending((prev) => prev.filter((p) => p.id !== id));
    }

    setBusyId(null);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-2 text-sm text-gray-400">
        <Loader2 size={14} className="animate-spin" />
        가입 신청 확인 중...
      </div>
    );
  }

  if (!pending.length && !error) return null;

  return (
    <div className="bg-white rounded-xl border border-amber-200 overflow-hidden">
      <div className="px-4 py-3 bg-amber-50 flex items-center gap-2 text-sm font-semibold text-amber-700">
        <Clock size={15} />
        가입 승인 대기 {pending.length}명
      </div>

      {error && (
        <div className="px-4 py-2 text-xs text-red-600 bg-red-50">
          {error}
        </div>
      )}

      <div className="divide-y divide-gray-50">
        {pending.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between px-4 py-3 gap-3 flex-wrap"
          >
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-800 truncate">
                {p.name || '(이름 미입력)'}
              </div>
              <div className="text-[11px] text-gray-400 truncate">
                {p.store_name || '매장 미지정'} · {p.position || '직급 미지정'}
                {p.hire_date ? ` · 입사 ${p.hire_date}` : ''}
                {p.employee_code ? ` · 사번 ${p.employee_code}` : ''}
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap">
              <button
                disabled={busyId === p.id}
                onClick={() => decide(p.id, true)}
                className="shrink-0 flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md bg-violet-600 text-white disabled:opacity-50"
              >
                {busyId === p.id ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <UserCheck size={13} />
                )}
                가입 승인
              </button>

              <button
                disabled={busyId === p.id}
                onClick={() => decide(p.id, false)}
                className="shrink-0 flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md bg-gray-100 text-gray-500 disabled:opacity-50"
              >
                <UserX size={13} />
                가입 거절
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
