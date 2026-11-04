import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { DEFAULT_STORES } from '../viewShared';
import { displayStoreName, fmtNum, won } from '../uiDefinitions';
import { buildManagerProgress, PROGRESS_LABELS, PROGRESS_NOTE, RANK_NOTE, TIER_NOTE, progressMetricText, progressRowStatus } from '../managerProgress';
import { createManagerProgressImage } from '../managerProgressImage';

export default function ManagerProgressPanel({ month, onBack }) {
  const [basis, setBasis] = useState('employee');
  const [pending, setPending] = useState(false);
  const [slotLabel, setSlotLabel] = useState('');
  const [details, setDetails] = useState([]);
  const [report, setReport] = useState(null);
  const [image, setImage] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [message, setMessage] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    let url;
    let loaded = false;
    async function load() {
      try {
        const { data, error } = basis === 'employee'
          ? await supabase.functions.invoke('monthly-ranking', { body: { month, view: 'manager-progress' } })
          : await supabase.rpc('manager_policy_progress', { p_month: month });
        const records = basis === 'employee' ? data?.rows : data;
        if (error || !Array.isArray(records)) throw error || new Error('Invalid snapshot');
        if (!alive) return;
        if (basis === 'employee' && !data.slotAt) {
          setPending(true);
          return;
        }
        const slot = basis === 'employee' ? new Intl.DateTimeFormat('sv-SE', {
          timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
        }).format(new Date(data.slotAt)) : '';
        setSlotLabel(slot);
        const next = buildManagerProgress(DEFAULT_STORES, records, month);
        setDetails(records);
        setReport(next);
        loaded = true;
        const file = await createManagerProgressImage(next, basis === 'employee' ? '직원입력 집계' : '회사입력 기준', slot);
        if (!alive) return;
        url = URL.createObjectURL(file);
        setImage({ file, url });
      } catch {
        if (!alive) return;
        if (loaded) setMessage('이미지를 만들지 못했어요. 다시 불러오기를 눌러주세요.');
        else setLoadError(true);
      }
    }
    // Keep the data display available if only PNG generation fails.
    load();
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [month, attempt, basis]);

  function reload() {
    setReport(null);
    setPending(false);
    setSlotLabel('');
    setDetails([]);
    setImage(null);
    setLoadError(false);
    setMessage('');
    setAttempt(value => value + 1);
  }

  async function share() {
    const files = [image.file];
    try {
      if (navigator.share && navigator.canShare?.({ files })) {
        await navigator.share({ files });
      } else {
        setMessage('이 브라우저에서는 이미지를 저장한 뒤 카카오톡 등에서 첨부해주세요.');
      }
    } catch (error) {
      if (error?.name !== 'AbortError') setMessage('공유가 완료되지 않았어요. 이미지를 저장해 첨부할 수 있어요.');
    }
  }

  const amountColumns = details.some(row => row.amounts);
  const columns = Object.entries(PROGRESS_LABELS);
  const amountRows = details.filter(row => row.amounts);
  const amountSummary = amountRows.length > 0 && [
    ['현재 수혜액', amountRows.reduce((sum, row) => sum + row.amounts.current, 0)],
    ['월말 예상 수혜액', amountRows.reduce((sum, row) => sum + row.amounts.forecast, 0)],
  ];
  return <section aria-label="점장정책 중간 진척도" className="space-y-3">
    <button type="button" onClick={onBack} className="rounded-lg border bg-white px-3 py-2 text-xs font-bold">평가 화면으로</button>
    <header className="rounded-2xl bg-brand-700 p-4 text-white">
      <p className="text-xs text-brand-100">미소모바일 · 2026년 11월</p>
      <h2 className="mt-1 text-lg font-black">점장정책 중간 진척도</h2>
      <p className="mt-2 text-xs">{basis === 'employee' ? '직원입력 집계' : '회사입력 기준'} · {slotLabel ? `${slotLabel} 기준 (한국시간)` : `순위 기준일 ${report?.rankDate ?? '확인 대기'}`}</p>
      <p className="mt-2 text-[11px] text-brand-100">{PROGRESS_NOTE}<br/>{RANK_NOTE}<br/>{TIER_NOTE}</p>
    </header>
    <div className="flex flex-wrap gap-2">
      {[['employee', '직원입력 집계'], ['company', '회사 확인값']].map(([value, label]) =>
        <button key={value} type="button" aria-pressed={basis === value} className="rounded-lg border bg-white px-3 py-2 text-xs font-bold aria-pressed:bg-brand-100"
          onClick={() => { if (basis !== value) { reload(); setBasis(value); } }}>{label}</button>)}
    </div>
    {image && <div className="grid grid-cols-2 gap-2 text-center text-xs font-bold">
      <a href={image.url} download={image.file.name} className="rounded-xl bg-brand-600 px-2 py-3 text-white">PNG 저장</a>
      <button type="button" onClick={share} className="rounded-xl border bg-white px-2 py-3 text-brand-700">이미지 공유</button>
    </div>}
    {message && <p role="status" className="rounded-lg bg-brand-50 p-3 text-xs">{message}</p>}
    {loadError && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-xs">진척도 자료를 불러오지 못했어요.</p>}
    {basis === 'employee' && <p className="text-xs text-gray-600">매일 10:00 · 15:00 · 21:00 집계 중 가장 최근 결과를 표시합니다.</p>}
    {pending && <p role="status" className="rounded-lg bg-brand-50 p-3 text-xs">아직 저장된 직원입력 집계가 없어요.</p>}
    {!report && !loadError && !pending && <p role="status" className="text-xs">진척도 자료를 불러오고 있어요.</p>}
    {(report || loadError || pending) && <button type="button" onClick={reload} className="text-xs font-bold text-brand-700">다시 불러오기</button>}
    {report && <>
      {basis === 'employee' && <div className="grid grid-cols-2 gap-2">
        {amountSummary && amountSummary.map(([label, value]) => <div key={label} className="rounded-xl border bg-white p-3">
          <p className="text-xs text-gray-600">{label} · 열람 범위</p><b className="text-brand-700">{won(value)}</b>
        </div>)}
        <div className="rounded-xl border bg-white p-3">
          <p className="text-xs text-gray-600">맞춤제안 업셀 누적</p><b className="text-brand-700">{details.length ? `${fmtNum(details.reduce((sum, row) => sum + (row.quality?.tailoredCount ?? 0), 0))}건` : '미입력'}</b>
        </div>
      </div>}
      <p className="text-xs text-gray-600">실적 / 목표 · 모바일에서는 표를 옆으로 밀어 확인할 수 있어요.</p>
      {amountColumns && <p className="text-xs text-gray-600">수혜액은 차감·AA·직급 보정 전 추정치입니다. 미확인 2ND 번들·전략 모델과 종합평가 보너스는 합산하지 않습니다. 월말 예상은 경과일 기준 단순 환산입니다.</p>}
      <div role="region" aria-label="매장별 실적 비교 표" tabIndex={0} className="max-w-full overflow-x-auto rounded-xl border bg-white">
        <table className="w-full min-w-max text-center text-xs">
          <thead className="bg-brand-700 text-white">
            <tr>
              <th rowSpan={2} className="sticky left-0 z-10 bg-brand-700 px-3">매장</th>
              <th colSpan={4} scope="colgroup" className="border-b border-white/20 p-2">핵심 실적</th>
              {basis === 'employee' && <th colSpan={4} scope="colgroup" className="border-b border-white/20 p-2">판매 퀄리티 · 맞춤제안</th>}
              {amountColumns && <th colSpan={2} scope="colgroup" className="border-b border-white/20 p-2">수혜액</th>}
            </tr>
            <tr>{[...Object.values(PROGRESS_LABELS), ...(basis === 'employee' ? ['MNP 비중', '2ND 번들', '전략 모델', '업셀'] : []), ...(amountColumns ? ['현재', '월말 예상'] : [])]
              .map(label => <th key={label} scope="col" className="px-3 py-2">{label}</th>)}</tr>
          </thead>
          <tbody>{report.rows.map(row => {
            const detail = details.find(item => item.store_name === row.store);
            const quality = detail?.quality;
            const values = [quality?.mnpRatio == null ? null : `${fmtNum(quality.mnpRatio, 1)}%`, quality?.managerBundleCount, quality?.strategyModelCount, quality?.tailoredCount];
            return <tr key={row.store} className="group border-b last:border-0 odd:bg-white even:bg-slate-50">
              <th scope="row" className="sticky left-0 z-10 max-w-32 bg-inherit px-3 py-2 text-left">
                {displayStoreName(row.store)}
                <small className="block max-w-28 text-[10px] font-normal text-gray-600">{progressRowStatus(row, report.rankDate, basis)}</small>
              </th>
              {row.excluded ? <td colSpan={4 + (basis === 'employee' ? 4 : 0) + (amountColumns ? 2 : 0)} className="px-3 py-2 text-gray-500">평가 제외</td> : <>
                {columns.map(([key]) => {
                  const metric = progressMetricText(row.progress[key]);
                  return <td key={key} className="whitespace-nowrap px-3 py-2">
                    <b>{metric.counts}</b><span className="block font-bold text-brand-700">{metric.score}</span>
                    <small className="block text-[10px] text-gray-600">{metric.tier}</small>
                  </td>;
                })}
                {basis === 'employee' && values.map((value, index) => <td key={index} className="whitespace-nowrap px-3 py-2">{value ?? '확인 대기'}</td>)}
                {amountColumns && ['current', 'forecast'].map(key => <td key={key} className="whitespace-nowrap px-3 py-2 font-bold text-brand-700">{detail?.amounts ? won(detail.amounts[key]) : '—'}</td>)}
              </>}
            </tr>;
          })}</tbody>
        </table>
      </div>
    </>}
  </section>;
}
