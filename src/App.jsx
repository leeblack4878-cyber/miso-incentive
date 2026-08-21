import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Trophy, Home, ClipboardList, History, TrendingUp, Users, ChevronDown, Plus,
  Minus, Award, Loader2, Check, Settings, LayoutDashboard, Wallet, Trash2,
  UserPlus, Info, Layers, Calendar, ChevronLeft, ChevronRight, AlertTriangle, Zap,
  UploadCloud, X, Target, ShieldCheck, LogOut, Bell
} from 'lucide-react';
import { supabase } from './supabase';
import { friendlyError } from './errorMessages';
import PendingApprovals from './PendingApprovals';
import ProfileEditRequests, { ProfileEditRequestForm } from './ProfileEditRequests';

/* ===================== 기본 정책 상수 (관리자가 수정 가능) ===================== */

const POSITIONS = ['점장', '부점장', '매니저', '사원', '기타'];
const DEFAULT_BASE_PAY = { 점장: 2800000, 부점장: 2600000, 매니저: 2500000, 사원: 2300000, 기타: 0 };
const DEFAULT_BASE_PENALTY = 200000; // 활동시간 미충족시 차감
const DEFAULT_POSITION_ALLOWANCE = { 점장: 500000, 부점장: 200000, 매니저: 200000, 사원: 0, 기타: 0 }; // 직책수당 — 영업활동지원금 초과여부 체크에 포함

const DEFAULT_STORES = [
  '신천동_삼미시장점', '신천동_삼미시장2호점', '본오3동_상록수역점', '대야동_롯데마트점',
  '본오3동_주민센터점', '장곡동_장곡역점', '거모동_도일시장점', '월곶동_월곶점',
  '월피동_성포역점', '광정동_산본점', '고잔동_법조타운점', '은행동_은계사거리점', '본오1동_본오중학교점',
  '영업지원팀',
];
// 실제 영업을 하지 않는 조직 — 실적표/실적비교/지급 총액 집계에서 제외
const NON_SALES_STORES = ['운영진', '영업지원팀'];

const DEFAULT_TENURE = [
  { key: 'under6', label: '6개월 미만 (실적무관)', rate: 0 },
  { key: 'under12', label: '12개월 미만', rate: 200000 },
  { key: 'over12', label: '12개월 이상', rate: 150000 },
  { key: 'over24', label: '24개월 이상', rate: 100000 },
];
const DEFAULT_TENURE_CAP = 2300000;

const DEFAULT_GRADES = [
  { grade: 'S', min: 55, bonus: 1000000 },
  { grade: 'A', min: 45, bonus: 700000 },
  { grade: 'B', min: 35, bonus: 500000 },
  { grade: 'C', min: 25, bonus: 300000 },
  { grade: 'D', min: 0, bonus: 0 },
];
const HOME_GATE_MIN = 3; // 홈 최소조건(성과 인정 게이트)
const ADDON_GATE = 35;   // 모바일 P가 이 값 초과일 때만 홈 가점 반영
// 홈 최소조건(3점) 전용 배점 — 성과P 안내표와는 별개 기준 (인터넷:1점, 프리:0.3점, 스홈:0.2점)
const HOME_GATE_WEIGHTS = { homeOnly: 1, homeTv: 1, tvFree: 0.3, smartHome: 0.2 };

const DEFAULT_MOBILE_POINT_ITEMS = [
  { key: 'mnp', label: 'MNP', point: 1.5, countsTenure: true },
  { key: 'new010', label: '010 신규', point: 1, countsTenure: true },
  { key: 'gibyeon115', label: '기기변경 (115군↑)', point: 1, countsTenure: true },
  { key: 'gibyeon85', label: '기기변경 (85군↑)', point: 0.7, countsTenure: true },
  { key: 'gibyeonWeak', label: '기변 (약자요금제)', point: 0.5, countsTenure: true },
  { key: 'gibyeonLVC', label: '기변 (85군 미만)', point: 0.3, countsTenure: true },
  { key: 'usedMnp', label: '중고 MNP (선약가입건)', point: 1, countsTenure: true },
  { key: 'secondOnly', label: '2ND(단독개통포함)', point: 0.2, countsTenure: true },
];

const DEFAULT_KPI_ITEMS = [
  { key: 'kpiMnp', label: 'MNP', point: 1.7 },
  { key: 'kpiNew010', label: '010 신규', point: 1.5 },
  { key: 'kpiGibyeonA', label: '기변A', point: 1 },
  { key: 'kpiGibyeonB', label: '기변B', point: 0.8 },
  { key: 'kpiGibyeonC', label: '기변C', point: 0.5 },
  { key: 'kpiSecond', label: '2ND', point: 0.2 },
  { key: 'kpiSimMnp', label: 'SIM MNP', point: 1 },
  { key: 'kpiUsedNew010', label: '중고 010신규 (66군 이상)', point: 0.5 },
  { key: 'kpiHome', label: '홈', point: 1 },
  { key: 'kpiTv', label: 'TV', point: 1 },
  { key: 'kpiTvSetTop', label: 'TV부셋탑', point: 0.5 },
  { key: 'kpiSmartHome', label: '스마트홈', point: 0.5 },
  { key: 'kpiInternetRenew', label: '인터넷 재약정', point: 0.3 },
  { key: 'kpiTvRenew', label: 'TV 재약정', point: 0.3 },
];

const HOME_BASE_ITEMS = [
  { key: 'homeOnly', label: '홈 단독', point: 1 },
  { key: 'homeTv', label: '홈+TV 동시청약', point: 2 },
];

const DEFAULT_HOME_TIERS = [
  { min: 1, rate: 500000 },
  { min: 2, rate: 600000 },
  { min: 3, rate: 700000 },
  { min: 5, rate: 800000 },
  { min: 7, rate: 900000 },
  { min: 10, rate: 1000000 },
];

const DEFAULT_HOME_FLAT = [
  { key: 'home1GBOnly', label: '1GB 단독', rate: 200000, point: 0 },
  { key: 'home500Only', label: '500MB 단독', rate: 100000, point: 0 },
  { key: 'home100Only', label: '100MB 단독', rate: 50000, point: 0 },
  { key: 'tvFree', label: 'TV프리(부)', rate: 100000, point: 0.5 },
  { key: 'smartHome', label: '스마트홈', rate: 100000, point: 0.5 },
];

const DEFAULT_HOME_ADDON = [
  { key: 'addNewChange', label: '신규/기변 동시판매', rate: 100000 },
  { key: 'addMnp', label: 'MNP 동시판매', rate: 300000 },
  { key: 'addUsedMnp', label: '중고MNP 동시판매 (85군↑ 선약, 가정망)', rate: 200000 },
  { key: 'addSetTop', label: '부셋탑 동시청약', rate: 50000 },
  { key: 'smartHomeSimul', label: '스마트홈 동시판매', rate: 50000 },
];

const DEFAULT_RENEW = [
  { key: 'renewPremiumSafe1G', label: '재약정 - 프리미엄 안심보상 1GB', rate: 120000 },
  { key: 'renewPremiumSafe500', label: '재약정 - 프리미엄 안심보상 500MB', rate: 90000 },
  { key: 'renewPremium1G', label: '재약정 - 프리미엄 안심 1GB', rate: 110000 },
  { key: 'renewPremium500', label: '재약정 - 프리미엄 안심 500MB', rate: 80000 },
  { key: 'renewSmart1G', label: '재약정 - 스마트 1GB', rate: 20000 },
  { key: 'renewSimul1G', label: '재약정 - 동시판매 1GB', rate: 80000 },
  { key: 'renewSimul500', label: '재약정 - 동시판매 500MB', rate: 50000 },
  { key: 'renewTvUpsell', label: 'TV 업셀 수수료', rate: 20000 },
];

const MATRIX_ROW_DEFS = [
  { label: '일반모델 신규', dailyLabel: '신규', hasTiers: true },
  { label: '일반모델 MNP', dailyLabel: 'MNP', hasTiers: true },
  { label: '일반모델 기변A', dailyLabel: '기기변경 A', hasTiers: true, isGibyeon: true },
  { label: '일반모델 기변B', dailyLabel: '기기변경 B', hasTiers: true, isGibyeon: true },
  { label: '일반모델 기변C', dailyLabel: '기기변경 C', hasTiers: true, isGibyeon: true },
  { label: 'SIM MNP', dailyLabel: 'SIM MNP(선약)', hasTiers: true },
  { label: '중고 신규(66군↑)', dailyLabel: '중고 신규(66군 이상)', hasTiers: false }, // 인센티브 무관 — 요금제군 구분 없이 건수만
  { label: '2ND', dailyLabel: '2ND', hasTiers: false }, // 요금제군 구분 없이 건수만, 단일 단가 적용
];
const MATRIX_ROWS = MATRIX_ROW_DEFS.map((r) => r.label);
const MATRIX_COLS = ['115군↑', '95~105군·청소년85군', '85군', '61군이상', '약자요금제', '그 외'];
const DEFAULT_MATRIX = [
  [5, 3, 2, 1, 1, 0],       // 일반모델 신규
  [9, 6, 5, 4, 4, 2],       // 일반모델 MNP
  [20, 17, 14, 10, 10, 7],  // 일반모델 기변A
  [15, 13, 12, 4, 4, 2],    // 일반모델 기변B
  [8, 7, 6, 3, 3, 2],       // 일반모델 기변C
  [10, 10, 10, 7, 5, 5],    // SIM MNP
  [0, 0, 0, 0, 0, 0],       // 중고 신규(66군↑) — 인센티브 무관, 항상 0
  [5, 0, 0, 0, 0, 0],       // 2ND — 단일 단가 (건당 5만원)
].map((row) => row.map((v) => v * 10000));

// 가입구분(매트릭스 행) → 성과포인트 항목 / KPI 항목 기본 매핑. 관리자 화면에서 수정 가능.
// 기변A/B/C(isGibyeon) 행은 성과포인트만은 타겟(A/B/C) 상관없이 요금제군(열) 기준으로 통일 적용 — gibyeonColumnMap 참고. KPI는 타겟별로 그대로 유지.
const DEFAULT_CATEGORY_MAP = [
  { mobilePointKey: 'new010', kpiKey: 'kpiNew010' },        // 일반모델 신규
  { mobilePointKey: 'mnp', kpiKey: 'kpiMnp' },               // 일반모델 MNP
  { mobilePointKey: '', kpiKey: 'kpiGibyeonA' },             // 일반모델 기변A (성과포인트는 열 기준)
  { mobilePointKey: '', kpiKey: 'kpiGibyeonB' },             // 일반모델 기변B (성과포인트는 열 기준)
  { mobilePointKey: '', kpiKey: 'kpiGibyeonC' },             // 일반모델 기변C (성과포인트는 열 기준)
  { mobilePointKey: 'usedMnp', kpiKey: 'kpiSimMnp' },        // SIM MNP = 중고 MNP(선약가입건)
  { mobilePointKey: '', kpiKey: 'kpiUsedNew010' },           // 중고 신규(66군↑) — 인센티브 무관, KPI만 반영
  { mobilePointKey: 'secondOnly', kpiKey: 'kpiSecond' },     // 2ND
];

// 기변 행(A/B/C 공통) 요금제군(열)별 성과포인트 매핑 — 115군↑/95~105군: 1P, 85군: 0.7P, 약자요금제: 0.5P, 61군이상·그외: 85군미만(0.3P)
const DEFAULT_GIBYEON_COLUMN_MAP = ['gibyeon115', 'gibyeon115', 'gibyeon85', 'gibyeonLVC', 'gibyeonWeak', 'gibyeonLVC'];

const DEFAULT_VAS = [
  { key: 'vasKyobo', label: '교보문고sam + 구글원', rate: 20000 },
  { key: 'vasVcolor', label: 'V컬러링 + 벨링콘텐츠팩', rate: 20000 },
  { key: 'vasPhonePass', label: '폰교체패스', rate: 10000 },
];

const DEFAULT_BUNDLE2ND = [
  { key: 'b_L335', label: '2ND · L335', rate: 200000 },
  { key: 'b_X216', label: '2ND · X216', rate: 200000 },
  { key: 'b_X236', label: '2ND · X236', rate: 150000 },
  { key: 'b_X236NP', label: '2ND · X236-NP', rate: 200000 },
  { key: 'b_L505', label: '2ND · L505', rate: 200000 },
  { key: 'b_L705', label: '2ND · L705(2025)', rate: 200000 },
  { key: 'b_L345', label: '2ND · L345(40mm)', rate: 200000 },
  { key: 'b_L355', label: '2ND · L355(44mm)', rate: 200000 },
  { key: 'b_L715', label: '2ND · L715', rate: 200000 },
  { key: 'b_AppleWatch', label: '2ND · 애플워치SE3 (아이폰14~17)', rate: 150000 },
];

const DEFAULT_SONO = [
  { key: 'sonoBasic', label: '소노 NEW 라이프케어', rate: 80000 },
  { key: 'sono594', label: '594만 상품', rate: 60000 },
];

const DEFAULT_MNP_BUNDLE = [
  { key: 'usedMnpBundle', label: '중고 MNP 결합 활성화 (61군↑ 개통·결합완료)', rate: 100000 },
];

const DEFAULT_CUSTREG_TIERS = [
  { min: 20, bonus: 100000 },
  { min: 30, bonus: 150000 },
  { min: 40, bonus: 200000 },
];
const DEFAULT_TAILORED_TIERS = [
  { min: 10, bonus: 70000 },
  { min: 15, bonus: 150000 },
  { min: 20, bonus: 200000 },
  { min: 25, bonus: 300000 },
  { min: 30, bonus: 400000 },
];


function displayStoreName(name) {
  const value = String(name || '');
  const idx = value.indexOf('_');
  return idx >= 0 ? value.slice(idx + 1) : value;
}

function defaultConfig() {
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

function emptyDraft() {
  return {
    activityTimeMet: true,
    homeNoPerformance: false,
    mobilePoint: {},
    kpi: {},
    homeBase: Object.fromEntries(HOME_BASE_ITEMS.map((i) => [i.key, 0])),
    homeFlat: Object.fromEntries(DEFAULT_HOME_FLAT.map((i) => [i.key, 0])),
    homeAddon: Object.fromEntries(DEFAULT_HOME_ADDON.map((i) => [i.key, 0])),
    renew: Object.fromEntries(DEFAULT_RENEW.map((i) => [i.key, 0])),
    matrix: MATRIX_ROWS.map(() => MATRIX_COLS.map(() => 0)),
    vas: Object.fromEntries(DEFAULT_VAS.map((i) => [i.key, 0])),
    bundle2nd: Object.fromEntries(DEFAULT_BUNDLE2ND.map((i) => [i.key, 0])),
    sono: Object.fromEntries(DEFAULT_SONO.map((i) => [i.key, 0])),
    mnpBundle: Object.fromEntries(DEFAULT_MNP_BUNDLE.map((i) => [i.key, 0])),
    custRegCount: 0,
    tailoredCount: 0,
    tailoredAmount: 0,
  };
}

/* ===================== 유틸 ===================== */

function won(n) { return `${Math.round(n || 0).toLocaleString()}원`; }
function monthKeyOf(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
function monthLabel(key) { const [y, m] = key.split('-'); return `${y}년 ${parseInt(m, 10)}월`; }
function formatLastSignIn(iso) {
  if (!iso) return '기록 없음';
  const d = new Date(iso);
  const diffDays = calendarDayDiff(d);
  const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
  if (diffDays <= 0) return `오늘 (${dateStr})`;
  if (diffDays === 1) return `어제 (${dateStr})`;
  return `${diffDays}일 전 (${dateStr})`;
}
function lastMonths(n) {
  const arr = []; const now = new Date();
  for (let i = 0; i < n; i++) arr.push(monthKeyOf(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  return arr;
}
function sumFlat(counts, table) { return table.reduce((s, t) => s + (counts[t.key] || 0) * t.rate, 0); }
function sumPoint(counts, table) { return table.reduce((s, t) => s + (counts[t.key] || 0) * t.point, 0); }
function tierBonus(count, tiers) {
  const sorted = [...tiers].sort((a, b) => b.min - a.min);
  const hit = sorted.find((t) => count >= t.min);
  return hit ? hit.bonus : 0;
}
function homeGradeTotal(tierCount, payableCount, tiers) {
  if (tierCount <= 0 || payableCount <= 0) return 0;
  const sorted = [...tiers].sort((a, b) => b.min - a.min);
  const hit = sorted.find((t) => tierCount >= t.min) || tiers[0];
  return payableCount * hit.rate;
}
function monthsSince(hireDate, monthKey) {
  if (!hireDate) return 0;
  const [y, m] = monthKey.split('-').map(Number);
  const monthEnd = new Date(y, m, 0);
  const hire = new Date(hireDate);
  if (isNaN(hire.getTime())) return 0;
  return Math.max(0, (monthEnd.getFullYear() - hire.getFullYear()) * 12 + (monthEnd.getMonth() - hire.getMonth()));
}
function tenureBucketOf(months) {
  if (months < 6) return 'under6';
  if (months < 12) return 'under12';
  if (months < 24) return 'over12';
  return 'over24';
}

function daysInMonth(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}
function emptyDayMatrix() { return MATRIX_ROWS.map(() => MATRIX_COLS.map(() => 0)); }

/* ===== 일일입력이 다루는 건수 그룹 — 모든 실적을 날짜별로 기록 ===== */

const DAILY_GROUP_DEFS = [
  { key: 'homeBase', label: '홈 실적 (그레이드 대상)', bucket: 'home' },
  { key: 'homeFlat', label: '홈 단독 / TV프리 / 스마트홈', bucket: 'home' },
  { key: 'homeAddon', label: '동시판매 수수료', bucket: 'home' },
  { key: 'renew', label: '홈 재약정', bucket: 'home' },
  { key: 'bundle2nd', label: '2ND 번들 판매', bucket: 'extra' },
  { key: 'vas', label: '전략 부가서비스 (VAS)', bucket: 'extra' },
  { key: 'sono', label: '소노', bucket: 'extra' },
  { key: 'mnpBundle', label: '중고MNP 결합', bucket: 'extra' },
];
const DAILY_GROUP_KEYS = DAILY_GROUP_DEFS.map((g) => g.key);
const DAILY_NUMERIC_KEYS = ['custRegCount', 'tailoredCount', 'tailoredAmount'];

function groupTable(config, key) {
  if (key === 'homeBase') return HOME_BASE_ITEMS;
  return (config && config[key]) || [];
}

// 홈·부가 실적 → KPI 생산성 항목 자동 반영 규칙
const HOME_KPI_MAP = [
  { kpiKey: 'kpiHome', sources: ['homeBase.homeOnly', 'homeBase.homeTv', 'homeFlat.home1GBOnly', 'homeFlat.home500Only', 'homeFlat.home100Only'] },
  { kpiKey: 'kpiTv', sources: ['homeBase.homeTv'] },
  { kpiKey: 'kpiTvSetTop', sources: ['homeAddon.addSetTop'] },
  { kpiKey: 'kpiSmartHome', sources: ['homeFlat.smartHome', 'homeAddon.smartHomeSimul'] },
  { kpiKey: 'kpiInternetRenew', sources: ['renew.renewPremiumSafe1G', 'renew.renewPremiumSafe500', 'renew.renewPremium1G', 'renew.renewPremium500', 'renew.renewSmart1G', 'renew.renewSimul1G', 'renew.renewSimul500'] },
  { kpiKey: 'kpiTvRenew', sources: ['renew.renewTvUpsell'] },
];

function emptyDay() {
  return {
    matrix: emptyDayMatrix(),
    groups: Object.fromEntries(DAILY_GROUP_KEYS.map((k) => [k, {}])),
    custRegCount: 0, tailoredCount: 0, tailoredAmount: 0,
    dayOff: false,
  };
}

// 예전 형식(매트릭스 배열만 저장)도 그대로 읽히도록 변환
function normalizeDay(raw) {
  const base = emptyDay();
  if (!raw) return base;
  if (Array.isArray(raw)) return { ...base, matrix: raw };
  return {
    ...base,
    matrix: raw.matrix || base.matrix,
    groups: { ...base.groups, ...(raw.groups || {}) },
    custRegCount: raw.custRegCount || 0,
    tailoredCount: raw.tailoredCount || 0,
    tailoredAmount: raw.tailoredAmount || 0,
    dayOff: !!raw.dayOff,
  };
}

function dayHasData(raw) {
  if (!raw) return false;
  const d = normalizeDay(raw);
  if (d.matrix.some((row) => row.some((v) => v > 0))) return true;
  if (DAILY_GROUP_KEYS.some((k) => Object.values(d.groups[k] || {}).some((v) => v > 0))) return true;
  return DAILY_NUMERIC_KEYS.some((k) => (d[k] || 0) > 0);
}

// 그 달의 일일 입력 전체를 합산
function aggregateDaily(daysMap, monthKey) {
  const agg = emptyDay();
  const n = daysInMonth(monthKey);
  for (let i = 1; i <= n; i++) {
    const raw = daysMap && daysMap[String(i).padStart(2, '0')];
    if (!raw) continue;
    const d = normalizeDay(raw);
    d.matrix.forEach((row, ri) => row.forEach((v, ci) => { agg.matrix[ri][ci] += v || 0; }));
    DAILY_GROUP_KEYS.forEach((gk) => {
      Object.entries(d.groups[gk] || {}).forEach(([k, v]) => { agg.groups[gk][k] = (agg.groups[gk][k] || 0) + (v || 0); });
    });
    DAILY_NUMERIC_KEYS.forEach((k) => { agg[k] += d[k] || 0; });
  }
  return agg;
}

// 합산된 일일입력을 성과포인트/KPI/각 건수 그룹에 자동 반영해 draft를 보강
function applyDailyToDraft(draft, dailyDaysMap, month, categoryMap, gibyeonColumnMap) {
  const agg = aggregateDaily(dailyDaysMap, month);
  const aggMatrix = agg.matrix;
  const colMap = gibyeonColumnMap || DEFAULT_GIBYEON_COLUMN_MAP;

  // 이 항목들은 이제 일일입력이 유일한 입력 경로라, "0이면 옛 값 유지" 하지 않고
  // 매번 그 달 일일 합계로 완전히 덮어씀 (삭제/정정이 그대로 반영되게)
  const trackedMobileKeys = new Set([
    ...(categoryMap || []).map((m) => m?.mobilePointKey).filter(Boolean),
    ...colMap.filter(Boolean),
  ]);
  const trackedKpiKeys = new Set([
    ...(categoryMap || []).map((m) => m?.kpiKey).filter(Boolean),
    ...HOME_KPI_MAP.map((m) => m.kpiKey),
  ]);

  const autoMobilePoint = Object.fromEntries([...trackedMobileKeys].map((k) => [k, 0]));
  const autoKpi = Object.fromEntries([...trackedKpiKeys].map((k) => [k, 0]));

  aggMatrix.forEach((row, ri) => {
    const rowTotal = row.reduce((s, v) => s + v, 0);
    const map = categoryMap?.[ri];
    if (!map) return;
    if (MATRIX_ROW_DEFS[ri]?.isGibyeon) {
      // 기변A/B/C 공통: 타겟과 무관하게 요금제군(열) 기준으로 성과포인트 배분
      row.forEach((cnt, ci) => {
        const key = colMap[ci];
        if (key) autoMobilePoint[key] = (autoMobilePoint[key] || 0) + (cnt || 0);
      });
    } else if (map.mobilePointKey) {
      autoMobilePoint[map.mobilePointKey] = (autoMobilePoint[map.mobilePointKey] || 0) + rowTotal;
    }
    if (map.kpiKey) autoKpi[map.kpiKey] = (autoKpi[map.kpiKey] || 0) + rowTotal;
  });

  // 홈/2ND/VAS/소노 등 건수 그룹 — 이제 일일입력이 유일한 입력 경로라 그 달 합계로 완전히 교체
  const mergedGroups = {};
  DAILY_GROUP_KEYS.forEach((gk) => { mergedGroups[gk] = { ...(agg.groups[gk] || {}) }; });

  const pick = (path) => {
    const [gk, k] = path.split('.');
    return (mergedGroups[gk] || {})[k] || 0;
  };
  HOME_KPI_MAP.forEach((m) => {
    const total = m.sources.reduce((s, p) => s + pick(p), 0);
    autoKpi[m.kpiKey] = (autoKpi[m.kpiKey] || 0) + total;
  });

  const numeric = {};
  DAILY_NUMERIC_KEYS.forEach((k) => { numeric[k] = agg[k] || 0; });

  return {
    ...draft,
    ...mergedGroups,
    ...numeric,
    matrix: aggMatrix,
    mobilePoint: { ...draft.mobilePoint, ...autoMobilePoint },
    kpi: { ...draft.kpi, ...autoKpi },
  };
}

/* 급여 전체 계산 */
function computePay(draft, position, hireDate, month, config) {
  const months = monthsSince(hireDate, month);
  const bucketKey = tenureBucketOf(months);
  const bucket = config.tenure.find((t) => t.key === bucketKey) || config.tenure[0];

  const mobileItems = config.mobilePointItems || DEFAULT_MOBILE_POINT_ITEMS;
  const kpiItems = config.kpiItems || DEFAULT_KPI_ITEMS;
  const kpiScore = sumPoint(draft.kpi || {}, kpiItems);
  const activityCount = mobileItems.filter((i) => i.countsTenure !== false).reduce((s, i) => s + (draft.mobilePoint[i.key] || 0), 0);
  const tenurePay = Math.min((bucket.rate || 0) * activityCount, config.tenureCap);

  const mobilePoints = sumPoint(draft.mobilePoint, mobileItems);
  // 총 포인트 합산에 더해지는 홈 가점 (성과P 안내표 기준: 홈단독1P, 홈+TV2P, TV프리0.5P, 스마트홈0.5P)
  const homeAddonPoints = sumPoint(draft.homeBase, HOME_BASE_ITEMS)
    + (draft.homeFlat.tvFree || 0) * 0.5 + (draft.homeFlat.smartHome || 0) * 0.5;
  // 홈 최소조건 3점 게이트 전용 점수 (인터넷1점/프리0.3점/스홈0.2점 기준 — 별도 배점)
  const homeGatePoints = (draft.homeBase.homeOnly || 0) * HOME_GATE_WEIGHTS.homeOnly
    + (draft.homeBase.homeTv || 0) * HOME_GATE_WEIGHTS.homeTv
    + (draft.homeFlat.tvFree || 0) * HOME_GATE_WEIGHTS.tvFree
    + (draft.homeFlat.smartHome || 0) * HOME_GATE_WEIGHTS.smartHome;
  const addonApplies = mobilePoints > ADDON_GATE;
  const totalPoints = mobilePoints + (addonApplies ? homeAddonPoints : 0);
  const gradeEligible = homeGatePoints >= HOME_GATE_MIN;
  const gradeSorted = [...config.grades].sort((a, b) => b.min - a.min);
  const gradeHit = gradeEligible ? (gradeSorted.find((g) => totalPoints >= g.min) || config.grades[config.grades.length - 1]) : config.grades[config.grades.length - 1];
  const gradeBonus = gradeEligible ? gradeHit.bonus : 0;
  // 다음 등급까지 남은 포인트 (진행바용) — 포인트가 낮은 등급부터 정렬해 현재보다 위에 있는 첫 등급을 찾음
  const gradeAsc = [...config.grades].sort((a, b) => a.min - b.min);
  const nextGrade = gradeAsc.find((g) => g.min > totalPoints) || null;
  const currentTierMin = gradeHit.min || 0;
  const gradeProgress = nextGrade
    ? Math.max(0, Math.min(1, (totalPoints - currentTierMin) / (nextGrade.min - currentTierMin)))
    : 1;

  const matrixTotal = draft.matrix.reduce((s, row, ri) => s + row.reduce((rs, cnt, ci) => rs + cnt * (config.matrix[ri]?.[ci] || 0), 0), 0);
  const bundle2ndTotal = sumFlat(draft.bundle2nd, config.bundle2nd);
  // 홈 무성과 자동 판정 — 홈 관련 실적이 한 건도 없으면 요금제 유치·2ND 50% 감액
  const homeAnyCount = (draft.homeBase.homeOnly || 0) + (draft.homeBase.homeTv || 0)
    + (draft.homeFlat.home1GBOnly || 0) + (draft.homeFlat.home500Only || 0) + (draft.homeFlat.home100Only || 0)
    + (draft.homeFlat.tvFree || 0) + (draft.homeFlat.smartHome || 0);
  const homeNoPerformance = homeAnyCount === 0;
  const penaltyFactor = homeNoPerformance ? 0.5 : 1;

  const positionAllowance = config.positionAllowance?.[position] || 0;
  const positionBase = (config.basePay[position] || 0) - (draft.activityTimeMet ? 0 : config.basePenalty);
  const otherComponents = tenurePay + gradeBonus + (matrixTotal + bundle2ndTotal) * penaltyFactor + positionAllowance;
  const guaranteedComponent = Math.max(positionBase, otherComponents);

  const homeGradeQualCount = draft.homeBase.homeTv || 0; // "1G+TV 기준" - 그레이드 단가 지급 대상 (홈+TV 동시청약만)
  const homeTierCount = (draft.homeBase.homeOnly || 0) + (draft.homeBase.homeTv || 0)
    + (draft.homeFlat.home1GBOnly || 0) + (draft.homeFlat.home500Only || 0) + (draft.homeFlat.home100Only || 0); // 단독상품도 구간 집계에는 포함
  const homeCaseCount = homeTierCount; // 화면 표시용(총 홈 건수)
  const homeGradePay = homeGradeTotal(homeTierCount, homeGradeQualCount, config.homeTiers);
  const homeFlatPay = sumFlat(draft.homeFlat, config.homeFlat);
  const tvFreeRate = config.homeFlat.find((t) => t.key === 'tvFree')?.rate || 0;
  const smartHomeRate = config.homeFlat.find((t) => t.key === 'smartHome')?.rate || 0;
  const tvFreePay = (draft.homeFlat.tvFree || 0) * tvFreeRate;
  const smartHomePay = (draft.homeFlat.smartHome || 0) * smartHomeRate;
  const homeAddonPay = sumFlat(draft.homeAddon, config.homeAddon);
  const renewPay = sumFlat(draft.renew, config.renew);
  const vasPay = sumFlat(draft.vas, config.vas);
  const mnpBundlePay = sumFlat(draft.mnpBundle, config.mnpBundle);
  const sonoPay = sumFlat(draft.sono, config.sono);
  const custRegBonus = tierBonus(draft.custRegCount || 0, config.custRegTiers);
  const tailoredBonus = tierBonus(draft.tailoredCount || 0, config.tailoredTiers);
  const tailoredAmountBonus = draft.tailoredAmount || 0; // 업셀 금액 100% 지급

  const total = guaranteedComponent + homeGradePay + homeFlatPay + homeAddonPay + renewPay
    + vasPay + mnpBundlePay + sonoPay + custRegBonus + tailoredBonus + tailoredAmountBonus;

  return {
    months, bucket, activityCount, tenurePay,
    mobilePoints, homeGatePoints, homeAddonPoints, addonApplies, totalPoints,
    gradeEligible, grade: gradeHit.grade, gradeBonus, nextGrade, gradeProgress, currentTierMin,
    matrixTotal, bundle2ndTotal, positionBase, positionAllowance, otherComponents, guaranteedComponent,
    homeAnyCount, homeNoPerformance,
    homeCaseCount, homeGradePay, homeFlatPay, tvFreePay, smartHomePay, homeAddonPay, renewPay, vasPay, mnpBundlePay, sonoPay,
    custRegBonus, tailoredBonus, tailoredAmountBonus, kpiScore, total,
  };
}

/* ===================== 작은 UI 컴포넌트 ===================== */

function StatusBadge({ status }) {
  const map = {
    approved: { label: '실적 승인', cls: 'bg-emerald-100 text-emerald-700' },
    pending: { label: '실적 승인 대기', cls: 'bg-amber-100 text-amber-700' },
    none: { label: '미입력', cls: 'bg-gray-100 text-gray-500' },
  };
  const s = map[status] || map.none;
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>{s.label}</span>;
}

function calendarDayDiff(past) {
  const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((startOf(new Date()) - startOf(past)) / 86400000);
}

function LastSaved({ updatedAt }) {
  if (!updatedAt) return <span className="text-xs text-gray-300">-</span>;
  const d = new Date(updatedAt);
  const diffDays = calendarDayDiff(d);
  const dateStr = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  let relLabel = diffDays <= 0 ? '오늘' : diffDays === 1 ? '어제' : `${diffDays}일 전`;
  const cls = diffDays >= 3 ? 'text-red-500' : diffDays >= 1 ? 'text-amber-600' : 'text-gray-500';
  return (
    <div className={`text-xs ${cls}`}>
      <div className="font-medium">{relLabel}</div>
      <div className="text-[10px] opacity-70">{dateStr}</div>
    </div>
  );
}

function SaveStatus({ saving, dirty, lastSavedAt }) {
  if (saving) return <span className="flex items-center gap-1 text-[11px] text-violet-600"><Loader2 size={11} className="animate-spin" />저장 중</span>;
  if (dirty) return <span className="flex items-center gap-1 text-[11px] text-amber-600"><UploadCloud size={11} />저장 대기 중</span>;
  if (lastSavedAt) {
    const d = new Date(lastSavedAt);
    const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return <span className="flex items-center gap-1 text-[11px] text-gray-400"><Check size={11} />{hm} 저장됨</span>;
  }
  return null;
}

function Stepper({ value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <button onClick={() => onChange(Math.max(0, value - 1))} className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600"><Minus size={13} /></button>
      <span className="w-7 text-center font-semibold text-gray-800 text-sm tabular-nums">{value}</span>
      <button onClick={() => onChange(value + 1)} className="w-7 h-7 rounded-lg bg-violet-100 hover:bg-violet-200 flex items-center justify-center text-violet-700"><Plus size={13} /></button>
    </div>
  );
}

function Section({ title, sub, children, defaultOpen }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3">
        <div className="text-left">
          <div className="text-sm font-semibold text-gray-800">{title}</div>
          {sub && <div className="text-[11px] text-gray-400">{sub}</div>}
        </div>
        <ChevronDown size={16} className={`text-gray-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="border-t border-gray-50 divide-y divide-gray-50">{children}</div>}
    </div>
  );
}

function CountRow({ label, sub, value, onChange, disabled }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <div className="min-w-0 pr-2">
        <div className="text-sm text-gray-700 truncate">{label}</div>
        {sub && <div className="text-[11px] text-gray-400">{sub}</div>}
      </div>
      {disabled ? (
        <div className="flex items-center gap-1.5">
          <span className="text-xs px-1.5 py-0.5 rounded bg-violet-50 text-violet-500">자동</span>
          <span className="w-7 text-center font-semibold text-gray-500 text-sm tabular-nums">{value}</span>
        </div>
      ) : (
        <Stepper value={value} onChange={onChange} />
      )}
    </div>
  );
}

function CountGroup({ table, counts, onChange, autoCounts, autoKeys }) {
  const safeCounts = counts || {};
  const auto = autoKeys || null;
  return table.map((t) => {
    const isAuto = !!auto && auto.has(t.key);
    const value = isAuto ? (autoCounts?.[t.key] || 0) : (safeCounts[t.key] || 0);
    return (
      <CountRow key={t.key} label={t.label} sub={t.rate ? `건당 ${won(t.rate)}` : (t.point ? `${t.point}P` : '')}
        value={value} disabled={isAuto}
        onChange={isAuto ? undefined : (v) => onChange({ ...safeCounts, [t.key]: v })} />
    );
  });
}

/* ===================== 메인 앱 ===================== */

export default function App({ authUser, authProfile, onSignOut }) {
  const [role, setRole] = useState('employee');
  const [employees, setEmployees] = useState([]);
  const [empId, setEmpId] = useState('');
  const months = useMemo(() => lastMonths(24), []);
  const [month, setMonth] = useState(months[0]);
  const [config, setConfig] = useState(defaultConfig());
  const [monthRecords, setMonthRecords] = useState({}); // { empId: {draft, status} }
  const [draft, setDraft] = useState(emptyDraft());
  const [tab, setTab] = useState('home');
  const [adminTab, setAdminTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [stores, setStores] = useState(DEFAULT_STORES);
  const [dailyRecords, setDailyRecords] = useState({}); // { empId: { "01": matrix2D, ... } }
  const [dirty, setDirty] = useState(false);            // 실적입력 탭에 저장 안 된 변경이 있는지
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [dbError, setDbError] = useState('');
  const [lockedMonths, setLockedMonths] = useState([]);
  const [prevMonthTotal, setPrevMonthTotal] = useState(null); // 홈 화면 "전월 대비" 표시용
  const [personalGoals, setPersonalGoals] = useState({}); // 본인 월 항목별 목표
  const [goalSaving, setGoalSaving] = useState(false);

  const DEFAULT_EMPLOYEES = [
    { id: 'e01', name: '어진석', branch: '장곡동_장곡역점', position: '사원', hireDate: '2026-08' },
    { id: 'e02', name: '정준희', branch: '본오3동_상록수역점', position: '사원', hireDate: '2026-08' },
    { id: 'e03', name: '정영진', branch: '광정동_산본점', position: '사원', hireDate: '2026-08' },
    { id: 'e04', name: '김창기', branch: '신천동_삼미시장점', position: '사원', hireDate: '2026-07' },
    { id: 'e05', name: '이혜인', branch: '대야동_롯데마트점', position: '사원', hireDate: '2026-07' },
    { id: 'e06', name: '박민주', branch: '본오1동_본오중학교점', position: '사원', hireDate: '2026-07' },
    { id: 'e07', name: '김정아', branch: '본오3동_상록수역점', position: '사원', hireDate: '2026-06' },
    { id: 'e08', name: '허영진', branch: '신천동_삼미시장점', position: '사원', hireDate: '2026-04' },
    { id: 'e09', name: '신다흰', branch: '본오1동_본오중학교점', position: '사원', hireDate: '2026-04' },
    { id: 'e10', name: '권유진', branch: '신천동_삼미시장2호점', position: '사원', hireDate: '2026-03' },
    { id: 'e11', name: '김소인', branch: '본오3동_주민센터점', position: '매니저', hireDate: '2026-03' },
    { id: 'e12', name: '이선영', branch: '광정동_산본점', position: '사원', hireDate: '2026-03' },
    { id: 'e13', name: '김민지', branch: '신천동_삼미시장2호점', position: '부점장', hireDate: '2026-01' },
    { id: 'e14', name: '문유빈', branch: '본오3동_상록수역점', position: '사원', hireDate: '2026-01' },
    { id: 'e15', name: '이수아', branch: '본오3동_주민센터점', position: '사원', hireDate: '2026-01' },
    { id: 'e16', name: '박윤서', branch: '장곡동_장곡역점', position: '사원', hireDate: '2026-01' },
    { id: 'e17', name: '유성민', branch: '광정동_산본점', position: '부점장', hireDate: '2026-01' },
    { id: 'e18', name: '김영중', branch: '고잔동_법조타운점', position: '사원', hireDate: '2026-01' },
    { id: 'e19', name: '김윤석', branch: '월곶동_월곶점', position: '부점장', hireDate: '2025-11' },
    { id: 'e20', name: '김치현', branch: '광정동_산본점', position: '매니저', hireDate: '2025-07' },
    { id: 'e21', name: '박성민', branch: '본오1동_본오중학교점', position: '부점장', hireDate: '2025-06' },
    { id: 'e22', name: '송낙경', branch: '신천동_삼미시장점', position: '부점장', hireDate: '2025-04' },
    { id: 'e23', name: '김주빈', branch: '대야동_롯데마트점', position: '사원', hireDate: '2025-04' },
    { id: 'e24', name: '하윤식', branch: '본오3동_주민센터점', position: '부점장', hireDate: '2025-04' },
    { id: 'e25', name: '이석구', branch: '거모동_도일시장점', position: '사원', hireDate: '2025-04' },
    { id: 'e26', name: '최재혁', branch: '광정동_산본점', position: '부점장', hireDate: '2025-04' },
    { id: 'e27', name: '김도경', branch: '은행동_은계사거리점', position: '사원', hireDate: '2025-04' },
    { id: 'e28', name: '권세민', branch: '거모동_도일시장점', position: '사원', hireDate: '2025-03' },
    { id: 'e29', name: '박석현', branch: '거모동_도일시장점', position: '부점장', hireDate: '2025-02' },
    { id: 'e30', name: '이민우', branch: '장곡동_장곡역점', position: '점장', hireDate: '2024-11' },
    { id: 'e31', name: '신동길', branch: '고잔동_법조타운점', position: '매니저', hireDate: '2024-10' },
    { id: 'e32', name: '이유민', branch: '고잔동_법조타운점', position: '사원', hireDate: '2024-09' },
    { id: 'e33', name: '김정은', branch: '본오3동_상록수역점', position: '부점장', hireDate: '2024-08' },
    { id: 'e34', name: '박다연', branch: '광정동_산본점', position: '사원', hireDate: '2024-07' },
    { id: 'e35', name: '서건주', branch: '신천동_삼미시장2호점', position: '매니저', hireDate: '2024-01' },
    { id: 'e36', name: '박민경', branch: '대야동_롯데마트점', position: '부점장', hireDate: '2023-12' },
    { id: 'e37', name: '최재원', branch: '신천동_삼미시장점', position: '점장', hireDate: '2023-09' },
    { id: 'e38', name: '임지혜', branch: '거모동_도일시장점', position: '점장', hireDate: '2020-10' },
    { id: 'e42', name: '김소원', branch: '월피동_성포역점', position: '점장', hireDate: '2020-10' },
    { id: 'e39', name: '주정민', branch: '본오3동_상록수역점', position: '점장', hireDate: '2020-06' },
    { id: 'e40', name: '전민혁', branch: '은행동_은계사거리점', position: '부점장', hireDate: '2017-06' },
    { id: 'e41', name: '황성휘', branch: '월곶동_월곶점', position: '점장', hireDate: '2017-06' },
  ];

  const loadConfig = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('app_config').select('value').eq('config_key', 'config').maybeSingle();
      if (error) throw error;
      if (data && data.value) {
        setConfig({ ...defaultConfig(), ...data.value });
      } else {
        const def = defaultConfig();
        await supabase.from('app_config').upsert({ config_key: 'config', value: def }, { onConflict: 'config_key' });
        setConfig(def);
      }
    } catch (e) { console.error('CONFIG LOAD ERROR:', e); setConfig(defaultConfig()); }
  }, []);

  const loadStores = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('app_config').select('value').eq('config_key', 'stores').maybeSingle();
      if (error) throw error;
      if (data && data.value && data.value.length) {
        setStores(data.value);
      } else {
        await supabase.from('app_config').upsert({ config_key: 'stores', value: DEFAULT_STORES }, { onConflict: 'config_key' });
        setStores(DEFAULT_STORES);
      }
    } catch (e) { console.error('STORES LOAD ERROR:', e); setStores(DEFAULT_STORES); }
  }, []);

  const persistStores = async (next) => {
    setStores(next);
    try {
      const { error } = await supabase.from('app_config').upsert({ config_key: 'stores', value: next }, { onConflict: 'config_key' });
      if (error) throw error;
    } catch (e) { console.error('STORES SAVE ERROR:', e); setDbError(`매장 목록 저장 실패: ${friendlyError(e)}`); }
  };
  const addStore = (name) => { if (name.trim() && !stores.includes(name.trim())) persistStores([...stores, name.trim()]); };
  const removeStore = (name) => persistStores(stores.filter((s) => s !== name));

  const loadLockedMonths = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('app_config').select('value').eq('config_key', 'locked_months').maybeSingle();
      if (error) throw error;
      setLockedMonths(Array.isArray(data?.value) ? data.value : []);
    } catch (e) { console.error('LOCKED MONTHS LOAD ERROR:', e); setLockedMonths([]); }
  }, []);

  const toggleMonthLock = async (targetMonth, lock) => {
    const next = lock ? [...new Set([...lockedMonths, targetMonth])] : lockedMonths.filter((m) => m !== targetMonth);
    setLockedMonths(next);
    try {
      const { error } = await supabase.from('app_config').upsert({ config_key: 'locked_months', value: next }, { onConflict: 'config_key' });
      if (error) throw error;
    } catch (e) { console.error('MONTH LOCK SAVE ERROR:', e); setDbError(`월 마감 설정 실패: ${friendlyError(e)}`); }
  };

  const loadPersonalGoals = useCallback(async () => {
    if (!authUser?.id) return;

    const { data, error } = await supabase
      .from('monthly_goals')
      .select('goals')
      .eq('user_id', authUser.id)
      .eq('month', month)
      .maybeSingle();

    if (error) {
      console.error('MONTHLY GOALS LOAD ERROR:', error);
      return;
    }

    const raw = data?.goals;
    setPersonalGoals(raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {});
  }, [authUser?.id, month]);

  const savePersonalGoals = async (goals) => {
    if (!authUser?.id) return false;

    const clean = {};
    Object.entries(goals || {}).forEach(([key, value]) => {
      const n = Number(value);
      if (Number.isFinite(n) && n > 0) clean[key] = n;
    });

    setGoalSaving(true);

    const { error } = await supabase
      .from('monthly_goals')
      .upsert(
        {
          user_id: authUser.id,
          month,
          goals: clean,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,month' }
      );

    if (error) {
      console.error('MONTHLY GOALS SAVE ERROR:', error);
      setDbError(`이번 달 목표 저장 실패: ${friendlyError(error)}`);
      setGoalSaving(false);
      return false;
    }

    setPersonalGoals(clean);
    setGoalSaving(false);
    return true;
  };

  const loadEmployees = useCallback(async () => {
    if (!authUser) return [];
    setDbError('');

    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, employee_code, store_name, position, hire_date, role, active')
      .eq('active', true)
      .order('name', { ascending: true });

    if (error) {
      console.error('PROFILES LOAD ERROR:', error);
      setDbError(`직원 정보 불러오기 실패: ${friendlyError(error)}`);
      return [];
    }

    let lastSignInMap = {};
    try {
      const { data: signIns, error: siErr } = await supabase.rpc('get_last_sign_ins');
      if (!siErr && signIns) lastSignInMap = Object.fromEntries(signIns.map((s) => [s.id, s.last_sign_in_at]));
    } catch (e) { /* 매니저 이하 권한이면 빈 값, 무시 */ }

    const list = (data || []).map((p) => ({
      id: p.id,
      name: p.name || (p.id === authUser.id ? (authUser.email || '내 계정') : '이름 미설정'),
      branch: p.store_name || '미지정',
      position: p.position || '사원',
      hireDate: p.hire_date || month,
      employeeCode: p.employee_code || '',
      role: p.role || 'employee',
      lastSignInAt: lastSignInMap[p.id] || null,
    }));

    setEmployees(list);
    return list;
  }, [authUser, month]);

  const loadMonth = useCallback(async (m, list) => {
    setLoading(true);
    setDbError('');

    const ids = (list || []).map((e) => e.id);
    const mapped = {};
    ids.forEach((id) => {
      mapped[id] = { draft: emptyDraft(), status: 'none' };
    });

    if (!ids.length) {
      setMonthRecords(mapped);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('monthly_status')
      .select('user_id, month, activity_time_met, data, updated_at')
      .eq('month', m)
      .in('user_id', ids);

    if (error) {
      console.error('MONTHLY LOAD ERROR:', error);
      setDbError(`월별 상태 불러오기 실패: ${friendlyError(error)}`);
    } else {
      (data || []).forEach((row) => {
        const payload = row.data || {};
        mapped[row.user_id] = {
          draft: {
            ...emptyDraft(),
            ...(payload.draft || {}),
            activityTimeMet: row.activity_time_met ?? true,
          },
          status: payload.status || 'none',
          updatedAt: row.updated_at,
        };
      });
    }

    setMonthRecords(mapped);
    setLoading(false);
  }, []);

  const loadDaily = useCallback(async (m, list) => {
    setDbError('');
    const ids = (list || []).map((e) => e.id);
    const mapped = {};
    ids.forEach((id) => { mapped[id] = {}; });

    if (!ids.length) {
      setDailyRecords(mapped);
      return;
    }

    const [yy, mm] = m.split('-').map(Number);
    const nextMonth = new Date(yy, mm, 1);
    const nextKey = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;

    const { data, error } = await supabase
      .from('daily_records')
      .select('user_id, work_date, data, updated_at')
      .in('user_id', ids)
      .gte('work_date', `${m}-01`)
      .lt('work_date', nextKey)
      .order('work_date', { ascending: true });

    if (error) {
      console.error('DAILY LOAD ERROR:', error);
      setDbError(`일일 실적 불러오기 실패: ${friendlyError(error)}`);
      setDailyRecords(mapped);
      return;
    }

    (data || []).forEach((row) => {
      if (!mapped[row.user_id]) mapped[row.user_id] = {};
      const dayKey = String(Number(row.work_date.slice(8, 10))).padStart(2, '0');
      mapped[row.user_id][dayKey] = row.data || {};
    });

    setDailyRecords(mapped);
  }, []);

  const saveDailyDay = async (day, record) => {
    if (!empId) return false;

    const current = dailyRecords[empId] || {};
    const nextDays = { ...current, [day]: record };
    setDailyRecords((prev) => ({ ...prev, [empId]: nextDays }));
    setDbError('');

    const { error } = await supabase
      .from('daily_records')
      .upsert(
        {
          user_id: empId,
          work_date: `${month}-${day}`,
          data: record,
        },
        { onConflict: 'user_id,work_date' }
      );

    if (error) {
      console.error('DAILY SAVE ERROR:', error);
      setDbError(`일일 실적 저장 실패: ${friendlyError(error)}`);
      return false;
    }

    return true;
  };

  useEffect(() => { loadConfig(); }, [loadConfig]);
  useEffect(() => { loadStores(); }, [loadStores]);
  useEffect(() => { loadLockedMonths(); }, [loadLockedMonths]);
  useEffect(() => { loadPersonalGoals(); }, [loadPersonalGoals]);

  useEffect(() => {
    if (!authUser) return;
    (async () => {
      const list = await loadEmployees();
      const own = list.find((e) => e.id === authUser.id);
      const first = own?.id || list[0]?.id || '';
      setEmpId(first);
      await loadMonth(month, list);
      await loadDaily(month, list);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.id]);
  useEffect(() => { if (employees.length) { loadMonth(month, employees); loadDaily(month, employees); } }, [month]); // eslint-disable-line
  useEffect(() => {
    const rec = monthRecords[empId];
    setDraft(rec ? { ...emptyDraft(), ...rec.draft } : emptyDraft());
    setDirty(false); // 서버에서 막 불러온 상태이므로 미저장 변경 아님
  }, [monthRecords, empId]);

  const persistConfig = async (next) => {
    setConfig(next);
    try {
      const { error } = await supabase.from('app_config').upsert({ config_key: 'config', value: next }, { onConflict: 'config_key' });
      if (error) throw error;
    } catch (e) { console.error('CONFIG SAVE ERROR:', e); setDbError(`지급기준 저장 실패: ${friendlyError(e)}`); }
  };
  const persistEmployees = async (next) => {
    setEmployees(next);
    return next;
  };

  const addEmployee = async () => {
    window.alert('직원 계정 생성은 현재 Supabase Authentication → Users에서 먼저 생성해주세요. 다음 단계에서 관리자 화면의 직원 초대 기능으로 연결할 예정입니다.');
  };

  const updateEmployee = async (id, patch) => {
    const dbPatch = {};
    if (Object.prototype.hasOwnProperty.call(patch, 'name')) dbPatch.name = patch.name;
    if (Object.prototype.hasOwnProperty.call(patch, 'branch')) dbPatch.store_name = patch.branch;
    if (Object.prototype.hasOwnProperty.call(patch, 'position')) dbPatch.position = patch.position;
    if (Object.prototype.hasOwnProperty.call(patch, 'hireDate')) dbPatch.hire_date = patch.hireDate;

    const { error } = await supabase.from('profiles').update(dbPatch).eq('id', id);
    if (error) {
      setDbError(`직원 정보 수정 실패: ${friendlyError(error)}`);
      return;
    }
    setEmployees((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  const removeEmployee = async (id) => {
    setDbError('');
    const { error } = await supabase.from('profiles').update({ active: false }).eq('id', id);
    if (error) {
      console.error('EMPLOYEE DEACTIVATE ERROR:', error);
      setDbError(`직원 비활성화 실패: ${friendlyError(error)}`);
      return;
    }
    await loadEmployees();
  };

  const saveDraft = async (payload) => {
    const body = payload || draft;
    if (!empId) return;

    setSaving(true);
    setDbError('');

    const cur = monthRecords[empId] || { status: 'none' };
    const status = cur.status === 'approved' ? 'approved' : 'pending';

    const { error } = await supabase
      .from('monthly_status')
      .upsert(
        {
          user_id: empId,
          month,
          activity_time_met: body.activityTimeMet ?? true,
          data: { draft: body, status },
        },
        { onConflict: 'user_id,month' }
      );

    if (error) {
      console.error('MONTHLY SAVE ERROR:', error);
      setDbError(`월별 상태 저장 실패: ${friendlyError(error)}`);
      setSaving(false);
      return;
    }

    const next = {
      draft: body,
      status,
      updatedAt: new Date().toISOString(),
    };

    setMonthRecords((prev) => ({ ...prev, [empId]: next }));
    setDirty(false);
    setLastSavedAt(new Date());
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
    setSaving(false);
  };

  // 실적입력 탭 변경을 표시만 해두고, 아래 자동저장 타이머가 실제 저장을 맡음
  const updateDraft = (next) => {
    if (lockedMonths.includes(month)) return;
    setDraft(next);
    setDirty(true);
  };

  // 자동저장 — 마지막 입력 후 1.2초 동안 조용하면 저장
  const draftRef = useRef(draft);
  draftRef.current = draft;
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => { saveDraft(draftRef.current); }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, dirty]);

  // 저장이 끝나기 전에 창을 닫으려 하면 브라우저 경고
  useEffect(() => {
    if (!dirty) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  // 월/직원을 바꾸기 직전에 남아 있는 변경을 원래 칸에 먼저 저장 (자동저장 타이머가 뜨기 전이어도 안전)
  const pendingRef = useRef({});
  useEffect(() => {
    pendingRef.current = { empId, month, draft, dirty, status: (monthRecords[empId] || {}).status || 'none' };
  });
  useEffect(() => () => {
    const p = pendingRef.current;
    if (!p.dirty || !p.empId) return;
    const status = p.status === 'approved' ? 'approved' : 'pending';
    supabase
      .from('monthly_status')
      .upsert(
        {
          user_id: p.empId,
          month: p.month,
          activity_time_met: p.draft.activityTimeMet ?? true,
          data: { draft: p.draft, status },
        },
        { onConflict: 'user_id,month' }
      )
      .then(({ error }) => {
        if (error) console.error('PENDING MONTH SAVE ERROR:', error);
      });
  }, [month, empId]);
  const approve = async (id) => {
    const cur = monthRecords[id] || { draft: emptyDraft(), status: 'none' };
    const next = { ...cur, status: 'approved' };

    const { error } = await supabase
      .from('monthly_status')
      .upsert(
        {
          user_id: id,
          month,
          activity_time_met: cur.draft?.activityTimeMet ?? true,
          data: { draft: cur.draft || emptyDraft(), status: 'approved' },
        },
        { onConflict: 'user_id,month' }
      );

    if (error) {
      setDbError(`승인 저장 실패: ${friendlyError(error)}`);
      return;
    }

    setMonthRecords((prev) => ({ ...prev, [id]: next }));
  };

  const rows = employees.map((e) => {
    const rec = monthRecords[e.id] || { draft: emptyDraft(), status: 'none' };
    const mergedDraft = applyDailyToDraft(rec.draft, dailyRecords[e.id], month, config.categoryMap, config.gibyeonColumnMap);
    const pay = computePay(mergedDraft, e.position, e.hireDate, month, config);
    return { ...e, status: rec.status, pay, draft: mergedDraft, updatedAt: rec.updatedAt };
  });
  const currentEmp = employees.find((e) => e.id === empId);

  // 권한별 조회 범위
  // - 일반 직원/매니저: 본인만
  // - 점장/부점장: 본인 매장
  // - 담당: 전체
  // - 전체 관리자: 전체
  const loginEmp = employees.find((e) => e.id === authUser?.id);
  const isFullAdmin = authProfile?.role === 'admin';
  const isHQManager = loginEmp?.position === '담당';
  const isStoreLeader = ['점장', '부점장'].includes(loginEmp?.position);

  const scopedEmployees = isFullAdmin || isHQManager
    ? employees
    : isStoreLeader
      ? employees.filter((e) => e.branch === loginEmp?.branch)
      : employees.filter((e) => e.id === authUser?.id);

  useEffect(() => {
    if (!scopedEmployees.length) return;
    if (!scopedEmployees.some((e) => e.id === empId)) {
      setEmpId(scopedEmployees[0].id);
    }
  }, [scopedEmployees, empId]);


  // 홈 화면 "전월 대비" 표시용 — 본인 것만 가볍게 따로 불러옴
  useEffect(() => {
    if (!empId || !currentEmp) { setPrevMonthTotal(null); return; }
    (async () => {
      const [yy, mm] = month.split('-').map(Number);
      const prevD = new Date(yy, mm - 2, 1);
      const prevMonth = `${prevD.getFullYear()}-${String(prevD.getMonth() + 1).padStart(2, '0')}`;
      const nextKey = `${month}-01`;

      const [{ data: msRow }, { data: dailyRows }] = await Promise.all([
        supabase.from('monthly_status').select('data, activity_time_met').eq('user_id', empId).eq('month', prevMonth).maybeSingle(),
        supabase.from('daily_records').select('work_date, data').eq('user_id', empId).gte('work_date', `${prevMonth}-01`).lt('work_date', nextKey),
      ]);

      const prevDraft = { ...emptyDraft(), ...(msRow?.data?.draft || {}), activityTimeMet: msRow?.activity_time_met ?? true };
      const prevDailyMap = {};
      (dailyRows || []).forEach((r) => { prevDailyMap[r.work_date.slice(8, 10)] = r.data; });
      const prevMerged = applyDailyToDraft(prevDraft, prevDailyMap, prevMonth, config.categoryMap, config.gibyeonColumnMap);
      const prevPay = computePay(prevMerged, currentEmp.position, currentEmp.hireDate, prevMonth, config);
      setPrevMonthTotal(prevPay.total);
    })();
  }, [empId, month, currentEmp?.position, currentEmp?.hireDate, config]); // eslint-disable-line
  const myMergedDraft = applyDailyToDraft(draft, dailyRecords[empId], month, config.categoryMap, config.gibyeonColumnMap);
  const myPay = computePay(myMergedDraft, currentEmp?.position || '사원', currentEmp?.hireDate, month, config);
  // 영업 조직이 아닌 인원(운영진·영업지원팀 등)은 실적표/실적비교에서 제외
  // '기타' 직급(대리입력용 매장 실적 계정)은 건수·성과포인트는 유지하되 인센티브 금액은 0으로 표시(개인 지급 없음)
  const salesRows = rows
    .filter((r) => !NON_SALES_STORES.includes(r.branch))
    .map((r) => (r.position === '기타' ? { ...r, pay: { ...r.pay, total: 0, guaranteedComponent: 0 } } : r));
  const scopedIds = new Set(scopedEmployees.map((e) => e.id));
  const scopedRows = rows.filter((r) => scopedIds.has(r.id));
  const scopedSalesRows = salesRows.filter((r) => scopedIds.has(r.id));

  const totalPay = scopedSalesRows.reduce((s, r) => s + r.pay.total, 0);
  const pendingCount = scopedRows.filter((r) => r.status === 'pending').length;

  // 홈 화면 랭킹용 — 본인이 영업 조직 소속일 때만 순위 계산
  const rankedSorted = [...salesRows].sort((a, b) => b.pay.total - a.pay.total);
  const myRankIndex = rankedSorted.findIndex((r) => r.id === empId);
  const myRank = myRankIndex >= 0 ? myRankIndex + 1 : null;
  const myRankTotal = rankedSorted.length;
  const myBranchRanked = rankedSorted.filter((r) => r.branch === currentEmp?.branch);
  const myBranchRankIndex = myBranchRanked.findIndex((r) => r.id === empId);
  const myBranchRank = myBranchRankIndex >= 0 ? myBranchRankIndex + 1 : null;

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center"><Trophy size={18} className="text-white" /></div>
            <div>
              <div className="font-bold text-gray-900 leading-tight">미소 인센티브</div>
              <div className="text-[11px] text-gray-400 leading-tight">2026년 MS직군 수수료 정책 반영</div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              <button onClick={() => setRole('employee')} className={`px-3 py-1.5 rounded-md text-sm font-medium ${role === 'employee' ? 'bg-white shadow text-violet-700' : 'text-gray-500'}`}>직원</button>
              {['manager', 'admin'].includes(authProfile?.role) && (
                <button onClick={() => setRole('admin')} className={`px-3 py-1.5 rounded-md text-sm font-medium ${role === 'admin' ? 'bg-white shadow text-violet-700' : 'text-gray-500'}`}>관리자</button>
              )}
            </div>
            <div className="hidden sm:block text-right leading-tight">
              <div className="text-xs font-semibold text-gray-700">{authProfile?.name || authUser?.email}</div>
              <div className="text-[10px] text-gray-400">{ROLE_LABELS[authProfile?.role] || authProfile?.role}</div>
            </div>
            {onSignOut && (
              <button onClick={onSignOut} title="로그아웃" className="text-gray-400 hover:text-red-500 p-1.5 shrink-0">
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
        {role === 'employee' && (
          <div className="max-w-5xl mx-auto px-4 pb-3 flex items-center gap-2">
            <span className="text-xs text-gray-400">로그인:</span>
            <select
              value={empId}
              onChange={(e) => setEmpId(e.target.value)}
              disabled={scopedEmployees.length <= 1}
              className="text-sm font-medium bg-violet-50 text-violet-700 px-2.5 py-1 rounded-lg border border-violet-100 disabled:opacity-80"
            >
              {scopedEmployees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} · {e.position} · {displayStoreName(e.branch)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {dbError && (
        <div className="max-w-5xl mx-auto px-4 pt-3">
          <div className="bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl px-3 py-2">
            {dbError}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24 text-gray-400 gap-2"><Loader2 size={18} className="animate-spin" /> 불러오는 중...</div>
      ) : role === 'employee' ? (
        <EmployeeView
          tab={tab} setTab={setTab} months={months} month={month} setMonth={setMonth}
          draft={draft} setDraft={updateDraft} config={config} pay={myPay} mergedDraft={myMergedDraft}
          status={(monthRecords[empId] || {}).status || 'none'}
          saveDraft={saveDraft} saving={saving} saved={saved} dirty={dirty} lastSavedAt={lastSavedAt}
          dailyDays={dailyRecords[empId] || {}} allDailyRecords={dailyRecords} saveDailyDay={saveDailyDay}
          monthLocked={lockedMonths.includes(month)}
          canSeeCriteria={currentEmp?.branch === '운영진' || ['점장', '부점장'].includes(currentEmp?.position)}
          myRank={myRank} myRankTotal={myRankTotal} myBranchRank={myBranchRank} myBranchTotal={myBranchRanked.length}
          prevMonthTotal={prevMonthTotal}
          currentEmp={currentEmp}
          personalGoals={personalGoals}
          savePersonalGoals={savePersonalGoals}
          goalSaving={goalSaving}
          showPersonalGoal={empId === authUser?.id}
          competitionRows={salesRows}
          authUser={authUser} authProfile={authProfile}
        />
      ) : (
        <AdminView
          adminTab={adminTab} setAdminTab={setAdminTab} months={months} month={month} setMonth={setMonth}
          rows={scopedSalesRows} rankingRows={salesRows} dailyRecords={dailyRecords} totalPay={totalPay} pendingCount={pendingCount} approve={approve}
          config={config} persistConfig={persistConfig}
          employees={scopedEmployees} addEmployee={addEmployee} updateEmployee={updateEmployee} removeEmployee={removeEmployee}
          stores={stores} addStore={addStore} removeStore={removeStore}
          isFullAdmin={isFullAdmin}
          authUserId={authUser?.id}
          monthLocked={lockedMonths.includes(month)} toggleMonthLock={toggleMonthLock}
        />
      )}
    </div>
  );
}

/* ===================== 직원 화면 ===================== */


function getWorkActivityStats(dailyDays, month) {
  const [yy, mm] = month.split('-').map(Number);
  const now = new Date();
  const isCurrentMonth = monthKeyOf(now) === month;
  const lastDay = isCurrentMonth ? now.getDate() : daysInMonth(month);

  let activeDays = 0;
  for (let d = 1; d <= lastDay; d++) {
    const key = String(d).padStart(2, '0');
    const rec = normalizeDay(dailyDays?.[key]);
    if (!rec.dayOff && dayHasData(rec)) activeDays += 1;
  }

  let streak = 0;
  let todayHasData = false;
  let todayOff = false;

  for (let d = lastDay; d >= 1; d--) {
    const key = String(d).padStart(2, '0');
    const rec = normalizeDay(dailyDays?.[key]);

    if (isCurrentMonth && d === now.getDate()) {
      todayOff = !!rec.dayOff;
      todayHasData = !rec.dayOff && dayHasData(rec);
      if (rec.dayOff) continue;
      if (!dayHasData(rec)) continue; // 오늘은 아직 입력 전이어도 기존 연속 기록 유지
    }

    if (rec.dayOff) continue;
    if (dayHasData(rec)) {
      streak += 1;
      continue;
    }
    break;
  }

  return { activeDays, streak, todayHasData, todayOff, isCurrentMonth };
}

function WorkActivityCard({ dailyDays, month, onGoInput }) {
  const stats = useMemo(() => getWorkActivityStats(dailyDays, month), [dailyDays, month]);

  let message = '';
  if (!stats.isCurrentMonth) {
    message = `${monthLabel(month)} 활동 기록이에요`;
  } else if (stats.todayOff) {
    message = '오늘은 휴무예요. 푹 쉬고 다음 근무일부터 이어가요 :)';
  } else if (stats.todayHasData) {
    message = stats.streak > 0 ? '오늘 기록도 이어졌어요 🙌' : '오늘 기록 완료 🙌';
  } else if (stats.streak > 0) {
    message = `오늘 기록하면 ${stats.streak + 1}일 연속!`;
  } else {
    message = '오늘부터 첫 기록을 남겨보세요 🌱';
  }

  return (
    <button onClick={onGoInput} className="w-full text-left bg-white rounded-xl border border-orange-100 p-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center text-lg shrink-0">🔥</div>
        <div className="min-w-0 flex-1">
          <div className="text-xs text-gray-400">이번 달 활동</div>
          <div className="text-base font-bold text-gray-900 mt-0.5">
            {stats.streak > 0 ? `${stats.streak}근무일 연속 기록 중` : '기록을 시작해볼까요?'}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">{message}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-lg font-bold text-orange-600">{stats.activeDays}</div>
          <div className="text-[10px] text-gray-400">활동일</div>
        </div>
      </div>
    </button>
  );
}

const COMPETITION_METRICS = [
  { key: 'hs', label: 'HS', unit: '건', value: (r) => hsCount(r.draft) },
  { key: 'home', label: '홈', unit: '건', value: (r) => Number((r.draft?.homeBase?.homeOnly || 0) + (r.draft?.homeBase?.homeTv || 0)) },
  { key: 'tvFree', label: 'TV프리(부)', unit: '건', value: (r) => Number(r.draft?.homeFlat?.tvFree || 0) },
  { key: 'smartHome', label: '스마트홈', unit: '건', value: (r) => Number(r.draft?.homeFlat?.smartHome || 0) },
  { key: 'kpi', label: '생산성', unit: 'P', value: (r) => Number(r.pay?.kpiScore || 0) },
  { key: 'tailored', label: '맞춤제안', unit: '건', value: (r) => Number(r.draft?.tailoredCount || 0) },
];


function recentWindowDaysMap(daysMap, month, windowSize = 7) {
  const now = new Date();
  const isCurrent = monthKeyOf(now) === month;
  const endDay = isCurrent ? now.getDate() : daysInMonth(month);
  const startDay = Math.max(1, endDay - windowSize + 1);

  const out = {};
  for (let d = startDay; d <= endDay; d++) {
    const key = String(d).padStart(2, '0');
    if (daysMap?.[key]) out[key] = daysMap[key];
  }
  return out;
}

function metricValueFromDailyWindow(employee, daysMap, month, config, metricKey) {
  const windowDays = recentWindowDaysMap(daysMap, month, 7);
  const merged = applyDailyToDraft(
    emptyDraft(),
    windowDays,
    month,
    config.categoryMap,
    config.gibyeonColumnMap
  );
  const pay = computePay(
    merged,
    employee?.position || '사원',
    employee?.hireDate,
    month,
    config
  );

  const tempRow = { ...employee, draft: merged, pay };
  const metric = COMPETITION_METRICS.find((m) => m.key === metricKey) || COMPETITION_METRICS[0];
  return Number(metric.value(tempRow) || 0);
}

function buildRisingRanking(rows, dailyRecords, month, config, metricKey) {
  return [...(rows || [])]
    .filter((r) => !NON_SALES_STORES.includes(r.branch))
    .map((r) => ({
      ...r,
      recentValue: metricValueFromDailyWindow(
        r,
        dailyRecords?.[r.id] || {},
        month,
        config,
        metricKey
      ),
    }))
    .sort((a, b) => b.recentValue - a.recentValue || a.name.localeCompare(b.name));
}

function RisingRankingCard({ rows, dailyRecords, month, config, userId }) {
  const [metricKey, setMetricKey] = useState('hs');
  const metric = COMPETITION_METRICS.find((m) => m.key === metricKey) || COMPETITION_METRICS[0];

  const ranked = useMemo(
    () => buildRisingRanking(rows, dailyRecords, month, config, metricKey),
    [rows, dailyRecords, month, config, metricKey]
  );

  const top3 = ranked.slice(0, 3);
  const myIndex = ranked.findIndex((r) => r.id === userId);
  const me = myIndex >= 0 ? ranked[myIndex] : null;

  if (!ranked.length) return null;

  return (
    <div className="bg-white rounded-xl border border-orange-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-orange-50 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs text-orange-500">최근 7일</div>
          <div className="text-sm font-bold text-gray-900">급상승 랭킹 🔥</div>
        </div>
        <select
          value={metricKey}
          onChange={(e) => setMetricKey(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
        >
          {COMPETITION_METRICS.map((m) => (
            <option key={m.key} value={m.key}>{m.label}</option>
          ))}
        </select>
      </div>

      <div className="divide-y divide-gray-50">
        {top3.map((r, i) => (
          <div key={r.id} className="flex items-center justify-between px-4 py-3 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                i === 0
                  ? 'bg-amber-100 text-amber-700'
                  : i === 1
                    ? 'bg-gray-100 text-gray-600'
                    : 'bg-orange-100 text-orange-700'
              }`}>
                {i + 1}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-800 truncate">{r.name}</div>
                <div className="text-[11px] text-gray-400 truncate">{displayStoreName(r.branch)}</div>
              </div>
            </div>
            <div className="text-sm font-bold text-orange-600 shrink-0">
              +{formatCompetitionValue(r.recentValue, metric.unit)}
            </div>
          </div>
        ))}
      </div>

      {me && myIndex >= 3 && (
        <div className="px-4 py-3 bg-violet-50 flex items-center justify-between gap-3">
          <div className="text-xs font-semibold text-violet-700">나는 현재 {myIndex + 1}위</div>
          <div className="text-sm font-bold text-violet-700">
            +{formatCompetitionValue(me.recentValue, metric.unit)}
          </div>
        </div>
      )}
    </div>
  );
}

function formatCompetitionValue(v, unit) {
  return unit === 'P' ? `${Number(v || 0).toFixed(1)}P` : `${Math.round(Number(v || 0))}건`;
}

function MyRankingCard({ rows, userId, branch }) {
  const [metricKey, setMetricKey] = useState('hs');
  const metric = COMPETITION_METRICS.find((m) => m.key === metricKey) || COMPETITION_METRICS[0];

  const ranked = useMemo(() => [...(rows || [])]
    .filter((r) => !NON_SALES_STORES.includes(r.branch))
    .sort((a, b) => metric.value(b) - metric.value(a) || a.name.localeCompare(b.name)),
  [rows, metricKey]);

  const idx = ranked.findIndex((r) => r.id === userId);
  if (idx < 0 || ranked.length <= 1) return null;

  const mine = ranked[idx];
  const above = idx > 0 ? ranked[idx - 1] : null;
  const below = idx < ranked.length - 1 ? ranked[idx + 1] : null;
  const gap = above ? Math.max(0, metric.value(above) - metric.value(mine)) : 0;

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <div className="text-xs text-gray-400">내 주변 순위</div>
          <div className="text-sm font-bold text-gray-900">전체 {idx + 1}위 · {mine.name}</div>
        </div>
        <select value={metricKey} onChange={(e) => setMetricKey(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
          {COMPETITION_METRICS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select>
      </div>

      <div className="space-y-1.5">
        {above && (
          <div className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-gray-50">
            <span>{idx}위 · {above.name}</span>
            <b>{formatCompetitionValue(metric.value(above), metric.unit)}</b>
          </div>
        )}
        <div className="flex items-center justify-between text-sm px-3 py-2 rounded-lg bg-violet-50 text-violet-800">
          <span className="font-bold">{idx + 1}위 · {mine.name}</span>
          <b>{formatCompetitionValue(metric.value(mine), metric.unit)}</b>
        </div>
        {below && (
          <div className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-gray-50">
            <span>{idx + 2}위 · {below.name}</span>
            <b>{formatCompetitionValue(metric.value(below), metric.unit)}</b>
          </div>
        )}
      </div>

      {above && (
        <div className="text-xs text-gray-500 mt-3">
          {idx === 1 ? '1위' : `${idx}위`}까지 <b className="text-violet-700">
            {formatCompetitionValue(gap, metric.unit)}
          </b> 차이예요 🔥
        </div>
      )}
    </div>
  );
}


/* ===================== 게임화 2차: 배지 · 퀘스트 · 칭호 · 인정 ===================== */

const BADGE_DEFS = [
  { key: 'first_step', icon: '🌱', name: '첫 발자국', rarity: 'COMMON', hidden: false, desc: '첫 실적 기록을 남겼어요.', auto: true },
  { key: 'streak5', icon: '🔥', name: '폼 올라오는 중', rarity: 'RARE', hidden: false, desc: '5근무일 연속 기록을 달성했어요.', auto: true },
  { key: 'streak10', icon: '🔥', name: '꾸준함이 실력', rarity: 'EPIC', hidden: true, desc: '10근무일 연속 기록을 달성했어요.', auto: true },
  { key: 'rising3', icon: '⚡', name: '요즘 좀 치는데?', rarity: 'RARE', hidden: false, desc: '최근 7일 핵심지표 TOP3에 진입했어요.', auto: true },
  { key: 'top3', icon: '🥉', name: '순위권 입성', rarity: 'EPIC', hidden: false, desc: '핵심지표 전체 TOP3에 진입했어요.', auto: true },
  { key: 'number1', icon: '👑', name: '오늘은 내가 1등', rarity: 'LEGEND', hidden: true, desc: '핵심지표 전체 1위를 달성했어요.', auto: true },
  { key: 'goal_one', icon: '🎯', name: '말보다 결과', rarity: 'RARE', hidden: false, desc: '내가 정한 월 목표를 하나 달성했어요.', auto: true },
  { key: 'goal_all', icon: '🏆', name: '싹쓸이', rarity: 'LEGEND', hidden: true, desc: '이번 달에 설정한 목표를 모두 달성했어요.', auto: true },

  // 관리자/점장 특별 배지
  { key: 'special_growth', icon: '⭐', name: '이달의 성장', rarity: 'SPECIAL', hidden: false, desc: '관리자가 직접 인정한 성장 배지예요.', auto: false },
  { key: 'special_team', icon: '🤝', name: '팀플레이어', rarity: 'SPECIAL', hidden: false, desc: '동료와 매장에 좋은 영향을 준 사람에게 주는 배지예요.', auto: false },
  { key: 'special_pick', icon: '💎', name: '점장 PICK', rarity: 'SPECIAL', hidden: false, desc: '관리자가 직접 선정한 특별 배지예요.', auto: false },
];

const SPECIAL_BADGE_KEYS = ['special_growth', 'special_team', 'special_pick'];

function badgeDefOf(key) {
  return BADGE_DEFS.find((b) => b.key === key) || null;
}

function evaluateAutomaticBadges({
  dailyDays,
  month,
  personalGoals,
  mergedDraft,
  pay,
  competitionRows,
  allDailyRecords,
  config,
  userId,
}) {
  const earned = new Set();
  const stats = getWorkActivityStats(dailyDays, month);

  if (stats.activeDays > 0) earned.add('first_step');
  if (stats.streak >= 5) earned.add('streak5');
  if (stats.streak >= 10) earned.add('streak10');

  const actuals = getPersonalGoalActuals(mergedDraft, pay);
  const goals = Object.entries(personalGoals || {}).filter(([, value]) => Number(value) > 0);
  const completed = goals.filter(([key, value]) => Number(actuals[key] || 0) >= Number(value));

  if (completed.length > 0) earned.add('goal_one');
  if (goals.length > 0 && completed.length === goals.length) earned.add('goal_all');

  let bestMonthlyRank = Infinity;
  COMPETITION_METRICS.forEach((metric) => {
    const ranked = [...(competitionRows || [])]
      .filter((r) => !NON_SALES_STORES.includes(r.branch))
      .sort((a, b) => metric.value(b) - metric.value(a) || a.name.localeCompare(b.name));
    const idx = ranked.findIndex((r) => r.id === userId);
    if (idx >= 0 && Number(metric.value(ranked[idx]) || 0) > 0) {
      bestMonthlyRank = Math.min(bestMonthlyRank, idx + 1);
    }
  });

  if (bestMonthlyRank <= 3) earned.add('top3');
  if (bestMonthlyRank === 1) earned.add('number1');

  let bestRecentRank = Infinity;
  COMPETITION_METRICS.forEach((metric) => {
    const ranked = buildRisingRanking(
      competitionRows,
      allDailyRecords,
      month,
      config,
      metric.key
    );
    const idx = ranked.findIndex((r) => r.id === userId);
    if (idx >= 0 && Number(ranked[idx]?.recentValue || 0) > 0) {
      bestRecentRank = Math.min(bestRecentRank, idx + 1);
    }
  });

  if (bestRecentRank <= 3) earned.add('rising3');

  return earned;
}

function RecognitionSpotlight({ rows, dailyRecords, month, config, specialFeed }) {
  const highlights = useMemo(() => {
    const out = [];

    // 월간 1위 중 서로 다른 사람을 최대 2명 노출
    const used = new Set();
    for (const metric of COMPETITION_METRICS) {
      const ranked = [...(rows || [])]
        .filter((r) => !NON_SALES_STORES.includes(r.branch))
        .sort((a, b) => metric.value(b) - metric.value(a));
      const top = ranked[0];
      if (top && Number(metric.value(top) || 0) > 0 && !used.has(top.id)) {
        out.push({
          id: `month-${metric.key}-${top.id}`,
          icon: '👑',
          title: `${metric.label} 전체 1위`,
          name: top.name,
          branch: top.branch,
        });
        used.add(top.id);
      }
      if (out.length >= 2) break;
    }

    // 최근 7일 급상승 1명
    const rising = buildRisingRanking(rows, dailyRecords, month, config, 'hs')[0];
    if (rising && rising.recentValue > 0 && !used.has(rising.id)) {
      out.push({
        id: `rising-${rising.id}`,
        icon: '⚡',
        title: '최근 7일 HS 급상승',
        name: rising.name,
        branch: rising.branch,
      });
    }

    return out.slice(0, 3);
  }, [rows, dailyRecords, month, config]);

  const combined = [
    ...(specialFeed || []).slice(0, 2),
    ...highlights,
  ].slice(0, 4);

  if (!combined.length) return null;

  return (
    <div className="bg-white rounded-xl border border-amber-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-amber-50">
        <div className="text-xs text-amber-600">지금 주목할 사람 ✨</div>
        <div className="text-sm font-bold text-gray-900 mt-0.5">좋은 기록은 같이 봐야 제맛</div>
      </div>

      <div className="divide-y divide-gray-50">
        {combined.map((item) => (
          <div key={item.id} className="px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-lg shrink-0">
              {item.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-gray-800 truncate">{item.name}</div>
              <div className="text-xs text-violet-600 font-medium mt-0.5">{item.title}</div>
              {item.branch && <div className="text-[10px] text-gray-400 mt-0.5 truncate">{displayStoreName(item.branch)}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GamificationHub({
  dailyDays,
  month,
  personalGoals,
  mergedDraft,
  pay,
  competitionRows,
  allDailyRecords,
  config,
  userId,
}) {
  const [storedBadges, setStoredBadges] = useState([]);
  const [titleKey, setTitleKey] = useState('');
  const [loadingBadges, setLoadingBadges] = useState(true);
  const [showCollection, setShowCollection] = useState(false);
  const [newBadge, setNewBadge] = useState(null);
  const [specialFeed, setSpecialFeed] = useState([]);

  const autoEarned = useMemo(
    () => evaluateAutomaticBadges({
      dailyDays,
      month,
      personalGoals,
      mergedDraft,
      pay,
      competitionRows,
      allDailyRecords,
      config,
      userId,
    }),
    [
      dailyDays,
      month,
      personalGoals,
      mergedDraft,
      pay,
      competitionRows,
      allDailyRecords,
      config,
      userId,
    ]
  );

  const earnedKeys = useMemo(() => {
    const set = new Set(storedBadges.map((r) => r.badge_key));
    autoEarned.forEach((key) => set.add(key));
    return set;
  }, [storedBadges, autoEarned]);

  const actuals = useMemo(() => getPersonalGoalActuals(mergedDraft, pay), [mergedDraft, pay]);
  const quests = PERSONAL_GOAL_DEFS.filter((def) => Number(personalGoals?.[def.key]) > 0);

  const loadBadges = useCallback(async () => {
    if (!userId) return;

    setLoadingBadges(true);

    const [{ data: badgeRows, error: badgeError }, { data: titleRow }] = await Promise.all([
      supabase
        .from('user_achievements')
        .select('badge_key, earned_at, awarded_by, note')
        .eq('user_id', userId)
        .order('earned_at', { ascending: true }),
      supabase
        .from('user_titles')
        .select('badge_key')
        .eq('user_id', userId)
        .maybeSingle(),
    ]);

    if (!badgeError) setStoredBadges(badgeRows || []);
    setTitleKey(titleRow?.badge_key || '');

    // 최근 특별 인정 피드
    try {
      const { data: recentAwards } = await supabase
        .from('user_achievements')
        .select('id, user_id, badge_key, earned_at, note')
        .not('awarded_by', 'is', null)
        .order('earned_at', { ascending: false })
        .limit(6);

      const ids = [...new Set((recentAwards || []).map((r) => r.user_id))];
      let names = {};
      if (ids.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, name, store_name')
          .in('id', ids);
        names = Object.fromEntries((profs || []).map((p) => [p.id, p]));
      }

      setSpecialFeed(
        (recentAwards || []).map((r) => {
          const def = badgeDefOf(r.badge_key);
          const profile = names[r.user_id] || {};
          return {
            id: `award-${r.id}`,
            icon: def?.icon || '⭐',
            title: def?.name || '특별 인정',
            name: profile.name || '직원',
            branch: profile.store_name || '',
          };
        })
      );
    } catch (e) {
      // 공개 인정 피드가 실패해도 본인 배지 기능은 유지
    }

    setLoadingBadges(false);
  }, [userId]);

  useEffect(() => {
    loadBadges();
  }, [loadBadges]);

  // 자동 달성 배지를 DB에 영구 보관
  useEffect(() => {
    if (!userId || loadingBadges) return;

    const stored = new Set(storedBadges.map((r) => r.badge_key));
    const missing = [...autoEarned].filter((key) => !stored.has(key));

    if (!missing.length) return;

    (async () => {
      for (const key of missing) {
        const { error } = await supabase
          .from('user_achievements')
          .insert({
            user_id: userId,
            badge_key: key,
            awarded_by: null,
          });

        if (!error) {
          const def = badgeDefOf(key);
          if (def) setNewBadge(def);
        } else if (error.code !== '23505') {
          console.error('ACHIEVEMENT SAVE ERROR:', error);
        }
      }

      await loadBadges();
    })();
  }, [autoEarned, storedBadges, loadingBadges, userId, loadBadges]);

  const saveTitle = async (key) => {
    if (!userId || !earnedKeys.has(key)) return;

    const { error } = await supabase
      .from('user_titles')
      .upsert(
        {
          user_id: userId,
          badge_key: key,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (!error) setTitleKey(key);
  };

  const titleDef = badgeDefOf(titleKey);

  return (
    <>
      {quests.length > 0 && (
        <div className="bg-white rounded-xl border border-violet-100 p-4">
          <div className="text-xs text-violet-500">이번 달 뭐 노려볼까?</div>
          <div className="text-sm font-bold text-gray-900 mt-0.5">🎯 나의 퀘스트</div>

          <div className="mt-3 space-y-3">
            {quests.map((def) => {
              const target = Number(personalGoals[def.key]);
              const current = Number(actuals[def.key] || 0);
              const pct = Math.max(0, Math.min(100, target ? (current / target) * 100 : 0));
              const done = current >= target;

              const fmt = (value) => {
                if (def.unit === '원') return Math.round(value).toLocaleString();
                if (def.unit === 'P') return Number(value).toFixed(1);
                return Math.round(value);
              };

              return (
                <div key={def.key}>
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-semibold text-gray-700">{def.label}</span>
                    <span className={done ? 'font-bold text-emerald-600' : 'text-gray-500'}>
                      {done ? '완료 ✨' : `${fmt(current)} / ${fmt(target)}${def.unit}`}
                    </span>
                  </div>

                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden mt-1.5">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        done ? 'bg-emerald-500' : 'bg-violet-600'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  {!done && pct >= 80 && (
                    <div className="text-[10px] text-violet-500 mt-1">거의 다 왔는데? 👀</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs text-gray-400">나의 기록 컬렉션</div>
            <div className="text-sm font-bold text-gray-900 mt-0.5">
              🏅 내 배지 <span className="text-violet-600">{earnedKeys.size}</span>
            </div>
            {titleDef && (
              <div className="text-xs text-violet-600 mt-1">
                대표 칭호 · {titleDef.icon} {titleDef.name}
              </div>
            )}
          </div>

          <button
            onClick={() => setShowCollection((v) => !v)}
            className="text-xs text-violet-600 font-semibold"
          >
            {showCollection ? '접기' : '전체 보기'}
          </button>
        </div>

        <div className={`grid ${showCollection ? 'grid-cols-2' : 'grid-cols-4'} gap-2 mt-3`}>
          {(showCollection
            ? BADGE_DEFS
            : BADGE_DEFS.filter((b) => earnedKeys.has(b.key)).slice(0, 4)
          ).map((badge) => {
            const got = earnedKeys.has(badge.key);

            return (
              <button
                key={badge.key}
                disabled={!got}
                onClick={() => got && saveTitle(badge.key)}
                className={`rounded-xl border p-3 text-center ${
                  got
                    ? titleKey === badge.key
                      ? 'bg-violet-100 border-violet-300 ring-1 ring-violet-200'
                      : 'bg-violet-50 border-violet-100'
                    : 'bg-gray-50 border-gray-100 opacity-55'
                }`}
              >
                <div className="text-2xl">
                  {got ? badge.icon : badge.hidden ? '❓' : '🔒'}
                </div>
                <div className="text-[11px] font-bold text-gray-800 mt-1">
                  {got ? badge.name : badge.hidden ? '???' : badge.name}
                </div>

                {showCollection && (
                  <>
                    <div className="text-[9px] text-gray-400 mt-0.5">
                      {got ? badge.rarity : badge.hidden ? 'HIDDEN' : badge.rarity}
                    </div>
                    {got && (
                      <div className="text-[10px] text-gray-500 mt-1 leading-tight">
                        {badge.desc}
                      </div>
                    )}
                    {got && (
                      <div className="text-[9px] text-violet-500 mt-1.5">
                        {titleKey === badge.key ? '대표 칭호 사용 중' : '눌러서 대표 칭호로 설정'}
                      </div>
                    )}
                  </>
                )}
              </button>
            );
          })}

          {!showCollection && earnedKeys.size === 0 && (
            <div className="col-span-4 text-xs text-gray-400 py-3 text-center">
              첫 기록을 남기면 첫 배지가 열려요 🌱
            </div>
          )}
        </div>
      </div>

      <RecognitionSpotlight
        rows={competitionRows}
        dailyRecords={allDailyRecords}
        month={month}
        config={config}
        specialFeed={specialFeed}
      />

      {newBadge && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-5">
          <div className="w-full max-w-xs bg-white rounded-3xl p-6 shadow-2xl text-center">
            <div className="text-[11px] tracking-[0.25em] text-violet-500 font-bold">NEW BADGE</div>
            <div className="text-5xl mt-4">{newBadge.icon}</div>
            <div className="text-xl font-bold text-gray-900 mt-3">{newBadge.name}</div>
            <div className="text-xs font-semibold text-violet-500 mt-1">{newBadge.rarity}</div>
            <div className="text-sm text-gray-500 mt-3">{newBadge.desc}</div>
            <div className="text-xs text-gray-400 mt-2">잘한 건 티 내도 돼요 ✨</div>

            <div className="mt-5 space-y-2">
              <button
                onClick={async () => {
                  await saveTitle(newBadge.key);
                  setNewBadge(null);
                }}
                className="w-full py-2.5 rounded-xl bg-violet-600 text-white text-sm font-bold"
              >
                대표 칭호로 설정
              </button>
              <button
                onClick={() => setNewBadge(null)}
                className="w-full py-2 text-sm text-gray-400"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SpecialBadgeAwardPanel({ employees, authUserId }) {
  const [employeeId, setEmployeeId] = useState(employees?.[0]?.id || '');
  const [badgeKey, setBadgeKey] = useState('special_growth');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!employees?.some((e) => e.id === employeeId)) {
      setEmployeeId(employees?.[0]?.id || '');
    }
  }, [employees, employeeId]);

  const award = async () => {
    if (!employeeId || !badgeKey) return;

    setSaving(true);
    setMessage('');

    const { error } = await supabase
      .from('user_achievements')
      .insert({
        user_id: employeeId,
        badge_key: badgeKey,
        awarded_by: authUserId,
        note: note.trim() || null,
      });

    if (error) {
      if (error.code === '23505') {
        setMessage('이미 이 배지를 받은 직원이에요.');
      } else {
        setMessage(`배지 수여 실패: ${friendlyError(error)}`);
      }
    } else {
      const employee = employees.find((e) => e.id === employeeId);
      const badge = badgeDefOf(badgeKey);
      setMessage(`${employee?.name || '직원'}님에게 ${badge?.icon || '⭐'} ${badge?.name || '특별 배지'}를 수여했어요.`);
      setNote('');
    }

    setSaving(false);
  };

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-violet-100 p-4">
        <div className="text-xs text-violet-500">관리자가 직접 전하는 인정</div>
        <div className="text-base font-bold text-gray-900 mt-0.5">⭐ 특별 배지 수여</div>
        <div className="text-xs text-gray-400 mt-1">
          숫자로 다 담기 어려운 성장과 팀워크도 기록으로 남겨주세요.
        </div>

        <div className="mt-4 grid md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">직원</label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
            >
              {(employees || []).map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} · {displayStoreName(e.branch)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">배지</label>
            <select
              value={badgeKey}
              onChange={(e) => setBadgeKey(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
            >
              {SPECIAL_BADGE_KEYS.map((key) => {
                const badge = badgeDefOf(key);
                return (
                  <option key={key} value={key}>
                    {badge?.icon} {badge?.name}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        <div className="mt-3">
          <label className="block text-xs font-semibold text-gray-500 mb-1">
            한마디 <span className="font-normal text-gray-300">(선택)</span>
          </label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="예: 이번 달 성장세가 정말 좋았어요!"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <button
          onClick={award}
          disabled={saving || !employeeId}
          className="w-full mt-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-bold disabled:opacity-50"
        >
          {saving ? '수여 중...' : '특별 배지 수여'}
        </button>

        {message && (
          <div className="mt-3 text-xs bg-gray-50 rounded-lg p-2.5 text-gray-600">{message}</div>
        )}
      </div>
    </div>
  );
}


/* ===================== v11 홈 청약 관리 ===================== */
const HOME_ORDER_PRODUCTS = [
  { key: 'homeOnly', label: '홈 단독' },
  { key: 'homeTv', label: '홈+TV 동시청약' },
  { key: 'tvFree', label: 'TV프리(부)' },
  { key: 'smartHome', label: '스마트홈' },
];

function homeOrderMeta(groupKey, itemKey) {
  const map = {
    'homeBase.homeOnly': { productType: 'homeOnly', label: '홈 단독' },
    'homeBase.homeTv': { productType: 'homeTv', label: '홈+TV 동시청약' },
    'homeFlat.tvFree': { productType: 'tvFree', label: 'TV프리(부)' },
    'homeFlat.smartHome': { productType: 'smartHome', label: '스마트홈' },
  };
  return map[`${groupKey}.${itemKey}`] || null;
}



function HomeOrderManager({ userId, month, locked, dailyDays, saveDailyDay }) {
  const [orders, setOrders] = useState([]);
  const [product, setProduct] = useState('homeOnly');
  const [customerName, setCustomerName] = useState('');
  const [memo, setMemo] = useState('');
  const [directComplete, setDirectComplete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [homeCompletionTarget, setHomeCompletionTarget] = useState(null);
  const [homeActualCompleteDate, setHomeActualCompleteDate] = useState('');

  const load = useCallback(async () => {
    if (!userId) return;
    const start = `${month}-01T00:00:00`;
    const d = new Date(`${month}-01T00:00:00`);
    d.setMonth(d.getMonth() + 1);
    const end = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01T00:00:00`;
    const { data, error } = await supabase.from('home_orders').select('*')
      .eq('user_id', userId).gte('applied_at', start).lt('applied_at', end)
      .order('applied_at', { ascending: false });
    if (!error) setOrders(data || []);
  }, [userId, month]);

  useEffect(() => { load(); }, [load]);


  const changeStatus = async (order, status) => {
    if (locked) return;
    if (status === 'completed') {
      const t = new Date();
      setHomeCompletionTarget(order);
      setHomeActualCompleteDate(`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`);
      return;
    }
    if (!window.confirm('취소 처리할까요?')) return;
    const now = new Date().toISOString();
    const { error } = await supabase.from('home_orders').update({
      status:'cancelled', cancelled_at:now, updated_at:now
    }).eq('id',order.id).eq('user_id',userId);
    if (error) return alert(`상태 변경 실패: ${friendlyError(error)}`);
    const productLabel=HOME_ORDER_PRODUCTS.find(p=>p.key===order.product_type)?.label||order.product_type;
    notifyStoreManagers({actorId:userId,type:'home_cancelled',title:'홈 청약 취소',
      message:`${order.customer_name ? `${order.customer_name} · ` : ''}${productLabel}`,
      payload:{order_id:order.id,product_type:order.product_type,status:'cancelled'}});
    await load();
  };

  const confirmCompletion = async () => {
    const order=homeCompletionTarget;
    if (!order || !homeActualCompleteDate || locked) return;
    const [y,m,d]=homeActualCompleteDate.split('-');
    const completionMonth=`${y}-${m}`;
    const completionDay=d;

    if (order.source_group && order.source_key) {
      if (completionMonth === month) {
        const base=normalizeDay(dailyDays?.[completionDay]);
        const current=Number(base.groups?.[order.source_group]?.[order.source_key]||0);
        const next={...base,groups:{...base.groups,[order.source_group]:{
          ...(base.groups?.[order.source_group]||{}),[order.source_key]:current+1}}};
        const ok=await saveDailyDay(completionDay,next);
        if (!ok) return alert('확정 실적 반영에 실패했어요. 다시 시도해주세요.');
      } else {
        const completionWorkDate = `${completionMonth}-${completionDay}`;
        const { data: rec, error: loadError } = await supabase
          .from('daily_records')
          .select('data')
          .eq('user_id', userId)
          .eq('work_date', completionWorkDate)
          .maybeSingle();

        if (loadError) {
          return alert(`완료일 실적 불러오기 실패: ${friendlyError(loadError)}`);
        }

        const base = normalizeDay(rec?.data);
        const current = Number(base.groups?.[order.source_group]?.[order.source_key] || 0);
        const next = {
          ...base,
          groups: {
            ...base.groups,
            [order.source_group]: {
              ...(base.groups?.[order.source_group] || {}),
              [order.source_key]: current + 1,
            },
          },
        };

        const { error: de } = await supabase
          .from('daily_records')
          .upsert(
            {
              user_id: userId,
              work_date: completionWorkDate,
              data: next,
            },
            { onConflict: 'user_id,work_date' }
          );

        if (de) return alert(`확정 실적 반영 실패: ${friendlyError(de)}`);
      }
    }

    const completedAt=new Date(`${homeActualCompleteDate}T12:00:00`).toISOString();
    const {error}=await supabase.from('home_orders').update({
      status:'completed',completed_at:completedAt,actual_install_date:homeActualCompleteDate,updated_at:new Date().toISOString()
    }).eq('id',order.id).eq('user_id',userId);
    if(error)return alert(`완료 처리 실패: ${friendlyError(error)}`);

    const productLabel=HOME_ORDER_PRODUCTS.find(p=>p.key===order.product_type)?.label||order.product_type;
    notifyStoreManagers({actorId:userId,type:'home_completed',title:'홈 설치/개통 완료',
      message:`${order.customer_name ? `${order.customer_name} · ` : ''}${productLabel} · ${homeActualCompleteDate}`,
      payload:{order_id:order.id,product_type:order.product_type,status:'completed',actual_install_date:homeActualCompleteDate}});
    setHomeCompletionTarget(null); setHomeActualCompleteDate(''); await load();
  };

  const careInfo = (o) => {
    const p=o.planned_install_date ? String(o.planned_install_date).slice(0,10) : null;
    if(!p)return {rank:3,label:'일정 미정',cls:'text-gray-500 bg-gray-50'};
    const now=new Date(), a=new Date(now.getFullYear(),now.getMonth(),now.getDate()), b=new Date(`${p}T00:00:00`);
    const diff=Math.round((b-a)/86400000);
    if(diff<0)return {rank:0,label:`확인 필요 · ${Math.abs(diff)}일 경과`,cls:'text-red-600 bg-red-50'};
    if(diff===0)return {rank:1,label:'오늘 설치 예정',cls:'text-orange-600 bg-orange-50'};
    return {rank:2,label:`${diff}일 후 설치 예정`,cls:'text-violet-600 bg-violet-50'};
  };

  const pending = orders.filter(o => o.status === 'pending').sort((a,b)=>careInfo(a).rank-careInfo(b).rank || String(a.planned_install_date||'9999').localeCompare(String(b.planned_install_date||'9999')));
  const completed = orders.filter(o => o.status === 'completed');
  const cancelled = orders.filter(o => o.status === 'cancelled');

  return (
    <div className="space-y-3 mb-4">
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="text-xs text-gray-400">이번 달 진행 현황</div>
        <div className="text-sm font-bold text-gray-900 mt-0.5">
          진행중 {pending.length} · 완료 {completed.length} · 취소 {cancelled.length}
        </div>
        {pending.length ? (
          <div className="mt-3 space-y-4">
            {Object.entries(
              pending.reduce((acc, o) => {
                const day = o.source_work_date
                  ? new Date(`${o.source_work_date}T12:00:00`).toLocaleDateString('ko-KR')
                  : new Date(o.applied_at).toLocaleDateString('ko-KR');
                const customer = o.customer_name || '고객명 미입력';
                const key = `${day}__${customer}`;
                if (!acc[key]) acc[key] = { day, customer, items: [] };
                acc[key].items.push(o);
                return acc;
              }, {})
            ).map(([key, group]) => (
              <div key={key}>
                <div className="text-[11px] font-semibold text-gray-400 mb-1.5">{group.day}</div>
                <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="text-sm font-bold text-gray-900">{group.customer} 고객</div>
                    <span className="text-[10px] font-bold text-amber-600">{group.items.length}개 진행중</span>
                  </div>
                  <div className="space-y-2">
                    {group.items.map(o => {
                      const def = HOME_ORDER_PRODUCTS.find(p => p.key === o.product_type);
                      return (
                        <div key={o.id} className="bg-white/80 rounded-lg p-2.5">
                          <div className="flex justify-between gap-2">
                            <div>
                              <div className="text-xs font-semibold text-gray-800">{def?.label || o.product_type}</div>
                              {o.memo && <div className="text-[11px] text-gray-400 mt-0.5">{o.memo}</div>}
                              <div className="text-[10px] text-gray-400 mt-1">설치예정 {o.planned_install_date ? String(o.planned_install_date).slice(0,10) : '미정'}</div>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${careInfo(o).cls}`}>{careInfo(o).label}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <button type="button" disabled={locked} onClick={()=>changeStatus(o,'completed')}
                              className="py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold disabled:opacity-50">설치/개통 완료</button>
                            <button type="button" disabled={locked} onClick={()=>changeStatus(o,'cancelled')}
                              className="py-2 rounded-lg bg-white border border-gray-200 text-gray-500 text-xs font-semibold disabled:opacity-50">취소</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : <div className="mt-3 rounded-xl bg-gray-50 py-4 text-center text-xs text-gray-400">현재 케어할 진행중 청약이 없어요.</div>}
        {(completed.length>0 || cancelled.length>0) && (
          <details className="mt-3">
            <summary className="text-xs font-semibold text-violet-600 cursor-pointer">완료·취소 내역 보기</summary>
            <div className="mt-2 space-y-1.5">
              {[...completed,...cancelled].sort((a,b)=>new Date(b.applied_at)-new Date(a.applied_at)).map(o=>{
                const def=HOME_ORDER_PRODUCTS.find(p=>p.key===o.product_type);
                return <div key={o.id} className="flex justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2">
                  <span className="text-xs font-semibold text-gray-700">{o.customer_name ? `${o.customer_name} · ` : ''}{def?.label || o.product_type}</span>
                  <span className={`text-[10px] font-bold ${o.status==='completed'?'text-emerald-600':'text-gray-400'}`}>{o.status==='completed'?'완료':'취소'}</span>
                </div>
              })}
            </div>
          </details>
        )}
      </div>
      <div className="text-[11px] text-gray-400 px-1">
        확정 실적은 실제 설치/개통 완료일 기준으로 반영돼요.
      </div>
      {homeCompletionTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl">
            <div className="text-xs text-emerald-600 font-semibold">설치/개통 완료</div>
            <div className="text-lg font-bold text-gray-900 mt-1">
              {homeCompletionTarget.customer_name || '고객'} · {HOME_ORDER_PRODUCTS.find(p=>p.key===homeCompletionTarget.product_type)?.label || homeCompletionTarget.product_type}
            </div>
            <label className="block text-xs font-semibold text-gray-500 mt-4 mb-1.5">실제 설치/개통 완료일 *</label>
            <input type="date" value={homeActualCompleteDate} onChange={(e)=>setHomeActualCompleteDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm" />
            <div className="text-[11px] text-gray-400 mt-2">선택한 실제 완료일의 확정 실적으로 반영됩니다.</div>
            <div className="grid grid-cols-2 gap-2 mt-5">
              <button onClick={()=>{setHomeCompletionTarget(null);setHomeActualCompleteDate('');}}
                className="py-2.5 rounded-xl bg-gray-100 text-gray-500 text-sm font-semibold">닫기</button>
              <button onClick={confirmCompletion} disabled={!homeActualCompleteDate}
                className="py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold disabled:opacity-50">완료 처리</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}


/* ===================== v12 관리자 알림센터 ===================== */

function NotificationBell({ userId, onOpen }) {
  const [unread, setUnread] = useState(0);

  const loadUnread = useCallback(async () => {
    if (!userId) return;
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', userId)
      .eq('read', false);

    if (!error) setUnread(count || 0);
  }, [userId]);

  useEffect(() => {
    loadUnread();

    if (!userId) return;

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        () => loadUnread()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, loadUnread]);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="relative w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-gray-600"
      title="알림"
    >
      <Bell size={17} />
      {unread > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  );
}

function NotificationCenter({ userId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (!error) setItems(data || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const markRead = async (id) => {
    const { error } = await supabase
      .from('notifications')
      .update({
        read: true,
        read_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('recipient_id', userId);

    if (!error) {
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    }
  };

  const markAllRead = async () => {
    const { error } = await supabase
      .from('notifications')
      .update({
        read: true,
        read_at: new Date().toISOString(),
      })
      .eq('recipient_id', userId)
      .eq('read', false);

    if (!error) {
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  };

  const unreadCount = items.filter((n) => !n.read).length;

  const iconFor = (type) => {
    if (type === 'home_order') return '🏠';
    if (type === 'home_completed') return '✅';
    if (type === 'home_cancelled') return '⚠️';
    if (type === 'daily_input') return '📈';
    return '🔔';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-4 text-sm text-gray-400 flex items-center gap-2">
        <Loader2 size={14} className="animate-spin" />
        알림 불러오는 중...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs text-gray-400">관리자 알림</div>
          <div className="text-base font-bold text-gray-900 mt-0.5">
            🔔 알림센터
          </div>
          <div className="text-xs text-gray-400 mt-1">
            읽지 않은 알림 {unreadCount}개
          </div>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="text-xs font-semibold text-violet-600"
          >
            모두 읽음
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {items.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-400">
            아직 알림이 없어요.
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {items.map((n) => (
              <button
                key={n.id}
                onClick={() => !n.read && markRead(n.id)}
                className={`w-full text-left px-4 py-3 flex gap-3 ${
                  n.read ? 'bg-white' : 'bg-violet-50/60'
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center shrink-0 text-lg">
                  {iconFor(n.type)}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className={`text-sm ${n.read ? 'font-medium text-gray-700' : 'font-bold text-gray-900'}`}>
                      {n.title}
                    </div>
                    {!n.read && (
                      <span className="w-2 h-2 rounded-full bg-violet-500 shrink-0" />
                    )}
                  </div>

                  {n.message && (
                    <div className="text-xs text-gray-500 mt-0.5">
                      {n.message}
                    </div>
                  )}

                  <div className="text-[10px] text-gray-400 mt-1">
                    {new Date(n.created_at).toLocaleString('ko-KR')}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

async function notifyStoreManagers({ actorId, type, title, message, payload = {} }) {
  if (!actorId) return;

  try {
    const { data: actor, error: actorError } = await supabase
      .from('profiles')
      .select('id, name, store_name')
      .eq('id', actorId)
      .maybeSingle();

    if (actorError || !actor?.store_name) return;

    const { data: managers, error: managersError } = await supabase
      .from('profiles')
      .select('id')
      .eq('store_name', actor.store_name)
      .eq('active', true)
      .eq('status', 'approved')
      .in('position', ['점장', '부점장']);

    if (managersError || !managers?.length) return;

    const rows = managers
      .filter((m) => m.id !== actorId)
      .map((m) => ({
        recipient_id: m.id,
        actor_id: actorId,
        type,
        title,
        message,
        payload,
      }));

    if (!rows.length) return;

    const { error } = await supabase.from('notifications').insert(rows);
    if (error) console.error('NOTIFICATION INSERT ERROR:', error);
  } catch (e) {
    console.error('NOTIFICATION ERROR:', e);
  }
}

function EmployeeView({ tab, setTab, months, month, setMonth, draft, setDraft, config, pay, mergedDraft, status, saveDraft, saving, saved, dirty, lastSavedAt, dailyDays, allDailyRecords, saveDailyDay, monthLocked, canSeeCriteria, myRank, myRankTotal, myBranchRank, myBranchTotal, prevMonthTotal, currentEmp, personalGoals, savePersonalGoals, goalSaving, showPersonalGoal, competitionRows, authUser, authProfile }) {
  const set = (group, next) => setDraft({ ...draft, [group]: next });
  useEffect(() => {
    if (tab === 'criteria' && !canSeeCriteria) setTab('home');
  }, [tab, canSeeCriteria]); // eslint-disable-line
  const dailyAgg = useMemo(() => aggregateDaily(dailyDays, month), [dailyDays, month]);
  const groupAutoKeys = useMemo(() => {
    const out = {};
    DAILY_GROUP_KEYS.forEach((gk) => {
      out[gk] = new Set(Object.entries(dailyAgg.groups[gk] || {}).filter(([, v]) => v > 0).map(([k]) => k));
    });
    return out;
  }, [dailyAgg]);
  const numericAuto = useMemo(() => {
    const out = {};
    DAILY_NUMERIC_KEYS.forEach((k) => { out[k] = (dailyAgg[k] || 0) > 0; });
    return out;
  }, [dailyAgg]);
  const autoMobileKeys = useMemo(() => new Set([
    ...(config.categoryMap || []).map((m) => m.mobilePointKey).filter(Boolean),
    ...(config.gibyeonColumnMap || DEFAULT_GIBYEON_COLUMN_MAP).filter(Boolean),
  ]), [config.categoryMap, config.gibyeonColumnMap]);
  const autoKpiKeys = useMemo(() => new Set([
    ...(config.categoryMap || []).map((m) => m.kpiKey).filter(Boolean),
    ...HOME_KPI_MAP.filter((m) => m.sources.some((p) => {
      const [gk, k] = p.split('.');
      return ((dailyAgg.groups[gk] || {})[k] || 0) > 0;
    })).map((m) => m.kpiKey),
  ]), [config.categoryMap, dailyAgg]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-5 pb-24">
      {tab === 'home' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white p-5">
            <div className="text-xs text-violet-100 mb-1">{monthLabel(month)} 예상 총 인센티브</div>
            <div className="text-3xl font-bold">{won(pay.total)}</div>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <StatusBadge status={status} />
              {prevMonthTotal !== null && (
                <GrowthBadge current={pay.total} prev={prevMonthTotal} />
              )}
            </div>
          </div>
          {showPersonalGoal && (
            <MonthlyGoalCard
              month={month}
              mergedDraft={mergedDraft}
              pay={pay}
              goals={personalGoals}
              onSave={savePersonalGoals}
              saving={goalSaving}
            />
          )}
          <NextGoalCard
            pay={pay}
            draft={mergedDraft}
            config={config}
            onGoInput={() => setTab('daily')}
          />
          <WorkActivityCard dailyDays={dailyDays} month={month} onGoInput={() => setTab('daily')} />
          <MyRankingCard rows={competitionRows} userId={authUser?.id} branch={displayStoreName(currentEmp?.branch)} />
          <RisingRankingCard
            rows={competitionRows}
            dailyRecords={allDailyRecords}
            month={month}
            config={config}
            userId={authUser?.id}
          />
          <GamificationHub
            dailyDays={dailyDays}
            month={month}
            personalGoals={personalGoals}
            mergedDraft={mergedDraft}
            pay={pay}
            competitionRows={competitionRows}
            allDailyRecords={allDailyRecords}
            config={config}
            userId={authUser?.id}
          />
          <HomeGateCard pay={pay} config={config} onGoInput={() => setTab('daily')} />
          <ProfileEditRequestForm authUser={authUser} profile={authProfile} />

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-gray-100 p-3">
              <div className="text-xs text-gray-400">근속 개월 / 등급</div>
              <div className="text-sm font-bold text-gray-800">{pay.months}개월 · {pay.gradeEligible ? pay.grade : 'D(미달)'}등급</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-3">
              <div className="text-xs text-gray-400">성과 포인트</div>
              <div className="text-sm font-bold text-gray-800">{pay.totalPoints.toFixed(1)}P</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-3">
              <div className="text-xs text-gray-400">KPI 생산성</div>
              <div className="text-sm font-bold text-gray-800">{pay.kpiScore.toFixed(1)}P</div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
            <RowKV label="영업 활동 지원금" value={won(pay.guaranteedComponent)} />
            <RowKV label="└ 영업 활동 지원 정책 (근속기간별 건당)" value={won(pay.tenurePay)} />
            <RowKV label="└ 직책수당" value={won(pay.positionAllowance)} />
            <RowKV label="홈 상품 수수료" value={won(pay.homeGradePay + (pay.homeFlatPay - pay.tvFreePay - pay.smartHomePay) + pay.homeAddonPay + pay.renewPay)} />
            <RowKV label="TV프리(부)" value={won(pay.tvFreePay)} />
            <RowKV label="스마트홈" value={won(pay.smartHomePay)} />
            <RowKV label="요금제 유치 수수료" value={won(pay.matrixTotal)} />
            <RowKV label="2ND 번들 수수료" value={won(pay.bundle2ndTotal)} />
            <RowKV label="VAS 유치 수수료" value={won(pay.vasPay)} />
            <RowKV label="소노 유치 수수료" value={won(pay.sonoPay)} />
            <RowKV label="중고MNP 결합" value={won(pay.mnpBundlePay)} />
            <RowKV label="우리매장 고객등록 수수료" value={won(pay.custRegBonus)} />
            <RowKV label="맞춤제안 수수료" value={won(pay.tailoredBonus + pay.tailoredAmountBonus)} />
          </div>
          <div className="text-[11px] text-gray-400 bg-gray-50 rounded-lg p-3 flex gap-2">
            <Info size={13} className="shrink-0 mt-0.5" />
            영업 활동 지원 정책(근속기간별 건당 지급액)은 성과등급 보너스·요금제 유치 수수료·2ND번들과 합산해 영업 활동 지원금(직급 보장액)과 비교되고, 둘 중 큰 금액이 지급돼요. 그래서 근속수당 자체는 표시되지만 총액에 별도로 더해지지는 않아요. 홈 최소조건(3점)은 인터넷1점·프리0.3점·스홈0.2점 기준으로, 성과등급 가점(홈단독1P·홈+TV2P 등)은 별도 배점으로 계산돼요. 모델 특판 실적은 고객 할인 재원이라 인센티브 총액에 포함하지 않았어요.
          </div>
        </div>
      )}

      {tab === 'daily' && (
        <>
          {monthLocked && (
            <div className="mb-3 bg-red-50 border border-red-100 text-red-600 text-xs rounded-lg p-3 flex items-center gap-2">
              <Info size={13} className="shrink-0" /> {monthLabel(month)}은 마감되어 더 이상 수정할 수 없어요. 수정이 필요하면 관리자에게 문의해주세요.
            </div>
          )}
          <DailyInputTab month={month} dailyDays={dailyDays} saveDailyDay={saveDailyDay} config={config} draft={draft} setDraft={setDraft} locked={monthLocked} currentEmp={currentEmp} />
        </>
      )}

      {tab === 'homeOrders' && (
        <div className="space-y-3">
          {monthLocked && (
            <div className="bg-red-50 border border-red-100 text-red-600 text-xs rounded-lg p-3 flex items-center gap-2">
              <Info size={13} className="shrink-0" />
              {monthLabel(month)}은 마감되어 홈 청약 상태를 수정할 수 없어요.
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs text-gray-400">접수부터 설치·개통까지</div>
              <div className="text-lg font-bold text-gray-900">홈 진행관리</div>
            </div>

            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="text-sm font-medium bg-white border border-gray-200 rounded-lg px-3 py-2"
            >
              {months.map((m) => (
                <option key={m} value={m}>{monthLabel(m)}</option>
              ))}
            </select>
          </div>

          <HomeOrderManager
            userId={authUser?.id}
            month={month}
            locked={monthLocked}
            dailyDays={dailyDays}
            saveDailyDay={saveDailyDay}
          />
        </div>
      )}

      {tab === 'criteria' && canSeeCriteria && (
        <div className="space-y-3">
          <div className="text-sm font-semibold text-gray-700">지급 기준 안내</div>
          <Section title="영업 활동 지원금" defaultOpen>
            {POSITIONS.map((p) => <RowKV key={p} label={p} value={won(config.basePay[p])} />)}
          </Section>
          <Section title="직급별 직책수당">
            {POSITIONS.map((p) => <RowKV key={p} label={p} value={won(config.positionAllowance?.[p] || 0)} />)}
          </Section>
          <Section title="근속기간별 건당 지급액 (한도 최대 2,300,000원)">
            {config.tenure.map((t) => <RowKV key={t.key} label={t.label} value={t.rate ? `건당 ${won(t.rate)}` : '실적 무관'} />)}
          </Section>
          <Section title="월 성과등급 (홈 최소 3점 이상)">
            {config.grades.map((g) => <RowKV key={g.grade} label={`${g.grade}등급 (${g.min}P↑)`} value={won(g.bonus)} />)}
          </Section>
          <Section title="홈 그레이드 (누적 건수별 건당 단가)">
            {config.homeTiers.map((t, i) => <RowKV key={i} label={`${t.min}건 이상`} value={`건당 ${won(t.rate)}`} />)}
          </Section>
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-3">
          <select value={month} onChange={(e) => setMonth(e.target.value)} className="text-sm font-medium bg-white border border-gray-200 rounded-lg px-3 py-2">
            {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
          <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
            <RowKV label="영업 활동 지원금" value={won(pay.guaranteedComponent)} />
            <RowKV label="└ 영업 활동 지원 정책 (근속기간별 건당)" value={won(pay.tenurePay)} />
            <RowKV label="└ 직책수당" value={won(pay.positionAllowance)} />
            <RowKV label="홈 그레이드 수수료" value={won(pay.homeGradePay)} />
            <RowKV label="홈 단독" value={won(pay.homeFlatPay - pay.tvFreePay - pay.smartHomePay)} />
            <RowKV label="TV프리(부)" value={won(pay.tvFreePay)} />
            <RowKV label="스마트홈" value={won(pay.smartHomePay)} />
            <RowKV label="동시판매 수수료" value={won(pay.homeAddonPay)} />
            <RowKV label="홈 재약정" value={won(pay.renewPay)} />
            <RowKV label="요금제 유치 수수료" value={won(pay.matrixTotal)} />
            <RowKV label="2ND 번들 유치 수수료" value={won(pay.bundle2ndTotal)} />
            <RowKV label="VAS 유치 수수료" value={won(pay.vasPay)} />
            <RowKV label="소노 유치 수수료" value={won(pay.sonoPay)} />
            <RowKV label="중고MNP 결합" value={won(pay.mnpBundlePay)} />
            <RowKV label="우리매장 고객등록 수수료" value={won(pay.custRegBonus)} />
            <RowKV label="맞춤제안 업셀 건수 수수료" value={won(pay.tailoredBonus)} />
            <RowKV label="맞춤제안 업셀금액 (100%)" value={won(pay.tailoredAmountBonus)} />
            <RowKV label="KPI 생산성 점수" value={`${pay.kpiScore.toFixed(1)}P`} />
            <RowKV label="총 인센티브" value={won(pay.total)} bold />
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-20">
        <div className={`max-w-5xl mx-auto grid ${canSeeCriteria ? 'grid-cols-5' : 'grid-cols-4'}`}>
          {[
            { key: 'home', label: '홈', icon: Home },
            { key: 'daily', label: '일일입력', icon: Calendar },
            { key: 'homeOrders', label: '홈진행', icon: ClipboardList },
            ...(canSeeCriteria ? [{ key: 'criteria', label: '지급기준', icon: Wallet }] : []),
            { key: 'history', label: '내역', icon: History },
          ].map((n) => (
            <button key={n.key} onClick={() => setTab(n.key)} className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] ${tab === n.key ? 'text-violet-700' : 'text-gray-400'}`}>
              <n.icon size={18} />{n.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function DailyInputTab({ month, dailyDays, saveDailyDay, config, draft, setDraft, locked, currentEmp }) {
  const n = daysInMonth(month);
  const todayKey = (() => {
    const now = new Date();
    return monthKeyOf(now) === month ? String(now.getDate()).padStart(2, '0') : '01';
  })();
  const [selectedDay, setSelectedDay] = useState(todayKey);
  const [day, setDay] = useState(() => normalizeDay(dailyDays[todayKey]));
  const [pickedRow, setPickedRow] = useState(null); // 선택한 가입구분 index
  const [toast, setToast] = useState(null);         // 등록 피드백 카드
  const [saveState, setSaveState] = useState('idle'); // idle | pending | saved
  const [homeOrderDraft, setHomeOrderDraft] = useState(null); // { groupKey, itemKey, label, productType }
  const [homeCustomerName, setHomeCustomerName] = useState('');
  const [homeDirectComplete, setHomeDirectComplete] = useState(false);
  const [homePlannedDate, setHomePlannedDate] = useState('');
  const [homeOrderSaving, setHomeOrderSaving] = useState(false);

  const dayMatrix = day.matrix;
  const isDayOff = !!day.dayOff;

  const setDayOff = (nextOff) => {
    if (locked) return;
    if (nextOff && dayHasData(day)) {
      const ok = window.confirm('이 날짜에는 이미 실적이 입력되어 있어요. 휴무로 표시해도 실적 데이터는 그대로 남습니다. 계속할까요?');
      if (!ok) return;
    }
    const next = { ...normalizeDay(day), dayOff: nextOff };
    setDay(next);
    pendingRef.current = { day: selectedDay, record: next };
    setSaveState('pending');
  };

  // 저장되지 않은 변경을 담아두는 칸 — 날짜를 바꾸거나 화면을 떠날 때 이걸 먼저 비움
  const pendingRef = useRef(null);
  const flushRef = useRef(() => {});

  const flush = useCallback(() => {
    const p = pendingRef.current;
    if (!p) return;
    pendingRef.current = null;
    saveDailyDay(p.day, p.record);
    setSaveState('saved');
  }, [saveDailyDay]);
  flushRef.current = flush;

  useEffect(() => {
    setDay(normalizeDay(dailyDays[selectedDay]));
    setSaveState('idle');
  }, [selectedDay, month]); // eslint-disable-line

  // 마지막 입력 후 0.8초 조용하면 자동 저장
  useEffect(() => {
    if (!pendingRef.current) return;
    const t = setTimeout(flush, 800);
    return () => clearTimeout(t);
  }, [day, flush]);

  // 탭을 떠나거나 창을 닫을 때 남은 변경 저장
  useEffect(() => {
    const onLeave = () => flushRef.current();
    window.addEventListener('beforeunload', onLeave);
    return () => { window.removeEventListener('beforeunload', onLeave); flushRef.current(); };
  }, []);

  const mutate = (next) => {
    if (locked) return;
    setDay(next);
    pendingRef.current = { day: selectedDay, record: next };
    setSaveState('pending');
  };
  const setCell = (ri, ci, v) => {
    const nextMatrix = day.matrix.map((row) => [...row]);
    nextMatrix[ri][ci] = Math.max(0, v);
    mutate({ ...day, matrix: nextMatrix });
  };
  const bump = (ri, ci, delta) => setCell(ri, ci, (day.matrix[ri][ci] || 0) + delta);
  const setGroupItem = (gk, key, v) => mutate({ ...day, groups: { ...day.groups, [gk]: { ...day.groups[gk], [key]: Math.max(0, v) } } });
  const setNumeric = (key, v) => mutate({ ...day, [key]: Math.max(0, v) });

  const openHomeOrder = (groupKey, itemKey) => {
    if (locked) return;
    const meta = homeOrderMeta(groupKey, itemKey);
    if (!meta) return;
    setHomeOrderDraft({ groupKey, itemKey, ...meta });
    setHomeCustomerName('');
    setHomeDirectComplete(false);
  };

  const submitHomeOrder = async () => {
    if (!homeOrderDraft || !currentEmp?.id || locked) return;
    const customer = homeCustomerName.trim();
    if (!customer) {
      alert('고객명을 입력해야 등록할 수 있어요.');
      return;
    }

    setHomeOrderSaving(true);
    const sourceWorkDate = `${month}-${selectedDay}`;
    const appliedAt = new Date(`${sourceWorkDate}T12:00:00`).toISOString();
    const now = new Date().toISOString();

    const { error } = await supabase.from('home_orders').insert({
      user_id: currentEmp.id,
      customer_name: customer,
      product_type: homeOrderDraft.productType,
      status: homeDirectComplete ? 'completed' : 'pending',
      applied_at: appliedAt,
      completed_at: homeDirectComplete ? now : null,
      source_work_date: sourceWorkDate,
      source_group: homeOrderDraft.groupKey,
      source_key: homeOrderDraft.itemKey,
      planned_install_date: homePlannedDate || null,
      actual_install_date: homeDirectComplete ? sourceWorkDate : null,
    });

    if (error) {
      setHomeOrderSaving(false);
      alert(`홈 상품 등록 실패: ${friendlyError(error)}`);
      return;
    }

    // 바로 완료로 등록한 경우에만 확정 실적 +1
    if (homeDirectComplete) {
      const currentValue = Number(day.groups?.[homeOrderDraft.groupKey]?.[homeOrderDraft.itemKey] || 0);
      const nextDay = {
        ...normalizeDay(day),
        groups: {
          ...day.groups,
          [homeOrderDraft.groupKey]: {
            ...(day.groups?.[homeOrderDraft.groupKey] || {}),
            [homeOrderDraft.itemKey]: currentValue + 1,
          },
        },
      };
      mutate(nextDay);
    }

    notifyStoreManagers({
      actorId: currentEmp.id,
      type: homeDirectComplete ? 'home_completed' : 'home_order',
      title: homeDirectComplete ? '홈 설치/개통 완료' : '새 홈 청약 등록',
      message: `${customer} · ${homeOrderDraft.label}`,
      payload: {
        employee_id: currentEmp.id,
        customer_name: customer,
        product_type: homeOrderDraft.productType,
        status: homeDirectComplete ? 'completed' : 'pending',
        source_work_date: sourceWorkDate,
      },
    });

    setHomeOrderSaving(false);
    setHomeOrderDraft(null);
    setHomeCustomerName('');
    setHomeDirectComplete(false);
    setHomePlannedDate('');

    const toastId = `home-${Date.now()}`;
    setToast({
      id: toastId,
      label: `${customer} · ${homeOrderDraft.label}`,
      kind: homeDirectComplete ? 'achievement' : 'normal',
      title: homeDirectComplete ? '완료 실적으로 등록했어요 ✅' : '홈 진행관리에 등록했어요 🏠',
      sub: homeDirectComplete ? '확정 실적에도 바로 반영됐어요' : '설치/개통 완료 후 확정 실적으로 반영돼요',
      payDelta: 0,
      currentTotal: computePay(
        applyDailyToDraft(
          draft,
          { ...dailyDays, [selectedDay]: day },
          month,
          config.categoryMap,
          config.gibyeonColumnMap
        ),
        currentEmp?.position || '사원',
        currentEmp?.hireDate,
        month,
        config
      ).total,
    });
    setTimeout(() => setToast((t) => (t?.id === toastId ? null : t)), 3600);
  };

  const selectDay = (key) => { flush(); setSelectedDay(key); };

  const FEEDBACK_MESSAGES = [
    { title: '오늘도 실적 한 스푼!', sub: '고생했어요 😊' },
    { title: '좋아요! 오늘도 하나 쌓였어요', sub: '차곡차곡 가고 있어요 🙌' },
    { title: '차곡차곡 쌓이는 중이에요', sub: '오늘도 한 걸음 전진 ✨' },
    { title: '오늘의 실적 +1!', sub: '수고했어요 👍' },
    { title: '좋은 흐름이에요', sub: '하나 더 쌓였습니다 🔥' },
  ];

  const addOne = (ri, ci) => {
    if (locked) return;

    const beforeDay = normalizeDay(day);
    const nextMatrix = beforeDay.matrix.map((row) => [...row]);
    nextMatrix[ri][ci] = (nextMatrix[ri][ci] || 0) + 1;
    const nextDay = { ...beforeDay, matrix: nextMatrix };

    // 현재 달 전체 실적을 등록 직전/직후로 각각 계산
    const beforeDays = { ...dailyDays, [selectedDay]: beforeDay };
    const afterDays = { ...dailyDays, [selectedDay]: nextDay };

    const beforeDraft = applyDailyToDraft(
      draft,
      beforeDays,
      month,
      config.categoryMap,
      config.gibyeonColumnMap
    );
    const afterDraft = applyDailyToDraft(
      draft,
      afterDays,
      month,
      config.categoryMap,
      config.gibyeonColumnMap
    );

    const position = currentEmp?.position || '사원';
    const hireDate = currentEmp?.hireDate;

    const beforePay = computePay(beforeDraft, position, hireDate, month, config);
    const afterPay = computePay(afterDraft, position, hireDate, month, config);
    const payDelta = Math.max(0, afterPay.total - beforePay.total);

    const rowDef = MATRIX_ROW_DEFS[ri];
    const label = rowDef.hasTiers
      ? `${rowDef.dailyLabel || rowDef.label} · ${MATRIX_COLS[ci]}`
      : (rowDef.dailyLabel || rowDef.label);

    // 이번 한 건으로 실제 목표를 넘었는지 확인
    const gradeUp = beforePay.grade !== afterPay.grade && afterPay.gradeEligible;
    const homeGateAchieved = !beforePay.gradeEligible && afterPay.gradeEligible;

    let feedback;
    if (gradeUp) {
      feedback = {
        kind: 'achievement',
        title: '목표 달성! 🎉',
        sub: `${afterPay.grade}등급에 도달했어요`,
      };
    } else if (homeGateAchieved) {
      feedback = {
        kind: 'achievement',
        title: '목표 달성! 🎉',
        sub: '홈 최소조건을 달성했어요',
      };
    } else {
      const msg = FEEDBACK_MESSAGES[Math.floor(Math.random() * FEEDBACK_MESSAGES.length)];
      feedback = { kind: 'normal', ...msg };
    }

    // 실제 입력 반영
    mutate(nextDay);

    notifyStoreManagers({
      actorId: currentEmp?.id,
      type: 'daily_input',
      title: `${currentEmp?.name || '직원'}님이 실적을 등록했어요`,
      message: `${label} 1건`,
      payload: {
        employee_id: currentEmp?.id,
        employee_name: currentEmp?.name,
        store_name: currentEmp?.branch,
        month,
        day: selectedDay,
        label,
      },
    });

    const toastId = `${Date.now()}-${ri}-${ci}`;
    setToast({
      id: toastId,
      label,
      ri,
      ci,
      ...feedback,
      payDelta,
      currentTotal: afterPay.total,
    });

    setTimeout(() => {
      setToast((t) => (t && t.id === toastId ? null : t));
    }, 4200);
  };
  const undoToast = () => {
    if (!toast) return;
    bump(toast.ri, toast.ci, -1);
    setToast(null);
  };

  const groupSum = (rec) => DAILY_GROUP_KEYS.reduce((s, gk) => s + Object.values(rec.groups[gk] || {}).reduce((gs, v) => gs + (v || 0), 0), 0)
    + (rec.custRegCount || 0) + (rec.tailoredCount || 0);
  const matrixSum = (rec) => rec.matrix.reduce((s, row) => s + row.reduce((rs, v) => rs + v, 0), 0);
  const dayTotal = matrixSum(day) + groupSum(day);
  const monthTotal = Object.values(dailyDays).reduce((s, raw) => { const r = normalizeDay(raw); return s + matrixSum(r) + groupSum(r); }, 0);

  // 오늘 등록된 건들을 목록으로 펼치기
  const entries = [];
  dayMatrix.forEach((row, ri) => row.forEach((v, ci) => {
    if (v > 0) entries.push({ ri, ci, count: v, rowDef: MATRIX_ROW_DEFS[ri] });
  }));

  return (
    <div className="space-y-3 relative">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-gray-700">{monthLabel(month)} 일일입력</div>
        <div className="flex items-center gap-2">
          <DailySaveBadge state={saveState} />
          <span className="text-xs text-gray-400">누적 {monthTotal}건</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-3">
        <label className="flex items-center justify-between gap-3 pb-3 mb-3 border-b border-gray-100 cursor-pointer">
          <div>
            <div className="text-sm font-semibold text-gray-700">활동 시간 충족</div>
            <div className="text-[11px] text-gray-400 mt-0.5">미충족 시 영업 활동 지원금 {won(config.basePenalty)} 차감</div>
          </div>
          <div className={`shrink-0 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold ${draft.activityTimeMet ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
            <input
              type="checkbox"
              checked={draft.activityTimeMet}
              onChange={(e) => setDraft({ ...draft, activityTimeMet: e.target.checked })}
              className="w-4 h-4"
            />
            {draft.activityTimeMet ? '충족' : '미충족'}
          </div>
        </label>

        <div className="grid grid-cols-7 gap-1.5 mb-1.5">
          {['일', '월', '화', '수', '목', '금', '토'].map((w, i) => (
            <div key={w} className={`text-center text-[11px] font-semibold py-1 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1).getDay() }).map((_, i) => (
            <div key={`blank-${i}`} className="aspect-square" />
          ))}
          {Array.from({ length: n }, (_, i) => i + 1).map((d) => {
            const key = String(d).padStart(2, '0');
            const rec = key === selectedDay ? day : normalizeDay(dailyDays[key]);
            const has = dayHasData(rec);
            const off = !!rec.dayOff;
            const isSel = key === selectedDay;
            const dow = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, d).getDay();
            return (
              <button key={d} onClick={() => selectDay(key)}
                className={`relative aspect-square rounded-lg text-xs font-medium flex flex-col items-center justify-center
                  ${isSel ? (off ? 'bg-emerald-600 text-white' : 'bg-violet-600 text-white') : off ? 'bg-emerald-50 text-emerald-700' : has ? 'bg-violet-50 text-violet-700' : dow === 0 ? 'bg-red-50/50 text-red-400' : dow === 6 ? 'bg-blue-50/50 text-blue-400' : 'bg-gray-50 text-gray-500'}`}>
                <span>{d}</span>
                {off && <span className={`text-[8px] leading-none mt-0.5 ${isSel ? 'text-white/80' : 'text-emerald-600'}`}>휴무</span>}
                {has && !off && !isSel && <span className="absolute bottom-1 w-1 h-1 rounded-full bg-violet-500" />}
              </button>
            );
          })}
        </div>

        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-gray-700">이 날짜는 휴무인가요?</div>
            <div className="text-[11px] text-gray-400">휴무일은 근무일 연속 기록에서 자연스럽게 건너뛰어요.</div>
          </div>
          <button
            onClick={() => setDayOff(!isDayOff)}
            disabled={locked}
            className={`shrink-0 px-3 py-2 rounded-lg text-xs font-semibold border ${
              isDayOff
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white text-gray-500 border-gray-200'
            } disabled:opacity-50`}
          >
            {isDayOff ? '휴무 ✓' : '휴무'}
          </button>
        </div>
      </div>

      {isDayOff ? (
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-5 text-center">
          <div className="text-2xl mb-2">🌿</div>
          <div className="text-sm font-bold text-emerald-800">오늘은 휴무로 설정했어요</div>
          <div className="text-xs text-emerald-700/70 mt-1">푹 쉬고 다음 근무일부터 이어가요 :)</div>
        </div>
      ) : (
      <>

      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-gray-800">{parseInt(selectedDay, 10)}일 · {dayTotal}건</div>
        <div className="px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 bg-violet-50 text-violet-700">
          <Zap size={12} />빠른 등록
        </div>
      </div>

      <>
          <div className="bg-white rounded-xl border border-gray-100 p-3">
            <div className="text-[11px] text-gray-400 mb-2">1. 가입구분</div>
            <div className="grid grid-cols-2 gap-1.5">
              {MATRIX_ROW_DEFS.map((rowDef, ri) => {
                const rowSum = dayMatrix[ri].reduce((s, v) => s + v, 0);
                const on = pickedRow === ri;
                return (
                  <button key={rowDef.label} onClick={() => setPickedRow(on ? null : ri)}
                    className={`px-3 py-2.5 rounded-lg text-sm font-medium text-left flex items-center justify-between gap-1
                      ${on ? 'bg-violet-600 text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}>
                    <span className="truncate">{rowDef.dailyLabel || rowDef.label}</span>
                    {rowSum > 0 && (
                      <span className={`shrink-0 text-[11px] px-1.5 rounded-full tabular-nums ${on ? 'bg-white/25' : 'bg-violet-100 text-violet-700'}`}>{rowSum}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {pickedRow !== null && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="text-[11px] text-gray-400 mb-2">
                  {MATRIX_ROW_DEFS[pickedRow].hasTiers ? '2. 요금제군을 누르면 1건 등록돼요' : '2. 눌러서 1건 등록'}
                </div>
                {MATRIX_ROW_DEFS[pickedRow].hasTiers ? (
                  <div className="grid grid-cols-3 gap-1.5">
                    {MATRIX_COLS.map((c, ci) => {
                      const cnt = dayMatrix[pickedRow][ci] || 0;
                      return (
                        <button key={c} onClick={() => addOne(pickedRow, ci)}
                          className="px-2 py-3 rounded-lg bg-violet-50 hover:bg-violet-100 active:bg-violet-200 text-violet-800 text-xs font-medium leading-tight relative">
                          {c}
                          {cnt > 0 && <span className="absolute top-1 right-1 text-[10px] bg-violet-600 text-white rounded-full w-4 h-4 flex items-center justify-center tabular-nums">{cnt}</span>}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <button onClick={() => addOne(pickedRow, 0)}
                    className="w-full py-3 rounded-lg bg-violet-50 hover:bg-violet-100 active:bg-violet-200 text-violet-800 text-sm font-semibold flex items-center justify-center gap-1.5">
                    <Plus size={15} />1건 등록 <span className="text-violet-400 font-normal">(현재 {dayMatrix[pickedRow][0] || 0}건)</span>
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-2.5 text-xs font-semibold text-gray-500 border-b border-gray-50">{parseInt(selectedDay, 10)}일 등록 내역</div>
            {entries.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">아직 등록된 건이 없어요.<br />위에서 가입구분을 골라 등록해 주세요.</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {entries.map((e) => (
                  <div key={`${e.ri}-${e.ci}`} className="flex items-center justify-between px-4 py-2.5">
                    <div className="min-w-0 pr-2">
                      <div className="text-sm text-gray-800 truncate">{e.rowDef.dailyLabel || e.rowDef.label}</div>
                      {e.rowDef.hasTiers && <div className="text-[11px] text-gray-400">{MATRIX_COLS[e.ci]}</div>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Stepper value={e.count} onChange={(v) => setCell(e.ri, e.ci, v)} />
                      <button onClick={() => setCell(e.ri, e.ci, 0)} className="text-gray-300 hover:text-red-500 p-1"><X size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
      </>

      <div className="pt-1 space-y-2">
        <div className="text-[11px] text-gray-400 px-1">홈·부가 실적도 이 날짜에 기록하면 수수료·성과포인트·KPI가 한 번에 반영돼요.</div>

        {DAILY_GROUP_DEFS.filter((g) => g.bucket === 'home').map((g) => {
          const table = groupTable(config, g.key);
          const sum = table.reduce((s, t) => s + (day.groups[g.key]?.[t.key] || 0), 0);
          return (
            <Section key={g.key} title={g.label} sub={sum > 0 ? `${sum}건` : '없음'}>
              {table.map((t) => {
                const homeMeta = homeOrderMeta(g.key, t.key);
                const confirmed = day.groups[g.key]?.[t.key] || 0;

                if (homeMeta) {
                  return (
                    <div key={t.key} className="flex items-center justify-between px-4 py-2.5 gap-3">
                      <div className="min-w-0">
                        <div className="text-sm text-gray-700">{t.label}</div>
                        <div className="text-[11px] text-gray-400">
                          확정 {confirmed}건 · 고객명 입력 후 진행관리로 등록
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => openHomeOrder(g.key, t.key)}
                        disabled={locked}
                        className="shrink-0 px-3 py-2 rounded-lg bg-violet-50 text-violet-700 text-xs font-bold disabled:opacity-50"
                      >
                        + 등록
                      </button>
                    </div>
                  );
                }

                return (
                  <CountRow key={t.key} label={t.label}
                    sub={t.rate ? `건당 ${won(t.rate)}` : (t.point ? `${t.point}P` : '')}
                    value={confirmed}
                    onChange={(v) => setGroupItem(g.key, t.key, v)} />
                );
              })}
            </Section>
          );
        })}

        {DAILY_GROUP_DEFS.filter((g) => g.bucket === 'extra').map((g) => {
          const table = groupTable(config, g.key);
          const sum = table.reduce((s, t) => s + (day.groups[g.key]?.[t.key] || 0), 0);
          return (
            <Section key={g.key} title={g.label} sub={sum > 0 ? `${sum}건` : '없음'}>
              {table.map((t) => (
                <CountRow key={t.key} label={t.label}
                  sub={t.rate ? `건당 ${won(t.rate)}` : ''}
                  value={day.groups[g.key]?.[t.key] || 0}
                  onChange={(v) => setGroupItem(g.key, t.key, v)} />
              ))}
            </Section>
          );
        })}

        <Section title="고객등록 · 맞춤제안" sub={(day.custRegCount || day.tailoredCount || day.tailoredAmount) ? '입력됨' : '없음'}>
          <CountRow label="타매고 등록 건수" sub="월 20/30/40건 구간 보너스"
            value={day.custRegCount || 0} onChange={(v) => setNumeric('custRegCount', v)} />
          <CountRow label="맞춤제안 업셀 건수" sub="월 10/15/20/25/30건 구간 보너스"
            value={day.tailoredCount || 0} onChange={(v) => setNumeric('tailoredCount', v)} />
          <div className="flex items-center justify-between px-4 py-2.5">
            <div>
              <div className="text-sm text-gray-700">맞춤제안 업셀 금액</div>
              <div className="text-[11px] text-gray-400">이 날짜에 발생한 금액 · 100% 지급</div>
            </div>
            <div className="flex items-center gap-1">
              <input type="number" min="0" value={day.tailoredAmount || 0}
                onChange={(e) => setNumeric('tailoredAmount', parseInt(e.target.value || '0', 10))}
                className="w-28 text-right border border-gray-200 rounded-lg px-2 py-1.5 text-sm" />
              <span className="text-xs text-gray-400">원</span>
            </div>
          </div>
        </Section>
      </div>

      <div className="text-[11px] text-gray-400 text-center pb-2">입력하면 자동으로 저장돼요. 날짜를 옮겨도 안전해요.</div>
      </>
      )}

      {homeOrderDraft && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl">
            <div className="text-xs text-violet-500 font-semibold">홈 상품 등록</div>
            <div className="text-lg font-bold text-gray-900 mt-1">{homeOrderDraft.label}</div>
            <div className="text-xs text-gray-400 mt-1">{month}-{selectedDay} 접수</div>

            <label className="block text-xs font-semibold text-gray-500 mt-4 mb-1.5">
              고객명 <span className="text-red-500">*</span>
            </label>
            <input
              autoFocus
              value={homeCustomerName}
              onChange={(e) => setHomeCustomerName(e.target.value)}
              placeholder="고객명을 입력해주세요"
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-violet-200"
            />

            <label className="block text-xs font-semibold text-gray-500 mt-4 mb-1.5">
              설치 예정일 <span className="text-gray-400 font-normal">(미정 가능)</span>
            </label>
            <input type="date" value={homePlannedDate} onChange={(e)=>setHomePlannedDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm" />

            <label className="mt-4 flex items-center gap-2 rounded-xl bg-gray-50 p-3 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={homeDirectComplete}
                onChange={(e) => setHomeDirectComplete(e.target.checked)}
                className="w-4 h-4"
              />
              지금 바로 설치/개통 완료된 건
            </label>

            <div className="text-[11px] text-gray-400 mt-2">
              체크하지 않으면 진행중으로 등록되고, 홈 진행관리에서 완료 처리할 수 있어요.
            </div>

            <div className="grid grid-cols-2 gap-2 mt-5">
              <button
                type="button"
                onClick={() => {
                  setHomeOrderDraft(null);
                  setHomeCustomerName('');
                  setHomeDirectComplete(false);
                }}
                disabled={homeOrderSaving}
                className="py-2.5 rounded-xl bg-gray-100 text-gray-500 text-sm font-semibold"
              >
                취소
              </button>
              <button
                type="button"
                onClick={submitHomeOrder}
                disabled={homeOrderSaving || !homeCustomerName.trim()}
                className="py-2.5 rounded-xl bg-violet-600 text-white text-sm font-bold disabled:opacity-50"
              >
                {homeOrderSaving ? '등록 중...' : '등록'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-30 w-[calc(100%-24px)] max-w-sm">
          <div className={`rounded-2xl shadow-xl border p-4 ${
            toast.kind === 'achievement'
              ? 'bg-violet-700 border-violet-600 text-white'
              : 'bg-gray-900 border-gray-800 text-white'
          }`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[11px] opacity-60 mb-1">등록 완료 · {toast.label}</div>
                <div className="text-base font-bold">{toast.title}</div>
                <div className="text-xs opacity-75 mt-0.5">{toast.sub}</div>

                <div className="mt-3 flex items-end justify-between gap-3">
                  <div>
                    {toast.payDelta > 0 && (
                      <div className="text-sm font-bold text-emerald-300">
                        예상 인센티브 +{won(toast.payDelta)}
                      </div>
                    )}
                    <div className="text-[11px] opacity-60 mt-0.5">
                      현재 예상 {won(toast.currentTotal)}
                    </div>
                  </div>

                  <button
                    onClick={undoToast}
                    className="shrink-0 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium"
                  >
                    되돌리기
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DailySaveBadge({ state }) {
  if (state === 'pending') return <span className="flex items-center gap-1 text-[11px] text-amber-600"><UploadCloud size={11} />저장 대기 중</span>;
  if (state === 'saved') return <span className="flex items-center gap-1 text-[11px] text-emerald-600"><Check size={11} />저장됨</span>;
  return null;
}


function ColHeader({ label }) {
  if (label.includes('·')) {
    const [a, b] = label.split('·');
    return (
      <span className="block leading-tight whitespace-nowrap">
        {a}
        <br />
        <span className="text-[9px] text-gray-300 font-normal">{b}</span>
      </span>
    );
  }
  return <span className="whitespace-nowrap">{label}</span>;
}

/* ===================== 등급 진행바 · 홈 최소조건 알림 ===================== */


function guaranteedDeltaForGradeBonus(pay, nextBonus) {
  const withoutCurrentGrade = (pay.otherComponents || 0) - (pay.gradeBonus || 0);
  const nextGuaranteed = Math.max(pay.positionBase || 0, withoutCurrentGrade + (nextBonus || 0));
  return Math.max(0, nextGuaranteed - (pay.guaranteedComponent || 0));
}

function nextTierAbove(count, tiers) {
  return [...(tiers || [])]
    .sort((a, b) => a.min - b.min)
    .find((t) => Number(t.min) > Number(count || 0)) || null;
}

function buildNextGoal(pay, draft, config) {
  if (!pay || !draft || !config) return null;

  const candidates = [];

  // 1) 성과등급: 다음 등급 보너스가 실제 총 인센티브를 올릴 때만 후보
  if (pay.nextGrade) {
    const remain = Math.max(0, pay.nextGrade.min - pay.totalPoints);
    const delta = guaranteedDeltaForGradeBonus(pay, pay.nextGrade.bonus);

    if (remain > 0 && delta > 0) {
      candidates.push({
        key: 'grade',
        effort: remain,
        title: `${pay.nextGrade.grade}등급`,
        description: `${pay.nextGrade.grade}등급까지 ${remain.toFixed(1)}P 남았어요`,
        delta,
      });
    }
  }

  // 2) 홈 최소조건: 현재 성과포인트 기준 보너스가 잠겨 있고,
  // 홈 조건 충족 시 실제 총액이 증가하는 경우
  if (!pay.gradeEligible) {
    const short = Math.max(0, HOME_GATE_MIN - pay.homeGatePoints);
    const grades = [...(config.grades || DEFAULT_GRADES)].sort((a, b) => b.min - a.min);
    const potentialGrade = grades.find((g) => pay.totalPoints >= g.min) || null;
    const potentialBonus = potentialGrade?.bonus || 0;
    const delta = potentialBonus > 0
      ? guaranteedDeltaForGradeBonus(pay, potentialBonus)
      : 0;

    if (short > 0 && delta > 0) {
      candidates.push({
        key: 'homeGate',
        effort: short,
        title: '홈 최소조건',
        description: `홈 최소조건까지 ${short.toFixed(1)}점 남았어요`,
        delta,
      });
    }
  }

  // 3) 고객등록: 다음 구간 보너스 차액은 총액에 직접 더해짐
  const custCount = Number(draft.custRegCount || 0);
  const custNext = nextTierAbove(custCount, config.custRegTiers);
  if (custNext) {
    const currentBonus = tierBonus(custCount, config.custRegTiers || []);
    const delta = Math.max(0, Number(custNext.bonus || 0) - currentBonus);
    const remain = Math.max(0, Number(custNext.min) - custCount);

    if (remain > 0 && delta > 0) {
      candidates.push({
        key: 'custReg',
        effort: remain,
        title: '고객등록',
        description: `고객등록 다음 구간까지 ${remain}건 남았어요`,
        delta,
      });
    }
  }

  // 4) 맞춤제안: 다음 구간 보너스 차액은 총액에 직접 더해짐
  const tailoredCount = Number(draft.tailoredCount || 0);
  const tailoredNext = nextTierAbove(tailoredCount, config.tailoredTiers);
  if (tailoredNext) {
    const currentBonus = tierBonus(tailoredCount, config.tailoredTiers || []);
    const delta = Math.max(0, Number(tailoredNext.bonus || 0) - currentBonus);
    const remain = Math.max(0, Number(tailoredNext.min) - tailoredCount);

    if (remain > 0 && delta > 0) {
      candidates.push({
        key: 'tailored',
        effort: remain,
        title: '맞춤제안',
        description: `맞춤제안 다음 구간까지 ${remain}건 남았어요`,
        delta,
      });
    }
  }

  if (!candidates.length) return null;

  // 가장 가까운 목표 우선, 거리가 같으면 상승액이 큰 목표 우선
  candidates.sort((a, b) => (a.effort - b.effort) || (b.delta - a.delta));
  return candidates[0];
}


const PERSONAL_GOAL_DEFS = [
  { key: 'hs', label: 'HS', unit: '건', defaultTarget: 20 },
  { key: 'home', label: '홈 실적', unit: '건', defaultTarget: 5 },
  { key: 'tvFree', label: 'TV프리(부)', unit: '건', defaultTarget: 5 },
  { key: 'smartHome', label: '스마트홈', unit: '건', defaultTarget: 5 },
  { key: 'tailoredAmount', label: '맞춤제안 업셀 금액', unit: '원', defaultTarget: 1000000 },
  { key: 'tailored', label: '맞춤제안 업셀 건수', unit: '건', defaultTarget: 15 },
  { key: 'points', label: '성과포인트', unit: 'P', defaultTarget: 35 },
  { key: 'kpi', label: 'KPI 생산성', unit: 'P', defaultTarget: 35 },
  { key: 'incentive', label: '인센티브', unit: '원', defaultTarget: 1500000 },
];

function getPersonalGoalActuals(mergedDraft, pay) {
  const matrix = mergedDraft?.matrix || [];

  // HS = 신규 + MNP + 기변A/B/C 합산
  const hs = [0, 1, 2, 3, 4].reduce((sum, ri) => {
    const row = matrix[ri] || [];
    return sum + row.reduce((s, v) => s + (Number(v) || 0), 0);
  }, 0);

  return {
    hs,
    home: Number((mergedDraft?.homeBase?.homeOnly || 0) + (mergedDraft?.homeBase?.homeTv || 0)),
    tvFree: Number(mergedDraft?.homeFlat?.tvFree || 0),
    smartHome: Number(mergedDraft?.homeFlat?.smartHome || 0),
    tailoredAmount: Number(mergedDraft?.tailoredAmount || 0),
    tailored: Number(mergedDraft?.tailoredCount || 0),
    points: Number(pay?.totalPoints || 0),
    kpi: Number(pay?.kpiScore || 0),
    incentive: Number(pay?.total || 0),
  };
}

function MonthlyGoalCard({ month, mergedDraft, pay, goals, onSave, saving }) {
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState(() => new Set(Object.keys(goals || {})));
  const [values, setValues] = useState(goals || {});

  useEffect(() => {
    setSelected(new Set(Object.keys(goals || {})));
    setValues(goals || {});
  }, [goals, month]);

  const actuals = useMemo(() => getPersonalGoalActuals(mergedDraft, pay), [mergedDraft, pay]);
  const hasGoals = Object.keys(goals || {}).length > 0;

  const toggle = (key) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        if (!(Number(values[key]) > 0)) {
          const def = PERSONAL_GOAL_DEFS.find((d) => d.key === key);
          setValues((v) => ({ ...v, [key]: def?.defaultTarget || 10 }));
        }
      }
      return next;
    });
  };

  const save = async () => {
    const payload = {};
    PERSONAL_GOAL_DEFS.forEach((def) => {
      if (!selected.has(def.key)) return;
      const n = Number(values[def.key]);
      if (Number.isFinite(n) && n > 0) payload[def.key] = n;
    });

    if (!Object.keys(payload).length) return;
    const ok = await onSave(payload);
    if (ok) setEditing(false);
  };

  if (!hasGoals || editing) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="text-xs font-semibold text-violet-600">
          나의 {parseInt(month.split('-')[1], 10)}월
        </div>
        <div className="text-sm font-bold text-gray-900 mt-1">이번 달 내 목표</div>
        <div className="text-[11px] text-gray-400 mt-1">
          원하는 실적 항목을 선택하고 이번 달 목표를 정해보세요.
        </div>

        <div className="mt-3 space-y-2">
          {PERSONAL_GOAL_DEFS.map((def) => {
            const checked = selected.has(def.key);
            return (
              <div key={def.key} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggle(def.key)}
                  className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${
                    checked
                      ? 'bg-violet-600 border-violet-600 text-white'
                      : 'bg-white border-gray-300 text-transparent'
                  }`}
                >
                  <Check size={13} />
                </button>

                <div className="w-20 text-sm text-gray-700">{def.label}</div>

                <input
                  type="number"
                  min="0"
                  step={def.unit === '원' ? '10000' : (def.unit === 'P' ? '0.1' : '1')}
                  disabled={!checked}
                  value={values[def.key] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [def.key]: e.target.value }))}
                  className="min-w-0 flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-200 disabled:bg-gray-50 disabled:text-gray-300"
                  placeholder="목표"
                />

                <div className="w-6 text-xs text-gray-400">{def.unit}</div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={save}
            disabled={saving || selected.size === 0}
            className="flex-1 px-3 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold disabled:opacity-50"
          >
            {saving ? '저장 중' : '목표 저장'}
          </button>

          {hasGoals && (
            <button
              onClick={() => setEditing(false)}
              className="px-4 py-2 rounded-lg bg-gray-100 text-gray-500 text-sm"
            >
              취소
            </button>
          )}
        </div>
      </div>
    );
  }

  const activeDefs = PERSONAL_GOAL_DEFS.filter((def) => Number(goals?.[def.key]) > 0);
  const completeCount = activeDefs.filter((def) => {
    const target = Number(goals[def.key]);
    const current = Number(actuals[def.key] || 0);
    return current >= target;
  }).length;

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-violet-600">
            나의 {parseInt(month.split('-')[1], 10)}월
          </div>
          <div className="text-sm font-bold text-gray-900 mt-1">이번 달 내 목표</div>
        </div>

        <button
          onClick={() => setEditing(true)}
          className="text-xs text-gray-400 hover:text-violet-600"
        >
          수정
        </button>
      </div>

      <div className="mt-4 space-y-4">
        {activeDefs.map((def) => {
          const target = Number(goals[def.key]);
          const current = Number(actuals[def.key] || 0);
          const pct = target > 0 ? Math.max(0, Math.min(100, (current / target) * 100)) : 0;
          const achieved = current >= target;

          const currentLabel = def.unit === '원'
            ? Math.round(current).toLocaleString()
            : def.unit === 'P'
              ? current.toFixed(1)
              : Math.round(current).toString();

          const targetLabel = def.unit === '원'
            ? Math.round(target).toLocaleString()
            : def.unit === 'P'
              ? target.toFixed(1)
              : Math.round(target).toString();

          return (
            <div key={def.key}>
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-gray-700">{def.label}</div>
                <div className={`text-sm font-bold ${achieved ? 'text-emerald-600' : 'text-gray-800'}`}>
                  {currentLabel} / {targetLabel}{def.unit}
                </div>
              </div>

              <div className="h-2 bg-gray-100 rounded-full overflow-hidden mt-2">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    achieved ? 'bg-emerald-500' : 'bg-violet-600'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              <div className="text-[11px] mt-1.5">
                {achieved ? (
                  <span className="font-semibold text-emerald-600">목표 달성! 🎉</span>
                ) : (
                  <span className="text-gray-400">{Math.round(pct)}% 진행 중</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {activeDefs.length > 1 && (
        <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500">
          이번 달 목표 {completeCount} / {activeDefs.length}개 달성
        </div>
      )}
    </div>
  );
}

function NextGoalCard({ pay, draft, config, onGoInput }) {
  const goal = useMemo(
    () => buildNextGoal(pay, draft, config),
    [pay, draft, config]
  );

  if (!goal) return null;

  return (
    <button
      onClick={onGoInput}
      className="w-full text-left bg-white rounded-xl border border-violet-200 p-4 hover:border-violet-300 transition"
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
          <Target size={18} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-violet-600 mb-1">다음 목표</div>
          <div className="text-sm font-bold text-gray-900">{goal.title}</div>
          <div className="text-sm text-gray-600 mt-0.5">{goal.description}</div>

          <div className="mt-3 flex items-baseline gap-1.5 flex-wrap">
            <span className="text-xs text-gray-400">달성 시 예상 인센티브</span>
            <span className="text-lg font-bold text-violet-700">+{won(goal.delta)}</span>
          </div>
        </div>

        <ChevronRight size={17} className="text-violet-300 shrink-0 mt-1" />
      </div>
    </button>
  );
}

function GrowthBadge({ current, prev }) {
  if (!prev || prev <= 0) return null;
  const diff = current - prev;
  const pct = Math.round((diff / prev) * 100);
  if (diff === 0) return <span className="text-xs text-violet-100">전월과 동일</span>;
  const up = diff > 0;
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${up ? 'bg-emerald-400/20 text-emerald-100' : 'bg-red-400/20 text-red-100'}`}>
      전월 대비 {up ? '+' : ''}{pct}%
    </span>
  );
}

function GradeProgress({ pay, config, dailyDays, month }) {
  const grades = config.grades || DEFAULT_GRADES;
  const maxMin = Math.max(...grades.map((g) => g.min), 1);
  const pct = Math.min(100, (pay.totalPoints / maxMin) * 100);
  const next = pay.nextGrade;
  const remain = next ? Math.max(0, next.min - pay.totalPoints) : 0;
  const currentBonus = pay.gradeEligible ? pay.gradeBonus : 0;
  const jump = next ? next.bonus - currentBonus : 0;
  const ticks = grades.filter((g) => g.min > 0).sort((a, b) => a.min - b.min);

  // 지금까지의 페이스로 다음 등급까지 며칠 걸릴지 추정
  const paceLabel = (() => {
    if (!next || remain <= 0 || !dailyDays || !month) return null;
    const daysWithData = Object.values(dailyDays).filter((m) => dayHasData(m)).length;
    const now = new Date();
    const isCurrentMonth = monthKeyOf(now) === month;
    const daysElapsed = isCurrentMonth ? now.getDate() : daysInMonth(month);
    const activeDays = Math.max(daysWithData, 1);
    const perDay = pay.totalPoints / Math.max(daysElapsed, activeDays, 1);
    if (perDay <= 0) return null;
    const daysNeeded = Math.ceil(remain / perDay);
    return `지금 페이스(하루 평균 ${perDay.toFixed(1)}P)면 ${daysNeeded}일 후 도달 예상`;
  })();

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-end justify-between mb-3">
        <div>
          <div className="text-xs text-gray-400">이번 달 성과 포인트</div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-gray-900 tabular-nums">{pay.totalPoints.toFixed(1)}</span>
            <span className="text-sm text-gray-400">P</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-400">현재 등급</div>
          <div className={`text-lg font-bold ${pay.gradeEligible && currentBonus > 0 ? 'text-violet-700' : 'text-gray-400'}`}>
            {pay.gradeEligible ? pay.grade : 'D'}
            <span className="text-xs font-medium ml-1 text-gray-500">{won(currentBonus)}</span>
          </div>
        </div>
      </div>

      <div className="relative h-2.5 rounded-full bg-gray-100 overflow-visible">
        <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-500"
          style={{ width: `${pct}%` }} />
        {ticks.map((g) => (
          <div key={g.grade} className="absolute -top-0.5 w-px h-3.5 bg-white/80" style={{ left: `${Math.min(100, (g.min / maxMin) * 100)}%` }} />
        ))}
      </div>
      <div className="relative h-4 mt-1">
        {ticks.map((g) => (
          <span key={g.grade} className="absolute text-[10px] text-gray-400 -translate-x-1/2 tabular-nums"
            style={{ left: `${Math.min(100, (g.min / maxMin) * 100)}%` }}>
            {g.grade}
          </span>
        ))}
      </div>

      {next ? (
        <>
          <div className="mt-2 flex items-center gap-2 text-sm">
            <Target size={14} className="text-violet-500 shrink-0" />
            <span className="text-gray-600">
              <b className="text-violet-700">{next.grade}등급</b>까지 <b className="text-gray-900 tabular-nums">{remain.toFixed(1)}P</b>
              {jump > 0 && <span className="text-gray-400"> · 도달하면 +{won(jump)}</span>}
            </span>
          </div>
          {paceLabel && <div className="mt-1 text-xs text-gray-400 pl-6">{paceLabel}</div>}
        </>
      ) : (
        <div className="mt-2 flex items-center gap-2 text-sm text-emerald-600">
          <Award size={14} className="shrink-0" /> 최고 등급이에요. 이번 달 잘하고 있어요!
        </div>
      )}
    </div>
  );
}

function HomeGateCard({ pay, config, onGoInput }) {
  const gate = HOME_GATE_MIN;
  const short = Math.max(0, gate - pay.homeGatePoints);
  const potential = (() => {
    const grades = [...(config.grades || DEFAULT_GRADES)].sort((a, b) => b.min - a.min);
    const hit = grades.find((g) => pay.totalPoints >= g.min);
    return hit ? hit.bonus : 0;
  })();

  if (!pay.gradeEligible) {
    return (
      <button onClick={onGoInput} className="w-full text-left bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex items-start gap-2.5">
          <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-amber-900">
              홈 최소조건 {pay.homeGatePoints.toFixed(1)} / {gate}점 — {short.toFixed(1)}점 부족
            </div>
            <div className="text-xs text-amber-700 mt-1 leading-relaxed">
              지금은 성과등급 보너스가 <b>0원</b>이에요.
              {potential > 0 && <> 홈 {short.toFixed(1)}점만 더 채우면 현재 포인트로 <b>{won(potential)}</b>을 받을 수 있어요.</>}
            </div>
            <div className="text-[11px] text-amber-600/80 mt-1.5">인터넷 1점 · TV프리 0.3점 · 스마트홈 0.2점 기준 · 눌러서 홈 실적 입력하기</div>
          </div>
        </div>
        <div className="mt-3 h-1.5 rounded-full bg-amber-200/60 overflow-hidden">
          <div className="h-full rounded-full bg-amber-500 transition-all duration-500" style={{ width: `${Math.min(100, (pay.homeGatePoints / gate) * 100)}%` }} />
        </div>
      </button>
    );
  }

  if (pay.homeAddonPoints > 0 && !pay.addonApplies) {
    return (
      <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 flex items-start gap-2.5">
        <Info size={16} className="text-sky-500 shrink-0 mt-0.5" />
        <div className="text-xs text-sky-800 leading-relaxed">
          홈 최소조건은 충족했어요. 다만 모바일 포인트가 <b className="tabular-nums">{pay.mobilePoints.toFixed(1)}P</b>라
          <b> {ADDON_GATE}P를 넘겨야</b> 홈 가점 <b className="tabular-nums">{pay.homeAddonPoints.toFixed(1)}P</b>가 총점에 더해져요.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-emerald-800">
      <Check size={15} className="shrink-0" />
      홈 최소조건 충족 ({pay.homeGatePoints.toFixed(1)} / {gate}점) — 성과등급 보너스 대상이에요
    </div>
  );
}

function RowKV({ label, value, bold }) {
  return (
    <div className={`flex items-center justify-between px-4 py-2.5 text-sm ${bold ? 'bg-violet-50' : ''}`}>
      <span className={bold ? 'text-violet-700 font-semibold' : 'text-gray-600'}>{label}</span>
      <span className={bold ? 'text-violet-800 font-bold' : 'text-gray-800 font-medium'}>{value}</span>
    </div>
  );
}


function RankingCenter({ rows, dailyRecords, month, config }) {
  const [metricKey, setMetricKey] = useState('hs');
  const [mode, setMode] = useState('employees'); // employees | stores
  const [storeMode, setStoreMode] = useState('total'); // total | avg
  const [periodMode, setPeriodMode] = useState('month'); // month | recent7
  const metric = COMPETITION_METRICS.find((m) => m.key === metricKey) || COMPETITION_METRICS[0];

  const employeeRanked = useMemo(() => [...(rows || [])]
    .filter((r) => !NON_SALES_STORES.includes(r.branch))
    .sort((a, b) => metric.value(b) - metric.value(a) || a.name.localeCompare(b.name)),
  [rows, metricKey]);

  const recentEmployeeRanked = useMemo(
    () => buildRisingRanking(rows, dailyRecords, month, config, metricKey),
    [rows, dailyRecords, month, config, metricKey]
  );

  const storeRanked = useMemo(() => {
    const baseRows = periodMode === 'recent7' ? recentEmployeeRanked : (rows || []);
    const map = new Map();

    baseRows.filter((r) => !NON_SALES_STORES.includes(r.branch)).forEach((r) => {
      if (!map.has(r.branch)) map.set(r.branch, { name: r.branch, total: 0, count: 0 });
      const item = map.get(r.branch);
      const value = periodMode === 'recent7'
        ? Number(r.recentValue || 0)
        : Number(metric.value(r) || 0);
      item.total += value;
      item.count += 1;
    });

    return [...map.values()]
      .map((s) => ({
        ...s,
        value: storeMode === 'avg' ? (s.count ? s.total / s.count : 0) : s.total,
      }))
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
  }, [rows, recentEmployeeRanked, metricKey, storeMode, periodMode]);

  return (
    <div className="space-y-3">
      <div className="bg-white border border-gray-100 rounded-xl p-3">
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setMode('employees')} className={`px-3 py-1.5 rounded-md text-xs font-semibold ${mode === 'employees' ? 'bg-white shadow text-violet-700' : 'text-gray-500'}`}>직원 순위</button>
            <button onClick={() => setMode('stores')} className={`px-3 py-1.5 rounded-md text-xs font-semibold ${mode === 'stores' ? 'bg-white shadow text-violet-700' : 'text-gray-500'}`}>매장 순위</button>
          </div>
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setPeriodMode('month')} className={`px-2.5 py-1.5 rounded-md text-[11px] font-semibold ${periodMode === 'month' ? 'bg-white shadow text-violet-700' : 'text-gray-500'}`}>월 누적</button>
            <button onClick={() => setPeriodMode('recent7')} className={`px-2.5 py-1.5 rounded-md text-[11px] font-semibold ${periodMode === 'recent7' ? 'bg-white shadow text-orange-600' : 'text-gray-500'}`}>최근 7일</button>
          </div>
          <select value={metricKey} onChange={(e) => setMetricKey(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white">
            {COMPETITION_METRICS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </div>

        {mode === 'stores' && (
          <div className="mt-2 flex justify-end">
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              <button onClick={() => setStoreMode('total')} className={`px-2.5 py-1 rounded-md text-[11px] ${storeMode === 'total' ? 'bg-white shadow text-violet-700' : 'text-gray-500'}`}>총 실적</button>
              <button onClick={() => setStoreMode('avg')} className={`px-2.5 py-1 rounded-md text-[11px] ${storeMode === 'avg' ? 'bg-white shadow text-violet-700' : 'text-gray-500'}`}>1인당</button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-50 text-sm font-semibold text-gray-700">
          {periodMode === 'recent7' ? '최근 7일 · ' : ''}{metric.label} {mode === 'employees' ? '직원 순위' : '매장 순위'}
        </div>
        <div className="divide-y divide-gray-50">
          {(mode === 'employees'
            ? (periodMode === 'recent7' ? recentEmployeeRanked : employeeRanked)
            : storeRanked
          ).map((item, i) => {
            const name = mode === 'employees' ? `${item.name} · ${displayStoreName(item.branch)}` : displayStoreName(item.name);
            const value = mode === 'employees'
              ? (periodMode === 'recent7' ? item.recentValue : metric.value(item))
              : item.value;
            return (
              <div key={mode === 'employees' ? item.id : item.name} className="flex items-center justify-between px-4 py-3 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-gray-100 text-gray-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-gray-50 text-gray-400'
                  }`}>{i + 1}</div>
                  <div className="text-sm text-gray-800 truncate">{name}</div>
                </div>
                <div className="text-sm font-bold text-violet-700 shrink-0">
                  {formatCompetitionValue(value, metric.unit)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ===================== 관리자 화면 ===================== */


function AdminHomeCare({ employees }) {
  const [orders,setOrders]=useState([]);
  const [loading,setLoading]=useState(true);
  const load=useCallback(async()=>{
    setLoading(true);
    const {data,error}=await supabase.from('home_orders').select('*').eq('status','pending')
      .order('planned_install_date',{ascending:true,nullsFirst:false});
    if(!error)setOrders(data||[]);
    setLoading(false);
  },[]);
  useEffect(()=>{load();},[load]);

  const empMap=Object.fromEntries((employees||[]).map(e=>[e.id,e]));
  const today=new Date().toISOString().slice(0,10);
  const overdue=orders.filter(o=>o.planned_install_date && String(o.planned_install_date).slice(0,10)<today);
  const todayList=orders.filter(o=>String(o.planned_install_date||'').slice(0,10)===today);
  const unscheduled=orders.filter(o=>!o.planned_install_date);

  if(loading)return <div className="bg-white rounded-xl border p-4 text-sm text-gray-400">홈 케어 현황 불러오는 중...</div>;

  return <div className="space-y-3">
    <div className="grid grid-cols-4 gap-2">
      {[['진행중',orders.length],['오늘 설치',todayList.length],['예정일 경과',overdue.length],['일정 미정',unscheduled.length]].map(([l,v])=>
        <div key={l} className="bg-white rounded-xl border border-gray-100 p-3 text-center">
          <div className="text-lg font-bold">{v}</div><div className="text-[10px] text-gray-400">{l}</div>
        </div>)}
    </div>
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 border-b"><div className="text-sm font-bold">🏠 우리 매장 홈 케어</div>
        <div className="text-xs text-gray-400">예정일이 지난 건부터 확인해보세요.</div></div>
      {orders.length===0?<div className="py-10 text-center text-sm text-gray-400">진행중인 홈 청약이 없어요.</div>:
        <div className="divide-y">{[...orders].sort((a,b)=>String(a.planned_install_date||'9999').localeCompare(String(b.planned_install_date||'9999'))).map(o=>{
          const emp=empMap[o.user_id], p=o.planned_install_date?String(o.planned_install_date).slice(0,10):null;
          const over=p&&p<today, isToday=p===today, prod=HOME_ORDER_PRODUCTS.find(x=>x.key===o.product_type)?.label||o.product_type;
          return <div key={o.id} className="px-4 py-3">
            <div className="flex justify-between gap-3"><div><div className="text-sm font-bold">{o.customer_name||'고객명 미입력'} · {prod}</div>
              <div className="text-xs text-gray-500 mt-1">{emp?.name||'직원'} · {emp?.branch||''}</div></div>
              <span className={`text-[10px] font-bold px-2 py-1 rounded-full h-fit ${over?'bg-red-50 text-red-600':isToday?'bg-orange-50 text-orange-600':'bg-violet-50 text-violet-600'}`}>
                {over?'확인 필요':isToday?'오늘 설치':p?'설치 예정':'일정 미정'}</span></div>
            <div className="text-[11px] text-gray-400 mt-2">접수 {o.source_work_date||String(o.applied_at).slice(0,10)} · 설치예정 {p||'미정'}</div>
          </div>})}</div>}
    </div>
  </div>;
}

function AdminView({ adminTab, setAdminTab, months, month, setMonth, rows, rankingRows, dailyRecords, totalPay, pendingCount, approve, config, persistConfig, employees, addEmployee, updateEmployee, removeEmployee, stores, addStore, removeStore, isFullAdmin, monthLocked, toggleMonthLock, authUserId }) {
  const TABS = [
    { key: 'dashboard', label: '대시보드', icon: LayoutDashboard },
    { key: 'compare', label: '실적 비교', icon: Layers },
    { key: 'rankings', label: '랭킹', icon: Trophy },
    { key: 'notifications', label: '알림', icon: Bell },
    { key: 'homeCare', label: '홈케어', icon: ClipboardList },
    { key: 'recognition', label: '인정', icon: Award },
    { key: 'history', label: '변경 이력', icon: History },
    { key: 'employees', label: '직원 관리', icon: Users },
    ...(isFullAdmin ? [
      { key: 'rates', label: '지급기준 관리', icon: Settings },
      { key: 'permissions', label: '권한 관리', icon: ShieldCheck },
    ] : []),
  ];
  useEffect(() => {
    if ((adminTab === 'rates' || adminTab === 'permissions') && !isFullAdmin) setAdminTab('dashboard');
  }, [adminTab, isFullAdmin]); // eslint-disable-line

  const downloadCSV = () => {
    const header = ['이름', '직급', '매장', 'HS', '등급', '총 인센티브', '상태'];
    const lines = [header, ...rows.map((r) => [
      r.name, r.position, r.branch, hsCount(r.draft), r.pay.gradeEligible ? r.pay.grade : '', r.pay.total, r.status,
    ])];
    const csv = '\uFEFF' + lines.map((row) => row.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `미소인센티브_${month}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-5">
      <div className="fixed top-3 right-14 z-40">
        <NotificationBell userId={authUserId} onOpen={() => setAdminTab('notifications')} />
      </div>

      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex bg-white border border-gray-200 rounded-lg p-0.5 flex-wrap">
          {TABS.map((n) => (
            <button key={n.key} onClick={() => setAdminTab(n.key)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium ${adminTab === n.key ? 'bg-violet-600 text-white' : 'text-gray-500'}`}>
              <n.icon size={14} /> {n.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={month} onChange={(e) => setMonth(e.target.value)} className="text-sm font-medium bg-white border border-gray-200 rounded-lg px-3 py-2">
            {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
          {isFullAdmin && (
            <button onClick={() => toggleMonthLock(month, !monthLocked)}
              className={`text-xs font-medium px-3 py-2 rounded-lg border ${monthLocked ? 'bg-red-50 text-red-600 border-red-200' : 'bg-white text-gray-600 border-gray-200'}`}>
              {monthLocked ? '🔒 마감됨 (해제)' : '마감하기'}
            </button>
          )}
          <button onClick={downloadCSV} className="flex items-center gap-1 text-xs font-medium px-3 py-2 rounded-lg bg-emerald-600 text-white">
            <UploadCloud size={13} /> 엑셀 다운로드
          </button>
        </div>
      </div>

      {monthLocked && (
        <div className="mb-4 bg-red-50 border border-red-100 text-red-600 text-xs rounded-lg p-3 flex items-center gap-2">
          <Info size={13} className="shrink-0" /> {monthLabel(month)}은 마감된 달이에요. 모든 직원의 실적 입력·수정이 잠겨 있어요.
        </div>
      )}

      {adminTab === 'dashboard' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="이번 달 예상 지급 총액" value={won(totalPay)} icon={Wallet} />
            <StatCard label="이번 달 HS 합계" value={`${rows.reduce((s, r) => s + hsCount(r.draft), 0)}건`} icon={TrendingUp} />
            <StatCard label="전체 직원 수" value={`${rows.length}명`} icon={Users} />
            <StatCard label="승인 대기 건수" value={`${pendingCount}건`} icon={ClipboardList} accent={pendingCount > 0} />
          </div>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 text-sm font-semibold text-gray-700 border-b border-gray-50">직원별 예상 인센티브</div>
            <div className="overflow-x-auto">
              <table className="text-sm min-w-max">
                <thead>
                  <tr className="text-left text-gray-400 text-xs whitespace-nowrap">
                    <th className="px-4 py-2">이름</th><th className="px-2 py-2">직급</th><th className="px-2 py-2">매장</th>
                    <th className="px-2 py-2 text-right">HS</th>
                    <th className="px-2 py-2 text-right">등급</th><th className="px-2 py-2 text-right">총 인센티브</th>
                    <th className="px-2 py-2">상태</th><th className="px-2 py-2">최종 저장</th><th className="px-4 py-2 text-right">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.sort((a, b) => b.pay.total - a.pay.total).map((r) => (
                    <tr key={r.id} className="border-t border-gray-50 whitespace-nowrap">
                      <td className="px-4 py-2.5 font-medium text-gray-800">{r.name}</td>
                      <td className="px-2 py-2.5 text-gray-500">{r.position}</td>
                      <td className="px-2 py-2.5 text-gray-500">{displayStoreName(r.branch)}</td>
                      <td className="px-2 py-2.5 text-right font-medium text-gray-700 tabular-nums">{hsCount(r.draft)}</td>
                      <td className="px-2 py-2.5 text-right text-gray-600">{r.pay.gradeEligible ? r.pay.grade : '-'}</td>
                      <td className="px-2 py-2.5 text-right font-semibold text-violet-700">{won(r.pay.total)}</td>
                      <td className="px-2 py-2.5"><StatusBadge status={r.status} /></td>
                      <td className="px-2 py-2.5"><LastSaved updatedAt={r.updatedAt} /></td>
                      <td className="px-4 py-2.5 text-right">
                        {r.status === 'pending' ? <button onClick={() => approve(r.id)} className="text-xs font-medium px-2.5 py-1 rounded-md bg-violet-600 text-white">실적 승인</button> : <span className="text-xs text-gray-300">-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {adminTab === 'compare' && <ComparisonView rows={rows} />}

      {adminTab === 'rankings' && <RankingCenter rows={rankingRows || rows} dailyRecords={dailyRecords} month={month} config={config} />}

      {adminTab === 'notifications' && (
        <NotificationCenter userId={authUserId} />
      )}
      {adminTab === 'homeCare' && <AdminHomeCare employees={employees} />}

      {adminTab === 'recognition' && (
        <SpecialBadgeAwardPanel employees={employees} authUserId={authUserId} />
      )}

      {adminTab === 'history' && <HistoryTab employees={employees} month={month} config={config} />}

      {adminTab === 'employees' && (
        <EmployeeManager employees={employees} addEmployee={addEmployee} updateEmployee={updateEmployee} removeEmployee={removeEmployee} stores={stores} addStore={addStore} removeStore={removeStore} />
      )}

      {adminTab === 'rates' && isFullAdmin && (
        <RatesManager config={config} persistConfig={persistConfig} />
      )}

      {adminTab === 'permissions' && isFullAdmin && (
        <PermissionsManager employees={employees} />
      )}
    </div>
  );
}

/* 관리자는 MNP·기변A/B/C·010신규를 묶어 HS로 관리 — 일일입력 매트릭스의 해당 행을 합산 */
const HS_ROWS = [
  { label: '일반모델 MNP', short: 'MNP' },
  { label: '일반모델 기변A', short: '기변A' },
  { label: '일반모델 기변B', short: '기변B' },
  { label: '일반모델 기변C', short: '기변C' },
  { label: '일반모델 신규', short: '신규' },
];
const HS_PARTS = HS_ROWS.map((r) => ({ short: r.short, idx: MATRIX_ROWS.indexOf(r.label) })).filter((r) => r.idx >= 0);
const matrixRowCount = (d, ri) => ((d && d.matrix && d.matrix[ri]) || []).reduce((s, v) => s + (v || 0), 0);
const hsCount = (d) => HS_PARTS.reduce((s, p) => s + matrixRowCount(d, p.idx), 0);

const COMPARE_METRICS = [
  { key: 'total', label: '총 인센티브', unit: 'won', calc: (d, p) => p.total },
  {
    key: 'hs', label: 'HS 합계 (MNP·기변·신규)', unit: 'count', calc: (d) => hsCount(d),
    parts: HS_PARTS.map((p) => ({ label: p.short, calc: (d) => matrixRowCount(d, p.idx) })),
  },
  { key: 'mnp', label: 'MNP', unit: 'count', calc: (d) => d.mobilePoint.mnp || 0 },
  { key: 'new010', label: '010 신규', unit: 'count', calc: (d) => d.mobilePoint.new010 || 0 },
  { key: 'gibyeon', label: '기기변경 (전체)', unit: 'count', calc: (d) => (d.mobilePoint.gibyeon115 || 0) + (d.mobilePoint.gibyeon85 || 0) + (d.mobilePoint.gibyeonWeak || 0) + (d.mobilePoint.gibyeonLVC || 0) },
  { key: 'usedMnp', label: '중고 MNP', unit: 'count', calc: (d) => d.mobilePoint.usedMnp || 0 },
  { key: 'secondOnly', label: '2ND(단독개통포함)', unit: 'count', calc: (d) => d.mobilePoint.secondOnly || 0 },
  {
    key: 'home',
    label: '홈 실적',
    unit: 'count',
    calc: (d) => (d.homeBase?.homeOnly || 0) + (d.homeBase?.homeTv || 0),
    parts: [
      { label: '홈 단독', calc: (d) => d.homeBase?.homeOnly || 0 },
      { label: '홈+TV', calc: (d) => d.homeBase?.homeTv || 0 },
    ],
  },
  { key: 'homeOnly', label: '홈 단독', unit: 'count', calc: (d) => d.homeBase.homeOnly || 0 },
  { key: 'homeTv', label: '홈+TV 동시청약', unit: 'count', calc: (d) => d.homeBase.homeTv || 0 },
  { key: 'planFee', label: '요금제 유치 수수료', unit: 'won', calc: (d, p) => p.matrixTotal },
  { key: 'bundle2nd', label: '2ND 번들', unit: 'won', calc: (d, p) => p.bundle2ndTotal },
  { key: 'sono', label: '소노', unit: 'won', calc: (d, p) => p.sonoPay },
  { key: 'custReg', label: '고객등록 건수', unit: 'count', calc: (d) => d.custRegCount || 0 },
  { key: 'tailored', label: '맞춤제안 업셀 건수', unit: 'count', calc: (d) => d.tailoredCount || 0 },
  { key: 'kpiScore', label: 'KPI 생산성 점수', unit: 'point', calc: (d, p) => p.kpiScore },
];

function formatDateTime(iso) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function groupItemLabel(config, groupKey, itemKey) {
  if (groupKey === 'homeBase') return HOME_BASE_ITEMS.find((i) => i.key === itemKey)?.label || itemKey;
  const table = config?.[groupKey];
  return (Array.isArray(table) && table.find((i) => i.key === itemKey)?.label) || itemKey;
}

// old_data/new_data(JSON) 두 시점을 비교해서 실제로 바뀐 항목만 뽑아냄
function diffDayRecords(config, oldRaw, newRaw) {
  const oldD = normalizeDay(oldRaw);
  const newD = normalizeDay(newRaw);
  const changes = [];

  oldD.matrix.forEach((row, ri) => {
    row.forEach((oldVal, ci) => {
      const newVal = newD.matrix[ri]?.[ci] || 0;
      if ((oldVal || 0) !== newVal) {
        changes.push({ label: `${MATRIX_ROW_DEFS[ri]?.label || ''} · ${MATRIX_COLS[ci]}`, oldVal: oldVal || 0, newVal });
      }
    });
  });

  DAILY_GROUP_KEYS.forEach((gk) => {
    const oldG = oldD.groups[gk] || {};
    const newG = newD.groups[gk] || {};
    const keys = new Set([...Object.keys(oldG), ...Object.keys(newG)]);
    keys.forEach((k) => {
      const oldVal = oldG[k] || 0;
      const newVal = newG[k] || 0;
      if (oldVal !== newVal) changes.push({ label: groupItemLabel(config, gk, k), oldVal, newVal });
    });
  });

  const EXTRA_LABELS = { custRegCount: '고객등록 건수', tailoredCount: '맞춤제안 업셀 건수', tailoredAmount: '맞춤제안 업셀금액' };
  DAILY_NUMERIC_KEYS.forEach((k) => {
    const oldVal = oldD[k] || 0;
    const newVal = newD[k] || 0;
    if (oldVal !== newVal) changes.push({ label: EXTRA_LABELS[k] || k, oldVal, newVal });
  });

  return changes;
}

function HistoryTab({ employees, month, config }) {
  const [empId, setEmpId] = useState('');
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [nameMap, setNameMap] = useState({});

  useEffect(() => {
    if (employees.length && !empId) setEmpId(employees[0].id);
  }, [employees]); // eslint-disable-line

  useEffect(() => {
    setNameMap(Object.fromEntries(employees.map((e) => [e.id, e.name])));
  }, [employees]);

  useEffect(() => {
    if (!empId) return;
    (async () => {
      setLoading(true);
      const [y, m] = month.split('-').map(Number);
      const from = `${month}-01`;
      const to = `${y}-${String(m + 1).padStart(2, '0')}-01`;
      const { data, error } = await supabase
        .from('daily_records_audit')
        .select('id, work_date, action, old_data, new_data, changed_by, changed_at')
        .eq('user_id', empId)
        .gte('work_date', from)
        .lt('work_date', to)
        .order('changed_at', { ascending: false });
      if (!error) setLogs(data || []);
      setLoading(false);
    })();
  }, [empId, month]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <select value={empId} onChange={(e) => setEmpId(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white">
          {employees.map((e) => <option key={e.id} value={e.id}>{e.name} · {displayStoreName(e.branch)}</option>)}
        </select>
        <span className="text-xs text-gray-400">{monthLabel(month)} · 저장할 때마다 자동으로 기록돼요</span>
      </div>

      {loading ? (
        <div className="text-xs text-gray-400 py-8 text-center">불러오는 중...</div>
      ) : logs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 text-xs text-gray-400 py-8 text-center">이번 달 변경 기록이 없어요.</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
          {logs.map((l) => {
            const detail = diffDayRecords(config, l.old_data, l.new_data);
            const totalNew = detail.reduce((s, c) => s + c.newVal, 0);
            return (
              <div key={l.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm text-gray-700">{l.work_date} <span className="text-gray-300">·</span> {l.action === 'insert' ? '최초 입력' : '수정'}</div>
                    <div className="text-[11px] text-gray-400">{formatDateTime(l.changed_at)} · {nameMap[l.changed_by] || '알 수 없음'}</div>
                  </div>
                  {detail.length === 0 && <span className="text-xs text-gray-400">변경 없음</span>}
                </div>
                {detail.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {detail.map((c, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">{c.label}</span>
                        <span className={`font-medium tabular-nums ${c.oldVal !== c.newVal ? 'text-amber-600' : 'text-gray-400'}`}>
                          {l.action === 'insert' ? `${c.newVal}건` : `${c.oldVal}건 → ${c.newVal}건`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


function ComparisonView({ rows }) {
  const [groupBy, setGroupBy] = useState('employee'); // employee | branch
  const [metricKey, setMetricKey] = useState('total');
  const metric = COMPARE_METRICS.find((m) => m.key === metricKey) || COMPARE_METRICS[0];
  const fmt = (v) => (metric.unit === 'won' ? won(v) : metric.unit === 'point' ? `${(v || 0).toFixed(1)}P` : `${v}건`);

  let data;
  if (groupBy === 'employee') {
    data = rows.map((r) => ({
      label: `${r.name} (${displayStoreName(r.branch)})`,
      value: metric.calc(r.draft, r.pay),
      parts: metric.parts ? metric.parts.map((p) => p.calc(r.draft, r.pay)) : null,
    }));
  } else {
    const byBranch = {};
    rows.forEach((r) => {
      const cur = byBranch[r.branch] || { label: r.branch, value: 0, parts: metric.parts ? metric.parts.map(() => 0) : null };
      cur.value += metric.calc(r.draft, r.pay);
      if (cur.parts) metric.parts.forEach((p, i) => { cur.parts[i] += p.calc(r.draft, r.pay); });
      byBranch[r.branch] = cur;
    });
    data = Object.values(byBranch);
  }
  data = data.sort((a, b) => b.value - a.value);
  const max = Math.max(1, ...data.map((d) => d.value));
  const grandTotal = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex bg-white border border-gray-200 rounded-lg p-0.5">
          <button onClick={() => setGroupBy('employee')} className={`px-3 py-1.5 rounded-md text-sm font-medium ${groupBy === 'employee' ? 'bg-violet-600 text-white' : 'text-gray-500'}`}>직원별</button>
          <button onClick={() => setGroupBy('branch')} className={`px-3 py-1.5 rounded-md text-sm font-medium ${groupBy === 'branch' ? 'bg-violet-600 text-white' : 'text-gray-500'}`}>매장별</button>
        </div>
        <select value={metricKey} onChange={(e) => setMetricKey(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white">
          {COMPARE_METRICS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-2.5">
        {data.length > 0 && (
          <div className="flex items-center justify-between pb-2 mb-1 border-b border-gray-50">
            <span className="text-xs text-gray-400">{groupBy === 'employee' ? '전체 직원' : '전체 매장'} 합계</span>
            <span className="text-sm font-bold text-gray-800">{fmt(grandTotal)}</span>
          </div>
        )}
        {data.length === 0 && <div className="text-xs text-gray-400 text-center py-6">데이터가 없습니다.</div>}
        {data.map((d, i) => (
          <div key={d.label} className="pb-1">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-gray-600 truncate pr-2">{i + 1}. {d.label}</span>
              <span className="font-semibold text-gray-800 whitespace-nowrap">{fmt(d.value)}</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-violet-500 rounded-full" style={{ width: `${Math.max(2, (d.value / max) * 100)}%` }} />
            </div>
            {d.parts && (
              <div className="mt-1 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[10px] text-gray-400">
                {metric.parts.map((p, pi) => (
                  <span key={p.label}>{p.label} <b className={`tabular-nums ${d.parts[pi] > 0 ? 'text-gray-600' : 'text-gray-300'}`}>{d.parts[pi]}</b></span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function EmployeeManager({ employees, addEmployee, updateEmployee, removeEmployee, stores, addStore, removeStore }) {
  const [form, setForm] = useState({ name: '', branch: stores[0] || '', position: '사원', hireDate: '' });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [newStore, setNewStore] = useState('');

  const submit = () => {
    if (!form.name.trim() || !form.branch) return;
    addEmployee(form.name.trim(), form.branch, form.position, form.hireDate);
    setForm({ name: '', branch: stores[0] || '', position: '사원', hireDate: '' });
  };
  const startEdit = (e) => { setEditingId(e.id); setEditForm({ name: e.name, branch: e.branch, position: e.position, hireDate: e.hireDate || '' }); };
  const saveEdit = () => { updateEmployee(editingId, editForm); setEditingId(null); };

  const [filterBranch, setFilterBranch] = useState('전체');
  const [sortBy, setSortBy] = useState('hireDesc');
  const [nameQuery, setNameQuery] = useState('');

  const [showInactive, setShowInactive] = useState(false);
  const [inactiveList, setInactiveList] = useState([]);
  const [inactiveLoading, setInactiveLoading] = useState(false);

  const loadInactive = async () => {
    setInactiveLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, employee_code, store_name, position, hire_date')
      .eq('active', false)
      .order('name', { ascending: true });
    if (!error) setInactiveList(data || []);
    setInactiveLoading(false);
  };
  const toggleShowInactive = () => {
    const next = !showInactive;
    setShowInactive(next);
    if (next) loadInactive();
  };
  const reactivate = async (id) => {
    const { error } = await supabase.from('profiles').update({ active: true }).eq('id', id);
    if (!error) {
      setInactiveList((prev) => prev.filter((p) => p.id !== id));
      window.location.reload(); // 목록 갱신을 위해 새로고침 (간단하고 확실한 방식)
    }
  };

  const visibleEmployees = employees
    .filter((e) => filterBranch === '전체' || e.branch === filterBranch)
    .filter((e) => !nameQuery.trim() || e.name.includes(nameQuery.trim()))
    .slice()
    .sort((a, b) => {
      if (sortBy === 'hireDesc') return (b.hireDate || '').localeCompare(a.hireDate || '');
      if (sortBy === 'hireAsc') return (a.hireDate || '').localeCompare(b.hireDate || '');
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'branch') return a.branch.localeCompare(b.branch);
      return 0;
    });

  return (
    <div className="max-w-2xl space-y-4">
      <PendingApprovals />
      <ProfileEditRequests />
      <Section title="매장 관리" sub={`${stores.length}개 매장`} defaultOpen>
        <div className="p-3 flex gap-2">
          <input placeholder="새 매장명 (예: 동명_매장명)" value={newStore} onChange={(e) => setNewStore(e.target.value)} className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm" />
          <button onClick={() => { addStore(newStore); setNewStore(''); }} className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold whitespace-nowrap">매장 추가</button>
        </div>
        <div className="px-3 pb-3 flex flex-wrap gap-1.5">
          {stores.map((s) => (
            <span key={s} className="flex items-center gap-1 bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-full">
              {s}
              <button onClick={() => { if (window.confirm(`"${s}" 매장을 정말 삭제할까요?\n이 매장으로 등록된 직원들의 실적 화면에는 영향이 없지만, 앞으로 이 매장은 새 직원 등록·회원가입 목록에서 사라져요.`)) removeStore(s); }} className="text-gray-400 hover:text-red-500">×</button>
            </span>
          ))}
        </div>
      </Section>

      <div className="bg-white rounded-xl border border-gray-100 p-4 grid grid-cols-2 gap-2">
        <input placeholder="이름" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm" />
        <select value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm">
          {stores.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm">
          {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <input type="month" value={form.hireDate} onChange={(e) => setForm({ ...form, hireDate: e.target.value })} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm" />
        <button onClick={submit} className="col-span-2 flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold"><UserPlus size={14} /> 직원 추가</button>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <input placeholder="이름 검색" value={nameQuery} onChange={(e) => setNameQuery(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white w-28" />
        <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white">
          <option value="전체">전체 매장</option>
          {stores.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white">
          <option value="hireDesc">입사월 최신순</option>
          <option value="hireAsc">입사월 오래된순</option>
          <option value="name">이름순</option>
          <option value="branch">매장순</option>
        </select>
        <span className="text-xs text-gray-400">{visibleEmployees.length}명</span>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
        {visibleEmployees.map((e) => (
          <div key={e.id} className="px-4 py-3">
            {editingId === e.id ? (
              <div className="grid grid-cols-2 gap-2">
                <input value={editForm.name} onChange={(ev) => setEditForm({ ...editForm, name: ev.target.value })} className="border border-gray-200 rounded-lg px-2 py-1 text-sm" />
                <select value={editForm.branch} onChange={(ev) => setEditForm({ ...editForm, branch: ev.target.value })} className="border border-gray-200 rounded-lg px-2 py-1 text-sm">
                  {stores.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={editForm.position} onChange={(ev) => setEditForm({ ...editForm, position: ev.target.value })} className="border border-gray-200 rounded-lg px-2 py-1 text-sm">
                  {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <input type="month" value={editForm.hireDate} onChange={(ev) => setEditForm({ ...editForm, hireDate: ev.target.value })} className="border border-gray-200 rounded-lg px-2 py-1 text-sm" />
                <button onClick={saveEdit} className="text-xs font-medium px-2.5 py-1 rounded-md bg-violet-600 text-white">저장</button>
                <button onClick={() => setEditingId(null)} className="text-xs text-gray-400">취소</button>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-800">
                    {e.name} · {e.position}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5 break-words">
                    {displayStoreName(e.branch)}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5">
                    {e.hireDate ? `입사 ${e.hireDate}` : '입사일 미등록'}
                    {` · 최종 접속 ${formatLastSignIn(e.lastSignInAt)}`}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap">
                  <button
                    onClick={() => startEdit(e)}
                    className="shrink-0 min-w-[46px] whitespace-nowrap text-xs font-medium px-2.5 py-1.5 rounded-md bg-gray-100 text-gray-600"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => {
                      if (
                        window.confirm(
                          `"${e.name}"님을 비활성화할까요?\n로그인·직원 목록에서 바로 빠지고, 실적 기록은 그대로 안전하게 남아요. 필요하면 나중에 다시 활성화할 수 있어요.`
                        )
                      ) {
                        removeEmployee(e.id);
                      }
                    }}
                    className="shrink-0 w-8 h-8 rounded-md bg-red-50 text-red-500 flex items-center justify-center"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {visibleEmployees.length === 0 && <div className="text-xs text-gray-400 px-4 py-6 text-center">해당 매장에 등록된 직원이 없습니다.</div>}
      </div>

      <button onClick={toggleShowInactive} className="text-xs text-gray-400 underline">
        {showInactive ? '비활성 직원 숨기기' : '비활성화된 직원 보기'}
      </button>
      {showInactive && (
        <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
          {inactiveLoading ? (
            <div className="text-xs text-gray-400 px-4 py-6 text-center">불러오는 중...</div>
          ) : inactiveList.length === 0 ? (
            <div className="text-xs text-gray-400 px-4 py-6 text-center">비활성화된 직원이 없어요.</div>
          ) : (
            inactiveList.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-gray-500">{p.name} · {p.position}</div>
                  <div className="text-[11px] text-gray-400">{p.store_name}</div>
                </div>
                <button onClick={() => reactivate(p.id)} className="text-xs font-medium px-2.5 py-1.5 rounded-md bg-violet-600 text-white">다시 활성화</button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function MobilePointItemsEditor({ items, onChange }) {
  const [newLabel, setNewLabel] = useState('');
  const [newPoint, setNewPoint] = useState('');
  const [newCountsTenure, setNewCountsTenure] = useState(true);

  const updateItem = (idx, patch) => onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const removeItem = (idx) => onChange(items.filter((_, i) => i !== idx));
  const addItem = () => {
    if (!newLabel.trim()) return;
    const key = `custom_${Date.now()}`;
    onChange([...items, { key, label: newLabel.trim(), point: parseFloat(newPoint || '0'), countsTenure: newCountsTenure }]);
    setNewLabel(''); setNewPoint(''); setNewCountsTenure(true);
  };

  return (
    <Section title="모바일 실적 항목 관리" sub={`${items.length}개 항목`} defaultOpen>
      <div className="px-4 pt-3 pb-1 text-[11px] text-gray-400">항목을 직접 추가·삭제·수정할 수 있어요. "근속수당 건수 포함"을 체크하면 이 항목이 근속기간별 건당 지급액 계산에도 반영돼요.</div>
      <div className="divide-y divide-gray-50">
        {items.map((it, idx) => (
          <div key={it.key} className="flex items-center gap-2 px-4 py-2.5 flex-wrap">
            <input value={it.label} onChange={(e) => updateItem(idx, { label: e.target.value })} className="flex-1 min-w-[140px] border border-gray-200 rounded-lg px-2 py-1 text-sm" />
            <div className="flex items-center gap-1">
              <input type="number" step="0.1" value={it.point} onChange={(e) => updateItem(idx, { point: parseFloat(e.target.value || '0') })} className="w-16 text-right border border-gray-200 rounded-lg px-1.5 py-1 text-sm" />
              <span className="text-xs text-gray-400">P</span>
            </div>
            <label className="flex items-center gap-1 text-xs text-gray-500">
              <input type="checkbox" checked={it.countsTenure !== false} onChange={(e) => updateItem(idx, { countsTenure: e.target.checked })} className="w-3.5 h-3.5" />
              근속수당 건수 포함
            </label>
            <button onClick={() => removeItem(idx)} className="w-7 h-7 rounded-md bg-red-50 text-red-500 flex items-center justify-center"><Trash2 size={13} /></button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 flex-wrap px-4 py-3 bg-gray-50">
        <input placeholder="새 항목명 (예: 기변(신규정책))" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} className="flex-1 min-w-[140px] border border-gray-200 rounded-lg px-2 py-1.5 text-sm" />
        <div className="flex items-center gap-1">
          <input type="number" step="0.1" placeholder="포인트" value={newPoint} onChange={(e) => setNewPoint(e.target.value)} className="w-20 text-right border border-gray-200 rounded-lg px-1.5 py-1.5 text-sm" />
          <span className="text-xs text-gray-400">P</span>
        </div>
        <label className="flex items-center gap-1 text-xs text-gray-500">
          <input type="checkbox" checked={newCountsTenure} onChange={(e) => setNewCountsTenure(e.target.checked)} className="w-3.5 h-3.5" />
          근속수당 포함
        </label>
        <button onClick={addItem} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold"><Plus size={14} /> 항목 추가</button>
      </div>
    </Section>
  );
}

function KpiItemsEditor({ items, onChange }) {
  const [newLabel, setNewLabel] = useState('');
  const [newPoint, setNewPoint] = useState('');

  const updateItem = (idx, patch) => onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const removeItem = (idx) => onChange(items.filter((_, i) => i !== idx));
  const addItem = () => {
    if (!newLabel.trim()) return;
    const key = `kpi_custom_${Date.now()}`;
    onChange([...items, { key, label: newLabel.trim(), point: parseFloat(newPoint || '0') }]);
    setNewLabel(''); setNewPoint('');
  };

  return (
    <Section title="개인 KPI 생산성 항목 관리" sub={`${items.length}개 항목`}>
      <div className="px-4 pt-3 pb-1 text-[11px] text-gray-400">인센티브 금액에는 반영되지 않는 참고용 생산성 점수예요. 항목을 직접 추가·삭제·수정할 수 있어요.</div>
      <div className="divide-y divide-gray-50">
        {items.map((it, idx) => (
          <div key={it.key} className="flex items-center gap-2 px-4 py-2.5 flex-wrap">
            <input value={it.label} onChange={(e) => updateItem(idx, { label: e.target.value })} className="flex-1 min-w-[140px] border border-gray-200 rounded-lg px-2 py-1 text-sm" />
            <div className="flex items-center gap-1">
              <input type="number" step="0.1" value={it.point} onChange={(e) => updateItem(idx, { point: parseFloat(e.target.value || '0') })} className="w-16 text-right border border-gray-200 rounded-lg px-1.5 py-1 text-sm" />
              <span className="text-xs text-gray-400">P</span>
            </div>
            <button onClick={() => removeItem(idx)} className="w-7 h-7 rounded-md bg-red-50 text-red-500 flex items-center justify-center"><Trash2 size={13} /></button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 flex-wrap px-4 py-3 bg-gray-50">
        <input placeholder="새 항목명" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} className="flex-1 min-w-[140px] border border-gray-200 rounded-lg px-2 py-1.5 text-sm" />
        <div className="flex items-center gap-1">
          <input type="number" step="0.1" placeholder="포인트" value={newPoint} onChange={(e) => setNewPoint(e.target.value)} className="w-20 text-right border border-gray-200 rounded-lg px-1.5 py-1.5 text-sm" />
          <span className="text-xs text-gray-400">P</span>
        </div>
        <button onClick={addItem} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold"><Plus size={14} /> 항목 추가</button>
      </div>
    </Section>
  );
}

function CategoryMapEditor({ map, mobilePointItems, kpiItems, onChange }) {
  const update = (idx, field, value) => {
    const next = map.map((m, i) => (i === idx ? { ...m, [field]: value } : m));
    onChange(next);
  };
  return (
    <Section title="가입구분 ↔ 성과포인트 / KPI 매핑" sub="일일입력 자동 연결 기준" defaultOpen>
      <div className="px-4 pt-3 pb-1 text-[11px] text-gray-400">직원이 일일입력 탭에서 이 가입구분에 건수를 넣으면, 아래 지정한 성과포인트 항목과 KPI 항목에 그 건수가 자동으로 더해져요. 기변A/B/C는 타겟 상관없이 요금제군 기준으로 성과포인트가 배분되므로 아래 "기변 요금제군별 매핑" 표를 따로 사용해요.</div>
      <div className="divide-y divide-gray-50">
        {MATRIX_ROW_DEFS.map((rowDef, idx) => (
          <div key={rowDef.label} className="flex items-center gap-2 px-4 py-2.5 flex-wrap">
            <span className="text-sm text-gray-700 min-w-[110px]">{rowDef.label}</span>
            {rowDef.isGibyeon ? (
              <span className="text-xs text-gray-400 flex-1 min-w-[130px]">성과포인트: 요금제군별 매핑 사용</span>
            ) : (
              <select value={map[idx]?.mobilePointKey || ''} onChange={(e) => update(idx, 'mobilePointKey', e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 flex-1 min-w-[130px]">
                <option value="">성과포인트 미연결</option>
                {mobilePointItems.map((it) => <option key={it.key} value={it.key}>{it.label}</option>)}
              </select>
            )}
            <select value={map[idx]?.kpiKey || ''} onChange={(e) => update(idx, 'kpiKey', e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 flex-1 min-w-[130px]">
              <option value="">KPI 미연결</option>
              {kpiItems.map((it) => <option key={it.key} value={it.key}>{it.label}</option>)}
            </select>
          </div>
        ))}
      </div>
    </Section>
  );
}

function GibyeonColumnMapEditor({ colMap, mobilePointItems, onChange }) {
  const update = (ci, value) => onChange(colMap.map((v, i) => (i === ci ? value : v)));
  return (
    <Section title="기변 요금제군별 성과포인트 매핑" sub="기변A/B/C 공통 적용 (타겟 무관)">
      <div className="px-4 pt-3 pb-1 text-[11px] text-gray-400">기변A/B/C 중 어느 행에 입력해도, 고른 요금제군에 따라 여기 지정한 성과포인트 항목으로 자동 배분돼요.</div>
      <div className="divide-y divide-gray-50">
        {MATRIX_COLS.map((col, ci) => (
          <div key={col} className="flex items-center gap-2 px-4 py-2.5 flex-wrap">
            <span className="text-sm text-gray-700 min-w-[150px]">{col}</span>
            <select value={colMap[ci] || ''} onChange={(e) => update(ci, e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 flex-1 min-w-[130px]">
              <option value="">미연결</option>
              {mobilePointItems.map((it) => <option key={it.key} value={it.key}>{it.label}</option>)}
            </select>
          </div>
        ))}
      </div>
    </Section>
  );
}

const ROLE_LABELS = { employee: '일반 직원', manager: '매니저(관리자 권한)', admin: '전체 관리자' };

function PermissionsManager({ employees }) {
  const [rolesById, setRolesById] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState('');
  const [nameQuery, setNameQuery] = useState('');

  const [autoPositions, setAutoPositions] = useState(['점장', '부점장', '담당']);
  const [autoSaving, setAutoSaving] = useState(false);

  useEffect(() => {
    setRolesById(Object.fromEntries(employees.map((e) => [e.id, e.role || 'employee'])));
  }, [employees]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('app_config').select('value').eq('config_key', 'auto_manager_positions').maybeSingle();
      if (!error && Array.isArray(data?.value)) setAutoPositions(data.value);
    })();
  }, []);

  const saveRole = async (id, role) => {
    setSavingId(id);
    setError('');
    const { error } = await supabase.from('profiles').update({ role }).eq('id', id);
    if (error) { console.error('ROLE SAVE ERROR:', error); setError(friendlyError(error)); }
    setSavingId(null);
  };

  const toggleAutoPosition = async (p) => {
    const next = autoPositions.includes(p) ? autoPositions.filter((x) => x !== p) : [...autoPositions, p];
    setAutoPositions(next);
    setAutoSaving(true);
    const { error } = await supabase.from('app_config').upsert({ config_key: 'auto_manager_positions', value: next }, { onConflict: 'config_key' });
    if (error) { console.error('AUTO POSITIONS SAVE ERROR:', error); setError(friendlyError(error)); }
    setAutoSaving(false);
  };

  const visible = employees.filter((e) => !nameQuery.trim() || e.name.includes(nameQuery.trim()));

  return (
    <div className="max-w-2xl space-y-4">
      <div className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3 flex gap-2">
        <Info size={13} className="shrink-0 mt-0.5" />
        이 화면은 전체 관리자(사장님)만 볼 수 있어요. 실수로 다른 사람에게 전체 관리자 권한을 주지 않도록 주의해주세요.
      </div>

      <Section title="가입 승인시 자동으로 매니저 권한 부여할 직급" defaultOpen>
        <div className="px-4 py-3 text-[11px] text-gray-400">체크된 직급으로 가입 신청한 사람을 승인하면, 별도 조작 없이 자동으로 매니저(관리자) 권한이 붙어요.</div>
        <div className="px-4 pb-4 flex flex-wrap gap-2">
          {POSITIONS.map((p) => (
            <button key={p} onClick={() => toggleAutoPosition(p)} disabled={autoSaving}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border ${autoPositions.includes(p) ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-500 border-gray-200'}`}>
              {p}
            </button>
          ))}
        </div>
      </Section>

      <Section title="직원별 권한 직접 변경" sub={`${employees.length}명`} defaultOpen>
        <div className="px-4 pt-3 pb-2">
          <input placeholder="이름 검색" value={nameQuery} onChange={(e) => setNameQuery(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white w-32" />
        </div>
        <div className="divide-y divide-gray-50">
          {visible.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-800 truncate">{e.name} <span className="text-gray-400 font-normal">· {e.position} · {displayStoreName(e.branch)}</span></div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <select
                  value={rolesById[e.id] || 'employee'}
                  onChange={(ev) => setRolesById({ ...rolesById, [e.id]: ev.target.value })}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5"
                >
                  {Object.entries(ROLE_LABELS).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                </select>
                <button
                  onClick={() => saveRole(e.id, rolesById[e.id])}
                  disabled={savingId === e.id || (rolesById[e.id] || 'employee') === (e.role || 'employee')}
                  className="text-xs font-medium px-2.5 py-1.5 rounded-md bg-violet-600 text-white disabled:opacity-40"
                >
                  {savingId === e.id ? <Loader2 size={13} className="animate-spin" /> : '저장'}
                </button>
              </div>
            </div>
          ))}
          {visible.length === 0 && <div className="text-xs text-gray-400 px-4 py-6 text-center">검색 결과가 없어요.</div>}
        </div>
      </Section>

      {error && <div className="text-xs text-red-600 bg-red-50 rounded-lg p-3">{error}</div>}
    </div>
  );
}

function RatesManager({ config, persistConfig }) {
  const [draft, setDraftCfg] = useState(config);
  useEffect(() => setDraftCfg(config), [config]);
  const save = () => persistConfig(draft);

  const updateFlatTable = (group, idx, field, val) => {
    const next = { ...draft, [group]: draft[group].map((t, i) => (i === idx ? { ...t, [field]: val } : t)) };
    setDraftCfg(next);
  };
  const updateMatrix = (ri, ci, val) => {
    const next = draft.matrix.map((row) => [...row]);
    next[ri][ci] = val;
    setDraftCfg({ ...draft, matrix: next });
  };

  return (
    <div className="max-w-3xl space-y-4">
      <div className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3">항목을 수정한 뒤 맨 아래 "저장" 버튼을 눌러야 모든 직원 화면에 반영돼요.</div>

      <MobilePointItemsEditor items={draft.mobilePointItems} onChange={(items) => setDraftCfg({ ...draft, mobilePointItems: items })} />

      <KpiItemsEditor items={draft.kpiItems} onChange={(items) => setDraftCfg({ ...draft, kpiItems: items })} />

      <CategoryMapEditor map={draft.categoryMap} mobilePointItems={draft.mobilePointItems} kpiItems={draft.kpiItems}
        onChange={(m) => setDraftCfg({ ...draft, categoryMap: m })} />

      <GibyeonColumnMapEditor colMap={draft.gibyeonColumnMap} mobilePointItems={draft.mobilePointItems}
        onChange={(m) => setDraftCfg({ ...draft, gibyeonColumnMap: m })} />

      <Section title="영업 활동 지원금" defaultOpen>
        <div className="p-3 grid grid-cols-2 gap-2">
          {POSITIONS.map((p) => (
            <div key={p} className="flex items-center justify-between gap-2">
              <span className="text-sm text-gray-600">{p}</span>
              <input type="number" value={draft.basePay[p]} onChange={(e) => setDraftCfg({ ...draft, basePay: { ...draft.basePay, [p]: parseInt(e.target.value || '0', 10) } })} className="w-28 text-right border border-gray-200 rounded-lg px-2 py-1 text-sm" />
            </div>
          ))}
        </div>
      </Section>

      <Section title="직급별 직책수당">
        <div className="p-3 text-[11px] text-gray-400">영업 활동 지원금(직급 보장) 초과 여부 계산에 합산돼요.</div>
        <div className="p-3 pt-0 grid grid-cols-2 gap-2">
          {POSITIONS.map((p) => (
            <div key={p} className="flex items-center justify-between gap-2">
              <span className="text-sm text-gray-600">{p}</span>
              <input type="number" value={draft.positionAllowance?.[p] || 0} onChange={(e) => setDraftCfg({ ...draft, positionAllowance: { ...draft.positionAllowance, [p]: parseInt(e.target.value || '0', 10) } })} className="w-28 text-right border border-gray-200 rounded-lg px-2 py-1 text-sm" />
            </div>
          ))}
        </div>
      </Section>

      <RateTable title="근속기간별 건당 지급액" group="tenure" data={draft.tenure} updateFlatTable={updateFlatTable} field="rate" />
      <RateTable title="성과등급 보너스" group="grades" data={draft.grades} updateFlatTable={updateFlatTable} field="bonus" labelKey="grade" extraField="min" />
      <RateTable title="홈 그레이드 (누적건수별)" group="homeTiers" data={draft.homeTiers} updateFlatTable={updateFlatTable} field="rate" labelKey="min" labelSuffix="건 이상" />
      <RateTable title="홈 단독 / TV프리 / 스마트홈" group="homeFlat" data={draft.homeFlat} updateFlatTable={updateFlatTable} field="rate" />
      <RateTable title="동시판매 수수료" group="homeAddon" data={draft.homeAddon} updateFlatTable={updateFlatTable} field="rate" />
      <RateTable title="홈 재약정" group="renew" data={draft.renew} updateFlatTable={updateFlatTable} field="rate" />
      <RateTable title="VAS" group="vas" data={draft.vas} updateFlatTable={updateFlatTable} field="rate" />
      <RateTable title="2ND 번들" group="bundle2nd" data={draft.bundle2nd} updateFlatTable={updateFlatTable} field="rate" />
      <RateTable title="소노" group="sono" data={draft.sono} updateFlatTable={updateFlatTable} field="rate" />
      <RateTable title="중고MNP 결합" group="mnpBundle" data={draft.mnpBundle} updateFlatTable={updateFlatTable} field="rate" />
      <RateTable title="고객등록 구간 보너스" group="custRegTiers" data={draft.custRegTiers} updateFlatTable={updateFlatTable} field="bonus" labelKey="min" labelSuffix="건 이상" />
      <RateTable title="맞춤제안 구간 보너스" group="tailoredTiers" data={draft.tailoredTiers} updateFlatTable={updateFlatTable} field="bonus" labelKey="min" labelSuffix="건 이상" />

      <Section title="요금제 유치 수수료">
        <div className="overflow-x-auto p-2">
          <table className="text-xs">
            <thead><tr><th className="p-1 text-left sticky left-0 bg-white">가입구분</th>{MATRIX_COLS.map((c) => <th key={c} className="p-1 text-gray-400"><ColHeader label={c} /></th>)}</tr></thead>
            <tbody>
              {MATRIX_ROW_DEFS.map((rowDef, ri) => (
                <tr key={rowDef.label} className="border-t border-gray-50">
                  <td className="p-1 whitespace-nowrap sticky left-0 bg-white">{rowDef.label}</td>
                  {rowDef.hasTiers ? (
                    MATRIX_COLS.map((c, ci) => (
                      <td key={c} className="p-1">
                        <input type="number" value={draft.matrix[ri][ci]} onChange={(e) => updateMatrix(ri, ci, parseInt(e.target.value || '0', 10))} className="w-16 text-center border border-gray-200 rounded px-1 py-1" />
                      </td>
                    ))
                  ) : (
                    <td className="p-1" colSpan={MATRIX_COLS.length}>
                      <div className="flex items-center gap-1.5">
                        <input type="number" value={draft.matrix[ri][0]} onChange={(e) => updateMatrix(ri, 0, parseInt(e.target.value || '0', 10))} className="w-24 text-right border border-gray-200 rounded px-1.5 py-1" />
                        <span className="text-gray-400">원 / 건 (요금제군 구분 없음)</span>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <button onClick={save} className="px-4 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold">지급 기준 저장</button>
    </div>
  );
}

function RateTable({ title, group, data, updateFlatTable, field, labelKey, labelSuffix, extraField }) {
  return (
    <Section title={title}>
      <div className="divide-y divide-gray-50">
        {data.map((t, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-2.5 gap-2">
            <span className="text-sm text-gray-700">{labelKey ? `${t[labelKey]}${labelSuffix || ''}` : t.label}</span>
            <div className="flex items-center gap-1">
              {extraField && (
                <input type="number" value={t[extraField]} onChange={(e) => updateFlatTable(group, i, extraField, parseFloat(e.target.value || '0'))} className="w-16 text-right border border-gray-200 rounded px-1.5 py-1 text-xs" title={extraField} />
              )}
              <input type="number" value={t[field]} onChange={(e) => updateFlatTable(group, i, field, parseInt(e.target.value || '0', 10))} className="w-24 text-right border border-gray-200 rounded px-1.5 py-1 text-sm" />
              <span className="text-xs text-gray-400">원</span>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function StatCard({ label, value, icon: Icon, accent }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-center gap-1.5 text-gray-400 text-xs mb-1"><Icon size={13} /> {label}</div>
      <div className={`text-xl font-bold ${accent ? 'text-amber-600' : 'text-gray-800'}`}>{value}</div>
    </div>
  );
}
