import { activeRoster, hasMonthHistory, readAllPages } from './performanceRoster';
import { PerformanceResetApprovals } from './components/PerformanceResetPanel';
import { DEFAULT_BASE_PAY, DEFAULT_BASE_PENALTY, DEFAULT_POSITION_ALLOWANCE, DEFAULT_TENURE, DEFAULT_TENURE_CAP, DEFAULT_GRADES, DEFAULT_HOME_TIERS, DEFAULT_MATRIX, DEFAULT_CATEGORY_MAP, DEFAULT_CUSTREG_TIERS, DEFAULT_TAILORED_TIERS, mergeDefaultVas, defaultConfig } from './policyDefaults';
import { BADGE_DEFS, MONTHLY_RANK_METRICS, evaluateAutomaticBadges } from './badgeRules';
import { createPortal } from 'react-dom';
import PerformanceCard from './components/PerformanceCard';
import { resolveDashboardStore, performanceForecastFactor, dashboardScopeBranches, dashboardAreaOptions } from './dashboardScope';
import { getPersonalGoalActuals, MyMonthlyPerformanceCard } from './components/MonthlyPerformance';
import { payDisplay } from './payDisplay';
import { emptyDraft, DEFAULT_HOME_FLAT, DEFAULT_HOME_ADDON, sortStoresByOpenOrder, DEFAULT_STORES, companyGoalDefaults, useFinalStorePerformance, finalStoreMetric } from './viewShared';
import { isIncentiveUnpaidSpecial, currentPolicySnapshot, NON_SALES_STORES, HOME_GATE_MIN, ADDON_GATE, DEFAULT_MOBILE_POINT_ITEMS, DEFAULT_KPI_ITEMS, HOME_BASE_ITEMS, homeNetworkLabel, DEFAULT_RENEW, DEFAULT_GIBYEON_COLUMN_MAP, DEFAULT_VAS, DEFAULT_BUNDLE2ND, DEFAULT_SONO, DEFAULT_MNP_BUNDLE, fmtCount, fmtShortDate, monthKeyOf, monthLabel, tierBonus, daysInMonth, emptyDayMatrix, DAILY_GROUP_DEFS, DAILY_GROUP_KEYS, DAILY_NUMERIC_KEYS, HOME_KPI_MAP, emptyDay, normalizeDay, calendarCoreMetrics, dayHasPerformanceData, dayHasData, aggregateDaily, applyDailyToDraft, computePay, HOME_ORDER_PRODUCTS, careTaskCategory, addDaysDate, HS_PARTS, matrixRowCount, hsCount } from './appShared';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Trophy, Home, ClipboardList, History, Users, ChevronDown, Plus, Minus, Award, Loader2, Check, Settings, LayoutDashboard, Wallet, Trash2, UserPlus, Info, Calendar, ChevronRight, AlertTriangle, Zap, UploadCloud, X, Target, ShieldCheck, LogOut, Bell, ClipboardCheck, Building2, Share2, Send, HelpCircle, Star } from 'lucide-react';
import { supabase } from './supabase';
import { friendlyError } from './errorMessages';
import { feedbackBridge, showAppToast, showAppConfirm, showLegacyAlert } from './feedback';


import { COMPANY_SCOPE_VIEWERS, SALES_MANAGER_AREAS, PRIMARY_PERMISSION_ADMIN_ID, scopedEmployeesFor } from './permissionScopes';
import TodayWorkCard from './components/TodayWorkCard';
import SalesExpensePanel from './components/SalesExpensePanel';
import PolicyVersionNotice from './components/PolicyVersionNotice';

import Section from './components/Section';
import ColHeader from './components/ColHeader';
import { POSITIONS, ROLE_LABELS, MATRIX_ROW_DEFS, MATRIX_COLS, displayStoreName, fmtNum, fmtInputNumber, won } from './uiDefinitions';
const EvaluationTab=React.lazy(()=>import('./components/EvaluationViews').then(m=>({default:m.EvaluationTab})));
const ManagerPayrollPanel=React.lazy(()=>import('./components/EvaluationViews').then(m=>({default:m.ManagerPayrollPanel})));
const CustomerCareManager=React.lazy(()=>import('./components/CustomerCareManager'));
const DailyInputTab=React.lazy(()=>import('./components/DailyInputTab'));
const RatesManager=React.lazy(()=>import('./components/RatesManager'));
const PermissionsManager=React.lazy(()=>import('./components/PermissionsManager'));
const SpecialSalePolicyAdmin=React.lazy(()=>import('./components/SpecialSalePolicyAdmin'));
const HqStructurePolicyView=React.lazy(()=>import('./HqStructurePolicyView'));
const PasswordResetAdmin=React.lazy(()=>import('./PasswordResetAdmin'));
const PendingApprovals=React.lazy(()=>import('./PendingApprovals'));
const ProfileEditRequests=React.lazy(()=>import('./ProfileEditRequests'));
import { summarizeVasQuality, homeOrdersForMonth, homeBundleCount, completedHomeCount, calculateMobileSale, specialPolicyLedgerRows, enrichHomeOrdersForPolicy, calculateHomePolicyFromOrders as calculateHomePolicyEngine } from './policyRules';


import { SEPTEMBER_SPECIAL_SALES } from './septemberPolicy';

import {
  POLICY_HISTORY_CONFIG_KEY,
  POLICY_READY_MONTHS_KEY,
  isPolicyInputBlocked,
  isPolicyConfigReadOnly,
  isSeptemberPolicyActive,
  resolvePolicyConfigForMonth,
} from './policyCalendar';
import {
  DAILY_BRIEFING_SEND_TIME,
  briefingMobileCount,
  buildBriefingPeriodRows,
  buildAllBriefingText,
  buildStoreBriefingText,
  canAccessDailyBriefing,
  dailyInputStatus,
  isBriefingMonthOverdueHome,
  projectMetric,
  resolveStoreBriefingGoals,
} from './dailyBriefing';


function playMisoNotificationSound(){
  try{
    const AudioContext=window.AudioContext||window.webkitAudioContext;
    if(!AudioContext)return;
    const context=new AudioContext(),gain=context.createGain();
    gain.connect(context.destination);
    gain.gain.setValueAtTime(0.0001,context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.16,context.currentTime+0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001,context.currentTime+0.55);
    [[659.25,0],[783.99,0.16]].forEach(([frequency,delay])=>{
      const oscillator=context.createOscillator();
      oscillator.type='sine';oscillator.frequency.value=frequency;oscillator.connect(gain);
      oscillator.start(context.currentTime+delay);oscillator.stop(context.currentTime+delay+0.34);
    });
    setTimeout(()=>context.close().catch(()=>{}),800);
  }catch(e){console.debug('NOTIFICATION SOUND UNAVAILABLE',e)}
}
function AppFeedbackHost(){
  const [toasts,setToasts]=useState([]),[dialog,setDialog]=useState(null);
  useEffect(()=>{
    feedbackBridge.toast=(item)=>{const id=Date.now()+Math.random();setToasts(v=>[...v,{...item,id}]);setTimeout(()=>setToasts(v=>v.filter(x=>x.id!==id)),3200)};
    feedbackBridge.confirm=(options)=>new Promise(resolve=>setDialog({...options,resolve}));
    return()=>{Object.assign(feedbackBridge,{toast:null,confirm:null})};
  },[]);
  const finish=value=>{dialog?.resolve?.(value);setDialog(null)};
  return <>
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[120] w-[calc(100%-24px)] max-w-sm space-y-2 pointer-events-none">{toasts.map(t=><div key={t.id} className={`pointer-events-auto rounded-2xl px-4 py-3 shadow-xl border ${t.tone==='error'?'bg-red-600 border-red-500 text-white':t.tone==='info'?'bg-gray-900 border-gray-800 text-white':'bg-emerald-600 border-emerald-500 text-white'}`}><div className="text-xs font-bold">{t.title|| (t.tone==='error'?'처리하지 못했어요':'처리 완료')}</div><div className="text-[11px] opacity-90 mt-0.5">{t.message}</div></div>)}</div>
    {dialog&&<div className="fixed inset-0 z-[125] bg-black/45 flex items-end sm:items-center justify-center" onClick={()=>finish(false)}><div className="w-full max-w-sm bg-white rounded-t-3xl sm:rounded-3xl p-5" onClick={e=>e.stopPropagation()}><div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${dialog.tone==='danger'?'bg-red-50 text-red-500':'bg-brand-50 text-brand-600'}`}><AlertTriangle size={20}/></div><div className="text-lg font-bold text-gray-900 mt-3">{dialog.title||'확인해주세요'}</div><div className="text-xs text-gray-500 mt-2 whitespace-pre-line leading-relaxed">{dialog.message}</div><div className="grid grid-cols-2 gap-2 mt-5"><button onClick={()=>finish(false)} className="py-3 rounded-xl bg-gray-100 text-gray-600 text-sm font-bold">{dialog.cancelLabel||'돌아가기'}</button><button onClick={()=>finish(true)} className={`py-3 rounded-xl text-white text-sm font-bold ${dialog.tone==='danger'?'bg-red-500':'bg-brand-600'}`}>{dialog.confirmLabel||'확인'}</button></div></div></div>}
  </>;
}

function PwaInstallButton(){
  const [installPrompt,setInstallPrompt]=useState(null),[guideOpen,setGuideOpen]=useState(false),[installed,setInstalled]=useState(false);
  useEffect(()=>{
    const standalone=window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
    setInstalled(standalone);
    const ready=(event)=>{event.preventDefault();setInstallPrompt(event)};
    const done=()=>{setInstalled(true);setInstallPrompt(null);showAppToast('미소페이를 홈 화면에 설치했어요.')};
    window.addEventListener('beforeinstallprompt',ready);window.addEventListener('appinstalled',done);
    return()=>{window.removeEventListener('beforeinstallprompt',ready);window.removeEventListener('appinstalled',done)};
  },[]);
  if(installed)return null;
  const install=async()=>{
    if(installPrompt){await installPrompt.prompt();const choice=await installPrompt.userChoice;if(choice?.outcome==='accepted')setInstallPrompt(null);return}
    setGuideOpen(true);
  };
  const isiOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
  return <><button onClick={install} className="hidden sm:flex h-9 items-center gap-1 rounded-xl border border-brand-100 bg-brand-50 px-2.5 text-[10px] font-bold text-brand-700" title="홈 화면에 앱 설치"><Home size={14}/>앱 설치</button><button onClick={install} className="sm:hidden w-9 h-9 rounded-xl border border-brand-100 bg-brand-50 text-brand-700 flex items-center justify-center" title="앱 설치"><Home size={15}/></button>{guideOpen&&<div className="fixed inset-0 z-[126] bg-black/45 flex items-end sm:items-center justify-center" onClick={()=>setGuideOpen(false)}><div className="w-full max-w-sm rounded-t-3xl sm:rounded-3xl bg-white p-5" onClick={e=>e.stopPropagation()}><div className="w-12 h-12 rounded-2xl bg-brand-600 text-white flex items-center justify-center"><Trophy size={24}/></div><div className="text-lg font-black text-gray-900 mt-3">미소페이 앱 설치</div>{isiOS?<div className="mt-3 space-y-2 text-sm text-gray-600"><div className="rounded-xl bg-gray-50 p-3"><b>1.</b> Safari 하단의 <b>공유 버튼</b>을 눌러요.</div><div className="rounded-xl bg-gray-50 p-3"><b>2.</b> 메뉴에서 <b>홈 화면에 추가</b>를 선택해요.</div><div className="rounded-xl bg-gray-50 p-3"><b>3.</b> 오른쪽 위 <b>추가</b>를 누르면 끝!</div></div>:<div className="mt-3 text-sm text-gray-600 leading-relaxed">브라우저 메뉴에서 <b>앱 설치</b> 또는 <b>홈 화면에 추가</b>를 선택해주세요. Chrome 최신 버전에서 가장 원활해요.</div>}<div className="mt-3 rounded-xl bg-brand-50 p-3 text-xs text-brand-700">설치하면 주소창 없이 앱처럼 열리고, 다음 단계에서 휴대폰 푸시 알림도 연결할 수 있어요.</div><button onClick={()=>setGuideOpen(false)} className="mt-4 w-full rounded-xl bg-brand-600 py-3 text-sm font-bold text-white">확인했어요</button></div></div>}</>;
}

function AppQuickGuide({open,onClose,isManager=false}){
  if(!open)return null;
  const employeeSteps=[
    ['1','홈부터 확인','오늘 할 일, 목표 진척도, 예상 급여와 순위를 먼저 확인해요.'],
    ['2','실적입력','판매일을 고르고 모바일·홈 실적을 등록해요. 저장 상태도 상단에서 확인할 수 있어요.'],
    ['3','고객관리','제휴카드, 수납지원, 요금제 변경과 설치 일정을 놓치지 않게 관리해요.'],
    ['4','내역 확인','판매별 계산 근거와 월 누적 급여가 맞는지 확인해요.'],
  ];
  const managerSteps=[
    ['1','오늘의 운영','미입력, 목표 위험, 설치 지연과 승인 대기부터 확인해요.'],
    ['2','실적·고객 점검','매장 목표와 순위, 고객 약속·홈 설치를 필요한 범위에서 확인해요.'],
    ['3','평가·급여','평가와 담당자 급여는 기존 관리 범위와 회사 전체 기준을 유지해요.'],
    ['4','관리 설정','본사 데이터와 지급기준 같은 민감 메뉴는 권한이 있을 때만 보여요.'],
  ];
  const steps=isManager?managerSteps:employeeSteps;
  return <div className="fixed inset-0 z-[127] flex items-end justify-center bg-black/45 sm:items-center" onClick={onClose}><div className="w-full max-w-md rounded-t-3xl bg-white p-5 sm:rounded-3xl" onClick={event=>event.stopPropagation()}><div className="flex items-start justify-between gap-3"><div><div className="text-[10px] font-bold text-brand-600">빠른 사용 안내</div><div className="mt-1 text-xl font-black text-gray-900">미소페이, 이렇게 사용하세요</div><div className="mt-1 text-xs text-gray-400">{isManager?'관리자가 매일 확인할 흐름이에요.':'직원이 매일 사용할 핵심 흐름이에요.'}</div></div><button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500"><X size={15}/></button></div><div className="mt-4 space-y-2">{steps.map(([number,title,description])=><div key={number} className="flex gap-3 rounded-2xl bg-gray-50 p-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-xs font-black text-white">{number}</span><div><div className="text-sm font-bold text-gray-900">{title}</div><div className="mt-0.5 text-[11px] leading-relaxed text-gray-500">{description}</div></div></div>)}</div><div className="mt-3 rounded-xl bg-brand-50 px-3 py-2.5 text-[11px] text-brand-700">오른쪽 위 <b>?</b> 버튼을 누르면 언제든 다시 볼 수 있어요.</div><button type="button" onClick={onClose} className="mt-4 w-full rounded-xl bg-brand-600 py-3 text-sm font-bold text-white">확인하고 시작하기</button></div></div>;
}

/* v21.26: 2ND 번들별 일반/무료판매 구분. 무료판매는 실적/KPI 인정, 번들+해당 VAS 인센티브 제외. */

/* v21.32 DATA SAFETY
   - UI 버전과 저장 데이터 버전을 분리
   - 구버전 source_meta를 현재 UI 형식으로 읽음
   - 수정 시 기존 source_meta 필드를 보존한 채 현재 필드만 병합
   - DB audit trigger와 함께 원본 변경 이력을 보존
*/

 // 8월 이전 저장건 호환 전용

const isFreePhoneSpecial=isIncentiveUnpaidSpecial;


/* ===================== 기본 정책 상수 (관리자가 수정 가능) ===================== */


 // 활동시간 미충족시 차감
 // 직책수당 — 영업활동 지원금과 분리하여 최종 가산


// 실제 영업을 하지 않는 조직 — 실적표/실적비교/지급 총액 집계에서 제외

const SALES_AREA_STORES = Object.freeze({
  ansan: ['본오3동_상록수역점', '본오3동_주민센터점', '월피동_성포역점', '광정동_산본점', '고잔동_법조타운점', '본오1동_본오중학교점'],
  siheung: ['신천동_삼미시장점', '신천동_삼미시장2호점', '대야동_롯데마트점', '장곡동_장곡역점', '거모동_도일시장점', '월곶동_월곶점', '은행동_은계사거리점'],
});
const SALES_AREA_LABELS = Object.freeze({ ansan: '안산 상권', siheung: '시흥 상권' });





 // 홈 최소조건(성과 인정 게이트)
   // 모바일 P가 이 값 초과일 때만 홈 가점 반영
// 홈 최소조건(3점) 전용 배점 — 성과등급P 안내표와는 별개 기준 (인터넷:1점, 프리:0.3점, 스홈:0.2점)


// v21.15: 홈 청약을 가정망/소호망으로 분리 저장.
// 현재 월 인센티브 계산식은 기존 정책을 유지하고, 다음달 정책 확정 시 망별 단가를 별도 적용할 수 있게 데이터부터 분리합니다.

const HOME_SALE_TYPES = [
  { key: 'normal', label: '일반' },
  { key: 'allinone', label: '올인원' },
];











// 가입구분(매트릭스 행) → 성과등급P 항목 / KPI 항목 기본 매핑. 관리자 화면에서 수정 가능.
// 기변A/B/C(isGibyeon) 행은 성과등급P만은 타겟(A/B/C) 상관없이 요금제군(열) 기준으로 통일 적용 — gibyeonColumnMap 참고. KPI는 타겟별로 그대로 유지.


// 기변 행(A/B/C 공통) 요금제군별 성과등급P — 115군↑ 1P / 95~105군·청소년85군 0.7P / 85군 0.7P / 약자 0.5P / 61군이상·그외 0.3P


// 운영 DB에 저장된 이전 VAS 설정에도 새 기본 항목을 보강하되,
// 관리자가 수정한 명칭·금액과 별도 추가 항목은 그대로 유지한다.













/* ===================== 유틸 ===================== */

/* v21.22: 금액·건수·목표 등 일반 숫자 표시는 천 단위 콤마를 공통 적용. 날짜/요금제/속도/전화번호 등 식별자 숫자는 제외. */


function formatLastSignIn(iso) {
  if (!iso) return '기록 없음';
  const d = new Date(iso);
  const diffDays = calendarDayDiff(d);
  const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
  if (diffDays <= 0) return `오늘 (${dateStr})`;
  if (diffDays === 1) return `어제 (${dateStr})`;
  return `${diffDays}일 전 (${dateStr})`;
}
function lastMonths(n) {
  const arr = []; const now = new Date();
  for (let i = 0; i < n; i++) arr.push(monthKeyOf(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  return arr;
}
function sumFlat(counts, table) { return table.reduce((s, t) => s + (counts[t.key] || 0) * t.rate, 0); }


/* ===== 일일입력이 다루는 건수 그룹 — 모든 실적을 날짜별로 기록 ===== */


function groupTable(config, key) {
  if (key === 'homeBase') return HOME_BASE_ITEMS;
  return (config && config[key]) || [];
}

// 홈·부가 실적 → 생산성 항목 자동 반영 규칙


// 예전 형식(매트릭스 배열만 저장)도 그대로 읽히도록 변환


function mergePerformanceDay(left, right) {
  const a=normalizeDay(left),b=normalizeDay(right);
  const matrix=a.matrix.map((row,ri)=>row.map((value,ci)=>Number(value||0)+Number(b.matrix?.[ri]?.[ci]||0)));
  const groups={...a.groups};
  DAILY_GROUP_KEYS.forEach(groupKey=>{
    groups[groupKey]={...(a.groups?.[groupKey]||{})};
    Object.entries(b.groups?.[groupKey]||{}).forEach(([key,value])=>{groups[groupKey][key]=Number(groups[groupKey][key]||0)+Number(value||0)});
  });
  const merged={...a,matrix,groups};
  DAILY_NUMERIC_KEYS.forEach(key=>{merged[key]=Number(a[key]||0)+Number(b[key]||0)});
  merged.householdRenewals=[...(a.householdRenewals||[]),...(b.householdRenewals||[])];
  return merged;
}


// 달력용 핵심 실적 요약.
// 현재 daily_records 형식뿐 아니라 예전 top-level 그룹 저장 형식도 함께 읽습니다.


// customer_sales 원본이 없던 구버전 홈 주문을 취소한 경우 daily_records에 남은
// 홈 집계만 화면/급여에서 제외합니다. 원본 일일 기록과 감사 이력은 그대로 보존합니다.
function applyCancelledLegacyHomeAdjustments(records, adjustments) {
  if (!adjustments || !Object.keys(adjustments).length) return records || {};
  const next={...(records||{})};
  Object.entries(adjustments).forEach(([dayKey,groupsToSubtract])=>{
    const raw=next[dayKey];
    if(!raw)return;
    const d=normalizeDay(raw),groups={...d.groups};
    Object.entries(groupsToSubtract||{}).forEach(([groupKey,items])=>{
      groups[groupKey]={...(groups[groupKey]||{})};
      Object.entries(items||{}).forEach(([itemKey,count])=>{
        groups[groupKey][itemKey]=Math.max(0,Number(groups[groupKey][itemKey]||0)-Number(count||0));
      });
    });
    next[dayKey]={...d,groups};
  });
  return next;
}

// 그 달의 일일 입력 전체를 합산


// 합산된 일일입력을 성과등급P/KPI/각 건수 그룹에 자동 반영해 draft를 보강


/* 급여 전체 계산 */


/* ===================== 작은 UI 컴포넌트 ===================== */

function StatusBadge({ status }) {
  const map = {
    approved: { label: '실적 승인', cls: 'bg-emerald-100 text-emerald-700' },
    pending: { label: '실적 승인 대기', cls: 'bg-amber-100 text-amber-700' },
    none: { label: '미입력', cls: 'bg-gray-100 text-gray-500' },
  };
  const s = map[status] || map.none;
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>{s.label}</span>;
}

function calendarDayDiff(past) {
  const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((startOf(new Date()) - startOf(past)) / 86400000);
}

function LastSaved({ updatedAt }) {
  if (!updatedAt) return <span className="text-xs text-gray-300">-</span>;
  const d = new Date(updatedAt);
  const diffDays = calendarDayDiff(d);
  const dateStr = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  let relLabel = diffDays <= 0 ? '오늘' : diffDays === 1 ? '어제' : `${diffDays}일 전`;
  const cls = diffDays >= 3 ? 'text-red-500' : diffDays >= 1 ? 'text-amber-600' : 'text-gray-500';
  return (
    <div className={`text-xs ${cls}`}>
      <div className="font-medium">{relLabel}</div>
      <div className="text-[10px] opacity-70">{dateStr}</div>
    </div>
  );
}

function SaveStatus({ saving, dirty, lastSavedAt }) {
  if (saving) return <span className="flex items-center gap-1 text-[11px] text-brand-600"><Loader2 size={11} className="animate-spin" />저장 중</span>;
  if (dirty) return <span className="flex items-center gap-1 text-[11px] text-amber-600"><UploadCloud size={11} />저장 대기 중</span>;
  if (lastSavedAt) {
    const d = new Date(lastSavedAt);
    const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return <span className="flex items-center gap-1 text-[11px] text-gray-400"><Check size={11} />{hm} 저장됨</span>;
  }
  return null;
}

function Stepper({ value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <button onClick={() => onChange(Math.max(0, value - 1))} className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600"><Minus size={13} /></button>
      <span className="min-w-7 text-center font-semibold text-gray-800 text-sm tabular-nums">{fmtCount(value)}</span>
      <button onClick={() => onChange(value + 1)} className="w-7 h-7 rounded-lg bg-brand-100 hover:bg-brand-200 flex items-center justify-center text-brand-700"><Plus size={13} /></button>
    </div>
  );
}


function CountRow({ label, sub, value, onChange, disabled }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <div className="min-w-0 pr-2">
        <div className="text-sm text-gray-700 truncate">{label}</div>
        {sub && <div className="text-[11px] text-gray-400">{sub}</div>}
      </div>
      {disabled ? (
        <div className="flex items-center gap-1.5">
          <span className="text-xs px-1.5 py-0.5 rounded bg-brand-50 text-brand-500">자동</span>
          <span className="min-w-7 text-center font-semibold text-gray-500 text-sm tabular-nums">{fmtCount(value)}</span>
        </div>
      ) : (
        <Stepper value={value} onChange={onChange} />
      )}
    </div>
  );
}

function CountGroup({ table, counts, onChange, autoCounts, autoKeys }) {
  const safeCounts = counts || {};
  const auto = autoKeys || null;
  return table.map((t) => {
    const isAuto = !!auto && auto.has(t.key);
    const value = isAuto ? (autoCounts?.[t.key] || 0) : (safeCounts[t.key] || 0);
    return (
      <CountRow key={t.key} label={t.label} sub={t.rate ? `건당 ${won(t.rate)}` : (t.point ? `${t.point}P` : '')}
        value={value} disabled={isAuto}
        onChange={isAuto ? undefined : (v) => onChange({ ...safeCounts, [t.key]: v })} />
    );
  });
}

/* v21.28: 직원 홈 정리 - 전월대비 금액/%, 실제 승인상태, 급여상세 제거, 월누적 카테고리 랭킹, 용어 통일. */
/* v21.29: 직원 홈-개인 하단 '홈 최소조건 충족 안내' 카드 제거. */
/* v21.30: '내 정보가 잘못됐나요?'를 개인 상세 하단에서 홈-개인 상단 로그인 정보 아래 영역으로 이동. */
/* v21.31: 하단 메뉴가 이미 '홈'이므로 홈 내부 탭 명칭을 '개인 / 매장'으로 간소화. */
/* v21.32: 실적 데이터 하위호환/버전관리. 구버전 판매건을 현재 UI로 복원하고 수정 시 기존 source_meta 보존. DB audit SQL과 함께 사용. */
/* v21.33: 직원 홈 상단 '내 정보가 잘못됐나요? / 수정 요청하기' 제거. 관리자 직접 수정 기능은 유지. */
/* v21.34: 홈 게임요소는 배지만 유지. 100개 배지/대표배지 프로필화, 목표+누적실적 통합, 월 순위 0건도 내 순위 및 공동순위 표시. */
/* v21.35: 월 누적 순위에서 로그인 ID/직원 ID 불일치 또는 경쟁행 누락 시에도 현재 직원의 '나' 행을 항상 표시. */
/* v21.36: 홈-매장의 누적 현황/목표 달성률을 '매장 목표 현황' 단일 카드로 통합. */
/* v21.37: 홈-매장 월 누적 순위는 선택 카테고리 기준으로 매장 전체 인원을 모두 표시. 현재 직원은 행 강조. */
/* v21.38: 구 UI에서 customer_sales 없이 daily_records 집계로만 남은 모바일 실적을 감지해 '이전 방식 입력 실적'로 별도 표시/수정. 현재 고객별 판매는 보존. */
/* v21.39: 고객별 판매 0건인데 일일 합계가 존재하는 구버전 날짜를 모바일 외 홈/2ND/VAS/소노 포함 전체 레거시 실적으로 감지·노출. */
/* v21.42 FINAL INTEGRATION
   - v21.39 안전본 기준 재통합 (v21.40/41 손상본 미사용)
   - 일일 달력: 날짜별 HS / SIM MNP / 홈 표시
   - 빠른 등록 및 저장방식과 맞지 않는 안내문 제거
   - 관리자 대시보드: 매장 성과 달력 + 날짜별 직원 상세
   - 점장/부점장: 자기 매장 고정, 담당/팀장/대표/실장/전체관리자: 전체 매장 및 매장 선택
*/
/* v21.43: 구버전 집계를 '이름 없음' 판매건 단위로 분해. 모바일은 모바일 수정 UI, 홈은 홈 수정 UI로 복원하며 저장 시 구집계 1건을 정상 customer_sales/home_orders 데이터로 전환. */
/* v21.44: 직원/관리자 달력 모든 날짜칸을 동일한 정사각형 크기로 고정하고 HS/SIM/홈 3줄 영역 높이도 항상 동일하게 예약. */
/* v21.45: HS/SIM/홈 가독성을 위해 개인·관리자 달력 날짜칸을 동일하게 소폭 확대(모바일 58px, 큰 화면 64px 높이). 7열 폭은 유지해 가로 넘침 방지. */
/* v21.46:
   - 구버전 모바일 1건 복원 시 기존 집계 차감 + 신규 판매 반영을 하나의 확정 일일데이터로 즉시 저장하여 1건→2건 중복 집계 방지
   - 구버전 홈 복원도 변환된 일일데이터를 즉시 저장
   - home_orders 신규 product_type 허용 SQL 별도 제공
*/
/* v21.47: 개인/관리자 달력 HS·SIM MNP·홈 요약을 현행 daily_records + 구형 top-level 저장 형식까지 호환해 계산. SIM 표기를 SIM MNP로 통일. */
/* v21.48: 관리알림 '기타 승인'을 '실적 승인 대기'로 변경하고 실제 pending 월 실적 목록/승인/반려 화면 연결. */
/* v21.49:
   - 구버전 복원 저장도 반드시 상위 saveDailyDay를 통과시켜 dailyRecords를 즉시 갱신
   - 일일 실적 저장 완료 후 mergedDraft/생산성/예상급여가 즉시 재계산
   - 일반 일일 저장도 실제 DB 저장 성공 후에만 '저장됨' 표시
*/
/* v21.50 PAY POLICY + SAFE RESET
   - 6개월 미만 영업 활동 지원 정책 230만원 고정
   - 6~12개월 HS/SIM MNP/2ND 건당 20만원, 12~24개월 15만원, 24개월 이상 10만원, MAX 230만원
   - 최저보장 비교: 영업활동지원 + 요금제 + VAS + 2ND + 승인 모바일 스팟 + 특판대체 + 직책수당
   - 성과등급/홈/소노/맞춤제안 등은 최저보장 비교 후 별도 추가
   - 직원 홈 메인은 '현재 실적 기준 금액', 버튼으로 '현재 실적 기준 마감시 금액' 확인
   - 본인 당월 실적 초기화: 2단계 확인 + '당월실적초기화' 직접 입력 + DB 자동백업 RPC
*/
/* v21.51: 당월 실적 초기화 기능을 직원 내역 하단에서 일일 실적 입력 화면 하단 '실적 관리' 영역으로 이동. 개인/관리자 달력 HS·SIM MNP·홈 표시 유지. */
/* v21.52: 관리자 매장 정렬 1~13호점 통일 + 인터넷 재약정 구조화 입력/자동 계산. */
/* v21.78: 내 입력 실적 요약에서 취소 홈 제외, 설치완료/설치대기 분리, 같은 날짜+고객 홈 묶음을 1건으로 계산. */
/* v21.77: v21.76 홈 예상 인센티브 유지 + 관리자 영업비용/오퍼 조회 오류 가시화. sales_expenses RLS 보완 SQL 동봉. 전체 연결부 회귀점검 기준 적용. */
/* v21.76: 홈 판매카드 예상 인센티브 표시 수정. 설치예정 포함 월 전체 홈 입력으로 예상 그레이드/단독/TV프리/스마트홈/동시판매를 계산하되 실제 급여·정산은 completed만 반영. 관련 경로 회귀점검. */
/* v21.75: 관리자 수동 배지/인정 메뉴 제거. 점장 PICK→성장왕(월 후반 HS 일평균 30%↑), 팀플레이어→올라운드 세일즈(HS·홈·프리·스홈·2ND 모두 판매), 미소 MVP→HS·홈·생산성 종합순위 1위 자동 부여. */
/* v21.74: 중고 MNP 61군↑ 결합 인센티브를 내역에서 '중고 MNP 결합 수수료'로 독립 분리. 모바일 관련 수수료 세부/합계에 표시하되 총 급여에는 기존 mnpBundlePay를 중복 가산하지 않음. */
/* v21.73: 내 입력 실적 요약 오류 수정(homeProductLabel undefined 제거). 홈 상품 미등록 라벨도 안전하게 표시하여 모바일/VAS/2ND/홈 집계 전체가 중단되지 않도록 수정. */
/* v21.72: 내 입력 실적 요약 직원 ID 연결 수정(auth UUID 대신 실제 employee ID 우선), 조회 오류 표시 추가. */
/* v21.71: 직원 내역 상단 '내 입력 실적 요약' 추가(모바일/VAS/2ND/홈 월 누적), 고객관리 홈 설치·개통 진행관리 항상 펼침. */
/* v21.70: 관리자 판매 퀄리티 백지화 수정. 0건/빈 매장/조회 오류 시에도 안전하게 0% 지표를 렌더링. */
/* v21.69: SIM MNP(선약) 61군 이상에서 중고 MNP 결합 인센티브(+10만원) 선택 UI 복구 및 저장 조건 보호. */
/* v21.68: 판매 퀄리티 보조지표(개인/매장/직원), HS 대비 매출지표, 전략요금제 체크, 폰안심패스(0원·보험 0.8P), 관리자 영업비용/오퍼 조회. */
/* v21.67: 관리자 홈 케어 화면의 internet1g/internet500/internet100 및 동시판매 내부키를 한글 상품명으로 표시. */
/* v21.66: 고객별 판매내역 핵심상품 기준 묶음. 같은 고객의 홈 세부항목은 홈 1건으로 표시하고 인센티브도 1회만 표시. 일자 건수도 HS/인터넷 핵심 판매건 기준. */
/* v21.65: 올인원 홈(망구분 유지·인센티브0·그레이드/성과 인정) + 실적점검 전환 + 직원 내역 아코디언 개편 + 판매건별 인센티브 즉시 표시. */
/* v21.64: 홈 동시판매 모수 표기 강화. 고객별 판매내역에 홈+HS/스마트홈+HS를 명시하고 신규 저장건에는 simulBase를 보존. */
/* v21.63: 새 홈 인센티브 정책(가정망/소호/속도/그레이드/HS동시) 적용 + 기존 고객별 홈실적 자동 재계산 + 정산상단 항목별 분리. */
/* v21.62: 정산 검토 고객별 상세 원장 + RAW CSV schema-cache 오류 수정. */
/* v21.61: 회사 목표의 HS/홈/생산성 기준수량과 평가 연결, AA임팩트 목표 자동배분 및 가감점 상세 표시. */
/* v21.60: 평가 탭 1차 도입 - 개인 커리어 등급 + 관리자 평가 + 관리자 확인 실적 최신화 + AA임팩트 월 목표/가감점. */
/* ===================== 메인 앱 ===================== */

export default function App({ authUser, authProfile, onSignOut }) {
  const [role, setRole] = useState('employee');
  const [notificationOpen,setNotificationOpen]=useState(false);
  const [quickGuideOpen,setQuickGuideOpen]=useState(false);
  const quickGuideStorageKey=authUser?.id?`miso_quick_guide_v1:${authUser.id}`:'';
  useEffect(()=>{
    if(!quickGuideStorageKey)return;
    try{if(!localStorage.getItem(quickGuideStorageKey)){const timer=setTimeout(()=>setQuickGuideOpen(true),700);return()=>clearTimeout(timer)}}catch{/* 저장공간 제한 시 자동 안내만 생략 */}
  },[quickGuideStorageKey]);
  const closeQuickGuide=()=>{setQuickGuideOpen(false);if(quickGuideStorageKey)try{localStorage.setItem(quickGuideStorageKey,'seen')}catch{/* 다시 표시될 수 있으나 앱 사용에는 영향 없음 */}};
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    if(params.get('open')==='notifications'){
      setNotificationOpen(true);
      params.delete('open');
      const query=params.toString();
      window.history.replaceState({},'',`${window.location.pathname}${query?`?${query}`:''}${window.location.hash}`);
    }else if(params.get('open')==='daily'){
      setRole('employee');setTab('daily');
      params.delete('open');
      const query=params.toString();
      window.history.replaceState({},'',`${window.location.pathname}${query?`?${query}`:''}${window.location.hash}`);
    }
  },[]);
  const [employees, setEmployees] = useState([]);
  const [empId, setEmpId] = useState('');
  const months = useMemo(() => lastMonths(24), []);
  const [month, setMonth] = useState(months[0]);
  const [config, setConfig] = useState(defaultConfig());
  const [monthRecords, setMonthRecords] = useState({}); // { empId: {draft, status} }
  const [draft, setDraft] = useState(emptyDraft());
  const [tab, setTab] = useState('home');
  const [adminTab, setAdminTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [stores, setStores] = useState(DEFAULT_STORES);
  const [dailyRecords, setDailyRecords] = useState({}); // { empId: { "01": matrix2D, ... } }
  const [storeAggregateDays,setStoreAggregateDays]=useState({}); // 일반 직원용: 개인 식별정보가 제거된 우리 매장 일별 합계
  const [teamSalesCredits,setTeamSalesCredits]=useState([]); // 담당·운영진 지원판매: 개인 제외, 선택 매장 팀 실적 전용
  const [dirty, setDirty] = useState(false);            // 실적입력 탭에 저장 안 된 변경이 있는지
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [dbError, setDbError] = useState('');
  const [lockedMonths, setLockedMonths] = useState([]);
  const [policyBlockedMonths, setPolicyBlockedMonths] = useState([]);
  const [policyReadyMonths,setPolicyReadyMonths]=useState([]);
  const [policyReadinessLoaded,setPolicyReadinessLoaded]=useState(false);
  const policyInputBlocked=isPolicyInputBlocked(month,{loaded:policyReadinessLoaded,readyMonths:policyReadyMonths,blockedMonths:policyBlockedMonths});
  const [personalGoals, setPersonalGoals] = useState({}); // 본인 월 항목별 목표
  const [employeeGoalMap, setEmployeeGoalMap] = useState({}); // 관리자 범위 직원의 월 개인 목표
  const [employeeGoalsLoading, setEmployeeGoalsLoading] = useState(false);
  const [goalSaving, setGoalSaving] = useState(false);
  const [approvedMobileSpotMap, setApprovedMobileSpotMap] = useState({}); // { empId: approved mobile spot total }
  const [homePolicyMap, setHomePolicyMap] = useState({}); // { empId: 새 홈 정책 계산 결과 }
  const [cancelledLegacyHomeMap,setCancelledLegacyHomeMap]=useState({}); // customer_sales 없는 취소 홈의 일일 잔여 차감
  const [shadowLedgerMap, setShadowLedgerMap] = useState({}); // 관리자용 판매별 계산 검증, 실제 급여에는 미반영
  const [strategicMetricMap, setStrategicMetricMap] = useState({}); // 직원 전략P 급여 가감 계산용
  const [canViewHqStructure, setCanViewHqStructure] = useState(false);
  const canViewDailyBriefing = canAccessDailyBriefing(authUser?.id);

  useEffect(() => {
    let alive = true;
    if (!authUser?.id) { setCanViewHqStructure(false); return () => { alive = false; }; }
    supabase.from('hq_structure_access').select('user_id').eq('user_id', authUser.id).maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) console.error('HQ STRUCTURE ACCESS LOAD ERROR', error);
        setCanViewHqStructure(!error && data?.user_id === authUser.id);
      });
    return () => { alive = false; };
  }, [authUser?.id]);

  // 모바일 웹앱 뒤로가기 제어
  const [exitHint, setExitHint] = useState(false);
  const navInitializedRef = useRef(false);
  const suppressHistoryPushRef = useRef(false);
  const skipNextPopRef = useRef(false);
  const lastExitBackRef = useRef(0);
  const exitHintTimerRef = useRef(null);
  const roleRef = useRef(role);
  const tabRef = useRef(tab);
  const adminTabRef = useRef(adminTab);

  const DEFAULT_EMPLOYEES = [
    { id: 'e01', name: '어진석', branch: '장곡동_장곡역점', position: '사원', hireDate: '2026-08' },
    { id: 'e02', name: '정준희', branch: '본오3동_상록수역점', position: '사원', hireDate: '2026-08' },
    { id: 'e03', name: '정영진', branch: '광정동_산본점', position: '사원', hireDate: '2026-08' },
    { id: 'e04', name: '김창기', branch: '신천동_삼미시장점', position: '사원', hireDate: '2026-07' },
    { id: 'e05', name: '이혜인', branch: '대야동_롯데마트점', position: '사원', hireDate: '2026-07' },
    { id: 'e06', name: '박민주', branch: '본오1동_본오중학교점', position: '사원', hireDate: '2026-07' },
    { id: 'e07', name: '김정아', branch: '본오3동_상록수역점', position: '사원', hireDate: '2026-06' },
    { id: 'e08', name: '허영진', branch: '신천동_삼미시장점', position: '사원', hireDate: '2026-04' },
    { id: 'e09', name: '신다흰', branch: '본오1동_본오중학교점', position: '사원', hireDate: '2026-04' },
    { id: 'e10', name: '권유진', branch: '신천동_삼미시장2호점', position: '사원', hireDate: '2026-03' },
    { id: 'e11', name: '김소인', branch: '본오3동_주민센터점', position: '매니저', hireDate: '2026-03' },
    { id: 'e12', name: '이선영', branch: '광정동_산본점', position: '사원', hireDate: '2026-03' },
    { id: 'e13', name: '김민지', branch: '신천동_삼미시장2호점', position: '부점장', hireDate: '2026-01' },
    { id: 'e14', name: '문유빈', branch: '본오3동_상록수역점', position: '사원', hireDate: '2026-01' },
    { id: 'e15', name: '이수아', branch: '본오3동_주민센터점', position: '사원', hireDate: '2026-01' },
    { id: 'e16', name: '박윤서', branch: '장곡동_장곡역점', position: '사원', hireDate: '2026-01' },
    { id: 'e17', name: '유성민', branch: '광정동_산본점', position: '부점장', hireDate: '2026-01' },
    { id: 'e18', name: '김영중', branch: '고잔동_법조타운점', position: '사원', hireDate: '2026-01' },
    { id: 'e19', name: '김윤석', branch: '월곶동_월곶점', position: '부점장', hireDate: '2025-11' },
    { id: 'e20', name: '김치현', branch: '광정동_산본점', position: '매니저', hireDate: '2025-07' },
    { id: 'e21', name: '박성민', branch: '본오1동_본오중학교점', position: '부점장', hireDate: '2025-06' },
    { id: 'e22', name: '송낙경', branch: '신천동_삼미시장점', position: '부점장', hireDate: '2025-04' },
    { id: 'e23', name: '김주빈', branch: '대야동_롯데마트점', position: '사원', hireDate: '2025-04' },
    { id: 'e24', name: '하윤식', branch: '본오3동_주민센터점', position: '부점장', hireDate: '2025-04' },
    { id: 'e25', name: '이석구', branch: '거모동_도일시장점', position: '사원', hireDate: '2025-04' },
    { id: 'e26', name: '최재혁', branch: '광정동_산본점', position: '부점장', hireDate: '2025-04' },
    { id: 'e27', name: '김도경', branch: '은행동_은계사거리점', position: '사원', hireDate: '2025-04' },
    { id: 'e28', name: '권세민', branch: '거모동_도일시장점', position: '사원', hireDate: '2025-03' },
    { id: 'e29', name: '박석현', branch: '거모동_도일시장점', position: '부점장', hireDate: '2025-02' },
    { id: 'e30', name: '이민우', branch: '장곡동_장곡역점', position: '점장', hireDate: '2024-11' },
    { id: 'e31', name: '신동길', branch: '고잔동_법조타운점', position: '매니저', hireDate: '2024-10' },
    { id: 'e32', name: '이유민', branch: '고잔동_법조타운점', position: '사원', hireDate: '2024-09' },
    { id: 'e33', name: '김정은', branch: '본오3동_상록수역점', position: '부점장', hireDate: '2024-08' },
    { id: 'e34', name: '박다연', branch: '광정동_산본점', position: '사원', hireDate: '2024-07' },
    { id: 'e35', name: '서건주', branch: '신천동_삼미시장2호점', position: '매니저', hireDate: '2024-01' },
    { id: 'e36', name: '박민경', branch: '대야동_롯데마트점', position: '부점장', hireDate: '2023-12' },
    { id: 'e37', name: '최재원', branch: '신천동_삼미시장점', position: '점장', hireDate: '2023-09' },
    { id: 'e38', name: '임지혜', branch: '거모동_도일시장점', position: '점장', hireDate: '2020-10' },
    { id: 'e42', name: '김소원', branch: '월피동_성포역점', position: '점장', hireDate: '2020-10' },
    { id: 'e39', name: '주정민', branch: '본오3동_상록수역점', position: '점장', hireDate: '2020-06' },
    { id: 'e40', name: '전민혁', branch: '은행동_은계사거리점', position: '부점장', hireDate: '2017-06' },
    { id: 'e41', name: '황성휘', branch: '월곶동_월곶점', position: '점장', hireDate: '2017-06' },
  ];

  useEffect(() => {
    roleRef.current = role;
    tabRef.current = tab;
    adminTabRef.current = adminTab;

    if (typeof window === 'undefined') return;

    const currentState = {
      misoApp: true,
      role,
      tab,
      adminTab,
    };

    if (!navInitializedRef.current) {
      // 현재 진입점을 앱의 루트 상태로 만들고, 루트 앞에 한 칸의 보호 히스토리를 둡니다.
      window.history.replaceState({ ...currentState, appRoot: true }, '');
      window.history.pushState({ ...currentState, appGuard: true }, '');
      navInitializedRef.current = true;
      return;
    }

    if (suppressHistoryPushRef.current) {
      suppressHistoryPushRef.current = false;
      return;
    }

    window.history.pushState(currentState, '');
  }, [role, tab, adminTab]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const isRootScreen = (r, employeeTab, managerTab) =>
      r === 'employee' ? employeeTab === 'home' : managerTab === 'dashboard';

    const showExitHint = () => {
      setExitHint(true);
      if (exitHintTimerRef.current) clearTimeout(exitHintTimerRef.current);
      exitHintTimerRef.current = setTimeout(() => setExitHint(false), 2000);
    };

    const onPopState = (event) => {
      if (skipNextPopRef.current) {
        skipNextPopRef.current = false;
        return;
      }

      const now = Date.now();
      const currentIsRoot = isRootScreen(roleRef.current, tabRef.current, adminTabRef.current);
      const state = event.state;

      if (state?.misoApp) {
        const targetRole = state.role || 'employee';
        const targetTab = state.tab || 'home';
        const targetAdminTab = state.adminTab || 'dashboard';
        const targetIsRoot = isRootScreen(targetRole, targetTab, targetAdminTab);

        // 루트 화면에서 뒤로가기를 누른 경우: 첫 번은 안내, 2초 안에 다시 누르면 앱/페이지를 나갑니다.
        if (currentIsRoot && targetIsRoot) {
          if (now - lastExitBackRef.current < 2000) {
            lastExitBackRef.current = 0;
            setExitHint(false);
            skipNextPopRef.current = true;
            window.history.back();
            return;
          }

          lastExitBackRef.current = now;
          showExitHint();
          window.history.pushState({
            misoApp: true,
            role: roleRef.current,
            tab: tabRef.current,
            adminTab: adminTabRef.current,
            appGuard: true,
          }, '');
          return;
        }

        suppressHistoryPushRef.current = true;
        roleRef.current = targetRole;
        tabRef.current = targetTab;
        adminTabRef.current = targetAdminTab;
        setRole(targetRole);
        setTab(targetTab);
        setAdminTab(targetAdminTab);
        return;
      }

      // 예외적으로 앱 히스토리 바깥까지 이동한 경우에도 첫 뒤로가기는 보호합니다.
      if (currentIsRoot && now - lastExitBackRef.current >= 2000) {
        lastExitBackRef.current = now;
        showExitHint();
        window.history.pushState({
          misoApp: true,
          role: roleRef.current,
          tab: tabRef.current,
          adminTab: adminTabRef.current,
          appGuard: true,
        }, '');
      }
    };

    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
      if (exitHintTimerRef.current) clearTimeout(exitHintTimerRef.current);
    };
  }, []);

  const loadConfig = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('app_config')
        .select('config_key,value')
        .in('config_key', ['config', POLICY_HISTORY_CONFIG_KEY]);
      if (error) throw error;
      const values=Object.fromEntries((data||[]).map(row=>[row.config_key,row.value]));
      if (values.config) {
        const legacy={ ...defaultConfig(), ...values.config, vas: mergeDefaultVas(values.config.vas) };
        const resolved=resolvePolicyConfigForMonth(month,legacy,values[POLICY_HISTORY_CONFIG_KEY]);
        setConfig({ ...defaultConfig(), ...resolved, vas: mergeDefaultVas(resolved.vas) });
      } else {
        const def = defaultConfig();
        await supabase.from('app_config').upsert({ config_key: 'config', value: def }, { onConflict: 'config_key' });
        setConfig(resolvePolicyConfigForMonth(month,def));
      }
    } catch (e) {
      console.error('CONFIG LOAD ERROR:', e);
      setConfig(resolvePolicyConfigForMonth(month,defaultConfig()));
    }
  }, [month]);

  const loadStores = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('app_config').select('value').eq('config_key', 'stores').maybeSingle();
      if (error) throw error;
      if (data && data.value && data.value.length) {
        setStores(sortStoresByOpenOrder(data.value));
      } else {
        await supabase.from('app_config').upsert({ config_key: 'stores', value: DEFAULT_STORES }, { onConflict: 'config_key' });
        setStores(DEFAULT_STORES);
      }
    } catch (e) { console.error('STORES LOAD ERROR:', e); setStores(DEFAULT_STORES); }
  }, []);

  const persistStores = async (next) => {
    const ordered = sortStoresByOpenOrder(next);
    setStores(ordered);
    try {
      const { error } = await supabase.from('app_config').upsert({ config_key: 'stores', value: ordered }, { onConflict: 'config_key' });
      if (error) throw error;
    } catch (e) { console.error('STORES SAVE ERROR:', e); setDbError(`매장 목록 저장 실패: ${friendlyError(e)}`); }
  };
  const addStore = (name) => { if (name.trim() && !stores.includes(name.trim())) persistStores([...stores, name.trim()]); };
  const removeStore = (name) => persistStores(stores.filter((s) => s !== name));

  const loadLockedMonths = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('app_config').select('value').eq('config_key', 'locked_months').maybeSingle();
      if (error) throw error;
      setLockedMonths(Array.isArray(data?.value) ? data.value : []);
    } catch (e) { console.error('LOCKED MONTHS LOAD ERROR:', e); setLockedMonths([]); }
  }, []);

  const toggleMonthLock = async (targetMonth, lock) => {
    const next = lock ? [...new Set([...lockedMonths, targetMonth])] : lockedMonths.filter((m) => m !== targetMonth);
    setLockedMonths(next);
    try {
      const { error } = await supabase.from('app_config').upsert({ config_key: 'locked_months', value: next }, { onConflict: 'config_key' });
      if (error) throw error;
    } catch (e) { console.error('MONTH LOCK SAVE ERROR:', e); setDbError(`월 마감 설정 실패: ${friendlyError(e)}`); }
  };

  const loadPolicyBlockedMonths = useCallback(async () => {
    try {
      const {data,error}=await supabase.from('app_config').select('config_key,value').in('config_key',['policy_blocked_months',POLICY_READY_MONTHS_KEY]);
      if(error)throw error;
      const values=Object.fromEntries((data||[]).map(row=>[row.config_key,row.value]));
      setPolicyBlockedMonths(Array.isArray(values.policy_blocked_months)?values.policy_blocked_months:[]);
      setPolicyReadyMonths(Array.isArray(values[POLICY_READY_MONTHS_KEY])?values[POLICY_READY_MONTHS_KEY]:[]);
      setPolicyReadinessLoaded(true);
    } catch(e){console.error('POLICY INPUT BLOCK LOAD ERROR',e);setPolicyReadinessLoaded(false);}
  },[]);

  const togglePolicyInputBlock = async (targetMonth, block) => {
    if(!policyReadinessLoaded)return showAppToast('정책 상태를 확인하지 못했어요. 새로고침 후 다시 시도해주세요.',{tone:'error'});
    if(!block){
      const ok=await showAppConfirm({title:`${monthLabel(targetMonth)} 입력을 시작할까요?`,message:'전달받은 해당 월 정책의 반영과 검증이 모두 끝난 경우에만 입력을 열어주세요. 다음 달은 별도로 잠금이 유지됩니다.',confirmLabel:'정책 반영 완료 · 입력 열기'});
      if(!ok)return;
    }
    const next=block?[...new Set([...policyBlockedMonths,targetMonth])]:policyBlockedMonths.filter(m=>m!==targetMonth);
    const ready=block?policyReadyMonths.filter(m=>m!==targetMonth):[...new Set([...policyReadyMonths,targetMonth])];
    const {data,error}=await supabase.from('app_config').upsert([
      {config_key:'policy_blocked_months',value:next},
      {config_key:POLICY_READY_MONTHS_KEY,value:ready},
    ],{onConflict:'config_key'}).select('config_key');
    if(error||data?.length!==2){setDbError(`정책 입력 상태 저장 실패: ${friendlyError(error||'저장 결과를 확인하지 못했어요.')}`);return;}
    setPolicyBlockedMonths(next);setPolicyReadyMonths(ready);
  };

  const loadPersonalGoals = useCallback(async () => {
    if (!authUser?.id) return;

    const { data, error } = await supabase
      .from('monthly_goals')
      .select('goals')
      .eq('user_id', authUser.id)
      .eq('month', month)
      .maybeSingle();

    if (error) {
      console.error('MONTHLY GOALS LOAD ERROR:', error);
      return;
    }

    const raw = data?.goals;
    setPersonalGoals(raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {});
  }, [authUser?.id, month]);

  const loadScopedEmployeeGoals = useCallback(async () => {
    if (!authUser?.id || !['manager', 'admin'].includes(authProfile?.role)) {
      setEmployeeGoalMap({});
      return;
    }

    setEmployeeGoalsLoading(true);
    const { data, error } = await supabase.rpc('get_scoped_monthly_goals', { target_month: month });
    if (error) {
      console.error('SCOPED MONTHLY GOALS LOAD ERROR:', error);
      setEmployeeGoalMap({});
    } else {
      setEmployeeGoalMap(Object.fromEntries((data || []).map((row) => [row.user_id, {
        goals: row.goals && typeof row.goals === 'object' && !Array.isArray(row.goals) ? row.goals : {},
        updatedAt: row.updated_at || null,
      }])));
    }
    setEmployeeGoalsLoading(false);
  }, [authUser?.id, authProfile?.role, month]);

  const savePersonalGoals = async (goals) => {
    if (!authUser?.id) return false;

    const clean = {};
    Object.entries(goals || {}).forEach(([key, value]) => {
      const n = Number(value);
      if (Number.isFinite(n) && n > 0) clean[key] = n;
    });

    setGoalSaving(true);

    const { error } = await supabase
      .from('monthly_goals')
      .upsert(
        {
          user_id: authUser.id,
          month,
          goals: clean,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,month' }
      );

    if (error) {
      console.error('MONTHLY GOALS SAVE ERROR:', error);
      setDbError(`이번 달 목표 저장 실패: ${friendlyError(error)}`);
      setGoalSaving(false);
      return false;
    }

    setPersonalGoals(clean);
    setEmployeeGoalMap((prev) => ({ ...prev, [authUser.id]: { goals: clean, updatedAt: new Date().toISOString() } }));
    setGoalSaving(false);
    return true;
  };

  const loadEmployees = useCallback(async () => {
    if (!authUser) return [];
    setDbError('');

    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, employee_code, store_name, store_scope, position, hire_date, role, active')
      .eq('status', 'approved')
      .order('name', { ascending: true });

    if (error) {
      console.error('PROFILES LOAD ERROR:', error);
      setDbError(`직원 정보 불러오기 실패: ${friendlyError(error)}`);
      return [];
    }

    let lastSignInMap = {};
    try {
      const { data: signIns, error: siErr } = await supabase.rpc('get_last_sign_ins');
      if (!siErr && signIns) lastSignInMap = Object.fromEntries(signIns.map((s) => [s.id, s.last_sign_in_at]));
    } catch (e) { /* 매니저 이하 권한이면 빈 값, 무시 */ }

    const list = (data || []).map((p) => ({
      id: p.id,
      active: p.active === true,
      name: p.name || (p.id === authUser.id ? (authUser.email || '내 계정') : '이름 미설정'),
      branch: p.store_name || '미지정',
      storeScope: Array.isArray(p.store_scope) ? p.store_scope : [],
      position: p.position || '사원',
      hireDate: p.hire_date || month,
      employeeCode: p.employee_code || '',
      role: p.role || 'employee',
      lastSignInAt: lastSignInMap[p.id] || null,
    }));

    setEmployees(list);
    return list;
  }, [authUser, month]);

  const loadMonth = useCallback(async (m, list) => {
    setLoading(true);
    setDbError('');

    const ids = (list || []).map((e) => e.id);
    const mapped = {};
    ids.forEach((id) => {
      mapped[id] = { draft: emptyDraft(), status: 'none' };
    });

    if (!ids.length) {
      setMonthRecords(mapped);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('monthly_status')
      .select('user_id, month, activity_time_met, data, updated_at')
      .eq('month', m)
      .in('user_id', ids);

    if (error) {
      console.error('MONTHLY LOAD ERROR:', error);
      setDbError(`월별 상태 불러오기 실패: ${friendlyError(error)}`);
    } else {
      (data || []).forEach((row) => {
        const payload = row.data || {};
        mapped[row.user_id] = {
          draft: {
            ...emptyDraft(),
            ...(payload.draft || {}),
            activityTimeMet: row.activity_time_met ?? true,
          },
          status: payload.status || 'none',
          updatedAt: row.updated_at,
        };
      });
    }

    setMonthRecords(mapped);
    setLoading(false);
  }, []);

  const loadDaily = useCallback(async (m, list) => {
    setDbError('');
    const ids = (list || []).map((e) => e.id);
    const mapped = {};
    ids.forEach((id) => { mapped[id] = {}; });

    if (!ids.length) {
      setDailyRecords(mapped);
      return;
    }

    const [yy, mm] = m.split('-').map(Number);
    const nextMonth = new Date(yy, mm, 1);
    const nextKey = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;

    const { data, error } = await readAllPages(()=>supabase
      .from('daily_records')
      .select('user_id, work_date, data, updated_at')
      .in('user_id', ids)
      .gte('work_date', `${m}-01`)
      .lt('work_date', nextKey)
      .order('work_date', { ascending: true }).order('user_id'));

    if (error) {
      console.error('DAILY LOAD ERROR:', error);
      setDbError(`일일 실적 불러오기 실패: ${friendlyError(error)}`);
      setDailyRecords(mapped);
      return;
    }

    (data || []).forEach((row) => {
      if (!mapped[row.user_id]) mapped[row.user_id] = {};
      const dayKey = String(Number(row.work_date.slice(8, 10))).padStart(2, '0');
      mapped[row.user_id][dayKey] = row.data || {};
    });

    setDailyRecords(mapped);
  }, []);

  const loadTeamSalesCredits=useCallback(async(m)=>{
    const [yy,mm]=m.split('-').map(Number),next=new Date(yy,mm,1),to=`${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}-01`;
    const {data,error}=await supabase.from('team_sales_credits').select('id,seller_id,credited_store,sale_date,source_type,source_sale_id,source_refs,metrics,is_completed,note,created_at').gte('sale_date',`${m}-01`).lt('sale_date',to).order('sale_date');
    if(error){console.error('TEAM SALES CREDIT LOAD ERROR',error);setTeamSalesCredits([]);return;}
    setTeamSalesCredits(data||[]);
  },[]);

  const loadHomePolicies = useCallback(async (m,list)=>{
    const ids=(list||[]).map(e=>e.id),mapped={};
    if(!ids.length){setHomePolicyMap({});return;}
    const [yy,mm]=m.split('-').map(Number),next=new Date(yy,mm,1),to=`${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}-01`;
    const [orderRes,saleRes]=await Promise.all([
      readAllPages(()=>supabase.from('home_orders')
        .select('id,user_id,customer_id,customer_name,product_type,network_type,sale_type,main_tv_plan,status,source_work_date,source_group,source_key,actual_install_date')
        .in('user_id',ids).or(`source_work_date.gte.${m}-01,actual_install_date.gte.${m}-01`).order('id')),
      readAllPages(()=>supabase.from('customer_sales').select('source_ref,source_meta').eq('source_type','home_order').in('user_id',ids).gte('sale_date',`${m}-01`).lt('sale_date',to).order('id')),
    ]);
    const {data,error}=orderRes;
    if(error||saleRes.error){console.error('HOME POLICY LOAD ERROR',error||saleRes.error);setHomePolicyMap({});setCancelledLegacyHomeMap({});return;}
    const linkedRefs=new Set((saleRes.data||[]).map(s=>String(s.source_ref||'')).filter(Boolean));
    const cancelledMap={};
    (data||[]).filter(o=>o.status==='cancelled'&&!linkedRefs.has(String(o.id))&&String(o.source_work_date||'').startsWith(m)).forEach(o=>{
      const fallback={homeOnly:['homeBase','homeOnly'],homeTv:['homeBase','homeTv'],tvFree:['homeFlat','tvFree'],smartHome:['homeFlat','smartHome'],internet100:['homeFlat','home100Only'],internet500:['homeFlat','home500Only'],internet1g:['homeFlat','home1GBOnly']}[o.product_type];
      const groupKey=o.source_group||fallback?.[0],itemKey=o.source_key||fallback?.[1],dayKey=String(o.source_work_date||'').slice(8,10);
      if(!groupKey||!itemKey||!dayKey)return;
      cancelledMap[o.user_id]||={}; cancelledMap[o.user_id][dayKey]||={}; cancelledMap[o.user_id][dayKey][groupKey]||={};
      cancelledMap[o.user_id][dayKey][groupKey][itemKey]=Number(cancelledMap[o.user_id][dayKey][groupKey][itemKey]||0)+1;
    });
    setCancelledLegacyHomeMap(cancelledMap);
    ids.forEach(id=>{
      const userOrders=homeOrdersForMonth(enrichHomeOrdersForPolicy((data||[]).filter(o=>o.user_id===id),saleRes.data||[]),m,'completed');
      const completed=userOrders.filter(o=>o.status==='completed');
      mapped[id]=completed.length?calculateHomePolicyEngine(userOrders,config):null;
    });
    setHomePolicyMap(mapped);
  },[config]);

  const loadShadowLedgers = useCallback(async (m,list)=>{
    const ids=(list||[]).map(e=>e.id),mapped={};
    ids.forEach(id=>{mapped[id]={totalSales:0,snapshotSales:0,missingSnapshots:0,shadowMobilePay:0,performancePoints:0,insurancePoints:0,details:[]};});
    if(!ids.length){setShadowLedgerMap(mapped);setStrategicMetricMap({});return;}
    const [yy,mm]=m.split('-').map(Number),next=new Date(yy,mm,1),to=`${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}-01`;
    const {data,error}=await readAllPages(()=>supabase.from('customer_sales')
      .select('id,user_id,sale_date,metric_label,source_meta,customers(customer_name)')
      .eq('source_type','mobile').in('user_id',ids).gte('sale_date',`${m}-01`).lt('sale_date',to).order('id'));
    if(error){console.error('SHADOW LEDGER LOAD ERROR',error);setShadowLedgerMap(mapped);setStrategicMetricMap({});return;}
    (data||[]).forEach(sale=>{
      if(sale.source_meta?.teamOnly)return;
      const row=mapped[sale.user_id]||(mapped[sale.user_id]={totalSales:0,snapshotSales:0,missingSnapshots:0,shadowMobilePay:0,performancePoints:0,insurancePoints:0,details:[]});
      row.totalSales+=1;
      if(!sale.source_meta?.policySnapshot){row.missingSnapshots+=1;return;}
      const result=calculateMobileSale(sale,currentPolicySnapshot(config));
      row.snapshotSales+=1;
      row.shadowMobilePay+=Number(result.paid.plan||0)+Number(result.paid.vas||0)+Number(result.paid.insurance||0)+Number(result.paid.second||0);
      row.performancePoints+=Number(result.performancePoints||0);
      row.insurancePoints+=Number(result.insurancePoints||0);
      row.details.push({id:sale.id,date:sale.sale_date,customer:sale.customers?.customer_name||'고객명 없음',label:sale.metric_label||'모바일',...result});
    });
    setShadowLedgerMap(mapped);
    const strategicMapped={};
    ids.forEach(id=>{strategicMapped[id]=summarizeVasQuality((data||[]).filter(sale=>sale.user_id===id&&!sale.source_meta?.teamOnly));});
    setStrategicMetricMap(strategicMapped);
  },[config]);

  const saveDailyDay = async (day, record) => {
    if (!empId || lockedMonths.includes(month) || policyInputBlocked) return false;

    setDbError('');

    const { error } = await supabase
      .from('daily_records')
      .upsert(
        {
          user_id: empId,
          work_date: `${month}-${day}`,
          data: record,
        },
        { onConflict: 'user_id,work_date' }
      ).select('user_id,work_date').single();

    if (error) {
      console.error('DAILY SAVE ERROR:', error);
      setDbError(`일일 실적 저장 실패: ${friendlyError(error)}`);
      return false;
    }

    setDailyRecords(prev=>({...prev,[empId]:{...(prev[empId]||{}),[day]:record}}));
    return true;
  };

  useEffect(() => { loadConfig(); }, [loadConfig]);
  useEffect(() => { loadStores(); }, [loadStores]);
  useEffect(() => { loadLockedMonths(); }, [loadLockedMonths]);
  useEffect(() => {
    loadPolicyBlockedMonths();
    const refresh=()=>{if(document.visibilityState==='visible')loadPolicyBlockedMonths();};
    window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
    return()=>{window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};
  }, [loadPolicyBlockedMonths]);
  useEffect(() => { loadPersonalGoals(); }, [loadPersonalGoals]);
  useEffect(() => { loadScopedEmployeeGoals(); }, [loadScopedEmployeeGoals]);

  useEffect(() => {
    if (!authUser) return;
    (async () => {
      // Supabase Auth의 last_sign_in_at은 기존 세션으로 앱만 다시 열면 바뀌지 않습니다.
      // 실제 앱 접속 시각을 먼저 기록한 뒤 직원 목록을 불러옵니다.
      const { error: accessError } = await supabase.rpc('touch_app_access');
      if (accessError) console.error('APP ACCESS TOUCH ERROR:', accessError);
      const list = await loadEmployees();
      const own = list.find((e) => e.id === authUser.id);
      const first = own?.id || list[0]?.id || '';
      setEmpId(first);
      await loadMonth(month, list);
      await loadDaily(month, list);
      await loadTeamSalesCredits(month);
      await loadHomePolicies(month, list);
      await loadShadowLedgers(month, list);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.id]);
  useEffect(() => {
    if (!authUser?.id) return undefined;
    const onVisible = async () => {
      if (document.visibilityState !== 'visible') return;
      const { error } = await supabase.rpc('touch_app_access');
      if (error) console.error('APP ACCESS RESUME ERROR:', error);
      if (role === 'admin' && adminTab === 'employees') await loadEmployees();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [authUser?.id, role, adminTab, loadEmployees]);
  useEffect(() => {
    if (role === 'admin' && adminTab === 'employees') {
      loadEmployees();
      loadScopedEmployeeGoals();
    }
  }, [role, adminTab, month]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (employees.length) { loadMonth(month, employees); loadDaily(month, employees); loadTeamSalesCredits(month); loadHomePolicies(month, employees); loadShadowLedgers(month, employees); } }, [month]); // eslint-disable-line
  // 홈 고객별 저장/수정으로 일일 실적이 바뀌면 새 정책 금액도 다시 계산합니다.
  useEffect(() => { if (employees.length) loadHomePolicies(month, employees); }, [dailyRecords]); // eslint-disable-line
  useEffect(() => { if (employees.length) loadTeamSalesCredits(month); }, [dailyRecords]); // eslint-disable-line
  // 판매 저장·수정·삭제로 일일 집계가 바뀌면 관리자 그림자 원장도 즉시 다시 불러옵니다.
  useEffect(() => { if (employees.length) loadShadowLedgers(month, employees); }, [dailyRecords]); // eslint-disable-line

  useEffect(()=>{
    if(!employees.length)return;
    let alive=true;
    (async()=>{
      const ids=employees.map(e=>e.id);
      const [y,m]=month.split('-').map(Number);
      const next=new Date(y,m,1);
      const to=`${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}-01`;
      const {data,error}=await supabase
        .from('spot_claims')
        .select('user_id,final_amount,direct_amount,source_context,spot_policies(amount)')
        .in('user_id',ids)
        .eq('status','approved')
        .eq('source_context','mobile')
        .gte('claim_date',`${month}-01`)
        .lt('claim_date',to);
      if(!alive)return;
      if(error){console.error('MOBILE SPOT LOAD ERROR',error);setApprovedMobileSpotMap({});return;}
      const map={};
      (data||[]).forEach(x=>{
        map[x.user_id]=Number(map[x.user_id]||0)+Number(x.final_amount??x.direct_amount??x.spot_policies?.amount??0);
      });
      setApprovedMobileSpotMap(map);
    })();
    return()=>{alive=false};
  },[month,employees,tab,role,adminTab]);
  useEffect(() => {
    const rec = monthRecords[empId];
    setDraft(rec ? { ...emptyDraft(), ...rec.draft } : emptyDraft());
    setDirty(false); // 서버에서 막 불러온 상태이므로 미저장 변경 아님
  }, [monthRecords, empId]);

  const persistConfig = async (next) => {
    if(isPolicyConfigReadOnly(month)){
      showLegacyAlert(`${monthLabel(month)} 지급정책은 확정 이력으로 보존되어 화면에서 직접 덮어쓸 수 없어요.`);
      return;
    }
    setConfig(next);
    try {
      const { error } = await supabase.from('app_config').upsert({ config_key: 'config', value: next }, { onConflict: 'config_key' });
      if (error) throw error;
    } catch (e) { console.error('CONFIG SAVE ERROR:', e); setDbError(`지급기준 저장 실패: ${friendlyError(e)}`); }
  };
  const persistEmployees = async (next) => {
    setEmployees(next);
    return next;
  };

  const addEmployee = async () => {
    showLegacyAlert('직원 계정 생성은 현재 Supabase Authentication → Users에서 먼저 생성해주세요. 다음 단계에서 관리자 화면의 직원 초대 기능으로 연결할 예정입니다.');
  };

  const updateEmployee = async (id, patch) => {
    const dbPatch = {};
    if (Object.prototype.hasOwnProperty.call(patch, 'name')) dbPatch.name = patch.name;
    if (Object.prototype.hasOwnProperty.call(patch, 'branch')) dbPatch.store_name = patch.branch;
    if (Object.prototype.hasOwnProperty.call(patch, 'position')) dbPatch.position = patch.position;
    if (Object.prototype.hasOwnProperty.call(patch, 'hireDate')) dbPatch.hire_date = patch.hireDate;

    const { error } = await supabase.from('profiles').update(dbPatch).eq('id', id).select('id').single();
    if (error) {
      setDbError(`직원 정보 수정 실패: ${friendlyError(error)}`);
      return;
    }
    setEmployees((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  const removeEmployee = async (id) => {
    setDbError('');
    const { error } = await supabase.from('profiles').update({ active: false }).eq('id', id).select('id').single();
    if (error) {
      console.error('EMPLOYEE DEACTIVATE ERROR:', error);
      setDbError(`직원 비활성화 실패: ${friendlyError(error)}`);
      return;
    }
    await loadEmployees();
  };

  const saveDraft = async (payload) => {
    const body = payload || draft;
    if (!empId || lockedMonths.includes(month) || policyInputBlocked) return;

    setSaving(true);
    setDbError('');

    const cur = monthRecords[empId] || { status: 'none' };
    const status = cur.status === 'approved' ? 'approved' : 'pending';

    const { error } = await supabase
      .from('monthly_status')
      .upsert(
        {
          user_id: empId,
          month,
          activity_time_met: body.activityTimeMet ?? true,
          data: { draft: body, status },
        },
        { onConflict: 'user_id,month' }
      );

    if (error) {
      console.error('MONTHLY SAVE ERROR:', error);
      setDbError(`월별 상태 저장 실패: ${friendlyError(error)}`);
      setSaving(false);
      return;
    }

    const next = {
      draft: body,
      status,
      updatedAt: new Date().toISOString(),
    };

    setMonthRecords((prev) => ({ ...prev, [empId]: next }));
    setDirty(false);
    setLastSavedAt(new Date());
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
    setSaving(false);
  };

  // 실적입력 탭 변경을 표시만 해두고, 아래 자동저장 타이머가 실제 저장을 맡음
  const updateDraft = (next) => {
    if (lockedMonths.includes(month) || policyInputBlocked) return;
    setDraft(next);
    setDirty(true);
  };

  // 자동저장 — 마지막 입력 후 1.2초 동안 조용하면 저장
  const draftRef = useRef(draft);
  draftRef.current = draft;
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => { saveDraft(draftRef.current); }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, dirty]);

  // 저장이 끝나기 전에 창을 닫으려 하면 브라우저 경고
  useEffect(() => {
    if (!dirty) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  // 월/직원을 바꾸기 직전에 남아 있는 변경을 원래 칸에 먼저 저장 (자동저장 타이머가 뜨기 전이어도 안전)
  const pendingRef = useRef({});
  useEffect(() => {
    pendingRef.current = { empId, month, draft, dirty, status: (monthRecords[empId] || {}).status || 'none' };
  });
  useEffect(() => () => {
    const p = pendingRef.current;
    if (!p.dirty || !p.empId) return;
    const status = p.status === 'approved' ? 'approved' : 'pending';
    supabase
      .from('monthly_status')
      .upsert(
        {
          user_id: p.empId,
          month: p.month,
          activity_time_met: p.draft.activityTimeMet ?? true,
          data: { draft: p.draft, status },
        },
        { onConflict: 'user_id,month' }
      )
      .then(({ error }) => {
        if (error) showAppToast(friendlyError(error),{tone:'error',title:'이전 화면의 변경사항 저장 실패'});
      });
  }, [month, empId]);
  const approve = async (id) => {
    const cur = monthRecords[id] || { draft: emptyDraft(), status: 'none' };
    const next = { ...cur, status: 'approved' };

    const { error } = await supabase
      .from('monthly_status')
      .upsert(
        {
          user_id: id,
          month,
          activity_time_met: cur.draft?.activityTimeMet ?? true,
          data: { draft: cur.draft || emptyDraft(), status: 'approved' },
        },
        { onConflict: 'user_id,month' }
      );

    if (error) {
      setDbError(`승인 저장 실패: ${friendlyError(error)}`);
      return;
    }

    setMonthRecords((prev) => ({ ...prev, [id]: next }));
  };

  const rejectApproval = async (id) => {
    const cur = monthRecords[id] || { draft: emptyDraft(), status: 'none' };
    const next = { ...cur, status: 'rejected' };

    const { error } = await supabase
      .from('monthly_status')
      .upsert(
        {
          user_id: id,
          month,
          activity_time_met: cur.draft?.activityTimeMet ?? true,
          data: { draft: cur.draft || emptyDraft(), status: 'rejected' },
        },
        { onConflict: 'user_id,month' }
      );

    if (error) {
      setDbError(`반려 저장 실패: ${friendlyError(error)}`);
      return;
    }

    setMonthRecords((prev) => ({ ...prev, [id]: next }));
  };

  const effectiveDailyRecords=useMemo(()=>Object.fromEntries(employees.map(e=>[
    e.id,applyCancelledLegacyHomeAdjustments(dailyRecords[e.id],cancelledLegacyHomeMap[e.id])
  ])),[employees,dailyRecords,cancelledLegacyHomeMap]);

  const rows = employees.filter(e=>hasMonthHistory(e,{dailyRecords,monthRecords,homePolicyMap,shadowLedgerMap,approvedMobileSpotMap})).map((e) => {
    const rec = monthRecords[e.id] || { draft: emptyDraft(), status: 'none' };
    const mergedBase = applyDailyToDraft(rec.draft, effectiveDailyRecords[e.id], month, config.categoryMap, config.gibyeonColumnMap);
    const mergedDraft = {...mergedBase,homePolicy:homePolicyMap[e.id]||null};
    const pay = computePay(mergedDraft, e.position, e.hireDate, month, config, approvedMobileSpotMap[e.id]||0, strategicMetricMap[e.id]);
    const shadow=shadowLedgerMap[e.id]||{totalSales:0,snapshotSales:0,missingSnapshots:0,shadowMobilePay:0};
    const existingMobilePay=Number(pay.mobilePlanPay||0)+Number(pay.bundle2ndPay||0)+Number(pay.vasPay||0);
    const comparable=shadow.totalSales>0&&shadow.missingSnapshots===0;
    const calculationAudit={...shadow,existingMobilePay,comparable,difference:comparable?Number(shadow.shadowMobilePay||0)-existingMobilePay:null};
    return { ...e, status: rec.status, pay, draft: mergedDraft, calculationAudit, updatedAt: rec.updatedAt };
  });
  const currentEmp = employees.find((e) => e.id === empId);

  // 권한별 조회 범위
  // - 일반 직원/매니저: 본인만
  // - 점장/부점장: 본인 매장
  // - 담당: 전체
  // - 전체 관리자: 전체
  const loginEmp = employees.find((e) => e.id === authUser?.id);
  const isFullAdmin = authProfile?.role === 'admin';
  const isHQManager = ['담당','팀장','대표','실장'].includes(loginEmp?.position);
  const isStoreLeader = ['점장', '부점장'].includes(loginEmp?.position);
  const canViewStoreMemberRows=isFullAdmin||isHQManager||isStoreLeader;

  useEffect(()=>{
    let alive=true;
    if(!authUser?.id||!loginEmp?.branch||canViewStoreMemberRows){setStoreAggregateDays({});return()=>{alive=false};}
    readAllPages(()=>supabase.rpc('get_my_store_performance_days',{p_month:month})).then(({data,error})=>{
      if(!alive)return;
      if(error){console.error('STORE AGGREGATE LOAD ERROR:',error);setStoreAggregateDays({});return;}
      const mapped={};
      (data||[]).forEach(row=>{
        const dayKey=String(Number(String(row.work_date||'').slice(8,10))).padStart(2,'0');
        if(dayKey==='00')return;
        mapped[dayKey]=mergePerformanceDay(mapped[dayKey],row.data||{});
      });
      setStoreAggregateDays(mapped);
    });
    return()=>{alive=false};
  },[authUser?.id,loginEmp?.branch,month,canViewStoreMemberRows]);

  const scopedPerformanceEmployees=scopedEmployeesFor({viewer:loginEmp,authUserId:authUser?.id,isStoreLeader,employees,areaStores:SALES_AREA_STORES});
  const scopedEmployees=activeRoster(scopedPerformanceEmployees);

  useEffect(() => {
    if (!scopedEmployees.length) return;
    if (!scopedEmployees.some((e) => e.id === empId)) {
      setEmpId(scopedEmployees[0].id);
    }
  }, [scopedEmployees, empId]);

  const myMergedBase = applyDailyToDraft(draft, effectiveDailyRecords[empId], month, config.categoryMap, config.gibyeonColumnMap);
  const myMergedDraft = {...myMergedBase,homePolicy:homePolicyMap[empId]||null};
  const myPay = computePay(myMergedDraft, currentEmp?.position || '사원', currentEmp?.hireDate, month, config, approvedMobileSpotMap[empId]||0, strategicMetricMap[empId]);
  const teamCreditDaysByStore=(teamSalesCredits||[]).reduce((map,credit)=>{
    if(credit.source_type==='home'&&!credit.is_completed)return map;
    const store=credit.credited_store,dayKey=String(credit.sale_date||'').slice(8,10);
    if(!store||!dayKey)return map;
    if(!map[store])map[store]={};
    map[store][dayKey]=mergePerformanceDay(map[store][dayKey],credit.metrics||{});
    return map;
  },{});
  const teamCreditRows=Object.entries(teamCreditDaysByStore).map(([branch,days])=>{
    const supportDraft=applyDailyToDraft(emptyDraft(),days,month,config.categoryMap,config.gibyeonColumnMap);
    const supportPay=computePay(supportDraft,'기타',null,month,config,0,null);
    return {id:`team-support:${branch}`,name:'지원 판매',branch,position:'기타',hireDate:null,status:'approved',draft:supportDraft,pay:{...supportPay,total:0,closingAmount:0,guaranteedComponent:0},teamOnly:true};
  });
  // 영업 조직이 아닌 인원(운영진·영업지원팀 등)은 실적표/실적비교에서 제외
  // '기타' 직급(대리입력용 매장 실적 계정)은 건수·성과등급P는 유지하되 인센티브 금액은 0으로 표시(개인 지급 없음)
  const salesRows = [...rows,...teamCreditRows]
    .filter((r) => !NON_SALES_STORES.includes(r.branch))
    .map((r) => (r.position === '기타' ? { ...r, pay: { ...r.pay, total: 0, guaranteedComponent: 0 } } : r));
  const scopedIds = new Set(scopedPerformanceEmployees.map((e) => e.id));
  const scopedRows = rows.filter((r) => scopedIds.has(r.id));
  const scopedBranches=new Set(scopedPerformanceEmployees.map(employee=>employee.branch));
  const scopedSalesRows = salesRows.filter((r) => scopedIds.has(r.id)||(r.teamOnly&&scopedBranches.has(r.branch)));

  const totalPay = scopedSalesRows.reduce((s, r) => s + r.pay.total, 0);
  const pendingCount = scopedRows.filter((r) => r.active!==false && r.status === 'pending').length;

  // 홈 화면 랭킹용 — 본인이 영업 조직 소속일 때만 순위 계산
  // 지원 판매는 매장 합계에는 들어가지만 가상의 개인/직원으로 순위에 노출하지 않습니다.
  const personalSalesRows=salesRows.filter((r)=>!r.teamOnly);
  const storeAggregateDraft=applyDailyToDraft(emptyDraft(),storeAggregateDays,month,config.categoryMap,config.gibyeonColumnMap);
  const storeAggregatePay=computePay(storeAggregateDraft,'기타',null,month,config,0,null);
  const anonymousStoreRow={id:'my-store-aggregate',name:'우리 매장 합계',branch:loginEmp?.branch||currentEmp?.branch||'',position:'기타',draft:storeAggregateDraft,pay:{...storeAggregatePay,total:0,closingAmount:0,guaranteedComponent:0},storeAggregate:true};
  const storeOverviewRows=canViewStoreMemberRows
    ? salesRows
    : [anonymousStoreRow,...salesRows.filter(row=>row.teamOnly&&row.branch===anonymousStoreRow.branch)];
  const rankedSorted = [...personalSalesRows].sort((a, b) => b.pay.total - a.pay.total);
  const myRankIndex = rankedSorted.findIndex((r) => r.id === empId);
  const myRank = myRankIndex >= 0 ? myRankIndex + 1 : null;
  const myRankTotal = rankedSorted.length;
  const myBranchRanked = rankedSorted.filter((r) => r.branch === currentEmp?.branch);
  const myBranchRankIndex = myBranchRanked.findIndex((r) => r.id === empId);
  const myBranchRank = myBranchRankIndex >= 0 ? myBranchRankIndex + 1 : null;

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <AppFeedbackHost />
      {exitHint && (
        <div className="fixed left-1/2 bottom-6 -translate-x-1/2 z-[100] w-[calc(100%-32px)] max-w-sm">
          <div className="bg-gray-900/95 text-white text-sm font-medium text-center rounded-xl px-4 py-3 shadow-xl">
            앱을 나가려면 뒤로가기를 한 번 더 눌러주세요
          </div>
        </div>
      )}
      <div className="app-header border-b border-gray-200 sticky top-0 z-20">
        <div className="app-header-main max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center"><Trophy size={18} className="text-white" /></div>
            <div>
              <div className="font-bold text-gray-900 leading-tight">미소페이</div>

            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              <button onClick={() => setRole('employee')} className={`px-3 py-1.5 rounded-md text-sm font-medium ${role === 'employee' ? 'bg-white shadow text-brand-700' : 'text-gray-500'}`}>직원</button>
              {['manager', 'admin'].includes(authProfile?.role) && (
                <button onClick={() => setRole('admin')} className={`px-3 py-1.5 rounded-md text-sm font-medium ${role === 'admin' ? 'bg-white shadow text-brand-700' : 'text-gray-500'}`}>관리자</button>
              )}
            </div>
            <div className="hidden sm:block text-right leading-tight">
              <div className="text-xs font-semibold text-gray-700">{authProfile?.name || authUser?.email}</div>
              <div className="text-[10px] text-gray-400">{ROLE_LABELS[authProfile?.role] || authProfile?.role}</div>
            </div>
            <PwaInstallButton />
            <button type="button" onClick={()=>setQuickGuideOpen(true)} title="사용 안내" className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-100 bg-white text-gray-500 hover:text-brand-600"><HelpCircle size={16}/></button>
            <NotificationBell userId={authUser?.id} onOpen={()=>setNotificationOpen(true)} />
            {onSignOut && (
              <button onClick={onSignOut} title="로그아웃" className="text-gray-400 hover:text-red-500 p-1.5 shrink-0">
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
        {role === 'employee' && (
          <div className="max-w-5xl mx-auto px-4 pb-3 flex items-center gap-2">
            <span className="text-xs text-gray-400">조회 직원</span>
            <select
              value={empId}
              onChange={(e) => setEmpId(e.target.value)}
              disabled={scopedEmployees.length <= 1}
              className="text-sm font-medium bg-brand-50 text-brand-700 px-2.5 py-1 rounded-lg border border-brand-100 disabled:opacity-80"
            >
              {scopedEmployees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} · {e.position} · {displayStoreName(e.branch)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <AppQuickGuide open={quickGuideOpen} onClose={closeQuickGuide} isManager={role==='admin'} />

      {notificationOpen&&<div className="fixed inset-0 z-[115] bg-black/45 flex items-end sm:items-center justify-center" onClick={()=>setNotificationOpen(false)}>
        <div className="w-full max-w-md max-h-[86vh] overflow-y-auto bg-gray-50 rounded-t-3xl sm:rounded-3xl p-4" onClick={e=>e.stopPropagation()}>
          <div className="flex items-center justify-between mb-3"><div className="text-lg font-bold text-gray-900">알림센터</div><button onClick={()=>setNotificationOpen(false)} className="w-8 h-8 rounded-full bg-white text-gray-500">×</button></div>
          <NotificationCenter userId={authUser?.id} />
        </div>
      </div>}

      {dbError && (
        <div className="max-w-5xl mx-auto px-4 pt-3">
          <div className="bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl px-3 py-2">
            {dbError}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24 text-gray-400 gap-2"><Loader2 size={18} className="animate-spin" /> 불러오는 중...</div>
      ) : role === 'employee' ? (
        <EmployeeView key={`${empId}:${month}`}
          tab={tab} setTab={setTab} months={months} month={month} setMonth={setMonth}
          draft={draft} setDraft={updateDraft} config={config} pay={myPay} mergedDraft={myMergedDraft}
          status={(monthRecords[empId] || {}).status || 'none'}
          saveDraft={saveDraft} saving={saving} saved={saved} dirty={dirty} lastSavedAt={lastSavedAt}
          dailyDays={effectiveDailyRecords[empId] || {}} allDailyRecords={effectiveDailyRecords} saveDailyDay={saveDailyDay}
          monthLocked={lockedMonths.includes(month)}
          policyInputBlocked={policyInputBlocked}
          canSeeCriteria={currentEmp?.branch === '운영진' || ['점장', '부점장'].includes(currentEmp?.position)}
          myRank={myRank} myRankTotal={myRankTotal} myBranchRank={myBranchRank} myBranchTotal={myBranchRanked.length}
          currentEmp={currentEmp}
          loginEmp={loginEmp}
          stores={stores}
          onTeamCreditSaved={()=>loadTeamSalesCredits(month)}
          onSalesChanged={()=>Promise.all([loadDaily(month,employees),loadShadowLedgers(month,employees)])}
          onHomeOrdersChanged={()=>Promise.all([loadHomePolicies(month,employees),loadDaily(month,employees)])}
          personalGoals={personalGoals}
          savePersonalGoals={savePersonalGoals}
          goalSaving={goalSaving}
          showPersonalGoal={empId === authUser?.id}
          competitionRows={personalSalesRows}
          storeOverviewRows={storeOverviewRows}
          canViewStoreRanking={canViewStoreMemberRows}
          authUser={authUser} authProfile={authProfile}
          onOpenStoreGoals={()=>{setRole('admin');setAdminTab('storeGoals')}}
        />
      ) : (
        <AdminView
          adminTab={adminTab} setAdminTab={setAdminTab} months={months} month={month} setMonth={setMonth}
          rows={scopedSalesRows} rankingRows={personalSalesRows} dailyRecords={effectiveDailyRecords} totalPay={totalPay} pendingCount={pendingCount} approve={approve} rejectApproval={rejectApproval}
          config={config} persistConfig={persistConfig}
          employees={scopedEmployees} addEmployee={addEmployee} updateEmployee={updateEmployee} removeEmployee={removeEmployee}
          stores={stores} addStore={addStore} removeStore={removeStore}
          isFullAdmin={isFullAdmin}
          canManagePermissions={authUser?.id===PRIMARY_PERMISSION_ADMIN_ID}
          authUserId={authUser?.id}
          loginPosition={loginEmp?.position||''}
          loginBranch={loginEmp?.branch||''}
          canSwitchStores={isFullAdmin||isHQManager}
          canViewHqStructure={canViewHqStructure}
          canViewDailyBriefing={canViewDailyBriefing}
          employeeGoalMap={employeeGoalMap}
          employeeGoalsLoading={employeeGoalsLoading}
          refreshEmployeeGoals={loadScopedEmployeeGoals}
          monthLocked={lockedMonths.includes(month)} toggleMonthLock={toggleMonthLock}
          policyInputBlocked={policyInputBlocked} togglePolicyInputBlock={togglePolicyInputBlock}
        />
      )}
    </div>
  );
}

/* ===================== v21.60 평가 시스템 ===================== */




/* ===================== 직원 화면 ===================== */

/* v21.27 직원 홈 재구성: 홈-개인 / 홈-매장, 월 누적 성과 랭킹 */



function MonthlyPerformanceRankingCard({ rows, userId, userName='', userBranch='', branchOnly=null, title='월 누적 순위', showAll=false }) {
  const [metricKey,setMetricKey]=useState('hs');
  const metric=MONTHLY_RANK_METRICS.find(m=>m.key===metricKey)||MONTHLY_RANK_METRICS[0];
  const ranked=useMemo(()=>[...(rows||[])]
    .filter(r=>!NON_SALES_STORES.includes(r.branch))
    .filter(r=>!branchOnly || r.branch===branchOnly)
    .sort((a,b)=>Number(metric.value(b)||0)-Number(metric.value(a)||0) || a.name.localeCompare(b.name)),
    [rows,branchOnly,metricKey]);

  if(!ranked.length)return null;
  const rankOf=(row)=>{
    const v=Number(metric.value(row)||0);
    return 1+ranked.filter(r=>Number(metric.value(r)||0)>v).length;
  };
  const top3=ranked.filter(r=>rankOf(r)<=3);
  const displayRows=showAll?ranked:top3;
  // v21.35: 로그인 auth id와 직원 row id가 다른 환경도 있어 현재 직원 정보로 한 번 더 찾음
  let myIndex=ranked.findIndex(r=>String(r.id||'')===String(userId||''));
  if(myIndex<0 && userName){
    myIndex=ranked.findIndex(r=>
      String(r.name||'').trim()===String(userName||'').trim() &&
      (!userBranch || String(r.branch||'')===String(userBranch||''))
    );
  }
  let me=myIndex>=0?ranked[myIndex]:null;

  // 경쟁행에 현재 직원 자체가 빠진 경우에도 0 실적으로 '나' 행을 항상 만들어 줌
  const fallbackMe=!me && (userId||userName) ? {
    id:userId||'current-user',
    name:userName||'나',
    branch:userBranch||branchOnly||'',
    draft:{},
    pay:{kpiScore:0}
  } : null;
  me=me||fallbackMe;

  const myValue=Number(metric.value(me)||0);
  const myRank=me ? 1+ranked.filter(r=>Number(metric.value(r)||0)>myValue).length : null;
  const sameValueCount=me ? ranked.filter(r=>Number(metric.value(r)||0)===myValue).length + (fallbackMe?1:0) : 0;
  const myTied=sameValueCount>1;
  const fmt=(v)=>metric.unit==='P'?`${fmtNum(Number(v||0),1)}P`:`${fmtCount(v)}건`;

  return <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
    <div className="px-4 py-3 border-b border-gray-50">
      <div className="flex items-end justify-between gap-2">
        <div>
          <div className="text-[11px] text-gray-400">{branchOnly?displayStoreName(branchOnly):'전체 직원'}</div>
          <div className="text-sm font-bold text-gray-900">{title}</div>
        </div>
        <div className="text-[10px] text-gray-400">월 누적 기준</div>
      </div>
      <div className="flex gap-1.5 overflow-x-auto mt-3 pb-0.5">
        {MONTHLY_RANK_METRICS.map(m=><button key={m.key} type="button" onClick={()=>setMetricKey(m.key)}
          className={`shrink-0 px-2.5 py-1.5 rounded-full border text-[10px] font-semibold ${metricKey===m.key?'bg-brand-600 border-brand-600 text-white':'bg-white border-gray-200 text-gray-500'}`}>
          {m.label}
        </button>)}
      </div>
    </div>

    <div className="divide-y divide-gray-50">
      {displayRows.map((r)=>{
        const rr=rankOf(r);
        const isMe=String(r.id||'')===String(userId||'') || (userName&&String(r.name||'').trim()===String(userName||'').trim()&&(!userBranch||String(r.branch||'')===String(userBranch||'')));
        return <div key={r.id} className={`flex items-center justify-between px-4 py-2.5 gap-3 ${showAll&&isMe?'bg-brand-50':''}`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${rr===1?'bg-amber-100 text-amber-700':rr===2?'bg-gray-100 text-gray-600':'bg-orange-50 text-orange-600'}`}>{rr}</span>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-gray-800 truncate">{r.name}{showAll&&isMe&&<span className="ml-1 text-[9px] text-brand-600">나</span>}</div>
            {!branchOnly&&<div className="text-[10px] text-gray-400 truncate">{displayStoreName(r.branch)}</div>}
          </div>
        </div>
        <div className="text-xs font-bold text-gray-800">{fmt(metric.value(r))}</div>
      </div>})}
    </div>

    {!showAll&&me&&<div className="px-4 py-2.5 bg-brand-50 flex items-center justify-between">
      <span className="text-xs font-semibold text-brand-700">나 · {myTied?'공동 ':''}{fmtCount(myRank)}위</span>
      <span className="text-xs font-bold text-brand-700">{fmt(metric.value(me))}</span>
    </div>}
  </div>;
}

function StoreHomeOverview({ config, rows, branches=[], scopeLabel='', month, userId, userName='', canEditGoals=false, onOpenGoals, showRanking=true }) {
  const scopedBranches=[...new Set((branches||[]).filter(Boolean).filter(branch=>!NON_SALES_STORES.includes(branch)))];
  const members=(rows||[]).filter(r=>scopedBranches.includes(r.branch));
  const finalPerformances=useFinalStorePerformance(month);
  if(!scopedBranches.length || !members.length)return <div className="bg-white rounded-2xl border border-gray-100 p-4 text-sm text-gray-400">현재 선택 범위의 매장 실적을 불러올 수 없어요.</div>;

  const sum=(fn)=>members.reduce((a,r)=>a+Number(fn(r)||0),0);
  const forecastFactor=performanceForecastFactor(month);

  const inputMetrics=[
    {key:'hs',label:'HS',unit:'count',current:sum(r=>hsCount(r.draft))},
    {key:'simMnp',label:'SIM MNP',unit:'count',current:sum(r=>(r.draft?.matrix?.[5]||[]).reduce((s,v)=>s+Number(v||0),0))},
    {key:'second',label:'2ND',unit:'count',current:sum(r=>(r.draft?.matrix?.[7]||[]).reduce((s,v)=>s+Number(v||0),0)+Object.values(r.draft?.bundle2nd||{}).reduce((s,v)=>s+Number(v||0),0))},
    {key:'productivity',label:'생산성',unit:'point',current:sum(r=>r.pay?.kpiScore||0)},
    {key:'home',label:'홈',unit:'count',current:sum(r=>completedHomeCount(r.draft))},
    {key:'free',label:'프리',unit:'count',current:sum(r=>r.draft?.homeFlat?.tvFree||0)},
    {key:'smart',label:'스홈',unit:'count',current:sum(r=>r.draft?.homeFlat?.smartHome||0)},
    {key:'sono',label:'소노',unit:'count',current:sum(r=>Object.values(r.draft?.sono||{}).reduce((s,v)=>s+Number(v||0),0))},
    {key:'tailoredAmount',label:'맞춤제안 매출액',unit:'won',current:sum(r=>r.draft?.tailoredAmount||0)},
    {key:'tailored',label:'업셀건',unit:'count',current:sum(r=>r.draft?.tailoredCount||0)},
  ];
  const metrics=inputMetrics.map(m=>{
    let forecast=0;
    const current=scopedBranches.reduce((total,branch)=>{
      const branchMembers=members.filter(row=>row.branch===branch);
      const branchMetric=inputMetrics.find(metric=>metric.key===m.key);
      const inputValue=branchMembers.reduce((sumValue,row)=>{
        if(m.key==='hs')return sumValue+hsCount(row.draft);
        if(m.key==='simMnp')return sumValue+(row.draft?.matrix?.[5]||[]).reduce((s,v)=>s+Number(v||0),0);
        if(m.key==='second')return sumValue+(row.draft?.matrix?.[7]||[]).reduce((s,v)=>s+Number(v||0),0)+Object.values(row.draft?.bundle2nd||{}).reduce((s,v)=>s+Number(v||0),0);
        if(m.key==='productivity')return sumValue+Number(row.pay?.kpiScore||0);
        if(m.key==='home')return sumValue+completedHomeCount(row.draft);
        if(m.key==='free')return sumValue+Number(row.draft?.homeFlat?.tvFree||0);
        if(m.key==='smart')return sumValue+Number(row.draft?.homeFlat?.smartHome||0);
        if(m.key==='sono')return sumValue+Object.values(row.draft?.sono||{}).reduce((s,v)=>s+Number(v||0),0);
        if(m.key==='tailoredAmount')return sumValue+Number(row.draft?.tailoredAmount||0);
        if(m.key==='tailored')return sumValue+Number(row.draft?.tailoredCount||0);
        return sumValue+Number(branchMetric?.current||0);
      },0);
      const final=finalPerformances?.[branch]?.month===month?finalPerformances[branch]:null;
      const value=finalStoreMetric(final,m.key,inputValue);
      forecast+=final?value:value*forecastFactor;
      return total+value;
    },0);
    return {...m,value:current,forecast:m.unit==='count'?Math.round(forecast):forecast};
  });

  return <div className="space-y-4">
    <PerformanceCard month={month} title="이번 달 실적" scopeLabel={`매장 · ${scopeLabel||displayStoreName(scopedBranches[0])}`}
      metrics={metrics}
      scopeRows={members} branches={scopedBranches} config={config} mode="store" testPrefix="store" loadStoreGoals
      onEditGoals={canEditGoals?onOpenGoals:undefined}
    />

    {showRanking&&<MonthlyPerformanceRankingCard
      rows={members}
      userId={userId}
      userName={userName}
      userBranch={scopedBranches.length===1?scopedBranches[0]:''}
      branchOnly={scopedBranches.length===1?scopedBranches[0]:''}
      title={`${scopeLabel||displayStoreName(scopedBranches[0])} 월 누적 순위`}
      showAll
    />}
  </div>;
}


function getWorkActivityStats(dailyDays, month) {
  const [yy, mm] = month.split('-').map(Number);
  const now = new Date();
  const isCurrentMonth = monthKeyOf(now) === month;
  const lastDay = isCurrentMonth ? now.getDate() : daysInMonth(month);

  let activeDays = 0;
  for (let d = 1; d <= lastDay; d++) {
    const key = String(d).padStart(2, '0');
    const rec = normalizeDay(dailyDays?.[key]);
    if (!rec.dayOff && dayHasData(rec)) activeDays += 1;
  }

  let streak = 0;
  let todayHasData = false;
  let todayOff = false;

  for (let d = lastDay; d >= 1; d--) {
    const key = String(d).padStart(2, '0');
    const rec = normalizeDay(dailyDays?.[key]);

    if (isCurrentMonth && d === now.getDate()) {
      todayOff = !!rec.dayOff;
      todayHasData = !rec.dayOff && dayHasData(rec);
      if (rec.dayOff) continue;
      if (!dayHasData(rec)) continue; // 오늘은 아직 입력 전이어도 기존 연속 기록 유지
    }

    if (rec.dayOff) continue;
    if (dayHasData(rec)) {
      streak += 1;
      continue;
    }
    break;
  }

  return { activeDays, streak, todayHasData, todayOff, isCurrentMonth };
}

function WorkActivityCard({ dailyDays, month, onGoInput }) {
  const stats = useMemo(() => getWorkActivityStats(dailyDays, month), [dailyDays, month]);

  let message = '';
  if (!stats.isCurrentMonth) {
    message = `${monthLabel(month)} 활동 기록이에요`;
  } else if (stats.todayOff) {
    message = '오늘은 휴무예요. 푹 쉬고 다음 근무일부터 이어가요 :)';
  } else if (stats.todayHasData) {
    message = stats.streak > 0 ? '오늘 기록도 이어졌어요 🙌' : '오늘 기록 완료 🙌';
  } else if (stats.streak > 0) {
    message = `오늘 기록하면 ${stats.streak + 1}일 연속!`;
  } else {
    message = '오늘부터 첫 기록을 남겨보세요 🌱';
  }

  return (
    <button onClick={onGoInput} className="w-full text-left bg-white rounded-xl border border-orange-100 p-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center text-lg shrink-0">🔥</div>
        <div className="min-w-0 flex-1">
          <div className="text-xs text-gray-400">이번 달 활동</div>
          <div className="text-base font-bold text-gray-900 mt-0.5">
            {stats.streak > 0 ? `${stats.streak}근무일 연속 기록 중` : '기록을 시작해볼까요?'}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">{message}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-lg font-bold text-orange-600">{stats.activeDays}</div>
          <div className="text-[10px] text-gray-400">활동일</div>
        </div>
      </div>
    </button>
  );
}

const COMPETITION_METRICS = [
  { key: 'hs', label: 'HS', unit: '건', value: (r) => hsCount(r.draft) },
  { key: 'home', label: '홈', unit: '건', value: (r) => completedHomeCount(r.draft) },
  { key: 'tvFree', label: 'TV프리(부)', unit: '건', value: (r) => Number(r.draft?.homeFlat?.tvFree || 0) },
  { key: 'smartHome', label: '스마트홈', unit: '건', value: (r) => Number(r.draft?.homeFlat?.smartHome || 0) },
  { key: 'kpi', label: '생산성', unit: 'P', value: (r) => Number(r.pay?.kpiScore || 0) },
  { key: 'tailored', label: '맞춤제안', unit: '건', value: (r) => Number(r.draft?.tailoredCount || 0) },
];


function recentWindowDaysMap(daysMap, month, windowSize = 7) {
  const now = new Date();
  const isCurrent = monthKeyOf(now) === month;
  const endDay = isCurrent ? now.getDate() : daysInMonth(month);
  const startDay = Math.max(1, endDay - windowSize + 1);

  const out = {};
  for (let d = startDay; d <= endDay; d++) {
    const key = String(d).padStart(2, '0');
    if (daysMap?.[key]) out[key] = daysMap[key];
  }
  return out;
}

function metricValueFromDailyWindow(employee, daysMap, month, config, metricKey) {
  const windowDays = recentWindowDaysMap(daysMap, month, 7);
  const merged = applyDailyToDraft(
    emptyDraft(),
    windowDays,
    month,
    config.categoryMap,
    config.gibyeonColumnMap
  );
  const pay = computePay(
    merged,
    employee?.position || '사원',
    employee?.hireDate,
    month,
    config
  );

  const tempRow = { ...employee, draft: merged, pay };
  const metric = COMPETITION_METRICS.find((m) => m.key === metricKey) || COMPETITION_METRICS[0];
  return Number(metric.value(tempRow) || 0);
}

function buildRisingRanking(rows, dailyRecords, month, config, metricKey) {
  return [...(rows || [])]
    .filter((r) => !NON_SALES_STORES.includes(r.branch))
    .map((r) => ({
      ...r,
      recentValue: metricValueFromDailyWindow(
        r,
        dailyRecords?.[r.id] || {},
        month,
        config,
        metricKey
      ),
    }))
    .sort((a, b) => b.recentValue - a.recentValue || a.name.localeCompare(b.name));
}

function RisingRankingCard({ rows, dailyRecords, month, config, userId }) {
  const [metricKey, setMetricKey] = useState('hs');
  const metric = COMPETITION_METRICS.find((m) => m.key === metricKey) || COMPETITION_METRICS[0];

  const ranked = useMemo(
    () => buildRisingRanking(rows, dailyRecords, month, config, metricKey),
    [rows, dailyRecords, month, config, metricKey]
  );

  const top3 = ranked.slice(0, 3);
  const myIndex = ranked.findIndex((r) => r.id === userId);
  const me = myIndex >= 0 ? ranked[myIndex] : null;

  if (!ranked.length) return null;

  return (
    <div className="bg-white rounded-xl border border-orange-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-orange-50 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs text-orange-500">최근 7일</div>
          <div className="text-sm font-bold text-gray-900">급상승 랭킹 🔥</div>
        </div>
        <select
          value={metricKey}
          onChange={(e) => setMetricKey(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
        >
          {COMPETITION_METRICS.map((m) => (
            <option key={m.key} value={m.key}>{m.label}</option>
          ))}
        </select>
      </div>

      <div className="divide-y divide-gray-50">
        {top3.map((r, i) => (
          <div key={r.id} className="flex items-center justify-between px-4 py-3 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                i === 0
                  ? 'bg-amber-100 text-amber-700'
                  : i === 1
                    ? 'bg-gray-100 text-gray-600'
                    : 'bg-orange-100 text-orange-700'
              }`}>
                {i + 1}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-800 truncate">{r.name}</div>
                <div className="text-[11px] text-gray-400 truncate">{displayStoreName(r.branch)}</div>
              </div>
            </div>
            <div className="text-sm font-bold text-orange-600 shrink-0">
              +{formatCompetitionValue(r.recentValue, metric.unit)}
            </div>
          </div>
        ))}
      </div>

      {me && myIndex >= 3 && (
        <div className="px-4 py-3 bg-brand-50 flex items-center justify-between gap-3">
          <div className="text-xs font-semibold text-brand-700">나는 현재 {myIndex + 1}위</div>
          <div className="text-sm font-bold text-brand-700">
            +{formatCompetitionValue(me.recentValue, metric.unit)}
          </div>
        </div>
      )}
    </div>
  );
}

function formatCompetitionValue(v, unit) {
  return unit === 'P' ? `${fmtNum(Number(v || 0), 1)}P` : `${fmtCount(v)}건`;
}

function MyRankingCard({ rows, userId, branch }) {
  const [metricKey, setMetricKey] = useState('hs');
  const metric = COMPETITION_METRICS.find((m) => m.key === metricKey) || COMPETITION_METRICS[0];

  const ranked = useMemo(() => [...(rows || [])]
    .filter((r) => !NON_SALES_STORES.includes(r.branch))
    .sort((a, b) => metric.value(b) - metric.value(a) || a.name.localeCompare(b.name)),
  [rows, metricKey]);

  const idx = ranked.findIndex((r) => r.id === userId);
  if (idx < 0 || ranked.length <= 1) return null;

  const mine = ranked[idx];
  const above = idx > 0 ? ranked[idx - 1] : null;
  const below = idx < ranked.length - 1 ? ranked[idx + 1] : null;
  const gap = above ? Math.max(0, metric.value(above) - metric.value(mine)) : 0;

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <div className="text-xs text-gray-400">내 주변 순위</div>
          <div className="text-sm font-bold text-gray-900">전체 {idx + 1}위 · {mine.name}</div>
        </div>
        <select value={metricKey} onChange={(e) => setMetricKey(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
          {COMPETITION_METRICS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select>
      </div>

      <div className="space-y-1.5">
        {above && (
          <div className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-gray-50">
            <span>{idx}위 · {above.name}</span>
            <b>{formatCompetitionValue(metric.value(above), metric.unit)}</b>
          </div>
        )}
        <div className="flex items-center justify-between text-sm px-3 py-2 rounded-lg bg-brand-50 text-brand-800">
          <span className="font-bold">{idx + 1}위 · {mine.name}</span>
          <b>{formatCompetitionValue(metric.value(mine), metric.unit)}</b>
        </div>
        {below && (
          <div className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-gray-50">
            <span>{idx + 2}위 · {below.name}</span>
            <b>{formatCompetitionValue(metric.value(below), metric.unit)}</b>
          </div>
        )}
      </div>

      {above && (
        <div className="text-xs text-gray-500 mt-3">
          {idx === 1 ? '1위' : `${idx}위`}까지 <b className="text-brand-700">
            {formatCompetitionValue(gap, metric.unit)}
          </b> 차이예요 🔥
        </div>
      )}
    </div>
  );
}


/* ===================== 게임화 2차: 배지 · 퀘스트 · 칭호 · 인정 ===================== */



const SPECIAL_BADGE_KEYS = [];

function badgeDefOf(key) {
  return BADGE_DEFS.find((b) => b.key === key) || null;
}



function RecognitionSpotlight({ rows, dailyRecords, month, config, specialFeed }) {
  const highlights = useMemo(() => {
    const out = [];

    // 월간 1위 중 서로 다른 사람을 최대 2명 노출
    const used = new Set();
    for (const metric of COMPETITION_METRICS) {
      const ranked = [...(rows || [])]
        .filter((r) => !NON_SALES_STORES.includes(r.branch))
        .sort((a, b) => metric.value(b) - metric.value(a));
      const top = ranked[0];
      if (top && Number(metric.value(top) || 0) > 0 && !used.has(top.id)) {
        out.push({
          id: `month-${metric.key}-${top.id}`,
          icon: '👑',
          title: `${metric.label} 전체 1위`,
          name: top.name,
          branch: top.branch,
        });
        used.add(top.id);
      }
      if (out.length >= 2) break;
    }

    // 최근 7일 급상승 1명
    const rising = buildRisingRanking(rows, dailyRecords, month, config, 'hs')[0];
    if (rising && rising.recentValue > 0 && !used.has(rising.id)) {
      out.push({
        id: `rising-${rising.id}`,
        icon: '⚡',
        title: '최근 7일 HS 급상승',
        name: rising.name,
        branch: rising.branch,
      });
    }

    return out.slice(0, 3);
  }, [rows, dailyRecords, month, config]);

  const combined = [
    ...(specialFeed || []).slice(0, 2),
    ...highlights,
  ].slice(0, 4);

  if (!combined.length) return null;

  return (
    <div className="bg-white rounded-xl border border-amber-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-amber-50">
        <div className="text-xs text-amber-600">지금 주목할 사람 ✨</div>
        <div className="text-sm font-bold text-gray-900 mt-0.5">좋은 기록은 같이 봐야 제맛</div>
      </div>

      <div className="divide-y divide-gray-50">
        {combined.map((item) => (
          <div key={item.id} className="px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-lg shrink-0">
              {item.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-gray-800 truncate">{item.name}</div>
              <div className="text-xs text-brand-600 font-medium mt-0.5">{item.title}</div>
              {item.branch && <div className="text-[10px] text-gray-400 mt-0.5 truncate">{displayStoreName(item.branch)}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HallOfFame({rows,month}){
  const [profiles,setProfiles]=useState({}),[titles,setTitles]=useState({}),[avatars,setAvatars]=useState({}),[selected,setSelected]=useState(null),[showAll,setShowAll]=useState(false);
  const salesRows=useMemo(()=>[...(rows||[])].filter(r=>!NON_SALES_STORES.includes(r.branch)),[rows]);
  useEffect(()=>{let alive=true;const urls=[];(async()=>{const ids=salesRows.map(r=>r.id).filter(Boolean);if(!ids.length)return;const [{data:p},{data:t}]=await Promise.all([supabase.from('employee_public_profiles').select('user_id,avatar_path,status_message').in('user_id',ids),supabase.from('user_titles').select('user_id,badge_key').in('user_id',ids)]);if(!alive)return;setProfiles(Object.fromEntries((p||[]).map(x=>[x.user_id,x])));setTitles(Object.fromEntries((t||[]).map(x=>[x.user_id,x.badge_key])));const pairs=await Promise.all((p||[]).filter(x=>x.avatar_path).map(async x=>{const {data}=await supabase.storage.from('profile-avatars').download(x.avatar_path);if(!data)return null;const url=URL.createObjectURL(data);urls.push(url);return [x.user_id,url]}));if(alive)setAvatars(Object.fromEntries(pairs.filter(Boolean)))})();return()=>{alive=false;urls.forEach(URL.revokeObjectURL)}},[salesRows]);
  if(!salesRows.length)return null;
  const metric=(key)=>MONTHLY_RANK_METRICS.find(x=>x.key===key);
  const leader=(key)=>[...salesRows].sort((a,b)=>Number(metric(key).value(b)||0)-Number(metric(key).value(a)||0))[0];
  const rankSum=(r)=>['hs','home','productivity'].reduce((s,k)=>s+1+salesRows.filter(x=>Number(metric(k).value(x)||0)>Number(metric(k).value(r)||0)).length,0);
  const mvp=[...salesRows].sort((a,b)=>rankSum(a)-rankSum(b)||hsCount(b.draft)-hsCount(a.draft))[0];
  const title=(r)=>badgeDefOf(titles[r?.id]);
  const avatar=(r,cls='w-11 h-11')=><div className={`${cls} rounded-2xl overflow-hidden bg-brand-100 text-brand-700 flex items-center justify-center font-black shrink-0`}>{avatars[r?.id]?<img src={avatars[r.id]} alt="" className="w-full h-full object-cover"/>:String(r?.name||'?').slice(0,1)}</div>;
  const profile=selected&&<div className="fixed inset-0 z-[119] bg-black/45 flex items-end sm:items-center justify-center" onClick={()=>setSelected(null)}><div className="w-full max-w-sm rounded-t-3xl sm:rounded-3xl bg-white p-5" onClick={e=>e.stopPropagation()}><div className="flex justify-between"><div className="flex gap-3">{avatar(selected,'w-16 h-16')}<div><div className="text-lg font-black">{selected.name}</div><div className="text-xs text-gray-400">{displayStoreName(selected.branch)} · {selected.position||'직원'}</div><div className="mt-1 text-xs font-bold text-brand-700">{title(selected)?`${title(selected).icon} ${title(selected).name}`:'🏅 대표 배지 없음'}</div></div></div><button onClick={()=>setSelected(null)}>✕</button></div>{profiles[selected.id]?.status_message&&<div className="mt-4 rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-800">“{profiles[selected.id].status_message}”</div>}<div className="grid grid-cols-3 gap-2 mt-4">{[['HS',hsCount(selected.draft),'건'],['홈',metric('home').value(selected),'건'],['생산성',selected.pay?.kpiScore||0,'P']].map(([l,v,u])=><div key={l} className="rounded-xl bg-gray-50 p-2 text-center"><div className="text-[9px] text-gray-400">{l}</div><div className="text-sm font-bold">{u==='P'?fmtNum(v,1):fmtCount(v)}{u}</div></div>)}</div></div></div>;
  const cards=[['HS KING',leader('hs')],['홈 KING',leader('home')],['생산성 KING',leader('productivity')]];
  return <><div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white overflow-hidden"><button onClick={()=>setSelected(mvp)} className="w-full p-4 text-left"><div className="flex justify-between"><div><div className="text-[10px] font-bold text-amber-600">🏛️ 미소 명예의 전당 · {monthLabel(month)}</div><div className="text-base font-black mt-1">이달의 우수 직원</div></div><span className="text-xs text-amber-700">프로필 ›</span></div><div className="mt-4 flex gap-3 items-center">{avatar(mvp,'w-14 h-14')}<div><div className="text-[10px] font-bold text-amber-600">미소 MVP</div><div className="font-black">{mvp.name}</div><div className="text-xs text-brand-700">{title(mvp)?`${title(mvp).icon} ${title(mvp).name}`:'🏅 대표 배지 준비 중'}</div>{profiles[mvp.id]?.status_message&&<div className="text-[10px] text-gray-500 mt-1">“{profiles[mvp.id].status_message}”</div>}</div></div></button><div className="grid grid-cols-3 border-t border-amber-100">{cards.map(([l,r])=><button key={l} onClick={()=>setSelected(r)} className="p-3 border-r last:border-0 border-amber-100">{avatar(r,'w-9 h-9 mx-auto')}<div className="text-[9px] font-bold text-amber-600 mt-1">{l}</div><div className="text-[10px] font-semibold truncate">{r.name}</div></button>)}</div><button onClick={()=>setShowAll(true)} className="w-full border-t border-amber-100 py-3 text-xs font-bold text-amber-700">전체 직원 프로필 보기 ›</button></div>{showAll&&<div className="fixed inset-0 z-[118] bg-black/45 flex items-end sm:items-center justify-center" onClick={()=>setShowAll(false)}><div className="w-full max-w-lg max-h-[86vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-gray-50 p-4" onClick={e=>e.stopPropagation()}><div className="flex justify-between"><div><div className="text-lg font-black">전체 직원 프로필</div><div className="text-xs text-gray-400">직원을 누르면 공개 프로필이 열려요.</div></div><button onClick={()=>setShowAll(false)}>✕</button></div><div className="grid grid-cols-2 gap-2 mt-4">{salesRows.map(r=><button key={r.id} onClick={()=>{setShowAll(false);setSelected(r)}} className="rounded-2xl bg-white border p-3 text-left flex gap-2">{avatar(r)}<div className="min-w-0"><div className="text-xs font-bold truncate">{r.name}</div><div className="text-[9px] text-gray-400 truncate">{displayStoreName(r.branch)}</div><div className="text-[9px] text-brand-600 truncate mt-1">{title(r)?`${title(r).icon} ${title(r).name}`:'대표 배지 없음'}</div>{profiles[r.id]?.status_message&&<div className="text-[9px] text-gray-500 truncate mt-1">{profiles[r.id].status_message}</div>}</div></button>)}</div></div></div>}{profile}</>;
}

function RecognitionRankingHub({rows,month,userId,userName='',userBranch=''}){
  return <section className="rounded-3xl border border-brand-100 bg-gradient-to-b from-brand-50/80 to-white p-2.5 shadow-sm">
    <div className="px-2.5 pt-2 pb-3">
      <div className="flex items-start justify-between gap-3">
        <div>

          <div className="mt-0.5 text-base font-black text-gray-900">명예의 전당 · 월간 순위</div>

        </div>
        <div className="flex shrink-0 gap-1">
          <span className="rounded-full bg-amber-100 px-2 py-1 text-[9px] font-bold text-amber-700">🏆 명예</span>
          <span className="rounded-full bg-brand-100 px-2 py-1 text-[9px] font-bold text-brand-700">순위</span>
        </div>
      </div>
    </div>
    <div className="space-y-2">
      <HallOfFame rows={rows} month={month} />
      <MonthlyPerformanceRankingCard
        rows={rows}
        userId={userId}
        userName={userName}
        userBranch={userBranch}
        title={`${monthLabel(month)} 월 누적 순위`}
      />
    </div>
  </section>;
}

function GamificationHub({dailyDays,month,personalGoals,mergedDraft,pay,competitionRows,userId,authUserId,currentEmp,currentAmount=0,onOpenPay,onGoInput}) {
  const [storedBadges,setStoredBadges]=useState([]);
  const [titleKey,setTitleKey]=useState('');
  const [loadingBadges,setLoadingBadges]=useState(true);
  const [showCollection,setShowCollection]=useState(false);
  const [filter,setFilter]=useState('all');
  const [avatarUrl,setAvatarUrl]=useState('');
  const [avatarBusy,setAvatarBusy]=useState(false);
  const [statusMessage,setStatusMessage]=useState('');
  const [statusEditing,setStatusEditing]=useState(false);
  const [statusBusy,setStatusBusy]=useState(false);
  const [celebration,setCelebration]=useState(null);
  const [otherDialogOpen,setOtherDialogOpen]=useState(false);
  useEffect(()=>{
    const scan=()=>setOtherDialogOpen(!!document.querySelector('dialog[open]'));
    const observer=new MutationObserver(scan);scan();
    observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['open']});
    return()=>observer.disconnect();
  },[]);
  const [lifetimeTotals,setLifetimeTotals]=useState({home:0,free:0,smart:0,upsell:0,sono:0});
  const [lifetimeLoaded,setLifetimeLoaded]=useState(false);
  useEffect(()=>{let alive=true;(async()=>{
    if(!userId){setLifetimeLoaded(true);return}
    setLifetimeLoaded(false);
    const history=[];let offset=0,error=null;
    while(true){
      const page=await supabase.from('daily_records').select('id,data').eq('user_id',userId).order('id').range(offset,offset+999);
      if(page.error){error=page.error;break}
      history.push(...(page.data||[]));
      if((page.data||[]).length<1000)break;
      offset+=1000;
    }
    if(!alive)return;
    if(error){console.error(error);setLifetimeLoaded(true);return}
    const totals={home:0,free:0,smart:0,upsell:0,sono:0};
    history.forEach(row=>{
      const d=normalizeDay(row.data), base=d.groups?.homeBase||{}, flat=d.groups?.homeFlat||{};
      const baseHome=Number(base.homeOnly||0)+Number(base.homeTv||0);
      const legacySpeed=Number(flat.home100Only||0)+Number(flat.home500Only||0)+Number(flat.home1GBOnly||0);
      totals.home+=baseHome>0?baseHome:legacySpeed;
      totals.free+=Number(flat.tvFree||0);
      totals.smart+=Number(flat.smartHome||0);
      totals.upsell+=Number(d.tailoredCount||0);
      totals.sono+=Object.values(d.groups?.sono||{}).reduce((sum,value)=>sum+Number(value||0),0);
    });
    setLifetimeTotals(totals);setLifetimeLoaded(true);
  })();return()=>{alive=false}},[userId]);
  const [badgeError,setBadgeError]=useState('');
  const [badgeRetry,setBadgeRetry]=useState(0);
  const confirmedBadges=useMemo(()=>storedBadges.filter(r=>r.verified_at||r.awarded_by),[storedBadges]);
  const earnedKeys=useMemo(()=>new Set(confirmedBadges.map(r=>r.badge_key)),[confirmedBadges]);
  useEffect(()=>{
    let alive=true;
    if(!userId)return;
    setLoadingBadges(true);setBadgeError('');
    const timer=setTimeout(async()=>{
      try{
        const [rows,title]=await Promise.all([
          supabase.from('user_achievements').select('badge_key,earned_at,awarded_by,verified_at,note').eq('user_id',userId).order('earned_at'),
          supabase.from('user_titles').select('badge_key').eq('user_id',userId).maybeSingle()
        ]);
        if(rows.error||title.error)throw rows.error||title.error;
        if(!alive)return;
        setStoredBadges(rows.data||[]);setTitleKey(title.data?.badge_key||'');
        if(userId===authUserId){
          const sync=await supabase.functions.invoke('sync-badges',{body:{month}});
          if(sync.error||!Array.isArray(sync.data?.badges))throw sync.error||new Error('BADGE_SYNC_FAILED');
          if(!alive)return;
          setStoredBadges(sync.data.badges);
          const have=new Set((rows.data||[]).filter(r=>r.verified_at||r.awarded_by).map(r=>r.badge_key));
          const fresh=sync.data.badges.find(r=>r.verified_at&&!have.has(r.badge_key));
          const badge=fresh&&badgeDefOf(fresh.badge_key);
          const onceKey=fresh&&`miso-celebration-badge-${userId}-${fresh.badge_key}`;
          if(badge&&!localStorage.getItem(onceKey)){localStorage.setItem(onceKey,'1');setCelebration({icon:badge.icon,title:'새로운 배지 획득!',message:badge.name});}
        }
      }catch{if(alive)setBadgeError('배지 확인을 완료하지 못했어요. 잠시 후 다시 확인해주세요.');}
      finally{if(alive)setLoadingBadges(false);}
    },300);
    return()=>{alive=false;clearTimeout(timer)};
  },[userId,authUserId,month,dailyDays,badgeRetry]);
  useEffect(()=>{
    if(!userId||loadingBadges||celebration)return;
    const hs=hsCount(mergedDraft||{}),rank=[...(competitionRows||[])].sort((a,b)=>Number(b.pay?.totalPoints||0)-Number(a.pay?.totalPoints||0)).findIndex(x=>x.id===userId)+1;
    const events=[];
    [40,30,20].forEach(v=>{if(hs>=v)events.push({key:`hs-${month}-${v}`,icon:'🔥',title:`HS ${v}건 돌파!`,message:'꾸준함이 멋진 기록을 만들었어요.'})});
    if(pay?.gradeEligible&&pay?.grade&&pay.grade!=='D')events.push({key:`grade-${month}-${pay.grade}`,icon:'🏆',title:`${pay.grade}등급 달성!`,message:'한 단계 더 올라섰어요.'});
    if(rank>0&&rank<=3)events.push({key:`rank-${month}-${rank}`,icon:rank===1?'🥇':rank===2?'🥈':'🥉',title:`전체 순위 TOP${rank} 진입!`,message:'지금의 좋은 흐름을 이어가요.'});
    const next=events.find(x=>!localStorage.getItem(`miso-celebration-${userId}-${x.key}`));
    if(next){events.forEach(x=>localStorage.setItem(`miso-celebration-${userId}-${x.key}`,'1'));setCelebration(next)}
  },[userId,month,mergedDraft,pay?.grade,pay?.gradeEligible,competitionRows,loadingBadges,celebration]);
  const saveTitle=async(key)=>{if(userId!==authUserId||!earnedKeys.has(key))return;const {error}=await supabase.from('user_titles').upsert({user_id:userId,badge_key:key,updated_at:new Date().toISOString()},{onConflict:'user_id'});if(error)return showAppToast(friendlyError(error),{tone:'error',title:'배지 저장 실패'});setTitleKey(key)};
  const titleDef=earnedKeys.has(titleKey)?badgeDefOf(titleKey):null;
  const visible=BADGE_DEFS.filter(b=>filter==='earned'?earnedKeys.has(b.key):filter==='locked'?!earnedKeys.has(b.key):filter==='legend'?b.rarity==='LEGEND':true);
  const earnedRow=storedBadges.find(r=>r.badge_key===titleKey);

  useEffect(()=>{
    if(!userId)return;
    let alive=true,objectUrl='';
    (async()=>{
      const [{data},{data:publicProfile}]=await Promise.all([
        supabase.from('profiles').select('avatar_path').eq('id',userId).maybeSingle(),
        supabase.from('employee_public_profiles').select('avatar_path,status_message').eq('user_id',userId).maybeSingle()
      ]);
      const path=publicProfile?.avatar_path||data?.avatar_path||'';
      setStatusMessage(publicProfile?.status_message||'');
      if(!alive)return;
      if(path){const {data:file}=await supabase.storage.from('profile-avatars').download(path);if(file&&alive){objectUrl=URL.createObjectURL(file);setAvatarUrl(objectUrl)}}
    })();
    return()=>{alive=false;if(objectUrl)URL.revokeObjectURL(objectUrl)};
  },[userId]);

  const uploadAvatar=async(event)=>{
    const file=event.target.files?.[0];event.target.value='';
    if(!file)return;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type))return showAppToast('JPG, PNG, WEBP 사진만 등록할 수 있어요.',{tone:'error'});
    if(file.size>3*1024*1024)return showAppToast('프로필 사진은 3MB 이하로 선택해주세요.',{tone:'error'});
    setAvatarBusy(true);
    const path=`${userId}/avatar`;
    const {error:uploadError}=await supabase.storage.from('profile-avatars').upload(path,file,{upsert:true,contentType:file.type,cacheControl:'3600'});
    if(uploadError){setAvatarBusy(false);return showAppToast(friendlyError(uploadError),{tone:'error',title:'사진 등록 실패'})}
    const {error:updateError}=await supabase.from('profiles').update({avatar_path:path,updated_at:new Date().toISOString()}).eq('id',userId).select('id').single();
    if(updateError){setAvatarBusy(false);return showAppToast(friendlyError(updateError),{tone:'error',title:'프로필 저장 실패'})}
    const {error:publicError}=await supabase.from('employee_public_profiles').upsert({user_id:userId,avatar_path:path,status_message:statusMessage||null,updated_at:new Date().toISOString()},{onConflict:'user_id'});
    if(publicError){setAvatarBusy(false);return showAppToast(friendlyError(publicError),{tone:'error',title:'공개 프로필 저장 실패'})}
    const {data:downloaded}=await supabase.storage.from('profile-avatars').download(path);
    if(downloaded){if(avatarUrl)URL.revokeObjectURL(avatarUrl);setAvatarUrl(URL.createObjectURL(downloaded))}
    setAvatarBusy(false);showAppToast('프로필 사진을 등록했어요.');
  };
  const saveStatus=async()=>{
    const clean=String(statusMessage||'').trim().slice(0,40);setStatusBusy(true);
    const {data:existing,error:readError}=await supabase.from('employee_public_profiles').select('avatar_path').eq('user_id',userId).maybeSingle();
    if(readError){setStatusBusy(false);return showAppToast(friendlyError(readError),{tone:'error',title:'프로필 조회 실패'})}
    const {error}=await supabase.from('employee_public_profiles').upsert({user_id:userId,avatar_path:existing?.avatar_path||null,status_message:clean||null,updated_at:new Date().toISOString()},{onConflict:'user_id'});
    setStatusBusy(false);if(error)return showAppToast(friendlyError(error),{tone:'error'});setStatusMessage(clean);setStatusEditing(false);showAppToast('공개 한줄 상태를 저장했어요.');
  };

  return <>
    {celebration&&!otherDialogOpen&&createPortal(<div className="fixed inset-0 z-[118] bg-black/45 flex items-center justify-center p-5" onClick={()=>setCelebration(null)}>
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white p-6 text-center shadow-2xl" onClick={e=>e.stopPropagation()}>
        <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-brand-100 to-transparent" />
        <div className="relative text-5xl">{celebration.icon}</div><div className="relative mt-3 text-xl font-black text-gray-900">{celebration.title}</div><div className="relative mt-2 text-sm text-gray-500">{celebration.message}</div>
        <div className="relative mt-4 flex justify-center gap-2">{['●','◆','●','◆','●'].map((x,i)=><span key={i} className={`${i%2?'text-amber-400':'text-brand-400'} animate-bounce`} style={{animationDelay:`${i*80}ms`}}>{x}</span>)}</div>
        <button onClick={()=>setCelebration(null)} className="relative mt-5 w-full rounded-xl bg-brand-600 py-3 text-sm font-bold text-white">좋아요!</button>
      </div>
    </div>,document.body)}
    <div className="summary-hero w-full">
      <div className="summary-profile flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
        <label className="relative w-12 h-12 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 overflow-hidden cursor-pointer" aria-label="프로필 사진 등록">
          {avatarUrl?<img src={avatarUrl} alt="내 프로필" className="w-full h-full object-cover"/>:<span className="text-xl font-bold">{String(currentEmp?.name||'나').slice(0,1)}</span>}
          <span className="absolute inset-x-0 bottom-0 py-0.5 bg-black/45 text-white text-[8px] text-center">{avatarBusy?'저장 중':'사진'}</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadAvatar} disabled={avatarBusy} className="hidden"/>
        </label>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5 min-w-0"><span className="text-sm font-bold break-words">{currentEmp?.name||'직원'}</span><span className="text-[9px] text-gray-500 shrink-0">근무 {fmtCount(pay?.months||0)}개월</span></div>
          <div className="text-[10px] text-gray-500 mt-0.5 break-words">{displayStoreName(currentEmp?.branch||'')} · {currentEmp?.position||'사원'}</div>
        </div>
        </div>
        <button type="button" onClick={()=>setShowCollection(true)} className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-gray-50 border border-gray-100 text-[10px] font-bold">
          <span>{titleDef?.icon||'🏅'}</span><span>{titleDef?.name||'배지 선택'}</span><span className="text-gray-500">›</span>
        </button>
      </div>

      <div className="summary-hero-actions flex flex-col items-start gap-1">
        <div className="min-w-0"><div className="text-[10px] text-gray-500">{monthLabel(month)} 현재 실적 금액</div><div className="summary-amount metric-value mt-2">{currentAmount===null?'—':won(currentAmount)}</div></div>
        <button type="button" onClick={onOpenPay} className="shrink-0 py-2 text-sm text-gray-500">급여 확인·비교 ›</button>
      </div>

      <div className="summary-stats">
        <div><div className="text-[9px] text-gray-500">등급</div><div className="text-base font-semibold mt-1">{pay?.gradeEligible?pay.grade:'D(미달)'}</div></div>
        <div><div className="text-[9px] text-gray-500">성과등급P</div><div className="text-base font-semibold mt-1">{fmtNum(pay?.totalPoints||0,1)}P</div></div>
        <div><div className="text-[9px] text-gray-500">생산성</div><div className="text-base font-semibold mt-1">{fmtNum(pay?.kpiScore||0,1)}P</div></div>
      </div>
      <button type="button" onClick={onGoInput} className="w-full py-3.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-base font-semibold">실적 입력 ›</button>
    </div>

    {showCollection&&<div className="fixed inset-0 z-[90] bg-black/40 flex items-end sm:items-center justify-center" onClick={()=>setShowCollection(false)}>
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[88vh] overflow-hidden" onClick={e=>e.stopPropagation()}>
        <div className="p-4 border-b"><div className="flex justify-between items-center"><div><div className="text-lg font-bold">내 배지 {fmtCount(earnedKeys.size)} / {BADGE_DEFS.length}</div><div className="text-[10px] text-gray-400">확인된 배지를 대표 배지로 선택할 수 있어요.</div>{storedBadges.length>confirmedBadges.length&&<p className="text-[11px] text-amber-700 mt-2">과거 배지 {storedBadges.length-confirmedBadges.length}개는 확인 대기 중입니다. 해당 실적 월을 열면 다시 확인합니다.</p>}{badgeError&&<p role="status" className="text-[11px] text-red-600 mt-2">{badgeError} <button onClick={()=>setBadgeRetry(v=>v+1)} className="underline">다시 확인</button></p>}</div><button onClick={()=>setShowCollection(false)} className="text-gray-400">✕</button></div>
          <div className="flex gap-1.5 mt-3 overflow-x-auto">{[['all','전체'],['earned','획득'],['locked','미획득'],['legend','LEGEND']].map(([k,l])=><button key={k} onClick={()=>setFilter(k)} className={`px-3 py-1.5 rounded-full text-[10px] font-semibold ${filter===k?'bg-brand-600 text-white':'bg-gray-100 text-gray-500'}`}>{l}</button>)}</div>
        </div>
        <div className="p-3 grid grid-cols-2 gap-2 overflow-y-auto max-h-[70vh]">
          {visible.map(b=>{const got=earnedKeys.has(b.key);const row=storedBadges.find(r=>r.badge_key===b.key);const current=b.progressMetric==='tenure'?Number(pay?.months||0):Number(lifetimeTotals?.[b.progressMetric]||0);const showProgress=!got&&b.progressMetric&&b.threshold;return <button key={b.key} disabled={!got} onClick={()=>got&&saveTitle(b.key)} className={`rounded-2xl border p-3 text-left ${got?(titleKey===b.key?'border-brand-300 bg-brand-50 ring-1 ring-brand-100':'border-gray-100 bg-white'):'border-gray-100 bg-gray-50 opacity-55'}`}>
            <div className="flex justify-between"><span className="text-2xl">{got?b.icon:'🔒'}</span><span className="text-[8px] font-bold text-gray-400">{b.rarity}</span></div>
            <div className="text-xs font-bold text-gray-800 mt-2">{b.name}</div><div className="text-[10px] text-gray-500 mt-1 leading-tight">{b.desc}</div>
            {showProgress&&<div className="mt-2"><div className="h-1.5 rounded-full bg-gray-200 overflow-hidden"><div className="h-full rounded-full bg-brand-500" style={{width:`${Math.min(100,current/Number(b.threshold)*100)}%`}}/></div><div className="text-[9px] text-brand-600 mt-1">{fmtCount(current)} / {fmtCount(b.threshold)} · {fmtCount(Math.max(0,b.threshold-current))}{b.progressMetric==='tenure'?'개월':'건'} 남음</div></div>}
            {got&&<div className="text-[9px] text-brand-500 mt-2">{titleKey===b.key?'대표 배지 사용 중':row?.earned_at?`${fmtShortDate(row.earned_at)} 획득 · 대표로 설정`:'대표로 설정'}</div>}
          </button>})}
        </div>
      </div>
    </div>}
  </>;
}

function SpecialBadgeAwardPanel({ employees, authUserId }) {
  const [employeeId, setEmployeeId] = useState(employees?.[0]?.id || '');
  const [badgeKey, setBadgeKey] = useState('special_pick');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!employees?.some((e) => e.id === employeeId)) {
      setEmployeeId(employees?.[0]?.id || '');
    }
  }, [employees, employeeId]);

  const award = async () => {
    if (!employeeId || !badgeKey) return;

    setSaving(true);
    setMessage('');

    const { error } = await supabase
      .from('user_achievements')
      .insert({
        user_id: employeeId,
        badge_key: badgeKey,
        awarded_by: authUserId,
        note: note.trim() || null,
      });

    if (error) {
      if (error.code === '23505') {
        setMessage('이미 이 배지를 받은 직원이에요.');
      } else {
        setMessage(`배지 수여 실패: ${friendlyError(error)}`);
      }
    } else {
      const employee = employees.find((e) => e.id === employeeId);
      const badge = badgeDefOf(badgeKey);
      setMessage(`${employee?.name || '직원'}님에게 ${badge?.icon || '⭐'} ${badge?.name || '특별 배지'}를 수여했어요.`);
      setNote('');
    }

    setSaving(false);
  };

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-brand-100 p-4">
        <div className="text-xs text-brand-500">관리자가 직접 전하는 인정</div>
        <div className="text-base font-bold text-gray-900 mt-0.5">⭐ 특별 배지 수여</div>
        <div className="text-xs text-gray-400 mt-1">
          숫자로 다 담기 어려운 성장과 팀워크도 기록으로 남겨주세요.
        </div>

        <div className="mt-4 grid md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">직원</label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
            >
              {(employees || []).map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} · {displayStoreName(e.branch)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">배지</label>
            <select
              value={badgeKey}
              onChange={(e) => setBadgeKey(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
            >
              {SPECIAL_BADGE_KEYS.map((key) => {
                const badge = badgeDefOf(key);
                return (
                  <option key={key} value={key}>
                    {badge?.icon} {badge?.name}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        <div className="mt-3">
          <label className="block text-xs font-semibold text-gray-500 mb-1">
            한마디 <span className="font-normal text-gray-300">(선택)</span>
          </label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="예: 이번 달 성장세가 정말 좋았어요!"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <button
          onClick={award}
          disabled={saving || !employeeId}
          className="w-full mt-4 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-bold disabled:opacity-50"
        >
          {saving ? '수여 중...' : '특별 배지 수여'}
        </button>

        {message && (
          <div className="mt-3 text-xs bg-gray-50 rounded-lg p-2.5 text-gray-600">{message}</div>
        )}
      </div>
    </div>
  );
}


/* ===================== v11 홈 청약 관리 ===================== */


function homeOrderMeta(groupKey, itemKey) {
  const map = {
    'homeBase.homeOnly': { productType: 'homeOnly', label: '홈 단독' },
    'homeBase.homeTv': { productType: 'homeTv', label: 'TV(주)' },
    'homeFlat.tvFree': { productType: 'tvFree', label: 'TV프리(부)' },
    'homeFlat.smartHome': { productType: 'smartHome', label: '스마트홈' },
  };
  return map[`${groupKey}.${itemKey}`] || null;
}


/* ===================== v12 관리자 알림센터 ===================== */

function NotificationBell({ userId, onOpen }) {
  const [unread, setUnread] = useState(0);

  const loadUnread = useCallback(async () => {
    if (!userId) return;
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', userId)
      .eq('read', false);

    if (!error) setUnread(count || 0);
  }, [userId]);

  useEffect(() => {
    loadUnread();

    if (!userId) return;

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          loadUnread();
          if(payload.eventType==='INSERT'){
            playMisoNotificationSound();
            const item=payload.new||{};
            showAppToast(item.message||'새 알림이 도착했어요.',{title:item.title||'미소페이 알림',tone:'info'});
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, loadUnread]);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="relative w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-gray-600"
      title="알림"
    >
      <Bell size={17} />
      {unread > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  );
}

const PUSH_VAPID_PUBLIC_KEY='BNGKgtt4ILN7tUC4mrsxlZskRco883ZWNSfgK82dZmHHEYME4vtfCnidY_cd_UuRKc8yYemLwBWYBs1ir0cYEG0';
function pushKeyBytes(value){
  const padding='='.repeat((4-value.length%4)%4),base64=(value+padding).replace(/-/g,'+').replace(/_/g,'/');
  const raw=atob(base64);return Uint8Array.from([...raw].map(ch=>ch.charCodeAt(0)));
}
function PushNotificationSettings({userId}){
  const supported='serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
  const [enabled,setEnabled]=useState(false),[busy,setBusy]=useState(true),[message,setMessage]=useState('');
  const standalone=window.matchMedia?.('(display-mode: standalone)').matches||window.navigator.standalone===true;
  useEffect(()=>{let alive=true;(async()=>{if(!supported){if(alive)setBusy(false);return}const reg=await navigator.serviceWorker.ready;const sub=await reg.pushManager.getSubscription();if(alive){setEnabled(!!sub);setBusy(false)}})();return()=>{alive=false}},[supported,userId]);
  const enable=async()=>{
    if(!supported)return setMessage('이 기기에서는 푸시 알림을 지원하지 않아요.');
    if(/iphone|ipad|ipod/i.test(navigator.userAgent)&&!standalone)return setMessage('아이폰은 먼저 Safari에서 홈 화면에 추가한 뒤, 미소페이 앱에서 켜주세요.');
    setBusy(true);setMessage('');
    try{
      const permission=await Notification.requestPermission();
      if(permission!=='granted')throw new Error('휴대폰 설정에서 미소페이 알림을 허용해주세요.');
      const reg=await navigator.serviceWorker.ready;
      const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:pushKeyBytes(PUSH_VAPID_PUBLIC_KEY)});
      const json=sub.toJSON(),keys=json.keys||{};
      const {error}=await supabase.from('push_subscriptions').upsert({user_id:userId,endpoint:json.endpoint,p256dh:keys.p256dh,auth:keys.auth,user_agent:navigator.userAgent,enabled:true,updated_at:new Date().toISOString()},{onConflict:'endpoint'});
      if(error)throw error;
      setEnabled(true);setMessage('알림을 켰어요. 테스트 알림을 눌러 확인해주세요.');
    }catch(error){setMessage(friendlyError(error))}finally{setBusy(false)}
  };
  const disable=async()=>{
    setBusy(true);setMessage('');
    try{const reg=await navigator.serviceWorker.ready,sub=await reg.pushManager.getSubscription();if(sub){const {error}=await supabase.from('push_subscriptions').delete().eq('endpoint',sub.endpoint).eq('user_id',userId);if(error)throw error;await sub.unsubscribe()}setEnabled(false);setMessage('이 기기의 알림을 껐어요.')}catch(error){setMessage(friendlyError(error))}finally{setBusy(false)}
  };
  const test=async()=>{
    setBusy(true);setMessage('테스트 알림을 보내는 중이에요.');
    const {error}=await supabase.from('notifications').insert({recipient_id:userId,actor_id:userId,type:'push_test',title:'미소페이 알림 테스트',message:'푸시 알림이 정상적으로 연결됐어요 🎉',payload:{screen:'notifications'}});
    setMessage(error?friendlyError(error):'잠시 후 휴대폰 알림을 확인해주세요.');setBusy(false);
  };
  return <div className="rounded-2xl border border-brand-100 bg-brand-50 p-4">
    <div className="flex items-start justify-between gap-3"><div><div className="text-sm font-bold text-gray-900">휴대폰 푸시 알림</div><div className="text-[11px] text-gray-500 mt-1">앱을 닫아도 승인 결과와 오늘 고객 약속을 알려드려요.</div></div><span className={`text-[10px] font-bold px-2 py-1 rounded-full ${enabled?'bg-emerald-100 text-emerald-700':'bg-gray-200 text-gray-500'}`}>{enabled?'켜짐':'꺼짐'}</span></div>
    {!supported&&<div className="text-[11px] text-amber-700 mt-2">현재 브라우저에서는 지원되지 않아요. 설치한 미소페이 앱에서 다시 열어주세요.</div>}
    {message&&<div className="text-[11px] text-brand-700 mt-2">{message}</div>}
    <div className="flex gap-2 mt-3">{enabled?<><button disabled={busy} onClick={test} className="flex-1 rounded-xl bg-brand-600 py-2.5 text-xs font-bold text-white disabled:opacity-50">테스트 알림</button><button disabled={busy} onClick={disable} className="rounded-xl bg-white border border-gray-200 px-3 py-2.5 text-xs font-bold text-gray-500 disabled:opacity-50">끄기</button></>:<button disabled={busy||!supported} onClick={enable} className="w-full rounded-xl bg-brand-600 py-2.5 text-xs font-bold text-white disabled:opacity-50">{busy?'확인 중...':'알림 받기'}</button>}</div>
  </div>;
}

function NotificationCenter({ userId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (!error) setItems(data || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const markRead = async (id) => {
    const { data, error } = await supabase
      .from('notifications')
      .update({
        read: true,
        read_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('recipient_id', userId).select('id').single();

    if(error)return showAppToast(friendlyError(error),{tone:'error',title:'읽음 처리 실패'});
    if (data) {
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    }
  };

  const markAllRead = async () => {
    const { data, error } = await supabase
      .from('notifications')
      .update({
        read: true,
        read_at: new Date().toISOString(),
      })
      .eq('recipient_id', userId)
      .eq('read', false).select('id');

    if(error)return showAppToast(friendlyError(error),{tone:'error',title:'읽음 처리 실패'});
    if (data) {
      const changed=new Set(data.map(n=>n.id));
      setItems((prev) => prev.map((n) => changed.has(n.id)?{ ...n, read: true }:n));
    }
  };

  const unreadCount = items.filter((n) => !n.read).length;

  const iconFor = (type) => {
    if (type === 'home_order') return '🏠';
    if (type === 'home_completed') return '✅';
    if (type === 'home_cancelled') return '⚠️';
    if (type === 'daily_input') return '📈';
    if (type === 'daily_input_reminder') return '✍️';
    return '🔔';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-4 text-sm text-gray-400 flex items-center gap-2">
        <Loader2 size={14} className="animate-spin" />
        알림 불러오는 중...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <PushNotificationSettings userId={userId} />
      <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs text-gray-400">내가 확인할 소식</div>
          <div className="text-base font-bold text-gray-900 mt-0.5">
            🔔 알림센터
          </div>
          <div className="text-xs text-gray-400 mt-1">
            읽지 않은 알림 {unreadCount}개
          </div>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="text-xs font-semibold text-brand-600"
          >
            모두 읽음
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {items.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-400">
            아직 알림이 없어요.
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {items.map((n) => (
              <button
                key={n.id}
                onClick={() => !n.read && markRead(n.id)}
                className={`w-full text-left px-4 py-3 flex gap-3 ${
                  n.read ? 'bg-white' : 'bg-brand-50/60'
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center shrink-0 text-lg">
                  {iconFor(n.type)}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className={`text-sm ${n.read ? 'font-medium text-gray-700' : 'font-bold text-gray-900'}`}>
                      {n.title}
                    </div>
                    {!n.read && (
                      <span className="w-2 h-2 rounded-full bg-brand-500 shrink-0" />
                    )}
                  </div>

                  {n.message && (
                    <div className="text-xs text-gray-500 mt-0.5">
                      {n.message}
                    </div>
                  )}

                  <div className="text-[10px] text-gray-400 mt-1">
                    {new Date(n.created_at).toLocaleString('ko-KR')}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


async function notifyEmployee({actorId,recipientId,type,title,message,payload={}}){
  if(!actorId||!recipientId)return;
  const {error}=await supabase.from('notifications').insert({recipient_id:recipientId,actor_id:actorId,type,title,message,payload});
  if(error)console.error('EMPLOYEE NOTIFICATION ERROR',error);
}


/* ===================== v16: 매장 목표 / 영업비용 / 스팟 정책 ===================== */





const STORE_GOAL_METRICS = [
  { key:'hs', label:'HS' },
  { key:'simMnp', label:'SIM MNP' },
  { key:'second', label:'2ND' },
  { key:'productivity', label:'생산성' },
  { key:'home', label:'홈' },
  { key:'tvFree', label:'TV프리(부)' },
  { key:'smartHome', label:'스마트홈' },
  { key:'sono', label:'소노' },
  { key:'tailoredAmount', label:'맞춤제안 매출액' },
  { key:'tailoredCount', label:'맞춤제안 업셀 건수' },
];

function storeGoalCurrent(mergedDraft, pay, key) {
  if (key === 'hs') return hsCount(mergedDraft);
  if (key === 'home') return completedHomeCount(mergedDraft);
  if (key === 'productivity') return Number(pay?.kpiScore||0);
  if (key === 'tvFree') return Number(mergedDraft?.homeFlat?.tvFree||0);
  if (key === 'smartHome') return Number(mergedDraft?.homeFlat?.smartHome||0);
  if (key === 'tailoredCount') return Number(mergedDraft?.tailoredCount||0);
  return 0;
}







function StoreGoalCard({ month, storeName, mergedDraft, pay }) {
  const [goal,setGoal]=useState(null);
  const [open,setOpen]=useState(false);
  useEffect(()=>{
    if(!storeName)return;
    (async()=>{
      const {data}=await supabase.from('store_goals').select('*').eq('month',month).eq('store_name',storeName).maybeSingle();
      const base=companyGoalDefaults(storeName);
      setGoal({
        ...(data||{}),
        company_goals:{...base,...(data?.company_goals||{})},
        challenge_goals:{...(data?.challenge_goals||{})}
      });
    })();
  },[month,storeName]);
  if(!goal)return null;
  const company={...companyGoalDefaults(storeName),...(goal.company_goals||{})}, challenge=goal.challenge_goals||{};
  return <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
    <button onClick={()=>setOpen(v=>!v)} className="w-full p-4 flex items-center justify-between text-left">
      <div><div className="text-xs text-gray-400">🏪 우리 매장 목표</div><div className="font-bold text-gray-900 mt-0.5">{displayStoreName(storeName)} · {monthLabel(month)}</div></div>
      <span className="text-xs text-brand-600 font-semibold">{open?'접기':'진행률 보기'}</span>
    </button>
    {open&&<div className="px-4 pb-4 space-y-3">
      {STORE_GOAL_METRICS.map(m=>{
        const cur=storeGoalCurrent(mergedDraft,pay,m.key), c=Number(company[m.key]||0), ch=Number(challenge[m.key]||c||0);
        if(!c&&!ch)return null;
        const pct=ch?Math.min(100,cur/ch*100):0;
        return <div key={m.key}>
          <div className="flex justify-between text-xs"><span className="font-medium text-gray-700">{m.label}</span><span className="text-gray-500">{Number.isInteger(cur)?fmtCount(cur):fmtNum(cur,1)} / <b>{fmtNum(ch,1)}</b></span></div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden mt-1"><div className="h-full bg-brand-500 rounded-full" style={{width:`${pct}%`}} /></div>
          <div className="text-[10px] mt-1 text-gray-400">{c&&cur>=c?'✅ 회사 기준 달성':`회사 기준 ${c||'-'}`} · 도전 {ch||'-'}</div>
        </div>
      })}
    </div>}
  </div>;
}


function SpotClaimPanel({ userId, month, claimDate }) {
  const [policies,setPolicies]=useState([]);
  const [claims,setClaims]=useState([]);
  const [open,setOpen]=useState(false);
  const [policyId,setPolicyId]=useState('');
  const [customer,setCustomer]=useState('');
  const [directOpen,setDirectOpen]=useState(false);
  const [directTitle,setDirectTitle]=useState('');
  const [directAmount,setDirectAmount]=useState('');
  const [directMemo,setDirectMemo]=useState('');

  const load=useCallback(async()=>{
    const {data:p}=await supabase.from('spot_policies').select('*')
      .lte('start_date',`${month}-31`).gte('end_date',`${month}-01`).eq('active',true).order('start_date');
    const {data:c}=await supabase.from('spot_claims')
      .select('*, spot_policies(title,amount)')
      .eq('user_id',userId)
      .gte('claim_date',`${month}-01`).lte('claim_date',`${month}-31`)
      .order('created_at',{ascending:false});
    setPolicies(p||[]);setClaims(c||[]);
  },[userId,month]);

  useEffect(()=>{load()},[load]);

  const addPolicyClaim=async()=>{
    if(!policyId)return showLegacyAlert('스팟 정책을 선택해주세요.');
    const {error}=await supabase.from('spot_claims').insert({
      policy_id:policyId,user_id:userId,
      claim_date:claimDate||new Date().toISOString().slice(0,10),
      customer_name:customer.trim()||null,status:'pending',source_context:'mobile'
    });
    if(error)return showLegacyAlert(`스팟 신청 실패: ${friendlyError(error)}`);
    setCustomer('');setPolicyId('');load();
  };

  const addDirect=async()=>{
    const title=directTitle.trim(), amount=Number(directAmount);
    if(!title)return showLegacyAlert('스팟 정책명을 입력해주세요.');
    if(!amount||amount<=0)return showLegacyAlert('추가 금액을 입력해주세요.');
    const {error}=await supabase.from('spot_claims').insert({
      policy_id:null,user_id:userId,
      claim_date:claimDate||new Date().toISOString().slice(0,10),
      customer_name:customer.trim()||null,status:'pending',
      direct_title:title,direct_amount:amount,direct_memo:directMemo.trim()||null,source_context:'mobile'
    });
    if(error)return showLegacyAlert(`스팟 직접 입력 실패: ${friendlyError(error)}`);
    setDirectTitle('');setDirectAmount('');setDirectMemo('');setCustomer('');setDirectOpen(false);load();
  };

  return <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
    <button onClick={()=>setOpen(v=>!v)} className="w-full p-4 flex justify-between text-left">
      <div><div className="text-sm font-bold">🔥 스팟 추가 인센티브</div>
      <div className="text-xs text-gray-400 mt-0.5">정책 선택 또는 직접 입력 → 관리자 확인</div></div>
      <span className="text-xs text-brand-600">{open?'접기':'보기'}</span>
    </button>
    {open&&<div className="px-4 pb-4 space-y-3">
      {policies.length>0&&<>
        <select value={policyId} onChange={e=>setPolicyId(e.target.value)} className="w-full border rounded-lg p-2 text-xs">
          <option value="">등록된 정책 선택</option>
          {policies.map(p=><option key={p.id} value={p.id}>{p.title} · +{won(p.amount)}</option>)}
        </select>
        <input value={customer} onChange={e=>setCustomer(e.target.value)} placeholder="고객명 (선택)" className="w-full border rounded-lg p-2 text-xs"/>
        <button onClick={addPolicyClaim} disabled={!policyId} className="w-full py-2 rounded-lg bg-orange-500 text-white text-xs font-bold disabled:opacity-40">선택 정책 신청</button>
      </>}
      <button onClick={()=>setDirectOpen(v=>!v)} className="w-full py-2.5 rounded-xl bg-orange-50 text-orange-700 border border-orange-100 text-xs font-bold">+ 스팟 직접 입력</button>
      {directOpen&&<div className="space-y-2 bg-orange-50/40 border border-orange-100 rounded-xl p-3">
        <input value={directTitle} onChange={e=>setDirectTitle(e.target.value)} placeholder="정책명" className="w-full border rounded-lg p-2 text-xs bg-white"/>
        <input value={fmtInputNumber(directAmount)} onChange={e=>setDirectAmount(e.target.value.replace(/\D/g,''))} placeholder="추가 금액" className="w-full border rounded-lg p-2 text-xs bg-white"/>
        <input value={customer} onChange={e=>setCustomer(e.target.value)} placeholder="고객명 (선택)" className="w-full border rounded-lg p-2 text-xs bg-white"/>
        <input value={directMemo} onChange={e=>setDirectMemo(e.target.value)} placeholder="메모 (선택)" className="w-full border rounded-lg p-2 text-xs bg-white"/>
        <div className="text-[10px] text-gray-400">관리자가 확인·수정 후 승인하면 반영돼요.</div>
        <button onClick={addDirect} className="w-full py-2 rounded-lg bg-orange-500 text-white text-xs font-bold">관리자 확인 요청</button>
      </div>}
      {policies.length===0&&!directOpen&&<div className="text-xs text-gray-400">등록된 정책이 없어요. 직접 입력을 이용해주세요.</div>}
      <div className="divide-y">
        {claims.map(c=>{const title=c.reviewed_title||c.direct_title||c.spot_policies?.title||'스팟';
          const amount=c.final_amount??c.direct_amount??c.spot_policies?.amount??0;
          return <div key={c.id} className="py-2 text-xs flex justify-between gap-2"><div>{title} · {c.customer_name||'일반'}<div className="text-[10px] text-gray-400">{won(amount)}</div></div>
            <span className={c.status==='approved'?'text-emerald-600':c.status==='rejected'?'text-red-500':'text-orange-500'}>{c.status==='approved'?'승인':c.status==='rejected'?'반려':'확인대기'}</span></div>})}
      </div>
    </div>}
  </div>;
}

function StoreGoalAdmin({ month, employees, rows, isFullAdmin, authUserId }) {
  const me=employees.find(e=>e.id===authUserId);
  const stores=sortStoresByOpenOrder(
    employees
      .map(e=>e.branch)
      .filter(Boolean)
      .filter(branch=>!NON_SALES_STORES.includes(branch))
  );
  const canEditCompany=isFullAdmin||me?.position==='담당';
  const [selected,setSelected]=useState(
    !NON_SALES_STORES.includes(me?.branch) ? (me?.branch||stores[0]||'') : (stores[0]||'')
  );
  const [goal,setGoal]=useState({company_goals:{},challenge_goals:{}});
  const finalPerformance=useFinalStorePerformance(month,selected);

  const load=useCallback(async()=>{
    if(!selected)return;
    const {data}=await supabase.from('store_goals')
      .select('*').eq('month',month).eq('store_name',selected).maybeSingle();
    const base=companyGoalDefaults(selected);
    setGoal({
      ...(data||{}),
      company_goals:{...base,...(data?.company_goals||{})},
      challenge_goals:{...(data?.challenge_goals||{})}
    });
  },[month,selected]);

  useEffect(()=>{load()},[load]);

  const setVal=(kind,key,val)=>{
    let n=Number(val)||0;
    if(kind==='company_goals'&&!canEditCompany)return;
    const next={...(goal[kind]||{}),[key]:n};
    if(kind==='company_goals'&&key==='hs')next.tailoredCount=Math.ceil(n*.5);
    setGoal({...goal,[kind]:next});
  };

  const save=async()=>{
    if(!selected)return;
    const payload={
      month,
      store_name:selected,
      company_goals:canEditCompany ? (goal.company_goals||{}) : companyGoalDefaults(selected),
      challenge_goals:goal.challenge_goals||{},
      updated_by:authUserId,
      updated_at:new Date().toISOString()
    };
    const {error}=await supabase.from('store_goals')
      .upsert(payload,{onConflict:'month,store_name'});
    if(error)return showLegacyAlert(`매장 목표 저장 실패: ${friendlyError(error)}`);
    showLegacyAlert('매장 목표를 저장했어요.');
    load();
  };

  return <div className="space-y-3">
    <div className="bg-white rounded-xl border p-4">
      <div className="font-bold">🏪 매장 목표 설정</div>
      <div className="text-xs text-gray-400 mt-1">
        회사 기준 + 매장 도전 목표 · 업셀 건수는 HS의 50% 자동 기준
      </div>
      <select
        value={selected}
        disabled={!canEditCompany}
        onChange={e=>setSelected(e.target.value)}
        className="mt-3 border rounded-lg p-2 text-sm disabled:bg-gray-50"
      >
        {stores.map(s=><option key={s} value={s}>{displayStoreName(s)}</option>)}
      </select>
      <div className="text-[10px] text-gray-400 mt-2">
        회사 기준 수정: 담당 이상 · 점장/부점장은 본인 매장 도전 목표만 수정
      </div>
    </div>

    <div className="bg-white rounded-xl border overflow-hidden">
      <div className="grid grid-cols-3 text-xs font-bold bg-gray-50 p-3">
        <span>지표</span><span>회사 기준</span><span>매장 도전</span>
      </div>
      {STORE_GOAL_METRICS.map(m=>(
        <div key={m.key} className="grid grid-cols-3 gap-2 items-center p-3 border-t text-xs">
          <span>{m.label}</span>
          <input
            disabled={!canEditCompany || m.key==='tailoredCount'}
            type="number"
            step={m.key==='productivity'?'0.1':'1'}
            value={goal.company_goals?.[m.key]??''}
            onChange={e=>setVal('company_goals',m.key,e.target.value)}
            className="border rounded p-2 disabled:bg-gray-50 disabled:text-gray-500"
          />
          <input
            type="number"
            step={m.key==='productivity'?'0.1':'1'}
            value={goal.challenge_goals?.[m.key]??''}
            onChange={e=>setVal('challenge_goals',m.key,e.target.value)}
            className="border rounded p-2"
          />
        </div>
      ))}
    </div>

    <div className="bg-white rounded-xl border overflow-hidden">
      <div className="px-4 py-3 border-b">
        <div className="text-sm font-bold">🎯 목표 달성 현황</div>
        <div className="text-xs text-gray-400 mt-0.5">회사 기준과 매장 도전 목표를 함께 확인해요.</div>
      </div>
      <div className="p-4 space-y-4">
        {STORE_GOAL_METRICS.map(m=>{
          const selectedRows=(rows||[]).filter(r=>r.branch===selected);
          const cur=storeGoalCurrent(
            selectedRows.reduce((acc,r)=>{
              if(!acc)return r.draft;
              return acc;
            },null)||emptyDraft(),
            null,
            m.key
          );
          let actual;
          if(m.key==='hs')actual=selectedRows.reduce((s,r)=>s+hsCount(r.draft),0);
          else if(m.key==='home')actual=selectedRows.reduce((s,r)=>s+completedHomeCount(r.draft),0);
          else if(m.key==='productivity')actual=selectedRows.reduce((s,r)=>s+Number(r.pay?.kpiScore||0),0);
          else if(m.key==='tvFree')actual=selectedRows.reduce((s,r)=>s+Number(r.draft?.homeFlat?.tvFree||0),0);
          else if(m.key==='smartHome')actual=selectedRows.reduce((s,r)=>s+Number(r.draft?.homeFlat?.smartHome||0),0);
          else if(m.key==='tailoredCount')actual=selectedRows.reduce((s,r)=>s+Number(r.draft?.tailoredCount||0),0);
          else actual=cur||0;
          if(finalPerformance)actual=finalStoreMetric(finalPerformance,m.key==='tvFree'?'free':m.key==='smartHome'?'smart':m.key,actual);

          const companyTarget=Number(goal.company_goals?.[m.key]||0);
          const challengeTarget=Number(goal.challenge_goals?.[m.key]||companyTarget||0);
          const companyPct=companyTarget?actual/companyTarget*100:0;
          const challengePct=challengeTarget?actual/challengeTarget*100:0;
          return <div key={m.key}>
            <div className="flex justify-between items-center text-xs gap-2">
              <span className="font-semibold text-gray-700">{m.label}</span>
              <span className="text-gray-500">
                {m.key==='productivity'?fmtNum(actual,1):fmtCount(actual)}
                {' / '}
                <b>{challengeTarget||'-'}</b>
              </span>
            </div>
            {finalPerformance&&<div className="text-[9px] text-emerald-600 mt-1">마감 확정 실적 기준</div>}
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden mt-1.5">
              <div className="h-full bg-brand-500 rounded-full" style={{width:`${Math.min(100,challengePct)}%`}} />
            </div>
            <div className="flex justify-between text-[10px] mt-1">
              <span className={companyPct>=100?'text-emerald-600 font-semibold':'text-gray-400'}>
                회사 {companyTarget||'-'} · {companyTarget?`${Math.round(companyPct)}%`:'-'} {companyPct>=100?'✓':''}
              </span>
              <span className={challengePct>=100?'text-emerald-600 font-semibold':'text-gray-400'}>
                도전 {challengeTarget||'-'} · {challengeTarget?`${Math.round(challengePct)}%`:'-'} {challengePct>=100?'✓':''}
              </span>
            </div>
          </div>
        })}
      </div>
    </div>

    <button onClick={save} className="w-full py-2.5 rounded-xl bg-brand-600 text-white text-sm font-bold">
      매장 목표 저장
    </button>
  </div>;
}


function SpotAdmin({ authUserId, isFullAdmin, month }) {
  const [policies,setPolicies]=useState([]);
  const [claims,setClaims]=useState([]);
  const [form,setForm]=useState({
    title:'',amount:'',start_date:'',end_date:'',description:'',
    rule_type:'per_unit',condition_metric:'hs',threshold:'',reward_metric:'hs',threshold_scope:'all'
  });
  const [editingPolicyId,setEditingPolicyId]=useState(null);
  const [editPolicy,setEditPolicy]=useState({});
  const [claimEdits,setClaimEdits]=useState({});

  const [claimLoadError,setClaimLoadError]=useState('');
  const load=useCallback(async()=>{
    setClaimLoadError('');
    const {data:p,error:pErr}=await supabase.from('spot_policies').select('*').order('created_at',{ascending:false});
    const {data:c,error:cErr}=await supabase.from('spot_claims').select('*').order('created_at',{ascending:false});
    if(pErr||cErr){setClaimLoadError(friendlyError(pErr||cErr));setPolicies(p||[]);setClaims([]);return;}
    const userIds=[...new Set((c||[]).map(x=>x.user_id).filter(Boolean))];
    let profiles=[]; if(userIds.length){const {data}=await supabase.from('profiles').select('id,name,store_name').in('id',userIds);profiles=data||[];}
    const pm=Object.fromEntries(profiles.map(x=>[x.id,x])), pol=Object.fromEntries((p||[]).map(x=>[x.id,x]));
    const merged=(c||[]).map(x=>({...x,profiles:pm[x.user_id]||null,spot_policies:x.policy_id?pol[x.policy_id]||null:null}));
    setPolicies(p||[]);setClaims(merged);
    const map={};merged.forEach(x=>map[x.id]={title:x.reviewed_title||x.direct_title||x.spot_policies?.title||'',amount:String(x.final_amount??x.direct_amount??x.spot_policies?.amount??''),memo:x.reviewed_memo||x.direct_memo||''});setClaimEdits(map);
  },[]);
  useEffect(()=>{load()},[load]);

  const add=async()=>{if(!form.title||!form.amount||!form.start_date||!form.end_date)return showLegacyAlert('정책명, 금액, 기간을 입력해주세요.');
    const {error}=await supabase.from('spot_policies').insert({
      ...form,
      amount:Number(form.amount),
      threshold:form.threshold?Number(form.threshold):null,
      created_by:authUserId
    });
    if(error)return showLegacyAlert(friendlyError(error));setForm({title:'',amount:'',start_date:'',end_date:'',description:'',rule_type:'per_unit',condition_metric:'hs',threshold:'',reward_metric:'hs',threshold_scope:'all'});load()};

  const savePolicy=async(id)=>{
    const p={...editPolicy,amount:Number(editPolicy.amount||0)};
    const {error}=await supabase.from('spot_policies').update({
      title:p.title,amount:p.amount,start_date:p.start_date,end_date:p.end_date,
      description:p.description||null,active:p.active!==false,
      rule_type:p.rule_type||'per_unit',
      condition_metric:p.condition_metric||null,
      threshold:p.threshold?Number(p.threshold):null,
      reward_metric:p.reward_metric||null,
      threshold_scope:p.threshold_scope||'all'
    }).eq('id',id).select('id').single();
    if(error)return showLegacyAlert(`정책 수정 실패: ${friendlyError(error)}`);
    setEditingPolicyId(null);setEditPolicy({});load();
  };

  const decide=async(id,status)=>{
    const edit=claimEdits[id]||{}, amount=Number(edit.amount||0);
    if(status==='approved'&&amount<=0)return showLegacyAlert('최종 승인 금액을 입력해주세요.');
    const {error}=await supabase.from('spot_claims').update({
      status,reviewed_by:authUserId,reviewed_at:new Date().toISOString(),
      final_amount:status==='approved'?amount:null,
      reviewed_title:String(edit.title||'').trim()||null,
      reviewed_memo:String(edit.memo||'').trim()||null
    }).eq('id',id).eq('status','pending').select('id').single();
    if(error)return showLegacyAlert(`스팟 처리 실패: ${friendlyError(error)}`);
    const claim=claims.find(x=>x.id===id);
    if(claim)await notifyEmployee({actorId:authUserId,recipientId:claim.user_id,type:status==='approved'?'spot_approved':'spot_rejected',title:`스팟 ${status==='approved'?'승인':'반려'}`,message:`${String(edit.title||'스팟')} · ${status==='approved'?won(amount):'반려됨'}`,payload:{claim_id:id,status}});
    load();
  };

  const pendingClaims=claims.filter(c=>c.status==='pending'); const doneClaims=claims.filter(c=>c.status!=='pending');
  const septemberLocked=isSeptemberPolicyActive(month);
  const policyDate=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'});
  const activeSpecials=SEPTEMBER_SPECIAL_SALES.filter(p=>p.startDate<=policyDate&&p.endDate>=policyDate);
  return <div className="space-y-3">
    {septemberLocked&&<div className="rounded-xl border border-brand-100 bg-brand-50 p-4"><div className="text-sm font-bold text-brand-800">9월 정책은 회사 확정본으로 운영돼요</div><div className="mt-1 text-xs text-brand-600">직원·매장 관리자는 스팟이나 특가 정책을 직접 만들거나 수정할 수 없어요. 확정된 특가&지인정책만 판매 입력에서 선택합니다.</div><div className="mt-3 divide-y divide-brand-100 rounded-xl bg-white px-3">{activeSpecials.map(p=><div key={p.key} className="flex items-center justify-between gap-2 py-2 text-[11px]"><span className="font-semibold text-gray-700">{p.model} · {p.saleType}</span><span className="text-brand-700">{p.policyType==='incentive_unpaid'?`인센미지급 · 고객 할인 ${won(p.customerDiscount)}`:`기존 정책 +${won(p.additionalAmount)}`}</span></div>)}</div></div>}
    {claimLoadError&&<div className="bg-red-50 border border-red-100 text-red-600 rounded-xl p-3 text-xs">스팟 승인 목록을 불러오지 못했어요: {claimLoadError}</div>}
    <div className="bg-white border rounded-xl overflow-hidden"><div className="px-4 py-3 border-b"><div className="font-bold text-sm">✅ 승인 대기 {pendingClaims.length}건</div><div className="text-xs text-gray-400">대시보드의 스팟 승인 건과 같은 목록이에요.</div></div><div className="divide-y">{pendingClaims.length===0?<div className="py-8 text-center text-xs text-gray-400">현재 승인 대기 스팟이 없어요.</div>:pendingClaims.map(c=>{const x=claimEdits[c.id]||{},direct=!c.policy_id;return <div key={c.id} className="p-4 text-xs"><div className="flex justify-between"><div><b>{c.profiles?.name||'직원'} · {c.profiles?.store_name||''}</b><div className="text-[10px] text-gray-400">{c.claim_date} · {c.customer_name||'고객 없음'} · {direct?'직접 입력':'등록 정책'}</div></div><span className="text-orange-500">확인대기</span></div><div className="space-y-2 mt-3"><input value={x.title||''} onChange={e=>setClaimEdits({...claimEdits,[c.id]:{...x,title:e.target.value}})} placeholder="정책명" className="w-full border rounded p-2"/><input value={x.amount||''} onChange={e=>setClaimEdits({...claimEdits,[c.id]:{...x,amount:e.target.value.replace(/\D/g,'')}})} placeholder="최종 승인 금액" className="w-full border rounded p-2"/><input value={x.memo||''} onChange={e=>setClaimEdits({...claimEdits,[c.id]:{...x,memo:e.target.value}})} placeholder="관리자 메모" className="w-full border rounded p-2"/></div><div className="grid grid-cols-2 gap-2 mt-3"><button onClick={()=>decide(c.id,'rejected')} className="py-2 bg-red-50 text-red-500 rounded">반려</button><button onClick={()=>decide(c.id,'approved')} className="py-2 bg-emerald-600 text-white rounded font-bold">승인</button></div></div>})}</div></div>
    {!septemberLocked&&<div className="bg-white border rounded-xl p-4">
      <div className="font-bold">🔥 스팟 정책 등록</div>
      <div className="grid grid-cols-2 gap-2 mt-3">
        <input placeholder="정책명" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} className="border rounded p-2 text-xs"/>
        <input placeholder="건당 금액" value={fmtInputNumber(form.amount)} onChange={e=>setForm({...form,amount:e.target.value.replace(/\D/g,'')})} className="border rounded p-2 text-xs"/>
        <input type="date" value={form.start_date} onChange={e=>setForm({...form,start_date:e.target.value})} className="border rounded p-2 text-xs"/>
        <input type="date" value={form.end_date} onChange={e=>setForm({...form,end_date:e.target.value})} className="border rounded p-2 text-xs"/>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-2">
        <select value={form.rule_type} onChange={e=>setForm({...form,rule_type:e.target.value})} className="border rounded p-2 text-xs">
          <option value="per_unit">건당 지급</option>
          <option value="threshold">몇 건 이상 달성형</option>
          <option value="linked">A조건 → B상품 지급</option>
          <option value="fixed">고정 보너스</option>
          <option value="manual">직접/예외 정책</option>
        </select>
        <input value={form.threshold} onChange={e=>setForm({...form,threshold:e.target.value.replace(/\D/g,'')})} placeholder="기준 건수 (선택)" className="border rounded p-2 text-xs"/>
        <select value={form.condition_metric} onChange={e=>setForm({...form,condition_metric:e.target.value})} className="border rounded p-2 text-xs">
          {ADMIN_MAIN_METRICS.filter(x=>x[2]==='count').map(x=><option key={x[0]} value={x[0]}>조건 · {x[1]}</option>)}
        </select>
        <select value={form.reward_metric} onChange={e=>setForm({...form,reward_metric:e.target.value})} className="border rounded p-2 text-xs">
          {ADMIN_MAIN_METRICS.filter(x=>x[2]==='count').map(x=><option key={x[0]} value={x[0]}>지급대상 · {x[1]}</option>)}
        </select>
        <select value={form.threshold_scope} onChange={e=>setForm({...form,threshold_scope:e.target.value})} className="col-span-2 border rounded p-2 text-xs">
          <option value="all">기준 달성 시 전체 건 적용</option>
          <option value="after">기준 달성 이후 건부터 적용</option>
        </select>
      </div>
      <input placeholder="설명 (선택)" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} className="mt-2 w-full border rounded p-2 text-xs"/>
      <button onClick={add} className="mt-2 w-full bg-orange-500 text-white rounded-lg py-2 text-xs font-bold">정책 등록</button>
    </div>}

    {!septemberLocked&&<div className="bg-white border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b"><div className="font-bold text-sm">등록된 정책 관리</div><div className="text-xs text-gray-400">명칭·금액·기간 수정 가능</div></div>
      <div className="divide-y">{policies.map(p=><div key={p.id} className="p-3 text-xs">
        {editingPolicyId===p.id?<div className="space-y-2">
          <input value={editPolicy.title||''} onChange={e=>setEditPolicy({...editPolicy,title:e.target.value})} className="w-full border rounded p-2"/>
          <div className="grid grid-cols-3 gap-2">
            <input value={editPolicy.amount||''} onChange={e=>setEditPolicy({...editPolicy,amount:e.target.value.replace(/\D/g,'')})} className="border rounded p-2"/>
            <input type="date" value={editPolicy.start_date||''} onChange={e=>setEditPolicy({...editPolicy,start_date:e.target.value})} className="border rounded p-2"/>
            <input type="date" value={editPolicy.end_date||''} onChange={e=>setEditPolicy({...editPolicy,end_date:e.target.value})} className="border rounded p-2"/>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select value={editPolicy.rule_type||'per_unit'} onChange={e=>setEditPolicy({...editPolicy,rule_type:e.target.value})} className="border rounded p-2">
              <option value="per_unit">건당 지급</option><option value="threshold">몇 건 이상 달성형</option><option value="linked">A조건 → B상품 지급</option><option value="fixed">고정 보너스</option><option value="manual">직접/예외 정책</option>
            </select>
            <input value={editPolicy.threshold??''} onChange={e=>setEditPolicy({...editPolicy,threshold:e.target.value.replace(/\D/g,'')})} placeholder="기준 건수" className="border rounded p-2"/>
            <select value={editPolicy.condition_metric||'hs'} onChange={e=>setEditPolicy({...editPolicy,condition_metric:e.target.value})} className="border rounded p-2">
              {ADMIN_MAIN_METRICS.filter(x=>x[2]==='count').map(x=><option key={x[0]} value={x[0]}>조건 · {x[1]}</option>)}
            </select>
            <select value={editPolicy.reward_metric||'hs'} onChange={e=>setEditPolicy({...editPolicy,reward_metric:e.target.value})} className="border rounded p-2">
              {ADMIN_MAIN_METRICS.filter(x=>x[2]==='count').map(x=><option key={x[0]} value={x[0]}>지급대상 · {x[1]}</option>)}
            </select>
            <select value={editPolicy.threshold_scope||'all'} onChange={e=>setEditPolicy({...editPolicy,threshold_scope:e.target.value})} className="col-span-2 border rounded p-2">
              <option value="all">기준 달성 시 전체 건 적용</option><option value="after">기준 달성 이후 건부터 적용</option>
            </select>
          </div>
          <label className="flex gap-2"><input type="checkbox" checked={editPolicy.active!==false} onChange={e=>setEditPolicy({...editPolicy,active:e.target.checked})}/> 활성</label>
          <div className="grid grid-cols-2 gap-2"><button onClick={()=>setEditingPolicyId(null)} className="py-2 bg-gray-100 rounded">취소</button><button onClick={()=>savePolicy(p.id)} className="py-2 bg-brand-600 text-white rounded font-bold">저장</button></div>
        </div>:<div className="flex justify-between gap-2"><div><b>{p.title} · {won(p.amount)}</b><div className="text-[10px] text-gray-400">{p.start_date} ~ {p.end_date} · {p.active?'활성':'비활성'}</div></div>
          <button onClick={()=>{setEditingPolicyId(p.id);setEditPolicy({...p,amount:String(p.amount||'')})}} className="text-brand-600">수정</button></div>}
      </div>)}</div>
    </div>}

    {isFullAdmin&&!septemberLocked&&<React.Suspense fallback={<div className="p-4 text-sm">특판 승인 화면을 불러오는 중…</div>}><SpecialSalePolicyAdmin authUserId={authUserId} won={won} fmtInputNumber={fmtInputNumber} notifyEmployee={notifyEmployee} /></React.Suspense>}

    {false&&<div className="bg-white border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b"><div className="font-bold text-sm">직원 스팟 검토</div><div className="text-xs text-gray-400">직접 입력 건은 수정 후 승인하세요.</div></div>
      <div className="divide-y">{claims.map(c=>{const x=claimEdits[c.id]||{}, direct=!c.policy_id;return <div key={c.id} className="p-4 text-xs">
        <div className="flex justify-between"><div><b>{c.profiles?.name||'직원'} · {c.profiles?.store_name||''}</b><div className="text-[10px] text-gray-400">{c.claim_date} · {c.customer_name||'고객 없음'} · {direct?'직접 입력':'등록 정책'}</div></div>
          <span className={c.status==='approved'?'text-emerald-600':c.status==='rejected'?'text-red-500':'text-orange-500'}>{c.status==='approved'?'승인':c.status==='rejected'?'반려':'확인대기'}</span></div>
        <div className="space-y-2 mt-3">
          <input value={x.title||''} onChange={e=>setClaimEdits({...claimEdits,[c.id]:{...x,title:e.target.value}})} placeholder="정책명" className="w-full border rounded p-2"/>
          <input value={x.amount||''} onChange={e=>setClaimEdits({...claimEdits,[c.id]:{...x,amount:e.target.value.replace(/\D/g,'')}})} placeholder="최종 승인 금액" className="w-full border rounded p-2"/>
          <input value={x.memo||''} onChange={e=>setClaimEdits({...claimEdits,[c.id]:{...x,memo:e.target.value}})} placeholder="관리자 메모" className="w-full border rounded p-2"/>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3"><button onClick={()=>decide(c.id,'rejected')} className="py-2 bg-red-50 text-red-500 rounded">반려</button><button onClick={()=>decide(c.id,'approved')} className="py-2 bg-emerald-600 text-white rounded font-bold">{c.status==='approved'?'수정 저장':'수정 후 승인'}</button></div>
      </div>})}</div>
    </div>}
  </div>;
}

/* ===================== v17 고객관리 ===================== */


function DailyOneLiner({ userId, month, pay, draft, config, competitionRows, branch, onGoCare, onGoInput }) {
  const [todayTasks,setTodayTasks]=useState(0);
  const [messageIndex,setMessageIndex]=useState(0);

  useEffect(()=>{
    if(!userId)return;
    let alive=true;
    const loadTodayTasks=async()=>{
      const today=new Date().toISOString().slice(0,10);
      const {count}=await supabase.from('customer_tasks')
        .select('id',{count:'exact',head:true})
        .eq('user_id',userId)
        .eq('status','pending')
        .lte('due_date',today);
      if(alive)setTodayTasks(Number(count||0));
    };
    loadTodayTasks();
    const refresh=(event)=>{if(!event.detail?.userId||String(event.detail.userId)===String(userId))loadTodayTasks();};
    window.addEventListener('customer-tasks-changed',refresh);
    return()=>{alive=false;window.removeEventListener('customer-tasks-changed',refresh)};
  },[userId,month]);

  const messages=useMemo(()=>{
    const out=[];

    // 1순위: 오늘/지연 고객 약속
    if(todayTasks>0){
      out.push({
        icon:'🔔',
        text:`오늘 확인할 고객 약속 ${todayTasks}건이 있어요`,
        action:'확인',
        onClick:onGoCare,
        priority:100,
      });
    }

    // 2순위: 가장 유리한 다음 행동
    const next=buildNextGoal(pay,draft,config);
    if(next){
      out.push({
        icon:'🎯',
        text:`${next.title} · ${next.remain}${next.unit} 더하면 예상 +${won(next.delta)}`,
        action:'입력',
        onClick:onGoInput,
        priority:80,
      });
    }

    // 3순위: 개인 실적 흐름
    const hs=hsCount(draft);
    const productivity=Number(pay?.kpiScore||0);
    if(hs>0){
      out.push({icon:'🔥',text:`이번 달 HS ${hs}건 기록 중`,priority:50});
    }
    if(productivity>0){
      out.push({icon:'📈',text:`이번 달 생산성 ${productivity.toFixed(1)}P 기록 중`,priority:45});
    }

    // 4순위: 우리 매장 내 현재 위치
    const branchRows=(competitionRows||[]).filter(r=>r.branch===branch);
    if(branchRows.length>1){
      const sorted=[...branchRows].sort((a,b)=>Number(b.pay?.total||0)-Number(a.pay?.total||0));
      const rank=sorted.findIndex(r=>r.id===userId)+1;
      if(rank>0){
        out.push({icon:'🏪',text:`우리 매장 예상 인센티브 현재 ${rank}/${sorted.length}위`,priority:30});
      }
    }

    if(!out.length){
      out.push({icon:'✨',text:'오늘 실적을 입력하면 맞춤 한 줄이 시작돼요',action:'입력',onClick:onGoInput,priority:1});
    }

    return out.sort((a,b)=>b.priority-a.priority);
  },[todayTasks,pay,draft,config,competitionRows,branch,userId,onGoCare,onGoInput]);

  useEffect(()=>{
    if(messageIndex>=messages.length)setMessageIndex(0);
  },[messages.length,messageIndex]);

  const item=messages[messageIndex]||messages[0];
  if(!item)return null;

  const nextMessage=()=>{
    if(messages.length>1)setMessageIndex(i=>(i+1)%messages.length);
  };

  return <div className="bg-white border border-gray-100 rounded-xl px-3.5 py-2.5 flex items-center gap-2.5 min-w-0">
    <span className="text-base shrink-0">{item.icon}</span>
    <button
      type="button"
      onClick={item.onClick||nextMessage}
      className="flex-1 min-w-0 text-left text-xs font-medium text-gray-700 truncate"
    >
      {item.text}
    </button>
    {item.action&&(
      <button type="button" onClick={item.onClick} className="text-[11px] font-bold text-brand-600 shrink-0">
        {item.action}
      </button>
    )}
    {messages.length>1&&(
      <button type="button" onClick={nextMessage} className="text-[11px] text-gray-400 shrink-0" aria-label="다음 한 줄">
        {messageIndex+1}/{messages.length} ›
      </button>
    )}
  </div>;
}


function MyInputSummary({userId,month,config}){
  const [open,setOpen]=useState(false);
  const [loading,setLoading]=useState(true);
  const [loadError,setLoadError]=useState('');
  const [summary,setSummary]=useState({mobile:[],strategicVas:[],insurance:[],second:[],home:[],homePending:[],totalHs:0,totalHome:0,totalHomePending:0,totalStrategicPlan:0,totalStrategicVas:0,totalInsurance:0,totalSecond:0});

  useEffect(()=>{
    if(!userId)return;
    let alive=true;
    (async()=>{
      setLoading(true);
      const [y,m]=month.split('-').map(Number), next=new Date(y,m,1);
      const to=`${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}-01`;
      const [{data:sales,error:se},{data:homes,error:he}]=await Promise.all([
        supabase.from('customer_sales').select('source_type,source_meta,metric_label').eq('user_id',userId).gte('sale_date',`${month}-01`).lt('sale_date',to),
        supabase.from('home_orders').select('id,customer_id,customer_name,product_type,status,source_work_date,actual_install_date').eq('user_id',userId)
          .or(`source_work_date.gte.${month}-01,actual_install_date.gte.${month}-01`)
      ]);
      if(!alive)return;
      if(se||he){
        setLoadError(friendlyError(se||he));
        setLoading(false);
        return;
      }
      setLoadError('');
      const inc=(o,k,n=1)=>{if(k)o[k]=Number(o[k]||0)+n};
      const mobile={},strategicVas={},insurance={},second={},home={},homePending={};
      let totalHs=0,totalStrategicPlan=0;
      (sales||[]).filter(x=>x.source_type==='mobile').forEach(x=>{
        const meta=x.source_meta||{}, ri=Number(meta.ri), ci=Number(meta.ci);
        const rd=MATRIX_ROW_DEFS[ri];
        if(!rd)return;
        const label=rd.hasTiers?`${rd.dailyLabel||rd.label} · ${MATRIX_COLS[ci]||''}`:(rd.dailyLabel||rd.label);
        inc(mobile,label);
        if(HS_PARTS.some(p=>p.idx===ri))totalHs++;
        if(meta.strategicPlan)totalStrategicPlan++;
        [...(meta.vasKeys||[]),...Object.values(meta.bundleVasMap||{}).flat()].forEach(k=>{
          if(k==='vasNone')return;
          const v=(config.vas||[]).find(z=>z.key===k);
          if(k==='vasPhonePass'||k==='vasSafePass')inc(insurance,v?.label||k);
          else inc(strategicVas,v?.label||k);
        });
        (meta.bundle2ndKeys||[]).forEach(k=>{
          const v=(config.bundle2nd||[]).find(z=>z.key===k);
          inc(second,v?.label||k);
        });
        if(meta.usedMnpBundle)inc(mobile,'중고 MNP 61군↑ 결합');
      });
      const validHomes=homeOrdersForMonth(homes||[],month);
      const completedHomes=homeOrdersForMonth(validHomes,month,'completed');
      const pendingHomes=homeOrdersForMonth(validHomes,month,'pending');
      const addHomeRows=(rows,target)=>rows.forEach(x=>{
        const labels={internet1g:'인터넷 1GB',internet500:'인터넷 500MB',internet100:'인터넷 100MB',homeOnly:'인터넷 단독',homeTv:'TV(주)',tvFree:'TV프리(부)',smartHome:'스마트홈'};
        const fallbackLabel=String(x.product_type||'홈 기타')
          .replace(/^internet1g$/i,'인터넷 1GB')
          .replace(/^internet500$/i,'인터넷 500MB')
          .replace(/^internet100$/i,'인터넷 100MB')
          .replace(/^simulNewChange$/i,'홈 + HS 신규/기변 동시판매')
          .replace(/^simulMnp$/i,'홈 + HS MNP 동시판매');
        inc(target,labels[x.product_type]||fallbackLabel);
      });
      addHomeRows(completedHomes,home);
      addHomeRows(pendingHomes,homePending);
      // 홈은 한 고객 묶음이 홈+TV/인터넷/동시판매 등 여러 행으로 저장되므로
      // 같은 날짜+고객을 핵심 판매 1건으로 계산합니다.
      const arr=o=>Object.entries(o).sort((a,b)=>b[1]-a[1]).map(([label,count])=>({label,count}));
      const result={mobile:arr(mobile),strategicVas:arr(strategicVas),insurance:arr(insurance),second:arr(second),home:arr(home),homePending:arr(homePending),totalHs,totalHome:homeBundleCount(completedHomes),totalHomePending:homeBundleCount(pendingHomes),totalStrategicPlan,totalStrategicVas:Object.values(strategicVas).reduce((a,v)=>a+v,0),totalInsurance:Object.values(insurance).reduce((a,v)=>a+v,0),totalSecond:Object.values(second).reduce((a,v)=>a+v,0)};
      setSummary(result);setLoading(false);
    })().catch(e=>{console.error('INPUT SUMMARY LOAD ERROR',e);if(alive){setLoadError(friendlyError(e));setLoading(false)}});
    return()=>{alive=false};
  },[userId,month,config]);

  const Group=({title,rows})=>rows?.length?<div className="py-2"><div className="text-[11px] font-bold text-gray-500 mb-1.5">{title}</div><div className="space-y-1">{rows.map((x,i)=><div key={`${title}-${i}`} className="flex justify-between text-xs"><span className="text-gray-600">{x.label}</span><b className="text-gray-900">{x.count}건</b></div>)}</div></div>:null;

  return <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
    <button type="button" onClick={()=>setOpen(v=>!v)} className="w-full px-4 py-3 text-left">
      <div className="flex justify-between items-center gap-3">
        <div><div className="text-sm font-bold text-gray-900">내 입력 실적 요약</div><div className="text-[10px] text-gray-400 mt-0.5">내가 직접 등록한 월 누적 실적을 확인해요.</div></div>
        <ChevronDown size={16} className={`text-gray-400 transition ${open?'rotate-180':''}`}/>
      </div>
      <div className="mt-2 space-y-1.5">
        <div className="flex flex-wrap gap-1.5"><span className="px-2 py-1 rounded-full bg-brand-50 text-brand-700 text-[10px] font-bold">HS {summary.totalHs}건</span><span className="px-2 py-1 rounded-full bg-orange-50 text-orange-700 text-[10px] font-bold">홈 상품 {summary.totalHome}건</span>{summary.totalHomePending>0&&<span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold">홈 대기 {summary.totalHomePending}건</span>}</div>
        <div className="flex flex-wrap gap-1.5"><span className="px-2 py-1 rounded-full bg-brand-50 text-brand-700 text-[10px] font-bold">전략요금제 {summary.totalStrategicPlan}건</span><span className="px-2 py-1 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold">전략 VAS {summary.totalStrategicVas}건</span><span className="px-2 py-1 rounded-full bg-rose-50 text-rose-700 text-[10px] font-bold">보험·케어 {summary.totalInsurance}건</span><span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">2ND {summary.totalSecond}건</span></div>
      </div>
    </button>
    {open&&<div className="border-t border-gray-50 px-4 py-2 divide-y divide-gray-50">
      {loading?<div className="py-5 text-center text-xs text-gray-400">입력 실적을 불러오는 중...</div>:loadError?<div className="py-5 text-center text-xs text-red-500">실적 요약을 불러오지 못했어요 · {loadError}</div>:<>
        <Group title="모바일" rows={summary.mobile}/>
        {summary.totalStrategicPlan>0&&<Group title="전략요금제" rows={[{label:'본사 전략요금제',count:summary.totalStrategicPlan}]}/>}
        <Group title="전략 VAS" rows={summary.strategicVas}/>
        <Group title="보험·케어" rows={summary.insurance}/>
        <Group title="2ND" rows={summary.second}/>
        <Group title="홈 상품" rows={summary.home}/>
        <Group title="홈 설치대기" rows={summary.homePending}/>
        {!summary.mobile.length&&!summary.strategicVas.length&&!summary.insurance.length&&!summary.second.length&&!summary.home.length&&!summary.homePending.length&&<div className="py-5 text-center text-xs text-gray-400">이번 달 입력 실적이 없어요.</div>}
      </>}
    </div>}
  </div>;
}


function EmployeeHeadOfficeComparison({userId,month,mergedDraft,pay,config,compact=false,onOpen}){
  const [hq,setHq]=useState(undefined);
  const [hqError,setHqError]=useState(false);
  useEffect(()=>{
    setHq(undefined);setHqError(false);
    if(!userId){setHq(null);return;}
    let alive=true;
    (async()=>{const {data,error}=await supabase.from('head_office_performance').select('metrics,as_of_date').eq('user_id',userId).eq('month',month).maybeSingle();if(alive){setHq(error?null:(data||null));setHqError(!!error);}})();
    return()=>{alive=false};
  },[userId,month]);
  const input={hs:hsCount(mergedDraft),second:matrixRowCount(mergedDraft,7)+Object.values(mergedDraft?.bundle2nd||{}).reduce((s,v)=>s+Number(v||0),0),gradePoints:Number(pay?.totalPoints||0)};
  const metrics=hq?.metrics?normalizeHeadOfficeMetrics(hq.metrics):null;
  const official=metrics?headOfficeScores(metrics,config,month):null;
  const rows=official?[['HS',input.hs,official.hs],['2ND',input.second,official.second],['성과P',input.gradePoints,official.gradePoints]]:[];
  if(compact)return rows.some(([,personal,head])=>Math.abs(Number(head)-Number(personal))>0.05)?<button type="button" onClick={onOpen} className="w-full rounded-xl bg-brand-50 px-4 py-3 text-left text-sm font-medium text-brand-700">확인할 실적 차이가 있어요 <span aria-hidden="true">›</span></button>:null;
  return <div className="bg-white rounded-2xl border border-gray-100 p-4" aria-label="본사 실적 비교">
    <div className="flex items-start justify-between gap-3"><div><div className="text-sm font-bold text-gray-900">본사 실적 비교</div><div className="text-[10px] text-gray-400 mt-0.5">급여는 직원 입력 기준이며 본사 값은 정산 대조용이에요.</div></div><span className={`shrink-0 px-2 py-1 rounded-full text-[9px] font-bold ${official?'bg-blue-50 text-blue-700':'bg-gray-100 text-gray-400'}`}>{official?`${hq.as_of_date} 확인`:'본사 미확인'}</span></div>
    {hqError?<p role="alert" className="mt-3 text-sm text-red-600">본사 데이터를 불러오지 못했어요. 잠시 후 다시 확인해주세요.</p>:hq===undefined?<div className="py-4 text-center text-xs text-gray-300">본사 데이터를 확인하는 중...</div>:official?<div className="mt-3 space-y-2">{rows.map(([label,personal,head])=>{const diff=Number(head)-Number(personal);return <div key={label} className="grid grid-cols-[55px_1fr_1fr_55px] gap-2 items-center text-[11px]"><b className="text-gray-600">{label}</b><span className="text-gray-400">입력 <b className="text-gray-700">{fmtNum(personal,1)}</b></span><span className="text-blue-500">본사 <b className="text-blue-700">{fmtNum(head,1)}</b></span><b className={`text-right ${diff===0?'text-gray-300':diff>0?'text-blue-600':'text-red-500'}`}>{diff>0?'+':''}{fmtNum(diff,1)}</b></div>})}</div>:<div className="mt-3 rounded-xl bg-gray-50 px-3 py-3 text-[10px] text-gray-400">본사 데이터 등록 전 · 직원 입력 기준</div>}
  </div>;
}

function employeeStoreScopeOptions(employee, rows=[]) {
  const available=[...new Set((rows||[]).map(row=>row.branch).filter(branch=>branch&&!NON_SALES_STORES.includes(branch)))];
  const keep=branches=>(branches||[]).filter(branch=>available.includes(branch));
  if(COMPANY_SCOPE_VIEWERS.has(employee?.id))return [
    {key:'company',label:'회사 전체',branches:available},
    {key:'area:ansan',label:SALES_AREA_LABELS.ansan,branches:keep(SALES_AREA_STORES.ansan)},
    {key:'area:siheung',label:SALES_AREA_LABELS.siheung,branches:keep(SALES_AREA_STORES.siheung)},
    ...available.map(branch=>({key:`store:${branch}`,label:displayStoreName(branch),branches:[branch]})),
  ];
  const areaKey=SALES_MANAGER_AREAS[employee?.id];
  if(areaKey){
    const branches=keep(employee?.storeScope?.length?employee.storeScope:SALES_AREA_STORES[areaKey]);
    return [
      {key:`area:${areaKey}`,label:SALES_AREA_LABELS[areaKey],branches},
      ...branches.map(branch=>({key:`store:${branch}`,label:displayStoreName(branch),branches:[branch]})),
    ];
  }
  return employee?.branch?[{key:`store:${employee.branch}`,label:displayStoreName(employee.branch),branches:[employee.branch]}]:[];
}

function EmployeeView({ tab, setTab, months, month, setMonth, draft, setDraft, config, pay, mergedDraft, status, saveDraft, saving, saved, dirty, lastSavedAt, dailyDays, allDailyRecords, saveDailyDay, monthLocked, policyInputBlocked=false, canSeeCriteria, myRank, myRankTotal, myBranchRank, myBranchTotal, currentEmp, loginEmp, stores, onTeamCreditSaved, onHomeOrdersChanged, onSalesChanged, personalGoals, savePersonalGoals, goalSaving, showPersonalGoal, competitionRows, storeOverviewRows=competitionRows, canViewStoreRanking=false, authUser, authProfile, onOpenStoreGoals }) {
  const viewedUserId=currentEmp?.id||authUser?.id;
  const isManagingAnotherEmployee=!!authUser?.id&&!!currentEmp?.id&&currentEmp.id!==authUser.id;
  const [expenseTotal,setExpenseTotal]=useState(0);
  const [homeDetailOpen,setHomeDetailOpen]=useState(false);
  const [employeeHomeMode,setEmployeeHomeMode]=useState('personal'); // personal | store
  const storeScopeOptions=useMemo(()=>employeeStoreScopeOptions(currentEmp,storeOverviewRows),[currentEmp?.id,currentEmp?.branch,currentEmp?.storeScope,storeOverviewRows]);
  const [storeScopeKey,setStoreScopeKey]=useState('');
  useEffect(()=>{
    if(!storeScopeOptions.length){setStoreScopeKey('');return;}
    setStoreScopeKey(current=>storeScopeOptions.some(option=>option.key===current)?current:storeScopeOptions[0].key);
  },[storeScopeOptions]);
  const selectedStoreScope=storeScopeOptions.find(option=>option.key===storeScopeKey)||storeScopeOptions[0];
  const isSalesManager=!!SALES_MANAGER_AREAS[currentEmp?.id];
  const [homeApprovalPending,setHomeApprovalPending]=useState(0);
  const [approvalRows,setApprovalRows]=useState([]);
  const [approvalOpen,setApprovalOpen]=useState(false);
  const [homeTodayInputCount,setHomeTodayInputCount]=useState(0);
  const [showClosingAmount,setShowClosingAmount]=useState(false);
  const [payDialogTab,setPayDialogTab]=useState('forecast');
  const [historyOpen,setHistoryOpen]=useState({mobile:false,home:false,spot:false,expense:false});
  const [historySpotTotal,setHistorySpotTotal]=useState(0);
  const [historySpotRows,setHistorySpotRows]=useState([]);
  const [historyExpenseRows,setHistoryExpenseRows]=useState([]);
  const [ledgerReady,setLedgerReady]=useState(false);
  const [ledgerError,setLedgerError]=useState(false);
  const [approvalError,setApprovalError]=useState(false);
  const displayPay=payDisplay(pay,historySpotTotal,expenseTotal);
  const [ledgerRevision,setLedgerRevision]=useState(0);
  useEffect(()=>{const refresh=()=>setLedgerRevision(v=>v+1);window.addEventListener('sales-data-changed',refresh);return()=>window.removeEventListener('sales-data-changed',refresh)},[]);
  const [careNavIntent,setCareNavIntent]=useState(null);
  const goCustomerCare=(type)=>{setCareNavIntent({type,at:Date.now()});setTab('customerCare')};
  useEffect(() => {
    if (!viewedUserId) return;
    let alive=true;setLedgerReady(false);setLedgerError(false);
    (async () => {
      const [y, m] = month.split('-').map(Number);
      const next = new Date(y, m, 1);
      const to = `${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}-01`;

      const [expenseRes,spotRes]=await Promise.all([
        supabase.from('sales_expenses').select('expense_date,customer_name,category,amount,memo').is('voided_at',null).eq('user_id',viewedUserId).gte('expense_date',`${month}-01`).lt('expense_date',to).order('expense_date'),
        supabase.from('spot_claims').select('claim_date,customer_name,status,source_context,reviewed_title,direct_title,final_amount,direct_amount,spot_policies(title,amount)').eq('user_id',viewedUserId).eq('status','approved').gte('claim_date',`${month}-01`).lt('claim_date',to).order('claim_date')
      ]);
      if(!alive)return;
      if(expenseRes.error||spotRes.error){setLedgerError(true);return;}
      if(!expenseRes.error){
        setHistoryExpenseRows(expenseRes.data||[]);
        setExpenseTotal((expenseRes.data||[]).reduce((sum,x)=>sum+Number(x.amount||0),0));
      }
      if(!spotRes.error){
        const nonMobile=(spotRes.data||[]).filter(x=>x.source_context!=='mobile');
        setHistorySpotRows(nonMobile);
        setHistorySpotTotal(nonMobile.reduce((sum,x)=>sum+Number(x.final_amount??x.direct_amount??x.spot_policies?.amount??0),0));
      }
      setLedgerReady(true);
    })().catch(()=>{if(alive)setLedgerError(true)});
    return()=>{alive=false};
  }, [viewedUserId, month, dailyDays, tab, ledgerRevision]);

  // v21.28: '승인 대기'는 실제 승인 대상(스팟/특판 예외금액)이 있을 때만 표시
  useEffect(()=>{
    if(!viewedUserId)return;
    let alive=true;
    (async()=>{
      try{
        const [y,m]=month.split('-').map(Number);
        const next=new Date(y,m,1);
        const to=`${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}-01`;
        const now=new Date();
        const todayKey=monthKeyOf(now);
        const todayDate=`${todayKey}-${String(now.getDate()).padStart(2,'0')}`;

        const [spotRes,saleRes,todayRes]=await Promise.all([
          supabase.from('spot_claims').select('id,claim_date,customer_name,source_context,direct_title,direct_amount,spot_policies(title,amount)').eq('user_id',viewedUserId).eq('status','pending').gte('claim_date',`${month}-01`).lt('claim_date',to),
          supabase.from('customer_sales').select('id,sale_date,metric_label,source_meta,customers(customer_name)').eq('user_id',viewedUserId).eq('source_type','mobile').gte('sale_date',`${month}-01`).lt('sale_date',to),
          todayKey===month
            ? supabase.from('customer_sales').select('id').eq('user_id',viewedUserId).eq('sale_date',todayDate)
            : Promise.resolve({data:[],error:null})
        ]);

        if(spotRes.error||saleRes.error||todayRes.error)throw spotRes.error||saleRes.error||todayRes.error;
        const specialPending=(saleRes.data||[]).filter(x=>x.source_meta?.specialPolicy?.exceptionStatus==='pending').length;
        if(alive){
          setApprovalError(false);
          setHomeApprovalPending((spotRes.data||[]).length+specialPending);
          setApprovalRows([
            ...(spotRes.data||[]).map(x=>({id:`spot-${x.id}`,kind:'spot',date:x.claim_date,customer:x.customer_name||'고객명 없음',title:x.direct_title||x.spot_policies?.title||'스팟 인센티브',amount:Number(x.direct_amount??x.spot_policies?.amount??0),statusLabel:'관리자 승인 대기'})),
            ...(saleRes.data||[]).filter(x=>x.source_meta?.specialPolicy?.exceptionStatus==='pending').map(x=>({id:`special-${x.id}`,kind:'special',date:x.sale_date,customer:x.customers?.customer_name||'고객명 없음',title:`특판 예외금액 · ${x.metric_label||'모바일'}`,amount:Number(x.source_meta?.specialPolicy?.exceptionRequestedAmount||0),statusLabel:'예외금액 승인 대기'}))
          ]);
          setHomeTodayInputCount((todayRes.data||[]).length);
        }
      }catch(e){
        if(alive)setApprovalError(true);
      }
    })();
    return()=>{alive=false};
  },[viewedUserId,month,dailyDays]);

  const set = (group, next) => setDraft({ ...draft, [group]: next });
  useEffect(() => {
    if (tab === 'criteria' && !canSeeCriteria) setTab('home');
  }, [tab, canSeeCriteria]); // eslint-disable-line
  const dailyAgg = useMemo(() => aggregateDaily(dailyDays, month), [dailyDays, month]);
  const groupAutoKeys = useMemo(() => {
    const out = {};
    DAILY_GROUP_KEYS.forEach((gk) => {
      out[gk] = new Set(Object.entries(dailyAgg.groups[gk] || {}).filter(([, v]) => v > 0).map(([k]) => k));
    });
    return out;
  }, [dailyAgg]);
  const numericAuto = useMemo(() => {
    const out = {};
    DAILY_NUMERIC_KEYS.forEach((k) => { out[k] = (dailyAgg[k] || 0) > 0; });
    return out;
  }, [dailyAgg]);
  const autoMobileKeys = useMemo(() => new Set([
    ...(config.categoryMap || []).map((m) => m.mobilePointKey).filter(Boolean),
    ...(config.gibyeonColumnMap || DEFAULT_GIBYEON_COLUMN_MAP).filter(Boolean),
  ]), [config.categoryMap, config.gibyeonColumnMap]);
  const autoKpiKeys = useMemo(() => new Set([
    ...(config.categoryMap || []).map((m) => m.kpiKey).filter(Boolean),
    ...HOME_KPI_MAP.filter((m) => m.sources.some((p) => {
      const [gk, k] = p.split('.');
      return ((dailyAgg.groups[gk] || {})[k] || 0) > 0;
    })).map((m) => m.kpiKey),
  ]), [config.categoryMap, dailyAgg]);

  const nowForHome=new Date();
  const isCurrentHomeMonth=monthKeyOf(nowForHome)===month;
  const todayHomeKey=String(nowForHome.getDate()).padStart(2,'0');
  const todayHasInput=isCurrentHomeMonth && (homeTodayInputCount>0 || dayHasData(dailyDays?.[todayHomeKey]));
  const todayIsDayOff=isCurrentHomeMonth && !!normalizeDay(dailyDays?.[todayHomeKey]).dayOff;
  return (
    <div className="app-content max-w-5xl mx-auto px-4 py-5 pb-24">
      {ledgerError&&<p role="alert" className="mb-3 text-sm text-red-700">비용·스팟을 불러오지 못해 합계 표시를 보류했습니다. 화면을 다시 열어주세요.</p>}
      {!(tab==='daily'&&policyInputBlocked)&&<PolicyVersionNotice month={month} blocked={policyInputBlocked} />}
      {isManagingAnotherEmployee&&<div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"><div className="text-[10px] font-bold text-amber-600">직원 대리 관리 중</div><div className="mt-0.5 text-sm font-black text-amber-900">{currentEmp?.name} 직원의 실적·고객·약속·홈 설치를 보고 수정합니다.</div><div className="mt-1 text-[10px] text-amber-700">판매·홈 변경 이력에는 실제 처리한 관리자 계정이 기록됩니다.</div></div>}
      {tab === 'home' && (
        <div className="space-y-4">
          <div className="bg-gray-100 rounded-xl p-1 grid grid-cols-2 gap-1">
            <button type="button" onClick={()=>setEmployeeHomeMode('personal')}
              className={`py-2 rounded-lg text-xs font-bold transition ${employeeHomeMode==='personal'?'bg-white text-brand-700 shadow-sm':'text-gray-500'}`}>
              개인
            </button>
            <button type="button" onClick={()=>setEmployeeHomeMode('store')}
              className={`py-2 rounded-lg text-xs font-bold transition ${employeeHomeMode==='store'?'bg-white text-brand-700 shadow-sm':'text-gray-500'}`}>
              매장
            </button>
          </div>

          {employeeHomeMode==='personal' ? <>
            <GamificationHub dailyDays={dailyDays} month={month} personalGoals={personalGoals} mergedDraft={mergedDraft} pay={pay} competitionRows={competitionRows} userId={viewedUserId} authUserId={authUser?.id} currentEmp={currentEmp}
              currentAmount={ledgerReady?displayPay.current:null}
              onOpenPay={()=>{setPayDialogTab('forecast');setShowClosingAmount(true)}} onGoInput={()=>setTab('daily')} />
            <TodayWorkCard userId={viewedUserId} todayInputDone={todayHasInput||todayIsDayOff}
              approvalPending={homeApprovalPending} approvalDone={historySpotRows.length} approvalError={approvalError}
              onNavigate={goCustomerCare} onOpenApprovals={()=>approvalError?showAppToast('승인 현황을 불러오지 못했어요. 잠시 후 다시 확인해주세요.',{tone:'error'}):homeApprovalPending>0?setApprovalOpen(true):setTab('history')} onGoInput={()=>setTab('daily')} />

            {showClosingAmount&&<div className="fixed inset-0 z-[95] bg-black/40 flex items-end sm:items-center justify-center" onClick={()=>setShowClosingAmount(false)}>
              <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5" onClick={e=>e.stopPropagation()}>
                <div className="flex items-center justify-between"><div className="text-sm font-bold text-gray-900">급여 확인·비교</div><button aria-label="급여 창 닫기" type="button" onClick={()=>setShowClosingAmount(false)} className="w-8 h-8 rounded-full bg-gray-100 text-gray-500">×</button></div>
                <div className="grid grid-cols-2 gap-1 mt-4 rounded-xl bg-gray-100 p-1">
                  <button type="button" onClick={()=>setPayDialogTab('forecast')} className={`py-2.5 rounded-lg text-xs font-bold ${payDialogTab==='forecast'?'bg-white text-brand-700 shadow-sm':'text-gray-500'}`}>예상 마감</button>
                  <button type="button" onClick={()=>setPayDialogTab('history')} className={`py-2.5 rounded-lg text-xs font-bold ${payDialogTab==='history'?'bg-white text-brand-700 shadow-sm':'text-gray-500'}`}>이전 급여</button>
                </div>
                {payDialogTab==='forecast'?<>
                  <div className="text-[11px] text-gray-400 mt-5">현재 실적 기준 예상 마감</div>
                  <div data-testid="closing-pay" className="text-3xl font-bold text-brand-700 mt-2">{ledgerReady?won(displayPay.closing):'—'}</div>
                  <div className="text-xs text-gray-500 mt-3 leading-relaxed">현재까지 등록된 실적을 기준으로 마감할 경우 적용되는 금액입니다.</div>
                </>:<>
                  <div className="mt-5 rounded-xl bg-brand-50 px-4 py-4"><div className="text-sm font-bold text-brand-900">원하는 월의 급여를 확인하세요</div><div className="text-xs text-brand-600 mt-1">내역 화면에서 월을 선택하면 수수료와 차감 내역까지 볼 수 있어요.</div></div>
                  <button type="button" onClick={()=>{setShowClosingAmount(false);setTab('history')}} className="w-full mt-4 py-3 rounded-xl bg-brand-600 text-white text-sm font-bold">이전 급여 내역 보기 ›</button>
                </>}
              </div>
            </div>}

            {approvalOpen&&<div className="fixed inset-0 z-[96] bg-black/40 flex items-end sm:items-center justify-center" onClick={()=>setApprovalOpen(false)}>
              <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl max-h-[82vh] overflow-hidden" onClick={e=>e.stopPropagation()}>
                <div className="p-5 border-b"><div className="flex items-start justify-between gap-3"><div><div className="text-[10px] font-bold text-amber-600">승인 전 금액은 아직 미반영</div><div className="text-lg font-bold text-gray-900 mt-0.5">승인 대기 {approvalRows.length}건</div><div className="text-[10px] text-gray-400 mt-1">관리자가 확인하면 예상 수수료에 반영돼요.</div></div><button onClick={()=>setApprovalOpen(false)} className="w-8 h-8 rounded-full bg-gray-100 text-gray-500">×</button></div></div>
                <div className="overflow-y-auto max-h-[55vh] divide-y">{approvalRows.map(x=><div key={x.id} className="p-4"><div className="flex justify-between gap-3"><div className="min-w-0"><div className="text-xs font-bold text-gray-900 truncate">{x.title}</div><div className="text-[10px] text-gray-400 mt-1">{x.date} · {x.customer}</div><div className="text-[10px] text-amber-600 mt-1">{x.statusLabel}</div></div><b className="text-sm text-gray-900 shrink-0">{won(x.amount)}</b></div></div>)}</div>
                <div className="p-4 bg-amber-50"><div className="text-center text-[11px] text-amber-800 font-semibold">승인되면 수수료에 반영됩니다.</div><button onClick={()=>setApprovalOpen(false)} className="w-full mt-3 py-3 rounded-xl bg-gray-900 text-white text-sm font-bold">확인했어요</button></div>
              </div>
            </div>}

            <EmployeeHeadOfficeComparison compact onOpen={()=>setTab('history')} userId={viewedUserId} month={month} mergedDraft={mergedDraft} pay={pay} config={config} />

            <MyMonthlyPerformanceCard scopeRows={currentEmp?[currentEmp]:[]} draft={mergedDraft} pay={pay} personalGoals={personalGoals} dailyDays={dailyDays} month={month} config={config} onSaveGoals={savePersonalGoals} goalSaving={goalSaving} />
            <RecognitionRankingHub
              rows={competitionRows}
              month={month}
              userId={currentEmp?.id||authUser?.id}
              userName={currentEmp?.name||authProfile?.name||''}
              userBranch={currentEmp?.branch||''}
            />
          </> : <>
            {storeScopeOptions.length>1&&<div className="rounded-2xl border border-gray-100 bg-white p-3">
              <div className="mb-2 text-[10px] font-bold text-gray-500">조회 범위</div>
              <select value={storeScopeKey} onChange={event=>setStoreScopeKey(event.target.value)} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-700">
                {storeScopeOptions.map(option=><option key={option.key} value={option.key}>{option.label}</option>)}
              </select>
            </div>}
            {isSalesManager&&String(selectedStoreScope?.key||'').startsWith('area:')?<>
              <div className="px-1"><div className="text-sm font-bold text-gray-900">상권별 목표 비교</div><div className="text-[11px] text-gray-400 mt-1">상대 상권은 합산 현황만 비교하며 직원·고객 상세는 표시하지 않습니다.</div></div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <StoreHomeOverview config={config} rows={storeOverviewRows} branches={SALES_AREA_STORES.ansan} scopeLabel={SALES_AREA_LABELS.ansan} month={month} userId={currentEmp?.id||authUser?.id} userName={currentEmp?.name||authProfile?.name||''} showRanking={false}/>
                <StoreHomeOverview config={config} rows={storeOverviewRows} branches={SALES_AREA_STORES.siheung} scopeLabel={SALES_AREA_LABELS.siheung} month={month} userId={currentEmp?.id||authUser?.id} userName={currentEmp?.name||authProfile?.name||''} showRanking={false}/>
              </div>
            </>:<StoreHomeOverview config={config} rows={storeOverviewRows} branches={selectedStoreScope?.branches||[]} scopeLabel={selectedStoreScope?.label||''} month={month} userId={currentEmp?.id||authUser?.id} userName={currentEmp?.name||authProfile?.name||''}
              showRanking={canViewStoreRanking} canEditGoals={['점장','부점장'].includes(currentEmp?.position)||['admin','super_admin'].includes(authProfile?.role)} onOpenGoals={onOpenStoreGoals} />}
          </>}
        </div>
      )}

      {tab === 'daily' && (
        <>
          {monthLocked && (
            <div className="mb-3 bg-red-50 border border-red-100 text-red-600 text-xs rounded-lg p-3 flex items-center gap-2">
              <Info size={13} className="shrink-0" /> {monthLabel(month)}은 마감되어 더 이상 수정할 수 없어요. 수정이 필요하면 관리자에게 문의해주세요.
            </div>
          )}


          <React.Suspense fallback={<DeferredAdminPanelFallback label="실적입력"/>}><DailyInputTab
            month={month}
            dailyDays={dailyDays}
            saveDailyDay={saveDailyDay}
            config={config}
            draft={draft}
            setDraft={setDraft}
            pay={pay}
            locked={monthLocked||policyInputBlocked}
            policyInputBlocked={policyInputBlocked}
            currentEmp={currentEmp}
            loginEmp={loginEmp}
            stores={stores}
            onTeamCreditSaved={onTeamCreditSaved}
            onHomeOrdersChanged={onHomeOrdersChanged}
            onSalesChanged={onSalesChanged}
            authUser={authUser}
          /></React.Suspense>

          <div className="mt-4">
            <SalesExpensePanel won={won} fmtInputNumber={fmtInputNumber}
              userId={viewedUserId}
              month={month}
              onTotal={setExpenseTotal}
            />
          </div>
        </>
      )}

      {tab === 'customerCare' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs text-gray-400">판매 후 약속까지 한 번에</div>
              <div className="text-lg font-bold text-gray-900">고객관리</div>
            </div>
            <select value={month} onChange={(e)=>setMonth(e.target.value)}
              className="text-sm font-medium bg-white border border-gray-200 rounded-lg px-3 py-2">
              {months.map(m=><option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
          </div>
          <React.Suspense fallback={<DeferredAdminPanelFallback label="고객관리"/>}><CustomerCareManager
            userId={viewedUserId}
            month={month}
            navIntent={careNavIntent}
            homeProps={{
              userId:viewedUserId,
              month,
              locked:monthLocked||policyInputBlocked,
              dailyDays,
              saveDailyDay,
              onTeamCreditSaved,
              onHomeOrdersChanged
            }}
          /></React.Suspense>
        </div>
      )}

      {tab === 'evaluation' && (
        <React.Suspense fallback={<DeferredAdminPanelFallback label="평가·급여"/>}><EvaluationTab month={month} employee={(competitionRows||[]).find(e=>e.id===viewedUserId)||currentEmp} config={config} isManagerView={false} authUserId={authUser?.id} /></React.Suspense>
      )}

      {tab === 'history' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div><div className="text-xs text-brand-600 font-semibold">수수료 내역</div><div className="text-lg font-bold">{monthLabel(month)}</div></div>
            <select value={month} onChange={(e) => setMonth(e.target.value)} className="text-sm font-medium bg-white border border-gray-200 rounded-lg px-3 py-2">
              {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
          </div>

          <EmployeeHeadOfficeComparison userId={viewedUserId} month={month} mergedDraft={mergedDraft} pay={pay} config={config} />

          <MyInputSummary userId={currentEmp?.id||authUser?.id} month={month} config={config} />

          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
            <RowKV label="영업 활동 지원 정책" value={won(pay.tenurePay)} />
            <RowKV label="월 성과 등급 지원비" value={won(pay.gradeBonus)} />
            <RowKV label="직책 수당" value={won(pay.positionAllowance)} />

            <button type="button" onClick={()=>setHistoryOpen(v=>({...v,mobile:!v.mobile}))} className="w-full px-4 py-3 flex justify-between items-center text-sm">
              <span className="font-semibold">모바일 관련 수수료</span>
              <span className="flex items-center gap-2 font-bold text-gray-800">{won(Number(pay.mobilePlanPay||0)+Number(pay.mnpBundlePay||0)+Number(pay.rawBundle2ndTotal||0)+Number(pay.rawVasPay||0)-Number(pay.bundleFreeOffset||0)-Number(pay.bundleFreeVasOffset||0)-Number(pay.specialMatrixOffset||0)-Number(pay.specialVasOffset||0)+Number(pay.specialReplacementPay||0)+Number(pay.approvedMobileSpotPay||0)+Number(pay.strategicAdjustment||0)+Number(pay.septemberWeekendSimMnpPolicy?.amount||0))}<ChevronDown size={15} className={historyOpen.mobile?'rotate-180':''}/></span>
            </button>
            {historyOpen.mobile&&<div className="bg-gray-50/70 px-4 py-2 divide-y divide-gray-100">
              {Number(pay.mobilePlanPay||0)!==0&&<RowKV label="└ 요금제 유치 수수료" value={won(pay.mobilePlanPay)} />}
              {Number(pay.strategicAdjustment||0)!==0&&<RowKV label={pay.strategicAdjustment>0?'└ 전략P 200% 이상 보너스':'└ 전략P 160% 미만 디메리트'} value={won(pay.strategicAdjustment)} />}
              {Number(pay.mnpBundlePay||0)!==0&&<RowKV label="└ 중고 MNP 결합 수수료" value={won(pay.mnpBundlePay)} />}
              {Number(pay.septemberWeekendSimMnpPolicy?.amount||0)!==0&&<RowKV label="└ 9월 주말 SIM MNP 추가 지급" value={won(pay.septemberWeekendSimMnpPolicy.amount)} />}
              {Number(pay.rawBundle2ndTotal||0)!==0&&<RowKV label="└ 2ND 번들 유치 수수료" value={won(pay.rawBundle2ndTotal)} />}
              {Number(pay.rawVasPay||0)!==0&&<RowKV label="└ VAS 유치 수수료" value={won(pay.rawVasPay)} />}
              {Number(pay.bundleFreeOffset||0)!==0&&<RowKV label="└ 2ND 무료판매 제외" value={`-${won(pay.bundleFreeOffset)}`} />}
              {Number(pay.specialMatrixOffset||0)!==0&&<RowKV label="└ 특판 요금제 제외" value={`-${won(pay.specialMatrixOffset)}`} />}
              {Number(pay.specialVasOffset||0)!==0&&<RowKV label="└ 특판 VAS 제외" value={`-${won(pay.specialVasOffset)}`} />}
              {Number(pay.specialReplacementPay||0)!==0&&<RowKV label="└ 특판 대체 인센티브" value={won(pay.specialReplacementPay)} />}
              {Number(pay.approvedMobileSpotPay||0)!==0&&<RowKV label="└ 승인 모바일 스팟" value={won(pay.approvedMobileSpotPay)} />}
            </div>}

            <button type="button" onClick={()=>setHistoryOpen(v=>({...v,home:!v.home}))} className="w-full px-4 py-3 flex justify-between items-center text-sm">
              <span className="font-semibold">홈 관련 수수료</span>
              <span className="flex items-center gap-2 font-bold text-gray-800">{won(Number(pay.homeGradePay||0)+Number(pay.homeFlatPay||0)+Number(pay.homeAddonPay||0)+Number(pay.renewPay||0))}<ChevronDown size={15} className={historyOpen.home?'rotate-180':''}/></span>
            </button>
            {historyOpen.home&&<div className="bg-gray-50/70 px-4 py-2 divide-y divide-gray-100">
              {Number(pay.homeGradePay||0)!==0&&<RowKV label="└ 인터넷+TV 그레이드" value={won(pay.homeGradePay)} />}
              {Number(pay.homePolicy?.soloPay||0)!==0&&<RowKV label="└ 인터넷 단독" value={won(pay.homePolicy.soloPay)} />}
              {Number(pay.homePolicy?.simulPay||0)!==0&&<>
                {Object.entries((pay.homePolicy?.details||[]).filter(x=>String(x.item||'').includes('동시판매')).reduce((a,x)=>{a[x.item]=(a[x.item]||0)+Number(x.amount||0);return a;},{})).map(([l,v])=><RowKV key={l} label={`└ ${l}`} value={won(v)} />)}
              </>}
              {Number(pay.tvFreePay||0)!==0&&<RowKV label="└ TV프리(부)" value={won(pay.tvFreePay)} />}
              {Number(pay.smartHomePay||0)!==0&&<RowKV label="└ 스마트홈" value={won(pay.smartHomePay)} />}
              {Number(pay.homePolicy?.subSetTopPay||0)!==0&&<RowKV label="└ 부셋탑" value={won(pay.homePolicy.subSetTopPay)} />}
              {Number(pay.homePolicy?.weekendPolicy?.homeBonus||0)!==0&&<RowKV label="└ 9월 주말 홈 추가 지급" value={won(pay.homePolicy.weekendPolicy.homeBonus)} />}
              {Number(pay.homePolicy?.weekendPolicy?.tvFreeBonus||0)!==0&&<RowKV label="└ 9월 주말 TV프리 추가 지급" value={won(pay.homePolicy.weekendPolicy.tvFreeBonus)} />}
              {Number(pay.renewPay||0)!==0&&<RowKV label="└ 인터넷 재약정" value={won(pay.renewPay)} />}
            </div>}

            <RowKV label="소노" value={won(pay.sonoPay)} />
            <RowKV label="맞춤제안" value={won(Number(pay.tailoredBonus||0)+Number(pay.tailoredAmountBonus||0))} />
            <RowKV label="우리매장 등록 수수료" value={won(pay.custRegBonus)} />

            <button type="button" onClick={()=>setHistoryOpen(v=>({...v,spot:!v.spot}))} className="w-full px-4 py-3 flex justify-between items-center text-sm">
              <span>스팟</span><span className="flex items-center gap-2 font-semibold">{won(Number(pay.approvedMobileSpotPay||0)+historySpotTotal)}<ChevronDown size={15} className={historyOpen.spot?'rotate-180':''}/></span>
            </button>
            {historyOpen.spot&&historySpotRows.length>0&&<div className="bg-gray-50 px-4 py-2 space-y-1">{historySpotRows.map((x,i)=><div key={i} className="flex justify-between text-[11px]"><span className="text-gray-500">{String(x.claim_date||'').slice(5)} · {x.customer_name||'이름 없음'} · {x.reviewed_title||x.direct_title||x.spot_policies?.title||'스팟'}</span><b>+{won(Number(x.final_amount??x.direct_amount??x.spot_policies?.amount??0))}</b></div>)}</div>}

            <button type="button" onClick={()=>setHistoryOpen(v=>({...v,expense:!v.expense}))} className="w-full px-4 py-3 flex justify-between items-center text-sm">
              <span>영업 비용 총액</span><span className="flex items-center gap-2 font-semibold text-red-500">-{won(expenseTotal)}<ChevronDown size={15} className={historyOpen.expense?'rotate-180':''}/></span>
            </button>
            {historyOpen.expense&&historyExpenseRows.length>0&&<div className="bg-red-50/40 px-4 py-2 space-y-1">{historyExpenseRows.map((x,i)=><div key={i} className="flex justify-between text-[11px]"><span className="text-gray-500">{String(x.expense_date||'').slice(5)} · {x.customer_name||'이름 없음'} · {x.category}{x.memo?` · ${x.memo}`:''}</span><b className="text-red-500">-{won(x.amount)}</b></div>)}</div>}

            <div className="px-4 py-4 bg-brand-50 flex justify-between items-center">
              <span className="font-bold text-brand-800">예상 총 수수료</span>
              <span data-testid="history-pay" className="text-xl font-black text-brand-700">{ledgerReady?won(displayPay.total):'—'}</span>
            </div>
          </div>
        </div>
      )}

      <div className="app-bottom-nav fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-20">
        <div className="max-w-5xl mx-auto grid grid-cols-5 px-2 py-1">
          {[
            { key: 'home', label: '홈', icon: Home },
            { key: 'daily', label: '실적입력', icon: Calendar },
            { key: 'customerCare', label: '고객관리', icon: ClipboardList },
            { key: 'evaluation', label: '평가', icon: ClipboardCheck },
            { key: 'history', label: '내역', icon: History },
          ].map((n) => (
            <button key={n.key} aria-current={tab===n.key?'page':undefined} onClick={() => setTab(n.key)} className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] ${tab === n.key ? 'text-brand-700' : 'text-gray-400'}`}>
              <n.icon size={18} />{n.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}


function DeferredAdminPanelFallback({label='관리 화면'}){
  return <div className="flex min-h-28 items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white text-xs font-semibold text-gray-400"><Loader2 size={15} className="animate-spin"/>{label} 불러오는 중...</div>;
}


/* ===================== 등급 진행바 · 홈 최소조건 알림 ===================== */


function guaranteedDeltaForGradeBonus(pay, nextBonus) {
  const withoutCurrentGrade = (pay.otherComponents || 0) - (pay.gradeBonus || 0);
  const nextGuaranteed = Math.max(pay.positionBase || 0, withoutCurrentGrade + (nextBonus || 0));
  return Math.max(0, nextGuaranteed - (pay.guaranteedComponent || 0));
}

function nextTierAbove(count, tiers) {
  return [...(tiers || [])]
    .sort((a, b) => a.min - b.min)
    .find((t) => Number(t.min) > Number(count || 0)) || null;
}

function buildNextGoal(pay, draft, config) {
  if (!pay || !draft || !config) return null;

  const candidates = [];

  const pushCandidate = ({
    key,title,description,delta,remain,current,target,unit,effortWeight=1
  }) => {
    if (!(remain > 0) || !(delta > 0) || !(target > 0)) return;
    const progress = Math.max(0, Math.min(1, Number(current||0) / Number(target||1)));
    const weightedEffort = Math.max(0.25, Number(remain||0) * effortWeight);

    // "유리한 다음 행동" 점수:
    // 남은 행동 1단위당 예상 인센티브 상승액을 기본으로 하고,
    // 이미 목표에 가까울수록 약간 더 우선해요.
    const valuePerStep = delta / weightedEffort;
    const score = valuePerStep * (0.7 + progress * 0.3);

    candidates.push({
      key,title,description,delta,remain,current,target,unit,progress,score,
      recommendation: `남은 ${remain}${unit} 대비 +${won(delta)} 효과`,
    });
  };

  // 1) 성과등급
  if (pay.nextGrade) {
    const remain = Math.max(0, pay.nextGrade.min - pay.totalPoints);
    const delta = guaranteedDeltaForGradeBonus(pay, pay.nextGrade.bonus);
    pushCandidate({
      key:'grade',
      title:`${pay.nextGrade.grade}등급`,
      description:`${pay.nextGrade.grade}등급까지 ${remain.toFixed(1)}P 남았어요`,
      delta,
      remain:Number(remain.toFixed(1)),
      current:pay.totalPoints,
      target:pay.nextGrade.min,
      unit:'P',
      effortWeight:1,
    });
  }

  // 2) 홈 최소조건
  if (!pay.gradeEligible) {
    const short = Math.max(0, HOME_GATE_MIN - pay.homeGatePoints);
    const grades = [...(config.grades || DEFAULT_GRADES)].sort((a, b) => b.min - a.min);
    const potentialGrade = grades.find((g) => pay.totalPoints >= g.min) || null;
    const potentialBonus = potentialGrade?.bonus || 0;
    const delta = potentialBonus > 0
      ? guaranteedDeltaForGradeBonus(pay, potentialBonus)
      : 0;

    pushCandidate({
      key:'homeGate',
      title:'홈 최소조건',
      description:`홈 최소조건까지 ${short.toFixed(1)}점 남았어요`,
      delta,
      remain:Number(short.toFixed(1)),
      current:pay.homeGatePoints,
      target:HOME_GATE_MIN,
      unit:'점',
      effortWeight:1,
    });
  }

  // 3) 고객등록
  const custCount = Number(draft.custRegCount || 0);
  const custNext = nextTierAbove(custCount, config.custRegTiers);
  if (custNext) {
    const currentBonus = tierBonus(custCount, config.custRegTiers || []);
    const delta = Math.max(0, Number(custNext.bonus || 0) - currentBonus);
    const remain = Math.max(0, Number(custNext.min) - custCount);
    pushCandidate({
      key:'custReg',
      title:'고객등록',
      description:`고객등록 다음 구간까지 ${remain}건 남았어요`,
      delta,
      remain,
      current:custCount,
      target:Number(custNext.min),
      unit:'건',
      effortWeight:1,
    });
  }

  // 4) 맞춤제안
  const tailoredCount = Number(draft.tailoredCount || 0);
  const tailoredNext = nextTierAbove(tailoredCount, config.tailoredTiers);
  if (tailoredNext) {
    const currentBonus = tierBonus(tailoredCount, config.tailoredTiers || []);
    const delta = Math.max(0, Number(tailoredNext.bonus || 0) - currentBonus);
    const remain = Math.max(0, Number(tailoredNext.min) - tailoredCount);
    pushCandidate({
      key:'tailored',
      title:'맞춤제안',
      description:`맞춤제안 다음 구간까지 ${remain}건 남았어요`,
      delta,
      remain,
      current:tailoredCount,
      target:Number(tailoredNext.min),
      unit:'건',
      effortWeight:1,
    });
  }

  if (!candidates.length) return null;

  // 예상 인센티브 효율 + 현재 달성 접근도를 함께 고려
  candidates.sort((a,b)=>b.score-a.score || b.delta-a.delta || a.remain-b.remain);
  return candidates[0];
}











function NextGoalCard({ pay, draft, config, onGoInput }) {
  const goal = useMemo(
    () => buildNextGoal(pay, draft, config),
    [pay, draft, config]
  );

  if (!goal) return null;

  return (
    <button
      onClick={onGoInput}
      className="w-full text-left bg-white rounded-xl border border-brand-200 p-4 hover:border-brand-300 transition"
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
          <Target size={18} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-brand-600 mb-1">추천 다음 행동</div>
          <div className="text-sm font-bold text-gray-900">{goal.title}</div>
          <div className="text-sm text-gray-600 mt-0.5">{goal.description}</div>
          <div className="text-[11px] text-brand-500 mt-1">{goal.recommendation}</div>

          <div className="mt-3 flex items-baseline gap-1.5 flex-wrap">
            <span className="text-xs text-gray-400">달성 시 예상 인센티브</span>
            <span className="text-lg font-bold text-brand-700">+{won(goal.delta)}</span>
          </div>
        </div>

        <ChevronRight size={17} className="text-brand-300 shrink-0 mt-1" />
      </div>
    </button>
  );
}

function GrowthBadge({ current, prev }) {
  if (!prev || prev <= 0) return null;
  const diff = current - prev;
  const pct = Math.round((diff / prev) * 100);
  if (diff === 0) return <span className="text-xs text-brand-100">전월과 동일</span>;
  const up = diff > 0;
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${up ? 'bg-emerald-400/20 text-emerald-100' : 'bg-red-400/20 text-red-100'}`}>
      전월 대비 {up ? '+' : ''}{pct}%
    </span>
  );
}

function GradeProgress({ pay, config, dailyDays, month }) {
  const grades = config.grades || DEFAULT_GRADES;
  const maxMin = Math.max(...grades.map((g) => g.min), 1);
  const pct = Math.min(100, (pay.totalPoints / maxMin) * 100);
  const next = pay.nextGrade;
  const remain = next ? Math.max(0, next.min - pay.totalPoints) : 0;
  const currentBonus = pay.gradeEligible ? pay.gradeBonus : 0;
  const jump = next ? next.bonus - currentBonus : 0;
  const ticks = grades.filter((g) => g.min > 0).sort((a, b) => a.min - b.min);

  // 지금까지의 페이스로 다음 등급까지 며칠 걸릴지 추정
  const paceLabel = (() => {
    if (!next || remain <= 0 || !dailyDays || !month) return null;
    const daysWithData = Object.values(dailyDays).filter((m) => dayHasData(m)).length;
    const now = new Date();
    const isCurrentMonth = monthKeyOf(now) === month;
    const daysElapsed = isCurrentMonth ? now.getDate() : daysInMonth(month);
    const activeDays = Math.max(daysWithData, 1);
    const perDay = pay.totalPoints / Math.max(daysElapsed, activeDays, 1);
    if (perDay <= 0) return null;
    const daysNeeded = Math.ceil(remain / perDay);
    return `지금 페이스(하루 평균 ${perDay.toFixed(1)}P)면 ${daysNeeded}일 후 도달 예상`;
  })();

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-end justify-between mb-3">
        <div>
          <div className="text-xs text-gray-400">이번 달 성과등급P</div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-gray-900 tabular-nums">{pay.totalPoints.toFixed(1)}</span>
            <span className="text-sm text-gray-400">P</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-400">현재 등급</div>
          <div className={`text-lg font-bold ${pay.gradeEligible && currentBonus > 0 ? 'text-brand-700' : 'text-gray-400'}`}>
            {pay.gradeEligible ? pay.grade : 'D'}
            <span className="text-xs font-medium ml-1 text-gray-500">{won(currentBonus)}</span>
          </div>
        </div>
      </div>

      <div className="relative h-2.5 rounded-full bg-gray-100 overflow-visible">
        <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-brand-500 to-brand-500 transition-all duration-500"
          style={{ width: `${pct}%` }} />
        {ticks.map((g) => (
          <div key={g.grade} className="absolute -top-0.5 w-px h-3.5 bg-white/80" style={{ left: `${Math.min(100, (g.min / maxMin) * 100)}%` }} />
        ))}
      </div>
      <div className="relative h-4 mt-1">
        {ticks.map((g) => (
          <span key={g.grade} className="absolute text-[10px] text-gray-400 -translate-x-1/2 tabular-nums"
            style={{ left: `${Math.min(100, (g.min / maxMin) * 100)}%` }}>
            {g.grade}
          </span>
        ))}
      </div>

      {next ? (
        <>
          <div className="mt-2 flex items-center gap-2 text-sm">
            <Target size={14} className="text-brand-500 shrink-0" />
            <span className="text-gray-600">
              <b className="text-brand-700">{next.grade}등급</b>까지 <b className="text-gray-900 tabular-nums">{remain.toFixed(1)}P</b>
              {jump > 0 && <span className="text-gray-400"> · 도달하면 +{won(jump)}</span>}
            </span>
          </div>
          {paceLabel && <div className="mt-1 text-xs text-gray-400 pl-6">{paceLabel}</div>}
        </>
      ) : (
        <div className="mt-2 flex items-center gap-2 text-sm text-emerald-600">
          <Award size={14} className="shrink-0" /> 최고 등급이에요. 이번 달 잘하고 있어요!
        </div>
      )}
    </div>
  );
}

function HomeGateCard({ pay, config, onGoInput }) {
  const gate = HOME_GATE_MIN;
  const short = Math.max(0, gate - pay.homeGatePoints);
  const potential = (() => {
    const grades = [...(config.grades || DEFAULT_GRADES)].sort((a, b) => b.min - a.min);
    const hit = grades.find((g) => pay.totalPoints >= g.min);
    return hit ? hit.bonus : 0;
  })();

  if (!pay.gradeEligible) {
    return (
      <button onClick={onGoInput} className="w-full text-left bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex items-start gap-2.5">
          <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-amber-900">
              홈 최소조건 {pay.homeGatePoints.toFixed(1)} / {gate}점 — {short.toFixed(1)}점 부족
            </div>
            <div className="text-xs text-amber-700 mt-1 leading-relaxed">
              지금은 성과등급 보너스가 <b>0원</b>이에요.
              {potential > 0 && <> 홈 {short.toFixed(1)}점만 더 채우면 현재 포인트로 <b>{won(potential)}</b>을 받을 수 있어요.</>}
            </div>
            <div className="text-[11px] text-amber-600/80 mt-1.5">인터넷 1점 · TV프리 0.3점 · 스마트홈 0.2점 기준 · 눌러서 홈 실적 입력하기</div>
          </div>
        </div>
        <div className="mt-3 h-1.5 rounded-full bg-amber-200/60 overflow-hidden">
          <div className="h-full rounded-full bg-amber-500 transition-all duration-500" style={{ width: `${Math.min(100, (pay.homeGatePoints / gate) * 100)}%` }} />
        </div>
      </button>
    );
  }

  if (pay.homeAddonPoints > 0 && !pay.addonApplies) {
    return (
      <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 flex items-start gap-2.5">
        <Info size={16} className="text-sky-500 shrink-0 mt-0.5" />
        <div className="text-xs text-sky-800 leading-relaxed">
          홈 최소조건은 충족했어요. 다만 모바일 포인트가 <b className="tabular-nums">{pay.mobilePoints.toFixed(1)}P</b>라
          <b> {ADDON_GATE}P를 넘겨야</b> 홈 가점 <b className="tabular-nums">{pay.homeAddonPoints.toFixed(1)}P</b>가 총점에 더해져요.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-emerald-800">
      <Check size={15} className="shrink-0" />
      홈 최소조건 충족 ({pay.homeGatePoints.toFixed(1)} / {gate}점) — 성과등급 보너스 대상이에요
    </div>
  );
}

function RowKV({ label, value, bold }) {
  return (
    <div className={`flex items-center justify-between px-4 py-2.5 text-sm ${bold ? 'bg-brand-50' : ''}`}>
      <span className={bold ? 'text-brand-700 font-semibold' : 'text-gray-600'}>{label}</span>
      <span className={bold ? 'text-brand-800 font-bold' : 'text-gray-800 font-medium'}>{value}</span>
    </div>
  );
}


function RankingCenter({ rows, dailyRecords, month, config }) {
  const [metricKey, setMetricKey] = useState('hs');
  const [mode, setMode] = useState('employees'); // employees | stores
  const [storeMode, setStoreMode] = useState('total'); // total | avg
  const [periodMode, setPeriodMode] = useState('month'); // month | recent7
  const metric = COMPETITION_METRICS.find((m) => m.key === metricKey) || COMPETITION_METRICS[0];
  const finalPerformances=useFinalStorePerformance(month);

  const employeeRanked = useMemo(() => [...(rows || [])]
    .filter((r) => !NON_SALES_STORES.includes(r.branch))
    .sort((a, b) => metric.value(b) - metric.value(a) || a.name.localeCompare(b.name)),
  [rows, metricKey]);

  const recentEmployeeRanked = useMemo(
    () => buildRisingRanking(rows, dailyRecords, month, config, metricKey),
    [rows, dailyRecords, month, config, metricKey]
  );

  const storeRanked = useMemo(() => {
    const baseRows = periodMode === 'recent7' ? recentEmployeeRanked : (rows || []);
    const map = new Map();

    baseRows.filter((r) => !NON_SALES_STORES.includes(r.branch)).forEach((r) => {
      if (!map.has(r.branch)) map.set(r.branch, { name: r.branch, total: 0, count: 0 });
      const item = map.get(r.branch);
      const value = periodMode === 'recent7'
        ? Number(r.recentValue || 0)
        : Number(metric.value(r) || 0);
      item.total += value;
      item.count += 1;
    });

    return [...map.values()]
      .map((s) => ({
        ...s,
        total: periodMode==='month'&&finalPerformances[s.name]
          ? finalStoreMetric(finalPerformances[s.name],metricKey,s.total)
          : s.total,
      }))
      .map(s=>({...s,value:storeMode==='avg'?(s.count?s.total/s.count:0):s.total}))
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
  }, [rows, recentEmployeeRanked, metricKey, storeMode, periodMode, finalPerformances]);

  return (
    <div className="space-y-3">
      <div className="bg-white border border-gray-100 rounded-xl p-3">
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setMode('employees')} className={`px-3 py-1.5 rounded-md text-xs font-semibold ${mode === 'employees' ? 'bg-white shadow text-brand-700' : 'text-gray-500'}`}>직원 순위</button>
            <button onClick={() => setMode('stores')} className={`px-3 py-1.5 rounded-md text-xs font-semibold ${mode === 'stores' ? 'bg-white shadow text-brand-700' : 'text-gray-500'}`}>매장 순위</button>
          </div>
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setPeriodMode('month')} className={`px-2.5 py-1.5 rounded-md text-[11px] font-semibold ${periodMode === 'month' ? 'bg-white shadow text-brand-700' : 'text-gray-500'}`}>월 누적</button>
            <button onClick={() => setPeriodMode('recent7')} className={`px-2.5 py-1.5 rounded-md text-[11px] font-semibold ${periodMode === 'recent7' ? 'bg-white shadow text-orange-600' : 'text-gray-500'}`}>최근 7일</button>
          </div>
          <select value={metricKey} onChange={(e) => setMetricKey(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white">
            {COMPETITION_METRICS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </div>

        {mode === 'stores' && (
          <div className="mt-2 flex justify-end">
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              <button onClick={() => setStoreMode('total')} className={`px-2.5 py-1 rounded-md text-[11px] ${storeMode === 'total' ? 'bg-white shadow text-brand-700' : 'text-gray-500'}`}>총 실적</button>
              <button onClick={() => setStoreMode('avg')} className={`px-2.5 py-1 rounded-md text-[11px] ${storeMode === 'avg' ? 'bg-white shadow text-brand-700' : 'text-gray-500'}`}>1인당</button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-50 text-sm font-semibold text-gray-700">
          {periodMode === 'recent7' ? '최근 7일 · ' : ''}{metric.label} {mode === 'employees' ? '직원 순위' : '매장 순위'}
          {mode==='stores'&&periodMode==='month'&&Object.keys(finalPerformances).length>0&&<div className="text-[9px] font-normal text-emerald-600 mt-1">마감된 매장은 확정 실적 기준</div>}
        </div>
        <div className="divide-y divide-gray-50">
          {(mode === 'employees'
            ? (periodMode === 'recent7' ? recentEmployeeRanked : employeeRanked)
            : storeRanked
          ).map((item, i) => {
            const name = mode === 'employees' ? `${item.name} · ${displayStoreName(item.branch)}` : displayStoreName(item.name);
            const value = mode === 'employees'
              ? (periodMode === 'recent7' ? item.recentValue : metric.value(item))
              : item.value;
            return (
              <div key={mode === 'employees' ? item.id : item.name} className="flex items-center justify-between px-4 py-3 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-gray-100 text-gray-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-gray-50 text-gray-400'
                  }`}>{i + 1}</div>
                  <div className="text-sm text-gray-800 truncate">{name}</div>
                </div>
                <div className="text-sm font-bold text-brand-700 shrink-0">
                  {formatCompetitionValue(value, metric.unit)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ===================== 관리자 화면 ===================== */


function AdminHomeCare({ employees, month }) {
  const [orders,setOrders]=useState([]);
  const [loading,setLoading]=useState(true);
  const [statusFilter,setStatusFilter]=useState('pending');
  const [lastLoadedAt,setLastLoadedAt]=useState(null);
  const load=useCallback(async()=>{
    setLoading(true);
    const [yy,mm]=String(month||monthKeyOf(new Date())).split('-').map(Number);
    const nextMonth=`${new Date(yy,mm,1).getFullYear()}-${String(new Date(yy,mm,1).getMonth()+1).padStart(2,'0')}-01`;
    const {data,error}=await supabase.from('home_orders').select('*')
      .gte('source_work_date',`${month||monthKeyOf(new Date())}-01`).lt('source_work_date',nextMonth)
      .order('planned_install_date',{ascending:true,nullsFirst:false});
    if(!error){setOrders(data||[]);setLastLoadedAt(new Date());}
    setLoading(false);
  },[month]);
  useEffect(()=>{
    load();
    const channel=supabase.channel(`admin-home-care-${month||'current'}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'home_orders'},()=>load()).subscribe();
    const onFocus=()=>load();
    window.addEventListener('focus',onFocus);
    return()=>{window.removeEventListener('focus',onFocus);supabase.removeChannel(channel)};
  },[load,month]);

  const empMap=Object.fromEntries((employees||[]).map(e=>[e.id,e]));
  const grouped=useMemo(()=>{
    const map=new Map();
    (orders||[]).forEach(o=>{
      const key=[o.user_id,o.source_work_date,o.customer_id||String(o.customer_name||'').replace(/\s+/g,''),o.status].join('|');
      if(!map.has(key))map.set(key,{key,rows:[],...o});
      map.get(key).rows.push(o);
    });
    return [...map.values()].map(g=>{
      const unique=[...new Set(g.rows.map(o=>o.product_type))];
      const productCounts=g.rows.reduce((acc,row)=>{
        const key=String(row.product_type||'unknown');
        acc[key]=Number(acc[key]||0)+1;
        return acc;
      }, {});
      const repeatedProducts=Object.entries(productCounts).filter(([,count])=>count>1).map(([productType,count])=>({productType,count}));
      const mainHomeCount=Number(productCounts.homeTv||0)+Number(productCounts.homeOnly||0);
      const internetCount=Number(productCounts.internet100||0)+Number(productCounts.internet500||0)+Number(productCounts.internet1g||0);
      const repeatedBundleCount=Math.min(mainHomeCount,internetCount);
      return {...g,productTypes:unique,duplicateCount:repeatedProducts.reduce((sum,item)=>sum+item.count-1,0),repeatedProducts,repeatedBundleCount};
    });
  },[orders]);
  const visible=grouped.filter(g=>g.status===statusFilter);
  const today=new Date().toISOString().slice(0,10);
  const pending=grouped.filter(o=>o.status==='pending');
  const overdue=pending.filter(o=>o.planned_install_date && String(o.planned_install_date).slice(0,10)<today);
  const todayList=pending.filter(o=>String(o.planned_install_date||'').slice(0,10)===today);
  const unscheduled=pending.filter(o=>!o.planned_install_date);
  const duplicateGroups=grouped.filter(o=>o.duplicateCount>0);

  if(loading)return <div className="bg-white rounded-xl border p-4 text-sm text-gray-400">홈 케어 현황 불러오는 중...</div>;

  return <div className="space-y-3">
    <div className="grid grid-cols-3 gap-2">
      {[['진행중',pending.length],['설치완료',grouped.filter(x=>x.status==='completed').length],['취소',grouped.filter(x=>x.status==='cancelled').length],['오늘 설치',todayList.length],['예정일 경과',overdue.length],['중복 의심',duplicateGroups.length]].map(([l,v])=>
        <div key={l} className="bg-white rounded-xl border border-gray-100 p-3 text-center">
          <div className="text-lg font-bold">{v}</div><div className="text-[10px] text-gray-400">{l}</div>
        </div>)}
    </div>
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 border-b"><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-bold">🏠 우리 매장 홈 케어</div>
        <div className="text-xs text-gray-400">상품 여러 개도 고객 1건으로 묶어 보여줘요.</div></div><button onClick={load} className="text-xs font-bold text-brand-600">↻ 새로고침</button></div>
        <div className="flex gap-1.5 mt-3">{[['pending','진행중'],['completed','설치완료'],['cancelled','취소']].map(([k,l])=><button key={k} onClick={()=>setStatusFilter(k)} className={`px-3 py-1.5 rounded-full text-[11px] font-bold ${statusFilter===k?'bg-brand-600 text-white':'bg-gray-100 text-gray-500'}`}>{l} {grouped.filter(x=>x.status===k).length}</button>)}</div>
        {lastLoadedAt&&<div className="text-[9px] text-gray-300 mt-2">마지막 갱신 {lastLoadedAt.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</div>}</div>
      {visible.length===0?<div className="py-10 text-center text-sm text-gray-400">해당 홈 청약이 없어요.</div>:
        <div className="divide-y">{[...visible].sort((a,b)=>String(a.planned_install_date||'9999').localeCompare(String(b.planned_install_date||'9999'))).map(o=>{
          const emp=empMap[o.user_id], p=o.planned_install_date?String(o.planned_install_date).slice(0,10):null;
          const over=o.status==='pending'&&p&&p<today, isToday=p===today;
          const productLabel=(key)=>HOME_ORDER_PRODUCTS.find(x=>x.key===key)?.label||key;
          const products=o.productTypes.map(productLabel);
          const duplicateLabel=o.repeatedBundleCount>1
            ? `동일 홈 구성 ${o.repeatedBundleCount}회 저장 확인`
            : o.repeatedProducts?.length
              ? `${o.repeatedProducts.map(item=>`${productLabel(item.productType)} ${item.count}회`).join(' · ')} 저장 확인`
              : '';
          return <div key={o.key} className="px-4 py-3">
            <div className="flex justify-between gap-3"><div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <div className="text-sm font-bold">{o.customer_name||'고객명 미입력'}</div>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                  o.network_type==='soho'?'bg-blue-50 text-blue-600':
                  o.network_type==='household'?'bg-brand-50 text-brand-600':'bg-gray-100 text-gray-400'
                }`}>{homeNetworkLabel(o.network_type)}</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">{emp?.name||'직원'} · {emp?.branch||''}</div></div>
              <span className={`text-[10px] font-bold px-2 py-1 rounded-full h-fit ${over?'bg-red-50 text-red-600':isToday?'bg-orange-50 text-orange-600':'bg-brand-50 text-brand-600'}`}>
                {o.status==='completed'?'설치완료':o.status==='cancelled'?'취소':over?'확인 필요':isToday?'오늘 설치':p?'설치 예정':'일정 미정'}</span></div>
            <div className="flex flex-wrap gap-1 mt-2">{products.map(x=><span key={x} className="px-2 py-1 rounded-md bg-gray-50 text-[10px] text-gray-600">{x}</span>)}{duplicateLabel&&<span className="px-2 py-1 rounded-md bg-red-50 text-[10px] font-bold text-red-600">{duplicateLabel}</span>}</div>
            <div className="text-[11px] text-gray-400 mt-2">접수 {o.source_work_date||String(o.applied_at).slice(0,10)} · 설치예정 {p||'미정'}</div>
          </div>})}</div>}
    </div>
  </div>;
}


function adminMetricValue(row,key){
  const d=row?.draft||{};
  if(key==='hs')return hsCount(d);
  if(key==='simMnp'||key==='second')return briefingMobileCount(d,key);
  if(key==='home')return completedHomeCount(d);
  if(key==='free')return Number(d.homeFlat?.tvFree||0);
  if(key==='smart')return Number(d.homeFlat?.smartHome||0);
  if(key==='upsell')return Number(d.tailoredCount||0);
  if(key==='upsellAmount')return Number(d.tailoredAmount||0);
  if(key==='sono')return Object.values(d.sono||{}).reduce((s,v)=>s+Number(v||0),0);
  if(key==='productivity')return Number(row?.pay?.kpiScore||0);
  return 0;
}
const ADMIN_MAIN_METRICS=[
  ['hs','HS','count'],['simMnp','SIM MNP','count'],['second','2ND','count'],['productivity','생산성','point'],
  ['home','홈 실적','count'],['free','프리','count'],['smart','스마트홈','count'],['sono','소노','count'],
  ['upsellAmount','맞춤제안 매출액','won'],['upsell','업셀건','count']
];


function storeMetricFromRows(storeRows,key){
  const list=storeRows||[];
  if(key==='productivity') return list.reduce((s,r)=>s+Number(r.pay?.kpiScore||0),0);
  return list.reduce((s,r)=>s+adminMetricValue(r,key),0);
}

function storeGoalAchievement(company,storeRows,finalPerformance=null){
  const metrics=[
    ['hs','hs'],['home','home'],['productivity','productivity'],
    ['tvFree','free'],['smartHome','smart'],['tailoredCount','upsell']
  ];
  const detail=metrics.map(([goalKey,rowKey])=>{
    const target=Number(company?.[goalKey]||0);
    const inputActual=storeMetricFromRows(storeRows,rowKey);
    const actual=finalPerformance?finalStoreMetric(finalPerformance,rowKey,inputActual):inputActual;
    const pct=target>0 ? actual/target*100 : 0;
    return {goalKey,rowKey,target,actual,pct};
  }).filter(x=>x.target>0);
  const achieved=detail.filter(x=>x.pct>=100).length;
  const score=detail.length
    ? detail.reduce((s,x)=>s+Math.min(120,x.pct),0)/detail.length
    : 0;
  return {detail,achieved,total:detail.length,score};
}

function StoreChallengeCard({ month, allRows, employees, authUserId, onOpenGoals }) {
  const finalPerformances=useFinalStorePerformance(month);
  const [goalRows,setGoalRows]=useState([]);
  const [loading,setLoading]=useState(true);
  const me=(employees||[]).find(e=>e.id===authUserId);

  useEffect(()=>{
    (async()=>{
      setLoading(true);
      const {data}=await supabase.from('store_goals').select('store_name,company_goals').eq('month',month);
      setGoalRows(data||[]);
      setLoading(false);
    })();
  },[month]);

  const goalMap=Object.fromEntries((goalRows||[]).map(g=>[
    g.store_name,
    {...companyGoalDefaults(g.store_name),...(g.company_goals||{})}
  ]));

  const branches=[...new Set((allRows||[])
    .map(r=>r.branch)
    .filter(Boolean)
    .filter(b=>!NON_SALES_STORES.includes(b))
  )];

  const ranked=branches.map(branch=>{
    const branchRows=(allRows||[]).filter(r=>r.branch===branch);
    const company=goalMap[branch]||companyGoalDefaults(branch);
    const achievement=storeGoalAchievement(company,branchRows,finalPerformances[branch]);
    return {branch,...achievement};
  }).filter(x=>x.total>0)
    .sort((a,b)=>b.score-a.score || b.achieved-a.achieved || a.branch.localeCompare(b.branch));

  const myBranch=me?.branch;
  const myIndex=ranked.findIndex(x=>x.branch===myBranch);
  const top3=ranked.slice(0,3);

  return <div className="bg-white rounded-xl border border-amber-100 overflow-hidden">
    <div className="px-4 py-3 border-b border-amber-50 flex items-center justify-between gap-3">
      <div>
        <div className="text-xs text-amber-600">🏆 매장 챌린지</div>
        <div className="text-sm font-bold text-gray-900">기준 목표 종합 달성</div>
        <div className="text-[10px] text-gray-400 mt-0.5">HS · 홈 · 생산성 · 프리 · 스마트홈 · 업셀 기준</div>
      </div>
      <button onClick={onOpenGoals} className="text-xs font-semibold text-brand-600">목표 보기 ›</button>
    </div>
    {loading?<div className="py-7 text-center text-xs text-gray-400">순위 계산 중...</div>:
    ranked.length===0?<div className="py-7 text-center text-xs text-gray-400">비교할 매장 데이터가 없어요.</div>:
    <>
      <div className="divide-y divide-gray-50">
        {top3.map((x,i)=>(
          <div key={x.branch} className="px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                i===0?'bg-amber-100 text-amber-700':i===1?'bg-gray-100 text-gray-600':'bg-orange-100 text-orange-700'
              }`}>{i+1}</div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-800 truncate">{displayStoreName(x.branch)}</div>
                <div className="text-[10px] text-gray-400">기준 목표 {x.total}가지 중 {x.achieved}가지 달성</div>
              </div>
            </div>
            <div className="text-sm font-bold text-amber-700">{x.score.toFixed(1)}점</div>
          </div>
        ))}
      </div>
      {myIndex>=3&&<div className="px-4 py-3 bg-brand-50 flex justify-between text-xs text-brand-700">
        <b>우리 매장 {myIndex+1}위</b>
        <span>{ranked[myIndex].score.toFixed(1)}점 · {ranked[myIndex].total}가지 중 {ranked[myIndex].achieved}가지 달성</span>
      </div>}
    </>}
  </div>;
}

function StoreGoalDashboardCard({ rows, employees, authUserId, month, onOpen, branchOverride }) {
  const [goal,setGoal]=useState(null);
  const me=(employees||[]).find(e=>e.id===authUserId);
  const branch=branchOverride || me?.branch || rows?.[0]?.branch;
  const finalPerformance=useFinalStorePerformance(month,branch||'');

  useEffect(()=>{
    if(!branch||NON_SALES_STORES.includes(branch)){setGoal(null);return;}
    (async()=>{
      const {data}=await supabase.from('store_goals').select('company_goals,challenge_goals')
        .eq('month',month).eq('store_name',branch).maybeSingle();
      setGoal({
        company_goals:{...companyGoalDefaults(branch),...(data?.company_goals||{})},
        challenge_goals:data?.challenge_goals||{}
      });
    })();
  },[month,branch]);

  if(!branch||NON_SALES_STORES.includes(branch)||!goal)return null;
  const branchRows=(rows||[]).filter(row=>row.branch===branch);
  const companyAch=storeGoalAchievement(goal.company_goals,branchRows,finalPerformance);
  const challengeBase={...goal.company_goals,...goal.challenge_goals};
  const challengeAch=storeGoalAchievement(challengeBase,branchRows,finalPerformance);

  return <button onClick={onOpen} className="w-full text-left bg-white rounded-xl border border-gray-100 p-4">
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-xs text-gray-400">🎯 {displayStoreName(branch)} 목표 달성</div>
        <div className="text-sm font-bold text-gray-900 mt-1">
          기준 목표 {companyAch.total}가지 중 <span className="text-brand-700">{companyAch.achieved}가지</span> 달성
        </div>
        <div className="text-xs text-gray-500 mt-1">
          도전 목표 {challengeAch.total}가지 중 {challengeAch.achieved}가지 달성 · 종합 {companyAch.score.toFixed(1)}점
        </div>
        {finalPerformance&&<div className="text-[9px] font-semibold text-emerald-600 mt-1">마감 확정 실적 기준</div>}
      </div>
      <span className="text-xs font-semibold text-brand-600">상세 ›</span>
    </div>
  </button>;
}

function AdminCustomerCareOverview({ employees, month, initialFilter='todo', compact=false, onOpen }) {
  const [tasks,setTasks]=useState([]),[customers,setCustomers]=useState([]),[sales,setSales]=useState([]),[loading,setLoading]=useState(true),[loadError,setLoadError]=useState('');
  const [filter,setFilter]=useState(initialFilter),[category,setCategory]=useState('all'),[branch,setBranch]=useState('all'),[employeeId,setEmployeeId]=useState('all'),[query,setQuery]=useState('');
  const employeeMap=Object.fromEntries((employees||[]).map(e=>[e.id,e]));
  const employeeIds=(employees||[]).map(e=>e.id).filter(Boolean);
  const employeeKey=employeeIds.join('|');
  const load=useCallback(async()=>{
    if(!employeeIds.length){setTasks([]);setCustomers([]);setSales([]);setLoading(false);return;}
    setLoading(true);
    setLoadError('');
    const [{data:t,error:taskError},{data:c,error:customerError},{data:s,error:saleError}]=await Promise.all([
      supabase.from('customer_tasks').select('*').in('user_id',employeeIds).order('due_date',{ascending:true}),
      supabase.from('customers').select('id,user_id,customer_name').in('user_id',employeeIds),
      compact?Promise.resolve({data:[],error:null}):supabase.from('customer_sales').select('id,user_id,customer_id,sale_date,metric_label,source_type').in('user_id',employeeIds).order('sale_date',{ascending:false}).limit(2000)
    ]);
    if(taskError||customerError||saleError)setLoadError(friendlyError(taskError||customerError||saleError));
    setTasks(t||[]);setCustomers(c||[]);setSales(s||[]);setLoading(false);
  },[employeeKey,compact]); // eslint-disable-line
  useEffect(()=>{load()},[load]);
  useEffect(()=>{setFilter(initialFilter)},[initialFilter]);
  const customerMap=Object.fromEntries(customers.map(c=>[c.id,c]));
  const today=new Date().toISOString().slice(0,10), week=addDaysDate(today,7);
  const selectedMonth=month||today.slice(0,7);
  const [monthYear,monthNumber]=selectedMonth.split('-').map(Number);
  const monthNextDate=new Date(monthYear,monthNumber,1);
  const monthNext=`${monthNextDate.getFullYear()}-${String(monthNextDate.getMonth()+1).padStart(2,'0')}-01`;
  const scoped=tasks.filter(t=>employeeMap[t.user_id]);
  const active=scoped.filter(t=>t.status!=='completed'&&t.status!=='cancelled');
  const overdue=active.filter(t=>t.due_date&&t.due_date<today);
  const todayTasks=active.filter(t=>t.due_date===today);
  const next7=active.filter(t=>t.due_date>=today&&t.due_date<=week);
  const selectedMonthTasks=scoped.filter(t=>t.due_date>=`${selectedMonth}-01`&&t.due_date<monthNext);
  const matured=selectedMonthTasks.filter(t=>t.status!=='cancelled'&&t.due_date<=today);
  const onTime=matured.filter(t=>t.status==='completed'&&String(t.completed_at||'').slice(0,10)<=t.due_date);
  const rate=matured.length?Math.round(onTime.length/matured.length*100):0;
  const stores=[...new Set((employees||[]).map(e=>e.branch).filter(Boolean))].sort();
  const categoryTone={'제휴카드':'bg-blue-50 text-blue-700','수납지원':'bg-brand-50 text-brand-700','변경':'bg-amber-50 text-amber-700','케이스 및 기타':'bg-gray-100 text-gray-600'};
  const cardProgress=(task)=>{const meta=task.task_meta||{};const stage=meta.card_stage==='received_not_visited'?'수령 완료':meta.card_stage==='applied_unreceived'?'신청 완료 · 미수령':'신청 전';const approval=meta.approval_required?(meta.approval_completed?'승인 완료':'승인 확인 필요'):'별도 승인 없음';const autopay=meta.autopay_registered?'자동이체 등록':'자동이체 미등록';return [meta.card_name,stage,approval,autopay].filter(Boolean).join(' · ')};
  const baseFiltered=scoped.filter(t=>{
    const emp=employeeMap[t.user_id], customer=customerMap[t.customer_id];
    if(branch!=='all'&&emp?.branch!==branch)return false;
    if(employeeId!=='all'&&t.user_id!==employeeId)return false;
    if(category!=='all'&&careTaskCategory(t)!==category)return false;
    const needle=query.trim().toLowerCase();
    if(needle&&!`${emp?.name||''} ${customer?.customer_name||''} ${t.title||''} ${t.note||''} ${t.task_meta?.card_name||''}`.toLowerCase().includes(needle))return false;
    if(filter==='today')return t.status!=='completed'&&t.status!=='cancelled'&&t.due_date===today;
    if(filter==='overdue')return t.status!=='completed'&&t.status!=='cancelled'&&t.due_date<today;
    if(filter==='upcoming')return t.status!=='completed'&&t.status!=='cancelled'&&t.due_date>=today;
    if(filter==='done')return t.status==='completed'&&t.due_date>=`${selectedMonth}-01`&&t.due_date<monthNext;
    if(filter==='cancelled')return t.status==='cancelled'&&t.due_date>=`${selectedMonth}-01`&&t.due_date<monthNext;
    return t.status!=='completed'&&t.status!=='cancelled'&&t.due_date<=week;
  });
  const grouped=[],paymentGroups=new Map();
  const paymentGroupKey=(t)=>`${t.user_id}:${t.customer_id}:${t.source_sale_id||t.base_date||'direct'}`;
  baseFiltered.forEach(t=>{if(String(t.task_type||'').startsWith('payment3_'))paymentGroups.set(paymentGroupKey(t),true);else grouped.push({task:t,tasks:[t]})});
  paymentGroups.forEach((_,key)=>{const ordered=scoped.filter(t=>String(t.task_type||'').startsWith('payment3_')&&paymentGroupKey(t)===key).sort((a,b)=>String(a.due_date).localeCompare(String(b.due_date)));const matching=ordered.filter(t=>baseFiltered.some(x=>x.id===t.id));const next=filter==='done'?[...matching].reverse()[0]:filter==='cancelled'?[...matching].reverse()[0]:ordered.find(t=>t.status!=='completed'&&t.status!=='cancelled')||ordered[ordered.length-1];if(next)grouped.push({task:next,tasks:ordered,payment:true})});
  const displayRows=grouped.sort((a,b)=>String(a.task.due_date||'').localeCompare(String(b.task.due_date||'')));
  const searchNeedle=query.trim().toLowerCase();
  const unifiedCustomerRows=searchNeedle?customers.map(customer=>{
    const emp=employeeMap[customer.user_id];
    if(!emp)return null;
    if(branch!=='all'&&emp.branch!==branch)return null;
    if(employeeId!=='all'&&customer.user_id!==employeeId)return null;
    const customerTasks=scoped.filter(task=>task.customer_id===customer.id);
    const customerSales=sales.filter(sale=>sale.customer_id===customer.id);
    const haystack=[customer.customer_name,emp.name,emp.branch,...customerTasks.flatMap(task=>[task.title,task.note,task.task_meta?.card_name]),...customerSales.map(sale=>sale.metric_label)].filter(Boolean).join(' ').toLowerCase();
    if(!haystack.includes(searchNeedle))return null;
    return {customer,emp,tasks:customerTasks,sales:customerSales,lastSale:customerSales[0]};
  }).filter(Boolean).sort((a,b)=>String(b.lastSale?.sale_date||'').localeCompare(String(a.lastSale?.sale_date||''))).slice(0,20):[];

  if(loading)return <div className="bg-white rounded-xl border p-4 text-xs text-gray-400">고객 약속 현황 불러오는 중...</div>;
  if(loadError)return <div className="bg-white rounded-xl border border-red-100 p-4"><div className="text-sm font-bold text-red-500">고객 약속을 불러오지 못했어요.</div><div className="text-xs text-red-400 mt-1">{loadError}</div></div>;
  return <div className="space-y-3">
    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
      {[['오늘',todayTasks.length],['7일 내',next7.length],['기한초과',overdue.length],['기한 내 완료',`${rate}%`],['취소',selectedMonthTasks.filter(t=>t.status==='cancelled').length]].map(([l,v])=>
        <div key={l} className="bg-white rounded-xl border border-gray-100 p-3 text-center"><div className={`text-lg font-bold ${l==='기한초과'&&Number(v)>0?'text-red-600':'text-gray-900'}`}>{v}</div><div className="text-[10px] text-gray-400">{l}</div></div>)}
    </div>
    {compact?<button onClick={onOpen} className="w-full bg-white rounded-xl border border-gray-100 p-4 flex justify-between text-left"><div><div className="text-sm font-bold">고객 약속 관리</div><div className="text-xs text-gray-400 mt-1">직원별 진행단계와 기한초과 내역을 확인해요.</div></div><span className="text-xs font-semibold text-brand-600">상세 ›</span></button>:<>
    <div className="bg-white rounded-xl border border-gray-100 p-3 space-y-2">
      <div><div className="text-xs font-bold text-gray-800">고객 통합검색</div><div className="mt-0.5 text-[10px] text-gray-400">판매 이력과 약속을 한 번에 찾아요.</div></div>
      <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="고객명·직원명·판매 항목·약속·카드사 검색" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"/>
      {searchNeedle&&<div className="rounded-xl border border-brand-100 bg-brand-50/50 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-brand-100"><span className="text-[10px] font-bold text-brand-700">통합 고객 검색 결과</span><span className="text-[10px] text-brand-500">{unifiedCustomerRows.length}명</span></div>
        <div className="max-h-56 overflow-y-auto divide-y divide-brand-100">{unifiedCustomerRows.map(({customer,emp,tasks:customerTasks,sales:customerSales,lastSale})=><button key={customer.id} type="button" onClick={()=>{setQuery(customer.customer_name);setBranch(emp.branch||'all');setEmployeeId(emp.id)}} className="w-full bg-white/80 px-3 py-2.5 text-left hover:bg-white"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="text-xs font-bold text-gray-900 truncate">{customer.customer_name} · {emp.name}</div><div className="mt-0.5 text-[10px] text-gray-400 truncate">{displayStoreName(emp.branch)}{lastSale?` · 최근 ${lastSale.sale_date} ${lastSale.metric_label||'판매'}`:''}</div></div><div className="shrink-0 text-[10px] font-semibold text-brand-600">판매 {customerSales.length} · 약속 {customerTasks.length}</div></div></button>)}{unifiedCustomerRows.length===0&&<div className="px-3 py-5 text-center text-xs text-gray-400">판매 이력과 약속에서 일치하는 고객이 없어요.</div>}</div>
      </div>}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <select value={branch} onChange={e=>{setBranch(e.target.value);setEmployeeId('all')}} className="border rounded-lg px-2.5 py-2 text-xs"><option value="all">전체 매장</option>{stores.map(x=><option key={x} value={x}>{displayStoreName(x)}</option>)}</select>
        <select value={employeeId} onChange={e=>setEmployeeId(e.target.value)} className="border rounded-lg px-2.5 py-2 text-xs"><option value="all">전체 직원</option>{(employees||[]).filter(e=>branch==='all'||e.branch===branch).map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select>
        <select value={category} onChange={e=>setCategory(e.target.value)} className="border rounded-lg px-2.5 py-2 text-xs"><option value="all">전체 카테고리</option>{['제휴카드','수납지원','변경','케이스 및 기타'].map(x=><option key={x} value={x}>{x}</option>)}</select>
        <button onClick={()=>{setQuery('');setBranch('all');setEmployeeId('all');setCategory('all');setFilter('todo')}} className="rounded-lg bg-gray-50 text-gray-500 text-xs font-semibold">필터 초기화</button>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1">{[['todo','할 일'],['today','오늘'],['overdue','경과'],['upcoming','전체 예정'],['done','완료'],['cancelled','취소']].map(([key,label])=><button key={key} onClick={()=>setFilter(key)} className={`py-2 rounded-lg text-[10px] font-semibold ${filter===key?'bg-brand-600 text-white':'bg-gray-50 text-gray-500'}`}>{label}</button>)}</div>
      <div className="text-[10px] text-gray-400">완료·취소는 {monthLabel(selectedMonth)} 기준이며, 진행 중 약속은 월과 관계없이 놓치지 않도록 표시해요.</div>
    </div>
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 border-b flex justify-between gap-3"><div><div className="text-sm font-bold">고객 약속 상세</div><div className="text-xs text-gray-400">관리 범위의 직원과 고객 진행상태를 함께 확인해요.</div></div><div className="text-xs font-bold text-brand-600">{displayRows.length}건</div></div>
      <div className="divide-y">
        {displayRows.map(({task:t,tasks:groupTasks,payment})=>{
          const emp=employeeMap[t.user_id], customer=customerMap[t.customer_id];
          const taskCategory=careTaskCategory(t),completedCount=groupTasks.filter(x=>x.status==='completed').length;
          const statusLabel=t.status==='completed'?'완료':t.status==='cancelled'?(t.task_meta?.cancel_reason==='home_cancelled'?'청약 취소':'고객 거절'):t.due_date<today?`${Math.round((new Date(`${today}T00:00:00`)-new Date(`${t.due_date}T00:00:00`))/86400000)}일 초과`:t.due_date===today?'오늘':`D-${Math.round((new Date(`${t.due_date}T00:00:00`)-new Date(`${today}T00:00:00`))/86400000)}`;
          return <div key={payment?`${t.user_id}-${t.customer_id}-${t.source_sale_id||t.base_date}`:t.id} className="px-4 py-3 text-xs"><div className="flex justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap"><span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${categoryTone[taskCategory]}`}>{taskCategory}</span><b className="text-gray-800">{emp?.name||'직원'} · {customer?.customer_name||'고객'}</b></div>
              <div className="text-[10px] text-gray-400 mt-1">{displayStoreName(emp?.branch)}</div>
              <div className="text-gray-600 mt-1">{payment?`${groupTasks.length}개월 요금 수납지원 · ${completedCount}/${groupTasks.length}회 완료`:t.title}</div>
              {payment&&<div className="text-brand-700 mt-1">다음 수납 · {t.due_date}</div>}
              {t.task_type==='affiliateCard'&&<div className="text-blue-700 mt-1 leading-relaxed">{cardProgress(t)}</div>}
              {t.target_plan&&<div className="text-brand-700 mt-1">변경 예정 · {t.target_plan}</div>}
              {t.note&&!payment&&<div className="text-gray-400 mt-1">{t.note}</div>}
            </div>
            <div className="shrink-0 text-right"><div className={`font-semibold ${t.status==='cancelled'?'text-gray-500':t.status==='completed'?'text-emerald-600':t.due_date<today?'text-red-500':t.due_date===today?'text-orange-500':'text-brand-600'}`}>{statusLabel}</div><div className="text-[10px] text-gray-400 mt-1">{t.due_date}</div></div>
          </div></div>
        })}
        {displayRows.length===0&&<div className="py-8 text-center text-xs text-gray-400">조건에 해당하는 고객 약속이 없어요.</div>}
      </div>
    </div>
    </>}
  </div>;
}

function AdminManagementAlerts({ pendingCount, employees, onGo, month, rows, dailyRecords, isFullAdmin, config, canViewSpotAdmin=false }) {
  const [counts,setCounts]=useState({customer:0,home:0,spot:0,profile:0,settlement:0,hqDiff:0,goalRisk:0,pushMissing:0,pushFailed:0,pushSent:0});
  useEffect(()=>{
    (async()=>{
      const today=new Date().toISOString().slice(0,10);
      const ids=(employees||[]).map(e=>e.id);
      if(!ids.length)return;
      const scopedBranches=[...new Set((employees||[]).map(employee=>employee.branch).filter(branch=>branch&&!NON_SALES_STORES.includes(branch)))];
      const [{data:t},{data:h},{data:s},{data:p},{data:sr},{data:hq},{data:goals},{data:pushRows}]=await Promise.all([
        supabase.from('customer_tasks').select('id').in('user_id',ids).eq('status','pending').lt('due_date',today),
        supabase.from('home_orders').select('id').in('user_id',ids).eq('status','pending').lt('planned_install_date',today),
        supabase.from('spot_claims').select('id').in('user_id',ids).eq('status','pending'),
        supabase.from('profile_edit_requests').select('id').in('user_id',ids).eq('status','pending'),
        supabase.from('settlement_reviews').select('user_id,status').eq('month',month).in('user_id',ids),
        supabase.from('head_office_performance').select('user_id,metrics').eq('month',month).in('user_id',ids),
        supabase.from('store_goals').select('store_name,company_goals,challenge_goals').eq('month',month).in('store_name',scopedBranches),
        supabase.rpc('get_push_delivery_overview')
      ]);
      const reviewed=new Set((sr||[]).filter(x=>x.status==='checked'||x.status==='final').map(x=>x.user_id));
      const rowMap=Object.fromEntries((rows||[]).map(x=>[x.id,x]));
      const hqDiff=(hq||[]).filter(x=>{const r=rowMap[x.user_id],m=x.metrics||{};return r&&(Number(headOfficeScores(normalizeHeadOfficeMetrics(m),config,month)?.hs||0)!==Number(hsCount(r.draft)||0))}).length;
      const forecastFactor=monthKeyOf(new Date())===month?daysInMonth(month)/Math.max(1,new Date().getDate()):1;
      const goalRisk=(goals||[]).filter(goal=>{
        const target=Number(({...(goal.company_goals||{}),...(goal.challenge_goals||{})}).hs||0);
        if(target<=0)return false;
        const actual=(rows||[]).filter(row=>row.branch===goal.store_name).reduce((sum,row)=>sum+hsCount(row.draft),0);
        return actual*forecastFactor<target;
      }).length;
      const scopedPush=(pushRows||[]).filter(push=>ids.includes(push.user_id));
      const pushMissing=scopedPush.filter(push=>!push.has_active_subscription).length;
      const pushFailed=scopedPush.filter(push=>push.last_delivery_status==='failed').length;
      const pushSent=scopedPush.filter(push=>push.last_delivery_status==='sent').length;
      setCounts({customer:(t||[]).length,home:(h||[]).length,spot:(s||[]).length,profile:(p||[]).length,settlement:Math.max(0,ids.length-reviewed.size),hqDiff,goalRisk,pushMissing,pushFailed,pushSent});
    })();
  },[employees,month,rows,config]);
  const now=new Date(),todayKey=String(now.getDate()).padStart(2,'0');
  const missing=monthKeyOf(now)===month?(employees||[]).filter(e=>{const d=normalizeDay(dailyRecords?.[e.id]?.[todayKey]);return !d.dayOff&&!dayHasData(d)}).length:0;
  const total=['customer','home','spot','profile','settlement','hqDiff','goalRisk','pushMissing','pushFailed'].reduce((sum,key)=>sum+Number(counts[key]||0),0)+missing+Number(pendingCount||0);
  return <div className="bg-white rounded-xl border border-brand-100 p-3">
    <div className="flex justify-between items-center"><div><div className="text-xs text-brand-500">🔔 관리 알림</div><div className="text-sm font-bold text-gray-900 mt-0.5">{total?`${fmtCount(total)}건 확인 필요`:'확인할 관리 알림이 없어요'}</div></div></div>
    {total>0&&<div className="grid grid-cols-2 gap-2 mt-3 text-xs">
      <button onClick={()=>onGo('performanceApproval')} className="bg-brand-50 text-brand-700 rounded-lg p-2 text-left">오늘 입력 누락 <b className="float-right">{missing}</b></button>
      <button onClick={()=>onGo('customerCareAdmin')} className="bg-red-50 text-red-600 rounded-lg p-2 text-left">고객약속 경과 <b className="float-right">{counts.customer}</b></button>
      <button onClick={()=>onGo('homeCare')} className="bg-orange-50 text-orange-600 rounded-lg p-2 text-left">홈 설치 확인 <b className="float-right">{counts.home}</b></button>
      {canViewSpotAdmin&&<button onClick={()=>onGo('spot')} className="bg-orange-50 text-orange-600 rounded-lg p-2 text-left">스팟 승인 <b className="float-right">{counts.spot}</b></button>}
      <button onClick={()=>onGo('performanceApproval')} className="bg-brand-50 text-brand-700 rounded-lg p-2 text-left">실적 승인 대기 <b className="float-right">{pendingCount}</b></button>
      <button onClick={()=>onGo('storeGoals')} className="bg-red-50 text-red-600 rounded-lg p-2 text-left">HS 목표 위험 매장 <b className="float-right">{counts.goalRisk}</b></button>
      {isFullAdmin&&<button onClick={()=>onGo('headOfficeData')} className="bg-blue-50 text-blue-700 rounded-lg p-2 text-left">본사 데이터 차이 <b className="float-right">{counts.hqDiff}</b></button>}
      {isFullAdmin&&<button onClick={()=>onGo('settlement')} className="bg-emerald-50 text-emerald-700 rounded-lg p-2 text-left">정산 미검토 <b className="float-right">{counts.settlement}</b></button>}
      <button onClick={()=>onGo('employees')} className="bg-gray-50 text-gray-700 rounded-lg p-2 text-left">프로필 수정 요청 <b className="float-right">{counts.profile}</b></button>
      <button onClick={()=>onGo('employees')} className="bg-gray-50 text-gray-700 rounded-lg p-2 text-left">푸시 알림 미설정 <b className="float-right">{counts.pushMissing}</b></button>
      {counts.pushFailed>0&&<div className="bg-red-50 text-red-600 rounded-lg p-2">최근 푸시 발송 실패 <b className="float-right">{counts.pushFailed}</b></div>}
      {counts.pushSent>0&&<div className="bg-emerald-50 text-emerald-700 rounded-lg p-2">최근 발송 성공 <b className="float-right">{counts.pushSent}</b></div>}
    </div>}
  </div>;
}

function SettlementReview({ month, rows, employees, config, authUserId }) {
  const [spotMap,setSpotMap]=useState({}),[expenseMap,setExpenseMap]=useState({}),[statusMap,setStatusMap]=useState({}),[headOfficeMap,setHeadOfficeMap]=useState({});
  const [detailUser,setDetailUser]=useState(null),[detailRows,setDetailRows]=useState([]),[detailLoading,setDetailLoading]=useState(false);
  useEffect(()=>{
    (async()=>{
      const ids=(rows||[]).map(r=>r.id);if(!ids.length)return;
      const [y,m]=month.split('-').map(Number),n=new Date(y,m,1),to=`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-01`;
      const [{data:s},{data:e},{data:r},{data:h}]=await Promise.all([
        supabase.from('spot_claims').select('user_id,final_amount,direct_amount,source_context,spot_policies(amount)').in('user_id',ids).eq('status','approved').gte('claim_date',`${month}-01`).lt('claim_date',to),
        supabase.from('sales_expenses').select('user_id,amount').is('voided_at',null).in('user_id',ids).gte('expense_date',`${month}-01`).lt('expense_date',to),
        supabase.from('settlement_reviews').select('*').eq('month',month).in('user_id',ids),
        supabase.from('head_office_performance').select('user_id,as_of_date,metrics,vas_review,note').eq('month',month).in('user_id',ids)
      ]);
      const sm={},em={},stm={};
      (s||[]).filter(x=>x.source_context!=='mobile').forEach(x=>sm[x.user_id]=(sm[x.user_id]||0)+Number(x.final_amount??x.direct_amount??x.spot_policies?.amount??0));
      (e||[]).forEach(x=>em[x.user_id]=(em[x.user_id]||0)+Number(x.amount||0));
      (r||[]).forEach(x=>stm[x.user_id]=x.status);
      setSpotMap(sm);setExpenseMap(em);setStatusMap(stm);setHeadOfficeMap(Object.fromEntries((h||[]).map(x=>[x.user_id,x])));
    })();
  },[month,rows]);

  const setStatus=async(userId,status)=>{
    const {error}=await supabase.from('settlement_reviews').upsert({month,user_id:userId,status,reviewer_id:authUserId,updated_at:new Date().toISOString()},{onConflict:'month,user_id'});
    if(error)return showLegacyAlert(`정산 상태 저장 실패: ${friendlyError(error)}`);
    setStatusMap({...statusMap,[userId]:status});
    if(status==='checked'||status==='final')await notifyEmployee({actorId:authUserId,recipientId:userId,type:'settlement_reviewed',title:status==='final'?'정산 확정 완료':'정산 검토 완료',message:`${monthLabel(month)} 정산 상태가 업데이트됐어요.`,payload:{month,status}});
  };

  const loadDetail=async(r)=>{
    setDetailUser(r);setDetailRows([]);setDetailLoading(true);
    const [y,m]=month.split('-').map(Number),n=new Date(y,m,1),to=`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-01`;
    try{
      const [salesRes,spotsRes,expensesRes,homeRes]=await Promise.all([
        supabase.from('customer_sales').select('id,customer_id,sale_date,metric_label,source_type,source_ref,source_meta,customers(customer_name)').eq('user_id',r.id).gte('sale_date',`${month}-01`).lt('sale_date',to).order('sale_date'),
        supabase.from('spot_claims').select('id,claim_date,customer_name,status,source_context,reviewed_title,direct_title,final_amount,direct_amount,spot_policies(title,amount)').eq('user_id',r.id).gte('claim_date',`${month}-01`).lt('claim_date',to).order('claim_date'),
        supabase.from('sales_expenses').select('id,expense_date,customer_name,category,amount,memo').is('voided_at',null).eq('user_id',r.id).gte('expense_date',`${month}-01`).lt('expense_date',to).order('expense_date'),
        supabase.from('home_orders').select('id,customer_id,customer_name,product_type,network_type,sale_type,main_tv_plan,source_group,source_key,status,source_work_date,actual_install_date').eq('user_id',r.id).or(`source_work_date.gte.${month}-01,actual_install_date.gte.${month}-01`)
      ]);
      const err=salesRes.error||spotsRes.error||expensesRes.error||homeRes.error;if(err)throw err;
      const recognizedHomes=homeOrdersForMonth(enrichHomeOrdersForPolicy(homeRes.data||[],salesRes.data||[]),month,'completed');
      const homeMap=Object.fromEntries(recognizedHomes.map(o=>[String(o.id),o]));
      const detailHomePolicy=calculateHomePolicyEngine(recognizedHomes,config);
      const ledger=[];
      (salesRes.data||[]).forEach(x=>{
        const meta=x.source_meta||{}, customer=x.customers?.customer_name||'이름 없음';
        if(x.source_type==='mobile'){
          const ri=Number(meta.ri),ci=Number(meta.ci);
          const matrixRate=Number(config.matrix?.[ri]?.[ci]||0);
          if(matrixRate)ledger.push({date:x.sale_date,customer,type:x.metric_label||'모바일',item:'요금제 유치 수수료',amount:matrixRate,note:`${MATRIX_ROW_DEFS[ri]?.dailyLabel||MATRIX_ROW_DEFS[ri]?.label||''}${MATRIX_ROW_DEFS[ri]?.hasTiers?` · ${MATRIX_COLS[ci]||''}`:''}`});
          const normalVas=[...(meta.vasKeys||[])];
          normalVas.forEach(k=>{if(k==='vasNone')return;const it=(config.vas||[]).find(v=>v.key===k);if(Number(it?.rate||0))ledger.push({date:x.sale_date,customer,type:x.metric_label||'모바일',item:'VAS 유치 수수료',amount:Number(it.rate),note:it.label||k});});
          Object.entries(meta.bundle2ndKeys||[]).forEach(()=>{});
          (meta.bundle2ndKeys||[]).forEach(k=>{const it=(config.bundle2nd||[]).find(v=>v.key===k);if(Number(it?.rate||0))ledger.push({date:x.sale_date,customer,type:x.metric_label||'모바일',item:'2ND 번들 유치 수수료',amount:Number(it.rate),note:it.label||k});});
          if(meta.usedMnpBundle){const it=(config.mnpBundle||[]).find(v=>v.key==='usedMnpBundle');if(Number(it?.rate||0))ledger.push({date:x.sale_date,customer,type:x.metric_label||'모바일',item:'중고 MNP 결합 수수료',amount:Number(it.rate),note:it.label||'중고MNP 결합'});}
          const sp=meta.specialPolicy||{};
          specialPolicyLedgerRows(sp,matrixRate).forEach(item=>ledger.push({date:x.sale_date,customer,type:x.metric_label||'모바일',...item}));
        } else if(x.source_type==='home_order'){
          // 홈은 아래에서 고객 묶음 단위 새 정책 계산 결과를 한 번만 표시합니다.
        }
      });
      (detailHomePolicy.details||[]).forEach(x=>ledger.push(x));
      (spotsRes.data||[]).forEach(x=>{
        if(x.status!=='approved')return;
        ledger.push({date:x.claim_date,customer:x.customer_name||'이름 없음',type:'스팟',item:x.reviewed_title||x.direct_title||x.spot_policies?.title||'승인 스팟',amount:Number(x.final_amount??x.direct_amount??x.spot_policies?.amount??0),note:x.source_context==='mobile'?'모바일 승인 스팟':'승인 스팟'});
      });
      (expensesRes.data||[]).forEach(x=>ledger.push({date:x.expense_date,customer:x.customer_name||'이름 없음',type:'영업비용',item:x.category||'영업비용',amount:-Number(x.amount||0),note:x.memo||'비용 차감'}));
      ledger.sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.customer).localeCompare(String(b.customer)));
      setDetailRows(ledger);
    }catch(e){showLegacyAlert(`상세 산출내역 불러오기 실패: ${friendlyError(e)}`);}
    finally{setDetailLoading(false);}
  };

  // 관계 조인을 사용하지 않고 프로필을 별도 매핑해 schema-cache 오류를 피합니다.
  const exportRaw=async()=>{
    const ids=(rows||[]).map(r=>r.id);if(!ids.length)return showLegacyAlert('정산 대상 직원이 없어요.');
    const [y,m]=month.split('-').map(Number),n=new Date(y,m,1),to=`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-01`;
    try {
      const results=await Promise.all([
        supabase.from('daily_records').select('user_id,work_date,data').in('user_id',ids).gte('work_date',`${month}-01`).lt('work_date',to).order('work_date'),
        supabase.from('spot_claims').select('*, spot_policies(title,amount)').in('user_id',ids).gte('claim_date',`${month}-01`).lt('claim_date',to),
        supabase.from('sales_expenses').select('*').is('voided_at',null).in('user_id',ids).gte('expense_date',`${month}-01`).lt('expense_date',to),
        supabase.from('profiles').select('id,name,store_name').in('id',ids)
      ]);
      const firstError=results.find(x=>x.error)?.error;if(firstError)throw firstError;
      const [daily,spots,expenses,profiles]=results.map(x=>x.data||[]);
      const pm=Object.fromEntries(profiles.map(p=>[p.id,p]));
      const esc=v=>`"${String(v??'').replace(/"/g,'""')}"`;
      const rowsCsv=[['구분','기준월','일자','매장','직원','대분류','세부항목','세부구분','건수/값','적용금액','지급반영','비고']];
      (rows||[]).forEach(r=>{
        const spot=spotMap[r.id]||0,expense=expenseMap[r.id]||0,net=r.pay.total+spot-expense;
        const parts=[['보장/기본',r.pay.guaranteedComponent],['홈 그레이드',r.pay.homeGradePay],['홈 정액',r.pay.homeFlatPay],['홈 부가',r.pay.homeAddonPay],['재약정',r.pay.renewPay],['VAS',r.pay.vasPay],['MNP번들',r.pay.mnpBundlePay],['소노',r.pay.sonoPay],['고객등록 보너스',r.pay.custRegBonus],['맞춤제안 보너스',r.pay.tailoredBonus],['맞춤제안 금액',r.pay.tailoredAmountBonus],['승인 스팟',spot],['영업비용 차감',-expense]];
        parts.filter(([,v])=>Number(v||0)!==0).forEach(([label,v])=>rowsCsv.push(['정산요약',month,'',r.branch,r.name,'지급구성',label,'',1,v,'반영','']));
        rowsCsv.push(['정산합계',month,'',r.branch,r.name,'최종지급액','', '',1,net,'실지급 검토',`기본계산 ${r.pay.total} + 스팟 ${spot} - 비용 ${expense}`]);
      });
      (daily||[]).forEach(x=>{
        const p=pm[x.user_id]||{},d=normalizeDay(x.data);
        d.matrix.forEach((arr,ri)=>arr.forEach((cnt,ci)=>{if(!cnt)return;const rd=MATRIX_ROW_DEFS[ri];rowsCsv.push(['실적RAW',month,x.work_date,p.store_name,p.name,'모바일',rd?.dailyLabel||rd?.label||`행${ri+1}`,rd?.hasTiers?MATRIX_COLS[ci]:'',cnt,config.matrix?.[ri]?.[ci]||0,'계산대상','원천 일일입력'])}));
        DAILY_GROUP_DEFS.forEach(g=>{const table=groupTable(config,g.key);Object.entries(d.groups?.[g.key]||{}).forEach(([key,cnt])=>{if(!cnt)return;const item=table.find(t=>t.key===key);rowsCsv.push(['실적RAW',month,x.work_date,p.store_name,p.name,g.bucket==='home'?'홈':'기타',g.label,item?.label||key,cnt,item?.rate||item?.point||0,'계산대상','원천 일일입력'])})});
      });
      (spots||[]).forEach(x=>{const p=pm[x.user_id]||{};rowsCsv.push(['가감RAW',month,x.claim_date,p.store_name,p.name,'스팟',x.reviewed_title||x.direct_title||x.spot_policies?.title||'',x.customer_name||'',1,x.final_amount??x.direct_amount??x.spot_policies?.amount??0,x.status==='approved'?'반영':'미반영',x.status])});
      (expenses||[]).forEach(x=>{const p=pm[x.user_id]||{};rowsCsv.push(['가감RAW',month,x.expense_date,p.store_name,p.name,'영업비용',x.category,x.customer_name||'',1,-Number(x.amount||0),'차감',x.memo||''])});
      const csv='\uFEFF'+rowsCsv.map(r=>r.map(esc).join(',')).join('\r\n');
      const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=url;a.download=`정산_검증_RAW_${month}.csv`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
    } catch(e) { showLegacyAlert(`정산 RAW 생성 실패: ${friendlyError(e)}`); }
  };

  const detailSummary=detailUser?(()=>{
    const p=detailUser.pay||{};
    const basis=Number(p.mobileGuaranteeBasis||0);
    const applied=Number(p.guaranteedComponent||0);
    const standardAdjustment=Math.max(0,applied-basis);
    const freeSaleAdjust=-(Number(p.bundleFreeOffset||0)+Number(p.bundleFreeVasOffset||0));
    return [
      ['영업 활동 지원 정책',p.tenurePay],
      ['모바일 요금제 유치 수수료',p.mobilePlanPay],
      ['VAS 유치 수수료',p.rawVasPay],
      ['2ND 번들 유치 수수료',Number(p.rawBundle2ndTotal||0)],
      ['무료판매 제외',freeSaleAdjust],
      ['특판 요금제/VAS 제외',-(Number(p.specialMatrixOffset||0)+Number(p.specialVasOffset||0))],
      ['특판 대체 인센티브',p.specialReplacementPay],
      ['승인 모바일 스팟',p.approvedMobileSpotPay],
      ['직책수당',p.positionAllowance],
      ['직급 기준 보정',standardAdjustment],
      ['성과등급 보너스',p.gradeBonus],
      ['홈 그레이드 수수료',p.homeGradePay],
      ['홈 단독·부가 수수료',p.homeFlatPay],
      ['홈 동시판매·부셋탑',p.homeAddonPay],
      ['인터넷 재약정',p.renewPay],
      ['중고 MNP 결합 수수료',p.mnpBundlePay],
      ['소노',p.sonoPay],
      ['고객등록 보너스',p.custRegBonus],
      ['맞춤제안 건수',p.tailoredBonus],
      ['맞춤제안 금액',p.tailoredAmountBonus],
      ['승인 홈/기타 스팟',spotMap[detailUser.id]||0],
      ['영업비용',-(expenseMap[detailUser.id]||0)]
    ].filter(([,v])=>Number(v||0)!==0);
  })():[];

  return <div className="space-y-3">
    <div className="bg-white rounded-xl border p-4 flex justify-between gap-3 items-center">
      <div><div className="font-bold">💰 {monthLabel(month)} 정산 검토</div><div className="text-xs text-gray-400 mt-1">직원을 누르면 날짜·고객·판매항목별 산출근거를 확인할 수 있어요. RAW CSV는 같은 원천자료 대조용입니다.</div></div>
      <button onClick={exportRaw} className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold">RAW CSV</button>
    </div>
    <div className="bg-white rounded-xl border overflow-hidden divide-y">
      {(rows||[]).map(r=>{
        const spot=spotMap[r.id]||0,expense=expenseMap[r.id]||0,net=r.pay.total+spot-expense,status=statusMap[r.id]||'unreviewed',hq=headOfficeMap[r.id];
        const hqMetrics=hq?normalizeHeadOfficeMetrics(hq.metrics):null,hqScore=hqMetrics?headOfficeScores(hqMetrics,config,month):null;
        const inputHs=hsCount(r.draft),inputSecond=matrixRowCount(r.draft,7)+Object.values(r.draft?.bundle2nd||{}).reduce((s,v)=>s+Number(v||0),0);
        return <div key={r.id} className="p-4">
          <button onClick={()=>loadDetail(r)} className="w-full text-left">
            <div className="flex justify-between gap-3"><div><div className="font-bold text-sm">{r.name} · {displayStoreName(r.branch)}</div><div className="text-xs text-gray-400 mt-1">기본 {won(r.pay.total)} · 스팟 +{won(spot)} · 비용 -{won(expense)}</div><div className="text-[10px] text-brand-500 mt-1">상세 산출내역 보기 ›</div></div><div className="text-right"><div className="font-bold text-brand-700">{won(net)}</div><div className="text-[10px] text-gray-400">비용 차감 후</div></div></div>
          </button>
          {hqScore?<div className="mt-2 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-[10px] text-blue-800"><div className="font-semibold">본사 데이터 {hq.as_of_date} 기준</div><div className="mt-1">HS 직원 {fmtCount(inputHs)} / 본사 {fmtCount(hqScore.hs)} <b>({hqScore.hs-inputHs>0?'+':''}{fmtCount(hqScore.hs-inputHs)})</b> · 2ND 직원 {fmtCount(inputSecond)} / 본사 {fmtCount(hqScore.second)} <b>({hqScore.second-inputSecond>0?'+':''}{fmtCount(hqScore.second-inputSecond)})</b></div><div className="mt-0.5">성과P 직원 {fmtNum(r.pay?.totalPoints,1)}P / 본사 {fmtNum(hqScore.gradePoints,1)}P · 생산성 직원 {fmtNum(r.pay?.kpiScore,1)}P / 본사 {fmtNum(hqScore.kpiScore,1)}P</div></div>:<div className="mt-2 text-[10px] text-gray-300">본사 데이터 미등록 · 직원 입력 기준으로 검토</div>}
          <div className="grid grid-cols-4 gap-1 mt-3">
            {[['unreviewed','미검토'],['reviewing','검토중'],['checked','확인완료'],['final','정산확정']].map(([k,l])=><button key={k} onClick={()=>setStatus(r.id,k)} className={`py-1.5 rounded text-[10px] font-semibold ${status===k?'bg-brand-600 text-white':'bg-gray-50 text-gray-500'}`}>{l}</button>)}
          </div>
        </div>
      })}
    </div>
    {detailUser&&<div className="fixed inset-0 z-[80] bg-black/40 flex items-end md:items-center justify-center p-0 md:p-4" onClick={()=>setDetailUser(null)}>
      <div className="bg-white w-full md:max-w-5xl max-h-[92vh] rounded-t-2xl md:rounded-2xl overflow-hidden flex flex-col" onClick={e=>e.stopPropagation()}>
        <div className="p-4 border-b flex justify-between items-start"><div><div className="font-bold">{detailUser.name} · {monthLabel(month)} 상세 정산 원장</div><div className="text-xs text-gray-400 mt-1">날짜 / 고객명 / 가입구분 / 돈이 발생한 항목 / 적용금액</div></div><button onClick={()=>setDetailUser(null)} className="text-gray-400 text-xl">×</button></div>
        <div className="overflow-auto">
          <div className="p-4 bg-brand-50 border-b">
            <div className="text-xs font-bold text-brand-700 mb-2">최종 지급 구성</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">{detailSummary.map(([l,v])=><div key={l} className="bg-white rounded-lg border p-2 flex justify-between gap-2 text-xs"><span>{l}</span><b>{v>=0?'+':''}{won(v)}</b></div>)}</div>
            <div className="mt-3 flex justify-between font-bold text-sm"><span>최종 검토금액</span><span className="text-brand-700">{won(detailUser.pay.total+(spotMap[detailUser.id]||0)-(expenseMap[detailUser.id]||0))}</span></div>
          </div>
          {detailLoading?<div className="p-10 text-center text-sm text-gray-400">상세 내역을 불러오는 중...</div>:detailRows.length===0?<div className="p-10 text-center text-sm text-gray-400">고객별 판매 기록이 없어요. 구버전 집계 실적은 위 최종 지급 구성에서 확인할 수 있어요.</div>:<div className="divide-y">
            {detailRows.map((x,i)=><div key={`${x.date}-${i}`} className="p-3 grid grid-cols-[72px_1fr_auto] md:grid-cols-[90px_140px_150px_1fr_120px] gap-2 items-center text-xs">
              <div className="text-gray-500">{String(x.date||'').slice(5)}</div>
              <div className="font-semibold truncate">{x.customer}</div>
              <div className="hidden md:block text-gray-500">{x.type}</div>
              <div><div className="font-medium">{x.item}</div>{x.note&&<div className="text-[10px] text-gray-400 mt-0.5">{x.note}</div>}</div>
              <div className={`text-right font-bold ${Number(x.amount)<0?'text-red-500':Number(x.amount)>0?'text-brand-700':'text-gray-400'}`}>{x.amount===null?'금액은 월 합산 반영':`${Number(x.amount)>0?'+':''}${won(x.amount)}`}</div>
            </div>)}
          </div>}
          <div className="p-4 text-[10px] text-gray-400 bg-gray-50">※ 고객별 원장은 현재 고객별 판매로 저장된 건을 기준으로 보여줍니다. 영업활동지원·최저보장·홈 그레이드처럼 월 누적 조건으로 결정되는 금액은 상단 ‘최종 지급 구성’에서 별도로 대조합니다.</div>
        </div>
      </div>
    </div>}
  </div>;
}

function dailyCalendarMetrics(raw){
  const d=normalizeDay(raw);
  const core=calendarCoreMetrics(raw);
  const hs=core.hs;
  const sim=core.sim;
  const home=core.home;
  const second=(d.matrix?.[7]||[]).reduce((a,v)=>a+Number(v||0),0)+Object.values(d.groups?.bundle2nd||{}).reduce((a,v)=>a+Number(v||0),0);
  const free=Number(d.groups?.homeFlat?.tvFree||0);
  const smart=Number(d.groups?.homeFlat?.smartHome||0);
  const tailored=Number(d.tailoredCount||0);
  const tailoredAmount=Number(d.tailoredAmount||0);
  const sono=Object.values(d.groups?.sono||{}).reduce((a,v)=>a+Number(v||0),0);
  return {hs,sim,home,second,free,smart,tailored,tailoredAmount,sono,has:dayHasData(d),off:!!d.dayOff};
}

function DailyBriefingPanel({month,rows=[],dailyRecords={},employees=[],authUserId='',config}){
  const defaultDay=()=>{
    const now=new Date(),yesterday=new Date(now.getFullYear(),now.getMonth(),now.getDate()-1);
    if(monthKeyOf(yesterday)===month)return String(yesterday.getDate()).padStart(2,'0');
    if(month<monthKeyOf(now))return String(daysInMonth(month)).padStart(2,'0');
    return '01';
  };
  const [selectedDay,setSelectedDay]=useState(defaultDay);
  const [storeKey,setStoreKey]=useState('all');
  const [goalRows,setGoalRows]=useState([]);
  const [scheduleRows,setScheduleRows]=useState({tasks:[],homes:[],customers:[]});
  const [loading,setLoading]=useState(true);
  const [reminderSending,setReminderSending]=useState(false);
  useEffect(()=>{setSelectedDay(defaultDay());setStoreKey('all')},[month]); // eslint-disable-line
  useEffect(()=>{
    let alive=true;
    (async()=>{
      setLoading(true);
      const employeeIds=[...new Set([...employees,...rows.filter(row=>!row.teamOnly)].map(emp=>emp.id).filter(Boolean))];
      const [{data,error},taskResult,homeResult,customerResult]=await Promise.all([
        supabase.from('store_goals').select('store_name,company_goals,challenge_goals').eq('month',month),
        employeeIds.length?supabase.from('customer_tasks').select('id,user_id,customer_id,title,due_date,status').in('user_id',employeeIds):Promise.resolve({data:[]}),
        employeeIds.length?readAllPages(()=>supabase.from('home_orders').select('id,user_id,customer_id,customer_name,planned_install_date,status,source_work_date,actual_install_date,product_type,network_type,sale_type,main_tv_plan,source_group,source_key').in('user_id',employeeIds).order('id')):Promise.resolve({data:[]}),
        employeeIds.length?supabase.from('customers').select('id,user_id,customer_name').in('user_id',employeeIds):Promise.resolve({data:[]}),
      ]);
      if(!alive)return;
      const scheduleError=taskResult.error||homeResult.error||customerResult.error;
      if(error||scheduleError)showLegacyAlert(`브리핑 자료 불러오기 실패: ${friendlyError(error||scheduleError)}`);
      setGoalRows(data||[]);
      setScheduleRows({tasks:taskResult.data||[],homes:homeResult.data||[],customers:customerResult.data||[]});
      setLoading(false);
    })();
    return()=>{alive=false};
  },[month,employees.map(emp=>emp.id).join('|'),rows.filter(row=>!row.teamOnly).map(row=>row.id).join('|')]); // eslint-disable-line

  const goalMap=Object.fromEntries(goalRows.map(row=>[row.store_name,resolveStoreBriefingGoals({
    defaults:companyGoalDefaults(row.store_name),
    companyGoals:row.company_goals,
    challengeGoals:row.challenge_goals,
  })]));
  const branches=sortStoresByOpenOrder([...new Set([...employees,...rows].map(emp=>emp.branch).filter(Boolean).filter(branch=>!NON_SALES_STORES.includes(branch)))]);
  const reportDay=Math.max(1,Number(selectedDay||1));
  const periodRows=useMemo(()=>buildBriefingPeriodRows({rows,dailyRecords,orders:scheduleRows.homes,month,reportDay,
    rebuild:(row,days,completedOrders)=>{
      const draft=applyDailyToDraft(emptyDraft(),days,month,config.categoryMap,config.gibyeonColumnMap);
      draft.homePolicy=row.draft?.homePolicy?.source==='orders'||completedOrders.length
        ?calculateHomePolicyEngine(completedOrders,config):null;
      return {...row,draft,pay:computePay(draft,row.position,row.hireDate,month,config)};
    },
  }),[rows,dailyRecords,scheduleRows.homes,month,reportDay,config]);
  const forecastFactor=monthKeyOf(new Date())===month?daysInMonth(month)/reportDay:1;
  const dateLabel=`${Number(month.slice(5,7))}월 ${reportDay}일`;
  const briefingNow=new Date();
  const today=`${monthKeyOf(briefingNow)}-${String(briefingNow.getDate()).padStart(2,'0')}`;
  const employeeMap=Object.fromEntries((employees||[]).map(emp=>[emp.id,emp]));
  const customerMap=Object.fromEntries(scheduleRows.customers.map(customer=>[customer.id,customer]));
  const activeTasks=scheduleRows.tasks.filter(task=>task.status!=='completed'&&task.status!=='cancelled');
  const pendingHomeBundles=new Map();
  scheduleRows.homes.filter(order=>order.status!=='completed'&&order.status!=='cancelled').forEach(order=>{
    const key=`${order.user_id}|${order.source_work_date||''}|${order.customer_id||order.customer_name||order.id}`;
    if(!pendingHomeBundles.has(key))pendingHomeBundles.set(key,order);
  });
  const pendingHomes=[...pendingHomeBundles.values()];
  const metricDefs=[
    {key:'hs',label:'HS',unit:'count',goal:(g)=>g.hs},
    {key:'simMnp',label:'SIM MNP',unit:'count',goal:(g)=>g.simMnp},
    {key:'second',label:'2ND',unit:'count',goal:(g)=>g.second},
    {key:'productivity',label:'생산성',unit:'point',goal:(g)=>g.productivity||g.kpi},
    {key:'home',label:'홈',unit:'count',goal:(g)=>g.home},
    {key:'free',label:'프리',unit:'count',goal:(g)=>g.tvFree||g.free},
    {key:'smart',label:'스홈',unit:'count',goal:(g)=>g.smartHome||g.smart},
    {key:'sono',label:'소노',unit:'count',goal:(g)=>g.sono},
    {key:'upsellAmount',label:'맞춤제안 매출액',unit:'won',goal:(g)=>g.tailoredAmount},
    {key:'upsell',label:'업셀건',unit:'count',goal:(g)=>g.tailoredCount||g.tailored},
  ];
  const fmtBriefValue=(metric,value)=>metric.unit==='won'?won(Math.round(value)):metric.unit==='point'?`${fmtNum(value,1)}P`:`${fmtNum(value,Number(value)%1?1:0)}건`;
  const briefingStores=branches.map(branch=>{
    const members=(employees||[]).filter(emp=>emp.branch===branch);
    const storeRows=periodRows.filter(row=>row.branch===branch);
    const goal=goalMap[branch]||companyGoalDefaults(branch);
    const inputRows=members.map(emp=>{
      const raw=dailyRecords?.[emp.id]?.[selectedDay];
      const d=normalizeDay(raw),daily=dailyCalendarMetrics(raw);
      const status=dailyInputStatus({dayOff:d.dayOff,hasPerformance:dayHasPerformanceData(raw),zeroConfirmed:d.inputConfirmed});
      const parts=[['HS',daily.hs],['SIM MNP',daily.sim],['2ND',daily.second],['홈',daily.home],['프리',daily.free],['스홈',daily.smart],['소노',daily.sono],['업셀',daily.tailored]].filter(([,value])=>Number(value)>0).map(([label,value])=>`${label} ${fmtNum(value,Number(value)%1?1:0)}`);
      return {userId:emp.id,name:emp.name,status,summary:parts.length?parts.join(' · '):'기타 실적 입력'};
    });
    const metrics=metricDefs.map(def=>({
      key:def.key,label:def.label,unit:def.unit,
      ...projectMetric({current:storeMetricFromRows(storeRows,def.key),target:Number(def.goal(goal)||0),factor:forecastFactor}),
    }));
    const memberIds=new Set(members.map(emp=>emp.id));
    const todayTasks=activeTasks.filter(task=>memberIds.has(task.user_id)&&task.due_date===today).map(task=>({
      ...task,employeeName:employeeMap[task.user_id]?.name||'',customerName:customerMap[task.customer_id]?.customer_name||'고객명 미입력',
    }));
    const homeRows=pendingHomes.filter(order=>memberIds.has(order.user_id)).map(order=>({
      ...order,employeeName:employeeMap[order.user_id]?.name||'',customerName:order.customer_name||customerMap[order.customer_id]?.customer_name||'고객명 미입력',plannedDate:String(order.planned_install_date||'').slice(0,10),
    }));
    const todayInstalls=homeRows.filter(order=>order.plannedDate===today);
    const overdueInstalls=homeRows.filter(order=>isBriefingMonthOverdueHome(order,month,today));
    return {storeName:displayStoreName(branch),branch,inputRows,metrics,todayTasks,todayInstalls,overdueInstalls};
  });
  const visibleStores=storeKey==='all'?briefingStores:briefingStores.filter(store=>store.branch===storeKey);
  const allInputRows=briefingStores.flatMap(store=>store.inputRows);
  const count=(status)=>allInputRows.filter(row=>row.status===status).length;
  const copyText=async(text,label)=>{
    try{
      if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(text);
      else{const area=document.createElement('textarea');area.value=text;area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();document.execCommand('copy');area.remove();}
      showAppToast(`${label} 복사했어요`,{title:'복사 완료'});
    }catch(e){showLegacyAlert(`복사 실패: ${friendlyError(e)}`)}
  };
  const shareBriefing=async(text,title)=>{
    try{
      if(navigator.share){await navigator.share({title,text});return}
      await copyText(text,title);
      showAppToast('카카오톡 대화창에 붙여넣어 주세요.',{title:'브리핑 복사 완료',tone:'info'});
    }catch(e){if(e?.name!=='AbortError')showLegacyAlert(`공유 실패: ${friendlyError(e)}`)}
  };
  const sendInputReminders=async(targetStores)=>{
    const targets=(targetStores||visibleStores).flatMap(store=>store.inputRows
      .filter(row=>row.status==='missing'&&row.userId)
      .map(row=>({...row,storeName:store.storeName})));
    const unique=[...new Map(targets.map(row=>[row.userId,row])).values()];
    if(!unique.length)return showAppToast('선택한 범위에는 미입력 직원이 없어요.',{title:'알림 대상 없음',tone:'info'});
    const confirmed=await showAppConfirm({title:'실적 입력 알림 보내기',message:`미입력 직원 ${unique.length}명에게 ${dateLabel} 실적 입력 알림을 보낼까요?`,confirmLabel:'알림 보내기'});
    if(!confirmed)return;
    setReminderSending(true);
    const reportDate=`${month}-${String(reportDay).padStart(2,'0')}`;
    const notifications=unique.map(row=>({
      recipient_id:row.userId,actor_id:authUserId,type:'daily_input_reminder',
      title:'오늘 실적을 입력해주세요 ✍️',
      message:`${dateLabel} ${row.storeName} 실적이 아직 확인되지 않았어요. 실적이 없으면 0건 확인을 눌러주세요.`,
      payload:{screen:'daily',reportDate,url:'/?open=daily'},
    }));
    const {error}=await supabase.from('notifications').insert(notifications);
    setReminderSending(false);
    if(error)return showLegacyAlert(`입력 알림 발송 실패: ${friendlyError(error)}`);
    showAppToast(`${unique.length}명에게 실적 입력 알림을 보냈어요.`,{title:'알림 발송 완료'});
  };

  return <div className="space-y-3">
    <div className="bg-gradient-to-br from-brand-600 to-brand-600 rounded-2xl p-4 text-white">
      <div><div className="text-xs text-brand-200">대표 전용</div><div className="text-lg font-black mt-0.5">{dateLabel} 일일 브리핑</div><div className="text-[10px] text-brand-200 mt-1">오전 {DAILY_BRIEFING_SEND_TIME} 기준 · 카카오 전달과 미입력 알림을 바로 보낼 수 있어요.</div></div>
      <div className="grid grid-cols-4 gap-1.5 mt-4">{[['입력',count('input')],['0건 확인',count('zero')],['미입력',count('missing')],['휴무',count('off')]].map(([label,value])=><div key={label} className="rounded-xl bg-white/10 px-2 py-2 text-center"><div className="text-[9px] text-brand-100">{label}</div><div className="text-base font-black mt-0.5">{value}명</div></div>)}</div>
      <div className="grid grid-cols-2 gap-2 mt-3"><button type="button" onClick={()=>shareBriefing(buildAllBriefingText({dateLabel,stores:visibleStores}),`${dateLabel} 일일 브리핑`)} className="flex items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2.5 text-xs font-bold text-brand-700"><Share2 size={14}/>카카오로 전달</button><button type="button" disabled={reminderSending} onClick={()=>sendInputReminders()} className="flex items-center justify-center gap-1.5 rounded-xl bg-brand-500 px-3 py-2.5 text-xs font-bold text-white disabled:opacity-50"><Send size={14}/>{reminderSending?'보내는 중':'미입력 알림'}</button></div>
    </div>

    <div className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-2">
      <select value={selectedDay} onChange={e=>setSelectedDay(e.target.value)} className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold">{Array.from({length:daysInMonth(month)},(_,i)=>String(i+1).padStart(2,'0')).map(day=><option key={day} value={day}>{Number(month.slice(5,7))}월 {Number(day)}일</option>)}</select>
      <select value={storeKey} onChange={e=>setStoreKey(e.target.value)} className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold"><option value="all">전체 매장</option>{branches.map(branch=><option key={branch} value={branch}>{displayStoreName(branch)}</option>)}</select>
    </div>

    {loading?<div className="bg-white rounded-xl border p-8 text-center text-xs text-gray-400">브리핑을 만드는 중...</div>:visibleStores.map(store=>{
      const missing=store.inputRows.filter(row=>row.status==='missing');
      const zero=store.inputRows.filter(row=>row.status==='zero');
      const setMetrics=store.metrics.filter(metric=>metric.state!=='unset');
      const good=setMetrics.filter(metric=>metric.state==='good').sort((a,b)=>b.forecastRate-a.forecastRate);
      const weak=setMetrics.filter(metric=>metric.state!=='good').sort((a,b)=>a.forecastRate-b.forecastRate);
      const unset=store.metrics.filter(metric=>metric.state==='unset');
      return <div key={store.branch} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-50 flex items-start justify-between gap-3">
          <div><div className="text-sm font-black text-gray-900">{store.storeName}</div><div className="text-[10px] text-gray-400 mt-1">예상 달성 {good.length}/{setMetrics.length}개 · 미입력 {missing.length}명 · 0건 확인 {zero.length}명</div></div>
          <div className="flex gap-1.5"><button type="button" onClick={()=>shareBriefing(buildStoreBriefingText({dateLabel,...store}),`${store.storeName} 브리핑`)} className="flex items-center gap-1 rounded-lg bg-brand-50 px-2.5 py-2 text-[10px] font-bold text-brand-700"><Share2 size={12}/>카카오 전달</button>{missing.length>0&&<button type="button" disabled={reminderSending} onClick={()=>sendInputReminders([store])} className="flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-2 text-[10px] font-bold text-red-600 disabled:opacity-50"><Send size={12}/>입력 알림</button>}</div>
        </div>
        {(missing.length>0||zero.length>0)&&<div className="px-4 py-3 bg-red-50/60 text-[10px] leading-5"><div className="text-red-600"><b>미입력</b> {missing.length?missing.map(row=>row.name).join(', '):'없음'}</div>{zero.length>0&&<div className="text-brand-600"><b>0건 확인</b> {zero.map(row=>row.name).join(', ')}</div>}</div>}
        <div className="border-b border-gray-50 px-4 py-3">
          <div className="text-[10px] font-bold text-brand-700">오늘 할 일 · 일정</div>
          <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
            {[['고객 약속',store.todayTasks.length,'text-brand-700'],['홈 설치',store.todayInstalls.length,'text-blue-700'],['설치 지연',store.overdueInstalls.length,store.overdueInstalls.length?'text-red-600':'text-gray-400']].map(([label,value,tone])=><div key={label} className="rounded-xl bg-gray-50 px-2 py-2"><div className={`text-base font-black ${tone}`}>{value}건</div><div className="text-[9px] text-gray-500">{label}</div></div>)}
          </div>
          {(store.todayTasks.length>0||store.todayInstalls.length>0||store.overdueInstalls.length>0)&&<div className="mt-2 space-y-1 text-[10px] leading-relaxed text-gray-600">
            {store.todayTasks.length>0&&<div><b>약속</b> · {store.todayTasks.map(row=>`${row.customerName}(${row.title}${row.employeeName?` · ${row.employeeName}`:''})`).join(', ')}</div>}
            {store.todayInstalls.length>0&&<div><b>오늘 설치</b> · {store.todayInstalls.map(row=>`${row.customerName}${row.employeeName?`(${row.employeeName})`:''}`).join(', ')}</div>}
            {store.overdueInstalls.length>0&&<div className="text-red-600"><b>예정일 경과·미완료</b> · {store.overdueInstalls.map(row=>`${row.customerName}(${row.plannedDate}${row.employeeName?` · ${row.employeeName}`:''})`).join(', ')}</div>}
          </div>}
        </div>
        <div className="p-4 grid sm:grid-cols-2 gap-3">
          <div className="rounded-xl bg-emerald-50 p-3"><div className="text-[10px] font-bold text-emerald-700">잘하고 있는 항목</div><div className="mt-2 space-y-1.5">{good.length?good.slice(0,3).map(metric=><div key={metric.key} className="flex justify-between gap-2 text-[10px]"><span className="font-semibold text-gray-700">{metric.label}</span><span className="font-bold text-emerald-700">예상 {fmtBriefValue(metric,metric.forecast)} · {Math.round(metric.forecastRate)}%</span></div>):<div className="text-[10px] text-gray-400">예상 달성 항목이 아직 없어요.</div>}</div></div>
          <div className="rounded-xl bg-amber-50 p-3"><div className="text-[10px] font-bold text-amber-700">보완할 항목</div><div className="mt-2 space-y-1.5">{weak.length?weak.slice(0,3).map(metric=><div key={metric.key} className="flex justify-between gap-2 text-[10px]"><span className="font-semibold text-gray-700">{metric.label}</span><span className={`font-bold ${metric.state==='low'?'text-red-600':'text-amber-700'}`}>예상 {fmtBriefValue(metric,metric.forecast)} · {Math.round(metric.forecastRate)}%</span></div>):<div className="text-[10px] text-gray-400">목표 설정 항목은 모두 달성 흐름이에요.</div>}</div></div>
        </div>
        {unset.length>0&&<div className="px-4 pb-4 text-[10px] text-red-500"><b>목표 입력 필요:</b> {unset.map(metric=>metric.label).join(', ')}</div>}
      </div>;
    })}
  </div>;
}

function AdminPerformanceCalendar({ month, employees, dailyRecords, canSwitchStores=false, storeKey, onStoreChange }) {
  const availableStores=useMemo(()=>sortStoresByOpenOrder((employees||[]).map(e=>e.branch).filter(Boolean).filter(b=>!NON_SALES_STORES.includes(b))),[employees]);
  const [selectedDay,setSelectedDay]=useState(()=>{
    const now=new Date();
    return monthKeyOf(now)===month?String(now.getDate()).padStart(2,'0'):'01';
  });

  useEffect(()=>{
    const now=new Date();
    setSelectedDay(monthKeyOf(now)===month?String(now.getDate()).padStart(2,'0'):'01');
  },[month]);

  const scopeBranches=dashboardScopeBranches(storeKey,availableStores,SALES_AREA_STORES);
  const areaOptions=dashboardAreaOptions(availableStores,SALES_AREA_STORES,SALES_AREA_LABELS);
  const scoped=(employees||[]).filter(e=>scopeBranches.includes(e.branch)&&!NON_SALES_STORES.includes(e.branch));
  const n=daysInMonth(month);

  const daySummary=(dayKey)=>{
    const total={hs:0,sim:0,home:0,second:0,free:0,smart:0,tailored:0,input:0,off:0};
    scoped.forEach(emp=>{
      const m=dailyCalendarMetrics(dailyRecords?.[emp.id]?.[dayKey]);
      total.hs+=m.hs; total.sim+=m.sim; total.home+=m.home; total.second+=m.second; total.free+=m.free; total.smart+=m.smart; total.tailored+=m.tailored;
      if(emp.active!==false&&m.has)total.input+=1;
      if(emp.active!==false&&m.off)total.off+=1;
    });
    return total;
  };

  const selected=daySummary(selectedDay);
  const employeeDetails=scoped.map(emp=>({emp,...dailyCalendarMetrics(dailyRecords?.[emp.id]?.[selectedDay])}))
    .sort((a,b)=>(b.hs+b.sim+b.home)-(a.hs+a.sim+a.home)||a.emp.name.localeCompare(b.emp.name));

  return <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
    <div className="px-4 py-3 border-b border-gray-50 flex items-start justify-between gap-3">
      <div>
        <div className="text-xs text-gray-400">날짜별 매장 성과</div>
        <div className="text-base font-bold text-gray-900">{monthLabel(month)} 성과 달력</div>
        <div className="text-[10px] text-gray-400 mt-1">달력에는 HS · SIM MNP · 홈만 간단히 표시해요.</div>
      </div>
      {canSwitchStores ? (
        <select value={storeKey} aria-label="운영 현황 매장" onChange={e=>onStoreChange(e.target.value)} className="max-w-[150px] text-xs font-semibold bg-white border border-gray-200 rounded-lg px-2 py-2">
          <option value="all">전체 매장</option>
          {areaOptions.map(area=><option key={area.key} value={area.key}>{area.label}</option>)}
          {availableStores.map(b=><option key={b} value={b}>{displayStoreName(b)}</option>)}
        </select>
      ) : (
        <div className="text-xs font-semibold text-brand-700 bg-brand-50 rounded-lg px-2.5 py-2">{displayStoreName(storeKey)}</div>
      )}
    </div>

    <div className="p-3">
      <div className="grid grid-cols-7 gap-1.5 mb-1.5">
        {['일','월','화','수','목','금','토'].map((w,i)=><div key={w} className={`text-center text-[10px] font-semibold py-1 ${i===0?'text-red-400':i===6?'text-blue-400':'text-gray-400'}`}>{w}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({length:new Date(Number(month.slice(0,4)),Number(month.slice(5,7))-1,1).getDay()}).map((_,i)=><div key={`blank-${i}`} className="aspect-square"/>)}
        {Array.from({length:n},(_,i)=>i+1).map(d=>{
          const key=String(d).padStart(2,'0');
          const x=daySummary(key);
          const active=x.hs>0||x.sim>0||x.home>0;
          const sel=key===selectedDay;
          const dow=new Date(Number(month.slice(0,4)),Number(month.slice(5,7))-1,d).getDay();
          return <button key={d} type="button" onClick={()=>setSelectedDay(key)}
            className={`min-w-0 h-[58px] sm:h-[64px] rounded-lg flex flex-col items-center justify-start pt-2.5 px-0.5 overflow-hidden ${sel?'bg-brand-600 text-white':active?'bg-brand-50 text-brand-700':dow===0?'bg-red-50/50 text-red-400':dow===6?'bg-blue-50/50 text-blue-400':'bg-gray-50 text-gray-500'}`}>
            <div className="text-[10px] font-semibold leading-none shrink-0">{d}</div>
            <div className={`h-[32px] mt-1.5 text-[6.5px] sm:text-[7px] leading-[9px] font-semibold text-center whitespace-nowrap shrink-0 ${sel?'text-white/90':'text-gray-600'}`}>
              <div className={x.hs>0?'':'invisible'}>HS {fmtCount(x.hs)}</div>
              <div className={x.sim>0?'':'invisible'}>SIM MNP {fmtCount(x.sim)}</div>
              <div className={x.home>0?'':'invisible'}>홈 {fmtCount(x.home)}</div>
            </div>
          </button>;
        })}
      </div>
    </div>

    <div className="border-t border-gray-100">
      <div className="px-4 py-3 bg-gray-50/70">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-gray-800">{parseInt(selectedDay,10)}일 상세</div>
          <div className="text-[10px] text-gray-400">입력 {fmtCount(selected.input)}명 · 미입력 {fmtCount(Math.max(0,activeRoster(scoped).length-selected.input-selected.off))}명 · 휴무 {fmtCount(selected.off)}명</div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-2">
          {[['HS',selected.hs],['SIM MNP',selected.sim],['홈',selected.home],['2ND',selected.second],['프리',selected.free],['스홈',selected.smart]].map(([label,value])=><div key={label} className="rounded-lg bg-white border border-gray-100 px-2 py-2 text-center"><div className="text-[9px] text-gray-400">{label}</div><div className="text-xs font-bold text-gray-800 mt-0.5">{fmtCount(value)}건</div></div>)}
        </div>
      </div>
      <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
        {employeeDetails.map(({emp,hs,sim,home,has,off})=><div key={emp.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="min-w-0"><div className="text-xs font-semibold text-gray-700 truncate">{emp.name}{emp.active===false?' · 비활성':''}</div><div className="text-[9px] text-gray-400">{emp.active===false?'이전 실적':off?'휴무':has?'입력 완료':'미입력'}</div></div>
          <div className="text-[10px] text-gray-500 text-right shrink-0">{off?'—':`HS ${fmtCount(hs)} · SIM MNP ${fmtCount(sim)} · 홈 ${fmtCount(home)}`}</div>
        </div>)}
      </div>
    </div>
  </div>;
}


function PerformanceCheckPanel({ month, rows, dailyRecords, employees }) {
  const [selectedDay,setSelectedDay]=useState(()=>{
    const now=new Date();return monthKeyOf(now)===month?String(now.getDate()).padStart(2,'0'):'01';
  });
  const [verifiedMap,setVerifiedMap]=useState({});
  useEffect(()=>{
    (async()=>{
      const {data}=await supabase.from('manager_eval_monthly').select('store_name,verified_metrics,verified_at').eq('month',month);
      const map={};(data||[]).forEach(x=>map[x.store_name]=x);setVerifiedMap(map);
    })();
  },[month]);
  const workRows=(rows||[]).filter(r=>!NON_SALES_STORES.includes(r.branch));
  const missing=workRows.filter(r=>r.active!==false&&!r.teamOnly&&!dayHasData(dailyRecords?.[r.id]?.[selectedDay]));
  const duplicates=[];
  // 같은 날짜에 동일 고객명이 2개 이상인 건은 실제 중복 여부를 점검하도록 안내
  const [duplicateRows,setDuplicateRows]=useState([]);
  useEffect(()=>{
    (async()=>{
      const date=`${month}-${selectedDay}`;
      const ids=workRows.map(r=>r.id);if(!ids.length){setDuplicateRows([]);return;}
      const {data}=await supabase.from('customer_sales').select('user_id,customer_id,metric_label,customers(customer_name)').in('user_id',ids).eq('sale_date',date);
      const groups={};(data||[]).forEach(x=>{const k=`${x.user_id}|${x.customer_id||x.customers?.customer_name||''}`;(groups[k]||(groups[k]=[])).push(x);});
      setDuplicateRows(Object.entries(groups).filter(([,arr])=>arr.length>=2).map(([k,arr])=>({userId:k.split('|')[0],customer:arr[0]?.customers?.customer_name||'이름 없음',count:arr.length,labels:arr.map(x=>x.metric_label)})));
    })();
  },[month,selectedDay,rows]);

  return <div className="space-y-3">
    <div className="bg-white rounded-xl border p-4">
      <div className="flex justify-between gap-3 items-end"><div><div className="text-xs text-brand-500">실적 정확성 점검</div><div className="text-base font-bold mt-0.5">{monthLabel(month)} 실적 점검</div><div className="text-[10px] text-gray-400 mt-1">승인 대기 대신 미입력·관리자 최신화 차이·중복 가능성을 확인합니다.</div></div><select value={selectedDay} onChange={e=>setSelectedDay(e.target.value)} className="border rounded-lg px-2 py-2 text-xs">{Array.from({length:daysInMonth(month)},(_,i)=>String(i+1).padStart(2,'0')).map(d=><option key={d} value={d}>{Number(d)}일</option>)}</select></div>
    </div>
    <div className="grid grid-cols-3 gap-2">
      <div className="bg-white rounded-xl border p-3"><div className="text-[10px] text-gray-400">미입력 직원</div><div className="text-xl font-bold text-red-500 mt-1">{missing.length}명</div></div>
      <div className="bg-white rounded-xl border p-3"><div className="text-[10px] text-gray-400">중복 확인 필요</div><div className="text-xl font-bold text-amber-600 mt-1">{duplicateRows.length}건</div></div>
      <div className="bg-white rounded-xl border p-3"><div className="text-[10px] text-gray-400">관리자 최신화 매장</div><div className="text-xl font-bold text-brand-700 mt-1">{Object.keys(verifiedMap).length}개</div></div>
    </div>
    {missing.length>0&&<div className="bg-white rounded-xl border overflow-hidden"><div className="px-4 py-3 border-b font-bold text-sm">{Number(selectedDay)}일 미입력</div>{missing.map(r=><div key={r.id} className="px-4 py-2.5 border-b last:border-0 flex justify-between text-xs"><span><b>{r.name}</b> · {displayStoreName(r.branch)}</span><span className="text-red-500">입력 없음</span></div>)}</div>}
    <div className="bg-white rounded-xl border overflow-hidden"><div className="px-4 py-3 border-b"><div className="font-bold text-sm">직원 입력 vs 관리자 확인</div><div className="text-[10px] text-gray-400 mt-1">평가의 ‘실적 최신화’에서 저장한 관리자 확인값과 현재 직원 입력 누적을 비교합니다.</div></div>{workRows.map(r=>{const v=verifiedMap[r.branch]?.verified_metrics; if(!v)return null; const hs=hsCount(r.draft),home=completedHomeCount(r.draft);return <div key={r.id} className="px-4 py-2.5 border-b last:border-0 text-xs"><div className="font-semibold">{r.name} · {displayStoreName(r.branch)}</div><div className="text-[10px] text-gray-500 mt-1">직원입력 HS {fmtCount(hs)} / 홈 {fmtCount(home)} · 매장 관리자확인 HS {fmtCount(v.hs||0)} / 홈 {fmtCount(v.home||0)}</div></div>})}</div>
    {duplicateRows.length>0&&<div className="bg-amber-50 rounded-xl border border-amber-100 overflow-hidden"><div className="px-4 py-3 font-bold text-sm text-amber-800">중복 가능 판매건</div>{duplicateRows.map((x,i)=>{const emp=(employees||[]).find(e=>e.id===x.userId);return <div key={i} className="px-4 py-2.5 border-t border-amber-100 text-xs"><b>{emp?.name||'직원'}</b> · {x.customer} · {x.count}개 항목 <span className="text-gray-400">({x.labels.join(' / ')})</span></div>})}</div>}
  </div>;
}


function AdminExpenseOverview({month,employees=[],loginBranch='',canSwitchStores=false}){
  const scoped=(employees||[]).filter(e=>canSwitchStores||!loginBranch?true:e.branch===loginBranch);
  const [rows,setRows]=useState([]),[loading,setLoading]=useState(true),[loadError,setLoadError]=useState('');
  useEffect(()=>{
    const ids=scoped.map(e=>e.id);
    if(!ids.length){setRows([]);setLoadError('');setLoading(false);return}
    (async()=>{
      setLoading(true);setLoadError('');
      const [y,m]=month.split('-').map(Number),n=new Date(y,m,1),to=`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-01`;
      const {data,error}=await supabase.from('sales_expenses').select('*').is('voided_at',null).in('user_id',ids).gte('expense_date',`${month}-01`).lt('expense_date',to).order('expense_date',{ascending:false});
      if(error){console.error('ADMIN EXPENSE LOAD ERROR',error);setRows([]);setLoadError(friendlyError(error));}
      else setRows(data||[]);
      setLoading(false);
    })();
  },[month,scoped.map(e=>e.id).join('|')]);
  const total=rows.reduce((a,x)=>a+Number(x.amount||0),0);
  return <div className="space-y-3"><div><div className="text-xs text-brand-600 font-semibold">영업비용 / 오퍼</div><div className="text-xl font-bold">{monthLabel(month)} · {won(total)}</div><div className="text-[10px] text-gray-400 mt-1">관리범위 직원이 입력한 영업비용을 확인합니다.</div></div><div className="bg-white rounded-xl border overflow-hidden">{loading?<div className="p-4 text-sm text-gray-400">불러오는 중...</div>:loadError?<div className="p-4"><div className="text-sm font-bold text-red-500">영업비용을 불러오지 못했어요.</div><div className="text-[11px] text-red-400 mt-1">{loadError}</div><div className="text-[10px] text-gray-400 mt-2">Supabase의 sales_expenses 조회 정책(RLS)을 확인해주세요.</div></div>:rows.length===0?<div className="p-4 text-sm text-gray-400">등록된 영업비용이 없어요.</div>:rows.map(x=>{const e=scoped.find(v=>v.id===x.user_id);return <div key={x.id} className="p-3 border-b last:border-0"><div className="flex justify-between gap-2"><div><div className="text-sm font-bold">{e?.name||'직원'} <span className="font-normal text-gray-400">· {displayStoreName(e?.branch)}</span></div><div className="text-[11px] text-gray-500 mt-1">{x.expense_date} · {x.customer_name||'이름 없음'} · {x.category||'기타'}{x.memo?` · ${x.memo}`:''}</div></div><b className="text-red-500 shrink-0">-{won(x.amount)}</b></div></div>})}</div></div>
}

const HEAD_OFFICE_EXTRA_FIELDS = [
  ['home','홈'],['tv','TV(부)'],['subSetTop','부셋탑'],['smartHome','스마트홈'],
  ['internetRenew','인터넷 재약정'],['tvRenew','TV 재약정'],['sono','소노'],
];
function emptyHeadOfficeMetrics(){ return {matrix:emptyDayMatrix(),...Object.fromEntries(HEAD_OFFICE_EXTRA_FIELDS.map(([k])=>[k,0]))}; }
function normalizeHeadOfficeMetrics(raw={}){
  const base=emptyHeadOfficeMetrics();
  const matrix=emptyDayMatrix();
  (raw.matrix||[]).forEach((row,ri)=>(row||[]).forEach((v,ci)=>{if(matrix[ri]&&ci<matrix[ri].length)matrix[ri][ci]=Number(v||0)}));
  return {...base,...raw,matrix};
}
function matrixTotalAt(matrix,ri){return (matrix?.[ri]||[]).reduce((s,v)=>s+Number(v||0),0)}
function headOfficeScores(metrics,config,month){
  const d=emptyDay();d.matrix=normalizeHeadOfficeMetrics(metrics).matrix;
  const merged=applyDailyToDraft(emptyDraft(),{'01':d},month,config.categoryMap,config.gibyeonColumnMap);
  const pay=computePay(merged,'기타','2000-01-01',month,config,0);
  const kpiRate=(key)=>Number((config.kpiItems||DEFAULT_KPI_ITEMS).find(x=>x.key===key)?.point||0);
  const extraKpi=Number(metrics.home||0)*kpiRate('kpiHome')+Number(metrics.tv||0)*kpiRate('kpiTv')
    +Number(metrics.subSetTop||0)*kpiRate('kpiTvSetTop')+Number(metrics.smartHome||0)*kpiRate('kpiSmartHome')
    +Number(metrics.internetRenew||0)*kpiRate('kpiInternetRenew')+Number(metrics.tvRenew||0)*kpiRate('kpiTvRenew');
  const homeGradePoints=Number(metrics.home||0)+Number(metrics.tv||0)+Number(metrics.smartHome||0)*0.5;
  const gradePoints=pay.mobilePoints+(pay.mobilePoints>ADDON_GATE?homeGradePoints:0);
  return {gradePoints,kpiScore:pay.kpiScore+extraKpi,hs:[0,1,2,3,4].reduce((s,ri)=>s+matrixTotalAt(metrics.matrix,ri),0),second:matrixTotalAt(metrics.matrix,7)};
}

function HeadOfficeDataPanel({month,employees,rows,config,authUserId}){
  const salesEmployees=(employees||[]).filter(e=>!NON_SALES_STORES.includes(e.branch));
  const stores=sortStoresByOpenOrder([...new Set(salesEmployees.map(e=>e.branch))]);
  const [mode,setMode]=useState('store'),[personalRecords,setPersonalRecords]=useState({}),[storeRecords,setStoreRecords]=useState({});
  const [selectedStore,setSelectedStore]=useState(stores[0]||''),[selectedId,setSelectedId]=useState(salesEmployees[0]?.id||'');
  const defaultAsOf=()=>`${month}-${String(Math.min(new Date().getDate(),daysInMonth(month))).padStart(2,'0')}`;
  const [asOfDate,setAsOfDate]=useState(defaultAsOf());
  const [metrics,setMetrics]=useState(emptyHeadOfficeMetrics()),[vasReview,setVasReview]=useState({}),[note,setNote]=useState(''),[saving,setSaving]=useState(false),[loading,setLoading]=useState(true);
  const load=useCallback(async()=>{setLoading(true);const [p,s]=await Promise.all([supabase.from('head_office_performance').select('*').eq('month',month),supabase.from('head_office_store_performance').select('*').eq('month',month)]);if(p.error||s.error){showLegacyAlert(`본사 데이터 불러오기 실패: ${friendlyError(p.error||s.error)}`)}setPersonalRecords(Object.fromEntries((p.data||[]).map(x=>[x.user_id,x])));setStoreRecords(Object.fromEntries((s.data||[]).map(x=>[x.store_name,x])));setLoading(false)},[month]);
  useEffect(()=>{load()},[load]);
  useEffect(()=>{setAsOfDate(defaultAsOf())},[month]); // eslint-disable-line
  const visible=salesEmployees.filter(e=>e.branch===selectedStore);
  useEffect(()=>{if(visible.length&&!visible.some(e=>e.id===selectedId))setSelectedId(visible[0].id)},[selectedStore,visible.map(e=>e.id).join('|')]); // eslint-disable-line
  const selected=salesEmployees.find(e=>e.id===selectedId);
  const targetRecord=mode==='store'?storeRecords[selectedStore]:personalRecords[selectedId];
  useEffect(()=>{setMetrics(normalizeHeadOfficeMetrics(targetRecord?.metrics||{}));setVasReview(targetRecord?.vas_review||{});setNote(targetRecord?.note||'');setAsOfDate(targetRecord?.as_of_date||defaultAsOf())},[mode,selectedStore,selectedId,targetRecord]); // eslint-disable-line
  const targetRows=mode==='store'?(rows||[]).filter(r=>r.branch===selectedStore):(rows||[]).filter(r=>r.id===selectedId);
  const inputMatrix=emptyDayMatrix();
  targetRows.forEach(r=>(r.draft?.matrix||[]).forEach((arr,ri)=>(arr||[]).forEach((v,ci)=>{if(inputMatrix[ri])inputMatrix[ri][ci]+=Number(v||0)})));
  const bundleCount=targetRows.reduce((s,r)=>s+Object.values(r.draft?.bundle2nd||{}).reduce((a,v)=>a+Number(v||0),0),0);
  const inputExtras={
    home:targetRows.reduce((s,r)=>s+completedHomeCount(r.draft),0),
    tv:targetRows.reduce((s,r)=>s+Number(r.draft?.homeBase?.homeTv||0),0),
    subSetTop:targetRows.reduce((s,r)=>s+Number(r.draft?.homeAddon?.addSetTop||0),0),
    smartHome:targetRows.reduce((s,r)=>s+Number(r.draft?.homeFlat?.smartHome||0),0),
    internetRenew:targetRows.reduce((s,r)=>s+Object.values(r.draft?.renew||{}).reduce((a,v)=>a+Number(v||0),0),0),
    tvRenew:0,
    sono:targetRows.reduce((s,r)=>s+Object.values(r.draft?.sono||{}).reduce((a,v)=>a+Number(v||0),0),0),
  };
  const inputVas={};(config.vas||DEFAULT_VAS).forEach(v=>inputVas[v.key]=targetRows.reduce((s,r)=>s+Number(r.draft?.vas?.[v.key]||0),0));
  const official=headOfficeScores(metrics,config,month);
  const employee={hs:targetRows.reduce((s,r)=>s+hsCount(r.draft||{}),0),second:matrixTotalAt(inputMatrix,7)+bundleCount,gradePoints:targetRows.reduce((s,r)=>s+Number(r.pay?.totalPoints||0),0),kpiScore:targetRows.reduce((s,r)=>s+Number(r.pay?.kpiScore||0),0)};
  const updateMatrix=(ri,ci,value)=>setMetrics(v=>{const matrix=v.matrix.map(r=>[...r]);matrix[ri][ci]=Math.max(0,Number(value||0));return {...v,matrix}});
  const save=async()=>{const isStore=mode==='store';if((isStore&&!selectedStore)||(!isStore&&!selected))return;setSaving(true);const common={month,store_name:isStore?selectedStore:selected.branch,as_of_date:asOfDate,metrics,vas_review:vasReview,note:note.trim()||null,updated_by:authUserId,updated_at:new Date().toISOString()};const payload=isStore?common:{...common,user_id:selected.id};const table=isStore?'head_office_store_performance':'head_office_performance',conflict=isStore?'month,store_name':'month,user_id';const {error}=await supabase.from(table).upsert(payload,{onConflict:conflict});setSaving(false);if(error)return showLegacyAlert(`본사 데이터 저장 실패: ${friendlyError(error)}`);await load();showLegacyAlert(`${isStore?'매장':'개인'} 본사 데이터를 저장했어요. 개인 실적과 급여 계산은 변경하지 않았습니다.`)};
  return <div className="space-y-3">
    <div><div className="text-xs text-brand-600 font-semibold">본사 데이터 기준</div><div className="text-xl font-bold">{mode==='store'?'매장별':'개인별'} 누적 실적 대조</div><div className="text-[10px] text-gray-400 mt-1">매장 기준이 기본입니다. 개인 기준은 개인별 본사 자료가 있을 때만 선택하세요. 급여와 직원 입력 원본은 변경하지 않습니다.</div></div>
    <div className="grid grid-cols-2 bg-gray-100 rounded-xl p-1 gap-1"><button onClick={()=>setMode('store')} className={`py-2.5 rounded-lg text-xs font-bold ${mode==='store'?'bg-white text-brand-700 shadow-sm':'text-gray-500'}`}>매장 기준</button><button onClick={()=>setMode('personal')} className={`py-2.5 rounded-lg text-xs font-bold ${mode==='personal'?'bg-white text-brand-700 shadow-sm':'text-gray-500'}`}>개인 기준</button></div>
    <div className="bg-white border rounded-xl p-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
      <select value={selectedStore} onChange={e=>setSelectedStore(e.target.value)} className="border rounded-lg px-2 py-2 text-xs">{stores.map(s=><option key={s} value={s}>{displayStoreName(s)}</option>)}</select>
      {mode==='personal'?<select value={selectedId} onChange={e=>setSelectedId(e.target.value)} className="border rounded-lg px-2 py-2 text-xs">{visible.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select>:<div className="border rounded-lg px-2 py-2 text-xs text-gray-500 bg-gray-50">직원 입력 합계 {targetRows.length}명</div>}
      <input type="date" value={asOfDate} onChange={e=>setAsOfDate(e.target.value)} className="border rounded-lg px-2 py-2 text-xs"/>
      <button onClick={save} disabled={saving||loading||(mode==='store'?!selectedStore:!selected)} className="rounded-lg bg-brand-600 text-white text-xs font-bold px-3 py-2 disabled:opacity-40">{saving?'저장 중':`${mode==='store'?'매장':'개인'} 본사 데이터 저장`}</button>
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {[['HS',employee.hs,official.hs,'건'],['2ND',employee.second,official.second,'건'],['성과등급P',employee.gradePoints,official.gradePoints,'P'],['생산성P',employee.kpiScore,official.kpiScore,'P']].map(([label,input,head,unit])=><div key={label} className="bg-white border rounded-xl p-3"><div className="text-[10px] text-gray-400">{label}</div><div className="text-sm font-bold mt-1">본사 {fmtNum(head,1)}{unit}</div><div className="text-[10px] text-gray-500 mt-1">직원입력 {fmtNum(input,1)}{unit} · 차이 {Number(head-input)>=0?'+':''}{fmtNum(head-input,1)}{unit}</div></div>)}
    </div>
    <div className="bg-white border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b"><div className="font-bold text-sm">가입유형·요금제군 누적</div><div className="text-[10px] text-gray-400">기변A/B/C를 포함해 본사에서 확인한 {mode==='store'?'매장':'개인'} 월 누적 건수를 입력하세요.</div></div>
      <div className="overflow-x-auto"><table className="min-w-[850px] w-full text-xs"><thead><tr className="bg-gray-50"><th className="text-left p-2 sticky left-0 bg-gray-50">가입유형</th>{MATRIX_COLS.map(c=><th key={c} className="p-2 text-gray-500"><ColHeader label={c}/></th>)}<th className="p-2">직원입력 합계</th><th className="p-2">차이</th></tr></thead><tbody>{MATRIX_ROW_DEFS.map((rd,ri)=>{const input=matrixTotalAt(inputMatrix,ri)+(ri===7?bundleCount:0),head=matrixTotalAt(metrics.matrix,ri);return <tr key={rd.label} className="border-t"><td className="p-2 font-semibold sticky left-0 bg-white whitespace-nowrap">{rd.label}</td>{MATRIX_COLS.map((c,ci)=><td key={c} className="p-1">{rd.hasTiers||ci===0?<input type="number" min="0" value={metrics.matrix[ri]?.[ci]||''} onChange={e=>updateMatrix(ri,ci,e.target.value)} className="w-full min-w-[70px] border rounded px-2 py-1.5 text-right"/>:<div className="text-center text-gray-200">—</div>}</td>)}<td className="p-2 text-right">{fmtCount(input)}</td><td className={`p-2 text-right font-bold ${head-input===0?'text-gray-400':head-input>0?'text-blue-600':'text-red-500'}`}>{head-input>0?'+':''}{fmtCount(head-input)}</td></tr>})}</tbody></table></div>
    </div>
    <div className="bg-white border rounded-xl p-4"><div className="font-bold text-sm">홈·기타 본사 누적</div><div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">{HEAD_OFFICE_EXTRA_FIELDS.map(([key,label])=><label key={key} className="text-[10px] text-gray-500">{label}<input type="number" min="0" value={metrics[key]||''} onChange={e=>setMetrics(v=>({...v,[key]:Math.max(0,Number(e.target.value||0))}))} className="mt-1 w-full border rounded-lg px-2 py-2 text-xs text-right"/><span className="block mt-1 text-[9px] text-gray-400">직원입력 합계 {fmtCount(inputExtras[key]||0)} · 차이 {Number(metrics[key]||0)-Number(inputExtras[key]||0)>0?'+':''}{fmtCount(Number(metrics[key]||0)-Number(inputExtras[key]||0))}</span></label>)}</div></div>
    <div className="bg-white border rounded-xl p-4"><div className="font-bold text-sm">VAS 입력값 · 관리자 검토</div><div className="text-[10px] text-gray-400 mt-1">매출지표에는 직원 입력 VAS를 우선 사용합니다. 검토값은 비교용이며 급여를 변경하지 않습니다.</div><div className="space-y-2 mt-3">{(config.vas||DEFAULT_VAS).map(v=>{const input=Number(inputVas[v.key]||0),reviewed=vasReview[v.key];return <div key={v.key} className="grid grid-cols-[1fr_75px_90px_65px] items-center gap-2"><div className="text-xs text-gray-600 truncate">{v.label}</div><div className="text-[10px] text-gray-400 text-right">입력 {fmtCount(input)}</div><input type="number" min="0" placeholder="검토 전" value={reviewed??''} onChange={e=>setVasReview(prev=>{const next={...prev};if(e.target.value==='')delete next[v.key];else next[v.key]=Math.max(0,Number(e.target.value));return next})} className="border rounded-lg px-2 py-1.5 text-xs text-right"/><div className={`text-[10px] text-right ${reviewed===undefined?'text-gray-300':Number(reviewed)-input===0?'text-gray-400':'text-red-500'}`}>{reviewed===undefined?'미검토':`차이 ${Number(reviewed)-input>0?'+':''}${fmtCount(Number(reviewed)-input)}`}</div></div>})}</div></div>
    <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="본사 반영 시점·차이 사유 메모" className="w-full bg-white border rounded-xl p-3 text-xs min-h-[72px]"/>
  </div>;
}

function AdminView({ adminTab, setAdminTab, months, month, setMonth, rows, rankingRows, dailyRecords, totalPay, pendingCount, approve, rejectApproval, config, persistConfig, employees, addEmployee, updateEmployee, removeEmployee, stores, addStore, removeStore, isFullAdmin, canManagePermissions=false, monthLocked, toggleMonthLock, policyInputBlocked=false, togglePolicyInputBlock, authUserId, loginPosition='', loginBranch='', canSwitchStores=false, canViewHqStructure=false, canViewDailyBriefing=false, employeeGoalMap={}, employeeGoalsLoading=false, refreshEmployeeGoals }) {
  const [dashboardStore,setDashboardStore]=useState('all');
  const dashboardStores=sortStoresByOpenOrder([...employees,...rows].map(e=>e.branch).filter(b=>b&&!NON_SALES_STORES.includes(b)));
  const dashboardStoreKey=resolveDashboardStore(dashboardStore,dashboardStores,canSwitchStores,loginBranch,SALES_AREA_STORES);
  const dashboardBranches=dashboardScopeBranches(dashboardStoreKey,dashboardStores,SALES_AREA_STORES);
  const dashboardArea=dashboardStoreKey.startsWith('area:')?dashboardStoreKey.slice(5):null;
  const dashboardRows=(rows||[]).filter(r=>dashboardStoreKey==='all'||dashboardBranches.includes(r.branch));
  const performanceEmployees=[...employees,...rows.filter(row=>row.active===false)];
  const dashboardEmployees=(employees||[]).filter(e=>dashboardStoreKey==='all'||dashboardBranches.includes(e.branch));
  const dashboardLabel=dashboardStoreKey==='all'?(isFullAdmin?'전체 운영 현황':'담당 매장 전체'):dashboardArea?SALES_AREA_LABELS[dashboardArea]:displayStoreName(dashboardStoreKey);
  const dashboardForecastFactor=performanceForecastFactor(month);

  const finalPerformances=useFinalStorePerformance(month);
  const [customerCareFilter,setCustomerCareFilter]=useState('todo');
  const TABS = [
    { key: 'dashboard', label: '운영 현황', icon: LayoutDashboard, section:'operations' },
    ...(canViewDailyBriefing ? [{ key: 'dailyBriefing', label: '일일 브리핑', icon: ClipboardList, section:'operations' }] : []),
    { key: 'performance', label: '실적 순위', icon: Trophy, section:'performance' },
    { key: 'performanceApproval', label: '실적 점검', icon: ClipboardCheck, section:'performance' },
    { key: 'storeGoals', label: '매장 목표', icon: Target, section:'performance' },
    { key: 'customerCareAdmin', label: '고객 관리', icon: ClipboardList, section:'customer' },
    { key: 'homeCare', label: '홈 케어', icon: Home, section:'customer' },
    { key: 'evaluation', label: '평가', icon: ClipboardCheck, section:'settlement' },
    { key: 'managerPayroll', label: '관리자 급여', icon: Wallet, section:'settlement' },
    { key: 'expenses', label: '영업비용/오퍼', icon: Wallet, section:'cost' },
    ...(canViewDailyBriefing ? [{ key: 'spot', label: '스팟 승인', icon: Zap, section:'cost' }] : []),
    { key: 'history', label: '변경 이력', icon: History, section:'cost' },
    { key: 'employees', label: '직원 관리', icon: Users, section:'settings' },
    ...(canViewHqStructure ? [{ key: 'hqStructure', label: '본사 구조정책', icon: Building2, section:'settings' }] : []),
    ...(isFullAdmin ? [
      { key: 'headOfficeData', label: '본사 데이터', icon: UploadCloud, section:'performance' },
      { key: 'settlement', label: '정산 검토', icon: Wallet, section:'settlement' },
      { key: 'calculationAudit', label: '계산 검증', icon: ShieldCheck, section:'settlement' },
      { key: 'rates', label: '지급기준 관리', icon: Settings, section:'settings' },
    ] : []),
    ...(canManagePermissions ? [{ key: 'permissions', label: '권한 관리', icon: ShieldCheck, section:'settings' }] : []),
  ];
  const ADMIN_SECTIONS=[
    {key:'operations',label:'오늘의 운영',icon:LayoutDashboard},
    {key:'performance',label:'실적',icon:Trophy},
    {key:'customer',label:'고객·설치',icon:ClipboardList},
    {key:'settlement',label:'평가·급여',icon:Wallet},
    {key:'cost',label:'비용·승인',icon:Zap},
    {key:'settings',label:'관리 설정',icon:Settings},
  ].filter(section=>TABS.some(tab=>tab.section===section.key));
  const favoriteStorageKey=authUserId?`miso_admin_favorites_v1:${authUserId}`:'';
  const [favoriteTabKeys,setFavoriteTabKeys]=useState([]);
  useEffect(()=>{
    if(!favoriteStorageKey){setFavoriteTabKeys([]);return;}
    try{const saved=JSON.parse(localStorage.getItem(favoriteStorageKey)||'[]');setFavoriteTabKeys(Array.isArray(saved)?saved.filter(key=>TABS.some(tab=>tab.key===key)).slice(0,3):[])}catch{setFavoriteTabKeys([])}
  },[favoriteStorageKey,isFullAdmin,canViewHqStructure,canViewDailyBriefing]); // eslint-disable-line
  const toggleFavoriteTab=(key)=>{
    setFavoriteTabKeys(current=>{
      if(current.includes(key)){
        const next=current.filter(item=>item!==key);
        try{localStorage.setItem(favoriteStorageKey,JSON.stringify(next))}catch{/* 기기 저장공간 제한 시 현재 화면에서만 유지 */}
        return next;
      }
      if(current.length>=3){showAppToast('관리자 바로가기는 최대 3개까지 지정할 수 있어요.',{tone:'info'});return current;}
      const next=[...current,key];
      try{localStorage.setItem(favoriteStorageKey,JSON.stringify(next))}catch{/* 기기 저장공간 제한 시 현재 화면에서만 유지 */}
      return next;
    });
  };
  const favoriteTabs=favoriteTabKeys.map(key=>TABS.find(tab=>tab.key===key)).filter(Boolean);
  const activeAdminSection=TABS.find(tab=>tab.key===adminTab)?.section||'operations';
  const activeSectionTabs=TABS.filter(tab=>tab.section===activeAdminSection);
  useEffect(() => {
    if ((adminTab === 'rates' || adminTab === 'permissions' || adminTab === 'settlement' || adminTab === 'calculationAudit' || adminTab === 'headOfficeData') && !isFullAdmin) setAdminTab('dashboard');
    if (adminTab === 'hqStructure' && !canViewHqStructure) setAdminTab('dashboard');
    if (adminTab === 'dailyBriefing' && !canViewDailyBriefing) setAdminTab('dashboard');
    if (adminTab === 'spot' && !canViewDailyBriefing) setAdminTab('dashboard');
  }, [adminTab, isFullAdmin, canViewHqStructure, canViewDailyBriefing]); // eslint-disable-line

  const downloadCSV = () => {
    const header = ['이름', '직급', '매장', 'HS', '등급', '총 인센티브', '상태'];
    const lines = [header, ...rows.map((r) => [
      r.name, r.position, r.branch, hsCount(r.draft), r.pay.gradeEligible ? r.pay.grade : '', r.pay.total, r.status,
    ])];
    const csv = '\uFEFF' + lines.map((row) => row.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `미소인센티브_${month}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  const adminHomeMetricValue=(key,forecast=false)=>{
    const branches=[...new Set(dashboardRows.map(r=>r.branch).filter(Boolean))];
    return branches.reduce((total,branch)=>{
      const input=dashboardRows.filter(r=>r.branch===branch).reduce((sum,row)=>sum+adminMetricValue(row,key),0);
      const final=finalPerformances[branch]?.month===month?finalPerformances[branch]:null;
      const value=final?finalStoreMetric(final,key,input):input;
      return total+value*(forecast&&!final?dashboardForecastFactor:1);
    },0);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-5">
      <div className="mb-4 space-y-3">
        <div className="bg-white border border-gray-200 rounded-2xl p-2 space-y-2">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1">
            {ADMIN_SECTIONS.map(section=><button key={section.key} type="button" onClick={()=>setAdminTab(TABS.find(tab=>tab.section===section.key)?.key||'dashboard')} className={`flex min-h-11 flex-col sm:flex-row items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl text-[11px] font-bold transition ${activeAdminSection===section.key?'bg-brand-600 text-white shadow-sm ring-1 ring-brand-500':'bg-gray-50 text-gray-500 hover:bg-brand-50'}`}><section.icon size={14}/>{section.label}</button>)}
          </div>
          {favoriteTabs.length>0&&<div className="rounded-xl border border-amber-100 bg-amber-50/60 p-1.5"><div className="flex items-center gap-1 px-1.5 pb-1.5 text-[9px] font-bold tracking-wide text-amber-700"><Star size={10} fill="currentColor"/>내 바로가기</div><div className="flex gap-1.5 overflow-x-auto">{favoriteTabs.map(tab=><button key={tab.key} type="button" onClick={()=>setAdminTab(tab.key)} className={`flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold ${adminTab===tab.key?'border-brand-300 bg-white text-brand-700 shadow-sm':'border-amber-100 bg-white/80 text-gray-600'}`}><tab.icon size={13}/>{tab.label}</button>)}</div></div>}
          {activeSectionTabs.length>1&&<div className="rounded-xl border border-gray-100 bg-gray-50 p-1.5">

            <div className="flex flex-wrap gap-1.5 pb-0.5">
            {activeSectionTabs.map(n=>{const selected=adminTab===n.key,favorite=favoriteTabKeys.includes(n.key);return <div key={n.key} className={`flex shrink-0 items-stretch overflow-hidden rounded-lg border transition ${selected?'border-brand-300 bg-white text-brand-700 shadow-sm ring-1 ring-brand-100':'border-transparent bg-transparent text-gray-500 hover:border-gray-200 hover:bg-white'}`}><button type="button" onClick={()=>setAdminTab(n.key)} className="group flex min-h-11 items-center gap-1.5 px-3 text-xs font-bold"><span className={`flex h-5 w-5 items-center justify-center rounded-md ${selected?'bg-brand-600 text-white':'bg-white text-gray-400 group-hover:text-brand-500'}`}><n.icon size={12}/></span>{n.label}{selected&&<span className="h-1.5 w-1.5 rounded-full bg-brand-500"/>}</button><button type="button" onClick={()=>toggleFavoriteTab(n.key)} aria-label={`${n.label} ${favorite?'즐겨찾기 해제':'즐겨찾기 추가'}`} className={`flex min-h-11 w-9 items-center justify-center border-l ${favorite?'border-amber-100 bg-amber-50 text-amber-500':'border-gray-100 text-gray-300 hover:text-amber-500'}`}><Star size={13} fill={favorite?'currentColor':'none'}/></button></div>})}
            </div>
          </div>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={month} onChange={(e) => setMonth(e.target.value)} className="text-sm font-medium bg-white border border-gray-200 rounded-lg px-3 py-2">
            {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
          {isFullAdmin && (
            <button onClick={() => toggleMonthLock(month, !monthLocked)}
              className={`text-xs font-medium px-3 py-2 rounded-lg border ${monthLocked ? 'bg-red-50 text-red-600 border-red-200' : 'bg-white text-gray-600 border-gray-200'}`}>
              {monthLocked ? '🔒 마감됨 (해제)' : '마감하기'}
            </button>
          )}
          {isFullAdmin && (
            <button onClick={() => togglePolicyInputBlock(month,!policyInputBlocked)}
              className={`text-xs font-medium px-3 py-2 rounded-lg border ${policyInputBlocked?'bg-amber-50 text-amber-700 border-amber-200':'bg-white text-gray-600 border-gray-200'}`}>
              {policyInputBlocked?'정책 입력 전 (반영 후 열기)':'정책 입력 잠금'}
            </button>
          )}
          <button onClick={downloadCSV} className="flex items-center gap-1 text-xs font-medium px-3 py-2 rounded-lg bg-emerald-600 text-white">
            <UploadCloud size={13} /> 엑셀 다운로드
          </button>
        </div>
      </div>

      {monthLocked && (
        <div className="mb-4 bg-red-50 border border-red-100 text-red-600 text-xs rounded-lg p-3 flex items-center gap-2">
          <Info size={13} className="shrink-0" /> {monthLabel(month)}은 마감된 달이에요. 모든 직원의 실적 입력·수정이 잠겨 있어요.
        </div>
      )}
      {policyInputBlocked && (
        <div className="mb-4 bg-amber-50 border border-amber-100 text-amber-700 text-xs rounded-lg p-3 flex items-center gap-2">
          <Info size={13} className="shrink-0" /> {monthLabel(month)}은 지급기준 정책 준비 중이라 직원 실적 입력이 잠겨 있어요. 정책 수정과 검증을 마친 뒤 위의 ‘입력 열기’를 눌러주세요.
        </div>
      )}

      {adminTab === 'dashboard' && (
        <div className="space-y-4">
          <AdminManagementAlerts pendingCount={pendingCount} employees={employees} onGo={(tab)=>{if(tab==='customerCareAdmin')setCustomerCareFilter('overdue');setAdminTab(tab)}} month={month} rows={rows} dailyRecords={dailyRecords} isFullAdmin={isFullAdmin} config={config} canViewSpotAdmin={canViewDailyBriefing} />

          <AdminPerformanceCalendar
            month={month}
            employees={performanceEmployees}
            dailyRecords={dailyRecords}
            loginBranch={loginBranch}
            canSwitchStores={canSwitchStores}
            storeKey={dashboardStoreKey} onStoreChange={setDashboardStore}
          />

          <PerformanceCard month={month} title={`${monthLabel(month)} 핵심 성과`} scopeLabel={`매장 · ${dashboardLabel}`}
            metrics={ADMIN_MAIN_METRICS.map(([key,label,unit])=>({key,label,unit,value:adminHomeMetricValue(key),forecast:unit==='count'?Math.round(adminHomeMetricValue(key,true)):adminHomeMetricValue(key,true)}))}
            scopeRows={dashboardRows} branches={[...new Set(dashboardRows.map(row=>row.branch).filter(branch=>branch&&!NON_SALES_STORES.includes(branch)))]}
            config={config} mode="admin" testPrefix="admin" loadStoreGoals onEditGoals={()=>setAdminTab('storeGoals')}
          ><span className="text-xs text-gray-500 shrink-0">{dashboardEmployees.length}명</span></PerformanceCard>

          {!dashboardArea&&<StoreGoalDashboardCard key={`${month}:${dashboardStoreKey}`} branchOverride={dashboardStoreKey==='all'?undefined:dashboardStoreKey}
            rows={dashboardRows}
            employees={dashboardEmployees}
            authUserId={authUserId}
            month={month}
            onOpen={()=>setAdminTab('storeGoals')}
          />}
          <StoreChallengeCard
            month={month}
            allRows={rankingRows||rows}
            employees={employees}
            authUserId={authUserId}
            onOpenGoals={()=>setAdminTab('storeGoals')}
          />

          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <div className="text-sm font-bold text-gray-800">{dashboardLabel} · 직원 현황</div>
              <div className="text-xs text-gray-400 mt-0.5">핵심 실적만 빠르게 확인해요.</div>
            </div>
            <div className="divide-y divide-gray-50">
              {[...dashboardRows].filter(r=>!r.teamOnly).sort((a,b)=>hsCount(b.draft)-hsCount(a.draft)).map(r=>(
                <div key={r.id} className="px-4 py-3">
                  <div className="flex justify-between gap-3 items-center">
                    <div><div className="text-sm font-bold text-gray-900">{r.name}</div><div className="text-[10px] text-gray-400">{displayStoreName(r.branch)}</div></div>
                    <div className="text-[11px] text-gray-500 text-right leading-5">
                      <div>
                        HS <b className="text-gray-900">{adminMetricValue(r,'hs')}</b> ·
                        SIM MNP <b className="text-gray-900">{adminMetricValue(r,'simMnp')}</b> ·
                        홈 <b className="text-gray-900">{adminMetricValue(r,'home')}</b>
                      </div>
                      <div>
                        생산성 <b className="text-gray-900">{Number(adminMetricValue(r,'productivity')||0).toFixed(1)}P</b> ·
                        프리 <b className="text-gray-900">{adminMetricValue(r,'free')}</b> ·
                        스홈 <b className="text-gray-900">{adminMetricValue(r,'smart')}</b> ·
                        업셀건 <b className="text-gray-900">{adminMetricValue(r,'upsell')}</b>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <AdminCustomerCareOverview key={dashboardStoreKey} employees={dashboardEmployees} month={month} compact onOpen={()=>{setCustomerCareFilter('todo');setAdminTab('customerCareAdmin')}} />
        </div>
      )}

      {adminTab === 'performance' && <ComparisonView rows={rows} />}
      {adminTab === 'evaluation' && <React.Suspense fallback={<DeferredAdminPanelFallback label="평가·급여"/>}><EvaluationTab month={month} config={config} isManagerView={true} canFinalApprove={isFullAdmin} employees={employees} rows={rankingRows||rows} authUserId={authUserId} canSwitchStores={canSwitchStores} loginBranch={loginBranch} /></React.Suspense>}
      {adminTab === 'managerPayroll' && <React.Suspense fallback={<DeferredAdminPanelFallback label="평가·급여"/>}><ManagerPayrollPanel month={month} employees={employees} rows={rankingRows||rows} authUserId={authUserId} canSwitchStores={canSwitchStores} loginBranch={loginBranch} /></React.Suspense>}
      {adminTab === 'customerCareAdmin' && <AdminCustomerCareOverview employees={employees} month={month} initialFilter={customerCareFilter} />}
      {adminTab === 'homeCare' && <AdminHomeCare employees={employees} month={month} />}
      {adminTab === 'performanceApproval' && <div className="space-y-4"><PerformanceResetApprovals key={month} month={month} employees={employees} authUserId={authUserId} locked={monthLocked||policyInputBlocked}/><PerformanceCheckPanel month={month} rows={rows} dailyRecords={dailyRecords} employees={employees} /></div>}
      {adminTab === 'dailyBriefing' && canViewDailyBriefing && <DailyBriefingPanel month={month} rows={rankingRows||rows} dailyRecords={dailyRecords} employees={employees} authUserId={authUserId} config={config} />}
      {adminTab === 'expenses' && <AdminExpenseOverview month={month} employees={employees} loginBranch={loginBranch} canSwitchStores={canSwitchStores} />}
      {adminTab === 'storeGoals' && <StoreGoalAdmin month={month} employees={employees} rows={rows} isFullAdmin={isFullAdmin} authUserId={authUserId} />}
      {adminTab === 'spot' && canViewDailyBriefing && <SpotAdmin authUserId={authUserId} isFullAdmin={isFullAdmin} month={month} />}
      {adminTab === 'headOfficeData' && isFullAdmin && <HeadOfficeDataPanel month={month} employees={employees} rows={rows} config={config} authUserId={authUserId} />}
      {adminTab === 'settlement' && isFullAdmin && <SettlementReview month={month} rows={rows} employees={employees} config={config} authUserId={authUserId} />}
      {adminTab === 'calculationAudit' && isFullAdmin && <CalculationAuditPanel month={month} rows={rows} />}
      {adminTab === 'history' && <HistoryTab employees={employees} month={month} config={config} />}
      {adminTab === 'hqStructure' && canViewHqStructure && <React.Suspense fallback={<DeferredAdminPanelFallback label="본사 구조정책"/>}><HqStructurePolicyView month={month} employeeIds={(rankingRows||rows).map(row=>row.id)} authUserId={authUserId} /></React.Suspense>}

      {adminTab === 'employees' && (
        <EmployeeManager employees={employees} addEmployee={addEmployee} updateEmployee={updateEmployee} removeEmployee={removeEmployee} stores={stores} addStore={addStore} removeStore={removeStore} authUserId={authUserId} month={month} employeeGoalMap={employeeGoalMap} employeeGoalsLoading={employeeGoalsLoading} refreshEmployeeGoals={refreshEmployeeGoals} />
      )}

      {adminTab === 'rates' && isFullAdmin && (
        <React.Suspense fallback={<DeferredAdminPanelFallback label="지급 기준"/>}><RatesManager config={config} persistConfig={persistConfig} /></React.Suspense>
      )}

      {adminTab === 'permissions' && canManagePermissions && (
        <React.Suspense fallback={<DeferredAdminPanelFallback label="권한 관리"/>}><PermissionsManager employees={employees} /></React.Suspense>
      )}
    </div>
  );
}

function CalculationAuditPanel({month,rows=[]}){
  const [expanded,setExpanded]=useState('');
  const covered=rows.filter(r=>r.calculationAudit?.comparable).length;
  const different=rows.filter(r=>r.calculationAudit?.comparable&&Number(r.calculationAudit?.difference||0)!==0).length;
  return <div className="space-y-4">
    <div className="rounded-2xl border border-brand-100 bg-brand-50 p-4">
      <div className="text-sm font-bold text-brand-900">수수료 계산 대조</div>
      <div className="mt-1 text-xs leading-relaxed text-brand-700">직원에게 표시되는 급여는 변경하지 않고, 판매 당시 정책 스냅샷으로 다시 계산한 모바일 인센티브를 비교합니다.</div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-white p-2"><div className="text-[10px] text-gray-400">대상</div><b className="text-sm">{rows.length}명</b></div><div className="rounded-xl bg-white p-2"><div className="text-[10px] text-gray-400">비교 가능</div><b className="text-sm text-emerald-600">{covered}명</b></div><div className="rounded-xl bg-white p-2"><div className="text-[10px] text-gray-400">차이 발견</div><b className="text-sm text-red-500">{different}명</b></div></div>
    </div>
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
      <div className="border-b px-4 py-3"><div className="text-sm font-bold">{monthLabel(month)} 직원별 검증 결과</div><div className="text-[11px] text-gray-400">스냅샷이 없는 이전 판매는 기존 방식으로 유지하며 비교 대상에서 제외됩니다.</div></div>
      <div className="divide-y">
        {rows.map(r=>{const a=r.calculationAudit||{};const complete=a.comparable;const open=expanded===r.id;return <div key={r.id} className="px-4 py-3">
          <button type="button" onClick={()=>setExpanded(open?'':r.id)} className="w-full text-left"><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-bold">{r.name} <span className="text-[10px] font-normal text-gray-400">{displayStoreName(r.branch)}</span></div><div className="mt-1 text-[11px] text-gray-500">판매 {a.totalSales||0}건 · 스냅샷 {a.snapshotSales||0}건 · 이전방식 {a.missingSnapshots||0}건</div></div>
          {complete?<span className={`rounded-full px-2 py-1 text-[10px] font-bold ${Number(a.difference||0)===0?'bg-emerald-50 text-emerald-600':'bg-red-50 text-red-600'}`}>{Number(a.difference||0)===0?'일치':`차이 ${won(a.difference)}`}</span>:<span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-bold text-gray-500">이전정책 포함</span>}</div>
          {complete&&<div className="mt-2 grid grid-cols-2 gap-2 text-[11px]"><div className="rounded-lg bg-gray-50 px-3 py-2">기존 모바일 <b className="float-right">{won(a.existingMobilePay)}</b></div><div className="rounded-lg bg-gray-50 px-3 py-2">판매별 합계 <b className="float-right">{won(a.shadowMobilePay)}</b></div></div>}</button>
          {open&&<div className="mt-3 space-y-2 border-t pt-3">{(a.details||[]).length===0?<div className="rounded-lg bg-gray-50 p-3 text-[11px] text-gray-400">상세 계산이 가능한 신규 판매가 아직 없어요.</div>:(a.details||[]).map(d=><div key={d.id} className="rounded-xl border border-gray-100 p-3 text-[11px]"><div className="flex justify-between gap-2"><b>{d.date} · {d.customer}</b><span className="text-brand-600">{d.policyVersion}</span></div><div className="mt-0.5 text-gray-400">{d.label}{d.freePhone?' · 무료폰 특가':''}</div><div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-gray-600"><span>요금제 <b className="float-right">{won(d.paid?.plan)}</b></span><span>VAS·보험 <b className="float-right">{won(Number(d.paid?.vas||0)+Number(d.paid?.insurance||0))}</b></span><span>2ND <b className="float-right">{won(d.paid?.second)} · {Number(d.performancePoints||0).toFixed(1)}P</b></span><span>전략P <b className="float-right">{Number(d.insurancePoints||0).toFixed(1)}P</b></span></div>{d.freePhone&&<div className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-amber-700">무료폰 제외: 요금제 {won(d.excluded?.plan)} · VAS {won(d.excluded?.vas)} · 보험 {won(d.excluded?.insurance)}</div>}</div>)}</div>}
        </div>})}
      </div>
    </div>
  </div>;
}

/* 관리자는 MNP·기변A/B/C·010신규를 묶어 HS로 관리 — 일일입력 매트릭스의 해당 행을 합산 */


const COMPARE_METRICS = [
  {
    key:'hs', label:'HS', unit:'count', calc:(d)=>hsCount(d),
    parts:HS_PARTS.map((p)=>({label:p.short,calc:(d)=>matrixRowCount(d,p.idx)}))
  },
  { key:'simMnp', label:'SIM MNP', unit:'count', calc:(d)=>Object.values(d.mnpBundle||{}).reduce((s,v)=>s+Number(v||0),0) },
  { key:'second', label:'2ND', unit:'count', calc:(d)=>Object.values(d.bundle2nd||{}).reduce((s,v)=>s+Number(v||0),0) },
  { key:'home', label:'홈 실적', unit:'count', calc:(d)=>completedHomeCount(d) },
  { key:'free', label:'프리', unit:'count', calc:(d)=>Number(d.homeFlat?.tvFree||0) },
  { key:'smart', label:'스마트홈', unit:'count', calc:(d)=>Number(d.homeFlat?.smartHome||0) },
  { key:'productivity', label:'생산성', unit:'point', calc:(d,p)=>Number(p?.kpiScore||0) },
  { key:'upsell', label:'업셀건수', unit:'count', calc:(d)=>Number(d.tailoredCount||0) },
  { key:'upsellAmount', label:'맞춤제안매출액', unit:'won', calc:(d)=>Number(d.tailoredAmount||0) },
  { key:'sono', label:'소노', unit:'count', calc:(d)=>Object.values(d.sono||{}).reduce((s,v)=>s+Number(v||0),0) },
];

function formatDateTime(iso) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function groupItemLabel(config, groupKey, itemKey) {
  if (groupKey === 'homeBase') return HOME_BASE_ITEMS.find((i) => i.key === itemKey)?.label || itemKey;
  const table = config?.[groupKey];
  return (Array.isArray(table) && table.find((i) => i.key === itemKey)?.label) || itemKey;
}

// old_data/new_data(JSON) 두 시점을 비교해서 실제로 바뀐 항목만 뽑아냄
function diffDayRecords(config, oldRaw, newRaw) {
  const oldD = normalizeDay(oldRaw);
  const newD = normalizeDay(newRaw);
  const changes = [];

  oldD.matrix.forEach((row, ri) => {
    row.forEach((oldVal, ci) => {
      const newVal = newD.matrix[ri]?.[ci] || 0;
      if ((oldVal || 0) !== newVal) {
        changes.push({ label: `${MATRIX_ROW_DEFS[ri]?.label || ''} · ${MATRIX_COLS[ci]}`, oldVal: oldVal || 0, newVal });
      }
    });
  });

  DAILY_GROUP_KEYS.forEach((gk) => {
    const oldG = oldD.groups[gk] || {};
    const newG = newD.groups[gk] || {};
    const keys = new Set([...Object.keys(oldG), ...Object.keys(newG)]);
    keys.forEach((k) => {
      const oldVal = oldG[k] || 0;
      const newVal = newG[k] || 0;
      if (oldVal !== newVal) changes.push({ label: groupItemLabel(config, gk, k), oldVal, newVal });
    });
  });

  const EXTRA_LABELS = { custRegCount: '고객등록 건수', tailoredCount: '맞춤제안 업셀 건수', tailoredAmount: '맞춤제안 업셀금액' };
  DAILY_NUMERIC_KEYS.forEach((k) => {
    const oldVal = oldD[k] || 0;
    const newVal = newD[k] || 0;
    if (oldVal !== newVal) changes.push({ label: EXTRA_LABELS[k] || k, oldVal, newVal });
  });

  return changes;
}

function HistoryTab({ employees, month, config }) {
  const [empId, setEmpId] = useState('');
  const [logs, setLogs] = useState([]);
  const [saleAuditLogs,setSaleAuditLogs]=useState([]);
  const [homeAuditLogs,setHomeAuditLogs]=useState([]);
  const [loading, setLoading] = useState(false);
  const [nameMap, setNameMap] = useState({});

  useEffect(() => {
    if (employees.length && !empId) setEmpId(employees[0].id);
  }, [employees]); // eslint-disable-line

  useEffect(() => {
    setNameMap(Object.fromEntries(employees.map((e) => [e.id, e.name])));
  }, [employees]);

  useEffect(() => {
    if (!empId) return;
    (async () => {
      setLoading(true);
      const [y, m] = month.split('-').map(Number);
      const from = `${month}-01`;
      const nextDate=new Date(y,m,1);
      const to = `${nextDate.getFullYear()}-${String(nextDate.getMonth()+1).padStart(2,'0')}-01`;

      const [dailyRes,saleRes,homeRes]=await Promise.all([
        supabase.from('daily_records_audit')
          .select('id, work_date, action, old_data, new_data, changed_by, changed_at')
          .eq('user_id', empId).gte('work_date', from).lt('work_date', to)
          .order('changed_at', { ascending: false }),
        supabase.from('customer_sales_audit')
          .select('id,sale_id,action,old_row,new_row,changed_by,changed_at')
          .eq('user_id',empId).order('changed_at',{ascending:false}).limit(500),
        supabase.from('home_orders_audit')
          .select('id,order_id,action,old_row,new_row,changed_by,changed_at')
          .eq('user_id',empId).order('changed_at',{ascending:false}).limit(500),
      ]);

      if(!dailyRes.error)setLogs(dailyRes.data||[]);
      else setLogs([]);

      const inSaleMonth=(x)=>{
        const d=String(x?.new_row?.sale_date||x?.old_row?.sale_date||'');
        return d.startsWith(month);
      };
      const inHomeMonth=(x)=>{
        const d=String(x?.new_row?.source_work_date||x?.old_row?.source_work_date||'');
        return d.startsWith(month);
      };
      setSaleAuditLogs(saleRes.error?[]:(saleRes.data||[]).filter(inSaleMonth));
      setHomeAuditLogs(homeRes.error?[]:(homeRes.data||[]).filter(inHomeMonth));
      setLoading(false);
    })();
  }, [empId, month]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <select value={empId} onChange={(e) => setEmpId(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white">
          {employees.map((e) => <option key={e.id} value={e.id}>{e.name} · {displayStoreName(e.branch)}</option>)}
        </select>
        <span className="text-xs text-gray-400">{monthLabel(month)} · 저장할 때마다 자동으로 기록돼요</span>
      </div>

      {loading ? (
        <div className="text-xs text-gray-400 py-8 text-center">불러오는 중...</div>
      ) : logs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 text-xs text-gray-400 py-8 text-center">이번 달 변경 기록이 없어요.</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
          {logs.map((l) => {
            const detail = diffDayRecords(config, l.old_data, l.new_data);
            const totalNew = detail.reduce((s, c) => s + c.newVal, 0);
            return (
              <div key={l.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm text-gray-700">{l.work_date} <span className="text-gray-300">·</span> {l.action === 'insert' ? '최초 입력' : '수정'}</div>
                    <div className="text-[11px] text-gray-400">{formatDateTime(l.changed_at)} · {nameMap[l.changed_by] || '알 수 없음'}</div>
                  </div>
                  {detail.length === 0 && <span className="text-xs text-gray-400">변경 없음</span>}
                </div>
                {detail.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {detail.map((c, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">{c.label}</span>
                        <span className={`font-medium tabular-nums ${c.oldVal !== c.newVal ? 'text-amber-600' : 'text-gray-400'}`}>
                          {l.action === 'insert' ? `${c.newVal}건` : `${c.oldVal}건 → ${c.newVal}건`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {(saleAuditLogs.length>0||homeAuditLogs.length>0)&&(
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <div className="text-sm font-bold text-gray-800">고객별 판매 · 홈 변경 이력</div>
            <div className="text-[10px] text-gray-400 mt-0.5">v21.32부터 판매/홈 원본 변경도 DB에서 자동 보관해요.</div>
          </div>
          <div className="divide-y divide-gray-50">
            {[...saleAuditLogs.map(x=>({...x,_kind:'sale'})),...homeAuditLogs.map(x=>({...x,_kind:'home'}))]
              .sort((a,b)=>new Date(b.changed_at)-new Date(a.changed_at))
              .slice(0,100)
              .map((l)=>{
                const before=l.old_row||{},after=l.new_row||{};
                const isSale=l._kind==='sale';
                const date=isSale?(after.sale_date||before.sale_date):(after.source_work_date||before.source_work_date);
                const beforeLabel=isSale?(before.metric_label||''):(before.product_type||'');
                const afterLabel=isSale?(after.metric_label||''):(after.product_type||'');
                const actionLabel=l.action==='insert'?'등록':l.action==='delete'?'삭제':'수정';
                const versionBefore=Number(before.schema_version||before.source_meta?.schemaVersion||1);
                const versionAfter=Number(after.schema_version||after.source_meta?.schemaVersion||versionBefore||1);
                return <div key={`${l._kind}-${l.id}`} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-gray-700">{date||'-'} · {isSale?'판매':'홈'} {actionLabel}</div>
                      <div className="text-[11px] text-gray-500 mt-0.5 break-words">
                        {l.action==='update'&&beforeLabel!==afterLabel?`${beforeLabel||'-'} → ${afterLabel||'-'}`:(afterLabel||beforeLabel||'원본 데이터')}
                      </div>
                      {versionBefore!==versionAfter&&<div className="text-[10px] text-brand-600 mt-1">데이터 형식 v{versionBefore} → v{versionAfter}</div>}
                    </div>
                    <div className="text-[10px] text-gray-400 shrink-0">{formatDateTime(l.changed_at)}</div>
                  </div>
                </div>;
              })}
          </div>
        </div>
      )}
    </div>
  );
}


function ComparisonView({ rows }) {
  const [groupBy, setGroupBy] = useState('employee'); // employee | branch
  const [metricKey, setMetricKey] = useState('hs');
  const metric = COMPARE_METRICS.find((m) => m.key === metricKey) || COMPARE_METRICS[0];
  const fmt = (v) => (metric.unit === 'won' ? won(v) : metric.unit === 'point' ? `${fmtNum(v || 0,1)}P` : `${fmtCount(v)}건`);

  let data;
  if (groupBy === 'employee') {
    data = rows.map((r) => ({
      label: `${r.name} (${displayStoreName(r.branch)})`,
      value: metric.calc(r.draft, r.pay),
      parts: metric.parts ? metric.parts.map((p) => p.calc(r.draft, r.pay)) : null,
    }));
  } else {
    const byBranch = {};
    rows.forEach((r) => {
      const cur = byBranch[r.branch] || { label: r.branch, value: 0, parts: metric.parts ? metric.parts.map(() => 0) : null };
      cur.value += metric.calc(r.draft, r.pay);
      if (cur.parts) metric.parts.forEach((p, i) => { cur.parts[i] += p.calc(r.draft, r.pay); });
      byBranch[r.branch] = cur;
    });
    data = Object.values(byBranch);
  }
  data = data.sort((a, b) => b.value - a.value);
  const max = Math.max(1, ...data.map((d) => d.value));
  const grandTotal = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex bg-white border border-gray-200 rounded-lg p-0.5">
          <button onClick={() => setGroupBy('employee')} className={`px-3 py-1.5 rounded-md text-sm font-medium ${groupBy === 'employee' ? 'bg-brand-600 text-white' : 'text-gray-500'}`}>직원별</button>
          <button onClick={() => setGroupBy('branch')} className={`px-3 py-1.5 rounded-md text-sm font-medium ${groupBy === 'branch' ? 'bg-brand-600 text-white' : 'text-gray-500'}`}>매장별</button>
        </div>
        <select value={metricKey} onChange={(e) => setMetricKey(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white">
          {COMPARE_METRICS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-2.5">
        {data.length > 0 && (
          <div className="flex items-center justify-between pb-2 mb-1 border-b border-gray-50">
            <span className="text-xs text-gray-400">{groupBy === 'employee' ? '전체 직원' : '전체 매장'} 합계</span>
            <span className="text-sm font-bold text-gray-800">{fmt(grandTotal)}</span>
          </div>
        )}
        {data.length === 0 && <div className="text-xs text-gray-400 text-center py-6">데이터가 없습니다.</div>}
        {data.map((d, i) => (
          <div key={d.label} className="pb-1">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-gray-600 truncate pr-2">{i + 1}. {d.label}</span>
              <span className="font-semibold text-gray-800 whitespace-nowrap">{fmt(d.value)}</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-brand-500 rounded-full" style={{ width: `${Math.max(2, (d.value / max) * 100)}%` }} />
            </div>
            {d.parts && (
              <div className="mt-1 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[10px] text-gray-400">
                {metric.parts.map((p, pi) => (
                  <span key={p.label}>{p.label} <b className={`tabular-nums ${d.parts[pi] > 0 ? 'text-gray-600' : 'text-gray-300'}`}>{d.parts[pi]}</b></span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const EMPLOYEE_GOAL_LABELS = {
  hs:'HS', simMnp:'SIM MNP', second:'2ND', home:'홈', tvFree:'프리', smartHome:'스홈',
  sono:'소노', tailoredAmount:'맞춤제안 매출', tailored:'업셀건', points:'성과등급P',
  kpi:'생산성', productivity:'생산성', incentive:'인센티브',
};

function EmployeeGoalSummary({ month, entry }) {
  const goals = entry?.goals || {};
  const rows = Object.entries(goals).filter(([, value]) => Number(value) > 0);
  if (!rows.length) return <div className="mt-2 text-[10px] font-medium text-red-400">{monthLabel(month)} 개인 목표 미설정</div>;
  return <div className="mt-2">
    <div className="text-[10px] font-semibold text-brand-600">{monthLabel(month)} 개인 목표</div>
    <div className="mt-1 flex flex-wrap gap-1">
      {rows.map(([key,value])=><span key={key} className="rounded-md bg-brand-50 px-1.5 py-1 text-[9px] font-medium text-brand-700">
        {EMPLOYEE_GOAL_LABELS[key]||key} {key==='tailoredAmount'||key==='incentive'?won(value):`${fmtNum(value,1)}${['points','kpi','productivity'].includes(key)?'P':'건'}`}
      </span>)}
    </div>
  </div>;
}

function EmployeeManager({ employees, addEmployee, updateEmployee, removeEmployee, stores, addStore, removeStore, authUserId, month, employeeGoalMap={}, employeeGoalsLoading=false, refreshEmployeeGoals }) {
  const [form, setForm] = useState({ name: '', branch: stores[0] || '', position: '사원', hireDate: '' });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [newStore, setNewStore] = useState('');

  const submit = () => {
    if (!form.name.trim() || !form.branch) return;
    addEmployee(form.name.trim(), form.branch, form.position, form.hireDate);
    setForm({ name: '', branch: stores[0] || '', position: '사원', hireDate: '' });
  };
  const startEdit = (e) => { setEditingId(e.id); setEditForm({ name: e.name, branch: e.branch, position: e.position, hireDate: e.hireDate || '' }); };
  const saveEdit = () => { updateEmployee(editingId, editForm); setEditingId(null); };

  const [filterBranch, setFilterBranch] = useState('전체');
  const [sortBy, setSortBy] = useState('hireDesc');
  const [nameQuery, setNameQuery] = useState('');

  const [showInactive, setShowInactive] = useState(false);
  const [inactiveList, setInactiveList] = useState([]);
  const [inactiveLoading, setInactiveLoading] = useState(false);

  const loadInactive = async () => {
    setInactiveLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, employee_code, store_name, position, hire_date')
      .eq('active', false)
      .order('name', { ascending: true });
    if (!error) setInactiveList(data || []);
    setInactiveLoading(false);
  };
  const toggleShowInactive = () => {
    const next = !showInactive;
    setShowInactive(next);
    if (next) loadInactive();
  };
  const reactivate = async (id) => {
    const { error } = await supabase.from('profiles').update({ active: true }).eq('id', id).select('id').single();
    if (!error) {
      setInactiveList((prev) => prev.filter((p) => p.id !== id));
      window.location.reload(); // 목록 갱신을 위해 새로고침 (간단하고 확실한 방식)
    }
  };

  const visibleEmployees = employees
    .filter((e) => filterBranch === '전체' || e.branch === filterBranch)
    .filter((e) => !nameQuery.trim() || e.name.includes(nameQuery.trim()))
    .slice()
    .sort((a, b) => {
      if (sortBy === 'hireDesc') return (b.hireDate || '').localeCompare(a.hireDate || '');
      if (sortBy === 'hireAsc') return (a.hireDate || '').localeCompare(b.hireDate || '');
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'branch') return a.branch.localeCompare(b.branch);
      return 0;
    });

  return (
    <div className="max-w-2xl space-y-4">
      <React.Suspense fallback={<DeferredAdminPanelFallback label="직원 관리 도구"/>}>
        <PendingApprovals />
        <ProfileEditRequests />
        <PasswordResetAdmin authUserId={authUserId}/>
      </React.Suspense>
      <Section title="매장 관리" sub={`${stores.length}개 매장`} defaultOpen>
        <div className="p-3 flex gap-2">
          <input placeholder="새 매장명 (예: 동명_매장명)" value={newStore} onChange={(e) => setNewStore(e.target.value)} className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm" />
          <button onClick={() => { addStore(newStore); setNewStore(''); }} className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold whitespace-nowrap">매장 추가</button>
        </div>
        <div className="px-3 pb-3 flex flex-wrap gap-1.5">
          {stores.map((s) => (
            <span key={s} className="flex items-center gap-1 bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-full">
              {s}
              <button onClick={async() => { if(await showAppConfirm({title:`${s} 매장을 삭제할까요?`,message:'기존 직원 실적은 유지되지만 새 직원 등록·회원가입의 매장 목록에서는 사라집니다.',confirmLabel:'매장 삭제',tone:'danger'})) removeStore(s); }} className="text-gray-400 hover:text-red-500">×</button>
            </span>
          ))}
        </div>
      </Section>

      <div className="bg-white rounded-xl border border-gray-100 p-4 grid grid-cols-2 gap-2">
        <input placeholder="이름" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm" />
        <select value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm">
          {stores.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm">
          {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <input type="month" value={form.hireDate} onChange={(e) => setForm({ ...form, hireDate: e.target.value })} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm" />
        <button onClick={submit} className="col-span-2 flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold"><UserPlus size={14} /> 직원 추가</button>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <input placeholder="이름 검색" value={nameQuery} onChange={(e) => setNameQuery(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white w-28" />
        <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white">
          <option value="전체">전체 매장</option>
          {stores.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white">
          <option value="hireDesc">입사월 최신순</option>
          <option value="hireAsc">입사월 오래된순</option>
          <option value="name">이름순</option>
          <option value="branch">매장순</option>
        </select>
        <span className="text-xs text-gray-400">{visibleEmployees.length}명</span>
        <button type="button" onClick={()=>refreshEmployeeGoals?.()} disabled={employeeGoalsLoading} className="ml-auto text-xs font-medium text-brand-600 disabled:text-gray-300">
          {employeeGoalsLoading ? '목표 확인 중' : '목표 새로고침'}
        </button>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
        {visibleEmployees.map((e) => (
          <div key={e.id} className="px-4 py-3">
            {editingId === e.id ? (
              <div className="grid grid-cols-2 gap-2">
                <input value={editForm.name} onChange={(ev) => setEditForm({ ...editForm, name: ev.target.value })} className="border border-gray-200 rounded-lg px-2 py-1 text-sm" />
                <select value={editForm.branch} onChange={(ev) => setEditForm({ ...editForm, branch: ev.target.value })} className="border border-gray-200 rounded-lg px-2 py-1 text-sm">
                  {stores.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={editForm.position} onChange={(ev) => setEditForm({ ...editForm, position: ev.target.value })} className="border border-gray-200 rounded-lg px-2 py-1 text-sm">
                  {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <input type="month" value={editForm.hireDate} onChange={(ev) => setEditForm({ ...editForm, hireDate: ev.target.value })} className="border border-gray-200 rounded-lg px-2 py-1 text-sm" />
                <button onClick={saveEdit} className="text-xs font-medium px-2.5 py-1 rounded-md bg-brand-600 text-white">저장</button>
                <button onClick={() => setEditingId(null)} className="text-xs text-gray-400">취소</button>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-800">
                    {e.name} · {e.position}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5 break-words">
                    {displayStoreName(e.branch)}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5">
                    {e.hireDate ? `입사 ${e.hireDate}` : '입사일 미등록'}
                    {` · 최종 접속 ${formatLastSignIn(e.lastSignInAt)}`}
                  </div>
                  <EmployeeGoalSummary month={month} entry={employeeGoalMap[e.id]} />
                </div>

                <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap">
                  <button
                    onClick={() => startEdit(e)}
                    className="shrink-0 min-w-[46px] whitespace-nowrap text-xs font-medium px-2.5 py-1.5 rounded-md bg-gray-100 text-gray-600"
                  >
                    수정
                  </button>
                  <button
                    onClick={async() => {
                      if(await showAppConfirm({title:`${e.name}님을 비활성화할까요?`,message:'로그인·직원 목록에서는 빠지지만 기존 실적 기록은 유지되며 나중에 다시 활성화할 수 있습니다.',confirmLabel:'비활성화',tone:'danger'})) removeEmployee(e.id);
                    }}
                    className="shrink-0 w-8 h-8 rounded-md bg-red-50 text-red-500 flex items-center justify-center"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {visibleEmployees.length === 0 && <div className="text-xs text-gray-400 px-4 py-6 text-center">해당 매장에 등록된 직원이 없습니다.</div>}
      </div>

      <button onClick={toggleShowInactive} className="text-xs text-gray-400 underline">
        {showInactive ? '비활성 직원 숨기기' : '비활성화된 직원 보기'}
      </button>
      {showInactive && (
        <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
          {inactiveLoading ? (
            <div className="text-xs text-gray-400 px-4 py-6 text-center">불러오는 중...</div>
          ) : inactiveList.length === 0 ? (
            <div className="text-xs text-gray-400 px-4 py-6 text-center">비활성화된 직원이 없어요.</div>
          ) : (
            inactiveList.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-gray-500">{p.name} · {p.position}</div>
                  <div className="text-[11px] text-gray-400">{p.store_name}</div>
                </div>
                <button onClick={() => reactivate(p.id)} className="text-xs font-medium px-2.5 py-1.5 rounded-md bg-brand-600 text-white">다시 활성화</button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}


function StatCard({ label, value, icon: Icon, accent }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-center gap-1.5 text-gray-400 text-xs mb-1"><Icon size={13} /> {label}</div>
      <div className={`text-xl font-bold ${accent ? 'text-amber-600' : 'text-gray-800'}`}>{typeof value==='number'?fmtNum(value,1):value}</div>
    </div>
  );
}
