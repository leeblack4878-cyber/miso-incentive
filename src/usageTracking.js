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
