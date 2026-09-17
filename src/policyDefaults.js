import { DEFAULT_MOBILE_POINT_ITEMS, DEFAULT_KPI_ITEMS, DEFAULT_GIBYEON_COLUMN_MAP, DEFAULT_VAS, DEFAULT_RENEW, DEFAULT_BUNDLE2ND, DEFAULT_SONO, DEFAULT_MNP_BUNDLE } from './appShared';
import { DEFAULT_HOME_FLAT, DEFAULT_HOME_ADDON } from './viewShared';
export const DEFAULT_BASE_PAY = { 점장: 2800000, 부점장: 2600000, 매니저: 2500000, 사원: 2300000, 기타: 0 };

export const DEFAULT_BASE_PENALTY = 200000;

export const DEFAULT_POSITION_ALLOWANCE = { 점장: 500000, 부점장: 200000, 매니저: 200000, 사원: 0, 기타: 0 };

export const DEFAULT_TENURE = [
  { key: 'under6', label: '6개월 미만 (실적무관)', rate: 0 },
  { key: 'under12', label: '12개월 미만', rate: 200000 },
  { key: 'over12', label: '12개월 이상', rate: 150000 },
  { key: 'over24', label: '24개월 이상', rate: 100000 },
];

export const DEFAULT_TENURE_CAP = 2300000;

export const DEFAULT_GRADES = [
  { grade: 'S', min: 55, bonus: 1000000 },
  { grade: 'A', min: 45, bonus: 700000 },
  { grade: 'B', min: 35, bonus: 500000 },
  { grade: 'C', min: 25, bonus: 300000 },
  { grade: 'D', min: 0, bonus: 0 },
];

export const DEFAULT_HOME_TIERS = [
  { min: 1, rate: 500000 },
  { min: 2, rate: 600000 },
  { min: 3, rate: 700000 },
  { min: 5, rate: 800000 },
  { min: 7, rate: 900000 },
  { min: 10, rate: 1000000 },
];

export const DEFAULT_MATRIX = [
  [5, 3, 2, 1, 1, 0],       // 일반모델 신규
  [9, 6, 5, 4, 4, 2],       // 일반모델 MNP
  [5, 3, 2, 1, 1, 0],       // 일반모델 기변A
  [5, 3, 2, 1, 1, 0],       // 일반모델 기변B (A와 동일)
  [2.5, 1.5, 1, 0.5, 0.5, 0], // 일반모델 기변C (A/B의 50%)
  [10, 10, 10, 7, 5, 5],    // SIM MNP
  [0, 0, 0, 0, 0, 0],       // 중고 신규(66군↑) — 인센티브 무관, 항상 0
  [5, 0, 0, 0, 0, 0],       // 2ND — 단일 단가 (건당 5만원)
].map((row) => row.map((v) => v * 10000));

export const DEFAULT_CATEGORY_MAP = [
  { mobilePointKey: 'new010', kpiKey: 'kpiNew010' },        // 일반모델 신규
  { mobilePointKey: 'mnp', kpiKey: 'kpiMnp' },               // 일반모델 MNP
  { mobilePointKey: '', kpiKey: 'kpiGibyeonA' },             // 일반모델 기변A (성과등급P는 열 기준)
  { mobilePointKey: '', kpiKey: 'kpiGibyeonB' },             // 일반모델 기변B (성과등급P는 열 기준)
  { mobilePointKey: '', kpiKey: 'kpiGibyeonC' },             // 일반모델 기변C (성과등급P는 열 기준)
  { mobilePointKey: 'usedMnp', kpiKey: 'kpiSimMnp' },        // SIM MNP = 중고 MNP(선약가입건)
  { mobilePointKey: '', kpiKey: 'kpiUsedNew010' },           // 중고 신규(66군↑) — 인센티브 무관, KPI만 반영
  { mobilePointKey: 'secondOnly', kpiKey: 'kpiSecond' },     // 2ND
];

export const mergeDefaultVas = (saved=[]) => [
  ...DEFAULT_VAS.map(def => ({ ...def, ...(saved||[]).find(item => item.key===def.key) })),
  ...(saved||[]).filter(item => !DEFAULT_VAS.some(def => def.key===item.key)),
];

export const DEFAULT_CUSTREG_TIERS = [
  { min: 20, bonus: 100000 },
  { min: 30, bonus: 150000 },
  { min: 40, bonus: 200000 },
];

export const DEFAULT_TAILORED_TIERS = [
  { min: 10, bonus: 70000 },
  { min: 15, bonus: 150000 },
  { min: 20, bonus: 200000 },
  { min: 25, bonus: 300000 },
  { min: 30, bonus: 400000 },
];

export function defaultConfig() {
  return {
    basePay: { ...DEFAULT_BASE_PAY },
    positionAllowance: { ...DEFAULT_POSITION_ALLOWANCE },
    mobilePointItems: DEFAULT_MOBILE_POINT_ITEMS.map((i) => ({ ...i })),
    kpiItems: DEFAULT_KPI_ITEMS.map((i) => ({ ...i })),
    categoryMap: DEFAULT_CATEGORY_MAP.map((i) => ({ ...i })),
    gibyeonColumnMap: [...DEFAULT_GIBYEON_COLUMN_MAP],
    basePenalty: DEFAULT_BASE_PENALTY,
    tenure: DEFAULT_TENURE.map((t) => ({ ...t })),
    tenureCap: DEFAULT_TENURE_CAP,
    grades: DEFAULT_GRADES.map((g) => ({ ...g })),
    homeTiers: DEFAULT_HOME_TIERS.map((t) => ({ ...t })),
    homeFlat: DEFAULT_HOME_FLAT.map((t) => ({ ...t })),
    homeAddon: DEFAULT_HOME_ADDON.map((t) => ({ ...t })),
    renew: DEFAULT_RENEW.map((t) => ({ ...t })),
    matrix: DEFAULT_MATRIX.map((row) => [...row]),
    vas: DEFAULT_VAS.map((t) => ({ ...t })),
    bundle2nd: DEFAULT_BUNDLE2ND.map((t) => ({ ...t })),
    sono: DEFAULT_SONO.map((t) => ({ ...t })),
    mnpBundle: DEFAULT_MNP_BUNDLE.map((t) => ({ ...t })),
    custRegTiers: DEFAULT_CUSTREG_TIERS.map((t) => ({ ...t })),
    tailoredTiers: DEFAULT_TAILORED_TIERS.map((t) => ({ ...t })),
  };
}
