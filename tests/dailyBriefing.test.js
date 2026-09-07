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

test('매장별 복사 문구는 매장 단톡방에 바로 전달할 수 있는 대화형 피드백이다', () => {
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
  const text = buildStoreBriefingText({ dateLabel: '9월 4일', storeName: '월곶점', inputRows, metrics,
    todayTasks:[{customerName:'김고객',title:'제휴카드 확인'}],
    todayInstalls:[{customerName:'이고객'}],
    overdueInstalls:[{customerName:'박고객',plannedDate:'2026-09-03'}],
  });
  assert.match(text, /좋은 아침입니다 😊 9월 4일 월곶점 브리핑 공유드립니다/);
  assert.match(text, /현재 근무 대상 3명 중 1명이 실적을 입력했습니다/);
  assert.match(text, /1명은 실적 0건으로 확인했습니다/);
  assert.match(text, /아직 입력이 확인되지 않은 직원은 직원C입니다/);
  assert.match(text, /월말 예상 기준으로 HS .*은 좋은 흐름입니다/);
  assert.match(text, /반면 홈 .*은 보완이 필요합니다/);
  assert.match(text, /홈 실적을 우선 보완하고, 직원C님의 입력 여부를 확인하고/);
  assert.match(text, /고객 약속 1건 · 김고객\(제휴카드 확인\)/);
  assert.match(text, /홈 설치 예정 1건 · 이고객/);
  assert.match(text, /예정일이 지난 홈 미완료 1건 · 박고객\(2026-09-03\)/);
  assert.match(text, /월곶점 화이팅! 💪/);
  assert.match(buildAllBriefingText({ dateLabel: '9월 4일', stores: [{ storeName: '월곶점', inputRows, metrics }] }), /전체 근무 대상 3명 중 1명이 실적을 입력했고, 1명은 0건으로 확인했습니다/);
});
