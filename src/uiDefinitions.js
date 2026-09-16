export const POSITIONS = ['점장', '부점장', '매니저', '사원', '기타'];

export const ROLE_LABELS = { employee: '일반 직원', manager: '매니저(관리자 권한)', admin: '전체 관리자' };

export const DEFAULT_ACTIVITY_SUPPORT_MAX = 2300000;

export const MATRIX_ROW_DEFS = [
  { label: '일반모델 신규', dailyLabel: '신규', hasTiers: true },
  { label: '일반모델 MNP', dailyLabel: 'MNP', hasTiers: true },
  { label: '일반모델 기변A', dailyLabel: '기기변경 A', hasTiers: true, isGibyeon: true },
  { label: '일반모델 기변B', dailyLabel: '기기변경 B', hasTiers: true, isGibyeon: true },
  { label: '일반모델 기변C', dailyLabel: '기기변경 C', hasTiers: true, isGibyeon: true },
  { label: 'SIM MNP', dailyLabel: 'SIM MNP(선약)', hasTiers: true },
  { label: '중고 신규(66군↑)', dailyLabel: '중고 신규(66군 이상)', hasTiers: false }, // 인센티브 무관 — 요금제군 구분 없이 건수만
  { label: '2ND단독', dailyLabel: '2ND단독', hasTiers: false }, // 요금제군 구분 없이 건수만, 단일 단가 적용
];

export const MATRIX_COLS = ['115군↑', '95~105군·청소년85군', '85군', '61군이상', '약자요금제', '그 외'];

export function displayStoreName(name) {
  const value = String(name || '');
  const idx = value.indexOf('_');
  return idx >= 0 ? value.slice(idx + 1) : value;
}

export function fmtNum(n, maxFraction = 0) {
  const num = Number(n || 0);
  if (!Number.isFinite(num)) return '0';
  return num.toLocaleString('ko-KR', { maximumFractionDigits: maxFraction, minimumFractionDigits: 0 });
}

export function fmtInputNumber(v) {
  const digits = String(v ?? '').replace(/\D/g, '');
  return digits ? Number(digits).toLocaleString('ko-KR') : '';
}

export function won(n) { return `${fmtNum(Math.round(Number(n || 0)))}원`; }
