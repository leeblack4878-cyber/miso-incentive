import test from 'node:test';
import assert from 'node:assert/strict';
import { buildManagerProgress, progressMetricText, progressRowStatus } from '../src/managerProgress.js';

const sammi = '신천동_삼미시장점', sammi2 = '신천동_삼미시장2호점', sanbon = '광정동_산본점';
const stores = [sammi, sammi2, sanbon, '월곶동_월곶점'];
const snapshot = (store_name, metrics, extra = {}) => ({
  store_name, metrics, confirmed: true, has_input: true, as_of_date: '2026-11-04', ...extra,
});
const report = snapshots => buildManagerProgress(stores, snapshots, '2026-11', '2026-11-04');

test('ranks by normalized recognized HS and keeps half units in the shortfall', () => {
  const { rows } = report([
    snapshot(sammi2, { hs: 58, simMnp: 4, secondTotal: 3, home: 0 }),
    snapshot(sanbon, { hs: 100, simMnp: 0, secondTotal: 0 }),
    snapshot(sammi, { hs: 200, simMnp: 0, secondTotal: 0 }),
  ]);
  assert.equal(rows[0].store, sammi2);
  assert.deepEqual(rows[0].progress.hs, {
    target: 65, actual: 63.5, achievement: 63.5 / 65 * 100, remaining: 1.5, tier: '90% 구간', rank: 1,
  });
  assert.equal(rows[1].progress.hs.rank, 2);
  assert.equal(rows[0].progress.home.actual, 0);
  assert.equal(rows[0].progress.tvFree.actual, null);
  assert.equal(rows.at(-1).status, '평가 제외');
  assert.equal(rows.at(-1).progress.hs.rank, null);
});

test('excludes missing, unconfirmed, older and invalid-date inputs from ranks', () => {
  const { rows, rankDate } = report([
    snapshot(sammi2, { hs: 65, simMnp: 0, home: 0 }),
    snapshot(sanbon, { hs: 140, simMnp: 0, secondTotal: 0 }, { as_of_date: '2026-11-03' }),
    snapshot(stores[3], { home: 3 }, { as_of_date: '2026-11-31' }),
  ]);
  const byStore = Object.fromEntries(rows.map(row => [row.store, row]));
  assert.equal(rankDate, '2026-11-04');
  assert.equal(byStore[sammi2].progress.hs.actual, null);
  assert.equal(byStore[sammi2].progress.home.rank, 1);
  assert.equal(byStore[sanbon].progress.hs.rank, null);
  assert.match(progressRowStatus(byStore[sanbon], rankDate), /순위 제외/);
  assert.equal(byStore[stores[3]].asOfDate, null);
  assert.equal(byStore[stores[3]].progress.home.rank, null);
  assert.equal(report([snapshot(sammi2, { home: 5 }, { confirmed: false })]).rankDate, null);
  assert.equal(report([]).rows.find(row => row.store === sanbon).status, '미입력');
});

test('same ratios tie, and 150% uses the existing tailored-count rule', () => {
  const metrics = { hs: 100, simMnp: 0, secondTotal: 0 };
  const { rows } = report([
    snapshot(sammi2, { ...metrics, hs: 103, secondTotal: 2, tailoredCount: 40 }),
    snapshot(sanbon, { ...metrics, hs: 224, tailoredCount: 40 }),
    snapshot(stores[3], metrics),
  ]);
  assert.equal(rows[0].progress.hs.rank, 1);
  assert.equal(rows[1].progress.hs.rank, 1);
  assert.equal(rows[2].progress.hs.rank, 3);
  assert.equal(rows[0].progress.hs.tier, '150% 구간');
  assert.equal(rows[1].progress.hs.tier, '120% 구간');
  assert.equal(rows[2].progress.hs.tier, '맞춤제안 확인 필요');
  assert.match(progressMetricText(rows[2].progress.hs).tier, /목표 달성/);
});
