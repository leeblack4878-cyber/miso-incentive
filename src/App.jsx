import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Trophy, Home, ClipboardList, History, TrendingUp, Users, ChevronDown, Plus,
  Minus, Award, Loader2, Check, Settings, LayoutDashboard, Wallet, Trash2,
  UserPlus, Info, Layers, Calendar, ChevronLeft, ChevronRight, AlertTriangle, Zap,
  UploadCloud, X, Target, ShieldCheck, LogOut, Bell, ClipboardCheck, Building2
} from 'lucide-react';
import { supabase } from './supabase';
import { friendlyError } from './errorMessages';
import HqStructurePolicyView from './HqStructurePolicyView';
import PasswordResetAdmin from './PasswordResetAdmin';
import PendingApprovals from './PendingApprovals';
import ProfileEditRequests, { ProfileEditRequestForm } from './ProfileEditRequests';
import {
  SECOND_PERFORMANCE_POINT, allowedSecondVas,
  summarizeVasQuality, homeOrdersForMonth, homeBundleCount,
  mergeSaleMetaPreservingLegacy, calculateSecondPolicy, calculateActivitySupport,
  calculateFlatIncentive, calculateMobileCommissionParts,
  calculatePayrollSettlement,
  CURRENT_POLICY_VERSION, createPolicySnapshot,
  calculateMobileSale,
  calculateHomePolicyFromOrders as calculateHomePolicyEngine,
} from './policyRules';
import {
  SEPTEMBER_MANAGER_POLICY_VERSION,
  managerOperatorForStore,
  septemberManagerStoreType,
  managerCompanyGoalShare,
  calculateSeptemberManagerIncentive,
} from './managerPolicyEngine';
import {
  SEPTEMBER_POLICY_MONTH, SEPTEMBER_POLICY_VERSION, septemberMainTvPlan, SEPTEMBER_MATRIX_COLUMNS,
  SEPTEMBER_SPECIAL_SALES, calculateSeptemberSpecialSale,
  calculateSeptemberBundleSale, calculateSeptemberSono, calculateSeptemberTailoredTier,
} from './septemberPolicy';
import { calculateSaleStrategicPoints, calculateEmployeeStrategicAdjustment } from './strategicPoints';
import {
  POLICY_HISTORY_CONFIG_KEY,
  isPolicyConfigReadOnly,
  isSeptemberPolicyActive,
  resolvePolicyConfigForMonth,
} from './policyCalendar';

let feedbackBridge={toast:null,confirm:null};
function showAppToast(message,{tone='success',title=''}={}){feedbackBridge.toast?.({message,title,tone})}
function showLegacyAlert(message){
  const text=String(message||'');
  const isError=/실패|오류|못했|입력해주세요|선택해주세요|없어요|할 수 없|권한|마감된/.test(text);
  showAppToast(text,{tone:isError?'error':'info',title:isError?'확인해주세요':'안내'});
}
function showAppConfirm(options={}){
  if(!feedbackBridge.confirm)return Promise.resolve(window.confirm(options.message||options.title||'계속할까요?'));
  return feedbackBridge.confirm(options);
}
function AppFeedbackHost(){
  const [toasts,setToasts]=useState([]),[dialog,setDialog]=useState(null);
  useEffect(()=>{
    feedbackBridge.toast=(item)=>{const id=Date.now()+Math.random();setToasts(v=>[...v,{...item,id}]);setTimeout(()=>setToasts(v=>v.filter(x=>x.id!==id)),3200)};
    feedbackBridge.confirm=(options)=>new Promise(resolve=>setDialog({...options,resolve}));
    return()=>{feedbackBridge={toast:null,confirm:null}};
  },[]);
  const finish=value=>{dialog?.resolve?.(value);setDialog(null)};
  return <>
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[120] w-[calc(100%-24px)] max-w-sm space-y-2 pointer-events-none">{toasts.map(t=><div key={t.id} className={`pointer-events-auto rounded-2xl px-4 py-3 shadow-xl border ${t.tone==='error'?'bg-red-600 border-red-500 text-white':t.tone==='info'?'bg-gray-900 border-gray-800 text-white':'bg-emerald-600 border-emerald-500 text-white'}`}><div className="text-xs font-bold">{t.title|| (t.tone==='error'?'처리하지 못했어요':'처리 완료')}</div><div className="text-[11px] opacity-90 mt-0.5">{t.message}</div></div>)}</div>
    {dialog&&<div className="fixed inset-0 z-[125] bg-black/45 flex items-end sm:items-center justify-center" onClick={()=>finish(false)}><div className="w-full max-w-sm bg-white rounded-t-3xl sm:rounded-3xl p-5" onClick={e=>e.stopPropagation()}><div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${dialog.tone==='danger'?'bg-red-50 text-red-500':'bg-violet-50 text-violet-600'}`}><AlertTriangle size={20}/></div><div className="text-lg font-bold text-gray-900 mt-3">{dialog.title||'확인해주세요'}</div><div className="text-xs text-gray-500 mt-2 whitespace-pre-line leading-relaxed">{dialog.message}</div><div className="grid grid-cols-2 gap-2 mt-5"><button onClick={()=>finish(false)} className="py-3 rounded-xl bg-gray-100 text-gray-600 text-sm font-bold">{dialog.cancelLabel||'돌아가기'}</button><button onClick={()=>finish(true)} className={`py-3 rounded-xl text-white text-sm font-bold ${dialog.tone==='danger'?'bg-red-500':'bg-violet-600'}`}>{dialog.confirmLabel||'확인'}</button></div></div></div>}
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
  return <><button onClick={install} className="hidden sm:flex h-9 items-center gap-1 rounded-xl border border-violet-100 bg-violet-50 px-2.5 text-[10px] font-bold text-violet-700" title="홈 화면에 앱 설치"><Home size={14}/>앱 설치</button><button onClick={install} className="sm:hidden w-9 h-9 rounded-xl border border-violet-100 bg-violet-50 text-violet-700 flex items-center justify-center" title="앱 설치"><Home size={15}/></button>{guideOpen&&<div className="fixed inset-0 z-[126] bg-black/45 flex items-end sm:items-center justify-center" onClick={()=>setGuideOpen(false)}><div className="w-full max-w-sm rounded-t-3xl sm:rounded-3xl bg-white p-5" onClick={e=>e.stopPropagation()}><div className="w-12 h-12 rounded-2xl bg-violet-600 text-white flex items-center justify-center"><Trophy size={24}/></div><div className="text-lg font-black text-gray-900 mt-3">미소페이 앱 설치</div>{isiOS?<div className="mt-3 space-y-2 text-sm text-gray-600"><div className="rounded-xl bg-gray-50 p-3"><b>1.</b> Safari 하단의 <b>공유 버튼</b>을 눌러요.</div><div className="rounded-xl bg-gray-50 p-3"><b>2.</b> 메뉴에서 <b>홈 화면에 추가</b>를 선택해요.</div><div className="rounded-xl bg-gray-50 p-3"><b>3.</b> 오른쪽 위 <b>추가</b>를 누르면 끝!</div></div>:<div className="mt-3 text-sm text-gray-600 leading-relaxed">브라우저 메뉴에서 <b>앱 설치</b> 또는 <b>홈 화면에 추가</b>를 선택해주세요. Chrome 최신 버전에서 가장 원활해요.</div>}<div className="mt-3 rounded-xl bg-violet-50 p-3 text-xs text-violet-700">설치하면 주소창 없이 앱처럼 열리고, 다음 단계에서 휴대폰 푸시 알림도 연결할 수 있어요.</div><button onClick={()=>setGuideOpen(false)} className="mt-4 w-full rounded-xl bg-violet-600 py-3 text-sm font-bold text-white">확인했어요</button></div></div>}</>;
}

/* v21.26: 2ND 번들별 일반/무료판매 구분. 무료판매는 실적/KPI 인정, 번들+해당 VAS 인센티브 제외. */

/* v21.32 DATA SAFETY
   - UI 버전과 저장 데이터 버전을 분리
   - 구버전 source_meta를 현재 UI 형식으로 읽음
   - 수정 시 기존 source_meta 필드를 보존한 채 현재 필드만 병합
   - DB audit trigger와 함께 원본 변경 이력을 보존
*/
const CURRENT_SALE_SCHEMA_VERSION = 3;
const FREE_PHONE_SPECIAL_TITLE = '무료폰 특가'; // 8월 이전 저장건 호환 전용
function isIncentiveUnpaidSpecial(policy={}){
  return policy?.policyType==='incentive_unpaid'||policy?.policy_type==='incentive_unpaid'
    ||policy?.policyType==='free_phone'||policy?.policy_type==='free_phone'
    ||policy?.policyTitle===FREE_PHONE_SPECIAL_TITLE||policy?.title===FREE_PHONE_SPECIAL_TITLE;
}
const isFreePhoneSpecial=isIncentiveUnpaidSpecial;
function septemberPlanGroup(ci){return ['115','youth85','85','33plus','weak47','other'][Number(ci)]||'other'}

function saleSchemaVersion(sale){
  return Number(sale?.schema_version || sale?.source_meta?.schemaVersion || 1);
}
function withCurrentSaleSchema(meta={}){
  return {...(meta||{}), schemaVersion:CURRENT_SALE_SCHEMA_VERSION};
}
function currentPolicySnapshot(config={}){
  return createPolicySnapshot({
    version:config.policyVersion||CURRENT_POLICY_VERSION,
    matrixRates:config.matrix||[],
    vasRates:config.vas||[],
    bundleRates:config.bundle2nd||[],
  });
}
function legacySaleBadge(sale){
  return saleSchemaVersion(sale) < CURRENT_SALE_SCHEMA_VERSION;
}
function inferHomeProductTypeFromLabel(label=''){
  const t=String(label||'').replace(/\s+/g,' ');
  if(t.includes('TV프리')) return 'tvFree';
  if(t.includes('스마트홈')) return 'smartHome';
  if(t.includes('일반 부셋탑') || t.includes('부셋탑')) return 'subSetTop';
  if(t.includes('중고MNP') || t.includes('중고 MNP')) return 'simulUsedMnp';
  if(t.includes('MNP 동시')) return 'simulMnp';
  if(t.includes('신규/기변') || t.includes('신규·기변')) return 'simulNewChange';
  if(t.includes('1GB') || t.includes('1G')) return 'internet1g';
  if(t.includes('500MB') || t.includes('500M')) return 'internet500';
  if(t.includes('100MB') || t.includes('100M')) return 'internet100';
  if(t.includes('홈+TV') || t.includes('홈 + TV')) return 'homeTv';
  if(t.includes('홈 단독') || t==='홈') return 'homeOnly';
  return '';
}
function compatHomeRows(homeSales=[], orders=[]){
  if((orders||[]).length) return orders;
  return (homeSales||[]).map(sale=>({
    id:sale.source_ref||sale.id,
    product_type:inferHomeProductTypeFromLabel(sale.metric_label),
    network_type:sale.source_meta?.networkType||'',
    status:sale.source_meta?.directComplete?'completed':'pending',
    planned_install_date:null,
    source_group:null,
    source_key:null,
    _legacy:true,
  })).filter(x=>x.product_type);
}

/* ===================== 기본 정책 상수 (관리자가 수정 가능) ===================== */

const POSITIONS = ['점장', '부점장', '매니저', '사원', '기타'];
const DEFAULT_BASE_PAY = { 점장: 2800000, 부점장: 2600000, 매니저: 2500000, 사원: 2300000, 기타: 0 };
const DEFAULT_BASE_PENALTY = 200000; // 활동시간 미충족시 차감
const DEFAULT_POSITION_ALLOWANCE = { 점장: 500000, 부점장: 200000, 매니저: 200000, 사원: 0, 기타: 0 }; // 직책수당 — 영업활동 지원금과 분리하여 최종 가산
const DEFAULT_ACTIVITY_SUPPORT_MAX = 2300000; // 영업활동 지원 정책 공통 MAX

const DEFAULT_STORES = [
  '신천동_삼미시장점', '신천동_삼미시장2호점', '본오3동_상록수역점', '대야동_롯데마트점',
  '본오3동_주민센터점', '장곡동_장곡역점', '거모동_도일시장점', '월곶동_월곶점',
  '월피동_성포역점', '광정동_산본점', '고잔동_법조타운점', '은행동_은계사거리점', '본오1동_본오중학교점',
  '영업지원팀',
];
// 실제 영업을 하지 않는 조직 — 실적표/실적비교/지급 총액 집계에서 제외
const NON_SALES_STORES = ['운영진', '영업지원팀'];

const DEFAULT_TENURE = [
  { key: 'under6', label: '6개월 미만 (실적무관)', rate: 0 },
  { key: 'under12', label: '12개월 미만', rate: 200000 },
  { key: 'over12', label: '12개월 이상', rate: 150000 },
  { key: 'over24', label: '24개월 이상', rate: 100000 },
];
const DEFAULT_TENURE_CAP = 2300000;

const DEFAULT_GRADES = [
  { grade: 'S', min: 55, bonus: 1000000 },
  { grade: 'A', min: 45, bonus: 700000 },
  { grade: 'B', min: 35, bonus: 500000 },
  { grade: 'C', min: 25, bonus: 300000 },
  { grade: 'D', min: 0, bonus: 0 },
];
const HOME_GATE_MIN = 3; // 홈 최소조건(성과 인정 게이트)
const ADDON_GATE = 35;   // 모바일 P가 이 값 초과일 때만 홈 가점 반영
// 홈 최소조건(3점) 전용 배점 — 성과등급P 안내표와는 별개 기준 (인터넷:1점, 프리:0.3점, 스홈:0.2점)
const HOME_GATE_WEIGHTS = { homeOnly: 1, homeTv: 1, tvFree: 0.3, smartHome: 0.2 };

const DEFAULT_MOBILE_POINT_ITEMS = [
  { key: 'mnp', label: 'MNP', point: 1.5, countsTenure: true },
  { key: 'new010', label: '010 신규', point: 1, countsTenure: true },
  { key: 'gibyeon115', label: '기기변경 (115군↑)', point: 1, countsTenure: true },
  { key: 'gibyeon85', label: '기기변경 (85군↑)', point: 0.7, countsTenure: true },
  { key: 'gibyeonWeak', label: '기변 (약자요금제)', point: 0.5, countsTenure: true },
  { key: 'gibyeonLVC', label: '기변 (85군 미만)', point: 0.3, countsTenure: true },
  { key: 'usedMnp', label: '중고 MNP (선약가입건)', point: 1, countsTenure: true },
  { key: 'secondOnly', label: '2ND단독', point: SECOND_PERFORMANCE_POINT, countsTenure: true },
];

const DEFAULT_KPI_ITEMS = [
  { key: 'kpiMnp', label: 'MNP', point: 1.7 },
  { key: 'kpiNew010', label: '010 신규', point: 1.5 },
  { key: 'kpiGibyeonA', label: '기변A', point: 1 },
  { key: 'kpiGibyeonB', label: '기변B', point: 0.8 },
  { key: 'kpiGibyeonC', label: '기변C', point: 0.5 },
  { key: 'kpiSecond', label: '2ND', point: 0.2 },
  { key: 'kpiSimMnp', label: 'SIM MNP', point: 1 },
  { key: 'kpiUsedNew010', label: '중고 010신규 (66군 이상)', point: 0.5 },
  { key: 'kpiHome', label: '홈', point: 1 },
  { key: 'kpiTv', label: 'TV', point: 1 },
  { key: 'kpiTvSetTop', label: 'TV부셋탑', point: 0.5 },
  { key: 'kpiSmartHome', label: '스마트홈', point: 0.5 },
  { key: 'kpiInternetRenew', label: '인터넷 재약정', point: 0.3 },
  { key: 'kpiTvRenew', label: 'TV 재약정', point: 0.3 },
];

const HOME_BASE_ITEMS = [
  { key: 'homeOnly', label: '홈 단독', point: 1 },
  { key: 'homeTv', label: '홈+TV 동시청약', point: 2 },
];

// v21.15: 홈 청약을 가정망/소호망으로 분리 저장.
// 현재 월 인센티브 계산식은 기존 정책을 유지하고, 다음달 정책 확정 시 망별 단가를 별도 적용할 수 있게 데이터부터 분리합니다.
const HOME_NETWORK_TYPES = [
  { key: 'household', label: '가정망' },
  { key: 'soho', label: '소호망' },
];
const HOME_SALE_TYPES = [
  { key: 'normal', label: '일반' },
  { key: 'allinone', label: '올인원' },
];
function homeNetworkLabel(value) {
  return HOME_NETWORK_TYPES.find(x=>x.key===value)?.label || '망 미지정';
}
function homeMainTvPlanLabel(value,networkType=''){
  if(value==='broadcastPass')return '방송패스';
  if(value==='premium')return '프리미엄';
  if(value==='belowPremium')return '프리미엄 미만';
  return septemberMainTvPlan(networkType);
}

const DEFAULT_HOME_TIERS = [
  { min: 1, rate: 500000 },
  { min: 2, rate: 600000 },
  { min: 3, rate: 700000 },
  { min: 5, rate: 800000 },
  { min: 7, rate: 900000 },
  { min: 10, rate: 1000000 },
];

const DEFAULT_HOME_FLAT = [
  { key: 'home1GBOnly', label: '1GB 단독', rate: 200000, point: 0 },
  { key: 'home500Only', label: '500MB 단독', rate: 100000, point: 0 },
  { key: 'home100Only', label: '100MB 단독', rate: 50000, point: 0 },
  { key: 'tvFree', label: 'TV프리(부)', rate: 100000, point: 0.5 },
  { key: 'smartHome', label: '스마트홈', rate: 100000, point: 0.5 },
];

const DEFAULT_HOME_ADDON = [
  { key: 'addNewChange', label: '신규/기변 동시판매', rate: 100000 },
  { key: 'addMnp', label: 'MNP 동시판매', rate: 300000 },
  { key: 'addUsedMnp', label: '중고MNP 동시판매 (85군↑ 선약, 가정망)', rate: 200000 },
  { key: 'addSetTop', label: '부셋탑 동시청약', rate: 50000 },
  { key: 'smartHomeSimul', label: '스마트홈 동시판매', rate: 50000 },
];

const DEFAULT_RENEW = [
  { key: 'renew