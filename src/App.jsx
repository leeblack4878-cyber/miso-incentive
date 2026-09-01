Warning: truncated output (original token count: 185662)
Total output lines: 11014

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
  SEPTEMBER_POLICY_MONTH, SEPTEMBER_POLICY_VERSION, SEPTEMBER_TV_PLAN, SEPTEMBER_MATRIX_COLUMNS,
  SEPTEMBER_SPECIAL_SALES, calculateSeptemberSpecialSale,
  calculateSeptemberBundleSale, calculateSeptemberSono, calculateSeptemberTailoredTier, septemberConfig,
} from './septemberPolicy';
import { calculateSaleStrategicPoints, calculateEmployeeStrategicAdjustment } from './strategicPoints';

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

/* v21.63 새 홈 인센티브 정책
   - 그레이드 구간 산정: 가정망+소호망 전체 인터넷 가입건 합산, 단독 포함
   - 그레이드 수수료 지급: 인터넷+TV 가입건만
   - 인터넷 단독: 1G 20만 / 500M 10만 / 100M 5만, HS 동시판매 +5만
   - 가정망 인터넷+TV: 1G 25/35/45/55/65/75만, 500M은 각 구간 +2만
   - 소호 인터넷+TV: 1G 44/54/64/74/84/94만, 500M 34/44/54/64/74/84만
   - 인터넷+TV HS 동시판매: 신규/기변 +10만 / MNP +30만 / 조건충족 중고MNP(가정망) +20만
*/
const HOME_GRADE_THRESHOLDS = [1,2,3,5,7,10];
const HOME_HOUSEHOLD_1G = [250000,350000,450000,550000,650000,750000];
const HOME_SOHO_1G = [440000,540000,640000,740000,840000,940000];
const HOME_SOHO_500 = [340000,440000,540000,640000,740000,840000];

function homeGradeIndex(totalInternetCount){
  let idx=-1;
  HOME_GRADE_THRESHOLDS.forEach((min,i)=>{ if(Number(totalInternetCount||0)>=min) idx=i; });
  return idx;
}
function homeTvGradeRate(totalInternetCount,networkType,speed){
  const idx=homeGradeIndex(totalInternetCount);
  if(idx<0)return 0;
  if(networkType==='soho'){
    if(speed==='1g')return HOME_SOHO_1G[idx];
    if(speed==='500')return HOME_SOHO_500[idx];
    return 0; // 소호 인터넷+TV 100M 단가는 현재 정책 미설정
  }
  if(speed==='1g')return HOME_HOUSEHOLD_1G[idx];
  if(speed==='500')return HOME_HOUSEHOLD_1G[idx]+20000;
  return 0; // 가정망 인터넷+TV 100M 단가는 현재 정책 미설정
}
function homeSoloRate(speed){
  if(speed==='1g')return 200000;
  if(speed==='500')return 100000;
  if(speed==='100')return 50000;
  return 0;
}
function homeSimulTypeFromProducts(types){
  if(types.has('simulUsedMnp'))return 'usedMnp';
  if(types.has('simulMnp'))return 'mnp';
  if(types.has('simulNewChange'))return 'newChange';
  return 'none';
}
function buildHomeBundlesFromOrders(orders=[]){
  const map=new Map();
  (orders||[]).filter(o=>o&&o.status==='completed').forEach(o=>{
    const date=String(o.source_work_date||o.actual_install_date||'').slice(0,10);
    const customerId=String(o.customer_id||'');
    const customer=String(o.customer_name||'이름 없음');
    const key=`${date}|${customerId||customer}`;
    const cur=map.get(key)||{key,date,customer,networkType:o.network_type||'',saleType:o.sale_type||'normal',types:new Set(),orders:[]};
    cur.networkType=cur.networkType||o.network_type||'';
    cur.saleType=cur.saleType||o.sale_type||'normal';
    cur.types.add(o.product_type);
    cur.orders.push(o);
    map.set(key,cur);
  });
  return [...map.values()].map(b=>{
    const speed=b.types.has('internet1g')?'1g':b.types.has('internet500')?'500':b.types.has('internet100')?'100':'';
    return {...b,speed,hasInternet:!!speed,hasTv:b.types.has('homeTv'),simul:homeSimulTypeFromProducts(b.types)};
  });
}
function calculateHomePolicyFromOrders(orders=[],config={}){
  const bundles=buildHomeBundlesFromOrders(orders);
  const internetBundles=bundles.filter(b=>b.hasInternet);
  const totalInternetCount=internetBundles.length;
  const gradeIdx=homeGradeIndex(totalInternetCount);
  const tierMin=gradeIdx>=0?HOME_GRADE_THRESHOLDS[gradeIdx]:0;
  let gradePay=0,soloPay=0,simulPay=0,tvFreePay=0,smartHomePay=0,smartHomeSimulPay=0,subSetTopPay=0;
  const details=[];
  const tvFreeRate=Number((config.homeFlat||DEFAULT_HOME_FLAT).find(x=>x.key==='tvFree')?.rate||0);
  const smartHomeRate=Number((config.homeFlat||DEFAULT_HOME_FLAT).find(x=>x.key==='smartHome')?.rate||0);
  const smartHomeSimulRate=Number((config.homeAddon||DEFAULT_HOME_ADDON).find(x=>x.key==='smartHomeSimul')?.rate||0);
  const setTopRate=Number((config.homeAddon||DEFAULT_HOME_ADDON).find(x=>x.key==='addSetTop')?.rate||0);

  internetBundles.forEach(b=>{
    const network=b.networkType==='soho'?'soho':'household';
    const networkLabel=network==='soho'?'소호망':'가정망';
    const speedLabel=b.speed==='1g'?'1GB':b.speed==='500'?'500MB':'100MB';
    if(b.saleType==='allinone'){
      details.push({date:b.date,customer:b.customer,type:'홈',item:'올인원 홈',amount:0,note:`${networkLabel} · ${speedLabel} · 인센티브 0원 · 그레이드/성과 인정`});
      return;
    }
    if(b.hasTv){
      const base=homeTvGradeRate(totalInternetCount,network,b.speed);
      gradePay+=base;
      details.push({date:b.date,customer:b.customer,type:'홈',item:'인터넷+TV 그레이드 수수료',amount:base,note:`${networkLabel} · ${speedLabel} · 총 인터넷 ${totalInternetCount}건 (${tierMin}건 구간)`});
      let add=0,addLabel='';
      if(b.simul==='newChange'){add=100000;addLabel='홈 + HS 신규/기변 동시판매';}
      else if(b.simul==='mnp'){add=300000;addLabel='홈 + HS MNP 동시판매';}
      else if(b.simul==='usedMnp'&&network==='household'){add=200000;addLabel='홈 + 중고MNP 동시판매 (85군↑·선약)';}
      if(add){simulPay+=add;details.push({date:b.date,customer:b.customer,type:'홈',item:addLabel,amount:add,note:`인터넷+TV · ${networkLabel}`});}
    }else{
      const base=homeSoloRate(b.speed);
      soloPay+=base;
      details.push({date:b.date,customer:b.customer,type:'홈',item:'인터넷 단독 수수료',amount:base,note:`${networkLabel} · ${speedLabel} · 그레이드 건수에는 포함`});
      if(b.simul!=='none'){
        simulPay+=50000;
        details.push({date:b.date,customer:b.customer,type:'홈',item:'홈 단독 + HS 동시판매',amount:50000,note:'HS 가입유형 공통 +5만원'});
      }
    }
    if(b.types.has('tvFree')&&tvFreeRate){tvFreePay+=tvFreeRate;details.push({date:b.date,customer:b.customer,type:'홈',item:'TV프리(부)',amount:tvFreeRate,note:'부가 홈 수수료'});}
    if(b.types.has('smartHome')&&smartHomeRate){smartHomePay+=smartHomeRate;details.push({date:b.date,customer:b.customer,type:'홈',item:'스마트홈',amount:smartHomeRate,note:'부가 홈 수수료'});}
    if(b.types.has('smartHome')&&b.simul!=='none'&&smartHomeSimulRate){smartHomeSimulPay+=smartHomeSimulRate;details.push({date:b.date,customer:b.customer,type:'홈',item:'스마트홈 동시판매',amount:smartHomeSimulRate,note:'스마트홈 + HS 동시판매 추가 수수료'});}
    if(b.types.has('subSetTop')&&setTopRate){subSetTopPay+=setTopRate;details.push({date:b.date,customer:b.customer,type:'홈',item:'일반 부셋탑',amount:setTopRate,note:'부가 홈 수수료'});}
  });

  // 인터넷 없는 부가 홈만 별도로 등록된 경우도 누락하지 않음
  bundles.filter(b=>!b.hasInternet).forEach(b=>{
    if(b.saleType==='allinone'){
      details.push({date:b.date,customer:b.customer,type:'홈',item:'올인원 홈',amount:0,note:`${b.networkType==='soho'?'소호망':'가정망'} · 인센티브 0원 · 성과 인정`});
      return;
    }
    if(b.types.has('tvFree')&&tvFreeRate){tvFreePay+=tvFreeRate;details.push({date:b.date,customer:b.customer,type:'홈',item:'TV프리(부)',amount:tvFreeRate,note:'부가 홈 수수료'});}
    if(b.types.has('smartHome')&&smartHomeRate){smartHomePay+=smartHomeRate;details.push({date:b.date,customer:b.customer,type:'홈',item:'스마트홈',amount:smartHomeRate,note:'부가 홈 수수료'});}
    if(b.types.has('smartHome')&&b.simul!=='none'&&smartHomeSimulRate){smartHomeSimulPay+=smartHomeSimulRate;details.push({date:b.date,customer:b.customer,type:'홈',item:'스마트홈 동시판매',amount:smartHomeSimulRate,note:'스마트홈 + HS 동시판매 추가 수수료'});}
    if(b.types.has('subSetTop')&&setTopRate){subSetTopPay+=setTopRate;details.push({date:b.date,customer:b.customer,type:'홈',item:'일반 부셋탑',amount:setTopRate,note:'부가 홈 수수료'});}
  });

  const homeFlatPay=soloPay+tvFreePay+smartHomePay;
  const homeAddonPay=simulPay+smartHomeSimulPay+subSetTopPay;
  return {
    source:'orders',totalInternetCount,tierMin,
    gradePay,soloPay,simulPay,tvFreePay,smartHomePay,smartHomeSimulPay,subSetTopPay,
    homeFlatPay,homeAddonPay,total:gradePay+homeFlatPay+homeAddonPay,details
  };
}

const DEFAULT_RENEW = [
  { key: 'renewPremiumSafe1G', label: '재약정 - 프리미엄 안심보상 1GB', rate: 120000 },
  { key: 'renewPremiumSafe500', label: '재약정 - 프리미엄 안심보상 500MB', rate: 90000 },
  { key: 'renewPremium1G', label: '재약정 - 프리미엄 안심 1GB', rate: 110000 },
  { key: 'renewPremium500', label: '재약정 - 프리미엄 안심 500MB', rate: 80000 },
  { key: 'renewSmart1G', label: '재약정 - 스마트 1GB', rate: 20000 },
  { key: 'renewSimul1G', label: '재약정 - 동시판매 1GB', rate: 80000 },
  { key: 'renewSimul500', label: '재약정 - 동시판매 500MB', rate: 50000 },
  { key: 'renewTvUpsell', label: 'TV 업셀 수수료', rate: 20000 },
];

const HOUSEHOLD_RENEW_PLANS = [
  { key:'premiumSafe', label:'프리미엄 안심 보상' },
  { key:'premium', label:'프리미엄 안심' },
  { key:'smart', label:'스마트' },
];
function householdRenewBaseKey(speed, plan){
  if(speed==='1g'&&plan==='premiumSafe')return 'renewPremiumSafe1G';
  if(speed==='500'&&plan==='premiumSafe')return 'renewPremiumSafe500';
  if(speed==='1g'&&plan==='premium')return 'renewPremium1G';
  if(speed==='500'&&plan==='premium')return 'renewPremium500';
  if(speed==='1g'&&plan==='smart')return 'renewSmart1G';
  return '';
}
function renewRate(config,key){ return Number((config?.renew||DEFAULT_RENEW).find(x=>x.key===key)?.rate||0); }
function calculateHouseholdRenew(item,config){
  const speed=item?.speed||'1g';
  if(config?.policyVersion===SEPTEMBER_POLICY_VERSION){
    const invalid=!!item?.downSpeed;
    const premiumSafe=item?.plan==='premiumSafe';
    const baseKey=premiumSafe
      ? `renewPremiumSafe${speed==='1g'?'1G':speed==='500'?'500':'100'}`
      : `renewOther${speed==='1g'?'1G':speed==='500'?'500':'100'}`;
    const base=invalid?0:renewRate(config,baseKey);
    const speedUpPay=!invalid&&item?.speedUp?renewRate(config,'renewSpeedUp'):0;
    const hsKey=speed==='1g'?'renewSimul1G':speed==='500'?'renewSimul500':'';
    const hsPay=!invalid&&item?.hsSimul&&hsKey?renewRate(config,hsKey):0;
    const tvPay=!invalid&&item?.tvUpsell?renewRate(config,'renewTvUpsell'):0;
    return {invalid,baseKey,base,soloDiscount:0,hsKey,hsPay,tvPay,speedUpPay,amount:Math.max(0,base+speedUpPay+hsPay+tvPay)};
  }
  const invalid=speed==='100'||!!item?.downSpeed||!!item?.temporaryUpgradeSame;
  const baseKey=householdRenewBaseKey(speed,item?.plan||'premiumSafe');
  const base=invalid?0:renewRate(config,baseKey);
  const soloDiscount=invalid?0:(item?.homeOnly?Math.min(50000,base):0);
  const hsKey=speed==='1g'?'renewSimul1G':speed==='500'?'renewSimul500':'';
  const hsPay=(!invalid&&item?.hsSimul)?renewRate(config,hsKey):0;
  const tvPay=(!invalid&&!item?.homeOnly&&item?.tvUpsell)?renewRate(config,'renewTvUpsell'):0;
  return {invalid,baseKey,base,soloDiscount,hsKey,hsPay,tvPay,amount:Math.max(0,base-soloDiscount+hsPay+tvPay)};
}
function aggregateHouseholdRenewals(items,config){
  const counts={}; let soloDiscount=0;
  (items||[]).forEach(item=>{
    const c=calculateHouseholdRenew(item,config);
    if(c.invalid)return;
    if(c.baseKey&&c.base>0)counts[c.baseKey]=(counts[c.baseKey]||0)+1;
    if(item.hsSimul&&c.hsKey&&c.hsPay>0)counts[c.hsKey]=(counts[c.hsKey]||0)+1;
    if(item.speedUp&&c.speedUpPay>0)counts.renewSpeedUp=(counts.renewSpeedUp||0)+1;
    if(item.tvUpsell&&c.tvPay>0)counts.renewTvUpsell=(counts.renewTvUpsell||0)+1;
    soloDiscount+=c.soloDiscount;
  });
  return {counts,soloDiscount};
}
function emptyHouseholdRenewForm(){
  return {customer:'',speed:'1g',plan:'premiumSafe',homeOnly:false,hsSimul:false,tvUpsell:false,speedUp:false,downSpeed:false,temporaryUpgradeSame:false};
}


const MATRIX_ROW_DEFS = [
  { label: '일반모델 신규', dailyLabel: '신규', hasTiers: true },
  { label: '일반모델 MNP', dailyLabel: 'MNP', hasTiers: true },
  { label: '일반모델 기변A', dailyLabel: '기기변경 A', hasTiers: true, isGibyeon: true },
  { label: '일반모델 기변B', dailyLabel: '기기변경 B', hasTiers: true, isGibyeon: true },
  { label: '일반모델 기변C', dailyLabel: '기기변경 C', hasTiers: true, isGibyeon: true },
  { label: 'SIM MNP', dailyLabel: 'SIM MNP(선약)', hasTiers: true },
  { label: '중고 신규(66군↑)', dailyLabel: '중고 신규(66군 이상)', hasTiers: false }, // 인센티브 무관 — 요금제군 구분 없이 건수만
  { label: '2ND단독', dailyLabel: '2ND단독', hasTiers: false }, // 요금제군 구분 없이 건수만, 단일 단가 적용
];
const MATRIX_ROWS = MATRIX_ROW_DEFS.map((r) => r.label);
const MATRIX_COLS = ['115군↑', '95~105군·청소년85군', '85군', '61군이상', '약자요금제', '그 외'];
const DEFAULT_MATRIX = [
  [5, 3, 2, 1, 1, 0],       // 일반모델 신규
  [9, 6, 5, 4, 4, 2],       // 일반모델 MNP
  [5, 3, 2, 1, 1, 0],       // 일반모델 기변A
  [5, 3, 2, 1, 1, 0],       // 일반모델 기변B (A와 동일)
  [2.5, 1.5, 1, 0.5, 0.5, 0], // 일반모델 기변C (A/B의 50%)
  [10, 10, 10, 7, 5, 5],    // SIM MNP
  [0, 0, 0, 0, 0, 0],       // 중고 신규(66군↑) — 인센티브 무관, 항상 0
  [5, 0, 0, 0, 0, 0],       // 2ND — 단일 단가 (건당 5만원)
].map((row) => row.map((v) => v * 10000));

// 가입구분(매트릭스 행) → 성과등급P 항목 / KPI 항목 기본 매핑. 관리자 화면에서 수정 가능.
// 기변A/B/C(isGibyeon) 행은 성과등급P만은 타겟(A/B/C) 상관없이 요금제군(열) 기준으로 통일 적용 — gibyeonColumnMap 참고. KPI는 타겟별로 그대로 유지.
const DEFAULT_CATEGORY_MAP = [
  { mobilePointKey: 'new010', kpiKey: 'kpiNew010' },        // 일반모델 신규
  { mobilePointKey: 'mnp', kpiKey: 'kpiMnp' },               // 일반모델 MNP
  { mobilePointKey: '', kpiKey: 'kpiGibyeonA' },             // 일반모델 기변A (성과등급P는 열 기준)
  { mobilePointKey: '', kpiKey: 'kpiGibyeonB' },             // 일반모델 기변B (성과등급P는 열 기준)
  { mobilePointKey: '', kpiKey: 'kpiGibyeonC' },             // 일반모델 기변C (성과등급P는 열 기준)
  { mobilePointKey: 'usedMnp', kpiKey: 'kpiSimMnp' },        // SIM MNP = 중고 MNP(선약가입건)
  { mobilePointKey: '', kpiKey: 'kpiUsedNew010' },           // 중고 신규(66군↑) — 인센티브 무관, KPI만 반영
  { mobilePointKey: 'secondOnly', kpiKey: 'kpiSecond' },     // 2ND
];

// 기변 행(A/B/C 공통) 요금제군별 성과등급P — 115군↑ 1P / 95~105군·청소년85군 0.7P / 85군 0.7P / 약자 0.5P / 61군이상·그외 0.3P
const DEFAULT_GIBYEON_COLUMN_MAP = ['gibyeon115', 'gibyeon85', 'gibyeon85', 'gibyeonLVC', 'gibyeonWeak', 'gibyeonLVC'];

const DEFAULT_VAS = [
  { key: 'vasKyobo', label: '교보문고sam + 구글원', rate: 20000 },
  { key: 'vasVcolor', label: 'V컬러링 + 벨링콘텐츠팩', rate: 20000 },
  { key: 'vasPhonePass', label: '폰교체패스', rate: 10000 },
  { key: 'vasSafePass', label: '폰안심패스', rate: 0 },
];

// 운영 DB에 저장된 이전 VAS 설정에도 새 기본 항목을 보강하되,
// 관리자가 수정한 명칭·금액과 별도 추가 항목은 그대로 유지한다.
const mergeDefaultVas = (saved=[]) => [
  ...DEFAULT_VAS.map(def => ({ ...def, ...(saved||[]).find(item => item.key===def.key) })),
  ...(saved||[]).filter(item => !DEFAULT_VAS.some(def => def.key===item.key)),
];

const DEFAULT_BUNDLE2ND = [
  { key: 'b_L335', label: '2ND · L335', rate: 200000 },
  { key: 'b_X216', label: '2ND · X216', rate: 200000 },
  { key: 'b_X236', label: '2ND · X236', rate: 150000 },
  { key: 'b_X236NP', label: '2ND · X236-NP', rate: 200000 },
  { key: 'b_L505', label: '2ND · L505', rate: 200000 },
  { key: 'b_L705', label: '2ND · L705(2025)', rate: 200000 },
  { key: 'b_L345', label: '2ND · L345(40mm)', rate: 200000 },
  { key: 'b_L355', label: '2ND · L355(44mm)', rate: 200000 },
  { key: 'b_L715', label: '2ND · L715', rate: 200000 },
  { key: 'b_AppleWatch', label: '2ND · 애플워치SE3 (아이폰14~17)', rate: 150000 },
];

const DEFAULT_SONO = [
  { key: 'sonoBasic', label: '소노 NEW 라이프케어', rate: 80000 },
  { key: 'sono594', label: '594만 상품', rate: 60000 },
];

const DEFAULT_MNP_BUNDLE = [
  { key: 'usedMnpBundle', label: '중고 MNP 결합 활성화 (61군↑ 개통·결합완료)', rate: 100000 },
];

const DEFAULT_CUSTREG_TIERS = [
  { min: 20, bonus: 100000 },
  { min: 30, bonus: 150000 },
  { min: 40, bonus: 200000 },
];
const DEFAULT_TAILORED_TIERS = [
  { min: 10, bonus: 70000 },
  { min: 15, bonus: 150000 },
  { min: 20, bonus: 200000 },
  { min: 25, bonus: 300000 },
  { min: 30, bonus: 400000 },
];


function displayStoreName(name) {
  const value = String(name || '');
  const idx = value.indexOf('_');
  return idx >= 0 ? value.slice(idx + 1) : value;
}

function sortStoresByOpenOrder(list=[]) {
  const order = new Map(DEFAULT_STORES.map((name, idx) => [name, idx]));
  return [...new Set((list || []).filter(Boolean))].sort((a,b)=>{
    const ai = order.has(a) ? order.get(a) : 9999;
    const bi = order.has(b) ? order.get(b) : 9999;
    if (ai !== bi) return ai - bi;
    return displayStoreName(a).localeCompare(displayStoreName(b), 'ko');
  });
}

function defaultConfig() {
  return {
    basePay: { ...DEFAULT_BASE_PAY },
    positionAllowance: { ...DEFAULT_POSITION_ALLOWANCE },
    mobilePointItems: DEFAULT_MOBILE_POINT_ITEMS.map((i) => ({ ...i })),
    kpiItems: DEFAULT_KPI_ITEMS.map((i) => ({ ...i })),
    categoryMap: DEFAULT_CATEGORY_MAP.map((i) => ({ ...i })),
    gibyeonColumnMap: [...DEFAULT_GIBYEON_COLUMN_MAP],
    basePenalty: DEFAULT_BASE_PENALTY,
    tenure: DEFAULT_TENURE.map((t) => ({ ...t })),
    tenureCap: DEFAULT_TENURE_CAP,
    grades: DEFAULT_GRADES.map((g) => ({ ...g })),
    homeTiers: DEFAULT_HOME_TIERS.map((t) => ({ ...t })),
    homeFlat: DEFAULT_HOME_FLAT.map((t) => ({ ...t })),
    homeAddon: DEFAULT_HOME_ADDON.map((t) => ({ ...t })),
    renew: DEFAULT_RENEW.map((t) => ({ ...t })),
    matrix: DEFAULT_MATRIX.map((row) => [...row]),
    vas: DEFAULT_VAS.map((t) => ({ ...t })),
    bundle2nd: DEFAULT_BUNDLE2ND.map((t) => ({ ...t })),
    sono: DEFAULT_SONO.map((t) => ({ ...t })),
    mnpBundle: DEFAULT_MNP_BUNDLE.map((t) => ({ ...t })),
    custRegTiers: DEFAULT_CUSTREG_TIERS.map((t) => ({ ...t })),
    tailoredTiers: DEFAULT_TAILORED_TIERS.map((t) => ({ ...t })),
  };
}

function emptyDraft() {
  return {
    activityTimeMet: true,
    homeNoPerformance: false,
    mobilePoint: {},
    kpi: {},
    homeBase: Object.fromEntries(HOME_BASE_ITEMS.map((i) => [i.key, 0])),
    homeFlat: Object.fromEntries(DEFAULT_HOME_FLAT.map((i) => [i.key, 0])),
    homeAddon: Object.fromEntries(DEFAULT_HOME_ADDON.map((i) => [i.key, 0])),
    renew: Object.fromEntries(DEFAULT_RENEW.map((i) => [i.key, 0])),
    matrix: MATRIX_ROWS.map(() => MATRIX_COLS.map(() => 0)),
    vas: Object.fromEntries(DEFAULT_VAS.map((i) => [i.key, 0])),
    bundle2nd: Object.fromEntries(DEFAULT_BUNDLE2ND.map((i) => [i.key, 0])),
    sono: Object.fromEntries(DEFAULT_SONO.map((i) => [i.key, 0])),
    mnpBundle: Object.fromEntries(DEFAULT_MNP_BUNDLE.map((i) => [i.key, 0])),
    custRegCount: 0,
    tailoredCount: 0,
    tailoredAmount: 0,
  };
}

/* ===================== 유틸 ===================== */

/* v21.22: 금액·건수·목표 등 일반 숫자 표시는 천 단위 콤마를 공통 적용. 날짜/요금제/속도/전화번호 등 식별자 숫자는 제외. */

function fmtNum(n, maxFraction = 0) {
  const num = Number(n || 0);
  if (!Number.isFinite(num)) return '0';
  return num.toLocaleString('ko-KR', { maximumFractionDigits: maxFraction, minimumFractionDigits: 0 });
}
function fmtCount(n) { return fmtNum(Math.round(Number(n || 0))); }
function fmtShortDate(v) {
  if (!v) return '';
  const d = String(v).slice(0,10);
  const [y,m,day] = d.split('-');
  return y && m && day ? `${y}.${m}.${day}` : d;
}
function fmtInputNumber(v) {
  const digits = String(v ?? '').replace(/\D/g, '');
  return digits ? Number(digits).toLocaleString('ko-KR') : '';
}
function won(n) { return `${fmtNum(Math.round(Number(n || 0)))}원`; }
function monthKeyOf(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
function monthLabel(key) { const [y, m] = key.split('-'); return `${y}년 ${parseInt(m, 10)}월`; }
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
function sumPoint(counts, table) { return table.reduce((s, t) => s + (counts[t.key] || 0) * t.point, 0); }
function tierBonus(count, tiers) {
  const sorted = [...tiers].sort((a, b) => b.min - a.min);
  const hit = sorted.find((t) => count >= t.min);
  return hit ? hit.bonus : 0;
}
function homeGradeTotal(tierCount, payableCount, tiers) {
  if (tierCount <= 0 || payableCount <= 0) return 0;
  const sorted = [...tiers].sort((a, b) => b.min - a.min);
  const hit = sorted.find((t) => tierCount >= t.min) || tiers[0];
  return payableCount * hit.rate;
}
function monthsSince(hireDate, monthKey) {
  if (!hireDate) return 0;
  const [y, m] = monthKey.split('-').map(Number);
  const monthEnd = new Date(y, m, 0);
  const hire = new Date(hireDate);
  if (isNaN(hire.getTime())) return 0;
  return Math.max(0, (monthEnd.getFullYear() - hire.getFullYear()) * 12 + (monthEnd.getMonth() - hire.getMonth()));
}
function tenureBucketOf(months) {
  if (months < 6) return 'under6';
  if (months < 12) return 'under12';
  if (months < 24) return 'over12';
  return 'over24';
}

function daysInMonth(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}
function emptyDayMatrix() { return MATRIX_ROWS.map(() => MATRIX_COLS.map(() => 0)); }

/* ===== 일일입력이 다루는 건수 그룹 — 모든 실적을 날짜별로 기록 ===== */

const DAILY_GROUP_DEFS = [
  { key: 'homeBase', label: '홈 실적 (그레이드 대상)', bucket: 'home' },
  { key: 'homeFlat', label: '홈 단독 / TV프리 / 스마트홈', bucket: 'home' },
  { key: 'homeAddon', label: '동시판매 수수료', bucket: 'home' },
  { key: 'renew', label: '인터넷 재약정', bucket: 'home' },
  { key: 'bundle2nd', label: '2ND 번들 판매', bucket: 'extra' },
  { key: 'vas', label: '전략 부가서비스 (VAS)', bucket: 'extra' },
  { key: 'sono', label: '소노', bucket: 'extra' },
  { key: 'mnpBundle', label: '중고MNP 결합', bucket: 'extra' },
];
const DAILY_GROUP_KEYS = DAILY_GROUP_DEFS.map((g) => g.key);
const DAILY_NUMERIC_KEYS = ['custRegCount', 'tailoredCount', 'tailoredAmount', 'specialMatrixOffset', 'specialVasOffset', 'specialReplacementPay', 'bundleFreeOffset', 'bundleFreeVasOffset', 'renewSoloDiscountAmount'];

function groupTable(config, key) {
  if (key === 'homeBase') return HOME_BASE_ITEMS;
  return (config && config[key]) || [];
}

// 홈·부가 실적 → 생산성 항목 자동 반영 규칙
const HOME_KPI_MAP = [
  { kpiKey: 'kpiHome', sources: ['homeBase.homeOnly', 'homeBase.homeTv'] },
  { kpiKey: 'kpiTv', sources: ['homeBase.homeTv'] },
  { kpiKey: 'kpiTvSetTop', sources: ['homeAddon.addSetTop', 'homeFlat.tvFree'] },
  { kpiKey: 'kpiSmartHome', sources: ['homeFlat.smartHome', 'homeAddon.smartHomeSimul'] },
  { kpiKey: 'kpiInternetRenew', sources: [] },
  { kpiKey: 'kpiTvRenew', sources: [] },
];

function emptyDay() {
  return {
    matrix: emptyDayMatrix(),
    groups: Object.fromEntries(DAILY_GROUP_KEYS.map((k) => [k, {}])),
    custRegCount: 0, tailoredCount: 0, tailoredAmount: 0, specialMatrixOffset: 0, specialVasOffset: 0, specialReplacementPay: 0, bundleFreeOffset: 0, bundleFreeVasOffset: 0, renewSoloDiscountAmount: 0,
    householdRenewals: [], householdRenewLegacyCounts: {},
    dayOff: false,
  };
}

// 예전 형식(매트릭스 배열만 저장)도 그대로 읽히도록 변환
function normalizeDay(raw) {
  const base = emptyDay();
  if (!raw) return base;
  if (Array.isArray(raw)) return { ...base, matrix: raw };
  return {
    ...base,
    matrix: raw.matrix || base.matrix,
    groups: { ...base.groups, ...(raw.groups || {}) },
    custRegCount: raw.custRegCount || 0,
    tailoredCount: raw.tailoredCount || 0,
    tailoredAmount: raw.tailoredAmount || 0,
    specialMatrixOffset: raw.specialMatrixOffset || 0,
    specialVasOffset: raw.specialVasOffset || 0,
    specialReplacementPay: raw.specialReplacementPay || 0,
    bundleFreeOffset: raw.bundleFreeOffset || 0,
    bundleFreeVasOffset: raw.bundleFreeVasOffset || 0,
    renewSoloDiscountAmount: raw.renewSoloDiscountAmount || 0,
    householdRenewals: Array.isArray(raw.householdRenewals) ? raw.householdRenewals : [],
    householdRenewLegacyCounts: raw.householdRenewLegacyCounts && typeof raw.householdRenewLegacyCounts==='object' ? raw.householdRenewLegacyCounts : {},
    dayOff: !!raw.dayOff,
  };
}


// 달력용 핵심 실적 요약.
// 현재 daily_records 형식뿐 아니라 예전 top-level 그룹 저장 형식도 함께 읽습니다.
function calendarCoreMetrics(raw){
  const d=normalizeDay(raw);
  const rawObj=(raw && !Array.isArray(raw) && typeof raw==='object')?raw:{};

  const matrix=Array.isArray(raw)?raw:(rawObj.matrix||d.matrix||[]);
  const hs=[0,1,2,3,4].reduce((sum,ri)=>sum+(matrix?.[ri]||[]).reduce((a,v)=>a+Number(v||0),0),0);
  const sim=(matrix?.[5]||[]).reduce((a,v)=>a+Number(v||0),0);

  // 현행 groups.homeBase / 구형 top-level homeBase 모두 호환
  const groupedHome={
    ...(rawObj.homeBase||{}),
    ...(rawObj.groups?.homeBase||{}),
    ...(d.groups?.homeBase||{}),
  };
  const flatHome={
    ...(rawObj.homeFlat||{}),
    ...(rawObj.groups?.homeFlat||{}),
    ...(d.groups?.homeFlat||{}),
  };

  // 홈은 본 판매 기준. 구형 데이터 중 본상품 키 없이 속도 단독키만 남은 경우도 1건으로 인식.
  const baseHome=Number(groupedHome.homeOnly||0)+Number(groupedHome.homeTv||0);
  const speedHome=Number(flatHome.home100Only||0)+Number(flatHome.home500Only||0)+Number(flatHome.home1GBOnly||0);
  const home=baseHome>0?baseHome:speedHome;

  return {hs,sim,home};
}

function dayHasData(raw) {
  if (!raw) return false;
  const d = normalizeDay(raw);
  if (d.matrix.some((row) => row.some((v) => v > 0))) return true;
  if (DAILY_GROUP_KEYS.some((k) => Object.values(d.groups[k] || {}).some((v) => v > 0))) return true;
  if ((d.householdRenewals||[]).length > 0) return true;
  return DAILY_NUMERIC_KEYS.some((k) => (d[k] || 0) > 0);
}

// 그 달의 일일 입력 전체를 합산
function aggregateDaily(daysMap, monthKey) {
  const agg = emptyDay();
  const n = daysInMonth(monthKey);
  for (let i = 1; i <= n; i++) {
    const raw = daysMap && daysMap[String(i).padStart(2, '0')];
    if (!raw) continue;
    const d = normalizeDay(raw);
    d.matrix.forEach((row, ri) => row.forEach((v, ci) => { agg.matrix[ri][ci] += v || 0; }));
    DAILY_GROUP_KEYS.forEach((gk) => {
      Object.entries(d.groups[gk] || {}).forEach(([k, v]) => { agg.groups[gk][k] = (agg.groups[gk][k] || 0) + (v || 0); });
    });
    DAILY_NUMERIC_KEYS.forEach((k) => { agg[k] += d[k] || 0; });
  }
  return agg;
}

// 합산된 일일입력을 성과등급P/KPI/각 건수 그룹에 자동 반영해 draft를 보강
function applyDailyToDraft(draft, dailyDaysMap, month, categoryMap, gibyeonColumnMap) {
  const agg = aggregateDaily(dailyDaysMap, month);
  const aggMatrix = agg.matrix;
  const colMap = gibyeonColumnMap || DEFAULT_GIBYEON_COLUMN_MAP;

  // 이 항목들은 이제 일일입력이 유일한 입력 경로라, "0이면 옛 값 유지" 하지 않고
  // 매번 그 달 일일 합계로 완전히 덮어씀 (삭제/정정이 그대로 반영되게)
  const trackedMobileKeys = new Set([
    ...(categoryMap || []).map((m) => m?.mobilePointKey).filter(Boolean),
    ...colMap.filter(Boolean),
  ]);
  const trackedKpiKeys = new Set([
    ...(categoryMap || []).map((m) => m?.kpiKey).filter(Boolean),
    ...HOME_KPI_MAP.map((m) => m.kpiKey),
  ]);

  const autoMobilePoint = Object.fromEntries([...trackedMobileKeys].map((k) => [k, 0]));
  const autoKpi = Object.fromEntries([...trackedKpiKeys].map((k) => [k, 0]));

  aggMatrix.forEach((row, ri) => {
    const rowTotal = row.reduce((s, v) => s + v, 0);
    const map = categoryMap?.[ri];
    if (!map) return;
    if (MATRIX_ROW_DEFS[ri]?.isGibyeon) {
      // 기변A/B/C 공통: 타겟과 무관하게 요금제군(열) 기준으로 성과등급P 배분
      row.forEach((cnt, ci) => {
        const key = colMap[ci];
        if (key) autoMobilePoint[key] = (autoMobilePoint[key] || 0) + (cnt || 0);
      });
    } else if (map.mobilePointKey) {
      autoMobilePoint[map.mobilePointKey] = (autoMobilePoint[map.mobilePointKey] || 0) + rowTotal;
    }
    if (map.kpiKey) autoKpi[map.kpiKey] = (autoKpi[map.kpiKey] || 0) + rowTotal;
  });

  // 홈/2ND/VAS/소노 등 건수 그룹 — 이제 일일입력이 유일한 입력 경로라 그 달 합계로 완전히 교체
  const mergedGroups = {};
  DAILY_GROUP_KEYS.forEach((gk) => { mergedGroups[gk] = { ...(agg.groups[gk] || {}) }; });

  const pick = (path) => {
    const [gk, k] = path.split('.');
    return (mergedGroups[gk] || {})[k] || 0;
  };
  HOME_KPI_MAP.forEach((m) => {
    const total = m.sources.reduce((s, p) => s + pick(p), 0);
    autoKpi[m.kpiKey] = (autoKpi[m.kpiKey] || 0) + total;
  });

  // v21.54: 재약정 KPI는 실제 계약 건수 기준으로 계산
  let internetRenewKpiCount = 0;
  let tvRenewKpiCount = 0;
  Object.values(dailyDaysMap || {}).forEach((raw) => {
    const rec = normalizeDay(raw);
    (rec.householdRenewals || []).forEach((item) => {
      internetRenewKpiCount += 1;
      if (!item.homeOnly) tvRenewKpiCount += 1;
    });
  });
  autoKpi.kpiInternetRenew = internetRenewKpiCount;
  autoKpi.kpiTvRenew = tvRenewKpiCount;

  const numeric = {};
  DAILY_NUMERIC_KEYS.forEach((k) => { numeric[k] = agg[k] || 0; });

  return {
    ...draft,
    ...mergedGroups,
    ...numeric,
    matrix: aggMatrix,
    mobilePoint: { ...draft.mobilePoint, ...autoMobilePoint },
    kpi: { ...draft.kpi, ...autoKpi },
  };
}

/* 급여 전체 계산 */
function computePay(draft, position, hireDate, month, config, mobileSpotPay = 0, strategicMetric = null) {
  const months = monthsSince(hireDate, month);
  const bucketKey = tenureBucketOf(months);
  const bucket = config.tenure.find((t) => t.key === bucketKey) || config.tenure[0];

  const mobileItems = config.mobilePointItems || DEFAULT_MOBILE_POINT_ITEMS;
  const kpiItems = config.kpiItems || DEFAULT_KPI_ITEMS;
  const kpiScore = sumPoint(draft.kpi || {}, kpiItems);

  // 영업 활동 지원 정책 대상 = HS + SIM MNP + 2ND
  // mobilePoint에는 HS/SIM MNP/2ND단독이 들어오고, 2ND 번들 판매건은 별도 그룹이므로 추가 합산합니다.
  const baseActivityCount = mobileItems
    .filter((i) => i.countsTenure !== false)
    .reduce((sum, item) => sum + Number(draft.mobilePoint?.[item.key] || 0), 0);
  const secondPolicy = calculateSecondPolicy({
    secondOnlyCount: draft.mobilePoint?.secondOnly,
    bundleCounts: draft.bundle2nd || {},
    pointRate: Number(mobileItems.find((item) => item.key === 'secondOnly')?.point || 0),
  });
  const bundle2ndActivityCount = secondPolicy.bundled;
  const activityCount = baseActivityCount + bundle2ndActivityCount;

  const supportCap = Number(config.tenureCap ?? DEFAULT_ACTIVITY_SUPPORT_MAX);
  // 6개월 미만: 실적 무관 230만원
  // 6~12개월: 건당 20만원 / 12~24개월: 15만원 / 24개월 이상: 10만원, 공통 MAX 230만원
  const tenurePay = calculateActivitySupport({monthsEmployed:months,activityCount,rate:bucket?.rate,cap:supportCap});

  // 2ND 성과등급P는 단독/번들 구분 없이 동일하게 인정합니다.
  // 단독은 mobilePoint.secondOnly에 포함되고, 번들은 bundle2nd에 별도 저장되므로
  // 번들 건수에 현재 2ND 성과등급 배점을 곱해 추가합니다. 무료판매도 실적은 인정됩니다.
  const bundle2ndPoints = Number((secondPolicy.bundled * Number(mobileItems.find((item) => item.key === 'secondOnly')?.point || 0)).toFixed(10));
  const mobilePoints = sumPoint(draft.mobilePoint || {}, mobileItems) + bundle2ndPoints;
  const homeAddonPoints = sumPoint(draft.homeBase || {}, HOME_BASE_ITEMS)
    + Number(draft.homeFlat?.tvFree || 0) * 0.5
    + Number(draft.homeFlat?.smartHome || 0) * 0.5;
  const homeGatePoints = Number(draft.homeBase?.homeOnly || 0) * HOME_GATE_WEIGHTS.homeOnly
    + Number(draft.homeBase?.homeTv || 0) * HOME_GATE_WEIGHTS.homeTv
    + Number(draft.homeFlat?.tvFree || 0) * HOME_GATE_WEIGHTS.tvFree
    + Number(draft.homeFlat?.smartHome || 0) * HOME_GATE_WEIGHTS.smartHome;
  const addonApplies = mobilePoints > ADDON_GATE;
  const totalPoints = mobilePoints + (addonApplies ? homeAddonPoints : 0);
  const gradeEligible = homeGatePoints >= HOME_GATE_MIN;
  const gradeSorted = [...config.grades].sort((a, b) => b.min - a.min);
  const gradeHit = gradeEligible
    ? (gradeSorted.find((g) => totalPoints >= g.min) || config.grades[config.grades.length - 1])
    : config.grades[config.grades.length - 1];
  const gradeBonus = gradeEligible ? Number(gradeHit.bonus || 0) : 0;
  const gradeAsc = [...config.grades].sort((a, b) => a.min - b.min);
  const nextGrade = gradeAsc.find((g) => g.min > totalPoints) || null;
  const currentTierMin = gradeHit.min || 0;
  const gradeProgress = nextGrade
    ? Math.max(0, Math.min(1, (totalPoints - currentTierMin) / (nextGrade.min - currentTierMin)))
    : 1;

  const specialMatrixOffset = Number(draft.specialMatrixOffset || 0);
  const specialVasOffset = Number(draft.specialVasOffset || 0);
  const specialReplacementPay = Number(draft.specialReplacementPay || 0);
  const bundleFreeOffset = Number(draft.bundleFreeOffset || 0);
  const bundleFreeVasOffset = Number(draft.bundleFreeVasOffset || 0);

  const homeAnyCount = Number(draft.homeBase?.homeOnly || 0) + Number(draft.homeBase?.homeTv || 0)
    + Number(draft.homeFlat?.home1GBOnly || 0) + Number(draft.homeFlat?.home500Only || 0) + Number(draft.homeFlat?.home100Only || 0)
    + Number(draft.homeFlat?.tvFree || 0) + Number(draft.homeFlat?.smartHome || 0);
  const homeNoPerformance = homeAnyCount === 0;
  const penaltyFactor = homeNoPerformance ? 0.5 : 1;

  const commissionParts = calculateMobileCommissionParts({
    matrix:draft.matrix||[],matrixRates:config.matrix||[],specialMatrixOffset,
    vasCounts:draft.vas||{},vasRates:config.vas||[],specialVasOffset,bundleFreeVasOffset,
    bundleCounts:draft.bundle2nd||{},bundleRates:config.bundle2nd||[],bundleFreeOffset,
    penaltyFactor,
  });
  const {matrixTotal,adjustedMatrixTotal,rawBundle2ndTotal,bundle2ndTotal,rawVasPay,vasPay,mobilePlanPay,bundle2ndPay,mobileMatrixPay}=commissionParts;

  const positionAllowance = Number(config.positionAllowance?.[position] || 0);
  const activityPenalty = draft.activityTimeMet ? 0 : Number(config.basePenalty || 0);
  const minimumGuarantee = Math.max(0, Number(config.basePay?.[position] || 0) - activityPenalty);

  // 최저보장 비교 대상:
  // 영업 활동 지원 정책 + 요금제 + VAS + 2ND + 모바일 승인 스팟 + 직책수당
  // 특판·지인판매 대체 인센티브는 요금제/VAS 대체 성격이므로 모바일 비교 대상에 포함합니다.
  const approvedMobileSpotPay = Math.max(0, Number(mobileSpotPay || 0));
  // 최저보장 비교 후 별도로 추가되는 항목
  // v21.63: 고객별 home_orders가 있으면 새 홈 정책으로 재계산하고,
  // 구버전 집계만 존재하면 기존 계산을 fallback으로 유지합니다.
  const legacyHomeGradeQualCount = Number(draft.homeBase?.homeTv || 0);
  const legacyHomeTierCount = Number(draft.homeBase?.homeOnly || 0) + Number(draft.homeBase?.homeTv || 0)
    + Number(draft.homeFlat?.home1GBOnly || 0) + Number(draft.homeFlat?.home500Only || 0) + Number(draft.homeFlat?.home100Only || 0);
  const homePolicy = draft.homePolicy?.source==='orders' ? draft.homePolicy : null;
  const homeCaseCount = homePolicy ? Number(homePolicy.totalInternetCount||0) : legacyHomeTierCount;
  const homeGradePay = homePolicy ? Number(homePolicy.gradePay||0) : homeGradeTotal(legacyHomeTierCount, legacyHomeGradeQualCount, config.homeTiers);
  const homeFlatPay = homePolicy ? Number(homePolicy.homeFlatPay||0) : calculateFlatIncentive(draft.homeFlat || {}, config.homeFlat || []);
  const tvFreeRate = config.homeFlat.find((t) => t.key === 'tvFree')?.rate || 0;
  const smartHomeRate = config.homeFlat.find((t) => t.key === 'smartHome')?.rate || 0;
  const tvFreePay = homePolicy ? Number(homePolicy.tvFreePay||0) : Number(draft.homeFlat?.tvFree || 0) * tvFreeRate;
  const smartHomePay = homePolicy ? Number(homePolicy.smartHomePay||0) : Number(draft.homeFlat?.smartHome || 0) * smartHomeRate;
  const homeAddonPay = homePolicy ? Number(homePolicy.homeAddonPay||0) : calculateFlatIncentive(draft.homeAddon || {}, config.homeAddon || []);
  const renewPay = Math.max(0, calculateFlatIncentive(draft.renew || {}, config.renew || []) - Number(draft.renewSoloDiscountAmount || 0));
  const mnpBundlePay = calculateFlatIncentive(draft.mnpBundle || {}, config.mnpBundle || []);
  const septemberPolicy=config.policyVersion===SEPTEMBER_POLICY_VERSION;
  const sonoPay = septemberPolicy
    ? (config.sono||[]).reduce((sum,item)=>sum+calculateSeptemberSono(Number(draft.sono?.[item.key]||0),Number(item.rate||0),Number(item.achievedRate||item.rate||0)),0)
    : calculateFlatIncentive(draft.sono || {}, config.sono || []);
  const custRegBonus = tierBonus(Number(draft.custRegCount || 0), config.custRegTiers);
  const tailoredBonus = septemberPolicy
    ? calculateSeptemberTailoredTier(Number(draft.tailoredCount||0)).amount
    : tierBonus(Number(draft.tailoredCount || 0), config.tailoredTiers);
  const tailoredAmountBonus = Number(draft.tailoredAmount || 0);
  const sonoCount = Object.values(draft.sono || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  const strategicPoints = Number(strategicMetric?.strategicPointsWithoutDaemyung || 0)
    + Math.max(Number(strategicMetric?.daemyungCount || 0), sonoCount) * 2;
  const employeeStrategic = month >= SEPTEMBER_POLICY_MONTH
    ? calculateEmployeeStrategicAdjustment({hsCount:hsCount(draft),simMnpCount:Object.values(draft.mnpBundle||{}).reduce((s,v)=>s+Number(v||0),0),strategicPoints})
    : {ratio:null,amount:0,band:'not_applicable'};

  const settlement=calculatePayrollSettlement({
    minimumGuarantee,tenurePay,mobilePlanPay,bundle2ndPay,vasPay,approvedMobileSpotPay,
    specialReplacementPay,strategicAdjustment:employeeStrategic.amount,positionAllowance,
    extras:{gradeBonus,homeGradePay,homeFlatPay,homeAddonPay,renewPay,mnpBundlePay,sonoPay,custRegBonus,tailoredBonus,tailoredAmountBonus},
  });
  const {mobileGuaranteeBasis,guaranteedComponent,postGuaranteeExtras,currentPerformanceAmount,closingAmount,total}=settlement;

  // 기존 화면/RAW 호환용
  const positionBase = minimumGuarantee;
  const otherComponents = mobileGuaranteeBasis - positionAllowance;
  const activitySupportFloor = supportCap;
  const performanceComponents = mobileGuaranteeBasis - positionAllowance;
  const performanceWithAllowance = mobileGuaranteeBasis;

  return {
    months, bucket, activityCount, baseActivityCount, bundle2ndActivityCount, tenurePay,
    mobilePoints, bundle2ndPoints, homeGatePoints, homeAddonPoints, addonApplies, totalPoints,
    gradeEligible, grade: gradeHit.grade, gradeBonus, nextGrade, gradeProgress, currentTierMin,
    matrixTotal, adjustedMatrixTotal, specialMatrixOffset, specialVasOffset, specialReplacementPay,
    rawBundle2ndTotal, bundleFreeOffset, bundleFreeVasOffset, bundle2ndTotal,
    rawVasPay, vasPay, approvedMobileSpotPay, mobileMatrixPay, mobilePlanPay, bundle2ndPay,
    positionBase, positionAllowance, otherComponents, activitySupportFloor, minimumGuarantee,
    performanceComponents, performanceWithAllowance, mobileGuaranteeBasis, guaranteedComponent,
    currentPerformanceAmount, closingAmount, postGuaranteeExtras,
    homeAnyCount, homeNoPerformance,
    homeCaseCount, homeGradePay, homeFlatPay, tvFreePay, smartHomePay, homeAddonPay, homePolicy, renewPay,
    mnpBundlePay, sonoPay, custRegBonus, tailoredBonus, tailoredAmountBonus, kpiScore,
    strategicPoints, strategicRatio:employeeStrategic.ratio, strategicAdjustment:employeeStrategic.amount,
    strategicAdjustmentBand:employeeStrategic.band, total,
  };
}

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
  if (saving) return <span className="flex items-center gap-1 text-[11px] text-violet-600"><Loader2 size={11} className="animate-spin" />저장 중</span>;
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
      <button onClick={() => onChange(value + 1)} className="w-7 h-7 rounded-lg bg-violet-100 hover:bg-violet-200 flex items-center justify-center text-violet-700"><Plus size={13} /></button>
    </div>
  );
}

function Section({ title, sub, children, defaultOpen }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3">
        <div className="text-left">
          <div className="text-sm font-semibold text-gray-800">{title}</div>
          {sub && <div className="text-[11px] text-gray-400">{sub}</div>}
        </div>
        <ChevronDown size={16} className={`text-gray-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="border-t border-gray-50 divide-y divide-gray-50">{children}</div>}
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
          <span className="text-xs px-1.5 py-0.5 rounded bg-violet-50 text-violet-500">자동</span>
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
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    if(params.get('open')==='notifications'){
      setNotificationOpen(true);
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
  const [dirty, setDirty] = useState(false);            // 실적입력 탭에 저장 안 된 변경이 있는지
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [dbError, setDbError] = useState('');
  const [lockedMonths, setLockedMonths] = useState([]);
  const [policyBlockedMonths, setPolicyBlockedMonths] = useState([]);
  const [prevMonthTotal, setPrevMonthTotal] = useState(null); // 홈 화면 "전월 대비" 표시용
  const [personalGoals, setPersonalGoals] = useState({}); // 본인 월 항목별 목표
  const [goalSaving, setGoalSaving] = useState(false);
  const [approvedMobileSpotMap, setApprovedMobileSpotMap] = useState({}); // { empId: approved mobile spot total }
  const [homePolicyMap, setHomePolicyMap] = useState({}); // { empId: 새 홈 정책 계산 결과 }
  const [shadowLedgerMap, setShadowLedgerMap] = useState({}); // 관리자용 판매별 계산 검증, 실제 급여에는 미반영
  const [strategicMetricMap, setStrategicMetricMap] = useState({}); // 직원 전략P 급여 가감 계산용
  const [canViewHqStructure, setCanViewHqStructure] = useState(false);

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
      const { data, error } = await supabase.from('app_config').select('value').eq('config_key', 'config').maybeSingle();
      if (error) throw error;
      if (data && data.value) {
        const base={ ...defaultConfig(), ...data.value, vas: mergeDefaultVas(data.value.vas) };
        setConfig(month===SEPTEMBER_POLICY_MONTH?septemberConfig(base):base);
      } else {
        const def = defaultConfig();
        await supabase.from('app_config').upsert({ config_key: 'config', value: def }, { onConflict: 'config_key' });
        setConfig(month===SEPTEMBER_POLICY_MONTH?septemberConfig(def):def);
      }
    } catch (e) { console.error('CONFIG LOAD ERROR:', e); setConfig(month===SEPTEMBER_POLICY_MONTH?septemberConfig(defaultConfig()):defaultConfig()); }
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
      const {data,error}=await supabase.from('app_config').select('value').eq('config_key','policy_blocked_months').maybeSingle();
      if(error)throw error;
      setPolicyBlockedMonths(Array.isArray(data?.value)?data.value:[]);
    } catch(e){console.error('POLICY INPUT BLOCK LOAD ERROR',e);setPolicyBlockedMonths([]);}
  },[]);

  const togglePolicyInputBlock = async (targetMonth, block) => {
    if(!block){
      const ok=await showAppConfirm({title:`${monthLabel(targetMonth)} 입력을 시작할까요?`,message:'지급기준 정책 수정과 검증이 모두 끝난 경우에만 입력을 열어주세요.',confirmLabel:'입력 시작'});
      if(!ok)return;
    }
    const next=block?[...new Set([...policyBlockedMonths,targetMonth])]:policyBlockedMonths.filter(m=>m!==targetMonth);
    const {error}=await supabase.from('app_config').upsert({config_key:'policy_blocked_months',value:next},{onConflict:'config_key'});
    if(error){setDbError(`정책 준비 잠금 저장 실패: ${friendlyError(error)}`);return;}
    setPolicyBlockedMonths(next);
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
    setGoalSaving(false);
    return true;
  };

  const loadEmployees = useCallback(async () => {
    if (!authUser) return [];
    setDbError('');

    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, employee_code, store_name, position, hire_date, role, active')
      .eq('active', true)
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
      name: p.name || (p.id === authUser.id ? (authUser.email || '내 계정') : '이름 미설정'),
      branch: p.store_name || '미지정',
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

    const { data, error } = await supabase
      .from('daily_records')
      .select('user_id, work_date, data, updated_at')
      .in('user_id', ids)
      .gte('work_date', `${m}-01`)
      .lt('work_date', nextKey)
      .order('work_date', { ascending: true });

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

  const loadHomePolicies = useCallback(async (m,list)=>{
    const ids=(list||[]).map(e=>e.id),mapped={};
    if(!ids.length){setHomePolicyMap({});return;}
    const [yy,mm]=m.split('-').map(Number),next=new Date(yy,mm,1),to=`${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}-01`;
    const {data,error}=await supabase.from('home_orders')
      .select('id,user_id,customer_id,customer_name,product_type,network_type,sale_type,status,source_work_date,actual_install_date')
      .in('user_id',ids).gte('source_work_date',`${m}-01`).lt('source_work_date',to);
    if(error){console.error('HOME POLICY LOAD ERROR',error);setHomePolicyMap({});return;}
    ids.forEach(id=>{
      const userOrders=(data||[]).filter(o=>o.user_id===id);
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
    const {data,error}=await supabase.from('customer_sales')
      .select('id,user_id,sale_date,metric_label,source_meta,customers(customer_name)')
      .eq('source_type','mobile').in('user_id',ids).gte('sale_date',`${m}-01`).lt('sale_date',to);
    if(error){console.error('SHADOW LEDGER LOAD ERROR',error);setShadowLedgerMap(mapped);setStrategicMetricMap({});return;}
    (data||[]).forEach(sale=>{
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
    ids.forEach(id=>{strategicMapped[id]=summarizeVasQuality((data||[]).filter(sale=>sale.user_id===id));});
    setStrategicMetricMap(strategicMapped);
  },[config]);

  const saveDailyDay = async (day, record) => {
    if (!empId) return false;

    const current = dailyRecords[empId] || {};
    const nextDays = { ...current, [day]: record };
    setDailyRecords((prev) => ({ ...prev, [empId]: nextDays }));
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
      );

    if (error) {
      console.error('DAILY SAVE ERROR:', error);
      setDbError(`일일 실적 저장 실패: ${friendlyError(error)}`);
      return false;
    }

    return true;
  };

  useEffect(() => { loadConfig(); }, [loadConfig]);
  useEffect(() => { loadStores(); }, [loadStores]);
  useEffect(() => { loadLockedMonths(); }, [loadLockedMonths]);
  useEffect(() => { loadPolicyBlockedMonths(); }, [loadPolicyBlockedMonths]);
  useEffect(() => { loadPersonalGoals(); }, [loadPersonalGoals]);

  useEffect(() => {
    if (!authUser) return;
    (async () => {
      const list = await loadEmployees();
      const own = list.find((e) => e.id === authUser.id);
      const first = own?.id || list[0]?.id || '';
      setEmpId(first);
      await loadMonth(month, list);
      await loadDaily(month, list);
      await loadHomePolicies(month, list);
      await loadShadowLedgers(month, list);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.id]);
  useEffect(() => { if (employees.length) { loadMonth(month, employees); loadDaily(month, employees); loadHomePolicies(month, employees); loadShadowLedgers(month, employees); } }, [month]); // eslint-disable-line
  // 홈 고객별 저장/수정으로 일일 실적이 바뀌면 새 정책 금액도 다시 계산합니다.
  useEffect(() => { if (employees.length) loadHomePolicies(month, employees); }, [dailyRecords]); // eslint-disable-line
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
    if(month===SEPTEMBER_POLICY_MONTH){
      showLegacyAlert('9월 지급정책은 회사 확정 정책으로 고정되어 있어 화면에서 수정할 수 없어요.');
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

    const { error } = await supabase.from('profiles').update(dbPatch).eq('id', id);
    if (error) {
      setDbError(`직원 정보 수정 실패: ${friendlyError(error)}`);
      return;
    }
    setEmployees((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  const removeEmployee = async (id) => {
    setDbError('');
    const { error } = await supabase.from('profiles').update({ active: false }).eq('id', id);
    if (error) {
      console.error('EMPLOYEE DEACTIVATE ERROR:', error);
      setDbError(`직원 비활성화 실패: ${friendlyError(error)}`);
      return;
    }
    await loadEmployees();
  };

  const saveDraft = async (payload) => {
    const body = payload || draft;
    if (!empId) return;

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
    if (lockedMonths.includes(month) || policyBlockedMonths.includes(month)) return;
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
        if (error) console.error('PENDING MONTH SAVE ERROR:', error);
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

  const rows = employees.map((e) => {
    const rec = monthRecords[e.id] || { draft: emptyDraft(), status: 'none' };
    const mergedBase = applyDailyToDraft(rec.draft, dailyRecords[e.id], month, config.categoryMap, config.gibyeonColumnMap);
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

  const scopedEmployees = isFullAdmin || isHQManager
    ? employees
    : isStoreLeader
      ? employees.filter((e) => e.branch === loginEmp?.branch)
      : employees.filter((e) => e.id === authUser?.id);

  useEffect(() => {
    if (!scopedEmployees.length) return;
    if (!scopedEmployees.some((e) => e.id === empId)) {
      setEmpId(scopedEmployees[0].id);
    }
  }, [scopedEmployees, empId]);


  // 홈 화면 "전월 대비" 표시용 — 본인 것만 가볍게 따로 불러옴
  useEffect(() => {
    if (!empId || !currentEmp) { setPrevMonthTotal(null); return; }
    (async () => {
      const [yy, mm] = month.split('-').map(Number);
      const prevD = new Date(yy, mm - 2, 1);
      const prevMonth = `${prevD.getFullYear()}-${String(prevD.getMonth() + 1).padStart(2, '0')}`;
      const nextKey = `${month}-01`;

      const prevNextD=new Date(prevD.getFullYear(),prevD.getMonth()+1,1);
      const prevTo=`${prevNextD.getFullYear()}-${String(prevNextD.getMonth()+1).padStart(2,'0')}-01`;
      const [{ data: msRow }, { data: dailyRows }, {data:prevSpots}] = await Promise.all([
        supabase.from('monthly_status').select('data, activity_time_met').eq('user_id', empId).eq('month', prevMonth).maybeSingle(),
        supabase.from('daily_records').select('work_date, data').eq('user_id', empId).gte('work_date', `${prevMonth}-01`).lt('work_date', nextKey),
        supabase.from('spot_claims').select('final_amount,direct_amount,spot_policies(amount)').eq('user_id',empId).eq('status','approved').eq('source_context','mobile').gte('claim_date',`${prevMonth}-01`).lt('claim_date',prevTo)
      ]);

      const prevDraft = { ...emptyDraft(), ...(msRow?.data?.draft || {}), activityTimeMet: msRow?.activity_time_met ?? true };
      const prevDailyMap = {};
      (dailyRows || []).forEach((r) => { prevDailyMap[r.work_date.slice(8, 10)] = r.data; });
      const prevMerged = applyDailyToDraft(prevDraft, prevDailyMap, prevMonth, config.categoryMap, config.gibyeonColumnMap);
      const prevSpotTotal=(prevSpots||[]).reduce((sum,x)=>sum+Number(x.final_amount??x.direct_amount??x.spot_policies?.amount??0),0);
      const prevPay = computePay(prevMerged, currentEmp.position, currentEmp.hireDate, prevMonth, config, prevSpotTotal);
      setPrevMonthTotal(prevPay.currentPerformanceAmount);
    })();
  }, [empId, month, currentEmp?.position, currentEmp?.hireDate, config]); // eslint-disable-line
  const myMergedBase = applyDailyToDraft(draft, dailyRecords[empId], month, config.categoryMap, config.gibyeonColumnMap);
  const myMergedDraft = {...myMergedBase,homePolicy:homePolicyMap[empId]||null};
  const myPay = computePay(myMergedDraft, currentEmp?.position || '사원', currentEmp?.hireDate, month, config, approvedMobileSpotMap[empId]||0, strategicMetricMap[empId]);
  // 영업 조직이 아닌 인원(운영진·영업지원팀 등)은 실적표/실적비교에서 제외
  // '기타' 직급(대리입력용 매장 실적 계정)은 건수·성과등급P는 유지하되 인센티브 금액은 0으로 표시(개인 지급 없음)
  const salesRows = rows
    .filter((r) => !NON_SALES_STORES.includes(r.branch))
    .map((r) => (r.position === '기타' ? { ...r, pay: { ...r.pay, total: 0, guaranteedComponent: 0 } } : r));
  const scopedIds = new Set(scopedEmployees.map((e) => e.id));
  const scopedRows = rows.filter((r) => scopedIds.has(r.id));
  const scopedSalesRows = salesRows.filter((r) => scopedIds.has(r.id));

  const totalPay = scopedSalesRows.reduce((s, r) => s + r.pay.total, 0);
  const pendingCount = scopedRows.filter((r) => r.status === 'pending').length;

  // 홈 화면 랭킹용 — 본인이 영업 조직 소속일 때만 순위 계산
  const rankedSorted = [...salesRows].sort((a, b) => b.pay.total - a.pay.total);
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
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center"><Trophy size={18} className="text-white" /></div>
            <div>
              <div className="font-bold text-gray-900 leading-tight">미소페이</div>
              <div className="text-[11px] text-gray-400 leading-tight">2026년 MS직군 수수료 정책 반영</div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              <button onClick={() => setRole('employee')} className={`px-3 py-1.5 rounded-md text-sm font-medium ${role === 'employee' ? 'bg-white shadow text-violet-700' : 'text-gray-500'}`}>직원</button>
              {['manager', 'admin'].includes(authProfile?.role) && (
                <button onClick={() => setRole('admin')} className={`px-3 py-1.5 rounded-md text-sm font-medium ${role === 'admin' ? 'bg-white shadow text-violet-700' : 'text-gray-500'}`}>관리자</button>
              )}
            </div>
            <div className="hidden sm:block text-right leading-tight">
              <div className="text-xs font-semibold text-gray-700">{authProfile?.name || authUser?.email}</div>
              <div className="text-[10px] text-gray-400">{ROLE_LABELS[authProfile?.role] || authProfile?.role}</div>
            </div>
            <PwaInstallButton />
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
            <span className="text-xs text-gray-400">로그인:</span>
            <select
              value={empId}
              onChange={(e) => setEmpId(e.target.value)}
              disabled={scopedEmployees.length <= 1}
              className="text-sm font-medium bg-violet-50 text-violet-700 px-2.5 py-1 rounded-lg border border-violet-100 disabled:opacity-80"
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
        <EmployeeView
          tab={tab} setTab={setTab} months={months} month={month} setMonth={setMonth}
          draft={draft} setDraft={updateDraft} config={config} pay={myPay} mergedDraft={myMergedDraft}
          status={(monthRecords[empId] || {}).status || 'none'}
          saveDraft={saveDraft} saving={saving} saved={saved} dirty={dirty} lastSavedAt={lastSavedAt}
          dailyDays={dailyRecords[empId] || {}} allDailyRecords={dailyRecords} saveDailyDay={saveDailyDay}
          monthLocked={lockedMonths.includes(month)}
          policyInputBlocked={policyBlockedMonths.includes(month)}
          canSeeCriteria={currentEmp?.branch === '운영진' || ['점장', '부점장'].includes(currentEmp?.position)}
          myRank={myRank} myRankTotal={myRankTotal} myBranchRank={myBranchRank} myBranchTotal={myBranchRanked.length}
          prevMonthTotal={prevMonthTotal}
          currentEmp={currentEmp}
          personalGoals={personalGoals}
          savePersonalGoals={savePersonalGoals}
          goalSaving={goalSaving}
          showPersonalGoal={empId === authUser?.id}
          competitionRows={salesRows}
          authUser={authUser} authProfile={authProfile}
        />
      ) : (
        <AdminView
          adminTab={adminTab} setAdminTab={setAdminTab} months={months} month={month} setMonth={setMonth}
          rows={scopedSalesRows} rankingRows={salesRows} dailyRecords={dailyRecords} totalPay={totalPay} pendingCount={pendingCount} approve={approve} rejectApproval={rejectApproval}
          config={config} persistConfig={persistConfig}
          employees={scopedEmployees} addEmployee={addEmployee} updateEmployee={updateEmployee} removeEmployee={removeEmployee}
          stores={stores} addStore={addStore} removeStore={removeStore}
          isFullAdmin={isFullAdmin}
          authUserId={authUser?.id}
          loginPosition={loginEmp?.position||''}
          loginBranch={loginEmp?.branch||''}
          canSwitchStores={isFullAdmin||isHQManager}
          canViewHqStructure={canViewHqStructure}
          monthLocked={lockedMonths.includes(month)} toggleMonthLock={toggleMonthLock}
          policyInputBlocked={policyBlockedMonths.includes(month)} togglePolicyInputBlock={togglePolicyInputBlock}
        />
      )}
    </div>
  );
}

/* ===================== v21.60 평가 시스템 ===================== */

const CAREER_PASS_SCORE = 90;
const MANAGER_GRADE = (score) => score >= 100 ? 'S' : score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : 'D';

function quarterInfoFromMonth(month){
  const [y,m]=String(month).split('-').map(Number);
  const q=Math.floor((m-1)/3)+1;
  const start=(q-1)*3+1;
  const months=[0,1,2].map(i=>`${y}-${String(start+i).padStart(2,'0')}`);
  return {year:y,quarter:q,key:`${y}-Q${q}`,label:`${y}년 ${q}분기`,months,from:`${months[0]}-01`,to:(()=>{const d=new Date(y,start+2,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;})()};
}
function previousQuarterKey(q){
  const [yStr,qStr]=String(q).split('-Q');const y=Number(yStr),n=Number(qStr);return n===1?`${y-1}-Q4`:`${y}-Q${n-1}`;
}
function careerTenureBonus(hireDate, quarterEndMonth){
  const months=monthsSince(hireDate,quarterEndMonth);
  if(months<=12)return 0;
  return Math.min(5,Math.floor((months-1)/12));
}
function roundedTarget(v,unit='count'){return unit==='won'?Math.max(0,Number(v||0)):Math.max(0,Math.round(Number(v||0)));}
function cappedAchievement(actual,target,cap=1){if(!(Number(target)>0))return 0;return Math.min(cap,Math.max(0,Number(actual||0)/Number(target||1)));}

const DEFAULT_AA_METRICS=[
  {key:'mnp',label:'MNP (HS MNP + SIM MNP)',weight:8,target:209,unit:'count'},
  {key:'simMnp',label:'SIM MNP',weight:7,target:84,unit:'count'},
  {key:'subTvHousehold',label:'TV부셋탑(가정망)',weight:7,target:81,unit:'count'},
  {key:'tvFree',label:'TV프리(부)',weight:6,target:64,unit:'count'},
  {key:'smartHome',label:'스마트홈',weight:4,target:37,unit:'count'},
  {key:'otherCustomer',label:'타사 고객 등록',weight:4,target:490,unit:'count'},
  {key:'tailoredAmount',label:'맞춤제안 매출액',weight:4,target:4183276,unit:'won'},
];
function normalizeAaWeights(metrics){
  const sum=(metrics||[]).reduce((s,x)=>s+Number(x.weight||0),0)||1;
  return (metrics||[]).map(x=>({...x,normalizedWeight:Number(x.weight||0)/sum*100}));
}
function aaMetricScore(actual,target,normalizedWeight){return cappedAchievement(actual,target,1.1)*Number(normalizedWeight||0);}
function aaAdjustments(input={}){
  const nps=Number(input.npsScore||0);
  const npsAdj=nps?Number(((nps-95)).toFixed(1)):0;
  const unkind=-5*Number(input.unkindCount||0);
  const complaints=-1*Number(input.complaintCount||0);
  const security=Number(input.securityScore||0)>0&&Number(input.securityScore)<90?-5:0;
  const privacy=input.privacyViolation?-10:0;
  const noExp=Number(input.noExperienceRate||0)>0&&Number(input.noExperienceRate)<=40?2:0;
  const leveling=String(input.leveling||'')==='4'?3:(input.leveling?-3:0);
  const internetRatio=Number(input.internetRatio||0);
  const internet=internetRatio>=10?8:internetRatio>=8?3:0;
  const daemyung=input.daemyungAchieved?3:0;
  const prospect=input.prospectMnpAchieved?3:0;
  return {npsAdj,unkind,complaints,security,privacy,noExp,leveling,internet,daemyung,prospect,total:npsAdj+unkind+complaints+security+privacy+noExp+leveling+internet+daemyung+prospect};
}

async function loadQuarterCareerKpi(userId,quarter,config){
  if(!userId)return 0;
  let total=0;
  for(const m of quarter.months){
    const [yy,mm]=m.split('-').map(Number);const next=new Date(yy,mm,1);const to=`${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}-01`;
    const [{data:ms},{data:daily}]=await Promise.all([
      supabase.from('monthly_status').select('data,activity_time_met').eq('user_id',userId).eq('month',m).maybeSingle(),
      supabase.from('daily_records').select('work_date,data').eq('user_id',userId).gte('work_date',`${m}-01`).lt('work_date',to)
    ]);
    const base={...emptyDraft(),...(ms?.data?.draft||{}),activityTimeMet:ms?.activity_time_met??true};
    const map={};(daily||[]).forEach(r=>map[String(r.work_date).slice(8,10)]=r.data);
    const merged=applyDailyToDraft(base,map,m,config?.categoryMap,config?.gibyeonColumnMap);
    const kpi=(config?.kpiItems||DEFAULT_KPI_ITEMS).reduce((s,it)=>s+Number(merged.kpi?.[it.key]||0)*Number(it.point||0),0);
    total+=kpi;
  }
  return total;
}

function CareerEvaluationPanel({ employee, month, config, canManage=false, canFinalApprove=false, managerScopeEmployees=[] }){
  const quarter=quarterInfoFromMonth(month);
  const [selectedId,setSelectedId]=useState(employee?.id||'');
  const selected=(managerScopeEmployees||[]).find(e=>e.id===selectedId)||employee;
  const [kpi,setKpi]=useState(0),[events,setEvents]=useState([]),[loading,setLoading]=useState(true),[note,setNote]=useState('');
  const [eventType,setEventType]=useState('nps_negative'),[eventDate,setEventDate]=useState(new Date().toISOString().slice(0,10)),[count,setCount]=useState(1);
  const [decision,setDecision]=useState(null),[prevDecision,setPrevDecision]=useState(null);
  useEffect(()=>{if(employee?.id&&!canManage)setSelectedId(employee.id)},[employee?.id,canManage]);
  useEffect(()=>{
    if(!selected?.id)return;
    (async()=>{setLoading(true);
      const [k,{data:e},{data:d}]=await Promise.all([
        loadQuarterCareerKpi(selected.id,quarter,config),
        supabase.from('career_eval_penalties').select('*').eq('user_id',selected.id).gte('event_date',quarter.from).lt('event_date',quarter.to).order('event_date',{ascending:false}),
        supabase.from('career_eval_decisions').select('*').eq('user_id',selected.id).in('quarter',[quarter.key,previousQuarterKey(quarter.key)])
      ]);
      const decisions=d||[];
      setKpi(Number(k||0));setEvents(e||[]);setDecision(decisions.find(x=>x.quarter===quarter.key)||null);setPrevDecision(decisions.find(x=>x.quarter===previousQuarterKey(quarter.key))||null);setLoading(false);
    })();
  },[selected?.id,quarter.key,config]);
  const active=events.filter(x=>x.status!=='cancelled');
  const penalty=active.reduce((s,x)=>s+Number(x.count||1),0);
  const tenure=careerTenureBonus(selected?.hireDate,quarter.months[2]);
  const score=Number((kpi+tenure-penalty).toFixed(1));
  const pass=score>=CAREER_PASS_SCORE;
  const streakFail=pass?0:(Number(prevDecision?.result==='FAIL'?prevDecision?.consecutive_fail_count||1:0)+1);
  const addEvent=async()=>{
    if(!selected?.id||!canManage)return;
    const {error}=await supabase.from('career_eval_penalties').insert({user_id:selected.id,event_date:eventDate,event_type:eventType,count:Math.max(1,Number(count||1)),note:note.trim()||null,status:'active'});
    if(error)return showLegacyAlert(`평가 내역 저장 실패: ${friendlyError(error)}`);
    setNote('');setCount(1);const {data}=await supabase.from('career_eval_penalties').select('*').eq('user_id',selected.id).gte('event_date',quarter.from).lt('event_date',quarter.to).order('event_date',{ascending:false});setEvents(data||[]);
  };
  const cancelEvent=async(id)=>{if(!canManage)return;await supabase.from('career_eval_penalties').update({status:'cancelled'}).eq('id',id);setEvents(v=>v.map(x=>x.id===id?{...x,status:'cancelled'}:x));};
  const saveDecision=async(action)=>{
    if(!canManage)return;
    const nextFail=streakFail;
    const payload={quarter:quarter.key,user_id:selected.id,score,result:pass?'PASS':'FAIL',action,consecutive_fail_count:nextFail};
    const {error}=await supabase.from('career_eval_decisions').upsert(payload,{onConflict:'quarter,user_id'});if(error)return showLegacyAlert(friendlyError(error));setDecision({...decision,...payload});
  };
  const typeLabel={nps_negative:'NPS 비추천/강한 비추천',label:'꼬리표',home_no_experience:'홈 무체험'};
  return <div className="space-y-3">
    {canManage&&(managerScopeEmployees||[]).length>0&&<select value={selectedId} onChange={e=>setSelectedId(e.target.value)} className="w-full bg-white border rounded-xl px-3 py-2.5 text-sm">{managerScopeEmployees.map(e=><option key={e.id} value={e.id}>{e.name} · {e.position} · {displayStoreName(e.branch)}</option>)}</select>}
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <div className="flex justify-between gap-3"><div><div className="text-xs text-violet-600 font-semibold">{quarter.label} 커리어 등급</div><div className="text-lg font-bold mt-1">{selected?.name||'-'} · {selected?.position||'-'}</div></div><div className={`px-3 py-1.5 rounded-full h-fit text-xs font-bold ${pass?'bg-emerald-50 text-emerald-700':'bg-red-50 text-red-600'}`}>{loading?'계산중':pass?'PASS':'FAIL'}</div></div>
      <div className="mt-4 flex items-end gap-2"><span className="text-3xl font-bold text-gray-900">{score.toFixed(1)}P</span><span className="text-xs text-gray-400 mb-1">통과 90P</span></div>
      <div className="grid grid-cols-4 gap-2 mt-4">{[['3개월 KPI',kpi.toFixed(1)],['근속 가점',`+${tenure}`],['감점',`-${penalty}`],['연속 FAIL',`${streakFail}회`]].map(([l,v])=><div key={l} className="bg-gray-50 rounded-xl p-2.5 text-center"><div className="text-[9px] text-gray-400">{l}</div><div className="text-sm font-bold mt-1">{v}P</div></div>)}</div>
      {selected?.position==='사원'&&pass&&<div className="mt-3 bg-violet-50 text-violet-700 rounded-xl px-3 py-2 text-xs font-semibold">승급 대상 · 면담 후 매니저 승급 승인 필요</div>}
      {selected?.position==='매니저'&&!pass&&streakFail>=2&&<div className="mt-3 bg-red-50 text-red-700 rounded-xl px-3 py-2 text-xs font-semibold">⚠ 2회 연속 FAIL · 사원 전환 검토 대상</div>}
    </div>
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 border-b"><div className="text-sm font-bold">평가 근거</div><div className="text-[10px] text-gray-400">NPS · 꼬리표 · 홈 무체험은 관리자 등록 내역만 반영돼요.</div></div>
      {active.length===0?<div className="py-8 text-center text-xs text-gray-400">등록된 감점 내역이 없어요.</div>:<div className="divide-y">{active.map(x=><div key={x.id} className="px-4 py-3 flex justify-between gap-3"><div><div className="text-xs font-semibold">{x.event_date} · {typeLabel[x.event_type]||x.event_type}</div>{x.note&&<div className="text-[10px] text-gray-400 mt-1">{x.note}</div>}</div><div className="flex gap-2 items-center"><b className="text-sm text-red-500">-{x.count}P</b>{canManage&&<button onClick={()=>cancelEvent(x.id)} className="text-[10px] text-gray-400 underline">취소</button>}</div></div>)}</div>}
    </div>
    {canManage&&<div className="bg-white rounded-2xl border border-gray-100 p-4"><div className="text-sm font-bold">평가 내역 등록</div><div className="grid grid-cols-2 gap-2 mt-3"><select value={eventType} onChange={e=>setEventType(e.target.value)} className="border rounded-xl px-3 py-2 text-xs"><option value="nps_negative">NPS 비추천</option><option value="label">꼬리표</option><option value="home_no_experience">홈 무체험</option></select><input type="date" value={eventDate} onChange={e=>setEventDate(e.target.value)} className="border rounded-xl px-3 py-2 text-xs"/><input type="number" min="1" value={count} onChange={e=>setCount(e.target.value)} className="border rounded-xl px-3 py-2 text-xs"/><input value={note} onChange={e=>setNote(e.target.value)} placeholder="사유/메모" className="border rounded-xl px-3 py-2 text-xs"/></div><button onClick={addEvent} className="w-full mt-2 py-2.5 rounded-xl bg-violet-600 text-white text-xs font-bold">감점 내역 등록</button></div>}
    {canManage&&<div className="bg-white rounded-2xl border border-gray-100 p-4"><div className="text-sm font-bold">평가 처리</div><div className="text-[10px] text-gray-400 mt-1">현장 관리자는 평가 확인까지, 최고 관리자는 면담 후 승급·강등을 최종 승인합니다.</div><div className={`grid gap-2 mt-3 ${canFinalApprove?'grid-cols-2':'grid-cols-1'}`}><button onClick={()=>saveDecision('reviewed')} className="py-2.5 rounded-xl bg-gray-100 text-gray-700 text-xs font-bold">평가 확인</button>{canFinalApprove&&<button onClick={async()=>{const action=pass&&selected?.position==='사원'?'promote_manager':(!pass&&selected?.position==='매니저'&&streakFail>=2?'demote_employee':'no_change');await saveDecision(action);if(action==='promote_manager')await supabase.from('profiles').update({position:'매니저'}).eq('id',selected.id);if(action==='demote_employee')await supabase.from('profiles').update({position:'사원'}).eq('id',selected.id);}} className="py-2.5 rounded-xl bg-violet-600 text-white text-xs font-bold">면담 결과 최종 승인</button>}</div></div>}
  </div>;
}

function managerActualFromDraft(d,key){
  if(key==='hs')return hsCount(d);
  const hsMnp=matrixRowCount(d,MATRIX_ROWS.indexOf('일반모델 MNP'));
  const simMnp=(d.matrix?.[5]||[]).reduce((s,v)=>s+Number(v||0),0);
  if(key==='mnp')return hsMnp+simMnp;
  if(key==='simMnp')return simMnp;
  if(key==='subTvHousehold')return Number(d.homeAddon?.addSetTop||0)+Number(d.homeFlat?.tvFree||0);
  if(key==='tvFree')return Number(d.homeFlat?.tvFree||0);
  if(key==='smartHome')return Number(d.homeFlat?.smartHome||0);
  if(key==='second')return Object.values(d.bundle2nd||{}).reduce((s,v)=>s+Number(v||0),0);
  if(key==='tailoredCount')return Number(d.tailoredCount||0);
  if(key==='otherCustomer')return Number(d.custRegCount||0);
  if(key==='tailoredAmount')return Number(d.tailoredAmount||0);
  if(key==='daemyung')return Object.values(d.sono||{}).reduce((s,v)=>s+Number(v||0),0);
  if(key==='prospectMnp')return 0;
  if(key==='home')return Number(d.homeBase?.homeOnly||0)+Number(d.homeBase?.homeTv||0);
  return 0;
}

function ManagerEvaluationPanel({ month, employees, rows, authUserId, canSwitchStores=false, loginBranch='' }){
  const quarter=quarterInfoFromMonth(month);
  const stores=sortStoresByOpenOrder([...new Set((employees||[]).map(e=>e.branch).filter(b=>b&&!NON_SALES_STORES.includes(b)))]);
  const [store,setStore]=useState(canSwitchStores?'':(loginBranch||stores[0]||''));
  const activeStore=store||stores[0]||'';
  const [aaConfig,setAaConfig]=useState(DEFAULT_AA_METRICS),[snap,setSnap]=useState({verified_metrics:{},external_inputs:{}}),[allGoals,setAllGoals]=useState([]),[saving,setSaving]=useState(false);
  const [managerMode,setManagerMode]=useState('dashboard');
  useEffect(()=>{if(!canSwitchStores&&loginBranch)setStore(loginBranch)},[canSwitchStores,loginBranch]);
  useEffect(()=>{(async()=>{const [{data:c},{data:s},{data:g}]=await Promise.all([
    supabase.from('aa_impact_monthly').select('*').eq('month',month).maybeSingle(),
    supabase.from('manager_eval_monthly').select('*').eq('month',month).eq('store_name',activeStore).maybeSingle(),
    supabase.from('store_goals').select('store_name,company_goals').eq('month',month)
  ]);if(Array.isArray(c?.metrics)&&c.metrics.length)setAaConfig(c.metrics);setSnap(s||{verified_metrics:{},external_inputs:{}});setAllGoals(g||[]);})();},[month,activeStore]);
  const storeRows=(rows||[]).filter(r=>r.branch===activeStore);
  const live={};['hs','home','mnp','simMnp','subTvHousehold','tvFree','smartHome','second','tailoredCount','otherCustomer','tailoredAmount','daemyung','prospectMnp'].forEach(k=>live[k]=storeRows.reduce((s,r)=>s+managerActualFromDraft(r.draft,k),0));
  live.productivity=storeRows.reduce((s,r)=>s+Number(r.pay?.kpiScore||0),0);
  const verified=snap?.verified_metrics||{};
  const actual=(key)=>Number(verified[key]??live[key]??0);
  // 관리자 > 회사 목표 > 회사 기준수량을 평가의 단일 기준으로 사용합니다.
  // DB에 해당 월 저장값이 있으면 우선하고, 아직 저장 전인 매장은 회사 기본 기준수량을 보완값으로 사용합니다.
  const goalMap=Object.fromEntries(stores.map(storeName=>{
    const saved=(allGoals||[]).find(g=>g.store_name===storeName);
    return [storeName,{...companyGoalDefaults(storeName),...(saved?.company_goals||{})}];
  }));
  const storeHsTarget=Number(goalMap[activeStore]?.hs||0);
  // 현장 관리자는 권한상 자기 매장 직원만 조회하므로 `stores`에는 한 매장만 들어옵니다.
  // AA 회사 목표 배분의 분모는 조회 범위가 아니라 정책서의 전체 매장 HS 기준수량이어야 합니다.
  const allStoreHsTargets=COMPANY_STORE_GOAL_BASE.map(row=>Number(row.hs||0));
  const totalHsTarget=allStoreHsTargets.reduce((sum,value)=>sum+value,0);
  const share=managerCompanyGoalShare(storeHsTarget,allStoreHsTargets);
  const coreTargets={
    hs:Number(goalMap[activeStore]?.hs||0),
    home:Number(goalMap[activeStore]?.home||0),
    productivity:Number(goalMap[activeStore]?.productivity||0)
  };
  const hasCompanyGoalBasis=storeHsTarget>0&&totalHsTarget>0;
  const coreRaw=cappedAchievement(actual('hs'),coreTargets.hs)*30+cappedAchievement(actual('home'),coreTargets.home)*30+cappedAchievement(actual('productivity'),coreTargets.productivity)*40;
  const core50=coreRaw*0.5;
  const normalized=normalizeAaWeights(aaConfig);
  const aaRows=normalized.map(m=>{const target=roundedTarget(Number(m.target||0)*share,m.unit);const a=actual(m.key);const score=aaMetricScore(a,target,m.normalizedWeight);return {...m,storeTarget:target,actual:a,score};});
  const ext=snap?.external_inputs||{};
  const hsActual=actual('hs'),householdHome=actual('home'),internetRatio=hsActual>0?householdHome/hsActual*100:0;
  const daemyungTarget=roundedTarget(37*share,'count'),prospectTarget=roundedTarget(21*share,'count');
  const adj=aaAdjustments({...ext,internetRatio,daemyungAchieved:daemyungTarget>0&&actual('daemyung')>=daemyungTarget,prospectMnpAchieved:prospectTarget>0&&actual('prospectMnp')>=prospectTarget});
  const aaBase=aaRows.reduce((s,x)=>s+x.score,0),aa100=Math.max(0,Math.min(100,aaBase+adj.total)),aa50=aa100*0.5,total=core50+aa50,grade=MANAGER_GRADE(total);
  const operator=managerOperatorForStore(activeStore);
  const viewer=(employees||[]).find(e=>e.id===authUserId);
  const canViewManagerIncentive=canSwitchStores||!!(operator?.name&&viewer?.name===operator.name&&viewer?.branch===activeStore);
  const strategicRatio=verified.strategicRatio??null;
  const plan115Count=Number(verified.plan115Count||0),plan115Ratio=hsActual>0?plan115Count/hsActual*100:0;
  const subTvSmartRatio=hsActual>0?(actual('subTvHousehold')+actual('smartHome'))/hsActual*100:null;
  const managerEstimate=calculateSeptemberManagerIncentive({
    actual:{hs:hsActual,home:actual('home'),tvFree:actual('tvFree'),smartHome:actual('smartHome')},
    targets:{hs:coreTargets.hs,home:coreTargets.home,tvFree:Number(goalMap[activeStore]?.tvFree||0),smartHome:Number(goalMap[activeStore]?.smartHome||0)},
    managerScore:total,strategicRatio,homeRatio:internetRatio,plan115Count,plan115Ratio,
    tailoredCount:actual('tailoredCount'),bundledSecondCount:actual('second'),storeType:septemberManagerStoreType(activeStore),subTvSmartRatio,
    levelBelow4:ext.leveling==='below4',noExperienceRate:ext.noExperienceRate??null,
    complaintCount:Number(ext.complaintCount||0),unkindCount:Number(ext.unkindCount||0),
    npsScore:ext.npsScore??null,privacyViolation:!!ext.privacyViolation,
  });
  const verifiedAt=snap?.verified_at?new Date(snap.verified_at).toLocaleString('ko-KR'):'미확인';
  const setVerified=(key,val)=>setSnap(v=>({...v,verified_metrics:{...(v.verified_metrics||{}),[key]:Number(val||0)}}));
  const setExt=(key,val)=>setSnap(v=>({...v,external_inputs:{...(v.external_inputs||{}),[key]:val}}));
  const saveSnapshot=async()=>{setSaving(true);const payload={month,store_name:activeStore,verified_metrics:{...live,...(snap.verified_metrics||{})},external_inputs:{...(snap.external_inputs||{})},verified_by:authUserId,verified_at:new Date().toISOString()};const {error}=await supabase.from('manager_eval_monthly').upsert(payload,{onConflict:'month,store_name'});setSaving(false);if(error)return showLegacyAlert(friendlyError(error));setSnap(payload);};
  const saveAa=async()=>{setSaving(true);const {error}=await supabase.from('aa_impact_monthly').upsert({month,metrics:aaConfig,updated_by:authUserId},{onConflict:'month'});setSaving(false);if(error)return showLegacyAlert(friendlyError(error));showLegacyAlert('AA임팩트 월 목표를 저장했어요.');};
  return <div className="space-y-3">
    <div className={`grid gap-2 ${canSwitchStores?'grid-cols-3':canViewManagerIncentive?'grid-cols-2':'grid-cols-1'}`}><button onClick={()=>setManagerMode('dashboard')} className={`py-2 rounded-xl text-xs font-bold ${managerMode==='dashboard'?'bg-violet-600 text-white':'bg-white border text-gray-500'}`}>평가 현황</button>{canViewManagerIncentive&&<button onClick={()=>setManagerMode('incentive')} className={`py-2 rounded-xl text-xs font-bold ${managerMode==='incentive'?'bg-violet-600 text-white':'bg-white border text-gray-500'}`}>관리자 인센티브</button>}{canSwitchStores&&<button onClick={()=>setManagerMode('settings')} className={`py-2 rounded-xl text-xs font-bold ${managerMode==='settings'?'bg-violet-600 text-white':'bg-white border text-gray-500'}`}>목표·실적 최신화</button>}</div>
    {canSwitchStores&&<select value={activeStore} onChange={e=>setStore(e.target.value)} className="w-full bg-white border rounded-xl px-3 py-2.5 text-sm">{stores.map(s=><option key={s} value={s}>{displayStoreName(s)}</option>)}</select>}
    {managerMode==='dashboard'?<>
      <div className="bg-white rounded-2xl border p-4"><div className="flex justify-between gap-3"><div><div className="text-xs text-violet-600 font-semibold">{quarter.label} 관리자 평가 · {monthLabel(month)} 현재 기준</div><div className="text-lg font-bold mt-1">{displayStoreName(activeStore)}</div></div><div className="text-right"><div className="text-3xl font-black text-violet-700">{total.toFixed(1)}</div><div className="text-xs font-bold">{grade}등급</div></div></div><div className="grid grid-cols-2 gap-2 mt-4"><div className="bg-gray-50 rounded-xl p-3"><div className="text-[10px] text-gray-400">핵심성과 50%</div><div className="text-xl font-bold mt-1">{core50.toFixed(1)} / 50</div><div className="text-[10px] text-gray-400 mt-1">HS 30% · 홈 30% · 생산성 40%</div></div><div className="bg-gray-50 rounded-xl p-3"><div className="text-[10px] text-gray-400">AA임팩트 50%</div><div className="text-xl font-bold mt-1">{aa50.toFixed(1)} / 50</div><div className="text-[10px] text-gray-400 mt-1">AA 원점수 {aa100.toFixed(1)} / 100</div></div></div><div className="mt-3 text-[10px] text-gray-400">관리자 확인 실적 기준 · 마지막 최신화 {verifiedAt}</div></div>
      <div className="bg-white rounded-2xl border overflow-hidden"><div className="px-4 py-3 border-b"><div className="text-sm font-bold">핵심 성과</div></div>{[['HS','hs',30],['홈','home',30],['생산성','productivity',40]].map(([l,k,w])=>{const t=coreTargets[k],a=actual(k),pct=cappedAchievement(a,t)*100;return <div key={k} className="px-4 py-3 border-b last:border-0"><div className="flex justify-between text-xs"><b>{l}</b><span>{fmtNum(a,1)} / {fmtNum(t,1)} · {pct.toFixed(0)}%</span></div><div className="h-1.5 bg-gray-100 rounded-full mt-2"><div className="h-full bg-violet-500 rounded-full" style={{width:`${pct}%`}}/></div><div className="text-[9px] text-gray-400 mt-1">반영비중 {w}% · 100% 초과 미반영</div></div>})}</div>
      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="px-4 py-3 border-b">
          <div className="text-sm font-bold">AA임팩트</div>
          {hasCompanyGoalBasis
            ? <div className="text-[10px] text-gray-400">회사 목표를 관리자 → 회사 목표의 HS 기준수량 비중({(share*100).toFixed(1)}%)으로 자동 배분 · 건수는 반올림</div>
            : <div className="text-[10px] text-red-500 font-semibold">⚠ 회사 목표의 HS 기준수량을 확인할 수 없어 AA임팩트 목표를 배분할 수 없습니다.</div>}
        </div>
        {aaRows.map(x=><div key={x.key} className="px-4 py-3 border-b flex justify-between gap-3"><div><div className="text-xs font-semibold">{x.label}</div><div className="text-[10px] text-gray-400 mt-1">목표 {x.unit==='won'?won(x.storeTarget):`${x.storeTarget}건`} · 실적 {x.unit==='won'?won(x.actual):`${fmtCount(x.actual)}건`}</div></div><div className="text-right"><b className="text-sm text-violet-700">{x.score.toFixed(1)}점</b><div className="text-[9px] text-gray-400">환산비중 {x.normalizedWeight.toFixed(1)}%</div></div></div>)}
        <div className="px-4 py-3 bg-gray-50 border-t">
          <div className="flex justify-between items-center mb-2"><span className="text-xs font-bold">AA임팩트 가감점</span><b className={`text-xs ${adj.total>=0?'text-emerald-600':'text-red-500'}`}>{adj.total>=0?'+':''}{adj.total.toFixed(1)}점</b></div>
          <div className="space-y-1.5">
            {[
              ['NPS', ext.npsScore?`${fmtNum(Number(ext.npsScore),1)}점 · 95점 기준`:'미입력', adj.npsAdj],
              ['불친절', `${fmtCount(Number(ext.unkindCount||0))}건`, adj.unkind],
              ['대외민원', `${fmtCount(Number(ext.complaintCount||0))}건`, adj.complaints],
              ['정보보호', ext.securityScore?`${fmtNum(Number(ext.securityScore),1)}점`:'미입력', adj.security],
              ['개인정보보호위원회', ext.privacyViolation?'적발':'해당 없음', adj.privacy],
              ['U+one 무체험', ext.noExperienceRate!==undefined&&ext.noExperienceRate!==''?`${fmtNum(Number(ext.noExperienceRate),1)}%`:'미입력', adj.noExp],
              ['매장 레벨링', ext.leveling==='4'?'Lv4':ext.leveling?'Lv4 미만':'미입력', adj.leveling],
              ['인터넷 비중', `${internetRatio.toFixed(1)}% · 홈 ${fmtCount(householdHome)} / HS ${fmtCount(hsActual)}`, adj.internet],
              ['대명', `목표 ${daemyungTarget}건 / 실적 ${fmtCount(actual('daemyung'))}건`, adj.daemyung],
              ['MNP 타사 가망', `목표 ${prospectTarget}건 / 실적 ${fmtCount(actual('prospectMnp'))}건`, adj.prospect],
            ].map(([label,basis,point])=><div key={label} className="flex items-center justify-between gap-3 text-[10px]"><div className="min-w-0"><span className="font-semibold text-gray-600">{label}</span><span className="text-gray-400 ml-1.5">{basis}</span></div><b className={Number(point)>0?'text-emerald-600':Number(point)<0?'text-red-500':'text-gray-400'}>{Number(point)>0?'+':''}{Number(point).toFixed(1)}점</b></div>)}
          </div>
        </div>
      </div>
    </>:managerMode==='incentive'&&canViewManagerIncentive?<>
      {month!=='2026-09'?<div className="bg-white rounded-2xl border p-5 text-center"><div className="text-sm font-bold text-gray-700">9월 관리자 정책이에요</div><div className="text-xs text-gray-400 mt-1">상단에서 2026년 9월을 선택하면 정책과 예상액을 확인할 수 있어요.</div></div>:
       !operator?.name?<div className="bg-white rounded-2xl border p-5 text-center"><div className="text-sm font-bold text-gray-700">지정된 운영 관리자가 없어요</div><div className="text-xs text-gray-400 mt-1">{displayStoreName(activeStore)}은 9월 관리자 인센티브 지급 대상자가 없습니다.</div></div>:<>
        <div className="rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white p-4 shadow-sm">
          <div className="flex justify-between gap-3"><div><div className="text-[10px] text-violet-100">{SEPTEMBER_MANAGER_POLICY_VERSION} · 월중 예상</div><div className="text-lg font-black mt-1">{operator.name} {operator.position}</div><div className="text-xs text-violet-100 mt-0.5">{displayStoreName(activeStore)} 운영 관리자</div></div><div className="text-right"><div className="text-[10px] text-violet-100">현재 예상액</div><div className="text-2xl font-black mt-1">{won(managerEstimate.finalAmount)}</div></div></div>
          <div className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-[10px] leading-relaxed">임팩트 평가 지급률은 월중 금액에 적용하지 않고 월 마감 시 최종 반영해요.</div>
        </div>
        <div className="bg-white rounded-2xl border overflow-hidden"><div className="px-4 py-3 border-b"><div className="text-sm font-bold">성과 인센티브</div><div className="text-[10px] text-gray-400 mt-0.5">달성 구간의 건당 금액 × 실제 완료 건수</div></div>{managerEstimate.metrics.map(m=><div key={m.key} className="px-4 py-3 border-b last:border-0"><div className="flex justify-between gap-3"><div><div className="text-xs font-bold">{{hs:'HS',home:'홈(소호 포함)',tvFree:'TV프리(부)',smartHome:'스마트홈'}[m.key]}</div><div className="text-[10px] text-gray-400 mt-1">{fmtNum(m.actual,1)} / {fmtNum(m.target,1)}건 · {m.achievement.toFixed(0)}% · {m.tier}</div></div><div className="text-right"><div className="text-sm font-black text-violet-700">{won(m.amount)}</div><div className="text-[9px] text-gray-400">{m.rate?`건당 ${won(m.rate)}`:'지급구간 전'}</div></div></div>{m.key==='hs'&&<div className={`mt-2 rounded-lg px-2.5 py-2 text-[10px] ${m.withheld?'bg-red-50 text-red-600':'bg-gray-50 text-gray-500'}`}>{m.homeBonus>0?`가정망 홈 12% 이상 · HS +20% ${won(m.homeBonus)}`:'가정망 홈 12% 추가 조건 미달'} · {m.strategicKnown?(m.withheld?'전략P 160% 미만으로 HS 미지급':`전략P ${fmtNum(Number(strategicRatio),1)}%`):'전략P 비중 확인 전'}</div>}</div>)}</div>
        <div className="grid grid-cols-2 gap-3"><div className="bg-white rounded-2xl border p-4"><div className="text-[10px] text-gray-400">추가 정책</div><div className="text-lg font-black text-emerald-600 mt-1">+{won(managerEstimate.bonusTotal)}</div><div className="mt-2 space-y-1">{managerEstimate.bonuses.map(x=><div key={x.key} className="flex justify-between text-[10px]"><span className={x.achieved?'text-gray-700 font-semibold':'text-gray-400'}>{x.label}</span><b className={x.amount?'text-emerald-600':'text-gray-300'}>{x.amount?`+${won(x.amount)}`:'—'}</b></div>)}</div></div><div className="bg-white rounded-2xl border p-4"><div className="text-[10px] text-gray-400">현재 확인된 차감</div><div className="text-lg font-black text-red-500 mt-1">-{won(managerEstimate.deductionTotal)}</div><div className="mt-2 space-y-1">{managerEstimate.deductions.length?managerEstimate.deductions.map(x=><div key={x.key} className="flex justify-between text-[10px]"><span className="text-gray-600">{x.label}</span><b className="text-red-500">-{won(x.amount)}</b></div>):<div className="text-[10px] text-gray-300">현재 확인된 차감 없음</div>}</div></div></div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-[10px] text-amber-700 leading-relaxed">현재 입력·확인된 실적 기준 예상액이에요. 전략P·115군과 월말 임팩트 값이 확정되면 금액이 달라질 수 있습니다. · 2ND 기준 {septemberManagerStoreType(activeStore)==='consignment'?'위탁 20건':'자가 10건'}</div>
      </>}
    </>:<>
      <div className="bg-white rounded-2xl border p-4"><div className="flex justify-between"><div><div className="text-sm font-bold">실적 최신화</div><div className="text-[10px] text-gray-400 mt-1">직원 입력 누적과 관리자 확인값을 비교하고, 평가에는 관리자 확인값을 우선 사용합니다.</div></div><button onClick={saveSnapshot} disabled={saving} className="px-3 py-2 rounded-xl bg-violet-600 text-white text-xs font-bold h-fit">{saving?'저장중':'최신화 완료'}</button></div><div className="mt-3 space-y-2">{[['HS','hs'],['홈','home'],['생산성','productivity'],['MNP','mnp'],['SIM MNP','simMnp'],['TV부셋탑(가정망)','subTvHousehold'],['TV프리(부)','tvFree'],['스마트홈','smartHome'],['타사 고객 등록','otherCustomer'],['맞춤제안 매출액','tailoredAmount'],['대명','daemyung'],['MNP 타사 가망 개통','prospectMnp']].map(([l,k])=><div key={k} className="grid grid-cols-[1fr_70px_90px] gap-2 items-center"><div className="text-xs text-gray-600">{l}</div><div className="text-[10px] text-gray-400 text-right">입력 {k==='tailoredAmount'?won(live[k]):fmtNum(live[k],1)}</div><input type="number" value={verified[k]??live[k]??0} onChange={e=>setVerified(k,e.target.value)} className="border rounded-lg px-2 py-1.5 text-xs text-right"/></div>)}</div></div>
      <div className="bg-white rounded-2xl border p-4"><div className="text-sm font-bold">AA임팩트 외부 평가값</div><div className="grid grid-cols-2 gap-2 mt-3">{[['NPS 점수','npsScore'],['불친절 건수','unkindCount'],['대외민원 건수','complaintCount'],['정보보호 점수','securityScore'],['U+one 무체험률(%)','noExperienceRate']].map(([l,k])=><label key={k} className="text-[10px] text-gray-500">{l}<input type="number" value={ext[k]??''} onChange={e=>setExt(k,e.target.value)} className="w-full mt-1 border rounded-lg px-2 py-2 text-xs"/></label>)}<label className="text-[10px] text-gray-500">매장 레벨링<select value={ext.leveling||''} onChange={e=>setExt('leveling',e.target.value)} className="w-full mt-1 border rounded-lg px-2 py-2 text-xs"><option value="">미입력</option><option value="4">Lv4</option><option value="below4">Lv4 미만</option></select></label><label className="text-[10px] text-gray-500 flex items-center gap-2 mt-4"><input type="checkbox" checked={!!ext.privacyViolation} onChange={e=>setExt('privacyViolation',e.target.checked)}/> 개인정보보호위원회 적발</label><div className="col-span-2 text-[10px] text-gray-400 bg-gray-50 rounded-lg p-2">대명 목표 {daemyungTarget}건 · MNP 타사 가망 목표 {prospectTarget}건은 회사 목표(37건/21건)를 HS 기준수량 비중으로 자동 배분해 달성 여부를 판단합니다.</div></div></div>
      <div className="bg-white rounded-2xl border p-4"><div className="flex justify-between"><div><div className="text-sm font-bold">{monthLabel(month)} AA임팩트 회사 목표</div><div className="text-[10px] text-gray-400">회사 목표 입력 후 관리자 → 회사 목표의 매장별 HS 기준수량 비중으로 자동 배분합니다. 반영비중 합계는 100점으로 환산하고 항목별 110%까지 인정합니다.</div></div><button onClick={saveAa} className="px-3 py-2 rounded-xl bg-gray-900 text-white text-xs font-bold h-fit">목표 저장</button></div><div className="space-y-2 mt-3">{aaConfig.map((x,i)=><div key={x.key} className="grid grid-cols-[1fr_55px_90px] gap-2 items-center"><input value={x.label} onChange={e=>setAaConfig(v=>v.map((a,j)=>j===i?{...a,label:e.target.value}:a))} className="border rounded-lg px-2 py-1.5 text-xs"/><input type="number" value={x.weight} onChange={e=>setAaConfig(v=>v.map((a,j)=>j===i?{...a,weight:Number(e.target.value||0)}:a))} className="border rounded-lg px-2 py-1.5 text-xs text-right"/><input type="number" value={x.target} onChange={e=>setAaConfig(v=>v.map((a,j)=>j===i?{...a,target:Number(e.target.value||0)}:a))} className="border rounded-lg px-2 py-1.5 text-xs text-right"/></div>)}</div></div>
    </>}
  </div>;
}


function qualityPct(n,d){return d>0?Number((Number(n||0)/d*100).toFixed(1)):0}
function mobileStrategicPoint({strategicPlan=false,vasKeys=[],bundleVasMap={}}={}){
  return calculateSaleStrategicPoints({strategicPlan,vasKeys,bundleVasMap});
}
function qualityFromSales(sales=[], homeOrders=[], sonoCount=0){
  const mobile=(sales||[]).filter(x=>x.source_type==='mobile');
  const hs=mobile.filter(x=>HS_PARTS.some(p=>p.idx===Number(x.source_meta?.ri))).length;
  const plan115=mobile.filter(x=>HS_PARTS.some(p=>p.idx===Number(x.source_meta?.ri))&&Number(x.source_meta?.ci)===0).length;
  const mnpRi=MATRIX_ROWS.indexOf('일반모델 MNP');
  const mnp=mobile.filter(x=>Number(x.source_meta?.ri)===mnpRi).length;
  const second=mobile.reduce((sum,x)=>sum+(x.source_meta?.bundle2ndKeys||[]).length,0);
  const strategicPlan=mobile.filter(x=>!!x.source_meta?.strategicPlan).length;

  // 홈은 동일 고객/날짜의 인터넷을 1건으로 계산. 올인원 포함.
  const internetKeys=new Set();
  let free=0,smart=0;
  (homeOrders||[]).forEach(o=>{
    const d=String(o.source_work_date||o.actual_install_date||'').slice(0,10);
    const ck=o.customer_id||o.customer_name||o.id;
    if(['internet1g','internet500','internet100','homeOnly','homeTv'].includes(o.product_type))internetKeys.add(`${d}|${ck}`);
    if(o.product_type==='tvFree')free++;
    if(o.product_type==='smartHome')smart++;
  });

  const {insurance,strategicVas,daemyungCount,strategicPointsWithoutDaemyung}=summarizeVasQuality(mobile);
  const revenuePoints=Number(strategicPointsWithoutDaemyung||0)+Math.max(Number(daemyungCount||0),Number(sonoCount||0))*2;
  return {hs,plan115,home:internetKeys.size,freeSmart:free+smart,mnp,second,strategicPlan,insurance,strategicVas,sono:Number(sonoCount||0),revenuePoints,
    plan115Pct:qualityPct(plan115,hs),homePct:qualityPct(internetKeys.size,hs),freeSmartPct:qualityPct(free+smart,hs),mnpPct:qualityPct(mnp,hs),secondPct:qualityPct(second,hs),revenuePct:qualityPct(revenuePoints,hs)};
}

function QualityMetricCard({label,value,sub=''}){return <div className="bg-white border border-gray-100 rounded-xl p-3"><div className="text-[10px] text-gray-400">{label}</div><div className="text-xl font-black text-gray-900 mt-1">{value}</div>{sub&&<div className="text-[9px] text-gray-400 mt-1">{sub}</div>}</div>}

function SalesQualityPanel({month,employee=null,employees=[],isManager=false,loginBranch='',canSwitchStores=false}){
  const [loading,setLoading]=useState(true),[data,setData]=useState({}),[storeFilter,setStoreFilter]=useState(loginBranch||'');
  const scoped=(employees||[]).filter(e=>!NON_SALES_STORES.includes(e.branch)).filter(e=>canSwitchStores||!loginBranch?true:e.branch===loginBranch);
  const ids=isManager?scoped.map(e=>e.id):[employee?.id].filter(Boolean);
  useEffect(()=>{if(!ids.length){setData({});setLoading(false);return}
    (async()=>{setLoading(true);const [y,m]=month.split('-').map(Number),n=new Date(y,m,1),to=`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-01`;
      const [sr,hr,dr]=await Promise.all([
        supabase.from('customer_sales').select('user_id,source_type,source_meta').in('user_id',ids).gte('sale_date',`${month}-01`).lt('sale_date',to),
        supabase.from('home_orders').select('id,user_id,customer_id,customer_name,product_type,sale_type,source_work_date,actual_install_date').in('user_id',ids).or(`source_work_date.gte.${month}-01,actual_install_date.gte.${month}-01`),
        supabase.from('daily_records').select('user_id,work_date,data').in('user_id',ids).gte('work_date',`${month}-01`).lt('work_date',to)
      ]);
      const map={};ids.forEach(id=>map[id]={sales:[],home:[],sono:0});
      (sr.data||[]).forEach(x=>map[x.user_id]?.sales.push(x));
      (hr.data||[]).filter(x=>{const d=String(x.source_work_date||x.actual_install_date||'');return d>=`${month}-01`&&d<to}).forEach(x=>map[x.user_id]?.home.push(x));
      (dr.data||[]).forEach(x=>{const g=x.data?.groups?.sono||{};if(map[x.user_id])map[x.user_id].sono+=Object.values(g).reduce((a,v)=>a+Number(v||0),0)});
      const result={};ids.forEach(id=>result[id]=qualityFromSales(map[id]?.sales||[],map[id]?.home||[],map[id]?.sono||0));setData(result);setLoading(false);
    })().catch(err=>{console.error('SALES QUALITY LOAD ERROR',err);const result={};ids.forEach(id=>result[id]=qualityFromSales([],[],0));setData(result);setLoading(false);});
  },[month,ids.join('|')]);

  if(loading)return <div className="bg-white rounded-xl border p-4 text-sm text-gray-400">판매 퀄리티 계산 중...</div>;
  const render=(q)=>{
    const safe={
      hs:Number(q?.hs||0),plan115:Number(q?.plan115||0),home:Number(q?.home||0),
      freeSmart:Number(q?.freeSmart||0),mnp:Number(q?.mnp||0),second:Number(q?.second||0),
      revenuePoints:Number(q?.revenuePoints||0),
      plan115Pct:Number(q?.plan115Pct||0),homePct:Number(q?.homePct||0),
      freeSmartPct:Number(q?.freeSmartPct||0),mnpPct:Number(q?.mnpPct||0),
      secondPct:Number(q?.secondPct||0),revenuePct:Number(q?.revenuePct||0)
    };
    return <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      <QualityMetricCard label="115군 비중" value={`${safe.plan115Pct}%`} sub={`${safe.plan115}/${safe.hs}건`} />
      <QualityMetricCard label="홈(인터넷) 비중" value={`${safe.homePct}%`} sub={`${safe.home}/${safe.hs}건 · 올인원 포함`} />
      <QualityMetricCard label="프리+스홈 비중" value={`${safe.freeSmartPct}%`} sub={`${safe.freeSmart}/${safe.hs}건 · 상품수 기준`} />
      <QualityMetricCard label="MNP 비중" value={`${safe.mnpPct}%`} sub={`${safe.mnp}/${safe.hs}건`} />
      <QualityMetricCard label="2ND 번들 비중" value={`${safe.secondPct}%`} sub={`${safe.second}/${safe.hs}건 · 상품수 기준`} />
      <QualityMetricCard label="매출지표" value={`${safe.revenuePct}%`} sub={`총 ${safe.revenuePoints.toFixed(1)}P / HS ${safe.hs}건`} />
    </div>;
  };

  if(!isManager)return <div className="space-y-3"><div><div className="text-xs text-violet-600 font-semibold">보조지표</div><div className="text-lg font-bold">판매 퀄리티 · {monthLabel(month)}</div><div className="text-[10px] text-gray-400 mt-1">평가점수에는 반영되지 않습니다.</div></div>{render(data[employee?.id])}</div>;

  const stores=sortStoresByOpenOrder([...new Set(scoped.map(e=>e.branch))]);
  const selectedStore=storeFilter||stores[0]||'';
  const members=scoped.filter(e=>e.branch===selectedStore);
  const emptyAgg={hs:0,plan115:0,home:0,freeSmart:0,mnp:0,second:0,strategicPlan:0,insurance:0,strategicVas:0,sono:0,revenuePoints:0};
  const agg=members.reduce((a,e)=>{const q=data[e.id];if(!q)return a;Object.keys(emptyAgg).forEach(k=>a[k]=Number(a[k]||0)+Number(q[k]||0));return a},{...emptyAgg});
  const storeQ={...agg,plan115Pct:qualityPct(agg.plan115,agg.hs),homePct:qualityPct(agg.home,agg.hs),freeSmartPct:qualityPct(agg.freeSmart,agg.hs),mnpPct:qualityPct(agg.mnp,agg.hs),secondPct:qualityPct(agg.second,agg.hs),revenuePct:qualityPct(agg.revenuePoints,agg.hs)};
  if(!stores.length)return <div className="bg-white rounded-xl border p-5"><div className="text-sm font-bold text-gray-800">판매 퀄리티</div><div className="text-xs text-gray-400 mt-1">조회 가능한 매장이 없습니다.</div></div>;
  return <div className="space-y-3"><div className="flex justify-between items-end gap-2"><div><div className="text-xs text-violet-600 font-semibold">판매 퀄리티</div><div className="text-lg font-bold">매장/직원 보조지표</div><div className="text-[10px] text-gray-400 mt-1">매장 수치는 직원 비율 평균이 아니라 매장 전체 HS 기준으로 재계산합니다.</div></div><select value={selectedStore} onChange={e=>setStoreFilter(e.target.value)} className="border rounded-lg px-2 py-2 text-xs">{stores.map(st=><option key={st} value={st}>{displayStoreName(st)}</option>)}</select></div>
    <div className="bg-violet-50/50 border border-violet-100 rounded-xl p-3"><div className="text-sm font-bold mb-2">{displayStoreName(selectedStore)} 전체</div>{render(storeQ)}</div>
    <div className="space-y-2">{members.length?members.map(e=><div key={e.id} className="bg-white border rounded-xl p-3"><div className="font-bold text-sm mb-2">{e.name}</div>{render(data[e.id])}</div>):<div className="bg-white border rounded-xl p-4 text-xs text-gray-400">이 매장에 조회 가능한 직원이 없습니다.</div>}</div>
  </div>;
}

function EvaluationTab({ month, employee, config, isManagerView=false, canFinalApprove=false, employees=[], rows=[], authUserId, canSwitchStores=false, loginBranch='' }){
  const [mode,setMode]=useState('career');
  const managerEligible=isManagerView;
  return <div className="space-y-3"><div><div className="text-xs text-violet-600 font-semibold">평가</div><div className="text-xl font-bold text-gray-900">{mode==='quality'?'판매 퀄리티':'커리어 등급'}</div></div><div className={`grid ${managerEligible?'grid-cols-3':'grid-cols-2'} bg-gray-100 rounded-xl p-1 gap-1`}><button onClick={()=>setMode('career')} className={`py-2 rounded-lg text-xs font-bold ${mode==='career'?'bg-white text-violet-700 shadow-sm':'text-gray-500'}`}>개인 커리어 등급</button>{managerEligible&&<button onClick={()=>setMode('manager')} className={`py-2 rounded-lg text-xs font-bold ${mode==='manager'?'bg-white text-violet-700 shadow-sm':'text-gray-500'}`}>관리자 평가</button>}<button onClick={()=>setMode('quality')} className={`py-2 rounded-lg text-xs font-bold ${mode==='quality'?'bg-white text-violet-700 shadow-sm':'text-gray-500'}`}>판매 퀄리티</button></div>{mode==='career'?<CareerEvaluationPanel employee={employee} month={month} config={config} canManage={managerEligible} canFinalApprove={canFinalApprove} managerScopeEmployees={employees}/>:mode==='manager'?<ManagerEvaluationPanel month={month} employees={employees} rows={rows} authUserId={authUserId} canSwitchStores={canSwitchStores} loginBranch={loginBranch}/>:<SalesQualityPanel month={month} employee={employee} employees={employees} isManager={managerEligible} loginBranch={loginBranch} canSwitchStores={canSwitchStores}/>}</div>;
}


/* ===================== 직원 화면 ===================== */

/* v21.27 직원 홈 재구성: 홈-개인 / 홈-매장, 월 누적 성과 랭킹 */

const MONTHLY_RANK_METRICS = [
  { key:'hs', label:'HS', unit:'건', value:(r)=>hsCount(r.draft) },
  { key:'home', label:'홈', unit:'건', value:(r)=>Number(r.draft?.homeBase?.homeOnly||0)+Number(r.draft?.homeBase?.homeTv||0) },
  { key:'free', label:'프리', unit:'건', value:(r)=>Number(r.draft?.homeFlat?.tvFree||0) },
  { key:'smart', label:'스홈', unit:'건', value:(r)=>Number(r.draft?.homeFlat?.smartHome||0) },
  { key:'productivity', label:'생산성', unit:'P', value:(r)=>Number(r.pay?.kpiScore||0) },
  { key:'upsell', label:'맞춤제안 업셀건', unit:'건', value:(r)=>Number(r.draft?.tailoredCount||0) },
];

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
          className={`shrink-0 px-2.5 py-1.5 rounded-full border text-[10px] font-semibold ${metricKey===m.key?'bg-violet-600 border-violet-600 text-white':'bg-white border-gray-200 text-gray-500'}`}>
          {m.label}
        </button>)}
      </div>
    </div>

    <div className="divide-y divide-gray-50">
      {displayRows.map((r)=>{
        const rr=rankOf(r);
        const isMe=String(r.id||'')===String(userId||'') || (userName&&String(r.name||'').trim()===String(userName||'').trim()&&(!userBranch||String(r.branch||'')===String(userBranch||'')));
        return <div key={r.id} className={`flex items-center justify-between px-4 py-2.5 gap-3 ${showAll&&isMe?'bg-violet-50':''}`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${rr===1?'bg-amber-100 text-amber-700':rr===2?'bg-gray-100 text-gray-600':'bg-orange-50 text-orange-600'}`}>{rr}</span>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-gray-800 truncate">{r.name}{showAll&&isMe&&<span className="ml-1 text-[9px] text-violet-600">나</span>}</div>
            {!branchOnly&&<div className="text-[10px] text-gray-400 truncate">{displayStoreName(r.branch)}</div>}
          </div>
        </div>
        <div className="text-xs font-bold text-gray-800">{fmt(metric.value(r))}</div>
      </div>})}
    </div>

    {!showAll&&me&&<div className="px-4 py-2.5 bg-violet-50 flex items-center justify-between">
      <span className="text-xs font-semibold text-violet-700">나 · {myTied?'공동 ':''}{fmtCount(myRank)}위</span>
      <span className="text-xs font-bold text-violet-700">{fmt(metric.value(me))}</span>
    </div>}
  </div>;
}

function StoreHomeOverview({ rows, branch, month, userId, userName='' }) {
  const members=(rows||[]).filter(r=>r.branch===branch);
  const [savedGoals,setSavedGoals]=useState({});
  useEffect(()=>{
    let alive=true;
    if(!branch){setSavedGoals({});return()=>{alive=false};}
    supabase.from('store_goals').select('company_goals,challenge_goals').eq('month',month).eq('store_name',branch).maybeSingle()
      .then(({data})=>{if(alive)setSavedGoals({...companyGoalDefaults(branch),...(data?.company_goals||{}),...(data?.challenge_goals||{})})});
    return()=>{alive=false};
  },[branch,month]);
  if(!branch || !members.length)return <div className="bg-white rounded-2xl border border-gray-100 p-4 text-sm text-gray-400">현재 매장 실적을 불러올 수 없어요.</div>;

  const sum=(fn)=>members.reduce((a,r)=>a+Number(fn(r)||0),0);
  const goal={...companyGoalDefaults(branch),...savedGoals};
  const forecastFactor=monthKeyOf(new Date())===month?daysInMonth(month)/Math.max(1,new Date().getDate()):1;

  const metrics=[
    {key:'hs',label:'HS',unit:'count',current:sum(r=>hsCount(r.draft)),target:Number(goal.hs||0)},
    {key:'simMnp',label:'SIM MNP',unit:'count',current:sum(r=>(r.draft?.matrix?.[5]||[]).reduce((s,v)=>s+Number(v||0),0)),target:Number(goal.simMnp||0)},
    {key:'second',label:'2ND',unit:'count',current:sum(r=>(r.draft?.matrix?.[7]||[]).reduce((s,v)=>s+Number(v||0),0)+Object.values(r.draft?.bundle2nd||{}).reduce((s,v)=>s+Number(v||0),0)),target:Number(goal.second||0)},
    {key:'productivity',label:'생산성',unit:'point',current:sum(r=>r.pay?.kpiScore||0),target:Number(goal.productivity||goal.kpi||0)},
    {key:'home',label:'홈',unit:'count',current:sum(r=>(r.draft?.homeBase?.homeOnly||0)+(r.draft?.homeBase?.homeTv||0)),target:Number(goal.home||0)},
    {key:'free',label:'프리',unit:'count',current:sum(r=>r.draft?.homeFlat?.tvFree||0),target:Number(goal.tvFree||goal.free||0)},
    {key:'smart',label:'스홈',unit:'count',current:sum(r=>r.draft?.homeFlat?.smartHome||0),target:Number(goal.smartHome||goal.smart||0)},
    {key:'sono',label:'소노',unit:'count',current:sum(r=>Object.values(r.draft?.sono||{}).reduce((s,v)=>s+Number(v||0),0)),target:Number(goal.sono||0)},
    {key:'tailoredAmount',label:'맞춤제안 매출액',unit:'won',current:sum(r=>r.draft?.tailoredAmount||0),target:Number(goal.tailoredAmount||0)},
    {key:'tailored',label:'업셀건',unit:'count',current:sum(r=>r.draft?.tailoredCount||0),target:Number(goal.tailoredCount||goal.tailored||0)},
  ];

  const fmtValue=(m,v)=>{
    if(m.unit==='won')return won(Math.round(v));
    if(m.unit==='point')return `${fmtNum(Number(v||0),1)}P`;
    return `${fmtNum(Number(v||0),Number(v||0)%1?1:0)}건`;
  };

  return <div className="space-y-4">
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-50">
        <div className="text-xs text-gray-400">📊 {monthLabel(month)}</div>
        <div className="text-sm font-bold text-gray-900 mt-0.5">{displayStoreName(branch)} 매장 목표 현황</div>
        <div className="text-[10px] text-gray-400 mt-1">매장 누적 실적과 목표 달성률을 한 번에 확인해요.</div>
      </div>

      <div className="px-3 py-2">
        <div className="grid grid-cols-[minmax(72px,1.25fr)_minmax(58px,1fr)_minmax(55px,.9fr)_minmax(48px,.8fr)_minmax(66px,1fr)] gap-1 px-2 pb-2 text-[9px] text-gray-400 text-right"><span className="text-left">항목</span><span>목표</span><span>실적</span><span>진척도</span><span>예상 마감</span></div>
        <div className="divide-y divide-gray-100">
        {metrics.map(m=>{
          const hasGoal=Number(m.target||0)>0;
          const pct=hasGoal?Math.max(0,Math.round(Number(m.current||0)/Number(m.target||1)*100)):null;
          const forecast=Number(m.current||0)*forecastFactor,forecastHit=hasGoal&&forecast>=m.target;
          return <div key={m.key} className="grid grid-cols-[minmax(72px,1.25fr)_minmax(58px,1fr)_minmax(55px,.9fr)_minmax(48px,.8fr)_minmax(66px,1fr)] gap-1 items-center px-2 py-2.5 text-right text-[10px]">
            <span className="text-left font-semibold text-gray-700 truncate">{m.label}</span>
            {hasGoal?<span className="text-gray-500 whitespace-nowrap">{fmtValue(m,m.target)}</span>:<span className="justify-self-end rounded-md bg-red-50 px-1.5 py-1 text-[8px] font-bold leading-tight text-red-600">입력 필요</span>}
            <span className="font-bold text-gray-900 whitespace-nowrap">{fmtValue(m,m.current)}</span>
            <span className={`font-bold ${pct===null?'text-gray-300':pct>=100?'text-emerald-600':pct>=80?'text-amber-600':'text-gray-500'}`}>{pct===null?'—':`${pct}%`}</span>
            <span className={`font-bold whitespace-nowrap ${hasGoal?(forecastHit?'text-emerald-600':'text-red-500'):'text-violet-600'}`}>{fmtValue(m,forecast)}</span>
          </div>;
        })}
        </div>
      </div>
    </div>

    <MonthlyPerformanceRankingCard
      rows={members}
      userId={userId}
      userName={userName}
      userBranch={branch}
      branchOnly={branch}
      title="매장 월 누적 순위"
      showAll
    />
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
  { key: 'home', label: '홈', unit: '건', value: (r) => Number((r.draft?.homeBase?.homeOnly || 0) + (r.draft?.homeBase?.homeTv || 0)) },
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
        <div className="px-4 py-3 bg-violet-50 flex items-center justify-between gap-3">
          <div className="text-xs font-semibold text-violet-700">나는 현재 {myIndex + 1}위</div>
          <div className="text-sm font-bold text-violet-700">
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
        <div className="flex items-center justify-between text-sm px-3 py-2 rounded-lg bg-violet-50 text-violet-800">
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
          {idx === 1 ? '1위' : `${idx}위`}까지 <b className="text-violet-700">
            {formatCompetitionValue(gap, metric.unit)}
          </b> 차이예요 🔥
        </div>
      )}
    </div>
  );
}


/* ===================== 게임화 2차: 배지 · 퀘스트 · 칭호 · 인정 ===================== */

const BADGE_DEFS = [
  { key: 'first_step', icon: '🌱', name: '첫 발자국', rarity: 'COMMON', hidden: false, desc: '첫 HS 판매', auto: true },
  { key: 'hs_y10', icon: '🔟', name: '스타트 텐', rarity: 'COMMON', hidden: false, desc: '올해 HS 10건', auto: true },
  { key: 'hs_y30', icon: '🏃', name: '페이스 업', rarity: 'COMMON', hidden: false, desc: '올해 HS 30건', auto: true },
  { key: 'hs_y50', icon: '🎯', name: '하프 센추리', rarity: 'RARE', hidden: false, desc: '올해 HS 50건', auto: true },
  { key: 'hs_y100', icon: '💯', name: '백전백승', rarity: 'RARE', hidden: false, desc: '올해 HS 100건', auto: true },
  { key: 'hs_y150', icon: '🚀', name: '150 클럽', rarity: 'RARE', hidden: false, desc: '올해 HS 150건', auto: true },
  { key: 'hs_y200', icon: '🔥', name: '200 클럽', rarity: 'EPIC', hidden: false, desc: '올해 HS 200건', auto: true },
  { key: 'hs_y250', icon: '⚡', name: '250 클럽', rarity: 'EPIC', hidden: false, desc: '올해 HS 250건', auto: true },
  { key: 'hs_y300', icon: '💎', name: '300 클럽', rarity: 'EPIC', hidden: false, desc: '올해 HS 300건', auto: true },
  { key: 'hs_y500', icon: '👑', name: '500 클럽', rarity: 'LEGEND', hidden: false, desc: '올해 HS 500건', auto: true },
  { key: 'hs_m20', icon: '📦', name: '월간 20', rarity: 'COMMON', hidden: false, desc: '한 달 HS 20건', auto: true },
  { key: 'hs_m30', icon: '📈', name: '월간 30', rarity: 'RARE', hidden: false, desc: '한 달 HS 30건', auto: true },
  { key: 'hs_m40', icon: '🔥', name: '월간 40', rarity: 'RARE', hidden: false, desc: '한 달 HS 40건', auto: true },
  { key: 'hs_m50', icon: '🦁', name: '50의 벽', rarity: 'EPIC', hidden: false, desc: '한 달 HS 50건', auto: true },
  { key: 'hs_m60', icon: '🚀', name: '월간 폭주', rarity: 'EPIC', hidden: false, desc: '한 달 HS 60건', auto: true },
  { key: 'hs_m70', icon: '💥', name: '브레이크 아웃', rarity: 'EPIC', hidden: false, desc: '한 달 HS 70건', auto: true },
  { key: 'hs_m80', icon: '🏆', name: '80 클럽', rarity: 'LEGEND', hidden: false, desc: '한 달 HS 80건', auto: true },
  { key: 'hs_m100', icon: '💯', name: '월간 센추리', rarity: 'LEGEND', hidden: false, desc: '한 달 HS 100건', auto: true },
  { key: 'hs_personal_record', icon: '🌋', name: '한계 돌파', rarity: 'RARE', hidden: false, desc: '자신의 월 HS 최고기록 경신', auto: true },
  { key: 'hs_guinness', icon: '🐐', name: '미소 기네스 · HS', rarity: 'LEGEND', hidden: false, desc: '회사 역대 월 HS 최고기록 경신', auto: true },
  { key: 'hs_rank3', icon: '🥉', name: '포디움', rarity: 'RARE', hidden: false, desc: '월 HS 전체 3위', auto: true },
  { key: 'hs_rank2', icon: '🥈', name: '실버 러시', rarity: 'EPIC', hidden: false, desc: '월 HS 전체 2위', auto: true },
  { key: 'hs_rank1', icon: '🥇', name: '이번 달 주인공', rarity: 'EPIC', hidden: false, desc: '월 HS 전체 1위', auto: true },
  { key: 'hs_year1', icon: '👑', name: '올해의 HS KING', rarity: 'LEGEND', hidden: false, desc: '올해 누적 HS 전체 1위', auto: true },
  { key: 'hs_store1', icon: '🏠', name: '우리 매장 ACE', rarity: 'RARE', hidden: false, desc: '월 HS 매장 1위', auto: true },
  { key: 'hs_back2back', icon: '🔥', name: '백투백', rarity: 'LEGEND', hidden: false, desc: '월 HS 1위 2개월 연속', auto: true },
  { key: 'hs_triple', icon: '🏆', name: '트리플 크라운', rarity: 'LEGEND', hidden: false, desc: '월 HS 1위 3회', auto: true },
  { key: 'hs_top10', icon: '🎖', name: 'TOP10', rarity: 'COMMON', hidden: false, desc: '월 HS 전체 10위 이내', auto: true },
  { key: 'hs_top5', icon: '⭐', name: 'TOP5', rarity: 'RARE', hidden: false, desc: '월 HS 전체 5위 이내', auto: true },
  { key: 'hs_top10_3m', icon: '🧱', name: '자리 지킴이', rarity: 'EPIC', hidden: false, desc: '3개월 연속 HS TOP10', auto: true },
  { key: 'home_first', icon: '🏠', name: '첫 홈', rarity: 'COMMON', hidden: false, desc: '첫 홈 판매', auto: true },
  { key: 'home_m5', icon: '🏡', name: '홈 스타터', rarity: 'COMMON', hidden: false, desc: '월 홈 5건', auto: true },
  { key: 'home_m10', icon: '🏘', name: '홈 러너', rarity: 'RARE', hidden: false, desc: '월 홈 10건', auto: true },
  { key: 'home_m15', icon: '🏢', name: '홈 프로', rarity: 'RARE', hidden: false, desc: '월 홈 15건', auto: true },
  { key: 'home_m20', icon: '🏰', name: '홈 마스터', rarity: 'EPIC', hidden: false, desc: '월 홈 20건', auto: true },
  { key: 'home_y100', icon: '💯', name: '홈 센추리', rarity: 'EPIC', hidden: false, desc: '올해 홈 100건', auto: true },
  { key: 'home_rank1', icon: '👑', name: '홈 KING', rarity: 'EPIC', hidden: false, desc: '월 홈 전체 1위', auto: true },
  { key: 'home_year1', icon: '🏆', name: '올해의 홈 KING', rarity: 'LEGEND', hidden: false, desc: '올해 홈 누적 1위', auto: true },
  { key: 'home_day3', icon: '🔥', name: '홈 올인', rarity: 'RARE', hidden: false, desc: '하루 홈 3건 이상', auto: true },
  { key: 'internet_y50', icon: '📡', name: '인터넷 전문가', rarity: 'RARE', hidden: false, desc: '인터넷 연간 50건', auto: true },
  { key: 'hometv_m10', icon: '📺', name: 'TV 콤보', rarity: 'RARE', hidden: false, desc: '홈+TV 월 10건', auto: true },
  { key: 'home_guinness', icon: '🐐', name: '미소 기네스 · 홈', rarity: 'LEGEND', hidden: false, desc: '회사 역대 월 홈 최고기록', auto: true },
  { key: 'free_first', icon: '📺', name: '프리 스타트', rarity: 'COMMON', hidden: false, desc: '첫 TV프리', auto: true },
  { key: 'free_m5', icon: '🪽', name: '프리 러너', rarity: 'COMMON', hidden: false, desc: '월 프리 5건', auto: true },
  { key: 'free_m10', icon: '📺', name: '프리 마스터', rarity: 'RARE', hidden: false, desc: '월 프리 10건', auto: true },
  { key: 'free_rank1', icon: '👑', name: '프리 KING', rarity: 'EPIC', hidden: false, desc: '월 프리 전체 1위', auto: true },
  { key: 'free_y100', icon: '💯', name: '프리 센추리', rarity: 'EPIC', hidden: false, desc: '올해 프리 100건', auto: true },
  { key: 'smart_first', icon: '💡', name: '스마트 스타트', rarity: 'COMMON', hidden: false, desc: '첫 스마트홈', auto: true },
  { key: 'smart_m5', icon: '🏡', name: '스마트 라이프', rarity: 'COMMON', hidden: false, desc: '월 스마트홈 5건', auto: true },
  { key: 'smart_m10', icon: '💡', name: '스마트 마스터', rarity: 'RARE', hidden: false, desc: '월 스마트홈 10건', auto: true },
  { key: 'smart_rank1', icon: '👑', name: '스홈 KING', rarity: 'EPIC', hidden: false, desc: '월 스마트홈 전체 1위', auto: true },
  { key: 'smart_y50', icon: '🧠', name: '스마트 컬렉터', rarity: 'EPIC', hidden: false, desc: '올해 스마트홈 50건', auto: true },
  { key: 'upsell_first', icon: '🎯', name: '첫 적중', rarity: 'COMMON', hidden: false, desc: '첫 맞춤제안 업셀', auto: true },
  { key: 'upsell_m5', icon: '🎯', name: '취향저격', rarity: 'COMMON', hidden: false, desc: '월 맞춤제안 업셀 5건', auto: true },
  { key: 'upsell_m10', icon: '📈', name: '업셀러', rarity: 'RARE', hidden: false, desc: '월 맞춤제안 업셀 10건', auto: true },
  { key: 'upsell_m20', icon: '🚀', name: '업셀 마스터', rarity: 'EPIC', hidden: false, desc: '월 맞춤제안 업셀 20건', auto: true },
  { key: 'upsell_rank1', icon: '👑', name: '업셀 KING', rarity: 'EPIC', hidden: false, desc: '월 맞춤제안 업셀 전체 1위', auto: true },
  { key: 'upsell_y100', icon: '💯', name: '업셀 센추리', rarity: 'EPIC', hidden: false, desc: '올해 맞춤제안 업셀 100건', auto: true },
  { key: 'upsell_day3', icon: '🦅', name: '기회 포착', rarity: 'RARE', hidden: false, desc: '하루 맞춤제안 업셀 3건', auto: true },
  { key: 'upsell_day5', icon: '🔥', name: '업셀 폭주', rarity: 'EPIC', hidden: false, desc: '하루 맞춤제안 업셀 5건', auto: true },
  { key: 'upsell_year1', icon: '🏆', name: '올해의 업셀 KING', rarity: 'LEGEND', hidden: false, desc: '올해 누적 업셀 1위', auto: true },
  { key: 'upsell_guinness', icon: '🐐', name: '미소 기네스 · 업셀', rarity: 'LEGEND', hidden: false, desc: '역대 월 업셀 최고기록', auto: true },
  { key: 'upsell_goal100', icon: '🎯', name: '정조준', rarity: 'RARE', hidden: false, desc: '월 맞춤제안 목표 100%', auto: true },
  { key: 'upsell_goal150', icon: '💥', name: '오버클럭', rarity: 'EPIC', hidden: false, desc: '월 맞춤제안 목표 150%', auto: true },
  { key: 'second_first', icon: '📱', name: '하나 더', rarity: 'COMMON', hidden: false, desc: '첫 2ND 번들', auto: true },
  { key: 'second_m5', icon: '✌️', name: '투게더', rarity: 'COMMON', hidden: false, desc: '월 2ND 5건', auto: true },
  { key: 'second_m10', icon: '📦', name: '번들러', rarity: 'RARE', hidden: false, desc: '월 2ND 10건', auto: true },
  { key: 'second_m20', icon: '🚀', name: '번들 마스터', rarity: 'EPIC', hidden: false, desc: '월 2ND 20건', auto: true },
  { key: 'second_rank1', icon: '👑', name: '2ND KING', rarity: 'EPIC', hidden: false, desc: '월 2ND 전체 1위', auto: true },
  { key: 'second_y100', icon: '💯', name: '2ND 센추리', rarity: 'EPIC', hidden: false, desc: '올해 2ND 100건', auto: true },
  { key: 'second_day3', icon: '🛒', name: '장바구니 가득', rarity: 'RARE', hidden: false, desc: '하루 2ND 번들 3건', auto: true },
  { key: 'second_guinness', icon: '🐐', name: '미소 기네스 · 2ND', rarity: 'LEGEND', hidden: false, desc: '역대 월 2ND 최고기록', auto: true },
  { key: 'prod_base', icon: '⚙️', name: '시동 완료', rarity: 'COMMON', hidden: false, desc: '월 생산성 기준 달성', auto: true },
  { key: 'prod_100', icon: '📈', name: '생산성 100', rarity: 'RARE', hidden: false, desc: '월 생산성 100P', auto: true },
  { key: 'prod_120', icon: '⚡', name: '생산성 120', rarity: 'RARE', hidden: false, desc: '월 생산성 120P', auto: true },
  { key: 'prod_150', icon: '🔥', name: '생산성 150', rarity: 'EPIC', hidden: false, desc: '월 생산성 150P', auto: true },
  { key: 'prod_200', icon: '🚀', name: '생산성 200', rarity: 'LEGEND', hidden: false, desc: '월 생산성 200P', auto: true },
  { key: 'prod_rank1', icon: '👑', name: '생산성 KING', rarity: 'EPIC', hidden: false, desc: '월 생산성 전체 1위', auto: true },
  { key: 'prod_year1', icon: '🏆', name: '올해의 생산성 KING', rarity: 'LEGEND', hidden: false, desc: '연간 평균 생산성 1위', auto: true },
  { key: 'grade_s', icon: '💎', name: 'S CLASS', rarity: 'EPIC', hidden: false, desc: '성과등급 S 달성', auto: true },
  { key: 'grade_s3', icon: '🔥', name: 'S STREAK', rarity: 'LEGEND', hidden: false, desc: 'S등급 3개월 연속', auto: true },
  { key: 'all_top3', icon: '🐐', name: '완전체', rarity: 'LEGEND', hidden: false, desc: 'HS·홈·생산성 모두 월 TOP3', auto: true },
  { key: 'day_hs5', icon: '🔥', name: '불타는 하루', rarity: 'RARE', hidden: false, desc: '하루 HS 5건', auto: true },
  { key: 'day_hs8', icon: '💥', name: '미친 하루', rarity: 'EPIC', hidden: false, desc: '하루 HS 8건', auto: true },
  { key: 'day_hs10', icon: '☄️', name: '레코드 데이', rarity: 'LEGEND', hidden: false, desc: '하루 HS 10건', auto: true },
  { key: 'full_set', icon: '🛍', name: '풀세트', rarity: 'RARE', hidden: false, desc: '하루 HS+홈+2ND 모두 판매', auto: true },
  { key: 'allrounder', icon: '🎯', name: '올라운더', rarity: 'RARE', hidden: false, desc: '한 달 핵심 5개 카테고리 모두 실적', auto: true },
  { key: 'balance_master', icon: '🌈', name: '밸런스 마스터', rarity: 'EPIC', hidden: false, desc: '핵심 5개 카테고리 모두 월 목표 달성', auto: true },
  { key: 'sweep_day', icon: '🧹', name: '싹쓸이', rarity: 'EPIC', hidden: false, desc: '하루 5개 이상 판매 카테고리 실적', auto: true },
  { key: 'perfect_month', icon: '💎', name: '퍼펙트 먼스', rarity: 'LEGEND', hidden: false, desc: '해당 월 핵심 KPI 전부 목표 달성', auto: true },
  { key: 'grand_slam', icon: '👑', name: '그랜드슬램', rarity: 'LEGEND', hidden: false, desc: 'HS·홈·생산성 월간 1위 동시 달성', auto: true },
  { key: 'goat', icon: '🐐', name: 'GOAT', rarity: 'LEGEND', hidden: false, desc: '연간 HS·홈·생산성 모두 전체 TOP3', auto: true },
  { key: 'tenure3', icon: '🌱', name: '미소 새싹', rarity: 'COMMON', hidden: false, desc: '입사 3개월', auto: true },
  { key: 'tenure12', icon: '🎂', name: '첫 돌', rarity: 'COMMON', hidden: false, desc: '근속 12개월', auto: true },
  { key: 'tenure24', icon: '🌳', name: '뿌리내림', rarity: 'RARE', hidden: false, desc: '근속 24개월', auto: true },
  { key: 'tenure36', icon: '🌲', name: '뿌리 깊은 미소', rarity: 'EPIC', hidden: false, desc: '근속 36개월', auto: true },
  { key: 'tenure60', icon: '🏛', name: '미소 베테랑', rarity: 'LEGEND', hidden: false, desc: '근속 60개월', auto: true },
  { key: 'special_pick', icon: '📈', name: '성장왕', rarity: 'RARE', hidden: false, desc: '월 후반 HS 페이스가 전반보다 크게 상승', auto: true },
  { key: 'special_team', icon: '🎯', name: '올라운드 세일즈', rarity: 'EPIC', hidden: false, desc: 'HS·홈·프리·스홈·2ND를 모두 판매', auto: true },
  { key: 'special_mvp', icon: '🏆', name: '미소 MVP', rarity: 'LEGEND', hidden: false, desc: 'HS·홈·생산성 종합 순위 월 1위', auto: true }
];

const SPECIAL_BADGE_KEYS = [];

const ENCOURAGEMENT_MESSAGES = [
  '오늘의 한 걸음이 이번 달의 흐름을 바꿔요.', '잘하고 있어요. 속도보다 방향이 더 중요해요.',
  '작은 성과도 쌓이면 분명한 실력이 됩니다.', '지금의 꾸준함은 월말에 숫자로 보여요.',
  '어제보다 한 걸음이면 충분해요.', '조급해하지 않아도 괜찮아요. 당신의 페이스가 있어요.',
  '힘든 날에도 계속해온 것 자체가 능력이에요.', '오늘의 집중이 내일의 자신감을 만듭니다.',
  '한 번의 좋은 상담이 하루의 분위기를 바꿀 수 있어요.', '완벽하지 않아도 계속하면 반드시 나아가요.',
  '당신이 쌓은 경험은 사라지지 않아요.', '결과가 더딘 날에도 성장은 계속되고 있어요.',
  '기회는 준비된 오늘 속에서 시작돼요.', '할 수 있다는 믿음도 중요한 실력입니다.',
  '오늘도 충분히 잘해낼 준비가 되어 있어요.', '포기하지 않은 하루는 실패한 하루가 아니에요.',
  '작은 친절 하나가 좋은 고객을 남겨요.', '진심은 늦더라도 반드시 전해집니다.',
  '당신만의 강점은 비교할 수 없는 자산이에요.', '지금까지 온 길만 봐도 충분히 대단해요.',
  '조금 느려도 멈추지 않으면 결국 도착해요.', '어려운 순간은 실력이 자라는 순간이기도 해요.',
  '오늘의 도전이 내일의 익숙함이 됩니다.', '좋은 흐름은 한 건의 시작에서 만들어져요.',
  '스스로를 믿어준 만큼 더 멀리 갈 수 있어요.', '당신의 노력은 생각보다 많은 사람에게 힘이 돼요.',
  '실수는 멈추라는 신호가 아니라 배우라는 신호예요.', '한계를 정하지 않으면 가능성도 닫히지 않아요.',
  '오늘 할 수 있는 것부터 차분히 시작해봐요.', '지친 날에는 버티는 것도 훌륭한 전진이에요.',
  '좋은 결과는 좋은 태도에서 시작됩니다.', '당신의 성실함은 이미 강력한 경쟁력이에요.',
  '한 사람의 신뢰를 얻는 일이 가장 큰 성과일 수 있어요.', '평범한 하루를 꾸준히 보내는 사람이 결국 강해져요.',
  '지금 부족한 것은 앞으로 채울 수 있다는 뜻이에요.', '오늘의 경험은 다음 상담의 자신감이 됩니다.',
  '당신에게는 다시 흐름을 만들 힘이 있어요.', '비교보다 성장에 집중하면 마음도 실력도 단단해져요.',
  '해낸 일들을 잊지 마세요. 이미 많이 성장했어요.', '좋은 날은 기다리는 것이 아니라 조금씩 만드는 거예요.',
  '한 번 더 시도하는 용기가 차이를 만듭니다.', '당신의 가능성은 오늘의 숫자보다 훨씬 커요.',
  '쉬어가도 괜찮아요. 다시 시작할 힘을 모으는 중이에요.', '오늘도 누군가에게 좋은 기억을 남길 수 있어요.',
  '목표가 멀어 보여도 오늘의 한 건은 분명히 가까워진 거리예요.', '흔들려도 방향을 잃지 않으면 괜찮아요.',
  '스스로에게 건네는 응원이 가장 오래갑니다.', '당신이 가진 열정은 다시 불붙을 수 있어요.',
  '꾸준한 사람에게 결국 기회가 머뭅니다.', '오늘도 당신답게, 차분하고 힘있게 나아가요.'
];

function dailyEncouragement(userId=''){
  const day=new Date().toISOString().slice(0,10);
  const seed=`${day}-${userId}`.split('').reduce((sum,ch)=>sum+ch.charCodeAt(0),0);
  return ENCOURAGEMENT_MESSAGES[seed%ENCOURAGEMENT_MESSAGES.length];
}

function badgeDefOf(key) {
  return BADGE_DEFS.find((b) => b.key === key) || null;
}

function evaluateAutomaticBadges({
  dailyDays, month, personalGoals, mergedDraft, pay, competitionRows, userId,
}) {
  const earned=new Set();
  const hs=hsCount(mergedDraft);
  const home=Number(mergedDraft?.homeBase?.homeOnly||0)+Number(mergedDraft?.homeBase?.homeTv||0);
  const free=Number(mergedDraft?.homeFlat?.tvFree||0);
  const smart=Number(mergedDraft?.homeFlat?.smartHome||0);
  const upsell=Number(mergedDraft?.tailoredCount||0);
  const second=(mergedDraft?.matrix?.[7]||[]).reduce((a,v)=>a+Number(v||0),0)+Object.values(mergedDraft?.bundle2nd||{}).reduce((a,v)=>a+Number(v||0),0);
  const prod=Number(pay?.kpiScore||0);
  if(hs>0)earned.add('first_step');
  [[20,'hs_m20'],[30,'hs_m30'],[40,'hs_m40'],[50,'hs_m50'],[60,'hs_m60'],[70,'hs_m70'],[80,'hs_m8…85662 tokens truncated…판매'],['mnp','MNP 동시판매'],['usedMnp','중고 MNP 동시판매']].map(([k,l])=><button key={k} type="button" onClick={()=>{if(k==='usedMnp'&&homeNetworkType!=='household')return showAppToast('중고 MNP 동시판매는 가정망에서만 적용할 수 있어요.',{tone:'info'});setHomeMobileSimul(k)}} className={`py-2.5 px-3 rounded-xl border text-left text-xs font-semibold ${homeMobileSimul===k?'bg-violet-50 border-violet-300 text-violet-700':'bg-white border-gray-200 text-gray-500'}`}>{homeMobileSimul===k?'✓ ':''}{l}</button>)}
              </div>
              {homeMobileSimul==='usedMnp'&&<div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[10px] text-amber-700">✓ 중고 MNP 85군↑ 선약 동시판매 · 가정망에서만 적용</div>}
            </div>

            <label className="block text-xs font-semibold text-gray-500 mt-4 mb-1.5">
              5. 설치 예정일 <span className="text-gray-400 font-normal">(미정 가능)</span>
            </label>
            <input type="date" value={homePlannedDate} onChange={(e)=>setHomePlannedDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm" />

                        <div className="mt-4 rounded-xl border border-gray-100 p-3">
              <div className="text-xs font-semibold text-gray-700 mb-2">고객약속 / 유지사항 <span className="font-normal text-gray-400">· 직접 작성</span></div>
              <input value={homeCustomTitle} onChange={e=>setHomeCustomTitle(e.target.value)} placeholder="약속 내용을 직접 작성해주세요" className="w-full border rounded-lg px-3 py-2.5 text-xs bg-white" />
              <input type="date" value={homeCustomDueDate} onChange={e=>setHomeCustomDueDate(e.target.value)} className="mt-2 w-full border rounded-lg px-3 py-2.5 text-xs bg-white" />
              {homeExtraPromises.map((x,i)=><div key={i} className="mt-2 grid grid-cols-[1fr_auto] gap-2"><div><input value={x.title} onChange={e=>setHomeExtraPromises(a=>a.map((v,j)=>j===i?{...v,title:e.target.value}:v))} placeholder="추가 약속 내용" className="w-full border rounded-lg px-3 py-2 text-xs"/><input type="date" value={x.dueDate} onChange={e=>setHomeExtraPromises(a=>a.map((v,j)=>j===i?{...v,dueDate:e.target.value}:v))} className="mt-1 w-full border rounded-lg px-3 py-2 text-xs"/></div><button onClick={()=>setHomeExtraPromises(a=>a.filter((_,j)=>j!==i))} className="text-red-400 text-xs">삭제</button></div>)}
              <button type="button" onClick={()=>setHomeExtraPromises(a=>[...a,{title:'',dueDate:''}])} className="mt-2 text-xs font-semibold text-violet-600">+ 약속 추가</button>
            </div>

<div className="mt-4 grid grid-cols-2 gap-2">
              {month!==SEPTEMBER_POLICY_MONTH&&<button type="button" onClick={()=>{const el=document.getElementById('home-spot-options');if(el)el.classList.toggle('hidden')}} className={`py-2.5 rounded-xl border text-xs font-semibold ${homeSpotPolicyId||homeSpotDirectOpen?'bg-orange-50 border-orange-200 text-orange-700':'bg-gray-50 border-gray-100 text-gray-600'}`}>+ 스팟 정책</button>}
              <button type="button" onClick={()=>setHomeExpenseOpen(v=>!v)} className={`py-2.5 rounded-xl border text-xs font-semibold ${homeExpenseOpen?'bg-emerald-50 border-emerald-200 text-emerald-700':'bg-gray-50 border-gray-100 text-gray-600'}`}>+ 오퍼/영업비용</button>
            </div>
            {month!==SEPTEMBER_POLICY_MONTH&&<div id="home-spot-options" className="hidden mt-3 rounded-xl border border-orange-100 bg-orange-50/40 p-3">
              <div className="text-xs font-semibold text-gray-700 mb-2">🔥 홈 스팟 추가 인센티브</div>
              {homeSpotPolicies.map(p=><button key={p.id} type="button" onClick={()=>{setHomeSpotPolicyId(p.id);setHomeSpotDirectOpen(false)}} className={`w-full mb-1 text-left px-3 py-2 rounded-lg text-xs border ${homeSpotPolicyId===p.id?'bg-white border-orange-300 text-orange-700':'bg-white/70 border-transparent text-gray-600'}`}><b>{homeSpotPolicyId===p.id?'✓ ':''}{p.title}</b><span className="float-right">+{won(p.amount)}</span></button>)}
              <button type="button" onClick={()=>{setHomeSpotPolicyId('');setHomeSpotDirectOpen(v=>!v)}} className="w-full mt-1 px-3 py-2 rounded-lg text-left text-xs font-bold bg-orange-100/70 text-orange-700">+ 스팟 직접 입력</button>
              {homeSpotDirectOpen&&<div className="space-y-2 mt-2"><input value={homeSpotDirectTitle} onChange={e=>setHomeSpotDirectTitle(e.target.value)} placeholder="정책명" className="w-full border rounded-lg p-2 text-xs bg-white"/><input value={fmtInputNumber(homeSpotDirectAmount)} onChange={e=>setHomeSpotDirectAmount(e.target.value.replace(/\D/g,''))} placeholder="추가 금액" className="w-full border rounded-lg p-2 text-xs bg-white"/><input value={homeSpotDirectMemo} onChange={e=>setHomeSpotDirectMemo(e.target.value)} placeholder="메모 (선택)" className="w-full border rounded-lg p-2 text-xs bg-white"/></div>}
            </div>}
            {homeExpenseOpen&&<div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/30 p-3"><div className="text-xs font-semibold text-gray-700 mb-2">💳 오퍼/영업비용</div><div className="grid grid-cols-2 gap-2"><select value={homeExpenseCategory} onChange={e=>setHomeExpenseCategory(e.target.value)} className="border rounded-lg px-2 py-2 text-xs bg-white"><option>오퍼</option><option>케이스</option><option>판촉</option><option>기타</option></select><input inputMode="numeric" value={fmtInputNumber(homeExpenseAmount)} onChange={e=>setHomeExpenseAmount(e.target.value.replace(/\D/g,''))} placeholder="금액" className="border rounded-lg px-2 py-2 text-xs bg-white"/></div><input value={homeExpenseMemo} onChange={e=>setHomeExpenseMemo(e.target.value)} placeholder="메모 (선택)" className="mt-2 w-full border rounded-lg px-2 py-2 text-xs bg-white"/>{homeExtraExpenses.map((x,i)=><div key={i} className="mt-2 border-t pt-2"><div className="grid grid-cols-2 gap-2"><select value={x.category} onChange={e=>setHomeExtraExpenses(a=>a.map((v,j)=>j===i?{...v,category:e.target.value}:v))} className="border rounded px-2 py-2 text-xs"><option>오퍼</option><option>케이스</option><option>고객 사은품</option><option>판촉</option><option>기타</option></select><input value={fmtInputNumber(x.amount)} onChange={e=>setHomeExtraExpenses(a=>a.map((v,j)=>j===i?{...v,amount:e.target.value.replace(/\D/g,'')}:v))} placeholder="금액" className="border rounded px-2 py-2 text-xs"/></div><input value={x.memo} onChange={e=>setHomeExtraExpenses(a=>a.map((v,j)=>j===i?{...v,memo:e.target.value}:v))} placeholder="메모" className="mt-1 w-full border rounded px-2 py-2 text-xs"/><button type="button" onClick={()=>setHomeExtraExpenses(a=>a.filter((_,j)=>j!==i))} className="mt-1 text-[10px] text-red-400">이 비용 삭제</button></div>)}<button type="button" onClick={()=>setHomeExtraExpenses(a=>[...a,{category:'고객 사은품',amount:'',memo:''}])} className="mt-2 text-xs font-semibold text-emerald-700">+ 영업비용 추가</button></div>}

            <label className="mt-4 flex items-center gap-2 rounded-xl bg-gray-50 p-3 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={homeDirectComplete}
                onChange={(e) => {setHomeDirectComplete(e.target.checked);if(e.target.checked&&!homeActualCompleteDate)setHomeActualCompleteDate(`${month}-${selectedDay}`)}}
                className="w-4 h-4"
              />
              지금 바로 설치/개통 완료된 건
            </label>

            {homeDirectComplete&&<div className="mt-2 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
              <label className="block text-xs font-semibold text-emerald-800 mb-1.5">설치완료일 <span className="text-red-500">*</span></label>
              <input type="date" value={homeActualCompleteDate} onChange={e=>setHomeActualCompleteDate(e.target.value)} className="w-full border border-emerald-200 rounded-xl px-3 py-2.5 text-sm bg-white" />
            </div>}

            <div className="text-[11px] text-gray-400 mt-2">
              체크하지 않으면 진행중으로 등록되고, 홈 진행관리에서 완료 처리할 수 있어요.
            </div>

            <div className="sticky -bottom-5 mt-5 -mx-5 px-5 pt-3 pb-5 bg-white/95 backdrop-blur border-t border-gray-100 shadow-[0_-8px_20px_rgba(0,0,0,0.04)]">
            <div className="mb-2.5 rounded-xl bg-violet-50 border border-violet-100 px-3 py-2.5"><div className="text-[10px] font-bold text-violet-700">{homeNetworkType?homeNetworkLabel(homeNetworkType):'망 미선택'} · {homeDirectComplete?'설치완료':'설치대기'}</div><div className="text-[9px] text-violet-500 mt-1">{[homeInternet&&(homeMainTv?'인터넷+TV(주)':`인터넷 ${homeInternetSpeed?homeInternetSpeed.toUpperCase():''}`),homeSubTv&&(homeSubTvType==='free'?'TV프리(부)':'일반 부셋탑'),homeSmartHome&&'스마트홈',homeMobileSimul!=='none'&&({newChange:'신규/기변 동시판매',mnp:'MNP 동시판매',usedMnp:'중고 MNP 동시판매'}[homeMobileSimul])].filter(Boolean).join(' · ')||'판매 상품을 선택해주세요'}</div></div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setHomeOrderDraft(null);
                  setHomeCustomerName('');
                  setHomeNetworkType('');
                  setHomeDirectComplete(false);
                }}
                disabled={homeOrderSaving}
                className="py-2.5 rounded-xl bg-gray-100 text-gray-500 text-sm font-semibold"
              >
                취소
              </button>
              <button
                type="button"
                onClick={submitHomeOrder}
                disabled={homeOrderSaving || !homeCustomerName.trim() || !homeNetworkType || (!homeInternet&&!homeMainTv&&!homeSubTv&&!homeSmartHome)}
                className="py-2.5 rounded-xl bg-violet-600 text-white text-sm font-bold disabled:opacity-50"
              >
                {homeOrderSaving ? (homeOrderDraft?.editing?'수정 중...':'등록 중...') : (homeOrderDraft?.editing?'수정 저장':'등록')}
              </button>
            </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-30 w-[calc(100%-24px)] max-w-sm">
          <div className={`rounded-2xl shadow-xl border p-4 ${
            toast.kind === 'achievement'
              ? 'bg-violet-700 border-violet-600 text-white'
              : 'bg-gray-900 border-gray-800 text-white'
          }`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[11px] opacity-60 mb-1">등록 완료 · {toast.customerName?`${toast.customerName} · `:''}{toast.label}</div>
                <div className="text-base font-bold">{toast.title}</div>
                <div className="text-xs opacity-75 mt-0.5">{toast.sub}</div>
                <div className="text-[10px] opacity-70 mt-1">{toast.source==='mobile'?`성과P +${fmtNum(toast.pointDelta,1)}P · 전략P +${fmtNum(toast.strategicPointDelta,1)}P · 생산성 +${fmtNum(toast.productivityDelta,1)}P`:''}{toast.promiseCount>0?`${toast.source==='mobile'?' · ':''}고객 약속 ${toast.promiseCount}건 등록`:''}</div>

                <div className="mt-3 flex items-end justify-between gap-3">
                  <div>
                    {toast.payDelta > 0 && (
                      <>
                        <div className="text-sm font-bold text-emerald-300">이번 판매로 총 +{won(toast.payDelta)}</div>
                        {toast.source==='mobile'&&<div className="text-[10px] opacity-70 mt-1">
                          {[toast.salePayDelta>0&&`판매 인센티브 ${won(toast.salePayDelta)}`,toast.activityPayDelta>0&&`활동지원금 ${won(toast.activityPayDelta)}`,toast.bonusPayDelta>0&&`등급·추가보상 ${won(toast.bonusPayDelta)}`].filter(Boolean).join(' · ')}
                        </div>}
                      </>
                    )}
                    {toast.currentTotal!==undefined&&<div className="text-[11px] opacity-60 mt-0.5">현재 누적 예상 {won(toast.currentTotal)}</div>}
                  </div>

                  <div className="flex gap-1.5">
                    {toast.customerSaleId&&<button onClick={editToastSale} className="shrink-0 px-3 py-1.5 rounded-lg bg-white text-gray-900 text-xs font-bold">바로 수정</button>}
                    {toast.source!=='home'&&<button onClick={undoToast} className="shrink-0 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium">되돌리기</button>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {currentEmp?.id===authUser?.id&&<div className="mt-4 bg-white rounded-xl border border-red-100 overflow-hidden">
        <div className="p-4">
          <div className="text-[10px] font-bold text-red-500">실적 관리</div>
          <div className="text-sm font-bold text-gray-900 mt-1">당월 실적 초기화</div>
          <div className="text-[11px] text-gray-500 mt-1 leading-relaxed">
            잘못 입력된 실적을 월 단위로 초기화할 수 있어요. 실행 직전 데이터는 자동 백업됩니다.
          </div>
          <button type="button" disabled={locked}
            onClick={()=>{setResetMonthOpen(true);setResetPhrase('')}}
            className="mt-3 px-3 py-2 rounded-lg border border-red-200 text-red-600 text-xs font-bold disabled:opacity-40">
            {monthLabel(month)} 실적 초기화
          </button>
        </div>
      </div>}

      {resetMonthOpen&&<div className="fixed inset-0 z-[96] bg-black/45 flex items-end sm:items-center justify-center" onClick={()=>!resetBusy&&setResetMonthOpen(false)}>
        <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5" onClick={e=>e.stopPropagation()}>
          <div className="text-xs font-bold text-red-600">1차 확인</div>
          <div className="text-lg font-bold text-gray-900 mt-1">{monthLabel(month)} 실적을 초기화할까요?</div>
          <div className="text-xs text-gray-500 mt-2 leading-relaxed">
            이 작업은 해당 월의 실적 데이터를 지웁니다. 초기화 직전 데이터는 자동 백업됩니다.
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="text-xs font-semibold text-gray-700">2차 확인</div>
            <div className="text-[11px] text-gray-500 mt-1">아래에 <b>당월실적초기화</b>를 직접 입력해주세요.</div>
            <input value={resetPhrase} onChange={e=>setResetPhrase(e.target.value)} disabled={resetBusy}
              placeholder="당월실적초기화" className="w-full mt-2 border border-gray-200 rounded-xl px-3 py-3 text-sm"/>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            <button type="button" disabled={resetBusy} onClick={()=>setResetMonthOpen(false)} className="py-3 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold">취소</button>
            <button type="button" disabled={resetBusy||resetPhrase.trim()!=='당월실적초기화'} onClick={resetOwnMonthPerformance}
              className="py-3 rounded-xl bg-red-600 text-white text-sm font-bold disabled:opacity-35">
              {resetBusy?'초기화 중...':'실적 초기화 실행'}
            </button>
          </div>
        </div>
      </div>}

    </div>
  );
}

function DailySaveBadge({ state }) {
  if (state === 'error') return <span className="flex items-center gap-1 text-[11px] text-red-600"><AlertTriangle size={11} />자동저장 실패 · 연결 확인</span>;
  if (state === 'pending') return <span className="flex items-center gap-1 text-[11px] text-amber-600"><UploadCloud size={11} />저장 대기 중</span>;
  if (state === 'saved') return <span className="flex items-center gap-1 text-[11px] text-emerald-600"><Check size={11} />저장됨</span>;
  return null;
}


function ColHeader({ label }) {
  if (label.includes('·')) {
    const [a, b] = label.split('·');
    return (
      <span className="block leading-tight whitespace-nowrap">
        {a}
        <br />
        <span className="text-[9px] text-gray-300 font-normal">{b}</span>
      </span>
    );
  }
  return <span className="whitespace-nowrap">{label}</span>;
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


const PERSONAL_GOAL_DEFS = [
  { key: 'hs', label: 'HS', unit: '건', defaultTarget: 20 },
  { key: 'home', label: '홈 실적', unit: '건', defaultTarget: 5 },
  { key: 'tvFree', label: 'TV프리(부)', unit: '건', defaultTarget: 5 },
  { key: 'smartHome', label: '스마트홈', unit: '건', defaultTarget: 5 },
  { key: 'tailoredAmount', label: '맞춤제안 업셀 금액', unit: '원', defaultTarget: 1000000 },
  { key: 'tailored', label: '맞춤제안 업셀 건수', unit: '건', defaultTarget: 15 },
  { key: 'points', label: '성과등급P', unit: 'P', defaultTarget: 35 },
  { key: 'kpi', label: '생산성', unit: 'P', defaultTarget: 35 },
  { key: 'incentive', label: '인센티브', unit: '원', defaultTarget: 1500000 },
];

function getPersonalGoalActuals(mergedDraft, pay) {
  const matrix = mergedDraft?.matrix || [];

  // HS = 신규 + MNP + 기변A/B/C 합산
  const hs = [0, 1, 2, 3, 4].reduce((sum, ri) => {
    const row = matrix[ri] || [];
    return sum + row.reduce((s, v) => s + (Number(v) || 0), 0);
  }, 0);

  return {
    hs,
    home: Number((mergedDraft?.homeBase?.homeOnly || 0) + (mergedDraft?.homeBase?.homeTv || 0)),
    tvFree: Number(mergedDraft?.homeFlat?.tvFree || 0),
    smartHome: Number(mergedDraft?.homeFlat?.smartHome || 0),
    tailoredAmount: Number(mergedDraft?.tailoredAmount || 0),
    tailored: Number(mergedDraft?.tailoredCount || 0),
    points: Number(pay?.totalPoints || 0),
    kpi: Number(pay?.kpiScore || 0),
    incentive: Number(pay?.total || 0),
  };
}

function MonthlyGoalCard({ month, mergedDraft, pay, goals, onSave, saving }) {
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState(() => new Set(Object.keys(goals || {})));
  const [values, setValues] = useState(goals || {});

  useEffect(() => {
    setSelected(new Set(Object.keys(goals || {})));
    setValues(goals || {});
  }, [goals, month]);

  const actuals = useMemo(() => getPersonalGoalActuals(mergedDraft, pay), [mergedDraft, pay]);
  const hasGoals = Object.keys(goals || {}).length > 0;

  const toggle = (key) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        if (!(Number(values[key]) > 0)) {
          const def = PERSONAL_GOAL_DEFS.find((d) => d.key === key);
          setValues((v) => ({ ...v, [key]: def?.defaultTarget || 10 }));
        }
      }
      return next;
    });
  };

  const save = async () => {
    const payload = {};
    PERSONAL_GOAL_DEFS.forEach((def) => {
      if (!selected.has(def.key)) return;
      const n = Number(values[def.key]);
      if (Number.isFinite(n) && n > 0) payload[def.key] = n;
    });

    if (!Object.keys(payload).length) return;
    const ok = await onSave(payload);
    if (ok) setEditing(false);
  };

  if (!hasGoals || editing) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="text-xs font-semibold text-violet-600">
          나의 {parseInt(month.split('-')[1], 10)}월
        </div>
        <div className="text-sm font-bold text-gray-900 mt-1">이번 달 내 목표</div>
        <div className="text-[11px] text-gray-400 mt-1">
          원하는 실적 항목을 선택하고 이번 달 목표를 정해보세요.
        </div>

        <div className="mt-3 space-y-2">
          {PERSONAL_GOAL_DEFS.map((def) => {
            const checked = selected.has(def.key);
            return (
              <div key={def.key} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggle(def.key)}
                  className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${
                    checked
                      ? 'bg-violet-600 border-violet-600 text-white'
                      : 'bg-white border-gray-300 text-transparent'
                  }`}
                >
                  <Check size={13} />
                </button>

                <div className="w-20 text-sm text-gray-700">{def.label}</div>

                <input
                  type="number"
                  min="0"
                  step={def.unit === '원' ? '10000' : (def.unit === 'P' ? '0.1' : '1')}
                  disabled={!checked}
                  value={values[def.key] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [def.key]: e.target.value }))}
                  className="min-w-0 flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-200 disabled:bg-gray-50 disabled:text-gray-300"
                  placeholder="목표"
                />

                <div className="w-6 text-xs text-gray-400">{def.unit}</div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={save}
            disabled={saving || selected.size === 0}
            className="flex-1 px-3 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold disabled:opacity-50"
          >
            {saving ? '저장 중' : '목표 저장'}
          </button>

          {hasGoals && (
            <button
              onClick={() => setEditing(false)}
              className="px-4 py-2 rounded-lg bg-gray-100 text-gray-500 text-sm"
            >
              취소
            </button>
          )}
        </div>
      </div>
    );
  }

  const activeDefs = PERSONAL_GOAL_DEFS.filter((def) => Number(goals?.[def.key]) > 0);
  const completeCount = activeDefs.filter((def) => {
    const target = Number(goals[def.key]);
    const current = Number(actuals[def.key] || 0);
    return current >= target;
  }).length;

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-violet-600">
            나의 {parseInt(month.split('-')[1], 10)}월
          </div>
          <div className="text-sm font-bold text-gray-900 mt-1">이번 달 내 목표</div>
        </div>

        <button
          onClick={() => setEditing(true)}
          className="text-xs text-gray-400 hover:text-violet-600"
        >
          수정
        </button>
      </div>

      <div className="mt-4 space-y-4">
        {activeDefs.map((def) => {
          const target = Number(goals[def.key]);
          const current = Number(actuals[def.key] || 0);
          const pct = target > 0 ? Math.max(0, Math.min(100, (current / target) * 100)) : 0;
          const achieved = current >= target;

          const currentLabel = def.unit === '원'
            ? fmtNum(Math.round(current))
            : def.unit === 'P'
              ? current.toFixed(1)
              : Math.round(current).toString();

          const targetLabel = def.unit === '원'
            ? fmtNum(Math.round(target))
            : def.unit === 'P'
              ? target.toFixed(1)
              : Math.round(target).toString();

          return (
            <div key={def.key}>
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-gray-700">{def.label}</div>
                <div className={`text-sm font-bold ${achieved ? 'text-emerald-600' : 'text-gray-800'}`}>
                  {currentLabel} / {targetLabel}{def.unit}
                </div>
              </div>

              <div className="h-2 bg-gray-100 rounded-full overflow-hidden mt-2">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    achieved ? 'bg-emerald-500' : 'bg-violet-600'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              <div className="text-[11px] mt-1.5">
                {achieved ? (
                  <span className="font-semibold text-emerald-600">목표 달성! 🎉</span>
                ) : (
                  <span className="text-gray-400">{Math.round(pct)}% 진행 중</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {activeDefs.length > 1 && (
        <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500">
          이번 달 목표 {completeCount} / {activeDefs.length}개 달성
        </div>
      )}
    </div>
  );
}


function MyMonthlyPerformanceCard({ draft, pay, personalGoals, dailyDays, month, config, onSaveGoals, goalSaving }) {
  const [goalEditing,setGoalEditing]=useState(false);
  const [goalValues,setGoalValues]=useState(personalGoals||{});
  useEffect(()=>setGoalValues(personalGoals||{}),[personalGoals,month]);
  const simMnpTotal=(draft?.matrix?.[5]||[]).reduce((s,v)=>s+Number(v||0),0);
  const secondStandalone=(draft?.matrix?.[7]||[]).reduce((s,v)=>s+Number(v||0),0);
  const secondBundle=Object.values(draft?.bundle2nd||{}).reduce((s,v)=>s+Number(v||0),0);
  const metrics=[
    {key:'hs',goalKey:'hs',label:'HS',unit:'count',value:hsCount(draft)},
    {key:'simMnp',goalKey:'simMnp',label:'SIM MNP',unit:'count',value:simMnpTotal},
    {key:'second',goalKey:'second',label:'2ND',unit:'count',value:secondStandalone+secondBundle},
    {key:'productivity',goalKey:'kpi',label:'생산성',unit:'point',value:Number(pay?.kpiScore||0)},
    {key:'home',goalKey:'home',label:'홈',unit:'count',value:Number(draft?.homeBase?.homeOnly||0)+Number(draft?.homeBase?.homeTv||0)},
    {key:'tvFree',goalKey:'tvFree',label:'프리',unit:'count',value:Number(draft?.homeFlat?.tvFree||0)},
    {key:'smartHome',goalKey:'smartHome',label:'스홈',unit:'count',value:Number(draft?.homeFlat?.smartHome||0)},
    {key:'sono',goalKey:'sono',label:'소노',unit:'count',value:Object.values(draft?.sono||{}).reduce((s,v)=>s+Number(v||0),0)},
    {key:'tailoredAmount',goalKey:'tailoredAmount',label:'맞춤제안 매출액',unit:'won',value:Number(draft?.tailoredAmount||0)},
    {key:'tailoredCount',goalKey:'tailored',label:'업셀건',unit:'count',value:Number(draft?.tailoredCount||0)},
  ];
  const [detailMetric,setDetailMetric]=useState(null);

  const goalFor=(m)=>Number(personalGoals?.[m.goalKey]||0);

  const forecastFactor=useMemo(()=>{
    const now=new Date(), current=monthKeyOf(now)===month;
    if(!current)return 1;
    const total=daysInMonth(month),today=Math.min(now.getDate(),total);
    let elapsed=0,working=0;
    for(let day=1;day<=total;day++){
      const key=String(day).padStart(2,'0');
      if(normalizeDay(dailyDays?.[key]).dayOff)continue;
      working++;
      if(day<=today)elapsed++;
    }
    return elapsed>0?working/elapsed:1;
  },[dailyDays,month]);

  const forecastFor=(m)=>Number(m.value||0)*forecastFactor;
  const missingGoalCount=metrics.filter(m=>goalFor(m)<=0).length;

  const renderMetricValue=(m,value)=>{
    if(m.unit==='won') return won(Math.round(value));
    if(m.unit==='point') return `${fmtNum(Number(value||0),1)}P`;
    return `${fmtNum(Number(value||0),Number(value||0)%1?1:0)}건`;
  };

  const detailRows=useMemo(()=>{
    if(!detailMetric)return [];
    const out=[];
    const days=Object.entries(dailyDays||{}).sort(([a],[b])=>Number(a)-Number(b));
    const add=(day,label,value,unit='count',sub='')=>{
      const n=Number(value||0); if(!n)return;
      out.push({day,label,value:n,unit,sub});
    };
    days.forEach(([dd,raw])=>{
      const d=normalizeDay(raw);
      if(detailMetric.key==='hs'){
        [0,1,2,3,4].forEach(ri=>{
          (d.matrix?.[ri]||[]).forEach((cnt,ci)=>{
            if(!cnt)return;
            const rd=MATRIX_ROW_DEFS[ri];
            add(dd,rd?.dailyLabel||rd?.label||'모바일',cnt,'count',rd?.hasTiers?(MATRIX_COLS[ci]||''):'');
          });
        });
      } else if(detailMetric.key==='simMnp'){
        (d.matrix?.[5]||[]).forEach((cnt,ci)=>{ if(cnt)add(dd,'SIM MNP',cnt,'count',MATRIX_COLS[ci]||''); });
      } else if(detailMetric.key==='second'){
        const standalone=(d.matrix?.[7]||[]).reduce((a,v)=>a+Number(v||0),0); add(dd,'2ND단독',standalone);
        Object.entries(d.groups?.bundle2nd||{}).forEach(([k,cnt])=>{
          const item=(config?.bundle2nd||DEFAULT_BUNDLE2ND).find(x=>x.key===k); add(dd,item?.label||k,cnt);
        });
      } else if(detailMetric.key==='productivity'){
        const one=applyDailyToDraft(emptyDraft(),{[dd]:d},month,config?.categoryMap,config?.gibyeonColumnMap);
        (config?.kpiItems||DEFAULT_KPI_ITEMS).forEach(item=>{
          const cnt=Number(one.kpi?.[item.key]||0); if(cnt)add(dd,item.label,cnt*Number(item.point||0),'point',`${fmtCount(cnt)}건 × ${fmtNum(Number(item.point||0),1)}P`);
        });
      } else if(detailMetric.key==='home'){
        const hb=d.groups?.homeBase||{}; add(dd,'홈 단독',hb.homeOnly); add(dd,'홈+TV',hb.homeTv);
      } else if(detailMetric.key==='tvFree') add(dd,'TV프리(부)',d.groups?.homeFlat?.tvFree);
      else if(detailMetric.key==='smartHome') add(dd,'스마트홈',d.groups?.homeFlat?.smartHome);
      else if(detailMetric.key==='sono'){
        Object.entries(d.groups?.sono||{}).forEach(([k,cnt])=>{const item=(config?.sono||DEFAULT_SONO).find(x=>x.key===k);add(dd,item?.label||k,cnt);});
      } else if(detailMetric.key==='tailoredAmount') add(dd,'맞춤제안 매출액',d.tailoredAmount,'won');
      else if(detailMetric.key==='tailoredCount') add(dd,'맞춤제안 업셀',d.tailoredCount);
    });
    return out;
  },[detailMetric,dailyDays,month,config]);

  const detailTotal=detailRows.reduce((s,r)=>s+Number(r.value||0),0);
  const detailValue=(r)=>r.unit==='won'?won(r.value):r.unit==='point'?`${fmtNum(Number(r.value),1)}P`:`${fmtCount(r.value)}건`;

  return <>
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-50">
        <div className="flex items-start justify-between gap-2">
          <div><div className="text-xs text-gray-400">📊 {monthLabel(month)}</div><div className="text-sm font-bold text-gray-900 mt-0.5">이번 달 목표 현황</div></div>
          <button onClick={()=>setGoalEditing(v=>!v)} className="text-[10px] font-semibold text-violet-600">{goalEditing?'닫기':'목표 설정'}</button>
        </div>
        <div className="text-[10px] text-gray-400 mt-1">현재 누적 실적과 내 목표를 한 번에 확인해요. 숫자를 누르면 날짜별 내역이 열려요.</div>
        {missingGoalCount>0&&!goalEditing&&<button type="button" onClick={()=>setGoalEditing(true)} className="w-full mt-2 rounded-lg bg-red-50 px-2.5 py-2 text-left text-[9px] font-semibold text-red-600">목표 미설정 {missingGoalCount}개 · 입력하면 진척도와 예상 마감을 비교할 수 있어요 ›</button>}
        {goalEditing&&<div className="mt-3 p-3 bg-gray-50 rounded-xl space-y-2">
          {metrics.map(m=><div key={m.key} className="flex items-center gap-2"><span className="text-[10px] text-gray-500 w-24 truncate">{m.label}</span><input type="number" value={goalValues[m.goalKey]??''} onChange={e=>setGoalValues(v=>({...v,[m.goalKey]:e.target.value}))} placeholder="미설정" className="min-w-0 flex-1 px-2 py-1.5 rounded-lg border border-gray-200 text-xs"/><span className="text-[9px] text-gray-400">{m.unit==='won'?'원':m.unit==='point'?'P':'건'}</span></div>)}
          <button disabled={goalSaving} onClick={async()=>{const ok=await onSaveGoals?.(goalValues);if(ok)setGoalEditing(false)}} className="w-full mt-1 py-2 rounded-lg bg-violet-600 text-white text-xs font-bold disabled:opacity-50">{goalSaving?'저장 중':'목표 저장'}</button>
        </div>}
      </div>
      <div className="px-3 py-2">
        <div className="grid grid-cols-[minmax(72px,1.25fr)_minmax(58px,1fr)_minmax(55px,.9fr)_minmax(48px,.8fr)_minmax(66px,1fr)] gap-1 px-2 pb-2 text-[9px] text-gray-400 text-right">
          <span className="text-left">항목</span><span>목표</span><span>실적</span><span>진척도</span><span>예상 마감</span>
        </div>
        <div className="divide-y divide-gray-100">
          {metrics.map(m=>{
            const goal=goalFor(m), forecast=forecastFor(m);
            const pct=goal>0?Math.min(999,Math.round(Number(m.value||0)/goal*100)):null;
            const forecastHit=goal>0&&forecast>=goal;
            return <div key={m.key} className="grid grid-cols-[minmax(72px,1.25fr)_minmax(58px,1fr)_minmax(55px,.9fr)_minmax(48px,.8fr)_minmax(66px,1fr)] gap-1 items-center px-2 py-2.5 text-right text-[10px]">
              <button type="button" onClick={()=>setDetailMetric(m)} className="text-left font-semibold text-gray-700 truncate">{m.label}</button>
              {goal>0?<span className="text-gray-500 whitespace-nowrap">{renderMetricValue(m,goal)}</span>:<button type="button" onClick={()=>setGoalEditing(true)} className="justify-self-end rounded-md bg-red-50 px-1.5 py-1 text-[8px] font-bold leading-tight text-red-600">입력 필요</button>}
              <button type="button" onClick={()=>setDetailMetric(m)} className="font-bold text-gray-900 whitespace-nowrap">{renderMetricValue(m,m.value)}</button>
              <span className={`font-bold ${pct===null?'text-gray-300':pct>=100?'text-emerald-600':pct>=80?'text-amber-600':'text-gray-500'}`}>{pct===null?'—':`${pct}%`}</span>
              <span className={`font-bold whitespace-nowrap ${goal>0?(forecastHit?'text-emerald-600':'text-red-500'):'text-violet-600'}`}>{renderMetricValue(m,forecast)}</span>
            </div>
          })}
        </div>
      </div>
    </div>
    {detailMetric&&<div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4" onClick={()=>setDetailMetric(null)}>
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl max-h-[82vh] overflow-hidden" onClick={e=>e.stopPropagation()}>
        <div className="px-5 py-4 border-b flex justify-between gap-3 items-start">
          <div><div className="text-xs font-semibold text-violet-600">{monthLabel(month)} 실적 상세</div><div className="text-lg font-bold text-gray-900 mt-0.5">{detailMetric.label} · {renderValue(detailMetric)}</div></div>
          <button onClick={()=>setDetailMetric(null)} className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 text-lg">×</button>
        </div>
        <div className="overflow-y-auto max-h-[62vh] divide-y divide-gray-50">
          {detailRows.length===0?<div className="py-12 text-center text-sm text-gray-400">반영된 상세 내역이 없어요.</div>:detailRows.map((r,i)=><div key={`${r.day}-${r.label}-${i}`} className="px-5 py-3 flex justify-between gap-3">
            <div className="min-w-0"><div className="text-sm font-semibold text-gray-800">{parseInt(r.day,10)}일 · {r.label}</div>{r.sub&&<div className="text-[11px] text-gray-400 mt-0.5">{r.sub}</div>}</div>
            <div className="text-sm font-bold text-violet-700 shrink-0">{detailValue(r)}</div>
          </div>)}
        </div>
        <div className="px-5 py-4 border-t bg-gray-50 flex justify-between items-center">
          <span className="text-xs text-gray-500">상세 합계</span>
          <span className="font-bold text-gray-900">{detailMetric.unit==='won'?won(detailTotal):detailMetric.unit==='point'?`${fmtNum(detailTotal,1)}P`:`${fmtCount(detailTotal)}건`}</span>
        </div>
      </div>
    </div>}
  </>;
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
      className="w-full text-left bg-white rounded-xl border border-violet-200 p-4 hover:border-violet-300 transition"
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
          <Target size={18} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-violet-600 mb-1">추천 다음 행동</div>
          <div className="text-sm font-bold text-gray-900">{goal.title}</div>
          <div className="text-sm text-gray-600 mt-0.5">{goal.description}</div>
          <div className="text-[11px] text-violet-500 mt-1">{goal.recommendation}</div>

          <div className="mt-3 flex items-baseline gap-1.5 flex-wrap">
            <span className="text-xs text-gray-400">달성 시 예상 인센티브</span>
            <span className="text-lg font-bold text-violet-700">+{won(goal.delta)}</span>
          </div>
        </div>

        <ChevronRight size={17} className="text-violet-300 shrink-0 mt-1" />
      </div>
    </button>
  );
}

function GrowthBadge({ current, prev }) {
  if (!prev || prev <= 0) return null;
  const diff = current - prev;
  const pct = Math.round((diff / prev) * 100);
  if (diff === 0) return <span className="text-xs text-violet-100">전월과 동일</span>;
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
          <div className={`text-lg font-bold ${pay.gradeEligible && currentBonus > 0 ? 'text-violet-700' : 'text-gray-400'}`}>
            {pay.gradeEligible ? pay.grade : 'D'}
            <span className="text-xs font-medium ml-1 text-gray-500">{won(currentBonus)}</span>
          </div>
        </div>
      </div>

      <div className="relative h-2.5 rounded-full bg-gray-100 overflow-visible">
        <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-500"
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
            <Target size={14} className="text-violet-500 shrink-0" />
            <span className="text-gray-600">
              <b className="text-violet-700">{next.grade}등급</b>까지 <b className="text-gray-900 tabular-nums">{remain.toFixed(1)}P</b>
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
    <div className={`flex items-center justify-between px-4 py-2.5 text-sm ${bold ? 'bg-violet-50' : ''}`}>
      <span className={bold ? 'text-violet-700 font-semibold' : 'text-gray-600'}>{label}</span>
      <span className={bold ? 'text-violet-800 font-bold' : 'text-gray-800 font-medium'}>{value}</span>
    </div>
  );
}


function RankingCenter({ rows, dailyRecords, month, config }) {
  const [metricKey, setMetricKey] = useState('hs');
  const [mode, setMode] = useState('employees'); // employees | stores
  const [storeMode, setStoreMode] = useState('total'); // total | avg
  const [periodMode, setPeriodMode] = useState('month'); // month | recent7
  const metric = COMPETITION_METRICS.find((m) => m.key === metricKey) || COMPETITION_METRICS[0];

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
        value: storeMode === 'avg' ? (s.count ? s.total / s.count : 0) : s.total,
      }))
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
  }, [rows, recentEmployeeRanked, metricKey, storeMode, periodMode]);

  return (
    <div className="space-y-3">
      <div className="bg-white border border-gray-100 rounded-xl p-3">
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setMode('employees')} className={`px-3 py-1.5 rounded-md text-xs font-semibold ${mode === 'employees' ? 'bg-white shadow text-violet-700' : 'text-gray-500'}`}>직원 순위</button>
            <button onClick={() => setMode('stores')} className={`px-3 py-1.5 rounded-md text-xs font-semibold ${mode === 'stores' ? 'bg-white shadow text-violet-700' : 'text-gray-500'}`}>매장 순위</button>
          </div>
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setPeriodMode('month')} className={`px-2.5 py-1.5 rounded-md text-[11px] font-semibold ${periodMode === 'month' ? 'bg-white shadow text-violet-700' : 'text-gray-500'}`}>월 누적</button>
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
              <button onClick={() => setStoreMode('total')} className={`px-2.5 py-1 rounded-md text-[11px] ${storeMode === 'total' ? 'bg-white shadow text-violet-700' : 'text-gray-500'}`}>총 실적</button>
              <button onClick={() => setStoreMode('avg')} className={`px-2.5 py-1 rounded-md text-[11px] ${storeMode === 'avg' ? 'bg-white shadow text-violet-700' : 'text-gray-500'}`}>1인당</button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-50 text-sm font-semibold text-gray-700">
          {periodMode === 'recent7' ? '최근 7일 · ' : ''}{metric.label} {mode === 'employees' ? '직원 순위' : '매장 순위'}
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
                <div className="text-sm font-bold text-violet-700 shrink-0">
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
      return {...g,productTypes:unique,duplicateCount:g.rows.length-unique.length};
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
        <div className="text-xs text-gray-400">상품 여러 개도 고객 1건으로 묶어 보여줘요.</div></div><button onClick={load} className="text-xs font-bold text-violet-600">↻ 새로고침</button></div>
        <div className="flex gap-1.5 mt-3">{[['pending','진행중'],['completed','설치완료'],['cancelled','취소']].map(([k,l])=><button key={k} onClick={()=>setStatusFilter(k)} className={`px-3 py-1.5 rounded-full text-[11px] font-bold ${statusFilter===k?'bg-violet-600 text-white':'bg-gray-100 text-gray-500'}`}>{l} {grouped.filter(x=>x.status===k).length}</button>)}</div>
        {lastLoadedAt&&<div className="text-[9px] text-gray-300 mt-2">마지막 갱신 {lastLoadedAt.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</div>}</div>
      {visible.length===0?<div className="py-10 text-center text-sm text-gray-400">해당 홈 청약이 없어요.</div>:
        <div className="divide-y">{[...visible].sort((a,b)=>String(a.planned_install_date||'9999').localeCompare(String(b.planned_install_date||'9999'))).map(o=>{
          const emp=empMap[o.user_id], p=o.planned_install_date?String(o.planned_install_date).slice(0,10):null;
          const over=o.status==='pending'&&p&&p<today, isToday=p===today;
          const products=o.productTypes.map(k=>HOME_ORDER_PRODUCTS.find(x=>x.key===k)?.label||k);
          return <div key={o.key} className="px-4 py-3">
            <div className="flex justify-between gap-3"><div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <div className="text-sm font-bold">{o.customer_name||'고객명 미입력'}</div>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                  o.network_type==='soho'?'bg-blue-50 text-blue-600':
                  o.network_type==='household'?'bg-violet-50 text-violet-600':'bg-gray-100 text-gray-400'
                }`}>{homeNetworkLabel(o.network_type)}</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">{emp?.name||'직원'} · {emp?.branch||''}</div></div>
              <span className={`text-[10px] font-bold px-2 py-1 rounded-full h-fit ${over?'bg-red-50 text-red-600':isToday?'bg-orange-50 text-orange-600':'bg-violet-50 text-violet-600'}`}>
                {o.status==='completed'?'설치완료':o.status==='cancelled'?'취소':over?'확인 필요':isToday?'오늘 설치':p?'설치 예정':'일정 미정'}</span></div>
            <div className="flex flex-wrap gap-1 mt-2">{products.map(x=><span key={x} className="px-2 py-1 rounded-md bg-gray-50 text-[10px] text-gray-600">{x}</span>)}{o.duplicateCount>0&&<span className="px-2 py-1 rounded-md bg-red-50 text-[10px] font-bold text-red-600">중복 저장 의심 +{o.duplicateCount}</span>}</div>
            <div className="text-[11px] text-gray-400 mt-2">접수 {o.source_work_date||String(o.applied_at).slice(0,10)} · 설치예정 {p||'미정'}</div>
          </div>})}</div>}
    </div>
  </div>;
}


function adminMetricValue(row,key){
  const d=row?.draft||{};
  if(key==='hs')return hsCount(d);
  if(key==='simMnp')return Object.values(d.mnpBundle||{}).reduce((s,v)=>s+Number(v||0),0);
  if(key==='second')return Object.values(d.bundle2nd||{}).reduce((s,v)=>s+Number(v||0),0);
  if(key==='home')return Number(d.homeBase?.homeOnly||0)+Number(d.homeBase?.homeTv||0);
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

function storeGoalAchievement(company,storeRows){
  const metrics=[
    ['hs','hs'],['home','home'],['productivity','productivity'],
    ['tvFree','free'],['smartHome','smart'],['tailoredCount','upsell']
  ];
  const detail=metrics.map(([goalKey,rowKey])=>{
    const target=Number(company?.[goalKey]||0);
    const actual=storeMetricFromRows(storeRows,rowKey);
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
    const achievement=storeGoalAchievement(company,branchRows);
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
        <div className="text-sm font-bold text-gray-900">회사 기준 대비 종합 달성</div>
        <div className="text-[10px] text-gray-400 mt-0.5">HS · 홈 · 생산성 · 프리 · 스마트홈 · 업셀 기준</div>
      </div>
      <button onClick={onOpenGoals} className="text-xs font-semibold text-violet-600">목표 보기 ›</button>
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
                <div className="text-[10px] text-gray-400">회사기준 {x.achieved}/{x.total} 달성</div>
              </div>
            </div>
            <div className="text-sm font-bold text-amber-700">{x.score.toFixed(1)}점</div>
          </div>
        ))}
      </div>
      {myIndex>=3&&<div className="px-4 py-3 bg-violet-50 flex justify-between text-xs text-violet-700">
        <b>우리 매장 {myIndex+1}위</b>
        <span>{ranked[myIndex].score.toFixed(1)}점 · {ranked[myIndex].achieved}/{ranked[myIndex].total} 달성</span>
      </div>}
    </>}
  </div>;
}

function StoreGoalDashboardCard({ rows, employees, authUserId, month, onOpen }) {
  const [goal,setGoal]=useState(null);
  const me=(employees||[]).find(e=>e.id===authUserId);
  const branch=me?.branch || rows?.[0]?.branch;

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
  const companyAch=storeGoalAchievement(goal.company_goals,rows);
  const challengeBase={...goal.company_goals,...goal.challenge_goals};
  const challengeAch=storeGoalAchievement(challengeBase,rows);

  return <button onClick={onOpen} className="w-full text-left bg-white rounded-xl border border-gray-100 p-4">
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-xs text-gray-400">🎯 매장 목표 달성</div>
        <div className="text-sm font-bold text-gray-900 mt-1">
          회사 기준 <span className="text-violet-700">{companyAch.achieved}/{companyAch.total}</span> 달성
        </div>
        <div className="text-xs text-gray-500 mt-1">
          도전 목표 {challengeAch.achieved}/{challengeAch.total} 달성 · 종합 {companyAch.score.toFixed(1)}점
        </div>
      </div>
      <span className="text-xs font-semibold text-violet-600">상세 ›</span>
    </div>
  </button>;
}

function AdminCustomerCareOverview({ employees, month, initialFilter='todo', compact=false, onOpen }) {
  const [tasks,setTasks]=useState([]),[customers,setCustomers]=useState([]),[loading,setLoading]=useState(true),[loadError,setLoadError]=useState('');
  const [filter,setFilter]=useState(initialFilter),[category,setCategory]=useState('all'),[branch,setBranch]=useState('all'),[employeeId,setEmployeeId]=useState('all'),[query,setQuery]=useState('');
  const employeeMap=Object.fromEntries((employees||[]).map(e=>[e.id,e]));
  const employeeIds=(employees||[]).map(e=>e.id).filter(Boolean);
  const employeeKey=employeeIds.join('|');
  const load=useCallback(async()=>{
    if(!employeeIds.length){setTasks([]);setCustomers([]);setLoading(false);return;}
    setLoading(true);
    setLoadError('');
    const [{data:t,error:taskError},{data:c,error:customerError}]=await Promise.all([
      supabase.from('customer_tasks').select('*').in('user_id',employeeIds).order('due_date',{ascending:true}),
      supabase.from('customers').select('id,user_id,customer_name').in('user_id',employeeIds)
    ]);
    if(taskError||customerError)setLoadError(friendlyError(taskError||customerError));
    setTasks(t||[]);setCustomers(c||[]);setLoading(false);
  },[employeeKey]); // eslint-disable-line
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
  const categoryTone={'제휴카드':'bg-blue-50 text-blue-700','수납지원':'bg-violet-50 text-violet-700','변경':'bg-amber-50 text-amber-700','케이스 및 기타':'bg-gray-100 text-gray-600'};
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

  if(loading)return <div className="bg-white rounded-xl border p-4 text-xs text-gray-400">고객 약속 현황 불러오는 중...</div>;
  if(loadError)return <div className="bg-white rounded-xl border border-red-100 p-4"><div className="text-sm font-bold text-red-500">고객 약속을 불러오지 못했어요.</div><div className="text-xs text-red-400 mt-1">{loadError}</div></div>;
  return <div className="space-y-3">
    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
      {[['오늘',todayTasks.length],['7일 내',next7.length],['기한초과',overdue.length],['기한 내 완료',`${rate}%`],['고객 거절',selectedMonthTasks.filter(t=>t.status==='cancelled').length]].map(([l,v])=>
        <div key={l} className="bg-white rounded-xl border border-gray-100 p-3 text-center"><div className={`text-lg font-bold ${l==='기한초과'&&Number(v)>0?'text-red-600':'text-gray-900'}`}>{v}</div><div className="text-[10px] text-gray-400">{l}</div></div>)}
    </div>
    {compact?<button onClick={onOpen} className="w-full bg-white rounded-xl border border-gray-100 p-4 flex justify-between text-left"><div><div className="text-sm font-bold">고객 약속 관리</div><div className="text-xs text-gray-400 mt-1">직원별 진행단계와 기한초과 내역을 확인해요.</div></div><span className="text-xs font-semibold text-violet-600">상세 ›</span></button>:<>
    <div className="bg-white rounded-xl border border-gray-100 p-3 space-y-2">
      <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="직원명·고객명·약속·카드사 검색" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"/>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <select value={branch} onChange={e=>{setBranch(e.target.value);setEmployeeId('all')}} className="border rounded-lg px-2.5 py-2 text-xs"><option value="all">전체 매장</option>{stores.map(x=><option key={x} value={x}>{displayStoreName(x)}</option>)}</select>
        <select value={employeeId} onChange={e=>setEmployeeId(e.target.value)} className="border rounded-lg px-2.5 py-2 text-xs"><option value="all">전체 직원</option>{(employees||[]).filter(e=>branch==='all'||e.branch===branch).map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select>
        <select value={category} onChange={e=>setCategory(e.target.value)} className="border rounded-lg px-2.5 py-2 text-xs"><option value="all">전체 카테고리</option>{['제휴카드','수납지원','변경','케이스 및 기타'].map(x=><option key={x} value={x}>{x}</option>)}</select>
        <button onClick={()=>{setQuery('');setBranch('all');setEmployeeId('all');setCategory('all');setFilter('todo')}} className="rounded-lg bg-gray-50 text-gray-500 text-xs font-semibold">필터 초기화</button>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1">{[['todo','할 일'],['today','오늘'],['overdue','경과'],['upcoming','전체 예정'],['done','완료'],['cancelled','고객 거절']].map(([key,label])=><button key={key} onClick={()=>setFilter(key)} className={`py-2 rounded-lg text-[10px] font-semibold ${filter===key?'bg-violet-600 text-white':'bg-gray-50 text-gray-500'}`}>{label}</button>)}</div>
      <div className="text-[10px] text-gray-400">완료·고객 거절은 {monthLabel(selectedMonth)} 기준이며, 진행 중 약속은 월과 관계없이 놓치지 않도록 표시해요.</div>
    </div>
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 border-b flex justify-between gap-3"><div><div className="text-sm font-bold">고객 약속 상세</div><div className="text-xs text-gray-400">관리 범위의 직원과 고객 진행상태를 함께 확인해요.</div></div><div className="text-xs font-bold text-violet-600">{displayRows.length}건</div></div>
      <div className="divide-y">
        {displayRows.map(({task:t,tasks:groupTasks,payment})=>{
          const emp=employeeMap[t.user_id], customer=customerMap[t.customer_id];
          const taskCategory=careTaskCategory(t),completedCount=groupTasks.filter(x=>x.status==='completed').length;
          const statusLabel=t.status==='completed'?'완료':t.status==='cancelled'?'고객 거절':t.due_date<today?`${Math.round((new Date(`${today}T00:00:00`)-new Date(`${t.due_date}T00:00:00`))/86400000)}일 초과`:t.due_date===today?'오늘':`D-${Math.round((new Date(`${t.due_date}T00:00:00`)-new Date(`${today}T00:00:00`))/86400000)}`;
          return <div key={payment?`${t.user_id}-${t.customer_id}-${t.source_sale_id||t.base_date}`:t.id} className="px-4 py-3 text-xs"><div className="flex justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap"><span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${categoryTone[taskCategory]}`}>{taskCategory}</span><b className="text-gray-800">{emp?.name||'직원'} · {customer?.customer_name||'고객'}</b></div>
              <div className="text-[10px] text-gray-400 mt-1">{displayStoreName(emp?.branch)}</div>
              <div className="text-gray-600 mt-1">{payment?`${groupTasks.length}개월 요금 수납지원 · ${completedCount}/${groupTasks.length}회 완료`:t.title}</div>
              {payment&&<div className="text-violet-700 mt-1">다음 수납 · {t.due_date}</div>}
              {t.task_type==='affiliateCard'&&<div className="text-blue-700 mt-1 leading-relaxed">{cardProgress(t)}</div>}
              {t.target_plan&&<div className="text-violet-700 mt-1">변경 예정 · {t.target_plan}</div>}
              {t.note&&!payment&&<div className="text-gray-400 mt-1">{t.note}</div>}
            </div>
            <div className="shrink-0 text-right"><div className={`font-semibold ${t.status==='cancelled'?'text-gray-500':t.status==='completed'?'text-emerald-600':t.due_date<today?'text-red-500':t.due_date===today?'text-orange-500':'text-violet-600'}`}>{statusLabel}</div><div className="text-[10px] text-gray-400 mt-1">{t.due_date}</div></div>
          </div></div>
        })}
        {displayRows.length===0&&<div className="py-8 text-center text-xs text-gray-400">조건에 해당하는 고객 약속이 없어요.</div>}
      </div>
    </div>
    </>}
  </div>;
}

function AdminManagementAlerts({ pendingCount, employees, onGo, month, rows, dailyRecords, isFullAdmin, config }) {
  const [counts,setCounts]=useState({customer:0,home:0,spot:0,profile:0,settlement:0,hqDiff:0});
  useEffect(()=>{
    (async()=>{
      const today=new Date().toISOString().slice(0,10);
      const ids=(employees||[]).map(e=>e.id);
      if(!ids.length)return;
      const [{data:t},{data:h},{data:s},{data:p},{data:sr},{data:hq}]=await Promise.all([
        supabase.from('customer_tasks').select('id').in('user_id',ids).eq('status','pending').lt('due_date',today),
        supabase.from('home_orders').select('id').in('user_id',ids).eq('status','pending').lt('planned_install_date',today),
        supabase.from('spot_claims').select('id').in('user_id',ids).eq('status','pending'),
        supabase.from('profile_edit_requests').select('id').in('user_id',ids).eq('status','pending'),
        supabase.from('settlement_reviews').select('user_id,status').eq('month',month).in('user_id',ids),
        supabase.from('head_office_performance').select('user_id,metrics').eq('month',month).in('user_id',ids)
      ]);
      const reviewed=new Set((sr||[]).filter(x=>x.status==='checked'||x.status==='final').map(x=>x.user_id));
      const rowMap=Object.fromEntries((rows||[]).map(x=>[x.id,x]));
      const hqDiff=(hq||[]).filter(x=>{const r=rowMap[x.user_id],m=x.metrics||{};return r&&(Number(headOfficeScores(normalizeHeadOfficeMetrics(m),config,month)?.hs||0)!==Number(hsCount(r.draft)||0))}).length;
      setCounts({customer:(t||[]).length,home:(h||[]).length,spot:(s||[]).length,profile:(p||[]).length,settlement:Math.max(0,ids.length-reviewed.size),hqDiff});
    })();
  },[employees,month,rows,config]);
  const now=new Date(),todayKey=String(now.getDate()).padStart(2,'0');
  const missing=monthKeyOf(now)===month?(employees||[]).filter(e=>{const d=normalizeDay(dailyRecords?.[e.id]?.[todayKey]);return !d.dayOff&&!dayHasData(d)}).length:0;
  const total=Object.values(counts).reduce((a,v)=>a+Number(v||0),0)+missing+Number(pendingCount||0);
  return <div className="bg-white rounded-xl border border-violet-100 p-3">
    <div className="flex justify-between items-center"><div><div className="text-xs text-violet-500">🔔 관리 알림</div><div className="text-sm font-bold text-gray-900 mt-0.5">{total?`${fmtCount(total)}건 확인 필요`:'확인할 관리 알림이 없어요'}</div></div></div>
    {total>0&&<div className="grid grid-cols-2 gap-2 mt-3 text-xs">
      <button onClick={()=>onGo('performanceApproval')} className="bg-violet-50 text-violet-700 rounded-lg p-2 text-left">오늘 입력 누락 <b className="float-right">{missing}</b></button>
      <button onClick={()=>onGo('customerCareAdmin')} className="bg-red-50 text-red-600 rounded-lg p-2 text-left">고객약속 경과 <b className="float-right">{counts.customer}</b></button>
      <button onClick={()=>onGo('homeCare')} className="bg-orange-50 text-orange-600 rounded-lg p-2 text-left">홈 설치 확인 <b className="float-right">{counts.home}</b></button>
      <button onClick={()=>onGo('spot')} className="bg-orange-50 text-orange-600 rounded-lg p-2 text-left">스팟 승인 <b className="float-right">{counts.spot}</b></button>
      <button onClick={()=>onGo('performanceApproval')} className="bg-violet-50 text-violet-700 rounded-lg p-2 text-left">실적 승인 대기 <b className="float-right">{pendingCount}</b></button>
      {isFullAdmin&&<button onClick={()=>onGo('headOfficeData')} className="bg-blue-50 text-blue-700 rounded-lg p-2 text-left">본사 데이터 차이 <b className="float-right">{counts.hqDiff}</b></button>}
      {isFullAdmin&&<button onClick={()=>onGo('settlement')} className="bg-emerald-50 text-emerald-700 rounded-lg p-2 text-left">정산 미검토 <b className="float-right">{counts.settlement}</b></button>}
      <button onClick={()=>onGo('employees')} className="bg-gray-50 text-gray-700 rounded-lg p-2 text-left">프로필 수정 요청 <b className="float-right">{counts.profile}</b></button>
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
        supabase.from('sales_expenses').select('user_id,amount').in('user_id',ids).gte('expense_date',`${month}-01`).lt('expense_date',to),
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
        supabase.from('sales_expenses').select('id,expense_date,customer_name,category,amount,memo').eq('user_id',r.id).gte('expense_date',`${month}-01`).lt('expense_date',to).order('expense_date'),
        supabase.from('home_orders').select('id,customer_id,customer_name,product_type,network_type,sale_type,source_group,source_key,status,source_work_date,actual_install_date').eq('user_id',r.id).gte('source_work_date',`${month}-01`).lt('source_work_date',to)
      ]);
      const err=salesRes.error||spotsRes.error||expensesRes.error||homeRes.error;if(err)throw err;
      const homeMap=Object.fromEntries((homeRes.data||[]).map(o=>[String(o.id),o]));
      const detailHomePolicy=calculateHomePolicyEngine(homeRes.data||[],config);
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
          Object.entries(meta.bundleVasMap||{}).forEach(([bk,keys])=>(keys||[]).forEach(k=>{if(k==='vasNone')return;const it=(config.vas||[]).find(v=>v.key===k);if(Number(it?.rate||0))ledger.push({date:x.sale_date,customer,type:x.metric_label||'모바일',item:'VAS 유치 수수료',amount:Number(it.rate),note:`2ND · ${it.label||k}${(meta.bundleSaleTypeMap?.[bk]||'normal')==='free'?' · 무료판매 제외대상':''}`});}));
          if(meta.usedMnpBundle){const it=(config.mnpBundle||[]).find(v=>v.key==='usedMnpBundle');if(Number(it?.rate||0))ledger.push({date:x.sale_date,customer,type:x.metric_label||'모바일',item:'중고 MNP 결합 수수료',amount:Number(it.rate),note:it.label||'중고MNP 결합'});}
          const sp=meta.specialPolicy||{};
          if(sp.policyId){
            const repl=Number(sp.exceptionStatus==='approved'?sp.exceptionApprovedAmount:sp.replacementAmount||0);
            if(matrixRate)ledger.push({date:x.sale_date,customer,type:x.metric_label||'모바일',item:'특판 요금제 수수료 제외',amount:-matrixRate,note:sp.policyTitle||'특판·지인판매'});
            const vasFee=Number(sp.normalVasFee||0);if(vasFee)ledger.push({date:x.sale_date,customer,type:x.metric_label||'모바일',item:'특판 VAS 수수료 제외',amount:-vasFee,note:sp.policyTitle||'특판·지인판매'});
            if(repl)ledger.push({date:x.sale_date,customer,type:x.metric_label||'모바일',item:'특판 대체 인센티브',amount:repl,note:sp.policyTitle||'특판·지인판매'});
          }
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
        supabase.from('sales_expenses').select('*').in('user_id',ids).gte('expense_date',`${month}-01`).lt('expense_date',to),
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
            <div className="flex justify-between gap-3"><div><div className="font-bold text-sm">{r.name} · {displayStoreName(r.branch)}</div><div className="text-xs text-gray-400 mt-1">기본 {won(r.pay.total)} · 스팟 +{won(spot)} · 비용 -{won(expense)}</div><div className="text-[10px] text-violet-500 mt-1">상세 산출내역 보기 ›</div></div><div className="text-right"><div className="font-bold text-violet-700">{won(net)}</div><div className="text-[10px] text-gray-400">비용 차감 후</div></div></div>
          </button>
          {hqScore?<div className="mt-2 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-[10px] text-blue-800"><div className="font-semibold">본사 데이터 {hq.as_of_date} 기준</div><div className="mt-1">HS 직원 {fmtCount(inputHs)} / 본사 {fmtCount(hqScore.hs)} <b>({hqScore.hs-inputHs>0?'+':''}{fmtCount(hqScore.hs-inputHs)})</b> · 2ND 직원 {fmtCount(inputSecond)} / 본사 {fmtCount(hqScore.second)} <b>({hqScore.second-inputSecond>0?'+':''}{fmtCount(hqScore.second-inputSecond)})</b></div><div className="mt-0.5">성과P 직원 {fmtNum(r.pay?.totalPoints,1)}P / 본사 {fmtNum(hqScore.gradePoints,1)}P · 생산성 직원 {fmtNum(r.pay?.kpiScore,1)}P / 본사 {fmtNum(hqScore.kpiScore,1)}P</div></div>:<div className="mt-2 text-[10px] text-gray-300">본사 데이터 미등록 · 직원 입력 기준으로 검토</div>}
          <div className="grid grid-cols-4 gap-1 mt-3">
            {[['unreviewed','미검토'],['reviewing','검토중'],['checked','확인완료'],['final','정산확정']].map(([k,l])=><button key={k} onClick={()=>setStatus(r.id,k)} className={`py-1.5 rounded text-[10px] font-semibold ${status===k?'bg-violet-600 text-white':'bg-gray-50 text-gray-500'}`}>{l}</button>)}
          </div>
        </div>
      })}
    </div>
    {detailUser&&<div className="fixed inset-0 z-[80] bg-black/40 flex items-end md:items-center justify-center p-0 md:p-4" onClick={()=>setDetailUser(null)}>
      <div className="bg-white w-full md:max-w-5xl max-h-[92vh] rounded-t-2xl md:rounded-2xl overflow-hidden flex flex-col" onClick={e=>e.stopPropagation()}>
        <div className="p-4 border-b flex justify-between items-start"><div><div className="font-bold">{detailUser.name} · {monthLabel(month)} 상세 정산 원장</div><div className="text-xs text-gray-400 mt-1">날짜 / 고객명 / 가입구분 / 돈이 발생한 항목 / 적용금액</div></div><button onClick={()=>setDetailUser(null)} className="text-gray-400 text-xl">×</button></div>
        <div className="overflow-auto">
          <div className="p-4 bg-violet-50 border-b">
            <div className="text-xs font-bold text-violet-700 mb-2">최종 지급 구성</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">{detailSummary.map(([l,v])=><div key={l} className="bg-white rounded-lg border p-2 flex justify-between gap-2 text-xs"><span>{l}</span><b>{v>=0?'+':''}{won(v)}</b></div>)}</div>
            <div className="mt-3 flex justify-between font-bold text-sm"><span>최종 검토금액</span><span className="text-violet-700">{won(detailUser.pay.total+(spotMap[detailUser.id]||0)-(expenseMap[detailUser.id]||0))}</span></div>
          </div>
          {detailLoading?<div className="p-10 text-center text-sm text-gray-400">상세 내역을 불러오는 중...</div>:detailRows.length===0?<div className="p-10 text-center text-sm text-gray-400">고객별 판매 기록이 없어요. 구버전 집계 실적은 위 최종 지급 구성에서 확인할 수 있어요.</div>:<div className="divide-y">
            {detailRows.map((x,i)=><div key={`${x.date}-${i}`} className="p-3 grid grid-cols-[72px_1fr_auto] md:grid-cols-[90px_140px_150px_1fr_120px] gap-2 items-center text-xs">
              <div className="text-gray-500">{String(x.date||'').slice(5)}</div>
              <div className="font-semibold truncate">{x.customer}</div>
              <div className="hidden md:block text-gray-500">{x.type}</div>
              <div><div className="font-medium">{x.item}</div>{x.note&&<div className="text-[10px] text-gray-400 mt-0.5">{x.note}</div>}</div>
              <div className={`text-right font-bold ${Number(x.amount)<0?'text-red-500':Number(x.amount)>0?'text-violet-700':'text-gray-400'}`}>{x.amount===null?'금액은 월 합산 반영':`${Number(x.amount)>0?'+':''}${won(x.amount)}`}</div>
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
  return {hs,sim,home,second,free,smart,tailored,has:dayHasData(d),off:!!d.dayOff};
}

function AdminPerformanceCalendar({ month, employees, dailyRecords, loginBranch='', canSwitchStores=false }) {
  const availableStores=useMemo(()=>sortStoresByOpenOrder((employees||[]).map(e=>e.branch).filter(Boolean).filter(b=>!NON_SALES_STORES.includes(b))),[employees]);
  const defaultStore=canSwitchStores?'all':(loginBranch||availableStores[0]||'all');
  const [storeKey,setStoreKey]=useState(defaultStore);
  const [selectedDay,setSelectedDay]=useState(()=>{
    const now=new Date();
    return monthKeyOf(now)===month?String(now.getDate()).padStart(2,'0'):'01';
  });

  useEffect(()=>{
    if(canSwitchStores){
      if(storeKey!=='all'&&!availableStores.includes(storeKey))setStoreKey('all');
    }else{
      setStoreKey(loginBranch||availableStores[0]||'all');
    }
  },[canSwitchStores,loginBranch,availableStores.join('|')]);

  useEffect(()=>{
    const now=new Date();
    setSelectedDay(monthKeyOf(now)===month?String(now.getDate()).padStart(2,'0'):'01');
  },[month]);

  const scoped=(employees||[]).filter(e=>(storeKey==='all'||e.branch===storeKey)&&!NON_SALES_STORES.includes(e.branch));
  const n=daysInMonth(month);

  const daySummary=(dayKey)=>{
    const total={hs:0,sim:0,home:0,second:0,free:0,smart:0,tailored:0,input:0,off:0};
    scoped.forEach(emp=>{
      const m=dailyCalendarMetrics(dailyRecords?.[emp.id]?.[dayKey]);
      total.hs+=m.hs; total.sim+=m.sim; total.home+=m.home; total.second+=m.second; total.free+=m.free; total.smart+=m.smart; total.tailored+=m.tailored;
      if(m.has)total.input+=1;
      if(m.off)total.off+=1;
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
        <select value={storeKey} onChange={e=>setStoreKey(e.target.value)} className="max-w-[150px] text-xs font-semibold bg-white border border-gray-200 rounded-lg px-2 py-2">
          <option value="all">전체 매장</option>
          {availableStores.map(b=><option key={b} value={b}>{displayStoreName(b)}</option>)}
        </select>
      ) : (
        <div className="text-xs font-semibold text-violet-700 bg-violet-50 rounded-lg px-2.5 py-2">{displayStoreName(storeKey)}</div>
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
            className={`min-w-0 h-[58px] sm:h-[64px] rounded-lg flex flex-col items-center justify-start pt-2.5 px-0.5 overflow-hidden ${sel?'bg-violet-600 text-white':active?'bg-violet-50 text-violet-700':dow===0?'bg-red-50/50 text-red-400':dow===6?'bg-blue-50/50 text-blue-400':'bg-gray-50 text-gray-500'}`}>
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
          <div className="text-[10px] text-gray-400">입력 {fmtCount(selected.input)}명 · 미입력 {fmtCount(Math.max(0,scoped.length-selected.input-selected.off))}명 · 휴무 {fmtCount(selected.off)}명</div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-2">
          {[['HS',selected.hs],['SIM MNP',selected.sim],['홈',selected.home],['2ND',selected.second],['프리',selected.free],['스홈',selected.smart]].map(([label,value])=><div key={label} className="rounded-lg bg-white border border-gray-100 px-2 py-2 text-center"><div className="text-[9px] text-gray-400">{label}</div><div className="text-xs font-bold text-gray-800 mt-0.5">{fmtCount(value)}건</div></div>)}
        </div>
      </div>
      <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
        {employeeDetails.map(({emp,hs,sim,home,has,off})=><div key={emp.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="min-w-0"><div className="text-xs font-semibold text-gray-700 truncate">{emp.name}</div><div className="text-[9px] text-gray-400">{off?'휴무':has?'입력 완료':'미입력'}</div></div>
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
  const missing=workRows.filter(r=>!dayHasData(dailyRecords?.[r.id]?.[selectedDay]));
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
      <div className="flex justify-between gap-3 items-end"><div><div className="text-xs text-violet-500">실적 정확성 점검</div><div className="text-base font-bold mt-0.5">{monthLabel(month)} 실적 점검</div><div className="text-[10px] text-gray-400 mt-1">승인 대기 대신 미입력·관리자 최신화 차이·중복 가능성을 확인합니다.</div></div><select value={selectedDay} onChange={e=>setSelectedDay(e.target.value)} className="border rounded-lg px-2 py-2 text-xs">{Array.from({length:daysInMonth(month)},(_,i)=>String(i+1).padStart(2,'0')).map(d=><option key={d} value={d}>{Number(d)}일</option>)}</select></div>
    </div>
    <div className="grid grid-cols-3 gap-2">
      <div className="bg-white rounded-xl border p-3"><div className="text-[10px] text-gray-400">미입력 직원</div><div className="text-xl font-bold text-red-500 mt-1">{missing.length}명</div></div>
      <div className="bg-white rounded-xl border p-3"><div className="text-[10px] text-gray-400">중복 확인 필요</div><div className="text-xl font-bold text-amber-600 mt-1">{duplicateRows.length}건</div></div>
      <div className="bg-white rounded-xl border p-3"><div className="text-[10px] text-gray-400">관리자 최신화 매장</div><div className="text-xl font-bold text-violet-700 mt-1">{Object.keys(verifiedMap).length}개</div></div>
    </div>
    {missing.length>0&&<div className="bg-white rounded-xl border overflow-hidden"><div className="px-4 py-3 border-b font-bold text-sm">{Number(selectedDay)}일 미입력</div>{missing.map(r=><div key={r.id} className="px-4 py-2.5 border-b last:border-0 flex justify-between text-xs"><span><b>{r.name}</b> · {displayStoreName(r.branch)}</span><span className="text-red-500">입력 없음</span></div>)}</div>}
    <div className="bg-white rounded-xl border overflow-hidden"><div className="px-4 py-3 border-b"><div className="font-bold text-sm">직원 입력 vs 관리자 확인</div><div className="text-[10px] text-gray-400 mt-1">평가의 ‘실적 최신화’에서 저장한 관리자 확인값과 현재 직원 입력 누적을 비교합니다.</div></div>{workRows.map(r=>{const v=verifiedMap[r.branch]?.verified_metrics; if(!v)return null; const hs=hsCount(r.draft),home=Number(r.draft?.homeBase?.homeOnly||0)+Number(r.draft?.homeBase?.homeTv||0);return <div key={r.id} className="px-4 py-2.5 border-b last:border-0 text-xs"><div className="font-semibold">{r.name} · {displayStoreName(r.branch)}</div><div className="text-[10px] text-gray-500 mt-1">직원입력 HS {fmtCount(hs)} / 홈 {fmtCount(home)} · 매장 관리자확인 HS {fmtCount(v.hs||0)} / 홈 {fmtCount(v.home||0)}</div></div>})}</div>
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
      const {data,error}=await supabase.from('sales_expenses').select('*').in('user_id',ids).gte('expense_date',`${month}-01`).lt('expense_date',to).order('expense_date',{ascending:false});
      if(error){console.error('ADMIN EXPENSE LOAD ERROR',error);setRows([]);setLoadError(friendlyError(error));}
      else setRows(data||[]);
      setLoading(false);
    })();
  },[month,scoped.map(e=>e.id).join('|')]);
  const total=rows.reduce((a,x)=>a+Number(x.amount||0),0);
  return <div className="space-y-3"><div><div className="text-xs text-violet-600 font-semibold">영업비용 / 오퍼</div><div className="text-xl font-bold">{monthLabel(month)} · {won(total)}</div><div className="text-[10px] text-gray-400 mt-1">관리범위 직원이 입력한 영업비용을 확인합니다.</div></div><div className="bg-white rounded-xl border overflow-hidden">{loading?<div className="p-4 text-sm text-gray-400">불러오는 중...</div>:loadError?<div className="p-4"><div className="text-sm font-bold text-red-500">영업비용을 불러오지 못했어요.</div><div className="text-[11px] text-red-400 mt-1">{loadError}</div><div className="text-[10px] text-gray-400 mt-2">Supabase의 sales_expenses 조회 정책(RLS)을 확인해주세요.</div></div>:rows.length===0?<div className="p-4 text-sm text-gray-400">등록된 영업비용이 없어요.</div>:rows.map(x=>{const e=scoped.find(v=>v.id===x.user_id);return <div key={x.id} className="p-3 border-b last:border-0"><div className="flex justify-between gap-2"><div><div className="text-sm font-bold">{e?.name||'직원'} <span className="font-normal text-gray-400">· {displayStoreName(e?.branch)}</span></div><div className="text-[11px] text-gray-500 mt-1">{x.expense_date} · {x.customer_name||'이름 없음'} · {x.category||'기타'}{x.memo?` · ${x.memo}`:''}</div></div><b className="text-red-500 shrink-0">-{won(x.amount)}</b></div></div>})}</div></div>
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
    home:targetRows.reduce((s,r)=>s+Number(r.draft?.homeBase?.homeOnly||0)+Number(r.draft?.homeBase?.homeTv||0),0),
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
    <div><div className="text-xs text-violet-600 font-semibold">본사 데이터 기준</div><div className="text-xl font-bold">{mode==='store'?'매장별':'개인별'} 누적 실적 대조</div><div className="text-[10px] text-gray-400 mt-1">매장 기준이 기본입니다. 개인 기준은 개인별 본사 자료가 있을 때만 선택하세요. 급여와 직원 입력 원본은 변경하지 않습니다.</div></div>
    <div className="grid grid-cols-2 bg-gray-100 rounded-xl p-1 gap-1"><button onClick={()=>setMode('store')} className={`py-2.5 rounded-lg text-xs font-bold ${mode==='store'?'bg-white text-violet-700 shadow-sm':'text-gray-500'}`}>매장 기준</button><button onClick={()=>setMode('personal')} className={`py-2.5 rounded-lg text-xs font-bold ${mode==='personal'?'bg-white text-violet-700 shadow-sm':'text-gray-500'}`}>개인 기준</button></div>
    <div className="bg-white border rounded-xl p-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
      <select value={selectedStore} onChange={e=>setSelectedStore(e.target.value)} className="border rounded-lg px-2 py-2 text-xs">{stores.map(s=><option key={s} value={s}>{displayStoreName(s)}</option>)}</select>
      {mode==='personal'?<select value={selectedId} onChange={e=>setSelectedId(e.target.value)} className="border rounded-lg px-2 py-2 text-xs">{visible.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select>:<div className="border rounded-lg px-2 py-2 text-xs text-gray-500 bg-gray-50">직원 입력 합계 {targetRows.length}명</div>}
      <input type="date" value={asOfDate} onChange={e=>setAsOfDate(e.target.value)} className="border rounded-lg px-2 py-2 text-xs"/>
      <button onClick={save} disabled={saving||loading||(mode==='store'?!selectedStore:!selected)} className="rounded-lg bg-violet-600 text-white text-xs font-bold px-3 py-2 disabled:opacity-40">{saving?'저장 중':`${mode==='store'?'매장':'개인'} 본사 데이터 저장`}</button>
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

function AdminView({ adminTab, setAdminTab, months, month, setMonth, rows, rankingRows, dailyRecords, totalPay, pendingCount, approve, rejectApproval, config, persistConfig, employees, addEmployee, updateEmployee, removeEmployee, stores, addStore, removeStore, isFullAdmin, monthLocked, toggleMonthLock, policyInputBlocked=false, togglePolicyInputBlock, authUserId, loginPosition='', loginBranch='', canSwitchStores=false, canViewHqStructure=false }) {
  const [customerCareFilter,setCustomerCareFilter]=useState('todo');
  const TABS = [
    { key: 'dashboard', label: '대시보드', icon: LayoutDashboard, group:'현황' },
    { key: 'performance', label: '실적 순위', icon: Trophy, group:'현황' },
    { key: 'evaluation', label: '평가', icon: ClipboardCheck, group:'현황' },
    { key: 'storeGoals', label: '매장 목표', icon: Target, group:'현황' },
    { key: 'performanceApproval', label: '실적 점검', icon: ClipboardCheck, group:'실적 관리' },
    { key: 'history', label: '변경 이력', icon: History, group:'실적 관리' },
    { key: 'customerCareAdmin', label: '고객 관리', icon: ClipboardList, group:'고객 · 홈' },
    { key: 'homeCare', label: '홈 케어', icon: Home, group:'고객 · 홈' },
    { key: 'expenses', label: '영업비용/오퍼', icon: Wallet, group:'비용 · 승인' },
    { key: 'spot', label: '스팟 승인', icon: Zap, group:'비용 · 승인' },
    { key: 'employees', label: '직원 관리', icon: Users, group:'설정' },
    ...(canViewHqStructure ? [{ key: 'hqStructure', label: '본사 구조정책', icon: Building2, group:'본사 전용' }] : []),
    ...(isFullAdmin ? [
      { key: 'headOfficeData', label: '본사 데이터', icon: UploadCloud, group:'실적 관리' },
      { key: 'settlement', label: '정산 검토', icon: Wallet, group:'정산' },
      { key: 'calculationAudit', label: '계산 검증', icon: ShieldCheck, group:'정산' },
      { key: 'rates', label: '지급기준 관리', icon: Settings, group:'설정' },
      { key: 'permissions', label: '권한 관리', icon: ShieldCheck, group:'설정' },
    ] : []),
  ];
  const TAB_GROUPS=['현황','실적 관리','고객 · 홈','비용 · 승인','본사 전용','정산','설정'];
  useEffect(() => {
    if ((adminTab === 'rates' || adminTab === 'permissions' || adminTab === 'settlement' || adminTab === 'calculationAudit' || adminTab === 'headOfficeData') && !isFullAdmin) setAdminTab('dashboard');
    if (adminTab === 'hqStructure' && !canViewHqStructure) setAdminTab('dashboard');
  }, [adminTab, isFullAdmin, canViewHqStructure]); // eslint-disable-line

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

  return (
    <div className="max-w-5xl mx-auto px-4 py-5">
      <div className="mb-4 space-y-3">
        <div className="bg-white border border-gray-200 rounded-2xl p-2 space-y-2">
          {TAB_GROUPS.map(group=>{const items=TABS.filter(x=>x.group===group);if(!items.length)return null;return <div key={group} className="grid grid-cols-[58px_1fr] gap-2 items-start"><div className="text-[9px] font-bold text-gray-400 pt-2 px-1">{group}</div><div className="flex flex-wrap gap-1">{items.map(n=><button key={n.key} onClick={()=>setAdminTab(n.key)} className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-semibold transition ${adminTab===n.key?'bg-violet-600 text-white shadow-sm':'bg-gray-50 text-gray-600 hover:bg-violet-50'}`}><n.icon size={13}/>{n.label}</button>)}</div></div>})}
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
              {policyInputBlocked?'🛠 정책 준비 중 (입력 열기)':'정책 입력 잠금'}
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
          <AdminManagementAlerts pendingCount={pendingCount} employees={employees} onGo={(tab)=>{if(tab==='customerCareAdmin')setCustomerCareFilter('overdue');setAdminTab(tab)}} month={month} rows={rows} dailyRecords={dailyRecords} isFullAdmin={isFullAdmin} config={config} />

          <AdminPerformanceCalendar
            month={month}
            employees={employees}
            dailyRecords={dailyRecords}
            loginBranch={loginBranch}
            canSwitchStores={canSwitchStores}
          />

          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex justify-between items-end gap-3 mb-3">
              <div>
                <div className="text-xs text-gray-400">{isFullAdmin?'전체 운영 현황':'우리 매장 현황'}</div>
                <div className="text-base font-bold text-gray-900">{monthLabel(month)} 핵심 성과</div>
              </div>
              <div className="text-xs text-gray-400">{rows.length}명</div>
            </div>
            <div className="space-y-2">
              {[
                ADMIN_MAIN_METRICS.slice(0,4),
                ADMIN_MAIN_METRICS.slice(4,8),
                ADMIN_MAIN_METRICS.slice(8,10),
              ].map((metricRow,rowIndex)=>(
                <div key={rowIndex} className={`grid gap-2 ${rowIndex<2?'grid-cols-4':'grid-cols-2'}`}>
                  {metricRow.map(([key,label,unit])=>{
                    const value=rows.reduce((s,r)=>s+adminMetricValue(r,key),0);
                    return <div key={key} className="rounded-xl bg-gray-50 px-3 py-3 min-w-0 text-center">
                      <div className="text-[11px] text-gray-400 leading-tight min-h-[18px] flex items-center justify-center">{label}</div>
                      <div className="text-[15px] font-bold text-gray-900 mt-1 whitespace-nowrap">
                        {unit==='won' ? won(value) : unit==='point' ? `${Number(value||0).toFixed(1)}P` : `${fmtCount(value)}건`}
                      </div>
                    </div>
                  })}
                </div>
              ))}
            </div>
          </div>

          <StoreGoalDashboardCard
            rows={rows}
            employees={employees}
            authUserId={authUserId}
            month={month}
            onOpen={()=>setAdminTab('storeGoals')}
          />
          <StoreChallengeCard
            month={month}
            allRows={rankingRows||rows}
            employees={employees}
            authUserId={authUserId}
            onOpenGoals={()=>setAdminTab('storeGoals')}
          />

          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <div className="text-sm font-bold text-gray-800">우리 매장 직원 현황</div>
              <div className="text-xs text-gray-400 mt-0.5">핵심 실적만 빠르게 확인해요.</div>
            </div>
            <div className="divide-y divide-gray-50">
              {[...rows].sort((a,b)=>hsCount(b.draft)-hsCount(a.draft)).map(r=>(
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

          <AdminCustomerCareOverview employees={employees} month={month} compact onOpen={()=>{setCustomerCareFilter('todo');setAdminTab('customerCareAdmin')}} />
        </div>
      )}

      {adminTab === 'performance' && <ComparisonView rows={rows} />}
      {adminTab === 'evaluation' && <EvaluationTab month={month} config={config} isManagerView={true} canFinalApprove={isFullAdmin} employees={employees} rows={rankingRows||rows} authUserId={authUserId} canSwitchStores={canSwitchStores} loginBranch={loginBranch} />}
      {adminTab === 'customerCareAdmin' && <AdminCustomerCareOverview employees={employees} month={month} initialFilter={customerCareFilter} />}
      {adminTab === 'homeCare' && <AdminHomeCare employees={employees} month={month} />}
      {adminTab === 'performanceApproval' && <PerformanceCheckPanel month={month} rows={rows} dailyRecords={dailyRecords} employees={employees} />}
      {adminTab === 'expenses' && <AdminExpenseOverview month={month} employees={employees} loginBranch={loginBranch} canSwitchStores={canSwitchStores} />}
      {adminTab === 'storeGoals' && <StoreGoalAdmin month={month} employees={employees} rows={rows} isFullAdmin={isFullAdmin} authUserId={authUserId} />}
      {adminTab === 'spot' && <SpotAdmin authUserId={authUserId} isFullAdmin={isFullAdmin} month={month} />}
      {adminTab === 'headOfficeData' && isFullAdmin && <HeadOfficeDataPanel month={month} employees={employees} rows={rows} config={config} authUserId={authUserId} />}
      {adminTab === 'settlement' && isFullAdmin && <SettlementReview month={month} rows={rows} employees={employees} config={config} authUserId={authUserId} />}
      {adminTab === 'calculationAudit' && isFullAdmin && <CalculationAuditPanel month={month} rows={rows} />}
      {adminTab === 'history' && <HistoryTab employees={employees} month={month} config={config} />}
      {adminTab === 'hqStructure' && canViewHqStructure && <HqStructurePolicyView month={month} employeeIds={(rankingRows||rows).map(row=>row.id)} authUserId={authUserId} />}

      {adminTab === 'employees' && (
        <EmployeeManager employees={employees} addEmployee={addEmployee} updateEmployee={updateEmployee} removeEmployee={removeEmployee} stores={stores} addStore={addStore} removeStore={removeStore} authUserId={authUserId} />
      )}

      {adminTab === 'rates' && isFullAdmin && (
        <RatesManager config={config} persistConfig={persistConfig} />
      )}

      {adminTab === 'permissions' && isFullAdmin && (
        <PermissionsManager employees={employees} />
      )}
    </div>
  );
}

function CalculationAuditPanel({month,rows=[]}){
  const [expanded,setExpanded]=useState('');
  const covered=rows.filter(r=>r.calculationAudit?.comparable).length;
  const different=rows.filter(r=>r.calculationAudit?.comparable&&Number(r.calculationAudit?.difference||0)!==0).length;
  return <div className="space-y-4">
    <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4">
      <div className="text-sm font-bold text-violet-900">계산 엔진 그림자 검증</div>
      <div className="mt-1 text-xs leading-relaxed text-violet-700">직원에게 표시되는 급여는 변경하지 않고, 판매 당시 정책 스냅샷으로 다시 계산한 모바일 인센티브를 비교합니다.</div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-white p-2"><div className="text-[10px] text-gray-400">대상</div><b className="text-sm">{rows.length}명</b></div><div className="rounded-xl bg-white p-2"><div className="text-[10px] text-gray-400">비교 가능</div><b className="text-sm text-emerald-600">{covered}명</b></div><div className="rounded-xl bg-white p-2"><div className="text-[10px] text-gray-400">차이 발견</div><b className="text-sm text-red-500">{different}명</b></div></div>
    </div>
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
      <div className="border-b px-4 py-3"><div className="text-sm font-bold">{monthLabel(month)} 직원별 검증 결과</div><div className="text-[11px] text-gray-400">스냅샷이 없는 이전 판매는 기존 방식으로 유지하며 비교 대상에서 제외됩니다.</div></div>
      <div className="divide-y">
        {rows.map(r=>{const a=r.calculationAudit||{};const complete=a.comparable;const open=expanded===r.id;return <div key={r.id} className="px-4 py-3">
          <button type="button" onClick={()=>setExpanded(open?'':r.id)} className="w-full text-left"><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-bold">{r.name} <span className="text-[10px] font-normal text-gray-400">{displayStoreName(r.branch)}</span></div><div className="mt-1 text-[11px] text-gray-500">판매 {a.totalSales||0}건 · 스냅샷 {a.snapshotSales||0}건 · 이전방식 {a.missingSnapshots||0}건</div></div>
          {complete?<span className={`rounded-full px-2 py-1 text-[10px] font-bold ${Number(a.difference||0)===0?'bg-emerald-50 text-emerald-600':'bg-red-50 text-red-600'}`}>{Number(a.difference||0)===0?'일치':`차이 ${won(a.difference)}`}</span>:<span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-bold text-gray-500">이전정책 포함</span>}</div>
          {complete&&<div className="mt-2 grid grid-cols-2 gap-2 text-[11px]"><div className="rounded-lg bg-gray-50 px-3 py-2">기존 모바일 <b className="float-right">{won(a.existingMobilePay)}</b></div><div className="rounded-lg bg-gray-50 px-3 py-2">새 원장 <b className="float-right">{won(a.shadowMobilePay)}</b></div></div>}</button>
          {open&&<div className="mt-3 space-y-2 border-t pt-3">{(a.details||[]).length===0?<div className="rounded-lg bg-gray-50 p-3 text-[11px] text-gray-400">상세 계산이 가능한 신규 판매가 아직 없어요.</div>:(a.details||[]).map(d=><div key={d.id} className="rounded-xl border border-gray-100 p-3 text-[11px]"><div className="flex justify-between gap-2"><b>{d.date} · {d.customer}</b><span className="text-violet-600">{d.policyVersion}</span></div><div className="mt-0.5 text-gray-400">{d.label}{d.freePhone?' · 무료폰 특가':''}</div><div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-gray-600"><span>요금제 <b className="float-right">{won(d.paid?.plan)}</b></span><span>VAS·보험 <b className="float-right">{won(Number(d.paid?.vas||0)+Number(d.paid?.insurance||0))}</b></span><span>2ND <b className="float-right">{won(d.paid?.second)} · {Number(d.performancePoints||0).toFixed(1)}P</b></span><span>전략P <b className="float-right">{Number(d.insurancePoints||0).toFixed(1)}P</b></span></div>{d.freePhone&&<div className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-amber-700">무료폰 제외: 요금제 {won(d.excluded?.plan)} · VAS {won(d.excluded?.vas)} · 보험 {won(d.excluded?.insurance)}</div>}</div>)}</div>}
        </div>})}
      </div>
    </div>
  </div>;
}

/* 관리자는 MNP·기변A/B/C·010신규를 묶어 HS로 관리 — 일일입력 매트릭스의 해당 행을 합산 */
const HS_ROWS = [
  { label: '일반모델 MNP', short: 'MNP' },
  { label: '일반모델 기변A', short: '기변A' },
  { label: '일반모델 기변B', short: '기변B' },
  { label: '일반모델 기변C', short: '기변C' },
  { label: '일반모델 신규', short: '신규' },
];
const HS_PARTS = HS_ROWS.map((r) => ({ short: r.short, idx: MATRIX_ROWS.indexOf(r.label) })).filter((r) => r.idx >= 0);
const matrixRowCount = (d, ri) => ((d && d.matrix && d.matrix[ri]) || []).reduce((s, v) => s + (v || 0), 0);
const hsCount = (d) => HS_PARTS.reduce((s, p) => s + matrixRowCount(d, p.idx), 0);

const COMPARE_METRICS = [
  {
    key:'hs', label:'HS', unit:'count', calc:(d)=>hsCount(d),
    parts:HS_PARTS.map((p)=>({label:p.short,calc:(d)=>matrixRowCount(d,p.idx)}))
  },
  { key:'simMnp', label:'SIM MNP', unit:'count', calc:(d)=>Object.values(d.mnpBundle||{}).reduce((s,v)=>s+Number(v||0),0) },
  { key:'second', label:'2ND', unit:'count', calc:(d)=>Object.values(d.bundle2nd||{}).reduce((s,v)=>s+Number(v||0),0) },
  { key:'home', label:'홈 실적', unit:'count', calc:(d)=>Number(d.homeBase?.homeOnly||0)+Number(d.homeBase?.homeTv||0) },
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
                      {versionBefore!==versionAfter&&<div className="text-[10px] text-violet-600 mt-1">데이터 형식 v{versionBefore} → v{versionAfter}</div>}
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
          <button onClick={() => setGroupBy('employee')} className={`px-3 py-1.5 rounded-md text-sm font-medium ${groupBy === 'employee' ? 'bg-violet-600 text-white' : 'text-gray-500'}`}>직원별</button>
          <button onClick={() => setGroupBy('branch')} className={`px-3 py-1.5 rounded-md text-sm font-medium ${groupBy === 'branch' ? 'bg-violet-600 text-white' : 'text-gray-500'}`}>매장별</button>
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
              <div className="h-full bg-violet-500 rounded-full" style={{ width: `${Math.max(2, (d.value / max) * 100)}%` }} />
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

function EmployeeManager({ employees, addEmployee, updateEmployee, removeEmployee, stores, addStore, removeStore, authUserId }) {
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
    const { error } = await supabase.from('profiles').update({ active: true }).eq('id', id);
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
      <PendingApprovals />
      <ProfileEditRequests />
      <PasswordResetAdmin authUserId={authUserId}/>
      <Section title="매장 관리" sub={`${stores.length}개 매장`} defaultOpen>
        <div className="p-3 flex gap-2">
          <input placeholder="새 매장명 (예: 동명_매장명)" value={newStore} onChange={(e) => setNewStore(e.target.value)} className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm" />
          <button onClick={() => { addStore(newStore); setNewStore(''); }} className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold whitespace-nowrap">매장 추가</button>
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
        <button onClick={submit} className="col-span-2 flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold"><UserPlus size={14} /> 직원 추가</button>
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
                <button onClick={saveEdit} className="text-xs font-medium px-2.5 py-1 rounded-md bg-violet-600 text-white">저장</button>
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
                <button onClick={() => reactivate(p.id)} className="text-xs font-medium px-2.5 py-1.5 rounded-md bg-violet-600 text-white">다시 활성화</button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function MobilePointItemsEditor({ items, onChange }) {
  const [newLabel, setNewLabel] = useState('');
  const [newPoint, setNewPoint] = useState('');
  const [newCountsTenure, setNewCountsTenure] = useState(true);

  const updateItem = (idx, patch) => onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const removeItem = (idx) => onChange(items.filter((_, i) => i !== idx));
  const addItem = () => {
    if (!newLabel.trim()) return;
    const key = `custom_${Date.now()}`;
    onChange([...items, { key, label: newLabel.trim(), point: parseFloat(newPoint || '0'), countsTenure: newCountsTenure }]);
    setNewLabel(''); setNewPoint(''); setNewCountsTenure(true);
  };

  return (
    <Section title="모바일 실적 항목 관리" sub={`${items.length}개 항목`} defaultOpen>
      <div className="px-4 pt-3 pb-1 text-[11px] text-gray-400">항목을 직접 추가·삭제·수정할 수 있어요. "근속수당 건수 포함"을 체크하면 이 항목이 근속기간별 건당 지급액 계산에도 반영돼요.</div>
      <div className="divide-y divide-gray-50">
        {items.map((it, idx) => (
          <div key={it.key} className="flex items-center gap-2 px-4 py-2.5 flex-wrap">
            <input value={it.label} onChange={(e) => updateItem(idx, { label: e.target.value })} className="flex-1 min-w-[140px] border border-gray-200 rounded-lg px-2 py-1 text-sm" />
            <div className="flex items-center gap-1">
              <input type="number" step="0.1" value={it.point} onChange={(e) => updateItem(idx, { point: parseFloat(e.target.value || '0') })} className="w-16 text-right border border-gray-200 rounded-lg px-1.5 py-1 text-sm" />
              <span className="text-xs text-gray-400">P</span>
            </div>
            <label className="flex items-center gap-1 text-xs text-gray-500">
              <input type="checkbox" checked={it.countsTenure !== false} onChange={(e) => updateItem(idx, { countsTenure: e.target.checked })} className="w-3.5 h-3.5" />
              근속수당 건수 포함
            </label>
            <button onClick={() => removeItem(idx)} className="w-7 h-7 rounded-md bg-red-50 text-red-500 flex items-center justify-center"><Trash2 size={13} /></button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 flex-wrap px-4 py-3 bg-gray-50">
        <input placeholder="새 항목명 (예: 기변(신규정책))" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} className="flex-1 min-w-[140px] border border-gray-200 rounded-lg px-2 py-1.5 text-sm" />
        <div className="flex items-center gap-1">
          <input type="number" step="0.1" placeholder="포인트" value={newPoint} onChange={(e) => setNewPoint(e.target.value)} className="w-20 text-right border border-gray-200 rounded-lg px-1.5 py-1.5 text-sm" />
          <span className="text-xs text-gray-400">P</span>
        </div>
        <label className="flex items-center gap-1 text-xs text-gray-500">
          <input type="checkbox" checked={newCountsTenure} onChange={(e) => setNewCountsTenure(e.target.checked)} className="w-3.5 h-3.5" />
          근속수당 포함
        </label>
        <button onClick={addItem} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold"><Plus size={14} /> 항목 추가</button>
      </div>
    </Section>
  );
}

function KpiItemsEditor({ items, onChange }) {
  const [newLabel, setNewLabel] = useState('');
  const [newPoint, setNewPoint] = useState('');

  const updateItem = (idx, patch) => onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const removeItem = (idx) => onChange(items.filter((_, i) => i !== idx));
  const addItem = () => {
    if (!newLabel.trim()) return;
    const key = `kpi_custom_${Date.now()}`;
    onChange([...items, { key, label: newLabel.trim(), point: parseFloat(newPoint || '0') }]);
    setNewLabel(''); setNewPoint('');
  };

  return (
    <Section title="개인 생산성 항목 관리" sub={`${items.length}개 항목`}>
      <div className="px-4 pt-3 pb-1 text-[11px] text-gray-400">인센티브 금액에는 반영되지 않는 참고용 생산성 점수예요. 항목을 직접 추가·삭제·수정할 수 있어요.</div>
      <div className="divide-y divide-gray-50">
        {items.map((it, idx) => (
          <div key={it.key} className="flex items-center gap-2 px-4 py-2.5 flex-wrap">
            <input value={it.label} onChange={(e) => updateItem(idx, { label: e.target.value })} className="flex-1 min-w-[140px] border border-gray-200 rounded-lg px-2 py-1 text-sm" />
            <div className="flex items-center gap-1">
              <input type="number" step="0.1" value={it.point} onChange={(e) => updateItem(idx, { point: parseFloat(e.target.value || '0') })} className="w-16 text-right border border-gray-200 rounded-lg px-1.5 py-1 text-sm" />
              <span className="text-xs text-gray-400">P</span>
            </div>
            <button onClick={() => removeItem(idx)} className="w-7 h-7 rounded-md bg-red-50 text-red-500 flex items-center justify-center"><Trash2 size={13} /></button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 flex-wrap px-4 py-3 bg-gray-50">
        <input placeholder="새 항목명" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} className="flex-1 min-w-[140px] border border-gray-200 rounded-lg px-2 py-1.5 text-sm" />
        <div className="flex items-center gap-1">
          <input type="number" step="0.1" placeholder="포인트" value={newPoint} onChange={(e) => setNewPoint(e.target.value)} className="w-20 text-right border border-gray-200 rounded-lg px-1.5 py-1.5 text-sm" />
          <span className="text-xs text-gray-400">P</span>
        </div>
        <button onClick={addItem} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold"><Plus size={14} /> 항목 추가</button>
      </div>
    </Section>
  );
}

function CategoryMapEditor({ map, mobilePointItems, kpiItems, onChange }) {
  const update = (idx, field, value) => {
    const next = map.map((m, i) => (i === idx ? { ...m, [field]: value } : m));
    onChange(next);
  };
  return (
    <Section title="가입구분 ↔ 성과등급P / KPI 매핑" sub="일일입력 자동 연결 기준" defaultOpen>
      <div className="px-4 pt-3 pb-1 text-[11px] text-gray-400">직원이 일일입력 탭에서 이 가입구분에 건수를 넣으면, 아래 지정한 성과등급P 항목과 KPI 항목에 그 건수가 자동으로 더해져요. 기변A/B/C는 타겟 상관없이 요금제군 기준으로 성과등급P가 배분되므로 아래 "기변 요금제군별 매핑" 표를 따로 사용해요.</div>
      <div className="divide-y divide-gray-50">
        {MATRIX_ROW_DEFS.map((rowDef, idx) => (
          <div key={rowDef.label} className="flex items-center gap-2 px-4 py-2.5 flex-wrap">
            <span className="text-sm text-gray-700 min-w-[110px]">{rowDef.label}</span>
            {rowDef.isGibyeon ? (
              <span className="text-xs text-gray-400 flex-1 min-w-[130px]">성과등급P: 요금제군별 매핑 사용</span>
            ) : (
              <select value={map[idx]?.mobilePointKey || ''} onChange={(e) => update(idx, 'mobilePointKey', e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 flex-1 min-w-[130px]">
                <option value="">성과등급P 미연결</option>
                {mobilePointItems.map((it) => <option key={it.key} value={it.key}>{it.label}</option>)}
              </select>
            )}
            <select value={map[idx]?.kpiKey || ''} onChange={(e) => update(idx, 'kpiKey', e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 flex-1 min-w-[130px]">
              <option value="">KPI 미연결</option>
              {kpiItems.map((it) => <option key={it.key} value={it.key}>{it.label}</option>)}
            </select>
          </div>
        ))}
      </div>
    </Section>
  );
}

function GibyeonColumnMapEditor({ colMap, mobilePointItems, onChange }) {
  const update = (ci, value) => onChange(colMap.map((v, i) => (i === ci ? value : v)));
  return (
    <Section title="기변 요금제군별 성과등급P 매핑" sub="기변A/B/C 공통 적용 (타겟 무관)">
      <div className="px-4 pt-3 pb-1 text-[11px] text-gray-400">기변A/B/C 중 어느 행에 입력해도, 고른 요금제군에 따라 여기 지정한 성과등급P 항목으로 자동 배분돼요.</div>
      <div className="divide-y divide-gray-50">
        {MATRIX_COLS.map((col, ci) => (
          <div key={col} className="flex items-center gap-2 px-4 py-2.5 flex-wrap">
            <span className="text-sm text-gray-700 min-w-[150px]">{col}</span>
            <select value={colMap[ci] || ''} onChange={(e) => update(ci, e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 flex-1 min-w-[130px]">
              <option value="">미연결</option>
              {mobilePointItems.map((it) => <option key={it.key} value={it.key}>{it.label}</option>)}
            </select>
          </div>
        ))}
      </div>
    </Section>
  );
}

const ROLE_LABELS = { employee: '일반 직원', manager: '매니저(관리자 권한)', admin: '전체 관리자' };

function PermissionsManager({ employees }) {
  const [rolesById, setRolesById] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState('');
  const [nameQuery, setNameQuery] = useState('');

  const [autoPositions, setAutoPositions] = useState(['점장', '부점장', '담당']);
  const [autoSaving, setAutoSaving] = useState(false);

  useEffect(() => {
    setRolesById(Object.fromEntries(employees.map((e) => [e.id, e.role || 'employee'])));
  }, [employees]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('app_config').select('value').eq('config_key', 'auto_manager_positions').maybeSingle();
      if (!error && Array.isArray(data?.value)) setAutoPositions(data.value);
    })();
  }, []);

  const saveRole = async (id, role) => {
    setSavingId(id);
    setError('');
    const { error } = await supabase.from('profiles').update({ role }).eq('id', id);
    if (error) { console.error('ROLE SAVE ERROR:', error); setError(friendlyError(error)); }
    setSavingId(null);
  };

  const toggleAutoPosition = async (p) => {
    const next = autoPositions.includes(p) ? autoPositions.filter((x) => x !== p) : [...autoPositions, p];
    setAutoPositions(next);
    setAutoSaving(true);
    const { error } = await supabase.from('app_config').upsert({ config_key: 'auto_manager_positions', value: next }, { onConflict: 'config_key' });
    if (error) { console.error('AUTO POSITIONS SAVE ERROR:', error); setError(friendlyError(error)); }
    setAutoSaving(false);
  };

  const visible = employees.filter((e) => !nameQuery.trim() || e.name.includes(nameQuery.trim()));

  return (
    <div className="max-w-2xl space-y-4">
      <div className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3 flex gap-2">
        <Info size={13} className="shrink-0 mt-0.5" />
        이 화면은 전체 관리자(사장님)만 볼 수 있어요. 실수로 다른 사람에게 전체 관리자 권한을 주지 않도록 주의해주세요.
      </div>

      <Section title="가입 승인시 자동으로 매니저 권한 부여할 직급" defaultOpen>
        <div className="px-4 py-3 text-[11px] text-gray-400">체크된 직급으로 가입 신청한 사람을 승인하면, 별도 조작 없이 자동으로 매니저(관리자) 권한이 붙어요.</div>
        <div className="px-4 pb-4 flex flex-wrap gap-2">
          {POSITIONS.map((p) => (
            <button key={p} onClick={() => toggleAutoPosition(p)} disabled={autoSaving}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border ${autoPositions.includes(p) ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-500 border-gray-200'}`}>
              {p}
            </button>
          ))}
        </div>
      </Section>

      <Section title="직원별 권한 직접 변경" sub={`${employees.length}명`} defaultOpen>
        <div className="px-4 pt-3 pb-2">
          <input placeholder="이름 검색" value={nameQuery} onChange={(e) => setNameQuery(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white w-32" />
        </div>
        <div className="divide-y divide-gray-50">
          {visible.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-800 truncate">{e.name} <span className="text-gray-400 font-normal">· {e.position} · {displayStoreName(e.branch)}</span></div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <select
                  value={rolesById[e.id] || 'employee'}
                  onChange={(ev) => setRolesById({ ...rolesById, [e.id]: ev.target.value })}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5"
                >
                  {Object.entries(ROLE_LABELS).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                </select>
                <button
                  onClick={() => saveRole(e.id, rolesById[e.id])}
                  disabled={savingId === e.id || (rolesById[e.id] || 'employee') === (e.role || 'employee')}
                  className="text-xs font-medium px-2.5 py-1.5 rounded-md bg-violet-600 text-white disabled:opacity-40"
                >
                  {savingId === e.id ? <Loader2 size={13} className="animate-spin" /> : '저장'}
                </button>
              </div>
            </div>
          ))}
          {visible.length === 0 && <div className="text-xs text-gray-400 px-4 py-6 text-center">검색 결과가 없어요.</div>}
        </div>
      </Section>

      {error && <div className="text-xs text-red-600 bg-red-50 rounded-lg p-3">{error}</div>}
    </div>
  );
}

function RatesManager({ config, persistConfig }) {
  const [draft, setDraftCfg] = useState(config);
  useEffect(() => setDraftCfg(config), [config]);
  const save = () => persistConfig(draft);

  const updateFlatTable = (group, idx, field, val) => {
    const next = { ...draft, [group]: draft[group].map((t, i) => (i === idx ? { ...t, [field]: val } : t)) };
    setDraftCfg(next);
  };
  const updateMatrix = (ri, ci, val) => {
    const next = draft.matrix.map((row) => [...row]);
    next[ri][ci] = val;
    setDraftCfg({ ...draft, matrix: next });
  };

  return (
    <div className="max-w-3xl space-y-4">
      <div className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3">항목을 수정한 뒤 맨 아래 "저장" 버튼을 눌러야 모든 직원 화면에 반영돼요.</div>

      <MobilePointItemsEditor items={draft.mobilePointItems} onChange={(items) => setDraftCfg({ ...draft, mobilePointItems: items })} />

      <KpiItemsEditor items={draft.kpiItems} onChange={(items) => setDraftCfg({ ...draft, kpiItems: items })} />

      <CategoryMapEditor map={draft.categoryMap} mobilePointItems={draft.mobilePointItems} kpiItems={draft.kpiItems}
        onChange={(m) => setDraftCfg({ ...draft, categoryMap: m })} />

      <GibyeonColumnMapEditor colMap={draft.gibyeonColumnMap} mobilePointItems={draft.mobilePointItems}
        onChange={(m) => setDraftCfg({ ...draft, gibyeonColumnMap: m })} />

      <Section title="직급별 최저 보장금액" defaultOpen>
        <div className="p-3 grid grid-cols-2 gap-2">
          {POSITIONS.map((p) => (
            <div key={p} className="flex items-center justify-between gap-2">
              <span className="text-sm text-gray-600">{p}</span>
              <input type="text" inputMode="numeric" value={fmtInputNumber(draft.basePay[p])} onChange={(e) => setDraftCfg({ ...draft, basePay: { ...draft.basePay, [p]: parseInt(e.target.value.replace(/\D/g,'') || '0', 10) } })} className="w-28 text-right border border-gray-200 rounded-lg px-2 py-1 text-sm" />
            </div>
          ))}
        </div>
      </Section>

      <Section title="직급별 직책수당">
        <div className="p-3 text-[11px] text-gray-400">직책수당은 영업활동 지원금과 별도로 가산돼요. 실적으로 직책수당만큼 다시 채울 필요가 없어요.</div>
        <div className="p-3 pt-0 grid grid-cols-2 gap-2">
          {POSITIONS.map((p) => (
            <div key={p} className="flex items-center justify-between gap-2">
              <span className="text-sm text-gray-600">{p}</span>
              <input type="text" inputMode="numeric" value={fmtInputNumber(draft.positionAllowance?.[p] || 0)} onChange={(e) => setDraftCfg({ ...draft, positionAllowance: { ...draft.positionAllowance, [p]: parseInt(e.target.value.replace(/\D/g,'') || '0', 10) } })} className="w-28 text-right border border-gray-200 rounded-lg px-2 py-1 text-sm" />
            </div>
          ))}
        </div>
      </Section>

      <Section title="영업 활동 지원 정책" defaultOpen>
        <div className="px-4 py-3 bg-gray-50 text-[11px] text-gray-500 leading-relaxed">
          대상 실적은 <b>HS · SIM MNP · 2ND</b>입니다. 6개월 미만은 실적과 무관하게 고정 지급하고,
          이후 구간은 건당 금액을 누적하되 영업 활동 지원 정책 지급액은 MAX를 넘지 않습니다.
        </div>
        <div className="divide-y divide-gray-50">
          {(draft.tenure||[]).map((t,i)=><div key={t.key} className="flex items-center justify-between px-4 py-2.5 gap-3">
            <div>
              <div className="text-sm text-gray-700">{t.label}</div>
              {t.key==='under6'&&<div className="text-[10px] text-gray-400">실적 무관 고정 지급</div>}
            </div>
            {t.key==='under6' ? (
              <div className="text-sm font-bold text-gray-700">{won(draft.tenureCap||DEFAULT_ACTIVITY_SUPPORT_MAX)}</div>
            ) : (
              <div className="flex items-center gap-1">
                <input type="text" inputMode="numeric" value={fmtInputNumber(t.rate)}
                  onChange={(e)=>updateFlatTable('tenure',i,'rate',parseInt(e.target.value.replace(/\D/g,'')||'0',10))}
                  className="w-24 text-right border border-gray-200 rounded px-1.5 py-1 text-sm"/>
                <span className="text-xs text-gray-400">원/건</span>
              </div>
            )}
          </div>)}
          <div className="flex items-center justify-between px-4 py-3 gap-3 bg-violet-50/40">
            <div><div className="text-sm font-semibold text-gray-700">영업 활동 지원 정책 MAX</div><div className="text-[10px] text-gray-400">6개월 미만 고정 지급액도 이 금액을 사용합니다.</div></div>
            <div className="flex items-center gap-1">
              <input type="text" inputMode="numeric" value={fmtInputNumber(draft.tenureCap||DEFAULT_ACTIVITY_SUPPORT_MAX)}
                onChange={(e)=>setDraftCfg({...draft,tenureCap:parseInt(e.target.value.replace(/\D/g,'')||'0',10)})}
                className="w-28 text-right border border-gray-200 rounded px-2 py-1 text-sm bg-white"/>
              <span className="text-xs text-gray-400">원</span>
            </div>
          </div>
        </div>
      </Section>

      <Section title="최저 보장 비교 기준">
        <div className="p-4 text-xs text-gray-600 leading-relaxed space-y-2">
          <div><b>비교 대상</b> · 영업 활동 지원 정책 + 요금제 + VAS + 2ND + 승인된 모바일 스팟 + 특판·지인판매 대체 인센티브 + 직책수당</div>
          <div><b>비교 제외</b> · 성과등급 보너스 + 홈 관련 수수료 + 소노 + 중고MNP 결합 + 고객등록 + 맞춤제안</div>
          <div className="text-gray-400">비교 대상 합계가 직급별 최저 보장금액보다 낮으면 해당 직급의 최저 보장금액으로 보정한 뒤, 비교 제외 항목을 추가합니다.</div>
        </div>
      </Section>
      <RateTable title="성과등급 보너스" group="grades" data={draft.grades} updateFlatTable={updateFlatTable} field="bonus" labelKey="grade" extraField="min" />
      <RateTable title="홈 그레이드 (누적건수별)" group="homeTiers" data={draft.homeTiers} updateFlatTable={updateFlatTable} field="rate" labelKey="min" labelSuffix="건 이상" />
      <RateTable title="홈 단독 / TV프리 / 스마트홈" group="homeFlat" data={draft.homeFlat} updateFlatTable={updateFlatTable} field="rate" />
      <RateTable title="동시판매 수수료" group="homeAddon" data={draft.homeAddon} updateFlatTable={updateFlatTable} field="rate" />
      <RateTable title="인터넷 재약정" group="renew" data={draft.renew} updateFlatTable={updateFlatTable} field="rate" />
      <RateTable title="VAS" group="vas" data={draft.vas} updateFlatTable={updateFlatTable} field="rate" />
      <RateTable title="2ND 번들" group="bundle2nd" data={draft.bundle2nd} updateFlatTable={updateFlatTable} field="rate" />
      <RateTable title="소노" group="sono" data={draft.sono} updateFlatTable={updateFlatTable} field="rate" />
      <RateTable title="중고MNP 결합" group="mnpBundle" data={draft.mnpBundle} updateFlatTable={updateFlatTable} field="rate" />
      <RateTable title="고객등록 구간 보너스" group="custRegTiers" data={draft.custRegTiers} updateFlatTable={updateFlatTable} field="bonus" labelKey="min" labelSuffix="건 이상" />
      <RateTable title="맞춤제안 구간 보너스" group="tailoredTiers" data={draft.tailoredTiers} updateFlatTable={updateFlatTable} field="bonus" labelKey="min" labelSuffix="건 이상" />

      <Section title="요금제 유치 수수료">
        <div className="overflow-x-auto p-2">
          <table className="text-xs">
            <thead><tr><th className="p-1 text-left sticky left-0 bg-white">가입구분</th>{MATRIX_COLS.map((c) => <th key={c} className="p-1 text-gray-400"><ColHeader label={c} /></th>)}</tr></thead>
            <tbody>
              {MATRIX_ROW_DEFS.map((rowDef, ri) => (
                <tr key={rowDef.label} className="border-t border-gray-50">
                  <td className="p-1 whitespace-nowrap sticky left-0 bg-white">{rowDef.label}</td>
                  {rowDef.hasTiers ? (
                    MATRIX_COLS.map((c, ci) => (
                      <td key={c} className="p-1">
                        <input type="number" value={draft.matrix[ri][ci]} onChange={(e) => updateMatrix(ri, ci, parseInt(e.target.value || '0', 10))} className="w-16 text-center border border-gray-200 rounded px-1 py-1" />
                      </td>
                    ))
                  ) : (
                    <td className="p-1" colSpan={MATRIX_COLS.length}>
                      <div className="flex items-center gap-1.5">
                        <input type="number" value={draft.matrix[ri][0]} onChange={(e) => updateMatrix(ri, 0, parseInt(e.target.value || '0', 10))} className="w-24 text-right border border-gray-200 rounded px-1.5 py-1" />
                        <span className="text-gray-400">원 / 건 (요금제군 구분 없음)</span>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <button onClick={save} className="px-4 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold">지급 기준 저장</button>
    </div>
  );
}

function RateTable({ title, group, data, updateFlatTable, field, labelKey, labelSuffix, extraField }) {
  return (
    <Section title={title}>
      <div className="divide-y divide-gray-50">
        {data.map((t, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-2.5 gap-2">
            <span className="text-sm text-gray-700">{labelKey ? `${t[labelKey]}${labelSuffix || ''}` : t.label}</span>
            <div className="flex items-center gap-1">
              {extraField && (
                <input type="number" value={t[extraField]} onChange={(e) => updateFlatTable(group, i, extraField, parseFloat(e.target.value || '0'))} className="w-16 text-right border border-gray-200 rounded px-1.5 py-1 text-xs" title={extraField} />
              )}
              <input type="text" inputMode="numeric" value={fmtInputNumber(t[field])} onChange={(e) => updateFlatTable(group, i, field, parseInt(e.target.value.replace(/\D/g,'') || '0', 10))} className="w-24 text-right border border-gray-200 rounded px-1.5 py-1 text-sm" />
              <span className="text-xs text-gray-400">원</span>
            </div>
          </div>
        ))}
      </div>
    </Section>
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
