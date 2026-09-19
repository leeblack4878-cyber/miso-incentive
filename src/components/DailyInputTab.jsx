import { buildReminderTasks, reminderServices, restoreReminders } from '../customerPromises';
import ReminderChoices from './ReminderChoices';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

import { supabase } from '../supabase';
import { friendlyError } from '../errorMessages';
import { showAppToast, showAppConfirm, showLegacyAlert } from '../feedback';
import { deleteSaleAtomic, dayAfterSaleDeletion, saveSaleAtomic, readSaleChildren } from '../saleMutations';
import { loadHomeBundleChildren } from '../homeBundleEditor';
import { teamSupportEligibleFor } from '../permissionScopes';
import PolicyInputNotice from '../components/PolicyInputNotice';
import { MATRIX_ROW_DEFS, MATRIX_COLS, displayStoreName, fmtNum, fmtInputNumber, won } from '../uiDefinitions';
import { allowedSecondVas, mergeSaleMetaPreservingLegacy, calculateHomePolicyFromOrders as calculateHomePolicyEngine } from '../policyRules';
import { SEPTEMBER_POLICY_VERSION, SEPTEMBER_MATRIX_COLUMNS, SEPTEMBER_SPECIAL_SALES, calculateSeptemberSpecialSale, septemberMobileSaleType, september18HomeApplication, calculateSeptemberBundleSale } from '../septemberPolicy';

import { isSeptemberPolicyActive } from '../policyCalendar';
import { daysInMonth, monthKeyOf, normalizeDay, emptyHouseholdRenewForm, NON_SALES_STORES, DEFAULT_VAS, DEFAULT_BUNDLE2ND, dayHasPerformanceData, aggregateHouseholdRenewals, calculateHouseholdRenew, homeMainTvPlanLabel, ensureCustomer, CURRENT_SALE_SCHEMA_VERSION, withCurrentSaleSchema, homeTeamCreditMetrics, notifyStoreManagers, homeNetworkLabel, DEFAULT_SONO, applyDailyToDraft, computePay, mobileStrategicPoint, saleSchemaVersion, emptyDayMatrix, inferHomeProductTypeFromLabel, legacySaleBadge, compatHomeRows, isIncentiveUnpaidSpecial, septemberPlanGroup, currentPolicySnapshot, mobileTeamCreditMetrics, DAILY_GROUP_KEYS, DEFAULT_MNP_BUNDLE, monthLabel, DailySaveBadge, dayHasData, calendarCoreMetrics, fmtCount, HOUSEHOLD_RENEW_PLANS, StandalonePromiseModal, HOME_NETWORK_TYPES } from "../appShared";

export default function DailyInputTab({ month, dailyDays, saveDailyDay, config, draft, setDraft, pay, locked, policyInputBlocked=false, currentEmp, loginEmp, stores=[], onTeamCreditSaved, onHomeOrdersChanged, onSalesChanged, authUser, resetMonthOpen, setResetMonthOpen, resetPhrase, setResetPhrase, resetBusy, resetOwnMonthPerformance }) {
  const n = daysInMonth(month);
  const todayKey = (() => {
    const now = new Date();
    return monthKeyOf(now) === month ? String(now.getDate()).padStart(2, '0') : '01';
  })();
  const [selectedDay, setSelectedDay] = useState(todayKey);
  const [day, setDay] = useState(() => normalizeDay(dailyDays[todayKey]));
  const [pickedRow, setPickedRow] = useState(null); // 선택한 가입구분 index
  const [inputCategory, setInputCategory] = useState(null); // mobile | home | extra
  const [standalonePromiseOpen,setStandalonePromiseOpen]=useState(false);
  const [toast, setToast] = useState(null);         // 등록 피드백 카드
  const [saveState, setSaveState] = useState('idle'); // idle | pending | saved | error
  const [homeOrderDraft, setHomeOrderDraft] = useState(null); // { groupKey, itemKey, label, productType }
  const [homeCustomerName, setHomeCustomerName] = useState('');
  const [homeNetworkType, setHomeNetworkType] = useState('');
  const [homeInternet,setHomeInternet]=useState(false);
  const [homeInternetSpeed,setHomeInternetSpeed]=useState(''); // 100 | 500 | 1g
  const [homeMobileSimul,setHomeMobileSimul]=useState('none'); // none | newChange | mnp | usedMnp
  const [homeMainTv,setHomeMainTv]=useState(false);
  const [homeMainTvPlan,setHomeMainTvPlan]=useState(''); // household: broadcastPass|premium|belowPremium, soho: premium|belowPremium
  const [homeSubTv,setHomeSubTv]=useState(false);
  const [homeSubTvType,setHomeSubTvType]=useState('');
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
  const [recentMobileCombos,setRecentMobileCombos]=useState([]);
  const [mobileDetailsOpen,setMobileDetailsOpen]=useState(false);
  const [mobileCalcOpen,setMobileCalcOpen]=useState(false);
  const [mobileMoreVasOpen,setMobileMoreVasOpen]=useState(false);
  const [editingSale,setEditingSale]=useState(null);
  const [editingCompletedTaskCount,setEditingCompletedTaskCount]=useState(0);
  const [mobileCustomerName,setMobileCustomerName]=useState('');
  const [mobileReminders,setMobileReminders]=useState({plan:'keep',services:{}});
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
  const [mobileExtraExpenses,setMobileExtraExpenses]=useState([]);
  const [specialPolicies,setSpecialPolicies]=useState([]);
  // v21.25: 모바일 입력 최상단에서 일반판매 / 특판·지인판매를 먼저 선택
  const [mobileSaleKind,setMobileSaleKind]=useState(''); // '' | normal | special | incentive_unpaid
  const [mobileSpecialPolicyId,setMobileSpecialPolicyId]=useState('');
  const [mobileSpecialExceptionAmount,setMobileSpecialExceptionAmount]=useState('');
  const [extraInput,setExtraInput]=useState(null); // sono | tailored | customerReg
  const [extraCustomer,setExtraCustomer]=useState('');
  const [extraSonoKey,setExtraSonoKey]=useState('sonoBasic');
  const [extraCount,setExtraCount]=useState('1');
  const [extraAmount,setExtraAmount]=useState('');
  const [mobileSaleSaving,setMobileSaleSaving]=useState(false);
  const [daySales,setDaySales]=useState([]);
  // customer_sales가 없던 구버전 홈 주문도 일일 집계의 원본으로 인식합니다.
  // 특히 취소된 주문을 '이전 방식 입력 실적'으로 다시 복원하게 만드는 것을 막습니다.
  const [dayHomeOrders,setDayHomeOrders]=useState([]);
  const [homePreviewPolicy,setHomePreviewPolicy]=useState(null); // 설치예정 포함, 입력건 예상 홈 인센티브
  const [saleIncentiveOpen,setSaleIncentiveOpen]=useState(null);
  const [daySalesLoading,setDaySalesLoading]=useState(false);
  const [legacyEditorOpen,setLegacyEditorOpen]=useState(false);
  const [legacyMatrixDraft,setLegacyMatrixDraft]=useState(null);
  // 구버전 집계 1건을 현재 모바일/홈 입력 UI로 복원하는 동안 원본 위치를 기억
  const [legacyConversion,setLegacyConversion]=useState(null);
  const [teamSupportMode,setTeamSupportMode]=useState(false);
  const [teamSupportStore,setTeamSupportStore]=useState('');
  const [isOnline,setIsOnline]=useState(()=>typeof navigator==='undefined'||navigator.onLine);
  const homeSubmitGuardRef=useRef(false);
  const mobileSubmitGuardRef=useRef(false);

  const teamSupportEligible=teamSupportEligibleFor(loginEmp);
  const salesStores=(stores||[]).filter(store=>!NON_SALES_STORES.includes(store));
  const activeTeamSupport=teamSupportEligible&&currentEmp?.id===authUser?.id&&teamSupportMode;
  const resetTeamSupportSelection=()=>{setTeamSupportMode(false);setTeamSupportStore('');};
  const pendingDayStorageKey=currentEmp?.id?`miso_pending_daily_v1:${currentEmp.id}:${month}`:'';
  const rememberPendingDay=(value)=>{if(!pendingDayStorageKey)return;try{localStorage.setItem(pendingDayStorageKey,JSON.stringify(value));}catch{/* 저장공간 제한 시 서버 저장 흐름은 계속 유지 */}};
  const clearPendingDay=()=>{if(!pendingDayStorageKey)return;try{localStorage.removeItem(pendingDayStorageKey);}catch{/* 저장공간 제한은 무시 */}};


  const dayMatrix = day.matrix;
  const activeMatrixCols=isSeptemberPolicyActive(month)?SEPTEMBER_MATRIX_COLUMNS:MATRIX_COLS;
  // 9월의 33~84군은 현장 입력에서 사용하지 않습니다. 해당 고객은 '그 외'로 기록합니다.
  // 저장 배열 인덱스는 과거 데이터 호환을 위해 그대로 두고 선택지만 숨깁니다.
  const activeMatrixOptions=activeMatrixCols
    .map((label,ci)=>({label,ci}))
    .filter(option=>!(isSeptemberPolicyActive(month)&&option.ci===3));
  const normalizedMainVas=(config.vas||DEFAULT_VAS).filter(v=>!(isSeptemberPolicyActive(month)&&v.key==='vasVcolor'));
  const primaryVasKeys=new Set(['vasKyobo','vasVcolorBundle','vasVcolor','vasPhonePass','vasSafePass']);
  const primaryMainVas=normalizedMainVas.filter(v=>primaryVasKeys.has(v.key));
  const additionalMainVas=normalizedMainVas.filter(v=>!primaryVasKeys.has(v.key));
  const isDayOff = !!day.dayOff;

  const recentComboStorageKey=currentEmp?.id?`miso_recent_mobile_combos_v1:${currentEmp.id}`:'';
  useEffect(()=>{
    if(!recentComboStorageKey){setRecentMobileCombos([]);return;}
    try{
      const parsed=JSON.parse(localStorage.getItem(recentComboStorageKey)||'[]');
      setRecentMobileCombos(Array.isArray(parsed)?parsed.slice(0,3):[]);
    }catch{setRecentMobileCombos([]);}
  },[recentComboStorageKey]);

  const rememberMobileCombo=()=>{
    if(!recentComboStorageKey||!mobileSaleDraft)return;
    const combo={
      ri:Number(mobileSaleDraft.ri),ci:Number(mobileSaleDraft.ci),label:mobileSaleDraft.label,
      strategicPlan:!!mobileStrategicPlan,vasKeys:[...(mobileVasKeys||[])],
      bundle2ndKeys:[...(mobileBundle2ndKeys||[])],bundleVasMap:{...(mobileBundleVasMap||{})},
      bundleSaleTypeMap:{...(mobileBundleSaleTypeMap||{})},usedMnpBundle:!!mobileUsedMnpBundle
    };
    const signature=JSON.stringify(combo);
    const next=[combo,...recentMobileCombos.filter(x=>JSON.stringify(x)!==signature)].slice(0,3);
    setRecentMobileCombos(next);
    try{localStorage.setItem(recentComboStorageKey,JSON.stringify(next));}catch{/* 기기 저장공간 제한 시 빠른 선택만 생략 */}
  };

  const applyRecentMobileCombo=(combo)=>{
    const ri=Number(combo?.ri),maxCi=Math.max(0,activeMatrixCols.length-1);
    if(!Number.isInteger(ri)||!MATRIX_ROW_DEFS[ri])return;
    const storedCi=Math.min(Math.max(0,Number(combo?.ci)||0),maxCi);
    const ci=MATRIX_ROW_DEFS[ri].hasTiers?(isSeptemberPolicyActive(month)&&storedCi===3?5:storedCi):0;
    const vasKeys=(combo.vasKeys||[]).map(k=>isSeptemberPolicyActive(month)&&k==='vasVcolor'?'vasVcolorBundle':k).filter((k,i,a)=>(k==='vasNone'||(config.vas||DEFAULT_VAS).some(v=>v.key===k))&&a.indexOf(k)===i);
    const bundleKeys=(combo.bundle2ndKeys||[]).filter(k=>(config.bundle2nd||DEFAULT_BUNDLE2ND).some(v=>v.key===k)).slice(0,2);
    setMobileSaleDraft({ri,ci,label:mobileLabelFor(ri,ci)});
    setMobileSaleKind('normal');
    setMobileStrategicPlan(!!combo.strategicPlan);
    setMobileVasKeys(vasKeys);
    setMobileBundle2ndKeys(bundleKeys);
    setMobileBundleVasMap(Object.fromEntries(bundleKeys.map(k=>[k,(combo.bundleVasMap?.[k]||[]).filter(v=>v==='vasNone'||(config.vas||DEFAULT_VAS).some(x=>x.key===v))])));
    setMobileBundleSaleTypeMap(Object.fromEntries(bundleKeys.map(k=>[k,combo.bundleSaleTypeMap?.[k]||'normal'])));
    setMobileUsedMnpBundle(!!combo.usedMnpBundle);
    setMobileDetailsOpen(bundleKeys.length>0);
    setMobileMoreVasOpen(vasKeys.some(k=>additionalMainVas.some(v=>v.key===k)));
    showAppToast('최근 판매 조합을 불러왔어요.',{tone:'info'});
  };

  const setDayOff = async (nextOff) => {
    if (locked) return;
    if (nextOff && dayHasPerformanceData(day)) {
      const ok = await showAppConfirm({title:'실적이 있는 날짜예요',message:'휴무로 표시해도 입력된 실적은 그대로 유지됩니다.',confirmLabel:'휴무로 표시',tone:'warning'});
      if (!ok) return;
    }
    const next = { ...normalizeDay(day), dayOff: nextOff, ...(nextOff ? { inputConfirmed:false, inputConfirmedAt:null } : {}) };
    setDay(next);
    pendingRef.current = { day: selectedDay, record: next };
    rememberPendingDay(pendingRef.current);
    setSaveState('pending');
  };

  // 저장되지 않은 변경을 담아두는 칸 — 날짜를 바꾸거나 화면을 떠날 때 이걸 먼저 비움
  const pendingRef = useRef(null);
  const flushBusyRef=useRef(false);
  const flushRef = useRef(() => {});

  const flush = useCallback(async() => {
    const p = pendingRef.current;
    if (!p || locked || flushBusyRef.current) return;
    if(typeof navigator!=='undefined'&&!navigator.onLine){setSaveState('error');return;}
    pendingRef.current = null;
    flushBusyRef.current=true;
    let ok;
    try{ok=await saveDailyDay(p.day,p.record);}finally{flushBusyRef.current=false;}
    if(ok){
      clearPendingDay();
      setSaveState('saved');
      setTimeout(()=>setSaveState('idle'),1200);
    }else{
      pendingRef.current=p;
      rememberPendingDay(p);
      setSaveState('error');
    }
  }, [saveDailyDay,pendingDayStorageKey,locked]); // eslint-disable-line
  flushRef.current = flush;

  useEffect(()=>{
    if(!pendingDayStorageKey)return;
    try{
      const restored=JSON.parse(localStorage.getItem(pendingDayStorageKey)||'null');
      if(restored?.day&&restored?.record){
        pendingRef.current={day:String(restored.day).padStart(2,'0'),record:normalizeDay(restored.record)};
        setSelectedDay(pendingRef.current.day);
        setDay(pendingRef.current.record);
        setSaveState('pending');
        showAppToast('저장되지 않은 일일 입력을 복원했어요.',{tone:'info'});
      }
    }catch{clearPendingDay();}
  },[pendingDayStorageKey]); // eslint-disable-line

  useEffect(()=>{
    const syncConnection=()=>{const online=navigator.onLine;setIsOnline(online);if(online&&pendingRef.current)setTimeout(()=>flushRef.current(),0);};
    window.addEventListener('online',syncConnection);
    window.addEventListener('offline',syncConnection);
    return()=>{window.removeEventListener('online',syncConnection);window.removeEventListener('offline',syncConnection);};
  },[]);

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
    const normalized=normalizeDay(next);
    const record=dayHasPerformanceData(normalized)?{...normalized,inputConfirmed:false,inputConfirmedAt:null}:normalized;
    setDay(record);
    pendingRef.current = { day: selectedDay, record };
    rememberPendingDay(pendingRef.current);
    setSaveState('pending');
  };
  const setZeroConfirmed = (confirmed) => {
    if (locked || dayHasPerformanceData(day)) return;
    mutate({
      ...normalizeDay(day),
      dayOff:false,
      inputConfirmed:confirmed,
      inputConfirmedAt:confirmed ? new Date().toISOString() : null,
    });
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
    if(locked)return;
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
      if(isSeptemberPolicyActive(month)){
        setSpecialPolicies(SEPTEMBER_SPECIAL_SALES.filter(p=>(!p.startDate||p.startDate<=saleDate)&&(!p.endDate||p.endDate>=saleDate)).map(p=>({
          id:p.key,title:`${p.model} · ${p.saleType}`,replacement_amount:p.additionalAmount,
          policy_type:p.policyType||'additive',start_date:p.startDate||'2026-09-01',end_date:p.endDate||'2099-12-31',...p,
        })));
      }else{
        const {data:sp}=await supabase.from('special_sale_policies').select('*').eq('active',true).lte('start_date',saleDate).gte('end_date',saleDate).order('start_date');
        setSpecialPolicies(sp||[]);
      }
    })();
  }, [Boolean(mobileSaleDraft), month, selectedDay, editingSale]);


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
        .select('id,user_id,customer_id,customer_name,product_type,network_type,sale_type,main_tv_plan,status,source_work_date,source_group,source_key,actual_install_date')
        .eq('user_id',currentEmp.id)
        .gte('source_work_date',`${month}-01`)
        .lt('source_work_date',monthTo)
    ]);
    if(!saleRes.error)setDaySales(saleRes.data||[]);
    if(!homeRes.error){
      setDayHomeOrders((homeRes.data||[]).filter(o=>String(o.source_work_date||'').slice(0,10)===saleDate));
      // 직원 입력 카드에서는 설치예정도 "이 건을 설치완료했을 때"의 예상 수수료를 보여줍니다.
      // 실제 급여/정산 계산은 기존대로 completed 주문만 반영하므로 지급액에는 영향을 주지 않습니다.
      const previewOrders=(homeRes.data||[]).map(o=>({...o,status:'completed'}));
      setHomePreviewPolicy(calculateHomePolicyEngine(previewOrders,config));
    }else{
      console.error('HOME PREVIEW LOAD ERROR',homeRes.error);
      setDayHomeOrders([]);
      setHomePreviewPolicy(null);
    }
    setDaySalesLoading(false);
  },[currentEmp?.id,month,selectedDay,config]);

  useEffect(()=>{loadDaySales()},[loadDaySales]);

  const deleteSale=async(sale,{skipConfirm=false}={})=>{
    if(locked)return;
    const name=sale.customers?.customer_name||'고객';
    const bundleText=sale.source_type==='home_order'?'이 고객의 같은 날 홈 판매 묶음을 삭제할까요?':'이 판매 건을 삭제할까요?';
    if(!skipConfirm&&!await showAppConfirm({title:'판매건을 삭제할까요?',message:`${name} · ${sale.metric_label}\n${bundleText}\n연결된 고객 약속과 영업비용도 함께 삭제됩니다.`,confirmLabel:'판매건 삭제',tone:'danger'}))return;
    const meta=sale.source_meta||{};

    if(sale.source_type==='home_order'){
      const {data:result,error}=await supabase.rpc('delete_home_bundle_atomic',{p_user_id:currentEmp?.id,p_anchor_sale_id:sale.id});
      if(error)return showLegacyAlert(`홈 판매 삭제 실패: ${friendlyError(error)}`);
      if(!result||Number(result.sale_count)<1)return showLegacyAlert('삭제 결과를 확인하지 못했어요. 다시 확인해주세요.');
      await onHomeOrdersChanged?.();
      if(meta.teamOnly)await onTeamCreditSaved?.();
      await loadDaySales();
      return;
    }

    if (pendingRef.current || flushBusyRef.current || saveState === 'pending') {
      showAppToast('일일 입력 저장이 끝난 뒤 삭제해주세요.',{tone:'info'});return;
    }
    try {
      const free=bundleFreeAmounts(meta.bundle2ndKeys||[],meta.bundleVasMap||{},meta.bundleSaleTypeMap||{},true,meta.ci);
      const result=await deleteSaleAtomic(supabase,{userId:currentEmp?.id,sale,normalizeDay,free});
      if(result.daily_data){setDay(normalizeDay(result.daily_data));setSaveState('saved');}
      await onSalesChanged?.();
      if(meta.teamOnly)await onTeamCreditSaved?.();
      await loadDaySales();
      showAppToast('판매건과 연결된 실적·비용을 삭제했어요.');
      return true;
    }catch(error){showAppToast(friendlyError(error),{tone:'error',title:'판매 삭제 실패'});}

  };

  const openHomeOrder = (groupKey = null, itemKey = null) => {
    if (locked) return;
    setHomeOrderDraft({ unified:true, label:'홈 실적 입력' });
    setHomeCustomerName('');
    setHomeNetworkType('');
    setHomeInternet(false); setHomeInternetSpeed(''); setHomeMobileSimul('none'); setHomeMainTv(false); setHomeMainTvPlan(''); setHomeSubTv(false); setHomeSubTvType(''); setHomeSmartHome(false);
    setHomeDirectComplete(false);
    setHomeActualCompleteDate('');
    setHomePlannedDate('');
    setHomeCareKeys([]); setHomeCustomTitle(''); setHomeCustomDueDate(''); setHomeTargetPlan('');
    setHomeSpotPolicyId(''); setHomeSpotDirectOpen(false); setHomeSpotDirectTitle(''); setHomeSpotDirectAmount(''); setHomeSpotDirectMemo('');
    setHomeExpenseOpen(false); setHomeExpenseCategory('오퍼'); setHomeExpenseAmount(''); setHomeExpenseMemo('');
    setHomeExtraPromises([]); setHomeExtraExpenses([]); setEditingHomeSales([]);
  };

  const closeHomeOrder = async () => {
    if(homeOrderSaving)return;
    const hasInput=!!(homeOrderDraft?.editing||homeCustomerName.trim()||homeNetworkType||homeInternet||homeMainTv||homeSubTv||homeSmartHome||homeMobileSimul!=='none'||homePlannedDate||homeCustomTitle.trim()||homeExtraPromises.length||homeExpenseOpen);
    if(hasInput&&!await showAppConfirm({title:'홈 입력을 닫을까요?',message:'아직 등록하지 않은 작성 내용은 사라집니다.',confirmLabel:'작성 내용 버리기',tone:'warning'}))return;
    setHomeOrderDraft(null);setEditingHomeSales([]);setLegacyConversion(null);
    setHomeCustomerName('');setHomeNetworkType('');setHomeInternet(false);setHomeInternetSpeed('');setHomeMainTv(false);setHomeMainTvPlan('');setHomeSubTv(false);setHomeSubTvType('');setHomeSmartHome(false);setHomeMobileSimul('none');setHomeDirectComplete(false);setHomeActualCompleteDate('');setHomePlannedDate('');
  };

  const submitHomeOrder = async () => {
    if(pendingRef.current||flushBusyRef.current)return showAppToast('일일 입력 저장이 끝난 뒤 등록해주세요.',{tone:'info'});
    if (!homeOrderDraft || !currentEmp?.id || locked || homeSubmitGuardRef.current) return;
    const customer = homeCustomerName.trim();
    if (!customer) return showAppToast('고객명을 입력해야 등록할 수 있어요.',{tone:'error'});
    if(activeTeamSupport&&!teamSupportStore)return showAppToast('팀 실적을 반영할 매장을 선택해주세요.',{tone:'error'});
    if (!homeNetworkType) return showAppToast('가정망 또는 소호망을 선택해주세요.',{tone:'error'});
    if (!homeInternet && !homeMainTv && !homeSubTv && !homeSmartHome) return showAppToast('판매한 홈 상품을 하나 이상 선택해주세요.',{tone:'error'});
    if (homeMainTv && !homeInternet) return showAppToast('TV(주)는 인터넷 가입과 함께 선택해주세요.',{tone:'error'});
    if (homeMainTv && !homeMainTvPlan) return showAppToast('TV(주) 요금제 가입 기준을 선택해주세요.',{tone:'error'});
    if (homeInternet && !homeInternetSpeed) return showAppToast('인터넷 속도를 선택해주세요.',{tone:'error'});
    if (homeSubTv && !homeSubTvType) return showAppToast('TV(부) 종류를 선택해주세요.',{tone:'error'});
    if (homeMobileSimul==='usedMnp' && homeNetworkType!=='household') return showAppToast('중고 MNP 동시판매는 가정망에서만 적용할 수 있어요.',{tone:'error'});
    if (homeDirectComplete && !homeActualCompleteDate) return showAppToast('설치완료일을 입력해주세요.',{tone:'error'});

    const sourceWorkDate=`${month}-${selectedDay}`;
    // 실제 판매 구성을 기존 정산 그룹으로 자동 변환
    const products=[];
    if(homeInternet){
      if(homeMainTv){
        const mainTvPlanText=isSeptemberPolicyActive(month)?homeMainTvPlanLabel(homeMainTvPlan,homeNetworkType):'';
        products.push({groupKey:'homeBase',itemKey:'homeTv',productType:'homeTv',label:`TV(주)${mainTvPlanText?` · ${mainTvPlanText}`:''}`});
      }
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
      let replacedSaleIds=[];
      let replacedOrderIds=[];
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
          const {data:o,error:orderError}=await supabase.from('home_orders').select('*').eq('id',ref).maybeSingle();
          if(orderError)throw orderError;
          if(!o)throw new Error('HOME_ORDER_NOT_FOUND');
          if(o?.status==='completed' && o.source_group && o.source_key){
            groups[o.source_group]={...(groups[o.source_group]||{})};
            groups[o.source_group][o.source_key]=Math.max(0,Number(groups[o.source_group][o.source_key]||0)-1);
          }
        }
        workingDay={...base,groups};
        replacedSaleIds=editingHomeSales.map(x=>x.id);
        replacedOrderIds=editingHomeSales.map(x=>x.source_ref).filter(Boolean);
      }
      const createdSaleIds=products.map(()=>crypto.randomUUID());
      const primarySaleId=createdSaleIds[0];
      const orderRows=products.map((product,index)=>({
          user_id:currentEmp.id,customer_name:customer,customer_id:linkedCustomerId,
          product_type:product.productType,network_type:homeNetworkType,sale_type:'normal',
          status:homeDirectComplete?'completed':'pending',applied_at:appliedAt,
          completed_at:homeDirectComplete?new Date(`${homeActualCompleteDate}T12:00:00`).toISOString():null,source_work_date:sourceWorkDate,
          source_group:product.groupKey,source_key:product.itemKey,
          main_tv_plan:product.productType==='homeTv'?homeMainTvPlan:null,
          planned_install_date:homePlannedDate||null,actual_install_date:homeDirectComplete?homeActualCompleteDate:null,
          schema_version:CURRENT_SALE_SCHEMA_VERSION,
      }));
      const saleRows=products.map((product,index)=>({
          id:createdSaleIds[index],
          user_id:currentEmp.id,customer_id:linkedCustomerId,sale_date:sourceWorkDate,
          metric_label:product.label,source_type:'home_order',source_ref:null,
          schema_version:CURRENT_SALE_SCHEMA_VERSION,
          source_meta:withCurrentSaleSchema({
            networkType:homeNetworkType,saleType:'normal',internetSpeed:homeInternetSpeed||null,internetPlan:homeInternet&&september18HomeApplication(sourceWorkDate)?'premiumSafe':null,
            mainTvPlan:homeMainTv&&isSeptemberPolicyActive(month)?homeMainTvPlanLabel(homeMainTvPlan,homeNetworkType):null,
            mainTvPlanLevel:homeMainTv?homeMainTvPlan:null,
            mobileSimul:homeMobileSimul||'none',unifiedHome:true,directComplete:homeDirectComplete,
            simulBase:homeInternet?'home':(!homeInternet&&homeSmartHome?'smartHome':null),teamOnly:activeTeamSupport,creditedStore:activeTeamSupport?teamSupportStore:null
          })
      }));

      // 홈 약속은 모바일 템플릿 없이 직접 작성만 저장
      const homePromiseRows=[{title:homeCustomTitle,dueDate:homeCustomDueDate},...(homeExtraPromises||[])].filter(x=>String(x.title||'').trim()&&x.dueDate);
      const taskRows=homePromiseRows.map(x=>({
          user_id:currentEmp.id,customer_id:linkedCustomerId,source_sale_id:primarySaleId,task_type:'custom',title:String(x.title).trim(),base_date:sourceWorkDate,due_date:x.dueDate,status:'pending',task_meta:{}
      }));

      let spotClaimRow=null;
      if(homeSpotPolicyId){
        spotClaimRow={policy_id:homeSpotPolicyId,user_id:currentEmp.id,claim_date:sourceWorkDate,customer_name:customer,status:'pending',source_context:'home'};
      } else if(!isSeptemberPolicyActive(month)&&homeSpotDirectOpen&&homeSpotDirectTitle.trim()&&Number(homeSpotDirectAmount)>0){
        spotClaimRow={policy_id:null,user_id:currentEmp.id,claim_date:sourceWorkDate,customer_name:customer,status:'pending',direct_title:homeSpotDirectTitle.trim(),direct_amount:Number(homeSpotDirectAmount),direct_memo:homeSpotDirectMemo.trim()||null,source_context:'home'};
      }
      const expenseRows=homeExpenseOpen?[{category:homeExpenseCategory,amount:homeExpenseAmount,memo:homeExpenseMemo},...(homeExtraExpenses||[])].filter(x=>Number(x.amount)>0).map(x=>({user_id:currentEmp.id,source_sale_id:primarySaleId,expense_date:sourceWorkDate,amount:Number(x.amount),category:x.category||'기타',customer_name:customer,memo:String(x.memo||'').trim()||null})):[];

      if(!activeTeamSupport&&homeDirectComplete){
        const base=workingDay; const groups={...base.groups};
        products.forEach(product=>{ groups[product.groupKey]={...(groups[product.groupKey]||{}),[product.itemKey]:Number(groups[product.groupKey]?.[product.itemKey]||0)+1}; });
        workingDay={...base,groups};
      }
      const shouldSaveDaily=!activeTeamSupport&&(homeOrderDraft?.legacyConversion||homeOrderDraft?.editing||homeDirectComplete);
      const teamCreditRow=activeTeamSupport?{seller_id:authUser.id,credited_store:teamSupportStore,sale_date:sourceWorkDate,source_type:'home',source_sale_id:primarySaleId,source_refs:[],metrics:homeTeamCreditMetrics(products),is_completed:homeDirectComplete,note:`${loginEmp?.name||'담당'} 지원 판매`}:null;
      const {data:atomicResult,error:atomicError}=await supabase.rpc('save_home_bundle_atomic',{
        p_user_id:currentEmp.id,p_orders:orderRows,p_sales:saleRows,p_tasks:taskRows,p_expenses:expenseRows,
        p_spot_claim:spotClaimRow,p_team_credit:teamCreditRow,p_replace_sale_ids:replacedSaleIds,
        p_replace_order_ids:replacedOrderIds,p_daily_record:shouldSaveDaily?workingDay:null,p_work_date:shouldSaveDaily?sourceWorkDate:null
      });
      if(atomicError)throw atomicError;
      if(Number(atomicResult?.order_count)!==products.length||Number(atomicResult?.sale_count)!==products.length)throw new Error('홈 저장 결과를 확인하지 못했어요.');
      if(shouldSaveDaily){setDay(normalizeDay(workingDay));setSaveState('saved');}
      if(activeTeamSupport)await onTeamCreditSaved?.();

      notifyStoreManagers({actorId:currentEmp.id,type:homeDirectComplete?'home_completed':'home_order',title:homeDirectComplete?'홈 설치/개통 완료':'새 홈 청약 등록',message:`${customer} · ${homeNetworkLabel(homeNetworkType)} · ${products.map(p=>p.label).join(' + ')}`,storeName:activeTeamSupport?teamSupportStore:null,payload:{employee_id:currentEmp.id,customer_name:customer,store_name:activeTeamSupport?teamSupportStore:currentEmp.branch,team_only:activeTeamSupport,network_type:homeNetworkType,internet_speed:homeInternetSpeed||null,mobile_simul:homeMobileSimul||'none',status:homeDirectComplete?'completed':'pending',source_work_date:sourceWorkDate}});
      const resultId=`home-${Date.now()}`;
      setToast({id:resultId,source:'home',kind:'normal',customerName:customer,label:products.map(p=>p.label).join(' + '),title:activeTeamSupport?'지원 홈 판매 등록 완료':'홈 판매 등록 완료',sub:activeTeamSupport?`${displayStoreName(teamSupportStore)} 팀 실적 전용${homeDirectComplete?'으로 반영했어요':' · 설치완료 후 반영돼요'}`:(homeDirectComplete?'설치완료 실적으로 반영했어요':'설치대기로 등록했어요'),promiseCount:homePromiseRows.length,customerSaleId:primarySaleId,pointDelta:0,teamOnly:activeTeamSupport});
      if(activeTeamSupport)resetTeamSupportSelection();
      setTimeout(()=>setToast(t=>t?.id===resultId?null:t),10000);
      setHomeOrderDraft(null); setEditingHomeSales([]); setLegacyConversion(null); setHomeCustomerName(''); setHomeNetworkType(''); setHomeInternetSpeed(''); setHomeMobileSimul('none');
      await onHomeOrdersChanged?.();
      setTimeout(loadDaySales,150);
    }catch(e){ showAppToast(friendlyError(e),{tone:'error',title:'홈 상품 등록 실패'}); }
    finally{ homeSubmitGuardRef.current=false; setHomeOrderSaving(false); }
  };

  const submitExtraInput=async()=>{
    if(!extraInput||locked||mobileSubmitGuardRef.current)return;
    if(activeTeamSupport)return showAppToast('지원 판매는 모바일·홈 판매에서 등록해주세요.',{tone:'info'});
    if(pendingRef.current||flushBusyRef.current)return showAppToast('일일 입력 저장이 끝난 뒤 등록해주세요.',{tone:'info'});
    mobileSubmitGuardRef.current=true;setMobileSaleSaving(true);
    try{
      const saleDate=`${month}-${selectedDay}`;
      const {data,error}=await supabase.from('daily_records').select('data').eq('user_id',currentEmp.id).eq('work_date',saleDate).maybeSingle();
      if(error)throw error;
      const base=normalizeDay(data?.data),count=Math.max(1,Number(extraCount||1));
      let next={...base,inputConfirmed:false,inputConfirmedAt:null};
      if(extraInput==='sono')next={...next,groups:{...base.groups,sono:{...base.groups.sono,[extraSonoKey]:Number(base.groups.sono?.[extraSonoKey]||0)+count}}};
      else if(extraInput==='tailored')next={...next,tailoredCount:Number(base.tailoredCount||0)+count,tailoredAmount:Number(base.tailoredAmount||0)+Number(extraAmount||0)};
      else next={...next,custRegCount:Number(base.custRegCount||0)+count};
      if(extraCustomer.trim()){
        await saveSaleAtomic(supabase,{userId:currentEmp.id,saleId:crypto.randomUUID(),customerName:extraCustomer.trim(),saleDate,sourceType:'extra',metricLabel:extraInput==='sono'?(config.sono||DEFAULT_SONO).find(x=>x.key===extraSonoKey)?.label||'소노':extraInput==='tailored'?`맞춤제안 ${count}건 · ${won(Number(extraAmount||0))}`:`고객등록 ${count}건`,meta:withCurrentSaleSchema({extraType:extraInput,count,amount:Number(extraAmount||0),sonoKey:extraSonoKey}),expectedDay:data?.data??null,nextDay:next});
      }else if(!await saveDailyDay(selectedDay,next))throw new Error('일일 실적 저장에 실패했어요.');
      setDay(next);setSaveState('saved');await onSalesChanged?.();
      setExtraInput(null);setExtraCustomer('');setExtraCount('1');setExtraAmount('');await loadDaySales();
    }catch(error){showAppToast(friendlyError(error),{tone:'error',title:'실적 저장 실패'});}
    finally{mobileSubmitGuardRef.current=false;setMobileSaleSaving(false);}
  };

  const selectDay=async(key)=>{if(flushBusyRef.current||mobileSubmitGuardRef.current||homeSubmitGuardRef.current)return;await flush();if(!pendingRef.current)setSelectedDay(key);};

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

    if(customerMeta.prepareOnly)return {...nextDay,inputConfirmed:false,inputConfirmedAt:null};

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

    // The atomic RPC has already committed the ledger and daily totals.
    setDay(normalizeDay(customerMeta.savedDay||nextDay));

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
      strategicPointDelta:mobileStrategicPoint({strategicPlan:!!customerMeta.strategicPlan,vasKeys:customerMeta.vasKeys,bundleVasMap:customerMeta.bundleVasMap}),
      productivityDelta:Number(afterPay.kpiScore||0)-Number(beforePay.kpiScore||0),
      currentTotal: afterPay.currentPerformanceAmount,
      customerName:customerMeta.customerName||'',
      promiseCount:Number(customerMeta.promiseCount||0),
      customerSaleId: customerMeta.saleId || null,
      vasKeys: Array.isArray(customerMeta.vasKeys) ? customerMeta.vasKeys : [],
      specialMatrixOffset:Number(customerMeta.specialMatrixOffset||0),specialVasOffset:Number(customerMeta.specialVasOffset||0),specialReplacementPay:Number(customerMeta.specialReplacementPay||0),
      bundleFreeOffset:Number(customerMeta.bundleFreeOffset||0),bundleFreeVasOffset:Number(customerMeta.bundleFreeVasOffset||0),
      bundle2ndKeys:Array.isArray(customerMeta.bundle2ndKeys)?customerMeta.bundle2ndKeys:[],
      usedMnpBundle:!!customerMeta.usedMnpBundle,
      calculationLines:Array.isArray(customerMeta.calculationLines)?customerMeta.calculationLines:[],
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
      bundleVasCommissionExcluded:!!meta.bundleVasCommissionExcluded,
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
    const representedOrderRefs=new Set();
    (daySales||[]).filter(x=>x.source_type==='home_order').forEach(sale=>{
      if(sale.source_ref)representedOrderRefs.add(String(sale.source_ref));
      const pt=inferHomeProductTypeFromLabel(sale.metric_label);
      if(pt==='homeOnly')addRep('homeBase','homeOnly');
      else if(pt==='homeTv')addRep('homeBase','homeTv');
      else if(pt==='tvFree')addRep('homeFlat','tvFree');
      else if(pt==='smartHome')addRep('homeFlat','smartHome');
      else if(pt==='internet100')addRep('homeFlat','home100Only');
      else if(pt==='internet500')addRep('homeFlat','home500Only');
      else if(pt==='internet1g')addRep('homeFlat','home1GBOnly');
    });
    // 구버전에는 home_orders만 있고 customer_sales가 없는 건이 있습니다.
    // 완료/진행/취소 여부와 관계없이 이미 존재하는 원본 주문이면 legacy 잔여분으로 다시 만들지 않습니다.
    (dayHomeOrders||[]).filter(o=>!representedOrderRefs.has(String(o.id))).forEach(o=>{
      if(o.source_group&&o.source_key){addRep(o.source_group,o.source_key);return;}
      const pt=o.product_type;
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
  },[legacyMobileMatrix,day,daySales,dayHomeOrders]);

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
    if(sale.source_meta?.teamOnly)return showAppToast('지원 판매는 반영 매장 오류를 막기 위해 삭제 후 다시 등록해주세요.',{tone:'info'});
    if(sale.source_type==='home_order'){
      const saleDate=sale.sale_date;
      const {data:homeSales,error:hsErr}=await supabase.from('customer_sales')
        .select('id,customer_id,sale_date,metric_label,source_type,source_ref,source_meta,schema_version,customers(customer_name)')
        .eq('user_id',currentEmp?.id).eq('sale_date',saleDate).eq('customer_id',sale.customer_id).eq('source_type','home_order');
      if(hsErr)return showLegacyAlert(`홈 판매정보 조회 실패: ${friendlyError(hsErr)}`);
      const refs=(homeSales||[]).map(x=>x.source_ref).filter(Boolean);
      let orders=[];
      if(refs.length){ const {data:o,error:oErr}=await supabase.from('home_orders').select('*').in('id',refs); if(oErr)return showLegacyAlert(`홈 주문 조회 실패: ${friendlyError(oErr)}`); orders=o||[]; }
      let bundleChildren;
      try { bundleChildren=await loadHomeBundleChildren(supabase,currentEmp?.id,homeSales); }
      catch(error) { return showLegacyAlert(`홈 약속·비용 조회 실패: ${friendlyError(error)}`); }
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
      const storedMainTvPlan=compatOrders.find(o=>o.product_type==='homeTv')?.main_tv_plan||meta0.mainTvPlanLevel||'';
      setHomeMainTvPlan(storedMainTvPlan||(compatOrders.some(o=>o.product_type==='homeTv')?(compatOrders[0]?.network_type==='soho'?'premium':'broadcastPass'):''));
      setHomeSubTv(compatOrders.some(o=>['subSetTop','tvFree'].includes(o.product_type)));
      setHomeSubTvType(compatOrders.some(o=>o.product_type==='tvFree')?'free':'normal');
      setHomeSmartHome(compatOrders.some(o=>o.product_type==='smartHome'));
      setHomeDirectComplete(compatOrders.length>0 && compatOrders.every(o=>o.status==='completed'));
      setHomeActualCompleteDate(compatOrders.find(o=>o.actual_install_date)?.actual_install_date?.slice?.(0,10)||'');
      setHomePlannedDate(compatOrders.find(o=>o.planned_install_date)?.planned_install_date?.slice?.(0,10)||'');
      {
        const {tasks,expenses}=bundleChildren;
        const customs=(tasks||[]).filter(t=>t.task_type==='custom');
        setHomeCustomTitle(customs[0]?.title||''); setHomeCustomDueDate(customs[0]?.due_date||'');
        setHomeExtraPromises(customs.slice(1).map(t=>({title:t.title||'',dueDate:t.due_date||''})));
        const ex=expenses||[]; setHomeExpenseOpen(ex.length>0); setHomeExpenseCategory(ex[0]?.category||'오퍼'); setHomeExpenseAmount(ex[0]?.amount?String(ex[0].amount):''); setHomeExpenseMemo(ex[0]?.memo||'');
        setHomeExtraExpenses(ex.slice(1).map(e=>({category:e.category||'기타',amount:String(e.amount||''),memo:e.memo||''})));
      }
      return;
    }
    const inferredLegacyMobile=inferMobileMeta(sale);
    if(sale.source_type!=='mobile' && !inferredLegacyMobile)return showLegacyAlert('이 판매유형은 아직 수정할 수 없어요.');
    const meta=inferredLegacyMobile;
    if(!meta)return showLegacyAlert('이전 버전 판매건이라 가입구분을 확인할 수 없어요.');

    let children;
    try { children=await readSaleChildren(supabase,currentEmp.id,sale.id); }
    catch(error){return showAppToast(friendlyError(error),{tone:'error',title:'약속·비용 조회 실패'});}
    setEditingSale({...sale,children});
    setMobileDetailsOpen(true);
    setMobileCalcOpen(false);
    const editableCi=isSeptemberPolicyActive(month)&&Number(meta.ci)===3?5:meta.ci;
    setMobileSaleDraft({ri:meta.ri,ci:editableCi,label:mobileLabelFor(meta.ri,editableCi)});
    setMobileCustomerName(sale.customers?.customer_name||'');
    const editableVasKeys=(Array.isArray(meta.vasKeys)?meta.vasKeys:[]).map(k=>isSeptemberPolicyActive(month)&&k==='vasVcolor'?'vasVcolorBundle':k);
    setMobileVasKeys([...new Set(editableVasKeys)]);
    setMobileMoreVasOpen(editableVasKeys.some(k=>additionalMainVas.some(v=>v.key===k)));
    setMobileBundle2ndKeys(meta.bundle2ndKeys);
    setMobileBundleVasMap(meta.bundleVasMap);
    setMobileBundleSaleTypeMap(meta.bundleSaleTypeMap);
    setMobileUsedMnpBundle(meta.usedMnpBundle);
    setMobileSaleKind(isIncentiveUnpaidSpecial(meta.specialPolicy)?'incentive_unpaid':meta.specialPolicy?.policyId ? 'special' : 'normal');
    setMobileSpecialPolicyId(meta.specialPolicy?.policyId||'');
    setMobileSpecialExceptionAmount(meta.specialPolicy?.exceptionRequestedAmount?String(meta.specialPolicy.exceptionRequestedAmount):'');
    setMobileSpotPolicyId('');
    setMobileSpotDirectOpen(false);
    setMobileExpenseOpen(false);

    const tasks=children.tasks;
    setMobileReminders(restoreReminders(sale.source_meta,tasks));
    const completed=(tasks||[]).filter(t=>t.status==='completed');
    setEditingCompletedTaskCount(completed.length);
    const editExpenses=children.expenses;
    const ex=editExpenses||[]; setMobileExpenseOpen(ex.length>0); setMobileExpenseCategory(ex[0]?.category||'케이스'); setMobileExpenseAmount(ex[0]?.amount?String(ex[0].amount):''); setMobileExpenseMemo(ex[0]?.memo||''); setMobileExtraExpenses(ex.slice(1).map(e=>({category:e.category||'기타',amount:String(e.amount||''),memo:e.memo||''})));
  };

  const addOne = (ri=null,ci=null) => {
    if(locked)return;
    setEditingSale(null);
    setEditingCompletedTaskCount(0);
    const label=Number.isInteger(ri)&&Number.isInteger(ci)?mobileLabelFor(ri,ci):'';
    setMobileSaleDraft({ri,ci,label});
    setMobileDetailsOpen(false);
    setMobileCalcOpen(false);
    setMobileMoreVasOpen(false);
    setMobileCustomerName('');
    setMobileReminders({plan:'keep',services:{}});
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
  };

  const bundleFreeAmounts = (bundleKeys=mobileBundle2ndKeys, vasMap=mobileBundleVasMap, saleTypeMap=mobileBundleSaleTypeMap, includeLegacyVasOffset=false, parentCi=mobileSaleDraft?.ci) => {
    const bundleTable=config.bundle2nd||DEFAULT_BUNDLE2ND;
    const vasTable=config.vas||DEFAULT_VAS;
    let bundleOffset=0, vasOffset=0;
    (bundleKeys||[]).forEach(k=>{
      const saleType=saleTypeMap?.[k]||'normal';
      const rate=Number(bundleTable.find(x=>x.key===k)?.rate||0);
      const noInsurance=(vasMap?.[k]||[]).includes('vasNone');
      const appleWithout115=k==='b_AppleWatch'&&Number(parentCi)!==0;
      if(isSeptemberPolicyActive(month)){
        bundleOffset+=calculateSeptemberBundleSale({rate,saleType,insuranceJoined:!noInsurance,parent115:!appleWithout115,isAppleWatch:k==='b_AppleWatch'}).offset;
      }else if(saleType==='free')bundleOffset+=rate;
      else return;
      if(includeLegacyVasOffset)(vasMap?.[k]||[]).filter(v=>v!=='vasNone').forEach(v=>{
        vasOffset += Number(vasTable.find(x=>x.key===v)?.rate||0);
      });
    });
    return {bundleOffset,vasOffset};
  };


  const submitMobileSale = async () => {
    if(locked||!mobileSaleDraft||!currentEmp?.id||mobileSubmitGuardRef.current)return;
    if(!mobileSaleKind)return showAppToast('판매 구분을 선택해주세요.',{tone:'error'});
    if(activeTeamSupport&&!teamSupportStore)return showAppToast('팀 실적을 반영할 매장을 선택해주세요.',{tone:'error'});
    if(!Number.isInteger(mobileSaleDraft.ri)||!Number.isInteger(mobileSaleDraft.ci))return showAppToast('가입구분과 요금제군을 선택해주세요.',{tone:'error'});
    const customer=mobileCustomerName.trim();
    if(!customer)return showAppToast('고객명을 입력해야 실적을 등록할 수 있어요.',{tone:'error'});
    if(mobileSaleKind==='special' && !mobileSpecialPolicyId){
      return showLegacyAlert(specialPolicies.length
        ? '특가&지인정책에 적용할 모델과 가입 구분을 선택해주세요.'
        : '현재 적용 가능한 특가&지인정책이 없어요.');
    }
    const saleDate=`${month}-${selectedDay}`;
    const selectedSpecial=specialPolicies.find(p=>p.id===mobileSpecialPolicyId);
    if(mobileSaleKind!=='normal'&&mobileSpecialPolicyId&&isSeptemberPolicyActive(month)){
      const outcome=calculateSeptemberSpecialSale({policyKey:mobileSpecialPolicyId,planGroup:septemberPlanGroup(mobileSaleDraft.ci),strategicPoints:mobileStrategicPoint({strategicPlan:!!mobileStrategicPlan,vasKeys:mobileVasKeys,bundleVasMap:mobileBundleVasMap}),saleDate,saleType:septemberMobileSaleType(mobileSaleDraft.ri)});
      if(!selectedSpecial||!outcome.dateEligible||!outcome.typeEligible)return showAppToast('선택한 정책의 개통일과 가입 구분을 확인해주세요.',{tone:'error'});
      if(mobileSaleKind==='incentive_unpaid'&&!outcome.eligible)return showAppToast('아이폰18 사전예약 특가는 115군 이상(청소년85 인정)·전략포인트 2P 이상이어야 해요.',{tone:'error'});
    }
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
    if(mobileSubmitGuardRef.current)return;
    mobileSubmitGuardRef.current=true;
    setMobileSaleSaving(true);

    try{
      if(pendingRef.current || flushBusyRef.current || saveState==='pending')throw new Error('일일 입력 저장이 끝난 뒤 다시 등록해주세요.');
      const {data:daily,error:dailyError}=await supabase.from('daily_records').select('data').eq('user_id',currentEmp.id).eq('work_date',saleDate).maybeSingle();
      if(dailyError)throw dailyError;
      const beforeDay=normalizeDay(daily?.data);
      let base=beforeDay;
      if(editingSale){
        const oldMeta=inferMobileMeta(editingSale);
        if(!oldMeta)throw new Error('기존 판매정보를 확인할 수 없습니다.');
        base=dayAfterSaleDeletion(base,{...editingSale,source_type:'mobile',source_meta:{...editingSale.source_meta,...oldMeta}},bundleFreeAmounts(oldMeta.bundle2ndKeys||[],oldMeta.bundleVasMap||{},oldMeta.bundleSaleTypeMap||{},true));
      }else if(legacyConversion?.kind==='mobile'){
        base=structuredClone(base);
        base.matrix[legacyConversion.ri][legacyConversion.ci]=Math.max(0,Number(base.matrix[legacyConversion.ri][legacyConversion.ci]||0)-1);
      }
      const unpaid=mobileSaleKind==='incentive_unpaid';
      const policy=specialPolicies.find(p=>p.id===mobileSpecialPolicyId);
      const oldSp=editingSale?.source_meta?.specialPolicy||{};
      const strategicPoints=mobileStrategicPoint({strategicPlan:!!mobileStrategicPlan,vasKeys:mobileVasKeys,bundleVasMap:mobileBundleVasMap});
      const outcome=mobileSaleKind!=='normal'&&mobileSpecialPolicyId&&isSeptemberPolicyActive(month)
        ?calculateSeptemberSpecialSale({policyKey:mobileSpecialPolicyId,planGroup:septemberPlanGroup(mobileSaleDraft.ci),strategicPoints,saleDate,saleType:septemberMobileSaleType(mobileSaleDraft.ri)})
        :{eligible:true,additionalAmount:Number(policy?.replacement_amount??oldSp.replacementAmount??0)};
      const specialPolicy=mobileSaleKind==='normal'?null:{policyId:mobileSpecialPolicyId||null,policyTitle:policy?.title||oldSp.policyTitle||(unpaid?'인센미지급 특가':''),customerDiscount:unpaid?Number(policy?.customerDiscount||0):0,preorder:unpaid&&!!policy?.customerDiscount,policyType:unpaid?'incentive_unpaid':'additive',replacementAmount:unpaid?0:Number(outcome.additionalAmount||0),normalMatrixFee:unpaid?Number(config.matrix?.[mobileSaleDraft.ri]?.[mobileSaleDraft.ci]||0):0,normalVasFee:unpaid?mobileVasKeys.filter(k=>k!=='vasNone').reduce((sum,k)=>sum+Number((config.vas||[]).find(v=>v.key===k)?.rate||0),0):0,eligible:!!outcome.eligible,strategicPoints,policyVersion:policy?.policyVersion||SEPTEMBER_POLICY_VERSION};
      const meta=withCurrentSaleSchema(mergeSaleMetaPreservingLegacy(editingSale?.source_meta||{},{
        ...(editingSale?{legacySchemaVersion:saleSchemaVersion(editingSale)}:{}),
        reminders:mobileReminders,ri:mobileSaleDraft.ri,ci:mobileSaleDraft.ci,policySnapshot:editingSale?.source_meta?.policySnapshot||currentPolicySnapshot(config),strategicPlan:!!mobileStrategicPlan,vasKeys:mobileVasKeys,bundle2ndKeys:mobileBundle2ndKeys,bundleVasMap:mobileBundleVasMap,bundleSaleTypeMap:mobileBundleSaleTypeMap,bundleVasCommissionExcluded:true,usedMnpBundle:Number(mobileSaleDraft.ri)===5&&Number(mobileSaleDraft.ci)<=3?mobileUsedMnpBundle:false,teamOnly:activeTeamSupport,creditedStore:activeTeamSupport?teamSupportStore:null,specialPolicy
      }));
      const saleId=editingSale?.id||crypto.randomUUID();
      const tasks=buildReminderTasks({saleDate,reminders:mobileReminders,services:reminderServices(mobileVasKeys,config.vas||DEFAULT_VAS),previous:editingSale?.children?.tasks||[]});
      const expenses=mobileExpenseOpen?[{category:mobileExpenseCategory,amount:mobileExpenseAmount,memo:mobileExpenseMemo},...mobileExtraExpenses].filter(x=>Number(x.amount)>0).map(x=>({expense_date:saleDate,amount:Number(x.amount),category:x.category||'기타',customer_name:customer,memo:String(x.memo||'').trim()||null})):[];
      const free=bundleFreeAmounts();
      const feedbackMeta={saleId,customerName:customer,promiseCount:tasks.length,strategicPlan:!!mobileStrategicPlan,vasKeys:[...mobileVasKeys],bundleVasMap:mobileBundleVasMap,bundle2ndKeys:mobileBundle2ndKeys,usedMnpBundle:meta.usedMnpBundle,calculationLines:mobilePreview?.calculationLines||[],specialMatrixOffset:specialPolicy?.normalMatrixFee||0,specialVasOffset:specialPolicy?.normalVasFee||0,specialReplacementPay:specialPolicy?.replacementAmount||0,bundleFreeOffset:free.bundleOffset||0,bundleFreeVasOffset:free.vasOffset||0,baseDayOverride:base};
      const next=activeTeamSupport?null:commitMobileOne(mobileSaleDraft.ri,mobileSaleDraft.ci,{...feedbackMeta,prepareOnly:true});
      const spot=editingSale?null:mobileSpotPolicyId?{policy_id:mobileSpotPolicyId}:!isSeptemberPolicyActive(month)&&mobileSpotDirectOpen&&mobileSpotDirectTitle.trim()&&Number(mobileSpotDirectAmount)>0?{direct_title:mobileSpotDirectTitle.trim(),direct_amount:Number(mobileSpotDirectAmount),direct_memo:mobileSpotDirectMemo.trim()||null}:null;
      const credit=activeTeamSupport?{credited_store:teamSupportStore,metrics:mobileTeamCreditMetrics({ri:meta.ri,ci:meta.ci,...feedbackMeta}),note:`${loginEmp?.name||'담당'} 지원 판매`}:null;
      const result=await saveSaleAtomic(supabase,{userId:currentEmp.id,saleId,customerName:customer,saleDate,sourceType:editingSale?.source_type||'mobile',metricLabel:mobileSaleDraft.label,meta,tasks,expenses,spot,credit,expectedDay:daily?.data??null,nextDay:next,editingSale});
      if(result.daily_data)setDay(normalizeDay(result.daily_data));
      setSaveState('saved');
      if(editingSale){showAppToast('판매건과 고객 약속을 수정했어요.');}
      else if(activeTeamSupport){
        notifyStoreManagers({actorId:authUser.id,storeName:teamSupportStore,type:'daily_input',title:`${loginEmp?.name||'담당'}님이 지원 판매를 등록했어요`,message:`${customer} · ${mobileSaleDraft.label}`,payload:{employee_id:authUser.id,employee_name:loginEmp?.name,store_name:teamSupportStore,team_only:true,month,day:selectedDay,label:mobileSaleDraft.label}});
        const toastId=`team-mobile-${Date.now()}`;
        setToast({id:toastId,source:'mobile',kind:'normal',title:'지원 판매 등록 완료',sub:`${displayStoreName(teamSupportStore)} 팀 실적에만 반영했어요`,label:mobileSaleDraft.label,customerName:customer,promiseCount:tasks.length,customerSaleId:saleId,payDelta:0,salePayDelta:0,activityPayDelta:0,bonusPayDelta:0,pointDelta:0,strategicPointDelta:0,productivityDelta:0,teamOnly:true});
        resetTeamSupportSelection();
        setTimeout(()=>setToast(value=>value?.id===toastId?null:value),10000);
      }else if(!legacyConversion){commitMobileOne(meta.ri,meta.ci,{...feedbackMeta,savedDay:result.daily_data});}
      else showAppToast('이전 실적을 고객별 판매 내역으로 전환했어요.');
      setEditingSale(null);setEditingCompletedTaskCount(0);
      await onSalesChanged?.();
      if(activeTeamSupport)await onTeamCreditSaved?.();

      rememberMobileCombo();

      setMobileSaleDraft(null);
      setLegacyConversion(null);
      setMobileSaleKind('');
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
    if(!toast?.customerSaleId || locked)return;
    const {data,error}=await supabase.from('customer_sales').select('id,sale_date,source_type,source_meta,metric_label,customers(customer_name)').eq('id',toast.customerSaleId).eq('user_id',currentEmp.id).maybeSingle();
    if(error||!data)return showAppToast(friendlyError(error||new Error('SALE_NOT_FOUND')),{tone:'error'});
    if(await deleteSale(data,{skipConfirm:true}))setToast(null);
  };

  const undoHomeToast = async () => {
    if(!toast?.customerSaleId)return;
    const {data,error}=await supabase.from('customer_sales')
      .select('id,customer_id,sale_date,metric_label,source_type,source_ref,source_meta,customers(customer_name)')
      .eq('id',toast.customerSaleId).eq('user_id',currentEmp?.id).maybeSingle();
    if(error||!data)return showAppToast('방금 등록한 홈 판매를 찾지 못했어요. 판매 내역에서 확인해주세요.',{tone:'error'});
    if(!await showAppConfirm({title:'방금 등록한 홈 판매를 취소할까요?',message:`${data.customers?.customer_name||'고객'} · 같은 날 등록한 홈 상품 묶음과 연결된 약속·비용이 함께 삭제됩니다.`,confirmLabel:'등록 취소',tone:'danger'}))return;
    await deleteSale(data,{skipConfirm:true});
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
      if(meta.usedMnpBundle){const it=(config.mnpBundle||[]).find(v=>v.key==='usedMnpBundle');if(Number(it?.rate||0))rows.push(['중고MNP 결합',Number(it.rate)]);}
      const sp=meta.specialPolicy||{};
      if(sp.policyId||sp.policyType){
        const unpaid=isIncentiveUnpaidSpecial(sp),prefix=unpaid?'인센미지급 특가':'특가&지인정책';
        if(unpaid&&plan)rows.push([`${prefix} 요금제 제외`,-plan]);
        if(unpaid&&Number(sp.normalVasFee||0))rows.push([`${prefix} VAS·보험 제외`,-Number(sp.normalVasFee)]);
        const repl=Number(sp.exceptionStatus==='approved'?sp.exceptionApprovedAmount:sp.replacementAmount||0);
        if(repl)rows.push(['모델별 추가 인센티브',repl]);
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
    if(!mobileSaleDraft||!mobileSaleKind||!Number.isInteger(mobileSaleDraft.ri)||!Number.isInteger(mobileSaleDraft.ci))return null;
    const saleDate=`${month}-${selectedDay}`;
    const base=normalizeDay(day),nextMatrix=base.matrix.map(r=>[...r]);
    nextMatrix[mobileSaleDraft.ri][mobileSaleDraft.ci]=Number(nextMatrix[mobileSaleDraft.ri][mobileSaleDraft.ci]||0)+1;
    const nextVas={...(base.groups?.vas||{})};
    (mobileVasKeys||[]).forEach(k=>{if(k!=='vasNone')nextVas[k]=Number(nextVas[k]||0)+1});
    const nextBundle={...(base.groups?.bundle2nd||{})};mobileBundle2ndKeys.forEach(k=>nextBundle[k]=Number(nextBundle[k]||0)+1);
    const nextMnpBundle={...(base.groups?.mnpBundle||{})};if(Number(mobileSaleDraft.ri)===5&&Number(mobileSaleDraft.ci)<=3&&mobileUsedMnpBundle)nextMnpBundle.usedMnpBundle=Number(nextMnpBundle.usedMnpBundle||0)+1;
    const free=bundleFreeAmounts();
    const selectedPolicy=specialPolicies.find(p=>p.id===mobileSpecialPolicyId);
    const specialMatrix=mobileSaleKind==='incentive_unpaid'?Number(config.matrix?.[mobileSaleDraft.ri]?.[mobileSaleDraft.ci]||0):0;
    const specialVas=mobileSaleKind==='incentive_unpaid'?(mobileVasKeys||[]).filter(k=>k!=='vasNone').reduce((s,k)=>s+Number((config.vas||DEFAULT_VAS).find(v=>v.key===k)?.rate||0),0):0;
    const strategicPoints=mobileStrategicPoint({strategicPlan:!!mobileStrategicPlan,vasKeys:mobileVasKeys,bundleVasMap:mobileBundleVasMap});
    const specialOutcome=mobileSaleKind==='special'&&mobileSpecialPolicyId&&isSeptemberPolicyActive(month)?calculateSeptemberSpecialSale({policyKey:mobileSpecialPolicyId,planGroup:septemberPlanGroup(mobileSaleDraft.ci),strategicPoints,saleDate,saleType:septemberMobileSaleType(mobileSaleDraft.ri)}):null;
    const replacement=mobileSaleKind==='special'&&mobileSpecialPolicyId?Number(specialOutcome?.additionalAmount??selectedPolicy?.replacement_amount??0):0;
    const nextDay={...base,matrix:nextMatrix,groups:{...base.groups,vas:nextVas,bundle2nd:nextBundle,mnpBundle:nextMnpBundle},bundleFreeOffset:Number(base.bundleFreeOffset||0)+free.bundleOffset,bundleFreeVasOffset:Number(base.bundleFreeVasOffset||0)+free.vasOffset,specialMatrixOffset:Number(base.specialMatrixOffset||0)+specialMatrix,specialVasOffset:Number(base.specialVasOffset||0)+specialVas,specialReplacementPay:Number(base.specialReplacementPay||0)+replacement};
    const beforeDraft=applyDailyToDraft(draft,{...dailyDays,[selectedDay]:base},month,config.categoryMap,config.gibyeonColumnMap);
    const afterDraft=applyDailyToDraft(draft,{...dailyDays,[selectedDay]:nextDay},month,config.categoryMap,config.gibyeonColumnMap);
    const beforePay=computePay(beforeDraft,currentEmp?.position||'사원',currentEmp?.hireDate,month,config);
    const afterPay=computePay(afterDraft,currentEmp?.position||'사원',currentEmp?.hireDate,month,config);
    const vasLabels=(mobileVasKeys||[]).filter((k,i,a)=>k!=='vasNone'&&a.indexOf(k)===i).map(k=>(config.vas||DEFAULT_VAS).find(v=>v.key===k)?.label||k);
    const secondLabels=mobileBundle2ndKeys.map(k=>(config.bundle2nd||DEFAULT_BUNDLE2ND).find(v=>v.key===k)?.label?.replace('2ND · ','')||k);
    const promiseCount=buildReminderTasks({saleDate:`${month}-${selectedDay}`,reminders:mobileReminders,services:reminderServices(mobileVasKeys,config.vas||DEFAULT_VAS),previous:editingSale?.children?.tasks||[]}).length;
    const incentive=Math.max(0,Number(afterPay.currentPerformanceAmount||0)-Number(beforePay.currentPerformanceAmount||0));
    const points=Number(afterPay.totalPoints||0)-Number(beforePay.totalPoints||0);
    const productivity=Number(afterPay.kpiScore||0)-Number(beforePay.kpiScore||0);
    const calculationLines=[];
    const activityDelta=Number(afterPay.tenurePay||0)-Number(beforePay.tenurePay||0);
    const planDelta=Number(afterPay.matrixTotal||0)-Number(beforePay.matrixTotal||0);
    const appliedPlanDelta=Number(afterPay.mobilePlanPay||0)-Number(beforePay.mobilePlanPay||0);
    const vasDelta=Number(afterPay.rawVasPay||0)-Number(beforePay.rawVasPay||0);
    const secondDelta=Number(afterPay.rawBundle2ndTotal||0)-Number(beforePay.rawBundle2ndTotal||0);
    const appliedSecondDelta=Number(afterPay.bundle2ndPay||0)-Number(beforePay.bundle2ndPay||0);
    const strategicDelta=Number(afterPay.strategicAdjustment||0)-Number(beforePay.strategicAdjustment||0);
    if(activityDelta)calculationLines.push(['영업활동 지원금',activityDelta]);
    calculationLines.push([`요금제 · ${mobileSaleDraft.label}`,planDelta]);
    const eligiblePlanDelta=Number(afterPay.adjustedMatrixTotal||0)-Number(beforePay.adjustedMatrixTotal||0);
    const eligibleSecondDelta=Number(afterPay.bundle2ndTotal||0)-Number(beforePay.bundle2ndTotal||0);
    const homeAdjustment=(appliedPlanDelta-eligiblePlanDelta)+(appliedSecondDelta-eligibleSecondDelta);
    if(vasLabels.length)calculationLines.push([`VAS·보험 ${vasLabels.length}개`,vasDelta]);
    if(secondLabels.length)calculationLines.push([`2ND ${secondLabels.length}개 · ${secondLabels.join(', ')}`,secondDelta]);
    if(homeAdjustment)calculationLines.push(['홈 실적 기준 예상 조정',homeAdjustment]);
    if(strategicDelta)calculationLines.push(['전략포인트 비중 예상 조정',strategicDelta]);
    if(mobileUsedMnpBundle)calculationLines.push(['중고 MNP 결합',Number((config.mnpBundle||DEFAULT_MNP_BUNDLE).find(v=>v.key==='usedMnpBundle')?.rate||0)]);
    if(free.bundleOffset)calculationLines.push(['2ND 할인·조건 미충족 제외',-Number(free.bundleOffset||0)]);
    if(specialMatrix||specialVas)calculationLines.push(['인센미지급 특가 제외',-(specialMatrix+specialVas)]);
    if(replacement)calculationLines.push(['특가·지인 추가',replacement]);
    const explained=calculationLines.reduce((sum,[,amount])=>sum+Number(amount||0),0);
    const otherDelta=incentive-explained;
    if(otherDelta)calculationLines.push(['누적 구간·기타 예상 변동',otherDelta]);
    return {incentive,points,productivity,strategicPoints,calculationLines,vasLabels,secondLabels,promiseCount};
  })();

  return (
    <div className="space-y-3 relative">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-gray-700">{monthLabel(month)} 일일입력</div>
        <div className="flex items-center gap-2">
          <DailySaveBadge state={saveState} isOnline={isOnline} onRetry={()=>flushRef.current()} />
          <span className="text-xs text-gray-400">누적 {monthTotal}건</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-3">
        {policyInputBlocked&&<PolicyInputNotice month={month} />}
        <label className="flex items-center justify-between gap-3 pb-3 mb-3 border-b border-gray-100 cursor-pointer">
          <div>
            <div className="text-sm font-semibold text-gray-700">활동 시간 충족</div>
            <div className="text-[11px] text-gray-400 mt-0.5">미충족 시 영업 활동 지원금 {won(config.basePenalty)} 차감</div>
          </div>
          <div className={`shrink-0 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold ${draft.activityTimeMet ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
            <input
              type="checkbox"
              checked={draft.activityTimeMet}
              disabled={locked}
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
              <button key={d} data-testid={`sale-day-${key}`} onClick={() => selectDay(key)}
                className={`relative min-w-0 h-[58px] sm:h-[64px] rounded-lg text-xs font-medium flex flex-col items-center justify-start pt-2.5 overflow-hidden
                  ${isSel ? (off ? 'bg-emerald-600 text-white' : 'bg-brand-600 text-white') : off ? 'bg-emerald-50 text-emerald-700' : has ? 'bg-brand-50 text-brand-700' : dow === 0 ? 'bg-red-50/50 text-red-400' : dow === 6 ? 'bg-blue-50/50 text-blue-400' : 'bg-gray-50 text-gray-500'}`}>
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
                {!off && !hasCalSummary && has && !isSel && <span className="absolute bottom-1 w-1 h-1 rounded-full bg-brand-500" />}
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
        {!isDayOff&&<div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-gray-700">오늘 실적이 0건인가요?</div>
            <div className="text-[11px] text-gray-400 mt-0.5">0건도 확인해야 미입력이 아닌 정상 입력으로 집계돼요.</div>
          </div>
          <button
            type="button"
            onClick={()=>setZeroConfirmed(!day.inputConfirmed)}
            disabled={locked||dayHasPerformanceData(day)}
            className={`shrink-0 px-3 py-2 rounded-lg text-xs font-semibold border ${
              dayHasPerformanceData(day)?'bg-gray-100 text-gray-400 border-gray-100':day.inputConfirmed?'bg-brand-600 text-white border-brand-600':'bg-white text-brand-600 border-brand-200'
            } disabled:opacity-60`}
          >
            {dayHasPerformanceData(day)?'실적 입력됨':day.inputConfirmed?'0건 확인 ✓':'0건 확인'}
          </button>
        </div>}
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

                    const inc=meta.teamOnly?{total:0,rows:[]}:saleIncentiveBreakdown(sale); // 지원판매는 개인 인센티브 제외
                    return <div key={group.key} data-testid={`sale-bundle-${sale.customer_id}`} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-gray-900">{customerName}</div>
                          <div className="mt-1 space-y-0.5">
                            {labels.map((label,i)=><div key={i} className="text-xs text-gray-600">{label}</div>)}
                          </div>
                          {homeSales.some(legacySaleBadge)&&<span className="inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100">구버전 데이터 · 수정 가능</span>}
                          {meta.teamOnly&&<span className="inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-100">지원 판매 · {displayStoreName(meta.creditedStore)} 팀 실적</span>}
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="relative mb-2">
                            <button type="button" onClick={()=>setSaleIncentiveOpen(v=>v===group.key?null:group.key)}
                              className={`text-[12px] font-bold ${inc.total>0?'text-brand-700':'text-gray-400'}`}>
                              {inc.total>0?`+${won(inc.total)}`:'0원'}
                            </button>
                            <div className="text-[9px] text-gray-400">예상 인센티브</div>
                            {saleIncentiveOpen===group.key&&<div className="absolute right-0 top-10 z-30 w-56 bg-white border rounded-xl shadow-lg p-3 text-left">
                              <div className="text-[10px] font-bold text-gray-700 mb-1">이 판매건 예상 인센티브</div><div className="text-[9px] text-gray-400 mb-2">설치예정 홈은 현재 월 입력 기준으로 미리 계산하며, 실제 지급은 설치완료 후 반영돼요.</div>
                              {inc.rows.length?inc.rows.map(([l,v],i)=><div key={i} className="flex justify-between gap-2 text-[10px] py-1"><span className="text-gray-500">{l}</span><b className={v<0?'text-red-500':'text-brand-700'}>{v>0?'+':''}{won(v)}</b></div>):<div className="text-[10px] text-gray-400">직접 발생 수수료가 없어요.</div>}
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
                  const inc=meta.teamOnly?{total:0,rows:[]}:saleIncentiveBreakdown(sale);
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
                          {meta.teamOnly&&<div className="text-[10px] font-semibold text-brand-600 mt-1">지원 판매 · {displayStoreName(meta.creditedStore)} 팀 실적 전용</div>}
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="relative mb-2">
                            <button type="button" onClick={()=>setSaleIncentiveOpen(v=>v===group.key?null:group.key)}
                              className={`text-[12px] font-bold ${inc.total>0?'text-brand-700':'text-gray-400'}`}>
                              {inc.total>0?`+${won(inc.total)}`:'0원'}
                            </button>
                            <div className="text-[9px] text-gray-400">인센티브</div>
                            {saleIncentiveOpen===group.key&&<div className="absolute right-0 top-10 z-30 w-56 bg-white border rounded-xl shadow-lg p-3 text-left">
                              <div className="text-[10px] font-bold text-gray-700 mb-2">이 판매건 인센티브</div>
                              {inc.rows.length?inc.rows.map(([l,v],i)=><div key={i} className="flex justify-between gap-2 text-[10px] py-1"><span className="text-gray-500">{l}</span><b className={v<0?'text-red-500':'text-brand-700'}>{v>0?'+':''}{won(v)}</b></div>):<div className="text-[10px] text-gray-400">직접 발생 수수료가 없어요.</div>}
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
            {teamSupportEligible&&currentEmp?.id===authUser?.id&&<div className={`mb-3 rounded-xl border p-3 ${teamSupportMode?'border-brand-200 bg-brand-50':'border-gray-100 bg-gray-50'}`}>
              <label className="flex items-center justify-between gap-3"><div><div className="text-xs font-bold text-gray-800">지원 판매 · 팀 실적만 반영</div><div className="text-[10px] text-gray-500 mt-0.5">내 개인 실적·급여에서는 제외되며, 판매를 저장하면 선택이 초기화돼요.</div></div><input type="checkbox" checked={teamSupportMode} onChange={event=>{setTeamSupportMode(event.target.checked);setTeamSupportStore('')}} className="w-4 h-4"/></label>
              {teamSupportMode&&<select value={teamSupportStore} onChange={event=>setTeamSupportStore(event.target.value)} className="mt-3 w-full rounded-xl border border-brand-200 bg-white px-3 py-2.5 text-sm font-semibold text-brand-700"><option value="">실적을 반영할 매장 선택</option>{salesStores.map(store=><option key={store} value={store}>{displayStoreName(store)}</option>)}</select>}
            </div>}
            <div className="text-[11px] text-gray-400 mb-2">판매 카테고리</div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" disabled={locked} onClick={()=>{setInputCategory('mobile');setPickedRow(null);addOne();}}
                className={`p-4 rounded-2xl border text-left ${inputCategory==='mobile'?'bg-brand-50 border-brand-300':'bg-white border-gray-200'}`}>
                <div className="text-xl">📱</div><div className="text-sm font-bold text-gray-800 mt-1">모바일 실적 입력</div>
                <div className="text-[10px] text-gray-400 mt-1">고객명 · 가입구분 · 요금제 · VAS · 스팟 · 오퍼</div>
              </button>
              <button type="button" disabled={locked} onClick={()=>{setInputCategory('home');setPickedRow(null);openHomeOrder();}}
                className={`p-4 rounded-2xl border text-left ${inputCategory==='home'?'bg-brand-50 border-brand-300':'bg-white border-gray-200'}`}>
                <div className="text-xl">🏠</div><div className="text-sm font-bold text-gray-800 mt-1">홈 실적 입력</div>
                <div className="text-[10px] text-gray-400 mt-1">고객명 · 가정/소호 · 상품 · 스팟 · 오퍼</div>
              </button>
              <button type="button" disabled={locked||activeTeamSupport} onClick={()=>openHouseholdRenew(null)} className={`p-4 rounded-2xl border text-left bg-white border-gray-200 ${activeTeamSupport?'opacity-40':''}`}>
                <div><div className="text-xl">♻️</div><div className="text-sm font-bold text-gray-800 mt-1">인터넷 재약정</div></div>
                <div className="text-[10px] text-gray-400 mt-1">{activeTeamSupport?'지원 판매 대상 아님':'조건 선택 시 인센티브 자동 계산'}</div>
              </button>
              <button type="button" disabled={locked||activeTeamSupport} onClick={()=>setExtraInput('sono')} className={`p-4 rounded-2xl border text-left bg-white border-gray-200 ${activeTeamSupport?'opacity-40':''}`}><div className="text-xl">🎫</div><div className="text-sm font-bold text-gray-800 mt-1">소노</div><div className="text-[10px] text-gray-400 mt-1">{activeTeamSupport?'지원 판매 대상 아님':'상품 · 건수 · 고객(선택)'}</div></button>
              <button type="button" disabled={locked||activeTeamSupport} onClick={()=>setExtraInput('tailored')} className={`p-4 rounded-2xl border text-left bg-white border-gray-200 ${activeTeamSupport?'opacity-40':''}`}><div className="text-xl">💡</div><div className="text-sm font-bold text-gray-800 mt-1">맞춤제안</div><div className="text-[10px] text-gray-400 mt-1">{activeTeamSupport?'지원 판매 대상 아님':'업셀 건수 · 금액'}</div></button>
              <button type="button" onClick={()=>setStandalonePromiseOpen(true)} className="p-4 rounded-2xl border text-left bg-brand-50 border-brand-200"><div className="text-xl">📌</div><div className="text-sm font-bold text-brand-800 mt-1">고객 약속 등록</div><div className="text-[10px] text-brand-500 mt-1">기존·신규 고객 약속</div></button>
              <button type="button" disabled={locked} onClick={()=>setExtraInput('customerReg')} className="p-4 rounded-2xl border text-left bg-white border-gray-200 col-span-2"><div className="text-xl">👤</div><div className="text-sm font-bold text-gray-800 mt-1">고객등록</div><div className="text-[10px] text-gray-400 mt-1">타매고 등록 건수 빠른 입력</div></button>
            </div>


          </div>

      </>

      </>
      )}

      {extraInput&&(<div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"><div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl"><div className="text-lg font-bold">{extraInput==='sono'?'소노 입력':extraInput==='tailored'?'맞춤제안 입력':'고객등록 입력'}</div><input value={extraCustomer} onChange={e=>setExtraCustomer(e.target.value)} placeholder="고객명 (선택)" className="mt-4 w-full border rounded-xl px-3 py-3 text-sm"/>{extraInput==='sono'&&<select value={extraSonoKey} onChange={e=>setExtraSonoKey(e.target.value)} className="mt-2 w-full border rounded-xl px-3 py-3 text-sm">{(config.sono||DEFAULT_SONO).map(x=><option key={x.key} value={x.key}>{x.label}</option>)}</select>}<input inputMode="numeric" value={fmtInputNumber(extraCount)} onChange={e=>setExtraCount(e.target.value.replace(/\D/g,''))} placeholder="건수" className="mt-2 w-full border rounded-xl px-3 py-3 text-sm"/>{extraInput==='tailored'&&<input inputMode="numeric" value={fmtInputNumber(extraAmount)} onChange={e=>setExtraAmount(e.target.value.replace(/\D/g,''))} placeholder="업셀 금액" className="mt-2 w-full border rounded-xl px-3 py-3 text-sm"/>}<div className="grid grid-cols-2 gap-2 mt-4"><button onClick={()=>setExtraInput(null)} className="py-2.5 bg-gray-100 rounded-xl">취소</button><button onClick={submitExtraInput} className="py-2.5 bg-brand-600 text-white rounded-xl font-bold">등록</button></div></div></div>)}

      {standalonePromiseOpen&&<StandalonePromiseModal userId={currentEmp?.id} month={month} selectedDay={selectedDay} onClose={()=>setStandalonePromiseOpen(false)}/>}

      {householdRenewOpen&&(
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="text-xs text-brand-500 font-semibold">인터넷 재약정</div>
            <div className="text-lg font-bold text-gray-900 mt-1">{householdRenewEditIndex===null?'재약정 실적 입력':'재약정 실적 수정'}</div>
            <div className="text-xs text-gray-400 mt-1">재약정일 {month}-{selectedDay}</div>
            <label className="block text-xs font-semibold text-gray-600 mt-4 mb-1.5">고객명 (선택)</label>
            <input value={householdRenewForm.customer||''} onChange={e=>setHouseholdRenewForm({...householdRenewForm,customer:e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm" placeholder="고객명"/>
            <div className="text-xs font-semibold text-gray-600 mt-4 mb-2">인터넷 속도</div>
            <div className="grid grid-cols-3 gap-2">{[['1g','1GB'],['500','500MB'],['100','100MB']].map(([key,label])=><button key={key} type="button" onClick={()=>setHouseholdRenewForm({...householdRenewForm,speed:key})} className={`py-2.5 rounded-xl border text-xs font-bold ${householdRenewForm.speed===key?'bg-brand-50 border-brand-300 text-brand-700':'bg-white border-gray-200 text-gray-500'}`}>{label}</button>)}</div>
            <div className="text-xs font-semibold text-gray-600 mt-4 mb-2">재약정 상품</div>
            <div className="space-y-1.5">{(isSeptemberPolicyActive(month)?[{key:'premiumSafe',label:'프리미엄 안심 보상'},{key:'premium',label:'동일 또는 그 외 요금제'}]:HOUSEHOLD_RENEW_PLANS).map(p=><button key={p.key} type="button" onClick={()=>setHouseholdRenewForm({...householdRenewForm,plan:p.key})} className={`w-full py-2.5 px-3 rounded-xl border text-left text-xs font-semibold ${householdRenewForm.plan===p.key?'bg-brand-50 border-brand-300 text-brand-700':'bg-white border-gray-200 text-gray-600'}`}>{householdRenewForm.plan===p.key?'✓ ':''}{p.label}</button>)}</div>
            <div className="text-xs font-semibold text-gray-600 mt-4 mb-2">재약정 구성</div>
            <div className="grid grid-cols-2 gap-2"><button type="button" onClick={()=>setHouseholdRenewForm({...householdRenewForm,homeOnly:false})} className={`py-2.5 rounded-xl border text-xs font-bold ${!householdRenewForm.homeOnly?'bg-brand-50 border-brand-300 text-brand-700':'bg-white border-gray-200 text-gray-500'}`}>홈+TV 재약정</button><button type="button" onClick={()=>setHouseholdRenewForm({...householdRenewForm,homeOnly:true,tvUpsell:false})} className={`py-2.5 rounded-xl border text-xs font-bold ${householdRenewForm.homeOnly?'bg-brand-50 border-brand-300 text-brand-700':'bg-white border-gray-200 text-gray-500'}`}>홈만 재약정</button></div>
            {householdRenewForm.homeOnly&&!isSeptemberPolicyActive(month)&&<div className="text-[10px] text-amber-600 mt-1.5">홈 단독 재약정은 기본 재약정 수수료에서 최대 50,000원이 차감됩니다.</div>}
            <label className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-3 py-3"><div><div className="text-xs font-semibold text-gray-700">HS 동시판매</div><div className="text-[10px] text-gray-400">1GB +80,000원 · 500MB +50,000원</div></div><input type="checkbox" checked={!!householdRenewForm.hsSimul} onChange={e=>setHouseholdRenewForm({...householdRenewForm,hsSimul:e.target.checked})}/></label>
            <label className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-3 py-3"><div><div className="text-xs font-semibold text-gray-700">TV 업셀</div><div className="text-[10px] text-gray-400">조건 충족 시 +20,000원</div></div><input type="checkbox" checked={!!householdRenewForm.tvUpsell} onChange={e=>setHouseholdRenewForm({...householdRenewForm,tvUpsell:e.target.checked})}/></label>
            <div className="mt-4 rounded-xl bg-gray-50 border border-gray-100 p-3 space-y-2">{isSeptemberPolicyActive(month)&&<label className="flex items-center justify-between gap-3 text-xs text-gray-600"><span>속도 상향 재약정 (+30,000원)</span><input type="checkbox" checked={!!householdRenewForm.speedUp} onChange={e=>setHouseholdRenewForm({...householdRenewForm,speedUp:e.target.checked})}/></label>}<label className="flex items-center justify-between gap-3 text-xs text-gray-600"><span>기존 속도보다 낮춰 재약정</span><input type="checkbox" checked={!!householdRenewForm.downSpeed} onChange={e=>setHouseholdRenewForm({...householdRenewForm,downSpeed:e.target.checked})}/></label>{!isSeptemberPolicyActive(month)&&<label className="flex items-center justify-between gap-3 text-xs text-gray-600"><span>일시 상향 후 동일 조건 재약정</span><input type="checkbox" checked={!!householdRenewForm.temporaryUpgradeSame} onChange={e=>setHouseholdRenewForm({...householdRenewForm,temporaryUpgradeSame:e.target.checked})}/></label>}<div className="text-[10px] text-gray-400 leading-relaxed">{isSeptemberPolicyActive(month)?'인터넷 요금제 하향 재약정은 지급되지 않습니다.':'100MB 재약정, 속도 하향, 일시 상향 후 동일 요금제·동일 속도 재약정은 지급액 0원으로 계산합니다.'}</div></div>
            <div className="mt-4 rounded-2xl bg-brand-50 border border-brand-100 p-4"><div className="text-[10px] text-brand-500">자동 계산 지급액</div><div className="text-2xl font-bold text-brand-700 mt-0.5">{won(householdRenewPreview.amount)}</div><div className="text-[10px] text-brand-600 mt-1">생산성 KPI · 인터넷 0.3P{householdRenewForm.homeOnly?'':' + TV 0.3P'}</div>{!householdRenewPreview.invalid&&<div className="text-[10px] text-gray-500 mt-2 leading-relaxed">기본 {won(householdRenewPreview.base)}{householdRenewPreview.soloDiscount?` - 홈 단독 ${won(householdRenewPreview.soloDiscount)}`:''}{householdRenewPreview.hsPay?` + HS 동시 ${won(householdRenewPreview.hsPay)}`:''}{householdRenewPreview.tvPay?` + TV 업셀 ${won(householdRenewPreview.tvPay)}`:''}</div>}</div>
            {(day.householdRenewals||[]).length>0&&<div className="mt-4"><div className="text-xs font-bold text-gray-700 mb-2">{selectedDay}일 등록 내역</div><div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">{(day.householdRenewals||[]).map((item,idx)=>{const c=calculateHouseholdRenew(item,config);return <div key={item.id||idx} className="px-3 py-2.5 flex items-center justify-between gap-2"><div className="min-w-0"><div className="text-xs font-semibold text-gray-700 truncate">{item.customer||'이름 없음'} · {item.speed==='1g'?'1GB':item.speed==='500'?'500MB':'100MB'}</div><div className="text-[10px] text-gray-400 mt-0.5">{HOUSEHOLD_RENEW_PLANS.find(x=>x.key===item.plan)?.label||item.plan} · {won(c.amount)}</div></div><div className="flex gap-1"><button type="button" onClick={()=>openHouseholdRenew(idx)} className="px-2 py-1 rounded-lg bg-gray-50 text-[10px] font-semibold text-brand-600">수정</button><button type="button" onClick={()=>deleteHouseholdRenew(idx)} className="px-2 py-1 rounded-lg bg-red-50 text-[10px] font-semibold text-red-500">삭제</button></div></div>})}</div></div>}
            <div className="grid grid-cols-2 gap-2 mt-5"><button type="button" onClick={()=>{setHouseholdRenewOpen(false);setHouseholdRenewEditIndex(null);setHouseholdRenewForm(emptyHouseholdRenewForm())}} className="py-2.5 rounded-xl bg-gray-100 text-gray-500 text-sm font-semibold">취소</button><button type="button" onClick={saveHouseholdRenew} className="py-2.5 rounded-xl bg-brand-600 text-white text-sm font-bold">{householdRenewEditIndex===null?'등록':'수정 저장'}</button></div>
          </div>
        </div>
      )}

      {mobileSaleDraft && (
        <div role="dialog" aria-label="모바일 실적 입력" className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="text-xs text-brand-500 font-semibold">{editingSale?'판매건 수정':legacyConversion?.kind==='mobile'?'이전 판매건 복원':'한 번에 판매 등록'}</div>
            <div className="text-lg font-bold text-gray-900 mt-1">{legacyConversion?.kind==='mobile'?'모바일 실적 수정':'모바일 실적 입력'}</div>
            <div className="text-xs text-gray-400 mt-1">개통일 {month}-{selectedDay}</div>
            <div className="mt-3 grid grid-cols-3 gap-1.5 text-[10px] font-bold">
              <div className="rounded-lg bg-brand-600 text-white py-2 text-center">1 판매정보</div>
              <div className={`rounded-lg py-2 text-center ${mobileDetailsOpen?'bg-brand-100 text-brand-700':'bg-gray-100 text-gray-400'}`}>2 추가항목</div>
              <div className={`rounded-lg py-2 text-center ${mobileCustomerName.trim()?'bg-emerald-50 text-emerald-700':'bg-gray-100 text-gray-400'}`}>3 확인·등록</div>
            </div>
            {!editingSale&&recentMobileCombos.length>0&&<div className="mt-3 rounded-xl border border-brand-100 bg-brand-50/50 p-3">
              <div className="text-[10px] font-bold text-brand-700 mb-2">최근 판매 조합 빠른 선택</div>
              <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                {recentMobileCombos.map((combo,i)=><button key={`${combo.label}-${i}`} type="button" onClick={()=>applyRecentMobileCombo(combo)} className="shrink-0 rounded-lg bg-white border border-brand-100 px-3 py-2 text-left">
                  <div className="text-[11px] font-bold text-gray-700">{combo.label}</div>
                  <div className="text-[9px] text-gray-400 mt-0.5">VAS {(combo.vasKeys||[]).filter(k=>k!=='vasNone').length} · 2ND {(combo.bundle2ndKeys||[]).length}</div>
                </button>)}
              </div>
            </div>}
            {!editingSale&&<div className="mt-2 rounded-xl bg-blue-50 border border-blue-100 px-3 py-2 text-[10px] text-blue-700">항목을 선택하는 동안에는 저장되지 않아요. 맨 아래 <b>실적 등록</b>을 눌러야 판매건·고객정보·약속이 함께 등록됩니다.</div>}
            {legacyConversion?.kind==='mobile'&&<div className="mt-2 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2 text-[10px] text-amber-700">
              기존 데이터에서 확인된 값 · <b>{legacyConversion.title}{legacyConversion.detail?` · ${legacyConversion.detail}`:''}</b><br/>
              고객명·VAS·2ND 등 당시 저장되지 않은 값은 비워두었어요.
            </div>}

            <div className="mt-4">
              <div className="text-xs font-semibold text-gray-600 mb-2">1. 판매 구분 *</div>
              <div className="grid grid-cols-3 gap-2">
                <button type="button"
                  onClick={()=>{setMobileSaleKind('normal');setMobileSpecialPolicyId('');setMobileSpecialExceptionAmount('')}}
                  className={`py-3 rounded-xl border text-xs font-bold ${mobileSaleKind==='normal'?'bg-brand-50 border-brand-300 text-brand-700':'bg-white border-gray-200 text-gray-500'}`}>
                  {mobileSaleKind==='normal'?'✓ ':''}일반 판매
                </button>
                <button type="button"
                  onClick={()=>{setMobileSaleKind('special');setMobileSpecialPolicyId('');setMobileSpecialExceptionAmount('')}}
                  className={`py-3 rounded-xl border text-xs font-bold ${mobileSaleKind==='special'?'bg-amber-50 border-amber-300 text-amber-700':'bg-white border-gray-200 text-gray-500'}`}>
                  {mobileSaleKind==='special'?'✓ ':''}특가&지인정책
                </button>
                <button type="button"
                  onClick={()=>{setMobileSaleKind('incentive_unpaid');setMobileSpecialPolicyId('');setMobileSpecialExceptionAmount('')}}
                  className={`py-3 rounded-xl border text-[10px] font-bold ${mobileSaleKind==='incentive_unpaid'?'bg-red-50 border-red-300 text-red-700':'bg-white border-gray-200 text-gray-500'}`}>
                  {mobileSaleKind==='incentive_unpaid'?'✓ ':''}인센미지급 특가
                </button>
              </div>
              {mobileSaleKind==='incentive_unpaid'&&<div className="mt-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[10px] text-red-700">판매 실적·성과P·영업 활동 지원비 건수는 인정하고, 요금제·VAS·보험 인센티브만 지급하지 않아요.</div>}

              {mobileSaleKind==='incentive_unpaid'&&specialPolicies.some(p=>p.policy_type==='incentive_unpaid')&&<div className="mt-2 space-y-2 rounded-xl border border-red-100 p-3">
                <div className="text-xs font-bold text-gray-700">적용할 인센미지급 정책</div>
                <button type="button" onClick={()=>setMobileSpecialPolicyId('')} className={`w-full rounded-lg border p-2 text-left text-xs ${!mobileSpecialPolicyId?'border-red-300 bg-red-50':'border-gray-200'}`}>{!mobileSpecialPolicyId?'✓ ':''}일반 인센미지급 특가</button>
                {specialPolicies.filter(p=>p.policy_type==='incentive_unpaid').map(p=><button type="button" key={p.id} onClick={()=>setMobileSpecialPolicyId(p.id)} className={`w-full rounded-lg border p-2 text-left text-xs ${mobileSpecialPolicyId===p.id?'border-red-300 bg-red-50':'border-gray-200'}`}>
                  <div className="font-bold">{mobileSpecialPolicyId===p.id?'✓ ':''}{p.title}</div><div className="mt-1">고객 할인 {won(p.customerDiscount)} · 인센티브 미지급</div>
                </button>)}
                <div className="text-[10px] text-gray-600">아이폰18은 사전예약 후 9/18~9/21 개통 건에 적용해요. 115군 이상(청소년85 인정)·전략포인트 2P 이상. 선택 시 사전예약 판매로 기록됩니다.</div>
              </div>}

              {mobileSaleKind==='special'&&(
                <div className="mt-2 rounded-xl border border-amber-100 bg-amber-50/30 p-3">
                  <div className="text-[11px] font-semibold text-gray-700">적용 정책 *</div>
                  {specialPolicies.some(p=>p.policy_type!=='incentive_unpaid') ? (
                    <>
                      <div className="grid grid-cols-1 gap-1.5 mt-2">
                        {specialPolicies.filter(p=>p.policy_type!=='incentive_unpaid').map(p=>{
                          const selected=mobileSpecialPolicyId===p.id;
                          return <button key={p.id} type="button"
                            onClick={()=>{setMobileSpecialPolicyId(p.id);setMobileSpecialExceptionAmount('')}}
                            className={`w-full text-left rounded-lg border px-3 py-2.5 text-xs ${selected?'bg-white border-amber-300 text-amber-800':'bg-white/80 border-gray-100 text-gray-600'}`}>
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold">{selected?'✓ ':''}{p.title}</span>
                              <span className="text-[10px] text-amber-600">기존 정책 +{won(p.replacement_amount)}</span>
                            </div>
                            {(p.start_date||p.end_date)&&<div className="text-[9px] text-gray-400 mt-1">{p.start_date||''} ~ {p.end_date||''}</div>}
                          </button>
                        })}
                      </div>
                      {mobileSpecialPolicyId&&(
                        <div className="mt-2">
                          <div className="text-[10px] text-amber-700 leading-relaxed">
                            기존 요금제·VAS·보험 인센티브에 조건 충족 시 모델별 추가 인센티브를 더해요.
                          </div>
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
                <select aria-label="가입구분"
                  value={mobileSaleDraft.ri??''}
                  onChange={e=>{
                    const ri=Number(e.target.value);
                    const ci=MATRIX_ROW_DEFS[ri]?.hasTiers ? null : 0;
                    setMobileSaleDraft({ri,ci,label:ci===null?'':mobileLabelFor(ri,ci)});
                  }}
                  className="w-full border border-gray-200 rounded-xl px-2.5 py-2.5 text-xs bg-white"
                >
                  <option value="" disabled>선택해주세요</option>
                  {MATRIX_ROW_DEFS.map((r,ri)=><option key={r.label} value={ri}>{r.dailyLabel||r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">요금제군</label>
                {MATRIX_ROW_DEFS[mobileSaleDraft.ri]?.hasTiers ? (
                  <select aria-label="요금제군"
                    value={mobileSaleDraft.ci??''}
                    onChange={e=>{
                      const ci=Number(e.target.value),ri=mobileSaleDraft.ri;
                      setMobileSaleDraft({ri,ci,label:mobileLabelFor(ri,ci)});
                    }}
                    className="w-full border border-gray-200 rounded-xl px-2.5 py-2.5 text-xs bg-white"
                  >
                    <option value="" disabled>선택해주세요</option>
                    {activeMatrixOptions.map(({label,ci})=><option key={`${ci}-${label}`} value={ci}>{label}</option>)}
                  </select>
                ):(
                  <div className="w-full rounded-xl px-2.5 py-2.5 text-xs bg-gray-50 text-gray-400">{Number.isInteger(mobileSaleDraft.ri)?'해당 없음':'가입구분 먼저 선택'}</div>
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
                {[...primaryMainVas, { key:'vasNone', label:'미유치', rate:0 }].map((v) => {
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
                          ? 'bg-brand-50 border-brand-200 text-brand-700'
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
              {additionalMainVas.length>0&&<>
                <button type="button" onClick={()=>setMobileMoreVasOpen(v=>!v)} className="mt-2 w-full rounded-lg bg-gray-50 border border-gray-100 px-3 py-2 text-left text-[11px] font-semibold text-gray-600">
                  기타 전략 항목 {mobileMoreVasOpen?'접기':'펼치기'}
                  <span className="float-right">{mobileMoreVasOpen?'▲':'▼'}</span>
                </button>
                {mobileMoreVasOpen&&<div className="grid grid-cols-1 gap-1.5 mt-1.5">
                  {additionalMainVas.map(v=>{const selected=mobileVasKeys.includes(v.key);return <button key={v.key} type="button" onClick={()=>setMobileVasKeys(prev=>{const clean=prev.filter(k=>k!=='vasNone');return selected?clean.filter(k=>k!==v.key):[...clean,v.key]})}
                    className={`text-left px-3 py-2.5 rounded-xl border text-xs ${selected?'bg-brand-50 border-brand-200 text-brand-700':'bg-white border-gray-100 text-gray-600'}`}>
                    <span className="font-semibold">{selected?'✓ ':''}{v.label}</span>{v.rate>0&&<span className="float-right text-[10px] text-gray-400">+{won(v.rate)}</span>}
                  </button>})}
                </div>}
              </>}
              <div className="text-[10px] text-gray-400 mt-1.5">
                미유치는 기록용이며 인센티브에는 포함되지 않아요.
              </div>
            </div>

            <ReminderChoices value={mobileReminders} onChange={setMobileReminders} services={reminderServices(mobileVasKeys,config.vas||DEFAULT_VAS)}/>

            {Number(mobileSaleDraft.ri)===5 && Number(mobileSaleDraft.ci)<=3 && (
              <div className="mt-4">
                <div className="text-xs font-semibold text-gray-600 mb-2">4. 중고 MNP 결합 인센티브</div>
                <button type="button" onClick={()=>setMobileUsedMnpBundle(v=>!v)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl border text-xs ${mobileUsedMnpBundle?'bg-brand-50 border-brand-200 text-brand-700':'bg-white border-gray-100 text-gray-600'}`}>
                  <span className="font-semibold">{mobileUsedMnpBundle?'✓ ':''}중고 MNP 61군↑ 결합</span>
                  <span className="float-right text-[10px] text-brand-600 font-bold">+{won(Number((config.mnpBundle||DEFAULT_MNP_BUNDLE).find(v=>v.key==='usedMnpBundle')?.rate||100000))}</span>
                </button>
                <div className="text-[10px] text-gray-400 mt-1.5">SIM MNP(선약) · 61군 이상 · 개통 및 결합완료 건만 체크해주세요.</div>
              </div>
            )}

            <button type="button" onClick={()=>setMobileDetailsOpen(v=>!v)}
              className={`mt-4 w-full rounded-xl border px-3 py-3 text-left ${mobileDetailsOpen?'bg-brand-50 border-brand-200 text-brand-700':'bg-gray-50 border-gray-100 text-gray-700'}`}>
              <span className="text-xs font-bold">{mobileDetailsOpen?'추가 항목 접기':'2ND·고객약속·영업비용 추가'}</span>
              <span className="float-right text-xs">{mobileDetailsOpen?'▲':'▼'}</span>
              {!mobileDetailsOpen&&<div className="text-[10px] text-gray-400 mt-1">필요한 경우에만 열어 입력하세요.</div>}
            </button>

            {mobileDetailsOpen&&<>
            <div className="mt-4">
              <div className="text-xs font-semibold text-gray-600 mb-2">5. 2ND 판매 <span className="font-normal text-gray-400">· 최대 2개 선택</span></div>
              <input value={mobileBundleSearch} onChange={e=>setMobileBundleSearch(e.target.value)} placeholder="2ND 기기명 검색" className="w-full mb-2 border border-gray-200 rounded-xl px-3 py-2.5 text-xs"/>
              <div className="grid grid-cols-1 gap-1.5">
                {(config.bundle2nd || DEFAULT_BUNDLE2ND).filter(v=>!mobileBundleSearch.trim()||String(v.label||'').toLowerCase().includes(mobileBundleSearch.trim().toLowerCase())).map(v=>{
                  const selected=mobileBundle2ndKeys.includes(v.key);
                  const bundleVasKeys=mobileBundleVasMap[v.key]||[];
                  return <div key={v.key} className={`rounded-xl border ${selected?'bg-brand-50 border-brand-200':'bg-white border-gray-100'}`}>
                    <button type="button" onClick={()=>setMobileBundle2ndKeys(prev=>{
                      if(prev.includes(v.key)){
                        setMobileBundleVasMap(m=>{const n={...m};delete n[v.key];return n;});
                        setMobileBundleSaleTypeMap(m=>{const n={...m};delete n[v.key];return n;});
                        return prev.filter(k=>k!==v.key);
                      }
                      if(prev.length>=2){ showAppToast('2ND 판매는 최대 2개까지 선택할 수 있어요.',{tone:'info'}); return prev; }
                      setMobileBundleSaleTypeMap(m=>({...m,[v.key]:m[v.key]||'normal'}));
                      return [...prev,v.key];
                    })} className={`w-full text-left px-3 py-2.5 text-xs ${selected?'text-brand-700':'text-gray-600'}`}>
                      <span className="font-semibold">{selected?'✓ ':''}{v.label.replace('2ND · ','')}</span><span className="float-right text-[10px] text-gray-400">+{won(v.rate)}</span>
                    </button>
                    {selected&&<div className="px-3 pb-3">
                      <div className="mb-2">
                        <div className="text-[10px] font-semibold text-gray-500 mb-1.5">판매 구분</div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {(isSeptemberPolicyActive(month)?[['normal','일반판매'],['discount','할인판매']]:[['normal','일반판매'],['free','무료판매']]).map(([kind,label])=>{
                            const current=mobileBundleSaleTypeMap[v.key]||'normal';
                            return <button key={kind} type="button" onClick={()=>setMobileBundleSaleTypeMap(prev=>({...prev,[v.key]:kind}))}
                              className={`py-2 rounded-lg border text-[11px] font-semibold ${current===kind?(kind==='free'||kind==='discount'?'bg-amber-50 border-amber-300 text-amber-700':'bg-brand-50 border-brand-200 text-brand-700'):'bg-white border-gray-100 text-gray-500'}`}>
                              {current===kind?'✓ ':''}{label}
                            </button>
                          })}
                        </div>
                        {['free','discount'].includes(mobileBundleSaleTypeMap[v.key]||'normal')&&
                          <div className="mt-1.5 text-[10px] leading-relaxed text-amber-700 bg-amber-50 rounded-lg px-2.5 py-2">
                            {isSeptemberPolicyActive(month)?'할인판매는 보험 가입 조건 충족 시 20,000원을 지급해요.':'무료판매는 2ND 실적·KPI는 인정하지만 2ND 번들 및 이 회선의 VAS 인센티브는 지급되지 않아요.'}
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
                          })} className={`text-left px-2.5 py-2 rounded-lg border text-[11px] ${vasSelected?'bg-white border-brand-200 text-brand-700':'bg-white/80 border-gray-100 text-gray-600'}`}>
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
              {editingSale&&<button type="button" onClick={()=>setMobileExpenseOpen(v=>!v)} className={`py-2.5 rounded-xl border text-xs font-semibold ${mobileExpenseOpen?'bg-emerald-50 border-emerald-200 text-emerald-700':'bg-gray-50 border-gray-100 text-gray-600'}`}>+ 영업비용</button>}
{!editingSale&&(<>
              {!isSeptemberPolicyActive(month)&&<>
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
              </>}
              <button
                type="button"
                onClick={()=>setMobileExpenseOpen(v=>!v)}
                className={`py-2.5 rounded-xl border text-xs font-semibold ${mobileExpenseOpen?'bg-emerald-50 border-emerald-200 text-emerald-700':'bg-gray-50 border-gray-100 text-gray-600'}`}
              >
                + 영업비용
              </button>

</>)}            </div>

            <div className="mt-3 text-xs text-gray-500">중고폰·오퍼·제휴카드·케이스 약속은 저장 후 약속관리에서 등록해주세요.</div>

            {!editingSale&&!isSeptemberPolicyActive(month)&&<div id="mobile-spot-options" className="hidden mt-4 rounded-xl border border-orange-100 bg-orange-50/40 p-3">
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
            </>}

            {editingSale&&(
              <div className="mt-4 rounded-xl bg-brand-50 px-3 py-2.5 text-[11px] text-brand-700">
                가입구분·요금제군·VAS·고객 약속을 함께 수정해요.
                {editingCompletedTaskCount>0&&<div className="mt-1 font-semibold">이미 완료된 약속 {editingCompletedTaskCount}건은 그대로 유지됩니다.</div>}
                <div className="mt-1 text-brand-500">기존 스팟은 유지되고, 영업비용과 고객약속은 함께 수정할 수 있어요.</div>
              </div>
            )}

            <div className="sticky -bottom-5 mt-5 -mx-5 px-5 pt-3 pb-5 bg-white/95 backdrop-blur border-t border-gray-100 shadow-[0_-8px_20px_rgba(0,0,0,0.04)]">
              {mobilePreview&&<div className="mb-2.5 rounded-xl bg-brand-50 border border-brand-100 px-3 py-2.5">
                <div className="text-[10px] font-bold text-brand-700 truncate">{`${month}-${selectedDay}`} · {mobileCustomerName.trim()||'고객명 미입력'} · {mobileSaleDraft.label}{mobilePreview.secondLabels.length?` · 2ND ${mobilePreview.secondLabels.join(', ')}`:''}</div>
                <div className="text-[9px] text-brand-500 mt-1 truncate">{mobilePreview.vasLabels.length?`VAS ${mobilePreview.vasLabels.join(', ')}`:'VAS 미유치'}{mobilePreview.promiseCount?` · 고객약속 ${mobilePreview.promiseCount}건`:''}</div>
                {editingSale&&<div className="mt-1.5 rounded-lg bg-white/70 px-2 py-1.5 text-[10px] text-brand-700"><b>변경 전후</b> · {editingSale.metric_label||'기존 판매'} → {mobileSaleDraft.label}</div>}
                {!editingSale&&<>
                  <div className="mt-2 text-sm font-black text-emerald-700">이번 판매 총 +{won(mobilePreview.incentive)}</div>
                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    {[['성과P',mobilePreview.points],['생산성',mobilePreview.productivity],['전략P',mobilePreview.strategicPoints]].map(([label,value])=><div key={label} className="rounded-lg bg-white/80 px-2 py-1.5 text-center"><div className="text-[9px] text-brand-400">{label}</div><div className="text-[11px] font-bold text-brand-700">+{fmtNum(value,1)}P</div></div>)}
                  </div>
                  <button type="button" onClick={()=>setMobileCalcOpen(v=>!v)} className="mt-2 w-full text-[10px] font-bold text-brand-700">{mobileCalcOpen?'계산 근거 닫기 ▲':'금액 계산 근거 보기 ▼'}</button>
                  {mobileCalcOpen&&<div className="mt-2 rounded-lg bg-white/80 px-2.5 py-2 space-y-1">
                    {mobilePreview.calculationLines.map(([label,amount],i)=><div key={i} className="flex justify-between gap-2 text-[9px]"><span className="text-gray-500">{label}</span><b className={Number(amount)<0?'text-red-500':'text-brand-700'}>{amount===null?'선택 반영':`${Number(amount)>0?'+':''}${won(amount)}`}</b></div>)}
                    <div className="pt-1 border-t border-brand-100 text-[9px] leading-relaxed text-gray-400">홈 실적·전략포인트 비중은 월중 현재 상태로 계산한 예상치예요. 이후 정상 기준을 충족하면 이전 실적을 포함해 다시 계산되며, 정산 시 최종 반영액은 달라질 수 있습니다.</div>
                  </div>}
                </>}
              </div>}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={()=>{setMobileSaleDraft(null);setEditingSale(null);setEditingCompletedTaskCount(0)}} disabled={mobileSaleSaving}
                  className="py-2.5 rounded-xl bg-gray-100 text-gray-500 text-sm font-semibold">취소</button>
                <button onClick={submitMobileSale} disabled={mobileSaleSaving||!mobileCustomerName.trim()||!mobileSaleKind||!Number.isInteger(mobileSaleDraft.ri)||!Number.isInteger(mobileSaleDraft.ci)}
                  className="py-2.5 rounded-xl bg-brand-600 text-white text-sm font-bold disabled:opacity-50">
                  {mobileSaleSaving?(editingSale?'수정 중...':'판매건 등록 중...'):(editingSale?'수정 저장':'실적 등록')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {homeOrderDraft && (
        <div role="dialog" aria-label="홈 실적 입력" className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="text-xs text-brand-500 font-semibold">한 번에 홈 판매 등록</div>
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
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-200"
            />

            <label className="block text-xs font-semibold text-gray-500 mt-4 mb-1.5">
              2. 망 구분 <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {HOME_NETWORK_TYPES.map(n=>(
                <button key={n.key} type="button" onClick={()=>{setHomeNetworkType(n.key);setHomeMainTvPlan('')}}
                  className={`py-3 rounded-xl border text-sm font-bold ${
                    homeNetworkType===n.key
                      ? 'bg-brand-50 border-brand-300 text-brand-700'
                      : 'bg-white border-gray-200 text-gray-500'
                  }`}>
                  {homeNetworkType===n.key?'✓ ':''}{n.label}
                </button>
              ))}
            </div>
            <div className="text-[10px] text-gray-400 mt-1.5">
              가정망/소호망은 성과 및 관리자 평가의 가정망 비중 계산에도 사용돼요.
            </div>

            <div className="mt-4">
              <div className="text-xs font-semibold text-gray-600 mb-2">3. 판매 상품 <span className="font-normal text-gray-400">· 상품을 누른 뒤 바로 세부 선택</span></div>
              <div className="space-y-2">
                <div className={`rounded-xl border p-2.5 ${homeInternet?'border-brand-300 bg-brand-50/50':'border-gray-200 bg-white'}`}>
                  <button type="button" onClick={()=>{if(homeInternet){setHomeInternet(false);setHomeInternetSpeed('');setHomeMainTv(false);setHomeMainTvPlan('')}else setHomeInternet(true)}} className="w-full flex items-center justify-between text-sm font-bold"><span className={homeInternet?'text-brand-700':'text-gray-600'}>{homeInternet?'✓ ':''}인터넷</span>{homeInternetSpeed&&<span className="text-xs text-brand-600">{{100:'100MB',500:'500MB','1g':'1GB'}[homeInternetSpeed]}</span>}</button>
                  {homeInternet&&!homeInternetSpeed&&<div className="grid grid-cols-3 gap-2 mt-2">{[['100','100MB'],['500','500MB'],['1g','1GB']].map(([k,l])=><button key={k} type="button" onClick={()=>setHomeInternetSpeed(k)} className="py-2.5 rounded-lg border border-brand-200 bg-white text-xs font-bold text-brand-700">{l}</button>)}</div>}
                  {homeInternet&&september18HomeApplication(`${month}-${selectedDay}`)&&<div className="mt-2 text-[10px] leading-relaxed text-gray-500">9/18~9/21 청약·9월 설치 완료: 500MB 이상 + 방송패스(첫 달 유지). 소호는 프리미엄 이상 TV. 조건 충족 1~2건은 가정망 건당 10만원, 3건 이상은 전체 건당 15만원. 소호는 건수만 인정하며 MNP 동시판매 시 가정망 건당 10만원 추가.</div>}
                  {homeInternet&&homeInternetSpeed&&<button type="button" onClick={()=>setHomeInternetSpeed('')} className="mt-1 text-[10px] font-semibold text-gray-400">속도 변경</button>}
                </div>
                <div className={`rounded-xl border p-2.5 ${homeMainTv?'border-brand-300 bg-brand-50/50':'border-gray-200 bg-white'}`}>
                  <button type="button" onClick={()=>{if(!homeInternet)return showAppToast('TV(주)는 인터넷과 함께 선택해주세요.',{tone:'info'});if(homeMainTv){setHomeMainTv(false);setHomeMainTvPlan('')}else setHomeMainTv(true)}} className="w-full flex items-center justify-between text-sm font-bold"><span className={homeMainTv?'text-brand-700':'text-gray-600'}>{homeMainTv?'✓ ':''}TV(주)</span>{homeMainTvPlan&&<span className="text-xs text-brand-600">{homeMainTvPlanLabel(homeMainTvPlan,homeNetworkType)}</span>}</button>
                  {homeMainTv&&!homeMainTvPlan&&<div className={`grid ${homeNetworkType==='soho'?'grid-cols-2':'grid-cols-3'} gap-2 mt-2`}>{(homeNetworkType==='soho'?[['premium','프리미엄'],['belowPremium','프리미엄 미만']]:[['broadcastPass','방송패스'],['premium','프리미엄'],['belowPremium','프리미엄 미만']]).map(([k,l])=><button key={k} type="button" onClick={()=>setHomeMainTvPlan(k)} className="py-2.5 rounded-lg border border-brand-200 bg-white text-[11px] font-bold text-brand-700">{l}</button>)}</div>}
                  {homeMainTv&&homeMainTvPlan&&<button type="button" onClick={()=>setHomeMainTvPlan('')} className="mt-1 text-[10px] font-semibold text-gray-400">요금제 변경</button>}
                </div>
                <div className={`rounded-xl border p-2.5 ${homeSubTv?'border-brand-300 bg-brand-50/50':'border-gray-200 bg-white'}`}>
                  <button type="button" onClick={()=>{setHomeSubTv(v=>!v);if(homeSubTv)setHomeSubTvType('')}} className="w-full flex items-center justify-between text-sm font-bold"><span className={homeSubTv?'text-brand-700':'text-gray-600'}>{homeSubTv?'✓ ':''}TV(부)</span>{homeSubTv&&homeSubTvType&&<span className="text-xs text-brand-600">{homeSubTvType==='free'?'프리 부셋탑':'일반 부셋탑'}</span>}</button>
                  {homeSubTv&&!homeSubTvType&&<div className="grid grid-cols-2 gap-2 mt-2"><button type="button" onClick={()=>setHomeSubTvType('normal')} className="py-2.5 rounded-lg border border-brand-200 bg-white text-xs font-bold text-brand-700">일반 부셋탑</button><button type="button" onClick={()=>setHomeSubTvType('free')} className="py-2.5 rounded-lg border border-brand-200 bg-white text-xs font-bold text-brand-700">프리 부셋탑</button></div>}
                  {homeSubTv&&homeSubTvType&&<button type="button" onClick={()=>setHomeSubTvType('')} className="mt-1 text-[10px] font-semibold text-gray-400">종류 변경</button>}
                </div>
                <button type="button" onClick={()=>setHomeSmartHome(v=>!v)} className={`w-full rounded-xl border p-3 text-left text-sm font-bold ${homeSmartHome?'border-brand-300 bg-brand-50 text-brand-700':'border-gray-200 bg-white text-gray-600'}`}>{homeSmartHome?'✓ ':''}스마트홈</button>
              </div>
              <div className="text-[10px] text-gray-400 mt-2">TV(부)와 스마트홈은 인터넷 없이도 선택할 수 있어요.</div>
            </div>

            <div className="mt-4 rounded-xl border border-gray-100 p-3">
              <div className="text-xs font-semibold text-gray-700 mb-2">4. 모바일 동시판매 <span className="font-normal text-gray-400">· 해당 시 선택</span></div>
              <div className="grid grid-cols-1 gap-2">
                {[['none','없음'],['newChange','신규/기변 동시판매'],['mnp','MNP 동시판매'],['usedMnp','중고 MNP 동시판매']].map(([k,l])=><button key={k} type="button" onClick={()=>{if(k==='usedMnp'&&homeNetworkType!=='household')return showAppToast('중고 MNP 동시판매는 가정망에서만 적용할 수 있어요.',{tone:'info'});setHomeMobileSimul(k)}} className={`py-2.5 px-3 rounded-xl border text-left text-xs font-semibold ${homeMobileSimul===k?'bg-brand-50 border-brand-300 text-brand-700':'bg-white border-gray-200 text-gray-500'}`}>{homeMobileSimul===k?'✓ ':''}{l}</button>)}
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
              <input aria-label="홈 약속 예정일" type="date" value={homeCustomDueDate} onChange={e=>setHomeCustomDueDate(e.target.value)} className="mt-2 w-full border rounded-lg px-3 py-2.5 text-xs bg-white" />
              {homeExtraPromises.map((x,i)=><div key={i} className="mt-2 grid grid-cols-[1fr_auto] gap-2"><div><input value={x.title} onChange={e=>setHomeExtraPromises(a=>a.map((v,j)=>j===i?{...v,title:e.target.value}:v))} placeholder="추가 약속 내용" className="w-full border rounded-lg px-3 py-2 text-xs"/><input type="date" value={x.dueDate} onChange={e=>setHomeExtraPromises(a=>a.map((v,j)=>j===i?{...v,dueDate:e.target.value}:v))} className="mt-1 w-full border rounded-lg px-3 py-2 text-xs"/></div><button onClick={()=>setHomeExtraPromises(a=>a.filter((_,j)=>j!==i))} className="text-red-400 text-xs">삭제</button></div>)}
              <button type="button" onClick={()=>setHomeExtraPromises(a=>[...a,{title:'',dueDate:''}])} className="mt-2 text-xs font-semibold text-brand-600">+ 약속 추가</button>
            </div>

<div className="mt-4 grid grid-cols-2 gap-2">
              {!isSeptemberPolicyActive(month)&&<button type="button" onClick={()=>{const el=document.getElementById('home-spot-options');if(el)el.classList.toggle('hidden')}} className={`py-2.5 rounded-xl border text-xs font-semibold ${homeSpotPolicyId||homeSpotDirectOpen?'bg-orange-50 border-orange-200 text-orange-700':'bg-gray-50 border-gray-100 text-gray-600'}`}>+ 스팟 정책</button>}
              <button type="button" onClick={()=>setHomeExpenseOpen(v=>!v)} className={`py-2.5 rounded-xl border text-xs font-semibold ${homeExpenseOpen?'bg-emerald-50 border-emerald-200 text-emerald-700':'bg-gray-50 border-gray-100 text-gray-600'}`}>+ 오퍼/영업비용</button>
            </div>
            {!isSeptemberPolicyActive(month)&&<div id="home-spot-options" className="hidden mt-3 rounded-xl border border-orange-100 bg-orange-50/40 p-3">
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
              <input aria-label="설치완료일" type="date" value={homeActualCompleteDate} onChange={e=>setHomeActualCompleteDate(e.target.value)} className="w-full border border-emerald-200 rounded-xl px-3 py-2.5 text-sm bg-white" />
            </div>}

            <div className="text-[11px] text-gray-400 mt-2">
              체크하지 않으면 진행중으로 등록되고, 홈 진행관리에서 완료 처리할 수 있어요.
            </div>

            <div className="sticky -bottom-5 mt-5 -mx-5 px-5 pt-3 pb-5 bg-white/95 backdrop-blur border-t border-gray-100 shadow-[0_-8px_20px_rgba(0,0,0,0.04)]">
            <div className="mb-2.5 rounded-xl bg-brand-50 border border-brand-100 px-3 py-2.5"><div className="text-[10px] font-bold text-brand-700">{homeNetworkType?homeNetworkLabel(homeNetworkType):'망 미선택'} · {homeDirectComplete?'설치완료':'설치대기'}</div><div className="text-[9px] text-brand-500 mt-1">{[homeInternet&&(homeMainTv?`인터넷+TV(주)${isSeptemberPolicyActive(month)?` ${homeMainTvPlanLabel(homeMainTvPlan,homeNetworkType)}`:''}`:`인터넷 ${homeInternetSpeed?homeInternetSpeed.toUpperCase():''}`),homeSubTv&&(homeSubTvType==='free'?'TV프리(부)':'일반 부셋탑'),homeSmartHome&&'스마트홈',homeMobileSimul!=='none'&&({newChange:'신규/기변 동시판매',mnp:'MNP 동시판매',usedMnp:'중고 MNP 동시판매'}[homeMobileSimul])].filter(Boolean).join(' · ')||'판매 상품을 선택해주세요'}</div></div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={closeHomeOrder}
                disabled={homeOrderSaving}
                className="py-2.5 rounded-xl bg-gray-100 text-gray-500 text-sm font-semibold"
              >
                취소
              </button>
              <button
                type="button"
                onClick={submitHomeOrder}
                disabled={homeOrderSaving || !homeCustomerName.trim() || !homeNetworkType || (!homeInternet&&!homeMainTv&&!homeSubTv&&!homeSmartHome) || (homeMainTv&&!homeMainTvPlan)}
                className="py-2.5 rounded-xl bg-brand-600 text-white text-sm font-bold disabled:opacity-50"
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
              ? 'bg-brand-700 border-brand-600 text-white'
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
                        {toast.source==='mobile'&&toast.calculationLines?.length>0&&<details className="mt-2 text-[10px]">
                          <summary className="cursor-pointer font-semibold opacity-80">계산 근거 보기</summary>
                          <div className="mt-1.5 space-y-1 border-l border-white/20 pl-2">
                            {toast.calculationLines.map(([label,amount],i)=><div key={i} className="flex justify-between gap-3"><span className="opacity-70">{label}</span><b>{amount===null?'선택 반영':`${Number(amount)>0?'+':''}${won(amount)}`}</b></div>)}
                          </div>
                        </details>}
                      </>
                    )}
                    {toast.currentTotal!==undefined&&<div className="text-[11px] opacity-60 mt-0.5">현재 누적 예상 {won(toast.currentTotal)}</div>}
                  </div>

                  <div className="flex gap-1.5">
                    {toast.customerSaleId&&<button onClick={editToastSale} className="shrink-0 px-3 py-1.5 rounded-lg bg-white text-gray-900 text-xs font-bold">바로 수정</button>}
                    <button onClick={toast.source==='home'?undoHomeToast:undoToast} className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-400 text-gray-900 text-xs font-bold">방금 등록 취소</button>
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
