import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Trophy, Home, ClipboardList, History, TrendingUp, Users, ChevronDown, Plus,
  Minus, Award, Loader2, Check, Settings, LayoutDashboard, Wallet, Trash2,
  UserPlus, Info, Layers, Calendar, ChevronLeft, ChevronRight, AlertTriangle, Zap,
  UploadCloud, X, Target, ShieldCheck, LogOut, Bell, ClipboardCheck, Building2, Share2, Send, HelpCircle, Star
} from 'lucide-react';
import { supabase } from './supabase';
import { friendlyError } from './errorMessages';
const HqStructurePolicyView=React.lazy(()=>import('./HqStructurePolicyView'));
const PasswordResetAdmin=React.lazy(()=>import('./PasswordResetAdmin'));
const PendingApprovals=React.lazy(()=>import('./PendingApprovals'));
const ProfileEditRequests=React.lazy(()=>import('./ProfileEditRequests'));
import {
  SECOND_PERFORMANCE_POINT, allowedSecondVas,
  summarizeVasQuality, homeOrdersForMonth, homeBundleCount, homePerformanceDate, completedHomeCount,
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
import { calculateSalesManagerPayroll, SALES_MANAGER_POLICY_VERSION } from './salesManagerPolicyEngine';
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
import {
  DAILY_BRIEFING_SEND_TIME,
  buildAllBriefingText,
  buildStoreBriefingText,
  canAccessDailyBriefing,
  dailyInputStatus,
  isBriefingMonthOverdueHome,
  projectMetric,
  resolveStoreBriefingGoals,
} from './dailyBriefing';

let feedbackBridge={toast:null,confirm:null};
function showAppToast(message,{tone='success',title=''}={}){feedbackBridge.toast?.({message,title,tone})}
function showLegacyAlert(message){
  const text=String(message||'');
  const isError=/ì‹¤íŒ¨|ì˜¤ë¥˜|ëª»í–ˆ|ì…ë ¥í•´ì£¼ì„¸ìš”|ì„ íƒí•´ì£¼ì„¸ìš”|ì—†ì–´ìš”|í•  ìˆ˜ ì—†|ê¶Œí•œ|ë§ˆê°ëœ/.test(text);
  showAppToast(text,{tone:isError?'error':'info',title:isError?'í™•ì¸í•´ì£¼ì„¸ìš”':'ì•ˆë‚´'});
}
function showAppConfirm(options={}){
  if(!feedbackBridge.confirm)return Promise.resolve(window.confirm(options.message||options.title||'ê³„ì†í• ê¹Œìš”?'));
  return feedbackBridge.confirm(options);
}

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
    return()=>{feedbackBridge={toast:null,confirm:null}};
  },[]);
  const finish=value=>{dialog?.resolve?.(value);setDialog(null)};
  return <>
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[120] w-[calc(100%-24px)] max-w-sm space-y-2 pointer-events-none">{toasts.map(t=><div key={t.id} className={`pointer-events-auto rounded-2xl px-4 py-3 shadow-xl border ${t.tone==='error'?'bg-red-600 border-red-500 text-white':t.tone==='info'?'bg-gray-900 border-gray-800 text-white':'bg-emerald-600 border-emerald-500 text-white'}`}><div className="text-xs font-bold">{t.title|| (t.tone==='error'?'ì²˜ë¦¬í•˜ì§€ ëª»í–ˆì–´ìš”':'ì²˜ë¦¬ ì™„ë£Œ')}</div><div className="text-[11px] opacity-90 mt-0.5">{t.message}</div></div>)}</div>
    {dialog&&<div className="fixed inset-0 z-[125] bg-black/45 flex items-end sm:items-center justify-center" onClick={()=>finish(false)}><div className="w-full max-w-sm bg-white rounded-t-3xl sm:rounded-3xl p-5" onClick={e=>e.stopPropagation()}><div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${dialog.tone==='danger'?'bg-red-50 text-red-500':'bg-violet-50 text-violet-600'}`}><AlertTriangle size={20}/></div><div className="text-lg font-bold text-gray-900 mt-3">{dialog.title||'í™•ì¸í•´ì£¼ì„¸ìš”'}</div><div className="text-xs text-gray-500 mt-2 whitespace-pre-line leading-relaxed">{dialog.message}</div><div className="grid grid-cols-2 gap-2 mt-5"><button onClick={()=>finish(false)} className="py-3 rounded-xl bg-gray-100 text-gray-600 text-sm font-bold">{dialog.cancelLabel||'ëŒì•„ê°€ê¸°'}</button><button onClick={()=>finish(true)} className={`py-3 rounded-xl text-white text-sm font-bold ${dialog.tone==='danger'?'bg-red-500':'bg-violet-600'}`}>{dialog.confirmLabel||'í™•ì¸'}</button></div></div></div>}
  </>;
}

function PwaInstallButton(){
  const [installPrompt,setInstallPrompt]=useState(null),[guideOpen,setGuideOpen]=useState(false),[installed,setInstalled]=useState(false);
  useEffect(()=>{
    const standalone=window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
    setInstalled(standalone);
    const ready=(event)=>{event.preventDefault();setInstallPrompt(event)};
    const done=()=>{setInstalled(true);setInstallPrompt(null);showAppToast('ë¯¸ì†Œí˜ì´ë¥¼ í™ˆ í™”ë©´ì— ì„¤ì¹˜í–ˆì–´ìš”.')};
    window.addEventListener('beforeinstallprompt',ready);window.addEventListener('appinstalled',done);
    return()=>{window.removeEventListener('beforeinstallprompt',ready);window.removeEventListener('appinstalled',done)};
  },[]);
  if(installed)return null;
  const install=async()=>{
    if(installPrompt){await installPrompt.prompt();const choice=await installPrompt.userChoice;if(choice?.outcome==='accepted')setInstallPrompt(null);return}
    setGuideOpen(true);
  };
  const isiOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
  return <><button onClick={install} className="hidden sm:flex h-9 items-center gap-1 rounded-xl border border-violet-100 bg-violet-50 px-2.5 text-[10px] font-bold text-violet-700" title="í™ˆ í™”ë©´ì— ì•± ì„¤ì¹˜"><Home size={14}/>ì•± ì„¤ì¹˜</button><button onClick={install} className="sm:hidden w-9 h-9 rounded-xl border border-violet-100 bg-violet-50 text-violet-700 flex items-center justify-center" title="ì•± ì„¤ì¹˜"><Home size={15}/></button>{guideOpen&&<div className="fixed inset-0 z-[126] bg-black/45 flex items-end sm:items-center justify-center" onClick={()=>setGuideOpen(false)}><div className="w-full max-w-sm rounded-t-3xl sm:rounded-3xl bg-white p-5" onClick={e=>e.stopPropagation()}><div className="w-12 h-12 rounded-2xl bg-violet-600 text-white flex items-center justify-center"><Trophy size={24}/></div><div className="text-lg font-black text-gray-900 mt-3">ë¯¸ì†Œí˜ì´ ì•± ì„¤ì¹˜</div>{isiOS?<div className="mt-3 space-y-2 text-sm text-gray-600"><div className="rounded-xl bg-gray-50 p-3"><b>1.</b> Safari í•˜ë‹¨ì˜ <b>ê³µìœ  ë²„íŠ¼</b>ì„ ëˆŒëŸ¬ìš”.</div><div className="rounded-xl bg-gray-50 p-3"><b>2.</b> ë©”ë‰´ì—ì„œ <b>í™ˆ í™”ë©´ì— ì¶”ê°€</b>ë¥¼ ì„ íƒí•´ìš”.</div><div className="rounded-xl bg-gray-50 p-3"><b>3.</b> ì˜¤ë¥¸ìª½ ìœ„ <b>ì¶”ê°€</b>ë¥¼ ëˆ„ë¥´ë©´ ë!</div></div>:<div className="mt-3 text-sm text-gray-600 leading-relaxed">ë¸Œë¼ìš°ì € ë©”ë‰´ì—ì„œ <b>ì•± ì„¤ì¹˜</b> ë˜ëŠ” <b>í™ˆ í™”ë©´ì— ì¶”ê°€</b>ë¥¼ ì„ íƒí•´ì£¼ì„¸ìš”. Chrome ìµœì‹  ë²„ì „ì—ì„œ ê°€ì¥ ì›í™œí•´ìš”.</div>}<div className="mt-3 rounded-xl bg-violet-50 p-3 text-xs text-violet-700">ì„¤ì¹˜í•˜ë©´ ì£¼ì†Œì°½ ì—†ì´ ì•±ì²˜ëŸ¼ ì—´ë¦¬ê³ , ë‹¤ìŒ ë‹¨ê³„ì—ì„œ íœ´ëŒ€í° í‘¸ì‹œ ì•Œë¦¼ë„ ì—°ê²°í•  ìˆ˜ ìˆì–´ìš”.</div><button onClick={()=>setGuideOpen(false)} className="mt-4 w-full rounded-xl bg-violet-600 py-3 text-sm font-bold text-white">í™•ì¸í–ˆì–´ìš”</button></div></div>}</>;
}

function AppQuickGuide({open,onClose,isManager=false}){
  if(!open)return null;
  const employeeSteps=[
    ['1','í™ˆë¶€í„° í™•ì¸','ì˜¤ëŠ˜ í•  ì¼, ëª©í‘œ ì§„ì²™ë„, ì˜ˆìƒ ê¸‰ì—¬ì™€ ìˆœìœ„ë¥¼ ë¨¼ì € í™•ì¸í•´ìš”.'],
    ['2','ì‹¤ì ì…ë ¥','íŒë§¤ì¼ì„ ê³ ë¥´ê³  ëª¨ë°”ì¼Â·í™ˆ ì‹¤ì ì„ ë“±ë¡í•´ìš”. ì €ì¥ ìƒíƒœë„ ìƒë‹¨ì—ì„œ í™•ì¸í•  ìˆ˜ ìˆì–´ìš”.'],
    ['3','ê³ ê°ê´€ë¦¬','ì œíœ´ì¹´ë“œ, ìˆ˜ë‚©ì§€ì›, ìš”ê¸ˆì œ ë³€ê²½ê³¼ ì„¤ì¹˜ ì¼ì •ì„ ë†“ì¹˜ì§€ ì•Šê²Œ ê´€ë¦¬í•´ìš”.'],
    ['4','ë‚´ì—­ í™•ì¸','íŒë§¤ë³„ ê³„ì‚° ê·¼ê±°ì™€ ì›” ëˆ„ì  ê¸‰ì—¬ê°€ ë§ëŠ”ì§€ í™•ì¸í•´ìš”.'],
  ];
  const managerSteps=[
    ['1','ì˜¤ëŠ˜ì˜ ìš´ì˜','ë¯¸ì…ë ¥, ëª©í‘œ ìœ„í—˜, ì„¤ì¹˜ ì§€ì—°ê³¼ ìŠ¹ì¸ ëŒ€ê¸°ë¶€í„° í™•ì¸í•´ìš”.'],
    ['2','ì‹¤ì Â·ê³ ê° ì ê²€','ë§¤ì¥ ëª©í‘œì™€ ìˆœìœ„, ê³ ê° ì•½ì†Â·í™ˆ ì„¤ì¹˜ë¥¼ í•„ìš”í•œ ë²”ìœ„ì—ì„œ í™•ì¸í•´ìš”.'],
    ['3','í‰ê°€Â·ê¸‰ì—¬','í‰ê°€ì™€ ë‹´ë‹¹ì ê¸‰ì—¬ëŠ” ê¸°ì¡´ ê´€ë¦¬ ë²”ìœ„ì™€ íšŒì‚¬ ì „ì²´ ê¸°ì¤€ì„ ìœ ì§€í•´ìš”.'],
    ['4','ê´€ë¦¬ ì„¤ì •','ë³¸ì‚¬ ë°ì´í„°ì™€ ì§€ê¸‰ê¸°ì¤€ ê°™ì€ ë¯¼ê° ë©”ë‰´ëŠ” ê¶Œí•œì´ ìˆì„ ë•Œë§Œ ë³´ì—¬ìš”.'],
  ];
  const steps=isManager?managerSteps:employeeSteps;
  return <div className="fixed inset-0 z-[127] flex items-end justify-center bg-black/45 sm:items-center" onClick={onClose}><div className="w-full max-w-md rounded-t-3xl bg-white p-5 sm:rounded-3xl" onClick={event=>event.stopPropagation()}><div className="flex items-start justify-between gap-3"><div><div className="text-[10px] font-bold text-violet-600">ë¹ ë¥¸ ì‚¬ìš© ì•ˆë‚´</div><div className="mt-1 text-xl font-black text-gray-900">ë¯¸ì†Œí˜ì´, ì´ë ‡ê²Œ ì‚¬ìš©í•˜ì„¸ìš”</div><div className="mt-1 text-xs text-gray-400">{isManager?'ê´€ë¦¬ìê°€ ë§¤ì¼ í™•ì¸í•  íë¦„ì´ì—ìš”.':'ì§ì›ì´ ë§¤ì¼ ì‚¬ìš©í•  í•µì‹¬ íë¦„ì´ì—ìš”.'}</div></div><button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500"><X size={15}/></button></div><div className="mt-4 space-y-2">{steps.map(([number,title,description])=><div key={number} className="flex gap-3 rounded-2xl bg-gray-50 p-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-xs font-black text-white">{number}</span><div><div className="text-sm font-bold text-gray-900">{title}</div><div className="mt-0.5 text-[11px] leading-relaxed text-gray-500">{description}</div></div></div>)}</div><div className="mt-3 rounded-xl bg-violet-50 px-3 py-2.5 text-[11px] text-violet-700">ì˜¤ë¥¸ìª½ ìœ„ <b>?</b> ë²„íŠ¼ì„ ëˆ„ë¥´ë©´ ì–¸ì œë“  ë‹¤ì‹œ ë³¼ ìˆ˜ ìˆì–´ìš”.</div><button type="button" onClick={onClose} className="mt-4 w-full rounded-xl bg-violet-600 py-3 text-sm font-bold text-white">í™•ì¸í•˜ê³  ì‹œì‘í•˜ê¸°</button></div></div>;
}

/* v21.26: 2ND ë²ˆë“¤ë³„ ì¼ë°˜/ë¬´ë£ŒíŒë§¤ êµ¬ë¶„. ë¬´ë£ŒíŒë§¤ëŠ” ì‹¤ì /KPI ì¸ì •, ë²ˆë“¤+í•´ë‹¹ VAS ì¸ì„¼í‹°ë¸Œ ì œì™¸. */

/* v21.32 DATA SAFETY
   - UI ë²„ì „ê³¼ ì €ì¥ ë°ì´í„° ë²„ì „ì„ ë¶„ë¦¬
   - êµ¬ë²„ì „ source_metaë¥¼ í˜„ì¬ UI í˜•ì‹ìœ¼ë¡œ ì½ìŒ
   - ìˆ˜ì • ì‹œ ê¸°ì¡´ source_meta í•„ë“œë¥¼ ë³´ì¡´í•œ ì±„ í˜„ì¬ í•„ë“œë§Œ ë³‘í•©
   - DB audit triggerì™€ í•¨ê»˜ ì›ë³¸ ë³€ê²½ ì´ë ¥ì„ ë³´ì¡´
*/
const CURRENT_SALE_SCHEMA_VERSION = 3;
const FREE_PHONE_SPECIAL_TITLE = 'ë¬´ë£Œí° íŠ¹ê°€'; // 8ì›” ì´ì „ ì €ì¥ê±´ í˜¸í™˜ ì „ìš©
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
  if(t.includes('TVí”„ë¦¬')) return 'tvFree';
  if(t.includes('ìŠ¤ë§ˆíŠ¸í™ˆ')) return 'smartHome';
  if(t.includes('ì¼ë°˜ ë¶€ì…‹íƒ‘') || t.includes('ë¶€ì…‹íƒ‘')) return 'subSetTop';
  if(t.includes('ì¤‘ê³ MNP') || t.includes('ì¤‘ê³  MNP')) return 'simulUsedMnp';
  if(t.includes('MNP ë™ì‹œ')) return 'simulMnp';
  if(t.includes('ì‹ ê·œ/ê¸°ë³€') || t.includes('ì‹ ê·œÂ·ê¸°ë³€')) return 'simulNewChange';
  if(t.includes('1GB') || t.includes('1G')) return 'internet1g';
  if(t.includes('500MB') || t.includes('500M')) return 'internet500';
  if(t.includes('100MB') || t.includes('100M')) return 'internet100';
  if(t.includes('í™ˆ+TV') || t.includes('í™ˆ + TV')) return 'homeTv';
  if(t.includes('í™ˆ ë‹¨ë…') || t==='í™ˆ') return 'homeOnly';
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

/* ===================== ê¸°ë³¸ ì •ì±… ìƒìˆ˜ (ê´€ë¦¬ìê°€ ìˆ˜ì • ê°€ëŠ¥) ===================== */

const POSITIONS = ['ì ì¥', 'ë¶€ì ì¥', 'ë§¤ë‹ˆì €', 'ì‚¬ì›', 'ê¸°íƒ€'];
const DEFAULT_BASE_PAY = { ì ì¥: 2800000, ë¶€ì ì¥: 2600000, ë§¤ë‹ˆì €: 2500000, ì‚¬ì›: 2300000, ê¸°íƒ€: 0 };
const DEFAULT_BASE_PENALTY = 200000; // í™œë™ì‹œê°„ ë¯¸ì¶©ì¡±ì‹œ ì°¨ê°
const DEFAULT_POSITION_ALLOWANCE = { ì ì¥: 500000, ë¶€ì ì¥: 200000, ë§¤ë‹ˆì €: 200000, ì‚¬ì›: 0, ê¸°íƒ€: 0 }; // ì§ì±…ìˆ˜ë‹¹ â€” ì˜ì—…í™œë™ ì§€ì›ê¸ˆê³¼ ë¶„ë¦¬í•˜ì—¬ ìµœì¢… ê°€ì‚°
const DEFAULT_ACTIVITY_SUPPORT_MAX = 2300000; // ì˜ì—…í™œë™ ì§€ì› ì •ì±… ê³µí†µ MAX

const DEFAULT_STORES = [
  'ì‹ ì²œë™_ì‚¼ë¯¸ì‹œì¥ì ', 'ì‹ ì²œë™_ì‚¼ë¯¸ì‹œì¥2í˜¸ì ', 'ë³¸ì˜¤3ë™_ìƒë¡ìˆ˜ì—­ì ', 'ëŒ€ì•¼ë™_ë¡¯ë°ë§ˆíŠ¸ì ',
  'ë³¸ì˜¤3ë™_ì£¼ë¯¼ì„¼í„°ì ', 'ì¥ê³¡ë™_ì¥ê³¡ì—­ì ', 'ê±°ëª¨ë™_ë„ì¼ì‹œì¥ì ', 'ì›”ê³¶ë™_ì›”ê³¶ì ',
  'ì›”í”¼ë™_ì„±í¬ì—­ì ', 'ê´‘ì •ë™_ì‚°ë³¸ì ', 'ê³ ì”ë™_ë²•ì¡°íƒ€ìš´ì ', 'ì€í–‰ë™_ì€ê³„ì‚¬ê±°ë¦¬ì ', 'ë³¸ì˜¤1ë™_ë³¸ì˜¤ì¤‘í•™êµì ',
  'ì˜ì—…ì§€ì›íŒ€',
];
// ì‹¤ì œ ì˜ì—…ì„ í•˜ì§€ ì•ŠëŠ” ì¡°ì§ â€” ì‹¤ì í‘œ/ì‹¤ì ë¹„êµ/ì§€ê¸‰ ì´ì•¡ ì§‘ê³„ì—ì„œ ì œì™¸
const NON_SALES_STORES = ['ìš´ì˜ì§„', 'ì˜ì—…ì§€ì›íŒ€'];
const SALES_AREA_STORES = Object.freeze({
  ansan: ['ë³¸ì˜¤3ë™_ìƒë¡ìˆ˜ì—­ì ', 'ë³¸ì˜¤3ë™_ì£¼ë¯¼ì„¼í„°ì ', 'ì›”í”¼ë™_ì„±í¬ì—­ì ', 'ê´‘ì •ë™_ì‚°ë³¸ì ', 'ê³ ì”ë™_ë²•ì¡°íƒ€ìš´ì ', 'ë³¸ì˜¤1ë™_ë³¸ì˜¤ì¤‘í•™êµì '],
  siheung: ['ì‹ ì²œë™_ì‚¼ë¯¸ì‹œì¥ì ', 'ì‹ ì²œë™_ì‚¼ë¯¸ì‹œì¥2í˜¸ì ', 'ëŒ€ì•¼ë™_ë¡¯ë°ë§ˆíŠ¸ì ', 'ì¥ê³¡ë™_ì¥ê³¡ì—­ì ', 'ê±°ëª¨ë™_ë„ì¼ì‹œì¥ì ', 'ì›”ê³¶ë™_ì›”ê³¶ì ', 'ì€í–‰ë™_ì€ê³„ì‚¬ê±°ë¦¬ì '],
});
const SALES_AREA_LABELS = Object.freeze({ ansan: 'ì•ˆì‚° ìƒê¶Œ', siheung: 'ì‹œí¥ ìƒê¶Œ' });
const SALES_MANAGER_AREAS = Object.freeze({ ê¹€ì§„ë°±: 'ansan', ì„ì„±ì¤€: 'siheung' });
const COMPANY_SCOPE_VIEWERS = new Set(['ì´ê°•ì§„', 'ê¹€ì§„ë¬¸']);
const NON_EXECUTIVE_COMPANY_CONTROLLERS = new Set(['ì •ìœ ë¯¸', 'ê¹€ì†”ì´']);
const PRIMARY_PERMISSION_ADMIN_ID = 'a50a0979-acef-40b1-98b7-f05074f1c835';

const DEFAULT_TENURE = [
  { key: 'under6', label: '6ê°œì›” ë¯¸ë§Œ (ì‹¤ì ë¬´ê´€)', rate: 0 },
  { key: 'under12', label: '12ê°œì›” ë¯¸ë§Œ', rate: 200000 },
  { key: 'over12', label: '12ê°œì›” ì´ìƒ', rate: 150000 },
  { key: 'over24', label: '24ê°œì›” ì´ìƒ', rate: 100000 },
];
const DEFAULT_TENURE_CAP = 2300000;

const DEFAULT_GRADES = [
  { grade: 'S', min: 55, bonus: 1000000 },
  { grade: 'A', min: 45, bonus: 700000 },
  { grade: 'B', min: 35, bonus: 500000 },
  { grade: 'C', min: 25, bonus: 300000 },
  { grade: 'D', min: 0, bonus: 0 },
];
const HOME_GATE_MIN = 3; // í™ˆ ìµœì†Œì¡°ê±´(ì„±ê³¼ ì¸ì • ê²Œì´íŠ¸)
const ADDON_GATE = 35;   // ëª¨ë°”ì¼ Pê°€ ì´ ê°’ ì´ˆê³¼ì¼ ë•Œë§Œ í™ˆ ê°€ì  ë°˜ì˜
// í™ˆ ìµœì†Œì¡°ê±´(3ì ) ì „ìš© ë°°ì  â€” ì„±ê³¼ë“±ê¸‰P ì•ˆë‚´í‘œì™€ëŠ” ë³„ê°œ ê¸°ì¤€ (ì¸í„°ë„·:1ì , í”„ë¦¬:0.3ì , ìŠ¤í™ˆ:0.2ì )
const HOME_GATE_WEIGHTS = { homeOnly: 1, homeTv: 1, tvFree: 0.3, smartHome: 0.2 };

const DEFAULT_MOBILE_POINT_ITEMS = [
  { key: 'mnp', label: 'MNP', point: 1.5, countsTenure: true },
  { key: 'new010', label: '010 ì‹ ê·œ', point: 1, countsTenure: true },
  { key: 'gibyeon115', label: 'ê¸°ê¸°ë³€ê²½ (115êµ°â†‘)', point: 1, countsTenure: true },
  { key: 'gibyeon85', label: 'ê¸°ê¸°ë³€ê²½ (85êµ°â†‘)', point: 0.7, countsTenure: true },
  { key: 'gibyeonWeak', label: 'ê¸°ë³€ (ì•½ììš”ê¸ˆì œ)', point: 0.5, countsTenure: true },
  { key: 'gibyeonLVC', label: 'ê¸°ë³€ (85êµ° ë¯¸ë§Œ)', point: 0.3, countsTenure: true },
  { key: 'usedMnp', label: 'ì¤‘ê³  MNP (ì„ ì•½ê°€ì…ê±´)', point: 1, countsTenure: true },
  { key: 'secondOnly', label: '2NDë‹¨ë…', point: SECOND_PERFORMANCE_POINT, countsTenure: true },
];

const DEFAULT_KPI_ITEMS = [
  { key: 'kpiMnp', label: 'MNP', point: 1.7 },
  { key: 'kpiNew010', label: '010 ì‹ ê·œ', point: 1.5 },
  { key: 'kpiGibyeonA', label: 'ê¸°ë³€A', point: 1 },
  { key: 'kpiGibyeonB', label: 'ê¸°ë³€B', point: 0.8 },
  { key: 'kpiGibyeonC', label: 'ê¸°ë³€C', point: 0.5 },
  { key: 'kpiSecond', label: '2ND', point: 0.2 },
  { key: 'kpiSimMnp', label: 'SIM MNP', point: 1 },
  { key: 'kpiUsedNew010', label: 'ì¤‘ê³  010ì‹ ê·œ (66êµ° ì´ìƒ)', point: 0.5 },
  { key: 'kpiHome', label: 'í™ˆ', point: 1 },
  { key: 'kpiTv', label: 'TV', point: 1 },
  { key: 'kpiTvSetTop', label: 'TVë¶€ì…‹íƒ‘', point: 0.5 },
  { key: 'kpiSmartHome', label: 'ìŠ¤ë§ˆíŠ¸í™ˆ', point: 0.5 },
  { key: 'kpiInternetRenew', label: 'ì¸í„°ë„· ì¬ì•½ì •', point: 0.3 },
  { key: 'kpiTvRenew', label: 'TV ì¬ì•½ì •', point: 0.3 },
];

const HOME_BASE_ITEMS = [
  { key: 'homeOnly', label: 'í™ˆ ë‹¨ë…', point: 1 },
  { key: 'homeTv', label: 'TV(ì£¼)', point: 2 },
];

// v21.15: í™ˆ ì²­ì•½ì„ ê°€ì •ë§/ì†Œí˜¸ë§ìœ¼ë¡œ ë¶„ë¦¬ ì €ì¥.
// í˜„ì¬ ì›” ì¸ì„¼í‹°ë¸Œ ê³„ì‚°ì‹ì€ ê¸°ì¡´ ì •ì±…ì„ ìœ ì§€í•˜ê³ , ë‹¤ìŒë‹¬ ì •ì±… í™•ì • ì‹œ ë§ë³„ ë‹¨ê°€ë¥¼ ë³„ë„ ì ìš©í•  ìˆ˜ ìˆê²Œ ë°ì´í„°ë¶€í„° ë¶„ë¦¬í•©ë‹ˆë‹¤.
const HOME_NETWORK_TYPES = [
  { key: 'household', label: 'ê°€ì •ë§' },
  { key: 'soho', label: 'ì†Œí˜¸ë§' },
];
const HOME_SALE_TYPES = [
  { key: 'normal', label: 'ì¼ë°˜' },
  { key: 'allinone', label: 'ì˜¬ì¸ì›' },
];
function homeNetworkLabel(value) {
  return HOME_NETWORK_TYPES.find(x=>x.key===value)?.label || 'ë§ ë¯¸ì§€ì •';
}
function homeMainTvPlanLabel(value,networkType=''){
  if(value==='broadcastPass')return 'ë°©ì†¡íŒ¨ìŠ¤';
  if(value==='premium')return 'í”„ë¦¬ë¯¸ì—„';
  if(value==='belowPremium')return 'í”„ë¦¬ë¯¸ì—„ ë¯¸ë§Œ';
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
  { key: 'home1GBOnly', label: '1GB ë‹¨ë…', rate: 200000, point: 0 },
  { key: 'home500Only', label: '500MB ë‹¨ë…', rate: 100000, point: 0 },
  { key: 'home100Only', label: '100MB ë‹¨ë…', rate: 50000, point: 0 },
  { key: 'tvFree', label: 'TVí”„ë¦¬(ë¶€)', rate: 100000, point: 0.5 },
  { key: 'smartHome', label: 'ìŠ¤ë§ˆíŠ¸í™ˆ', rate: 100000, point: 0.5 },
];

const DEFAULT_HOME_ADDON = [
  { key: 'addNewChange', label: 'ì‹ ê·œ/ê¸°ë³€ ë™ì‹œíŒë§¤', rate: 100000 },
  { key: 'addMnp', label: 'MNP ë™ì‹œíŒë§¤', rate: 300000 },
  { key: 'addUsedMnp', label: 'ì¤‘ê³ MNP ë™ì‹œíŒë§¤ (85êµ°â†‘ ì„ ì•½, ê°€ì •ë§)', rate: 200000 },
  { key: 'addSetTop', label: 'ë¶€ì…‹íƒ‘ ë™ì‹œì²­ì•½', rate: 50000 },
  { key: 'smartHomeSimul', label: 'ìŠ¤ë§ˆíŠ¸í™ˆ ë™ì‹œíŒë§¤', rate: 50000 },
];

const DEFAULT_RENEW = [
  { key: 'renewPremiumSafe1G', label: 'ì¬ì•½ì • - í”„ë¦¬ë¯¸ì—„ ì•ˆì‹¬ë³´ìƒ 1GB', rate: 120000 },
  { key: 'renewPremiumSafe500', label: 'ì¬ì•½ì • - í”„ë¦¬ë¯¸ì—„ ì•ˆì‹¬ë³´ìƒ 500MB', rate: 90000 },
  { key: 'renewPremium1G', label: 'ì¬ì•½ì • - í”„ë¦¬ë¯¸ì—„ ì•ˆì‹¬ 1GB', rate: 110000 },
  { key: 'renewPremium500', label: 'ì¬ì•½ì • - í”„ë¦¬ë¯¸ì—„ ì•ˆì‹¬ 500MB', rate: 80000 },
  { key: 'renewSmart1G', label: 'ì¬ì•½ì • - ìŠ¤ë§ˆíŠ¸ 1GB', rate: 20000 },
  { key: 'renewSimul1G', label: 'ì¬ì•½ì • - ë™ì‹œíŒë§¤ 1GB', rate: 80000 },
  { key: 'renewSimul500', label: 'ì¬ì•½ì • - ë™ì‹œíŒë§¤ 500MB', rate: 50000 },
  { key: 'renewTvUpsell', label: 'TV ì—…ì…€ ìˆ˜ìˆ˜ë£Œ', rate: 20000 },
];

const HOUSEHOLD_RENEW_PLANS = [
  { key:'premiumSafe', label:'í”„ë¦¬ë¯¸ì—„ ì•ˆì‹¬ ë³´ìƒ' },
  { key:'premium', label:'í”„ë¦¬ë¯¸ì—„ ì•ˆì‹¬' },
  { key:'smart', label:'ìŠ¤ë§ˆíŠ¸' },
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
  { label: 'ì¼ë°˜ëª¨ë¸ ì‹ ê·œ', dailyLabel: 'ì‹ ê·œ', hasTiers: true },
  { label: 'ì¼ë°˜ëª¨ë¸ MNP', dailyLabel: 'MNP', hasTiers: true },
  { label: 'ì¼ë°˜ëª¨ë¸ ê¸°ë³€A', dailyLabel: 'ê¸°ê¸°ë³€ê²½ A', hasTiers: true, isGibyeon: true },
  { label: 'ì¼ë°˜ëª¨ë¸ ê¸°ë³€B', dailyLabel: 'ê¸°ê¸°ë³€ê²½ B', hasTiers: true, isGibyeon: true },
  { label: 'ì¼ë°˜ëª¨ë¸ ê¸°ë³€C', dailyLabel: 'ê¸°ê¸°ë³€ê²½ C', hasTiers: true, isGibyeon: true },
  { label: 'SIM MNP', dailyLabel: 'SIM MNP(ì„ ì•½)', hasTiers: true },
  { label: 'ì¤‘ê³  ì‹ ê·œ(66êµ°â†‘)', dailyLabel: 'ì¤‘ê³  ì‹ ê·œ(66êµ° ì´ìƒ)', hasTiers: false }, // ì¸ì„¼í‹°ë¸Œ ë¬´ê´€ â€” ìš”ê¸ˆì œêµ° êµ¬ë¶„ ì—†ì´ ê±´ìˆ˜ë§Œ
  { label: '2NDë‹¨ë…', dailyLabel: '2NDë‹¨ë…', hasTiers: false }, // ìš”ê¸ˆì œêµ° êµ¬ë¶„ ì—†ì´ ê±´ìˆ˜ë§Œ, ë‹¨ì¼ ë‹¨ê°€ ì ìš©
];
const MATRIX_ROWS = MATRIX_ROW_DEFS.map((r) => r.label);
const MATRIX_COLS = ['115êµ°â†‘', '95~105êµ°Â·ì²­ì†Œë…„85êµ°', '85êµ°', '61êµ°ì´ìƒ', 'ì•½ììš”ê¸ˆì œ', 'ê·¸ ì™¸'];
const DEFAULT_MATRIX = [
  [5, 3, 2, 1, 1, 0],       // ì¼ë°˜ëª¨ë¸ ì‹ ê·œ
  [9, 6, 5, 4, 4, 2],       // ì¼ë°˜ëª¨ë¸ MNP
  [5, 3, 2, 1, 1, 0],       // ì¼ë°˜ëª¨ë¸ ê¸°ë³€A
  [5, 3, 2, 1, 1, 0],       // ì¼ë°˜ëª¨ë¸ ê¸°ë³€B (Aì™€ ë™ì¼)
  [2.5, 1.5, 1, 0.5, 0.5, 0], // ì¼ë°˜ëª¨ë¸ ê¸°ë³€C (A/Bì˜ 50%)
  [10, 10, 10, 7, 5, 5],    // SIM MNP
  [0, 0, 0, 0, 0, 0],       // ì¤‘ê³  ì‹ ê·œ(66êµ°â†‘) â€” ì¸ì„¼í‹°ë¸Œ ë¬´ê´€, í•­ìƒ 0
  [5, 0, 0, 0, 0, 0],       // 2ND â€” ë‹¨ì¼ ë‹¨ê°€ (ê±´ë‹¹ 5ë§Œì›)
].map((row) => row.map((v) => v * 10000));

// ê°€ì…êµ¬ë¶„(ë§¤íŠ¸ë¦­ìŠ¤ í–‰) â†’ ì„±ê³¼ë“±ê¸‰P í•­ëª© / KPI í•­ëª© ê¸°ë³¸ ë§¤í•‘. ê´€ë¦¬ì í™”ë©´ì—ì„œ ìˆ˜ì • ê°€ëŠ¥.
// ê¸°ë³€A/B/C(isGibyeon) í–‰ì€ ì„±ê³¼ë“±ê¸‰Pë§Œì€ íƒ€ê²Ÿ(A/B/C) ìƒê´€ì—†ì´ ìš”ê¸ˆì œêµ°(ì—´) ê¸°ì¤€ìœ¼ë¡œ í†µì¼ ì ìš© â€” gibyeonColumnMap ì°¸ê³ . KPIëŠ” íƒ€ê²Ÿë³„ë¡œ ê·¸ëŒ€ë¡œ ìœ ì§€.
const DEFAULT_CATEGORY_MAP = [
  { mobilePointKey: 'new010', kpiKey: 'kpiNew010' },        // ì¼ë°˜ëª¨ë¸ ì‹ ê·œ
  { mobilePointKey: 'mnp', kpiKey: 'kpiMnp' },               // ì¼ë°˜ëª¨ë¸ MNP
  { mobilePointKey: '', kpiKey: 'kpiGibyeonA' },             // ì¼ë°˜ëª¨ë¸ ê¸°ë³€A (ì„±ê³¼ë“±ê¸‰PëŠ” ì—´ ê¸°ì¤€)
  { mobilePointKey: '', kpiKey: 'kpiGibyeonB' },             // ì¼ë°˜ëª¨ë¸ ê¸°ë³€B (ì„±ê³¼ë“±ê¸‰PëŠ” ì—´ ê¸°ì¤€)
  { mobilePointKey: '', kpiKey: 'kpiGibyeonC' },             // ì¼ë°˜ëª¨ë¸ ê¸°ë³€C (ì„±ê³¼ë“±ê¸‰PëŠ” ì—´ ê¸°ì¤€)
  { mobilePointKey: 'usedMnp', kpiKey: 'kpiSimMnp' },        // SIM MNP = ì¤‘ê³  MNP(ì„ ì•½ê°€ì…ê±´)
  { mobilePointKey: '', kpiKey: 'kpiUsedNew010' },           // ì¤‘ê³  ì‹ ê·œ(66êµ°â†‘) â€” ì¸ì„¼í‹°ë¸Œ ë¬´ê´€, KPIë§Œ ë°˜ì˜
  { mobilePointKey: 'secondOnly', kpiKey: 'kpiSecond' },     // 2ND
];

// ê¸°ë³€ í–‰(A/B/C ê³µí†µ) ìš”ê¸ˆì œêµ°ë³„ ì„±ê³¼ë“±ê¸‰P â€” 115êµ°â†‘ 1P / 95~105êµ°Â·ì²­ì†Œë…„85êµ° 0.7P / 85êµ° 0.7P / ì•½ì 0.5P / 61êµ°ì´ìƒÂ·ê·¸ì™¸ 0.3P
const DEFAULT_GIBYEON_COLUMN_MAP = ['gibyeon115', 'gibyeon85', 'gibyeon85', 'gibyeonLVC', 'gibyeonWeak', 'gibyeonLVC'];

const DEFAULT_VAS = [
  { key: 'vasKyobo', label: 'êµë³´ë¬¸ê³ sam + êµ¬ê¸€ì›', rate: 20000 },
  { key: 'vasVcolor', label: 'Vì»¬ëŸ¬ë§ + ë²¨ë§ì½˜í…ì¸ íŒ©', rate: 20000 },
  { key: 'vasPhonePass', label: 'í°êµì²´íŒ¨ìŠ¤', rate: 10000 },
  { key: 'vasSafePass', label: 'í°ì•ˆì‹¬íŒ¨ìŠ¤', rate: 0 },
];

// ìš´ì˜ DBì— ì €ì¥ëœ ì´ì „ VAS ì„¤ì •ì—ë„ ìƒˆ ê¸°ë³¸ í•­ëª©ì„ ë³´ê°•í•˜ë˜,
// ê´€ë¦¬ìê°€ ìˆ˜ì •í•œ ëª…ì¹­Â·ê¸ˆì•¡ê³¼ ë³„ë„ ì¶”ê°€ í•­ëª©ì€ ê·¸ëŒ€ë¡œ ìœ ì§€í•œë‹¤.
const mergeDefaultVas = (saved=[]) => [
  ...DEFAULT_VAS.map(def => ({ ...def, ...(saved||[]).find(item => item.key===def.key) })),
  ...(saved||[]).filter(item => !DEFAULT_VAS.some(def => def.key===item.key)),
];

const DEFAULT_BUNDLE2ND = [
  { key: 'b_L335', label: '2ND Â· L335', rate: 200000 },
  { key: 'b_X216', label: '2ND Â· X216', rate: 200000 },
  { key: 'b_X236', label: '2ND Â· X236', rate: 150000 },
  { key: 'b_X236NP', label: '2ND Â· X236-NP', rate: 200000 },
  { key: 'b_L505', label: '2ND Â· L505', rate: 200000 },
  { key: 'b_L705', label: '2ND Â· L705(2025)', rate: 200000 },
  { key: 'b_L345', label: '2ND Â· L345(40mm)', rate: 200000 },
  { key: 'b_L355', label: '2ND Â· L355(44mm)', rate: 200000 },
  { key: 'b_L715', label: '2ND Â· L715', rate: 200000 },
  { key: 'b_AppleWatch', label: '2ND Â· ì• í”Œì›Œì¹˜SE3 (ì•„ì´í°14~17)', rate: 150000 },
];

const DEFAULT_SONO = [
  { key: 'sonoBasic', label: 'ì†Œë…¸ NEW ë¼ì´í”„ì¼€ì–´', rate: 80000 },
  { key: 'sono594', label: '594ë§Œ ìƒí’ˆ', rate: 60000 },
];

const DEFAULT_MNP_BUNDLE = [
  { key: 'usedMnpBundle', label: 'ì¤‘ê³  MNP ê²°í•© í™œì„±í™” (61êµ°â†‘ ê°œí†µÂ·ê²°í•©ì™„ë£Œ)', rate: 100000 },
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

/* ===================== ìœ í‹¸ ===================== */

/* v21.22: ê¸ˆì•¡Â·ê±´ìˆ˜Â·ëª©í‘œ ë“± ì¼ë°˜ ìˆ«ì í‘œì‹œëŠ” ì²œ ë‹¨ìœ„ ì½¤ë§ˆë¥¼ ê³µí†µ ì ìš©. ë‚ ì§œ/ìš”ê¸ˆì œ/ì†ë„/ì „í™”ë²ˆí˜¸ ë“± ì‹ë³„ì ìˆ«ìëŠ” ì œì™¸. */

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
function won(n) { return `${fmtNum(Math.round(Number(n || 0)))}ì›`; }
function monthKeyOf(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
function monthLabel(key) { const [y, m] = key.split('-'); return `${y}ë…„ ${parseInt(m, 10)}ì›”`; }
function formatLastSignIn(iso) {
  if (!iso) return 'ê¸°ë¡ ì—†ìŒ';
  const d = new Date(iso);
  const diffDays = calendarDayDiff(d);
  const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
  if (diffDays <= 0) return `ì˜¤ëŠ˜ (${dateStr})`;
  if (diffDays === 1) return `ì–´ì œ (${dateStr})`;
  return `${diffDays}ì¼ ì „ (${dateStr})`;
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

/* ===== ì¼ì¼ì…ë ¥ì´ ë‹¤ë£¨ëŠ” ê±´ìˆ˜ ê·¸ë£¹ â€” ëª¨ë“  ì‹¤ì ì„ ë‚ ì§œë³„ë¡œ ê¸°ë¡ ===== */

const DAILY_GROUP_DEFS = [
  { key: 'homeBase', label: 'í™ˆ ì‹¤ì  (ê·¸ë ˆì´ë“œ ëŒ€ìƒ)', bucket: 'home' },
  { key: 'homeFlat', label: 'í™ˆ ë‹¨ë… / TVí”„ë¦¬ / ìŠ¤ë§ˆíŠ¸í™ˆ', bucket: 'home' },
  { key: 'homeAddon', label: 'ë™ì‹œíŒë§¤ ìˆ˜ìˆ˜ë£Œ', bucket: 'home' },
  { key: 'renew', label: 'ì¸í„°ë„· ì¬ì•½ì •', bucket: 'home' },
  { key: 'bundle2nd', label: '2ND ë²ˆë“¤ íŒë§¤', bucket: 'extra' },
  { key: 'vas', label: 'ì „ëµ ë¶€ê°€ì„œë¹„ìŠ¤ (VAS)', bucket: 'extra' },
  { key: 'sono', label: 'ì†Œë…¸', bucket: 'extra' },
  { key: 'mnpBundle', label: 'ì¤‘ê³ MNP ê²°í•©', bucket: 'extra' },
];
const DAILY_GROUP_KEYS = DAILY_GROUP_DEFS.map((g) => g.key);
const DAILY_NUMERIC_KEYS = ['custRegCount', 'tailoredCount', 'tailoredAmount', 'specialMatrixOffset', 'specialVasOffset', 'specialReplacementPay', 'bundleFreeOffset', 'bundleFreeVasOffset', 'renewSoloDiscountAmount'];

function groupTable(config, key) {
  if (key === 'homeBase') return HOME_BASE_ITEMS;
  return (config && config[key]) || [];
}

// í™ˆÂ·ë¶€ê°€ ì‹¤ì  â†’ ìƒì‚°ì„± í•­ëª© ìë™ ë°˜ì˜ ê·œì¹™
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
    dayOff: false, inputConfirmed: false, inputConfirmedAt: null,
  };
}

// ì˜ˆì „ í˜•ì‹(ë§¤íŠ¸ë¦­ìŠ¤ ë°°ì—´ë§Œ ì €ì¥)ë„ ê·¸ëŒ€ë¡œ ì½íˆë„ë¡ ë³€í™˜
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
    inputConfirmed: !!raw.inputConfirmed,
    inputConfirmedAt: raw.inputConfirmedAt || null,
  };
}

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

function mobileTeamCreditMetrics({ri,ci,vasKeys=[],bundle2ndKeys=[],usedMnpBundle=false,specialMatrixOffset=0,specialVasOffset=0,specialReplacementPay=0,bundleFreeOffset=0,bundleFreeVasOffset=0}){
  const day=emptyDay();
  day.matrix[ri][ci]=1;
  vasKeys.filter(key=>key!=='vasNone').forEach(key=>{day.groups.vas[key]=Number(day.groups.vas[key]||0)+1});
  bundle2ndKeys.forEach(key=>{day.groups.bundle2nd[key]=Number(day.groups.bundle2nd[key]||0)+1});
  if(usedMnpBundle)day.groups.mnpBundle.usedMnpBundle=1;
  return {...day,specialMatrixOffset,specialVasOffset,specialReplacementPay,bundleFreeOffset,bundleFreeVasOffset};
}

function homeTeamCreditMetrics(products=[]){
  const day=emptyDay();
  products.forEach(product=>{day.groups[product.groupKey][product.itemKey]=Number(day.groups[product.groupKey][product.itemKey]||0)+1});
  return day;
}


// ë‹¬ë ¥ìš© í•µì‹¬ ì‹¤ì  ìš”ì•½.
// í˜„ì¬ daily_records í˜•ì‹ë¿ ì•„ë‹ˆë¼ ì˜ˆì „ top-level ê·¸ë£¹ ì €ì¥ í˜•ì‹ë„ í•¨ê»˜ ì½ìŠµë‹ˆë‹¤.
function calendarCoreMetrics(raw){
  const d=normalizeDay(raw);
  const rawObj=(raw && !Array.isArray(raw) && typeof raw==='object')?raw:{};

  const matrix=Array.isArray(raw)?raw:(rawObj.matrix||d.matrix||[]);
  const hs=[0,1,2,3,4].reduce((sum,ri)=>sum+(matrix?.[ri]||[]).reduce((a,v)=>a+Number(v||0),0),0);
  const sim=(matrix?.[5]||[]).reduce((a,v)=>a+Number(v||0),0);

  // í˜„í–‰ groups.homeBase / êµ¬í˜• top-level homeBase ëª¨ë‘ í˜¸í™˜
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

  // í™ˆì€ ë³¸ íŒë§¤ ê¸°ì¤€. êµ¬í˜• ë°ì´í„° ì¤‘ ë³¸ìƒí’ˆ í‚¤ ì—†ì´ ì†ë„ ë‹¨ë…í‚¤ë§Œ ë‚¨ì€ ê²½ìš°ë„ 1ê±´ìœ¼ë¡œ ì¸ì‹.
  const baseHome=Number(groupedHome.homeOnly||0)+Number(groupedHome.homeTv||0);
  const speedHome=Number(flatHome.home100Only||0)+Number(flatHome.home500Only||0)+Number(flatHome.home1GBOnly||0);
  const home=baseHome>0?baseHome:speedHome;

  return {hs,sim,home};
}

function dayHasPerformanceData(raw) {
  if (!raw) return false;
  const d = normalizeDay(raw);
  if (d.matrix.some((row) => row.some((v) => v > 0))) return true;
  if (DAILY_GROUP_KEYS.some((k) => Object.values(d.groups[k] || {}).some((v) => v > 0))) return true;
  if ((d.householdRenewals||[]).length > 0) return true;
  return DAILY_NUMERIC_KEYS.some((k) => (d[k] || 0) > 0);
}

function dayHasData(raw) {
  if (!raw) return false;
  const d = normalizeDay(raw);
  return d.inputConfirmed || dayHasPerformanceData(d);
}

// customer_sales ì›ë³¸ì´ ì—†ë˜ êµ¬ë²„ì „ í™ˆ ì£¼ë¬¸ì„ ì·¨ì†Œí•œ ê²½ìš° daily_recordsì— ë‚¨ì€
// í™ˆ ì§‘ê³„ë§Œ í™”ë©´/ê¸‰ì—¬ì—ì„œ ì œì™¸í•©ë‹ˆë‹¤. ì›ë³¸ ì¼ì¼ ê¸°ë¡ê³¼ ê°ì‚¬ ì´ë ¥ì€ ê·¸ëŒ€ë¡œ ë³´ì¡´í•©ë‹ˆë‹¤.
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

// ê·¸ ë‹¬ì˜ ì¼ì¼ ì…ë ¥ ì „ì²´ë¥¼ í•©ì‚°
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

// í•©ì‚°ëœ ì¼ì¼ì…ë ¥ì„ ì„±ê³¼ë“±ê¸‰P/KPI/ê° ê±´ìˆ˜ ê·¸ë£¹ì— ìë™ ë°˜ì˜í•´ draftë¥¼ ë³´ê°•
function applyDailyToDraft(draft, dailyDaysMap, month, categoryMap, gibyeonColumnMap) {
  const agg = aggregateDaily(dailyDaysMap, month);
  const aggMatrix = agg.matrix;
  const colMap = gibyeonColumnMap || DEFAULT_GIBYEON_COLUMN_MAP;

  // ì´ í•­ëª©ë“¤ì€ ì´ì œ ì¼ì¼ì…ë ¥ì´ ìœ ì¼í•œ ì…ë ¥ ê²½ë¡œë¼, "0ì´ë©´ ì˜› ê°’ ìœ ì§€" í•˜ì§€ ì•Šê³ 
  // ë§¤ë²ˆ ê·¸ ë‹¬ ì¼ì¼ í•©ê³„ë¡œ ì™„ì „íˆ ë®ì–´ì”€ (ì‚­ì œ/ì •ì •ì´ ê·¸ëŒ€ë¡œ ë°˜ì˜ë˜ê²Œ)
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
      // ê¸°ë³€A/B/C ê³µí†µ: íƒ€ê²Ÿê³¼ ë¬´ê´€í•˜ê²Œ ìš”ê¸ˆì œêµ°(ì—´) ê¸°ì¤€ìœ¼ë¡œ ì„±ê³¼ë“±ê¸‰P ë°°ë¶„
      row.forEach((cnt, ci) => {
        const key = colMap[ci];
        if (key) autoMobilePoint[key] = (autoMobilePoint[key] || 0) + (cnt || 0);
      });
    } else if (map.mobilePointKey) {
      autoMobilePoint[map.mobilePointKey] = (autoMobilePoint[map.mobilePointKey] || 0) + rowTotal;
    }
    if (map.kpiKey) autoKpi[map.kpiKey] = (autoKpi[map.kpiKey] || 0) + rowTotal;
  });

  // í™ˆ/2ND/VAS/ì†Œë…¸ ë“± ê±´ìˆ˜ ê·¸ë£¹ â€” ì´ì œ ì¼ì¼ì…ë ¥ì´ ìœ ì¼í•œ ì…ë ¥ ê²½ë¡œë¼ ê·¸ ë‹¬ í•©ê³„ë¡œ ì™„ì „íˆ êµì²´
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

  // v21.54: ì¬ì•½ì • KPIëŠ” ì‹¤ì œ ê³„ì•½ ê±´ìˆ˜ ê¸°ì¤€ìœ¼ë¡œ ê³„ì‚°
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

/* ê¸‰ì—¬ ì „ì²´ ê³„ì‚° */
function computePay(draft, position, hireDate, month, config, mobileSpotPay = 0, strategicMetric = null) {
  const months = monthsSince(hireDate, month);
  const bucketKey = tenureBucketOf(months);
  const bucket = config.tenure.find((t) => t.key === bucketKey) || config.tenure[0];

  const mobileItems = config.mobilePointItems || DEFAULT_MOBILE_POINT_ITEMS;
  const kpiItems = config.kpiItems || DEFAULT_KPI_ITEMS;
  const baseKpiScore = sumPoint(draft.kpi || {}, kpiItems);

  // ì˜ì—… í™œë™ ì§€ì› ì •ì±… ëŒ€ìƒ = HS + SIM MNP + 2ND
  // mobilePointì—ëŠ” HS/SIM MNP/2NDë‹¨ë…ì´ ë“¤ì–´ì˜¤ê³ , 2ND ë²ˆë“¤ íŒë§¤ê±´ì€ ë³„ë„ ê·¸ë£¹ì´ë¯€ë¡œ ì¶”ê°€ í•©ì‚°í•©ë‹ˆë‹¤.
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
  // 2ND ë²ˆë“¤ë„ ë‹¨ë… 2NDì™€ ë™ì¼í•˜ê²Œ ìƒì‚°ì„± 0.2Pë¥¼ ì¸ì •í•©ë‹ˆë‹¤.
  // ë‹¨ë…ì€ draft.kpiì— ì´ë¯¸ ë“¤ì–´ì˜¤ë¯€ë¡œ ë²ˆë“¤ ê±´ë§Œ ì¶”ê°€í•©ë‹ˆë‹¤.
  const bundle2ndKpiPoints=Number((secondPolicy.bundled*Number(kpiItems.find(item=>item.key==='kpiSecond')?.point||0.2)).toFixed(10));
  const kpiScore=baseKpiScore+bundle2ndKpiPoints;

  const supportCap = Number(config.tenureCap ?? DEFAULT_ACTIVITY_SUPPORT_MAX);
  // 6ê°œì›” ë¯¸ë§Œ: ì‹¤ì  ë¬´ê´€ 230ë§Œì›
  // 6~12ê°œì›”: ê±´ë‹¹ 20ë§Œì› / 12~24ê°œì›”: 15ë§Œì› / 24ê°œì›” ì´ìƒ: 10ë§Œì›, ê³µí†µ MAX 230ë§Œì›
  const tenurePay = calculateActivitySupport({monthsEmployed:months,activityCount,rate:bucket?.rate,cap:supportCap});

  // 2ND ì„±ê³¼ë“±ê¸‰PëŠ” ë‹¨ë…/ë²ˆë“¤ êµ¬ë¶„ ì—†ì´ ë™ì¼í•˜ê²Œ ì¸ì •í•©ë‹ˆë‹¤.
  // ë‹¨ë…ì€ mobilePoint.secondOnlyì— í¬í•¨ë˜ê³ , ë²ˆë“¤ì€ bundle2ndì— ë³„ë„ ì €ì¥ë˜ë¯€ë¡œ
  // ë²ˆë“¤ ê±´ìˆ˜ì— í˜„ì¬ 2ND ì„±ê³¼ë“±ê¸‰ ë°°ì ì„ ê³±í•´ ì¶”ê°€í•©ë‹ˆë‹¤. ë¬´ë£ŒíŒë§¤ë„ ì‹¤ì ì€ ì¸ì •ë©ë‹ˆë‹¤.
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

  const legacyHomeAnyCount = Number(draft.homeBase?.homeOnly || 0) + Number(draft.homeBase?.homeTv || 0)
    + Number(draft.homeFlat?.home1GBOnly || 0) + Number(draft.homeFlat?.home500Only || 0) + Number(draft.homeFlat?.home100Only || 0)
    + Number(draft.homeFlat?.tvFree || 0) + Number(draft.homeFlat?.smartHome || 0);
  const homeAnyCount = draft.homePolicy?.source === 'orders'
    ? Math.max(legacyHomeAnyCount, completedHomeCount(draft))
    : legacyHomeAnyCount;
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

  // ìµœì €ë³´ì¥ ë¹„êµ ëŒ€ìƒ:
  // ì˜ì—… í™œë™ ì§€ì› ì •ì±… + ìš”ê¸ˆì œ + VAS + 2ND + ëª¨ë°”ì¼ ìŠ¹ì¸ ìŠ¤íŒŸ + ì§ì±…ìˆ˜ë‹¹
  // íŠ¹íŒÂ·ì§€ì¸íŒë§¤ ëŒ€ì²´ ì¸ì„¼í‹°ë¸ŒëŠ” ìš”ê¸ˆì œ/VAS ëŒ€ì²´ ì„±ê²©ì´ë¯€ë¡œ ëª¨ë°”ì¼ ë¹„êµ ëŒ€ìƒì— í¬í•¨í•©ë‹ˆë‹¤.
  const approvedMobileSpotPay = Math.max(0, Number(mobileSpotPay || 0));
  // ìµœì €ë³´ì¥ ë¹„êµ í›„ ë³„ë„ë¡œ ì¶”ê°€ë˜ëŠ” í•­ëª©
  // v21.63: ê³ ê°ë³„ home_ordersê°€ ìˆìœ¼ë©´ ìƒˆ í™ˆ ì •ì±…ìœ¼ë¡œ ì¬ê³„ì‚°í•˜ê³ ,
  // êµ¬ë²„ì „ ì§‘ê³„ë§Œ ì¡´ì¬í•˜ë©´ ê¸°ì¡´ ê³„ì‚°ì„ fallbackìœ¼ë¡œ ìœ ì§€í•©ë‹ˆë‹¤.
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
  // í™ˆ ë™ì‹œíŒë§¤ ìˆ˜ìˆ˜ë£ŒëŠ” ë³¸ í™ˆ ìƒí’ˆì´ ì¡´ì¬í•  ë•Œë§Œ ì§€ê¸‰í•©ë‹ˆë‹¤.
  // êµ¬ë²„ì „ í™ˆ ê±´ì„ ì‚­ì œí•œ ë’¤ addMnp ê°™ì€ ë¶€ê°€ ì§‘ê³„ë§Œ ë‚¨ì•„ 30ë§Œì›ì´ í‘œì‹œë˜ëŠ” ê²ƒì„ ë°©ì§€í•©ë‹ˆë‹¤.
  const homeAddonPay = homePolicy
    ? Number(homePolicy.homeAddonPay||0)
    : homeAnyCount>0 ? calculateFlatIncentive(draft.homeAddon || {}, config.homeAddon || []) : 0;
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

  // ê¸°ì¡´ í™”ë©´/RAW í˜¸í™˜ìš©
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
    mnpBundlePay, sonoPay, custRegBonus, tailoredBonus, tailoredAmountBonus, kpiScore, bundle2ndKpiPoints,
    strategicPoints, strategicRatio:employeeStrategic.ratio, strategicAdjustment:employeeStrategic.amount,
    strategicAdjustmentBand:employeeStrategic.band, total,
  };
}

/* ===================== ì‘ì€ UI ì»´í¬ë„ŒíŠ¸ ===================== */

function StatusBadge({ status }) {
  const map = {
    approved: { label: 'ì‹¤ì  ìŠ¹ì¸', cls: 'bg-emerald-100 text-emerald-700' },
    pending: { label: 'ì‹¤ì  ìŠ¹ì¸ ëŒ€ê¸°', cls: 'bg-amber-100 text-amber-700' },
    none: { label: 'ë¯¸ì…ë ¥', cls: 'bg-gray-100 text-gray-500' },
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
  let relLabel = diffDays <= 0 ? 'ì˜¤ëŠ˜' : diffDays === 1 ? 'ì–´ì œ' : `${diffDays}ì¼ ì „`;
  const cls = diffDays >= 3 ? 'text-red-500' : diffDays >= 1 ? 'text-amber-600' : 'text-gray-500';
  return (
    <div className={`text-xs ${cls}`}>
      <div className="font-medium">{relLabel}</div>
      <div className="text-[10px] opacity-70">{dateStr}</div>
    </div>
  );
}

function SaveStatus({ saving, dirty, lastSavedAt }) {
  if (saving) return <span className="flex items-center gap-1 text-[11px] text-violet-600"><Loader2 size={11} className="animate-spin" />ì €ì¥ ì¤‘</span>;
  if (dirty) return <span className="flex items-center gap-1 text-[11px] text-amber-600"><UploadCloud size={11} />ì €ì¥ ëŒ€ê¸° ì¤‘</span>;
  if (lastSavedAt) {
    const d = new Date(lastSavedAt);
    const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return <span className="flex items-center gap-1 text-[11px] text-gray-400"><Check size={11} />{hm} ì €ì¥ë¨</span>;
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
          <span className="text-xs px-1.5 py-0.5 rounded bg-violet-50 text-violet-500">ìë™</span>
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
      <CountRow key={t.key} label={t.label} sub={t.rate ? `ê±´ë‹¹ ${won(t.rate)}` : (t.point ? `${t.point}P` : '')}
        value={value} disabled={isAuto}
        onChange={isAuto ? undefined : (v) => onChange({ ...safeCounts, [t.key]: v })} />
    );
  });
}

/* v21.28: ì§ì› í™ˆ ì •ë¦¬ - ì „ì›”ëŒ€ë¹„ ê¸ˆì•¡/%, ì‹¤ì œ ìŠ¹ì¸ìƒíƒœ, ê¸‰ì—¬ìƒì„¸ ì œê±°, ì›”ëˆ„ì  ì¹´í…Œê³ ë¦¬ ë­í‚¹, ìš©ì–´ í†µì¼. */
/* v21.29: ì§ì› í™ˆ-ê°œì¸ í•˜ë‹¨ 'í™ˆ ìµœì†Œì¡°ê±´ ì¶©ì¡± ì•ˆë‚´' ì¹´ë“œ ì œê±°. */
/* v21.30: 'ë‚´ ì •ë³´ê°€ ì˜ëª»ëë‚˜ìš”?'ë¥¼ ê°œì¸ ìƒì„¸ í•˜ë‹¨ì—ì„œ í™ˆ-ê°œì¸ ìƒë‹¨ ë¡œê·¸ì¸ ì •ë³´ ì•„ë˜ ì˜ì—­ìœ¼ë¡œ ì´ë™. */
/* v21.31: í•˜ë‹¨ ë©”ë‰´ê°€ ì´ë¯¸ 'í™ˆ'ì´ë¯€ë¡œ í™ˆ ë‚´ë¶€ íƒ­ ëª…ì¹­ì„ 'ê°œì¸ / ë§¤ì¥'ìœ¼ë¡œ ê°„ì†Œí™”. */
/* v21.32: ì‹¤ì  ë°ì´í„° í•˜ìœ„í˜¸í™˜/ë²„ì „ê´€ë¦¬. êµ¬ë²„ì „ íŒë§¤ê±´ì„ í˜„ì¬ UIë¡œ ë³µì›í•˜ê³  ìˆ˜ì • ì‹œ ê¸°ì¡´ source_meta ë³´ì¡´. DB audit SQLê³¼ í•¨ê»˜ ì‚¬ìš©. */
/* v21.33: ì§ì› í™ˆ ìƒë‹¨ 'ë‚´ ì •ë³´ê°€ ì˜ëª»ëë‚˜ìš”? / ìˆ˜ì • ìš”ì²­í•˜ê¸°' ì œê±°. ê´€ë¦¬ì ì§ì ‘ ìˆ˜ì • ê¸°ëŠ¥ì€ ìœ ì§€. */
/* v21.34: í™ˆ ê²Œì„ìš”ì†ŒëŠ” ë°°ì§€ë§Œ ìœ ì§€. 100ê°œ ë°°ì§€/ëŒ€í‘œë°°ì§€ í”„ë¡œí•„í™”, ëª©í‘œ+ëˆ„ì ì‹¤ì  í†µí•©, ì›” ìˆœìœ„ 0ê±´ë„ ë‚´ ìˆœìœ„ ë° ê³µë™ìˆœìœ„ í‘œì‹œ. */
/* v21.35: ì›” ëˆ„ì  ìˆœìœ„ì—ì„œ ë¡œê·¸ì¸ ID/ì§ì› ID ë¶ˆì¼ì¹˜ ë˜ëŠ” ê²½ìŸí–‰ ëˆ„ë½ ì‹œì—ë„ í˜„ì¬ ì§ì›ì˜ 'ë‚˜' í–‰ì„ í•­ìƒ í‘œì‹œ. */
/* v21.36: í™ˆ-ë§¤ì¥ì˜ ëˆ„ì  í˜„í™©/ëª©í‘œ ë‹¬ì„±ë¥ ì„ 'ë§¤ì¥ ëª©í‘œ í˜„í™©' ë‹¨ì¼ ì¹´ë“œë¡œ í†µí•©. */
/* v21.37: í™ˆ-ë§¤ì¥ ì›” ëˆ„ì  ìˆœìœ„ëŠ” ì„ íƒ ì¹´í…Œê³ ë¦¬ ê¸°ì¤€ìœ¼ë¡œ ë§¤ì¥ ì „ì²´ ì¸ì›ì„ ëª¨ë‘ í‘œì‹œ. í˜„ì¬ ì§ì›ì€ í–‰ ê°•ì¡°. */
/* v21.38: êµ¬ UIì—ì„œ customer_sales ì—†ì´ daily_records ì§‘ê³„ë¡œë§Œ ë‚¨ì€ ëª¨ë°”ì¼ ì‹¤ì ì„ ê°ì§€í•´ 'ì´ì „ ë°©ì‹ ì…ë ¥ ì‹¤ì 'ë¡œ ë³„ë„ í‘œì‹œ/ìˆ˜ì •. í˜„ì¬ ê³ ê°ë³„ íŒë§¤ëŠ” ë³´ì¡´. */
/* v21.39: ê³ ê°ë³„ íŒë§¤ 0ê±´ì¸ë° ì¼ì¼ í•©ê³„ê°€ ì¡´ì¬í•˜ëŠ” êµ¬ë²„ì „ ë‚ ì§œë¥¼ ëª¨ë°”ì¼ ì™¸ í™ˆ/2ND/VAS/ì†Œë…¸ í¬í•¨ ì „ì²´ ë ˆê±°ì‹œ ì‹¤ì ìœ¼ë¡œ ê°ì§€Â·ë…¸ì¶œ. */
/* v21.42 FINAL INTEGRATION
   - v21.39 ì•ˆì „ë³¸ ê¸°ì¤€ ì¬í†µí•© (v21.40/41 ì†ìƒë³¸ ë¯¸ì‚¬ìš©)
   - ì¼ì¼ ë‹¬ë ¥: ë‚ ì§œë³„ HS / SIM MNP / í™ˆ í‘œì‹œ
   - ë¹ ë¥¸ ë“±ë¡ ë° ì €ì¥ë°©ì‹ê³¼ ë§ì§€ ì•ŠëŠ” ì•ˆë‚´ë¬¸ ì œê±°
   - ê´€ë¦¬ì ëŒ€ì‹œë³´ë“œ: ë§¤ì¥ ì„±ê³¼ ë‹¬ë ¥ + ë‚ ì§œë³„ ì§ì› ìƒì„¸
   - ì ì¥/ë¶€ì ì¥: ìê¸° ë§¤ì¥ ê³ ì •, ë‹´ë‹¹/íŒ€ì¥/ëŒ€í‘œ/ì‹¤ì¥/ì „ì²´ê´€ë¦¬ì: ì „ì²´ ë§¤ì¥ ë° ë§¤ì¥ ì„ íƒ
*/
/* v21.43: êµ¬ë²„ì „ ì§‘ê³„ë¥¼ 'ì´ë¦„ ì—†ìŒ' íŒë§¤ê±´ ë‹¨ìœ„ë¡œ ë¶„í•´. ëª¨ë°”ì¼ì€ ëª¨ë°”ì¼ ìˆ˜ì • UI, í™ˆì€ í™ˆ ìˆ˜ì • UIë¡œ ë³µì›í•˜ë©° ì €ì¥ ì‹œ êµ¬ì§‘ê³„ 1ê±´ì„ ì •ìƒ customer_sales/home_orders ë°ì´í„°ë¡œ ì „í™˜. */
/* v21.44: ì§ì›/ê´€ë¦¬ì ë‹¬ë ¥ ëª¨ë“  ë‚ ì§œì¹¸ì„ ë™ì¼í•œ ì •ì‚¬ê°í˜• í¬ê¸°ë¡œ ê³ ì •í•˜ê³  HS/SIM/í™ˆ 3ì¤„ ì˜ì—­ ë†’ì´ë„ í•­ìƒ ë™ì¼í•˜ê²Œ ì˜ˆì•½. */
/* v21.45: HS/SIM/í™ˆ ê°€ë…ì„±ì„ ìœ„í•´ ê°œì¸Â·ê´€ë¦¬ì ë‹¬ë ¥ ë‚ ì§œì¹¸ì„ ë™ì¼í•˜ê²Œ ì†Œí­ í™•ëŒ€(ëª¨ë°”ì¼ 58px, í° í™”ë©´ 64px ë†’ì´). 7ì—´ í­ì€ ìœ ì§€í•´ ê°€ë¡œ ë„˜ì¹¨ ë°©ì§€. */
/* v21.46:
   - êµ¬ë²„ì „ ëª¨ë°”ì¼ 1ê±´ ë³µì› ì‹œ ê¸°ì¡´ ì§‘ê³„ ì°¨ê° + ì‹ ê·œ íŒë§¤ ë°˜ì˜ì„ í•˜ë‚˜ì˜ í™•ì • ì¼ì¼ë°ì´í„°ë¡œ ì¦‰ì‹œ ì €ì¥í•˜ì—¬ 1ê±´â†’2ê±´ ì¤‘ë³µ ì§‘ê³„ ë°©ì§€
   - êµ¬ë²„ì „ í™ˆ ë³µì›ë„ ë³€í™˜ëœ ì¼ì¼ë°ì´í„°ë¥¼ ì¦‰ì‹œ ì €ì¥
   - home_orders ì‹ ê·œ product_type í—ˆìš© SQL ë³„ë„ ì œê³µ
*/
/* v21.47: ê°œì¸/ê´€ë¦¬ì ë‹¬ë ¥ HSÂ·SIM MNPÂ·í™ˆ ìš”ì•½ì„ í˜„í–‰ daily_records + êµ¬í˜• top-level ì €ì¥ í˜•ì‹ê¹Œì§€ í˜¸í™˜í•´ ê³„ì‚°. SIM í‘œê¸°ë¥¼ SIM MNPë¡œ í†µì¼. */
/* v21.48: ê´€ë¦¬ì•Œë¦¼ 'ê¸°íƒ€ ìŠ¹ì¸'ì„ 'ì‹¤ì  ìŠ¹ì¸ ëŒ€ê¸°'ë¡œ ë³€ê²½í•˜ê³  ì‹¤ì œ pending ì›” ì‹¤ì  ëª©ë¡/ìŠ¹ì¸/ë°˜ë ¤ í™”ë©´ ì—°ê²°. */
/* v21.49:
   - êµ¬ë²„ì „ ë³µì› ì €ì¥ë„ ë°˜ë“œì‹œ ìƒìœ„ saveDailyDayë¥¼ í†µê³¼ì‹œì¼œ dailyRecordsë¥¼ ì¦‰ì‹œ ê°±ì‹ 
   - ì¼ì¼ ì‹¤ì  ì €ì¥ ì™„ë£Œ í›„ mergedDraft/ìƒì‚°ì„±/ì˜ˆìƒê¸‰ì—¬ê°€ ì¦‰ì‹œ ì¬ê³„ì‚°
   - ì¼ë°˜ ì¼ì¼ ì €ì¥ë„ ì‹¤ì œ DB ì €ì¥ ì„±ê³µ í›„ì—ë§Œ 'ì €ì¥ë¨' í‘œì‹œ
*/
/* v21.50 PAY POLICY + SAFE RESET
   - 6ê°œì›” ë¯¸ë§Œ ì˜ì—… í™œë™ ì§€ì› ì •ì±… 230ë§Œì› ê³ ì •
   - 6~12ê°œì›” HS/SIM MNP/2ND ê±´ë‹¹ 20ë§Œì›, 12~24ê°œì›” 15ë§Œì›, 24ê°œì›” ì´ìƒ 10ë§Œì›, MAX 230ë§Œì›
   - ìµœì €ë³´ì¥ ë¹„êµ: ì˜ì—…í™œë™ì§€ì› + ìš”ê¸ˆì œ + VAS + 2ND + ìŠ¹ì¸ ëª¨ë°”ì¼ ìŠ¤íŒŸ + íŠ¹íŒëŒ€ì²´ + ì§ì±…ìˆ˜ë‹¹
   - ì„±ê³¼ë“±ê¸‰/í™ˆ/ì†Œë…¸/ë§ì¶¤ì œì•ˆ ë“±ì€ ìµœì €ë³´ì¥ ë¹„êµ í›„ ë³„ë„ ì¶”ê°€
   - ì§ì› í™ˆ ë©”ì¸ì€ 'í˜„ì¬ ì‹¤ì  ê¸°ì¤€ ê¸ˆì•¡', ë²„íŠ¼ìœ¼ë¡œ 'í˜„ì¬ ì‹¤ì  ê¸°ì¤€ ë§ˆê°ì‹œ ê¸ˆì•¡' í™•ì¸
   - ë³¸ì¸ ë‹¹ì›” ì‹¤ì  ì´ˆê¸°í™”: 2ë‹¨ê³„ í™•ì¸ + 'ë‹¹ì›”ì‹¤ì ì´ˆê¸°í™”' ì§ì ‘ ì…ë ¥ + DB ìë™ë°±ì—… RPC
*/
/* v21.51: ë‹¹ì›” ì‹¤ì  ì´ˆê¸°í™” ê¸°ëŠ¥ì„ ì§ì› ë‚´ì—­ í•˜ë‹¨ì—ì„œ ì¼ì¼ ì‹¤ì  ì…ë ¥ í™”ë©´ í•˜ë‹¨ 'ì‹¤ì  ê´€ë¦¬' ì˜ì—­ìœ¼ë¡œ ì´ë™. ê°œì¸/ê´€ë¦¬ì ë‹¬ë ¥ HSÂ·SIM MNPÂ·í™ˆ í‘œì‹œ ìœ ì§€. */
/* v21.52: ê´€ë¦¬ì ë§¤ì¥ ì •ë ¬ 1~13í˜¸ì  í†µì¼ + ì¸í„°ë„· ì¬ì•½ì • êµ¬ì¡°í™” ì…ë ¥/ìë™ ê³„ì‚°. */
/* v21.78: ë‚´ ì…ë ¥ ì‹¤ì  ìš”ì•½ì—ì„œ ì·¨ì†Œ í™ˆ ì œì™¸, ì„¤ì¹˜ì™„ë£Œ/ì„¤ì¹˜ëŒ€ê¸° ë¶„ë¦¬, ê°™ì€ ë‚ ì§œ+ê³ ê° í™ˆ ë¬¶ìŒì„ 1ê±´ìœ¼ë¡œ ê³„ì‚°. */
/* v21.77: v21.76 í™ˆ ì˜ˆìƒ ì¸ì„¼í‹°ë¸Œ ìœ ì§€ + ê´€ë¦¬ì ì˜ì—…ë¹„ìš©/ì˜¤í¼ ì¡°íšŒ ì˜¤ë¥˜ ê°€ì‹œí™”. sales_expenses RLS ë³´ì™„ SQL ë™ë´‰. ì „ì²´ ì—°ê²°ë¶€ íšŒê·€ì ê²€ ê¸°ì¤€ ì ìš©. */
/* v21.76: í™ˆ íŒë§¤ì¹´ë“œ ì˜ˆìƒ ì¸ì„¼í‹°ë¸Œ í‘œì‹œ ìˆ˜ì •. ì„¤ì¹˜ì˜ˆì • í¬í•¨ ì›” ì „ì²´ í™ˆ ì…ë ¥ìœ¼ë¡œ ì˜ˆìƒ ê·¸ë ˆì´ë“œ/ë‹¨ë…/TVí”„ë¦¬/ìŠ¤ë§ˆíŠ¸í™ˆ/ë™ì‹œíŒë§¤ë¥¼ ê³„ì‚°í•˜ë˜ ì‹¤ì œ ê¸‰ì—¬Â·ì •ì‚°ì€ completedë§Œ ë°˜ì˜. ê´€ë ¨ ê²½ë¡œ íšŒê·€ì ê²€. */
/* v21.75: ê´€ë¦¬ì ìˆ˜ë™ ë°°ì§€/ì¸ì • ë©”ë‰´ ì œê±°. ì ì¥ PICKâ†’ì„±ì¥ì™•(ì›” í›„ë°˜ HS ì¼í‰ê·  30%â†‘), íŒ€í”Œë ˆì´ì–´â†’ì˜¬ë¼ìš´ë“œ ì„¸ì¼ì¦ˆ(HSÂ·í™ˆÂ·í”„ë¦¬Â·ìŠ¤í™ˆÂ·2ND ëª¨ë‘ íŒë§¤), ë¯¸ì†Œ MVPâ†’HSÂ·í™ˆÂ·ìƒì‚°ì„± ì¢…í•©ìˆœìœ„ 1ìœ„ ìë™ ë¶€ì—¬. */
/* v21.74: ì¤‘ê³  MNP 61êµ°â†‘ ê²°í•© ì¸ì„¼í‹°ë¸Œë¥¼ ë‚´ì—­ì—ì„œ 'ì¤‘ê³  MNP ê²°í•© ìˆ˜ìˆ˜ë£Œ'ë¡œ ë…ë¦½ ë¶„ë¦¬. ëª¨ë°”ì¼ ê´€ë ¨ ìˆ˜ìˆ˜ë£Œ ì„¸ë¶€/í•©ê³„ì— í‘œì‹œí•˜ë˜ ì´ ê¸‰ì—¬ì—ëŠ” ê¸°ì¡´ mnpBundlePayë¥¼ ì¤‘ë³µ ê°€ì‚°í•˜ì§€ ì•ŠìŒ. */
/* v21.73: ë‚´ ì…ë ¥ ì‹¤ì  ìš”ì•½ ì˜¤ë¥˜ ìˆ˜ì •(homeProductLabel undefined ì œê±°). í™ˆ ìƒí’ˆ ë¯¸ë“±ë¡ ë¼ë²¨ë„ ì•ˆì „í•˜ê²Œ í‘œì‹œí•˜ì—¬ ëª¨ë°”ì¼/VAS/2ND/í™ˆ ì§‘ê³„ ì „ì²´ê°€ ì¤‘ë‹¨ë˜ì§€ ì•Šë„ë¡ ìˆ˜ì •. */
/* v21.72: ë‚´ ì…ë ¥ ì‹¤ì  ìš”ì•½ ì§ì› ID ì—°ê²° ìˆ˜ì •(auth UUID ëŒ€ì‹  ì‹¤ì œ employee ID ìš°ì„ ), ì¡°íšŒ ì˜¤ë¥˜ í‘œì‹œ ì¶”ê°€. */
/* v21.71: ì§ì› ë‚´ì—­ ìƒë‹¨ 'ë‚´ ì…ë ¥ ì‹¤ì  ìš”ì•½' ì¶”ê°€(ëª¨ë°”ì¼/VAS/2ND/í™ˆ ì›” ëˆ„ì ), ê³ ê°ê´€ë¦¬ í™ˆ ì„¤ì¹˜Â·ê°œí†µ ì§„í–‰ê´€ë¦¬ í•­ìƒ í¼ì¹¨. */
/* v21.70: ê´€ë¦¬ì íŒë§¤ í€„ë¦¬í‹° ë°±ì§€í™” ìˆ˜ì •. 0ê±´/ë¹ˆ ë§¤ì¥/ì¡°íšŒ ì˜¤ë¥˜ ì‹œì—ë„ ì•ˆì „í•˜ê²Œ 0% ì§€í‘œë¥¼ ë Œë”ë§. */
/* v21.69: SIM MNP(ì„ ì•½) 61êµ° ì´ìƒì—ì„œ ì¤‘ê³  MNP ê²°í•© ì¸ì„¼í‹°ë¸Œ(+10ë§Œì›) ì„ íƒ UI ë³µêµ¬ ë° ì €ì¥ ì¡°ê±´ ë³´í˜¸. */
/* v21.68: íŒë§¤ í€„ë¦¬í‹° ë³´ì¡°ì§€í‘œ(ê°œì¸/ë§¤ì¥/ì§ì›), HS ëŒ€ë¹„ ë§¤ì¶œì§€í‘œ, ì „ëµìš”ê¸ˆì œ ì²´í¬, í°ì•ˆì‹¬íŒ¨ìŠ¤(0ì›Â·ë³´í—˜ 0.8P), ê´€ë¦¬ì ì˜ì—…ë¹„ìš©/ì˜¤í¼ ì¡°íšŒ. */
/* v21.67: ê´€ë¦¬ì í™ˆ ì¼€ì–´ í™”ë©´ì˜ internet1g/internet500/internet100 ë° ë™ì‹œíŒë§¤ ë‚´ë¶€í‚¤ë¥¼ í•œê¸€ ìƒí’ˆëª…ìœ¼ë¡œ í‘œì‹œ. */
/* v21.66: ê³ ê°ë³„ íŒë§¤ë‚´ì—­ í•µì‹¬ìƒí’ˆ ê¸°ì¤€ ë¬¶ìŒ. ê°™ì€ ê³ ê°ì˜ í™ˆ ì„¸ë¶€í•­ëª©ì€ í™ˆ 1ê±´ìœ¼ë¡œ í‘œì‹œí•˜ê³  ì¸ì„¼í‹°ë¸Œë„ 1íšŒë§Œ í‘œì‹œ. ì¼ì ê±´ìˆ˜ë„ HS/ì¸í„°ë„· í•µì‹¬ íŒë§¤ê±´ ê¸°ì¤€. */
/* v21.65: ì˜¬ì¸ì› í™ˆ(ë§êµ¬ë¶„ ìœ ì§€Â·ì¸ì„¼í‹°ë¸Œ0Â·ê·¸ë ˆì´ë“œ/ì„±ê³¼ ì¸ì •) + ì‹¤ì ì ê²€ ì „í™˜ + ì§ì› ë‚´ì—­ ì•„ì½”ë””ì–¸ ê°œí¸ + íŒë§¤ê±´ë³„ ì¸ì„¼í‹°ë¸Œ ì¦‰ì‹œ í‘œì‹œ. */
/* v21.64: í™ˆ ë™ì‹œíŒë§¤ ëª¨ìˆ˜ í‘œê¸° ê°•í™”. ê³ ê°ë³„ íŒë§¤ë‚´ì—­ì— í™ˆ+HS/ìŠ¤ë§ˆíŠ¸í™ˆ+HSë¥¼ ëª…ì‹œí•˜ê³  ì‹ ê·œ ì €ì¥ê±´ì—ëŠ” simulBaseë¥¼ ë³´ì¡´. */
/* v21.63: ìƒˆ í™ˆ ì¸ì„¼í‹°ë¸Œ ì •ì±…(ê°€ì •ë§/ì†Œí˜¸/ì†ë„/ê·¸ë ˆì´ë“œ/HSë™ì‹œ) ì ìš© + ê¸°ì¡´ ê³ ê°ë³„ í™ˆì‹¤ì  ìë™ ì¬ê³„ì‚° + ì •ì‚°ìƒë‹¨ í•­ëª©ë³„ ë¶„ë¦¬. */
/* v21.62: ì •ì‚° ê²€í†  ê³ ê°ë³„ ìƒì„¸ ì›ì¥ + RAW CSV schema-cache ì˜¤ë¥˜ ìˆ˜ì •. */
/* v21.61: íšŒì‚¬ ëª©í‘œì˜ HS/í™ˆ/ìƒì‚°ì„± ê¸°ì¤€ìˆ˜ëŸ‰ê³¼ í‰ê°€ ì—°ê²°, AAì„íŒ©íŠ¸ ëª©í‘œ ìë™ë°°ë¶„ ë° ê°€ê°ì  ìƒì„¸ í‘œì‹œ. */
/* v21.60: í‰ê°€ íƒ­ 1ì°¨ ë„ì… - ê°œì¸ ì»¤ë¦¬ì–´ ë“±ê¸‰ + ê´€ë¦¬ì í‰ê°€ + ê´€ë¦¬ì í™•ì¸ ì‹¤ì  ìµœì‹ í™” + AAì„íŒ©íŠ¸ ì›” ëª©í‘œ/ê°€ê°ì . */
/* ===================== ë©”ì¸ ì•± ===================== */

export default function App({ authUser, authProfile, onSignOut }) {
  const [role, setRole] = useState('employee');
  const [notificationOpen,setNotificationOpen]=useState(false);
  const [quickGuideOpen,setQuickGuideOpen]=useState(false);
  const quickGuideStorageKey=authUser?.id?`miso_quick_guide_v1:${authUser.id}`:'';
  useEffect(()=>{
    if(!quickGuideStorageKey)return;
    try{if(!localStorage.getItem(quickGuideStorageKey)){const timer=setTimeout(()=>setQuickGuideOpen(true),700);return()=>clearTimeout(timer)}}catch{/* ì €ì¥ê³µê°„ ì œí•œ ì‹œ ìë™ ì•ˆë‚´ë§Œ ìƒëµ */}
  },[quickGuideStorageKey]);
  const closeQuickGuide=()=>{setQuickGuideOpen(false);if(quickGuideStorageKey)try{localStorage.setItem(quickGuideStorageKey,'seen')}catch{/* ë‹¤ì‹œ í‘œì‹œë  ìˆ˜ ìˆìœ¼ë‚˜ ì•± ì‚¬ìš©ì—ëŠ” ì˜í–¥ ì—†ìŒ */}};
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
  const [storeAggregateDays,setStoreAggregateDays]=useState({}); // ì¼ë°˜ ì§ì›ìš©: ê°œì¸ ì‹ë³„ì •ë³´ê°€ ì œê±°ëœ ìš°ë¦¬ ë§¤ì¥ ì¼ë³„ í•©ê³„
  const [teamSalesCredits,setTeamSalesCredits]=useState([]); // ë‹´ë‹¹Â·ìš´ì˜ì§„ ì§€ì›íŒë§¤: ê°œì¸ ì œì™¸, ì„ íƒ ë§¤ì¥ íŒ€ ì‹¤ì  ì „ìš©
  const [dirty, setDirty] = useState(false);            // ì‹¤ì ì…ë ¥ íƒ­ì— ì €ì¥ ì•ˆ ëœ ë³€ê²½ì´ ìˆëŠ”ì§€
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [dbError, setDbError] = useState('');
  const [lockedMonths, setLockedMonths] = useState([]);
  const [policyBlockedMonths, setPolicyBlockedMonths] = useState([]);
  const [personalGoals, setPersonalGoals] = useState({}); // ë³¸ì¸ ì›” í•­ëª©ë³„ ëª©í‘œ
  const [employeeGoalMap, setEmployeeGoalMap] = useState({}); // ê´€ë¦¬ì ë²”ìœ„ ì§ì›ì˜ ì›” ê°œì¸ ëª©í‘œ
  const [employeeGoalsLoading, setEmployeeGoalsLoading] = useState(false);
  const [goalSaving, setGoalSaving] = useState(false);
  const [approvedMobileSpotMap, setApprovedMobileSpotMap] = useState({}); // { empId: approved mobile spot total }
  const [homePolicyMap, setHomePolicyMap] = useState({}); // { empId: ìƒˆ í™ˆ ì •ì±… ê³„ì‚° ê²°ê³¼ }
  const [cancelledLegacyHomeMap,setCancelledLegacyHomeMap]=useState({}); // customer_sales ì—†ëŠ” ì·¨ì†Œ í™ˆì˜ ì¼ì¼ ì”ì—¬ ì°¨ê°
  const [shadowLedgerMap, setShadowLedgerMap] = useState({}); // ê´€ë¦¬ììš© íŒë§¤ë³„ ê³„ì‚° ê²€ì¦, ì‹¤ì œ ê¸‰ì—¬ì—ëŠ” ë¯¸ë°˜ì˜
  const [strategicMetricMap, setStrategicMetricMap] = useState({}); // ì§ì› ì „ëµP ê¸‰ì—¬ ê°€ê° ê³„ì‚°ìš©
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

  // ëª¨ë°”ì¼ ì›¹ì•± ë’¤ë¡œê°€ê¸° ì œì–´
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
    { id: 'e01', name: 'ì–´ì§„ì„', branch: 'ì¥ê³¡ë™_ì¥ê³¡ì—­ì ', position: 'ì‚¬ì›', hireDate: '2026-08' },
    { id: 'e02', name: 'ì •ì¤€í¬', branch: 'ë³¸ì˜¤3ë™_ìƒë¡ìˆ˜ì—­ì ', position: 'ì‚¬ì›', hireDate: '2026-08' },
    { id: 'e03', name: 'ì •ì˜ì§„', branch: 'ê´‘ì •ë™_ì‚°ë³¸ì ', position: 'ì‚¬ì›', hireDate: '2026-08' },
    { id: 'e04', name: 'ê¹€ì°½ê¸°', branch: 'ì‹ ì²œë™_ì‚¼ë¯¸ì‹œì¥ì ', position: 'ì‚¬ì›', hireDate: '2026-07' },
    { id: 'e05', name: 'ì´í˜œì¸', branch: 'ëŒ€ì•¼ë™_ë¡¯ë°ë§ˆíŠ¸ì ', position: 'ì‚¬ì›', hireDate: '2026-07' },
    { id: 'e06', name: 'ë°•ë¯¼ì£¼', branch: 'ë³¸ì˜¤1ë™_ë³¸ì˜¤ì¤‘í•™êµì ', position: 'ì‚¬ì›', hireDate: '2026-07' },
    { id: 'e07', name: 'ê¹€ì •ì•„', branch: 'ë³¸ì˜¤3ë™_ìƒë¡ìˆ˜ì—­ì ', position: 'ì‚¬ì›', hireDate: '2026-06' },
    { id: 'e08', name: 'í—ˆì˜ì§„', branch: 'ì‹ ì²œë™_ì‚¼ë¯¸ì‹œì¥ì ', position: 'ì‚¬ì›', hireDate: '2026-04' },
    { id: 'e09', name: 'ì‹ ë‹¤í°', branch: 'ë³¸ì˜¤1ë™_ë³¸ì˜¤ì¤‘í•™êµì ', position: 'ì‚¬ì›', hireDate: '2026-04' },
    { id: 'e10', name: 'ê¶Œìœ ì§„', branch: 'ì‹ ì²œë™_ì‚¼ë¯¸ì‹œì¥2í˜¸ì ', position: 'ì‚¬ì›', hireDate: '2026-03' },
    { id: 'e11', name: 'ê¹€ì†Œì¸', branch: 'ë³¸ì˜¤3ë™_ì£¼ë¯¼ì„¼í„°ì ', position: 'ë§¤ë‹ˆì €', hireDate: '2026-03' },
    { id: 'e12', name: 'ì´ì„ ì˜', branch: 'ê´‘ì •ë™_ì‚°ë³¸ì ', position: 'ì‚¬ì›', hireDate: '2026-03' },
    { id: 'e13', name: 'ê¹€ë¯¼ì§€', branch: 'ì‹ ì²œë™_ì‚¼ë¯¸ì‹œì¥2í˜¸ì ', position: 'ë¶€ì ì¥', hireDate: '2026-01' },
    { id: 'e14', name: 'ë¬¸ìœ ë¹ˆ', branch: 'ë³¸ì˜¤3ë™_ìƒë¡ìˆ˜ì—­ì ', position: 'ì‚¬ì›', hireDate: '2026-01' },
    { id: 'e15', name: 'ì´ìˆ˜ì•„', branch: 'ë³¸ì˜¤3ë™_ì£¼ë¯¼ì„¼í„°ì ', position: 'ì‚¬ì›', hireDate: '2026-01' },
    { id: 'e16', name: 'ë°•ìœ¤ì„œ', branch: 'ì¥ê³¡ë™_ì¥ê³¡ì—­ì ', position: 'ì‚¬ì›', hireDate: '2026-01' },
    { id: 'e17', name: 'ìœ ì„±ë¯¼', branch: 'ê´‘ì •ë™_ì‚°ë³¸ì ', position: 'ë¶€ì ì¥', hireDate: '2026-01' },
    { id: 'e18', name: 'ê¹€ì˜ì¤‘', branch: 'ê³ ì”ë™_ë²•ì¡°íƒ€ìš´ì ', position: 'ì‚¬ì›', hireDate: '2026-01' },
    { id: 'e19', name: 'ê¹€ìœ¤ì„', branch: 'ì›”ê³¶ë™_ì›”ê³¶ì ', position: 'ë¶€ì ì¥', hireDate: '2025-11' },
    { id: 'e20', name: 'ê¹€ì¹˜í˜„', branch: 'ê´‘ì •ë™_ì‚°ë³¸ì ', position: 'ë§¤ë‹ˆì €', hireDate: '2025-07' },
    { id: 'e21', name: 'ë°•ì„±ë¯¼', branch: 'ë³¸ì˜¤1ë™_ë³¸ì˜¤ì¤‘í•™êµì ', position: 'ë¶€ì ì¥', hireDate: '2025-06' },
    { id: 'e22', name: 'ì†¡ë‚™ê²½', branch: 'ì‹ ì²œë™_ì‚¼ë¯¸ì‹œì¥ì ', position: 'ë¶€ì ì¥', hireDate: '2025-04' },
    { id: 'e23', name: 'ê¹€ì£¼ë¹ˆ', branch: 'ëŒ€ì•¼ë™_ë¡¯ë°ë§ˆíŠ¸ì ', position: 'ì‚¬ì›', hireDate: '2025-04' },
    { id: 'e24', name: 'í•˜ìœ¤ì‹', branch: 'ë³¸ì˜¤3ë™_ì£¼ë¯¼ì„¼í„°ì ', position: 'ë¶€ì ì¥', hireDate: '2025-04' },
    { id: 'e25', name: 'ì´ì„êµ¬', branch: 'ê±°ëª¨ë™_ë„ì¼ì‹œì¥ì ', position: 'ì‚¬ì›', hireDate: '2025-04' },
    { id: 'e26', name: 'ìµœì¬í˜', branch: 'ê´‘ì •ë™_ì‚°ë³¸ì ', position: 'ë¶€ì ì¥', hireDate: '2025-04' },
    { id: 'e27', name: 'ê¹€ë„ê²½', branch: 'ì€í–‰ë™_ì€ê³„ì‚¬ê±°ë¦¬ì ', position: 'ì‚¬ì›', hireDate: '2025-04' },
    { id: 'e28', name: 'ê¶Œì„¸ë¯¼', branch: 'ê±°ëª¨ë™_ë„ì¼ì‹œì¥ì ', position: 'ì‚¬ì›', hireDate: '2025-03' },
    { id: 'e29', name: 'ë°•ì„í˜„', branch: 'ê±°ëª¨ë™_ë„ì¼ì‹œì¥ì ', position: 'ë¶€ì ì¥', hireDate: '2025-02' },
    { id: 'e30', name: 'ì´ë¯¼ìš°', branch: 'ì¥ê³¡ë™_ì¥ê³¡ì—­ì ', position: 'ì ì¥', hireDate: '2024-11' },
    { id: 'e31', name: 'ì‹ ë™ê¸¸', branch: 'ê³ ì”ë™_ë²•ì¡°íƒ€ìš´ì ', position: 'ë§¤ë‹ˆì €', hireDate: '2024-10' },
    { id: 'e32', name: 'ì´ìœ ë¯¼', branch: 'ê³ ì”ë™_ë²•ì¡°íƒ€ìš´ì ', position: 'ì‚¬ì›', hireDate: '2024-09' },
    { id: 'e33', name: 'ê¹€ì •ì€', branch: 'ë³¸ì˜¤3ë™_ìƒë¡ìˆ˜ì—­ì ', position: 'ë¶€ì ì¥', hireDate: '2024-08' },
    { id: 'e34', name: 'ë°•ë‹¤ì—°', branch: 'ê´‘ì •ë™_ì‚°ë³¸ì ', position: 'ì‚¬ì›', hireDate: '2024-07' },
    { id: 'e35', name: 'ì„œê±´ì£¼', branch: 'ì‹ ì²œë™_ì‚¼ë¯¸ì‹œì¥2í˜¸ì ', position: 'ë§¤ë‹ˆì €', hireDate: '2024-01' },
    { id: 'e36', name: 'ë°•ë¯¼ê²½', branch: 'ëŒ€ì•¼ë™_ë¡¯ë°ë§ˆíŠ¸ì ', position: 'ë¶€ì ì¥', hireDate: '2023-12' },
    { id: 'e37', name: 'ìµœì¬ì›', branch: 'ì‹ ì²œë™_ì‚¼ë¯¸ì‹œì¥ì ', position: 'ì ì¥', hireDate: '2023-09' },
    { id: 'e38', name: 'ì„ì§€í˜œ', branch: 'ê±°ëª¨ë™_ë„ì¼ì‹œì¥ì ', position: 'ì ì¥', hireDate: '2020-10' },
    { id: 'e42', name: 'ê¹€ì†Œì›', branch: 'ì›”í”¼ë™_ì„±í¬ì—­ì ', position: 'ì ì¥', hireDate: '2020-10' },
    { id: 'e39', name: 'ì£¼ì •ë¯¼', branch: 'ë³¸ì˜¤3ë™_ìƒë¡ìˆ˜ì—­ì ', position: 'ì ì¥', hireDate: '2020-06' },
    { id: 'e40', name: 'ì „ë¯¼í˜', branch: 'ì€í–‰ë™_ì€ê³„ì‚¬ê±°ë¦¬ì ', position: 'ë¶€ì ì¥', hireDate: '2017-06' },
    { id: 'e41', name: 'í™©ì„±íœ˜', branch: 'ì›”ê³¶ë™_ì›”ê³¶ì ', position: 'ì ì¥', hireDate: '2017-06' },
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
      // í˜„ì¬ ì§„ì…ì ì„ ì•±ì˜ ë£¨íŠ¸ ìƒíƒœë¡œ ë§Œë“¤ê³ , ë£¨íŠ¸ ì•ì— í•œ ì¹¸ì˜ ë³´í˜¸ íˆìŠ¤í† ë¦¬ë¥¼ ë‘¡ë‹ˆë‹¤.
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

        // ë£¨íŠ¸ í™”ë©´ì—ì„œ ë’¤ë¡œê°€ê¸°ë¥¼ ëˆ„ë¥¸ ê²½ìš°: ì²« ë²ˆì€ ì•ˆë‚´, 2ì´ˆ ì•ˆì— ë‹¤ì‹œ ëˆ„ë¥´ë©´ ì•±/í˜ì´ì§€ë¥¼ ë‚˜ê°‘ë‹ˆë‹¤.
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

      // ì˜ˆì™¸ì ìœ¼ë¡œ ì•± íˆìŠ¤í† ë¦¬ ë°”ê¹¥ê¹Œì§€ ì´ë™í•œ ê²½ìš°ì—ë„ ì²« ë’¤ë¡œê°€ê¸°ëŠ” ë³´í˜¸í•©ë‹ˆë‹¤.
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
    } catch (e) { console.error('STORES SAVE ERROR:', e); setDbError(`ë§¤ì¥ ëª©ë¡ ì €ì¥ ì‹¤íŒ¨: ${friendlyError(e)}`); }
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
    } catch (e) { console.error('MONTH LOCK SAVE ERROR:', e); setDbError(`ì›” ë§ˆê° ì„¤ì • ì‹¤íŒ¨: ${friendlyError(e)}`); }
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
      const ok=await showAppConfirm({title:`${monthLabel(targetMonth)} ì…ë ¥ì„ ì‹œì‘í• ê¹Œìš”?`,message:'ì§€ê¸‰ê¸°ì¤€ ì •ì±… ìˆ˜ì •ê³¼ ê²€ì¦ì´ ëª¨ë‘ ëë‚œ ê²½ìš°ì—ë§Œ ì…ë ¥ì„ ì—´ì–´ì£¼ì„¸ìš”.',confirmLabel:'ì…ë ¥ ì‹œì‘'});
      if(!ok)return;
    }
    const next=block?[...new Set([...policyBlockedMonths,targetMonth])]:policyBlockedMonths.filter(m=>m!==targetMonth);
    const {error}=await supabase.from('app_config').upsert({config_key:'policy_blocked_months',value:next},{onConflict:'config_key'});
    if(error){setDbError(`ì •ì±… ì¤€ë¹„ ì ê¸ˆ ì €ì¥ ì‹¤íŒ¨: ${friendlyError(error)}`);return;}
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
      setDbError(`ì´ë²ˆ ë‹¬ ëª©í‘œ ì €ì¥ ì‹¤íŒ¨: ${friendlyError(error)}`);
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
      .eq('active', true)
      .order('name', { ascending: true });

    if (error) {
      console.error('PROFILES LOAD ERROR:', error);
      setDbError(`ì§ì› ì •ë³´ ë¶ˆëŸ¬ì˜¤ê¸° ì‹¤íŒ¨: ${friendlyError(error)}`);
      return [];
    }

    let lastSignInMap = {};
    try {
      const { data: signIns, error: siErr } = await supabase.rpc('get_last_sign_ins');
      if (!siErr && signIns) lastSignInMap = Object.fromEntries(signIns.map((s) => [s.id, s.last_sign_in_at]));
    } catch (e) { /* ë§¤ë‹ˆì € ì´í•˜ ê¶Œí•œì´ë©´ ë¹ˆ ê°’, ë¬´ì‹œ */ }

    const list = (data || []).map((p) => ({
      id: p.id,
      name: p.name || (p.id === authUser.id ? (authUser.email || 'ë‚´ ê³„ì •') : 'ì´ë¦„ ë¯¸ì„¤ì •'),
      branch: p.store_name || 'ë¯¸ì§€ì •',
      storeScope: Array.isArray(p.store_scope) ? p.store_scope : [],
      position: p.position || 'ì‚¬ì›',
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
      setDbError(`ì›”ë³„ ìƒíƒœ ë¶ˆëŸ¬ì˜¤ê¸° ì‹¤íŒ¨: ${friendlyError(error)}`);
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
      setDbError(`ì¼ì¼ ì‹¤ì  ë¶ˆëŸ¬ì˜¤ê¸° ì‹¤íŒ¨: ${friendlyError(error)}`);
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
      supabase.from('home_orders')
        .select('id,user_id,customer_id,customer_name,product_type,network_type,sale_type,main_tv_plan,status,source_work_date,source_group,source_key,actual_install_date')
        .in('user_id',ids).or(`source_work_date.gte.${m}-01,actual_install_date.gte.${m}-01`),
      supabase.from('customer_sales').select('source_ref').eq('source_type','home_order').in('user_id',ids).gte('sale_date',`${m}-01`).lt('sale_date',to),
    ]);
    const {data,error}=orderRes;
    if(error){console.error('HOME POLICY LOAD ERROR',error);setHomePolicyMap({});setCancelledLegacyHomeMap({});return;}
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
      const userOrders=homeOrdersForMonth((data||[]).filter(o=>o.user_id===id),m,'completed');
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
      if(sale.source_meta?.teamOnly)return;
      const row=mapped[sale.user_id]||(mapped[sale.user_id]={totalSales:0,snapshotSales:0,missingSnapshots:0,shadowMobilePay:0,performancePoints:0,insurancePoints:0,details:[]});
      row.totalSales+=1;
      if(!sale.source_meta?.policySnapshot){row.missingSnapshots+=1;return;}
      const result=calculateMobileSale(sale,currentPolicySnapshot(config));
      row.snapshotSales+=1;
      row.shadowMobilePay+=Number(result.paid.plan||0)+Number(result.paid.vas||0)+Number(result.paid.insurance||0)+Number(result.paid.second||0);
      row.performancePoints+=Number(result.performancePoints||0);
      row.insurancePoints+=Number(result.insurancePoints||0);
      row.details.push({id:sale.id,date:sale.sale_date,customer:sale.customers?.customer_name||'ê³ ê°ëª… ì—†ìŒ',label:sale.metric_label||'ëª¨ë°”ì¼',...result});
    });
    setShadowLedgerMap(mapped);
    const strategicMapped={};
    ids.forEach(id=>{strategicMapped[id]=summarizeVasQuality((data||[]).filter(sale=>sale.user_id===id&&!sale.source_meta?.teamOnly));});
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
      setDbError(`ì¼ì¼ ì‹¤ì  ì €ì¥ ì‹¤íŒ¨: ${friendlyError(error)}`);
      return false;
    }

    return true;
  };

  useEffect(() => { loadConfig(); }, [loadConfig]);
  useEffect(() => { loadStores(); }, [loadStores]);
  useEffect(() => { loadLockedMonths(); }, [loadLockedMonths]);
  useEffect(() => { loadPolicyBlockedMonths(); }, [loadPolicyBlockedMonths]);
  useEffect(() => { loadPersonalGoals(); }, [loadPersonalGoals]);
  useEffect(() => { loadScopedEmployeeGoals(); }, [loadScopedEmployeeGoals]);

  useEffect(() => {
    if (!authUser) return;
    (async () => {
      // Supabase Authì˜ last_sign_in_atì€ ê¸°ì¡´ ì„¸ì…˜ìœ¼ë¡œ ì•±ë§Œ ë‹¤ì‹œ ì—´ë©´ ë°”ë€Œì§€ ì•ŠìŠµë‹ˆë‹¤.
      // ì‹¤ì œ ì•± ì ‘ì† ì‹œê°ì„ ë¨¼ì € ê¸°ë¡í•œ ë’¤ ì§ì› ëª©ë¡ì„ ë¶ˆëŸ¬ì˜µë‹ˆë‹¤.
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
  // í™ˆ ê³ ê°ë³„ ì €ì¥/ìˆ˜ì •ìœ¼ë¡œ ì¼ì¼ ì‹¤ì ì´ ë°”ë€Œë©´ ìƒˆ ì •ì±… ê¸ˆì•¡ë„ ë‹¤ì‹œ ê³„ì‚°í•©ë‹ˆë‹¤.
  useEffect(() => { if (employees.length) loadHomePolicies(month, employees); }, [dailyRecords]); // eslint-disable-line
  useEffect(() => { if (employees.length) loadTeamSalesCredits(month); }, [dailyRecords]); // eslint-disable-line
  // íŒë§¤ ì €ì¥Â·ìˆ˜ì •Â·ì‚­ì œë¡œ ì¼ì¼ ì§‘ê³„ê°€ ë°”ë€Œë©´ ê´€ë¦¬ì ê·¸ë¦¼ì ì›ì¥ë„ ì¦‰ì‹œ ë‹¤ì‹œ ë¶ˆëŸ¬ì˜µë‹ˆë‹¤.
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
    setDirty(false); // ì„œë²„ì—ì„œ ë§‰ ë¶ˆëŸ¬ì˜¨ ìƒíƒœì´ë¯€ë¡œ ë¯¸ì €ì¥ ë³€ê²½ ì•„ë‹˜
  }, [monthRecords, empId]);

  const persistConfig = async (next) => {
    if(isPolicyConfigReadOnly(month)){
      showLegacyAlert(`${monthLabel(month)} ì§€ê¸‰ì •ì±…ì€ í™•ì • ì´ë ¥ìœ¼ë¡œ ë³´ì¡´ë˜ì–´ í™”ë©´ì—ì„œ ì§ì ‘ ë®ì–´ì“¸ ìˆ˜ ì—†ì–´ìš”.`);
      return;
    }
    setConfig(next);
    try {
      const { error } = await supabase.from('app_config').upsert({ config_key: 'config', value: next }, { onConflict: 'config_key' });
      if (error) throw error;
    } catch (e) { console.error('CONFIG SAVE ERROR:', e); setDbError(`ì§€ê¸‰ê¸°ì¤€ ì €ì¥ ì‹¤íŒ¨: ${friendlyError(e)}`); }
  };
  const persistEmployees = async (next) => {
    setEmployees(next);
    return next;
  };

  const addEmployee = async () => {
    showLegacyAlert('ì§ì› ê³„ì • ìƒì„±ì€ í˜„ì¬ Supabase Authentication â†’ Usersì—ì„œ ë¨¼ì € ìƒì„±í•´ì£¼ì„¸ìš”. ë‹¤ìŒ ë‹¨ê³„ì—ì„œ ê´€ë¦¬ì í™”ë©´ì˜ ì§ì› ì´ˆëŒ€ ê¸°ëŠ¥ìœ¼ë¡œ ì—°ê²°í•  ì˜ˆì •ì…ë‹ˆë‹¤.');
  };

  const updateEmployee = async (id, patch) => {
    const dbPatch = {};
    if (Object.prototype.hasOwnProperty.call(patch, 'name')) dbPatch.name = patch.name;
    if (Object.prototype.hasOwnProperty.call(patch, 'branch')) dbPatch.store_name = patch.branch;
    if (Object.prototype.hasOwnProperty.call(patch, 'position')) dbPatch.position = patch.position;
    if (Object.prototype.hasOwnProperty.call(patch, 'hireDate')) dbPatch.hire_date = patch.hireDate;

    const { error } = await supabase.from('profiles').update(dbPatch).eq('id', id);
    if (error) {
      setDbError(`ì§ì› ì •ë³´ ìˆ˜ì • ì‹¤íŒ¨: ${friendlyError(error)}`);
      return;
    }
    setEmployees((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  const removeEmployee = async (id) => {
    setDbError('');
    const { error } = await supabase.from('profiles').update({ active: false }).eq('id', id);
    if (error) {
      console.error('EMPLOYEE DEACTIVATE ERROR:', error);
      setDbError(`ì§ì› ë¹„í™œì„±í™” ì‹¤íŒ¨: ${friendlyError(error)}`);
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
      setDbError(`ì›”ë³„ ìƒíƒœ ì €ì¥ ì‹¤íŒ¨: ${friendlyError(error)}`);
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

  // ì‹¤ì ì…ë ¥ íƒ­ ë³€ê²½ì„ í‘œì‹œë§Œ í•´ë‘ê³ , ì•„ë˜ ìë™ì €ì¥ íƒ€ì´ë¨¸ê°€ ì‹¤ì œ ì €ì¥ì„ ë§¡ìŒ
  const updateDraft = (next) => {
    if (lockedMonths.includes(month) || policyBlockedMonths.includes(month)) return;
    setDraft(next);
    setDirty(true);
  };

  // ìë™ì €ì¥ â€” ë§ˆì§€ë§‰ ì…ë ¥ í›„ 1.2ì´ˆ ë™ì•ˆ ì¡°ìš©í•˜ë©´ ì €ì¥
  const draftRef = useRef(draft);
  draftRef.current = draft;
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => { saveDraft(draftRef.current); }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, dirty]);

  // ì €ì¥ì´ ëë‚˜ê¸° ì „ì— ì°½ì„ ë‹«ìœ¼ë ¤ í•˜ë©´ ë¸Œë¼ìš°ì € ê²½ê³ 
  useEffect(() => {
    if (!dirty) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  // ì›”/ì§ì›ì„ ë°”ê¾¸ê¸° ì§ì „ì— ë‚¨ì•„ ìˆëŠ” ë³€ê²½ì„ ì›ë˜ ì¹¸ì— ë¨¼ì € ì €ì¥ (ìë™ì €ì¥ íƒ€ì´ë¨¸ê°€ ëœ¨ê¸° ì „ì´ì–´ë„ ì•ˆì „)
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
      setDbError(`ìŠ¹ì¸ ì €ì¥ ì‹¤íŒ¨: ${friendlyError(error)}`);
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
      setDbError(`ë°˜ë ¤ ì €ì¥ ì‹¤íŒ¨: ${friendlyError(error)}`);
      return;
    }

    setMonthRecords((prev) => ({ ...prev, [id]: next }));
  };

  const effectiveDailyRecords=useMemo(()=>Object.fromEntries(employees.map(e=>[
    e.id,applyCancelledLegacyHomeAdjustments(dailyRecords[e.id],cancelledLegacyHomeMap[e.id])
  ])),[employees,dailyRecords,cancelledLegacyHomeMap]);

  const rows = employees.map((e) => {
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

  // ê¶Œí•œë³„ ì¡°íšŒ ë²”ìœ„
  // - ì¼ë°˜ ì§ì›/ë§¤ë‹ˆì €: ë³¸ì¸ë§Œ
  // - ì ì¥/ë¶€ì ì¥: ë³¸ì¸ ë§¤ì¥
  // - ë‹´ë‹¹: ì „ì²´
  // - ì „ì²´ ê´€ë¦¬ì: ì „ì²´
  const loginEmp = employees.find((e) => e.id === authUser?.id);
  const isFullAdmin = authProfile?.role === 'admin';
  const isHQManager = ['ë‹´ë‹¹','íŒ€ì¥','ëŒ€í‘œ','ì‹¤ì¥'].includes(loginEmp?.position);
  const isStoreLeader = ['ì ì¥', 'ë¶€ì ì¥'].includes(loginEmp?.position);
  const canViewStoreMemberRows=isFullAdmin||isHQManager||isStoreLeader;

  useEffect(()=>{
    let alive=true;
    if(!authUser?.id||!loginEmp?.branch||canViewStoreMemberRows){setStoreAggregateDays({});return()=>{alive=false};}
    supabase.rpc('get_my_store_performance_days',{p_month:month}).then(({data,error})=>{
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

  const loginName=String(loginEmp?.name||'').trim();
  const loginAreaKey=SALES_MANAGER_AREAS[loginName];
  const scopedEmployees = COMPANY_SCOPE_VIEWERS.has(loginName)
    ? employees
    : NON_EXECUTIVE_COMPANY_CONTROLLERS.has(loginName)
      ? employees.filter((e)=>!COMPANY_SCOPE_VIEWERS.has(String(e.name||'').trim()))
    : loginAreaKey
      ? employees.filter((e)=>e.id===authUser?.id||SALES_AREA_STORES[loginAreaKey]?.includes(e.branch))
    : isStoreLeader
      ? employees.filter((e) => e.branch === loginEmp?.branch)
      : employees.filter((e) => e.id === authUser?.id);

  useEffect(() => {
    if (!scopedEmployees.length) return;
    if (!scopedEmployees.some((e) => e.id === empId)) {
      setEmpId(scopedEmployees[0].id);
    }
  }, [scopedEmployees, empId]);

  const myMergedBase = applyDailyToDraft(draft, effectiveDailyRecords[empId], month, config.categoryMap, config.gibyeonColumnMap);
  const myMergedDraft = {...myMergedBase,homePolicy:homePolicyMap[empId]||null};
  const myPay = computePay(myMergedDraft, currentEmp?.position || 'ì‚¬ì›', currentEmp?.hireDate, month, config, approvedMobileSpotMap[empId]||0, strategicMetricMap[empId]);
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
    const supportPay=computePay(supportDraft,'ê¸°íƒ€',null,month,config,0,null);
    return {id:`team-support:${branch}`,name:'ì§€ì› íŒë§¤',branch,position:'ê¸°íƒ€',hireDate:null,status:'approved',draft:supportDraft,pay:{...supportPay,total:0,closingAmount:0,guaranteedComponent:0},teamOnly:true};
  });
  // ì˜ì—… ì¡°ì§ì´ ì•„ë‹Œ ì¸ì›(ìš´ì˜ì§„Â·ì˜ì—…ì§€ì›íŒ€ ë“±)ì€ ì‹¤ì í‘œ/ì‹¤ì ë¹„êµì—ì„œ ì œì™¸
  // 'ê¸°íƒ€' ì§ê¸‰(ëŒ€ë¦¬ì…ë ¥ìš© ë§¤ì¥ ì‹¤ì  ê³„ì •)ì€ ê±´ìˆ˜Â·ì„±ê³¼ë“±ê¸‰PëŠ” ìœ ì§€í•˜ë˜ ì¸ì„¼í‹°ë¸Œ ê¸ˆì•¡ì€ 0ìœ¼ë¡œ í‘œì‹œ(ê°œì¸ ì§€ê¸‰ ì—†ìŒ)
  const salesRows = [...rows,...teamCreditRows]
    .filter((r) => !NON_SALES_STORES.includes(r.branch))
    .map((r) => (r.position === 'ê¸°íƒ€' ? { ...r, pay: { ...r.pay, total: 0, guaranteedComponent: 0 } } : r));
  const scopedIds = new Set(scopedEmployees.map((e) => e.id));
  const scopedRows = rows.filter((r) => scopedIds.has(r.id));
  const scopedBranches=new Set(scopedEmployees.map(employee=>employee.branch));
  const scopedSalesRows = salesRows.filter((r) => scopedIds.has(r.id)||(r.teamOnly&&scopedBranches.has(r.branch)));

  const totalPay = scopedSalesRows.reduce((s, r) => s + r.pay.total, 0);
  const pendingCount = scopedRows.filter((r) => r.status === 'pending').length;

  // í™ˆ í™”ë©´ ë­í‚¹ìš© â€” ë³¸ì¸ì´ ì˜ì—… ì¡°ì§ ì†Œì†ì¼ ë•Œë§Œ ìˆœìœ„ ê³„ì‚°
  // ì§€ì› íŒë§¤ëŠ” ë§¤ì¥ í•©ê³„ì—ëŠ” ë“¤ì–´ê°€ì§€ë§Œ ê°€ìƒì˜ ê°œì¸/ì§ì›ìœ¼ë¡œ ìˆœìœ„ì— ë…¸ì¶œí•˜ì§€ ì•ŠìŠµë‹ˆë‹¤.
  const personalSalesRows=salesRows.filter((r)=>!r.teamOnly);
  const storeAggregateDraft=applyDailyToDraft(emptyDraft(),storeAggregateDays,month,config.categoryMap,config.gibyeonColumnMap);
  const storeAggregatePay=computePay(storeAggregateDraft,'ê¸°íƒ€',null,month,config,0,null);
  const anonymousStoreRow={id:'my-store-aggregate',name:'ìš°ë¦¬ ë§¤ì¥ í•©ê³„',branch:loginEmp?.branch||currentEmp?.branch||'',position:'ê¸°íƒ€',draft:storeAggregateDraft,pay:{...storeAggregatePay,total:0,closingAmount:0,guaranteedComponent:0},storeAggregate:true};
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
            ì•±ì„ ë‚˜ê°€ë ¤ë©´ ë’¤ë¡œê°€ê¸°ë¥¼ í•œ ë²ˆ ë” ëˆŒëŸ¬ì£¼ì„¸ìš”
          </div>
        </div>
      )}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center"><Trophy size={18} className="text-white" /></div>
            <div>
              <div className="font-bold text-gray-900 leading-tight">ë¯¸ì†Œí˜ì´</div>
              <div className="text-[11px] text-gray-400 leading-tight">2026ë…„ MSì§êµ° ìˆ˜ìˆ˜ë£Œ ì •ì±… ë°˜ì˜</div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              <button onClick={() => setRole('employee')} className={`px-3 py-1.5 rounded-md text-sm font-medium ${role === 'employee' ? 'bg-white shadow text-violet-700' : 'text-gray-500'}`}>ì§ì›</button>
              {['manager', 'admin'].includes(authProfile?.role) && (
                <button onClick={() => setRole('admin')} className={`px-3 py-1.5 rounded-md text-sm font-medium ${role === 'admin' ? 'bg-white shadow text-violet-700' : 'text-gray-500'}`}>ê´€ë¦¬ì</button>
              )}
            </div>
            <div className="hidden sm:block text-right leading-tight">
              <div className="text-xs font-semibold text-gray-700">{authProfile?.name || authUser?.email}</div>
              <div className="text-[10px] text-gray-400">{ROLE_LABELS[authProfile?.role] || authProfile?.role}</div>
            </div>
            <PwaInstallButton />
            <button type="button" onClick={()=>setQuickGuideOpen(true)} title="ì‚¬ìš© ì•ˆë‚´" className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-100 bg-white text-gray-500 hover:text-violet-600"><HelpCircle size={16}/></button>
            <NotificationBell userId={authUser?.id} onOpen={()=>setNotificationOpen(true)} />
            {onSignOut && (
              <button onClick={onSignOut} title="ë¡œê·¸ì•„ì›ƒ" className="text-gray-400 hover:text-red-500 p-1.5 shrink-0">
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
        {role === 'employee' && (
          <div className="max-w-5xl mx-auto px-4 pb-3 flex items-center gap-2">
            <span className="text-xs text-gray-400">ë¡œê·¸ì¸:</span>
            <select
              value={empId}
              onChange={(e) => setEmpId(e.target.value)}
              disabled={scopedEmployees.length <= 1}
              className="text-sm font-medium bg-violet-50 text-violet-700 px-2.5 py-1 rounded-lg border border-violet-100 disabled:opacity-80"
            >
              {scopedEmployees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} Â· {e.position} Â· {displayStoreName(e.branch)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <AppQuickGuide open={quickGuideOpen} onClose={closeQuickGuide} isManager={role==='admin'} />

      {notificationOpen&&<div className="fixed inset-0 z-[115] bg-black/45 flex items-end sm:items-center justify-center" onClick={()=>setNotificationOpen(false)}>
        <div className="w-full max-w-md max-h-[86vh] overflow-y-auto bg-gray-50 rounded-t-3xl sm:rounded-3xl p-4" onClick={e=>e.stopPropagation()}>
          <div className="flex items-center justify-between mb-3"><div className="text-lg font-bold text-gray-900">ì•Œë¦¼ì„¼í„°</div><button onClick={()=>setNotificationOpen(false)} className="w-8 h-8 rounded-full bg-white text-gray-500">Ã—</button></div>
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
        <div className="flex items-center justify-center py-24 text-gray-400 gap-2"><Loader2 size={18} className="animate-spin" /> ë¶ˆëŸ¬ì˜¤ëŠ” ì¤‘...</div>
      ) : role === 'employee' ? (
        <EmployeeView
          tab={tab} setTab={setTab} months={months} month={month} setMonth={setMonth}
          draft={draft} setDraft={updateDraft} config={config} pay={myPay} mergedDraft={myMergedDraft}
          status={(monthRecords[empId] || {}).status || 'none'}
          saveDraft={saveDraft} saving={saving} saved={saved} dirty={dirty} lastSavedAt={lastSavedAt}
          dailyDays={effectiveDailyRecords[empId] || {}} allDailyRecords={effectiveDailyRecords} saveDailyDay={saveDailyDay}
          monthLocked={lockedMonths.includes(month)}
          policyInputBlocked={policyBlockedMonths.includes(month)}
          canSeeCriteria={currentEmp?.branch === 'ìš´ì˜ì§„' || ['ì ì¥', 'ë¶€ì ì¥'].includes(currentEmp?.position)}
          myRank={myRank} myRankTotal={myRankTotal} myBranchRank={myBranchRank} myBranchTotal={myBranchRanked.length}
          currentEmp={currentEmp}
          loginEmp={loginEmp}
          stores={stores}
          onTeamCreditSaved={()=>loadTeamSalesCredits(month)}
          onHomeOrdersChanged={()=>loadHomePolicies(month,employees)}
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
          policyInputBlocked={policyBlockedMonths.includes(month)} togglePolicyInputBlock={togglePolicyInputBlock}
        />
      )}
    </div>
  );
}

/* ===================== v21.60 í‰ê°€ ì‹œìŠ¤í…œ ===================== */

const CAREER_PASS_SCORE = 90;
const MANAGER_GRADE = (score) => score >= 100 ? 'S' : score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : 'D';

function quarterInfoFromMonth(month){
  const [y,m]=String(month).split('-').map(Number);
  const q=Math.floor((m-1)/3)+1;
  const start=(q-1)*3+1;
  const months=[0,1,2].map(i=>`${y}-${String(start+i).padStart(2,'0')}`);
  return {year:y,quarter:q,key:`${y}-Q${q}`,label:`${y}ë…„ ${q}ë¶„ê¸°`,months,from:`${months[0]}-01`,to:(()=>{const d=new Date(y,start+2,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;})()};
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
  {key:'subTvHousehold',label:'TVë¶€ì…‹íƒ‘(ê°€ì •ë§)',weight:7,target:77,unit:'count'},
  {key:'tvFree',label:'TVí”„ë¦¬(ë¶€)',weight:6,target:65,unit:'count'},
  {key:'smartHome',label:'ìŠ¤ë§ˆíŠ¸í™ˆ',weight:4,target:28,unit:'count'},
  {key:'otherCustomer',label:'íƒ€ì‚¬ ê³ ê° ë“±ë¡',weight:4,target:360,unit:'count'},
  {key:'tailoredAmount',label:'ë§ì¶¤ì œì•ˆ ë§¤ì¶œì•¡',weight:4,target:4120864,unit:'won'},
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
    if(error)return showLegacyAlert(`í‰ê°€ ë‚´ì—­ ì €ì¥ ì‹¤íŒ¨: ${friendlyError(error)}`);
    setNote('');setCount(1);const {data}=await supabase.from('career_eval_penalties').select('*').eq('user_id',selected.id).gte('event_date',quarter.from).lt('event_date',quarter.to).order('event_date',{ascending:false});setEvents(data||[]);
  };
  const cancelEvent=async(id)=>{if(!canManage)return;await supabase.from('career_eval_penalties').update({status:'cancelled'}).eq('id',id);setEvents(v=>v.map(x=>x.id===id?{...x,status:'cancelled'}:x));};
  const saveDecision=async(action)=>{
    if(!canManage)return;
    const nextFail=streakFail;
    const payload={quarter:quarter.key,user_id:selected.id,score,result:pass?'PASS':'FAIL',action,consecutive_fail_count:nextFail};
    const {error}=await supabase.from('career_eval_decisions').upsert(payload,{onConflict:'quarter,user_id'});if(error)return showLegacyAlert(friendlyError(error));setDecision({...decision,...payload});
  };
  const typeLabel={nps_negative:'NPS ë¹„ì¶”ì²œ/ê°•í•œ ë¹„ì¶”ì²œ',label:'ê¼¬ë¦¬í‘œ',home_no_experience:'í™ˆ ë¬´ì²´í—˜'};
  return <div className="space-y-3">
    {canManage&&(managerScopeEmployees||[]).length>0&&<select value={selectedId} onChange={e=>setSelectedId(e.target.value)} className="w-full bg-white border rounded-xl px-3 py-2.5 text-sm">{managerScopeEmployees.map(e=><option key={e.id} value={e.id}>{e.name} Â· {e.position} Â· {displayStoreName(e.branch)}</option>)}</select>}
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <div className="flex justify-between gap-3"><div><div className="text-xs text-violet-600 font-semibold">{quarter.label} ì»¤ë¦¬ì–´ ë“±ê¸‰</div><div className="text-lg font-bold mt-1">{selected?.name||'-'} Â· {selected?.position||'-'}</div></div><div className={`px-3 py-1.5 rounded-full h-fit text-xs font-bold ${pass?'bg-emerald-50 text-emerald-700':'bg-red-50 text-red-600'}`}>{loading?'ê³„ì‚°ì¤‘':pass?'PASS':'FAIL'}</div></div>
      <div className="mt-4 flex items-end gap-2"><span className="text-3xl font-bold text-gray-900">{score.toFixed(1)}P</span><span className="text-xs text-gray-400 mb-1">í†µê³¼ 90P</span></div>
      <div className="grid grid-cols-4 gap-2 mt-4">{[['3ê°œì›” KPI',kpi.toFixed(1)],['ê·¼ì† ê°€ì ',`+${tenure}`],['ê°ì ',`-${penalty}`],['ì—°ì† FAIL',`${streakFail}íšŒ`]].map(([l,v])=><div key={l} className="bg-gray-50 rounded-xl p-2.5 text-center"><div className="text-[9px] text-gray-400">{l}</div><div className="text-sm font-bold mt-1">{v}P</div></div>)}</div>
      {selected?.position==='ì‚¬ì›'&&pass&&<div className="mt-3 bg-violet-50 text-violet-700 rounded-xl px-3 py-2 text-xs font-semibold">ìŠ¹ê¸‰ ëŒ€ìƒ Â· ë©´ë‹´ í›„ ë§¤ë‹ˆì € ìŠ¹ê¸‰ ìŠ¹ì¸ í•„ìš”</div>}
      {selected?.position==='ë§¤ë‹ˆì €'&&!pass&&streakFail>=2&&<div className="mt-3 bg-red-50 text-red-700 rounded-xl px-3 py-2 text-xs font-semibold">âš  2íšŒ ì—°ì† FAIL Â· ì‚¬ì› ì „í™˜ ê²€í†  ëŒ€ìƒ</div>}
    </div>
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 border-b"><div className="text-sm font-bold">í‰ê°€ ê·¼ê±°</div><div className="text-[10px] text-gray-400">NPS Â· ê¼¬ë¦¬í‘œ Â· í™ˆ ë¬´ì²´í—˜ì€ ê´€ë¦¬ì ë“±ë¡ ë‚´ì—­ë§Œ ë°˜ì˜ë¼ìš”.</div></div>
      {active.length===0?<div className="py-8 text-center text-xs text-gray-400">ë“±ë¡ëœ ê°ì  ë‚´ì—­ì´ ì—†ì–´ìš”.</div>:<div className="divide-y">{active.map(x=><div key={x.id} className="px-4 py-3 flex justify-between gap-3"><div><div className="text-xs font-semibold">{x.event_date} Â· {typeLabel[x.event_type]||x.event_type}</div>{x.note&&<div className="text-[10px] text-gray-400 mt-1">{x.note}</div>}</div><div className="flex gap-2 items-center"><b className="text-sm text-red-500">-{x.count}P</b>{canManage&&<button onClick={()=>cancelEvent(x.id)} className="text-[10px] text-gray-400 underline">ì·¨ì†Œ</button>}</div></div>)}</div>}
    </div>
    {canManage&&<div className="bg-white rounded-2xl border border-gray-100 p-4"><div className="text-sm font-bold">í‰ê°€ ë‚´ì—­ ë“±ë¡</div><div className="grid grid-cols-2 gap-2 mt-3"><select value={eventType} onChange={e=>setEventType(e.target.value)} className="border rounded-xl px-3 py-2 text-xs"><option value="nps_negative">NPS ë¹„ì¶”ì²œ</option><option value="label">ê¼¬ë¦¬í‘œ</option><option value="home_no_experience">í™ˆ ë¬´ì²´í—˜</option></select><input type="date" value={eventDate} onChange={e=>setEventDate(e.target.value)} className="border rounded-xl px-3 py-2 text-xs"/><input type="number" min="1" value={count} onChange={e=>setCount(e.target.value)} className="border rounded-xl px-3 py-2 text-xs"/><input value={note} onChange={e=>setNote(e.target.value)} placeholder="ì‚¬ìœ /ë©”ëª¨" className="border rounded-xl px-3 py-2 text-xs"/></div><button onClick={addEvent} className="w-full mt-2 py-2.5 rounded-xl bg-violet-600 text-white text-xs font-bold">ê°ì  ë‚´ì—­ ë“±ë¡</button></div>}
    {canManage&&<div className="bg-white rounded-2xl border border-gray-100 p-4"><div className="text-sm font-bold">í‰ê°€ ì²˜ë¦¬</div><div className="text-[10px] text-gray-400 mt-1">í˜„ì¥ ê´€ë¦¬ìëŠ” í‰ê°€ í™•ì¸ê¹Œì§€, ìµœê³  ê´€ë¦¬ìëŠ” ë©´ë‹´ í›„ ìŠ¹ê¸‰Â·ê°•ë“±ì„ ìµœì¢… ìŠ¹ì¸í•©ë‹ˆë‹¤.</div><div className={`grid gap-2 mt-3 ${canFinalApprove?'grid-cols-2':'grid-cols-1'}`}><button onClick={()=>saveDecision('reviewed')} className="py-2.5 rounded-xl bg-gray-100 text-gray-700 text-xs font-bold">í‰ê°€ í™•ì¸</button>{canFinalApprove&&<button onClick={async()=>{const action=pass&&selected?.position==='ì‚¬ì›'?'promote_manager':(!pass&&selected?.position==='ë§¤ë‹ˆì €'&&streakFail>=2?'demote_employee':'no_change');await saveDecision(action);if(action==='promote_manager')await supabase.from('profiles').update({position:'ë§¤ë‹ˆì €'}).eq('id',selected.id);if(action==='demote_employee')await supabase.from('profiles').update({position:'ì‚¬ì›'}).eq('id',selected.id);}} className="py-2.5 rounded-xl bg-violet-600 text-white text-xs font-bold">ë©´ë‹´ ê²°ê³¼ ìµœì¢… ìŠ¹ì¸</button>}</div></div>}
  </div>;
}

function managerActualFromDraft(d,key){
  if(key==='hs')return hsCount(d);
  if(key==='plan115')return HS_PARTS.reduce((sum,part)=>sum+Number(d.matrix?.[part.idx]?.[0]||0),0);
  const hsMnp=matrixRowCount(d,MATRIX_ROWS.indexOf('ì¼ë°˜ëª¨ë¸ MNP'));
  const simMnp=(d.matrix?.[5]||[]).reduce((s,v)=>s+Number(v||0),0);
  // AA ì„íŒ©íŠ¸ì˜ MNP í•­ëª©ì€ ì¼ë°˜ MNPì™€ SIM MNPë¥¼ í•©ì‚°í•œë‹¤.\n  if(key==='mnp')return hsMnp+simMnp;
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
  if(key==='home')return completedHomeCount(d);
  return 0;
}

function ManagerEvaluationPanel({ month, employees, rows, authUserId, canSwitchStores=false, loginBranch='', payrollOnly=false }){
  const quarter=quarterInfoFromMonth(month);
  const stores=sortStoresByOpenOrder([...new Set((employees||[]).map(e=>e.branch).filter(b=>b&&!NON_SALES_STORES.includes(b)))]);
  const [store,setStore]=useState(canSwitchStores?'':(loginBranch||stores[0]||''));
  const activeStore=store||stores[0]||'';
  const [aaConfig,setAaConfig]=useState(DEFAULT_AA_METRICS),[snap,setSnap]=useState({verified_metrics:{},external_inputs:{}}),[allGoals,setAllGoals]=useState([]),[saving,setSaving]=useState(false);
  const [managerMode,setManagerMode]=useState('dashboard');
  const activeManagerMode=payrollOnly?'incentive':managerMode;
  useEffect(()=>{if(!canSwitchStores&&loginBranch)setStore(loginBranch)},[canSwitchStores,loginBranch]);
  useEffect(()=>{(async()=>{const [{data:c},{data:s},{data:g}]=await Promise.all([
    supabase.from('aa_impact_monthly').select('*').eq('month',month).maybeSingle(),
    supabase.from('manager_eval_monthly').select('*').eq('month',month).eq('store_name',activeStore).maybeSingle(),
    supabase.from('store_goals').select('store_name,company_goals').eq('month',month)
  ]);if(Array.isArray(c?.metrics)&&c.metrics.length)setAaConfig(c.metrics);setSnap(s||{verified_metrics:{},external_inputs:{}});setAllGoals(g||[]);})();},[month,activeStore]);
  const storeRows=(rows||[]).filter(r=>r.branch===activeStore);
  const live={};['hs','plan115','home','mnp','simMnp','subTvHousehold','tvFree','smartHome','second','tailoredCount','otherCustomer','tailoredAmount','daemyung','prospectMnp'].forEach(k=>live[k]=storeRows.reduce((s,r)=>s+managerActualFromDraft(r.draft,k),0));
  live.productivity=storeRows.reduce((s,r)=>s+Number(r.pay?.kpiScore||0),0);
  live.strategicPoints=storeRows.reduce((s,r)=>s+Number(r.pay?.strategicPoints||0),0);
  const verified=snap?.verified_metrics||{};
  const actual=(key)=>Number(verified[key]??live[key]??0);
  // ê´€ë¦¬ì > íšŒì‚¬ ëª©í‘œ > íšŒì‚¬ ê¸°ì¤€ìˆ˜ëŸ‰ì„ í‰ê°€ì˜ ë‹¨ì¼ ê¸°ì¤€ìœ¼ë¡œ ì‚¬ìš©í•©ë‹ˆë‹¤.
  // DBì— í•´ë‹¹ ì›” ì €ì¥ê°’ì´ ìˆìœ¼ë©´ ìš°ì„ í•˜ê³ , ì•„ì§ ì €ì¥ ì „ì¸ ë§¤ì¥ì€ íšŒì‚¬ ê¸°ë³¸ ê¸°ì¤€ìˆ˜ëŸ‰ì„ ë³´ì™„ê°’ìœ¼ë¡œ ì‚¬ìš©í•©ë‹ˆë‹¤.
  const goalMap=Object.fromEntries(stores.map(storeName=>{
    const saved=(allGoals||[]).find(g=>g.store_name===storeName);
    return [storeName,{...companyGoalDefaults(storeName),...(saved?.company_goals||{})}];
  }));
  const storeHsTarget=Number(goalMap[activeStore]?.hs||0);
  // í˜„ì¥ ê´€ë¦¬ìëŠ” ê¶Œí•œìƒ ìê¸° ë§¤ì¥ ì§ì›ë§Œ ì¡°íšŒí•˜ë¯€ë¡œ `stores`ì—ëŠ” í•œ ë§¤ì¥ë§Œ ë“¤ì–´ì˜µë‹ˆë‹¤.
  // AA íšŒì‚¬ ëª©í‘œ ë°°ë¶„ì˜ ë¶„ëª¨ëŠ” ì¡°íšŒ ë²”ìœ„ê°€ ì•„ë‹ˆë¼ ì •ì±…ì„œì˜ ì „ì²´ ë§¤ì¥ HS ê¸°ì¤€ìˆ˜ëŸ‰ì´ì–´ì•¼ í•©ë‹ˆë‹¤.
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
  const daemyungTarget=roundedTarget(35*share,'count'),prospectTarget=roundedTarget(21*share,'count');
  const adj=aaAdjustments({...ext,internetRatio,daemyungAchieved:daemyungTarget>0&&actual('daemyung')>=daemyungTarget,prospectMnpAchieved:prospectTarget>0&&actual('prospectMnp')>=prospectTarget});
  const aaBase=aaRows.reduce((s,x)=>s+x.score,0),aa100=Math.max(0,Math.min(100,aaBase+adj.total)),aa50=aa100*0.5,total=core50+aa50,grade=MANAGER_GRADE(total);
  const operator=managerOperatorForStore(activeStore);
  const viewer=(employees||[]).find(e=>e.id===authUserId);
  const canViewManagerIncentive=canSwitchStores||!!(operator?.name&&viewer?.name===operator.name&&viewer?.branch===activeStore);
  const strategicPoints=Number(verified.strategicPoints??live.strategicPoints??0);
  const strategicRatio=hsActual>0?strategicPoints/hsActual*100:0;
  const plan115Count=Number(verified.plan115Count??live.plan115??0),plan115Ratio=hsActual>0?plan115Count/hsActual*100:0;
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
  const managerForecastFactor=monthKeyOf(new Date())===month?daysInMonth(month)/Math.max(1,new Date().getDate()):1;
  // ì‹¤ì œ ê¸‰ì—¬ê°€ ê±´ ë‹¨ìœ„ë¡œ ì§€ê¸‰ë˜ëŠ” í•­ëª©ì€ ì›”ë§ ì˜ˆìƒë„ ì •ìˆ˜ ê±´ìœ¼ë¡œ í™˜ì‚°í•©ë‹ˆë‹¤.
  // ìƒì‚°ì„±(P)ê³¼ ë§¤ì¶œì•¡ì€ ë³¸ë˜ ì†Œìˆ˜/ê¸ˆì•¡ ë‹¨ìœ„ë¥¼ ì‚¬ìš©í•˜ë¯€ë¡œ ê·¸ëŒ€ë¡œ ìœ ì§€í•©ë‹ˆë‹¤.
  const forecastActual=(key,unit)=>{
    const value=Number(actual(key)||0)*managerForecastFactor;
    return unit==='won'||unit==='point'||key==='productivity'||key==='tailoredAmount'?value:Math.round(value);
  };
  const forecastCoreRaw=cappedAchievement(forecastActual('hs'),coreTargets.hs)*30+cappedAchievement(forecastActual('home'),coreTargets.home)*30+cappedAchievement(forecastActual('productivity'),coreTargets.productivity)*40;
  const forecastAaBase=aaRows.reduce((sum,row)=>sum+aaMetricScore(forecastActual(row.key,row.unit),row.storeTarget,row.normalizedWeight),0);
  const forecastAa100=Math.max(0,Math.min(100,forecastAaBase+adj.total));
  const forecastManagerScore=forecastCoreRaw*.5+forecastAa100*.5;
  const forecastHs=forecastActual('hs'),forecastHome=forecastActual('home');
  const forecastStrategicPoints=Number(strategicPoints||0)*managerForecastFactor;
  const forecastPlan115Count=Math.round(Number(plan115Count||0)*managerForecastFactor);
  const forecastSubTvHousehold=forecastActual('subTvHousehold'),forecastSmartHome=forecastActual('smartHome');
  const forecastManagerEstimate=calculateSeptemberManagerIncentive({
    actual:{hs:forecastHs,home:forecastHome,tvFree:forecastActual('tvFree'),smartHome:forecastSmartHome},
    targets:{hs:coreTargets.hs,home:coreTargets.home,tvFree:Number(goalMap[activeStore]?.tvFree||0),smartHome:Number(goalMap[activeStore]?.smartHome||0)},
    managerScore:forecastManagerScore,
    strategicRatio:forecastHs>0?forecastStrategicPoints/forecastHs*100:0,
    homeRatio:forecastHs>0?forecastHome/forecastHs*100:0,
    plan115Count:forecastPlan115Count,plan115Ratio:forecastHs>0?forecastPlan115Count/forecastHs*100:0,
    tailoredCount:forecastActual('tailoredCount'),bundledSecondCount:forecastActual('second'),storeType:septemberManagerStoreType(activeStore),subTvSmartRatio:forecastHs>0?(forecastSubTvHousehold+forecastSmartHome)/forecastHs*100:null,
    levelBelow4:ext.leveling==='below4',noExperienceRate:ext.noExperienceRate??null,
    complaintCount:Number(ext.complaintCount||0),unkindCount:Number(ext.unkindCount||0),
    npsScore:ext.npsScore??null,privacyViolation:!!ext.privacyViolation,
  });
  const verifiedAt=snap?.verified_at?new Date(snap.verified_at).toLocaleString('ko-KR'):'ë¯¸í™•ì¸';
  const setVerified=(key,val)=>setSnap(v=>({...v,verified_metrics:{...(v.verified_metrics||{}),[key]:Number(val||0)}}));
  const setExt=(key,val)=>setSnap(v=>({...v,external_inputs:{...(v.external_inputs||{}),[key]:val}}));
  const saveSnapshot=async()=>{setSaving(true);const payload={month,store_name:activeStore,verified_metrics:{...live,...(snap.verified_metrics||{})},external_inputs:{...(snap.external_inputs||{})},verified_by:authUserId,verified_at:new Date().toISOString()};const {error}=await supabase.from('manager_eval_monthly').upsert(payload,{onConflict:'month,store_name'});setSaving(false);if(error)return showLegacyAlert(friendlyError(error));setSnap(payload);};
  const saveAa=async()=>{setSaving(true);const {error}=await supabase.from('aa_impact_monthly').upsert({month,metrics:aaConfig,updated_by:authUserId},{onConflict:'month'});setSaving(false);if(error)return showLegacyAlert(friendlyError(error));showLegacyAlert('AAì„íŒ©íŠ¸ ì›” ëª©í‘œë¥¼ ì €ì¥í–ˆì–´ìš”.');};
  return <div className="space-y-3">
    {!payrollOnly&&<div className={`grid gap-2 ${canSwitchStores?'grid-cols-2':'grid-cols-1'}`}><button onClick={()=>setManagerMode('dashboard')} className={`py-2 rounded-xl text-xs font-bold ${activeManagerMode==='dashboard'?'bg-violet-600 text-white':'bg-white border text-gray-500'}`}>í‰ê°€ í˜„í™©</button>{canSwitchStores&&<button onClick={()=>setManagerMode('settings')} className={`py-2 rounded-xl text-xs font-bold ${activeManagerMode==='settings'?'bg-violet-600 text-white':'bg-white border text-gray-500'}`}>ëª©í‘œÂ·ì‹¤ì  ìµœì‹ í™”</button>}</div>}
    {canSwitchStores&&<select value={activeStore} onChange={e=>setStore(e.target.value)} className="w-full bg-white border rounded-xl px-3 py-2.5 text-sm">{stores.map(s=><option key={s} value={s}>{displayStoreName(s)}</option>)}</select>}
    {activeManagerMode==='dashboard'?<>
      <div className="bg-white rounded-2xl border p-4"><div className="flex justify-between gap-3"><div><div className="text-xs text-violet-600 font-semibold">{quarter.label} ê´€ë¦¬ì í‰ê°€ Â· {monthLabel(month)} í˜„ì¬ ê¸°ì¤€</div><div className="text-lg font-bold mt-1">{displayStoreName(activeStore)}</div></div><div className="text-right"><div className="text-3xl font-black text-violet-700">{total.toFixed(1)}</div><div className="text-xs font-bold">{grade}ë“±ê¸‰</div></div></div><div className="grid grid-cols-2 gap-2 mt-4"><div className="bg-gray-50 rounded-xl p-3"><div className="text-[10px] text-gray-400">í•µì‹¬ì„±ê³¼ 50%</div><div className="text-xl font-bold mt-1">{core50.toFixed(1)} / 50</div><div className="text-[10px] text-gray-400 mt-1">HS 30% Â· í™ˆ 30% Â· ìƒì‚°ì„± 40%</div></div><div className="bg-gray-50 rounded-xl p-3"><div className="text-[10px] text-gray-400">AAì„íŒ©íŠ¸ 50%</div><div className="text-xl font-bold mt-1">{aa50.toFixed(1)} / 50</div><div className="text-[10px] text-gray-400 mt-1">AA ì›ì ìˆ˜ {aa100.toFixed(1)} / 100</div></div></div><div className="mt-3 text-[10px] text-gray-400">ê´€ë¦¬ì í™•ì¸ ì‹¤ì  ê¸°ì¤€ Â· ë§ˆì§€ë§‰ ìµœì‹ í™” {verifiedAt}</div></div>
      <div className="bg-white rounded-2xl border overflow-hidden"><div className="px-4 py-3 border-b"><div className="text-sm font-bold">í•µì‹¬ ì„±ê³¼</div></div>{[['HS','hs',30],['í™ˆ','home',30],['ìƒì‚°ì„±','productivity',40]].map(([l,k,w])=>{const t=coreTargets[k],a=actual(k),pct=cappedAchievement(a,t)*100;return <div key={k} className="px-4 py-3 border-b last:border-0"><div className="flex justify-between text-xs"><b>{l}</b><span>{fmtNum(a,1)} / {fmtNum(t,1)} Â· {pct.toFixed(0)}%</span></div><div className="h-1.5 bg-gray-100 rounded-full mt-2"><div className="h-full bg-violet-500 rounded-full" style={{width:`${pct}%`}}/></div><div className="text-[9px] text-gray-400 mt-1">ë°˜ì˜ë¹„ì¤‘ {w}% Â· 100% ì´ˆê³¼ ë¯¸ë°˜ì˜</div></div>})}</div>
      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="px-4 py-3 border-b">
          <div className="text-sm font-bold">AAì„íŒ©íŠ¸</div>
          {hasCompanyGoalBasis
            ? <div className="text-[10px] text-gray-400">íšŒì‚¬ ëª©í‘œë¥¼ ê´€ë¦¬ì â†’ íšŒì‚¬ ëª©í‘œì˜ HS ê¸°ì¤€ìˆ˜ëŸ‰ ë¹„ì¤‘({(share*100).toFixed(1)}%)ìœ¼ë¡œ ìë™ ë°°ë¶„ Â· ê±´ìˆ˜ëŠ” ë°˜ì˜¬ë¦¼</div>
            : <div className="text-[10px] text-red-500 font-semibold">âš  íšŒì‚¬ ëª©í‘œì˜ HS ê¸°ì¤€ìˆ˜ëŸ‰ì„ í™•ì¸í•  ìˆ˜ ì—†ì–´ AAì„íŒ©íŠ¸ ëª©í‘œë¥¼ ë°°ë¶„í•  ìˆ˜ ì—†ìŠµë‹ˆë‹¤.</div>}
        </div>
        {aaRows.map(x=><div key={x.key} className="px-4 py-3 border-b flex justify-between gap-3"><div><div className="text-xs font-semibold">{x.label}</div><div className="text-[10px] text-gray-400 mt-1">ëª©í‘œ {x.unit==='won'?won(x.storeTarget):`${x.storeTarget}ê±´`} Â· ì‹¤ì  {x.unit==='won'?won(x.actual):`${fmtCount(x.actual)}ê±´`}</div></div><div className="text-right"><b className="text-sm text-violet-700">{x.score.toFixed(1)}ì </b><div className="text-[9px] text-gray-400">í™˜ì‚°ë¹„ì¤‘ {x.normalizedWeight.toFixed(1)}%</div></div></div>)}
        <div className="px-4 py-3 bg-gray-50 border-t">
          <div className="flex justify-between items-center mb-2"><span className="text-xs font-bold">AAì„íŒ©íŠ¸ ê°€ê°ì </span><b className={`text-xs ${adj.total>=0?'text-emerald-600':'text-red-500'}`}>{adj.total>=0?'+':''}{adj.total.toFixed(1)}ì </b></div>
          <div className="space-y-1.5">
            {[
              ['NPS', ext.npsScore?`${fmtNum(Number(ext.npsScore),1)}ì  Â· 95ì  ê¸°ì¤€`:'ë¯¸ì…ë ¥', adj.npsAdj],
              ['ë¶ˆì¹œì ˆ', `${fmtCount(Number(ext.unkindCount||0))}ê±´`, adj.unkind],
              ['ëŒ€ì™¸ë¯¼ì›', `${fmtCount(Number(ext.complaintCount||0))}ê±´`, adj.complaints],
              ['ì •ë³´ë³´í˜¸', ext.securityScore?`${fmtNum(Number(ext.securityScore),1)}ì `:'ë¯¸ì…ë ¥', adj.security],
              ['ê°œì¸ì •ë³´ë³´í˜¸ìœ„ì›íšŒ', ext.privacyViolation?'ì ë°œ':'í•´ë‹¹ ì—†ìŒ', adj.privacy],
              ['U+one ë¬´ì²´í—˜', ext.noExperienceRate!==undefined&&ext.noExperienceRate!==''?`${fmtNum(Number(ext.noExperienceRate),1)}%`:'ë¯¸ì…ë ¥', adj.noExp],
              ['ë§¤ì¥ ë ˆë²¨ë§', ext.leveling==='4'?'Lv4':ext.leveling?'Lv4 ë¯¸ë§Œ':'ë¯¸ì…ë ¥', adj.leveling],
              ['ì¸í„°ë„· ë¹„ì¤‘', `${internetRatio.toFixed(1)}% Â· í™ˆ ${fmtCount(householdHome)} / HS ${fmtCount(hsActual)}`, adj.internet],
              ['ì†Œë…¸', `ëª©í‘œ ${daemyungTarget}ê±´ / ì‹¤ì  ${fmtCount(actual('daemyung'))}ê±´`, adj.daemyung],
              ['MNP íƒ€ì‚¬ ê°€ë§', `ëª©í‘œ ${prospectTarget}ê±´ / ì‹¤ì  ${fmtCount(actual('prospectMnp'))}ê±´`, adj.prospect],
            ].map(([label,basis,point])=><div key={label} className="flex items-center justify-between gap-3 text-[10px]"><div className="min-w-0"><span className="font-semibold text-gray-600">{label}</span><span className="text-gray-400 ml-1.5">{basis}</span></div><b className={Number(point)>0?'text-emerald-600':Number(point)<0?'text-red-500':'text-gray-400'}>{Number(point)>0?'+':''}{Number(point).toFixed(1)}ì </b></div>)}
          </div>
        </div>
      </div>
    </>:activeManagerMode==='incentive'&&canViewManagerIncentive?<>
      {month!=='2026-09'?<div className="bg-white rounded-2xl border p-5 text-center"><div className="text-sm font-bold text-gray-700">9ì›” ê´€ë¦¬ì ì •ì±…ì´ì—ìš”</div><div className="text-xs text-gray-400 mt-1">ìƒë‹¨ì—ì„œ 2026ë…„ 9ì›”ì„ ì„ íƒí•˜ë©´ ì •ì±…ê³¼ ì˜ˆìƒì•¡ì„ í™•ì¸í•  ìˆ˜ ìˆì–´ìš”.</div></div>:
       !operator?.name?<div className="bg-white rounded-2xl border p-5 text-center"><div className="text-sm font-bold text-gray-700">ì§€ì •ëœ ìš´ì˜ ê´€ë¦¬ìê°€ ì—†ì–´ìš”</div><div className="text-xs text-gray-400 mt-1">{displayStoreName(activeStore)}ì€ 9ì›” ê´€ë¦¬ì ì¸ì„¼í‹°ë¸Œ ì§€ê¸‰ ëŒ€ìƒìê°€ ì—†ìŠµë‹ˆë‹¤.</div></div>:<>
        <div className="rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white p-4 shadow-sm">
          <div><div className="text-[10px] text-violet-100">{SEPTEMBER_MANAGER_POLICY_VERSION} Â· ì›”ì¤‘ ì˜ˆìƒ</div><div className="text-lg font-black mt-1">{operator.name} {operator.position}</div><div className="text-xs text-violet-100 mt-0.5">{displayStoreName(activeStore)} ìš´ì˜ ê´€ë¦¬ì</div></div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mt-4 rounded-xl bg-white/10 px-3 py-3"><div><div className="text-[10px] text-violet-100">í˜„ì¬ ê¸°ì¤€ì•¡</div><div className="text-xl font-black mt-1">{won(managerEstimate.finalAmount)}</div></div><div className="text-violet-200 text-xl">â†’</div><div className="text-right"><div className="text-[10px] text-violet-100">ì›”ë§ ì˜ˆìƒì•¡</div><div className="text-xl font-black mt-1">{won(forecastManagerEstimate.finalAmount)}</div></div></div>
          <div className="mt-2 text-[10px] text-violet-100 text-right">í˜„ì¬ {Math.round(managerForecastFactor===1?100:100/managerForecastFactor)}% ê²½ê³¼ ê¸°ì¤€ ì˜ˆìƒ</div>
          <div className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-[10px] leading-relaxed">ì„íŒ©íŠ¸ í‰ê°€ ì§€ê¸‰ë¥ ì€ ì›”ì¤‘ ê¸ˆì•¡ì— ì ìš©í•˜ì§€ ì•Šê³  ì›” ë§ˆê° ì‹œ ìµœì¢… ë°˜ì˜í•´ìš”.</div>
        </div>
        <div className="grid grid-cols-2 gap-2"><div className="bg-white rounded-xl border p-3"><div className="text-[10px] text-gray-400">ì „ëµP ë¹„ì¤‘ Â· ìë™</div><div className="text-base font-black text-violet-700 mt-1">{fmtNum(strategicRatio,1)}%</div><div className="text-[10px] text-gray-400 mt-1">ì „ëµP {fmtNum(strategicPoints,1)}P Ã· HS {fmtCount(hsActual)}ê±´</div></div><div className="bg-white rounded-xl border p-3"><div className="text-[10px] text-gray-400">115êµ° ë¹„ì¤‘ Â· ìë™</div><div className="text-base font-black text-violet-700 mt-1">{fmtNum(plan115Ratio,1)}%</div><div className="text-[10px] text-gray-400 mt-1">115êµ° {fmtCount(plan115Count)}ê±´ Ã· HS {fmtCount(hsActual)}ê±´</div></div></div>
        <div className="bg-white rounded-2xl border overflow-hidden"><div className="px-4 py-3 border-b"><div className="text-sm font-bold">ì„±ê³¼ ì¸ì„¼í‹°ë¸Œ</div><div className="text-[10px] text-gray-400 mt-0.5">ë‹¬ì„± êµ¬ê°„ì˜ ê±´ë‹¹ ê¸ˆì•¡ Ã— ì‹¤ì œ ì™„ë£Œ ê±´ìˆ˜ Â· ë³´ë¼ìƒ‰ì€ ì›”ë§ ì˜ˆìƒ</div></div>{managerEstimate.metrics.map((m,index)=>{const forecast=forecastManagerEstimate.metrics[index];return <div key={m.key} className="px-4 py-3 border-b last:border-0"><div className="flex justify-between gap-3"><div><div className="text-xs font-bold">{{hs:'HS',home:'í™ˆ(ì†Œí˜¸ í¬í•¨)',tvFree:'TVí”„ë¦¬(ë¶€)',smartHome:'ìŠ¤ë§ˆíŠ¸í™ˆ'}[m.key]}</div><div className="text-[10px] text-gray-400 mt-1">í˜„ì¬ {fmtNum(m.actual,1)} / {fmtNum(m.target,1)}ê±´ Â· {m.achievement.toFixed(0)}% Â· {m.tier}</div><div className="text-[10px] font-semibold text-violet-600 mt-1">ì˜ˆìƒ {fmtNum(forecast.actual,1)}ê±´ Â· {forecast.achievement.toFixed(0)}% Â· {forecast.tier}</div></div><div className="text-right"><div className="text-sm font-black text-gray-800">{won(m.amount)}</div><div className="text-[10px] font-bold text-violet-700 mt-1">ì˜ˆìƒ {won(forecast.amount)}</div><div className="text-[9px] text-gray-400">{forecast.rate?`ì˜ˆìƒ ê±´ë‹¹ ${won(forecast.rate)}`:'ì˜ˆìƒë„ ì§€ê¸‰ ì „'}</div></div></div>{m.key==='hs'&&<div className={`mt-2 rounded-lg px-2.5 py-2 text-[10px] ${m.withheld?'bg-red-50 text-red-600':'bg-gray-50 text-gray-500'}`}>{m.homeBonus>0?`ê°€ì •ë§ í™ˆ 12% ì´ìƒ Â· HS +20% ${won(m.homeBonus)}`:'ê°€ì •ë§ í™ˆ 12% ì¶”ê°€ ì¡°ê±´ ë¯¸ë‹¬'} Â· {m.strategicKnown?(m.withheld?'ì „ëµP 160% ë¯¸ë§Œìœ¼ë¡œ HS ë¯¸ì§€ê¸‰':`ì „ëµP ${fmtNum(Number(strategicRatio),1)}%`):'ì „ëµP ë¹„ì¤‘ í™•ì¸ ì „'}</div>}</div>})}</div>
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border overflow-hidden"><div className="px-4 py-3 border-b flex items-center justify-between gap-3"><div><div className="text-xs text-gray-400">ì¶”ê°€ ì •ì±…</div><div className="text-lg font-black text-gray-800 mt-0.5">í˜„ì¬ +{won(managerEstimate.bonusTotal)}</div></div><div className="text-right shrink-0"><div className="text-[10px] text-violet-500">ì›”ë§ ì˜ˆìƒ</div><div className="text-base font-black text-violet-700">+{won(forecastManagerEstimate.bonusTotal)}</div></div></div><div className="divide-y divide-gray-100">{managerEstimate.bonuses.map((x,index)=>{const forecast=forecastManagerEstimate.bonuses[index];return <div key={x.key} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-4 py-3 text-xs"><span className={x.achieved?'font-semibold text-gray-700':'text-gray-500'}>{x.label}</span><b className={`whitespace-nowrap ${x.amount?'text-gray-700':'text-gray-300'}`}>{x.amount?`+${won(x.amount)}`:'í˜„ì¬ â€”'}</b><b className={`min-w-[88px] text-right whitespace-nowrap ${forecast?.amount?'text-violet-700':'text-gray-300'}`}>{forecast?.amount?`ì˜ˆìƒ +${won(forecast.amount)}`:'ì˜ˆìƒ â€”'}</b></div>})}</div></div>
          <div className="bg-white rounded-2xl border overflow-hidden"><div className="px-4 py-3 border-b flex items-center justify-between gap-3"><div className="text-xs text-gray-400">í˜„ì¬ í™•ì¸ëœ ì°¨ê°</div><div className="text-lg font-black text-red-500 whitespace-nowrap">-{won(managerEstimate.deductionTotal)}</div></div><div className="divide-y divide-gray-100">{managerEstimate.deductions.length?managerEstimate.deductions.map(x=><div key={x.key} className="flex items-center justify-between gap-3 px-4 py-3 text-xs"><span className="text-gray-600">{x.label}</span><b className="text-red-500 whitespace-nowrap">-{won(x.amount)}</b></div>):<div className="px-4 py-4 text-xs text-gray-300">í˜„ì¬ í™•ì¸ëœ ì°¨ê° ì—†ìŒ</div>}</div></div>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-[10px] text-amber-700 leading-relaxed">í˜„ì¬ ì…ë ¥Â·í™•ì¸ëœ ì‹¤ì  ê¸°ì¤€ ì˜ˆìƒì•¡ì´ì—ìš”. ì „ëµPÂ·115êµ°ê³¼ ì›”ë§ ì„íŒ©íŠ¸ ê°’ì´ í™•ì •ë˜ë©´ ê¸ˆì•¡ì´ ë‹¬ë¼ì§ˆ ìˆ˜ ìˆìŠµë‹ˆë‹¤. Â· 2ND ê¸°ì¤€ {septemberManagerStoreType(activeStore)==='consignment'?'ìœ„íƒ 20ê±´':'ìê°€ 10ê±´'}</div>
      </>}
    </>:<>
      <div className="bg-white rounded-2xl border p-4"><div className="flex justify-between"><div><div className="text-sm font-bold">ì‹¤ì  ìµœì‹ í™”</div><div className="text-[10px] text-gray-400 mt-1">ì§ì› ì…ë ¥ ëˆ„ì ê³¼ ê´€ë¦¬ì í™•ì¸ê°’ì„ ë¹„êµí•˜ê³ , í‰ê°€ì—ëŠ” ê´€ë¦¬ì í™•ì¸ê°’ì„ ìš°ì„  ì‚¬ìš©í•©ë‹ˆë‹¤.</div></div><button onClick={saveSnapshot} disabled={saving} className="px-3 py-2 rounded-xl bg-violet-600 text-white text-xs font-bold h-fit">{saving?'ì €ì¥ì¤‘':'ìµœì‹ í™” ì™„ë£Œ'}</button></div><div className="mt-3 space-y-2">{[['HS','hs'],['í™ˆ','home'],['ìƒì‚°ì„±','productivity'],['MNP','mnp'],['SIM MNP','simMnp'],['TVë¶€ì…‹íƒ‘(ê°€ì •ë§)','subTvHousehold'],['TVí”„ë¦¬(ë¶€)','tvFree'],['ìŠ¤ë§ˆíŠ¸í™ˆ','smartHome'],['íƒ€ì‚¬ ê³ ê° ë“±ë¡','otherCustomer'],['ë§ì¶¤ì œì•ˆ ë§¤ì¶œì•¡','tailoredAmount'],['ì†Œë…¸','daemyung'],['MNP íƒ€ì‚¬ ê°€ë§ ê°œí†µ','prospectMnp']].map(([l,k])=><div key={k} className="grid grid-cols-[1fr_70px_90px] gap-2 items-center"><div className="text-xs text-gray-600">{l}</div><div className="text-[10px] text-gray-400 text-right">ì…ë ¥ {k==='tailoredAmount'?won(live[k]):fmtNum(live[k],1)}</div><input type="number" value={verified[k]??live[k]??0} onChange={e=>setVerified(k,e.target.value)} className="border rounded-lg px-2 py-1.5 text-xs text-right"/></div>)}</div></div>
      <div className="bg-white rounded-2xl border p-4"><div className="text-sm font-bold">AAì„íŒ©íŠ¸ ì™¸ë¶€ í‰ê°€ê°’</div><div className="grid grid-cols-2 gap-2 mt-3">{[['NPS ì ìˆ˜','npsScore'],['ë¶ˆì¹œì ˆ ê±´ìˆ˜','unkindCount'],['ëŒ€ì™¸ë¯¼ì› ê±´ìˆ˜','complaintCount'],['ì •ë³´ë³´í˜¸ ì ìˆ˜','securityScore'],['U+one ë¬´ì²´í—˜ë¥ (%)','noExperienceRate']].map(([l,k])=><label key={k} className="text-[10px] text-gray-500">{l}<input type="number" value={ext[k]??''} onChange={e=>setExt(k,e.target.value)} className="w-full mt-1 border rounded-lg px-2 py-2 text-xs"/></label>)}<label className="text-[10px] text-gray-500">ë§¤ì¥ ë ˆë²¨ë§<select value={ext.leveling||''} onChange={e=>setExt('leveling',e.target.value)} className="w-full mt-1 border rounded-lg px-2 py-2 text-xs"><option value="">ë¯¸ì…ë ¥</option><option value="4">Lv4</option><option value="below4">Lv4 ë¯¸ë§Œ</option></select></label><label className="text-[10px] text-gray-500 flex items-center gap-2 mt-4"><input type="checkbox" checked={!!ext.privacyViolation} onChange={e=>setExt('privacyViolation',e.target.checked)}/> ê°œì¸ì •ë³´ë³´í˜¸ìœ„ì›íšŒ ì ë°œ</label><div className="col-span-2 text-[10px] text-gray-400 bg-gray-50 rounded-lg p-2">ì†Œë…¸ ëª©í‘œ {daemyungTarget}ê±´ Â· MNP íƒ€ì‚¬ ê°€ë§ ëª©í‘œ {prospectTarget}ê±´ì€ íšŒì‚¬ ëª©í‘œ(35ê±´/21ê±´)ë¥¼ HS ê¸°ì¤€ìˆ˜ëŸ‰ ë¹„ì¤‘ìœ¼ë¡œ ìë™ ë°°ë¶„í•´ ë‹¬ì„± ì—¬ë¶€ë¥¼ íŒë‹¨í•©ë‹ˆë‹¤.</div></div></div>
      <div className="bg-white rounded-2xl border p-4"><div className="flex justify-between"><div><div className="text-sm font-bold">{monthLabel(month)} AAì„íŒ©íŠ¸ íšŒì‚¬ ëª©í‘œ</div><div className="text-[10px] text-gray-400">íšŒì‚¬ ëª©í‘œ ì…ë ¥ í›„ ê´€ë¦¬ì â†’ íšŒì‚¬ ëª©í‘œì˜ ë§¤ì¥ë³„ HS ê¸°ì¤€ìˆ˜ëŸ‰ ë¹„ì¤‘ìœ¼ë¡œ ìë™ ë°°ë¶„í•©ë‹ˆë‹¤. ë°˜ì˜ë¹„ì¤‘ í•©ê³„ëŠ” 100ì ìœ¼ë¡œ í™˜ì‚°í•˜ê³  í•­ëª©ë³„ 110%ê¹Œì§€ ì¸ì •í•©ë‹ˆë‹¤.</div></div><button onClick={saveAa} className="px-3 py-2 rounded-xl bg-gray-900 text-white text-xs font-bold h-fit">ëª©í‘œ ì €ì¥</button></div><div className="space-y-2 mt-3">{aaConfig.map((x,i)=><div key={x.key} className="grid grid-cols-[1fr_55px_90px] gap-2 items-center"><input value={x.label} onChange={e=>setAaConfig(v=>v.map((a,j)=>j===i?{...a,label:e.target.value}:a))} className="border rounded-lg px-2 py-1.5 text-xs"/><input type="number" value={x.weight} onChange={e=>setAaConfig(v=>v.map((a,j)=>j===i?{...a,weight:Number(e.target.value||0)}:a))} className="border rounded-lg px-2 py-1.5 text-xs text-right"/><input type="number" value={x.target} onChange={e=>setAaConfig(v=>v.map((a,j)=>j===i?{...a,target:Number(e.target.value||0)}:a))} className="border rounded-lg px-2 py-1.5 text-xs text-right"/></div>)}</div></div>
    </>}
  </div>;
}

function SalesManagerPayrollPanel({month,rows=[]}){
  const finalPerformances=useFinalStorePerformance(month);
  const branches=[...new Set(rows.map(row=>row.branch).filter(branch=>branch&&!NON_SALES_STORES.includes(branch)))];
  const branchValue=(branch,key,input)=>finalStoreMetric(finalPerformances?.[branch],key,input);
  const sumByBranch=(key,readInput)=>branches.reduce((total,branch)=>{
    const members=rows.filter(row=>row.branch===branch);
    return total+Number(branchValue(branch,key,members.reduce((sum,row)=>sum+Number(readInput(row)||0),0))||0);
  },0);
  const company={
    hs:sumByBranch('hs',row=>hsCount(row.draft||{})),
    simMnp:sumByBranch('simMnp',row=>(row.draft?.matrix?.[5]||[]).reduce((sum,value)=>sum+Number(value||0),0)),
    second:sumByBranch('second',row=>(row.draft?.matrix?.[7]||[]).reduce((sum,value)=>sum+Number(value||0),0)+Object.values(row.draft?.bundle2nd||{}).reduce((sum,value)=>sum+Number(value||0),0)),
    home:sumByBranch('home',row=>completedHomeCount(row.draft)),
    upsell:sumByBranch('upsell',row=>Number(row.draft?.tailoredCount||0)),
  };
  const result=calculateSalesManagerPayroll(company);
  const forecastFactor=monthKeyOf(new Date())===month?daysInMonth(month)/Math.max(1,new Date().getDate()):1;
  // íšŒì‚¬ ì •ì±…ì˜ ê¸°ì¤€ ì´ëŸ‰ì€ 2NDë§Œ 0.2ë¡œ í™˜ì‚°í•˜ê³ , ì§€ê¸‰ ëŒ€ìƒ HSÂ·í™ˆÂ·ì—…ì…€ì€ ì •ìˆ˜ ê±´ìœ¼ë¡œ ê³„ì‚°í•©ë‹ˆë‹¤.
  const forecastCompany=Object.fromEntries(Object.entries(company).map(([key,value])=>[key,Math.round(Number(value||0)*forecastFactor)]));
  const forecastResult=calculateSalesManagerPayroll(forecastCompany);
  const activePolicy=month>='2026-09';
  if(!activePolicy)return <div className="bg-white rounded-2xl border p-5 text-center"><div className="text-sm font-bold text-gray-700">ì˜ì—…ë‹´ë‹¹ ì •ì±…ì€ 2026ë…„ 9ì›”ë¶€í„° ì ìš©ë¼ìš”</div><div className="text-xs text-gray-400 mt-1">ìƒë‹¨ì—ì„œ 2026ë…„ 9ì›” ì´í›„ë¥¼ ì„ íƒí•´ ì£¼ì„¸ìš”.</div></div>;
  return <div className="space-y-3">
    <div className="rounded-2xl bg-gradient-to-br from-slate-800 to-violet-800 text-white p-4 shadow-sm">
      <div><div className="text-[11px] text-violet-100">{SALES_MANAGER_POLICY_VERSION} ì •ì±… Â· ì›”ì¤‘ ì˜ˆìƒ</div><div className="text-lg font-black mt-1">ì˜ì—…ë‹´ë‹¹ ê¸‰ì—¬</div><div className="text-xs text-violet-100 mt-1">ê¹€ì§„ë°± Â· ì„ì„±ì¤€ ë™ì¼í•œ íšŒì‚¬ ì „ì²´ ì‹¤ì  ì ìš©</div></div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mt-4 rounded-xl bg-white/10 px-3 py-3"><div><div className="text-[11px] text-violet-100">í˜„ì¬ ê¸°ì¤€ì•¡</div><div className="text-xl font-black mt-1">{won(result.finalPay)}</div></div><div className="text-violet-200 text-xl">â†’</div><div className="text-right"><div className="text-[11px] text-violet-100">ì›”ë§ ì˜ˆìƒì•¡</div><div className="text-xl font-black mt-1">{won(forecastResult.finalPay)}</div></div></div>
      <div className="mt-2 text-[11px] text-violet-100 text-right">í˜„ì¬ {Math.round(forecastFactor===1?100:100/forecastFactor)}% ê²½ê³¼ ê¸°ì¤€ ì˜ˆìƒ</div>
      {result.guaranteeAdjustment>0&&<div className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-xs">í˜„ì¬ ìµœì € 600ë§Œì› ë³´ì¥ ì°¨ì•¡ +{won(result.guaranteeAdjustment)} ë°˜ì˜</div>}
    </div>
    <div className="grid grid-cols-2 gap-2">
      {[['ê¸°ë³¸ê¸‰',2500000,2500000],['ì§ì±…ìˆ˜ë‹¹',800000,800000],['HS ì¸ì„¼í‹°ë¸Œ',result.hsIncentive,forecastResult.hsIncentive],['í™ˆ ì¸ì„¼í‹°ë¸Œ',result.homeIncentive,forecastResult.homeIncentive],['ë§ì¶¤ì œì•ˆ ì—…ì…€',result.upsellIncentive,forecastResult.upsellIncentive],['ë³´ì¥ ì°¨ì•¡',result.guaranteeAdjustment,forecastResult.guaranteeAdjustment]].map(([label,value,forecast])=><div key={label} className="bg-white rounded-xl border p-3"><div className="text-[11px] text-gray-400">{label}</div><div className="text-base font-black text-gray-800 mt-1">{won(value)}</div>{Number(value)!==Number(forecast)&&<div className="text-[11px] font-bold text-violet-600 mt-1">ì˜ˆìƒ {won(forecast)}</div>}</div>)}
    </div>
    <div className="bg-white rounded-2xl border overflow-hidden">
      <div className="px-4 py-3 border-b"><div className="text-sm font-bold">íšŒì‚¬ ì „ì²´ ì ìš© ê·¼ê±°</div><div className="text-[11px] text-gray-400 mt-1">ë‘ ì˜ì—…ë‹´ë‹¹ ëª¨ë‘ ê°™ì€ íšŒì‚¬ ì „ì²´ ì‹¤ì ê³¼ êµ¬ê°„ ë‹¨ê°€ë¥¼ ì ìš©í•©ë‹ˆë‹¤.</div></div>
      <div className="divide-y">
        <div className="px-4 py-3 flex justify-between gap-3"><div><b className="text-sm">ëª¨ë°”ì¼ ì´ëŸ‰ {fmtNum(result.mobileVolume,1)}ê±´</b><div className="text-[11px] text-gray-400 mt-1">HS {fmtCount(company.hs)} + SIM MNP {fmtCount(company.simMnp)} + 2ND {fmtNum(company.second,1)}Ã—0.2</div><div className="text-[11px] font-semibold text-violet-600 mt-1">ì›”ë§ ì˜ˆìƒ {fmtNum(forecastResult.mobileVolume,1)}ê±´</div></div><div className="text-right"><b className="text-violet-700">HS ê±´ë‹¹ {won(result.mobileTier.rate)}</b><div className="text-[11px] font-semibold text-violet-600 mt-1">ì˜ˆìƒ ê±´ë‹¹ {won(forecastResult.mobileTier.rate)}</div><div className="text-[10px] text-gray-400 mt-1">ì˜ˆìƒ HS {fmtCount(forecastCompany.hs)}ê±´ ì ìš©</div></div></div>
        <div className="px-4 py-3 flex justify-between gap-3"><div><b className="text-sm">ì„¤ì¹˜ ì™„ë£Œ í™ˆ {fmtCount(company.home)}ê±´</b><div className="text-[11px] text-gray-400 mt-1">ê°€ì •ë§Â·ì†Œí˜¸ ëª¨ë‘ í¬í•¨</div><div className="text-[11px] font-semibold text-violet-600 mt-1">ì›”ë§ ì˜ˆìƒ {fmtNum(forecastCompany.home,1)}ê±´</div></div><div className="text-right"><b className="text-violet-700">í™ˆ ê±´ë‹¹ {won(result.homeTier.rate)}</b><div className="text-[11px] font-semibold text-violet-600 mt-1">ì˜ˆìƒ ê±´ë‹¹ {won(forecastResult.homeTier.rate)}</div><div className="text-[10px] text-gray-400 mt-1">ì˜ˆìƒ í™ˆ ì „ì²´ ì ìš©</div></div></div>
        <div className="px-4 py-3 flex justify-between gap-3"><div><b className="text-sm">ë§ì¶¤ì œì•ˆ ì—…ì…€ {fmtCount(company.upsell)}ê±´</b><div className="text-[11px] text-gray-400 mt-1">íšŒì‚¬ ì „ì²´ 500ê±´ ì´ìƒë¶€í„° ì „ ê±´ ì ìš©</div><div className="text-[11px] font-semibold text-violet-600 mt-1">ì›”ë§ ì˜ˆìƒ {fmtNum(forecastCompany.upsell,1)}ê±´</div></div><div className="text-right"><b className="text-violet-700">ê±´ë‹¹ {won(result.upsellRate)}</b><div className="text-[11px] font-semibold text-violet-600 mt-1">ì˜ˆìƒ ê±´ë‹¹ {won(forecastResult.upsellRate)}</div><div className="text-[10px] text-gray-400 mt-1">{forecastResult.upsellRate?'ì˜ˆìƒ ì§€ê¸‰ êµ¬ê°„':'ì˜ˆìƒë„ ì§€ê¸‰ ì „'}</div></div></div>
      </div>
    </div>
    <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-800 leading-relaxed"><b>ë¶„ê¸°ë³„ ë³„ë„ ì •ì‚°</b><br/>ë‹´ë‹¹ ë§¤ì¥ HSÂ·í™ˆ í•©ì‚° ë‹¬ì„±ë¥  í‰ê·  ìš°ìˆ˜ 100ë§Œì›, AAì„íŒ©íŠ¸ í‰ê·  ìš°ìˆ˜ 50ë§Œì›ì€ ë¶„ê¸° í‰ê°€ í›„ ë³„ë„ë¡œ ì •ì‚°ë˜ë©° í˜„ì¬ ì›” ê¸‰ì—¬ ì˜ˆìƒì•¡ì—ëŠ” í¬í•¨ë˜ì§€ ì•ŠìŠµë‹ˆë‹¤.</div>
  </div>;
}

function ManagerPayrollPanel({month,employees=[],rows=[],authUserId,canSwitchStores=false,loginBranch=''}){
  const viewer=employees.find(employee=>employee.id===authUserId);
  const canViewSales=COMPANY_SCOPE_VIEWERS.has(viewer?.name)||!!SALES_MANAGER_AREAS[viewer?.name];
  const [mode,setMode]=useState('store');
  return <div className="space-y-3">
    <div><div className="text-xs text-violet-600 font-semibold">ê´€ë¦¬ì ê¸‰ì—¬</div><div className="text-xl font-bold text-gray-900">ì›” ê¸‰ì—¬ ì˜ˆìƒ</div><div className="text-xs text-gray-400 mt-1">í˜„ì¬ ì…ë ¥Â·ì™„ë£Œ ì‹¤ì  ê¸°ì¤€ì´ë©° ì›” ë§ˆê° ì‹œ ìµœì¢… ê¸ˆì•¡ì´ ë‹¬ë¼ì§ˆ ìˆ˜ ìˆì–´ìš”.</div></div>
    {canViewSales&&<div className="grid grid-cols-2 bg-gray-100 rounded-xl p-1 gap-1"><button onClick={()=>setMode('store')} className={`py-2.5 rounded-lg text-xs font-bold ${mode==='store'?'bg-white text-violet-700 shadow-sm':'text-gray-500'}`}>ë§¤ì¥ ìš´ì˜ ê´€ë¦¬ì</button><button onClick={()=>setMode('sales')} className={`py-2.5 rounded-lg text-xs font-bold ${mode==='sales'?'bg-white text-violet-700 shadow-sm':'text-gray-500'}`}>ì˜ì—…ë‹´ë‹¹</button></div>}
    {mode==='sales'&&canViewSales?<SalesManagerPayrollPanel month={month} rows={rows}/>:<ManagerEvaluationPanel month={month} employees={employees} rows={rows} authUserId={authUserId} canSwitchStores={canSwitchStores} loginBranch={loginBranch} payrollOnly/>}
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
  const mnpRi=MATRIX_ROWS.indexOf('ì¼ë°˜ëª¨ë¸ MNP');
  const mnp=mobile.filter(x=>Number(x.source_meta?.ri)===mnpRi).length;
  const second=mobile.reduce((sum,x)=>sum+(x.source_meta?.bundle2ndKeys||[]).length,0);
  const strategicPlan=mobile.filter(x=>!!x.source_meta?.strategicPlan).length;

  // í™ˆì€ ë™ì¼ ê³ ê°/ë‚ ì§œì˜ ì¸í„°ë„·ì„ 1ê±´ìœ¼ë¡œ ê³„ì‚°. ì˜¬ì¸ì› í¬í•¨.
  const internetKeys=new Set();
  let free=0,smart=0;
  (homeOrders||[]).forEach(o=>{
    const d=homePerformanceDate(o);
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
        supabase.from('home_orders').select('id,user_id,customer_id,customer_name,product_type,sale_type,status,source_work_date,actual_install_date').in('user_id',ids).or(`source_work_date.gte.${month}-01,actual_install_date.gte.${month}-01`),
        supabase.from('daily_records').select('user_id,work_date,data').in('user_id',ids).gte('work_date',`${month}-01`).lt('work_date',to)
      ]);
      const map={};ids.forEach(id=>map[id]={sales:[],home:[],sono:0});
      (sr.data||[]).forEach(x=>map[x.user_id]?.sales.push(x));
      (hr.data||[]).filter(x=>{const d=homePerformanceDate(x);return x.status==='completed'&&d>=`${month}-01`&&d<to}).forEach(x=>map[x.user_id]?.home.push(x));
      (dr.data||[]).forEach(x=>{const g=x.data?.groups?.sono||{};if(map[x.user_id])map[x.user_id].sono+=Object.values(g).reduce((a,v)=>a+Number(v||0),0)});
      const result={};ids.forEach(id=>result[id]=qualityFromSales(map[id]?.sales||[],map[id]?.home||[],map[id]?.sono||0));setData(result);setLoading(false);
    })().catch(err=>{console.error('SALES QUALITY LOAD ERROR',err);const result={};ids.forEach(id=>result[id]=qualityFromSales([],[],0));setData(result);setLoading(false);});
  },[month,ids.join('|')]);

  if(loading)return <div className="bg-white rounded-xl border p-4 text-sm text-gray-400">íŒë§¤ í€„ë¦¬í‹° ê³„ì‚° ì¤‘...</div>;
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
      <QualityMetricCard label="115êµ° ë¹„ì¤‘" value={`${safe.plan115Pct}%`} sub={`${safe.plan115}/${safe.hs}ê±´`} />
      <QualityMetricCard label="í™ˆ(ì¸í„°ë„·) ë¹„ì¤‘" value={`${safe.homePct}%`} sub={`${safe.home}/${safe.hs}ê±´ Â· ì˜¬ì¸ì› í¬í•¨`} />
      <QualityMetricCard label="í”„ë¦¬+ìŠ¤í™ˆ ë¹„ì¤‘" value={`${safe.freeSmartPct}%`} sub={`${safe.freeSmart}/${safe.hs}ê±´ Â· ìƒí’ˆìˆ˜ ê¸°ì¤€`} />
      <QualityMetricCard label="MNP ë¹„ì¤‘" value={`${safe.mnpPct}%`} sub={`${safe.mnp}/${safe.hs}ê±´`} />
      <QualityMetricCard label="2ND ë²ˆë“¤ ë¹„ì¤‘" value={`${safe.secondPct}%`} sub={`${safe.second}/${safe.hs}ê±´ Â· ìƒí’ˆìˆ˜ ê¸°ì¤€`} />
      <QualityMetricCard label="ë§¤ì¶œì§€í‘œ" value={`${safe.revenuePct}%`} sub={`ì´ ${safe.revenuePoints.toFixed(1)}P / HS ${safe.hs}ê±´`} />
    </div>;
  };

  if(!isManager)return <div className="space-y-3"><div><div className="text-xs text-violet-600 font-semibold">ë³´ì¡°ì§€í‘œ</div><div className="text-lg font-bold">íŒë§¤ í€„ë¦¬í‹° Â· {monthLabel(month)}</div><div className="text-[10px] text-gray-400 mt-1">í‰ê°€ì ìˆ˜ì—ëŠ” ë°˜ì˜ë˜ì§€ ì•ŠìŠµë‹ˆë‹¤.</div></div>{render(data[employee?.id])}</div>;

  const stores=sortStoresByOpenOrder([...new Set(scoped.map(e=>e.branch))]);
  const selectedStore=storeFilter||stores[0]||'';
  const members=scoped.filter(e=>e.branch===selectedStore);
  const emptyAgg={hs:0,plan115:0,home:0,freeSmart:0,mnp:0,second:0,strategicPlan:0,insurance:0,strategicVas:0,sono:0,revenuePoints:0};
  const agg=members.reduce((a,e)=>{const q=data[e.id];if(!q)return a;Object.keys(emptyAgg).forEach(k=>a[k]=Number(a[k]||0)+Number(q[k]||0));return a},{...emptyAgg});
  const storeQ={...agg,plan115Pct:qualityPct(agg.plan115,agg.hs),homePct:qualityPct(agg.home,agg.hs),freeSmartPct:qualityPct(agg.freeSmart,agg.hs),mnpPct:qualityPct(agg.mnp,agg.hs),secondPct:qualityPct(agg.second,agg.hs),revenuePct:qualityPct(agg.revenuePoints,agg.hs)};
  if(!stores.length)return <div className="bg-white rounded-xl border p-5"><div className="text-sm font-bold text-gray-800">íŒë§¤ í€„ë¦¬í‹°</div><div className="text-xs text-gray-400 mt-1">ì¡°íšŒ ê°€ëŠ¥í•œ ë§¤ì¥ì´ ì—†ìŠµë‹ˆë‹¤.</div></div>;
  return <div className="space-y-3"><div className="flex justify-between items-end gap-2"><div><div className="text-xs text-violet-600 font-semibold">íŒë§¤ í€„ë¦¬í‹°</div><div className="text-lg font-bold">ë§¤ì¥/ì§ì› ë³´ì¡°ì§€í‘œ</div><div className="text-[10px] text-gray-400 mt-1">ë§¤ì¥ ìˆ˜ì¹˜ëŠ” ì§ì› ë¹„ìœ¨ í‰ê· ì´ ì•„ë‹ˆë¼ ë§¤ì¥ ì „ì²´ HS ê¸°ì¤€ìœ¼ë¡œ ì¬ê³„ì‚°í•©ë‹ˆë‹¤.</div></div><select value={selectedStore} onChange={e=>setStoreFilter(e.target.value)} className="border rounded-lg px-2 py-2 text-xs">{stores.map(st=><option key={st} value={st}>{displayStoreName(st)}</option>)}</select></div>
    <div className="bg-violet-50/50 border border-violet-100 rounded-xl p-3"><div className="text-sm font-bold mb-2">{displayStoreName(selectedStore)} ì „ì²´</div>{render(storeQ)}</div>
    <div className="space-y-2">{members.length?members.map(e=><div key={e.id} className="bg-white border rounded-xl p-3"><div className="font-bold text-sm mb-2">{e.name}</div>{render(data[e.id])}</div>):<div className="bg-white border rounded-xl p-4 text-xs text-gray-400">ì´ ë§¤ì¥ì— ì¡°íšŒ ê°€ëŠ¥í•œ ì§ì›ì´ ì—†ìŠµë‹ˆë‹¤.</div>}</div>
  </div>;
}

function EvaluationTab({ month, employee, config, isManagerView=false, canFinalApprove=false, employees=[], rows=[], authUserId, canSwitchStores=false, loginBranch='' }){
  const [mode,setMode]=useState('career');
  const managerEligible=isManagerView;
  return <div className="space-y-3"><div><div className="text-xs text-violet-600 font-semibold">í‰ê°€</div><div className="text-xl font-bold text-gray-900">{mode==='quality'?'íŒë§¤ í€„ë¦¬í‹°':'ì»¤ë¦¬ì–´ ë“±ê¸‰'}</div></div><div className={`grid ${managerEligible?'grid-cols-3':'grid-cols-2'} bg-gray-100 rounded-xl p-1 gap-1`}><button onClick={()=>setMode('career')} className={`py-2 rounded-lg text-xs font-bold ${mode==='career'?'bg-white text-violet-700 shadow-sm':'text-gray-500'}`}>ê°œì¸ ì»¤ë¦¬ì–´ ë“±ê¸‰</button>{managerEligible&&<button onClick={()=>setMode('manager')} className={`py-2 rounded-lg text-xs font-bold ${mode==='manager'?'bg-white text-violet-700 shadow-sm':'text-gray-500'}`}>ê´€ë¦¬ì í‰ê°€</button>}<button onClick={()=>setMode('quality')} className={`py-2 rounded-lg text-xs font-bold ${mode==='quality'?'bg-white text-violet-700 shadow-sm':'text-gray-500'}`}>íŒë§¤ í€„ë¦¬í‹°</button></div>{mode==='career'?<CareerEvaluationPanel employee={employee} month={month} config={config} canManage={managerEligible} canFinalApprove={canFinalApprove} managerScopeEmployees={employees}/>:mode==='manager'?<ManagerEvaluationPanel month={month} employees={employees} rows={rows} authUserId={authUserId} canSwitchStores={canSwitchStores} loginBranch={loginBranch}/>:<SalesQualityPanel month={month} employee={employee} employees={employees} isManager={managerEligible} loginBranch={loginBranch} canSwitchStores={canSwitchStores}/>}</div>;
}


/* ===================== ì§ì› í™”ë©´ ===================== */

/* v21.27 ì§ì› í™ˆ ì¬êµ¬ì„±: í™ˆ-ê°œì¸ / í™ˆ-ë§¤ì¥, ì›” ëˆ„ì  ì„±ê³¼ ë­í‚¹ */

const MONTHLY_RANK_METRICS = [
  { key:'hs', label:'HS', unit:'ê±´', value:(r)=>hsCount(r.draft) },
  { key:'home', label:'í™ˆ', unit:'ê±´', value:(r)=>completedHomeCount(r.draft) },
  { key:'free', label:'í”„ë¦¬', unit:'ê±´', value:(r)=>Number(r.draft?.homeFlat?.tvFree||0) },
  { key:'smart', label:'ìŠ¤í™ˆ', unit:'ê±´', value:(r)=>Number(r.draft?.homeFlat?.smartHome||0) },
  { key:'productivity', label:'ìƒì‚°ì„±', unit:'P', value:(r)=>Number(r.pay?.kpiScore||0) },
  { key:'upsell', label:'ë§ì¶¤ì œì•ˆ ì—…ì…€ê±´', unit:'ê±´', value:(r)=>Number(r.draft?.tailoredCount||0) },
];

function MonthlyPerformanceRankingCard({ rows, userId, userName='', userBranch='', branchOnly=null, title='ì›” ëˆ„ì  ìˆœìœ„', showAll=false }) {
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
  // v21.35: ë¡œê·¸ì¸ auth idì™€ ì§ì› row idê°€ ë‹¤ë¥¸ í™˜ê²½ë„ ìˆì–´ í˜„ì¬ ì§ì› ì •ë³´ë¡œ í•œ ë²ˆ ë” ì°¾ìŒ
  let myIndex=ranked.findIndex(r=>String(r.id||'')===String(userId||''));
  if(myIndex<0 && userName){
    myIndex=ranked.findIndex(r=>
      String(r.name||'').trim()===String(userName||'').trim() &&
      (!userBranch || String(r.branch||'')===String(userBranch||''))
    );
  }
  let me=myIndex>=0?ranked[myIndex]:null;

  // ê²½ìŸí–‰ì— í˜„ì¬ ì§ì› ìì²´ê°€ ë¹ ì§„ ê²½ìš°ì—ë„ 0 ì‹¤ì ìœ¼ë¡œ 'ë‚˜' í–‰ì„ í•­ìƒ ë§Œë“¤ì–´ ì¤Œ
  const fallbackMe=!me && (userId||userName) ? {
    id:userId||'current-user',
    name:userName||'ë‚˜',
    branch:userBranch||branchOnly||'',
    draft:{},
    pay:{kpiScore:0}
  } : null;
  me=me||fallbackMe;

  const myValue=Number(metric.value(me)||0);
  const myRank=me ? 1+ranked.filter(r=>Number(metric.value(r)||0)>myValue).length : null;
  const sameValueCount=me ? ranked.filter(r=>Number(metric.value(r)||0)===myValue).length + (fallbackMe?1:0) : 0;
  const myTied=sameValueCount>1;
  const fmt=(v)=>metric.unit==='P'?`${fmtNum(Number(v||0),1)}P`:`${fmtCount(v)}ê±´`;

  return <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
    <div className="px-4 py-3 border-b border-gray-50">
      <div className="flex items-end justify-between gap-2">
        <div>
          <div className="text-[11px] text-gray-400">{branchOnly?displayStoreName(branchOnly):'ì „ì²´ ì§ì›'}</div>
          <div className="text-sm font-bold text-gray-900">{title}</div>
        </div>
        <div className="text-[10px] text-gray-400">ì›” ëˆ„ì  ê¸°ì¤€</div>
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
            <div className="text-xs font-semibold text-gray-800 truncate">{r.name}{showAll&&isMe&&<span className="ml-1 text-[9px] text-violet-600">ë‚˜</span>}</div>
            {!branchOnly&&<div className="text-[10px] text-gray-400 truncate">{displayStoreName(r.branch)}</div>}
          </div>
        </div>
        <div className="text-xs font-bold text-gray-800">{fmt(metric.value(r))}</div>
      </div>})}
    </div>

    {!showAll&&me&&<div className="px-4 py-2.5 bg-violet-50 flex items-center justify-between">
      <span className="text-xs font-semibold text-violet-700">ë‚˜ Â· {myTied?'ê³µë™ ':''}{fmtCount(myRank)}ìœ„</span>
      <span className="text-xs font-bold text-violet-700">{fmt(metric.value(me))}</span>
    </div>}
  </div>;
}

function StoreHomeOverview({ rows, branches=[], scopeLabel='', month, userId, userName='', canEditGoals=false, onOpenGoals, showRanking=true }) {
  const scopedBranches=[...new Set((branches||[]).filter(Boolean).filter(branch=>!NON_SALES_STORES.includes(branch)))];
  const members=(rows||[]).filter(r=>scopedBranches.includes(r.branch));
  const finalPerformances=useFinalStorePerformance(month);
  const [savedGoals,setSavedGoals]=useState({});
  const branchKey=scopedBranches.join('|');
  useEffect(()=>{
    let alive=true;
    if(!scopedBranches.length){setSavedGoals({});return()=>{alive=false};}
    supabase.from('store_goals').select('store_name,company_goals,challenge_goals').eq('month',month).in('store_name',scopedBranches)
      .then(({data})=>{if(alive)setSavedGoals(Object.fromEntries((data||[]).map(goal=>[goal.store_name,{...(goal.company_goals||{}),...(goal.challenge_goals||{})}])))});
    return()=>{alive=false};
  },[branchKey,month]); // eslint-disable-line react-hooks/exhaustive-deps
  if(!scopedBranches.length || !members.length)return <div className="bg-white rounded-2xl border border-gray-100 p-4 text-sm text-gray-400">í˜„ì¬ ì„ íƒ ë²”ìœ„ì˜ ë§¤ì¥ ì‹¤ì ì„ ë¶ˆëŸ¬ì˜¬ ìˆ˜ ì—†ì–´ìš”.</div>;

  const sum=(fn)=>members.reduce((a,r)=>a+Number(fn(r)||0),0);
  const goal=scopedBranches.reduce((total,branch)=>{
    const branchGoal={...companyGoalDefaults(branch),...(savedGoals[branch]||{})};
    Object.entries(branchGoal).forEach(([key,value])=>{total[key]=Number(total[key]||0)+Number(value||0)});
    return total;
  },{});
  const forecastFactor=monthKeyOf(new Date())===month?daysInMonth(month)/Math.max(1,new Date().getDate()):1;

  const inputMetrics=[
    {key:'hs',label:'HS',unit:'count',current:sum(r=>hsCount(r.draft)),target:Number(goal.hs||0)},
    {key:'simMnp',label:'SIM MNP',unit:'count',current:sum(r=>(r.draft?.matrix?.[5]||[]).reduce((s,v)=>s+Number(v||0),0)),target:Number(goal.simMnp||0)},
    {key:'second',label:'2ND',unit:'count',current:sum(r=>(r.draft?.matrix?.[7]||[]).reduce((s,v)=>s+Number(v||0),0)+Object.values(r.draft?.bundle2nd||{}).reduce((s,v)=>s+Number(v||0),0)),target:Number(goal.second||0)},
    {key:'productivity',label:'ìƒì‚°ì„±',unit:'point',current:sum(r=>r.pay?.kpiScore||0),target:Number(goal.productivity||goal.kpi||0)},
    {key:'home',label:'í™ˆ',unit:'count',current:sum(r=>completedHomeCount(r.draft)),target:Number(goal.home||0)},
    {key:'free',label:'í”„ë¦¬',unit:'count',current:sum(r=>r.draft?.homeFlat?.tvFree||0),target:Number(goal.tvFree||goal.free||0)},
    {key:'smart',label:'ìŠ¤í™ˆ',unit:'count',current:sum(r=>r.draft?.homeFlat?.smartHome||0),target:Number(goal.smartHome||goal.smart||0)},
    {key:'sono',label:'ì†Œë…¸',unit:'count',current:sum(r=>Object.values(r.draft?.sono||{}).reduce((s,v)=>s+Number(v||0),0)),target:Number(goal.sono||0)},
    {key:'tailoredAmount',label:'ë§ì¶¤ì œì•ˆ ë§¤ì¶œì•¡',unit:'won',current:sum(r=>r.draft?.tailoredAmount||0),target:Number(goal.tailoredAmount||0)},
    {key:'tailored',label:'ì—…ì…€ê±´',unit:'count',current:sum(r=>r.draft?.tailoredCount||0),target:Number(goal.tailoredCount||goal.tailored||0)},
  ];
  const metrics=inputMetrics.map(m=>{
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
      return total+finalStoreMetric(finalPerformances?.[branch],m.key,inputValue);
    },0);
    return {...m,inputCurrent:m.current,current};
  });

  const fmtValue=(m,v)=>{
    if(m.unit==='won')return won(Math.round(v));
    if(m.unit==='point')return `${fmtNum(Number(v||0),1)}P`;
    return `${fmtNum(Number(v||0),Number(v||0)%1?1:0)}ê±´`;
  };

  return <div className="space-y-4">
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-50">
        <div className="text-xs text-gray-400">ğŸ“Š {monthLabel(month)}</div>
        <div className="text-sm font-bold text-gray-900 mt-0.5">{scopeLabel||displayStoreName(scopedBranches[0])} ëª©í‘œ í˜„í™©</div>
        <div className="text-[10px] text-gray-400 mt-1">{scopedBranches.length>1?`${scopedBranches.length}ê°œ ë§¤ì¥ ëˆ„ì  ì‹¤ì ê³¼ í•©ì‚° ëª©í‘œì…ë‹ˆë‹¤.`:'ë§¤ì¥ ëˆ„ì  ì‹¤ì ê³¼ ëª©í‘œ ë‹¬ì„±ë¥ ì„ í•œ ë²ˆì— í™•ì¸í•´ìš”.'}</div>
      </div>

      <div className="px-3 py-2">
        <div className="grid grid-cols-[minmax(72px,1.25fr)_minmax(58px,1fr)_minmax(55px,.9fr)_minmax(48px,.8fr)_minmax(66px,1fr)] gap-1 px-2 pb-2 text-[9px] text-gray-400 text-right"><span className="text-left">í•­ëª©</span><span>ëª©í‘œ</span><span>ì‹¤ì </span><span>ì§„ì²™ë„</span><span>ì˜ˆìƒ ë§ˆê°</span></div>
        <div className="divide-y divide-gray-100">
        {metrics.map(m=>{
          const hasGoal=Number(m.target||0)>0;
          const pct=hasGoal?Math.max(0,Math.round(Number(m.current||0)/Number(m.target||1)*100)):null;
          const rawForecast=Number(m.current||0)*forecastFactor;
          const forecast=m.unit==='count'?Math.round(rawForecast):rawForecast,forecastHit=hasGoal&&forecast>=m.target;
          return <div key={m.key} className="grid grid-cols-[minmax(72px,1.25fr)_minmax(58px,1fr)_minmax(55px,.9fr)_minmax(48px,.8fr)_minmax(66px,1fr)] gap-1 items-center px-2 py-2.5 text-right text-[10px]">
            <span className="text-left font-semibold text-gray-700 truncate">{m.label}</span>
            {hasGoal?<span className="text-gray-500 whitespace-nowrap">{fmtValue(m,m.target)}</span>:canEditGoals?<button type="button" onClick={onOpenGoals} className="justify-self-end rounded-md bg-red-50 px-1.5 py-1 text-[8px] font-bold leading-tight text-red-600">ì…ë ¥ í•„ìš”</button>:<span className="justify-self-end rounded-md bg-gray-100 px-1.5 py-1 text-[8px] font-bold leading-tight text-gray-500">ê´€ë¦¬ì ì…ë ¥ í•„ìš”</span>}
            <span className="font-bold text-gray-900 whitespace-nowrap">{fmtValue(m,m.current)}{Number(m.current)!==Number(m.inputCurrent)&&<span className="block text-[8px] font-normal text-gray-400">ì…ë ¥ {fmtValue(m,m.inputCurrent)}</span>}</span>
            <span className={`font-bold ${pct===null?'text-gray-300':pct>=100?'text-emerald-600':pct>=80?'text-amber-600':'text-gray-500'}`}>{pct===null?'â€”':`${pct}%`}</span>
            <span className={`font-bold whitespace-nowrap ${hasGoal?(forecastHit?'text-emerald-600':'text-red-500'):'text-violet-600'}`}>{fmtValue(m,forecast)}</span>
          </div>;
        })}
        </div>
      </div>
    </div>

    {showRanking&&<MonthlyPerformanceRankingCard
      rows={members}
      userId={userId}
      userName={userName}
      userBranch={scopedBranches.length===1?scopedBranches[0]:''}
      branchOnly={scopedBranches.length===1?scopedBranches[0]:''}
      title={`${scopeLabel||displayStoreName(scopedBranches[0])} ì›” ëˆ„ì  ìˆœìœ„`}
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
      if (!dayHasData(rec)) continue; // ì˜¤ëŠ˜ì€ ì•„ì§ ì…ë ¥ ì „ì´ì–´ë„ ê¸°ì¡´ ì—°ì† ê¸°ë¡ ìœ ì§€
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
    message = `${monthLabel(month)} í™œë™ ê¸°ë¡ì´ì—ìš”`;
  } else if (stats.todayOff) {
    message = 'ì˜¤ëŠ˜ì€ íœ´ë¬´ì˜ˆìš”. í‘¹ ì‰¬ê³  ë‹¤ìŒ ê·¼ë¬´ì¼ë¶€í„° ì´ì–´ê°€ìš” :)';
  } else if (stats.todayHasData) {
    message = stats.streak > 0 ? 'ì˜¤ëŠ˜ ê¸°ë¡ë„ ì´ì–´ì¡Œì–´ìš” ğŸ™Œ' : 'ì˜¤ëŠ˜ ê¸°ë¡ ì™„ë£Œ ğŸ™Œ';
  } else if (stats.streak > 0) {
    message = `ì˜¤ëŠ˜ ê¸°ë¡í•˜ë©´ ${stats.streak + 1}ì¼ ì—°ì†!`;
  } else {
    message = 'ì˜¤ëŠ˜ë¶€í„° ì²« ê¸°ë¡ì„ ë‚¨ê²¨ë³´ì„¸ìš” ğŸŒ±';
  }

  return (
    <button onClick={onGoInput} className="w-full text-left bg-white rounded-xl border border-orange-100 p-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center text-lg shrink-0">ğŸ”¥</div>
        <div className="min-w-0 flex-1">
          <div className="text-xs text-gray-400">ì´ë²ˆ ë‹¬ í™œë™</div>
          <div className="text-base font-bold text-gray-900 mt-0.5">
            {stats.streak > 0 ? `${stats.streak}ê·¼ë¬´ì¼ ì—°ì† ê¸°ë¡ ì¤‘` : 'ê¸°ë¡ì„ ì‹œì‘í•´ë³¼ê¹Œìš”?'}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">{message}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-lg font-bold text-orange-600">{stats.activeDays}</div>
          <div className="text-[10px] text-gray-400">í™œë™ì¼</div>
        </div>
      </div>
    </button>
  );
}

const COMPETITION_METRICS = [
  { key: 'hs', label: 'HS', unit: 'ê±´', value: (r) => hsCount(r.draft) },
  { key: 'home', label: 'í™ˆ', unit: 'ê±´', value: (r) => completedHomeCount(r.draft) },
  { key: 'tvFree', label: 'TVí”„ë¦¬(ë¶€)', unit: 'ê±´', value: (r) => Number(r.draft?.homeFlat?.tvFree || 0) },
  { key: 'smartHome', label: 'ìŠ¤ë§ˆíŠ¸í™ˆ', unit: 'ê±´', value: (r) => Number(r.draft?.homeFlat?.smartHome || 0) },
  { key: 'kpi', label: 'ìƒì‚°ì„±', unit: 'P', value: (r) => Number(r.pay?.kpiScore || 0) },
  { key: 'tailored', label: 'ë§ì¶¤ì œì•ˆ', unit: 'ê±´', value: (r) => Number(r.draft?.tailoredCount || 0) },
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
    employee?.position || 'ì‚¬ì›',
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
          <div className="text-xs text-orange-500">ìµœê·¼ 7ì¼</div>
          <div className="text-sm font-bold text-gray-900">ê¸‰ìƒìŠ¹ ë­í‚¹ ğŸ”¥</div>
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
          <div className="text-xs font-semibold text-violet-700">ë‚˜ëŠ” í˜„ì¬ {myIndex + 1}ìœ„</div>
          <div className="text-sm font-bold text-violet-700">
            +{formatCompetitionValue(me.recentValue, metric.unit)}
          </div>
        </div>
      )}
    </div>
  );
}

function formatCompetitionValue(v, unit) {
  return unit === 'P' ? `${fmtNum(Number(v || 0), 1)}P` : `${fmtCount(v)}ê±´`;
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
          <div className="text-xs text-gray-400">ë‚´ ì£¼ë³€ ìˆœìœ„</div>
          <div className="text-sm font-bold text-gray-900">ì „ì²´ {idx + 1}ìœ„ Â· {mine.name}</div>
        </div>
        <select value={metricKey} onChange={(e) => setMetricKey(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
          {COMPETITION_METRICS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select>
      </div>

      <div className="space-y-1.5">
        {above && (
          <div className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-gray-50">
            <span>{idx}ìœ„ Â· {above.name}</span>
            <b>{formatCompetitionValue(metric.value(above), metric.unit)}</b>
          </div>
        )}
        <div className="flex items-center justify-between text-sm px-3 py-2 rounded-lg bg-violet-50 text-violet-800">
          <span className="font-bold">{idx + 1}ìœ„ Â· {mine.name}</span>
          <b>{formatCompetitionValue(metric.value(mine), metric.unit)}</b>
        </div>
        {below && (
          <div className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-gray-50">
            <span>{idx + 2}ìœ„ Â· {below.name}</span>
            <b>{formatCompetitionValue(metric.value(below), metric.unit)}</b>
          </div>
        )}
      </div>

      {above && (
        <div className="text-xs text-gray-500 mt-3">
          {idx === 1 ? '1ìœ„' : `${idx}ìœ„`}ê¹Œì§€ <b className="text-violet-700">
            {formatCompetitionValue(gap, metric.unit)}
          </b> ì°¨ì´ì˜ˆìš” ğŸ”¥
        </div>
      )}
    </div>
  );
}


/* ===================== ê²Œì„í™” 2ì°¨: ë°°ì§€ Â· í€˜ìŠ¤íŠ¸ Â· ì¹­í˜¸ Â· ì¸ì • ===================== */

const BADGE_DEFS = [
  { key: 'first_step', icon: 'ğŸŒ±', name: 'ì²« ë°œìêµ­', rarity: 'COMMON', hidden: false, desc: 'ì²« HS íŒë§¤', auto: true },
  { key: 'hs_y10', icon: 'ğŸ”Ÿ', name: 'ìŠ¤íƒ€íŠ¸ í…', rarity: 'COMMON', hidden: false, desc: 'ì˜¬í•´ HS 10ê±´', auto: true },
  { key: 'hs_y30', icon: 'ğŸƒ', name: 'í˜ì´ìŠ¤ ì—…', rarity: 'COMMON', hidden: false, desc: 'ì˜¬í•´ HS 30ê±´', auto: true },
  { key: 'hs_y50', icon: 'ğŸ¯', name: 'í•˜í”„ ì„¼ì¶”ë¦¬', rarity: 'RARE', hidden: false, desc: 'ì˜¬í•´ HS 50ê±´', auto: true },
  { key: 'hs_y100', icon: 'ğŸ’¯', name: 'ë°±ì „ë°±ìŠ¹', rarity: 'RARE', hidden: false, desc: 'ì˜¬í•´ HS 100ê±´', auto: true },
  { key: 'hs_y150', icon: 'ğŸš€', name: '150 í´ëŸ½', rarity: 'RARE', hidden: false, desc: 'ì˜¬í•´ HS 150ê±´', auto: true },
  { key: 'hs_y200', icon: 'ğŸ”¥', name: '200 í´ëŸ½', rarity: 'EPIC', hidden: false, desc: 'ì˜¬í•´ HS 200ê±´', auto: true },
  { key: 'hs_y250', icon: 'âš¡', name: '250 í´ëŸ½', rarity: 'EPIC', hidden: false, desc: 'ì˜¬í•´ HS 250ê±´', auto: true },
  { key: 'hs_y300', icon: 'ğŸ’', name: '300 í´ëŸ½', rarity: 'EPIC', hidden: false, desc: 'ì˜¬í•´ HS 300ê±´', auto: true },
  { key: 'hs_y500', icon: 'ğŸ‘‘', name: '500 í´ëŸ½', rarity: 'LEGEND', hidden: false, desc: 'ì˜¬í•´ HS 500ê±´', auto: true },
  { key: 'hs_m20', icon: 'ğŸ“¦', name: 'ì›”ê°„ 20', rarity: 'COMMON', hidden: false, desc: 'í•œ ë‹¬ HS 20ê±´', auto: true },
  { key: 'hs_m30', icon: 'ğŸ“ˆ', name: 'ì›”ê°„ 30', rarity: 'RARE', hidden: false, desc: 'í•œ ë‹¬ HS 30ê±´', auto: true },
  { key: 'hs_m40', icon: 'ğŸ”¥', name: 'ì›”ê°„ 40', rarity: 'RARE', hidden: false, desc: 'í•œ ë‹¬ HS 40ê±´', auto: true },
  { key: 'hs_m50', icon: 'ğŸ¦', name: '50ì˜ ë²½', rarity: 'EPIC', hidden: false, desc: 'í•œ ë‹¬ HS 50ê±´', auto: true },
  { key: 'hs_m60', icon: 'ğŸš€', name: 'ì›”ê°„ í­ì£¼', rarity: 'EPIC', hidden: false, desc: 'í•œ ë‹¬ HS 60ê±´', auto: true },
  { key: 'hs_m70', icon: 'ğŸ’¥', name: 'ë¸Œë ˆì´í¬ ì•„ì›ƒ', rarity: 'EPIC', hidden: false, desc: 'í•œ ë‹¬ HS 70ê±´', auto: true },
  { key: 'hs_m80', icon: 'ğŸ†', name: '80 í´ëŸ½', rarity: 'LEGEND', hidden: false, desc: 'í•œ ë‹¬ HS 80ê±´', auto: true },
  { key: 'hs_m100', icon: 'ğŸ’¯', name: 'ì›”ê°„ ì„¼ì¶”ë¦¬', rarity: 'LEGEND', hidden: false, desc: 'í•œ ë‹¬ HS 100ê±´', auto: true },
  { key: 'hs_personal_record', icon: 'ğŸŒ‹', name: 'í•œê³„ ëŒíŒŒ', rarity: 'RARE', hidden: false, desc: 'ìì‹ ì˜ ì›” HS ìµœê³ ê¸°ë¡ ê²½ì‹ ', auto: true },
  { key: 'hs_guinness', icon: 'ğŸ', name: 'ë¯¸ì†Œ ê¸°ë„¤ìŠ¤ Â· HS', rarity: 'LEGEND', hidden: false, desc: 'íšŒì‚¬ ì—­ëŒ€ ì›” HS ìµœê³ ê¸°ë¡ ê²½ì‹ ', auto: true },
  { key: 'hs_rank3', icon: 'ğŸ¥‰', name: 'í¬ë””ì›€', rarity: 'RARE', hidden: false, desc: 'ì›” HS ì „ì²´ 3ìœ„', auto: true },
  { key: 'hs_rank2', icon: 'ğŸ¥ˆ', name: 'ì‹¤ë²„ ëŸ¬ì‹œ', rarity: 'EPIC', hidden: false, desc: 'ì›” HS ì „ì²´ 2ìœ„', auto: true },
  { key: 'hs_rank1', icon: 'ğŸ¥‡', name: 'ì´ë²ˆ ë‹¬ ì£¼ì¸ê³µ', rarity: 'EPIC', hidden: false, desc: 'ì›” HS ì „ì²´ 1ìœ„', auto: true },
  { key: 'hs_year1', icon: 'ğŸ‘‘', name: 'ì˜¬í•´ì˜ HS KING', rarity: 'LEGEND', hidden: false, desc: 'ì˜¬í•´ ëˆ„ì  HS ì „ì²´ 1ìœ„', auto: true },
  { key: 'hs_store1', icon: 'ğŸ ', name: 'ìš°ë¦¬ ë§¤ì¥ ACE', rarity: 'RARE', hidden: false, desc: 'ì›” HS ë§¤ì¥ 1ìœ„', auto: true },
  { key: 'hs_back2back', icon: 'ğŸ”¥', name: 'ë°±íˆ¬ë°±', rarity: 'LEGEND', hidden: false, desc: 'ì›” HS 1ìœ„ 2ê°œì›” ì—°ì†', auto: true },
  { key: 'hs_triple', icon: 'ğŸ†', name: 'íŠ¸ë¦¬í”Œ í¬ë¼ìš´', rarity: 'LEGEND', hidden: false, desc: 'ì›” HS 1ìœ„ 3íšŒ', auto: true },
  { key: 'hs_top10', icon: 'ğŸ–', name: 'TOP10', rarity: 'COMMON', hidden: false, desc: 'ì›” HS ì „ì²´ 10ìœ„ ì´ë‚´', auto: true },
  { key: 'hs_top5', icon: 'â­', name: 'TOP5', rarity: 'RARE', hidden: false, desc: 'ì›” HS ì „ì²´ 5ìœ„ ì´ë‚´', auto: true },
  { key: 'hs_top10_3m', icon: 'ğŸ§±', name: 'ìë¦¬ ì§€í‚´ì´', rarity: 'EPIC', hidden: false, desc: '3ê°œì›” ì—°ì† HS TOP10', auto: true },
  { key: 'home_first', icon: 'ğŸ ', name: 'ì²« í™ˆ', rarity: 'COMMON', hidden: false, desc: 'ì²« í™ˆ íŒë§¤', auto: true },
  { key: 'home_m5', icon: 'ğŸ¡', name: 'í™ˆ ìŠ¤íƒ€í„°', rarity: 'COMMON', hidden: false, desc: 'ì›” í™ˆ 5ê±´', auto: true },
  { key: 'home_m10', icon: 'ğŸ˜', name: 'í™ˆ ëŸ¬ë„ˆ', rarity: 'RARE', hidden: false, desc: 'ì›” í™ˆ 10ê±´', auto: true },
  { key: 'home_m15', icon: 'ğŸ¢', name: 'í™ˆ í”„ë¡œ', rarity: 'RARE', hidden: false, desc: 'ì›” í™ˆ 15ê±´', auto: true },
  { key: 'home_m20', icon: 'ğŸ°', name: 'í™ˆ ë§ˆìŠ¤í„°', rarity: 'EPIC', hidden: false, desc: 'ì›” í™ˆ 20ê±´', auto: true },
  { key: 'home_y100', icon: 'ğŸ’¯', name: 'í™ˆ ì„¼ì¶”ë¦¬', rarity: 'EPIC', hidden: false, desc: 'ì˜¬í•´ í™ˆ 100ê±´', auto: true },
  { key: 'home_rank1', icon: 'ğŸ‘‘', name: 'í™ˆ KING', rarity: 'EPIC', hidden: false, desc: 'ì›” í™ˆ ì „ì²´ 1ìœ„', auto: true },
  { key: 'home_year1', icon: 'ğŸ†', name: 'ì˜¬í•´ì˜ í™ˆ KING', rarity: 'LEGEND', hidden: false, desc: 'ì˜¬í•´ í™ˆ ëˆ„ì  1ìœ„', auto: true },
  { key: 'home_day3', icon: 'ğŸ”¥', name: 'í™ˆ ì˜¬ì¸', rarity: 'RARE', hidden: false, desc: 'í•˜ë£¨ í™ˆ 3ê±´ ì´ìƒ', auto: true },
  { key: 'internet_y50', icon: 'ğŸ“¡', name: 'ì¸í„°ë„· ì „ë¬¸ê°€', rarity: 'RARE', hidden: false, desc: 'ì¸í„°ë„· ì—°ê°„ 50ê±´', auto: true },
  { key: 'hometv_m10', icon: 'ğŸ“º', name: 'TV ì½¤ë³´', rarity: 'RARE', hidden: false, desc: 'í™ˆ+TV ì›” 10ê±´', auto: true },
  { key: 'home_guinness', icon: 'ğŸ', name: 'ë¯¸ì†Œ ê¸°ë„¤ìŠ¤ Â· í™ˆ', rarity: 'LEGEND', hidden: false, desc: 'íšŒì‚¬ ì—­ëŒ€ ì›” í™ˆ ìµœê³ ê¸°ë¡', auto: true },
  { key: 'free_first', icon: 'ğŸ“º', name: 'í”„ë¦¬ ìŠ¤íƒ€íŠ¸', rarity: 'COMMON', hidden: false, desc: 'ì²« TVí”„ë¦¬', auto: true },
  { key: 'free_m5', icon: 'ğŸª½', name: 'í”„ë¦¬ ëŸ¬ë„ˆ', rarity: 'COMMON', hidden: false, desc: 'ì›” í”„ë¦¬ 5ê±´', auto: true },
  { key: 'free_m10', icon: 'ğŸ“º', name: 'í”„ë¦¬ ë§ˆìŠ¤í„°', rarity: 'RARE', hidden: false, desc: 'ì›” í”„ë¦¬ 10ê±´', auto: true },
  { key: 'free_rank1', icon: 'ğŸ‘‘', name: 'í”„ë¦¬ KING', rarity: 'EPIC', hidden: false, desc: 'ì›” í”„ë¦¬ ì „ì²´ 1ìœ„', auto: true },
  { key: 'free_y100', icon: 'ğŸ’¯', name: 'í”„ë¦¬ ì„¼ì¶”ë¦¬', rarity: 'EPIC', hidden: false, desc: 'ì˜¬í•´ í”„ë¦¬ 100ê±´', auto: true },
  { key: 'smart_first', icon: 'ğŸ’¡', name: 'ìŠ¤ë§ˆíŠ¸ ìŠ¤íƒ€íŠ¸', rarity: 'COMMON', hidden: false, desc: 'ì²« ìŠ¤ë§ˆíŠ¸í™ˆ', auto: true },
  { key: 'smart_m5', icon: 'ğŸ¡', name: 'ìŠ¤ë§ˆíŠ¸ ë¼ì´í”„', rarity: 'COMMON', hidden: false, desc: 'ì›” ìŠ¤ë§ˆíŠ¸í™ˆ 5ê±´', auto: true },
  { key: 'smart_m10', icon: 'ğŸ’¡', name: 'ìŠ¤ë§ˆíŠ¸ ë§ˆìŠ¤í„°', rarity: 'RARE', hidden: false, desc: 'ì›” ìŠ¤ë§ˆíŠ¸í™ˆ 10ê±´', auto: true },
  { key: 'smart_rank1', icon: 'ğŸ‘‘', name: 'ìŠ¤í™ˆ KING', rarity: 'EPIC', hidden: false, desc: 'ì›” ìŠ¤ë§ˆíŠ¸í™ˆ ì „ì²´ 1ìœ„', auto: true },
  { key: 'smart_y50', icon: 'ğŸ§ ', name: 'ìŠ¤ë§ˆíŠ¸ ì»¬ë ‰í„°', rarity: 'EPIC', hidden: false, desc: 'ì˜¬í•´ ìŠ¤ë§ˆíŠ¸í™ˆ 50ê±´', auto: true },
  { key: 'upsell_first', icon: 'ğŸ¯', name: 'ì²« ì ì¤‘', rarity: 'COMMON', hidden: false, desc: 'ì²« ë§ì¶¤ì œì•ˆ ì—…ì…€', auto: true },
  { key: 'upsell_m5', icon: 'ğŸ¯', name: 'ì·¨í–¥ì €ê²©', rarity: 'COMMON', hidden: false, desc: 'ì›” ë§ì¶¤ì œì•ˆ ì—…ì…€ 5ê±´', auto: true },
  { key: 'upsell_m10', icon: 'ğŸ“ˆ', name: 'ì—…ì…€ëŸ¬', rarity: 'RARE', hidden: false, desc: 'ì›” ë§ì¶¤ì œì•ˆ ì—…ì…€ 10ê±´', auto: true },
  { key: 'upsell_m20', icon: 'ğŸš€', name: 'ì—…ì…€ ë§ˆìŠ¤í„°', rarity: 'EPIC', hidden: false, desc: 'ì›” ë§ì¶¤ì œì•ˆ ì—…ì…€ 20ê±´', auto: true },
  { key: 'upsell_rank1', icon: 'ğŸ‘‘', name: 'ì—…ì…€ KING', rarity: 'EPIC', hidden: false, desc: 'ì›” ë§ì¶¤ì œì•ˆ ì—…ì…€ ì „ì²´ 1ìœ„', auto: true },
  { key: 'upsell_y100', icon: 'ğŸ’¯', name: 'ì—…ì…€ ì„¼ì¶”ë¦¬', rarity: 'EPIC', hidden: false, desc: 'ì˜¬í•´ ë§ì¶¤ì œì•ˆ ì—…ì…€ 100ê±´', auto: true },
  { key: 'upsell_day3', icon: 'ğŸ¦…', name: 'ê¸°íšŒ í¬ì°©', rarity: 'RARE', hidden: false, desc: 'í•˜ë£¨ ë§ì¶¤ì œì•ˆ ì—…ì…€ 3ê±´', auto: true },
  { key: 'upsell_day5', icon: 'ğŸ”¥', name: 'ì—…ì…€ í­ì£¼', rarity: 'EPIC', hidden: false, desc: 'í•˜ë£¨ ë§ì¶¤ì œì•ˆ ì—…ì…€ 5ê±´', auto: true },
  { key: 'upsell_year1', icon: 'ğŸ†', name: 'ì˜¬í•´ì˜ ì—…ì…€ KING', rarity: 'LEGEND', hidden: false, desc: 'ì˜¬í•´ ëˆ„ì  ì—…ì…€ 1ìœ„', auto: true },
  { key: 'upsell_guinness', icon: 'ğŸ', name: 'ë¯¸ì†Œ ê¸°ë„¤ìŠ¤ Â· ì—…ì…€', rarity: 'LEGEND', hidden: false, desc: 'ì—­ëŒ€ ì›” ì—…ì…€ ìµœê³ ê¸°ë¡', auto: true },
  { key: 'upsell_goal100', icon: 'ğŸ¯', name: 'ì •ì¡°ì¤€', rarity: 'RARE', hidden: false, desc: 'ì›” ë§ì¶¤ì œì•ˆ ëª©í‘œ 100%', auto: true },
  { key: 'upsell_goal150', icon: 'ğŸ’¥', name: 'ì˜¤ë²„í´ëŸ­', rarity: 'EPIC', hidden: false, desc: 'ì›” ë§ì¶¤ì œì•ˆ ëª©í‘œ 150%', auto: true },
  { key: 'second_first', icon: 'ğŸ“±', name: 'í•˜ë‚˜ ë”', rarity: 'COMMON', hidden: false, desc: 'ì²« 2ND ë²ˆë“¤', auto: true },
  { key: 'second_m5', icon: 'âœŒï¸', name: 'íˆ¬ê²Œë”', rarity: 'COMMON', hidden: false, desc: 'ì›” 2ND 5ê±´', auto: true },
  { key: 'second_m10', icon: 'ğŸ“¦', name: 'ë²ˆë“¤ëŸ¬', rarity: 'RARE', hidden: false, desc: 'ì›” 2ND 10ê±´', auto: true },
  { key: 'second_m20', icon: 'ğŸš€', name: 'ë²ˆë“¤ ë§ˆìŠ¤í„°', rarity: 'EPIC', hidden: false, desc: 'ì›” 2ND 20ê±´', auto: true },
  { key: 'second_rank1', icon: 'ğŸ‘‘', name: '2ND KING', rarity: 'EPIC', hidden: false, desc: 'ì›” 2ND ì „ì²´ 1ìœ„', auto: true },
  { key: 'second_y100', icon: 'ğŸ’¯', name: '2ND ì„¼ì¶”ë¦¬', rarity: 'EPIC', hidden: false, desc: 'ì˜¬í•´ 2ND 100ê±´', auto: true },
  { key: 'second_day3', icon: 'ğŸ›’', name: 'ì¥ë°”êµ¬ë‹ˆ ê°€ë“', rarity: 'RARE', hidden: false, desc: 'í•˜ë£¨ 2ND ë²ˆë“¤ 3ê±´', auto: true },
  { key: 'second_guinness', icon: 'ğŸ', name: 'ë¯¸ì†Œ ê¸°ë„¤ìŠ¤ Â· 2ND', rarity: 'LEGEND', hidden: false, desc: 'ì—­ëŒ€ ì›” 2ND ìµœê³ ê¸°ë¡', auto: true },
  { key: 'prod_base', icon: 'âš™ï¸', name: 'ì‹œë™ ì™„ë£Œ', rarity: 'COMMON', hidden: false, desc: 'ì›” ìƒì‚°ì„± ê¸°ì¤€ ë‹¬ì„±', auto: true },
  { key: 'prod_100', icon: 'ğŸ“ˆ', name: 'ìƒì‚°ì„± 100', rarity: 'RARE', hidden: false, desc: 'ì›” ìƒì‚°ì„± 100P', auto: true },
  { key: 'prod_120', icon: 'âš¡', name: 'ìƒì‚°ì„± 120', rarity: 'RARE', hidden: false, desc: 'ì›” ìƒì‚°ì„± 120P', auto: true },
  { key: 'prod_150', icon: 'ğŸ”¥', name: 'ìƒì‚°ì„± 150', rarity: 'EPIC', hidden: false, desc: 'ì›” ìƒì‚°ì„± 150P', auto: true },
  { key: 'prod_200', icon: 'ğŸš€', name: 'ìƒì‚°ì„± 200', rarity: 'LEGEND', hidden: false, desc: 'ì›” ìƒì‚°ì„± 200P', auto: true },
  { key: 'prod_rank1', icon: 'ğŸ‘‘', name: 'ìƒì‚°ì„± KING', rarity: 'EPIC', hidden: false, desc: 'ì›” ìƒì‚°ì„± ì „ì²´ 1ìœ„', auto: true },
  { key: 'prod_year1', icon: 'ğŸ†', name: 'ì˜¬í•´ì˜ ìƒì‚°ì„± KING', rarity: 'LEGEND', hidden: false, desc: 'ì—°ê°„ í‰ê·  ìƒì‚°ì„± 1ìœ„', auto: true },
  { key: 'grade_s', icon: 'ğŸ’', name: 'S CLASS', rarity: 'EPIC', hidden: false, desc: 'ì„±ê³¼ë“±ê¸‰ S ë‹¬ì„±', auto: true },
  { key: 'grade_s3', icon: 'ğŸ”¥', name: 'S STREAK', rarity: 'LEGEND', hidden: false, desc: 'Së“±ê¸‰ 3ê°œì›” ì—°ì†', auto: true },
  { key: 'all_top3', icon: 'ğŸ', name: 'ì™„ì „ì²´', rarity: 'LEGEND', hidden: false, desc: 'HSÂ·í™ˆÂ·ìƒì‚°ì„± ëª¨ë‘ ì›” TOP3', auto: true },
  { key: 'day_hs5', icon: 'ğŸ”¥', name: 'ë¶ˆíƒ€ëŠ” í•˜ë£¨', rarity: 'RARE', hidden: false, desc: 'í•˜ë£¨ HS 5ê±´', auto: true },
  { key: 'day_hs8', icon: 'ğŸ’¥', name: 'ë¯¸ì¹œ í•˜ë£¨', rarity: 'EPIC', hidden: false, desc: 'í•˜ë£¨ HS 8ê±´', auto: true },
  { key: 'day_hs10', icon: 'â˜„ï¸', name: 'ë ˆì½”ë“œ ë°ì´', rarity: 'LEGEND', hidden: false, desc: 'í•˜ë£¨ HS 10ê±´', auto: true },
  { key: 'full_set', icon: 'ğŸ›', name: 'í’€ì„¸íŠ¸', rarity: 'RARE', hidden: false, desc: 'í•˜ë£¨ HS+í™ˆ+2ND ëª¨ë‘ íŒë§¤', auto: true },
  { key: 'allrounder', icon: 'ğŸ¯', name: 'ì˜¬ë¼ìš´ë”', rarity: 'RARE', hidden: false, desc: 'í•œ ë‹¬ í•µì‹¬ 5ê°œ ì¹´í…Œê³ ë¦¬ ëª¨ë‘ ì‹¤ì ', auto: true },
  { key: 'balance_master', icon: 'ğŸŒˆ', name: 'ë°¸ëŸ°ìŠ¤ ë§ˆìŠ¤í„°', rarity: 'EPIC', hidden: false, desc: 'í•µì‹¬ 5ê°œ ì¹´í…Œê³ ë¦¬ ëª¨ë‘ ì›” ëª©í‘œ ë‹¬ì„±', auto: true },
  { key: 'sweep_day', icon: 'ğŸ§¹', name: 'ì‹¹ì“¸ì´', rarity: 'EPIC', hidden: false, desc: 'í•˜ë£¨ 5ê°œ ì´ìƒ íŒë§¤ ì¹´í…Œê³ ë¦¬ ì‹¤ì ', auto: true },
  { key: 'perfect_month', icon: 'ğŸ’', name: 'í¼í™íŠ¸ ë¨¼ìŠ¤', rarity: 'LEGEND', hidden: false, desc: 'í•´ë‹¹ ì›” í•µì‹¬ KPI ì „ë¶€ ëª©í‘œ ë‹¬ì„±', auto: true },
  { key: 'grand_slam', icon: 'ğŸ‘‘', name: 'ê·¸ëœë“œìŠ¬ë¨', rarity: 'LEGEND', hidden: false, desc: 'HSÂ·í™ˆÂ·ìƒì‚°ì„± ì›”ê°„ 1ìœ„ ë™ì‹œ ë‹¬ì„±', auto: true },
  { key: 'goat', icon: 'ğŸ', name: 'GOAT', rarity: 'LEGEND', hidden: false, desc: 'ì—°ê°„ HSÂ·í™ˆÂ·ìƒì‚°ì„± ëª¨ë‘ ì „ì²´ TOP3', auto: true },
  { key: 'tenure3', icon: 'ğŸŒ±', name: 'ë¯¸ì†Œ ìƒˆì‹¹', rarity: 'COMMON', hidden: false, desc: 'ì…ì‚¬ 3ê°œì›”', auto: true },
  { key: 'tenure12', icon: 'ğŸ‚', name: 'ì²« ëŒ', rarity: 'COMMON', hidden: false, desc: 'ê·¼ì† 12ê°œì›”', auto: true },
  { key: 'tenure24', icon: 'ğŸŒ³', name: 'ë¿Œë¦¬ë‚´ë¦¼', rarity: 'RARE', hidden: false, desc: 'ê·¼ì† 24ê°œì›”', auto: true },
  { key: 'tenure36', icon: 'ğŸŒ²', name: 'ë¿Œë¦¬ ê¹Šì€ ë¯¸ì†Œ', rarity: 'EPIC', hidden: false, desc: 'ê·¼ì† 36ê°œì›”', auto: true },
  { key: 'tenure60', icon: 'ğŸ›', name: 'ë¯¸ì†Œ ë² í…Œë‘', rarity: 'LEGEND', hidden: false, desc: 'ê·¼ì† 60ê°œì›”', auto: true },
  { key: 'special_pick', icon: 'ğŸ“ˆ', name: 'ì„±ì¥ì™•', rarity: 'RARE', hidden: false, desc: 'ì›” í›„ë°˜ HS í˜ì´ìŠ¤ê°€ ì „ë°˜ë³´ë‹¤ í¬ê²Œ ìƒìŠ¹', auto: true },
  { key: 'special_team', icon: 'ğŸ¯', name: 'ì˜¬ë¼ìš´ë“œ ì„¸ì¼ì¦ˆ', rarity: 'EPIC', hidden: false, desc: 'HSÂ·í™ˆÂ·í”„ë¦¬Â·ìŠ¤í™ˆÂ·2NDë¥¼ ëª¨ë‘ íŒë§¤', auto: true },
  { key: 'special_mvp', icon: 'ğŸ†', name: 'ë¯¸ì†Œ MVP', rarity: 'LEGEND', hidden: false, desc: 'HSÂ·í™ˆÂ·ìƒì‚°ì„± ì¢…í•© ìˆœìœ„ ì›” 1ìœ„', auto: true }
  ,{ key:'tenure1', icon:'ğŸ‘‹', name:'ë¯¸ì†Œ ì²« ë‹¬', rarity:'COMMON', hidden:false, desc:'ê·¼ì† 1ê°œì›”', auto:true, progressMetric:'tenure', threshold:1 }
  ,{ key:'tenure6', icon:'ğŸŒ¿', name:'ë°˜ë…„ì˜ ë°œìêµ­', rarity:'COMMON', hidden:false, desc:'ê·¼ì† 6ê°œì›”', auto:true, progressMetric:'tenure', threshold:6 }
  ,{ key:'tenure18', icon:'ğŸŒ±', name:'ë‹¨ë‹¨í•œ ë¿Œë¦¬', rarity:'RARE', hidden:false, desc:'ê·¼ì† 18ê°œì›”', auto:true, progressMetric:'tenure', threshold:18 }
  ,{ key:'tenure48', icon:'ğŸ¤', name:'ë¯¿ìŒì˜ ë™ë£Œ', rarity:'EPIC', hidden:false, desc:'ê·¼ì† 48ê°œì›”', auto:true, progressMetric:'tenure', threshold:48 }
  ,{ key:'tenure72', icon:'ğŸ›ï¸', name:'ë¯¸ì†Œì˜ ê¸°ë‘¥', rarity:'EPIC', hidden:false, desc:'ê·¼ì† 72ê°œì›”', auto:true, progressMetric:'tenure', threshold:72 }
  ,{ key:'tenure84', icon:'âœ¨', name:'ì˜¤ë˜ëœ ì‹ ë¢°', rarity:'EPIC', hidden:false, desc:'ê·¼ì† 84ê°œì›”', auto:true, progressMetric:'tenure', threshold:84 }
  ,{ key:'tenure96', icon:'ğŸ“œ', name:'ë¯¸ì†Œ íˆìŠ¤í† ë¦¬', rarity:'LEGEND', hidden:false, desc:'ê·¼ì† 96ê°œì›”', auto:true, progressMetric:'tenure', threshold:96 }
  ,{ key:'tenure108', icon:'ğŸŒŸ', name:'ë¯¸ì†Œ ë ˆì „ë“œ', rarity:'LEGEND', hidden:false, desc:'ê·¼ì† 108ê°œì›”', auto:true, progressMetric:'tenure', threshold:108 }
  ,{ key:'tenure120', icon:'ğŸ–ï¸', name:'ë¯¸ì†Œ ëª…ì˜ˆì§ì›', rarity:'LEGEND', hidden:false, desc:'ê·¼ì† 120ê°œì›”', auto:true, progressMetric:'tenure', threshold:120 }
  ,{ key:'tenure180', icon:'ğŸ›ï¸', name:'ë¯¸ì†Œì˜ ì—­ì‚¬', rarity:'LEGEND', hidden:false, desc:'ê·¼ì† 180ê°œì›”', auto:true, progressMetric:'tenure', threshold:180 }
  ,...[
    [25,'ğŸ¡','ìš°ë¦¬ì§‘ ì•ˆë‚´ì','COMMON'],[50,'ğŸ§­','í™ˆ ë„¤ë¹„ê²Œì´í„°','RARE'],[100,'ğŸ’¯','í™ˆ ë°±ë¶€ì¥','RARE'],[200,'ğŸ—ï¸','í™ˆ ì•„í‚¤í…íŠ¸','EPIC'],[300,'ğŸŒ‰','í™ˆ ì»¤ë„¥í„°','EPIC'],[500,'ğŸ°','í™ˆ ê·¸ëœë“œë§ˆìŠ¤í„°','LEGEND'],[750,'ğŸ™ï¸','í™ˆ íƒ€ìš´ ë¹Œë”','LEGEND'],[1000,'ğŸ†','ì²œ ê°œì˜ ì—°ê²°','LEGEND']
  ].map(([threshold,icon,name,rarity])=>({key:`career_home_${threshold}`,icon,name,rarity,hidden:false,desc:`í†µì‚° í™ˆ ${threshold}ê±´`,auto:true,progressMetric:'home',threshold}))
  ,...[
    [25,'ğŸª„','í”„ë¦¬ ìºì²˜','COMMON'],[50,'ğŸ“º','í”„ë¦¬ ìŠ¤í˜ì…œë¦¬ìŠ¤íŠ¸','RARE'],[100,'ğŸ’¯','í”„ë¦¬ ë°±ë¶€ì¥','RARE'],[200,'ğŸ¬','í”„ë¦¬ ë””ë ‰í„°','EPIC'],[300,'â­','í”„ë¦¬ ì•„ì´ì½˜','EPIC'],[500,'ğŸ‘‘','í”„ë¦¬ ë ˆì „ë“œ','LEGEND'],[1000,'ğŸŒŒ','í”„ë¦¬ ì‹ í™”','LEGEND']
  ].map(([threshold,icon,name,rarity])=>({key:`career_free_${threshold}`,icon,name,rarity,hidden:false,desc:`í†µì‚° TVí”„ë¦¬ ${threshold}ê±´`,auto:true,progressMetric:'free',threshold}))
  ,...[
    [10,'ğŸ› ï¸','ìŠ¤ë§ˆíŠ¸ ë©”ì´ì»¤','COMMON'],[25,'ğŸ’¡','ìŠ¤ë§ˆíŠ¸ ê°€ì´ë“œ','COMMON'],[50,'ğŸ¨','ë¼ì´í”„ ë””ìì´ë„ˆ','RARE'],[100,'ğŸ’¯','ìŠ¤ë§ˆíŠ¸ ë°±ë¶€ì¥','RARE'],[200,'ğŸ—ï¸','ìŠ¤ë§ˆíŠ¸ ì•„í‚¤í…íŠ¸','EPIC'],[300,'ğŸ§ ','ë¯¸ë˜ìƒí™œ ì „ë¬¸ê°€','EPIC'],[500,'ğŸ‘‘','ìŠ¤ë§ˆíŠ¸í™ˆ ë ˆì „ë“œ','LEGEND']
  ].map(([threshold,icon,name,rarity])=>({key:`career_smart_${threshold}`,icon,name,rarity,hidden:false,desc:`í†µì‚° ìŠ¤ë§ˆíŠ¸í™ˆ ${threshold}ê±´`,auto:true,progressMetric:'smart',threshold}))
  ,...[
    [25,'ğŸ”','ë‹ˆì¦ˆ íƒí—˜ê°€','COMMON'],[50,'ğŸ’¡','ì œì•ˆì˜ ê¸°ìˆ ','RARE'],[100,'ğŸ¯','ë°± ë²ˆì˜ ì ì¤‘','RARE'],[200,'ğŸ“ˆ','ì—…ì…€ ìŠ¤í˜ì…œë¦¬ìŠ¤íŠ¸','EPIC'],[300,'ğŸ’','ê°€ì¹˜ ì„¤ê³„ì','EPIC'],[500,'ğŸ§™','ì œì•ˆì˜ ë‹¬ì¸','LEGEND'],[750,'ğŸ§­','ì„¸ì¼ì¦ˆ ë””ë ‰í„°','LEGEND'],[1000,'ğŸ†','ì²œ ë²ˆì˜ ì„ íƒ','LEGEND']
  ].map(([threshold,icon,name,rarity])=>({key:`career_upsell_${threshold}`,icon,name,rarity,hidden:false,desc:`í†µì‚° ë§ì¶¤ì œì•ˆ ì—…ì…€ ${threshold}ê±´`,auto:true,progressMetric:'upsell',threshold}))
  ,...[
    [1,'ğŸŒ±','ì†Œë…¸ ì²« ë§Œë‚¨','COMMON'],[5,'ğŸŒ…','ë¼ì´í”„ ìŠ¤íƒ€í„°','COMMON'],[10,'ğŸ”Ÿ','ì†Œë…¸ í…','COMMON'],[25,'ğŸ–ï¸','íœ´ì‹ ì„¤ê³„ì','RARE'],[50,'ğŸ§­','ë¼ì´í”„ í”Œë˜ë„ˆ','RARE'],[100,'ğŸ’¯','ì†Œë…¸ ë°±ë¶€ì¥','RARE'],[200,'ğŸŸï¸','ì†Œë…¸ ìŠ¤í˜ì…œë¦¬ìŠ¤íŠ¸','EPIC'],[300,'âœ¨','ë¼ì´í”„ íë ˆì´í„°','EPIC'],[500,'ğŸ‘‘','ì†Œë…¸ ë§ˆìŠ¤í„°','LEGEND'],[1000,'ğŸŒŒ','ë¼ì´í”„ì¼€ì–´ ë ˆì „ë“œ','LEGEND']
  ].map(([threshold,icon,name,rarity])=>({key:`career_sono_${threshold}`,icon,name,rarity,hidden:false,desc:`í†µì‚° ì†Œë…¸ ${threshold}ê±´`,auto:true,progressMetric:'sono',threshold}))
];

const SPECIAL_BADGE_KEYS = [];

function badgeDefOf(key) {
  return BADGE_DEFS.find((b) => b.key === key) || null;
}

function evaluateAutomaticBadges({
  dailyDays, month, personalGoals, mergedDraft, pay, competitionRows, userId, lifetimeTotals,
}) {
  const earned=new Set();
  const hs=hsCount(mergedDraft);
  const home=completedHomeCount(mergedDraft);
  const free=Number(mergedDraft?.homeFlat?.tvFree||0);
  const smart=Number(mergedDraft?.homeFlat?.smartHome||0);
  const upsell=Number(mergedDraft?.tailoredCount||0);
  const second=(mergedDraft?.matrix?.[7]||[]).reduce((a,v)=>a+Number(v||0),0)+Object.values(mergedDraft?.bundle2nd||{}).reduce((a,v)=>a+Number(v||0),0);
  const prod=Number(pay?.kpiScore||0);
  const tenureMonths=Number(pay?.months||0);
  [[1,'tenure1'],[3,'tenure3'],[6,'tenure6'],[12,'tenure12'],[18,'tenure18'],[24,'tenure24'],[36,'tenure36'],[48,'tenure48'],[60,'tenure60'],[72,'tenure72'],[84,'tenure84'],[96,'tenure96'],[108,'tenure108'],[120,'tenure120'],[180,'tenure180']].forEach(([months,key])=>{
    if(tenureMonths>=months)earned.add(key);
  });
  BADGE_DEFS.filter(b=>b.progressMetric&&b.progressMetric!=='tenure').forEach(b=>{
    if(Number(lifetimeTotals?.[b.progressMetric]||0)>=Number(b.threshold||0))earned.add(b.key);
  });
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

  // v21.75 ìë™ ë°°ì§€
  // ì˜¬ë¼ìš´ë“œ ì„¸ì¼ì¦ˆ: ì•±ì—ì„œ ê°ê´€ì ìœ¼ë¡œ í™•ì¸ ê°€ëŠ¥í•œ í•µì‹¬ íŒë§¤ ì¹´í…Œê³ ë¦¬ë¥¼ ëª¨ë‘ ê²½í—˜
  if(hs>0&&home>0&&free>0&&smart>0&&second>0)earned.add('special_team');

  // ë¯¸ì†Œ MVP: HS/í™ˆ/ìƒì‚°ì„± ìˆœìœ„ í•©ì´ ê°€ì¥ ë‚®ì€ ì§ì› 1ëª… (ë™ë¥ ì€ HSâ†’í™ˆâ†’ìƒì‚°ì„± ìˆœ)
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

    // ì›”ê°„ 1ìœ„ ì¤‘ ì„œë¡œ ë‹¤ë¥¸ ì‚¬ëŒì„ ìµœëŒ€ 2ëª… ë…¸ì¶œ
    const used = new Set();
    for (const metric of COMPETITION_METRICS) {
      const ranked = [...(rows || [])]
        .filter((r) => !NON_SALES_STORES.includes(r.branch))
        .sort((a, b) => metric.value(b) - metric.value(a));
      const top = ranked[0];
      if (top && Number(metric.value(top) || 0) > 0 && !used.has(top.id)) {
        out.push({
          id: `month-${metric.key}-${top.id}`,
          icon: 'ğŸ‘‘',
          title: `${metric.label} ì „ì²´ 1ìœ„`,
          name: top.name,
          branch: top.branch,
        });
        used.add(top.id);
      }
      if (out.length >= 2) break;
    }

    // ìµœê·¼ 7ì¼ ê¸‰ìƒìŠ¹ 1ëª…
    const rising = buildRisingRanking(rows, dailyRecords, month, config, 'hs')[0];
    if (rising && rising.recentValue > 0 && !used.has(rising.id)) {
      out.push({
        id: `rising-${rising.id}`,
        icon: 'âš¡',
        title: 'ìµœê·¼ 7ì¼ HS ê¸‰ìƒìŠ¹',
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
        <div className="text-xs text-amber-600">ì§€ê¸ˆ ì£¼ëª©í•  ì‚¬ëŒ âœ¨</div>
        <div className="text-sm font-bold text-gray-900 mt-0.5">ì¢‹ì€ ê¸°ë¡ì€ ê°™ì´ ë´ì•¼ ì œë§›</div>
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
  const avatar=(r,cls='w-11 h-11')=><div className={`${cls} rounded-2xl overflow-hidden bg-violet-100 text-violet-700 flex items-center justify-center font-black shrink-0`}>{avatars[r?.id]?<img src={avatars[r.id]} alt="" className="w-full h-full object-cover"/>:String(r?.name||'?').slice(0,1)}</div>;
  const profile=selected&&<div className="fixed inset-0 z-[119] bg-black/45 flex items-end sm:items-center justify-center" onClick={()=>setSelected(null)}><div className="w-full max-w-sm rounded-t-3xl sm:rounded-3xl bg-white p-5" onClick={e=>e.stopPropagation()}><div className="flex justify-between"><div className="flex gap-3">{avatar(selected,'w-16 h-16')}<div><div className="text-lg font-black">{selected.name}</div><div className="text-xs text-gray-400">{displayStoreName(selected.branch)} Â· {selected.position||'ì§ì›'}</div><div className="mt-1 text-xs font-bold text-violet-700">{title(selected)?`${title(selected).icon} ${title(selected).name}`:'ğŸ… ëŒ€í‘œ ë°°ì§€ ì—†ìŒ'}</div></div></div><button onClick={()=>setSelected(null)}>âœ•</button></div>{profiles[selected.id]?.status_message&&<div className="mt-4 rounded-2xl bg-violet-50 px-4 py-3 text-sm text-violet-800">â€œ{profiles[selected.id].status_message}â€</div>}<div className="grid grid-cols-3 gap-2 mt-4">{[['HS',hsCount(selected.draft),'ê±´'],['í™ˆ',metric('home').value(selected),'ê±´'],['ìƒì‚°ì„±',selected.pay?.kpiScore||0,'P']].map(([l,v,u])=><div key={l} className="rounded-xl bg-gray-50 p-2 text-center"><div className="text-[9px] text-gray-400">{l}</div><div className="text-sm font-bold">{u==='P'?fmtNum(v,1):fmtCount(v)}{u}</div></div>)}</div></div></div>;
  const cards=[['HS KING',leader('hs')],['í™ˆ KING',leader('home')],['ìƒì‚°ì„± KING',leader('productivity')]];
  return <><div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white overflow-hidden"><button onClick={()=>setSelected(mvp)} className="w-full p-4 text-left"><div className="flex justify-between"><div><div className="text-[10px] font-bold text-amber-600">ğŸ›ï¸ ë¯¸ì†Œ ëª…ì˜ˆì˜ ì „ë‹¹ Â· {monthLabel(month)}</div><div className="text-base font-black mt-1">ì´ë²ˆ ë‹¬ ì£¼ì¸ê³µë“¤ì„ ë§Œë‚˜ë³´ì„¸ìš”</div></div><span className="text-xs text-amber-700">í”„ë¡œí•„ â€º</span></div><div className="mt-4 flex gap-3 items-center">{avatar(mvp,'w-14 h-14')}<div><div className="text-[10px] font-bold text-amber-600">ë¯¸ì†Œ MVP</div><div className="font-black">{mvp.name}</div><div className="text-xs text-violet-700">{title(mvp)?`${title(mvp).icon} ${title(mvp).name}`:'ğŸ… ëŒ€í‘œ ë°°ì§€ ì¤€ë¹„ ì¤‘'}</div>{profiles[mvp.id]?.status_message&&<div className="text-[10px] text-gray-500 mt-1">â€œ{profiles[mvp.id].status_message}â€</div>}</div></div></button><div className="grid grid-cols-3 border-t border-amber-100">{cards.map(([l,r])=><button key={l} onClick={()=>setSelected(r)} className="p-3 border-r last:border-0 border-amber-100">{avatar(r,'w-9 h-9 mx-auto')}<div className="text-[9px] font-bold text-amber-600 mt-1">{l}</div><div className="text-[10px] font-semibold truncate">{r.name}</div></button>)}</div><button onClick={()=>setShowAll(true)} className="w-full border-t border-amber-100 py-3 text-xs font-bold text-amber-700">ì „ì²´ ì§ì› í”„ë¡œí•„ ë³´ê¸° â€º</button></div>{showAll&&<div className="fixed inset-0 z-[118] bg-black/45 flex items-end sm:items-center justify-center" onClick={()=>setShowAll(false)}><div className="w-full max-w-lg max-h-[86vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-gray-50 p-4" onClick={e=>e.stopPropagation()}><div className="flex justify-between"><div><div className="text-lg font-black">ì „ì²´ ì§ì› í”„ë¡œí•„</div><div className="text-xs text-gray-400">ì§ì›ì„ ëˆ„ë¥´ë©´ ê³µê°œ í”„ë¡œí•„ì´ ì—´ë ¤ìš”.</div></div><button onClick={()=>setShowAll(false)}>âœ•</button></div><div className="grid grid-cols-2 gap-2 mt-4">{salesRows.map(r=><button key={r.id} onClick={()=>{setShowAll(false);setSelected(r)}} className="rounded-2xl bg-white border p-3 text-left flex gap-2">{avatar(r)}<div className="min-w-0"><div className="text-xs font-bold truncate">{r.name}</div><div className="text-[9px] text-gray-400 truncate">{displayStoreName(r.branch)}</div><div className="text-[9px] text-violet-600 truncate mt-1">{title(r)?`${title(r).icon} ${title(r).name}`:'ëŒ€í‘œ ë°°ì§€ ì—†ìŒ'}</div>{profiles[r.id]?.status_message&&<div className="text-[9px] text-gray-500 truncate mt-1">{profiles[r.id].status_message}</div>}</div></button>)}</div></div></div>}{profile}</>;
}

function RecognitionRankingHub({rows,month,userId,userName='',userBranch=''}){
  return <section className="rounded-3xl border border-violet-100 bg-gradient-to-b from-violet-50/80 to-white p-2.5 shadow-sm">
    <div className="px-2.5 pt-2 pb-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold tracking-wide text-violet-600">ì„±ê³¼ ë¼ìš´ì§€</div>
          <div className="mt-0.5 text-base font-black text-gray-900">ëª…ì˜ˆì˜ ì „ë‹¹ Â· ì›”ê°„ ìˆœìœ„</div>
          <div className="mt-1 text-[11px] leading-relaxed text-gray-500">ì´ë²ˆ ë‹¬ ì£¼ì¸ê³µê³¼ ë‚´ ìˆœìœ„ë¥¼ í•œ ë²ˆì— í™•ì¸í•˜ì„¸ìš”.</div>
        </div>
        <div className="flex shrink-0 gap-1">
          <span className="rounded-full bg-amber-100 px-2 py-1 text-[9px] font-bold text-amber-700">ğŸ† ëª…ì˜ˆ</span>
          <span className="rounded-full bg-violet-100 px-2 py-1 text-[9px] font-bold text-violet-700">ìˆœìœ„</span>
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
        title={`${monthLabel(month)} ì›” ëˆ„ì  ìˆœìœ„`}
      />
    </div>
  </section>;
}

function GamificationHub({dailyDays,month,personalGoals,mergedDraft,pay,competitionRows,userId,currentEmp,currentAmount=0,onOpenPay,onGoInput}) {
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
  const autoEarned=useMemo(()=>evaluateAutomaticBadges({dailyDays,month,personalGoals,mergedDraft,pay,competitionRows,userId,lifetimeTotals}),[dailyDays,month,personalGoals,mergedDraft,pay,competitionRows,userId,lifetimeTotals]);
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
    if(!userId||loadingBadges||!lifetimeLoaded)return;
    const have=new Set(storedBadges.map(r=>r.badge_key)); const missing=[...autoEarned].filter(k=>!have.has(k));
    if(!missing.length)return;
    const first=badgeDefOf(missing[0]);
    const onceKey=`miso-celebration-badge-${userId}-${missing[0]}`;
    if(first&&!localStorage.getItem(onceKey)){localStorage.setItem(onceKey,'1');setCelebration({icon:first.icon,title:'ìƒˆë¡œìš´ ë°°ì§€ íšë“!',message:first.name})}
    (async()=>{for(const key of missing)await supabase.from('user_achievements').insert({user_id:userId,badge_key:key,awarded_by:null});await loadBadges()})();
  },[autoEarned,storedBadges,loadingBadges,lifetimeLoaded,userId,loadBadges]);
  useEffect(()=>{
    if(!userId||loadingBadges||celebration)return;
    const hs=hsCount(mergedDraft||{}),rank=[...(competitionRows||[])].sort((a,b)=>Number(b.pay?.totalPoints||0)-Number(a.pay?.totalPoints||0)).findIndex(x=>x.id===userId)+1;
    const events=[];
    [40,30,20].forEach(v=>{if(hs>=v)events.push({key:`hs-${month}-${v}`,icon:'ğŸ”¥',title:`HS ${v}ê±´ ëŒíŒŒ!`,message:'ê¾¸ì¤€í•¨ì´ ë©‹ì§„ ê¸°ë¡ì„ ë§Œë“¤ì—ˆì–´ìš”.'})});
    if(pay?.gradeEligible&&pay?.grade&&pay.grade!=='D')events.push({key:`grade-${month}-${pay.grade}`,icon:'ğŸ†',title:`${pay.grade}ë“±ê¸‰ ë‹¬ì„±!`,message:'í•œ ë‹¨ê³„ ë” ì˜¬ë¼ì„°ì–´ìš”.'});
    if(rank>0&&rank<=3)events.push({key:`rank-${month}-${rank}`,icon:rank===1?'ğŸ¥‡':rank===2?'ğŸ¥ˆ':'ğŸ¥‰',title:`ì „ì²´ ìˆœìœ„ TOP${rank} ì§„ì…!`,message:'ì§€ê¸ˆì˜ ì¢‹ì€ íë¦„ì„ ì´ì–´ê°€ìš”.'});
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
    if(!['image/jpeg','image/png','image/webp'].includes(file.type))return showAppToast('JPG, PNG, WEBP ì‚¬ì§„ë§Œ ë“±ë¡í•  ìˆ˜ ìˆì–´ìš”.',{tone:'error'});
    if(file.size>3*1024*1024)return showAppToast('í”„ë¡œí•„ ì‚¬ì§„ì€ 3MB ì´í•˜ë¡œ ì„ íƒí•´ì£¼ì„¸ìš”.',{tone:'error'});
    setAvatarBusy(true);
    const path=`${userId}/avatar`;
    const {error:uploadError}=await supabase.storage.from('profile-avatars').upload(path,file,{upsert:true,contentType:file.type,cacheControl:'3600'});
    if(uploadError){setAvatarBusy(false);return showAppToast(friendlyError(uploadError),{tone:'error',title:'ì‚¬ì§„ ë“±ë¡ ì‹¤íŒ¨'})}
    const {error:updateError}=await supabase.from('profiles').update({avatar_path:path,updated_at:new Date().toISOString()}).eq('id',userId);
    if(updateError){setAvatarBusy(false);return showAppToast(friendlyError(updateError),{tone:'error',title:'í”„ë¡œí•„ ì €ì¥ ì‹¤íŒ¨'})}
    const {error:publicError}=await supabase.from('employee_public_profiles').upsert({user_id:userId,avatar_path:path,status_message:statusMessage||null,updated_at:new Date().toISOString()},{onConflict:'user_id'});
    if(publicError){setAvatarBusy(false);return showAppToast(friendlyError(publicError),{tone:'error',title:'ê³µê°œ í”„ë¡œí•„ ì €ì¥ ì‹¤íŒ¨'})}
    const {data:downloaded}=await supabase.storage.from('profile-avatars').download(path);
    if(downloaded){if(avatarUrl)URL.revokeObjectURL(avatarUrl);setAvatarUrl(URL.createObjectURL(downloaded))}
    setAvatarBusy(false);showAppToast('í”„ë¡œí•„ ì‚¬ì§„ì„ ë“±ë¡í–ˆì–´ìš”.');
  };
  const saveStatus=async()=>{
    const clean=String(statusMessage||'').trim().slice(0,40);setStatusBusy(true);
    const {data:existing}=await supabase.from('employee_public_profiles').select('avatar_path').eq('user_id',userId).maybeSingle();
    const {error}=await supabase.from('employee_public_profiles').upsert({user_id:userId,avatar_path:existing?.avatar_path||null,status_message:clean||null,updated_at:new Date().toISOString()},{onConflict:'user_id'});
    setStatusBusy(false);if(error)return showAppToast(friendlyError(error),{tone:'error'});setStatusMessage(clean);setStatusEditing(false);showAppToast('ê³µê°œ í•œì¤„ ìƒíƒœë¥¼ ì €ì¥í–ˆì–´ìš”.');
  };

  return <>
    {celebration&&<div className="fixed inset-0 z-[118] bg-black/45 flex items-center justify-center p-5" onClick={()=>setCelebration(null)}>
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white p-6 text-center shadow-2xl" onClick={e=>e.stopPropagation()}>
        <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-violet-100 to-transparent" />
        <div className="relative text-5xl">{celebration.icon}</div><div className="relative mt-3 text-xl font-black text-gray-900">{celebration.title}</div><div className="relative mt-2 text-sm text-gray-500">{celebration.message}</div>
        <div className="relative mt-4 flex justify-center gap-2">{['â—','â—†','â—','â—†','â—'].map((x,i)=><span key={i} className={`${i%2?'text-amber-400':'text-violet-400'} animate-bounce`} style={{animationDelay:`${i*80}ms`}}>{x}</span>)}</div>
        <button onClick={()=>setCelebration(null)} className="relative mt-5 w-full rounded-xl bg-violet-600 py-3 text-sm font-bold text-white">ì¢‹ì•„ìš”!</button>
      </div>
    </div>}
    <div className="w-full rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
        <label className="relative w-12 h-12 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0 overflow-hidden cursor-pointer" aria-label="í”„ë¡œí•„ ì‚¬ì§„ ë“±ë¡">
          {avatarUrl?<img src={avatarUrl} alt="ë‚´ í”„ë¡œí•„" className="w-full h-full object-cover"/>:<span className="text-xl font-bold">{String(currentEmp?.name||'ë‚˜').slice(0,1)}</span>}
          <span className="absolute inset-x-0 bottom-0 py-0.5 bg-black/45 text-[8px] text-center">{avatarBusy?'ì €ì¥ ì¤‘':'ì‚¬ì§„'}</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadAvatar} disabled={avatarBusy} className="hidden"/>
        </label>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5 min-w-0"><span className="text-sm font-bold truncate">{currentEmp?.name||'ì§ì›'}</span><span className="text-[9px] text-violet-100/75 shrink-0">ê·¼ë¬´ {fmtCount(pay?.months||0)}ê°œì›”</span></div>
          <div className="text-[10px] text-violet-100 mt-0.5 truncate">{displayStoreName(currentEmp?.branch||'')} Â· {currentEmp?.position||'ì‚¬ì›'}</div>
        </div>
        </div>
        <button type="button" onClick={()=>setShowCollection(true)} className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-white/15 border border-white/20 text-[10px] font-bold">
          <span>{titleDef?.icon||'ğŸ…'}</span><span>{titleDef?.name||'ë°°ì§€ ì„ íƒ'}</span><span className="text-violet-100">â€º</span>
        </button>
      </div>

      <div className="mt-4 pt-1 flex items-end justify-between gap-3">
        <div className="min-w-0"><div className="text-[10px] text-violet-100/80">{monthLabel(month)} í˜„ì¬ ì‹¤ì  ê¸ˆì•¡</div><div className="text-2xl font-bold mt-2">{won(Math.max(0,currentAmount))}</div></div>
        <button type="button" onClick={onOpenPay} className="shrink-0 px-3 py-2.5 rounded-xl bg-white/12 border border-white/20 text-[10px] font-bold">ê¸‰ì—¬ í™•ì¸Â·ë¹„êµ â€º</button>
      </div>

      <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 mt-3 pt-3 border-t border-white/15 items-center">
        <div><div className="text-[9px] text-violet-100/75">ë“±ê¸‰</div><div className="text-[11px] font-bold mt-0.5">{pay?.gradeEligible?pay.grade:'D(ë¯¸ë‹¬)'}</div></div>
        <div><div className="text-[9px] text-violet-100/75">ì„±ê³¼ë“±ê¸‰P</div><div className="text-[11px] font-bold mt-0.5">{fmtNum(pay?.totalPoints||0,1)}P</div></div>
        <div><div className="text-[9px] text-violet-100/75">ìƒì‚°ì„±</div><div className="text-[11px] font-bold mt-0.5">{fmtNum(pay?.kpiScore||0,1)}P</div></div>
        <button type="button" onClick={onGoInput} className="px-3 py-2.5 rounded-xl bg-white text-violet-700 text-[10px] font-bold whitespace-nowrap">ì‹¤ì  ì…ë ¥ â€º</button>
      </div>
    </div>

    {showCollection&&<div className="fixed inset-0 z-[90] bg-black/40 flex items-end sm:items-center justify-center" onClick={()=>setShowCollection(false)}>
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[88vh] overflow-hidden" onClick={e=>e.stopPropagation()}>
        <div className="p-4 border-b"><div className="flex justify-between items-center"><div><div className="text-lg font-bold">ë‚´ ë°°ì§€ {fmtCount(earnedKeys.size)} / {BADGE_DEFS.length}</div><div className="text-[10px] text-gray-400">íšë“í•œ ë°°ì§€ë¥¼ ëŒ€í‘œ ë°°ì§€ë¡œ ì„ íƒí•  ìˆ˜ ìˆì–´ìš”.</div></div><button onClick={()=>setShowCollection(false)} className="text-gray-400">âœ•</button></div>
          <div className="flex gap-1.5 mt-3 overflow-x-auto">{[['all','ì „ì²´'],['earned','íšë“'],['locked','ë¯¸íšë“'],['legend','LEGEND']].map(([k,l])=><button key={k} onClick={()=>setFilter(k)} className={`px-3 py-1.5 rounded-full text-[10px] font-semibold ${filter===k?'bg-violet-600 text-white':'bg-gray-100 text-gray-500'}`}>{l}</button>)}</div>
        </div>
        <div className="p-3 grid grid-cols-2 gap-2 overflow-y-auto max-h-[70vh]">
          {visible.map(b=>{const got=earnedKeys.has(b.key);const row=storedBadges.find(r=>r.badge_key===b.key);const current=b.progressMetric==='tenure'?Number(pay?.months||0):Number(lifetimeTotals?.[b.progressMetric]||0);const showProgress=!got&&b.progressMetric&&b.threshold;return <button key={b.key} disabled={!got} onClick={()=>got&&saveTitle(b.key)} className={`rounded-2xl border p-3 text-left ${got?(titleKey===b.key?'border-violet-300 bg-violet-50 ring-1 ring-violet-100':'border-gray-100 bg-white'):'border-gray-100 bg-gray-50 opacity-55'}`}>
            <div className="flex justify-between"><span className="text-2xl">{got?b.icon:'ğŸ”’'}</span><span className="text-[8px] font-bold text-gray-400">{b.rarity}</span></div>
            <div className="text-xs font-bold text-gray-800 mt-2">{b.name}</div><div className="text-[10px] text-gray-500 mt-1 leading-tight">{b.desc}</div>
            {showProgress&&<div className="mt-2"><div className="h-1.5 rounded-full bg-gray-200 overflow-hidden"><div className="h-full rounded-full bg-violet-500" style={{width:`${Math.min(100,current/Number(b.threshold)*100)}%`}}/></div><div className="text-[9px] text-violet-600 mt-1">{fmtCount(current)} / {fmtCount(b.threshold)} Â· {fmtCount(Math.max(0,b.threshold-current))}{b.progressMetric==='tenure'?'ê°œì›”':'ê±´'} ë‚¨ìŒ</div></div>}
            {got&&<div className="text-[9px] text-violet-500 mt-2">{titleKey===b.key?'ëŒ€í‘œ ë°°ì§€ ì‚¬ìš© ì¤‘':row?.earned_at?`${fmtShortDate(row.earned_at)} íšë“ Â· ëŒ€í‘œë¡œ ì„¤ì •`:'ëŒ€í‘œë¡œ ì„¤ì •'}</div>}
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
        setMessage('ì´ë¯¸ ì´ ë°°ì§€ë¥¼ ë°›ì€ ì§ì›ì´ì—ìš”.');
      } else {
        setMessage(`ë°°ì§€ ìˆ˜ì—¬ ì‹¤íŒ¨: ${friendlyError(error)}`);
      }
    } else {
      const employee = employees.find((e) => e.id === employeeId);
      const badge = badgeDefOf(badgeKey);
      setMessage(`${employee?.name || 'ì§ì›'}ë‹˜ì—ê²Œ ${badge?.icon || 'â­'} ${badge?.name || 'íŠ¹ë³„ ë°°ì§€'}ë¥¼ ìˆ˜ì—¬í–ˆì–´ìš”.`);
      setNote('');
    }

    setSaving(false);
  };

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-violet-100 p-4">
        <div className="text-xs text-violet-500">ê´€ë¦¬ìê°€ ì§ì ‘ ì „í•˜ëŠ” ì¸ì •</div>
        <div className="text-base font-bold text-gray-900 mt-0.5">â­ íŠ¹ë³„ ë°°ì§€ ìˆ˜ì—¬</div>
        <div className="text-xs text-gray-400 mt-1">
          ìˆ«ìë¡œ ë‹¤ ë‹´ê¸° ì–´ë ¤ìš´ ì„±ì¥ê³¼ íŒ€ì›Œí¬ë„ ê¸°ë¡ìœ¼ë¡œ ë‚¨ê²¨ì£¼ì„¸ìš”.
        </div>

        <div className="mt-4 grid md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">ì§ì›</label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
            >
              {(employees || []).map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} Â· {displayStoreName(e.branch)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">ë°°ì§€</label>
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
            í•œë§ˆë”” <span className="font-normal text-gray-300">(ì„ íƒ)</span>
          </label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="ì˜ˆ: ì´ë²ˆ ë‹¬ ì„±ì¥ì„¸ê°€ ì •ë§ ì¢‹ì•˜ì–´ìš”!"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <button
          onClick={award}
          disabled={saving || !employeeId}
          className="w-full mt-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-bold disabled:opacity-50"
        >
          {saving ? 'ìˆ˜ì—¬ ì¤‘...' : 'íŠ¹ë³„ ë°°ì§€ ìˆ˜ì—¬'}
        </button>

        {message && (
          <div className="mt-3 text-xs bg-gray-50 rounded-lg p-2.5 text-gray-600">{message}</div>
        )}
      </div>
    </div>
  );
}


/* ===================== v11 í™ˆ ì²­ì•½ ê´€ë¦¬ ===================== */
const HOME_ORDER_PRODUCTS = [
  { key: 'homeOnly', label: 'í™ˆ ë‹¨ë…' },
  { key: 'homeTv', label: 'TV(ì£¼)' },
  { key: 'internet1g', label: 'ì¸í„°ë„· 1GB' },
  { key: 'internet500', label: 'ì¸í„°ë„· 500MB' },
  { key: 'internet100', label: 'ì¸í„°ë„· 100MB' },
  { key: 'tvFree', label: 'TVí”„ë¦¬(ë¶€)' },
  { key: 'smartHome', label: 'ìŠ¤ë§ˆíŠ¸í™ˆ' },
  { key: 'subSetTop', label: 'TVë¶€ì…‹íƒ‘' },
  { key: 'simulNewChange', label: 'í™ˆ + HS ì‹ ê·œ/ê¸°ë³€ ë™ì‹œíŒë§¤' },
  { key: 'simulMnp', label: 'í™ˆ + HS MNP ë™ì‹œíŒë§¤' },
  { key: 'simulUsedMnp', label: 'í™ˆ + ì¤‘ê³ MNP ë™ì‹œíŒë§¤' },
];

function homeOrderMeta(groupKey, itemKey) {
  const map = {
    'homeBase.homeOnly': { productType: 'homeOnly', label: 'í™ˆ ë‹¨ë…' },
    'homeBase.homeTv': { productType: 'homeTv', label: 'TV(ì£¼)' },
    'homeFlat.tvFree': { productType: 'tvFree', label: 'TVí”„ë¦¬(ë¶€)' },
    'homeFlat.smartHome': { productType: 'smartHome', label: 'ìŠ¤ë§ˆíŠ¸í™ˆ' },
  };
  return map[`${groupKey}.${itemKey}`] || null;
}



function HomeOrderManager({ userId, month, locked, dailyDays, saveDailyDay, onTeamCreditSaved, onHomeOrdersChanged }) {
  const [orders, setOrders] = useState([]);
  const [product, setProduct] = useState('homeOnly');
  const [customerName, setCustomerName] = useState('');
  const [memo, setMemo] = useState('');
  const [directComplete, setDirectComplete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [homeCompletionTarget, setHomeCompletionTarget] = useState(null);
  const [homeActualCompleteDate, setHomeActualCompleteDate] = useState('');
  // v21.23: í™ˆ ì¼€ì–´ í™”ë©´ì—ì„œ ì„¤ì¹˜ì˜ˆì •ì¼ì„ ë°”ë¡œ ìˆ˜ì •
  const [homeScheduleTarget, setHomeScheduleTarget] = useState(null);
  const [homeScheduleDate, setHomeScheduleDate] = useState('');
  const [homeCareActionSaving, setHomeCareActionSaving] = useState(false);
  const [archiveFilter, setArchiveFilter] = useState('completed');
  const [homeBatchTarget, setHomeBatchTarget] = useState(null);
  const [homeBatchSelected, setHomeBatchSelected] = useState([]);

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
    if (!await showAppConfirm({title:'í™ˆ ì²­ì•½ì„ ì·¨ì†Œí• ê¹Œìš”?',message:'ì·¨ì†Œ ê±´ì€ ì‹¤ì  ìš”ì•½ê³¼ ì •ì‚° ëŒ€ìƒì—ì„œ ì œì™¸ë©ë‹ˆë‹¤.',confirmLabel:'ì·¨ì†Œ ì²˜ë¦¬',tone:'danger'})) return;
    const { data:result, error } = await supabase.rpc('set_home_orders_status_atomic',{
      p_user_id:userId,p_order_ids:[order.id],p_expected_status:order.status,p_new_status:'cancelled'
    });
    if (error) return showLegacyAlert(`ìƒíƒœ ë³€ê²½ ì‹¤íŒ¨: ${friendlyError(error)}`);
    if(Number(result?.updated_count)!==1)return showLegacyAlert('ìƒíƒœ ë³€ê²½ ê²°ê³¼ë¥¼ í™•ì¸í•˜ì§€ ëª»í–ˆì–´ìš”.');
    const productLabel=HOME_ORDER_PRODUCTS.find(p=>p.key===order.product_type)?.label||order.product_type;
    notifyStoreManagers({actorId:userId,type:'home_cancelled',title:'í™ˆ ì²­ì•½ ì·¨ì†Œ',
      message:`${order.customer_name ? `${order.customer_name} Â· ` : ''}${homeNetworkLabel(order.network_type)} Â· ${productLabel}`,
      payload:{order_id:order.id,product_type:order.product_type,network_type:order.network_type,status:'cancelled'}});
    await load(); await onHomeOrdersChanged?.();
  };

  const confirmCompletion = async () => {
    const order=homeCompletionTarget;
    if (!order || !homeActualCompleteDate || locked) return;
    const [y,m,d]=homeActualCompleteDate.split('-');
    const completionMonth=`${y}-${m}`;
    const completionDay=d;
    const completionWorkDate=`${completionMonth}-${completionDay}`;
    let completionDailyRecord=null;

    const {data:supportCredit}=await supabase.from('team_sales_credits').select('id,credited_store').eq('source_type','home').contains('source_refs',[String(order.id)]).maybeSingle();
    if (!supportCredit&&order.source_group && order.source_key) {
      if (completionMonth === month) {
        const base=normalizeDay(dailyDays?.[completionDay]);
        const current=Number(base.groups?.[order.source_group]?.[order.source_key]||0);
        const next={...base,groups:{...base.groups,[order.source_group]:{
          ...(base.groups?.[order.source_group]||{}),[order.source_key]:current+1}}};
        completionDailyRecord=next;
      } else {
        const { data: rec, error: loadError } = await supabase
          .from('daily_records')
          .select('data')
          .eq('user_id', userId)
          .eq('work_date', completionWorkDate)
          .maybeSingle();

        if (loadError) {
          return showLegacyAlert(`ì™„ë£Œì¼ ì‹¤ì  ë¶ˆëŸ¬ì˜¤ê¸° ì‹¤íŒ¨: ${friendlyError(loadError)}`);
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

        completionDailyRecord=next;
      }
    }

    const {data:result,error}=await supabase.rpc('set_home_orders_status_atomic',{
      p_user_id:userId,p_order_ids:[order.id],p_expected_status:order.status,p_new_status:'completed',
      p_actual_install_date:homeActualCompleteDate,p_daily_record:completionDailyRecord,p_work_date:completionDailyRecord?completionWorkDate:null
    });
    if(error)return showLegacyAlert(`ì™„ë£Œ ì²˜ë¦¬ ì‹¤íŒ¨: ${friendlyError(error)}`);
    if(Number(result?.updated_count)!==1)return showLegacyAlert('ì™„ë£Œ ì²˜ë¦¬ ê²°ê³¼ë¥¼ í™•ì¸í•˜ì§€ ëª»í–ˆì–´ìš”.');

    const productLabel=HOME_ORDER_PRODUCTS.find(p=>p.key===order.product_type)?.label||order.product_type;
    notifyStoreManagers({actorId:userId,type:'home_completed',title:'í™ˆ ì„¤ì¹˜/ê°œí†µ ì™„ë£Œ',
      message:`${order.customer_name ? `${order.customer_name} Â· ` : ''}${homeNetworkLabel(order.network_type)} Â· ${productLabel} Â· ${homeActualCompleteDate}`,
      storeName:supportCredit?.credited_store||null,
      payload:{order_id:order.id,product_type:order.product_type,network_type:order.network_type,status:'completed',actual_install_date:homeActualCompleteDate,team_only:!!supportCredit}});
    setHomeCompletionTarget(null); setHomeActualCompleteDate(''); await load(); await onHomeOrdersChanged?.();
    if(supportCredit)await onTeamCreditSaved?.();
  };

  const openBatchAction = (group, action) => {
    if (locked || !group?.items?.length) return;
    const t=new Date();
    setHomeBatchTarget({...group,action});
    setHomeBatchSelected(group.items.map(o=>String(o.id)));
    setHomeActualCompleteDate(`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`);
  };

  const confirmBatchAction = async () => {
    const selected=(homeBatchTarget?.items||[]).filter(o=>homeBatchSelected.includes(String(o.id)));
    if(!selected.length || locked) return;
    if(homeBatchTarget.action==='cancelled'){
      if(!await showAppConfirm({title:`ì„ íƒí•œ ${selected.length}ê°œ ìƒí’ˆì„ ì·¨ì†Œí• ê¹Œìš”?`,message:'ì„ íƒí•˜ì§€ ì•Šì€ ìƒí’ˆì€ ì§„í–‰ì¤‘ ìƒíƒœë¡œ ìœ ì§€ë©ë‹ˆë‹¤.',confirmLabel:'ì„ íƒ ìƒí’ˆ ì·¨ì†Œ',tone:'danger'}))return;
      setHomeCareActionSaving(true);
      try{
        const {data:result,error}=await supabase.rpc('set_home_orders_status_atomic',{
          p_user_id:userId,p_order_ids:selected.map(o=>o.id),p_expected_status:'pending',p_new_status:'cancelled'
        });
        if(error)throw error;
        if(Number(result?.updated_count)!==selected.length)throw new Error('ë¬¶ìŒ ì·¨ì†Œ ê²°ê³¼ê°€ ìš”ì²­ ìˆ˜ì™€ ë‹¤ë¦…ë‹ˆë‹¤.');
        selected.forEach(order=>notifyStoreManagers({actorId:userId,type:'home_cancelled',title:'í™ˆ ì²­ì•½ ì·¨ì†Œ',
          message:`${order.customer_name ? `${order.customer_name} Â· ` : ''}${homeNetworkLabel(order.network_type)} Â· ${HOME_ORDER_PRODUCTS.find(p=>p.key===order.product_type)?.label||order.product_type}`,
          payload:{order_id:order.id,product_type:order.product_type,network_type:order.network_type,status:'cancelled'}}));
        setHomeBatchTarget(null); setHomeBatchSelected([]); await load(); await onHomeOrdersChanged?.();
      }catch(e){showLegacyAlert(`ë¬¶ìŒ ì·¨ì†Œ ì‹¤íŒ¨: ${friendlyError(e)}`);}
      finally{setHomeCareActionSaving(false);}
      return;
    }
    if(!homeActualCompleteDate)return;
    setHomeCareActionSaving(true);
    try{
      const supportById={};
      for(const order of selected){
        const {data,error}=await supabase.from('team_sales_credits').select('id,credited_store').eq('source_type','home').contains('source_refs',[String(order.id)]).maybeSingle();
        if(error)throw error;
        supportById[String(order.id)]=data||null;
      }
      const [y,m,d]=homeActualCompleteDate.split('-');
      const completionMonth=`${y}-${m}`, completionDay=d, completionWorkDate=`${completionMonth}-${completionDay}`;
      const countable=selected.filter(o=>!supportById[String(o.id)]&&o.source_group&&o.source_key);
      let completionDailyRecord=null;
      if(countable.length){
        let base;
        if(completionMonth===month) base=normalizeDay(dailyDays?.[completionDay]);
        else{
          const {data:rec,error}=await supabase.from('daily_records').select('data').eq('user_id',userId).eq('work_date',completionWorkDate).maybeSingle();
          if(error)throw error;
          base=normalizeDay(rec?.data);
        }
        const groups={...base.groups};
        countable.forEach(order=>{
          groups[order.source_group]={...(groups[order.source_group]||{})};
          groups[order.source_group][order.source_key]=Number(groups[order.source_group][order.source_key]||0)+1;
        });
        const next={...base,groups};
        completionDailyRecord=next;
      }
      const {data:result,error}=await supabase.rpc('set_home_orders_status_atomic',{
        p_user_id:userId,p_order_ids:selected.map(o=>o.id),p_expected_status:'pending',p_new_status:'completed',
        p_actual_install_date:homeActualCompleteDate,p_daily_record:completionDailyRecord,p_work_date:completionDailyRecord?completionWorkDate:null
      });
      if(error)throw error;
      if(Number(result?.updated_count)!==selected.length)throw new Error('ë¬¶ìŒ ì™„ë£Œ ê²°ê³¼ê°€ ìš”ì²­ ìˆ˜ì™€ ë‹¤ë¦…ë‹ˆë‹¤.');
      selected.forEach(order=>notifyStoreManagers({actorId:userId,type:'home_completed',title:'í™ˆ ì„¤ì¹˜/ê°œí†µ ì™„ë£Œ',
        message:`${order.customer_name ? `${order.customer_name} Â· ` : ''}${homeNetworkLabel(order.network_type)} Â· ${HOME_ORDER_PRODUCTS.find(p=>p.key===order.product_type)?.label||order.product_type} Â· ${homeActualCompleteDate}`,
        storeName:supportById[String(order.id)]?.credited_store||null,
        payload:{order_id:order.id,product_type:order.product_type,network_type:order.network_type,status:'completed',actual_install_date:homeActualCompleteDate,team_only:!!supportById[String(order.id)]}}));
      setHomeBatchTarget(null); setHomeBatchSelected([]); setHomeActualCompleteDate(''); await load(); await onHomeOrdersChanged?.();
      if(selected.some(o=>supportById[String(o.id)]))await onTeamCreditSaved?.();
    }catch(e){showLegacyAlert(`ë¬¶ìŒ ì™„ë£Œ ì²˜ë¦¬ ì‹¤íŒ¨: ${friendlyError(e)}`);}
    finally{setHomeCareActionSaving(false);}
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
      // ê°™ì€ íŒë§¤ì¼/ê³ ê°ì˜ ì§„í–‰ì¤‘ í™ˆ êµ¬ì„±ì€ í•œ ê³ ê° íŒë§¤ ë¬¶ìŒìœ¼ë¡œ ë³´ê³  ì¼ì •ë„ ê°™ì´ ë³€ê²½
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
      await load(); await onHomeOrdersChanged?.();
    }catch(e){
      showLegacyAlert(`ì„¤ì¹˜ ì˜ˆì •ì¼ ìˆ˜ì • ì‹¤íŒ¨: ${friendlyError(e)}`);
    }finally{
      setHomeCareActionSaving(false);
    }
  };

  const decrementCompletedPerformance = async (order) => {
    if(!order?.source_group || !order?.source_key || !order?.actual_install_date) return null;
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
      return {data:next,workDate:completedDate};
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
    return {data:next,workDate:completedDate};
  };

  const undoHomeStatus = async (order) => {
    if(locked || !order || !['completed','cancelled'].includes(order.status)) return;
    const isCompleted=order.status==='completed';
    const msg=isCompleted
      ? 'ì™„ë£Œ ì²˜ë¦¬ë¥¼ ì·¨ì†Œí•˜ê³  ë‹¤ì‹œ ì§„í–‰ì¤‘ìœ¼ë¡œ ëŒë¦´ê¹Œìš”?\nì™„ë£Œì¼ì— ë°˜ì˜ëœ í™•ì • ì‹¤ì ë„ í•¨ê»˜ ì›ë³µë©ë‹ˆë‹¤.'
      : 'ì·¨ì†Œ ì²˜ë¦¬ë¥¼ ë˜ëŒë¦¬ê³  ë‹¤ì‹œ ì§„í–‰ì¤‘ìœ¼ë¡œ ëŒë¦´ê¹Œìš”?';
    if(!await showAppConfirm({title:isCompleted?'ì™„ë£Œ ì²˜ë¦¬ë¥¼ ë˜ëŒë¦´ê¹Œìš”?':'ì·¨ì†Œ ì²˜ë¦¬ë¥¼ ë˜ëŒë¦´ê¹Œìš”?',message:msg,confirmLabel:'ì§„í–‰ì¤‘ìœ¼ë¡œ ë³€ê²½'}))return;

    setHomeCareActionSaving(true);
    try{
      const rollback=isCompleted?await decrementCompletedPerformance(order):null;
      const {data:result,error}=await supabase.rpc('set_home_orders_status_atomic',{
        p_user_id:userId,p_order_ids:[order.id],p_expected_status:order.status,p_new_status:'pending',
        p_daily_record:rollback?.data||null,p_work_date:rollback?.workDate||null
      });
      if(error)throw error;
      if(Number(result?.updated_count)!==1)throw new Error('ìƒíƒœ ë˜ëŒë¦¬ê¸° ê²°ê³¼ë¥¼ í™•ì¸í•˜ì§€ ëª»í–ˆì–´ìš”.');
      await load(); await onHomeOrdersChanged?.();
    }catch(e){
      showLegacyAlert(`ìƒíƒœ ë˜ëŒë¦¬ê¸° ì‹¤íŒ¨: ${friendlyError(e)}`);
    }finally{
      setHomeCareActionSaving(false);
    }
  };

  const careInfo = (o) => {
    const p=o.planned_install_date ? String(o.planned_install_date).slice(0,10) : null;
    if(!p)return {rank:3,label:'ì¼ì • ë¯¸ì •',cls:'text-gray-500 bg-gray-50'};
    const now=new Date(), a=new Date(now.getFullYear(),now.getMonth(),now.getDate()), b=new Date(`${p}T00:00:00`);
    const diff=Math.round((b-a)/86400000);
    if(diff<0)return {rank:0,label:`í™•ì¸ í•„ìš” Â· ${Math.abs(diff)}ì¼ ê²½ê³¼`,cls:'text-red-600 bg-red-50'};
    if(diff===0)return {rank:1,label:'ì˜¤ëŠ˜ ì„¤ì¹˜ ì˜ˆì •',cls:'text-orange-600 bg-orange-50'};
    return {rank:2,label:`${diff}ì¼ í›„ ì„¤ì¹˜ ì˜ˆì •`,cls:'text-violet-600 bg-violet-50'};
  };

  const pending = orders.filter(o => o.status === 'pending').sort((a,b)=>careInfo(a).rank-careInfo(b).rank || String(a.planned_install_date||'9999').localeCompare(String(b.planned_install_date||'9999')));
  const completed = orders.filter(o => o.status === 'completed');
  const cancelled = orders.filter(o => o.status === 'cancelled');

  return (
    <div className="space-y-3 mb-4">
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="text-xs text-gray-400">ì´ë²ˆ ë‹¬ ì§„í–‰ í˜„í™©</div>
        <div className="text-sm font-bold text-gray-900 mt-0.5">
          ì§„í–‰ì¤‘ {fmtCount(pending.length)} Â· ì™„ë£Œ {fmtCount(completed.length)} Â· ì·¨ì†Œ {fmtCount(cancelled.length)}
        </div>
        {pending.length ? (
          <div className="mt-3 space-y-4">
            {Object.entries(
              pending.reduce((acc, o) => {
                const day = o.source_work_date
                  ? new Date(`${o.source_work_date}T12:00:00`).toLocaleDateString('ko-KR')
                  : new Date(o.applied_at).toLocaleDateString('ko-KR');
                const customer = o.customer_name || 'ê³ ê°ëª… ë¯¸ì…ë ¥';
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
                    <div className="text-sm font-bold text-gray-900">{group.customer} ê³ ê°</div>
                    <span className="text-[10px] font-bold text-amber-600">{fmtCount(group.items.length)}ê°œ ì§„í–‰ì¤‘</span>
                  </div>
                  {group.items.length>1&&<div className="grid grid-cols-2 gap-2 mb-2">
                    <button type="button" disabled={locked||homeCareActionSaving} onClick={()=>openBatchAction(group,'completed')} className="py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold disabled:opacity-50">ì—¬ëŸ¬ ìƒí’ˆ ì™„ë£Œ</button>
                    <button type="button" disabled={locked||homeCareActionSaving} onClick={()=>openBatchAction(group,'cancelled')} className="py-2 rounded-lg bg-white border border-gray-200 text-gray-500 text-xs font-semibold disabled:opacity-50">ì—¬ëŸ¬ ìƒí’ˆ ì·¨ì†Œ</button>
                  </div>}
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
                              <div className="text-[10px] text-gray-400 mt-1">ì„¤ì¹˜ì˜ˆì • {o.planned_install_date ? String(o.planned_install_date).slice(0,10) : 'ë¯¸ì •'}</div>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${careInfo(o).cls}`}>{careInfo(o).label}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 mt-2">
                            <button type="button" disabled={locked||homeCareActionSaving} onClick={()=>openScheduleEdit(o)}
                              className="py-2 rounded-lg bg-violet-50 border border-violet-100 text-violet-700 text-xs font-semibold disabled:opacity-50">ì¼ì • ìˆ˜ì •</button>
                            <button type="button" disabled={locked||homeCareActionSaving} onClick={()=>changeStatus(o,'completed')}
                              className="py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold disabled:opacity-50">ì„¤ì¹˜/ê°œí†µ ì™„ë£Œ</button>
                            <button type="button" disabled={locked||homeCareActionSaving} onClick={()=>changeStatus(o,'cancelled')}
                              className="py-2 rounded-lg bg-white border border-gray-200 text-gray-500 text-xs font-semibold disabled:opacity-50">ì·¨ì†Œ</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : <div className="mt-3 rounded-xl bg-gray-50 py-4 text-center text-xs text-gray-400">í˜„ì¬ ì¼€ì–´í•  ì§„í–‰ì¤‘ ì²­ì•½ì´ ì—†ì–´ìš”.</div>}
        {(completed.length>0 || cancelled.length>0) && (
          <details className="mt-3">
            <summary className="text-xs font-semibold text-violet-600 cursor-pointer">ì²˜ë¦¬ëœ ë‚´ì—­ ë³´ê¸°</summary>
            <div className="mt-2 grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1">
              {[['completed',`ì„¤ì¹˜ì™„ë£Œ ${fmtCount(completed.length)}ê±´`],['cancelled',`ì·¨ì†Œ ${fmtCount(cancelled.length)}ê±´`]].map(([key,label])=><button key={key} type="button" onClick={()=>setArchiveFilter(key)} className={`rounded-lg py-2 text-[11px] font-bold ${archiveFilter===key?'bg-white text-violet-700 shadow-sm':'text-gray-500'}`}>{label}</button>)}
            </div>
            <div className="mt-2 space-y-1.5">
              {(archiveFilter==='completed'?completed:cancelled).sort((a,b)=>new Date(b.applied_at)-new Date(a.applied_at)).map(o=>{
                const def=HOME_ORDER_PRODUCTS.find(p=>p.key===o.product_type);
                return <div key={o.id} className="rounded-lg bg-gray-50 px-3 py-2">
                  <div className="flex justify-between gap-2 items-start">
                    <div>
                      <div className="text-xs font-semibold text-gray-700">{o.customer_name ? `${o.customer_name} Â· ` : ''}{homeNetworkLabel(o.network_type)} Â· {def?.label || o.product_type}</div>
                      {(o.status==='completed' || o.status==='cancelled')&&<div className="text-[10px] text-gray-400 mt-0.5 leading-none">
                        {o.status==='completed'
                          ? `ì™„ë£Œì¼ ${fmtShortDate(o.actual_install_date || o.completed_at)}`
                          : `ì·¨ì†Œì¼ ${fmtShortDate(o.cancelled_at) || 'ê¸°ë¡ ì—†ìŒ'}`}
                      </div>}
                    </div>
                    <span className={`text-[10px] font-bold ${o.status==='completed'?'text-emerald-600':'text-gray-400'}`}>{o.status==='completed'?'ì™„ë£Œ':'ì·¨ì†Œ'}</span>
                  </div>
                  <div className="flex justify-end mt-2">
                    <button type="button" disabled={locked||homeCareActionSaving} onClick={()=>undoHomeStatus(o)}
                      className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-[10px] font-semibold text-violet-600 disabled:opacity-50">
                      ì§„í–‰ì¤‘ìœ¼ë¡œ ë˜ëŒë¦¬ê¸°
                    </button>
                  </div>
                </div>
              })}
            </div>
          </details>
        )}
      </div>
      <div className="text-[11px] text-gray-400 px-1">
        í™•ì • ì‹¤ì ì€ ì‹¤ì œ ì„¤ì¹˜/ê°œí†µ ì™„ë£Œì¼ ê¸°ì¤€ìœ¼ë¡œ ë°˜ì˜ë¼ìš”.
      </div>
      {homeScheduleTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl">
            <div className="text-xs text-violet-600 font-semibold">ì„¤ì¹˜ ì˜ˆì •ì¼ ìˆ˜ì •</div>
            <div className="text-lg font-bold text-gray-900 mt-1">
              {homeScheduleTarget.customer_name || 'ê³ ê°'} Â· {homeNetworkLabel(homeScheduleTarget.network_type)}
            </div>
            <div className="text-[11px] text-gray-400 mt-1">ê°™ì€ ê³ ê°ì˜ ê°™ì€ íŒë§¤ì¼ í™ˆ êµ¬ì„± ì¼ì •ì´ í•¨ê»˜ ë³€ê²½ë©ë‹ˆë‹¤.</div>
            <label className="block text-xs font-semibold text-gray-500 mt-4 mb-1.5">ì„¤ì¹˜ ì˜ˆì •ì¼</label>
            <input type="date" value={homeScheduleDate} onChange={(e)=>setHomeScheduleDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm" />
            <button type="button" onClick={()=>setHomeScheduleDate('')}
              className="mt-2 text-[11px] font-semibold text-gray-400">ì¼ì • ë¯¸ì •ìœ¼ë¡œ ë³€ê²½</button>
            <div className="grid grid-cols-2 gap-2 mt-5">
              <button onClick={()=>{setHomeScheduleTarget(null);setHomeScheduleDate('');}} disabled={homeCareActionSaving}
                className="py-2.5 rounded-xl bg-gray-100 text-gray-500 text-sm font-semibold disabled:opacity-50">ë‹«ê¸°</button>
              <button onClick={saveScheduleEdit} disabled={homeCareActionSaving}
                className="py-2.5 rounded-xl bg-violet-600 text-white text-sm font-bold disabled:opacity-50">
                {homeCareActionSaving?'ì €ì¥ ì¤‘...':'ì¼ì • ì €ì¥'}
              </button>
            </div>
          </div>
        </div>
      )}

      {homeCompletionTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl">
            <div className="text-xs text-emerald-600 font-semibold">ì„¤ì¹˜/ê°œí†µ ì™„ë£Œ</div>
            <div className="text-lg font-bold text-gray-900 mt-1">
              {homeCompletionTarget.customer_name || 'ê³ ê°'} Â· {homeNetworkLabel(homeCompletionTarget.network_type)} Â· {HOME_ORDER_PRODUCTS.find(p=>p.key===homeCompletionTarget.product_type)?.label || homeCompletionTarget.product_type}
            </div>
            <label className="block text-xs font-semibold text-gray-500 mt-4 mb-1.5">ì‹¤ì œ ì„¤ì¹˜/ê°œí†µ ì™„ë£Œì¼ *</label>
            <input type="date" value={homeActualCompleteDate} onChange={(e)=>setHomeActualCompleteDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm" />
            <div className="text-[11px] text-gray-400 mt-2">ì„ íƒí•œ ì‹¤ì œ ì™„ë£Œì¼ì˜ í™•ì • ì‹¤ì ìœ¼ë¡œ ë°˜ì˜ë©ë‹ˆë‹¤.</div>
            <div className="grid grid-cols-2 gap-2 mt-5">
              <button onClick={()=>{setHomeCompletionTarget(null);setHomeActualCompleteDate('');}}
                className="py-2.5 rounded-xl bg-gray-100 text-gray-500 text-sm font-semibold">ë‹«ê¸°</button>
              <button onClick={confirmCompletion} disabled={!homeActualCompleteDate}
                className="py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold disabled:opacity-50">ì™„ë£Œ ì²˜ë¦¬</button>
            </div>
          </div>
        </div>
      )}

      {homeBatchTarget&&(
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className={`text-xs font-semibold ${homeBatchTarget.action==='completed'?'text-emerald-600':'text-red-500'}`}>ì—¬ëŸ¬ ìƒí’ˆ {homeBatchTarget.action==='completed'?'ì„¤ì¹˜/ê°œí†µ ì™„ë£Œ':'ì·¨ì†Œ'}</div>
            <div className="text-lg font-bold text-gray-900 mt-1">{homeBatchTarget.customer} ê³ ê°</div>
            <div className="text-[11px] text-gray-400 mt-1">ì²˜ë¦¬í•  ìƒí’ˆë§Œ ì„ íƒí•˜ì„¸ìš”. ì„ íƒí•˜ì§€ ì•Šì€ ìƒí’ˆì€ ì§„í–‰ì¤‘ìœ¼ë¡œ ë‚¨ìŠµë‹ˆë‹¤.</div>
            <button type="button" onClick={()=>setHomeBatchSelected(homeBatchSelected.length===homeBatchTarget.items.length?[]:homeBatchTarget.items.map(o=>String(o.id)))} className="mt-4 text-xs font-bold text-violet-600">
              {homeBatchSelected.length===homeBatchTarget.items.length?'ì „ì²´ ì„ íƒ í•´ì œ':'ì „ì²´ ì„ íƒ'}
            </button>
            <div className="mt-2 space-y-2">
              {homeBatchTarget.items.map(o=>{const checked=homeBatchSelected.includes(String(o.id));return <label key={o.id} className={`flex items-center gap-3 rounded-xl border p-3 ${checked?'border-violet-300 bg-violet-50':'border-gray-200 bg-white'}`}><input type="checkbox" checked={checked} onChange={()=>setHomeBatchSelected(a=>checked?a.filter(id=>id!==String(o.id)):[...a,String(o.id)])}/><span className="text-sm font-semibold text-gray-700">{HOME_ORDER_PRODUCTS.find(p=>p.key===o.product_type)?.label||o.product_type}</span></label>})}
            </div>
            {homeBatchTarget.action==='completed'&&<><label className="block text-xs font-semibold text-gray-500 mt-4 mb-1.5">ì‹¤ì œ ì„¤ì¹˜/ê°œí†µ ì™„ë£Œì¼ *</label><input type="date" value={homeActualCompleteDate} onChange={e=>setHomeActualCompleteDate(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm"/></>}
            <div className="grid grid-cols-2 gap-2 mt-5">
              <button type="button" disabled={homeCareActionSaving} onClick={()=>{setHomeBatchTarget(null);setHomeBatchSelected([]);setHomeActualCompleteDate('')}} className="py-2.5 rounded-xl bg-gray-100 text-gray-500 text-sm font-semibold disabled:opacity-50">ë‹«ê¸°</button>
              <button type="button" disabled={homeCareActionSaving||!homeBatchSelected.length||(homeBatchTarget.action==='completed'&&!homeActualCompleteDate)} onClick={confirmBatchAction} className={`py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-50 ${homeBatchTarget.action==='completed'?'bg-emerald-600':'bg-red-500'}`}>{homeCareActionSaving?'ì²˜ë¦¬ ì¤‘...':`ì„ íƒ ${homeBatchSelected.length}ê°œ ì²˜ë¦¬`}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}


/* ===================== v12 ê´€ë¦¬ì ì•Œë¦¼ì„¼í„° ===================== */

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
            showAppToast(item.message||'ìƒˆ ì•Œë¦¼ì´ ë„ì°©í–ˆì–´ìš”.',{title:item.title||'ë¯¸ì†Œí˜ì´ ì•Œë¦¼',tone:'info'});
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
      title="ì•Œë¦¼"
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
    if(!supported)return setMessage('ì´ ê¸°ê¸°ì—ì„œëŠ” í‘¸ì‹œ ì•Œë¦¼ì„ ì§€ì›í•˜ì§€ ì•Šì•„ìš”.');
    if(/iphone|ipad|ipod/i.test(navigator.userAgent)&&!standalone)return setMessage('ì•„ì´í°ì€ ë¨¼ì € Safariì—ì„œ í™ˆ í™”ë©´ì— ì¶”ê°€í•œ ë’¤, ë¯¸ì†Œí˜ì´ ì•±ì—ì„œ ì¼œì£¼ì„¸ìš”.');
    setBusy(true);setMessage('');
    try{
      const permission=await Notification.requestPermission();
      if(permission!=='granted')throw new Error('íœ´ëŒ€í° ì„¤ì •ì—ì„œ ë¯¸ì†Œí˜ì´ ì•Œë¦¼ì„ í—ˆìš©í•´ì£¼ì„¸ìš”.');
      const reg=await navigator.serviceWorker.ready;
      const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:pushKeyBytes(PUSH_VAPID_PUBLIC_KEY)});
      const json=sub.toJSON(),keys=json.keys||{};
      const {error}=await supabase.from('push_subscriptions').upsert({user_id:userId,endpoint:json.endpoint,p256dh:keys.p256dh,auth:keys.auth,user_agent:navigator.userAgent,enabled:true,updated_at:new Date().toISOString()},{onConflict:'endpoint'});
      if(error)throw error;
      setEnabled(true);setMessage('ì•Œë¦¼ì„ ì¼°ì–´ìš”. í…ŒìŠ¤íŠ¸ ì•Œë¦¼ì„ ëˆŒëŸ¬ í™•ì¸í•´ì£¼ì„¸ìš”.');
    }catch(error){setMessage(friendlyError(error))}finally{setBusy(false)}
  };
  const disable=async()=>{
    setBusy(true);setMessage('');
    try{const reg=await navigator.serviceWorker.ready,sub=await reg.pushManager.getSubscription();if(sub){await supabase.from('push_subscriptions').delete().eq('endpoint',sub.endpoint).eq('user_id',userId);await sub.unsubscribe()}setEnabled(false);setMessage('ì´ ê¸°ê¸°ì˜ ì•Œë¦¼ì„ ê»ì–´ìš”.')}catch(error){setMessage(friendlyError(error))}finally{setBusy(false)}
  };
  const test=async()=>{
    setBusy(true);setMessage('í…ŒìŠ¤íŠ¸ ì•Œë¦¼ì„ ë³´ë‚´ëŠ” ì¤‘ì´ì—ìš”.');
    const {error}=await supabase.from('notifications').insert({recipient_id:userId,actor_id:userId,type:'push_test',title:'ë¯¸ì†Œí˜ì´ ì•Œë¦¼ í…ŒìŠ¤íŠ¸',message:'í‘¸ì‹œ ì•Œë¦¼ì´ ì •ìƒì ìœ¼ë¡œ ì—°ê²°ëì–´ìš” ğŸ‰',payload:{screen:'notifications'}});
    setMessage(error?friendlyError(error):'ì ì‹œ í›„ íœ´ëŒ€í° ì•Œë¦¼ì„ í™•ì¸í•´ì£¼ì„¸ìš”.');setBusy(false);
  };
  return <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4">
    <div className="flex items-start justify-between gap-3"><div><div className="text-sm font-bold text-gray-900">íœ´ëŒ€í° í‘¸ì‹œ ì•Œë¦¼</div><div className="text-[11px] text-gray-500 mt-1">ì•±ì„ ë‹«ì•„ë„ ìŠ¹ì¸ ê²°ê³¼ì™€ ì˜¤ëŠ˜ ê³ ê° ì•½ì†ì„ ì•Œë ¤ë“œë ¤ìš”.</div></div><span className={`text-[10px] font-bold px-2 py-1 rounded-full ${enabled?'bg-emerald-100 text-emerald-700':'bg-gray-200 text-gray-500'}`}>{enabled?'ì¼œì§':'êº¼ì§'}</span></div>
    {!supported&&<div className="text-[11px] text-amber-700 mt-2">í˜„ì¬ ë¸Œë¼ìš°ì €ì—ì„œëŠ” ì§€ì›ë˜ì§€ ì•Šì•„ìš”. ì„¤ì¹˜í•œ ë¯¸ì†Œí˜ì´ ì•±ì—ì„œ ë‹¤ì‹œ ì—´ì–´ì£¼ì„¸ìš”.</div>}
    {message&&<div className="text-[11px] text-violet-700 mt-2">{message}</div>}
    <div className="flex gap-2 mt-3">{enabled?<><button disabled={busy} onClick={test} className="flex-1 rounded-xl bg-violet-600 py-2.5 text-xs font-bold text-white disabled:opacity-50">í…ŒìŠ¤íŠ¸ ì•Œë¦¼</button><button disabled={busy} onClick={disable} className="rounded-xl bg-white border border-gray-200 px-3 py-2.5 text-xs font-bold text-gray-500 disabled:opacity-50">ë„ê¸°</button></>:<button disabled={busy||!supported} onClick={enable} className="w-full rounded-xl bg-violet-600 py-2.5 text-xs font-bold text-white disabled:opacity-50">{busy?'í™•ì¸ ì¤‘...':'ì•Œë¦¼ ë°›ê¸°'}</button>}</div>
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
    if (type === 'home_order') return 'ğŸ ';
    if (type === 'home_completed') return 'âœ…';
    if (type === 'home_cancelled') return 'âš ï¸';
    if (type === 'daily_input') return 'ğŸ“ˆ';
    if (type === 'daily_input_reminder') return 'âœï¸';
    return 'ğŸ””';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-4 text-sm text-gray-400 flex items-center gap-2">
        <Loader2 size={14} className="animate-spin" />
        ì•Œë¦¼ ë¶ˆëŸ¬ì˜¤ëŠ” ì¤‘...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <PushNotificationSettings userId={userId} />
      <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs text-gray-400">ë‚´ê°€ í™•ì¸í•  ì†Œì‹</div>
          <div className="text-base font-bold text-gray-900 mt-0.5">
            ğŸ”” ì•Œë¦¼ì„¼í„°
          </div>
          <div className="text-xs text-gray-400 mt-1">
            ì½ì§€ ì•Šì€ ì•Œë¦¼ {unreadCount}ê°œ
          </div>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="text-xs font-semibold text-violet-600"
          >
            ëª¨ë‘ ì½ìŒ
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {items.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-400">
            ì•„ì§ ì•Œë¦¼ì´ ì—†ì–´ìš”.
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

async function notifyStoreManagers({ actorId, type, title, message, payload = {}, storeName = null }) {
  if (!actorId) return;

  try {
    const { data: actor, error: actorError } = await supabase
      .from('profiles')
      .select('id, name, store_name')
      .eq('id', actorId)
      .maybeSingle();

    if (actorError || !(storeName||actor?.store_name)) return;

    const { data: managers, error: managersError } = await supabase
      .from('profiles')
      .select('id')
      .eq('store_name', storeName||actor.store_name)
      .eq('active', true)
      .eq('status', 'approved')
      .in('position', ['ì ì¥', 'ë¶€ì ì¥']);

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


/* ===================== v16: ë§¤ì¥ ëª©í‘œ / ì˜ì—…ë¹„ìš© / ìŠ¤íŒŸ ì •ì±… ===================== */

const COMPANY_STORE_GOAL_BASE = [
  { match:['ì‚¼ë¯¸ì‹œì¥2í˜¸','ì‚¼ë¯¸2'], hs:63, home:6, productivity:78.8, tvFree:5, smartHome:3 },
  { match:['ì‚¼ë¯¸ì‹œì¥','ì‚¼ë¯¸'], hs:102, home:10, productivity:127.5, tvFree:8, smartHome:5 },
  { match:['ìƒë¡ìˆ˜ì—­','ìƒë¡'], hs:100, home:10, productivity:123, tvFree:8, smartHome:5 },
  { match:['ë¡¯ë°ë§ˆíŠ¸','ëŒ€ì•¼'], hs:52, home:5, productivity:65, tvFree:4, smartHome:3 },
  { match:['ì£¼ë¯¼ì„¼í„°','ì£¼ë¯¼'], hs:70, home:7, productivity:82, tvFree:6, smartHome:4 },
  { match:['ì¥ê³¡ì—­','ì¥ê³¡'], hs:54, home:6, productivity:67.5, tvFree:5, smartHome:3 },
  { match:['ë„ì¼ì‹œì¥','ê±°ëª¨'], hs:100, home:10, productivity:123, tvFree:8, smartHome:5 },
  { match:['ì›”ê³¶'], hs:64, home:7, productivity:80, tvFree:5, smartHome:3 },
  { match:['ì„±í¬ì—­','ì„±í¬'], hs:37, home:4, productivity:46.3, tvFree:3, smartHome:2 },
  { match:['ì‚°ë³¸'], hs:129, home:13, productivity:161.3, tvFree:9, smartHome:5 },
  { match:['ë²•ì¡°íƒ€ìš´','ë²•ì¡°','ë²”ì¡°'], hs:39, home:4, productivity:48.8, tvFree:3, smartHome:2 },
  { match:['ì€ê³„ì‚¬ê±°ë¦¬','ì€ê³„'], hs:41, home:4, productivity:51.3, tvFree:3, smartHome:2 },
  { match:['ë³¸ì˜¤ì¤‘í•™êµ','ë³¸ì˜¤'], hs:41, home:4, productivity:51.3, tvFree:3, smartHome:2 },
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
  { key:'simMnp', label:'SIM MNP' },
  { key:'second', label:'2ND' },
  { key:'productivity', label:'ìƒì‚°ì„±' },
  { key:'home', label:'í™ˆ' },
  { key:'tvFree', label:'TVí”„ë¦¬(ë¶€)' },
  { key:'smartHome', label:'ìŠ¤ë§ˆíŠ¸í™ˆ' },
  { key:'sono', label:'ì†Œë…¸' },
  { key:'tailoredAmount', label:'ë§ì¶¤ì œì•ˆ ë§¤ì¶œì•¡' },
  { key:'tailoredCount', label:'ë§ì¶¤ì œì•ˆ ì—…ì…€ ê±´ìˆ˜' },
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

function isFinalStorePerformance(row, month) {
  if (!row || row.month !== month || !row.as_of_date) return false;
  const [year,monthNumber]=String(month).split('-').map(Number);
  const lastDay=new Date(year,monthNumber,0).getDate();
  return String(row.as_of_date) >= `${month}-${String(lastDay).padStart(2,'0')}` || row.metrics?.status==='final';
}

function finalStoreMetric(row, key, fallback=0) {
  if (!row) return Number(fallback||0);
  const metrics=row.metrics||{};
  const aliases={free:'tv',tvFree:'tv',smart:'smartHome',upsell:'tailoredCount',upsellAmount:'tailoredAmount'};
  const sourceKey=aliases[key]||key;
  return metrics[sourceKey]===undefined ? Number(fallback||0) : Number(metrics[sourceKey]||0);
}

function useFinalStorePerformance(month, storeName='') {
  const [data,setData]=useState(storeName?null:{});
  useEffect(()=>{
    let alive=true;
    let query=supabase.from('head_office_store_performance').select('month,store_name,as_of_date,metrics,note').eq('month',month);
    if(storeName)query=query.eq('store_name',storeName).maybeSingle();
    query.then(({data:rows,error})=>{
      if(!alive)return;
      if(error){console.error('FINAL STORE PERFORMANCE LOAD ERROR',error);setData(storeName?null:{});return;}
      if(storeName){setData(isFinalStorePerformance(rows,month)?rows:null);return;}
      const map={};(rows||[]).forEach(row=>{if(isFinalStorePerformance(row,month))map[row.store_name]=row});setData(map);
    });
    return()=>{alive=false};
  },[month,storeName]);
  return data;
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
      <div><div className="text-xs text-gray-400">ğŸª ìš°ë¦¬ ë§¤ì¥ ëª©í‘œ</div><div className="font-bold text-gray-900 mt-0.5">{displayStoreName(storeName)} Â· {monthLabel(month)}</div></div>
      <span className="text-xs text-violet-600 font-semibold">{open?'ì ‘ê¸°':'ì§„í–‰ë¥  ë³´ê¸°'}</span>
    </button>
    {open&&<div className="px-4 pb-4 space-y-3">
      {STORE_GOAL_METRICS.map(m=>{
        const cur=storeGoalCurrent(mergedDraft,pay,m.key), c=Number(company[m.key]||0), ch=Number(challenge[m.key]||c||0);
        if(!c&&!ch)return null;
        const pct=ch?Math.min(100,cur/ch*100):0;
        return <div key={m.key}>
          <div className="flex justify-between text-xs"><span className="font-medium text-gray-700">{m.label}</span><span className="text-gray-500">{Number.isInteger(cur)?fmtCount(cur):fmtNum(cur,1)} / <b>{fmtNum(ch,1)}</b></span></div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden mt-1"><div className="h-full bg-violet-500 rounded-full" style={{width:`${pct}%`}} /></div>
          <div className="text-[10px] mt-1 text-gray-400">{c&&cur>=c?'âœ… íšŒì‚¬ ê¸°ì¤€ ë‹¬ì„±':`íšŒì‚¬ ê¸°ì¤€ ${c||'-'}`} Â· ë„ì „ {ch||'-'}</div>
        </div>
      })}
    </div>}
  </div>;
}

function SalesExpensePanel({ userId, month, onTotal }) {
  const [items,setItems]=useState([]), [open,setOpen]=useState(false);
  const [form,setForm]=useState({amount:'',category:'ì¼€ì´ìŠ¤',customer_name:'',expense_date:`${month}-01`,memo:''});
  const load=useCallback(async()=>{
    if(!userId)return;
    const {data}=await supabase.from('sales_expenses').select('*').eq('user_id',userId).gte('expense_date',`${month}-01`).lt('expense_date',(()=>{const [y,m]=month.split('-').map(Number);const d=new Date(y,m,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`})()).order('expense_date',{ascending:false});
    const rows=data||[];setItems(rows);onTotal?.(rows.reduce((s,x)=>s+Number(x.amount||0),0));
  },[userId,month,onTotal]);
  useEffect(()=>{load()},[load]);
  useEffect(()=>setForm(f=>({...f,expense_date:`${month}-${String(new Date().getDate()).padStart(2,'0')}`})),[month]);
  const add=async()=>{
    const amount=Number(form.amount); if(!amount||amount<=0)return showAppToast('ë¹„ìš© ê¸ˆì•¡ì„ ì…ë ¥í•´ì£¼ì„¸ìš”.',{tone:'error'});
    const {error}=await supabase.from('sales_expenses').insert({...form,amount,user_id:userId,customer_name:form.customer_name.trim()||null,memo:form.memo.trim()||null});
    if(error)return showAppToast(friendlyError(error),{tone:'error',title:'ë¹„ìš© ë“±ë¡ ì‹¤íŒ¨'});
    setForm(f=>({...f,amount:'',customer_name:'',memo:''}));load();
  };
  const remove=async(id)=>{if(!await showAppConfirm({title:'ì˜ì—…ë¹„ìš©ì„ ì‚­ì œí• ê¹Œìš”?',message:'ì‚­ì œí•˜ë©´ ì´ë²ˆ ë‹¬ ë¹„ìš© í•©ê³„ì—ì„œë„ ì¦‰ì‹œ ë¹ ì§‘ë‹ˆë‹¤.',confirmLabel:'ë¹„ìš© ì‚­ì œ',tone:'danger'}))return;await supabase.from('sales_expenses').delete().eq('id',id).eq('user_id',userId);showAppToast('ì˜ì—…ë¹„ìš©ì„ ì‚­ì œí–ˆì–´ìš”.');load()};
  const total=items.reduce((s,x)=>s+Number(x.amount||0),0);
  return <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
    <button onClick={()=>setOpen(v=>!v)} className="w-full p-4 flex justify-between items-center text-left">
      <div><div className="text-sm font-bold text-gray-800">ğŸ’³ ì˜ì—…ë¹„ìš©</div><div className="text-xs text-gray-400 mt-0.5">ì´ë²ˆ ë‹¬ {won(total)} Â· ê³ ê°ëª…ì€ ì„ íƒ</div></div>
      <span className="text-xs text-violet-600">{open?'ì ‘ê¸°':'ë“±ë¡/ë‚´ì—­'}</span>
    </button>
    {open&&<div className="px-4 pb-4 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <input type="date" value={form.expense_date} onChange={e=>setForm({...form,expense_date:e.target.value})} className="border rounded-lg px-2 py-2 text-xs"/>
        <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} className="border rounded-lg px-2 py-2 text-xs"><option>ì¼€ì´ìŠ¤</option><option>ì˜¤í¼</option><option>ê³ ê° ì‚¬ì€í’ˆ</option><option>íŒì´‰</option><option>ê¸°íƒ€</option></select>
        <input inputMode="numeric" placeholder="ê¸ˆì•¡" value={fmtInputNumber(form.amount)} onChange={e=>setForm({...form,amount:e.target.value.replace(/\D/g,'')})} className="border rounded-lg px-2 py-2 text-xs"/>
        <input placeholder="ê³ ê°ëª… (ì„ íƒ)" value={form.customer_name} onChange={e=>setForm({...form,customer_name:e.target.value})} className="border rounded-lg px-2 py-2 text-xs"/>
      </div>
      <input placeholder="ë©”ëª¨ (ì„ íƒ)" value={form.memo} onChange={e=>setForm({...form,memo:e.target.value})} className="w-full border rounded-lg px-2 py-2 text-xs"/>
      <button onClick={add} className="w-full py-2 rounded-lg bg-violet-600 text-white text-xs font-bold">ë¹„ìš© ë“±ë¡</button>
      <div className="divide-y">
        {items.slice(0,20).map(x=><div key={x.id} className="py-2 flex justify-between gap-2 text-xs"><div><b>{x.category}</b> Â· {x.customer_name||'ì¼ë°˜'}<div className="text-[10px] text-gray-400">{x.expense_date}{x.memo?` Â· ${x.memo}`:''}</div></div><div className="flex items-center gap-2"><b>{won(x.amount)}</b><button onClick={()=>remove(x.id)} className="text-gray-300">ì‚­ì œ</button></div></div>)}
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
    if(!policyId)return showLegacyAlert('ìŠ¤íŒŸ ì •ì±…ì„ ì„ íƒí•´ì£¼ì„¸ìš”.');
    const {error}=await supabase.from('spot_claims').insert({
      policy_id:policyId,user_id:userId,
      claim_date:claimDate||new Date().toISOString().slice(0,10),
      customer_name:customer.trim()||null,status:'pending',source_context:'mobile'
    });
    if(error)return showLegacyAlert(`ìŠ¤íŒŸ ì‹ ì²­ ì‹¤íŒ¨: ${friendlyError(error)}`);
    setCustomer('');setPolicyId('');load();
  };

  const addDirect=async()=>{
    const title=directTitle.trim(), amount=Number(directAmount);
    if(!title)return showLegacyAlert('ìŠ¤íŒŸ ì •ì±…ëª…ì„ ì…ë ¥í•´ì£¼ì„¸ìš”.');
    if(!amount||amount<=0)return showLegacyAlert('ì¶”ê°€ ê¸ˆì•¡ì„ ì…ë ¥í•´ì£¼ì„¸ìš”.');
    const {error}=await supabase.from('spot_claims').insert({
      policy_id:null,user_id:userId,
      claim_date:claimDate||new Date().toISOString().slice(0,10),
      customer_name:customer.trim()||null,status:'pending',
      direct_title:title,direct_amount:amount,direct_memo:directMemo.trim()||null,source_context:'mobile'
    });
    if(error)return showLegacyAlert(`ìŠ¤íŒŸ ì§ì ‘ ì…ë ¥ ì‹¤íŒ¨: ${friendlyError(error)}`);
    setDirectTitle('');setDirectAmount('');setDirectMemo('');setCustomer('');setDirectOpen(false);load();
  };

  return <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
    <button onClick={()=>setOpen(v=>!v)} className="w-full p-4 flex justify-between text-left">
      <div><div className="text-sm font-bold">ğŸ”¥ ìŠ¤íŒŸ ì¶”ê°€ ì¸ì„¼í‹°ë¸Œ</div>
      <div className="text-xs text-gray-400 mt-0.5">ì •ì±… ì„ íƒ ë˜ëŠ” ì§ì ‘ ì…ë ¥ â†’ ê´€ë¦¬ì í™•ì¸</div></div>
      <span className="text-xs text-violet-600">{open?'ì ‘ê¸°':'ë³´ê¸°'}</span>
    </button>
    {open&&<div className="px-4 pb-4 space-y-3">
      {policies.length>0&&<>
        <select value={policyId} onChange={e=>setPolicyId(e.target.value)} className="w-full border rounded-lg p-2 text-xs">
          <option value="">ë“±ë¡ëœ ì •ì±… ì„ íƒ</option>
          {policies.map(p=><option key={p.id} value={p.id}>{p.title} Â· +{won(p.amount)}</option>)}
        </select>
        <input value={customer} onChange={e=>setCustomer(e.target.value)} placeholder="ê³ ê°ëª… (ì„ íƒ)" className="w-full border rounded-lg p-2 text-xs"/>
        <button onClick={addPolicyClaim} disabled={!policyId} className="w-full py-2 rounded-lg bg-orange-500 text-white text-xs font-bold disabled:opacity-40">ì„ íƒ ì •ì±… ì‹ ì²­</button>
      </>}
      <button onClick={()=>setDirectOpen(v=>!v)} className="w-full py-2.5 rounded-xl bg-orange-50 text-orange-700 border border-orange-100 text-xs font-bold">+ ìŠ¤íŒŸ ì§ì ‘ ì…ë ¥</button>
      {directOpen&&<div className="space-y-2 bg-orange-50/40 border border-orange-100 rounded-xl p-3">
        <input value={directTitle} onChange={e=>setDirectTitle(e.target.value)} placeholder="ì •ì±…ëª…" className="w-full border rounded-lg p-2 text-xs bg-white"/>
        <input value={fmtInputNumber(directAmount)} onChange={e=>setDirectAmount(e.target.value.replace(/\D/g,''))} placeholder="ì¶”ê°€ ê¸ˆì•¡" className="w-full border rounded-lg p-2 text-xs bg-white"/>
        <input value={customer} onChange={e=>setCustomer(e.target.value)} placeholder="ê³ ê°ëª… (ì„ íƒ)" className="w-full border rounded-lg p-2 text-xs bg-white"/>
        <input value={directMemo} onChange={e=>setDirectMemo(e.target.value)} placeholder="ë©”ëª¨ (ì„ íƒ)" className="w-full border rounded-lg p-2 text-xs bg-white"/>
        <div className="text-[10px] text-gray-400">ê´€ë¦¬ìê°€ í™•ì¸Â·ìˆ˜ì • í›„ ìŠ¹ì¸í•˜ë©´ ë°˜ì˜ë¼ìš”.</div>
        <button onClick={addDirect} className="w-full py-2 rounded-lg bg-orange-500 text-white text-xs font-bold">ê´€ë¦¬ì í™•ì¸ ìš”ì²­</button>
      </div>}
      {policies.length===0&&!directOpen&&<div className="text-xs text-gray-400">ë“±ë¡ëœ ì •ì±…ì´ ì—†ì–´ìš”. ì§ì ‘ ì…ë ¥ì„ ì´ìš©í•´ì£¼ì„¸ìš”.</div>}
      <div className="divide-y">
        {claims.map(c=>{const title=c.reviewed_title||c.direct_title||c.spot_policies?.title||'ìŠ¤íŒŸ';
          const amount=c.final_amount??c.direct_amount??c.spot_policies?.amount??0;
          return <div key={c.id} className="py-2 text-xs flex justify-between gap-2"><div>{title} Â· {c.customer_name||'ì¼ë°˜'}<div className="text-[10px] text-gray-400">{won(amount)}</div></div>
            <span className={c.status==='approved'?'text-emerald-600':c.status==='rejected'?'text-red-500':'text-orange-500'}>{c.status==='approved'?'ìŠ¹ì¸':c.status==='rejected'?'ë°˜ë ¤':'í™•ì¸ëŒ€ê¸°'}</span></div>})}
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
  const canEditCompany=isFullAdmin||me?.position==='ë‹´ë‹¹';
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
    if(error)return showLegacyAlert(`ë§¤ì¥ ëª©í‘œ ì €ì¥ ì‹¤íŒ¨: ${friendlyError(error)}`);
    showLegacyAlert('ë§¤ì¥ ëª©í‘œë¥¼ ì €ì¥í–ˆì–´ìš”.');
    load();
  };

  return <div className="space-y-3">
    <div className="bg-white rounded-xl border p-4">
      <div className="font-bold">ğŸª ë§¤ì¥ ëª©í‘œ ì„¤ì •</div>
      <div className="text-xs text-gray-400 mt-1">
        íšŒì‚¬ ê¸°ì¤€ + ë§¤ì¥ ë„ì „ ëª©í‘œ Â· ì—…ì…€ ê±´ìˆ˜ëŠ” HSì˜ 50% ìë™ ê¸°ì¤€
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
        íšŒì‚¬ ê¸°ì¤€ ìˆ˜ì •: ë‹´ë‹¹ ì´ìƒ Â· ì ì¥/ë¶€ì ì¥ì€ ë³¸ì¸ ë§¤ì¥ ë„ì „ ëª©í‘œë§Œ ìˆ˜ì •
      </div>
    </div>

    <div className="bg-white rounded-xl border overflow-hidden">
      <div className="grid grid-cols-3 text-xs font-bold bg-gray-50 p-3">
        <span>ì§€í‘œ</span><span>íšŒì‚¬ ê¸°ì¤€</span><span>ë§¤ì¥ ë„ì „</span>
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
        <div className="text-sm font-bold">ğŸ¯ ëª©í‘œ ë‹¬ì„± í˜„í™©</div>
        <div className="text-xs text-gray-400 mt-0.5">íšŒì‚¬ ê¸°ì¤€ê³¼ ë§¤ì¥ ë„ì „ ëª©í‘œë¥¼ í•¨ê»˜ í™•ì¸í•´ìš”.</div>
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
            {finalPerformance&&<div className="text-[9px] text-emerald-600 mt-1">ë§ˆê° í™•ì • ì‹¤ì  ê¸°ì¤€</div>}
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden mt-1.5">
              <div className="h-full bg-violet-500 rounded-full" style={{width:`${Math.min(100,challengePct)}%`}} />
            </div>
            <div className="flex justify-between text-[10px] mt-1">
              <span className={companyPct>=100?'text-emerald-600 font-semibold':'text-gray-400'}>
                íšŒì‚¬ {companyTarget||'-'} Â· {companyTarget?`${Math.round(companyPct)}%`:'-'} {companyPct>=100?'âœ“':''}
              </span>
              <span className={challengePct>=100?'text-emerald-600 font-semibold':'text-gray-400'}>
                ë„ì „ {challengeTarget||'-'} Â· {challengeTarget?`${Math.round(challengePct)}%`:'-'} {challengePct>=100?'âœ“':''}
              </span>
            </div>
          </div>
        })}
      </div>
    </div>

    <button onClick={save} className="w-full py-2.5 rounded-xl bg-violet-600 text-white text-sm font-bold">
      ë§¤ì¥ ëª©í‘œ ì €ì¥
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
  const add=async()=>{if(!form.title||!form.start_date||!form.end_date)return showLegacyAlert('ì •ì±…ëª…ê³¼ ê¸°ê°„ì„ ì…ë ¥í•´ì£¼ì„¸ìš”.');const {error}=await supabase.from('special_sale_policies').insert({...form,replacement_amount:Number(form.replacement_amount||0),created_by:authUserId});if(error)return showLegacyAlert(friendlyError(error));setForm({title:'',start_date:'',end_date:'',replacement_amount:'20000',description:''});load();};
  const toggle=async(r)=>{await supabase.from('special_sale_policies').update({active:!r.active,updated_at:new Date().toISOString()}).eq('id',r.id);load();};
  const decide=async(sale,approve)=>{const sp=sale.source_meta?.specialPolicy||{},amt=approve?Number(sp.exceptionRequestedAmount||0):Number(sp.replacementAmount||0);const {data:dr,error}=await supabase.from('daily_records').select('data').eq('user_id',sale.user_id).eq('work_date',sale.sale_date).maybeSingle();if(error)return showLegacyAlert(friendlyError(error));const d=normalizeDay(dr?.data);const old=Number(d.specialReplacementPay||0);const next={...d,specialReplacementPay:old+amt};const {error:uErr}=await supabase.from('daily_records').upsert({user_id:sale.user_id,work_date:sale.sale_date,data:next,updated_at:new Date().toISOString()},{onConflict:'user_id,work_date'});if(uErr)return showLegacyAlert(friendlyError(uErr));const meta={...sale.source_meta,specialPolicy:{...sp,exceptionStatus:approve?'approved':'rejected',exceptionApprovedAmount:amt,reviewedBy:authUserId,reviewedAt:new Date().toISOString()}};await supabase.from('customer_sales').update({source_meta:meta}).eq('id',sale.id);await notifyEmployee({actorId:authUserId,recipientId:sale.user_id,type:approve?'special_approved':'special_rejected',title:`íŠ¹íŒ ì˜ˆì™¸ê¸ˆì•¡ ${approve?'ìŠ¹ì¸':'ì²˜ë¦¬ ì™„ë£Œ'}`,message:`${sale.metric_label} Â· ${won(amt)}`,payload:{sale_id:sale.id,status:approve?'approved':'rejected'}});load();};
  return <div className="space-y-3"><div className="bg-amber-50 border border-amber-100 rounded-xl p-4"><div className="font-bold text-sm">ğŸ·ï¸ íŠ¹íŒÂ·ì§€ì¸íŒë§¤ ì •ì±…</div><div className="text-xs text-gray-500 mt-1">ìµœê³ ê´€ë¦¬ìë§Œ ì •ì±…ì„ ë§Œë“¤ì–´ìš”. ì‹¤ì ì€ ì¸ì •í•˜ê³  ìš”ê¸ˆì œ/VAS ìˆ˜ìˆ˜ë£Œ ëŒ€ì‹  ëŒ€ì²´ ì¸ì„¼í‹°ë¸Œë¥¼ ì ìš©í•©ë‹ˆë‹¤.</div><div className="grid grid-cols-2 gap-2 mt-3"><input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="ì •ì±…ëª…" className="border rounded p-2 text-xs"/><input value={fmtInputNumber(form.replacement_amount)} onChange={e=>setForm({...form,replacement_amount:e.target.value.replace(/\D/g,'')})} placeholder="ê±´ë‹¹ ëŒ€ì²´ ì§€ê¸‰ê¸ˆì•¡" className="border rounded p-2 text-xs"/><input type="date" value={form.start_date} onChange={e=>setForm({...form,start_date:e.target.value})} className="border rounded p-2 text-xs"/><input type="date" value={form.end_date} onChange={e=>setForm({...form,end_date:e.target.value})} className="border rounded p-2 text-xs"/></div><input value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="ì„¤ëª… (ì„ íƒ)" className="mt-2 w-full border rounded p-2 text-xs"/><button onClick={add} className="mt-2 w-full bg-amber-500 text-white rounded-lg py-2 text-xs font-bold">ì •ì±… ì¶”ê°€</button><div className="mt-3 divide-y">{rows.map(r=><div key={r.id} className="py-2 flex justify-between text-xs"><div><b>{r.title}</b> Â· {won(r.replacement_amount)}<div className="text-[10px] text-gray-400">{r.start_date}~{r.end_date}</div></div><button onClick={()=>toggle(r)} className={r.active?'text-emerald-600':'text-gray-400'}>{r.active?'í™œì„±':'ë¹„í™œì„±'}</button></div>)}</div></div><div className="bg-white border rounded-xl overflow-hidden"><div className="px-4 py-3 border-b font-bold text-sm">ì˜ˆì™¸ ì§€ê¸‰ê¸ˆì•¡ ìŠ¹ì¸ {pending.length}ê±´</div>{pending.length===0?<div className="py-6 text-center text-xs text-gray-400">ìŠ¹ì¸ ëŒ€ê¸° ì˜ˆì™¸ê¸ˆì•¡ì´ ì—†ì–´ìš”.</div>:pending.map(x=><div key={x.id} className="p-3 border-b text-xs"><b>{x.profiles?.name||'ì§ì›'} Â· {x.customers?.customer_name||'ê³ ê°'}</b><div className="mt-1 text-gray-500">{x.metric_label} Â· ìš”ì²­ {won(x.source_meta?.specialPolicy?.exceptionRequestedAmount)}</div><div className="grid grid-cols-2 gap-2 mt-2"><button onClick={()=>decide(x,false)} className="py-2 bg-gray-100 rounded">ê¸°ë³¸ê¸ˆì•¡ ì ìš©</button><button onClick={()=>decide(x,true)} className="py-2 bg-amber-500 text-white rounded font-bold">ìš”ì²­ê¸ˆì•¡ ìŠ¹ì¸</button></div></div>)}</div></div>;
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

  const add=async()=>{if(!form.title||!form.amount||!form.start_date||!form.end_date)return showLegacyAlert('ì •ì±…ëª…, ê¸ˆì•¡, ê¸°ê°„ì„ ì…ë ¥í•´ì£¼ì„¸ìš”.');
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
    if(error)return showLegacyAlert(`ì •ì±… ìˆ˜ì • ì‹¤íŒ¨: ${friendlyError(error)}`);
    setEditingPolicyId(null);setEditPolicy({});load();
  };

  const decide=async(id,status)=>{
    const edit=claimEdits[id]||{}, amount=Number(edit.amount||0);
    if(status==='approved'&&amount<=0)return showLegacyAlert('ìµœì¢… ìŠ¹ì¸ ê¸ˆì•¡ì„ ì…ë ¥í•´ì£¼ì„¸ìš”.');
    const {error}=await supabase.from('spot_claims').update({
      status,reviewed_by:authUserId,reviewed_at:new Date().toISOString(),
      final_amount:status==='approved'?amount:null,
      reviewed_title:String(edit.title||'').trim()||null,
      reviewed_memo:String(edit.memo||'').trim()||null
    }).eq('id',id);
    if(error)return showLegacyAlert(`ìŠ¤íŒŸ ì²˜ë¦¬ ì‹¤íŒ¨: ${friendlyError(error)}`);
    const claim=claims.find(x=>x.id===id);
    if(claim)await notifyEmployee({actorId:authUserId,recipientId:claim.user_id,type:status==='approved'?'spot_approved':'spot_rejected',title:`ìŠ¤íŒŸ ${status==='approved'?'ìŠ¹ì¸':'ë°˜ë ¤'}`,message:`${String(edit.title||'ìŠ¤íŒŸ')} Â· ${status==='approved'?won(amount):'ë°˜ë ¤ë¨'}`,payload:{claim_id:id,status}});
    load();
  };

  const pendingClaims=claims.filter(c=>c.status==='pending'); const doneClaims=claims.filter(c=>c.status!=='pending');
  const septemberLocked=isSeptemberPolicyActive(month);
  return <div className="space-y-3">
    {septemberLocked&&<div className="rounded-xl border border-violet-100 bg-violet-50 p-4"><div className="text-sm font-bold text-violet-800">9ì›” ì •ì±…ì€ íšŒì‚¬ í™•ì •ë³¸ìœ¼ë¡œ ìš´ì˜ë¼ìš”</div><div className="mt-1 text-xs text-violet-600">ì§ì›Â·ë§¤ì¥ ê´€ë¦¬ìëŠ” ìŠ¤íŒŸì´ë‚˜ íŠ¹ê°€ ì •ì±…ì„ ì§ì ‘ ë§Œë“¤ê±°ë‚˜ ìˆ˜ì •í•  ìˆ˜ ì—†ì–´ìš”. í™•ì •ëœ íŠ¹ê°€&ì§€ì¸ì •ì±…ë§Œ íŒë§¤ ì…ë ¥ì—ì„œ ì„ íƒí•©ë‹ˆë‹¤.</div><div className="mt-3 divide-y divide-violet-100 rounded-xl bg-white px-3">{SEPTEMBER_SPECIAL_SALES.map(p=><div key={p.key} className="flex items-center justify-between gap-2 py-2 text-[11px]"><span className="font-semibold text-gray-700">{p.model} Â· {p.saleType}</span><span className="text-violet-700">ê¸°ì¡´ ì •ì±… +{won(p.additionalAmount)}</span></div>)}</div></div>}
    {claimLoadError&&<div className="bg-red-50 border border-red-100 text-red-600 rounded-xl p-3 text-xs">ìŠ¤íŒŸ ìŠ¹ì¸ ëª©ë¡ì„ ë¶ˆëŸ¬ì˜¤ì§€ ëª»í–ˆì–´ìš”: {claimLoadError}</div>}
    <div className="bg-white border rounded-xl overflow-hidden"><div className="px-4 py-3 border-b"><div className="font-bold text-sm">âœ… ìŠ¹ì¸ ëŒ€ê¸° {pendingClaims.length}ê±´</div><div className="text-xs text-gray-400">ëŒ€ì‹œë³´ë“œì˜ ìŠ¤íŒŸ ìŠ¹ì¸ ê±´ê³¼ ê°™ì€ ëª©ë¡ì´ì—ìš”.</div></div><div className="divide-y">{pendingClaims.length===0?<div className="py-8 text-center text-xs text-gray-400">í˜„ì¬ ìŠ¹ì¸ ëŒ€ê¸° ìŠ¤íŒŸì´ ì—†ì–´ìš”.</div>:pendingClaims.map(c=>{const x=claimEdits[c.id]||{},direct=!c.policy_id;return <div key={c.id} className="p-4 text-xs"><div className="flex justify-between"><div><b>{c.profiles?.name||'ì§ì›'} Â· {c.profiles?.store_name||''}</b><div className="text-[10px] text-gray-400">{c.claim_date} Â· {c.customer_name||'ê³ ê° ì—†ìŒ'} Â· {direct?'ì§ì ‘ ì…ë ¥':'ë“±ë¡ ì •ì±…'}</div></div><span className="text-orange-500">í™•ì¸ëŒ€ê¸°</span></div><div className="space-y-2 mt-3"><input value={x.title||''} onChange={e=>setClaimEdits({...claimEdits,[c.id]:{...x,title:e.target.value}})} placeholder="ì •ì±…ëª…" className="w-full border rounded p-2"/><input value={x.amount||''} onChange={e=>setClaimEdits({...claimEdits,[c.id]:{...x,amount:e.target.value.replace(/\D/g,'')}})} placeholder="ìµœì¢… ìŠ¹ì¸ ê¸ˆì•¡" className="w-full border rounded p-2"/><input value={x.memo||''} onChange={e=>setClaimEdits({...claimEdits,[c.id]:{...x,memo:e.target.value}})} placeholder="ê´€ë¦¬ì ë©”ëª¨" className="w-full border rounded p-2"/></div><div className="grid grid-cols-2 gap-2 mt-3"><button onClick={()=>decide(c.id,'rejected')} className="py-2 bg-red-50 text-red-500 rounded">ë°˜ë ¤</button><button onClick={()=>decide(c.id,'approved')} className="py-2 bg-emerald-600 text-white rounded font-bold">ìŠ¹ì¸</button></div></div>})}</div></div>
    {!septemberLocked&&<div className="bg-white border rounded-xl p-4">
      <div className="font-bold">ğŸ”¥ ìŠ¤íŒŸ ì •ì±… ë“±ë¡</div>
      <div className="grid grid-cols-2 gap-2 mt-3">
        <input placeholder="ì •ì±…ëª…" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} className="border rounded p-2 text-xs"/>
        <input placeholder="ê±´ë‹¹ ê¸ˆì•¡" value={fmtInputNumber(form.amount)} onChange={e=>setForm({...form,amount:e.target.value.replace(/\D/g,'')})} className="border rounded p-2 text-xs"/>
        <input type="date" value={form.start_date} onChange={e=>setForm({...form,start_date:e.target.value})} className="border rounded p-2 text-xs"/>
        <input type="date" value={form.end_date} onChange={e=>setForm({...form,end_date:e.target.value})} className="border rounded p-2 text-xs"/>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-2">
        <select value={form.rule_type} onChange={e=>setForm({...form,rule_type:e.target.value})} className="border rounded p-2 text-xs">
          <option value="per_unit">ê±´ë‹¹ ì§€ê¸‰</option>
          <option value="threshold">ëª‡ ê±´ ì´ìƒ ë‹¬ì„±í˜•</option>
          <option value="linked">Aì¡°ê±´ â†’ Bìƒí’ˆ ì§€ê¸‰</option>
          <option value="fixed">ê³ ì • ë³´ë„ˆìŠ¤</option>
          <option value="manual">ì§ì ‘/ì˜ˆì™¸ ì •ì±…</option>
        </select>
        <input value={form.threshold} onChange={e=>setForm({...form,threshold:e.target.value.replace(/\D/g,'')})} placeholder="ê¸°ì¤€ ê±´ìˆ˜ (ì„ íƒ)" className="border rounded p-2 text-xs"/>
        <select value={form.condition_metric} onChange={e=>setForm({...form,condition_metric:e.target.value})} className="border rounded p-2 text-xs">
          {ADMIN_MAIN_METRICS.filter(x=>x[2]==='count').map(x=><option key={x[0]} value={x[0]}>ì¡°ê±´ Â· {x[1]}</option>)}
        </select>
        <select value={form.reward_metric} onChange={e=>setForm({...form,reward_metric:e.target.value})} className="border rounded p-2 text-xs">
          {ADMIN_MAIN_METRICS.filter(x=>x[2]==='count').map(x=><option key={x[0]} value={x[0]}>ì§€ê¸‰ëŒ€ìƒ Â· {x[1]}</option>)}
        </select>
        <select value={form.threshold_scope} onChange={e=>setForm({...form,threshold_scope:e.target.value})} className="col-span-2 border rounded p-2 text-xs">
          <option value="all">ê¸°ì¤€ ë‹¬ì„± ì‹œ ì „ì²´ ê±´ ì ìš©</option>
          <option value="after">ê¸°ì¤€ ë‹¬ì„± ì´í›„ ê±´ë¶€í„° ì ìš©</option>
        </select>
      </div>
      <input placeholder="ì„¤ëª… (ì„ íƒ)" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} className="mt-2 w-full border rounded p-2 text-xs"/>
      <button onClick={add} className="mt-2 w-full bg-orange-500 text-white rounded-lg py-2 text-xs font-bold">ì •ì±… ë“±ë¡</button>
    </div>}

    {!septemberLocked&&<div className="bg-white border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b"><div className="font-bold text-sm">ë“±ë¡ëœ ì •ì±… ê´€ë¦¬</div><div className="text-xs text-gray-400">ëª…ì¹­Â·ê¸ˆì•¡Â·ê¸°ê°„ ìˆ˜ì • ê°€ëŠ¥</div></div>
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
              <option value="per_unit">ê±´ë‹¹ ì§€ê¸‰</option><option value="threshold">ëª‡ ê±´ ì´ìƒ ë‹¬ì„±í˜•</option><option value="linked">Aì¡°ê±´ â†’ Bìƒí’ˆ ì§€ê¸‰</option><option value="fixed">ê³ ì • ë³´ë„ˆìŠ¤</option><option value="manual">ì§ì ‘/ì˜ˆì™¸ ì •ì±…</option>
            </select>
            <input value={editPolicy.threshold??''} onChange={e=>setEditPolicy({...editPolicy,threshold:e.target.value.replace(/\D/g,'')})} placeholder="ê¸°ì¤€ ê±´ìˆ˜" className="border rounded p-2"/>
            <select value={editPolicy.condition_metric||'hs'} onChange={e=>setEditPolicy({...editPolicy,condition_metric:e.target.value})} className="border rounded p-2">
              {ADMIN_MAIN_METRICS.filter(x=>x[2]==='count').map(x=><option key={x[0]} value={x[0]}>ì¡°ê±´ Â· {x[1]}</option>)}
            </select>
            <select value={editPolicy.reward_metric||'hs'} onChange={e=>setEditPolicy({...editPolicy,reward_metric:e.target.value})} className="border rounded p-2">
              {ADMIN_MAIN_METRICS.filter(x=>x[2]==='count').map(x=><option key={x[0]} value={x[0]}>ì§€ê¸‰ëŒ€ìƒ Â· {x[1]}</option>)}
            </select>
            <select value={editPolicy.threshold_scope||'all'} onChange={e=>setEditPolicy({...editPolicy,threshold_scope:e.target.value})} className="col-span-2 border rounded p-2">
              <option value="all">ê¸°ì¤€ ë‹¬ì„± ì‹œ ì „ì²´ ê±´ ì ìš©</option><option value="after">ê¸°ì¤€ ë‹¬ì„± ì´í›„ ê±´ë¶€í„° ì ìš©</option>
            </select>
          </div>
          <label className="flex gap-2"><input type="checkbox" checked={editPolicy.active!==false} onChange={e=>setEditPolicy({...editPolicy,active:e.target.checked})}/> í™œì„±</label>
          <div className="grid grid-cols-2 gap-2"><button onClick={()=>setEditingPolicyId(null)} className="py-2 bg-gray-100 rounded">ì·¨ì†Œ</button><button onClick={()=>savePolicy(p.id)} className="py-2 bg-violet-600 text-white rounded font-bold">ì €ì¥</button></div>
        </div>:<div className="flex justify-between gap-2"><div><b>{p.title} Â· {won(p.amount)}</b><div className="text-[10px] text-gray-400">{p.start_date} ~ {p.end_date} Â· {p.active?'í™œì„±':'ë¹„í™œì„±'}</div></div>
          <button onClick={()=>{setEditingPolicyId(p.id);setEditPolicy({...p,amount:String(p.amount||'')})}} className="text-violet-600">ìˆ˜ì •</button></div>}
      </div>)}</div>
    </div>}

    {isFullAdmin&&!septemberLocked&&<SpecialSalePolicyAdmin authUserId={authUserId} />}

    {false&&<div className="bg-white border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b"><div className="font-bold text-sm">ì§ì› ìŠ¤íŒŸ ê²€í† </div><div className="text-xs text-gray-400">ì§ì ‘ ì…ë ¥ ê±´ì€ ìˆ˜ì • í›„ ìŠ¹ì¸í•˜ì„¸ìš”.</div></div>
      <div className="divide-y">{claims.map(c=>{const x=claimEdits[c.id]||{}, direct=!c.policy_id;return <div key={c.id} className="p-4 text-xs">
        <div className="flex justify-between"><div><b>{c.profiles?.name||'ì§ì›'} Â· {c.profiles?.store_name||''}</b><div className="text-[10px] text-gray-400">{c.claim_date} Â· {c.customer_name||'ê³ ê° ì—†ìŒ'} Â· {direct?'ì§ì ‘ ì…ë ¥':'ë“±ë¡ ì •ì±…'}</div></div>
          <span className={c.status==='approved'?'text-emerald-600':c.status==='rejected'?'text-red-500':'text-orange-500'}>{c.status==='approved'?'ìŠ¹ì¸':c.status==='rejected'?'ë°˜ë ¤':'í™•ì¸ëŒ€ê¸°'}</span></div>
        <div className="space-y-2 mt-3">
          <input value={x.title||''} onChange={e=>setClaimEdits({...claimEdits,[c.id]:{...x,title:e.target.value}})} placeholder="ì •ì±…ëª…" className="w-full border rounded p-2"/>
          <input value={x.amount||''} onChange={e=>setClaimEdits({...claimEdits,[c.id]:{...x,amount:e.target.value.replace(/\D/g,'')}})} placeholder="ìµœì¢… ìŠ¹ì¸ ê¸ˆì•¡" className="w-full border rounded p-2"/>
          <input value={x.memo||''} onChange={e=>setClaimEdits({...claimEdits,[c.id]:{...x,memo:e.target.value}})} placeholder="ê´€ë¦¬ì ë©”ëª¨" className="w-full border rounded p-2"/>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3"><button onClick={()=>decide(c.id,'rejected')} className="py-2 bg-red-50 text-red-500 rounded">ë°˜ë ¤</button><button onClick={()=>decide(c.id,'approved')} className="py-2 bg-emerald-600 text-white rounded font-bold">{c.status==='approved'?'ìˆ˜ì • ì €ì¥':'ìˆ˜ì • í›„ ìŠ¹ì¸'}</button></div>
      </div>})}</div>
    </div>}
  </div>;
}

/* ===================== v17 ê³ ê°ê´€ë¦¬ ===================== */

const CARE_TEMPLATES = [
  { key:'plan93', category:'ë³€ê²½', label:'ğŸ“± 93ì¼ ìœ ì§€ í›„ ìš”ê¸ˆì œ ë³€ê²½', title:'ìš”ê¸ˆì œ ë³€ê²½ ì•ˆë‚´', retentionDays:93 },
  { key:'addon93', category:'ë³€ê²½', label:'ğŸ§¾ 93ì¼ ìœ ì§€ í›„ ë¶€ê°€ì„œë¹„ìŠ¤ í•´ì§€', title:'ë¶€ê°€ì„œë¹„ìŠ¤ í•´ì§€ ì•ˆë‚´', retentionDays:93 },
  { key:'plan183', category:'ë³€ê²½', label:'ğŸ“± 183ì¼ ìœ ì§€ í›„ ìš”ê¸ˆì œ ë³€ê²½', title:'ìš”ê¸ˆì œ ë³€ê²½ ì•ˆë‚´', retentionDays:183 },
  { key:'payment3', category:'ìˆ˜ë‚©ì§€ì›', label:'ğŸ’³ Nê°œì›”ê°„ ìš”ê¸ˆ ìˆ˜ë‚© ì•½ì†', title:'ìš”ê¸ˆ ìˆ˜ë‚©', repeatCount:3 },
  { key:'affiliateCard', category:'ì œíœ´ì¹´ë“œ', label:'ğŸ’³ í†µì‹ ì‚¬ ì œíœ´ì¹´ë“œ í• ì¸', title:'ì œíœ´ì¹´ë“œ í• ì¸ ì§„í–‰', staged:true },
];

const AFFILIATE_CARD_STAGES = {
  before_application:'ì‹ ì²­ ì „',
  applied_unreceived:'ì‹ ì²­ì™„ë£Œ Â· ë¯¸ìˆ˜ë ¹',
  received_not_visited:'ìˆ˜ë ¹ Â· ë¯¸ë°©ë¬¸',
};
const AFFILIATE_CARD_NAMES = ['ì‹ í•œì¹´ë“œ','êµ­ë¯¼ì¹´ë“œ','í˜„ëŒ€ì¹´ë“œ','ìš°ë¦¬ì¹´ë“œ','ì‚¼ì„±ì¹´ë“œ','ë¡¯ë°ì¹´ë“œ','í•˜ë‚˜ì¹´ë“œ','ë†í˜‘ì¹´ë“œ'];

function careTaskCategory(task){
  const type=String(task?.task_type||'');
  if(type==='affiliateCard')return 'ì œíœ´ì¹´ë“œ';
  if(type.startsWith('payment3_'))return 'ìˆ˜ë‚©ì§€ì›';
  if(['plan93','addon93','plan183'].includes(type))return 'ë³€ê²½';
  return 'ì¼€ì´ìŠ¤ ë° ê¸°íƒ€';
}

function addDaysDate(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + Number(days || 0));
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function addMonthsDate(dateStr, months) {
  const [year,month,day]=String(dateStr||'').split('-').map(Number);
  if(!year||!month||!day)return '';
  const target=new Date(year,month-1+Number(months||0),1,12);
  const lastDay=new Date(target.getFullYear(),target.getMonth()+1,0).getDate();
  target.setDate(Math.min(day,lastDay));
  return `${target.getFullYear()}-${String(target.getMonth()+1).padStart(2,'0')}-${String(target.getDate()).padStart(2,'0')}`;
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

async function ensurePromiseCustomer(userId,customerName){
  const clean=String(customerName||'').trim();
  if(!userId||!clean)return null;
  const {data:found,error:findError}=await supabase.from('customers').select('id').eq('user_id',userId).eq('customer_name',clean).maybeSingle();
  if(findError)throw findError;
  if(found?.id)return found.id;
  const {data,error}=await supabase.from('customers').insert({user_id:userId,customer_name:clean}).select('id').single();
  if(error)throw error;
  return data?.id||null;
}

async function createCustomerSaleAndTasks({
  userId, customerName, saleDate, metricLabel, sourceType='daily',
  templateKeys=[], customTitle='', customDueDate='', note='', sourceMeta=null,
  targetPlan='', paymentFirstDate='', paymentCount=3, affiliateCard=null
}) {
  const customerId=await ensureCustomer(userId,customerName,saleDate);
  if(!customerId) throw new Error('ê³ ê° ì €ì¥ ì‹¤íŒ¨');

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
    if(t.repeatCount){
      if(!paymentFirstDate)return;
      const repeatCount=Math.max(1,Number(paymentCount||t.repeatCount));
      for(let i=0;i<repeatCount;i++)rows.push({
        user_id:userId,customer_id:customerId,source_sale_id:sale.id,
        task_type:`${key}_${i+1}`,title:`${t.title} (${i+1}/${repeatCount}íšŒ)`,base_date:saleDate,
        retention_days:null,due_date:addMonthsDate(paymentFirstDate,i),status:'pending',
        note:'ëª¨ë“  íšŒì°¨ë¥¼ ì™„ë£Œí•  ë•Œê¹Œì§€ ê° ê¸°í•œì— ë°˜ë³µ í‘œì‹œ'
      });
      return;
    }
    if(key==='affiliateCard'){
      rows.push({
        user_id:userId,customer_id:customerId,source_sale_id:sale.id,
        task_type:key,title:t.title,base_date:saleDate,retention_days:null,due_date:saleDate,status:'pending',
        task_meta:{
          card_name:String(affiliateCard?.cardName||'').trim(),
          card_stage:'before_application',
          approval_required:!!affiliateCard?.approvalRequired,
          approval_completed:false,
          autopay_registered:false
        }
      });
      return;
    }
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
    // Supabase bulk insertëŠ” í–‰ë§ˆë‹¤ í•„ë“œ êµ¬ì„±ì´ ë‹¤ë¥´ë©´ ëˆ„ë½ í•„ë“œë¥¼ nullë¡œ ë³´ë‚¼ ìˆ˜ ìˆìŠµë‹ˆë‹¤.
    // task_metaëŠ” NOT NULLì´ë¯€ë¡œ ì œíœ´ì¹´ë“œê°€ ì•„ë‹Œ ì•½ì†ë„ ë¹ˆ ê°ì²´ë¥¼ ëª…ì‹œí•©ë‹ˆë‹¤.
    const {error}=await supabase.from('customer_tasks').insert(rows.map(row=>({...row,task_meta:row.task_meta||{}})));
    if(error)throw error;
  }

  return {customerId,saleId:sale.id};
}

function CareTemplatePicker({
  selected, setSelected, customTitle, setCustomTitle, customDueDate, setCustomDueDate, saleDate,
  targetPlan='', setTargetPlan=()=>{}, paymentFirstDate='', setPaymentFirstDate=()=>{}, paymentCount=3, setPaymentCount=()=>{},
  affiliateCard={cardName:'',approvalRequired:false}, setAffiliateCard=()=>{}
}) {
  const toggle=(key)=>setSelected(selected.includes(key)?selected.filter(x=>x!==key):[...selected,key]);
  return <div className="space-y-2">
    <div className="text-xs font-semibold text-gray-600">ğŸ“Œ ê³ ê° ì•½ì† / ìœ ì§€ì¡°ê±´ <span className="font-normal text-gray-400">(ì„ íƒ)</span></div>
    <div className="grid grid-cols-1 gap-1.5">
      {CARE_TEMPLATES.map(t=>{
        const on=selected.includes(t.key);
        return <button key={t.key} type="button" onClick={()=>toggle(t.key)}
          className={`text-left px-3 py-2 rounded-xl border text-xs ${on?'bg-violet-50 border-violet-200 text-violet-700':'bg-white border-gray-100 text-gray-600'}`}>
          <div className="flex items-center gap-1.5"><span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{t.category}</span><span className="font-semibold">{on?'âœ“ ':''}{t.label}</span></div>
          {on&&t.retentionDays&&<div className="text-[10px] mt-0.5 opacity-70">ë³€ê²½ ê°€ëŠ¥ì¼ {addDaysDate(saleDate,t.retentionDays)} Â· {t.retentionDays===93?'94ì¼ì§¸':'184ì¼ì§¸'}</div>}
        </button>
      })}
    </div>
    {selected.includes('payment3')&&<div className="rounded-xl border border-violet-100 bg-violet-50/50 p-3">
      <div className="flex items-center justify-between"><div className="text-[11px] font-semibold text-gray-600">ì²« ìˆ˜ë‚© ì˜ˆì •ì¼</div><b className="text-[11px] text-violet-700">ì´ {paymentCount}ê°œì›”</b></div>
      <input type="date" value={paymentFirstDate} onChange={e=>setPaymentFirstDate(e.target.value)} className="mt-1.5 w-full border rounded-lg px-2.5 py-2 text-xs bg-white"/>
      {paymentFirstDate&&<div className="mt-2 text-[10px] leading-relaxed text-violet-700">{Array.from({length:paymentCount},(_,i)=>`${i+1}íšŒ ${addMonthsDate(paymentFirstDate,i)}`).join(' Â· ')}</div>}
      <div className="grid grid-cols-2 gap-2 mt-2"><button type="button" disabled={paymentCount<=1} onClick={()=>setPaymentCount(Math.max(1,paymentCount-1))} className="py-2 rounded-lg bg-white border text-[11px] font-semibold text-gray-500 disabled:opacity-40">âˆ’ ë§ˆì§€ë§‰ íšŒì°¨ ì‚­ì œ</button><button type="button" onClick={()=>setPaymentCount(paymentCount+1)} className="py-2 rounded-lg bg-violet-600 text-white text-[11px] font-bold">+ ë‹¤ìŒ íšŒì°¨ ì¶”ê°€</button></div>
      <div className="mt-1.5 text-[10px] leading-relaxed text-gray-500">í•œ íšŒì°¨ë¥¼ ì™„ë£Œí•´ë„ ë‹¤ìŒ íšŒì°¨ëŠ” ê·¸ëŒ€ë¡œ ìœ ì§€ë˜ë©°, ëª¨ë“  íšŒì°¨ë¥¼ ì™„ë£Œí•  ë•Œê¹Œì§€ ê° ê¸°í•œì— ë°˜ë³µ í‘œì‹œë¼ìš”.</div>
    </div>}
    {selected.includes('affiliateCard')&&<div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 space-y-2">
      <div className="text-[11px] font-semibold text-gray-700">í†µì‹ ì‚¬ ì œíœ´ì¹´ë“œ</div>
      <select value={affiliateCard.cardName||''} onChange={e=>setAffiliateCard({...affiliateCard,cardName:e.target.value})} className="w-full border rounded-lg px-2.5 py-2 text-xs bg-white">
        <option value="">ì¹´ë“œì‚¬ë¥¼ ì„ íƒí•´ì£¼ì„¸ìš”</option>
        {AFFILIATE_CARD_NAMES.map(name=><option key={name} value={name}>{name}</option>)}
      </select>
      <label className="flex items-center gap-2 rounded-lg bg-white border border-blue-100 px-3 py-2 text-xs text-gray-600">
        <input type="checkbox" checked={!!affiliateCard.approvalRequired} onChange={e=>setAffiliateCard({...affiliateCard,approvalRequired:e.target.checked})}/>
        ì¹´ë“œ ìˆ˜ë ¹ í›„ ë³„ë„ ìŠ¹ì¸ì´ í•„ìš”í•´ìš”
      </label>
      <div className="text-[10px] leading-relaxed text-gray-500">ì‹ ì²­ â†’ ìˆ˜ë ¹ â†’ ìŠ¹ì¸(í•„ìš” ì‹œ) â†’ ìë™ì´ì²´ ë“±ë¡ â†’ ìµœì¢… ì™„ë£Œê¹Œì§€ ë‹¨ê³„ë³„ë¡œ ê´€ë¦¬í•´ìš”.</div>
    </div>}
    {(selected.includes('plan93')||selected.includes('plan183'))&&(
      <div className="pt-1">
        <div className="text-[11px] font-semibold text-gray-500 mb-1.5">ë³€ê²½ ì˜ˆì • ìš”ê¸ˆì œ</div>
        <input
          value={targetPlan}
          onChange={e=>setTargetPlan(e.target.value)}
          placeholder="ì˜ˆ: ìœ ì“° 55 / 5G ìŠ¬ë¦¼+"
          className="w-full border rounded-lg px-2.5 py-2 text-xs"
        />
        <div className="text-[10px] text-gray-400 mt-1">ìš”ê¸ˆì œ ì¢…ë¥˜ê°€ ë§ì•„ ììœ ë¡­ê²Œ ì…ë ¥í•´ìš”.</div>
      </div>
    )}
    <div className="pt-1 text-[10px] font-semibold text-gray-400">ì¼€ì´ìŠ¤ Â· ì§ì ‘ ì•½ì†</div>
    <div className="grid grid-cols-2 gap-2">
      <input value={customTitle} onChange={e=>setCustomTitle(e.target.value)} placeholder="ì§ì ‘ ì•½ì† ë‚´ìš©" className="border rounded-lg px-2 py-2 text-xs"/>
      <input type="date" value={customDueDate} onChange={e=>setCustomDueDate(e.target.value)} className="border rounded-lg px-2 py-2 text-xs"/>
    </div>
  </div>;
}

function StandalonePromiseModal({userId,month,selectedDay,onClose}){
  const [customers,setCustomers]=useState([]);
  const [query,setQuery]=useState('');
  const [selectedCustomer,setSelectedCustomer]=useState(null);
  const [newCustomer,setNewCustomer]=useState('');
  const [careKeys,setCareKeys]=useState([]);
  const [customTitle,setCustomTitle]=useState('');
  const [customDueDate,setCustomDueDate]=useState('');
  const [targetPlan,setTargetPlan]=useState('');
  const [paymentFirstDate,setPaymentFirstDate]=useState('');
  const [paymentCount,setPaymentCount]=useState(3);
  const [affiliateCard,setAffiliateCard]=useState({cardName:'',approvalRequired:false});
  const [saving,setSaving]=useState(false);
  const baseDate=`${month}-${selectedDay}`;

  useEffect(()=>{let alive=true;(async()=>{
    const [y,m]=String(month).split('-').map(Number),next=new Date(y,m,1);
    const monthEnd=`${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}-01`;
    const [{data:all},{data:sales},{data:tasks}]=await Promise.all([
      supabase.from('customers').select('id,customer_name,last_sale_date').eq('user_id',userId),
      supabase.from('customer_sales').select('customer_id').eq('user_id',userId).gte('sale_date',`${month}-01`).lt('sale_date',monthEnd),
      supabase.from('customer_tasks').select('customer_id').eq('user_id',userId).eq('status','pending')
    ]);
    if(!alive)return;
    const eligible=new Set([...(sales||[]).map(x=>x.customer_id),...(tasks||[]).map(x=>x.customer_id)]);
    setCustomers((all||[]).filter(c=>eligible.has(c.id)).sort((a,b)=>String(a.customer_name).localeCompare(String(b.customer_name),'ko')));
  })();return()=>{alive=false}},[userId,month]);

  const save=async()=>{
    const customerName=selectedCustomer?.customer_name||newCustomer.trim();
    if(!customerName)return showAppToast('ê¸°ì¡´ ê³ ê°ì„ ì„ íƒí•˜ê±°ë‚˜ ì‹ ê·œ ê³ ê°ëª…ì„ ì…ë ¥í•´ì£¼ì„¸ìš”.',{tone:'error'});
    if(!careKeys.length&&!(customTitle.trim()&&customDueDate))return showAppToast('ë“±ë¡í•  ì•½ì†ì„ í•˜ë‚˜ ì´ìƒ ì„ íƒí•´ì£¼ì„¸ìš”.',{tone:'error'});
    if(careKeys.includes('payment3')&&!paymentFirstDate)return showAppToast('3ê°œì›” ìš”ê¸ˆ ìˆ˜ë‚©ì˜ ì²« ìˆ˜ë‚© ì˜ˆì •ì¼ì„ ì„ íƒí•´ì£¼ì„¸ìš”.',{tone:'error'});
    if(careKeys.includes('affiliateCard')&&!affiliateCard.cardName)return showAppToast('ì œíœ´ì¹´ë“œì‚¬ë¥¼ ì„ íƒí•´ì£¼ì„¸ìš”.',{tone:'error'});
    setSaving(true);
    try{
      const customerId=selectedCustomer?.id||await ensurePromiseCustomer(userId,customerName);
      const rows=[];
      careKeys.forEach(key=>{
        const t=CARE_TEMPLATES.find(x=>x.key===key);if(!t)return;
        if(t.repeatCount){for(let i=0;i<paymentCount;i++)rows.push({user_id:userId,customer_id:customerId,source_sale_id:null,task_type:`${key}_${i+1}`,title:`${t.title} (${i+1}/${paymentCount}íšŒ)`,base_date:baseDate,retention_days:null,due_date:addMonthsDate(paymentFirstDate,i),status:'pending',note:'ëª¨ë“  íšŒì°¨ë¥¼ ì™„ë£Œí•  ë•Œê¹Œì§€ ê° ê¸°í•œì— ë°˜ë³µ í‘œì‹œ'});return;}
        if(key==='affiliateCard'){rows.push({user_id:userId,customer_id:customerId,source_sale_id:null,task_type:key,title:t.title,base_date:baseDate,retention_days:null,due_date:baseDate,status:'pending',task_meta:{card_name:affiliateCard.cardName,card_stage:'before_application',approval_required:!!affiliateCard.approvalRequired,approval_completed:false,autopay_registered:false}});return;}
        rows.push({user_id:userId,customer_id:customerId,source_sale_id:null,task_type:key,title:t.title,base_date:baseDate,retention_days:t.retentionDays,due_date:addDaysDate(baseDate,t.retentionDays),status:'pending',target_plan:(key==='plan93'||key==='plan183')?targetPlan.trim()||null:null});
      });
      if(customTitle.trim()&&customDueDate)rows.push({user_id:userId,customer_id:customerId,source_sale_id:null,task_type:'custom',title:customTitle.trim(),base_date:baseDate,retention_days:null,due_date:customDueDate,status:'pending'});
      const {error}=await supabase.from('customer_tasks').insert(rows.map(row=>({...row,task_meta:row.task_meta||{}})));if(error)throw error;
      showAppToast(`${customerName} ê³ ê° ì•½ì†ì„ ë“±ë¡í–ˆì–´ìš”.`);onClose();
    }catch(error){showAppToast(friendlyError(error),{tone:'error',title:'ê³ ê° ì•½ì† ë“±ë¡ ì‹¤íŒ¨'});}finally{setSaving(false)}
  };
  const matches=customers.filter(c=>!query.trim()||String(c.customer_name||'').includes(query.trim()));

  return <div className="fixed inset-0 z-[120] bg-black/45 flex items-end sm:items-center justify-center" onClick={onClose}><div className="w-full max-w-sm max-h-[92vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl p-5" onClick={e=>e.stopPropagation()}>
    <div className="text-xs font-semibold text-violet-500">íŒë§¤ ì—†ì´ë„ ë“±ë¡ ê°€ëŠ¥</div><div className="text-lg font-bold text-gray-900 mt-1">ê³ ê° ì•½ì† ë“±ë¡</div><div className="text-xs text-gray-400 mt-1">ë¯¸ì™„ë£Œ ì•½ì† ê³ ê°ê³¼ {month} íŒë§¤ ê³ ê°ì„ ê²€ìƒ‰í•  ìˆ˜ ìˆì–´ìš”.</div>
    <div className="mt-4 text-xs font-semibold text-gray-600">ê¸°ì¡´ ê³ ê° ê²€ìƒ‰</div>
    <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ê³ ê°ëª… ê²€ìƒ‰" className="mt-1.5 w-full border rounded-xl px-3 py-2.5 text-sm"/>
    {query.trim()&&<div className="mt-2 max-h-36 overflow-y-auto rounded-xl border divide-y">{matches.length?matches.map(c=><button key={c.id} type="button" onClick={()=>{setSelectedCustomer(c);setNewCustomer('')}} className={`w-full px-3 py-2.5 text-left text-xs ${selectedCustomer?.id===c.id?'bg-violet-50 text-violet-700 font-bold':'bg-white text-gray-600'}`}>{selectedCustomer?.id===c.id?'âœ“ ':''}{c.customer_name}</button>):<div className="px-3 py-3 text-xs text-gray-400">ê²€ìƒ‰ë˜ëŠ” ê¸°ì¡´ ê³ ê°ì´ ì—†ì–´ìš”.</div>}</div>}
    {selectedCustomer&&<div className="mt-2 rounded-xl bg-violet-50 border border-violet-100 px-3 py-2 text-xs text-violet-700">ì„ íƒ ê³ ê° Â· <b>{selectedCustomer.customer_name}</b></div>}
    <div className="my-3 flex items-center gap-2 text-[10px] text-gray-400"><div className="h-px bg-gray-100 flex-1"/>ë˜ëŠ” ì‹ ê·œ ê³ ê°<div className="h-px bg-gray-100 flex-1"/></div>
    <input value={newCustomer} onChange={e=>{setNewCustomer(e.target.value);setSelectedCustomer(null)}} placeholder="ì‹ ê·œ ê³ ê°ëª… ì…ë ¥" className="w-full border rounded-xl px-3 py-2.5 text-sm"/>
    <div className="mt-5"><CareTemplatePicker selected={careKeys} setSelected={setCareKeys} customTitle={customTitle} setCustomTitle={setCustomTitle} customDueDate={customDueDate} setCustomDueDate={setCustomDueDate} saleDate={baseDate} targetPlan={targetPlan} setTargetPlan={setTargetPlan} paymentFirstDate={paymentFirstDate} setPaymentFirstDate={setPaymentFirstDate} paymentCount={paymentCount} setPaymentCount={setPaymentCount} affiliateCard={affiliateCard} setAffiliateCard={setAffiliateCard}/></div>
    <div className="grid grid-cols-2 gap-2 mt-5"><button type="button" onClick={onClose} className="py-3 rounded-xl bg-gray-100 text-gray-600 text-sm font-bold">ì·¨ì†Œ</button><button type="button" disabled={saving} onClick={save} className="py-3 rounded-xl bg-violet-600 text-white text-sm font-bold disabled:opacity-50">{saving?'ë“±ë¡ ì¤‘...':'ì•½ì† ë“±ë¡'}</button></div>
  </div></div>;
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

  const scheduleNow=new Date();
  const today=`${monthKeyOf(scheduleNow)}-${String(scheduleNow.getDate()).padStart(2,'0')}`;
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
    if(error)return showAppToast(friendlyError(error),{tone:'error',title:'ê³ ê° ì•½ì† ìˆ˜ì • ì‹¤íŒ¨'});
    await load();
    window.dispatchEvent(new CustomEvent('customer-tasks-changed',{detail:{userId}}));
  };

  const updateAffiliateCard=async(t,metaPatch)=>{
    await updateTask(t,{task_meta:{...(t.task_meta||{}),...metaPatch}});
  };

  const finishAffiliateCard=async(t)=>{
    const meta=t.task_meta||{};
    if(meta.card_stage!=='received_not_visited')return showAppToast('ë¨¼ì € ì¹´ë“œ ìˆ˜ë ¹ ë‹¨ê³„ë¥¼ ì™„ë£Œí•´ì£¼ì„¸ìš”.',{tone:'error'});
    if(meta.approval_required&&!meta.approval_completed)return showAppToast('ì¹´ë“œ ìŠ¹ì¸ ì—¬ë¶€ë¥¼ ë¨¼ì € í™•ì¸í•´ì£¼ì„¸ìš”.',{tone:'error'});
    if(!meta.autopay_registered)return showAppToast('í†µì‹ ìš”ê¸ˆ ìë™ì´ì²´ ë“±ë¡ì„ ë¨¼ì € í™•ì¸í•´ì£¼ì„¸ìš”.',{tone:'error'});
    await complete(t);
  };

  const rollbackAffiliateCard=async(t)=>{
    const meta=t.task_meta||{};
    let patch=null,label='';
    if(meta.autopay_registered){patch={autopay_registered:false};label='ìë™ì´ì²´ ë“±ë¡';}
    else if(meta.approval_completed){patch={approval_completed:false};label='ì¹´ë“œ ìŠ¹ì¸ í™•ì¸';}
    else if(meta.card_stage==='received_not_visited'){patch={card_stage:'applied_unreceived'};label='ì¹´ë“œ ìˆ˜ë ¹ ì™„ë£Œ';}
    else if(meta.card_stage==='applied_unreceived'){patch={card_stage:'before_application'};label='ì¹´ë“œ ì‹ ì²­ ì™„ë£Œ';}
    if(!patch)return showAppToast('ë˜ëŒë¦´ ì§„í–‰ ë‹¨ê³„ê°€ ì—†ì–´ìš”.');
    if(!await showAppConfirm({title:'ì´ì „ ë‹¨ê³„ë¡œ ë˜ëŒë¦´ê¹Œìš”?',message:`${label} ì²˜ë¦¬ë¥¼ ì·¨ì†Œí•©ë‹ˆë‹¤.`,confirmLabel:'ë˜ëŒë¦¬ê¸°',tone:'warning'}))return;
    await updateAffiliateCard(t,patch);
  };

  const complete=async(t)=>{
    const name=customerMap[t.customer_id]?.customer_name||'ê³ ê°';
    if(!await showAppConfirm({title:'ê³ ê° ì•½ì†ì„ ì™„ë£Œí• ê¹Œìš”?',message:`${name} Â· ${t.title}\nì™„ë£Œ ë‚´ì—­ì—ì„œ ë‹¤ì‹œ ë˜ëŒë¦´ ìˆ˜ ìˆì–´ìš”.`,confirmLabel:'ì™„ë£Œ ì²˜ë¦¬'}))return;
    await updateTask(t,{status:'completed',completed_at:new Date().toISOString()});
  };

  const undoComplete=async(t)=>{
    if(!await showAppConfirm({title:'ë‹¤ì‹œ í•  ì¼ë¡œ ëŒë¦´ê¹Œìš”?',message:'ì™„ë£Œ í‘œì‹œê°€ ì·¨ì†Œë˜ê³  ê³ ê° ì•½ì† ëª©ë¡ì— ë‹¤ì‹œ ë‚˜íƒ€ë‚©ë‹ˆë‹¤.',confirmLabel:'ë˜ëŒë¦¬ê¸°'}))return;
    await updateTask(t,{status:'pending',completed_at:null});
  };

  const cancelAffiliateCard=async(t)=>{
    const name=customerMap[t.customer_id]?.customer_name||'ê³ ê°';
    if(!await showAppConfirm({title:'ì œíœ´ì¹´ë“œ ì•½ì†ì„ ì·¨ì†Œí• ê¹Œìš”?',message:`${name} ê³ ê°ì´ ì¹´ë“œ ì§„í–‰ì„ ì›í•˜ì§€ ì•ŠëŠ” ê²½ìš° ì·¨ì†Œí•´ì£¼ì„¸ìš”.\nê¸°ë¡ì€ ì™„ë£ŒÂ·ì·¨ì†Œ ë‚´ì—­ì— ë‚¨ìŠµë‹ˆë‹¤.`,confirmLabel:'ê³ ê° ê±°ì ˆë¡œ ì·¨ì†Œ',tone:'warning'}))return;
    await updateTask(t,{status:'cancelled',completed_at:null,task_meta:{...(t.task_meta||{}),cancel_reason:'ê³ ê° ê±°ì ˆ',cancelled_at:new Date().toISOString()}});
  };

  const resumeCancelledCard=async(t)=>{
    const meta={...(t.task_meta||{})};delete meta.cancel_reason;delete meta.cancelled_at;
    await updateTask(t,{status:'pending',completed_at:null,task_meta:meta});
  };

  const visible=tasks.filter(t=>{
    const isPending=t.status!=='completed'&&t.status!=='cancelled';
    if(filter==='todo' && !(isPending && t.due_date<=visibleUntil)) return false;
    if(filter==='today' && !(isPending && t.due_date===today)) return false;
    if(filter==='overdue' && !(isPending && t.due_date<today)) return false;
    if(filter==='all' && !isPending) return false;
    if(filter==='done' && !['completed','cancelled'].includes(t.status)) return false;
    const name=customerMap[t.customer_id]?.customer_name||'';
    return !query.trim()||name.includes(query.trim())||String(t.title||'').includes(query.trim());
  }).sort((a,b)=>{
    if(filter==='done') return String(b.completed_at||b.updated_at||'').localeCompare(String(a.completed_at||a.updated_at||''));
    const ao=a.due_date<today?0:a.due_date===today?1:2;
    const bo=b.due_date<today?0:b.due_date===today?1:2;
    return ao-bo || String(a.due_date).localeCompare(String(b.due_date));
  });

  const dLabel=(date)=>{
    const a=new Date(`${today}T00:00:00`),b=new Date(`${date}T00:00:00`);
    const d=Math.round((b-a)/86400000);
    return d===0?'ì˜¤ëŠ˜':d>0?`D-${d}`:`${Math.abs(d)}ì¼ ì§€ë‚¨`;
  };

  return <div className="space-y-4">
    <div className="grid grid-cols-3 gap-2">
      {[['ì˜¤ëŠ˜',todayTasks.length],['ê¸°í•œ ê²½ê³¼',overdue.length],['7ì¼ ë‚´',next7.length]].map(([l,v])=>
        <div key={l} className="bg-white rounded-xl border border-gray-100 p-3 text-center">
          <div className={`text-lg font-bold ${l==='ê¸°í•œ ê²½ê³¼'&&v>0?'text-red-600':'text-gray-900'}`}>{v}</div>
          <div className="text-[10px] text-gray-400">{l}</div>
        </div>)}
    </div>

    <div className="bg-white rounded-xl border border-gray-100 p-3">
      <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ê³ ê°ëª… ë˜ëŠ” ì•½ì† ê²€ìƒ‰"
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"/>
      <div className="grid grid-cols-5 gap-1 mt-2">
        {[['todo','í•  ì¼'],['today','ì˜¤ëŠ˜'],['overdue','ê²½ê³¼'],['all','ì „ì²´ ì˜ˆì •'],['done','ì™„ë£ŒÂ·ì·¨ì†Œ']].map(([k,l])=>
          <button key={k} onClick={()=>setFilter(k)}
            className={`py-2 rounded-lg text-[11px] font-semibold ${filter===k?'bg-violet-600 text-white':'bg-gray-50 text-gray-500'}`}>{l}</button>)}
      </div>
      {filter==='todo'&&<div className="text-[10px] text-gray-400 mt-2">í•  ì¼ì—ëŠ” ì˜¤ëŠ˜ë¶€í„° 7ì¼ ì´ë‚´ì™€ ê¸°í•œì´ ì§€ë‚œ ì•½ì†ë§Œ ë³´ì—¬ìš”.</div>}
    </div>

    <div id="employee-home-care" className="bg-white rounded-xl border border-gray-100 overflow-hidden scroll-mt-28">
      <div className="px-4 py-3 border-b border-gray-50">
        <div className="font-bold text-sm">ğŸ“Œ ê³ ê° ì•½ì† ê´€ë¦¬</div>
        <div className="text-xs text-gray-400 mt-0.5">ê°€ê¹Œìš´ ì¼ì •ë¶€í„° ë³´ì—¬ì£¼ê³ , ë¨¼ ì¼ì •ì€ ì „ì²´ ì˜ˆì •ì—ì„œ í™•ì¸í•´ìš”.</div>
      </div>
      {loading?<div className="py-8 text-center text-xs text-gray-400">ë¶ˆëŸ¬ì˜¤ëŠ” ì¤‘...</div>:
       visible.length===0?<div className="py-8 text-center text-xs text-gray-400">í•´ë‹¹í•˜ëŠ” ê³ ê° ì•½ì†ì´ ì—†ì–´ìš”.</div>:
       <div className="divide-y divide-gray-50">
         {visible.map(t=>{
           const c=customerMap[t.customer_id], isOver=t.status!=='completed'&&t.due_date<today;
           const card=t.task_type==='affiliateCard'?t.task_meta||{}:null,category=careTaskCategory(t);
           return <div key={t.id} className="p-4">
             <div className="flex justify-between gap-3">
               <div className="min-w-0">
                 <div className="flex items-center gap-1.5 flex-wrap"><span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-600">{category}</span><span className="text-sm font-bold text-gray-900">{c?.customer_name||'ê³ ê°'} Â· {t.title}</span></div>
                 <div className="text-[11px] text-gray-400 mt-1">
                   {t.retention_days?`${t.retention_days}ì¼ ìœ ì§€ â†’ ${t.retention_days===93?'94':'184'}ì¼ì§¸ ë³€ê²½ ê°€ëŠ¥ Â· `:''}{t.due_date}
                 </div>
                 {t.target_plan&&<div className="text-xs text-violet-700 mt-1">ë³€ê²½ ì˜ˆì • ìš”ê¸ˆì œ Â· <b>{t.target_plan}</b></div>}
                 {card&&<div className="mt-2 rounded-xl border border-blue-100 bg-blue-50/50 p-3">
                   <div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-blue-800">{card.card_name||'ì¹´ë“œëª… ë¯¸ì…ë ¥'}</span><span className="text-[10px] font-bold text-blue-600">{t.status==='completed'?'ìµœì¢… ì™„ë£Œ':AFFILIATE_CARD_STAGES[card.card_stage]||'ì‹ ì²­ ì „'}</span></div>
                   <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px]">
                     <div className={`rounded-lg px-2 py-1.5 ${card.approval_required?(card.approval_completed?'bg-emerald-100 text-emerald-700':'bg-white text-gray-500'):'bg-gray-100 text-gray-400'}`}>ìŠ¹ì¸ Â· {card.approval_required?(card.approval_completed?'ì™„ë£Œ':'í™•ì¸ í•„ìš”'):'í•´ë‹¹ ì—†ìŒ'}</div>
                     <div className={`rounded-lg px-2 py-1.5 ${card.autopay_registered?'bg-emerald-100 text-emerald-700':'bg-white text-gray-500'}`}>ìë™ì´ì²´ Â· {card.autopay_registered?'ë“±ë¡ ì™„ë£Œ':'ë¯¸ë“±ë¡'}</div>
                   </div>
                 </div>}
                 {t.note&&<div className="text-xs text-gray-500 mt-1">{t.note}</div>}
               </div>
               <div className="shrink-0 flex items-center gap-1.5">{card&&t.status!=='completed'&&t.status!=='cancelled'&&<button onClick={()=>cancelAffiliateCard(t)} className="text-[10px] font-semibold text-red-400 px-1.5 py-1">ì•½ì† ì·¨ì†Œ</button>}<span className={`text-[10px] font-bold px-2 py-1 rounded-full h-fit ${
                 t.status==='completed'?'bg-emerald-50 text-emerald-600':t.status==='cancelled'?'bg-gray-100 text-gray-500':isOver?'bg-red-50 text-red-600':t.due_date===today?'bg-orange-50 text-orange-600':'bg-violet-50 text-violet-600'
               }`}>{t.status==='completed'?'ì™„ë£Œ':t.status==='cancelled'?'ê³ ê° ê±°ì ˆ':dLabel(t.due_date)}</span></div>
             </div>

             {t.status==='cancelled'?(
               <button onClick={()=>resumeCancelledCard(t)} className="mt-3 w-full py-2 rounded-lg bg-violet-50 text-violet-700 text-xs font-semibold">ë‹¤ì‹œ ì§„í–‰</button>
             ):t.status==='completed'?(
               <button onClick={()=>undoComplete(t)} className="mt-3 w-full py-2 rounded-lg bg-gray-50 text-gray-600 text-xs font-semibold">
                 ì™„ë£Œ ì·¨ì†Œ
               </button>
             ):card?(
               <div className="mt-3 space-y-1.5">
                 {(()=>{const applied=card.card_stage==='applied_unreceived'||card.card_stage==='received_not_visited',received=card.card_stage==='received_not_visited',ready=received&&(!card.approval_required||card.approval_completed)&&card.autopay_registered;return <>
                   <div className="grid grid-cols-2 gap-1.5">
                     <button disabled={applied} onClick={()=>updateAffiliateCard(t,{card_stage:'applied_unreceived'})} className={`py-2.5 rounded-lg text-xs font-bold ${applied?'bg-emerald-100 text-emerald-700':'bg-blue-600 text-white'}`}>{applied?'âœ“ ì‹ ì²­ ì™„ë£Œ':'ì‹ ì²­ ì™„ë£Œ'}</button>
                     <button disabled={!applied||received} onClick={()=>updateAffiliateCard(t,{card_stage:'received_not_visited'})} className={`py-2.5 rounded-lg text-xs font-bold ${received?'bg-emerald-100 text-emerald-700':applied?'bg-blue-600 text-white':'bg-gray-100 text-gray-300'}`}>{received?'âœ“ ìˆ˜ë ¹ ì™„ë£Œ':'ìˆ˜ë ¹ ì™„ë£Œ'}</button>
                     <button disabled={!card.approval_required||!received||card.approval_completed} onClick={()=>updateAffiliateCard(t,{approval_completed:true})} className={`py-2.5 rounded-lg text-xs font-bold ${!card.approval_required?'bg-gray-100 text-gray-400':card.approval_completed?'bg-emerald-100 text-emerald-700':received?'bg-violet-600 text-white':'bg-gray-100 text-gray-300'}`}>{!card.approval_required?'ìŠ¹ì¸ í•´ë‹¹ ì—†ìŒ':card.approval_completed?'âœ“ ìŠ¹ì¸ í™•ì¸':'ìŠ¹ì¸ í™•ì¸'}</button>
                     <button disabled={!received||card.autopay_registered} onClick={()=>updateAffiliateCard(t,{autopay_registered:true})} className={`py-2.5 rounded-lg text-xs font-bold ${card.autopay_registered?'bg-emerald-100 text-emerald-700':received?'bg-sky-600 text-white':'bg-gray-100 text-gray-300'}`}>{card.autopay_registered?'âœ“ ìë™ì´ì²´ ë“±ë¡':'ìë™ì´ì²´ ë“±ë¡'}</button>
                   </div>
                   <button disabled={!ready} onClick={()=>finishAffiliateCard(t)} className={`w-full py-2.5 rounded-lg text-xs font-bold ${ready?'bg-emerald-600 text-white':'bg-gray-100 text-gray-300'}`}>ìµœì¢… ì•½ì† ì™„ë£Œ</button>
                   {(applied||card.approval_completed||card.autopay_registered)&&<button onClick={()=>rollbackAffiliateCard(t)} className="w-full py-2 rounded-lg border border-gray-200 text-gray-500 text-xs font-semibold">â†¶ ì´ì „ ë‹¨ê³„ ë˜ëŒë¦¬ê¸°</button>}
                 </>})()}
                 <div className="grid grid-cols-2 gap-1.5">
                   <button onClick={()=>updateTask(t,{status:'pending',due_date:addDaysDate(today,1)})} className="py-2 rounded-lg bg-gray-50 text-gray-600 text-xs font-semibold">ë‚´ì¼ ë‹¤ì‹œ</button>
                   <button onClick={()=>{setRescheduleTask(t);setRescheduleDate(t.due_date||today)}} className="py-2 rounded-lg bg-gray-50 text-gray-600 text-xs font-semibold">ì¼ì •ë³€ê²½</button>
                 </div>
               </div>
             ):(
               <div className="grid grid-cols-3 gap-1.5 mt-3">
                 <button onClick={()=>complete(t)} className="py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold">ì²˜ë¦¬ì™„ë£Œ</button>
                 <button onClick={()=>updateTask(t,{status:'pending',due_date:addDaysDate(today,1)})} className="py-2 rounded-lg bg-gray-50 text-gray-600 text-xs font-semibold">ë‚´ì¼ ë‹¤ì‹œ</button>
                 <button onClick={()=>{setRescheduleTask(t);setRescheduleDate(t.due_date||today)}} className="py-2 rounded-lg bg-gray-50 text-gray-600 text-xs font-semibold">ì¼ì •ë³€ê²½</button>
               </div>
             )}
           </div>
         })}
       </div>}
    </div>

    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-50">
        <div className="text-sm font-semibold text-gray-800">ğŸ  í™ˆ ì„¤ì¹˜Â·ê°œí†µ ì§„í–‰ê´€ë¦¬</div>
        <div className="text-[11px] text-gray-400 mt-0.5">ì„¤ì¹˜ ì˜ˆì •ê³¼ ì§„í–‰ ìƒíƒœë¥¼ í•­ìƒ í‘œì‹œí•´ìš”.</div>
      </div>
      <div><HomeOrderManager {...homeProps}/></div>
    </div>
    {rescheduleTask&&<div className="fixed inset-0 z-[110] bg-black/45 flex items-end sm:items-center justify-center" onClick={()=>setRescheduleTask(null)}><div className="w-full max-w-sm bg-white rounded-t-3xl sm:rounded-3xl p-5" onClick={e=>e.stopPropagation()}><div className="text-lg font-bold text-gray-900">ì•½ì† ë‚ ì§œë¥¼ ë³€ê²½í• ê¹Œìš”?</div><div className="text-xs text-gray-500 mt-1">ê³ ê°ì—ê²Œ ë‹¤ì‹œ ì—°ë½í•  ë‚ ì§œë¥¼ ì„ íƒí•´ì£¼ì„¸ìš”.</div><input type="date" value={rescheduleDate} onChange={e=>setRescheduleDate(e.target.value)} className="mt-4 w-full border border-gray-200 rounded-xl px-3 py-3 text-sm"/><div className="grid grid-cols-2 gap-2 mt-4"><button onClick={()=>setRescheduleTask(null)} className="py-3 rounded-xl bg-gray-100 text-gray-600 text-sm font-bold">ì·¨ì†Œ</button><button onClick={async()=>{if(!rescheduleDate)return showAppToast('ë³€ê²½í•  ë‚ ì§œë¥¼ ì„ íƒí•´ì£¼ì„¸ìš”.',{tone:'error'});await updateTask(rescheduleTask,{status:'pending',due_date:rescheduleDate});setRescheduleTask(null)}} className="py-3 rounded-xl bg-violet-600 text-white text-sm font-bold">ë‚ ì§œ ë³€ê²½</button></div></div></div>}
  </div>;
}


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

    // 1ìˆœìœ„: ì˜¤ëŠ˜/ì§€ì—° ê³ ê° ì•½ì†
    if(todayTasks>0){
      out.push({
        icon:'ğŸ””',
        text:`ì˜¤ëŠ˜ í™•ì¸í•  ê³ ê° ì•½ì† ${todayTasks}ê±´ì´ ìˆì–´ìš”`,
        action:'í™•ì¸',
        onClick:onGoCare,
        priority:100,
      });
    }

    // 2ìˆœìœ„: ê°€ì¥ ìœ ë¦¬í•œ ë‹¤ìŒ í–‰ë™
    const next=buildNextGoal(pay,draft,config);
    if(next){
      out.push({
        icon:'ğŸ¯',
        text:`${next.title} Â· ${next.remain}${next.unit} ë”í•˜ë©´ ì˜ˆìƒ +${won(next.delta)}`,
        action:'ì…ë ¥',
        onClick:onGoInput,
        priority:80,
      });
    }

    // 3ìˆœìœ„: ê°œì¸ ì‹¤ì  íë¦„
    const hs=hsCount(draft);
    const productivity=Number(pay?.kpiScore||0);
    if(hs>0){
      out.push({icon:'ğŸ”¥',text:`ì´ë²ˆ ë‹¬ HS ${hs}ê±´ ê¸°ë¡ ì¤‘`,priority:50});
    }
    if(productivity>0){
      out.push({icon:'ğŸ“ˆ',text:`ì´ë²ˆ ë‹¬ ìƒì‚°ì„± ${productivity.toFixed(1)}P ê¸°ë¡ ì¤‘`,priority:45});
    }

    // 4ìˆœìœ„: ìš°ë¦¬ ë§¤ì¥ ë‚´ í˜„ì¬ ìœ„ì¹˜
    const branchRows=(competitionRows||[]).filter(r=>r.branch===branch);
    if(branchRows.length>1){
      const sorted=[...branchRows].sort((a,b)=>Number(b.pay?.total||0)-Number(a.pay?.total||0));
      const rank=sorted.findIndex(r=>r.id===userId)+1;
      if(rank>0){
        out.push({icon:'ğŸª',text:`ìš°ë¦¬ ë§¤ì¥ ì˜ˆìƒ ì¸ì„¼í‹°ë¸Œ í˜„ì¬ ${rank}/${sorted.length}ìœ„`,priority:30});
      }
    }

    if(!out.length){
      out.push({icon:'âœ¨',text:'ì˜¤ëŠ˜ ì‹¤ì ì„ ì…ë ¥í•˜ë©´ ë§ì¶¤ í•œ ì¤„ì´ ì‹œì‘ë¼ìš”',action:'ì…ë ¥',onClick:onGoInput,priority:1});
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
      <button type="button" onClick={nextMessage} className="text-[11px] text-gray-400 shrink-0" aria-label="ë‹¤ìŒ í•œ ì¤„">
        {messageIndex+1}/{messages.length} â€º
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
        const label=rd.hasTiers?`${rd.dailyLabel||rd.label} Â· ${MATRIX_COLS[ci]||''}`:(rd.dailyLabel||rd.label);
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
        if(meta.usedMnpBundle)inc(mobile,'ì¤‘ê³  MNP 61êµ°â†‘ ê²°í•©');
      });
      const validHomes=homeOrdersForMonth(homes||[],month);
      const completedHomes=homeOrdersForMonth(validHomes,month,'completed');
      const pendingHomes=homeOrdersForMonth(validHomes,month,'pending');
      const addHomeRows=(rows,target)=>rows.forEach(x=>{
        const labels={internet1g:'ì¸í„°ë„· 1GB',internet500:'ì¸í„°ë„· 500MB',internet100:'ì¸í„°ë„· 100MB',homeOnly:'ì¸í„°ë„· ë‹¨ë…',homeTv:'TV(ì£¼)',tvFree:'TVí”„ë¦¬(ë¶€)',smartHome:'ìŠ¤ë§ˆíŠ¸í™ˆ'};
        const fallbackLabel=String(x.product_type||'í™ˆ ê¸°íƒ€')
          .replace(/^internet1g$/i,'ì¸í„°ë„· 1GB')
          .replace(/^internet500$/i,'ì¸í„°ë„· 500MB')
          .replace(/^internet100$/i,'ì¸í„°ë„· 100MB')
          .replace(/^simulNewChange$/i,'í™ˆ + HS ì‹ ê·œ/ê¸°ë³€ ë™ì‹œíŒë§¤')
          .replace(/^simulMnp$/i,'í™ˆ + HS MNP ë™ì‹œíŒë§¤');
        inc(target,labels[x.product_type]||fallbackLabel);
      });
      addHomeRows(completedHomes,home);
      addHomeRows(pendingHomes,homePending);
      // í™ˆì€ í•œ ê³ ê° ë¬¶ìŒì´ í™ˆ+TV/ì¸í„°ë„·/ë™ì‹œíŒë§¤ ë“± ì—¬ëŸ¬ í–‰ìœ¼ë¡œ ì €ì¥ë˜ë¯€ë¡œ
      // ê°™ì€ ë‚ ì§œ+ê³ ê°ì„ í•µì‹¬ íŒë§¤ 1ê±´ìœ¼ë¡œ ê³„ì‚°í•©ë‹ˆë‹¤.
      const arr=o=>Object.entries(o).sort((a,b)=>b[1]-a[1]).map(([label,count])=>({label,count}));
      const result={mobile:arr(mobile),strategicVas:arr(strategicVas),insurance:arr(insurance),second:arr(second),home:arr(home),homePending:arr(homePending),totalHs,totalHome:homeBundleCount(completedHomes),totalHomePending:homeBundleCount(pendingHomes),totalStrategicPlan,totalStrategicVas:Object.values(strategicVas).reduce((a,v)=>a+v,0),totalInsurance:Object.values(insurance).reduce((a,v)=>a+v,0),totalSecond:Object.values(second).reduce((a,v)=>a+v,0)};
      setSummary(result);setLoading(false);
    })().catch(e=>{console.error('INPUT SUMMARY LOAD ERROR',e);if(alive){setLoadError(friendlyError(e));setLoading(false)}});
    return()=>{alive=false};
  },[userId,month,config]);

  const Group=({title,rows})=>rows?.length?<div className="py-2"><div className="text-[11px] font-bold text-gray-500 mb-1.5">{title}</div><div className="space-y-1">{rows.map((x,i)=><div key={`${title}-${i}`} className="flex justify-betwó_tÑ¼­zÊ&ŠÛ^v‡²^C®*Pƒ²b¶Z—²vƒ²ó² ƒ²V+²*×®.#®.¸(€€€€€½¹ÍĞÁÉ•Ù¥•İ=É‘•ÉÌô¡¡½µ•I•Ì¹‘…Ñ…ññmt¤¹µ…À¡¼ôø¡ì¸¸¹¼±ÍÑ…ÑÕÌè½µÁ±•Ñ•ô¤¤ì(€€€€€Í•Ñ!½µ•AÉ•Ù¥•İA½±¥ä¡…±Õ±…Ñ•!½µ•A½±¥å¹¥¹”¡ÁÉ•Ù¥•İ=É‘•ÉÌ±½¹™¥œ¤¤ì(€€€õ•±Í•ì(€€€€€½¹Í½±”¹•ÉÉ½È !=5AIY%\1=II=Hœ±¡½µ•I•Ì¹•ÉÉ½È¤ì(€€€€€Í•Ñ…å!½µ•=É‘•ÉÌ¡mt¤ì(€€€€€Í•Ñ!½µ•AÉ•Ù¥•İA½±¥ä¡¹Õ±°¤ì(€€€ô(€€€Í•Ñ…åM…±•Í1½…‘¥¹œ¡™…±Í”¤ì(€ô±mÕÉÉ•¹ÑµÀü¹¥±µ½¹Ñ ±Í•±•Ñ•‘…ä±½¹™¥t¤ì((€ÕÍ•™™•Ğ  ¤ôùí±½…‘…åM…±•Ì ¥ô±m±½…‘…åM…±•Ít¤ì((€½¹ÍĞ‘•±•Ñ•M…±”õ…Íå¹Œ¡Í…±”±íÍ­¥Á½¹™¥É´õ™…±Í•ôõíô¤ôùì(€€€½¹ÍĞ¹…µ”õÍ…±”¹ÕÍÑ½µ•ÉÌü¹ÕÍÑ½µ•É}¹…µ•ñğŸªÎƒªÂtœì(€€€½¹ÍĞ‰Õ¹‘±•Q•áĞõÍ…±”¹Í½ÕÉ•}ÑåÁ”ôôô¡½µ•}½É‘•ÈœüŸ²vĞƒªÎƒªÂw²v`ƒªÂg²v ƒ®
€ƒ¶f ƒ¶2C®ƒ®²Û²v3²vƒ²
·²‚s¶Vƒªæ3²jPüœèŸ²vĞƒ¶2C®ƒªÆÓ²vƒ²
·²‚s¶Vƒªæ3²jPüœì(€€€¥˜ …Í­¥Á½¹™¥É´˜˜……İ…¥ĞÍ¡½İÁÁ½¹™¥É´¡íÑ¥Ñ±”èŸ¶2C®“ªÆÓ²vƒ²
·²‚s¶Vƒªæ3²jPüœ±µ•ÍÍ…”é€‘í¹…µ•ôƒ
Ü€‘íÍ…±”¹µ•ÑÉ¥}±…‰•±õq¸‘í‰Õ¹‘±•Q•áÑõq»²^ÃªÊÃ®BpƒªÎƒªÂtƒ²V÷²7ªÎğƒ²b²^®æ²j§®>ƒ¶V£ªî`ƒ²
·²‚s®B§®.#®.¹€±½¹™¥Éµ1…‰•°èŸ¶2C®“ªÆĞƒ²
·²‚pœ±Ñ½¹”è‘…¹•Èô¤¥É•ÑÕÉ¸ì(€€€½¹ÍĞµ•Ñ„õÍ…±”¹Í½ÕÉ•}µ•Ñ…ññíôì((€€€¥˜¡Í…±”¹Í½ÕÉ•}ÑåÁ”ôôô¡½µ•}½É‘•Èœ¥ì(€€€€€½¹ÍĞí‘…Ñ„éÉ•ÍÕ±Ğ±•ÉÉ½Éôõ…İ…¥ĞÍÕÁ…‰…Í”¹ÉÁŒ ‘•±•Ñ•}¡½µ•}‰Õ¹‘±•}…Ñ½µ¥Œœ±íÁ}ÕÍ•É}¥éÕÉÉ•¹ÑµÀü¹¥±Á}…¹¡½É}Í…±•}¥éÍ…±”¹¥‘ô¤ì(€€€€€¥˜¡•ÉÉ½È¥É•ÑÕÉ¸Í¡½İ1•…å±•ÉĞ¡ƒ¶f ƒ¶2C®ƒ²
·²‚pƒ².“¶2 è€‘í™É¥•¹‘±åÉÉ½È¡•ÉÉ½È¥õ€¤ì(€€€€€¥˜ …É•ÍÕ±Ñññ9Õµ‰•È¡É•ÍÕ±Ğ¹Í…±•}½Õ¹Ğ¤ğÄ¥É•ÑÕÉ¸Í¡½İ1•…å±•ÉĞ Ÿ²
·²‚pƒªÊÃªÎó®–ğƒ¶fW²vã¶Vc² ƒ®ªï¶Z#²ZÓ²jP¸ƒ®.“².pƒ¶fW²vã¶VÓ²ó²ã²jP¸œ¤ì(€€€€€…İ…¥Ğ½¹!½µ•=É‘•ÉÍ¡…¹•ü¸ ¤ì(€€€€€¥˜¡µ•Ñ„¹Ñ•…µ=¹±ä¥…İ…¥Ğ½¹Q•…µÉ•‘¥ÑM…Ù•ü¸ ¤ì(€€€€€…İ…¥Ğ±½…‘…åM…±•Ì ¤ì(€€€€€É•ÑÕÉ¸ì(€€€ô((€€€¥˜¡µ•Ñ„¹Ñ•…µ=¹±ä¥ì(€€€€€…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ ÕÍÑ½µ•É}Ñ…Í­Ìœ¤¹‘•±•Ñ” ¤¹•Ä Í½ÕÉ•}Í…±•}¥œ±Í…±”¹¥¤¹•Ä ÕÍ•É}¥œ±ÕÉÉ•¹ÑµÀü¹¥¤ì(€€€€€…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ Í…±•Í}•áÁ•¹Í•Ìœ¤¹‘•±•Ñ” ¤¹•Ä Í½ÕÉ•}Í…±•}¥œ±Í…±”¹¥¤¹•Ä ÕÍ•É}¥œ±ÕÉÉ•¹ÑµÀü¹¥¤ì(€€€€€…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ ÕÍÑ½µ•É}Í…±•Ìœ¤¹‘•±•Ñ” ¤¹•Ä ¥œ±Í…±”¹¥¤¹•Ä ÕÍ•É}¥œ±ÕÉÉ•¹ÑµÀü¹¥¤ì(€€€€€…İ…¥Ğ½¹Q•…µÉ•‘¥ÑM…Ù•ü¸ ¤ì(€€€€€±½…‘…åM…±•Ì ¤íÉ•ÑÕÉ¸ì(€€€ô((€€€¥˜¡Í…±”¹Í½ÕÉ•}ÑåÁ”ôôô•áÑÉ„œ¥ì(€€€€€½¹ÍĞ‰…Í”õ¹½Éµ…±¥é•…ä¡‘…ä¤±¹Ğõ9Õµ‰•È¡µ•Ñ„¹½Õ¹ÑñğÄ¤ì(€€€€€¥˜¡µ•Ñ„¹•áÑÉ…QåÁ”ôôôÍ½¹¼œ¥í½¹ÍĞÉ½ÕÁÌõì¸¸¹‰…Í”¹É½ÕÁÌ±Í½¹¼éì¸¸¸¡‰…Í”¹É½ÕÁÌü¹Í½¹½ññíô¥õôíÉ½ÕÁÌ¹Í½¹½mµ•Ñ„¹Í½¹½-•åtõ5…Ñ ¹µ…à À±9Õµ‰•È¡É½ÕÁÌ¹Í½¹½mµ•Ñ„¹Í½¹½-•åuñğÀ¤µ¹Ğ¤íµÕÑ…Ñ”¡ì¸¸¹‰…Í”±É½ÕÁÍô¤íô(€€€€€•±Í”¥˜¡µ•Ñ„¹•áÑÉ…QåÁ”ôôôÑ…¥±½É•œ¥µÕÑ…Ñ”¡ì¸¸¹‰…Í”±Ñ…¥±½É•‘½Õ¹Ğé5…Ñ ¹µ…à À±9Õµ‰•È¡‰…Í”¹Ñ…¥±½É•‘½Õ¹ÑñğÀ¤µ¹Ğ¤±Ñ…¥±½É•‘µ½Õ¹Ğé5…Ñ ¹µ…à À±9Õµ‰•È¡‰…Í”¹Ñ…¥±½É•‘µ½Õ¹ÑñğÀ¤µ9Õµ‰•È¡µ•Ñ„¹…µ½Õ¹ÑñğÀ¤¥ô¤ì(€€€€€•±Í”¥˜¡µ•Ñ„¹•áÑÉ…QåÁ”ôôôÕÍÑ½µ•ÉI•œœ¥µÕÑ…Ñ”¡ì¸¸¹‰…Í”±ÕÍÑI•½Õ¹Ğé5…Ñ ¹µ…à À±9Õµ‰•È¡‰…Í”¹ÕÍÑI•½Õ¹ÑñğÀ¤µ¹Ğ¥ô¤ì(€€€€€…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ ÕÍÑ½µ•É}Í…±•Ìœ¤¹‘•±•Ñ” ¤¹•Ä ¥œ±Í…±”¹¥¤¹•Ä ÕÍ•É}¥œ±ÕÉÉ•¹ÑµÀü¹¥¤í±½…‘…åM…±•Ì ¤íÉ•ÑÕÉ¸ì(€€€ô((€€€¥˜¡Í…±”¹Í½ÕÉ•}ÑåÁ”ôôôµ½‰¥±”œ€˜˜9Õµ‰•È¹¥Í%¹Ñ••È¡µ•Ñ„¹É¤¤€˜˜9Õµ‰•È¹¥Í%¹Ñ••È¡µ•Ñ„¹¤¤¥ì(€€€€€½¹ÍĞ‰…Í”õ¹½Éµ…±¥é•…ä¡‘…ä¤±µ…ÑÉ¥àõ‰…Í”¹µ…ÑÉ¥à¹µ…À¡Èôùl¸¸¹Ét¤ìµ…ÑÉ¥ámµ•Ñ„¹É¥umµ•Ñ„¹¥tõ5…Ñ ¹µ…à À±9Õµ‰•È¡µ…ÑÉ¥ámµ•Ñ„¹É¥umµ•Ñ„¹¥uñğÀ¤´Ä¤ì(€€€€€½¹ÍĞÙ…Ìõì¸¸¸¡‰…Í”¹É½ÕÁÌü¹Ù…Íññíô¥ôì(€€€€€½¹ÍĞ‘•±•Ñ•Y…Í-•åÌõµ•Ñ„¹‰Õ¹‘±•Y…Í½µµ¥ÍÍ¥½¹á±Õ‘•ü¡µ•Ñ„¹Ù…Í-•åÍññmt¤él¸¸¸¡µ•Ñ„¹Ù…Í-•åÍññmt¤°¸¸¹=‰©•Ğ¹Ù…±Õ•Ì¡µ•Ñ„¹‰Õ¹‘±•Y…Í5…Áññíô¤¹™±…Ğ ¥tì(€€€€€‘•±•Ñ•Y…Í-•åÌ¹™½É… ¡¬ôùí¥˜¡¬„ôôÙ…Í9½¹”œ¥Ù…Ím­tõ5…Ñ ¹µ…à À±9Õµ‰•È¡Ù…Ím­uñğÀ¤´Ä¥ô¤ì(€€€€€½¹ÍĞ‰Õ¹‘±”É¹õì¸¸¸¡‰…Í”¹É½ÕÁÌü¹‰Õ¹‘±”É¹‘ññíô¥ôì¡µ•Ñ„¹‰Õ¹‘±”É¹‘-•åÍññmt¤¹™½É… ¡¬ôù‰Õ¹‘±”É¹‘m­tõ5…Ñ ¹µ…à À±9Õµ‰•È¡‰Õ¹‘±”É¹‘m­uñğÀ¤´Ä¤¤ì(€€€€€½¹ÍĞµ¹Á	Õ¹‘±”õì¸¸¸¡‰…Í”¹É½ÕÁÌü¹µ¹Á	Õ¹‘±•ññíô¥ôí¥˜¡µ•Ñ„¹ÕÍ•‘5¹Á	Õ¹‘±”¥µ¹Á	Õ¹‘±”¹ÕÍ•‘5¹Á	Õ¹‘±”õ5…Ñ ¹µ…à À±9Õµ‰•È¡µ¹Á	Õ¹‘±”¹ÕÍ•‘5¹Á	Õ¹‘±•ñğÀ¤´Ä¤ì(€€€€€½¹ÍĞÍÀõµ•Ñ„¹ÍÁ•¥…±A½±¥åññíôì(€€€€€½¹ÍĞ™É•”õ‰Õ¹‘±•É••µ½Õ¹ÑÌ¡µ•Ñ„¹‰Õ¹‘±”É¹‘-•åÍññmt±µ•Ñ„¹‰Õ¹‘±•Y…Í5…Áññíô±µ•Ñ„¹‰Õ¹‘±•M…±•QåÁ•5…Áññíô±ÑÉÕ”¤ì(€€€€€µÕÑ…Ñ”¡ì¸¸¹‰…Í”±µ…ÑÉ¥à±É½ÕÁÌéì¸¸¹‰…Í”¹É½ÕÁÌ±Ù…Ì±‰Õ¹‘±”É¹±µ¹Á	Õ¹‘±•ô°(€€€€€€€‰Õ¹‘±•É••=™™Í•Ğé5…Ñ ¹µ…à À±9Õµ‰•È¡‰…Í”¹‰Õ¹‘±•É••=™™Í•ÑñğÀ¤µ9Õµ‰•È¡™É•”¹‰Õ¹‘±•=™™Í•ÑñğÀ¤¤°(€€€€€€€‰Õ¹‘±•É••Y…Í=™™Í•Ğé5…Ñ ¹µ…à À±9Õµ‰•È¡‰…Í”¹‰Õ¹‘±•É••Y…Í=™™Í•ÑñğÀ¤µ9Õµ‰•È¡™É•”¹Ù…Í=™™Í•ÑñğÀ¤¤°(€€€€€€€ÍÁ•¥…±5…ÑÉ¥á=™™Í•Ğé5…Ñ ¹µ…à À±9Õµ‰•È¡‰…Í”¹ÍÁ•¥…±5…ÑÉ¥á=™™Í•ÑñğÀ¤µ9Õµ‰•È¡ÍÀ¹¹½Éµ…±5…ÑÉ¥á••ñğÀ¤¤±ÍÁ•¥…±Y…Í=™™Í•Ğé5…Ñ ¹µ…à À±9Õµ‰•È¡‰…Í”¹ÍÁ•¥…±Y…Í=™™Í•ÑñğÀ¤µ9Õµ‰•È¡ÍÀ¹¹½Éµ…±Y…Í••ñğÀ¤¤±ÍÁ•¥…±I•Á±…•µ•¹ÑA…äé5…Ñ ¹µ…à À±9Õµ‰•È¡‰…Í”¹ÍÁ•¥…±I•Á±…•µ•¹ÑA…åñğÀ¤µ9Õµ‰•È¡ÍÀ¹•á•ÁÑ¥½¹MÑ…ÑÕÌôôô…ÁÁÉ½Ù•œıÍÀ¹•á•ÁÑ¥½¹ÁÁÉ½Ù•‘µ½Õ¹ĞéÍÀ¹•á•ÁÑ¥½¹MÑ…ÑÕÌôôôÁ•¹‘¥¹œœüÀéÍÀ¹É•Á±…•µ•¹Ñµ½Õ¹ÑñğÀ¤¥ô¤ì(€€€ô(€€€…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ ÕÍÑ½µ•É}Ñ…Í­Ìœ¤¹‘•±•Ñ” ¤¹•Ä Í½ÕÉ•}Í…±•}¥œ±Í…±”¹¥¤¹•Ä ÕÍ•É}¥œ±ÕÉÉ•¹ÑµÀü¹¥¤ì(€€€…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ Í…±•Í}•áÁ•¹Í•Ìœ¤¹‘•±•Ñ” ¤¹•Ä Í½ÕÉ•}Í…±•}¥œ±Í…±”¹¥¤¹•Ä ÕÍ•É}¥œ±ÕÉÉ•¹ÑµÀü¹¥¤ì(€€€½¹ÍĞí•ÉÉ½Éôõ…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ ÕÍÑ½µ•É}Í…±•Ìœ¤¹‘•±•Ñ” ¤¹•Ä ¥œ±Í…±”¹¥¤¹•Ä ÕÍ•É}¥œ±ÕÉÉ•¹ÑµÀü¹¥¤ì¥˜¡•ÉÉ½È¥É•ÑÕÉ¸Í¡½İ1•…å±•ÉĞ¡ƒ¶2C®ƒ²
·²‚pƒ².“¶2 è€‘í™É¥•¹‘±åÉÉ½È¡•ÉÉ½È¥õ€¤ì±½…‘…åM…±•Ì ¤ì(€ôì((€½¹ÍĞ½Á•¹!½µ•=É‘•È€ô€¡É½ÕÁ-•ä€ô¹Õ±°°¥Ñ•µ-•ä€ô¹Õ±°¤€ôøì(€€€¥˜€¡±½­•¤É•ÑÕÉ¸ì(€€€Í•Ñ!½µ•=É‘•ÉÉ…™Ğ¡ìÕ¹¥™¥•éÑÉÕ”°±…‰•°èŸ¶f ƒ².“²‚ƒ²z®‚”œô¤ì(€€€Í•Ñ!½µ•ÕÍÑ½µ•É9…µ” œœ¤ì(€€€Í•Ñ!½µ•9•Ñİ½É­QåÁ” œœ¤ì(€€€Í•Ñ!½µ•%¹Ñ•É¹•Ğ¡™…±Í”¤ìÍ•Ñ!½µ•%¹Ñ•É¹•ÑMÁ•• œœ¤ìÍ•Ñ!½µ•5½‰¥±•M¥µÕ° ¹½¹”œ¤ìÍ•Ñ!½µ•5…¥¹QØ¡™…±Í”¤ìÍ•Ñ!½µ•5…¥¹QÙA±…¸ œœ¤ìÍ•Ñ!½µ•MÕ‰QØ¡™…±Í”¤ìÍ•Ñ!½µ•MÕ‰QÙQåÁ” œœ¤ìÍ•Ñ!½µ•Mµ…ÉÑ!½µ”¡™…±Í”¤ì(€€€Í•Ñ!½µ•¥É•Ñ½µÁ±•Ñ”¡™…±Í”¤ì(€€€Í•Ñ!½µ•ÑÕ…±½µÁ±•Ñ•…Ñ” œœ¤ì(€€€Í•Ñ!½µ•A±…¹¹•‘…Ñ” œœ¤ì(€€€Í•Ñ!½µ•…É•-•åÌ¡mt¤ìÍ•Ñ!½µ•ÕÍÑ½µQ¥Ñ±” œœ¤ìÍ•Ñ!½µ•ÕÍÑ½µÕ•…Ñ” œœ¤ìÍ•Ñ!½µ•Q…É•ÑA±…¸ œœ¤ì(€€€Í•Ñ!½µ•MÁ½ÑA½±¥å% œœ¤ìÍ•Ñ!½µ•MÁ½Ñ¥É•Ñ=Á•¸¡™…±Í”¤ìÍ•Ñ!½µ•MÁ½Ñ¥É•ÑQ¥Ñ±” œœ¤ìÍ•Ñ!½µ•MÁ½Ñ¥É•Ñµ½Õ¹Ğ œœ¤ìÍ•Ñ!½µ•MÁ½Ñ¥É•Ñ5•µ¼ œœ¤ì(€€€Í•Ñ!½µ•áÁ•¹Í•=Á•¸¡™…±Í”¤ìÍ•Ñ!½µ•áÁ•¹Í•…Ñ•½Éä Ÿ²b“¶6ğœ¤ìÍ•Ñ!½µ•áÁ•¹Í•µ½Õ¹Ğ œœ¤ìÍ•Ñ!½µ•áÁ•¹Í•5•µ¼ œœ¤ì(€€€Í•Ñ!½µ•áÑÉ…AÉ½µ¥Í•Ì¡mt¤ìÍ•Ñ!½µ•áÑÉ…áÁ•¹Í•Ì¡mt¤ìÍ•Ñ‘¥Ñ¥¹!½µ•M…±•Ì¡mt¤ì(€ôì((€½¹ÍĞ±½Í•!½µ•=É‘•È€ô…Íå¹Œ€ ¤€ôøì(€€€¥˜¡¡½µ•=É‘•ÉM…Ù¥¹œ¥É•ÑÕÉ¸ì(€€€½¹ÍĞ¡…Í%¹ÁÕĞô„„¡¡½µ•=É‘•ÉÉ…™Ğü¹•‘¥Ñ¥¹ññ¡½µ•ÕÍÑ½µ•É9…µ”¹ÑÉ¥´ ¥ññ¡½µ•9•Ñİ½É­QåÁ•ññ¡½µ•%¹Ñ•É¹•Ñññ¡½µ•5…¥¹QÙññ¡½µ•MÕ‰QÙññ¡½µ•Mµ…ÉÑ!½µ•ññ¡½µ•5½‰¥±•M¥µÕ°„ôô¹½¹”ññ¡½µ•A±…¹¹•‘…Ñ•ññ¡½µ•ÕÍÑ½µQ¥Ñ±”¹ÑÉ¥´ ¥ññ¡½µ•áÑÉ…AÉ½µ¥Í•Ì¹±•¹Ñ¡ññ¡½µ•áÁ•¹Í•=Á•¸¤ì(€€€¥˜¡¡…Í%¹ÁÕĞ˜˜……İ…¥ĞÍ¡½İÁÁ½¹™¥É´¡íÑ¥Ñ±”èŸ¶f ƒ²z®‚—²vƒ®.¯²vªæ3²jPüœ±µ•ÍÍ…”èŸ²V²ƒ®NÇ®†w¶Vc² ƒ²V+²v ƒ²zG²Äƒ®
Ó²j§²v ƒ²
³®vó²G®.#®.¸œ±½¹™¥Éµ1…‰•°èŸ²zG²Äƒ®
Ó²j¤ƒ®Ê®š³ªâÀœ±Ñ½¹”èİ…É¹¥¹œô¤¥É•ÑÕÉ¸ì(€€€Í•Ñ!½µ•=É‘•ÉÉ…™Ğ¡¹Õ±°¤íÍ•Ñ‘¥Ñ¥¹!½µ•M…±•Ì¡mt¤íÍ•Ñ1•…å½¹Ù•ÉÍ¥½¸¡¹Õ±°¤ì(€€€Í•Ñ!½µ•ÕÍÑ½µ•É9…µ” œœ¤íÍ•Ñ!½µ•9•Ñİ½É­QåÁ” œœ¤íÍ•Ñ!½µ•%¹Ñ•É¹•Ğ¡™…±Í”¤íÍ•Ñ!½µ•%¹Ñ•É¹•ÑMÁ•• œœ¤íÍ•Ñ!½µ•5…¥¹QØ¡™…±Í”¤íÍ•Ñ!½µ•5…¥¹QÙA±…¸ œœ¤íÍ•Ñ!½µ•MÕ‰QØ¡™…±Í”¤íÍ•Ñ!½µ•MÕ‰QÙQåÁ” œœ¤íÍ•Ñ!½µ•Mµ…ÉÑ!½µ”¡™…±Í”¤íÍ•Ñ!½µ•5½‰¥±•M¥µÕ° ¹½¹”œ¤íÍ•Ñ!½µ•¥É•Ñ½µÁ±•Ñ”¡™…±Í”¤íÍ•Ñ!½µ•ÑÕ…±½µÁ±•Ñ•…Ñ” œœ¤íÍ•Ñ!½µ•A±…¹¹•‘…Ñ” œœ¤ì(€ôì((€½¹ÍĞÍÕ‰µ¥Ñ!½µ•=É‘•È€ô…Íå¹Œ€ ¤€ôøì(€€€¥˜€ …¡½µ•=É‘•ÉÉ…™Ğñğ€…ÕÉÉ•¹ÑµÀü¹¥ñğ±½­•ñğ¡½µ•MÕ‰µ¥ÑÕ…É‘I•˜¹ÕÉÉ•¹Ğ¤É•ÑÕÉ¸ì(€€€½¹ÍĞÕÍÑ½µ•È€ô¡½µ•ÕÍÑ½µ•É9…µ”¹ÑÉ¥´ ¤ì(€€€¥˜€ …ÕÍÑ½µ•È¤É•ÑÕÉ¸Í¡½İÁÁQ½…ÍĞ ŸªÎƒªÂw®ª²vƒ²z®‚—¶VÓ²Vğƒ®NÇ®†w¶V€ƒ²"`ƒ²z#²ZÓ²jP¸œ±íÑ½¹”è•ÉÉ½Èô¤ì(€€€¥˜¡…Ñ¥Ù•Q•…µMÕÁÁ½ÉĞ˜˜…Ñ•…µMÕÁÁ½ÉÑMÑ½É”¥É•ÑÕÉ¸Í¡½İÁÁQ½…ÍĞ Ÿ¶2 ƒ².“²‚²vƒ®Âc²b¶V€ƒ®“²z—²vƒ²ƒ¶w¶VÓ²ó²ã²jP¸œ±íÑ½¹”è•ÉÉ½Èô¤ì(€€€¥˜€ …¡½µ•9•Ñİ½É­QåÁ”¤É•ÑÕÉ¸Í¡½İÁÁQ½…ÍĞ ŸªÂ²‚W®tƒ®bC®*Pƒ²3¶bã®w²vƒ²ƒ¶w¶VÓ²ó²ã²jP¸œ±íÑ½¹”è•ÉÉ½Èô¤ì(€€€¥˜€ …¡½µ•%¹Ñ•É¹•Ğ€˜˜€…¡½µ•5…¥¹QØ€˜˜€…¡½µ•MÕ‰QØ€˜˜€…¡½µ•Mµ…ÉÑ!½µ”¤É•ÑÕÉ¸Í¡½İÁÁQ½…ÍĞ Ÿ¶2C®“¶Vpƒ¶f ƒ²¶J#²vƒ¶Vc®
`ƒ²vÓ²ƒ²ƒ¶w¶VÓ²ó²ã²jP¸œ±íÑ½¹”è•ÉÉ½Èô¤ì(€€€¥˜€¡¡½µ•5…¥¹QØ€˜˜€…¡½µ•%¹Ñ•É¹•Ğ¤É•ÑÕÉ¸Í¡½İÁÁQ½…ÍĞ QX£²ğ§®*Pƒ²vã¶Ã®ÜƒªÂ²zªÎğƒ¶V£ªî`ƒ²ƒ¶w¶VÓ²ó²ã²jP¸œ±íÑ½¹”è•ÉÉ½Èô¤ì(€€€¥˜€¡¡½µ•5…¥¹QØ€˜˜€…¡½µ•5…¥¹QÙA±…¸¤É•ÑÕÉ¸Í¡½İÁÁQ½…ÍĞ QX£²ğ¤ƒ²jSªâ#²‚pƒªÂ²zƒªâÃ²’²vƒ²ƒ¶w¶VÓ²ó²ã²jP¸œ±íÑ½¹”è•ÉÉ½Èô¤ì(€€€¥˜€¡¡½µ•%¹Ñ•É¹•Ğ€˜˜€…¡½µ•%¹Ñ•É¹•ÑMÁ••¤É•ÑÕÉ¸Í¡½İÁÁQ½…ÍĞ Ÿ²vã¶Ã®Üƒ²7®>®–ğƒ²ƒ¶w¶VÓ²ó²ã²jP¸œ±íÑ½¹”è•ÉÉ½Èô¤ì(€€€¥˜€¡¡½µ•MÕ‰QØ€˜˜€…¡½µ•MÕ‰QÙQåÁ”¤É•ÑÕÉ¸Í¡½İÁÁQ½…ÍĞ QX£®Ú ¤ƒ²Š®–c®–ğƒ²ƒ¶w¶VÓ²ó²ã²jP¸œ±íÑ½¹”è•ÉÉ½Èô¤ì(€€€¥˜€¡¡½µ•5½‰¥±•M¥µÕ°ôôôÕÍ•‘5¹Àœ€˜˜¡½µ•9•Ñİ½É­QåÁ”„ôô¡½ÕÍ•¡½±œ¤É•ÑÕÉ¸Í¡½İÁÁQ½…ÍĞ Ÿ²’GªÎ€59@ƒ®>g².s¶2C®“®*PƒªÂ²‚W®w²^C²s®0ƒ²‚²j§¶V€ƒ²"`ƒ²z#²ZÓ²jP¸œ±íÑ½¹”è•ÉÉ½Èô¤ì(€€€¥˜€¡¡½µ•¥É•Ñ½µÁ±•Ñ”€˜˜€…¡½µ•ÑÕ…±½µÁ±•Ñ•…Ñ”¤É•ÑÕÉ¸Í¡½İÁÁQ½…ÍĞ Ÿ²“²æc²f®3²vó²vƒ²z®‚—¶VÓ²ó²ã²jP¸œ±íÑ½¹”è•ÉÉ½Èô¤ì((€€€½¹ÍĞÍ½ÕÉ•]½É­…Ñ”õ€‘íµ½¹Ñ¡ô´‘íÍ•±•Ñ•‘…åõ€ì(€€€€¼¼ƒ².“²‚pƒ¶2C®ƒªÖ³²Ç²vƒªâÃ²†Ğƒ²‚W²
ÀƒªŞã®ç²ró®†pƒ²zC®>dƒ®Î¶f`(€€€½¹ÍĞÁÉ½‘ÕÑÌõmtì(€€€¥˜¡¡½µ•%¹Ñ•É¹•Ğ¥ì(€€€€€¥˜¡¡½µ•5…¥¹QØ¥ì(€€€€€€€½¹ÍĞµ…¥¹QÙA±…¹Q•áĞõ¥ÍM•ÁÑ•µ‰•ÉA½±¥åÑ¥Ù”¡µ½¹Ñ ¤ı¡½µ•5…¥¹QÙA±…¹1…‰•°¡¡½µ•5…¥¹QÙA±…¸±¡½µ•9•Ñİ½É­QåÁ”¤èœœì(€€€€€€€ÁÉ½‘ÕÑÌ¹ÁÕÍ ¡íÉ½ÕÁ-•äè¡½µ•	…Í”œ±¥Ñ•µ-•äè¡½µ•QØœ±ÁÉ½‘ÕÑQåÁ”è¡½µ•QØœ±±…‰•°éQX£²ğ¤‘íµ…¥¹QÙA±…¹Q•áĞı€ƒ
Ü€‘íµ…¥¹QÙA±…¹Q•áÑõ€èœõô¤ì(€€€€€ô(€€€€€•±Í”ÁÉ½‘ÕÑÌ¹ÁÕÍ ¡íÉ½ÕÁ-•äè¡½µ•	…Í”œ±¥Ñ•µ-•äè¡½µ•=¹±äœ±ÁÉ½‘ÕÑQåÁ”è¡½µ•=¹±äœ±±…‰•°èŸ¶f ƒ®.£®>ô¤ì(€€€€€½¹ÍĞÍÁ••‘5…Àõì(€€€€€€€€œÄÀÀœéí¥Ñ•µ-•äè¡½µ”ÄÀÁ=¹±äœ±ÁÉ½‘ÕÑQåÁ”è¥¹Ñ•É¹•ĞÄÀÀœ±±…‰•°èŸ²vã¶Ã®Ü€ÄÀÁ5ô°(€€€€€€€€œÔÀÀœéí¥Ñ•µ-•äè¡½µ”ÔÀÁ=¹±äœ±ÁÉ½‘ÕÑQåÁ”è¥¹Ñ•É¹•ĞÔÀÀœ±±…‰•°èŸ²vã¶Ã®Ü€ÔÀÁ5ô°(€€€€€€€€œÅœœéí¥Ñ•µ-•äè¡½µ”Å	=¹±äœ±ÁÉ½‘ÕÑQåÁ”è¥¹Ñ•É¹•ĞÅœœ±±…‰•°èŸ²vã¶Ã®Ü€Åô(€€€€€ôì(€€€€€½¹ÍĞÍÁ••õÍÁ••‘5…Ám¡½µ•%¹Ñ•É¹•ÑMÁ••‘tì(€€€€€¥˜¡ÍÁ••¤ÁÉ½‘ÕÑÌ¹ÁÕÍ ¡íÉ½ÕÁ-•äè¡½µ•±…Ğœ°¸¸¹ÍÁ••‘ô¤ì(€€€ô(€€€½¹ÍĞÍ¥µÕ±5…Àõì(€€€€€¹•İ¡…¹”éí¥Ñ•µ-•äè…‘‘9•İ¡…¹”œ±ÁÉ½‘ÕÑQåÁ”èÍ¥µÕ±9•İ¡…¹”œ±±…‰•°èŸ².ƒªŞp¿ªâÃ®Î ƒ®>g².s¶2C®ô°(€€€€€µ¹Àéí¥Ñ•µ-•äè…‘‘5¹Àœ±ÁÉ½‘ÕÑQåÁ”èÍ¥µÕ±5¹Àœ±±…‰•°è59@ƒ®>g².s¶2C®ô°(€€€€€ÕÍ•‘5¹Àéí¥Ñ•µ-•äè…‘‘UÍ•‘5¹Àœ±ÁÉ½‘ÕÑQåÁ”èÍ¥µÕ±UÍ•‘5¹Àœ±±…‰•°èŸ²’GªÎ59@ƒ®>g².s¶2C®€ à×ªÖÃŠDƒ²ƒ²Vô°ƒªÂ²‚W®t¤ô(€€€ôì(€€€¥˜¡¡½µ•5½‰¥±•M¥µÕ°„ôô¹½¹”œ€˜˜Í¥µÕ±5…Ám¡½µ•5½‰¥±•M¥µÕ±t¤ÁÉ½‘ÕÑÌ¹ÁÕÍ ¡íÉ½ÕÁ-•äè¡½µ•‘‘½¸œ°¸¸¹Í¥µÕ±5…Ám¡½µ•5½‰¥±•M¥µÕ±uô¤ì(€€€¥˜¡¡½µ•MÕ‰QØ¥ì(€€€€€¥˜¡¡½µ•MÕ‰QÙQåÁ”ôôô™É•”œ¤ÁÉ½‘ÕÑÌ¹ÁÕÍ ¡íÉ½ÕÁ-•äè¡½µ•±…Ğœ±¥Ñ•µ-•äèÑÙÉ•”œ±ÁÉ½‘ÕÑQåÁ”èÑÙÉ•”œ±±…‰•°èQ[¶R®š°£®Ú ¤ô¤ì(€€€€€•±Í”ÁÉ½‘ÕÑÌ¹ÁÕÍ ¡íÉ½ÕÁ-•äè¡½µ•‘‘½¸œ±¥Ñ•µ-•äè…‘‘M•ÑQ½Àœ±ÁÉ½‘ÕÑQåÁ”èÍÕ‰M•ÑQ½Àœ±±…‰•°èŸ²vó®Â`ƒ®Ú²/¶Dô¤ì(€€€ô(€€€¥˜¡¡½µ•Mµ…ÉÑ!½µ”¤ÁÉ½‘ÕÑÌ¹ÁÕÍ ¡íÉ½ÕÁ-•äè¡½µ•±…Ğœ±¥Ñ•µ-•äèÍµ…ÉÑ!½µ”œ±ÁÉ½‘ÕÑQåÁ”èÍµ…ÉÑ!½µ”œ±±…‰•°èŸ²*“®#¶*ã¶f ô¤ì((€€€½¹ÍĞ•‘¥Ñ¥¹I•™Ìõ¹•ÜM•Ğ ¡•‘¥Ñ¥¹!½µ•M…±•Íññmt¤¹µ…À¡àôùMÑÉ¥¹œ¡à¹Í½ÕÉ•}É•™ñğœœ¤¤¤ì(€€€½¹ÍĞí‘…Ñ„éÁ½ÍÍ¥‰±•ÕÁ±¥…Ñ•Ì±•ÉÉ½Èé‘ÕÁ±¥…Ñ•ÉÉ½Éôõ…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ ¡½µ•}½É‘•ÉÌœ¤(€€€€€€¹Í•±•Ğ ¥±ÕÍÑ½µ•É}¹…µ”±ÁÉ½‘ÕÑ}ÑåÁ”±Í½ÕÉ•}İ½É­}‘…Ñ”±ÍÑ…ÑÕÌœ¤(€€€€€€¹•Ä ÕÍ•É}¥œ±ÕÉÉ•¹ÑµÀ¹¥¤¹•Ä Í½ÕÉ•}İ½É­}‘…Ñ”œ±Í½ÕÉ•]½É­…Ñ”¤ì(€€€¥˜¡‘ÕÁ±¥…Ñ•ÉÉ½È¥É•ÑÕÉ¸Í¡½İÁÁQ½…ÍĞ¡ƒ²’G®ÎÔƒ¶fW²vàƒ².“¶2 è€‘í™É¥•¹‘±åÉÉ½È¡‘ÕÁ±¥…Ñ•ÉÉ½È¥õ€±íÑ½¹”è•ÉÉ½Èô¤ì(€€€½¹ÍĞ¹½Éµ…±¥é•‘9…µ”õÕÍÑ½µ•È¹É•Á±…” ½qÌ¬½œ°œœ¤¹Ñ½1½İ•É…Í” ¤ì(€€€½¹ÍĞÍ…µ•ÕÍÑ½µ•Èô¡Á½ÍÍ¥‰±•ÕÁ±¥…Ñ•Íññmt¤¹™¥±Ñ•È¡àôø…•‘¥Ñ¥¹I•™Ì¹¡…Ì¡MÑÉ¥¹œ¡à¹¥¤¤˜™MÑÉ¥¹œ¡à¹ÕÍÑ½µ•É}¹…µ•ñğœœ¤¹É•Á±…” ½qÌ¬½œ°œœ¤¹Ñ½1½İ•É…Í” ¤ôôõ¹½Éµ…±¥é•‘9…µ”¤ì(€€€½¹ÍĞ½Ù•É±…ÁÁ¥¹œõÍ…µ•ÕÍÑ½µ•È¹™¥±Ñ•È¡àôùÁÉ½‘ÕÑÌ¹Í½µ”¡ÀôùÀ¹ÁÉ½‘ÕÑQåÁ”ôôõà¹ÁÉ½‘ÕÑ}ÑåÁ”¤¤ì(€€€¥˜¡Í…µ•ÕÍÑ½µ•È¹±•¹Ñ ¥ì(€€€€€½¹ÍĞ½¬õ…İ…¥ĞÍ¡½İÁÁ½¹™¥É´¡ì(€€€€€€€Ñ¥Ñ±”é½Ù•É±…ÁÁ¥¹œ¹±•¹Ñ üŸ²’G®ÎÔƒ®NÇ®†tƒªÂ®*—²Ç²vĞƒ²z#²ZÓ²jPœèŸªÂg²v ƒ®
€ƒ®>g²vğƒªÎƒªÂw²vĞƒ²z#²ZÓ²jPœ°(€€€€€€€µ•ÍÍ…”é½Ù•É±…ÁÁ¥¹œ¹±•¹Ñ (€€€€€€€€€€ü€‘íÍ½ÕÉ•]½É­…Ñ•ôƒ
Ü€‘íÕÍÑ½µ•Éõq»ªÂg²v ƒ¶f ƒ²¶J €‘í½Ù•É±…ÁÁ¥¹œ¹±•¹Ñ¡÷ªÂsªÂ ƒ²vÓ®¾àƒ²‚²z—®>ğƒ²z#²ZÓ²jP¸ƒªŞã®zc®>ƒ®NÇ®†w¶Vƒªæ3²jPı€(€€€€€€€€€€è€‘íÍ½ÕÉ•]½É­…Ñ•ôƒ
Ü€‘íÕÍÑ½µ•Éõq»®.“®–àƒ¶f ƒ²¶J#²vĞƒ²vÓ®¾àƒ²‚²z—®>ğƒ²z#²ZÓ²jP¸ƒ²ÚSªÂ ƒ®NÇ®†w²vĞƒ®{®*S² ƒ¶fW²vã¶VÓ²ó²ã²jP¹€°(€€€€€€€½¹™¥Éµ1…‰•°èŸ¶fW²vàƒ¶nƒ®NÇ®†tœ±Ñ½¹”èİ…É¹¥¹œœ(€€€€€ô¤ì(€€€€€¥˜ …½¬¥É•ÑÕÉ¸ì(€€€ô((€€€±•Ğ±¥¹­•‘ÕÍÑ½µ•É%õ¹Õ±°ì(€€€ÑÉäì±¥¹­•‘ÕÍÑ½µ•É%õ…İ…¥Ğ•¹ÍÕÉ•ÕÍÑ½µ•È¡ÕÉÉ•¹ÑµÀ¹¥±ÕÍÑ½µ•È±Í½ÕÉ•]½É­…Ñ”¤ìô(€€€…Ñ ¡”¥ìÉ•ÑÕÉ¸Í¡½İ1•…å±•ÉĞ¡ƒªÎƒªÂtƒ²‚²z”ƒ².“¶2 è€‘í™É¥•¹‘±åÉÉ½È¡”¥õ€¤ìô((€€€¡½µ•MÕ‰µ¥ÑÕ…É‘I•˜¹ÕÉÉ•¹ĞõÑÉÕ”ì(€€€Í•Ñ!½µ•=É‘•ÉM…Ù¥¹œ¡ÑÉÕ”¤ì(€€€ÑÉåì(€€€€€½¹ÍĞ…ÁÁ±¥•‘Ğõ¹•Ü…Ñ”¡€‘íÍ½ÕÉ•]½É­…Ñ•õPÄÈèÀÀèÀÁ€¤¹Ñ½%M=MÑÉ¥¹œ ¤ì(€€€€€±•Ğİ½É­¥¹…äõ¹½Éµ…±¥é•…ä¡‘…ä¤ì(€€€€€±•ĞÉ•Á±…•‘M…±•%‘Ìõmtì(€€€€€±•ĞÉ•Á±…•‘=É‘•É%‘Ìõmtì(€€€€€€¼¼ƒªÖ³®Ê²‚ƒ¶f ƒ²GªÎ€ÇªÆÓ²vƒ²‚W²ƒªÎƒªÂw®Îƒ¶f ƒ¶2C®“®†pƒ²‚¶f`èƒ²nC®Îàƒ²GªÎ€ÇªÆÓ²vƒ®¢ó²‚ ƒ²Â£ªÂ@(€€€€€¥˜¡¡½µ•=É‘•ÉÉ…™Ğü¹±•…å½¹Ù•ÉÍ¥½¸€˜˜±•…å½¹Ù•ÉÍ¥½¸ü¹­¥¹ôôô¡½µ”œ¥ì(€€€€€€€½¹ÍĞ‰…Í”õİ½É­¥¹…äì(€€€€€€€½¹ÍĞÉ½ÕÁÌõì¸¸¹‰…Í”¹É½ÕÁÌ±m±•…å½¹Ù•ÉÍ¥½¸¹É½ÕÁ-•åtéì¸¸¸¡‰…Í”¹É½ÕÁÌü¹m±•…å½¹Ù•ÉÍ¥½¸¹É½ÕÁ-•åuññíô¥õôì(€€€€€€€É½ÕÁÍm±•…å½¹Ù•ÉÍ¥½¸¹É½ÕÁ-•åum±•…å½¹Ù•ÉÍ¥½¸¹¥Ñ•µ-•åtõ5…Ñ ¹µ…à (€€€€€€€€€€À±9Õµ‰•È¡É½ÕÁÍm±•…å½¹Ù•ÉÍ¥½¸¹É½ÕÁ-•åum±•…å½¹Ù•ÉÍ¥½¸¹¥Ñ•µ-•åuñğÀ¤´Ä(€€€€€€€€¤ì(€€€€€€€İ½É­¥¹…äõì¸¸¹‰…Í”±É½ÕÁÍôì(€€€€€ô(€€€€€€¼¼ØÈÄ¸Ääƒ¶f ƒ²"c²‚TèƒªâÃ²†Ğƒ®²Û²v3²v`ƒ²nC²Êpƒ².“²‚¿²ó®²à¿¶2C®“ªÆÓ²vƒ²‚sªÆÃ¶Vpƒ®Jƒ²"c²‚WªÂK²ró®†pƒ²z³ªÖ³²Ä(€€€€€¥˜¡¡½µ•=É‘•ÉÉ…™Ğü¹•‘¥Ñ¥¹œ€˜˜•‘¥Ñ¥¹!½µ•M…±•Ì¹±•¹Ñ ¥ì(€€€€€€€½¹ÍĞ‰…Í”õİ½É­¥¹…äì½¹ÍĞÉ½ÕÁÌõì¸¸¹‰…Í”¹É½ÕÁÍôì(€€€€€€€™½È¡½¹ÍĞ½±‘M…±”½˜•‘¥Ñ¥¹!½µ•M…±•Ì¥ì(€€€€€€€€€½¹ÍĞÉ•˜õ½±‘M…±”¹Í½ÕÉ•}É•˜ì¥˜ …É•˜¥½¹Ñ¥¹Õ”ì(€€€€€€€€€½¹ÍĞí‘…Ñ„é½ôõ…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ ¡½µ•}½É‘•ÉÌœ¤¹Í•±•Ğ œ¨œ¤¹•Ä ¥œ±É•˜¤¹µ…å‰•M¥¹±” ¤ì(€€€€€€€€€¥˜¡¼ü¹ÍÑ…ÑÕÌôôô½µÁ±•Ñ•œ€˜˜¼¹Í½ÕÉ•}É½ÕÀ€˜˜¼¹Í½ÕÉ•}­•ä¥ì(€€€€€€€€€€€É½ÕÁÍm¼¹Í½ÕÉ•}É½ÕÁtõì¸¸¸¡É½ÕÁÍm¼¹Í½ÕÉ•}É½ÕÁuññíô¥ôì(€€€€€€€€€€€É½ÕÁÍm¼¹Í½ÕÉ•}É½ÕÁum¼¹Í½ÕÉ•}­•åtõ5…Ñ ¹µ…à À±9Õµ‰•È¡É½ÕÁÍm¼¹Í½ÕÉ•}É½ÕÁum¼¹Í½ÕÉ•}­•åuñğÀ¤´Ä¤ì(€€€€€€€€€ô(€€€€€€€ô(€€€€€€€İ½É­¥¹…äõì¸¸¹‰…Í”±É½ÕÁÍôì(€€€€€€€É•Á±…•‘M…±•%‘Ìõ•‘¥Ñ¥¹!½µ•M…±•Ì¹µ…À¡àôùà¹¥¤ì(€€€€€€€É•Á±…•‘=É‘•É%‘Ìõ•‘¥Ñ¥¹!½µ•M…±•Ì¹µ…À¡àôùà¹Í½ÕÉ•}É•˜¤¹™¥±Ñ•È¡	½½±•…¸¤ì(€€€€€ô(€€€€€½¹ÍĞÉ•…Ñ•‘M…±•%‘ÌõÁÉ½‘ÕÑÌ¹µ…À  ¤ôùÉåÁÑ¼¹É…¹‘½µUU% ¤¤ì(€€€€€½¹ÍĞÁÉ¥µ…ÉåM…±•%õÉ•…Ñ•‘M…±•%‘ÍlÁtì(€€€€€½¹ÍĞ½É‘•ÉI½İÌõÁÉ½‘ÕÑÌ¹µ…À ¡ÁÉ½‘ÕĞ±¥¹‘•à¤ôø¡ì(€€€€€€€€€ÕÍ•É}¥éÕÉÉ•¹ÑµÀ¹¥±ÕÍÑ½µ•É}¹…µ”éÕÍÑ½µ•È±ÕÍÑ½µ•É}¥é±¥¹­•‘ÕÍÑ½µ•É%°(€€€€€€€€€ÁÉ½‘ÕÑ}ÑåÁ”éÁÉ½‘ÕĞ¹ÁÉ½‘ÕÑQåÁ”±¹•Ñİ½É­}ÑåÁ”é¡½µ•9•Ñİ½É­QåÁ”±Í…±•}ÑåÁ”è¹½Éµ…°œ°(€€€€€€€€€ÍÑ…ÑÕÌé¡½µ•¥É•Ñ½µÁ±•Ñ”ü½µÁ±•Ñ•œèÁ•¹‘¥¹œœ±…ÁÁ±¥•‘}…Ğé…ÁÁ±¥•‘Ğ°(€€€€€€€€€½µÁ±•Ñ•‘}…Ğé¡½µ•¥É•Ñ½µÁ±•Ñ”ı¹•Ü…Ñ”¡€‘í¡½µ•ÑÕ…±½µÁ±•Ñ•…Ñ•õPÄÈèÀÀèÀÁ€¤¹Ñ½%M=MÑÉ¥¹œ ¤é¹Õ±°±Í½ÕÉ•}İ½É­}‘…Ñ”éÍ½ÕÉ•]½É­…Ñ”°(€€€€€€€€€Í½ÕÉ•}É½ÕÀéÁÉ½‘ÕĞ¹É½ÕÁ-•ä±Í½ÕÉ•}­•äéÁÉ½‘ÕĞ¹¥Ñ•µ-•ä°(€€€€€€€€€µ…¥¹}ÑÙ}Á±…¸éÁÉ½‘ÕĞ¹ÁÉ½‘ÕÑQåÁ”ôôô¡½µ•QØœı¡½µ•5…¥¹QÙA±…¸é¹Õ±°°(€€€€€€€€€Á±…¹¹•‘}¥¹ÍÑ…±±}‘…Ñ”é¡½µ•A±…¹¹•‘…Ñ•ññ¹Õ±°±…ÑÕ…±}¥¹ÍÑ…±±}‘…Ñ”é¡½µ•¥É•Ñ½µÁ±•Ñ”ı¡½µ•ÑÕ…±½µÁ±•Ñ•…Ñ”é¹Õ±°°(€€€€€€€€€Í¡•µ…}Ù•ÉÍ¥½¸éUII9Q}M1}M!5}YIM%=8°(€€€€€ô¤¤ì(€€€€€½¹ÍĞÍ…±•I½İÌõÁÉ½‘ÕÑÌ¹µ…À ¡ÁÉ½‘ÕĞ±¥¹‘•à¤ôø¡ì(€€€€€€€€€¥éÉ•…Ñ•‘M…±•%‘Ím¥¹‘•át°(€€€€€€€€€ÕÍ•É}¥éÕÉÉ•¹ÑµÀ¹¥±ÕÍÑ½µ•É}¥é±¥¹­•‘ÕÍÑ½µ•É%±Í…±•}‘…Ñ”éÍ½ÕÉ•]½É­…Ñ”°(€€€€€€€€€µ•ÑÉ¥}±…‰•°éÁÉ½‘ÕĞ¹±…‰•°±Í½ÕÉ•}ÑåÁ”è¡½µ•}½É‘•Èœ±Í½ÕÉ•}É•˜é¹Õ±°°(€€€€€€€€€Í¡•µ…}Ù•ÉÍ¥½¸éUII9Q}M1}M!5}YIM%=8°(€€€€€€€€€Í½ÕÉ•}µ•Ñ„éİ¥Ñ¡ÕÉÉ•¹ÑM…±•M¡•µ„¡ì(€€€€€€€€€€€¹•Ñİ½É­QåÁ”é¡½µ•9•Ñİ½É­QåÁ”±Í…±•QåÁ”è¹½Éµ…°œ±¥¹Ñ•É¹•ÑMÁ••é¡½µ•%¹Ñ•É¹•ÑMÁ••‘ññ¹Õ±°°(€€€€€€€€€€€µ…¥¹QÙA±…¸é¡½µ•5…¥¹QØ˜™¥ÍM•ÁÑ•µ‰•ÉA½±¥åÑ¥Ù”¡µ½¹Ñ ¤ı¡½µ•5…¥¹QÙA±…¹1…‰•°¡¡½µ•5…¥¹QÙA±…¸±¡½µ•9•Ñİ½É­QåÁ”¤é¹Õ±°°(€€€€€€€€€€€µ…¥¹QÙA±…¹1•Ù•°é¡½µ•5…¥¹QØı¡½µ•5…¥¹QÙA±…¸é¹Õ±°°(€€€€€€€€€€€µ½‰¥±•M¥µÕ°é¡½µ•5½‰¥±•M¥µÕ±ñğ¹½¹”œ±Õ¹¥™¥•‘!½µ”éÑÉÕ”±‘¥É•Ñ½µÁ±•Ñ”é¡½µ•¥É•Ñ½µÁ±•Ñ”°(€€€€€€€€€€€Í¥µÕ±	…Í”é¡½µ•%¹Ñ•É¹•Ğü¡½µ”œè …¡½µ•%¹Ñ•É¹•Ğ˜™¡½µ•Mµ…ÉÑ!½µ”üÍµ…ÉÑ!½µ”œé¹Õ±°¤±Ñ•…µ=¹±äé…Ñ¥Ù•Q•…µMÕÁÁ½ÉĞ±É•‘¥Ñ•‘MÑ½É”é…Ñ¥Ù•Q•…µMÕÁÁ½ÉĞıÑ•…µMÕÁÁ½ÉÑMÑ½É”é¹Õ±°(€€€€€€€€€ô¤(€€€€€ô¤¤ì((€€€€€€¼¼ƒ¶f ƒ²V÷²7²v ƒ®ª£®ÂS²vğƒ¶s¶R3®šüƒ²^²vĞƒ²²‚Dƒ²zG²Ç®0ƒ²‚²z”(€€€€€½¹ÍĞ¡½µ•AÉ½µ¥Í•I½İÌõmíÑ¥Ñ±”é¡½µ•ÕÍÑ½µQ¥Ñ±”±‘Õ•…Ñ”é¡½µ•ÕÍÑ½µÕ•…Ñ•ô°¸¸¸¡¡½µ•áÑÉ…AÉ½µ¥Í•Íññmt¥t¹™¥±Ñ•È¡àôùMÑÉ¥¹œ¡à¹Ñ¥Ñ±•ñğœœ¤¹ÑÉ¥´ ¤˜™à¹‘Õ•…Ñ”¤ì(€€€€€½¹ÍĞÑ…Í­I½İÌõ¡½µ•AÉ½µ¥Í•I½İÌ¹µ…À¡àôø¡ì(€€€€€€€€€ÕÍ•É}¥éÕÉÉ•¹ÑµÀ¹¥±ÕÍÑ½µ•É}¥é±¥¹­•‘ÕÍÑ½µ•É%±Í½ÕÉ•}Í…±•}¥éÁÉ¥µ…ÉåM…±•%±Ñ…Í­}ÑåÁ”èÕÍÑ½´œ±Ñ¥Ñ±”éMÑÉ¥¹œ¡à¹Ñ¥Ñ±”¤¹ÑÉ¥´ ¤±‰…Í•}‘…Ñ”éÍ½ÕÉ•]½É­…Ñ”±‘Õ•}‘…Ñ”éà¹‘Õ•…Ñ”±ÍÑ…ÑÕÌèÁ•¹‘¥¹œœ±Ñ…Í­}µ•Ñ„éíô(€€€€€ô¤¤ì((€€€€€±•ĞÍÁ½Ñ±…¥µI½Üõ¹Õ±°ì(€€€€€¥˜¡¡½µ•MÁ½ÑA½±¥å%¥ì(€€€€€€€ÍÁ½Ñ±…¥µI½ÜõíÁ½±¥å}¥é¡½µ•MÁ½ÑA½±¥å%±ÕÍ•É}¥éÕÉÉ•¹ÑµÀ¹¥±±…¥µ}‘…Ñ”éÍ½ÕÉ•]½É­…Ñ”±ÕÍÑ½µ•É}¹…µ”éÕÍÑ½µ•È±ÍÑ…ÑÕÌèÁ•¹‘¥¹œœ±Í½ÕÉ•}½¹Ñ•áĞè¡½µ”ôì(€€€€€ô•±Í”¥˜ …¥ÍM•ÁÑ•µ‰•ÉA½±¥åÑ¥Ù”¡µ½¹Ñ ¤˜™¡½µ•MÁ½Ñ¥É•Ñ=Á•¸˜™¡½µ•MÁ½Ñ¥É•ÑQ¥Ñ±”¹ÑÉ¥´ ¤˜™9Õµ‰•È¡¡½µ•MÁ½Ñ¥É•Ñµ½Õ¹Ğ¤øÀ¥ì(€€€€€€€ÍÁ½Ñ±…¥µI½ÜõíÁ½±¥å}¥é¹Õ±°±ÕÍ•É}¥éÕÉÉ•¹ÑµÀ¹¥±±…¥µ}‘…Ñ”éÍ½ÕÉ•]½É­…Ñ”±ÕÍÑ½µ•É}¹…µ”éÕÍÑ½µ•È±ÍÑ…ÑÕÌèÁ•¹‘¥¹œœ±‘¥É•Ñ}Ñ¥Ñ±”é¡½µ•MÁ½Ñ¥É•ÑQ¥Ñ±”¹ÑÉ¥´ ¤±‘¥É•Ñ}…µ½Õ¹Ğé9Õµ‰•È¡¡½µ•MÁ½Ñ¥É•Ñµ½Õ¹Ğ¤±‘¥É•Ñ}µ•µ¼é¡½µ•MÁ½Ñ¥É•Ñ5•µ¼¹ÑÉ¥´ ¥ññ¹Õ±°±Í½ÕÉ•}½¹Ñ•áĞè¡½µ”ôì(€€€€€ô(€€€€€½¹ÍĞ•áÁ•¹Í•I½İÌõ¡½µ•áÁ•¹Í•=Á•¸ımí…Ñ•½Éäé¡½µ•áÁ•¹Í•…Ñ•½Éä±…µ½Õ¹Ğé¡½µ•áÁ•¹Í•µ½Õ¹Ğ±µ•µ¼é¡½µ•áÁ•¹Í•5•µ½ô°¸¸¸¡¡½µ•áÑÉ…áÁ•¹Í•Íññmt¥t¹™¥±Ñ•È¡àôù9Õµ‰•È¡à¹…µ½Õ¹Ğ¤øÀ¤¹µ…À¡àôø¡íÕÍ•É}¥éÕÉÉ•¹ÑµÀ¹¥±Í½ÕÉ•}Í…±•}¥éÁÉ¥µ…ÉåM…±•%±•áÁ•¹Í•}‘…Ñ”éÍ½ÕÉ•]½É­…Ñ”±…µ½Õ¹Ğé9Õµ‰•È¡à¹…µ½Õ¹Ğ¤±…Ñ•½Éäéà¹…Ñ•½ÉåñğŸªâÃ¶ œ±ÕÍÑ½µ•É}¹…µ”éÕÍÑ½µ•È±µ•µ¼éMÑÉ¥¹œ¡à¹µ•µ½ñğœœ¤¹ÑÉ¥´ ¥ññ¹Õ±±ô¤¤émtì((€€€€€¥˜ ……Ñ¥Ù•Q•…µMÕÁÁ½ÉĞ˜™¡½µ•¥É•Ñ½µÁ±•Ñ”¥ì(€€€€€€€½¹ÍĞ‰…Í”õİ½É­¥¹…äì½¹ÍĞÉ½ÕÁÌõì¸¸¹‰…Í”¹É½ÕÁÍôì(€€€€€€€ÁÉ½‘ÕÑÌ¹™½É… ¡ÁÉ½‘ÕĞôùìÉ½ÕÁÍmÁÉ½‘ÕĞ¹É½ÕÁ-•åtõì¸¸¸¡É½ÕÁÍmÁÉ½‘ÕĞ¹É½ÕÁ-•åuññíô¤±mÁÉ½‘ÕĞ¹¥Ñ•µ-•åté9Õµ‰•È¡É½ÕÁÍmÁÉ½‘ÕĞ¹É½ÕÁ-•åtü¹mÁÉ½‘ÕĞ¹¥Ñ•µ-•åuñğÀ¤¬Åôìô¤ì(€€€€€€€İ½É­¥¹…äõì¸¸¹‰…Í”±É½ÕÁÍôì(€€€€€ô(€€€€€½¹ÍĞÍ¡½Õ±‘M…Ù•…¥±äô……Ñ¥Ù•Q•…µMÕÁÁ½ÉĞ˜˜¡¡½µ•=É‘•ÉÉ…™Ğü¹±•…å½¹Ù•ÉÍ¥½¹ññ¡½µ•=É‘•ÉÉ…™Ğü¹•‘¥Ñ¥¹ññ¡½µ•¥É•Ñ½µÁ±•Ñ”¤ì(€€€€€½¹ÍĞÑ•…µÉ•‘¥ÑI½Üõ…Ñ¥Ù•Q•…µMÕÁÁ½ÉĞıíÍ•±±•É}¥é…ÕÑ¡UÍ•È¹¥±É•‘¥Ñ•‘}ÍÑ½É”éÑ•…µMÕÁÁ½ÉÑMÑ½É”±Í…±•}‘…Ñ”éÍ½ÕÉ•]½É­…Ñ”±Í½ÕÉ•}ÑåÁ”è¡½µ”œ±Í½ÕÉ•}Í…±•}¥éÁÉ¥µ…ÉåM…±•%±Í½ÕÉ•}É•™Ìémt±µ•ÑÉ¥Ìé¡½µ•Q•…µÉ•‘¥Ñ5•ÑÉ¥Ì¡ÁÉ½‘ÕÑÌ¤±¥Í}½µÁ±•Ñ•é¡½µ•¥É•Ñ½µÁ±•Ñ”±¹½Ñ”é€‘í±½¥¹µÀü¹¹…µ•ñğŸ®.Ó®.äôƒ²²n@ƒ¶2C®‘ôé¹Õ±°ì(€€€€€½¹ÍĞí‘…Ñ„é…Ñ½µ¥I•ÍÕ±Ğ±•ÉÉ½Èé…Ñ½µ¥ÉÉ½Éôõ…İ…¥ĞÍÕÁ…‰…Í”¹ÉÁŒ Í…Ù•}¡½µ•}‰Õ¹‘±•}…Ñ½µ¥Œœ±ì(€€€€€€€Á}ÕÍ•É}¥éÕÉÉ•¹ÑµÀ¹¥±Á}½É‘•ÉÌé½É‘•ÉI½İÌ±Á}Í…±•ÌéÍ…±•I½İÌ±Á}Ñ…Í­ÌéÑ…Í­I½İÌ±Á}•áÁ•¹Í•Ìé•áÁ•¹Í•I½İÌ°(€€€€€€€Á}ÍÁ½Ñ}±…¥´éÍÁ½Ñ±…¥µI½Ü±Á}Ñ•…µ}É•‘¥ĞéÑ•…µÉ•‘¥ÑI½Ü±Á}É•Á±…•}Í…±•}¥‘ÌéÉ•Á±…•‘M…±•%‘Ì°(€€€€€€€Á}É•Á±…•}½É‘•É}¥‘ÌéÉ•Á±…•‘=É‘•É%‘Ì±Á}‘…¥±å}É•½ÉéÍ¡½Õ±‘M…Ù•…¥±äıİ½É­¥¹…äé¹Õ±°±Á}İ½É­}‘…Ñ”éÍ¡½Õ±‘M…Ù•…¥±äıÍ½ÕÉ•]½É­…Ñ”é¹Õ±°(€€€€€ô¤ì(€€€€€¥˜¡…Ñ½µ¥ÉÉ½È¥Ñ¡É½Ü…Ñ½µ¥ÉÉ½Èì(€€€€€¥˜¡9Õµ‰•È¡…Ñ½µ¥I•ÍÕ±Ğü¹½É‘•É}½Õ¹Ğ¤„ôõÁÉ½‘ÕÑÌ¹±•¹Ñ¡ññ9Õµ‰•È¡…Ñ½µ¥I•ÍÕ±Ğü¹Í…±•}½Õ¹Ğ¤„ôõÁÉ½‘ÕÑÌ¹±•¹Ñ ¥Ñ¡É½Ü¹•ÜÉÉ½È Ÿ¶f ƒ²‚²z”ƒªÊÃªÎó®–ğƒ¶fW²vã¶Vc² ƒ®ªï¶Z#²ZÓ²jP¸œ¤ì(€€€€€¥˜¡Í¡½Õ±‘M…Ù•…¥±ä¥µÕÑ…Ñ”¡İ½É­¥¹…ä¤ì(€€€€€¥˜¡…Ñ¥Ù•Q•…µMÕÁÁ½ÉĞ¥…İ…¥Ğ½¹Q•…µÉ•‘¥ÑM…Ù•ü¸ ¤ì((€€€€€¹½Ñ¥™åMÑ½É•5…¹…•ÉÌ¡í…Ñ½É%éÕÉÉ•¹ÑµÀ¹¥±ÑåÁ”é¡½µ•¥É•Ñ½µÁ±•Ñ”ü¡½µ•}½µÁ±•Ñ•œè¡½µ•}½É‘•Èœ±Ñ¥Ñ±”é¡½µ•¥É•Ñ½µÁ±•Ñ”üŸ¶f ƒ²“²æ`¿ªÂs¶Ôƒ²f®0œèŸ² ƒ¶f ƒ²Ê·²Vôƒ®NÇ®†tœ±µ•ÍÍ…”é€‘íÕÍÑ½µ•Éôƒ
Ü€‘í¡½µ•9•Ñİ½É­1…‰•°¡¡½µ•9•Ñİ½É­QåÁ”¥ôƒ
Ü€‘íÁÉ½‘ÕÑÌ¹µ…À¡ÀôùÀ¹±…‰•°¤¹©½¥¸ œ€¬€œ¥õ€±ÍÑ½É•9…µ”é…Ñ¥Ù•Q•…µMÕÁÁ½ÉĞıÑ•…µMÕÁÁ½ÉÑMÑ½É”é¹Õ±°±Á…å±½…éí•µÁ±½å••}¥éÕÉÉ•¹ÑµÀ¹¥±ÕÍÑ½µ•É}¹…µ”éÕÍÑ½µ•È±ÍÑ½É•}¹…µ”é…Ñ¥Ù•Q•…µMÕÁÁ½ÉĞıÑ•…µMÕÁÁ½ÉÑMÑ½É”éÕÉÉ•¹ÑµÀ¹‰É…¹ ±Ñ•…µ}½¹±äé…Ñ¥Ù•Q•…µMÕÁÁ½ÉĞ±¹•Ñİ½É­}ÑåÁ”é¡½µ•9•Ñİ½É­QåÁ”±¥¹Ñ•É¹•Ñ}ÍÁ••é¡½µ•%¹Ñ•É¹•ÑMÁ••‘ññ¹Õ±°±µ½‰¥±•}Í¥µÕ°é¡½µ•5½‰¥±•M¥µÕ±ñğ¹½¹”œ±ÍÑ…ÑÕÌé¡½µ•¥É•Ñ½µÁ±•Ñ”ü½µÁ±•Ñ•œèÁ•¹‘¥¹œœ±Í½ÕÉ•}İ½É­}‘…Ñ”éÍ½ÕÉ•]½É­…Ñ•õô¤ì(€€€€€½¹ÍĞÉ•ÍÕ±Ñ%õ¡½µ”´‘í…Ñ”¹¹½Ü ¥õ€ì(€€€€€Í•ÑQ½…ÍĞ¡í¥éÉ•ÍÕ±Ñ%±Í½ÕÉ”è¡½µ”œ±­¥¹è¹½Éµ…°œ±ÕÍÑ½µ•É9…µ”éÕÍÑ½µ•È±±…‰•°éÁÉ½‘ÕÑÌ¹µ…À¡ÀôùÀ¹±…‰•°¤¹©½¥¸ œ€¬€œ¤±Ñ¥Ñ±”é…Ñ¥Ù•Q•…µMÕÁÁ½ÉĞüŸ²²n@ƒ¶f ƒ¶2C®ƒ®NÇ®†tƒ²f®0œèŸ¶f ƒ¶2C®ƒ®NÇ®†tƒ²f®0œ±ÍÕˆé…Ñ¥Ù•Q•…µMÕÁÁ½ÉĞı€‘í‘¥ÍÁ±…åMÑ½É•9…µ”¡Ñ•…µMÕÁÁ½ÉÑMÑ½É”¥ôƒ¶2 ƒ².“²‚ƒ²‚²j¤‘í¡½µ•¥É•Ñ½µÁ±•Ñ”üŸ²ró®†pƒ®Âc²b¶Z#²ZÓ²jPœèœƒ
Üƒ²“²æc²f®0ƒ¶nƒ®Âc²b®>ó²jPõ€è¡¡½µ•¥É•Ñ½µÁ±•Ñ”üŸ²“²æc²f®0ƒ².“²‚²ró®†pƒ®Âc²b¶Z#²ZÓ²jPœèŸ²“²æc®2ªâÃ®†pƒ®NÇ®†w¶Z#²ZÓ²jPœ¤±ÁÉ½µ¥Í•½Õ¹Ğé¡½µ•AÉ½µ¥Í•I½İÌ¹±•¹Ñ ±ÕÍÑ½µ•ÉM…±•%éÁÉ¥µ…ÉåM…±•%±Á½¥¹Ñ•±Ñ„èÀ±Ñ•…µ=¹±äé…Ñ¥Ù•Q•…µMÕÁÁ½ÉÑô¤ì(€€€€€¥˜¡…Ñ¥Ù•Q•…µMÕÁÁ½ÉĞ¥É•Í•ÑQ•…µMÕÁÁ½ÉÑM•±•Ñ¥½¸ ¤ì(€€€€€Í•ÑQ¥µ•½ÕĞ  ¤ôùÍ•ÑQ½…ÍĞ¡ĞôùĞü¹¥ôôõÉ•ÍÕ±Ñ%ı¹Õ±°éĞ¤°ÄÀÀÀÀ¤ì(€€€€€Í•Ñ!½µ•=É‘•ÉÉ…™Ğ¡¹Õ±°¤ìÍ•Ñ‘¥Ñ¥¹!½µ•M…±•Ì¡mt¤ìÍ•Ñ1•…å½¹Ù•ÉÍ¥½¸¡¹Õ±°¤ìÍ•Ñ!½µ•ÕÍÑ½µ•É9…µ” œœ¤ìÍ•Ñ!½µ•9•Ñİ½É­QåÁ” œœ¤ìÍ•Ñ!½µ•%¹Ñ•É¹•ÑMÁ•• œœ¤ìÍ•Ñ!½µ•5½‰¥±•M¥µÕ° ¹½¹”œ¤ì(€€€€€…İ…¥Ğ½¹!½µ•=É‘•ÉÍ¡…¹•ü¸ ¤ì(€€€€€Í•ÑQ¥µ•½ÕĞ¡±½…‘…åM…±•Ì°ÄÔÀ¤ì(€€€õ…Ñ ¡”¥ìÍ¡½İÁÁQ½…ÍĞ¡™É¥•¹‘±åÉÉ½È¡”¤±íÑ½¹”è•ÉÉ½Èœ±Ñ¥Ñ±”èŸ¶f ƒ²¶J ƒ®NÇ®†tƒ².“¶2 ô¤ìô(€€€™¥¹…±±åì¡½µ•MÕ‰µ¥ÑÕ…É‘I•˜¹ÕÉÉ•¹Ğõ™…±Í”ìÍ•Ñ!½µ•=É‘•ÉM…Ù¥¹œ¡™…±Í”¤ìô(€ôì((€½¹ÍĞÍÕ‰µ¥ÑáÑÉ…%¹ÁÕĞõ…Íå¹Œ ¤ôùì(€€€¥˜ …•áÑÉ…%¹ÁÕÑññ±½­•¥É•ÑÕÉ¸ì(€€€¥˜¡…Ñ¥Ù•Q•…µMÕÁÁ½ÉĞ¥É•ÑÕÉ¸Í¡½İÁÁQ½…ÍĞ Ÿ²²n@ƒ¶2C®“®*Pƒ®ª£®ÂS²vó
ß¶f ƒ¶2C®“²^C²pƒ®NÇ®†w¶VÓ²ó²ã²jP¸œ±íÑ½¹”è¥¹™¼ô¤ì(€€€½¹ÍĞ‰…Í”õ¹½Éµ…±¥é•…ä¡‘…ä¤ì½¹ÍĞ½Õ¹Ğõ5…Ñ ¹µ…à Ä±9Õµ‰•È¡•áÑÉ…½Õ¹ÑñğÄ¤¤ì(€€€¥˜¡•áÑÉ…%¹ÁÕĞôôôÍ½¹¼œ¥ì(€€€€€½¹ÍĞÉ½ÕÁÌõì¸¸¹‰…Í”¹É½ÕÁÌ±Í½¹¼éì¸¸¸¡‰…Í”¹É½ÕÁÌü¹Í½¹½ññíô¥õôìÉ½ÕÁÌ¹Í½¹½m•áÑÉ…M½¹½-•åtõ9Õµ‰•È¡É½ÕÁÌ¹Í½¹½m•áÑÉ…M½¹½-•åuñğÀ¤­½Õ¹ĞìµÕÑ…Ñ”¡ì¸¸¹‰…Í”±É½ÕÁÍô¤ì(€€€ô•±Í”¥˜¡•áÑÉ…%¹ÁÕĞôôôÑ…¥±½É•œ¤µÕÑ…Ñ”¡ì¸¸¹‰…Í”±Ñ…¥±½É•‘½Õ¹Ğé9Õµ‰•È¡‰…Í”¹Ñ…¥±½É•‘½Õ¹ÑñğÀ¤­½Õ¹Ğ±Ñ…¥±½É•‘µ½Õ¹Ğé9Õµ‰•È¡‰…Í”¹Ñ…¥±½É•‘µ½Õ¹ÑñğÀ¤­9Õµ‰•È¡•áÑÉ…µ½Õ¹ÑñğÀ¥ô¤ì(€€€•±Í”¥˜¡•áÑÉ…%¹ÁÕĞôôôÕÍÑ½µ•ÉI•œœ¤µÕÑ…Ñ”¡ì¸¸¹‰…Í”±ÕÍÑI•½Õ¹Ğé9Õµ‰•È¡‰…Í”¹ÕÍÑI•½Õ¹ÑñğÀ¤­½Õ¹Ñô¤ì(€€€¥˜¡•áÑÉ…ÕÍÑ½µ•È¹ÑÉ¥´ ¤¥ì(€€€€€ÑÉåí½¹ÍĞ¥õ…İ…¥Ğ•¹ÍÕÉ•ÕÍÑ½µ•È¡ÕÉÉ•¹ÑµÀ¹¥±•áÑÉ…ÕÍÑ½µ•È¹ÑÉ¥´ ¤±€‘íµ½¹Ñ¡ô´‘íÍ•±•Ñ•‘…åõ€¤í…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ ÕÍÑ½µ•É}Í…±•Ìœ¤¹¥¹Í•ÉĞ¡íÕÍ•É}¥éÕÉÉ•¹ÑµÀ¹¥±ÕÍÑ½µ•É}¥é¥±Í…±•}‘…Ñ”é€‘íµ½¹Ñ¡ô´‘íÍ•±•Ñ•‘…åõ€±µ•ÑÉ¥}±…‰•°é•áÑÉ…%¹ÁÕĞôôôÍ½¹¼œü¡½¹™¥œ¹Í½¹½ññU1Q}M=9<¤¹™¥¹¡àôùà¹­•äôôõ•áÑÉ…M½¹½-•ä¤ü¹±…‰•±ñğŸ²3®àœé•áÑÉ…%¹ÁÕĞôôôÑ…¥±½É•œıƒ®{²Ú“²‚s²V €‘í½Õ¹Ñ÷ªÆĞƒ
Ü€‘íİ½¸¡9Õµ‰•È¡•áÑÉ…µ½Õ¹ÑñğÀ¤¥õ€éƒªÎƒªÂw®NÇ®†t€‘í½Õ¹Ñ÷ªÆÑ€±Í½ÕÉ•}ÑåÁ”è•áÑÉ„œ±Í¡•µ…}Ù•ÉÍ¥½¸éUII9Q}M1}M!5}YIM%=8±Í½ÕÉ•}µ•Ñ„éİ¥Ñ¡ÕÉÉ•¹ÑM…±•M¡•µ„¡í•áÑÉ…QåÁ”é•áÑÉ…%¹ÁÕĞ±½Õ¹Ğ±…µ½Õ¹Ğé9Õµ‰•È¡•áÑÉ…µ½Õ¹ÑñğÀ¤±Í½¹½-•äé•áÑÉ…M½¹½-•åô¥ô¤íõ…Ñ ¡”¥í½¹Í½±”¹•ÉÉ½È¡”¥ô(€€€ô(€€€Í•ÑáÑÉ…%¹ÁÕĞ¡¹Õ±°¤íÍ•ÑáÑÉ…ÕÍÑ½µ•È œœ¤íÍ•ÑáÑÉ…½Õ¹Ğ œÄœ¤íÍ•ÑáÑÉ…µ½Õ¹Ğ œœ¤íÍ•ÑQ¥µ•½ÕĞ¡±½…‘…åM…±•Ì°ÄÀÀ¤ì(€ôì((€½¹ÍĞÍ•±•Ñ…ä€ô€¡­•ä¤€ôøì™±ÕÍ  ¤ìÍ•ÑM•±•Ñ•‘…ä¡­•ä¤ìôì((€½¹ÍĞ	-}5MML€ôl(€€€ìÑ¥Ñ±”è€Ÿ²b“®*c®>ƒ².“²‚ƒ¶Vpƒ²*“¶Fğ„œ°ÍÕˆè€ŸªÎƒ²w¶Z#²ZÓ²jPƒÂ~b(œô°(€€€ìÑ¥Ñ±”è€Ÿ²Š/²V²jP„ƒ²b“®*c®>ƒ¶Vc®
`ƒ²2O²b²ZÓ²jPœ°ÍÕˆè€Ÿ²Â£ªÎ‡²Â£ªÎ„ƒªÂªÎ€ƒ²z#²ZÓ²jPƒÂ~f0œô°(€€€ìÑ¥Ñ±”è€Ÿ²Â£ªÎ‡²Â£ªÎ„ƒ²2O²vÓ®*Pƒ²’G²vÓ²^C²jPœ°ÍÕˆè€Ÿ²b“®*c®>ƒ¶VpƒªÆã²v0ƒ²‚²ƒŠr œô°(€€€ìÑ¥Ñ±”è€Ÿ²b“®*c²v`ƒ².“²‚€¬Ä„œ°ÍÕˆè€Ÿ²"cªÎƒ¶Z#²ZÓ²jPƒÂ~F4œô°(€€€ìÑ¥Ñ±”è€Ÿ²Š/²v ƒ¶vC®š²vÓ²^C²jPœ°ÍÕˆè€Ÿ¶Vc®
`ƒ®6Pƒ²2O²b²*×®.#®.ƒÂ~R”œô°(€tì((€½¹ÍĞ½µµ¥Ñ5½‰¥±•=¹”€ô€¡É¤°¤°ÕÍÑ½µ•É5•Ñ„€ôíô¤€ôøì(€€€¥˜€¡±½­•¤É•ÑÕÉ¸ì((€€€½¹ÍĞ‰•™½É•…ä€ô¹½Éµ…±¥é•…ä¡ÕÍÑ½µ•É5•Ñ„¹‰…Í•…å=Ù•ÉÉ¥‘”ñğ‘…ä¤ì(€€€½¹ÍĞ¹•áÑ5…ÑÉ¥à€ô‰•™½É•…ä¹µ…ÑÉ¥à¹µ…À ¡É½Ü¤€ôøl¸¸¹É½İt¤ì(€€€¹•áÑ5…ÑÉ¥ámÉ¥um¥t€ô€¡¹•áÑ5…ÑÉ¥ámÉ¥um¥tñğ€À¤€¬€Äì(€€€½¹ÍĞÙ…Í-•åÌ€ôÉÉ…ä¹¥ÍÉÉ…ä¡ÕÍÑ½µ•É5•Ñ„¹Ù…Í-•åÌ¤€üÕÍÑ½µ•É5•Ñ„¹Ù…Í-•åÌ€èmtì(€€€½¹ÍĞ¹•áÑY…Ì€ôì€¸¸¸¡‰•™½É•…ä¹É½ÕÁÌü¹Ù…Ìñğíô¤ôì(€€€Ù…Í-•åÌ¹™½É…  ¡­•ä¤€ôøì(€€€€€¥˜€¡­•ä€„ôô€Ù…Í9½¹”œ¤¹•áÑY…Ím­•åt€ô9Õµ‰•È¡¹•áÑY…Ím­•åtñğ€À¤€¬€Äì(€€€ô¤ì(€€€½¹ÍĞ¹•áÑ	Õ¹‘±”É¹€ôì€¸¸¸¡‰•™½É•…ä¹É½ÕÁÌü¹‰Õ¹‘±”É¹ñğíô¤ôì(€€€€¡ÕÍÑ½µ•É5•Ñ„¹‰Õ¹‘±”É¹‘-•åÌñğmt¤¹™½É…  ¡­•ä¤€ôøì¹•áÑ	Õ¹‘±”É¹‘m­•åt€ô9Õµ‰•È¡¹•áÑ	Õ¹‘±”É¹‘m­•åtñğ€À¤€¬€Äìô¤ì(€€€½¹ÍĞ¹•áÑ5¹Á	Õ¹‘±”€ôì€¸¸¸¡‰•™½É•…ä¹É½ÕÁÌü¹µ¹Á	Õ¹‘±”ñğíô¤ôì(€€€¥˜€¡ÕÍÑ½µ•É5•Ñ„¹ÕÍ•‘5¹Á	Õ¹‘±”¤¹•áÑ5¹Á	Õ¹‘±”¹ÕÍ•‘5¹Á	Õ¹‘±”€ô9Õµ‰•È¡¹•áÑ5¹Á	Õ¹‘±”¹ÕÍ•‘5¹Á	Õ¹‘±”ñğ€À¤€¬€Äì((€€€½¹ÍĞ¹•áÑ…ä€ôì(€€€€€€¸¸¹‰•™½É•…ä°(€€€€€ÍÁ•¥…±5…ÑÉ¥á=™™Í•Ğè9Õµ‰•È¡‰•™½É•…ä¹ÍÁ•¥…±5…ÑÉ¥á=™™Í•ÑñğÀ¤­9Õµ‰•È¡ÕÍÑ½µ•É5•Ñ„¹ÍÁ•¥…±5…ÑÉ¥á=™™Í•ÑñğÀ¤°(€€€€€ÍÁ•¥…±Y…Í=™™Í•Ğè9Õµ‰•È¡‰•™½É•…ä¹ÍÁ•¥…±Y…Í=™™Í•ÑñğÀ¤­9Õµ‰•È¡ÕÍÑ½µ•É5•Ñ„¹ÍÁ•¥…±Y…Í=™™Í•ÑñğÀ¤°(€€€€€ÍÁ•¥…±I•Á±…•µ•¹ÑA…äè9Õµ‰•È¡‰•™½É•…ä¹ÍÁ•¥…±I•Á±…•µ•¹ÑA…åñğÀ¤­9Õµ‰•È¡ÕÍÑ½µ•É5•Ñ„¹ÍÁ•¥…±I•Á±…•µ•¹ÑA…åñğÀ¤°(€€€€€‰Õ¹‘±•É••=™™Í•Ğè9Õµ‰•È¡‰•™½É•…ä¹‰Õ¹‘±•É••=™™Í•ÑñğÀ¤­9Õµ‰•È¡ÕÍÑ½µ•É5•Ñ„¹‰Õ¹‘±•É••=™™Í•ÑñğÀ¤°(€€€€€‰Õ¹‘±•É••Y…Í=™™Í•Ğè9Õµ‰•È¡‰•™½É•…ä¹‰Õ¹‘±•É••Y…Í=™™Í•ÑñğÀ¤­9Õµ‰•È¡ÕÍÑ½µ•É5•Ñ„¹‰Õ¹‘±•É••Y…Í=™™Í•ÑñğÀ¤°(€€€€€µ…ÑÉ¥àè¹•áÑ5…ÑÉ¥à°(€€€€€É½ÕÁÌèì(€€€€€€€€¸¸¹‰•™½É•…ä¹É½ÕÁÌ°(€€€€€€€Ù…Ìè¹•áÑY…Ì°(€€€€€€€‰Õ¹‘±”É¹è¹•áÑ	Õ¹‘±”É¹°(€€€€€€€µ¹Á	Õ¹‘±”è¹•áÑ5¹Á	Õ¹‘±”°(€€€€€ô°(€€€ôì((€€€€¼¼ƒ¶b²z°ƒ®.°ƒ²‚²ÊĞƒ².“²‚²vƒ®NÇ®†tƒ²²‚¿²¶n®†pƒªÂªÂƒªÎ²
À(€€€½¹ÍĞ‰•™½É•…åÌ€ôì€¸¸¹‘…¥±å…åÌ°mÍ•±•Ñ•‘…åtè‰•™½É•…äôì(€€€½¹ÍĞ…™Ñ•É…åÌ€ôì€¸¸¹‘…¥±å…åÌ°mÍ•±•Ñ•‘…åtè¹•áÑ…äôì((€€€½¹ÍĞ‰•™½É•É…™Ğ€ô…ÁÁ±å…¥±åQ½É…™Ğ (€€€€€‘É…™Ğ°(€€€€€‰•™½É•…åÌ°(€€€€€µ½¹Ñ °(€€€€€½¹™¥œ¹…Ñ•½Éå5…À°(€€€€€½¹™¥œ¹¥‰å•½¹½±Õµ¹5…À(€€€€¤ì(€€€½¹ÍĞ…™Ñ•ÉÉ…™Ğ€ô…ÁÁ±å…¥±åQ½É…™Ğ (€€€€€‘É…™Ğ°(€€€€€…™Ñ•É…åÌ°(€€€€€µ½¹Ñ °(€€€€€½¹™¥œ¹…Ñ•½Éå5…À°(€€€€€½¹™¥œ¹¥‰å•½¹½±Õµ¹5…À(€€€€¤ì((€€€½¹ÍĞÁ½Í¥Ñ¥½¸€ôÕÉÉ•¹ÑµÀü¹Á½Í¥Ñ¥½¸ñğ€Ÿ²
³²n@œì(€€€½¹ÍĞ¡¥É•…Ñ”€ôÕÉÉ•¹ÑµÀü¹¡¥É•…Ñ”ì((€€€½¹ÍĞ‰•™½É•A…ä€ô½µÁÕÑ•A…ä¡‰•™½É•É…™Ğ°Á½Í¥Ñ¥½¸°¡¥É•…Ñ”°µ½¹Ñ °½¹™¥œ¤ì(€€€½¹ÍĞ…™Ñ•ÉA…ä€ô½µÁÕÑ•A…ä¡…™Ñ•ÉÉ…™Ğ°Á½Í¥Ñ¥½¸°¡¥É•…Ñ”°µ½¹Ñ °½¹™¥œ¤ì(€€€€¼¼ƒ²‚²z”ƒ¶Ró®Ns®ÂÇ²v ƒ²Ös²‚®ÎÓ²z—ªÎğƒ®æªÖC¶Vpƒ®#ªÂ@ƒ²b#²²V‡²vĞƒ²V®.#®vğ°(€€€€¼¼ƒ²vÓ®Ê ƒ¶2C®“®†pƒ².“²‚pƒ®"²‚®Bpƒ¶2C®ƒ²vã²ó¶.Ã®â3
ß¶fs®>g²²nCªâ#
ß®NÇªâ$ƒ®ÎÓ®#²*“²v`ƒ²šwªÂ®Ú²vƒ®ÎÓ²^³²’7®.#®.¸(€€€½¹ÍĞÁ…å•±Ñ„€ô5…Ñ ¹µ…à À°9Õµ‰•È¡…™Ñ•ÉA…ä¹ÕÉÉ•¹ÑA•É™½Éµ…¹•µ½Õ¹ÑñğÀ¤€´9Õµ‰•È¡‰•™½É•A…ä¹ÕÉÉ•¹ÑA•É™½Éµ…¹•µ½Õ¹ÑñğÀ¤¤ì(€€€½¹ÍĞÍ…±•A…å•±Ñ„€ô5…Ñ ¹µ…à À°(€€€€€9Õµ‰•È¡…™Ñ•ÉA…ä¹µ½‰¥±•5…ÑÉ¥áA…åñğÀ¤µ9Õµ‰•È¡‰•™½É•A…ä¹µ½‰¥±•5…ÑÉ¥áA…åñğÀ¤(€€€€€€¬9Õµ‰•È¡…™Ñ•ÉA…ä¹Ù…ÍA…åñğÀ¤µ9Õµ‰•È¡‰•™½É•A…ä¹Ù…ÍA…åñğÀ¤(€€€€€€¬9Õµ‰•È¡…™Ñ•ÉA…ä¹ÍÁ•¥…±I•Á±…•µ•¹ÑA…åñğÀ¤µ9Õµ‰•È¡‰•™½É•A…ä¹ÍÁ•¥…±I•Á±…•µ•¹ÑA…åñğÀ¤(€€€€€€¬9Õµ‰•È¡…™Ñ•ÉA…ä¹µ¹Á	Õ¹‘±•A…åñğÀ¤µ9Õµ‰•È¡‰•™½É•A…ä¹µ¹Á	Õ¹‘±•A…åñğÀ¤(€€€€¤ì(€€€½¹ÍĞ…Ñ¥Ù¥ÑåA…å•±Ñ„€ô5…Ñ ¹µ…à À±9Õµ‰•È¡…™Ñ•ÉA…ä¹Ñ•¹ÕÉ•A…åñğÀ¤µ9Õµ‰•È¡‰•™½É•A…ä¹Ñ•¹ÕÉ•A…åñğÀ¤¤ì(€€€½¹ÍĞ‰½¹ÕÍA…å•±Ñ„€ô5…Ñ ¹µ…à À±Á…å•±Ñ„µÍ…±•A…å•±Ñ„µ…Ñ¥Ù¥ÑåA…å•±Ñ„¤ì((€€€½¹ÍĞÉ½İ•˜€ô5QI%a}I=]}MmÉ¥tì(€€€½¹ÍĞ±…‰•°€ôÉ½İ•˜¹¡…ÍQ¥•ÉÌ(€€€€€€ü€‘íÉ½İ•˜¹‘…¥±å1…‰•°ñğÉ½İ•˜¹±…‰•±ôƒ
Ü€‘í5QI%a}=1Mm¥uõ€(€€€€€€è€¡É½İ•˜¹‘…¥±å1…‰•°ñğÉ½İ•˜¹±…‰•°¤ì((€€€€¼¼ƒ²vÓ®Ê ƒ¶VpƒªÆÓ²ró®†pƒ².“²‚pƒ®ª§¶Fs®–ğƒ®c²^#®*S² ƒ¶fW²và(€€€½¹ÍĞÉ…‘•UÀ€ô‰•™½É•A…ä¹É…‘”€„ôô…™Ñ•ÉA…ä¹É…‘”€˜˜…™Ñ•ÉA…ä¹É…‘•±¥¥‰±”ì(€€€½¹ÍĞ¡½µ•…Ñ•¡¥•Ù•€ô€…‰•™½É•A…ä¹É…‘•±¥¥‰±”€˜˜…™Ñ•ÉA…ä¹É…‘•±¥¥‰±”ì((€€€±•Ğ™••‘‰…¬ì(€€€¥˜€¡É…‘•UÀ¤ì(€€€€€™••‘‰…¬€ôì(€€€€€€€­¥¹è€…¡¥•Ù•µ•¹Ğœ°(€€€€€€€Ñ¥Ñ±”è€Ÿ®ª§¶Fpƒ®.³²Ä„ƒÂ~:$œ°(€€€€€€€ÍÕˆè€‘í…™Ñ•ÉA…ä¹É…‘•÷®NÇªâ'²^@ƒ®>®.³¶Z#²ZÓ²jQ€°(€€€€€ôì(€€€ô•±Í”¥˜€¡¡½µ•…Ñ•¡¥•Ù•¤ì(€€€€€™••‘‰…¬€ôì(€€€€€€€­¥¹è€…¡¥•Ù•µ•¹Ğœ°(€€€€€€€Ñ¥Ñ±”è€Ÿ®ª§¶Fpƒ®.³²Ä„ƒÂ~:$œ°(€€€€€€€ÍÕˆè€Ÿ¶f ƒ²Ös²3²†ÃªÆÓ²vƒ®.³²Ç¶Z#²ZÓ²jPœ°(€€€€€ôì(€€€ô•±Í”ì(€€€€€½¹ÍĞµÍœ€ô	-}5MMMm5…Ñ ¹™±½½È¡5…Ñ ¹É…¹‘½´ ¤€¨	-}5MML¹±•¹Ñ ¥tì(€€€€€™••‘‰…¬€ôì­¥¹è€¹½Éµ…°œ°€¸¸¹µÍœôì(€€€ô((€€€€¼¼ƒ².“²‚pƒ²z®‚”ƒ®Âc²b(€€€µÕÑ…Ñ”¡¹•áÑ…ä¤ì((€€€¹½Ñ¥™åMÑ½É•5…¹…•ÉÌ¡ì(€€€€€…Ñ½É%èÕÉÉ•¹ÑµÀü¹¥°(€€€€€ÑåÁ”è€‘…¥±å}¥¹ÁÕĞœ°(€€€€€Ñ¥Ñ±”è€‘íÕÉÉ•¹ÑµÀü¹¹…µ”ñğ€Ÿ²²n@÷®.c²vĞƒ².“²‚²vƒ®NÇ®†w¶Z#²ZÓ²jQ€°(€€€€€µ•ÍÍ…”è€‘í±…‰•±ô€ÇªÆÑ€°(€€€€€Á…å±½…èì(€€€€€€€•µÁ±½å••}¥èÕÉÉ•¹ÑµÀü¹¥°(€€€€€€€•µÁ±½å••}¹…µ”èÕÉÉ•¹ÑµÀü¹¹…µ”°(€€€€€€€ÍÑ½É•}¹…µ”èÕÉÉ•¹ÑµÀü¹‰É…¹ °(€€€€€€€µ½¹Ñ °(€€€€€€€‘…äèÍ•±•Ñ•‘…ä°(€€€€€€€±…‰•°°(€€€€€ô°(€€€ô¤ì((€€€½¹ÍĞÑ½…ÍÑ%€ô€‘í…Ñ”¹¹½Ü ¥ô´‘íÉ¥ô´‘í¥õ€ì(€€€Í•ÑQ½…ÍĞ¡ì(€€€€€¥èÑ½…ÍÑ%°(€€€€€Í½ÕÉ”èµ½‰¥±”œ°(€€€€€±…‰•°°(€€€€€É¤°(€€€€€¤°(€€€€€€¸¸¹™••‘‰…¬°(€€€€€Á…å•±Ñ„°(€€€€€Í…±•A…å•±Ñ„°(€€€€€…Ñ¥Ù¥ÑåA…å•±Ñ„°(€€€€€‰½¹ÕÍA…å•±Ñ„°(€€€€€Á½¥¹Ñ•±Ñ„é9Õµ‰•È¡…™Ñ•ÉA…ä¹Ñ½Ñ…±A½¥¹ÑÍñğÀ¤µ9Õµ‰•È¡‰•™½É•A…ä¹Ñ½Ñ…±A½¥¹ÑÍñğÀ¤°(€€€€€ÍÑÉ…Ñ•¥A½¥¹Ñ•±Ñ„éµ½‰¥±•MÑÉ…Ñ•¥A½¥¹Ğ¡íÍÑÉ…Ñ•¥A±…¸è„…ÕÍÑ½µ•É5•Ñ„¹ÍÑÉ…Ñ•¥A±…¸±Ù…Í-•åÌéÕÍÑ½µ•É5•Ñ„¹Ù…Í-•åÌ±‰Õ¹‘±•Y…Í5…ÀéÕÍÑ½µ•É5•Ñ„¹‰Õ¹‘±•Y…Í5…Áô¤°(€€€€€ÁÉ½‘ÕÑ¥Ù¥Ñå•±Ñ„é9Õµ‰•È¡…™Ñ•ÉA…ä¹­Á¥M½É•ñğÀ¤µ9Õµ‰•È¡‰•™½É•A…ä¹­Á¥M½É•ñğÀ¤°(€€€€€ÕÉÉ•¹ÑQ½Ñ…°è…™Ñ•ÉA…ä¹ÕÉÉ•¹ÑA•É™½Éµ…¹•µ½Õ¹Ğ°(€€€€€ÕÍÑ½µ•É9…µ”éÕÍÑ½µ•É5•Ñ„¹ÕÍÑ½µ•É9…µ•ñğœœ°(€€€€€ÁÉ½µ¥Í•½Õ¹Ğé9Õµ‰•È¡ÕÍÑ½µ•É5•Ñ„¹ÁÉ½µ¥Í•½Õ¹ÑñğÀ¤°(€€€€€ÕÍÑ½µ•ÉM…±•%èÕÍÑ½µ•É5•Ñ„¹Í…±•%ñğ¹Õ±°°(€€€€€Ù…Í-•åÌèÉÉ…ä¹¥ÍÉÉ…ä¡ÕÍÑ½µ•É5•Ñ„¹Ù…Í-•åÌ¤€üÕÍÑ½µ•É5•Ñ„¹Ù…Í-•åÌ€èmt°(€€€€€ÍÁ•¥…±5…ÑÉ¥á=™™Í•Ğé9Õµ‰•È¡ÕÍÑ½µ•É5•Ñ„¹ÍÁ•¥…±5…ÑÉ¥á=™™Í•ÑñğÀ¤±ÍÁ•¥…±Y…Í=™™Í•Ğé9Õµ‰•È¡ÕÍÑ½µ•É5•Ñ„¹ÍÁ•¥…±Y…Í=™™Í•ÑñğÀ¤±ÍÁ•¥…±I•Á±…•µ•¹ÑA…äé9Õµ‰•È¡ÕÍÑ½µ•É5•Ñ„¹ÍÁ•¥…±I•Á±…•µ•¹ÑA…åñğÀ¤°(€€€€€‰Õ¹‘±•É••=™™Í•Ğé9Õµ‰•È¡ÕÍÑ½µ•É5•Ñ„¹‰Õ¹‘±•É••=™™Í•ÑñğÀ¤±‰Õ¹‘±•É••Y…Í=™™Í•Ğé9Õµ‰•È¡ÕÍÑ½µ•É5•Ñ„¹‰Õ¹‘±•É••Y…Í=™™Í•ÑñğÀ¤°(€€€€€‰Õ¹‘±”É¹‘-•åÌéÉÉ…ä¹¥ÍÉÉ…ä¡ÕÍÑ½µ•É5•Ñ„¹‰Õ¹‘±”É¹‘-•åÌ¤ıÕÍÑ½µ•É5•Ñ„¹‰Õ¹‘±”É¹‘-•åÌémt°(€€€€€ÕÍ•‘5¹Á	Õ¹‘±”è„…ÕÍÑ½µ•É5•Ñ„¹ÕÍ•‘5¹Á	Õ¹‘±”°(€€€€€…±Õ±…Ñ¥½¹1¥¹•ÌéÉÉ…ä¹¥ÍÉÉ…ä¡ÕÍÑ½µ•É5•Ñ„¹…±Õ±…Ñ¥½¹1¥¹•Ì¤ıÕÍÑ½µ•É5•Ñ„¹…±Õ±…Ñ¥½¹1¥¹•Ìémt°(€€€ô¤ì((€€€Í•ÑQ¥µ•½ÕĞ  ¤€ôøì(€€€€€Í•ÑQ½…ÍĞ ¡Ğ¤€ôø€¡Ğ€˜˜Ğ¹¥€ôôôÑ½…ÍÑ%€ü¹Õ±°€èĞ¤¤ì(€€€ô°€ÄÀÀÀÀ¤ì(€ôì(((€½¹ÍĞµ½‰¥±•1…‰•±½Èô¡É¤±¤¤ôùì(€€€½¹ÍĞÉ½İ•˜õ5QI%a}I=]}MmÉ¥tì(€€€¥˜ …É½İ•˜¥É•ÑÕÉ¸€œœì(€€€É•ÑÕÉ¸É½İ•˜¹¡…ÍQ¥•ÉÌ(€€€€€€ü€‘íÉ½İ•˜¹‘…¥±å1…‰•±ññÉ½İ•˜¹±…‰•±ôƒ
Ü€‘í5QI%a}=1Mm¥uõ€(€€€€€€è€¡É½İ•˜¹‘…¥±å1…‰•±ññÉ½İ•˜¹±…‰•°¤ì(€ôì((€½¹ÍĞ¥¹™•É5½‰¥±•5•Ñ„ô¡Í…±”¤ôùì(€€€½¹ÍĞµ•Ñ„õÍ…±”ü¹Í½ÕÉ•}µ•Ñ„˜™ÑåÁ•½˜Í…±”¹Í½ÕÉ•}µ•Ñ„ôôô½‰©•ĞœıÍ…±”¹Í½ÕÉ•}µ•Ñ„éíôì(€€€½¹ÍĞ±•…¹ÉÉ…äô¡Ø¤ôùÉÉ…ä¹¥ÍÉÉ…ä¡Ø¤ıØémtì(€€€½¹ÍĞ±•…¹=‰¨ô¡Ø¤ôùØ˜™ÑåÁ•½˜Øôôô½‰©•Ğœ˜˜…ÉÉ…ä¹¥ÍÉÉ…ä¡Ø¤ıØéíôì(€€€±•ĞÉ¤õ9Õµ‰•È¹¥Í%¹Ñ••È¡µ•Ñ„¹É¤¤ıµ•Ñ„¹É¤é¹Õ±°ì(€€€±•Ğ¤õ9Õµ‰•È¹¥Í%¹Ñ••È¡µ•Ñ„¹¤¤ıµ•Ñ„¹¤é¹Õ±°ì((€€€€¼¼ƒªÖ³®Ê²‚²v É¤½§ªÂ ƒ²^²vƒ²"`ƒ²z#²ró®¾®†pƒ²
³®z3²vĞƒ²v÷®*Pµ•ÑÉ¥}±…‰•³²^C²pƒ®Î×²n@(€€€¥˜¡É¤ôôõ¹Õ±°¥ì(€€€€€½¹ÍĞ±…‰•°õMÑÉ¥¹œ¡Í…±”ü¹µ•ÑÉ¥}±…‰•±ñğœœ¤(€€€€€€€€¹É•Á±…” ¿ªâÃ®ÎqÌ©½¤°ŸªâÃªâÃ®ÎªÊôœ¤(€€€€€€€€¹É•Á±…” ¿ªâÃ®ÎqÌ©½¤°ŸªâÃªâÃ®ÎªÊôœ¤(€€€€€€€€¹É•Á±…” ¿ªâÃ®ÎqÌ©½¤°ŸªâÃªâÃ®ÎªÊôœ¤ì(€€€€€É¤õ5QI%a}I=]}L¹™¥¹‘%¹‘•à¡Èôù±…‰•°¹ÍÑ…ÉÑÍ]¥Ñ ¡È¹‘…¥±å1…‰•±ññÈ¹±…‰•°¤¤ì(€€€€€¥˜¡É¤ğÀ¥É¤õ5QI%a}I=]}L¹™¥¹‘%¹‘•à¡Èôù±…‰•°¹¥¹±Õ‘•Ì¡È¹‘…¥±å1…‰•±ññÈ¹±…‰•°¤¤ì(€€€€€¥˜¡É¤ğÀ¥É•ÑÕÉ¸¹Õ±°ì(€€€€€½¹ÍĞÉ½İ•˜õ5QI%a}I=]}MmÉ¥tì(€€€€€¤ôÀì(€€€€€¥˜¡É½İ•˜ü¹¡…ÍQ¥•ÉÌ¥ì(€€€€€€€½¹ÍĞ™½Õ¹õ5QI%a}=1L¹™¥¹‘%¹‘•à¡Œôù±…‰•°¹¥¹±Õ‘•Ì¡Œ¤¤ì(€€€€€€€¥˜¡™½Õ¹øôÀ¥¤õ™½Õ¹ì(€€€€€ô(€€€ô(€€€¥˜¡¤ôôõ¹Õ±°ñğ¤ğÀ¥¤ôÀì((€€€É•ÑÕÉ¸ì(€€€€€É¤±¤°(€€€€€Ù…Í-•åÌé±•…¹ÉÉ…ä¡µ•Ñ„¹Ù…Í-•åÌ¤°(€€€€€‰Õ¹‘±”É¹‘-•åÌé±•…¹ÉÉ…ä¡µ•Ñ„¹‰Õ¹‘±”É¹‘-•åÌ¤°(€€€€€‰Õ¹‘±•Y…Í5…Àé±•…¹=‰¨¡µ•Ñ„¹‰Õ¹‘±•Y…Í5…À¤°(€€€€€‰Õ¹‘±•M…±•QåÁ•5…Àé±•…¹=‰¨¡µ•Ñ„¹‰Õ¹‘±•M…±•QåÁ•5…À¤°(€€€€€‰Õ¹‘±•Y…Í½µµ¥ÍÍ¥½¹á±Õ‘•è„…µ•Ñ„¹‰Õ¹‘±•Y…Í½µµ¥ÍÍ¥½¹á±Õ‘•°(€€€€€ÕÍ•‘5¹Á	Õ¹‘±”è„…µ•Ñ„¹ÕÍ•‘5¹Á	Õ¹‘±”°(€€€€€ÍÁ•¥…±A½±¥äé±•…¹=‰¨¡µ•Ñ„¹ÍÁ•¥…±A½±¥ä¤°(€€€€€Í¡•µ…Y•ÉÍ¥½¸éÍ…±•M¡•µ…Y•ÉÍ¥½¸¡Í…±”¤°(€€€€€É…İ5•Ñ„éµ•Ñ„°(€€€ôì(€ôì((€€¼¼ØÈÄ¸ÌàèƒªÖ°U'²^C²pÕÍÑ½µ•É}Í…±•Ìƒ²^²vĞ‘…¥±å}É•½É‘Ï²^C®0ƒ²‚²z—®Bpƒ®ª£®ÂS²vğƒ².“²‚²vƒ®Ú®š°(€½¹ÍĞÉ•ÁÉ•Í•¹Ñ•‘5½‰¥±•5…ÑÉ¥àõÕÍ•5•µ¼  ¤ôùì(€€€½¹ÍĞµ…ÑÉ¥àõ•µÁÑå…å5…ÑÉ¥à ¤ì(€€€€¡‘…åM…±•Íññmt¤¹™½É… ¡Í…±”ôùì(€€€€€¥˜¡Í…±”¹Í½ÕÉ•}ÑåÁ”ôôô¡½µ•}½É‘•ÈœñğÍ…±”¹Í½ÕÉ•}ÑåÁ”ôôô•áÑÉ„œ¥É•ÑÕÉ¸ì(€€€€€½¹ÍĞµ•Ñ„õ¥¹™•É5½‰¥±•5•Ñ„¡Í…±”¤ì(€€€€€¥˜ …µ•Ñ„¥É•ÑÕÉ¸ì(€€€€€¥˜¡µ…ÑÉ¥ámµ•Ñ„¹É¥t€˜˜9Õµ‰•È¹¥Í%¹Ñ••È¡µ•Ñ„¹¤¤¥ì(€€€€€€€µ…ÑÉ¥ámµ•Ñ„¹É¥umµ•Ñ„¹¥tõ9Õµ‰•È¡µ…ÑÉ¥ámµ•Ñ„¹É¥umµ•Ñ„¹¥uñğÀ¤¬Äì(€€€€€ô(€€€ô¤ì(€€€É•ÑÕÉ¸µ…ÑÉ¥àì(€ô±m‘…åM…±•Ì±½¹™¥t¤ì((€½¹ÍĞ±•…å5½‰¥±•5…ÑÉ¥àõÕÍ•5•µ¼  ¤ôùì(€€€½¹ÍĞõ¹½Éµ…±¥é•…ä¡‘…ä¤ì(€€€É•ÑÕÉ¸¹µ…ÑÉ¥à¹µ…À ¡É½Ü±É¤¤ôùÉ½Ü¹µ…À ¡¹Ğ±¤¤ôø(€€€€€5…Ñ ¹µ…à À±9Õµ‰•È¡¹ÑñğÀ¤µ9Õµ‰•È¡É•ÁÉ•Í•¹Ñ•‘5½‰¥±•5…ÑÉ¥àü¹mÉ¥tü¹m¥uñğÀ¤¤(€€€€¤¤ì(€ô±m‘…ä±É•ÁÉ•Í•¹Ñ•‘5½‰¥±•5…ÑÉ¥át¤ì((€½¹ÍĞ±•…å5½‰¥±•½Õ¹ĞõÕÍ•5•µ¼  ¤ôø(€€€±•…å5½‰¥±•5…ÑÉ¥à¹É•‘Õ” ¡ÍÕ´±É½Ü¤ôùÍÕ´­É½Ü¹É•‘Õ” ¡„±Ø¤ôù„­9Õµ‰•È¡ÙñğÀ¤°À¤°À¤(€€±m±•…å5½‰¥±•5…ÑÉ¥át¤ì(((€½¹ÍĞ±•…åM…±•I½İÌõÕÍ•5•µ¼  ¤ôùì(€€€½¹ÍĞÉ½İÌõmtì(€€€€¼¼ƒ®ª£®ÂS²vğèƒ¶b²z°ÕÍÑ½µ•É}Í…±•Ï®†pƒ²“®ª®Bc² ƒ²V+®*Pµ…ÑÉ¥àƒ²zS²^³®Ú²v€ÇªÆÓ²R¤ƒ¶J²ZÓ²pƒ¶Fs².p(€€€€¡±•…å5½‰¥±•5…ÑÉ¥áññmt¤¹™½É…  ¡É½Ü±É¤¤ôø¡É½İññmt¤¹™½É…  ¡¹Ğ±¤¤ôùì(€€€€€½¹ÍĞ¸õ5…Ñ ¹µ…à À±5…Ñ ¹™±½½È¡9Õµ‰•È¡¹ÑñğÀ¤¤¤ì(€€€€€½¹ÍĞÉõ5QI%a}I=]}MmÉ¥tì(€€€€€™½È¡±•Ğ¤ôÀí¤ñ¸í¤¬¬¥ì(€€€€€€€É½İÌ¹ÁÕÍ ¡ì(€€€€€€€€€¥é±•…äµµ½‰¥±”´‘íÉ¥ô´‘í¥ô´‘í¥õ€°(€€€€€€€€€­¥¹èµ½‰¥±”œ±É¤±¤°(€€€€€€€€€Ñ¥Ñ±”éÉü¹‘…¥±å1…‰•±ññÉü¹±…‰•±ñğŸ®ª£®ÂS²vğœ°(€€€€€€€€€‘•Ñ…¥°éÉü¹¡…ÍQ¥•ÉÌü¡5QI%a}=1Mm¥uñğœœ¤èœœ°(€€€€€€€ô¤ì(€€€€€ô(€€€ô¤¤ì((€€€€¼¼ƒ¶f èƒ¶b²z°ÕÍÑ½µ•É}Í…±•Ï®†pƒ²“®ª®Bc®*Pƒ¶f ƒªÆÓ²"c®–ğƒ®æóªÎ€ƒ®
£²v ƒ²GªÎ®0€Ÿ²vÓ®šƒ²^²v0Ÿ²ró®†pƒ¶Fs².p(€€€½¹ÍĞõ¹½Éµ…±¥é•…ä¡‘…ä¤ì(€€€½¹ÍĞÉ•ÁÉ•Í•¹Ñ•‘!½µ”õíôì(€€€½¹ÍĞ…‘‘I•Àô¡œ±¬¤ôùí½¹ÍĞ­•äõ€‘íô¸‘í­õ€íÉ•ÁÉ•Í•¹Ñ•‘!½µ•m­•åtõ9Õµ‰•È¡É•ÁÉ•Í•¹Ñ•‘!½µ•m­•åuñğÀ¤¬Åôì(€€€½¹ÍĞÉ•ÁÉ•Í•¹Ñ•‘=É‘•ÉI•™Ìõ¹•ÜM•Ğ ¤ì(€€€€¡‘…åM…±•Íññmt¤¹™¥±Ñ•È¡àôùà¹Í½ÕÉ•}ÑåÁ”ôôô¡½µ•}½É‘•Èœ¤¹™½É… ¡Í…±”ôùì(€€€€€¥˜¡Í…±”¹Í½ÕÉ•}É•˜¥É•ÁÉ•Í•¹Ñ•‘=É‘•ÉI•™Ì¹…‘¡MÑÉ¥¹œ¡Í…±”¹Í½ÕÉ•}É•˜¤¤ì(€€€€€½¹ÍĞÁĞõ¥¹™•É!½µ•AÉ½‘ÕÑQåÁ•É½µ1…‰•°¡Í…±”¹µ•ÑÉ¥}±…‰•°¤ì(€€€€€¥˜¡ÁĞôôô¡½µ•=¹±äœ¥…‘‘I•À ¡½µ•	…Í”œ°¡½µ•=¹±äœ¤ì(€€€€€•±Í”¥˜¡ÁĞôôô¡½µ•QØœ¥…‘‘I•À ¡½µ•	…Í”œ°¡½µ•QØœ¤ì(€€€€€•±Í”¥˜¡ÁĞôôôÑÙÉ•”œ¥…‘‘I•À ¡½µ•±…Ğœ°ÑÙÉ•”œ¤ì(€€€€€•±Í”¥˜¡ÁĞôôôÍµ…ÉÑ!½µ”œ¥…‘‘I•À ¡½µ•±…Ğœ°Íµ…ÉÑ!½µ”œ¤ì(€€€€€•±Í”¥˜¡ÁĞôôô¥¹Ñ•É¹•ĞÄÀÀœ¥…‘‘I•À ¡½µ•±…Ğœ°¡½µ”ÄÀÁ=¹±äœ¤ì(€€€€€•±Í”¥˜¡ÁĞôôô¥¹Ñ•É¹•ĞÔÀÀœ¥…‘‘I•À ¡½µ•±…Ğœ°¡½µ”ÔÀÁ=¹±äœ¤ì(€€€€€•±Í”¥˜¡ÁĞôôô¥¹Ñ•É¹•ĞÅœœ¥…‘‘I•À ¡½µ•±…Ğœ°¡½µ”Å	=¹±äœ¤ì(€€€ô¤ì(€€€€¼¼ƒªÖ³®Ê²‚²^C®*P¡½µ•}½É‘•ÉÏ®0ƒ²z#ªÎ€ÕÍÑ½µ•É}Í…±•ÏªÂ ƒ²^®*PƒªÆÓ²vĞƒ²z#²*×®.#®.¸(€€€€¼¼ƒ²f®0¿²¶Z$¿²Ş£²0ƒ²^³®Ú²f ƒªÒªÎ²^²vĞƒ²vÓ®¾àƒ²†Ó²z³¶Vc®*Pƒ²nC®Îàƒ²ó®²ã²vÓ®¦Ğ±•…äƒ²zS²^³®Ú²ró®†pƒ®.“².pƒ®3®N“² ƒ²V+²*×®.#®.¸(€€€€¡‘…å!½µ•=É‘•ÉÍññmt¤¹™¥±Ñ•È¡¼ôø…É•ÁÉ•Í•¹Ñ•‘=É‘•ÉI•™Ì¹¡…Ì¡MÑÉ¥¹œ¡¼¹¥¤¤¤¹™½É… ¡¼ôùì(€€€€€¥˜¡¼¹Í½ÕÉ•}É½ÕÀ˜™¼¹Í½ÕÉ•}­•ä¥í…‘‘I•À¡¼¹Í½ÕÉ•}É½ÕÀ±¼¹Í½ÕÉ•}­•ä¤íÉ•ÑÕÉ¸íô(€€€€€½¹ÍĞÁĞõ¼¹ÁÉ½‘ÕÑ}ÑåÁ”ì(€€€€€¥˜¡ÁĞôôô¡½µ•=¹±äœ¥…‘‘I•À ¡½µ•	…Í”œ°¡½µ•=¹±äœ¤ì(€€€€€•±Í”¥˜¡ÁĞôôô¡½µ•QØœ¥…‘‘I•À ¡½µ•	…Í”œ°¡½µ•QØœ¤ì(€€€€€•±Í”¥˜¡ÁĞôôôÑÙÉ•”œ¥…‘‘I•À ¡½µ•±…Ğœ°ÑÙÉ•”œ¤ì(€€€€€•±Í”¥˜¡ÁĞôôôÍµ…ÉÑ!½µ”œ¥…‘‘I•À ¡½µ•±…Ğœ°Íµ…ÉÑ!½µ”œ¤ì(€€€€€•±Í”¥˜¡ÁĞôôô¥¹Ñ•É¹•ĞÄÀÀœ¥…‘‘I•À ¡½µ•±…Ğœ°¡½µ”ÄÀÁ=¹±äœ¤ì(€€€€€•±Í”¥˜¡ÁĞôôô¥¹Ñ•É¹•ĞÔÀÀœ¥…‘‘I•À ¡½µ•±…Ğœ°¡½µ”ÔÀÁ=¹±äœ¤ì(€€€€€•±Í”¥˜¡ÁĞôôô¥¹Ñ•É¹•ĞÅœœ¥…‘‘I•À ¡½µ•±…Ğœ°¡½µ”Å	=¹±äœ¤ì(€€€ô¤ì(€€€½¹ÍĞ±•™Ğô¡œ±¬¤ôù5…Ñ ¹µ…à À±5…Ñ ¹™±½½È¡9Õµ‰•È¡¹É½ÕÁÌü¹mtü¹m­uñğÀ¤µ9Õµ‰•È¡É•ÁÉ•Í•¹Ñ•‘!½µ•m€‘íô¸‘í­õuñğÀ¤¤¤ì(€€€½¹ÍĞ¡½µ••™Ìõl(€€€€€íœè¡½µ•	…Í”œ±¬è¡½µ•=¹±äœ±Ñ¥Ñ±”èŸ¶f ƒ®.£®>œ±ÁÉ•Í•Ğè¡½µ•=¹±äô°(€€€€€íœè¡½µ•	…Í”œ±¬è¡½µ•QØœ±Ñ¥Ñ±”èŸ¶f ­QXœ±ÁÉ•Í•Ğè¡½µ•QØô°(€€€€€íœè¡½µ•±…Ğœ±¬èÑÙÉ•”œ±Ñ¥Ñ±”èQ[¶R®š°£®Ú ¤œ±ÁÉ•Í•ĞèÑÙÉ•”ô°(€€€€€íœè¡½µ•±…Ğœ±¬èÍµ…ÉÑ!½µ”œ±Ñ¥Ñ±”èŸ²*“®#¶*ã¶f œ±ÁÉ•Í•ĞèÍµ…ÉÑ!½µ”ô°(€€€tì(€€€¡½µ••™Ì¹™½É… ¡‘•˜ôùì(€€€€€½¹ÍĞ¸õ±•™Ğ¡‘•˜¹œ±‘•˜¹¬¤ì(€€€€€™½È¡±•Ğ¤ôÀí¤ñ¸í¤¬¬¥É½İÌ¹ÁÕÍ ¡ì(€€€€€€€¥é±•…äµ¡½µ”´‘í‘•˜¹ô´‘í‘•˜¹­ô´‘í¥õ€°(€€€€€€€­¥¹è¡½µ”œ±É½ÕÁ-•äé‘•˜¹œ±¥Ñ•µ-•äé‘•˜¹¬±Ñ¥Ñ±”é‘•˜¹Ñ¥Ñ±”±ÁÉ•Í•Ğé‘•˜¹ÁÉ•Í•Ğ(€€€€€ô¤ì(€€€ô¤ì((€€€€¼¼ƒ®Îã²¶J ƒ²zS²^³ªÂ ƒ²^®*S®6Àƒ²7®>ƒ²GªÎ®0ƒ®
£²v ƒªÊ÷²jÃ®0ƒ®Î®>ƒ¶2C®“ªÆÓ²ró®†pƒ®ÎÓ²^°ƒªÎóªÆÀƒ²’G®ÎÔƒªÖ³²Äƒ²ÚS²‚W²vƒ¶Ró¶V (€€€½¹ÍĞ±•™Ñ½Ù•É!½µ•	…Í”õ±•™Ğ ¡½µ•	…Í”œ°¡½µ•=¹±äœ¤­±•™Ğ ¡½µ•	…Í”œ°¡½µ•QØœ¤ì(€€€¥˜¡±•™Ñ½Ù•É!½µ•	…Í”ôôôÀ¥ì(€€€€€l(€€€€€€€l¡½µ”ÄÀÁ=¹±äœ°Ÿ²vã¶Ã®Ü€ÄÀÁ5œ°œÄÀÀt°(€€€€€€€l¡½µ”ÔÀÁ=¹±äœ°Ÿ²vã¶Ã®Ü€ÔÀÁ5œ°œÔÀÀt°(€€€€€€€l¡½µ”Å	=¹±äœ°Ÿ²vã¶Ã®Ü€Åœ°œÅœt°(€€€€€t¹™½É…  ¡m¬±Ñ¥Ñ±”±ÍÁ••‘t¤ôùì(€€€€€€€½¹ÍĞ¸õ±•™Ğ ¡½µ•±…Ğœ±¬¤ì(€€€€€€€™½È¡±•Ğ¤ôÀí¤ñ¸í¤¬¬¥É½İÌ¹ÁÕÍ ¡ì(€€€€€€€€€¥é±•…äµ¡½µ”µ¡½µ•±…Ğ´‘í­ô´‘í¥õ€°(€€€€€€€€€­¥¹è¡½µ”œ±É½ÕÁ-•äè¡½µ•±…Ğœ±¥Ñ•µ-•äé¬±Ñ¥Ñ±”±ÁÉ•Í•Ğè¥¹Ñ•É¹•Ğœ±ÍÁ••(€€€€€€€ô¤ì(€€€€€ô¤ì(€€€ô(€€€É•ÑÕÉ¸É½İÌì(€ô±m±•…å5½‰¥±•5…ÑÉ¥à±‘…ä±‘…åM…±•Ì±‘…å!½µ•=É‘•ÉÍt¤ì((€½¹ÍĞ½Á•¹1•…åM…±•I½Üô¡É½Ü¤ôùì(€€€¥˜¡±½­•¥É•ÑÕÉ¸ì(€€€Í•Ñ1•…å½¹Ù•ÉÍ¥½¸¡É½Ü¤ì(€€€¥˜¡É½Ü¹­¥¹ôôôµ½‰¥±”œ¥ì(€€€€€…‘‘=¹”¡É½Ü¹É¤±É½Ü¹¤¤ì(€€€€€É•ÑÕÉ¸ì(€€€ô((€€€€¼¼ƒ¶f ƒªÖ³®Ê²‚²v ƒªâÃ²†Ğƒ¶f ƒ²z®‚”U'®–ğƒªŞã®2®†pƒ²
³²j§¶VcªÎ€°ƒªÎóªÆÃ²^@ƒ¶fW²vã®Bc®*Pƒ¶V·®ª§®0ƒ®¾ã®š°ƒ²ƒ¶t(€€€½Á•¹!½µ•=É‘•È ¤ì(€€€Í•Ñ!½µ•=É‘•ÉÉ…™Ğ¡íÕ¹¥™¥•éÑÉÕ”±±…‰•°èŸ¶f ƒ².“²‚ƒ²"c²‚Tœ±±•…å½¹Ù•ÉÍ¥½¸éÑÉÕ•ô¤ì(€€€Í•Ñ!½µ•ÕÍÑ½µ•É9…µ” œœ¤ì(€€€Í•Ñ!½µ•¥É•Ñ½µÁ±•Ñ”¡ÑÉÕ”¤ì€¼¼ƒ²vÓ®¾àƒ².“²‚²ró®†pƒ²GªÎ®>ğƒ²z#®6`ƒªÆÓ²vÓ®¾®†pƒ²f®0ƒ².“²‚²ró®†pƒ®Î×²n@(€€€¥˜¡É½Ü¹ÁÉ•Í•Ğôôô¡½µ•=¹±äœ¥ì(€€€€€Í•Ñ!½µ•%¹Ñ•É¹•Ğ¡ÑÉÕ”¤ìÍ•Ñ!½µ•5…¥¹QØ¡™…±Í”¤ì(€€€õ•±Í”¥˜¡É½Ü¹ÁÉ•Í•Ğôôô¡½µ•QØœ¥ì(€€€€€Í•Ñ!½µ•%¹Ñ•É¹•Ğ¡ÑÉÕ”¤ìÍ•Ñ!½µ•5…¥¹QØ¡ÑÉÕ”¤ì(€€€õ•±Í”¥˜¡É½Ü¹ÁÉ•Í•ĞôôôÑÙÉ•”œ¥ì(€€€€€Í•Ñ!½µ•MÕ‰QØ¡ÑÉÕ”¤ìÍ•Ñ!½µ•MÕ‰QÙQåÁ” ™É•”œ¤ì(€€€õ•±Í”¥˜¡É½Ü¹ÁÉ•Í•ĞôôôÍµ…ÉÑ!½µ”œ¥ì(€€€€€Í•Ñ!½µ•Mµ…ÉÑ!½µ”¡ÑÉÕ”¤ì(€€€õ•±Í”¥˜¡É½Ü¹ÁÉ•Í•Ğôôô¥¹Ñ•É¹•Ğœ¥ì(€€€€€Í•Ñ!½µ•%¹Ñ•É¹•Ğ¡ÑÉÕ”¤ìÍ•Ñ!½µ•%¹Ñ•É¹•ÑMÁ••¡É½Ü¹ÍÁ••‘ñğœœ¤ì(€€€ô(€ôì((€½¹ÍĞ½Á•¹1•…å‘¥Ñ½Èô ¤ôùì(€€€Í•Ñ1•…å5…ÑÉ¥áÉ…™Ğ¡±•…å5½‰¥±•5…ÑÉ¥à¹µ…À¡É½Üôùl¸¸¹É½İt¤¤ì(€€€Í•Ñ1•…å‘¥Ñ½É=Á•¸¡ÑÉÕ”¤ì(€ôì((€½¹ÍĞÍ…Ù•1•…å‘¥Ñ½Èõ…Íå¹Œ ¤ôùì(€€€¥˜¡±½­•ñğ€…±•…å5…ÑÉ¥áÉ…™Ğ¥É•ÑÕÉ¸ì(€€€½¹ÍĞ‰…Í”õ¹½Éµ…±¥é•…ä¡‘…ä¤ì(€€€½¹ÍĞ¹•áÑ5…ÑÉ¥àõ‰…Í”¹µ…ÑÉ¥à¹µ…À ¡É½Ü±É¤¤ôùÉ½Ü¹µ…À ¡|±¤¤ôø(€€€€€9Õµ‰•È¡É•ÁÉ•Í•¹Ñ•‘5½‰¥±•5…ÑÉ¥àü¹mÉ¥tü¹m¥uñğÀ¤­5…Ñ ¹µ…à À±9Õµ‰•È¡±•…å5…ÑÉ¥áÉ…™Ğü¹mÉ¥tü¹m¥uñğÀ¤¤(€€€€¤¤ì(€€€½¹ÍĞ¹•áĞõì¸¸¹‰…Í”±µ…ÑÉ¥àé¹•áÑ5…ÑÉ¥áôì(€€€Í•Ñ…ä¡¹•áĞ¤ì(€€€½¹ÍĞ½¬õ…İ…¥ĞÍ…Ù•…¥±å…ä¡Í•±•Ñ•‘…ä±¹•áĞ¤ì(€€€¥˜¡½¬¥ì(€€€€€Í•Ñ1•…å‘¥Ñ½É=Á•¸¡™…±Í”¤ì(€€€€€Í•Ñ1•…å5…ÑÉ¥áÉ…™Ğ¡¹Õ±°¤ì(€€€ô(€ôì((€½¹ÍĞ½Á•¹‘¥ÑM…±”õ…Íå¹Œ¡Í…±”¤ôùì(€€€¥˜¡Í…±”¹Í½ÕÉ•}µ•Ñ„ü¹Ñ•…µ=¹±ä¥É•ÑÕÉ¸Í¡½İÁÁQ½…ÍĞ Ÿ²²n@ƒ¶2C®“®*Pƒ®Âc²bƒ®“²z”ƒ²b“®–c®–ğƒ®'ªâÀƒ²r¶VĞƒ²
·²‚pƒ¶nƒ®.“².pƒ®NÇ®†w¶VÓ²ó²ã²jP¸œ±íÑ½¹”è¥¹™¼ô¤ì(€€€¥˜¡Í…±”¹Í½ÕÉ•}ÑåÁ”ôôô¡½µ•}½É‘•Èœ¥ì(€€€€€½¹ÍĞÍ…±•…Ñ”õÍ…±”¹Í…±•}‘…Ñ”ì(€€€€€½¹ÍĞí‘…Ñ„é¡½µ•M…±•Ì±•ÉÉ½Èé¡ÍÉÉôõ…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ ÕÍÑ½µ•É}Í…±•Ìœ¤(€€€€€€€€¹Í•±•Ğ ¥±ÕÍÑ½µ•É}¥±Í…±•}‘…Ñ”±µ•ÑÉ¥}±…‰•°±Í½ÕÉ•}ÑåÁ”±Í½ÕÉ•}É•˜±Í½ÕÉ•}µ•Ñ„±Í¡•µ…}Ù•ÉÍ¥½¸±ÕÍÑ½µ•ÉÌ¡ÕÍÑ½µ•É}¹…µ”¤œ¤(€€€€€€€€¹•Ä ÕÍ•É}¥œ±ÕÉÉ•¹ÑµÀü¹¥¤¹•Ä Í…±•}‘…Ñ”œ±Í…±•…Ñ”¤¹•Ä ÕÍÑ½µ•É}¥œ±Í…±”¹ÕÍÑ½µ•É}¥¤¹•Ä Í½ÕÉ•}ÑåÁ”œ°¡½µ•}½É‘•Èœ¤ì(€€€€€¥˜¡¡ÍÉÈ¥É•ÑÕÉ¸Í¡½İ1•…å±•ÉĞ¡ƒ¶f ƒ¶2C®“²‚W®ÎĞƒ²†Ã¶j0ƒ².“¶2 è€‘í™É¥•¹‘±åÉÉ½È¡¡ÍÉÈ¥õ€¤ì(€€€€€½¹ÍĞÉ•™Ìô¡¡½µ•M…±•Íññmt¤¹µ…À¡àôùà¹Í½ÕÉ•}É•˜¤¹™¥±Ñ•È¡	½½±•…¸¤ì(€€€€€±•Ğ½É‘•ÉÌõmtì(€€€€€¥˜¡É•™Ì¹±•¹Ñ ¥ì½¹ÍĞí‘…Ñ„é¼±•ÉÉ½Èé½ÉÉôõ…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ ¡½µ•}½É‘•ÉÌœ¤¹Í•±•Ğ œ¨œ¤¹¥¸ ¥œ±É•™Ì¤ì¥˜¡½ÉÈ¥É•ÑÕÉ¸Í¡½İ1•…å±•ÉĞ¡ƒ¶f ƒ²ó®²àƒ²†Ã¶j0ƒ².“¶2 è€‘í™É¥•¹‘±åÉÉ½È¡½ÉÈ¥õ€¤ì½É‘•ÉÌõ½ññmtìô(€€€€€Í•Ñ‘¥Ñ¥¹!½µ•M…±•Ì¡¡½µ•M…±•Íññmt¤ì(€€€€€Í•Ñ!½µ•=É‘•ÉÉ…™Ğ¡íÕ¹¥™¥•éÑÉÕ”±•‘¥Ñ¥¹œéÑÉÕ”±±…‰•°èŸ¶f ƒ¶2C®“ªÆĞƒ²"c²‚Tœ±±•…äè¡¡½µ•M…±•Íññmt¤¹Í½µ”¡±•…åM…±•	…‘”¥ô¤ì(€€€€€Í•Ñ!½µ•ÕÍÑ½µ•É9…µ”¡Í…±”¹ÕÍÑ½µ•ÉÌü¹ÕÍÑ½µ•É}¹…µ•ñğœœ¤ì(€€€€€½¹ÍĞµ•Ñ„Àô¡¡½µ•M…±•Íññmt¥lÁtü¹Í½ÕÉ•}µ•Ñ…ññÍ…±”¹Í½ÕÉ•}µ•Ñ…ññíôì(€€€€€½¹ÍĞ½µÁ…Ñ=É‘•ÉÌõ½µÁ…Ñ!½µ•I½İÌ¡¡½µ•M…±•Íññmt±½É‘•ÉÍññmt¤ì(€€€€€Í•Ñ!½µ•9•Ñİ½É­QåÁ”¡½µÁ…Ñ=É‘•ÉÍlÁtü¹¹•Ñİ½É­}ÑåÁ•ññµ•Ñ„À¹¹•Ñİ½É­QåÁ•ñğœœ¤ì(€€€€€Í•Ñ!½µ•%¹Ñ•É¹•Ğ¡½µÁ…Ñ=É‘•ÉÌ¹Í½µ”¡¼ôùl¡½µ•=¹±äœ°¡½µ•QØœ°¥¹Ñ•É¹•ĞÄÀÀœ°¥¹Ñ•É¹•ĞÔÀÀœ°¥¹Ñ•É¹•ĞÅœt¹¥¹±Õ‘•Ì¡¼¹ÁÉ½‘ÕÑ}ÑåÁ”¤¤¤ì(€€€€€½¹ÍĞÍÁ••‘É½µ=É‘•ÉÌõ½µÁ…Ñ=É‘•ÉÌ¹Í½µ”¡¼ôù¼¹ÁÉ½‘ÕÑ}ÑåÁ”ôôô¥¹Ñ•É¹•ĞÅœœ¤üœÅœœé½µÁ…Ñ=É‘•ÉÌ¹Í½µ”¡¼ôù¼¹ÁÉ½‘ÕÑ}ÑåÁ”ôôô¥¹Ñ•É¹•ĞÔÀÀœ¤üœÔÀÀœé½µÁ…Ñ=É‘•ÉÌ¹Í½µ”¡¼ôù¼¹ÁÉ½‘ÕÑ}ÑåÁ”ôôô¥¹Ñ•É¹•ĞÄÀÀœ¤üœÄÀÀœèœœì(€€€€€Í•Ñ!½µ•%¹Ñ•É¹•ÑMÁ••¡µ•Ñ„À¹¥¹Ñ•É¹•ÑMÁ••‘ññÍÁ••‘É½µ=É‘•ÉÍñğœœ¤ì(€€€€€½¹ÍĞÍ¥µÕ±É½µ=É‘•ÉÌõ½µÁ…Ñ=É‘•ÉÌ¹Í½µ”¡¼ôù¼¹ÁÉ½‘ÕÑ}ÑåÁ”ôôôÍ¥µÕ±UÍ•‘5¹Àœ¤üÕÍ•‘5¹Àœé½µÁ…Ñ=É‘•ÉÌ¹Í½µ”¡¼ôù¼¹ÁÉ½‘ÕÑ}ÑåÁ”ôôôÍ¥µÕ±5¹Àœ¤üµ¹Àœé½µÁ…Ñ=É‘•ÉÌ¹Í½µ”¡¼ôù¼¹ÁÉ½‘ÕÑ}ÑåÁ”ôôôÍ¥µÕ±9•İ¡…¹”œ¤ü¹•İ¡…¹”œè¹½¹”œì(€€€€€Í•Ñ!½µ•5½‰¥±•M¥µÕ°¡µ•Ñ„À¹µ½‰¥±•M¥µÕ±ññÍ¥µÕ±É½µ=É‘•ÉÍñğ¹½¹”œ¤ì(€€€€€Í•Ñ!½µ•5…¥¹QØ¡½µÁ…Ñ=É‘•ÉÌ¹Í½µ”¡¼ôù¼¹ÁÉ½‘ÕÑ}ÑåÁ”ôôô¡½µ•QØœ¤¤ì(€€€€€½¹ÍĞÍÑ½É•‘5…¥¹QÙA±…¸õ½µÁ…Ñ=É‘•ÉÌ¹™¥¹¡¼ôù¼¹ÁÉ½‘ÕÑ}ÑåÁ”ôôô¡½µ•QØœ¤ü¹µ…¥¹}ÑÙ}Á±…¹ññµ•Ñ„À¹µ…¥¹QÙA±…¹1•Ù•±ñğœœì(€€€€€Í•Ñ!½µ•5…¥¹QÙA±…¸¡ÍÑ½É•‘5…¥¹QÙA±…¹ñğ¡½µÁ…Ñ=É‘•ÉÌ¹Í½µ”¡¼ôù¼¹ÁÉ½‘ÕÑ}ÑåÁ”ôôô¡½µ•QØœ¤ü¡½µÁ…Ñ=É‘•ÉÍlÁtü¹¹•Ñİ½É­}ÑåÁ”ôôôÍ½¡¼œüÁÉ•µ¥Õ´œè‰É½…‘…ÍÑA…ÍÌœ¤èœœ¤¤ì(€€€€€Í•Ñ!½µ•MÕ‰QØ¡½µÁ…Ñ=É‘•ÉÌ¹Í½µ”¡¼ôùlÍÕ‰M•ÑQ½Àœ°ÑÙÉ•”t¹¥¹±Õ‘•Ì¡¼¹ÁÉ½‘ÕÑ}ÑåÁ”¤¤¤ì(€€€€€Í•Ñ!½µ•MÕ‰QÙQåÁ”¡½µÁ…Ñ=É‘•ÉÌ¹Í½µ”¡¼ôù¼¹ÁÉ½‘ÕÑ}ÑåÁ”ôôôÑÙÉ•”œ¤ü™É•”œè¹½Éµ…°œ¤ì(€€€€€Í•Ñ!½µ•Mµ…ÉÑ!½µ”¡½µÁ…Ñ=É‘•ÉÌ¹Í½µ”¡¼ôù¼¹ÁÉ½‘ÕÑ}ÑåÁ”ôôôÍµ…ÉÑ!½µ”œ¤¤ì(€€€€€Í•Ñ!½µ•¥É•Ñ½µÁ±•Ñ”¡½µÁ…Ñ=É‘•ÉÌ¹±•¹Ñ øÀ€˜˜½µÁ…Ñ=É‘•ÉÌ¹•Ù•Éä¡¼ôù¼¹ÍÑ…ÑÕÌôôô½µÁ±•Ñ•œ¤¤ì(€€€€€Í•Ñ!½µ•ÑÕ…±½µÁ±•Ñ•…Ñ”¡½µÁ…Ñ=É‘•ÉÌ¹™¥¹¡¼ôù¼¹…ÑÕ…±}¥¹ÍÑ…±±}‘…Ñ”¤ü¹…ÑÕ…±}¥¹ÍÑ…±±}‘…Ñ”ü¹Í±¥”ü¸ À°ÄÀ¥ñğœœ¤ì(€€€€€Í•Ñ!½µ•A±…¹¹•‘…Ñ”¡½µÁ…Ñ=É‘•ÉÌ¹™¥¹¡¼ôù¼¹Á±…¹¹•‘}¥¹ÍÑ…±±}‘…Ñ”¤ü¹Á±…¹¹•‘}¥¹ÍÑ…±±}‘…Ñ”ü¹Í±¥”ü¸ À°ÄÀ¥ñğœœ¤ì(€€€€€½¹ÍĞÁÉ¥µ…Éäô¡¡½µ•M…±•Íññmt¥lÁtì(€€€€€¥˜¡ÁÉ¥µ…Éä¥ì(€€€€€€€½¹ÍĞí‘…Ñ„éÑ…Í­Íôõ…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ ÕÍÑ½µ•É}Ñ…Í­Ìœ¤¹Í•±•Ğ œ¨œ¤¹•Ä Í½ÕÉ•}Í…±•}¥œ±ÁÉ¥µ…Éä¹¥¤¹•Ä ÕÍ•É}¥œ±ÕÉÉ•¹ÑµÀü¹¥¤¹¹•Ä ÍÑ…ÑÕÌœ°½µÁ±•Ñ•œ¤¹½É‘•È É•…Ñ•‘}…Ğœ¤ì(€€€€€€€½¹ÍĞÕÍÑ½µÌô¡Ñ…Í­Íññmt¤¹™¥±Ñ•È¡ĞôùĞ¹Ñ…Í­}ÑåÁ”ôôôÕÍÑ½´œ¤ì(€€€€€€€Í•Ñ!½µ•ÕÍÑ½µQ¥Ñ±”¡ÕÍÑ½µÍlÁtü¹Ñ¥Ñ±•ñğœœ¤ìÍ•Ñ!½µ•ÕÍÑ½µÕ•…Ñ”¡ÕÍÑ½µÍlÁtü¹‘Õ•}‘…Ñ•ñğœœ¤ì(€€€€€€€Í•Ñ!½µ•áÑÉ…AÉ½µ¥Í•Ì¡ÕÍÑ½µÌ¹Í±¥” Ä¤¹µ…À¡Ğôø¡íÑ¥Ñ±”éĞ¹Ñ¥Ñ±•ñğœœ±‘Õ•…Ñ”éĞ¹‘Õ•}‘…Ñ•ñğœô¤¤¤ì(€€€€€€€½¹ÍĞí‘…Ñ„é•áÁ•¹Í•Íôõ…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ Í…±•Í}•áÁ•¹Í•Ìœ¤¹Í•±•Ğ œ¨œ¤¹•Ä Í½ÕÉ•}Í…±•}¥œ±ÁÉ¥µ…Éä¹¥¤¹•Ä ÕÍ•É}¥œ±ÕÉÉ•¹ÑµÀü¹¥¤¹½É‘•È É•…Ñ•‘}…Ğœ¤ì(€€€€€€€½¹ÍĞ•àõ•áÁ•¹Í•ÍññmtìÍ•Ñ!½µ•áÁ•¹Í•=Á•¸¡•à¹±•¹Ñ øÀ¤ìÍ•Ñ!½µ•áÁ•¹Í•…Ñ•½Éä¡•álÁtü¹…Ñ•½ÉåñğŸ²b“¶6ğœ¤ìÍ•Ñ!½µ•áÁ•¹Í•µ½Õ¹Ğ¡•álÁtü¹…µ½Õ¹ĞıMÑÉ¥¹œ¡•álÁt¹…µ½Õ¹Ğ¤èœœ¤ìÍ•Ñ!½µ•áÁ•¹Í•5•µ¼¡•álÁtü¹µ•µ½ñğœœ¤ì(€€€€€€€Í•Ñ!½µ•áÑÉ…áÁ•¹Í•Ì¡•à¹Í±¥” Ä¤¹µ…À¡”ôø¡í…Ñ•½Éäé”¹…Ñ•½ÉåñğŸªâÃ¶ œ±…µ½Õ¹ĞéMÑÉ¥¹œ¡”¹…µ½Õ¹Ññğœœ¤±µ•µ¼é”¹µ•µ½ñğœô¤¤¤ì(€€€€€ô(€€€€€É•ÑÕÉ¸ì(€€€ô(€€€½¹ÍĞ¥¹™•ÉÉ•‘1•…å5½‰¥±”õ¥¹™•É5½‰¥±•5•Ñ„¡Í…±”¤ì(€€€¥˜¡Í…±”¹Í½ÕÉ•}ÑåÁ”„ôôµ½‰¥±”œ€˜˜€…¥¹™•ÉÉ•‘1•…å5½‰¥±”¥É•ÑÕÉ¸Í¡½İ1•…å±•ÉĞ Ÿ²vĞƒ¶2C®“²rƒ¶bW²v ƒ²V²ƒ²"c²‚W¶V€ƒ²"`ƒ²^²ZÓ²jP¸œ¤ì(€€€½¹ÍĞµ•Ñ„õ¥¹™•ÉÉ•‘1•…å5½‰¥±”ì(€€€¥˜ …µ•Ñ„¥É•ÑÕÉ¸Í¡½İ1•…å±•ÉĞ Ÿ²vÓ²‚ƒ®Ê²‚ƒ¶2C®“ªÆÓ²vÓ®vğƒªÂ²zªÖ³®Ú²vƒ¶fW²vã¶V€ƒ²"`ƒ²^²ZÓ²jP¸œ¤ì((€€€Í•Ñ‘¥Ñ¥¹M…±”¡Í…±”¤ì(€€€Í•Ñ5½‰¥±••Ñ…¥±Í=Á•¸¡ÑÉÕ”¤ì(€€€Í•Ñ5½‰¥±•…±=Á•¸¡™…±Í”¤ì(€€€½¹ÍĞ•‘¥Ñ…‰±•¤õ¥ÍM•ÁÑ•µ‰•ÉA½±¥åÑ¥Ù”¡µ½¹Ñ ¤˜™9Õµ‰•È¡µ•Ñ„¹¤¤ôôôÌüÔéµ•Ñ„¹¤ì(€€€Í•Ñ5½‰¥±•M…±•É…™Ğ¡íÉ¤éµ•Ñ„¹É¤±¤é•‘¥Ñ…‰±•¤±±…‰•°éµ½‰¥±•1…‰•±½È¡µ•Ñ„¹É¤±•‘¥Ñ…‰±•¤¥ô¤ì(€€€Í•Ñ5½‰¥±•ÕÍÑ½µ•É9…µ”¡Í…±”¹ÕÍÑ½µ•ÉÌü¹ÕÍÑ½µ•É}¹…µ•ñğœœ¤ì(€€€½¹ÍĞ•‘¥Ñ…‰±•Y…Í-•åÌô¡ÉÉ…ä¹¥ÍÉÉ…ä¡µ•Ñ„¹Ù…Í-•åÌ¤ıµ•Ñ„¹Ù…Í-•åÌémt¤¹µ…À¡¬ôù¥ÍM•ÁÑ•µ‰•ÉA½±¥åÑ¥Ù”¡µ½¹Ñ ¤˜™¬ôôôÙ…ÍY½±½ÈœüÙ…ÍY½±½É	Õ¹‘±”œé¬¤ì(€€€Í•Ñ5½‰¥±•Y…Í-•åÌ¡l¸¸¹¹•ÜM•Ğ¡•‘¥Ñ…‰±•Y…Í-•åÌ¥t¤ì(€€€Í•Ñ5½‰¥±•5½É•Y…Í=Á•¸¡•‘¥Ñ…‰±•Y…Í-•åÌ¹Í½µ”¡¬ôù…‘‘¥Ñ¥½¹…±5…¥¹Y…Ì¹Í½µ”¡ØôùØ¹­•äôôõ¬¤¤¤ì(€€€Í•Ñ5½‰¥±•	Õ¹‘±”É¹‘-•åÌ¡µ•Ñ„¹‰Õ¹‘±”É¹‘-•åÌ¤ì(€€€Í•Ñ5½‰¥±•	Õ¹‘±•Y…Í5…À¡µ•Ñ„¹‰Õ¹‘±•Y…Í5…À¤ì(€€€Í•Ñ5½‰¥±•	Õ¹‘±•M…±•QåÁ•5…À¡µ•Ñ„¹‰Õ¹‘±•M…±•QåÁ•5…À¤ì(€€€Í•Ñ5½‰¥±•UÍ•‘5¹Á	Õ¹‘±”¡µ•Ñ„¹ÕÍ•‘5¹Á	Õ¹‘±”¤ì(€€€Í•Ñ5½‰¥±•M…±•-¥¹¡µ•Ñ„¹ÍÁ•¥…±A½±¥äü¹Á½±¥å%€ü€ÍÁ•¥…°œ€è€¹½Éµ…°œ¤ì(€€€Í•Ñ5½‰¥±•MÁ•¥…±A½±¥å%¡µ•Ñ„¹ÍÁ•¥…±A½±¥äü¹Á½±¥å%‘ñğœœ¤ì(€€€Í•Ñ5½‰¥±•MÁ•¥…±á•ÁÑ¥½¹µ½Õ¹Ğ¡µ•Ñ„¹ÍÁ•¥…±A½±¥äü¹•á•ÁÑ¥½¹I•ÅÕ•ÍÑ•‘µ½Õ¹ĞıMÑÉ¥¹œ¡µ•Ñ„¹ÍÁ•¥…±A½±¥ä¹•á•ÁÑ¥½¹I•ÅÕ•ÍÑ•‘µ½Õ¹Ğ¤èœœ¤ì(€€€Í•Ñ5½‰¥±•MÁ½ÑA½±¥å% œœ¤ì(€€€Í•Ñ5½‰¥±•MÁ½Ñ¥É•Ñ=Á•¸¡™…±Í”¤ì(€€€Í•Ñ5½‰¥±•áÁ•¹Í•=Á•¸¡™…±Í”¤ì((€€€½¹ÍĞí‘…Ñ„éÑ…Í­Ì±•ÉÉ½Éôõ…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ ÕÍÑ½µ•É}Ñ…Í­Ìœ¤(€€€€€€¹Í•±•Ğ œ¨œ¤(€€€€€€¹•Ä Í½ÕÉ•}Í…±•}¥œ±Í…±”¹¥¤(€€€€€€¹•Ä ÕÍ•É}¥œ±ÕÉÉ•¹ÑµÀü¹¥¤(€€€€€€¹½É‘•È É•…Ñ•‘}…Ğœ±í…Í•¹‘¥¹œéÑÉÕ•ô¤ì((€€€¥˜¡•ÉÉ½È¥ì(€€€€€½¹Í½±”¹•ÉÉ½È %PM1QM,1=II=Hœ±•ÉÉ½È¤ì(€€€€€Í•Ñ5½‰¥±•…É•-•åÌ¡mt¤ì(€€€€€Í•Ñ5½‰¥±•ÕÍÑ½µQ¥Ñ±” œœ¤ì(€€€€€Í•Ñ5½‰¥±•ÕÍÑ½µÕ•…Ñ” œœ¤ì(€€€€€Í•Ñ5½‰¥±•Q…É•ÑA±…¸ œœ¤ì(€€€€€Í•Ñ5½‰¥±•A…åµ•¹Ñ¥ÉÍÑ…Ñ” œœ¤ì(€€€€€Í•Ñ5½‰¥±•A…åµ•¹Ñ½Õ¹Ğ Ì¤ì(€€€€€Í•Ñ5½‰¥±•™™¥±¥…Ñ•…É¡í…É‘9…µ”èœœ±…ÁÁÉ½Ù…±I•ÅÕ¥É•é™…±Í”±Ñ…Í­5•Ñ„é¹Õ±±ô¤ì(€€€€€Í•Ñ‘¥Ñ¥¹½µÁ±•Ñ•‘Q…Í­½Õ¹Ğ À¤ì(€€€€€É•ÑÕÉ¸ì(€€€ô((€€€½¹ÍĞ½µÁ±•Ñ•ô¡Ñ…Í­Íññmt¤¹™¥±Ñ•È¡ĞôùĞ¹ÍÑ…ÑÕÌôôô½µÁ±•Ñ•œ¤ì(€€€½¹ÍĞ•‘¥Ñ…‰±”ô¡Ñ…Í­Íññmt¤¹™¥±Ñ•È¡ĞôùĞ¹ÍÑ…ÑÕÌ„ôô½µÁ±•Ñ•œ¤ì(€€€Í•Ñ‘¥Ñ¥¹½µÁ±•Ñ•‘Q…Í­½Õ¹Ğ¡½µÁ±•Ñ•¹±•¹Ñ ¤ì(€€€Í•Ñ5½‰¥±•…É•-•åÌ¡l¸¸¹¹•ÜM•Ğ¡•‘¥Ñ…‰±”(€€€€€€¹µ…À¡ĞôùMÑÉ¥¹œ¡Ğ¹Ñ…Í­}ÑåÁ•ñğœœ¤¹ÍÑ…ÉÑÍ]¥Ñ  Á…åµ•¹ĞÍ|œ¤üÁ…åµ•¹ĞÌœéĞ¹Ñ…Í­}ÑåÁ”¤(€€€€€€¹™¥±Ñ•È¡¬ôùI}Q5A1QL¹Í½µ”¡àôùà¹­•äôôõ¬¤¤¥t¤ì(€€€½¹ÍĞÁ…åµ•¹ÑQ…Í­Ìô¡Ñ…Í­Íññmt¤¹™¥±Ñ•È¡ĞôùMÑÉ¥¹œ¡Ğ¹Ñ…Í­}ÑåÁ•ñğœœ¤¹ÍÑ…ÉÑÍ]¥Ñ  Á…åµ•¹ĞÍ|œ¤¤¹Í½ÉĞ ¡„±ˆ¤ôùMÑÉ¥¹œ¡„¹‘Õ•}‘…Ñ”¤¹±½…±•½µÁ…É”¡MÑÉ¥¹œ¡ˆ¹‘Õ•}‘…Ñ”¤¤¤ì(€€€Í•Ñ5½‰¥±•A…åµ•¹Ñ¥ÉÍÑ…Ñ”¡Á…åµ•¹ÑQ…Í­ÍlÁtü¹‘Õ•}‘…Ñ•ñğœœ¤ì(€€€Í•Ñ5½‰¥±•A…åµ•¹Ñ½Õ¹Ğ¡Á…åµ•¹ÑQ…Í­Ì¹±•¹Ñ¡ñğÌ¤ì(€€€½¹ÍĞ…™™¥±¥…Ñ•Q…Í¬õ•‘¥Ñ…‰±”¹™¥¹¡ĞôùĞ¹Ñ…Í­}ÑåÁ”ôôô…™™¥±¥…Ñ•…Éœ¤ì(€€€Í•Ñ5½‰¥±•™™¥±¥…Ñ•…É¡ì(€€€€€…É‘9…µ”é…™™¥±¥…Ñ•Q…Í¬ü¹Ñ…Í­}µ•Ñ„ü¹…É‘}¹…µ•ñğœœ°(€€€€€…ÁÁÉ½Ù…±I•ÅÕ¥É•è„……™™¥±¥…Ñ•Q…Í¬ü¹Ñ…Í­}µ•Ñ„ü¹…ÁÁÉ½Ù…±}É•ÅÕ¥É•°(€€€€€Ñ…Í­5•Ñ„é…™™¥±¥…Ñ•Q…Í¬ü¹Ñ…Í­}µ•Ñ…ññ¹Õ±°(€€€ô¤ì(€€€½¹ÍĞÕÍÑ½µÌõ•‘¥Ñ…‰±”¹™¥±Ñ•È¡ĞôùĞ¹Ñ…Í­}ÑåÁ”ôôôÕÍÑ½´œ¤ì(€€€½¹ÍĞÕÍÑ½´õÕÍÑ½µÍlÁtì(€€€Í•Ñ5½‰¥±•ÕÍÑ½µQ¥Ñ±”¡ÕÍÑ½´ü¹Ñ¥Ñ±•ñğœœ¤ì(€€€Í•Ñ5½‰¥±•ÕÍÑ½µÕ•…Ñ”¡ÕÍÑ½´ü¹‘Õ•}‘…Ñ•ñğœœ¤ì(€€€Í•Ñ5½‰¥±•áÑÉ…AÉ½µ¥Í•Ì¡ÕÍÑ½µÌ¹Í±¥” Ä¤¹µ…À¡Ğôø¡íÑ¥Ñ±”éĞ¹Ñ¥Ñ±•ñğœœ±‘Õ•…Ñ”éĞ¹‘Õ•}‘…Ñ•ñğœô¤¤¤ì(€€€½¹ÍĞí‘…Ñ„é•‘¥ÑáÁ•¹Í•Íôõ…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ Í…±•Í}•áÁ•¹Í•Ìœ¤¹Í•±•Ğ œ¨œ¤¹•Ä Í½ÕÉ•}Í…±•}¥œ±Í…±”¹¥¤¹•Ä ÕÍ•É}¥œ±ÕÉÉ•¹ÑµÀü¹¥¤¹½É‘•È É•…Ñ•‘}…Ğœ¤ì(€€€½¹ÍĞ•àõ•‘¥ÑáÁ•¹Í•ÍññmtìÍ•Ñ5½‰¥±•áÁ•¹Í•=Á•¸¡•à¹±•¹Ñ øÀ¤ìÍ•Ñ5½‰¥±•áÁ•¹Í•…Ñ•½Éä¡•álÁtü¹…Ñ•½ÉåñğŸ²ò²vÓ²*œ¤ìÍ•Ñ5½‰¥±•áÁ•¹Í•µ½Õ¹Ğ¡•álÁtü¹…µ½Õ¹ĞıMÑÉ¥¹œ¡•álÁt¹…µ½Õ¹Ğ¤èœœ¤ìÍ•Ñ5½‰¥±•áÁ•¹Í•5•µ¼¡•álÁtü¹µ•µ½ñğœœ¤ìÍ•Ñ5½‰¥±•áÑÉ…áÁ•¹Í•Ì¡•à¹Í±¥” Ä¤¹µ…À¡”ôø¡í…Ñ•½Éäé”¹…Ñ•½ÉåñğŸªâÃ¶ œ±…µ½Õ¹ĞéMÑÉ¥¹œ¡”¹…µ½Õ¹Ññğœœ¤±µ•µ¼é”¹µ•µ½ñğœô¤¤¤ì(€€€½¹ÍĞÁ±…¸õ•‘¥Ñ…‰±”¹™¥¹¡ĞôùĞ¹Ñ…Í­}ÑåÁ”ôôôÁ±…¸äÌññĞ¹Ñ…Í­}ÑåÁ”ôôôÁ±…¸ÄàÌœ¤ì(€€€Í•Ñ5½‰¥±•Q…É•ÑA±…¸¡Á±…¸ü¹Ñ…É•Ñ}Á±…¹ñğœœ¤ì(€ôì((€½¹ÍĞ…‘‘=¹”€ô€¡É¤õ¹Õ±°±¤õ¹Õ±°¤€ôøì(€€€¥˜¡±½­•¥É•ÑÕÉ¸ì(€€€Í•Ñ‘¥Ñ¥¹M…±”¡¹Õ±°¤ì(€€€Í•Ñ‘¥Ñ¥¹½µÁ±•Ñ•‘Q…Í­½Õ¹Ğ À¤ì(€€€½¹ÍĞ±…‰•°õ9Õµ‰•È¹¥Í%¹Ñ••È¡É¤¤˜™9Õµ‰•È¹¥Í%¹Ñ••È¡¤¤ıµ½‰¥±•1…‰•±½È¡É¤±¤¤èœœì(€€€Í•Ñ5½‰¥±•M…±•É…™Ğ¡íÉ¤±¤±±…‰•±ô¤ì(€€€Í•Ñ5½‰¥±••Ñ…¥±Í=Á•¸¡™…±Í”¤ì(€€€Í•Ñ5½‰¥±•…±=Á•¸¡™…±Í”¤ì(€€€Í•Ñ5½‰¥±•5½É•Y…Í=Á•¸¡™…±Í”¤ì(€€€Í•Ñ5½‰¥±•ÕÍÑ½µ•É9…µ” œœ¤ì(€€€Í•Ñ5½‰¥±•…É•-•åÌ¡mt¤ì(€€€Í•Ñ5½‰¥±•ÕÍÑ½µQ¥Ñ±” œœ¤ì(€€€Í•Ñ5½‰¥±•ÕÍÑ½µÕ•…Ñ” œœ¤ì(€€€Í•Ñ5½‰¥±•Q…É•ÑA±…¸ œœ¤ì(€€€Í•Ñ5½‰¥±•A…åµ•¹Ñ¥ÉÍÑ…Ñ” œœ¤ì(€€€Í•Ñ5½‰¥±•A…åµ•¹Ñ½Õ¹Ğ Ì¤ì(€€€Í•Ñ5½‰¥±•™™¥±¥…Ñ•…É¡í…É‘9…µ”èœœ±…ÁÁÉ½Ù…±I•ÅÕ¥É•é™…±Í”±Ñ…Í­5•Ñ„é¹Õ±±ô¤ì(€€€Í•Ñ5½‰¥±•Y…Í-•åÌ¡mt¤ì(€€€Í•Ñ5½‰¥±•MÑÉ…Ñ•¥A±…¸¡™…±Í”¤ì(€€€Í•Ñ5½‰¥±•	Õ¹‘±”É¹‘-•åÌ¡mt¤ì(€€€Í•Ñ5½‰¥±•	Õ¹‘±•M•…É  œœ¤ì(€€€Í•Ñ5½‰¥±•	Õ¹‘±•Y…Í5…À¡íô¤ì(€€€Í•Ñ5½‰¥±•	Õ¹‘±•M…±•QåÁ•5…À¡íô¤ì(€€€Í•Ñ5½‰¥±•UÍ•‘5¹Á	Õ¹‘±”¡™…±Í”¤ì(€€€Í•Ñ5½‰¥±•MÁ½ÑA½±¥å% œœ¤ì(€€€Í•Ñ5½‰¥±•MÁ½Ñ¥É•Ñ=Á•¸¡™…±Í”¤ì(€€€Í•Ñ5½‰¥±•MÁ½Ñ¥É•ÑQ¥Ñ±” œœ¤ì(€€€Í•Ñ5½‰¥±•MÁ½Ñ¥É•Ñµ½Õ¹Ğ œœ¤ì(€€€Í•Ñ5½‰¥±•MÁ½Ñ¥É•Ñ5•µ¼ œœ¤ì(€€€Í•Ñ5½‰¥±•áÁ•¹Í•=Á•¸¡™…±Í”¤ì(€€€Í•Ñ5½‰¥±•áÁ•¹Í•…Ñ•½Éä Ÿ²ò²vÓ²*œ¤ì(€€€Í•Ñ5½‰¥±•áÁ•¹Í•µ½Õ¹Ğ œœ¤ì(€€€Í•Ñ5½‰¥±•áÁ•¹Í•5•µ¼ œœ¤ì(€€€Í•Ñ5½‰¥±•áÑÉ…AÉ½µ¥Í•Ì¡mt¤ìÍ•Ñ5½‰¥±•áÑÉ…áÁ•¹Í•Ì¡mt¤ìÍ•Ñ5½‰¥±•M…±•-¥¹ œœ¤ìÍ•Ñ5½‰¥±•MÁ•¥…±A½±¥å% œœ¤ìÍ•Ñ5½‰¥±•MÁ•¥…±á•ÁÑ¥½¹µ½Õ¹Ğ œœ¤ì(€ôì((€½¹ÍĞ‰Õ¹‘±•É••µ½Õ¹ÑÌ€ô€¡‰Õ¹‘±•-•åÌõµ½‰¥±•	Õ¹‘±”É¹‘-•åÌ°Ù…Í5…Àõµ½‰¥±•	Õ¹‘±•Y…Í5…À°Í…±•QåÁ•5…Àõµ½‰¥±•	Õ¹‘±•M…±•QåÁ•5…À°¥¹±Õ‘•1•…åY…Í=™™Í•Ğõ™…±Í”¤€ôøì(€€€½¹ÍĞ‰Õ¹‘±•Q…‰±”õ½¹™¥œ¹‰Õ¹‘±”É¹‘ññU1Q}	U91É9ì(€€€½¹ÍĞÙ…ÍQ…‰±”õ½¹™¥œ¹Ù…ÍññU1Q}YLì(€€€±•Ğ‰Õ¹‘±•=™™Í•ĞôÀ°Ù…Í=™™Í•ĞôÀì(€€€€¡‰Õ¹‘±•-•åÍññmt¤¹™½É… ¡¬ôùì(€€€€€½¹ÍĞÍ…±•QåÁ”õÍ…±•QåÁ•5…Àü¹m­uñğ¹½Éµ…°œì(€€€€€½¹ÍĞÉ…Ñ”õ9Õµ‰•È¡‰Õ¹‘±•Q…‰±”¹™¥¹¡àôùà¹­•äôôõ¬¤ü¹É…Ñ•ñğÀ¤ì(€€€€€½¹ÍĞ¹½%¹ÍÕÉ…¹”ô¡Ù…Í5…Àü¹m­uññmt¤¹¥¹±Õ‘•Ì Ù…Í9½¹”œ¤ì(€€€€€½¹ÍĞ…ÁÁ±•]¥Ñ¡½ÕĞÄÄÔõ¬ôôô‰}ÁÁ±•]…Ñ œ˜™9Õµ‰•È¡µ½‰¥±•M…±•É…™Ğü¹¤¤„ôôÀì(€€€€€¥˜¡¥ÍM•ÁÑ•µ‰•ÉA½±¥åÑ¥Ù”¡µ½¹Ñ ¤¥ì(€€€€€€€‰Õ¹‘±•=™™Í•Ğ¬õ…±Õ±…Ñ•M•ÁÑ•µ‰•É	Õ¹‘±•M…±”¡íÉ…Ñ”±Í…±•QåÁ”±¥¹ÍÕÉ…¹•)½¥¹•è…¹½%¹ÍÕÉ…¹”±Á…É•¹ĞÄÄÔè……ÁÁ±•]¥Ñ¡½ÕĞÄÄÔ±¥ÍÁÁ±•]…Ñ é¬ôôô‰}ÁÁ±•]…Ñ ô¤¹½™™Í•Ğì(€€€€€õ•±Í”¥˜¡Í…±•QåÁ”ôôô™É•”œ¥‰Õ¹‘±•=™™Í•Ğ¬õÉ…Ñ”ì(€€€€€•±Í”É•ÑÕÉ¸ì(€€€€€¥˜¡¥¹±Õ‘•1•…åY…Í=™™Í•Ğ¤¡Ù…Í5…Àü¹m­uññmt¤¹™¥±Ñ•È¡ØôùØ„ôôÙ…Í9½¹”œ¤¹™½É… ¡Øôùì(€€€€€€€Ù…Í=™™Í•Ğ€¬ô9Õµ‰•È¡Ù…ÍQ…‰±”¹™¥¹¡àôùà¹­•äôôõØ¤ü¹É…Ñ•ñğÀ¤ì(€€€€€ô¤ì(€€€ô¤ì(€€€É•ÑÕÉ¸í‰Õ¹‘±•=™™Í•Ğ±Ù…Í=™™Í•Ñôì(€ôì(((€€¼¼ØÈÄ¸ĞØèƒªÖ³®Ê²‚€ÇªÆÓ²vƒ²‚W²ƒ¶2C®“ªÆÓ²ró®†pƒ²‚¶fc¶V€ƒ®V3®*P(€€¼¼ƒ¶fS®¦Ğƒ²¶s²v`ƒ®*C®šÀƒ²zC®>g²‚²z—²^@ƒ²vc²†Ó¶Vc² ƒ²V+ªÎ€ƒ²nC®Îàƒ²vó²vğƒ²GªÎ®–ğƒ²š'².p²^@ƒ²‚²z—¶V§®.#®.¸(€½¹ÍĞÁ•ÉÍ¥ÍÑ1•…å½¹Ù•ÉÑ•‘…äõ…Íå¹Œ¡¹•áÑ…ä¤ôùì(€€€½¹ÍĞ¹½Éµ…±¥é•õ¹½Éµ…±¥é•…ä¡¹•áÑ…ä¤ì(€€€Í•Ñ…ä¡¹½Éµ…±¥é•¤ì(€€€€¼¼ƒ®Âc®Ns².pƒ²²rÍ…Ù•…¥±å…ç®–ğƒªÆÃ²ÎC²Vğ‘…¥±åI•½É‘Ìƒ²¶s®>ƒ¶V£ªî`ƒªÂÇ².ƒ®BcªÎ€(€€€€¼¼µ•É•‘É…™ĞƒŠHƒ²w²
Ã²ÄƒŠHƒ²b#²ªâ'²^³ªÂ ƒ²š'².pƒ®.“².pƒªÎ²
Ã®B§®.#®.¸(€€€½¹ÍĞ½¬õ…İ…¥ĞÍ…Ù•…¥±å…ä¡Í•±•Ñ•‘…ä±¹½Éµ…±¥é•¤ì(€€€¥˜ …½¬¥Ñ¡É½Ü¹•ÜÉÉ½È Ÿ²vó²vğƒ².“²‚ƒ²‚²z—²^@ƒ².“¶2£¶Z#²*×®.#®.¸œ¤ì(€€€Á•¹‘¥¹I•˜¹ÕÉÉ•¹Ğõ¹Õ±°ì(€€€Í•ÑM…Ù•MÑ…Ñ” Í…Ù•œ¤ì(€€€Í•ÑQ¥µ•½ÕĞ  ¤ôùÍ•ÑM…Ù•MÑ…Ñ” ¥‘±”œ¤°ÄÈÀÀ¤ì(€€€É•ÑÕÉ¸¹½Éµ…±¥é•ì(€ôì((€½¹ÍĞÍÕ‰µ¥Ñ5½‰¥±•M…±”€ô…Íå¹Œ€ ¤€ôøì(€€€¥˜ …µ½‰¥±•M…±•É…™Ññğ…ÕÉÉ•¹ÑµÀü¹¥‘ññµ½‰¥±•MÕ‰µ¥ÑÕ…É‘I•˜¹ÕÉÉ•¹Ğ¥É•ÑÕÉ¸ì(€€€¥˜ …µ½‰¥±•M…±•-¥¹¥É•ÑÕÉ¸Í¡½İÁÁQ½…ÍĞ Ÿ¶2C®ƒªÖ³®Ú²vƒ²ƒ¶w¶VÓ²ó²ã²jP¸œ±íÑ½¹”è•ÉÉ½Èô¤ì(€€€¥˜¡…Ñ¥Ù•Q•…µMÕÁÁ½ÉĞ˜˜…Ñ•…µMÕÁÁ½ÉÑMÑ½É”¥É•ÑÕÉ¸Í¡½İÁÁQ½…ÍĞ Ÿ¶2 ƒ².“²‚²vƒ®Âc²b¶V€ƒ®“²z—²vƒ²ƒ¶w¶VÓ²ó²ã²jP¸œ±íÑ½¹”è•ÉÉ½Èô¤ì(€€€¥˜ …9Õµ‰•È¹¥Í%¹Ñ••È¡µ½‰¥±•M…±•É…™Ğ¹É¤¥ñğ…9Õµ‰•È¹¥Í%¹Ñ••È¡µ½‰¥±•M…±•É…™Ğ¹¤¤¥É•ÑÕÉ¸Í¡½İÁÁQ½…ÍĞ ŸªÂ²zªÖ³®ÚªÎğƒ²jSªâ#²‚sªÖÃ²vƒ²ƒ¶w¶VÓ²ó²ã²jP¸œ±íÑ½¹”è•ÉÉ½Èô¤ì(€€€½¹ÍĞÕÍÑ½µ•Èõµ½‰¥±•ÕÍÑ½µ•É9…µ”¹ÑÉ¥´ ¤ì(€€€¥˜ …ÕÍÑ½µ•È¥É•ÑÕÉ¸Í¡½İÁÁQ½…ÍĞ ŸªÎƒªÂw®ª²vƒ²z®‚—¶VÓ²Vğƒ².“²‚²vƒ®NÇ®†w¶V€ƒ²"`ƒ²z#²ZÓ²jP¸œ±íÑ½¹”è•ÉÉ½Èô¤ì(€€€¥˜¡µ½‰¥±•…É•-•åÌ¹¥¹±Õ‘•Ì Á…åµ•¹ĞÌœ¤˜˜…µ½‰¥±•A…åµ•¹Ñ¥ÉÍÑ…Ñ”¥É•ÑÕÉ¸Í¡½İÁÁQ½…ÍĞ œÏªÂs²nPƒ²jSªâ ƒ²"c®
§²v`ƒ²Ê¬ƒ²"c®
¤ƒ²b#²‚W²vó²vƒ²ƒ¶w¶VÓ²ó²ã²jP¸œ±íÑ½¹”è•ÉÉ½Èô¤ì(€€€¥˜¡µ½‰¥±•…É•-•åÌ¹¥¹±Õ‘•Ì …™™¥±¥…Ñ•…Éœ¤˜˜…MÑÉ¥¹œ¡µ½‰¥±•™™¥±¥…Ñ•…É¹…É‘9…µ•ñğœœ¤¹ÑÉ¥´ ¤¥É•ÑÕÉ¸Í¡½İÁÁQ½…ÍĞ Ÿ²V÷²7¶V€ƒ²‚s¶rÓ²æÓ®Ns®ª²vƒ²z®‚—¶VÓ²ó²ã²jP¸œ±íÑ½¹”è•ÉÉ½Èô¤ì(€€€¥˜¡µ½‰¥±•M…±•-¥¹ôôôÍÁ•¥…°œ€˜˜€…µ½‰¥±•MÁ•¥…±A½±¥å%¥ì(€€€€€É•ÑÕÉ¸Í¡½İ1•…å±•ÉĞ¡ÍÁ•¥…±A½±¥¥•Ì¹±•¹Ñ (€€€€€€€€ü€Ÿ¶*çªÂ ›²²vã²‚W²Æ²^@ƒ²‚²j§¶V€ƒ®ª£®6ãªÎğƒªÂ²zƒªÖ³®Ú²vƒ²ƒ¶w¶VÓ²ó²ã²jP¸œ(€€€€€€€€è€Ÿ¶b²z°ƒ²‚²j¤ƒªÂ®*—¶Vpƒ¶*çªÂ ›²²vã²‚W²Æ²vĞƒ²^²ZÓ²jP¸œ¤ì(€€€ô(€€€½¹ÍĞÍ…±•…Ñ”õ€‘íµ½¹Ñ¡ô´‘íÍ•±•Ñ•‘…åõ€ì(€€€½¹ÍĞ…±±½İ•‘M•½¹‘-•åÌõ¹•ÜM•Ğ¡l¸¸¹…±±½İ•‘M•½¹‘Y…Ì¡½¹™¥œ¹Ù…ÍññU1Q}YL¤¹µ…À¡àôùà¹­•ä¤°Ù…Í9½¹”t¤ì(€€€½¹ÍĞ¥¹Ù…±¥‘M•½¹‘Y…Ìõ=‰©•Ğ¹•¹ÑÉ¥•Ì¡µ½‰¥±•	Õ¹‘±•Y…Í5…Áññíô¤¹™±…Ñ5…À ¡m‰Õ¹‘±”±­•åÍt¤ôø¡­•åÍññmt¤¹™¥±Ñ•È¡¬ôø……±±½İ•‘M•½¹‘-•åÌ¹¡…Ì¡¬¤¤¹µ…À¡¬ôø¡í‰Õ¹‘±”±­•äé­ô¤¤¤ì(€€€¥˜¡¥¹Ù…±¥‘M•½¹‘Y…Ì¹±•¹Ñ ¥É•ÑÕÉ¸Í¡½İÁÁQ½…ÍĞ œÉ9²^C²pƒ²ƒ¶w¶V€ƒ²"`ƒ²^®*Pƒ®ÚªÂ²s®æ²*“ªÂ ƒ¶>³¶V£®>ğƒ²z#²ZÓ²jP¸YO®–ğƒ®.“².pƒ²ƒ¶w¶VÓ²ó²ã²jP¸œ±íÑ½¹”è•ÉÉ½Èô¤ì((€€€½¹ÍĞí‘…Ñ„é•á¥ÍÑ¥¹M…±•Ì±•ÉÉ½Èé•á¥ÍÑ¥¹ÉÉ½Éôõ…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ ÕÍÑ½µ•É}Í…±•Ìœ¤(€€€€€€¹Í•±•Ğ ¥±µ•ÑÉ¥}±…‰•°±Í½ÕÉ•}ÑåÁ”±ÕÍÑ½µ•ÉÌ¡ÕÍÑ½µ•É}¹…µ”¤œ¤(€€€€€€¹•Ä ÕÍ•É}¥œ±ÕÉÉ•¹ÑµÀ¹¥¤¹•Ä Í…±•}‘…Ñ”œ±Í…±•…Ñ”¤ì(€€€¥˜¡•á¥ÍÑ¥¹ÉÉ½È¥É•ÑÕÉ¸Í¡½İÁÁQ½…ÍĞ¡ƒ²’G®ÎÔƒ¶fW²vàƒ².“¶2 è€‘í™É¥•¹‘±åÉÉ½È¡•á¥ÍÑ¥¹ÉÉ½È¥õ€±íÑ½¹”è•ÉÉ½Èô¤ì(€€€½¹ÍĞ¹½Éµ…±¥é•‘9…µ”õÕÍÑ½µ•È¹É•Á±…” ½qÌ¬½œ°œœ¤¹Ñ½1½İ•É…Í” ¤ì(€€€½¹ÍĞÍ…µ•ÕÍÑ½µ•Èô¡•á¥ÍÑ¥¹M…±•Íññmt¤¹™¥±Ñ•È¡àôùà¹¥„ôõ•‘¥Ñ¥¹M…±”ü¹¥˜™MÑÉ¥¹œ¡à¹ÕÍÑ½µ•ÉÌü¹ÕÍÑ½µ•É}¹…µ•ñğœœ¤¹É•Á±…” ½qÌ¬½œ°œœ¤¹Ñ½1½İ•É…Í” ¤ôôõ¹½Éµ…±¥é•‘9…µ”¤ì(€€€½¹ÍĞÍ…µ•AÉ½‘ÕĞõÍ…µ•ÕÍÑ½µ•È¹™¥±Ñ•È¡àôùà¹µ•ÑÉ¥}±…‰•°ôôõµ½‰¥±•M…±•É…™Ğ¹±…‰•°¤ì(€€€¥˜¡Í…µ•ÕÍÑ½µ•È¹±•¹Ñ ¥ì(€€€€€½¹ÍĞ½¬õ…İ…¥ĞÍ¡½İÁÁ½¹™¥É´¡ì(€€€€€€€Ñ¥Ñ±”éÍ…µ•AÉ½‘ÕĞ¹±•¹Ñ üŸ²’G®ÎÔƒ®NÇ®†tƒªÂ®*—²Ç²vĞƒ²z#²ZÓ²jPœèŸªÂg²v ƒ®
€ƒ®>g²vğƒªÎƒªÂw²vĞƒ²z#²ZÓ²jPœ°(€€€€€€€µ•ÍÍ…”éÍ…µ•AÉ½‘ÕĞ¹±•¹Ñ (€€€€€€€€€€ü€‘íÍ…±•…Ñ•ôƒ
Ü€‘íÕÍÑ½µ•Éôƒ
Ü€‘íµ½‰¥±•M…±•É…™Ğ¹±…‰•±õq»®>g²vó¶Vpƒ¶2C®“ªÆÓ²vĞƒ²vÓ®¾àƒ²z#²ZÓ²jP¸ƒªŞã®zc®>ƒ²‚²z—¶Vƒªæ3²jPı€(€€€€€€€€€€è€‘íÍ…±•…Ñ•ôƒ
Ü€‘íÕÍÑ½µ•Éõq»®.“®–àƒ¶2C®“ªÆÓ²vĞƒ²vÓ®¾àƒ²z#²ZÓ²jP¸ƒ²ÚSªÂ ƒ®NÇ®†w²vĞƒ®{®*S² ƒ¶fW²vã¶VÓ²ó²ã²jP¹€°(€€€€€€€½¹™¥Éµ1…‰•°èŸ¶fW²vàƒ¶nƒ²‚²z”œ±Ñ½¹”èİ…É¹¥¹œœ(€€€€€ô¤ì(€€€€€¥˜ …½¬¥É•ÑÕÉ¸ì(€€€ô(€€€µ½‰¥±•MÕ‰µ¥ÑÕ…É‘I•˜¹ÕÉÉ•¹ĞõÑÉÕ”ì(€€€Í•Ñ5½‰¥±•M…±•M…Ù¥¹œ¡ÑÉÕ”¤ì((€€€ÑÉåì(€€€€€€¼¼ƒªâÃ²†Ğƒ¶2C®“ªÆĞƒ²"c²‚T(€€€€€¥˜¡•‘¥Ñ¥¹M…±”¥ì(€€€€€€€½¹ÍĞ½±‘5•Ñ„õ¥¹™•É5½‰¥±•5•Ñ„¡•‘¥Ñ¥¹M…±”¤ì(€€€€€€€¥˜ …½±‘5•Ñ„¥Ñ¡É½Ü¹•ÜÉÉ½È ŸªâÃ²†Ğƒ¶2C®“²‚W®ÎÓ®–ğƒ¶fW²vã¶V€ƒ²"`ƒ²^²*×®.#®.¸œ¤ì((€€€€€€€½¹ÍĞ±¥¹­•‘ÕÍÑ½µ•É%õ…İ…¥Ğ•¹ÍÕÉ•ÕÍÑ½µ•È¡ÕÉÉ•¹ÑµÀ¹¥±ÕÍÑ½µ•È±Í…±•…Ñ”¤ì(€€€€€€€¥˜ …±¥¹­•‘ÕÍÑ½µ•É%¥Ñ¡É½Ü¹•ÜÉÉ½È ŸªÎƒªÂtƒ²‚²z”ƒ².“¶2 œ¤ì((€€€€€€€€¼¼ƒ²vó²vğƒ².“²‚èƒªâÃ²†Ğ€ÇªÆĞƒ²Â£ªÂ@ƒŠHƒ²"c²‚WªÂH€ÇªÆĞƒ²ÚSªÂ (€€€€€€€½¹ÍĞ‰…Í”õ¹½Éµ…±¥é•…ä¡‘…ä¤ì(€€€€€€€½¹ÍĞµ…ÑÉ¥àõ‰…Í”¹µ…ÑÉ¥à¹µ…À¡Èôùl¸¸¹Ét¤ì(€€€€€€€µ…ÑÉ¥ám½±‘5•Ñ„¹É¥um½±‘5•Ñ„¹¥tõ5…Ñ ¹µ…à À±9Õµ‰•È¡µ…ÑÉ¥ám½±‘5•Ñ„¹É¥um½±‘5•Ñ„¹¥uñğÀ¤´Ä¤ì(€€€€€€€µ…ÑÉ¥ámµ½‰¥±•M…±•É…™Ğ¹É¥umµ½‰¥±•M…±•É…™Ğ¹¥tõ9Õµ‰•È¡µ…ÑÉ¥ámµ½‰¥±•M…±•É…™Ğ¹É¥umµ½‰¥±•M…±•É…™Ğ¹¥uñğÀ¤¬Äì((€€€€€€€½¹ÍĞÙ…Ìõì¸¸¸¡‰…Í”¹É½ÕÁÌü¹Ù…Íññíô¥ôì(€€€€€€€½¹ÍĞ½±‘	Õ¹‘±•Y…Í-•åÌõ½±‘5•Ñ„¹‰Õ¹‘±•Y…Í½µµ¥ÍÍ¥½¹á±Õ‘•ımté=‰©•Ğ¹Ù…±Õ•Ì¡½±‘5•Ñ„¹‰Õ¹‘±•Y…Í5…Áññíô¤¹™±…Ğ ¤ì(€€€€€€€l¸¸¸¡½±‘5•Ñ„¹Ù…Í-•åÍññmt¤°¸¸¹½±‘	Õ¹‘±•Y…Í-•åÍt¹™½É… ¡¬ôùì¥˜¡¬„ôôÙ…Í9½¹”œ¤Ù…Ím­tõ5…Ñ ¹µ…à À±9Õµ‰•È¡Ù…Ím­uñğÀ¤´Ä¤ìô¤ì(€€€€€€€€¡µ½‰¥±•Y…Í-•åÍññmt¤¹™½É… ¡¬ôùì(€€€€€€€€€¥˜¡¬„ôôÙ…Í9½¹”œ¥Ù…Ím­tõ9Õµ‰•È¡Ù…Ím­uñğÀ¤¬Äì(€€€€€€€ô¤ì((€€€€€€€½¹ÍĞ‰Õ¹‘±”É¹õì¸¸¸¡‰…Í”¹É½ÕÁÌü¹‰Õ¹‘±”É¹‘ññíô¥ôì(€€€€€€€€¡½±‘5•Ñ„¹‰Õ¹‘±”É¹‘-•åÍññmt¤¹™½É… ¡¬ôùí‰Õ¹‘±”É¹‘m­tõ5…Ñ ¹µ…à À±9Õµ‰•È¡‰Õ¹‘±”É¹‘m­uñğÀ¤´Ä¥ô¤ì(€€€€€€€€¡µ½‰¥±•	Õ¹‘±”É¹‘-•åÍññmt¤¹™½É… ¡¬ôùí‰Õ¹‘±”É¹‘m­tõ9Õµ‰•È¡‰Õ¹‘±”É¹‘m­uñğÀ¤¬Åô¤ì(€€€€€€€½¹ÍĞµ¹Á	Õ¹‘±”õì¸¸¸¡‰…Í”¹É½ÕÁÌü¹µ¹Á	Õ¹‘±•ññíô¥ôì(€€€€€€€¥˜¡½±‘5•Ñ„¹ÕÍ•‘5¹Á	Õ¹‘±”¥µ¹Á	Õ¹‘±”¹ÕÍ•‘5¹Á	Õ¹‘±”õ5…Ñ ¹µ…à À±9Õµ‰•È¡µ¹Á	Õ¹‘±”¹ÕÍ•‘5¹Á	Õ¹‘±•ñğÀ¤´Ä¤ì(€€€€€€€¥˜¡9Õµ‰•È¡µ½‰¥±•M…±•É…™Ğ¹É¤¤ôôôÔ€˜˜9Õµ‰•È¡µ½‰¥±•M…±•É…™Ğ¹¤¤ğôÌ€˜˜µ½‰¥±•UÍ•‘5¹Á	Õ¹‘±”¥µ¹Á	Õ¹‘±”¹ÕÍ•‘5¹Á	Õ¹‘±”õ9Õµ‰•È¡µ¹Á	Õ¹‘±”¹ÕÍ•‘5¹Á	Õ¹‘±•ñğÀ¤¬Äì((€€€€€€€½¹ÍĞ½±‘MÀõ½±‘5•Ñ„¹ÍÁ•¥…±A½±¥åññ•‘¥Ñ¥¹M…±”¹Í½ÕÉ•}µ•Ñ„ü¹ÍÁ•¥…±A½±¥åññíôì(€€€€€€€½¹ÍĞ½±‘É•”õ‰Õ¹‘±•É••µ½Õ¹ÑÌ¡½±‘5•Ñ„¹‰Õ¹‘±”É¹‘-•åÍññmt±½±‘5•Ñ„¹‰Õ¹‘±•Y…Í5…Áññíô±½±‘5•Ñ„¹‰Õ¹‘±•M…±•QåÁ•5…Áññíô±ÑÉÕ”¤ì(€€€€€€€½¹ÍĞ¹•İÉ•”õ‰Õ¹‘±•É••µ½Õ¹ÑÌ ¤ì(€€€€€€€½¹ÍĞ¹•İA½±¥äõÍÁ•¥…±A½±¥¥•Ì¹™¥¹¡ÀôùÀ¹¥ôôõµ½‰¥±•MÁ•¥…±A½±¥å%¤ì(€€€€€€€½¹ÍĞÕ¹Á…¥õµ½‰¥±•M…±•-¥¹ôôô¥¹•¹Ñ¥Ù•}Õ¹Á…¥œì(€€€€€€€½¹ÍĞ¹•İ5…ÑÉ¥á•”õÕ¹Á…¥ı9Õµ‰•È¡½¹™¥œ¹µ…ÑÉ¥àü¹mµ½‰¥±•M…±•É…™Ğ¹É¥tü¹mµ½‰¥±•M…±•É…™Ğ¹¥uñğÀ¤èÀì(€€€€€€€½¹ÍĞ•‘¥Ñ±±Y…Ìô¡µ½‰¥±•Y…Í-•åÍññmt¤¹™¥±Ñ•È¡¬ôù¬„ôôÙ…Í9½¹”œ¤ì(€€€€€€€½¹ÍĞ¹•İY…Í•”õÕ¹Á…¥ı•‘¥Ñ±±Y…Ì¹É•‘Õ” ¡ÍÕ´±¬¤ôùÍÕ´­9Õµ‰•È ¡½¹™¥œ¹Ù…Íññmt¤¹™¥¹¡ØôùØ¹­•äôôõ¬¤ü¹É…Ñ•ñğÀ¤°À¤èÀì(€€€€€€€½¹ÍĞÍÑÉ…Ñ•¥A½¥¹ÑÌõµ½‰¥±•MÑÉ…Ñ•¥A½¥¹Ğ¡íÍÑÉ…Ñ•¥A±…¸è„…µ½‰¥±•MÑÉ…Ñ•¥A±…¸±Ù…Í-•åÌéµ½‰¥±•Y…Í-•åÌ±‰Õ¹‘±•Y…Í5…Àéµ½‰¥±•	Õ¹‘±•Y…Í5…Áô¤ì(€€€€€€€½¹ÍĞÍÁ•¥…±=ÕÑ½µ”õµ½‰¥±•M…±•-¥¹ôôôÍÁ•¥…°œ˜™µ½‰¥±•MÁ•¥…±A½±¥å%˜™¥ÍM•ÁÑ•µ‰•ÉA½±¥åÑ¥Ù”¡µ½¹Ñ ¤ı…±Õ±…Ñ•M•ÁÑ•µ‰•ÉMÁ•¥…±M…±”¡íÁ½±¥å-•äéµ½‰¥±•MÁ•¥…±A½±¥å%±Á±…¹É½ÕÀéÍ•ÁÑ•µ‰•ÉA±…¹É½ÕÀ¡µ½‰¥±•M…±•É…™Ğ¹¤¤±ÍÑÉ…Ñ•¥A½¥¹ÑÌ±Í…±•…Ñ•ô¤é¹Õ±°ì(€€€€€€€½¹ÍĞ¹•İI•Á±…•µ•¹Ğõµ½‰¥±•M…±•-¥¹ôôôÍÁ•¥…°œ˜™µ½‰¥±•MÁ•¥…±A½±¥å%ı9Õµ‰•È¡ÍÁ•¥…±=ÕÑ½µ”ü¹…‘‘¥Ñ¥½¹…±µ½Õ¹Ğüı¹•İA½±¥äü¹É•Á±…•µ•¹Ñ}…µ½Õ¹Ğüı½±‘MÀ¹É•Á±…•µ•¹Ñµ½Õ¹ĞüüÀ¤èÀì(€€€€€€€½¹ÍĞ½±‘I•Á±…•µ•¹Ğõ9Õµ‰•È¡½±‘MÀ¹•á•ÁÑ¥½¹MÑ…ÑÕÌôôô…ÁÁÉ½Ù•œı½±‘MÀ¹•á•ÁÑ¥½¹ÁÁÉ½Ù•‘µ½Õ¹Ğé½±‘MÀ¹•á•ÁÑ¥½¹MÑ…ÑÕÌôôôÁ•¹‘¥¹œœüÀé½±‘MÀ¹É•Á±…•µ•¹Ñµ½Õ¹ÑñğÀ¤ì(€€€€€€€½¹ÍĞ¹•áÑ5•Ñ„õİ¥Ñ¡ÕÉÉ•¹ÑM…±•M¡•µ„¡µ•É•M…±•5•Ñ…AÉ•Í•ÉÙ¥¹1•…ä¡•‘¥Ñ¥¹M…±”¹Í½ÕÉ•}µ•Ñ…ññíô°ì(€€€€€€€€€±•…åM¡•µ…Y•ÉÍ¥½¸éÍ…±•M¡•µ…Y•ÉÍ¥½¸¡•‘¥Ñ¥¹M…±”¤°(€€€€€€€€€Á½±¥åM¹…ÁÍ¡½Ğé•‘¥Ñ¥¹M…±”¹Í½ÕÉ•}µ•Ñ„ü¹Á½±¥åM¹…ÁÍ¡½ÑññÕÉÉ•¹ÑA½±¥åM¹…ÁÍ¡½Ğ¡½¹™¥œ¤°(€€€€€€€€€É¤éµ½‰¥±•M…±•É…™Ğ¹É¤±¤éµ½‰¥±•M…±•É…™Ğ¹¤±ÍÑÉ…Ñ•¥A±…¸è„…µ½‰¥±•MÑÉ…Ñ•¥A±…¸±Ù…Í-•åÌéµ½‰¥±•Y…Í-•åÌ±‰Õ¹‘±”É¹‘-•åÌéµ½‰¥±•	Õ¹‘±”É¹‘-•åÌ±‰Õ¹‘±•Y…Í5…Àéµ½‰¥±•	Õ¹‘±•Y…Í5…À±‰Õ¹‘±•M…±•QåÁ•5…Àéµ½‰¥±•	Õ¹‘±•M…±•QåÁ•5…À±‰Õ¹‘±•Y…Í½µµ¥ÍÍ¥½¹á±Õ‘•éÑÉÕ”±ÕÍ•‘5¹Á	Õ¹‘±”è¡9Õµ‰•È¡µ½‰¥±•M…±•É…™Ğ¹É¤¤ôôôÔ€˜˜9Õµ‰•È¡µ½‰¥±•M…±•É…™Ğ¹¤¤ğôÌ€üµ½‰¥±•UÍ•‘5¹Á	Õ¹‘±”€è™…±Í”¤°(€€€€€€€€€ÍÁ•¥…±A½±¥äèµ½‰¥±•M…±•-¥¹ôôôÍÁ•¥…°œ€˜˜µ½‰¥±•MÁ•¥…±A½±¥å%€üíÁ½±¥å%éµ½‰¥±•MÁ•¥…±A½±¥å%±Á½±¥åQ¥Ñ±”é¹•İA½±¥äü¹Ñ¥Ñ±•ññ½±‘MÀ¹Á½±¥åQ¥Ñ±•ñğœœ±Á½±¥åQåÁ”è…‘‘¥Ñ¥Ù”œ±É•Á±…•µ•¹Ñµ½Õ¹Ğé¹•İI•Á±…•µ•¹Ğ±¹½Éµ…±5…ÑÉ¥á•”èÀ±¹½Éµ…±Y…Í•”èÀ±•±¥¥‰±”è„„¡ÍÁ•¥…±=ÕÑ½µ”ü¹•±¥¥‰±”üıÑÉÕ”¤±ÍÑÉ…Ñ•¥A½¥¹ÑÌ±Á½±¥åY•ÉÍ¥½¸éMAQ5	I}A=1%e}YIM%=9ô€èÕ¹Á…¥ıíÁ½±¥å%é¹Õ±°±Á½±¥åQ¥Ñ±”èŸ²vã²ó®¾ã²ªâ$ƒ¶*çªÂ œ±Á½±¥åQåÁ”è¥¹•¹Ñ¥Ù•}Õ¹Á…¥œ±É•Á±…•µ•¹Ñµ½Õ¹ĞèÀ±¹½Éµ…±5…ÑÉ¥á•”é¹•İ5…ÑÉ¥á•”±¹½Éµ…±Y…Í•”é¹•İY…Í•”±Á½±¥åY•ÉÍ¥½¸éMAQ5	I}A=1%e}YIM%=9ôé¹Õ±°(€€€€€€€ô¤¤ì((€€€€€€€½¹ÍĞí•ÉÉ½ÈéÍ…±•UÁ‘…Ñ•ÉÉ½Éôõ…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ ÕÍÑ½µ•É}Í…±•Ìœ¤(€€€€€€€€€€¹ÕÁ‘…Ñ”¡ì(€€€€€€€€€€€ÕÍÑ½µ•É}¥é±¥¹­•‘ÕÍÑ½µ•É%°(€€€€€€€€€€€µ•ÑÉ¥}±…‰•°éµ½‰¥±•M…±•É…™Ğ¹±…‰•°°(€€€€€€€€€€€Í¡•µ…}Ù•ÉÍ¥½¸éUII9Q}M1}M!5}YIM%=8°(€€€€€€€€€€€Í½ÕÉ•}µ•Ñ„é¹•áÑ5•Ñ„(€€€€€€€€€ô¤(€€€€€€€€€€¹•Ä ¥œ±•‘¥Ñ¥¹M…±”¹¥¤(€€€€€€€€€€¹•Ä ÕÍ•É}¥œ±ÕÉÉ•¹ÑµÀ¹¥¤ì(€€€€€€€¥˜¡Í…±•UÁ‘…Ñ•ÉÉ½È¥Ñ¡É½ÜÍ…±•UÁ‘…Ñ•ÉÉ½Èì((€€€€€€€€¼¼ƒ²f®0ƒ²V÷²7²v ƒ®ÎÓ²†Ó¶VcªÎ€°ƒ®¾ã²f®0ƒ²V÷²7®0ƒ¶b²z°ƒ²z®‚—ªÂK²ró®†pƒ®.“².pƒªÖ³²Ä(€€€€€€€…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ ÕÍÑ½µ•É}Ñ…Í­Ìœ¤(€€€€€€€€€€¹ÕÁ‘…Ñ”¡íÕÍÑ½µ•É}¥é±¥¹­•‘ÕÍÑ½µ•É%±ÕÁ‘…Ñ•‘}…Ğé¹•Ü…Ñ” ¤¹Ñ½%M=MÑÉ¥¹œ ¥ô¤(€€€€€€€€€€¹•Ä Í½ÕÉ•}Í…±•}¥œ±•‘¥Ñ¥¹M…±”¹¥¤(€€€€€€€€€€¹•Ä ÕÍ•É}¥œ±ÕÉÉ•¹ÑµÀ¹¥¤ì((€€€€€€€½¹ÍĞí•ÉÉ½Èé‘•±•Ñ•Q…Í­ÉÉ½Éôõ…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ ÕÍÑ½µ•É}Ñ…Í­Ìœ¤(€€€€€€€€€€¹‘•±•Ñ” ¤(€€€€€€€€€€¹•Ä Í½ÕÉ•}Í…±•}¥œ±•‘¥Ñ¥¹M…±”¹¥¤(€€€€€€€€€€¹•Ä ÕÍ•É}¥œ±ÕÉÉ•¹ÑµÀ¹¥¤(€€€€€€€€€€¹¹•Ä ÍÑ…ÑÕÌœ°½µÁ±•Ñ•œ¤ì(€€€€€€€¥˜¡‘•±•Ñ•Q…Í­ÉÉ½È¥Ñ¡É½Ü‘•±•Ñ•Q…Í­ÉÉ½Èì((€€€€€€€½¹ÍĞí‘…Ñ„é½µÁ±•Ñ•‘A…åµ•¹ÑQ…Í­Íôõ…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ ÕÍÑ½µ•É}Ñ…Í­Ìœ¤¹Í•±•Ğ Ñ…Í­}ÑåÁ”œ¤¹•Ä Í½ÕÉ•}Í…±•}¥œ±•‘¥Ñ¥¹M…±”¹¥¤¹•Ä ÕÍ•É}¥œ±ÕÉÉ•¹ÑµÀ¹¥¤¹•Ä ÍÑ…ÑÕÌœ°½µÁ±•Ñ•œ¤¹±¥­” Ñ…Í­}ÑåÁ”œ°Á…åµ•¹ĞÍ|”œ¤ì(€€€€€€€½¹ÍĞ½µÁ±•Ñ•‘A…åµ•¹ÑQåÁ•Ìõ¹•ÜM•Ğ ¡½µÁ±•Ñ•‘A…åµ•¹ÑQ…Í­Íññmt¤¹µ…À¡àôùà¹Ñ…Í­}ÑåÁ”¤¤ì(€€€€€€€½¹ÍĞÑ…Í­I½İÌõmtì(€€€€€€€µ½‰¥±•…É•-•åÌ¹™½É… ¡­•äôùì(€€€€€€€€€½¹ÍĞĞõI}Q5A1QL¹™¥¹¡àôùà¹­•äôôõ­•ä¤ì(€€€€€€€€€¥˜ …Ğ¥É•ÑÕÉ¸ì(€€€€€€€€€¥˜¡Ğ¹É•Á•…Ñ½Õ¹Ğ¥ì(€€€€€€€€€€€™½È¡±•Ğ¤ôÀí¤ñµ½‰¥±•A…åµ•¹Ñ½Õ¹Ğí¤¬¬¥ì(€€€€€€€€€€€€€½¹ÍĞÑ…Í­QåÁ”õ€‘í­•åõ|‘í¤¬Åõ€ì(€€€€€€€€€€€€€¥˜¡½µÁ±•Ñ•‘A…åµ•¹ÑQåÁ•Ì¹¡…Ì¡Ñ…Í­QåÁ”¤¥½¹Ñ¥¹Õ”ì(€€€€€€€€€€€€€Ñ…Í­I½İÌ¹ÁÕÍ ¡íÕÍ•É}¥éÕÉÉ•¹ÑµÀ¹¥±ÕÍÑ½µ•É}¥é±¥¹­•‘ÕÍÑ½µ•É%±Í½ÕÉ•}Í…±•}¥é•‘¥Ñ¥¹M…±”¹¥±Ñ…Í­}ÑåÁ”éÑ…Í­QåÁ”±Ñ¥Ñ±”é€‘íĞ¹Ñ¥Ñ±•ô€ ‘í¤¬Åô¼‘íµ½‰¥±•A…åµ•¹Ñ½Õ¹Ñ÷¶j0¥€±‰…Í•}‘…Ñ”éÍ…±•…Ñ”±É•Ñ•¹Ñ¥½¹}‘…åÌé¹Õ±°±‘Õ•}‘…Ñ”é…‘‘5½¹Ñ¡Í…Ñ”¡µ½‰¥±•A…åµ•¹Ñ¥ÉÍÑ…Ñ”±¤¤±ÍÑ…ÑÕÌèÁ•¹‘¥¹œœ±¹½Ñ”èŸ®ª£®N€ƒ¶j3²Â£®–ğƒ²f®3¶V€ƒ®V3ªæ3² ƒªÂƒªâÃ¶Vs²^@ƒ®Âc®ÎÔƒ¶Fs².pô¤ì(€€€€€€€€€€€ô(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€ô(€€€€€€€€€¥˜¡­•äôôô…™™¥±¥…Ñ•…Éœ¥ì(€€€€€€€€€€€½¹ÍĞÁÉ•Ù¥½ÕÌõµ½‰¥±•™™¥±¥…Ñ•…É¹Ñ…Í­5•Ñ…ññíôì(€€€€€€€€€€€Ñ…Í­I½İÌ¹ÁÕÍ ¡ì(€€€€€€€€€€€€€ÕÍ•É}¥éÕÉÉ•¹ÑµÀ¹¥±ÕÍÑ½µ•É}¥é±¥¹­•‘ÕÍÑ½µ•É%±Í½ÕÉ•}Í…±•}¥é•‘¥Ñ¥¹M…±”¹¥°(€€€€€€€€€€€€€Ñ…Í­}ÑåÁ”é­•ä±Ñ¥Ñ±”éĞ¹Ñ¥Ñ±”±‰…Í•}‘…Ñ”éÍ…±•…Ñ”±É•Ñ•¹Ñ¥½¹}‘…åÌé¹Õ±°±‘Õ•}‘…Ñ”éÍ…±•…Ñ”±ÍÑ…ÑÕÌèÁ•¹‘¥¹œœ°(€€€€€€€€€€€€€Ñ…Í­}µ•Ñ„éì¸¸¹ÁÉ•Ù¥½ÕÌ±…É‘}¹…µ”éµ½‰¥±•™™¥±¥…Ñ•…É¹…É‘9…µ”¹ÑÉ¥´ ¤±…ÁÁÉ½Ù…±}É•ÅÕ¥É•è„…µ½‰¥±•™™¥±¥…Ñ•…É¹…ÁÁÉ½Ù…±I•ÅÕ¥É•±…É‘}ÍÑ…”éÁÉ•Ù¥½ÕÌ¹…É‘}ÍÑ…•ñğ‰•™½É•}…ÁÁ±¥…Ñ¥½¸œ±…ÁÁÉ½Ù…±}½µÁ±•Ñ•è„…ÁÉ•Ù¥½ÕÌ¹…ÁÁÉ½Ù…±}½µÁ±•Ñ•±…ÕÑ½Á…å}É•¥ÍÑ•É•è„…ÁÉ•Ù¥½ÕÌ¹…ÕÑ½Á…å}É•¥ÍÑ•É•‘ô(€€€€€€€€€€€ô¤ì(€€€€€€€€€€€É•ÑÕÉ¸ì(€€€€€€€€€ô(€€€€€€€€€Ñ…Í­I½İÌ¹ÁÕÍ ¡ì(€€€€€€€€€€€ÕÍ•É}¥éÕÉÉ•¹ÑµÀ¹¥°(€€€€€€€€€€€ÕÍÑ½µ•É}¥é±¥¹­•‘ÕÍÑ½µ•É%°(€€€€€€€€€€€Í½ÕÉ•}Í…±•}¥é•‘¥Ñ¥¹M…±”¹¥°(€€€€€€€€€€€Ñ…Í­}ÑåÁ”é­•ä°(€€€€€€€€€€€Ñ¥Ñ±”éĞ¹Ñ¥Ñ±”°(€€€€€€€€€€€‰…Í•}‘…Ñ”éÍ…±•…Ñ”°(€€€€€€€€€€€É•Ñ•¹Ñ¥½¹}‘…åÌéĞ¹É•Ñ•¹Ñ¥½¹…åÌ°(€€€€€€€€€€€‘Õ•}‘…Ñ”é…‘‘…åÍ…Ñ”¡Í…±•…Ñ”±Ğ¹É•Ñ•¹Ñ¥½¹…åÌ¤°(€€€€€€€€€€€ÍÑ…ÑÕÌèÁ•¹‘¥¹œœ°(€€€€€€€€€€€Ñ…É•Ñ}Á±…¸è¡­•äôôôÁ±…¸äÌññ­•äôôôÁ±…¸ÄàÌœ¤€üµ½‰¥±•Q…É•ÑA±…¸¹ÑÉ¥´ ¥ññ¹Õ±°€è¹Õ±°(€€€€€€€€€ô¤ì(€€€€€€€ô¤ì(€€€€€€€míÑ¥Ñ±”éµ½‰¥±•ÕÍÑ½µQ¥Ñ±”±‘Õ•…Ñ”éµ½‰¥±•ÕÍÑ½µÕ•…Ñ•ô°¸¸¸¡µ½‰¥±•áÑÉ…AÉ½µ¥Í•Íññmt¥t¹™¥±Ñ•È¡àôùMÑÉ¥¹œ¡à¹Ñ¥Ñ±•ñğœœ¤¹ÑÉ¥´ ¤˜™à¹‘Õ•…Ñ”¤¹™½É… ¡àôùÑ…Í­I½İÌ¹ÁÕÍ ¡ì(€€€€€€€€€ÕÍ•É}¥éÕÉÉ•¹ÑµÀ¹¥±ÕÍÑ½µ•É}¥é±¥¹­•‘ÕÍÑ½µ•É%±Í½ÕÉ•}Í…±•}¥é•‘¥Ñ¥¹M…±”¹¥±Ñ…Í­}ÑåÁ”èÕÍÑ½´œ±Ñ¥Ñ±”éMÑÉ¥¹œ¡à¹Ñ¥Ñ±”¤¹ÑÉ¥´ ¤±‰…Í•}‘…Ñ”éÍ…±•…Ñ”±É•Ñ•¹Ñ¥½¹}‘…åÌé¹Õ±°±‘Õ•}‘…Ñ”éà¹‘Õ•…Ñ”±ÍÑ…ÑÕÌèÁ•¹‘¥¹œœ(€€€€€€€ô¤¤ì(€€€€€€€¥˜¡Ñ…Í­I½İÌ¹±•¹Ñ ¥ì½¹ÍĞí•ÉÉ½ÈéÑ…Í­%¹Í•ÉÑÉÉ½Éôõ…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ ÕÍÑ½µ•É}Ñ…Í­Ìœ¤¹¥¹Í•ÉĞ¡Ñ…Í­I½İÌ¹µ…À¡É½Üôø¡ì¸¸¹É½Ü±Ñ…Í­}µ•Ñ„éÉ½Ü¹Ñ…Í­}µ•Ñ…ññíõô¤¤¤ì¥˜¡Ñ…Í­%¹Í•ÉÑÉÉ½È¥Ñ¡É½ÜÑ…Í­%¹Í•ÉÑÉÉ½Èìô(€€€€€€€…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ Í…±•Í}•áÁ•¹Í•Ìœ¤¹‘•±•Ñ” ¤¹•Ä Í½ÕÉ•}Í…±•}¥œ±•‘¥Ñ¥¹M…±”¹¥¤¹•Ä ÕÍ•É}¥œ±ÕÉÉ•¹ÑµÀ¹¥¤ì(€€€€€€€¥˜¡µ½‰¥±•áÁ•¹Í•=Á•¸¥ì½¹ÍĞ•áÁI½İÌõmí…Ñ•½Éäéµ½‰¥±•áÁ•¹Í•…Ñ•½Éä±…µ½Õ¹Ğéµ½‰¥±•áÁ•¹Í•µ½Õ¹Ğ±µ•µ¼éµ½‰¥±•áÁ•¹Í•5•µ½ô°¸¸¸¡µ½‰¥±•áÑÉ…áÁ•¹Í•Íññmt¥t¹™¥±Ñ•È¡àôù9Õµ‰•È¡à¹…µ½Õ¹Ğ¤øÀ¤ì¥˜¡•áÁI½İÌ¹±•¹Ñ ¥ì½¹ÍĞí•ÉÉ½Èé•áÉÉôõ…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ Í…±•Í}•áÁ•¹Í•Ìœ¤¹¥¹Í•ÉĞ¡•áÁI½İÌ¹µ…À¡àôø¡íÕÍ•É}¥éÕÉÉ•¹ÑµÀ¹¥±Í½ÕÉ•}Í…±•}¥é•‘¥Ñ¥¹M…±”¹¥±•áÁ•¹Í•}‘…Ñ”éÍ…±•…Ñ”±…µ½Õ¹Ğé9Õµ‰•È¡à¹…µ½Õ¹Ğ¤±…Ñ•½Éäéà¹…Ñ•½ÉåñğŸªâÃ¶ œ±ÕÍÑ½µ•É}¹…µ”éÕÍÑ½µ•È±µ•µ¼éMÑÉ¥¹œ¡à¹µ•µ½ñğœœ¤¹ÑÉ¥´ ¥ññ¹Õ±±ô¤¤¤ì¥˜¡•áÉÈ¥Ñ¡É½Ü•áÉÈìôô((€€€€€€€µÕÑ…Ñ”¡ì¸¸¹‰…Í”±µ…ÑÉ¥à±É½ÕÁÌéì¸¸¹‰…Í”¹É½ÕÁÌ±Ù…Ì±‰Õ¹‘±”É¹±µ¹Á	Õ¹‘±•ô±ÍÁ•¥…±5…ÑÉ¥á=™™Í•Ğé5…Ñ ¹µ…à À±9Õµ‰•È¡‰…Í”¹ÍÁ•¥…±5…ÑÉ¥á=™™Í•ÑñğÀ¤µ9Õµ‰•È¡½±‘MÀ¹¹½Éµ…±5…ÑÉ¥á••ñğÀ¤­¹•İ5…ÑÉ¥á•”¤±ÍÁ•¥…±Y…Í=™™Í•Ğé5…Ñ ¹µ…à À±9Õµ‰•È¡‰…Í”¹ÍÁ•¥…±Y…Í=™™Í•ÑñğÀ¤µ9Õµ‰•È¡½±‘MÀ¹¹½Éµ…±Y…Í••ñğÀ¤­¹•İY…Í•”¤±ÍÁ•¥…±I•Á±…•µ•¹ÑA…äé5…Ñ ¹µ…à À±9Õµ‰•È¡‰…Í”¹ÍÁ•¥…±I•Á±…•µ•¹ÑA…åñğÀ¤µ½±‘I•Á±…•µ•¹Ğ­¹•İI•Á±…•µ•¹Ğ¤°(€€€€€€€€€‰Õ¹‘±•É••=™™Í•Ğé5…Ñ ¹µ…à À±9Õµ‰•È¡‰…Í”¹‰Õ¹‘±•É••=™™Í•ÑñğÀ¤µ9Õµ‰•È¡½±‘É•”¹‰Õ¹‘±•=™™Í•ÑñğÀ¤­9Õµ‰•È¡¹•İÉ•”¹‰Õ¹‘±•=™™Í•ÑñğÀ¤¤°(€€€€€€€€€‰Õ¹‘±•É••Y…Í=™™Í•Ğé5…Ñ ¹µ…à À±9Õµ‰•È¡‰…Í”¹‰Õ¹‘±•É••Y…Í=™™Í•ÑñğÀ¤µ9Õµ‰•È¡½±‘É•”¹Ù…Í=™™Í•ÑñğÀ¤­9Õµ‰•È¡¹•İÉ•”¹Ù…Í=™™Í•ÑñğÀ¤¤(€€€€€€€ô¤ì(€€€€€€€Í•Ñ5½‰¥±•M…±•É…™Ğ¡¹Õ±°¤ì(€€€€€€€Í•Ñ‘¥Ñ¥¹M…±”¡¹Õ±°¤ì(€€€€€€€Í•Ñ‘¥Ñ¥¹½µÁ±•Ñ•‘Q…Í­½Õ¹Ğ À¤ì(€€€€€€€Í•ÑQ¥µ•½ÕĞ¡±½…‘…åM…±•Ì°ÄÔÀ¤ì(€€€€€€€Í¡½İÁÁQ½…ÍĞ Ÿ¶2C®“ªÆÓªÎğƒªÎƒªÂtƒ²V÷²7²vƒ²"c²‚W¶Z#²ZÓ²jP¸œ¤ì(€€€€€€€É•ÑÕÉ¸ì(€€€€€ô((€€€€€€¼¼ƒ².ƒªŞpƒ¶2C®ƒ®NÇ®†t€¼ƒªÖ³®Ê²‚€ÇªÆĞƒ®Î×²n@(€€€€€±•Ğ±•…å	…Í•=Ù•ÉÉ¥‘”õ¹Õ±°ì(€€€€€¥˜¡±•…å½¹Ù•ÉÍ¥½¸ü¹­¥¹ôôôµ½‰¥±”œ¥ì(€€€€€€€½¹ÍĞ‰…Í”õ¹½Éµ…±¥é•…ä¡‘…ä¤ì(€€€€€€€½¹ÍĞµ…ÑÉ¥àõ‰…Í”¹µ…ÑÉ¥à¹µ…À¡Èôùl¸¸¹Ét¤ì(€€€€€€€µ…ÑÉ¥ám±•…å½¹Ù•ÉÍ¥½¸¹É¥um±•…å½¹Ù•ÉÍ¥½¸¹¥tõ5…Ñ ¹µ…à À±9Õµ‰•È¡µ…ÑÉ¥ám±•…å½¹Ù•ÉÍ¥½¸¹É¥um±•…å½¹Ù•ÉÍ¥½¸¹¥uñğÀ¤´Ä¤ì(€€€€€€€±•…å	…Í•=Ù•ÉÉ¥‘”õì¸¸¹‰…Í”±µ…ÑÉ¥áôì(€€€€€ô(€€€€€½¹ÍĞÍ…±•A½±¥åM¹…ÁÍ¡½ĞõÕÉÉ•¹ÑA½±¥åM¹…ÁÍ¡½Ğ¡½¹™¥œ¤ì(€€€€€½¹ÍĞÍ…Ù•õ…İ…¥ĞÉ•…Ñ•ÕÍÑ½µ•ÉM…±•¹‘Q…Í­Ì¡ì(€€€€€€€ÕÍ•É%éÕÉÉ•¹ÑµÀ¹¥±ÕÍÑ½µ•É9…µ”éÕÍÑ½µ•È±Í…±•…Ñ”°(€€€€€€€µ•ÑÉ¥1…‰•°éµ½‰¥±•M…±•É…™Ğ¹±…‰•°±Í½ÕÉ•QåÁ”èµ½‰¥±”œ°(€€€€€€€Ñ•µÁ±…Ñ•-•åÌéµ½‰¥±•…É•-•åÌ±ÕÍÑ½µQ¥Ñ±”éµ½‰¥±•ÕÍÑ½µQ¥Ñ±”±ÕÍÑ½µÕ•…Ñ”éµ½‰¥±•ÕÍÑ½µÕ•…Ñ”°(€€€€€€€Ñ…É•ÑA±…¸éµ½‰¥±•Q…É•ÑA±…¸°(€€€€€€€Á…åµ•¹Ñ¥ÉÍÑ…Ñ”éµ½‰¥±•A…åµ•¹Ñ¥ÉÍÑ…Ñ”°(€€€€€€€Á…åµ•¹Ñ½Õ¹Ğéµ½‰¥±•A…åµ•¹Ñ½Õ¹Ğ°(€€€€€€€…™™¥±¥…Ñ•…Ééµ½‰¥±•™™¥±¥…Ñ•…É°(€€€€€€€Í½ÕÉ•5•Ñ„éíÉ¤éµ½‰¥±•M…±•É…™Ğ¹É¤±¤éµ½‰¥±•M…±•É…™Ğ¹¤±Á½±¥åM¹…ÁÍ¡½ĞéÍ…±•A½±¥åM¹…ÁÍ¡½Ğ±ÍÑÉ…Ñ•¥A±…¸è„…µ½‰¥±•MÑÉ…Ñ•¥A±…¸±Ù…Í-•åÌéµ½‰¥±•Y…Í-•åÌ±‰Õ¹‘±”É¹‘-•åÌéµ½‰¥±•	Õ¹‘±”É¹‘-•åÌ±‰Õ¹‘±•Y…Í5…Àéµ½‰¥±•	Õ¹‘±•Y…Í5…À±‰Õ¹‘±•M…±•QåÁ•5…Àéµ½‰¥±•	Õ¹‘±•M…±•QåÁ•5…À±‰Õ¹‘±•Y…Í½µµ¥ÍÍ¥½¹á±Õ‘•éÑÉÕ”±ÕÍ•‘5¹Á	Õ¹‘±”è¡9Õµ‰•È¡µ½‰¥±•M…±•É…™Ğ¹É¤¤ôôôÔ€˜˜9Õµ‰•È¡µ½‰¥±•M…±•É…™Ğ¹¤¤ğôÌ€üµ½‰¥±•UÍ•‘5¹Á	Õ¹‘±”€è™…±Í”¤±Ñ•…µ=¹±äé…Ñ¥Ù•Q•…µMÕÁÁ½ÉĞ±É•‘¥Ñ•‘MÑ½É”é…Ñ¥Ù•Q•…µMÕÁÁ½ÉĞıÑ•…µMÕÁÁ½ÉÑMÑ½É”é¹Õ±°°(€€€€€€€€€ÍÁ•¥…±A½±¥äèµ½‰¥±•M…±•-¥¹ôôôÍÁ•¥…°œ€˜˜µ½‰¥±•MÁ•¥…±A½±¥å%€üíÁ½±¥å%éµ½‰¥±•MÁ•¥…±A½±¥å%±Á½±¥åQåÁ”è…‘‘¥Ñ¥Ù”ô€èµ½‰¥±•M…±•-¥¹ôôô¥¹•¹Ñ¥Ù•}Õ¹Á…¥œıíÁ½±¥åQåÁ”è¥¹•¹Ñ¥Ù•}Õ¹Á…¥œ±Á½±¥åQ¥Ñ±”èŸ²vã²ó®¾ã²ªâ$ƒ¶*çªÂ ôé¹Õ±±ô(€€€€€ô¤ì(€€€€€¥˜ ¡µ½‰¥±•áÑÉ…AÉ½µ¥Í•Íññmt¤¹±•¹Ñ ¥ì½¹ÍĞÉ½İÌõµ½‰¥±•áÑÉ…AÉ½µ¥Í•Ì¹™¥±Ñ•È¡àôùMÑÉ¥¹œ¡à¹Ñ¥Ñ±•ñğœœ¤¹ÑÉ¥´ ¤˜™à¹‘Õ•…Ñ”¤¹µ…À¡àôø¡íÕÍ•É}¥éÕÉÉ•¹ÑµÀ¹¥±ÕÍÑ½µ•É}¥éÍ…Ù•¹ÕÍÑ½µ•É%±Í½ÕÉ•}Í…±•}¥éÍ…Ù•¹Í…±•%±Ñ…Í­}ÑåÁ”èÕÍÑ½´œ±Ñ¥Ñ±”éMÑÉ¥¹œ¡à¹Ñ¥Ñ±”¤¹ÑÉ¥´ ¤±‰…Í•}‘…Ñ”éÍ…±•…Ñ”±‘Õ•}‘…Ñ”éà¹‘Õ•…Ñ”±ÍÑ…ÑÕÌèÁ•¹‘¥¹œœ±Ñ…Í­}µ•Ñ„éíõô¤¤ì¥˜¡É½İÌ¹±•¹Ñ ¥í½¹ÍĞí•ÉÉ½Éôõ…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ ÕÍÑ½µ•É}Ñ…Í­Ìœ¤¹¥¹Í•ÉĞ¡É½İÌ¤í¥˜¡•ÉÉ½È¥Ñ¡É½Ü•ÉÉ½Èíôô((€€€€€¥˜€¡µ½‰¥±•MÁ½ÑA½±¥å%¤ì(€€€€€€€½¹ÍĞí•ÉÉ½ÈéÍÁ½ÑÉÉ½Éôõ…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ ÍÁ½Ñ}±…¥µÌœ¤¹¥¹Í•ÉĞ¡ì(€€€€€€€€€Á½±¥å}¥éµ½‰¥±•MÁ½ÑA½±¥å%°(€€€€€€€€€ÕÍ•É}¥éÕÉÉ•¹ÑµÀ¹¥°(€€€€€€€€€±…¥µ}‘…Ñ”éÍ…±•…Ñ”°(€€€€€€€€€ÕÍÑ½µ•É}¹…µ”éÕÍÑ½µ•È°(€€€€€€€€€ÍÑ…ÑÕÌèÁ•¹‘¥¹œœ°(€€€€€€€€€Í½ÕÉ•}½¹Ñ•áĞèµ½‰¥±”œ(€€€€€€€ô¤ì(€€€€€€€¥˜€¡ÍÁ½ÑÉÉ½È¤Ñ¡É½ÜÍÁ½ÑÉÉ½Èì(€€€€€ô•±Í”¥˜€ …¥ÍM•ÁÑ•µ‰•ÉA½±¥åÑ¥Ù”¡µ½¹Ñ ¤€˜˜µ½‰¥±•MÁ½Ñ¥É•Ñ=Á•¸€˜˜µ½‰¥±•MÁ½Ñ¥É•ÑQ¥Ñ±”¹ÑÉ¥´ ¤€˜˜9Õµ‰•È¡µ½‰¥±•MÁ½Ñ¥É•Ñµ½Õ¹Ğ¤øÀ¤ì(€€€€€€€½¹ÍĞí•ÉÉ½ÈéÍÁ½Ñ¥É•ÑÉÉ½Éôõ…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ ÍÁ½Ñ}±…¥µÌœ¤¹¥¹Í•ÉĞ¡ì(€€€€€€€€€Á½±¥å}¥é¹Õ±°°(€€€€€€€€€ÕÍ•É}¥éÕÉÉ•¹ÑµÀ¹¥°(€€€€€€€€€±…¥µ}‘…Ñ”éÍ…±•…Ñ”°(€€€€€€€€€ÕÍÑ½µ•É}¹…µ”éÕÍÑ½µ•È°(€€€€€€€€€ÍÑ…ÑÕÌèÁ•¹‘¥¹œœ°(€€€€€€€€€‘¥É•Ñ}Ñ¥Ñ±”éµ½‰¥±•MÁ½Ñ¥É•ÑQ¥Ñ±”¹ÑÉ¥´ ¤°(€€€€€€€€€‘¥É•Ñ}…µ½Õ¹Ğé9Õµ‰•È¡µ½‰¥±•MÁ½Ñ¥É•Ñµ½Õ¹Ğ¤°(€€€€€€€€€‘¥É•Ñ}µ•µ¼éµ½‰¥±•MÁ½Ñ¥É•Ñ5•µ¼¹ÑÉ¥´ ¥ññ¹Õ±°°(€€€€€€€€€Í½ÕÉ•}½¹Ñ•áĞèµ½‰¥±”œ(€€€€€€€ô¤ì(€€€€€€€¥˜€¡ÍÁ½Ñ¥É•ÑÉÉ½È¤Ñ¡É½ÜÍÁ½Ñ¥É•ÑÉÉ½Èì(€€€€€ô((€€€€€¥˜€¡µ½‰¥±•áÁ•¹Í•=Á•¸¤ì(€€€€€€€½¹ÍĞ•áÁI½İÌõmí…Ñ•½Éäéµ½‰¥±•áÁ•¹Í•…Ñ•½Éä±…µ½Õ¹Ğéµ½‰¥±•áÁ•¹Í•µ½Õ¹Ğ±µ•µ¼éµ½‰¥±•áÁ•¹Í•5•µ½ô°¸¸¸¡µ½‰¥±•áÑÉ…áÁ•¹Í•Íññmt¥t¹™¥±Ñ•È¡àôù9Õµ‰•È¡à¹…µ½Õ¹Ğ¤øÀ¤ì(€€€€€€€¥˜¡•áÁI½İÌ¹±•¹Ñ ¥ì½¹ÍĞí•ÉÉ½Èé•áÁ•¹Í•ÉÉ½Éôõ…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ Í…±•Í}•áÁ•¹Í•Ìœ¤¹¥¹Í•ÉĞ¡•áÁI½İÌ¹µ…À¡àôø¡íÕÍ•É}¥éÕÉÉ•¹ÑµÀ¹¥±Í½ÕÉ•}Í…±•}¥éÍ…Ù•¹Í…±•%±•áÁ•¹Í•}‘…Ñ”éÍ…±•…Ñ”±…µ½Õ¹Ğé9Õµ‰•È¡à¹…µ½Õ¹Ğ¤±…Ñ•½Éäéà¹…Ñ•½ÉåñğŸªâÃ¶ œ±ÕÍÑ½µ•É}¹…µ”éÕÍÑ½µ•È±µ•µ¼éMÑÉ¥¹œ¡à¹µ•µ½ñğœœ¤¹ÑÉ¥´ ¥ññ¹Õ±±ô¤¤¤ì¥˜¡•áÁ•¹Í•ÉÉ½È¥Ñ¡É½Ü•áÁ•¹Í•ÉÉ½Èìô(€€€€€ô((€€€€€€¼¼€ç²nPƒ¶*çªÂ ›²²vã²‚W²Æ²v ƒªâÃ²†Ğƒ²vã²ó¶.Ã®â3²^@ƒ²ÚSªÂ ƒ²ªâ$°ƒ²vã²ó®¾ã²ªâ$ƒ¶*çªÂ®*Pƒ²jSªâ#²‚s
İYO
ß®ÎÓ¶^c®0ƒ²‚s²fã¶V§®.#®.¸(€€€€€¥˜ ¡µ½‰¥±•M…±•-¥¹ôôôÍÁ•¥…°œ€˜˜µ½‰¥±•MÁ•¥…±A½±¥å%¥ññµ½‰¥±•M…±•-¥¹ôôô¥¹•¹Ñ¥Ù•}Õ¹Á…¥œ¥ì(€€€€€€€½¹ÍĞÁ½±¥äõÍÁ•¥…±A½±¥¥•Ì¹™¥¹¡ÀôùÀ¹¥ôôõµ½‰¥±•MÁ•¥…±A½±¥å%¤ì(€€€€€€€½¹ÍĞµ…ÑÉ¥á•”õ9Õµ‰•È¡½¹™¥œ¹µ…ÑÉ¥àü¹mµ½‰¥±•M…±•É…™Ğ¹É¥tü¹mµ½‰¥±•M…±•É…™Ğ¹¥uñğÀ¤ì(€€€€€€€½¹ÍĞ…±±Y…Ìô¡µ½‰¥±•Y…Í-•åÍññmt¤¹™¥±Ñ•È¡¬ôù¬„ôôÙ…Í9½¹”œ¤ì(€€€€€€€½¹ÍĞÙ…Í•”õ…±±Y…Ì¹É•‘Õ” ¡ÍÕ´±¬¤ôùÍÕ´­9Õµ‰•È ¡½¹™¥œ¹Ù…Íññmt¤¹™¥¹¡ØôùØ¹­•äôôõ¬¤ü¹É…Ñ•ñğÀ¤°À¤ì(€€€€€€€½¹ÍĞÕ¹Á…¥õµ½‰¥±•M…±•-¥¹ôôô¥¹•¹Ñ¥Ù•}Õ¹Á…¥œì(€€€€€€€½¹ÍĞÍÑÉ…Ñ•¥A½¥¹ÑÌõµ½‰¥±•MÑÉ…Ñ•¥A½¥¹Ğ¡íÍÑÉ…Ñ•¥A±…¸è„…µ½‰¥±•MÑÉ…Ñ•¥A±…¸±Ù…Í-•åÌéµ½‰¥±•Y…Í-•åÌ±‰Õ¹‘±•Y…Í5…Àéµ½‰¥±•	Õ¹‘±•Y…Í5…Áô¤ì(€€€€€€€½¹ÍĞ½ÕÑ½µ”õµ½‰¥±•M…±•-¥¹ôôôÍÁ•¥…°œ˜™¥ÍM•ÁÑ•µ‰•ÉA½±¥åÑ¥Ù”¡µ½¹Ñ ¤(€€€€€€€€€€ü…±Õ±…Ñ•M•ÁÑ•µ‰•ÉMÁ•¥…±M…±”¡íÁ½±¥å-•äéµ½‰¥±•MÁ•¥…±A½±¥å%±Á±…¹É½ÕÀéÍ•ÁÑ•µ‰•ÉA±…¹É½ÕÀ¡µ½‰¥±•M…±•É…™Ğ¹¤¤±ÍÑÉ…Ñ•¥A½¥¹ÑÌ±Í…±•…Ñ•ô¤(€€€€€€€€€€èí•±¥¥‰±”éÑÉÕ”±…‘‘¥Ñ¥½¹…±µ½Õ¹Ğé9Õµ‰•È¡Á½±¥äü¹É•Á±…•µ•¹Ñ}…µ½Õ¹ÑñğÀ¥ôì(€€€€€€€½¹ÍĞÉ•Á±…•µ•¹ĞõÕ¹Á…¥üÀé9Õµ‰•È¡½ÕÑ½µ”¹…‘‘¥Ñ¥½¹…±µ½Õ¹ÑñğÀ¤ì(€€€€€€€…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ ÕÍÑ½µ•É}Í…±•Ìœ¤¹ÕÁ‘…Ñ”¡ì(€€€€€€€€€Í¡•µ…}Ù•ÉÍ¥½¸éUII9Q}M1}M!5}YIM%=8°(€€€€€€€€€Í½ÕÉ•}µ•Ñ„éİ¥Ñ¡ÕÉÉ•¹ÑM…±•M¡•µ„¡íÉ¤éµ½‰¥±•M…±•É…™Ğ¹É¤±¤éµ½‰¥±•M…±•É…™Ğ¹¤±Á½±¥åM¹…ÁÍ¡½ĞéÍ…±•A½±¥åM¹…ÁÍ¡½Ğ±ÍÑÉ…Ñ•¥A±…¸è„…µ½‰¥±•MÑÉ…Ñ•¥A±…¸±Ù…Í-•åÌéµ½‰¥±•Y…Í-•åÌ±‰Õ¹‘±”É¹‘-•åÌéµ½‰¥±•	Õ¹‘±”É¹‘-•åÌ±‰Õ¹‘±•Y…Í5…Àéµ½‰¥±•	Õ¹‘±•Y…Í5…À±‰Õ¹‘±•M…±•QåÁ•5…Àéµ½‰¥±•	Õ¹‘±•M…±•QåÁ•5…À±‰Õ¹‘±•Y…Í½µµ¥ÍÍ¥½¹á±Õ‘•éÑÉÕ”±ÕÍ•‘5¹Á	Õ¹‘±”è¡9Õµ‰•È¡µ½‰¥±•M…±•É…™Ğ¹É¤¤ôôôÔ€˜˜9Õµ‰•È¡µ½‰¥±•M…±•É…™Ğ¹¤¤ğôÌ€üµ½‰¥±•UÍ•‘5¹Á	Õ¹‘±”€è™…±Í”¤±Ñ•…µ=¹±äé…Ñ¥Ù•Q•…µMÕÁÁ½ÉĞ±É•‘¥Ñ•‘MÑ½É”é…Ñ¥Ù•Q•…µMÕÁÁ½ÉĞıÑ•…µMÕÁÁ½ÉÑMÑ½É”é¹Õ±°±ÍÁ•¥…±A½±¥äéíÁ½±¥å%éÕ¹Á…¥ı¹Õ±°éµ½‰¥±•MÁ•¥…±A½±¥å%±Á½±¥åQ¥Ñ±”éÕ¹Á…¥üŸ²vã²ó®¾ã²ªâ$ƒ¶*çªÂ œéÁ½±¥äü¹Ñ¥Ñ±•ñğœœ±Á½±¥åQåÁ”éÕ¹Á…¥ü¥¹•¹Ñ¥Ù•}Õ¹Á…¥œè…‘‘¥Ñ¥Ù”œ±É•Á±…•µ•¹Ñµ½Õ¹ĞéÉ•Á±…•µ•¹Ğ±¹½Éµ…±5…ÑÉ¥á•”éÕ¹Á…¥ıµ…ÑÉ¥á•”èÀ±¹½Éµ…±Y…Í•”éÕ¹Á…¥ıÙ…Í•”èÀ±•±¥¥‰±”è„…½ÕÑ½µ”¹•±¥¥‰±”±ÍÑÉ…Ñ•¥A½¥¹ÑÌ±Á½±¥åY•ÉÍ¥½¸éMAQ5	I}A=1%e}YIM%=9õô¤(€€€€€€€ô¤¹•Ä ¥œ±Í…Ù•¹Í…±•%¤ì(€€€€€€€Í…Ù•¹}ÍÁ•¥…°õíµ…ÑÉ¥á•”éÕ¹Á…¥ıµ…ÑÉ¥á•”èÀ±Ù…Í•”éÕ¹Á…¥ıÙ…Í•”èÀ±É•Á±…•µ•¹Ñôì(€€€€€ô((€€€€€½¹ÍĞ™É••µ½Õ¹ÑÌõ‰Õ¹‘±•É••µ½Õ¹ÑÌ ¤ì((€€€€€¥˜¡…Ñ¥Ù•Q•…µMÕÁÁ½ÉĞ¥ì(€€€€€€€½¹ÍĞÉ•‘¥Ñ5•ÑÉ¥Ìõµ½‰¥±•Q•…µÉ•‘¥Ñ5•ÑÉ¥Ì¡íÉ¤éµ½‰¥±•M…±•É…™Ğ¹É¤±¤éµ½‰¥±•M…±•É…™Ğ¹¤±Ù…Í-•åÌéµ½‰¥±•Y…Í-•åÌ±‰Õ¹‘±”É¹‘-•åÌéµ½‰¥±•	Õ¹‘±”É¹‘-•åÌ±ÕÍ•‘5¹Á	Õ¹‘±”è¡9Õµ‰•È¡µ½‰¥±•M…±•É…™Ğ¹É¤¤ôôôÔ˜™9Õµ‰•È¡µ½‰¥±•M…±•É…™Ğ¹¤¤ğôÌ˜™µ½‰¥±•UÍ•‘5¹Á	Õ¹‘±”¤±ÍÁ•¥…±5…ÑÉ¥á=™™Í•ĞéÍ…Ù•¹}ÍÁ•¥…°ü¹µ…ÑÉ¥á••ñğÀ±ÍÁ•¥…±Y…Í=™™Í•ĞéÍ…Ù•¹}ÍÁ•¥…°ü¹Ù…Í••ñğÀ±ÍÁ•¥…±I•Á±…•µ•¹ÑA…äéÍ…Ù•¹}ÍÁ•¥…°ü¹É•Á±…•µ•¹ÑñğÀ±‰Õ¹‘±•É••=™™Í•Ğé™É••µ½Õ¹ÑÌ¹‰Õ¹‘±•=™™Í•ÑñğÀ±‰Õ¹‘±•É••Y…Í=™™Í•Ğé™É••µ½Õ¹ÑÌ¹Ù…Í=™™Í•ÑñğÁô¤ì(€€€€€€€½¹ÍĞí•ÉÉ½ÈéÉ•‘¥ÑÉÉ½Éôõ…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ Ñ•…µ}Í…±•Í}É•‘¥ÑÌœ¤¹¥¹Í•ÉĞ¡íÍ•±±•É}¥é…ÕÑ¡UÍ•È¹¥±É•‘¥Ñ•‘}ÍÑ½É”éÑ•…µMÕÁÁ½ÉÑMÑ½É”±Í…±•}‘…Ñ”éÍ…±•…Ñ”±Í½ÕÉ•}ÑåÁ”èµ½‰¥±”œ±Í½ÕÉ•}Í…±•}¥éÍ…Ù•¹Í…±•%±Í½ÕÉ•}É•™Ìémt±µ•ÑÉ¥ÌéÉ•‘¥Ñ5•ÑÉ¥Ì±¥Í}½µÁ±•Ñ•éÑÉÕ”±¹½Ñ”é€‘í±½¥¹µÀü¹¹…µ•ñğŸ®.Ó®.äôƒ²²n@ƒ¶2C®‘ô¤ì(€€€€€€€¥˜¡É•‘¥ÑÉÉ½È¥Ñ¡É½ÜÉ•‘¥ÑÉÉ½Èì(€€€€€€€…İ…¥Ğ½¹Q•…µÉ•‘¥ÑM…Ù•ü¸ ¤ì(€€€€€€€¹½Ñ¥™åMÑ½É•5…¹…•ÉÌ¡í…Ñ½É%é…ÕÑ¡UÍ•È¹¥±ÍÑ½É•9…µ”éÑ•…µMÕÁÁ½ÉÑMÑ½É”±ÑåÁ”è‘…¥±å}¥¹ÁÕĞœ±Ñ¥Ñ±”é€‘í±½¥¹µÀü¹¹…µ•ñğŸ®.Ó®.ä÷®.c²vĞƒ²²n@ƒ¶2C®“®–ğƒ®NÇ®†w¶Z#²ZÓ²jQ€±µ•ÍÍ…”é€‘íÕÍÑ½µ•Éôƒ
Ü€‘íµ½‰¥±•M…±•É…™Ğ¹±…‰•±õ€±Á…å±½…éí•µÁ±½å••}¥é…ÕÑ¡UÍ•È¹¥±•µÁ±½å••}¹…µ”é±½¥¹µÀü¹¹…µ”±ÍÑ½É•}¹…µ”éÑ•…µMÕÁÁ½ÉÑMÑ½É”±Ñ•…µ}½¹±äéÑÉÕ”±µ½¹Ñ ±‘…äéÍ•±•Ñ•‘…ä±±…‰•°éµ½‰¥±•M…±•É…™Ğ¹±…‰•±õô¤ì(€€€€€€€½¹ÍĞÑ½…ÍÑ%õÑ•…´µµ½‰¥±”´‘í…Ñ”¹¹½Ü ¥õ€ì(€€€€€€€Í•ÑQ½…ÍĞ¡í¥éÑ½…ÍÑ%±Í½ÕÉ”èµ½‰¥±”œ±­¥¹è¹½Éµ…°œ±Ñ¥Ñ±”èŸ²²n@ƒ¶2C®ƒ®NÇ®†tƒ²f®0œ±ÍÕˆé€‘í‘¥ÍÁ±…åMÑ½É•9…µ”¡Ñ•…µMÕÁÁ½ÉÑMÑ½É”¥ôƒ¶2 ƒ².“²‚²^C®0ƒ®Âc²b¶Z#²ZÓ²jQ€±±…‰•°éµ½‰¥±•M…±•É…™Ğ¹±…‰•°±ÕÍÑ½µ•É9…µ”éÕÍÑ½µ•È±ÁÉ½µ¥Í•½Õ¹Ğéµ½‰¥±•…É•-•åÌ¹±•¹Ñ ±ÕÍÑ½µ•ÉM…±•%éÍ…Ù•¹Í…±•%±Á…å•±Ñ„èÀ±Í…±•A…å•±Ñ„èÀ±…Ñ¥Ù¥ÑåA…å•±Ñ„èÀ±‰½¹ÕÍA…å•±Ñ„èÀ±Á½¥¹Ñ•±Ñ„èÀ±ÍÑÉ…Ñ•¥A½¥¹Ñ•±Ñ„èÀ±ÁÉ½‘ÕÑ¥Ù¥Ñå•±Ñ„èÀ±Ñ•…µ=¹±äéÑÉÕ•ô¤ì(€€€€€€€É•Í•ÑQ•…µMÕÁÁ½ÉÑM•±•Ñ¥½¸ ¤ì(€€€€€€€Í•ÑQ¥µ•½ÕĞ  ¤ôùÍ•ÑQ½…ÍĞ¡Ù…±Õ”ôùÙ…±Õ”ü¹¥ôôõÑ½…ÍÑ%ı¹Õ±°éÙ…±Õ”¤°ÄÀÀÀÀ¤ì(€€€€€õ•±Í”¥˜¡±•…å½¹Ù•ÉÍ¥½¸ü¹­¥¹ôôôµ½‰¥±”œ€˜˜±•…å	…Í•=Ù•ÉÉ¥‘”¥ì(€€€€€€€€¼¼ƒªÖ³®Ê²‚ƒ²nC®Îà€ÇªÆÓ²vƒ®¢ó²‚ ƒ®ê ƒ²¶p¡±•…å	…Í•=Ù•ÉÉ¥‘”§²^@ƒ² ƒ¶2C®€ÇªÆÓ®0ƒ²‚W¶fW¶z ƒ®.“².pƒ®Âc²b(€€€€€€€½¹ÍĞ‰…Í”õ¹½Éµ…±¥é•…ä¡±•…å	…Í•=Ù•ÉÉ¥‘”¤ì(€€€€€€€½¹ÍĞµ…ÑÉ¥àõ‰…Í”¹µ…ÑÉ¥à¹µ…À¡Èôùl¸¸¹Ét¤ì(€€€€€€€µ…ÑÉ¥ámµ½‰¥±•M…±•É…™Ğ¹É¥umµ½‰¥±•M…±•É…™Ğ¹¥tõ9Õµ‰•È¡µ…ÑÉ¥ámµ½‰¥±•M…±•É…™Ğ¹É¥umµ½‰¥±•M…±•É…™Ğ¹¥uñğÀ¤¬Äì((€€€€€€€½¹ÍĞÙ…Ìõì¸¸¸¡‰…Í”¹É½ÕÁÌü¹Ù…Íññíô¥ôì(€€€€€€€€¡µ½‰¥±•Y…Í-•åÍññmt¤¹™½É… ¡¬ôùì(€€€€€€€€€¥˜¡¬„ôôÙ…Í9½¹”œ¥Ù…Ím­tõ9Õµ‰•È¡Ù…Ím­uñğÀ¤¬Äì(€€€€€€€ô¤ì(€€€€€€€½¹ÍĞ‰Õ¹‘±”É¹õì¸¸¸¡‰…Í”¹É½ÕÁÌü¹‰Õ¹‘±”É¹‘ññíô¥ôì(€€€€€€€€¡µ½‰¥±•	Õ¹‘±”É¹‘-•åÍññmt¤¹™½É… ¡¬ôùì(€€€€€€€€€‰Õ¹‘±”É¹‘m­tõ9Õµ‰•È¡‰Õ¹‘±”É¹‘m­uñğÀ¤¬Äì(€€€€€€€ô¤ì(€€€€€€€½¹ÍĞµ¹Á	Õ¹‘±”õì¸¸¸¡‰…Í”¹É½ÕÁÌü¹µ¹Á	Õ¹‘±•ññíô¥ôì(€€€€€€€¥˜¡9Õµ‰•È¡µ½‰¥±•M…±•É…™Ğ¹É¤¤ôôôÔ€˜˜9Õµ‰•È¡µ½‰¥±•M…±•É…™Ğ¹¤¤ğôÌ€˜˜µ½‰¥±•UÍ•‘5¹Á	Õ¹‘±”¥µ¹Á	Õ¹‘±”¹ÕÍ•‘5¹Á	Õ¹‘±”õ9Õµ‰•È¡µ¹Á	Õ¹‘±”¹ÕÍ•‘5¹Á	Õ¹‘±•ñğÀ¤¬Äì((€€€€€€€½¹ÍĞ½¹Ù•ÉÑ•‘…äõì(€€€€€€€€€€¸¸¹‰…Í”°(€€€€€€€€€µ…ÑÉ¥à°(€€€€€€€€€É½ÕÁÌéì¸¸¹‰…Í”¹É½ÕÁÌ±Ù…Ì±‰Õ¹‘±”É¹±µ¹Á	Õ¹‘±•ô°(€€€€€€€€€ÍÁ•¥…±5…ÑÉ¥á=™™Í•Ğé9Õµ‰•È¡‰…Í”¹ÍÁ•¥…±5…ÑÉ¥á=™™Í•ÑñğÀ¤­9Õµ‰•È¡Í…Ù•¹}ÍÁ•¥…°ü¹µ…ÑÉ¥á••ñğÀ¤°(€€€€€€€€€ÍÁ•¥…±Y…Í=™™Í•Ğé9Õµ‰•È¡‰…Í”¹ÍÁ•¥…±Y…Í=™™Í•ÑñğÀ¤­9Õµ‰•È¡Í…Ù•¹}ÍÁ•¥…°ü¹Ù…Í••ñğÀ¤°(€€€€€€€€€ÍÁ•¥…±I•Á±…•µ•¹ÑA…äé9Õµ‰•È¡‰…Í”¹ÍÁ•¥…±I•Á±…•µ•¹ÑA…åñğÀ¤­9Õµ‰•È¡Í…Ù•¹}ÍÁ•¥…°ü¹É•Á±…•µ•¹ÑñğÀ¤°(€€€€€€€€€‰Õ¹‘±•É••=™™Í•Ğé9Õµ‰•È¡‰…Í”¹‰Õ¹‘±•É••=™™Í•ÑñğÀ¤­9Õµ‰•È¡™É••µ½Õ¹ÑÌ¹‰Õ¹‘±•=™™Í•ÑñğÀ¤°(€€€€€€€€€‰Õ¹‘±•É••Y…Í=™™Í•Ğé9Õµ‰•È¡‰…Í”¹‰Õ¹‘±•É••Y…Í=™™Í•ÑñğÀ¤­9Õµ‰•È¡™É••µ½Õ¹ÑÌ¹Ù…Í=™™Í•ÑñğÀ¤°(€€€€€€€ôì(€€€€€€€…İ…¥ĞÁ•ÉÍ¥ÍÑ1•…å½¹Ù•ÉÑ•‘…ä¡½¹Ù•ÉÑ•‘…ä¤ì(€€€€€õ•±Í•ì(€€€€€€€½µµ¥Ñ5½‰¥±•=¹” (€€€€€€€€€µ½‰¥±•M…±•É…™Ğ¹É¤°(€€€€€€€€€µ½‰¥±•M…±•É…™Ğ¹¤°(€€€€€€€€€ìÍ…±•%éÍ…Ù•¹Í…±•%°ÕÍÑ½µ•É9…µ”éÕÍÑ½µ•È°ÁÉ½µ¥Í•½Õ¹Ğéµ½‰¥±•…É•-•åÌ¹É•‘Õ” ¡¸±¬¤ôù¸¬¡¬ôôôÁ…åµ•¹ĞÌœıµ½‰¥±•A…åµ•¹Ñ½Õ¹ĞèÄ¤°À¤¬¡míÑ¥Ñ±”éµ½‰¥±•ÕÍÑ½µQ¥Ñ±”±‘Õ•…Ñ”éµ½‰¥±•ÕÍÑ½µÕ•…Ñ•ô°¸¸¹µ½‰¥±•áÑÉ…AÉ½µ¥Í•Ít¹™¥±Ñ•È¡àôùMÑÉ¥¹œ¡à¹Ñ¥Ñ±•ñğœœ¤¹ÑÉ¥´ ¤˜™à¹‘Õ•…Ñ”¤¹±•¹Ñ ¤°ÍÑÉ…Ñ•¥A±…¸è„…µ½‰¥±•MÑÉ…Ñ•¥A±…¸°Ù…Í-•åÌél¸¸¹µ½‰¥±•Y…Í-•åÍt°‰Õ¹‘±•Y…Í5…Àéµ½‰¥±•	Õ¹‘±•Y…Í5…À°‰Õ¹‘±”É¹‘-•åÌéµ½‰¥±•	Õ¹‘±”É¹‘-•åÌ°ÕÍ•‘5¹Á	Õ¹‘±”è¡9Õµ‰•È¡µ½‰¥±•M…±•É…™Ğ¹É¤¤ôôôÔ€˜˜9Õµ‰•È¡µ½‰¥±•M…±•É…™Ğ¹¤¤ğôÌ€üµ½‰¥±•UÍ•‘5¹Á	Õ¹‘±”€è™…±Í”¤°(€€€€€€€€€€€…±Õ±…Ñ¥½¹1¥¹•Ìéµ½‰¥±•AÉ•Ù¥•Üü¹…±Õ±…Ñ¥½¹1¥¹•Íññmt°(€€€€€€€€€€€ÍÁ•¥…±5…ÑÉ¥á=™™Í•ĞéÍ…Ù•¹}ÍÁ•¥…°ü¹µ…ÑÉ¥á••ñğÀ±ÍÁ•¥…±Y…Í=™™Í•ĞéÍ…Ù•¹}ÍÁ•¥…°ü¹Ù…Í••ñğÀ±ÍÁ•¥…±I•Á±…•µ•¹ÑA…äéÍ…Ù•¹}ÍÁ•¥…°ü¹É•Á±…•µ•¹ÑñğÀ°(€€€€€€€€€€€‰Õ¹‘±•É••=™™Í•Ğé™É••µ½Õ¹ÑÌ¹‰Õ¹‘±•=™™Í•ÑñğÀ±‰Õ¹‘±•É••Y…Í=™™Í•Ğé™É••µ½Õ¹ÑÌ¹Ù…Í=™™Í•ÑñğÀô(€€€€€€€€¤ì(€€€€€ô((€€€€€É•µ•µ‰•É5½‰¥±•½µ‰¼ ¤ì((€€€€€Í•Ñ5½‰¥±•M…±•É…™Ğ¡¹Õ±°¤ì(€€€€€Í•Ñ1•…å½¹Ù•ÉÍ¥½¸¡¹Õ±°¤ì(€€€€€Í•Ñ5½‰¥±•M…±•-¥¹ œœ¤ì(€€€€€Í•Ñ5½‰¥±•MÁ•¥…±A½±¥å% œœ¤ì(€€€€€Í•Ñ5½‰¥±•MÁ•¥…±á•ÁÑ¥½¹µ½Õ¹Ğ œœ¤ì(€€€€€Í•ÑQ¥µ•½ÕĞ¡±½…‘…åM…±•Ì°ÄÔÀ¤ì(€€€õ…Ñ ¡”¥ì(€€€€€Í¡½İÁÁQ½…ÍĞ¡™É¥•¹‘±åÉÉ½È¡”¤±íÑ½¹”è•ÉÉ½Èœ±Ñ¥Ñ±”é•‘¥Ñ¥¹M…±”üŸ¶2C®“ªÆĞƒ²"c²‚Tƒ².“¶2 œèŸªÎƒªÂt¿².“²‚ƒ®NÇ®†tƒ².“¶2 ô¤ì(€€€õ™¥¹…±±åì(€€€€€µ½‰¥±•MÕ‰µ¥ÑÕ…É‘I•˜¹ÕÉÉ•¹Ğõ™…±Í”ì(€€€€€Í•Ñ5½‰¥±•M…±•M…Ù¥¹œ¡™…±Í”¤ì(€€€ô(€ôì((€½¹ÍĞÕ¹‘½Q½…ÍĞ€ô…Íå¹Œ€ ¤€ôøì(€€€¥˜€ …Ñ½…ÍĞ¤É•ÑÕÉ¸ì((€€€¥˜¡Ñ½…ÍĞ¹Ñ•…µ=¹±ä¥ì(€€€€€…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ ÕÍÑ½µ•É}Ñ…Í­Ìœ¤¹‘•±•Ñ” ¤¹•Ä Í½ÕÉ•}Í…±•}¥œ±Ñ½…ÍĞ¹ÕÍÑ½µ•ÉM…±•%¤¹•Ä ÕÍ•É}¥œ±ÕÉÉ•¹ÑµÀü¹¥¤ì(€€€€€…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ Í…±•Í}•áÁ•¹Í•Ìœ¤¹‘•±•Ñ” ¤¹•Ä Í½ÕÉ•}Í…±•}¥œ±Ñ½…ÍĞ¹ÕÍÑ½µ•ÉM…±•%¤¹•Ä ÕÍ•É}¥œ±ÕÉÉ•¹ÑµÀü¹¥¤ì(€€€€€…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ ÕÍÑ½µ•É}Í…±•Ìœ¤¹‘•±•Ñ” ¤¹•Ä ¥œ±Ñ½…ÍĞ¹ÕÍÑ½µ•ÉM…±•%¤¹•Ä ÕÍ•É}¥œ±ÕÉÉ•¹ÑµÀü¹¥¤ì(€€€€€…İ…¥Ğ½¹Q•…µÉ•‘¥ÑM…Ù•ü¸ ¤íÍ•ÑQ½…ÍĞ¡¹Õ±°¤í±½…‘…åM…±•Ì ¤íÉ•ÑÕÉ¸ì(€€€ô((€€€½¹ÍĞ‰…Í”€ô¹½Éµ…±¥é•…ä¡‘…ä¤ì(€€€½¹ÍĞ¹•áÑ5…ÑÉ¥à€ô‰…Í”¹µ…ÑÉ¥à¹µ…À ¡É½Ü¤€ôøl¸¸¹É½İt¤ì(€€€¹•áÑ5…ÑÉ¥ámÑ½…ÍĞ¹É¥umÑ½…ÍĞ¹¥t€ô5…Ñ ¹µ…à À°9Õµ‰•È¡¹•áÑ5…ÑÉ¥ámÑ½…ÍĞ¹É¥umÑ½…ÍĞ¹¥tñğ€À¤€´€Ä¤ì((€€€½¹ÍĞ¹•áÑY…Ì€ôì€¸¸¸¡‰…Í”¹É½ÕÁÌü¹Ù…Ìñğíô¤ôì(€€€€¡Ñ½…ÍĞ¹Ù…Í-•åÌñğmt¤¹™½É…  ¡­•ä¤€ôøì(€€€€€¹•áÑY…Ím­•åt€ô5…Ñ ¹µ…à À°9Õµ‰•È¡¹•áÑY…Ím­•åtñğ€À¤€´€Ä¤ì(€€€ô¤ì((€€€½¹ÍĞ¹•áÑ	Õ¹‘±”É¹õì¸¸¸¡‰…Í”¹É½ÕÁÌü¹‰Õ¹‘±”É¹‘ññíô¥ôì(€€€€¡Ñ½…ÍĞ¹‰Õ¹‘±”É¹‘-•åÍññmt¤¹™½É… ¡¬ôùí¹•áÑ	Õ¹‘±”É¹‘m­tõ5…Ñ ¹µ…à À±9Õµ‰•È¡¹•áÑ	Õ¹‘±”É¹‘m­uñğÀ¤´Ä¥ô¤ì(€€€½¹ÍĞ¹•áÑ5¹Á	Õ¹‘±”õì¸¸¸¡‰…Í”¹É½ÕÁÌü¹µ¹Á	Õ¹‘±•ññíô¥ôì(€€€¥˜¡Ñ½…ÍĞ¹ÕÍ•‘5¹Á	Õ¹‘±”¥¹•áÑ5¹Á	Õ¹‘±”¹ÕÍ•‘5¹Á	Õ¹‘±”õ5…Ñ ¹µ…à À±9Õµ‰•È¡¹•áÑ5¹Á	Õ¹‘±”¹ÕÍ•‘5¹Á	Õ¹‘±•ñğÀ¤´Ä¤ì(€€€µÕÑ…Ñ”¡ì(€€€€€€¸¸¹‰…Í”°(€€€€€µ…ÑÉ¥àè¹•áÑ5…ÑÉ¥à°(€€€€€É½ÕÁÌèì€¸¸¹‰…Í”¹É½ÕÁÌ°Ù…Ìè¹•áÑY…Ì°‰Õ¹‘±”É¹è¹•áÑ	Õ¹‘±”É¹°µ¹Á	Õ¹‘±”é¹•áÑ5¹Á	Õ¹‘±”ô°(€€€€€‰Õ¹‘±•É••=™™Í•Ğé5…Ñ ¹µ…à À±9Õµ‰•È¡‰…Í”¹‰Õ¹‘±•É••=™™Í•ÑñğÀ¤µ9Õµ‰•È¡Ñ½…ÍĞ¹‰Õ¹‘±•É••=™™Í•ÑñğÀ¤¤°(€€€€€‰Õ¹‘±•É••Y…Í=™™Í•Ğé5…Ñ ¹µ…à À±9Õµ‰•È¡‰…Í”¹‰Õ¹‘±•É••Y…Í=™™Í•ÑñğÀ¤µ9Õµ‰•È¡Ñ½…ÍĞ¹‰Õ¹‘±•É••Y…Í=™™Í•ÑñğÀ¤¤°(€€€€€ÍÁ•¥…±5…ÑÉ¥á=™™Í•Ğé5…Ñ ¹µ…à À±9Õµ‰•È¡‰…Í”¹ÍÁ•¥…±5…ÑÉ¥á=™™Í•ÑñğÀ¤µ9Õµ‰•È¡Ñ½…ÍĞ¹ÍÁ•¥…±5…ÑÉ¥á=™™Í•ÑñğÀ¤¤°(€€€€€ÍÁ•¥…±Y…Í=™™Í•Ğé5…Ñ ¹µ…à À±9Õµ‰•È¡‰…Í”¹ÍÁ•¥…±Y…Í=™™Í•ÑñğÀ¤µ9Õµ‰•È¡Ñ½…ÍĞ¹ÍÁ•¥…±Y…Í=™™Í•ÑñğÀ¤¤°(€€€€€ÍÁ•¥…±I•Á±…•µ•¹ÑA…äé5…Ñ ¹µ…à À±9Õµ‰•È¡‰…Í”¹ÍÁ•¥…±I•Á±…•µ•¹ÑA…åñğÀ¤µ9Õµ‰•È¡Ñ½…ÍĞ¹ÍÁ•¥…±I•Á±…•µ•¹ÑA…åñğÀ¤¤°(€€€ô¤ì((€€€¥˜€¡Ñ½…ÍĞ¹ÕÍÑ½µ•ÉM…±•%¤ì(€€€€€…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ ÕÍÑ½µ•É}Ñ…Í­Ìœ¤¹‘•±•Ñ” ¤¹•Ä Í½ÕÉ•}Í…±•}¥œ±Ñ½…ÍĞ¹ÕÍÑ½µ•ÉM…±•%¤¹•Ä ÕÍ•É}¥œ±ÕÉÉ•¹ÑµÀü¹¥¤ì(€€€€€…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ Í…±•Í}•áÁ•¹Í•Ìœ¤¹‘•±•Ñ” ¤¹•Ä Í½ÕÉ•}Í…±•}¥œ±Ñ½…ÍĞ¹ÕÍÑ½µ•ÉM…±•%¤¹•Ä ÕÍ•É}¥œ±ÕÉÉ•¹ÑµÀü¹¥¤ì(€€€€€…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ ÕÍÑ½µ•É}Í…±•Ìœ¤¹‘•±•Ñ” ¤¹•Ä ¥œ±Ñ½…ÍĞ¹ÕÍÑ½µ•ÉM…±•%¤¹•Ä ÕÍ•É}¥œ±ÕÉÉ•¹ÑµÀü¹¥¤ì(€€€ô(€€€Í•ÑQ½…ÍĞ¡¹Õ±°¤ì(€€€Í•ÑQ¥µ•½ÕĞ¡±½…‘…åM…±•Ì°ÄÔÀ¤ì(€€€Í¡½İÁÁQ½…ÍĞ Ÿ®Â§ªâ ƒ®NÇ®†w¶Vpƒ².“²‚²vƒ²Ş£²3¶Z#²ZÓ²jP¸œ±íÑ½¹”è¥¹™¼ô¤ì(€ôì((€½¹ÍĞÕ¹‘½!½µ•Q½…ÍĞ€ô…Íå¹Œ€ ¤€ôøì(€€€¥˜ …Ñ½…ÍĞü¹ÕÍÑ½µ•ÉM…±•%¥É•ÑÕÉ¸ì(€€€½¹ÍĞí‘…Ñ„±•ÉÉ½Éôõ…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ ÕÍÑ½µ•É}Í…±•Ìœ¤(€€€€€€¹Í•±•Ğ ¥±ÕÍÑ½µ•É}¥±Í…±•}‘…Ñ”±µ•ÑÉ¥}±…‰•°±Í½ÕÉ•}ÑåÁ”±Í½ÕÉ•}É•˜±Í½ÕÉ•}µ•Ñ„±ÕÍÑ½µ•ÉÌ¡ÕÍÑ½µ•É}¹…µ”¤œ¤(€€€€€€¹•Ä ¥œ±Ñ½…ÍĞ¹ÕÍÑ½µ•ÉM…±•%¤¹•Ä ÕÍ•É}¥œ±ÕÉÉ•¹ÑµÀü¹¥¤¹µ…å‰•M¥¹±” ¤ì(€€€¥˜¡•ÉÉ½Éñğ…‘…Ñ„¥É•ÑÕÉ¸Í¡½İÁÁQ½…ÍĞ Ÿ®Â§ªâ ƒ®NÇ®†w¶Vpƒ¶f ƒ¶2C®“®–ğƒ²Âû² ƒ®ªï¶Z#²ZÓ²jP¸ƒ¶2C®ƒ®
Ó²^·²^C²pƒ¶fW²vã¶VÓ²ó²ã²jP¸œ±íÑ½¹”è•ÉÉ½Èô¤ì(€€€¥˜ ……İ…¥ĞÍ¡½İÁÁ½¹™¥É´¡íÑ¥Ñ±”èŸ®Â§ªâ ƒ®NÇ®†w¶Vpƒ¶f ƒ¶2C®“®–ğƒ²Ş£²3¶Vƒªæ3²jPüœ±µ•ÍÍ…”é€‘í‘…Ñ„¹ÕÍÑ½µ•ÉÌü¹ÕÍÑ½µ•É}¹…µ•ñğŸªÎƒªÂtôƒ
ÜƒªÂg²v ƒ®
€ƒ®NÇ®†w¶Vpƒ¶f ƒ²¶J ƒ®²Û²v3ªÎğƒ²^ÃªÊÃ®Bpƒ²V÷²7
ß®æ²j§²vĞƒ¶V£ªî`ƒ²
·²‚s®B§®.#®.¹€±½¹™¥Éµ1…‰•°èŸ®NÇ®†tƒ²Ş£²0œ±Ñ½¹”è‘…¹•Èô¤¥É•ÑÕÉ¸ì(€€€…İ…¥Ğ‘•±•Ñ•M…±”¡‘…Ñ„±íÍ­¥Á½¹™¥É´éÑÉÕ•ô¤ì(€€€Í•ÑQ½…ÍĞ¡¹Õ±°¤ì(€ôì((€½¹ÍĞ•‘¥ÑQ½…ÍÑM…±”õ…Íå¹Œ ¤ôùì(€€€¥˜ …Ñ½…ÍĞü¹ÕÍÑ½µ•ÉM…±•%¥É•ÑÕÉ¸ì(€€€½¹ÍĞí‘…Ñ„±•ÉÉ½Éôõ…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ ÕÍÑ½µ•É}Í…±•Ìœ¤(€€€€€€¹Í•±•Ğ ¥±ÕÍÑ½µ•É}¥±Í…±•}‘…Ñ”±µ•ÑÉ¥}±…‰•°±Í½ÕÉ•}ÑåÁ”±Í½ÕÉ•}É•˜±Í½ÕÉ•}µ•Ñ„±Í¡•µ…}Ù•ÉÍ¥½¸±ÕÍÑ½µ•ÉÌ¡ÕÍÑ½µ•É}¹…µ”¤œ¤(€€€€€€¹•Ä ¥œ±Ñ½…ÍĞ¹ÕÍÑ½µ•ÉM…±•%¤¹•Ä ÕÍ•É}¥œ±ÕÉÉ•¹ÑµÀü¹¥¤¹µ…å‰•M¥¹±” ¤ì(€€€¥˜¡•ÉÉ½Éñğ…‘…Ñ„¥É•ÑÕÉ¸Í¡½İ1•…å±•ÉĞ Ÿ®Â§ªâ ƒ®NÇ®†w¶Vpƒ¶2C®“ªÆÓ²vƒ®Ú#®~³²b“² ƒ®ªï¶Z#²ZÓ²jP¸ƒ²V®z`ƒ¶2C®ƒ®
Ó²^·²^C²pƒ²"c²‚W¶VÓ²ó²ã²jP¸œ¤ì(€€€Í•ÑQ½…ÍĞ¡¹Õ±°¤ì(€€€…İ…¥Ğ½Á•¹‘¥ÑM…±”¡‘…Ñ„¤ì(€ôì((€½¹ÍĞÉ½ÕÁMÕ´€ô€¡É•Œ¤€ôø%1e}I=UA}-eL¹É•‘Õ” ¡Ì°¬¤€ôøÌ€¬=‰©•Ğ¹Ù…±Õ•Ì¡É•Œ¹É½ÕÁÍm­tñğíô¤¹É•‘Õ” ¡Ì°Ø¤€ôøÌ€¬€¡Øñğ€À¤°€À¤°€À¤(€€€€¬€¡É•Œ¹ÕÍÑI•½Õ¹Ğñğ€À¤€¬€¡É•Œ¹Ñ…¥±½É•‘½Õ¹Ğñğ€À¤ì(€½¹ÍĞµ…ÑÉ¥áMÕ´€ô€¡É•Œ¤€ôøÉ•Œ¹µ…ÑÉ¥à¹É•‘Õ” ¡Ì°É½Ü¤€ôøÌ€¬É½Ü¹É•‘Õ” ¡ÉÌ°Ø¤€ôøÉÌ€¬Ø°€À¤°€À¤ì(€½¹ÍĞ‘…åQ½Ñ…°€ôµ…ÑÉ¥áMÕ´¡‘…ä¤€¬É½ÕÁMÕ´¡‘…ä¤ì(€€¼¼ØÈÄ¸Ìäèƒ²b#²‚U'®*Pƒ®ª£®ÂS²vó®ş@ƒ²V®.#®vğƒ¶f ¼É9½YL¿²3®àƒ®NÇ®>‘…¥±å}É•½É‘Ìƒ²GªÎ®0ƒ®
£²vƒ²"`ƒ²z#²v0¸(€€¼¼ƒªÎƒªÂw®Îƒ²nC®Îã²vĞ€ÃªÆÓ²vã®6Àƒ²vó²vğƒ¶V§ªÎªÂ ƒ²z#²ró®¦Ğƒ¶VÓ®.äƒ®
ƒ²pƒ²‚²ÊÓ®–ğ€Ÿ²vÓ²‚ƒ®Â§².tƒ²z®‚”ƒ².“²‚Ÿ®†pƒ²Ş£ªâ'¶VĞƒ®Âc®Ns².pƒ®ã²Úp¸(€½¹ÍĞ±•…å]¡½±•…ä€ô€…‘…åM…±•Í1½…‘¥¹œ€˜˜‘…åM…±•Ì¹±•¹Ñ ôôôÀ€˜˜‘…åQ½Ñ…°øÀì(€½¹ÍĞ±•…å]¡½±•…å½Õ¹Ğ€ô±•…å]¡½±•…ä€ü‘…åQ½Ñ…°€è€Àì(€½¹ÍĞµ½¹Ñ¡Q½Ñ…°€ô=‰©•Ğ¹Ù…±Õ•Ì¡‘…¥±å…åÌ¤¹É•‘Õ” ¡Ì°É…Ü¤€ôøì½¹ÍĞÈ€ô¹½Éµ…±¥é•…ä¡É…Ü¤ìÉ•ÑÕÉ¸Ì€¬µ…ÑÉ¥áMÕ´¡È¤€¬É½ÕÁMÕ´¡È¤ìô°€À¤ì((€€¼¼ØÈÄ¸ØØƒ¶V×².°ƒ¶2C®“ªÆĞƒªâÃ²’ (€€¼¼ƒ®ª£®ÂS²vğ€ÇªÆÓ²v ƒªŞã®2®†p€ÇªÆĞ°ƒ¶f#²v ƒªÂg²v ƒ®
ƒ²p¯ªÂg²v ƒªÎƒªÂw²v`ƒ²ã®Ú¶V·®ª§²vƒ¶Vc®
c²v`ƒ¶V×².°ƒ¶f ƒ¶2C®“ªÆÓ²ró®†pƒ®²Û²*×®.#®.¸(€½¹ÍĞÉ½ÕÁ•‘½É•M…±•ÌõÕÍ•5•µ¼  ¤ôùì(€€€½¹ÍĞÉ½ÕÁÌõmtì(€€€½¹ÍĞ¡½µ•5…Àõ¹•Ü5…À ¤ì(€€€€¡‘…åM…±•Íññmt¤¹™½É… ¡Í…±”ôùì(€€€€€¥˜¡Í…±”¹Í½ÕÉ•}ÑåÁ”„ôô¡½µ•}½É‘•Èœ¥ì(€€€€€€€É½ÕÁÌ¹ÁÕÍ ¡í­•äéÍ…±”´‘íÍ…±”¹¥‘õ€±­¥¹èµ½‰¥±”œ±Í…±•ÌémÍ…±•t±ÁÉ¥µ…ÉäéÍ…±•ô¤ì(€€€€€€€É•ÑÕÉ¸ì(€€€€€ô(€€€€€½¹ÍĞÕÍÑ½µ•É-•äõÍ…±”¹ÕÍÑ½µ•É}¥‘ññÍ…±”¹ÕÍÑ½µ•ÉÌü¹ÕÍÑ½µ•É}¹…µ•ññÍ…±”¹¥ì(€€€€€½¹ÍĞ­•äõ¡½µ”´‘íÍ…±”¹Í…±•}‘…Ñ•ô´‘íÕÍÑ½µ•É-•åõ€ì(€€€€€¥˜ …¡½µ•5…À¹¡…Ì¡­•ä¤¥ì(€€€€€€€½¹ÍĞœõí­•ä±­¥¹è¡½µ”œ±Í…±•Ìémt±ÁÉ¥µ…ÉäéÍ…±•ôì(€€€€€€€¡½µ•5…À¹Í•Ğ¡­•ä±œ¤ìÉ½ÕÁÌ¹ÁÕÍ ¡œ¤ì(€€€€€ô(€€€€€¡½µ•5…À¹•Ğ¡­•ä¤¹Í…±•Ì¹ÁÕÍ ¡Í…±”¤ì(€€€ô¤ì(€€€É•ÑÕÉ¸É½ÕÁÌì(€ô±m‘…åM…±•Ít¤ì((€½¹ÍĞ½É•…åQ½Ñ…°õÉ½ÕÁ•‘½É•M…±•Ì¹±•¹Ñ ¬¡‘…ä¹¡½ÕÍ•¡½±‘I•¹•İ…±Ìü¹±•¹Ñ¡ñğÀ¤ì((€½¹ÍĞÍ…±•%¹•¹Ñ¥Ù•	É•…­‘½İ¸ô¡Í…±”¤ôùì(€€€½¹ÍĞµ•Ñ„õÍ…±”ü¹Í½ÕÉ•}µ•Ñ…ññíôì(€€€½¹ÍĞÉ½İÌõmtì(€€€¥˜¡Í…±”ü¹Í½ÕÉ•}ÑåÁ”ôôôµ½‰¥±”œ¥ì(€€€€€½¹ÍĞÉ¤õ9Õµ‰•È¡µ•Ñ„¹É¤¤±¤õ9Õµ‰•È¡µ•Ñ„¹¤¤ì(€€€€€½¹ÍĞÁ±…¸õ9Õµ‰•È¡½¹™¥œ¹µ…ÑÉ¥àü¹mÉ¥tü¹m¥uñğÀ¤ì(€€€€€¥˜¡Á±…¸¥É½İÌ¹ÁÕÍ ¡lŸ²jSªâ#²‚pœ±Á±…¹t¤ì(€€€€€€¡µ•Ñ„¹Ù…Í-•åÍññmt¤¹™½É… ¡¬ôùí¥˜¡¬ôôôÙ…Í9½¹”œ¥É•ÑÕÉ¸í½¹ÍĞ¥Ğô¡½¹™¥œ¹Ù…Íññmt¤¹™¥¹¡ØôùØ¹­•äôôõ¬¤í¥˜¡9Õµ‰•È¡¥Ğü¹É…Ñ•ñğÀ¤¥É½İÌ¹ÁÕÍ ¡m¥Ğ¹±…‰•±ñğYLœ±9Õµ‰•È¡¥Ğ¹É…Ñ”¥t¤íô¤ì(€€€€€€¡µ•Ñ„¹‰Õ¹‘±”É¹‘-•åÍññmt¤¹™½É… ¡¬ôùí½¹ÍĞ¥Ğô¡½¹™¥œ¹‰Õ¹‘±”É¹‘ññmt¤¹™¥¹¡ØôùØ¹­•äôôõ¬¤í½¹ÍĞ™É•”ô¡µ•Ñ„¹‰Õ¹‘±•M…±•QåÁ•5…Àü¹m­uñğ¹½Éµ…°œ¤ôôô™É•”œí¥˜¡9Õµ‰•È¡¥Ğü¹É…Ñ•ñğÀ¤˜˜…™É•”¥É½İÌ¹ÁÕÍ ¡m¥Ğ¹±…‰•±ñğœÉ9œ±9Õµ‰•È¡¥Ğ¹É…Ñ”¥t¤íô¤ì(€€€€€¥˜¡µ•Ñ„¹ÕÍ•‘5¹Á	Õ¹‘±”¥í½¹ÍĞ¥Ğô¡½¹™¥œ¹µ¹Á	Õ¹‘±•ññmt¤¹™¥¹¡ØôùØ¹­•äôôôÕÍ•‘5¹Á	Õ¹‘±”œ¤í¥˜¡9Õµ‰•È¡¥Ğü¹É…Ñ•ñğÀ¤¥É½İÌ¹ÁÕÍ ¡lŸ²’GªÎ59@ƒªÊÃ¶V¤œ±9Õµ‰•È¡¥Ğ¹É…Ñ”¥t¤íô(€€€€€½¹ÍĞÍÀõµ•Ñ„¹ÍÁ•¥…±A½±¥åññíôì(€€€€€¥˜¡ÍÀ¹Á½±¥å%‘ññÍÀ¹Á½±¥åQåÁ”¥ì(€€€€€€€½¹ÍĞÕ¹Á…¥õ¥Í%¹•¹Ñ¥Ù•U¹Á…¥‘MÁ•¥…°¡ÍÀ¤±ÁÉ•™¥àõÕ¹Á…¥üŸ²vã²ó®¾ã²ªâ$ƒ¶*çªÂ œèŸ¶*çªÂ ›²²vã²‚W²Æœì(€€€€€€€¥˜¡Õ¹Á…¥˜™Á±…¸¥É½İÌ¹ÁÕÍ ¡m€‘íÁÉ•™¥áôƒ²jSªâ#²‚pƒ²‚s²fá€°µÁ±…¹t¤ì(€€€€€€€¥˜¡Õ¹Á…¥˜™9Õµ‰•È¡ÍÀ¹¹½Éµ…±Y…Í••ñğÀ¤¥É½İÌ¹ÁÕÍ ¡m€‘íÁÉ•™¥áôYO
ß®ÎÓ¶^`ƒ²‚s²fá€°µ9Õµ‰•È¡ÍÀ¹¹½Éµ…±Y…Í•”¥t¤ì(€€€€€€€½¹ÍĞÉ•Á°õ9Õµ‰•È¡ÍÀ¹•á•ÁÑ¥½¹MÑ…ÑÕÌôôô…ÁÁÉ½Ù•œıÍÀ¹•á•ÁÑ¥½¹ÁÁÉ½Ù•‘µ½Õ¹ĞéÍÀ¹É•Á±…•µ•¹Ñµ½Õ¹ÑñğÀ¤ì(€€€€€€€¥˜¡É•Á°¥É½İÌ¹ÁÕÍ ¡lŸ®ª£®6ã®Îƒ²ÚSªÂ ƒ²vã²ó¶.Ã®â0œ±É•Á±t¤ì(€€€€€ô(€€€õ•±Í”¥˜¡Í…±”ü¹Í½ÕÉ•}ÑåÁ”ôôô¡½µ•}½É‘•Èœ¥ì(€€€€€½¹ÍĞÕÍÑ½µ•ÈõÍ…±”¹ÕÍÑ½µ•ÉÌü¹ÕÍÑ½µ•É}¹…µ•ñğŸªÎƒªÂtœì(€€€€€½¹ÍĞ‘…Ñ”õMÑÉ¥¹œ¡Í…±”¹Í…±•}‘…Ñ•ñğœœ¤¹Í±¥” À°ÄÀ¤ì(€€€€€½¹ÍĞÁ½±¥å•Ñ…¥±Ìô¡¡½µ•AÉ•Ù¥•İA½±¥äü¹‘•Ñ…¥±ÍññÁ…äü¹¡½µ•A½±¥äü¹‘•Ñ…¥±Íññmt¤ì(€€€€€Á½±¥å•Ñ…¥±Ì¹™¥±Ñ•È¡àôùMÑÉ¥¹œ¡à¹‘…Ñ•ñğœœ¤ôôõ‘…Ñ”˜™MÑÉ¥¹œ¡à¹ÕÍÑ½µ•Éñğœœ¤ôôõÕÍÑ½µ•È¤¹™½É… ¡àôùì(€€€€€€€¥˜¡9Õµ‰•È¡à¹…µ½Õ¹ÑñğÀ¤„ôôÀ¥É½İÌ¹ÁÕÍ ¡mà¹¥Ñ•´±9Õµ‰•È¡à¹…µ½Õ¹Ğ¥t¤ì(€€€€€ô¤ì(€€€ô(€€€½¹ÍĞÑ½Ñ…°õÉ½İÌ¹É•‘Õ” ¡„±l±Ùt¤ôù„­9Õµ‰•È¡ÙñğÀ¤°À¤ì(€€€É•ÑÕÉ¸íÉ½İÌ±Ñ½Ñ…±ôì(€ôì((€½¹ÍĞµ½‰¥±•AÉ•Ù¥•Üô  ¤ôùì(€€€¥˜ …µ½‰¥±•M…±•É…™Ññğ…µ½‰¥±•M…±•-¥¹‘ñğ…9Õµ‰•È¹¥Í%¹Ñ••È¡µ½‰¥±•M…±•É…™Ğ¹É¤¥ñğ…9Õµ‰•È¹¥Í%¹Ñ••È¡µ½‰¥±•M…±•É…™Ğ¹¤¤¥É•ÑÕÉ¸¹Õ±°ì(€€€½¹ÍĞÍ…±•…Ñ”õ€‘íµ½¹Ñ¡ô´‘íÍ•±•Ñ•‘…åõ€ì(€€€½¹ÍĞ‰…Í”õ¹½Éµ…±¥é•…ä¡‘…ä¤±¹•áÑ5…ÑÉ¥àõ‰…Í”¹µ…ÑÉ¥à¹µ…À¡Èôùl¸¸¹Ét¤ì(€€€¹•áÑ5…ÑÉ¥ámµ½‰¥±•M…±•É…™Ğ¹É¥umµ½‰¥±•M…±•É…™Ğ¹¥tõ9Õµ‰•È¡¹•áÑ5…ÑÉ¥ámµ½‰¥±•M…±•É…™Ğ¹É¥umµ½‰¥±•M…±•É…™Ğ¹¥uñğÀ¤¬Äì(€€€½¹ÍĞ¹•áÑY…Ìõì¸¸¸¡‰…Í”¹É½ÕÁÌü¹Ù…Íññíô¥ôì(€€€€¡µ½‰¥±•Y…Í-•åÍññmt¤¹™½É… ¡¬ôùí¥˜¡¬„ôôÙ…Í9½¹”œ¥¹•áÑY…Ím­tõ9Õµ‰•È¡¹•áÑY…Ím­uñğÀ¤¬Åô¤ì(€€€½¹ÍĞ¹•áÑ	Õ¹‘±”õì¸¸¸¡‰…Í”¹É½ÕÁÌü¹‰Õ¹‘±”É¹‘ññíô¥ôíµ½‰¥±•	Õ¹‘±”É¹‘-•åÌ¹™½É… ¡¬ôù¹•áÑ	Õ¹‘±•m­tõ9Õµ‰•È¡¹•áÑ	Õ¹‘±•m­uñğÀ¤¬Ä¤ì(€€€½¹ÍĞ¹•áÑ5¹Á	Õ¹‘±”õì¸¸¸¡‰…Í”¹É½ÕÁÌü¹µ¹Á	Õ¹‘±•ññíô¥ôí¥˜¡9Õµ‰•È¡µ½‰¥±•M…±•É…™Ğ¹É¤¤ôôôÔ˜™9Õµ‰•È¡µ½‰¥±•M…±•É…™Ğ¹¤¤ğôÌ˜™µ½‰¥±•UÍ•‘5¹Á	Õ¹‘±”¥¹•áÑ5¹Á	Õ¹‘±”¹ÕÍ•‘5¹Á	Õ¹‘±”õ9Õµ‰•È¡¹•áÑ5¹Á	Õ¹‘±”¹ÕÍ•‘5¹Á	Õ¹‘±•ñğÀ¤¬Äì(€€€½¹ÍĞ™É•”õ‰Õ¹‘±•É••µ½Õ¹ÑÌ ¤ì(€€€½¹ÍĞÍ•±•Ñ•‘A½±¥äõÍÁ•¥…±A½±¥¥•Ì¹™¥¹¡ÀôùÀ¹¥ôôõµ½‰¥±•MÁ•¥…±A½±¥å%¤ì(€€€½¹ÍĞÍÁ•¥…±5…ÑÉ¥àõµ½‰¥±•M…±•-¥¹ôôô¥¹•¹Ñ¥Ù•}Õ¹Á…¥œı9Õµ‰•È¡½¹™¥œ¹µ…ÑÉ¥àü¹mµ½‰¥±•M…±•É…™Ğ¹É¥tü¹mµ½‰¥±•M…±•É…™Ğ¹¥uñğÀ¤èÀì(€€€½¹ÍĞÍÁ•¥…±Y…Ìõµ½‰¥±•M…±•-¥¹ôôô¥¹•¹Ñ¥Ù•}Õ¹Á…¥œü¡µ½‰¥±•Y…Í-•åÍññmt¤¹™¥±Ñ•È¡¬ôù¬„ôôÙ…Í9½¹”œ¤¹É•‘Õ” ¡Ì±¬¤ôùÌ­9Õµ‰•È ¡½¹™¥œ¹Ù…ÍññU1Q}YL¤¹™¥¹¡ØôùØ¹­•äôôõ¬¤ü¹É…Ñ•ñğÀ¤°À¤èÀì(€€€½¹ÍĞÍÑÉ…Ñ•¥A½¥¹ÑÌõµ½‰¥±•MÑÉ…Ñ•¥A½¥¹Ğ¡íÍÑÉ…Ñ•¥A±…¸è„…µ½‰¥±•MÑÉ…Ñ•¥A±…¸±Ù…Í-•åÌéµ½‰¥±•Y…Í-•åÌ±‰Õ¹‘±•Y…Í5…Àéµ½‰¥±•	Õ¹‘±•Y…Í5…Áô¤ì(€€€½¹ÍĞÍÁ•¥…±=ÕÑ½µ”õµ½‰¥±•M…±•-¥¹ôôôÍÁ•¥…°œ˜™µ½‰¥±•MÁ•¥…±A½±¥å%˜™¥ÍM•ÁÑ•µ‰•ÉA½±¥åÑ¥Ù”¡µ½¹Ñ ¤ı…±Õ±…Ñ•M•ÁÑ•µ‰•ÉMÁ•¥…±M…±”¡íÁ½±¥å-•äéµ½‰¥±•MÁ•¥…±A½±¥å%±Á±…¹É½ÕÀéÍ•ÁÑ•µ‰•ÉA±…¹É½ÕÀ¡µ½‰¥±•M…±•É…™Ğ¹¤¤±ÍÑÉ…Ñ•¥A½¥¹ÑÌ±Í…±•…Ñ•ô¤é¹Õ±°ì(€€€½¹ÍĞÉ•Á±…•µ•¹Ğõµ½‰¥±•M…±•-¥¹ôôôÍÁ•¥…°œ˜™µ½‰¥±•MÁ•¥…±A½±¥å%ı9Õµ‰•È¡ÍÁ•¥…±=ÕÑ½µ”ü¹…‘‘¥Ñ¥½¹…±µ½Õ¹ĞüıÍ•±•Ñ•‘A½±¥äü¹É•Á±…•µ•¹Ñ}…µ½Õ¹ĞüüÀ¤èÀì(€€€½¹ÍĞ¹•áÑ…äõì¸¸¹‰…Í”±µ…ÑÉ¥àé¹•áÑ5…ÑÉ¥à±É½ÕÁÌéì¸¸¹‰…Í”¹É½ÕÁÌ±Ù…Ìé¹•áÑY…Ì±‰Õ¹‘±”É¹é¹•áÑ	Õ¹‘±”±µ¹Á	Õ¹‘±”é¹•áÑ5¹Á	Õ¹‘±•ô±‰Õ¹‘±•É••=™™Í•Ğé9Õµ‰•È¡‰…Í”¹‰Õ¹‘±•É••=™™Í•ÑñğÀ¤­™É•”¹‰Õ¹‘±•=™™Í•Ğ±‰Õ¹‘±•É••Y…Í=™™Í•Ğé9Õµ‰•È¡‰…Í”¹‰Õ¹‘±•É••Y…Í=™™Í•ÑñğÀ¤­™É•”¹Ù…Í=™™Í•Ğ±ÍÁ•¥…±5…ÑÉ¥á=™™Í•Ğé9Õµ‰•È¡‰…Í”¹ÍÁ•¥…±5…ÑÉ¥á=™™Í•ÑñğÀ¤­ÍÁ•¥…±5…ÑÉ¥à±ÍÁ•¥…±Y…Í=™™Í•Ğé9Õµ‰•È¡‰…Í”¹ÍÁ•¥…±Y…Í=™™Í•ÑñğÀ¤­ÍÁ•¥…±Y…Ì±ÍÁ•¥…±I•Á±…•µ•¹ÑA…äé9Õµ‰•È¡‰…Í”¹ÍÁ•¥…±I•Á±…•µ•¹ÑA…åñğÀ¤­É•Á±…•µ•¹Ñôì(€€€½¹ÍĞ‰•™½É•É…™Ğõ…ÁÁ±å…¥±åQ½É…™Ğ¡‘É…™Ğ±ì¸¸¹‘…¥±å…åÌ±mÍ•±•Ñ•‘…åté‰…Í•ô±µ½¹Ñ ±½¹™¥œ¹…Ñ•½Éå5…À±½¹™¥œ¹¥‰å•½¹½±Õµ¹5…À¤ì(€€€½¹ÍĞ…™Ñ•ÉÉ…™Ğõ…ÁÁ±å…¥±åQ½É…™Ğ¡‘É…™Ğ±ì¸¸¹‘…¥±å…åÌ±mÍ•±•Ñ•‘…åté¹•áÑ…åô±µ½¹Ñ ±½¹™¥œ¹…Ñ•½Éå5…À±½¹™¥œ¹¥‰å•½¹½±Õµ¹5…À¤ì(€€€½¹ÍĞ‰•™½É•A…äõ½µÁÕÑ•A…ä¡‰•™½É•É…™Ğ±ÕÉÉ•¹ÑµÀü¹Á½Í¥Ñ¥½¹ñğŸ²
³²n@œ±ÕÉÉ•¹ÑµÀü¹¡¥É•…Ñ”±µ½¹Ñ ±½¹™¥œ¤ì(€€€½¹ÍĞ…™Ñ•ÉA…äõ½µÁÕÑ•A…ä¡…™Ñ•ÉÉ…™Ğ±ÕÉÉ•¹ÑµÀü¹Á½Í¥Ñ¥½¹ñğŸ²
³²n@œ±ÕÉÉ•¹ÑµÀü¹¡¥É•…Ñ”±µ½¹Ñ ±½¹™¥œ¤ì(€€€½¹ÍĞÙ…Í1…‰•±Ìô¡µ½‰¥±•Y…Í-•åÍññmt¤¹™¥±Ñ•È ¡¬±¤±„¤ôù¬„ôôÙ…Í9½¹”œ˜™„¹¥¹‘•á=˜¡¬¤ôôõ¤¤¹µ…À¡¬ôø¡½¹™¥œ¹Ù…ÍññU1Q}YL¤¹™¥¹¡ØôùØ¹­•äôôõ¬¤ü¹±…‰•±ññ¬¤ì(€€€½¹ÍĞÍ•½¹‘1…‰•±Ìõµ½‰¥±•	Õ¹‘±”É¹‘-•åÌ¹µ…À¡¬ôø¡½¹™¥œ¹‰Õ¹‘±”É¹‘ññU1Q}	U91É9¤¹™¥¹¡ØôùØ¹­•äôôõ¬¤ü¹±…‰•°ü¹É•Á±…” œÉ9ƒ
Ü€œ°œœ¥ññ¬¤ì(€€€½¹ÍĞÁÉ½µ¥Í•½Õ¹Ğõµ½‰¥±•…É•-•åÌ¹É•‘Õ” ¡¸±¬¤ôù¸¬¡¬ôôôÁ…åµ•¹ĞÌœıµ½‰¥±•A…åµ•¹Ñ½Õ¹ĞèÄ¤°À¤¬¡míÑ¥Ñ±”éµ½‰¥±•ÕÍÑ½µQ¥Ñ±”±‘Õ•…Ñ”éµ½‰¥±•ÕÍÑ½µÕ•…Ñ•ô°¸¸¹µ½‰¥±•áÑÉ…AÉ½µ¥Í•Ít¹™¥±Ñ•È¡àôùMÑÉ¥¹œ¡à¹Ñ¥Ñ±•ñğœœ¤¹ÑÉ¥´ ¤˜™à¹‘Õ•…Ñ”¤¹±•¹Ñ ¤ì(€€€½¹ÍĞ¥¹•¹Ñ¥Ù”õ5…Ñ ¹µ…à À±9Õµ‰•È¡…™Ñ•ÉA…ä¹ÕÉÉ•¹ÑA•É™½Éµ…¹•µ½Õ¹ÑñğÀ¤µ9Õµ‰•È¡‰•™½É•A…ä¹ÕÉÉ•¹ÑA•É™½Éµ…¹•µ½Õ¹ÑñğÀ¤¤ì(€€€½¹ÍĞÁ½¥¹ÑÌõ9Õµ‰•È¡…™Ñ•ÉA…ä¹Ñ½Ñ…±A½¥¹ÑÍñğÀ¤µ9Õµ‰•È¡‰•™½É•A…ä¹Ñ½Ñ…±A½¥¹ÑÍñğÀ¤ì(€€€½¹ÍĞÁÉ½‘ÕÑ¥Ù¥Ñäõ9Õµ‰•È¡…™Ñ•ÉA…ä¹­Á¥M½É•ñğÀ¤µ9Õµ‰•È¡‰•™½É•A…ä¹­Á¥M½É•ñğÀ¤ì(€€€½¹ÍĞ…±Õ±…Ñ¥½¹1¥¹•Ìõmtì(€€€½¹ÍĞ…Ñ¥Ù¥Ñå•±Ñ„õ9Õµ‰•È¡…™Ñ•ÉA…ä¹Ñ•¹ÕÉ•A…åñğÀ¤µ9Õµ‰•È¡‰•™½É•A…ä¹Ñ•¹ÕÉ•A…åñğÀ¤ì(€€€½¹ÍĞÁ±…¹•±Ñ„õ9Õµ‰•È¡…™Ñ•ÉA…ä¹µ…ÑÉ¥áQ½Ñ…±ñğÀ¤µ9Õµ‰•È¡‰•™½É•A…ä¹µ…ÑÉ¥áQ½Ñ…±ñğÀ¤ì(€€€½¹ÍĞ…ÁÁ±¥•‘A±…¹•±Ñ„õ9Õµ‰•È¡…™Ñ•ÉA…ä¹µ½‰¥±•A±…¹A…åñğÀ¤µ9Õµ‰•È¡‰•™½É•A…ä¹µ½‰¥±•A±…¹A…åñğÀ¤ì(€€€½¹ÍĞÙ…Í•±Ñ„õ9Õµ‰•È¡…™Ñ•ÉA…ä¹É…İY…ÍA…åñğÀ¤µ9Õµ‰•È¡‰•™½É•A…ä¹É…İY…ÍA…åñğÀ¤ì(€€€½¹ÍĞÍ•½¹‘•±Ñ„õ9Õµ‰•È¡…™Ñ•ÉA…ä¹É…İ	Õ¹‘±”É¹‘Q½Ñ…±ñğÀ¤µ9Õµ‰•È¡‰•™½É•A…ä¹É…İ	Õ¹‘±”É¹‘Q½Ñ…±ñğÀ¤ì(€€€½¹ÍĞ…ÁÁ±¥•‘M•½¹‘•±Ñ„õ9Õµ‰•È¡…™Ñ•ÉA…ä¹‰Õ¹‘±”É¹‘A…åñğÀ¤µ9Õµ‰•È¡‰•™½É•A…ä¹‰Õ¹‘±”É¹‘A…åñğÀ¤ì(€€€½¹ÍĞÍÑÉ…Ñ•¥•±Ñ„õ9Õµ‰•È¡…™Ñ•ÉA…ä¹ÍÑÉ…Ñ•¥‘©ÕÍÑµ•¹ÑñğÀ¤µ9Õµ‰•È¡‰•™½É•A…ä¹ÍÑÉ…Ñ•¥‘©ÕÍÑµ•¹ÑñğÀ¤ì(€€€¥˜¡…Ñ¥Ù¥Ñå•±Ñ„¥…±Õ±…Ñ¥½¹1¥¹•Ì¹ÁÕÍ ¡lŸ²b²^¶fs®>dƒ²²nCªâ œ±…Ñ¥Ù¥Ñå•±Ñ…t¤ì(€€€…±Õ±…Ñ¥½¹1¥¹•Ì¹ÁÕÍ ¡mƒ²jSªâ#²‚pƒ
Ü€‘íµ½‰¥±•M…±•É…™Ğ¹±…‰•±õ€±Á±…¹•±Ñ…t¤ì(€€€½¹ÍĞ•±¥¥‰±•A±…¹•±Ñ„õ9Õµ‰•È¡…™Ñ•ÉA…ä¹…‘©ÕÍÑ•‘5…ÑÉ¥áQ½Ñ…±ñğÀ¤µ9Õµ‰•È¡‰•™½É•A…ä¹…‘©ÕÍÑ•‘5…ÑÉ¥áQ½Ñ…±ñğÀ¤ì(€€€½¹ÍĞ•±¥¥‰±•M•½¹‘•±Ñ„õ9Õµ‰•È¡…™Ñ•ÉA…ä¹‰Õ¹‘±”É¹‘Q½Ñ…±ñğÀ¤µ9Õµ‰•È¡‰•™½É•A…ä¹‰Õ¹‘±”É¹‘Q½Ñ…±ñğÀ¤ì(€€€½¹ÍĞ¡½µ•‘©ÕÍÑµ•¹Ğô¡…ÁÁ±¥•‘A±…¹•±Ñ„µ•±¥¥‰±•A±…¹•±Ñ„¤¬¡…ÁÁ±¥•‘M•½¹‘•±Ñ„µ•±¥¥‰±•M•½¹‘•±Ñ„¤ì(€€€¥˜¡Ù…Í1…‰•±Ì¹±•¹Ñ ¥…±Õ±…Ñ¥½¹1¥¹•Ì¹ÁÕÍ ¡mYO
ß®ÎÓ¶^`€‘íÙ…Í1…‰•±Ì¹±•¹Ñ¡÷ªÂq€±Ù…Í•±Ñ…t¤ì(€€€¥˜¡Í•½¹‘1…‰•±Ì¹±•¹Ñ ¥…±Õ±…Ñ¥½¹1¥¹•Ì¹ÁÕÍ ¡m€É9€‘íÍ•½¹‘1…‰•±Ì¹±•¹Ñ¡÷ªÂpƒ
Ü€‘íÍ•½¹‘1…‰•±Ì¹©½¥¸ œ°€œ¥õ€±Í•½¹‘•±Ñ…t¤ì(€€€¥˜¡¡½µ•‘©ÕÍÑµ•¹Ğ¥…±Õ±…Ñ¥½¹1¥¹•Ì¹ÁÕÍ ¡lŸ¶f ƒ².“²‚ƒªâÃ²’ ƒ²b#²ƒ²†Ã²‚Tœ±¡½µ•‘©ÕÍÑµ•¹Ñt¤ì(€€€¥˜¡ÍÑÉ…Ñ•¥•±Ñ„¥…±Õ±…Ñ¥½¹1¥¹•Ì¹ÁÕÍ ¡lŸ²‚®z×¶>³²vã¶*àƒ®æ²’Dƒ²b#²ƒ²†Ã²‚Tœ±ÍÑÉ…Ñ•¥•±Ñ…t¤ì(€€€¥˜¡µ½‰¥±•UÍ•‘5¹Á	Õ¹‘±”¥…±Õ±…Ñ¥½¹1¥¹•Ì¹ÁÕÍ ¡lŸ²’GªÎ€59@ƒªÊÃ¶V¤œ±9Õµ‰•È ¡½¹™¥œ¹µ¹Á	Õ¹‘±•ññU1Q}59A}	U91¤¹™¥¹¡ØôùØ¹­•äôôôÕÍ•‘5¹Á	Õ¹‘±”œ¤ü¹É…Ñ•ñğÀ¥t¤ì(€€€¥˜¡™É•”¹‰Õ¹‘±•=™™Í•Ğ¥…±Õ±…Ñ¥½¹1¥¹•Ì¹ÁÕÍ ¡lœÉ9ƒ¶Vƒ²vã
ß²†ÃªÆĞƒ®¾ã²Ú§²†Äƒ²‚s²fàœ°µ9Õµ‰•È¡™É•”¹‰Õ¹‘±•=™™Í•ÑñğÀ¥t¤ì(€€€¥˜¡ÍÁ•¥…±5…ÑÉ¥áññÍÁ•¥…±Y…Ì¥…±Õ±…Ñ¥½¹1¥¹•Ì¹ÁÕÍ ¡lŸ²vã²ó®¾ã²ªâ$ƒ¶*çªÂ ƒ²‚s²fàœ°´¡ÍÁ•¥…±5…ÑÉ¥à­ÍÁ•¥…±Y…Ì¥t¤ì(€€€¥˜¡É•Á±…•µ•¹Ğ¥…±Õ±…Ñ¥½¹1¥¹•Ì¹ÁÕÍ ¡lŸ¶*çªÂ
ß²²vàƒ²ÚSªÂ œ±É•Á±…•µ•¹Ñt¤ì(€€€½¹ÍĞ•áÁ±…¥¹•õ…±Õ±…Ñ¥½¹1¥¹•Ì¹É•‘Õ” ¡ÍÕ´±l±…µ½Õ¹Ñt¤ôùÍÕ´­9Õµ‰•È¡…µ½Õ¹ÑñğÀ¤°À¤ì(€€€½¹ÍĞ½Ñ¡•É•±Ñ„õ¥¹•¹Ñ¥Ù”µ•áÁ±…¥¹•ì(€€€¥˜¡½Ñ¡•É•±Ñ„¥…±Õ±…Ñ¥½¹1¥¹•Ì¹ÁÕÍ ¡lŸ®"²‚ƒªÖ³ªÂ
ßªâÃ¶ ƒ²b#²ƒ®Î®>dœ±½Ñ¡•É•±Ñ…t¤ì(€€€É•ÑÕÉ¸í¥¹•¹Ñ¥Ù”±Á½¥¹ÑÌ±ÁÉ½‘ÕÑ¥Ù¥Ñä±ÍÑÉ…Ñ•¥A½¥¹ÑÌ±…±Õ±…Ñ¥½¹1¥¹•Ì±Ù…Í1…‰•±Ì±Í•½¹‘1…‰•±Ì±ÁÉ½µ¥Í•½Õ¹Ñôì(€ô¤ ¤ì((€É•ÑÕÉ¸€ (€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰ÍÁ…”µä´ÌÉ•±…Ñ¥Ù”ˆø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•Ñİ••¸ˆø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÉ…ä´ÜÀÀˆùíµ½¹Ñ¡1…‰•°¡µ½¹Ñ ¥ôƒ²vó²vó²z®‚”ğ½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È…À´Èˆø(€€€€€€€€€€ñ…¥±åM…Ù•	…‘”ÍÑ…Ñ”õíÍ…Ù•MÑ…Ñ•ô¥Í=¹±¥¹”õí¥Í=¹±¥¹•ô½¹I•ÑÉäõì ¤ôù™±ÕÍ¡I•˜¹ÕÉÉ•¹Ğ ¥ô€¼ø(€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ…ä´ĞÀÀˆû®"²‚íµ½¹Ñ¡Q½Ñ…±÷ªÆĞğ½ÍÁ…¸ø(€€€€€€€€ğ½‘¥Øø(€€€€€€ğ½‘¥Øø((€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµİ¡¥Ñ”É½Õ¹‘•µá°‰½É‘•È‰½É‘•ÈµÉ…ä´ÄÀÀÀ´Ìˆø(€€€€€€€€ñ±…‰•°±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•Ñİ••¸…À´ÌÁˆ´Ìµˆ´Ì‰½É‘•Èµˆ‰½É‘•ÈµÉ…ä´ÄÀÀÕÉÍ½ÈµÁ½¥¹Ñ•Èˆø(€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÉ…ä´ÜÀÀˆû¶fs®>dƒ².sªÂƒ²Ú§²†Äğ½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÅÁátÑ•áĞµÉ…ä´ĞÀÀµĞ´À¸Ôˆû®¾ã²Ú§²†Äƒ².pƒ²b²^ƒ¶fs®>dƒ²²nCªâ íİ½¸¡½¹™¥œ¹‰…Í•A•¹…±Ñä¥ôƒ²Â£ªÂ@ğ½‘¥Øø(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÍ¡É¥¹¬´ÀÁà´È¸ÔÁä´Ä¸ÔÉ½Õ¹‘•µ±œ™±•à¥Ñ•µÌµ•¹Ñ•È…À´Ä¸ÔÑ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±€‘í‘É…™Ğ¹…Ñ¥Ù¥ÑåQ¥µ•5•Ğ€ü€‰œµ•µ•É…±´ÔÀÑ•áĞµ•µ•É…±´ÜÀÀœ€è€‰œµÉ•´ÔÀÑ•áĞµÉ•´ØÀÀõôø(€€€€€€€€€€€€ñ¥¹ÁÕĞ(€€€€€€€€€€€€€ÑåÁ”ô‰¡•­‰½àˆ(€€€€€€€€€€€€€¡•­•õí‘É…™Ğ¹…Ñ¥Ù¥ÑåQ¥µ•5•Ñô(€€€€€€€€€€€€€½¹¡…¹”õì¡”¤€ôøÍ•ÑÉ…™Ğ¡ì€¸¸¹‘É…™Ğ°…Ñ¥Ù¥ÑåQ¥µ•5•Ğè”¹Ñ…É•Ğ¹¡•­•ô¥ô(€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰Ü´Ğ ´Ğˆ(€€€€€€€€€€€€¼ø(€€€€€€€€€€€í‘É…™Ğ¹…Ñ¥Ù¥ÑåQ¥µ•5•Ğ€ü€Ÿ²Ú§²†Äœ€è€Ÿ®¾ã²Ú§²†Äô(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€ğ½±…‰•°ø((€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É¥É¥µ½±Ì´Ü…À´Ä¸Ôµˆ´Ä¸Ôˆø(€€€€€€€€€ílŸ²vğœ°€Ÿ²nPœ°€Ÿ¶fPœ°€Ÿ²"`œ°€Ÿ®ª¤œ°€Ÿªâ œ°€Ÿ¶€t¹µ…À ¡Ü°¤¤€ôø€ (€€€€€€€€€€€€ñ‘¥Ø­•äõíİô±…ÍÍ9…µ”õíÑ•áĞµ•¹Ñ•ÈÑ•áĞµlÄÅÁát™½¹ĞµÍ•µ¥‰½±Áä´Ä€‘í¤€ôôô€À€ü€Ñ•áĞµÉ•´ĞÀÀœ€è¤€ôôô€Ø€ü€Ñ•áĞµ‰±Õ”´ĞÀÀœ€è€Ñ•áĞµÉ…ä´ĞÀÀõôø(€€€€€€€€€€€€€íİô(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€¤¥ô(€€€€€€€€ğ½‘¥Øø((€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É¥É¥µ½±Ì´Ü…À´Ä¸Ôˆø(€€€€€€€€€íÉÉ…ä¹™É½´¡ì±•¹Ñ è¹•Ü…Ñ”¡9Õµ‰•È¡µ½¹Ñ ¹Í±¥” À°€Ğ¤¤°9Õµ‰•È¡µ½¹Ñ ¹Í±¥” Ô°€Ü¤¤€´€Ä°€Ä¤¹•Ñ…ä ¤ô¤¹µ…À ¡|°¤¤€ôø€ (€€€€€€€€€€€€ñ‘¥Ø­•äõí‰±…¹¬´‘í¥õô±…ÍÍ9…µ”ô‰…ÍÁ•ĞµÍÅÕ…É”ˆ€¼ø(€€€€€€€€€€¤¥ô(€€€€€€€€€íÉÉ…ä¹™É½´¡ì±•¹Ñ è¸ô°€¡|°¤¤€ôø¤€¬€Ä¤¹µ…À ¡¤€ôøì(€€€€€€€€€€€½¹ÍĞ­•ä€ôMÑÉ¥¹œ¡¤¹Á…‘MÑ…ÉĞ È°€œÀœ¤ì(€€€€€€€€€€€½¹ÍĞÉ•Œ€ô­•ä€ôôôÍ•±•Ñ•‘…ä€ü‘…ä€è¹½Éµ…±¥é•…ä¡‘…¥±å…åÍm­•åt¤ì(€€€€€€€€€€€½¹ÍĞ¡…Ì€ô‘…å!…Í…Ñ„¡É•Œ¤ì(€€€€€€€€€€€½¹ÍĞ½™˜€ô€„…É•Œ¹‘…å=™˜ì(€€€€€€€€€€€½¹ÍĞ¥ÍM•°€ô­•ä€ôôôÍ•±•Ñ•‘…äì(€€€€€€€€€€€½¹ÍĞ½É•5•ÑÉ¥Ìõ…±•¹‘…É½É•5•ÑÉ¥Ì¡­•äôôõÍ•±•Ñ•‘…äı‘…äé‘…¥±å…åÍm­•åt¤ì(€€€€€€€€€€€½¹ÍĞ…±!Ìõ½É•5•ÑÉ¥Ì¹¡Ìì(€€€€€€€€€€€½¹ÍĞ…±M¥´õ½É•5•ÑÉ¥Ì¹Í¥´ì(€€€€€€€€€€€½¹ÍĞ…±!½µ”õ½É•5•ÑÉ¥Ì¹¡½µ”ì(€€€€€€€€€€€½¹ÍĞ¡…Í…±MÕµµ…Éäõ…±!ÌøÁññ…±M¥´øÁññ…±!½µ”øÀì(€€€€€€€€€€€½¹ÍĞ‘½Ü€ô¹•Ü…Ñ”¡9Õµ‰•È¡µ½¹Ñ ¹Í±¥” À°€Ğ¤¤°9Õµ‰•È¡µ½¹Ñ ¹Í±¥” Ô°€Ü¤¤€´€Ä°¤¹•Ñ…ä ¤ì(€€€€€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸­•äõí‘ô½¹±¥¬õì ¤€ôøÍ•±•Ñ…ä¡­•ä¥ô(€€€€€€€€€€€€€€€±…ÍÍ9…µ”õíÉ•±…Ñ¥Ù”µ¥¸µÜ´À µlÔáÁátÍ´é µlØÑÁátÉ½Õ¹‘•µ±œÑ•áĞµáÌ™½¹Ğµµ•‘¥Õ´™±•à™±•àµ½°¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµÍÑ…ÉĞÁĞ´È¸Ô½Ù•É™±½Üµ¡¥‘‘•¸(€€€€€€€€€€€€€€€€€€‘í¥ÍM•°€ü€¡½™˜€ü€‰œµ•µ•É…±´ØÀÀÑ•áĞµİ¡¥Ñ”œ€è€‰œµÙ¥½±•Ğ´ØÀÀÑ•áĞµİ¡¥Ñ”œ¤€è½™˜€ü€‰œµ•µ•É…±´ÔÀÑ•áĞµ•µ•É…±´ÜÀÀœ€è¡…Ì€ü€‰œµÙ¥½±•Ğ´ÔÀÑ•áĞµÙ¥½±•Ğ´ÜÀÀœ€è‘½Ü€ôôô€À€ü€‰œµÉ•´ÔÀ¼ÔÀÑ•áĞµÉ•´ĞÀÀœ€è‘½Ü€ôôô€Ø€ü€‰œµ‰±Õ”´ÔÀ¼ÔÀÑ•áĞµ‰±Õ”´ĞÀÀœ€è€‰œµÉ…ä´ÔÀÑ•áĞµÉ…ä´ÔÀÀõôø(€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰±•…‘¥¹œµ¹½¹”Í¡É¥¹¬´Àˆùí‘ôğ½ÍÁ…¸ø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰ µlÌÉÁátµĞ´Ä¸Ô™±•à™±•àµ½°¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµÍÑ…ÉĞÍ¡É¥¹¬´Àˆø(€€€€€€€€€€€€€€€€€í½™˜€ü€ (€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”õíÑ•áĞµláÁát±•…‘¥¹œµlÄÁÁát€‘í¥ÍM•°€ü€Ñ•áĞµİ¡¥Ñ”¼àÀœ€è€Ñ•áĞµ•µ•É…±´ØÀÀõôû¶rÓ®²Ğğ½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€¤€è€ (€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÑ•áĞµlØ¸ÕÁátÍ´éÑ•áĞµlİÁát±•…‘¥¹œµlåÁát™½¹ĞµÍ•µ¥‰½±Ñ•áĞµ•¹Ñ•Èİ¡¥Ñ•ÍÁ…”µ¹½İÉ…À€‘í¥ÍM•°üÑ•áĞµİ¡¥Ñ”¼äÀœèÑ•áĞµÉ…ä´ØÀÀõôø(€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õí…±!ÌøÀüœœè¥¹Ù¥Í¥‰±”ôù!Lí™µÑ½Õ¹Ğ¡…±!Ì¥ôğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õí…±M¥´øÀüœœè¥¹Ù¥Í¥‰±”ôùM%459@í™µÑ½Õ¹Ğ¡…±M¥´¥ôğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õí…±!½µ”øÀüœœè¥¹Ù¥Í¥‰±”ôû¶f í™µÑ½Õ¹Ğ¡…±!½µ”¥ôğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€¥ô(€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€ì…½™˜€˜˜€…¡…Í…±MÕµµ…Éä€˜˜¡…Ì€˜˜€…¥ÍM•°€˜˜€ñÍÁ…¸±…ÍÍ9…µ”ô‰…‰Í½±ÕÑ”‰½ÑÑ½´´ÄÜ´Ä ´ÄÉ½Õ¹‘•µ™Õ±°‰œµÙ¥½±•Ğ´ÔÀÀˆ€¼ùô(€€€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€¤ì(€€€€€€€€€ô¥ô(€€€€€€€€ğ½‘¥Øø((€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´ÌÁĞ´Ì‰½É‘•ÈµĞ‰½É‘•ÈµÉ…ä´ÄÀÀ™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•Ñİ••¸…À´Ìˆø(€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÉ…ä´ÜÀÀˆû²vĞƒ®
ƒ²s®*Pƒ¶rÓ®²Ó²vãªÂ²jPüğ½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÅÁátÑ•áĞµÉ…ä´ĞÀÀˆû¶rÓ®²Ó²vó²v ƒªŞó®²Ó²vğƒ²^Ã²4ƒªâÃ®†w²^C²pƒ²zC²^Ã²*“®~÷ªÊ0ƒªÆÓ®#®nÃ²ZÓ²jP¸ğ½‘¥Øø(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€½¹±¥¬õì ¤€ôøÍ•Ñ…å=™˜ …¥Í…å=™˜¥ô(€€€€€€€€€€€‘¥Í…‰±•õí±½­•‘ô(€€€€€€€€€€€±…ÍÍ9…µ”õíÍ¡É¥¹¬´ÀÁà´ÌÁä´ÈÉ½Õ¹‘•µ±œÑ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±‰½É‘•È€‘ì(€€€€€€€€€€€€€¥Í…å=™˜(€€€€€€€€€€€€€€€€ü€‰œµ•µ•É…±´ØÀÀÑ•áĞµİ¡¥Ñ”‰½É‘•Èµ•µ•É…±´ØÀÀœ(€€€€€€€€€€€€€€€€è€‰œµİ¡¥Ñ”Ñ•áĞµÉ…ä´ÔÀÀ‰½É‘•ÈµÉ…ä´ÈÀÀœ(€€€€€€€€€€€ô‘¥Í…‰±•é½Á…¥Ñä´ÔÁô(€€€€€€€€€€ø(€€€€€€€€€€€í¥Í…å=™˜€ü€Ÿ¶rÓ®²ĞƒŠrLœ€è€Ÿ¶rÓ®²Ğô(€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€ğ½‘¥Øø(€€€€€€€ì…¥Í…å=™˜˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´ÌÁĞ´Ì‰½É‘•ÈµĞ‰½É‘•ÈµÉ…ä´ÄÀÀ™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•Ñİ••¸…À´Ìˆø(€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÉ…ä´ÜÀÀˆû²b“®*`ƒ².“²‚²vĞ€ÃªÆÓ²vãªÂ²jPüğ½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÅÁátÑ•áĞµÉ…ä´ĞÀÀµĞ´À¸ÔˆøÃªÆÓ®>ƒ¶fW²vã¶VÓ²Vğƒ®¾ã²z®‚—²vĞƒ²V®.0ƒ²‚W²ƒ²z®‚—²ró®†pƒ²GªÎ®>ó²jP¸ğ½‘¥Øø(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€½¹±¥¬õì ¤ôùÍ•Ñi•É½½¹™¥Éµ• …‘…ä¹¥¹ÁÕÑ½¹™¥Éµ•¥ô(€€€€€€€€€€€‘¥Í…‰±•õí±½­•‘ññ‘…å!…ÍA•É™½Éµ…¹•…Ñ„¡‘…ä¥ô(€€€€€€€€€€€±…ÍÍ9…µ”õíÍ¡É¥¹¬´ÀÁà´ÌÁä´ÈÉ½Õ¹‘•µ±œÑ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±‰½É‘•È€‘ì(€€€€€€€€€€€€€‘…å!…ÍA•É™½Éµ…¹•…Ñ„¡‘…ä¤ü‰œµÉ…ä´ÄÀÀÑ•áĞµÉ…ä´ĞÀÀ‰½É‘•ÈµÉ…ä´ÄÀÀœé‘…ä¹¥¹ÁÕÑ½¹™¥Éµ•ü‰œµÙ¥½±•Ğ´ØÀÀÑ•áĞµİ¡¥Ñ”‰½É‘•ÈµÙ¥½±•Ğ´ØÀÀœè‰œµİ¡¥Ñ”Ñ•áĞµÙ¥½±•Ğ´ØÀÀ‰½É‘•ÈµÙ¥½±•Ğ´ÈÀÀœ(€€€€€€€€€€€ô‘¥Í…‰±•é½Á…¥Ñä´ØÁô(€€€€€€€€€€ø(€€€€€€€€€€€í‘…å!…ÍA•É™½Éµ…¹•…Ñ„¡‘…ä¤üŸ².“²‚ƒ²z®‚—®B œé‘…ä¹¥¹ÁÕÑ½¹™¥Éµ•üœÃªÆĞƒ¶fW²vàƒŠrLœèœÃªÆĞƒ¶fW²vàô(€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€ğ½‘¥Øùô(€€€€€€ğ½‘¥Øø((€€€€€í¥Í…å=™˜€ü€ (€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµ•µ•É…±´ÔÀ‰½É‘•È‰½É‘•Èµ•µ•É…±´ÄÀÀÉ½Õ¹‘•µá°À´ÔÑ•áĞµ•¹Ñ•Èˆø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞ´Éá°µˆ´ÈˆûÂ~2üğ½‘¥Øø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´™½¹Ğµ‰½±Ñ•áĞµ•µ•É…±´àÀÀˆû²b“®*c²v ƒ¶rÓ®²Ó®†pƒ²“²‚W¶Z#²ZÓ²jPğ½‘¥Øø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµ•µ•É…±´ÜÀÀ¼ÜÀµĞ´Äˆû¶Fäƒ²&³ªÎ€ƒ®.“²v0ƒªŞó®²Ó²vó®Ú¶Àƒ²vÓ²ZÓªÂ²jP€è¤ğ½‘¥Øø(€€€€€€€€ğ½‘¥Øø(€€€€€€¤€è€ (€€€€€€ğø((€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•Ñİ••¸ˆø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÉ…ä´àÀÀˆùíÁ…ÉÍ•%¹Ğ¡Í•±•Ñ•‘…ä°€ÄÀ¥÷²vğƒ
Üí½É•…åQ½Ñ…±÷ªÆĞğ½‘¥Øø(€€€€€€ğ½‘¥Øø((€€€€€€ğø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµİ¡¥Ñ”É½Õ¹‘•µá°‰½É‘•È‰½É‘•ÈµÉ…ä´ÄÀÀ½Ù•É™±½Üµ¡¥‘‘•¸ˆø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Áà´ĞÁä´È¸ÔÑ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÉ…ä´ÔÀÀ‰½É‘•Èµˆ‰½É‘•ÈµÉ…ä´ÔÀ™±•à©ÕÍÑ¥™äµ‰•Ñİ••¸ˆø(€€€€€€€€€€€€€€ñÍÁ…¸ùíÁ…ÉÍ•%¹Ğ¡Í•±•Ñ•‘…ä°€ÄÀ¥÷²vğƒªÎƒªÂw®Îƒ¶2C®ƒ®
Ó²^´ğ½ÍÁ…¸ø(€€€€€€€€€€€€€€ñÍÁ…¸ùíÉ½ÕÁ•‘½É•M…±•Ì¹±•¹Ñ €¬€¡‘…ä¹¡½ÕÍ•¡½±‘I•¹•İ…±Ìü¹±•¹Ñ¡ñğÀ¥÷ªÆĞğ½ÍÁ…¸ø(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€í‘…åM…±•Í1½…‘¥¹œ€ü€ (€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Áà´ĞÁä´àÑ•áĞµ•¹Ñ•ÈÑ•áĞµÍ´Ñ•áĞµÉ…ä´ĞÀÀˆû¶2C®ƒ®
Ó²^´ƒ®Ú#®~³²b“®*Pƒ²’D¸¸¸ğ½‘¥Øø(€€€€€€€€€€€€¤€è‘…åM…±•Ì¹±•¹Ñ €ôôô€À€˜˜€¡‘…ä¹¡½ÕÍ•¡½±‘I•¹•İ…±Ìü¹±•¹Ñ¡ñğÀ¤€ôôô€À€ü€ (€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Áà´ĞÁä´ØÑ•áĞµ•¹Ñ•ÈÑ•áĞµÍ´Ñ•áĞµÉ…ä´ĞÀÀˆø(€€€€€€€€€€€€€€€í±•…åM…±•I½İÌ¹±•¹Ñ øÀüŸªÎƒªÂw®Îƒ²nC®Îã²vĞƒ²^®*Pƒ²vÓ²‚ƒ¶2C®“ªÆÓ²v ƒ²V®zc²^C²pƒ²"c²‚W¶V€ƒ²"`ƒ²z#²ZÓ²jP¸œèğû²V²ƒªÎƒªÂw®Îƒ¶2C®ƒªâÃ®†w²vĞƒ²^²ZÓ²jP¸ñ‰È€¼û²V®z`ƒ¶2C®ƒ²æÓ¶3ªÎƒ®š³²^C²pƒ®NÇ®†w¶VĞƒ²ó²ã²jP¸ğ¼ùô(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€¤€è€ (€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‘¥Ù¥‘”µä‘¥Ù¥‘”µÉ…ä´ÔÀˆø(€€€€€€€€€€€€€€€ì¡‘…ä¹¡½ÕÍ•¡½±‘I•¹•İ…±Íññmt¤¹µ…À ¡¥Ñ•´±¥‘à¤ôùì(€€€€€€€€€€€€€€€€€½¹ÍĞŒõ…±Õ±…Ñ•!½ÕÍ•¡½±‘I•¹•Ü¡¥Ñ•´±½¹™¥œ¤ì(€€€€€€€€€€€€€€€€€½¹ÍĞÁ±…¹1…‰•°õ!=UM!=1}I9]}A19L¹™¥¹¡àôùà¹­•äôôõ¥Ñ•´¹Á±…¸¤ü¹±…‰•±ññ¥Ñ•´¹Á±…¹ñğœœì(€€€€€€€€€€€€€€€€€½¹ÍĞÍÁ••‘1…‰•°õ¥Ñ•´¹ÍÁ••ôôôœÅœœüœÅœé¥Ñ•´¹ÍÁ••ôôôœÔÀÀœüœÔÀÁ5œèœÄÀÁ5œì(€€€€€€€€€€€€€€€€€½¹ÍĞÑÙ%¹±Õ‘•ô…¥Ñ•´¹¡½µ•=¹±äì(€€€€€€€€€€€€€€€€€É•ÑÕÉ¸€ñ‘¥Ø­•äõíÉ•¹•Üµ±¥ÍĞ´‘í¥Ñ•´¹¥‘ññ¥‘áõô±…ÍÍ9…µ”ô‰Áà´ĞÁä´Ìˆø(€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµÍÑ…ÉĞ©ÕÍÑ¥™äµ‰•Ñİ••¸…À´Ìˆø(€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µ¥¸µÜ´Àˆø(€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´™½¹Ğµ‰½±Ñ•áĞµÉ…ä´äÀÀˆùí¥Ñ•´¹ÕÍÑ½µ•ÉñğŸ²vÓ®šƒ²^²v0ôğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ…ä´ØÀÀµĞ´À¸Ôˆû²vã¶Ã®Üƒ²z³²V÷²‚Tƒ
ÜíÍÁ••‘1…‰•±ôƒ
ÜíÁ±…¹1…‰•±ôğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÅÁátÑ•áĞµÉ…ä´ĞÀÀµĞ´Äˆø(€€€€€€€€€€€€€€€€€€€€€€€€€íÑÙ%¹±Õ‘•üŸ²vã¶Ã®Ü­QXƒ²z³²V÷²‚TœèŸ²vã¶Ã®Üƒ²z³²V÷²‚Tôƒ
Üƒ²w²
Ã²Ä-A$íÑÙ%¹±Õ‘•üœÀ¸Ù@œèœÀ¸Í@ôƒ
Üíİ½¸¡Œ¹…µ½Õ¹Ğ¥ô(€€€€€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à…À´ÄÍ¡É¥¹¬´Àˆø(€€€€€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôù½Á•¹!½ÕÍ•¡½±‘I•¹•Ü¡¥‘à¥ô±…ÍÍ9…µ”ô‰Áà´ÈÁä´Ä¸ÔÉ½Õ¹‘•µ±œ‰œµÉ…ä´ÔÀÑ•áĞµÉ…ä´ØÀÀÑ•áĞµlÄÅÁát™½¹ĞµÍ•µ¥‰½±ˆû¶2C®“ªÆĞƒ²"c²‚Tğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôù‘•±•Ñ•!½ÕÍ•¡½±‘I•¹•Ü¡¥‘à¥ô±…ÍÍ9…µ”ô‰Áà´ÈÁä´Ä¸ÔÉ½Õ¹‘•µ±œ‰œµÉ•´ÔÀÑ•áĞµÉ•´ÔÀÀÑ•áĞµlÄÅÁát™½¹ĞµÍ•µ¥‰½±ˆû²
·²‚pğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€ğ½‘¥Øøì(€€€€€€€€€€€€€€€ô¥ô(€€€€€€€€€€€€€€€íÉ½ÕÁ•‘½É•M…±•Ì¹µ…À ¡É½ÕÀ¤€ôøì(€€€€€€€€€€€€€€€€€½¹ÍĞÍ…±”õÉ½ÕÀ¹ÁÉ¥µ…Éäì(€€€€€€€€€€€€€€€€€½¹ÍĞµ•Ñ„õÍ…±”¹Í½ÕÉ•}µ•Ñ…ññíôì(€€€€€€€€€€€€€€€€€½¹ÍĞÕÍÑ½µ•É9…µ”õÍ…±”¹ÕÍÑ½µ•ÉÌü¹ÕÍÑ½µ•É}¹…µ•ñğŸªÎƒªÂtœì((€€€€€€€€€€€€€€€€€¥˜¡É½ÕÀ¹­¥¹ôôô¡½µ”œ¥ì(€€€€€€€€€€€€€€€€€€€½¹ÍĞ¡½µ•M…±•ÌõÉ½ÕÀ¹Í…±•Ìì(€€€€€€€€€€€€€€€€€€€½¹ÍĞ¡½µ•QåÁ•Ìõ¹•ÜM•Ğ¡¡½µ•M…±•Ì¹µ…À¡àôù¥¹™•É!½µ•AÉ½‘ÕÑQåÁ•É½µ1…‰•°¡à¹µ•ÑÉ¥}±…‰•°¤¤¤ì(€€€€€€€€€€€€€€€€€€€½¹ÍĞ±…‰•±Ìõmtì((€€€€€€€€€€€€€€€€€€€€¼¼ƒ¶V×².°ƒ²¶J ¿ªÖ³²Äƒ²"s²s®†pƒ¶Vpƒ²æÓ®Npƒ²V#²^@ƒ²‚W®š°(€€€€€€€€€€€€€€€€€€€½¹ÍĞ¥¹Ñ•É¹•ÑM…±”õ¡½µ•M…±•Ì¹™¥¹¡àôùl¥¹Ñ•É¹•ĞÅœœ°¥¹Ñ•É¹•ĞÔÀÀœ°¥¹Ñ•É¹•ĞÄÀÀt¹¥¹±Õ‘•Ì¡¥¹™•É!½µ•AÉ½‘ÕÑQåÁ•É½µ1…‰•°¡à¹µ•ÑÉ¥}±…‰•°¤¤¤ì(€€€€€€€€€€€€€€€€€€€½¹ÍĞÑÙM…±”õ¡½µ•M…±•Ì¹™¥¹¡àôù¥¹™•É!½µ•AÉ½‘ÕÑQåÁ•É½µ1…‰•°¡à¹µ•ÑÉ¥}±…‰•°¤ôôô¡½µ•QØœ¤ì(€€€€€€€€€€€€€€€€€€€½¹ÍĞÍµ…ÉÑM…±”õ¡½µ•M…±•Ì¹™¥¹¡àôù¥¹™•É!½µ•AÉ½‘ÕÑQåÁ•É½µ1…‰•°¡à¹µ•ÑÉ¥}±…‰•°¤ôôôÍµ…ÉÑ!½µ”œ¤ì(€€€€€€€€€€€€€€€€€€€½¹ÍĞÑÙÉ••M…±”õ¡½µ•M…±•Ì¹™¥¹¡àôù¥¹™•É!½µ•AÉ½‘ÕÑQåÁ•É½µ1…‰•°¡à¹µ•ÑÉ¥}±…‰•°¤ôôôÑÙÉ•”œ¤ì(€€€€€€€€€€€€€€€€€€€½¹ÍĞÍÕ‰M…±”õ¡½µ•M…±•Ì¹™¥¹¡àôù¥¹™•É!½µ•AÉ½‘ÕÑQåÁ•É½µ1…‰•°¡à¹µ•ÑÉ¥}±…‰•°¤ôôôÍÕ‰M•ÑQ½Àœ¤ì(€€€€€€€€€€€€€€€€€€€½¹ÍĞÍ¥µÕ±M…±”õ¡½µ•M…±•Ì¹™¥¹¡àôùlÍ¥µÕ±9•İ¡…¹”œ°Í¥µÕ±5¹Àœ°Í¥µÕ±UÍ•‘5¹Àt¹¥¹±Õ‘•Ì¡¥¹™•É!½µ•AÉ½‘ÕÑQåÁ•É½µ1…‰•°¡à¹µ•ÑÉ¥}±…‰•°¤¤¤ì((€€€€€€€€€€€€€€€€€€€¥˜¡¥¹Ñ•É¹•ÑM…±”¥±…‰•±Ì¹ÁÕÍ ¡¥¹Ñ•É¹•ÑM…±”¹µ•ÑÉ¥}±…‰•°¤ì(€€€€€€€€€€€€€€€€€€€¥˜¡ÑÙM…±”¥±…‰•±Ì¹ÁÕÍ ¡ÑÙM…±”¹µ•ÑÉ¥}±…‰•°¤ì(€€€€€€€€€€€€€€€€€€€¥˜¡Íµ…ÉÑM…±”¥±…‰•±Ì¹ÁÕÍ ¡Íµ…ÉÑM…±”¹µ•ÑÉ¥}±…‰•°¤ì(€€€€€€€€€€€€€€€€€€€¥˜¡ÑÙÉ••M…±”¥±…‰•±Ì¹ÁÕÍ ¡ÑÙÉ••M…±”¹µ•ÑÉ¥}±…‰•°¤ì(€€€€€€€€€€€€€€€€€€€¥˜¡ÍÕ‰M…±”¥±…‰•±Ì¹ÁÕÍ ¡ÍÕ‰M…±”¹µ•ÑÉ¥}±…‰•°¤ì((€€€€€€€€€€€€€€€€€€€¥˜¡Í¥µÕ±M…±”¥ì(€€€€€€€€€€€€€€€€€€€€€½¹ÍĞĞõ¥¹™•É!½µ•AÉ½‘ÕÑQåÁ•É½µ1…‰•°¡Í¥µÕ±M…±”¹µ•ÑÉ¥}±…‰•°¤ì(€€€€€€€€€€€€€€€€€€€€€½¹ÍĞ¡…Í%¹Ñ•É¹•Ñ=ÉQØõl¡½µ•=¹±äœ°¡½µ•QØœ°¥¹Ñ•É¹•ĞÄÀÀœ°¥¹Ñ•É¹•ĞÔÀÀœ°¥¹Ñ•É¹•ĞÅœt¹Í½µ”¡¬ôù¡½µ•QåÁ•Ì¹¡…Ì¡¬¤¤ì(€€€€€€€€€€€€€€€€€€€€€½¹ÍĞ¡…ÍMµ…ÉÑ!½µ”õ¡½µ•QåÁ•Ì¹¡…Ì Íµ…ÉÑ!½µ”œ¤ì(€€€€€€€€€€€€€€€€€€€€€½¹ÍĞ‰…Í•1…‰•°õ¡…Í%¹Ñ•É¹•Ñ=ÉQØüŸ¶f œé¡…ÍMµ…ÉÑ!½µ”üŸ²*“®#¶*ã¶f œèŸ¶f œì(€€€€€€€€€€€€€€€€€€€€€½¹ÍĞÍ¥µÕ±Q•áĞõĞôôôÍ¥µÕ±9•İ¡…¹”œü!Lƒ².ƒªŞp¿ªâÃ®Î ƒ®>g².s¶2C®œéĞôôôÍ¥µÕ±5¹Àœü!L59@ƒ®>g².s¶2C®œèŸ²’GªÎ59@ƒ®>g².s¶2C®œì(€€€€€€€€€€€€€€€€€€€€€±…‰•±Ì¹ÁÕÍ ¡€‘í‰…Í•1…‰•±ô€¬€‘íÍ¥µÕ±Q•áÑõ€¤ì(€€€€€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€€€€€€¼¼ƒ²rƒ®Ú®–c²^@ƒ²V ƒ²z‡¶z0ƒ¶f ƒ²ã®Ú¶V·®ª§®>ƒ®"®vôƒ²^²vĞƒ¶Fs².p(€€€€€€€€€€€€€€€€€€€¡½µ•M…±•Ì¹™½É… ¡àôùì(€€€€€€€€€€€€€€€€€€€€€½¹ÍĞĞõ¥¹™•É!½µ•AÉ½‘ÕÑQåÁ•É½µ1…‰•°¡à¹µ•ÑÉ¥}±…‰•°¤ì(€€€€€€€€€€€€€€€€€€€€€¥˜ …l¥¹Ñ•É¹•ĞÅœœ°¥¹Ñ•É¹•ĞÔÀÀœ°¥¹Ñ•É¹•ĞÄÀÀœ°¡½µ•QØœ°Íµ…ÉÑ!½µ”œ°ÑÙÉ•”œ°ÍÕ‰M•ÑQ½Àœ°Í¥µÕ±9•İ¡…¹”œ°Í¥µÕ±5¹Àœ°Í¥µÕ±UÍ•‘5¹Àt¹¥¹±Õ‘•Ì¡Ğ¤€˜˜€…±…‰•±Ì¹¥¹±Õ‘•Ì¡à¹µ•ÑÉ¥}±…‰•°¤¤±…‰•±Ì¹ÁÕÍ ¡à¹µ•ÑÉ¥}±…‰•°¤ì(€€€€€€€€€€€€€€€€€€€ô¤ì((€€€€€€€€€€€€€€€€€€€½¹ÍĞ¥¹Œõµ•Ñ„¹Ñ•…µ=¹±äıíÑ½Ñ…°èÀ±É½İÌémuôéÍ…±•%¹•¹Ñ¥Ù•	É•…­‘½İ¸¡Í…±”¤ì€¼¼ƒ²²nC¶2C®“®*PƒªÂs²vàƒ²vã²ó¶.Ã®â0ƒ²‚s²fà(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸€ñ‘¥Ø­•äõíÉ½ÕÀ¹­•åô±…ÍÍ9…µ”ô‰Áà´ĞÁä´Ìˆø(€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµÍÑ…ÉĞ©ÕÍÑ¥™äµ‰•Ñİ••¸…À´Ìˆø(€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µ¥¸µÜ´Àˆø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´™½¹Ğµ‰½±Ñ•áĞµÉ…ä´äÀÀˆùíÕÍÑ½µ•É9…µ•ôğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´ÄÍÁ…”µä´À¸Ôˆø(€€€€€€€€€€€€€€€€€€€€€€€€€€€í±…‰•±Ì¹µ…À ¡±…‰•°±¤¤ôøñ‘¥Ø­•äõí¥ô±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ…ä´ØÀÀˆùí±…‰•±ôğ½‘¥Øø¥ô(€€€€€€€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€€í¡½µ•M…±•Ì¹Í½µ”¡±•…åM…±•	…‘”¤˜˜ñÍÁ…¸±…ÍÍ9…µ”ô‰¥¹±¥¹”µ‰±½¬µĞ´ÄÑ•áĞµlåÁátÁà´Ä¸ÔÁä´À¸ÔÉ½Õ¹‘•µ™Õ±°‰œµ…µ‰•È´ÔÀÑ•áĞµ…µ‰•È´ØÀÀ‰½É‘•È‰½É‘•Èµ…µ‰•È´ÄÀÀˆûªÖ³®Ê²‚ƒ®6Ã²vÓ¶Àƒ
Üƒ²"c²‚TƒªÂ®*”ğ½ÍÁ…¸ùô(€€€€€€€€€€€€€€€€€€€€€€€€€íµ•Ñ„¹Ñ•…µ=¹±ä˜˜ñÍÁ…¸±…ÍÍ9…µ”ô‰¥¹±¥¹”µ‰±½¬µĞ´ÄÑ•áĞµlåÁátÁà´Ä¸ÔÁä´À¸ÔÉ½Õ¹‘•µ™Õ±°‰œµÙ¥½±•Ğ´ÔÀÑ•áĞµÙ¥½±•Ğ´ÜÀÀ‰½É‘•È‰½É‘•ÈµÙ¥½±•Ğ´ÄÀÀˆû²²n@ƒ¶2C®ƒ
Üí‘¥ÍÁ±…åMÑ½É•9…µ”¡µ•Ñ„¹É•‘¥Ñ•‘MÑ½É”¥ôƒ¶2 ƒ².“²‚ğ½ÍÁ…¸ùô(€€€€€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Í¡É¥¹¬´ÀÑ•áĞµÉ¥¡Ğˆø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É•±…Ñ¥Ù”µˆ´Èˆø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùÍ•ÑM…±•%¹•¹Ñ¥Ù•=Á•¸¡ØôùØôôõÉ½ÕÀ¹­•äı¹Õ±°éÉ½ÕÀ¹­•ä¥ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õíÑ•áĞµlÄÉÁát™½¹Ğµ‰½±€‘í¥¹Œ¹Ñ½Ñ…°øÀüÑ•áĞµÙ¥½±•Ğ´ÜÀÀœèÑ•áĞµÉ…ä´ĞÀÀõôø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€í¥¹Œ¹Ñ½Ñ…°øÀı€¬‘íİ½¸¡¥¹Œ¹Ñ½Ñ…°¥õ€èœÃ²n@ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlåÁátÑ•áĞµÉ…ä´ĞÀÀˆû²b#²ƒ²vã²ó¶.Ã®â0ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€€€€íÍ…±•%¹•¹Ñ¥Ù•=Á•¸ôôõÉ½ÕÀ¹­•ä˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰…‰Í½±ÕÑ”É¥¡Ğ´ÀÑ½À´ÄÀè´ÌÀÜ´ÔØ‰œµİ¡¥Ñ”‰½É‘•ÈÉ½Õ¹‘•µá°Í¡…‘½Üµ±œÀ´ÌÑ•áĞµ±•™Ğˆø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁát™½¹Ğµ‰½±Ñ•áĞµÉ…ä´ÜÀÀµˆ´Äˆû²vĞƒ¶2C®“ªÆĞƒ²b#²ƒ²vã²ó¶.Ã®â0ğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlåÁátÑ•áĞµÉ…ä´ĞÀÀµˆ´Èˆû²“²æc²b#²‚Tƒ¶f#²v ƒ¶b²z°ƒ²nPƒ²z®‚”ƒªâÃ²’²ró®†pƒ®¾ã®š°ƒªÎ²
Ã¶Vc®¦À°ƒ².“²‚pƒ²ªâ'²v ƒ²“²æc²f®0ƒ¶nƒ®Âc²b®>ó²jP¸ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€í¥¹Œ¹É½İÌ¹±•¹Ñ ı¥¹Œ¹É½İÌ¹µ…À ¡m°±Ùt±¤¤ôøñ‘¥Ø­•äõí¥ô±…ÍÍ9…µ”ô‰™±•à©ÕÍÑ¥™äµ‰•Ñİ••¸…À´ÈÑ•áĞµlÄÁÁátÁä´ÄˆøñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµÉ…ä´ÔÀÀˆùí±ôğ½ÍÁ…¸øñˆ±…ÍÍ9…µ”õíØğÀüÑ•áĞµÉ•´ÔÀÀœèÑ•áĞµÙ¥½±•Ğ´ÜÀÀôùíØøÀüœ¬œèœõíİ½¸¡Ø¥ôğ½ˆøğ½‘¥Øø¤èñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀˆû²²‚Dƒ®Âs²tƒ²"c²"c®3ªÂ ƒ²^²ZÓ²jP¸ğ½‘¥Øùô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øùô(€€€€€€€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à…À´Äˆø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤ôù½Á•¹‘¥ÑM…±”¡Í…±”¥ô±…ÍÍ9…µ”ô‰Áà´ÈÁä´Ä¸ÔÉ½Õ¹‘•µ±œ‰œµÉ…ä´ÔÀÑ•áĞµÉ…ä´ØÀÀÑ•áĞµlÄÅÁát™½¹ĞµÍ•µ¥‰½±ˆû¶2C®“ªÆĞƒ²"c²‚Tğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤ôù‘•±•Ñ•M…±”¡Í…±”¥ô±…ÍÍ9…µ”ô‰Áà´ÈÁä´Ä¸ÔÉ½Õ¹‘•µ±œ‰œµÉ•´ÔÀÑ•áĞµÉ•´ÔÀÀÑ•áĞµlÄÅÁát™½¹ĞµÍ•µ¥‰½±ˆû²
·²‚pğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øøì(€€€€€€€€€€€€€€€€€ô((€€€€€€€€€€€€€€€€€½¹ÍĞÙ…Í1…‰•±Ìô¡µ•Ñ„¹Ù…Í-•åÍññmt¤¹µ…À¡¬ôùì(€€€€€€€€€€€€€€€€€€€¥˜¡¬ôôôÙ…Í9½¹”œ¥É•ÑÕÉ¸€Ÿ®¾ã²rƒ²æ`œì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸€¡½¹™¥œ¹Ù…ÍññU1Q}YL¤¹™¥¹¡ØôùØ¹­•äôôõ¬¤ü¹±…‰•±ññ¬ì(€€€€€€€€€€€€€€€€€ô¤ì(€€€€€€€€€€€€€€€€€½¹ÍĞ¥¹Œõµ•Ñ„¹Ñ•…µ=¹±äıíÑ½Ñ…°èÀ±É½İÌémuôéÍ…±•%¹•¹Ñ¥Ù•	É•…­‘½İ¸¡Í…±”¤ì(€€€€€€€€€€€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø­•äõíÉ½ÕÀ¹­•åô±…ÍÍ9…µ”ô‰Áà´ĞÁä´Ìˆø(€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµÍÑ…ÉĞ©ÕÍÑ¥™äµ‰•Ñİ••¸…À´Ìˆø(€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µ¥¸µÜ´Àˆø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´™½¹Ğµ‰½±Ñ•áĞµÉ…ä´äÀÀˆùíÕÍÑ½µ•É9…µ•ôğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ…ä´ØÀÀµĞ´À¸Ô™±•à¥Ñ•µÌµ•¹Ñ•È…À´Ä¸Ô™±•àµİÉ…Àˆø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùíÍ…±”¹µ•ÑÉ¥}±…‰•±ôğ½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€í±•…åM…±•	…‘”¡Í…±”¤˜˜ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµlåÁátÁà´Ä¸ÔÁä´À¸ÔÉ½Õ¹‘•µ™Õ±°‰œµ…µ‰•È´ÔÀÑ•áĞµ…µ‰•È´ØÀÀ‰½É‘•È‰½É‘•Èµ…µ‰•È´ÄÀÀˆûªÖ³®Ê²‚ƒ®6Ã²vÓ¶Àƒ
Üƒ²"c²‚TƒªÂ®*”ğ½ÍÁ…¸ùô(€€€€€€€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€€íÙ…Í1…‰•±Ì¹±•¹Ñ øÀ˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÅÁátÑ•áĞµÉ…ä´ĞÀÀµĞ´ÄˆùYLƒ
ÜíÙ…Í1…‰•±Ì¹©½¥¸ œƒ
Ü€œ¥ôğ½‘¥Øùô(€€€€€€€€€€€€€€€€€€€€€€€€€í=‰©•Ğ¹•¹ÑÉ¥•Ì¡µ•Ñ„¹‰Õ¹‘±•M…±•QåÁ•5…Áññíô¤¹Í½µ” ¡l±Ùt¤ôùØôôô™É•”œ¤˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµ…µ‰•È´ØÀÀµĞ´ÄˆøÉ9ƒ®²Ó®3¶2C®ƒ
Üƒ²vã²ó¶.Ã®â0ƒ²‚s²fàğ½‘¥Øùô(€€€€€€€€€€€€€€€€€€€€€€€€€íµ•Ñ„¹Ñ•…µ=¹±ä˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁát™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÙ¥½±•Ğ´ØÀÀµĞ´Äˆû²²n@ƒ¶2C®ƒ
Üí‘¥ÍÁ±…åMÑ½É•9…µ”¡µ•Ñ„¹É•‘¥Ñ•‘MÑ½É”¥ôƒ¶2 ƒ².“²‚ƒ²‚²j¤ğ½‘¥Øùô(€€€€€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Í¡É¥¹¬´ÀÑ•áĞµÉ¥¡Ğˆø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É•±…Ñ¥Ù”µˆ´Èˆø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùÍ•ÑM…±•%¹•¹Ñ¥Ù•=Á•¸¡ØôùØôôõÉ½ÕÀ¹­•äı¹Õ±°éÉ½ÕÀ¹­•ä¥ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õíÑ•áĞµlÄÉÁát™½¹Ğµ‰½±€‘í¥¹Œ¹Ñ½Ñ…°øÀüÑ•áĞµÙ¥½±•Ğ´ÜÀÀœèÑ•áĞµÉ…ä´ĞÀÀõôø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€í¥¹Œ¹Ñ½Ñ…°øÀı€¬‘íİ½¸¡¥¹Œ¹Ñ½Ñ…°¥õ€èœÃ²n@ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlåÁátÑ•áĞµÉ…ä´ĞÀÀˆû²vã²ó¶.Ã®â0ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€€€€íÍ…±•%¹•¹Ñ¥Ù•=Á•¸ôôõÉ½ÕÀ¹­•ä˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰…‰Í½±ÕÑ”É¥¡Ğ´ÀÑ½À´ÄÀè´ÌÀÜ´ÔØ‰œµİ¡¥Ñ”‰½É‘•ÈÉ½Õ¹‘•µá°Í¡…‘½Üµ±œÀ´ÌÑ•áĞµ±•™Ğˆø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁát™½¹Ğµ‰½±Ñ•áĞµÉ…ä´ÜÀÀµˆ´Èˆû²vĞƒ¶2C®“ªÆĞƒ²vã²ó¶.Ã®â0ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€í¥¹Œ¹É½İÌ¹±•¹Ñ ı¥¹Œ¹É½İÌ¹µ…À ¡m°±Ùt±¤¤ôøñ‘¥Ø­•äõí¥ô±…ÍÍ9…µ”ô‰™±•à©ÕÍÑ¥™äµ‰•Ñİ••¸…À´ÈÑ•áĞµlÄÁÁátÁä´ÄˆøñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµÉ…ä´ÔÀÀˆùí±ôğ½ÍÁ…¸øñˆ±…ÍÍ9…µ”õíØğÀüÑ•áĞµÉ•´ÔÀÀœèÑ•áĞµÙ¥½±•Ğ´ÜÀÀôùíØøÀüœ¬œèœõíİ½¸¡Ø¥ôğ½ˆøğ½‘¥Øø¤èñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀˆû²²‚Dƒ®Âs²tƒ²"c²"c®3ªÂ ƒ²^²ZÓ²jP¸ğ½‘¥Øùô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øùô(€€€€€€€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à…À´Äˆø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤ôù½Á•¹‘¥ÑM…±”¡Í…±”¥ô±…ÍÍ9…µ”ô‰Áà´ÈÁä´Ä¸ÔÉ½Õ¹‘•µ±œ‰œµÉ…ä´ÔÀÑ•áĞµÉ…ä´ØÀÀÑ•áĞµlÄÅÁát™½¹ĞµÍ•µ¥‰½±ˆû¶2C®“ªÆĞƒ²"c²‚Tğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤ôù‘•±•Ñ•M…±”¡Í…±”¥ô±…ÍÍ9…µ”ô‰Áà´ÈÁä´Ä¸ÔÉ½Õ¹‘•µ±œ‰œµÉ•´ÔÀÑ•áĞµÉ•´ÔÀÀÑ•áĞµlÄÅÁát™½¹ĞµÍ•µ¥‰½±ˆû²
·²‚pğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô¥ô(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€¥ô(€€€€€€€€€€ğ½‘¥Øø((€€€€€€€€€í±•…åM…±•I½İÌ¹±•¹Ñ øÀ˜˜ (€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµ…µ‰•È´ÔÀ¼ÜÀ‰½É‘•È‰½É‘•Èµ…µ‰•È´ÄÀÀÉ½Õ¹‘•µá°½Ù•É™±½Üµ¡¥‘‘•¸ˆø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Áà´ĞÁä´Ì‰½É‘•Èµˆ‰½É‘•Èµ…µ‰•È´ÄÀÀ¼ÜÀˆø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁát™½¹ĞµÍ•µ¥‰½±Ñ•áĞµ…µ‰•È´ÜÀÀˆû²vÓ²‚ƒ®Â§².tƒ²z®‚”ƒ².“²‚ƒ
Üí™µÑ½Õ¹Ğ¡±•…åM…±•I½İÌ¹±•¹Ñ ¥÷ªÆĞğ½‘¥Øø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ÔÀÀµĞ´À¸ÔˆûªÎƒªÂw®ª²vĞƒ²‚²z—®Bc² ƒ²V+²Vc®6`ƒ¶2C®“ªÆÓ²z®.#®.¸ƒªÂƒªÆÓ²vƒ®"3®~°ƒ¶b²z°ƒ²z®‚”ƒ¶fS®¦Ó²ró®†pƒ®Î×²nC¶V€ƒ²"`ƒ²z#²ZÓ²jP¸ğ½‘¥Øø(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‘¥Ù¥‘”µä‘¥Ù¥‘”µ…µ‰•È´ÄÀÀ¼ÜÀˆø(€€€€€€€€€€€€€€€í±•…åM…±•I½İÌ¹µ…À¡É½Üôøñ‘¥Ø­•äõíÉ½Ü¹¥‘ô±…ÍÍ9…µ”ô‰Áà´ĞÁä´Ì™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•Ñİ••¸…À´Ì‰œµİ¡¥Ñ”¼ÔÀˆø(€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µ¥¸µÜ´Àˆø(€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌ™½¹Ğµ‰½±Ñ•áĞµÉ…ä´àÀÀˆû²vÓ®šƒ²^²v0ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÅÁátÑ•áĞµÉ…ä´ØÀÀµĞ´À¸ÔÑÉÕ¹…Ñ”ˆùíÉ½Ü¹Ñ¥Ñ±•õíÉ½Ü¹‘•Ñ…¥°ı€ƒ
Ü€‘íÉ½Ü¹‘•Ñ…¥±õ€èœôğ½‘¥Øø(€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôù½Á•¹1•…åM…±•I½Ü¡É½Ü¥ô(€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰Í¡É¥¹¬´ÀÁà´ÌÁä´Ä¸ÔÉ½Õ¹‘•µ±œ‰œµİ¡¥Ñ”‰½É‘•È‰½É‘•Èµ…µ‰•È´ÈÀÀÑ•áĞµlÄÅÁát™½¹Ğµ‰½±Ñ•áĞµ…µ‰•È´ÜÀÀˆø(€€€€€€€€€€€€€€€€€€€ƒ²"c²‚T(€€€€€€€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€ğ½‘¥Øø¥ô(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€¥ô((€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµİ¡¥Ñ”É½Õ¹‘•µá°‰½É‘•È‰½É‘•ÈµÉ…ä´ÄÀÀÀ´Ìˆø(€€€€€€€€€€€íÑ•…µMÕÁÁ½ÉÑ±¥¥‰±”˜™ÕÉÉ•¹ÑµÀü¹¥ôôõ…ÕÑ¡UÍ•Èü¹¥˜˜ñ‘¥Ø±…ÍÍ9…µ”õíµˆ´ÌÉ½Õ¹‘•µá°‰½É‘•ÈÀ´Ì€‘íÑ•…µMÕÁÁ½ÉÑ5½‘”ü‰½É‘•ÈµÙ¥½±•Ğ´ÈÀÀ‰œµÙ¥½±•Ğ´ÔÀœè‰½É‘•ÈµÉ…ä´ÄÀÀ‰œµÉ…ä´ÔÀõôø(€€€€€€€€€€€€€€ñ±…‰•°±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•Ñİ••¸…À´Ìˆøñ‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌ™½¹Ğµ‰½±Ñ•áĞµÉ…ä´àÀÀˆû²²n@ƒ¶2C®ƒ
Üƒ¶2 ƒ².“²‚®0ƒ®Âc²bğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ÔÀÀµĞ´À¸Ôˆû®
ĞƒªÂs²vàƒ².“²‚
ßªâ'²^³²^C²s®*Pƒ²‚s²fã®Bc®¦À°ƒ¶2C®“®–ğƒ²‚²z—¶Vc®¦Ğƒ²ƒ¶w²vĞƒ²Ò#ªâÃ¶fS®>ó²jP¸ğ½‘¥Øøğ½‘¥Øøñ¥¹ÁÕĞÑåÁ”ô‰¡•­‰½àˆ¡•­•õíÑ•…µMÕÁÁ½ÉÑ5½‘•ô½¹¡…¹”õí•Ù•¹ĞôùíÍ•ÑQ•…µMÕÁÁ½ÉÑ5½‘”¡•Ù•¹Ğ¹Ñ…É•Ğ¹¡•­•¤íÍ•ÑQ•…µMÕÁÁ½ÉÑMÑ½É” œœ¥õô±…ÍÍ9…µ”ô‰Ü´Ğ ´Ğˆ¼øğ½±…‰•°ø(€€€€€€€€€€€€€íÑ•…µMÕÁÁ½ÉÑ5½‘”˜˜ñÍ•±•ĞÙ…±Õ”õíÑ•…µMÕÁÁ½ÉÑMÑ½É•ô½¹¡…¹”õí•Ù•¹ĞôùÍ•ÑQ•…µMÕÁÁ½ÉÑMÑ½É”¡•Ù•¹Ğ¹Ñ…É•Ğ¹Ù…±Õ”¥ô±…ÍÍ9…µ”ô‰µĞ´ÌÜµ™Õ±°É½Õ¹‘•µá°‰½É‘•È‰½É‘•ÈµÙ¥½±•Ğ´ÈÀÀ‰œµİ¡¥Ñ”Áà´ÌÁä´È¸ÔÑ•áĞµÍ´™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÙ¥½±•Ğ´ÜÀÀˆøñ½ÁÑ¥½¸Ù…±Õ”ôˆˆû².“²‚²vƒ®Âc²b¶V€ƒ®“²z”ƒ²ƒ¶tğ½½ÁÑ¥½¸ùíÍ…±•ÍMÑ½É•Ì¹µ…À¡ÍÑ½É”ôøñ½ÁÑ¥½¸­•äõíÍÑ½É•ôÙ…±Õ”õíÍÑ½É•ôùí‘¥ÍÁ±…åMÑ½É•9…µ”¡ÍÑ½É”¥ôğ½½ÁÑ¥½¸ø¥ôğ½Í•±•Ğùô(€€€€€€€€€€€€ğ½‘¥Øùô(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÅÁátÑ•áĞµÉ…ä´ĞÀÀµˆ´Èˆû¶2C®ƒ²æÓ¶3ªÎƒ®š°ğ½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É¥É¥µ½±Ì´È…À´Èˆø(€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùíÍ•Ñ%¹ÁÕÑ…Ñ•½Éä µ½‰¥±”œ¤íÍ•ÑA¥­•‘I½Ü¡¹Õ±°¤í…‘‘=¹” ¤íõô(€€€€€€€€€€€€€€€±…ÍÍ9…µ”õíÀ´ĞÉ½Õ¹‘•´Éá°‰½É‘•ÈÑ•áĞµ±•™Ğ€‘í¥¹ÁÕÑ…Ñ•½Éäôôôµ½‰¥±”œü‰œµÙ¥½±•Ğ´ÔÀ‰½É‘•ÈµÙ¥½±•Ğ´ÌÀÀœè‰œµİ¡¥Ñ”‰½É‘•ÈµÉ…ä´ÈÀÀõôø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµá°ˆûÂ~NÄğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´™½¹Ğµ‰½±Ñ•áĞµÉ…ä´àÀÀµĞ´Äˆû®ª£®ÂS²vğƒ².“²‚ƒ²z®‚”ğ½‘¥Øø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀµĞ´ÄˆûªÎƒªÂw®ªƒ
ÜƒªÂ²zªÖ³®Úƒ
Üƒ²jSªâ#²‚pƒ
ÜYLƒ
Üƒ²*“¶2|ƒ
Üƒ²b“¶6ğğ½‘¥Øø(€€€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùíÍ•Ñ%¹ÁÕÑ…Ñ•½Éä ¡½µ”œ¤íÍ•ÑA¥­•‘I½Ü¡¹Õ±°¤í½Á•¹!½µ•=É‘•È ¤íõô(€€€€€€€€€€€€€€€±…ÍÍ9…µ”õíÀ´ĞÉ½Õ¹‘•´Éá°‰½É‘•ÈÑ•áĞµ±•™Ğ€‘í¥¹ÁÕÑ…Ñ•½Éäôôô¡½µ”œü‰œµÙ¥½±•Ğ´ÔÀ‰½É‘•ÈµÙ¥½±•Ğ´ÌÀÀœè‰œµİ¡¥Ñ”‰½É‘•ÈµÉ…ä´ÈÀÀõôø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµá°ˆûÂ~>€ğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´™½¹Ğµ‰½±Ñ•áĞµÉ…ä´àÀÀµĞ´Äˆû¶f ƒ².“²‚ƒ²z®‚”ğ½‘¥Øø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀµĞ´ÄˆûªÎƒªÂw®ªƒ
ÜƒªÂ²‚T¿²3¶bàƒ
Üƒ²¶J ƒ
Üƒ²*“¶2|ƒ
Üƒ²b“¶6ğğ½‘¥Øø(€€€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ‘¥Í…‰±•õí…Ñ¥Ù•Q•…µMÕÁÁ½ÉÑô½¹±¥¬õì ¤ôù½Á•¹!½ÕÍ•¡½±‘I•¹•Ü¡¹Õ±°¥ô±…ÍÍ9…µ”õíÀ´ĞÉ½Õ¹‘•´Éá°‰½É‘•ÈÑ•áĞµ±•™Ğ‰œµİ¡¥Ñ”‰½É‘•ÈµÉ…ä´ÈÀÀ€‘í…Ñ¥Ù•Q•…µMÕÁÁ½ÉĞü½Á…¥Ñä´ĞÀœèœõôø(€€€€€€€€€€€€€€€€ñ‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµá°ˆûŠfï¾â<ğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´™½¹Ğµ‰½±Ñ•áĞµÉ…ä´àÀÀµĞ´Äˆû²vã¶Ã®Üƒ²z³²V÷²‚Tğ½‘¥Øøğ½‘¥Øø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀµĞ´Äˆùí…Ñ¥Ù•Q•…µMÕÁÁ½ÉĞüŸ²²n@ƒ¶2C®ƒ®2²ƒ²V®.`œèŸ²†ÃªÆĞƒ²ƒ¶tƒ².pƒ²vã²ó¶.Ã®â0ƒ²zC®>dƒªÎ²
Àôğ½‘¥Øø(€€€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ‘¥Í…‰±•õí…Ñ¥Ù•Q•…µMÕÁÁ½ÉÑô½¹±¥¬õì ¤ôùÍ•ÑáÑÉ…%¹ÁÕĞ Í½¹¼œ¥ô±…ÍÍ9…µ”õíÀ´ĞÉ½Õ¹‘•´Éá°‰½É‘•ÈÑ•áĞµ±•™Ğ‰œµİ¡¥Ñ”‰½É‘•ÈµÉ…ä´ÈÀÀ€‘í…Ñ¥Ù•Q•…µMÕÁÁ½ÉĞü½Á…¥Ñä´ĞÀœèœõôøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµá°ˆûÂ~:¬ğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´™½¹Ğµ‰½±Ñ•áĞµÉ…ä´àÀÀµĞ´Äˆû²3®àğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀµĞ´Äˆùí…Ñ¥Ù•Q•…µMÕÁÁ½ÉĞüŸ²²n@ƒ¶2C®ƒ®2²ƒ²V®.`œèŸ²¶J ƒ
ÜƒªÆÓ²"`ƒ
ÜƒªÎƒªÂt£²ƒ¶t¤ôğ½‘¥Øøğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ‘¥Í…‰±•õí…Ñ¥Ù•Q•…µMÕÁÁ½ÉÑô½¹±¥¬õì ¤ôùÍ•ÑáÑÉ…%¹ÁÕĞ Ñ…¥±½É•œ¥ô±…ÍÍ9…µ”õíÀ´ĞÉ½Õ¹‘•´Éá°‰½É‘•ÈÑ•áĞµ±•™Ğ‰œµİ¡¥Ñ”‰½É‘•ÈµÉ…ä´ÈÀÀ€‘í…Ñ¥Ù•Q•…µMÕÁÁ½ÉĞü½Á…¥Ñä´ĞÀœèœõôøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµá°ˆûÂ~J„ğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´™½¹Ğµ‰½±Ñ•áĞµÉ…ä´àÀÀµĞ´Äˆû®{²Ú“²‚s²V ğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀµĞ´Äˆùí…Ñ¥Ù•Q•…µMÕÁÁ½ÉĞüŸ²²n@ƒ¶2C®ƒ®2²ƒ²V®.`œèŸ²^² ƒªÆÓ²"`ƒ
Üƒªâ#²V„ôğ½‘¥Øøğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùÍ•ÑMÑ…¹‘…±½¹•AÉ½µ¥Í•=Á•¸¡ÑÉÕ”¥ô±…ÍÍ9…µ”ô‰À´ĞÉ½Õ¹‘•´Éá°‰½É‘•ÈÑ•áĞµ±•™Ğ‰œµÙ¥½±•Ğ´ÔÀ‰½É‘•ÈµÙ¥½±•Ğ´ÈÀÀˆøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµá°ˆûÂ~N0ğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´™½¹Ğµ‰½±Ñ•áĞµÙ¥½±•Ğ´àÀÀµĞ´ÄˆûªÎƒªÂtƒ²V÷²4ƒ®NÇ®†tğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÙ¥½±•Ğ´ÔÀÀµĞ´ÄˆûªâÃ²†Ó
ß².ƒªŞpƒªÎƒªÂtƒ²V÷²4ğ½‘¥Øøğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùÍ•ÑáÑÉ…%¹ÁÕĞ ÕÍÑ½µ•ÉI•œœ¥ô±…ÍÍ9…µ”ô‰À´ĞÉ½Õ¹‘•´Éá°‰½É‘•ÈÑ•áĞµ±•™Ğ‰œµİ¡¥Ñ”‰½É‘•ÈµÉ…ä´ÈÀÀ½°µÍÁ…¸´Èˆøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµá°ˆûÂ~Fğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´™½¹Ğµ‰½±Ñ•áĞµÉ…ä´àÀÀµĞ´ÄˆûªÎƒªÂw®NÇ®†tğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀµĞ´Äˆû¶®“ªÎ€ƒ®NÇ®†tƒªÆÓ²"`ƒ®æƒ®–àƒ²z®‚”ğ½‘¥Øøğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€ğ½‘¥Øø(((€€€€€€€€€€ğ½‘¥Øø((€€€€€€ğ¼ø((€€€€€€ğ¼ø(€€€€€€¥ô((€€€€€í•áÑÉ…%¹ÁÕĞ˜˜ ñ‘¥Ø±…ÍÍ9…µ”ô‰™¥á•¥¹Í•Ğ´Àè´ÔÀ‰œµ‰±…¬¼ĞÀ™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ•¹Ñ•ÈÀ´Ğˆøñ‘¥Ø±…ÍÍ9…µ”ô‰Üµ™Õ±°µ…àµÜµÍ´‰œµİ¡¥Ñ”É½Õ¹‘•´Íá°À´ÔÍ¡…‘½Ü´Éá°ˆøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµ±œ™½¹Ğµ‰½±ˆùí•áÑÉ…%¹ÁÕĞôôôÍ½¹¼œüŸ²3®àƒ²z®‚”œé•áÑÉ…%¹ÁÕĞôôôÑ…¥±½É•œüŸ®{²Ú“²‚s²V ƒ²z®‚”œèŸªÎƒªÂw®NÇ®†tƒ²z®‚”ôğ½‘¥Øøñ¥¹ÁÕĞÙ…±Õ”õí•áÑÉ…ÕÍÑ½µ•Éô½¹¡…¹”õí”ôùÍ•ÑáÑÉ…ÕÍÑ½µ•È¡”¹Ñ…É•Ğ¹Ù…±Õ”¥ôÁ±…•¡½±‘•Èô‹ªÎƒªÂw®ª€£²ƒ¶t¤ˆ±…ÍÍ9…µ”ô‰µĞ´ĞÜµ™Õ±°‰½É‘•ÈÉ½Õ¹‘•µá°Áà´ÌÁä´ÌÑ•áĞµÍ´ˆ¼ùí•áÑÉ…%¹ÁÕĞôôôÍ½¹¼œ˜˜ñÍ•±•ĞÙ…±Õ”õí•áÑÉ…M½¹½-•åô½¹¡…¹”õí”ôùÍ•ÑáÑÉ…M½¹½-•ä¡”¹Ñ…É•Ğ¹Ù…±Õ”¥ô±…ÍÍ9…µ”ô‰µĞ´ÈÜµ™Õ±°‰½É‘•ÈÉ½Õ¹‘•µá°Áà´ÌÁä´ÌÑ•áĞµÍ´ˆùì¡½¹™¥œ¹Í½¹½ññU1Q}M=9<¤¹µ…À¡àôøñ½ÁÑ¥½¸­•äõíà¹­•åôÙ…±Õ”õíà¹­•åôùíà¹±…‰•±ôğ½½ÁÑ¥½¸ø¥ôğ½Í•±•Ğùôñ¥¹ÁÕĞ¥¹ÁÕÑ5½‘”ô‰¹Õµ•É¥ŒˆÙ…±Õ”õí™µÑ%¹ÁÕÑ9Õµ‰•È¡•áÑÉ…½Õ¹Ğ¥ô½¹¡…¹”õí”ôùÍ•ÑáÑÉ…½Õ¹Ğ¡”¹Ñ…É•Ğ¹Ù…±Õ”¹É•Á±…” ½q½œ°œœ¤¥ôÁ±…•¡½±‘•Èô‹ªÆÓ²"`ˆ±…ÍÍ9…µ”ô‰µĞ´ÈÜµ™Õ±°‰½É‘•ÈÉ½Õ¹‘•µá°Áà´ÌÁä´ÌÑ•áĞµÍ´ˆ¼ùí•áÑÉ…%¹ÁÕĞôôôÑ…¥±½É•œ˜˜ñ¥¹ÁÕĞ¥¹ÁÕÑ5½‘”ô‰¹Õµ•É¥ŒˆÙ…±Õ”õí™µÑ%¹ÁÕÑ9Õµ‰•È¡•áÑÉ…µ½Õ¹Ğ¥ô½¹¡…¹”õí”ôùÍ•ÑáÑÉ…µ½Õ¹Ğ¡”¹Ñ…É•Ğ¹Ù…±Õ”¹É•Á±…” ½q½œ°œœ¤¥ôÁ±…•¡½±‘•Èô‹²^² ƒªâ#²V„ˆ±…ÍÍ9…µ”ô‰µĞ´ÈÜµ™Õ±°‰½É‘•ÈÉ½Õ¹‘•µá°Áà´ÌÁä´ÌÑ•áĞµÍ´ˆ¼ùôñ‘¥Ø±…ÍÍ9…µ”ô‰É¥É¥µ½±Ì´È…À´ÈµĞ´Ğˆøñ‰ÕÑÑ½¸½¹±¥¬õì ¤ôùÍ•ÑáÑÉ…%¹ÁÕĞ¡¹Õ±°¥ô±…ÍÍ9…µ”ô‰Áä´È¸Ô‰œµÉ…ä´ÄÀÀÉ½Õ¹‘•µá°ˆû²Ş£²0ğ½‰ÕÑÑ½¸øñ‰ÕÑÑ½¸½¹±¥¬õíÍÕ‰µ¥ÑáÑÉ…%¹ÁÕÑô±…ÍÍ9…µ”ô‰Áä´È¸Ô‰œµÙ¥½±•Ğ´ØÀÀÑ•áĞµİ¡¥Ñ”É½Õ¹‘•µá°™½¹Ğµ‰½±ˆû®NÇ®†tğ½‰ÕÑÑ½¸øğ½‘¥Øøğ½‘¥Øøğ½‘¥Øø¥ô((€€€€€íÍÑ…¹‘…±½¹•AÉ½µ¥Í•=Á•¸˜˜ñMÑ…¹‘…±½¹•AÉ½µ¥Í•5½‘…°ÕÍ•É%õíÕÉÉ•¹ÑµÀü¹¥‘ôµ½¹Ñ õíµ½¹Ñ¡ôÍ•±•Ñ•‘…äõíÍ•±•Ñ•‘…åô½¹±½Í”õì ¤ôùÍ•ÑMÑ…¹‘…±½¹•AÉ½µ¥Í•=Á•¸¡™…±Í”¥ô¼ùô((€€€€€í¡½ÕÍ•¡½±‘I•¹•İ=Á•¸˜˜ (€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™¥á•¥¹Í•Ğ´Àè´ÔÀ‰œµ‰±…¬¼ĞÀ™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ•¹Ñ•ÈÀ´Ğˆø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Üµ™Õ±°µ…àµÜµÍ´‰œµİ¡¥Ñ”É½Õ¹‘•´Íá°À´ÔÍ¡…‘½Ü´Éá°µ…àµ µläÁÙ¡t½Ù•É™±½Üµäµ…ÕÑ¼ˆø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÙ¥½±•Ğ´ÔÀÀ™½¹ĞµÍ•µ¥‰½±ˆû²vã¶Ã®Üƒ²z³²V÷²‚Tğ½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµ±œ™½¹Ğµ‰½±Ñ•áĞµÉ…ä´äÀÀµĞ´Äˆùí¡½ÕÍ•¡½±‘I•¹•İ‘¥Ñ%¹‘•àôôõ¹Õ±°üŸ²z³²V÷²‚Tƒ².“²‚ƒ²z®‚”œèŸ²z³²V÷²‚Tƒ².“²‚ƒ²"c²‚Tôğ½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ…ä´ĞÀÀµĞ´Äˆû²z³²V÷²‚W²vğíµ½¹Ñ¡ôµíÍ•±•Ñ•‘…åôğ½‘¥Øø(€€€€€€€€€€€€ñ±…‰•°±…ÍÍ9…µ”ô‰‰±½¬Ñ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÉ…ä´ØÀÀµĞ´Ğµˆ´Ä¸ÔˆûªÎƒªÂw®ª€£²ƒ¶t¤ğ½±…‰•°ø(€€€€€€€€€€€€ñ¥¹ÁÕĞÙ…±Õ”õí¡½ÕÍ•¡½±‘I•¹•İ½É´¹ÕÍÑ½µ•Éñğœô½¹¡…¹”õí”ôùÍ•Ñ!½ÕÍ•¡½±‘I•¹•İ½É´¡ì¸¸¹¡½ÕÍ•¡½±‘I•¹•İ½É´±ÕÍÑ½µ•Èé”¹Ñ…É•Ğ¹Ù…±Õ•ô¥ô±…ÍÍ9…µ”ô‰Üµ™Õ±°‰½É‘•È‰½É‘•ÈµÉ…ä´ÈÀÀÉ½Õ¹‘•µá°Áà´ÌÁä´ÌÑ•áĞµÍ´ˆÁ±…•¡½±‘•Èô‹ªÎƒªÂw®ªˆ¼ø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÉ…ä´ØÀÀµĞ´Ğµˆ´Èˆû²vã¶Ã®Üƒ²7®>ğ½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É¥É¥µ½±Ì´Ì…À´ÈˆùímlœÅœœ°œÅt±lœÔÀÀœ°œÔÀÁ5t±lœÄÀÀœ°œÄÀÁ5ut¹µ…À ¡m­•ä±±…‰•±t¤ôøñ‰ÕÑÑ½¸­•äõí­•åôÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùÍ•Ñ!½ÕÍ•¡½±‘I•¹•İ½É´¡ì¸¸¹¡½ÕÍ•¡½±‘I•¹•İ½É´±ÍÁ••é­•åô¥ô±…ÍÍ9…µ”õíÁä´È¸ÔÉ½Õ¹‘•µá°‰½É‘•ÈÑ•áĞµáÌ™½¹Ğµ‰½±€‘í¡½ÕÍ•¡½±‘I•¹•İ½É´¹ÍÁ••ôôõ­•äü‰œµÙ¥½±•Ğ´ÔÀ‰½É‘•ÈµÙ¥½±•Ğ´ÌÀÀÑ•áĞµÙ¥½±•Ğ´ÜÀÀœè‰œµİ¡¥Ñ”‰½É‘•ÈµÉ…ä´ÈÀÀÑ•áĞµÉ…ä´ÔÀÀõôùí±…‰•±ôğ½‰ÕÑÑ½¸ø¥ôğ½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÉ…ä´ØÀÀµĞ´Ğµˆ´Èˆû²z³²V÷²‚Tƒ²¶J ğ½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰ÍÁ…”µä´Ä¸Ôˆùì¡¥ÍM•ÁÑ•µ‰•ÉA½±¥åÑ¥Ù”¡µ½¹Ñ ¤ımí­•äèÁÉ•µ¥ÕµM…™”œ±±…‰•°èŸ¶R®š³®¾ã²^ƒ²V#².°ƒ®ÎÓ²ô±í­•äèÁÉ•µ¥Õ´œ±±…‰•°èŸ®>g²vğƒ®bC®*PƒªŞàƒ²fàƒ²jSªâ#²‚põté!=UM!=1}I9]}A19L¤¹µ…À¡Àôøñ‰ÕÑÑ½¸­•äõíÀ¹­•åôÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùÍ•Ñ!½ÕÍ•¡½±‘I•¹•İ½É´¡ì¸¸¹¡½ÕÍ•¡½±‘I•¹•İ½É´±Á±…¸éÀ¹­•åô¥ô±…ÍÍ9…µ”õíÜµ™Õ±°Áä´È¸ÔÁà´ÌÉ½Õ¹‘•µá°‰½É‘•ÈÑ•áĞµ±•™ĞÑ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±€‘í¡½ÕÍ•¡½±‘I•¹•İ½É´¹Á±…¸ôôõÀ¹­•äü‰œµÙ¥½±•Ğ´ÔÀ‰½É‘•ÈµÙ¥½±•Ğ´ÌÀÀÑ•áĞµÙ¥½±•Ğ´ÜÀÀœè‰œµİ¡¥Ñ”‰½É‘•ÈµÉ…ä´ÈÀÀÑ•áĞµÉ…ä´ØÀÀõôùí¡½ÕÍ•¡½±‘I•¹•İ½É´¹Á±…¸ôôõÀ¹­•äüŸŠrL€œèœõíÀ¹±…‰•±ôğ½‰ÕÑÑ½¸ø¥ôğ½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÉ…ä´ØÀÀµĞ´Ğµˆ´Èˆû²z³²V÷²‚TƒªÖ³²Äğ½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É¥É¥µ½±Ì´È…À´Èˆøñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùÍ•Ñ!½ÕÍ•¡½±‘I•¹•İ½É´¡ì¸¸¹¡½ÕÍ•¡½±‘I•¹•İ½É´±¡½µ•=¹±äé™…±Í•ô¥ô±…ÍÍ9…µ”õíÁä´È¸ÔÉ½Õ¹‘•µá°‰½É‘•ÈÑ•áĞµáÌ™½¹Ğµ‰½±€‘ì…¡½ÕÍ•¡½±‘I•¹•İ½É´¹¡½µ•=¹±äü‰œµÙ¥½±•Ğ´ÔÀ‰½É‘•ÈµÙ¥½±•Ğ´ÌÀÀÑ•áĞµÙ¥½±•Ğ´ÜÀÀœè‰œµİ¡¥Ñ”‰½É‘•ÈµÉ…ä´ÈÀÀÑ•áĞµÉ…ä´ÔÀÀõôû¶f ­QXƒ²z³²V÷²‚Tğ½‰ÕÑÑ½¸øñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùÍ•Ñ!½ÕÍ•¡½±‘I•¹•İ½É´¡ì¸¸¹¡½ÕÍ•¡½±‘I•¹•İ½É´±¡½µ•=¹±äéÑÉÕ”±ÑÙUÁÍ•±°é™…±Í•ô¥ô±…ÍÍ9…µ”õíÁä´È¸ÔÉ½Õ¹‘•µá°‰½É‘•ÈÑ•áĞµáÌ™½¹Ğµ‰½±€‘í¡½ÕÍ•¡½±‘I•¹•İ½É´¹¡½µ•=¹±äü‰œµÙ¥½±•Ğ´ÔÀ‰½É‘•ÈµÙ¥½±•Ğ´ÌÀÀÑ•áĞµÙ¥½±•Ğ´ÜÀÀœè‰œµİ¡¥Ñ”‰½É‘•ÈµÉ…ä´ÈÀÀÑ•áĞµÉ…ä´ÔÀÀõôû¶f#®0ƒ²z³²V÷²‚Tğ½‰ÕÑÑ½¸øğ½‘¥Øø(€€€€€€€€€€€í¡½ÕÍ•¡½±‘I•¹•İ½É´¹¡½µ•=¹±ä˜˜…¥ÍM•ÁÑ•µ‰•ÉA½±¥åÑ¥Ù”¡µ½¹Ñ ¤˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµ…µ‰•È´ØÀÀµĞ´Ä¸Ôˆû¶f ƒ®.£®>ƒ²z³²V÷²‚W²v ƒªâÃ®Îàƒ²z³²V÷²‚Tƒ²"c²"c®3²^C²pƒ²Ös®2 €ÔÀ°ÀÀÃ²nC²vĞƒ²Â£ªÂC®B§®.#®.¸ğ½‘¥Øùô(€€€€€€€€€€€€ñ±…‰•°±…ÍÍ9…µ”ô‰µĞ´Ğ™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•Ñİ••¸…À´ÌÉ½Õ¹‘•µá°‰½É‘•È‰½É‘•ÈµÉ…ä´ÈÀÀÁà´ÌÁä´Ìˆøñ‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÉ…ä´ÜÀÀˆù!Lƒ®>g².s¶2C®ğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀˆøÅ€¬àÀ°ÀÀÃ²n@ƒ
Ü€ÔÀÁ5€¬ÔÀ°ÀÀÃ²n@ğ½‘¥Øøğ½‘¥Øøñ¥¹ÁÕĞÑåÁ”ô‰¡•­‰½àˆ¡•­•õì„…¡½ÕÍ•¡½±‘I•¹•İ½É´¹¡ÍM¥µÕ±ô½¹¡…¹”õí”ôùÍ•Ñ!½ÕÍ•¡½±‘I•¹•İ½É´¡ì¸¸¹¡½ÕÍ•¡½±‘I•¹•İ½É´±¡ÍM¥µÕ°é”¹Ñ…É•Ğ¹¡•­•‘ô¥ô¼øğ½±…‰•°ø(€€€€€€€€€€€€ñ±…‰•°±…ÍÍ9…µ”ô‰µĞ´È™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•Ñİ••¸…À´ÌÉ½Õ¹‘•µá°‰½É‘•È‰½É‘•ÈµÉ…ä´ÈÀÀÁà´ÌÁä´Ìˆøñ‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÉ…ä´ÜÀÀˆùQXƒ²^² ğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀˆû²†ÃªÆĞƒ²Ú§²†Äƒ².p€¬ÈÀ°ÀÀÃ²n@ğ½‘¥Øøğ½‘¥Øøñ¥¹ÁÕĞÑåÁ”ô‰¡•­‰½àˆ¡•­•õì„…¡½ÕÍ•¡½±‘I•¹•İ½É´¹ÑÙUÁÍ•±±ô½¹¡…¹”õí”ôùÍ•Ñ!½ÕÍ•¡½±‘I•¹•İ½É´¡ì¸¸¹¡½ÕÍ•¡½±‘I•¹•İ½É´±ÑÙUÁÍ•±°é”¹Ñ…É•Ğ¹¡•­•‘ô¥ô¼øğ½±…‰•°ø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´ĞÉ½Õ¹‘•µá°‰œµÉ…ä´ÔÀ‰½É‘•È‰½É‘•ÈµÉ…ä´ÄÀÀÀ´ÌÍÁ…”µä´Èˆùí¥ÍM•ÁÑ•µ‰•ÉA½±¥åÑ¥Ù”¡µ½¹Ñ ¤˜˜ñ±…‰•°±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•Ñİ••¸…À´ÌÑ•áĞµáÌÑ•áĞµÉ…ä´ØÀÀˆøñÍÁ…¸û²7®>ƒ²¶Z”ƒ²z³²V÷²‚T€ ¬ÌÀ°ÀÀÃ²n@¤ğ½ÍÁ…¸øñ¥¹ÁÕĞÑåÁ”ô‰¡•­‰½àˆ¡•­•õì„…¡½ÕÍ•¡½±‘I•¹•İ½É´¹ÍÁ••‘UÁô½¹¡…¹”õí”ôùÍ•Ñ!½ÕÍ•¡½±‘I•¹•İ½É´¡ì¸¸¹¡½ÕÍ•¡½±‘I•¹•İ½É´±ÍÁ••‘UÀé”¹Ñ…É•Ğ¹¡•­•‘ô¥ô¼øğ½±…‰•°ùôñ±…‰•°±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•Ñİ••¸…À´ÌÑ•áĞµáÌÑ•áĞµÉ…ä´ØÀÀˆøñÍÁ…¸ûªâÃ²†Ğƒ²7®>®ÎÓ®.ƒ®
»²ÚÀƒ²z³²V÷²‚Tğ½ÍÁ…¸øñ¥¹ÁÕĞÑåÁ”ô‰¡•­‰½àˆ¡•­•õì„…¡½ÕÍ•¡½±‘I•¹•İ½É´¹‘½İ¹MÁ••‘ô½¹¡…¹”õí”ôùÍ•Ñ!½ÕÍ•¡½±‘I•¹•İ½É´¡ì¸¸¹¡½ÕÍ•¡½±‘I•¹•İ½É´±‘½İ¹MÁ••é”¹Ñ…É•Ğ¹¡•­•‘ô¥ô¼øğ½±…‰•°ùì…¥ÍM•ÁÑ•µ‰•ÉA½±¥åÑ¥Ù”¡µ½¹Ñ ¤˜˜ñ±…‰•°±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•Ñİ••¸…À´ÌÑ•áĞµáÌÑ•áĞµÉ…ä´ØÀÀˆøñÍÁ…¸û²vó².pƒ²¶Z”ƒ¶nƒ®>g²vğƒ²†ÃªÆĞƒ²z³²V÷²‚Tğ½ÍÁ…¸øñ¥¹ÁÕĞÑåÁ”ô‰¡•­‰½àˆ¡•­•õì„…¡½ÕÍ•¡½±‘I•¹•İ½É´¹Ñ•µÁ½É…ÉåUÁÉ…‘•M…µ•ô½¹¡…¹”õí”ôùÍ•Ñ!½ÕÍ•¡½±‘I•¹•İ½É´¡ì¸¸¹¡½ÕÍ•¡½±‘I•¹•İ½É´±Ñ•µÁ½É…ÉåUÁÉ…‘•M…µ”é”¹Ñ…É•Ğ¹¡•­•‘ô¥ô¼øğ½±…‰•°ùôñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀ±•…‘¥¹œµÉ•±…á•ˆùí¥ÍM•ÁÑ•µ‰•ÉA½±¥åÑ¥Ù”¡µ½¹Ñ ¤üŸ²vã¶Ã®Üƒ²jSªâ#²‚pƒ¶Vc¶Z”ƒ²z³²V÷²‚W²v ƒ²ªâ'®Bc² ƒ²V+²*×®.#®.¸œèœÄÀÁ5ƒ²z³²V÷²‚T°ƒ²7®>ƒ¶Vc¶Z”°ƒ²vó².pƒ²¶Z”ƒ¶nƒ®>g²vğƒ²jSªâ#²‚s
ß®>g²vğƒ²7®>ƒ²z³²V÷²‚W²v ƒ²ªâ'²V„€Ã²nC²ró®†pƒªÎ²
Ã¶V§®.#®.¸ôğ½‘¥Øøğ½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´ĞÉ½Õ¹‘•´Éá°‰œµÙ¥½±•Ğ´ÔÀ‰½É‘•È‰½É‘•ÈµÙ¥½±•Ğ´ÄÀÀÀ´Ğˆøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÙ¥½±•Ğ´ÔÀÀˆû²zC®>dƒªÎ²
Àƒ²ªâ'²V„ğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞ´Éá°™½¹Ğµ‰½±Ñ•áĞµÙ¥½±•Ğ´ÜÀÀµĞ´À¸Ôˆùíİ½¸¡¡½ÕÍ•¡½±‘I•¹•İAÉ•Ù¥•Ü¹…µ½Õ¹Ğ¥ôğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÙ¥½±•Ğ´ØÀÀµĞ´Äˆû²w²
Ã²Ä-A$ƒ
Üƒ²vã¶Ã®Ü€À¸ÍAí¡½ÕÍ•¡½±‘I•¹•İ½É´¹¡½µ•=¹±äüœœèœ€¬QX€À¸Í@ôğ½‘¥Øùì…¡½ÕÍ•¡½±‘I•¹•İAÉ•Ù¥•Ü¹¥¹Ù…±¥˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ÔÀÀµĞ´È±•…‘¥¹œµÉ•±…á•ˆûªâÃ®Îàíİ½¸¡¡½ÕÍ•¡½±‘I•¹•İAÉ•Ù¥•Ü¹‰…Í”¥õí¡½ÕÍ•¡½±‘I•¹•İAÉ•Ù¥•Ü¹Í½±½¥Í½Õ¹Ğı€€´ƒ¶f ƒ®.£®>€‘íİ½¸¡¡½ÕÍ•¡½±‘I•¹•İAÉ•Ù¥•Ü¹Í½±½¥Í½Õ¹Ğ¥õ€èœõí¡½ÕÍ•¡½±‘I•¹•İAÉ•Ù¥•Ü¹¡ÍA…äı€€¬!Lƒ®>g².p€‘íİ½¸¡¡½ÕÍ•¡½±‘I•¹•İAÉ•Ù¥•Ü¹¡ÍA…ä¥õ€èœõí¡½ÕÍ•¡½±‘I•¹•İAÉ•Ù¥•Ü¹ÑÙA…äı€€¬QXƒ²^² €‘íİ½¸¡¡½ÕÍ•¡½±‘I•¹•İAÉ•Ù¥•Ü¹ÑÙA…ä¥õ€èœôğ½‘¥Øùôğ½‘¥Øø(€€€€€€€€€€€ì¡‘…ä¹¡½ÕÍ•¡½±‘I•¹•İ…±Íññmt¤¹±•¹Ñ øÀ˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´Ğˆøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌ™½¹Ğµ‰½±Ñ•áĞµÉ…ä´ÜÀÀµˆ´ÈˆùíÍ•±•Ñ•‘…å÷²vğƒ®NÇ®†tƒ®
Ó²^´ğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰‘¥Ù¥‘”µä‘¥Ù¥‘”µÉ…ä´ÄÀÀ‰½É‘•È‰½É‘•ÈµÉ…ä´ÄÀÀÉ½Õ¹‘•µá°½Ù•É™±½Üµ¡¥‘‘•¸ˆùì¡‘…ä¹¡½ÕÍ•¡½±‘I•¹•İ…±Íññmt¤¹µ…À ¡¥Ñ•´±¥‘à¤ôùí½¹ÍĞŒõ…±Õ±…Ñ•!½ÕÍ•¡½±‘I•¹•Ü¡¥Ñ•´±½¹™¥œ¤íÉ•ÑÕÉ¸€ñ‘¥Ø­•äõí¥Ñ•´¹¥‘ññ¥‘áô±…ÍÍ9…µ”ô‰Áà´ÌÁä´È¸Ô™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•Ñİ••¸…À´Èˆøñ‘¥Ø±…ÍÍ9…µ”ô‰µ¥¸µÜ´Àˆøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÉ…ä´ÜÀÀÑÉÕ¹…Ñ”ˆùí¥Ñ•´¹ÕÍÑ½µ•ÉñğŸ²vÓ®šƒ²^²v0ôƒ
Üí¥Ñ•´¹ÍÁ••ôôôœÅœœüœÅœé¥Ñ•´¹ÍÁ••ôôôœÔÀÀœüœÔÀÁ5œèœÄÀÁ5ôğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀµĞ´À¸Ôˆùí!=UM!=1}I9]}A19L¹™¥¹¡àôùà¹­•äôôõ¥Ñ•´¹Á±…¸¤ü¹±…‰•±ññ¥Ñ•´¹Á±…¹ôƒ
Üíİ½¸¡Œ¹…µ½Õ¹Ğ¥ôğ½‘¥Øøğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à…À´Äˆøñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôù½Á•¹!½ÕÍ•¡½±‘I•¹•Ü¡¥‘à¥ô±…ÍÍ9…µ”ô‰Áà´ÈÁä´ÄÉ½Õ¹‘•µ±œ‰œµÉ…ä´ÔÀÑ•áĞµlÄÁÁát™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÙ¥½±•Ğ´ØÀÀˆû²"c²‚Tğ½‰ÕÑÑ½¸øñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôù‘•±•Ñ•!½ÕÍ•¡½±‘I•¹•Ü¡¥‘à¥ô±…ÍÍ9…µ”ô‰Áà´ÈÁä´ÄÉ½Õ¹‘•µ±œ‰œµÉ•´ÔÀÑ•áĞµlÄÁÁát™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÉ•´ÔÀÀˆû²
·²‚pğ½‰ÕÑÑ½¸øğ½‘¥Øøğ½‘¥Øùô¥ôğ½‘¥Øøğ½‘¥Øùô(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É¥É¥µ½±Ì´È…À´ÈµĞ´Ôˆøñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùíÍ•Ñ!½ÕÍ•¡½±‘I•¹•İ=Á•¸¡™…±Í”¤íÍ•Ñ!½ÕÍ•¡½±‘I•¹•İ‘¥Ñ%¹‘•à¡¹Õ±°¤íÍ•Ñ!½ÕÍ•¡½±‘I•¹•İ½É´¡•µÁÑå!½ÕÍ•¡½±‘I•¹•İ½É´ ¤¥õô±…ÍÍ9…µ”ô‰Áä´È¸ÔÉ½Õ¹‘•µá°‰œµÉ…ä´ÄÀÀÑ•áĞµÉ…ä´ÔÀÀÑ•áĞµÍ´™½¹ĞµÍ•µ¥‰½±ˆû²Ş£²0ğ½‰ÕÑÑ½¸øñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õíÍ…Ù•!½ÕÍ•¡½±‘I•¹•İô±…ÍÍ9…µ”ô‰Áä´È¸ÔÉ½Õ¹‘•µá°‰œµÙ¥½±•Ğ´ØÀÀÑ•áĞµİ¡¥Ñ”Ñ•áĞµÍ´™½¹Ğµ‰½±ˆùí¡½ÕÍ•¡½±‘I•¹•İ‘¥Ñ%¹‘•àôôõ¹Õ±°üŸ®NÇ®†tœèŸ²"c²‚Tƒ²‚²z”ôğ½‰ÕÑÑ½¸øğ½‘¥Øø(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€ğ½‘¥Øø(€€€€€€¥ô((€€€€€íµ½‰¥±•M…±•É…™Ğ€˜˜€ (€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™¥á•¥¹Í•Ğ´Àè´ÔÀ‰œµ‰±…¬¼ĞÀ™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ•¹Ñ•ÈÀ´Ğˆø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Üµ™Õ±°µ…àµÜµÍ´‰œµİ¡¥Ñ”É½Õ¹‘•´Íá°À´ÔÍ¡…‘½Ü´Éá°µ…àµ µläÁÙ¡t½Ù•É™±½Üµäµ…ÕÑ¼ˆø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÙ¥½±•Ğ´ÔÀÀ™½¹ĞµÍ•µ¥‰½±ˆùí•‘¥Ñ¥¹M…±”üŸ¶2C®“ªÆĞƒ²"c²‚Tœé±•…å½¹Ù•ÉÍ¥½¸ü¹­¥¹ôôôµ½‰¥±”œüŸ²vÓ²‚ƒ¶2C®“ªÆĞƒ®Î×²n@œèŸ¶Vpƒ®Ê#²^@ƒ¶2C®ƒ®NÇ®†tôğ½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµ±œ™½¹Ğµ‰½±Ñ•áĞµÉ…ä´äÀÀµĞ´Äˆùí±•…å½¹Ù•ÉÍ¥½¸ü¹­¥¹ôôôµ½‰¥±”œüŸ®ª£®ÂS²vğƒ².“²‚ƒ²"c²‚TœèŸ®ª£®ÂS²vğƒ².“²‚ƒ²z®‚”ôğ½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ…ä´ĞÀÀµĞ´ÄˆûªÂs¶×²vğíµ½¹Ñ¡ôµíÍ•±•Ñ•‘…åôğ½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´ÌÉ¥É¥µ½±Ì´Ì…À´Ä¸ÔÑ•áĞµlÄÁÁát™½¹Ğµ‰½±ˆø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É½Õ¹‘•µ±œ‰œµÙ¥½±•Ğ´ØÀÀÑ•áĞµİ¡¥Ñ”Áä´ÈÑ•áĞµ•¹Ñ•ÈˆøÄƒ¶2C®“²‚W®ÎĞğ½‘¥Øø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÉ½Õ¹‘•µ±œÁä´ÈÑ•áĞµ•¹Ñ•È€‘íµ½‰¥±••Ñ…¥±Í=Á•¸ü‰œµÙ¥½±•Ğ´ÄÀÀÑ•áĞµÙ¥½±•Ğ´ÜÀÀœè‰œµÉ…ä´ÄÀÀÑ•áĞµÉ…ä´ĞÀÀõôøÈƒ²ÚSªÂ¶V·®ª¤ğ½‘¥Øø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÉ½Õ¹‘•µ±œÁä´ÈÑ•áĞµ•¹Ñ•È€‘íµ½‰¥±•ÕÍÑ½µ•É9…µ”¹ÑÉ¥´ ¤ü‰œµ•µ•É…±´ÔÀÑ•áĞµ•µ•É…±´ÜÀÀœè‰œµÉ…ä´ÄÀÀÑ•áĞµÉ…ä´ĞÀÀõôøÌƒ¶fW²vã
ß®NÇ®†tğ½‘¥Øø(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€ì…•‘¥Ñ¥¹M…±”˜™É••¹Ñ5½‰¥±•½µ‰½Ì¹±•¹Ñ øÀ˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´ÌÉ½Õ¹‘•µá°‰½É‘•È‰½É‘•ÈµÙ¥½±•Ğ´ÄÀÀ‰œµÙ¥½±•Ğ´ÔÀ¼ÔÀÀ´Ìˆø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁát™½¹Ğµ‰½±Ñ•áĞµÙ¥½±•Ğ´ÜÀÀµˆ´Èˆû²ÖsªŞğƒ¶2C®ƒ²†Ã¶V¤ƒ®æƒ®–àƒ²ƒ¶tğ½‘¥Øø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à…À´Ä¸Ô½Ù•É™±½Üµàµ…ÕÑ¼Áˆ´À¸Ôˆø(€€€€€€€€€€€€€€€íÉ••¹Ñ5½‰¥±•½µ‰½Ì¹µ…À ¡½µ‰¼±¤¤ôøñ‰ÕÑÑ½¸­•äõí€‘í½µ‰¼¹±…‰•±ô´‘í¥õôÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôù…ÁÁ±åI••¹Ñ5½‰¥±•½µ‰¼¡½µ‰¼¥ô±…ÍÍ9…µ”ô‰Í¡É¥¹¬´ÀÉ½Õ¹‘•µ±œ‰œµİ¡¥Ñ”‰½É‘•È‰½É‘•ÈµÙ¥½±•Ğ´ÄÀÀÁà´ÌÁä´ÈÑ•áĞµ±•™Ğˆø(€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÅÁát™½¹Ğµ‰½±Ñ•áĞµÉ…ä´ÜÀÀˆùí½µ‰¼¹±…‰•±ôğ½‘¥Øø(€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlåÁátÑ•áĞµÉ…ä´ĞÀÀµĞ´À¸ÔˆùYLì¡½µ‰¼¹Ù…Í-•åÍññmt¤¹™¥±Ñ•È¡¬ôù¬„ôôÙ…Í9½¹”œ¤¹±•¹Ñ¡ôƒ
Ü€É9ì¡½µ‰¼¹‰Õ¹‘±”É¹‘-•åÍññmt¤¹±•¹Ñ¡ôğ½‘¥Øø(€€€€€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø¥ô(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€ğ½‘¥Øùô(€€€€€€€€€€€ì…•‘¥Ñ¥¹M…±”˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´ÈÉ½Õ¹‘•µá°‰œµ‰±Õ”´ÔÀ‰½É‘•È‰½É‘•Èµ‰±Õ”´ÄÀÀÁà´ÌÁä´ÈÑ•áĞµlÄÁÁátÑ•áĞµ‰±Õ”´ÜÀÀˆû¶V·®ª§²vƒ²ƒ¶w¶Vc®*Pƒ®>g²V#²^C®*Pƒ²‚²z—®Bc² ƒ²V+²V²jP¸ƒ® ƒ²V®z`€ñˆû².“²‚ƒ®NÇ®†tğ½ˆû²vƒ®"3®~³²Vğƒ¶2C®“ªÆÓ
ßªÎƒªÂw²‚W®ÎÓ
ß²V÷²7²vĞƒ¶V£ªî`ƒ®NÇ®†w®B§®.#®.¸ğ½‘¥Øùô(€€€€€€€€€€€í±•…å½¹Ù•ÉÍ¥½¸ü¹­¥¹ôôôµ½‰¥±”œ˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´ÈÉ½Õ¹‘•µá°‰œµ…µ‰•È´ÔÀ‰½É‘•È‰½É‘•Èµ…µ‰•È´ÄÀÀÁà´ÌÁä´ÈÑ•áĞµlÄÁÁátÑ•áĞµ…µ‰•È´ÜÀÀˆø(€€€€€€€€€€€€€ƒªâÃ²†Ğƒ®6Ã²vÓ¶Ã²^C²pƒ¶fW²vã®BpƒªÂHƒ
Ü€ñˆùí±•…å½¹Ù•ÉÍ¥½¸¹Ñ¥Ñ±•õí±•…å½¹Ù•ÉÍ¥½¸¹‘•Ñ…¥°ı€ƒ
Ü€‘í±•…å½¹Ù•ÉÍ¥½¸¹‘•Ñ…¥±õ€èœôğ½ˆøñ‰È¼ø(€€€€€€€€€€€€€ƒªÎƒªÂw®ª
İYO
ÜÉ9ƒ®NÄƒ®.ç².pƒ²‚²z—®Bc² ƒ²V+²v ƒªÂK²v ƒ®æ²n3®FC²^#²ZÓ²jP¸(€€€€€€€€€€€€ğ½‘¥Øùô((€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´Ğˆø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÉ…ä´ØÀÀµˆ´ÈˆøÄ¸ƒ¶2C®ƒªÖ³®Ú€¨ğ½‘¥Øø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É¥É¥µ½±Ì´Ì…À´Èˆø(€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€€€€€½¹±¥¬õì ¤ôùíÍ•Ñ5½‰¥±•M…±•-¥¹ ¹½Éµ…°œ¤íÍ•Ñ5½‰¥±•MÁ•¥…±A½±¥å% œœ¤íÍ•Ñ5½‰¥±•MÁ•¥…±á•ÁÑ¥½¹µ½Õ¹Ğ œœ¥õô(€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õíÁä´ÌÉ½Õ¹‘•µá°‰½É‘•ÈÑ•áĞµáÌ™½¹Ğµ‰½±€‘íµ½‰¥±•M…±•-¥¹ôôô¹½Éµ…°œü‰œµÙ¥½±•Ğ´ÔÀ‰½É‘•ÈµÙ¥½±•Ğ´ÌÀÀÑ•áĞµÙ¥½±•Ğ´ÜÀÀœè‰œµİ¡¥Ñ”‰½É‘•ÈµÉ…ä´ÈÀÀÑ•áĞµÉ…ä´ÔÀÀõôø(€€€€€€€€€€€€€€€€€íµ½‰¥±•M…±•-¥¹ôôô¹½Éµ…°œüŸŠrL€œèœ÷²vó®Â`ƒ¶2C®(€€€€€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€€€€€½¹±¥¬õì ¤ôùÍ•Ñ5½‰¥±•M…±•-¥¹ ÍÁ•¥…°œ¥ô(€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õíÁä´ÌÉ½Õ¹‘•µá°‰½É‘•ÈÑ•áĞµáÌ™½¹Ğµ‰½±€‘íµ½‰¥±•M…±•-¥¹ôôôÍÁ•¥…°œü‰œµ…µ‰•È´ÔÀ‰½É‘•Èµ…µ‰•È´ÌÀÀÑ•áĞµ…µ‰•È´ÜÀÀœè‰œµİ¡¥Ñ”‰½É‘•ÈµÉ…ä´ÈÀÀÑ•áĞµÉ…ä´ÔÀÀõôø(€€€€€€€€€€€€€€€€€íµ½‰¥±•M…±•-¥¹ôôôÍÁ•¥…°œüŸŠrL€œèœ÷¶*çªÂ ›²²vã²‚W²Æ(€€€€€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€€€€€½¹±¥¬õì ¤ôùíÍ•Ñ5½‰¥±•M…±•-¥¹ ¥¹•¹Ñ¥Ù•}Õ¹Á…¥œ¤íÍ•Ñ5½‰¥±•MÁ•¥…±A½±¥å% œœ¤íÍ•Ñ5½‰¥±•MÁ•¥…±á•ÁÑ¥½¹µ½Õ¹Ğ œœ¥õô(€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õíÁä´ÌÉ½Õ¹‘•µá°‰½É‘•ÈÑ•áĞµlÄÁÁát™½¹Ğµ‰½±€‘íµ½‰¥±•M…±•-¥¹ôôô¥¹•¹Ñ¥Ù•}Õ¹Á…¥œü‰œµÉ•´ÔÀ‰½É‘•ÈµÉ•´ÌÀÀÑ•áĞµÉ•´ÜÀÀœè‰œµİ¡¥Ñ”‰½É‘•ÈµÉ…ä´ÈÀÀÑ•áĞµÉ…ä´ÔÀÀõôø(€€€€€€€€€€€€€€€€€íµ½‰¥±•M…±•-¥¹ôôô¥¹•¹Ñ¥Ù•}Õ¹Á…¥œüŸŠrL€œèœ÷²vã²ó®¾ã²ªâ$ƒ¶*çªÂ (€€€€€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€íµ½‰¥±•M…±•-¥¹ôôô¥¹•¹Ñ¥Ù•}Õ¹Á…¥œ˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´ÈÉ½Õ¹‘•µá°‰½É‘•È‰½É‘•ÈµÉ•´ÄÀÀ‰œµÉ•´ÔÀÁà´ÌÁä´ÈÑ•áĞµlÄÁÁátÑ•áĞµÉ•´ÜÀÀˆû¶2C®ƒ².“²‚
ß²ÇªÎñC
ß²b²^ƒ¶fs®>dƒ²²nC®æƒªÆÓ²"c®*Pƒ²vã²‚W¶VcªÎ€°ƒ²jSªâ#²‚s
İYO
ß®ÎÓ¶^`ƒ²vã²ó¶.Ã®â3®0ƒ²ªâ'¶Vc² ƒ²V+²V²jP¸ğ½‘¥Øùô((€€€€€€€€€€€€€íµ½‰¥±•M…±•-¥¹ôôôÍÁ•¥…°œ˜˜ (€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´ÈÉ½Õ¹‘•µá°‰½É‘•È‰½É‘•Èµ…µ‰•È´ÄÀÀ‰œµ…µ‰•È´ÔÀ¼ÌÀÀ´Ìˆø(€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÅÁát™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÉ…ä´ÜÀÀˆû²‚²j¤ƒ²‚W²Æ€¨ğ½‘¥Øø(€€€€€€€€€€€€€€€€€íÍÁ•¥…±A½±¥¥•Ì¹±•¹Ñ øÀ€ü€ (€€€€€€€€€€€€€€€€€€€€ğø(€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É¥É¥µ½±Ì´Ä…À´Ä¸ÔµĞ´Èˆø(€€€€€€€€€€€€€€€€€€€€€€€íÍÁ•¥…±A½±¥¥•Ì¹µ…À¡Àôùì(€€€€€€€€€€€€€€€€€€€€€€€€€½¹ÍĞÍ•±•Ñ•õµ½‰¥±•MÁ•¥…±A½±¥å%ôôõÀ¹¥ì(€€€€€€€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸€ñ‰ÕÑÑ½¸­•äõíÀ¹¥‘ôÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹±¥¬õì ¤ôùíÍ•Ñ5½‰¥±•MÁ•¥…±A½±¥å%¡À¹¥¤íÍ•Ñ5½‰¥±•MÁ•¥…±á•ÁÑ¥½¹µ½Õ¹Ğ œœ¥õô(€€€€€€€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õíÜµ™Õ±°Ñ•áĞµ±•™ĞÉ½Õ¹‘•µ±œ‰½É‘•ÈÁà´ÌÁä´È¸ÔÑ•áĞµáÌ€‘íÍ•±•Ñ•ü‰œµİ¡¥Ñ”‰½É‘•Èµ…µ‰•È´ÌÀÀÑ•áĞµ…µ‰•È´àÀÀœè‰œµİ¡¥Ñ”¼àÀ‰½É‘•ÈµÉ…ä´ÄÀÀÑ•áĞµÉ…ä´ØÀÀõôø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•Ñİ••¸…À´Èˆø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰™½¹ĞµÍ•µ¥‰½±ˆùíÍ•±•Ñ•üŸŠrL€œèœõíÀ¹Ñ¥Ñ±•ôğ½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµ…µ‰•È´ØÀÀˆûªâÃ²†Ğƒ²‚W²Æ€­íİ½¸¡À¹É•Á±…•µ•¹Ñ}…µ½Õ¹Ğ¥ôğ½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€€€€ì¡À¹ÍÑ…ÉÑ}‘…Ñ•ññÀ¹•¹‘}‘…Ñ”¤˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlåÁátÑ•áĞµÉ…ä´ĞÀÀµĞ´ÄˆùíÀ¹ÍÑ…ÉÑ}‘…Ñ•ñğœôøíÀ¹•¹‘}‘…Ñ•ñğœôğ½‘¥Øùô(€€€€€€€€€€€€€€€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€€€€€€ô¥ô(€€€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€íµ½‰¥±•MÁ•¥…±A½±¥å%˜˜ (€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´Èˆø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµ…µ‰•È´ÜÀÀ±•…‘¥¹œµÉ•±…á•ˆø(€€€€€€€€€€€€€€€€€€€€€€€€€€€ƒªâÃ²†Ğƒ²jSªâ#²‚s
İYO
ß®ÎÓ¶^`ƒ²vã²ó¶.Ã®â3²^@ƒ²†ÃªÆĞƒ²Ú§²†Äƒ².pƒ®ª£®6ã®Îƒ²ÚSªÂ ƒ²vã²ó¶.Ã®â3®–ğƒ®6S¶VÓ²jP¸(€€€€€€€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€¥ô(€€€€€€€€€€€€€€€€€€€€ğ¼ø(€€€€€€€€€€€€€€€€€€¤€è€ (€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´ÈÉ½Õ¹‘•µ±œ‰œµİ¡¥Ñ”Áà´ÌÁä´ÌÑ•áĞµlÄÅÁátÑ•áĞµÉ…ä´ÔÀÀˆø(€€€€€€€€€€€€€€€€€€€€€ƒ¶b²z°ƒ²‚²j¤ƒªÂ®*—¶Vpƒ²‚W²Æ²vĞƒ²^²ZÓ²jP¸ñ‰È¼ø(€€€€€€€€€€€€€€€€€€€€€ƒªÒ®š³²zC²^CªÊ0ƒ¶*ç¶2C
ß²²vã¶2C®ƒ²‚W²Æƒ®NÇ®†w²vƒ²jS²Ê·¶VÓ²ó²ã²jP¸(€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€¥ô(€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€¥ô(€€€€€€€€€€€€ğ½‘¥Øø((€€€€€€€€€€€€ñ±…‰•°±…ÍÍ9…µ”ô‰‰±½¬Ñ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÉ…ä´ÔÀÀµĞ´Ğµˆ´Ä¸ÔˆøÈ¸ƒªÎƒªÂw®ª€¨ğ½±…‰•°ø(€€€€€€€€€€€€ñ¥¹ÁÕĞÙ…±Õ”õíµ½‰¥±•ÕÍÑ½µ•É9…µ•ô½¹¡…¹”õí”ôùÍ•Ñ5½‰¥±•ÕÍÑ½µ•É9…µ”¡”¹Ñ…É•Ğ¹Ù…±Õ”¥ô(€€€€€€€€€€€€€Á±…•¡½±‘•Èô‹ªÎƒªÂw®ª²vƒ²z®‚—¶VÓ²ó²ã²jPˆ±…ÍÍ9…µ”ô‰Üµ™Õ±°‰½É‘•È‰½É‘•ÈµÉ…ä´ÈÀÀÉ½Õ¹‘•µá°Áà´ÌÁä´ÌÑ•áĞµÍ´ˆ¼ø((€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´ĞÉ¥É¥µ½±Ì´È…À´Èˆø(€€€€€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€€€€€ñ±…‰•°±…ÍÍ9…µ”ô‰‰±½¬Ñ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÉ…ä´ÔÀÀµˆ´Ä¸ÔˆøÌ¸ƒªÂ²zªÖ³®Úğ½±…‰•°ø(€€€€€€€€€€€€€€€€ñÍ•±•Ğ(€€€€€€€€€€€€€€€€€Ù…±Õ”õíµ½‰¥±•M…±•É…™Ğ¹É¤üüœô(€€€€€€€€€€€€€€€€€½¹¡…¹”õí”ôùì(€€€€€€€€€€€€€€€€€€€½¹ÍĞÉ¤õ9Õµ‰•È¡”¹Ñ…É•Ğ¹Ù…±Õ”¤ì(€€€€€€€€€€€€€€€€€€€½¹ÍĞ¤õ5QI%a}I=]}MmÉ¥tü¹¡…ÍQ¥•ÉÌ€ü¹Õ±°€è€Àì(€€€€€€€€€€€€€€€€€€€Í•Ñ5½‰¥±•M…±•É…™Ğ¡íÉ¤±¤±±…‰•°é¤ôôõ¹Õ±°üœœéµ½‰¥±•1…‰•±½È¡É¤±¤¥ô¤ì(€€€€€€€€€€€€€€€€€õô(€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰Üµ™Õ±°‰½É‘•È‰½É‘•ÈµÉ…ä´ÈÀÀÉ½Õ¹‘•µá°Áà´È¸ÔÁä´È¸ÔÑ•áĞµáÌ‰œµİ¡¥Ñ”ˆ(€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€ñ½ÁÑ¥½¸Ù…±Õ”ôˆˆ‘¥Í…‰±•û²ƒ¶w¶VÓ²ó²ã²jPğ½½ÁÑ¥½¸ø(€€€€€€€€€€€€€€€€€í5QI%a}I=]}L¹µ…À ¡È±É¤¤ôøñ½ÁÑ¥½¸­•äõíÈ¹±…‰•±ôÙ…±Õ”õíÉ¥ôùíÈ¹‘…¥±å1…‰•±ññÈ¹±…‰•±ôğ½½ÁÑ¥½¸ø¥ô(€€€€€€€€€€€€€€€€ğ½Í•±•Ğø(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€€€€€ñ±…‰•°±…ÍÍ9…µ”ô‰‰±½¬Ñ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÉ…ä´ÔÀÀµˆ´Ä¸Ôˆû²jSªâ#²‚sªÖÀğ½±…‰•°ø(€€€€€€€€€€€€€€€í5QI%a}I=]}Mmµ½‰¥±•M…±•É…™Ğ¹É¥tü¹¡…ÍQ¥•ÉÌ€ü€ (€€€€€€€€€€€€€€€€€€ñÍ•±•Ğ(€€€€€€€€€€€€€€€€€€€Ù…±Õ”õíµ½‰¥±•M…±•É…™Ğ¹¤üüœô(€€€€€€€€€€€€€€€€€€€½¹¡…¹”õí”ôùì(€€€€€€€€€€€€€€€€€€€€€½¹ÍĞ¤õ9Õµ‰•È¡”¹Ñ…É•Ğ¹Ù…±Õ”¤±É¤õµ½‰¥±•M…±•É…™Ğ¹É¤ì(€€€€€€€€€€€€€€€€€€€€€Í•Ñ5½‰¥±•M…±•É…™Ğ¡íÉ¤±¤±±…‰•°éµ½‰¥±•1…‰•±½È¡É¤±¤¥ô¤ì(€€€€€€€€€€€€€€€€€€€õô(€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰Üµ™Õ±°‰½É‘•È‰½É‘•ÈµÉ…ä´ÈÀÀÉ½Õ¹‘•µá°Áà´È¸ÔÁä´È¸ÔÑ•áĞµáÌ‰œµİ¡¥Ñ”ˆ(€€€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€€€ñ½ÁÑ¥½¸Ù…±Õ”ôˆˆ‘¥Í…‰±•û²ƒ¶w¶VÓ²ó²ã²jPğ½½ÁÑ¥½¸ø(€€€€€€€€€€€€€€€€€€€í…Ñ¥Ù•5…ÑÉ¥á=ÁÑ¥½¹Ì¹µ…À ¡í±…‰•°±¥ô¤ôøñ½ÁÑ¥½¸­•äõí€‘í¥ô´‘í±…‰•±õôÙ…±Õ”õí¥ôùí±…‰•±ôğ½½ÁÑ¥½¸ø¥ô(€€€€€€€€€€€€€€€€€€ğ½Í•±•Ğø(€€€€€€€€€€€€€€€€¤è (€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Üµ™Õ±°É½Õ¹‘•µá°Áà´È¸ÔÁä´È¸ÔÑ•áĞµáÌ‰œµÉ…ä´ÔÀÑ•áĞµÉ…ä´ĞÀÀˆùí9Õµ‰•È¹¥Í%¹Ñ••È¡µ½‰¥±•M…±•É…™Ğ¹É¤¤üŸ¶VÓ®.äƒ²^²v0œèŸªÂ²zªÖ³®Úƒ®¢ó²‚ ƒ²ƒ¶tôğ½‘¥Øø(€€€€€€€€€€€€€€€€¥ô(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€ğ½‘¥Øø((€€€€€€€€€€€í5QI%a}I=]}Mmµ½‰¥±•M…±•É…™Ğ¹É¥tü¹¡…ÍQ¥•ÉÌ€˜˜9Õµ‰•È¡µ½‰¥±•M…±•É…™Ğ¹¤¤ğôÄ€˜˜€ (€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´Ìˆø(€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùÍ•Ñ5½‰¥±•MÑÉ…Ñ•¥A±…¸¡Øôø…Ø¥ô(€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õíÜµ™Õ±°Ñ•áĞµ±•™ĞÁà´ÌÁä´È¸ÔÉ½Õ¹‘•µá°‰½É‘•ÈÑ•áĞµáÌ€‘íµ½‰¥±•MÑÉ…Ñ•¥A±…¸ü‰œµ•µ•É…±´ÔÀ‰½É‘•Èµ•µ•É…±´ÈÀÀÑ•áĞµ•µ•É…±´ÜÀÀœè‰œµİ¡¥Ñ”‰½É‘•ÈµÉ…ä´ÄÀÀÑ•áĞµÉ…ä´ØÀÀõôø(€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰™½¹ĞµÍ•µ¥‰½±ˆùíµ½‰¥±•MÑÉ…Ñ•¥A±…¸üŸŠrL€œèœ÷®Îã²
°ƒ²‚®z×²jSªâ#²‚pğ½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰™±½…ĞµÉ¥¡ĞÑ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀˆû®“²Ús²¶Fp€¬À¸Õ@ğ½ÍÁ…¸ø(€€€€€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlåÁátÑ•áĞµÉ…ä´ĞÀÀµĞ´ÄˆøÄÀ×ªÖÀƒ²vÓ²ƒ²’Dƒ®.ç²nPƒ®Îã²
°ƒ²‚®z×²jSªâ#²‚s²^@ƒ¶VÓ®.ç¶V€ƒ®V3®0ƒ²ÊÓ¶³¶VÓ²ó²ã²jP¸ğ½‘¥Øø(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€¥ô((€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´Ğˆø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÉ…ä´ØÀÀµˆ´Èˆø(€€€€€€€€€€€€€€€€Ì¸ƒ®¦S²vã¶j3²€ƒ²‚®zÔƒ®ÚªÂ²s®æ²*¡YL¤€ñÍÁ…¸±…ÍÍ9…µ”ô‰™½¹Ğµ¹½Éµ…°Ñ•áĞµÉ…ä´ĞÀÀˆû
Üƒ®Î×²"`ƒ²ƒ¶tƒªÂ®*”ğ½ÍÁ…¸ø(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É¥É¥µ½±Ì´Ä…À´Ä¸Ôˆø(€€€€€€€€€€€€€€€íl¸¸¹ÁÉ¥µ…Éå5…¥¹Y…Ì°ì­•äèÙ…Í9½¹”œ°±…‰•°èŸ®¾ã²rƒ²æ`œ°É…Ñ”èÀõt¹µ…À ¡Ø¤€ôøì(€€€€€€€€€€€€€€€€€½¹ÍĞÍ•±•Ñ•€ôµ½‰¥±•Y…Í-•åÌ¹¥¹±Õ‘•Ì¡Ø¹­•ä¤ì(€€€€€€€€€€€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€€€€€€€­•äõíØ¹­•åô(€€€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€€€€€€€€€½¹±¥¬õì ¤€ôøì(€€€€€€€€€€€€€€€€€€€€€€€¥˜€¡Ø¹­•ä€ôôô€Ù…Í9½¹”œ¤ì(€€€€€€€€€€€€€€€€€€€€€€€€€Í•Ñ5½‰¥±•Y…Í-•åÌ¡Í•±•Ñ•€ümt€èlÙ…Í9½¹”t¤ì(€€€€€€€€€€€€€€€€€€€€€€€ô•±Í”ì(€€€€€€€€€€€€€€€€€€€€€€€€€Í•Ñ5½‰¥±•Y…Í-•åÌ ¡ÁÉ•Ø¤€ôøì(€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹ÍĞ±•…¸€ôÁÉ•Ø¹™¥±Ñ•È ¡¬¤€ôø¬€„ôô€Ù…Í9½¹”œ¤ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸Í•±•Ñ•€ü±•…¸¹™¥±Ñ•È ¡¬¤€ôø¬€„ôôØ¹­•ä¤€èl¸¸¹±•…¸°Ø¹­•åtì(€€€€€€€€€€€€€€€€€€€€€€€€€ô¤ì(€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€€õô(€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õíÑ•áĞµ±•™ĞÁà´ÌÁä´È¸ÔÉ½Õ¹‘•µá°‰½É‘•ÈÑ•áĞµáÌ€‘ì(€€€€€€€€€€€€€€€€€€€€€€€Í•±•Ñ•(€€€€€€€€€€€€€€€€€€€€€€€€€€ü€‰œµÙ¥½±•Ğ´ÔÀ‰½É‘•ÈµÙ¥½±•Ğ´ÈÀÀÑ•áĞµÙ¥½±•Ğ´ÜÀÀœ(€€€€€€€€€€€€€€€€€€€€€€€€€€è€‰œµİ¡¥Ñ”‰½É‘•ÈµÉ…ä´ÄÀÀÑ•áĞµÉ…ä´ØÀÀœ(€€€€€€€€€€€€€€€€€€€€€õô(€€€€€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•Ñİ••¸…À´Èˆø(€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰™½¹ĞµÍ•µ¥‰½±ˆùíÍ•±•Ñ•€ü€ŸŠrL€œ€è€œõíØ¹±…‰•±ôğ½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€íØ¹É…Ñ”€ø€À€˜˜€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀˆø­íİ½¸¡Ø¹É…Ñ”¥ôğ½ÍÁ…¸ùô(€€€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€¤ì(€€€€€€€€€€€€€€€ô¥ô(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€í…‘‘¥Ñ¥½¹…±5…¥¹Y…Ì¹±•¹Ñ øÀ˜˜ğø(€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùÍ•Ñ5½‰¥±•5½É•Y…Í=Á•¸¡Øôø…Ø¥ô±…ÍÍ9…µ”ô‰µĞ´ÈÜµ™Õ±°É½Õ¹‘•µ±œ‰œµÉ…ä´ÔÀ‰½É‘•È‰½É‘•ÈµÉ…ä´ÄÀÀÁà´ÌÁä´ÈÑ•áĞµ±•™ĞÑ•áĞµlÄÅÁát™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÉ…ä´ØÀÀˆø(€€€€€€€€€€€€€€€€€ƒªâÃ¶ ƒ²‚®zÔƒ¶V·®ª¤íµ½‰¥±•5½É•Y…Í=Á•¸üŸ²‚GªâÀœèŸ¶:ó²æcªâÀô(€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰™±½…ĞµÉ¥¡Ğˆùíµ½‰¥±•5½É•Y…Í=Á•¸üŸŠZÈœèŸŠZğôğ½ÍÁ…¸ø(€€€€€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€íµ½‰¥±•5½É•Y…Í=Á•¸˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰É¥É¥µ½±Ì´Ä…À´Ä¸ÔµĞ´Ä¸Ôˆø(€€€€€€€€€€€€€€€€€í…‘‘¥Ñ¥½¹…±5…¥¹Y…Ì¹µ…À¡Øôùí½¹ÍĞÍ•±•Ñ•õµ½‰¥±•Y…Í-•åÌ¹¥¹±Õ‘•Ì¡Ø¹­•ä¤íÉ•ÑÕÉ¸€ñ‰ÕÑÑ½¸­•äõíØ¹­•åôÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùÍ•Ñ5½‰¥±•Y…Í-•åÌ¡ÁÉ•Øôùí½¹ÍĞ±•…¸õÁÉ•Ø¹™¥±Ñ•È¡¬ôù¬„ôôÙ…Í9½¹”œ¤íÉ•ÑÕÉ¸Í•±•Ñ•ı±•…¸¹™¥±Ñ•È¡¬ôù¬„ôõØ¹­•ä¤él¸¸¹±•…¸±Ø¹­•åuô¥ô(€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õíÑ•áĞµ±•™ĞÁà´ÌÁä´È¸ÔÉ½Õ¹‘•µá°‰½É‘•ÈÑ•áĞµáÌ€‘íÍ•±•Ñ•ü‰œµÙ¥½±•Ğ´ÔÀ‰½É‘•ÈµÙ¥½±•Ğ´ÈÀÀÑ•áĞµÙ¥½±•Ğ´ÜÀÀœè‰œµİ¡¥Ñ”‰½É‘•ÈµÉ…ä´ÄÀÀÑ•áĞµÉ…ä´ØÀÀõôø(€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰™½¹ĞµÍ•µ¥‰½±ˆùíÍ•±•Ñ•üŸŠrL€œèœõíØ¹±…‰•±ôğ½ÍÁ…¸ùíØ¹É…Ñ”øÀ˜˜ñÍÁ…¸±…ÍÍ9…µ”ô‰™±½…ĞµÉ¥¡ĞÑ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀˆø­íİ½¸¡Ø¹É…Ñ”¥ôğ½ÍÁ…¸ùô(€€€€€€€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ùô¥ô(€€€€€€€€€€€€€€€€ğ½‘¥Øùô(€€€€€€€€€€€€€€ğ¼ùô(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀµĞ´Ä¸Ôˆø(€€€€€€€€€€€€€€€ƒ®¾ã²rƒ²æc®*PƒªâÃ®†w²j§²vÓ®¦Àƒ²vã²ó¶.Ã®â3²^C®*Pƒ¶>³¶V£®Bc² ƒ²V+²V²jP¸(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€ğ½‘¥Øø((€€€€€€€€€€€í9Õµ‰•È¡µ½‰¥±•M…±•É…™Ğ¹É¤¤ôôôÔ€˜˜9Õµ‰•È¡µ½‰¥±•M…±•É…™Ğ¹¤¤ğôÌ€˜˜€ (€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´Ğˆø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÉ…ä´ØÀÀµˆ´ÈˆøĞ¸ƒ²’GªÎ€59@ƒªÊÃ¶V¤ƒ²vã²ó¶.Ã®â0ğ½‘¥Øø(€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùÍ•Ñ5½‰¥±•UÍ•‘5¹Á	Õ¹‘±”¡Øôø…Ø¥ô(€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õíÜµ™Õ±°Ñ•áĞµ±•™ĞÁà´ÌÁä´È¸ÔÉ½Õ¹‘•µá°‰½É‘•ÈÑ•áĞµáÌ€‘íµ½‰¥±•UÍ•‘5¹Á	Õ¹‘±”ü‰œµÙ¥½±•Ğ´ÔÀ‰½É‘•ÈµÙ¥½±•Ğ´ÈÀÀÑ•áĞµÙ¥½±•Ğ´ÜÀÀœè‰œµİ¡¥Ñ”‰½É‘•ÈµÉ…ä´ÄÀÀÑ•áĞµÉ…ä´ØÀÀõôø(€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰™½¹ĞµÍ•µ¥‰½±ˆùíµ½‰¥±•UÍ•‘5¹Á	Õ¹‘±”üŸŠrL€œèœ÷²’GªÎ€59@€ØÇªÖÃŠDƒªÊÃ¶V¤ğ½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰™±½…ĞµÉ¥¡ĞÑ•áĞµlÄÁÁátÑ•áĞµÙ¥½±•Ğ´ØÀÀ™½¹Ğµ‰½±ˆø­íİ½¸¡9Õµ‰•È ¡½¹™¥œ¹µ¹Á	Õ¹‘±•ññU1Q}59A}	U91¤¹™¥¹¡ØôùØ¹­•äôôôÕÍ•‘5¹Á	Õ¹‘±”œ¤ü¹É…Ñ•ñğÄÀÀÀÀÀ¤¥ôğ½ÍÁ…¸ø(€€€€€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀµĞ´Ä¸ÔˆùM%459@£²ƒ²Vô¤ƒ
Ü€ØÇªÖÀƒ²vÓ²ƒ
ÜƒªÂs¶Ôƒ®Â<ƒªÊÃ¶V§²f®0ƒªÆÓ®0ƒ²ÊÓ¶³¶VÓ²ó²ã²jP¸ğ½‘¥Øø(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€¥ô((€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùÍ•Ñ5½‰¥±••Ñ…¥±Í=Á•¸¡Øôø…Ø¥ô(€€€€€€€€€€€€€±…ÍÍ9…µ”õíµĞ´ĞÜµ™Õ±°É½Õ¹‘•µá°‰½É‘•ÈÁà´ÌÁä´ÌÑ•áĞµ±•™Ğ€‘íµ½‰¥±••Ñ…¥±Í=Á•¸ü‰œµÙ¥½±•Ğ´ÔÀ‰½É‘•ÈµÙ¥½±•Ğ´ÈÀÀÑ•áĞµÙ¥½±•Ğ´ÜÀÀœè‰œµÉ…ä´ÔÀ‰½É‘•ÈµÉ…ä´ÄÀÀÑ•áĞµÉ…ä´ÜÀÀõôø(€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµáÌ™½¹Ğµ‰½±ˆùíµ½‰¥±••Ñ…¥±Í=Á•¸üŸ²ÚSªÂ ƒ¶V·®ª¤ƒ²‚GªâÀœèœÉ9
ßªÎƒªÂw²V÷²7
ß²b²^®æ²j¤ƒ²ÚSªÂ ôğ½ÍÁ…¸ø(€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰™±½…ĞµÉ¥¡ĞÑ•áĞµáÌˆùíµ½‰¥±••Ñ…¥±Í=Á•¸üŸŠZÈœèŸŠZğôğ½ÍÁ…¸ø(€€€€€€€€€€€€€ì…µ½‰¥±••Ñ…¥±Í=Á•¸˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀµĞ´Äˆû¶V²jS¶VpƒªÊ÷²jÃ²^C®0ƒ²^Ó²ZĞƒ²z®‚—¶Vc²ã²jP¸ğ½‘¥Øùô(€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø((€€€€€€€€€€€íµ½‰¥±••Ñ…¥±Í=Á•¸˜˜ğø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´Ğˆø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÉ…ä´ØÀÀµˆ´ÈˆøÔ¸€É9ƒ¶2C®€ñÍÁ…¸±…ÍÍ9…µ”ô‰™½¹Ğµ¹½Éµ…°Ñ•áĞµÉ…ä´ĞÀÀˆû
Üƒ²Ös®2 €ËªÂpƒ²ƒ¶tğ½ÍÁ…¸øğ½‘¥Øø(€€€€€€€€€€€€€€ñ¥¹ÁÕĞÙ…±Õ”õíµ½‰¥±•	Õ¹‘±•M•…É¡ô½¹¡…¹”õí”ôùÍ•Ñ5½‰¥±•	Õ¹‘±•M•…É ¡”¹Ñ…É•Ğ¹Ù…±Õ”¥ôÁ±…•¡½±‘•ÈôˆÉ9ƒªâÃªâÃ®ªƒªÊ²$ˆ±…ÍÍ9…µ”ô‰Üµ™Õ±°µˆ´È‰½É‘•È‰½É‘•ÈµÉ…ä´ÈÀÀÉ½Õ¹‘•µá°Áà´ÌÁä´È¸ÔÑ•áĞµáÌˆ¼ø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É¥É¥µ½±Ì´Ä…À´Ä¸Ôˆø(€€€€€€€€€€€€€€€ì¡½¹™¥œ¹‰Õ¹‘±”É¹ñğU1Q}	U91É9¤¹™¥±Ñ•È¡Øôø…µ½‰¥±•	Õ¹‘±•M•…É ¹ÑÉ¥´ ¥ññMÑÉ¥¹œ¡Ø¹±…‰•±ñğœœ¤¹Ñ½1½İ•É…Í” ¤¹¥¹±Õ‘•Ì¡µ½‰¥±•	Õ¹‘±•M•…É ¹ÑÉ¥´ ¤¹Ñ½1½İ•É…Í” ¤¤¤¹µ…À¡Øôùì(€€€€€€€€€€€€€€€€€½¹ÍĞÍ•±•Ñ•õµ½‰¥±•	Õ¹‘±”É¹‘-•åÌ¹¥¹±Õ‘•Ì¡Ø¹­•ä¤ì(€€€€€€€€€€€€€€€€€½¹ÍĞ‰Õ¹‘±•Y…Í-•åÌõµ½‰¥±•	Õ¹‘±•Y…Í5…ÁmØ¹­•åuññmtì(€€€€€€€€€€€€€€€€€É•ÑÕÉ¸€ñ‘¥Ø­•äõíØ¹­•åô±…ÍÍ9…µ”õíÉ½Õ¹‘•µá°‰½É‘•È€‘íÍ•±•Ñ•ü‰œµÙ¥½±•Ğ´ÔÀ‰½É‘•ÈµÙ¥½±•Ğ´ÈÀÀœè‰œµİ¡¥Ñ”‰½É‘•ÈµÉ…ä´ÄÀÀõôø(€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùÍ•Ñ5½‰¥±•	Õ¹‘±”É¹‘-•åÌ¡ÁÉ•Øôùì(€€€€€€€€€€€€€€€€€€€€€¥˜¡ÁÉ•Ø¹¥¹±Õ‘•Ì¡Ø¹­•ä¤¥ì(€€€€€€€€€€€€€€€€€€€€€€€Í•Ñ5½‰¥±•	Õ¹‘±•Y…Í5…À¡´ôùí½¹ÍĞ¸õì¸¸¹µôí‘•±•Ñ”¹mØ¹­•åtíÉ•ÑÕÉ¸¸íô¤ì(€€€€€€€€€€€€€€€€€€€€€€€Í•Ñ5½‰¥±•	Õ¹‘±•M…±•QåÁ•5…À¡´ôùí½¹ÍĞ¸õì¸¸¹µôí‘•±•Ñ”¹mØ¹­•åtíÉ•ÑÕÉ¸¸íô¤ì(€€€€€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸ÁÉ•Ø¹™¥±Ñ•È¡¬ôù¬„ôõØ¹­•ä¤ì(€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€€¥˜¡ÁÉ•Ø¹±•¹Ñ øôÈ¥ìÍ¡½İÁÁQ½…ÍĞ œÉ9ƒ¶2C®“®*Pƒ²Ös®2 €ËªÂsªæ3² ƒ²ƒ¶w¶V€ƒ²"`ƒ²z#²ZÓ²jP¸œ±íÑ½¹”è¥¹™¼ô¤ìÉ•ÑÕÉ¸ÁÉ•Øìô(€€€€€€€€€€€€€€€€€€€€€Í•Ñ5½‰¥±•	Õ¹‘±•M…±•QåÁ•5…À¡´ôø¡ì¸¸¹´±mØ¹­•åtéµmØ¹­•åuñğ¹½Éµ…°ô¤¤ì(€€€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸l¸¸¹ÁÉ•Ø±Ø¹­•åtì(€€€€€€€€€€€€€€€€€€€ô¥ô±…ÍÍ9…µ”õíÜµ™Õ±°Ñ•áĞµ±•™ĞÁà´ÌÁä´È¸ÔÑ•áĞµáÌ€‘íÍ•±•Ñ•üÑ•áĞµÙ¥½±•Ğ´ÜÀÀœèÑ•áĞµÉ…ä´ØÀÀõôø(€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰™½¹ĞµÍ•µ¥‰½±ˆùíÍ•±•Ñ•üŸŠrL€œèœõíØ¹±…‰•°¹É•Á±…” œÉ9ƒ
Ü€œ°œœ¥ôğ½ÍÁ…¸øñÍÁ…¸±…ÍÍ9…µ”ô‰™±½…ĞµÉ¥¡ĞÑ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀˆø­íİ½¸¡Ø¹É…Ñ”¥ôğ½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€€íÍ•±•Ñ•˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰Áà´ÌÁˆ´Ìˆø(€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µˆ´Èˆø(€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁát™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÉ…ä´ÔÀÀµˆ´Ä¸Ôˆû¶2C®ƒªÖ³®Úğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É¥É¥µ½±Ì´È…À´Ä¸Ôˆø(€€€€€€€€€€€€€€€€€€€€€€€€€ì¡¥ÍM•ÁÑ•µ‰•ÉA½±¥åÑ¥Ù”¡µ½¹Ñ ¤ıml¹½Éµ…°œ°Ÿ²vó®Âc¶2C®t±l‘¥Í½Õ¹Ğœ°Ÿ¶Vƒ²vã¶2C®utéml¹½Éµ…°œ°Ÿ²vó®Âc¶2C®t±l™É•”œ°Ÿ®²Ó®3¶2C®ut¤¹µ…À ¡m­¥¹±±…‰•±t¤ôùì(€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹ÍĞÕÉÉ•¹Ğõµ½‰¥±•	Õ¹‘±•M…±•QåÁ•5…ÁmØ¹­•åuñğ¹½Éµ…°œì(€€€€€€€€€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸€ñ‰ÕÑÑ½¸­•äõí­¥¹‘ôÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùÍ•Ñ5½‰¥±•	Õ¹‘±•M…±•QåÁ•5…À¡ÁÉ•Øôø¡ì¸¸¹ÁÉ•Ø±mØ¹­•åté­¥¹‘ô¤¥ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õíÁä´ÈÉ½Õ¹‘•µ±œ‰½É‘•ÈÑ•áĞµlÄÅÁát™½¹ĞµÍ•µ¥‰½±€‘íÕÉÉ•¹Ğôôõ­¥¹ü¡­¥¹ôôô™É•”ññ­¥¹ôôô‘¥Í½Õ¹Ğœü‰œµ…µ‰•È´ÔÀ‰½É‘•Èµ…µ‰•È´ÌÀÀÑ•áĞµ…µ‰•È´ÜÀÀœè‰œµÙ¥½±•Ğ´ÔÀ‰½É‘•ÈµÙ¥½±•Ğ´ÈÀÀÑ•áĞµÙ¥½±•Ğ´ÜÀÀœ¤è‰œµİ¡¥Ñ”‰½É‘•ÈµÉ…ä´ÄÀÀÑ•áĞµÉ…ä´ÔÀÀõôø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€íÕÉÉ•¹Ğôôõ­¥¹üŸŠrL€œèœõí±…‰•±ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€€€€€€€€ô¥ô(€€€€€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€íl™É•”œ°‘¥Í½Õ¹Ğt¹¥¹±Õ‘•Ì¡µ½‰¥±•	Õ¹‘±•M…±•QåÁ•5…ÁmØ¹­•åuñğ¹½Éµ…°œ¤˜˜(€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´Ä¸ÔÑ•áĞµlÄÁÁát±•…‘¥¹œµÉ•±…á•Ñ•áĞµ…µ‰•È´ÜÀÀ‰œµ…µ‰•È´ÔÀÉ½Õ¹‘•µ±œÁà´È¸ÔÁä´Èˆø(€€€€€€€€€€€€€€€€€€€€€€€€€€€í¥ÍM•ÁÑ•µ‰•ÉA½±¥åÑ¥Ù”¡µ½¹Ñ ¤üŸ¶Vƒ²vã¶2C®“®*Pƒ®ÎÓ¶^`ƒªÂ²zƒ²†ÃªÆĞƒ²Ú§²†Äƒ².p€ÈÀ°ÀÀÃ²nC²vƒ²ªâ'¶VÓ²jP¸œèŸ®²Ó®3¶2C®“®*P€É9ƒ².“²‚
İ-A'®*Pƒ²vã²‚W¶Vc²®0€É9ƒ®Ê#®Nƒ®Â<ƒ²vĞƒ¶j3²ƒ²v`YLƒ²vã²ó¶.Ã®â3®*Pƒ²ªâ'®Bc² ƒ²V+²V²jP¸ô(€€€€€€€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øùô(€€€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁát™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÉ…ä´ÔÀÀµˆ´Ä¸ÔˆùíØ¹±…‰•°¹É•Á±…” œÉ9ƒ
Ü€œ°œœ¥ôƒ²‚®zÔƒ®ÚªÂ²s®æ²*ƒ
Üƒ®Î×²"`ƒ²ƒ¶tƒªÂ®*”ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É¥É¥µ½±Ì´Ä…À´Äˆø(€€€€€€€€€€€€€€€€€€€€€€€íl¸¸¹…±±½İ•‘M•½¹‘Y…Ì¡½¹™¥œ¹Ù…ÌñğU1Q}YL¤±í­•äèÙ…Í9½¹”œ±±…‰•°èŸ®¾ã²rƒ²æ`œ±É…Ñ”èÁõt¹µ…À¡Ù…Ìôùì(€€€€€€€€€€€€€€€€€€€€€€€€€½¹ÍĞÙ…ÍM•±•Ñ•õ‰Õ¹‘±•Y…Í-•åÌ¹¥¹±Õ‘•Ì¡Ù…Ì¹­•ä¤ì(€€€€€€€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸€ñ‰ÕÑÑ½¸­•äõíÙ…Ì¹­•åôÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùÍ•Ñ5½‰¥±•	Õ¹‘±•Y…Í5…À¡ÁÉ•Øôùì(€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹ÍĞÕÉÉ•¹ĞõÁÉ•ÙmØ¹­•åuññmtì(€€€€€€€€€€€€€€€€€€€€€€€€€€€±•Ğ¹•áĞì(€€€€€€€€€€€€€€€€€€€€€€€€€€€¥˜¡Ù…Ì¹­•äôôôÙ…Í9½¹”œ¤¹•áĞõÙ…ÍM•±•Ñ•ımtélÙ…Í9½¹”tì(€€€€€€€€€€€€€€€€€€€€€€€€€€€•±Í•ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹ÍĞ±•…¸õÕÉÉ•¹Ğ¹™¥±Ñ•È¡¬ôù¬„ôôÙ…Í9½¹”œ¤ì(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹•áĞõÙ…ÍM•±•Ñ•ı±•…¸¹™¥±Ñ•È¡¬ôù¬„ôõÙ…Ì¹­•ä¤él¸¸¹±•…¸±Ù…Ì¹­•åtì(€€€€€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸ì¸¸¹ÁÉ•Ø±mØ¹­•åté¹•áÑôì(€€€€€€€€€€€€€€€€€€€€€€€€€ô¥ô±…ÍÍ9…µ”õíÑ•áĞµ±•™ĞÁà´È¸ÔÁä´ÈÉ½Õ¹‘•µ±œ‰½É‘•ÈÑ•áĞµlÄÅÁát€‘íÙ…ÍM•±•Ñ•ü‰œµİ¡¥Ñ”‰½É‘•ÈµÙ¥½±•Ğ´ÈÀÀÑ•áĞµÙ¥½±•Ğ´ÜÀÀœè‰œµİ¡¥Ñ”¼àÀ‰½É‘•ÈµÉ…ä´ÄÀÀÑ•áĞµÉ…ä´ØÀÀõôø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰™½¹ĞµÍ•µ¥‰½±ˆùíÙ…ÍM•±•Ñ•üŸŠrL€œèœõíÙ…Ì¹±…‰•±ôğ½ÍÁ…¸ùíÙ…Ì¹É…Ñ”øÀ˜˜ñÍÁ…¸±…ÍÍ9…µ”ô‰™±½…ĞµÉ¥¡ĞÑ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀˆø­íİ½¸¡Ù…Ì¹É…Ñ”¥ôğ½ÍÁ…¸ùô(€€€€€€€€€€€€€€€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€€€€€€ô¥ô(€€€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øùô(€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€ô¥ô(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€ğ½‘¥Øø((€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíµĞ´ĞÉ¥…À´È€‘í•‘¥Ñ¥¹M…±”üÉ¥µ½±Ì´ÈœèÉ¥µ½±Ì´Ìõôø(€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€€€½¹±¥¬õì ¤€ôøì(€€€€€€€€€€€€€€€€€½¹ÍĞ•°õ‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% µ½‰¥±”µ…É”µ½ÁÑ¥½¹Ìœ¤ì(€€€€€€€€€€€€€€€€€¥˜¡•°¥•°¹±…ÍÍ1¥ÍĞ¹Ñ½±” ¡¥‘‘•¸œ¤ì(€€€€€€€€€€€€€€€õô(€€€€€€€€€€€€€€€±…ÍÍ9…µ”õíÁä´È¸ÔÉ½Õ¹‘•µá°‰½É‘•ÈÑ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±€‘íµ½‰¥±•…É•-•åÌ¹±•¹Ñ¡ññµ½‰¥±•ÕÍÑ½µQ¥Ñ±”ü‰œµÙ¥½±•Ğ´ÔÀ‰½É‘•ÈµÙ¥½±•Ğ´ÈÀÀÑ•áĞµÙ¥½±•Ğ´ÜÀÀœè‰œµÉ…ä´ÔÀ‰½É‘•ÈµÉ…ä´ÄÀÀÑ•áĞµÉ…ä´ØÀÀõô(€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€¬ƒªÎƒªÂtƒ²V÷²5íµ½‰¥±•…É•-•åÌ¹±•¹Ñ ı€€‘íµ½‰¥±•…É•-•åÌ¹±•¹Ñ¡õ€èœô(€€€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€í•‘¥Ñ¥¹M…±”˜˜ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùÍ•Ñ5½‰¥±•áÁ•¹Í•=Á•¸¡Øôø…Ø¥ô±…ÍÍ9…µ”õíÁä´È¸ÔÉ½Õ¹‘•µá°‰½É‘•ÈÑ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±€‘íµ½‰¥±•áÁ•¹Í•=Á•¸ü‰œµ•µ•É…±´ÔÀ‰½É‘•Èµ•µ•É…±´ÈÀÀÑ•áĞµ•µ•É…±´ÜÀÀœè‰œµÉ…ä´ÔÀ‰½É‘•ÈµÉ…ä´ÄÀÀÑ•áĞµÉ…ä´ØÀÀõôø¬ƒ²b²^®æ²j¤ğ½‰ÕÑÑ½¸ùô)ì…•‘¥Ñ¥¹M…±”˜˜ ğø(€€€€€€€€€€€€€ì…¥ÍM•ÁÑ•µ‰•ÉA½±¥åÑ¥Ù”¡µ½¹Ñ ¤˜˜ğø(€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€€€½¹±¥¬õì ¤€ôøì(€€€€€€€€€€€€€€€€€½¹ÍĞ•°õ‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% µ½‰¥±”µÍÁ½Ğµ½ÁÑ¥½¹Ìœ¤ì(€€€€€€€€€€€€€€€€€¥˜¡•°¥•°¹±…ÍÍ1¥ÍĞ¹Ñ½±” ¡¥‘‘•¸œ¤ì(€€€€€€€€€€€€€€€õô(€€€€€€€€€€€€€€€±…ÍÍ9…µ”õíÁä´È¸ÔÉ½Õ¹‘•µá°‰½É‘•ÈÑ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±€‘íµ½‰¥±•MÁ½ÑA½±¥å%ü‰œµ½É…¹”´ÔÀ‰½É‘•Èµ½É…¹”´ÈÀÀÑ•áĞµ½É…¹”´ØÀÀœè‰œµÉ…ä´ÔÀ‰½É‘•ÈµÉ…ä´ÄÀÀÑ•áĞµÉ…ä´ØÀÀõô(€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€¬ƒ²*“¶2}íµ½‰¥±•MÁ½ÑA½±¥å%üœƒŠrLœèœô(€€€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€ğ¼ùô(€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€€€½¹±¥¬õì ¤ôùÍ•Ñ5½‰¥±•áÁ•¹Í•=Á•¸¡Øôø…Ø¥ô(€€€€€€€€€€€€€€€±…ÍÍ9…µ”õíÁä´È¸ÔÉ½Õ¹‘•µá°‰½É‘•ÈÑ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±€‘íµ½‰¥±•áÁ•¹Í•=Á•¸ü‰œµ•µ•É…±´ÔÀ‰½É‘•Èµ•µ•É…±´ÈÀÀÑ•áĞµ•µ•É…±´ÜÀÀœè‰œµÉ…ä´ÔÀ‰½É‘•ÈµÉ…ä´ÄÀÀÑ•áĞµÉ…ä´ØÀÀõô(€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€¬ƒ²b²^®æ²j¤(€€€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø((ğ¼ø¥ô€€€€€€€€€€€€ğ½‘¥Øø((€€€€€€€€€€€€ñ‘¥Ø¥ô‰µ½‰¥±”µ…É”µ½ÁÑ¥½¹Ìˆ±…ÍÍ9…µ”ô‰¡¥‘‘•¸µĞ´Ğˆø(€€€€€€€€€€€€€€ñ…É•Q•µÁ±…Ñ•A¥­•È(€€€€€€€€€€€€€€€Í•±•Ñ•õíµ½‰¥±•…É•-•åÍôÍ•ÑM•±•Ñ•õíÍ•Ñ5½‰¥±•…É•-•åÍô(€€€€€€€€€€€€€€€ÕÍÑ½µQ¥Ñ±”õíµ½‰¥±•ÕÍÑ½µQ¥Ñ±•ôÍ•ÑÕÍÑ½µQ¥Ñ±”õíÍ•Ñ5½‰¥±•ÕÍÑ½µQ¥Ñ±•ô(€€€€€€€€€€€€€€€ÕÍÑ½µÕ•…Ñ”õíµ½‰¥±•ÕÍÑ½µÕ•…Ñ•ôÍ•ÑÕÍÑ½µÕ•…Ñ”õíÍ•Ñ5½‰¥±•ÕÍÑ½µÕ•…Ñ•ô(€€€€€€€€€€€€€€€Ñ…É•ÑA±…¸õíµ½‰¥±•Q…É•ÑA±…¹ôÍ•ÑQ…É•ÑA±…¸õíÍ•Ñ5½‰¥±•Q…É•ÑA±…¹ô(€€€€€€€€€€€€€€€Á…åµ•¹Ñ¥ÉÍÑ…Ñ”õíµ½‰¥±•A…åµ•¹Ñ¥ÉÍÑ…Ñ•ôÍ•ÑA…åµ•¹Ñ¥ÉÍÑ…Ñ”õíÍ•Ñ5½‰¥±•A…åµ•¹Ñ¥ÉÍÑ…Ñ•ô(€€€€€€€€€€€€€€€Á…åµ•¹Ñ½Õ¹Ğõíµ½‰¥±•A…åµ•¹Ñ½Õ¹ÑôÍ•ÑA…åµ•¹Ñ½Õ¹ĞõíÍ•Ñ5½‰¥±•A…åµ•¹Ñ½Õ¹Ñô(€€€€€€€€€€€€€€€…™™¥±¥…Ñ•…Éõíµ½‰¥±•™™¥±¥…Ñ•…É‘ôÍ•Ñ™™¥±¥…Ñ•…ÉõíÍ•Ñ5½‰¥±•™™¥±¥…Ñ•…É‘ô(€€€€€€€€€€€€€€€Í…±•…Ñ”õí€‘íµ½¹Ñ¡ô´‘íÍ•±•Ñ•‘…åõô(€€€€€€€€€€€€€€¼ø(€€€€€€€€€€€€€íµ½‰¥±•áÑÉ…AÉ½µ¥Í•Ì¹µ…À ¡à±¤¤ôøñ‘¥Ø­•äõí¥ô±…ÍÍ9…µ”ô‰µĞ´ÈÉ¥É¥µ½±ÌµlÅ™É}…ÕÑ½t…À´Èˆøñ‘¥Øøñ¥¹ÁÕĞÙ…±Õ”õíà¹Ñ¥Ñ±•ô½¹¡…¹”õí”ôùÍ•Ñ5½‰¥±•áÑÉ…AÉ½µ¥Í•Ì¡„ôù„¹µ…À ¡Ø±¨¤ôù¨ôôõ¤ıì¸¸¹Ø±Ñ¥Ñ±”é”¹Ñ…É•Ğ¹Ù…±Õ•ôéØ¤¥ôÁ±…•¡½±‘•Èô‹²ÚSªÂ ƒ²V÷²4ƒ®
Ó²j¤ˆ±…ÍÍ9…µ”ô‰Üµ™Õ±°‰½É‘•ÈÉ½Õ¹‘•µ±œÁà´ÌÁä´ÈÑ•áĞµáÌˆ¼øñ¥¹ÁÕĞÑåÁ”ô‰‘…Ñ”ˆÙ…±Õ”õíà¹‘Õ•…Ñ•ô½¹¡…¹”õí”ôùÍ•Ñ5½‰¥±•áÑÉ…AÉ½µ¥Í•Ì¡„ôù„¹µ…À ¡Ø±¨¤ôù¨ôôõ¤ıì¸¸¹Ø±‘Õ•…Ñ”é”¹Ñ…É•Ğ¹Ù…±Õ•ôéØ¤¥ô±…ÍÍ9…µ”ô‰µĞ´ÄÜµ™Õ±°‰½É‘•ÈÉ½Õ¹‘•µ±œÁà´ÌÁä´ÈÑ•áĞµáÌˆ¼øğ½‘¥Øøñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùÍ•Ñ5½‰¥±•áÑÉ…AÉ½µ¥Í•Ì¡„ôù„¹™¥±Ñ•È ¡|±¨¤ôù¨„ôõ¤¤¥ô±…ÍÍ9…µ”ô‰Ñ•áĞµÉ•´ĞÀÀÑ•áĞµáÌˆû²
·²‚pğ½‰ÕÑÑ½¸øğ½‘¥Øø¥ô(€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùÍ•Ñ5½‰¥±•áÑÉ…AÉ½µ¥Í•Ì¡„ôùl¸¸¹„±íÑ¥Ñ±”èœœ±‘Õ•…Ñ”èœõt¥ô±…ÍÍ9…µ”ô‰µĞ´ÈÑ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÙ¥½±•Ğ´ØÀÀˆø¬ƒ²V÷²4ƒ²ÚSªÂ ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€ğ½‘¥Øø((€€€€€€€€€€€ì…•‘¥Ñ¥¹M…±”˜˜…¥ÍM•ÁÑ•µ‰•ÉA½±¥åÑ¥Ù”¡µ½¹Ñ ¤˜˜ñ‘¥Ø¥ô‰µ½‰¥±”µÍÁ½Ğµ½ÁÑ¥½¹Ìˆ±…ÍÍ9…µ”ô‰¡¥‘‘•¸µĞ´ĞÉ½Õ¹‘•µá°‰½É‘•È‰½É‘•Èµ½É…¹”´ÄÀÀ‰œµ½É…¹”´ÔÀ¼ĞÀÀ´Ìˆø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÉ…ä´ÜÀÀµˆ´ÈˆûÂ~R”ƒ²*“¶2|ƒ²ÚSªÂ ƒ²vã²ó¶.Ã®â0ğ½‘¥Øø(€€€€€€€€€€€€€íµ½‰¥±•MÁ½ÑA½±¥¥•Ì¹±•¹Ñ øÀ˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰ÍÁ…”µä´Ä¸Ôˆø(€€€€€€€€€€€€€€€íµ½‰¥±•MÁ½ÑA½±¥¥•Ì¹µ…À¡Àôøñ‰ÕÑÑ½¸­•äõíÀ¹¥‘ôÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùíÍ•Ñ5½‰¥±•MÁ½ÑA½±¥å%¡À¹¥¤íÍ•Ñ5½‰¥±•MÁ½Ñ¥É•Ñ=Á•¸¡™…±Í”¥õô(€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õíÜµ™Õ±°Ñ•áĞµ±•™ĞÁà´ÌÁä´ÈÉ½Õ¹‘•µ±œÑ•áĞµáÌ‰½É‘•È€‘íµ½‰¥±•MÁ½ÑA½±¥å%ôôõÀ¹¥ü‰œµİ¡¥Ñ”‰½É‘•Èµ½É…¹”´ÌÀÀÑ•áĞµ½É…¹”´ÜÀÀœè‰œµİ¡¥Ñ”¼ÜÀ‰½É‘•ÈµÑÉ…¹ÍÁ…É•¹ĞÑ•áĞµÉ…ä´ØÀÀõôø(€€€€€€€€€€€€€€€€€€ñˆùíµ½‰¥±•MÁ½ÑA½±¥å%ôôõÀ¹¥üŸŠrL€œèœõíÀ¹Ñ¥Ñ±•ôğ½ˆøñÍÁ…¸±…ÍÍ9…µ”ô‰™±½…ĞµÉ¥¡Ğˆø­íİ½¸¡À¹…µ½Õ¹Ğ¥ôğ½ÍÁ…¸ø(€€€€€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø¥ô(€€€€€€€€€€€€€€ğ½‘¥Øùô(€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùíÍ•Ñ5½‰¥±•MÁ½ÑA½±¥å% œœ¤íÍ•Ñ5½‰¥±•MÁ½Ñ¥É•Ñ=Á•¸¡Øôø…Ø¥õô(€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰Üµ™Õ±°µĞ´ÈÁà´ÌÁä´ÈÉ½Õ¹‘•µ±œÑ•áĞµ±•™ĞÑ•áĞµáÌ™½¹Ğµ‰½±‰œµ½É…¹”´ÄÀÀ¼ÜÀÑ•áĞµ½É…¹”´ÜÀÀˆø(€€€€€€€€€€€€€€€€¬ƒ²*“¶2|ƒ²²‚Dƒ²z®‚”(€€€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€íµ½‰¥±•MÁ½Ñ¥É•Ñ=Á•¸˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰ÍÁ…”µä´ÈµĞ´Èˆø(€€€€€€€€€€€€€€€€ñ¥¹ÁÕĞÙ…±Õ”õíµ½‰¥±•MÁ½Ñ¥É•ÑQ¥Ñ±•ô½¹¡…¹”õí”ôùÍ•Ñ5½‰¥±•MÁ½Ñ¥É•ÑQ¥Ñ±”¡”¹Ñ…É•Ğ¹Ù…±Õ”¥ôÁ±…•¡½±‘•Èô‹²‚W²Æ®ªˆ±…ÍÍ9…µ”ô‰Üµ™Õ±°‰½É‘•ÈÉ½Õ¹‘•µ±œÀ´ÈÑ•áĞµáÌ‰œµİ¡¥Ñ”ˆ¼ø(€€€€€€€€€€€€€€€€ñ¥¹ÁÕĞÙ…±Õ”õí™µÑ%¹ÁÕÑ9Õµ‰•È¡µ½‰¥±•MÁ½Ñ¥É•Ñµ½Õ¹Ğ¥ô½¹¡…¹”õí”ôùÍ•Ñ5½‰¥±•MÁ½Ñ¥É•Ñµ½Õ¹Ğ¡”¹Ñ…É•Ğ¹Ù…±Õ”¹É•Á±…” ½q½œ°œœ¤¥ôÁ±…•¡½±‘•Èô‹²ÚSªÂ ƒªâ#²V„ˆ±…ÍÍ9…µ”ô‰Üµ™Õ±°‰½É‘•ÈÉ½Õ¹‘•µ±œÀ´ÈÑ•áĞµáÌ‰œµİ¡¥Ñ”ˆ¼ø(€€€€€€€€€€€€€€€€ñ¥¹ÁÕĞÙ…±Õ”õíµ½‰¥±•MÁ½Ñ¥É•Ñ5•µ½ô½¹¡…¹”õí”ôùÍ•Ñ5½‰¥±•MÁ½Ñ¥É•Ñ5•µ¼¡”¹Ñ…É•Ğ¹Ù…±Õ”¥ôÁ±…•¡½±‘•Èô‹®¦S®ª €£²ƒ¶t¤ˆ±…ÍÍ9…µ”ô‰Üµ™Õ±°‰½É‘•ÈÉ½Õ¹‘•µ±œÀ´ÈÑ•áĞµáÌ‰œµİ¡¥Ñ”ˆ¼ø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀˆûªÒ®š³²zCªÂ ƒ¶fW²vã
ß²"c²‚Tƒ¶nƒ²*ç²vã¶Vc®¦Ğƒ®Âc²b®>ó²jP¸ğ½‘¥Øø(€€€€€€€€€€€€€€ğ½‘¥Øùô(€€€€€€€€€€€€€íµ½‰¥±•MÁ½ÑA½±¥¥•Ì¹±•¹Ñ ôôôÀ˜˜…µ½‰¥±•MÁ½Ñ¥É•Ñ=Á•¸˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ…ä´ĞÀÀµĞ´Èˆû®NÇ®†w®Bpƒ²‚W²Æ²vĞƒ²^²ZÓ²jP¸ƒ²²‚Dƒ²z®‚—¶VÓ²ó²ã²jP¸ğ½‘¥Øùô(€€€€€€€€€€€€ğ½‘¥Øùô(((€€€€€€€€€€€íµ½‰¥±•áÁ•¹Í•=Á•¸€˜˜€ (€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´ĞÉ½Õ¹‘•µá°‰½É‘•È‰½É‘•Èµ•µ•É…±´ÄÀÀ‰œµ•µ•É…±´ÔÀ¼ÌÀÀ´Ìˆø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÉ…ä´ÜÀÀµˆ´ÈˆûÂ~JÌƒ²vĞƒªÎƒªÂw²^CªÊ0ƒ²
³²j§¶Vpƒ²b²^®æ²j¤ğ½‘¥Øø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É¥É¥µ½±Ì´È…À´Èˆø(€€€€€€€€€€€€€€€€€€ñÍ•±•ĞÙ…±Õ”õíµ½‰¥±•áÁ•¹Í•…Ñ•½Éåô½¹¡…¹”õí”ôùÍ•Ñ5½‰¥±•áÁ•¹Í•…Ñ•½Éä¡”¹Ñ…É•Ğ¹Ù…±Õ”¥ô(€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰‰½É‘•ÈÉ½Õ¹‘•µ±œÁà´ÈÁä´ÈÑ•áĞµáÌ‰œµİ¡¥Ñ”ˆø(€€€€€€€€€€€€€€€€€€€€ñ½ÁÑ¥½¸û²ò²vÓ²*ğ½½ÁÑ¥½¸øñ½ÁÑ¥½¸û²b“¶6ğğ½½ÁÑ¥½¸øñ½ÁÑ¥½¸û¶2C²Ò$ğ½½ÁÑ¥½¸øñ½ÁÑ¥½¸ûªâÃ¶ ğ½½ÁÑ¥½¸ø(€€€€€€€€€€€€€€€€€€ğ½Í•±•Ğø(€€€€€€€€€€€€€€€€€€ñ¥¹ÁÕĞ¥¹ÁÕÑ5½‘”ô‰¹Õµ•É¥ŒˆÙ…±Õ”õí™µÑ%¹ÁÕÑ9Õµ‰•È¡µ½‰¥±•áÁ•¹Í•µ½Õ¹Ğ¥ô(€€€€€€€€€€€€€€€€€€€½¹¡…¹”õí”ôùÍ•Ñ5½‰¥±•áÁ•¹Í•µ½Õ¹Ğ¡”¹Ñ…É•Ğ¹Ù…±Õ”¹É•Á±…” ½q½œ°œœ¤¥ô(€€€€€€€€€€€€€€€€€€€Á±…•¡½±‘•Èô‹ªâ#²V„ˆ±…ÍÍ9…µ”ô‰‰½É‘•ÈÉ½Õ¹‘•µ±œÁà´ÈÁä´ÈÑ•áĞµáÌ‰œµİ¡¥Ñ”ˆ¼ø(€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€ñ¥¹ÁÕĞÙ…±Õ”õíµ½‰¥±•áÁ•¹Í•5•µ½ô½¹¡…¹”õí”ôùÍ•Ñ5½‰¥±•áÁ•¹Í•5•µ¼¡”¹Ñ…É•Ğ¹Ù…±Õ”¥ô(€€€€€€€€€€€€€€€€€Á±…•¡½±‘•Èô‹®¦S®ª €£²ƒ¶t¤ˆ±…ÍÍ9…µ”ô‰µĞ´ÈÜµ™Õ±°‰½É‘•ÈÉ½Õ¹‘•µ±œÁà´ÈÁä´ÈÑ•áĞµáÌ‰œµİ¡¥Ñ”ˆ¼ø(€€€€€€€€€€€€€€€íµ½‰¥±•áÑÉ…áÁ•¹Í•Ì¹µ…À ¡à±¤¤ôøñ‘¥Ø­•äõí¥ô±…ÍÍ9…µ”ô‰µĞ´È‰½É‘•ÈµĞÁĞ´Èˆøñ‘¥Ø±…ÍÍ9…µ”ô‰É¥É¥µ½±Ì´È…À´ÈˆøñÍ•±•ĞÙ…±Õ”õíà¹…Ñ•½Éåô½¹¡…¹”õí”ôùÍ•Ñ5½‰¥±•áÑÉ…áÁ•¹Í•Ì¡„ôù„¹µ…À ¡Ø±¨¤ôù¨ôôõ¤ıì¸¸¹Ø±…Ñ•½Éäé”¹Ñ…É•Ğ¹Ù…±Õ•ôéØ¤¥ô±…ÍÍ9…µ”ô‰‰½É‘•ÈÉ½Õ¹‘•Áà´ÈÁä´ÈÑ•áĞµáÌˆøñ½ÁÑ¥½¸û²b“¶6ğğ½½ÁÑ¥½¸øñ½ÁÑ¥½¸û²ò²vÓ²*ğ½½ÁÑ¥½¸øñ½ÁÑ¥½¸ûªÎƒªÂtƒ²
³²v¶J ğ½½ÁÑ¥½¸øñ½ÁÑ¥½¸û¶2C²Ò$ğ½½ÁÑ¥½¸øñ½ÁÑ¥½¸ûªâÃ¶ ğ½½ÁÑ¥½¸øğ½Í•±•Ğøñ¥¹ÁÕĞÙ…±Õ”õí™µÑ%¹ÁÕÑ9Õµ‰•È¡à¹…µ½Õ¹Ğ¥ô½¹¡…¹”õí”ôùÍ•Ñ5½‰¥±•áÑÉ…áÁ•¹Í•Ì¡„ôù„¹µ…À ¡Ø±¨¤ôù¨ôôõ¤ıì¸¸¹Ø±…µ½Õ¹Ğé”¹Ñ…É•Ğ¹Ù…±Õ”¹É•Á±…” ½q½œ°œœ¥ôéØ¤¥ôÁ±…•¡½±‘•Èô‹ªâ#²V„ˆ±…ÍÍ9…µ”ô‰‰½É‘•ÈÉ½Õ¹‘•Áà´ÈÁä´ÈÑ•áĞµáÌˆ¼øğ½‘¥Øøñ¥¹ÁÕĞÙ…±Õ”õíà¹µ•µ½ô½¹¡…¹”õí”ôùÍ•Ñ5½‰¥±•áÑÉ…áÁ•¹Í•Ì¡„ôù„¹µ…À ¡Ø±¨¤ôù¨ôôõ¤ıì¸¸¹Ø±µ•µ¼é”¹Ñ…É•Ğ¹Ù…±Õ•ôéØ¤¥ôÁ±…•¡½±‘•Èô‹®¦S®ª ˆ±…ÍÍ9…µ”ô‰µĞ´ÄÜµ™Õ±°‰½É‘•ÈÉ½Õ¹‘•Áà´ÈÁä´ÈÑ•áĞµáÌˆ¼øñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùÍ•Ñ5½‰¥±•áÑÉ…áÁ•¹Í•Ì¡„ôù„¹™¥±Ñ•È ¡|±¨¤ôù¨„ôõ¤¤¥ô±…ÍÍ9…µ”ô‰µĞ´ÄÑ•áĞµlÄÁÁátÑ•áĞµÉ•´ĞÀÀˆû²vĞƒ®æ²j¤ƒ²
·²‚pğ½‰ÕÑÑ½¸øğ½‘¥Øø¥ô(€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùÍ•Ñ5½‰¥±•áÑÉ…áÁ•¹Í•Ì¡„ôùl¸¸¹„±í…Ñ•½ÉäèŸªÎƒªÂtƒ²
³²v¶J œ±…µ½Õ¹Ğèœœ±µ•µ¼èœõt¥ô±…ÍÍ9…µ”ô‰µĞ´ÈÑ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±Ñ•áĞµ•µ•É…±´ÜÀÀˆø¬ƒ²b²^®æ²j¤ƒ²ÚSªÂ ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀµĞ´ÄˆûªÎƒªÂw®ªªÎğƒ¶2C®“²vó²v ƒ²zC®>g²ró®†pƒ²^ÃªÊÃ®>ó²jP¸ğ½‘¥Øø(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€¥ô(€€€€€€€€€€€€ğ¼ùô((€€€€€€€€€€€í•‘¥Ñ¥¹M…±”˜˜ (€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´ĞÉ½Õ¹‘•µá°‰œµÙ¥½±•Ğ´ÔÀÁà´ÌÁä´È¸ÔÑ•áĞµlÄÅÁátÑ•áĞµÙ¥½±•Ğ´ÜÀÀˆø(€€€€€€€€€€€€€€€ƒªÂ²zªÖ³®Ú
ß²jSªâ#²‚sªÖÃ
İYO
ßªÎƒªÂtƒ²V÷²7²vƒ¶V£ªî`ƒ²"c²‚W¶VÓ²jP¸(€€€€€€€€€€€€€€€í•‘¥Ñ¥¹½µÁ±•Ñ•‘Q…Í­½Õ¹ĞøÀ˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´Ä™½¹ĞµÍ•µ¥‰½±ˆû²vÓ®¾àƒ²f®3®Bpƒ²V÷²4í•‘¥Ñ¥¹½µÁ±•Ñ•‘Q…Í­½Õ¹Ñ÷ªÆÓ²v ƒªŞã®2®†pƒ²rƒ²®B§®.#®.¸ğ½‘¥Øùô(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´ÄÑ•áĞµÙ¥½±•Ğ´ÔÀÀˆûªâÃ²†Ğƒ²*“¶2²v ƒ²rƒ²®BcªÎ€°ƒ²b²^®æ²j§ªÎğƒªÎƒªÂw²V÷²7²v ƒ¶V£ªî`ƒ²"c²‚W¶V€ƒ²"`ƒ²z#²ZÓ²jP¸ğ½‘¥Øø(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€¥ô((€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰ÍÑ¥­ä€µ‰½ÑÑ½´´ÔµĞ´Ô€µµà´ÔÁà´ÔÁĞ´ÌÁˆ´Ô‰œµİ¡¥Ñ”¼äÔ‰…­‘É½Àµ‰±ÕÈ‰½É‘•ÈµĞ‰½É‘•ÈµÉ…ä´ÄÀÀÍ¡…‘½ÜµlÁ|´áÁá|ÈÁÁá}É‰„ À°À°À°À¸ÀĞ¥tˆø(€€€€€€€€€€€€€íµ½‰¥±•AÉ•Ù¥•Ü˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰µˆ´È¸ÔÉ½Õ¹‘•µá°‰œµÙ¥½±•Ğ´ÔÀ‰½É‘•È‰½É‘•ÈµÙ¥½±•Ğ´ÄÀÀÁà´ÌÁä´È¸Ôˆø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁát™½¹Ğµ‰½±Ñ•áĞµÙ¥½±•Ğ´ÜÀÀÑÉÕ¹…Ñ”ˆùí€‘íµ½¹Ñ¡ô´‘íÍ•±•Ñ•‘…åõôƒ
Üíµ½‰¥±•ÕÍÑ½µ•É9…µ”¹ÑÉ¥´ ¥ñğŸªÎƒªÂw®ªƒ®¾ã²z®‚”ôƒ
Üíµ½‰¥±•M…±•É…™Ğ¹±…‰•±õíµ½‰¥±•AÉ•Ù¥•Ü¹Í•½¹‘1…‰•±Ì¹±•¹Ñ ı€ƒ
Ü€É9€‘íµ½‰¥±•AÉ•Ù¥•Ü¹Í•½¹‘1…‰•±Ì¹©½¥¸ œ°€œ¥õ€èœôğ½‘¥Øø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlåÁátÑ•áĞµÙ¥½±•Ğ´ÔÀÀµĞ´ÄÑÉÕ¹…Ñ”ˆùíµ½‰¥±•AÉ•Ù¥•Ü¹Ù…Í1…‰•±Ì¹±•¹Ñ ıYL€‘íµ½‰¥±•AÉ•Ù¥•Ü¹Ù…Í1…‰•±Ì¹©½¥¸ œ°€œ¥õ€èYLƒ®¾ã²rƒ²æ`õíµ½‰¥±•AÉ•Ù¥•Ü¹ÁÉ½µ¥Í•½Õ¹Ğı€ƒ
ÜƒªÎƒªÂw²V÷²4€‘íµ½‰¥±•AÉ•Ù¥•Ü¹ÁÉ½µ¥Í•½Õ¹Ñ÷ªÆÑ€èœôğ½‘¥Øø(€€€€€€€€€€€€€€€í•‘¥Ñ¥¹M…±”˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´Ä¸ÔÉ½Õ¹‘•µ±œ‰œµİ¡¥Ñ”¼ÜÀÁà´ÈÁä´Ä¸ÔÑ•áĞµlÄÁÁátÑ•áĞµÙ¥½±•Ğ´ÜÀÀˆøñˆû®ÎªÊôƒ²‚¶nğ½ˆøƒ
Üí•‘¥Ñ¥¹M…±”¹µ•ÑÉ¥}±…‰•±ñğŸªâÃ²†Ğƒ¶2C®ôƒŠHíµ½‰¥±•M…±•É…™Ğ¹±…‰•±ôğ½‘¥Øùô(€€€€€€€€€€€€€€€ì…•‘¥Ñ¥¹M…±”˜˜ğø(€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´ÈÑ•áĞµÍ´™½¹Ğµ‰±…¬Ñ•áĞµ•µ•É…±´ÜÀÀˆû²vÓ®Ê ƒ¶2C®ƒ²Òt€­íİ½¸¡µ½‰¥±•AÉ•Ù¥•Ü¹¥¹•¹Ñ¥Ù”¥ôğ½‘¥Øø(€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´ÈÉ¥É¥µ½±Ì´Ì…À´Ä¸Ôˆø(€€€€€€€€€€€€€€€€€€€ímlŸ²ÇªÎñ@œ±µ½‰¥±•AÉ•Ù¥•Ü¹Á½¥¹ÑÍt±lŸ²w²
Ã²Äœ±µ½‰¥±•AÉ•Ù¥•Ü¹ÁÉ½‘ÕÑ¥Ù¥Ñåt±lŸ²‚®zÕ@œ±µ½‰¥±•AÉ•Ù¥•Ü¹ÍÑÉ…Ñ•¥A½¥¹ÑÍut¹µ…À ¡m±…‰•°±Ù…±Õ•t¤ôøñ‘¥Ø­•äõí±…‰•±ô±…ÍÍ9…µ”ô‰É½Õ¹‘•µ±œ‰œµİ¡¥Ñ”¼àÀÁà´ÈÁä´Ä¸ÔÑ•áĞµ•¹Ñ•Èˆøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlåÁátÑ•áĞµÙ¥½±•Ğ´ĞÀÀˆùí±…‰•±ôğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÅÁát™½¹Ğµ‰½±Ñ•áĞµÙ¥½±•Ğ´ÜÀÀˆø­í™µÑ9Õ´¡Ù…±Õ”°Ä¥õ@ğ½‘¥Øøğ½‘¥Øø¥ô(€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùÍ•Ñ5½‰¥±•…±=Á•¸¡Øôø…Ø¥ô±…ÍÍ9…µ”ô‰µĞ´ÈÜµ™Õ±°Ñ•áĞµlÄÁÁát™½¹Ğµ‰½±Ñ•áĞµÙ¥½±•Ğ´ÜÀÀˆùíµ½‰¥±•…±=Á•¸üŸªÎ²
ÀƒªŞóªÆÀƒ®.¯ªâÀƒŠZÈœèŸªâ#²V„ƒªÎ²
ÀƒªŞóªÆÀƒ®ÎÓªâÀƒŠZğôğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€íµ½‰¥±•…±=Á•¸˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´ÈÉ½Õ¹‘•µ±œ‰œµİ¡¥Ñ”¼àÀÁà´È¸ÔÁä´ÈÍÁ…”µä´Äˆø(€€€€€€€€€€€€€€€€€€€íµ½‰¥±•AÉ•Ù¥•Ü¹…±Õ±…Ñ¥½¹1¥¹•Ì¹µ…À ¡m±…‰•°±…µ½Õ¹Ñt±¤¤ôøñ‘¥Ø­•äõí¥ô±…ÍÍ9…µ”ô‰™±•à©ÕÍÑ¥™äµ‰•Ñİ••¸…À´ÈÑ•áĞµlåÁátˆøñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµÉ…ä´ÔÀÀˆùí±…‰•±ôğ½ÍÁ…¸øñˆ±…ÍÍ9…µ”õí9Õµ‰•È¡…µ½Õ¹Ğ¤ğÀüÑ•áĞµÉ•´ÔÀÀœèÑ•áĞµÙ¥½±•Ğ´ÜÀÀôùí…µ½Õ¹Ğôôõ¹Õ±°üŸ²ƒ¶tƒ®Âc²bœé€‘í9Õµ‰•È¡…µ½Õ¹Ğ¤øÀüœ¬œèœô‘íİ½¸¡…µ½Õ¹Ğ¥õôğ½ˆøğ½‘¥Øø¥ô(€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰ÁĞ´Ä‰½É‘•ÈµĞ‰½É‘•ÈµÙ¥½±•Ğ´ÄÀÀÑ•áĞµlåÁát±•…‘¥¹œµÉ•±…á•Ñ•áĞµÉ…ä´ĞÀÀˆû¶f ƒ².“²‚
ß²‚®z×¶>³²vã¶*àƒ®æ²’G²v ƒ²nS²’Dƒ¶b²z°ƒ²¶s®†pƒªÎ²
Ã¶Vpƒ²b#²²æc²b#²jP¸ƒ²vÓ¶nƒ²‚W²ƒªâÃ²’²vƒ²Ú§²†Ç¶Vc®¦Ğƒ²vÓ²‚ƒ².“²‚²vƒ¶>³¶V£¶VĞƒ®.“².pƒªÎ²
Ã®Bc®¦À°ƒ²‚W²
Àƒ².pƒ²Ös²Šƒ®Âc²b²V‡²v ƒ®.³®vó² ƒ²"`ƒ²z#²*×®.#®.¸ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€ğ½‘¥Øùô(€€€€€€€€€€€€€€€€ğ¼ùô(€€€€€€€€€€€€€€ğ½‘¥Øùô(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É¥É¥µ½±Ì´È…À´Èˆø(€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤ôùíÍ•Ñ5½‰¥±•M…±•É…™Ğ¡¹Õ±°¤íÍ•Ñ‘¥Ñ¥¹M…±”¡¹Õ±°¤íÍ•Ñ‘¥Ñ¥¹½µÁ±•Ñ•‘Q…Í­½Õ¹Ğ À¥õô‘¥Í…‰±•õíµ½‰¥±•M…±•M…Ù¥¹ô(€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰Áä´È¸ÔÉ½Õ¹‘•µá°‰œµÉ…ä´ÄÀÀÑ•áĞµÉ…ä´ÔÀÀÑ•áĞµÍ´™½¹ĞµÍ•µ¥‰½±ˆû²Ş£²0ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õíÍÕ‰µ¥Ñ5½‰¥±•M…±•ô‘¥Í…‰±•õíµ½‰¥±•M…±•M…Ù¥¹ñğ…µ½‰¥±•ÕÍÑ½µ•É9…µ”¹ÑÉ¥´ ¥ñğ…µ½‰¥±•M…±•-¥¹‘ñğ…9Õµ‰•È¹¥Í%¹Ñ••È¡µ½‰¥±•M…±•É…™Ğ¹É¤¥ñğ…9Õµ‰•È¹¥Í%¹Ñ••È¡µ½‰¥±•M…±•É…™Ğ¹¤¥ô(€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰Áä´È¸ÔÉ½Õ¹‘•µá°‰œµÙ¥½±•Ğ´ØÀÀÑ•áĞµİ¡¥Ñ”Ñ•áĞµÍ´™½¹Ğµ‰½±‘¥Í…‰±•é½Á…¥Ñä´ÔÀˆø(€€€€€€€€€€€€€€€€€íµ½‰¥±•M…±•M…Ù¥¹œü¡•‘¥Ñ¥¹M…±”üŸ²"c²‚Tƒ²’D¸¸¸œèŸ¶2C®“ªÆĞƒ®NÇ®†tƒ²’D¸¸¸œ¤è¡•‘¥Ñ¥¹M…±”üŸ²"c²‚Tƒ²‚²z”œèŸ².“²‚ƒ®NÇ®†tœ¥ô(€€€€€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€ğ½‘¥Øø(€€€€€€¥ô((€€€€€í¡½µ•=É‘•ÉÉ…™Ğ€˜˜€ (€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™¥á•¥¹Í•Ğ´Àè´ÔÀ‰œµ‰±…¬¼ĞÀ™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ•¹Ñ•ÈÀ´Ğˆø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Üµ™Õ±°µ…àµÜµÍ´‰œµİ¡¥Ñ”É½Õ¹‘•´Íá°À´ÔÍ¡…‘½Ü´Éá°µ…àµ µläÁÙ¡t½Ù•É™±½Üµäµ…ÕÑ¼ˆø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÙ¥½±•Ğ´ÔÀÀ™½¹ĞµÍ•µ¥‰½±ˆû¶Vpƒ®Ê#²^@ƒ¶f ƒ¶2C®ƒ®NÇ®†tğ½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµ±œ™½¹Ğµ‰½±Ñ•áĞµÉ…ä´äÀÀµĞ´Äˆû¶f ƒ².“²‚ƒ²z®‚”ğ½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ…ä´ĞÀÀµĞ´Äˆùíµ½¹Ñ¡ôµíÍ•±•Ñ•‘…åôƒ²‚G²"`ğ½‘¥Øø(€€€€€€€€€€€ì…¡½µ•=É‘•ÉÉ…™Ğü¹•‘¥Ñ¥¹œ˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´ÈÉ½Õ¹‘•µá°‰œµ‰±Õ”´ÔÀ‰½É‘•È‰½É‘•Èµ‰±Õ”´ÄÀÀÁà´ÌÁä´ÈÑ•áĞµlÄÁÁátÑ•áĞµ‰±Õ”´ÜÀÀˆû¶V·®ª¤ƒ²ƒ¶w®3²ró®†s®*Pƒ²‚²z—®Bc² ƒ²V+²V²jP¸ƒ® ƒ²V®z`€ñˆû®NÇ®†tğ½ˆû²vƒ®"3®~³²Vğƒ¶f ƒ²ó®²ã
ßªÎƒªÂw²‚W®ÎÓ
ß²V÷²7²vĞƒ¶V£ªî`ƒ®NÇ®†w®B§®.#®.¸ğ½‘¥Øùô((€€€€€€€€€€€€ñ±…‰•°±…ÍÍ9…µ”ô‰‰±½¬Ñ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÉ…ä´ÔÀÀµĞ´Ğµˆ´Ä¸Ôˆø(€€€€€€€€€€€€€€Ä¸ƒªÎƒªÂw®ª€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµÉ•´ÔÀÀˆø¨ğ½ÍÁ…¸ø(€€€€€€€€€€€€ğ½±…‰•°ø(€€€€€€€€€€€€ñ¥¹ÁÕĞ(€€€€€€€€€€€€€…ÕÑ½½ÕÌ(€€€€€€€€€€€€€Ù…±Õ”õí¡½µ•ÕÍÑ½µ•É9…µ•ô(€€€€€€€€€€€€€½¹¡…¹”õì¡”¤€ôøÍ•Ñ!½µ•ÕÍÑ½µ•É9…µ”¡”¹Ñ…É•Ğ¹Ù…±Õ”¥ô(€€€€€€€€€€€€€Á±…•¡½±‘•Èô‹ªÎƒªÂw®ª²vƒ²z®‚—¶VÓ²ó²ã²jPˆ(€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰Üµ™Õ±°‰½É‘•È‰½É‘•ÈµÉ…ä´ÈÀÀÉ½Õ¹‘•µá°Áà´ÌÁä´ÌÑ•áĞµÍ´½ÕÑ±¥¹”µ¹½¹”™½ÕÌéÉ¥¹œ´È™½ÕÌéÉ¥¹œµÙ¥½±•Ğ´ÈÀÀˆ(€€€€€€€€€€€€¼ø((€€€€€€€€€€€€ñ±…‰•°±…ÍÍ9…µ”ô‰‰±½¬Ñ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÉ…ä´ÔÀÀµĞ´Ğµˆ´Ä¸Ôˆø(€€€€€€€€€€€€€€È¸ƒ®tƒªÖ³®Ú€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµÉ•´ÔÀÀˆø¨ğ½ÍÁ…¸ø(€€€€€€€€€€€€ğ½±…‰•°ø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É¥É¥µ½±Ì´È…À´Èˆø(€€€€€€€€€€€€€í!=5}9Q]=I-}QeAL¹µ…À¡¸ôø (€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸­•äõí¸¹­•åôÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùíÍ•Ñ!½µ•9•Ñİ½É­QåÁ”¡¸¹­•ä¤íÍ•Ñ!½µ•5…¥¹QÙA±…¸ œœ¥õô(€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õíÁä´ÌÉ½Õ¹‘•µá°‰½É‘•ÈÑ•áĞµÍ´™½¹Ğµ‰½±€‘ì(€€€€€€€€€€€€€€€€€€€¡½µ•9•Ñİ½É­QåÁ”ôôõ¸¹­•ä(€€€€€€€€€€€€€€€€€€€€€€ü€‰œµÙ¥½±•Ğ´ÔÀ‰½É‘•ÈµÙ¥½±•Ğ´ÌÀÀÑ•áĞµÙ¥½±•Ğ´ÜÀÀœ(€€€€€€€€€€€€€€€€€€€€€€è€‰œµİ¡¥Ñ”‰½É‘•ÈµÉ…ä´ÈÀÀÑ•áĞµÉ…ä´ÔÀÀœ(€€€€€€€€€€€€€€€€€õôø(€€€€€€€€€€€€€€€€€í¡½µ•9•Ñİ½É­QåÁ”ôôõ¸¹­•äüŸŠrL€œèœõí¸¹±…‰•±ô(€€€€€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€¤¥ô(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀµĞ´Ä¸Ôˆø(€€€€€€€€€€€€€ƒªÂ²‚W®t¿²3¶bã®w²v ƒ²ÇªÎğƒ®Â<ƒªÒ®š³²z@ƒ¶>'ªÂ²v`ƒªÂ²‚W®tƒ®æ²’DƒªÎ²
Ã²^C®>ƒ²
³²j§®>ó²jP¸(€€€€€€€€€€€€ğ½‘¥Øø((€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´Ğˆø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÉ…ä´ØÀÀµˆ´ÈˆøÌ¸ƒ¶2C®ƒ²¶J €ñÍÁ…¸±…ÍÍ9…µ”ô‰™½¹Ğµ¹½Éµ…°Ñ•áĞµÉ…ä´ĞÀÀˆû
Üƒ²¶J#²vƒ®"®–àƒ®Jƒ®ÂS®†pƒ²ã®Ú ƒ²ƒ¶tğ½ÍÁ…¸øğ½‘¥Øø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰ÍÁ…”µä´Èˆø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÉ½Õ¹‘•µá°‰½É‘•ÈÀ´È¸Ô€‘í¡½µ•%¹Ñ•É¹•Ğü‰½É‘•ÈµÙ¥½±•Ğ´ÌÀÀ‰œµÙ¥½±•Ğ´ÔÀ¼ÔÀœè‰½É‘•ÈµÉ…ä´ÈÀÀ‰œµİ¡¥Ñ”õôø(€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùí¥˜¡¡½µ•%¹Ñ•É¹•Ğ¥íÍ•Ñ!½µ•%¹Ñ•É¹•Ğ¡™…±Í”¤íÍ•Ñ!½µ•%¹Ñ•É¹•ÑMÁ•• œœ¤íÍ•Ñ!½µ•5…¥¹QØ¡™…±Í”¤íÍ•Ñ!½µ•5…¥¹QÙA±…¸ œœ¥õ•±Í”Í•Ñ!½µ•%¹Ñ•É¹•Ğ¡ÑÉÕ”¥õô±…ÍÍ9…µ”ô‰Üµ™Õ±°™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•Ñİ••¸Ñ•áĞµÍ´™½¹Ğµ‰½±ˆøñÍÁ…¸±…ÍÍ9…µ”õí¡½µ•%¹Ñ•É¹•ĞüÑ•áĞµÙ¥½±•Ğ´ÜÀÀœèÑ•áĞµÉ…ä´ØÀÀôùí¡½µ•%¹Ñ•É¹•ĞüŸŠrL€œèœ÷²vã¶Ã®Üğ½ÍÁ…¸ùí¡½µ•%¹Ñ•É¹•ÑMÁ••˜˜ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÙ¥½±•Ğ´ØÀÀˆùíìÄÀÀèœÄÀÁ5œ°ÔÀÀèœÔÀÁ5œ°œÅœœèœÅõm¡½µ•%¹Ñ•É¹•ÑMÁ••‘uôğ½ÍÁ…¸ùôğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€í¡½µ•%¹Ñ•É¹•Ğ˜˜…¡½µ•%¹Ñ•É¹•ÑMÁ••˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰É¥É¥µ½±Ì´Ì…À´ÈµĞ´ÈˆùímlœÄÀÀœ°œÄÀÁ5t±lœÔÀÀœ°œÔÀÁ5t±lœÅœœ°œÅut¹µ…À ¡m¬±±t¤ôøñ‰ÕÑÑ½¸­•äõí­ôÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùÍ•Ñ!½µ•%¹Ñ•É¹•ÑMÁ••¡¬¥ô±…ÍÍ9…µ”ô‰Áä´È¸ÔÉ½Õ¹‘•µ±œ‰½É‘•È‰½É‘•ÈµÙ¥½±•Ğ´ÈÀÀ‰œµİ¡¥Ñ”Ñ•áĞµáÌ™½¹Ğµ‰½±Ñ•áĞµÙ¥½±•Ğ´ÜÀÀˆùí±ôğ½‰ÕÑÑ½¸ø¥ôğ½‘¥Øùô(€€€€€€€€€€€€€€€€€í¡½µ•%¹Ñ•É¹•Ğ˜™¡½µ•%¹Ñ•É¹•ÑMÁ••˜˜ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùÍ•Ñ!½µ•%¹Ñ•É¹•ÑMÁ•• œœ¥ô±…ÍÍ9…µ”ô‰µĞ´ÄÑ•áĞµlÄÁÁát™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÉ…ä´ĞÀÀˆû²7®>ƒ®ÎªÊôğ½‰ÕÑÑ½¸ùô(€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÉ½Õ¹‘•µá°‰½É‘•ÈÀ´È¸Ô€‘í¡½µ•5…¥¹QØü‰½É‘•ÈµÙ¥½±•Ğ´ÌÀÀ‰œµÙ¥½±•Ğ´ÔÀ¼ÔÀœè‰½É‘•ÈµÉ…ä´ÈÀÀ‰œµİ¡¥Ñ”õôø(€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùí¥˜ …¡½µ•%¹Ñ•É¹•Ğ¥É•ÑÕÉ¸Í¡½İÁÁQ½…ÍĞ QX£²ğ§®*Pƒ²vã¶Ã®ßªÎğƒ¶V£ªî`ƒ²ƒ¶w¶VÓ²ó²ã²jP¸œ±íÑ½¹”è¥¹™¼ô¤í¥˜¡¡½µ•5…¥¹QØ¥íÍ•Ñ!½µ•5…¥¹QØ¡™…±Í”¤íÍ•Ñ!½µ•5…¥¹QÙA±…¸ œœ¥õ•±Í”Í•Ñ!½µ•5…¥¹QØ¡ÑÉÕ”¥õô±…ÍÍ9…µ”ô‰Üµ™Õ±°™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•Ñİ••¸Ñ•áĞµÍ´™½¹Ğµ‰½±ˆøñÍÁ…¸±…ÍÍ9…µ”õí¡½µ•5…¥¹QØüÑ•áĞµÙ¥½±•Ğ´ÜÀÀœèÑ•áĞµÉ…ä´ØÀÀôùí¡½µ•5…¥¹QØüŸŠrL€œèœõQX£²ğ¤ğ½ÍÁ…¸ùí¡½µ•5…¥¹QÙA±…¸˜˜ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÙ¥½±•Ğ´ØÀÀˆùí¡½µ•5…¥¹QÙA±…¹1…‰•°¡¡½µ•5…¥¹QÙA±…¸±¡½µ•9•Ñİ½É­QåÁ”¥ôğ½ÍÁ…¸ùôğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€í¡½µ•5…¥¹QØ˜˜…¡½µ•5…¥¹QÙA±…¸˜˜ñ‘¥Ø±…ÍÍ9…µ”õíÉ¥€‘í¡½µ•9•Ñİ½É­QåÁ”ôôôÍ½¡¼œüÉ¥µ½±Ì´ÈœèÉ¥µ½±Ì´Ìô…À´ÈµĞ´Éôùì¡¡½µ•9•Ñİ½É­QåÁ”ôôôÍ½¡¼œımlÁÉ•µ¥Õ´œ°Ÿ¶R®š³®¾ã²^t±l‰•±½İAÉ•µ¥Õ´œ°Ÿ¶R®š³®¾ã²^ƒ®¾ã®0utéml‰É½…‘…ÍÑA…ÍÌœ°Ÿ®Â§²‡¶2£²*t±lÁÉ•µ¥Õ´œ°Ÿ¶R®š³®¾ã²^t±l‰•±½İAÉ•µ¥Õ´œ°Ÿ¶R®š³®¾ã²^ƒ®¾ã®0ut¤¹µ…À ¡m¬±±t¤ôøñ‰ÕÑÑ½¸­•äõí­ôÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùÍ•Ñ!½µ•5…¥¹QÙA±…¸¡¬¥ô±…ÍÍ9…µ”ô‰Áä´È¸ÔÉ½Õ¹‘•µ±œ‰½É‘•È‰½É‘•ÈµÙ¥½±•Ğ´ÈÀÀ‰œµİ¡¥Ñ”Ñ•áĞµlÄÅÁát™½¹Ğµ‰½±Ñ•áĞµÙ¥½±•Ğ´ÜÀÀˆùí±ôğ½‰ÕÑÑ½¸ø¥ôğ½‘¥Øùô(€€€€€€€€€€€€€€€€€í¡½µ•5…¥¹QØ˜™¡½µ•5…¥¹QÙA±…¸˜˜ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùÍ•Ñ!½µ•5…¥¹QÙA±…¸ œœ¥ô±…ÍÍ9…µ”ô‰µĞ´ÄÑ•áĞµlÄÁÁát™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÉ…ä´ĞÀÀˆû²jSªâ#²‚pƒ®ÎªÊôğ½‰ÕÑÑ½¸ùô(€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÉ½Õ¹‘•µá°‰½É‘•ÈÀ´È¸Ô€‘í¡½µ•MÕ‰QØü‰½É‘•ÈµÙ¥½±•Ğ´ÌÀÀ‰œµÙ¥½±•Ğ´ÔÀ¼ÔÀœè‰½É‘•ÈµÉ…ä´ÈÀÀ‰œµİ¡¥Ñ”õôø(€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùíÍ•Ñ!½µ•MÕ‰QØ¡Øôø…Ø¤í¥˜¡¡½µ•MÕ‰QØ¥Í•Ñ!½µ•MÕ‰QÙQåÁ” œœ¥õô±…ÍÍ9…µ”ô‰Üµ™Õ±°™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•Ñİ••¸Ñ•áĞµÍ´™½¹Ğµ‰½±ˆøñÍÁ…¸±…ÍÍ9…µ”õí¡½µ•MÕ‰QØüÑ•áĞµÙ¥½±•Ğ´ÜÀÀœèÑ•áĞµÉ…ä´ØÀÀôùí¡½µ•MÕ‰QØüŸŠrL€œèœõQX£®Ú ¤ğ½ÍÁ…¸ùí¡½µ•MÕ‰QØ˜™¡½µ•MÕ‰QÙQåÁ”˜˜ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÙ¥½±•Ğ´ØÀÀˆùí¡½µ•MÕ‰QÙQåÁ”ôôô™É•”œüŸ¶R®š°ƒ®Ú²/¶DœèŸ²vó®Â`ƒ®Ú²/¶Dôğ½ÍÁ…¸ùôğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€í¡½µ•MÕ‰QØ˜˜…¡½µ•MÕ‰QÙQåÁ”˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰É¥É¥µ½±Ì´È…À´ÈµĞ´Èˆøñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùÍ•Ñ!½µ•MÕ‰QÙQåÁ” ¹½Éµ…°œ¥ô±…ÍÍ9…µ”ô‰Áä´È¸ÔÉ½Õ¹‘•µ±œ‰½É‘•È‰½É‘•ÈµÙ¥½±•Ğ´ÈÀÀ‰œµİ¡¥Ñ”Ñ•áĞµáÌ™½¹Ğµ‰½±Ñ•áĞµÙ¥½±•Ğ´ÜÀÀˆû²vó®Â`ƒ®Ú²/¶Dğ½‰ÕÑÑ½¸øñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùÍ•Ñ!½µ•MÕ‰QÙQåÁ” ™É•”œ¥ô±…ÍÍ9…µ”ô‰Áä´È¸ÔÉ½Õ¹‘•µ±œ‰½É‘•È‰½É‘•ÈµÙ¥½±•Ğ´ÈÀÀ‰œµİ¡¥Ñ”Ñ•áĞµáÌ™½¹Ğµ‰½±Ñ•áĞµÙ¥½±•Ğ´ÜÀÀˆû¶R®š°ƒ®Ú²/¶Dğ½‰ÕÑÑ½¸øğ½‘¥Øùô(€€€€€€€€€€€€€€€€€í¡½µ•MÕ‰QØ˜™¡½µ•MÕ‰QÙQåÁ”˜˜ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùÍ•Ñ!½µ•MÕ‰QÙQåÁ” œœ¥ô±…ÍÍ9…µ”ô‰µĞ´ÄÑ•áĞµlÄÁÁát™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÉ…ä´ĞÀÀˆû²Š®–`ƒ®ÎªÊôğ½‰ÕÑÑ½¸ùô(€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùÍ•Ñ!½µ•Mµ…ÉÑ!½µ”¡Øôø…Ø¥ô±…ÍÍ9…µ”õíÜµ™Õ±°É½Õ¹‘•µá°‰½É‘•ÈÀ´ÌÑ•áĞµ±•™ĞÑ•áĞµÍ´™½¹Ğµ‰½±€‘í¡½µ•Mµ…ÉÑ!½µ”ü‰½É‘•ÈµÙ¥½±•Ğ´ÌÀÀ‰œµÙ¥½±•Ğ´ÔÀÑ•áĞµÙ¥½±•Ğ´ÜÀÀœè‰½É‘•ÈµÉ…ä´ÈÀÀ‰œµİ¡¥Ñ”Ñ•áĞµÉ…ä´ØÀÀõôùí¡½µ•Mµ…ÉÑ!½µ”üŸŠrL€œèœ÷²*“®#¶*ã¶f ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀµĞ´ÈˆùQX£®Ú §²f ƒ²*“®#¶*ã¶f#²v ƒ²vã¶Ã®Üƒ²^²vÓ®>ƒ²ƒ¶w¶V€ƒ²"`ƒ²z#²ZÓ²jP¸ğ½‘¥Øø(€€€€€€€€€€€€ğ½‘¥Øø((€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´ĞÉ½Õ¹‘•µá°‰½É‘•È‰½É‘•ÈµÉ…ä´ÄÀÀÀ´Ìˆø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÉ…ä´ÜÀÀµˆ´ÈˆøĞ¸ƒ®ª£®ÂS²vğƒ®>g².s¶2C®€ñÍÁ…¸±…ÍÍ9…µ”ô‰™½¹Ğµ¹½Éµ…°Ñ•áĞµÉ…ä´ĞÀÀˆû
Üƒ¶VÓ®.äƒ².pƒ²ƒ¶tğ½ÍÁ…¸øğ½‘¥Øø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É¥É¥µ½±Ì´Ä…À´Èˆø(€€€€€€€€€€€€€€€íml¹½¹”œ°Ÿ²^²v0t±l¹•İ¡…¹”œ°Ÿ².ƒªŞp¿ªâÃ®Î ƒ®>g².s¶2C®t±lµ¹Àœ°59@ƒ®>g².s¶2C®t±lÕÍ•‘5¹Àœ°Ÿ²’GªÎ€59@ƒ®>g².s¶2C®ut¹µ…À ¡m¬±±t¤ôøñ‰ÕÑÑ½¸­•äõí­ôÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùí¥˜¡¬ôôôÕÍ•‘5¹Àœ˜™¡½µ•9•Ñİ½É­QåÁ”„ôô¡½ÕÍ•¡½±œ¥É•ÑÕÉ¸Í¡½İÁÁQ½…ÍĞ Ÿ²’GªÎ€59@ƒ®>g².s¶2C®“®*PƒªÂ²‚W®w²^C²s®0ƒ²‚²j§¶V€ƒ²"`ƒ²z#²ZÓ²jP¸œ±íÑ½¹”è¥¹™¼ô¤íÍ•Ñ!½µ•5½‰¥±•M¥µÕ°¡¬¥õô±…ÍÍ9…µ”õíÁä´È¸ÔÁà´ÌÉ½Õ¹‘•µá°‰½É‘•ÈÑ•áĞµ±•™ĞÑ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±€‘í¡½µ•5½‰¥±•M¥µÕ°ôôõ¬ü‰œµÙ¥½±•Ğ´ÔÀ‰½É‘•ÈµÙ¥½±•Ğ´ÌÀÀÑ•áĞµÙ¥½±•Ğ´ÜÀÀœè‰œµİ¡¥Ñ”‰½É‘•ÈµÉ…ä´ÈÀÀÑ•áĞµÉ…ä´ÔÀÀõôùí¡½µ•5½‰¥±•M¥µÕ°ôôõ¬üŸŠrL€œèœõí±ôğ½‰ÕÑÑ½¸ø¥ô(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€í¡½µ•5½‰¥±•M¥µÕ°ôôôÕÍ•‘5¹Àœ˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´ÈÉ½Õ¹‘•µ±œ‰œµ…µ‰•È´ÔÀÁà´ÌÁä´ÈÑ•áĞµlÄÁÁátÑ•áĞµ…µ‰•È´ÜÀÀˆûŠrLƒ²’GªÎ€59@€à×ªÖÃŠDƒ²ƒ²Vôƒ®>g².s¶2C®ƒ
ÜƒªÂ²‚W®w²^C²s®0ƒ²‚²j¤ğ½‘¥Øùô(€€€€€€€€€€€€ğ½‘¥Øø((€€€€€€€€€€€€ñ±…‰•°±…ÍÍ9…µ”ô‰‰±½¬Ñ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÉ…ä´ÔÀÀµĞ´Ğµˆ´Ä¸Ôˆø(€€€€€€€€€€€€€€Ô¸ƒ²“²æ`ƒ²b#²‚W²vğ€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµÉ…ä´ĞÀÀ™½¹Ğµ¹½Éµ…°ˆø£®¾ã²‚TƒªÂ®*”¤ğ½ÍÁ…¸ø(€€€€€€€€€€€€ğ½±…‰•°ø(€€€€€€€€€€€€ñ¥¹ÁÕĞÑåÁ”ô‰‘…Ñ”ˆÙ…±Õ”õí¡½µ•A±…¹¹•‘…Ñ•ô½¹¡…¹”õì¡”¤ôùÍ•Ñ!½µ•A±…¹¹•‘…Ñ”¡”¹Ñ…É•Ğ¹Ù…±Õ”¥ô(€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰Üµ™Õ±°‰½É‘•È‰½É‘•ÈµÉ…ä´ÈÀÀÉ½Õ¹‘•µá°Áà´ÌÁä´ÌÑ•áĞµÍ´ˆ€¼ø((€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´ĞÉ½Õ¹‘•µá°‰½É‘•È‰½É‘•ÈµÉ…ä´ÄÀÀÀ´Ìˆø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÉ…ä´ÜÀÀµˆ´ÈˆûªÎƒªÂw²V÷²4€¼ƒ²rƒ²²
³¶V´€ñÍÁ…¸±…ÍÍ9…µ”ô‰™½¹Ğµ¹½Éµ…°Ñ•áĞµÉ…ä´ĞÀÀˆû
Üƒ²²‚Dƒ²zG²Äğ½ÍÁ…¸øğ½‘¥Øø(€€€€€€€€€€€€€€ñ¥¹ÁÕĞÙ…±Õ”õí¡½µ•ÕÍÑ½µQ¥Ñ±•ô½¹¡…¹”õí”ôùÍ•Ñ!½µ•ÕÍÑ½µQ¥Ñ±”¡”¹Ñ…É•Ğ¹Ù…±Õ”¥ôÁ±…•¡½±‘•Èô‹²V÷²4ƒ®
Ó²j§²vƒ²²‚Dƒ²zG²Ç¶VÓ²ó²ã²jPˆ±…ÍÍ9…µ”ô‰Üµ™Õ±°‰½É‘•ÈÉ½Õ¹‘•µ±œÁà´ÌÁä´È¸ÔÑ•áĞµáÌ‰œµİ¡¥Ñ”ˆ€¼ø(€€€€€€€€€€€€€€ñ¥¹ÁÕĞÑåÁ”ô‰‘…Ñ”ˆÙ…±Õ”õí¡½µ•ÕÍÑ½µÕ•…Ñ•ô½¹¡…¹”õí”ôùÍ•Ñ!½µ•ÕÍÑ½µÕ•…Ñ”¡”¹Ñ…É•Ğ¹Ù…±Õ”¥ô±…ÍÍ9…µ”ô‰µĞ´ÈÜµ™Õ±°‰½É‘•ÈÉ½Õ¹‘•µ±œÁà´ÌÁä´È¸ÔÑ•áĞµáÌ‰œµİ¡¥Ñ”ˆ€¼ø(€€€€€€€€€€€€€í¡½µ•áÑÉ…AÉ½µ¥Í•Ì¹µ…À ¡à±¤¤ôøñ‘¥Ø­•äõí¥ô±…ÍÍ9…µ”ô‰µĞ´ÈÉ¥É¥µ½±ÌµlÅ™É}…ÕÑ½t…À´Èˆøñ‘¥Øøñ¥¹ÁÕĞÙ…±Õ”õíà¹Ñ¥Ñ±•ô½¹¡…¹”õí”ôùÍ•Ñ!½µ•áÑÉ…AÉ½µ¥Í•Ì¡„ôù„¹µ…À ¡Ø±¨¤ôù¨ôôõ¤ıì¸¸¹Ø±Ñ¥Ñ±”é”¹Ñ…É•Ğ¹Ù…±Õ•ôéØ¤¥ôÁ±…•¡½±‘•Èô‹²ÚSªÂ ƒ²V÷²4ƒ®
Ó²j¤ˆ±…ÍÍ9…µ”ô‰Üµ™Õ±°‰½É‘•ÈÉ½Õ¹‘•µ±œÁà´ÌÁä´ÈÑ•áĞµáÌˆ¼øñ¥¹ÁÕĞÑåÁ”ô‰‘…Ñ”ˆÙ…±Õ”õíà¹‘Õ•…Ñ•ô½¹¡…¹”õí”ôùÍ•Ñ!½µ•áÑÉ…AÉ½µ¥Í•Ì¡„ôù„¹µ…À ¡Ø±¨¤ôù¨ôôõ¤ıì¸¸¹Ø±‘Õ•…Ñ”é”¹Ñ…É•Ğ¹Ù…±Õ•ôéØ¤¥ô±…ÍÍ9…µ”ô‰µĞ´ÄÜµ™Õ±°‰½É‘•ÈÉ½Õ¹‘•µ±œÁà´ÌÁä´ÈÑ•áĞµáÌˆ¼øğ½‘¥Øøñ‰ÕÑÑ½¸½¹±¥¬õì ¤ôùÍ•Ñ!½µ•áÑÉ…AÉ½µ¥Í•Ì¡„ôù„¹™¥±Ñ•È ¡|±¨¤ôù¨„ôõ¤¤¥ô±…ÍÍ9…µ”ô‰Ñ•áĞµÉ•´ĞÀÀÑ•áĞµáÌˆû²
·²‚pğ½‰ÕÑÑ½¸øğ½‘¥Øø¥ô(€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùÍ•Ñ!½µ•áÑÉ…AÉ½µ¥Í•Ì¡„ôùl¸¸¹„±íÑ¥Ñ±”èœœ±‘Õ•…Ñ”èœõt¥ô±…ÍÍ9…µ”ô‰µĞ´ÈÑ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÙ¥½±•Ğ´ØÀÀˆø¬ƒ²V÷²4ƒ²ÚSªÂ ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€ğ½‘¥Øø((ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´ĞÉ¥É¥µ½±Ì´È…À´Èˆø(€€€€€€€€€€€€€ì…¥ÍM•ÁÑ•µ‰•ÉA½±¥åÑ¥Ù”¡µ½¹Ñ ¤˜˜ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùí½¹ÍĞ•°õ‘½Õµ•¹Ğ¹•Ñ±•µ•¹Ñ	å% ¡½µ”µÍÁ½Ğµ½ÁÑ¥½¹Ìœ¤í¥˜¡•°¥•°¹±…ÍÍ1¥ÍĞ¹Ñ½±” ¡¥‘‘•¸œ¥õô±…ÍÍ9…µ”õíÁä´È¸ÔÉ½Õ¹‘•µá°‰½É‘•ÈÑ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±€‘í¡½µ•MÁ½ÑA½±¥å%‘ññ¡½µ•MÁ½Ñ¥É•Ñ=Á•¸ü‰œµ½É…¹”´ÔÀ‰½É‘•Èµ½É…¹”´ÈÀÀÑ•áĞµ½É…¹”´ÜÀÀœè‰œµÉ…ä´ÔÀ‰½É‘•ÈµÉ…ä´ÄÀÀÑ•áĞµÉ…ä´ØÀÀõôø¬ƒ²*“¶2|ƒ²‚W²Æğ½‰ÕÑÑ½¸ùô(€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùÍ•Ñ!½µ•áÁ•¹Í•=Á•¸¡Øôø…Ø¥ô±…ÍÍ9…µ”õíÁä´È¸ÔÉ½Õ¹‘•µá°‰½É‘•ÈÑ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±€‘í¡½µ•áÁ•¹Í•=Á•¸ü‰œµ•µ•É…±´ÔÀ‰½É‘•Èµ•µ•É…±´ÈÀÀÑ•áĞµ•µ•É…±´ÜÀÀœè‰œµÉ…ä´ÔÀ‰½É‘•ÈµÉ…ä´ÄÀÀÑ•áĞµÉ…ä´ØÀÀõôø¬ƒ²b“¶6ğ¿²b²^®æ²j¤ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€ì…¥ÍM•ÁÑ•µ‰•ÉA½±¥åÑ¥Ù”¡µ½¹Ñ ¤˜˜ñ‘¥Ø¥ô‰¡½µ”µÍÁ½Ğµ½ÁÑ¥½¹Ìˆ±…ÍÍ9…µ”ô‰¡¥‘‘•¸µĞ´ÌÉ½Õ¹‘•µá°‰½É‘•È‰½É‘•Èµ½É…¹”´ÄÀÀ‰œµ½É…¹”´ÔÀ¼ĞÀÀ´Ìˆø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÉ…ä´ÜÀÀµˆ´ÈˆûÂ~R”ƒ¶f ƒ²*“¶2|ƒ²ÚSªÂ ƒ²vã²ó¶.Ã®â0ğ½‘¥Øø(€€€€€€€€€€€€€í¡½µ•MÁ½ÑA½±¥¥•Ì¹µ…À¡Àôøñ‰ÕÑÑ½¸­•äõíÀ¹¥‘ôÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùíÍ•Ñ!½µ•MÁ½ÑA½±¥å%¡À¹¥¤íÍ•Ñ!½µ•MÁ½Ñ¥É•Ñ=Á•¸¡™…±Í”¥õô±…ÍÍ9…µ”õíÜµ™Õ±°µˆ´ÄÑ•áĞµ±•™ĞÁà´ÌÁä´ÈÉ½Õ¹‘•µ±œÑ•áĞµáÌ‰½É‘•È€‘í¡½µ•MÁ½ÑA½±¥å%ôôõÀ¹¥ü‰œµİ¡¥Ñ”‰½É‘•Èµ½É…¹”´ÌÀÀÑ•áĞµ½É…¹”´ÜÀÀœè‰œµİ¡¥Ñ”¼ÜÀ‰½É‘•ÈµÑÉ…¹ÍÁ…É•¹ĞÑ•áĞµÉ…ä´ØÀÀõôøñˆùí¡½µ•MÁ½ÑA½±¥å%ôôõÀ¹¥üŸŠrL€œèœõíÀ¹Ñ¥Ñ±•ôğ½ˆøñÍÁ…¸±…ÍÍ9…µ”ô‰™±½…ĞµÉ¥¡Ğˆø­íİ½¸¡À¹…µ½Õ¹Ğ¥ôğ½ÍÁ…¸øğ½‰ÕÑÑ½¸ø¥ô(€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùíÍ•Ñ!½µ•MÁ½ÑA½±¥å% œœ¤íÍ•Ñ!½µ•MÁ½Ñ¥É•Ñ=Á•¸¡Øôø…Ø¥õô±…ÍÍ9…µ”ô‰Üµ™Õ±°µĞ´ÄÁà´ÌÁä´ÈÉ½Õ¹‘•µ±œÑ•áĞµ±•™ĞÑ•áĞµáÌ™½¹Ğµ‰½±‰œµ½É…¹”´ÄÀÀ¼ÜÀÑ•áĞµ½É…¹”´ÜÀÀˆø¬ƒ²*“¶2|ƒ²²‚Dƒ²z®‚”ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€í¡½µ•MÁ½Ñ¥É•Ñ=Á•¸˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰ÍÁ…”µä´ÈµĞ´Èˆøñ¥¹ÁÕĞÙ…±Õ”õí¡½µ•MÁ½Ñ¥É•ÑQ¥Ñ±•ô½¹¡…¹”õí”ôùÍ•Ñ!½µ•MÁ½Ñ¥É•ÑQ¥Ñ±”¡”¹Ñ…É•Ğ¹Ù…±Õ”¥ôÁ±…•¡½±‘•Èô‹²‚W²Æ®ªˆ±…ÍÍ9…µ”ô‰Üµ™Õ±°‰½É‘•ÈÉ½Õ¹‘•µ±œÀ´ÈÑ•áĞµáÌ‰œµİ¡¥Ñ”ˆ¼øñ¥¹ÁÕĞÙ…±Õ”õí™µÑ%¹ÁÕÑ9Õµ‰•È¡¡½µ•MÁ½Ñ¥É•Ñµ½Õ¹Ğ¥ô½¹¡…¹”õí”ôùÍ•Ñ!½µ•MÁ½Ñ¥É•Ñµ½Õ¹Ğ¡”¹Ñ…É•Ğ¹Ù…±Õ”¹É•Á±…” ½q½œ°œœ¤¥ôÁ±…•¡½±‘•Èô‹²ÚSªÂ ƒªâ#²V„ˆ±…ÍÍ9…µ”ô‰Üµ™Õ±°‰½É‘•ÈÉ½Õ¹‘•µ±œÀ´ÈÑ•áĞµáÌ‰œµİ¡¥Ñ”ˆ¼øñ¥¹ÁÕĞÙ…±Õ”õí¡½µ•MÁ½Ñ¥É•Ñ5•µ½ô½¹¡…¹”õí”ôùÍ•Ñ!½µ•MÁ½Ñ¥É•Ñ5•µ¼¡”¹Ñ…É•Ğ¹Ù…±Õ”¥ôÁ±…•¡½±‘•Èô‹®¦S®ª €£²ƒ¶t¤ˆ±…ÍÍ9…µ”ô‰Üµ™Õ±°‰½É‘•ÈÉ½Õ¹‘•µ±œÀ´ÈÑ•áĞµáÌ‰œµİ¡¥Ñ”ˆ¼øğ½‘¥Øùô(€€€€€€€€€€€€ğ½‘¥Øùô(€€€€€€€€€€€í¡½µ•áÁ•¹Í•=Á•¸˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´ÌÉ½Õ¹‘•µá°‰½É‘•È‰½É‘•Èµ•µ•É…±´ÄÀÀ‰œµ•µ•É…±´ÔÀ¼ÌÀÀ´Ìˆøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÉ…ä´ÜÀÀµˆ´ÈˆûÂ~JÌƒ²b“¶6ğ¿²b²^®æ²j¤ğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰É¥É¥µ½±Ì´È…À´ÈˆøñÍ•±•ĞÙ…±Õ”õí¡½µ•áÁ•¹Í•…Ñ•½Éåô½¹¡…¹”õí”ôùÍ•Ñ!½µ•áÁ•¹Í•…Ñ•½Éä¡”¹Ñ…É•Ğ¹Ù…±Õ”¥ô±…ÍÍ9…µ”ô‰‰½É‘•ÈÉ½Õ¹‘•µ±œÁà´ÈÁä´ÈÑ•áĞµáÌ‰œµİ¡¥Ñ”ˆøñ½ÁÑ¥½¸û²b“¶6ğğ½½ÁÑ¥½¸øñ½ÁÑ¥½¸û²ò²vÓ²*ğ½½ÁÑ¥½¸øñ½ÁÑ¥½¸û¶2C²Ò$ğ½½ÁÑ¥½¸øñ½ÁÑ¥½¸ûªâÃ¶ ğ½½ÁÑ¥½¸øğ½Í•±•Ğøñ¥¹ÁÕĞ¥¹ÁÕÑ5½‘”ô‰¹Õµ•É¥ŒˆÙ…±Õ”õí™µÑ%¹ÁÕÑ9Õµ‰•È¡¡½µ•áÁ•¹Í•µ½Õ¹Ğ¥ô½¹¡…¹”õí”ôùÍ•Ñ!½µ•áÁ•¹Í•µ½Õ¹Ğ¡”¹Ñ…É•Ğ¹Ù…±Õ”¹É•Á±…” ½q½œ°œœ¤¥ôÁ±…•¡½±‘•Èô‹ªâ#²V„ˆ±…ÍÍ9…µ”ô‰‰½É‘•ÈÉ½Õ¹‘•µ±œÁà´ÈÁä´ÈÑ•áĞµáÌ‰œµİ¡¥Ñ”ˆ¼øğ½‘¥Øøñ¥¹ÁÕĞÙ…±Õ”õí¡½µ•áÁ•¹Í•5•µ½ô½¹¡…¹”õí”ôùÍ•Ñ!½µ•áÁ•¹Í•5•µ¼¡”¹Ñ…É•Ğ¹Ù…±Õ”¥ôÁ±…•¡½±‘•Èô‹®¦S®ª €£²ƒ¶t¤ˆ±…ÍÍ9…µ”ô‰µĞ´ÈÜµ™Õ±°‰½É‘•ÈÉ½Õ¹‘•µ±œÁà´ÈÁä´ÈÑ•áĞµáÌ‰œµİ¡¥Ñ”ˆ¼ùí¡½µ•áÑÉ…áÁ•¹Í•Ì¹µ…À ¡à±¤¤ôøñ‘¥Ø­•äõí¥ô±…ÍÍ9…µ”ô‰µĞ´È‰½É‘•ÈµĞÁĞ´Èˆøñ‘¥Ø±…ÍÍ9…µ”ô‰É¥É¥µ½±Ì´È…À´ÈˆøñÍ•±•ĞÙ…±Õ”õíà¹…Ñ•½Éåô½¹¡…¹”õí”ôùÍ•Ñ!½µ•áÑÉ…áÁ•¹Í•Ì¡„ôù„¹µ…À ¡Ø±¨¤ôù¨ôôõ¤ıì¸¸¹Ø±…Ñ•½Éäé”¹Ñ…É•Ğ¹Ù…±Õ•ôéØ¤¥ô±…ÍÍ9…µ”ô‰‰½É‘•ÈÉ½Õ¹‘•Áà´ÈÁä´ÈÑ•áĞµáÌˆøñ½ÁÑ¥½¸û²b“¶6ğğ½½ÁÑ¥½¸øñ½ÁÑ¥½¸û²ò²vÓ²*ğ½½ÁÑ¥½¸øñ½ÁÑ¥½¸ûªÎƒªÂtƒ²
³²v¶J ğ½½ÁÑ¥½¸øñ½ÁÑ¥½¸û¶2C²Ò$ğ½½ÁÑ¥½¸øñ½ÁÑ¥½¸ûªâÃ¶ ğ½½ÁÑ¥½¸øğ½Í•±•Ğøñ¥¹ÁÕĞÙ…±Õ”õí™µÑ%¹ÁÕÑ9Õµ‰•È¡à¹…µ½Õ¹Ğ¥ô½¹¡…¹”õí”ôùÍ•Ñ!½µ•áÑÉ…áÁ•¹Í•Ì¡„ôù„¹µ…À ¡Ø±¨¤ôù¨ôôõ¤ıì¸¸¹Ø±…µ½Õ¹Ğé”¹Ñ…É•Ğ¹Ù…±Õ”¹É•Á±…” ½q½œ°œœ¥ôéØ¤¥ôÁ±…•¡½±‘•Èô‹ªâ#²V„ˆ±…ÍÍ9…µ”ô‰‰½É‘•ÈÉ½Õ¹‘•Áà´ÈÁä´ÈÑ•áĞµáÌˆ¼øğ½‘¥Øøñ¥¹ÁÕĞÙ…±Õ”õíà¹µ•µ½ô½¹¡…¹”õí”ôùÍ•Ñ!½µ•áÑÉ…áÁ•¹Í•Ì¡„ôù„¹µ…À ¡Ø±¨¤ôù¨ôôõ¤ıì¸¸¹Ø±µ•µ¼é”¹Ñ…É•Ğ¹Ù…±Õ•ôéØ¤¥ôÁ±…•¡½±‘•Èô‹®¦S®ª ˆ±…ÍÍ9…µ”ô‰µĞ´ÄÜµ™Õ±°‰½É‘•ÈÉ½Õ¹‘•Áà´ÈÁä´ÈÑ•áĞµáÌˆ¼øñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùÍ•Ñ!½µ•áÑÉ…áÁ•¹Í•Ì¡„ôù„¹™¥±Ñ•È ¡|±¨¤ôù¨„ôõ¤¤¥ô±…ÍÍ9…µ”ô‰µĞ´ÄÑ•áĞµlÄÁÁátÑ•áĞµÉ•´ĞÀÀˆû²vĞƒ®æ²j¤ƒ²
·²‚pğ½‰ÕÑÑ½¸øğ½‘¥Øø¥ôñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùÍ•Ñ!½µ•áÑÉ…áÁ•¹Í•Ì¡„ôùl¸¸¹„±í…Ñ•½ÉäèŸªÎƒªÂtƒ²
³²v¶J œ±…µ½Õ¹Ğèœœ±µ•µ¼èœõt¥ô±…ÍÍ9…µ”ô‰µĞ´ÈÑ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±Ñ•áĞµ•µ•É…±´ÜÀÀˆø¬ƒ²b²^®æ²j¤ƒ²ÚSªÂ ğ½‰ÕÑÑ½¸øğ½‘¥Øùô((€€€€€€€€€€€€ñ±…‰•°±…ÍÍ9…µ”ô‰µĞ´Ğ™±•à¥Ñ•µÌµ•¹Ñ•È…À´ÈÉ½Õ¹‘•µá°‰œµÉ…ä´ÔÀÀ´ÌÑ•áĞµÍ´Ñ•áĞµÉ…ä´ØÀÀˆø(€€€€€€€€€€€€€€ñ¥¹ÁÕĞ(€€€€€€€€€€€€€€€ÑåÁ”ô‰¡•­‰½àˆ(€€€€€€€€€€€€€€€¡•­•õí¡½µ•¥É•Ñ½µÁ±•Ñ•ô(€€€€€€€€€€€€€€€½¹¡…¹”õì¡”¤€ôøíÍ•Ñ!½µ•¥É•Ñ½µÁ±•Ñ”¡”¹Ñ…É•Ğ¹¡•­•¤í¥˜¡”¹Ñ…É•Ğ¹¡•­•˜˜…¡½µ•ÑÕ…±½µÁ±•Ñ•…Ñ”¥Í•Ñ!½µ•ÑÕ…±½µÁ±•Ñ•…Ñ”¡€‘íµ½¹Ñ¡ô´‘íÍ•±•Ñ•‘…åõ€¥õô(€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰Ü´Ğ ´Ğˆ(€€€€€€€€€€€€€€¼ø(€€€€€€€€€€€€€ƒ²ªâ ƒ®ÂS®†pƒ²“²æ`¿ªÂs¶Ôƒ²f®3®BpƒªÆĞ(€€€€€€€€€€€€ğ½±…‰•°ø((€€€€€€€€€€€í¡½µ•¥É•Ñ½µÁ±•Ñ”˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´ÈÉ½Õ¹‘•µá°‰½É‘•È‰½É‘•Èµ•µ•É…±´ÄÀÀ‰œµ•µ•É…±´ÔÀ¼ĞÀÀ´Ìˆø(€€€€€€€€€€€€€€ñ±…‰•°±…ÍÍ9…µ”ô‰‰±½¬Ñ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±Ñ•áĞµ•µ•É…±´àÀÀµˆ´Ä¸Ôˆû²“²æc²f®3²vğ€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµÉ•´ÔÀÀˆø¨ğ½ÍÁ…¸øğ½±…‰•°ø(€€€€€€€€€€€€€€ñ¥¹ÁÕĞÑåÁ”ô‰‘…Ñ”ˆÙ…±Õ”õí¡½µ•ÑÕ…±½µÁ±•Ñ•…Ñ•ô½¹¡…¹”õí”ôùÍ•Ñ!½µ•ÑÕ…±½µÁ±•Ñ•…Ñ”¡”¹Ñ…É•Ğ¹Ù…±Õ”¥ô±…ÍÍ9…µ”ô‰Üµ™Õ±°‰½É‘•È‰½É‘•Èµ•µ•É…±´ÈÀÀÉ½Õ¹‘•µá°Áà´ÌÁä´È¸ÔÑ•áĞµÍ´‰œµİ¡¥Ñ”ˆ€¼ø(€€€€€€€€€€€€ğ½‘¥Øùô((€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÅÁátÑ•áĞµÉ…ä´ĞÀÀµĞ´Èˆø(€€€€€€€€€€€€€ƒ²ÊÓ¶³¶Vc² ƒ²V+²ró®¦Ğƒ²¶Z'²’G²ró®†pƒ®NÇ®†w®BcªÎ€°ƒ¶f ƒ²¶Z'ªÒ®š³²^C²pƒ²f®0ƒ²Êc®š³¶V€ƒ²"`ƒ²z#²ZÓ²jP¸(€€€€€€€€€€€€ğ½‘¥Øø((€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰ÍÑ¥­ä€µ‰½ÑÑ½´´ÔµĞ´Ô€µµà´ÔÁà´ÔÁĞ´ÌÁˆ´Ô‰œµİ¡¥Ñ”¼äÔ‰…­‘É½Àµ‰±ÕÈ‰½É‘•ÈµĞ‰½É‘•ÈµÉ…ä´ÄÀÀÍ¡…‘½ÜµlÁ|´áÁá|ÈÁÁá}É‰„ À°À°À°À¸ÀĞ¥tˆø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µˆ´È¸ÔÉ½Õ¹‘•µá°‰œµÙ¥½±•Ğ´ÔÀ‰½É‘•È‰½É‘•ÈµÙ¥½±•Ğ´ÄÀÀÁà´ÌÁä´È¸Ôˆøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁát™½¹Ğµ‰½±Ñ•áĞµÙ¥½±•Ğ´ÜÀÀˆùí¡½µ•9•Ñİ½É­QåÁ”ı¡½µ•9•Ñİ½É­1…‰•°¡¡½µ•9•Ñİ½É­QåÁ”¤èŸ®tƒ®¾ã²ƒ¶tôƒ
Üí¡½µ•¥É•Ñ½µÁ±•Ñ”üŸ²“²æc²f®0œèŸ²“²æc®2ªâÀôğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlåÁátÑ•áĞµÙ¥½±•Ğ´ÔÀÀµĞ´Äˆùím¡½µ•%¹Ñ•É¹•Ğ˜˜¡¡½µ•5…¥¹QØıƒ²vã¶Ã®Ü­QX£²ğ¤‘í¥ÍM•ÁÑ•µ‰•ÉA½±¥åÑ¥Ù”¡µ½¹Ñ ¤ı€€‘í¡½µ•5…¥¹QÙA±…¹1…‰•°¡¡½µ•5…¥¹QÙA±…¸±¡½µ•9•Ñİ½É­QåÁ”¥õ€èœõ€éƒ²vã¶Ã®Ü€‘í¡½µ•%¹Ñ•É¹•ÑMÁ••ı¡½µ•%¹Ñ•É¹•ÑMÁ••¹Ñ½UÁÁ•É…Í” ¤èœõ€¤±¡½µ•MÕ‰QØ˜˜¡¡½µ•MÕ‰QÙQåÁ”ôôô™É•”œüQ[¶R®š°£®Ú ¤œèŸ²vó®Â`ƒ®Ú²/¶Dœ¤±¡½µ•Mµ…ÉÑ!½µ”˜˜Ÿ²*“®#¶*ã¶f œ±¡½µ•5½‰¥±•M¥µÕ°„ôô¹½¹”œ˜˜¡í¹•İ¡…¹”èŸ².ƒªŞp¿ªâÃ®Î ƒ®>g².s¶2C®œ±µ¹Àè59@ƒ®>g².s¶2C®œ±ÕÍ•‘5¹ÀèŸ²’GªÎ€59@ƒ®>g².s¶2C®õm¡½µ•5½‰¥±•M¥µÕ±t¥t¹™¥±Ñ•È¡	½½±•…¸¤¹©½¥¸ œƒ
Ü€œ¥ñğŸ¶2C®ƒ²¶J#²vƒ²ƒ¶w¶VÓ²ó²ã²jPôğ½‘¥Øøğ½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É¥É¥µ½±Ì´È…À´Èˆø(€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€€€½¹±¥¬õí±½Í•!½µ•=É‘•Éô(€€€€€€€€€€€€€€€‘¥Í…‰±•õí¡½µ•=É‘•ÉM…Ù¥¹ô(€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰Áä´È¸ÔÉ½Õ¹‘•µá°‰œµÉ…ä´ÄÀÀÑ•áĞµÉ…ä´ÔÀÀÑ•áĞµÍ´™½¹ĞµÍ•µ¥‰½±ˆ(€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€ƒ²Ş£²0(€€€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€€€½¹±¥¬õíÍÕ‰µ¥Ñ!½µ•=É‘•Éô(€€€€€€€€€€€€€€€‘¥Í…‰±•õí¡½µ•=É‘•ÉM…Ù¥¹œñğ€…¡½µ•ÕÍÑ½µ•É9…µ”¹ÑÉ¥´ ¤ñğ€…¡½µ•9•Ñİ½É­QåÁ”ñğ€ …¡½µ•%¹Ñ•É¹•Ğ˜˜…¡½µ•5…¥¹QØ˜˜…¡½µ•MÕ‰QØ˜˜…¡½µ•Mµ…ÉÑ!½µ”¤ñğ€¡¡½µ•5…¥¹QØ˜˜…¡½µ•5…¥¹QÙA±…¸¥ô(€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰Áä´È¸ÔÉ½Õ¹‘•µá°‰œµÙ¥½±•Ğ´ØÀÀÑ•áĞµİ¡¥Ñ”Ñ•áĞµÍ´™½¹Ğµ‰½±‘¥Í…‰±•é½Á…¥Ñä´ÔÀˆ(€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€í¡½µ•=É‘•ÉM…Ù¥¹œ€ü€¡¡½µ•=É‘•ÉÉ…™Ğü¹•‘¥Ñ¥¹œüŸ²"c²‚Tƒ²’D¸¸¸œèŸ®NÇ®†tƒ²’D¸¸¸œ¤€è€¡¡½µ•=É‘•ÉÉ…™Ğü¹•‘¥Ñ¥¹œüŸ²"c²‚Tƒ²‚²z”œèŸ®NÇ®†tœ¥ô(€€€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€ğ½‘¥Øø(€€€€€€¥ô((€€€€€íÑ½…ÍĞ€˜˜€ (€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™¥á•‰½ÑÑ½´´ÈÀ±•™Ğ´Ä¼È€µÑÉ…¹Í±…Ñ”µà´Ä¼Èè´ÌÀÜµm…±Œ ÄÀÀ”´ÈÑÁà¥tµ…àµÜµÍ´ˆø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÉ½Õ¹‘•´Éá°Í¡…‘½Üµá°‰½É‘•ÈÀ´Ğ€‘ì(€€€€€€€€€€€Ñ½…ÍĞ¹­¥¹€ôôô€…¡¥•Ù•µ•¹Ğœ(€€€€€€€€€€€€€€ü€‰œµÙ¥½±•Ğ´ÜÀÀ‰½É‘•ÈµÙ¥½±•Ğ´ØÀÀÑ•áĞµİ¡¥Ñ”œ(€€€€€€€€€€€€€€è€‰œµÉ…ä´äÀÀ‰½É‘•ÈµÉ…ä´àÀÀÑ•áĞµİ¡¥Ñ”œ(€€€€€€€€€õôø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµÍÑ…ÉĞ©ÕÍÑ¥™äµ‰•Ñİ••¸…À´Ìˆø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µ¥¸µÜ´À™±•à´Äˆø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÅÁát½Á…¥Ñä´ØÀµˆ´Äˆû®NÇ®†tƒ²f®0ƒ
ÜíÑ½…ÍĞ¹ÕÍÑ½µ•É9…µ”ı€‘íÑ½…ÍĞ¹ÕÍÑ½µ•É9…µ•ôƒ
Ü€èœõíÑ½…ÍĞ¹±…‰•±ôğ½‘¥Øø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµ‰…Í”™½¹Ğµ‰½±ˆùíÑ½…ÍĞ¹Ñ¥Ñ±•ôğ½‘¥Øø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌ½Á…¥Ñä´ÜÔµĞ´À¸ÔˆùíÑ½…ÍĞ¹ÍÕ‰ôğ½‘¥Øø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁát½Á…¥Ñä´ÜÀµĞ´ÄˆùíÑ½…ÍĞ¹Í½ÕÉ”ôôôµ½‰¥±”œıƒ²ÇªÎñ@€¬‘í™µÑ9Õ´¡Ñ½…ÍĞ¹Á½¥¹Ñ•±Ñ„°Ä¥õ@ƒ
Üƒ²‚®zÕ@€¬‘í™µÑ9Õ´¡Ñ½…ÍĞ¹ÍÑÉ…Ñ•¥A½¥¹Ñ•±Ñ„°Ä¥õ@ƒ
Üƒ²w²
Ã²Ä€¬‘í™µÑ9Õ´¡Ñ½…ÍĞ¹ÁÉ½‘ÕÑ¥Ù¥Ñå•±Ñ„°Ä¥õA€èœõíÑ½…ÍĞ¹ÁÉ½µ¥Í•½Õ¹ĞøÀı€‘íÑ½…ÍĞ¹Í½ÕÉ”ôôôµ½‰¥±”œüœƒ
Ü€œèœ÷ªÎƒªÂtƒ²V÷²4€‘íÑ½…ÍĞ¹ÁÉ½µ¥Í•½Õ¹Ñ÷ªÆĞƒ®NÇ®†u€èœôğ½‘¥Øø((€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´Ì™±•à¥Ñ•µÌµ•¹©ÕÍÑ¥™äµ‰•Ñİ••¸…À´Ìˆø(€€€€€€€€€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€€€€€€€€íÑ½…ÍĞ¹Á…å•±Ñ„€ø€À€˜˜€ (€€€€€€€€€€€€€€€€€€€€€€ğø(€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´™½¹Ğµ‰½±Ñ•áĞµ•µ•É…±´ÌÀÀˆû²vÓ®Ê ƒ¶2C®“®†pƒ²Òt€­íİ½¸¡Ñ½…ÍĞ¹Á…å•±Ñ„¥ôğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€íÑ½…ÍĞ¹Í½ÕÉ”ôôôµ½‰¥±”œ˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁát½Á…¥Ñä´ÜÀµĞ´Äˆø(€€€€€€€€€€€€€€€€€€€€€€€€€ímÑ½…ÍĞ¹Í…±•A…å•±Ñ„øÀ˜™ƒ¶2C®ƒ²vã²ó¶.Ã®â0€‘íİ½¸¡Ñ½…ÍĞ¹Í…±•A…å•±Ñ„¥õ€±Ñ½…ÍĞ¹…Ñ¥Ù¥ÑåA…å•±Ñ„øÀ˜™ƒ¶fs®>g²²nCªâ €‘íİ½¸¡Ñ½…ÍĞ¹…Ñ¥Ù¥ÑåA…å•±Ñ„¥õ€±Ñ½…ÍĞ¹‰½¹ÕÍA…å•±Ñ„øÀ˜™ƒ®NÇªâ'
ß²ÚSªÂ®ÎÓ²€‘íİ½¸¡Ñ½…ÍĞ¹‰½¹ÕÍA…å•±Ñ„¥õt¹™¥±Ñ•È¡	½½±•…¸¤¹©½¥¸ œƒ
Ü€œ¥ô(€€€€€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øùô(€€€€€€€€€€€€€€€€€€€€€€€íÑ½…ÍĞ¹Í½ÕÉ”ôôôµ½‰¥±”œ˜™Ñ½…ÍĞ¹…±Õ±…Ñ¥½¹1¥¹•Ìü¹±•¹Ñ øÀ˜˜ñ‘•Ñ…¥±Ì±…ÍÍ9…µ”ô‰µĞ´ÈÑ•áĞµlÄÁÁátˆø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÕµµ…Éä±…ÍÍ9…µ”ô‰ÕÉÍ½ÈµÁ½¥¹Ñ•È™½¹ĞµÍ•µ¥‰½±½Á…¥Ñä´àÀˆûªÎ²
ÀƒªŞóªÆÀƒ®ÎÓªâÀğ½ÍÕµµ…Éäø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´Ä¸ÔÍÁ…”µä´Ä‰½É‘•Èµ°‰½É‘•Èµİ¡¥Ñ”¼ÈÀÁ°´Èˆø(€€€€€€€€€€€€€€€€€€€€€€€€€€€íÑ½…ÍĞ¹…±Õ±…Ñ¥½¹1¥¹•Ì¹µ…À ¡m±…‰•°±…µ½Õ¹Ñt±¤¤ôøñ‘¥Ø­•äõí¥ô±…ÍÍ9…µ”ô‰™±•à©ÕÍÑ¥™äµ‰•Ñİ••¸…À´ÌˆøñÍÁ…¸±…ÍÍ9…µ”ô‰½Á…¥Ñä´ÜÀˆùí±…‰•±ôğ½ÍÁ…¸øñˆùí…µ½Õ¹Ğôôõ¹Õ±°üŸ²ƒ¶tƒ®Âc²bœé€‘í9Õµ‰•È¡…µ½Õ¹Ğ¤øÀüœ¬œèœô‘íİ½¸¡…µ½Õ¹Ğ¥õôğ½ˆøğ½‘¥Øø¥ô(€€€€€€€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€ğ½‘•Ñ…¥±Ìùô(€€€€€€€€€€€€€€€€€€€€€€ğ¼ø(€€€€€€€€€€€€€€€€€€€€¥ô(€€€€€€€€€€€€€€€€€€€íÑ½…ÍĞ¹ÕÉÉ•¹ÑQ½Ñ…°„ôõÕ¹‘•™¥¹•˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÅÁát½Á…¥Ñä´ØÀµĞ´À¸Ôˆû¶b²z°ƒ®"²‚ƒ²b#²íİ½¸¡Ñ½…ÍĞ¹ÕÉÉ•¹ÑQ½Ñ…°¥ôğ½‘¥Øùô(€€€€€€€€€€€€€€€€€€ğ½‘¥Øø((€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à…À´Ä¸Ôˆø(€€€€€€€€€€€€€€€€€€€íÑ½…ÍĞ¹ÕÍÑ½µ•ÉM…±•%˜˜ñ‰ÕÑÑ½¸½¹±¥¬õí•‘¥ÑQ½…ÍÑM…±•ô±…ÍÍ9…µ”ô‰Í¡É¥¹¬´ÀÁà´ÌÁä´Ä¸ÔÉ½Õ¹‘•µ±œ‰œµİ¡¥Ñ”Ñ•áĞµÉ…ä´äÀÀÑ•áĞµáÌ™½¹Ğµ‰½±ˆû®ÂS®†pƒ²"c²‚Tğ½‰ÕÑÑ½¸ùô(€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õíÑ½…ÍĞ¹Í½ÕÉ”ôôô¡½µ”œıÕ¹‘½!½µ•Q½…ÍĞéÕ¹‘½Q½…ÍÑô±…ÍÍ9…µ”ô‰Í¡É¥¹¬´ÀÁà´ÌÁä´Ä¸ÔÉ½Õ¹‘•µ±œ‰œµ…µ‰•È´ĞÀÀÑ•áĞµÉ…ä´äÀÀÑ•áĞµáÌ™½¹Ğµ‰½±ˆû®Â§ªâ ƒ®NÇ®†tƒ²Ş£²0ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€ğ½‘¥Øø(€€€€€€¥ô(€€€€€íÕÉÉ•¹ÑµÀü¹¥ôôõ…ÕÑ¡UÍ•Èü¹¥˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´Ğ‰œµİ¡¥Ñ”É½Õ¹‘•µá°‰½É‘•È‰½É‘•ÈµÉ•´ÄÀÀ½Ù•É™±½Üµ¡¥‘‘•¸ˆø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰À´Ğˆø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁát™½¹Ğµ‰½±Ñ•áĞµÉ•´ÔÀÀˆû².“²‚ƒªÒ®š°ğ½‘¥Øø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´™½¹Ğµ‰½±Ñ•áĞµÉ…ä´äÀÀµĞ´Äˆû®.ç²nPƒ².“²‚ƒ²Ò#ªâÃ¶fPğ½‘¥Øø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÅÁátÑ•áĞµÉ…ä´ÔÀÀµĞ´Ä±•…‘¥¹œµÉ•±…á•ˆø(€€€€€€€€€€€ƒ²zc®ªìƒ²z®‚—®Bpƒ².“²‚²vƒ²nPƒ®.£²r®†pƒ²Ò#ªâÃ¶fS¶V€ƒ²"`ƒ²z#²ZÓ²jP¸ƒ².“¶Z$ƒ²²‚ƒ®6Ã²vÓ¶Ã®*Pƒ²zC®>dƒ®ÂÇ²^®B§®.#®.¸(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ‘¥Í…‰±•õí±½­•‘ô(€€€€€€€€€€€½¹±¥¬õì ¤ôùíÍ•ÑI•Í•Ñ5½¹Ñ¡=Á•¸¡ÑÉÕ”¤íÍ•ÑI•Í•ÑA¡É…Í” œœ¥õô(€€€€€€€€€€€±…ÍÍ9…µ”ô‰µĞ´ÌÁà´ÌÁä´ÈÉ½Õ¹‘•µ±œ‰½É‘•È‰½É‘•ÈµÉ•´ÈÀÀÑ•áĞµÉ•´ØÀÀÑ•áĞµáÌ™½¹Ğµ‰½±‘¥Í…‰±•é½Á…¥Ñä´ĞÀˆø(€€€€€€€€€€€íµ½¹Ñ¡1…‰•°¡µ½¹Ñ ¥ôƒ².“²‚ƒ²Ò#ªâÃ¶fP(€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€ğ½‘¥Øø(€€€€€€ğ½‘¥Øùô((€€€€€íÉ•Í•Ñ5½¹Ñ¡=Á•¸˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰™¥á•¥¹Í•Ğ´ÀèµläÙt‰œµ‰±…¬¼ĞÔ™±•à¥Ñ•µÌµ•¹Í´é¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ•¹Ñ•Èˆ½¹±¥¬õì ¤ôø…É•Í•Ñ	ÕÍä˜™Í•ÑI•Í•Ñ5½¹Ñ¡=Á•¸¡™…±Í”¥ôø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Üµ™Õ±°µ…àµÜµµ‰œµİ¡¥Ñ”É½Õ¹‘•µĞ´Íá°Í´éÉ½Õ¹‘•´Íá°À´Ôˆ½¹±¥¬õí”ôù”¹ÍÑ½ÁAÉ½Á……Ñ¥½¸ ¥ôø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌ™½¹Ğµ‰½±Ñ•áĞµÉ•´ØÀÀˆøÇ²Â ƒ¶fW²vàğ½‘¥Øø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµ±œ™½¹Ğµ‰½±Ñ•áĞµÉ…ä´äÀÀµĞ´Äˆùíµ½¹Ñ¡1…‰•°¡µ½¹Ñ ¥ôƒ².“²‚²vƒ²Ò#ªâÃ¶fS¶Vƒªæ3²jPüğ½‘¥Øø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ…ä´ÔÀÀµĞ´È±•…‘¥¹œµÉ•±…á•ˆø(€€€€€€€€€€€ƒ²vĞƒ²zG²^²v ƒ¶VÓ®.äƒ²nS²v`ƒ².“²‚ƒ®6Ã²vÓ¶Ã®–ğƒ²²n®.#®.¸ƒ²Ò#ªâÃ¶fPƒ²²‚ƒ®6Ã²vÓ¶Ã®*Pƒ²zC®>dƒ®ÂÇ²^®B§®.#®.¸(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´ĞÁĞ´Ğ‰½É‘•ÈµĞ‰½É‘•ÈµÉ…ä´ÄÀÀˆø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÉ…ä´ÜÀÀˆøË²Â ƒ¶fW²vàğ½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÅÁátÑ•áĞµÉ…ä´ÔÀÀµĞ´Äˆû²V®zc²^@€ñˆû®.ç²nS².“²‚²Ò#ªâÃ¶fPğ½ˆû®–ğƒ²²‚Dƒ²z®‚—¶VÓ²ó²ã²jP¸ğ½‘¥Øø(€€€€€€€€€€€€ñ¥¹ÁÕĞÙ…±Õ”õíÉ•Í•ÑA¡É…Í•ô½¹¡…¹”õí”ôùÍ•ÑI•Í•ÑA¡É…Í”¡”¹Ñ…É•Ğ¹Ù…±Õ”¥ô‘¥Í…‰±•õíÉ•Í•Ñ	ÕÍåô(€€€€€€€€€€€€€Á±…•¡½±‘•Èô‹®.ç²nS².“²‚²Ò#ªâÃ¶fPˆ±…ÍÍ9…µ”ô‰Üµ™Õ±°µĞ´È‰½É‘•È‰½É‘•ÈµÉ…ä´ÈÀÀÉ½Õ¹‘•µá°Áà´ÌÁä´ÌÑ•áĞµÍ´ˆ¼ø(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É¥É¥µ½±Ì´È…À´ÈµĞ´Ğˆø(€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ‘¥Í…‰±•õíÉ•Í•Ñ	ÕÍåô½¹±¥¬õì ¤ôùÍ•ÑI•Í•Ñ5½¹Ñ¡=Á•¸¡™…±Í”¥ô±…ÍÍ9…µ”ô‰Áä´ÌÉ½Õ¹‘•µá°‰œµÉ…ä´ÄÀÀÑ•áĞµÉ…ä´ØÀÀÑ•áĞµÍ´™½¹ĞµÍ•µ¥‰½±ˆû²Ş£²0ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ‘¥Í…‰±•õíÉ•Í•Ñ	ÕÍåññÉ•Í•ÑA¡É…Í”¹ÑÉ¥´ ¤„ôôŸ®.ç²nS².“²‚²Ò#ªâÃ¶fPô½¹±¥¬õíÉ•Í•Ñ=İ¹5½¹Ñ¡A•É™½Éµ…¹•ô(€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰Áä´ÌÉ½Õ¹‘•µá°‰œµÉ•´ØÀÀÑ•áĞµİ¡¥Ñ”Ñ•áĞµÍ´™½¹Ğµ‰½±‘¥Í…‰±•é½Á…¥Ñä´ÌÔˆø(€€€€€€€€€€€€€íÉ•Í•Ñ	ÕÍäüŸ²Ò#ªâÃ¶fPƒ²’D¸¸¸œèŸ².“²‚ƒ²Ò#ªâÃ¶fPƒ².“¶Z$ô(€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€ğ½‘¥Øø(€€€€€€ğ½‘¥Øùô((€€€€ğ½‘¥Øø(€€¤ì)ô()™Õ¹Ñ¥½¸…¥±åM…Ù•	…‘”¡ìÍÑ…Ñ”°¥Í=¹±¥¹”õÑÉÕ”°½¹I•ÑÉäô¤ì(€½¹ÍĞ‰…Í”ô¥¹±¥¹”µ™±•àµ¥¸µ ´Ü¥Ñ•µÌµ•¹Ñ•È…À´ÄÉ½Õ¹‘•µ™Õ±°‰½É‘•ÈÁà´È¸ÔÁä´ÄÑ•áĞµlÄÁÁát™½¹Ğµ‰½±İ¡¥Ñ•ÍÁ…”µ¹½İÉ…Àœì(€¥˜€ …¥Í=¹±¥¹”¤É•ÑÕÉ¸€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õí½¹I•ÑÉåô±…ÍÍ9…µ”õí€‘í‰…Í•ô‰½É‘•ÈµÉ•´ÄÀÀ‰œµÉ•´ÔÀÑ•áĞµÉ•´ØÀÁôøñ±•ÉÑQÉ¥…¹±”Í¥é”õìÄÅô€¼û²b“¶R®vó²vàƒ
Üƒ²z².s²‚²z”ğ½‰ÕÑÑ½¸øì(€¥˜€¡ÍÑ…Ñ”€ôôô€•ÉÉ½Èœ¤É•ÑÕÉ¸€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õí½¹I•ÑÉåô±…ÍÍ9…µ”õí€‘í‰…Í•ô‰½É‘•ÈµÉ•´ÄÀÀ‰œµÉ•´ÔÀÑ•áĞµÉ•´ØÀÁôøñ±•ÉÑQÉ¥…¹±”Í¥é”õìÄÅô€¼û²‚²z”ƒ².“¶2 ƒ
Üƒ®.“².pƒ².s®>ğ½‰ÕÑÑ½¸øì(€¥˜€¡ÍÑ…Ñ”€ôôô€Á•¹‘¥¹œœ¤É•ÑÕÉ¸€ñÍÁ…¸±…ÍÍ9…µ”õí€‘í‰…Í•ô‰½É‘•Èµ…µ‰•È´ÄÀÀ‰œµ…µ‰•È´ÔÀÑ•áĞµ…µ‰•È´ÜÀÁôøñUÁ±½…‘±½ÕÍ¥é”õìÄÅô€¼û®>gªâÃ¶fPƒ®2ªâÀğ½ÍÁ…¸øì(€¥˜€¡ÍÑ…Ñ”€ôôô€Í…Ù•œ¤É•ÑÕÉ¸€ñÍÁ…¸±…ÍÍ9…µ”õí€‘í‰…Í•ô‰½É‘•Èµ•µ•É…±´ÄÀÀ‰œµ•µ•É…±´ÔÀÑ•áĞµ•µ•É…±´ÜÀÁôøñ¡•¬Í¥é”õìÄÅô€¼û²‚²z”ƒ²f®0ğ½ÍÁ…¸øì(€É•ÑÕÉ¸€ñÍÁ…¸±…ÍÍ9…µ”õí€‘í‰…Í•ô‰½É‘•ÈµÉ…ä´ÄÀÀ‰œµÉ…ä´ÔÀÑ•áĞµÉ…ä´ÔÀÁôøñ¡•¬Í¥é”õìÄÅô€¼û®>gªâÃ¶fPƒ²‚W²ğ½ÍÁ…¸øì)ô()™Õ¹Ñ¥½¸•™•ÉÉ•‘‘µ¥¹A…¹•±…±±‰…¬¡í±…‰•°ôŸªÒ®š°ƒ¶fS®¦Ğô¥ì(€É•ÑÕÉ¸€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•àµ¥¸µ ´Èà¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ•¹Ñ•È…À´ÈÉ½Õ¹‘•´Éá°‰½É‘•È‰½É‘•ÈµÉ…ä´ÄÀÀ‰œµİ¡¥Ñ”Ñ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÉ…ä´ĞÀÀˆøñ1½…‘•ÈÈÍ¥é”õìÄÕô±…ÍÍ9…µ”ô‰…¹¥µ…Ñ”µÍÁ¥¸ˆ¼ùí±…‰•±ôƒ®Ú#®~³²b“®*Pƒ²’D¸¸¸ğ½‘¥Øøì)ô(()™Õ¹Ñ¥½¸½±!•…‘•È¡ì±…‰•°ô¤ì(€¥˜€¡±…‰•°¹¥¹±Õ‘•Ì Ÿ
Üœ¤¤ì(€€€½¹ÍĞm„°‰t€ô±…‰•°¹ÍÁ±¥Ğ Ÿ
Üœ¤ì(€€€É•ÑÕÉ¸€ (€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰‰±½¬±•…‘¥¹œµÑ¥¡Ğİ¡¥Ñ•ÍÁ…”µ¹½İÉ…Àˆø(€€€€€€€í…ô(€€€€€€€€ñ‰È€¼ø(€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµlåÁátÑ•áĞµÉ…ä´ÌÀÀ™½¹Ğµ¹½Éµ…°ˆùí‰ôğ½ÍÁ…¸ø(€€€€€€ğ½ÍÁ…¸ø(€€€€¤ì(€ô(€É•ÑÕÉ¸€ñÍÁ…¸±…ÍÍ9…µ”ô‰İ¡¥Ñ•ÍÁ…”µ¹½İÉ…Àˆùí±…‰•±ôğ½ÍÁ…¸øì)ô((¼¨€ôôôôôôôôôôôôôôôôôôôôôƒ®NÇªâ$ƒ²¶Z'®ÂPƒ
Üƒ¶f ƒ²Ös²3²†ÃªÆĞƒ²V3®šğ€ôôôôôôôôôôôôôôôôôôôôô€¨¼(()™Õ¹Ñ¥½¸Õ…É…¹Ñ••‘•±Ñ…½ÉÉ…‘•	½¹ÕÌ¡Á…ä°¹•áÑ	½¹ÕÌ¤ì(€½¹ÍĞİ¥Ñ¡½ÕÑÕÉÉ•¹ÑÉ…‘”€ô€¡Á…ä¹½Ñ¡•É½µÁ½¹•¹ÑÌñğ€À¤€´€¡Á…ä¹É…‘•	½¹ÕÌñğ€À¤ì(€½¹ÍĞ¹•áÑÕ…É…¹Ñ••€ô5…Ñ ¹µ…à¡Á…ä¹Á½Í¥Ñ¥½¹	…Í”ñğ€À°İ¥Ñ¡½ÕÑÕÉÉ•¹ÑÉ…‘”€¬€¡¹•áÑ	½¹ÕÌñğ€À¤¤ì(€É•ÑÕÉ¸5…Ñ ¹µ…à À°¹•áÑÕ…É…¹Ñ••€´€¡Á…ä¹Õ…É…¹Ñ••‘½µÁ½¹•¹Ğñğ€À¤¤ì)ô()™Õ¹Ñ¥½¸¹•áÑQ¥•É‰½Ù”¡½Õ¹Ğ°Ñ¥•ÉÌ¤ì(€É•ÑÕÉ¸l¸¸¸¡Ñ¥•ÉÌñğmt¥t(€€€€¹Í½ÉĞ ¡„°ˆ¤€ôø„¹µ¥¸€´ˆ¹µ¥¸¤(€€€€¹™¥¹ ¡Ğ¤€ôø9Õµ‰•È¡Ğ¹µ¥¸¤€ø9Õµ‰•È¡½Õ¹Ğñğ€À¤¤ñğ¹Õ±°ì)ô()™Õ¹Ñ¥½¸‰Õ¥±‘9•áÑ½…°¡Á…ä°‘É…™Ğ°½¹™¥œ¤ì(€¥˜€ …Á…äñğ€…‘É…™Ğñğ€…½¹™¥œ¤É•ÑÕÉ¸¹Õ±°ì((€½¹ÍĞ…¹‘¥‘…Ñ•Ì€ômtì((€½¹ÍĞÁÕÍ¡…¹‘¥‘…Ñ”€ô€¡ì(€€€­•ä±Ñ¥Ñ±”±‘•ÍÉ¥ÁÑ¥½¸±‘•±Ñ„±É•µ…¥¸±ÕÉÉ•¹Ğ±Ñ…É•Ğ±Õ¹¥Ğ±•™™½ÉÑ]•¥¡ĞôÄ(€ô¤€ôøì(€€€¥˜€ „¡É•µ…¥¸€ø€À¤ñğ€„¡‘•±Ñ„€ø€À¤ñğ€„¡Ñ…É•Ğ€ø€À¤¤É•ÑÕÉ¸ì(€€€½¹ÍĞÁÉ½É•ÍÌ€ô5…Ñ ¹µ…à À°5…Ñ ¹µ¥¸ Ä°9Õµ‰•È¡ÕÉÉ•¹ÑñğÀ¤€¼9Õµ‰•È¡Ñ…É•ÑñğÄ¤¤¤ì(€€€½¹ÍĞİ•¥¡Ñ•‘™™½ÉĞ€ô5…Ñ ¹µ…à À¸ÈÔ°9Õµ‰•È¡É•µ…¥¹ñğÀ¤€¨•™™½ÉÑ]•¥¡Ğ¤ì((€€€€¼¼€‹²rƒ®š³¶Vpƒ®.“²v0ƒ¶Z'®>dˆƒ²‚C²"`è(€€€€¼¼ƒ®
£²v ƒ¶Z'®>d€Ç®.£²r®.äƒ²b#²ƒ²vã²ó¶.Ã®â0ƒ²²*ç²V‡²vƒªâÃ®Îã²ró®†pƒ¶VcªÎ€°(€€€€¼¼ƒ²vÓ®¾àƒ®ª§¶Fs²^@ƒªÂªæ3²jã²"c®†tƒ²V÷ªÂƒ®6Pƒ²jÃ²ƒ¶VÓ²jP¸(€€€½¹ÍĞÙ…±Õ•A•ÉMÑ•À€ô‘•±Ñ„€¼İ•¥¡Ñ•‘™™½ÉĞì(€€€½¹ÍĞÍ½É”€ôÙ…±Õ•A•ÉMÑ•À€¨€ À¸Ü€¬ÁÉ½É•ÍÌ€¨€À¸Ì¤ì((€€€…¹‘¥‘…Ñ•Ì¹ÁÕÍ ¡ì(€€€€€­•ä±Ñ¥Ñ±”±‘•ÍÉ¥ÁÑ¥½¸±‘•±Ñ„±É•µ…¥¸±ÕÉÉ•¹Ğ±Ñ…É•Ğ±Õ¹¥Ğ±ÁÉ½É•ÍÌ±Í½É”°(€€€€€É•½µµ•¹‘…Ñ¥½¸èƒ®
£²v €‘íÉ•µ…¥¹ô‘íÕ¹¥Ñôƒ®2®æ€¬‘íİ½¸¡‘•±Ñ„¥ôƒ¶j£ªÎñ€°(€€€ô¤ì(€ôì((€€¼¼€Ä¤ƒ²ÇªÎó®NÇªâ$(€¥˜€¡Á…ä¹¹•áÑÉ…‘”¤ì(€€€½¹ÍĞÉ•µ…¥¸€ô5…Ñ ¹µ…à À°Á…ä¹¹•áÑÉ…‘”¹µ¥¸€´Á…ä¹Ñ½Ñ…±A½¥¹ÑÌ¤ì(€€€½¹ÍĞ‘•±Ñ„€ôÕ…É…¹Ñ••‘•±Ñ…½ÉÉ…‘•	½¹ÕÌ¡Á…ä°Á…ä¹¹•áÑÉ…‘”¹‰½¹ÕÌ¤ì(€€€ÁÕÍ¡…¹‘¥‘…Ñ”¡ì(€€€€€­•äèÉ…‘”œ°(€€€€€Ñ¥Ñ±”é€‘íÁ…ä¹¹•áÑÉ…‘”¹É…‘•÷®NÇªâ%€°(€€€€€‘•ÍÉ¥ÁÑ¥½¸é€‘íÁ…ä¹¹•áÑÉ…‘”¹É…‘•÷®NÇªâ'ªæ3² €‘íÉ•µ…¥¸¹Ñ½¥á• Ä¥õ@ƒ®
£²Vc²ZÓ²jQ€°(€€€€€‘•±Ñ„°(€€€€€É•µ…¥¸é9Õµ‰•È¡É•µ…¥¸¹Ñ½¥á• Ä¤¤°(€€€€€ÕÉÉ•¹ĞéÁ…ä¹Ñ½Ñ…±A½¥¹ÑÌ°(€€€€€Ñ…É•ĞéÁ…ä¹¹•áÑÉ…‘”¹µ¥¸°(€€€€€Õ¹¥Ğè@œ°(€€€€€•™™½ÉÑ]•¥¡ĞèÄ°(€€€ô¤ì(€ô((€€¼¼€È¤ƒ¶f ƒ²Ös²3²†ÃªÆĞ(€¥˜€ …Á…ä¹É…‘•±¥¥‰±”¤ì(€€€½¹ÍĞÍ¡½ÉĞ€ô5…Ñ ¹µ…à À°!=5}Q}5%8€´Á…ä¹¡½µ•…Ñ•A½¥¹ÑÌ¤ì(€€€½¹ÍĞÉ…‘•Ì€ôl¸¸¸¡½¹™¥œ¹É…‘•ÌñğU1Q}IL¥t¹Í½ÉĞ ¡„°ˆ¤€ôøˆ¹µ¥¸€´„¹µ¥¸¤ì(€€€½¹ÍĞÁ½Ñ•¹Ñ¥…±É…‘”€ôÉ…‘•Ì¹™¥¹ ¡œ¤€ôøÁ…ä¹Ñ½Ñ…±A½¥¹ÑÌ€øôœ¹µ¥¸¤ñğ¹Õ±°ì(€€€½¹ÍĞÁ½Ñ•¹Ñ¥…±	½¹ÕÌ€ôÁ½Ñ•¹Ñ¥…±É…‘”ü¹‰½¹ÕÌñğ€Àì(€€€½¹ÍĞ‘•±Ñ„€ôÁ½Ñ•¹Ñ¥…±	½¹ÕÌ€ø€À(€€€€€€üÕ…É…¹Ñ••‘•±Ñ…½ÉÉ…‘•	½¹ÕÌ¡Á…ä°Á½Ñ•¹Ñ¥…±	½¹ÕÌ¤(€€€€€€è€Àì((€€€ÁÕÍ¡…¹‘¥‘…Ñ”¡ì(€€€€€­•äè¡½µ•…Ñ”œ°(€€€€€Ñ¥Ñ±”èŸ¶f ƒ²Ös²3²†ÃªÆĞœ°(€€€€€‘•ÍÉ¥ÁÑ¥½¸éƒ¶f ƒ²Ös²3²†ÃªÆÓªæ3² €‘íÍ¡½ÉĞ¹Ñ½¥á• Ä¥÷²‚@ƒ®
£²Vc²ZÓ²jQ€°(€€€€€‘•±Ñ„°(€€€€€É•µ…¥¸é9Õµ‰•È¡Í¡½ÉĞ¹Ñ½¥á• Ä¤¤°(€€€€€ÕÉÉ•¹ĞéÁ…ä¹¡½µ•…Ñ•A½¥¹ÑÌ°(€€€€€Ñ…É•Ğé!=5}Q}5%8°(€€€€€Õ¹¥ĞèŸ²‚@œ°(€€€€€•™™½ÉÑ]•¥¡ĞèÄ°(€€€ô¤ì(€ô((€€¼¼€Ì¤ƒªÎƒªÂw®NÇ®†t(€½¹ÍĞÕÍÑ½Õ¹Ğ€ô9Õµ‰•È¡‘É…™Ğ¹ÕÍÑI•½Õ¹Ğñğ€À¤ì(€½¹ÍĞÕÍÑ9•áĞ€ô¹•áÑQ¥•É‰½Ù”¡ÕÍÑ½Õ¹Ğ°½¹™¥œ¹ÕÍÑI•Q¥•ÉÌ¤ì(€¥˜€¡ÕÍÑ9•áĞ¤ì(€€€½¹ÍĞÕÉÉ•¹Ñ	½¹ÕÌ€ôÑ¥•É	½¹ÕÌ¡ÕÍÑ½Õ¹Ğ°½¹™¥œ¹ÕÍÑI•Q¥•ÉÌñğmt¤ì(€€€½¹ÍĞ‘•±Ñ„€ô5…Ñ ¹µ…à À°9Õµ‰•È¡ÕÍÑ9•áĞ¹‰½¹ÕÌñğ€À¤€´ÕÉÉ•¹Ñ	½¹ÕÌ¤ì(€€€½¹ÍĞÉ•µ…¥¸€ô5…Ñ ¹µ…à À°9Õµ‰•È¡ÕÍÑ9•áĞ¹µ¥¸¤€´ÕÍÑ½Õ¹Ğ¤ì(€€€ÁÕÍ¡…¹‘¥‘…Ñ”¡ì(€€€€€­•äèÕÍÑI•œœ°(€€€€€Ñ¥Ñ±”èŸªÎƒªÂw®NÇ®†tœ°(€€€€€‘•ÍÉ¥ÁÑ¥½¸éƒªÎƒªÂw®NÇ®†tƒ®.“²v0ƒªÖ³ªÂªæ3² €‘íÉ•µ…¥¹÷ªÆĞƒ®
£²Vc²ZÓ²jQ€°(€€€€€‘•±Ñ„°(€€€€€É•µ…¥¸°(€€€€€ÕÉÉ•¹ĞéÕÍÑ½Õ¹Ğ°(€€€€€Ñ…É•Ğé9Õµ‰•È¡ÕÍÑ9•áĞ¹µ¥¸¤°(€€€€€Õ¹¥ĞèŸªÆĞœ°(€€€€€•™™½ÉÑ]•¥¡ĞèÄ°(€€€ô¤ì(€ô((€€¼¼€Ğ¤ƒ®{²Ú“²‚s²V (€½¹ÍĞÑ…¥±½É•‘½Õ¹Ğ€ô9Õµ‰•È¡‘É…™Ğ¹Ñ…¥±½É•‘½Õ¹Ğñğ€À¤ì(€½¹ÍĞÑ…¥±½É•‘9•áĞ€ô¹•áÑQ¥•É‰½Ù”¡Ñ…¥±½É•‘½Õ¹Ğ°½¹™¥œ¹Ñ…¥±½É•‘Q¥•ÉÌ¤ì(€¥˜€¡Ñ…¥±½É•‘9•áĞ¤ì(€€€½¹ÍĞÕÉÉ•¹Ñ	½¹ÕÌ€ôÑ¥•É	½¹ÕÌ¡Ñ…¥±½É•‘½Õ¹Ğ°½¹™¥œ¹Ñ…¥±½É•‘Q¥•ÉÌñğmt¤ì(€€€½¹ÍĞ‘•±Ñ„€ô5…Ñ ¹µ…à À°9Õµ‰•È¡Ñ…¥±½É•‘9•áĞ¹‰½¹ÕÌñğ€À¤€´ÕÉÉ•¹Ñ	½¹ÕÌ¤ì(€€€½¹ÍĞÉ•µ…¥¸€ô5…Ñ ¹µ…à À°9Õµ‰•È¡Ñ…¥±½É•‘9•áĞ¹µ¥¸¤€´Ñ…¥±½É•‘½Õ¹Ğ¤ì(€€€ÁÕÍ¡…¹‘¥‘…Ñ”¡ì(€€€€€­•äèÑ…¥±½É•œ°(€€€€€Ñ¥Ñ±”èŸ®{²Ú“²‚s²V œ°(€€€€€‘•ÍÉ¥ÁÑ¥½¸éƒ®{²Ú“²‚s²V ƒ®.“²v0ƒªÖ³ªÂªæ3² €‘íÉ•µ…¥¹÷ªÆĞƒ®
£²Vc²ZÓ²jQ€°(€€€€€‘•±Ñ„°(€€€€€É•µ…¥¸°(€€€€€ÕÉÉ•¹ĞéÑ…¥±½É•‘½Õ¹Ğ°(€€€€€Ñ…É•Ğé9Õµ‰•È¡Ñ…¥±½É•‘9•áĞ¹µ¥¸¤°(€€€€€Õ¹¥ĞèŸªÆĞœ°(€€€€€•™™½ÉÑ]•¥¡ĞèÄ°(€€€ô¤ì(€ô((€¥˜€ ……¹‘¥‘…Ñ•Ì¹±•¹Ñ ¤É•ÑÕÉ¸¹Õ±°ì((€€¼¼ƒ²b#²ƒ²vã²ó¶.Ã®â0ƒ¶j£²r €¬ƒ¶b²z°ƒ®.³²Äƒ²‚GªŞó®>®–ğƒ¶V£ªî`ƒªÎƒ®‚(€…¹‘¥‘…Ñ•Ì¹Í½ÉĞ ¡„±ˆ¤ôùˆ¹Í½É”µ„¹Í½É”ñğˆ¹‘•±Ñ„µ„¹‘•±Ñ„ñğ„¹É•µ…¥¸µˆ¹É•µ…¥¸¤ì(€É•ÑÕÉ¸…¹‘¥‘…Ñ•ÍlÁtì)ô(()½¹ÍĞAIM=91}=1}L€ôl(€ì­•äè€¡Ìœ°±…‰•°è€!Lœ°Õ¹¥Ğè€ŸªÆĞœ°‘•™…Õ±ÑQ…É•Ğè€ÈÀô°(€ì­•äè€¡½µ”œ°±…‰•°è€Ÿ¶f ƒ².“²‚œ°Õ¹¥Ğè€ŸªÆĞœ°‘•™…Õ±ÑQ…É•Ğè€Ôô°(€ì­•äè€ÑÙÉ•”œ°±…‰•°è€Q[¶R®š°£®Ú ¤œ°Õ¹¥Ğè€ŸªÆĞœ°‘•™…Õ±ÑQ…É•Ğè€Ôô°(€ì­•äè€Íµ…ÉÑ!½µ”œ°±…‰•°è€Ÿ²*“®#¶*ã¶f œ°Õ¹¥Ğè€ŸªÆĞœ°‘•™…Õ±ÑQ…É•Ğè€Ôô°(€ì­•äè€Ñ…¥±½É•‘µ½Õ¹Ğœ°±…‰•°è€Ÿ®{²Ú“²‚s²V ƒ²^² ƒªâ#²V„œ°Õ¹¥Ğè€Ÿ²n@œ°‘•™…Õ±ÑQ…É•Ğè€ÄÀÀÀÀÀÀô°(€ì­•äè€Ñ…¥±½É•œ°±…‰•°è€Ÿ®{²Ú“²‚s²V ƒ²^² ƒªÆÓ²"`œ°Õ¹¥Ğè€ŸªÆĞœ°‘•™…Õ±ÑQ…É•Ğè€ÄÔô°(€ì­•äè€Á½¥¹ÑÌœ°±…‰•°è€Ÿ²ÇªÎó®NÇªâ%@œ°Õ¹¥Ğè€@œ°‘•™…Õ±ÑQ…É•Ğè€ÌÔô°(€ì­•äè€­Á¤œ°±…‰•°è€Ÿ²w²
Ã²Äœ°Õ¹¥Ğè€@œ°‘•™…Õ±ÑQ…É•Ğè€ÌÔô°(€ì­•äè€¥¹•¹Ñ¥Ù”œ°±…‰•°è€Ÿ²vã²ó¶.Ã®â0œ°Õ¹¥Ğè€Ÿ²n@œ°‘•™…Õ±ÑQ…É•Ğè€ÄÔÀÀÀÀÀô°)tì()™Õ¹Ñ¥½¸•ÑA•ÉÍ½¹…±½…±ÑÕ…±Ì¡µ•É•‘É…™Ğ°Á…ä¤ì(€½¹ÍĞµ…ÑÉ¥à€ôµ•É•‘É…™Ğü¹µ…ÑÉ¥àñğmtì((€€¼¼!L€ôƒ².ƒªŞp€¬59@€¬ƒªâÃ®Î½½ƒ¶V§²
À(€½¹ÍĞ¡Ì€ôlÀ°€Ä°€È°€Ì°€Ñt¹É•‘Õ” ¡ÍÕ´°É¤¤€ôøì(€€€½¹ÍĞÉ½Ü€ôµ…ÑÉ¥ámÉ¥tñğmtì(€€€É•ÑÕÉ¸ÍÕ´€¬É½Ü¹É•‘Õ” ¡Ì°Ø¤€ôøÌ€¬€¡9Õµ‰•È¡Ø¤ñğ€À¤°€À¤ì(€ô°€À¤ì((€É•ÑÕÉ¸ì(€€€¡Ì°(€€€¡½µ”è½µÁ±•Ñ•‘!½µ•½Õ¹Ğ¡µ•É•‘É…™Ğ¤°(€€€ÑÙÉ•”è9Õµ‰•È¡µ•É•‘É…™Ğü¹¡½µ•±…Ğü¹ÑÙÉ•”ñğ€À¤°(€€€Íµ…ÉÑ!½µ”è9Õµ‰•È¡µ•É•‘É…™Ğü¹¡½µ•±…Ğü¹Íµ…ÉÑ!½µ”ñğ€À¤°(€€€Ñ…¥±½É•‘µ½Õ¹Ğè9Õµ‰•È¡µ•É•‘É…™Ğü¹Ñ…¥±½É•‘µ½Õ¹Ğñğ€À¤°(€€€Ñ…¥±½É•è9Õµ‰•È¡µ•É•‘É…™Ğü¹Ñ…¥±½É•‘½Õ¹Ğñğ€À¤°(€€€Á½¥¹ÑÌè9Õµ‰•È¡Á…äü¹Ñ½Ñ…±A½¥¹ÑÌñğ€À¤°(€€€­Á¤è9Õµ‰•È¡Á…äü¹­Á¥M½É”ñğ€À¤°(€€€¥¹•¹Ñ¥Ù”è9Õµ‰•È¡Á…äü¹Ñ½Ñ…°ñğ€À¤°(€ôì)ô()™Õ¹Ñ¥½¸5½¹Ñ¡±å½…±…É¡ìµ½¹Ñ °µ•É•‘É…™Ğ°Á…ä°½…±Ì°½¹M…Ù”°Í…Ù¥¹œô¤ì(€½¹ÍĞm•‘¥Ñ¥¹œ°Í•Ñ‘¥Ñ¥¹t€ôÕÍ•MÑ…Ñ”¡™…±Í”¤ì(€½¹ÍĞmÍ•±•Ñ•°Í•ÑM•±•Ñ•‘t€ôÕÍ•MÑ…Ñ”  ¤€ôø¹•ÜM•Ğ¡=‰©•Ğ¹­•åÌ¡½…±Ìñğíô¤¤¤ì(€½¹ÍĞmÙ…±Õ•Ì°Í•ÑY…±Õ•Ít€ôÕÍ•MÑ…Ñ”¡½…±Ìñğíô¤ì((€ÕÍ•™™•Ğ  ¤€ôøì(€€€Í•ÑM•±•Ñ•¡¹•ÜM•Ğ¡=‰©•Ğ¹­•åÌ¡½…±Ìñğíô¤¤¤ì(€€€Í•ÑY…±Õ•Ì¡½…±Ìñğíô¤ì(€ô°m½…±Ì°µ½¹Ñ¡t¤ì((€½¹ÍĞ…ÑÕ…±Ì€ôÕÍ•5•µ¼  ¤€ôø•ÑA•ÉÍ½¹…±½…±ÑÕ…±Ì¡µ•É•‘É…™Ğ°Á…ä¤°mµ•É•‘É…™Ğ°Á…åt¤ì(€½¹ÍĞ¡…Í½…±Ì€ô=‰©•Ğ¹­•åÌ¡½…±Ìñğíô¤¹±•¹Ñ €ø€Àì((€½¹ÍĞÑ½±”€ô€¡­•ä¤€ôøì(€€€Í•ÑM•±•Ñ• ¡ÁÉ•Ø¤€ôøì(€€€€€½¹ÍĞ¹•áĞ€ô¹•ÜM•Ğ¡ÁÉ•Ø¤ì(€€€€€¥˜€¡¹•áĞ¹¡…Ì¡­•ä¤¤ì(€€€€€€€¹•áĞ¹‘•±•Ñ”¡­•ä¤ì(€€€€€ô•±Í”ì(€€€€€€€¹•áĞ¹…‘¡­•ä¤ì(€€€€€€€¥˜€ „¡9Õµ‰•È¡Ù…±Õ•Ím­•åt¤€ø€À¤¤ì(€€€€€€€€€½¹ÍĞ‘•˜€ôAIM=91}=1}L¹™¥¹ ¡¤€ôø¹­•ä€ôôô­•ä¤ì(€€€€€€€€€Í•ÑY…±Õ•Ì ¡Ø¤€ôø€¡ì€¸¸¹Ø°m­•åtè‘•˜ü¹‘•™…Õ±ÑQ…É•Ğñğ€ÄÀô¤¤ì(€€€€€€€ô(€€€€€ô(€€€€€É•ÑÕÉ¸¹•áĞì(€€€ô¤ì(€ôì((€½¹ÍĞÍ…Ù”€ô…Íå¹Œ€ ¤€ôøì(€€€½¹ÍĞÁ…å±½…€ôíôì(€€€AIM=91}=1}L¹™½É…  ¡‘•˜¤€ôøì(€€€€€¥˜€ …Í•±•Ñ•¹¡…Ì¡‘•˜¹­•ä¤¤É•ÑÕÉ¸ì(€€€€€½¹ÍĞ¸€ô9Õµ‰•È¡Ù…±Õ•Ím‘•˜¹­•åt¤ì(€€€€€¥˜€¡9Õµ‰•È¹¥Í¥¹¥Ñ”¡¸¤€˜˜¸€ø€À¤Á…å±½…‘m‘•˜¹­•åt€ô¸ì(€€€ô¤ì((€€€¥˜€ …=‰©•Ğ¹­•åÌ¡Á…å±½…¤¹±•¹Ñ ¤É•ÑÕÉ¸ì(€€€½¹ÍĞ½¬€ô…İ…¥Ğ½¹M…Ù”¡Á…å±½…¤ì(€€€¥˜€¡½¬¤Í•Ñ‘¥Ñ¥¹œ¡™…±Í”¤ì(€ôì((€¥˜€ …¡…Í½…±Ìñğ•‘¥Ñ¥¹œ¤ì(€€€É•ÑÕÉ¸€ (€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµİ¡¥Ñ”É½Õ¹‘•µá°‰½É‘•È‰½É‘•ÈµÉ…ä´ÄÀÀÀ´Ğˆø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÙ¥½±•Ğ´ØÀÀˆø(€€€€€€€€€ƒ®
c²v`íÁ…ÉÍ•%¹Ğ¡µ½¹Ñ ¹ÍÁ±¥Ğ œ´œ¥lÅt°€ÄÀ¥÷²nP(€€€€€€€€ğ½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´™½¹Ğµ‰½±Ñ•áĞµÉ…ä´äÀÀµĞ´Äˆû²vÓ®Ê ƒ®.°ƒ®
Ğƒ®ª§¶Fpğ½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÅÁátÑ•áĞµÉ…ä´ĞÀÀµĞ´Äˆø(€€€€€€€€€ƒ²nC¶Vc®*Pƒ².“²‚ƒ¶V·®ª§²vƒ²ƒ¶w¶VcªÎ€ƒ²vÓ®Ê ƒ®.°ƒ®ª§¶Fs®–ğƒ²‚W¶VÓ®ÎÓ²ã²jP¸(€€€€€€€€ğ½‘¥Øø((€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´ÌÍÁ…”µä´Èˆø(€€€€€€€€€íAIM=91}=1}L¹µ…À ¡‘•˜¤€ôøì(€€€€€€€€€€€½¹ÍĞ¡•­•€ôÍ•±•Ñ•¹¡…Ì¡‘•˜¹­•ä¤ì(€€€€€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€€€ñ‘¥Ø­•äõí‘•˜¹­•åô±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È…À´Èˆø(€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€€€€€½¹±¥¬õì ¤€ôøÑ½±”¡‘•˜¹­•ä¥ô(€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õíÜ´Ô ´ÔÉ½Õ¹‘•‰½É‘•È™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ•¹Ñ•ÈÍ¡É¥¹¬´À€‘ì(€€€€€€€€€€€€€€€€€€€¡•­•(€€€€€€€€€€€€€€€€€€€€€€ü€‰œµÙ¥½±•Ğ´ØÀÀ‰½É‘•ÈµÙ¥½±•Ğ´ØÀÀÑ•áĞµİ¡¥Ñ”œ(€€€€€€€€€€€€€€€€€€€€€€è€‰œµİ¡¥Ñ”‰½É‘•ÈµÉ…ä´ÌÀÀÑ•áĞµÑÉ…¹ÍÁ…É•¹Ğœ(€€€€€€€€€€€€€€€€€õô(€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€ñ¡•¬Í¥é”õìÄÍô€¼ø(€€€€€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø((€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ü´ÈÀÑ•áĞµÍ´Ñ•áĞµÉ…ä´ÜÀÀˆùí‘•˜¹±…‰•±ôğ½‘¥Øø((€€€€€€€€€€€€€€€€ñ¥¹ÁÕĞ(€€€€€€€€€€€€€€€€€ÑåÁ”ô‰¹Õµ‰•Èˆ(€€€€€€€€€€€€€€€€€µ¥¸ôˆÀˆ(€€€€€€€€€€€€€€€€€ÍÑ•Àõí‘•˜¹Õ¹¥Ğ€ôôô€Ÿ²n@œ€ü€œÄÀÀÀÀœ€è€¡‘•˜¹Õ¹¥Ğ€ôôô€@œ€ü€œÀ¸Äœ€è€œÄœ¥ô(€€€€€€€€€€€€€€€€€‘¥Í…‰±•õì…¡•­•‘ô(€€€€€€€€€€€€€€€€€Ù…±Õ”õíÙ…±Õ•Ím‘•˜¹­•åt€üü€œô(€€€€€€€€€€€€€€€€€½¹¡…¹”õì¡”¤€ôøÍ•ÑY…±Õ•Ì ¡Ø¤€ôø€¡ì€¸¸¹Ø°m‘•˜¹­•åtè”¹Ñ…É•Ğ¹Ù…±Õ”ô¤¥ô(€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰µ¥¸µÜ´À™±•à´Ä‰½É‘•È‰½É‘•ÈµÉ…ä´ÈÀÀÉ½Õ¹‘•µ±œÁà´ÌÁä´ÈÑ•áĞµÍ´½ÕÑ±¥¹”µ¹½¹”™½ÕÌéÉ¥¹œ´È™½ÕÌéÉ¥¹œµÙ¥½±•Ğ´ÈÀÀ‘¥Í…‰±•é‰œµÉ…ä´ÔÀ‘¥Í…‰±•éÑ•áĞµÉ…ä´ÌÀÀˆ(€€€€€€€€€€€€€€€€€Á±…•¡½±‘•Èô‹®ª§¶Fpˆ(€€€€€€€€€€€€€€€€¼ø((€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ü´ØÑ•áĞµáÌÑ•áĞµÉ…ä´ĞÀÀˆùí‘•˜¹Õ¹¥Ñôğ½‘¥Øø(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€¤ì(€€€€€€€€€ô¥ô(€€€€€€€€ğ½‘¥Øø((€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´Ğ™±•à…À´Èˆø(€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€½¹±¥¬õíÍ…Ù•ô(€€€€€€€€€€€‘¥Í…‰±•õíÍ…Ù¥¹œñğÍ•±•Ñ•¹Í¥é”€ôôô€Áô(€€€€€€€€€€€±…ÍÍ9…µ”ô‰™±•à´ÄÁà´ÌÁä´ÈÉ½Õ¹‘•µ±œ‰œµÙ¥½±•Ğ´ØÀÀÑ•áĞµİ¡¥Ñ”Ñ•áĞµÍ´™½¹ĞµÍ•µ¥‰½±‘¥Í…‰±•é½Á…¥Ñä´ÔÀˆ(€€€€€€€€€€ø(€€€€€€€€€€€íÍ…Ù¥¹œ€ü€Ÿ²‚²z”ƒ²’Dœ€è€Ÿ®ª§¶Fpƒ²‚²z”ô(€€€€€€€€€€ğ½‰ÕÑÑ½¸ø((€€€€€€€€€í¡…Í½…±Ì€˜˜€ (€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€½¹±¥¬õì ¤€ôøÍ•Ñ‘¥Ñ¥¹œ¡™…±Í”¥ô(€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰Áà´ĞÁä´ÈÉ½Õ¹‘•µ±œ‰œµÉ…ä´ÄÀÀÑ•áĞµÉ…ä´ÔÀÀÑ•áĞµÍ´ˆ(€€€€€€€€€€€€ø(€€€€€€€€€€€€€ƒ²Ş£²0(€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€¥ô(€€€€€€€€ğ½‘¥Øø(€€€€€€ğ½‘¥Øø(€€€€¤ì(€ô((€½¹ÍĞ…Ñ¥Ù••™Ì€ôAIM=91}=1}L¹™¥±Ñ•È ¡‘•˜¤€ôø9Õµ‰•È¡½…±Ìü¹m‘•˜¹­•åt¤€ø€À¤ì(€½¹ÍĞ½µÁ±•Ñ•½Õ¹Ğ€ô…Ñ¥Ù••™Ì¹™¥±Ñ•È ¡‘•˜¤€ôøì(€€€½¹ÍĞÑ…É•Ğ€ô9Õµ‰•È¡½…±Ím‘•˜¹­•åt¤ì(€€€½¹ÍĞÕÉÉ•¹Ğ€ô9Õµ‰•È¡…ÑÕ…±Ím‘•˜¹­•åtñğ€À¤ì(€€€É•ÑÕÉ¸ÕÉÉ•¹Ğ€øôÑ…É•Ğì(€ô¤¹±•¹Ñ ì((€É•ÑÕÉ¸€ (€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµİ¡¥Ñ”É½Õ¹‘•µá°‰½É‘•È‰½É‘•ÈµÉ…ä´ÄÀÀÀ´Ğˆø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµÍÑ…ÉĞ©ÕÍÑ¥™äµ‰•Ñİ••¸…À´Ìˆø(€€€€€€€€ñ‘¥Øø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÙ¥½±•Ğ´ØÀÀˆø(€€€€€€€€€€€ƒ®
c²v`íÁ…ÉÍ•%¹Ğ¡µ½¹Ñ ¹ÍÁ±¥Ğ œ´œ¥lÅt°€ÄÀ¥÷²nP(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´™½¹Ğµ‰½±Ñ•áĞµÉ…ä´äÀÀµĞ´Äˆû²vÓ®Ê ƒ®.°ƒ®
Ğƒ®ª§¶Fpğ½‘¥Øø(€€€€€€€€ğ½‘¥Øø((€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€½¹±¥¬õì ¤€ôøÍ•Ñ‘¥Ñ¥¹œ¡ÑÉÕ”¥ô(€€€€€€€€€±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ…ä´ĞÀÀ¡½Ù•ÈéÑ•áĞµÙ¥½±•Ğ´ØÀÀˆ(€€€€€€€€ø(€€€€€€€€€ƒ²"c²‚T(€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€ğ½‘¥Øø((€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´ĞÍÁ…”µä´Ğˆø(€€€€€€€í…Ñ¥Ù••™Ì¹µ…À ¡‘•˜¤€ôøì(€€€€€€€€€½¹ÍĞÑ…É•Ğ€ô9Õµ‰•È¡½…±Ím‘•˜¹­•åt¤ì(€€€€€€€€€½¹ÍĞÕÉÉ•¹Ğ€ô9Õµ‰•È¡…ÑÕ…±Ím‘•˜¹­•åtñğ€À¤ì(€€€€€€€€€½¹ÍĞÁĞ€ôÑ…É•Ğ€ø€À€ü5…Ñ ¹µ…à À°5…Ñ ¹µ¥¸ ÄÀÀ°€¡ÕÉÉ•¹Ğ€¼Ñ…É•Ğ¤€¨€ÄÀÀ¤¤€è€Àì(€€€€€€€€€½¹ÍĞ…¡¥•Ù•€ôÕÉÉ•¹Ğ€øôÑ…É•Ğì((€€€€€€€€€½¹ÍĞÕÉÉ•¹Ñ1…‰•°€ô‘•˜¹Õ¹¥Ğ€ôôô€Ÿ²n@œ(€€€€€€€€€€€€ü™µÑ9Õ´¡5…Ñ ¹É½Õ¹¡ÕÉÉ•¹Ğ¤¤(€€€€€€€€€€€€è‘•˜¹Õ¹¥Ğ€ôôô€@œ(€€€€€€€€€€€€€€üÕÉÉ•¹Ğ¹Ñ½¥á• Ä¤(€€€€€€€€€€€€€€è5…Ñ ¹É½Õ¹¡ÕÉÉ•¹Ğ¤¹Ñ½MÑÉ¥¹œ ¤ì((€€€€€€€€€½¹ÍĞÑ…É•Ñ1…‰•°€ô‘•˜¹Õ¹¥Ğ€ôôô€Ÿ²n@œ(€€€€€€€€€€€€ü™µÑ9Õ´¡5…Ñ ¹É½Õ¹¡Ñ…É•Ğ¤¤(€€€€€€€€€€€€è‘•˜¹Õ¹¥Ğ€ôôô€@œ(€€€€€€€€€€€€€€üÑ…É•Ğ¹Ñ½¥á• Ä¤(€€€€€€€€€€€€€€è5…Ñ ¹É½Õ¹¡Ñ…É•Ğ¤¹Ñ½MÑÉ¥¹œ ¤ì((€€€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€ñ‘¥Ø­•äõí‘•˜¹­•åôø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•Ñİ••¸…À´Ìˆø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´™½¹Ğµµ•‘¥Õ´Ñ•áĞµÉ…ä´ÜÀÀˆùí‘•˜¹±…‰•±ôğ½‘¥Øø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÑ•áĞµÍ´™½¹Ğµ‰½±€‘í…¡¥•Ù•€ü€Ñ•áĞµ•µ•É…±´ØÀÀœ€è€Ñ•áĞµÉ…ä´àÀÀõôø(€€€€€€€€€€€€€€€€€íÕÉÉ•¹Ñ1…‰•±ô€¼íÑ…É•Ñ1…‰•±õí‘•˜¹Õ¹¥Ñô(€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€ğ½‘¥Øø((€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰ ´È‰œµÉ…ä´ÄÀÀÉ½Õ¹‘•µ™Õ±°½Ù•É™±½Üµ¡¥‘‘•¸µĞ´Èˆø(€€€€€€€€€€€€€€€€ñ‘¥Ø(€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õí µ™Õ±°É½Õ¹‘•µ™Õ±°ÑÉ…¹Í¥Ñ¥½¸µ…±°‘ÕÉ…Ñ¥½¸´ÔÀÀ€‘ì(€€€€€€€€€€€€€€€€€€€…¡¥•Ù•€ü€‰œµ•µ•É…±´ÔÀÀœ€è€‰œµÙ¥½±•Ğ´ØÀÀœ(€€€€€€€€€€€€€€€€€õô(€€€€€€€€€€€€€€€€€ÍÑå±”õíìİ¥‘Ñ è€‘íÁÑô•€õô(€€€€€€€€€€€€€€€€¼ø(€€€€€€€€€€€€€€ğ½‘¥Øø((€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÅÁátµĞ´Ä¸Ôˆø(€€€€€€€€€€€€€€€í…¡¥•Ù•€ü€ (€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰™½¹ĞµÍ•µ¥‰½±Ñ•áĞµ•µ•É…±´ØÀÀˆû®ª§¶Fpƒ®.³²Ä„ƒÂ~:$ğ½ÍÁ…¸ø(€€€€€€€€€€€€€€€€¤€è€ (€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµÉ…ä´ĞÀÀˆùí5…Ñ ¹É½Õ¹¡ÁĞ¥ô”ƒ²¶Z$ƒ²’Dğ½ÍÁ…¸ø(€€€€€€€€€€€€€€€€¥ô(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€¤ì(€€€€€€€ô¥ô(€€€€€€ğ½‘¥Øø((€€€€€í…Ñ¥Ù••™Ì¹±•¹Ñ €ø€Ä€˜˜€ (€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´ĞÁĞ´Ì‰½É‘•ÈµĞ‰½É‘•ÈµÉ…ä´ÄÀÀÑ•áĞµáÌÑ•áĞµÉ…ä´ÔÀÀˆø(€€€€€€€€€ƒ²vÓ®Ê ƒ®.°ƒ®ª§¶Fpí½µÁ±•Ñ•½Õ¹Ñô€¼í…Ñ¥Ù••™Ì¹±•¹Ñ¡÷ªÂpƒ®.³²Ä(€€€€€€€€ğ½‘¥Øø(€€€€€€¥ô(€€€€ğ½‘¥Øø(€€¤ì)ô(()™Õ¹Ñ¥½¸5å5½¹Ñ¡±åA•É™½Éµ…¹•…É¡ì‘É…™Ğ°Á…ä°Á•ÉÍ½¹…±½…±Ì°‘…¥±å…åÌ°µ½¹Ñ °½¹™¥œ°½¹M…Ù•½…±Ì°½…±M…Ù¥¹œô¤ì(€½¹ÍĞm½…±‘¥Ñ¥¹œ±Í•Ñ½…±‘¥Ñ¥¹tõÕÍ•MÑ…Ñ”¡™…±Í”¤ì(€½¹ÍĞm½…±Y…±Õ•Ì±Í•Ñ½…±Y…±Õ•ÍtõÕÍ•MÑ…Ñ”¡Á•ÉÍ½¹…±½…±Íññíô¤ì(€ÕÍ•™™•Ğ  ¤ôùÍ•Ñ½…±Y…±Õ•Ì¡Á•ÉÍ½¹…±½…±Íññíô¤±mÁ•ÉÍ½¹…±½…±Ì±µ½¹Ñ¡t¤ì(€½¹ÍĞÍ¥µ5¹ÁQ½Ñ…°ô¡‘É…™Ğü¹µ…ÑÉ¥àü¹lÕuññmt¤¹É•‘Õ” ¡Ì±Ø¤ôùÌ­9Õµ‰•È¡ÙñğÀ¤°À¤ì(€½¹ÍĞÍ•½¹‘MÑ…¹‘…±½¹”ô¡‘É…™Ğü¹µ…ÑÉ¥àü¹lİuññmt¤¹É•‘Õ” ¡Ì±Ø¤ôùÌ­9Õµ‰•È¡ÙñğÀ¤°À¤ì(€½¹ÍĞÍ•½¹‘	Õ¹‘±”õ=‰©•Ğ¹Ù…±Õ•Ì¡‘É…™Ğü¹‰Õ¹‘±”É¹‘ññíô¤¹É•‘Õ” ¡Ì±Ø¤ôùÌ­9Õµ‰•È¡ÙñğÀ¤°À¤ì(€½¹ÍĞµ•ÑÉ¥Ìõl(€€€í­•äè¡Ìœ±½…±-•äè¡Ìœ±±…‰•°è!Lœ±Õ¹¥Ğè½Õ¹Ğœ±Ù…±Õ”é¡Í½Õ¹Ğ¡‘É…™Ğ¥ô°(€€€í­•äèÍ¥µ5¹Àœ±½…±-•äèÍ¥µ5¹Àœ±±…‰•°èM%459@œ±Õ¹¥Ğè½Õ¹Ğœ±Ù…±Õ”éÍ¥µ5¹ÁQ½Ñ…±ô°(€€€í­•äèÍ•½¹œ±½…±-•äèÍ•½¹œ±±…‰•°èœÉ9œ±Õ¹¥Ğè½Õ¹Ğœ±Ù…±Õ”éÍ•½¹‘MÑ…¹‘…±½¹”­Í•½¹‘	Õ¹‘±•ô°(€€€í­•äèÁÉ½‘ÕÑ¥Ù¥Ñäœ±½…±-•äè­Á¤œ±±…‰•°èŸ²w²
Ã²Äœ±Õ¹¥ĞèÁ½¥¹Ğœ±Ù…±Õ”é9Õµ‰•È¡Á…äü¹­Á¥M½É•ñğÀ¥ô°(€€€í­•äè¡½µ”œ±½…±-•äè¡½µ”œ±±…‰•°èŸ¶f œ±Õ¹¥Ğè½Õ¹Ğœ±Ù…±Õ”é½µÁ±•Ñ•‘!½µ•½Õ¹Ğ¡‘É…™Ğ¥ô°(€€€í­•äèÑÙÉ•”œ±½…±-•äèÑÙÉ•”œ±±…‰•°èŸ¶R®š°œ±Õ¹¥Ğè½Õ¹Ğœ±Ù…±Õ”é9Õµ‰•È¡‘É…™Ğü¹¡½µ•±…Ğü¹ÑÙÉ••ñğÀ¥ô°(€€€í­•äèÍµ…ÉÑ!½µ”œ±½…±-•äèÍµ…ÉÑ!½µ”œ±±…‰•°èŸ²*“¶f œ±Õ¹¥Ğè½Õ¹Ğœ±Ù…±Õ”é9Õµ‰•È¡‘É…™Ğü¹¡½µ•±…Ğü¹Íµ…ÉÑ!½µ•ñğÀ¥ô°(€€€í­•äèÍ½¹¼œ±½…±-•äèÍ½¹¼œ±±…‰•°èŸ²3®àœ±Õ¹¥Ğè½Õ¹Ğœ±Ù…±Õ”é=‰©•Ğ¹Ù…±Õ•Ì¡‘É…™Ğü¹Í½¹½ññíô¤¹É•‘Õ” ¡Ì±Ø¤ôùÌ­9Õµ‰•È¡ÙñğÀ¤°À¥ô°(€€€í­•äèÑ…¥±½É•‘µ½Õ¹Ğœ±½…±-•äèÑ…¥±½É•‘µ½Õ¹Ğœ±±…‰•°èŸ®{²Ú“²‚s²V ƒ®“²Ús²V„œ±Õ¹¥Ğèİ½¸œ±Ù…±Õ”é9Õµ‰•È¡‘É…™Ğü¹Ñ…¥±½É•‘µ½Õ¹ÑñğÀ¥ô°(€€€í­•äèÑ…¥±½É•‘½Õ¹Ğœ±½…±-•äèÑ…¥±½É•œ±±…‰•°èŸ²^²ªÆĞœ±Õ¹¥Ğè½Õ¹Ğœ±Ù…±Õ”é9Õµ‰•È¡‘É…™Ğü¹Ñ…¥±½É•‘½Õ¹ÑñğÀ¥ô°(€tì(€½¹ÍĞm‘•Ñ…¥±5•ÑÉ¥Œ±Í•Ñ•Ñ…¥±5•ÑÉ¥tõÕÍ•MÑ…Ñ”¡¹Õ±°¤ì((€½¹ÍĞ½…±½Èô¡´¤ôù9Õµ‰•È¡Á•ÉÍ½¹…±½…±Ìü¹m´¹½…±-•åuñğÀ¤ì((€½¹ÍĞ™½É•…ÍÑ…Ñ½ÈõÕÍ•5•µ¼  ¤ôùì(€€€½¹ÍĞ¹½Üõ¹•Ü…Ñ” ¤°ÕÉÉ•¹Ğõµ½¹Ñ¡-•å=˜¡¹½Ü¤ôôõµ½¹Ñ ì(€€€¥˜ …ÕÉÉ•¹Ğ¥É•ÑÕÉ¸€Äì(€€€½¹ÍĞÑ½Ñ…°õ‘…åÍ%¹5½¹Ñ ¡µ½¹Ñ ¤±Ñ½‘…äõ5…Ñ ¹µ¥¸¡¹½Ü¹•Ñ…Ñ” ¤±Ñ½Ñ…°¤ì(€€€±•Ğ•±…ÁÍ•ôÀ±İ½É­¥¹œôÀì(€€€™½È¡±•Ğ‘…äôÄí‘…äğõÑ½Ñ…°í‘…ä¬¬¥ì(€€€€€½¹ÍĞ­•äõMÑÉ¥¹œ¡‘…ä¤¹Á…‘MÑ…ÉĞ È°œÀœ¤ì(€€€€€¥˜¡¹½Éµ…±¥é•…ä¡‘…¥±å…åÌü¹m­•åt¤¹‘…å=™˜¥½¹Ñ¥¹Õ”ì(€€€€€İ½É­¥¹œ¬¬ì(€€€€€¥˜¡‘…äğõÑ½‘…ä¥•±…ÁÍ•¬¬ì(€€€ô(€€€É•ÑÕÉ¸•±…ÁÍ•øÀıİ½É­¥¹œ½•±…ÁÍ•èÄì(€ô±m‘…¥±å…åÌ±µ½¹Ñ¡t¤ì((€½¹ÍĞ™½É•…ÍÑ½Èô¡´¤ôùì(€€€½¹ÍĞÙ…±Õ”õ9Õµ‰•È¡´¹Ù…±Õ•ñğÀ¤©™½É•…ÍÑ…Ñ½Èì(€€€É•ÑÕÉ¸´¹Õ¹¥Ğôôô½Õ¹Ğœı5…Ñ ¹É½Õ¹¡Ù…±Õ”¤éÙ…±Õ”ì(€ôì(€½¹ÍĞµ¥ÍÍ¥¹½…±½Õ¹Ğõµ•ÑÉ¥Ì¹™¥±Ñ•È¡´ôù½…±½È¡´¤ğôÀ¤¹±•¹Ñ ì((€½¹ÍĞÉ•¹‘•É5•ÑÉ¥Y…±Õ”ô¡´±Ù…±Õ”¤ôùì(€€€¥˜¡´¹Õ¹¥Ğôôôİ½¸œ¤É•ÑÕÉ¸İ½¸¡5…Ñ ¹É½Õ¹¡Ù…±Õ”¤¤ì(€€€¥˜¡´¹Õ¹¥ĞôôôÁ½¥¹Ğœ¤É•ÑÕÉ¸€‘í™µÑ9Õ´¡9Õµ‰•È¡Ù…±Õ•ñğÀ¤°Ä¥õA€ì(€€€É•ÑÕÉ¸€‘í™µÑ9Õ´¡9Õµ‰•È¡Ù…±Õ•ñğÀ¤±9Õµ‰•È¡Ù…±Õ•ñğÀ¤”ÄüÄèÀ¥÷ªÆÑ€ì(€ôì((€½¹ÍĞ‘•Ñ…¥±I½İÌõÕÍ•5•µ¼  ¤ôùì(€€€¥˜ …‘•Ñ…¥±5•ÑÉ¥Œ¥É•ÑÕÉ¸mtì(€€€½¹ÍĞ½ÕĞõmtì(€€€½¹ÍĞ‘…åÌõ=‰©•Ğ¹•¹ÑÉ¥•Ì¡‘…¥±å…åÍññíô¤¹Í½ÉĞ ¡m…t±m‰t¤ôù9Õµ‰•È¡„¤µ9Õµ‰•È¡ˆ¤¤ì(€€€½¹ÍĞ…‘ô¡‘…ä±±…‰•°±Ù…±Õ”±Õ¹¥Ğô½Õ¹Ğœ±ÍÕˆôœœ¤ôùì(€€€€€½¹ÍĞ¸õ9Õµ‰•È¡Ù…±Õ•ñğÀ¤ì¥˜ …¸¥É•ÑÕÉ¸ì(€€€€€½ÕĞ¹ÁÕÍ ¡í‘…ä±±…‰•°±Ù…±Õ”é¸±Õ¹¥Ğ±ÍÕ‰ô¤ì(€€€ôì(€€€‘…åÌ¹™½É…  ¡m‘±É…İt¤ôùì(€€€€€½¹ÍĞõ¹½Éµ…±¥é•…ä¡É…Ü¤ì(€€€€€¥˜¡‘•Ñ…¥±5•ÑÉ¥Œ¹­•äôôô¡Ìœ¥ì(€€€€€€€lÀ°Ä°È°Ì°Ñt¹™½É… ¡É¤ôùì(€€€€€€€€€€¡¹µ…ÑÉ¥àü¹mÉ¥uññmt¤¹™½É…  ¡¹Ğ±¤¤ôùì(€€€€€€€€€€€¥˜ …¹Ğ¥É•ÑÕÉ¸ì(€€€€€€€€€€€½¹ÍĞÉõ5QI%a}I=]}MmÉ¥tì(€€€€€€€€€€€…‘¡‘±Éü¹‘…¥±å1…‰•±ññÉü¹±…‰•±ñğŸ®ª£®ÂS²vğœ±¹Ğ°½Õ¹Ğœ±Éü¹¡…ÍQ¥•ÉÌü¡5QI%a}=1Mm¥uñğœœ¤èœœ¤ì(€€€€€€€€€ô¤ì(€€€€€€€ô¤ì(€€€€€ô•±Í”¥˜¡‘•Ñ…¥±5•ÑÉ¥Œ¹­•äôôôÍ¥µ5¹Àœ¥ì(€€€€€€€€¡¹µ…ÑÉ¥àü¹lÕuññmt¤¹™½É…  ¡¹Ğ±¤¤ôùì¥˜¡¹Ğ¥…‘¡‘°M%459@œ±¹Ğ°½Õ¹Ğœ±5QI%a}=1Mm¥uñğœœ¤ìô¤ì(€€€€€ô•±Í”¥˜¡‘•Ñ…¥±5•ÑÉ¥Œ¹­•äôôôÍ•½¹œ¥ì(€€€€€€€½¹ÍĞÍÑ…¹‘…±½¹”ô¡¹µ…ÑÉ¥àü¹lİuññmt¤¹É•‘Õ” ¡„±Ø¤ôù„­9Õµ‰•È¡ÙñğÀ¤°À¤ì…‘¡‘°œÉ9®.£®>œ±ÍÑ…¹‘…±½¹”¤ì(€€€€€€€=‰©•Ğ¹•¹ÑÉ¥•Ì¡¹É½ÕÁÌü¹‰Õ¹‘±”É¹‘ññíô¤¹™½É…  ¡m¬±¹Ñt¤ôùì(€€€€€€€€€½¹ÍĞ¥Ñ•´ô¡½¹™¥œü¹‰Õ¹‘±”É¹‘ññU1Q}	U91É9¤¹™¥¹¡àôùà¹­•äôôõ¬¤ì…‘¡‘±¥Ñ•´ü¹±…‰•±ññ¬±¹Ğ¤ì(€€€€€€€ô¤ì(€€€€€ô•±Í”¥˜¡‘•Ñ…¥±5•ÑÉ¥Œ¹­•äôôôÁÉ½‘ÕÑ¥Ù¥Ñäœ¥ì(€€€€€€€½¹ÍĞ½¹”õ…ÁÁ±å…¥±åQ½É…™Ğ¡•µÁÑåÉ…™Ğ ¤±ím‘‘té‘ô±µ½¹Ñ ±½¹™¥œü¹…Ñ•½Éå5…À±½¹™¥œü¹¥‰å•½¹½±Õµ¹5…À¤ì(€€€€€€€€¡½¹™¥œü¹­Á¥%Ñ•µÍññU1Q}-A%}%Q5L¤¹™½É… ¡¥Ñ•´ôùì(€€€€€€€€€½¹ÍĞ¹Ğõ9Õµ‰•È¡½¹”¹­Á¤ü¹m¥Ñ•´¹­•åuñğÀ¤ì¥˜¡¹Ğ¥…‘¡‘±¥Ñ•´¹±…‰•°±¹Ğ©9Õµ‰•È¡¥Ñ•´¹Á½¥¹ÑñğÀ¤°Á½¥¹Ğœ±€‘í™µÑ½Õ¹Ğ¡¹Ğ¥÷ªÆĞƒ\€‘í™µÑ9Õ´¡9Õµ‰•È¡¥Ñ•´¹Á½¥¹ÑñğÀ¤°Ä¥õA€¤ì(€€€€€€€ô¤ì(€€€€€ô•±Í”¥˜¡‘•Ñ…¥±5•ÑÉ¥Œ¹­•äôôô¡½µ”œ¥ì(€€€€€€€½¹ÍĞ¡ˆõ¹É½ÕÁÌü¹¡½µ•	…Í•ññíôì…‘¡‘°Ÿ¶f ƒ®.£®>œ±¡ˆ¹¡½µ•=¹±ä¤ì…‘¡‘°Ÿ¶f ­QXœ±¡ˆ¹¡½µ•QØ¤ì(€€€€€ô•±Í”¥˜¡‘•Ñ…¥±5•ÑÉ¥Œ¹­•äôôôÑÙÉ•”œ¤…‘¡‘°Q[¶R®š°£®Ú ¤œ±¹É½ÕÁÌü¹¡½µ•±…Ğü¹ÑÙÉ•”¤ì(€€€€€•±Í”¥˜¡‘•Ñ…¥±5•ÑÉ¥Œ¹­•äôôôÍµ…ÉÑ!½µ”œ¤…‘¡‘°Ÿ²*“®#¶*ã¶f œ±¹É½ÕÁÌü¹¡½µ•±…Ğü¹Íµ…ÉÑ!½µ”¤ì(€€€€€•±Í”¥˜¡‘•Ñ…¥±5•ÑÉ¥Œ¹­•äôôôÍ½¹¼œ¥ì(€€€€€€€=‰©•Ğ¹•¹ÑÉ¥•Ì¡¹É½ÕÁÌü¹Í½¹½ññíô¤¹™½É…  ¡m¬±¹Ñt¤ôùí½¹ÍĞ¥Ñ•´ô¡½¹™¥œü¹Í½¹½ññU1Q}M=9<¤¹™¥¹¡àôùà¹­•äôôõ¬¤í…‘¡‘±¥Ñ•´ü¹±…‰•±ññ¬±¹Ğ¤íô¤ì(€€€€€ô•±Í”¥˜¡‘•Ñ…¥±5•ÑÉ¥Œ¹­•äôôôÑ…¥±½É•‘µ½Õ¹Ğœ¤…‘¡‘°Ÿ®{²Ú“²‚s²V ƒ®“²Ús²V„œ±¹Ñ…¥±½É•‘µ½Õ¹Ğ°İ½¸œ¤ì(€€€€€•±Í”¥˜¡‘•Ñ…¥±5•ÑÉ¥Œ¹­•äôôôÑ…¥±½É•‘½Õ¹Ğœ¤…‘¡‘°Ÿ®{²Ú“²‚s²V ƒ²^² œ±¹Ñ…¥±½É•‘½Õ¹Ğ¤ì(€€€ô¤ì(€€€É•ÑÕÉ¸½ÕĞì(€ô±m‘•Ñ…¥±5•ÑÉ¥Œ±‘…¥±å…åÌ±µ½¹Ñ ±½¹™¥t¤ì((€½¹ÍĞ‘•Ñ…¥±Q½Ñ…°õ‘•Ñ…¥±I½İÌ¹É•‘Õ” ¡Ì±È¤ôùÌ­9Õµ‰•È¡È¹Ù…±Õ•ñğÀ¤°À¤ì(€½¹ÍĞ‘•Ñ…¥±Y…±Õ”ô¡È¤ôùÈ¹Õ¹¥Ğôôôİ½¸œıİ½¸¡È¹Ù…±Õ”¤éÈ¹Õ¹¥ĞôôôÁ½¥¹Ğœı€‘í™µÑ9Õ´¡9Õµ‰•È¡È¹Ù…±Õ”¤°Ä¥õA€é€‘í™µÑ½Õ¹Ğ¡È¹Ù…±Õ”¥÷ªÆÑ€ì((€É•ÑÕÉ¸€ğø(€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµİ¡¥Ñ”É½Õ¹‘•µá°‰½É‘•È‰½É‘•ÈµÉ…ä´ÄÀÀ½Ù•É™±½Üµ¡¥‘‘•¸ˆø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Áà´ĞÁä´Ì‰½É‘•Èµˆ‰½É‘•ÈµÉ…ä´ÔÀˆø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµÍÑ…ÉĞ©ÕÍÑ¥™äµ‰•Ñİ••¸…À´Èˆø(€€€€€€€€€€ñ‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ…ä´ĞÀÀˆûÂ~N(íµ½¹Ñ¡1…‰•°¡µ½¹Ñ ¥ôğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´™½¹Ğµ‰½±Ñ•áĞµÉ…ä´äÀÀµĞ´À¸Ôˆû²vÓ®Ê ƒ®.°ƒ®ª§¶Fpƒ¶b¶f¤ğ½‘¥Øøğ½‘¥Øø(€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤ôùÍ•Ñ½…±‘¥Ñ¥¹œ¡Øôø…Ø¥ô±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁát™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÙ¥½±•Ğ´ØÀÀˆùí½…±‘¥Ñ¥¹œüŸ®.¯ªâÀœèŸ®ª§¶Fpƒ²“²‚Tôğ½‰ÕÑÑ½¸ø(€€€€€€€€ğ½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀµĞ´Äˆû¶b²z°ƒ®"²‚ƒ².“²‚ªÎğƒ®
Ğƒ®ª§¶Fs®–ğƒ¶Vpƒ®Ê#²^@ƒ¶fW²vã¶VÓ²jP¸ƒ²"¯²zC®–ğƒ®"®–Ó®¦Ğƒ®
ƒ²s®Îƒ®
Ó²^·²vĞƒ²^Ó®‚“²jP¸ğ½‘¥Øø(€€€€€€€íµ¥ÍÍ¥¹½…±½Õ¹ĞøÀ˜˜…½…±‘¥Ñ¥¹œ˜˜ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùÍ•Ñ½…±‘¥Ñ¥¹œ¡ÑÉÕ”¥ô±…ÍÍ9…µ”ô‰Üµ™Õ±°µĞ´ÈÉ½Õ¹‘•µ±œ‰œµÉ•´ÔÀÁà´È¸ÔÁä´ÈÑ•áĞµ±•™ĞÑ•áĞµlåÁát™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÉ•´ØÀÀˆû®ª§¶Fpƒ®¾ã²“²‚Tíµ¥ÍÍ¥¹½…±½Õ¹Ñ÷ªÂpƒ
Üƒ²z®‚—¶Vc®¦Ğƒ²²Êg®>²f ƒ²b#²ƒ®#ªÂC²vƒ®æªÖC¶V€ƒ²"`ƒ²z#²ZÓ²jPƒŠèğ½‰ÕÑÑ½¸ùô(€€€€€€€í½…±‘¥Ñ¥¹œ˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´ÌÀ´Ì‰œµÉ…ä´ÔÀÉ½Õ¹‘•µá°ÍÁ…”µä´Èˆø(€€€€€€€€€íµ•ÑÉ¥Ì¹µ…À¡´ôøñ‘¥Ø­•äõí´¹­•åô±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È…À´ÈˆøñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ÔÀÀÜ´ÈĞÑÉÕ¹…Ñ”ˆùí´¹±…‰•±ôğ½ÍÁ…¸øñ¥¹ÁÕĞÑåÁ”ô‰¹Õµ‰•ÈˆÙ…±Õ”õí½…±Y…±Õ•Ím´¹½…±-•åtüüœô½¹¡…¹”õí”ôùÍ•Ñ½…±Y…±Õ•Ì¡Øôø¡ì¸¸¹Ø±m´¹½…±-•åté”¹Ñ…É•Ğ¹Ù…±Õ•ô¤¥ôÁ±…•¡½±‘•Èô‹®¾ã²“²‚Tˆ±…ÍÍ9…µ”ô‰µ¥¸µÜ´À™±•à´ÄÁà´ÈÁä´Ä¸ÔÉ½Õ¹‘•µ±œ‰½É‘•È‰½É‘•ÈµÉ…ä´ÈÀÀÑ•áĞµáÌˆ¼øñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµlåÁátÑ•áĞµÉ…ä´ĞÀÀˆùí´¹Õ¹¥Ğôôôİ½¸œüŸ²n@œé´¹Õ¹¥ĞôôôÁ½¥¹Ğœü@œèŸªÆĞôğ½ÍÁ…¸øğ½‘¥Øø¥ô(€€€€€€€€€€ñ‰ÕÑÑ½¸‘¥Í…‰±•õí½…±M…Ù¥¹ô½¹±¥¬õí…Íå¹Œ ¤ôùí½¹ÍĞ½¬õ…İ…¥Ğ½¹M…Ù•½…±Ìü¸¡½…±Y…±Õ•Ì¤í¥˜¡½¬¥Í•Ñ½…±‘¥Ñ¥¹œ¡™…±Í”¥õô±…ÍÍ9…µ”ô‰Üµ™Õ±°µĞ´ÄÁä´ÈÉ½Õ¹‘•µ±œ‰œµÙ¥½±•Ğ´ØÀÀÑ•áĞµİ¡¥Ñ”Ñ•áĞµáÌ™½¹Ğµ‰½±‘¥Í…‰±•é½Á…¥Ñä´ÔÀˆùí½…±M…Ù¥¹œüŸ²‚²z”ƒ²’DœèŸ®ª§¶Fpƒ²‚²z”ôğ½‰ÕÑÑ½¸ø(€€€€€€€€ğ½‘¥Øùô(€€€€€€ğ½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Áà´ÌÁä´Èˆø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É¥É¥µ½±Ìµmµ¥¹µ…à ÜÉÁà°Ä¸ÈÕ™È¥}µ¥¹µ…à ÔáÁà°Å™È¥}µ¥¹µ…à ÔÕÁà°¸å™È¥}µ¥¹µ…à ĞáÁà°¸á™È¥}µ¥¹µ…à ØÙÁà°Å™È¥t…À´ÄÁà´ÈÁˆ´ÈÑ•áĞµlåÁátÑ•áĞµÉ…ä´ĞÀÀÑ•áĞµÉ¥¡Ğˆø(€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµ±•™Ğˆû¶V·®ª¤ğ½ÍÁ…¸øñÍÁ…¸û®ª§¶Fpğ½ÍÁ…¸øñÍÁ…¸û².“²‚ğ½ÍÁ…¸øñÍÁ…¸û²²Êg®>ğ½ÍÁ…¸øñÍÁ…¸û²b#²ƒ®#ªÂ@ğ½ÍÁ…¸ø(€€€€€€€€ğ½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‘¥Ù¥‘”µä‘¥Ù¥‘”µÉ…ä´ÄÀÀˆø(€€€€€€€€€íµ•ÑÉ¥Ì¹µ…À¡´ôùì(€€€€€€€€€€€½¹ÍĞ½…°õ½…±½È¡´¤°™½É•…ÍĞõ™½É•…ÍÑ½È¡´¤ì(€€€€€€€€€€€½¹ÍĞÁĞõ½…°øÀı5…Ñ ¹µ¥¸ äää±5…Ñ ¹É½Õ¹¡9Õµ‰•È¡´¹Ù…±Õ•ñğÀ¤½½…°¨ÄÀÀ¤¤é¹Õ±°ì(€€€€€€€€€€€½¹ÍĞ™½É•…ÍÑ!¥Ğõ½…°øÀ˜™™½É•…ÍĞøõ½…°ì(€€€€€€€€€€€É•ÑÕÉ¸€ñ‘¥Ø­•äõí´¹­•åô±…ÍÍ9…µ”ô‰É¥É¥µ½±Ìµmµ¥¹µ…à ÜÉÁà°Ä¸ÈÕ™È¥}µ¥¹µ…à ÔáÁà°Å™È¥}µ¥¹µ…à ÔÕÁà°¸å™È¥}µ¥¹µ…à ĞáÁà°¸á™È¥}µ¥¹µ…à ØÙÁà°Å™È¥t…À´Ä¥Ñ•µÌµ•¹Ñ•ÈÁà´ÈÁä´È¸ÔÑ•áĞµÉ¥¡ĞÑ•áĞµlÄÁÁátˆø(€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùÍ•Ñ•Ñ…¥±5•ÑÉ¥Œ¡´¥ô±…ÍÍ9…µ”ô‰Ñ•áĞµ±•™Ğ™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÉ…ä´ÜÀÀÑÉÕ¹…Ñ”ˆùí´¹±…‰•±ôğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€í½…°øÀüñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµÉ…ä´ÔÀÀİ¡¥Ñ•ÍÁ…”µ¹½İÉ…ÀˆùíÉ•¹‘•É5•ÑÉ¥Y…±Õ”¡´±½…°¥ôğ½ÍÁ…¸øèñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùÍ•Ñ½…±‘¥Ñ¥¹œ¡ÑÉÕ”¥ô±…ÍÍ9…µ”ô‰©ÕÍÑ¥™äµÍ•±˜µ•¹É½Õ¹‘•µµ‰œµÉ•´ÔÀÁà´Ä¸ÔÁä´ÄÑ•áĞµláÁát™½¹Ğµ‰½±±•…‘¥¹œµÑ¥¡ĞÑ•áĞµÉ•´ØÀÀˆû²z®‚”ƒ¶V²jPğ½‰ÕÑÑ½¸ùô(€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùÍ•Ñ•Ñ…¥±5•ÑÉ¥Œ¡´¥ô±…ÍÍ9…µ”ô‰™½¹Ğµ‰½±Ñ•áĞµÉ…ä´äÀÀİ¡¥Ñ•ÍÁ…”µ¹½İÉ…ÀˆùíÉ•¹‘•É5•ÑÉ¥Y…±Õ”¡´±´¹Ù…±Õ”¥ôğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”õí™½¹Ğµ‰½±€‘íÁĞôôõ¹Õ±°üÑ•áĞµÉ…ä´ÌÀÀœéÁĞøôÄÀÀüÑ•áĞµ•µ•É…±´ØÀÀœéÁĞøôàÀüÑ•áĞµ…µ‰•È´ØÀÀœèÑ•áĞµÉ…ä´ÔÀÀõôùíÁĞôôõ¹Õ±°üŸŠPœé€‘íÁÑô•ôğ½ÍÁ…¸ø(€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”õí™½¹Ğµ‰½±İ¡¥Ñ•ÍÁ…”µ¹½İÉ…À€‘í½…°øÀü¡™½É•…ÍÑ!¥ĞüÑ•áĞµ•µ•É…±´ØÀÀœèÑ•áĞµÉ•´ÔÀÀœ¤èÑ•áĞµÙ¥½±•Ğ´ØÀÀõôùíÉ•¹‘•É5•ÑÉ¥Y…±Õ”¡´±™½É•…ÍĞ¥ôğ½ÍÁ…¸ø(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€ô¥ô(€€€€€€€€ğ½‘¥Øø(€€€€€€ğ½‘¥Øø(€€€€ğ½‘¥Øø(€€€í‘•Ñ…¥±5•ÑÉ¥Œ˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰™¥á•¥¹Í•Ğ´ÀèµlàÁt‰œµ‰±…¬¼ĞÀ™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ•¹Ñ•ÈÀ´Ğˆ½¹±¥¬õì ¤ôùÍ•Ñ•Ñ…¥±5•ÑÉ¥Œ¡¹Õ±°¥ôø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Üµ™Õ±°µ…àµÜµµ‰œµİ¡¥Ñ”É½Õ¹‘•´Íá°Í¡…‘½Ü´Éá°µ…àµ µlàÉÙ¡t½Ù•É™±½Üµ¡¥‘‘•¸ˆ½¹±¥¬õí”ôù”¹ÍÑ½ÁAÉ½Á……Ñ¥½¸ ¥ôø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Áà´ÔÁä´Ğ‰½É‘•Èµˆ™±•à©ÕÍÑ¥™äµ‰•Ñİ••¸…À´Ì¥Ñ•µÌµÍÑ…ÉĞˆø(€€€€€€€€€€ñ‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÙ¥½±•Ğ´ØÀÀˆùíµ½¹Ñ¡1…‰•°¡µ½¹Ñ ¥ôƒ².“²‚ƒ²²àğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµ±œ™½¹Ğµ‰½±Ñ•áĞµÉ…ä´äÀÀµĞ´À¸Ôˆùí‘•Ñ…¥±5•ÑÉ¥Œ¹±…‰•±ôƒ
ÜíÉ•¹‘•ÉY…±Õ”¡‘•Ñ…¥±5•ÑÉ¥Œ¥ôğ½‘¥Øøğ½‘¥Øø(€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤ôùÍ•Ñ•Ñ…¥±5•ÑÉ¥Œ¡¹Õ±°¥ô±…ÍÍ9…µ”ô‰Ü´à ´àÉ½Õ¹‘•µ™Õ±°‰œµÉ…ä´ÄÀÀÑ•áĞµÉ…ä´ÔÀÀÑ•áĞµ±œˆû\ğ½‰ÕÑÑ½¸ø(€€€€€€€€ğ½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰½Ù•É™±½Üµäµ…ÕÑ¼µ…àµ µlØÉÙ¡t‘¥Ù¥‘”µä‘¥Ù¥‘”µÉ…ä´ÔÀˆø(€€€€€€€€€í‘•Ñ…¥±I½İÌ¹±•¹Ñ ôôôÀüñ‘¥Ø±…ÍÍ9…µ”ô‰Áä´ÄÈÑ•áĞµ•¹Ñ•ÈÑ•áĞµÍ´Ñ•áĞµÉ…ä´ĞÀÀˆû®Âc²b®Bpƒ²²àƒ®
Ó²^·²vĞƒ²^²ZÓ²jP¸ğ½‘¥Øøé‘•Ñ…¥±I½İÌ¹µ…À ¡È±¤¤ôøñ‘¥Ø­•äõí€‘íÈ¹‘…åô´‘íÈ¹±…‰•±ô´‘í¥õô±…ÍÍ9…µ”ô‰Áà´ÔÁä´Ì™±•à©ÕÍÑ¥™äµ‰•Ñİ••¸…À´Ìˆø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µ¥¸µÜ´Àˆøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÉ…ä´àÀÀˆùíÁ…ÉÍ•%¹Ğ¡È¹‘…ä°ÄÀ¥÷²vğƒ
ÜíÈ¹±…‰•±ôğ½‘¥ØùíÈ¹ÍÕˆ˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÅÁátÑ•áĞµÉ…ä´ĞÀÀµĞ´À¸ÔˆùíÈ¹ÍÕ‰ôğ½‘¥Øùôğ½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´™½¹Ğµ‰½±Ñ•áĞµÙ¥½±•Ğ´ÜÀÀÍ¡É¥¹¬´Àˆùí‘•Ñ…¥±Y…±Õ”¡È¥ôğ½‘¥Øø(€€€€€€€€€€ğ½‘¥Øø¥ô(€€€€€€€€ğ½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Áà´ÔÁä´Ğ‰½É‘•ÈµĞ‰œµÉ…ä´ÔÀ™±•à©ÕÍÑ¥™äµ‰•Ñİ••¸¥Ñ•µÌµ•¹Ñ•Èˆø(€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ…ä´ÔÀÀˆû²²àƒ¶V§ªÎğ½ÍÁ…¸ø(€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰™½¹Ğµ‰½±Ñ•áĞµÉ…ä´äÀÀˆùí‘•Ñ…¥±5•ÑÉ¥Œ¹Õ¹¥Ğôôôİ½¸œıİ½¸¡‘•Ñ…¥±Q½Ñ…°¤é‘•Ñ…¥±5•ÑÉ¥Œ¹Õ¹¥ĞôôôÁ½¥¹Ğœı€‘í™µÑ9Õ´¡‘•Ñ…¥±Q½Ñ…°°Ä¥õA€é€‘í™µÑ½Õ¹Ğ¡‘•Ñ…¥±Q½Ñ…°¥÷ªÆÑôğ½ÍÁ…¸ø(€€€€€€€€ğ½‘¥Øø(€€€€€€ğ½‘¥Øø(€€€€ğ½‘¥Øùô(€€ğ¼øì)ô()™Õ¹Ñ¥½¸9•áÑ½…±…É¡ìÁ…ä°‘É…™Ğ°½¹™¥œ°½¹½%¹ÁÕĞô¤ì(€½¹ÍĞ½…°€ôÕÍ•5•µ¼ (€€€€ ¤€ôø‰Õ¥±‘9•áÑ½…°¡Á…ä°‘É…™Ğ°½¹™¥œ¤°(€€€mÁ…ä°‘É…™Ğ°½¹™¥t(€€¤ì((€¥˜€ …½…°¤É•ÑÕÉ¸¹Õ±°ì((€É•ÑÕÉ¸€ (€€€€ñ‰ÕÑÑ½¸(€€€€€½¹±¥¬õí½¹½%¹ÁÕÑô(€€€€€±…ÍÍ9…µ”ô‰Üµ™Õ±°Ñ•áĞµ±•™Ğ‰œµİ¡¥Ñ”É½Õ¹‘•µá°‰½É‘•È‰½É‘•ÈµÙ¥½±•Ğ´ÈÀÀÀ´Ğ¡½Ù•Èé‰½É‘•ÈµÙ¥½±•Ğ´ÌÀÀÑÉ…¹Í¥Ñ¥½¸ˆ(€€€€ø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµÍÑ…ÉĞ…À´Ìˆø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ü´ä ´äÉ½Õ¹‘•µá°‰œµÙ¥½±•Ğ´ÄÀÀÑ•áĞµÙ¥½±•Ğ´ÜÀÀ™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ•¹Ñ•ÈÍ¡É¥¹¬´Àˆø(€€€€€€€€€€ñQ…É•ĞÍ¥é”õìÄáô€¼ø(€€€€€€€€ğ½‘¥Øø((€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µ¥¸µÜ´À™±•à´Äˆø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÙ¥½±•Ğ´ØÀÀµˆ´Äˆû²ÚS²Êpƒ®.“²v0ƒ¶Z'®>dğ½‘¥Øø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´™½¹Ğµ‰½±Ñ•áĞµÉ…ä´äÀÀˆùí½…°¹Ñ¥Ñ±•ôğ½‘¥Øø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´Ñ•áĞµÉ…ä´ØÀÀµĞ´À¸Ôˆùí½…°¹‘•ÍÉ¥ÁÑ¥½¹ôğ½‘¥Øø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÅÁátÑ•áĞµÙ¥½±•Ğ´ÔÀÀµĞ´Äˆùí½…°¹É•½µµ•¹‘…Ñ¥½¹ôğ½‘¥Øø((€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´Ì™±•à¥Ñ•µÌµ‰…Í•±¥¹”…À´Ä¸Ô™±•àµİÉ…Àˆø(€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ…ä´ĞÀÀˆû®.³²Äƒ².pƒ²b#²ƒ²vã²ó¶.Ã®â0ğ½ÍÁ…¸ø(€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµ±œ™½¹Ğµ‰½±Ñ•áĞµÙ¥½±•Ğ´ÜÀÀˆø­íİ½¸¡½…°¹‘•±Ñ„¥ôğ½ÍÁ…¸ø(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€ğ½‘¥Øø((€€€€€€€€ñ¡•ÙÉ½¹I¥¡ĞÍ¥é”õìÄİô±…ÍÍ9…µ”ô‰Ñ•áĞµÙ¥½±•Ğ´ÌÀÀÍ¡É¥¹¬´ÀµĞ´Äˆ€¼ø(€€€€€€ğ½‘¥Øø(€€€€ğ½‰ÕÑÑ½¸ø(€€¤ì)ô()™Õ¹Ñ¥½¸É½İÑ¡	…‘”¡ìÕÉÉ•¹Ğ°ÁÉ•Øô¤ì(€¥˜€ …ÁÉ•ØñğÁÉ•Ø€ğô€À¤É•ÑÕÉ¸¹Õ±°ì(€½¹ÍĞ‘¥™˜€ôÕÉÉ•¹Ğ€´ÁÉ•Øì(€½¹ÍĞÁĞ€ô5…Ñ ¹É½Õ¹ ¡‘¥™˜€¼ÁÉ•Ø¤€¨€ÄÀÀ¤ì(€¥˜€¡‘¥™˜€ôôô€À¤É•ÑÕÉ¸€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÙ¥½±•Ğ´ÄÀÀˆû²‚²nSªÎğƒ®>g²vğğ½ÍÁ…¸øì(€½¹ÍĞÕÀ€ô‘¥™˜€ø€Àì(€É•ÑÕÉ¸€ (€€€€ñÍÁ…¸±…ÍÍ9…µ”õíÑ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±Áà´ÈÁä´À¸ÔÉ½Õ¹‘•µ™Õ±°€‘íÕÀ€ü€‰œµ•µ•É…±´ĞÀÀ¼ÈÀÑ•áĞµ•µ•É…±´ÄÀÀœ€è€‰œµÉ•´ĞÀÀ¼ÈÀÑ•áĞµÉ•´ÄÀÀõôø(€€€€€ƒ²‚²nPƒ®2®æíÕÀ€ü€œ¬œ€è€œõíÁÑô”(€€€€ğ½ÍÁ…¸ø(€€¤ì)ô()™Õ¹Ñ¥½¸É…‘•AÉ½É•ÍÌ¡ìÁ…ä°½¹™¥œ°‘…¥±å…åÌ°µ½¹Ñ ô¤ì(€½¹ÍĞÉ…‘•Ì€ô½¹™¥œ¹É…‘•ÌñğU1Q}ILì(€½¹ÍĞµ…á5¥¸€ô5…Ñ ¹µ…à ¸¸¹É…‘•Ì¹µ…À ¡œ¤€ôøœ¹µ¥¸¤°€Ä¤ì(€½¹ÍĞÁĞ€ô5…Ñ ¹µ¥¸ ÄÀÀ°€¡Á…ä¹Ñ½Ñ…±A½¥¹ÑÌ€¼µ…á5¥¸¤€¨€ÄÀÀ¤ì(€½¹ÍĞ¹•áĞ€ôÁ…ä¹¹•áÑÉ…‘”ì(€½¹ÍĞÉ•µ…¥¸€ô¹•áĞ€ü5…Ñ ¹µ…à À°¹•áĞ¹µ¥¸€´Á…ä¹Ñ½Ñ…±A½¥¹ÑÌ¤€è€Àì(€½¹ÍĞÕÉÉ•¹Ñ	½¹ÕÌ€ôÁ…ä¹É…‘•±¥¥‰±”€üÁ…ä¹É…‘•	½¹ÕÌ€è€Àì(€½¹ÍĞ©ÕµÀ€ô¹•áĞ€ü¹•áĞ¹‰½¹ÕÌ€´ÕÉÉ•¹Ñ	½¹ÕÌ€è€Àì(€½¹ÍĞÑ¥­Ì€ôÉ…‘•Ì¹™¥±Ñ•È ¡œ¤€ôøœ¹µ¥¸€ø€À¤¹Í½ÉĞ ¡„°ˆ¤€ôø„¹µ¥¸€´ˆ¹µ¥¸¤ì((€€¼¼ƒ²ªâ#ªæ3²²v`ƒ¶:c²vÓ²*“®†pƒ®.“²v0ƒ®NÇªâ'ªæ3² ƒ®¦Ã²æ€ƒªÆã®šÓ² ƒ²ÚS²‚T(€½¹ÍĞÁ…•1…‰•°€ô€  ¤€ôøì(€€€¥˜€ …¹•áĞñğÉ•µ…¥¸€ğô€Àñğ€…‘…¥±å…åÌñğ€…µ½¹Ñ ¤É•ÑÕÉ¸¹Õ±°ì(€€€½¹ÍĞ‘…åÍ]¥Ñ¡…Ñ„€ô=‰©•Ğ¹Ù…±Õ•Ì¡‘…¥±å…åÌ¤¹™¥±Ñ•È ¡´¤€ôø‘…å!…Í…Ñ„¡´¤¤¹±•¹Ñ ì(€€€½¹ÍĞ¹½Ü€ô¹•Ü…Ñ” ¤ì(€€€½¹ÍĞ¥ÍÕÉÉ•¹Ñ5½¹Ñ €ôµ½¹Ñ¡-•å=˜¡¹½Ü¤€ôôôµ½¹Ñ ì(€€€½¹ÍĞ‘…åÍ±…ÁÍ•€ô¥ÍÕÉÉ•¹Ñ5½¹Ñ €ü¹½Ü¹•Ñ…Ñ” ¤€è‘…åÍ%¹5½¹Ñ ¡µ½¹Ñ ¤ì(€€€½¹ÍĞ…Ñ¥Ù•…åÌ€ô5…Ñ ¹µ…à¡‘…åÍ]¥Ñ¡…Ñ„°€Ä¤ì(€€€½¹ÍĞÁ•É…ä€ôÁ…ä¹Ñ½Ñ…±A½¥¹ÑÌ€¼5…Ñ ¹µ…à¡‘…åÍ±…ÁÍ•°…Ñ¥Ù•…åÌ°€Ä¤ì(€€€¥˜€¡Á•É…ä€ğô€À¤É•ÑÕÉ¸¹Õ±°ì(€€€½¹ÍĞ‘…åÍ9••‘•€ô5…Ñ ¹•¥°¡É•µ…¥¸€¼Á•É…ä¤ì(€€€É•ÑÕÉ¸ƒ²ªâ ƒ¶:c²vÓ²*£¶Vc® ƒ¶>'ªŞ€€‘íÁ•É…ä¹Ñ½¥á• Ä¥õ@§®¦Ğ€‘í‘…åÍ9••‘•‘÷²vğƒ¶nƒ®>®.°ƒ²b#²€ì(€ô¤ ¤ì((€É•ÑÕÉ¸€ (€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµİ¡¥Ñ”É½Õ¹‘•µá°‰½É‘•È‰½É‘•ÈµÉ…ä´ÄÀÀÀ´Ğˆø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹©ÕÍÑ¥™äµ‰•Ñİ••¸µˆ´Ìˆø(€€€€€€€€ñ‘¥Øø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ…ä´ĞÀÀˆû²vÓ®Ê ƒ®.°ƒ²ÇªÎó®NÇªâ%@ğ½‘¥Øø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ‰…Í•±¥¹”…À´Ä¸Ôˆø(€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞ´Éá°™½¹Ğµ‰½±Ñ•áĞµÉ…ä´äÀÀÑ…‰Õ±…Èµ¹ÕµÌˆùíÁ…ä¹Ñ½Ñ…±A½¥¹ÑÌ¹Ñ½¥á• Ä¥ôğ½ÍÁ…¸ø(€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´Ñ•áĞµÉ…ä´ĞÀÀˆù@ğ½ÍÁ…¸ø(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€ğ½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÉ¥¡Ğˆø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ…ä´ĞÀÀˆû¶b²z°ƒ®NÇªâ$ğ½‘¥Øø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÑ•áĞµ±œ™½¹Ğµ‰½±€‘íÁ…ä¹É…‘•±¥¥‰±”€˜˜ÕÉÉ•¹Ñ	½¹ÕÌ€ø€À€ü€Ñ•áĞµÙ¥½±•Ğ´ÜÀÀœ€è€Ñ•áĞµÉ…ä´ĞÀÀõôø(€€€€€€€€€€€íÁ…ä¹É…‘•±¥¥‰±”€üÁ…ä¹É…‘”€è€ô(€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµáÌ™½¹Ğµµ•‘¥Õ´µ°´ÄÑ•áĞµÉ…ä´ÔÀÀˆùíİ½¸¡ÕÉÉ•¹Ñ	½¹ÕÌ¥ôğ½ÍÁ…¸ø(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€ğ½‘¥Øø(€€€€€€ğ½‘¥Øø((€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É•±…Ñ¥Ù” ´È¸ÔÉ½Õ¹‘•µ™Õ±°‰œµÉ…ä´ÄÀÀ½Ù•É™±½ÜµÙ¥Í¥‰±”ˆø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰…‰Í½±ÕÑ”¥¹Í•Ğµä´À±•™Ğ´ÀÉ½Õ¹‘•µ™Õ±°‰œµÉ…‘¥•¹ĞµÑ¼µÈ™É½´µÙ¥½±•Ğ´ÔÀÀÑ¼µ¥¹‘¥¼´ÔÀÀÑÉ…¹Í¥Ñ¥½¸µ…±°‘ÕÉ…Ñ¥½¸´ÔÀÀˆ(€€€€€€€€€ÍÑå±”õíìİ¥‘Ñ è€‘íÁÑô•€õô€¼ø(€€€€€€€íÑ¥­Ì¹µ…À ¡œ¤€ôø€ (€€€€€€€€€€ñ‘¥Ø­•äõíœ¹É…‘•ô±…ÍÍ9…µ”ô‰…‰Í½±ÕÑ”€µÑ½À´À¸ÔÜµÁà ´Ì¸Ô‰œµİ¡¥Ñ”¼àÀˆÍÑå±”õíì±•™Ğè€‘í5…Ñ ¹µ¥¸ ÄÀÀ°€¡œ¹µ¥¸€¼µ…á5¥¸¤€¨€ÄÀÀ¥ô•€õô€¼ø(€€€€€€€€¤¥ô(€€€€€€ğ½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É•±…Ñ¥Ù” ´ĞµĞ´Äˆø(€€€€€€€íÑ¥­Ì¹µ…À ¡œ¤€ôø€ (€€€€€€€€€€ñÍÁ…¸­•äõíœ¹É…‘•ô±…ÍÍ9…µ”ô‰…‰Í½±ÕÑ”Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀ€µÑÉ…¹Í±…Ñ”µà´Ä¼ÈÑ…‰Õ±…Èµ¹ÕµÌˆ(€€€€€€€€€€€ÍÑå±”õíì±•™Ğè€‘í5…Ñ ¹µ¥¸ ÄÀÀ°€¡œ¹µ¥¸€¼µ…á5¥¸¤€¨€ÄÀÀ¥ô•€õôø(€€€€€€€€€€€íœ¹É…‘•ô(€€€€€€€€€€ğ½ÍÁ…¸ø(€€€€€€€€¤¥ô(€€€€€€ğ½‘¥Øø((€€€€€í¹•áĞ€ü€ (€€€€€€€€ğø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´È™±•à¥Ñ•µÌµ•¹Ñ•È…À´ÈÑ•áĞµÍ´ˆø(€€€€€€€€€€€€ñQ…É•ĞÍ¥é”õìÄÑô±…ÍÍ9…µ”ô‰Ñ•áĞµÙ¥½±•Ğ´ÔÀÀÍ¡É¥¹¬´Àˆ€¼ø(€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµÉ…ä´ØÀÀˆø(€€€€€€€€€€€€€€ñˆ±…ÍÍ9…µ”ô‰Ñ•áĞµÙ¥½±•Ğ´ÜÀÀˆùí¹•áĞ¹É…‘•÷®NÇªâ$ğ½ˆûªæ3² €ñˆ±…ÍÍ9…µ”ô‰Ñ•áĞµÉ…ä´äÀÀÑ…‰Õ±…Èµ¹ÕµÌˆùíÉ•µ…¥¸¹Ñ½¥á• Ä¥õ@ğ½ˆø(€€€€€€€€€€€€€í©ÕµÀ€ø€À€˜˜€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµÉ…ä´ĞÀÀˆøƒ
Üƒ®>®.³¶Vc®¦Ğ€­íİ½¸¡©ÕµÀ¥ôğ½ÍÁ…¸ùô(€€€€€€€€€€€€ğ½ÍÁ…¸ø(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€íÁ…•1…‰•°€˜˜€ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´ÄÑ•áĞµáÌÑ•áĞµÉ…ä´ĞÀÀÁ°´ØˆùíÁ…•1…‰•±ôğ½‘¥Øùô(€€€€€€€€ğ¼ø(€€€€€€¤€è€ (€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´È™±•à¥Ñ•µÌµ•¹Ñ•È…À´ÈÑ•áĞµÍ´Ñ•áĞµ•µ•É…±´ØÀÀˆø(€€€€€€€€€€ñİ…ÉÍ¥é”õìÄÑô±…ÍÍ9…µ”ô‰Í¡É¥¹¬´Àˆ€¼øƒ²ÖsªÎ€ƒ®NÇªâ'²vÓ²^C²jP¸ƒ²vÓ®Ê ƒ®.°ƒ²zc¶VcªÎ€ƒ²z#²ZÓ²jP„(€€€€€€€€ğ½‘¥Øø(€€€€€€¥ô(€€€€ğ½‘¥Øø(€€¤ì)ô()™Õ¹Ñ¥½¸!½µ•…Ñ•…É¡ìÁ…ä°½¹™¥œ°½¹½%¹ÁÕĞô¤ì(€½¹ÍĞ…Ñ”€ô!=5}Q}5%8ì(€½¹ÍĞÍ¡½ÉĞ€ô5…Ñ ¹µ…à À°…Ñ”€´Á…ä¹¡½µ•…Ñ•A½¥¹ÑÌ¤ì(€½¹ÍĞÁ½Ñ•¹Ñ¥…°€ô€  ¤€ôøì(€€€½¹ÍĞÉ…‘•Ì€ôl¸¸¸¡½¹™¥œ¹É…‘•ÌñğU1Q}IL¥t¹Í½ÉĞ ¡„°ˆ¤€ôøˆ¹µ¥¸€´„¹µ¥¸¤ì(€€€½¹ÍĞ¡¥Ğ€ôÉ…‘•Ì¹™¥¹ ¡œ¤€ôøÁ…ä¹Ñ½Ñ…±A½¥¹ÑÌ€øôœ¹µ¥¸¤ì(€€€É•ÑÕÉ¸¡¥Ğ€ü¡¥Ğ¹‰½¹ÕÌ€è€Àì(€ô¤ ¤ì((€¥˜€ …Á…ä¹É…‘•±¥¥‰±”¤ì(€€€É•ÑÕÉ¸€ (€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õí½¹½%¹ÁÕÑô±…ÍÍ9…µ”ô‰Üµ™Õ±°Ñ•áĞµ±•™Ğ‰œµ…µ‰•È´ÔÀ‰½É‘•È‰½É‘•Èµ…µ‰•È´ÈÀÀÉ½Õ¹‘•µá°À´Ğˆø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµÍÑ…ÉĞ…À´È¸Ôˆø(€€€€€€€€€€ñ±•ÉÑQÉ¥…¹±”Í¥é”õìÄÙô±…ÍÍ9…µ”ô‰Ñ•áĞµ…µ‰•È´ÔÀÀÍ¡É¥¹¬´ÀµĞ´À¸Ôˆ€¼ø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µ¥¸µÜ´Àˆø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´™½¹ĞµÍ•µ¥‰½±Ñ•áĞµ…µ‰•È´äÀÀˆø(€€€€€€€€€€€€€ƒ¶f ƒ²Ös²3²†ÃªÆĞíÁ…ä¹¡½µ•…Ñ•A½¥¹ÑÌ¹Ñ½¥á• Ä¥ô€¼í…Ñ•÷²‚@ƒŠPíÍ¡½ÉĞ¹Ñ½¥á• Ä¥÷²‚@ƒ®Ú²†Ä(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµ…µ‰•È´ÜÀÀµĞ´Ä±•…‘¥¹œµÉ•±…á•ˆø(€€€€€€€€€€€€€ƒ²ªâ#²v ƒ²ÇªÎó®NÇªâ$ƒ®ÎÓ®#²*“ªÂ €ñˆøÃ²n@ğ½ˆû²vÓ²^C²jP¸(€€€€€€€€€€€€€íÁ½Ñ•¹Ñ¥…°€ø€À€˜˜€ğøƒ¶f íÍ¡½ÉĞ¹Ñ½¥á• Ä¥÷²‚C®0ƒ®6Pƒ²Æ²jÃ®¦Ğƒ¶b²z°ƒ¶>³²vã¶*ã®†p€ñˆùíİ½¸¡Á½Ñ•¹Ñ¥…°¥ôğ½ˆû²vƒ®Âo²vƒ²"`ƒ²z#²ZÓ²jP¸ğ¼ùô(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÅÁátÑ•áĞµ…µ‰•È´ØÀÀ¼àÀµĞ´Ä¸Ôˆû²vã¶Ã®Ü€Ç²‚@ƒ
ÜQ[¶R®š°€À¸Ï²‚@ƒ
Üƒ²*“®#¶*ã¶f €À¸Ë²‚@ƒªâÃ²’ ƒ
Üƒ®"3®~³²pƒ¶f ƒ².“²‚ƒ²z®‚—¶VcªâÀğ½‘¥Øø(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€ğ½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´Ì ´Ä¸ÔÉ½Õ¹‘•µ™Õ±°‰œµ…µ‰•È´ÈÀÀ¼ØÀ½Ù•É™±½Üµ¡¥‘‘•¸ˆø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰ µ™Õ±°É½Õ¹‘•µ™Õ±°‰œµ…µ‰•È´ÔÀÀÑÉ…¹Í¥Ñ¥½¸µ…±°‘ÕÉ…Ñ¥½¸´ÔÀÀˆÍÑå±”õíìİ¥‘Ñ è€‘í5…Ñ ¹µ¥¸ ÄÀÀ°€¡Á…ä¹¡½µ•…Ñ•A½¥¹ÑÌ€¼…Ñ”¤€¨€ÄÀÀ¥ô•€õô€¼ø(€€€€€€€€ğ½‘¥Øø(€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€¤ì(€ô((€¥˜€¡Á…ä¹¡½µ•‘‘½¹A½¥¹ÑÌ€ø€À€˜˜€…Á…ä¹…‘‘½¹ÁÁ±¥•Ì¤ì(€€€É•ÑÕÉ¸€ (€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµÍ­ä´ÔÀ‰½É‘•È‰½É‘•ÈµÍ­ä´ÈÀÀÉ½Õ¹‘•µá°À´Ğ™±•à¥Ñ•µÌµÍÑ…ÉĞ…À´È¸Ôˆø(€€€€€€€€ñ%¹™¼Í¥é”õìÄÙô±…ÍÍ9…µ”ô‰Ñ•áĞµÍ­ä´ÔÀÀÍ¡É¥¹¬´ÀµĞ´À¸Ôˆ€¼ø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÍ­ä´àÀÀ±•…‘¥¹œµÉ•±…á•ˆø(€€€€€€€€€ƒ¶f ƒ²Ös²3²†ÃªÆÓ²v ƒ²Ú§²†Ç¶Z#²ZÓ²jP¸ƒ®.“®0ƒ®ª£®ÂS²vğƒ¶>³²vã¶*ãªÂ €ñˆ±…ÍÍ9…µ”ô‰Ñ…‰Õ±…Èµ¹ÕµÌˆùíÁ…ä¹µ½‰¥±•A½¥¹ÑÌ¹Ñ½¥á• Ä¥õ@ğ½ˆû®vğ(€€€€€€€€€€ñˆøí=9}QõC®–ğƒ®cªÊ£²Vğğ½ˆøƒ¶f ƒªÂ²‚@€ñˆ±…ÍÍ9…µ”ô‰Ñ…‰Õ±…Èµ¹ÕµÌˆùíÁ…ä¹¡½µ•‘‘½¹A½¥¹ÑÌ¹Ñ½¥á• Ä¥õ@ğ½ˆûªÂ ƒ²Òw²‚C²^@ƒ®6S¶VÓ²‚ã²jP¸(€€€€€€€€ğ½‘¥Øø(€€€€€€ğ½‘¥Øø(€€€€¤ì(€ô((€É•ÑÕÉ¸€ (€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµ•µ•É…±´ÔÀ‰½É‘•È‰½É‘•Èµ•µ•É…±´ÈÀÀÉ½Õ¹‘•µá°Áà´ĞÁä´Ì™±•à¥Ñ•µÌµ•¹Ñ•È…À´ÈÑ•áĞµÍ´Ñ•áĞµ•µ•É…±´àÀÀˆø(€€€€€€ñ¡•¬Í¥é”õìÄÕô±…ÍÍ9…µ”ô‰Í¡É¥¹¬´Àˆ€¼ø(€€€€€ƒ¶f ƒ²Ös²3²†ÃªÆĞƒ²Ú§²†Ä€¡íÁ…ä¹¡½µ•…Ñ•A½¥¹ÑÌ¹Ñ½¥á• Ä¥ô€¼í…Ñ•÷²‚@¤ƒŠPƒ²ÇªÎó®NÇªâ$ƒ®ÎÓ®#²*ƒ®2²²vÓ²^C²jP(€€€€ğ½‘¥Øø(€€¤ì)ô()™Õ¹Ñ¥½¸I½İ-X¡ì±…‰•°°Ù…±Õ”°‰½±ô¤ì(€É•ÑÕÉ¸€ (€€€€ñ‘¥Ø±…ÍÍ9…µ”õí™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•Ñİ••¸Áà´ĞÁä´È¸ÔÑ•áĞµÍ´€‘í‰½±€ü€‰œµÙ¥½±•Ğ´ÔÀœ€è€œõôø(€€€€€€ñÍÁ…¸±…ÍÍ9…µ”õí‰½±€ü€Ñ•áĞµÙ¥½±•Ğ´ÜÀÀ™½¹ĞµÍ•µ¥‰½±œ€è€Ñ•áĞµÉ…ä´ØÀÀôùí±…‰•±ôğ½ÍÁ…¸ø(€€€€€€ñÍÁ…¸±…ÍÍ9…µ”õí‰½±€ü€Ñ•áĞµÙ¥½±•Ğ´àÀÀ™½¹Ğµ‰½±œ€è€Ñ•áĞµÉ…ä´àÀÀ™½¹Ğµµ•‘¥Õ´ôùíÙ…±Õ•ôğ½ÍÁ…¸ø(€€€€ğ½‘¥Øø(€€¤ì)ô(()™Õ¹Ñ¥½¸I…¹­¥¹•¹Ñ•È¡ìÉ½İÌ°‘…¥±åI•½É‘Ì°µ½¹Ñ °½¹™¥œô¤ì(€½¹ÍĞmµ•ÑÉ¥-•ä°Í•Ñ5•ÑÉ¥-•åt€ôÕÍ•MÑ…Ñ” ¡Ìœ¤ì(€½¹ÍĞmµ½‘”°Í•Ñ5½‘•t€ôÕÍ•MÑ…Ñ” •µÁ±½å••Ìœ¤ì€¼¼•µÁ±½å••ÌğÍÑ½É•Ì(€½¹ÍĞmÍÑ½É•5½‘”°Í•ÑMÑ½É•5½‘•t€ôÕÍ•MÑ…Ñ” Ñ½Ñ…°œ¤ì€¼¼Ñ½Ñ…°ğ…Ùœ(€½¹ÍĞmÁ•É¥½‘5½‘”°Í•ÑA•É¥½‘5½‘•t€ôÕÍ•MÑ…Ñ” µ½¹Ñ œ¤ì€¼¼µ½¹Ñ ğÉ••¹ĞÜ(€½¹ÍĞµ•ÑÉ¥Œ€ô=5AQ%Q%=9}5QI%L¹™¥¹ ¡´¤€ôø´¹­•ä€ôôôµ•ÑÉ¥-•ä¤ñğ=5AQ%Q%=9}5QI%MlÁtì(€½¹ÍĞ™¥¹…±A•É™½Éµ…¹•ÌõÕÍ•¥¹…±MÑ½É•A•É™½Éµ…¹”¡µ½¹Ñ ¤ì((€½¹ÍĞ•µÁ±½å••I…¹­•€ôÕÍ•5•µ¼  ¤€ôøl¸¸¸¡É½İÌñğmt¥t(€€€€¹™¥±Ñ•È ¡È¤€ôø€…9=9}M1M}MQ=IL¹¥¹±Õ‘•Ì¡È¹‰É…¹ ¤¤(€€€€¹Í½ÉĞ ¡„°ˆ¤€ôøµ•ÑÉ¥Œ¹Ù…±Õ”¡ˆ¤€´µ•ÑÉ¥Œ¹Ù…±Õ”¡„¤ñğ„¹¹…µ”¹±½…±•½µÁ…É”¡ˆ¹¹…µ”¤¤°(€mÉ½İÌ°µ•ÑÉ¥-•åt¤ì((€½¹ÍĞÉ••¹ÑµÁ±½å••I…¹­•€ôÕÍ•5•µ¼ (€€€€ ¤€ôø‰Õ¥±‘I¥Í¥¹I…¹­¥¹œ¡É½İÌ°‘…¥±åI•½É‘Ì°µ½¹Ñ °½¹™¥œ°µ•ÑÉ¥-•ä¤°(€€€mÉ½İÌ°‘…¥±åI•½É‘Ì°µ½¹Ñ °½¹™¥œ°µ•ÑÉ¥-•åt(€€¤ì((€½¹ÍĞÍÑ½É•I…¹­•€ôÕÍ•5•µ¼  ¤€ôøì(€€€½¹ÍĞ‰…Í•I½İÌ€ôÁ•É¥½‘5½‘”€ôôô€É••¹ĞÜœ€üÉ••¹ÑµÁ±½å••I…¹­•€è€¡É½İÌñğmt¤ì(€€€½¹ÍĞµ…À€ô¹•Ü5…À ¤ì((€€€‰…Í•I½İÌ¹™¥±Ñ•È ¡È¤€ôø€…9=9}M1M}MQ=IL¹¥¹±Õ‘•Ì¡È¹‰É…¹ ¤¤¹™½É…  ¡È¤€ôøì(€€€€€¥˜€ …µ…À¹¡…Ì¡È¹‰É…¹ ¤¤µ…À¹Í•Ğ¡È¹‰É…¹ °ì¹…µ”èÈ¹‰É…¹ °Ñ½Ñ…°è€À°½Õ¹Ğè€Àô¤ì(€€€€€½¹ÍĞ¥Ñ•´€ôµ…À¹•Ğ¡È¹‰É…¹ ¤ì(€€€€€½¹ÍĞÙ…±Õ”€ôÁ•É¥½‘5½‘”€ôôô€É••¹ĞÜœ(€€€€€€€€ü9Õµ‰•È¡È¹É••¹ÑY…±Õ”ñğ€À¤(€€€€€€€€è9Õµ‰•È¡µ•ÑÉ¥Œ¹Ù…±Õ”¡È¤ñğ€À¤ì(€€€€€¥Ñ•´¹Ñ½Ñ…°€¬ôÙ…±Õ”ì(€€€€€¥Ñ•´¹½Õ¹Ğ€¬ô€Äì(€€€ô¤ì((€€€É•ÑÕÉ¸l¸¸¹µ…À¹Ù…±Õ•Ì ¥t(€€€€€€¹µ…À ¡Ì¤€ôø€¡ì(€€€€€€€€¸¸¹Ì°(€€€€€€€Ñ½Ñ…°èÁ•É¥½‘5½‘”ôôôµ½¹Ñ œ˜™™¥¹…±A•É™½Éµ…¹•ÍmÌ¹¹…µ•t(€€€€€€€€€€ü™¥¹…±MÑ½É•5•ÑÉ¥Œ¡™¥¹…±A•É™½Éµ…¹•ÍmÌ¹¹…µ•t±µ•ÑÉ¥-•ä±Ì¹Ñ½Ñ…°¤(€€€€€€€€€€èÌ¹Ñ½Ñ…°°(€€€€€ô¤¤(€€€€€€¹µ…À¡Ìôø¡ì¸¸¹Ì±Ù…±Õ”éÍÑ½É•5½‘”ôôô…Ùœœü¡Ì¹½Õ¹ĞıÌ¹Ñ½Ñ…°½Ì¹½Õ¹ĞèÀ¤éÌ¹Ñ½Ñ…±ô¤¤(€€€€€€¹Í½ÉĞ ¡„°ˆ¤€ôøˆ¹Ù…±Õ”€´„¹Ù…±Õ”ñğ„¹¹…µ”¹±½…±•½µÁ…É”¡ˆ¹¹…µ”¤¤ì(€ô°mÉ½İÌ°É••¹ÑµÁ±½å••I…¹­•°µ•ÑÉ¥-•ä°ÍÑ½É•5½‘”°Á•É¥½‘5½‘”°™¥¹…±A•É™½Éµ…¹•Ít¤ì((€É•ÑÕÉ¸€ (€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰ÍÁ…”µä´Ìˆø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµİ¡¥Ñ”‰½É‘•È‰½É‘•ÈµÉ…ä´ÄÀÀÉ½Õ¹‘•µá°À´Ìˆø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à™±•àµİÉ…À…À´È¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•Ñİ••¸ˆø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à‰œµÉ…ä´ÄÀÀÉ½Õ¹‘•µ±œÀ´À¸Ôˆø(€€€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôøÍ•Ñ5½‘” •µÁ±½å••Ìœ¥ô±…ÍÍ9…µ”õíÁà´ÌÁä´Ä¸ÔÉ½Õ¹‘•µµÑ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±€‘íµ½‘”€ôôô€•µÁ±½å••Ìœ€ü€‰œµİ¡¥Ñ”Í¡…‘½ÜÑ•áĞµÙ¥½±•Ğ´ÜÀÀœ€è€Ñ•áĞµÉ…ä´ÔÀÀõôû²²n@ƒ²"s²rğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôøÍ•Ñ5½‘” ÍÑ½É•Ìœ¥ô±…ÍÍ9…µ”õíÁà´ÌÁä´Ä¸ÔÉ½Õ¹‘•µµÑ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±€‘íµ½‘”€ôôô€ÍÑ½É•Ìœ€ü€‰œµİ¡¥Ñ”Í¡…‘½ÜÑ•áĞµÙ¥½±•Ğ´ÜÀÀœ€è€Ñ•áĞµÉ…ä´ÔÀÀõôû®“²z”ƒ²"s²rğ½‰ÕÑÑ½¸ø(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à‰œµÉ…ä´ÄÀÀÉ½Õ¹‘•µ±œÀ´À¸Ôˆø(€€€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôøÍ•ÑA•É¥½‘5½‘” µ½¹Ñ œ¥ô±…ÍÍ9…µ”õíÁà´È¸ÔÁä´Ä¸ÔÉ½Õ¹‘•µµÑ•áĞµlÄÅÁát™½¹ĞµÍ•µ¥‰½±€‘íÁ•É¥½‘5½‘”€ôôô€µ½¹Ñ œ€ü€‰œµİ¡¥Ñ”Í¡…‘½ÜÑ•áĞµÙ¥½±•Ğ´ÜÀÀœ€è€Ñ•áĞµÉ…ä´ÔÀÀõôû²nPƒ®"²‚ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôøÍ•ÑA•É¥½‘5½‘” É••¹ĞÜœ¥ô±…ÍÍ9…µ”õíÁà´È¸ÔÁä´Ä¸ÔÉ½Õ¹‘•µµÑ•áĞµlÄÅÁát™½¹ĞµÍ•µ¥‰½±€‘íÁ•É¥½‘5½‘”€ôôô€É••¹ĞÜœ€ü€‰œµİ¡¥Ñ”Í¡…‘½ÜÑ•áĞµ½É…¹”´ØÀÀœ€è€Ñ•áĞµÉ…ä´ÔÀÀõôû²ÖsªŞğ€ß²vğğ½‰ÕÑÑ½¸ø(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€ñÍ•±•ĞÙ…±Õ”õíµ•ÑÉ¥-•åô½¹¡…¹”õì¡”¤€ôøÍ•Ñ5•ÑÉ¥-•ä¡”¹Ñ…É•Ğ¹Ù…±Õ”¥ô(€€€€€€€€€€€±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´‰½É‘•È‰½É‘•ÈµÉ…ä´ÈÀÀÉ½Õ¹‘•µ±œÁà´ÌÁä´È‰œµİ¡¥Ñ”ˆø(€€€€€€€€€€€í=5AQ%Q%=9}5QI%L¹µ…À ¡´¤€ôø€ñ½ÁÑ¥½¸­•äõí´¹­•åôÙ…±Õ”õí´¹­•åôùí´¹±…‰•±ôğ½½ÁÑ¥½¸ø¥ô(€€€€€€€€€€ğ½Í•±•Ğø(€€€€€€€€ğ½‘¥Øø((€€€€€€€íµ½‘”€ôôô€ÍÑ½É•Ìœ€˜˜€ (€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´È™±•à©ÕÍÑ¥™äµ•¹ˆø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à‰œµÉ…ä´ÄÀÀÉ½Õ¹‘•µ±œÀ´À¸Ôˆø(€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôøÍ•ÑMÑ½É•5½‘” Ñ½Ñ…°œ¥ô±…ÍÍ9…µ”õíÁà´È¸ÔÁä´ÄÉ½Õ¹‘•µµÑ•áĞµlÄÅÁát€‘íÍÑ½É•5½‘”€ôôô€Ñ½Ñ…°œ€ü€‰œµİ¡¥Ñ”Í¡…‘½ÜÑ•áĞµÙ¥½±•Ğ´ÜÀÀœ€è€Ñ•áĞµÉ…ä´ÔÀÀõôû²Òtƒ².“²‚ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôøÍ•ÑMÑ½É•5½‘” …Ùœœ¥ô±…ÍÍ9…µ”õíÁà´È¸ÔÁä´ÄÉ½Õ¹‘•µµÑ•áĞµlÄÅÁát€‘íÍÑ½É•5½‘”€ôôô€…Ùœœ€ü€‰œµİ¡¥Ñ”Í¡…‘½ÜÑ•áĞµÙ¥½±•Ğ´ÜÀÀœ€è€Ñ•áĞµÉ…ä´ÔÀÀõôøÇ²vã®.äğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€¥ô(€€€€€€ğ½‘¥Øø((€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµİ¡¥Ñ”É½Õ¹‘•µá°‰½É‘•È‰½É‘•ÈµÉ…ä´ÄÀÀ½Ù•É™±½Üµ¡¥‘‘•¸ˆø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Áà´ĞÁä´Ì‰½É‘•Èµˆ‰½É‘•ÈµÉ…ä´ÔÀÑ•áĞµÍ´™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÉ…ä´ÜÀÀˆø(€€€€€€€€€íÁ•É¥½‘5½‘”€ôôô€É••¹ĞÜœ€ü€Ÿ²ÖsªŞğ€ß²vğƒ
Ü€œ€è€œõíµ•ÑÉ¥Œ¹±…‰•±ôíµ½‘”€ôôô€•µÁ±½å••Ìœ€ü€Ÿ²²n@ƒ²"s²rœ€è€Ÿ®“²z”ƒ²"s²rô(€€€€€€€€€íµ½‘”ôôôÍÑ½É•Ìœ˜™Á•É¥½‘5½‘”ôôôµ½¹Ñ œ˜™=‰©•Ğ¹­•åÌ¡™¥¹…±A•É™½Éµ…¹•Ì¤¹±•¹Ñ øÀ˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlåÁát™½¹Ğµ¹½Éµ…°Ñ•áĞµ•µ•É…±´ØÀÀµĞ´Äˆû®#ªÂC®Bpƒ®“²z—²v ƒ¶fW²‚Tƒ².“²‚ƒªâÃ²’ ğ½‘¥Øùô(€€€€€€€€ğ½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‘¥Ù¥‘”µä‘¥Ù¥‘”µÉ…ä´ÔÀˆø(€€€€€€€€€ì¡µ½‘”€ôôô€•µÁ±½å••Ìœ(€€€€€€€€€€€€ü€¡Á•É¥½‘5½‘”€ôôô€É••¹ĞÜœ€üÉ••¹ÑµÁ±½å••I…¹­•€è•µÁ±½å••I…¹­•¤(€€€€€€€€€€€€èÍÑ½É•I…¹­•(€€€€€€€€€€¤¹µ…À ¡¥Ñ•´°¤¤€ôøì(€€€€€€€€€€€½¹ÍĞ¹…µ”€ôµ½‘”€ôôô€•µÁ±½å••Ìœ€ü€‘í¥Ñ•´¹¹…µ•ôƒ
Ü€‘í‘¥ÍÁ±…åMÑ½É•9…µ”¡¥Ñ•´¹‰É…¹ ¥õ€€è‘¥ÍÁ±…åMÑ½É•9…µ”¡¥Ñ•´¹¹…µ”¤ì(€€€€€€€€€€€½¹ÍĞÙ…±Õ”€ôµ½‘”€ôôô€•µÁ±½å••Ìœ(€€€€€€€€€€€€€€ü€¡Á•É¥½‘5½‘”€ôôô€É••¹ĞÜœ€ü¥Ñ•´¹É••¹ÑY…±Õ”€èµ•ÑÉ¥Œ¹Ù…±Õ”¡¥Ñ•´¤¤(€€€€€€€€€€€€€€è¥Ñ•´¹Ù…±Õ”ì(€€€€€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€€€ñ‘¥Ø­•äõíµ½‘”€ôôô€•µÁ±½å••Ìœ€ü¥Ñ•´¹¥€è¥Ñ•´¹¹…µ•ô±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•Ñİ••¸Áà´ĞÁä´Ì…À´Ìˆø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È…À´Ìµ¥¸µÜ´Àˆø(€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÜ´Ü ´ÜÉ½Õ¹‘•µ™Õ±°™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ•¹Ñ•ÈÑ•áĞµáÌ™½¹Ğµ‰½±Í¡É¥¹¬´À€‘ì(€€€€€€€€€€€€€€€€€€€¤€ôôô€À€ü€‰œµ…µ‰•È´ÄÀÀÑ•áĞµ…µ‰•È´ÜÀÀœ€è¤€ôôô€Ä€ü€‰œµÉ…ä´ÄÀÀÑ•áĞµÉ…ä´ØÀÀœ€è¤€ôôô€È€ü€‰œµ½É…¹”´ÄÀÀÑ•áĞµ½É…¹”´ÜÀÀœ€è€‰œµÉ…ä´ÔÀÑ•áĞµÉ…ä´ĞÀÀœ(€€€€€€€€€€€€€€€€€õôùí¤€¬€Åôğ½‘¥Øø(€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´Ñ•áĞµÉ…ä´àÀÀÑÉÕ¹…Ñ”ˆùí¹…µ•ôğ½‘¥Øø(€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´™½¹Ğµ‰½±Ñ•áĞµÙ¥½±•Ğ´ÜÀÀÍ¡É¥¹¬´Àˆø(€€€€€€€€€€€€€€€€€í™½Éµ…Ñ½µÁ•Ñ¥Ñ¥½¹Y…±Õ”¡Ù…±Õ”°µ•ÑÉ¥Œ¹Õ¹¥Ğ¥ô(€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€¤ì(€€€€€€€€€ô¥ô(€€€€€€€€ğ½‘¥Øø(€€€€€€ğ½‘¥Øø(€€€€ğ½‘¥Øø(€€¤ì)ô((¼¨€ôôôôôôôôôôôôôôôôôôôôôƒªÒ®š³²z@ƒ¶fS®¦Ğ€ôôôôôôôôôôôôôôôôôôôôô€¨¼(()™Õ¹Ñ¥½¸‘µ¥¹!½µ•…É”¡ì•µÁ±½å••Ì°µ½¹Ñ ô¤ì(€½¹ÍĞm½É‘•ÉÌ±Í•Ñ=É‘•ÉÍtõÕÍ•MÑ…Ñ”¡mt¤ì(€½¹ÍĞm±½…‘¥¹œ±Í•Ñ1½…‘¥¹tõÕÍ•MÑ…Ñ”¡ÑÉÕ”¤ì(€½¹ÍĞmÍÑ…ÑÕÍ¥±Ñ•È±Í•ÑMÑ…ÑÕÍ¥±Ñ•ÉtõÕÍ•MÑ…Ñ” Á•¹‘¥¹œœ¤ì(€½¹ÍĞm±…ÍÑ1½…‘•‘Ğ±Í•Ñ1…ÍÑ1½…‘•‘ÑtõÕÍ•MÑ…Ñ”¡¹Õ±°¤ì(€½¹ÍĞ±½…õÕÍ•…±±‰…¬¡…Íå¹Œ ¤ôùì(€€€Í•Ñ1½…‘¥¹œ¡ÑÉÕ”¤ì(€€€½¹ÍĞmåä±µµtõMÑÉ¥¹œ¡µ½¹Ñ¡ññµ½¹Ñ¡-•å=˜¡¹•Ü…Ñ” ¤¤¤¹ÍÁ±¥Ğ œ´œ¤¹µ…À¡9Õµ‰•È¤ì(€€€½¹ÍĞ¹•áÑ5½¹Ñ õ€‘í¹•Ü…Ñ”¡åä±µ´°Ä¤¹•ÑÕ±±e•…È ¥ô´‘íMÑÉ¥¹œ¡¹•Ü…Ñ”¡åä±µ´°Ä¤¹•Ñ5½¹Ñ  ¤¬Ä¤¹Á…‘MÑ…ÉĞ È°œÀœ¥ô´ÀÅ€ì(€€€½¹ÍĞí‘…Ñ„±•ÉÉ½Éôõ…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ ¡½µ•}½É‘•ÉÌœ¤¹Í•±•Ğ œ¨œ¤(€€€€€€¹Ñ” Í½ÕÉ•}İ½É­}‘…Ñ”œ±€‘íµ½¹Ñ¡ññµ½¹Ñ¡-•å=˜¡¹•Ü…Ñ” ¤¥ô´ÀÅ€¤¹±Ğ Í½ÕÉ•}İ½É­}‘…Ñ”œ±¹•áÑ5½¹Ñ ¤(€€€€€€¹½É‘•È Á±…¹¹•‘}¥¹ÍÑ…±±}‘…Ñ”œ±í…Í•¹‘¥¹œéÑÉÕ”±¹Õ±±Í¥ÉÍĞé™…±Í•ô¤ì(€€€¥˜ …•ÉÉ½È¥íÍ•Ñ=É‘•ÉÌ¡‘…Ñ…ññmt¤íÍ•Ñ1…ÍÑ1½…‘•‘Ğ¡¹•Ü…Ñ” ¤¤íô(€€€Í•Ñ1½…‘¥¹œ¡™…±Í”¤ì(€ô±mµ½¹Ñ¡t¤ì(€ÕÍ•™™•Ğ  ¤ôùì(€€€±½… ¤ì(€€€½¹ÍĞ¡…¹¹•°õÍÕÁ…‰…Í”¹¡…¹¹•°¡…‘µ¥¸µ¡½µ”µ…É”´‘íµ½¹Ñ¡ñğÕÉÉ•¹Ğõ€¤(€€€€€€¹½¸ Á½ÍÑÉ•Í}¡…¹•Ìœ±í•Ù•¹Ğèœ¨œ±Í¡•µ„èÁÕ‰±¥Œœ±Ñ…‰±”è¡½µ•}½É‘•ÉÌô° ¤ôù±½… ¤¤¹ÍÕ‰ÍÉ¥‰” ¤ì(€€€½¹ÍĞ½¹½ÕÌô ¤ôù±½… ¤ì(€€€İ¥¹‘½Ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ™½ÕÌœ±½¹½ÕÌ¤ì(€€€É•ÑÕÉ¸ ¤ôùíİ¥¹‘½Ü¹É•µ½Ù•Ù•¹Ñ1¥ÍÑ•¹•È ™½ÕÌœ±½¹½ÕÌ¤íÍÕÁ…‰…Í”¹É•µ½Ù•¡…¹¹•°¡¡…¹¹•°¥ôì(€ô±m±½…±µ½¹Ñ¡t¤ì((€½¹ÍĞ•µÁ5…Àõ=‰©•Ğ¹™É½µ¹ÑÉ¥•Ì ¡•µÁ±½å••Íññmt¤¹µ…À¡”ôùm”¹¥±•t¤¤ì(€½¹ÍĞÉ½ÕÁ•õÕÍ•5•µ¼  ¤ôùì(€€€½¹ÍĞµ…Àõ¹•Ü5…À ¤ì(€€€€¡½É‘•ÉÍññmt¤¹™½É… ¡¼ôùì(€€€€€½¹ÍĞ­•äõm¼¹ÕÍ•É}¥±¼¹Í½ÕÉ•}İ½É­}‘…Ñ”±¼¹ÕÍÑ½µ•É}¥‘ññMÑÉ¥¹œ¡¼¹ÕÍÑ½µ•É}¹…µ•ñğœœ¤¹É•Á±…” ½qÌ¬½œ°œœ¤±¼¹ÍÑ…ÑÕÍt¹©½¥¸ ğœ¤ì(€€€€€¥˜ …µ…À¹¡…Ì¡­•ä¤¥µ…À¹Í•Ğ¡­•ä±í­•ä±É½İÌémt°¸¸¹½ô¤ì(€€€€€µ…À¹•Ğ¡­•ä¤¹É½İÌ¹ÁÕÍ ¡¼¤ì(€€€ô¤ì(€€€É•ÑÕÉ¸l¸¸¹µ…À¹Ù…±Õ•Ì ¥t¹µ…À¡œôùì(€€€€€½¹ÍĞÕ¹¥ÅÕ”õl¸¸¹¹•ÜM•Ğ¡œ¹É½İÌ¹µ…À¡¼ôù¼¹ÁÉ½‘ÕÑ}ÑåÁ”¤¥tì(€€€€€½¹ÍĞÁÉ½‘ÕÑ½Õ¹ÑÌõœ¹É½İÌ¹É•‘Õ” ¡…Œ±É½Ü¤ôùì(€€€€€€€½¹ÍĞ­•äõMÑÉ¥¹œ¡É½Ü¹ÁÉ½‘ÕÑ}ÑåÁ•ñğÕ¹­¹½İ¸œ¤ì(€€€€€€€…m­•åtõ9Õµ‰•È¡…m­•åuñğÀ¤¬Äì(€€€€€€€É•ÑÕÉ¸…Œì(€€€€€ô°íô¤ì(€€€€€½¹ÍĞÉ•Á•…Ñ•‘AÉ½‘ÕÑÌõ=‰©•Ğ¹•¹ÑÉ¥•Ì¡ÁÉ½‘ÕÑ½Õ¹ÑÌ¤¹™¥±Ñ•È ¡l±½Õ¹Ñt¤ôù½Õ¹ĞøÄ¤¹µ…À ¡mÁÉ½‘ÕÑQåÁ”±½Õ¹Ñt¤ôø¡íÁÉ½‘ÕÑQåÁ”±½Õ¹Ñô¤¤ì(€€€€€½¹ÍĞµ…¥¹!½µ•½Õ¹Ğõ9Õµ‰•È¡ÁÉ½‘ÕÑ½Õ¹ÑÌ¹¡½µ•QÙñğÀ¤­9Õµ‰•È¡ÁÉ½‘ÕÑ½Õ¹ÑÌ¹¡½µ•=¹±åñğÀ¤ì(€€€€€½¹ÍĞ¥¹Ñ•É¹•Ñ½Õ¹Ğõ9Õµ‰•È¡ÁÉ½‘ÕÑ½Õ¹ÑÌ¹¥¹Ñ•É¹•ĞÄÀÁñğÀ¤­9Õµ‰•È¡ÁÉ½‘ÕÑ½Õ¹ÑÌ¹¥¹Ñ•É¹•ĞÔÀÁñğÀ¤­9Õµ‰•È¡ÁÉ½‘ÕÑ½Õ¹ÑÌ¹¥¹Ñ•É¹•ĞÅñğÀ¤ì(€€€€€½¹ÍĞÉ•Á•…Ñ•‘	Õ¹‘±•½Õ¹Ğõ5…Ñ ¹µ¥¸¡µ…¥¹!½µ•½Õ¹Ğ±¥¹Ñ•É¹•Ñ½Õ¹Ğ¤ì(€€€€€É•ÑÕÉ¸ì¸¸¹œ±ÁÉ½‘ÕÑQåÁ•ÌéÕ¹¥ÅÕ”±‘ÕÁ±¥…Ñ•½Õ¹ĞéÉ•Á•…Ñ•‘AÉ½‘ÕÑÌ¹É•‘Õ” ¡ÍÕ´±¥Ñ•´¤ôùÍÕ´­¥Ñ•´¹½Õ¹Ğ´Ä°À¤±É•Á•…Ñ•‘AÉ½‘ÕÑÌ±É•Á•…Ñ•‘	Õ¹‘±•½Õ¹Ñôì(€€€ô¤ì(€ô±m½É‘•ÉÍt¤ì(€½¹ÍĞÙ¥Í¥‰±”õÉ½ÕÁ•¹™¥±Ñ•È¡œôùœ¹ÍÑ…ÑÕÌôôõÍÑ…ÑÕÍ¥±Ñ•È¤ì(€½¹ÍĞÑ½‘…äõ¹•Ü…Ñ” ¤¹Ñ½%M=MÑÉ¥¹œ ¤¹Í±¥” À°ÄÀ¤ì(€½¹ÍĞÁ•¹‘¥¹œõÉ½ÕÁ•¹™¥±Ñ•È¡¼ôù¼¹ÍÑ…ÑÕÌôôôÁ•¹‘¥¹œœ¤ì(€½¹ÍĞ½Ù•É‘Õ”õÁ•¹‘¥¹œ¹™¥±Ñ•È¡¼ôù¼¹Á±…¹¹•‘}¥¹ÍÑ…±±}‘…Ñ”€˜˜MÑÉ¥¹œ¡¼¹Á±…¹¹•‘}¥¹ÍÑ…±±}‘…Ñ”¤¹Í±¥” À°ÄÀ¤ñÑ½‘…ä¤ì(€½¹ÍĞÑ½‘…å1¥ÍĞõÁ•¹‘¥¹œ¹™¥±Ñ•È¡¼ôùMÑÉ¥¹œ¡¼¹Á±…¹¹•‘}¥¹ÍÑ…±±}‘…Ñ•ñğœœ¤¹Í±¥” À°ÄÀ¤ôôõÑ½‘…ä¤ì(€½¹ÍĞÕ¹Í¡•‘Õ±•õÁ•¹‘¥¹œ¹™¥±Ñ•È¡¼ôø…¼¹Á±…¹¹•‘}¥¹ÍÑ…±±}‘…Ñ”¤ì(€½¹ÍĞ‘ÕÁ±¥…Ñ•É½ÕÁÌõÉ½ÕÁ•¹™¥±Ñ•È¡¼ôù¼¹‘ÕÁ±¥…Ñ•½Õ¹ĞøÀ¤ì((€¥˜¡±½…‘¥¹œ¥É•ÑÕÉ¸€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµİ¡¥Ñ”É½Õ¹‘•µá°‰½É‘•ÈÀ´ĞÑ•áĞµÍ´Ñ•áĞµÉ…ä´ĞÀÀˆû¶f ƒ²ò²ZĞƒ¶b¶f¤ƒ®Ú#®~³²b“®*Pƒ²’D¸¸¸ğ½‘¥Øøì((€É•ÑÕÉ¸€ñ‘¥Ø±…ÍÍ9…µ”ô‰ÍÁ…”µä´Ìˆø(€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É¥É¥µ½±Ì´Ì…À´Èˆø(€€€€€ímlŸ²¶Z'²’Dœ±Á•¹‘¥¹œ¹±•¹Ñ¡t±lŸ²“²æc²f®0œ±É½ÕÁ•¹™¥±Ñ•È¡àôùà¹ÍÑ…ÑÕÌôôô½µÁ±•Ñ•œ¤¹±•¹Ñ¡t±lŸ²Ş£²0œ±É½ÕÁ•¹™¥±Ñ•È¡àôùà¹ÍÑ…ÑÕÌôôô…¹•±±•œ¤¹±•¹Ñ¡t±lŸ²b“®*`ƒ²“²æ`œ±Ñ½‘…å1¥ÍĞ¹±•¹Ñ¡t±lŸ²b#²‚W²vğƒªÊ÷ªÎğœ±½Ù•É‘Õ”¹±•¹Ñ¡t±lŸ²’G®ÎÔƒ²vc².°œ±‘ÕÁ±¥…Ñ•É½ÕÁÌ¹±•¹Ñ¡ut¹µ…À ¡m°±Ùt¤ôø(€€€€€€€€ñ‘¥Ø­•äõí±ô±…ÍÍ9…µ”ô‰‰œµİ¡¥Ñ”É½Õ¹‘•µá°‰½É‘•È‰½É‘•ÈµÉ…ä´ÄÀÀÀ´ÌÑ•áĞµ•¹Ñ•Èˆø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµ±œ™½¹Ğµ‰½±ˆùíÙôğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀˆùí±ôğ½‘¥Øø(€€€€€€€€ğ½‘¥Øø¥ô(€€€€ğ½‘¥Øø(€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµİ¡¥Ñ”É½Õ¹‘•µá°‰½É‘•È‰½É‘•ÈµÉ…ä´ÄÀÀ½Ù•É™±½Üµ¡¥‘‘•¸ˆø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Áà´ĞÁä´Ì‰½É‘•Èµˆˆøñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµÍÑ…ÉĞ©ÕÍÑ¥™äµ‰•Ñİ••¸…À´Ìˆøñ‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´™½¹Ğµ‰½±ˆûÂ~>€ƒ²jÃ®š°ƒ®“²z”ƒ¶f ƒ²ò²ZĞğ½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ…ä´ĞÀÀˆû²¶J ƒ²^³®~°ƒªÂs®>ƒªÎƒªÂt€ÇªÆÓ²ró®†pƒ®²Û²ZĞƒ®ÎÓ²^³²’c²jP¸ğ½‘¥Øøğ½‘¥Øøñ‰ÕÑÑ½¸½¹±¥¬õí±½…‘ô±…ÍÍ9…µ”ô‰Ñ•áĞµáÌ™½¹Ğµ‰½±Ñ•áĞµÙ¥½±•Ğ´ØÀÀˆûŠìƒ²#®†sªÎƒ²æ ğ½‰ÕÑÑ½¸øğ½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à…À´Ä¸ÔµĞ´ÌˆùímlÁ•¹‘¥¹œœ°Ÿ²¶Z'²’Dt±l½µÁ±•Ñ•œ°Ÿ²“²æc²f®0t±l…¹•±±•œ°Ÿ²Ş£²0ut¹µ…À ¡m¬±±t¤ôøñ‰ÕÑÑ½¸­•äõí­ô½¹±¥¬õì ¤ôùÍ•ÑMÑ…ÑÕÍ¥±Ñ•È¡¬¥ô±…ÍÍ9…µ”õíÁà´ÌÁä´Ä¸ÔÉ½Õ¹‘•µ™Õ±°Ñ•áĞµlÄÅÁát™½¹Ğµ‰½±€‘íÍÑ…ÑÕÍ¥±Ñ•Èôôõ¬ü‰œµÙ¥½±•Ğ´ØÀÀÑ•áĞµİ¡¥Ñ”œè‰œµÉ…ä´ÄÀÀÑ•áĞµÉ…ä´ÔÀÀõôùí±ôíÉ½ÕÁ•¹™¥±Ñ•È¡àôùà¹ÍÑ…ÑÕÌôôõ¬¤¹±•¹Ñ¡ôğ½‰ÕÑÑ½¸ø¥ôğ½‘¥Øø(€€€€€€€í±…ÍÑ1½…‘•‘Ğ˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlåÁátÑ•áĞµÉ…ä´ÌÀÀµĞ´Èˆû®#²®$ƒªÂÇ².€í±…ÍÑ1½…‘•‘Ğ¹Ñ½1½…±•Q¥µ•MÑÉ¥¹œ ­¼µ-Hœ±í¡½ÕÈèœÈµ‘¥¥Ğœ±µ¥¹ÕÑ”èœÈµ‘¥¥Ğô¥ôğ½‘¥Øùôğ½‘¥Øø(€€€€€íÙ¥Í¥‰±”¹±•¹Ñ ôôôÀüñ‘¥Ø±…ÍÍ9…µ”ô‰Áä´ÄÀÑ•áĞµ•¹Ñ•ÈÑ•áĞµÍ´Ñ•áĞµÉ…ä´ĞÀÀˆû¶VÓ®.äƒ¶f ƒ²Ê·²V÷²vĞƒ²^²ZÓ²jP¸ğ½‘¥Øøè(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‘¥Ù¥‘”µäˆùíl¸¸¹Ù¥Í¥‰±•t¹Í½ÉĞ ¡„±ˆ¤ôùMÑÉ¥¹œ¡„¹Á±…¹¹•‘}¥¹ÍÑ…±±}‘…Ñ•ñğœääääœ¤¹±½…±•½µÁ…É”¡MÑÉ¥¹œ¡ˆ¹Á±…¹¹•‘}¥¹ÍÑ…±±}‘…Ñ•ñğœääääœ¤¤¤¹µ…À¡¼ôùì(€€€€€€€€€½¹ÍĞ•µÀõ•µÁ5…Ám¼¹ÕÍ•É}¥‘t°Àõ¼¹Á±…¹¹•‘}¥¹ÍÑ…±±}‘…Ñ”ıMÑÉ¥¹œ¡¼¹Á±…¹¹•‘}¥¹ÍÑ…±±}‘…Ñ”¤¹Í±¥” À°ÄÀ¤é¹Õ±°ì(€€€€€€€€€½¹ÍĞ½Ù•Èõ¼¹ÍÑ…ÑÕÌôôôÁ•¹‘¥¹œœ˜™À˜™ÀñÑ½‘…ä°¥ÍQ½‘…äõÀôôõÑ½‘…äì(€€€€€€€€€½¹ÍĞÁÉ½‘ÕÑ1…‰•°ô¡­•ä¤ôù!=5}=II}AI=UQL¹™¥¹¡àôùà¹­•äôôõ­•ä¤ü¹±…‰•±ññ­•äì(€€€€€€€€€½¹ÍĞÁÉ½‘ÕÑÌõ¼¹ÁÉ½‘ÕÑQåÁ•Ì¹µ…À¡ÁÉ½‘ÕÑ1…‰•°¤ì(€€€€€€€€€½¹ÍĞ‘ÕÁ±¥…Ñ•1…‰•°õ¼¹É•Á•…Ñ•‘	Õ¹‘±•½Õ¹ĞøÄ(€€€€€€€€€€€€üƒ®>g²vğƒ¶f ƒªÖ³²Ä€‘í¼¹É•Á•…Ñ•‘	Õ¹‘±•½Õ¹Ñ÷¶j0ƒ²‚²z”ƒ¶fW²vá€(€€€€€€€€€€€€è¼¹É•Á•…Ñ•‘AÉ½‘ÕÑÌü¹±•¹Ñ (€€€€€€€€€€€€€€ü€‘í¼¹É•Á•…Ñ•‘AÉ½‘ÕÑÌ¹µ…À¡¥Ñ•´ôù€‘íÁÉ½‘ÕÑ1…‰•°¡¥Ñ•´¹ÁÉ½‘ÕÑQåÁ”¥ô€‘í¥Ñ•´¹½Õ¹Ñ÷¶j1€¤¹©½¥¸ œƒ
Ü€œ¥ôƒ²‚²z”ƒ¶fW²vá€(€€€€€€€€€€€€€€è€œœì(€€€€€€€€€É•ÑÕÉ¸€ñ‘¥Ø­•äõí¼¹­•åô±…ÍÍ9…µ”ô‰Áà´ĞÁä´Ìˆø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à©ÕÍÑ¥™äµ‰•Ñİ••¸…À´Ìˆøñ‘¥Øø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È…À´Ä¸Ô™±•àµİÉ…Àˆø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´™½¹Ğµ‰½±ˆùí¼¹ÕÍÑ½µ•É}¹…µ•ñğŸªÎƒªÂw®ªƒ®¾ã²z®‚”ôğ½‘¥Øø(€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”õíÑ•áĞµlåÁát™½¹Ğµ‰½±Áà´Ä¸ÔÁä´À¸ÔÉ½Õ¹‘•µ™Õ±°€‘ì(€€€€€€€€€€€€€€€€€¼¹¹•Ñİ½É­}ÑåÁ”ôôôÍ½¡¼œü‰œµ‰±Õ”´ÔÀÑ•áĞµ‰±Õ”´ØÀÀœè(€€€€€€€€€€€€€€€€€¼¹¹•Ñİ½É­}ÑåÁ”ôôô¡½ÕÍ•¡½±œü‰œµÙ¥½±•Ğ´ÔÀÑ•áĞµÙ¥½±•Ğ´ØÀÀœè‰œµÉ…ä´ÄÀÀÑ•áĞµÉ…ä´ĞÀÀœ(€€€€€€€€€€€€€€€õôùí¡½µ•9•Ñİ½É­1…‰•°¡¼¹¹•Ñİ½É­}ÑåÁ”¥ôğ½ÍÁ…¸ø(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ…ä´ÔÀÀµĞ´Äˆùí•µÀü¹¹…µ•ñğŸ²²n@ôƒ
Üí•µÀü¹‰É…¹¡ñğœôğ½‘¥Øøğ½‘¥Øø(€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”õíÑ•áĞµlÄÁÁát™½¹Ğµ‰½±Áà´ÈÁä´ÄÉ½Õ¹‘•µ™Õ±° µ™¥Ğ€‘í½Ù•Èü‰œµÉ•´ÔÀÑ•áĞµÉ•´ØÀÀœé¥ÍQ½‘…äü‰œµ½É…¹”´ÔÀÑ•áĞµ½É…¹”´ØÀÀœè‰œµÙ¥½±•Ğ´ÔÀÑ•áĞµÙ¥½±•Ğ´ØÀÀõôø(€€€€€€€€€€€€€€€í¼¹ÍÑ…ÑÕÌôôô½µÁ±•Ñ•œüŸ²“²æc²f®0œé¼¹ÍÑ…ÑÕÌôôô…¹•±±•œüŸ²Ş£²0œé½Ù•ÈüŸ¶fW²vàƒ¶V²jPœé¥ÍQ½‘…äüŸ²b“®*`ƒ²“²æ`œéÀüŸ²“²æ`ƒ²b#²‚TœèŸ²vó²‚Tƒ®¾ã²‚Tôğ½ÍÁ…¸øğ½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à™±•àµİÉ…À…À´ÄµĞ´ÈˆùíÁÉ½‘ÕÑÌ¹µ…À¡àôøñÍÁ…¸­•äõíáô±…ÍÍ9…µ”ô‰Áà´ÈÁä´ÄÉ½Õ¹‘•µµ‰œµÉ…ä´ÔÀÑ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ØÀÀˆùíáôğ½ÍÁ…¸ø¥õí‘ÕÁ±¥…Ñ•1…‰•°˜˜ñÍÁ…¸±…ÍÍ9…µ”ô‰Áà´ÈÁä´ÄÉ½Õ¹‘•µµ‰œµÉ•´ÔÀÑ•áĞµlÄÁÁát™½¹Ğµ‰½±Ñ•áĞµÉ•´ØÀÀˆùí‘ÕÁ±¥…Ñ•1…‰•±ôğ½ÍÁ…¸ùôğ½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÅÁátÑ•áĞµÉ…ä´ĞÀÀµĞ´Èˆû²‚G²"`í¼¹Í½ÕÉ•}İ½É­}‘…Ñ•ññMÑÉ¥¹œ¡¼¹…ÁÁ±¥•‘}…Ğ¤¹Í±¥” À°ÄÀ¥ôƒ
Üƒ²“²æc²b#²‚TíÁñğŸ®¾ã²‚Tôğ½‘¥Øø(€€€€€€€€€€ğ½‘¥Øùô¥ôğ½‘¥Øùô(€€€€ğ½‘¥Øø(€€ğ½‘¥Øøì)ô(()™Õ¹Ñ¥½¸…‘µ¥¹5•ÑÉ¥Y…±Õ”¡É½Ü±­•ä¥ì(€½¹ÍĞõÉ½Üü¹‘É…™Ñññíôì(€¥˜¡­•äôôô¡Ìœ¥É•ÑÕÉ¸¡Í½Õ¹Ğ¡¤ì(€¥˜¡­•äôôôÍ¥µ5¹Àœ¥É•ÑÕÉ¸=‰©•Ğ¹Ù…±Õ•Ì¡¹µ¹Á	Õ¹‘±•ññíô¤¹É•‘Õ” ¡Ì±Ø¤ôùÌ­9Õµ‰•È¡ÙñğÀ¤°À¤ì(€¥˜¡­•äôôôÍ•½¹œ¥É•ÑÕÉ¸=‰©•Ğ¹Ù…±Õ•Ì¡¹‰Õ¹‘±”É¹‘ññíô¤¹É•‘Õ” ¡Ì±Ø¤ôùÌ­9Õµ‰•È¡ÙñğÀ¤°À¤ì(€¥˜¡­•äôôô¡½µ”œ¥É•ÑÕÉ¸½µÁ±•Ñ•‘!½µ•½Õ¹Ğ¡¤ì(€¥˜¡­•äôôô™É•”œ¥É•ÑÕÉ¸9Õµ‰•È¡¹¡½µ•±…Ğü¹ÑÙÉ••ñğÀ¤ì(€¥˜¡­•äôôôÍµ…ÉĞœ¥É•ÑÕÉ¸9Õµ‰•È¡¹¡½µ•±…Ğü¹Íµ…ÉÑ!½µ•ñğÀ¤ì(€¥˜¡­•äôôôÕÁÍ•±°œ¥É•ÑÕÉ¸9Õµ‰•È¡¹Ñ…¥±½É•‘½Õ¹ÑñğÀ¤ì(€¥˜¡­•äôôôÕÁÍ•±±µ½Õ¹Ğœ¥É•ÑÕÉ¸9Õµ‰•È¡¹Ñ…¥±½É•‘µ½Õ¹ÑñğÀ¤ì(€¥˜¡­•äôôôÍ½¹¼œ¥É•ÑÕÉ¸=‰©•Ğ¹Ù…±Õ•Ì¡¹Í½¹½ññíô¤¹É•‘Õ” ¡Ì±Ø¤ôùÌ­9Õµ‰•È¡ÙñğÀ¤°À¤ì(€¥˜¡­•äôôôÁÉ½‘ÕÑ¥Ù¥Ñäœ¥É•ÑÕÉ¸9Õµ‰•È¡É½Üü¹Á…äü¹­Á¥M½É•ñğÀ¤ì(€É•ÑÕÉ¸€Àì)ô)½¹ÍĞ5%9}5%9}5QI%Lõl(€l¡Ìœ°!Lœ°½Õ¹Ğt±lÍ¥µ5¹Àœ°M%459@œ°½Õ¹Ğt±lÍ•½¹œ°œÉ9œ°½Õ¹Ğt±lÁÉ½‘ÕÑ¥Ù¥Ñäœ°Ÿ²w²
Ã²Äœ°Á½¥¹Ğt°(€l¡½µ”œ°Ÿ¶f ƒ².“²‚œ°½Õ¹Ğt±l™É•”œ°Ÿ¶R®š°œ°½Õ¹Ğt±lÍµ…ÉĞœ°Ÿ²*“®#¶*ã¶f œ°½Õ¹Ğt±lÍ½¹¼œ°Ÿ²3®àœ°½Õ¹Ğt°(€lÕÁÍ•±±µ½Õ¹Ğœ°Ÿ®{²Ú“²‚s²V ƒ®“²Ús²V„œ°İ½¸t±lÕÁÍ•±°œ°Ÿ²^²ªÆĞœ°½Õ¹Ğt)tì(()™Õ¹Ñ¥½¸ÍÑ½É•5•ÑÉ¥É½µI½İÌ¡ÍÑ½É•I½İÌ±­•ä¥ì(€½¹ÍĞ±¥ÍĞõÍÑ½É•I½İÍññmtì(€¥˜¡­•äôôôÁÉ½‘ÕÑ¥Ù¥Ñäœ¤É•ÑÕÉ¸±¥ÍĞ¹É•‘Õ” ¡Ì±È¤ôùÌ­9Õµ‰•È¡È¹Á…äü¹­Á¥M½É•ñğÀ¤°À¤ì(€É•ÑÕÉ¸±¥ÍĞ¹É•‘Õ” ¡Ì±È¤ôùÌ­…‘µ¥¹5•ÑÉ¥Y…±Õ”¡È±­•ä¤°À¤ì)ô()™Õ¹Ñ¥½¸ÍÑ½É•½…±¡¥•Ù•µ•¹Ğ¡½µÁ…¹ä±ÍÑ½É•I½İÌ±™¥¹…±A•É™½Éµ…¹”õ¹Õ±°¥ì(€½¹ÍĞµ•ÑÉ¥Ìõl(€€€l¡Ìœ°¡Ìt±l¡½µ”œ°¡½µ”t±lÁÉ½‘ÕÑ¥Ù¥Ñäœ°ÁÉ½‘ÕÑ¥Ù¥Ñät°(€€€lÑÙÉ•”œ°™É•”t±lÍµ…ÉÑ!½µ”œ°Íµ…ÉĞt±lÑ…¥±½É•‘½Õ¹Ğœ°ÕÁÍ•±°t(€tì(€½¹ÍĞ‘•Ñ…¥°õµ•ÑÉ¥Ì¹µ…À ¡m½…±-•ä±É½İ-•åt¤ôùì(€€€½¹ÍĞÑ…É•Ğõ9Õµ‰•È¡½µÁ…¹äü¹m½…±-•åuñğÀ¤ì(€€€½¹ÍĞ¥¹ÁÕÑÑÕ…°õÍÑ½É•5•ÑÉ¥É½µI½İÌ¡ÍÑ½É•I½İÌ±É½İ-•ä¤ì(€€€½¹ÍĞ…ÑÕ…°õ™¥¹…±A•É™½Éµ…¹”ı™¥¹…±MÑ½É•5•ÑÉ¥Œ¡™¥¹…±A•É™½Éµ…¹”±É½İ-•ä±¥¹ÁÕÑÑÕ…°¤é¥¹ÁÕÑÑÕ…°ì(€€€½¹ÍĞÁĞõÑ…É•ĞøÀ€ü…ÑÕ…°½Ñ…É•Ğ¨ÄÀÀ€è€Àì(€€€É•ÑÕÉ¸í½…±-•ä±É½İ-•ä±Ñ…É•Ğ±…ÑÕ…°±ÁÑôì(€ô¤¹™¥±Ñ•È¡àôùà¹Ñ…É•ĞøÀ¤ì(€½¹ÍĞ…¡¥•Ù•õ‘•Ñ…¥°¹™¥±Ñ•È¡àôùà¹ÁĞøôÄÀÀ¤¹±•¹Ñ ì(€½¹ÍĞÍ½É”õ‘•Ñ…¥°¹±•¹Ñ (€€€€ü‘•Ñ…¥°¹É•‘Õ” ¡Ì±à¤ôùÌ­5…Ñ ¹µ¥¸ ÄÈÀ±à¹ÁĞ¤°À¤½‘•Ñ…¥°¹±•¹Ñ (€€€€è€Àì(€É•ÑÕÉ¸í‘•Ñ…¥°±…¡¥•Ù•±Ñ½Ñ…°é‘•Ñ…¥°¹±•¹Ñ ±Í½É•ôì)ô()™Õ¹Ñ¥½¸MÑ½É•¡…±±•¹•…É¡ìµ½¹Ñ °…±±I½İÌ°•µÁ±½å••Ì°…ÕÑ¡UÍ•É%°½¹=Á•¹½…±Ìô¤ì(€½¹ÍĞ™¥¹…±A•É™½Éµ…¹•ÌõÕÍ•¥¹…±MÑ½É•A•É™½Éµ…¹”¡µ½¹Ñ ¤ì(€½¹ÍĞm½…±I½İÌ±Í•Ñ½…±I½İÍtõÕÍ•MÑ…Ñ”¡mt¤ì(€½¹ÍĞm±½…‘¥¹œ±Í•Ñ1½…‘¥¹tõÕÍ•MÑ…Ñ”¡ÑÉÕ”¤ì(€½¹ÍĞµ”ô¡•µÁ±½å••Íññmt¤¹™¥¹¡”ôù”¹¥ôôõ…ÕÑ¡UÍ•É%¤ì((€ÕÍ•™™•Ğ  ¤ôùì(€€€€¡…Íå¹Œ ¤ôùì(€€€€€Í•Ñ1½…‘¥¹œ¡ÑÉÕ”¤ì(€€€€€½¹ÍĞí‘…Ñ…ôõ…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ ÍÑ½É•}½…±Ìœ¤¹Í•±•Ğ ÍÑ½É•}¹…µ”±½µÁ…¹å}½…±Ìœ¤¹•Ä µ½¹Ñ œ±µ½¹Ñ ¤ì(€€€€€Í•Ñ½…±I½İÌ¡‘…Ñ…ññmt¤ì(€€€€€Í•Ñ1½…‘¥¹œ¡™…±Í”¤ì(€€€ô¤ ¤ì(€ô±mµ½¹Ñ¡t¤ì((€½¹ÍĞ½…±5…Àõ=‰©•Ğ¹™É½µ¹ÑÉ¥•Ì ¡½…±I½İÍññmt¤¹µ…À¡œôùl(€€€œ¹ÍÑ½É•}¹…µ”°(€€€ì¸¸¹½µÁ…¹å½…±•™…Õ±ÑÌ¡œ¹ÍÑ½É•}¹…µ”¤°¸¸¸¡œ¹½µÁ…¹å}½…±Íññíô¥ô(€t¤¤ì((€½¹ÍĞ‰É…¹¡•Ìõl¸¸¹¹•ÜM•Ğ ¡…±±I½İÍññmt¤(€€€€¹µ…À¡ÈôùÈ¹‰É…¹ ¤(€€€€¹™¥±Ñ•È¡	½½±•…¸¤(€€€€¹™¥±Ñ•È¡ˆôø…9=9}M1M}MQ=IL¹¥¹±Õ‘•Ì¡ˆ¤¤(€€¥tì((€½¹ÍĞÉ…¹­•õ‰É…¹¡•Ì¹µ…À¡‰É…¹ ôùì(€€€½¹ÍĞ‰É…¹¡I½İÌô¡…±±I½İÍññmt¤¹™¥±Ñ•È¡ÈôùÈ¹‰É…¹ ôôõ‰É…¹ ¤ì(€€€½¹ÍĞ½µÁ…¹äõ½…±5…Ám‰É…¹¡uññ½µÁ…¹å½…±•™…Õ±ÑÌ¡‰É…¹ ¤ì(€€€½¹ÍĞ…¡¥•Ù•µ•¹ĞõÍÑ½É•½…±¡¥•Ù•µ•¹Ğ¡½µÁ…¹ä±‰É…¹¡I½İÌ±™¥¹…±A•É™½Éµ…¹•Ím‰É…¹¡t¤ì(€€€É•ÑÕÉ¸í‰É…¹ °¸¸¹…¡¥•Ù•µ•¹Ñôì(€ô¤¹™¥±Ñ•È¡àôùà¹Ñ½Ñ…°øÀ¤(€€€€¹Í½ÉĞ ¡„±ˆ¤ôùˆ¹Í½É”µ„¹Í½É”ñğˆ¹…¡¥•Ù•µ„¹…¡¥•Ù•ñğ„¹‰É…¹ ¹±½…±•½µÁ…É”¡ˆ¹‰É…¹ ¤¤ì((€½¹ÍĞµå	É…¹ õµ”ü¹‰É…¹ ì(€½¹ÍĞµå%¹‘•àõÉ…¹­•¹™¥¹‘%¹‘•à¡àôùà¹‰É…¹ ôôõµå	É…¹ ¤ì(€½¹ÍĞÑ½ÀÌõÉ…¹­•¹Í±¥” À°Ì¤ì((€É•ÑÕÉ¸€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµİ¡¥Ñ”É½Õ¹‘•µá°‰½É‘•È‰½É‘•Èµ…µ‰•È´ÄÀÀ½Ù•É™±½Üµ¡¥‘‘•¸ˆø(€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Áà´ĞÁä´Ì‰½É‘•Èµˆ‰½É‘•Èµ…µ‰•È´ÔÀ™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•Ñİ••¸…À´Ìˆø(€€€€€€ñ‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµ…µ‰•È´ØÀÀˆûÂ~>ƒ®“²z”ƒ²Æ3®šÃ² ğ½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´™½¹Ğµ‰½±Ñ•áĞµÉ…ä´äÀÀˆûªâÃ²’ ƒ®ª§¶Fpƒ²Š¶V¤ƒ®.³²Äğ½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀµĞ´À¸Ôˆù!Lƒ
Üƒ¶f ƒ
Üƒ²w²
Ã²Äƒ
Üƒ¶R®š°ƒ
Üƒ²*“®#¶*ã¶f ƒ
Üƒ²^² ƒªâÃ²’ ğ½‘¥Øø(€€€€€€ğ½‘¥Øø(€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õí½¹=Á•¹½…±Íô±…ÍÍ9…µ”ô‰Ñ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÙ¥½±•Ğ´ØÀÀˆû®ª§¶Fpƒ®ÎÓªâÀƒŠèğ½‰ÕÑÑ½¸ø(€€€€ğ½‘¥Øø(€€€í±½…‘¥¹œüñ‘¥Ø±…ÍÍ9…µ”ô‰Áä´ÜÑ•áĞµ•¹Ñ•ÈÑ•áĞµáÌÑ•áĞµÉ…ä´ĞÀÀˆû²"s²rƒªÎ²
Àƒ²’D¸¸¸ğ½‘¥Øøè(€€€É…¹­•¹±•¹Ñ ôôôÀüñ‘¥Ø±…ÍÍ9…µ”ô‰Áä´ÜÑ•áĞµ•¹Ñ•ÈÑ•áĞµáÌÑ•áĞµÉ…ä´ĞÀÀˆû®æªÖC¶V€ƒ®“²z”ƒ®6Ã²vÓ¶ÃªÂ ƒ²^²ZÓ²jP¸ğ½‘¥Øøè(€€€€ğø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‘¥Ù¥‘”µä‘¥Ù¥‘”µÉ…ä´ÔÀˆø(€€€€€€€íÑ½ÀÌ¹µ…À ¡à±¤¤ôø (€€€€€€€€€€ñ‘¥Ø­•äõíà¹‰É…¹¡ô±…ÍÍ9…µ”ô‰Áà´ĞÁä´Ì™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•Ñİ••¸…À´Ìˆø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È…À´Ìµ¥¸µÜ´Àˆø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÜ´Ü ´ÜÉ½Õ¹‘•µ™Õ±°™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ•¹Ñ•ÈÑ•áĞµáÌ™½¹Ğµ‰½±€‘ì(€€€€€€€€€€€€€€€¤ôôôÀü‰œµ…µ‰•È´ÄÀÀÑ•áĞµ…µ‰•È´ÜÀÀœé¤ôôôÄü‰œµÉ…ä´ÄÀÀÑ•áĞµÉ…ä´ØÀÀœè‰œµ½É…¹”´ÄÀÀÑ•áĞµ½É…¹”´ÜÀÀœ(€€€€€€€€€€€€€õôùí¤¬Åôğ½‘¥Øø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µ¥¸µÜ´Àˆø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÉ…ä´àÀÀÑÉÕ¹…Ñ”ˆùí‘¥ÍÁ±…åMÑ½É•9…µ”¡à¹‰É…¹ ¥ôğ½‘¥Øø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀˆûªâÃ²’ ƒ®ª§¶Fpíà¹Ñ½Ñ…±÷ªÂ² ƒ²’Díà¹…¡¥•Ù•‘÷ªÂ² ƒ®.³²Äğ½‘¥Øø(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´™½¹Ğµ‰½±Ñ•áĞµ…µ‰•È´ÜÀÀˆùíà¹Í½É”¹Ñ½¥á• Ä¥÷²‚@ğ½‘¥Øø(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€¤¥ô(€€€€€€ğ½‘¥Øø(€€€€€íµå%¹‘•àøôÌ˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰Áà´ĞÁä´Ì‰œµÙ¥½±•Ğ´ÔÀ™±•à©ÕÍÑ¥™äµ‰•Ñİ••¸Ñ•áĞµáÌÑ•áĞµÙ¥½±•Ğ´ÜÀÀˆø(€€€€€€€€ñˆû²jÃ®š°ƒ®“²z”íµå%¹‘•à¬Å÷²rğ½ˆø(€€€€€€€€ñÍÁ…¸ùíÉ…¹­•‘mµå%¹‘•át¹Í½É”¹Ñ½¥á• Ä¥÷²‚@ƒ
ÜíÉ…¹­•‘mµå%¹‘•át¹Ñ½Ñ…±÷ªÂ² ƒ²’DíÉ…¹­•‘mµå%¹‘•át¹…¡¥•Ù•‘÷ªÂ² ƒ®.³²Äğ½ÍÁ…¸ø(€€€€€€ğ½‘¥Øùô(€€€€ğ¼ùô(€€ğ½‘¥Øøì)ô()™Õ¹Ñ¥½¸MÑ½É•½…±…Í¡‰½…É‘…É¡ìÉ½İÌ°•µÁ±½å••Ì°…ÕÑ¡UÍ•É%°µ½¹Ñ °½¹=Á•¸ô¤ì(€½¹ÍĞm½…°±Í•Ñ½…±tõÕÍ•MÑ…Ñ”¡¹Õ±°¤ì(€½¹ÍĞµ”ô¡•µÁ±½å••Íññmt¤¹™¥¹¡”ôù”¹¥ôôõ…ÕÑ¡UÍ•É%¤ì(€½¹ÍĞ‰É…¹ õµ”ü¹‰É…¹ ñğÉ½İÌü¹lÁtü¹‰É…¹ ì(€½¹ÍĞ™¥¹…±A•É™½Éµ…¹”õÕÍ•¥¹…±MÑ½É•A•É™½Éµ…¹”¡µ½¹Ñ ±‰É…¹¡ñğœœ¤ì((€ÕÍ•™™•Ğ  ¤ôùì(€€€¥˜ …‰É…¹¡ññ9=9}M1M}MQ=IL¹¥¹±Õ‘•Ì¡‰É…¹ ¤¥íÍ•Ñ½…°¡¹Õ±°¤íÉ•ÑÕÉ¸íô(€€€€¡…Íå¹Œ ¤ôùì(€€€€€½¹ÍĞí‘…Ñ…ôõ…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ ÍÑ½É•}½…±Ìœ¤¹Í•±•Ğ ½µÁ…¹å}½…±Ì±¡…±±•¹•}½…±Ìœ¤(€€€€€€€€¹•Ä µ½¹Ñ œ±µ½¹Ñ ¤¹•Ä ÍÑ½É•}¹…µ”œ±‰É…¹ ¤¹µ…å‰•M¥¹±” ¤ì(€€€€€Í•Ñ½…°¡ì(€€€€€€€½µÁ…¹å}½…±Ìéì¸¸¹½µÁ…¹å½…±•™…Õ±ÑÌ¡‰É…¹ ¤°¸¸¸¡‘…Ñ„ü¹½µÁ…¹å}½…±Íññíô¥ô°(€€€€€€€¡…±±•¹•}½…±Ìé‘…Ñ„ü¹¡…±±•¹•}½…±Íññíô(€€€€€ô¤ì(€€€ô¤ ¤ì(€ô±mµ½¹Ñ ±‰É…¹¡t¤ì((€¥˜ …‰É…¹¡ññ9=9}M1M}MQ=IL¹¥¹±Õ‘•Ì¡‰É…¹ ¥ñğ…½…°¥É•ÑÕÉ¸¹Õ±°ì(€½¹ÍĞ½µÁ…¹å õÍÑ½É•½…±¡¥•Ù•µ•¹Ğ¡½…°¹½µÁ…¹å}½…±Ì±É½İÌ±™¥¹…±A•É™½Éµ…¹”¤ì(€½¹ÍĞ¡…±±•¹•	…Í”õì¸¸¹½…°¹½µÁ…¹å}½…±Ì°¸¸¹½…°¹¡…±±•¹•}½…±Íôì(€½¹ÍĞ¡…±±•¹• õÍÑ½É•½…±¡¥•Ù•µ•¹Ğ¡¡…±±•¹•	…Í”±É½İÌ±™¥¹…±A•É™½Éµ…¹”¤ì((€É•ÑÕÉ¸€ñ‰ÕÑÑ½¸½¹±¥¬õí½¹=Á•¹ô±…ÍÍ9…µ”ô‰Üµ™Õ±°Ñ•áĞµ±•™Ğ‰œµİ¡¥Ñ”É½Õ¹‘•µá°‰½É‘•È‰½É‘•ÈµÉ…ä´ÄÀÀÀ´Ğˆø(€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•Ñİ••¸…À´Ìˆø(€€€€€€ñ‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ…ä´ĞÀÀˆûÂ~:¼ƒ®“²z”ƒ®ª§¶Fpƒ®.³²Äğ½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´™½¹Ğµ‰½±Ñ•áĞµÉ…ä´äÀÀµĞ´Äˆø(€€€€€€€€€ƒªâÃ²’ ƒ®ª§¶Fpí½µÁ…¹å ¹Ñ½Ñ…±÷ªÂ² ƒ²’D€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµÙ¥½±•Ğ´ÜÀÀˆùí½µÁ…¹å ¹…¡¥•Ù•‘÷ªÂ² ğ½ÍÁ…¸øƒ®.³²Ä(€€€€€€€€ğ½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ…ä´ÔÀÀµĞ´Äˆø(€€€€€€€€€ƒ®>²‚ƒ®ª§¶Fpí¡…±±•¹• ¹Ñ½Ñ…±÷ªÂ² ƒ²’Dí¡…±±•¹• ¹…¡¥•Ù•‘÷ªÂ² ƒ®.³²Äƒ
Üƒ²Š¶V¤í½µÁ…¹å ¹Í½É”¹Ñ½¥á• Ä¥÷²‚@(€€€€€€€€ğ½‘¥Øø(€€€€€€€í™¥¹…±A•É™½Éµ…¹”˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlåÁát™½¹ĞµÍ•µ¥‰½±Ñ•áĞµ•µ•É…±´ØÀÀµĞ´Äˆû®#ªÂ@ƒ¶fW²‚Tƒ².“²‚ƒªâÃ²’ ğ½‘¥Øùô(€€€€€€ğ½‘¥Øø(€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÙ¥½±•Ğ´ØÀÀˆû²²àƒŠèğ½ÍÁ…¸ø(€€€€ğ½‘¥Øø(€€ğ½‰ÕÑÑ½¸øì)ô()™Õ¹Ñ¥½¸‘µ¥¹ÕÍÑ½µ•É…É•=Ù•ÉÙ¥•Ü¡ì•µÁ±½å••Ì°µ½¹Ñ °¥¹¥Ñ¥…±¥±Ñ•ÈôÑ½‘¼œ°½µÁ…Ğõ™…±Í”°½¹=Á•¸ô¤ì(€½¹ÍĞmÑ…Í­Ì±Í•ÑQ…Í­ÍtõÕÍ•MÑ…Ñ”¡mt¤±mÕÍÑ½µ•ÉÌ±Í•ÑÕÍÑ½µ•ÉÍtõÕÍ•MÑ…Ñ”¡mt¤±mÍ…±•Ì±Í•ÑM…±•ÍtõÕÍ•MÑ…Ñ”¡mt¤±m±½…‘¥¹œ±Í•Ñ1½…‘¥¹tõÕÍ•MÑ…Ñ”¡ÑÉÕ”¤±m±½…‘ÉÉ½È±Í•Ñ1½…‘ÉÉ½ÉtõÕÍ•MÑ…Ñ” œœ¤ì(€½¹ÍĞm™¥±Ñ•È±Í•Ñ¥±Ñ•ÉtõÕÍ•MÑ…Ñ”¡¥¹¥Ñ¥…±¥±Ñ•È¤±m…Ñ•½Éä±Í•Ñ…Ñ•½ÉåtõÕÍ•MÑ…Ñ” …±°œ¤±m‰É…¹ ±Í•Ñ	É…¹¡tõÕÍ•MÑ…Ñ” …±°œ¤±m•µÁ±½å••%±Í•ÑµÁ±½å••%‘tõÕÍ•MÑ…Ñ” …±°œ¤±mÅÕ•Éä±Í•ÑEÕ•ÉåtõÕÍ•MÑ…Ñ” œœ¤ì(€½¹ÍĞ•µÁ±½å••5…Àõ=‰©•Ğ¹™É½µ¹ÑÉ¥•Ì ¡•µÁ±½å••Íññmt¤¹µ…À¡”ôùm”¹¥±•t¤¤ì(€½¹ÍĞ•µÁ±½å••%‘Ìô¡•µÁ±½å••Íññmt¤¹µ…À¡”ôù”¹¥¤¹™¥±Ñ•È¡	½½±•…¸¤ì(€½¹ÍĞ•µÁ±½å••-•äõ•µÁ±½å••%‘Ì¹©½¥¸ ğœ¤ì(€½¹ÍĞ±½…õÕÍ•…±±‰…¬¡…Íå¹Œ ¤ôùì(€€€¥˜ …•µÁ±½å••%‘Ì¹±•¹Ñ ¥íÍ•ÑQ…Í­Ì¡mt¤íÍ•ÑÕÍÑ½µ•ÉÌ¡mt¤íÍ•ÑM…±•Ì¡mt¤íÍ•Ñ1½…‘¥¹œ¡™…±Í”¤íÉ•ÑÕÉ¸íô(€€€Í•Ñ1½…‘¥¹œ¡ÑÉÕ”¤ì(€€€Í•Ñ1½…‘ÉÉ½È œœ¤ì(€€€½¹ÍĞmí‘…Ñ„éĞ±•ÉÉ½ÈéÑ…Í­ÉÉ½Éô±í‘…Ñ„éŒ±•ÉÉ½ÈéÕÍÑ½µ•ÉÉÉ½Éô±í‘…Ñ„éÌ±•ÉÉ½ÈéÍ…±•ÉÉ½Éõtõ…İ…¥ĞAÉ½µ¥Í”¹…±°¡l(€€€€€ÍÕÁ…‰…Í”¹™É½´ ÕÍÑ½µ•É}Ñ…Í­Ìœ¤¹Í•±•Ğ œ¨œ¤¹¥¸ ÕÍ•É}¥œ±•µÁ±½å••%‘Ì¤¹½É‘•È ‘Õ•}‘…Ñ”œ±í…Í•¹‘¥¹œéÑÉÕ•ô¤°(€€€€€ÍÕÁ…‰…Í”¹™É½´ ÕÍÑ½µ•ÉÌœ¤¹Í•±•Ğ ¥±ÕÍ•É}¥±ÕÍÑ½µ•É}¹…µ”œ¤¹¥¸ ÕÍ•É}¥œ±•µÁ±½å••%‘Ì¤°(€€€€€½µÁ…ĞıAÉ½µ¥Í”¹É•Í½±Ù”¡í‘…Ñ„émt±•ÉÉ½Èé¹Õ±±ô¤éÍÕÁ…‰…Í”¹™É½´ ÕÍÑ½µ•É}Í…±•Ìœ¤¹Í•±•Ğ ¥±ÕÍ•É}¥±ÕÍÑ½µ•É}¥±Í…±•}‘…Ñ”±µ•ÑÉ¥}±…‰•°±Í½ÕÉ•}ÑåÁ”œ¤¹¥¸ ÕÍ•É}¥œ±•µÁ±½å••%‘Ì¤¹½É‘•È Í…±•}‘…Ñ”œ±í…Í•¹‘¥¹œé™…±Í•ô¤¹±¥µ¥Ğ ÈÀÀÀ¤(€€€t¤ì(€€€¥˜¡Ñ…Í­ÉÉ½ÉññÕÍÑ½µ•ÉÉÉ½ÉññÍ…±•ÉÉ½È¥Í•Ñ1½…‘ÉÉ½È¡™É¥•¹‘±åÉÉ½È¡Ñ…Í­ÉÉ½ÉññÕÍÑ½µ•ÉÉÉ½ÉññÍ…±•ÉÉ½È¤¤ì(€€€Í•ÑQ…Í­Ì¡Ñññmt¤íÍ•ÑÕÍÑ½µ•ÉÌ¡ññmt¤íÍ•ÑM…±•Ì¡Íññmt¤íÍ•Ñ1½…‘¥¹œ¡™…±Í”¤ì(€ô±m•µÁ±½å••-•ä±½µÁ…Ñt¤ì€¼¼•Í±¥¹Ğµ‘¥Í…‰±”µ±¥¹”(€ÕÍ•™™•Ğ  ¤ôùí±½… ¥ô±m±½…‘t¤ì(€ÕÍ•™™•Ğ  ¤ôùíÍ•Ñ¥±Ñ•È¡¥¹¥Ñ¥…±¥±Ñ•È¥ô±m¥¹¥Ñ¥…±¥±Ñ•Ét¤ì(€½¹ÍĞÕÍÑ½µ•É5…Àõ=‰©•Ğ¹™É½µ¹ÑÉ¥•Ì¡ÕÍÑ½µ•ÉÌ¹µ…À¡ŒôùmŒ¹¥±t¤¤ì(€½¹ÍĞÑ½‘…äõ¹•Ü…Ñ” ¤¹Ñ½%M=MÑÉ¥¹œ ¤¹Í±¥” À°ÄÀ¤°İ••¬õ…‘‘…åÍ…Ñ”¡Ñ½‘…ä°Ü¤ì(€½¹ÍĞÍ•±•Ñ•‘5½¹Ñ õµ½¹Ñ¡ññÑ½‘…ä¹Í±¥” À°Ü¤ì(€½¹ÍĞmµ½¹Ñ¡e•…È±µ½¹Ñ¡9Õµ‰•ÉtõÍ•±•Ñ•‘5½¹Ñ ¹ÍÁ±¥Ğ œ´œ¤¹µ…À¡9Õµ‰•È¤ì(€½¹ÍĞµ½¹Ñ¡9•áÑ…Ñ”õ¹•Ü…Ñ”¡µ½¹Ñ¡e•…È±µ½¹Ñ¡9Õµ‰•È°Ä¤ì(€½¹ÍĞµ½¹Ñ¡9•áĞõ€‘íµ½¹Ñ¡9•áÑ…Ñ”¹•ÑÕ±±e•…È ¥ô´‘íMÑÉ¥¹œ¡µ½¹Ñ¡9•áÑ…Ñ”¹•Ñ5½¹Ñ  ¤¬Ä¤¹Á…‘MÑ…ÉĞ È°œÀœ¥ô´ÀÅ€ì(€½¹ÍĞÍ½Á•õÑ…Í­Ì¹™¥±Ñ•È¡Ğôù•µÁ±½å••5…ÁmĞ¹ÕÍ•É}¥‘t¤ì(€½¹ÍĞ…Ñ¥Ù”õÍ½Á•¹™¥±Ñ•È¡ĞôùĞ¹ÍÑ…ÑÕÌ„ôô½µÁ±•Ñ•œ˜™Ğ¹ÍÑ…ÑÕÌ„ôô…¹•±±•œ¤ì(€½¹ÍĞ½Ù•É‘Õ”õ…Ñ¥Ù”¹™¥±Ñ•È¡ĞôùĞ¹‘Õ•}‘…Ñ”˜™Ğ¹‘Õ•}‘…Ñ”ñÑ½‘…ä¤ì(€½¹ÍĞÑ½‘…åQ…Í­Ìõ…Ñ¥Ù”¹™¥±Ñ•È¡ĞôùĞ¹‘Õ•}‘…Ñ”ôôõÑ½‘…ä¤ì(€½¹ÍĞ¹•áĞÜõ…Ñ¥Ù”¹™¥±Ñ•È¡ĞôùĞ¹‘Õ•}‘…Ñ”øõÑ½‘…ä˜™Ğ¹‘Õ•}‘…Ñ”ğõİ••¬¤ì(€½¹ÍĞÍ•±•Ñ•‘5½¹Ñ¡Q…Í­ÌõÍ½Á•¹™¥±Ñ•È¡ĞôùĞ¹‘Õ•}‘…Ñ”øõ€‘íÍ•±•Ñ•‘5½¹Ñ¡ô´ÀÅ€˜™Ğ¹‘Õ•}‘…Ñ”ñµ½¹Ñ¡9•áĞ¤ì(€½¹ÍĞµ…ÑÕÉ•õÍ•±•Ñ•‘5½¹Ñ¡Q…Í­Ì¹™¥±Ñ•È¡ĞôùĞ¹ÍÑ…ÑÕÌ„ôô…¹•±±•œ˜™Ğ¹‘Õ•}‘…Ñ”ğõÑ½‘…ä¤ì(€½¹ÍĞ½¹Q¥µ”õµ…ÑÕÉ•¹™¥±Ñ•È¡ĞôùĞ¹ÍÑ…ÑÕÌôôô½µÁ±•Ñ•œ˜™MÑÉ¥¹œ¡Ğ¹½µÁ±•Ñ•‘}…Ññğœœ¤¹Í±¥” À°ÄÀ¤ğõĞ¹‘Õ•}‘…Ñ”¤ì(€½¹ÍĞÉ…Ñ”õµ…ÑÕÉ•¹±•¹Ñ ı5…Ñ ¹É½Õ¹¡½¹Q¥µ”¹±•¹Ñ ½µ…ÑÕÉ•¹±•¹Ñ ¨ÄÀÀ¤èÀì(€½¹ÍĞÍÑ½É•Ìõl¸¸¹¹•ÜM•Ğ ¡•µÁ±½å••Íññmt¤¹µ…À¡”ôù”¹‰É…¹ ¤¹™¥±Ñ•È¡	½½±•…¸¤¥t¹Í½ÉĞ ¤ì(€½¹ÍĞ…Ñ•½ÉåQ½¹”õìŸ²‚s¶rÓ²æÓ®Npœè‰œµ‰±Õ”´ÔÀÑ•áĞµ‰±Õ”´ÜÀÀœ°Ÿ²"c®
§²²n@œè‰œµÙ¥½±•Ğ´ÔÀÑ•áĞµÙ¥½±•Ğ´ÜÀÀœ°Ÿ®ÎªÊôœè‰œµ…µ‰•È´ÔÀÑ•áĞµ…µ‰•È´ÜÀÀœ°Ÿ²ò²vÓ²*ƒ®Â<ƒªâÃ¶ œè‰œµÉ…ä´ÄÀÀÑ•áĞµÉ…ä´ØÀÀôì(€½¹ÍĞ…É‘AÉ½É•ÍÌô¡Ñ…Í¬¤ôùí½¹ÍĞµ•Ñ„õÑ…Í¬¹Ñ…Í­}µ•Ñ…ññíôí½¹ÍĞÍÑ…”õµ•Ñ„¹…É‘}ÍÑ…”ôôôÉ••¥Ù•‘}¹½Ñ}Ù¥Í¥Ñ•œüŸ²"c®‚äƒ²f®0œéµ•Ñ„¹…É‘}ÍÑ…”ôôô…ÁÁ±¥•‘}Õ¹É••¥Ù•œüŸ².ƒ²Ê´ƒ²f®0ƒ
Üƒ®¾ã²"c®‚äœèŸ².ƒ²Ê´ƒ²‚œí½¹ÍĞ…ÁÁÉ½Ù…°õµ•Ñ„¹…ÁÁÉ½Ù…±}É•ÅÕ¥É•ü¡µ•Ñ„¹…ÁÁÉ½Ù…±}½µÁ±•Ñ•üŸ²*ç²vàƒ²f®0œèŸ²*ç²vàƒ¶fW²vàƒ¶V²jPœ¤èŸ®Î®>ƒ²*ç²vàƒ²^²v0œí½¹ÍĞ…ÕÑ½Á…äõµ•Ñ„¹…ÕÑ½Á…å}É•¥ÍÑ•É•üŸ²zC®>g²vÓ²ÊĞƒ®NÇ®†tœèŸ²zC®>g²vÓ²ÊĞƒ®¾ã®NÇ®†tœíÉ•ÑÕÉ¸mµ•Ñ„¹…É‘}¹…µ”±ÍÑ…”±…ÁÁÉ½Ù…°±…ÕÑ½Á…åt¹™¥±Ñ•È¡	½½±•…¸¤¹©½¥¸ œƒ
Ü€œ¥ôì(€½¹ÍĞ‰…Í•¥±Ñ•É•õÍ½Á•¹™¥±Ñ•È¡Ğôùì(€€€½¹ÍĞ•µÀõ•µÁ±½å••5…ÁmĞ¹ÕÍ•É}¥‘t°ÕÍÑ½µ•ÈõÕÍÑ½µ•É5…ÁmĞ¹ÕÍÑ½µ•É}¥‘tì(€€€¥˜¡‰É…¹ „ôô…±°œ˜™•µÀü¹‰É…¹ „ôõ‰É…¹ ¥É•ÑÕÉ¸™…±Í”ì(€€€¥˜¡•µÁ±½å••%„ôô…±°œ˜™Ğ¹ÕÍ•É}¥„ôõ•µÁ±½å••%¥É•ÑÕÉ¸™…±Í”ì(€€€¥˜¡…Ñ•½Éä„ôô…±°œ˜™…É•Q…Í­…Ñ•½Éä¡Ğ¤„ôõ…Ñ•½Éä¥É•ÑÕÉ¸™…±Í”ì(€€€½¹ÍĞ¹••‘±”õÅÕ•Éä¹ÑÉ¥´ ¤¹Ñ½1½İ•É…Í” ¤ì(€€€¥˜¡¹••‘±”˜˜…€‘í•µÀü¹¹…µ•ñğœô€‘íÕÍÑ½µ•Èü¹ÕÍÑ½µ•É}¹…µ•ñğœô€‘íĞ¹Ñ¥Ñ±•ñğœô€‘íĞ¹¹½Ñ•ñğœô€‘íĞ¹Ñ…Í­}µ•Ñ„ü¹…É‘}¹…µ•ñğœõ€¹Ñ½1½İ•É…Í” ¤¹¥¹±Õ‘•Ì¡¹••‘±”¤¥É•ÑÕÉ¸™…±Í”ì(€€€¥˜¡™¥±Ñ•ÈôôôÑ½‘…äœ¥É•ÑÕÉ¸Ğ¹ÍÑ…ÑÕÌ„ôô½µÁ±•Ñ•œ˜™Ğ¹ÍÑ…ÑÕÌ„ôô…¹•±±•œ˜™Ğ¹‘Õ•}‘…Ñ”ôôõÑ½‘…äì(€€€¥˜¡™¥±Ñ•Èôôô½Ù•É‘Õ”œ¥É•ÑÕÉ¸Ğ¹ÍÑ…ÑÕÌ„ôô½µÁ±•Ñ•œ˜™Ğ¹ÍÑ…ÑÕÌ„ôô…¹•±±•œ˜™Ğ¹‘Õ•}‘…Ñ”ñÑ½‘…äì(€€€¥˜¡™¥±Ñ•ÈôôôÕÁ½µ¥¹œœ¥É•ÑÕÉ¸Ğ¹ÍÑ…ÑÕÌ„ôô½µÁ±•Ñ•œ˜™Ğ¹ÍÑ…ÑÕÌ„ôô…¹•±±•œ˜™Ğ¹‘Õ•}‘…Ñ”øõÑ½‘…äì(€€€¥˜¡™¥±Ñ•Èôôô‘½¹”œ¥É•ÑÕÉ¸Ğ¹ÍÑ…ÑÕÌôôô½µÁ±•Ñ•œ˜™Ğ¹‘Õ•}‘…Ñ”øõ€‘íÍ•±•Ñ•‘5½¹Ñ¡ô´ÀÅ€˜™Ğ¹‘Õ•}‘…Ñ”ñµ½¹Ñ¡9•áĞì(€€€¥˜¡™¥±Ñ•Èôôô…¹•±±•œ¥É•ÑÕÉ¸Ğ¹ÍÑ…ÑÕÌôôô…¹•±±•œ˜™Ğ¹‘Õ•}‘…Ñ”øõ€‘íÍ•±•Ñ•‘5½¹Ñ¡ô´ÀÅ€˜™Ğ¹‘Õ•}‘…Ñ”ñµ½¹Ñ¡9•áĞì(€€€É•ÑÕÉ¸Ğ¹ÍÑ…ÑÕÌ„ôô½µÁ±•Ñ•œ˜™Ğ¹ÍÑ…ÑÕÌ„ôô…¹•±±•œ˜™Ğ¹‘Õ•}‘…Ñ”ğõİ••¬ì(€ô¤ì(€½¹ÍĞÉ½ÕÁ•õmt±Á…åµ•¹ÑÉ½ÕÁÌõ¹•Ü5…À ¤ì(€½¹ÍĞÁ…åµ•¹ÑÉ½ÕÁ-•äô¡Ğ¤ôù€‘íĞ¹ÕÍ•É}¥‘ôè‘íĞ¹ÕÍÑ½µ•É}¥‘ôè‘íĞ¹Í½ÕÉ•}Í…±•}¥‘ññĞ¹‰…Í•}‘…Ñ•ñğ‘¥É•Ğõ€ì(€‰…Í•¥±Ñ•É•¹™½É… ¡Ğôùí¥˜¡MÑÉ¥¹œ¡Ğ¹Ñ…Í­}ÑåÁ•ñğœœ¤¹ÍÑ…ÉÑÍ]¥Ñ  Á…åµ•¹ĞÍ|œ¤¥Á…åµ•¹ÑÉ½ÕÁÌ¹Í•Ğ¡Á…åµ•¹ÑÉ½ÕÁ-•ä¡Ğ¤±ÑÉÕ”¤í•±Í”É½ÕÁ•¹ÁÕÍ ¡íÑ…Í¬éĞ±Ñ…Í­ÌémÑuô¥ô¤ì(€Á…åµ•¹ÑÉ½ÕÁÌ¹™½É…  ¡|±­•ä¤ôùí½¹ÍĞ½É‘•É•õÍ½Á•¹™¥±Ñ•È¡ĞôùMÑÉ¥¹œ¡Ğ¹Ñ…Í­}ÑåÁ•ñğœœ¤¹ÍÑ…ÉÑÍ]¥Ñ  Á…åµ•¹ĞÍ|œ¤˜™Á…åµ•¹ÑÉ½ÕÁ-•ä¡Ğ¤ôôõ­•ä¤¹Í½ÉĞ ¡„±ˆ¤ôùMÑÉ¥¹œ¡„¹‘Õ•}‘…Ñ”¤¹±½…±•½µÁ…É”¡MÑÉ¥¹œ¡ˆ¹‘Õ•}‘…Ñ”¤¤¤í½¹ÍĞµ…Ñ¡¥¹œõ½É‘•É•¹™¥±Ñ•È¡Ğôù‰…Í•¥±Ñ•É•¹Í½µ”¡àôùà¹¥ôôõĞ¹¥¤¤í½¹ÍĞ¹•áĞõ™¥±Ñ•Èôôô‘½¹”œıl¸¸¹µ…Ñ¡¥¹t¹É•Ù•ÉÍ” ¥lÁté™¥±Ñ•Èôôô…¹•±±•œıl¸¸¹µ…Ñ¡¥¹t¹É•Ù•ÉÍ” ¥lÁté½É‘•É•¹™¥¹¡ĞôùĞ¹ÍÑ…ÑÕÌ„ôô½µÁ±•Ñ•œ˜™Ğ¹ÍÑ…ÑÕÌ„ôô…¹•±±•œ¥ññ½É‘•É•‘m½É‘•É•¹±•¹Ñ ´Åtí¥˜¡¹•áĞ¥É½ÕÁ•¹ÁÕÍ ¡íÑ…Í¬é¹•áĞ±Ñ…Í­Ìé½É‘•É•±Á…åµ•¹ĞéÑÉÕ•ô¥ô¤ì(€½¹ÍĞ‘¥ÍÁ±…åI½İÌõÉ½ÕÁ•¹Í½ÉĞ ¡„±ˆ¤ôùMÑÉ¥¹œ¡„¹Ñ…Í¬¹‘Õ•}‘…Ñ•ñğœœ¤¹±½…±•½µÁ…É”¡MÑÉ¥¹œ¡ˆ¹Ñ…Í¬¹‘Õ•}‘…Ñ•ñğœœ¤¤¤ì(€½¹ÍĞÍ•…É¡9••‘±”õÅÕ•Éä¹ÑÉ¥´ ¤¹Ñ½1½İ•É…Í” ¤ì(€½¹ÍĞÕ¹¥™¥•‘ÕÍÑ½µ•ÉI½İÌõÍ•…É¡9••‘±”ıÕÍÑ½µ•ÉÌ¹µ…À¡ÕÍÑ½µ•Èôùì(€€€½¹ÍĞ•µÀõ•µÁ±½å••5…ÁmÕÍÑ½µ•È¹ÕÍ•É}¥‘tì(€€€¥˜ …•µÀ¥É•ÑÕÉ¸¹Õ±°ì(€€€¥˜¡‰É…¹ „ôô…±°œ˜™•µÀ¹‰É…¹ „ôõ‰É…¹ ¥É•ÑÕÉ¸¹Õ±°ì(€€€¥˜¡•µÁ±½å••%„ôô…±°œ˜™ÕÍÑ½µ•È¹ÕÍ•É}¥„ôõ•µÁ±½å••%¥É•ÑÕÉ¸¹Õ±°ì(€€€½¹ÍĞÕÍÑ½µ•ÉQ…Í­ÌõÍ½Á•¹™¥±Ñ•È¡Ñ…Í¬ôùÑ…Í¬¹ÕÍÑ½µ•É}¥ôôõÕÍÑ½µ•È¹¥¤ì(€€€½¹ÍĞÕÍÑ½µ•ÉM…±•ÌõÍ…±•Ì¹™¥±Ñ•È¡Í…±”ôùÍ…±”¹ÕÍÑ½µ•É}¥ôôõÕÍÑ½µ•È¹¥¤ì(€€€½¹ÍĞ¡…åÍÑ…¬õmÕÍÑ½µ•È¹ÕÍÑ½µ•É}¹…µ”±•µÀ¹¹…µ”±•µÀ¹‰É…¹ °¸¸¹ÕÍÑ½µ•ÉQ…Í­Ì¹™±…Ñ5…À¡Ñ…Í¬ôùmÑ…Í¬¹Ñ¥Ñ±”±Ñ…Í¬¹¹½Ñ”±Ñ…Í¬¹Ñ…Í­}µ•Ñ„ü¹…É‘}¹…µ•t¤°¸¸¹ÕÍÑ½µ•ÉM…±•Ì¹µ…À¡Í…±”ôùÍ…±”¹µ•ÑÉ¥}±…‰•°¥t¹™¥±Ñ•È¡	½½±•…¸¤¹©½¥¸ œ€œ¤¹Ñ½1½İ•É…Í” ¤ì(€€€¥˜ …¡…åÍÑ…¬¹¥¹±Õ‘•Ì¡Í•…É¡9••‘±”¤¥É•ÑÕÉ¸¹Õ±°ì(€€€É•ÑÕÉ¸íÕÍÑ½µ•È±•µÀ±Ñ…Í­ÌéÕÍÑ½µ•ÉQ…Í­Ì±Í…±•ÌéÕÍÑ½µ•ÉM…±•Ì±±…ÍÑM…±”éÕÍÑ½µ•ÉM…±•ÍlÁuôì(€ô¤¹™¥±Ñ•È¡	½½±•…¸¤¹Í½ÉĞ ¡„±ˆ¤ôùMÑÉ¥¹œ¡ˆ¹±…ÍÑM…±”ü¹Í…±•}‘…Ñ•ñğœœ¤¹±½…±•½µÁ…É”¡MÑÉ¥¹œ¡„¹±…ÍÑM…±”ü¹Í…±•}‘…Ñ•ñğœœ¤¤¤¹Í±¥” À°ÈÀ¤émtì((€¥˜¡±½…‘¥¹œ¥É•ÑÕÉ¸€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµİ¡¥Ñ”É½Õ¹‘•µá°‰½É‘•ÈÀ´ĞÑ•áĞµáÌÑ•áĞµÉ…ä´ĞÀÀˆûªÎƒªÂtƒ²V÷²4ƒ¶b¶f¤ƒ®Ú#®~³²b“®*Pƒ²’D¸¸¸ğ½‘¥Øøì(€¥˜¡±½…‘ÉÉ½È¥É•ÑÕÉ¸€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµİ¡¥Ñ”É½Õ¹‘•µá°‰½É‘•È‰½É‘•ÈµÉ•´ÄÀÀÀ´Ğˆøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´™½¹Ğµ‰½±Ñ•áĞµÉ•´ÔÀÀˆûªÎƒªÂtƒ²V÷²7²vƒ®Ú#®~³²b“² ƒ®ªï¶Z#²ZÓ²jP¸ğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ•´ĞÀÀµĞ´Äˆùí±½…‘ÉÉ½Éôğ½‘¥Øøğ½‘¥Øøì(€É•ÑÕÉ¸€ñ‘¥Ø±…ÍÍ9…µ”ô‰ÍÁ…”µä´Ìˆø(€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É¥É¥µ½±Ì´ÌÍ´éÉ¥µ½±Ì´Ô…À´Èˆø(€€€€€ímlŸ²b“®*`œ±Ñ½‘…åQ…Í­Ì¹±•¹Ñ¡t±lœß²vğƒ®
Ğœ±¹•áĞÜ¹±•¹Ñ¡t±lŸªâÃ¶Vs²Ò#ªÎğœ±½Ù•É‘Õ”¹±•¹Ñ¡t±lŸªâÃ¶Vpƒ®
Ğƒ²f®0œ±€‘íÉ…Ñ•ô•t±lŸªÎƒªÂtƒªÆÃ²‚ œ±Í•±•Ñ•‘5½¹Ñ¡Q…Í­Ì¹™¥±Ñ•È¡ĞôùĞ¹ÍÑ…ÑÕÌôôô…¹•±±•œ¤¹±•¹Ñ¡ut¹µ…À ¡m°±Ùt¤ôø(€€€€€€€€ñ‘¥Ø­•äõí±ô±…ÍÍ9…µ”ô‰‰œµİ¡¥Ñ”É½Õ¹‘•µá°‰½É‘•È‰½É‘•ÈµÉ…ä´ÄÀÀÀ´ÌÑ•áĞµ•¹Ñ•Èˆøñ‘¥Ø±…ÍÍ9…µ”õíÑ•áĞµ±œ™½¹Ğµ‰½±€‘í°ôôôŸªâÃ¶Vs²Ò#ªÎğœ˜™9Õµ‰•È¡Ø¤øÀüÑ•áĞµÉ•´ØÀÀœèÑ•áĞµÉ…ä´äÀÀõôùíÙôğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀˆùí±ôğ½‘¥Øøğ½‘¥Øø¥ô(€€€€ğ½‘¥Øø(€€€í½µÁ…Ğüñ‰ÕÑÑ½¸½¹±¥¬õí½¹=Á•¹ô±…ÍÍ9…µ”ô‰Üµ™Õ±°‰œµİ¡¥Ñ”É½Õ¹‘•µá°‰½É‘•È‰½É‘•ÈµÉ…ä´ÄÀÀÀ´Ğ™±•à©ÕÍÑ¥™äµ‰•Ñİ••¸Ñ•áĞµ±•™Ğˆøñ‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´™½¹Ğµ‰½±ˆûªÎƒªÂtƒ²V÷²4ƒªÒ®š°ğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ…ä´ĞÀÀµĞ´Äˆû²²nC®Îƒ²¶Z'®.£ªÎ²f ƒªâÃ¶Vs²Ò#ªÎğƒ®
Ó²^·²vƒ¶fW²vã¶VÓ²jP¸ğ½‘¥Øøğ½‘¥ØøñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÙ¥½±•Ğ´ØÀÀˆû²²àƒŠèğ½ÍÁ…¸øğ½‰ÕÑÑ½¸øèğø(€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµİ¡¥Ñ”É½Õ¹‘•µá°‰½É‘•È‰½É‘•ÈµÉ…ä´ÄÀÀÀ´ÌÍÁ…”µä´Èˆø(€€€€€€ñ‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌ™½¹Ğµ‰½±Ñ•áĞµÉ…ä´àÀÀˆûªÎƒªÂtƒ¶×¶V§ªÊ²$ğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´À¸ÔÑ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀˆû¶2C®ƒ²vÓ®‚—ªÎğƒ²V÷²7²vƒ¶Vpƒ®Ê#²^@ƒ²Âû²V²jP¸ğ½‘¥Øøğ½‘¥Øø(€€€€€€ñ¥¹ÁÕĞÙ…±Õ”õíÅÕ•Éåô½¹¡…¹”õí”ôùÍ•ÑEÕ•Éä¡”¹Ñ…É•Ğ¹Ù…±Õ”¥ôÁ±…•¡½±‘•Èô‹ªÎƒªÂw®ª
ß²²nC®ª
ß¶2C®ƒ¶V·®ª§
ß²V÷²7
ß²æÓ®Ns²
°ƒªÊ²$ˆ±…ÍÍ9…µ”ô‰Üµ™Õ±°‰½É‘•È‰½É‘•ÈµÉ…ä´ÈÀÀÉ½Õ¹‘•µá°Áà´ÌÁä´È¸ÔÑ•áĞµÍ´ˆ¼ø(€€€€€íÍ•…É¡9••‘±”˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰É½Õ¹‘•µá°‰½É‘•È‰½É‘•ÈµÙ¥½±•Ğ´ÄÀÀ‰œµÙ¥½±•Ğ´ÔÀ¼ÔÀ½Ù•É™±½Üµ¡¥‘‘•¸ˆø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•Ñİ••¸Áà´ÌÁä´È‰½É‘•Èµˆ‰½É‘•ÈµÙ¥½±•Ğ´ÄÀÀˆøñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁát™½¹Ğµ‰½±Ñ•áĞµÙ¥½±•Ğ´ÜÀÀˆû¶×¶V¤ƒªÎƒªÂtƒªÊ²$ƒªÊÃªÎğğ½ÍÁ…¸øñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÙ¥½±•Ğ´ÔÀÀˆùíÕ¹¥™¥•‘ÕÍÑ½µ•ÉI½İÌ¹±•¹Ñ¡÷®ªğ½ÍÁ…¸øğ½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µ…àµ ´ÔØ½Ù•É™±½Üµäµ…ÕÑ¼‘¥Ù¥‘”µä‘¥Ù¥‘”µÙ¥½±•Ğ´ÄÀÀˆùíÕ¹¥™¥•‘ÕÍÑ½µ•ÉI½İÌ¹µ…À ¡íÕÍÑ½µ•È±•µÀ±Ñ…Í­ÌéÕÍÑ½µ•ÉQ…Í­Ì±Í…±•ÌéÕÍÑ½µ•ÉM…±•Ì±±…ÍÑM…±•ô¤ôøñ‰ÕÑÑ½¸­•äõíÕÍÑ½µ•È¹¥‘ôÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùíÍ•ÑEÕ•Éä¡ÕÍÑ½µ•È¹ÕÍÑ½µ•É}¹…µ”¤íÍ•Ñ	É…¹ ¡•µÀ¹‰É…¹¡ñğ…±°œ¤íÍ•ÑµÁ±½å••%¡•µÀ¹¥¥õô±…ÍÍ9…µ”ô‰Üµ™Õ±°‰œµİ¡¥Ñ”¼àÀÁà´ÌÁä´È¸ÔÑ•áĞµ±•™Ğ¡½Ù•Èé‰œµİ¡¥Ñ”ˆøñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµÍÑ…ÉĞ©ÕÍÑ¥™äµ‰•Ñİ••¸…À´Ìˆøñ‘¥Ø±…ÍÍ9…µ”ô‰µ¥¸µÜ´Àˆøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌ™½¹Ğµ‰½±Ñ•áĞµÉ…ä´äÀÀÑÉÕ¹…Ñ”ˆùíÕÍÑ½µ•È¹ÕÍÑ½µ•É}¹…µ•ôƒ
Üí•µÀ¹¹…µ•ôğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´À¸ÔÑ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀÑÉÕ¹…Ñ”ˆùí‘¥ÍÁ±…åMÑ½É•9…µ”¡•µÀ¹‰É…¹ ¥õí±…ÍÑM…±”ı€ƒ
Üƒ²ÖsªŞğ€‘í±…ÍÑM…±”¹Í…±•}‘…Ñ•ô€‘í±…ÍÑM…±”¹µ•ÑÉ¥}±…‰•±ñğŸ¶2C®õ€èœôğ½‘¥Øøğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Í¡É¥¹¬´ÀÑ•áĞµlÄÁÁát™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÙ¥½±•Ğ´ØÀÀˆû¶2C®íÕÍÑ½µ•ÉM…±•Ì¹±•¹Ñ¡ôƒ
Üƒ²V÷²4íÕÍÑ½µ•ÉQ…Í­Ì¹±•¹Ñ¡ôğ½‘¥Øøğ½‘¥Øøğ½‰ÕÑÑ½¸ø¥õíÕ¹¥™¥•‘ÕÍÑ½µ•ÉI½İÌ¹±•¹Ñ ôôôÀ˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰Áà´ÌÁä´ÔÑ•áĞµ•¹Ñ•ÈÑ•áĞµáÌÑ•áĞµÉ…ä´ĞÀÀˆû¶2C®ƒ²vÓ®‚—ªÎğƒ²V÷²7²^C²pƒ²vó²æc¶Vc®*PƒªÎƒªÂw²vĞƒ²^²ZÓ²jP¸ğ½‘¥Øùôğ½‘¥Øø(€€€€€€ğ½‘¥Øùô(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É¥É¥µ½±Ì´ÈÍ´éÉ¥µ½±Ì´Ğ…À´Èˆø(€€€€€€€€ñÍ•±•ĞÙ…±Õ”õí‰É…¹¡ô½¹¡…¹”õí”ôùíÍ•Ñ	É…¹ ¡”¹Ñ…É•Ğ¹Ù…±Õ”¤íÍ•ÑµÁ±½å••% …±°œ¥õô±…ÍÍ9…µ”ô‰‰½É‘•ÈÉ½Õ¹‘•µ±œÁà´È¸ÔÁä´ÈÑ•áĞµáÌˆøñ½ÁÑ¥½¸Ù…±Õ”ô‰…±°ˆû²‚²ÊĞƒ®“²z”ğ½½ÁÑ¥½¸ùíÍÑ½É•Ì¹µ…À¡àôøñ½ÁÑ¥½¸­•äõíáôÙ…±Õ”õíáôùí‘¥ÍÁ±…åMÑ½É•9…µ”¡à¥ôğ½½ÁÑ¥½¸ø¥ôğ½Í•±•Ğø(€€€€€€€€ñÍ•±•ĞÙ…±Õ”õí•µÁ±½å••%‘ô½¹¡…¹”õí”ôùÍ•ÑµÁ±½å••%¡”¹Ñ…É•Ğ¹Ù…±Õ”¥ô±…ÍÍ9…µ”ô‰‰½É‘•ÈÉ½Õ¹‘•µ±œÁà´È¸ÔÁä´ÈÑ•áĞµáÌˆøñ½ÁÑ¥½¸Ù…±Õ”ô‰…±°ˆû²‚²ÊĞƒ²²n@ğ½½ÁÑ¥½¸ùì¡•µÁ±½å••Íññmt¤¹™¥±Ñ•È¡”ôù‰É…¹ ôôô…±°ññ”¹‰É…¹ ôôõ‰É…¹ ¤¹µ…À¡”ôøñ½ÁÑ¥½¸­•äõí”¹¥‘ôÙ…±Õ”õí”¹¥‘ôùí”¹¹…µ•ôğ½½ÁÑ¥½¸ø¥ôğ½Í•±•Ğø(€€€€€€€€ñÍ•±•ĞÙ…±Õ”õí…Ñ•½Éåô½¹¡…¹”õí”ôùÍ•Ñ…Ñ•½Éä¡”¹Ñ…É•Ğ¹Ù…±Õ”¥ô±…ÍÍ9…µ”ô‰‰½É‘•ÈÉ½Õ¹‘•µ±œÁà´È¸ÔÁä´ÈÑ•áĞµáÌˆøñ½ÁÑ¥½¸Ù…±Õ”ô‰…±°ˆû²‚²ÊĞƒ²æÓ¶3ªÎƒ®š°ğ½½ÁÑ¥½¸ùílŸ²‚s¶rÓ²æÓ®Npœ°Ÿ²"c®
§²²n@œ°Ÿ®ÎªÊôœ°Ÿ²ò²vÓ²*ƒ®Â<ƒªâÃ¶ t¹µ…À¡àôøñ½ÁÑ¥½¸­•äõíáôÙ…±Õ”õíáôùíáôğ½½ÁÑ¥½¸ø¥ôğ½Í•±•Ğø(€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤ôùíÍ•ÑEÕ•Éä œœ¤íÍ•Ñ	É…¹  …±°œ¤íÍ•ÑµÁ±½å••% …±°œ¤íÍ•Ñ…Ñ•½Éä …±°œ¤íÍ•Ñ¥±Ñ•È Ñ½‘¼œ¥õô±…ÍÍ9…µ”ô‰É½Õ¹‘•µ±œ‰œµÉ…ä´ÔÀÑ•áĞµÉ…ä´ÔÀÀÑ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±ˆû¶V¶Àƒ²Ò#ªâÃ¶fPğ½‰ÕÑÑ½¸ø(€€€€€€ğ½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É¥É¥µ½±Ì´ÌÍ´éÉ¥µ½±Ì´Ø…À´ÄˆùímlÑ½‘¼œ°Ÿ¶V€ƒ²vğt±lÑ½‘…äœ°Ÿ²b“®*`t±l½Ù•É‘Õ”œ°ŸªÊ÷ªÎğt±lÕÁ½µ¥¹œœ°Ÿ²‚²ÊĞƒ²b#²‚Tt±l‘½¹”œ°Ÿ²f®0t±l…¹•±±•œ°ŸªÎƒªÂtƒªÆÃ²‚ ut¹µ…À ¡m­•ä±±…‰•±t¤ôøñ‰ÕÑÑ½¸­•äõí­•åô½¹±¥¬õì ¤ôùÍ•Ñ¥±Ñ•È¡­•ä¥ô±…ÍÍ9…µ”õíÁä´ÈÉ½Õ¹‘•µ±œÑ•áĞµlÄÁÁát™½¹ĞµÍ•µ¥‰½±€‘í™¥±Ñ•Èôôõ­•äü‰œµÙ¥½±•Ğ´ØÀÀÑ•áĞµİ¡¥Ñ”œè‰œµÉ…ä´ÔÀÑ•áĞµÉ…ä´ÔÀÀõôùí±…‰•±ôğ½‰ÕÑÑ½¸ø¥ôğ½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀˆû²f®3
ßªÎƒªÂtƒªÆÃ²‚#²v íµ½¹Ñ¡1…‰•°¡Í•±•Ñ•‘5½¹Ñ ¥ôƒªâÃ²’²vÓ®¦À°ƒ²¶Z$ƒ²’Dƒ²V÷²7²v ƒ²nSªÎğƒªÒªÎ²^²vĞƒ®O²æc² ƒ²V+®>®†tƒ¶Fs².s¶VÓ²jP¸ğ½‘¥Øø(€€€€ğ½‘¥Øø(€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµİ¡¥Ñ”É½Õ¹‘•µá°‰½É‘•È‰½É‘•ÈµÉ…ä´ÄÀÀ½Ù•É™±½Üµ¡¥‘‘•¸ˆø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Áà´ĞÁä´Ì‰½É‘•Èµˆ™±•à©ÕÍÑ¥™äµ‰•Ñİ••¸…À´Ìˆøñ‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´™½¹Ğµ‰½±ˆûªÎƒªÂtƒ²V÷²4ƒ²²àğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ…ä´ĞÀÀˆûªÒ®š°ƒ®ÊS²r²v`ƒ²²nCªÎğƒªÎƒªÂtƒ²¶Z'²¶s®–ğƒ¶V£ªî`ƒ¶fW²vã¶VÓ²jP¸ğ½‘¥Øøğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌ™½¹Ğµ‰½±Ñ•áĞµÙ¥½±•Ğ´ØÀÀˆùí‘¥ÍÁ±…åI½İÌ¹±•¹Ñ¡÷ªÆĞğ½‘¥Øøğ½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‘¥Ù¥‘”µäˆø(€€€€€€€í‘¥ÍÁ±…åI½İÌ¹µ…À ¡íÑ…Í¬éĞ±Ñ…Í­ÌéÉ½ÕÁQ…Í­Ì±Á…åµ•¹Ñô¤ôùì(€€€€€€€€€½¹ÍĞ•µÀõ•µÁ±½å••5…ÁmĞ¹ÕÍ•É}¥‘t°ÕÍÑ½µ•ÈõÕÍÑ½µ•É5…ÁmĞ¹ÕÍÑ½µ•É}¥‘tì(€€€€€€€€€½¹ÍĞÑ…Í­…Ñ•½Éäõ…É•Q…Í­…Ñ•½Éä¡Ğ¤±½µÁ±•Ñ•‘½Õ¹ĞõÉ½ÕÁQ…Í­Ì¹™¥±Ñ•È¡àôùà¹ÍÑ…ÑÕÌôôô½µÁ±•Ñ•œ¤¹±•¹Ñ ì(€€€€€€€€€½¹ÍĞÍÑ…ÑÕÍ1…‰•°õĞ¹ÍÑ…ÑÕÌôôô½µÁ±•Ñ•œüŸ²f®0œéĞ¹ÍÑ…ÑÕÌôôô…¹•±±•œüŸªÎƒªÂtƒªÆÃ²‚ œéĞ¹‘Õ•}‘…Ñ”ñÑ½‘…äı€‘í5…Ñ ¹É½Õ¹ ¡¹•Ü…Ñ”¡€‘íÑ½‘…åõPÀÀèÀÀèÀÁ€¤µ¹•Ü…Ñ”¡€‘íĞ¹‘Õ•}‘…Ñ•õPÀÀèÀÀèÀÁ€¤¤¼àØĞÀÀÀÀÀ¥÷²vğƒ²Ò#ªÎñ€éĞ¹‘Õ•}‘…Ñ”ôôõÑ½‘…äüŸ²b“®*`œé´‘í5…Ñ ¹É½Õ¹ ¡¹•Ü…Ñ”¡€‘íĞ¹‘Õ•}‘…Ñ•õPÀÀèÀÀèÀÁ€¤µ¹•Ü…Ñ”¡€‘íÑ½‘…åõPÀÀèÀÀèÀÁ€¤¤¼àØĞÀÀÀÀÀ¥õ€ì(€€€€€€€€€É•ÑÕÉ¸€ñ‘¥Ø­•äõíÁ…åµ•¹Ğı€‘íĞ¹ÕÍ•É}¥‘ô´‘íĞ¹ÕÍÑ½µ•É}¥‘ô´‘íĞ¹Í½ÕÉ•}Í…±•}¥‘ññĞ¹‰…Í•}‘…Ñ•õ€éĞ¹¥‘ô±…ÍÍ9…µ”ô‰Áà´ĞÁä´ÌÑ•áĞµáÌˆøñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à©ÕÍÑ¥™äµ‰•Ñİ••¸…À´Ìˆø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µ¥¸µÜ´Àˆø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È…À´Ä¸Ô™±•àµİÉ…ÀˆøñÍÁ…¸±…ÍÍ9…µ”õíÑ•áĞµlåÁát™½¹Ğµ‰½±Áà´Ä¸ÔÁä´À¸ÔÉ½Õ¹‘•µ™Õ±°€‘í…Ñ•½ÉåQ½¹•mÑ…Í­…Ñ•½ÉåuõôùíÑ…Í­…Ñ•½Éåôğ½ÍÁ…¸øñˆ±…ÍÍ9…µ”ô‰Ñ•áĞµÉ…ä´àÀÀˆùí•µÀü¹¹…µ•ñğŸ²²n@ôƒ
ÜíÕÍÑ½µ•Èü¹ÕÍÑ½µ•É}¹…µ•ñğŸªÎƒªÂtôğ½ˆøğ½‘¥Øø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀµĞ´Äˆùí‘¥ÍÁ±…åMÑ½É•9…µ”¡•µÀü¹‰É…¹ ¥ôğ½‘¥Øø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÉ…ä´ØÀÀµĞ´ÄˆùíÁ…åµ•¹Ğı€‘íÉ½ÕÁQ…Í­Ì¹±•¹Ñ¡÷ªÂs²nPƒ²jSªâ ƒ²"c®
§²²n@ƒ
Ü€‘í½µÁ±•Ñ•‘½Õ¹Ñô¼‘íÉ½ÕÁQ…Í­Ì¹±•¹Ñ¡÷¶j0ƒ²f®1€éĞ¹Ñ¥Ñ±•ôğ½‘¥Øø(€€€€€€€€€€€€€íÁ…åµ•¹Ğ˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÙ¥½±•Ğ´ÜÀÀµĞ´Äˆû®.“²v0ƒ²"c®
¤ƒ
ÜíĞ¹‘Õ•}‘…Ñ•ôğ½‘¥Øùô(€€€€€€€€€€€€€íĞ¹Ñ…Í­}ÑåÁ”ôôô…™™¥±¥…Ñ•…Éœ˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµ‰±Õ”´ÜÀÀµĞ´Ä±•…‘¥¹œµÉ•±…á•ˆùí…É‘AÉ½É•ÍÌ¡Ğ¥ôğ½‘¥Øùô(€€€€€€€€€€€€€íĞ¹Ñ…É•Ñ}Á±…¸˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÙ¥½±•Ğ´ÜÀÀµĞ´Äˆû®ÎªÊôƒ²b#²‚Tƒ
ÜíĞ¹Ñ…É•Ñ}Á±…¹ôğ½‘¥Øùô(€€€€€€€€€€€€€íĞ¹¹½Ñ”˜˜…Á…åµ•¹Ğ˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÉ…ä´ĞÀÀµĞ´ÄˆùíĞ¹¹½Ñ•ôğ½‘¥Øùô(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Í¡É¥¹¬´ÀÑ•áĞµÉ¥¡Ğˆøñ‘¥Ø±…ÍÍ9…µ”õí™½¹ĞµÍ•µ¥‰½±€‘íĞ¹ÍÑ…ÑÕÌôôô…¹•±±•œüÑ•áĞµÉ…ä´ÔÀÀœéĞ¹ÍÑ…ÑÕÌôôô½µÁ±•Ñ•œüÑ•áĞµ•µ•É…±´ØÀÀœéĞ¹‘Õ•}‘…Ñ”ñÑ½‘…äüÑ•áĞµÉ•´ÔÀÀœéĞ¹‘Õ•}‘…Ñ”ôôõÑ½‘…äüÑ•áĞµ½É…¹”´ÔÀÀœèÑ•áĞµÙ¥½±•Ğ´ØÀÀõôùíÍÑ…ÑÕÍ1…‰•±ôğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀµĞ´ÄˆùíĞ¹‘Õ•}‘…Ñ•ôğ½‘¥Øøğ½‘¥Øø(€€€€€€€€€€ğ½‘¥Øøğ½‘¥Øø(€€€€€€€ô¥ô(€€€€€€€í‘¥ÍÁ±…åI½İÌ¹±•¹Ñ ôôôÀ˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰Áä´àÑ•áĞµ•¹Ñ•ÈÑ•áĞµáÌÑ•áĞµÉ…ä´ĞÀÀˆû²†ÃªÆÓ²^@ƒ¶VÓ®.ç¶Vc®*PƒªÎƒªÂtƒ²V÷²7²vĞƒ²^²ZÓ²jP¸ğ½‘¥Øùô(€€€€€€ğ½‘¥Øø(€€€€ğ½‘¥Øø(€€€€ğ¼ùô(€€ğ½‘¥Øøì)ô()™Õ¹Ñ¥½¸‘µ¥¹5…¹…•µ•¹Ñ±•ÉÑÌ¡ìÁ•¹‘¥¹½Õ¹Ğ°•µÁ±½å••Ì°½¹¼°µ½¹Ñ °É½İÌ°‘…¥±åI•½É‘Ì°¥ÍÕ±±‘µ¥¸°½¹™¥œ°…¹Y¥•İMÁ½Ñ‘µ¥¸õ™…±Í”ô¤ì(€½¹ÍĞm½Õ¹ÑÌ±Í•Ñ½Õ¹ÑÍtõÕÍ•MÑ…Ñ”¡íÕÍÑ½µ•ÈèÀ±¡½µ”èÀ±ÍÁ½ĞèÀ±ÁÉ½™¥±”èÀ±Í•ÑÑ±•µ•¹ĞèÀ±¡Å¥™˜èÀ±½…±I¥Í¬èÀ±ÁÕÍ¡5¥ÍÍ¥¹œèÀ±ÁÕÍ¡…¥±•èÀ±ÁÕÍ¡M•¹ĞèÁô¤ì(€ÕÍ•™™•Ğ  ¤ôùì(€€€€¡…Íå¹Œ ¤ôùì(€€€€€½¹ÍĞÑ½‘…äõ¹•Ü…Ñ” ¤¹Ñ½%M=MÑÉ¥¹œ ¤¹Í±¥” À°ÄÀ¤ì(€€€€€½¹ÍĞ¥‘Ìô¡•µÁ±½å••Íññmt¤¹µ…À¡”ôù”¹¥¤ì(€€€€€¥˜ …¥‘Ì¹±•¹Ñ ¥É•ÑÕÉ¸ì(€€€€€½¹ÍĞÍ½Á•‘	É…¹¡•Ìõl¸¸¹¹•ÜM•Ğ ¡•µÁ±½å••Íññmt¤¹µ…À¡•µÁ±½å•”ôù•µÁ±½å•”¹‰É…¹ ¤¹™¥±Ñ•È¡‰É…¹ ôù‰É…¹ ˜˜…9=9}M1M}MQ=IL¹¥¹±Õ‘•Ì¡‰É…¹ ¤¤¥tì(€€€€€½¹ÍĞmí‘…Ñ„éÑô±í‘…Ñ„é¡ô±í‘…Ñ„éÍô±í‘…Ñ„éÁô±í‘…Ñ„éÍÉô±í‘…Ñ„é¡Åô±í‘…Ñ„é½…±Íô±í‘…Ñ„éÁÕÍ¡I½İÍõtõ…İ…¥ĞAÉ½µ¥Í”¹…±°¡l(€€€€€€€ÍÕÁ…‰…Í”¹™É½´ ÕÍÑ½µ•É}Ñ…Í­Ìœ¤¹Í•±•Ğ ¥œ¤¹¥¸ ÕÍ•É}¥œ±¥‘Ì¤¹•Ä ÍÑ…ÑÕÌœ°Á•¹‘¥¹œœ¤¹±Ğ ‘Õ•}‘…Ñ”œ±Ñ½‘…ä¤°(€€€€€€€ÍÕÁ…‰…Í”¹™É½´ ¡½µ•}½É‘•ÉÌœ¤¹Í•±•Ğ ¥œ¤¹¥¸ ÕÍ•É}¥œ±¥‘Ì¤¹•Ä ÍÑ…ÑÕÌœ°Á•¹‘¥¹œœ¤¹±Ğ Á±…¹¹•‘}¥¹ÍÑ…±±}‘…Ñ”œ±Ñ½‘…ä¤°(€€€€€€€ÍÕÁ…‰…Í”¹™É½´ ÍÁ½Ñ}±…¥µÌœ¤¹Í•±•Ğ ¥œ¤¹¥¸ ÕÍ•É}¥œ±¥‘Ì¤¹•Ä ÍÑ…ÑÕÌœ°Á•¹‘¥¹œœ¤°(€€€€€€€ÍÕÁ…‰…Í”¹™É½´ ÁÉ½™¥±•}•‘¥Ñ}É•ÅÕ•ÍÑÌœ¤¹Í•±•Ğ ¥œ¤¹¥¸ ÕÍ•É}¥œ±¥‘Ì¤¹•Ä ÍÑ…ÑÕÌœ°Á•¹‘¥¹œœ¤°(€€€€€€€ÍÕÁ…‰…Í”¹™É½´ Í•ÑÑ±•µ•¹Ñ}É•Ù¥•İÌœ¤¹Í•±•Ğ ÕÍ•É}¥±ÍÑ…ÑÕÌœ¤¹•Ä µ½¹Ñ œ±µ½¹Ñ ¤¹¥¸ ÕÍ•É}¥œ±¥‘Ì¤°(€€€€€€€ÍÕÁ…‰…Í”¹™É½´ ¡•…‘}½™™¥•}Á•É™½Éµ…¹”œ¤¹Í•±•Ğ ÕÍ•É}¥±µ•ÑÉ¥Ìœ¤¹•Ä µ½¹Ñ œ±µ½¹Ñ ¤¹¥¸ ÕÍ•É}¥œ±¥‘Ì¤°(€€€€€€€ÍÕÁ…‰…Í”¹™É½´ ÍÑ½É•}½…±Ìœ¤¹Í•±•Ğ ÍÑ½É•}¹…µ”±½µÁ…¹å}½…±Ì±¡…±±•¹•}½…±Ìœ¤¹•Ä µ½¹Ñ œ±µ½¹Ñ ¤¹¥¸ ÍÑ½É•}¹…µ”œ±Í½Á•‘	É…¹¡•Ì¤°(€€€€€€€ÍÕÁ…‰…Í”¹ÉÁŒ •Ñ}ÁÕÍ¡}‘•±¥Ù•Éå}½Ù•ÉÙ¥•Üœ¤(€€€€€t¤ì(€€€€€½¹ÍĞÉ•Ù¥•İ•õ¹•ÜM•Ğ ¡ÍÉññmt¤¹™¥±Ñ•È¡àôùà¹ÍÑ…ÑÕÌôôô¡•­•ññà¹ÍÑ…ÑÕÌôôô™¥¹…°œ¤¹µ…À¡àôùà¹ÕÍ•É}¥¤¤ì(€€€€€½¹ÍĞÉ½İ5…Àõ=‰©•Ğ¹™É½µ¹ÑÉ¥•Ì ¡É½İÍññmt¤¹µ…À¡àôùmà¹¥±át¤¤ì(€€€€€½¹ÍĞ¡Å¥™˜ô¡¡Åññmt¤¹™¥±Ñ•È¡àôùí½¹ÍĞÈõÉ½İ5…Ámà¹ÕÍ•É}¥‘t±´õà¹µ•ÑÉ¥ÍññíôíÉ•ÑÕÉ¸È˜˜¡9Õµ‰•È¡¡•…‘=™™¥•M½É•Ì¡¹½Éµ…±¥é•!•…‘=™™¥•5•ÑÉ¥Ì¡´¤±½¹™¥œ±µ½¹Ñ ¤ü¹¡ÍñğÀ¤„ôõ9Õµ‰•È¡¡Í½Õ¹Ğ¡È¹‘É…™Ğ¥ñğÀ¤¥ô¤¹±•¹Ñ ì(€€€€€½¹ÍĞ™½É•…ÍÑ…Ñ½Èõµ½¹Ñ¡-•å=˜¡¹•Ü…Ñ” ¤¤ôôõµ½¹Ñ ı‘…åÍ%¹5½¹Ñ ¡µ½¹Ñ ¤½5…Ñ ¹µ…à Ä±¹•Ü…Ñ” ¤¹•Ñ…Ñ” ¤¤èÄì(€€€€€½¹ÍĞ½…±I¥Í¬ô¡½…±Íññmt¤¹™¥±Ñ•È¡½…°ôùì(€€€€€€€½¹ÍĞÑ…É•Ğõ9Õµ‰•È ¡ì¸¸¸¡½…°¹½µÁ…¹å}½…±Íññíô¤°¸¸¸¡½…°¹¡…±±•¹•}½…±Íññíô¥ô¤¹¡ÍñğÀ¤ì(€€€€€€€¥˜¡Ñ…É•ĞğôÀ¥É•ÑÕÉ¸™…±Í”ì(€€€€€€€½¹ÍĞ…ÑÕ…°ô¡É½İÍññmt¤¹™¥±Ñ•È¡É½ÜôùÉ½Ü¹‰É…¹ ôôõ½…°¹ÍÑ½É•}¹…µ”¤¹É•‘Õ” ¡ÍÕ´±É½Ü¤ôùÍÕ´­¡Í½Õ¹Ğ¡É½Ü¹‘É…™Ğ¤°À¤ì(€€€€€€€É•ÑÕÉ¸…ÑÕ…°©™½É•…ÍÑ…Ñ½ÈñÑ…É•Ğì(€€€€€ô¤¹±•¹Ñ ì(€€€€€½¹ÍĞÍ½Á•‘AÕÍ ô¡ÁÕÍ¡I½İÍññmt¤¹™¥±Ñ•È¡ÁÕÍ ôù¥‘Ì¹¥¹±Õ‘•Ì¡ÁÕÍ ¹ÕÍ•É}¥¤¤ì(€€€€€½¹ÍĞÁÕÍ¡5¥ÍÍ¥¹œõÍ½Á•‘AÕÍ ¹™¥±Ñ•È¡ÁÕÍ ôø…ÁÕÍ ¹¡…Í}…Ñ¥Ù•}ÍÕ‰ÍÉ¥ÁÑ¥½¸¤¹±•¹Ñ ì(€€€€€½¹ÍĞÁÕÍ¡…¥±•õÍ½Á•‘AÕÍ ¹™¥±Ñ•È¡ÁÕÍ ôùÁÕÍ ¹±…ÍÑ}‘•±¥Ù•Éå}ÍÑ…ÑÕÌôôô™…¥±•œ¤¹±•¹Ñ ì(€€€€€½¹ÍĞÁÕÍ¡M•¹ĞõÍ½Á•‘AÕÍ ¹™¥±Ñ•È¡ÁÕÍ ôùÁÕÍ ¹±…ÍÑ}‘•±¥Ù•Éå}ÍÑ…ÑÕÌôôôÍ•¹Ğœ¤¹±•¹Ñ ì(€€€€€Í•Ñ½Õ¹ÑÌ¡íÕÍÑ½µ•Èè¡Ñññmt¤¹±•¹Ñ ±¡½µ”è¡¡ññmt¤¹±•¹Ñ ±ÍÁ½Ğè¡Íññmt¤¹±•¹Ñ ±ÁÉ½™¥±”è¡Áññmt¤¹±•¹Ñ ±Í•ÑÑ±•µ•¹Ğé5…Ñ ¹µ…à À±¥‘Ì¹±•¹Ñ µÉ•Ù¥•İ•¹Í¥é”¤±¡Å¥™˜±½…±I¥Í¬±ÁÕÍ¡5¥ÍÍ¥¹œ±ÁÕÍ¡…¥±•±ÁÕÍ¡M•¹Ñô¤ì(€€€ô¤ ¤ì(€ô±m•µÁ±½å••Ì±µ½¹Ñ ±É½İÌ±½¹™¥t¤ì(€½¹ÍĞ¹½Üõ¹•Ü…Ñ” ¤±Ñ½‘…å-•äõMÑÉ¥¹œ¡¹½Ü¹•Ñ…Ñ” ¤¤¹Á…‘MÑ…ÉĞ È°œÀœ¤ì(€½¹ÍĞµ¥ÍÍ¥¹œõµ½¹Ñ¡-•å=˜¡¹½Ü¤ôôõµ½¹Ñ ü¡•µÁ±½å••Íññmt¤¹™¥±Ñ•È¡”ôùí½¹ÍĞõ¹½Éµ…±¥é•…ä¡‘…¥±åI•½É‘Ìü¹m”¹¥‘tü¹mÑ½‘…å-•åt¤íÉ•ÑÕÉ¸€…¹‘…å=™˜˜˜…‘…å!…Í…Ñ„¡¥ô¤¹±•¹Ñ èÀì(€½¹ÍĞÑ½Ñ…°õlÕÍÑ½µ•Èœ°¡½µ”œ°ÍÁ½Ğœ°ÁÉ½™¥±”œ°Í•ÑÑ±•µ•¹Ğœ°¡Å¥™˜œ°½…±I¥Í¬œ°ÁÕÍ¡5¥ÍÍ¥¹œœ°ÁÕÍ¡…¥±•t¹É•‘Õ” ¡ÍÕ´±­•ä¤ôùÍÕ´­9Õµ‰•È¡½Õ¹ÑÍm­•åuñğÀ¤°À¤­µ¥ÍÍ¥¹œ­9Õµ‰•È¡Á•¹‘¥¹½Õ¹ÑñğÀ¤ì(€É•ÑÕÉ¸€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµİ¡¥Ñ”É½Õ¹‘•µá°‰½É‘•È‰½É‘•ÈµÙ¥½±•Ğ´ÄÀÀÀ´Ìˆø(€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à©ÕÍÑ¥™äµ‰•Ñİ••¸¥Ñ•µÌµ•¹Ñ•Èˆøñ‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÙ¥½±•Ğ´ÔÀÀˆûÂ~RPƒªÒ®š°ƒ²V3®šğğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´™½¹Ğµ‰½±Ñ•áĞµÉ…ä´äÀÀµĞ´À¸ÔˆùíÑ½Ñ…°ı€‘í™µÑ½Õ¹Ğ¡Ñ½Ñ…°¥÷ªÆĞƒ¶fW²vàƒ¶V²jQ€èŸ¶fW²vã¶V€ƒªÒ®š°ƒ²V3®šó²vĞƒ²^²ZÓ²jPôğ½‘¥Øøğ½‘¥Øøğ½‘¥Øø(€€€íÑ½Ñ…°øÀ˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰É¥É¥µ½±Ì´È…À´ÈµĞ´ÌÑ•áĞµáÌˆø(€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤ôù½¹¼ Á•É™½Éµ…¹•ÁÁÉ½Ù…°œ¥ô±…ÍÍ9…µ”ô‰‰œµÙ¥½±•Ğ´ÔÀÑ•áĞµÙ¥½±•Ğ´ÜÀÀÉ½Õ¹‘•µ±œÀ´ÈÑ•áĞµ±•™Ğˆû²b“®*`ƒ²z®‚”ƒ®"®vô€ñˆ±…ÍÍ9…µ”ô‰™±½…ĞµÉ¥¡Ğˆùíµ¥ÍÍ¥¹ôğ½ˆøğ½‰ÕÑÑ½¸ø(€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤ôù½¹¼ ÕÍÑ½µ•É…É•‘µ¥¸œ¥ô±…ÍÍ9…µ”ô‰‰œµÉ•´ÔÀÑ•áĞµÉ•´ØÀÀÉ½Õ¹‘•µ±œÀ´ÈÑ•áĞµ±•™ĞˆûªÎƒªÂw²V÷²4ƒªÊ÷ªÎğ€ñˆ±…ÍÍ9…µ”ô‰™±½…ĞµÉ¥¡Ğˆùí½Õ¹ÑÌ¹ÕÍÑ½µ•Éôğ½ˆøğ½‰ÕÑÑ½¸ø(€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤ôù½¹¼ ¡½µ•…É”œ¥ô±…ÍÍ9…µ”ô‰‰œµ½É…¹”´ÔÀÑ•áĞµ½É…¹”´ØÀÀÉ½Õ¹‘•µ±œÀ´ÈÑ•áĞµ±•™Ğˆû¶f ƒ²“²æ`ƒ¶fW²và€ñˆ±…ÍÍ9…µ”ô‰™±½…ĞµÉ¥¡Ğˆùí½Õ¹ÑÌ¹¡½µ•ôğ½ˆøğ½‰ÕÑÑ½¸ø(€€€€€í…¹Y¥•İMÁ½Ñ‘µ¥¸˜˜ñ‰ÕÑÑ½¸½¹±¥¬õì ¤ôù½¹¼ ÍÁ½Ğœ¥ô±…ÍÍ9…µ”ô‰‰œµ½É…¹”´ÔÀÑ•áĞµ½É…¹”´ØÀÀÉ½Õ¹‘•µ±œÀ´ÈÑ•áĞµ±•™Ğˆû²*“¶2|ƒ²*ç²và€ñˆ±…ÍÍ9…µ”ô‰™±½…ĞµÉ¥¡Ğˆùí½Õ¹ÑÌ¹ÍÁ½Ñôğ½ˆøğ½‰ÕÑÑ½¸ùô(€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤ôù½¹¼ Á•É™½Éµ…¹•ÁÁÉ½Ù…°œ¥ô±…ÍÍ9…µ”ô‰‰œµÙ¥½±•Ğ´ÔÀÑ•áĞµÙ¥½±•Ğ´ÜÀÀÉ½Õ¹‘•µ±œÀ´ÈÑ•áĞµ±•™Ğˆû².“²‚ƒ²*ç²vàƒ®2ªâÀ€ñˆ±…ÍÍ9…µ”ô‰™±½…ĞµÉ¥¡ĞˆùíÁ•¹‘¥¹½Õ¹Ñôğ½ˆøğ½‰ÕÑÑ½¸ø(€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤ôù½¹¼ ÍÑ½É•½…±Ìœ¥ô±…ÍÍ9…µ”ô‰‰œµÉ•´ÔÀÑ•áĞµÉ•´ØÀÀÉ½Õ¹‘•µ±œÀ´ÈÑ•áĞµ±•™Ğˆù!Lƒ®ª§¶Fpƒ²r¶^`ƒ®“²z”€ñˆ±…ÍÍ9…µ”ô‰™±½…ĞµÉ¥¡Ğˆùí½Õ¹ÑÌ¹½…±I¥Í­ôğ½ˆøğ½‰ÕÑÑ½¸ø(€€€€€í¥ÍÕ±±‘µ¥¸˜˜ñ‰ÕÑÑ½¸½¹±¥¬õì ¤ôù½¹¼ ¡•…‘=™™¥•…Ñ„œ¥ô±…ÍÍ9…µ”ô‰‰œµ‰±Õ”´ÔÀÑ•áĞµ‰±Õ”´ÜÀÀÉ½Õ¹‘•µ±œÀ´ÈÑ•áĞµ±•™Ğˆû®Îã²
°ƒ®6Ã²vÓ¶Àƒ²Â£²vĞ€ñˆ±…ÍÍ9…µ”ô‰™±½…ĞµÉ¥¡Ğˆùí½Õ¹ÑÌ¹¡Å¥™™ôğ½ˆøğ½‰ÕÑÑ½¸ùô(€€€€€í¥ÍÕ±±‘µ¥¸˜˜ñ‰ÕÑÑ½¸½¹±¥¬õì ¤ôù½¹¼ Í•ÑÑ±•µ•¹Ğœ¥ô±…ÍÍ9…µ”ô‰‰œµ•µ•É…±´ÔÀÑ•áĞµ•µ•É…±´ÜÀÀÉ½Õ¹‘•µ±œÀ´ÈÑ•áĞµ±•™Ğˆû²‚W²
Àƒ®¾ãªÊ¶€€ñˆ±…ÍÍ9…µ”ô‰™±½…ĞµÉ¥¡Ğˆùí½Õ¹ÑÌ¹Í•ÑÑ±•µ•¹Ñôğ½ˆøğ½‰ÕÑÑ½¸ùô(€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤ôù½¹¼ •µÁ±½å••Ìœ¥ô±…ÍÍ9…µ”ô‰‰œµÉ…ä´ÔÀÑ•áĞµÉ…ä´ÜÀÀÉ½Õ¹‘•µ±œÀ´ÈÑ•áĞµ±•™Ğˆû¶R®†s¶Vƒ²"c²‚Tƒ²jS²Ê´€ñˆ±…ÍÍ9…µ”ô‰™±½…ĞµÉ¥¡Ğˆùí½Õ¹ÑÌ¹ÁÉ½™¥±•ôğ½ˆøğ½‰ÕÑÑ½¸ø(€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤ôù½¹¼ •µÁ±½å••Ìœ¥ô±…ÍÍ9…µ”ô‰‰œµÉ…ä´ÔÀÑ•áĞµÉ…ä´ÜÀÀÉ½Õ¹‘•µ±œÀ´ÈÑ•áĞµ±•™Ğˆû¶Fã².pƒ²V3®šğƒ®¾ã²“²‚T€ñˆ±…ÍÍ9…µ”ô‰™±½…ĞµÉ¥¡Ğˆùí½Õ¹ÑÌ¹ÁÕÍ¡5¥ÍÍ¥¹ôğ½ˆøğ½‰ÕÑÑ½¸ø(€€€€€í½Õ¹ÑÌ¹ÁÕÍ¡…¥±•øÀ˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµÉ•´ÔÀÑ•áĞµÉ•´ØÀÀÉ½Õ¹‘•µ±œÀ´Èˆû²ÖsªŞğƒ¶Fã².pƒ®Âs²„ƒ².“¶2 €ñˆ±…ÍÍ9…µ”ô‰™±½…ĞµÉ¥¡Ğˆùí½Õ¹ÑÌ¹ÁÕÍ¡…¥±•‘ôğ½ˆøğ½‘¥Øùô(€€€€€í½Õ¹ÑÌ¹ÁÕÍ¡M•¹ĞøÀ˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµ•µ•É…±´ÔÀÑ•áĞµ•µ•É…±´ÜÀÀÉ½Õ¹‘•µ±œÀ´Èˆû²ÖsªŞğƒ®Âs²„ƒ²ÇªÎÔ€ñˆ±…ÍÍ9…µ”ô‰™±½…ĞµÉ¥¡Ğˆùí½Õ¹ÑÌ¹ÁÕÍ¡M•¹Ñôğ½ˆøğ½‘¥Øùô(€€€€ğ½‘¥Øùô(€€ğ½‘¥Øøì)ô()™Õ¹Ñ¥½¸M•ÑÑ±•µ•¹ÑI•Ù¥•Ü¡ìµ½¹Ñ °É½İÌ°•µÁ±½å••Ì°½¹™¥œ°…ÕÑ¡UÍ•É%ô¤ì(€½¹ÍĞmÍÁ½Ñ5…À±Í•ÑMÁ½Ñ5…ÁtõÕÍ•MÑ…Ñ”¡íô¤±m•áÁ•¹Í•5…À±Í•ÑáÁ•¹Í•5…ÁtõÕÍ•MÑ…Ñ”¡íô¤±mÍÑ…ÑÕÍ5…À±Í•ÑMÑ…ÑÕÍ5…ÁtõÕÍ•MÑ…Ñ”¡íô¤±m¡•…‘=™™¥•5…À±Í•Ñ!•…‘=™™¥•5…ÁtõÕÍ•MÑ…Ñ”¡íô¤ì(€½¹ÍĞm‘•Ñ…¥±UÍ•È±Í•Ñ•Ñ…¥±UÍ•ÉtõÕÍ•MÑ…Ñ”¡¹Õ±°¤±m‘•Ñ…¥±I½İÌ±Í•Ñ•Ñ…¥±I½İÍtõÕÍ•MÑ…Ñ”¡mt¤±m‘•Ñ…¥±1½…‘¥¹œ±Í•Ñ•Ñ…¥±1½…‘¥¹tõÕÍ•MÑ…Ñ”¡™…±Í”¤ì(€ÕÍ•™™•Ğ  ¤ôùì(€€€€¡…Íå¹Œ ¤ôùì(€€€€€½¹ÍĞ¥‘Ìô¡É½İÍññmt¤¹µ…À¡ÈôùÈ¹¥¤í¥˜ …¥‘Ì¹±•¹Ñ ¥É•ÑÕÉ¸ì(€€€€€½¹ÍĞmä±µtõµ½¹Ñ ¹ÍÁ±¥Ğ œ´œ¤¹µ…À¡9Õµ‰•È¤±¸õ¹•Ü…Ñ”¡ä±´°Ä¤±Ñ¼õ€‘í¸¹•ÑÕ±±e•…È ¥ô´‘íMÑÉ¥¹œ¡¸¹•Ñ5½¹Ñ  ¤¬Ä¤¹Á…‘MÑ…ÉĞ È°œÀœ¥ô´ÀÅ€ì(€€€€€½¹ÍĞmí‘…Ñ„éÍô±í‘…Ñ„é•ô±í‘…Ñ„éÉô±í‘…Ñ„é¡õtõ…İ…¥ĞAÉ½µ¥Í”¹…±°¡l(€€€€€€€ÍÕÁ…‰…Í”¹™É½´ ÍÁ½Ñ}±…¥µÌœ¤¹Í•±•Ğ ÕÍ•É}¥±™¥¹…±}…µ½Õ¹Ğ±‘¥É•Ñ}…µ½Õ¹Ğ±Í½ÕÉ•}½¹Ñ•áĞ±ÍÁ½Ñ}Á½±¥¥•Ì¡…µ½Õ¹Ğ¤œ¤¹¥¸ ÕÍ•É}¥œ±¥‘Ì¤¹•Ä ÍÑ…ÑÕÌœ°…ÁÁÉ½Ù•œ¤¹Ñ” ±…¥µ}‘…Ñ”œ±€‘íµ½¹Ñ¡ô´ÀÅ€¤¹±Ğ ±…¥µ}‘…Ñ”œ±Ñ¼¤°(€€€€€€€ÍÕÁ…‰…Í”¹™É½´ Í…±•Í}•áÁ•¹Í•Ìœ¤¹Í•±•Ğ ÕÍ•É}¥±…µ½Õ¹Ğœ¤¹¥¸ ÕÍ•É}¥œ±¥‘Ì¤¹Ñ” •áÁ•¹Í•}‘…Ñ”œ±€‘íµ½¹Ñ¡ô´ÀÅ€¤¹±Ğ •áÁ•¹Í•}‘…Ñ”œ±Ñ¼¤°(€€€€€€€ÍÕÁ…‰…Í”¹™É½´ Í•ÑÑ±•µ•¹Ñ}É•Ù¥•İÌœ¤¹Í•±•Ğ œ¨œ¤¹•Ä µ½¹Ñ œ±µ½¹Ñ ¤¹¥¸ ÕÍ•É}¥œ±¥‘Ì¤°(€€€€€€€ÍÕÁ…‰…Í”¹™É½´ ¡•…‘}½™™¥•}Á•É™½Éµ…¹”œ¤¹Í•±•Ğ ÕÍ•É}¥±…Í}½™}‘…Ñ”±µ•ÑÉ¥Ì±Ù…Í}É•Ù¥•Ü±¹½Ñ”œ¤¹•Ä µ½¹Ñ œ±µ½¹Ñ ¤¹¥¸ ÕÍ•É}¥œ±¥‘Ì¤(€€€€€t¤ì(€€€€€½¹ÍĞÍ´õíô±•´õíô±ÍÑ´õíôì(€€€€€€¡Íññmt¤¹™¥±Ñ•È¡àôùà¹Í½ÕÉ•}½¹Ñ•áĞ„ôôµ½‰¥±”œ¤¹™½É… ¡àôùÍµmà¹ÕÍ•É}¥‘tô¡Íµmà¹ÕÍ•É}¥‘uñğÀ¤­9Õµ‰•È¡à¹™¥¹…±}…µ½Õ¹Ğüıà¹‘¥É•Ñ}…µ½Õ¹Ğüıà¹ÍÁ½Ñ}Á½±¥¥•Ìü¹…µ½Õ¹ĞüüÀ¤¤ì(€€€€€€¡•ññmt¤¹™½É… ¡àôù•µmà¹ÕÍ•É}¥‘tô¡•µmà¹ÕÍ•É}¥‘uñğÀ¤­9Õµ‰•È¡à¹…µ½Õ¹ÑñğÀ¤¤ì(€€€€€€¡Éññmt¤¹™½É… ¡àôùÍÑµmà¹ÕÍ•É}¥‘tõà¹ÍÑ…ÑÕÌ¤ì(€€€€€Í•ÑMÁ½Ñ5…À¡Í´¤íÍ•ÑáÁ•¹Í•5…À¡•´¤íÍ•ÑMÑ…ÑÕÍ5…À¡ÍÑ´¤íÍ•Ñ!•…‘=™™¥•5…À¡=‰©•Ğ¹™É½µ¹ÑÉ¥•Ì ¡¡ññmt¤¹µ…À¡àôùmà¹ÕÍ•É}¥±át¤¤¤ì(€€€ô¤ ¤ì(€ô±mµ½¹Ñ ±É½İÍt¤ì((€½¹ÍĞÍ•ÑMÑ…ÑÕÌõ…Íå¹Œ¡ÕÍ•É%±ÍÑ…ÑÕÌ¤ôùì(€€€½¹ÍĞí•ÉÉ½Éôõ…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ Í•ÑÑ±•µ•¹Ñ}É•Ù¥•İÌœ¤¹ÕÁÍ•ÉĞ¡íµ½¹Ñ ±ÕÍ•É}¥éÕÍ•É%±ÍÑ…ÑÕÌ±É•Ù¥•İ•É}¥é…ÕÑ¡UÍ•É%±ÕÁ‘…Ñ•‘}…Ğé¹•Ü…Ñ” ¤¹Ñ½%M=MÑÉ¥¹œ ¥ô±í½¹½¹™±¥Ğèµ½¹Ñ ±ÕÍ•É}¥ô¤ì(€€€¥˜¡•ÉÉ½È¥É•ÑÕÉ¸Í¡½İ1•…å±•ÉĞ¡ƒ²‚W²
Àƒ²¶pƒ²‚²z”ƒ².“¶2 è€‘í™É¥•¹‘±åÉÉ½È¡•ÉÉ½È¥õ€¤ì(€€€Í•ÑMÑ…ÑÕÍ5…À¡ì¸¸¹ÍÑ…ÑÕÍ5…À±mÕÍ•É%‘téÍÑ…ÑÕÍô¤ì(€€€¥˜¡ÍÑ…ÑÕÌôôô¡•­•ññÍÑ…ÑÕÌôôô™¥¹…°œ¥…İ…¥Ğ¹½Ñ¥™åµÁ±½å•”¡í…Ñ½É%é…ÕÑ¡UÍ•É%±É•¥Á¥•¹Ñ%éÕÍ•É%±ÑåÁ”èÍ•ÑÑ±•µ•¹Ñ}É•Ù¥•İ•œ±Ñ¥Ñ±”éÍÑ…ÑÕÌôôô™¥¹…°œüŸ²‚W²
Àƒ¶fW²‚Tƒ²f®0œèŸ²‚W²
ÀƒªÊ¶€ƒ²f®0œ±µ•ÍÍ…”é€‘íµ½¹Ñ¡1…‰•°¡µ½¹Ñ ¥ôƒ²‚W²
Àƒ²¶sªÂ ƒ²^®6Ã²vÓ¶*ã®BC²ZÓ²jP¹€±Á…å±½…éíµ½¹Ñ ±ÍÑ…ÑÕÍõô¤ì(€ôì((€½¹ÍĞ±½…‘•Ñ…¥°õ…Íå¹Œ¡È¤ôùì(€€€Í•Ñ•Ñ…¥±UÍ•È¡È¤íÍ•Ñ•Ñ…¥±I½İÌ¡mt¤íÍ•Ñ•Ñ…¥±1½…‘¥¹œ¡ÑÉÕ”¤ì(€€€½¹ÍĞmä±µtõµ½¹Ñ ¹ÍÁ±¥Ğ œ´œ¤¹µ…À¡9Õµ‰•È¤±¸õ¹•Ü…Ñ”¡ä±´°Ä¤±Ñ¼õ€‘í¸¹•ÑÕ±±e•…È ¥ô´‘íMÑÉ¥¹œ¡¸¹•Ñ5½¹Ñ  ¤¬Ä¤¹Á…‘MÑ…ÉĞ È°œÀœ¥ô´ÀÅ€ì(€€€ÑÉåì(€€€€€½¹ÍĞmÍ…±•ÍI•Ì±ÍÁ½ÑÍI•Ì±•áÁ•¹Í•ÍI•Ì±¡½µ•I•Ítõ…İ…¥ĞAÉ½µ¥Í”¹…±°¡l(€€€€€€€ÍÕÁ…‰…Í”¹™É½´ ÕÍÑ½µ•É}Í…±•Ìœ¤¹Í•±•Ğ ¥±ÕÍÑ½µ•É}¥±Í…±•}‘…Ñ”±µ•ÑÉ¥}±…‰•°±Í½ÕÉ•}ÑåÁ”±Í½ÕÉ•}É•˜±Í½ÕÉ•}µ•Ñ„±ÕÍÑ½µ•ÉÌ¡ÕÍÑ½µ•É}¹…µ”¤œ¤¹•Ä ÕÍ•É}¥œ±È¹¥¤¹Ñ” Í…±•}‘…Ñ”œ±€‘íµ½¹Ñ¡ô´ÀÅ€¤¹±Ğ Í…±•}‘…Ñ”œ±Ñ¼¤¹½É‘•È Í…±•}‘…Ñ”œ¤°(€€€€€€€ÍÕÁ…‰…Í”¹™É½´ ÍÁ½Ñ}±…¥µÌœ¤¹Í•±•Ğ ¥±±…¥µ}‘…Ñ”±ÕÍÑ½µ•É}¹…µ”±ÍÑ…ÑÕÌ±Í½ÕÉ•}½¹Ñ•áĞ±É•Ù¥•İ•‘}Ñ¥Ñ±”±‘¥É•Ñ}Ñ¥Ñ±”±™¥¹…±}…µ½Õ¹Ğ±‘¥É•Ñ}…µ½Õ¹Ğ±ÍÁ½Ñ}Á½±¥¥•Ì¡Ñ¥Ñ±”±…µ½Õ¹Ğ¤œ¤¹•Ä ÕÍ•É}¥œ±È¹¥¤¹Ñ” ±…¥µ}‘…Ñ”œ±€‘íµ½¹Ñ¡ô´ÀÅ€¤¹±Ğ ±…¥µ}‘…Ñ”œ±Ñ¼¤¹½É‘•È ±…¥µ}‘…Ñ”œ¤°(€€€€€€€ÍÕÁ…‰…Í”¹™É½´ Í…±•Í}•áÁ•¹Í•Ìœ¤¹Í•±•Ğ ¥±•áÁ•¹Í•}‘…Ñ”±ÕÍÑ½µ•É}¹…µ”±…Ñ•½Éä±…µ½Õ¹Ğ±µ•µ¼œ¤¹•Ä ÕÍ•É}¥œ±È¹¥¤¹Ñ” •áÁ•¹Í•}‘…Ñ”œ±€‘íµ½¹Ñ¡ô´ÀÅ€¤¹±Ğ •áÁ•¹Í•}‘…Ñ”œ±Ñ¼¤¹½É‘•È •áÁ•¹Í•}‘…Ñ”œ¤°(€€€€€€€ÍÕÁ…‰…Í”¹™É½´ ¡½µ•}½É‘•ÉÌœ¤¹Í•±•Ğ ¥±ÕÍÑ½µ•É}¥±ÕÍÑ½µ•É}¹…µ”±ÁÉ½‘ÕÑ}ÑåÁ”±¹•Ñİ½É­}ÑåÁ”±Í…±•}ÑåÁ”±Í½ÕÉ•}É½ÕÀ±Í½ÕÉ•}­•ä±ÍÑ…ÑÕÌ±Í½ÕÉ•}İ½É­}‘…Ñ”±…ÑÕ…±}¥¹ÍÑ…±±}‘…Ñ”œ¤¹•Ä ÕÍ•É}¥œ±È¹¥¤¹½È¡Í½ÕÉ•}İ½É­}‘…Ñ”¹Ñ”¸‘íµ½¹Ñ¡ô´ÀÄ±…ÑÕ…±}¥¹ÍÑ…±±}‘…Ñ”¹Ñ”¸‘íµ½¹Ñ¡ô´ÀÅ€¤(€€€€€t¤ì(€€€€€½¹ÍĞ•ÉÈõÍ…±•ÍI•Ì¹•ÉÉ½ÉññÍÁ½ÑÍI•Ì¹•ÉÉ½Éññ•áÁ•¹Í•ÍI•Ì¹•ÉÉ½Éññ¡½µ•I•Ì¹•ÉÉ½Èí¥˜¡•ÉÈ¥Ñ¡É½Ü•ÉÈì(€€€€€½¹ÍĞÉ•½¹¥é•‘!½µ•Ìõ¡½µ•=É‘•ÉÍ½É5½¹Ñ ¡¡½µ•I•Ì¹‘…Ñ…ññmt±µ½¹Ñ °½µÁ±•Ñ•œ¤ì(€€€€€½¹ÍĞ¡½µ•5…Àõ=‰©•Ğ¹™É½µ¹ÑÉ¥•Ì¡É•½¹¥é•‘!½µ•Ì¹µ…À¡¼ôùmMÑÉ¥¹œ¡¼¹¥¤±½t¤¤ì(€€€€€½¹ÍĞ‘•Ñ…¥±!½µ•A½±¥äõ…±Õ±…Ñ•!½µ•A½±¥å¹¥¹”¡É•½¹¥é•‘!½µ•Ì±½¹™¥œ¤ì(€€€€€½¹ÍĞ±•‘•Èõmtì(€€€€€€¡Í…±•ÍI•Ì¹‘…Ñ…ññmt¤¹™½É… ¡àôùì(€€€€€€€½¹ÍĞµ•Ñ„õà¹Í½ÕÉ•}µ•Ñ…ññíô°ÕÍÑ½µ•Èõà¹ÕÍÑ½µ•ÉÌü¹ÕÍÑ½µ•É}¹…µ•ñğŸ²vÓ®šƒ²^²v0œì(€€€€€€€¥˜¡à¹Í½ÕÉ•}ÑåÁ”ôôôµ½‰¥±”œ¥ì(€€€€€€€€€½¹ÍĞÉ¤õ9Õµ‰•È¡µ•Ñ„¹É¤¤±¤õ9Õµ‰•È¡µ•Ñ„¹¤¤ì(€€€€€€€€€½¹ÍĞµ…ÑÉ¥áI…Ñ”õ9Õµ‰•È¡½¹™¥œ¹µ…ÑÉ¥àü¹mÉ¥tü¹m¥uñğÀ¤ì(€€€€€€€€€¥˜¡µ…ÑÉ¥áI…Ñ”¥±•‘•È¹ÁÕÍ ¡í‘…Ñ”éà¹Í…±•}‘…Ñ”±ÕÍÑ½µ•È±ÑåÁ”éà¹µ•ÑÉ¥}±…‰•±ñğŸ®ª£®ÂS²vğœ±¥Ñ•´èŸ²jSªâ#²‚pƒ²rƒ²æ`ƒ²"c²"c®0œ±…µ½Õ¹Ğéµ…ÑÉ¥áI…Ñ”±¹½Ñ”é€‘í5QI%a}I=]}MmÉ¥tü¹‘…¥±å1…‰•±ññ5QI%a}I=]}MmÉ¥tü¹±…‰•±ñğœô‘í5QI%a}I=]}MmÉ¥tü¹¡…ÍQ¥•ÉÌı€ƒ
Ü€‘í5QI%a}=1Mm¥uñğœõ€èœõô¤ì(€€€€€€€€€½¹ÍĞ¹½Éµ…±Y…Ìõl¸¸¸¡µ•Ñ„¹Ù…Í-•åÍññmt¥tì(€€€€€€€€€¹½Éµ…±Y…Ì¹™½É… ¡¬ôùí¥˜¡¬ôôôÙ…Í9½¹”œ¥É•ÑÕÉ¸í½¹ÍĞ¥Ğô¡½¹™¥œ¹Ù…Íññmt¤¹™¥¹¡ØôùØ¹­•äôôõ¬¤í¥˜¡9Õµ‰•È¡¥Ğü¹É…Ñ•ñğÀ¤¥±•‘•È¹ÁÕÍ ¡í‘…Ñ”éà¹Í…±•}‘…Ñ”±ÕÍÑ½µ•È±ÑåÁ”éà¹µ•ÑÉ¥}±…‰•±ñğŸ®ª£®ÂS²vğœ±¥Ñ•´èYLƒ²rƒ²æ`ƒ²"c²"c®0œ±…µ½Õ¹Ğé9Õµ‰•È¡¥Ğ¹É…Ñ”¤±¹½Ñ”é¥Ğ¹±…‰•±ññ­ô¤íô¤ì(€€€€€€€€€=‰©•Ğ¹•¹ÑÉ¥•Ì¡µ•Ñ„¹‰Õ¹‘±”É¹‘-•åÍññmt¤¹™½É…   ¤ôùíô¤ì(€€€€€€€€€€¡µ•Ñ„¹‰Õ¹‘±”É¹‘-•åÍññmt¤¹™½É… ¡¬ôùí½¹ÍĞ¥Ğô¡½¹™¥œ¹‰Õ¹‘±”É¹‘ññmt¤¹™¥¹¡ØôùØ¹­•äôôõ¬¤í¥˜¡9Õµ‰•È¡¥Ğü¹É…Ñ•ñğÀ¤¥±•‘•È¹ÁÕÍ ¡í‘…Ñ”éà¹Í…±•}‘…Ñ”±ÕÍÑ½µ•È±ÑåÁ”éà¹µ•ÑÉ¥}±…‰•±ñğŸ®ª£®ÂS²vğœ±¥Ñ•´èœÉ9ƒ®Ê#®Nƒ²rƒ²æ`ƒ²"c²"c®0œ±…µ½Õ¹Ğé9Õµ‰•È¡¥Ğ¹É…Ñ”¤±¹½Ñ”é¥Ğ¹±…‰•±ññ­ô¤íô¤ì(€€€€€€€€€¥˜¡µ•Ñ„¹ÕÍ•‘5¹Á	Õ¹‘±”¥í½¹ÍĞ¥Ğô¡½¹™¥œ¹µ¹Á	Õ¹‘±•ññmt¤¹™¥¹¡ØôùØ¹­•äôôôÕÍ•‘5¹Á	Õ¹‘±”œ¤í¥˜¡9Õµ‰•È¡¥Ğü¹É…Ñ•ñğÀ¤¥±•‘•È¹ÁÕÍ ¡í‘…Ñ”éà¹Í…±•}‘…Ñ”±ÕÍÑ½µ•È±ÑåÁ”éà¹µ•ÑÉ¥}±…‰•±ñğŸ®ª£®ÂS²vğœ±¥Ñ•´èŸ²’GªÎ€59@ƒªÊÃ¶V¤ƒ²"c²"c®0œ±…µ½Õ¹Ğé9Õµ‰•È¡¥Ğ¹É…Ñ”¤±¹½Ñ”é¥Ğ¹±…‰•±ñğŸ²’GªÎ59@ƒªÊÃ¶V¤ô¤íô(€€€€€€€€€½¹ÍĞÍÀõµ•Ñ„¹ÍÁ•¥…±A½±¥åññíôì(€€€€€€€€€¥˜¡ÍÀ¹Á½±¥å%¥ì(€€€€€€€€€€€½¹ÍĞÉ•Á°õ9Õµ‰•È¡ÍÀ¹•á•ÁÑ¥½¹MÑ…ÑÕÌôôô…ÁÁÉ½Ù•œıÍÀ¹•á•ÁÑ¥½¹ÁÁÉ½Ù•‘µ½Õ¹ĞéÍÀ¹É•Á±…•µ•¹Ñµ½Õ¹ÑñğÀ¤ì(€€€€€€€€€€€¥˜¡µ…ÑÉ¥áI…Ñ”¥±•‘•È¹ÁÕÍ ¡í‘…Ñ”éà¹Í…±•}‘…Ñ”±ÕÍÑ½µ•È±ÑåÁ”éà¹µ•ÑÉ¥}±…‰•±ñğŸ®ª£®ÂS²vğœ±¥Ñ•´èŸ¶*ç¶2@ƒ²jSªâ#²‚pƒ²"c²"c®0ƒ²‚s²fàœ±…µ½Õ¹Ğèµµ…ÑÉ¥áI…Ñ”±¹½Ñ”éÍÀ¹Á½±¥åQ¥Ñ±•ñğŸ¶*ç¶2C
ß²²vã¶2C®ô¤ì(€€€€€€€€€€€½¹ÍĞÙ…Í•”õ9Õµ‰•È¡ÍÀ¹¹½Éµ…±Y…Í••ñğÀ¤í¥˜¡Ù…Í•”¥±•‘•È¹ÁÕÍ ¡í‘…Ñ”éà¹Í…±•}‘…Ñ”±ÕÍÑ½µ•È±ÑåÁ”éà¹µ•ÑÉ¥}±…‰•±ñğŸ®ª£®ÂS²vğœ±¥Ñ•´èŸ¶*ç¶2@YLƒ²"c²"c®0ƒ²‚s²fàœ±…µ½Õ¹ĞèµÙ…Í•”±¹½Ñ”éÍÀ¹Á½±¥åQ¥Ñ±•ñğŸ¶*ç¶2C
ß²²vã¶2C®ô¤ì(€€€€€€€€€€€¥˜¡É•Á°¥±•‘•È¹ÁÕÍ ¡í‘…Ñ”éà¹Í…±•}‘…Ñ”±ÕÍÑ½µ•È±ÑåÁ”éà¹µ•ÑÉ¥}±…‰•±ñğŸ®ª£®ÂS²vğœ±¥Ñ•´èŸ¶*ç¶2@ƒ®2²ÊĞƒ²vã²ó¶.Ã®â0œ±…µ½Õ¹ĞéÉ•Á°±¹½Ñ”éÍÀ¹Á½±¥åQ¥Ñ±•ñğŸ¶*ç¶2C
ß²²vã¶2C®ô¤ì(€€€€€€€€€ô(€€€€€€€ô•±Í”¥˜¡à¹Í½ÕÉ•}ÑåÁ”ôôô¡½µ•}½É‘•Èœ¥ì(€€€€€€€€€€¼¼ƒ¶f#²v ƒ²V®zc²^C²pƒªÎƒªÂtƒ®²Û²v0ƒ®.£²rƒ² ƒ²‚W²ÆƒªÎ²
ÀƒªÊÃªÎó®–ğƒ¶Vpƒ®Ê#®0ƒ¶Fs².s¶V§®.#®.¸(€€€€€€€ô(€€€€€ô¤ì(€€€€€€¡‘•Ñ…¥±!½µ•A½±¥ä¹‘•Ñ…¥±Íññmt¤¹™½É… ¡àôù±•‘•È¹ÁÕÍ ¡à¤¤ì(€€€€€€¡ÍÁ½ÑÍI•Ì¹‘…Ñ…ññmt¤¹™½É… ¡àôùì(€€€€€€€¥˜¡à¹ÍÑ…ÑÕÌ„ôô…ÁÁÉ½Ù•œ¥É•ÑÕÉ¸ì(€€€€€€€±•‘•È¹ÁÕÍ ¡í‘…Ñ”éà¹±…¥µ}‘…Ñ”±ÕÍÑ½µ•Èéà¹ÕÍÑ½µ•É}¹…µ•ñğŸ²vÓ®šƒ²^²v0œ±ÑåÁ”èŸ²*“¶2|œ±¥Ñ•´éà¹É•Ù¥•İ•‘}Ñ¥Ñ±•ññà¹‘¥É•Ñ}Ñ¥Ñ±•ññà¹ÍÁ½Ñ}Á½±¥¥•Ìü¹Ñ¥Ñ±•ñğŸ²*ç²vàƒ²*“¶2|œ±…µ½Õ¹Ğé9Õµ‰•È¡à¹™¥¹…±}…µ½Õ¹Ğüıà¹‘¥É•Ñ}…µ½Õ¹Ğüıà¹ÍÁ½Ñ}Á½±¥¥•Ìü¹…µ½Õ¹ĞüüÀ¤±¹½Ñ”éà¹Í½ÕÉ•}½¹Ñ•áĞôôôµ½‰¥±”œüŸ®ª£®ÂS²vğƒ²*ç²vàƒ²*“¶2|œèŸ²*ç²vàƒ²*“¶2|ô¤ì(€€€€€ô¤ì(€€€€€€¡•áÁ•¹Í•ÍI•Ì¹‘…Ñ…ññmt¤¹™½É… ¡àôù±•‘•È¹ÁÕÍ ¡í‘…Ñ”éà¹•áÁ•¹Í•}‘…Ñ”±ÕÍÑ½µ•Èéà¹ÕÍÑ½µ•É}¹…µ•ñğŸ²vÓ®šƒ²^²v0œ±ÑåÁ”èŸ²b²^®æ²j¤œ±¥Ñ•´éà¹…Ñ•½ÉåñğŸ²b²^®æ²j¤œ±…µ½Õ¹Ğèµ9Õµ‰•È¡à¹…µ½Õ¹ÑñğÀ¤±¹½Ñ”éà¹µ•µ½ñğŸ®æ²j¤ƒ²Â£ªÂ@ô¤¤ì(€€€€€±•‘•È¹Í½ÉĞ ¡„±ˆ¤ôùMÑÉ¥¹œ¡„¹‘…Ñ”¤¹±½…±•½µÁ…É”¡MÑÉ¥¹œ¡ˆ¹‘…Ñ”¤¥ññMÑÉ¥¹œ¡„¹ÕÍÑ½µ•È¤¹±½…±•½µÁ…É”¡MÑÉ¥¹œ¡ˆ¹ÕÍÑ½µ•È¤¤¤ì(€€€€€Í•Ñ•Ñ…¥±I½İÌ¡±•‘•È¤ì(€€€õ…Ñ ¡”¥íÍ¡½İ1•…å±•ÉĞ¡ƒ²²àƒ²
Ã²Ús®
Ó²^´ƒ®Ú#®~³²b“ªâÀƒ².“¶2 è€‘í™É¥•¹‘±åÉÉ½È¡”¥õ€¤íô(€€€™¥¹…±±åíÍ•Ñ•Ñ…¥±1½…‘¥¹œ¡™…±Í”¤íô(€ôì((€€¼¼ƒªÒªÎƒ²†Ã²vã²vƒ²
³²j§¶Vc² ƒ²V+ªÎ€ƒ¶R®†s¶V²vƒ®Î®>ƒ®“¶VG¶VĞÍ¡•µ„µ…¡”ƒ²b“®–c®–ğƒ¶Ró¶V§®.#®.¸(€½¹ÍĞ•áÁ½ÉÑI…Üõ…Íå¹Œ ¤ôùì(€€€½¹ÍĞ¥‘Ìô¡É½İÍññmt¤¹µ…À¡ÈôùÈ¹¥¤í¥˜ …¥‘Ì¹±•¹Ñ ¥É•ÑÕÉ¸Í¡½İ1•…å±•ÉĞ Ÿ²‚W²
Àƒ®2²ƒ²²nC²vĞƒ²^²ZÓ²jP¸œ¤ì(€€€½¹ÍĞmä±µtõµ½¹Ñ ¹ÍÁ±¥Ğ œ´œ¤¹µ…À¡9Õµ‰•È¤±¸õ¹•Ü…Ñ”¡ä±´°Ä¤±Ñ¼õ€‘í¸¹•ÑÕ±±e•…È ¥ô´‘íMÑÉ¥¹œ¡¸¹•Ñ5½¹Ñ  ¤¬Ä¤¹Á…‘MÑ…ÉĞ È°œÀœ¥ô´ÀÅ€ì(€€€ÑÉäì(€€€€€½¹ÍĞÉ•ÍÕ±ÑÌõ…İ…¥ĞAÉ½µ¥Í”¹…±°¡l(€€€€€€€ÍÕÁ…‰…Í”¹™É½´ ‘…¥±å}É•½É‘Ìœ¤¹Í•±•Ğ ÕÍ•É}¥±İ½É­}‘…Ñ”±‘…Ñ„œ¤¹¥¸ ÕÍ•É}¥œ±¥‘Ì¤¹Ñ” İ½É­}‘…Ñ”œ±€‘íµ½¹Ñ¡ô´ÀÅ€¤¹±Ğ İ½É­}‘…Ñ”œ±Ñ¼¤¹½É‘•È İ½É­}‘…Ñ”œ¤°(€€€€€€€ÍÕÁ…‰…Í”¹™É½´ ÍÁ½Ñ}±…¥µÌœ¤¹Í•±•Ğ œ¨°ÍÁ½Ñ}Á½±¥¥•Ì¡Ñ¥Ñ±”±…µ½Õ¹Ğ¤œ¤¹¥¸ ÕÍ•É}¥œ±¥‘Ì¤¹Ñ” ±…¥µ}‘…Ñ”œ±€‘íµ½¹Ñ¡ô´ÀÅ€¤¹±Ğ ±…¥µ}‘…Ñ”œ±Ñ¼¤°(€€€€€€€ÍÕÁ…‰…Í”¹™É½´ Í…±•Í}•áÁ•¹Í•Ìœ¤¹Í•±•Ğ œ¨œ¤¹¥¸ ÕÍ•É}¥œ±¥‘Ì¤¹Ñ” •áÁ•¹Í•}‘…Ñ”œ±€‘íµ½¹Ñ¡ô´ÀÅ€¤¹±Ğ •áÁ•¹Í•}‘…Ñ”œ±Ñ¼¤°(€€€€€€€ÍÕÁ…‰…Í”¹™É½´ ÁÉ½™¥±•Ìœ¤¹Í•±•Ğ ¥±¹…µ”±ÍÑ½É•}¹…µ”œ¤¹¥¸ ¥œ±¥‘Ì¤(€€€€€t¤ì(€€€€€½¹ÍĞ™¥ÉÍÑÉÉ½ÈõÉ•ÍÕ±ÑÌ¹™¥¹¡àôùà¹•ÉÉ½È¤ü¹•ÉÉ½Èí¥˜¡™¥ÉÍÑÉÉ½È¥Ñ¡É½Ü™¥ÉÍÑÉÉ½Èì(€€€€€½¹ÍĞm‘…¥±ä±ÍÁ½ÑÌ±•áÁ•¹Í•Ì±ÁÉ½™¥±•ÍtõÉ•ÍÕ±ÑÌ¹µ…À¡àôùà¹‘…Ñ…ññmt¤ì(€€€€€½¹ÍĞÁ´õ=‰©•Ğ¹™É½µ¹ÑÉ¥•Ì¡ÁÉ½™¥±•Ì¹µ…À¡ÀôùmÀ¹¥±Át¤¤ì(€€€€€½¹ÍĞ•ÍŒõØôù€ˆ‘íMÑÉ¥¹œ¡Øüüœœ¤¹É•Á±…” ¼ˆ½œ°œˆˆœ¥ô‰€ì(€€€€€½¹ÍĞÉ½İÍÍØõmlŸªÖ³®Úœ°ŸªâÃ²’²nPœ°Ÿ²vó²z@œ°Ÿ®“²z”œ°Ÿ²²n@œ°Ÿ®2®Ú®–`œ°Ÿ²ã®Ú¶V·®ª¤œ°Ÿ²ã®ÚªÖ³®Úœ°ŸªÆÓ²"`¿ªÂHœ°Ÿ²‚²j§ªâ#²V„œ°Ÿ²ªâ'®Âc²bœ°Ÿ®æªÎ€utì(€€€€€€¡É½İÍññmt¤¹™½É… ¡Èôùì(€€€€€€€½¹ÍĞÍÁ½ĞõÍÁ½Ñ5…ÁmÈ¹¥‘uñğÀ±•áÁ•¹Í”õ•áÁ•¹Í•5…ÁmÈ¹¥‘uñğÀ±¹•ĞõÈ¹Á…ä¹Ñ½Ñ…°­ÍÁ½Ğµ•áÁ•¹Í”ì(€€€€€€€½¹ÍĞÁ…ÉÑÌõmlŸ®ÎÓ²z”¿ªâÃ®Îàœ±È¹Á…ä¹Õ…É…¹Ñ••‘½µÁ½¹•¹Ñt±lŸ¶f ƒªŞã®‚#²vÓ®Npœ±È¹Á…ä¹¡½µ•É…‘•A…åt±lŸ¶f ƒ²‚W²V„œ±È¹Á…ä¹¡½µ•±…ÑA…åt±lŸ¶f ƒ®ÚªÂ œ±È¹Á…ä¹¡½µ•‘‘½¹A…åt±lŸ²z³²V÷²‚Tœ±È¹Á…ä¹É•¹•İA…åt±lYLœ±È¹Á…ä¹Ù…ÍA…åt±l59C®Ê#®Nœ±È¹Á…ä¹µ¹Á	Õ¹‘±•A…åt±lŸ²3®àœ±È¹Á…ä¹Í½¹½A…åt±lŸªÎƒªÂw®NÇ®†tƒ®ÎÓ®#²*œ±È¹Á…ä¹ÕÍÑI•	½¹ÕÍt±lŸ®{²Ú“²‚s²V ƒ®ÎÓ®#²*œ±È¹Á…ä¹Ñ…¥±½É•‘	½¹ÕÍt±lŸ®{²Ú“²‚s²V ƒªâ#²V„œ±È¹Á…ä¹Ñ…¥±½É•‘µ½Õ¹Ñ	½¹ÕÍt±lŸ²*ç²vàƒ²*“¶2|œ±ÍÁ½Ñt±lŸ²b²^®æ²j¤ƒ²Â£ªÂ@œ°µ•áÁ•¹Í•utì(€€€€€€€Á…ÉÑÌ¹™¥±Ñ•È ¡l±Ùt¤ôù9Õµ‰•È¡ÙñğÀ¤„ôôÀ¤¹™½É…  ¡m±…‰•°±Ùt¤ôùÉ½İÍÍØ¹ÁÕÍ ¡lŸ²‚W²
Ã²jS²Vôœ±µ½¹Ñ °œœ±È¹‰É…¹ ±È¹¹…µ”°Ÿ²ªâ'ªÖ³²Äœ±±…‰•°°œœ°Ä±Ø°Ÿ®Âc²bœ°œt¤¤ì(€€€€€€€É½İÍÍØ¹ÁÕÍ ¡lŸ²‚W²
Ã¶V§ªÎœ±µ½¹Ñ °œœ±È¹‰É…¹ ±È¹¹…µ”°Ÿ²Ös²Š²ªâ'²V„œ°œœ°€œœ°Ä±¹•Ğ°Ÿ².“²ªâ$ƒªÊ¶€œ±ƒªâÃ®ÎãªÎ²
À€‘íÈ¹Á…ä¹Ñ½Ñ…±ô€¬ƒ²*“¶2|€‘íÍÁ½Ñô€´ƒ®æ²j¤€‘í•áÁ•¹Í•õt¤ì(€€€€€ô¤ì(€€€€€€¡‘…¥±åññmt¤¹™½É… ¡àôùì(€€€€€€€½¹ÍĞÀõÁµmà¹ÕÍ•É}¥‘uññíô±õ¹½Éµ…±¥é•…ä¡à¹‘…Ñ„¤ì(€€€€€€€¹µ…ÑÉ¥à¹™½É…  ¡…ÉÈ±É¤¤ôù…ÉÈ¹™½É…  ¡¹Ğ±¤¤ôùí¥˜ …¹Ğ¥É•ÑÕÉ¸í½¹ÍĞÉõ5QI%a}I=]}MmÉ¥tíÉ½İÍÍØ¹ÁÕÍ ¡lŸ².“²‚I\œ±µ½¹Ñ ±à¹İ½É­}‘…Ñ”±À¹ÍÑ½É•}¹…µ”±À¹¹…µ”°Ÿ®ª£®ÂS²vğœ±Éü¹‘…¥±å1…‰•±ññÉü¹±…‰•±ññƒ¶Z$‘íÉ¤¬Åõ€±Éü¹¡…ÍQ¥•ÉÌı5QI%a}=1Mm¥tèœœ±¹Ğ±½¹™¥œ¹µ…ÑÉ¥àü¹mÉ¥tü¹m¥uñğÀ°ŸªÎ²
Ã®2²œ°Ÿ²nC²Êpƒ²vó²vó²z®‚”t¥ô¤¤ì(€€€€€€€%1e}I=UA}L¹™½É… ¡œôùí½¹ÍĞÑ…‰±”õÉ½ÕÁQ…‰±”¡½¹™¥œ±œ¹­•ä¤í=‰©•Ğ¹•¹ÑÉ¥•Ì¡¹É½ÕÁÌü¹mœ¹­•åuññíô¤¹™½É…  ¡m­•ä±¹Ñt¤ôùí¥˜ …¹Ğ¥É•ÑÕÉ¸í½¹ÍĞ¥Ñ•´õÑ…‰±”¹™¥¹¡ĞôùĞ¹­•äôôõ­•ä¤íÉ½İÍÍØ¹ÁÕÍ ¡lŸ².“²‚I\œ±µ½¹Ñ ±à¹İ½É­}‘…Ñ”±À¹ÍÑ½É•}¹…µ”±À¹¹…µ”±œ¹‰Õ­•Ğôôô¡½µ”œüŸ¶f œèŸªâÃ¶ œ±œ¹±…‰•°±¥Ñ•´ü¹±…‰•±ññ­•ä±¹Ğ±¥Ñ•´ü¹É…Ñ•ññ¥Ñ•´ü¹Á½¥¹ÑñğÀ°ŸªÎ²
Ã®2²œ°Ÿ²nC²Êpƒ²vó²vó²z®‚”t¥ô¥ô¤ì(€€€€€ô¤ì(€€€€€€¡ÍÁ½ÑÍññmt¤¹™½É… ¡àôùí½¹ÍĞÀõÁµmà¹ÕÍ•É}¥‘uññíôíÉ½İÍÍØ¹ÁÕÍ ¡lŸªÂªÂAI\œ±µ½¹Ñ ±à¹±…¥µ}‘…Ñ”±À¹ÍÑ½É•}¹…µ”±À¹¹…µ”°Ÿ²*“¶2|œ±à¹É•Ù¥•İ•‘}Ñ¥Ñ±•ññà¹‘¥É•Ñ}Ñ¥Ñ±•ññà¹ÍÁ½Ñ}Á½±¥¥•Ìü¹Ñ¥Ñ±•ñğœœ±à¹ÕÍÑ½µ•É}¹…µ•ñğœœ°Ä±à¹™¥¹…±}…µ½Õ¹Ğüıà¹‘¥É•Ñ}…µ½Õ¹Ğüıà¹ÍÁ½Ñ}Á½±¥¥•Ìü¹…µ½Õ¹ĞüüÀ±à¹ÍÑ…ÑÕÌôôô…ÁÁÉ½Ù•œüŸ®Âc²bœèŸ®¾ã®Âc²bœ±à¹ÍÑ…ÑÕÍt¥ô¤ì(€€€€€€¡•áÁ•¹Í•Íññmt¤¹™½É… ¡àôùí½¹ÍĞÀõÁµmà¹ÕÍ•É}¥‘uññíôíÉ½İÍÍØ¹ÁÕÍ ¡lŸªÂªÂAI\œ±µ½¹Ñ ±à¹•áÁ•¹Í•}‘…Ñ”±À¹ÍÑ½É•}¹…µ”±À¹¹…µ”°Ÿ²b²^®æ²j¤œ±à¹…Ñ•½Éä±à¹ÕÍÑ½µ•É}¹…µ•ñğœœ°Ä°µ9Õµ‰•È¡à¹…µ½Õ¹ÑñğÀ¤°Ÿ²Â£ªÂ@œ±à¹µ•µ½ñğœt¥ô¤ì(€€€€€½¹ÍĞÍØôqÕœ­É½İÍÍØ¹µ…À¡ÈôùÈ¹µ…À¡•ÍŒ¤¹©½¥¸ œ°œ¤¤¹©½¥¸ qÉq¸œ¤ì(€€€€€½¹ÍĞ‰±½ˆõ¹•Ü	±½ˆ¡mÍÙt±íÑåÁ”èÑ•áĞ½ÍØí¡…ÉÍ•ĞõÕÑ˜´àìô¤±ÕÉ°õUI0¹É•…Ñ•=‰©•ÑUI0¡‰±½ˆ¤±„õ‘½Õµ•¹Ğ¹É•…Ñ•±•µ•¹Ğ „œ¤ì(€€€€€„¹¡É•˜õÕÉ°í„¹‘½İ¹±½…õƒ²‚W²
ÁªÊ²šu}I]|‘íµ½¹Ñ¡ô¹ÍÙ€í‘½Õµ•¹Ğ¹‰½‘ä¹…ÁÁ•¹‘¡¥±¡„¤í„¹±¥¬ ¤í„¹É•µ½Ù” ¤íUI0¹É•Ù½­•=‰©•ÑUI0¡ÕÉ°¤ì(€€€ô…Ñ ¡”¤ìÍ¡½İ1•…å±•ÉĞ¡ƒ²‚W²
ÀI\ƒ²w²Äƒ².“¶2 è€‘í™É¥•¹‘±åÉÉ½È¡”¥õ€¤ìô(€ôì((€½¹ÍĞ‘•Ñ…¥±MÕµµ…Éäõ‘•Ñ…¥±UÍ•Èü  ¤ôùì(€€€½¹ÍĞÀõ‘•Ñ…¥±UÍ•È¹Á…åññíôì(€€€½¹ÍĞ‰…Í¥Ìõ9Õµ‰•È¡À¹µ½‰¥±•Õ…É…¹Ñ••	…Í¥ÍñğÀ¤ì(€€€½¹ÍĞ…ÁÁ±¥•õ9Õµ‰•È¡À¹Õ…É…¹Ñ••‘½µÁ½¹•¹ÑñğÀ¤ì(€€€½¹ÍĞÍÑ…¹‘…É‘‘©ÕÍÑµ•¹Ğõ5…Ñ ¹µ…à À±…ÁÁ±¥•µ‰…Í¥Ì¤ì(€€€½¹ÍĞ™É••M…±•‘©ÕÍĞô´¡9Õµ‰•È¡À¹‰Õ¹‘±•É••=™™Í•ÑñğÀ¤­9Õµ‰•È¡À¹‰Õ¹‘±•É••Y…Í=™™Í•ÑñğÀ¤¤ì(€€€É•ÑÕÉ¸l(€€€€€lŸ²b²^ƒ¶fs®>dƒ²²n@ƒ²‚W²Æœ±À¹Ñ•¹ÕÉ•A…åt°(€€€€€lŸ®ª£®ÂS²vğƒ²jSªâ#²‚pƒ²rƒ²æ`ƒ²"c²"c®0œ±À¹µ½‰¥±•A±…¹A…åt°(€€€€€lYLƒ²rƒ²æ`ƒ²"c²"c®0œ±À¹É…İY…ÍA…åt°(€€€€€lœÉ9ƒ®Ê#®Nƒ²rƒ²æ`ƒ²"c²"c®0œ±9Õµ‰•È¡À¹É…İ	Õ¹‘±”É¹‘Q½Ñ…±ñğÀ¥t°(€€€€€lŸ®²Ó®3¶2C®ƒ²‚s²fàœ±™É••M…±•‘©ÕÍÑt°(€€€€€lŸ¶*ç¶2@ƒ²jSªâ#²‚p½YLƒ²‚s²fàœ°´¡9Õµ‰•È¡À¹ÍÁ•¥…±5…ÑÉ¥á=™™Í•ÑñğÀ¤­9Õµ‰•È¡À¹ÍÁ•¥…±Y…Í=™™Í•ÑñğÀ¤¥t°(€€€€€lŸ¶*ç¶2@ƒ®2²ÊĞƒ²vã²ó¶.Ã®â0œ±À¹ÍÁ•¥…±I•Á±…•µ•¹ÑA…åt°(€€€€€lŸ²*ç²vàƒ®ª£®ÂS²vğƒ²*“¶2|œ±À¹…ÁÁÉ½Ù•‘5½‰¥±•MÁ½ÑA…åt°(€€€€€lŸ²²Æ²"c®.äœ±À¹Á½Í¥Ñ¥½¹±±½İ…¹•t°(€€€€€lŸ²ªâ$ƒªâÃ²’ ƒ®ÎÓ²‚Tœ±ÍÑ…¹‘…É‘‘©ÕÍÑµ•¹Ñt°(€€€€€lŸ²ÇªÎó®NÇªâ$ƒ®ÎÓ®#²*œ±À¹É…‘•	½¹ÕÍt°(€€€€€lŸ¶f ƒªŞã®‚#²vÓ®Npƒ²"c²"c®0œ±À¹¡½µ•É…‘•A…åt°(€€€€€lŸ¶f ƒ®.£®>
ß®ÚªÂ ƒ²"c²"c®0œ±À¹¡½µ•±…ÑA…åt°(€€€€€lŸ¶f ƒ®>g².s¶2C®“
ß®Ú²/¶Dœ±À¹¡½µ•‘‘½¹A…åt°(€€€€€lŸ²vã¶Ã®Üƒ²z³²V÷²‚Tœ±À¹É•¹•İA…åt°(€€€€€lŸ²’GªÎ€59@ƒªÊÃ¶V¤ƒ²"c²"c®0œ±À¹µ¹Á	Õ¹‘±•A…åt°(€€€€€lŸ²3®àœ±À¹Í½¹½A…åt°(€€€€€lŸªÎƒªÂw®NÇ®†tƒ®ÎÓ®#²*œ±À¹ÕÍÑI•	½¹ÕÍt°(€€€€€lŸ®{²Ú“²‚s²V ƒªÆÓ²"`œ±À¹Ñ…¥±½É•‘	½¹ÕÍt°(€€€€€lŸ®{²Ú“²‚s²V ƒªâ#²V„œ±À¹Ñ…¥±½É•‘µ½Õ¹Ñ	½¹ÕÍt°(€€€€€lŸ²*ç²vàƒ¶f ¿ªâÃ¶ ƒ²*“¶2|œ±ÍÁ½Ñ5…Ám‘•Ñ…¥±UÍ•È¹¥‘uñğÁt°(€€€€€lŸ²b²^®æ²j¤œ°´¡•áÁ•¹Í•5…Ám‘•Ñ…¥±UÍ•È¹¥‘uñğÀ¥t(€€€t¹™¥±Ñ•È ¡l±Ùt¤ôù9Õµ‰•È¡ÙñğÀ¤„ôôÀ¤ì(€ô¤ ¤émtì((€É•ÑÕÉ¸€ñ‘¥Ø±…ÍÍ9…µ”ô‰ÍÁ…”µä´Ìˆø(€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµİ¡¥Ñ”É½Õ¹‘•µá°‰½É‘•ÈÀ´Ğ™±•à©ÕÍÑ¥™äµ‰•Ñİ••¸…À´Ì¥Ñ•µÌµ•¹Ñ•Èˆø(€€€€€€ñ‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰™½¹Ğµ‰½±ˆûÂ~JÀíµ½¹Ñ¡1…‰•°¡µ½¹Ñ ¥ôƒ²‚W²
ÀƒªÊ¶€ğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ…ä´ĞÀÀµĞ´Äˆû²²nC²vƒ®"®–Ó®¦Ğƒ®
ƒ²s
ßªÎƒªÂw
ß¶2C®“¶V·®ª§®Îƒ²
Ã²ÚsªŞóªÆÃ®–ğƒ¶fW²vã¶V€ƒ²"`ƒ²z#²ZÓ²jP¸I\M[®*PƒªÂg²v ƒ²nC²Ês²zC®0ƒ®2²†Ã²j§²z®.#®.¸ğ½‘¥Øøğ½‘¥Øø(€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õí•áÁ½ÉÑI…İô±…ÍÍ9…µ”ô‰Áà´ÌÁä´ÈÉ½Õ¹‘•µ±œ‰œµ•µ•É…±´ØÀÀÑ•áĞµİ¡¥Ñ”Ñ•áĞµáÌ™½¹Ğµ‰½±ˆùI\MXğ½‰ÕÑÑ½¸ø(€€€€ğ½‘¥Øø(€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµİ¡¥Ñ”É½Õ¹‘•µá°‰½É‘•È½Ù•É™±½Üµ¡¥‘‘•¸‘¥Ù¥‘”µäˆø(€€€€€ì¡É½İÍññmt¤¹µ…À¡Èôùì(€€€€€€€½¹ÍĞÍÁ½ĞõÍÁ½Ñ5…ÁmÈ¹¥‘uñğÀ±•áÁ•¹Í”õ•áÁ•¹Í•5…ÁmÈ¹¥‘uñğÀ±¹•ĞõÈ¹Á…ä¹Ñ½Ñ…°­ÍÁ½Ğµ•áÁ•¹Í”±ÍÑ…ÑÕÌõÍÑ…ÑÕÍ5…ÁmÈ¹¥‘uñğÕ¹É•Ù¥•İ•œ±¡Äõ¡•…‘=™™¥•5…ÁmÈ¹¥‘tì(€€€€€€€½¹ÍĞ¡Å5•ÑÉ¥Ìõ¡Äı¹½Éµ…±¥é•!•…‘=™™¥•5•ÑÉ¥Ì¡¡Ä¹µ•ÑÉ¥Ì¤é¹Õ±°±¡ÅM½É”õ¡Å5•ÑÉ¥Ìı¡•…‘=™™¥•M½É•Ì¡¡Å5•ÑÉ¥Ì±½¹™¥œ±µ½¹Ñ ¤é¹Õ±°ì(€€€€€€€½¹ÍĞ¥¹ÁÕÑ!Ìõ¡Í½Õ¹Ğ¡È¹‘É…™Ğ¤±¥¹ÁÕÑM•½¹õµ…ÑÉ¥áI½İ½Õ¹Ğ¡È¹‘É…™Ğ°Ü¤­=‰©•Ğ¹Ù…±Õ•Ì¡È¹‘É…™Ğü¹‰Õ¹‘±”É¹‘ññíô¤¹É•‘Õ” ¡Ì±Ø¤ôùÌ­9Õµ‰•È¡ÙñğÀ¤°À¤ì(€€€€€€€É•ÑÕÉ¸€ñ‘¥Ø­•äõíÈ¹¥‘ô±…ÍÍ9…µ”ô‰À´Ğˆø(€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤ôù±½…‘•Ñ…¥°¡È¥ô±…ÍÍ9…µ”ô‰Üµ™Õ±°Ñ•áĞµ±•™Ğˆø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à©ÕÍÑ¥™äµ‰•Ñİ••¸…À´Ìˆøñ‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰™½¹Ğµ‰½±Ñ•áĞµÍ´ˆùíÈ¹¹…µ•ôƒ
Üí‘¥ÍÁ±…åMÑ½É•9…µ”¡È¹‰É…¹ ¥ôğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ…ä´ĞÀÀµĞ´ÄˆûªâÃ®Îàíİ½¸¡È¹Á…ä¹Ñ½Ñ…°¥ôƒ
Üƒ²*“¶2|€­íİ½¸¡ÍÁ½Ğ¥ôƒ
Üƒ®æ²j¤€µíİ½¸¡•áÁ•¹Í”¥ôğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÙ¥½±•Ğ´ÔÀÀµĞ´Äˆû²²àƒ²
Ã²Ús®
Ó²^´ƒ®ÎÓªâÀƒŠèğ½‘¥Øøğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÉ¥¡Ğˆøñ‘¥Ø±…ÍÍ9…µ”ô‰™½¹Ğµ‰½±Ñ•áĞµÙ¥½±•Ğ´ÜÀÀˆùíİ½¸¡¹•Ğ¥ôğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀˆû®æ²j¤ƒ²Â£ªÂ@ƒ¶nğ½‘¥Øøğ½‘¥Øøğ½‘¥Øø(€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€€í¡ÅM½É”üñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´ÈÉ½Õ¹‘•µ±œ‰œµ‰±Õ”´ÔÀ‰½É‘•È‰½É‘•Èµ‰±Õ”´ÄÀÀÁà´ÌÁä´ÈÑ•áĞµlÄÁÁátÑ•áĞµ‰±Õ”´àÀÀˆøñ‘¥Ø±…ÍÍ9…µ”ô‰™½¹ĞµÍ•µ¥‰½±ˆû®Îã²
°ƒ®6Ã²vÓ¶Àí¡Ä¹…Í}½™}‘…Ñ•ôƒªâÃ²’ ğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´Äˆù!Lƒ²²n@í™µÑ½Õ¹Ğ¡¥¹ÁÕÑ!Ì¥ô€¼ƒ®Îã²
°í™µÑ½Õ¹Ğ¡¡ÅM½É”¹¡Ì¥ô€ñˆø¡í¡ÅM½É”¹¡Ìµ¥¹ÁÕÑ!ÌøÀüœ¬œèœõí™µÑ½Õ¹Ğ¡¡ÅM½É”¹¡Ìµ¥¹ÁÕÑ!Ì¥ô¤ğ½ˆøƒ
Ü€É9ƒ²²n@í™µÑ½Õ¹Ğ¡¥¹ÁÕÑM•½¹¥ô€¼ƒ®Îã²
°í™µÑ½Õ¹Ğ¡¡ÅM½É”¹Í•½¹¥ô€ñˆø¡í¡ÅM½É”¹Í•½¹µ¥¹ÁÕÑM•½¹øÀüœ¬œèœõí™µÑ½Õ¹Ğ¡¡ÅM½É”¹Í•½¹µ¥¹ÁÕÑM•½¹¥ô¤ğ½ˆøğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´À¸Ôˆû²ÇªÎñ@ƒ²²n@í™µÑ9Õ´¡È¹Á…äü¹Ñ½Ñ…±A½¥¹ÑÌ°Ä¥õ@€¼ƒ®Îã²
°í™µÑ9Õ´¡¡ÅM½É”¹É…‘•A½¥¹ÑÌ°Ä¥õ@ƒ
Üƒ²w²
Ã²Äƒ²²n@í™µÑ9Õ´¡È¹Á…äü¹­Á¥M½É”°Ä¥õ@€¼ƒ®Îã²
°í™µÑ9Õ´¡¡ÅM½É”¹­Á¥M½É”°Ä¥õ@ğ½‘¥Øøğ½‘¥Øøèñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´ÈÑ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ÌÀÀˆû®Îã²
°ƒ®6Ã²vÓ¶Àƒ®¾ã®NÇ®†tƒ
Üƒ²²n@ƒ²z®‚”ƒªâÃ²’²ró®†pƒªÊ¶€ğ½‘¥Øùô(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É¥É¥µ½±Ì´Ğ…À´ÄµĞ´Ìˆø(€€€€€€€€€€€ímlÕ¹É•Ù¥•İ•œ°Ÿ®¾ãªÊ¶€t±lÉ•Ù¥•İ¥¹œœ°ŸªÊ¶ƒ²’Dt±l¡•­•œ°Ÿ¶fW²vã²f®0t±l™¥¹…°œ°Ÿ²‚W²
Ã¶fW²‚Tut¹µ…À ¡m¬±±t¤ôøñ‰ÕÑÑ½¸­•äõí­ô½¹±¥¬õì ¤ôùÍ•ÑMÑ…ÑÕÌ¡È¹¥±¬¥ô±…ÍÍ9…µ”õíÁä´Ä¸ÔÉ½Õ¹‘•Ñ•áĞµlÄÁÁát™½¹ĞµÍ•µ¥‰½±€‘íÍÑ…ÑÕÌôôõ¬ü‰œµÙ¥½±•Ğ´ØÀÀÑ•áĞµİ¡¥Ñ”œè‰œµÉ…ä´ÔÀÑ•áĞµÉ…ä´ÔÀÀõôùí±ôğ½‰ÕÑÑ½¸ø¥ô(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€ğ½‘¥Øø(€€€€€ô¥ô(€€€€ğ½‘¥Øø(€€€í‘•Ñ…¥±UÍ•È˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰™¥á•¥¹Í•Ğ´ÀèµlàÁt‰œµ‰±…¬¼ĞÀ™±•à¥Ñ•µÌµ•¹µé¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ•¹Ñ•ÈÀ´ÀµéÀ´Ğˆ½¹±¥¬õì ¤ôùÍ•Ñ•Ñ…¥±UÍ•È¡¹Õ±°¥ôø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµİ¡¥Ñ”Üµ™Õ±°µéµ…àµÜ´Õá°µ…àµ µläÉÙ¡tÉ½Õ¹‘•µĞ´Éá°µéÉ½Õ¹‘•´Éá°½Ù•É™±½Üµ¡¥‘‘•¸™±•à™±•àµ½°ˆ½¹±¥¬õí”ôù”¹ÍÑ½ÁAÉ½Á……Ñ¥½¸ ¥ôø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰À´Ğ‰½É‘•Èµˆ™±•à©ÕÍÑ¥™äµ‰•Ñİ••¸¥Ñ•µÌµÍÑ…ÉĞˆøñ‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰™½¹Ğµ‰½±ˆùí‘•Ñ…¥±UÍ•È¹¹…µ•ôƒ
Üíµ½¹Ñ¡1…‰•°¡µ½¹Ñ ¥ôƒ²²àƒ²‚W²
Àƒ²nC²z”ğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ…ä´ĞÀÀµĞ´Äˆû®
ƒ²p€¼ƒªÎƒªÂw®ª€¼ƒªÂ²zªÖ³®Ú€¼ƒ®>#²vĞƒ®Âs²w¶Vpƒ¶V·®ª¤€¼ƒ²‚²j§ªâ#²V„ğ½‘¥Øøğ½‘¥Øøñ‰ÕÑÑ½¸½¹±¥¬õì ¤ôùÍ•Ñ•Ñ…¥±UÍ•È¡¹Õ±°¥ô±…ÍÍ9…µ”ô‰Ñ•áĞµÉ…ä´ĞÀÀÑ•áĞµá°ˆû\ğ½‰ÕÑÑ½¸øğ½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰½Ù•É™±½Üµ…ÕÑ¼ˆø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰À´Ğ‰œµÙ¥½±•Ğ´ÔÀ‰½É‘•Èµˆˆø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌ™½¹Ğµ‰½±Ñ•áĞµÙ¥½±•Ğ´ÜÀÀµˆ´Èˆû²Ös²Šƒ²ªâ$ƒªÖ³²Äğ½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É¥É¥µ½±Ì´ÈµéÉ¥µ½±Ì´Ì…À´Èˆùí‘•Ñ…¥±MÕµµ…Éä¹µ…À ¡m°±Ùt¤ôøñ‘¥Ø­•äõí±ô±…ÍÍ9…µ”ô‰‰œµİ¡¥Ñ”É½Õ¹‘•µ±œ‰½É‘•ÈÀ´È™±•à©ÕÍÑ¥™äµ‰•Ñİ••¸…À´ÈÑ•áĞµáÌˆøñÍÁ…¸ùí±ôğ½ÍÁ…¸øñˆùíØøôÀüœ¬œèœõíİ½¸¡Ø¥ôğ½ˆøğ½‘¥Øø¥ôğ½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´Ì™±•à©ÕÍÑ¥™äµ‰•Ñİ••¸™½¹Ğµ‰½±Ñ•áĞµÍ´ˆøñÍÁ…¸û²Ös²ŠƒªÊ¶ƒªâ#²V„ğ½ÍÁ…¸øñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµÙ¥½±•Ğ´ÜÀÀˆùíİ½¸¡‘•Ñ…¥±UÍ•È¹Á…ä¹Ñ½Ñ…°¬¡ÍÁ½Ñ5…Ám‘•Ñ…¥±UÍ•È¹¥‘uñğÀ¤´¡•áÁ•¹Í•5…Ám‘•Ñ…¥±UÍ•È¹¥‘uñğÀ¤¥ôğ½ÍÁ…¸øğ½‘¥Øø(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€í‘•Ñ…¥±1½…‘¥¹œüñ‘¥Ø±…ÍÍ9…µ”ô‰À´ÄÀÑ•áĞµ•¹Ñ•ÈÑ•áĞµÍ´Ñ•áĞµÉ…ä´ĞÀÀˆû²²àƒ®
Ó²^·²vƒ®Ú#®~³²b“®*Pƒ²’D¸¸¸ğ½‘¥Øøé‘•Ñ…¥±I½İÌ¹±•¹Ñ ôôôÀüñ‘¥Ø±…ÍÍ9…µ”ô‰À´ÄÀÑ•áĞµ•¹Ñ•ÈÑ•áĞµÍ´Ñ•áĞµÉ…ä´ĞÀÀˆûªÎƒªÂw®Îƒ¶2C®ƒªâÃ®†w²vĞƒ²^²ZÓ²jP¸ƒªÖ³®Ê²‚ƒ²GªÎƒ².“²‚²v ƒ²rƒ²Ös²Šƒ²ªâ$ƒªÖ³²Ç²^C²pƒ¶fW²vã¶V€ƒ²"`ƒ²z#²ZÓ²jP¸ğ½‘¥Øøèñ‘¥Ø±…ÍÍ9…µ”ô‰‘¥Ù¥‘”µäˆø(€€€€€€€€€€€í‘•Ñ…¥±I½İÌ¹µ…À ¡à±¤¤ôøñ‘¥Ø­•äõí€‘íà¹‘…Ñ•ô´‘í¥õô±…ÍÍ9…µ”ô‰À´ÌÉ¥É¥µ½±ÌµlÜÉÁá|Å™É}…ÕÑ½tµéÉ¥µ½±ÌµläÁÁá|ÄĞÁÁá|ÄÔÁÁá|Å™É|ÄÈÁÁát…À´È¥Ñ•µÌµ•¹Ñ•ÈÑ•áĞµáÌˆø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÉ…ä´ÔÀÀˆùíMÑÉ¥¹œ¡à¹‘…Ñ•ñğœœ¤¹Í±¥” Ô¥ôğ½‘¥Øø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™½¹ĞµÍ•µ¥‰½±ÑÉÕ¹…Ñ”ˆùíà¹ÕÍÑ½µ•Éôğ½‘¥Øø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰¡¥‘‘•¸µé‰±½¬Ñ•áĞµÉ…ä´ÔÀÀˆùíà¹ÑåÁ•ôğ½‘¥Øø(€€€€€€€€€€€€€€ñ‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰™½¹Ğµµ•‘¥Õ´ˆùíà¹¥Ñ•µôğ½‘¥Øùíà¹¹½Ñ”˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀµĞ´À¸Ôˆùíà¹¹½Ñ•ôğ½‘¥Øùôğ½‘¥Øø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÑ•áĞµÉ¥¡Ğ™½¹Ğµ‰½±€‘í9Õµ‰•È¡à¹…µ½Õ¹Ğ¤ğÀüÑ•áĞµÉ•´ÔÀÀœé9Õµ‰•È¡à¹…µ½Õ¹Ğ¤øÀüÑ•áĞµÙ¥½±•Ğ´ÜÀÀœèÑ•áĞµÉ…ä´ĞÀÀõôùíà¹…µ½Õ¹Ğôôõ¹Õ±°üŸªâ#²V‡²v ƒ²nPƒ¶V§²
Àƒ®Âc²bœé€‘í9Õµ‰•È¡à¹…µ½Õ¹Ğ¤øÀüœ¬œèœô‘íİ½¸¡à¹…µ½Õ¹Ğ¥õôğ½‘¥Øø(€€€€€€€€€€€€ğ½‘¥Øø¥ô(€€€€€€€€€€ğ½‘¥Øùô(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰À´ĞÑ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀ‰œµÉ…ä´ÔÀˆûŠìƒªÎƒªÂw®Îƒ²nC²z—²v ƒ¶b²z°ƒªÎƒªÂw®Îƒ¶2C®“®†pƒ²‚²z—®BpƒªÆÓ²vƒªâÃ²’²ró®†pƒ®ÎÓ²^³²’7®.#®.¸ƒ²b²^¶fs®>g²²nC
ß²Ös²‚®ÎÓ²z—
ß¶f ƒªŞã®‚#²vÓ®Ns²Êc®~ğƒ²nPƒ®"²‚ƒ²†ÃªÆÓ²ró®†pƒªÊÃ²‚W®Bc®*Pƒªâ#²V‡²v ƒ²®. ƒŠc²Ös²Šƒ²ªâ$ƒªÖ³²ÇŠg²^C²pƒ®Î®>®†pƒ®2²†Ã¶V§®.#®.¸ğ½‘¥Øø(€€€€€€€€ğ½‘¥Øø(€€€€€€ğ½‘¥Øø(€€€€ğ½‘¥Øùô(€€ğ½‘¥Øøì)ô()™Õ¹Ñ¥½¸‘…¥±å…±•¹‘…É5•ÑÉ¥Ì¡É…Ü¥ì(€½¹ÍĞõ¹½Éµ…±¥é•…ä¡É…Ü¤ì(€½¹ÍĞ½É”õ…±•¹‘…É½É•5•ÑÉ¥Ì¡É…Ü¤ì(€½¹ÍĞ¡Ìõ½É”¹¡Ìì(€½¹ÍĞÍ¥´õ½É”¹Í¥´ì(€½¹ÍĞ¡½µ”õ½É”¹¡½µ”ì(€½¹ÍĞÍ•½¹ô¡¹µ…ÑÉ¥àü¹lİuññmt¤¹É•‘Õ” ¡„±Ø¤ôù„­9Õµ‰•È¡ÙñğÀ¤°À¤­=‰©•Ğ¹Ù…±Õ•Ì¡¹É½ÕÁÌü¹‰Õ¹‘±”É¹‘ññíô¤¹É•‘Õ” ¡„±Ø¤ôù„­9Õµ‰•È¡ÙñğÀ¤°À¤ì(€½¹ÍĞ™É•”õ9Õµ‰•È¡¹É½ÕÁÌü¹¡½µ•±…Ğü¹ÑÙÉ••ñğÀ¤ì(€½¹ÍĞÍµ…ÉĞõ9Õµ‰•È¡¹É½ÕÁÌü¹¡½µ•±…Ğü¹Íµ…ÉÑ!½µ•ñğÀ¤ì(€½¹ÍĞÑ…¥±½É•õ9Õµ‰•È¡¹Ñ…¥±½É•‘½Õ¹ÑñğÀ¤ì(€½¹ÍĞÑ…¥±½É•‘µ½Õ¹Ğõ9Õµ‰•È¡¹Ñ…¥±½É•‘µ½Õ¹ÑñğÀ¤ì(€½¹ÍĞÍ½¹¼õ=‰©•Ğ¹Ù…±Õ•Ì¡¹É½ÕÁÌü¹Í½¹½ññíô¤¹É•‘Õ” ¡„±Ø¤ôù„­9Õµ‰•È¡ÙñğÀ¤°À¤ì(€É•ÑÕÉ¸í¡Ì±Í¥´±¡½µ”±Í•½¹±™É•”±Íµ…ÉĞ±Ñ…¥±½É•±Ñ…¥±½É•‘µ½Õ¹Ğ±Í½¹¼±¡…Ìé‘…å!…Í…Ñ„¡¤±½™˜è„…¹‘…å=™™ôì)ô()™Õ¹Ñ¥½¸…¥±å	É¥•™¥¹A…¹•°¡íµ½¹Ñ ±É½İÌõmt±‘…¥±åI•½É‘Ìõíô±•µÁ±½å••Ìõmt±…ÕÑ¡UÍ•É%ôœô¥ì(€½¹ÍĞ‘•™…Õ±Ñ…äô ¤ôùì(€€€½¹ÍĞ¹½Üõ¹•Ü…Ñ” ¤±å•ÍÑ•É‘…äõ¹•Ü…Ñ”¡¹½Ü¹•ÑÕ±±e•…È ¤±¹½Ü¹•Ñ5½¹Ñ  ¤±¹½Ü¹•Ñ…Ñ” ¤´Ä¤ì(€€€¥˜¡µ½¹Ñ¡-•å=˜¡å•ÍÑ•É‘…ä¤ôôõµ½¹Ñ ¥É•ÑÕÉ¸MÑÉ¥¹œ¡å•ÍÑ•É‘…ä¹•Ñ…Ñ” ¤¤¹Á…‘MÑ…ÉĞ È°œÀœ¤ì(€€€¥˜¡µ½¹Ñ ñµ½¹Ñ¡-•å=˜¡¹½Ü¤¥É•ÑÕÉ¸MÑÉ¥¹œ¡‘…åÍ%¹5½¹Ñ ¡µ½¹Ñ ¤¤¹Á…‘MÑ…ÉĞ È°œÀœ¤ì(€€€É•ÑÕÉ¸€œÀÄœì(€ôì(€½¹ÍĞmÍ•±•Ñ•‘…ä±Í•ÑM•±•Ñ•‘…åtõÕÍ•MÑ…Ñ”¡‘•™…Õ±Ñ…ä¤ì(€½¹ÍĞmÍÑ½É•-•ä±Í•ÑMÑ½É•-•åtõÕÍ•MÑ…Ñ” …±°œ¤ì(€½¹ÍĞm½…±I½İÌ±Í•Ñ½…±I½İÍtõÕÍ•MÑ…Ñ”¡mt¤ì(€½¹ÍĞmÍ¡•‘Õ±•I½İÌ±Í•ÑM¡•‘Õ±•I½İÍtõÕÍ•MÑ…Ñ”¡íÑ…Í­Ìémt±¡½µ•Ìémt±ÕÍÑ½µ•ÉÌémuô¤ì(€½¹ÍĞm±½…‘¥¹œ±Í•Ñ1½…‘¥¹tõÕÍ•MÑ…Ñ”¡ÑÉÕ”¤ì(€½¹ÍĞmÉ•µ¥¹‘•ÉM•¹‘¥¹œ±Í•ÑI•µ¥¹‘•ÉM•¹‘¥¹tõÕÍ•MÑ…Ñ”¡™…±Í”¤ì(€ÕÍ•™™•Ğ  ¤ôùíÍ•ÑM•±•Ñ•‘…ä¡‘•™…Õ±Ñ…ä ¤¤íÍ•ÑMÑ½É•-•ä …±°œ¥ô±mµ½¹Ñ¡t¤ì€¼¼•Í±¥¹Ğµ‘¥Í…‰±”µ±¥¹”(€ÕÍ•™™•Ğ  ¤ôùì(€€€±•Ğ…±¥Ù”õÑÉÕ”ì(€€€€¡…Íå¹Œ ¤ôùì(€€€€€Í•Ñ1½…‘¥¹œ¡ÑÉÕ”¤ì(€€€€€½¹ÍĞ•µÁ±½å••%‘Ìô¡•µÁ±½å••Íññmt¤¹µ…À¡•µÀôù•µÀ¹¥¤¹™¥±Ñ•È¡	½½±•…¸¤ì(€€€€€½¹ÍĞmí‘…Ñ„±•ÉÉ½Éô±Ñ…Í­I•ÍÕ±Ğ±¡½µ•I•ÍÕ±Ğ±ÕÍÑ½µ•ÉI•ÍÕ±Ñtõ…İ…¥ĞAÉ½µ¥Í”¹…±°¡l(€€€€€€€ÍÕÁ…‰…Í”¹™É½´ ÍÑ½É•}½…±Ìœ¤¹Í•±•Ğ ÍÑ½É•}¹…µ”±½µÁ…¹å}½…±Ì±¡…±±•¹•}½…±Ìœ¤¹•Ä µ½¹Ñ œ±µ½¹Ñ ¤°(€€€€€€€•µÁ±½å••%‘Ì¹±•¹Ñ ıÍÕÁ…‰…Í”¹™É½´ ÕÍÑ½µ•É}Ñ…Í­Ìœ¤¹Í•±•Ğ ¥±ÕÍ•É}¥±ÕÍÑ½µ•É}¥±Ñ¥Ñ±”±‘Õ•}‘…Ñ”±ÍÑ…ÑÕÌœ¤¹¥¸ ÕÍ•É}¥œ±•µÁ±½å••%‘Ì¤éAÉ½µ¥Í”¹É•Í½±Ù”¡í‘…Ñ„émuô¤°(€€€€€€€•µÁ±½å••%‘Ì¹±•¹Ñ ıÍÕÁ…‰…Í”¹™É½´ ¡½µ•}½É‘•ÉÌœ¤¹Í•±•Ğ ¥±ÕÍ•É}¥±ÕÍÑ½µ•É}¥±ÕÍÑ½µ•É}¹…µ”±Á±…¹¹•‘}¥¹ÍÑ…±±}‘…Ñ”±ÍÑ…ÑÕÌ±Í½ÕÉ•}İ½É­}‘…Ñ”œ¤¹¥¸ ÕÍ•É}¥œ±•µÁ±½å••%‘Ì¤éAÉ½µ¥Í”¹É•Í½±Ù”¡í‘…Ñ„émuô¤°(€€€€€€€•µÁ±½å••%‘Ì¹±•¹Ñ ıÍÕÁ…‰…Í”¹™É½´ ÕÍÑ½µ•ÉÌœ¤¹Í•±•Ğ ¥±ÕÍ•É}¥±ÕÍÑ½µ•É}¹…µ”œ¤¹¥¸ ÕÍ•É}¥œ±•µÁ±½å••%‘Ì¤éAÉ½µ¥Í”¹É•Í½±Ù”¡í‘…Ñ„émuô¤°(€€€€€t¤ì(€€€€€¥˜ ……±¥Ù”¥É•ÑÕÉ¸ì(€€€€€½¹ÍĞÍ¡•‘Õ±•ÉÉ½ÈõÑ…Í­I•ÍÕ±Ğ¹•ÉÉ½Éññ¡½µ•I•ÍÕ±Ğ¹•ÉÉ½ÉññÕÍÑ½µ•ÉI•ÍÕ±Ğ¹•ÉÉ½Èì(€€€€€¥˜¡•ÉÉ½ÉññÍ¡•‘Õ±•ÉÉ½È¥Í¡½İ1•…å±•ÉĞ¡ƒ®â3®š³¶VDƒ²zC®0ƒ®Ú#®~³²b“ªâÀƒ².“¶2 è€‘í™É¥•¹‘±åÉÉ½È¡•ÉÉ½ÉññÍ¡•‘Õ±•ÉÉ½È¥õ€¤ì(€€€€€Í•Ñ½…±I½İÌ¡‘…Ñ…ññmt¤ì(€€€€€Í•ÑM¡•‘Õ±•I½İÌ¡íÑ…Í­ÌéÑ…Í­I•ÍÕ±Ğ¹‘…Ñ…ññmt±¡½µ•Ìé¡½µ•I•ÍÕ±Ğ¹‘…Ñ…ññmt±ÕÍÑ½µ•ÉÌéÕÍÑ½µ•ÉI•ÍÕ±Ğ¹‘…Ñ…ññmuô¤ì(€€€€€Í•Ñ1½…‘¥¹œ¡™…±Í”¤ì(€€€ô¤ ¤ì(€€€É•ÑÕÉ¸ ¤ôùí…±¥Ù”õ™…±Í•ôì(€ô±mµ½¹Ñ ±•µÁ±½å••Ì¹µ…À¡•µÀôù•µÀ¹¥¤¹©½¥¸ ğœ¥t¤ì€¼¼•Í±¥¹Ğµ‘¥Í…‰±”µ±¥¹”((€½¹ÍĞ½…±5…Àõ=‰©•Ğ¹™É½µ¹ÑÉ¥•Ì¡½…±I½İÌ¹µ…À¡É½ÜôùmÉ½Ü¹ÍÑ½É•}¹…µ”±É•Í½±Ù•MÑ½É•	É¥•™¥¹½…±Ì¡ì(€€€‘•™…Õ±ÑÌé½µÁ…¹å½…±•™…Õ±ÑÌ¡É½Ü¹ÍÑ½É•}¹…µ”¤°(€€€½µÁ…¹å½…±ÌéÉ½Ü¹½µÁ…¹å}½…±Ì°(€€€¡…±±•¹•½…±ÌéÉ½Ü¹¡…±±•¹•}½…±Ì°(€ô¥t¤¤ì(€½¹ÍĞ‰É…¹¡•ÌõÍ½ÉÑMÑ½É•Í	å=Á•¹=É‘•È¡l¸¸¹¹•ÜM•Ğ ¡•µÁ±½å••Íññmt¤¹µ…À¡•µÀôù•µÀ¹‰É…¹ ¤¹™¥±Ñ•È¡	½½±•…¸¤¹™¥±Ñ•È¡‰É…¹ ôø…9=9}M1M}MQ=IL¹¥¹±Õ‘•Ì¡‰É…¹ ¤¤¥t¤ì(€½¹ÍĞÉ•Á½ÉÑ…äõ5…Ñ ¹µ…à Ä±9Õµ‰•È¡Í•±•Ñ•‘…åñğÄ¤¤ì(€½¹ÍĞ™½É•…ÍÑ…Ñ½Èõµ½¹Ñ¡-•å=˜¡¹•Ü…Ñ” ¤¤ôôõµ½¹Ñ ı‘…åÍ%¹5½¹Ñ ¡µ½¹Ñ ¤½É•Á½ÉÑ…äèÄì(€½¹ÍĞ‘…Ñ•1…‰•°õ€‘í9Õµ‰•È¡µ½¹Ñ ¹Í±¥” Ô°Ü¤¥÷²nP€‘íÉ•Á½ÉÑ…å÷²vñ€ì(€½¹ÍĞ‰É¥•™¥¹9½Üõ¹•Ü…Ñ” ¤ì(€½¹ÍĞÑ½‘…äõ€‘íµ½¹Ñ¡-•å=˜¡‰É¥•™¥¹9½Ü¥ô´‘íMÑÉ¥¹œ¡‰É¥•™¥¹9½Ü¹•Ñ…Ñ” ¤¤¹Á…‘MÑ…ÉĞ È°œÀœ¥õ€ì(€½¹ÍĞ•µÁ±½å••5…Àõ=‰©•Ğ¹™É½µ¹ÑÉ¥•Ì ¡•µÁ±½å••Íññmt¤¹µ…À¡•µÀôùm•µÀ¹¥±•µÁt¤¤ì(€½¹ÍĞÕÍÑ½µ•É5…Àõ=‰©•Ğ¹™É½µ¹ÑÉ¥•Ì¡Í¡•‘Õ±•I½İÌ¹ÕÍÑ½µ•ÉÌ¹µ…À¡ÕÍÑ½µ•ÈôùmÕÍÑ½µ•È¹¥±ÕÍÑ½µ•Ét¤¤ì(€½¹ÍĞ…Ñ¥Ù•Q…Í­ÌõÍ¡•‘Õ±•I½İÌ¹Ñ…Í­Ì¹™¥±Ñ•È¡Ñ…Í¬ôùÑ…Í¬¹ÍÑ…ÑÕÌ„ôô½µÁ±•Ñ•œ˜™Ñ…Í¬¹ÍÑ…ÑÕÌ„ôô…¹•±±•œ¤ì(€½¹ÍĞÁ•¹‘¥¹!½µ•	Õ¹‘±•Ìõ¹•Ü5…À ¤ì(€Í¡•‘Õ±•I½İÌ¹¡½µ•Ì¹™¥±Ñ•È¡½É‘•Èôù½É‘•È¹ÍÑ…ÑÕÌ„ôô½µÁ±•Ñ•œ˜™½É‘•È¹ÍÑ…ÑÕÌ„ôô…¹•±±•œ¤¹™½É… ¡½É‘•Èôùì(€€€½¹ÍĞ­•äõ€‘í½É‘•È¹ÕÍ•É}¥‘õğ‘í½É‘•È¹Í½ÕÉ•}İ½É­}‘…Ñ•ñğœõğ‘í½É‘•È¹ÕÍÑ½µ•É}¥‘ññ½É‘•È¹ÕÍÑ½µ•É}¹…µ•ññ½É‘•È¹¥‘õ€ì(€€€¥˜ …Á•¹‘¥¹!½µ•	Õ¹‘±•Ì¹¡…Ì¡­•ä¤¥Á•¹‘¥¹!½µ•	Õ¹‘±•Ì¹Í•Ğ¡­•ä±½É‘•È¤ì(€ô¤ì(€½¹ÍĞÁ•¹‘¥¹!½µ•Ìõl¸¸¹Á•¹‘¥¹!½µ•	Õ¹‘±•Ì¹Ù…±Õ•Ì ¥tì(€½¹ÍĞµ•ÑÉ¥•™Ìõl(€€€í­•äè¡Ìœ±±…‰•°è!Lœ±Õ¹¥Ğè½Õ¹Ğœ±½…°è¡œ¤ôùœ¹¡Íô°(€€€í­•äèÍ¥µ5¹Àœ±±…‰•°èM%459@œ±Õ¹¥Ğè½Õ¹Ğœ±½…°è¡œ¤ôùœ¹Í¥µ5¹Áô°(€€€í­•äèÍ•½¹œ±±…‰•°èœÉ9œ±Õ¹¥Ğè½Õ¹Ğœ±½…°è¡œ¤ôùœ¹Í•½¹‘ô°(€€€í­•äèÁÉ½‘ÕÑ¥Ù¥Ñäœ±±…‰•°èŸ²w²
Ã²Äœ±Õ¹¥ĞèÁ½¥¹Ğœ±½…°è¡œ¤ôùœ¹ÁÉ½‘ÕÑ¥Ù¥Ñåññœ¹­Á¥ô°(€€€í­•äè¡½µ”œ±±…‰•°èŸ¶f œ±Õ¹¥Ğè½Õ¹Ğœ±½…°è¡œ¤ôùœ¹¡½µ•ô°(€€€í­•äè™É•”œ±±…‰•°èŸ¶R®š°œ±Õ¹¥Ğè½Õ¹Ğœ±½…°è¡œ¤ôùœ¹ÑÙÉ••ññœ¹™É••ô°(€€€í­•äèÍµ…ÉĞœ±±…‰•°èŸ²*“¶f œ±Õ¹¥Ğè½Õ¹Ğœ±½…°è¡œ¤ôùœ¹Íµ…ÉÑ!½µ•ññœ¹Íµ…ÉÑô°(€€€í­•äèÍ½¹¼œ±±…‰•°èŸ²3®àœ±Õ¹¥Ğè½Õ¹Ğœ±½…°è¡œ¤ôùœ¹Í½¹½ô°(€€€í­•äèÕÁÍ•±±µ½Õ¹Ğœ±±…‰•°èŸ®{²Ú“²‚s²V ƒ®“²Ús²V„œ±Õ¹¥Ğèİ½¸œ±½…°è¡œ¤ôùœ¹Ñ…¥±½É•‘µ½Õ¹Ñô°(€€€í­•äèÕÁÍ•±°œ±±…‰•°èŸ²^²ªÆĞœ±Õ¹¥Ğè½Õ¹Ğœ±½…°è¡œ¤ôùœ¹Ñ…¥±½É•‘½Õ¹Ñññœ¹Ñ…¥±½É•‘ô°(€tì(€½¹ÍĞ™µÑ	É¥•™Y…±Õ”ô¡µ•ÑÉ¥Œ±Ù…±Õ”¤ôùµ•ÑÉ¥Œ¹Õ¹¥Ğôôôİ½¸œıİ½¸¡5…Ñ ¹É½Õ¹¡Ù…±Õ”¤¤éµ•ÑÉ¥Œ¹Õ¹¥ĞôôôÁ½¥¹Ğœı€‘í™µÑ9Õ´¡Ù…±Õ”°Ä¥õA€é€‘í™µÑ9Õ´¡Ù…±Õ”±9Õµ‰•È¡Ù…±Õ”¤”ÄüÄèÀ¥÷ªÆÑ€ì(€½¹ÍĞ‰É¥•™¥¹MÑ½É•Ìõ‰É…¹¡•Ì¹µ…À¡‰É…¹ ôùì(€€€½¹ÍĞµ•µ‰•ÉÌô¡•µÁ±½å••Íññmt¤¹™¥±Ñ•È¡•µÀôù•µÀ¹‰É…¹ ôôõ‰É…¹ ¤ì(€€€½¹ÍĞÍÑ½É•I½İÌô¡É½İÍññmt¤¹™¥±Ñ•È¡É½ÜôùÉ½Ü¹‰É…¹ ôôõ‰É…¹ ¤ì(€€€½¹ÍĞ½…°õ½…±5…Ám‰É…¹¡uññ½µÁ…¹å½…±•™…Õ±ÑÌ¡‰É…¹ ¤ì(€€€½¹ÍĞ¥¹ÁÕÑI½İÌõµ•µ‰•ÉÌ¹µ…À¡•µÀôùì(€€€€€½¹ÍĞÉ…Üõ‘…¥±åI•½É‘Ìü¹m•µÀ¹¥‘tü¹mÍ•±•Ñ•‘…åtì(€€€€€½¹ÍĞõ¹½Éµ…±¥é•…ä¡É…Ü¤±‘…¥±äõ‘…¥±å…±•¹‘…É5•ÑÉ¥Ì¡É…Ü¤ì(€€€€€½¹ÍĞÍÑ…ÑÕÌõ‘…¥±å%¹ÁÕÑMÑ…ÑÕÌ¡í‘…å=™˜é¹‘…å=™˜±¡…ÍA•É™½Éµ…¹”é‘…å!…ÍA•É™½Éµ…¹•…Ñ„¡É…Ü¤±é•É½½¹™¥Éµ•é¹¥¹ÁÕÑ½¹™¥Éµ•‘ô¤ì(€€€€€½¹ÍĞÁ…ÉÑÌõml!Lœ±‘…¥±ä¹¡Ít±lM%459@œ±‘…¥±ä¹Í¥µt±lœÉ9œ±‘…¥±ä¹Í•½¹‘t±lŸ¶f œ±‘…¥±ä¹¡½µ•t±lŸ¶R®š°œ±‘…¥±ä¹™É••t±lŸ²*“¶f œ±‘…¥±ä¹Íµ…ÉÑt±lŸ²3®àœ±‘…¥±ä¹Í½¹½t±lŸ²^² œ±‘…¥±ä¹Ñ…¥±½É•‘ut¹™¥±Ñ•È ¡l±Ù…±Õ•t¤ôù9Õµ‰•È¡Ù…±Õ”¤øÀ¤¹µ…À ¡m±…‰•°±Ù…±Õ•t¤ôù€‘í±…‰•±ô€‘í™µÑ9Õ´¡Ù…±Õ”±9Õµ‰•È¡Ù…±Õ”¤”ÄüÄèÀ¥õ€¤ì(€€€€€É•ÑÕÉ¸íÕÍ•É%é•µÀ¹¥±¹…µ”é•µÀ¹¹…µ”±ÍÑ…ÑÕÌ±ÍÕµµ…ÉäéÁ…ÉÑÌ¹±•¹Ñ ıÁ…ÉÑÌ¹©½¥¸ œƒ
Ü€œ¤èŸªâÃ¶ ƒ².“²‚ƒ²z®‚”ôì(€€€ô¤ì(€€€½¹ÍĞµ•ÑÉ¥Ìõµ•ÑÉ¥•™Ì¹µ…À¡‘•˜ôø¡ì(€€€€€­•äé‘•˜¹­•ä±±…‰•°é‘•˜¹±…‰•°±Õ¹¥Ğé‘•˜¹Õ¹¥Ğ°(€€€€€€¸¸¹ÁÉ½©•Ñ5•ÑÉ¥Œ¡íÕÉÉ•¹ĞéÍÑ½É•5•ÑÉ¥É½µI½İÌ¡ÍÑ½É•I½İÌ±‘•˜¹­•ä¤±Ñ…É•Ğé9Õµ‰•È¡‘•˜¹½…°¡½…°¥ñğÀ¤±™…Ñ½Èé™½É•…ÍÑ…Ñ½Éô¤°(€€€ô¤¤ì(€€€½¹ÍĞµ•µ‰•É%‘Ìõ¹•ÜM•Ğ¡µ•µ‰•ÉÌ¹µ…À¡•µÀôù•µÀ¹¥¤¤ì(€€€½¹ÍĞÑ½‘…åQ…Í­Ìõ…Ñ¥Ù•Q…Í­Ì¹™¥±Ñ•È¡Ñ…Í¬ôùµ•µ‰•É%‘Ì¹¡…Ì¡Ñ…Í¬¹ÕÍ•É}¥¤˜™Ñ…Í¬¹‘Õ•}‘…Ñ”ôôõÑ½‘…ä¤¹µ…À¡Ñ…Í¬ôø¡ì(€€€€€€¸¸¹Ñ…Í¬±•µÁ±½å••9…µ”é•µÁ±½å••5…ÁmÑ…Í¬¹ÕÍ•É}¥‘tü¹¹…µ•ñğœœ±ÕÍÑ½µ•É9…µ”éÕÍÑ½µ•É5…ÁmÑ…Í¬¹ÕÍÑ½µ•É}¥‘tü¹ÕÍÑ½µ•É}¹…µ•ñğŸªÎƒªÂw®ªƒ®¾ã²z®‚”œ°(€€€ô¤¤ì(€€€½¹ÍĞ¡½µ•I½İÌõÁ•¹‘¥¹!½µ•Ì¹™¥±Ñ•È¡½É‘•Èôùµ•µ‰•É%‘Ì¹¡…Ì¡½É‘•È¹ÕÍ•É}¥¤¤¹µ…À¡½É‘•Èôø¡ì(€€€€€€¸¸¹½É‘•È±•µÁ±½å••9…µ”é•µÁ±½å••5…Ám½É‘•È¹ÕÍ•É}¥‘tü¹¹…µ•ñğœœ±ÕÍÑ½µ•É9…µ”é½É‘•È¹ÕÍÑ½µ•É}¹…µ•ññÕÍÑ½µ•É5…Ám½É‘•È¹ÕÍÑ½µ•É}¥‘tü¹ÕÍÑ½µ•É}¹…µ•ñğŸªÎƒªÂw®ªƒ®¾ã²z®‚”œ±Á±…¹¹•‘…Ñ”éMÑÉ¥¹œ¡½É‘•È¹Á±…¹¹•‘}¥¹ÍÑ…±±}‘…Ñ•ñğœœ¤¹Í±¥” À°ÄÀ¤°(€€€ô¤¤ì(€€€½¹ÍĞÑ½‘…å%¹ÍÑ…±±Ìõ¡½µ•I½İÌ¹™¥±Ñ•È¡½É‘•Èôù½É‘•È¹Á±…¹¹•‘…Ñ”ôôõÑ½‘…ä¤ì(€€€½¹ÍĞ½Ù•É‘Õ•%¹ÍÑ…±±Ìõ¡½µ•I½İÌ¹™¥±Ñ•È¡½É‘•Èôù¥Í	É¥•™¥¹5½¹Ñ¡=Ù•É‘Õ•!½µ”¡½É‘•È±µ½¹Ñ ±Ñ½‘…ä¤¤ì(€€€É•ÑÕÉ¸íÍÑ½É•9…µ”é‘¥ÍÁ±…åMÑ½É•9…µ”¡‰É…¹ ¤±‰É…¹ ±¥¹ÁÕÑI½İÌ±µ•ÑÉ¥Ì±Ñ½‘…åQ…Í­Ì±Ñ½‘…å%¹ÍÑ…±±Ì±½Ù•É‘Õ•%¹ÍÑ…±±Íôì(€ô¤ì(€½¹ÍĞÙ¥Í¥‰±•MÑ½É•ÌõÍÑ½É•-•äôôô…±°œı‰É¥•™¥¹MÑ½É•Ìé‰É¥•™¥¹MÑ½É•Ì¹™¥±Ñ•È¡ÍÑ½É”ôùÍÑ½É”¹‰É…¹ ôôõÍÑ½É•-•ä¤ì(€½¹ÍĞ…±±%¹ÁÕÑI½İÌõ‰É¥•™¥¹MÑ½É•Ì¹™±…Ñ5…À¡ÍÑ½É”ôùÍÑ½É”¹¥¹ÁÕÑI½İÌ¤ì(€½¹ÍĞ½Õ¹Ğô¡ÍÑ…ÑÕÌ¤ôù…±±%¹ÁÕÑI½İÌ¹™¥±Ñ•È¡É½ÜôùÉ½Ü¹ÍÑ…ÑÕÌôôõÍÑ…ÑÕÌ¤¹±•¹Ñ ì(€½¹ÍĞ½ÁåQ•áĞõ…Íå¹Œ¡Ñ•áĞ±±…‰•°¤ôùì(€€€ÑÉåì(€€€€€¥˜¡¹…Ù¥…Ñ½È¹±¥Á‰½…Éü¹İÉ¥Ñ•Q•áĞ¥…İ…¥Ğ¹…Ù¥…Ñ½È¹±¥Á‰½…É¹İÉ¥Ñ•Q•áĞ¡Ñ•áĞ¤ì(€€€€€•±Í•í½¹ÍĞ…É•„õ‘½Õµ•¹Ğ¹É•…Ñ•±•µ•¹Ğ Ñ•áÑ…É•„œ¤í…É•„¹Ù…±Õ”õÑ•áĞí…É•„¹ÍÑå±”¹Á½Í¥Ñ¥½¸ô™¥á•œí…É•„¹ÍÑå±”¹½Á…¥ÑäôœÀœí‘½Õµ•¹Ğ¹‰½‘ä¹…ÁÁ•¹‘¡¥±¡…É•„¤í…É•„¹Í•±•Ğ ¤í‘½Õµ•¹Ğ¹•á•½µµ…¹ ½Áäœ¤í…É•„¹É•µ½Ù” ¤íô(€€€€€Í¡½İÁÁQ½…ÍĞ¡€‘í±…‰•±ôƒ®Î×²
³¶Z#²ZÓ²jQ€±íÑ¥Ñ±”èŸ®Î×²
°ƒ²f®0ô¤ì(€€€õ…Ñ ¡”¥íÍ¡½İ1•…å±•ÉĞ¡ƒ®Î×²
°ƒ².“¶2 è€‘í™É¥•¹‘±åÉÉ½È¡”¥õ€¥ô(€ôì(€½¹ÍĞÍ¡…É•	É¥•™¥¹œõ…Íå¹Œ¡Ñ•áĞ±Ñ¥Ñ±”¤ôùì(€€€ÑÉåì(€€€€€¥˜¡¹…Ù¥…Ñ½È¹Í¡…É”¥í…İ…¥Ğ¹…Ù¥…Ñ½È¹Í¡…É”¡íÑ¥Ñ±”±Ñ•áÑô¤íÉ•ÑÕÉ¹ô(€€€€€…İ…¥Ğ½ÁåQ•áĞ¡Ñ•áĞ±Ñ¥Ñ±”¤ì(€€€€€Í¡½İÁÁQ½…ÍĞ Ÿ²æÓ²æÓ²b“¶„ƒ®2¶fS²Â÷²^@ƒ®Úg²^³®²ZĞƒ²ó²ã²jP¸œ±íÑ¥Ñ±”èŸ®â3®š³¶VDƒ®Î×²
°ƒ²f®0œ±Ñ½¹”è¥¹™¼ô¤ì(€€€õ…Ñ ¡”¥í¥˜¡”ü¹¹…µ”„ôô‰½ÉÑÉÉ½Èœ¥Í¡½İ1•…å±•ÉĞ¡ƒªÎ×²r€ƒ².“¶2 è€‘í™É¥•¹‘±åÉÉ½È¡”¥õ€¥ô(€ôì(€½¹ÍĞÍ•¹‘%¹ÁÕÑI•µ¥¹‘•ÉÌõ…Íå¹Œ¡Ñ…É•ÑMÑ½É•Ì¤ôùì(€€€½¹ÍĞÑ…É•ÑÌô¡Ñ…É•ÑMÑ½É•ÍññÙ¥Í¥‰±•MÑ½É•Ì¤¹™±…Ñ5…À¡ÍÑ½É”ôùÍÑ½É”¹¥¹ÁÕÑI½İÌ(€€€€€€¹™¥±Ñ•È¡É½ÜôùÉ½Ü¹ÍÑ…ÑÕÌôôôµ¥ÍÍ¥¹œœ˜™É½Ü¹ÕÍ•É%¤(€€€€€€¹µ…À¡É½Üôø¡ì¸¸¹É½Ü±ÍÑ½É•9…µ”éÍÑ½É”¹ÍÑ½É•9…µ•ô¤¤¤ì(€€€½¹ÍĞÕ¹¥ÅÕ”õl¸¸¹¹•Ü5…À¡Ñ…É•ÑÌ¹µ…À¡É½ÜôùmÉ½Ü¹ÕÍ•É%±É½İt¤¤¹Ù…±Õ•Ì ¥tì(€€€¥˜ …Õ¹¥ÅÕ”¹±•¹Ñ ¥É•ÑÕÉ¸Í¡½İÁÁQ½…ÍĞ Ÿ²ƒ¶w¶Vpƒ®ÊS²r²^C®*Pƒ®¾ã²z®‚”ƒ²²nC²vĞƒ²^²ZÓ²jP¸œ±íÑ¥Ñ±”èŸ²V3®šğƒ®2²ƒ²^²v0œ±Ñ½¹”è¥¹™¼ô¤ì(€€€½¹ÍĞ½¹™¥Éµ•õ…İ…¥ĞÍ¡½İÁÁ½¹™¥É´¡íÑ¥Ñ±”èŸ².“²‚ƒ²z®‚”ƒ²V3®šğƒ®ÎÓ®
ÓªâÀœ±µ•ÍÍ…”éƒ®¾ã²z®‚”ƒ²²n@€‘íÕ¹¥ÅÕ”¹±•¹Ñ¡÷®ª²^CªÊ0€‘í‘…Ñ•1…‰•±ôƒ².“²‚ƒ²z®‚”ƒ²V3®šó²vƒ®ÎÓ®
óªæ3²jPı€±½¹™¥Éµ1…‰•°èŸ²V3®šğƒ®ÎÓ®
ÓªâÀô¤ì(€€€¥˜ …½¹™¥Éµ•¥É•ÑÕÉ¸ì(€€€Í•ÑI•µ¥¹‘•ÉM•¹‘¥¹œ¡ÑÉÕ”¤ì(€€€½¹ÍĞÉ•Á½ÉÑ…Ñ”õ€‘íµ½¹Ñ¡ô´‘íMÑÉ¥¹œ¡É•Á½ÉÑ…ä¤¹Á…‘MÑ…ÉĞ È°œÀœ¥õ€ì(€€€½¹ÍĞ¹½Ñ¥™¥…Ñ¥½¹ÌõÕ¹¥ÅÕ”¹µ…À¡É½Üôø¡ì(€€€€€É•¥Á¥•¹Ñ}¥éÉ½Ü¹ÕÍ•É%±…Ñ½É}¥é…ÕÑ¡UÍ•É%±ÑåÁ”è‘…¥±å}¥¹ÁÕÑ}É•µ¥¹‘•Èœ°(€€€€€Ñ¥Ñ±”èŸ²b“®*`ƒ².“²‚²vƒ²z®‚—¶VÓ²ó²ã²jPƒŠr7¾â<œ°(€€€€€µ•ÍÍ…”é€‘í‘…Ñ•1…‰•±ô€‘íÉ½Ü¹ÍÑ½É•9…µ•ôƒ².“²‚²vĞƒ²V²ƒ¶fW²vã®Bc² ƒ²V+²Vc²ZÓ²jP¸ƒ².“²‚²vĞƒ²^²ró®¦Ğ€ÃªÆĞƒ¶fW²vã²vƒ®"3®~³²ó²ã²jP¹€°(€€€€€Á…å±½…éíÍÉ••¸è‘…¥±äœ±É•Á½ÉÑ…Ñ”±ÕÉ°èœ¼ı½Á•¸õ‘…¥±äô°(€€€ô¤¤ì(€€€½¹ÍĞí•ÉÉ½Éôõ…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ ¹½Ñ¥™¥…Ñ¥½¹Ìœ¤¹¥¹Í•ÉĞ¡¹½Ñ¥™¥…Ñ¥½¹Ì¤ì(€€€Í•ÑI•µ¥¹‘•ÉM•¹‘¥¹œ¡™…±Í”¤ì(€€€¥˜¡•ÉÉ½È¥É•ÑÕÉ¸Í¡½İ1•…å±•ÉĞ¡ƒ²z®‚”ƒ²V3®šğƒ®Âs²„ƒ².“¶2 è€‘í™É¥•¹‘±åÉÉ½È¡•ÉÉ½È¥õ€¤ì(€€€Í¡½İÁÁQ½…ÍĞ¡€‘íÕ¹¥ÅÕ”¹±•¹Ñ¡÷®ª²^CªÊ0ƒ².“²‚ƒ²z®‚”ƒ²V3®šó²vƒ®ÎÓ®#²ZÓ²jP¹€±íÑ¥Ñ±”èŸ²V3®šğƒ®Âs²„ƒ²f®0ô¤ì(€ôì((€É•ÑÕÉ¸€ñ‘¥Ø±…ÍÍ9…µ”ô‰ÍÁ…”µä´Ìˆø(€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµÉ…‘¥•¹ĞµÑ¼µ‰È™É½´µÙ¥½±•Ğ´ØÀÀÑ¼µ¥¹‘¥¼´ØÀÀÉ½Õ¹‘•´Éá°À´ĞÑ•áĞµİ¡¥Ñ”ˆø(€€€€€€ñ‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÙ¥½±•Ğ´ÈÀÀˆû®2¶Fpƒ²‚²j¤ğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµ±œ™½¹Ğµ‰±…¬µĞ´À¸Ôˆùí‘…Ñ•1…‰•±ôƒ²vó²vğƒ®â3®š³¶VDğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÙ¥½±•Ğ´ÈÀÀµĞ´Äˆû²b“²‚í%1e}	I%%9}M9}Q%5ôƒªâÃ²’ ƒ
Üƒ²æÓ²æÓ²bƒ²‚®.³ªÎğƒ®¾ã²z®‚”ƒ²V3®šó²vƒ®ÂS®†pƒ®ÎÓ®
ğƒ²"`ƒ²z#²ZÓ²jP¸ğ½‘¥Øøğ½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É¥É¥µ½±Ì´Ğ…À´Ä¸ÔµĞ´ĞˆùímlŸ²z®‚”œ±½Õ¹Ğ ¥¹ÁÕĞœ¥t±lœÃªÆĞƒ¶fW²vàœ±½Õ¹Ğ é•É¼œ¥t±lŸ®¾ã²z®‚”œ±½Õ¹Ğ µ¥ÍÍ¥¹œœ¥t±lŸ¶rÓ®²Ğœ±½Õ¹Ğ ½™˜œ¥ut¹µ…À ¡m±…‰•°±Ù…±Õ•t¤ôøñ‘¥Ø­•äõí±…‰•±ô±…ÍÍ9…µ”ô‰É½Õ¹‘•µá°‰œµİ¡¥Ñ”¼ÄÀÁà´ÈÁä´ÈÑ•áĞµ•¹Ñ•Èˆøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlåÁátÑ•áĞµÙ¥½±•Ğ´ÄÀÀˆùí±…‰•±ôğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµ‰…Í”™½¹Ğµ‰±…¬µĞ´À¸ÔˆùíÙ…±Õ•÷®ªğ½‘¥Øøğ½‘¥Øø¥ôğ½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É¥É¥µ½±Ì´È…À´ÈµĞ´Ìˆøñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùÍ¡…É•	É¥•™¥¹œ¡‰Õ¥±‘±±	É¥•™¥¹Q•áĞ¡í‘…Ñ•1…‰•°±ÍÑ½É•ÌéÙ¥Í¥‰±•MÑ½É•Íô¤±€‘í‘…Ñ•1…‰•±ôƒ²vó²vğƒ®â3®š³¶VE€¥ô±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ•¹Ñ•È…À´Ä¸ÔÉ½Õ¹‘•µá°‰œµİ¡¥Ñ”Áà´ÌÁä´È¸ÔÑ•áĞµáÌ™½¹Ğµ‰½±Ñ•áĞµÙ¥½±•Ğ´ÜÀÀˆøñM¡…É”ÈÍ¥é”õìÄÑô¼û²æÓ²æÓ²b“®†pƒ²‚®.°ğ½‰ÕÑÑ½¸øñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ‘¥Í…‰±•õíÉ•µ¥¹‘•ÉM•¹‘¥¹ô½¹±¥¬õì ¤ôùÍ•¹‘%¹ÁÕÑI•µ¥¹‘•ÉÌ ¥ô±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ•¹Ñ•È…À´Ä¸ÔÉ½Õ¹‘•µá°‰œµÙ¥½±•Ğ´ÔÀÀÁà´ÌÁä´È¸ÔÑ•áĞµáÌ™½¹Ğµ‰½±Ñ•áĞµİ¡¥Ñ”‘¥Í…‰±•é½Á…¥Ñä´ÔÀˆøñM•¹Í¥é”õìÄÑô¼ùíÉ•µ¥¹‘•ÉM•¹‘¥¹œüŸ®ÎÓ®
Ó®*Pƒ²’DœèŸ®¾ã²z®‚”ƒ²V3®šğôğ½‰ÕÑÑ½¸øğ½‘¥Øø(€€€€ğ½‘¥Øø((€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµİ¡¥Ñ”É½Õ¹‘•µá°‰½É‘•È‰½É‘•ÈµÉ…ä´ÄÀÀÀ´Ì™±•à¥Ñ•µÌµ•¹Ñ•È…À´Èˆø(€€€€€€ñÍ•±•ĞÙ…±Õ”õíÍ•±•Ñ•‘…åô½¹¡…¹”õí”ôùÍ•ÑM•±•Ñ•‘…ä¡”¹Ñ…É•Ğ¹Ù…±Õ”¥ô±…ÍÍ9…µ”ô‰™±•à´ÄÉ½Õ¹‘•µ±œ‰½É‘•È‰½É‘•ÈµÉ…ä´ÈÀÀÁà´ÌÁä´ÈÑ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±ˆùíÉÉ…ä¹™É½´¡í±•¹Ñ é‘…åÍ%¹5½¹Ñ ¡µ½¹Ñ ¥ô°¡|±¤¤ôùMÑÉ¥¹œ¡¤¬Ä¤¹Á…‘MÑ…ÉĞ È°œÀœ¤¤¹µ…À¡‘…äôøñ½ÁÑ¥½¸­•äõí‘…åôÙ…±Õ”õí‘…åôùí9Õµ‰•È¡µ½¹Ñ ¹Í±¥” Ô°Ü¤¥÷²nPí9Õµ‰•È¡‘…ä¥÷²vğğ½½ÁÑ¥½¸ø¥ôğ½Í•±•Ğø(€€€€€€ñÍ•±•ĞÙ…±Õ”õíÍÑ½É•-•åô½¹¡…¹”õí”ôùÍ•ÑMÑ½É•-•ä¡”¹Ñ…É•Ğ¹Ù…±Õ”¥ô±…ÍÍ9…µ”ô‰™±•à´ÄÉ½Õ¹‘•µ±œ‰½É‘•È‰½É‘•ÈµÉ…ä´ÈÀÀÁà´ÌÁä´ÈÑ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±ˆøñ½ÁÑ¥½¸Ù…±Õ”ô‰…±°ˆû²‚²ÊĞƒ®“²z”ğ½½ÁÑ¥½¸ùí‰É…¹¡•Ì¹µ…À¡‰É…¹ ôøñ½ÁÑ¥½¸­•äõí‰É…¹¡ôÙ…±Õ”õí‰É…¹¡ôùí‘¥ÍÁ±…åMÑ½É•9…µ”¡‰É…¹ ¥ôğ½½ÁÑ¥½¸ø¥ôğ½Í•±•Ğø(€€€€ğ½‘¥Øø((€€€í±½…‘¥¹œüñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµİ¡¥Ñ”É½Õ¹‘•µá°‰½É‘•ÈÀ´àÑ•áĞµ•¹Ñ•ÈÑ•áĞµáÌÑ•áĞµÉ…ä´ĞÀÀˆû®â3®š³¶VG²vƒ®3®Ns®*Pƒ²’D¸¸¸ğ½‘¥ØøéÙ¥Í¥‰±•MÑ½É•Ì¹µ…À¡ÍÑ½É”ôùì(€€€€€½¹ÍĞµ¥ÍÍ¥¹œõÍÑ½É”¹¥¹ÁÕÑI½İÌ¹™¥±Ñ•È¡É½ÜôùÉ½Ü¹ÍÑ…ÑÕÌôôôµ¥ÍÍ¥¹œœ¤ì(€€€€€½¹ÍĞé•É¼õÍÑ½É”¹¥¹ÁÕÑI½İÌ¹™¥±Ñ•È¡É½ÜôùÉ½Ü¹ÍÑ…ÑÕÌôôôé•É¼œ¤ì(€€€€€½¹ÍĞÍ•Ñ5•ÑÉ¥ÌõÍÑ½É”¹µ•ÑÉ¥Ì¹™¥±Ñ•È¡µ•ÑÉ¥Œôùµ•ÑÉ¥Œ¹ÍÑ…Ñ”„ôôÕ¹Í•Ğœ¤ì(€€€€€½¹ÍĞ½½õÍ•Ñ5•ÑÉ¥Ì¹™¥±Ñ•È¡µ•ÑÉ¥Œôùµ•ÑÉ¥Œ¹ÍÑ…Ñ”ôôô½½œ¤¹Í½ÉĞ ¡„±ˆ¤ôùˆ¹™½É•…ÍÑI…Ñ”µ„¹™½É•…ÍÑI…Ñ”¤ì(€€€€€½¹ÍĞİ•…¬õÍ•Ñ5•ÑÉ¥Ì¹™¥±Ñ•È¡µ•ÑÉ¥Œôùµ•ÑÉ¥Œ¹ÍÑ…Ñ”„ôô½½œ¤¹Í½ÉĞ ¡„±ˆ¤ôù„¹™½É•…ÍÑI…Ñ”µˆ¹™½É•…ÍÑI…Ñ”¤ì(€€€€€½¹ÍĞÕ¹Í•ĞõÍÑ½É”¹µ•ÑÉ¥Ì¹™¥±Ñ•È¡µ•ÑÉ¥Œôùµ•ÑÉ¥Œ¹ÍÑ…Ñ”ôôôÕ¹Í•Ğœ¤ì(€€€€€É•ÑÕÉ¸€ñ‘¥Ø­•äõíÍÑ½É”¹‰É…¹¡ô±…ÍÍ9…µ”ô‰‰œµİ¡¥Ñ”É½Õ¹‘•´Éá°‰½É‘•È‰½É‘•ÈµÉ…ä´ÄÀÀ½Ù•É™±½Üµ¡¥‘‘•¸ˆø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰À´Ğ‰½É‘•Èµˆ‰½É‘•ÈµÉ…ä´ÔÀ™±•à¥Ñ•µÌµÍÑ…ÉĞ©ÕÍÑ¥™äµ‰•Ñİ••¸…À´Ìˆø(€€€€€€€€€€ñ‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´™½¹Ğµ‰±…¬Ñ•áĞµÉ…ä´äÀÀˆùíÍÑ½É”¹ÍÑ½É•9…µ•ôğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀµĞ´Äˆû²b#²ƒ®.³²Äí½½¹±•¹Ñ¡ô½íÍ•Ñ5•ÑÉ¥Ì¹±•¹Ñ¡÷ªÂpƒ
Üƒ®¾ã²z®‚”íµ¥ÍÍ¥¹œ¹±•¹Ñ¡÷®ªƒ
Ü€ÃªÆĞƒ¶fW²vàíé•É¼¹±•¹Ñ¡÷®ªğ½‘¥Øøğ½‘¥Øø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à…À´Ä¸Ôˆøñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùÍ¡…É•	É¥•™¥¹œ¡‰Õ¥±‘MÑ½É•	É¥•™¥¹Q•áĞ¡í‘…Ñ•1…‰•°°¸¸¹ÍÑ½É•ô¤±€‘íÍÑ½É”¹ÍÑ½É•9…µ•ôƒ®â3®š³¶VE€¥ô±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È…À´ÄÉ½Õ¹‘•µ±œ‰œµÙ¥½±•Ğ´ÔÀÁà´È¸ÔÁä´ÈÑ•áĞµlÄÁÁát™½¹Ğµ‰½±Ñ•áĞµÙ¥½±•Ğ´ÜÀÀˆøñM¡…É”ÈÍ¥é”õìÄÉô¼û²æÓ²æÓ²bƒ²‚®.°ğ½‰ÕÑÑ½¸ùíµ¥ÍÍ¥¹œ¹±•¹Ñ øÀ˜˜ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ‘¥Í…‰±•õíÉ•µ¥¹‘•ÉM•¹‘¥¹ô½¹±¥¬õì ¤ôùÍ•¹‘%¹ÁÕÑI•µ¥¹‘•ÉÌ¡mÍÑ½É•t¥ô±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È…À´ÄÉ½Õ¹‘•µ±œ‰œµÉ•´ÔÀÁà´È¸ÔÁä´ÈÑ•áĞµlÄÁÁát™½¹Ğµ‰½±Ñ•áĞµÉ•´ØÀÀ‘¥Í…‰±•é½Á…¥Ñä´ÔÀˆøñM•¹Í¥é”õìÄÉô¼û²z®‚”ƒ²V3®šğğ½‰ÕÑÑ½¸ùôğ½‘¥Øø(€€€€€€€€ğ½‘¥Øø(€€€€€€€ì¡µ¥ÍÍ¥¹œ¹±•¹Ñ øÁññé•É¼¹±•¹Ñ øÀ¤˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰Áà´ĞÁä´Ì‰œµÉ•´ÔÀ¼ØÀÑ•áĞµlÄÁÁát±•…‘¥¹œ´Ôˆøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÉ•´ØÀÀˆøñˆû®¾ã²z®‚”ğ½ˆøíµ¥ÍÍ¥¹œ¹±•¹Ñ ıµ¥ÍÍ¥¹œ¹µ…À¡É½ÜôùÉ½Ü¹¹…µ”¤¹©½¥¸ œ°€œ¤èŸ²^²v0ôğ½‘¥Øùíé•É¼¹±•¹Ñ øÀ˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÙ¥½±•Ğ´ØÀÀˆøñˆøÃªÆĞƒ¶fW²vàğ½ˆøíé•É¼¹µ…À¡É½ÜôùÉ½Ü¹¹…µ”¤¹©½¥¸ œ°€œ¥ôğ½‘¥Øùôğ½‘¥Øùô(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰½É‘•Èµˆ‰½É‘•ÈµÉ…ä´ÔÀÁà´ĞÁä´Ìˆø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁát™½¹Ğµ‰½±Ñ•áĞµÙ¥½±•Ğ´ÜÀÀˆû²b“®*`ƒ¶V€ƒ²vğƒ
Üƒ²vó²‚Tğ½‘¥Øø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´ÈÉ¥É¥µ½±Ì´Ì…À´Ä¸ÔÑ•áĞµ•¹Ñ•Èˆø(€€€€€€€€€€€ímlŸªÎƒªÂtƒ²V÷²4œ±ÍÑ½É”¹Ñ½‘…åQ…Í­Ì¹±•¹Ñ °Ñ•áĞµÙ¥½±•Ğ´ÜÀÀt±lŸ¶f ƒ²“²æ`œ±ÍÑ½É”¹Ñ½‘…å%¹ÍÑ…±±Ì¹±•¹Ñ °Ñ•áĞµ‰±Õ”´ÜÀÀt±lŸ²“²æ`ƒ²²^Àœ±ÍÑ½É”¹½Ù•É‘Õ•%¹ÍÑ…±±Ì¹±•¹Ñ ±ÍÑ½É”¹½Ù•É‘Õ•%¹ÍÑ…±±Ì¹±•¹Ñ üÑ•áĞµÉ•´ØÀÀœèÑ•áĞµÉ…ä´ĞÀÀut¹µ…À ¡m±…‰•°±Ù…±Õ”±Ñ½¹•t¤ôøñ‘¥Ø­•äõí±…‰•±ô±…ÍÍ9…µ”ô‰É½Õ¹‘•µá°‰œµÉ…ä´ÔÀÁà´ÈÁä´Èˆøñ‘¥Ø±…ÍÍ9…µ”õíÑ•áĞµ‰…Í”™½¹Ğµ‰±…¬€‘íÑ½¹•õôùíÙ…±Õ•÷ªÆĞğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlåÁátÑ•áĞµÉ…ä´ÔÀÀˆùí±…‰•±ôğ½‘¥Øøğ½‘¥Øø¥ô(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€ì¡ÍÑ½É”¹Ñ½‘…åQ…Í­Ì¹±•¹Ñ øÁññÍÑ½É”¹Ñ½‘…å%¹ÍÑ…±±Ì¹±•¹Ñ øÁññÍÑ½É”¹½Ù•É‘Õ•%¹ÍÑ…±±Ì¹±•¹Ñ øÀ¤˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´ÈÍÁ…”µä´ÄÑ•áĞµlÄÁÁát±•…‘¥¹œµÉ•±…á•Ñ•áĞµÉ…ä´ØÀÀˆø(€€€€€€€€€€€íÍÑ½É”¹Ñ½‘…åQ…Í­Ì¹±•¹Ñ øÀ˜˜ñ‘¥Øøñˆû²V÷²4ğ½ˆøƒ
ÜíÍÑ½É”¹Ñ½‘…åQ…Í­Ì¹µ…À¡É½Üôù€‘íÉ½Ü¹ÕÍÑ½µ•É9…µ•ô ‘íÉ½Ü¹Ñ¥Ñ±•ô‘íÉ½Ü¹•µÁ±½å••9…µ”ı€ƒ
Ü€‘íÉ½Ü¹•µÁ±½å••9…µ•õ€èœô¥€¤¹©½¥¸ œ°€œ¥ôğ½‘¥Øùô(€€€€€€€€€€€íÍÑ½É”¹Ñ½‘…å%¹ÍÑ…±±Ì¹±•¹Ñ øÀ˜˜ñ‘¥Øøñˆû²b“®*`ƒ²“²æ`ğ½ˆøƒ
ÜíÍÑ½É”¹Ñ½‘…å%¹ÍÑ…±±Ì¹µ…À¡É½Üôù€‘íÉ½Ü¹ÕÍÑ½µ•É9…µ•ô‘íÉ½Ü¹•µÁ±½å••9…µ”ı€ ‘íÉ½Ü¹•µÁ±½å••9…µ•ô¥€èœõ€¤¹©½¥¸ œ°€œ¥ôğ½‘¥Øùô(€€€€€€€€€€€íÍÑ½É”¹½Ù•É‘Õ•%¹ÍÑ…±±Ì¹±•¹Ñ øÀ˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÉ•´ØÀÀˆøñˆû²b#²‚W²vğƒªÊ÷ªÎó
ß®¾ã²f®0ğ½ˆøƒ
ÜíÍÑ½É”¹½Ù•É‘Õ•%¹ÍÑ…±±Ì¹µ…À¡É½Üôù€‘íÉ½Ü¹ÕÍÑ½µ•É9…µ•ô ‘íÉ½Ü¹Á±…¹¹•‘…Ñ•ô‘íÉ½Ü¹•µÁ±½å••9…µ”ı€ƒ
Ü€‘íÉ½Ü¹•µÁ±½å••9…µ•õ€èœô¥€¤¹©½¥¸ œ°€œ¥ôğ½‘¥Øùô(€€€€€€€€€€ğ½‘¥Øùô(€€€€€€€€ğ½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰À´ĞÉ¥Í´éÉ¥µ½±Ì´È…À´Ìˆø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É½Õ¹‘•µá°‰œµ•µ•É…±´ÔÀÀ´Ìˆøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁát™½¹Ğµ‰½±Ñ•áĞµ•µ•É…±´ÜÀÀˆû²zc¶VcªÎ€ƒ²z#®*Pƒ¶V·®ª¤ğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´ÈÍÁ…”µä´Ä¸Ôˆùí½½¹±•¹Ñ ı½½¹Í±¥” À°Ì¤¹µ…À¡µ•ÑÉ¥Œôøñ‘¥Ø­•äõíµ•ÑÉ¥Œ¹­•åô±…ÍÍ9…µ”ô‰™±•à©ÕÍÑ¥™äµ‰•Ñİ••¸…À´ÈÑ•áĞµlÄÁÁátˆøñÍÁ…¸±…ÍÍ9…µ”ô‰™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÉ…ä´ÜÀÀˆùíµ•ÑÉ¥Œ¹±…‰•±ôğ½ÍÁ…¸øñÍÁ…¸±…ÍÍ9…µ”ô‰™½¹Ğµ‰½±Ñ•áĞµ•µ•É…±´ÜÀÀˆû²b#²í™µÑ	É¥•™Y…±Õ”¡µ•ÑÉ¥Œ±µ•ÑÉ¥Œ¹™½É•…ÍĞ¥ôƒ
Üí5…Ñ ¹É½Õ¹¡µ•ÑÉ¥Œ¹™½É•…ÍÑI…Ñ”¥ô”ğ½ÍÁ…¸øğ½‘¥Øø¤èñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀˆû²b#²ƒ®.³²Äƒ¶V·®ª§²vĞƒ²V²ƒ²^²ZÓ²jP¸ğ½‘¥Øùôğ½‘¥Øøğ½‘¥Øø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É½Õ¹‘•µá°‰œµ…µ‰•È´ÔÀÀ´Ìˆøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁát™½¹Ğµ‰½±Ñ•áĞµ…µ‰•È´ÜÀÀˆû®ÎÓ²f¶V€ƒ¶V·®ª¤ğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´ÈÍÁ…”µä´Ä¸Ôˆùíİ•…¬¹±•¹Ñ ıİ•…¬¹Í±¥” À°Ì¤¹µ…À¡µ•ÑÉ¥Œôøñ‘¥Ø­•äõíµ•ÑÉ¥Œ¹­•åô±…ÍÍ9…µ”ô‰™±•à©ÕÍÑ¥™äµ‰•Ñİ••¸…À´ÈÑ•áĞµlÄÁÁátˆøñÍÁ…¸±…ÍÍ9…µ”ô‰™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÉ…ä´ÜÀÀˆùíµ•ÑÉ¥Œ¹±…‰•±ôğ½ÍÁ…¸øñÍÁ…¸±…ÍÍ9…µ”õí™½¹Ğµ‰½±€‘íµ•ÑÉ¥Œ¹ÍÑ…Ñ”ôôô±½ÜœüÑ•áĞµÉ•´ØÀÀœèÑ•áĞµ…µ‰•È´ÜÀÀõôû²b#²í™µÑ	É¥•™Y…±Õ”¡µ•ÑÉ¥Œ±µ•ÑÉ¥Œ¹™½É•…ÍĞ¥ôƒ
Üí5…Ñ ¹É½Õ¹¡µ•ÑÉ¥Œ¹™½É•…ÍÑI…Ñ”¥ô”ğ½ÍÁ…¸øğ½‘¥Øø¤èñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀˆû®ª§¶Fpƒ²“²‚Tƒ¶V·®ª§²v ƒ®ª£®F@ƒ®.³²Äƒ¶vC®š²vÓ²^C²jP¸ğ½‘¥Øùôğ½‘¥Øøğ½‘¥Øø(€€€€€€€€ğ½‘¥Øø(€€€€€€€íÕ¹Í•Ğ¹±•¹Ñ øÀ˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰Áà´ĞÁˆ´ĞÑ•áĞµlÄÁÁátÑ•áĞµÉ•´ÔÀÀˆøñˆû®ª§¶Fpƒ²z®‚”ƒ¶V²jPèğ½ˆøíÕ¹Í•Ğ¹µ…À¡µ•ÑÉ¥Œôùµ•ÑÉ¥Œ¹±…‰•°¤¹©½¥¸ œ°€œ¥ôğ½‘¥Øùô(€€€€€€ğ½‘¥Øøì(€€€ô¥ô(€€ğ½‘¥Øøì)ô()™Õ¹Ñ¥½¸‘µ¥¹A•É™½Éµ…¹•…±•¹‘…È¡ìµ½¹Ñ °•µÁ±½å••Ì°‘…¥±åI•½É‘Ì°±½¥¹	É…¹ ôœœ°…¹Mİ¥Ñ¡MÑ½É•Ìõ™…±Í”ô¤ì(€½¹ÍĞ…Ù…¥±…‰±•MÑ½É•ÌõÕÍ•5•µ¼  ¤ôùÍ½ÉÑMÑ½É•Í	å=Á•¹=É‘•È ¡•µÁ±½å••Íññmt¤¹µ…À¡”ôù”¹‰É…¹ ¤¹™¥±Ñ•È¡	½½±•…¸¤¹™¥±Ñ•È¡ˆôø…9=9}M1M}MQ=IL¹¥¹±Õ‘•Ì¡ˆ¤¤¤±m•µÁ±½å••Ít¤ì(€½¹ÍĞ‘•™…Õ±ÑMÑ½É”õ…¹Mİ¥Ñ¡MÑ½É•Ìü…±°œè¡±½¥¹	É…¹¡ññ…Ù…¥±…‰±•MÑ½É•ÍlÁuñğ…±°œ¤ì(€½¹ÍĞmÍÑ½É•-•ä±Í•ÑMÑ½É•-•åtõÕÍ•MÑ…Ñ”¡‘•™…Õ±ÑMÑ½É”¤ì(€½¹ÍĞmÍ•±•Ñ•‘…ä±Í•ÑM•±•Ñ•‘…åtõÕÍ•MÑ…Ñ”  ¤ôùì(€€€½¹ÍĞ¹½Üõ¹•Ü…Ñ” ¤ì(€€€É•ÑÕÉ¸µ½¹Ñ¡-•å=˜¡¹½Ü¤ôôõµ½¹Ñ ıMÑÉ¥¹œ¡¹½Ü¹•Ñ…Ñ” ¤¤¹Á…‘MÑ…ÉĞ È°œÀœ¤èœÀÄœì(€ô¤ì((€ÕÍ•™™•Ğ  ¤ôùì(€€€¥˜¡…¹Mİ¥Ñ¡MÑ½É•Ì¥ì(€€€€€¥˜¡ÍÑ½É•-•ä„ôô…±°œ˜˜……Ù…¥±…‰±•MÑ½É•Ì¹¥¹±Õ‘•Ì¡ÍÑ½É•-•ä¤¥Í•ÑMÑ½É•-•ä …±°œ¤ì(€€€õ•±Í•ì(€€€€€Í•ÑMÑ½É•-•ä¡±½¥¹	É…¹¡ññ…Ù…¥±…‰±•MÑ½É•ÍlÁuñğ…±°œ¤ì(€€€ô(€ô±m…¹Mİ¥Ñ¡MÑ½É•Ì±±½¥¹	É…¹ ±…Ù…¥±…‰±•MÑ½É•Ì¹©½¥¸ ğœ¥t¤ì((€ÕÍ•™™•Ğ  ¤ôùì(€€€½¹ÍĞ¹½Üõ¹•Ü…Ñ” ¤ì(€€€Í•ÑM•±•Ñ•‘…ä¡µ½¹Ñ¡-•å=˜¡¹½Ü¤ôôõµ½¹Ñ ıMÑÉ¥¹œ¡¹½Ü¹•Ñ…Ñ” ¤¤¹Á…‘MÑ…ÉĞ È°œÀœ¤èœÀÄœ¤ì(€ô±mµ½¹Ñ¡t¤ì((€½¹ÍĞÍ½Á•ô¡•µÁ±½å••Íññmt¤¹™¥±Ñ•È¡”ôø¡ÍÑ½É•-•äôôô…±°ññ”¹‰É…¹ ôôõÍÑ½É•-•ä¤˜˜…9=9}M1M}MQ=IL¹¥¹±Õ‘•Ì¡”¹‰É…¹ ¤¤ì(€½¹ÍĞ¸õ‘…åÍ%¹5½¹Ñ ¡µ½¹Ñ ¤ì((€½¹ÍĞ‘…åMÕµµ…Éäô¡‘…å-•ä¤ôùì(€€€½¹ÍĞÑ½Ñ…°õí¡ÌèÀ±Í¥´èÀ±¡½µ”èÀ±Í•½¹èÀ±™É•”èÀ±Íµ…ÉĞèÀ±Ñ…¥±½É•èÀ±¥¹ÁÕĞèÀ±½™˜èÁôì(€€€Í½Á•¹™½É… ¡•µÀôùì(€€€€€½¹ÍĞ´õ‘…¥±å…±•¹‘…É5•ÑÉ¥Ì¡‘…¥±åI•½É‘Ìü¹m•µÀ¹¥‘tü¹m‘…å-•åt¤ì(€€€€€Ñ½Ñ…°¹¡Ì¬õ´¹¡ÌìÑ½Ñ…°¹Í¥´¬õ´¹Í¥´ìÑ½Ñ…°¹¡½µ”¬õ´¹¡½µ”ìÑ½Ñ…°¹Í•½¹¬õ´¹Í•½¹ìÑ½Ñ…°¹™É•”¬õ´¹™É•”ìÑ½Ñ…°¹Íµ…ÉĞ¬õ´¹Íµ…ÉĞìÑ½Ñ…°¹Ñ…¥±½É•¬õ´¹Ñ…¥±½É•ì(€€€€€¥˜¡´¹¡…Ì¥Ñ½Ñ…°¹¥¹ÁÕĞ¬ôÄì(€€€€€¥˜¡´¹½™˜¥Ñ½Ñ…°¹½™˜¬ôÄì(€€€ô¤ì(€€€É•ÑÕÉ¸Ñ½Ñ…°ì(€ôì((€½¹ÍĞÍ•±•Ñ•õ‘…åMÕµµ…Éä¡Í•±•Ñ•‘…ä¤ì(€½¹ÍĞ•µÁ±½å•••Ñ…¥±ÌõÍ½Á•¹µ…À¡•µÀôø¡í•µÀ°¸¸¹‘…¥±å…±•¹‘…É5•ÑÉ¥Ì¡‘…¥±åI•½É‘Ìü¹m•µÀ¹¥‘tü¹mÍ•±•Ñ•‘…åt¥ô¤¤(€€€€¹Í½ÉĞ ¡„±ˆ¤ôø¡ˆ¹¡Ì­ˆ¹Í¥´­ˆ¹¡½µ”¤´¡„¹¡Ì­„¹Í¥´­„¹¡½µ”¥ññ„¹•µÀ¹¹…µ”¹±½…±•½µÁ…É”¡ˆ¹•µÀ¹¹…µ”¤¤ì((€É•ÑÕÉ¸€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµİ¡¥Ñ”É½Õ¹‘•µá°‰½É‘•È‰½É‘•ÈµÉ…ä´ÄÀÀ½Ù•É™±½Üµ¡¥‘‘•¸ˆø(€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Áà´ĞÁä´Ì‰½É‘•Èµˆ‰½É‘•ÈµÉ…ä´ÔÀ™±•à¥Ñ•µÌµÍÑ…ÉĞ©ÕÍÑ¥™äµ‰•Ñİ••¸…À´Ìˆø(€€€€€€ñ‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ…ä´ĞÀÀˆû®
ƒ²s®Îƒ®“²z”ƒ²ÇªÎğğ½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµ‰…Í”™½¹Ğµ‰½±Ñ•áĞµÉ…ä´äÀÀˆùíµ½¹Ñ¡1…‰•°¡µ½¹Ñ ¥ôƒ²ÇªÎğƒ®.³®‚”ğ½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀµĞ´Äˆû®.³®‚—²^C®*P!Lƒ
ÜM%459@ƒ
Üƒ¶f#®0ƒªÂ®.£¶z ƒ¶Fs².s¶VÓ²jP¸ğ½‘¥Øø(€€€€€€ğ½‘¥Øø(€€€€€í…¹Mİ¥Ñ¡MÑ½É•Ì€ü€ (€€€€€€€€ñÍ•±•ĞÙ…±Õ”õíÍÑ½É•-•åô½¹¡…¹”õí”ôùÍ•ÑMÑ½É•-•ä¡”¹Ñ…É•Ğ¹Ù…±Õ”¥ô±…ÍÍ9…µ”ô‰µ…àµÜµlÄÔÁÁátÑ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±‰œµİ¡¥Ñ”‰½É‘•È‰½É‘•ÈµÉ…ä´ÈÀÀÉ½Õ¹‘•µ±œÁà´ÈÁä´Èˆø(€€€€€€€€€€ñ½ÁÑ¥½¸Ù…±Õ”ô‰…±°ˆû²‚²ÊĞƒ®“²z”ğ½½ÁÑ¥½¸ø(€€€€€€€€€í…Ù…¥±…‰±•MÑ½É•Ì¹µ…À¡ˆôøñ½ÁÑ¥½¸­•äõí‰ôÙ…±Õ”õí‰ôùí‘¥ÍÁ±…åMÑ½É•9…µ”¡ˆ¥ôğ½½ÁÑ¥½¸ø¥ô(€€€€€€€€ğ½Í•±•Ğø(€€€€€€¤€è€ (€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÙ¥½±•Ğ´ÜÀÀ‰œµÙ¥½±•Ğ´ÔÀÉ½Õ¹‘•µ±œÁà´È¸ÔÁä´Èˆùí‘¥ÍÁ±…åMÑ½É•9…µ”¡ÍÑ½É•-•ä¥ôğ½‘¥Øø(€€€€€€¥ô(€€€€ğ½‘¥Øø((€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰À´Ìˆø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É¥É¥µ½±Ì´Ü…À´Ä¸Ôµˆ´Ä¸Ôˆø(€€€€€€€ílŸ²vğœ°Ÿ²nPœ°Ÿ¶fPœ°Ÿ²"`œ°Ÿ®ª¤œ°Ÿªâ œ°Ÿ¶€t¹µ…À ¡Ü±¤¤ôøñ‘¥Ø­•äõíİô±…ÍÍ9…µ”õíÑ•áĞµ•¹Ñ•ÈÑ•áĞµlÄÁÁát™½¹ĞµÍ•µ¥‰½±Áä´Ä€‘í¤ôôôÀüÑ•áĞµÉ•´ĞÀÀœé¤ôôôØüÑ•áĞµ‰±Õ”´ĞÀÀœèÑ•áĞµÉ…ä´ĞÀÀõôùíİôğ½‘¥Øø¥ô(€€€€€€ğ½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É¥É¥µ½±Ì´Ü…À´Ä¸Ôˆø(€€€€€€€íÉÉ…ä¹™É½´¡í±•¹Ñ é¹•Ü…Ñ”¡9Õµ‰•È¡µ½¹Ñ ¹Í±¥” À°Ğ¤¤±9Õµ‰•È¡µ½¹Ñ ¹Í±¥” Ô°Ü¤¤´Ä°Ä¤¹•Ñ…ä ¥ô¤¹µ…À ¡|±¤¤ôøñ‘¥Ø­•äõí‰±…¹¬´‘í¥õô±…ÍÍ9…µ”ô‰…ÍÁ•ĞµÍÅÕ…É”ˆ¼ø¥ô(€€€€€€€íÉÉ…ä¹™É½´¡í±•¹Ñ é¹ô°¡|±¤¤ôù¤¬Ä¤¹µ…À¡ôùì(€€€€€€€€€½¹ÍĞ­•äõMÑÉ¥¹œ¡¤¹Á…‘MÑ…ÉĞ È°œÀœ¤ì(€€€€€€€€€½¹ÍĞàõ‘…åMÕµµ…Éä¡­•ä¤ì(€€€€€€€€€½¹ÍĞ…Ñ¥Ù”õà¹¡ÌøÁññà¹Í¥´øÁññà¹¡½µ”øÀì(€€€€€€€€€½¹ÍĞÍ•°õ­•äôôõÍ•±•Ñ•‘…äì(€€€€€€€€€½¹ÍĞ‘½Üõ¹•Ü…Ñ”¡9Õµ‰•È¡µ½¹Ñ ¹Í±¥” À°Ğ¤¤±9Õµ‰•È¡µ½¹Ñ ¹Í±¥” Ô°Ü¤¤´Ä±¤¹•Ñ…ä ¤ì(€€€€€€€€€É•ÑÕÉ¸€ñ‰ÕÑÑ½¸­•äõí‘ôÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùÍ•ÑM•±•Ñ•‘…ä¡­•ä¥ô(€€€€€€€€€€€±…ÍÍ9…µ”õíµ¥¸µÜ´À µlÔáÁátÍ´é µlØÑÁátÉ½Õ¹‘•µ±œ™±•à™±•àµ½°¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµÍÑ…ÉĞÁĞ´È¸ÔÁà´À¸Ô½Ù•É™±½Üµ¡¥‘‘•¸€‘íÍ•°ü‰œµÙ¥½±•Ğ´ØÀÀÑ•áĞµİ¡¥Ñ”œé…Ñ¥Ù”ü‰œµÙ¥½±•Ğ´ÔÀÑ•áĞµÙ¥½±•Ğ´ÜÀÀœé‘½ÜôôôÀü‰œµÉ•´ÔÀ¼ÔÀÑ•áĞµÉ•´ĞÀÀœé‘½ÜôôôØü‰œµ‰±Õ”´ÔÀ¼ÔÀÑ•áĞµ‰±Õ”´ĞÀÀœè‰œµÉ…ä´ÔÀÑ•áĞµÉ…ä´ÔÀÀõôø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁát™½¹ĞµÍ•µ¥‰½±±•…‘¥¹œµ¹½¹”Í¡É¥¹¬´Àˆùí‘ôğ½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õí µlÌÉÁátµĞ´Ä¸ÔÑ•áĞµlØ¸ÕÁátÍ´éÑ•áĞµlİÁát±•…‘¥¹œµlåÁát™½¹ĞµÍ•µ¥‰½±Ñ•áĞµ•¹Ñ•Èİ¡¥Ñ•ÍÁ…”µ¹½İÉ…ÀÍ¡É¥¹¬´À€‘íÍ•°üÑ•áĞµİ¡¥Ñ”¼äÀœèÑ•áĞµÉ…ä´ØÀÀõôø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíà¹¡ÌøÀüœœè¥¹Ù¥Í¥‰±”ôù!Lí™µÑ½Õ¹Ğ¡à¹¡Ì¥ôğ½‘¥Øø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíà¹Í¥´øÀüœœè¥¹Ù¥Í¥‰±”ôùM%459@í™µÑ½Õ¹Ğ¡à¹Í¥´¥ôğ½‘¥Øø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíà¹¡½µ”øÀüœœè¥¹Ù¥Í¥‰±”ôû¶f í™µÑ½Õ¹Ğ¡à¹¡½µ”¥ôğ½‘¥Øø(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€ğ½‰ÕÑÑ½¸øì(€€€€€€€ô¥ô(€€€€€€ğ½‘¥Øø(€€€€ğ½‘¥Øø((€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰½É‘•ÈµĞ‰½É‘•ÈµÉ…ä´ÄÀÀˆø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Áà´ĞÁä´Ì‰œµÉ…ä´ÔÀ¼ÜÀˆø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•Ñİ••¸ˆø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´™½¹Ğµ‰½±Ñ•áĞµÉ…ä´àÀÀˆùíÁ…ÉÍ•%¹Ğ¡Í•±•Ñ•‘…ä°ÄÀ¥÷²vğƒ²²àğ½‘¥Øø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀˆû²z®‚”í™µÑ½Õ¹Ğ¡Í•±•Ñ•¹¥¹ÁÕĞ¥÷®ªƒ
Üƒ®¾ã²z®‚”í™µÑ½Õ¹Ğ¡5…Ñ ¹µ…à À±Í½Á•¹±•¹Ñ µÍ•±•Ñ•¹¥¹ÁÕĞµÍ•±•Ñ•¹½™˜¤¥÷®ªƒ
Üƒ¶rÓ®²Ğí™µÑ½Õ¹Ğ¡Í•±•Ñ•¹½™˜¥÷®ªğ½‘¥Øø(€€€€€€€€ğ½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É¥É¥µ½±Ì´Ì…À´ÈµĞ´Èˆø(€€€€€€€€€íml!Lœ±Í•±•Ñ•¹¡Ít±lM%459@œ±Í•±•Ñ•¹Í¥µt±lŸ¶f œ±Í•±•Ñ•¹¡½µ•t±lœÉ9œ±Í•±•Ñ•¹Í•½¹‘t±lŸ¶R®š°œ±Í•±•Ñ•¹™É••t±lŸ²*“¶f œ±Í•±•Ñ•¹Íµ…ÉÑut¹µ…À ¡m±…‰•°±Ù…±Õ•t¤ôøñ‘¥Ø­•äõí±…‰•±ô±…ÍÍ9…µ”ô‰É½Õ¹‘•µ±œ‰œµİ¡¥Ñ”‰½É‘•È‰½É‘•ÈµÉ…ä´ÄÀÀÁà´ÈÁä´ÈÑ•áĞµ•¹Ñ•Èˆøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlåÁátÑ•áĞµÉ…ä´ĞÀÀˆùí±…‰•±ôğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌ™½¹Ğµ‰½±Ñ•áĞµÉ…ä´àÀÀµĞ´À¸Ôˆùí™µÑ½Õ¹Ğ¡Ù…±Õ”¥÷ªÆĞğ½‘¥Øøğ½‘¥Øø¥ô(€€€€€€€€ğ½‘¥Øø(€€€€€€ğ½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‘¥Ù¥‘”µä‘¥Ù¥‘”µÉ…ä´ÔÀµ…àµ ´ÜÈ½Ù•É™±½Üµäµ…ÕÑ¼ˆø(€€€€€€€í•µÁ±½å•••Ñ…¥±Ì¹µ…À ¡í•µÀ±¡Ì±Í¥´±¡½µ”±¡…Ì±½™™ô¤ôøñ‘¥Ø­•äõí•µÀ¹¥‘ô±…ÍÍ9…µ”ô‰Áà´ĞÁä´È¸Ô™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•Ñİ••¸…À´Ìˆø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µ¥¸µÜ´Àˆøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÉ…ä´ÜÀÀÑÉÕ¹…Ñ”ˆùí•µÀ¹¹…µ•ôğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlåÁátÑ•áĞµÉ…ä´ĞÀÀˆùí½™˜üŸ¶rÓ®²Ğœé¡…ÌüŸ²z®‚”ƒ²f®0œèŸ®¾ã²z®‚”ôğ½‘¥Øøğ½‘¥Øø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ÔÀÀÑ•áĞµÉ¥¡ĞÍ¡É¥¹¬´Àˆùí½™˜üŸŠPœé!L€‘í™µÑ½Õ¹Ğ¡¡Ì¥ôƒ
ÜM%459@€‘í™µÑ½Õ¹Ğ¡Í¥´¥ôƒ
Üƒ¶f €‘í™µÑ½Õ¹Ğ¡¡½µ”¥õôğ½‘¥Øø(€€€€€€€€ğ½‘¥Øø¥ô(€€€€€€ğ½‘¥Øø(€€€€ğ½‘¥Øø(€€ğ½‘¥Øøì)ô(()™Õ¹Ñ¥½¸A•É™½Éµ…¹•¡•­A…¹•°¡ìµ½¹Ñ °É½İÌ°‘…¥±åI•½É‘Ì°•µÁ±½å••Ìô¤ì(€½¹ÍĞmÍ•±•Ñ•‘…ä±Í•ÑM•±•Ñ•‘…åtõÕÍ•MÑ…Ñ”  ¤ôùì(€€€½¹ÍĞ¹½Üõ¹•Ü…Ñ” ¤íÉ•ÑÕÉ¸µ½¹Ñ¡-•å=˜¡¹½Ü¤ôôõµ½¹Ñ ıMÑÉ¥¹œ¡¹½Ü¹•Ñ…Ñ” ¤¤¹Á…‘MÑ…ÉĞ È°œÀœ¤èœÀÄœì(€ô¤ì(€½¹ÍĞmÙ•É¥™¥•‘5…À±Í•ÑY•É¥™¥•‘5…ÁtõÕÍ•MÑ…Ñ”¡íô¤ì(€ÕÍ•™™•Ğ  ¤ôùì(€€€€¡…Íå¹Œ ¤ôùì(€€€€€½¹ÍĞí‘…Ñ…ôõ…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ µ…¹…•É}•Ù…±}µ½¹Ñ¡±äœ¤¹Í•±•Ğ ÍÑ½É•}¹…µ”±Ù•É¥™¥•‘}µ•ÑÉ¥Ì±Ù•É¥™¥•‘}…Ğœ¤¹•Ä µ½¹Ñ œ±µ½¹Ñ ¤ì(€€€€€½¹ÍĞµ…Àõíôì¡‘…Ñ…ññmt¤¹™½É… ¡àôùµ…Ámà¹ÍÑ½É•}¹…µ•tõà¤íÍ•ÑY•É¥™¥•‘5…À¡µ…À¤ì(€€€ô¤ ¤ì(€ô±mµ½¹Ñ¡t¤ì(€½¹ÍĞİ½É­I½İÌô¡É½İÍññmt¤¹™¥±Ñ•È¡Èôø…9=9}M1M}MQ=IL¹¥¹±Õ‘•Ì¡È¹‰É…¹ ¤¤ì(€½¹ÍĞµ¥ÍÍ¥¹œõİ½É­I½İÌ¹™¥±Ñ•È¡Èôø…‘…å!…Í…Ñ„¡‘…¥±åI•½É‘Ìü¹mÈ¹¥‘tü¹mÍ•±•Ñ•‘…åt¤¤ì(€½¹ÍĞ‘ÕÁ±¥…Ñ•Ìõmtì(€€¼¼ƒªÂg²v ƒ®
ƒ²s²^@ƒ®>g²vğƒªÎƒªÂw®ª²vĞ€ËªÂpƒ²vÓ²²vàƒªÆÓ²v ƒ².“²‚pƒ²’G®ÎÔƒ²^³®Ú®–ğƒ²‚CªÊ¶Vc®>®†tƒ²V#®
Ğ(€½¹ÍĞm‘ÕÁ±¥…Ñ•I½İÌ±Í•ÑÕÁ±¥…Ñ•I½İÍtõÕÍ•MÑ…Ñ”¡mt¤ì(€ÕÍ•™™•Ğ  ¤ôùì(€€€€¡…Íå¹Œ ¤ôùì(€€€€€½¹ÍĞ‘…Ñ”õ€‘íµ½¹Ñ¡ô´‘íÍ•±•Ñ•‘…åõ€ì(€€€€€½¹ÍĞ¥‘Ìõİ½É­I½İÌ¹µ…À¡ÈôùÈ¹¥¤í¥˜ …¥‘Ì¹±•¹Ñ ¥íÍ•ÑÕÁ±¥…Ñ•I½İÌ¡mt¤íÉ•ÑÕÉ¸íô(€€€€€½¹ÍĞí‘…Ñ…ôõ…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ ÕÍÑ½µ•É}Í…±•Ìœ¤¹Í•±•Ğ ÕÍ•É}¥±ÕÍÑ½µ•É}¥±µ•ÑÉ¥}±…‰•°±ÕÍÑ½µ•ÉÌ¡ÕÍÑ½µ•É}¹…µ”¤œ¤¹¥¸ ÕÍ•É}¥œ±¥‘Ì¤¹•Ä Í…±•}‘…Ñ”œ±‘…Ñ”¤ì(€€€€€½¹ÍĞÉ½ÕÁÌõíôì¡‘…Ñ…ññmt¤¹™½É… ¡àôùí½¹ÍĞ¬õ€‘íà¹ÕÍ•É}¥‘õğ‘íà¹ÕÍÑ½µ•É}¥‘ññà¹ÕÍÑ½µ•ÉÌü¹ÕÍÑ½µ•É}¹…µ•ñğœõ€ì¡É½ÕÁÍm­uñğ¡É½ÕÁÍm­tõmt¤¤¹ÁÕÍ ¡à¤íô¤ì(€€€€€Í•ÑÕÁ±¥…Ñ•I½İÌ¡=‰©•Ğ¹•¹ÑÉ¥•Ì¡É½ÕÁÌ¤¹™¥±Ñ•È ¡l±…ÉÉt¤ôù…ÉÈ¹±•¹Ñ øôÈ¤¹µ…À ¡m¬±…ÉÉt¤ôø¡íÕÍ•É%é¬¹ÍÁ±¥Ğ ğœ¥lÁt±ÕÍÑ½µ•Èé…ÉÉlÁtü¹ÕÍÑ½µ•ÉÌü¹ÕÍÑ½µ•É}¹…µ•ñğŸ²vÓ®šƒ²^²v0œ±½Õ¹Ğé…ÉÈ¹±•¹Ñ ±±…‰•±Ìé…ÉÈ¹µ…À¡àôùà¹µ•ÑÉ¥}±…‰•°¥ô¤¤¤ì(€€€ô¤ ¤ì(€ô±mµ½¹Ñ ±Í•±•Ñ•‘…ä±É½İÍt¤ì((€É•ÑÕÉ¸€ñ‘¥Ø±…ÍÍ9…µ”ô‰ÍÁ…”µä´Ìˆø(€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµİ¡¥Ñ”É½Õ¹‘•µá°‰½É‘•ÈÀ´Ğˆø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à©ÕÍÑ¥™äµ‰•Ñİ••¸…À´Ì¥Ñ•µÌµ•¹ˆøñ‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÙ¥½±•Ğ´ÔÀÀˆû².“²‚ƒ²‚W¶fW²Äƒ²‚CªÊ ğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµ‰…Í”™½¹Ğµ‰½±µĞ´À¸Ôˆùíµ½¹Ñ¡1…‰•°¡µ½¹Ñ ¥ôƒ².“²‚ƒ²‚CªÊ ğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀµĞ´Äˆû²*ç²vàƒ®2ªâÀƒ®2².€ƒ®¾ã²z®‚—
ßªÒ®š³²z@ƒ²Ös².ƒ¶fPƒ²Â£²vÓ
ß²’G®ÎÔƒªÂ®*—²Ç²vƒ¶fW²vã¶V§®.#®.¸ğ½‘¥Øøğ½‘¥ØøñÍ•±•ĞÙ…±Õ”õíÍ•±•Ñ•‘…åô½¹¡…¹”õí”ôùÍ•ÑM•±•Ñ•‘…ä¡”¹Ñ…É•Ğ¹Ù…±Õ”¥ô±…ÍÍ9…µ”ô‰‰½É‘•ÈÉ½Õ¹‘•µ±œÁà´ÈÁä´ÈÑ•áĞµáÌˆùíÉÉ…ä¹™É½´¡í±•¹Ñ é‘…åÍ%¹5½¹Ñ ¡µ½¹Ñ ¥ô°¡|±¤¤ôùMÑÉ¥¹œ¡¤¬Ä¤¹Á…‘MÑ…ÉĞ È°œÀœ¤¤¹µ…À¡ôøñ½ÁÑ¥½¸­•äõí‘ôÙ…±Õ”õí‘ôùí9Õµ‰•È¡¥÷²vğğ½½ÁÑ¥½¸ø¥ôğ½Í•±•Ğøğ½‘¥Øø(€€€€ğ½‘¥Øø(€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É¥É¥µ½±Ì´Ì…À´Èˆø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµİ¡¥Ñ”É½Õ¹‘•µá°‰½É‘•ÈÀ´Ìˆøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀˆû®¾ã²z®‚”ƒ²²n@ğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµá°™½¹Ğµ‰½±Ñ•áĞµÉ•´ÔÀÀµĞ´Äˆùíµ¥ÍÍ¥¹œ¹±•¹Ñ¡÷®ªğ½‘¥Øøğ½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµİ¡¥Ñ”É½Õ¹‘•µá°‰½É‘•ÈÀ´Ìˆøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀˆû²’G®ÎÔƒ¶fW²vàƒ¶V²jPğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµá°™½¹Ğµ‰½±Ñ•áĞµ…µ‰•È´ØÀÀµĞ´Äˆùí‘ÕÁ±¥…Ñ•I½İÌ¹±•¹Ñ¡÷ªÆĞğ½‘¥Øøğ½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµİ¡¥Ñ”É½Õ¹‘•µá°‰½É‘•ÈÀ´Ìˆøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀˆûªÒ®š³²z@ƒ²Ös².ƒ¶fPƒ®“²z”ğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµá°™½¹Ğµ‰½±Ñ•áĞµÙ¥½±•Ğ´ÜÀÀµĞ´Äˆùí=‰©•Ğ¹­•åÌ¡Ù•É¥™¥•‘5…À¤¹±•¹Ñ¡÷ªÂpğ½‘¥Øøğ½‘¥Øø(€€€€ğ½‘¥Øø(€€€íµ¥ÍÍ¥¹œ¹±•¹Ñ øÀ˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµİ¡¥Ñ”É½Õ¹‘•µá°‰½É‘•È½Ù•É™±½Üµ¡¥‘‘•¸ˆøñ‘¥Ø±…ÍÍ9…µ”ô‰Áà´ĞÁä´Ì‰½É‘•Èµˆ™½¹Ğµ‰½±Ñ•áĞµÍ´ˆùí9Õµ‰•È¡Í•±•Ñ•‘…ä¥÷²vğƒ®¾ã²z®‚”ğ½‘¥Øùíµ¥ÍÍ¥¹œ¹µ…À¡Èôøñ‘¥Ø­•äõíÈ¹¥‘ô±…ÍÍ9…µ”ô‰Áà´ĞÁä´È¸Ô‰½É‘•Èµˆ±…ÍĞé‰½É‘•È´À™±•à©ÕÍÑ¥™äµ‰•Ñİ••¸Ñ•áĞµáÌˆøñÍÁ…¸øñˆùíÈ¹¹…µ•ôğ½ˆøƒ
Üí‘¥ÍÁ±…åMÑ½É•9…µ”¡È¹‰É…¹ ¥ôğ½ÍÁ…¸øñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµÉ•´ÔÀÀˆû²z®‚”ƒ²^²v0ğ½ÍÁ…¸øğ½‘¥Øø¥ôğ½‘¥Øùô(€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµİ¡¥Ñ”É½Õ¹‘•µá°‰½É‘•È½Ù•É™±½Üµ¡¥‘‘•¸ˆøñ‘¥Ø±…ÍÍ9…µ”ô‰Áà´ĞÁä´Ì‰½É‘•Èµˆˆøñ‘¥Ø±…ÍÍ9…µ”ô‰™½¹Ğµ‰½±Ñ•áĞµÍ´ˆû²²n@ƒ²z®‚”ÙÌƒªÒ®š³²z@ƒ¶fW²vàğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀµĞ´Äˆû¶>'ªÂ²v`ƒŠc².“²‚ƒ²Ös².ƒ¶fSŠg²^C²pƒ²‚²z—¶VpƒªÒ®š³²z@ƒ¶fW²vãªÂKªÎğƒ¶b²z°ƒ²²n@ƒ²z®‚”ƒ®"²‚²vƒ®æªÖC¶V§®.#®.¸ğ½‘¥Øøğ½‘¥Øùíİ½É­I½İÌ¹µ…À¡Èôùí½¹ÍĞØõÙ•É¥™¥•‘5…ÁmÈ¹‰É…¹¡tü¹Ù•É¥™¥•‘}µ•ÑÉ¥Ìì¥˜ …Ø¥É•ÑÕÉ¸¹Õ±°ì½¹ÍĞ¡Ìõ¡Í½Õ¹Ğ¡È¹‘É…™Ğ¤±¡½µ”õ½µÁ±•Ñ•‘!½µ•½Õ¹Ğ¡È¹‘É…™Ğ¤íÉ•ÑÕÉ¸€ñ‘¥Ø­•äõíÈ¹¥‘ô±…ÍÍ9…µ”ô‰Áà´ĞÁä´È¸Ô‰½É‘•Èµˆ±…ÍĞé‰½É‘•È´ÀÑ•áĞµáÌˆøñ‘¥Ø±…ÍÍ9…µ”ô‰™½¹ĞµÍ•µ¥‰½±ˆùíÈ¹¹…µ•ôƒ
Üí‘¥ÍÁ±…åMÑ½É•9…µ”¡È¹‰É…¹ ¥ôğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ÔÀÀµĞ´Äˆû²²nC²z®‚”!Lí™µÑ½Õ¹Ğ¡¡Ì¥ô€¼ƒ¶f í™µÑ½Õ¹Ğ¡¡½µ”¥ôƒ
Üƒ®“²z”ƒªÒ®š³²zC¶fW²và!Lí™µÑ½Õ¹Ğ¡Ø¹¡ÍñğÀ¥ô€¼ƒ¶f í™µÑ½Õ¹Ğ¡Ø¹¡½µ•ñğÀ¥ôğ½‘¥Øøğ½‘¥Øùô¥ôğ½‘¥Øø(€€€í‘ÕÁ±¥…Ñ•I½İÌ¹±•¹Ñ øÀ˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµ…µ‰•È´ÔÀÉ½Õ¹‘•µá°‰½É‘•È‰½É‘•Èµ…µ‰•È´ÄÀÀ½Ù•É™±½Üµ¡¥‘‘•¸ˆøñ‘¥Ø±…ÍÍ9…µ”ô‰Áà´ĞÁä´Ì™½¹Ğµ‰½±Ñ•áĞµÍ´Ñ•áĞµ…µ‰•È´àÀÀˆû²’G®ÎÔƒªÂ®*”ƒ¶2C®“ªÆĞğ½‘¥Øùí‘ÕÁ±¥…Ñ•I½İÌ¹µ…À ¡à±¤¤ôùí½¹ÍĞ•µÀô¡•µÁ±½å••Íññmt¤¹™¥¹¡”ôù”¹¥ôôõà¹ÕÍ•É%¤íÉ•ÑÕÉ¸€ñ‘¥Ø­•äõí¥ô±…ÍÍ9…µ”ô‰Áà´ĞÁä´È¸Ô‰½É‘•ÈµĞ‰½É‘•Èµ…µ‰•È´ÄÀÀÑ•áĞµáÌˆøñˆùí•µÀü¹¹…µ•ñğŸ²²n@ôğ½ˆøƒ
Üíà¹ÕÍÑ½µ•Éôƒ
Üíà¹½Õ¹Ñ÷ªÂpƒ¶V·®ª¤€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµÉ…ä´ĞÀÀˆø¡íà¹±…‰•±Ì¹©½¥¸ œ€¼€œ¥ô¤ğ½ÍÁ…¸øğ½‘¥Øùô¥ôğ½‘¥Øùô(€€ğ½‘¥Øøì)ô(()™Õ¹Ñ¥½¸‘µ¥¹áÁ•¹Í•=Ù•ÉÙ¥•Ü¡íµ½¹Ñ ±•µÁ±½å••Ìõmt±±½¥¹	É…¹ ôœœ±…¹Mİ¥Ñ¡MÑ½É•Ìõ™…±Í•ô¥ì(€½¹ÍĞÍ½Á•ô¡•µÁ±½å••Íññmt¤¹™¥±Ñ•È¡”ôù…¹Mİ¥Ñ¡MÑ½É•Íñğ…±½¥¹	É…¹ ıÑÉÕ”é”¹‰É…¹ ôôõ±½¥¹	É…¹ ¤ì(€½¹ÍĞmÉ½İÌ±Í•ÑI½İÍtõÕÍ•MÑ…Ñ”¡mt¤±m±½…‘¥¹œ±Í•Ñ1½…‘¥¹tõÕÍ•MÑ…Ñ”¡ÑÉÕ”¤±m±½…‘ÉÉ½È±Í•Ñ1½…‘ÉÉ½ÉtõÕÍ•MÑ…Ñ” œœ¤ì(€ÕÍ•™™•Ğ  ¤ôùì(€€€½¹ÍĞ¥‘ÌõÍ½Á•¹µ…À¡”ôù”¹¥¤ì(€€€¥˜ …¥‘Ì¹±•¹Ñ ¥íÍ•ÑI½İÌ¡mt¤íÍ•Ñ1½…‘ÉÉ½È œœ¤íÍ•Ñ1½…‘¥¹œ¡™…±Í”¤íÉ•ÑÕÉ¹ô(€€€€¡…Íå¹Œ ¤ôùì(€€€€€Í•Ñ1½…‘¥¹œ¡ÑÉÕ”¤íÍ•Ñ1½…‘ÉÉ½È œœ¤ì(€€€€€½¹ÍĞmä±µtõµ½¹Ñ ¹ÍÁ±¥Ğ œ´œ¤¹µ…À¡9Õµ‰•È¤±¸õ¹•Ü…Ñ”¡ä±´°Ä¤±Ñ¼õ€‘í¸¹•ÑÕ±±e•…È ¥ô´‘íMÑÉ¥¹œ¡¸¹•Ñ5½¹Ñ  ¤¬Ä¤¹Á…‘MÑ…ÉĞ È°œÀœ¥ô´ÀÅ€ì(€€€€€½¹ÍĞí‘…Ñ„±•ÉÉ½Éôõ…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ Í…±•Í}•áÁ•¹Í•Ìœ¤¹Í•±•Ğ œ¨œ¤¹¥¸ ÕÍ•É}¥œ±¥‘Ì¤¹Ñ” •áÁ•¹Í•}‘…Ñ”œ±€‘íµ½¹Ñ¡ô´ÀÅ€¤¹±Ğ •áÁ•¹Í•}‘…Ñ”œ±Ñ¼¤¹½É‘•È •áÁ•¹Í•}‘…Ñ”œ±í…Í•¹‘¥¹œé™…±Í•ô¤ì(€€€€€¥˜¡•ÉÉ½È¥í½¹Í½±”¹•ÉÉ½È 5%8aA9M1=II=Hœ±•ÉÉ½È¤íÍ•ÑI½İÌ¡mt¤íÍ•Ñ1½…‘ÉÉ½È¡™É¥•¹‘±åÉÉ½È¡•ÉÉ½È¤¤íô(€€€€€•±Í”Í•ÑI½İÌ¡‘…Ñ…ññmt¤ì(€€€€€Í•Ñ1½…‘¥¹œ¡™…±Í”¤ì(€€€ô¤ ¤ì(€ô±mµ½¹Ñ ±Í½Á•¹µ…À¡”ôù”¹¥¤¹©½¥¸ ğœ¥t¤ì(€½¹ÍĞÑ½Ñ…°õÉ½İÌ¹É•‘Õ” ¡„±à¤ôù„­9Õµ‰•È¡à¹…µ½Õ¹ÑñğÀ¤°À¤ì(€É•ÑÕÉ¸€ñ‘¥Ø±…ÍÍ9…µ”ô‰ÍÁ…”µä´Ìˆøñ‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÙ¥½±•Ğ´ØÀÀ™½¹ĞµÍ•µ¥‰½±ˆû²b²^®æ²j¤€¼ƒ²b“¶6ğğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµá°™½¹Ğµ‰½±ˆùíµ½¹Ñ¡1…‰•°¡µ½¹Ñ ¥ôƒ
Üíİ½¸¡Ñ½Ñ…°¥ôğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀµĞ´ÄˆûªÒ®š³®ÊS²rƒ²²nC²vĞƒ²z®‚—¶Vpƒ²b²^®æ²j§²vƒ¶fW²vã¶V§®.#®.¸ğ½‘¥Øøğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµİ¡¥Ñ”É½Õ¹‘•µá°‰½É‘•È½Ù•É™±½Üµ¡¥‘‘•¸ˆùí±½…‘¥¹œüñ‘¥Ø±…ÍÍ9…µ”ô‰À´ĞÑ•áĞµÍ´Ñ•áĞµÉ…ä´ĞÀÀˆû®Ú#®~³²b“®*Pƒ²’D¸¸¸ğ½‘¥Øøé±½…‘ÉÉ½Èüñ‘¥Ø±…ÍÍ9…µ”ô‰À´Ğˆøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´™½¹Ğµ‰½±Ñ•áĞµÉ•´ÔÀÀˆû²b²^®æ²j§²vƒ®Ú#®~³²b“² ƒ®ªï¶Z#²ZÓ²jP¸ğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÅÁátÑ•áĞµÉ•´ĞÀÀµĞ´Äˆùí±½…‘ÉÉ½Éôğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀµĞ´ÈˆùMÕÁ…‰…Í—²v`Í…±•Í}•áÁ•¹Í•Ìƒ²†Ã¶j0ƒ²‚W²Æ¡I1L§²vƒ¶fW²vã¶VÓ²ó²ã²jP¸ğ½‘¥Øøğ½‘¥ØøéÉ½İÌ¹±•¹Ñ ôôôÀüñ‘¥Ø±…ÍÍ9…µ”ô‰À´ĞÑ•áĞµÍ´Ñ•áĞµÉ…ä´ĞÀÀˆû®NÇ®†w®Bpƒ²b²^®æ²j§²vĞƒ²^²ZÓ²jP¸ğ½‘¥ØøéÉ½İÌ¹µ…À¡àôùí½¹ÍĞ”õÍ½Á•¹™¥¹¡ØôùØ¹¥ôôõà¹ÕÍ•É}¥¤íÉ•ÑÕÉ¸€ñ‘¥Ø­•äõíà¹¥‘ô±…ÍÍ9…µ”ô‰À´Ì‰½É‘•Èµˆ±…ÍĞé‰½É‘•È´Àˆøñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à©ÕÍÑ¥™äµ‰•Ñİ••¸…À´Èˆøñ‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´™½¹Ğµ‰½±ˆùí”ü¹¹…µ•ñğŸ²²n@ô€ñÍÁ…¸±…ÍÍ9…µ”ô‰™½¹Ğµ¹½Éµ…°Ñ•áĞµÉ…ä´ĞÀÀˆû
Üí‘¥ÍÁ±…åMÑ½É•9…µ”¡”ü¹‰É…¹ ¥ôğ½ÍÁ…¸øğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÅÁátÑ•áĞµÉ…ä´ÔÀÀµĞ´Äˆùíà¹•áÁ•¹Í•}‘…Ñ•ôƒ
Üíà¹ÕÍÑ½µ•É}¹…µ•ñğŸ²vÓ®šƒ²^²v0ôƒ
Üíà¹…Ñ•½ÉåñğŸªâÃ¶ õíà¹µ•µ¼ı€ƒ
Ü€‘íà¹µ•µ½õ€èœôğ½‘¥Øøğ½‘¥Øøñˆ±…ÍÍ9…µ”ô‰Ñ•áĞµÉ•´ÔÀÀÍ¡É¥¹¬´Àˆøµíİ½¸¡à¹…µ½Õ¹Ğ¥ôğ½ˆøğ½‘¥Øøğ½‘¥Øùô¥ôğ½‘¥Øøğ½‘¥Øø)ô()½¹ÍĞ!}=%}aQI}%1L€ôl(€l¡½µ”œ°Ÿ¶f t±lÑØœ°QX£®Ú ¤t±lÍÕ‰M•ÑQ½Àœ°Ÿ®Ú²/¶Dt±lÍµ…ÉÑ!½µ”œ°Ÿ²*“®#¶*ã¶f t°(€l¥¹Ñ•É¹•ÑI•¹•Üœ°Ÿ²vã¶Ã®Üƒ²z³²V÷²‚Tt±lÑÙI•¹•Üœ°QXƒ²z³²V÷²‚Tt±lÍ½¹¼œ°Ÿ²3®àt°)tì)™Õ¹Ñ¥½¸•µÁÑå!•…‘=™™¥•5•ÑÉ¥Ì ¥ìÉ•ÑÕÉ¸íµ…ÑÉ¥àé•µÁÑå…å5…ÑÉ¥à ¤°¸¸¹=‰©•Ğ¹™É½µ¹ÑÉ¥•Ì¡!}=%}aQI}%1L¹µ…À ¡m­t¤ôùm¬°Át¤¥ôìô)™Õ¹Ñ¥½¸¹½Éµ…±¥é•!•…‘=™™¥•5•ÑÉ¥Ì¡É…Üõíô¥ì(€½¹ÍĞ‰…Í”õ•µÁÑå!•…‘=™™¥•5•ÑÉ¥Ì ¤ì(€½¹ÍĞµ…ÑÉ¥àõ•µÁÑå…å5…ÑÉ¥à ¤ì(€€¡É…Ü¹µ…ÑÉ¥áññmt¤¹™½É…  ¡É½Ü±É¤¤ôø¡É½İññmt¤¹™½É…  ¡Ø±¤¤ôùí¥˜¡µ…ÑÉ¥ámÉ¥t˜™¤ñµ…ÑÉ¥ámÉ¥t¹±•¹Ñ ¥µ…ÑÉ¥ámÉ¥um¥tõ9Õµ‰•È¡ÙñğÀ¥ô¤¤ì(€É•ÑÕÉ¸ì¸¸¹‰…Í”°¸¸¹É…Ü±µ…ÑÉ¥áôì)ô)™Õ¹Ñ¥½¸µ…ÑÉ¥áQ½Ñ…±Ğ¡µ…ÑÉ¥à±É¤¥íÉ•ÑÕÉ¸€¡µ…ÑÉ¥àü¹mÉ¥uññmt¤¹É•‘Õ” ¡Ì±Ø¤ôùÌ­9Õµ‰•È¡ÙñğÀ¤°À¥ô)™Õ¹Ñ¥½¸¡•…‘=™™¥•M½É•Ì¡µ•ÑÉ¥Ì±½¹™¥œ±µ½¹Ñ ¥ì(€½¹ÍĞõ•µÁÑå…ä ¤í¹µ…ÑÉ¥àõ¹½Éµ…±¥é•!•…‘=™™¥•5•ÑÉ¥Ì¡µ•ÑÉ¥Ì¤¹µ…ÑÉ¥àì(€½¹ÍĞµ•É•õ…ÁÁ±å…¥±åQ½É…™Ğ¡•µÁÑåÉ…™Ğ ¤±ìœÀÄœé‘ô±µ½¹Ñ ±½¹™¥œ¹…Ñ•½Éå5…À±½¹™¥œ¹¥‰å•½¹½±Õµ¹5…À¤ì(€½¹ÍĞÁ…äõ½µÁÕÑ•A…ä¡µ•É•°ŸªâÃ¶ œ°œÈÀÀÀ´ÀÄ´ÀÄœ±µ½¹Ñ ±½¹™¥œ°À¤ì(€½¹ÍĞ­Á¥I…Ñ”ô¡­•ä¤ôù9Õµ‰•È ¡½¹™¥œ¹­Á¥%Ñ•µÍññU1Q}-A%}%Q5L¤¹™¥¹¡àôùà¹­•äôôõ­•ä¤ü¹Á½¥¹ÑñğÀ¤ì(€½¹ÍĞ•áÑÉ…-Á¤õ9Õµ‰•È¡µ•ÑÉ¥Ì¹¡½µ•ñğÀ¤©­Á¥I…Ñ” ­Á¥!½µ”œ¤­9Õµ‰•È¡µ•ÑÉ¥Ì¹ÑÙñğÀ¤©­Á¥I…Ñ” ­Á¥QØœ¤(€€€€­9Õµ‰•È¡µ•ÑÉ¥Ì¹ÍÕ‰M•ÑQ½ÁñğÀ¤©­Á¥I…Ñ” ­Á¥QÙM•ÑQ½Àœ¤­9Õµ‰•È¡µ•ÑÉ¥Ì¹Íµ…ÉÑ!½µ•ñğÀ¤©­Á¥I…Ñ” ­Á¥Mµ…ÉÑ!½µ”œ¤(€€€€­9Õµ‰•È¡µ•ÑÉ¥Ì¹¥¹Ñ•É¹•ÑI•¹•İñğÀ¤©­Á¥I…Ñ” ­Á¥%¹Ñ•É¹•ÑI•¹•Üœ¤­9Õµ‰•È¡µ•ÑÉ¥Ì¹ÑÙI•¹•İñğÀ¤©­Á¥I…Ñ” ­Á¥QÙI•¹•Üœ¤ì(€½¹ÍĞ¡½µ•É…‘•A½¥¹ÑÌõ9Õµ‰•È¡µ•ÑÉ¥Ì¹¡½µ•ñğÀ¤­9Õµ‰•È¡µ•ÑÉ¥Ì¹ÑÙñğÀ¤­9Õµ‰•È¡µ•ÑÉ¥Ì¹Íµ…ÉÑ!½µ•ñğÀ¤¨À¸Ôì(€½¹ÍĞÉ…‘•A½¥¹ÑÌõÁ…ä¹µ½‰¥±•A½¥¹ÑÌ¬¡Á…ä¹µ½‰¥±•A½¥¹ÑÌù=9}Qı¡½µ•É…‘•A½¥¹ÑÌèÀ¤ì(€É•ÑÕÉ¸íÉ…‘•A½¥¹ÑÌ±­Á¥M½É”éÁ…ä¹­Á¥M½É”­•áÑÉ…-Á¤±¡ÌélÀ°Ä°È°Ì°Ñt¹É•‘Õ” ¡Ì±É¤¤ôùÌ­µ…ÑÉ¥áQ½Ñ…±Ğ¡µ•ÑÉ¥Ì¹µ…ÑÉ¥à±É¤¤°À¤±Í•½¹éµ…ÑÉ¥áQ½Ñ…±Ğ¡µ•ÑÉ¥Ì¹µ…ÑÉ¥à°Ü¥ôì)ô()™Õ¹Ñ¥½¸!•…‘=™™¥•…Ñ…A…¹•°¡íµ½¹Ñ ±•µÁ±½å••Ì±É½İÌ±½¹™¥œ±…ÕÑ¡UÍ•É%‘ô¥ì(€½¹ÍĞÍ…±•ÍµÁ±½å••Ìô¡•µÁ±½å••Íññmt¤¹™¥±Ñ•È¡”ôø…9=9}M1M}MQ=IL¹¥¹±Õ‘•Ì¡”¹‰É…¹ ¤¤ì(€½¹ÍĞÍÑ½É•ÌõÍ½ÉÑMÑ½É•Í	å=Á•¹=É‘•È¡l¸¸¹¹•ÜM•Ğ¡Í…±•ÍµÁ±½å••Ì¹µ…À¡”ôù”¹‰É…¹ ¤¥t¤ì(€½¹ÍĞmµ½‘”±Í•Ñ5½‘•tõÕÍ•MÑ…Ñ” ÍÑ½É”œ¤±mÁ•ÉÍ½¹…±I•½É‘Ì±Í•ÑA•ÉÍ½¹…±I•½É‘ÍtõÕÍ•MÑ…Ñ”¡íô¤±mÍÑ½É•I•½É‘Ì±Í•ÑMÑ½É•I•½É‘ÍtõÕÍ•MÑ…Ñ”¡íô¤ì(€½¹ÍĞmÍ•±•Ñ•‘MÑ½É”±Í•ÑM•±•Ñ•‘MÑ½É•tõÕÍ•MÑ…Ñ”¡ÍÑ½É•ÍlÁuñğœœ¤±mÍ•±•Ñ•‘%±Í•ÑM•±•Ñ•‘%‘tõÕÍ•MÑ…Ñ”¡Í…±•ÍµÁ±½å••ÍlÁtü¹¥‘ñğœœ¤ì(€½¹ÍĞ‘•™…Õ±ÑÍ=˜ô ¤ôù€‘íµ½¹Ñ¡ô´‘íMÑÉ¥¹œ¡5…Ñ ¹µ¥¸¡¹•Ü…Ñ” ¤¹•Ñ…Ñ” ¤±‘…åÍ%¹5½¹Ñ ¡µ½¹Ñ ¤¤¤¹Á…‘MÑ…ÉĞ È°œÀœ¥õ€ì(€½¹ÍĞm…Í=™…Ñ”±Í•ÑÍ=™…Ñ•tõÕÍ•MÑ…Ñ”¡‘•™…Õ±ÑÍ=˜ ¤¤ì(€½¹ÍĞmµ•ÑÉ¥Ì±Í•Ñ5•ÑÉ¥ÍtõÕÍ•MÑ…Ñ”¡•µÁÑå!•…‘=™™¥•5•ÑÉ¥Ì ¤¤±mÙ…ÍI•Ù¥•Ü±Í•ÑY…ÍI•Ù¥•İtõÕÍ•MÑ…Ñ”¡íô¤±m¹½Ñ”±Í•Ñ9½Ñ•tõÕÍ•MÑ…Ñ” œœ¤±mÍ…Ù¥¹œ±Í•ÑM…Ù¥¹tõÕÍ•MÑ…Ñ”¡™…±Í”¤±m±½…‘¥¹œ±Í•Ñ1½…‘¥¹tõÕÍ•MÑ…Ñ”¡ÑÉÕ”¤ì(€½¹ÍĞ±½…õÕÍ•…±±‰…¬¡…Íå¹Œ ¤ôùíÍ•Ñ1½…‘¥¹œ¡ÑÉÕ”¤í½¹ÍĞmÀ±Ítõ…İ…¥ĞAÉ½µ¥Í”¹…±°¡mÍÕÁ…‰…Í”¹™É½´ ¡•…‘}½™™¥•}Á•É™½Éµ…¹”œ¤¹Í•±•Ğ œ¨œ¤¹•Ä µ½¹Ñ œ±µ½¹Ñ ¤±ÍÕÁ…‰…Í”¹™É½´ ¡•…‘}½™™¥•}ÍÑ½É•}Á•É™½Éµ…¹”œ¤¹Í•±•Ğ œ¨œ¤¹•Ä µ½¹Ñ œ±µ½¹Ñ ¥t¤í¥˜¡À¹•ÉÉ½ÉññÌ¹•ÉÉ½È¥íÍ¡½İ1•…å±•ÉĞ¡ƒ®Îã²
°ƒ®6Ã²vÓ¶Àƒ®Ú#®~³²b“ªâÀƒ².“¶2 è€‘í™É¥•¹‘±åÉÉ½È¡À¹•ÉÉ½ÉññÌ¹•ÉÉ½È¥õ€¥õÍ•ÑA•ÉÍ½¹…±I•½É‘Ì¡=‰©•Ğ¹™É½µ¹ÑÉ¥•Ì ¡À¹‘…Ñ…ññmt¤¹µ…À¡àôùmà¹ÕÍ•É}¥±át¤¤¤íÍ•ÑMÑ½É•I•½É‘Ì¡=‰©•Ğ¹™É½µ¹ÑÉ¥•Ì ¡Ì¹‘…Ñ…ññmt¤¹µ…À¡àôùmà¹ÍÑ½É•}¹…µ”±át¤¤¤íÍ•Ñ1½…‘¥¹œ¡™…±Í”¥ô±mµ½¹Ñ¡t¤ì(€ÕÍ•™™•Ğ  ¤ôùí±½… ¥ô±m±½…‘t¤ì(€ÕÍ•™™•Ğ  ¤ôùíÍ•ÑÍ=™…Ñ”¡‘•™…Õ±ÑÍ=˜ ¤¥ô±mµ½¹Ñ¡t¤ì€¼¼•Í±¥¹Ğµ‘¥Í…‰±”µ±¥¹”(€½¹ÍĞÙ¥Í¥‰±”õÍ…±•ÍµÁ±½å••Ì¹™¥±Ñ•È¡”ôù”¹‰É…¹ ôôõÍ•±•Ñ•‘MÑ½É”¤ì(€ÕÍ•™™•Ğ  ¤ôùí¥˜¡Ù¥Í¥‰±”¹±•¹Ñ ˜˜…Ù¥Í¥‰±”¹Í½µ”¡”ôù”¹¥ôôõÍ•±•Ñ•‘%¤¥Í•ÑM•±•Ñ•‘%¡Ù¥Í¥‰±•lÁt¹¥¥ô±mÍ•±•Ñ•‘MÑ½É”±Ù¥Í¥‰±”¹µ…À¡”ôù”¹¥¤¹©½¥¸ ğœ¥t¤ì€¼¼•Í±¥¹Ğµ‘¥Í…‰±”µ±¥¹”(€½¹ÍĞÍ•±•Ñ•õÍ…±•ÍµÁ±½å••Ì¹™¥¹¡”ôù”¹¥ôôõÍ•±•Ñ•‘%¤ì(€½¹ÍĞÑ…É•ÑI•½Éõµ½‘”ôôôÍÑ½É”œıÍÑ½É•I•½É‘ÍmÍ•±•Ñ•‘MÑ½É•téÁ•ÉÍ½¹…±I•½É‘ÍmÍ•±•Ñ•‘%‘tì(€ÕÍ•™™•Ğ  ¤ôùíÍ•Ñ5•ÑÉ¥Ì¡¹½Éµ…±¥é•!•…‘=™™¥•5•ÑÉ¥Ì¡Ñ…É•ÑI•½Éü¹µ•ÑÉ¥Íññíô¤¤íÍ•ÑY…ÍI•Ù¥•Ü¡Ñ…É•ÑI•½Éü¹Ù…Í}É•Ù¥•İññíô¤íÍ•Ñ9½Ñ”¡Ñ…É•ÑI•½Éü¹¹½Ñ•ñğœœ¤íÍ•ÑÍ=™…Ñ”¡Ñ…É•ÑI•½Éü¹…Í}½™}‘…Ñ•ññ‘•™…Õ±ÑÍ=˜ ¤¥ô±mµ½‘”±Í•±•Ñ•‘MÑ½É”±Í•±•Ñ•‘%±Ñ…É•ÑI•½É‘t¤ì€¼¼•Í±¥¹Ğµ‘¥Í…‰±”µ±¥¹”(€½¹ÍĞÑ…É•ÑI½İÌõµ½‘”ôôôÍÑ½É”œü¡É½İÍññmt¤¹™¥±Ñ•È¡ÈôùÈ¹‰É…¹ ôôõÍ•±•Ñ•‘MÑ½É”¤è¡É½İÍññmt¤¹™¥±Ñ•È¡ÈôùÈ¹¥ôôõÍ•±•Ñ•‘%¤ì(€½¹ÍĞ¥¹ÁÕÑ5…ÑÉ¥àõ•µÁÑå…å5…ÑÉ¥à ¤ì(€Ñ…É•ÑI½İÌ¹™½É… ¡Èôø¡È¹‘É…™Ğü¹µ…ÑÉ¥áññmt¤¹™½É…  ¡…ÉÈ±É¤¤ôø¡…ÉÉññmt¤¹™½É…  ¡Ø±¤¤ôùí¥˜¡¥¹ÁÕÑ5…ÑÉ¥ámÉ¥t¥¥¹ÁÕÑ5…ÑÉ¥ámÉ¥um¥t¬õ9Õµ‰•È¡ÙñğÀ¥ô¤¤¤ì(€½¹ÍĞ‰Õ¹‘±•½Õ¹ĞõÑ…É•ÑI½İÌ¹É•‘Õ” ¡Ì±È¤ôùÌ­=‰©•Ğ¹Ù…±Õ•Ì¡È¹‘É…™Ğü¹‰Õ¹‘±”É¹‘ññíô¤¹É•‘Õ” ¡„±Ø¤ôù„­9Õµ‰•È¡ÙñğÀ¤°À¤°À¤ì(€½¹ÍĞ¥¹ÁÕÑáÑÉ…Ìõì(€€€¡½µ”éÑ…É•ÑI½İÌ¹É•‘Õ” ¡Ì±È¤ôùÌ­½µÁ±•Ñ•‘!½µ•½Õ¹Ğ¡È¹‘É…™Ğ¤°À¤°(€€€ÑØéÑ…É•ÑI½İÌ¹É•‘Õ” ¡Ì±È¤ôùÌ­9Õµ‰•È¡È¹‘É…™Ğü¹¡½µ•	…Í”ü¹¡½µ•QÙñğÀ¤°À¤°(€€€ÍÕ‰M•ÑQ½ÀéÑ…É•ÑI½İÌ¹É•‘Õ” ¡Ì±È¤ôùÌ­9Õµ‰•È¡È¹‘É…™Ğü¹¡½µ•‘‘½¸ü¹…‘‘M•ÑQ½ÁñğÀ¤°À¤°(€€€Íµ…ÉÑ!½µ”éÑ…É•ÑI½İÌ¹É•‘Õ” ¡Ì±È¤ôùÌ­9Õµ‰•È¡È¹‘É…™Ğü¹¡½µ•±…Ğü¹Íµ…ÉÑ!½µ•ñğÀ¤°À¤°(€€€¥¹Ñ•É¹•ÑI•¹•ÜéÑ…É•ÑI½İÌ¹É•‘Õ” ¡Ì±È¤ôùÌ­=‰©•Ğ¹Ù…±Õ•Ì¡È¹‘É…™Ğü¹É•¹•İññíô¤¹É•‘Õ” ¡„±Ø¤ôù„­9Õµ‰•È¡ÙñğÀ¤°À¤°À¤°(€€€ÑÙI•¹•ÜèÀ°(€€€Í½¹¼éÑ…É•ÑI½İÌ¹É•‘Õ” ¡Ì±È¤ôùÌ­=‰©•Ğ¹Ù…±Õ•Ì¡È¹‘É…™Ğü¹Í½¹½ññíô¤¹É•‘Õ” ¡„±Ø¤ôù„­9Õµ‰•È¡ÙñğÀ¤°À¤°À¤°(€ôì(€½¹ÍĞ¥¹ÁÕÑY…Ìõíôì¡½¹™¥œ¹Ù…ÍññU1Q}YL¤¹™½É… ¡Øôù¥¹ÁÕÑY…ÍmØ¹­•åtõÑ…É•ÑI½İÌ¹É•‘Õ” ¡Ì±È¤ôùÌ­9Õµ‰•È¡È¹‘É…™Ğü¹Ù…Ìü¹mØ¹­•åuñğÀ¤°À¤¤ì(€½¹ÍĞ½™™¥¥…°õ¡•…‘=™™¥•M½É•Ì¡µ•ÑÉ¥Ì±½¹™¥œ±µ½¹Ñ ¤ì(€½¹ÍĞ•µÁ±½å•”õí¡ÌéÑ…É•ÑI½İÌ¹É•‘Õ” ¡Ì±È¤ôùÌ­¡Í½Õ¹Ğ¡È¹‘É…™Ñññíô¤°À¤±Í•½¹éµ…ÑÉ¥áQ½Ñ…±Ğ¡¥¹ÁÕÑ5…ÑÉ¥à°Ü¤­‰Õ¹‘±•½Õ¹Ğ±É…‘•A½¥¹ÑÌéÑ…É•ÑI½İÌ¹É•‘Õ” ¡Ì±È¤ôùÌ­9Õµ‰•È¡È¹Á…äü¹Ñ½Ñ…±A½¥¹ÑÍñğÀ¤°À¤±­Á¥M½É”éÑ…É•ÑI½İÌ¹É•‘Õ” ¡Ì±È¤ôùÌ­9Õµ‰•È¡È¹Á…äü¹­Á¥M½É•ñğÀ¤°À¥ôì(€½¹ÍĞÕÁ‘…Ñ•5…ÑÉ¥àô¡É¤±¤±Ù…±Õ”¤ôùÍ•Ñ5•ÑÉ¥Ì¡Øôùí½¹ÍĞµ…ÑÉ¥àõØ¹µ…ÑÉ¥à¹µ…À¡Èôùl¸¸¹Ét¤íµ…ÑÉ¥ámÉ¥um¥tõ5…Ñ ¹µ…à À±9Õµ‰•È¡Ù…±Õ•ñğÀ¤¤íÉ•ÑÕÉ¸ì¸¸¹Ø±µ…ÑÉ¥áõô¤ì(€½¹ÍĞÍ…Ù”õ…Íå¹Œ ¤ôùí½¹ÍĞ¥ÍMÑ½É”õµ½‘”ôôôÍÑ½É”œí¥˜ ¡¥ÍMÑ½É”˜˜…Í•±•Ñ•‘MÑ½É”¥ñğ …¥ÍMÑ½É”˜˜…Í•±•Ñ•¤¥É•ÑÕÉ¸íÍ•ÑM…Ù¥¹œ¡ÑÉÕ”¤í½¹ÍĞ½µµ½¸õíµ½¹Ñ ±ÍÑ½É•}¹…µ”é¥ÍMÑ½É”ıÍ•±•Ñ•‘MÑ½É”éÍ•±•Ñ•¹‰É…¹ ±…Í}½™}‘…Ñ”é…Í=™…Ñ”±µ•ÑÉ¥Ì±Ù…Í}É•Ù¥•ÜéÙ…ÍI•Ù¥•Ü±¹½Ñ”é¹½Ñ”¹ÑÉ¥´ ¥ññ¹Õ±°±ÕÁ‘…Ñ•‘}‰äé…ÕÑ¡UÍ•É%±ÕÁ‘…Ñ•‘}…Ğé¹•Ü…Ñ” ¤¹Ñ½%M=MÑÉ¥¹œ ¥ôí½¹ÍĞÁ…å±½…õ¥ÍMÑ½É”ı½µµ½¸éì¸¸¹½µµ½¸±ÕÍ•É}¥éÍ•±•Ñ•¹¥‘ôí½¹ÍĞÑ…‰±”õ¥ÍMÑ½É”ü¡•…‘}½™™¥•}ÍÑ½É•}Á•É™½Éµ…¹”œè¡•…‘}½™™¥•}Á•É™½Éµ…¹”œ±½¹™±¥Ğõ¥ÍMÑ½É”üµ½¹Ñ ±ÍÑ½É•}¹…µ”œèµ½¹Ñ ±ÕÍ•É}¥œí½¹ÍĞí•ÉÉ½Éôõ…İ…¥ĞÍÕÁ…‰…Í”¹™É½´¡Ñ…‰±”¤¹ÕÁÍ•ÉĞ¡Á…å±½…±í½¹½¹™±¥Ğé½¹™±¥Ñô¤íÍ•ÑM…Ù¥¹œ¡™…±Í”¤í¥˜¡•ÉÉ½È¥É•ÑÕÉ¸Í¡½İ1•…å±•ÉĞ¡ƒ®Îã²
°ƒ®6Ã²vÓ¶Àƒ²‚²z”ƒ².“¶2 è€‘í™É¥•¹‘±åÉÉ½È¡•ÉÉ½È¥õ€¤í…İ…¥Ğ±½… ¤íÍ¡½İ1•…å±•ÉĞ¡€‘í¥ÍMÑ½É”üŸ®“²z”œèŸªÂs²vàôƒ®Îã²
°ƒ®6Ã²vÓ¶Ã®–ğƒ²‚²z—¶Z#²ZÓ²jP¸ƒªÂs²vàƒ².“²‚ªÎğƒªâ'²^°ƒªÎ²
Ã²v ƒ®ÎªÊ÷¶Vc² ƒ²V+²Vc²*×®.#®.¹€¥ôì(€É•ÑÕÉ¸€ñ‘¥Ø±…ÍÍ9…µ”ô‰ÍÁ…”µä´Ìˆø(€€€€ñ‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÙ¥½±•Ğ´ØÀÀ™½¹ĞµÍ•µ¥‰½±ˆû®Îã²
°ƒ®6Ã²vÓ¶ÀƒªâÃ²’ ğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµá°™½¹Ğµ‰½±ˆùíµ½‘”ôôôÍÑ½É”œüŸ®“²z—®ÎœèŸªÂs²vã®Îôƒ®"²‚ƒ².“²‚ƒ®2²†Àğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀµĞ´Äˆû®“²z”ƒªâÃ²’²vĞƒªâÃ®Îã²z®.#®.¸ƒªÂs²vàƒªâÃ²’²v ƒªÂs²vã®Îƒ®Îã²
°ƒ²zC®3ªÂ ƒ²z#²vƒ®V3®0ƒ²ƒ¶w¶Vc²ã²jP¸ƒªâ'²^³²f ƒ²²n@ƒ²z®‚”ƒ²nC®Îã²v ƒ®ÎªÊ÷¶Vc² ƒ²V+²*×®.#®.¸ğ½‘¥Øøğ½‘¥Øø(€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É¥É¥µ½±Ì´È‰œµÉ…ä´ÄÀÀÉ½Õ¹‘•µá°À´Ä…À´Äˆøñ‰ÕÑÑ½¸½¹±¥¬õì ¤ôùÍ•Ñ5½‘” ÍÑ½É”œ¥ô±…ÍÍ9…µ”õíÁä´È¸ÔÉ½Õ¹‘•µ±œÑ•áĞµáÌ™½¹Ğµ‰½±€‘íµ½‘”ôôôÍÑ½É”œü‰œµİ¡¥Ñ”Ñ•áĞµÙ¥½±•Ğ´ÜÀÀÍ¡…‘½ÜµÍ´œèÑ•áĞµÉ…ä´ÔÀÀõôû®“²z”ƒªâÃ²’ ğ½‰ÕÑÑ½¸øñ‰ÕÑÑ½¸½¹±¥¬õì ¤ôùÍ•Ñ5½‘” Á•ÉÍ½¹…°œ¥ô±…ÍÍ9…µ”õíÁä´È¸ÔÉ½Õ¹‘•µ±œÑ•áĞµáÌ™½¹Ğµ‰½±€‘íµ½‘”ôôôÁ•ÉÍ½¹…°œü‰œµİ¡¥Ñ”Ñ•áĞµÙ¥½±•Ğ´ÜÀÀÍ¡…‘½ÜµÍ´œèÑ•áĞµÉ…ä´ÔÀÀõôûªÂs²vàƒªâÃ²’ ğ½‰ÕÑÑ½¸øğ½‘¥Øø(€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµİ¡¥Ñ”‰½É‘•ÈÉ½Õ¹‘•µá°À´ÌÉ¥É¥µ½±Ì´ÈÍ´éÉ¥µ½±Ì´Ğ…À´Èˆø(€€€€€€ñÍ•±•ĞÙ…±Õ”õíÍ•±•Ñ•‘MÑ½É•ô½¹¡…¹”õí”ôùÍ•ÑM•±•Ñ•‘MÑ½É”¡”¹Ñ…É•Ğ¹Ù…±Õ”¥ô±…ÍÍ9…µ”ô‰‰½É‘•ÈÉ½Õ¹‘•µ±œÁà´ÈÁä´ÈÑ•áĞµáÌˆùíÍÑ½É•Ì¹µ…À¡Ìôøñ½ÁÑ¥½¸­•äõíÍôÙ…±Õ”õíÍôùí‘¥ÍÁ±…åMÑ½É•9…µ”¡Ì¥ôğ½½ÁÑ¥½¸ø¥ôğ½Í•±•Ğø(€€€€€íµ½‘”ôôôÁ•ÉÍ½¹…°œüñÍ•±•ĞÙ…±Õ”õíÍ•±•Ñ•‘%‘ô½¹¡…¹”õí”ôùÍ•ÑM•±•Ñ•‘%¡”¹Ñ…É•Ğ¹Ù…±Õ”¥ô±…ÍÍ9…µ”ô‰‰½É‘•ÈÉ½Õ¹‘•µ±œÁà´ÈÁä´ÈÑ•áĞµáÌˆùíÙ¥Í¥‰±”¹µ…À¡”ôøñ½ÁÑ¥½¸­•äõí”¹¥‘ôÙ…±Õ”õí”¹¥‘ôùí”¹¹…µ•ôğ½½ÁÑ¥½¸ø¥ôğ½Í•±•Ğøèñ‘¥Ø±…ÍÍ9…µ”ô‰‰½É‘•ÈÉ½Õ¹‘•µ±œÁà´ÈÁä´ÈÑ•áĞµáÌÑ•áĞµÉ…ä´ÔÀÀ‰œµÉ…ä´ÔÀˆû²²n@ƒ²z®‚”ƒ¶V§ªÎíÑ…É•ÑI½İÌ¹±•¹Ñ¡÷®ªğ½‘¥Øùô(€€€€€€ñ¥¹ÁÕĞÑåÁ”ô‰‘…Ñ”ˆÙ…±Õ”õí…Í=™…Ñ•ô½¹¡…¹”õí”ôùÍ•ÑÍ=™…Ñ”¡”¹Ñ…É•Ğ¹Ù…±Õ”¥ô±…ÍÍ9…µ”ô‰‰½É‘•ÈÉ½Õ¹‘•µ±œÁà´ÈÁä´ÈÑ•áĞµáÌˆ¼ø(€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õíÍ…Ù•ô‘¥Í…‰±•õíÍ…Ù¥¹ññ±½…‘¥¹ñğ¡µ½‘”ôôôÍÑ½É”œü…Í•±•Ñ•‘MÑ½É”è…Í•±•Ñ•¥ô±…ÍÍ9…µ”ô‰É½Õ¹‘•µ±œ‰œµÙ¥½±•Ğ´ØÀÀÑ•áĞµİ¡¥Ñ”Ñ•áĞµáÌ™½¹Ğµ‰½±Áà´ÌÁä´È‘¥Í…‰±•é½Á…¥Ñä´ĞÀˆùíÍ…Ù¥¹œüŸ²‚²z”ƒ²’Dœé€‘íµ½‘”ôôôÍÑ½É”œüŸ®“²z”œèŸªÂs²vàôƒ®Îã²
°ƒ®6Ã²vÓ¶Àƒ²‚²z•ôğ½‰ÕÑÑ½¸ø(€€€€ğ½‘¥Øø(€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É¥É¥µ½±Ì´ÈÍ´éÉ¥µ½±Ì´Ğ…À´Èˆø(€€€€€íml!Lœ±•µÁ±½å•”¹¡Ì±½™™¥¥…°¹¡Ì°ŸªÆĞt±lœÉ9œ±•µÁ±½å•”¹Í•½¹±½™™¥¥…°¹Í•½¹°ŸªÆĞt±lŸ²ÇªÎó®NÇªâ%@œ±•µÁ±½å•”¹É…‘•A½¥¹ÑÌ±½™™¥¥…°¹É…‘•A½¥¹ÑÌ°@t±lŸ²w²
Ã²Å@œ±•µÁ±½å•”¹­Á¥M½É”±½™™¥¥…°¹­Á¥M½É”°@ut¹µ…À ¡m±…‰•°±¥¹ÁÕĞ±¡•…±Õ¹¥Ñt¤ôøñ‘¥Ø­•äõí±…‰•±ô±…ÍÍ9…µ”ô‰‰œµİ¡¥Ñ”‰½É‘•ÈÉ½Õ¹‘•µá°À´Ìˆøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀˆùí±…‰•±ôğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´™½¹Ğµ‰½±µĞ´Äˆû®Îã²
°í™µÑ9Õ´¡¡•…°Ä¥õíÕ¹¥Ñôğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ÔÀÀµĞ´Äˆû²²nC²z®‚”í™µÑ9Õ´¡¥¹ÁÕĞ°Ä¥õíÕ¹¥Ñôƒ
Üƒ²Â£²vĞí9Õµ‰•È¡¡•…µ¥¹ÁÕĞ¤øôÀüœ¬œèœõí™µÑ9Õ´¡¡•…µ¥¹ÁÕĞ°Ä¥õíÕ¹¥Ñôğ½‘¥Øøğ½‘¥Øø¥ô(€€€€ğ½‘¥Øø(€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµİ¡¥Ñ”‰½É‘•ÈÉ½Õ¹‘•µá°½Ù•É™±½Üµ¡¥‘‘•¸ˆø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Áà´ĞÁä´Ì‰½É‘•Èµˆˆøñ‘¥Ø±…ÍÍ9…µ”ô‰™½¹Ğµ‰½±Ñ•áĞµÍ´ˆûªÂ²z²rƒ¶bW
ß²jSªâ#²‚sªÖÀƒ®"²‚ğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀˆûªâÃ®Î½½®–ğƒ¶>³¶V£¶VĞƒ®Îã²
³²^C²pƒ¶fW²vã¶Vpíµ½‘”ôôôÍÑ½É”œüŸ®“²z”œèŸªÂs²vàôƒ²nPƒ®"²‚ƒªÆÓ²"c®–ğƒ²z®‚—¶Vc²ã²jP¸ğ½‘¥Øøğ½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰½Ù•É™±½Üµàµ…ÕÑ¼ˆøñÑ…‰±”±…ÍÍ9…µ”ô‰µ¥¸µÜµlàÔÁÁátÜµ™Õ±°Ñ•áĞµáÌˆøñÑ¡•…øñÑÈ±…ÍÍ9…µ”ô‰‰œµÉ…ä´ÔÀˆøñÑ ±…ÍÍ9…µ”ô‰Ñ•áĞµ±•™ĞÀ´ÈÍÑ¥­ä±•™Ğ´À‰œµÉ…ä´ÔÀˆûªÂ²z²rƒ¶bTğ½Ñ ùí5QI%a}=1L¹µ…À¡ŒôøñÑ ­•äõíô±…ÍÍ9…µ”ô‰À´ÈÑ•áĞµÉ…ä´ÔÀÀˆøñ½±!•…‘•È±…‰•°õíô¼øğ½Ñ ø¥ôñÑ ±…ÍÍ9…µ”ô‰À´Èˆû²²nC²z®‚”ƒ¶V§ªÎğ½Ñ øñÑ ±…ÍÍ9…µ”ô‰À´Èˆû²Â£²vĞğ½Ñ øğ½ÑÈøğ½Ñ¡•…øñÑ‰½‘äùí5QI%a}I=]}L¹µ…À ¡É±É¤¤ôùí½¹ÍĞ¥¹ÁÕĞõµ…ÑÉ¥áQ½Ñ…±Ğ¡¥¹ÁÕÑ5…ÑÉ¥à±É¤¤¬¡É¤ôôôÜı‰Õ¹‘±•½Õ¹ĞèÀ¤±¡•…õµ…ÑÉ¥áQ½Ñ…±Ğ¡µ•ÑÉ¥Ì¹µ…ÑÉ¥à±É¤¤íÉ•ÑÕÉ¸€ñÑÈ­•äõíÉ¹±…‰•±ô±…ÍÍ9…µ”ô‰‰½É‘•ÈµĞˆøñÑ±…ÍÍ9…µ”ô‰À´È™½¹ĞµÍ•µ¥‰½±ÍÑ¥­ä±•™Ğ´À‰œµİ¡¥Ñ”İ¡¥Ñ•ÍÁ…”µ¹½İÉ…ÀˆùíÉ¹±…‰•±ôğ½Ñùí5QI%a}=1L¹µ…À ¡Œ±¤¤ôøñÑ­•äõíô±…ÍÍ9…µ”ô‰À´ÄˆùíÉ¹¡…ÍQ¥•ÉÍññ¤ôôôÀüñ¥¹ÁÕĞÑåÁ”ô‰¹Õµ‰•Èˆµ¥¸ôˆÀˆÙ…±Õ”õíµ•ÑÉ¥Ì¹µ…ÑÉ¥ámÉ¥tü¹m¥uñğœô½¹¡…¹”õí”ôùÕÁ‘…Ñ•5…ÑÉ¥à¡É¤±¤±”¹Ñ…É•Ğ¹Ù…±Õ”¥ô±…ÍÍ9…µ”ô‰Üµ™Õ±°µ¥¸µÜµlÜÁÁát‰½É‘•ÈÉ½Õ¹‘•Áà´ÈÁä´Ä¸ÔÑ•áĞµÉ¥¡Ğˆ¼øèñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµ•¹Ñ•ÈÑ•áĞµÉ…ä´ÈÀÀˆûŠPğ½‘¥Øùôğ½Ñø¥ôñÑ±…ÍÍ9…µ”ô‰À´ÈÑ•áĞµÉ¥¡Ğˆùí™µÑ½Õ¹Ğ¡¥¹ÁÕĞ¥ôğ½ÑøñÑ±…ÍÍ9…µ”õíÀ´ÈÑ•áĞµÉ¥¡Ğ™½¹Ğµ‰½±€‘í¡•…µ¥¹ÁÕĞôôôÀüÑ•áĞµÉ…ä´ĞÀÀœé¡•…µ¥¹ÁÕĞøÀüÑ•áĞµ‰±Õ”´ØÀÀœèÑ•áĞµÉ•´ÔÀÀõôùí¡•…µ¥¹ÁÕĞøÀüœ¬œèœõí™µÑ½Õ¹Ğ¡¡•…µ¥¹ÁÕĞ¥ôğ½Ñøğ½ÑÈùô¥ôğ½Ñ‰½‘äøğ½Ñ…‰±”øğ½‘¥Øø(€€€€ğ½‘¥Øø(€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµİ¡¥Ñ”‰½É‘•ÈÉ½Õ¹‘•µá°À´Ğˆøñ‘¥Ø±…ÍÍ9…µ”ô‰™½¹Ğµ‰½±Ñ•áĞµÍ´ˆû¶f#
ßªâÃ¶ ƒ®Îã²
°ƒ®"²‚ğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰É¥É¥µ½±Ì´ÈÍ´éÉ¥µ½±Ì´Ğ…À´ÈµĞ´Ìˆùí!}=%}aQI}%1L¹µ…À ¡m­•ä±±…‰•±t¤ôøñ±…‰•°­•äõí­•åô±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ÔÀÀˆùí±…‰•±ôñ¥¹ÁÕĞÑåÁ”ô‰¹Õµ‰•Èˆµ¥¸ôˆÀˆÙ…±Õ”õíµ•ÑÉ¥Ím­•åuñğœô½¹¡…¹”õí”ôùÍ•Ñ5•ÑÉ¥Ì¡Øôø¡ì¸¸¹Ø±m­•åté5…Ñ ¹µ…à À±9Õµ‰•È¡”¹Ñ…É•Ğ¹Ù…±Õ•ñğÀ¤¥ô¤¥ô±…ÍÍ9…µ”ô‰µĞ´ÄÜµ™Õ±°‰½É‘•ÈÉ½Õ¹‘•µ±œÁà´ÈÁä´ÈÑ•áĞµáÌÑ•áĞµÉ¥¡Ğˆ¼øñÍÁ…¸±…ÍÍ9…µ”ô‰‰±½¬µĞ´ÄÑ•áĞµlåÁátÑ•áĞµÉ…ä´ĞÀÀˆû²²nC²z®‚”ƒ¶V§ªÎí™µÑ½Õ¹Ğ¡¥¹ÁÕÑáÑÉ…Ím­•åuñğÀ¥ôƒ
Üƒ²Â£²vĞí9Õµ‰•È¡µ•ÑÉ¥Ím­•åuñğÀ¤µ9Õµ‰•È¡¥¹ÁÕÑáÑÉ…Ím­•åuñğÀ¤øÀüœ¬œèœõí™µÑ½Õ¹Ğ¡9Õµ‰•È¡µ•ÑÉ¥Ím­•åuñğÀ¤µ9Õµ‰•È¡¥¹ÁÕÑáÑÉ…Ím­•åuñğÀ¤¥ôğ½ÍÁ…¸øğ½±…‰•°ø¥ôğ½‘¥Øøğ½‘¥Øø(€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµİ¡¥Ñ”‰½É‘•ÈÉ½Õ¹‘•µá°À´Ğˆøñ‘¥Ø±…ÍÍ9…µ”ô‰™½¹Ğµ‰½±Ñ•áĞµÍ´ˆùYLƒ²z®‚—ªÂHƒ
ÜƒªÒ®š³²z@ƒªÊ¶€ğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀµĞ´Äˆû®“²Ús²¶Fs²^C®*Pƒ²²n@ƒ²z®‚”YO®–ğƒ²jÃ²€ƒ²
³²j§¶V§®.#®.¸ƒªÊ¶ƒªÂK²v ƒ®æªÖC²j§²vÓ®¦Àƒªâ'²^³®–ğƒ®ÎªÊ÷¶Vc² ƒ²V+²*×®.#®.¸ğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰ÍÁ…”µä´ÈµĞ´Ìˆùì¡½¹™¥œ¹Ù…ÍññU1Q}YL¤¹µ…À¡Øôùí½¹ÍĞ¥¹ÁÕĞõ9Õµ‰•È¡¥¹ÁÕÑY…ÍmØ¹­•åuñğÀ¤±É•Ù¥•İ•õÙ…ÍI•Ù¥•İmØ¹­•åtíÉ•ÑÕÉ¸€ñ‘¥Ø­•äõíØ¹­•åô±…ÍÍ9…µ”ô‰É¥É¥µ½±ÌµlÅ™É|ÜÕÁá|äÁÁá|ØÕÁát¥Ñ•µÌµ•¹Ñ•È…À´Èˆøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ…ä´ØÀÀÑÉÕ¹…Ñ”ˆùíØ¹±…‰•±ôğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀÑ•áĞµÉ¥¡Ğˆû²z®‚”í™µÑ½Õ¹Ğ¡¥¹ÁÕĞ¥ôğ½‘¥Øøñ¥¹ÁÕĞÑåÁ”ô‰¹Õµ‰•Èˆµ¥¸ôˆÀˆÁ±…•¡½±‘•Èô‹ªÊ¶€ƒ²‚ˆÙ…±Õ”õíÉ•Ù¥•İ•üüœô½¹¡…¹”õí”ôùÍ•ÑY…ÍI•Ù¥•Ü¡ÁÉ•Øôùí½¹ÍĞ¹•áĞõì¸¸¹ÁÉ•Ùôí¥˜¡”¹Ñ…É•Ğ¹Ù…±Õ”ôôôœœ¥‘•±•Ñ”¹•áÑmØ¹­•åtí•±Í”¹•áÑmØ¹­•åtõ5…Ñ ¹µ…à À±9Õµ‰•È¡”¹Ñ…É•Ğ¹Ù…±Õ”¤¤íÉ•ÑÕÉ¸¹•áÑô¥ô±…ÍÍ9…µ”ô‰‰½É‘•ÈÉ½Õ¹‘•µ±œÁà´ÈÁä´Ä¸ÔÑ•áĞµáÌÑ•áĞµÉ¥¡Ğˆ¼øñ‘¥Ø±…ÍÍ9…µ”õíÑ•áĞµlÄÁÁátÑ•áĞµÉ¥¡Ğ€‘íÉ•Ù¥•İ•ôôõÕ¹‘•™¥¹•üÑ•áĞµÉ…ä´ÌÀÀœé9Õµ‰•È¡É•Ù¥•İ•¤µ¥¹ÁÕĞôôôÀüÑ•áĞµÉ…ä´ĞÀÀœèÑ•áĞµÉ•´ÔÀÀõôùíÉ•Ù¥•İ•ôôõÕ¹‘•™¥¹•üŸ®¾ãªÊ¶€œéƒ²Â£²vĞ€‘í9Õµ‰•È¡É•Ù¥•İ•¤µ¥¹ÁÕĞøÀüœ¬œèœô‘í™µÑ½Õ¹Ğ¡9Õµ‰•È¡É•Ù¥•İ•¤µ¥¹ÁÕĞ¥õôğ½‘¥Øøğ½‘¥Øùô¥ôğ½‘¥Øøğ½‘¥Øø(€€€€ñÑ•áÑ…É•„Ù…±Õ”õí¹½Ñ•ô½¹¡…¹”õí”ôùÍ•Ñ9½Ñ”¡”¹Ñ…É•Ğ¹Ù…±Õ”¥ôÁ±…•¡½±‘•Èô‹®Îã²
°ƒ®Âc²bƒ².s²‚C
ß²Â£²vĞƒ²
³²r€ƒ®¦S®ª ˆ±…ÍÍ9…µ”ô‰Üµ™Õ±°‰œµİ¡¥Ñ”‰½É‘•ÈÉ½Õ¹‘•µá°À´ÌÑ•áĞµáÌµ¥¸µ µlÜÉÁátˆ¼ø(€€ğ½‘¥Øøì)ô()™Õ¹Ñ¥½¸‘µ¥¹Y¥•Ü¡ì…‘µ¥¹Q…ˆ°Í•Ñ‘µ¥¹Q…ˆ°µ½¹Ñ¡Ì°µ½¹Ñ °Í•Ñ5½¹Ñ °É½İÌ°É…¹­¥¹I½İÌ°‘…¥±åI•½É‘Ì°Ñ½Ñ…±A…ä°Á•¹‘¥¹½Õ¹Ğ°…ÁÁÉ½Ù”°É•©•ÑÁÁÉ½Ù…°°½¹™¥œ°Á•ÉÍ¥ÍÑ½¹™¥œ°•µÁ±½å••Ì°…‘‘µÁ±½å•”°ÕÁ‘…Ñ•µÁ±½å•”°É•µ½Ù•µÁ±½å•”°ÍÑ½É•Ì°…‘‘MÑ½É”°É•µ½Ù•MÑ½É”°¥ÍÕ±±‘µ¥¸°…¹5…¹…•A•Éµ¥ÍÍ¥½¹Ìõ™…±Í”°µ½¹Ñ¡1½­•°Ñ½±•5½¹Ñ¡1½¬°Á½±¥å%¹ÁÕÑ	±½­•õ™…±Í”°Ñ½±•A½±¥å%¹ÁÕÑ	±½¬°…ÕÑ¡UÍ•É%°±½¥¹A½Í¥Ñ¥½¸ôœœ°±½¥¹	É…¹ ôœœ°…¹Mİ¥Ñ¡MÑ½É•Ìõ™…±Í”°…¹Y¥•İ!ÅMÑÉÕÑÕÉ”õ™…±Í”°…¹Y¥•İ…¥±å	É¥•™¥¹œõ™…±Í”°•µÁ±½å••½…±5…Àõíô°•µÁ±½å••½…±Í1½…‘¥¹œõ™…±Í”°É•™É•Í¡µÁ±½å••½…±Ìô¤ì(€½¹ÍĞ™¥¹…±A•É™½Éµ…¹•ÌõÕÍ•¥¹…±MÑ½É•A•É™½Éµ…¹”¡µ½¹Ñ ¤ì(€½¹ÍĞmÕÍÑ½µ•É…É•¥±Ñ•È±Í•ÑÕÍÑ½µ•É…É•¥±Ñ•ÉtõÕÍ•MÑ…Ñ” Ñ½‘¼œ¤ì(€½¹ÍĞQ	L€ôl(€€€ì­•äè€‘…Í¡‰½…Éœ°±…‰•°è€Ÿ²jÓ²bƒ¶b¶f¤œ°¥½¸è1…å½ÕÑ…Í¡‰½…É°Í•Ñ¥½¸è½Á•É…Ñ¥½¹Ìœô°(€€€€¸¸¸¡…¹Y¥•İ…¥±å	É¥•™¥¹œ€ümì­•äè€‘…¥±å	É¥•™¥¹œœ°±…‰•°è€Ÿ²vó²vğƒ®â3®š³¶VDœ°¥½¸è±¥Á‰½…É‘1¥ÍĞ°Í•Ñ¥½¸è½Á•É…Ñ¥½¹Ìœõt€èmt¤°(€€€ì­•äè€Á•É™½Éµ…¹”œ°±…‰•°è€Ÿ².“²‚ƒ²"s²rœ°¥½¸èQÉ½Á¡ä°Í•Ñ¥½¸èÁ•É™½Éµ…¹”œô°(€€€ì­•äè€Á•É™½Éµ…¹•ÁÁÉ½Ù…°œ°±…‰•°è€Ÿ².“²‚ƒ²‚CªÊ œ°¥½¸è±¥Á‰½…É‘¡•¬°Í•Ñ¥½¸èÁ•É™½Éµ…¹”œô°(€€€ì­•äè€ÍÑ½É•½…±Ìœ°±…‰•°è€Ÿ®“²z”ƒ®ª§¶Fpœ°¥½¸èQ…É•Ğ°Í•Ñ¥½¸èÁ•É™½Éµ…¹”œô°(€€€ì­•äè€ÕÍÑ½µ•É…É•‘µ¥¸œ°±…‰•°è€ŸªÎƒªÂtƒªÒ®š°œ°¥½¸è±¥Á‰½…É‘1¥ÍĞ°Í•Ñ¥½¸èÕÍÑ½µ•Èœô°(€€€ì­•äè€¡½µ•…É”œ°±…‰•°è€Ÿ¶f ƒ²ò²ZĞœ°¥½¸è!½µ”°Í•Ñ¥½¸èÕÍÑ½µ•Èœô°(€€€ì­•äè€•Ù…±Õ…Ñ¥½¸œ°±…‰•°è€Ÿ¶>'ªÂ œ°¥½¸è±¥Á‰½…É‘¡•¬°Í•Ñ¥½¸èÍ•ÑÑ±•µ•¹Ğœô°(€€€ì­•äè€µ…¹…•ÉA…åÉ½±°œ°±…‰•°è€ŸªÒ®š³²z@ƒªâ'²^°œ°¥½¸è]…±±•Ğ°Í•Ñ¥½¸èÍ•ÑÑ±•µ•¹Ğœô°(€€€ì­•äè€•áÁ•¹Í•Ìœ°±…‰•°è€Ÿ²b²^®æ²j¤¿²b“¶6ğœ°¥½¸è]…±±•Ğ°Í•Ñ¥½¸è½ÍĞœô°(€€€€¸¸¸¡…¹Y¥•İ…¥±å	É¥•™¥¹œ€ümì­•äè€ÍÁ½Ğœ°±…‰•°è€Ÿ²*“¶2|ƒ²*ç²vàœ°¥½¸èi…À°Í•Ñ¥½¸è½ÍĞœõt€èmt¤°(€€€ì­•äè€¡¥ÍÑ½Éäœ°±…‰•°è€Ÿ®ÎªÊôƒ²vÓ®‚”œ°¥½¸è!¥ÍÑ½Éä°Í•Ñ¥½¸è½ÍĞœô°(€€€ì­•äè€•µÁ±½å••Ìœ°±…‰•°è€Ÿ²²n@ƒªÒ®š°œ°¥½¸èUÍ•ÉÌ°Í•Ñ¥½¸èÍ•ÑÑ¥¹Ìœô°(€€€€¸¸¸¡…¹Y¥•İ!ÅMÑÉÕÑÕÉ”€ümì­•äè€¡ÅMÑÉÕÑÕÉ”œ°±…‰•°è€Ÿ®Îã²
°ƒªÖ³²†Ã²‚W²Æœ°¥½¸è	Õ¥±‘¥¹œÈ°Í•Ñ¥½¸èÍ•ÑÑ¥¹Ìœõt€èmt¤°(€€€€¸¸¸¡¥ÍÕ±±‘µ¥¸€ül(€€€€€ì­•äè€¡•…‘=™™¥•…Ñ„œ°±…‰•°è€Ÿ®Îã²
°ƒ®6Ã²vÓ¶Àœ°¥½¸èUÁ±½…‘±½Õ°Í•Ñ¥½¸èÁ•É™½Éµ…¹”œô°(€€€€€ì­•äè€Í•ÑÑ±•µ•¹Ğœ°±…‰•°è€Ÿ²‚W²
ÀƒªÊ¶€œ°¥½¸è]…±±•Ğ°Í•Ñ¥½¸èÍ•ÑÑ±•µ•¹Ğœô°(€€€€€ì­•äè€…±Õ±…Ñ¥½¹Õ‘¥Ğœ°±…‰•°è€ŸªÎ²
ÀƒªÊ²štœ°¥½¸èM¡¥•±‘¡•¬°Í•Ñ¥½¸èÍ•ÑÑ±•µ•¹Ğœô°(€€€€€ì­•äè€É…Ñ•Ìœ°±…‰•°è€Ÿ²ªâ'ªâÃ²’ ƒªÒ®š°œ°¥½¸èM•ÑÑ¥¹Ì°Í•Ñ¥½¸èÍ•ÑÑ¥¹Ìœô°(€€€t€èmt¤°(€€€€¸¸¸¡…¹5…¹…•A•Éµ¥ÍÍ¥½¹Ì€ümì­•äè€Á•Éµ¥ÍÍ¥½¹Ìœ°±…‰•°è€ŸªÚ3¶VpƒªÒ®š°œ°¥½¸èM¡¥•±‘¡•¬°Í•Ñ¥½¸èÍ•ÑÑ¥¹Ìœõt€èmt¤°(€tì(€½¹ÍĞ5%9}MQ%=9Lõl(€€€í­•äè½Á•É…Ñ¥½¹Ìœ±±…‰•°èŸ²b“®*c²v`ƒ²jÓ²bœ±¥½¸é1…å½ÕÑ…Í¡‰½…É‘ô°(€€€í­•äèÁ•É™½Éµ…¹”œ±±…‰•°èŸ².“²‚œ±¥½¸éQÉ½Á¡åô°(€€€í­•äèÕÍÑ½µ•Èœ±±…‰•°èŸªÎƒªÂw
ß²“²æ`œ±¥½¸é±¥Á‰½…É‘1¥ÍÑô°(€€€í­•äèÍ•ÑÑ±•µ•¹Ğœ±±…‰•°èŸ¶>'ªÂ
ßªâ'²^°œ±¥½¸é]…±±•Ñô°(€€€í­•äè½ÍĞœ±±…‰•°èŸ®æ²j§
ß²*ç²vàœ±¥½¸éi…Áô°(€€€í­•äèÍ•ÑÑ¥¹Ìœ±±…‰•°èŸªÒ®š°ƒ²“²‚Tœ±¥½¸éM•ÑÑ¥¹Íô°(€t¹™¥±Ñ•È¡Í•Ñ¥½¸ôùQ	L¹Í½µ”¡Ñ…ˆôùÑ…ˆ¹Í•Ñ¥½¸ôôõÍ•Ñ¥½¸¹­•ä¤¤ì(€½¹ÍĞ™…Ù½É¥Ñ•MÑ½É…•-•äõ…ÕÑ¡UÍ•É%ıµ¥Í½}…‘µ¥¹}™…Ù½É¥Ñ•Í}ØÄè‘í…ÕÑ¡UÍ•É%‘õ€èœœì(€½¹ÍĞm™…Ù½É¥Ñ•Q…‰-•åÌ±Í•Ñ…Ù½É¥Ñ•Q…‰-•åÍtõÕÍ•MÑ…Ñ”¡mt¤ì(€ÕÍ•™™•Ğ  ¤ôùì(€€€¥˜ …™…Ù½É¥Ñ•MÑ½É…•-•ä¥íÍ•Ñ…Ù½É¥Ñ•Q…‰-•åÌ¡mt¤íÉ•ÑÕÉ¸íô(€€€ÑÉåí½¹ÍĞÍ…Ù•õ)M=8¹Á…ÉÍ”¡±½…±MÑ½É…”¹•Ñ%Ñ•´¡™…Ù½É¥Ñ•MÑ½É…•-•ä¥ñğmtœ¤íÍ•Ñ…Ù½É¥Ñ•Q…‰-•åÌ¡ÉÉ…ä¹¥ÍÉÉ…ä¡Í…Ù•¤ıÍ…Ù•¹™¥±Ñ•È¡­•äôùQ	L¹Í½µ”¡Ñ…ˆôùÑ…ˆ¹­•äôôõ­•ä¤¤¹Í±¥” À°Ì¤émt¥õ…Ñ¡íÍ•Ñ…Ù½É¥Ñ•Q…‰-•åÌ¡mt¥ô(€ô±m™…Ù½É¥Ñ•MÑ½É…•-•ä±¥ÍÕ±±‘µ¥¸±…¹Y¥•İ!ÅMÑÉÕÑÕÉ”±…¹Y¥•İ…¥±å	É¥•™¥¹t¤ì€¼¼•Í±¥¹Ğµ‘¥Í…‰±”µ±¥¹”(€½¹ÍĞÑ½±•…Ù½É¥Ñ•Q…ˆô¡­•ä¤ôùì(€€€Í•Ñ…Ù½É¥Ñ•Q…‰-•åÌ¡ÕÉÉ•¹Ğôùì(€€€€€¥˜¡ÕÉÉ•¹Ğ¹¥¹±Õ‘•Ì¡­•ä¤¥ì(€€€€€€€½¹ÍĞ¹•áĞõÕÉÉ•¹Ğ¹™¥±Ñ•È¡¥Ñ•´ôù¥Ñ•´„ôõ­•ä¤ì(€€€€€€€ÑÉåí±½…±MÑ½É…”¹Í•Ñ%Ñ•´¡™…Ù½É¥Ñ•MÑ½É…•-•ä±)M=8¹ÍÑÉ¥¹¥™ä¡¹•áĞ¤¥õ…Ñ¡ì¼¨ƒªâÃªâÀƒ²‚²z—ªÎ×ªÂƒ²‚s¶Vpƒ².pƒ¶b²z°ƒ¶fS®¦Ó²^C²s®0ƒ²rƒ² €¨½ô(€€€€€€€É•ÑÕÉ¸¹•áĞì(€€€€€ô(€€€€€¥˜¡ÕÉÉ•¹Ğ¹±•¹Ñ øôÌ¥íÍ¡½İÁÁQ½…ÍĞ ŸªÒ®š³²z@ƒ®ÂS®†sªÂªâÃ®*Pƒ²Ös®2 €ÏªÂsªæ3² ƒ²²‚W¶V€ƒ²"`ƒ²z#²ZÓ²jP¸œ±íÑ½¹”è¥¹™¼ô¤íÉ•ÑÕÉ¸ÕÉÉ•¹Ğíô(€€€€€½¹ÍĞ¹•áĞõl¸¸¹ÕÉÉ•¹Ğ±­•åtì(€€€€€ÑÉåí±½…±MÑ½É…”¹Í•Ñ%Ñ•´¡™…Ù½É¥Ñ•MÑ½É…•-•ä±)M=8¹ÍÑÉ¥¹¥™ä¡¹•áĞ¤¥õ…Ñ¡ì¼¨ƒªâÃªâÀƒ²‚²z—ªÎ×ªÂƒ²‚s¶Vpƒ².pƒ¶b²z°ƒ¶fS®¦Ó²^C²s®0ƒ²rƒ² €¨½ô(€€€€€É•ÑÕÉ¸¹•áĞì(€€€ô¤ì(€ôì(€½¹ÍĞ™…Ù½É¥Ñ•Q…‰Ìõ™…Ù½É¥Ñ•Q…‰-•åÌ¹µ…À¡­•äôùQ	L¹™¥¹¡Ñ…ˆôùÑ…ˆ¹­•äôôõ­•ä¤¤¹™¥±Ñ•È¡	½½±•…¸¤ì(€½¹ÍĞ…Ñ¥Ù•‘µ¥¹M•Ñ¥½¸õQ	L¹™¥¹¡Ñ…ˆôùÑ…ˆ¹­•äôôõ…‘µ¥¹Q…ˆ¤ü¹Í•Ñ¥½¹ñğ½Á•É…Ñ¥½¹Ìœì(€½¹ÍĞ…Ñ¥Ù•M•Ñ¥½¹Q…‰ÌõQ	L¹™¥±Ñ•È¡Ñ…ˆôùÑ…ˆ¹Í•Ñ¥½¸ôôõ…Ñ¥Ù•‘µ¥¹M•Ñ¥½¸¤ì(€ÕÍ•™™•Ğ  ¤€ôøì(€€€¥˜€ ¡…‘µ¥¹Q…ˆ€ôôô€É…Ñ•Ìœñğ…‘µ¥¹Q…ˆ€ôôô€Á•Éµ¥ÍÍ¥½¹Ìœñğ…‘µ¥¹Q…ˆ€ôôô€Í•ÑÑ±•µ•¹Ğœñğ…‘µ¥¹Q…ˆ€ôôô€…±Õ±…Ñ¥½¹Õ‘¥Ğœñğ…‘µ¥¹Q…ˆ€ôôô€¡•…‘=™™¥•…Ñ„œ¤€˜˜€…¥ÍÕ±±‘µ¥¸¤Í•Ñ‘µ¥¹Q…ˆ ‘…Í¡‰½…Éœ¤ì(€€€¥˜€¡…‘µ¥¹Q…ˆ€ôôô€¡ÅMÑÉÕÑÕÉ”œ€˜˜€……¹Y¥•İ!ÅMÑÉÕÑÕÉ”¤Í•Ñ‘µ¥¹Q…ˆ ‘…Í¡‰½…Éœ¤ì(€€€¥˜€¡…‘µ¥¹Q…ˆ€ôôô€‘…¥±å	É¥•™¥¹œœ€˜˜€……¹Y¥•İ…¥±å	É¥•™¥¹œ¤Í•Ñ‘µ¥¹Q…ˆ ‘…Í¡‰½…Éœ¤ì(€€€¥˜€¡…‘µ¥¹Q…ˆ€ôôô€ÍÁ½Ğœ€˜˜€……¹Y¥•İ…¥±å	É¥•™¥¹œ¤Í•Ñ‘µ¥¹Q…ˆ ‘…Í¡‰½…Éœ¤ì(€ô°m…‘µ¥¹Q…ˆ°¥ÍÕ±±‘µ¥¸°…¹Y¥•İ!ÅMÑÉÕÑÕÉ”°…¹Y¥•İ…¥±å	É¥•™¥¹t¤ì€¼¼•Í±¥¹Ğµ‘¥Í…‰±”µ±¥¹”((€½¹ÍĞ‘½İ¹±½…‘MX€ô€ ¤€ôøì(€€€½¹ÍĞ¡•…‘•È€ôlŸ²vÓ®šœ°€Ÿ²ªâ$œ°€Ÿ®“²z”œ°€!Lœ°€Ÿ®NÇªâ$œ°€Ÿ²Òtƒ²vã²ó¶.Ã®â0œ°€Ÿ²¶ptì(€€€½¹ÍĞ±¥¹•Ì€ôm¡•…‘•È°€¸¸¹É½İÌ¹µ…À ¡È¤€ôøl(€€€€€È¹¹…µ”°È¹Á½Í¥Ñ¥½¸°È¹‰É…¹ °¡Í½Õ¹Ğ¡È¹‘É…™Ğ¤°È¹Á…ä¹É…‘•±¥¥‰±”€üÈ¹Á…ä¹É…‘”€è€œœ°È¹Á…ä¹Ñ½Ñ…°°È¹ÍÑ…ÑÕÌ°(€€€t¥tì(€€€½¹ÍĞÍØ€ô€qÕœ€¬±¥¹•Ì¹µ…À ¡É½Ü¤€ôøÉ½Ü¹µ…À ¡Ø¤€ôø€ˆ‘íMÑÉ¥¹œ¡Ø€üü€œœ¤¹É•Á±…” ¼ˆ½œ°€œˆˆœ¥ô‰€¤¹©½¥¸ œ°œ¤¤¹©½¥¸ qÉq¸œ¤ì(€€€½¹ÍĞ‰±½ˆ€ô¹•Ü	±½ˆ¡mÍÙt°ìÑåÁ”è€Ñ•áĞ½ÍØí¡…ÉÍ•ĞõÕÑ˜´àìœô¤ì(€€€½¹ÍĞÕÉ°€ôUI0¹É•…Ñ•=‰©•ÑUI0¡‰±½ˆ¤ì(€€€½¹ÍĞ„€ô‘½Õµ•¹Ğ¹É•…Ñ•±•µ•¹Ğ „œ¤ì(€€€„¹¡É•˜€ôÕÉ°ì„¹‘½İ¹±½…€ôƒ®¾ã²3²vã²ó¶.Ã®â1|‘íµ½¹Ñ¡ô¹ÍÙ€ì(€€€‘½Õµ•¹Ğ¹‰½‘ä¹…ÁÁ•¹‘¡¥±¡„¤ì„¹±¥¬ ¤ì‘½Õµ•¹Ğ¹‰½‘ä¹É•µ½Ù•¡¥±¡„¤ì(€€€UI0¹É•Ù½­•=‰©•ÑUI0¡ÕÉ°¤ì(€ôì(€½¹ÍĞ…‘µ¥¹!½µ•5•ÑÉ¥Y…±Õ”ô¡­•ä¤ôùì(€€€½¹ÍĞ‰É…¹¡•Ìõl¸¸¹¹•ÜM•Ğ ¡É½İÍññmt¤¹µ…À¡ÈôùÈ¹‰É…¹ ¤¹™¥±Ñ•È¡	½½±•…¸¤¥tì(€€€É•ÑÕÉ¸‰É…¹¡•Ì¹É•‘Õ” ¡Ñ½Ñ…°±‰É…¹ ¤ôùì(€€€€€½¹ÍĞ‰É…¹¡I½İÌô¡É½İÍññmt¤¹™¥±Ñ•È¡ÈôùÈ¹‰É…¹ ôôõ‰É…¹ ¤ì(€€€€€½¹ÍĞ¥¹ÁÕĞõ‰É…¹¡I½İÌ¹É•‘Õ” ¡ÍÕ´±É½Ü¤ôùÍÕ´­…‘µ¥¹5•ÑÉ¥Y…±Õ”¡É½Ü±­•ä¤°À¤ì(€€€€€É•ÑÕÉ¸Ñ½Ñ…°¬¡™¥¹…±A•É™½Éµ…¹•Ím‰É…¹¡tı™¥¹…±MÑ½É•5•ÑÉ¥Œ¡™¥¹…±A•É™½Éµ…¹•Ím‰É…¹¡t±­•ä±¥¹ÁÕĞ¤é¥¹ÁÕĞ¤ì(€€€ô°À¤ì(€ôì((€É•ÑÕÉ¸€ (€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µ…àµÜ´Õá°µàµ…ÕÑ¼Áà´ĞÁä´Ôˆø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µˆ´ĞÍÁ…”µä´Ìˆø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµİ¡¥Ñ”‰½É‘•È‰½É‘•ÈµÉ…ä´ÈÀÀÉ½Õ¹‘•´Éá°À´ÈÍÁ…”µä´Èˆø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É¥É¥µ½±Ì´ÌÍ´éÉ¥µ½±Ì´Ø…À´Äˆø(€€€€€€€€€€€í5%9}MQ%=9L¹µ…À¡Í•Ñ¥½¸ôøñ‰ÕÑÑ½¸­•äõíÍ•Ñ¥½¸¹­•åôÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùÍ•Ñ‘µ¥¹Q…ˆ¡Q	L¹™¥¹¡Ñ…ˆôùÑ…ˆ¹Í•Ñ¥½¸ôôõÍ•Ñ¥½¸¹­•ä¤ü¹­•åñğ‘…Í¡‰½…Éœ¥ô±…ÍÍ9…µ”õí™±•àµ¥¸µ ´ÄÄ™±•àµ½°Í´é™±•àµÉ½Ü¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ•¹Ñ•È…À´Ä¸ÔÁà´ÈÁä´È¸ÔÉ½Õ¹‘•µá°Ñ•áĞµlÄÅÁát™½¹Ğµ‰½±ÑÉ…¹Í¥Ñ¥½¸€‘í…Ñ¥Ù•‘µ¥¹M•Ñ¥½¸ôôõÍ•Ñ¥½¸¹­•äü‰œµÙ¥½±•Ğ´ØÀÀÑ•áĞµİ¡¥Ñ”Í¡…‘½ÜµÍ´É¥¹œ´ÄÉ¥¹œµÙ¥½±•Ğ´ÔÀÀœè‰œµÉ…ä´ÔÀÑ•áĞµÉ…ä´ÔÀÀ¡½Ù•Èé‰œµÙ¥½±•Ğ´ÔÀõôøñÍ•Ñ¥½¸¹¥½¸Í¥é”õìÄÑô¼ùíÍ•Ñ¥½¸¹±…‰•±ôğ½‰ÕÑÑ½¸ø¥ô(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€í™…Ù½É¥Ñ•Q…‰Ì¹±•¹Ñ øÀ˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰É½Õ¹‘•µá°‰½É‘•È‰½É‘•Èµ…µ‰•È´ÄÀÀ‰œµ…µ‰•È´ÔÀ¼ØÀÀ´Ä¸Ôˆøñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È…À´ÄÁà´Ä¸ÔÁˆ´Ä¸ÔÑ•áĞµlåÁát™½¹Ğµ‰½±ÑÉ…­¥¹œµİ¥‘”Ñ•áĞµ…µ‰•È´ÜÀÀˆøñMÑ…ÈÍ¥é”õìÄÁô™¥±°ô‰ÕÉÉ•¹Ñ½±½Èˆ¼û®
Ğƒ®ÂS®†sªÂªâÀğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à…À´Ä¸Ô½Ù•É™±½Üµàµ…ÕÑ¼ˆùí™…Ù½É¥Ñ•Q…‰Ì¹µ…À¡Ñ…ˆôøñ‰ÕÑÑ½¸­•äõíÑ…ˆ¹­•åôÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùÍ•Ñ‘µ¥¹Q…ˆ¡Ñ…ˆ¹­•ä¥ô±…ÍÍ9…µ”õí™±•àµ¥¸µ ´ÄÀÍ¡É¥¹¬´À¥Ñ•µÌµ•¹Ñ•È…À´Ä¸ÔÉ½Õ¹‘•µ±œ‰½É‘•ÈÁà´ÌÑ•áĞµáÌ™½¹Ğµ‰½±€‘í…‘µ¥¹Q…ˆôôõÑ…ˆ¹­•äü‰½É‘•ÈµÙ¥½±•Ğ´ÌÀÀ‰œµİ¡¥Ñ”Ñ•áĞµÙ¥½±•Ğ´ÜÀÀÍ¡…‘½ÜµÍ´œè‰½É‘•Èµ…µ‰•È´ÄÀÀ‰œµİ¡¥Ñ”¼àÀÑ•áĞµÉ…ä´ØÀÀõôøñÑ…ˆ¹¥½¸Í¥é”õìÄÍô¼ùíÑ…ˆ¹±…‰•±ôğ½‰ÕÑÑ½¸ø¥ôğ½‘¥Øøğ½‘¥Øùô(€€€€€€€€€í…Ñ¥Ù•M•Ñ¥½¹Q…‰Ì¹±•¹Ñ øÄ˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰É½Õ¹‘•µá°‰½É‘•È‰½É‘•ÈµÉ…ä´ÄÀÀ‰œµÉ…ä´ÔÀÀ´Ä¸Ôˆø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Áà´Ä¸ÔÁˆ´Ä¸ÔÑ•áĞµlåÁát™½¹Ğµ‰½±ÑÉ…­¥¹œµİ¥‘”Ñ•áĞµÉ…ä´ĞÀÀˆùí5%9}MQ%=9L¹™¥¹¡Í•Ñ¥½¸ôùÍ•Ñ¥½¸¹­•äôôõ…Ñ¥Ù•‘µ¥¹M•Ñ¥½¸¤ü¹±…‰•±ôƒ²ã®Ú ƒ®¦S®&Ğğ½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à…À´Ä¸Ô½Ù•É™±½Üµàµ…ÕÑ¼Áˆ´À¸Ôˆø(€€€€€€€€€€€í…Ñ¥Ù•M•Ñ¥½¹Q…‰Ì¹µ…À¡¸ôùí½¹ÍĞÍ•±•Ñ•õ…‘µ¥¹Q…ˆôôõ¸¹­•ä±™…Ù½É¥Ñ”õ™…Ù½É¥Ñ•Q…‰-•åÌ¹¥¹±Õ‘•Ì¡¸¹­•ä¤íÉ•ÑÕÉ¸€ñ‘¥Ø­•äõí¸¹­•åô±…ÍÍ9…µ”õí™±•àÍ¡É¥¹¬´À¥Ñ•µÌµÍÑÉ•Ñ ½Ù•É™±½Üµ¡¥‘‘•¸É½Õ¹‘•µ±œ‰½É‘•ÈÑÉ…¹Í¥Ñ¥½¸€‘íÍ•±•Ñ•ü‰½É‘•ÈµÙ¥½±•Ğ´ÌÀÀ‰œµİ¡¥Ñ”Ñ•áĞµÙ¥½±•Ğ´ÜÀÀÍ¡…‘½ÜµÍ´É¥¹œ´ÄÉ¥¹œµÙ¥½±•Ğ´ÄÀÀœè‰½É‘•ÈµÑÉ…¹ÍÁ…É•¹Ğ‰œµÑÉ…¹ÍÁ…É•¹ĞÑ•áĞµÉ…ä´ÔÀÀ¡½Ù•Èé‰½É‘•ÈµÉ…ä´ÈÀÀ¡½Ù•Èé‰œµİ¡¥Ñ”õôøñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùÍ•Ñ‘µ¥¹Q…ˆ¡¸¹­•ä¥ô±…ÍÍ9…µ”ô‰É½ÕÀ™±•àµ¥¸µ ´ÄÄ¥Ñ•µÌµ•¹Ñ•È…À´Ä¸ÔÁà´ÌÑ•áĞµáÌ™½¹Ğµ‰½±ˆøñÍÁ…¸±…ÍÍ9…µ”õí™±•à ´ÔÜ´Ô¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ•¹Ñ•ÈÉ½Õ¹‘•µµ€‘íÍ•±•Ñ•ü‰œµÙ¥½±•Ğ´ØÀÀÑ•áĞµİ¡¥Ñ”œè‰œµİ¡¥Ñ”Ñ•áĞµÉ…ä´ĞÀÀÉ½ÕÀµ¡½Ù•ÈéÑ•áĞµÙ¥½±•Ğ´ÔÀÀõôøñ¸¹¥½¸Í¥é”õìÄÉô¼øğ½ÍÁ…¸ùí¸¹±…‰•±õíÍ•±•Ñ•˜˜ñÍÁ…¸±…ÍÍ9…µ”ô‰ ´Ä¸ÔÜ´Ä¸ÔÉ½Õ¹‘•µ™Õ±°‰œµÙ¥½±•Ğ´ÔÀÀˆ¼ùôğ½‰ÕÑÑ½¸øñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùÑ½±•…Ù½É¥Ñ•Q…ˆ¡¸¹­•ä¥ô…É¥„µ±…‰•°õí€‘í¸¹±…‰•±ô€‘í™…Ù½É¥Ñ”üŸ²šCªÊ£²ÂûªâÀƒ¶VÓ²‚pœèŸ²šCªÊ£²ÂûªâÀƒ²ÚSªÂ õô±…ÍÍ9…µ”õí™±•àµ¥¸µ ´ÄÄÜ´ä¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ•¹Ñ•È‰½É‘•Èµ°€‘í™…Ù½É¥Ñ”ü‰½É‘•Èµ…µ‰•È´ÄÀÀ‰œµ…µ‰•È´ÔÀÑ•áĞµ…µ‰•È´ÔÀÀœè‰½É‘•ÈµÉ…ä´ÄÀÀÑ•áĞµÉ…ä´ÌÀÀ¡½Ù•ÈéÑ•áĞµ…µ‰•È´ÔÀÀõôøñMÑ…ÈÍ¥é”õìÄÍô™¥±°õí™…Ù½É¥Ñ”üÕÉÉ•¹Ñ½±½Èœè¹½¹”ô¼øğ½‰ÕÑÑ½¸øğ½‘¥Øùô¥ô(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€ğ½‘¥Øùô(€€€€€€€€ğ½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È…À´È™±•àµİÉ…Àˆø(€€€€€€€€€€ñÍ•±•ĞÙ…±Õ”õíµ½¹Ñ¡ô½¹¡…¹”õì¡”¤€ôøÍ•Ñ5½¹Ñ ¡”¹Ñ…É•Ğ¹Ù…±Õ”¥ô±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´™½¹Ğµµ•‘¥Õ´‰œµİ¡¥Ñ”‰½É‘•È‰½É‘•ÈµÉ…ä´ÈÀÀÉ½Õ¹‘•µ±œÁà´ÌÁä´Èˆø(€€€€€€€€€€€íµ½¹Ñ¡Ì¹µ…À ¡´¤€ôø€ñ½ÁÑ¥½¸­•äõíµôÙ…±Õ”õíµôùíµ½¹Ñ¡1…‰•°¡´¥ôğ½½ÁÑ¥½¸ø¥ô(€€€€€€€€€€ğ½Í•±•Ğø(€€€€€€€€€í¥ÍÕ±±‘µ¥¸€˜˜€ (€€€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôøÑ½±•5½¹Ñ¡1½¬¡µ½¹Ñ °€…µ½¹Ñ¡1½­•¥ô(€€€€€€€€€€€€€±…ÍÍ9…µ”õíÑ•áĞµáÌ™½¹Ğµµ•‘¥Õ´Áà´ÌÁä´ÈÉ½Õ¹‘•µ±œ‰½É‘•È€‘íµ½¹Ñ¡1½­•€ü€‰œµÉ•´ÔÀÑ•áĞµÉ•´ØÀÀ‰½É‘•ÈµÉ•´ÈÀÀœ€è€‰œµİ¡¥Ñ”Ñ•áĞµÉ…ä´ØÀÀ‰½É‘•ÈµÉ…ä´ÈÀÀõôø(€€€€€€€€€€€€€íµ½¹Ñ¡1½­•€ü€ŸÂ~RHƒ®#ªÂC®B €£¶VÓ²‚p¤œ€è€Ÿ®#ªÂC¶VcªâÀô(€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€¥ô(€€€€€€€€€í¥ÍÕ±±‘µ¥¸€˜˜€ (€€€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôøÑ½±•A½±¥å%¹ÁÕÑ	±½¬¡µ½¹Ñ °…Á½±¥å%¹ÁÕÑ	±½­•¥ô(€€€€€€€€€€€€€±…ÍÍ9…µ”õíÑ•áĞµáÌ™½¹Ğµµ•‘¥Õ´Áà´ÌÁä´ÈÉ½Õ¹‘•µ±œ‰½É‘•È€‘íÁ½±¥å%¹ÁÕÑ	±½­•ü‰œµ…µ‰•È´ÔÀÑ•áĞµ…µ‰•È´ÜÀÀ‰½É‘•Èµ…µ‰•È´ÈÀÀœè‰œµİ¡¥Ñ”Ñ•áĞµÉ…ä´ØÀÀ‰½É‘•ÈµÉ…ä´ÈÀÀõôø(€€€€€€€€€€€€€íÁ½±¥å%¹ÁÕÑ	±½­•üŸÂ~n€ƒ²‚W²Æƒ²’®æƒ²’D€£²z®‚”ƒ²^ÓªâÀ¤œèŸ²‚W²Æƒ²z®‚”ƒ²zƒªâ ô(€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€¥ô(€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õí‘½İ¹±½…‘MYô±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È…À´ÄÑ•áĞµáÌ™½¹Ğµµ•‘¥Õ´Áà´ÌÁä´ÈÉ½Õ¹‘•µ±œ‰œµ•µ•É…±´ØÀÀÑ•áĞµİ¡¥Ñ”ˆø(€€€€€€€€€€€€ñUÁ±½…‘±½ÕÍ¥é”õìÄÍô€¼øƒ²^G² ƒ®.“²jÓ®†s®Np(€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€ğ½‘¥Øø(€€€€€€ğ½‘¥Øø((€€€€€íµ½¹Ñ¡1½­•€˜˜€ (€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µˆ´Ğ‰œµÉ•´ÔÀ‰½É‘•È‰½É‘•ÈµÉ•´ÄÀÀÑ•áĞµÉ•´ØÀÀÑ•áĞµáÌÉ½Õ¹‘•µ±œÀ´Ì™±•à¥Ñ•µÌµ•¹Ñ•È…À´Èˆø(€€€€€€€€€€ñ%¹™¼Í¥é”õìÄÍô±…ÍÍ9…µ”ô‰Í¡É¥¹¬´Àˆ€¼øíµ½¹Ñ¡1…‰•°¡µ½¹Ñ ¥÷²v ƒ®#ªÂC®Bpƒ®.³²vÓ²^C²jP¸ƒ®ª£®N€ƒ²²nC²v`ƒ².“²‚ƒ²z®‚—
ß²"c²‚W²vĞƒ²zƒªÊ ƒ²z#²ZÓ²jP¸(€€€€€€€€ğ½‘¥Øø(€€€€€€¥ô(€€€€€íÁ½±¥å%¹ÁÕÑ	±½­•€˜˜€ (€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µˆ´Ğ‰œµ…µ‰•È´ÔÀ‰½É‘•È‰½É‘•Èµ…µ‰•È´ÄÀÀÑ•áĞµ…µ‰•È´ÜÀÀÑ•áĞµáÌÉ½Õ¹‘•µ±œÀ´Ì™±•à¥Ñ•µÌµ•¹Ñ•È…À´Èˆø(€€€€€€€€€€ñ%¹™¼Í¥é”õìÄÍô±…ÍÍ9…µ”ô‰Í¡É¥¹¬´Àˆ€¼øíµ½¹Ñ¡1…‰•°¡µ½¹Ñ ¥÷²v ƒ²ªâ'ªâÃ²’ ƒ²‚W²Æƒ²’®æƒ²’G²vÓ®vğƒ²²n@ƒ².“²‚ƒ²z®‚—²vĞƒ²zƒªÊ ƒ²z#²ZÓ²jP¸ƒ²‚W²Æƒ²"c²‚WªÎğƒªÊ²šw²vƒ®#²æpƒ®Jƒ²r²v`ƒŠc²z®‚”ƒ²^ÓªâÃŠg®–ğƒ®"3®~³²ó²ã²jP¸(€€€€€€€€ğ½‘¥Øø(€€€€€€¥ô((€€€€€í…‘µ¥¹Q…ˆ€ôôô€‘…Í¡‰½…Éœ€˜˜€ (€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰ÍÁ…”µä´Ğˆø(€€€€€€€€€€ñ‘µ¥¹5…¹…•µ•¹Ñ±•ÉÑÌÁ•¹‘¥¹½Õ¹ĞõíÁ•¹‘¥¹½Õ¹Ñô•µÁ±½å••Ìõí•µÁ±½å••Íô½¹¼õì¡Ñ…ˆ¤ôùí¥˜¡Ñ…ˆôôôÕÍÑ½µ•É…É•‘µ¥¸œ¥Í•ÑÕÍÑ½µ•É…É•¥±Ñ•È ½Ù•É‘Õ”œ¤íÍ•Ñ‘µ¥¹Q…ˆ¡Ñ…ˆ¥õôµ½¹Ñ õíµ½¹Ñ¡ôÉ½İÌõíÉ½İÍô‘…¥±åI•½É‘Ìõí‘…¥±åI•½É‘Íô¥ÍÕ±±‘µ¥¸õí¥ÍÕ±±‘µ¥¹ô½¹™¥œõí½¹™¥ô…¹Y¥•İMÁ½Ñ‘µ¥¸õí…¹Y¥•İ…¥±å	É¥•™¥¹ô€¼ø((€€€€€€€€€€ñ‘µ¥¹A•É™½Éµ…¹•…±•¹‘…È(€€€€€€€€€€€µ½¹Ñ õíµ½¹Ñ¡ô(€€€€€€€€€€€•µÁ±½å••Ìõí•µÁ±½å••Íô(€€€€€€€€€€€‘…¥±åI•½É‘Ìõí‘…¥±åI•½É‘Íô(€€€€€€€€€€€±½¥¹	É…¹ õí±½¥¹	É…¹¡ô(€€€€€€€€€€€…¹Mİ¥Ñ¡MÑ½É•Ìõí…¹Mİ¥Ñ¡MÑ½É•Íô(€€€€€€€€€€¼ø((€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµİ¡¥Ñ”É½Õ¹‘•µá°‰½É‘•È‰½É‘•ÈµÉ…ä´ÄÀÀÀ´Ğˆø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à©ÕÍÑ¥™äµ‰•Ñİ••¸¥Ñ•µÌµ•¹…À´Ìµˆ´Ìˆø(€€€€€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ…ä´ĞÀÀˆùí¥ÍÕ±±‘µ¥¸üŸ²‚²ÊĞƒ²jÓ²bƒ¶b¶f¤œèŸ²jÃ®š°ƒ®“²z”ƒ¶b¶f¤ôğ½‘¥Øø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµ‰…Í”™½¹Ğµ‰½±Ñ•áĞµÉ…ä´äÀÀˆùíµ½¹Ñ¡1…‰•°¡µ½¹Ñ ¥ôƒ¶V×².°ƒ²ÇªÎğğ½‘¥Øø(€€€€€€€€€€€€€€€í=‰©•Ğ¹­•åÌ¡™¥¹…±A•É™½Éµ…¹•Ì¤¹±•¹Ñ øÀ˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlåÁát™½¹ĞµÍ•µ¥‰½±Ñ•áĞµ•µ•É…±´ØÀÀµĞ´À¸Ôˆû®#ªÂC®Bpƒ®“²z—²v ƒ¶fW²‚Tƒ².“²‚ƒªâÃ²’ ğ½‘¥Øùô(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ…ä´ĞÀÀˆùíÉ½İÌ¹±•¹Ñ¡÷®ªğ½‘¥Øø(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰ÍÁ…”µä´Èˆø(€€€€€€€€€€€€€íl(€€€€€€€€€€€€€€€5%9}5%9}5QI%L¹Í±¥” À°Ğ¤°(€€€€€€€€€€€€€€€5%9}5%9}5QI%L¹Í±¥” Ğ°à¤°(€€€€€€€€€€€€€€€5%9}5%9}5QI%L¹Í±¥” à°ÄÀ¤°(€€€€€€€€€€€€€t¹µ…À ¡µ•ÑÉ¥I½Ü±É½İ%¹‘•à¤ôø (€€€€€€€€€€€€€€€€ñ‘¥Ø­•äõíÉ½İ%¹‘•áô±…ÍÍ9…µ”õíÉ¥…À´È€‘íÉ½İ%¹‘•àğÈüÉ¥µ½±Ì´ĞœèÉ¥µ½±Ì´Èõôø(€€€€€€€€€€€€€€€€€íµ•ÑÉ¥I½Ü¹µ…À ¡m­•ä±±…‰•°±Õ¹¥Ñt¤ôùì(€€€€€€€€€€€€€€€€€€€½¹ÍĞÙ…±Õ”õ…‘µ¥¹!½µ•5•ÑÉ¥Y…±Õ”¡­•ä¤ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸€ñ‘¥Ø­•äõí­•åô±…ÍÍ9…µ”ô‰É½Õ¹‘•µá°‰œµÉ…ä´ÔÀÁà´ÌÁä´Ìµ¥¸µÜ´ÀÑ•áĞµ•¹Ñ•Èˆø(€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÅÁátÑ•áĞµÉ…ä´ĞÀÀ±•…‘¥¹œµÑ¥¡Ğµ¥¸µ µlÄáÁát™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ•¹Ñ•Èˆùí±…‰•±ôğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÕÁát™½¹Ğµ‰½±Ñ•áĞµÉ…ä´äÀÀµĞ´Äİ¡¥Ñ•ÍÁ…”µ¹½İÉ…Àˆø(€€€€€€€€€€€€€€€€€€€€€€€íÕ¹¥Ğôôôİ½¸œ€üİ½¸¡Ù…±Õ”¤€èÕ¹¥ĞôôôÁ½¥¹Ğœ€ü€‘í9Õµ‰•È¡Ù…±Õ•ñğÀ¤¹Ñ½¥á• Ä¥õA€€è€‘í™µÑ½Õ¹Ğ¡Ù…±Õ”¥÷ªÆÑô(€€€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€ô¥ô(€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€¤¥ô(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€ğ½‘¥Øø((€€€€€€€€€€ñMÑ½É•½…±…Í¡‰½…É‘…É(€€€€€€€€€€€É½İÌõíÉ½İÍô(€€€€€€€€€€€•µÁ±½å••Ìõí•µÁ±½å••Íô(€€€€€€€€€€€…ÕÑ¡UÍ•É%õí…ÕÑ¡UÍ•É%‘ô(€€€€€€€€€€€µ½¹Ñ õíµ½¹Ñ¡ô(€€€€€€€€€€€½¹=Á•¸õì ¤ôùÍ•Ñ‘µ¥¹Q…ˆ ÍÑ½É•½…±Ìœ¥ô(€€€€€€€€€€¼ø(€€€€€€€€€€ñMÑ½É•¡…±±•¹•…É(€€€€€€€€€€€µ½¹Ñ õíµ½¹Ñ¡ô(€€€€€€€€€€€…±±I½İÌõíÉ…¹­¥¹I½İÍññÉ½İÍô(€€€€€€€€€€€•µÁ±½å••Ìõí•µÁ±½å••Íô(€€€€€€€€€€€…ÕÑ¡UÍ•É%õí…ÕÑ¡UÍ•É%‘ô(€€€€€€€€€€€½¹=Á•¹½…±Ìõì ¤ôùÍ•Ñ‘µ¥¹Q…ˆ ÍÑ½É•½…±Ìœ¥ô(€€€€€€€€€€¼ø((€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµİ¡¥Ñ”É½Õ¹‘•µá°‰½É‘•È‰½É‘•ÈµÉ…ä´ÄÀÀ½Ù•É™±½Üµ¡¥‘‘•¸ˆø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Áà´ĞÁä´Ì‰½É‘•Èµˆ‰½É‘•ÈµÉ…ä´ÔÀˆø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´™½¹Ğµ‰½±Ñ•áĞµÉ…ä´àÀÀˆû²jÃ®š°ƒ®“²z”ƒ²²n@ƒ¶b¶f¤ğ½‘¥Øø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ…ä´ĞÀÀµĞ´À¸Ôˆû¶V×².°ƒ².“²‚®0ƒ®æƒ®–ÓªÊ0ƒ¶fW²vã¶VÓ²jP¸ğ½‘¥Øø(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‘¥Ù¥‘”µä‘¥Ù¥‘”µÉ…ä´ÔÀˆø(€€€€€€€€€€€€€íl¸¸¹É½İÍt¹Í½ÉĞ ¡„±ˆ¤ôù¡Í½Õ¹Ğ¡ˆ¹‘É…™Ğ¤µ¡Í½Õ¹Ğ¡„¹‘É…™Ğ¤¤¹µ…À¡Èôø (€€€€€€€€€€€€€€€€ñ‘¥Ø­•äõíÈ¹¥‘ô±…ÍÍ9…µ”ô‰Áà´ĞÁä´Ìˆø(€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à©ÕÍÑ¥™äµ‰•Ñİ••¸…À´Ì¥Ñ•µÌµ•¹Ñ•Èˆø(€€€€€€€€€€€€€€€€€€€€ñ‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´™½¹Ğµ‰½±Ñ•áĞµÉ…ä´äÀÀˆùíÈ¹¹…µ•ôğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀˆùí‘¥ÍÁ±…åMÑ½É•9…µ”¡È¹‰É…¹ ¥ôğ½‘¥Øøğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÅÁátÑ•áĞµÉ…ä´ÔÀÀÑ•áĞµÉ¥¡Ğ±•…‘¥¹œ´Ôˆø(€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€!L€ñˆ±…ÍÍ9…µ”ô‰Ñ•áĞµÉ…ä´äÀÀˆùí…‘µ¥¹5•ÑÉ¥Y…±Õ”¡È°¡Ìœ¥ôğ½ˆøƒ
Ü(€€€€€€€€€€€€€€€€€€€€€€€M%459@€ñˆ±…ÍÍ9…µ”ô‰Ñ•áĞµÉ…ä´äÀÀˆùí…‘µ¥¹5•ÑÉ¥Y…±Õ”¡È°Í¥µ5¹Àœ¥ôğ½ˆøƒ
Ü(€€€€€€€€€€€€€€€€€€€€€€€ƒ¶f €ñˆ±…ÍÍ9…µ”ô‰Ñ•áĞµÉ…ä´äÀÀˆùí…‘µ¥¹5•ÑÉ¥Y…±Õ”¡È°¡½µ”œ¥ôğ½ˆø(€€€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€ƒ²w²
Ã²Ä€ñˆ±…ÍÍ9…µ”ô‰Ñ•áĞµÉ…ä´äÀÀˆùí9Õµ‰•È¡…‘µ¥¹5•ÑÉ¥Y…±Õ”¡È°ÁÉ½‘ÕÑ¥Ù¥Ñäœ¥ñğÀ¤¹Ñ½¥á• Ä¥õ@ğ½ˆøƒ
Ü(€€€€€€€€€€€€€€€€€€€€€€€ƒ¶R®š°€ñˆ±…ÍÍ9…µ”ô‰Ñ•áĞµÉ…ä´äÀÀˆùí…‘µ¥¹5•ÑÉ¥Y…±Õ”¡È°™É•”œ¥ôğ½ˆøƒ
Ü(€€€€€€€€€€€€€€€€€€€€€€€ƒ²*“¶f €ñˆ±…ÍÍ9…µ”ô‰Ñ•áĞµÉ…ä´äÀÀˆùí…‘µ¥¹5•ÑÉ¥Y…±Õ”¡È°Íµ…ÉĞœ¥ôğ½ˆøƒ
Ü(€€€€€€€€€€€€€€€€€€€€€€€ƒ²^²ªÆĞ€ñˆ±…ÍÍ9…µ”ô‰Ñ•áĞµÉ…ä´äÀÀˆùí…‘µ¥¹5•ÑÉ¥Y…±Õ”¡È°ÕÁÍ•±°œ¥ôğ½ˆø(€€€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€¤¥ô(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€ğ½‘¥Øø((€€€€€€€€€€ñ‘µ¥¹ÕÍÑ½µ•É…É•=Ù•ÉÙ¥•Ü•µÁ±½å••Ìõí•µÁ±½å••Íôµ½¹Ñ õíµ½¹Ñ¡ô½µÁ…Ğ½¹=Á•¸õì ¤ôùíÍ•ÑÕÍÑ½µ•É…É•¥±Ñ•È Ñ½‘¼œ¤íÍ•Ñ‘µ¥¹Q…ˆ ÕÍÑ½µ•É…É•‘µ¥¸œ¥õô€¼ø(€€€€€€€€ğ½‘¥Øø(€€€€€€¥ô((€€€€€í…‘µ¥¹Q…ˆ€ôôô€Á•É™½Éµ…¹”œ€˜˜€ñ½µÁ…É¥Í½¹Y¥•ÜÉ½İÌõíÉ½İÍô€¼ùô(€€€€€í…‘µ¥¹Q…ˆ€ôôô€•Ù…±Õ…Ñ¥½¸œ€˜˜€ñÙ…±Õ…Ñ¥½¹Q…ˆµ½¹Ñ õíµ½¹Ñ¡ô½¹™¥œõí½¹™¥ô¥Í5…¹…•ÉY¥•ÜõíÑÉÕ•ô…¹¥¹…±ÁÁÉ½Ù”õí¥ÍÕ±±‘µ¥¹ô•µÁ±½å••Ìõí•µÁ±½å••ÍôÉ½İÌõíÉ…¹­¥¹I½İÍññÉ½İÍô…ÕÑ¡UÍ•É%õí…ÕÑ¡UÍ•É%‘ô…¹Mİ¥Ñ¡MÑ½É•Ìõí…¹Mİ¥Ñ¡MÑ½É•Íô±½¥¹	É…¹ õí±½¥¹	É…¹¡ô€¼ùô(€€€€€í…‘µ¥¹Q…ˆ€ôôô€µ…¹…•ÉA…åÉ½±°œ€˜˜€ñ5…¹…•ÉA…åÉ½±±A…¹•°µ½¹Ñ õíµ½¹Ñ¡ô•µÁ±½å••Ìõí•µÁ±½å••ÍôÉ½İÌõíÉ…¹­¥¹I½İÍññÉ½İÍô…ÕÑ¡UÍ•É%õí…ÕÑ¡UÍ•É%‘ô…¹Mİ¥Ñ¡MÑ½É•Ìõí…¹Mİ¥Ñ¡MÑ½É•Íô±½¥¹	É…¹ õí±½¥¹	É…¹¡ô€¼ùô(€€€€€í…‘µ¥¹Q…ˆ€ôôô€ÕÍÑ½µ•É…É•‘µ¥¸œ€˜˜€ñ‘µ¥¹ÕÍÑ½µ•É…É•=Ù•ÉÙ¥•Ü•µÁ±½å••Ìõí•µÁ±½å••Íôµ½¹Ñ õíµ½¹Ñ¡ô¥¹¥Ñ¥…±¥±Ñ•ÈõíÕÍÑ½µ•É…É•¥±Ñ•Éô€¼ùô(€€€€€í…‘µ¥¹Q…ˆ€ôôô€¡½µ•…É”œ€˜˜€ñ‘µ¥¹!½µ•…É”•µÁ±½å••Ìõí•µÁ±½å••Íôµ½¹Ñ õíµ½¹Ñ¡ô€¼ùô(€€€€€í…‘µ¥¹Q…ˆ€ôôô€Á•É™½Éµ…¹•ÁÁÉ½Ù…°œ€˜˜€ñA•É™½Éµ…¹•¡•­A…¹•°µ½¹Ñ õíµ½¹Ñ¡ôÉ½İÌõíÉ½İÍô‘…¥±åI•½É‘Ìõí‘…¥±åI•½É‘Íô•µÁ±½å••Ìõí•µÁ±½å••Íô€¼ùô(€€€€€í…‘µ¥¹Q…ˆ€ôôô€‘…¥±å	É¥•™¥¹œœ€˜˜…¹Y¥•İ…¥±å	É¥•™¥¹œ€˜˜€ñ…¥±å	É¥•™¥¹A…¹•°µ½¹Ñ õíµ½¹Ñ¡ôÉ½İÌõíÉ…¹­¥¹I½İÍññÉ½İÍô‘…¥±åI•½É‘Ìõí‘…¥±åI•½É‘Íô•µÁ±½å••Ìõí•µÁ±½å••Íô…ÕÑ¡UÍ•É%õí…ÕÑ¡UÍ•É%‘ô€¼ùô(€€€€€í…‘µ¥¹Q…ˆ€ôôô€•áÁ•¹Í•Ìœ€˜˜€ñ‘µ¥¹áÁ•¹Í•=Ù•ÉÙ¥•Üµ½¹Ñ õíµ½¹Ñ¡ô•µÁ±½å••Ìõí•µÁ±½å••Íô±½¥¹	É…¹ õí±½¥¹	É…¹¡ô…¹Mİ¥Ñ¡MÑ½É•Ìõí…¹Mİ¥Ñ¡MÑ½É•Íô€¼ùô(€€€€€í…‘µ¥¹Q…ˆ€ôôô€ÍÑ½É•½…±Ìœ€˜˜€ñMÑ½É•½…±‘µ¥¸µ½¹Ñ õíµ½¹Ñ¡ô•µÁ±½å••Ìõí•µÁ±½å••ÍôÉ½İÌõíÉ½İÍô¥ÍÕ±±‘µ¥¸õí¥ÍÕ±±‘µ¥¹ô…ÕÑ¡UÍ•É%õí…ÕÑ¡UÍ•É%‘ô€¼ùô(€€€€€í…‘µ¥¹Q…ˆ€ôôô€ÍÁ½Ğœ€˜˜…¹Y¥•İ…¥±å	É¥•™¥¹œ€˜˜€ñMÁ½Ñ‘µ¥¸…ÕÑ¡UÍ•É%õí…ÕÑ¡UÍ•É%‘ô¥ÍÕ±±‘µ¥¸õí¥ÍÕ±±‘µ¥¹ôµ½¹Ñ õíµ½¹Ñ¡ô€¼ùô(€€€€€í…‘µ¥¹Q…ˆ€ôôô€¡•…‘=™™¥•…Ñ„œ€˜˜¥ÍÕ±±‘µ¥¸€˜˜€ñ!•…‘=™™¥•…Ñ…A…¹•°µ½¹Ñ õíµ½¹Ñ¡ô•µÁ±½å••Ìõí•µÁ±½å••ÍôÉ½İÌõíÉ½İÍô½¹™¥œõí½¹™¥ô…ÕÑ¡UÍ•É%õí…ÕÑ¡UÍ•É%‘ô€¼ùô(€€€€€í…‘µ¥¹Q…ˆ€ôôô€Í•ÑÑ±•µ•¹Ğœ€˜˜¥ÍÕ±±‘µ¥¸€˜˜€ñM•ÑÑ±•µ•¹ÑI•Ù¥•Üµ½¹Ñ õíµ½¹Ñ¡ôÉ½İÌõíÉ½İÍô•µÁ±½å••Ìõí•µÁ±½å••Íô½¹™¥œõí½¹™¥ô…ÕÑ¡UÍ•É%õí…ÕÑ¡UÍ•É%‘ô€¼ùô(€€€€€í…‘µ¥¹Q…ˆ€ôôô€…±Õ±…Ñ¥½¹Õ‘¥Ğœ€˜˜¥ÍÕ±±‘µ¥¸€˜˜€ñ…±Õ±…Ñ¥½¹Õ‘¥ÑA…¹•°µ½¹Ñ õíµ½¹Ñ¡ôÉ½İÌõíÉ½İÍô€¼ùô(€€€€€í…‘µ¥¹Q…ˆ€ôôô€¡¥ÍÑ½Éäœ€˜˜€ñ!¥ÍÑ½ÉåQ…ˆ•µÁ±½å••Ìõí•µÁ±½å••Íôµ½¹Ñ õíµ½¹Ñ¡ô½¹™¥œõí½¹™¥ô€¼ùô(€€€€€í…‘µ¥¹Q…ˆ€ôôô€¡ÅMÑÉÕÑÕÉ”œ€˜˜…¹Y¥•İ!ÅMÑÉÕÑÕÉ”€˜˜€ñI•…Ğ¹MÕÍÁ•¹Í”™…±±‰…¬õìñ•™•ÉÉ•‘‘µ¥¹A…¹•±…±±‰…¬±…‰•°ô‹®Îã²
°ƒªÖ³²†Ã²‚W²Æˆ¼ùôøñ!ÅMÑÉÕÑÕÉ•A½±¥åY¥•Üµ½¹Ñ õíµ½¹Ñ¡ô•µÁ±½å••%‘Ìõì¡É…¹­¥¹I½İÍññÉ½İÌ¤¹µ…À¡É½ÜôùÉ½Ü¹¥¥ô…ÕÑ¡UÍ•É%õí…ÕÑ¡UÍ•É%‘ô€¼øğ½I•…Ğ¹MÕÍÁ•¹Í”ùô((€€€€€í…‘µ¥¹Q…ˆ€ôôô€•µÁ±½å••Ìœ€˜˜€ (€€€€€€€€ñµÁ±½å••5…¹…•È•µÁ±½å••Ìõí•µÁ±½å••Íô…‘‘µÁ±½å•”õí…‘‘µÁ±½å••ôÕÁ‘…Ñ•µÁ±½å•”õíÕÁ‘…Ñ•µÁ±½å••ôÉ•µ½Ù•µÁ±½å•”õíÉ•µ½Ù•µÁ±½å••ôÍÑ½É•ÌõíÍÑ½É•Íô…‘‘MÑ½É”õí…‘‘MÑ½É•ôÉ•µ½Ù•MÑ½É”õíÉ•µ½Ù•MÑ½É•ô…ÕÑ¡UÍ•É%õí…ÕÑ¡UÍ•É%‘ôµ½¹Ñ õíµ½¹Ñ¡ô•µÁ±½å••½…±5…Àõí•µÁ±½å••½…±5…Áô•µÁ±½å••½…±Í1½…‘¥¹œõí•µÁ±½å••½…±Í1½…‘¥¹ôÉ•™É•Í¡µÁ±½å••½…±ÌõíÉ•™É•Í¡µÁ±½å••½…±Íô€¼ø(€€€€€€¥ô((€€€€€í…‘µ¥¹Q…ˆ€ôôô€É…Ñ•Ìœ€˜˜¥ÍÕ±±‘µ¥¸€˜˜€ (€€€€€€€€ñI…Ñ•Í5…¹…•È½¹™¥œõí½¹™¥ôÁ•ÉÍ¥ÍÑ½¹™¥œõíÁ•ÉÍ¥ÍÑ½¹™¥ô€¼ø(€€€€€€¥ô((€€€€€í…‘µ¥¹Q…ˆ€ôôô€Á•Éµ¥ÍÍ¥½¹Ìœ€˜˜…¹5…¹…•A•Éµ¥ÍÍ¥½¹Ì€˜˜€ (€€€€€€€€ñA•Éµ¥ÍÍ¥½¹Í5…¹…•È•µÁ±½å••Ìõí•µÁ±½å••Íô€¼ø(€€€€€€¥ô(€€€€ğ½‘¥Øø(€€¤ì)ô()™Õ¹Ñ¥½¸…±Õ±…Ñ¥½¹Õ‘¥ÑA…¹•°¡íµ½¹Ñ ±É½İÌõmuô¥ì(€½¹ÍĞm•áÁ…¹‘•±Í•ÑáÁ…¹‘•‘tõÕÍ•MÑ…Ñ” œœ¤ì(€½¹ÍĞ½Ù•É•õÉ½İÌ¹™¥±Ñ•È¡ÈôùÈ¹…±Õ±…Ñ¥½¹Õ‘¥Ğü¹½µÁ…É…‰±”¤¹±•¹Ñ ì(€½¹ÍĞ‘¥™™•É•¹ĞõÉ½İÌ¹™¥±Ñ•È¡ÈôùÈ¹…±Õ±…Ñ¥½¹Õ‘¥Ğü¹½µÁ…É…‰±”˜™9Õµ‰•È¡È¹…±Õ±…Ñ¥½¹Õ‘¥Ğü¹‘¥™™•É•¹•ñğÀ¤„ôôÀ¤¹±•¹Ñ ì(€É•ÑÕÉ¸€ñ‘¥Ø±…ÍÍ9…µ”ô‰ÍÁ…”µä´Ğˆø(€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É½Õ¹‘•´Éá°‰½É‘•È‰½É‘•ÈµÙ¥½±•Ğ´ÄÀÀ‰œµÙ¥½±•Ğ´ÔÀÀ´Ğˆø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´™½¹Ğµ‰½±Ñ•áĞµÙ¥½±•Ğ´äÀÀˆûªÎ²
Àƒ²^S²ƒªŞã®šó²z@ƒªÊ²štğ½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´ÄÑ•áĞµáÌ±•…‘¥¹œµÉ•±…á•Ñ•áĞµÙ¥½±•Ğ´ÜÀÀˆû²²nC²^CªÊ0ƒ¶Fs².s®Bc®*Pƒªâ'²^³®*Pƒ®ÎªÊ÷¶Vc² ƒ²V+ªÎ€°ƒ¶2C®ƒ®.ç².pƒ²‚W²Æƒ²*“®²ß²ró®†pƒ®.“².pƒªÎ²
Ã¶Vpƒ®ª£®ÂS²vğƒ²vã²ó¶.Ã®â3®–ğƒ®æªÖC¶V§®.#®.¸ğ½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´ÌÉ¥É¥µ½±Ì´Ì…À´ÈÑ•áĞµ•¹Ñ•Èˆøñ‘¥Ø±…ÍÍ9…µ”ô‰É½Õ¹‘•µá°‰œµİ¡¥Ñ”À´Èˆøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀˆû®2²ğ½‘¥Øøñˆ±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´ˆùíÉ½İÌ¹±•¹Ñ¡÷®ªğ½ˆøğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰É½Õ¹‘•µá°‰œµİ¡¥Ñ”À´Èˆøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀˆû®æªÖ@ƒªÂ®*”ğ½‘¥Øøñˆ±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´Ñ•áĞµ•µ•É…±´ØÀÀˆùí½Ù•É•‘÷®ªğ½ˆøğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰É½Õ¹‘•µá°‰œµİ¡¥Ñ”À´Èˆøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀˆû²Â£²vĞƒ®ÂsªÊ°ğ½‘¥Øøñˆ±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´Ñ•áĞµÉ•´ÔÀÀˆùí‘¥™™•É•¹Ñ÷®ªğ½ˆøğ½‘¥Øøğ½‘¥Øø(€€€€ğ½‘¥Øø(€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰½Ù•É™±½Üµ¡¥‘‘•¸É½Õ¹‘•´Éá°‰½É‘•È‰½É‘•ÈµÉ…ä´ÄÀÀ‰œµİ¡¥Ñ”ˆø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰½É‘•ÈµˆÁà´ĞÁä´Ìˆøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´™½¹Ğµ‰½±ˆùíµ½¹Ñ¡1…‰•°¡µ½¹Ñ ¥ôƒ²²nC®ÎƒªÊ²štƒªÊÃªÎğğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÅÁátÑ•áĞµÉ…ä´ĞÀÀˆû²*“®²ß²vĞƒ²^®*Pƒ²vÓ²‚ƒ¶2C®“®*PƒªâÃ²†Ğƒ®Â§².w²ró®†pƒ²rƒ²¶Vc®¦Àƒ®æªÖ@ƒ®2²²^C²pƒ²‚s²fã®B§®.#®.¸ğ½‘¥Øøğ½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‘¥Ù¥‘”µäˆø(€€€€€€€íÉ½İÌ¹µ…À¡Èôùí½¹ÍĞ„õÈ¹…±Õ±…Ñ¥½¹Õ‘¥Ñññíôí½¹ÍĞ½µÁ±•Ñ”õ„¹½µÁ…É…‰±”í½¹ÍĞ½Á•¸õ•áÁ…¹‘•ôôõÈ¹¥íÉ•ÑÕÉ¸€ñ‘¥Ø­•äõíÈ¹¥‘ô±…ÍÍ9…µ”ô‰Áà´ĞÁä´Ìˆø(€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùÍ•ÑáÁ…¹‘•¡½Á•¸üœœéÈ¹¥¥ô±…ÍÍ9…µ”ô‰Üµ™Õ±°Ñ•áĞµ±•™Ğˆøñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµÍÑ…ÉĞ©ÕÍÑ¥™äµ‰•Ñİ••¸…À´Ìˆøñ‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´™½¹Ğµ‰½±ˆùíÈ¹¹…µ•ô€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁát™½¹Ğµ¹½Éµ…°Ñ•áĞµÉ…ä´ĞÀÀˆùí‘¥ÍÁ±…åMÑ½É•9…µ”¡È¹‰É…¹ ¥ôğ½ÍÁ…¸øğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´ÄÑ•áĞµlÄÅÁátÑ•áĞµÉ…ä´ÔÀÀˆû¶2C®í„¹Ñ½Ñ…±M…±•ÍñğÁ÷ªÆĞƒ
Üƒ²*“®²Üí„¹Í¹…ÁÍ¡½ÑM…±•ÍñğÁ÷ªÆĞƒ
Üƒ²vÓ²‚®Â§².tí„¹µ¥ÍÍ¥¹M¹…ÁÍ¡½ÑÍñğÁ÷ªÆĞğ½‘¥Øøğ½‘¥Øø(€€€€€€€€€í½µÁ±•Ñ”üñÍÁ…¸±…ÍÍ9…µ”õíÉ½Õ¹‘•µ™Õ±°Áà´ÈÁä´ÄÑ•áĞµlÄÁÁát™½¹Ğµ‰½±€‘í9Õµ‰•È¡„¹‘¥™™•É•¹•ñğÀ¤ôôôÀü‰œµ•µ•É…±´ÔÀÑ•áĞµ•µ•É…±´ØÀÀœè‰œµÉ•´ÔÀÑ•áĞµÉ•´ØÀÀõôùí9Õµ‰•È¡„¹‘¥™™•É•¹•ñğÀ¤ôôôÀüŸ²vó²æ`œéƒ²Â£²vĞ€‘íİ½¸¡„¹‘¥™™•É•¹”¥õôğ½ÍÁ…¸øèñÍÁ…¸±…ÍÍ9…µ”ô‰É½Õ¹‘•µ™Õ±°‰œµÉ…ä´ÄÀÀÁà´ÈÁä´ÄÑ•áĞµlÄÁÁát™½¹Ğµ‰½±Ñ•áĞµÉ…ä´ÔÀÀˆû²vÓ²‚²‚W²Æƒ¶>³¶V ğ½ÍÁ…¸ùôğ½‘¥Øø(€€€€€€€€€í½µÁ±•Ñ”˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´ÈÉ¥É¥µ½±Ì´È…À´ÈÑ•áĞµlÄÅÁátˆøñ‘¥Ø±…ÍÍ9…µ”ô‰É½Õ¹‘•µ±œ‰œµÉ…ä´ÔÀÁà´ÌÁä´ÈˆûªâÃ²†Ğƒ®ª£®ÂS²vğ€ñˆ±…ÍÍ9…µ”ô‰™±½…ĞµÉ¥¡Ğˆùíİ½¸¡„¹•á¥ÍÑ¥¹5½‰¥±•A…ä¥ôğ½ˆøğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰É½Õ¹‘•µ±œ‰œµÉ…ä´ÔÀÁà´ÌÁä´Èˆû² ƒ²nC²z”€ñˆ±…ÍÍ9…µ”ô‰™±½…ĞµÉ¥¡Ğˆùíİ½¸¡„¹Í¡…‘½İ5½‰¥±•A…ä¥ôğ½ˆøğ½‘¥Øøğ½‘¥Øùôğ½‰ÕÑÑ½¸ø(€€€€€€€€€í½Á•¸˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´ÌÍÁ…”µä´È‰½É‘•ÈµĞÁĞ´Ìˆùì¡„¹‘•Ñ…¥±Íññmt¤¹±•¹Ñ ôôôÀüñ‘¥Ø±…ÍÍ9…µ”ô‰É½Õ¹‘•µ±œ‰œµÉ…ä´ÔÀÀ´ÌÑ•áĞµlÄÅÁátÑ•áĞµÉ…ä´ĞÀÀˆû²²àƒªÎ²
Ã²vĞƒªÂ®*—¶Vpƒ².ƒªŞpƒ¶2C®“ªÂ ƒ²V²ƒ²^²ZÓ²jP¸ğ½‘¥Øøè¡„¹‘•Ñ…¥±Íññmt¤¹µ…À¡ôøñ‘¥Ø­•äõí¹¥‘ô±…ÍÍ9…µ”ô‰É½Õ¹‘•µá°‰½É‘•È‰½É‘•ÈµÉ…ä´ÄÀÀÀ´ÌÑ•áĞµlÄÅÁátˆøñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à©ÕÍÑ¥™äµ‰•Ñİ••¸…À´Èˆøñˆùí¹‘…Ñ•ôƒ
Üí¹ÕÍÑ½µ•Éôğ½ˆøñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµÙ¥½±•Ğ´ØÀÀˆùí¹Á½±¥åY•ÉÍ¥½¹ôğ½ÍÁ…¸øğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´À¸ÔÑ•áĞµÉ…ä´ĞÀÀˆùí¹±…‰•±õí¹™É••A¡½¹”üœƒ
Üƒ®²Ó®3¶>Àƒ¶*çªÂ œèœôğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´ÈÉ¥É¥µ½±Ì´È…Àµà´Ì…Àµä´ÄÑ•áĞµÉ…ä´ØÀÀˆøñÍÁ…¸û²jSªâ#²‚p€ñˆ±…ÍÍ9…µ”ô‰™±½…ĞµÉ¥¡Ğˆùíİ½¸¡¹Á…¥ü¹Á±…¸¥ôğ½ˆøğ½ÍÁ…¸øñÍÁ…¸ùYO
ß®ÎÓ¶^`€ñˆ±…ÍÍ9…µ”ô‰™±½…ĞµÉ¥¡Ğˆùíİ½¸¡9Õµ‰•È¡¹Á…¥ü¹Ù…ÍñğÀ¤­9Õµ‰•È¡¹Á…¥ü¹¥¹ÍÕÉ…¹•ñğÀ¤¥ôğ½ˆøğ½ÍÁ…¸øñÍÁ…¸øÉ9€ñˆ±…ÍÍ9…µ”ô‰™±½…ĞµÉ¥¡Ğˆùíİ½¸¡¹Á…¥ü¹Í•½¹¥ôƒ
Üí9Õµ‰•È¡¹Á•É™½Éµ…¹•A½¥¹ÑÍñğÀ¤¹Ñ½¥á• Ä¥õ@ğ½ˆøğ½ÍÁ…¸øñÍÁ…¸û²‚®zÕ@€ñˆ±…ÍÍ9…µ”ô‰™±½…ĞµÉ¥¡Ğˆùí9Õµ‰•È¡¹¥¹ÍÕÉ…¹•A½¥¹ÑÍñğÀ¤¹Ñ½¥á• Ä¥õ@ğ½ˆøğ½ÍÁ…¸øğ½‘¥Øùí¹™É••A¡½¹”˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´ÈÉ½Õ¹‘•µ±œ‰œµ…µ‰•È´ÔÀÁà´ÈÁä´Ä¸ÔÑ•áĞµ…µ‰•È´ÜÀÀˆû®²Ó®3¶>Àƒ²‚s²fàèƒ²jSªâ#²‚píİ½¸¡¹•á±Õ‘•ü¹Á±…¸¥ôƒ
ÜYLíİ½¸¡¹•á±Õ‘•ü¹Ù…Ì¥ôƒ
Üƒ®ÎÓ¶^`íİ½¸¡¹•á±Õ‘•ü¹¥¹ÍÕÉ…¹”¥ôğ½‘¥Øùôğ½‘¥Øø¥ôğ½‘¥Øùô(€€€€€€€€ğ½‘¥Øùô¥ô(€€€€€€ğ½‘¥Øø(€€€€ğ½‘¥Øø(€€ğ½‘¥Øøì)ô((¼¨ƒªÒ®š³²zC®*P59C
ßªâÃ®Î½½
ÜÀÄÃ².ƒªŞs®–ğƒ®²Û²ZĞ!O®†pƒªÒ®š°ƒŠPƒ²vó²vó²z®‚”ƒ®“¶*ã®š·²*“²v`ƒ¶VÓ®.äƒ¶Z'²vƒ¶V§²
À€¨¼)½¹ÍĞ!M}I=]L€ôl(€ì±…‰•°è€Ÿ²vó®Âc®ª£®6à59@œ°Í¡½ÉĞè€59@œô°(€ì±…‰•°è€Ÿ²vó®Âc®ª£®6àƒªâÃ®Îœ°Í¡½ÉĞè€ŸªâÃ®Îœô°(€ì±…‰•°è€Ÿ²vó®Âc®ª£®6àƒªâÃ®Îœ°Í¡½ÉĞè€ŸªâÃ®Îœô°(€ì±…‰•°è€Ÿ²vó®Âc®ª£®6àƒªâÃ®Îœ°Í¡½ÉĞè€ŸªâÃ®Îœô°(€ì±…‰•°è€Ÿ²vó®Âc®ª£®6àƒ².ƒªŞpœ°Í¡½ÉĞè€Ÿ².ƒªŞpœô°)tì)½¹ÍĞ!M}AIQL€ô!M}I=]L¹µ…À ¡È¤€ôø€¡ìÍ¡½ÉĞèÈ¹Í¡½ÉĞ°¥‘àè5QI%a}I=]L¹¥¹‘•á=˜¡È¹±…‰•°¤ô¤¤¹™¥±Ñ•È ¡È¤€ôøÈ¹¥‘à€øô€À¤ì)½¹ÍĞµ…ÑÉ¥áI½İ½Õ¹Ğ€ô€¡°É¤¤€ôø€ ¡€˜˜¹µ…ÑÉ¥à€˜˜¹µ…ÑÉ¥ámÉ¥t¤ñğmt¤¹É•‘Õ” ¡Ì°Ø¤€ôøÌ€¬€¡Øñğ€À¤°€À¤ì)½¹ÍĞ¡Í½Õ¹Ğ€ô€¡¤€ôø!M}AIQL¹É•‘Õ” ¡Ì°À¤€ôøÌ€¬µ…ÑÉ¥áI½İ½Õ¹Ğ¡°À¹¥‘à¤°€À¤ì()½¹ÍĞ=5AI}5QI%L€ôl(€ì(€€€­•äè¡Ìœ°±…‰•°è!Lœ°Õ¹¥Ğè½Õ¹Ğœ°…±Œè¡¤ôù¡Í½Õ¹Ğ¡¤°(€€€Á…ÉÑÌé!M}AIQL¹µ…À ¡À¤ôø¡í±…‰•°éÀ¹Í¡½ÉĞ±…±Œè¡¤ôùµ…ÑÉ¥áI½İ½Õ¹Ğ¡±À¹¥‘à¥ô¤¤(€ô°(€ì­•äèÍ¥µ5¹Àœ°±…‰•°èM%459@œ°Õ¹¥Ğè½Õ¹Ğœ°…±Œè¡¤ôù=‰©•Ğ¹Ù…±Õ•Ì¡¹µ¹Á	Õ¹‘±•ññíô¤¹É•‘Õ” ¡Ì±Ø¤ôùÌ­9Õµ‰•È¡ÙñğÀ¤°À¤ô°(€ì­•äèÍ•½¹œ°±…‰•°èœÉ9œ°Õ¹¥Ğè½Õ¹Ğœ°…±Œè¡¤ôù=‰©•Ğ¹Ù…±Õ•Ì¡¹‰Õ¹‘±”É¹‘ññíô¤¹É•‘Õ” ¡Ì±Ø¤ôùÌ­9Õµ‰•È¡ÙñğÀ¤°À¤ô°(€ì­•äè¡½µ”œ°±…‰•°èŸ¶f ƒ².“²‚œ°Õ¹¥Ğè½Õ¹Ğœ°…±Œè¡¤ôù½µÁ±•Ñ•‘!½µ•½Õ¹Ğ¡¤ô°(€ì­•äè™É•”œ°±…‰•°èŸ¶R®š°œ°Õ¹¥Ğè½Õ¹Ğœ°…±Œè¡¤ôù9Õµ‰•È¡¹¡½µ•±…Ğü¹ÑÙÉ••ñğÀ¤ô°(€ì­•äèÍµ…ÉĞœ°±…‰•°èŸ²*“®#¶*ã¶f œ°Õ¹¥Ğè½Õ¹Ğœ°…±Œè¡¤ôù9Õµ‰•È¡¹¡½µ•±…Ğü¹Íµ…ÉÑ!½µ•ñğÀ¤ô°(€ì­•äèÁÉ½‘ÕÑ¥Ù¥Ñäœ°±…‰•°èŸ²w²
Ã²Äœ°Õ¹¥ĞèÁ½¥¹Ğœ°…±Œè¡±À¤ôù9Õµ‰•È¡Àü¹­Á¥M½É•ñğÀ¤ô°(€ì­•äèÕÁÍ•±°œ°±…‰•°èŸ²^²ªÆÓ²"`œ°Õ¹¥Ğè½Õ¹Ğœ°…±Œè¡¤ôù9Õµ‰•È¡¹Ñ…¥±½É•‘½Õ¹ÑñğÀ¤ô°(€ì­•äèÕÁÍ•±±µ½Õ¹Ğœ°±…‰•°èŸ®{²Ú“²‚s²V#®“²Ús²V„œ°Õ¹¥Ğèİ½¸œ°…±Œè¡¤ôù9Õµ‰•È¡¹Ñ…¥±½É•‘µ½Õ¹ÑñğÀ¤ô°(€ì­•äèÍ½¹¼œ°±…‰•°èŸ²3®àœ°Õ¹¥Ğè½Õ¹Ğœ°…±Œè¡¤ôù=‰©•Ğ¹Ù…±Õ•Ì¡¹Í½¹½ññíô¤¹É•‘Õ” ¡Ì±Ø¤ôùÌ­9Õµ‰•È¡ÙñğÀ¤°À¤ô°)tì()™Õ¹Ñ¥½¸™½Éµ…Ñ…Ñ•Q¥µ”¡¥Í¼¤ì(€½¹ÍĞ€ô¹•Ü…Ñ”¡¥Í¼¤ì(€É•ÑÕÉ¸€‘í¹•Ñ5½¹Ñ  ¤€¬€Åô¼‘í¹•Ñ…Ñ” ¥ô€‘íMÑÉ¥¹œ¡¹•Ñ!½ÕÉÌ ¤¤¹Á…‘MÑ…ÉĞ È°€œÀœ¥ôè‘íMÑÉ¥¹œ¡¹•Ñ5¥¹ÕÑ•Ì ¤¤¹Á…‘MÑ…ÉĞ È°€œÀœ¥õ€ì)ô()™Õ¹Ñ¥½¸É½ÕÁ%Ñ•µ1…‰•°¡½¹™¥œ°É½ÕÁ-•ä°¥Ñ•µ-•ä¤ì(€¥˜€¡É½ÕÁ-•ä€ôôô€¡½µ•	…Í”œ¤É•ÑÕÉ¸!=5}	M}%Q5L¹™¥¹ ¡¤¤€ôø¤¹­•ä€ôôô¥Ñ•µ-•ä¤ü¹±…‰•°ñğ¥Ñ•µ-•äì(€½¹ÍĞÑ…‰±”€ô½¹™¥œü¹mÉ½ÕÁ-•åtì(€É•ÑÕÉ¸€¡ÉÉ…ä¹¥ÍÉÉ…ä¡Ñ…‰±”¤€˜˜Ñ…‰±”¹™¥¹ ¡¤¤€ôø¤¹­•ä€ôôô¥Ñ•µ-•ä¤ü¹±…‰•°¤ñğ¥Ñ•µ-•äì)ô((¼¼½±‘}‘…Ñ„½¹•İ}‘…Ñ„¡)M=8¤ƒ®F@ƒ².s²‚C²vƒ®æªÖC¶VÓ²pƒ².“²‚s®†pƒ®ÂS®@ƒ¶V·®ª§®0ƒ®öG²V®)™Õ¹Ñ¥½¸‘¥™™…åI•½É‘Ì¡½¹™¥œ°½±‘I…Ü°¹•İI…Ü¤ì(€½¹ÍĞ½±‘€ô¹½Éµ…±¥é•…ä¡½±‘I…Ü¤ì(€½¹ÍĞ¹•İ€ô¹½Éµ…±¥é•…ä¡¹•İI…Ü¤ì(€½¹ÍĞ¡…¹•Ì€ômtì((€½±‘¹µ…ÑÉ¥à¹™½É…  ¡É½Ü°É¤¤€ôøì(€€€É½Ü¹™½É…  ¡½±‘Y…°°¤¤€ôøì(€€€€€½¹ÍĞ¹•İY…°€ô¹•İ¹µ…ÑÉ¥ámÉ¥tü¹m¥tñğ€Àì(€€€€€¥˜€ ¡½±‘Y…°ñğ€À¤€„ôô¹•İY…°¤ì(€€€€€€€¡…¹•Ì¹ÁÕÍ ¡ì±…‰•°è€‘í5QI%a}I=]}MmÉ¥tü¹±…‰•°ñğ€œôƒ
Ü€‘í5QI%a}=1Mm¥uõ€°½±‘Y…°è½±‘Y…°ñğ€À°¹•İY…°ô¤ì(€€€€€ô(€€€ô¤ì(€ô¤ì((€%1e}I=UA}-eL¹™½É…  ¡¬¤€ôøì(€€€½¹ÍĞ½±‘€ô½±‘¹É½ÕÁÍm­tñğíôì(€€€½¹ÍĞ¹•İ€ô¹•İ¹É½ÕÁÍm­tñğíôì(€€€½¹ÍĞ­•åÌ€ô¹•ÜM•Ğ¡l¸¸¹=‰©•Ğ¹­•åÌ¡½±‘¤°€¸¸¹=‰©•Ğ¹­•åÌ¡¹•İ¥t¤ì(€€€­•åÌ¹™½É…  ¡¬¤€ôøì(€€€€€½¹ÍĞ½±‘Y…°€ô½±‘m­tñğ€Àì(€€€€€½¹ÍĞ¹•İY…°€ô¹•İm­tñğ€Àì(€€€€€¥˜€¡½±‘Y…°€„ôô¹•İY…°¤¡…¹•Ì¹ÁÕÍ ¡ì±…‰•°èÉ½ÕÁ%Ñ•µ1…‰•°¡½¹™¥œ°¬°¬¤°½±‘Y…°°¹•İY…°ô¤ì(€€€ô¤ì(€ô¤ì((€½¹ÍĞaQI}1	1L€ôìÕÍÑI•½Õ¹Ğè€ŸªÎƒªÂw®NÇ®†tƒªÆÓ²"`œ°Ñ…¥±½É•‘½Õ¹Ğè€Ÿ®{²Ú“²‚s²V ƒ²^² ƒªÆÓ²"`œ°Ñ…¥±½É•‘µ½Õ¹Ğè€Ÿ®{²Ú“²‚s²V ƒ²^²ªâ#²V„œôì(€%1e}9U5I%}-eL¹™½É…  ¡¬¤€ôøì(€€€½¹ÍĞ½±‘Y…°€ô½±‘m­tñğ€Àì(€€€½¹ÍĞ¹•İY…°€ô¹•İm­tñğ€Àì(€€€¥˜€¡½±‘Y…°€„ôô¹•İY…°¤¡…¹•Ì¹ÁÕÍ ¡ì±…‰•°èaQI}1	1Mm­tñğ¬°½±‘Y…°°¹•İY…°ô¤ì(€ô¤ì((€É•ÑÕÉ¸¡…¹•Ìì)ô()™Õ¹Ñ¥½¸!¥ÍÑ½ÉåQ…ˆ¡ì•µÁ±½å••Ì°µ½¹Ñ °½¹™¥œô¤ì(€½¹ÍĞm•µÁ%°Í•ÑµÁ%‘t€ôÕÍ•MÑ…Ñ” œœ¤ì(€½¹ÍĞm±½Ì°Í•Ñ1½Ít€ôÕÍ•MÑ…Ñ”¡mt¤ì(€½¹ÍĞmÍ…±•Õ‘¥Ñ1½Ì±Í•ÑM…±•Õ‘¥Ñ1½ÍtõÕÍ•MÑ…Ñ”¡mt¤ì(€½¹ÍĞm¡½µ•Õ‘¥Ñ1½Ì±Í•Ñ!½µ•Õ‘¥Ñ1½ÍtõÕÍ•MÑ…Ñ”¡mt¤ì(€½¹ÍĞm±½…‘¥¹œ°Í•Ñ1½…‘¥¹t€ôÕÍ•MÑ…Ñ”¡™…±Í”¤ì(€½¹ÍĞm¹…µ•5…À°Í•Ñ9…µ•5…Át€ôÕÍ•MÑ…Ñ”¡íô¤ì((€ÕÍ•™™•Ğ  ¤€ôøì(€€€¥˜€¡•µÁ±½å••Ì¹±•¹Ñ €˜˜€…•µÁ%¤Í•ÑµÁ%¡•µÁ±½å••ÍlÁt¹¥¤ì(€ô°m•µÁ±½å••Ít¤ì€¼¼•Í±¥¹Ğµ‘¥Í…‰±”µ±¥¹”((€ÕÍ•™™•Ğ  ¤€ôøì(€€€Í•Ñ9…µ•5…À¡=‰©•Ğ¹™É½µ¹ÑÉ¥•Ì¡•µÁ±½å••Ì¹µ…À ¡”¤€ôøm”¹¥°”¹¹…µ•t¤¤¤ì(€ô°m•µÁ±½å••Ít¤ì((€ÕÍ•™™•Ğ  ¤€ôøì(€€€¥˜€ …•µÁ%¤É•ÑÕÉ¸ì(€€€€¡…Íå¹Œ€ ¤€ôøì(€€€€€Í•Ñ1½…‘¥¹œ¡ÑÉÕ”¤ì(€€€€€½¹ÍĞmä°µt€ôµ½¹Ñ ¹ÍÁ±¥Ğ œ´œ¤¹µ…À¡9Õµ‰•È¤ì(€€€€€½¹ÍĞ™É½´€ô€‘íµ½¹Ñ¡ô´ÀÅ€ì(€€€€€½¹ÍĞ¹•áÑ…Ñ”õ¹•Ü…Ñ”¡ä±´°Ä¤ì(€€€€€½¹ÍĞÑ¼€ô€‘í¹•áÑ…Ñ”¹•ÑÕ±±e•…È ¥ô´‘íMÑÉ¥¹œ¡¹•áÑ…Ñ”¹•Ñ5½¹Ñ  ¤¬Ä¤¹Á…‘MÑ…ÉĞ È°œÀœ¥ô´ÀÅ€ì((€€€€€½¹ÍĞm‘…¥±åI•Ì±Í…±•I•Ì±¡½µ•I•Ítõ…İ…¥ĞAÉ½µ¥Í”¹…±°¡l(€€€€€€€ÍÕÁ…‰…Í”¹™É½´ ‘…¥±å}É•½É‘Í}…Õ‘¥Ğœ¤(€€€€€€€€€€¹Í•±•Ğ ¥°İ½É­}‘…Ñ”°…Ñ¥½¸°½±‘}‘…Ñ„°¹•İ}‘…Ñ„°¡…¹•‘}‰ä°¡…¹•‘}…Ğœ¤(€€€€€€€€€€¹•Ä ÕÍ•É}¥œ°•µÁ%¤¹Ñ” İ½É­}‘…Ñ”œ°™É½´¤¹±Ğ İ½É­}‘…Ñ”œ°Ñ¼¤(€€€€€€€€€€¹½É‘•È ¡…¹•‘}…Ğœ°ì…Í•¹‘¥¹œè™…±Í”ô¤°(€€€€€€€ÍÕÁ…‰…Í”¹™É½´ ÕÍÑ½µ•É}Í…±•Í}…Õ‘¥Ğœ¤(€€€€€€€€€€¹Í•±•Ğ ¥±Í…±•}¥±…Ñ¥½¸±½±‘}É½Ü±¹•İ}É½Ü±¡…¹•‘}‰ä±¡…¹•‘}…Ğœ¤(€€€€€€€€€€¹•Ä ÕÍ•É}¥œ±•µÁ%¤¹½É‘•È ¡…¹•‘}…Ğœ±í…Í•¹‘¥¹œé™…±Í•ô¤¹±¥µ¥Ğ ÔÀÀ¤°(€€€€€€€ÍÕÁ…‰…Í”¹™É½´ ¡½µ•}½É‘•ÉÍ}…Õ‘¥Ğœ¤(€€€€€€€€€€¹Í•±•Ğ ¥±½É‘•É}¥±…Ñ¥½¸±½±‘}É½Ü±¹•İ}É½Ü±¡…¹•‘}‰ä±¡…¹•‘}…Ğœ¤(€€€€€€€€€€¹•Ä ÕÍ•É}¥œ±•µÁ%¤¹½É‘•È ¡…¹•‘}…Ğœ±í…Í•¹‘¥¹œé™…±Í•ô¤¹±¥µ¥Ğ ÔÀÀ¤°(€€€€€t¤ì((€€€€€¥˜ …‘…¥±åI•Ì¹•ÉÉ½È¥Í•Ñ1½Ì¡‘…¥±åI•Ì¹‘…Ñ…ññmt¤ì(€€€€€•±Í”Í•Ñ1½Ì¡mt¤ì((€€€€€½¹ÍĞ¥¹M…±•5½¹Ñ ô¡à¤ôùì(€€€€€€€½¹ÍĞõMÑÉ¥¹œ¡àü¹¹•İ}É½Üü¹Í…±•}‘…Ñ•ññàü¹½±‘}É½Üü¹Í…±•}‘…Ñ•ñğœœ¤ì(€€€€€€€É•ÑÕÉ¸¹ÍÑ…ÉÑÍ]¥Ñ ¡µ½¹Ñ ¤ì(€€€€€ôì(€€€€€½¹ÍĞ¥¹!½µ•5½¹Ñ ô¡à¤ôùì(€€€€€€€½¹ÍĞõMÑÉ¥¹œ¡àü¹¹•İ}É½Üü¹Í½ÕÉ•}İ½É­}‘…Ñ•ññàü¹½±‘}É½Üü¹Í½ÕÉ•}İ½É­}‘…Ñ•ñğœœ¤ì(€€€€€€€É•ÑÕÉ¸¹ÍÑ…ÉÑÍ]¥Ñ ¡µ½¹Ñ ¤ì(€€€€€ôì(€€€€€Í•ÑM…±•Õ‘¥Ñ1½Ì¡Í…±•I•Ì¹•ÉÉ½Èımtè¡Í…±•I•Ì¹‘…Ñ…ññmt¤¹™¥±Ñ•È¡¥¹M…±•5½¹Ñ ¤¤ì(€€€€€Í•Ñ!½µ•Õ‘¥Ñ1½Ì¡¡½µ•I•Ì¹•ÉÉ½Èımtè¡¡½µ•I•Ì¹‘…Ñ…ññmt¤¹™¥±Ñ•È¡¥¹!½µ•5½¹Ñ ¤¤ì(€€€€€Í•Ñ1½…‘¥¹œ¡™…±Í”¤ì(€€€ô¤ ¤ì(€ô°m•µÁ%°µ½¹Ñ¡t¤ì((€É•ÑÕÉ¸€ (€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰ÍÁ…”µä´Ìˆø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È…À´È™±•àµİÉ…Àˆø(€€€€€€€€ñÍ•±•ĞÙ…±Õ”õí•µÁ%‘ô½¹¡…¹”õì¡”¤€ôøÍ•ÑµÁ%¡”¹Ñ…É•Ğ¹Ù…±Õ”¥ô±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´‰½É‘•È‰½É‘•ÈµÉ…ä´ÈÀÀÉ½Õ¹‘•µ±œÁà´È¸ÔÁä´Ä¸Ô‰œµİ¡¥Ñ”ˆø(€€€€€€€€€í•µÁ±½å••Ì¹µ…À ¡”¤€ôø€ñ½ÁÑ¥½¸­•äõí”¹¥‘ôÙ…±Õ”õí”¹¥‘ôùí”¹¹…µ•ôƒ
Üí‘¥ÍÁ±…åMÑ½É•9…µ”¡”¹‰É…¹ ¥ôğ½½ÁÑ¥½¸ø¥ô(€€€€€€€€ğ½Í•±•Ğø(€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ…ä´ĞÀÀˆùíµ½¹Ñ¡1…‰•°¡µ½¹Ñ ¥ôƒ
Üƒ²‚²z—¶V€ƒ®V3®#®.ƒ²zC®>g²ró®†pƒªâÃ®†w®>ó²jPğ½ÍÁ…¸ø(€€€€€€ğ½‘¥Øø((€€€€€í±½…‘¥¹œ€ü€ (€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ…ä´ĞÀÀÁä´àÑ•áĞµ•¹Ñ•Èˆû®Ú#®~³²b“®*Pƒ²’D¸¸¸ğ½‘¥Øø(€€€€€€¤€è±½Ì¹±•¹Ñ €ôôô€À€ü€ (€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµİ¡¥Ñ”É½Õ¹‘•µá°‰½É‘•È‰½É‘•ÈµÉ…ä´ÄÀÀÑ•áĞµáÌÑ•áĞµÉ…ä´ĞÀÀÁä´àÑ•áĞµ•¹Ñ•Èˆû²vÓ®Ê ƒ®.°ƒ®ÎªÊôƒªâÃ®†w²vĞƒ²^²ZÓ²jP¸ğ½‘¥Øø(€€€€€€¤€è€ (€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµİ¡¥Ñ”É½Õ¹‘•µá°‰½É‘•È‰½É‘•ÈµÉ…ä´ÄÀÀ‘¥Ù¥‘”µä‘¥Ù¥‘”µÉ…ä´ÔÀˆø(€€€€€€€€€í±½Ì¹µ…À ¡°¤€ôøì(€€€€€€€€€€€½¹ÍĞ‘•Ñ…¥°€ô‘¥™™…åI•½É‘Ì¡½¹™¥œ°°¹½±‘}‘…Ñ„°°¹¹•İ}‘…Ñ„¤ì(€€€€€€€€€€€½¹ÍĞÑ½Ñ…±9•Ü€ô‘•Ñ…¥°¹É•‘Õ” ¡Ì°Œ¤€ôøÌ€¬Œ¹¹•İY…°°€À¤ì(€€€€€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€€€ñ‘¥Ø­•äõí°¹¥‘ô±…ÍÍ9…µ”ô‰Áà´ĞÁä´Ìˆø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•Ñİ••¸…À´Èˆø(€€€€€€€€€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´Ñ•áĞµÉ…ä´ÜÀÀˆùí°¹İ½É­}‘…Ñ•ô€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµÉ…ä´ÌÀÀˆû
Üğ½ÍÁ…¸øí°¹…Ñ¥½¸€ôôô€¥¹Í•ÉĞœ€ü€Ÿ²Ös²Ò ƒ²z®‚”œ€è€Ÿ²"c²‚Tôğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÅÁátÑ•áĞµÉ…ä´ĞÀÀˆùí™½Éµ…Ñ…Ñ•Q¥µ”¡°¹¡…¹•‘}…Ğ¥ôƒ
Üí¹…µ•5…Ám°¹¡…¹•‘}‰åtñğ€Ÿ²V0ƒ²"`ƒ²^²v0ôğ½‘¥Øø(€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€í‘•Ñ…¥°¹±•¹Ñ €ôôô€À€˜˜€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ…ä´ĞÀÀˆû®ÎªÊôƒ²^²v0ğ½ÍÁ…¸ùô(€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€í‘•Ñ…¥°¹±•¹Ñ €ø€À€˜˜€ (€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´ÈÍÁ…”µä´Äˆø(€€€€€€€€€€€€€€€€€€€í‘•Ñ…¥°¹µ…À ¡Œ°¤¤€ôø€ (€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø­•äõí¥ô±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•Ñİ••¸Ñ•áĞµáÌˆø(€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµÉ…ä´ÔÀÀˆùíŒ¹±…‰•±ôğ½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”õí™½¹Ğµµ•‘¥Õ´Ñ…‰Õ±…Èµ¹ÕµÌ€‘íŒ¹½±‘Y…°€„ôôŒ¹¹•İY…°€ü€Ñ•áĞµ…µ‰•È´ØÀÀœ€è€Ñ•áĞµÉ…ä´ĞÀÀõôø(€€€€€€€€€€€€€€€€€€€€€€€€€í°¹…Ñ¥½¸€ôôô€¥¹Í•ÉĞœ€ü€‘íŒ¹¹•İY…±÷ªÆÑ€€è€‘íŒ¹½±‘Y…±÷ªÆĞƒŠH€‘íŒ¹¹•İY…±÷ªÆÑô(€€€€€€€€€€€€€€€€€€€€€€€€ğ½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€¤¥ô(€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€¥ô(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€¤ì(€€€€€€€€€ô¥ô(€€€€€€€€ğ½‘¥Øø(€€€€€€¥ô((€€€€€ì¡Í…±•Õ‘¥Ñ1½Ì¹±•¹Ñ øÁññ¡½µ•Õ‘¥Ñ1½Ì¹±•¹Ñ øÀ¤˜˜ (€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµİ¡¥Ñ”É½Õ¹‘•µá°‰½É‘•È‰½É‘•ÈµÉ…ä´ÄÀÀ½Ù•É™±½Üµ¡¥‘‘•¸ˆø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Áà´ĞÁä´Ì‰½É‘•Èµˆ‰½É‘•ÈµÉ…ä´ÔÀˆø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´™½¹Ğµ‰½±Ñ•áĞµÉ…ä´àÀÀˆûªÎƒªÂw®Îƒ¶2C®ƒ
Üƒ¶f ƒ®ÎªÊôƒ²vÓ®‚”ğ½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀµĞ´À¸ÔˆùØÈÄ¸ÌË®Ú¶Àƒ¶2C®¿¶f ƒ²nC®Îàƒ®ÎªÊ÷®>²^C²pƒ²zC®>dƒ®ÎÓªÒ¶VÓ²jP¸ğ½‘¥Øø(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‘¥Ù¥‘”µä‘¥Ù¥‘”µÉ…ä´ÔÀˆø(€€€€€€€€€€€íl¸¸¹Í…±•Õ‘¥Ñ1½Ì¹µ…À¡àôø¡ì¸¸¹à±}­¥¹èÍ…±”ô¤¤°¸¸¹¡½µ•Õ‘¥Ñ1½Ì¹µ…À¡àôø¡ì¸¸¹à±}­¥¹è¡½µ”ô¤¥t(€€€€€€€€€€€€€€¹Í½ÉĞ ¡„±ˆ¤ôù¹•Ü…Ñ”¡ˆ¹¡…¹•‘}…Ğ¤µ¹•Ü…Ñ”¡„¹¡…¹•‘}…Ğ¤¤(€€€€€€€€€€€€€€¹Í±¥” À°ÄÀÀ¤(€€€€€€€€€€€€€€¹µ…À ¡°¤ôùì(€€€€€€€€€€€€€€€½¹ÍĞ‰•™½É”õ°¹½±‘}É½İññíô±…™Ñ•Èõ°¹¹•İ}É½İññíôì(€€€€€€€€€€€€€€€½¹ÍĞ¥ÍM…±”õ°¹}­¥¹ôôôÍ…±”œì(€€€€€€€€€€€€€€€½¹ÍĞ‘…Ñ”õ¥ÍM…±”ü¡…™Ñ•È¹Í…±•}‘…Ñ•ññ‰•™½É”¹Í…±•}‘…Ñ”¤è¡…™Ñ•È¹Í½ÕÉ•}İ½É­}‘…Ñ•ññ‰•™½É”¹Í½ÕÉ•}İ½É­}‘…Ñ”¤ì(€€€€€€€€€€€€€€€½¹ÍĞ‰•™½É•1…‰•°õ¥ÍM…±”ü¡‰•™½É”¹µ•ÑÉ¥}±…‰•±ñğœœ¤è¡‰•™½É”¹ÁÉ½‘ÕÑ}ÑåÁ•ñğœœ¤ì(€€€€€€€€€€€€€€€½¹ÍĞ…™Ñ•É1…‰•°õ¥ÍM…±”ü¡…™Ñ•È¹µ•ÑÉ¥}±…‰•±ñğœœ¤è¡…™Ñ•È¹ÁÉ½‘ÕÑ}ÑåÁ•ñğœœ¤ì(€€€€€€€€€€€€€€€½¹ÍĞ…Ñ¥½¹1…‰•°õ°¹…Ñ¥½¸ôôô¥¹Í•ÉĞœüŸ®NÇ®†tœé°¹…Ñ¥½¸ôôô‘•±•Ñ”œüŸ²
·²‚pœèŸ²"c²‚Tœì(€€€€€€€€€€€€€€€½¹ÍĞÙ•ÉÍ¥½¹	•™½É”õ9Õµ‰•È¡‰•™½É”¹Í¡•µ…}Ù•ÉÍ¥½¹ññ‰•™½É”¹Í½ÕÉ•}µ•Ñ„ü¹Í¡•µ…Y•ÉÍ¥½¹ñğÄ¤ì(€€€€€€€€€€€€€€€½¹ÍĞÙ•ÉÍ¥½¹™Ñ•Èõ9Õµ‰•È¡…™Ñ•È¹Í¡•µ…}Ù•ÉÍ¥½¹ññ…™Ñ•È¹Í½ÕÉ•}µ•Ñ„ü¹Í¡•µ…Y•ÉÍ¥½¹ññÙ•ÉÍ¥½¹	•™½É•ñğÄ¤ì(€€€€€€€€€€€€€€€É•ÑÕÉ¸€ñ‘¥Ø­•äõí€‘í°¹}­¥¹‘ô´‘í°¹¥‘õô±…ÍÍ9…µ”ô‰Áà´ĞÁä´Ìˆø(€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµÍÑ…ÉĞ©ÕÍÑ¥™äµ‰•Ñİ••¸…À´Èˆø(€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µ¥¸µÜ´Àˆø(€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌ™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÉ…ä´ÜÀÀˆùí‘…Ñ•ñğœ´ôƒ
Üí¥ÍM…±”üŸ¶2C®œèŸ¶f ôí…Ñ¥½¹1…‰•±ôğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÅÁátÑ•áĞµÉ…ä´ÔÀÀµĞ´À¸Ô‰É•…¬µİ½É‘Ìˆø(€€€€€€€€€€€€€€€€€€€€€€€í°¹…Ñ¥½¸ôôôÕÁ‘…Ñ”œ˜™‰•™½É•1…‰•°„ôõ…™Ñ•É1…‰•°ı€‘í‰•™½É•1…‰•±ñğœ´ôƒŠH€‘í…™Ñ•É1…‰•±ñğœ´õ€è¡…™Ñ•É1…‰•±ññ‰•™½É•1…‰•±ñğŸ²nC®Îàƒ®6Ã²vÓ¶Àœ¥ô(€€€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€íÙ•ÉÍ¥½¹	•™½É”„ôõÙ•ÉÍ¥½¹™Ñ•È˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÙ¥½±•Ğ´ØÀÀµĞ´Äˆû®6Ã²vÓ¶Àƒ¶bW².tÙíÙ•ÉÍ¥½¹	•™½É•ôƒŠHÙíÙ•ÉÍ¥½¹™Ñ•Éôğ½‘¥Øùô(€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀÍ¡É¥¹¬´Àˆùí™½Éµ…Ñ…Ñ•Q¥µ”¡°¹¡…¹•‘}…Ğ¥ôğ½‘¥Øø(€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€ğ½‘¥Øøì(€€€€€€€€€€€€€ô¥ô(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€ğ½‘¥Øø(€€€€€€¥ô(€€€€ğ½‘¥Øø(€€¤ì)ô(()™Õ¹Ñ¥½¸½µÁ…É¥Í½¹Y¥•Ü¡ìÉ½İÌô¤ì(€½¹ÍĞmÉ½ÕÁ	ä°Í•ÑÉ½ÕÁ	åt€ôÕÍ•MÑ…Ñ” •µÁ±½å•”œ¤ì€¼¼•µÁ±½å•”ğ‰É…¹ (€½¹ÍĞmµ•ÑÉ¥-•ä°Í•Ñ5•ÑÉ¥-•åt€ôÕÍ•MÑ…Ñ” ¡Ìœ¤ì(€½¹ÍĞµ•ÑÉ¥Œ€ô=5AI}5QI%L¹™¥¹ ¡´¤€ôø´¹­•ä€ôôôµ•ÑÉ¥-•ä¤ñğ=5AI}5QI%MlÁtì(€½¹ÍĞ™µĞ€ô€¡Ø¤€ôø€¡µ•ÑÉ¥Œ¹Õ¹¥Ğ€ôôô€İ½¸œ€üİ½¸¡Ø¤€èµ•ÑÉ¥Œ¹Õ¹¥Ğ€ôôô€Á½¥¹Ğœ€ü€‘í™µÑ9Õ´¡Øñğ€À°Ä¥õA€€è€‘í™µÑ½Õ¹Ğ¡Ø¥÷ªÆÑ€¤ì((€±•Ğ‘…Ñ„ì(€¥˜€¡É½ÕÁ	ä€ôôô€•µÁ±½å•”œ¤ì(€€€‘…Ñ„€ôÉ½İÌ¹µ…À ¡È¤€ôø€¡ì(€€€€€±…‰•°è€‘íÈ¹¹…µ•ô€ ‘í‘¥ÍÁ±…åMÑ½É•9…µ”¡È¹‰É…¹ ¥ô¥€°(€€€€€Ù…±Õ”èµ•ÑÉ¥Œ¹…±Œ¡È¹‘É…™Ğ°È¹Á…ä¤°(€€€€€Á…ÉÑÌèµ•ÑÉ¥Œ¹Á…ÉÑÌ€üµ•ÑÉ¥Œ¹Á…ÉÑÌ¹µ…À ¡À¤€ôøÀ¹…±Œ¡È¹‘É…™Ğ°È¹Á…ä¤¤€è¹Õ±°°(€€€ô¤¤ì(€ô•±Í”ì(€€€½¹ÍĞ‰å	É…¹ €ôíôì(€€€É½İÌ¹™½É…  ¡È¤€ôøì(€€€€€½¹ÍĞÕÈ€ô‰å	É…¹¡mÈ¹‰É…¹¡tñğì±…‰•°èÈ¹‰É…¹ °Ù…±Õ”è€À°Á…ÉÑÌèµ•ÑÉ¥Œ¹Á…ÉÑÌ€üµ•ÑÉ¥Œ¹Á…ÉÑÌ¹µ…À  ¤€ôø€À¤€è¹Õ±°ôì(€€€€€ÕÈ¹Ù…±Õ”€¬ôµ•ÑÉ¥Œ¹…±Œ¡È¹‘É…™Ğ°È¹Á…ä¤ì(€€€€€¥˜€¡ÕÈ¹Á…ÉÑÌ¤µ•ÑÉ¥Œ¹Á…ÉÑÌ¹™½É…  ¡À°¤¤€ôøìÕÈ¹Á…ÉÑÍm¥t€¬ôÀ¹…±Œ¡È¹‘É…™Ğ°È¹Á…ä¤ìô¤ì(€€€€€‰å	É…¹¡mÈ¹‰É…¹¡t€ôÕÈì(€€€ô¤ì(€€€‘…Ñ„€ô=‰©•Ğ¹Ù…±Õ•Ì¡‰å	É…¹ ¤ì(€ô(€‘…Ñ„€ô‘…Ñ„¹Í½ÉĞ ¡„°ˆ¤€ôøˆ¹Ù…±Õ”€´„¹Ù…±Õ”¤ì(€½¹ÍĞµ…à€ô5…Ñ ¹µ…à Ä°€¸¸¹‘…Ñ„¹µ…À ¡¤€ôø¹Ù…±Õ”¤¤ì(€½¹ÍĞÉ…¹‘Q½Ñ…°€ô‘…Ñ„¹É•‘Õ” ¡Ì°¤€ôøÌ€¬¹Ù…±Õ”°€À¤ì((€É•ÑÕÉ¸€ (€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰ÍÁ…”µä´Ğˆø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È…À´È™±•àµİÉ…Àˆø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à‰œµİ¡¥Ñ”‰½É‘•È‰½É‘•ÈµÉ…ä´ÈÀÀÉ½Õ¹‘•µ±œÀ´À¸Ôˆø(€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôøÍ•ÑÉ½ÕÁ	ä •µÁ±½å•”œ¥ô±…ÍÍ9…µ”õíÁà´ÌÁä´Ä¸ÔÉ½Õ¹‘•µµÑ•áĞµÍ´™½¹Ğµµ•‘¥Õ´€‘íÉ½ÕÁ	ä€ôôô€•µÁ±½å•”œ€ü€‰œµÙ¥½±•Ğ´ØÀÀÑ•áĞµİ¡¥Ñ”œ€è€Ñ•áĞµÉ…ä´ÔÀÀõôû²²nC®Îğ½‰ÕÑÑ½¸ø(€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôøÍ•ÑÉ½ÕÁ	ä ‰É…¹ œ¥ô±…ÍÍ9…µ”õíÁà´ÌÁä´Ä¸ÔÉ½Õ¹‘•µµÑ•áĞµÍ´™½¹Ğµµ•‘¥Õ´€‘íÉ½ÕÁ	ä€ôôô€‰É…¹ œ€ü€‰œµÙ¥½±•Ğ´ØÀÀÑ•áĞµİ¡¥Ñ”œ€è€Ñ•áĞµÉ…ä´ÔÀÀõôû®“²z—®Îğ½‰ÕÑÑ½¸ø(€€€€€€€€ğ½‘¥Øø(€€€€€€€€ñÍ•±•ĞÙ…±Õ”õíµ•ÑÉ¥-•åô½¹¡…¹”õì¡”¤€ôøÍ•Ñ5•ÑÉ¥-•ä¡”¹Ñ…É•Ğ¹Ù…±Õ”¥ô±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´‰½É‘•È‰½É‘•ÈµÉ…ä´ÈÀÀÉ½Õ¹‘•µ±œÁà´È¸ÔÁä´Ä¸Ô‰œµİ¡¥Ñ”ˆø(€€€€€€€€€í=5AI}5QI%L¹µ…À ¡´¤€ôø€ñ½ÁÑ¥½¸­•äõí´¹­•åôÙ…±Õ”õí´¹­•åôùí´¹±…‰•±ôğ½½ÁÑ¥½¸ø¥ô(€€€€€€€€ğ½Í•±•Ğø(€€€€€€ğ½‘¥Øø((€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµİ¡¥Ñ”É½Õ¹‘•µá°‰½É‘•È‰½É‘•ÈµÉ…ä´ÄÀÀÀ´ĞÍÁ…”µä´È¸Ôˆø(€€€€€€€í‘…Ñ„¹±•¹Ñ €ø€À€˜˜€ (€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•Ñİ••¸Áˆ´Èµˆ´Ä‰½É‘•Èµˆ‰½É‘•ÈµÉ…ä´ÔÀˆø(€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ…ä´ĞÀÀˆùíÉ½ÕÁ	ä€ôôô€•µÁ±½å•”œ€ü€Ÿ²‚²ÊĞƒ²²n@œ€è€Ÿ²‚²ÊĞƒ®“²z”ôƒ¶V§ªÎğ½ÍÁ…¸ø(€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´™½¹Ğµ‰½±Ñ•áĞµÉ…ä´àÀÀˆùí™µĞ¡É…¹‘Q½Ñ…°¥ôğ½ÍÁ…¸ø(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€¥ô(€€€€€€€í‘…Ñ„¹±•¹Ñ €ôôô€À€˜˜€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ…ä´ĞÀÀÑ•áĞµ•¹Ñ•ÈÁä´Øˆû®6Ã²vÓ¶ÃªÂ ƒ²^²*×®.#®.¸ğ½‘¥Øùô(€€€€€€€í‘…Ñ„¹µ…À ¡°¤¤€ôø€ (€€€€€€€€€€ñ‘¥Ø­•äõí¹±…‰•±ô±…ÍÍ9…µ”ô‰Áˆ´Äˆø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•Ñİ••¸Ñ•áĞµáÌµˆ´Äˆø(€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµÉ…ä´ØÀÀÑÉÕ¹…Ñ”ÁÈ´Èˆùí¤€¬€Åô¸í¹±…‰•±ôğ½ÍÁ…¸ø(€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÉ…ä´àÀÀİ¡¥Ñ•ÍÁ…”µ¹½İÉ…Àˆùí™µĞ¡¹Ù…±Õ”¥ôğ½ÍÁ…¸ø(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰ ´È‰œµÉ…ä´ÄÀÀÉ½Õ¹‘•µ™Õ±°½Ù•É™±½Üµ¡¥‘‘•¸ˆø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰ µ™Õ±°‰œµÙ¥½±•Ğ´ÔÀÀÉ½Õ¹‘•µ™Õ±°ˆÍÑå±”õíìİ¥‘Ñ è€‘í5…Ñ ¹µ…à È°€¡¹Ù…±Õ”€¼µ…à¤€¨€ÄÀÀ¥ô•€õô€¼ø(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€í¹Á…ÉÑÌ€˜˜€ (€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´Ä™±•à™±•àµİÉ…À…Àµà´È¸Ô…Àµä´À¸ÔÑ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀˆø(€€€€€€€€€€€€€€€íµ•ÑÉ¥Œ¹Á…ÉÑÌ¹µ…À ¡À°Á¤¤€ôø€ (€€€€€€€€€€€€€€€€€€ñÍÁ…¸­•äõíÀ¹±…‰•±ôùíÀ¹±…‰•±ô€ñˆ±…ÍÍ9…µ”õíÑ…‰Õ±…Èµ¹ÕµÌ€‘í¹Á…ÉÑÍmÁ¥t€ø€À€ü€Ñ•áĞµÉ…ä´ØÀÀœ€è€Ñ•áĞµÉ…ä´ÌÀÀõôùí¹Á…ÉÑÍmÁ¥uôğ½ˆøğ½ÍÁ…¸ø(€€€€€€€€€€€€€€€€¤¥ô(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€¥ô(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€¤¥ô(€€€€€€ğ½‘¥Øø(€€€€ğ½‘¥Øø(€€¤ì)ô()½¹ÍĞ5A1=e}=1}1	1L€ôì(€¡Ìè!Lœ°Í¥µ5¹ÀèM%459@œ°Í•½¹èœÉ9œ°¡½µ”èŸ¶f œ°ÑÙÉ•”èŸ¶R®š°œ°Íµ…ÉÑ!½µ”èŸ²*“¶f œ°(€Í½¹¼èŸ²3®àœ°Ñ…¥±½É•‘µ½Õ¹ĞèŸ®{²Ú“²‚s²V ƒ®“²Úpœ°Ñ…¥±½É•èŸ²^²ªÆĞœ°Á½¥¹ÑÌèŸ²ÇªÎó®NÇªâ%@œ°(€­Á¤èŸ²w²
Ã²Äœ°ÁÉ½‘ÕÑ¥Ù¥ÑäèŸ²w²
Ã²Äœ°¥¹•¹Ñ¥Ù”èŸ²vã²ó¶.Ã®â0œ°)ôì()™Õ¹Ñ¥½¸µÁ±½å••½…±MÕµµ…Éä¡ìµ½¹Ñ °•¹ÑÉäô¤ì(€½¹ÍĞ½…±Ì€ô•¹ÑÉäü¹½…±Ìñğíôì(€½¹ÍĞÉ½İÌ€ô=‰©•Ğ¹•¹ÑÉ¥•Ì¡½…±Ì¤¹™¥±Ñ•È ¡l°Ù…±Õ•t¤€ôø9Õµ‰•È¡Ù…±Õ”¤€ø€À¤ì(€¥˜€ …É½İÌ¹±•¹Ñ ¤É•ÑÕÉ¸€ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´ÈÑ•áĞµlÄÁÁát™½¹Ğµµ•‘¥Õ´Ñ•áĞµÉ•´ĞÀÀˆùíµ½¹Ñ¡1…‰•°¡µ½¹Ñ ¥ôƒªÂs²vàƒ®ª§¶Fpƒ®¾ã²“²‚Tğ½‘¥Øøì(€É•ÑÕÉ¸€ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´Èˆø(€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁát™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÙ¥½±•Ğ´ØÀÀˆùíµ½¹Ñ¡1…‰•°¡µ½¹Ñ ¥ôƒªÂs²vàƒ®ª§¶Fpğ½‘¥Øø(€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µĞ´Ä™±•à™±•àµİÉ…À…À´Äˆø(€€€€€íÉ½İÌ¹µ…À ¡m­•ä±Ù…±Õ•t¤ôøñÍÁ…¸­•äõí­•åô±…ÍÍ9…µ”ô‰É½Õ¹‘•µµ‰œµÙ¥½±•Ğ´ÔÀÁà´Ä¸ÔÁä´ÄÑ•áĞµlåÁát™½¹Ğµµ•‘¥Õ´Ñ•áĞµÙ¥½±•Ğ´ÜÀÀˆø(€€€€€€€í5A1=e}=1}1	1Mm­•åuññ­•åôí­•äôôôÑ…¥±½É•‘µ½Õ¹Ğññ­•äôôô¥¹•¹Ñ¥Ù”œıİ½¸¡Ù…±Õ”¤é€‘í™µÑ9Õ´¡Ù…±Õ”°Ä¥ô‘ílÁ½¥¹ÑÌœ°­Á¤œ°ÁÉ½‘ÕÑ¥Ù¥Ñät¹¥¹±Õ‘•Ì¡­•ä¤ü@œèŸªÆĞõô(€€€€€€ğ½ÍÁ…¸ø¥ô(€€€€ğ½‘¥Øø(€€ğ½‘¥Øøì)ô()™Õ¹Ñ¥½¸µÁ±½å••5…¹…•È¡ì•µÁ±½å••Ì°…‘‘µÁ±½å•”°ÕÁ‘…Ñ•µÁ±½å•”°É•µ½Ù•µÁ±½å•”°ÍÑ½É•Ì°…‘‘MÑ½É”°É•µ½Ù•MÑ½É”°…ÕÑ¡UÍ•É%°µ½¹Ñ °•µÁ±½å••½…±5…Àõíô°•µÁ±½å••½…±Í1½…‘¥¹œõ™…±Í”°É•™É•Í¡µÁ±½å••½…±Ìô¤ì(€½¹ÍĞm™½É´°Í•Ñ½Éµt€ôÕÍ•MÑ…Ñ”¡ì¹…µ”è€œœ°‰É…¹ èÍÑ½É•ÍlÁtñğ€œœ°Á½Í¥Ñ¥½¸è€Ÿ²
³²n@œ°¡¥É•…Ñ”è€œœô¤ì(€½¹ÍĞm•‘¥Ñ¥¹%°Í•Ñ‘¥Ñ¥¹%‘t€ôÕÍ•MÑ…Ñ”¡¹Õ±°¤ì(€½¹ÍĞm•‘¥Ñ½É´°Í•Ñ‘¥Ñ½Éµt€ôÕÍ•MÑ…Ñ”¡íô¤ì(€½¹ÍĞm¹•İMÑ½É”°Í•Ñ9•İMÑ½É•t€ôÕÍ•MÑ…Ñ” œœ¤ì((€½¹ÍĞÍÕ‰µ¥Ğ€ô€ ¤€ôøì(€€€¥˜€ …™½É´¹¹…µ”¹ÑÉ¥´ ¤ñğ€…™½É´¹‰É…¹ ¤É•ÑÕÉ¸ì(€€€…‘‘µÁ±½å•”¡™½É´¹¹…µ”¹ÑÉ¥´ ¤°™½É´¹‰É…¹ °™½É´¹Á½Í¥Ñ¥½¸°™½É´¹¡¥É•…Ñ”¤ì(€€€Í•Ñ½É´¡ì¹…µ”è€œœ°‰É…¹ èÍÑ½É•ÍlÁtñğ€œœ°Á½Í¥Ñ¥½¸è€Ÿ²
³²n@œ°¡¥É•…Ñ”è€œœô¤ì(€ôì(€½¹ÍĞÍÑ…ÉÑ‘¥Ğ€ô€¡”¤€ôøìÍ•Ñ‘¥Ñ¥¹%¡”¹¥¤ìÍ•Ñ‘¥Ñ½É´¡ì¹…µ”è”¹¹…µ”°‰É…¹ è”¹‰É…¹ °Á½Í¥Ñ¥½¸è”¹Á½Í¥Ñ¥½¸°¡¥É•…Ñ”è”¹¡¥É•…Ñ”ñğ€œœô¤ìôì(€½¹ÍĞÍ…Ù•‘¥Ğ€ô€ ¤€ôøìÕÁ‘…Ñ•µÁ±½å•”¡•‘¥Ñ¥¹%°•‘¥Ñ½É´¤ìÍ•Ñ‘¥Ñ¥¹%¡¹Õ±°¤ìôì((€½¹ÍĞm™¥±Ñ•É	É…¹ °Í•Ñ¥±Ñ•É	É…¹¡t€ôÕÍ•MÑ…Ñ” Ÿ²‚²ÊĞœ¤ì(€½¹ÍĞmÍ½ÉÑ	ä°Í•ÑM½ÉÑ	åt€ôÕÍ•MÑ…Ñ” ¡¥É••ÍŒœ¤ì(€½¹ÍĞm¹…µ•EÕ•Éä°Í•Ñ9…µ•EÕ•Éåt€ôÕÍ•MÑ…Ñ” œœ¤ì((€½¹ÍĞmÍ¡½İ%¹…Ñ¥Ù”°Í•ÑM¡½İ%¹…Ñ¥Ù•t€ôÕÍ•MÑ…Ñ”¡™…±Í”¤ì(€½¹ÍĞm¥¹…Ñ¥Ù•1¥ÍĞ°Í•Ñ%¹…Ñ¥Ù•1¥ÍÑt€ôÕÍ•MÑ…Ñ”¡mt¤ì(€½¹ÍĞm¥¹…Ñ¥Ù•1½…‘¥¹œ°Í•Ñ%¹…Ñ¥Ù•1½…‘¥¹t€ôÕÍ•MÑ…Ñ”¡™…±Í”¤ì((€½¹ÍĞ±½…‘%¹…Ñ¥Ù”€ô…Íå¹Œ€ ¤€ôøì(€€€Í•Ñ%¹…Ñ¥Ù•1½…‘¥¹œ¡ÑÉÕ”¤ì(€€€½¹ÍĞì‘…Ñ„°•ÉÉ½Èô€ô…İ…¥ĞÍÕÁ…‰…Í”(€€€€€€¹™É½´ ÁÉ½™¥±•Ìœ¤(€€€€€€¹Í•±•Ğ ¥°¹…µ”°•µÁ±½å••}½‘”°ÍÑ½É•}¹…µ”°Á½Í¥Ñ¥½¸°¡¥É•}‘…Ñ”œ¤(€€€€€€¹•Ä …Ñ¥Ù”œ°™…±Í”¤(€€€€€€¹½É‘•È ¹…µ”œ°ì…Í•¹‘¥¹œèÑÉÕ”ô¤ì(€€€¥˜€ …•ÉÉ½È¤Í•Ñ%¹…Ñ¥Ù•1¥ÍĞ¡‘…Ñ„ñğmt¤ì(€€€Í•Ñ%¹…Ñ¥Ù•1½…‘¥¹œ¡™…±Í”¤ì(€ôì(€½¹ÍĞÑ½±•M¡½İ%¹…Ñ¥Ù”€ô€ ¤€ôøì(€€€½¹ÍĞ¹•áĞ€ô€…Í¡½İ%¹…Ñ¥Ù”ì(€€€Í•ÑM¡½İ%¹…Ñ¥Ù”¡¹•áĞ¤ì(€€€¥˜€¡¹•áĞ¤±½…‘%¹…Ñ¥Ù” ¤ì(€ôì(€½¹ÍĞÉ•…Ñ¥Ù…Ñ”€ô…Íå¹Œ€¡¥¤€ôøì(€€€½¹ÍĞì•ÉÉ½Èô€ô…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ ÁÉ½™¥±•Ìœ¤¹ÕÁ‘…Ñ”¡ì…Ñ¥Ù”èÑÉÕ”ô¤¹•Ä ¥œ°¥¤ì(€€€¥˜€ …•ÉÉ½È¤ì(€€€€€Í•Ñ%¹…Ñ¥Ù•1¥ÍĞ ¡ÁÉ•Ø¤€ôøÁÉ•Ø¹™¥±Ñ•È ¡À¤€ôøÀ¹¥€„ôô¥¤¤ì(€€€€€İ¥¹‘½Ü¹±½…Ñ¥½¸¹É•±½… ¤ì€¼¼ƒ®ª§®†tƒªÂÇ².ƒ²vƒ²r¶VĞƒ²#®†sªÎƒ²æ €£ªÂ®.£¶VcªÎ€ƒ¶fW².“¶Vpƒ®Â§².t¤(€€€ô(€ôì((€½¹ÍĞÙ¥Í¥‰±•µÁ±½å••Ì€ô•µÁ±½å••Ì(€€€€¹™¥±Ñ•È ¡”¤€ôø™¥±Ñ•É	É…¹ €ôôô€Ÿ²‚²ÊĞœñğ”¹‰É…¹ €ôôô™¥±Ñ•É	É…¹ ¤(€€€€¹™¥±Ñ•È ¡”¤€ôø€…¹…µ•EÕ•Éä¹ÑÉ¥´ ¤ñğ”¹¹…µ”¹¥¹±Õ‘•Ì¡¹…µ•EÕ•Éä¹ÑÉ¥´ ¤¤¤(€€€€¹Í±¥” ¤(€€€€¹Í½ÉĞ ¡„°ˆ¤€ôøì(€€€€€¥˜€¡Í½ÉÑ	ä€ôôô€¡¥É••ÍŒœ¤É•ÑÕÉ¸€¡ˆ¹¡¥É•…Ñ”ñğ€œœ¤¹±½…±•½µÁ…É”¡„¹¡¥É•…Ñ”ñğ€œœ¤ì(€€€€€¥˜€¡Í½ÉÑ	ä€ôôô€¡¥É•ÍŒœ¤É•ÑÕÉ¸€¡„¹¡¥É•…Ñ”ñğ€œœ¤¹±½…±•½µÁ…É”¡ˆ¹¡¥É•…Ñ”ñğ€œœ¤ì(€€€€€¥˜€¡Í½ÉÑ	ä€ôôô€¹…µ”œ¤É•ÑÕÉ¸„¹¹…µ”¹±½…±•½µÁ…É”¡ˆ¹¹…µ”¤ì(€€€€€¥˜€¡Í½ÉÑ	ä€ôôô€‰É…¹ œ¤É•ÑÕÉ¸„¹‰É…¹ ¹±½…±•½µÁ…É”¡ˆ¹‰É…¹ ¤ì(€€€€€É•ÑÕÉ¸€Àì(€€€ô¤ì((€É•ÑÕÉ¸€ (€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µ…àµÜ´Éá°ÍÁ…”µä´Ğˆø(€€€€€€ñI•…Ğ¹MÕÍÁ•¹Í”™…±±‰…¬õìñ•™•ÉÉ•‘‘µ¥¹A…¹•±…±±‰…¬±…‰•°ô‹²²n@ƒªÒ®š°ƒ®>ªÖ°ˆ¼ùôø(€€€€€€€€ñA•¹‘¥¹ÁÁÉ½Ù…±Ì€¼ø(€€€€€€€€ñAÉ½™¥±•‘¥ÑI•ÅÕ•ÍÑÌ€¼ø(€€€€€€€€ñA…ÍÍİ½É‘I•Í•Ñ‘µ¥¸…ÕÑ¡UÍ•É%õí…ÕÑ¡UÍ•É%‘ô¼ø(€€€€€€ğ½I•…Ğ¹MÕÍÁ•¹Í”ø(€€€€€€ñM•Ñ¥½¸Ñ¥Ñ±”ô‹®“²z”ƒªÒ®š°ˆÍÕˆõí€‘íÍÑ½É•Ì¹±•¹Ñ¡÷ªÂpƒ®“²z•ô‘•™…Õ±Ñ=Á•¸ø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰À´Ì™±•à…À´Èˆø(€€€€€€€€€€ñ¥¹ÁÕĞÁ±…•¡½±‘•Èô‹² ƒ®“²z—®ª€£²b èƒ®>g®ª®“²z—®ª¤ˆÙ…±Õ”õí¹•İMÑ½É•ô½¹¡…¹”õì¡”¤€ôøÍ•Ñ9•İMÑ½É”¡”¹Ñ…É•Ğ¹Ù…±Õ”¥ô±…ÍÍ9…µ”ô‰™±•à´Ä‰½É‘•È‰½É‘•ÈµÉ…ä´ÈÀÀÉ½Õ¹‘•µ±œÁà´È¸ÔÁä´Ä¸ÔÑ•áĞµÍ´ˆ€¼ø(€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôøì…‘‘MÑ½É”¡¹•İMÑ½É”¤ìÍ•Ñ9•İMÑ½É” œœ¤ìõô±…ÍÍ9…µ”ô‰Áà´ÌÁä´Ä¸ÔÉ½Õ¹‘•µ±œ‰œµÙ¥½±•Ğ´ØÀÀ¡½Ù•Èé‰œµÙ¥½±•Ğ´ÜÀÀÑ•áĞµİ¡¥Ñ”Ñ•áĞµÍ´™½¹ĞµÍ•µ¥‰½±İ¡¥Ñ•ÍÁ…”µ¹½İÉ…Àˆû®“²z”ƒ²ÚSªÂ ğ½‰ÕÑÑ½¸ø(€€€€€€€€ğ½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Áà´ÌÁˆ´Ì™±•à™±•àµİÉ…À…À´Ä¸Ôˆø(€€€€€€€€€íÍÑ½É•Ì¹µ…À ¡Ì¤€ôø€ (€€€€€€€€€€€€ñÍÁ…¸­•äõíÍô±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È…À´Ä‰œµÉ…ä´ÄÀÀÑ•áĞµÉ…ä´ÜÀÀÑ•áĞµáÌÁà´ÈÁä´ÄÉ½Õ¹‘•µ™Õ±°ˆø(€€€€€€€€€€€€€íÍô(€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õí…Íå¹Œ ¤€ôøì¥˜¡…İ…¥ĞÍ¡½İÁÁ½¹™¥É´¡íÑ¥Ñ±”é€‘íÍôƒ®“²z—²vƒ²
·²‚s¶Vƒªæ3²jPı€±µ•ÍÍ…”èŸªâÃ²†Ğƒ²²n@ƒ².“²‚²v ƒ²rƒ²®Bc²®0ƒ² ƒ²²n@ƒ®NÇ®†w
ß¶j3²nCªÂ²z²v`ƒ®“²z”ƒ®ª§®†w²^C²s®*Pƒ²
³®vó²G®.#®.¸œ±½¹™¥Éµ1…‰•°èŸ®“²z”ƒ²
·²‚pœ±Ñ½¹”è‘…¹•Èô¤¤É•µ½Ù•MÑ½É”¡Ì¤ìõô±…ÍÍ9…µ”ô‰Ñ•áĞµÉ…ä´ĞÀÀ¡½Ù•ÈéÑ•áĞµÉ•´ÔÀÀˆû\ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€ğ½ÍÁ…¸ø(€€€€€€€€€€¤¥ô(€€€€€€€€ğ½‘¥Øø(€€€€€€ğ½M•Ñ¥½¸ø((€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµİ¡¥Ñ”É½Õ¹‘•µá°‰½É‘•È‰½É‘•ÈµÉ…ä´ÄÀÀÀ´ĞÉ¥É¥µ½±Ì´È…À´Èˆø(€€€€€€€€ñ¥¹ÁÕĞÁ±…•¡½±‘•Èô‹²vÓ®šˆÙ…±Õ”õí™½É´¹¹…µ•ô½¹¡…¹”õì¡”¤€ôøÍ•Ñ½É´¡ì€¸¸¹™½É´°¹…µ”è”¹Ñ…É•Ğ¹Ù…±Õ”ô¥ô±…ÍÍ9…µ”ô‰‰½É‘•È‰½É‘•ÈµÉ…ä´ÈÀÀÉ½Õ¹‘•µ±œÁà´È¸ÔÁä´Ä¸ÔÑ•áĞµÍ´ˆ€¼ø(€€€€€€€€ñÍ•±•ĞÙ…±Õ”õí™½É´¹‰É…¹¡ô½¹¡…¹”õì¡”¤€ôøÍ•Ñ½É´¡ì€¸¸¹™½É´°‰É…¹ è”¹Ñ…É•Ğ¹Ù…±Õ”ô¥ô±…ÍÍ9…µ”ô‰‰½É‘•È‰½É‘•ÈµÉ…ä´ÈÀÀÉ½Õ¹‘•µ±œÁà´È¸ÔÁä´Ä¸ÔÑ•áĞµÍ´ˆø(€€€€€€€€€íÍÑ½É•Ì¹µ…À ¡Ì¤€ôø€ñ½ÁÑ¥½¸­•äõíÍôÙ…±Õ”õíÍôùíÍôğ½½ÁÑ¥½¸ø¥ô(€€€€€€€€ğ½Í•±•Ğø(€€€€€€€€ñÍ•±•ĞÙ…±Õ”õí™½É´¹Á½Í¥Ñ¥½¹ô½¹¡…¹”õì¡”¤€ôøÍ•Ñ½É´¡ì€¸¸¹™½É´°Á½Í¥Ñ¥½¸è”¹Ñ…É•Ğ¹Ù…±Õ”ô¥ô±…ÍÍ9…µ”ô‰‰½É‘•È‰½É‘•ÈµÉ…ä´ÈÀÀÉ½Õ¹‘•µ±œÁà´È¸ÔÁä´Ä¸ÔÑ•áĞµÍ´ˆø(€€€€€€€€€íA=M%Q%=9L¹µ…À ¡À¤€ôø€ñ½ÁÑ¥½¸­•äõíÁôÙ…±Õ”õíÁôùíÁôğ½½ÁÑ¥½¸ø¥ô(€€€€€€€€ğ½Í•±•Ğø(€€€€€€€€ñ¥¹ÁÕĞÑåÁ”ô‰µ½¹Ñ ˆÙ…±Õ”õí™½É´¹¡¥É•…Ñ•ô½¹¡…¹”õì¡”¤€ôøÍ•Ñ½É´¡ì€¸¸¹™½É´°¡¥É•…Ñ”è”¹Ñ…É•Ğ¹Ù…±Õ”ô¥ô±…ÍÍ9…µ”ô‰‰½É‘•È‰½É‘•ÈµÉ…ä´ÈÀÀÉ½Õ¹‘•µ±œÁà´È¸ÔÁä´Ä¸ÔÑ•áĞµÍ´ˆ€¼ø(€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õíÍÕ‰µ¥Ñô±…ÍÍ9…µ”ô‰½°µÍÁ…¸´È™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ•¹Ñ•È…À´ÄÁà´ÌÁä´Ä¸ÔÉ½Õ¹‘•µ±œ‰œµÙ¥½±•Ğ´ØÀÀ¡½Ù•Èé‰œµÙ¥½±•Ğ´ÜÀÀÑ•áĞµİ¡¥Ñ”Ñ•áĞµÍ´™½¹ĞµÍ•µ¥‰½±ˆøñUÍ•ÉA±ÕÌÍ¥é”õìÄÑô€¼øƒ²²n@ƒ²ÚSªÂ ğ½‰ÕÑÑ½¸ø(€€€€€€ğ½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È…À´È™±•àµİÉ…Àˆø(€€€€€€€€ñ¥¹ÁÕĞÁ±…•¡½±‘•Èô‹²vÓ®šƒªÊ²$ˆÙ…±Õ”õí¹…µ•EÕ•Éåô½¹¡…¹”õì¡”¤€ôøÍ•Ñ9…µ•EÕ•Éä¡”¹Ñ…É•Ğ¹Ù…±Õ”¥ô±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´‰½É‘•È‰½É‘•ÈµÉ…ä´ÈÀÀÉ½Õ¹‘•µ±œÁà´È¸ÔÁä´Ä¸Ô‰œµİ¡¥Ñ”Ü´Èàˆ€¼ø(€€€€€€€€ñÍ•±•ĞÙ…±Õ”õí™¥±Ñ•É	É…¹¡ô½¹¡…¹”õì¡”¤€ôøÍ•Ñ¥±Ñ•É	É…¹ ¡”¹Ñ…É•Ğ¹Ù…±Õ”¥ô±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´‰½É‘•È‰½É‘•ÈµÉ…ä´ÈÀÀÉ½Õ¹‘•µ±œÁà´È¸ÔÁä´Ä¸Ô‰œµİ¡¥Ñ”ˆø(€€€€€€€€€€ñ½ÁÑ¥½¸Ù…±Õ”ô‹²‚²ÊĞˆû²‚²ÊĞƒ®“²z”ğ½½ÁÑ¥½¸ø(€€€€€€€€€íÍÑ½É•Ì¹µ…À ¡Ì¤€ôø€ñ½ÁÑ¥½¸­•äõíÍôÙ…±Õ”õíÍôùíÍôğ½½ÁÑ¥½¸ø¥ô(€€€€€€€€ğ½Í•±•Ğø(€€€€€€€€ñÍ•±•ĞÙ…±Õ”õíÍ½ÉÑ	åô½¹¡…¹”õì¡”¤€ôøÍ•ÑM½ÉÑ	ä¡”¹Ñ…É•Ğ¹Ù…±Õ”¥ô±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´‰½É‘•È‰½É‘•ÈµÉ…ä´ÈÀÀÉ½Õ¹‘•µ±œÁà´È¸ÔÁä´Ä¸Ô‰œµİ¡¥Ñ”ˆø(€€€€€€€€€€ñ½ÁÑ¥½¸Ù…±Õ”ô‰¡¥É••ÍŒˆû²z²
³²nPƒ²Ös².ƒ²"pğ½½ÁÑ¥½¸ø(€€€€€€€€€€ñ½ÁÑ¥½¸Ù…±Õ”ô‰¡¥É•ÍŒˆû²z²
³²nPƒ²b“®zc®Bs²"pğ½½ÁÑ¥½¸ø(€€€€€€€€€€ñ½ÁÑ¥½¸Ù…±Õ”ô‰¹…µ”ˆû²vÓ®š²"pğ½½ÁÑ¥½¸ø(€€€€€€€€€€ñ½ÁÑ¥½¸Ù…±Õ”ô‰‰É…¹ ˆû®“²z—²"pğ½½ÁÑ¥½¸ø(€€€€€€€€ğ½Í•±•Ğø(€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ…ä´ĞÀÀˆùíÙ¥Í¥‰±•µÁ±½å••Ì¹±•¹Ñ¡÷®ªğ½ÍÁ…¸ø(€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùÉ•™É•Í¡µÁ±½å••½…±Ìü¸ ¥ô‘¥Í…‰±•õí•µÁ±½å••½…±Í1½…‘¥¹ô±…ÍÍ9…µ”ô‰µ°µ…ÕÑ¼Ñ•áĞµáÌ™½¹Ğµµ•‘¥Õ´Ñ•áĞµÙ¥½±•Ğ´ØÀÀ‘¥Í…‰±•éÑ•áĞµÉ…ä´ÌÀÀˆø(€€€€€€€€€í•µÁ±½å••½…±Í1½…‘¥¹œ€ü€Ÿ®ª§¶Fpƒ¶fW²vàƒ²’Dœ€è€Ÿ®ª§¶Fpƒ²#®†sªÎƒ²æ ô(€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€ğ½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµİ¡¥Ñ”É½Õ¹‘•µá°‰½É‘•È‰½É‘•ÈµÉ…ä´ÄÀÀ‘¥Ù¥‘”µä‘¥Ù¥‘”µÉ…ä´ÔÀˆø(€€€€€€€íÙ¥Í¥‰±•µÁ±½å••Ì¹µ…À ¡”¤€ôø€ (€€€€€€€€€€ñ‘¥Ø­•äõí”¹¥‘ô±…ÍÍ9…µ”ô‰Áà´ĞÁä´Ìˆø(€€€€€€€€€€€í•‘¥Ñ¥¹%€ôôô”¹¥€ü€ (€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É¥É¥µ½±Ì´È…À´Èˆø(€€€€€€€€€€€€€€€€ñ¥¹ÁÕĞÙ…±Õ”õí•‘¥Ñ½É´¹¹…µ•ô½¹¡…¹”õì¡•Ø¤€ôøÍ•Ñ‘¥Ñ½É´¡ì€¸¸¹•‘¥Ñ½É´°¹…µ”è•Ø¹Ñ…É•Ğ¹Ù…±Õ”ô¥ô±…ÍÍ9…µ”ô‰‰½É‘•È‰½É‘•ÈµÉ…ä´ÈÀÀÉ½Õ¹‘•µ±œÁà´ÈÁä´ÄÑ•áĞµÍ´ˆ€¼ø(€€€€€€€€€€€€€€€€ñÍ•±•ĞÙ…±Õ”õí•‘¥Ñ½É´¹‰É…¹¡ô½¹¡…¹”õì¡•Ø¤€ôøÍ•Ñ‘¥Ñ½É´¡ì€¸¸¹•‘¥Ñ½É´°‰É…¹ è•Ø¹Ñ…É•Ğ¹Ù…±Õ”ô¥ô±…ÍÍ9…µ”ô‰‰½É‘•È‰½É‘•ÈµÉ…ä´ÈÀÀÉ½Õ¹‘•µ±œÁà´ÈÁä´ÄÑ•áĞµÍ´ˆø(€€€€€€€€€€€€€€€€€íÍÑ½É•Ì¹µ…À ¡Ì¤€ôø€ñ½ÁÑ¥½¸­•äõíÍôÙ…±Õ”õíÍôùíÍôğ½½ÁÑ¥½¸ø¥ô(€€€€€€€€€€€€€€€€ğ½Í•±•Ğø(€€€€€€€€€€€€€€€€ñÍ•±•ĞÙ…±Õ”õí•‘¥Ñ½É´¹Á½Í¥Ñ¥½¹ô½¹¡…¹”õì¡•Ø¤€ôøÍ•Ñ‘¥Ñ½É´¡ì€¸¸¹•‘¥Ñ½É´°Á½Í¥Ñ¥½¸è•Ø¹Ñ…É•Ğ¹Ù…±Õ”ô¥ô±…ÍÍ9…µ”ô‰‰½É‘•È‰½É‘•ÈµÉ…ä´ÈÀÀÉ½Õ¹‘•µ±œÁà´ÈÁä´ÄÑ•áĞµÍ´ˆø(€€€€€€€€€€€€€€€€€íA=M%Q%=9L¹µ…À ¡À¤€ôø€ñ½ÁÑ¥½¸­•äõíÁôÙ…±Õ”õíÁôùíÁôğ½½ÁÑ¥½¸ø¥ô(€€€€€€€€€€€€€€€€ğ½Í•±•Ğø(€€€€€€€€€€€€€€€€ñ¥¹ÁÕĞÑåÁ”ô‰µ½¹Ñ ˆÙ…±Õ”õí•‘¥Ñ½É´¹¡¥É•…Ñ•ô½¹¡…¹”õì¡•Ø¤€ôøÍ•Ñ‘¥Ñ½É´¡ì€¸¸¹•‘¥Ñ½É´°¡¥É•…Ñ”è•Ø¹Ñ…É•Ğ¹Ù…±Õ”ô¥ô±…ÍÍ9…µ”ô‰‰½É‘•È‰½É‘•ÈµÉ…ä´ÈÀÀÉ½Õ¹‘•µ±œÁà´ÈÁä´ÄÑ•áĞµÍ´ˆ€¼ø(€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õíÍ…Ù•‘¥Ñô±…ÍÍ9…µ”ô‰Ñ•áĞµáÌ™½¹Ğµµ•‘¥Õ´Áà´È¸ÔÁä´ÄÉ½Õ¹‘•µµ‰œµÙ¥½±•Ğ´ØÀÀÑ•áĞµİ¡¥Ñ”ˆû²‚²z”ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôøÍ•Ñ‘¥Ñ¥¹%¡¹Õ±°¥ô±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ…ä´ĞÀÀˆû²Ş£²0ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€¤€è€ (€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµÍÑ…ÉĞ©ÕÍÑ¥™äµ‰•Ñİ••¸…À´Ìˆø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µ¥¸µÜ´À™±•à´Äˆø(€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´™½¹Ğµµ•‘¥Õ´Ñ•áĞµÉ…ä´àÀÀˆø(€€€€€€€€€€€€€€€€€€€í”¹¹…µ•ôƒ
Üí”¹Á½Í¥Ñ¥½¹ô(€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÅÁátÑ•áĞµÉ…ä´ÔÀÀµĞ´À¸Ô‰É•…¬µİ½É‘Ìˆø(€€€€€€€€€€€€€€€€€€€í‘¥ÍÁ±…åMÑ½É•9…µ”¡”¹‰É…¹ ¥ô(€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÅÁátÑ•áĞµÉ…ä´ĞÀÀµĞ´À¸Ôˆø(€€€€€€€€€€€€€€€€€€€í”¹¡¥É•…Ñ”€üƒ²z²
°€‘í”¹¡¥É•…Ñ•õ€€è€Ÿ²z²
³²vğƒ®¾ã®NÇ®†tô(€€€€€€€€€€€€€€€€€€€í€ƒ
Üƒ²Ös²Šƒ²‚G²4€‘í™½Éµ…Ñ1…ÍÑM¥¹%¸¡”¹±…ÍÑM¥¹%¹Ğ¥õô(€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€ñµÁ±½å••½…±MÕµµ…Éäµ½¹Ñ õíµ½¹Ñ¡ô•¹ÑÉäõí•µÁ±½å••½…±5…Ám”¹¥‘uô€¼ø(€€€€€€€€€€€€€€€€ğ½‘¥Øø((€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È…À´Ä¸ÔÍ¡É¥¹¬´Àİ¡¥Ñ•ÍÁ…”µ¹½İÉ…Àˆø(€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€€€€€½¹±¥¬õì ¤€ôøÍÑ…ÉÑ‘¥Ğ¡”¥ô(€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰Í¡É¥¹¬´Àµ¥¸µÜµlĞÙÁátİ¡¥Ñ•ÍÁ…”µ¹½İÉ…ÀÑ•áĞµáÌ™½¹Ğµµ•‘¥Õ´Áà´È¸ÔÁä´Ä¸ÔÉ½Õ¹‘•µµ‰œµÉ…ä´ÄÀÀÑ•áĞµÉ…ä´ØÀÀˆ(€€€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€€ƒ²"c²‚T(€€€€€€€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€€€€€½¹±¥¬õí…Íå¹Œ ¤€ôøì(€€€€€€€€€€€€€€€€€€€€€¥˜¡…İ…¥ĞÍ¡½İÁÁ½¹™¥É´¡íÑ¥Ñ±”é€‘í”¹¹…µ•÷®.c²vƒ®æ¶fs²Ç¶fS¶Vƒªæ3²jPı€±µ•ÍÍ…”èŸ®†sªŞã²vã
ß²²n@ƒ®ª§®†w²^C²s®*Pƒ®æƒ²²®0ƒªâÃ²†Ğƒ².“²‚ƒªâÃ®†w²v ƒ²rƒ²®Bc®¦Àƒ®
c²’G²^@ƒ®.“².pƒ¶fs²Ç¶fS¶V€ƒ²"`ƒ²z#²*×®.#®.¸œ±½¹™¥Éµ1…‰•°èŸ®æ¶fs²Ç¶fPœ±Ñ½¹”è‘…¹•Èô¤¤É•µ½Ù•µÁ±½å•”¡”¹¥¤ì(€€€€€€€€€€€€€€€€€€€õô(€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰Í¡É¥¹¬´ÀÜ´à ´àÉ½Õ¹‘•µµ‰œµÉ•´ÔÀÑ•áĞµÉ•´ÔÀÀ™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ•¹Ñ•Èˆ(€€€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€€€ñQÉ…Í ÈÍ¥é”õìÄÍô€¼ø(€€€€€€€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€¥ô(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€¤¥ô(€€€€€€€íÙ¥Í¥‰±•µÁ±½å••Ì¹±•¹Ñ €ôôô€À€˜˜€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ…ä´ĞÀÀÁà´ĞÁä´ØÑ•áĞµ•¹Ñ•Èˆû¶VÓ®.äƒ®“²z—²^@ƒ®NÇ®†w®Bpƒ²²nC²vĞƒ²^²*×®.#®.¸ğ½‘¥Øùô(€€€€€€ğ½‘¥Øø((€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õíÑ½±•M¡½İ%¹…Ñ¥Ù•ô±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ…ä´ĞÀÀÕ¹‘•É±¥¹”ˆø(€€€€€€€íÍ¡½İ%¹…Ñ¥Ù”€ü€Ÿ®æ¶fs²Äƒ²²n@ƒ²"£ªâÃªâÀœ€è€Ÿ®æ¶fs²Ç¶fS®Bpƒ²²n@ƒ®ÎÓªâÀô(€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€íÍ¡½İ%¹…Ñ¥Ù”€˜˜€ (€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµİ¡¥Ñ”É½Õ¹‘•µá°‰½É‘•È‰½É‘•ÈµÉ…ä´ÄÀÀ‘¥Ù¥‘”µä‘¥Ù¥‘”µÉ…ä´ÔÀˆø(€€€€€€€€€í¥¹…Ñ¥Ù•1½…‘¥¹œ€ü€ (€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ…ä´ĞÀÀÁà´ĞÁä´ØÑ•áĞµ•¹Ñ•Èˆû®Ú#®~³²b“®*Pƒ²’D¸¸¸ğ½‘¥Øø(€€€€€€€€€€¤€è¥¹…Ñ¥Ù•1¥ÍĞ¹±•¹Ñ €ôôô€À€ü€ (€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ…ä´ĞÀÀÁà´ĞÁä´ØÑ•áĞµ•¹Ñ•Èˆû®æ¶fs²Ç¶fS®Bpƒ²²nC²vĞƒ²^²ZÓ²jP¸ğ½‘¥Øø(€€€€€€€€€€¤€è€ (€€€€€€€€€€€¥¹…Ñ¥Ù•1¥ÍĞ¹µ…À ¡À¤€ôø€ (€€€€€€€€€€€€€€ñ‘¥Ø­•äõíÀ¹¥‘ô±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•Ñİ••¸Áà´ĞÁä´Ìˆø(€€€€€€€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´™½¹Ğµµ•‘¥Õ´Ñ•áĞµÉ…ä´ÔÀÀˆùíÀ¹¹…µ•ôƒ
ÜíÀ¹Á½Í¥Ñ¥½¹ôğ½‘¥Øø(€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÅÁátÑ•áĞµÉ…ä´ĞÀÀˆùíÀ¹ÍÑ½É•}¹…µ•ôğ½‘¥Øø(€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôøÉ•…Ñ¥Ù…Ñ”¡À¹¥¥ô±…ÍÍ9…µ”ô‰Ñ•áĞµáÌ™½¹Ğµµ•‘¥Õ´Áà´È¸ÔÁä´Ä¸ÔÉ½Õ¹‘•µµ‰œµÙ¥½±•Ğ´ØÀÀÑ•áĞµİ¡¥Ñ”ˆû®.“².pƒ¶fs²Ç¶fPğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€¤¤(€€€€€€€€€€¥ô(€€€€€€€€ğ½‘¥Øø(€€€€€€¥ô(€€€€ğ½‘¥Øø(€€¤ì)ô()™Õ¹Ñ¥½¸5½‰¥±•A½¥¹Ñ%Ñ•µÍ‘¥Ñ½È¡ì¥Ñ•µÌ°½¹¡…¹”ô¤ì(€½¹ÍĞm¹•İ1…‰•°°Í•Ñ9•İ1…‰•±t€ôÕÍ•MÑ…Ñ” œœ¤ì(€½¹ÍĞm¹•İA½¥¹Ğ°Í•Ñ9•İA½¥¹Ñt€ôÕÍ•MÑ…Ñ” œœ¤ì(€½¹ÍĞm¹•İ½Õ¹ÑÍQ•¹ÕÉ”°Í•Ñ9•İ½Õ¹ÑÍQ•¹ÕÉ•t€ôÕÍ•MÑ…Ñ”¡ÑÉÕ”¤ì((€½¹ÍĞÕÁ‘…Ñ•%Ñ•´€ô€¡¥‘à°Á…Ñ ¤€ôø½¹¡…¹”¡¥Ñ•µÌ¹µ…À ¡¥Ğ°¤¤€ôø€¡¤€ôôô¥‘à€üì€¸¸¹¥Ğ°€¸¸¹Á…Ñ ô€è¥Ğ¤¤¤ì(€½¹ÍĞÉ•µ½Ù•%Ñ•´€ô€¡¥‘à¤€ôø½¹¡…¹”¡¥Ñ•µÌ¹™¥±Ñ•È ¡|°¤¤€ôø¤€„ôô¥‘à¤¤ì(€½¹ÍĞ…‘‘%Ñ•´€ô€ ¤€ôøì(€€€¥˜€ …¹•İ1…‰•°¹ÑÉ¥´ ¤¤É•ÑÕÉ¸ì(€€€½¹ÍĞ­•ä€ôÕÍÑ½µ|‘í…Ñ”¹¹½Ü ¥õ€ì(€€€½¹¡…¹”¡l¸¸¹¥Ñ•µÌ°ì­•ä°±…‰•°è¹•İ1…‰•°¹ÑÉ¥´ ¤°Á½¥¹ĞèÁ…ÉÍ•±½…Ğ¡¹•İA½¥¹Ğñğ€œÀœ¤°½Õ¹ÑÍQ•¹ÕÉ”è¹•İ½Õ¹ÑÍQ•¹ÕÉ”õt¤ì(€€€Í•Ñ9•İ1…‰•° œœ¤ìÍ•Ñ9•İA½¥¹Ğ œœ¤ìÍ•Ñ9•İ½Õ¹ÑÍQ•¹ÕÉ”¡ÑÉÕ”¤ì(€ôì((€É•ÑÕÉ¸€ (€€€€ñM•Ñ¥½¸Ñ¥Ñ±”ô‹®ª£®ÂS²vğƒ².“²‚ƒ¶V·®ª¤ƒªÒ®š°ˆÍÕˆõí€‘í¥Ñ•µÌ¹±•¹Ñ¡÷ªÂpƒ¶V·®ª¥ô‘•™…Õ±Ñ=Á•¸ø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Áà´ĞÁĞ´ÌÁˆ´ÄÑ•áĞµlÄÅÁátÑ•áĞµÉ…ä´ĞÀÀˆû¶V·®ª§²vƒ²²‚Dƒ²ÚSªÂ
ß²
·²‚s
ß²"c²‚W¶V€ƒ²"`ƒ²z#²ZÓ²jP¸€‹ªŞó²7²"c®.äƒªÆÓ²"`ƒ¶>³¶V ‹²vƒ²ÊÓ¶³¶Vc®¦Ğƒ²vĞƒ¶V·®ª§²vĞƒªŞó²7ªâÃªÂ®ÎƒªÆÓ®.äƒ²ªâ'²V„ƒªÎ²
Ã²^C®>ƒ®Âc²b®>ó²jP¸ğ½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‘¥Ù¥‘”µä‘¥Ù¥‘”µÉ…ä´ÔÀˆø(€€€€€€€í¥Ñ•µÌ¹µ…À ¡¥Ğ°¥‘à¤€ôø€ (€€€€€€€€€€ñ‘¥Ø­•äõí¥Ğ¹­•åô±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È…À´ÈÁà´ĞÁä´È¸Ô™±•àµİÉ…Àˆø(€€€€€€€€€€€€ñ¥¹ÁÕĞÙ…±Õ”õí¥Ğ¹±…‰•±ô½¹¡…¹”õì¡”¤€ôøÕÁ‘…Ñ•%Ñ•´¡¥‘à°ì±…‰•°è”¹Ñ…É•Ğ¹Ù…±Õ”ô¥ô±…ÍÍ9…µ”ô‰™±•à´Äµ¥¸µÜµlÄĞÁÁát‰½É‘•È‰½É‘•ÈµÉ…ä´ÈÀÀÉ½Õ¹‘•µ±œÁà´ÈÁä´ÄÑ•áĞµÍ´ˆ€¼ø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È…À´Äˆø(€€€€€€€€€€€€€€ñ¥¹ÁÕĞÑåÁ”ô‰¹Õµ‰•ÈˆÍÑ•ÀôˆÀ¸ÄˆÙ…±Õ”õí¥Ğ¹Á½¥¹Ñô½¹¡…¹”õì¡”¤€ôøÕÁ‘…Ñ•%Ñ•´¡¥‘à°ìÁ½¥¹ĞèÁ…ÉÍ•±½…Ğ¡”¹Ñ…É•Ğ¹Ù…±Õ”ñğ€œÀœ¤ô¥ô±…ÍÍ9…µ”ô‰Ü´ÄØÑ•áĞµÉ¥¡Ğ‰½É‘•È‰½É‘•ÈµÉ…ä´ÈÀÀÉ½Õ¹‘•µ±œÁà´Ä¸ÔÁä´ÄÑ•áĞµÍ´ˆ€¼ø(€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ…ä´ĞÀÀˆù@ğ½ÍÁ…¸ø(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€ñ±…‰•°±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È…À´ÄÑ•áĞµáÌÑ•áĞµÉ…ä´ÔÀÀˆø(€€€€€€€€€€€€€€ñ¥¹ÁÕĞÑåÁ”ô‰¡•­‰½àˆ¡•­•õí¥Ğ¹½Õ¹ÑÍQ•¹ÕÉ”€„ôô™…±Í•ô½¹¡…¹”õì¡”¤€ôøÕÁ‘…Ñ•%Ñ•´¡¥‘à°ì½Õ¹ÑÍQ•¹ÕÉ”è”¹Ñ…É•Ğ¹¡•­•ô¥ô±…ÍÍ9…µ”ô‰Ü´Ì¸Ô ´Ì¸Ôˆ€¼ø(€€€€€€€€€€€€€ƒªŞó²7²"c®.äƒªÆÓ²"`ƒ¶>³¶V (€€€€€€€€€€€€ğ½±…‰•°ø(€€€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôøÉ•µ½Ù•%Ñ•´¡¥‘à¥ô±…ÍÍ9…µ”ô‰Ü´Ü ´ÜÉ½Õ¹‘•µµ‰œµÉ•´ÔÀÑ•áĞµÉ•´ÔÀÀ™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ•¹Ñ•ÈˆøñQÉ…Í ÈÍ¥é”õìÄÍô€¼øğ½‰ÕÑÑ½¸ø(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€¤¥ô(€€€€€€ğ½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È…À´È™±•àµİÉ…ÀÁà´ĞÁä´Ì‰œµÉ…ä´ÔÀˆø(€€€€€€€€ñ¥¹ÁÕĞÁ±…•¡½±‘•Èô‹² ƒ¶V·®ª§®ª€£²b èƒªâÃ®Î £².ƒªŞs²‚W²Æ¤¤ˆÙ…±Õ”õí¹•İ1…‰•±ô½¹¡…¹”õì¡”¤€ôøÍ•Ñ9•İ1…‰•°¡”¹Ñ…É•Ğ¹Ù…±Õ”¥ô±…ÍÍ9…µ”ô‰™±•à´Äµ¥¸µÜµlÄĞÁÁát‰½É‘•È‰½É‘•ÈµÉ…ä´ÈÀÀÉ½Õ¹‘•µ±œÁà´ÈÁä´Ä¸ÔÑ•áĞµÍ´ˆ€¼ø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È…À´Äˆø(€€€€€€€€€€ñ¥¹ÁÕĞÑåÁ”ô‰¹Õµ‰•ÈˆÍÑ•ÀôˆÀ¸ÄˆÁ±…•¡½±‘•Èô‹¶>³²vã¶*àˆÙ…±Õ”õí¹•İA½¥¹Ñô½¹¡…¹”õì¡”¤€ôøÍ•Ñ9•İA½¥¹Ğ¡”¹Ñ…É•Ğ¹Ù…±Õ”¥ô±…ÍÍ9…µ”ô‰Ü´ÈÀÑ•áĞµÉ¥¡Ğ‰½É‘•È‰½É‘•ÈµÉ…ä´ÈÀÀÉ½Õ¹‘•µ±œÁà´Ä¸ÔÁä´Ä¸ÔÑ•áĞµÍ´ˆ€¼ø(€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ…ä´ĞÀÀˆù@ğ½ÍÁ…¸ø(€€€€€€€€ğ½‘¥Øø(€€€€€€€€ñ±…‰•°±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È…À´ÄÑ•áĞµáÌÑ•áĞµÉ…ä´ÔÀÀˆø(€€€€€€€€€€ñ¥¹ÁÕĞÑåÁ”ô‰¡•­‰½àˆ¡•­•õí¹•İ½Õ¹ÑÍQ•¹ÕÉ•ô½¹¡…¹”õì¡”¤€ôøÍ•Ñ9•İ½Õ¹ÑÍQ•¹ÕÉ”¡”¹Ñ…É•Ğ¹¡•­•¥ô±…ÍÍ9…µ”ô‰Ü´Ì¸Ô ´Ì¸Ôˆ€¼ø(€€€€€€€€€ƒªŞó²7²"c®.äƒ¶>³¶V (€€€€€€€€ğ½±…‰•°ø(€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õí…‘‘%Ñ•µô±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È…À´ÄÁà´ÌÁä´Ä¸ÔÉ½Õ¹‘•µ±œ‰œµÙ¥½±•Ğ´ØÀÀ¡½Ù•Èé‰œµÙ¥½±•Ğ´ÜÀÀÑ•áĞµİ¡¥Ñ”Ñ•áĞµÍ´™½¹ĞµÍ•µ¥‰½±ˆøñA±ÕÌÍ¥é”õìÄÑô€¼øƒ¶V·®ª¤ƒ²ÚSªÂ ğ½‰ÕÑÑ½¸ø(€€€€€€ğ½‘¥Øø(€€€€ğ½M•Ñ¥½¸ø(€€¤ì)ô()™Õ¹Ñ¥½¸-Á¥%Ñ•µÍ‘¥Ñ½È¡ì¥Ñ•µÌ°½¹¡…¹”ô¤ì(€½¹ÍĞm¹•İ1…‰•°°Í•Ñ9•İ1…‰•±t€ôÕÍ•MÑ…Ñ” œœ¤ì(€½¹ÍĞm¹•İA½¥¹Ğ°Í•Ñ9•İA½¥¹Ñt€ôÕÍ•MÑ…Ñ” œœ¤ì((€½¹ÍĞÕÁ‘…Ñ•%Ñ•´€ô€¡¥‘à°Á…Ñ ¤€ôø½¹¡…¹”¡¥Ñ•µÌ¹µ…À ¡¥Ğ°¤¤€ôø€¡¤€ôôô¥‘à€üì€¸¸¹¥Ğ°€¸¸¹Á…Ñ ô€è¥Ğ¤¤¤ì(€½¹ÍĞÉ•µ½Ù•%Ñ•´€ô€¡¥‘à¤€ôø½¹¡…¹”¡¥Ñ•µÌ¹™¥±Ñ•È ¡|°¤¤€ôø¤€„ôô¥‘à¤¤ì(€½¹ÍĞ…‘‘%Ñ•´€ô€ ¤€ôøì(€€€¥˜€ …¹•İ1…‰•°¹ÑÉ¥´ ¤¤É•ÑÕÉ¸ì(€€€½¹ÍĞ­•ä€ô­Á¥}ÕÍÑ½µ|‘í…Ñ”¹¹½Ü ¥õ€ì(€€€½¹¡…¹”¡l¸¸¹¥Ñ•µÌ°ì­•ä°±…‰•°è¹•İ1…‰•°¹ÑÉ¥´ ¤°Á½¥¹ĞèÁ…ÉÍ•±½…Ğ¡¹•İA½¥¹Ğñğ€œÀœ¤õt¤ì(€€€Í•Ñ9•İ1…‰•° œœ¤ìÍ•Ñ9•İA½¥¹Ğ œœ¤ì(€ôì((€É•ÑÕÉ¸€ (€€€€ñM•Ñ¥½¸Ñ¥Ñ±”ô‹ªÂs²vàƒ²w²
Ã²Äƒ¶V·®ª¤ƒªÒ®š°ˆÍÕˆõí€‘í¥Ñ•µÌ¹±•¹Ñ¡÷ªÂpƒ¶V·®ª¥ôø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Áà´ĞÁĞ´ÌÁˆ´ÄÑ•áĞµlÄÅÁátÑ•áĞµÉ…ä´ĞÀÀˆû²vã²ó¶.Ã®â0ƒªâ#²V‡²^C®*Pƒ®Âc²b®Bc² ƒ²V+®*Pƒ²ÂãªÎƒ²j¤ƒ²w²
Ã²Äƒ²‚C²"c²b#²jP¸ƒ¶V·®ª§²vƒ²²‚Dƒ²ÚSªÂ
ß²
·²‚s
ß²"c²‚W¶V€ƒ²"`ƒ²z#²ZÓ²jP¸ğ½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‘¥Ù¥‘”µä‘¥Ù¥‘”µÉ…ä´ÔÀˆø(€€€€€€€í¥Ñ•µÌ¹µ…À ¡¥Ğ°¥‘à¤€ôø€ (€€€€€€€€€€ñ‘¥Ø­•äõí¥Ğ¹­•åô±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È…À´ÈÁà´ĞÁä´È¸Ô™±•àµİÉ…Àˆø(€€€€€€€€€€€€ñ¥¹ÁÕĞÙ…±Õ”õí¥Ğ¹±…‰•±ô½¹¡…¹”õì¡”¤€ôøÕÁ‘…Ñ•%Ñ•´¡¥‘à°ì±…‰•°è”¹Ñ…É•Ğ¹Ù…±Õ”ô¥ô±…ÍÍ9…µ”ô‰™±•à´Äµ¥¸µÜµlÄĞÁÁát‰½É‘•È‰½É‘•ÈµÉ…ä´ÈÀÀÉ½Õ¹‘•µ±œÁà´ÈÁä´ÄÑ•áĞµÍ´ˆ€¼ø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È…À´Äˆø(€€€€€€€€€€€€€€ñ¥¹ÁÕĞÑåÁ”ô‰¹Õµ‰•ÈˆÍÑ•ÀôˆÀ¸ÄˆÙ…±Õ”õí¥Ğ¹Á½¥¹Ñô½¹¡…¹”õì¡”¤€ôøÕÁ‘…Ñ•%Ñ•´¡¥‘à°ìÁ½¥¹ĞèÁ…ÉÍ•±½…Ğ¡”¹Ñ…É•Ğ¹Ù…±Õ”ñğ€œÀœ¤ô¥ô±…ÍÍ9…µ”ô‰Ü´ÄØÑ•áĞµÉ¥¡Ğ‰½É‘•È‰½É‘•ÈµÉ…ä´ÈÀÀÉ½Õ¹‘•µ±œÁà´Ä¸ÔÁä´ÄÑ•áĞµÍ´ˆ€¼ø(€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ…ä´ĞÀÀˆù@ğ½ÍÁ…¸ø(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôøÉ•µ½Ù•%Ñ•´¡¥‘à¥ô±…ÍÍ9…µ”ô‰Ü´Ü ´ÜÉ½Õ¹‘•µµ‰œµÉ•´ÔÀÑ•áĞµÉ•´ÔÀÀ™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ•¹Ñ•ÈˆøñQÉ…Í ÈÍ¥é”õìÄÍô€¼øğ½‰ÕÑÑ½¸ø(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€¤¥ô(€€€€€€ğ½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È…À´È™±•àµİÉ…ÀÁà´ĞÁä´Ì‰œµÉ…ä´ÔÀˆø(€€€€€€€€ñ¥¹ÁÕĞÁ±…•¡½±‘•Èô‹² ƒ¶V·®ª§®ªˆÙ…±Õ”õí¹•İ1…‰•±ô½¹¡…¹”õì¡”¤€ôøÍ•Ñ9•İ1…‰•°¡”¹Ñ…É•Ğ¹Ù…±Õ”¥ô±…ÍÍ9…µ”ô‰™±•à´Äµ¥¸µÜµlÄĞÁÁát‰½É‘•È‰½É‘•ÈµÉ…ä´ÈÀÀÉ½Õ¹‘•µ±œÁà´ÈÁä´Ä¸ÔÑ•áĞµÍ´ˆ€¼ø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È…À´Äˆø(€€€€€€€€€€ñ¥¹ÁÕĞÑåÁ”ô‰¹Õµ‰•ÈˆÍÑ•ÀôˆÀ¸ÄˆÁ±…•¡½±‘•Èô‹¶>³²vã¶*àˆÙ…±Õ”õí¹•İA½¥¹Ñô½¹¡…¹”õì¡”¤€ôøÍ•Ñ9•İA½¥¹Ğ¡”¹Ñ…É•Ğ¹Ù…±Õ”¥ô±…ÍÍ9…µ”ô‰Ü´ÈÀÑ•áĞµÉ¥¡Ğ‰½É‘•È‰½É‘•ÈµÉ…ä´ÈÀÀÉ½Õ¹‘•µ±œÁà´Ä¸ÔÁä´Ä¸ÔÑ•áĞµÍ´ˆ€¼ø(€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ…ä´ĞÀÀˆù@ğ½ÍÁ…¸ø(€€€€€€€€ğ½‘¥Øø(€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õí…‘‘%Ñ•µô±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È…À´ÄÁà´ÌÁä´Ä¸ÔÉ½Õ¹‘•µ±œ‰œµÙ¥½±•Ğ´ØÀÀ¡½Ù•Èé‰œµÙ¥½±•Ğ´ÜÀÀÑ•áĞµİ¡¥Ñ”Ñ•áĞµÍ´™½¹ĞµÍ•µ¥‰½±ˆøñA±ÕÌÍ¥é”õìÄÑô€¼øƒ¶V·®ª¤ƒ²ÚSªÂ ğ½‰ÕÑÑ½¸ø(€€€€€€ğ½‘¥Øø(€€€€ğ½M•Ñ¥½¸ø(€€¤ì)ô()™Õ¹Ñ¥½¸…Ñ•½Éå5…Á‘¥Ñ½È¡ìµ…À°µ½‰¥±•A½¥¹Ñ%Ñ•µÌ°­Á¥%Ñ•µÌ°½¹¡…¹”ô¤ì(€½¹ÍĞÕÁ‘…Ñ”€ô€¡¥‘à°™¥•±°Ù…±Õ”¤€ôøì(€€€½¹ÍĞ¹•áĞ€ôµ…À¹µ…À ¡´°¤¤€ôø€¡¤€ôôô¥‘à€üì€¸¸¹´°m™¥•±‘tèÙ…±Õ”ô€è´¤¤ì(€€€½¹¡…¹”¡¹•áĞ¤ì(€ôì(€É•ÑÕÉ¸€ (€€€€ñM•Ñ¥½¸Ñ¥Ñ±”ô‹ªÂ²zªÖ³®ÚƒŠPƒ²ÇªÎó®NÇªâ%@€¼-A$ƒ®“¶VDˆÍÕˆô‹²vó²vó²z®‚”ƒ²zC®>dƒ²^ÃªÊÀƒªâÃ²’ ˆ‘•™…Õ±Ñ=Á•¸ø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Áà´ĞÁĞ´ÌÁˆ´ÄÑ•áĞµlÄÅÁátÑ•áĞµÉ…ä´ĞÀÀˆû²²nC²vĞƒ²vó²vó²z®‚”ƒ¶·²^C²pƒ²vĞƒªÂ²zªÖ³®Ú²^@ƒªÆÓ²"c®–ğƒ®²ró®¦Ğ°ƒ²V®z`ƒ²²‚W¶Vpƒ²ÇªÎó®NÇªâ%@ƒ¶V·®ª§ªÎğ-A$ƒ¶V·®ª§²^@ƒªŞàƒªÆÓ²"cªÂ ƒ²zC®>g²ró®†pƒ®6S¶VÓ²‚ã²jP¸ƒªâÃ®Î½½®*Pƒ¶ªÊ|ƒ²ªÒ²^²vĞƒ²jSªâ#²‚sªÖÀƒªâÃ²’²ró®†pƒ²ÇªÎó®NÇªâ%CªÂ ƒ®ÂÃ®Ú®Bc®¾®†pƒ²V®z`€‹ªâÃ®Î ƒ²jSªâ#²‚sªÖÃ®Îƒ®“¶VDˆƒ¶Fs®–ğƒ®RÃ®†pƒ²
³²j§¶VÓ²jP¸ğ½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‘¥Ù¥‘”µä‘¥Ù¥‘”µÉ…ä´ÔÀˆø(€€€€€€€í5QI%a}I=]}L¹µ…À ¡É½İ•˜°¥‘à¤€ôø€ (€€€€€€€€€€ñ‘¥Ø­•äõíÉ½İ•˜¹±…‰•±ô±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È…À´ÈÁà´ĞÁä´È¸Ô™±•àµİÉ…Àˆø(€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´Ñ•áĞµÉ…ä´ÜÀÀµ¥¸µÜµlÄÄÁÁátˆùíÉ½İ•˜¹±…‰•±ôğ½ÍÁ…¸ø(€€€€€€€€€€€íÉ½İ•˜¹¥Í¥‰å•½¸€ü€ (€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ…ä´ĞÀÀ™±•à´Äµ¥¸µÜµlÄÌÁÁátˆû²ÇªÎó®NÇªâ%@èƒ²jSªâ#²‚sªÖÃ®Îƒ®“¶VDƒ²
³²j¤ğ½ÍÁ…¸ø(€€€€€€€€€€€€¤€è€ (€€€€€€€€€€€€€€ñÍ•±•ĞÙ…±Õ”õíµ…Ám¥‘átü¹µ½‰¥±•A½¥¹Ñ-•äñğ€œô½¹¡…¹”õì¡”¤€ôøÕÁ‘…Ñ”¡¥‘à°€µ½‰¥±•A½¥¹Ñ-•äœ°”¹Ñ…É•Ğ¹Ù…±Õ”¥ô±…ÍÍ9…µ”ô‰Ñ•áĞµáÌ‰½É‘•È‰½É‘•ÈµÉ…ä´ÈÀÀÉ½Õ¹‘•µ±œÁà´ÈÁä´Ä¸Ô™±•à´Äµ¥¸µÜµlÄÌÁÁátˆø(€€€€€€€€€€€€€€€€ñ½ÁÑ¥½¸Ù…±Õ”ôˆˆû²ÇªÎó®NÇªâ%@ƒ®¾ã²^ÃªÊÀğ½½ÁÑ¥½¸ø(€€€€€€€€€€€€€€€íµ½‰¥±•A½¥¹Ñ%Ñ•µÌ¹µ…À ¡¥Ğ¤€ôø€ñ½ÁÑ¥½¸­•äõí¥Ğ¹­•åôÙ…±Õ”õí¥Ğ¹­•åôùí¥Ğ¹±…‰•±ôğ½½ÁÑ¥½¸ø¥ô(€€€€€€€€€€€€€€ğ½Í•±•Ğø(€€€€€€€€€€€€¥ô(€€€€€€€€€€€€ñÍ•±•ĞÙ…±Õ”õíµ…Ám¥‘átü¹­Á¥-•äñğ€œô½¹¡…¹”õì¡”¤€ôøÕÁ‘…Ñ”¡¥‘à°€­Á¥-•äœ°”¹Ñ…É•Ğ¹Ù…±Õ”¥ô±…ÍÍ9…µ”ô‰Ñ•áĞµáÌ‰½É‘•È‰½É‘•ÈµÉ…ä´ÈÀÀÉ½Õ¹‘•µ±œÁà´ÈÁä´Ä¸Ô™±•à´Äµ¥¸µÜµlÄÌÁÁátˆø(€€€€€€€€€€€€€€ñ½ÁÑ¥½¸Ù…±Õ”ôˆˆù-A$ƒ®¾ã²^ÃªÊÀğ½½ÁÑ¥½¸ø(€€€€€€€€€€€€€í­Á¥%Ñ•µÌ¹µ…À ¡¥Ğ¤€ôø€ñ½ÁÑ¥½¸­•äõí¥Ğ¹­•åôÙ…±Õ”õí¥Ğ¹­•åôùí¥Ğ¹±…‰•±ôğ½½ÁÑ¥½¸ø¥ô(€€€€€€€€€€€€ğ½Í•±•Ğø(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€¤¥ô(€€€€€€ğ½‘¥Øø(€€€€ğ½M•Ñ¥½¸ø(€€¤ì)ô()™Õ¹Ñ¥½¸¥‰å•½¹½±Õµ¹5…Á‘¥Ñ½È¡ì½±5…À°µ½‰¥±•A½¥¹Ñ%Ñ•µÌ°½¹¡…¹”ô¤ì(€½¹ÍĞÕÁ‘…Ñ”€ô€¡¤°Ù…±Õ”¤€ôø½¹¡…¹”¡½±5…À¹µ…À ¡Ø°¤¤€ôø€¡¤€ôôô¤€üÙ…±Õ”€èØ¤¤¤ì(€É•ÑÕÉ¸€ (€€€€ñM•Ñ¥½¸Ñ¥Ñ±”ô‹ªâÃ®Î ƒ²jSªâ#²‚sªÖÃ®Îƒ²ÇªÎó®NÇªâ%@ƒ®“¶VDˆÍÕˆô‹ªâÃ®Î½½ƒªÎ×¶Ôƒ²‚²j¤€£¶ªÊ|ƒ®²ÓªÒ ¤ˆø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Áà´ĞÁĞ´ÌÁˆ´ÄÑ•áĞµlÄÅÁátÑ•áĞµÉ…ä´ĞÀÀˆûªâÃ®Î½½ƒ²’Dƒ²ZÓ®*@ƒ¶Z'²^@ƒ²z®‚—¶VÓ®>°ƒªÎƒ®–àƒ²jSªâ#²‚sªÖÃ²^@ƒ®RÃ®vğƒ²^³ªâÀƒ²²‚W¶Vpƒ²ÇªÎó®NÇªâ%@ƒ¶V·®ª§²ró®†pƒ²zC®>dƒ®ÂÃ®Ú®>ó²jP¸ğ½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‘¥Ù¥‘”µä‘¥Ù¥‘”µÉ…ä´ÔÀˆø(€€€€€€€í5QI%a}=1L¹µ…À ¡½°°¤¤€ôø€ (€€€€€€€€€€ñ‘¥Ø­•äõí½±ô±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È…À´ÈÁà´ĞÁä´È¸Ô™±•àµİÉ…Àˆø(€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´Ñ•áĞµÉ…ä´ÜÀÀµ¥¸µÜµlÄÔÁÁátˆùí½±ôğ½ÍÁ…¸ø(€€€€€€€€€€€€ñÍ•±•ĞÙ…±Õ”õí½±5…Ám¥tñğ€œô½¹¡…¹”õì¡”¤€ôøÕÁ‘…Ñ”¡¤°”¹Ñ…É•Ğ¹Ù…±Õ”¥ô±…ÍÍ9…µ”ô‰Ñ•áĞµáÌ‰½É‘•È‰½É‘•ÈµÉ…ä´ÈÀÀÉ½Õ¹‘•µ±œÁà´ÈÁä´Ä¸Ô™±•à´Äµ¥¸µÜµlÄÌÁÁátˆø(€€€€€€€€€€€€€€ñ½ÁÑ¥½¸Ù…±Õ”ôˆˆû®¾ã²^ÃªÊÀğ½½ÁÑ¥½¸ø(€€€€€€€€€€€€€íµ½‰¥±•A½¥¹Ñ%Ñ•µÌ¹µ…À ¡¥Ğ¤€ôø€ñ½ÁÑ¥½¸­•äõí¥Ğ¹­•åôÙ…±Õ”õí¥Ğ¹­•åôùí¥Ğ¹±…‰•±ôğ½½ÁÑ¥½¸ø¥ô(€€€€€€€€€€€€ğ½Í•±•Ğø(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€¤¥ô(€€€€€€ğ½‘¥Øø(€€€€ğ½M•Ñ¥½¸ø(€€¤ì)ô()½¹ÍĞI=1}1	1L€ôì•µÁ±½å•”è€Ÿ²vó®Â`ƒ²²n@œ°µ…¹…•Èè€Ÿ®“®.#²‚ £ªÒ®š³²z@ƒªÚ3¶Vp¤œ°…‘µ¥¸è€Ÿ²‚²ÊĞƒªÒ®š³²z@œôì()™Õ¹Ñ¥½¸A•Éµ¥ÍÍ¥½¹Í5…¹…•È¡ì•µÁ±½å••Ìô¤ì(€½¹ÍĞmÉ½±•Í	å%°Í•ÑI½±•Í	å%‘t€ôÕÍ•MÑ…Ñ”¡íô¤ì(€½¹ÍĞmÍ…Ù¥¹%°Í•ÑM…Ù¥¹%‘t€ôÕÍ•MÑ…Ñ”¡¹Õ±°¤ì(€½¹ÍĞm•ÉÉ½È°Í•ÑÉÉ½Ét€ôÕÍ•MÑ…Ñ” œœ¤ì(€½¹ÍĞm¹…µ•EÕ•Éä°Í•Ñ9…µ•EÕ•Éåt€ôÕÍ•MÑ…Ñ” œœ¤ì((€½¹ÍĞm…ÕÑ½A½Í¥Ñ¥½¹Ì°Í•ÑÕÑ½A½Í¥Ñ¥½¹Ít€ôÕÍ•MÑ…Ñ”¡mt¤ì(€½¹ÍĞm…ÕÑ½M…Ù¥¹œ°Í•ÑÕÑ½M…Ù¥¹t€ôÕÍ•MÑ…Ñ”¡™…±Í”¤ì((€ÕÍ•™™•Ğ  ¤€ôøì(€€€Í•ÑI½±•Í	å%¡=‰©•Ğ¹™É½µ¹ÑÉ¥•Ì¡•µÁ±½å••Ì¹µ…À ¡”¤€ôøm”¹¥°”¹É½±”ñğ€•µÁ±½å•”t¤¤¤ì(€ô°m•µÁ±½å••Ít¤ì((€ÕÍ•™™•Ğ  ¤€ôøì(€€€€¡…Íå¹Œ€ ¤€ôøì(€€€€€½¹ÍĞì‘…Ñ„°•ÉÉ½Èô€ô…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ …ÁÁ}½¹™¥œœ¤¹Í•±•Ğ Ù…±Õ”œ¤¹•Ä ½¹™¥}­•äœ°€…ÕÑ½}µ…¹…•É}Á½Í¥Ñ¥½¹Ìœ¤¹µ…å‰•M¥¹±” ¤ì(€€€€€¥˜€ …•ÉÉ½È€˜˜ÉÉ…ä¹¥ÍÉÉ…ä¡‘…Ñ„ü¹Ù…±Õ”¤¤Í•ÑÕÑ½A½Í¥Ñ¥½¹Ì¡‘…Ñ„¹Ù…±Õ”¤ì(€€€ô¤ ¤ì(€ô°mt¤ì((€½¹ÍĞÍ…Ù•I½±”€ô…Íå¹Œ€¡¥°É½±”¤€ôøì(€€€Í•ÑM…Ù¥¹%¡¥¤ì(€€€Í•ÑÉÉ½È œœ¤ì(€€€½¹ÍĞì•ÉÉ½Èô€ô…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ ÁÉ½™¥±•Ìœ¤¹ÕÁ‘…Ñ”¡ìÉ½±”ô¤¹•Ä ¥œ°¥¤ì(€€€¥˜€¡•ÉÉ½È¤ì½¹Í½±”¹•ÉÉ½È I=1MYII=Hèœ°•ÉÉ½È¤ìÍ•ÑÉÉ½È¡™É¥•¹‘±åÉÉ½È¡•ÉÉ½È¤¤ìô(€€€Í•ÑM…Ù¥¹%¡¹Õ±°¤ì(€ôì((€½¹ÍĞÑ½±•ÕÑ½A½Í¥Ñ¥½¸€ô…Íå¹Œ€¡À¤€ôøì(€€€½¹ÍĞ¹•áĞ€ô…ÕÑ½A½Í¥Ñ¥½¹Ì¹¥¹±Õ‘•Ì¡À¤€ü…ÕÑ½A½Í¥Ñ¥½¹Ì¹™¥±Ñ•È ¡à¤€ôøà€„ôôÀ¤€èl¸¸¹…ÕÑ½A½Í¥Ñ¥½¹Ì°Átì(€€€Í•ÑÕÑ½A½Í¥Ñ¥½¹Ì¡¹•áĞ¤ì(€€€Í•ÑÕÑ½M…Ù¥¹œ¡ÑÉÕ”¤ì(€€€½¹ÍĞì•ÉÉ½Èô€ô…İ…¥ĞÍÕÁ…‰…Í”¹™É½´ …ÁÁ}½¹™¥œœ¤¹ÕÁÍ•ÉĞ¡ì½¹™¥}­•äè€…ÕÑ½}µ…¹…•É}Á½Í¥Ñ¥½¹Ìœ°Ù…±Õ”è¹•áĞô°ì½¹½¹™±¥Ğè€½¹™¥}­•äœô¤ì(€€€¥˜€¡•ÉÉ½È¤ì½¹Í½±”¹•ÉÉ½È UQ<A=M%Q%=9LMYII=Hèœ°•ÉÉ½È¤ìÍ•ÑÉÉ½È¡™É¥•¹‘±åÉÉ½È¡•ÉÉ½È¤¤ìô(€€€Í•ÑÕÑ½M…Ù¥¹œ¡™…±Í”¤ì(€ôì((€½¹ÍĞÙ¥Í¥‰±”€ô•µÁ±½å••Ì¹™¥±Ñ•È ¡”¤€ôø€…¹…µ•EÕ•Éä¹ÑÉ¥´ ¤ñğ”¹¹…µ”¹¥¹±Õ‘•Ì¡¹…µ•EÕ•Éä¹ÑÉ¥´ ¤¤¤ì((€É•ÑÕÉ¸€ (€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µ…àµÜ´Éá°ÍÁ…”µä´Ğˆø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ…ä´ĞÀÀ‰œµÉ…ä´ÔÀÉ½Õ¹‘•µ±œÀ´Ì™±•à…À´Èˆø(€€€€€€€€ñ%¹™¼Í¥é”õìÄÍô±…ÍÍ9…µ”ô‰Í¡É¥¹¬´ÀµĞ´À¸Ôˆ€¼ø(€€€€€€€ƒ²vĞƒ¶fS®¦Ó²v ƒ²vÓªÂW²ƒªÎ²‚W®0ƒ®Îğƒ²"`ƒ²z#²ZÓ²jP¸ƒ®ª£®N€ƒªÚ3¶Vpƒ®ÎªÊ÷²v ƒ®ÎªÊôƒ²vÓ®‚—²^@ƒªâÃ®†w®B§®.#®.¸(€€€€€€ğ½‘¥Øø((€€€€€€ñM•Ñ¥½¸Ñ¥Ñ±”ô‹ªÂ²zƒ²*ç²vã².pƒ²zC®>g²ró®†pƒ®“®.#²‚ ƒªÚ3¶Vpƒ®Ú²^³¶V€ƒ²ªâ$ˆ‘•™…Õ±Ñ=Á•¸ø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Áà´ĞÁä´ÌÑ•áĞµlÄÅÁátÑ•áĞµÉ…ä´ĞÀÀˆû²ÊÓ¶³®Bpƒ²ªâ'²ró®†pƒªÂ²zƒ².ƒ²Ê·¶Vpƒ²
³®z3²vƒ²*ç²vã¶Vc®¦Ğ°ƒ®Î®>ƒ²†Ã²zDƒ²^²vĞƒ²zC®>g²ró®†pƒ®“®.#²‚ £ªÒ®š³²z@¤ƒªÚ3¶Vs²vĞƒ®Úg²ZÓ²jP¸ğ½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Áà´ĞÁˆ´Ğ™±•à™±•àµİÉ…À…À´Èˆø(€€€€€€€€€íA=M%Q%=9L¹µ…À ¡À¤€ôø€ (€€€€€€€€€€€€ñ‰ÕÑÑ½¸­•äõíÁô½¹±¥¬õì ¤€ôøÑ½±•ÕÑ½A½Í¥Ñ¥½¸¡À¥ô‘¥Í…‰±•õí…ÕÑ½M…Ù¥¹ô(€€€€€€€€€€€€€±…ÍÍ9…µ”õíÑ•áĞµáÌ™½¹Ğµµ•‘¥Õ´Áà´ÌÁä´Ä¸ÔÉ½Õ¹‘•µ™Õ±°‰½É‘•È€‘í…ÕÑ½A½Í¥Ñ¥½¹Ì¹¥¹±Õ‘•Ì¡À¤€ü€‰œµÙ¥½±•Ğ´ØÀÀÑ•áĞµİ¡¥Ñ”‰½É‘•ÈµÙ¥½±•Ğ´ØÀÀœ€è€‰œµİ¡¥Ñ”Ñ•áĞµÉ…ä´ÔÀÀ‰½É‘•ÈµÉ…ä´ÈÀÀõôø(€€€€€€€€€€€€€íÁô(€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€¤¥ô(€€€€€€€€ğ½‘¥Øø(€€€€€€ğ½M•Ñ¥½¸ø((€€€€€€ñM•Ñ¥½¸Ñ¥Ñ±”ô‹²²nC®ÎƒªÚ3¶Vpƒ²²‚Dƒ®ÎªÊôˆÍÕˆõí€‘í•µÁ±½å••Ì¹±•¹Ñ¡÷®ªô‘•™…Õ±Ñ=Á•¸ø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Áà´ĞÁĞ´ÌÁˆ´Èˆø(€€€€€€€€€€ñ¥¹ÁÕĞÁ±…•¡½±‘•Èô‹²vÓ®šƒªÊ²$ˆÙ…±Õ”õí¹…µ•EÕ•Éåô½¹¡…¹”õì¡”¤€ôøÍ•Ñ9…µ•EÕ•Éä¡”¹Ñ…É•Ğ¹Ù…±Õ”¥ô±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´‰½É‘•È‰½É‘•ÈµÉ…ä´ÈÀÀÉ½Õ¹‘•µ±œÁà´È¸ÔÁä´Ä¸Ô‰œµİ¡¥Ñ”Ü´ÌÈˆ€¼ø(€€€€€€€€ğ½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‘¥Ù¥‘”µä‘¥Ù¥‘”µÉ…ä´ÔÀˆø(€€€€€€€€€íÙ¥Í¥‰±”¹µ…À ¡”¤€ôø€ (€€€€€€€€€€€€ñ‘¥Ø­•äõí”¹¥‘ô±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•Ñİ••¸…À´ÈÁà´ĞÁä´È¸Ôˆø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µ¥¸µÜ´Àˆø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´™½¹Ğµµ•‘¥Õ´Ñ•áĞµÉ…ä´àÀÀÑÉÕ¹…Ñ”ˆùí”¹¹…µ•ô€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµÉ…ä´ĞÀÀ™½¹Ğµ¹½Éµ…°ˆû
Üí”¹Á½Í¥Ñ¥½¹ôƒ
Üí‘¥ÍÁ±…åMÑ½É•9…µ”¡”¹‰É…¹ ¥ôğ½ÍÁ…¸øğ½‘¥Øø(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È…À´Ä¸ÔÍ¡É¥¹¬´Àˆø(€€€€€€€€€€€€€€€€ñÍ•±•Ğ(€€€€€€€€€€€€€€€€€Ù…±Õ”õíÉ½±•Í	å%‘m”¹¥‘tñğ€•µÁ±½å•”ô(€€€€€€€€€€€€€€€€€½¹¡…¹”õì¡•Ø¤€ôøÍ•ÑI½±•Í	å%¡ì€¸¸¹É½±•Í	å%°m”¹¥‘tè•Ø¹Ñ…É•Ğ¹Ù…±Õ”ô¥ô(€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰Ñ•áĞµáÌ‰½É‘•È‰½É‘•ÈµÉ…ä´ÈÀÀÉ½Õ¹‘•µ±œÁà´ÈÁä´Ä¸Ôˆ(€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€í=‰©•Ğ¹•¹ÑÉ¥•Ì¡I=1}1	1L¤¹µ…À ¡mØ°±…‰•±t¤€ôø€ñ½ÁÑ¥½¸­•äõíÙôÙ…±Õ”õíÙôùí±…‰•±ôğ½½ÁÑ¥½¸ø¥ô(€€€€€€€€€€€€€€€€ğ½Í•±•Ğø(€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€€€½¹±¥¬õì ¤€ôøÍ…Ù•I½±”¡”¹¥°É½±•Í	å%‘m”¹¥‘t¥ô(€€€€€€€€€€€€€€€€€‘¥Í…‰±•õíÍ…Ù¥¹%€ôôô”¹¥ñğ€¡É½±•Í	å%‘m”¹¥‘tñğ€•µÁ±½å•”œ¤€ôôô€¡”¹É½±”ñğ€•µÁ±½å•”œ¥ô(€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰Ñ•áĞµáÌ™½¹Ğµµ•‘¥Õ´Áà´È¸ÔÁä´Ä¸ÔÉ½Õ¹‘•µµ‰œµÙ¥½±•Ğ´ØÀÀÑ•áĞµİ¡¥Ñ”‘¥Í…‰±•é½Á…¥Ñä´ĞÀˆ(€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€íÍ…Ù¥¹%€ôôô”¹¥€ü€ñ1½…‘•ÈÈÍ¥é”õìÄÍô±…ÍÍ9…µ”ô‰…¹¥µ…Ñ”µÍÁ¥¸ˆ€¼ø€è€Ÿ²‚²z”ô(€€€€€€€€€€€€€€€€ğ½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€¤¥ô(€€€€€€€€€íÙ¥Í¥‰±”¹±•¹Ñ €ôôô€À€˜˜€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ…ä´ĞÀÀÁà´ĞÁä´ØÑ•áĞµ•¹Ñ•ÈˆûªÊ²$ƒªÊÃªÎóªÂ ƒ²^²ZÓ²jP¸ğ½‘¥Øùô(€€€€€€€€ğ½‘¥Øø(€€€€€€ğ½M•Ñ¥½¸ø((€€€€€í•ÉÉ½È€˜˜€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ•´ØÀÀ‰œµÉ•´ÔÀÉ½Õ¹‘•µ±œÀ´Ìˆùí•ÉÉ½Éôğ½‘¥Øùô(€€€€ğ½‘¥Øø(€€¤ì)ô()™Õ¹Ñ¥½¸I…Ñ•Í5…¹…•È¡ì½¹™¥œ°Á•ÉÍ¥ÍÑ½¹™¥œô¤ì(€½¹ÍĞm‘É…™Ğ°Í•ÑÉ…™Ñ™t€ôÕÍ•MÑ…Ñ”¡½¹™¥œ¤ì(€ÕÍ•™™•Ğ  ¤€ôøÍ•ÑÉ…™Ñ™œ¡½¹™¥œ¤°m½¹™¥t¤ì(€½¹ÍĞÍ…Ù”€ô€ ¤€ôøÁ•ÉÍ¥ÍÑ½¹™¥œ¡‘É…™Ğ¤ì((€½¹ÍĞÕÁ‘…Ñ•±…ÑQ…‰±”€ô€¡É½ÕÀ°¥‘à°™¥•±°Ù…°¤€ôøì(€€€½¹ÍĞ¹•áĞ€ôì€¸¸¹‘É…™Ğ°mÉ½ÕÁtè‘É…™ÑmÉ½ÕÁt¹µ…À ¡Ğ°¤¤€ôø€¡¤€ôôô¥‘à€üì€¸¸¹Ğ°m™¥•±‘tèÙ…°ô€èĞ¤¤ôì(€€€Í•ÑÉ…™Ñ™œ¡¹•áĞ¤ì(€ôì(€½¹ÍĞÕÁ‘…Ñ•5…ÑÉ¥à€ô€¡É¤°¤°Ù…°¤€ôøì(€€€½¹ÍĞ¹•áĞ€ô‘É…™Ğ¹µ…ÑÉ¥à¹µ…À ¡É½Ü¤€ôøl¸¸¹É½İt¤ì(€€€¹•áÑmÉ¥um¥t€ôÙ…°ì(€€€Í•ÑÉ…™Ñ™œ¡ì€¸¸¹‘É…™Ğ°µ…ÑÉ¥àè¹•áĞô¤ì(€ôì((€É•ÑÕÉ¸€ (€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µ…àµÜ´Íá°ÍÁ…”µä´Ğˆø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ…ä´ĞÀÀ‰œµÉ…ä´ÔÀÉ½Õ¹‘•µ±œÀ´Ìˆû¶V·®ª§²vƒ²"c²‚W¶Vpƒ®Jƒ® ƒ²V®z`€‹²‚²z”ˆƒ®Ê¶*ó²vƒ®"3®~³²Vğƒ®ª£®N€ƒ²²n@ƒ¶fS®¦Ó²^@ƒ®Âc²b®>ó²jP¸ğ½‘¥Øø((€€€€€€ñ5½‰¥±•A½¥¹Ñ%Ñ•µÍ‘¥Ñ½È¥Ñ•µÌõí‘É…™Ğ¹µ½‰¥±•A½¥¹Ñ%Ñ•µÍô½¹¡…¹”õì¡¥Ñ•µÌ¤€ôøÍ•ÑÉ…™Ñ™œ¡ì€¸¸¹‘É…™Ğ°µ½‰¥±•A½¥¹Ñ%Ñ•µÌè¥Ñ•µÌô¥ô€¼ø((€€€€€€ñ-Á¥%Ñ•µÍ‘¥Ñ½È¥Ñ•µÌõí‘É…™Ğ¹­Á¥%Ñ•µÍô½¹¡…¹”õì¡¥Ñ•µÌ¤€ôøÍ•ÑÉ…™Ñ™œ¡ì€¸¸¹‘É…™Ğ°­Á¥%Ñ•µÌè¥Ñ•µÌô¥ô€¼ø((€€€€€€ñ…Ñ•½Éå5…Á‘¥Ñ½Èµ…Àõí‘É…™Ğ¹…Ñ•½Éå5…Áôµ½‰¥±•A½¥¹Ñ%Ñ•µÌõí‘É…™Ğ¹µ½‰¥±•A½¥¹Ñ%Ñ•µÍô­Á¥%Ñ•µÌõí‘É…™Ğ¹­Á¥%Ñ•µÍô(€€€€€€€½¹¡…¹”õì¡´¤€ôøÍ•ÑÉ…™Ñ™œ¡ì€¸¸¹‘É…™Ğ°…Ñ•½Éå5…Àè´ô¥ô€¼ø((€€€€€€ñ¥‰å•½¹½±Õµ¹5…Á‘¥Ñ½È½±5…Àõí‘É…™Ğ¹¥‰å•½¹½±Õµ¹5…Áôµ½‰¥±•A½¥¹Ñ%Ñ•µÌõí‘É…™Ğ¹µ½‰¥±•A½¥¹Ñ%Ñ•µÍô(€€€€€€€½¹¡…¹”õì¡´¤€ôøÍ•ÑÉ…™Ñ™œ¡ì€¸¸¹‘É…™Ğ°¥‰å•½¹½±Õµ¹5…Àè´ô¥ô€¼ø((€€€€€€ñM•Ñ¥½¸Ñ¥Ñ±”ô‹²ªâ'®Îƒ²Ös²‚ ƒ®ÎÓ²z—ªâ#²V„ˆ‘•™…Õ±Ñ=Á•¸ø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰À´ÌÉ¥É¥µ½±Ì´È…À´Èˆø(€€€€€€€€€íA=M%Q%=9L¹µ…À ¡À¤€ôø€ (€€€€€€€€€€€€ñ‘¥Ø­•äõíÁô±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•Ñİ••¸…À´Èˆø(€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´Ñ•áĞµÉ…ä´ØÀÀˆùíÁôğ½ÍÁ…¸ø(€€€€€€€€€€€€€€ñ¥¹ÁÕĞÑåÁ”ô‰Ñ•áĞˆ¥¹ÁÕÑ5½‘”ô‰¹Õµ•É¥ŒˆÙ…±Õ”õí™µÑ%¹ÁÕÑ9Õµ‰•È¡‘É…™Ğ¹‰…Í•A…åmÁt¥ô½¹¡…¹”õì¡”¤€ôøÍ•ÑÉ…™Ñ™œ¡ì€¸¸¹‘É…™Ğ°‰…Í•A…äèì€¸¸¹‘É…™Ğ¹‰…Í•A…ä°mÁtèÁ…ÉÍ•%¹Ğ¡”¹Ñ…É•Ğ¹Ù…±Õ”¹É•Á±…” ½q½œ°œœ¤ñğ€œÀœ°€ÄÀ¤ôô¥ô±…ÍÍ9…µ”ô‰Ü´ÈàÑ•áĞµÉ¥¡Ğ‰½É‘•È‰½É‘•ÈµÉ…ä´ÈÀÀÉ½Õ¹‘•µ±œÁà´ÈÁä´ÄÑ•áĞµÍ´ˆ€¼ø(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€¤¥ô(€€€€€€€€ğ½‘¥Øø(€€€€€€ğ½M•Ñ¥½¸ø((€€€€€€ñM•Ñ¥½¸Ñ¥Ñ±”ô‹²ªâ'®Îƒ²²Æ²"c®.äˆø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰À´ÌÑ•áĞµlÄÅÁátÑ•áĞµÉ…ä´ĞÀÀˆû²²Æ²"c®.ç²v ƒ²b²^¶fs®>dƒ²²nCªâ#ªÎğƒ®Î®>®†pƒªÂ²
Ã®>ó²jP¸ƒ².“²‚²ró®†pƒ²²Æ²"c®.ç®3¶ğƒ®.“².pƒ²Æ²jàƒ¶V²jSªÂ ƒ²^²ZÓ²jP¸ğ½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰À´ÌÁĞ´ÀÉ¥É¥µ½±Ì´È…À´Èˆø(€€€€€€€€€íA=M%Q%=9L¹µ…À ¡À¤€ôø€ (€€€€€€€€€€€€ñ‘¥Ø­•äõíÁô±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•Ñİ••¸…À´Èˆø(€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´Ñ•áĞµÉ…ä´ØÀÀˆùíÁôğ½ÍÁ…¸ø(€€€€€€€€€€€€€€ñ¥¹ÁÕĞÑåÁ”ô‰Ñ•áĞˆ¥¹ÁÕÑ5½‘”ô‰¹Õµ•É¥ŒˆÙ…±Õ”õí™µÑ%¹ÁÕÑ9Õµ‰•È¡‘É…™Ğ¹Á½Í¥Ñ¥½¹±±½İ…¹”ü¹mÁtñğ€À¥ô½¹¡…¹”õì¡”¤€ôøÍ•ÑÉ…™Ñ™œ¡ì€¸¸¹‘É…™Ğ°Á½Í¥Ñ¥½¹±±½İ…¹”èì€¸¸¹‘É…™Ğ¹Á½Í¥Ñ¥½¹±±½İ…¹”°mÁtèÁ…ÉÍ•%¹Ğ¡”¹Ñ…É•Ğ¹Ù…±Õ”¹É•Á±…” ½q½œ°œœ¤ñğ€œÀœ°€ÄÀ¤ôô¥ô±…ÍÍ9…µ”ô‰Ü´ÈàÑ•áĞµÉ¥¡Ğ‰½É‘•È‰½É‘•ÈµÉ…ä´ÈÀÀÉ½Õ¹‘•µ±œÁà´ÈÁä´ÄÑ•áĞµÍ´ˆ€¼ø(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€¤¥ô(€€€€€€€€ğ½‘¥Øø(€€€€€€ğ½M•Ñ¥½¸ø((€€€€€€ñM•Ñ¥½¸Ñ¥Ñ±”ô‹²b²^ƒ¶fs®>dƒ²²n@ƒ²‚W²Æˆ‘•™…Õ±Ñ=Á•¸ø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Áà´ĞÁä´Ì‰œµÉ…ä´ÔÀÑ•áĞµlÄÅÁátÑ•áĞµÉ…ä´ÔÀÀ±•…‘¥¹œµÉ•±…á•ˆø(€€€€€€€€€ƒ®2²ƒ².“²‚²v €ñˆù!Lƒ
ÜM%459@ƒ
Ü€É9ğ½ˆû²z®.#®.¸€ÛªÂs²nPƒ®¾ã®3²v ƒ².“²‚ªÎğƒ®²ÓªÒ¶VcªÊ0ƒªÎƒ²‚Tƒ²ªâ'¶VcªÎ€°(€€€€€€€€€ƒ²vÓ¶nƒªÖ³ªÂ²v ƒªÆÓ®.äƒªâ#²V‡²vƒ®"²‚¶Vc®B`ƒ²b²^ƒ¶fs®>dƒ²²n@ƒ²‚W²Æƒ²ªâ'²V‡²v 5c®–ğƒ®c² ƒ²V+²*×®.#®.¸(€€€€€€€€ğ½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‘¥Ù¥‘”µä‘¥Ù¥‘”µÉ…ä´ÔÀˆø(€€€€€€€€€ì¡‘É…™Ğ¹Ñ•¹ÕÉ•ññmt¤¹µ…À ¡Ğ±¤¤ôøñ‘¥Ø­•äõíĞ¹­•åô±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•Ñİ••¸Áà´ĞÁä´È¸Ô…À´Ìˆø(€€€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´Ñ•áĞµÉ…ä´ÜÀÀˆùíĞ¹±…‰•±ôğ½‘¥Øø(€€€€€€€€€€€€€íĞ¹­•äôôôÕ¹‘•ÈØœ˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀˆû².“²‚ƒ®²ÓªÒ ƒªÎƒ²‚Tƒ²ªâ$ğ½‘¥Øùô(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€íĞ¹­•äôôôÕ¹‘•ÈØœ€ü€ (€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´™½¹Ğµ‰½±Ñ•áĞµÉ…ä´ÜÀÀˆùíİ½¸¡‘É…™Ğ¹Ñ•¹ÕÉ•…ÁññU1Q}Q%Y%Qe}MUAA=IQ}5`¥ôğ½‘¥Øø(€€€€€€€€€€€€¤€è€ (€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È…À´Äˆø(€€€€€€€€€€€€€€€€ñ¥¹ÁÕĞÑåÁ”ô‰Ñ•áĞˆ¥¹ÁÕÑ5½‘”ô‰¹Õµ•É¥ŒˆÙ…±Õ”õí™µÑ%¹ÁÕÑ9Õµ‰•È¡Ğ¹É…Ñ”¥ô(€€€€€€€€€€€€€€€€€½¹¡…¹”õì¡”¤ôùÕÁ‘…Ñ•±…ÑQ…‰±” Ñ•¹ÕÉ”œ±¤°É…Ñ”œ±Á…ÉÍ•%¹Ğ¡”¹Ñ…É•Ğ¹Ù…±Õ”¹É•Á±…” ½q½œ°œœ¥ñğœÀœ°ÄÀ¤¥ô(€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰Ü´ÈĞÑ•áĞµÉ¥¡Ğ‰½É‘•È‰½É‘•ÈµÉ…ä´ÈÀÀÉ½Õ¹‘•Áà´Ä¸ÔÁä´ÄÑ•áĞµÍ´ˆ¼ø(€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ…ä´ĞÀÀˆû²n@¿ªÆĞğ½ÍÁ…¸ø(€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€¥ô(€€€€€€€€€€ğ½‘¥Øø¥ô(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•Ñİ••¸Áà´ĞÁä´Ì…À´Ì‰œµÙ¥½±•Ğ´ÔÀ¼ĞÀˆø(€€€€€€€€€€€€ñ‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´™½¹ĞµÍ•µ¥‰½±Ñ•áĞµÉ…ä´ÜÀÀˆû²b²^ƒ¶fs®>dƒ²²n@ƒ²‚W²Æ5`ğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµlÄÁÁátÑ•áĞµÉ…ä´ĞÀÀˆøÛªÂs²nPƒ®¾ã®0ƒªÎƒ²‚Tƒ²ªâ'²V‡®>ƒ²vĞƒªâ#²V‡²vƒ²
³²j§¶V§®.#®.¸ğ½‘¥Øøğ½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È…À´Äˆø(€€€€€€€€€€€€€€ñ¥¹ÁÕĞÑåÁ”ô‰Ñ•áĞˆ¥¹ÁÕÑ5½‘”ô‰¹Õµ•É¥ŒˆÙ…±Õ”õí™µÑ%¹ÁÕÑ9Õµ‰•È¡‘É…™Ğ¹Ñ•¹ÕÉ•…ÁññU1Q}Q%Y%Qe}MUAA=IQ}5`¥ô(€€€€€€€€€€€€€€€½¹¡…¹”õì¡”¤ôùÍ•ÑÉ…™Ñ™œ¡ì¸¸¹‘É…™Ğ±Ñ•¹ÕÉ•…ÀéÁ…ÉÍ•%¹Ğ¡”¹Ñ…É•Ğ¹Ù…±Õ”¹É•Á±…” ½q½œ°œœ¥ñğœÀœ°ÄÀ¥ô¥ô(€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰Ü´ÈàÑ•áĞµÉ¥¡Ğ‰½É‘•È‰½É‘•ÈµÉ…ä´ÈÀÀÉ½Õ¹‘•Áà´ÈÁä´ÄÑ•áĞµÍ´‰œµİ¡¥Ñ”ˆ¼ø(€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ…ä´ĞÀÀˆû²n@ğ½ÍÁ…¸ø(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€ğ½‘¥Øø(€€€€€€ğ½M•Ñ¥½¸ø((€€€€€€ñM•Ñ¥½¸Ñ¥Ñ±”ô‹²Ös²‚ ƒ®ÎÓ²z”ƒ®æªÖ@ƒªâÃ²’ ˆø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰À´ĞÑ•áĞµáÌÑ•áĞµÉ…ä´ØÀÀ±•…‘¥¹œµÉ•±…á•ÍÁ…”µä´Èˆø(€€€€€€€€€€ñ‘¥Øøñˆû®æªÖ@ƒ®2²ğ½ˆøƒ
Üƒ²b²^ƒ¶fs®>dƒ²²n@ƒ²‚W²Æ€¬ƒ²jSªâ#²‚p€¬YL€¬€É9€¬ƒ²*ç²vã®Bpƒ®ª£®ÂS²vğƒ²*“¶2|€¬ƒ¶*ç¶2C
ß²²vã¶2C®ƒ®2²ÊĞƒ²vã²ó¶.Ã®â0€¬ƒ²²Æ²"c®.äğ½‘¥Øø(€€€€€€€€€€ñ‘¥Øøñˆû®æªÖ@ƒ²‚s²fàğ½ˆøƒ
Üƒ²ÇªÎó®NÇªâ$ƒ®ÎÓ®#²*€¬ƒ¶f ƒªÒ®‚ ƒ²"c²"c®0€¬ƒ²3®à€¬ƒ²’GªÎ59@ƒªÊÃ¶V¤€¬ƒªÎƒªÂw®NÇ®†t€¬ƒ®{²Ú“²‚s²V ğ½‘¥Øø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áĞµÉ…ä´ĞÀÀˆû®æªÖ@ƒ®2²ƒ¶V§ªÎªÂ ƒ²ªâ'®Îƒ²Ös²‚ ƒ®ÎÓ²z—ªâ#²V‡®ÎÓ®.ƒ®
»²ró®¦Ğƒ¶VÓ®.äƒ²ªâ'²v`ƒ²Ös²‚ ƒ®ÎÓ²z—ªâ#²V‡²ró®†pƒ®ÎÓ²‚W¶Vpƒ®J°ƒ®æªÖ@ƒ²‚s²fàƒ¶V·®ª§²vƒ²ÚSªÂ¶V§®.#®.¸ğ½‘¥Øø(€€€€€€€€ğ½‘¥Øø(€€€€€€ğ½M•Ñ¥½¸ø(€€€€€€ñI…Ñ•Q…‰±”Ñ¥Ñ±”ô‹²ÇªÎó®NÇªâ$ƒ®ÎÓ®#²*ˆÉ½ÕÀô‰É…‘•Ìˆ‘…Ñ„õí‘É…™Ğ¹É…‘•ÍôÕÁ‘…Ñ•±…ÑQ…‰±”õíÕÁ‘…Ñ•±…ÑQ…‰±•ô™¥•±ô‰‰½¹ÕÌˆ±…‰•±-•äô‰É…‘”ˆ•áÑÉ…¥•±ô‰µ¥¸ˆ€¼ø(€€€€€€ñI…Ñ•Q…‰±”Ñ¥Ñ±”ô‹¶f ƒªŞã®‚#²vÓ®Np€£®"²‚ªÆÓ²"c®Î¤ˆÉ½ÕÀô‰¡½µ•Q¥•ÉÌˆ‘…Ñ„õí‘É…™Ğ¹¡½µ•Q¥•ÉÍôÕÁ‘…Ñ•±…ÑQ…‰±”õíÕÁ‘…Ñ•±…ÑQ…‰±•ô™¥•±ô‰É…Ñ”ˆ±…‰•±-•äô‰µ¥¸ˆ±…‰•±MÕ™™¥àô‹ªÆĞƒ²vÓ²ˆ€¼ø(€€€€€€ñI…Ñ•Q…‰±”Ñ¥Ñ±”ô‹¶f ƒ®.£®>€¼Q[¶R®š°€¼ƒ²*“®#¶*ã¶f ˆÉ½ÕÀô‰¡½µ•±…Ğˆ‘…Ñ„õí‘É…™Ğ¹¡½µ•±…ÑôÕÁ‘…Ñ•±…ÑQ…‰±”õíÕÁ‘…Ñ•±…ÑQ…‰±•ô™¥•±ô‰É…Ñ”ˆ€¼ø(€€€€€€ñI…Ñ•Q…‰±”Ñ¥Ñ±”ô‹®>g².s¶2C®ƒ²"c²"c®0ˆÉ½ÕÀô‰¡½µ•‘‘½¸ˆ‘…Ñ„õí‘É…™Ğ¹¡½µ•‘‘½¹ôÕÁ‘…Ñ•±…ÑQ…‰±”õíÕÁ‘…Ñ•±…ÑQ…‰±•ô™¥•±ô‰É…Ñ”ˆ€¼ø(€€€€€€ñI…Ñ•Q…‰±”Ñ¥Ñ±”ô‹²vã¶Ã®Üƒ²z³²V÷²‚TˆÉ½ÕÀô‰É•¹•Üˆ‘…Ñ„õí‘É…™Ğ¹É•¹•İôÕÁ‘…Ñ•±…ÑQ…‰±”õíÕÁ‘…Ñ•±…ÑQ…‰±•ô™¥•±ô‰É…Ñ”ˆ€¼ø(€€€€€€ñI…Ñ•Q…‰±”Ñ¥Ñ±”ô‰YLˆÉ½ÕÀô‰Ù…Ìˆ‘…Ñ„õí‘É…™Ğ¹Ù…ÍôÕÁ‘…Ñ•±…ÑQ…‰±”õíÕÁ‘…Ñ•±…ÑQ…‰±•ô™¥•±ô‰É…Ñ”ˆ€¼ø(€€€€€€ñI…Ñ•Q…‰±”Ñ¥Ñ±”ôˆÉ9ƒ®Ê#®NˆÉ½ÕÀô‰‰Õ¹‘±”É¹ˆ‘…Ñ„õí‘É…™Ğ¹‰Õ¹‘±”É¹‘ôÕÁ‘…Ñ•±…ÑQ…‰±”õíÕÁ‘…Ñ•±…ÑQ…‰±•ô™¥•±ô‰É…Ñ”ˆ€¼ø(€€€€€€ñI…Ñ•Q…‰±”Ñ¥Ñ±”ô‹²3®àˆÉ½ÕÀô‰Í½¹¼ˆ‘…Ñ„õí‘É…™Ğ¹Í½¹½ôÕÁ‘…Ñ•±…ÑQ…‰±”õíÕÁ‘…Ñ•±…ÑQ…‰±•ô™¥•±ô‰É…Ñ”ˆ€¼ø(€€€€€€ñI…Ñ•Q…‰±”Ñ¥Ñ±”ô‹²’GªÎ59@ƒªÊÃ¶V¤ˆÉ½ÕÀô‰µ¹Á	Õ¹‘±”ˆ‘…Ñ„õí‘É…™Ğ¹µ¹Á	Õ¹‘±•ôÕÁ‘…Ñ•±…ÑQ…‰±”õíÕÁ‘…Ñ•±…ÑQ…‰±•ô™¥•±ô‰É…Ñ”ˆ€¼ø(€€€€€€ñI…Ñ•Q…‰±”Ñ¥Ñ±”ô‹ªÎƒªÂw®NÇ®†tƒªÖ³ªÂƒ®ÎÓ®#²*ˆÉ½ÕÀô‰ÕÍÑI•Q¥•ÉÌˆ‘…Ñ„õí‘É…™Ğ¹ÕÍÑI•Q¥•ÉÍôÕÁ‘…Ñ•±…ÑQ…‰±”õíÕÁ‘…Ñ•±…ÑQ…‰±•ô™¥•±ô‰‰½¹ÕÌˆ±…‰•±-•äô‰µ¥¸ˆ±…‰•±MÕ™™¥àô‹ªÆĞƒ²vÓ²ˆ€¼ø(€€€€€€ñI…Ñ•Q…‰±”Ñ¥Ñ±”ô‹®{²Ú“²‚s²V ƒªÖ³ªÂƒ®ÎÓ®#²*ˆÉ½ÕÀô‰Ñ…¥±½É•‘Q¥•ÉÌˆ‘…Ñ„õí‘É…™Ğ¹Ñ…¥±½É•‘Q¥•ÉÍôÕÁ‘…Ñ•±…ÑQ…‰±”õíÕÁ‘…Ñ•±…ÑQ…‰±•ô™¥•±ô‰‰½¹ÕÌˆ±…‰•±-•äô‰µ¥¸ˆ±…‰•±MÕ™™¥àô‹ªÆĞƒ²vÓ²ˆ€¼ø((€€€€€€ñM•Ñ¥½¸Ñ¥Ñ±”ô‹²jSªâ#²‚pƒ²rƒ²æ`ƒ²"c²"c®0ˆø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰½Ù•É™±½Üµàµ…ÕÑ¼À´Èˆø(€€€€€€€€€€ñÑ…‰±”±…ÍÍ9…µ”ô‰Ñ•áĞµáÌˆø(€€€€€€€€€€€€ñÑ¡•…øñÑÈøñÑ ±…ÍÍ9…µ”ô‰À´ÄÑ•áĞµ±•™ĞÍÑ¥­ä±•™Ğ´À‰œµİ¡¥Ñ”ˆûªÂ²zªÖ³®Úğ½Ñ ùí5QI%a}=1L¹µ…À ¡Œ¤€ôø€ñÑ ­•äõíô±…ÍÍ9…µ”ô‰À´ÄÑ•áĞµÉ…ä´ĞÀÀˆøñ½±!•…‘•È±…‰•°õíô€¼øğ½Ñ ø¥ôğ½ÑÈøğ½Ñ¡•…ø(€€€€€€€€€€€€ñÑ‰½‘äø(€€€€€€€€€€€€€í5QI%a}I=]}L¹µ…À ¡É½İ•˜°É¤¤€ôø€ (€€€€€€€€€€€€€€€€ñÑÈ­•äõíÉ½İ•˜¹±…‰•±ô±…ÍÍ9…µ”ô‰‰½É‘•ÈµĞ‰½É‘•ÈµÉ…ä´ÔÀˆø(€€€€€€€€€€€€€€€€€€ñÑ±…ÍÍ9…µ”ô‰À´Äİ¡¥Ñ•ÍÁ…”µ¹½İÉ…ÀÍÑ¥­ä±•™Ğ´À‰œµİ¡¥Ñ”ˆùíÉ½İ•˜¹±…‰•±ôğ½Ñø(€€€€€€€€€€€€€€€€€íÉ½İ•˜¹¡…ÍQ¥•ÉÌ€ü€ (€€€€€€€€€€€€€€€€€€€5QI%a}=1L¹µ…À ¡Œ°¤¤€ôø€ (€€€€€€€€€€€€€€€€€€€€€€ñÑ­•äõíô±…ÍÍ9…µ”ô‰À´Äˆø(€€€€€€€€€€€€€€€€€€€€€€€€ñ¥¹ÁÕĞÑåÁ”ô‰¹Õµ‰•ÈˆÙ…±Õ”õí‘É…™Ğ¹µ…ÑÉ¥ámÉ¥um¥uô½¹¡…¹”õì¡”¤€ôøÕÁ‘…Ñ•5…ÑÉ¥à¡É¤°¤°Á…ÉÍ•%¹Ğ¡”¹Ñ…É•Ğ¹Ù…±Õ”ñğ€œÀœ°€ÄÀ¤¥ô±…ÍÍ9…µ”ô‰Ü´ÄØÑ•áĞµ•¹Ñ•È‰½É‘•È‰½É‘•ÈµÉ…ä´ÈÀÀÉ½Õ¹‘•Áà´ÄÁä´Äˆ€¼ø(€€€€€€€€€€€€€€€€€€€€€€ğ½Ñø(€€€€€€€€€€€€€€€€€€€€¤¤(€€€€€€€€€€€€€€€€€€¤€è€ (€€€€€€€€€€€€€€€€€€€€ñÑ±…ÍÍ9…µ”ô‰À´Äˆ½±MÁ…¸õí5QI%a}=1L¹±•¹Ñ¡ôø(€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È…À´Ä¸Ôˆø(€€€€€€€€€€€€€€€€€€€€€€€€ñ¥¹ÁÕĞÑåÁ”ô‰¹Õµ‰•ÈˆÙ…±Õ”õí‘É…™Ğ¹µ…ÑÉ¥ámÉ¥ulÁuô½¹¡…¹”õì¡”¤€ôøÕÁ‘…Ñ•5…ÑÉ¥à¡É¤°€À°Á…ÉÍ•%¹Ğ¡”¹Ñ…É•Ğ¹Ù…±Õ”ñğ€œÀœ°€ÄÀ¤¥ô±…ÍÍ9…µ”ô‰Ü´ÈĞÑ•áĞµÉ¥¡Ğ‰½É‘•È‰½É‘•ÈµÉ…ä´ÈÀÀÉ½Õ¹‘•Áà´Ä¸ÔÁä´Äˆ€¼ø(€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµÉ…ä´ĞÀÀˆû²n@€¼ƒªÆĞ€£²jSªâ#²‚sªÖÀƒªÖ³®Úƒ²^²v0¤ğ½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€€€€€€€€€€€ğ½Ñø(€€€€€€€€€€€€€€€€€€¥ô(€€€€€€€€€€€€€€€€ğ½ÑÈø(€€€€€€€€€€€€€€¤¥ô(€€€€€€€€€€€€ğ½Ñ‰½‘äø(€€€€€€€€€€ğ½Ñ…‰±”ø(€€€€€€€€ğ½‘¥Øø(€€€€€€ğ½M•Ñ¥½¸ø((€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õíÍ…Ù•ô±…ÍÍ9…µ”ô‰Áà´ĞÁä´È¸ÔÉ½Õ¹‘•µ±œ‰œµÙ¥½±•Ğ´ØÀÀ¡½Ù•Èé‰œµÙ¥½±•Ğ´ÜÀÀÑ•áĞµİ¡¥Ñ”Ñ•áĞµÍ´™½¹ĞµÍ•µ¥‰½±ˆû²ªâ$ƒªâÃ²’ ƒ²‚²z”ğ½‰ÕÑÑ½¸ø(€€€€ğ½‘¥Øø(€€¤ì)ô()™Õ¹Ñ¥½¸I…Ñ•Q…‰±”¡ìÑ¥Ñ±”°É½ÕÀ°‘…Ñ„°ÕÁ‘…Ñ•±…ÑQ…‰±”°™¥•±°±…‰•±-•ä°±…‰•±MÕ™™¥à°•áÑÉ…¥•±ô¤ì(€É•ÑÕÉ¸€ (€€€€ñM•Ñ¥½¸Ñ¥Ñ±”õíÑ¥Ñ±•ôø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‘¥Ù¥‘”µä‘¥Ù¥‘”µÉ…ä´ÔÀˆø(€€€€€€€í‘…Ñ„¹µ…À ¡Ğ°¤¤€ôø€ (€€€€€€€€€€ñ‘¥Ø­•äõí¥ô±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•Ñİ••¸Áà´ĞÁä´È¸Ô…À´Èˆø(€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´Ñ•áĞµÉ…ä´ÜÀÀˆùí±…‰•±-•ä€ü€‘íÑm±…‰•±-•åuô‘í±…‰•±MÕ™™¥àñğ€œõ€€èĞ¹±…‰•±ôğ½ÍÁ…¸ø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È…À´Äˆø(€€€€€€€€€€€€€í•áÑÉ…¥•±€˜˜€ (€€€€€€€€€€€€€€€€ñ¥¹ÁÕĞÑåÁ”ô‰¹Õµ‰•ÈˆÙ…±Õ”õíÑm•áÑÉ…¥•±‘uô½¹¡…¹”õì¡”¤€ôøÕÁ‘…Ñ•±…ÑQ…‰±”¡É½ÕÀ°¤°•áÑÉ…¥•±°Á…ÉÍ•±½…Ğ¡”¹Ñ…É•Ğ¹Ù…±Õ”ñğ€œÀœ¤¥ô±…ÍÍ9…µ”ô‰Ü´ÄØÑ•áĞµÉ¥¡Ğ‰½É‘•È‰½É‘•ÈµÉ…ä´ÈÀÀÉ½Õ¹‘•Áà´Ä¸ÔÁä´ÄÑ•áĞµáÌˆÑ¥Ñ±”õí•áÑÉ…¥•±‘ô€¼ø(€€€€€€€€€€€€€€¥ô(€€€€€€€€€€€€€€ñ¥¹ÁÕĞÑåÁ”ô‰Ñ•áĞˆ¥¹ÁÕÑ5½‘”ô‰¹Õµ•É¥ŒˆÙ…±Õ”õí™µÑ%¹ÁÕÑ9Õµ‰•È¡Ñm™¥•±‘t¥ô½¹¡…¹”õì¡”¤€ôøÕÁ‘…Ñ•±…ÑQ…‰±”¡É½ÕÀ°¤°™¥•±°Á…ÉÍ•%¹Ğ¡”¹Ñ…É•Ğ¹Ù…±Õ”¹É•Á±…” ½q½œ°œœ¤ñğ€œÀœ°€ÄÀ¤¥ô±…ÍÍ9…µ”ô‰Ü´ÈĞÑ•áĞµÉ¥¡Ğ‰½É‘•È‰½É‘•ÈµÉ…ä´ÈÀÀÉ½Õ¹‘•Áà´Ä¸ÔÁä´ÄÑ•áĞµÍ´ˆ€¼ø(€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµáÌÑ•áĞµÉ…ä´ĞÀÀˆû²n@ğ½ÍÁ…¸ø(€€€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€¤¥ô(€€€€€€ğ½‘¥Øø(€€€€ğ½M•Ñ¥½¸ø(€€¤ì)ô()™Õ¹Ñ¥½¸MÑ…Ñ…É¡ì±…‰•°°Ù…±Õ”°¥½¸è%½¸°…•¹Ğô¤ì(€É•ÑÕÉ¸€ (€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµİ¡¥Ñ”É½Õ¹‘•µá°‰½É‘•È‰½É‘•ÈµÉ…ä´ÄÀÀÀ´Ğˆø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È…À´Ä¸ÔÑ•áĞµÉ…ä´ĞÀÀÑ•áĞµáÌµˆ´Äˆøñ%½¸Í¥é”õìÄÍô€¼øí±…‰•±ôğ½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÑ•áĞµá°™½¹Ğµ‰½±€‘í…•¹Ğ€ü€Ñ•áĞµ…µ‰•È´ØÀÀœ€è€Ñ•áĞµÉ…ä´àÀÀõôùíÑåÁ•½˜Ù…±Õ”ôôô¹Õµ‰•Èœı™µÑ9Õ´¡Ù…±Õ”°Ä¤éÙ…±Õ•ôğ½‘¥Øø(€€€€ğ½‘¥Øø(€€¤ì)ô(