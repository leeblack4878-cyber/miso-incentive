import React, { useEffect, useState } from 'react';
import { Building2, Loader2 } from 'lucide-react';
import { supabase } from './supabase';
import { summarizeVasQuality } from './policyRules';
import {
  SELF_STORE_BASELINE,
  SELF_STORE_WEIGHTS,
  calculateSelfStoreOperatingSupport,
  calculateRetailPartnerMonthlyPolicy,
  calculateSalesMetricActivation,
  calculateRetailMonthlyAward,
  calculateHomeGradePolicy,
  calculateHomeInternetRatioPolicy,
  calculateHomeAwardPolicy,
  calculateIptvGradePolicy,
  calculateHqStructureProjection,
} from './hqStructurePolicy';

const countText = value => Number(value || 0).toLocaleString('ko-KR', { maximumFractionDigits: 1 });
const wonText = value => `${Math.round(Number(value || 0)).toLocaleString('ko-KR')}원`;
const PRODUCT_LABELS = {
  hs: 'HS', second: '2ND', internet: '인터넷', smartHome: '스마트홈', extraSetTop: 'TV 부셋탑(프리 포함)',
};
const BASELINE_LABELS = {
  sangnoksu: '상록수', doil: '도일시장', sammi: '삼미시장', residentCenter: '주민센터', sanbon: '산본점', ownedStore: '자가매장 보유',
};

const HQ_STRUCTURE_EDITOR_ID = 'a50a0979-acef-40b1-98b7-f05074f1c835';

const FORECAST_TONES = {
  violet: { wrap: 'bg-violet-50', label: 'text-violet-500', value: 'text-violet-800', arrow: 'text-violet-300' },
  indigo: { wrap: 'bg-indigo-50', label: 'text-indigo-500', value: 'text-indigo-800', arrow: 'text-indigo-300' },
  emerald: { wrap: 'bg-emerald-50', label: 'text-emerald-500', value: 'text-emerald-800', arrow: 'text-emerald-300' },
  amber: { wrap: 'bg-amber-50', label: 'text-amber-600', value: 'text-amber-800', arrow: 'text-amber-300' },
};

function ForecastAmountStrip({ currentAmount = 0, forecastAmount = 0, runRate, tone = 'violet', detail = '' }) {
  const colors = FORECAST_TONES[tone] || FORECAST_TONES.violet;
  if (!runRate?.isCurrentMonth) {
    return <div className={`mx-4 mt-4 flex items-center justify-between rounded-xl px-3 py-3 ${colors.wrap}`}><span className={`text-[10px] font-semibold ${colors.label}`}>{runRate?.isPastMonth ? '마감 기준액' : '현재 기준액'}</span><b className={`text-base ${colors.value}`}>{wonText(currentAmount)}</b></div>;
  }
  return <div className={`mx-4 mt-4 rounded-xl px-3 py-3 ${colors.wrap}`}>
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
      <div><div className={`text-[10px] font-semibold ${colors.label}`}>현재 기준액</div><div className={`mt-0.5 text-sm font-black ${colors.value}`}>{wonText(currentAmount)}</div></div>
      <div className={`text-lg ${colors.arrow}`}>→</div>
      <div className="text-right"><div className={`text-[10px] font-semibold ${colors.label}`}>월말 예상액</div><div className={`mt-0.5 text-lg font-black ${colors.value}`}>{wonText(forecastAmount)}</div></div>
    </div>
    {detail && <div className={`mt-1.5 text-right text-[9px] ${colors.label}`}>{detail}</div>}
  </div>;
}

function BenefitGuide({ text, increase = 0, assumption = '' }) {
  return <div className="mx-4 mb-4 rounded-xl border border-rose-100 bg-rose-50 px-3 py-3">
    <div className="flex items-start justify-between gap-3"><div><div className="text-[10px] font-bold text-rose-600">다음 수혜 구간</div><div className="mt-1 text-xs font-semibold leading-relaxed text-gray-700">{text}</div></div><div className="shrink-0 text-right"><div className="text-[9px] text-rose-400">예상 증가</div><div className="mt-0.5 text-sm font-black text-rose-700">+{wonText(increase)}</div></div></div>
    {assumption && <div className="mt-1.5 text-[9px] text-gray-400">{assumption}</div>}
  </div>;
}

const nextAbove = (value, thresholds) => thresholds.find(threshold => threshold > Number(value || 0));
const positiveIncrease = (nextAmount, currentAmount) => Math.max(0, Number(nextAmount || 0) - Number(currentAmount || 0));

export default function HqStructurePolicyView({ month, employeeIds = [], authUserId = '' }) {
  const emptyProjection = calculateHqStructureProjection({ month });
  const [state, setState] = useState({
    loading: true,
    error: '',
    result: emptyProjection.current.selfStore,
    retail: emptyProjection.current.retail,
    salesMetric: emptyProjection.current.salesMetric,
    award: emptyProjection.current.award,
    homeGrade: emptyProjection.current.homeGrade,
    homeInternetRatio: emptyProjection.current.homeInternetRatio,
    homeAward: emptyProjection.current.homeAward,
    iptvGrade: emptyProjection.current.iptvGrade,
    forecast: emptyProjection.forecast,
    runRate: emptyProjection.runRate,
    currentTotalAmount: emptyProjection.currentTotalAmount,
    forecastTotalAmount: emptyProjection.forecastTotalAmount,
  });
  const [changeSupportRatio,setChangeSupportRatio]=useState('');
  const [awardSaving,setAwardSaving]=useState(false);
  const [policyTab, setPolicyTab] = useState('base');

  useEffect(() => {
    let alive = true;
    if (!employeeIds.length) {
      const projection = calculateHqStructureProjection({ month });
      setState({ loading: false, error: '', result: projection.current.selfStore, retail: projection.current.retail, salesMetric: projection.current.salesMetric, award: projection.current.award, homeGrade: projection.current.homeGrade, homeInternetRatio: projection.current.homeInternetRatio, homeAward: projection.current.homeAward, iptvGrade: projection.current.iptvGrade, forecast: projection.forecast, runRate: projection.runRate, currentTotalAmount: projection.currentTotalAmount, forecastTotalAmount: projection.forecastTotalAmount });
      return () => { alive = false; };
    }
    (async () => {
      setState(prev => ({ ...prev, loading: true, error: '' }));
      const [year, monthNumber] = month.split('-').map(Number);
      const next = new Date(year, monthNumber, 1);
      const to = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`;
      const [salesResult, homeResult, dailyResult, awardInputResult] = await Promise.all([
        supabase.from('customer_sales')
          .select('id,user_id,source_type,source_meta,sale_date')
          .in('user_id', employeeIds).gte('sale_date', `${month}-01`).lt('sale_date', to),
        supabase.from('home_orders')
          .select('id,user_id,customer_id,customer_name,product_type,network_type,main_tv_plan,status,actual_install_date')
          .in('user_id', employeeIds).eq('status', 'completed')
          .gte('actual_install_date', `${month}-01`).lt('actual_install_date', to),
        supabase.from('daily_records').select('user_id,data').in('user_id', employeeIds)
          .gte('work_date', `${month}-01`).lt('work_date', to),
        supabase.from('hq_structure_monthly_inputs').select('change_support_ratio').eq('month',month).maybeSingle(),
      ]);
      if (salesResult.error || homeResult.error || dailyResult.error || awardInputResult.error) throw salesResult.error || homeResult.error || dailyResult.error || awardInputResult.error;

      let hs = 0, mnp = 0, new010 = 0, change95Plus = 0, changeUnder95 = 0, simMnp = 0, plan115Hs = 0;
      let second = 0;
      (salesResult.data || []).filter(row => row.source_type === 'mobile').forEach(row => {
        const meta = row.source_meta || {};
        const rowIndex = Number(meta.ri);
        if ([0, 1, 2, 3, 4].includes(rowIndex)) {
          hs += 1;
          if (Number(meta.ci) === 0) plan115Hs += 1;
        }
        if (rowIndex === 0) new010 += 1;
        if (rowIndex === 1) mnp += 1;
        if ([2, 3, 4].includes(rowIndex)) {
          if ([0, 1].includes(Number(meta.ci))) change95Plus += 1;
          else changeUnder95 += 1;
        }
        if (rowIndex === 5) simMnp += 1;
        if (rowIndex === 7) second += 1;
        second += Array.isArray(meta.bundle2ndKeys) ? meta.bundle2ndKeys.length : 0;
      });

      const completed = homeResult.data || [];
      const bundleKey = row => `${String(row.actual_install_date || '').slice(0, 10)}|${row.customer_id || row.customer_name || row.id}`;
      const householdCompleted = completed.filter(row => row.network_type === 'household' || !row.network_type);
      const internet = new Set(completed
        .filter(row => ['internet1g', 'internet500', 'internet100', 'homeOnly', 'homeTv'].includes(row.product_type))
        .map(bundleKey)).size;
      const householdInternet = new Set(householdCompleted
        .filter(row => ['internet1g', 'internet500', 'internet100', 'homeOnly', 'homeTv'].includes(row.product_type))
        .map(bundleKey)).size;
      const householdInternetKeys = new Set(householdCompleted
        .filter(row => ['internet1g', 'internet500', 'internet100', 'homeOnly', 'homeTv'].includes(row.product_type))
        .map(bundleKey));
      const householdMainTvKeys = new Set(householdCompleted.filter(row => row.product_type === 'homeTv').map(bundleKey));
      const household100Keys = new Set(householdCompleted.filter(row => row.product_type === 'internet100').map(bundleKey));
      const homeAwardPayableInternet = [...householdInternetKeys]
        .filter(key => !household100Keys.has(key) || householdMainTvKeys.has(key)).length;
      const smartHome = completed.filter(row => row.product_type === 'smartHome').length;
      const extraSetTop = completed.filter(row => ['subSetTop', 'tvFree'].includes(row.product_type)).length;
      const mainTv = householdCompleted.filter(row => row.product_type === 'homeTv').length;
      const householdExtraSetTop = householdCompleted.filter(row => ['subSetTop', 'tvFree'].includes(row.product_type)).length;
      const householdTvFree = householdCompleted.filter(row => row.product_type === 'tvFree').length;
      const householdSmartHome = householdCompleted.filter(row => row.product_type === 'smartHome').length;
      const householdInternet1g = new Set(householdCompleted.filter(row => row.product_type === 'internet1g').map(bundleKey)).size;
      const iptv17Plus = new Set(householdCompleted
        .filter(row => row.product_type === 'homeTv' && row.main_tv_plan === 'broadcastPass')
        .map(bundleKey)).size;
      const renewalRecognized = (dailyResult.data || []).reduce((sum, row) => sum
        + (row.data?.householdRenewals || []).reduce((itemSum, item) => itemSum + (item?.speedUp ? 1 : 0.3), 0), 0);
      const mobileSales = (salesResult.data || []).filter(row => row.source_type === 'mobile');
      const { strategicPointsWithoutDaemyung, daemyungCount } = summarizeVasQuality(mobileSales);
      const sono = (dailyResult.data || []).reduce((sum, row) => sum + Object.values(row.data?.groups?.sono || {}).reduce((a, value) => a + Number(value || 0), 0), 0);
      const salesMetricPoints = Number(strategicPointsWithoutDaemyung || 0) + Math.max(Number(daemyungCount || 0), sono) * 2;
      const savedChangeSupportRatio = awardInputResult.data?.change_support_ratio;
      const projection = calculateHqStructureProjection({
        month,
        selfStoreInput: { hs, second, internet, smartHome, extraSetTop },
        retailInput: { hs, plan115Hs, mnp, new010, change95Plus, changeUnder95, second, simMnp },
        salesMetricInput: { hs, salesMetricPoints },
        awardInput: { hs, mnp, new010, change:change95Plus+changeUnder95, simMnp, internet, salesMetricPoints, changeSupportRatio:savedChangeSupportRatio },
        homeGradeInput: { hs, internet: householdInternet, renewalRecognized, mainTv, extraSetTop: householdExtraSetTop },
        homeInternetRatioInput: { hs, internet: householdInternet, mainTv, extraSetTop: householdExtraSetTop },
        homeAwardInput: { hs, internet: householdInternet, payableInternet: homeAwardPayableInternet, mainTv, iptv17Plus, extraSetTop: householdExtraSetTop, tvFree: householdTvFree, internet1g: householdInternet1g, smartHome: householdSmartHome },
        iptvGradeInput: { mainTv, extraSetTop: householdExtraSetTop },
      });
      if (alive) {
        setChangeSupportRatio(savedChangeSupportRatio??'');
        setState({
          loading: false,
          error: '',
          result: projection.current.selfStore,
          retail: projection.current.retail,
          salesMetric: projection.current.salesMetric,
          award: projection.current.award,
          homeGrade:projection.current.homeGrade,
          homeInternetRatio: projection.current.homeInternetRatio,
          homeAward: projection.current.homeAward,
          iptvGrade: projection.current.iptvGrade,
          forecast: projection.forecast,
          runRate: projection.runRate,
          currentTotalAmount: projection.currentTotalAmount,
          forecastTotalAmount: projection.forecastTotalAmount,
        });
      }
    })().catch(error => {
      console.error('HQ STRUCTURE POLICY LOAD ERROR', error);
      if (alive) setState(prev => ({ ...prev, loading: false, error: '본사 구조정책 실적을 불러오지 못했어요.' }));
    });
    return () => { alive = false; };
  }, [month, employeeIds.join('|')]);

  const { result, retail, salesMetric, award, homeGrade, homeInternetRatio, homeAward, iptvGrade, forecast, runRate } = state;
  const forecastSelfStore = forecast?.selfStore || result;
  const forecastRetail = forecast?.retail || retail;
  const forecastSalesMetric = forecast?.salesMetric || salesMetric;
  const forecastAward = forecast?.award || award;
  const forecastHomeGrade=forecast?.homeGrade||homeGrade;
  const forecastHomeInternetRatio = forecast?.homeInternetRatio || homeInternetRatio;
  const forecastHomeAward = forecast?.homeAward || homeAward;
  const forecastIptvGrade = forecast?.iptvGrade || iptvGrade;
  const forecastPaceText = runRate?.isCurrentMonth
    ? `${runRate.elapsedDays}일 누적 속도 × ${countText(runRate.factor)}로 월말까지 환산`
    : runRate?.isPastMonth ? '종료된 월은 실제 마감 실적으로 표시' : '현재 실적 기준';
  const saveChangeSupportRatio=async()=>{
    setAwardSaving(true);
    const value=Math.max(0,Math.min(100,Number(changeSupportRatio||0)));
    const {error}=await supabase.from('hq_structure_monthly_inputs').upsert({month,change_support_ratio:value,updated_by:authUserId,updated_at:new Date().toISOString()},{onConflict:'month'});
    setAwardSaving(false);
    if(error){setState(prev=>({...prev,error:'유통망지원금 활용 비중을 저장하지 못했어요.'}));return}
    setState(prev=>{
      const nextAward=calculateRetailMonthlyAward({...prev.award,changeSupportRatio:value});
      const nextForecastAward=calculateRetailMonthlyAward({...prev.forecast?.award,changeSupportRatio:value});
      return {
        ...prev,
        error:'',
        award:nextAward,
        forecast:{...prev.forecast,award:nextForecastAward},
        currentTotalAmount:Number(prev.result?.totalAmount||0)+Number(prev.retail?.totalAmount||0)+Number(prev.salesMetric?.totalAmount||0)+Number(nextAward.totalAmount||0)+Number(prev.homeGrade?.totalAmount||0)+Number(prev.homeInternetRatio?.totalAmount||0)+Number(prev.homeAward?.totalAmount||0)+Number(prev.iptvGrade?.totalAmount||0),
        forecastTotalAmount:Number(prev.forecast?.selfStore?.totalAmount||0)+Number(prev.forecast?.retail?.totalAmount||0)+Number(prev.forecast?.salesMetric?.totalAmount||0)+Number(nextForecastAward.totalAmount||0)+Number(prev.forecast?.homeGrade?.totalAmount||0)+Number(prev.forecast?.homeInternetRatio?.totalAmount||0)+Number(prev.forecast?.homeAward?.totalAmount||0)+Number(prev.forecast?.iptvGrade?.totalAmount||0),
      };
    });
  };

  const selfNeeded = result.recognized < result.baseline ? Math.ceil(result.baseline + 1 - result.recognized) : 1;
  const selfNext = calculateSelfStoreOperatingSupport({ hs: result.recognized + selfNeeded });
  const selfGuide = {
    text: result.recognized < result.baseline ? `인정실적 ${countText(selfNeeded)}건 추가 시 최초 지급 구간 진입` : `인정실적 1건 추가 시 초과구간 수혜 증가`,
    increase: positiveIncrease(selfNext.totalAmount, result.totalAmount),
  };

  const retailBoundary = nextAbove(retail.points, [150, 301, 401, 501, 701, 1001, 1501]);
  const retailNeeded = retailBoundary ? retailBoundary - retail.points : 1;
  const retailNext = calculateRetailPartnerMonthlyPolicy({ hs: retail.hs, plan115Hs: retail.plan115Hs, second: retail.points + retailNeeded });
  const retailGuide = {
    text: retailBoundary ? `${countText(retailNeeded)}P 추가 시 ${countText(retailBoundary)}P 구간 진입` : '최고 단가 구간 · 1P 추가 수혜',
    increase: positiveIncrease(retailNext.totalAmount, retail.totalAmount),
  };

  const salesThreshold = nextAbove(salesMetric.achievement, [80, 100, 120, 140, 160, 180, 200]);
  const salesNeeded = salesThreshold ? Math.max(0, Math.ceil(salesMetric.hs * salesThreshold / 100 - salesMetric.points)) : 1;
  const salesNext = calculateSalesMetricActivation({ hs: salesMetric.hs, salesMetricPoints: salesMetric.points + salesNeeded });
  const salesGuide = {
    text: salesThreshold ? `매출지표 ${countText(salesNeeded)}P 추가 시 달성률 ${salesThreshold}% 구간` : '최고 단가 구간 · 매출지표 1P 추가 수혜',
    increase: positiveIncrease(salesNext.totalAmount, salesMetric.totalAmount),
    assumption: '현재 HS 유지 가정',
  };

  const awardThreshold = nextAbove(award.totalScore, [10, 12, 14, 16]);
  const awardRates = awardThreshold >= 16 ? { mnp: 55000, new010: 49500, change: 16500 }
    : awardThreshold >= 14 ? { mnp: 49500, new010: 44000, change: 11000 }
      : awardThreshold >= 12 ? { mnp: 44000, new010: 38500, change: 5500 }
        : awardThreshold >= 10 ? { mnp: 38500, new010: 33000, change: 0 } : award.rates;
  const awardNextAmount = award.mnp * awardRates.mnp + award.new010 * awardRates.new010 + award.change * awardRates.change;
  const awardGuide = {
    text: awardThreshold ? `지표점수 ${awardThreshold - award.totalScore}점 추가 시 ${awardThreshold}점 지급 구간` : '최고 지급 구간 달성',
    increase: positiveIncrease(awardNextAmount, award.totalAmount),
  };

  const homeGradeTvThreshold = nextAbove(homeGrade.tvRatio, [8, 9, 10, 11, 12, 13, 14, 15]);
  const homeGradeTvNeeded = homeGradeTvThreshold ? Math.max(0.5, Math.ceil((homeGrade.hs * homeGradeTvThreshold / 100 - homeGrade.tvRecognized) * 2) / 2) : 0;
  const homeGradeNext = homeGradeTvThreshold ? calculateHomeGradePolicy({ ...homeGrade, mainTv: homeGrade.mainTv + homeGradeTvNeeded }) : homeGrade;
  const homeGradeGuide = {
    text: homeGradeTvThreshold ? `TV 인정 ${countText(homeGradeTvNeeded)}건 추가 시 비중 ${homeGradeTvThreshold}% 지급률 구간` : 'TV 비중 최고 지급률 구간 달성',
    increase: positiveIncrease(homeGradeNext.totalAmount, homeGrade.totalAmount),
    assumption: '현재 HS·인터넷·재약정 유지 가정',
  };

  const homeRatioThreshold = nextAbove(homeInternetRatio.internetRatio, [7, 8, 9, 10, 12, 14]);
  const homeRatioNeeded = homeRatioThreshold ? Math.max(1, Math.ceil(homeInternetRatio.hs * homeRatioThreshold / 100 - homeInternetRatio.internet)) : 0;
  const homeRatioNext = homeRatioThreshold ? calculateHomeInternetRatioPolicy({ ...homeInternetRatio, internet: homeInternetRatio.internet + homeRatioNeeded }) : homeInternetRatio;
  const homeRatioGuide = {
    text: homeRatioThreshold ? `인터넷 ${countText(homeRatioNeeded)}건 추가 시 비중 ${homeRatioThreshold}% 구간` : '인터넷 비중 최고 구간 달성',
    increase: positiveIncrease(homeRatioNext.totalAmount, homeInternetRatio.totalAmount),
    assumption: '현재 HS·TV 실적 유지 가정',
  };

  const homeAwardThreshold = homeAward.totalScore < 4 ? 4 : homeAward.totalScore < 18 ? homeAward.totalScore + 1 : null;
  const homeAwardRate = homeAwardThreshold ? ({4:55000,5:60500,6:66000,7:71500,8:77000,9:88000,10:99000,11:110000,12:121000,13:132000,14:143000,15:154000,16:165000,17:176000,18:187000}[homeAwardThreshold] || 0) : homeAward.pointRate;
  const homeAwardGuide = {
    text: homeAwardThreshold ? `유효 지표점수 ${homeAwardThreshold - homeAward.totalScore}점 추가 시 ${homeAwardThreshold}점 구간` : '최고 18점 이상 구간 달성',
    increase: positiveIncrease(homeAward.payableInternet * homeAwardRate, homeAward.totalAmount),
  };

  const iptvThreshold = nextAbove(iptvGrade.points, [20, 30, 50, 100, 150, 200, 300, 400, 500]);
  const iptvNeeded = iptvThreshold ? iptvThreshold - iptvGrade.points : 1;
  const iptvNext = calculateIptvGradePolicy({ mainTv: iptvGrade.mainTv + iptvNeeded, extraSetTop: iptvGrade.extraSetTop });
  const iptvGuide = {
    text: iptvThreshold ? `${countText(iptvNeeded)}P 추가 시 ${countText(iptvThreshold)}P Grade 구간` : '최고 단가 구간 · 주셋탑 1건 추가 수혜',
    increase: positiveIncrease(iptvNext.totalAmount, iptvGrade.totalAmount),
  };
  return <div className="space-y-4">
    <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-violet-900 p-5 text-white">
      <div className="flex items-center gap-2 text-xs font-bold text-violet-200"><Building2 size={15}/> 본사 구조정책</div>
      <div className="mt-2 text-xl font-black">{month.replace('-', '년 ')}월 마감 전망</div>
      <div className="mt-1 text-xs text-slate-300">자가매장 운영비 · 월간판매량 · 매출지표 · 월간 시상 · 홈 구조정책 합계</div>
      {state.loading ? <div className="mt-6 flex items-center gap-2 text-sm text-slate-300"><Loader2 size={16} className="animate-spin"/> 계산 중...</div> : <>
        {runRate?.isCurrentMonth ? <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-end gap-2 rounded-2xl bg-white/10 p-4">
          <div className="min-w-0"><div className="text-[10px] text-slate-300">현재 실적 기준 합계</div><div className="mt-1 whitespace-nowrap text-xl font-black">{wonText(state.currentTotalAmount)}</div></div>
          <div className="pb-1 text-xl text-violet-300">→</div>
          <div className="min-w-0 text-right"><div className="text-[10px] text-violet-200">월말 예상 합계</div><div className="mt-1 whitespace-nowrap text-xl font-black text-white">{wonText(state.forecastTotalAmount)}</div></div>
        </div> : <div className="mt-5 rounded-2xl bg-white/10 p-4"><div className="text-[10px] text-slate-300">마감 기준 합계</div><div className="mt-1 text-2xl font-black">{wonText(state.currentTotalAmount)}</div></div>}
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">{[
          ['자가매장 운영비', forecastSelfStore.totalAmount],
          ['월간판매량', forecastRetail.totalAmount],
          ['매출지표', forecastSalesMetric.totalAmount],
          ['월간 시상', forecastAward.totalAmount],
          ['홈 Grade',forecastHomeGrade.totalAmount],
          ['HS 대비 인터넷', forecastHomeInternetRatio.totalAmount],
          ['홈 시상', forecastHomeAward.totalAmount],
          ['IPTV Grade', forecastIptvGrade.totalAmount],
        ].map(([label,value])=><div key={label} className="rounded-xl bg-white/10 px-3 py-2.5"><div className="text-[9px] text-slate-300">{runRate?.isCurrentMonth?'월말 예상 · ':''}{label}</div><div className="mt-1 text-sm font-black">{wonText(value)}</div></div>)}</div>
        <div className="mt-2 text-[10px] text-slate-300">{forecastPaceText} · 정책 구간과 지급률을 다시 계산한 예상치</div>
      </>}
    </div>

    {state.error && <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs text-red-600">{state.error}</div>}

    <div className="grid grid-cols-2 gap-1 rounded-2xl bg-gray-100 p-1">
      {[
        ['base', '기존 구조정책', '4개'],
        ['home', '홈 구조정책', '4개'],
      ].map(([key, label, count]) => <button key={key} type="button" onClick={() => setPolicyTab(key)} className={`rounded-xl px-3 py-3 text-xs font-bold transition ${policyTab === key ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500'}`}><span>{label}</span><span className={`ml-1.5 text-[9px] ${policyTab === key ? 'text-violet-400' : 'text-gray-400'}`}>{count}</span></button>)}
    </div>

    {policyTab === 'home' && <>

    <div className="rounded-2xl border border-sky-100 bg-white overflow-hidden">
      <div className="bg-sky-50 px-4 py-4"><div className="text-lg font-black text-gray-900">홈 Grade 정책</div><div className="mt-1 text-[10px] text-gray-500">인터넷 설치완료·약정갱신 구간 단가에 가정망 TV 비중 지급률을 적용합니다.</div></div>
      <ForecastAmountStrip currentAmount={homeGrade.totalAmount} forecastAmount={forecastHomeGrade.totalAmount} runRate={runRate} tone="indigo" detail={`현재 인터넷 ${countText(homeGrade.internet)}건 · 월말 예상 ${countText(forecastHomeGrade.internet)}건`} />
      <BenefitGuide {...homeGradeGuide} />
      <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4">{[
        ['인터넷 설치완료',`${countText(homeGrade.internet)}건`],
        ['약정갱신 인정',`${countText(homeGrade.renewalRecognized)}건 → ${homeGrade.roundedRenewal}건`],
        ['건당 Grade',wonText(homeGrade.pointRate)],
        ['TV 지급률',`${countText(homeGrade.tvRatio)}% → ${countText(homeGrade.paymentRate*100)}%`],
      ].map(([label,value])=><div key={label} className="rounded-xl bg-gray-50 p-3"><div className="text-[10px] text-gray-400">{label}</div><div className="mt-1 text-sm font-black text-sky-700">{value}</div></div>)}</div>
      <div className="border-t px-4 py-3 text-[10px] leading-relaxed text-gray-500">기본금액 {countText(homeGrade.internet)}건 × {wonText(homeGrade.pointRate)} = {wonText(homeGrade.baseAmount)}<br/>TV 비중 = (가정망 주셋탑 {countText(homeGrade.mainTv)}건 + 부셋탑(프리 포함) {countText(homeGrade.extraSetTop)}건 × 0.5) ÷ HS {countText(homeGrade.hs)}건<br/>SIM MNP·소호·멀티라인 제외 · 동일 요금제 재약정 0.3건, 속도 상향 재약정 1건</div>
    </div>

    <div className="rounded-2xl border border-cyan-100 bg-white overflow-hidden">
      <div className="bg-cyan-50 px-4 py-4"><div className="text-lg font-black text-gray-900">HS 대비 인터넷 비중 목표 정책</div><div className="mt-1 text-[10px] text-gray-500">가정망 인터넷 설치완료 비중과 HS 구간의 건당 단가에 TV 비중 지급률을 적용합니다.</div></div>
      <ForecastAmountStrip currentAmount={homeInternetRatio.totalAmount} forecastAmount={forecastHomeInternetRatio.totalAmount} runRate={runRate} tone="indigo" detail={`현재 인터넷 비중 ${countText(homeInternetRatio.internetRatio)}% · 월말 예상 ${countText(forecastHomeInternetRatio.internetRatio)}%`} />
      <BenefitGuide {...homeRatioGuide} />
      <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4">{[
        ['HS', `${countText(homeInternetRatio.hs)}건`],
        ['인터넷 설치완료', `${countText(homeInternetRatio.internet)}건`],
        ['인터넷 비중', `${countText(homeInternetRatio.internetRatio)}%`],
        ['건당 인센티브', wonText(homeInternetRatio.pointRate)],
        ['기본금액', wonText(homeInternetRatio.baseAmount)],
        ['TV 인정', `${countText(homeInternetRatio.tvRecognized)}건`],
        ['TV 비중', `${countText(homeInternetRatio.tvRatio)}%`],
        ['TV 지급률', `${countText(homeInternetRatio.paymentRate * 100)}%`],
      ].map(([label,value])=><div key={label} className="rounded-xl bg-gray-50 p-3"><div className="text-[10px] text-gray-400">{label}</div><div className="mt-1 text-sm font-black text-cyan-700">{value}</div></div>)}</div>
      <div className="border-t px-4 py-3 text-[10px] leading-relaxed text-gray-500">인터넷 비중 = 가정망 설치완료 인터넷 ÷ SIM MNP 제외 HS<br/>최종금액 = 인터넷 설치완료 × HS·인터넷 비중 교차단가 × TV 지급률<br/>TV 인정 = 가정망 주셋탑 1건 + 부셋탑(프리 포함) 0.5건 · 소호·멀티라인 제외</div>
    </div>

    <div className="rounded-2xl border border-teal-100 bg-white overflow-hidden">
      <div className="bg-teal-50 px-4 py-4"><div className="text-lg font-black text-gray-900">홈 시상 정책</div><div className="mt-1 text-[10px] text-gray-500">사운드바를 제외한 5개 지표 점수를 합산해 가정망 인터넷 설치완료 건당 금액을 계산합니다.</div></div>
      <ForecastAmountStrip currentAmount={homeAward.totalAmount} forecastAmount={forecastHomeAward.totalAmount} runRate={runRate} tone="emerald" detail={`현재 ${homeAward.totalScore}점 · 월말 예상 ${forecastHomeAward.totalScore}점`} />
      <BenefitGuide {...homeAwardGuide} />
      <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4">{[
        ['합산점수', `${homeAward.totalScore}점`],
        ['인터넷 개통건', `${countText(homeAward.payableInternet)}건`],
        ['건당 금액', wonText(homeAward.pointRate)],
        ['최종금액', wonText(homeAward.totalAmount)],
      ].map(([label,value])=><div key={label} className="rounded-xl bg-gray-50 p-3"><div className="text-[10px] text-gray-400">{label}</div><div className="mt-1 text-sm font-black text-teal-700">{value}</div></div>)}</div>
      <div className="border-t divide-y divide-gray-50">{[
        ['① IPTV 17군 이상 유지비중','iptv17Plus',homeAward.counts.iptv17Plus,homeAward.mainTv,'방송패스 주셋탑','전체 주셋탑'],
        ['②-1 추가셋탑 유지비중','extraSetTop',homeAward.counts.extraSetTop,homeAward.mainTv,'부셋탑(프리 포함)','전체 주셋탑'],
        ['②-2 TV프리 유지비중','tvFree',homeAward.counts.tvFree,homeAward.hs,'TV프리','SIM MNP 제외 HS'],
        ['④ 1G 유치비중','internet1g',homeAward.counts.internet1g,homeAward.internet,'1G 인터넷','가정망 인터넷'],
        ['⑤ 스마트홈 유치비중','smartHome',homeAward.counts.smartHome,homeAward.internet,'스마트홈','가정망 인터넷'],
      ].map(([label,key,numerator,denominator,numeratorLabel,denominatorLabel])=><div key={key} className="px-4 py-3 text-xs">
        <div className="flex items-center justify-between gap-3"><span className="font-semibold text-gray-700">{label}</span><b className="shrink-0 text-teal-700">{homeAward.scores[key]}점</b></div>
        <div className="mt-1 text-[10px] text-gray-500">{numeratorLabel} {countText(numerator)}건 ÷ {denominatorLabel} {countText(denominator)}건 = <b className="text-gray-700">{countText(homeAward.ratios[key])}%</b></div>
      </div>)}</div>
      <div className="border-t px-4 py-3 text-[10px] leading-relaxed text-gray-500">②번 점수는 추가셋탑과 TV프리 점수를 모두 더하지 않고 둘 중 높은 점수 하나만 반영합니다.<br/>사운드바는 입력·점수 산정에서 제외합니다. 가정망 설치완료 기준이며 소호는 제외합니다.<br/>부셋탑 수량에는 일반 부셋탑과 TV프리(부)를 모두 인정합니다.<br/>인터넷 100M 단독은 지표에는 포함하되 지급 인터넷에서는 제외합니다.</div>
    </div>

    <div className="rounded-2xl border border-blue-100 bg-white overflow-hidden">
      <div className="bg-blue-50 px-4 py-4"><div className="text-lg font-black text-gray-900">IPTV Grade 정책</div><div className="mt-1 text-[10px] text-gray-500">가정망 설치완료 주셋탑과 부셋탑(프리 포함)의 포인트 구간별 인센티브입니다.</div></div>
      <ForecastAmountStrip currentAmount={iptvGrade.totalAmount} forecastAmount={forecastIptvGrade.totalAmount} runRate={runRate} tone="indigo" detail={`현재 ${countText(iptvGrade.points)}P · 월말 예상 ${countText(forecastIptvGrade.points)}P`} />
      <BenefitGuide {...iptvGuide} />
      <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4">{[
        ['주셋탑', `${countText(iptvGrade.mainTv)}건 × 1P`],
        ['부셋탑(프리 포함)', `${countText(iptvGrade.extraSetTop)}건 × 0.5P`],
        ['총 IPTV 포인트', `${countText(iptvGrade.points)}P`],
        ['1P당 인센티브', wonText(iptvGrade.pointRate)],
      ].map(([label,value])=><div key={label} className="rounded-xl bg-gray-50 p-3"><div className="text-[10px] text-gray-400">{label}</div><div className="mt-1 text-sm font-black text-blue-700">{value}</div></div>)}</div>
      <div className="border-t px-4 py-3 text-[10px] leading-relaxed text-gray-500">최종금액 = 총 IPTV 포인트 × 적용 구간의 1P당 인센티브<br/>20P 미만 미지급 · 소호·멀티라인·납부 관련 제한은 적용하지 않습니다.</div>
    </div>

    </>}

    {policyTab === 'base' && <>

    <div className="rounded-2xl border border-violet-100 bg-white overflow-hidden">
      <div className="bg-violet-50 px-4 py-4"><div className="text-lg font-black text-gray-900">자가매장 운영비 지원제도</div><div className="mt-1 text-[10px] text-gray-500">인정 실적이 회사 기준 668건을 넘는 구간부터 누진 지급합니다.</div></div>
      <ForecastAmountStrip currentAmount={result.totalAmount} forecastAmount={forecastSelfStore.totalAmount} runRate={runRate} detail={`현재 ${countText(result.recognized)}건 · 월말 예상 ${countText(forecastSelfStore.recognized)}건`} />
      <BenefitGuide {...selfGuide} />
      <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4">{[
        ['현재 인정', `${countText(result.recognized)}건`],
        ['월말 예상 인정', `${countText(forecastSelfStore.recognized)}건`],
        ['회사 기준', `${countText(result.baseline)}건`],
        ['예상 초과', `${countText(forecastSelfStore.excess)}건`],
      ].map(([label,value])=><div key={label} className="rounded-xl bg-gray-50 p-3"><div className="text-[10px] text-gray-400">{label}</div><div className="mt-1 text-base font-black text-violet-700">{value}</div></div>)}</div>
    </div>

    <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
      <div className="border-b px-4 py-3"><div className="text-sm font-bold">인정 실적 산식</div><div className="mt-0.5 text-[10px] text-gray-400">SIM MNP는 제외하며 홈 상품은 실제 설치 완료일 기준입니다.</div></div>
      <div className="divide-y divide-gray-50">
        {Object.keys(SELF_STORE_WEIGHTS).map(key => <div key={key} className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3">
          <div className="min-w-0"><div className="text-xs font-semibold text-gray-700">{PRODUCT_LABELS[key]}</div><div className="mt-1 text-[10px] text-gray-400">{key==='hs'?'SIM MNP 제외 · ':''}{countText(result.counts[key])}건 × {SELF_STORE_WEIGHTS[key]}</div></div>
          <div className="text-sm font-black text-violet-700">{countText(result.counts[key] * SELF_STORE_WEIGHTS[key])}건</div>
        </div>)}
      </div>
    </div>

    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-2xl border border-gray-100 bg-white p-4"><div className="text-sm font-bold">기준 수량 668건</div><div className="mt-3 grid grid-cols-2 gap-2">{Object.entries(SELF_STORE_BASELINE).map(([key, value]) => <div key={key} className="flex justify-between rounded-lg bg-gray-50 px-3 py-2 text-xs"><span className="text-gray-500">{BASELINE_LABELS[key]}</span><b>{value}건</b></div>)}</div></div>
      <div className="rounded-2xl border border-gray-100 bg-white p-4"><div className="text-sm font-bold">초과 구간별 예상 지급</div><div className="mt-3 space-y-2"><div className="flex justify-between rounded-xl bg-violet-50 p-3 text-xs"><span>초과 1~150건 · 건당 5만원</span><b className="text-violet-700">{countText(result.tier1Count)}건 · {wonText(result.tier1Amount)}</b></div><div className="flex justify-between rounded-xl bg-indigo-50 p-3 text-xs"><span>초과 151번째부터 · 건당 6만원</span><b className="text-indigo-700">{countText(result.tier2Count)}건 · {wonText(result.tier2Amount)}</b></div></div><div className="mt-3 text-[10px] leading-relaxed text-gray-400">151건을 넘겨도 앞선 150건의 단가는 바뀌지 않습니다. 월말 최종 개통·설치 상태에 따라 확정 금액은 달라질 수 있어요.</div></div>
    </div>

    <div className="rounded-2xl border border-indigo-100 bg-white overflow-hidden">
      <div className="bg-indigo-50 px-4 py-4"><div className="text-lg font-black text-gray-900">월간판매량 정책</div><div className="mt-1 text-[10px] text-gray-500">월 포인트 구간별 누진금액에 115군 비중 지급률을 적용합니다.</div></div>
      <ForecastAmountStrip currentAmount={retail.totalAmount} forecastAmount={forecastRetail.totalAmount} runRate={runRate} tone="indigo" detail={`현재 ${countText(retail.points)}P · 월말 예상 ${countText(forecastRetail.points)}P`} />
      <BenefitGuide {...retailGuide} />
      <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4">{[
        ['월 포인트', `${countText(retail.points)}P`],
        ['115군 비중', `${countText(retail.plan115Ratio)}%`],
        ['지급률', `${countText(retail.paymentRate * 100)}%`],
        ['현재 기준액', wonText(retail.totalAmount)],
      ].map(([label,value])=><div key={label} className="rounded-xl bg-gray-50 p-3"><div className="text-[10px] text-gray-400">{label}</div><div className="mt-1 text-base font-black text-indigo-700">{value}</div></div>)}</div>
      <div className="border-t px-4 py-3"><div className="text-xs font-bold text-gray-700">포인트 구간별 계산</div><div className="mt-2 space-y-1.5">{retail.tiers.map((tier,index)=><div key={tier.from} className="rounded-lg bg-gray-50 px-3 py-2 text-[11px]"><div className="flex items-center justify-between gap-3"><span className="font-semibold text-gray-700">{index===0?'150~300P':index===retail.tiers.length-1?'1,501P 이상':`${tier.from+1}~${tier.to}P`}</span><b>{wonText(tier.amount)}</b></div><div className="mt-1 flex items-center justify-between gap-3 text-[10px] text-gray-400"><span>1P당 {wonText(tier.rate)}</span><span>적용 {countText(tier.pointCount)}P</span></div></div>)}</div></div>
      <div className="border-t px-4 py-3 text-[10px] leading-relaxed text-gray-500"><b className="text-gray-700">포인트:</b> MNP·010신규 2P, 기변 95군↑ 1P, 기변 95군 미만 0.3P, 2ND·SIM MNP 1P<br/><b className="text-gray-700">115군 비중:</b> HS 중 115군 비중이며 SIM MNP는 분모·자수 모두 제외 · 40%↑ 110%, 50%↑ 120%, 60%↑ 130%</div>
    </div>

    <div className="rounded-2xl border border-emerald-100 bg-white overflow-hidden">
      <div className="bg-emerald-50 px-4 py-4"><div className="text-lg font-black text-gray-900">매출지표 활성화 정책</div><div className="mt-1 text-[10px] text-gray-500">직원 매출지표와 동일한 기준으로 달성률과 1P당 단가를 계산합니다.</div></div>
      <ForecastAmountStrip currentAmount={salesMetric.totalAmount} forecastAmount={forecastSalesMetric.totalAmount} runRate={runRate} tone="emerald" detail={`현재 ${countText(salesMetric.points)}P · 월말 예상 ${countText(forecastSalesMetric.points)}P`} />
      <BenefitGuide {...salesGuide} />
      <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4">{[
        ['HS', `${countText(salesMetric.hs)}건`],
        ['매출지표', `${countText(salesMetric.points)}P`],
        ['달성률', `${countText(salesMetric.achievement)}%`],
        ['현재 기준액', wonText(salesMetric.totalAmount)],
      ].map(([label,value])=><div key={label} className="rounded-xl bg-gray-50 p-3"><div className="text-[10px] text-gray-400">{label}</div><div className="mt-1 text-base font-black text-emerald-700">{value}</div></div>)}</div>
      <div className="border-t px-4 py-3"><div className="flex items-center justify-between rounded-xl bg-emerald-50 p-3 text-xs"><span>현재 적용 단가</span><b className="text-emerald-700">{salesMetric.pointRate ? `달성률 ${salesMetric.threshold}% 구간 · 1P당 ${wonText(salesMetric.pointRate)}` : '80% 미만 · 미지급'}</b></div><div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">{[[80,4400],[100,6600],[120,8800],[140,11000],[160,13200],[180,15400],[200,17600]].map(([pct,rate])=><div key={pct} className={`rounded-lg px-2 py-2 text-center text-[10px] ${salesMetric.threshold===pct?'bg-emerald-600 text-white':'bg-gray-50 text-gray-500'}`}><b>{pct}%</b><br/>{wonText(rate)}/P</div>)}</div></div>
      <div className="border-t px-4 py-3 text-[10px] leading-relaxed text-gray-500">전략요금제 0.5P · 보험류 0.8P · 전략 VAS 1P · 소노 2P<br/>최종 지급액 = 매출지표 총 P × 달성 구간의 1P당 단가</div>
    </div>

    <div className="rounded-2xl border border-amber-100 bg-white overflow-hidden">
      <div className="bg-amber-50 px-4 py-4"><div className="text-lg font-black text-gray-900">소매 월간 시상 정책</div><div className="mt-1 text-[10px] text-gray-500">5개 지표의 최고 달성점수를 합산해 MNP·010 신규·기변 단가를 결정합니다.</div></div>
      <ForecastAmountStrip currentAmount={award.totalAmount} forecastAmount={forecastAward.totalAmount} runRate={runRate} tone="amber" detail={`현재 ${award.totalScore}점 · 월말 예상 ${forecastAward.totalScore}점`} />
      <BenefitGuide {...awardGuide} />
      <div className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-3">{[
        ['MNP', award.mnp, award.rates.mnp, award.amounts.mnp],
        ['010 신규', award.new010, award.rates.new010, award.amounts.new010],
        ['기변', award.change, award.rates.change, award.amounts.change],
      ].map(([label,count,rate,amount])=><div key={label} className="rounded-xl bg-gray-50 p-3"><div className="flex items-center justify-between gap-2"><div className="text-xs font-bold text-gray-700">{label}</div><div className="text-[10px] text-gray-400">{countText(count)}건 × {wonText(rate)}</div></div><div className="mt-1 text-right text-base font-black text-amber-700">{wonText(amount)}</div></div>)}</div>
      <div className="mx-4 mb-4 grid grid-cols-2 gap-2">{[
        ['합산점수', `${award.totalScore}점`],
        ['현재 기준액', wonText(award.totalAmount)],
      ].map(([label,value])=><div key={label} className="rounded-xl bg-amber-50 p-3"><div className="text-[10px] text-amber-600">{label}</div><div className="mt-1 text-base font-black text-amber-800">{value}</div></div>)}</div>
      <div className="border-t divide-y divide-gray-50">{[
        ['HS 신규 비중','newRatio'],['SIM MNP 비중','simMnpRatio'],['HS 대비 전략상품 비중','salesMetricRatio'],['기변 유통망지원금 활용','changeSupportRatio'],['인터넷 비중','internetRatio'],
      ].map(([label,key])=><div key={key} className="grid grid-cols-[1fr_70px_45px] items-center gap-2 px-4 py-3 text-xs"><span className="font-semibold text-gray-700">{label}</span><span className="text-right text-gray-500">{countText(award.ratios[key])}%</span><b className="text-right text-amber-700">{award.scores[key]}점</b></div>)}</div>
      <div className="border-t px-4 py-3">{authUserId===HQ_STRUCTURE_EDITOR_ID?<div className="flex items-end gap-2"><label className="flex-1 text-[10px] text-gray-500">기변 유통망지원금 활용 비중<input type="number" min="0" max="100" step="0.1" value={changeSupportRatio} onChange={e=>setChangeSupportRatio(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" placeholder="예: 55"/></label><button onClick={saveChangeSupportRatio} disabled={awardSaving} className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{awardSaving?'저장 중':'저장'}</button></div>:<div className="text-[10px] text-gray-400">기변 유통망지원금 활용 비중은 이강진 실장이 월별로 입력합니다.</div>}</div>
      <div className="border-t px-4 py-3 text-[10px] leading-relaxed text-gray-500">예상 시상금 = MNP 건수×MNP 단가 + 010 신규 건수×신규 단가 + 기변 건수×기변 단가<br/>현재 실적 기준 예상치이며 익월 취소·해지 등 사후 제외건은 최종 확정 시 반영됩니다.</div>
    </div>
    </>}
  </div>;
}
