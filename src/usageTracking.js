import { supabase } from './supabase.js';

const APP_USAGE_VERSION = '2026-09-usage-v1';
const DEDUPE_MS = 30_000;
const SAFE_KEY = /^[a-z0-9_-]{1,80}$/;

export function usageEventPayload({ userId, role, screenKey, featureKey = null } = {}) {
  if (!userId || !SAFE_KEY.test(String(screenKey || ''))) return null;
  if (featureKey && !SAFE_KEY.test(String(featureKey))) return null;
  return {
    user_id: userId,
    event_type: featureKey ? 'feature_use' : 'screen_view',
    role: role === 'manager' ? 'manager' : 'employee',
    screen_key: screenKey,
    feature_key: featureKey || null,
    app_version: APP_USAGE_VERSION,
  };
}

export async function trackUsageEvent(input = {}) {
  const payload = usageEventPayload(input);
  if (!payload) return false;
  const dedupeKey = `miso-usage:${payload.user_id}:${payload.role}:${payload.screen_key}:${payload.feature_key || 'view'}`;
  try {
    const now = Date.now();
    const previous = Number(sessionStorage.getItem(dedupeKey) || 0);
    if (now - previous < DEDUPE_MS) return false;
    sessionStorage.setItem(dedupeKey, String(now));
    const { error } = await supabase.from('app_usage_events').insert(payload);
    if (error) throw error;
    return true;
  } catch (error) {
    console.warn('USAGE TRACKING ERROR', error);
    return false;
  }
}

const EMPLOYEE_SCREENS = {
  '홈': 'home',
  '실적입력': 'daily',
  '고객관리': 'customer_care',
  '평가': 'evaluation',
  '내역': 'history',
};

const MANAGER_SCREENS = {
  '대시보드': 'dashboard',
  '실적 순위': 'performance',
  '평가': 'evaluation',
  '매장 목표': 'store_goals',
  '실적 점검': 'performance_approval',
  '변경 이력': 'history',
  '고객 관리': 'customer_care',
  '홈 케어': 'home_care',
  '영업비용/오퍼': 'expenses',
  '스팟 승인': 'spot',
  '직원 관리': 'employees',
  '본사 데이터': 'head_office_data',
  '정산 검토': 'settlement',
  '계산 검증': 'calculation_audit',
  '지급기준 관리': 'rates',
  '권한 관리': 'permissions',
};

export function startUsageTracking({ userId, role }) {
  const manager = role === 'manager';
  const screens = manager ? MANAGER_SCREENS : EMPLOYEE_SCREENS;
  trackUsageEvent({ userId, role, screenKey: manager ? 'manager_dashboard' : 'employee_home' });

  const onClick = (event) => {
    const button = event.target?.closest?.('button');
    if (!button) return;
    const label = String(button.textContent || '').replace(/\s+/g, ' ').trim();
    const key = screens[label];
    if (!key) return;
    trackUsageEvent({ userId, role, screenKey: `${manager ? 'manager' : 'employee'}_${key}` });
  };

  document.addEventListener('click', onClick, true);
  return () => document.removeEventListener('click', onClick, true);
}
