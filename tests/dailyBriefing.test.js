import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAllBriefingText, buildStoreBriefingText, canAccessDailyBriefing, dailyInputStatus, projectMetric } from '../src/dailyBriefing.js';

test('일일 브리핑은 이강진 계정만 접근한다', () => {
  assert.equal(canAccessDailyBriefing('a50a0979-acef-40b1-98b7-f05074f1c835'), true);
  assert.equal(canAccessDailyBriefing('f0329992-ced4-4407-b71d-ed58c5d74aaf'), false);
  assert.equal(canAccessDailyBriefing(''), false);
});

test('실적 입력·0건 확인·미입력·휴무를 구분한다', () => {
  assert.equal(dailyInputStatus({ hasPerformance: true }), 'input');
  assert.equal(dailyInputStatus({ zeroConfirmed: true }), 'zero');
  assert.equal(dailyInputStatus({}), 'missing');
  assert.equal(dailyInputStatus({ dayOff: true, zeroConfirmed: true }), 'off');
});

test('예상마감 달성률로 잘함·주의·부족을 구분한다', () => {
  assert.equal(projectMetric({ current: 5, target: 10, factor: 2 }).state, 'good');
  assert.equal(projectMetric({ current: 4, target: 10, factor: 2 }).state, 'watch');
  assert.equal(projectMetric({ current: 3, target: 10, factor: 2 }).state, 'low');
  assert.equal(projectMetric({ current: 3, target: 0, factor: 2 }).state, 'unset');
});

test('매장별 복사 문구에 미입력자와 강점·부족 항목을 포함한다', () => {
  const inputRows = [
    { name: '직원A', status: 'input', summary: 'HS 1건' },
    { name: '직원B', status: 'zero' },
    { name: '직원C', status: 'missing' },
    { name: '직원D', status: 'off' },
  ];
  const metrics = [
    { label: 'HS', unit: 'count', ...projectMetric({ current: 5, target: 10, factor: 2 }) },
    { label: '홈', unit: 'count', ...projectMetric({ current: 2, target: 10, factor: 2 }) },
  ];
  const text = buildStoreBriefingText({ dateLabel: '9월 4일', storeName: '월곶점', inputRows, metrics });
  assert.match(text, /미입력 확인: 직원C/);
  assert.match(text, /잘하고 있는 항목: HS/);
  assert.match(text, /보완할 항목: 홈/);
  assert.match(buildAllBriefingText({ dateLabel: '9월 4일', stores: [{ storeName: '월곶점', inputRows, metrics }] }), /입력 1명 · 0건 확인 1명 · 미입력 1명 · 휴무 1명/);
});
