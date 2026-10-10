import test from 'node:test';
import assert from 'node:assert/strict';
import { briefingMobileCount, buildBriefingPeriodRows, buildAllBriefingText, buildStoreBriefingText, canAccessDailyBriefing, dailyInputStatus, isBriefingMonthOverdueHome, projectMetric, resolveStoreBriefingGoals } from '../src/dailyBriefing.js';

test('산본 SIM MNP 5건은 중고 결합과 무관하게 예상 8.3건·69%다',()=>{
 const matrix=Array.from({length:8},()=>[0]);matrix[5]=[3,2];matrix[7]=[2];
 const draft={matrix,mnpBundle:{used:99},bundle2nd:{watch:3}};
 assert.equal(briefingMobileCount(draft,'simMnp'),5);
 assert.equal(briefingMobileCount(draft,'second'),5);
 const metric=projectMetric({current:briefingMobileCount(draft,'simMnp'),target:12,factor:30/18});
 assert.equal(metric.forecast.toFixed(1),'8.3');assert.equal(Math.round(metric.forecastRate),69);
});

test('선택일 이후 일일 실적과 홈 완료는 제외하고 전월 청약의 당월 설치는 포함한다',()=>{
 const rows=[{id:'a'},{id:'b'}],dailyRecords={a:{'01':{n:2},'18':{n:3},'19':{n:10}},b:{'19':{n:99}}};
 const order=(id,date,status='completed',user_id='a')=>({id,user_id,status,source_work_date:'2026-08-31',actual_install_date:date});
 const orders=[order(1,'2026-09-18'),order(2,'2026-09-19'),order(3,'2026-08-31'),order(4,'2026-09-17','cancelled'),order(5,null,'pending'),order(6,'2026-09-18','completed','b')];
 const args={rows,dailyRecords,orders,month:'2026-09',rebuild:(row,days,homes)=>({...row,total:Object.values(days).reduce((s,d)=>s+d.n,0),homes:homes.map(h=>h.id)})};
 assert.deepEqual(buildBriefingPeriodRows({...args,reportDay:18}),[{id:'a',total:5,homes:[1]},{id:'b',total:0,homes:[6]}]);
 assert.deepEqual(buildBriefingPeriodRows({...args,reportDay:1}),[{id:'a',total:2,homes:[]},{id:'b',total:0,homes:[]}]);
 assert.equal(buildBriefingPeriodRows({...args,reportDay:19})[0].total,15);
 assert.equal(dailyRecords.a['19'].n,10);
});

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

test('브리핑은 목표·실적·달성·진척 차이와 업무 건수만 전달한다', () => {
  const metrics = [
    {label:'HS',unit:'count',...projectMetric({current:25,target:100,factor:31/10,elapsedRate:10/31*100})},
    {label:'홈',unit:'count',...projectMetric({current:4,target:10,factor:31/10,elapsedRate:10/31*100})},
    {label:'소노',unit:'count',...projectMetric({current:2,target:0,factor:31/10,elapsedRate:10/31*100})},
  ];
  const inputRows=[{name:'직원A',status:'input'},{name:'직원B',status:'zero'},{name:'직원C',status:'missing'},{name:'직원D',status:'off'}];
  const store={storeName:'월곶점',inputRows,metrics,todayTasks:[{customerName:'고객A'}],todayInstalls:[{}],overdueInstalls:[{}]};
  const text=buildStoreBriefingText({dateLabel:'10월 10일',...store});
  assert.match(text,/진척 기준 32.3%/);
  assert.match(text,/HS \| 목표 100건 · 실적 25건 · 달성 25% \| 진척 대비 7.3%p 부족/);
  assert.match(text,/홈 \| 목표 10건 · 실적 4건 · 달성 40% \| 진척 대비 7.7%p 초과/);
  assert.match(text,/소노 \| 목표 미설정 · 실적 2건 · 달성 — \| 진척 비교 불가/);
  assert.match(text,/입력 1명 · 0건 1명 · 미입력 1명 · 휴무 1명/);
  assert.match(text,/미입력: 직원C/);
  assert.match(text,/오늘 약속 1건 · 설치 1건 · 설치 지연 1건/);
  assert.doesNotMatch(text,/화이팅|좋은 아침|예상|함께 챙길|고객A/);
  assert.match(buildAllBriefingText({dateLabel:'10월 10일',stores:[store]}),/HS \| 목표 100건 · 실적 25건/);
});

test('진척 비교는 선택일 기준이며 월초·월말·과거월과 소수 실적을 정확히 표시한다', () => {
  const text=(current,target,elapsedRate,unit='count')=>buildStoreBriefingText({metrics:[{label:'지표',unit,...projectMetric({current,target,factor:1,elapsedRate})}]});
  assert.match(text(0,31,100/31),/진척 대비 3.2%p 부족/);
  assert.match(text(31,31,100),/진척 대비 동일/);
  assert.match(text(40,31,100),/진척 대비 29%p 초과/);
  // Past-month forecasts may use factor=1; pace still uses the selected day.
  assert.match(text(15,30,50),/달성 50% \| 진척 대비 동일/);
  assert.match(text(2.4,10,20,'point'),/목표 10P · 실적 2.4P · 달성 24%/);
  assert.match(text(123456,500000,20,'won'),/목표 500,000원 · 실적 123,456원/);
  assert.match(text(0,10,50),/실적 0건 · 달성 0% \| 진척 대비 50%p 부족/);
});
