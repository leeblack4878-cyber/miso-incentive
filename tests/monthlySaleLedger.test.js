import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPolicySnapshot, calculateMobileSale, calculateMonthlySaleLedger,
  latestActiveSales,
} from '../src/policyEngine.js';

const policy = createPolicySnapshot({
  version: '2026-08-v1',
  matrixRates: [[50000, 30000, 20000], [40000, 25000, 10000], [70000, 50000, 30000]],
  vasRates: [
    { key: 'vasSafePass', rate: 0 }, { key: 'vasPhonePass', rate: 10000 },
    { key: 'vasKyobo', rate: 20000 }, { key: 'vasVcolor', rate: 5000 },
  ],
  bundleRates: [{ key: 'watch', rate: 200000 }, { key: 'tablet', rate: 150000 }],
});

const sale = (id, ri, ci, meta = {}) => ({
  id, status: 'completed', source_meta: { ri, ci, policySnapshot: policy, ...meta },
});

test('기변·신규·MNP는 판매 당시 행·열 정책 수수료를 사용한다', () => {
  assert.equal(calculateMobileSale(sale('change', 0, 0)).paid.plan, 50000);
  assert.equal(calculateMobileSale(sale('new', 1, 1)).paid.plan, 25000);
  assert.equal(calculateMobileSale(sale('mnp', 2, 0)).paid.plan, 70000);
});

test('2ND 단독·번들은 모두 0.2P이며 교보문고·V컬러링은 2ND VAS 지급에서 제외한다', () => {
  const result = calculateMobileSale(sale('second', 0, 0, {
    secondOnlyCount: 1,
    bundle2ndKeys: ['watch'],
    bundleVasMap: { watch: ['vasSafePass', 'vasKyobo', 'vasVcolor'] },
  }));
  assert.equal(result.secondCount, 2);
  assert.equal(result.performancePoints, 0.4);
  assert.equal(result.bundleVasPay, 0);
  assert.equal(result.insurancePoints, 0.8);
});

test('폰안심패스는 인센티브 0원·보험 전략P 0.8P다', () => {
  const result = calculateMobileSale(sale('safe', 0, 2, { vasKeys: ['vasSafePass'] }));
  assert.equal(result.directVasPay, 0);
  assert.equal(result.insurancePoints, 0.8);
});

test('무료폰 특가는 요금제·VAS·보험만 제외하고 건수·2ND·스팟을 유지한다', () => {
  const result = calculateMobileSale(sale('free', 2, 0, {
    vasKeys: ['vasKyobo'], bundle2ndKeys: ['watch'], approvedSpotIncentive: 30000,
    specialPolicy: { policyType: 'free_phone', policyTitle: '무료폰 특가' },
  }));
  assert.deepEqual(result.paid, { plan: 0, vas: 0, insurance: 0, second: 200000, spot: 30000 });
  assert.equal(result.activityCount, 2);
  assert.equal(result.performancePoints, 0.2);
});

test('수정 전후 리비전은 최신 1건만 계산하고 삭제·취소는 제외한다', () => {
  const rows = [
    { ...sale('old', 0, 0), logical_sale_id: 'a', revision: 1 },
    { ...sale('new', 2, 0), logical_sale_id: 'a', revision: 2 },
    { ...sale('deleted', 0, 0), deleted: true },
    { ...sale('cancelled', 0, 0), status: 'cancelled' },
  ];
  const active = latestActiveSales(rows);
  assert.equal(active.length, 1);
  assert.equal(active[0].id, 'new');
});

test('과거 판매 수정은 현재 정책이 바뀌어도 저장된 정책 버전과 금액을 유지한다', () => {
  const oldPolicy = createPolicySnapshot({ version: '2026-07-v1', matrixRates: [[10000]] });
  const currentPolicy = createPolicySnapshot({ version: '2026-08-v1', matrixRates: [[90000]] });
  const oldSale = { id: 'legacy', source_meta: { ri: 0, ci: 0, policySnapshot: oldPolicy } };
  const result = calculateMobileSale(oldSale, currentPolicy);
  assert.equal(result.policyVersion, '2026-07-v1');
  assert.equal(result.paid.plan, 10000);
});

const employeeCases = [
  { name: '신입 사원 무실적', input: { monthsEmployed: 4, minimumGuarantee: 2300000, sales: [] }, total: 2300000 },
  { name: '8개월 사원 기변 5건', input: { monthsEmployed: 8, activityRate: 200000, minimumGuarantee: 2300000, sales: Array.from({ length: 5 }, (_, i) => sale(`c${i}`, 0, 0)) }, total: 2300000 },
  { name: '8개월 사원 MNP+2ND', input: { monthsEmployed: 8, activityRate: 200000, minimumGuarantee: 2300000, sales: [sale('m1', 2, 0, { bundle2ndKeys: ['watch'] })] }, total: 2300000 },
  { name: '15개월 매니저 직책수당', input: { monthsEmployed: 15, activityRate: 150000, minimumGuarantee: 2500000, positionAllowance: 200000, sales: [sale('n1', 1, 1)] }, total: 2500000 },
  { name: '무료폰 특가 직원', input: { monthsEmployed: 10, activityRate: 200000, minimumGuarantee: 2300000, sales: [sale('f1', 2, 0, { bundle2ndKeys: ['watch'], specialPolicy: { policyType: 'free_phone' } })] }, total: 2300000 },
  { name: '고성과 점장', input: { monthsEmployed: 30, activityRate: 100000, minimumGuarantee: 2800000, positionAllowance: 500000, sales: Array.from({ length: 12 }, (_, i) => sale(`p${i}`, 2, 0, { bundle2ndKeys: ['watch'] })) }, total: 6040000 },
  { name: '홈·성과급 추가 사원', input: { monthsEmployed: 8, activityRate: 200000, minimumGuarantee: 2300000, extras: { homePay: 700000, gradeBonus: 300000 }, sales: [sale('e1', 0, 0)] }, total: 3300000 },
  { name: '과거정책 판매 직원', input: { monthsEmployed: 13, activityRate: 150000, minimumGuarantee: 2300000, sales: [{ id: 'legacy', source_meta: { ri: 0, ci: 0, policySnapshot: createPolicySnapshot({ version: '2026-07-v1', matrixRates: [[10000]] }) } }] }, total: 2300000 },
];

test('대표 직원 8명의 월간 최종 예상 급여가 정답 원장과 일치한다', () => {
  employeeCases.forEach(({ name, input, total }) => {
    const result = calculateMonthlySaleLedger({ currentPolicy: policy, ...input });
    assert.equal(result.total, total, name);
  });
});
