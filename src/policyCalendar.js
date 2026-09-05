import { CURRENT_POLICY_VERSION } from './policyEngine.js';
import {
  SEPTEMBER_POLICY_MONTH,
  SEPTEMBER_POLICY_VERSION,
  septemberConfig,
} from './septemberPolicy.js';

export const POLICY_HISTORY_CONFIG_KEY = 'policy_history_v1';

export const BUILTIN_POLICY_PERIODS = Object.freeze([
  Object.freeze({
    version: CURRENT_POLICY_VERSION,
    effectiveFrom: '0000-01-01',
    strategy: 'snapshot',
    baseVersion: CURRENT_POLICY_VERSION,
  }),
  Object.freeze({
    version: SEPTEMBER_POLICY_VERSION,
    effectiveFrom: `${SEPTEMBER_POLICY_MONTH}-01`,
    strategy: 'september-v1',
    baseVersion: CURRENT_POLICY_VERSION,
  }),
]);

function normalizedDate(value = '') {
  const text = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (/^\d{4}-\d{2}$/.test(text)) return `${text}-01`;
  return '0000-01-01';
}

export function policyPeriodFor(value = '') {
  const date = normalizedDate(value);
  return [...BUILTIN_POLICY_PERIODS]
    .reverse()
    .find(period => date >= period.effectiveFrom) || BUILTIN_POLICY_PERIODS[0];
}

export function isSeptemberPolicyActive(value = '') {
  return policyPeriodFor(value).version === SEPTEMBER_POLICY_VERSION;
}

export function resolvePolicyConfigForMonth(month, legacyConfig = {}, history = null) {
  const period = policyPeriodFor(month);
  const frozenBase = history?.baseSnapshots?.[period.baseVersion]
    || history?.base_snapshots?.[period.baseVersion]
    || legacyConfig;
  const base = { ...legacyConfig, ...(frozenBase || {}) };

  if (period.strategy === 'september-v1') return septemberConfig(base);
  return { ...base, policyVersion: period.version };
}

function currentLocalMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function isPolicyConfigReadOnly(month, currentMonth = currentLocalMonth()) {
  return String(month || '') < String(currentMonth || '') || isSeptemberPolicyActive(month);
}
