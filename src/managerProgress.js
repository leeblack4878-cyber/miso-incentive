import { managerEvaluationExclusion, metricNumber, validCompanyDate } from './evaluationBasis.js';
import { septemberManagerStoreType } from './managerPolicyEngine.js';
import { calculateNovemberManagerIncentive, novemberManagerGoals } from './novemberManagerPolicy.js';

export const PROGRESS_LABELS = { hs: 'HS', home: '홈', tvFree: 'TV프리(부)', smartHome: '스마트홈' };
export const PROGRESS_NOTE = '홈은 소호 포함 · HS = HS + SIM MNP + 2ND × 0.5';
export const RANK_NOTE = '지표별 순위는 최신 실적 기준일의 확인값으로 산정';
export const TIER_NOTE = '150% 구간은 맞춤제안 위탁 80건 · 자가 40건 필요';

export function buildManagerProgress(stores, snapshots, month, today) {
  const rows = stores.filter(store => novemberManagerGoals(store).hs).map(store => {
    const excluded = !!managerEvaluationExclusion(store, month);
    const snapshot = excluded ? null : snapshots.find(record => record.store_name === store);
    const asOfDate = validCompanyDate(snapshot?.as_of_date, month, today) ? snapshot.as_of_date : null;
    const confirmed = !!snapshot?.confirmed && !!asOfDate;
    const input = key => metricNumber(snapshot?.metrics?.[key]);
    const actual = Object.fromEntries(Object.keys(PROGRESS_LABELS).map(key => [key, input(key)]));
    const simMnpCount = input('simMnp');
    const secondCount = input('secondTotal');
    const tailoredCount = input('tailoredCount');
    const targets = novemberManagerGoals(store);
    const { metrics } = calculateNovemberManagerIncentive({
      actual, targets, simMnpCount, secondCount, tailoredCount, storeType: septemberManagerStoreType(store),
    });
    const progress = Object.fromEntries(metrics.map(metric => {
      const { key, target, recognized, achievement, threshold } = metric;
      const missing = actual[key] === null || (key === 'hs' && (simMnpCount === null || secondCount === null));
      return [key, {
        target,
        actual: missing ? null : recognized,
        achievement: missing ? null : achievement,
        remaining: missing ? null : Math.max(0, target - recognized),
        tier: missing ? null : achievement >= 150 && tailoredCount === null
          ? '맞춤제안 확인 필요' : threshold ? `${threshold}% 구간` : '90% 미만',
        rank: null,
      }];
    }));
    const status = excluded ? '평가 제외' : !snapshot?.has_input ? '미입력'
      : !confirmed ? '확인 대기' : metrics.some(({ key }) => progress[key].actual === null)
        ? '일부 미입력' : '확인 저장';
    return { store, asOfDate, confirmed, excluded, progress, status };
  });
  const rankDate = rows.map(row => row.confirmed && Object.values(row.progress).some(metric => metric.actual !== null) && row.asOfDate).filter(Boolean).sort().at(-1) ?? null;
  for (const key of Object.keys(PROGRESS_LABELS)) {
    const ranked = rows.filter(row => row.confirmed && row.asOfDate === rankDate && row.progress[key].achievement !== null)
      .map(row => row.progress[key]).sort((a, b) => b.achievement - a.achievement);
    ranked.forEach((metric, index) => {
      metric.rank = index && metric.achievement === ranked[index - 1].achievement ? ranked[index - 1].rank : index + 1;
    });
  }
  rows.sort((a, b) => Number(a.excluded) - Number(b.excluded) || (a.progress.hs.rank ?? Infinity) - (b.progress.hs.rank ?? Infinity));
  return { rows, rankDate };
}

const count = value => value.toLocaleString('ko-KR', { maximumFractionDigits: 1 });

export function progressMetricText(metric) {
  if (metric.actual === null) return { score: '미입력', counts: `목표 ${count(metric.target)}건`, tier: '구간 확인 대기' };
  const percent = Math.floor(metric.achievement * 10) / 10;
  return {
    score: `${count(percent)}%${metric.rank ? ` · ${metric.rank}위` : ''}`,
    counts: `${count(metric.actual)} / ${count(metric.target)}건`,
    tier: `${metric.tier} · ${metric.remaining ? `남은 ${count(metric.remaining)}건` : '목표 달성'}`,
  };
}

export function progressRowStatus(row, rankDate) {
  if (row.excluded) return row.status;
  const date = row.asOfDate || '기준일 미입력';
  return `${date} · ${row.status}${row.confirmed && row.asOfDate !== rankDate ? ' · 순위 제외' : ''}`;
}
