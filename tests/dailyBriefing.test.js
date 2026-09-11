import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAllBriefingText, buildStoreBriefingText, canAccessDailyBriefing, dailyInputStatus, isBriefingMonthOverdueHome, projectMetric, resolveStoreBriefingGoals } from '../src/dailyBriefing.js';

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

test('브리핑 목표는 매장 도전 목표를 우선하고 없는 값은 회사 기준으로 보완한다', () => {
  const goals = resolveStoreBriefingGoals({
    defaults: { hs: 52, home: 5, productivity: 65, tvFree: 4, smartHome: 3, tailoredCount: 26 },
    companyGoals: { hs: 52, home: 5, productivity: 65, tvFree: 4, smartHome: 3, tailoredCount: 26 },
    challengeGoals: { hs: 52, simMnp: 5, second: 10, home: 5, productivity: 65, tvFree: 4, smartHome: 2, sono: 2, tailoredAmount: 243868 },
  });

  assert.equal(goals.simMnp, 5);
  assert.equal(goals.second, 10);
  assert.equal(goals.sono, 2);
  assert.equal(goals.tailoredAmount, 243868);
  assert.equal(goals.smartHome, 2);
  assert.equal(goals.tailoredCount, 26);
});

test('당월 브리핑의 미완료 경고는 당월 청약건만 포함한다', () => {
  const today = '2026-09-11';
  assert.equal(isBriefingMonthOverdueHome({ source_work_date: '2026-08-31', plannedDate: '2026-09-03' }, '2026-09', today), false);
  assert.equal(isBriefingMonthOverdueHome({ source_work_date: '2026-09-01', plannedDate: '2026-09-03' }, '2026-09', today), true);
  assert.equal(isBriefingMonthOverdueHome({ source_work_date: '2026-09-01', plannedDate: '2026-09-12' }, '2026-09', today), false);
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
  assert.match(text, /\[월말 예상 · 좋은 흐름\]\n- HS 10건 \(목표 대비 100%\)/);
  assert.match(text, /\[월말 예상 · 보완 필요\]\n- 홈 4건 \(목표 대비 40%\)/);
  assert.match(text, /\[오늘 함께 챙길 것\]\n- 고객 약속 1건을 확인해주세요\.\n- 오늘 홈 설치 1건을 확인해주세요\.\n- 직원C님의 입력 여부를 확인해주세요\.\n- 홈 실적을 우선 보완해주세요\./);
  assert.match(text, /고객 약속 1건 · 김고객\(제휴카드 확인\)/);
  assert.match(text, /홈 설치 예정 1건 · 이고객/);
  assert.match(text, /예정일이 지난 홈 미완료 1건 · 박고객\(2026-09-03\)/);
  assert.match(text, /월곶점 화이팅!/);
  assert.match(buildAllBriefingText({ dateLabel: '9월 4일', stores: [{ storeName: '월곶점', inputRows, metrics }] }), /전체 근무 대상 3명 중 1명이 실적을 입력했고, 1명은 0건으로 확인했습니다/);
});

test('마지막 응원 문구는 날짜와 당일 상황에 맞게 선택된다', () => {
  const weak = [{ label: 'HS', unit: 'count', ...projectMetric({ current: 1, target: 10, factor: 1 }) }];
  const missing = [{ name: '직원A', status: 'missing' }];
  const weakText = buildStoreBriefingText({ dateLabel: '9월 7일', storeName: '주민센터점', metrics: weak });
  const missingText = buildStoreBriefingText({ dateLabel: '9월 7일', storeName: '주민센터점', inputRows: missing, metrics: weak });
  assert.match(weakText, /HS/);
  assert.match(missingText, /입력/);
  assert.notEqual(weakText.split('\n').at(-1), missingText.split('\n').at(-1));
  assert.equal(
    weakText.split('\n').at(-1),
    buildStoreBriefingText({ dateLabel: '9월 7일', storeName: '주민센터점', metrics: weak }).split('\n').at(-1),
  );
});

test('브리핑 건수형 예상마감은 정수로 표시하고 지표별로 줄을 나눈다', () => {
  const metrics = [
    { label: '스홈', unit: 'count', ...projectMetric({ current: 2, target: 4, factor: 30 / 7 }) },
    { label: '업셀건', unit: 'count', ...projectMetric({ current: 16, target: 35, factor: 30 / 7 }) },
    { label: 'HS', unit: 'count', ...projectMetric({ current: 9, target: 70, factor: 30 / 7 }) },
    { label: '홈', unit: 'count', ...projectMetric({ current: 1, target: 7, factor: 30 / 7 }) },
  ];
  const text = buildStoreBriefingText({ dateLabel: '9월 7일', storeName: '주민센터점', metrics });
  assert.match(text, /- 스홈 9건/);
  assert.match(text, /- 업셀건 69건/);
  assert.match(text, /- HS 39건/);
  assert.match(text, /- 홈 4건/);
  assert.doesNotMatch(text, /8\.6건|68\.6건|38\.6건|4\.3건/);
});
