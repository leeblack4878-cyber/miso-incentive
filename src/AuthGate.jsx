import React, { useEffect, useState } from 'react';
import { Loader2, LogIn, LogOut, ShieldCheck, KeyRound, Mail, CheckCircle2, UserPlus, Clock, XCircle } from 'lucide-react';
import { supabase } from './supabase';
import { friendlyError } from './errorMessages';

// AuthGate 안에서만 쓰는 매장/직급 목록. App.jsx의 DEFAULT_STORES / POSITIONS와 같은 값으로 맞춰주세요.
// (매장이 추가/변경되면 이 목록도 같이 업데이트해야 회원가입 폼에 반영됩니다.)
// DB(app_config)에서 불러오지 못했을 때만 쓰는 최후 fallback 목록
const FALLBACK_STORES = [
  '신천동_삼미시장점', '신천동_삼미시장2호점', '본오3동_상록수역점', '대야동_롯데마트점',
  '본오3동_주민센터점', '장곡동_장곡역점', '거모동_도일시장점', '월곶동_월곶점',
  '월피동_성포역점', '광정동_산본점', '고잔동_법조타운점', '은행동_은계사거리점', '본오1동_본오중학교점',
  '영업지원팀',
];
const SIGNUP_POSITIONS = ['담당', '점장', '부점장', '매니저', '사원'];

export default function AuthGate({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const [mode, setMode] = useState('login'); // 'login' | 'signup'

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const [recoveryMode, setRecoveryMode] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');

  // 회원가입 전용 필드
  const [signupStores, setSignupStores] = useState(FALLBACK_STORES);
  const [suName, setSuName] = useState('');
  const [suStore, setSuStore] = useState(FALLBACK_STORES[0]);
  const [suPosition, setSuPosition] = useState(SIGNUP_POSITIONS[SIGNUP_POSITIONS.length - 1]);
  const [suEmployeeCode, setSuEmployeeCode] = useState('');
  const [suHireDate, setSuHireDate] = useState('');
  const [suPassword2, setSuPassword2] = useState('');

  // 로그인 전(비인증) 상태에서도 호출 가능한 함수로 매장 목록을 관리자 화면과 동일하게 실시간으로 불러옴
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.rpc('get_public_stores');
        if (!error && Array.isArray(data) && data.length) {
          setSignupStores(data);
          setSuStore((cur) => (data.includes(cur) ? cur : data[0]));
        }
      } catch (e) { /* 실패하면 fallback 목록 그대로 사용 */ }
    })();
  }, []);

  async function loadProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, employee_code, store_name, position, role, active, status, hire_date')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('PROFILE LOAD ERROR:', error);
      setProfile(null);
      return;
    }
    setProfile(data);
  }

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      const nextSession = data.session ?? null;
      setSession(nextSession);
      if (nextSession?.user) await loadProfile(nextSession.user.id);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      console.log('AUTH EVENT:', event);

      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryMode(true);
        setError('');
        setInfo('새 비밀번호를 설정해주세요.');
      }

      setSession(nextSession);

      if (nextSession?.user) {
        setTimeout(() => loadProfile(nextSession.user.id), 0);
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function signIn(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setInfo('');

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });

    if (error) {
      console.error('LOGIN ERROR:', error);
      setError(friendlyError(error));
    } else if (!data?.session) {
      setError('로그인 세션이 생성되지 않았습니다.');
    }

    setSubmitting(false);
  }

  async function signUp(e) {
    e.preventDefault();
    setError('');
    setInfo('');

    if (!suName.trim()) { setError('이름을 입력해주세요.'); return; }
    if (password.length < 6) { setError('비밀번호는 6자 이상으로 입력해주세요.'); return; }
    if (password !== suPassword2) { setError('비밀번호 확인 값이 일치하지 않습니다.'); return; }

    setSubmitting(true);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          name: suName.trim(),
          store_name: suStore,
          position: suPosition,
          employee_code: suEmployeeCode.trim(),
          hire_date: suHireDate || null,
        },
      },
    });

    if (error) {
      console.error('SIGNUP ERROR:', error);
      setError(friendlyError(error));
      setSubmitting(false);
      return;
    }

    if (data?.session) {
      // 이메일 인증이 꺼져있는 프로젝트라면 바로 세션이 생겨요.
      // 이 경우 onAuthStateChange가 profile을 불러오고, status가 'pending'이라
      // 아래 승인대기 화면으로 자동 전환됩니다. 여기서는 별도 처리 없음.
    } else {
      setInfo('가입 신청이 접수됐어요. 이메일로 온 인증 링크를 눌러주시면, 그다음부터 로그인하실 수 있어요. (인증 후에도 관리자 승인 전까지는 실적 화면 대신 승인대기 화면이 보여요)');
      setMode('login');
    }

    setSubmitting(false);
  }

  async function sendRecovery() {
    setError('');
    setInfo('');

    if (!email.trim()) {
      setError('먼저 이메일 주소를 입력해주세요.');
      return;
    }

    setSubmitting(true);

    const redirectTo = window.location.origin;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo
    });

    if (error) {
      console.error('RECOVERY MAIL ERROR:', error);
      setError(friendlyError(error));
    } else {
      setInfo('비밀번호 재설정 메일을 보냈습니다. 메일의 링크를 눌러주세요.');
    }

    setSubmitting(false);
  }

  async function updatePassword(e) {
    e.preventDefault();
    setError('');
    setInfo('');

    if (newPassword.length < 6) {
      setError('새 비밀번호는 6자 이상으로 입력해주세요.');
      return;
    }

    if (newPassword !== newPassword2) {
      setError('새 비밀번호 확인 값이 일치하지 않습니다.');
      return;
    }

    setSubmitting(true);

    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) {
      console.error('PASSWORD UPDATE ERROR:', error);
      setError(friendlyError(error));
    } else {
      setInfo('비밀번호가 변경되었습니다. 이제 새 비밀번호로 로그인할 수 있습니다.');
      setRecoveryMode(false);
      setNewPassword('');
      setNewPassword2('');
      await supabase.auth.signOut();
    }

    setSubmitting(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="animate-spin" size={20} />
          로그인 상태 확인 중
        </div>
      </div>
    );
  }

  if (recoveryMode) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-5">
        <form onSubmit={updatePassword} className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <div className="w-11 h-11 rounded-xl bg-violet-600 text-white flex items-center justify-center mb-4">
            <KeyRound size={22} />
          </div>

          <h1 className="text-xl font-bold text-slate-900">새 비밀번호 설정</h1>
          <p className="text-sm text-slate-500 mt-1 mb-6">
            앞으로 로그인할 새 비밀번호를 입력해주세요.
          </p>

          <label className="block text-xs font-semibold text-slate-600 mb-1.5">새 비밀번호</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 mb-4 outline-none focus:ring-2 focus:ring-violet-200"
            required
          />

          <label className="block text-xs font-semibold text-slate-600 mb-1.5">새 비밀번호 확인</label>
          <input
            type="password"
            value={newPassword2}
            onChange={(e) => setNewPassword2(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-violet-200"
            required
          />

          {error && <div className="text-xs text-red-700 bg-red-50 rounded-lg p-2.5 mt-3">{error}</div>}
          {info && <div className="text-xs text-emerald-700 bg-emerald-50 rounded-lg p-2.5 mt-3">{info}</div>}

          <button
            disabled={submitting}
            className="w-full mt-5 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white rounded-xl py-2.5 font-semibold flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            비밀번호 변경
          </button>
        </form>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-5">
        <form onSubmit={mode === 'login' ? signIn : signUp} className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <div className="w-11 h-11 rounded-xl bg-violet-600 text-white flex items-center justify-center mb-4">
            <ShieldCheck size={22} />
          </div>

          <h1 className="text-xl font-bold text-slate-900">MISO 인센티브</h1>
          <p className="text-sm text-slate-500 mt-1 mb-4">
            {mode === 'login' ? '직원 계정으로 로그인해주세요.' : '가입 신청 후 관리자 승인이 필요해요.'}
          </p>

          <div className="flex bg-slate-100 rounded-lg p-0.5 mb-5">
            <button type="button" onClick={() => { setMode('login'); setError(''); setInfo(''); }}
              className={`flex-1 py-1.5 rounded-md text-sm font-medium ${mode === 'login' ? 'bg-white shadow text-violet-700' : 'text-slate-500'}`}>로그인</button>
            <button type="button" onClick={() => { setMode('signup'); setError(''); setInfo(''); }}
              className={`flex-1 py-1.5 rounded-md text-sm font-medium ${mode === 'signup' ? 'bg-white shadow text-violet-700' : 'text-slate-500'}`}>회원가입</button>
          </div>

          {mode === 'signup' && (
            <>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">이름</label>
              <input
                type="text"
                value={suName}
                onChange={(e) => setSuName(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 mb-4 outline-none focus:ring-2 focus:ring-violet-200"
                required
              />

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">매장</label>
                  <select value={suStore} onChange={(e) => setSuStore(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-violet-200 text-sm">
                    {signupStores.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">직급</label>
                  <select value={suPosition} onChange={(e) => setSuPosition(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-violet-200 text-sm">
                    {SIGNUP_POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">사번 (선택)</label>
                  <input type="text" value={suEmployeeCode} onChange={(e) => setSuEmployeeCode(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-violet-200 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">입사월</label>
                  <input type="month" value={suHireDate} onChange={(e) => setSuHireDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-violet-200 text-sm" />
                </div>
              </div>
            </>
          )}

          <label className="block text-xs font-semibold text-slate-600 mb-1.5">이메일</label>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 mb-4 outline-none focus:ring-2 focus:ring-violet-200"
            placeholder="name@example.com"
            required
          />

          <label className="block text-xs font-semibold text-slate-600 mb-1.5">비밀번호</label>
          <input
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-violet-200"
            required
          />

          {mode === 'signup' && (
            <>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 mt-4">비밀번호 확인</label>
              <input
                type="password"
                autoComplete="new-password"
                value={suPassword2}
                onChange={(e) => setSuPassword2(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-violet-200"
                required
              />
            </>
          )}

          {error && (
            <div className="text-xs text-red-700 bg-red-50 rounded-lg p-2.5 mt-3 break-words">
              <div className="font-semibold mb-0.5">{mode === 'login' ? 'Supabase 로그인 오류' : '가입 오류'}</div>
              {error}
            </div>
          )}

          {info && (
            <div className="text-xs text-emerald-700 bg-emerald-50 rounded-lg p-2.5 mt-3">
              {info}
            </div>
          )}

          <button
            disabled={submitting}
            className="w-full mt-5 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white rounded-xl py-2.5 font-semibold flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : mode === 'login' ? <LogIn size={16} /> : <UserPlus size={16} />}
            {mode === 'login' ? '로그인' : '가입 신청'}
          </button>

          {mode === 'login' && (
            <button
              type="button"
              disabled={submitting}
              onClick={sendRecovery}
              className="w-full mt-3 text-sm text-violet-700 hover:text-violet-800 flex items-center justify-center gap-1.5"
            >
              <Mail size={14} />
              비밀번호 재설정 메일 보내기
            </button>
          )}
        </form>
      </div>
    );
  }

  if (profile && profile.status === 'pending') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-5">
        <div className="max-w-sm bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center">
          <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4">
            <Clock size={22} />
          </div>
          <div className="font-bold text-slate-800">관리자 승인 대기 중이에요</div>
          <p className="text-sm text-slate-500 mt-2">
            {profile?.name || session.user.email}님의 가입 신청이 접수됐어요.<br />
            관리자가 승인하면 바로 이용하실 수 있어요.
          </p>
          <button onClick={signOut} className="mt-5 text-sm text-violet-700 font-medium">로그아웃</button>
        </div>
      </div>
    );
  }

  if (profile && profile.status === 'rejected') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-5">
        <div className="max-w-sm bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center">
          <div className="w-11 h-11 rounded-xl bg-red-100 text-red-500 flex items-center justify-center mx-auto mb-4">
            <XCircle size={22} />
          </div>
          <div className="font-bold text-slate-800">가입 신청이 승인되지 않았어요</div>
          <p className="text-sm text-slate-500 mt-2">확인이 필요하면 관리자에게 문의해주세요.</p>
          <button onClick={signOut} className="mt-5 text-sm text-violet-700 font-medium">로그아웃</button>
        </div>
      </div>
    );
  }

  if (profile && profile.active === false) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-5">
        <div className="max-w-sm bg-white rounded-2xl border p-6 text-center">
          <div className="font-bold text-slate-800">비활성화된 계정입니다.</div>
          <button onClick={signOut} className="mt-4 text-sm text-violet-700">로그아웃</button>
        </div>
      </div>
    );
  }

  return (
    <>
      {React.isValidElement(children) ? React.cloneElement(children, { authUser: session.user, authProfile: profile, onSignOut: signOut }) : children}
    </>
  );
}
