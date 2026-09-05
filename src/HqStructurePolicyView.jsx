import React, { useEffect, useState } from 'react';
import { Building2, Loader2 } from 'lucide-react';
import { supabase } from './supabase';
import { summarizeVasQuality } from './policyRules';
import {
  SELF_STORE_BASELINE,
  SELF_STORE_WEIGHTS,
  calculateRetailMonthlyAward,
  calculateHqStructureProjection,
} from './hqStructurePolicy';

const countText = value => Number(value || 0).toLocaleString('ko-KR', { maximumFractionDigits: 1 });
const wonText = value => `${Math.round(Number(value || 0)).toLocaleString('ko-KR')}원`;
const PRODUCT_LABELS = {
  hs: 'HS (SIM MNP 제외)', second: '2ND', internet: '인터넷', smartHome: '스마트홈', extraSetTop: 'TV 추가셋탑',
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

export default function HqStructurePolicyView({ month, employeeIds = [], authUserId = '' }) {
  const emptyProjection = calculateHqStructureProjection({ month });
  const [state, setState] = useState({
    loading: true,
    error: '',
    result: emptyProjection.current.selfStore,
    retail: emptyProjection.current.retail,
    salesMetric: emptyProjection.current.salesMetric,
    award: emptyProjection.current.award,
    forecast: emptyProjection.forecast,
    runRate: emptyProjection.runRate,
    currentTotalAmount: emptyProjection.currentTotalAmount,
    forecastTotalAmount: emptyProjection.forecastTotalAmount,
  });
  const [changeSupportRatio,setChangeSupportRatio]=useState('');
  const [awardSaving,setAwardSaving]=useState(false);

  useEffect(() => {
    let alive = true;
    if (!employeeIds.length) {
      const projection = calculateHqStructureProjection({ month });
      setState({ loading: false, error: '', result: projection.current.selfStore, retail: projection.current.retail, salesMetric: projection.current.salesMetric, award: projection.current.award, forecast: projection.forecast, runRate: projection.runRate, currentTotalAmount: projection.currentTotalAmount, forecastTotalAmount: projection.forecastTotalAmount });
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
          .select('id,user_id,customer_id,customer_name,product_type,status,actual_install_date')
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
      const internet = new Set(completed
        .filter(row => ['internet1g', 'internet500', 'internet100', 'homeOnly', 'homeTv'].includes(row.product_type))
        .map(bundleKey)).size;
      const smartHome = completed.filter(row => row.product_type === 'smartHome').length;
      const extraSetTop = completed.filter(row => row.product_type === 'subSetTop').length;
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

  const { result, retail, salesMetric, award, forecast, runRate } = state;
  const forecastSelfStore = forecast?.selfStore || result;
  const forecastRetail = forecast?.retail || retail;
  const forecastSalesMetric = forecast?.salesMetric || salesMetric;
  const forecastAward = forecast?.award || award;
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
        currentTotalAmount:Number(prev.result?.totalAmount||0)+Number(prev.retail?.totalAmount||0)+Number(prev.salesMetric?.totalAmount||0)+Number(nextAward.totalAmount||0),
        forecastTotalAmount:Number(prev.forecast?.selfStore?.totalAmount||0)+Number(prev.forecast?.retail?.totalAmount||0)+Number(prev.forecast?.salesMetric?.totalAmount||0)+Number(nextForecastAward.totalAmount||0),
      };
    });
  };
  return <div className="space-y-4">
    <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-violet-900 p-5 text-white">
      <div className="flex items-center gap-2 text-xs font-bold text-violet-200"><Building2 size={15}/> 본사 구조정책</div>
      <div className="mt-2 text-xl font-black">{month.replace('-', '년 ')}월 마감 전망</div>
      <div className="mt-1 text-xs text-slate-300">자가매장 운영비 · 소매파트너 · 매출지표 · 월간 시상 합계</div>
      {state.loading ? <div className="mt-6 flex items-center gap-2 text-sm text-slate-300"><Loader2 size={16} className="animate-spin"/> 계산 중...</div> : <>
        {runRate?.isCurrentMonth ? <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-end gap-2 rounded-2xl bg-white/10 p-4">
          <div className="min-w-0"><div className="text-[10px] text-slate-300">현재 실적 기준 합계</div><div className="mt-1 whitespace-nowrap text-xl font-black">{wonText(state.currentTotalAmount)}</div></div>
          <div className="pb-1 text-xl text-violet-300">→</div>
          <div className="min-w-0 text-right"><div className="text-[10px] text-violet-200">월말 예상 합계</div><div className="mt-1 whitespace-nowrap text-xl font-black text-white">{wonText(state.forecastTotalAmount)}</div></div>
        </div> : <div className="mt-5 rounded-2xl bg-white/10 p-4"><div className="text-[10px] text-slate-300">마감 기준 합계</div><div className="mt-1 text-2xl font-black">{wonText(state.currentTotalAmount)}</div></div>}
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">{[
          ['자가매장 운영비', forecastSelfStore.totalAmount],
          ['소매파트너', forecastRetail.totalAmount],
          ['매출지표', forecastSalesMetric.totalAmount],
          ['월간 시상', forecastAward.totalAmount],
        ].map(([label,value])=><div key={label} className="rounded-xl bg-white/10 px-3 py-2.5"><div className="text-[9px] text-slate-300">{runRate?.isCurrentMonth?'월말 예상 · ':''}{label}</div><div className="mt-1 text-sm font-black">{wonText(value)}</div></div>)}</div>
        <div className="mt-2 text-[10px] text-slate-300">{forecastPaceText} · 정책 구간과 지급률을 다시 계산한 예상치</div>
      </>}
    </div>

    {state.error && <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs text-red-600">{state.error}</div>}

    <div className="rounded-2xl border border-violet-100 bg-white overflow-hidden">
      <div className="bg-violet-50 px-4 py-4"><div className="text-lg font-black text-gray-900">자가매장 운영비 지원제도</div><div className="mt-1 text-[10px] text-gray-500">인정 실적이 회사 기준 668건을 넘는 구간부터 누진 지급합니다.</div></div>
      <ForecastAmountStrip currentAmount={result.totalAmount} forecastAmount={forecastSelfStore.totalAmount} runRate={runRate} detail={`현재 ${countText(result.recognized)}건 · 월말 예상 ${countText(forecastSelfStore.recognized)}건`} />
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
        {Object.keys(SELF_STORE_WEIGHTS).map(key => <div key={key} className="grid grid-cols-[1fr_65px_55px_75px] items-center gap-2 px-4 py-3 text-xs">
          <div className="font-semibold text-gray-700">{PRODUCT_LABELS[key]}</div>
          <div className="text-right text-gray-500">{countText(result.counts[key])}건</div>
          <div className="text-right text-gray-400">× {SELF_STORE_WEIGHTS[key]}</div>
          <div className="text-right font-bold text-violet-700">{countText(result.counts[key] * SELF_STORE_WEIGHTS[key])}건</div>
        </div>)}
      </div>
    </div>

    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-2xl border border-gray-100 bg-white p-4"><div className="text-sm font-bold">기준 수량 668건</div><div className="mt-3 grid grid-cols-2 gap-2">{Object.entries(SELF_STORE_BASELINE).map(([key, value]) => <div key={key} className="flex justify-between rounded-lg bg-gray-50 px-3 py-2 text-xs"><span className="text-gray-500">{BASELINE_LABELS[key]}</span><b>{value}건</b></div>)}</div></div>
      <div className="rounded-2xl border border-gray-100 bg-white p-4"><div className="text-sm font-bold">초과 구간별 예상 지급</div><div className="mt-3 space-y-2"><div className="flex justify-between rounded-xl bg-violet-50 p-3 text-xs"><span>초과 1~150건 · 건당 5만원</span><b className="text-violet-700">{countText(result.tier1Count)}건 · {wonText(result.tier1Amount)}</b></div><div className="flex justify-between rounded-xl bg-indigo-50 p-3 text-xs"><span>초과 151번째부터 · 건당 6만원</span><b className="text-indigo-700">{countText(result.tier2Count)}건 · {wonText(result.tier2Amount)}</b></div></div><div className="mt-3 text-[10px] leading-relaxed text-gray-400">151건을 넘겨도 앞선 150건의 단가는 바뀌지 않습니다. 월말 최종 개통·설치 상태에 따라 확정 금액은 달라질 수 있어요.</div></div>
    </div>

    <div className="rounded-2xl border border-indigo-100 bg-white overflow-hidden">
      <div className="bg-indigo-50 px-4 py-4"><div className="text-lg font-black text-gray-900">소매파트너 월간판매량 정책</div><div className="mt-1 text-[10px] text-gray-500">월 포인트 구간별 누진금액에 115군 비중 지급률을 적용합니다.</div></div>
      <ForecastAmountStrip currentAmount={retail.totalAmount} forecastAmount={forecastRetail.totalAmount} runRate={runRate} tone="indigo" detail={`현재 ${countText(retail.points)}P · 월말 예상 ${countText(forecastRetail.points)}P`} />
      <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4">{[
        ['월 포인트', `${countText(retail.points)}P`],
        ['115군 비중', `${countText(retail.plan115Ratio)}%`],
        ['지급률', `${countText(retail.paymentRate * 100)}%`],
        ['현재 기준액', wonText(retail.totalAmount)],
      ].map(([label,value])=><div key={label} className="rounded-xl bg-gray-50 p-3"><div className="text-[10px] text-gray-400">{label}</div><div className="mt-1 text-base font-black text-indigo-700">{value}</div></div>)}</div>
      <div className="border-t px-4 py-3"><div className="text-xs font-bold text-gray-700">포인트 구간별 계산</div><div className="mt-2 space-y-1.5">{retail.tiers.map((tier,index)=><div key={tier.from} className="grid grid-cols-[1fr_70px_100px] gap-2 rounded-lg bg-gray-50 px-3 py-2 text-[11px]"><span>{index===0?'150~300P':index===retail.tiers.length-1?'1,501P 이상':`${tier.from+1}~${tier.to}P`} · {wonText(tier.rate)}/P</span><span className="text-right text-gray-500">{countText(tier.pointCount)}P</span><b className="text-right">{wonText(tier.amount)}</b></div>)}</div></div>
      <div className="border-t px-4 py-3 text-[10px] leading-relaxed text-gray-500"><b className="text-gray-700">포인트:</b> MNP·010신규 2P, 기변 95군↑ 1P, 기변 95군 미만 0.3P, 2ND·SIM MNP 1P<br/><b className="text-gray-700">115군 비중:</b> HS 중 115군 비중이며 SIM MNP는 분모·자수 모두 제외 · 40%↑ 110%, 50%↑ 120%, 60%↑ 130%</div>
    </div>

    <div className="rounded-2xl border border-emerald-100 bg-white overflow-hidden">
      <div className="bg-emerald-50 px-4 py-4"><div className="text-lg font-black text-gray-900">매출지표 활성화 정책</div><div className="mt-1 text-[10px] text-gray-500">직원 매출지표와 동일한 기준으로 달성률과 1P당 단가를 계산합니다.</div></div>
      <ForecastAmountStrip currentAmount={salesMetric.totalAmount} forecastAmount={forecastSalesMetric.totalAmount} runRate={runRate} tone="emerald" detail={`현재 ${countText(salesMetric.points)}P · 월말 예상 ${countText(forecastSalesMetric.points)}P`} />
      <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4">{[
        ['HS', `${countText(salesMetric.hs)}건`],
        ['매출지표', `${countText(salesMetric.points)}P`],
        ['달성률', `${countText(salesMetric.achievement)}%`],
        ['현재 기준액', wonText(salesMetric.totalAmount)],
      ].map(([label,value])=><div key={label} className="rounded-xl bg-gray-50 p-3"><div className="text-[10px] text-gray-400">{label}</div><div className="mt-1 text-base font-black text-emerald-700">{value}</div></div>)}</div>
      <div className="border-t px-4 py-3"><div className="flex items-center justify-between rounded-xl bg-emerald-50 p-3 text-xs"><span>현재 적용 단가</span><b className="text-emerald-700">{salesMetric.pointRate ? `달성률 ${salesMetric.threshold}% 구간 · 1P당 ${wonText(salesMetric.pointRate)}` : '80% 미만 · 미지급'}</b></div><div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">{[[80,4400],[100,6600],[120,8800],[140,11000],[160,13200],[180,15400],[200,17600]].map(([pct,rate])=><div key={pct} className={`rounded-lg px-2 py-2 text-center text-[10px] ${salesMetric.threshold===pct?'bg-emerald-600 text-white':'bg-gray-50 text-gray-500'}`}><b>{pct}%</b><br/>{wonText(rate)}/P</div>)}</div></div>
      <div className="border-t px-4 py-3 text-[10px] leading-relaxed text-gray-500">전략요금제 0.5P · 보험류 0.8P · 전략 VAS 1P · 대명 2P<br/>최종 지급액 = 매출지표 총 P × 달성 구간의 1P당 단가</div>
    </div>

    <div className="rounded-2xl border border-amber-100 bg-white overflow-hidden">
      <div className="bg-amber-50 px-4 py-4"><div className="text-lg font-black text-gray-900">소매 월간 시상 정책</div><div className="mt-1 text-[10px] text-gray-500">5개 지표의 최고 달성점수를 합산해 MNP·010 신규·기변 단가를 결정합니다.</div></div>
      <ForecastAmountStrip currentAmount={award.totalAmount} forecastAmount={forecastAward.totalAmount} runRate={runRate} tone="amber" detail={`현재 ${award.totalScore}점 · 월말 예상 ${forecastAward.totalScore}점`} />
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
  </div>;
}
