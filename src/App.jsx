import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Trophy, Home, ClipboardList, History, TrendingUp, Users, ChevronDown, Plus,
  Minus, Award, Loader2, Check, Settings, LayoutDashboard, Wallet, Trash2,
  UserPlus, Info, Layers, Calendar, ChevronLeft, ChevronRight, AlertTriangle, Zap,
  UploadCloud, X, Target, ShieldCheck, LogOut, Bell, ClipboardCheck
} from 'lucide-react';
import { supabase } from './supabase';
import { friendlyError } from './errorMessages';
import PendingApprovals from './PendingApprovals';
import ProfileEditRequests, { ProfileEditRequestForm } from './ProfileEditRequests';
import {
  SECOND_PERFORMANCE_POINT, allowedSecondVas, secondPerformancePoints,
  summarizeVasQuality, homeOrdersForMonth, homeBundleCount,
  mergeSaleMetaPreservingLegacy,
} from './policyRules';

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

/* v21.26: 2ND 번들별 일반/무료판매 구분. 무료판매는 실적/KPI 인정, 번들+해당 VAS 인센티브 제외. */

/* v21.32 DATA SAFETY
   - UI 버전과 저장 데이터 버전을 분리
   - 구버전 source_meta를 현재 UI 형식으로 읽음
   - 수정 시 기존 source_meta 필드를 보존한 채 현재 필드만 병합
   - DB audit trigger와 함께 원본 변경 이력을 보존
*/
const CURRENT_SALE_SCHEMA_VERSION = 3;

function saleSchemaVersion(sale){
  return Number(sale?.schema_version || sale?.source_meta?.schemaVersion || 1);
}
function withCurrentSaleSchema(meta={}){
  return {...(meta||{}), schemaVersion:CURRENT_SALE_SCHEMA_VERSION};
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
    if(item.tvUpsell&&!item.homeOnly&&c.tvPay>0)counts.renewTvUpsell=(counts.renewTvUpsell||0)+1;
    soloDiscount+=c.soloDiscount;
  });
  return {counts,soloDiscount};
}
function emptyHouseholdRenewForm(){
  return {customer:'',speed:'1g',plan:'premiumSafe',homeOnly:false,hsSimul:false,tvUpsell:false,downSpeed:false,temporaryUpgradeSame:false};
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
function computePay(draft, position, hireDate, month, config, mobileSpotPay = 0) {
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
  const bundle2ndActivityCount = Object.values(draft.bundle2nd || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  const activityCount = baseActivityCount + bundle2ndActivityCount;

  const supportCap = Number(config.tenureCap ?? DEFAULT_ACTIVITY_SUPPORT_MAX);
  // 6개월 미만: 실적 무관 230만원
  // 6~12개월: 건당 20만원 / 12~24개월: 15만원 / 24개월 이상: 10만원, 공통 MAX 230만원
  const tenurePay = months < 6
    ? supportCap
    : Math.min(Number(bucket?.rate || 0) * activityCount, supportCap);

  // 2ND 성과등급P는 단독/번들 구분 없이 동일하게 인정합니다.
  // 단독은 mobilePoint.secondOnly에 포함되고, 번들은 bundle2nd에 별도 저장되므로
  // 번들 건수에 현재 2ND 성과등급 배점을 곱해 추가합니다. 무료판매도 실적은 인정됩니다.
  const secondPointRate = Number(mobileItems.find((item) => item.key === 'secondOnly')?.point || 0);
  const bundle2ndPoints = secondPerformancePoints({bundleCounts:draft.bundle2nd||{}}) * (secondPointRate / SECOND_PERFORMANCE_POINT);
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

  const matrixTotal = (draft.matrix || []).reduce(
    (sum, row, ri) => sum + (row || []).reduce((rs, cnt, ci) => rs + Number(cnt || 0) * Number(config.matrix?.[ri]?.[ci] || 0), 0),
    0
  );
  const specialMatrixOffset = Number(draft.specialMatrixOffset || 0);
  const specialVasOffset = Number(draft.specialVasOffset || 0);
  const specialReplacementPay = Number(draft.specialReplacementPay || 0);
  const adjustedMatrixTotal = Math.max(0, matrixTotal - specialMatrixOffset);

  const rawBundle2ndTotal = sumFlat(draft.bundle2nd || {}, config.bundle2nd || []);
  const bundleFreeOffset = Number(draft.bundleFreeOffset || 0);
  const bundleFreeVasOffset = Number(draft.bundleFreeVasOffset || 0);
  const bundle2ndTotal = Math.max(0, rawBundle2ndTotal - bundleFreeOffset);

  const homeAnyCount = Number(draft.homeBase?.homeOnly || 0) + Number(draft.homeBase?.homeTv || 0)
    + Number(draft.homeFlat?.home1GBOnly || 0) + Number(draft.homeFlat?.home500Only || 0) + Number(draft.homeFlat?.home100Only || 0)
    + Number(draft.homeFlat?.tvFree || 0) + Number(draft.homeFlat?.smartHome || 0);
  const homeNoPerformance = homeAnyCount === 0;
  const penaltyFactor = homeNoPerformance ? 0.5 : 1;

  const rawVasPay = sumFlat(draft.vas || {}, config.vas || []);
  const vasPay = Math.max(0, rawVasPay - specialVasOffset - bundleFreeVasOffset);

  const positionAllowance = Number(config.positionAllowance?.[position] || 0);
  const activityPenalty = draft.activityTimeMet ? 0 : Number(config.basePenalty || 0);
  const minimumGuarantee = Math.max(0, Number(config.basePay?.[position] || 0) - activityPenalty);

  // 최저보장 비교 대상:
  // 영업 활동 지원 정책 + 요금제 + VAS + 2ND + 모바일 승인 스팟 + 직책수당
  // 특판·지인판매 대체 인센티브는 요금제/VAS 대체 성격이므로 모바일 비교 대상에 포함합니다.
  const mobilePlanPay = adjustedMatrixTotal * penaltyFactor;
  const bundle2ndPay = bundle2ndTotal * penaltyFactor;
  const mobileMatrixPay = mobilePlanPay + bundle2ndPay;
  const approvedMobileSpotPay = Math.max(0, Number(mobileSpotPay || 0));
  const mobileGuaranteeBasis = tenurePay
    + mobileMatrixPay
    + vasPay
    + approvedMobileSpotPay
    + specialReplacementPay
    + positionAllowance;

  const guaranteedComponent = Math.max(minimumGuarantee, mobileGuaranteeBasis);

  // 최저보장 비교 후 별도로 추가되는 항목
  // v21.63: 고객별 home_orders가 있으면 새 홈 정책으로 재계산하고,
  // 구버전 집계만 존재하면 기존 계산을 fallback으로 유지합니다.
  const legacyHomeGradeQualCount = Number(draft.homeBase?.homeTv || 0);
  const legacyHomeTierCount = Number(draft.homeBase?.homeOnly || 0) + Number(draft.homeBase?.homeTv || 0)
    + Number(draft.homeFlat?.home1GBOnly || 0) + Number(draft.homeFlat?.home500Only || 0) + Number(draft.homeFlat?.home100Only || 0);
  const homePolicy = draft.homePolicy?.source==='orders' ? draft.homePolicy : null;
  const homeCaseCount = homePolicy ? Number(homePolicy.totalInternetCount||0) : legacyHomeTierCount;
  const homeGradePay = homePolicy ? Number(homePolicy.gradePay||0) : homeGradeTotal(legacyHomeTierCount, legacyHomeGradeQualCount, config.homeTiers);
  const homeFlatPay = homePolicy ? Number(homePolicy.homeFlatPay||0) : sumFlat(draft.homeFlat || {}, config.homeFlat || []);
  const tvFreeRate = config.homeFlat.find((t) => t.key === 'tvFree')?.rate || 0;
  const smartHomeRate = config.homeFlat.find((t) => t.key === 'smartHome')?.rate || 0;
  const tvFreePay = homePolicy ? Number(homePolicy.tvFreePay||0) : Number(draft.homeFlat?.tvFree || 0) * tvFreeRate;
  const smartHomePay = homePolicy ? Number(homePolicy.smartHomePay||0) : Number(draft.homeFlat?.smartHome || 0) * smartHomeRate;
  const homeAddonPay = homePolicy ? Number(homePolicy.homeAddonPay||0) : sumFlat(draft.homeAddon || {}, config.homeAddon || []);
  const renewPay = Math.max(0, sumFlat(draft.renew || {}, config.renew || []) - Number(draft.renewSoloDiscountAmount || 0));
  const mnpBundlePay = sumFlat(draft.mnpBundle || {}, config.mnpBundle || []);
  const sonoPay = sumFlat(draft.sono || {}, config.sono || []);
  const custRegBonus = tierBonus(Number(draft.custRegCount || 0), config.custRegTiers);
  const tailoredBonus = tierBonus(Number(draft.tailoredCount || 0), config.tailoredTiers);
  const tailoredAmountBonus = Number(draft.tailoredAmount || 0);

  const postGuaranteeExtras = gradeBonus + homeGradePay + homeFlatPay + homeAddonPay + renewPay
    + mnpBundlePay + sonoPay + custRegBonus + tailoredBonus + tailoredAmountBonus;

  // 직원 홈 메인: 최저보정 없이 지금까지 실제로 만들어진 금액
  const currentPerformanceAmount = mobileGuaranteeBasis + postGuaranteeExtras;
  // 현재까지 실적을 그대로 마감한다고 가정한 금액
  const closingAmount = guaranteedComponent + postGuaranteeExtras;
  const total = closingAmount;

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
    mnpBundlePay, sonoPay, custRegBonus, tailoredBonus, tailoredAmountBonus, kpiScore, total,
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
  const [prevMonthTotal, setPrevMonthTotal] = useState(null); // 홈 화면 "전월 대비" 표시용
  const [personalGoals, setPersonalGoals] = useState({}); // 본인 월 항목별 목표
  const [goalSaving, setGoalSaving] = useState(false);
  const [approvedMobileSpotMap, setApprovedMobileSpotMap] = useState({}); // { empId: approved mobile spot total }
  const [homePolicyMap, setHomePolicyMap] = useState({}); // { empId: 새 홈 정책 계산 결과 }

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
        setConfig({ ...defaultConfig(), ...data.value, vas: mergeDefaultVas(data.value.vas) });
      } else {
        const def = defaultConfig();
        await supabase.from('app_config').upsert({ config_key: 'config', value: def }, { onConflict: 'config_key' });
        setConfig(def);
      }
    } catch (e) { console.error('CONFIG LOAD ERROR:', e); setConfig(defaultConfig()); }
  }, []);

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
      mapped[id]=completed.length?calculateHomePolicyFromOrders(userOrders,config):null;
    });
    setHomePolicyMap(mapped);
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
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.id]);
  useEffect(() => { if (employees.length) { loadMonth(month, employees); loadDaily(month, employees); loadHomePolicies(month, employees); } }, [month]); // eslint-disable-line
  // 홈 고객별 저장/수정으로 일일 실적이 바뀌면 새 정책 금액도 다시 계산합니다.
  useEffect(() => { if (employees.length) loadHomePolicies(month, employees); }, [dailyRecords]); // eslint-disable-line

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
    if (lockedMonths.includes(month)) return;
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
    const pay = computePay(mergedDraft, e.position, e.hireDate, month, config, approvedMobileSpotMap[e.id]||0);
    return { ...e, status: rec.status, pay, draft: mergedDraft, updatedAt: rec.updatedAt };
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
  const myPay = computePay(myMergedDraft, currentEmp?.position || '사원', currentEmp?.hireDate, month, config, approvedMobileSpotMap[empId]||0);
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
              <div className="font-bold text-gray-900 leading-tight">미소 인센티브</div>
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
          monthLocked={lockedMonths.includes(month)} toggleMonthLock={toggleMonthLock}
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
  const live={};['hs','home','mnp','simMnp','subTvHousehold','tvFree','smartHome','otherCustomer','tailoredAmount','daemyung','prospectMnp'].forEach(k=>live[k]=storeRows.reduce((s,r)=>s+managerActualFromDraft(r.draft,k),0));
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
  const totalHsTarget=stores.reduce((sum,storeName)=>sum+Number(goalMap[storeName]?.hs||0),0);
  const share=totalHsTarget>0?storeHsTarget/totalHsTarget:0;
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
  const verifiedAt=snap?.verified_at?new Date(snap.verified_at).toLocaleString('ko-KR'):'미확인';
  const setVerified=(key,val)=>setSnap(v=>({...v,verified_metrics:{...(v.verified_metrics||{}),[key]:Number(val||0)}}));
  const setExt=(key,val)=>setSnap(v=>({...v,external_inputs:{...(v.external_inputs||{}),[key]:val}}));
  const saveSnapshot=async()=>{setSaving(true);const payload={month,store_name:activeStore,verified_metrics:{...live,...(snap.verified_metrics||{})},external_inputs:{...(snap.external_inputs||{})},verified_by:authUserId,verified_at:new Date().toISOString()};const {error}=await supabase.from('manager_eval_monthly').upsert(payload,{onConflict:'month,store_name'});setSaving(false);if(error)return showLegacyAlert(friendlyError(error));setSnap(payload);};
  const saveAa=async()=>{setSaving(true);const {error}=await supabase.from('aa_impact_monthly').upsert({month,metrics:aaConfig,updated_by:authUserId},{onConflict:'month'});setSaving(false);if(error)return showLegacyAlert(friendlyError(error));showLegacyAlert('AA임팩트 월 목표를 저장했어요.');};
  return <div className="space-y-3">
    <div className={`grid gap-2 ${canSwitchStores?'grid-cols-2':'grid-cols-1'}`}><button onClick={()=>setManagerMode('dashboard')} className={`py-2 rounded-xl text-xs font-bold ${managerMode==='dashboard'?'bg-violet-600 text-white':'bg-white border text-gray-500'}`}>평가 현황</button>{canSwitchStores&&<button onClick={()=>setManagerMode('settings')} className={`py-2 rounded-xl text-xs font-bold ${managerMode==='settings'?'bg-violet-600 text-white':'bg-white border text-gray-500'}`}>목표·실적 최신화</button>}</div>
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
    </>:<>
      <div className="bg-white rounded-2xl border p-4"><div className="flex justify-between"><div><div className="text-sm font-bold">실적 최신화</div><div className="text-[10px] text-gray-400 mt-1">직원 입력 누적과 관리자 확인값을 비교하고, 평가에는 관리자 확인값을 우선 사용합니다.</div></div><button onClick={saveSnapshot} disabled={saving} className="px-3 py-2 rounded-xl bg-violet-600 text-white text-xs font-bold h-fit">{saving?'저장중':'최신화 완료'}</button></div><div className="mt-3 space-y-2">{[['HS','hs'],['홈','home'],['생산성','productivity'],['MNP','mnp'],['SIM MNP','simMnp'],['TV부셋탑(가정망)','subTvHousehold'],['TV프리(부)','tvFree'],['스마트홈','smartHome'],['타사 고객 등록','otherCustomer'],['맞춤제안 매출액','tailoredAmount'],['대명','daemyung'],['MNP 타사 가망 개통','prospectMnp']].map(([l,k])=><div key={k} className="grid grid-cols-[1fr_70px_90px] gap-2 items-center"><div className="text-xs text-gray-600">{l}</div><div className="text-[10px] text-gray-400 text-right">입력 {k==='tailoredAmount'?won(live[k]):fmtNum(live[k],1)}</div><input type="number" value={verified[k]??live[k]??0} onChange={e=>setVerified(k,e.target.value)} className="border rounded-lg px-2 py-1.5 text-xs text-right"/></div>)}</div></div>
      <div className="bg-white rounded-2xl border p-4"><div className="text-sm font-bold">AA임팩트 외부 평가값</div><div className="grid grid-cols-2 gap-2 mt-3">{[['NPS 점수','npsScore'],['불친절 건수','unkindCount'],['대외민원 건수','complaintCount'],['정보보호 점수','securityScore'],['U+one 무체험률(%)','noExperienceRate']].map(([l,k])=><label key={k} className="text-[10px] text-gray-500">{l}<input type="number" value={ext[k]??''} onChange={e=>setExt(k,e.target.value)} className="w-full mt-1 border rounded-lg px-2 py-2 text-xs"/></label>)}<label className="text-[10px] text-gray-500">매장 레벨링<select value={ext.leveling||''} onChange={e=>setExt('leveling',e.target.value)} className="w-full mt-1 border rounded-lg px-2 py-2 text-xs"><option value="">미입력</option><option value="4">Lv4</option><option value="below4">Lv4 미만</option></select></label><label className="text-[10px] text-gray-500 flex items-center gap-2 mt-4"><input type="checkbox" checked={!!ext.privacyViolation} onChange={e=>setExt('privacyViolation',e.target.checked)}/> 개인정보보호위원회 적발</label><div className="col-span-2 text-[10px] text-gray-400 bg-gray-50 rounded-lg p-2">대명 목표 {daemyungTarget}건 · MNP 타사 가망 목표 {prospectTarget}건은 회사 목표(37건/21건)를 HS 기준수량 비중으로 자동 배분해 달성 여부를 판단합니다.</div></div></div>
      <div className="bg-white rounded-2xl border p-4"><div className="flex justify-between"><div><div className="text-sm font-bold">{monthLabel(month)} AA임팩트 회사 목표</div><div className="text-[10px] text-gray-400">회사 목표 입력 후 관리자 → 회사 목표의 매장별 HS 기준수량 비중으로 자동 배분합니다. 반영비중 합계는 100점으로 환산하고 항목별 110%까지 인정합니다.</div></div><button onClick={saveAa} className="px-3 py-2 rounded-xl bg-gray-900 text-white text-xs font-bold h-fit">목표 저장</button></div><div className="space-y-2 mt-3">{aaConfig.map((x,i)=><div key={x.key} className="grid grid-cols-[1fr_55px_90px] gap-2 items-center"><input value={x.label} onChange={e=>setAaConfig(v=>v.map((a,j)=>j===i?{...a,label:e.target.value}:a))} className="border rounded-lg px-2 py-1.5 text-xs"/><input type="number" value={x.weight} onChange={e=>setAaConfig(v=>v.map((a,j)=>j===i?{...a,weight:Number(e.target.value||0)}:a))} className="border rounded-lg px-2 py-1.5 text-xs text-right"/><input type="number" value={x.target} onChange={e=>setAaConfig(v=>v.map((a,j)=>j===i?{...a,target:Number(e.target.value||0)}:a))} className="border rounded-lg px-2 py-1.5 text-xs text-right"/></div>)}</div></div>
    </>}
  </div>;
}


function qualityPct(n,d){return d>0?Number((Number(n||0)/d*100).toFixed(1)):0}
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

  const {insurance,strategicVas}=summarizeVasQuality(mobile);
  const revenuePoints=strategicPlan*.5+insurance*.8+strategicVas*1+Number(sonoCount||0)*2;
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
  if(!branch || !members.length)return <div className="bg-white rounded-2xl border border-gray-100 p-4 text-sm text-gray-400">현재 매장 실적을 불러올 수 없어요.</div>;

  const sum=(fn)=>members.reduce((a,r)=>a+Number(fn(r)||0),0);
  const goal=companyGoalDefaults(branch);

  const metrics=[
    {
      key:'hs', label:'HS', unit:'건',
      current:sum(r=>hsCount(r.draft)),
      target:Number(goal.hs||0)
    },
    {
      key:'home', label:'홈', unit:'건',
      current:sum(r=>(r.draft?.homeBase?.homeOnly||0)+(r.draft?.homeBase?.homeTv||0)),
      target:Number(goal.home||0)
    },
    {
      key:'free', label:'프리', unit:'건',
      current:sum(r=>r.draft?.homeFlat?.tvFree||0),
      target:Number(goal.tvFree||goal.free||0)
    },
    {
      key:'smart', label:'스홈', unit:'건',
      current:sum(r=>r.draft?.homeFlat?.smartHome||0),
      target:Number(goal.smartHome||goal.smart||0)
    },
    {
      key:'tailored', label:'맞춤제안', unit:'건',
      current:sum(r=>r.draft?.tailoredCount||0),
      target:Number(goal.tailoredCount||goal.tailored||0)
    },
    {
      key:'productivity', label:'생산성', unit:'P',
      current:sum(r=>r.pay?.kpiScore||0),
      target:Number(goal.productivity||0)
    },
  ];

  const fmtValue=(m,v)=>{
    if(m.unit==='P')return `${fmtNum(Number(v||0),1)}P`;
    return `${fmtCount(v)}건`;
  };

  return <div className="space-y-4">
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-50">
        <div className="text-xs text-gray-400">📊 {monthLabel(month)}</div>
        <div className="text-sm font-bold text-gray-900 mt-0.5">{displayStoreName(branch)} 매장 목표 현황</div>
        <div className="text-[10px] text-gray-400 mt-1">매장 누적 실적과 목표 달성률을 한 번에 확인해요.</div>
      </div>

      <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
        {metrics.map(m=>{
          const hasGoal=Number(m.target||0)>0;
          const pct=hasGoal?Math.max(0,Math.round(Number(m.current||0)/Number(m.target||1)*100)):null;
          const barPct=hasGoal?Math.min(100,pct):0;
          const achieved=hasGoal&&Number(m.current||0)>=Number(m.target||0);

          return <div key={m.key} className="rounded-xl bg-gray-50 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="text-[10px] text-gray-500">{m.label}</div>
              {hasGoal&&<div className={`text-[9px] font-semibold ${achieved?'text-emerald-600':'text-violet-600'}`}>{pct}%</div>}
            </div>

            <div className="text-base font-bold text-gray-900 mt-1">{fmtValue(m,m.current)}</div>

            {hasGoal ? <>
              <div className="text-[9px] text-gray-400 mt-0.5">목표 {fmtValue(m,m.target)}</div>
              <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden mt-2">
                <div className={`h-full rounded-full ${achieved?'bg-emerald-500':'bg-violet-500'}`} style={{width:`${barPct}%`}} />
              </div>
            </> : (
              <div className="text-[9px] text-gray-300 mt-1">목표 미설정</div>
            )}
          </div>;
        })}
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
  [[20,'hs_m20'],[30,'hs_m30'],[40,'hs_m40'],[50,'hs_m50'],[60,'hs_m60'],[70,'hs_m70'],[80,'hs_m80'],[100,'hs_m100']].forEach(([v,k])=>{if(hs>=v)earned.add(k)});
  [[1,'home_first'],[5,'home_m5'],[10,'home_m10'],[15,'home_m15'],[20,'home_m20']].forEach(([v,k])=>{if(home>=v)earned.add(k)});
  [[1,'free_first'],[5,'free_m5'],[10,'free_m10']].forEach(([v,k])=>{if(free>=v)earned.add(k)});
  [[1,'smart_first'],[5,'smart_m5'],[10,'smart_m10']].forEach(([v,k])=>{if(smart>=v)earned.add(k)});
  [[1,'upsell_first'],[5,'upsell_m5'],[10,'upsell_m10'],[20,'upsell_m20']].forEach(([v,k])=>{if(upsell>=v)earned.add(k)});
  [[1,'second_first'],[5,'second_m5'],[10,'second_m10'],[20,'second_m20']].forEach(([v,k])=>{if(second>=v)earned.add(k)});
  [[100,'prod_100'],[120,'prod_120'],[150,'prod_150'],[200,'prod_200']].forEach(([v,k])=>{if(prod>=v)earned.add(k)});
  if(pay?.grade==='S'&&pay?.gradeEligible)earned.add('grade_s');

  const rank=(key)=>{
    const m=MONTHLY_RANK_METRICS.find(x=>x.key===key); if(!m)return null;
    const rows=[...(competitionRows||[])].filter(r=>!NON_SALES_STORES.includes(r.branch));
    const me=rows.find(r=>r.id===userId); if(!me||Number(m.value(me)||0)<=0)return null;
    return 1+rows.filter(r=>Number(m.value(r)||0)>Number(m.value(me)||0)).length;
  };
  const hr=rank('hs'), homer=rank('home'), freer=rank('free'), smartr=rank('smart'), pr=rank('productivity'), ur=rank('upsell');
  if(hr&&hr<=10)earned.add('hs_top10'); if(hr&&hr<=5)earned.add('hs_top5');
  if(hr===3)earned.add('hs_rank3'); if(hr===2)earned.add('hs_rank2'); if(hr===1)earned.add('hs_rank1');
  if(homer===1)earned.add('home_rank1'); if(freer===1)earned.add('free_rank1'); if(smartr===1)earned.add('smart_rank1');
  if(pr===1)earned.add('prod_rank1'); if(ur===1)earned.add('upsell_rank1');
  if(hr&&hr<=3&&homer&&homer<=3&&pr&&pr<=3)earned.add('all_top3');
  if(hr===1&&homer===1&&pr===1)earned.add('grand_slam');

  // v21.75 자동 배지
  // 올라운드 세일즈: 앱에서 객관적으로 확인 가능한 핵심 판매 카테고리를 모두 경험
  if(hs>0&&home>0&&free>0&&smart>0&&second>0)earned.add('special_team');

  // 미소 MVP: HS/홈/생산성 순위 합이 가장 낮은 직원 1명 (동률은 HS→홈→생산성 순)
  {
    const active=[...(competitionRows||[])].filter(r=>!NON_SALES_STORES.includes(r.branch));
    const rankOf=(metric,row)=>{
      const vals=active.map(x=>Number(metric.value(x)||0));
      const mine=Number(metric.value(row)||0);
      return mine>0 ? 1+vals.filter(v=>v>mine).length : active.length+1;
    };
    const hm=MONTHLY_RANK_METRICS.find(x=>x.key==='hs');
    const hom=MONTHLY_RANK_METRICS.find(x=>x.key==='home');
    const pm=MONTHLY_RANK_METRICS.find(x=>x.key==='productivity');
    if(hm&&hom&&pm&&active.length){
      const ranked=active.map(r=>({r,score:rankOf(hm,r)+rankOf(hom,r)+rankOf(pm,r),hs:Number(hm.value(r)||0),home:Number(hom.value(r)||0),prod:Number(pm.value(r)||0)}))
        .filter(x=>x.hs>0)
        .sort((a,b)=>a.score-b.score||b.hs-a.hs||b.home-a.home||b.prod-a.prod);
      if(ranked[0]?.r?.id===userId)earned.add('special_mvp');
    }
  }

  let firstHalfHs=0,secondHalfHs=0,firstHalfDays=0,secondHalfDays=0;
  Object.entries(dailyDays||{}).forEach(([dayKey,raw])=>{
    const d=normalizeDay(raw);
    const dhs=[0,1,2,3,4].reduce((z,ri)=>z+(d.matrix?.[ri]||[]).reduce((a,v)=>a+Number(v||0),0),0);
    if(dhs>=5)earned.add('day_hs5'); if(dhs>=8)earned.add('day_hs8'); if(dhs>=10)earned.add('day_hs10');
    const dayNum=Number(String(dayKey).slice(-2))||Number(dayKey)||0;
    if(dayNum>=1&&dayNum<=15){firstHalfHs+=dhs;firstHalfDays++;}
    else if(dayNum>=16){secondHalfHs+=dhs;secondHalfDays++;}
  });
  const firstPace=firstHalfDays?firstHalfHs/firstHalfDays:0, secondPace=secondHalfDays?secondHalfHs/secondHalfDays:0;
  if(firstHalfHs>0&&secondHalfHs>0&&secondPace>=firstPace*1.3)earned.add('special_pick');
  const actuals=getPersonalGoalActuals(mergedDraft,pay);
  const tg=Number(personalGoals?.tailored||0);
  if(tg>0&&actuals.tailored>=tg)earned.add('upsell_goal100');
  if(tg>0&&actuals.tailored>=tg*1.5)earned.add('upsell_goal150');
  return earned;
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
              <div className="text-xs text-violet-600 font-medium mt-0.5">{item.title}</div>
              {item.branch && <div className="text-[10px] text-gray-400 mt-0.5 truncate">{displayStoreName(item.branch)}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GamificationHub({dailyDays,month,personalGoals,mergedDraft,pay,competitionRows,userId,currentEmp}) {
  const [storedBadges,setStoredBadges]=useState([]);
  const [titleKey,setTitleKey]=useState('');
  const [loadingBadges,setLoadingBadges]=useState(true);
  const [showCollection,setShowCollection]=useState(false);
  const [filter,setFilter]=useState('all');
  const [avatarUrl,setAvatarUrl]=useState('');
  const [avatarBusy,setAvatarBusy]=useState(false);
  const [celebration,setCelebration]=useState(null);
  const autoEarned=useMemo(()=>evaluateAutomaticBadges({dailyDays,month,personalGoals,mergedDraft,pay,competitionRows,userId}),[dailyDays,month,personalGoals,mergedDraft,pay,competitionRows,userId]);
  const earnedKeys=useMemo(()=>{const x=new Set(storedBadges.map(r=>r.badge_key));autoEarned.forEach(k=>x.add(k));return x},[storedBadges,autoEarned]);
  const loadBadges=useCallback(async()=>{
    if(!userId)return; setLoadingBadges(true);
    const [{data:rows},{data:title}]=await Promise.all([
      supabase.from('user_achievements').select('badge_key,earned_at,awarded_by,note').eq('user_id',userId).order('earned_at'),
      supabase.from('user_titles').select('badge_key').eq('user_id',userId).maybeSingle()
    ]);
    setStoredBadges(rows||[]); setTitleKey(title?.badge_key||''); setLoadingBadges(false);
  },[userId]);
  useEffect(()=>{loadBadges()},[loadBadges]);
  useEffect(()=>{
    if(!userId||loadingBadges)return;
    const have=new Set(storedBadges.map(r=>r.badge_key)); const missing=[...autoEarned].filter(k=>!have.has(k));
    if(!missing.length)return;
    const first=badgeDefOf(missing[0]);
    const onceKey=`miso-celebration-badge-${userId}-${missing[0]}`;
    if(first&&!localStorage.getItem(onceKey)){localStorage.setItem(onceKey,'1');setCelebration({icon:first.icon,title:'새로운 배지 획득!',message:first.name})}
    (async()=>{for(const key of missing)await supabase.from('user_achievements').insert({user_id:userId,badge_key:key,awarded_by:null});await loadBadges()})();
  },[autoEarned,storedBadges,loadingBadges,userId,loadBadges]);
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
  const saveTitle=async(key)=>{if(!earnedKeys.has(key))return;const {error}=await supabase.from('user_titles').upsert({user_id:userId,badge_key:key,updated_at:new Date().toISOString()},{onConflict:'user_id'});if(!error)setTitleKey(key)};
  const titleDef=badgeDefOf(titleKey);
  const visible=BADGE_DEFS.filter(b=>filter==='earned'?earnedKeys.has(b.key):filter==='locked'?!earnedKeys.has(b.key):filter==='legend'?b.rarity==='LEGEND':true);
  const earnedRow=storedBadges.find(r=>r.badge_key===titleKey);

  useEffect(()=>{
    if(!userId)return;
    let alive=true,objectUrl='';
    (async()=>{
      const {data}=await supabase.from('profiles').select('avatar_path').eq('id',userId).maybeSingle();
      const path=data?.avatar_path||'';
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
    const {error:updateError}=await supabase.from('profiles').update({avatar_path:path,updated_at:new Date().toISOString()}).eq('id',userId);
    if(updateError){setAvatarBusy(false);return showAppToast(friendlyError(updateError),{tone:'error',title:'프로필 저장 실패'})}
    const {data:downloaded}=await supabase.storage.from('profile-avatars').download(path);
    if(downloaded){if(avatarUrl)URL.revokeObjectURL(avatarUrl);setAvatarUrl(URL.createObjectURL(downloaded))}
    setAvatarBusy(false);showAppToast('프로필 사진을 등록했어요.');
  };

  return <>
    {celebration&&<div className="fixed inset-0 z-[118] bg-black/45 flex items-center justify-center p-5" onClick={()=>setCelebration(null)}>
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white p-6 text-center shadow-2xl" onClick={e=>e.stopPropagation()}>
        <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-violet-100 to-transparent" />
        <div className="relative text-5xl">{celebration.icon}</div><div className="relative mt-3 text-xl font-black text-gray-900">{celebration.title}</div><div className="relative mt-2 text-sm text-gray-500">{celebration.message}</div>
        <div className="relative mt-4 flex justify-center gap-2">{['●','◆','●','◆','●'].map((x,i)=><span key={i} className={`${i%2?'text-amber-400':'text-violet-400'} animate-bounce`} style={{animationDelay:`${i*80}ms`}}>{x}</span>)}</div>
        <button onClick={()=>setCelebration(null)} className="relative mt-5 w-full rounded-xl bg-violet-600 py-3 text-sm font-bold text-white">좋아요!</button>
      </div>
    </div>}
    <div className="w-full rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white p-4">
      <div className="flex items-start gap-3">
        <label className="relative w-14 h-14 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0 overflow-hidden cursor-pointer" aria-label="프로필 사진 등록">
          {avatarUrl?<img src={avatarUrl} alt="내 프로필" className="w-full h-full object-cover"/>:<span className="text-xl font-bold">{String(currentEmp?.name||'나').slice(0,1)}</span>}
          <span className="absolute inset-x-0 bottom-0 py-0.5 bg-black/45 text-[8px] text-center">{avatarBusy?'저장 중':'사진'}</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadAvatar} disabled={avatarBusy} className="hidden"/>
        </label>
        <div className="min-w-0 flex-1">
          <div className="text-base font-bold truncate">{currentEmp?.name||'직원'}님, 오늘도 응원해요</div>
          <div className="text-[10px] text-violet-100 mt-0.5 truncate">{displayStoreName(currentEmp?.branch||'')} · {currentEmp?.position||'사원'}</div>
          <button type="button" onClick={()=>setShowCollection(true)} className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 border border-white/20 text-[10px] font-bold">
            <span>{titleDef?.icon||'🏅'}</span><span>{titleDef?.name||'대표 배지 선택'}</span><span className="text-violet-100">›</span>
          </button>
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-white/15">
        <div className="text-[9px] text-violet-100/75">오늘의 응원</div>
        <div className="text-sm font-bold leading-relaxed mt-1">“{dailyEncouragement(userId)}”</div>
      </div>
      <div className="flex justify-between mt-3 text-[9px] text-violet-100/75"><span>대표 배지는 획득한 배지 중 선택할 수 있어요.</span><span>{fmtCount(earnedKeys.size)} / 100</span></div>
    </div>

    {showCollection&&<div className="fixed inset-0 z-[90] bg-black/40 flex items-end sm:items-center justify-center" onClick={()=>setShowCollection(false)}>
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[88vh] overflow-hidden" onClick={e=>e.stopPropagation()}>
        <div className="p-4 border-b"><div className="flex justify-between items-center"><div><div className="text-lg font-bold">내 배지 {fmtCount(earnedKeys.size)} / 100</div><div className="text-[10px] text-gray-400">획득한 배지를 대표 배지로 선택할 수 있어요.</div></div><button onClick={()=>setShowCollection(false)} className="text-gray-400">✕</button></div>
          <div className="flex gap-1.5 mt-3 overflow-x-auto">{[['all','전체'],['earned','획득'],['locked','미획득'],['legend','LEGEND']].map(([k,l])=><button key={k} onClick={()=>setFilter(k)} className={`px-3 py-1.5 rounded-full text-[10px] font-semibold ${filter===k?'bg-violet-600 text-white':'bg-gray-100 text-gray-500'}`}>{l}</button>)}</div>
        </div>
        <div className="p-3 grid grid-cols-2 gap-2 overflow-y-auto max-h-[70vh]">
          {visible.map(b=>{const got=earnedKeys.has(b.key);const row=storedBadges.find(r=>r.badge_key===b.key);return <button key={b.key} disabled={!got} onClick={()=>got&&saveTitle(b.key)} className={`rounded-2xl border p-3 text-left ${got?(titleKey===b.key?'border-violet-300 bg-violet-50 ring-1 ring-violet-100':'border-gray-100 bg-white'):'border-gray-100 bg-gray-50 opacity-55'}`}>
            <div className="flex justify-between"><span className="text-2xl">{got?b.icon:'🔒'}</span><span className="text-[8px] font-bold text-gray-400">{b.rarity}</span></div>
            <div className="text-xs font-bold text-gray-800 mt-2">{b.name}</div><div className="text-[10px] text-gray-500 mt-1 leading-tight">{b.desc}</div>
            {got&&<div className="text-[9px] text-violet-500 mt-2">{titleKey===b.key?'대표 배지 사용 중':row?.earned_at?`${fmtShortDate(row.earned_at)} 획득 · 대표로 설정`:'대표로 설정'}</div>}
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
      <div className="bg-white rounded-xl border border-violet-100 p-4">
        <div className="text-xs text-violet-500">관리자가 직접 전하는 인정</div>
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
          className="w-full mt-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-bold disabled:opacity-50"
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
const HOME_ORDER_PRODUCTS = [
  { key: 'homeOnly', label: '홈 단독' },
  { key: 'homeTv', label: '홈+TV 동시청약' },
  { key: 'internet1g', label: '인터넷 1GB' },
  { key: 'internet500', label: '인터넷 500MB' },
  { key: 'internet100', label: '인터넷 100MB' },
  { key: 'tvFree', label: 'TV프리(부)' },
  { key: 'smartHome', label: '스마트홈' },
  { key: 'subSetTop', label: 'TV부셋탑' },
  { key: 'simulNewChange', label: '홈 + HS 신규/기변 동시판매' },
  { key: 'simulMnp', label: '홈 + HS MNP 동시판매' },
  { key: 'simulUsedMnp', label: '홈 + 중고MNP 동시판매' },
];

function homeOrderMeta(groupKey, itemKey) {
  const map = {
    'homeBase.homeOnly': { productType: 'homeOnly', label: '홈 단독' },
    'homeBase.homeTv': { productType: 'homeTv', label: '홈+TV 동시청약' },
    'homeFlat.tvFree': { productType: 'tvFree', label: 'TV프리(부)' },
    'homeFlat.smartHome': { productType: 'smartHome', label: '스마트홈' },
  };
  return map[`${groupKey}.${itemKey}`] || null;
}



function HomeOrderManager({ userId, month, locked, dailyDays, saveDailyDay }) {
  const [orders, setOrders] = useState([]);
  const [product, setProduct] = useState('homeOnly');
  const [customerName, setCustomerName] = useState('');
  const [memo, setMemo] = useState('');
  const [directComplete, setDirectComplete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [homeCompletionTarget, setHomeCompletionTarget] = useState(null);
  const [homeActualCompleteDate, setHomeActualCompleteDate] = useState('');
  // v21.23: 홈 케어 화면에서 설치예정일을 바로 수정
  const [homeScheduleTarget, setHomeScheduleTarget] = useState(null);
  const [homeScheduleDate, setHomeScheduleDate] = useState('');
  const [homeCareActionSaving, setHomeCareActionSaving] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    const start = `${month}-01T00:00:00`;
    const d = new Date(`${month}-01T00:00:00`);
    d.setMonth(d.getMonth() + 1);
    const end = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01T00:00:00`;
    const { data, error } = await supabase.from('home_orders').select('*')
      .eq('user_id', userId).gte('applied_at', start).lt('applied_at', end)
      .order('applied_at', { ascending: false });
    if (!error) setOrders(data || []);
  }, [userId, month]);

  useEffect(() => { load(); }, [load]);


  const changeStatus = async (order, status) => {
    if (locked) return;
    if (status === 'completed') {
      const t = new Date();
      setHomeCompletionTarget(order);
      setHomeActualCompleteDate(`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`);
      return;
    }
    if (!await showAppConfirm({title:'홈 청약을 취소할까요?',message:'취소 건은 실적 요약과 정산 대상에서 제외됩니다.',confirmLabel:'취소 처리',tone:'danger'})) return;
    const now = new Date().toISOString();
    const { error } = await supabase.from('home_orders').update({
      status:'cancelled', cancelled_at:now, updated_at:now
    }).eq('id',order.id).eq('user_id',userId);
    if (error) return showLegacyAlert(`상태 변경 실패: ${friendlyError(error)}`);
    const productLabel=HOME_ORDER_PRODUCTS.find(p=>p.key===order.product_type)?.label||order.product_type;
    notifyStoreManagers({actorId:userId,type:'home_cancelled',title:'홈 청약 취소',
      message:`${order.customer_name ? `${order.customer_name} · ` : ''}${homeNetworkLabel(order.network_type)} · ${productLabel}`,
      payload:{order_id:order.id,product_type:order.product_type,network_type:order.network_type,status:'cancelled'}});
    await load();
  };

  const confirmCompletion = async () => {
    const order=homeCompletionTarget;
    if (!order || !homeActualCompleteDate || locked) return;
    const [y,m,d]=homeActualCompleteDate.split('-');
    const completionMonth=`${y}-${m}`;
    const completionDay=d;

    if (order.source_group && order.source_key) {
      if (completionMonth === month) {
        const base=normalizeDay(dailyDays?.[completionDay]);
        const current=Number(base.groups?.[order.source_group]?.[order.source_key]||0);
        const next={...base,groups:{...base.groups,[order.source_group]:{
          ...(base.groups?.[order.source_group]||{}),[order.source_key]:current+1}}};
        const ok=await saveDailyDay(completionDay,next);
        if (!ok) return showLegacyAlert('확정 실적 반영에 실패했어요. 다시 시도해주세요.');
      } else {
        const completionWorkDate = `${completionMonth}-${completionDay}`;
        const { data: rec, error: loadError } = await supabase
          .from('daily_records')
          .select('data')
          .eq('user_id', userId)
          .eq('work_date', completionWorkDate)
          .maybeSingle();

        if (loadError) {
          return showLegacyAlert(`완료일 실적 불러오기 실패: ${friendlyError(loadError)}`);
        }

        const base = normalizeDay(rec?.data);
        const current = Number(base.groups?.[order.source_group]?.[order.source_key] || 0);
        const next = {
          ...base,
          groups: {
            ...base.groups,
            [order.source_group]: {
              ...(base.groups?.[order.source_group] || {}),
              [order.source_key]: current + 1,
            },
          },
        };

        const { error: de } = await supabase
          .from('daily_records')
          .upsert(
            {
              user_id: userId,
              work_date: completionWorkDate,
              data: next,
            },
            { onConflict: 'user_id,work_date' }
          );

        if (de) return showLegacyAlert(`확정 실적 반영 실패: ${friendlyError(de)}`);
      }
    }

    const completedAt=new Date(`${homeActualCompleteDate}T12:00:00`).toISOString();
    const {error}=await supabase.from('home_orders').update({
      status:'completed',completed_at:completedAt,actual_install_date:homeActualCompleteDate,updated_at:new Date().toISOString()
    }).eq('id',order.id).eq('user_id',userId);
    if(error)return showLegacyAlert(`완료 처리 실패: ${friendlyError(error)}`);

    const productLabel=HOME_ORDER_PRODUCTS.find(p=>p.key===order.product_type)?.label||order.product_type;
    notifyStoreManagers({actorId:userId,type:'home_completed',title:'홈 설치/개통 완료',
      message:`${order.customer_name ? `${order.customer_name} · ` : ''}${homeNetworkLabel(order.network_type)} · ${productLabel} · ${homeActualCompleteDate}`,
      payload:{order_id:order.id,product_type:order.product_type,network_type:order.network_type,status:'completed',actual_install_date:homeActualCompleteDate}});
    setHomeCompletionTarget(null); setHomeActualCompleteDate(''); await load();
  };

  const openScheduleEdit = (order) => {
    if (locked) return;
    setHomeScheduleTarget(order);
    setHomeScheduleDate(order.planned_install_date ? String(order.planned_install_date).slice(0,10) : '');
  };

  const saveScheduleEdit = async () => {
    const order=homeScheduleTarget;
    if(!order || locked) return;
    setHomeCareActionSaving(true);
    try{
      // 같은 판매일/고객의 진행중 홈 구성은 한 고객 판매 묶음으로 보고 일정도 같이 변경
      let q=supabase.from('home_orders').update({
        planned_install_date:homeScheduleDate||null,
        updated_at:new Date().toISOString()
      }).eq('user_id',userId).eq('status','pending');

      if(order.customer_id) q=q.eq('customer_id',order.customer_id);
      else q=q.eq('customer_name',order.customer_name||'');

      if(order.source_work_date) q=q.eq('source_work_date',order.source_work_date);
      else q=q.eq('id',order.id);

      const {error}=await q;
      if(error)throw error;
      setHomeScheduleTarget(null);
      setHomeScheduleDate('');
      await load();
    }catch(e){
      showLegacyAlert(`설치 예정일 수정 실패: ${friendlyError(e)}`);
    }finally{
      setHomeCareActionSaving(false);
    }
  };

  const decrementCompletedPerformance = async (order) => {
    if(!order?.source_group || !order?.source_key || !order?.actual_install_date) return;
    const completedDate=String(order.actual_install_date).slice(0,10);
    const completedMonth=completedDate.slice(0,7);
    const completedDay=completedDate.slice(8,10);

    if(completedMonth===month){
      const base=normalizeDay(dailyDays?.[completedDay]);
      const current=Number(base.groups?.[order.source_group]?.[order.source_key]||0);
      const next={...base,groups:{...base.groups,[order.source_group]:{
        ...(base.groups?.[order.source_group]||{}),
        [order.source_key]:Math.max(0,current-1)
      }}};
      const ok=await saveDailyDay(completedDay,next);
      if(!ok) throw new Error('확정 실적 원복에 실패했어요.');
      return;
    }

    const {data:rec,error:loadError}=await supabase.from('daily_records')
      .select('data').eq('user_id',userId).eq('work_date',completedDate).maybeSingle();
    if(loadError) throw loadError;
    const base=normalizeDay(rec?.data);
    const current=Number(base.groups?.[order.source_group]?.[order.source_key]||0);
    const next={...base,groups:{...base.groups,[order.source_group]:{
      ...(base.groups?.[order.source_group]||{}),
      [order.source_key]:Math.max(0,current-1)
    }}};
    const {error}=await supabase.from('daily_records').upsert({
      user_id:userId,work_date:completedDate,data:next
    },{onConflict:'user_id,work_date'});
    if(error)throw error;
  };

  const undoHomeStatus = async (order) => {
    if(locked || !order || !['completed','cancelled'].includes(order.status)) return;
    const isCompleted=order.status==='completed';
    const msg=isCompleted
      ? '완료 처리를 취소하고 다시 진행중으로 돌릴까요?\n완료일에 반영된 확정 실적도 함께 원복됩니다.'
      : '취소 처리를 되돌리고 다시 진행중으로 돌릴까요?';
    if(!await showAppConfirm({title:isCompleted?'완료 처리를 되돌릴까요?':'취소 처리를 되돌릴까요?',message:msg,confirmLabel:'진행중으로 변경'}))return;

    setHomeCareActionSaving(true);
    try{
      if(isCompleted) await decrementCompletedPerformance(order);
      const {error}=await supabase.from('home_orders').update({
        status:'pending',
        completed_at:null,
        actual_install_date:null,
        cancelled_at:null,
        updated_at:new Date().toISOString()
      }).eq('id',order.id).eq('user_id',userId);
      if(error)throw error;
      await load();
    }catch(e){
      showLegacyAlert(`상태 되돌리기 실패: ${friendlyError(e)}`);
    }finally{
      setHomeCareActionSaving(false);
    }
  };

  const careInfo = (o) => {
    const p=o.planned_install_date ? String(o.planned_install_date).slice(0,10) : null;
    if(!p)return {rank:3,label:'일정 미정',cls:'text-gray-500 bg-gray-50'};
    const now=new Date(), a=new Date(now.getFullYear(),now.getMonth(),now.getDate()), b=new Date(`${p}T00:00:00`);
    const diff=Math.round((b-a)/86400000);
    if(diff<0)return {rank:0,label:`확인 필요 · ${Math.abs(diff)}일 경과`,cls:'text-red-600 bg-red-50'};
    if(diff===0)return {rank:1,label:'오늘 설치 예정',cls:'text-orange-600 bg-orange-50'};
    return {rank:2,label:`${diff}일 후 설치 예정`,cls:'text-violet-600 bg-violet-50'};
  };

  const pending = orders.filter(o => o.status === 'pending').sort((a,b)=>careInfo(a).rank-careInfo(b).rank || String(a.planned_install_date||'9999').localeCompare(String(b.planned_install_date||'9999')));
  const completed = orders.filter(o => o.status === 'completed');
  const cancelled = orders.filter(o => o.status === 'cancelled');

  return (
    <div className="space-y-3 mb-4">
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="text-xs text-gray-400">이번 달 진행 현황</div>
        <div className="text-sm font-bold text-gray-900 mt-0.5">
          진행중 {fmtCount(pending.length)} · 완료 {fmtCount(completed.length)} · 취소 {fmtCount(cancelled.length)}
        </div>
        {pending.length ? (
          <div className="mt-3 space-y-4">
            {Object.entries(
              pending.reduce((acc, o) => {
                const day = o.source_work_date
                  ? new Date(`${o.source_work_date}T12:00:00`).toLocaleDateString('ko-KR')
                  : new Date(o.applied_at).toLocaleDateString('ko-KR');
                const customer = o.customer_name || '고객명 미입력';
                const key = `${day}__${customer}`;
                if (!acc[key]) acc[key] = { day, customer, items: [] };
                acc[key].items.push(o);
                return acc;
              }, {})
            ).map(([key, group]) => (
              <div key={key}>
                <div className="text-[11px] font-semibold text-gray-400 mb-1.5">{group.day}</div>
                <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="text-sm font-bold text-gray-900">{group.customer} 고객</div>
                    <span className="text-[10px] font-bold text-amber-600">{fmtCount(group.items.length)}개 진행중</span>
                  </div>
                  <div className="space-y-2">
                    {group.items.map(o => {
                      const def = HOME_ORDER_PRODUCTS.find(p => p.key === o.product_type);
                      return (
                        <div key={o.id} className="bg-white/80 rounded-lg p-2.5">
                          <div className="flex justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <div className="text-xs font-semibold text-gray-800">{def?.label || o.product_type}</div>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                  o.network_type==='soho'?'bg-blue-50 text-blue-600':
                                  o.network_type==='household'?'bg-violet-50 text-violet-600':'bg-gray-100 text-gray-400'
                                }`}>{homeNetworkLabel(o.network_type)}</span>
                              </div>
                              {o.memo && <div className="text-[11px] text-gray-400 mt-0.5">{o.memo}</div>}
                              <div className="text-[10px] text-gray-400 mt-1">설치예정 {o.planned_install_date ? String(o.planned_install_date).slice(0,10) : '미정'}</div>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${careInfo(o).cls}`}>{careInfo(o).label}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 mt-2">
                            <button type="button" disabled={locked||homeCareActionSaving} onClick={()=>openScheduleEdit(o)}
                              className="py-2 rounded-lg bg-violet-50 border border-violet-100 text-violet-700 text-xs font-semibold disabled:opacity-50">일정 수정</button>
                            <button type="button" disabled={locked||homeCareActionSaving} onClick={()=>changeStatus(o,'completed')}
                              className="py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold disabled:opacity-50">설치/개통 완료</button>
                            <button type="button" disabled={locked||homeCareActionSaving} onClick={()=>changeStatus(o,'cancelled')}
                              className="py-2 rounded-lg bg-white border border-gray-200 text-gray-500 text-xs font-semibold disabled:opacity-50">취소</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : <div className="mt-3 rounded-xl bg-gray-50 py-4 text-center text-xs text-gray-400">현재 케어할 진행중 청약이 없어요.</div>}
        {(completed.length>0 || cancelled.length>0) && (
          <details className="mt-3">
            <summary className="text-xs font-semibold text-violet-600 cursor-pointer">완료·취소 내역 보기</summary>
            <div className="mt-2 space-y-1.5">
              {[...completed,...cancelled].sort((a,b)=>new Date(b.applied_at)-new Date(a.applied_at)).map(o=>{
                const def=HOME_ORDER_PRODUCTS.find(p=>p.key===o.product_type);
                return <div key={o.id} className="rounded-lg bg-gray-50 px-3 py-2">
                  <div className="flex justify-between gap-2 items-start">
                    <div>
                      <div className="text-xs font-semibold text-gray-700">{o.customer_name ? `${o.customer_name} · ` : ''}{homeNetworkLabel(o.network_type)} · {def?.label || o.product_type}</div>
                      {(o.status==='completed' || o.status==='cancelled')&&<div className="text-[10px] text-gray-400 mt-0.5 leading-none">
                        {o.status==='completed'
                          ? `완료일 ${fmtShortDate(o.actual_install_date || o.completed_at)}`
                          : `취소일 ${fmtShortDate(o.cancelled_at) || '기록 없음'}`}
                      </div>}
                    </div>
                    <span className={`text-[10px] font-bold ${o.status==='completed'?'text-emerald-600':'text-gray-400'}`}>{o.status==='completed'?'완료':'취소'}</span>
                  </div>
                  <div className="flex justify-end mt-2">
                    <button type="button" disabled={locked||homeCareActionSaving} onClick={()=>undoHomeStatus(o)}
                      className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-[10px] font-semibold text-violet-600 disabled:opacity-50">
                      진행중으로 되돌리기
                    </button>
                  </div>
                </div>
              })}
            </div>
          </details>
        )}
      </div>
      <div className="text-[11px] text-gray-400 px-1">
        확정 실적은 실제 설치/개통 완료일 기준으로 반영돼요.
      </div>
      {homeScheduleTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl">
            <div className="text-xs text-violet-600 font-semibold">설치 예정일 수정</div>
            <div className="text-lg font-bold text-gray-900 mt-1">
              {homeScheduleTarget.customer_name || '고객'} · {homeNetworkLabel(homeScheduleTarget.network_type)}
            </div>
            <div className="text-[11px] text-gray-400 mt-1">같은 고객의 같은 판매일 홈 구성 일정이 함께 변경됩니다.</div>
            <label className="block text-xs font-semibold text-gray-500 mt-4 mb-1.5">설치 예정일</label>
            <input type="date" value={homeScheduleDate} onChange={(e)=>setHomeScheduleDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm" />
            <button type="button" onClick={()=>setHomeScheduleDate('')}
              className="mt-2 text-[11px] font-semibold text-gray-400">일정 미정으로 변경</button>
            <div className="grid grid-cols-2 gap-2 mt-5">
              <button onClick={()=>{setHomeScheduleTarget(null);setHomeScheduleDate('');}} disabled={homeCareActionSaving}
                className="py-2.5 rounded-xl bg-gray-100 text-gray-500 text-sm font-semibold disabled:opacity-50">닫기</button>
              <button onClick={saveScheduleEdit} disabled={homeCareActionSaving}
                className="py-2.5 rounded-xl bg-violet-600 text-white text-sm font-bold disabled:opacity-50">
                {homeCareActionSaving?'저장 중...':'일정 저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {homeCompletionTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl">
            <div className="text-xs text-emerald-600 font-semibold">설치/개통 완료</div>
            <div className="text-lg font-bold text-gray-900 mt-1">
              {homeCompletionTarget.customer_name || '고객'} · {homeNetworkLabel(homeCompletionTarget.network_type)} · {HOME_ORDER_PRODUCTS.find(p=>p.key===homeCompletionTarget.product_type)?.label || homeCompletionTarget.product_type}
            </div>
            <label className="block text-xs font-semibold text-gray-500 mt-4 mb-1.5">실제 설치/개통 완료일 *</label>
            <input type="date" value={homeActualCompleteDate} onChange={(e)=>setHomeActualCompleteDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm" />
            <div className="text-[11px] text-gray-400 mt-2">선택한 실제 완료일의 확정 실적으로 반영됩니다.</div>
            <div className="grid grid-cols-2 gap-2 mt-5">
              <button onClick={()=>{setHomeCompletionTarget(null);setHomeActualCompleteDate('');}}
                className="py-2.5 rounded-xl bg-gray-100 text-gray-500 text-sm font-semibold">닫기</button>
              <button onClick={confirmCompletion} disabled={!homeActualCompleteDate}
                className="py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold disabled:opacity-50">완료 처리</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
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
        () => loadUnread()
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
    const { error } = await supabase
      .from('notifications')
      .update({
        read: true,
        read_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('recipient_id', userId);

    if (!error) {
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    }
  };

  const markAllRead = async () => {
    const { error } = await supabase
      .from('notifications')
      .update({
        read: true,
        read_at: new Date().toISOString(),
      })
      .eq('recipient_id', userId)
      .eq('read', false);

    if (!error) {
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  };

  const unreadCount = items.filter((n) => !n.read).length;

  const iconFor = (type) => {
    if (type === 'home_order') return '🏠';
    if (type === 'home_completed') return '✅';
    if (type === 'home_cancelled') return '⚠️';
    if (type === 'daily_input') return '📈';
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
            className="text-xs font-semibold text-violet-600"
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
                  n.read ? 'bg-white' : 'bg-violet-50/60'
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
                      <span className="w-2 h-2 rounded-full bg-violet-500 shrink-0" />
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

async function notifyStoreManagers({ actorId, type, title, message, payload = {} }) {
  if (!actorId) return;

  try {
    const { data: actor, error: actorError } = await supabase
      .from('profiles')
      .select('id, name, store_name')
      .eq('id', actorId)
      .maybeSingle();

    if (actorError || !actor?.store_name) return;

    const { data: managers, error: managersError } = await supabase
      .from('profiles')
      .select('id')
      .eq('store_name', actor.store_name)
      .eq('active', true)
      .eq('status', 'approved')
      .in('position', ['점장', '부점장']);

    if (managersError || !managers?.length) return;

    const rows = managers
      .filter((m) => m.id !== actorId)
      .map((m) => ({
        recipient_id: m.id,
        actor_id: actorId,
        type,
        title,
        message,
        payload,
      }));

    if (!rows.length) return;

    const { error } = await supabase.from('notifications').insert(rows);
    if (error) console.error('NOTIFICATION INSERT ERROR:', error);
  } catch (e) {
    console.error('NOTIFICATION ERROR:', e);
  }
}

async function notifyEmployee({actorId,recipientId,type,title,message,payload={}}){
  if(!actorId||!recipientId)return;
  const {error}=await supabase.from('notifications').insert({recipient_id:recipientId,actor_id:actorId,type,title,message,payload});
  if(error)console.error('EMPLOYEE NOTIFICATION ERROR',error);
}


/* ===================== v16: 매장 목표 / 영업비용 / 스팟 정책 ===================== */

const COMPANY_STORE_GOAL_BASE = [
  { match:['삼미시장2호','삼미2'], hs:63, home:6, productivity:78.8, tvFree:5, smartHome:3 },
  { match:['삼미시장','삼미'], hs:102, home:10, productivity:127.5, tvFree:8, smartHome:5 },
  { match:['상록수역','상록'], hs:100, home:10, productivity:123, tvFree:8, smartHome:5 },
  { match:['롯데마트','대야'], hs:52, home:5, productivity:65, tvFree:4, smartHome:3 },
  { match:['주민센터','주민'], hs:70, home:7, productivity:82, tvFree:6, smartHome:4 },
  { match:['장곡역','장곡'], hs:54, home:6, productivity:67.5, tvFree:5, smartHome:3 },
  { match:['도일시장','거모'], hs:100, home:10, productivity:123, tvFree:8, smartHome:5 },
  { match:['월곶'], hs:64, home:7, productivity:80, tvFree:5, smartHome:3 },
  { match:['성포역','성포'], hs:37, home:4, productivity:46.3, tvFree:3, smartHome:2 },
  { match:['산본'], hs:129, home:13, productivity:161.3, tvFree:9, smartHome:5 },
  { match:['법조타운','법조','범조'], hs:39, home:4, productivity:48.8, tvFree:3, smartHome:2 },
  { match:['은계사거리','은계'], hs:41, home:4, productivity:51.3, tvFree:3, smartHome:2 },
  { match:['본오중학교','본오'], hs:41, home:4, productivity:51.3, tvFree:3, smartHome:2 },
];

function companyGoalDefaults(storeName){
  const raw=String(storeName||'');
  const shown=displayStoreName(raw);
  const hit=COMPANY_STORE_GOAL_BASE.find(x=>x.match.some(k=>raw.includes(k)||shown.includes(k)));
  if(!hit)return {};
  return {
    hs:hit.hs,
    home:hit.home,
    productivity:hit.productivity,
    tvFree:hit.tvFree,
    smartHome:hit.smartHome,
    tailoredCount:Math.ceil(Number(hit.hs||0)*0.5),
  };
}

const STORE_GOAL_METRICS = [
  { key:'hs', label:'HS' },
  { key:'home', label:'홈' },
  { key:'productivity', label:'생산성' },
  { key:'tvFree', label:'TV프리(부)' },
  { key:'smartHome', label:'스마트홈' },
  { key:'tailoredCount', label:'맞춤제안 업셀 건수' },
];

function storeGoalCurrent(mergedDraft, pay, key) {
  if (key === 'hs') return hsCount(mergedDraft);
  if (key === 'home') return Number(mergedDraft?.homeBase?.homeOnly||0)+Number(mergedDraft?.homeBase?.homeTv||0);
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
      <span className="text-xs text-violet-600 font-semibold">{open?'접기':'진행률 보기'}</span>
    </button>
    {open&&<div className="px-4 pb-4 space-y-3">
      {STORE_GOAL_METRICS.map(m=>{
        const cur=storeGoalCurrent(mergedDraft,pay,m.key), c=Number(company[m.key]||0), ch=Number(challenge[m.key]||c||0);
        if(!c&&!ch)return null;
        const pct=ch?Math.min(100,cur/ch*100):0;
        return <div key={m.key}>
          <div className="flex justify-between text-xs"><span className="font-medium text-gray-700">{m.label}</span><span className="text-gray-500">{Number.isInteger(cur)?fmtCount(cur):fmtNum(cur,1)} / <b>{fmtNum(ch,1)}</b></span></div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden mt-1"><div className="h-full bg-violet-500 rounded-full" style={{width:`${pct}%`}} /></div>
          <div className="text-[10px] mt-1 text-gray-400">{c&&cur>=c?'✅ 회사 기준 달성':`회사 기준 ${c||'-'}`} · 도전 {ch||'-'}</div>
        </div>
      })}
    </div>}
  </div>;
}

function SalesExpensePanel({ userId, month, onTotal }) {
  const [items,setItems]=useState([]), [open,setOpen]=useState(false);
  const [form,setForm]=useState({amount:'',category:'케이스',customer_name:'',expense_date:`${month}-01`,memo:''});
  const load=useCallback(async()=>{
    if(!userId)return;
    const {data}=await supabase.from('sales_expenses').select('*').eq('user_id',userId).gte('expense_date',`${month}-01`).lt('expense_date',(()=>{const [y,m]=month.split('-').map(Number);const d=new Date(y,m,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`})()).order('expense_date',{ascending:false});
    const rows=data||[];setItems(rows);onTotal?.(rows.reduce((s,x)=>s+Number(x.amount||0),0));
  },[userId,month,onTotal]);
  useEffect(()=>{load()},[load]);
  useEffect(()=>setForm(f=>({...f,expense_date:`${month}-${String(new Date().getDate()).padStart(2,'0')}`})),[month]);
  const add=async()=>{
    const amount=Number(form.amount); if(!amount||amount<=0)return showAppToast('비용 금액을 입력해주세요.',{tone:'error'});
    const {error}=await supabase.from('sales_expenses').insert({...form,amount,user_id:userId,customer_name:form.customer_name.trim()||null,memo:form.memo.trim()||null});
    if(error)return showAppToast(friendlyError(error),{tone:'error',title:'비용 등록 실패'});
    setForm(f=>({...f,amount:'',customer_name:'',memo:''}));load();
  };
  const remove=async(id)=>{if(!await showAppConfirm({title:'영업비용을 삭제할까요?',message:'삭제하면 이번 달 비용 합계에서도 즉시 빠집니다.',confirmLabel:'비용 삭제',tone:'danger'}))return;await supabase.from('sales_expenses').delete().eq('id',id).eq('user_id',userId);showAppToast('영업비용을 삭제했어요.');load()};
  const total=items.reduce((s,x)=>s+Number(x.amount||0),0);
  return <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
    <button onClick={()=>setOpen(v=>!v)} className="w-full p-4 flex justify-between items-center text-left">
      <div><div className="text-sm font-bold text-gray-800">💳 영업비용</div><div className="text-xs text-gray-400 mt-0.5">이번 달 {won(total)} · 고객명은 선택</div></div>
      <span className="text-xs text-violet-600">{open?'접기':'등록/내역'}</span>
    </button>
    {open&&<div className="px-4 pb-4 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <input type="date" value={form.expense_date} onChange={e=>setForm({...form,expense_date:e.target.value})} className="border rounded-lg px-2 py-2 text-xs"/>
        <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} className="border rounded-lg px-2 py-2 text-xs"><option>케이스</option><option>오퍼</option><option>고객 사은품</option><option>판촉</option><option>기타</option></select>
        <input inputMode="numeric" placeholder="금액" value={fmtInputNumber(form.amount)} onChange={e=>setForm({...form,amount:e.target.value.replace(/\D/g,'')})} className="border rounded-lg px-2 py-2 text-xs"/>
        <input placeholder="고객명 (선택)" value={form.customer_name} onChange={e=>setForm({...form,customer_name:e.target.value})} className="border rounded-lg px-2 py-2 text-xs"/>
      </div>
      <input placeholder="메모 (선택)" value={form.memo} onChange={e=>setForm({...form,memo:e.target.value})} className="w-full border rounded-lg px-2 py-2 text-xs"/>
      <button onClick={add} className="w-full py-2 rounded-lg bg-violet-600 text-white text-xs font-bold">비용 등록</button>
      <div className="divide-y">
        {items.slice(0,20).map(x=><div key={x.id} className="py-2 flex justify-between gap-2 text-xs"><div><b>{x.category}</b> · {x.customer_name||'일반'}<div className="text-[10px] text-gray-400">{x.expense_date}{x.memo?` · ${x.memo}`:''}</div></div><div className="flex items-center gap-2"><b>{won(x.amount)}</b><button onClick={()=>remove(x.id)} className="text-gray-300">삭제</button></div></div>)}
      </div>
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
      <span className="text-xs text-violet-600">{open?'접기':'보기'}</span>
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
          else if(m.key==='home')actual=selectedRows.reduce((s,r)=>s+Number(r.draft?.homeBase?.homeOnly||0)+Number(r.draft?.homeBase?.homeTv||0),0);
          else if(m.key==='productivity')actual=selectedRows.reduce((s,r)=>s+Number(r.pay?.kpiScore||0),0);
          else if(m.key==='tvFree')actual=selectedRows.reduce((s,r)=>s+Number(r.draft?.homeFlat?.tvFree||0),0);
          else if(m.key==='smartHome')actual=selectedRows.reduce((s,r)=>s+Number(r.draft?.homeFlat?.smartHome||0),0);
          else if(m.key==='tailoredCount')actual=selectedRows.reduce((s,r)=>s+Number(r.draft?.tailoredCount||0),0);
          else actual=cur||0;

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
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden mt-1.5">
              <div className="h-full bg-violet-500 rounded-full" style={{width:`${Math.min(100,challengePct)}%`}} />
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

    <button onClick={save} className="w-full py-2.5 rounded-xl bg-violet-600 text-white text-sm font-bold">
      매장 목표 저장
    </button>
  </div>;
}


function SpecialSalePolicyAdmin({ authUserId }) {
  const [rows,setRows]=useState([]),[pending,setPending]=useState([]),[form,setForm]=useState({title:'',start_date:'',end_date:'',replacement_amount:'20000',description:''});
  const load=useCallback(async()=>{
    const {data:p}=await supabase.from('special_sale_policies').select('*').order('created_at',{ascending:false});setRows(p||[]);
    const {data:s}=await supabase.from('customer_sales').select('id,user_id,customer_id,sale_date,metric_label,source_meta').eq('source_type','mobile').order('created_at',{ascending:false}).limit(500);
    const candidates=(s||[]).filter(x=>x.source_meta?.specialPolicy?.exceptionStatus==='pending');
    const uids=[...new Set(candidates.map(x=>x.user_id).filter(Boolean))], cids=[...new Set(candidates.map(x=>x.customer_id).filter(Boolean))];
    let ps=[],cs=[]; if(uids.length){const {data}=await supabase.from('profiles').select('id,name,store_name').in('id',uids);ps=data||[];} if(cids.length){const {data}=await supabase.from('customers').select('id,customer_name').in('id',cids);cs=data||[];}
    const pm=Object.fromEntries(ps.map(x=>[x.id,x])),cm=Object.fromEntries(cs.map(x=>[x.id,x])); setPending(candidates.map(x=>({...x,profiles:pm[x.user_id],customers:cm[x.customer_id]})));
  },[]); useEffect(()=>{load()},[load]);
  const add=async()=>{if(!form.title||!form.start_date||!form.end_date)return showLegacyAlert('정책명과 기간을 입력해주세요.');const {error}=await supabase.from('special_sale_policies').insert({...form,replacement_amount:Number(form.replacement_amount||0),created_by:authUserId});if(error)return showLegacyAlert(friendlyError(error));setForm({title:'',start_date:'',end_date:'',replacement_amount:'20000',description:''});load();};
  const toggle=async(r)=>{await supabase.from('special_sale_policies').update({active:!r.active,updated_at:new Date().toISOString()}).eq('id',r.id);load();};
  const decide=async(sale,approve)=>{const sp=sale.source_meta?.specialPolicy||{},amt=approve?Number(sp.exceptionRequestedAmount||0):Number(sp.replacementAmount||0);const {data:dr,error}=await supabase.from('daily_records').select('data').eq('user_id',sale.user_id).eq('work_date',sale.sale_date).maybeSingle();if(error)return showLegacyAlert(friendlyError(error));const d=normalizeDay(dr?.data);const old=Number(d.specialReplacementPay||0);const next={...d,specialReplacementPay:old+amt};const {error:uErr}=await supabase.from('daily_records').upsert({user_id:sale.user_id,work_date:sale.sale_date,data:next,updated_at:new Date().toISOString()},{onConflict:'user_id,work_date'});if(uErr)return showLegacyAlert(friendlyError(uErr));const meta={...sale.source_meta,specialPolicy:{...sp,exceptionStatus:approve?'approved':'rejected',exceptionApprovedAmount:amt,reviewedBy:authUserId,reviewedAt:new Date().toISOString()}};await supabase.from('customer_sales').update({source_meta:meta}).eq('id',sale.id);await notifyEmployee({actorId:authUserId,recipientId:sale.user_id,type:approve?'special_approved':'special_rejected',title:`특판 예외금액 ${approve?'승인':'처리 완료'}`,message:`${sale.metric_label} · ${won(amt)}`,payload:{sale_id:sale.id,status:approve?'approved':'rejected'}});load();};
  return <div className="space-y-3"><div className="bg-amber-50 border border-amber-100 rounded-xl p-4"><div className="font-bold text-sm">🏷️ 특판·지인판매 정책</div><div className="text-xs text-gray-500 mt-1">최고관리자만 정책을 만들어요. 실적은 인정하고 요금제/VAS 수수료 대신 대체 인센티브를 적용합니다.</div><div className="grid grid-cols-2 gap-2 mt-3"><input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="정책명" className="border rounded p-2 text-xs"/><input value={fmtInputNumber(form.replacement_amount)} onChange={e=>setForm({...form,replacement_amount:e.target.value.replace(/\D/g,'')})} placeholder="건당 대체 지급금액" className="border rounded p-2 text-xs"/><input type="date" value={form.start_date} onChange={e=>setForm({...form,start_date:e.target.value})} className="border rounded p-2 text-xs"/><input type="date" value={form.end_date} onChange={e=>setForm({...form,end_date:e.target.value})} className="border rounded p-2 text-xs"/></div><input value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="설명 (선택)" className="mt-2 w-full border rounded p-2 text-xs"/><button onClick={add} className="mt-2 w-full bg-amber-500 text-white rounded-lg py-2 text-xs font-bold">정책 추가</button><div className="mt-3 divide-y">{rows.map(r=><div key={r.id} className="py-2 flex justify-between text-xs"><div><b>{r.title}</b> · {won(r.replacement_amount)}<div className="text-[10px] text-gray-400">{r.start_date}~{r.end_date}</div></div><button onClick={()=>toggle(r)} className={r.active?'text-emerald-600':'text-gray-400'}>{r.active?'활성':'비활성'}</button></div>)}</div></div><div className="bg-white border rounded-xl overflow-hidden"><div className="px-4 py-3 border-b font-bold text-sm">예외 지급금액 승인 {pending.length}건</div>{pending.length===0?<div className="py-6 text-center text-xs text-gray-400">승인 대기 예외금액이 없어요.</div>:pending.map(x=><div key={x.id} className="p-3 border-b text-xs"><b>{x.profiles?.name||'직원'} · {x.customers?.customer_name||'고객'}</b><div className="mt-1 text-gray-500">{x.metric_label} · 요청 {won(x.source_meta?.specialPolicy?.exceptionRequestedAmount)}</div><div className="grid grid-cols-2 gap-2 mt-2"><button onClick={()=>decide(x,false)} className="py-2 bg-gray-100 rounded">기본금액 적용</button><button onClick={()=>decide(x,true)} className="py-2 bg-amber-500 text-white rounded font-bold">요청금액 승인</button></div></div>)}</div></div>;
}

function SpotAdmin({ authUserId, isFullAdmin }) {
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
    }).eq('id',id);
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
    }).eq('id',id);
    if(error)return showLegacyAlert(`스팟 처리 실패: ${friendlyError(error)}`);
    const claim=claims.find(x=>x.id===id);
    if(claim)await notifyEmployee({actorId:authUserId,recipientId:claim.user_id,type:status==='approved'?'spot_approved':'spot_rejected',title:`스팟 ${status==='approved'?'승인':'반려'}`,message:`${String(edit.title||'스팟')} · ${status==='approved'?won(amount):'반려됨'}`,payload:{claim_id:id,status}});
    load();
  };

  const pendingClaims=claims.filter(c=>c.status==='pending'); const doneClaims=claims.filter(c=>c.status!=='pending');
  return <div className="space-y-3">
    {claimLoadError&&<div className="bg-red-50 border border-red-100 text-red-600 rounded-xl p-3 text-xs">스팟 승인 목록을 불러오지 못했어요: {claimLoadError}</div>}
    <div className="bg-white border rounded-xl overflow-hidden"><div className="px-4 py-3 border-b"><div className="font-bold text-sm">✅ 승인 대기 {pendingClaims.length}건</div><div className="text-xs text-gray-400">대시보드의 스팟 승인 건과 같은 목록이에요.</div></div><div className="divide-y">{pendingClaims.length===0?<div className="py-8 text-center text-xs text-gray-400">현재 승인 대기 스팟이 없어요.</div>:pendingClaims.map(c=>{const x=claimEdits[c.id]||{},direct=!c.policy_id;return <div key={c.id} className="p-4 text-xs"><div className="flex justify-between"><div><b>{c.profiles?.name||'직원'} · {c.profiles?.store_name||''}</b><div className="text-[10px] text-gray-400">{c.claim_date} · {c.customer_name||'고객 없음'} · {direct?'직접 입력':'등록 정책'}</div></div><span className="text-orange-500">확인대기</span></div><div className="space-y-2 mt-3"><input value={x.title||''} onChange={e=>setClaimEdits({...claimEdits,[c.id]:{...x,title:e.target.value}})} placeholder="정책명" className="w-full border rounded p-2"/><input value={x.amount||''} onChange={e=>setClaimEdits({...claimEdits,[c.id]:{...x,amount:e.target.value.replace(/\D/g,'')}})} placeholder="최종 승인 금액" className="w-full border rounded p-2"/><input value={x.memo||''} onChange={e=>setClaimEdits({...claimEdits,[c.id]:{...x,memo:e.target.value}})} placeholder="관리자 메모" className="w-full border rounded p-2"/></div><div className="grid grid-cols-2 gap-2 mt-3"><button onClick={()=>decide(c.id,'rejected')} className="py-2 bg-red-50 text-red-500 rounded">반려</button><button onClick={()=>decide(c.id,'approved')} className="py-2 bg-emerald-600 text-white rounded font-bold">승인</button></div></div>})}</div></div>
    <div className="bg-white border rounded-xl p-4">
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
    </div>

    <div className="bg-white border rounded-xl overflow-hidden">
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
          <div className="grid grid-cols-2 gap-2"><button onClick={()=>setEditingPolicyId(null)} className="py-2 bg-gray-100 rounded">취소</button><button onClick={()=>savePolicy(p.id)} className="py-2 bg-violet-600 text-white rounded font-bold">저장</button></div>
        </div>:<div className="flex justify-between gap-2"><div><b>{p.title} · {won(p.amount)}</b><div className="text-[10px] text-gray-400">{p.start_date} ~ {p.end_date} · {p.active?'활성':'비활성'}</div></div>
          <button onClick={()=>{setEditingPolicyId(p.id);setEditPolicy({...p,amount:String(p.amount||'')})}} className="text-violet-600">수정</button></div>}
      </div>)}</div>
    </div>

    {isFullAdmin&&<SpecialSalePolicyAdmin authUserId={authUserId} />}

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

const CARE_TEMPLATES = [
  { key:'plan93', label:'📱 93일 유지 후 요금제 변경', title:'요금제 변경 안내', retentionDays:93 },
  { key:'addon93', label:'🧾 93일 유지 후 부가서비스 해지', title:'부가서비스 해지 안내', retentionDays:93 },
  { key:'plan183', label:'📱 183일 유지 후 요금제 변경', title:'요금제 변경 안내', retentionDays:183 },
];

function addDaysDate(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + Number(days || 0));
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

async function ensureCustomer(userId, customerName, saleDate) {
  const clean=String(customerName||'').trim();
  if(!userId||!clean)return null;

  const {data:found,error:findError}=await supabase
    .from('customers')
    .select('id')
    .eq('user_id',userId)
    .eq('customer_name',clean)
    .maybeSingle();

  if(findError) throw findError;
  if(found?.id){
    await supabase.from('customers').update({last_sale_date:saleDate,updated_at:new Date().toISOString()}).eq('id',found.id);
    return found.id;
  }

  const {data,error}=await supabase
    .from('customers')
    .insert({user_id:userId,customer_name:clean,first_sale_date:saleDate,last_sale_date:saleDate})
    .select('id')
    .single();

  if(error) throw error;
  return data?.id||null;
}

async function createCustomerSaleAndTasks({
  userId, customerName, saleDate, metricLabel, sourceType='daily',
  templateKeys=[], customTitle='', customDueDate='', note='', sourceMeta=null,
  targetPlan=''
}) {
  const customerId=await ensureCustomer(userId,customerName,saleDate);
  if(!customerId) throw new Error('고객 저장 실패');

  const {data:sale,error:saleError}=await supabase
    .from('customer_sales')
    .insert({
      user_id:userId,customer_id:customerId,sale_date:saleDate,
      metric_label:metricLabel,source_type:sourceType,schema_version:CURRENT_SALE_SCHEMA_VERSION,
      source_meta:withCurrentSaleSchema(sourceMeta)
    })
    .select('id')
    .single();
  if(saleError)throw saleError;

  const rows=[];
  templateKeys.forEach(key=>{
    const t=CARE_TEMPLATES.find(x=>x.key===key);
    if(!t)return;
    rows.push({
      user_id:userId,customer_id:customerId,source_sale_id:sale.id,
      task_type:key,title:t.title,base_date:saleDate,retention_days:t.retentionDays,
      due_date:addDaysDate(saleDate,t.retentionDays),status:'pending',note:note||null,
      target_plan:(key==='plan93'||key==='plan183') ? String(targetPlan||'').trim()||null : null
    });
  });

  if(String(customTitle||'').trim() && customDueDate){
    rows.push({
      user_id:userId,customer_id:customerId,source_sale_id:sale.id,
      task_type:'custom',title:String(customTitle).trim(),base_date:saleDate,
      retention_days:null,due_date:customDueDate,status:'pending',note:note||null
    });
  }

  if(rows.length){
    const {error}=await supabase.from('customer_tasks').insert(rows);
    if(error)throw error;
  }

  return {customerId,saleId:sale.id};
}

function CareTemplatePicker({
  selected, setSelected, customTitle, setCustomTitle, customDueDate, setCustomDueDate, saleDate,
  targetPlan='', setTargetPlan=()=>{}
}) {
  const toggle=(key)=>setSelected(selected.includes(key)?selected.filter(x=>x!==key):[...selected,key]);
  return <div className="space-y-2">
    <div className="text-xs font-semibold text-gray-600">📌 고객 약속 / 유지조건 <span className="font-normal text-gray-400">(선택)</span></div>
    <div className="grid grid-cols-1 gap-1.5">
      {CARE_TEMPLATES.map(t=>{
        const on=selected.includes(t.key);
        return <button key={t.key} type="button" onClick={()=>toggle(t.key)}
          className={`text-left px-3 py-2 rounded-xl border text-xs ${on?'bg-violet-50 border-violet-200 text-violet-700':'bg-white border-gray-100 text-gray-600'}`}>
          <div className="font-semibold">{on?'✓ ':''}{t.label}</div>
          {on&&<div className="text-[10px] mt-0.5 opacity-70">변경 가능일 {addDaysDate(saleDate,t.retentionDays)} · {t.retentionDays===93?'94일째':'184일째'}</div>}
        </button>
      })}
    </div>
    {(selected.includes('plan93')||selected.includes('plan183'))&&(
      <div className="pt-1">
        <div className="text-[11px] font-semibold text-gray-500 mb-1.5">변경 예정 요금제</div>
        <input
          value={targetPlan}
          onChange={e=>setTargetPlan(e.target.value)}
          placeholder="예: 유쓰 55 / 5G 슬림+"
          className="w-full border rounded-lg px-2.5 py-2 text-xs"
        />
        <div className="text-[10px] text-gray-400 mt-1">요금제 종류가 많아 자유롭게 입력해요.</div>
      </div>
    )}
    <div className="grid grid-cols-2 gap-2 pt-1">
      <input value={customTitle} onChange={e=>setCustomTitle(e.target.value)} placeholder="직접 약속 내용" className="border rounded-lg px-2 py-2 text-xs"/>
      <input type="date" value={customDueDate} onChange={e=>setCustomDueDate(e.target.value)} className="border rounded-lg px-2 py-2 text-xs"/>
    </div>
  </div>;
}

function CustomerCareManager({ userId, month, homeProps, navIntent }) {
  const [tasks,setTasks]=useState([]);
  const [customers,setCustomers]=useState([]);
  const [filter,setFilter]=useState('todo');
  const [query,setQuery]=useState('');
  const [loading,setLoading]=useState(true);
  const [rescheduleTask,setRescheduleTask]=useState(null);
  const [rescheduleDate,setRescheduleDate]=useState('');

  const load=useCallback(async()=>{
    if(!userId)return;
    setLoading(true);
    const [{data:t},{data:c}]=await Promise.all([
      supabase.from('customer_tasks').select('*').eq('user_id',userId).order('due_date',{ascending:true}),
      supabase.from('customers').select('*').eq('user_id',userId).order('last_sale_date',{ascending:false})
    ]);
    setTasks(t||[]);setCustomers(c||[]);setLoading(false);
  },[userId]);

  useEffect(()=>{load()},[load]);
  useEffect(()=>{
    if(!navIntent?.type)return;
    if(navIntent.type==='today')setFilter('today');
    if(navIntent.type==='overdue')setFilter('overdue');
    if(navIntent.type==='all')setFilter('all');
    if(navIntent.type==='home')setTimeout(()=>document.getElementById('employee-home-care')?.scrollIntoView({behavior:'smooth',block:'start'}),80);
  },[navIntent]);

  const today=new Date().toISOString().slice(0,10);
  const visibleUntil=addDaysDate(today,7);
  const customerMap=Object.fromEntries(customers.map(c=>[c.id,c]));
  const pending=tasks.filter(t=>t.status!=='completed'&&t.status!=='cancelled');
  const overdue=pending.filter(t=>t.due_date<today);
  const todayTasks=pending.filter(t=>t.due_date===today);
  const next7=pending.filter(t=>t.due_date>=today&&t.due_date<=visibleUntil);
  const allFuture=pending.filter(t=>t.due_date>today);

  const updateTask=async(t,patch)=>{
    const {error}=await supabase.from('customer_tasks')
      .update({...patch,updated_at:new Date().toISOString()})
      .eq('id',t.id).eq('user_id',userId);
    if(error)return showAppToast(friendlyError(error),{tone:'error',title:'고객 약속 수정 실패'});
    load();
  };

  const complete=async(t)=>{
    const name=customerMap[t.customer_id]?.customer_name||'고객';
    if(!await showAppConfirm({title:'고객 약속을 완료할까요?',message:`${name} · ${t.title}\n완료 내역에서 다시 되돌릴 수 있어요.`,confirmLabel:'완료 처리'}))return;
    await updateTask(t,{status:'completed',completed_at:new Date().toISOString()});
  };

  const undoComplete=async(t)=>{
    if(!await showAppConfirm({title:'다시 할 일로 돌릴까요?',message:'완료 표시가 취소되고 고객 약속 목록에 다시 나타납니다.',confirmLabel:'되돌리기'}))return;
    await updateTask(t,{status:'pending',completed_at:null});
  };

  const visible=tasks.filter(t=>{
    const isPending=t.status!=='completed'&&t.status!=='cancelled';
    if(filter==='todo' && !(isPending && t.due_date<=visibleUntil)) return false;
    if(filter==='today' && !(isPending && t.due_date===today)) return false;
    if(filter==='overdue' && !(isPending && t.due_date<today)) return false;
    if(filter==='all' && !isPending) return false;
    if(filter==='done' && t.status!=='completed') return false;
    const name=customerMap[t.customer_id]?.customer_name||'';
    return !query.trim()||name.includes(query.trim())||String(t.title||'').includes(query.trim());
  }).sort((a,b)=>{
    if(filter==='done') return String(b.completed_at||'').localeCompare(String(a.completed_at||''));
    const ao=a.due_date<today?0:a.due_date===today?1:2;
    const bo=b.due_date<today?0:b.due_date===today?1:2;
    return ao-bo || String(a.due_date).localeCompare(String(b.due_date));
  });

  const dLabel=(date)=>{
    const a=new Date(`${today}T00:00:00`),b=new Date(`${date}T00:00:00`);
    const d=Math.round((b-a)/86400000);
    return d===0?'오늘':d>0?`D-${d}`:`${Math.abs(d)}일 지남`;
  };

  return <div className="space-y-4">
    <div className="grid grid-cols-3 gap-2">
      {[['오늘',todayTasks.length],['기한 경과',overdue.length],['7일 내',next7.length]].map(([l,v])=>
        <div key={l} className="bg-white rounded-xl border border-gray-100 p-3 text-center">
          <div className={`text-lg font-bold ${l==='기한 경과'&&v>0?'text-red-600':'text-gray-900'}`}>{v}</div>
          <div className="text-[10px] text-gray-400">{l}</div>
        </div>)}
    </div>

    <div className="bg-white rounded-xl border border-gray-100 p-3">
      <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="고객명 또는 약속 검색"
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"/>
      <div className="grid grid-cols-5 gap-1 mt-2">
        {[['todo','할 일'],['today','오늘'],['overdue','경과'],['all','전체 예정'],['done','완료']].map(([k,l])=>
          <button key={k} onClick={()=>setFilter(k)}
            className={`py-2 rounded-lg text-[11px] font-semibold ${filter===k?'bg-violet-600 text-white':'bg-gray-50 text-gray-500'}`}>{l}</button>)}
      </div>
      {filter==='todo'&&<div className="text-[10px] text-gray-400 mt-2">할 일에는 오늘부터 7일 이내와 기한이 지난 약속만 보여요.</div>}
    </div>

    <div id="employee-home-care" className="bg-white rounded-xl border border-gray-100 overflow-hidden scroll-mt-28">
      <div className="px-4 py-3 border-b border-gray-50">
        <div className="font-bold text-sm">📌 고객 약속 관리</div>
        <div className="text-xs text-gray-400 mt-0.5">가까운 일정부터 보여주고, 먼 일정은 전체 예정에서 확인해요.</div>
      </div>
      {loading?<div className="py-8 text-center text-xs text-gray-400">불러오는 중...</div>:
       visible.length===0?<div className="py-8 text-center text-xs text-gray-400">해당하는 고객 약속이 없어요.</div>:
       <div className="divide-y divide-gray-50">
         {visible.map(t=>{
           const c=customerMap[t.customer_id], isOver=t.status!=='completed'&&t.due_date<today;
           return <div key={t.id} className="p-4">
             <div className="flex justify-between gap-3">
               <div className="min-w-0">
                 <div className="text-sm font-bold text-gray-900">{c?.customer_name||'고객'} · {t.title}</div>
                 <div className="text-[11px] text-gray-400 mt-1">
                   {t.retention_days?`${t.retention_days}일 유지 → ${t.retention_days===93?'94':'184'}일째 변경 가능 · `:''}{t.due_date}
                 </div>
                 {t.target_plan&&<div className="text-xs text-violet-700 mt-1">변경 예정 요금제 · <b>{t.target_plan}</b></div>}
                 {t.note&&<div className="text-xs text-gray-500 mt-1">{t.note}</div>}
               </div>
               <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-full h-fit ${
                 t.status==='completed'?'bg-emerald-50 text-emerald-600':isOver?'bg-red-50 text-red-600':t.due_date===today?'bg-orange-50 text-orange-600':'bg-violet-50 text-violet-600'
               }`}>{t.status==='completed'?'완료':dLabel(t.due_date)}</span>
             </div>

             {t.status==='completed'?(
               <button onClick={()=>undoComplete(t)} className="mt-3 w-full py-2 rounded-lg bg-gray-50 text-gray-600 text-xs font-semibold">
                 완료 취소
               </button>
             ):(
               <div className="grid grid-cols-3 gap-1.5 mt-3">
                 <button onClick={()=>complete(t)} className="py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold">처리완료</button>
                 <button onClick={()=>updateTask(t,{status:'pending',due_date:addDaysDate(today,1)})} className="py-2 rounded-lg bg-gray-50 text-gray-600 text-xs font-semibold">내일 다시</button>
                 <button onClick={()=>{setRescheduleTask(t);setRescheduleDate(t.due_date||today)}} className="py-2 rounded-lg bg-gray-50 text-gray-600 text-xs font-semibold">일정변경</button>
               </div>
             )}
           </div>
         })}
       </div>}
    </div>

    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-50">
        <div className="text-sm font-semibold text-gray-800">🏠 홈 설치·개통 진행관리</div>
        <div className="text-[11px] text-gray-400 mt-0.5">설치 예정과 진행 상태를 항상 표시해요.</div>
      </div>
      <div><HomeOrderManager {...homeProps}/></div>
    </div>
    {rescheduleTask&&<div className="fixed inset-0 z-[110] bg-black/45 flex items-end sm:items-center justify-center" onClick={()=>setRescheduleTask(null)}><div className="w-full max-w-sm bg-white rounded-t-3xl sm:rounded-3xl p-5" onClick={e=>e.stopPropagation()}><div className="text-lg font-bold text-gray-900">약속 날짜를 변경할까요?</div><div className="text-xs text-gray-500 mt-1">고객에게 다시 연락할 날짜를 선택해주세요.</div><input type="date" value={rescheduleDate} onChange={e=>setRescheduleDate(e.target.value)} className="mt-4 w-full border border-gray-200 rounded-xl px-3 py-3 text-sm"/><div className="grid grid-cols-2 gap-2 mt-4"><button onClick={()=>setRescheduleTask(null)} className="py-3 rounded-xl bg-gray-100 text-gray-600 text-sm font-bold">취소</button><button onClick={async()=>{if(!rescheduleDate)return showAppToast('변경할 날짜를 선택해주세요.',{tone:'error'});await updateTask(rescheduleTask,{status:'pending',due_date:rescheduleDate});setRescheduleTask(null)}} className="py-3 rounded-xl bg-violet-600 text-white text-sm font-bold">날짜 변경</button></div></div></div>}
  </div>;
}


function DailyOneLiner({ userId, month, pay, draft, config, competitionRows, branch, onGoCare, onGoInput }) {
  const [todayTasks,setTodayTasks]=useState(0);
  const [messageIndex,setMessageIndex]=useState(0);

  useEffect(()=>{
    if(!userId)return;
    (async()=>{
      const today=new Date().toISOString().slice(0,10);
      const {count}=await supabase.from('customer_tasks')
        .select('id',{count:'exact',head:true})
        .eq('user_id',userId)
        .eq('status','pending')
        .lte('due_date',today);
      setTodayTasks(Number(count||0));
    })();
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
      <button type="button" onClick={item.onClick} className="text-[11px] font-bold text-violet-600 shrink-0">
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
        const labels={internet1g:'인터넷 1GB',internet500:'인터넷 500MB',internet100:'인터넷 100MB',homeOnly:'인터넷 단독',homeTv:'홈+TV 동시청약',tvFree:'TV프리(부)',smartHome:'스마트홈'};
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
        <div className="flex flex-wrap gap-1.5"><span className="px-2 py-1 rounded-full bg-violet-50 text-violet-700 text-[10px] font-bold">HS {summary.totalHs}건</span><span className="px-2 py-1 rounded-full bg-orange-50 text-orange-700 text-[10px] font-bold">홈 상품 {summary.totalHome}건</span>{summary.totalHomePending>0&&<span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold">홈 대기 {summary.totalHomePending}건</span>}</div>
        <div className="flex flex-wrap gap-1.5"><span className="px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold">전략요금제 {summary.totalStrategicPlan}건</span><span className="px-2 py-1 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold">전략 VAS {summary.totalStrategicVas}건</span><span className="px-2 py-1 rounded-full bg-rose-50 text-rose-700 text-[10px] font-bold">보험·케어 {summary.totalInsurance}건</span><span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">2ND {summary.totalSecond}건</span></div>
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

function TodayWorkCard({userId,onNavigate,onGoInput,onOpenApprovals,todayInputDone=false,approvalPending=0,approvalDone=0}){
  const [state,setState]=useState({loading:true,todayTasks:0,overdue:0,installs:0,unscheduled:0});
  useEffect(()=>{
    if(!userId)return;
    let alive=true;
    (async()=>{
      const today=new Date().toISOString().slice(0,10);
      const [{data:tasks,error:te},{data:homes,error:he}]=await Promise.all([
        supabase.from('customer_tasks').select('id,due_date,status').eq('user_id',userId).neq('status','completed'),
        supabase.from('home_orders').select('id,customer_id,customer_name,planned_install_date,status,source_work_date').eq('user_id',userId).eq('status','pending')
      ]);
      if(!alive)return;
      if(te||he){setState(v=>({...v,loading:false}));return;}
      const pending=tasks||[];
      const homeBundles=new Map();
      (homes||[]).forEach(x=>{const key=`${x.source_work_date||''}|${x.customer_id||x.customer_name||x.id}`;if(!homeBundles.has(key))homeBundles.set(key,x)});
      const orders=[...homeBundles.values()];
      setState({loading:false,todayTasks:pending.filter(x=>x.due_date===today).length,overdue:pending.filter(x=>x.due_date&&x.due_date<today).length,installs:orders.filter(x=>String(x.planned_install_date||'').slice(0,10)===today).length,unscheduled:orders.filter(x=>!x.planned_install_date).length});
    })();
    return()=>{alive=false};
  },[userId]);
  const items=[
    ['오늘 고객 약속',state.todayTasks,'today'],['기한 경과',state.overdue,'overdue'],
    ['오늘 홈 설치',state.installs,'home'],['일정 미정 홈',state.unscheduled,'home'],
  ];
  return <div className="bg-white rounded-2xl border border-gray-100 p-4">
    <div className="flex items-center justify-between"><div><div className="text-[10px] font-bold text-violet-600">오늘 할 일</div><div className="text-sm font-bold text-gray-900 mt-0.5">먼저 확인할 업무</div></div><button onClick={onGoInput} className={`px-2.5 py-1.5 rounded-full text-[10px] font-bold ${todayInputDone?'bg-emerald-50 text-emerald-700':'bg-amber-50 text-amber-700'}`}>{todayInputDone?'오늘 실적 입력 완료':'오늘 실적 미입력'}</button></div>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-3 text-center">
      {items.map(([label,count,type])=><button key={label} onClick={()=>onNavigate(type)} className={`rounded-xl px-1 py-2.5 ${Number(count)>0?'bg-violet-50':'bg-gray-50'}`}><div className={`text-lg font-black ${Number(count)>0?'text-violet-700':'text-gray-300'}`}>{state.loading?'·':count}</div><div className="text-[9px] text-gray-500 mt-0.5 leading-tight">{label} ›</div></button>)}
    </div>
    <button onClick={onOpenApprovals} className="w-full mt-2 rounded-xl bg-amber-50 px-3 py-2.5 flex items-center justify-between text-[11px]"><span className="font-semibold text-amber-800">승인 현황</span><span className="text-amber-700">대기 {approvalPending} · 완료 {approvalDone} ›</span></button>
    {!todayInputDone&&<button onClick={onGoInput} className="w-full mt-2 rounded-xl bg-red-50 px-3 py-2.5 flex items-center justify-between text-[11px] text-red-700"><b>마감 전 확인할 누락</b><span>오늘 실적 미입력 ›</span></button>}
  </div>;
}

function EmployeeHeadOfficeComparison({userId,month,mergedDraft,pay,config}){
  const [hq,setHq]=useState(undefined);
  useEffect(()=>{
    if(!userId)return;
    let alive=true;
    (async()=>{const {data,error}=await supabase.from('head_office_performance').select('metrics,as_of_date').eq('user_id',userId).eq('month',month).maybeSingle();if(alive)setHq(error?null:(data||null));})();
    return()=>{alive=false};
  },[userId,month]);
  const input={hs:hsCount(mergedDraft),second:matrixRowCount(mergedDraft,7)+Object.values(mergedDraft?.bundle2nd||{}).reduce((s,v)=>s+Number(v||0),0),gradePoints:Number(pay?.totalPoints||0)};
  const metrics=hq?.metrics?normalizeHeadOfficeMetrics(hq.metrics):null;
  const official=metrics?headOfficeScores(metrics,config,month):null;
  const rows=official?[['HS',input.hs,official.hs],['2ND',input.second,official.second],['성과P',input.gradePoints,official.gradePoints]]:[];
  return <div className="bg-white rounded-2xl border border-gray-100 p-4">
    <div className="flex items-start justify-between gap-3"><div><div className="text-sm font-bold text-gray-900">직원 입력 · 본사 데이터</div><div className="text-[10px] text-gray-400 mt-0.5">급여는 직원 입력 기준이며 본사 값은 정산 대조용이에요.</div></div><span className={`shrink-0 px-2 py-1 rounded-full text-[9px] font-bold ${official?'bg-blue-50 text-blue-700':'bg-gray-100 text-gray-400'}`}>{official?`${hq.as_of_date} 확인`:'본사 미확인'}</span></div>
    {hq===undefined?<div className="py-4 text-center text-xs text-gray-300">본사 데이터를 확인하는 중...</div>:official?<div className="mt-3 space-y-2">{rows.map(([label,personal,head])=>{const diff=Number(head)-Number(personal);return <div key={label} className="grid grid-cols-[55px_1fr_1fr_55px] gap-2 items-center text-[11px]"><b className="text-gray-600">{label}</b><span className="text-gray-400">입력 <b className="text-gray-700">{fmtNum(personal,1)}</b></span><span className="text-blue-500">본사 <b className="text-blue-700">{fmtNum(head,1)}</b></span><b className={`text-right ${diff===0?'text-gray-300':diff>0?'text-blue-600':'text-red-500'}`}>{diff>0?'+':''}{fmtNum(diff,1)}</b></div>})}</div>:<div className="mt-3 rounded-xl bg-gray-50 px-3 py-3 text-[10px] text-gray-400">아직 등록된 개인 본사 데이터가 없어요. 등록 전에는 직원 입력 실적을 기준으로 표시합니다.</div>}
  </div>;
}

function EmployeeView({ tab, setTab, months, month, setMonth, draft, setDraft, config, pay, mergedDraft, status, saveDraft, saving, saved, dirty, lastSavedAt, dailyDays, allDailyRecords, saveDailyDay, monthLocked, canSeeCriteria, myRank, myRankTotal, myBranchRank, myBranchTotal, prevMonthTotal, currentEmp, personalGoals, savePersonalGoals, goalSaving, showPersonalGoal, competitionRows, authUser, authProfile }) {
  const [expenseTotal,setExpenseTotal]=useState(0);
  const [showNet,setShowNet]=useState(false);
  const [homeDetailOpen,setHomeDetailOpen]=useState(false);
  const [employeeHomeMode,setEmployeeHomeMode]=useState('personal'); // personal | store
  const [homeApprovalPending,setHomeApprovalPending]=useState(0);
  const [approvalRows,setApprovalRows]=useState([]);
  const [approvalOpen,setApprovalOpen]=useState(false);
  const [homeTodayInputCount,setHomeTodayInputCount]=useState(0);
  const [showClosingAmount,setShowClosingAmount]=useState(false);
  const [historyOpen,setHistoryOpen]=useState({mobile:false,home:false,spot:false,expense:false});
  const [historySpotTotal,setHistorySpotTotal]=useState(0);
  const [historySpotRows,setHistorySpotRows]=useState([]);
  const [historyExpenseRows,setHistoryExpenseRows]=useState([]);
  const [resetMonthOpen,setResetMonthOpen]=useState(false);
  const [resetPhrase,setResetPhrase]=useState('');
  const [resetBusy,setResetBusy]=useState(false);
  const [careNavIntent,setCareNavIntent]=useState(null);
  const goCustomerCare=(type)=>{setCareNavIntent({type,at:Date.now()});setTab('customerCare')};
  useEffect(() => {
    if (!authUser?.id) return;
    (async () => {
      const [y, m] = month.split('-').map(Number);
      const next = new Date(y, m, 1);
      const to = `${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}-01`;

      const [expenseRes,spotRes]=await Promise.all([
        supabase.from('sales_expenses').select('expense_date,customer_name,category,amount,memo').eq('user_id',authUser.id).gte('expense_date',`${month}-01`).lt('expense_date',to).order('expense_date'),
        supabase.from('spot_claims').select('claim_date,customer_name,status,source_context,reviewed_title,direct_title,final_amount,direct_amount,spot_policies(title,amount)').eq('user_id',authUser.id).eq('status','approved').gte('claim_date',`${month}-01`).lt('claim_date',to).order('claim_date')
      ]);
      if(!expenseRes.error){
        setHistoryExpenseRows(expenseRes.data||[]);
        setExpenseTotal((expenseRes.data||[]).reduce((sum,x)=>sum+Number(x.amount||0),0));
      }
      if(!spotRes.error){
        const nonMobile=(spotRes.data||[]).filter(x=>x.source_context!=='mobile');
        setHistorySpotRows(nonMobile);
        setHistorySpotTotal(nonMobile.reduce((sum,x)=>sum+Number(x.final_amount??x.direct_amount??x.spot_policies?.amount??0),0));
      }
    })();
  }, [authUser?.id, month]);

  // v21.28: '승인 대기'는 실제 승인 대상(스팟/특판 예외금액)이 있을 때만 표시
  useEffect(()=>{
    if(!authUser?.id)return;
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
          supabase.from('spot_claims').select('id,claim_date,customer_name,source_context,direct_title,direct_amount,spot_policies(title,amount)').eq('user_id',authUser.id).eq('status','pending').gte('claim_date',`${month}-01`).lt('claim_date',to),
          supabase.from('customer_sales').select('id,sale_date,metric_label,source_meta,customers(customer_name)').eq('user_id',authUser.id).eq('source_type','mobile').gte('sale_date',`${month}-01`).lt('sale_date',to),
          todayKey===month
            ? supabase.from('customer_sales').select('id').eq('user_id',authUser.id).eq('sale_date',todayDate)
            : Promise.resolve({data:[],error:null})
        ]);

        const specialPending=(saleRes.data||[]).filter(x=>x.source_meta?.specialPolicy?.exceptionStatus==='pending').length;
        if(alive){
          setHomeApprovalPending((spotRes.data||[]).length+specialPending);
          setApprovalRows([
            ...(spotRes.data||[]).map(x=>({id:`spot-${x.id}`,kind:'spot',date:x.claim_date,customer:x.customer_name||'고객명 없음',title:x.direct_title||x.spot_policies?.title||'스팟 인센티브',amount:Number(x.direct_amount??x.spot_policies?.amount??0),statusLabel:'관리자 승인 대기'})),
            ...(saleRes.data||[]).filter(x=>x.source_meta?.specialPolicy?.exceptionStatus==='pending').map(x=>({id:`special-${x.id}`,kind:'special',date:x.sale_date,customer:x.customers?.customer_name||'고객명 없음',title:`특판 예외금액 · ${x.metric_label||'모바일'}`,amount:Number(x.source_meta?.specialPolicy?.exceptionRequestedAmount||0),statusLabel:'예외금액 승인 대기'}))
          ]);
          setHomeTodayInputCount((todayRes.data||[]).length);
        }
      }catch(e){
        if(alive){setHomeApprovalPending(0);setApprovalRows([]);setHomeTodayInputCount(0);}
      }
    })();
    return()=>{alive=false};
  },[authUser?.id,month,dailyDays]);

  const resetOwnMonthPerformance=async()=>{
    if(monthLocked)return showLegacyAlert('마감된 월은 초기화할 수 없어요.');
    if(String(resetPhrase).trim()!=='당월실적초기화')return;
    if(!authUser?.id || currentEmp?.id!==authUser.id)return showLegacyAlert('본인의 실적만 초기화할 수 있어요.');
    setResetBusy(true);
    try{
      const {data,error}=await supabase.rpc('reset_my_month_performance',{
        p_month:month,
        p_confirm_phrase:'당월실적초기화'
      });
      if(error)throw error;
      showLegacyAlert(`${monthLabel(month)} 실적을 초기화했어요.\n초기화 직전 데이터는 백업되었습니다.`);
      window.location.reload();
    }catch(e){
      showLegacyAlert(`실적 초기화 실패: ${friendlyError(e)}`);
      setResetBusy(false);
    }
  };

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
  const homeInputStatus=homeApprovalPending>0
    ? {label:`승인 대기 ${fmtCount(homeApprovalPending)}건`, cls:'bg-amber-400/20 text-amber-50 border-amber-200/30'}
    : isCurrentHomeMonth
      ? (todayIsDayOff
          ? {label:'오늘 휴무', cls:'bg-sky-400/20 text-sky-50 border-sky-200/30'}
          : todayHasInput
          ? {label:'입력 완료', cls:'bg-emerald-400/20 text-emerald-50 border-emerald-200/30'}
          : {label:'오늘 실적 미입력', cls:'bg-white/10 text-violet-100 border-white/15'})
      : {label:dayHasData(dailyDays?.[todayHomeKey])?'입력 완료':'입력 없음', cls:'bg-white/10 text-violet-100 border-white/15'};

  const currentPayForCompare=Number(pay.currentPerformanceAmount||0);
  const prevPayForCompare=Number(prevMonthTotal||0);
  const prevDiff=prevMonthTotal===null?null:currentPayForCompare-prevPayForCompare;
  const prevPct=(prevMonthTotal===null || prevPayForCompare===0)?null:(prevDiff/prevPayForCompare)*100;

  return (
    <div className="max-w-5xl mx-auto px-4 py-5 pb-24">
      {tab === 'home' && (
        <div className="space-y-4">
          <div className="bg-gray-100 rounded-xl p-1 grid grid-cols-2 gap-1">
            <button type="button" onClick={()=>setEmployeeHomeMode('personal')}
              className={`py-2 rounded-lg text-xs font-bold transition ${employeeHomeMode==='personal'?'bg-white text-violet-700 shadow-sm':'text-gray-500'}`}>
              개인
            </button>
            <button type="button" onClick={()=>setEmployeeHomeMode('store')}
              className={`py-2 rounded-lg text-xs font-bold transition ${employeeHomeMode==='store'?'bg-white text-violet-700 shadow-sm':'text-gray-500'}`}>
              매장
            </button>
          </div>

          {employeeHomeMode==='personal' ? <>
            <GamificationHub dailyDays={dailyDays} month={month} personalGoals={personalGoals} mergedDraft={mergedDraft} pay={pay} competitionRows={competitionRows} userId={authUser?.id} currentEmp={currentEmp} />
            <TodayWorkCard userId={authUser?.id} todayInputDone={todayHasInput||todayIsDayOff}
              approvalPending={homeApprovalPending} approvalDone={historySpotRows.length}
              onNavigate={goCustomerCare} onOpenApprovals={()=>homeApprovalPending>0?setApprovalOpen(true):setTab('history')} onGoInput={()=>setTab('daily')} />

            <div className="rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="text-[11px] text-violet-100">{monthLabel(month)} 현재 실적 기준 금액</div>
                <div className="text-right shrink-0">
                  {prevMonthTotal===null ? (
                    <div className="text-[9px] text-violet-100/70">전월 비교 없음</div>
                  ) : (
                    <>
                      <div className={`text-[10px] font-semibold ${prevDiff>0?'text-emerald-200':prevDiff<0?'text-rose-200':'text-violet-100'}`}>
                        전월 대비 {prevDiff>0?'+':''}{won(prevDiff)}
                      </div>
                      <div className="text-[9px] text-violet-100/70 mt-0.5">
                        {prevPct===null?'비교 불가':`${prevPct>0?'+':''}${fmtNum(prevPct,1)}%`}
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="text-2xl font-bold mt-0.5">{won(Math.max(0,pay.currentPerformanceAmount-(showNet?expenseTotal:0)))}</div>
              <div className="mt-1 text-[9px] leading-relaxed text-violet-100/80">
                지금까지 등록된 실적에서 실제 발생한 금액을 기준으로 보여줘요.
              </div>

              <button type="button" onClick={()=>setShowClosingAmount(true)}
                className="w-full mt-3 py-2.5 px-3 rounded-xl bg-white/12 border border-white/20 text-[11px] font-bold flex items-center justify-between">
                <span>현재 실적 기준 마감시 금액 확인</span><span>›</span>
              </button>

              <div className="grid grid-cols-4 gap-1.5 mt-3 pt-3 border-t border-white/15">
                <div><div className="text-[9px] text-violet-100/75">근속</div><div className="text-[11px] font-bold mt-0.5">{fmtCount(pay.months)}개월</div></div>
                <div><div className="text-[9px] text-violet-100/75">등급</div><div className="text-[11px] font-bold mt-0.5">{pay.gradeEligible?pay.grade:'D(미달)'}</div></div>
                <div><div className="text-[9px] text-violet-100/75">성과등급P</div><div className="text-[11px] font-bold mt-0.5">{fmtNum(pay.totalPoints,1)}P</div></div>
                <div><div className="text-[9px] text-violet-100/75">생산성</div><div className="text-[11px] font-bold mt-0.5">{fmtNum(pay.kpiScore,1)}P</div></div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <button onClick={()=>setShowNet(v=>!v)} className="text-[10px] px-2.5 py-1 rounded-full bg-white/15 border border-white/20">
                  {showNet?'영업비용 차감 전 보기':`영업비용 ${won(expenseTotal)} 차감`}
                </button>
                <button type="button" onClick={()=>homeApprovalPending>0?setApprovalOpen(true):setTab('daily')} className={`text-[9px] font-semibold px-2 py-1 rounded-full border ${homeInputStatus.cls}`}>{homeInputStatus.label}{homeApprovalPending>0?' ›':''}</button>
              </div>
            </div>

            {showClosingAmount&&<div className="fixed inset-0 z-[95] bg-black/40 flex items-end sm:items-center justify-center" onClick={()=>setShowClosingAmount(false)}>
              <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5" onClick={e=>e.stopPropagation()}>
                <div className="text-sm font-bold text-gray-900">현재 실적 기준 마감시 금액</div>
                <div className="text-3xl font-bold text-violet-700 mt-2">{won(Math.max(0,pay.closingAmount-expenseTotal))}</div>
                <div className="text-xs text-gray-500 mt-3 leading-relaxed">현재까지 등록된 실적을 기준으로 마감할 경우 적용되는 금액입니다.</div>
                <button type="button" onClick={()=>setShowClosingAmount(false)} className="w-full mt-5 py-3 rounded-xl bg-violet-600 text-white text-sm font-bold">확인</button>
              </div>
            </div>}

            {approvalOpen&&<div className="fixed inset-0 z-[96] bg-black/40 flex items-end sm:items-center justify-center" onClick={()=>setApprovalOpen(false)}>
              <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl max-h-[82vh] overflow-hidden" onClick={e=>e.stopPropagation()}>
                <div className="p-5 border-b"><div className="flex items-start justify-between gap-3"><div><div className="text-[10px] font-bold text-amber-600">승인 전 금액은 아직 미반영</div><div className="text-lg font-bold text-gray-900 mt-0.5">승인 대기 {approvalRows.length}건</div><div className="text-[10px] text-gray-400 mt-1">관리자가 확인하면 예상 수수료에 반영돼요.</div></div><button onClick={()=>setApprovalOpen(false)} className="w-8 h-8 rounded-full bg-gray-100 text-gray-500">×</button></div></div>
                <div className="overflow-y-auto max-h-[55vh] divide-y">{approvalRows.map(x=><div key={x.id} className="p-4"><div className="flex justify-between gap-3"><div className="min-w-0"><div className="text-xs font-bold text-gray-900 truncate">{x.title}</div><div className="text-[10px] text-gray-400 mt-1">{x.date} · {x.customer}</div><div className="text-[10px] text-amber-600 mt-1">{x.statusLabel}</div></div><b className="text-sm text-gray-900 shrink-0">{won(x.amount)}</b></div></div>)}</div>
                <div className="p-4 bg-amber-50"><div className="text-center text-[11px] text-amber-800 font-semibold">아직 관리자가 확인 중이에요. 점장님께 살짝 콕 찔러볼까요? 😆</div><button onClick={()=>setApprovalOpen(false)} className="w-full mt-3 py-3 rounded-xl bg-gray-900 text-white text-sm font-bold">확인했어요</button></div>
              </div>
            </div>}

            <EmployeeHeadOfficeComparison userId={authUser?.id} month={month} mergedDraft={mergedDraft} pay={pay} config={config} />

            <MyMonthlyPerformanceCard draft={mergedDraft} pay={pay} personalGoals={personalGoals} dailyDays={dailyDays} month={month} config={config} onSaveGoals={savePersonalGoals} goalSaving={goalSaving} />
            <MonthlyPerformanceRankingCard
              rows={competitionRows}
              userId={currentEmp?.id||authUser?.id}
              userName={currentEmp?.name||authProfile?.name||''}
              userBranch={currentEmp?.branch||''}
              title={`${monthLabel(month)} 월 누적 순위`}
            />
          </> : <>
            <StoreHomeOverview rows={competitionRows} branch={currentEmp?.branch} month={month} userId={currentEmp?.id||authUser?.id} userName={currentEmp?.name||authProfile?.name||''} />
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

          <DailyInputTab
            month={month}
            dailyDays={dailyDays}
            saveDailyDay={saveDailyDay}
            config={config}
            draft={draft}
            setDraft={setDraft}
            pay={pay}
            locked={monthLocked}
            currentEmp={currentEmp}
            authUser={authUser}
            resetMonthOpen={resetMonthOpen}
            setResetMonthOpen={setResetMonthOpen}
            resetPhrase={resetPhrase}
            setResetPhrase={setResetPhrase}
            resetBusy={resetBusy}
            resetOwnMonthPerformance={resetOwnMonthPerformance}
          />

          <div className="mt-4">
            <SpotClaimPanel userId={authUser?.id} month={month} />
          </div>

          <div className="mt-4">
            <SalesExpensePanel
              userId={authUser?.id}
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
          <CustomerCareManager
            userId={authUser?.id}
            month={month}
            navIntent={careNavIntent}
            homeProps={{
              userId:authUser?.id,
              month,
              locked:monthLocked,
              dailyDays,
              saveDailyDay
            }}
          />
        </div>
      )}

      {tab === 'evaluation' && (
        <EvaluationTab month={month} employee={(competitionRows||[]).find(e=>e.id===authUser?.id)||currentEmp} config={config} isManagerView={false} authUserId={authUser?.id} />
      )}

      {tab === 'history' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div><div className="text-xs text-violet-600 font-semibold">수수료 내역</div><div className="text-lg font-bold">{monthLabel(month)}</div></div>
            <select value={month} onChange={(e) => setMonth(e.target.value)} className="text-sm font-medium bg-white border border-gray-200 rounded-lg px-3 py-2">
              {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
          </div>

          <MyInputSummary userId={currentEmp?.id||authUser?.id} month={month} config={config} />

          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
            <RowKV label="영업 활동 지원 정책" value={won(pay.tenurePay)} />
            <RowKV label="월 성과 등급 지원비" value={won(pay.gradeBonus)} />
            <RowKV label="직책 수당" value={won(pay.positionAllowance)} />

            <button type="button" onClick={()=>setHistoryOpen(v=>({...v,mobile:!v.mobile}))} className="w-full px-4 py-3 flex justify-between items-center text-sm">
              <span className="font-semibold">모바일 관련 수수료</span>
              <span className="flex items-center gap-2 font-bold text-gray-800">{won(Number(pay.mobilePlanPay||0)+Number(pay.mnpBundlePay||0)+Number(pay.rawBundle2ndTotal||0)+Number(pay.rawVasPay||0)-Number(pay.bundleFreeOffset||0)-Number(pay.bundleFreeVasOffset||0)-Number(pay.specialMatrixOffset||0)-Number(pay.specialVasOffset||0)+Number(pay.specialReplacementPay||0)+Number(pay.approvedMobileSpotPay||0))}<ChevronDown size={15} className={historyOpen.mobile?'rotate-180':''}/></span>
            </button>
            {historyOpen.mobile&&<div className="bg-gray-50/70 px-4 py-2 divide-y divide-gray-100">
              {Number(pay.mobilePlanPay||0)!==0&&<RowKV label="└ 요금제 유치 수수료" value={won(pay.mobilePlanPay)} />}
              {Number(pay.mnpBundlePay||0)!==0&&<RowKV label="└ 중고 MNP 결합 수수료" value={won(pay.mnpBundlePay)} />}
              {Number(pay.rawBundle2ndTotal||0)!==0&&<RowKV label="└ 2ND 번들 유치 수수료" value={won(pay.rawBundle2ndTotal)} />}
              {Number(pay.rawVasPay||0)!==0&&<RowKV label="└ VAS 유치 수수료" value={won(pay.rawVasPay)} />}
              {Number(pay.bundleFreeOffset||0)!==0&&<RowKV label="└ 2ND 무료판매 제외" value={`-${won(pay.bundleFreeOffset)}`} />}
              {Number(pay.bundleFreeVasOffset||0)!==0&&<RowKV label="└ 2ND 무료판매 VAS 제외" value={`-${won(pay.bundleFreeVasOffset)}`} />}
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

            <div className="px-4 py-4 bg-violet-50 flex justify-between items-center">
              <span className="font-bold text-violet-800">예상 총 수수료</span>
              <span className="text-xl font-black text-violet-700">{won(Number(pay.total||0)+historySpotTotal-expenseTotal)}</span>
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-20">
        <div className="max-w-5xl mx-auto grid grid-cols-5">
          {[
            { key: 'home', label: '홈', icon: Home },
            { key: 'daily', label: '실적입력', icon: Calendar },
            { key: 'customerCare', label: '고객관리', icon: ClipboardList },
            { key: 'evaluation', label: '평가', icon: ClipboardCheck },
            { key: 'history', label: '내역', icon: History },
          ].map((n) => (
            <button key={n.key} onClick={() => setTab(n.key)} className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] ${tab === n.key ? 'text-violet-700' : 'text-gray-400'}`}>
              <n.icon size={18} />{n.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function DailyInputTab({ month, dailyDays, saveDailyDay, config, draft, setDraft, pay, locked, currentEmp, authUser, resetMonthOpen, setResetMonthOpen, resetPhrase, setResetPhrase, resetBusy, resetOwnMonthPerformance }) {
  const n = daysInMonth(month);
  const todayKey = (() => {
    const now = new Date();
    return monthKeyOf(now) === month ? String(now.getDate()).padStart(2, '0') : '01';
  })();
  const [selectedDay, setSelectedDay] = useState(todayKey);
  const [day, setDay] = useState(() => normalizeDay(dailyDays[todayKey]));
  const [pickedRow, setPickedRow] = useState(null); // 선택한 가입구분 index
  const [inputCategory, setInputCategory] = useState(null); // mobile | home | extra
  const [toast, setToast] = useState(null);         // 등록 피드백 카드
  const [saveState, setSaveState] = useState('idle'); // idle | pending | saved | error
  const [homeOrderDraft, setHomeOrderDraft] = useState(null); // { groupKey, itemKey, label, productType }
  const [homeCustomerName, setHomeCustomerName] = useState('');
  const [homeNetworkType, setHomeNetworkType] = useState('');
  const [homeSaleType, setHomeSaleType] = useState('normal'); // normal | allinone
  const [homeInternet,setHomeInternet]=useState(false);
  const [homeInternetSpeed,setHomeInternetSpeed]=useState(''); // 100 | 500 | 1g
  const [homeMobileSimul,setHomeMobileSimul]=useState('none'); // none | newChange | mnp | usedMnp
  const [homeMainTv,setHomeMainTv]=useState(false);
  const [homeSubTv,setHomeSubTv]=useState(false);
  const [homeSubTvType,setHomeSubTvType]=useState('normal');
  const [homeSmartHome,setHomeSmartHome]=useState(false);
  const [homeDirectComplete, setHomeDirectComplete] = useState(false);
  const [homeActualCompleteDate, setHomeActualCompleteDate] = useState('');
  const [homePlannedDate, setHomePlannedDate] = useState('');
  const [homeCareKeys,setHomeCareKeys]=useState([]);
  const [homeCustomTitle,setHomeCustomTitle]=useState('');
  const [homeCustomDueDate,setHomeCustomDueDate]=useState('');
  const [homeTargetPlan,setHomeTargetPlan]=useState('');
  const [homeOrderSaving, setHomeOrderSaving] = useState(false);
  const [homeSpotPolicies,setHomeSpotPolicies]=useState([]);
  const [homeSpotPolicyId,setHomeSpotPolicyId]=useState('');
  const [homeSpotDirectOpen,setHomeSpotDirectOpen]=useState(false);
  const [homeSpotDirectTitle,setHomeSpotDirectTitle]=useState('');
  const [homeSpotDirectAmount,setHomeSpotDirectAmount]=useState('');
  const [homeSpotDirectMemo,setHomeSpotDirectMemo]=useState('');
  const [homeExpenseOpen,setHomeExpenseOpen]=useState(false);
  const [homeExpenseCategory,setHomeExpenseCategory]=useState('오퍼');
  const [homeExpenseAmount,setHomeExpenseAmount]=useState('');
  const [homeExpenseMemo,setHomeExpenseMemo]=useState('');
  const [homeExtraPromises,setHomeExtraPromises]=useState([]); // [{title,dueDate}]
  const [homeExtraExpenses,setHomeExtraExpenses]=useState([]); // [{category,amount,memo}]
  const [editingHomeSales,setEditingHomeSales]=useState([]);
  const [householdRenewOpen,setHouseholdRenewOpen]=useState(false);
  const [householdRenewForm,setHouseholdRenewForm]=useState(()=>emptyHouseholdRenewForm());
  const [householdRenewEditIndex,setHouseholdRenewEditIndex]=useState(null);
  const [mobileSaleDraft,setMobileSaleDraft]=useState(null);
  const [editingSale,setEditingSale]=useState(null);
  const [editingCompletedTaskCount,setEditingCompletedTaskCount]=useState(0);
  const [mobileCustomerName,setMobileCustomerName]=useState('');
  const [mobileCareKeys,setMobileCareKeys]=useState([]);
  const [mobileCustomTitle,setMobileCustomTitle]=useState('');
  const [mobileCustomDueDate,setMobileCustomDueDate]=useState('');
  const [mobileTargetPlan,setMobileTargetPlan]=useState('');
  const [mobileVasKeys,setMobileVasKeys]=useState([]);
  const [mobileStrategicPlan,setMobileStrategicPlan]=useState(false); // 105군 이상 본사 전략요금제 체크
  const [mobileBundle2ndKeys,setMobileBundle2ndKeys]=useState([]);
  const [mobileBundleSearch,setMobileBundleSearch]=useState('');
  // v21.18: 2ND 번들 회선별 VAS를 따로 기록합니다. { [bundleKey]: [vasKey, ...] }
  const [mobileBundleVasMap,setMobileBundleVasMap]=useState({});
  const [mobileBundleSaleTypeMap,setMobileBundleSaleTypeMap]=useState({}); // {bundleKey:'normal'|'free'}
  const [mobileUsedMnpBundle,setMobileUsedMnpBundle]=useState(false);
  const [mobileSpotPolicies,setMobileSpotPolicies]=useState([]);
  const [mobileSpotPolicyId,setMobileSpotPolicyId]=useState('');
  const [mobileSpotDirectOpen,setMobileSpotDirectOpen]=useState(false);
  const [mobileSpotDirectTitle,setMobileSpotDirectTitle]=useState('');
  const [mobileSpotDirectAmount,setMobileSpotDirectAmount]=useState('');
  const [mobileSpotDirectMemo,setMobileSpotDirectMemo]=useState('');
  const [mobileExpenseOpen,setMobileExpenseOpen]=useState(false);
  const [mobileExpenseCategory,setMobileExpenseCategory]=useState('케이스');
  const [mobileExpenseAmount,setMobileExpenseAmount]=useState('');
  const [mobileExpenseMemo,setMobileExpenseMemo]=useState('');
  const [mobileExtraPromises,setMobileExtraPromises]=useState([]);
  const [mobileExtraExpenses,setMobileExtraExpenses]=useState([]);
  const [specialPolicies,setSpecialPolicies]=useState([]);
  // v21.25: 모바일 입력 최상단에서 일반판매 / 특판·지인판매를 먼저 선택
  const [mobileSaleKind,setMobileSaleKind]=useState('normal'); // normal | special
  const [mobileSpecialPolicyId,setMobileSpecialPolicyId]=useState('');
  const [mobileSpecialExceptionAmount,setMobileSpecialExceptionAmount]=useState('');
  const [extraInput,setExtraInput]=useState(null); // sono | tailored | customerReg
  const [extraCustomer,setExtraCustomer]=useState('');
  const [extraSonoKey,setExtraSonoKey]=useState('sonoBasic');
  const [extraCount,setExtraCount]=useState('1');
  const [extraAmount,setExtraAmount]=useState('');
  const [mobileSaleSaving,setMobileSaleSaving]=useState(false);
  const [daySales,setDaySales]=useState([]);
  const [homePreviewPolicy,setHomePreviewPolicy]=useState(null); // 설치예정 포함, 입력건 예상 홈 인센티브
  const [saleIncentiveOpen,setSaleIncentiveOpen]=useState(null);
  const [daySalesLoading,setDaySalesLoading]=useState(false);
  const [legacyEditorOpen,setLegacyEditorOpen]=useState(false);
  const [legacyMatrixDraft,setLegacyMatrixDraft]=useState(null);
  // 구버전 집계 1건을 현재 모바일/홈 입력 UI로 복원하는 동안 원본 위치를 기억
  const [legacyConversion,setLegacyConversion]=useState(null);
  const homeSubmitGuardRef=useRef(false);
  const mobileSubmitGuardRef=useRef(false);


  const dayMatrix = day.matrix;
  const isDayOff = !!day.dayOff;

  const setDayOff = async (nextOff) => {
    if (locked) return;
    if (nextOff && dayHasData(day)) {
      const ok = await showAppConfirm({title:'실적이 있는 날짜예요',message:'휴무로 표시해도 입력된 실적은 그대로 유지됩니다.',confirmLabel:'휴무로 표시',tone:'warning'});
      if (!ok) return;
    }
    const next = { ...normalizeDay(day), dayOff: nextOff };
    setDay(next);
    pendingRef.current = { day: selectedDay, record: next };
    setSaveState('pending');
  };

  // 저장되지 않은 변경을 담아두는 칸 — 날짜를 바꾸거나 화면을 떠날 때 이걸 먼저 비움
  const pendingRef = useRef(null);
  const flushRef = useRef(() => {});

  const flush = useCallback(async() => {
    const p = pendingRef.current;
    if (!p) return;
    pendingRef.current = null;
    const ok=await saveDailyDay(p.day,p.record);
    if(ok){
      setSaveState('saved');
      setTimeout(()=>setSaveState('idle'),1200);
    }else{
      pendingRef.current=p;
      setSaveState('error');
    }
  }, [saveDailyDay]);
  flushRef.current = flush;

  useEffect(() => {
    if(pendingRef.current)return;
    setDay(normalizeDay(dailyDays[selectedDay]));
    setSaveState('idle');
  }, [selectedDay, month, dailyDays[selectedDay]]); // eslint-disable-line

  // 마지막 입력 후 0.8초 조용하면 자동 저장
  useEffect(() => {
    if (!pendingRef.current) return;
    const t = setTimeout(flush, 800);
    return () => clearTimeout(t);
  }, [day, flush]);

  // 탭을 떠나거나 창을 닫을 때 남은 변경 저장
  useEffect(() => {
    const onLeave = () => flushRef.current();
    window.addEventListener('beforeunload', onLeave);
    return () => { window.removeEventListener('beforeunload', onLeave); flushRef.current(); };
  }, []);

  const mutate = (next) => {
    if (locked) return;
    setDay(next);
    pendingRef.current = { day: selectedDay, record: next };
    setSaveState('pending');
  };
  const setCell = (ri, ci, v) => {
    const nextMatrix = day.matrix.map((row) => [...row]);
    nextMatrix[ri][ci] = Math.max(0, v);
    mutate({ ...day, matrix: nextMatrix });
  };
  const bump = (ri, ci, delta) => setCell(ri, ci, (day.matrix[ri][ci] || 0) + delta);
  const setGroupItem = (gk, key, v) => mutate({ ...day, groups: { ...day.groups, [gk]: { ...day.groups[gk], [key]: Math.max(0, v) } } });
  const setNumeric = (key, v) => mutate({ ...day, [key]: Math.max(0, v) });

  const openHouseholdRenew=(idx=null)=>{
    if(locked)return;
    const item=idx===null?null:day.householdRenewals?.[idx];
    setHouseholdRenewEditIndex(idx);
    setHouseholdRenewForm(item?{...emptyHouseholdRenewForm(),...item}:emptyHouseholdRenewForm());
    setHouseholdRenewOpen(true);
  };
  const applyHouseholdRenewItems=(items)=>{
    const baseDay=normalizeDay(day);
    const hadStructured=(baseDay.householdRenewals||[]).length>0;
    const storedLegacy=baseDay.householdRenewLegacyCounts||{};
    const legacyCounts=Object.keys(storedLegacy).length?storedLegacy:(!hadStructured?{...(baseDay.groups?.renew||{})}:{});
    const agg=aggregateHouseholdRenewals(items,config);
    const combined={...legacyCounts};
    Object.entries(agg.counts).forEach(([k,v])=>{combined[k]=Number(combined[k]||0)+Number(v||0);});
    mutate({...baseDay,householdRenewals:items,householdRenewLegacyCounts:legacyCounts,renewSoloDiscountAmount:agg.soloDiscount,groups:{...baseDay.groups,renew:combined}});
  };
  const saveHouseholdRenew=()=>{
    const items=[...(day.householdRenewals||[])];
    const item={...householdRenewForm,id:householdRenewEditIndex===null?`renew-${Date.now()}-${Math.random().toString(36).slice(2,7)}`:(items[householdRenewEditIndex]?.id||`renew-${Date.now()}`)};
    if(householdRenewEditIndex===null)items.push(item); else items[householdRenewEditIndex]=item;
    applyHouseholdRenewItems(items);
    setHouseholdRenewOpen(false);setHouseholdRenewEditIndex(null);setHouseholdRenewForm(emptyHouseholdRenewForm());
  };
  const deleteHouseholdRenew=async(idx)=>{
    if(!await showAppConfirm({title:'재약정 실적을 삭제할까요?',message:'삭제하면 해당 재약정 건수와 수수료가 함께 빠집니다.',confirmLabel:'삭제',tone:'danger'}))return;
    const items=(day.householdRenewals||[]).filter((_,i)=>i!==idx);
    applyHouseholdRenewItems(items);
  };
  const householdRenewPreview=calculateHouseholdRenew(householdRenewForm,config);


  useEffect(() => {
    if (!homeOrderDraft) return;
    const saleDate=`${month}-${selectedDay}`;
    (async()=>{
      const {data}=await supabase.from('spot_policies').select('*').eq('active',true).lte('start_date',saleDate).gte('end_date',saleDate).order('start_date');
      setHomeSpotPolicies(data||[]);
      setHomeSpotPolicyId('');
    })();
  }, [homeOrderDraft, month, selectedDay]);

  useEffect(() => {
    if (!mobileSaleDraft) return;
    const saleDate=`${month}-${selectedDay}`;
    (async()=>{
      const {data}=await supabase
        .from('spot_policies')
        .select('*')
        .eq('active',true)
        .lte('start_date',saleDate)
        .gte('end_date',saleDate)
        .order('start_date');
      setMobileSpotPolicies(data||[]);
      setMobileSpotPolicyId('');
      const {data:sp}=await supabase.from('special_sale_policies').select('*').eq('active',true).lte('start_date',saleDate).gte('end_date',saleDate).order('start_date');
      setSpecialPolicies(sp||[]);
      if(!editingSale)setMobileSpecialPolicyId('');
    })();
  }, [mobileSaleDraft, month, selectedDay]);


  const loadDaySales=useCallback(async()=>{
    if(!currentEmp?.id)return;
    setDaySalesLoading(true);
    const saleDate=`${month}-${selectedDay}`;
    const [yy,mm]=month.split('-').map(Number),next=new Date(yy,mm,1);
    const monthTo=`${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}-01`;
    const [saleRes,homeRes]=await Promise.all([
      supabase.from('customer_sales')
        .select('id,customer_id,sale_date,metric_label,source_type,source_ref,source_meta,schema_version,customers(customer_name)')
        .eq('user_id',currentEmp.id)
        .eq('sale_date',saleDate)
        .order('created_at',{ascending:false}),
      supabase.from('home_orders')
        .select('id,user_id,customer_id,customer_name,product_type,network_type,sale_type,status,source_work_date,actual_install_date')
        .eq('user_id',currentEmp.id)
        .gte('source_work_date',`${month}-01`)
        .lt('source_work_date',monthTo)
    ]);
    if(!saleRes.error)setDaySales(saleRes.data||[]);
    if(!homeRes.error){
      // 직원 입력 카드에서는 설치예정도 "이 건을 설치완료했을 때"의 예상 수수료를 보여줍니다.
      // 실제 급여/정산 계산은 기존대로 completed 주문만 반영하므로 지급액에는 영향을 주지 않습니다.
      const previewOrders=(homeRes.data||[]).map(o=>({...o,status:'completed'}));
      setHomePreviewPolicy(calculateHomePolicyFromOrders(previewOrders,config));
    }else{
      console.error('HOME PREVIEW LOAD ERROR',homeRes.error);
      setHomePreviewPolicy(null);
    }
    setDaySalesLoading(false);
  },[currentEmp?.id,month,selectedDay,config]);

  useEffect(()=>{loadDaySales()},[loadDaySales]);

  const deleteSale=async(sale)=>{
    const name=sale.customers?.customer_name||'고객';
    const bundleText=sale.source_type==='home_order'?'이 고객의 같은 날 홈 판매 묶음을 삭제할까요?':'이 판매 건을 삭제할까요?';
    if(!await showAppConfirm({title:'판매건을 삭제할까요?',message:`${name} · ${sale.metric_label}\n${bundleText}\n연결된 고객 약속과 영업비용도 함께 삭제됩니다.`,confirmLabel:'판매건 삭제',tone:'danger'}))return;
    const meta=sale.source_meta||{};

    if(sale.source_type==='home_order'){
      const {data:hs,error:hErr}=await supabase.from('customer_sales').select('id,source_ref').eq('user_id',currentEmp?.id).eq('sale_date',sale.sale_date).eq('customer_id',sale.customer_id).eq('source_type','home_order');
      if(hErr)return showLegacyAlert(friendlyError(hErr));
      const ids=(hs||[]).map(x=>x.id),refs=(hs||[]).map(x=>x.source_ref).filter(Boolean); let orders=[];
      if(refs.length){const {data:o}=await supabase.from('home_orders').select('*').in('id',refs);orders=o||[];}
      const base=normalizeDay(day),groups={...base.groups};
      orders.forEach(o=>{if(o.status==='completed'&&o.source_group&&o.source_key){groups[o.source_group]={...(groups[o.source_group]||{})};groups[o.source_group][o.source_key]=Math.max(0,Number(groups[o.source_group][o.source_key]||0)-1);}});
      mutate({...base,groups});
      if(ids.length){await supabase.from('customer_tasks').delete().in('source_sale_id',ids).eq('user_id',currentEmp?.id);await supabase.from('sales_expenses').delete().in('source_sale_id',ids).eq('user_id',currentEmp?.id);await supabase.from('customer_sales').delete().in('id',ids).eq('user_id',currentEmp?.id);}
      if(refs.length)await supabase.from('home_orders').delete().in('id',refs).eq('user_id',currentEmp?.id);
      loadDaySales();return;
    }

    if(sale.source_type==='extra'){
      const base=normalizeDay(day),cnt=Number(meta.count||1);
      if(meta.extraType==='sono'){const groups={...base.groups,sono:{...(base.groups?.sono||{})}};groups.sono[meta.sonoKey]=Math.max(0,Number(groups.sono[meta.sonoKey]||0)-cnt);mutate({...base,groups});}
      else if(meta.extraType==='tailored')mutate({...base,tailoredCount:Math.max(0,Number(base.tailoredCount||0)-cnt),tailoredAmount:Math.max(0,Number(base.tailoredAmount||0)-Number(meta.amount||0))});
      else if(meta.extraType==='customerReg')mutate({...base,custRegCount:Math.max(0,Number(base.custRegCount||0)-cnt)});
      await supabase.from('customer_sales').delete().eq('id',sale.id).eq('user_id',currentEmp?.id);loadDaySales();return;
    }

    if(sale.source_type==='mobile' && Number.isInteger(meta.ri) && Number.isInteger(meta.ci)){
      const base=normalizeDay(day),matrix=base.matrix.map(r=>[...r]); matrix[meta.ri][meta.ci]=Math.max(0,Number(matrix[meta.ri][meta.ci]||0)-1);
      const vas={...(base.groups?.vas||{})}; [...(meta.vasKeys||[]),...Object.values(meta.bundleVasMap||{}).flat()].forEach(k=>{if(k!=='vasNone')vas[k]=Math.max(0,Number(vas[k]||0)-1)});
      const bundle2nd={...(base.groups?.bundle2nd||{})};(meta.bundle2ndKeys||[]).forEach(k=>bundle2nd[k]=Math.max(0,Number(bundle2nd[k]||0)-1));
      const mnpBundle={...(base.groups?.mnpBundle||{})};if(meta.usedMnpBundle)mnpBundle.usedMnpBundle=Math.max(0,Number(mnpBundle.usedMnpBundle||0)-1);
      const sp=meta.specialPolicy||{};
      const free=bundleFreeAmounts(meta.bundle2ndKeys||[],meta.bundleVasMap||{},meta.bundleSaleTypeMap||{});
      mutate({...base,matrix,groups:{...base.groups,vas,bundle2nd,mnpBundle},
        bundleFreeOffset:Math.max(0,Number(base.bundleFreeOffset||0)-Number(free.bundleOffset||0)),
        bundleFreeVasOffset:Math.max(0,Number(base.bundleFreeVasOffset||0)-Number(free.vasOffset||0)),
        specialMatrixOffset:Math.max(0,Number(base.specialMatrixOffset||0)-Number(sp.normalMatrixFee||0)),specialVasOffset:Math.max(0,Number(base.specialVasOffset||0)-Number(sp.normalVasFee||0)),specialReplacementPay:Math.max(0,Number(base.specialReplacementPay||0)-Number(sp.exceptionStatus==='approved'?sp.exceptionApprovedAmount:sp.exceptionStatus==='pending'?0:sp.replacementAmount||0))});
    }
    await supabase.from('customer_tasks').delete().eq('source_sale_id',sale.id).eq('user_id',currentEmp?.id);
    await supabase.from('sales_expenses').delete().eq('source_sale_id',sale.id).eq('user_id',currentEmp?.id);
    const {error}=await supabase.from('customer_sales').delete().eq('id',sale.id).eq('user_id',currentEmp?.id); if(error)return showLegacyAlert(`판매 삭제 실패: ${friendlyError(error)}`); loadDaySales();
  };

  const openHomeOrder = (groupKey = null, itemKey = null) => {
    if (locked) return;
    setHomeOrderDraft({ unified:true, label:'홈 실적 입력' });
    setHomeCustomerName('');
    setHomeNetworkType('');
    setHomeSaleType('normal');
    setHomeInternet(false); setHomeInternetSpeed(''); setHomeMobileSimul('none'); setHomeMainTv(false); setHomeSubTv(false); setHomeSubTvType('normal'); setHomeSmartHome(false);
    setHomeDirectComplete(false);
    setHomeActualCompleteDate('');
    setHomePlannedDate('');
    setHomeCareKeys([]); setHomeCustomTitle(''); setHomeCustomDueDate(''); setHomeTargetPlan('');
    setHomeSpotPolicyId(''); setHomeSpotDirectOpen(false); setHomeSpotDirectTitle(''); setHomeSpotDirectAmount(''); setHomeSpotDirectMemo('');
    setHomeExpenseOpen(false); setHomeExpenseCategory('오퍼'); setHomeExpenseAmount(''); setHomeExpenseMemo('');
    setHomeExtraPromises([]); setHomeExtraExpenses([]); setEditingHomeSales([]);
  };

  const submitHomeOrder = async () => {
    if (!homeOrderDraft || !currentEmp?.id || locked || homeSubmitGuardRef.current) return;
    const customer = homeCustomerName.trim();
    if (!customer) return showAppToast('고객명을 입력해야 등록할 수 있어요.',{tone:'error'});
    if (!homeNetworkType) return showAppToast('가정망 또는 소호망을 선택해주세요.',{tone:'error'});
    if (!homeInternet && !homeMainTv && !homeSubTv && !homeSmartHome) return showAppToast('판매한 홈 상품을 하나 이상 선택해주세요.',{tone:'error'});
    if (homeMainTv && !homeInternet) return showAppToast('TV(주)는 인터넷 가입과 함께 선택해주세요.',{tone:'error'});
    if (homeInternet && !homeInternetSpeed) return showAppToast('인터넷 속도를 선택해주세요.',{tone:'error'});
    if (homeMobileSimul==='usedMnp' && homeNetworkType!=='household') return showAppToast('중고 MNP 동시판매는 가정망에서만 적용할 수 있어요.',{tone:'error'});
    if (homeDirectComplete && !homeActualCompleteDate) return showAppToast('설치완료일을 입력해주세요.',{tone:'error'});

    const sourceWorkDate=`${month}-${selectedDay}`;
    // 실제 판매 구성을 기존 정산 그룹으로 자동 변환
    const products=[];
    if(homeInternet){
      if(homeMainTv) products.push({groupKey:'homeBase',itemKey:'homeTv',productType:'homeTv',label:'홈+TV 동시청약'});
      else products.push({groupKey:'homeBase',itemKey:'homeOnly',productType:'homeOnly',label:'홈 단독'});
      const speedMap={
        '100':{itemKey:'home100Only',productType:'internet100',label:'인터넷 100MB'},
        '500':{itemKey:'home500Only',productType:'internet500',label:'인터넷 500MB'},
        '1g':{itemKey:'home1GBOnly',productType:'internet1g',label:'인터넷 1GB'}
      };
      const speed=speedMap[homeInternetSpeed];
      if(speed) products.push({groupKey:'homeFlat',...speed});
    }
    const simulMap={
      newChange:{itemKey:'addNewChange',productType:'simulNewChange',label:'신규/기변 동시판매'},
      mnp:{itemKey:'addMnp',productType:'simulMnp',label:'MNP 동시판매'},
      usedMnp:{itemKey:'addUsedMnp',productType:'simulUsedMnp',label:'중고MNP 동시판매 (85군↑ 선약, 가정망)'}
    };
    if(homeMobileSimul!=='none' && simulMap[homeMobileSimul]) products.push({groupKey:'homeAddon',...simulMap[homeMobileSimul]});
    if(homeSubTv){
      if(homeSubTvType==='free') products.push({groupKey:'homeFlat',itemKey:'tvFree',productType:'tvFree',label:'TV프리(부)'});
      else products.push({groupKey:'homeAddon',itemKey:'addSetTop',productType:'subSetTop',label:'일반 부셋탑'});
    }
    if(homeSmartHome) products.push({groupKey:'homeFlat',itemKey:'smartHome',productType:'smartHome',label:'스마트홈'});

    const editingRefs=new Set((editingHomeSales||[]).map(x=>String(x.source_ref||'')));
    const {data:possibleDuplicates,error:duplicateError}=await supabase.from('home_orders')
      .select('id,customer_name,product_type,source_work_date,status')
      .eq('user_id',currentEmp.id).eq('source_work_date',sourceWorkDate);
    if(duplicateError)return showAppToast(`중복 확인 실패: ${friendlyError(duplicateError)}`,{tone:'error'});
    const normalizedName=customer.replace(/\s+/g,'').toLowerCase();
    const sameCustomer=(possibleDuplicates||[]).filter(x=>!editingRefs.has(String(x.id))&&String(x.customer_name||'').replace(/\s+/g,'').toLowerCase()===normalizedName);
    const overlapping=sameCustomer.filter(x=>products.some(p=>p.productType===x.product_type));
    if(sameCustomer.length){
      const ok=await showAppConfirm({
        title:overlapping.length?'중복 등록 가능성이 있어요':'같은 날 동일 고객이 있어요',
        message:overlapping.length
          ? `${sourceWorkDate} · ${customer}\n같은 홈 상품 ${overlapping.length}개가 이미 저장돼 있어요. 그래도 등록할까요?`
          : `${sourceWorkDate} · ${customer}\n다른 홈 상품이 이미 저장돼 있어요. 추가 등록이 맞는지 확인해주세요.`,
        confirmLabel:'확인 후 등록',tone:'warning'
      });
      if(!ok)return;
    }

    let linkedCustomerId=null;
    try { linkedCustomerId=await ensureCustomer(currentEmp.id,customer,sourceWorkDate); }
    catch(e){ return showLegacyAlert(`고객 저장 실패: ${friendlyError(e)}`); }

    homeSubmitGuardRef.current=true;
    setHomeOrderSaving(true);
    try{
      const appliedAt=new Date(`${sourceWorkDate}T12:00:00`).toISOString();
      let workingDay=normalizeDay(day);
      // 구버전 홈 집계 1건을 정상 고객별 홈 판매로 전환: 원본 집계 1건을 먼저 차감
      if(homeOrderDraft?.legacyConversion && legacyConversion?.kind==='home'){
        const base=workingDay;
        const groups={...base.groups,[legacyConversion.groupKey]:{...(base.groups?.[legacyConversion.groupKey]||{})}};
        groups[legacyConversion.groupKey][legacyConversion.itemKey]=Math.max(
          0,Number(groups[legacyConversion.groupKey][legacyConversion.itemKey]||0)-1
        );
        workingDay={...base,groups};
      }
      // v21.19 홈 수정: 기존 묶음의 원천 실적/주문/판매건을 제거한 뒤 수정값으로 재구성
      if(homeOrderDraft?.editing && editingHomeSales.length){
        const base=workingDay; const groups={...base.groups};
        for(const oldSale of editingHomeSales){
          const ref=oldSale.source_ref; if(!ref)continue;
          const {data:o}=await supabase.from('home_orders').select('*').eq('id',ref).maybeSingle();
          if(o?.status==='completed' && o.source_group && o.source_key){
            groups[o.source_group]={...(groups[o.source_group]||{})};
            groups[o.source_group][o.source_key]=Math.max(0,Number(groups[o.source_group][o.source_key]||0)-1);
          }
        }
        workingDay={...base,groups};
        const ids=editingHomeSales.map(x=>x.id); const refs=editingHomeSales.map(x=>x.source_ref).filter(Boolean);
        if(ids.length){ await supabase.from('customer_tasks').delete().in('source_sale_id',ids).eq('user_id',currentEmp.id); await supabase.from('sales_expenses').delete().in('source_sale_id',ids).eq('user_id',currentEmp.id); await supabase.from('customer_sales').delete().in('id',ids).eq('user_id',currentEmp.id); }
        if(refs.length)await supabase.from('home_orders').delete().in('id',refs).eq('user_id',currentEmp.id);
      }
      const now=new Date().toISOString();
      let primarySaleId=null;
      for(const product of products){
        const {data:order,error}=await supabase.from('home_orders').insert({
          user_id:currentEmp.id,customer_name:customer,customer_id:linkedCustomerId,
          product_type:product.productType,network_type:homeNetworkType,sale_type:homeSaleType,
          status:homeDirectComplete?'completed':'pending',applied_at:appliedAt,
          completed_at:homeDirectComplete?new Date(`${homeActualCompleteDate}T12:00:00`).toISOString():null,source_work_date:sourceWorkDate,
          source_group:product.groupKey,source_key:product.itemKey,
          planned_install_date:homePlannedDate||null,actual_install_date:homeDirectComplete?homeActualCompleteDate:null,
          schema_version:CURRENT_SALE_SCHEMA_VERSION,
        }).select('id').single();
        if(error)throw error;
        const {data:sale,error:saleError}=await supabase.from('customer_sales').insert({
          user_id:currentEmp.id,customer_id:linkedCustomerId,sale_date:sourceWorkDate,
          metric_label:product.label,source_type:'home_order',source_ref:String(order?.id||''),
          schema_version:CURRENT_SALE_SCHEMA_VERSION,
          source_meta:withCurrentSaleSchema({
            networkType:homeNetworkType,saleType:homeSaleType,internetSpeed:homeInternetSpeed||null,
            mobileSimul:homeMobileSimul||'none',unifiedHome:true,directComplete:homeDirectComplete,
            simulBase:homeInternet?'home':(!homeInternet&&homeSmartHome?'smartHome':null)
          })
        }).select('id').single();
        if(saleError)throw saleError;
        if(!primarySaleId)primarySaleId=sale.id;
      }

      // 홈 약속은 모바일 템플릿 없이 직접 작성만 저장
      const homePromiseRows=[{title:homeCustomTitle,dueDate:homeCustomDueDate},...(homeExtraPromises||[])].filter(x=>String(x.title||'').trim()&&x.dueDate);
      if(homePromiseRows.length&&primarySaleId){
        const {error:taskError}=await supabase.from('customer_tasks').insert(homePromiseRows.map(x=>({
          user_id:currentEmp.id,customer_id:linkedCustomerId,source_sale_id:primarySaleId,task_type:'custom',title:String(x.title).trim(),base_date:sourceWorkDate,due_date:x.dueDate,status:'pending'
        })));
        if(taskError)throw taskError;
      }

      if(homeSpotPolicyId){
        const {error}=await supabase.from('spot_claims').insert({policy_id:homeSpotPolicyId,user_id:currentEmp.id,claim_date:sourceWorkDate,customer_name:customer,status:'pending',source_context:'home'}); if(error)throw error;
      } else if(homeSpotDirectOpen&&homeSpotDirectTitle.trim()&&Number(homeSpotDirectAmount)>0){
        const {error}=await supabase.from('spot_claims').insert({policy_id:null,user_id:currentEmp.id,claim_date:sourceWorkDate,customer_name:customer,status:'pending',direct_title:homeSpotDirectTitle.trim(),direct_amount:Number(homeSpotDirectAmount),direct_memo:homeSpotDirectMemo.trim()||null,source_context:'home'}); if(error)throw error;
      }
      if(homeExpenseOpen&&primarySaleId){
        const expRows=[{category:homeExpenseCategory,amount:homeExpenseAmount,memo:homeExpenseMemo},...(homeExtraExpenses||[])].filter(x=>Number(x.amount)>0);
        if(expRows.length){ const {error}=await supabase.from('sales_expenses').insert(expRows.map(x=>({user_id:currentEmp.id,source_sale_id:primarySaleId,expense_date:sourceWorkDate,amount:Number(x.amount),category:x.category||'기타',customer_name:customer,memo:String(x.memo||'').trim()||null}))); if(error)throw error; }
      }

      if(homeDirectComplete){
        const base=workingDay; const groups={...base.groups};
        products.forEach(product=>{ groups[product.groupKey]={...(groups[product.groupKey]||{}),[product.itemKey]:Number(groups[product.groupKey]?.[product.itemKey]||0)+1}; });
        workingDay={...base,groups};
      }
      if(homeOrderDraft?.legacyConversion){
        await persistLegacyConvertedDay(workingDay);
      }else if(homeOrderDraft?.editing || homeDirectComplete){
        mutate(workingDay);
      }

      notifyStoreManagers({actorId:currentEmp.id,type:homeDirectComplete?'home_completed':'home_order',title:homeDirectComplete?'홈 설치/개통 완료':'새 홈 청약 등록',message:`${customer} · ${homeNetworkLabel(homeNetworkType)} · ${products.map(p=>p.label).join(' + ')}`,payload:{employee_id:currentEmp.id,customer_name:customer,network_type:homeNetworkType,internet_speed:homeInternetSpeed||null,mobile_simul:homeMobileSimul||'none',status:homeDirectComplete?'completed':'pending',source_work_date:sourceWorkDate}});
      const resultId=`home-${Date.now()}`;
      setToast({id:resultId,source:'home',kind:'normal',customerName:customer,label:products.map(p=>p.label).join(' + '),title:'홈 판매 등록 완료',sub:homeDirectComplete?'설치완료 실적으로 반영했어요':'설치대기로 등록했어요',promiseCount:homePromiseRows.length,customerSaleId:primarySaleId,pointDelta:0});
      setTimeout(()=>setToast(t=>t?.id===resultId?null:t),10000);
      setHomeOrderDraft(null); setEditingHomeSales([]); setLegacyConversion(null); setHomeCustomerName(''); setHomeNetworkType(''); setHomeInternetSpeed(''); setHomeMobileSimul('none');
      setTimeout(loadDaySales,150);
    }catch(e){ showAppToast(friendlyError(e),{tone:'error',title:'홈 상품 등록 실패'}); }
    finally{ homeSubmitGuardRef.current=false; setHomeOrderSaving(false); }
  };

  const submitExtraInput=async()=>{
    if(!extraInput||locked)return;
    const base=normalizeDay(day); const count=Math.max(1,Number(extraCount||1));
    if(extraInput==='sono'){
      const groups={...base.groups,sono:{...(base.groups?.sono||{})}}; groups.sono[extraSonoKey]=Number(groups.sono[extraSonoKey]||0)+count; mutate({...base,groups});
    } else if(extraInput==='tailored') mutate({...base,tailoredCount:Number(base.tailoredCount||0)+count,tailoredAmount:Number(base.tailoredAmount||0)+Number(extraAmount||0)});
    else if(extraInput==='customerReg') mutate({...base,custRegCount:Number(base.custRegCount||0)+count});
    if(extraCustomer.trim()){
      try{const cid=await ensureCustomer(currentEmp.id,extraCustomer.trim(),`${month}-${selectedDay}`);await supabase.from('customer_sales').insert({user_id:currentEmp.id,customer_id:cid,sale_date:`${month}-${selectedDay}`,metric_label:extraInput==='sono'?(config.sono||DEFAULT_SONO).find(x=>x.key===extraSonoKey)?.label||'소노':extraInput==='tailored'?`맞춤제안 ${count}건 · ${won(Number(extraAmount||0))}`:`고객등록 ${count}건`,source_type:'extra',schema_version:CURRENT_SALE_SCHEMA_VERSION,source_meta:withCurrentSaleSchema({extraType:extraInput,count,amount:Number(extraAmount||0),sonoKey:extraSonoKey})});}catch(e){console.error(e)}
    }
    setExtraInput(null);setExtraCustomer('');setExtraCount('1');setExtraAmount('');setTimeout(loadDaySales,100);
  };

  const selectDay = (key) => { flush(); setSelectedDay(key); };

  const FEEDBACK_MESSAGES = [
    { title: '오늘도 실적 한 스푼!', sub: '고생했어요 😊' },
    { title: '좋아요! 오늘도 하나 쌓였어요', sub: '차곡차곡 가고 있어요 🙌' },
    { title: '차곡차곡 쌓이는 중이에요', sub: '오늘도 한 걸음 전진 ✨' },
    { title: '오늘의 실적 +1!', sub: '수고했어요 👍' },
    { title: '좋은 흐름이에요', sub: '하나 더 쌓였습니다 🔥' },
  ];

  const commitMobileOne = (ri, ci, customerMeta = {}) => {
    if (locked) return;

    const beforeDay = normalizeDay(customerMeta.baseDayOverride || day);
    const nextMatrix = beforeDay.matrix.map((row) => [...row]);
    nextMatrix[ri][ci] = (nextMatrix[ri][ci] || 0) + 1;
    const vasKeys = Array.isArray(customerMeta.vasKeys) ? customerMeta.vasKeys : [];
    const nextVas = { ...(beforeDay.groups?.vas || {}) };
    vasKeys.forEach((key) => {
      if (key !== 'vasNone') nextVas[key] = Number(nextVas[key] || 0) + 1;
    });
    const nextBundle2nd = { ...(beforeDay.groups?.bundle2nd || {}) };
    (customerMeta.bundle2ndKeys || []).forEach((key) => { nextBundle2nd[key] = Number(nextBundle2nd[key] || 0) + 1; });
    const nextMnpBundle = { ...(beforeDay.groups?.mnpBundle || {}) };
    if (customerMeta.usedMnpBundle) nextMnpBundle.usedMnpBundle = Number(nextMnpBundle.usedMnpBundle || 0) + 1;

    const nextDay = {
      ...beforeDay,
      specialMatrixOffset: Number(beforeDay.specialMatrixOffset||0)+Number(customerMeta.specialMatrixOffset||0),
      specialVasOffset: Number(beforeDay.specialVasOffset||0)+Number(customerMeta.specialVasOffset||0),
      specialReplacementPay: Number(beforeDay.specialReplacementPay||0)+Number(customerMeta.specialReplacementPay||0),
      bundleFreeOffset: Number(beforeDay.bundleFreeOffset||0)+Number(customerMeta.bundleFreeOffset||0),
      bundleFreeVasOffset: Number(beforeDay.bundleFreeVasOffset||0)+Number(customerMeta.bundleFreeVasOffset||0),
      matrix: nextMatrix,
      groups: {
        ...beforeDay.groups,
        vas: nextVas,
        bundle2nd: nextBundle2nd,
        mnpBundle: nextMnpBundle,
      },
    };

    // 현재 달 전체 실적을 등록 직전/직후로 각각 계산
    const beforeDays = { ...dailyDays, [selectedDay]: beforeDay };
    const afterDays = { ...dailyDays, [selectedDay]: nextDay };

    const beforeDraft = applyDailyToDraft(
      draft,
      beforeDays,
      month,
      config.categoryMap,
      config.gibyeonColumnMap
    );
    const afterDraft = applyDailyToDraft(
      draft,
      afterDays,
      month,
      config.categoryMap,
      config.gibyeonColumnMap
    );

    const position = currentEmp?.position || '사원';
    const hireDate = currentEmp?.hireDate;

    const beforePay = computePay(beforeDraft, position, hireDate, month, config);
    const afterPay = computePay(afterDraft, position, hireDate, month, config);
    // 저장 피드백은 최저보장과 비교한 마감 예상액이 아니라,
    // 이번 판매로 실제 누적된 판매 인센티브·활동지원금·등급 보너스의 증가분을 보여줍니다.
    const payDelta = Math.max(0, Number(afterPay.currentPerformanceAmount||0) - Number(beforePay.currentPerformanceAmount||0));
    const salePayDelta = Math.max(0,
      Number(afterPay.mobileMatrixPay||0)-Number(beforePay.mobileMatrixPay||0)
      + Number(afterPay.vasPay||0)-Number(beforePay.vasPay||0)
      + Number(afterPay.specialReplacementPay||0)-Number(beforePay.specialReplacementPay||0)
      + Number(afterPay.mnpBundlePay||0)-Number(beforePay.mnpBundlePay||0)
    );
    const activityPayDelta = Math.max(0,Number(afterPay.tenurePay||0)-Number(beforePay.tenurePay||0));
    const bonusPayDelta = Math.max(0,payDelta-salePayDelta-activityPayDelta);

    const rowDef = MATRIX_ROW_DEFS[ri];
    const label = rowDef.hasTiers
      ? `${rowDef.dailyLabel || rowDef.label} · ${MATRIX_COLS[ci]}`
      : (rowDef.dailyLabel || rowDef.label);

    // 이번 한 건으로 실제 목표를 넘었는지 확인
    const gradeUp = beforePay.grade !== afterPay.grade && afterPay.gradeEligible;
    const homeGateAchieved = !beforePay.gradeEligible && afterPay.gradeEligible;

    let feedback;
    if (gradeUp) {
      feedback = {
        kind: 'achievement',
        title: '목표 달성! 🎉',
        sub: `${afterPay.grade}등급에 도달했어요`,
      };
    } else if (homeGateAchieved) {
      feedback = {
        kind: 'achievement',
        title: '목표 달성! 🎉',
        sub: '홈 최소조건을 달성했어요',
      };
    } else {
      const msg = FEEDBACK_MESSAGES[Math.floor(Math.random() * FEEDBACK_MESSAGES.length)];
      feedback = { kind: 'normal', ...msg };
    }

    // 실제 입력 반영
    mutate(nextDay);

    notifyStoreManagers({
      actorId: currentEmp?.id,
      type: 'daily_input',
      title: `${currentEmp?.name || '직원'}님이 실적을 등록했어요`,
      message: `${label} 1건`,
      payload: {
        employee_id: currentEmp?.id,
        employee_name: currentEmp?.name,
        store_name: currentEmp?.branch,
        month,
        day: selectedDay,
        label,
      },
    });

    const toastId = `${Date.now()}-${ri}-${ci}`;
    setToast({
      id: toastId,
      source:'mobile',
      label,
      ri,
      ci,
      ...feedback,
      payDelta,
      salePayDelta,
      activityPayDelta,
      bonusPayDelta,
      pointDelta:Number(afterPay.totalPoints||0)-Number(beforePay.totalPoints||0),
      currentTotal: afterPay.currentPerformanceAmount,
      customerName:customerMeta.customerName||'',
      promiseCount:Number(customerMeta.promiseCount||0),
      customerSaleId: customerMeta.saleId || null,
      vasKeys: Array.isArray(customerMeta.vasKeys) ? customerMeta.vasKeys : [],
      specialMatrixOffset:Number(customerMeta.specialMatrixOffset||0),specialVasOffset:Number(customerMeta.specialVasOffset||0),specialReplacementPay:Number(customerMeta.specialReplacementPay||0),
      bundleFreeOffset:Number(customerMeta.bundleFreeOffset||0),bundleFreeVasOffset:Number(customerMeta.bundleFreeVasOffset||0),
      bundle2ndKeys:Array.isArray(customerMeta.bundle2ndKeys)?customerMeta.bundle2ndKeys:[],
    });

    setTimeout(() => {
      setToast((t) => (t && t.id === toastId ? null : t));
    }, 10000);
  };


  const mobileLabelFor=(ri,ci)=>{
    const rowDef=MATRIX_ROW_DEFS[ri];
    if(!rowDef)return '';
    return rowDef.hasTiers
      ? `${rowDef.dailyLabel||rowDef.label} · ${MATRIX_COLS[ci]}`
      : (rowDef.dailyLabel||rowDef.label);
  };

  const inferMobileMeta=(sale)=>{
    const meta=sale?.source_meta&&typeof sale.source_meta==='object'?sale.source_meta:{};
    const cleanArray=(v)=>Array.isArray(v)?v:[];
    const cleanObj=(v)=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
    let ri=Number.isInteger(meta.ri)?meta.ri:null;
    let ci=Number.isInteger(meta.ci)?meta.ci:null;

    // 구버전은 ri/ci가 없을 수 있으므로 사람이 읽는 metric_label에서 복원
    if(ri===null){
      const label=String(sale?.metric_label||'')
        .replace(/기변\s*A/gi,'기기변경 A')
        .replace(/기변\s*B/gi,'기기변경 B')
        .replace(/기변\s*C/gi,'기기변경 C');
      ri=MATRIX_ROW_DEFS.findIndex(r=>label.startsWith(r.dailyLabel||r.label));
      if(ri<0)ri=MATRIX_ROW_DEFS.findIndex(r=>label.includes(r.dailyLabel||r.label));
      if(ri<0)return null;
      const rowDef=MATRIX_ROW_DEFS[ri];
      ci=0;
      if(rowDef?.hasTiers){
        const found=MATRIX_COLS.findIndex(c=>label.includes(c));
        if(found>=0)ci=found;
      }
    }
    if(ci===null || ci<0)ci=0;

    return {
      ri,ci,
      vasKeys:cleanArray(meta.vasKeys),
      bundle2ndKeys:cleanArray(meta.bundle2ndKeys),
      bundleVasMap:cleanObj(meta.bundleVasMap),
      bundleSaleTypeMap:cleanObj(meta.bundleSaleTypeMap),
      usedMnpBundle:!!meta.usedMnpBundle,
      specialPolicy:cleanObj(meta.specialPolicy),
      schemaVersion:saleSchemaVersion(sale),
      rawMeta:meta,
    };
  };

  // v21.38: 구 UI에서 customer_sales 없이 daily_records에만 저장된 모바일 실적을 분리
  const representedMobileMatrix=useMemo(()=>{
    const matrix=emptyDayMatrix();
    (daySales||[]).forEach(sale=>{
      if(sale.source_type==='home_order' || sale.source_type==='extra')return;
      const meta=inferMobileMeta(sale);
      if(!meta)return;
      if(matrix[meta.ri] && Number.isInteger(meta.ci)){
        matrix[meta.ri][meta.ci]=Number(matrix[meta.ri][meta.ci]||0)+1;
      }
    });
    return matrix;
  },[daySales,config]);

  const legacyMobileMatrix=useMemo(()=>{
    const d=normalizeDay(day);
    return d.matrix.map((row,ri)=>row.map((cnt,ci)=>
      Math.max(0,Number(cnt||0)-Number(representedMobileMatrix?.[ri]?.[ci]||0))
    ));
  },[day,representedMobileMatrix]);

  const legacyMobileCount=useMemo(()=>
    legacyMobileMatrix.reduce((sum,row)=>sum+row.reduce((a,v)=>a+Number(v||0),0),0)
  ,[legacyMobileMatrix]);


  const legacySaleRows=useMemo(()=>{
    const rows=[];
    // 모바일: 현재 customer_sales로 설명되지 않는 matrix 잔여분을 1건씩 풀어서 표시
    (legacyMobileMatrix||[]).forEach((row,ri)=>(row||[]).forEach((cnt,ci)=>{
      const n=Math.max(0,Math.floor(Number(cnt||0)));
      const rd=MATRIX_ROW_DEFS[ri];
      for(let i=0;i<n;i++){
        rows.push({
          id:`legacy-mobile-${ri}-${ci}-${i}`,
          kind:'mobile',ri,ci,
          title:rd?.dailyLabel||rd?.label||'모바일',
          detail:rd?.hasTiers?(MATRIX_COLS[ci]||''):'',
        });
      }
    }));

    // 홈: 현재 customer_sales로 설명되는 홈 건수를 빼고 남은 집계만 '이름 없음'으로 표시
    const d=normalizeDay(day);
    const representedHome={};
    const addRep=(g,k)=>{const key=`${g}.${k}`;representedHome[key]=Number(representedHome[key]||0)+1};
    (daySales||[]).filter(x=>x.source_type==='home_order').forEach(sale=>{
      const pt=inferHomeProductTypeFromLabel(sale.metric_label);
      if(pt==='homeOnly')addRep('homeBase','homeOnly');
      else if(pt==='homeTv')addRep('homeBase','homeTv');
      else if(pt==='tvFree')addRep('homeFlat','tvFree');
      else if(pt==='smartHome')addRep('homeFlat','smartHome');
      else if(pt==='internet100')addRep('homeFlat','home100Only');
      else if(pt==='internet500')addRep('homeFlat','home500Only');
      else if(pt==='internet1g')addRep('homeFlat','home1GBOnly');
    });
    const left=(g,k)=>Math.max(0,Math.floor(Number(d.groups?.[g]?.[k]||0)-Number(representedHome[`${g}.${k}`]||0)));
    const homeDefs=[
      {g:'homeBase',k:'homeOnly',title:'홈 단독',preset:'homeOnly'},
      {g:'homeBase',k:'homeTv',title:'홈+TV',preset:'homeTv'},
      {g:'homeFlat',k:'tvFree',title:'TV프리(부)',preset:'tvFree'},
      {g:'homeFlat',k:'smartHome',title:'스마트홈',preset:'smartHome'},
    ];
    homeDefs.forEach(def=>{
      const n=left(def.g,def.k);
      for(let i=0;i<n;i++)rows.push({
        id:`legacy-home-${def.g}-${def.k}-${i}`,
        kind:'home',groupKey:def.g,itemKey:def.k,title:def.title,preset:def.preset
      });
    });

    // 본상품 잔여가 없는데 속도 집계만 남은 경우만 별도 판매건으로 보여 과거 중복 구성 추정을 피함
    const leftoverHomeBase=left('homeBase','homeOnly')+left('homeBase','homeTv');
    if(leftoverHomeBase===0){
      [
        ['home100Only','인터넷 100MB','100'],
        ['home500Only','인터넷 500MB','500'],
        ['home1GBOnly','인터넷 1GB','1g'],
      ].forEach(([k,title,speed])=>{
        const n=left('homeFlat',k);
        for(let i=0;i<n;i++)rows.push({
          id:`legacy-home-homeFlat-${k}-${i}`,
          kind:'home',groupKey:'homeFlat',itemKey:k,title,preset:'internet',speed
        });
      });
    }
    return rows;
  },[legacyMobileMatrix,day,daySales]);

  const openLegacySaleRow=(row)=>{
    if(locked)return;
    setLegacyConversion(row);
    if(row.kind==='mobile'){
      addOne(row.ri,row.ci);
      return;
    }

    // 홈 구버전은 기존 홈 입력 UI를 그대로 사용하고, 과거에 확인되는 항목만 미리 선택
    openHomeOrder();
    setHomeOrderDraft({unified:true,label:'홈 실적 수정',legacyConversion:true});
    setHomeCustomerName('');
    setHomeDirectComplete(true); // 이미 실적으로 집계돼 있던 건이므로 완료 실적으로 복원
    if(row.preset==='homeOnly'){
      setHomeInternet(true); setHomeMainTv(false);
    }else if(row.preset==='homeTv'){
      setHomeInternet(true); setHomeMainTv(true);
    }else if(row.preset==='tvFree'){
      setHomeSubTv(true); setHomeSubTvType('free');
    }else if(row.preset==='smartHome'){
      setHomeSmartHome(true);
    }else if(row.preset==='internet'){
      setHomeInternet(true); setHomeInternetSpeed(row.speed||'');
    }
  };

  const openLegacyEditor=()=>{
    setLegacyMatrixDraft(legacyMobileMatrix.map(row=>[...row]));
    setLegacyEditorOpen(true);
  };

  const saveLegacyEditor=async()=>{
    if(locked || !legacyMatrixDraft)return;
    const base=normalizeDay(day);
    const nextMatrix=base.matrix.map((row,ri)=>row.map((_,ci)=>
      Number(representedMobileMatrix?.[ri]?.[ci]||0)+Math.max(0,Number(legacyMatrixDraft?.[ri]?.[ci]||0))
    ));
    const next={...base,matrix:nextMatrix};
    setDay(next);
    const ok=await saveDailyDay(selectedDay,next);
    if(ok){
      setLegacyEditorOpen(false);
      setLegacyMatrixDraft(null);
    }
  };

  const openEditSale=async(sale)=>{
    if(sale.source_type==='home_order'){
      const saleDate=sale.sale_date;
      const {data:homeSales,error:hsErr}=await supabase.from('customer_sales')
        .select('id,customer_id,sale_date,metric_label,source_type,source_ref,source_meta,schema_version,customers(customer_name)')
        .eq('user_id',currentEmp?.id).eq('sale_date',saleDate).eq('customer_id',sale.customer_id).eq('source_type','home_order');
      if(hsErr)return showLegacyAlert(`홈 판매정보 조회 실패: ${friendlyError(hsErr)}`);
      const refs=(homeSales||[]).map(x=>x.source_ref).filter(Boolean);
      let orders=[];
      if(refs.length){ const {data:o,error:oErr}=await supabase.from('home_orders').select('*').in('id',refs); if(oErr)return showLegacyAlert(`홈 주문 조회 실패: ${friendlyError(oErr)}`); orders=o||[]; }
      setEditingHomeSales(homeSales||[]);
      setHomeOrderDraft({unified:true,editing:true,label:'홈 판매건 수정',legacy:(homeSales||[]).some(legacySaleBadge)});
      setHomeCustomerName(sale.customers?.customer_name||'');
      const meta0=(homeSales||[])[0]?.source_meta||sale.source_meta||{};
      const compatOrders=compatHomeRows(homeSales||[],orders||[]);
      setHomeNetworkType(compatOrders[0]?.network_type||meta0.networkType||'');
      setHomeInternet(compatOrders.some(o=>['homeOnly','homeTv','internet100','internet500','internet1g'].includes(o.product_type)));
      const speedFromOrders=compatOrders.some(o=>o.product_type==='internet1g')?'1g':compatOrders.some(o=>o.product_type==='internet500')?'500':compatOrders.some(o=>o.product_type==='internet100')?'100':'';
      setHomeInternetSpeed(meta0.internetSpeed||speedFromOrders||'');
      const simulFromOrders=compatOrders.some(o=>o.product_type==='simulUsedMnp')?'usedMnp':compatOrders.some(o=>o.product_type==='simulMnp')?'mnp':compatOrders.some(o=>o.product_type==='simulNewChange')?'newChange':'none';
      setHomeMobileSimul(meta0.mobileSimul||simulFromOrders||'none');
      setHomeMainTv(compatOrders.some(o=>o.product_type==='homeTv'));
      setHomeSubTv(compatOrders.some(o=>['subSetTop','tvFree'].includes(o.product_type)));
      setHomeSubTvType(compatOrders.some(o=>o.product_type==='tvFree')?'free':'normal');
      setHomeSmartHome(compatOrders.some(o=>o.product_type==='smartHome'));
      setHomeDirectComplete(compatOrders.length>0 && compatOrders.every(o=>o.status==='completed'));
      setHomeActualCompleteDate(compatOrders.find(o=>o.actual_install_date)?.actual_install_date?.slice?.(0,10)||'');
      setHomePlannedDate(compatOrders.find(o=>o.planned_install_date)?.planned_install_date?.slice?.(0,10)||'');
      const primary=(homeSales||[])[0];
      if(primary){
        const {data:tasks}=await supabase.from('customer_tasks').select('*').eq('source_sale_id',primary.id).eq('user_id',currentEmp?.id).neq('status','completed').order('created_at');
        const customs=(tasks||[]).filter(t=>t.task_type==='custom');
        setHomeCustomTitle(customs[0]?.title||''); setHomeCustomDueDate(customs[0]?.due_date||'');
        setHomeExtraPromises(customs.slice(1).map(t=>({title:t.title||'',dueDate:t.due_date||''})));
        const {data:expenses}=await supabase.from('sales_expenses').select('*').eq('source_sale_id',primary.id).eq('user_id',currentEmp?.id).order('created_at');
        const ex=expenses||[]; setHomeExpenseOpen(ex.length>0); setHomeExpenseCategory(ex[0]?.category||'오퍼'); setHomeExpenseAmount(ex[0]?.amount?String(ex[0].amount):''); setHomeExpenseMemo(ex[0]?.memo||'');
        setHomeExtraExpenses(ex.slice(1).map(e=>({category:e.category||'기타',amount:String(e.amount||''),memo:e.memo||''})));
      }
      return;
    }
    const inferredLegacyMobile=inferMobileMeta(sale);
    if(sale.source_type!=='mobile' && !inferredLegacyMobile)return showLegacyAlert('이 판매유형은 아직 수정할 수 없어요.');
    const meta=inferredLegacyMobile;
    if(!meta)return showLegacyAlert('이전 버전 판매건이라 가입구분을 확인할 수 없어요.');

    setEditingSale(sale);
    setMobileSaleDraft({ri:meta.ri,ci:meta.ci,label:mobileLabelFor(meta.ri,meta.ci)});
    setMobileCustomerName(sale.customers?.customer_name||'');
    setMobileVasKeys(Array.isArray(meta.vasKeys)?meta.vasKeys:[]);
    setMobileBundle2ndKeys(meta.bundle2ndKeys);
    setMobileBundleVasMap(meta.bundleVasMap);
    setMobileBundleSaleTypeMap(meta.bundleSaleTypeMap);
    setMobileUsedMnpBundle(meta.usedMnpBundle);
    setMobileSaleKind(meta.specialPolicy?.policyId ? 'special' : 'normal');
    setMobileSpecialPolicyId(meta.specialPolicy?.policyId||'');
    setMobileSpecialExceptionAmount(meta.specialPolicy?.exceptionRequestedAmount?String(meta.specialPolicy.exceptionRequestedAmount):'');
    setMobileSpotPolicyId('');
    setMobileSpotDirectOpen(false);
    setMobileExpenseOpen(false);

    const {data:tasks,error}=await supabase.from('customer_tasks')
      .select('*')
      .eq('source_sale_id',sale.id)
      .eq('user_id',currentEmp?.id)
      .order('created_at',{ascending:true});

    if(error){
      console.error('EDIT SALE TASK LOAD ERROR',error);
      setMobileCareKeys([]);
      setMobileCustomTitle('');
      setMobileCustomDueDate('');
      setMobileTargetPlan('');
      setEditingCompletedTaskCount(0);
      return;
    }

    const completed=(tasks||[]).filter(t=>t.status==='completed');
    const editable=(tasks||[]).filter(t=>t.status!=='completed');
    setEditingCompletedTaskCount(completed.length);
    setMobileCareKeys(editable
      .map(t=>t.task_type)
      .filter(k=>CARE_TEMPLATES.some(x=>x.key===k)));
    const customs=editable.filter(t=>t.task_type==='custom');
    const custom=customs[0];
    setMobileCustomTitle(custom?.title||'');
    setMobileCustomDueDate(custom?.due_date||'');
    setMobileExtraPromises(customs.slice(1).map(t=>({title:t.title||'',dueDate:t.due_date||''})));
    const {data:editExpenses}=await supabase.from('sales_expenses').select('*').eq('source_sale_id',sale.id).eq('user_id',currentEmp?.id).order('created_at');
    const ex=editExpenses||[]; setMobileExpenseOpen(ex.length>0); setMobileExpenseCategory(ex[0]?.category||'케이스'); setMobileExpenseAmount(ex[0]?.amount?String(ex[0].amount):''); setMobileExpenseMemo(ex[0]?.memo||''); setMobileExtraExpenses(ex.slice(1).map(e=>({category:e.category||'기타',amount:String(e.amount||''),memo:e.memo||''})));
    const plan=editable.find(t=>t.task_type==='plan93'||t.task_type==='plan183');
    setMobileTargetPlan(plan?.target_plan||'');
  };

  const addOne = (ri,ci) => {
    if(locked)return;
    setEditingSale(null);
    setEditingCompletedTaskCount(0);
    const label=mobileLabelFor(ri,ci);
    setMobileSaleDraft({ri,ci,label});
    setMobileCustomerName('');
    setMobileCareKeys([]);
    setMobileCustomTitle('');
    setMobileCustomDueDate('');
    setMobileTargetPlan('');
    setMobileVasKeys([]);
    setMobileStrategicPlan(false);
    setMobileBundle2ndKeys([]);
    setMobileBundleSearch('');
    setMobileBundleVasMap({});
    setMobileBundleSaleTypeMap({});
    setMobileUsedMnpBundle(false);
    setMobileSpotPolicyId('');
    setMobileSpotDirectOpen(false);
    setMobileSpotDirectTitle('');
    setMobileSpotDirectAmount('');
    setMobileSpotDirectMemo('');
    setMobileExpenseOpen(false);
    setMobileExpenseCategory('케이스');
    setMobileExpenseAmount('');
    setMobileExpenseMemo('');
    setMobileExtraPromises([]); setMobileExtraExpenses([]); setMobileSaleKind('normal'); setMobileSpecialPolicyId(''); setMobileSpecialExceptionAmount('');
  };

  const bundleFreeAmounts = (bundleKeys=mobileBundle2ndKeys, vasMap=mobileBundleVasMap, saleTypeMap=mobileBundleSaleTypeMap) => {
    const bundleTable=config.bundle2nd||DEFAULT_BUNDLE2ND;
    const vasTable=config.vas||DEFAULT_VAS;
    let bundleOffset=0, vasOffset=0;
    (bundleKeys||[]).forEach(k=>{
      if((saleTypeMap?.[k]||'normal')!=='free')return;
      bundleOffset += Number(bundleTable.find(x=>x.key===k)?.rate||0);
      (vasMap?.[k]||[]).filter(v=>v!=='vasNone').forEach(v=>{
        vasOffset += Number(vasTable.find(x=>x.key===v)?.rate||0);
      });
    });
    return {bundleOffset,vasOffset};
  };


  // v21.46: 구버전 1건을 정상 판매건으로 전환할 때는
  // 화면 상태의 느린 자동저장에 의존하지 않고 원본 일일 집계를 즉시 DB에 저장합니다.
  const persistLegacyConvertedDay=async(nextDay)=>{
    const normalized=normalizeDay(nextDay);
    setDay(normalized);
    // 반드시 상위 saveDailyDay를 거쳐야 dailyRecords 상태도 함께 갱신되고
    // mergedDraft → 생산성 → 예상급여가 즉시 다시 계산됩니다.
    const ok=await saveDailyDay(selectedDay,normalized);
    if(!ok)throw new Error('일일 실적 저장에 실패했습니다.');
    pendingRef.current=null;
    setSaveState('saved');
    setTimeout(()=>setSaveState('idle'),1200);
    return normalized;
  };

  const submitMobileSale = async () => {
    if(!mobileSaleDraft||!currentEmp?.id||mobileSubmitGuardRef.current)return;
    const customer=mobileCustomerName.trim();
    if(!customer)return showAppToast('고객명을 입력해야 실적을 등록할 수 있어요.',{tone:'error'});
    if(mobileSaleKind==='special' && !mobileSpecialPolicyId){
      return showLegacyAlert(specialPolicies.length
        ? '특판·지인판매에 적용할 정책을 선택해주세요.'
        : '현재 적용 가능한 특판·지인판매 정책이 없어요. 관리자에게 정책 등록을 요청해주세요.');
    }
    const saleDate=`${month}-${selectedDay}`;
    const allowedSecondKeys=new Set([...allowedSecondVas(config.vas||DEFAULT_VAS).map(x=>x.key),'vasNone']);
    const invalidSecondVas=Object.entries(mobileBundleVasMap||{}).flatMap(([bundle,keys])=>(keys||[]).filter(k=>!allowedSecondKeys.has(k)).map(k=>({bundle,key:k})));
    if(invalidSecondVas.length)return showAppToast('2ND에서 선택할 수 없는 부가서비스가 포함돼 있어요. VAS를 다시 선택해주세요.',{tone:'error'});

    const {data:existingSales,error:existingError}=await supabase.from('customer_sales')
      .select('id,metric_label,source_type,customers(customer_name)')
      .eq('user_id',currentEmp.id).eq('sale_date',saleDate);
    if(existingError)return showAppToast(`중복 확인 실패: ${friendlyError(existingError)}`,{tone:'error'});
    const normalizedName=customer.replace(/\s+/g,'').toLowerCase();
    const sameCustomer=(existingSales||[]).filter(x=>x.id!==editingSale?.id&&String(x.customers?.customer_name||'').replace(/\s+/g,'').toLowerCase()===normalizedName);
    const sameProduct=sameCustomer.filter(x=>x.metric_label===mobileSaleDraft.label);
    if(sameCustomer.length){
      const ok=await showAppConfirm({
        title:sameProduct.length?'중복 등록 가능성이 있어요':'같은 날 동일 고객이 있어요',
        message:sameProduct.length
          ? `${saleDate} · ${customer} · ${mobileSaleDraft.label}\n동일한 판매건이 이미 있어요. 그래도 저장할까요?`
          : `${saleDate} · ${customer}\n다른 판매건이 이미 있어요. 추가 등록이 맞는지 확인해주세요.`,
        confirmLabel:'확인 후 저장',tone:'warning'
      });
      if(!ok)return;
    }
    mobileSubmitGuardRef.current=true;
    setMobileSaleSaving(true);

    try{
      // 기존 판매건 수정
      if(editingSale){
        const oldMeta=inferMobileMeta(editingSale);
        if(!oldMeta)throw new Error('기존 판매정보를 확인할 수 없습니다.');

        const linkedCustomerId=await ensureCustomer(currentEmp.id,customer,saleDate);
        if(!linkedCustomerId)throw new Error('고객 저장 실패');

        // 일일 실적: 기존 1건 차감 → 수정값 1건 추가
        const base=normalizeDay(day);
        const matrix=base.matrix.map(r=>[...r]);
        matrix[oldMeta.ri][oldMeta.ci]=Math.max(0,Number(matrix[oldMeta.ri][oldMeta.ci]||0)-1);
        matrix[mobileSaleDraft.ri][mobileSaleDraft.ci]=Number(matrix[mobileSaleDraft.ri][mobileSaleDraft.ci]||0)+1;

        const vas={...(base.groups?.vas||{})};
        const oldBundleVasKeys=Object.values(oldMeta.bundleVasMap||{}).flat();
        [...(oldMeta.vasKeys||[]),...oldBundleVasKeys].forEach(k=>{ if(k!=='vasNone') vas[k]=Math.max(0,Number(vas[k]||0)-1); });
        const newBundleVasKeys=Object.values(mobileBundleVasMap||{}).flat();
        [...(mobileVasKeys||[]),...newBundleVasKeys].forEach(k=>{
          if(k!=='vasNone')vas[k]=Number(vas[k]||0)+1;
        });

        const bundle2nd={...(base.groups?.bundle2nd||{})};
        (oldMeta.bundle2ndKeys||[]).forEach(k=>{bundle2nd[k]=Math.max(0,Number(bundle2nd[k]||0)-1)});
        (mobileBundle2ndKeys||[]).forEach(k=>{bundle2nd[k]=Number(bundle2nd[k]||0)+1});
        const mnpBundle={...(base.groups?.mnpBundle||{})};
        if(oldMeta.usedMnpBundle)mnpBundle.usedMnpBundle=Math.max(0,Number(mnpBundle.usedMnpBundle||0)-1);
        if(Number(mobileSaleDraft.ri)===5 && Number(mobileSaleDraft.ci)<=3 && mobileUsedMnpBundle)mnpBundle.usedMnpBundle=Number(mnpBundle.usedMnpBundle||0)+1;

        const oldSp=oldMeta.specialPolicy||editingSale.source_meta?.specialPolicy||{};
        const oldFree=bundleFreeAmounts(oldMeta.bundle2ndKeys||[],oldMeta.bundleVasMap||{},oldMeta.bundleSaleTypeMap||{});
        const newFree=bundleFreeAmounts();
        const newPolicy=specialPolicies.find(p=>p.id===mobileSpecialPolicyId);
        const newMatrixFee=mobileSpecialPolicyId?Number(config.matrix?.[mobileSaleDraft.ri]?.[mobileSaleDraft.ci]||0):0;
        const payableBundleVas=Object.entries(mobileBundleVasMap||{}).flatMap(([bk,keys])=>
          (mobileBundleSaleTypeMap?.[bk]||'normal')==='free' ? [] : (keys||[])
        );
        const editAllVas=[...(mobileVasKeys||[]),...payableBundleVas].filter(k=>k!=='vasNone');
        const newVasFee=mobileSpecialPolicyId?editAllVas.reduce((sum,k)=>sum+Number((config.vas||[]).find(v=>v.key===k)?.rate||0),0):0;
        const req=Number(mobileSpecialExceptionAmount||0);
        const newReplacement=mobileSpecialPolicyId?(req>0?0:Number(newPolicy?.replacement_amount||oldSp.replacementAmount||0)):0;
        const oldReplacement=Number(oldSp.exceptionStatus==='approved'?oldSp.exceptionApprovedAmount:oldSp.exceptionStatus==='pending'?0:oldSp.replacementAmount||0);
        const nextMeta=withCurrentSaleSchema(mergeSaleMetaPreservingLegacy(editingSale.source_meta||{}, {
          legacySchemaVersion:saleSchemaVersion(editingSale),
          ri:mobileSaleDraft.ri,ci:mobileSaleDraft.ci,strategicPlan:!!mobileStrategicPlan,vasKeys:mobileVasKeys,bundle2ndKeys:mobileBundle2ndKeys,bundleVasMap:mobileBundleVasMap,bundleSaleTypeMap:mobileBundleSaleTypeMap,usedMnpBundle:(Number(mobileSaleDraft.ri)===5 && Number(mobileSaleDraft.ci)<=3 ? mobileUsedMnpBundle : false),
          specialPolicy: mobileSaleKind==='special' && mobileSpecialPolicyId ? {policyId:mobileSpecialPolicyId,policyTitle:newPolicy?.title||oldSp.policyTitle||'',replacementAmount:Number(newPolicy?.replacement_amount||oldSp.replacementAmount||0),normalMatrixFee:newMatrixFee,normalVasFee:newVasFee,exceptionRequestedAmount:req||null,exceptionStatus:req>0?'pending':null} : null
        }));

        const {error:saleUpdateError}=await supabase.from('customer_sales')
          .update({
            customer_id:linkedCustomerId,
            metric_label:mobileSaleDraft.label,
            schema_version:CURRENT_SALE_SCHEMA_VERSION,
            source_meta:nextMeta
          })
          .eq('id',editingSale.id)
          .eq('user_id',currentEmp.id);
        if(saleUpdateError)throw saleUpdateError;

        // 완료 약속은 보존하고, 미완료 약속만 현재 입력값으로 다시 구성
        await supabase.from('customer_tasks')
          .update({customer_id:linkedCustomerId,updated_at:new Date().toISOString()})
          .eq('source_sale_id',editingSale.id)
          .eq('user_id',currentEmp.id);

        const {error:deleteTaskError}=await supabase.from('customer_tasks')
          .delete()
          .eq('source_sale_id',editingSale.id)
          .eq('user_id',currentEmp.id)
          .neq('status','completed');
        if(deleteTaskError)throw deleteTaskError;

        const taskRows=[];
        mobileCareKeys.forEach(key=>{
          const t=CARE_TEMPLATES.find(x=>x.key===key);
          if(!t)return;
          taskRows.push({
            user_id:currentEmp.id,
            customer_id:linkedCustomerId,
            source_sale_id:editingSale.id,
            task_type:key,
            title:t.title,
            base_date:saleDate,
            retention_days:t.retentionDays,
            due_date:addDaysDate(saleDate,t.retentionDays),
            status:'pending',
            target_plan:(key==='plan93'||key==='plan183') ? mobileTargetPlan.trim()||null : null
          });
        });
        [{title:mobileCustomTitle,dueDate:mobileCustomDueDate},...(mobileExtraPromises||[])].filter(x=>String(x.title||'').trim()&&x.dueDate).forEach(x=>taskRows.push({
          user_id:currentEmp.id,customer_id:linkedCustomerId,source_sale_id:editingSale.id,task_type:'custom',title:String(x.title).trim(),base_date:saleDate,retention_days:null,due_date:x.dueDate,status:'pending'
        }));
        if(taskRows.length){ const {error:taskInsertError}=await supabase.from('customer_tasks').insert(taskRows); if(taskInsertError)throw taskInsertError; }
        await supabase.from('sales_expenses').delete().eq('source_sale_id',editingSale.id).eq('user_id',currentEmp.id);
        if(mobileExpenseOpen){ const expRows=[{category:mobileExpenseCategory,amount:mobileExpenseAmount,memo:mobileExpenseMemo},...(mobileExtraExpenses||[])].filter(x=>Number(x.amount)>0); if(expRows.length){ const {error:exErr}=await supabase.from('sales_expenses').insert(expRows.map(x=>({user_id:currentEmp.id,source_sale_id:editingSale.id,expense_date:saleDate,amount:Number(x.amount),category:x.category||'기타',customer_name:customer,memo:String(x.memo||'').trim()||null}))); if(exErr)throw exErr; } }

        mutate({...base,matrix,groups:{...base.groups,vas,bundle2nd,mnpBundle},specialMatrixOffset:Math.max(0,Number(base.specialMatrixOffset||0)-Number(oldSp.normalMatrixFee||0)+newMatrixFee),specialVasOffset:Math.max(0,Number(base.specialVasOffset||0)-Number(oldSp.normalVasFee||0)+newVasFee),specialReplacementPay:Math.max(0,Number(base.specialReplacementPay||0)-oldReplacement+newReplacement),
          bundleFreeOffset:Math.max(0,Number(base.bundleFreeOffset||0)-Number(oldFree.bundleOffset||0)+Number(newFree.bundleOffset||0)),
          bundleFreeVasOffset:Math.max(0,Number(base.bundleFreeVasOffset||0)-Number(oldFree.vasOffset||0)+Number(newFree.vasOffset||0))
        });
        setMobileSaleDraft(null);
        setEditingSale(null);
        setEditingCompletedTaskCount(0);
        setTimeout(loadDaySales,150);
        showAppToast('판매건과 고객 약속을 수정했어요.');
        return;
      }

      // 신규 판매 등록 / 구버전 1건 복원
      let legacyBaseOverride=null;
      if(legacyConversion?.kind==='mobile'){
        const base=normalizeDay(day);
        const matrix=base.matrix.map(r=>[...r]);
        matrix[legacyConversion.ri][legacyConversion.ci]=Math.max(0,Number(matrix[legacyConversion.ri][legacyConversion.ci]||0)-1);
        legacyBaseOverride={...base,matrix};
      }
      const saved=await createCustomerSaleAndTasks({
        userId:currentEmp.id,customerName:customer,saleDate,
        metricLabel:mobileSaleDraft.label,sourceType:'mobile',
        templateKeys:mobileCareKeys,customTitle:mobileCustomTitle,customDueDate:mobileCustomDueDate,
        targetPlan:mobileTargetPlan,
        sourceMeta:{ri:mobileSaleDraft.ri,ci:mobileSaleDraft.ci,strategicPlan:!!mobileStrategicPlan,vasKeys:mobileVasKeys,bundle2ndKeys:mobileBundle2ndKeys,bundleVasMap:mobileBundleVasMap,bundleSaleTypeMap:mobileBundleSaleTypeMap,usedMnpBundle:(Number(mobileSaleDraft.ri)===5 && Number(mobileSaleDraft.ci)<=3 ? mobileUsedMnpBundle : false),
          specialPolicy: mobileSaleKind==='special' && mobileSpecialPolicyId ? {policyId:mobileSpecialPolicyId,exceptionRequestedAmount:Number(mobileSpecialExceptionAmount||0)||null,exceptionStatus:Number(mobileSpecialExceptionAmount||0)>0?'pending':null} : null}
      });
      if((mobileExtraPromises||[]).length){ const rows=mobileExtraPromises.filter(x=>String(x.title||'').trim()&&x.dueDate).map(x=>({user_id:currentEmp.id,customer_id:saved.customerId,source_sale_id:saved.saleId,task_type:'custom',title:String(x.title).trim(),base_date:saleDate,due_date:x.dueDate,status:'pending'})); if(rows.length){const {error}=await supabase.from('customer_tasks').insert(rows);if(error)throw error;} }

      if (mobileSpotPolicyId) {
        const {error:spotError}=await supabase.from('spot_claims').insert({
          policy_id:mobileSpotPolicyId,
          user_id:currentEmp.id,
          claim_date:saleDate,
          customer_name:customer,
          status:'pending',
          source_context:'mobile'
        });
        if (spotError) throw spotError;
      } else if (mobileSpotDirectOpen && mobileSpotDirectTitle.trim() && Number(mobileSpotDirectAmount)>0) {
        const {error:spotDirectError}=await supabase.from('spot_claims').insert({
          policy_id:null,
          user_id:currentEmp.id,
          claim_date:saleDate,
          customer_name:customer,
          status:'pending',
          direct_title:mobileSpotDirectTitle.trim(),
          direct_amount:Number(mobileSpotDirectAmount),
          direct_memo:mobileSpotDirectMemo.trim()||null,
          source_context:'mobile'
        });
        if (spotDirectError) throw spotDirectError;
      }

      if (mobileExpenseOpen) {
        const expRows=[{category:mobileExpenseCategory,amount:mobileExpenseAmount,memo:mobileExpenseMemo},...(mobileExtraExpenses||[])].filter(x=>Number(x.amount)>0);
        if(expRows.length){ const {error:expenseError}=await supabase.from('sales_expenses').insert(expRows.map(x=>({user_id:currentEmp.id,source_sale_id:saved.saleId,expense_date:saleDate,amount:Number(x.amount),category:x.category||'기타',customer_name:customer,memo:String(x.memo||'').trim()||null}))); if(expenseError)throw expenseError; }
      }

      // 특판·지인판매 적용: 정상 실적은 그대로 올리고 요금제/VAS 수수료만 상쇄, 대체 인센티브 지급
      if(mobileSaleKind==='special' && mobileSpecialPolicyId){
        const policy=specialPolicies.find(p=>p.id===mobileSpecialPolicyId);
        const matrixFee=Number(config.matrix?.[mobileSaleDraft.ri]?.[mobileSaleDraft.ci]||0);
        const payableBundleVas=Object.entries(mobileBundleVasMap||{}).flatMap(([bk,keys])=>
          (mobileBundleSaleTypeMap?.[bk]||'normal')==='free' ? [] : (keys||[])
        );
        const allVas=[...(mobileVasKeys||[]),...payableBundleVas].filter(k=>k!=='vasNone');
        const vasFee=allVas.reduce((sum,k)=>sum+Number((config.vas||[]).find(v=>v.key===k)?.rate||0),0);
        const requested=Number(mobileSpecialExceptionAmount||0);
        const replacement=requested>0?0:Number(policy?.replacement_amount||0); // 예외요청은 승인 전 0원
        await supabase.from('customer_sales').update({
          schema_version:CURRENT_SALE_SCHEMA_VERSION,
          source_meta:withCurrentSaleSchema({ri:mobileSaleDraft.ri,ci:mobileSaleDraft.ci,strategicPlan:!!mobileStrategicPlan,vasKeys:mobileVasKeys,bundle2ndKeys:mobileBundle2ndKeys,bundleVasMap:mobileBundleVasMap,bundleSaleTypeMap:mobileBundleSaleTypeMap,usedMnpBundle:(Number(mobileSaleDraft.ri)===5 && Number(mobileSaleDraft.ci)<=3 ? mobileUsedMnpBundle : false),specialPolicy:{policyId:mobileSpecialPolicyId,policyTitle:policy?.title||'',replacementAmount:Number(policy?.replacement_amount||0),normalMatrixFee:matrixFee,normalVasFee:vasFee,exceptionRequestedAmount:requested||null,exceptionStatus:requested>0?'pending':null}})
        }).eq('id',saved.saleId);
        saved._special={matrixFee,vasFee,replacement};
      }

      const freeAmounts=bundleFreeAmounts();

      if(legacyConversion?.kind==='mobile' && legacyBaseOverride){
        // 구버전 원본 1건을 먼저 뺀 상태(legacyBaseOverride)에 새 판매 1건만 정확히 다시 반영
        const base=normalizeDay(legacyBaseOverride);
        const matrix=base.matrix.map(r=>[...r]);
        matrix[mobileSaleDraft.ri][mobileSaleDraft.ci]=Number(matrix[mobileSaleDraft.ri][mobileSaleDraft.ci]||0)+1;

        const vas={...(base.groups?.vas||{})};
        [...mobileVasKeys,...Object.values(mobileBundleVasMap||{}).flat()].forEach(k=>{
          if(k!=='vasNone')vas[k]=Number(vas[k]||0)+1;
        });
        const bundle2nd={...(base.groups?.bundle2nd||{})};
        (mobileBundle2ndKeys||[]).forEach(k=>{
          bundle2nd[k]=Number(bundle2nd[k]||0)+1;
        });
        const mnpBundle={...(base.groups?.mnpBundle||{})};
        if(Number(mobileSaleDraft.ri)===5 && Number(mobileSaleDraft.ci)<=3 && mobileUsedMnpBundle)mnpBundle.usedMnpBundle=Number(mnpBundle.usedMnpBundle||0)+1;

        const convertedDay={
          ...base,
          matrix,
          groups:{...base.groups,vas,bundle2nd,mnpBundle},
          specialMatrixOffset:Number(base.specialMatrixOffset||0)+Number(saved._special?.matrixFee||0),
          specialVasOffset:Number(base.specialVasOffset||0)+Number(saved._special?.vasFee||0),
          specialReplacementPay:Number(base.specialReplacementPay||0)+Number(saved._special?.replacement||0),
          bundleFreeOffset:Number(base.bundleFreeOffset||0)+Number(freeAmounts.bundleOffset||0),
          bundleFreeVasOffset:Number(base.bundleFreeVasOffset||0)+Number(freeAmounts.vasOffset||0),
        };
        await persistLegacyConvertedDay(convertedDay);
      }else{
        commitMobileOne(
          mobileSaleDraft.ri,
          mobileSaleDraft.ci,
          { saleId:saved.saleId, customerName:customer, promiseCount:mobileCareKeys.length+([{title:mobileCustomTitle,dueDate:mobileCustomDueDate},...mobileExtraPromises].filter(x=>String(x.title||'').trim()&&x.dueDate).length), vasKeys:[...mobileVasKeys,...Object.values(mobileBundleVasMap||{}).flat()], bundle2ndKeys:mobileBundle2ndKeys, usedMnpBundle:(Number(mobileSaleDraft.ri)===5 && Number(mobileSaleDraft.ci)<=3 ? mobileUsedMnpBundle : false),
            specialMatrixOffset:saved._special?.matrixFee||0,specialVasOffset:saved._special?.vasFee||0,specialReplacementPay:saved._special?.replacement||0,
            bundleFreeOffset:freeAmounts.bundleOffset||0,bundleFreeVasOffset:freeAmounts.vasOffset||0 }
        );
      }

      setMobileSaleDraft(null);
      setLegacyConversion(null);
      setMobileSaleKind('normal');
      setMobileSpecialPolicyId('');
      setMobileSpecialExceptionAmount('');
      setTimeout(loadDaySales,150);
    }catch(e){
      showAppToast(friendlyError(e),{tone:'error',title:editingSale?'판매건 수정 실패':'고객/실적 등록 실패'});
    }finally{
      mobileSubmitGuardRef.current=false;
      setMobileSaleSaving(false);
    }
  };

  const undoToast = async () => {
    if (!toast) return;

    const base = normalizeDay(day);
    const nextMatrix = base.matrix.map((row) => [...row]);
    nextMatrix[toast.ri][toast.ci] = Math.max(0, Number(nextMatrix[toast.ri][toast.ci] || 0) - 1);

    const nextVas = { ...(base.groups?.vas || {}) };
    (toast.vasKeys || []).forEach((key) => {
      nextVas[key] = Math.max(0, Number(nextVas[key] || 0) - 1);
    });

    const nextBundle2nd={...(base.groups?.bundle2nd||{})};
    (toast.bundle2ndKeys||[]).forEach(k=>{nextBundle2nd[k]=Math.max(0,Number(nextBundle2nd[k]||0)-1)});
    mutate({
      ...base,
      matrix: nextMatrix,
      groups: { ...base.groups, vas: nextVas, bundle2nd: nextBundle2nd },
      bundleFreeOffset:Math.max(0,Number(base.bundleFreeOffset||0)-Number(toast.bundleFreeOffset||0)),
      bundleFreeVasOffset:Math.max(0,Number(base.bundleFreeVasOffset||0)-Number(toast.bundleFreeVasOffset||0)),
      specialMatrixOffset:Math.max(0,Number(base.specialMatrixOffset||0)-Number(toast.specialMatrixOffset||0)),
      specialVasOffset:Math.max(0,Number(base.specialVasOffset||0)-Number(toast.specialVasOffset||0)),
      specialReplacementPay:Math.max(0,Number(base.specialReplacementPay||0)-Number(toast.specialReplacementPay||0)),
    });

    if (toast.customerSaleId) {
      await supabase.from('customer_tasks').delete().eq('source_sale_id',toast.customerSaleId).eq('user_id',currentEmp?.id);
      await supabase.from('customer_sales').delete().eq('id',toast.customerSaleId).eq('user_id',currentEmp?.id);
    }
    setToast(null);
  };

  const editToastSale=async()=>{
    if(!toast?.customerSaleId)return;
    const {data,error}=await supabase.from('customer_sales')
      .select('id,customer_id,sale_date,metric_label,source_type,source_ref,source_meta,schema_version,customers(customer_name)')
      .eq('id',toast.customerSaleId).eq('user_id',currentEmp?.id).maybeSingle();
    if(error||!data)return showLegacyAlert('방금 등록한 판매건을 불러오지 못했어요. 아래 판매 내역에서 수정해주세요.');
    setToast(null);
    await openEditSale(data);
  };

  const groupSum = (rec) => DAILY_GROUP_KEYS.reduce((s, gk) => s + Object.values(rec.groups[gk] || {}).reduce((gs, v) => gs + (v || 0), 0), 0)
    + (rec.custRegCount || 0) + (rec.tailoredCount || 0);
  const matrixSum = (rec) => rec.matrix.reduce((s, row) => s + row.reduce((rs, v) => rs + v, 0), 0);
  const dayTotal = matrixSum(day) + groupSum(day);
  // v21.39: 예전 UI는 모바일뿐 아니라 홈/2ND/VAS/소노 등도 daily_records 집계만 남을 수 있음.
  // 고객별 원본이 0건인데 일일 합계가 있으면 해당 날짜 전체를 '이전 방식 입력 실적'로 취급해 반드시 노출.
  const legacyWholeDay = !daySalesLoading && daySales.length===0 && dayTotal>0;
  const legacyWholeDayCount = legacyWholeDay ? dayTotal : 0;
  const monthTotal = Object.values(dailyDays).reduce((s, raw) => { const r = normalizeDay(raw); return s + matrixSum(r) + groupSum(r); }, 0);

  // v21.66 핵심 판매건 기준
  // 모바일 1건은 그대로 1건, 홈은 같은 날짜+같은 고객의 세부항목을 하나의 핵심 홈 판매건으로 묶습니다.
  const groupedCoreSales=useMemo(()=>{
    const groups=[];
    const homeMap=new Map();
    (daySales||[]).forEach(sale=>{
      if(sale.source_type!=='home_order'){
        groups.push({key:`sale-${sale.id}`,kind:'mobile',sales:[sale],primary:sale});
        return;
      }
      const customerKey=sale.customer_id||sale.customers?.customer_name||sale.id;
      const key=`home-${sale.sale_date}-${customerKey}`;
      if(!homeMap.has(key)){
        const g={key,kind:'home',sales:[],primary:sale};
        homeMap.set(key,g); groups.push(g);
      }
      homeMap.get(key).sales.push(sale);
    });
    return groups;
  },[daySales]);

  const coreDayTotal=groupedCoreSales.length+(day.householdRenewals?.length||0);

  const saleIncentiveBreakdown=(sale)=>{
    const meta=sale?.source_meta||{};
    const rows=[];
    if(sale?.source_type==='mobile'){
      const ri=Number(meta.ri),ci=Number(meta.ci);
      const plan=Number(config.matrix?.[ri]?.[ci]||0);
      if(plan)rows.push(['요금제',plan]);
      (meta.vasKeys||[]).forEach(k=>{if(k==='vasNone')return;const it=(config.vas||[]).find(v=>v.key===k);if(Number(it?.rate||0))rows.push([it.label||'VAS',Number(it.rate)]);});
      (meta.bundle2ndKeys||[]).forEach(k=>{const it=(config.bundle2nd||[]).find(v=>v.key===k);const free=(meta.bundleSaleTypeMap?.[k]||'normal')==='free';if(Number(it?.rate||0)&&!free)rows.push([it.label||'2ND',Number(it.rate)]);});
      Object.entries(meta.bundleVasMap||{}).forEach(([bk,keys])=>(keys||[]).forEach(k=>{if(k==='vasNone'||(meta.bundleSaleTypeMap?.[bk]||'normal')==='free')return;const it=(config.vas||[]).find(v=>v.key===k);if(Number(it?.rate||0))rows.push([`2ND VAS · ${it.label||k}`,Number(it.rate)]);}));
      if(meta.usedMnpBundle){const it=(config.mnpBundle||[]).find(v=>v.key==='usedMnpBundle');if(Number(it?.rate||0))rows.push(['중고MNP 결합',Number(it.rate)]);}
      const sp=meta.specialPolicy||{};
      if(sp.policyId){
        if(plan)rows.push(['특판 요금제 제외',-plan]);
        if(Number(sp.normalVasFee||0))rows.push(['특판 VAS 제외',-Number(sp.normalVasFee)]);
        const repl=Number(sp.exceptionStatus==='approved'?sp.exceptionApprovedAmount:sp.replacementAmount||0);
        if(repl)rows.push(['특판 대체',repl]);
      }
    }else if(sale?.source_type==='home_order'){
      const customer=sale.customers?.customer_name||'고객';
      const date=String(sale.sale_date||'').slice(0,10);
      const policyDetails=(homePreviewPolicy?.details||pay?.homePolicy?.details||[]);
      policyDetails.filter(x=>String(x.date||'')===date&&String(x.customer||'')===customer).forEach(x=>{
        if(Number(x.amount||0)!==0)rows.push([x.item,Number(x.amount)]);
      });
    }
    const total=rows.reduce((a,[,v])=>a+Number(v||0),0);
    return {rows,total};
  };

  const mobilePreview=(()=>{
    if(!mobileSaleDraft)return null;
    const base=normalizeDay(day),nextMatrix=base.matrix.map(r=>[...r]);
    nextMatrix[mobileSaleDraft.ri][mobileSaleDraft.ci]=Number(nextMatrix[mobileSaleDraft.ri][mobileSaleDraft.ci]||0)+1;
    const nextVas={...(base.groups?.vas||{})};
    [...mobileVasKeys,...Object.values(mobileBundleVasMap||{}).flat()].forEach(k=>{if(k!=='vasNone')nextVas[k]=Number(nextVas[k]||0)+1});
    const nextBundle={...(base.groups?.bundle2nd||{})};mobileBundle2ndKeys.forEach(k=>nextBundle[k]=Number(nextBundle[k]||0)+1);
    const nextMnpBundle={...(base.groups?.mnpBundle||{})};if(Number(mobileSaleDraft.ri)===5&&Number(mobileSaleDraft.ci)<=3&&mobileUsedMnpBundle)nextMnpBundle.usedMnpBundle=Number(nextMnpBundle.usedMnpBundle||0)+1;
    const free=bundleFreeAmounts();
    const selectedPolicy=specialPolicies.find(p=>p.id===mobileSpecialPolicyId);
    const specialMatrix=mobileSaleKind==='special'&&mobileSpecialPolicyId?Number(config.matrix?.[mobileSaleDraft.ri]?.[mobileSaleDraft.ci]||0):0;
    const payableBundleVas=Object.entries(mobileBundleVasMap||{}).flatMap(([bk,keys])=>(mobileBundleSaleTypeMap?.[bk]||'normal')==='free'?[]:(keys||[]));
    const specialVas=mobileSaleKind==='special'&&mobileSpecialPolicyId?[...mobileVasKeys,...payableBundleVas].filter(k=>k!=='vasNone').reduce((s,k)=>s+Number((config.vas||DEFAULT_VAS).find(v=>v.key===k)?.rate||0),0):0;
    const requested=Number(mobileSpecialExceptionAmount||0),replacement=mobileSaleKind==='special'&&mobileSpecialPolicyId?(requested>0?0:Number(selectedPolicy?.replacement_amount||0)):0;
    const nextDay={...base,matrix:nextMatrix,groups:{...base.groups,vas:nextVas,bundle2nd:nextBundle,mnpBundle:nextMnpBundle},bundleFreeOffset:Number(base.bundleFreeOffset||0)+free.bundleOffset,bundleFreeVasOffset:Number(base.bundleFreeVasOffset||0)+free.vasOffset,specialMatrixOffset:Number(base.specialMatrixOffset||0)+specialMatrix,specialVasOffset:Number(base.specialVasOffset||0)+specialVas,specialReplacementPay:Number(base.specialReplacementPay||0)+replacement};
    const beforeDraft=applyDailyToDraft(draft,{...dailyDays,[selectedDay]:base},month,config.categoryMap,config.gibyeonColumnMap);
    const afterDraft=applyDailyToDraft(draft,{...dailyDays,[selectedDay]:nextDay},month,config.categoryMap,config.gibyeonColumnMap);
    const beforePay=computePay(beforeDraft,currentEmp?.position||'사원',currentEmp?.hireDate,month,config);
    const afterPay=computePay(afterDraft,currentEmp?.position||'사원',currentEmp?.hireDate,month,config);
    const vasLabels=[...mobileVasKeys,...Object.values(mobileBundleVasMap||{}).flat()].filter((k,i,a)=>k!=='vasNone'&&a.indexOf(k)===i).map(k=>(config.vas||DEFAULT_VAS).find(v=>v.key===k)?.label||k);
    const secondLabels=mobileBundle2ndKeys.map(k=>(config.bundle2nd||DEFAULT_BUNDLE2ND).find(v=>v.key===k)?.label?.replace('2ND · ','')||k);
    const promiseCount=mobileCareKeys.length+([{title:mobileCustomTitle,dueDate:mobileCustomDueDate},...mobileExtraPromises].filter(x=>String(x.title||'').trim()&&x.dueDate).length);
    return {incentive:Math.max(0,Number(afterPay.currentPerformanceAmount||0)-Number(beforePay.currentPerformanceAmount||0)),points:Number(afterPay.totalPoints||0)-Number(beforePay.totalPoints||0),vasLabels,secondLabels,promiseCount};
  })();

  return (
    <div className="space-y-3 relative">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-gray-700">{monthLabel(month)} 일일입력</div>
        <div className="flex items-center gap-2">
          <DailySaveBadge state={saveState} />
          <span className="text-xs text-gray-400">누적 {monthTotal}건</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-3">
        <label className="flex items-center justify-between gap-3 pb-3 mb-3 border-b border-gray-100 cursor-pointer">
          <div>
            <div className="text-sm font-semibold text-gray-700">활동 시간 충족</div>
            <div className="text-[11px] text-gray-400 mt-0.5">미충족 시 영업 활동 지원금 {won(config.basePenalty)} 차감</div>
          </div>
          <div className={`shrink-0 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold ${draft.activityTimeMet ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
            <input
              type="checkbox"
              checked={draft.activityTimeMet}
              onChange={(e) => setDraft({ ...draft, activityTimeMet: e.target.checked })}
              className="w-4 h-4"
            />
            {draft.activityTimeMet ? '충족' : '미충족'}
          </div>
        </label>

        <div className="grid grid-cols-7 gap-1.5 mb-1.5">
          {['일', '월', '화', '수', '목', '금', '토'].map((w, i) => (
            <div key={w} className={`text-center text-[11px] font-semibold py-1 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1).getDay() }).map((_, i) => (
            <div key={`blank-${i}`} className="aspect-square" />
          ))}
          {Array.from({ length: n }, (_, i) => i + 1).map((d) => {
            const key = String(d).padStart(2, '0');
            const rec = key === selectedDay ? day : normalizeDay(dailyDays[key]);
            const has = dayHasData(rec);
            const off = !!rec.dayOff;
            const isSel = key === selectedDay;
            const coreMetrics=calendarCoreMetrics(key===selectedDay?day:dailyDays[key]);
            const calHs=coreMetrics.hs;
            const calSim=coreMetrics.sim;
            const calHome=coreMetrics.home;
            const hasCalSummary=calHs>0||calSim>0||calHome>0;
            const dow = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, d).getDay();
            return (
              <button key={d} onClick={() => selectDay(key)}
                className={`relative min-w-0 h-[58px] sm:h-[64px] rounded-lg text-xs font-medium flex flex-col items-center justify-start pt-2.5 overflow-hidden
                  ${isSel ? (off ? 'bg-emerald-600 text-white' : 'bg-violet-600 text-white') : off ? 'bg-emerald-50 text-emerald-700' : has ? 'bg-violet-50 text-violet-700' : dow === 0 ? 'bg-red-50/50 text-red-400' : dow === 6 ? 'bg-blue-50/50 text-blue-400' : 'bg-gray-50 text-gray-500'}`}>
                <span className="leading-none shrink-0">{d}</span>
                <div className="h-[32px] mt-1.5 flex flex-col items-center justify-start shrink-0">
                  {off ? (
                    <span className={`text-[8px] leading-[10px] ${isSel ? 'text-white/80' : 'text-emerald-600'}`}>휴무</span>
                  ) : (
                    <div className={`text-[6.5px] sm:text-[7px] leading-[9px] font-semibold text-center whitespace-nowrap ${isSel?'text-white/90':'text-gray-600'}`}>
                      <div className={calHs>0?'':'invisible'}>HS {fmtCount(calHs)}</div>
                      <div className={calSim>0?'':'invisible'}>SIM MNP {fmtCount(calSim)}</div>
                      <div className={calHome>0?'':'invisible'}>홈 {fmtCount(calHome)}</div>
                    </div>
                  )}
                </div>
                {!off && !hasCalSummary && has && !isSel && <span className="absolute bottom-1 w-1 h-1 rounded-full bg-violet-500" />}
              </button>
            );
          })}
        </div>

        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-gray-700">이 날짜는 휴무인가요?</div>
            <div className="text-[11px] text-gray-400">휴무일은 근무일 연속 기록에서 자연스럽게 건너뛰어요.</div>
          </div>
          <button
            onClick={() => setDayOff(!isDayOff)}
            disabled={locked}
            className={`shrink-0 px-3 py-2 rounded-lg text-xs font-semibold border ${
              isDayOff
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white text-gray-500 border-gray-200'
            } disabled:opacity-50`}
          >
            {isDayOff ? '휴무 ✓' : '휴무'}
          </button>
        </div>
      </div>

      {isDayOff ? (
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-5 text-center">
          <div className="text-2xl mb-2">🌿</div>
          <div className="text-sm font-bold text-emerald-800">오늘은 휴무로 설정했어요</div>
          <div className="text-xs text-emerald-700/70 mt-1">푹 쉬고 다음 근무일부터 이어가요 :)</div>
        </div>
      ) : (
      <>

      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-gray-800">{parseInt(selectedDay, 10)}일 · {coreDayTotal}건</div>
      </div>

      <>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-2.5 text-xs font-semibold text-gray-500 border-b border-gray-50 flex justify-between">
              <span>{parseInt(selectedDay, 10)}일 고객별 판매 내역</span>
              <span>{groupedCoreSales.length + (day.householdRenewals?.length||0)}건</span>
            </div>
            {daySalesLoading ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">판매 내역 불러오는 중...</div>
            ) : daySales.length === 0 && (day.householdRenewals?.length||0) === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-400">
                {legacySaleRows.length>0?'고객별 원본이 없는 이전 판매건은 아래에서 수정할 수 있어요.':<>아직 고객별 판매 기록이 없어요.<br />아래 판매 카테고리에서 등록해 주세요.</>}
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {(day.householdRenewals||[]).map((item,idx)=>{
                  const c=calculateHouseholdRenew(item,config);
                  const planLabel=HOUSEHOLD_RENEW_PLANS.find(x=>x.key===item.plan)?.label||item.plan||'';
                  const speedLabel=item.speed==='1g'?'1GB':item.speed==='500'?'500MB':'100MB';
                  const tvIncluded=!item.homeOnly;
                  return <div key={`renew-list-${item.id||idx}`} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-gray-900">{item.customer||'이름 없음'}</div>
                        <div className="text-xs text-gray-600 mt-0.5">인터넷 재약정 · {speedLabel} · {planLabel}</div>
                        <div className="text-[11px] text-gray-400 mt-1">
                          {tvIncluded?'인터넷+TV 재약정':'인터넷 재약정'} · 생산성 KPI {tvIncluded?'0.6P':'0.3P'} · {won(c.amount)}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button type="button" onClick={()=>openHouseholdRenew(idx)} className="px-2 py-1.5 rounded-lg bg-gray-50 text-gray-600 text-[11px] font-semibold">판매건 수정</button>
                        <button type="button" onClick={()=>deleteHouseholdRenew(idx)} className="px-2 py-1.5 rounded-lg bg-red-50 text-red-500 text-[11px] font-semibold">삭제</button>
                      </div>
                    </div>
                  </div>;
                })}
                {groupedCoreSales.map((group) => {
                  const sale=group.primary;
                  const meta=sale.source_meta||{};
                  const customerName=sale.customers?.customer_name||'고객';

                  if(group.kind==='home'){
                    const homeSales=group.sales;
                    const homeTypes=new Set(homeSales.map(x=>inferHomeProductTypeFromLabel(x.metric_label)));
                    const labels=[];

                    // 핵심 상품/구성 순서로 한 카드 안에 정리
                    const internetSale=homeSales.find(x=>['internet1g','internet500','internet100'].includes(inferHomeProductTypeFromLabel(x.metric_label)));
                    const tvSale=homeSales.find(x=>inferHomeProductTypeFromLabel(x.metric_label)==='homeTv');
                    const smartSale=homeSales.find(x=>inferHomeProductTypeFromLabel(x.metric_label)==='smartHome');
                    const tvFreeSale=homeSales.find(x=>inferHomeProductTypeFromLabel(x.metric_label)==='tvFree');
                    const subSale=homeSales.find(x=>inferHomeProductTypeFromLabel(x.metric_label)==='subSetTop');
                    const simulSale=homeSales.find(x=>['simulNewChange','simulMnp','simulUsedMnp'].includes(inferHomeProductTypeFromLabel(x.metric_label)));

                    if(internetSale)labels.push(internetSale.metric_label);
                    if(tvSale)labels.push(tvSale.metric_label);
                    if(smartSale)labels.push(smartSale.metric_label);
                    if(tvFreeSale)labels.push(tvFreeSale.metric_label);
                    if(subSale)labels.push(subSale.metric_label);

                    if(simulSale){
                      const t=inferHomeProductTypeFromLabel(simulSale.metric_label);
                      const hasInternetOrTv=['homeOnly','homeTv','internet100','internet500','internet1g'].some(k=>homeTypes.has(k));
                      const hasSmartHome=homeTypes.has('smartHome');
                      const baseLabel=hasInternetOrTv?'홈':hasSmartHome?'스마트홈':'홈';
                      const simulText=t==='simulNewChange'?'HS 신규/기변 동시판매':t==='simulMnp'?'HS MNP 동시판매':'중고MNP 동시판매';
                      labels.push(`${baseLabel} + ${simulText}`);
                    }

                    // 위 분류에 안 잡힌 홈 세부항목도 누락 없이 표시
                    homeSales.forEach(x=>{
                      const t=inferHomeProductTypeFromLabel(x.metric_label);
                      if(!['internet1g','internet500','internet100','homeTv','smartHome','tvFree','subSetTop','simulNewChange','simulMnp','simulUsedMnp'].includes(t) && !labels.includes(x.metric_label)) labels.push(x.metric_label);
                    });

                    const inc=saleIncentiveBreakdown(sale); // 같은 고객 홈 전체 금액을 딱 한 번 표시
                    return <div key={group.key} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-gray-900">{customerName}</div>
                          <div className="mt-1 space-y-0.5">
                            {labels.map((label,i)=><div key={i} className="text-xs text-gray-600">{label}</div>)}
                          </div>
                          {homeSales.some(legacySaleBadge)&&<span className="inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100">구버전 데이터 · 수정 가능</span>}
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="relative mb-2">
                            <button type="button" onClick={()=>setSaleIncentiveOpen(v=>v===group.key?null:group.key)}
                              className={`text-[12px] font-bold ${inc.total>0?'text-violet-700':'text-gray-400'}`}>
                              {inc.total>0?`+${won(inc.total)}`:'0원'}
                            </button>
                            <div className="text-[9px] text-gray-400">예상 인센티브</div>
                            {saleIncentiveOpen===group.key&&<div className="absolute right-0 top-10 z-30 w-56 bg-white border rounded-xl shadow-lg p-3 text-left">
                              <div className="text-[10px] font-bold text-gray-700 mb-1">이 판매건 예상 인센티브</div><div className="text-[9px] text-gray-400 mb-2">설치예정 홈은 현재 월 입력 기준으로 미리 계산하며, 실제 지급은 설치완료 후 반영돼요.</div>
                              {inc.rows.length?inc.rows.map(([l,v],i)=><div key={i} className="flex justify-between gap-2 text-[10px] py-1"><span className="text-gray-500">{l}</span><b className={v<0?'text-red-500':'text-violet-700'}>{v>0?'+':''}{won(v)}</b></div>):<div className="text-[10px] text-gray-400">직접 발생 수수료가 없어요.</div>}
                            </div>}
                          </div>
                          <div className="flex gap-1">
                            <button onClick={()=>openEditSale(sale)} className="px-2 py-1.5 rounded-lg bg-gray-50 text-gray-600 text-[11px] font-semibold">판매건 수정</button>
                            <button onClick={()=>deleteSale(sale)} className="px-2 py-1.5 rounded-lg bg-red-50 text-red-500 text-[11px] font-semibold">삭제</button>
                          </div>
                        </div>
                      </div>
                    </div>;
                  }

                  const vasLabels=(meta.vasKeys||[]).map(k=>{
                    if(k==='vasNone')return '미유치';
                    return (config.vas||DEFAULT_VAS).find(v=>v.key===k)?.label||k;
                  });
                  const inc=saleIncentiveBreakdown(sale);
                  return (
                    <div key={group.key} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-gray-900">{customerName}</div>
                          <div className="text-xs text-gray-600 mt-0.5 flex items-center gap-1.5 flex-wrap">
                            <span>{sale.metric_label}</span>
                            {legacySaleBadge(sale)&&<span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100">구버전 데이터 · 수정 가능</span>}
                          </div>
                          {vasLabels.length>0&&<div className="text-[11px] text-gray-400 mt-1">VAS · {vasLabels.join(' · ')}</div>}
                          {Object.entries(meta.bundleSaleTypeMap||{}).some(([,v])=>v==='free')&&<div className="text-[10px] text-amber-600 mt-1">2ND 무료판매 · 인센티브 제외</div>}
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="relative mb-2">
                            <button type="button" onClick={()=>setSaleIncentiveOpen(v=>v===group.key?null:group.key)}
                              className={`text-[12px] font-bold ${inc.total>0?'text-violet-700':'text-gray-400'}`}>
                              {inc.total>0?`+${won(inc.total)}`:'0원'}
                            </button>
                            <div className="text-[9px] text-gray-400">인센티브</div>
                            {saleIncentiveOpen===group.key&&<div className="absolute right-0 top-10 z-30 w-56 bg-white border rounded-xl shadow-lg p-3 text-left">
                              <div className="text-[10px] font-bold text-gray-700 mb-2">이 판매건 인센티브</div>
                              {inc.rows.length?inc.rows.map(([l,v],i)=><div key={i} className="flex justify-between gap-2 text-[10px] py-1"><span className="text-gray-500">{l}</span><b className={v<0?'text-red-500':'text-violet-700'}>{v>0?'+':''}{won(v)}</b></div>):<div className="text-[10px] text-gray-400">직접 발생 수수료가 없어요.</div>}
                            </div>}
                          </div>
                          <div className="flex gap-1">
                            <button onClick={()=>openEditSale(sale)} className="px-2 py-1.5 rounded-lg bg-gray-50 text-gray-600 text-[11px] font-semibold">판매건 수정</button>
                            <button onClick={()=>deleteSale(sale)} className="px-2 py-1.5 rounded-lg bg-red-50 text-red-500 text-[11px] font-semibold">삭제</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {legacySaleRows.length>0&&(
            <div className="bg-amber-50/70 border border-amber-100 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-amber-100/70">
                <div className="text-[10px] font-semibold text-amber-700">이전 방식 입력 실적 · {fmtCount(legacySaleRows.length)}건</div>
                <div className="text-[10px] text-gray-500 mt-0.5">고객명이 저장되지 않았던 판매건입니다. 각 건을 눌러 현재 입력 화면으로 복원할 수 있어요.</div>
              </div>
              <div className="divide-y divide-amber-100/70">
                {legacySaleRows.map(row=><div key={row.id} className="px-4 py-3 flex items-center justify-between gap-3 bg-white/50">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-gray-800">이름 없음</div>
                    <div className="text-[11px] text-gray-600 mt-0.5 truncate">{row.title}{row.detail?` · ${row.detail}`:''}</div>
                  </div>
                  <button type="button" onClick={()=>openLegacySaleRow(row)}
                    className="shrink-0 px-3 py-1.5 rounded-lg bg-white border border-amber-200 text-[11px] font-bold text-amber-700">
                    수정
                  </button>
                </div>)}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-100 p-3">
            <div className="text-[11px] text-gray-400 mb-2">판매 카테고리</div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={()=>{setInputCategory('mobile');setPickedRow(null);addOne(0,0);}}
                className={`p-4 rounded-2xl border text-left ${inputCategory==='mobile'?'bg-violet-50 border-violet-300':'bg-white border-gray-200'}`}>
                <div className="text-xl">📱</div><div className="text-sm font-bold text-gray-800 mt-1">모바일 실적 입력</div>
                <div className="text-[10px] text-gray-400 mt-1">고객명 · 가입구분 · 요금제 · VAS · 스팟 · 오퍼</div>
              </button>
              <button type="button" onClick={()=>{setInputCategory('home');setPickedRow(null);openHomeOrder();}}
                className={`p-4 rounded-2xl border text-left ${inputCategory==='home'?'bg-violet-50 border-violet-300':'bg-white border-gray-200'}`}>
                <div className="text-xl">🏠</div><div className="text-sm font-bold text-gray-800 mt-1">홈 실적 입력</div>
                <div className="text-[10px] text-gray-400 mt-1">고객명 · 가정/소호 · 상품 · 스팟 · 오퍼</div>
              </button>
              <button type="button" onClick={()=>openHouseholdRenew(null)} className="p-4 rounded-2xl border text-left bg-white border-gray-200">
                <div><div className="text-xl">♻️</div><div className="text-sm font-bold text-gray-800 mt-1">인터넷 재약정</div></div>
                <div className="text-[10px] text-gray-400 mt-1">조건 선택 시 인센티브 자동 계산</div>
              </button>
              <button type="button" onClick={()=>setExtraInput('sono')} className="p-4 rounded-2xl border text-left bg-white border-gray-200"><div className="text-xl">🎫</div><div className="text-sm font-bold text-gray-800 mt-1">소노</div><div className="text-[10px] text-gray-400 mt-1">상품 · 건수 · 고객(선택)</div></button>
              <button type="button" onClick={()=>setExtraInput('tailored')} className="p-4 rounded-2xl border text-left bg-white border-gray-200"><div className="text-xl">💡</div><div className="text-sm font-bold text-gray-800 mt-1">맞춤제안</div><div className="text-[10px] text-gray-400 mt-1">업셀 건수 · 금액</div></button>
              <button type="button" onClick={()=>setExtraInput('customerReg')} className="p-4 rounded-2xl border text-left bg-white border-gray-200 col-span-2"><div className="text-xl">👤</div><div className="text-sm font-bold text-gray-800 mt-1">고객등록</div><div className="text-[10px] text-gray-400 mt-1">타매고 등록 건수 빠른 입력</div></button>
            </div>


          </div>

      </>

      </>
      )}

      {extraInput&&(<div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"><div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl"><div className="text-lg font-bold">{extraInput==='sono'?'소노 입력':extraInput==='tailored'?'맞춤제안 입력':'고객등록 입력'}</div><input value={extraCustomer} onChange={e=>setExtraCustomer(e.target.value)} placeholder="고객명 (선택)" className="mt-4 w-full border rounded-xl px-3 py-3 text-sm"/>{extraInput==='sono'&&<select value={extraSonoKey} onChange={e=>setExtraSonoKey(e.target.value)} className="mt-2 w-full border rounded-xl px-3 py-3 text-sm">{(config.sono||DEFAULT_SONO).map(x=><option key={x.key} value={x.key}>{x.label}</option>)}</select>}<input inputMode="numeric" value={fmtInputNumber(extraCount)} onChange={e=>setExtraCount(e.target.value.replace(/\D/g,''))} placeholder="건수" className="mt-2 w-full border rounded-xl px-3 py-3 text-sm"/>{extraInput==='tailored'&&<input inputMode="numeric" value={fmtInputNumber(extraAmount)} onChange={e=>setExtraAmount(e.target.value.replace(/\D/g,''))} placeholder="업셀 금액" className="mt-2 w-full border rounded-xl px-3 py-3 text-sm"/>}<div className="grid grid-cols-2 gap-2 mt-4"><button onClick={()=>setExtraInput(null)} className="py-2.5 bg-gray-100 rounded-xl">취소</button><button onClick={submitExtraInput} className="py-2.5 bg-violet-600 text-white rounded-xl font-bold">등록</button></div></div></div>)}

      {householdRenewOpen&&(
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="text-xs text-violet-500 font-semibold">인터넷 재약정</div>
            <div className="text-lg font-bold text-gray-900 mt-1">{householdRenewEditIndex===null?'재약정 실적 입력':'재약정 실적 수정'}</div>
            <div className="text-xs text-gray-400 mt-1">재약정일 {month}-{selectedDay}</div>
            <label className="block text-xs font-semibold text-gray-600 mt-4 mb-1.5">고객명 (선택)</label>
            <input value={householdRenewForm.customer||''} onChange={e=>setHouseholdRenewForm({...householdRenewForm,customer:e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm" placeholder="고객명"/>
            <div className="text-xs font-semibold text-gray-600 mt-4 mb-2">인터넷 속도</div>
            <div className="grid grid-cols-3 gap-2">{[['1g','1GB'],['500','500MB'],['100','100MB']].map(([key,label])=><button key={key} type="button" onClick={()=>setHouseholdRenewForm({...householdRenewForm,speed:key})} className={`py-2.5 rounded-xl border text-xs font-bold ${householdRenewForm.speed===key?'bg-violet-50 border-violet-300 text-violet-700':'bg-white border-gray-200 text-gray-500'}`}>{label}</button>)}</div>
            <div className="text-xs font-semibold text-gray-600 mt-4 mb-2">재약정 상품</div>
            <div className="space-y-1.5">{HOUSEHOLD_RENEW_PLANS.map(p=><button key={p.key} type="button" onClick={()=>setHouseholdRenewForm({...householdRenewForm,plan:p.key})} className={`w-full py-2.5 px-3 rounded-xl border text-left text-xs font-semibold ${householdRenewForm.plan===p.key?'bg-violet-50 border-violet-300 text-violet-700':'bg-white border-gray-200 text-gray-600'}`}>{householdRenewForm.plan===p.key?'✓ ':''}{p.label}</button>)}</div>
            <div className="text-xs font-semibold text-gray-600 mt-4 mb-2">재약정 구성</div>
            <div className="grid grid-cols-2 gap-2"><button type="button" onClick={()=>setHouseholdRenewForm({...householdRenewForm,homeOnly:false})} className={`py-2.5 rounded-xl border text-xs font-bold ${!householdRenewForm.homeOnly?'bg-violet-50 border-violet-300 text-violet-700':'bg-white border-gray-200 text-gray-500'}`}>홈+TV 재약정</button><button type="button" onClick={()=>setHouseholdRenewForm({...householdRenewForm,homeOnly:true,tvUpsell:false})} className={`py-2.5 rounded-xl border text-xs font-bold ${householdRenewForm.homeOnly?'bg-violet-50 border-violet-300 text-violet-700':'bg-white border-gray-200 text-gray-500'}`}>홈만 재약정</button></div>
            {householdRenewForm.homeOnly&&<div className="text-[10px] text-amber-600 mt-1.5">홈 단독 재약정은 기본 재약정 수수료에서 최대 50,000원이 차감됩니다.</div>}
            <label className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-3 py-3"><div><div className="text-xs font-semibold text-gray-700">HS 동시판매</div><div className="text-[10px] text-gray-400">1GB +80,000원 · 500MB +50,000원</div></div><input type="checkbox" checked={!!householdRenewForm.hsSimul} onChange={e=>setHouseholdRenewForm({...householdRenewForm,hsSimul:e.target.checked})}/></label>
            <label className={`mt-2 flex items-center justify-between gap-3 rounded-xl border px-3 py-3 ${householdRenewForm.homeOnly?'bg-gray-50 border-gray-100 opacity-50':'border-gray-200'}`}><div><div className="text-xs font-semibold text-gray-700">TV 업셀</div><div className="text-[10px] text-gray-400">조건 충족 시 +20,000원</div></div><input type="checkbox" disabled={householdRenewForm.homeOnly} checked={!!householdRenewForm.tvUpsell} onChange={e=>setHouseholdRenewForm({...householdRenewForm,tvUpsell:e.target.checked})}/></label>
            <div className="mt-4 rounded-xl bg-gray-50 border border-gray-100 p-3 space-y-2"><label className="flex items-center justify-between gap-3 text-xs text-gray-600"><span>기존 속도보다 낮춰 재약정</span><input type="checkbox" checked={!!householdRenewForm.downSpeed} onChange={e=>setHouseholdRenewForm({...householdRenewForm,downSpeed:e.target.checked})}/></label><label className="flex items-center justify-between gap-3 text-xs text-gray-600"><span>일시 상향 후 동일 조건 재약정</span><input type="checkbox" checked={!!householdRenewForm.temporaryUpgradeSame} onChange={e=>setHouseholdRenewForm({...householdRenewForm,temporaryUpgradeSame:e.target.checked})}/></label><div className="text-[10px] text-gray-400 leading-relaxed">100MB 재약정, 속도 하향, 일시 상향 후 동일 요금제·동일 속도 재약정은 지급액 0원으로 계산합니다.</div></div>
            <div className="mt-4 rounded-2xl bg-violet-50 border border-violet-100 p-4"><div className="text-[10px] text-violet-500">자동 계산 지급액</div><div className="text-2xl font-bold text-violet-700 mt-0.5">{won(householdRenewPreview.amount)}</div><div className="text-[10px] text-violet-600 mt-1">생산성 KPI · 인터넷 0.3P{householdRenewForm.homeOnly?'':' + TV 0.3P'}</div>{!householdRenewPreview.invalid&&<div className="text-[10px] text-gray-500 mt-2 leading-relaxed">기본 {won(householdRenewPreview.base)}{householdRenewPreview.soloDiscount?` - 홈 단독 ${won(householdRenewPreview.soloDiscount)}`:''}{householdRenewPreview.hsPay?` + HS 동시 ${won(householdRenewPreview.hsPay)}`:''}{householdRenewPreview.tvPay?` + TV 업셀 ${won(householdRenewPreview.tvPay)}`:''}</div>}</div>
            {(day.householdRenewals||[]).length>0&&<div className="mt-4"><div className="text-xs font-bold text-gray-700 mb-2">{selectedDay}일 등록 내역</div><div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">{(day.householdRenewals||[]).map((item,idx)=>{const c=calculateHouseholdRenew(item,config);return <div key={item.id||idx} className="px-3 py-2.5 flex items-center justify-between gap-2"><div className="min-w-0"><div className="text-xs font-semibold text-gray-700 truncate">{item.customer||'이름 없음'} · {item.speed==='1g'?'1GB':item.speed==='500'?'500MB':'100MB'}</div><div className="text-[10px] text-gray-400 mt-0.5">{HOUSEHOLD_RENEW_PLANS.find(x=>x.key===item.plan)?.label||item.plan} · {won(c.amount)}</div></div><div className="flex gap-1"><button type="button" onClick={()=>openHouseholdRenew(idx)} className="px-2 py-1 rounded-lg bg-gray-50 text-[10px] font-semibold text-violet-600">수정</button><button type="button" onClick={()=>deleteHouseholdRenew(idx)} className="px-2 py-1 rounded-lg bg-red-50 text-[10px] font-semibold text-red-500">삭제</button></div></div>})}</div></div>}
            <div className="grid grid-cols-2 gap-2 mt-5"><button type="button" onClick={()=>{setHouseholdRenewOpen(false);setHouseholdRenewEditIndex(null);setHouseholdRenewForm(emptyHouseholdRenewForm())}} className="py-2.5 rounded-xl bg-gray-100 text-gray-500 text-sm font-semibold">취소</button><button type="button" onClick={saveHouseholdRenew} className="py-2.5 rounded-xl bg-violet-600 text-white text-sm font-bold">{householdRenewEditIndex===null?'등록':'수정 저장'}</button></div>
          </div>
        </div>
      )}

      {mobileSaleDraft && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="text-xs text-violet-500 font-semibold">{editingSale?'판매건 수정':legacyConversion?.kind==='mobile'?'이전 판매건 복원':'한 번에 판매 등록'}</div>
            <div className="text-lg font-bold text-gray-900 mt-1">{legacyConversion?.kind==='mobile'?'모바일 실적 수정':'모바일 실적 입력'}</div>
            <div className="text-xs text-gray-400 mt-1">개통일 {month}-{selectedDay}</div>
            {!editingSale&&<div className="mt-2 rounded-xl bg-blue-50 border border-blue-100 px-3 py-2 text-[10px] text-blue-700">항목을 선택하는 동안에는 저장되지 않아요. 맨 아래 <b>실적 등록</b>을 눌러야 판매건·고객정보·약속이 함께 등록됩니다.</div>}
            {legacyConversion?.kind==='mobile'&&<div className="mt-2 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2 text-[10px] text-amber-700">
              기존 데이터에서 확인된 값 · <b>{legacyConversion.title}{legacyConversion.detail?` · ${legacyConversion.detail}`:''}</b><br/>
              고객명·VAS·2ND 등 당시 저장되지 않은 값은 비워두었어요.
            </div>}

            <div className="mt-4">
              <div className="text-xs font-semibold text-gray-600 mb-2">1. 판매 구분 *</div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button"
                  onClick={()=>{setMobileSaleKind('normal');setMobileSpecialPolicyId('');setMobileSpecialExceptionAmount('')}}
                  className={`py-3 rounded-xl border text-xs font-bold ${mobileSaleKind==='normal'?'bg-violet-50 border-violet-300 text-violet-700':'bg-white border-gray-200 text-gray-500'}`}>
                  {mobileSaleKind==='normal'?'✓ ':''}일반 판매
                </button>
                <button type="button"
                  onClick={()=>setMobileSaleKind('special')}
                  className={`py-3 rounded-xl border text-xs font-bold ${mobileSaleKind==='special'?'bg-amber-50 border-amber-300 text-amber-700':'bg-white border-gray-200 text-gray-500'}`}>
                  {mobileSaleKind==='special'?'✓ ':''}특판·지인판매
                </button>
              </div>

              {mobileSaleKind==='special'&&(
                <div className="mt-2 rounded-xl border border-amber-100 bg-amber-50/30 p-3">
                  <div className="text-[11px] font-semibold text-gray-700">적용 정책 *</div>
                  {specialPolicies.length>0 ? (
                    <>
                      <div className="grid grid-cols-1 gap-1.5 mt-2">
                        {specialPolicies.map(p=>{
                          const selected=mobileSpecialPolicyId===p.id;
                          return <button key={p.id} type="button"
                            onClick={()=>{setMobileSpecialPolicyId(p.id);setMobileSpecialExceptionAmount('')}}
                            className={`w-full text-left rounded-lg border px-3 py-2.5 text-xs ${selected?'bg-white border-amber-300 text-amber-800':'bg-white/80 border-gray-100 text-gray-600'}`}>
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold">{selected?'✓ ':''}{p.title}</span>
                              <span className="text-[10px] text-amber-600">대체 {won(p.replacement_amount)}</span>
                            </div>
                            {(p.start_date||p.end_date)&&<div className="text-[9px] text-gray-400 mt-1">{p.start_date||''} ~ {p.end_date||''}</div>}
                          </button>
                        })}
                      </div>
                      {mobileSpecialPolicyId&&(
                        <div className="mt-2">
                          <div className="text-[10px] text-amber-700 leading-relaxed">
                            실적·KPI·성과등급P는 정상 인정하고 요금제/VAS 수수료 대신 선택 정책의 대체 인센티브를 적용해요.
                          </div>
                          <input inputMode="numeric" value={fmtInputNumber(mobileSpecialExceptionAmount)}
                            onChange={e=>setMobileSpecialExceptionAmount(e.target.value.replace(/\D/g,''))}
                            placeholder="예외 지급금액 요청 (선택)"
                            className="mt-2 w-full border rounded-lg px-2 py-2 text-xs bg-white"/>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="mt-2 rounded-lg bg-white px-3 py-3 text-[11px] text-gray-500">
                      현재 적용 가능한 정책이 없어요.<br/>
                      관리자에게 특판·지인판매 정책 등록을 요청해주세요.
                    </div>
                  )}
                </div>
              )}
            </div>

            <label className="block text-xs font-semibold text-gray-500 mt-4 mb-1.5">2. 고객명 *</label>
            <input value={mobileCustomerName} onChange={e=>setMobileCustomerName(e.target.value)}
              placeholder="고객명을 입력해주세요" className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm"/>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">3. 가입구분</label>
                <select
                  value={mobileSaleDraft.ri}
                  onChange={e=>{
                    const ri=Number(e.target.value);
                    const ci=MATRIX_ROW_DEFS[ri]?.hasTiers ? Math.min(mobileSaleDraft.ci||0,MATRIX_COLS.length-1) : 0;
                    setMobileSaleDraft({ri,ci,label:mobileLabelFor(ri,ci)});
                  }}
                  className="w-full border border-gray-200 rounded-xl px-2.5 py-2.5 text-xs bg-white"
                >
                  {MATRIX_ROW_DEFS.map((r,ri)=><option key={r.label} value={ri}>{r.dailyLabel||r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">요금제군</label>
                {MATRIX_ROW_DEFS[mobileSaleDraft.ri]?.hasTiers ? (
                  <select
                    value={mobileSaleDraft.ci}
                    onChange={e=>{
                      const ci=Number(e.target.value),ri=mobileSaleDraft.ri;
                      setMobileSaleDraft({ri,ci,label:mobileLabelFor(ri,ci)});
                    }}
                    className="w-full border border-gray-200 rounded-xl px-2.5 py-2.5 text-xs bg-white"
                  >
                    {MATRIX_COLS.map((c,ci)=><option key={c} value={ci}>{c}</option>)}
                  </select>
                ):(
                  <div className="w-full rounded-xl px-2.5 py-2.5 text-xs bg-gray-50 text-gray-400">해당 없음</div>
                )}
              </div>
            </div>

            {MATRIX_ROW_DEFS[mobileSaleDraft.ri]?.hasTiers && Number(mobileSaleDraft.ci)<=1 && (
              <div className="mt-3">
                <button type="button" onClick={()=>setMobileStrategicPlan(v=>!v)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl border text-xs ${mobileStrategicPlan?'bg-emerald-50 border-emerald-200 text-emerald-700':'bg-white border-gray-100 text-gray-600'}`}>
                  <span className="font-semibold">{mobileStrategicPlan?'✓ ':''}본사 전략요금제</span>
                  <span className="float-right text-[10px] text-gray-400">매출지표 +0.5P</span>
                </button>
                <div className="text-[9px] text-gray-400 mt-1">105군 이상 중 당월 본사 전략요금제에 해당할 때만 체크해주세요.</div>
              </div>
            )}

            <div className="mt-4">
              <div className="text-xs font-semibold text-gray-600 mb-2">
                3. 메인회선 전략 부가서비스(VAS) <span className="font-normal text-gray-400">· 복수 선택 가능</span>
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {[...(config.vas || DEFAULT_VAS), { key:'vasNone', label:'미유치', rate:0 }].map((v) => {
                  const selected = mobileVasKeys.includes(v.key);
                  return (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => {
                        if (v.key === 'vasNone') {
                          setMobileVasKeys(selected ? [] : ['vasNone']);
                        } else {
                          setMobileVasKeys((prev) => {
                            const clean = prev.filter((k) => k !== 'vasNone');
                            return selected ? clean.filter((k) => k !== v.key) : [...clean, v.key];
                          });
                        }
                      }}
                      className={`text-left px-3 py-2.5 rounded-xl border text-xs ${
                        selected
                          ? 'bg-violet-50 border-violet-200 text-violet-700'
                          : 'bg-white border-gray-100 text-gray-600'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{selected ? '✓ ' : ''}{v.label}</span>
                        {v.rate > 0 && <span className="text-[10px] text-gray-400">+{won(v.rate)}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="text-[10px] text-gray-400 mt-1.5">
                미유치는 기록용이며 인센티브에는 포함되지 않아요.
              </div>
            </div>

            {Number(mobileSaleDraft.ri)===5 && Number(mobileSaleDraft.ci)<=3 && (
              <div className="mt-4">
                <div className="text-xs font-semibold text-gray-600 mb-2">4. 중고 MNP 결합 인센티브</div>
                <button type="button" onClick={()=>setMobileUsedMnpBundle(v=>!v)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl border text-xs ${mobileUsedMnpBundle?'bg-violet-50 border-violet-200 text-violet-700':'bg-white border-gray-100 text-gray-600'}`}>
                  <span className="font-semibold">{mobileUsedMnpBundle?'✓ ':''}중고 MNP 61군↑ 결합</span>
                  <span className="float-right text-[10px] text-violet-600 font-bold">+{won(Number((config.mnpBundle||DEFAULT_MNP_BUNDLE).find(v=>v.key==='usedMnpBundle')?.rate||100000))}</span>
                </button>
                <div className="text-[10px] text-gray-400 mt-1.5">SIM MNP(선약) · 61군 이상 · 개통 및 결합완료 건만 체크해주세요.</div>
              </div>
            )}

            <div className="mt-4">
              <div className="text-xs font-semibold text-gray-600 mb-2">5. 2ND 판매 <span className="font-normal text-gray-400">· 최대 2개 선택</span></div>
              <input value={mobileBundleSearch} onChange={e=>setMobileBundleSearch(e.target.value)} placeholder="2ND 기기명 검색" className="w-full mb-2 border border-gray-200 rounded-xl px-3 py-2.5 text-xs"/>
              <div className="grid grid-cols-1 gap-1.5">
                {(config.bundle2nd || DEFAULT_BUNDLE2ND).filter(v=>!mobileBundleSearch.trim()||String(v.label||'').toLowerCase().includes(mobileBundleSearch.trim().toLowerCase())).map(v=>{
                  const selected=mobileBundle2ndKeys.includes(v.key);
                  const bundleVasKeys=mobileBundleVasMap[v.key]||[];
                  return <div key={v.key} className={`rounded-xl border ${selected?'bg-violet-50 border-violet-200':'bg-white border-gray-100'}`}>
                    <button type="button" onClick={()=>setMobileBundle2ndKeys(prev=>{
                      if(prev.includes(v.key)){
                        setMobileBundleVasMap(m=>{const n={...m};delete n[v.key];return n;});
                        setMobileBundleSaleTypeMap(m=>{const n={...m};delete n[v.key];return n;});
                        return prev.filter(k=>k!==v.key);
                      }
                      if(prev.length>=2){ showAppToast('2ND 판매는 최대 2개까지 선택할 수 있어요.',{tone:'info'}); return prev; }
                      setMobileBundleSaleTypeMap(m=>({...m,[v.key]:m[v.key]||'normal'}));
                      return [...prev,v.key];
                    })} className={`w-full text-left px-3 py-2.5 text-xs ${selected?'text-violet-700':'text-gray-600'}`}>
                      <span className="font-semibold">{selected?'✓ ':''}{v.label.replace('2ND · ','')}</span><span className="float-right text-[10px] text-gray-400">+{won(v.rate)}</span>
                    </button>
                    {selected&&<div className="px-3 pb-3">
                      <div className="mb-2">
                        <div className="text-[10px] font-semibold text-gray-500 mb-1.5">판매 구분</div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {[['normal','일반판매'],['free','무료판매']].map(([kind,label])=>{
                            const current=mobileBundleSaleTypeMap[v.key]||'normal';
                            return <button key={kind} type="button" onClick={()=>setMobileBundleSaleTypeMap(prev=>({...prev,[v.key]:kind}))}
                              className={`py-2 rounded-lg border text-[11px] font-semibold ${current===kind?(kind==='free'?'bg-amber-50 border-amber-300 text-amber-700':'bg-violet-50 border-violet-200 text-violet-700'):'bg-white border-gray-100 text-gray-500'}`}>
                              {current===kind?'✓ ':''}{label}
                            </button>
                          })}
                        </div>
                        {(mobileBundleSaleTypeMap[v.key]||'normal')==='free'&&
                          <div className="mt-1.5 text-[10px] leading-relaxed text-amber-700 bg-amber-50 rounded-lg px-2.5 py-2">
                            무료판매는 2ND 실적·KPI는 인정하지만 2ND 번들 및 이 회선의 VAS 인센티브는 지급되지 않아요.
                          </div>}
                      </div>
                      <div className="text-[10px] font-semibold text-gray-500 mb-1.5">{v.label.replace('2ND · ','')} 전략 부가서비스 · 복수 선택 가능</div>
                      <div className="grid grid-cols-1 gap-1">
                        {[...allowedSecondVas(config.vas || DEFAULT_VAS),{key:'vasNone',label:'미유치',rate:0}].map(vas=>{
                          const vasSelected=bundleVasKeys.includes(vas.key);
                          return <button key={vas.key} type="button" onClick={()=>setMobileBundleVasMap(prev=>{
                            const current=prev[v.key]||[];
                            let next;
                            if(vas.key==='vasNone') next=vasSelected?[]:['vasNone'];
                            else{
                              const clean=current.filter(k=>k!=='vasNone');
                              next=vasSelected?clean.filter(k=>k!==vas.key):[...clean,vas.key];
                            }
                            return {...prev,[v.key]:next};
                          })} className={`text-left px-2.5 py-2 rounded-lg border text-[11px] ${vasSelected?'bg-white border-violet-200 text-violet-700':'bg-white/80 border-gray-100 text-gray-600'}`}>
                            <span className="font-semibold">{vasSelected?'✓ ':''}{vas.label}</span>{vas.rate>0&&<span className="float-right text-[10px] text-gray-400">+{won(vas.rate)}</span>}
                          </button>
                        })}
                      </div>
                    </div>}
                  </div>
                })}
              </div>
            </div>

            <div className={`mt-4 grid gap-2 ${editingSale?'grid-cols-2':'grid-cols-3'}`}>
              <button
                type="button"
                onClick={() => {
                  const el=document.getElementById('mobile-care-options');
                  if(el)el.classList.toggle('hidden');
                }}
                className={`py-2.5 rounded-xl border text-xs font-semibold ${mobileCareKeys.length||mobileCustomTitle?'bg-violet-50 border-violet-200 text-violet-700':'bg-gray-50 border-gray-100 text-gray-600'}`}
              >
                + 고객 약속{mobileCareKeys.length?` ${mobileCareKeys.length}`:''}
              </button>
              {editingSale&&<button type="button" onClick={()=>setMobileExpenseOpen(v=>!v)} className={`py-2.5 rounded-xl border text-xs font-semibold ${mobileExpenseOpen?'bg-emerald-50 border-emerald-200 text-emerald-700':'bg-gray-50 border-gray-100 text-gray-600'}`}>+ 영업비용</button>}
{!editingSale&&(<>
              <button
                type="button"
                onClick={() => {
                  const el=document.getElementById('mobile-spot-options');
                  if(el)el.classList.toggle('hidden');
                }}
                className={`py-2.5 rounded-xl border text-xs font-semibold ${mobileSpotPolicyId?'bg-orange-50 border-orange-200 text-orange-600':'bg-gray-50 border-gray-100 text-gray-600'}`}
              >
                + 스팟{mobileSpotPolicyId?' ✓':''}
              </button>
              <button
                type="button"
                onClick={()=>setMobileExpenseOpen(v=>!v)}
                className={`py-2.5 rounded-xl border text-xs font-semibold ${mobileExpenseOpen?'bg-emerald-50 border-emerald-200 text-emerald-700':'bg-gray-50 border-gray-100 text-gray-600'}`}
              >
                + 영업비용
              </button>

</>)}            </div>

            <div id="mobile-care-options" className="hidden mt-4">
              <CareTemplatePicker
                selected={mobileCareKeys} setSelected={setMobileCareKeys}
                customTitle={mobileCustomTitle} setCustomTitle={setMobileCustomTitle}
                customDueDate={mobileCustomDueDate} setCustomDueDate={setMobileCustomDueDate}
                targetPlan={mobileTargetPlan} setTargetPlan={setMobileTargetPlan}
                saleDate={`${month}-${selectedDay}`}
              />
              {mobileExtraPromises.map((x,i)=><div key={i} className="mt-2 grid grid-cols-[1fr_auto] gap-2"><div><input value={x.title} onChange={e=>setMobileExtraPromises(a=>a.map((v,j)=>j===i?{...v,title:e.target.value}:v))} placeholder="추가 약속 내용" className="w-full border rounded-lg px-3 py-2 text-xs"/><input type="date" value={x.dueDate} onChange={e=>setMobileExtraPromises(a=>a.map((v,j)=>j===i?{...v,dueDate:e.target.value}:v))} className="mt-1 w-full border rounded-lg px-3 py-2 text-xs"/></div><button type="button" onClick={()=>setMobileExtraPromises(a=>a.filter((_,j)=>j!==i))} className="text-red-400 text-xs">삭제</button></div>)}
              <button type="button" onClick={()=>setMobileExtraPromises(a=>[...a,{title:'',dueDate:''}])} className="mt-2 text-xs font-semibold text-violet-600">+ 약속 추가</button>
            </div>

            {!editingSale&&<div id="mobile-spot-options" className="hidden mt-4 rounded-xl border border-orange-100 bg-orange-50/40 p-3">
              <div className="text-xs font-semibold text-gray-700 mb-2">🔥 스팟 추가 인센티브</div>
              {mobileSpotPolicies.length>0&&<div className="space-y-1.5">
                {mobileSpotPolicies.map(p=><button key={p.id} type="button" onClick={()=>{setMobileSpotPolicyId(p.id);setMobileSpotDirectOpen(false)}}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs border ${mobileSpotPolicyId===p.id?'bg-white border-orange-300 text-orange-700':'bg-white/70 border-transparent text-gray-600'}`}>
                  <b>{mobileSpotPolicyId===p.id?'✓ ':''}{p.title}</b><span className="float-right">+{won(p.amount)}</span>
                </button>)}
              </div>}
              <button type="button" onClick={()=>{setMobileSpotPolicyId('');setMobileSpotDirectOpen(v=>!v)}}
                className="w-full mt-2 px-3 py-2 rounded-lg text-left text-xs font-bold bg-orange-100/70 text-orange-700">
                + 스팟 직접 입력
              </button>
              {mobileSpotDirectOpen&&<div className="space-y-2 mt-2">
                <input value={mobileSpotDirectTitle} onChange={e=>setMobileSpotDirectTitle(e.target.value)} placeholder="정책명" className="w-full border rounded-lg p-2 text-xs bg-white"/>
                <input value={fmtInputNumber(mobileSpotDirectAmount)} onChange={e=>setMobileSpotDirectAmount(e.target.value.replace(/\D/g,''))} placeholder="추가 금액" className="w-full border rounded-lg p-2 text-xs bg-white"/>
                <input value={mobileSpotDirectMemo} onChange={e=>setMobileSpotDirectMemo(e.target.value)} placeholder="메모 (선택)" className="w-full border rounded-lg p-2 text-xs bg-white"/>
                <div className="text-[10px] text-gray-400">관리자가 확인·수정 후 승인하면 반영돼요.</div>
              </div>}
              {mobileSpotPolicies.length===0&&!mobileSpotDirectOpen&&<div className="text-xs text-gray-400 mt-2">등록된 정책이 없어요. 직접 입력해주세요.</div>}
            </div>}


            {mobileExpenseOpen && (
              <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/30 p-3">
                <div className="text-xs font-semibold text-gray-700 mb-2">💳 이 고객에게 사용한 영업비용</div>
                <div className="grid grid-cols-2 gap-2">
                  <select value={mobileExpenseCategory} onChange={e=>setMobileExpenseCategory(e.target.value)}
                    className="border rounded-lg px-2 py-2 text-xs bg-white">
                    <option>케이스</option><option>오퍼</option><option>판촉</option><option>기타</option>
                  </select>
                  <input inputMode="numeric" value={fmtInputNumber(mobileExpenseAmount)}
                    onChange={e=>setMobileExpenseAmount(e.target.value.replace(/\D/g,''))}
                    placeholder="금액" className="border rounded-lg px-2 py-2 text-xs bg-white"/>
                </div>
                <input value={mobileExpenseMemo} onChange={e=>setMobileExpenseMemo(e.target.value)}
                  placeholder="메모 (선택)" className="mt-2 w-full border rounded-lg px-2 py-2 text-xs bg-white"/>
                {mobileExtraExpenses.map((x,i)=><div key={i} className="mt-2 border-t pt-2"><div className="grid grid-cols-2 gap-2"><select value={x.category} onChange={e=>setMobileExtraExpenses(a=>a.map((v,j)=>j===i?{...v,category:e.target.value}:v))} className="border rounded px-2 py-2 text-xs"><option>오퍼</option><option>케이스</option><option>고객 사은품</option><option>판촉</option><option>기타</option></select><input value={fmtInputNumber(x.amount)} onChange={e=>setMobileExtraExpenses(a=>a.map((v,j)=>j===i?{...v,amount:e.target.value.replace(/\D/g,'')}:v))} placeholder="금액" className="border rounded px-2 py-2 text-xs"/></div><input value={x.memo} onChange={e=>setMobileExtraExpenses(a=>a.map((v,j)=>j===i?{...v,memo:e.target.value}:v))} placeholder="메모" className="mt-1 w-full border rounded px-2 py-2 text-xs"/><button type="button" onClick={()=>setMobileExtraExpenses(a=>a.filter((_,j)=>j!==i))} className="mt-1 text-[10px] text-red-400">이 비용 삭제</button></div>)}
                <button type="button" onClick={()=>setMobileExtraExpenses(a=>[...a,{category:'고객 사은품',amount:'',memo:''}])} className="mt-2 text-xs font-semibold text-emerald-700">+ 영업비용 추가</button>
                <div className="text-[10px] text-gray-400 mt-1">고객명과 판매일은 자동으로 연결돼요.</div>
              </div>
            )}

            {editingSale&&(
              <div className="mt-4 rounded-xl bg-violet-50 px-3 py-2.5 text-[11px] text-violet-700">
                가입구분·요금제군·VAS·고객 약속을 함께 수정해요.
                {editingCompletedTaskCount>0&&<div className="mt-1 font-semibold">이미 완료된 약속 {editingCompletedTaskCount}건은 그대로 유지됩니다.</div>}
                <div className="mt-1 text-violet-500">기존 스팟은 유지되고, 영업비용과 고객약속은 함께 수정할 수 있어요.</div>
              </div>
            )}

            <div className="sticky -bottom-5 mt-5 -mx-5 px-5 pt-3 pb-5 bg-white/95 backdrop-blur border-t border-gray-100 shadow-[0_-8px_20px_rgba(0,0,0,0.04)]">
              {mobilePreview&&<div className="mb-2.5 rounded-xl bg-violet-50 border border-violet-100 px-3 py-2.5">
                <div className="text-[10px] font-bold text-violet-700 truncate">{`${month}-${selectedDay}`} · {mobileCustomerName.trim()||'고객명 미입력'} · {mobileSaleDraft.label}{mobilePreview.secondLabels.length?` · 2ND ${mobilePreview.secondLabels.join(', ')}`:''}</div>
                <div className="text-[9px] text-violet-500 mt-1 truncate">{mobilePreview.vasLabels.length?`VAS ${mobilePreview.vasLabels.join(', ')}`:'VAS 미유치'}{mobilePreview.promiseCount?` · 고객약속 ${mobilePreview.promiseCount}건`:''}</div>
                {editingSale&&<div className="mt-1.5 rounded-lg bg-white/70 px-2 py-1.5 text-[10px] text-violet-700"><b>변경 전후</b> · {editingSale.metric_label||'기존 판매'} → {mobileSaleDraft.label}</div>}
                {!editingSale&&<div className="flex justify-between mt-1.5 text-[11px]"><b className="text-emerald-700">이번 판매 총 +{won(mobilePreview.incentive)}</b><b className="text-violet-700">성과P +{fmtNum(mobilePreview.points,1)}P</b></div>}
              </div>}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={()=>{setMobileSaleDraft(null);setEditingSale(null);setEditingCompletedTaskCount(0)}} disabled={mobileSaleSaving}
                  className="py-2.5 rounded-xl bg-gray-100 text-gray-500 text-sm font-semibold">취소</button>
                <button onClick={submitMobileSale} disabled={mobileSaleSaving||!mobileCustomerName.trim()}
                  className="py-2.5 rounded-xl bg-violet-600 text-white text-sm font-bold disabled:opacity-50">
                  {mobileSaleSaving?(editingSale?'수정 중...':'판매건 등록 중...'):(editingSale?'수정 저장':'실적 등록')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {homeOrderDraft && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="text-xs text-violet-500 font-semibold">한 번에 홈 판매 등록</div>
            <div className="text-lg font-bold text-gray-900 mt-1">홈 실적 입력</div>
            <div className="text-xs text-gray-400 mt-1">{month}-{selectedDay} 접수</div>
            {!homeOrderDraft?.editing&&<div className="mt-2 rounded-xl bg-blue-50 border border-blue-100 px-3 py-2 text-[10px] text-blue-700">항목 선택만으로는 저장되지 않아요. 맨 아래 <b>등록</b>을 눌러야 홈 주문·고객정보·약속이 함께 등록됩니다.</div>}

            <label className="block text-xs font-semibold text-gray-500 mt-4 mb-1.5">
              1. 고객명 <span className="text-red-500">*</span>
            </label>
            <input
              autoFocus
              value={homeCustomerName}
              onChange={(e) => setHomeCustomerName(e.target.value)}
              placeholder="고객명을 입력해주세요"
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-violet-200"
            />

            <label className="block text-xs font-semibold text-gray-500 mt-4 mb-1.5">
              2. 망 구분 <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {HOME_NETWORK_TYPES.map(n=>(
                <button key={n.key} type="button" onClick={()=>setHomeNetworkType(n.key)}
                  className={`py-3 rounded-xl border text-sm font-bold ${
                    homeNetworkType===n.key
                      ? 'bg-violet-50 border-violet-300 text-violet-700'
                      : 'bg-white border-gray-200 text-gray-500'
                  }`}>
                  {homeNetworkType===n.key?'✓ ':''}{n.label}
                </button>
              ))}
            </div>
            <div className="text-[10px] text-gray-400 mt-1.5">
              가정망/소호망은 성과 및 관리자 평가의 가정망 비중 계산에도 사용돼요.
            </div>

            <label className="block text-xs font-semibold text-gray-500 mt-4 mb-1.5">
              3. 판매 유형
            </label>
            <div className="grid grid-cols-2 gap-2">
              {HOME_SALE_TYPES.map(t=>(
                <button key={t.key} type="button" onClick={()=>setHomeSaleType(t.key)}
                  className={`py-3 rounded-xl border text-sm font-bold ${homeSaleType===t.key?'bg-violet-50 border-violet-300 text-violet-700':'bg-white border-gray-200 text-gray-500'}`}>
                  {homeSaleType===t.key?'✓ ':''}{t.label}
                </button>
              ))}
            </div>
            {homeSaleType==='allinone'&&<div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[10px] text-amber-700">올인원은 홈 인센티브는 0원이지만 그레이드 수량과 성과/KPI에는 정상 인정됩니다.</div>}

            <div className="mt-4">
              <div className="text-xs font-semibold text-gray-600 mb-2">4. 판매 상품 <span className="font-normal text-gray-400">· 필요한 것만 선택</span></div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={()=>{setHomeInternet(v=>!v);if(homeInternet){setHomeMainTv(false);setHomeInternetSpeed('')}}} className={`py-3 rounded-xl border text-xs font-bold ${homeInternet?'bg-violet-50 border-violet-300 text-violet-700':'bg-white border-gray-200 text-gray-500'}`}>{homeInternet?'✓ ':''}인터넷</button>
                <button type="button" onClick={()=>{if(!homeInternet)return showAppToast('TV(주)는 인터넷과 함께 선택해주세요.',{tone:'info'});setHomeMainTv(v=>!v)}} className={`py-3 rounded-xl border text-xs font-bold ${homeMainTv?'bg-violet-50 border-violet-300 text-violet-700':'bg-white border-gray-200 text-gray-500'}`}>{homeMainTv?'✓ ':''}TV(주)</button>
                <button type="button" onClick={()=>setHomeSubTv(v=>!v)} className={`py-3 rounded-xl border text-xs font-bold ${homeSubTv?'bg-violet-50 border-violet-300 text-violet-700':'bg-white border-gray-200 text-gray-500'}`}>{homeSubTv?'✓ ':''}TV(부)</button>
                <button type="button" onClick={()=>setHomeSmartHome(v=>!v)} className={`py-3 rounded-xl border text-xs font-bold ${homeSmartHome?'bg-violet-50 border-violet-300 text-violet-700':'bg-white border-gray-200 text-gray-500'}`}>{homeSmartHome?'✓ ':''}스마트홈</button>
              </div>
              {homeInternet&&<div className="mt-3 rounded-xl border border-violet-100 bg-violet-50/30 p-3"><div className="text-xs font-semibold text-gray-700 mb-2">인터넷 속도 <span className="text-red-500">*</span></div><div className="grid grid-cols-3 gap-2">{[['100','100MB'],['500','500MB'],['1g','1GB']].map(([k,l])=><button key={k} type="button" onClick={()=>setHomeInternetSpeed(k)} className={`py-2.5 rounded-xl border text-xs font-bold ${homeInternetSpeed===k?'bg-violet-100 border-violet-300 text-violet-700':'bg-white border-gray-200 text-gray-500'}`}>{homeInternetSpeed===k?'✓ ':''}{l}</button>)}</div></div>}
              {homeSubTv&&<div className="grid grid-cols-2 gap-2 mt-2"><button type="button" onClick={()=>setHomeSubTvType('normal')} className={`py-2.5 rounded-xl border text-xs font-semibold ${homeSubTvType==='normal'?'bg-violet-50 border-violet-300 text-violet-700':'bg-gray-50 border-gray-100 text-gray-500'}`}>일반 부셋탑</button><button type="button" onClick={()=>setHomeSubTvType('free')} className={`py-2.5 rounded-xl border text-xs font-semibold ${homeSubTvType==='free'?'bg-violet-50 border-violet-300 text-violet-700':'bg-gray-50 border-gray-100 text-gray-500'}`}>프리 부셋탑</button></div>}
              <div className="text-[10px] text-gray-400 mt-2">TV프리(부)와 스마트홈은 인터넷 없이 단독으로도 선택할 수 있어요.</div>
            </div>

            <div className="mt-4 rounded-xl border border-gray-100 p-3">
              <div className="text-xs font-semibold text-gray-700 mb-2">5. 모바일 동시판매 <span className="font-normal text-gray-400">· 해당 시 선택</span></div>
              <div className="grid grid-cols-1 gap-2">
                {[['none','없음'],['newChange','신규/기변 동시판매'],['mnp','MNP 동시판매'],['usedMnp','중고 MNP 동시판매']].map(([k,l])=><button key={k} type="button" onClick={()=>{if(k==='usedMnp'&&homeNetworkType!=='household')return showAppToast('중고 MNP 동시판매는 가정망에서만 적용할 수 있어요.',{tone:'info'});setHomeMobileSimul(k)}} className={`py-2.5 px-3 rounded-xl border text-left text-xs font-semibold ${homeMobileSimul===k?'bg-violet-50 border-violet-300 text-violet-700':'bg-white border-gray-200 text-gray-500'}`}>{homeMobileSimul===k?'✓ ':''}{l}</button>)}
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
              <button type="button" onClick={()=>{const el=document.getElementById('home-spot-options');if(el)el.classList.toggle('hidden')}} className={`py-2.5 rounded-xl border text-xs font-semibold ${homeSpotPolicyId||homeSpotDirectOpen?'bg-orange-50 border-orange-200 text-orange-700':'bg-gray-50 border-gray-100 text-gray-600'}`}>+ 스팟 정책</button>
              <button type="button" onClick={()=>setHomeExpenseOpen(v=>!v)} className={`py-2.5 rounded-xl border text-xs font-semibold ${homeExpenseOpen?'bg-emerald-50 border-emerald-200 text-emerald-700':'bg-gray-50 border-gray-100 text-gray-600'}`}>+ 오퍼/영업비용</button>
            </div>
            <div id="home-spot-options" className="hidden mt-3 rounded-xl border border-orange-100 bg-orange-50/40 p-3">
              <div className="text-xs font-semibold text-gray-700 mb-2">🔥 홈 스팟 추가 인센티브</div>
              {homeSpotPolicies.map(p=><button key={p.id} type="button" onClick={()=>{setHomeSpotPolicyId(p.id);setHomeSpotDirectOpen(false)}} className={`w-full mb-1 text-left px-3 py-2 rounded-lg text-xs border ${homeSpotPolicyId===p.id?'bg-white border-orange-300 text-orange-700':'bg-white/70 border-transparent text-gray-600'}`}><b>{homeSpotPolicyId===p.id?'✓ ':''}{p.title}</b><span className="float-right">+{won(p.amount)}</span></button>)}
              <button type="button" onClick={()=>{setHomeSpotPolicyId('');setHomeSpotDirectOpen(v=>!v)}} className="w-full mt-1 px-3 py-2 rounded-lg text-left text-xs font-bold bg-orange-100/70 text-orange-700">+ 스팟 직접 입력</button>
              {homeSpotDirectOpen&&<div className="space-y-2 mt-2"><input value={homeSpotDirectTitle} onChange={e=>setHomeSpotDirectTitle(e.target.value)} placeholder="정책명" className="w-full border rounded-lg p-2 text-xs bg-white"/><input value={fmtInputNumber(homeSpotDirectAmount)} onChange={e=>setHomeSpotDirectAmount(e.target.value.replace(/\D/g,''))} placeholder="추가 금액" className="w-full border rounded-lg p-2 text-xs bg-white"/><input value={homeSpotDirectMemo} onChange={e=>setHomeSpotDirectMemo(e.target.value)} placeholder="메모 (선택)" className="w-full border rounded-lg p-2 text-xs bg-white"/></div>}
            </div>
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
                <div className="text-[10px] opacity-70 mt-1">{toast.source==='mobile'?`성과P +${fmtNum(toast.pointDelta,1)}P`:''}{toast.promiseCount>0?`${toast.source==='mobile'?' · ':''}고객 약속 ${toast.promiseCount}건 등록`:''}</div>

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
    {key:'hs',label:'HS',unit:'count',value:hsCount(draft)},
    {key:'simMnp',label:'SIM MNP',unit:'count',value:simMnpTotal},
    {key:'second',label:'2ND',unit:'count',value:secondStandalone+secondBundle},
    {key:'productivity',label:'생산성',unit:'point',value:Number(pay?.kpiScore||0)},
    {key:'home',label:'홈',unit:'count',value:Number(draft?.homeBase?.homeOnly||0)+Number(draft?.homeBase?.homeTv||0)},
    {key:'tvFree',label:'프리',unit:'count',value:Number(draft?.homeFlat?.tvFree||0)},
    {key:'smartHome',label:'스홈',unit:'count',value:Number(draft?.homeFlat?.smartHome||0)},
    {key:'sono',label:'소노',unit:'count',value:Object.values(draft?.sono||{}).reduce((s,v)=>s+Number(v||0),0)},
    {key:'tailoredAmount',label:'맞춤제안 매출액',unit:'won',value:Number(draft?.tailoredAmount||0)},
    {key:'tailoredCount',label:'업셀건',unit:'count',value:Number(draft?.tailoredCount||0)},
  ];
  const [detailMetric,setDetailMetric]=useState(null);

  const goalFor=(m)=>{
    const aliases={
      hs:'hs', home:'home', tvFree:'tvFree', smartHome:'smartHome',
      tailoredAmount:'tailoredAmount', tailoredCount:'tailoredCount'
    };
    const k=aliases[m.key];
    return k ? Number(personalGoals?.[k]||0) : 0;
  };

  const renderValue=(m)=>{
    if(m.unit==='won') return won(m.value);
    if(m.unit==='point') return `${Number(m.value||0).toFixed(1)}P`;
    return `${fmtCount(m.value)}건`;
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
        {goalEditing&&<div className="mt-3 p-3 bg-gray-50 rounded-xl space-y-2">
          {PERSONAL_GOAL_DEFS.map(def=><div key={def.key} className="flex items-center gap-2"><span className="text-[10px] text-gray-500 w-24 truncate">{def.label}</span><input type="number" value={goalValues[def.key]??''} onChange={e=>setGoalValues(v=>({...v,[def.key]:e.target.value}))} placeholder="미설정" className="min-w-0 flex-1 px-2 py-1.5 rounded-lg border border-gray-200 text-xs"/><span className="text-[9px] text-gray-400">{def.unit}</span></div>)}
          <button disabled={goalSaving} onClick={async()=>{const ok=await onSaveGoals?.(goalValues);if(ok)setGoalEditing(false)}} className="w-full mt-1 py-2 rounded-lg bg-violet-600 text-white text-xs font-bold disabled:opacity-50">{goalSaving?'저장 중':'목표 저장'}</button>
        </div>}
      </div>
      <div className="p-3 space-y-2">
        {[metrics.slice(0,4),metrics.slice(4,8),metrics.slice(8,10)].map((row,ri)=>(
          <div key={ri} className={`grid gap-2 ${ri<2?'grid-cols-4':'grid-cols-2'}`}>
            {row.map(m=>{
              const goal=goalFor(m);
              const pct=goal>0?Math.min(999,Math.round(Number(m.value||0)/goal*100)):null;
              return <button type="button" onClick={()=>setDetailMetric(m)} key={m.key} className="rounded-xl bg-gray-50 px-2 py-2.5 text-center min-w-0 hover:bg-violet-50 active:scale-[0.98] transition">
                <div className="text-[10px] text-gray-400 leading-tight min-h-[22px] flex items-center justify-center">{m.label}</div>
                <div className={`font-bold text-gray-900 mt-1 whitespace-nowrap ${m.unit==='won'?'text-[13px]':'text-[15px]'}`}>{renderValue(m)}</div>
                {goal>0?<div className="text-[9px] text-violet-500 mt-1">목표 {m.unit==='won'?won(goal):m.unit==='point'?`${fmtNum(goal,1)}P`:`${fmtCount(goal)}건`} · {pct}%</div>:<div className="text-[9px] text-gray-300 mt-1">목표 미설정</div>}
              </button>
            })}
          </div>
        ))}
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

function AdminCustomerCareOverview({ employees, authUserId }) {
  const [tasks,setTasks]=useState([]),[customers,setCustomers]=useState([]),[loading,setLoading]=useState(true);
  const employeeMap=Object.fromEntries((employees||[]).map(e=>[e.id,e]));
  const load=useCallback(async()=>{
    setLoading(true);
    const [{data:t},{data:c}]=await Promise.all([
      supabase.from('customer_tasks').select('*').order('due_date',{ascending:true}),
      supabase.from('customers').select('id,user_id,customer_name')
    ]);
    setTasks(t||[]);setCustomers(c||[]);setLoading(false);
  },[]);
  useEffect(()=>{load()},[load]);
  const customerMap=Object.fromEntries(customers.map(c=>[c.id,c]));
  const today=new Date().toISOString().slice(0,10), week=addDaysDate(today,7);
  const visible=tasks.filter(t=>employeeMap[t.user_id]);
  const due=visible.filter(t=>t.status!=='completed'&&t.status!=='cancelled'&&t.due_date&&t.due_date<=week);
  const overdue=due.filter(t=>t.due_date<today);
  const completed=visible.filter(t=>t.status==='completed');
  const denominator=completed.length+overdue.length;
  const rate=denominator?Math.round(completed.length/denominator*100):100;

  if(loading)return <div className="bg-white rounded-xl border p-4 text-xs text-gray-400">고객 약속 현황 불러오는 중...</div>;
  return <div className="space-y-3">
    <div className="grid grid-cols-4 gap-2">
      {[['오늘',due.filter(t=>t.due_date===today).length],['7일 내',due.filter(t=>t.due_date>=today).length],['기한초과',overdue.length],['이행률',`${rate}%`]].map(([l,v])=>
        <div key={l} className="bg-white rounded-xl border border-gray-100 p-3 text-center"><div className={`text-lg font-bold ${l==='기한초과'&&Number(v)>0?'text-red-600':'text-gray-900'}`}>{v}</div><div className="text-[10px] text-gray-400">{l}</div></div>)}
    </div>
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 border-b"><div className="text-sm font-bold">고객 약속 상세</div><div className="text-xs text-gray-400">담당 직원과 고객명을 함께 확인해요.</div></div>
      <div className="divide-y">
        {[...due].sort((a,b)=>a.due_date.localeCompare(b.due_date)).map(t=>{
          const emp=employeeMap[t.user_id], customer=customerMap[t.customer_id];
          return <div key={t.id} className="px-4 py-3 flex justify-between gap-3 text-xs">
            <div>
              <div className="font-bold text-gray-800">{emp?.name||'직원'} · {customer?.customer_name||'고객'}</div>
              <div className="text-gray-500 mt-1">{t.title}</div>
              {t.target_plan&&<div className="text-violet-700 mt-1">변경 예정 · {t.target_plan}</div>}
            </div>
            <div className={`shrink-0 ${t.due_date<today?'text-red-500':t.due_date===today?'text-orange-500':'text-violet-600'}`}>{t.due_date}</div>
          </div>
        })}
        {due.length===0&&<div className="py-8 text-center text-xs text-gray-400">7일 내 확인할 고객 약속이 없어요.</div>}
      </div>
    </div>
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
      const detailHomePolicy=calculateHomePolicyFromOrders(homeRes.data||[],config);
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

function AdminView({ adminTab, setAdminTab, months, month, setMonth, rows, rankingRows, dailyRecords, totalPay, pendingCount, approve, rejectApproval, config, persistConfig, employees, addEmployee, updateEmployee, removeEmployee, stores, addStore, removeStore, isFullAdmin, monthLocked, toggleMonthLock, authUserId, loginPosition='', loginBranch='', canSwitchStores=false }) {
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
    ...(isFullAdmin ? [
      { key: 'headOfficeData', label: '본사 데이터', icon: UploadCloud, group:'실적 관리' },
      { key: 'settlement', label: '정산 검토', icon: Wallet, group:'정산' },
      { key: 'rates', label: '지급기준 관리', icon: Settings, group:'설정' },
      { key: 'permissions', label: '권한 관리', icon: ShieldCheck, group:'설정' },
    ] : []),
  ];
  const TAB_GROUPS=['현황','실적 관리','고객 · 홈','비용 · 승인','정산','설정'];
  useEffect(() => {
    if ((adminTab === 'rates' || adminTab === 'permissions' || adminTab === 'settlement' || adminTab === 'headOfficeData') && !isFullAdmin) setAdminTab('dashboard');
  }, [adminTab, isFullAdmin]); // eslint-disable-line

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

      {adminTab === 'dashboard' && (
        <div className="space-y-4">
          <AdminManagementAlerts pendingCount={pendingCount} employees={employees} onGo={setAdminTab} month={month} rows={rows} dailyRecords={dailyRecords} isFullAdmin={isFullAdmin} config={config} />

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

          <AdminCustomerCareOverview employees={employees} authUserId={authUserId} />
        </div>
      )}

      {adminTab === 'performance' && <ComparisonView rows={rows} />}
      {adminTab === 'evaluation' && <EvaluationTab month={month} config={config} isManagerView={true} canFinalApprove={isFullAdmin} employees={employees} rows={rankingRows||rows} authUserId={authUserId} canSwitchStores={canSwitchStores} loginBranch={loginBranch} />}
      {adminTab === 'customerCareAdmin' && <AdminCustomerCareOverview employees={employees} authUserId={authUserId} />}
      {adminTab === 'homeCare' && <AdminHomeCare employees={employees} month={month} />}
      {adminTab === 'performanceApproval' && <PerformanceCheckPanel month={month} rows={rows} dailyRecords={dailyRecords} employees={employees} />}
      {adminTab === 'expenses' && <AdminExpenseOverview month={month} employees={employees} loginBranch={loginBranch} canSwitchStores={canSwitchStores} />}
      {adminTab === 'storeGoals' && <StoreGoalAdmin month={month} employees={employees} rows={rows} isFullAdmin={isFullAdmin} authUserId={authUserId} />}
      {adminTab === 'spot' && <SpotAdmin authUserId={authUserId} isFullAdmin={isFullAdmin} />}
      {adminTab === 'headOfficeData' && isFullAdmin && <HeadOfficeDataPanel month={month} employees={employees} rows={rows} config={config} authUserId={authUserId} />}
      {adminTab === 'settlement' && isFullAdmin && <SettlementReview month={month} rows={rows} employees={employees} config={config} authUserId={authUserId} />}
      {adminTab === 'history' && <HistoryTab employees={employees} month={month} config={config} />}

      {adminTab === 'employees' && (
        <EmployeeManager employees={employees} addEmployee={addEmployee} updateEmployee={updateEmployee} removeEmployee={removeEmployee} stores={stores} addStore={addStore} removeStore={removeStore} />
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

function EmployeeManager({ employees, addEmployee, updateEmployee, removeEmployee, stores, addStore, removeStore }) {
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
