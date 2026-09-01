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
} from './hqStructurePolicy';

const countText = value => Number(value || 0).toLocaleString('ko-KR', { maximumFractionDigits: 1 });
const wonText = value => `${Math.round(Number(value || 0)).toLocaleString('ko-KR')}원`;
const PRODUCT_LABELS = {
  hs: 'HS (SIM MNP 제외)', second: '2ND', internet: '인터넷', smartHome: '스마트홈', extraSetTop: 'TV 추가셋탑',
};
const BASELINE_LABELS = {
  sangnoksu: '상록수', doil: '도일시장', sammi: '삼미시장', residentCenter: '주민센터', sanbon: '산본점', ownedStore: '자가매장 보유',
};

export default function HqStructurePolicyView({ month, employeeIds = [] }) {
  const emptyRetail = calculateRetailPartnerMonthlyPolicy();
  const emptySalesMetric = calculateSalesMetricActivation();
  const [state, setState] = useState({ loading: true, error: '', result: calculateSelfStoreOperatingSupport(), retail: emptyRetail, salesMetric: emptySalesMetric });

  useEffect(() => {
    let alive = true;
    if (!employeeIds.length) {
      setState({ loading: false, error: '', result: calculateSelfStoreOperatingSupport(), retail: emptyRetail, salesMetric: emptySalesMetric });
      return () => { alive = false; };
    }
    (async () => {
      setState(prev => ({ ...prev, loading: true, error: '' }));
      const [year, monthNumber] = month.split('-').map(Number);
      const next = new Date(year, monthNumber, 1);
      const to = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`;
      const [salesResult, homeResult, dailyResult] = await Promise.all([
        supabase.from('customer_sales')
          .select('id,user_id,source_type,source_meta,sale_date')
          .in('user_id', employeeIds).gte('sale_date', `${month}-01`).lt('sale_date', to),
        supabase.from('home_orders')
          .select('id,user_id,customer_id,customer_name,product_type,status,actual_install_date')
          .in('user_id', employeeIds).eq('status', 'completed')
          .gte('actual_install_date', `${month}-01`).lt('actual_install_date', to),
        supabase.from('daily_records').select('user_id,data').in('user_id', employeeIds)
          .gte('work_date', `${month}-01`).lt('work_date', to),
      ]);
      if (salesResult.error || homeResult.error || dailyResult.error) throw salesResult.error || homeResult.error || dailyResult.error;

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
      const result = calculateSelfStoreOperatingSupport({ hs, second, internet, smartHome, extraSetTop });
      const retail = calculateRetailPartnerMonthlyPolicy({ hs, plan115Hs, mnp, new010, change95Plus, changeUnder95, second, simMnp });
      const mobileSales = (salesResult.data || []).filter(row => row.source_type === 'mobile');
      const strategicPlan = mobileSales.filter(row => row.source_meta?.strategicPlan).length;
      const { insurance, strategicVas } = summarizeVasQuality(mobileSales);
      const sono = (dailyResult.data || []).reduce((sum, row) => sum + Object.values(row.data?.groups?.sono || {}).reduce((a, value) => a + Number(value || 0), 0), 0);
      const salesMetricPoints = strategicPlan * 0.5 + insurance * 0.8 + strategicVas + sono * 2;
      const salesMetric = calculateSalesMetricActivation({ hs, salesMetricPoints });
      if (alive) setState({ loading: false, error: '', result, retail, salesMetric });
    })().catch(error => {
      console.error('HQ STRUCTURE POLICY LOAD ERROR', error);
      if (alive) setState(prev => ({ ...prev, loading: false, error: '본사 구조정책 실적을 불러오지 못했어요.' }));
    });
    return () => { alive = false; };
  }, [month, employeeIds.join('|')]);

  const { result, retail, salesMetric } = state;
  return <div className="space-y-4">
    <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-violet-900 p-5 text-white">
      <div className="flex items-center gap-2 text-xs font-bold text-violet-200"><Building2 size={15}/> 본사 구조정책</div>
      <div className="mt-2 text-xl font-black">자가매장 운영비 지원제도</div>
      <div className="mt-1 text-xs text-slate-300">{month.replace('-', '년 ')}월 · 당월 개통 및 설치 완료 기준 예상액</div>
      {state.loading ? <div className="mt-6 flex items-center gap-2 text-sm text-slate-300"><Loader2 size={16} className="animate-spin"/> 계산 중...</div> : <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['인정 실적', `${countText(result.recognized)}건`],
          ['회사 기준', `${countText(result.baseline)}건`],
          ['초과 실적', `${countText(result.excess)}건`],
          ['예상 지원금', wonText(result.totalAmount)],
        ].map(([label, value]) => <div key={label} className="rounded-xl bg-white/10 p-3"><div className="text-[10px] text-slate-300">{label}</div><div className="mt-1 text-base font-black">{value}</div></div>)}
      </div>}
    </div>

    {state.error && <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs text-red-600">{state.error}</div>}

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
      <div className="bg-indigo-50 px-4 py-4"><div className="text-[10px] font-bold text-indigo-500">본사 구조정책 · 두 번째</div><div className="mt-1 text-lg font-black text-gray-900">소매파트너 월간판매량 정책</div><div className="mt-1 text-[10px] text-gray-500">월 포인트 구간별 누진금액에 115군 비중 지급률을 적용합니다.</div></div>
      <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4">{[
        ['월 포인트', `${countText(retail.points)}P`],
        ['115군 비중', `${countText(retail.plan115Ratio)}%`],
        ['지급률', `${countText(retail.paymentRate * 100)}%`],
        ['예상 지급액', wonText(retail.totalAmount)],
      ].map(([label,value])=><div key={label} className="rounded-xl bg-gray-50 p-3"><div className="text-[10px] text-gray-400">{label}</div><div className="mt-1 text-base font-black text-indigo-700">{value}</div></div>)}</div>
      <div className="border-t px-4 py-3"><div className="text-xs font-bold text-gray-700">포인트 구간별 계산</div><div className="mt-2 space-y-1.5">{retail.tiers.map((tier,index)=><div key={tier.from} className="grid grid-cols-[1fr_70px_100px] gap-2 rounded-lg bg-gray-50 px-3 py-2 text-[11px]"><span>{index===0?'150~300P':index===retail.tiers.length-1?'1,501P 이상':`${tier.from+1}~${tier.to}P`} · {wonText(tier.rate)}/P</span><span className="text-right text-gray-500">{countText(tier.pointCount)}P</span><b className="text-right">{wonText(tier.amount)}</b></div>)}</div></div>
      <div className="border-t px-4 py-3 text-[10px] leading-relaxed text-gray-500"><b className="text-gray-700">포인트:</b> MNP·010신규 2P, 기변 95군↑ 1P, 기변 95군 미만 0.3P, 2ND·SIM MNP 1P<br/><b className="text-gray-700">115군 비중:</b> HS 중 115군 비중이며 SIM MNP는 분모·자수 모두 제외 · 40%↑ 110%, 50%↑ 120%, 60%↑ 130%</div>
    </div>

    <div className="rounded-2xl border border-emerald-100 bg-white overflow-hidden">
      <div className="bg-emerald-50 px-4 py-4"><div className="text-[10px] font-bold text-emerald-600">본사 구조정책 · 세 번째</div><div className="mt-1 text-lg font-black text-gray-900">매출지표 활성화 정책</div><div className="mt-1 text-[10px] text-gray-500">직원 매출지표와 동일한 기준으로 달성률과 1P당 단가를 계산합니다.</div></div>
      <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4">{[
        ['HS', `${countText(salesMetric.hs)}건`],
        ['매출지표', `${countText(salesMetric.points)}P`],
        ['달성률', `${countText(salesMetric.achievement)}%`],
        ['예상 지급액', wonText(salesMetric.totalAmount)],
      ].map(([label,value])=><div key={label} className="rounded-xl bg-gray-50 p-3"><div className="text-[10px] text-gray-400">{label}</div><div className="mt-1 text-base font-black text-emerald-700">{value}</div></div>)}</div>
      <div className="border-t px-4 py-3"><div className="flex items-center justify-between rounded-xl bg-emerald-50 p-3 text-xs"><span>현재 적용 단가</span><b className="text-emerald-700">{salesMetric.pointRate ? `달성률 ${salesMetric.threshold}% 구간 · 1P당 ${wonText(salesMetric.pointRate)}` : '80% 미만 · 미지급'}</b></div><div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">{[[80,4400],[100,6600],[120,8800],[140,11000],[160,13200],[180,15400],[200,17600]].map(([pct,rate])=><div key={pct} className={`rounded-lg px-2 py-2 text-center text-[10px] ${salesMetric.threshold===pct?'bg-emerald-600 text-white':'bg-gray-50 text-gray-500'}`}><b>{pct}%</b><br/>{wonText(rate)}/P</div>)}</div></div>
      <div className="border-t px-4 py-3 text-[10px] leading-relaxed text-gray-500">전략요금제 0.5P · 보험류 0.8P · 전략 VAS 1P · 대명 2P<br/>최종 지급액 = 매출지표 총 P × 달성 구간의 1P당 단가</div>
    </div>
  </div>;
}
