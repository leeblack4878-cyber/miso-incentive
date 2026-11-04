import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { DEFAULT_STORES } from '../viewShared';
import { displayStoreName } from '../uiDefinitions';
import { buildManagerProgress, PROGRESS_LABELS, PROGRESS_NOTE, RANK_NOTE, TIER_NOTE, progressMetricText, progressRowStatus } from '../managerProgress';
import { createManagerProgressImage } from '../managerProgressImage';

export default function ManagerProgressPanel({ month, onBack }) {
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
        const { data, error } = await supabase.rpc('manager_policy_progress', { p_month: month });
        if (error || !Array.isArray(data)) throw error || new Error('Invalid snapshot');
        if (!alive) return;
        const next = buildManagerProgress(DEFAULT_STORES, data, month);
        setReport(next);
        loaded = true;
        const file = await createManagerProgressImage(next);
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
  }, [month, attempt]);

  function reload() {
    setReport(null);
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

  return <section aria-label="점장정책 중간 진척도" className="space-y-3">
    <button type="button" onClick={onBack} className="rounded-lg border bg-white px-3 py-2 text-xs font-bold">평가 화면으로</button>
    <header className="rounded-2xl bg-brand-700 p-4 text-white">
      <p className="text-xs text-brand-100">미소모바일 · 2026년 11월</p>
      <h2 className="mt-1 text-lg font-black">점장정책 중간 진척도</h2>
      <p className="mt-2 text-xs">회사입력 기준 · 순위 기준일 {report?.rankDate ?? '확인 대기'}</p>
      <p className="mt-2 text-[11px] text-brand-100">{PROGRESS_NOTE}<br/>{RANK_NOTE}<br/>{TIER_NOTE}</p>
    </header>
    {image && <div className="grid grid-cols-2 gap-2 text-center text-xs font-bold">
      <a href={image.url} download={image.file.name} className="rounded-xl bg-brand-600 px-2 py-3 text-white">PNG 저장</a>
      <button type="button" onClick={share} className="rounded-xl border bg-white px-2 py-3 text-brand-700">이미지 공유</button>
    </div>}
    {message && <p role="status" className="rounded-lg bg-brand-50 p-3 text-xs">{message}</p>}
    {loadError && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-xs">진척도 자료를 불러오지 못했어요.</p>}
    {!report && !loadError && <p role="status" className="text-xs">진척도 자료를 불러오고 있어요.</p>}
    {(report || loadError) && <button type="button" onClick={reload} className="text-xs font-bold text-brand-700">다시 불러오기</button>}
    {report?.rows.map(row => <article key={row.store} className="rounded-2xl border bg-white p-3">
      <h3 className="text-sm font-black">{displayStoreName(row.store)}</h3>
      <p className="mt-1 text-xs text-gray-600">{progressRowStatus(row, report.rankDate)}</p>
      {!row.excluded && <div className="mt-3 grid grid-cols-2 gap-2">
        {Object.entries(PROGRESS_LABELS).map(([key, label]) => {
          const metric = progressMetricText(row.progress[key]);
          return <div key={key} className="min-w-0 rounded-xl bg-brand-50 p-2">
            <h4 className="text-xs font-semibold text-gray-700">{label}</h4>
            <p className="mt-1 text-sm font-black text-brand-700">{metric.score}</p>
            <p className="text-xs text-gray-700">{metric.counts}</p>
            <p className="mt-1 text-[11px] text-gray-600">{metric.tier}</p>
          </div>;
        })}
      </div>}
    </article>)}
  </section>;
}
