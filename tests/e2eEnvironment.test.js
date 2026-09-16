import test from 'node:test';
import assert from 'node:assert/strict';
import { readEnvironment } from './e2e/environment.js';
const env={E2E_SUPABASE_URL:'https://test-only.supabase.co',E2E_ALLOWED_PROJECT_REF:'test-only',
  E2E_SUPABASE_PUBLIC_KEY:'public-test-placeholder',E2E_SUPABASE_SERVICE_KEY:'server-test-placeholder',
  E2E_EMPLOYEE_EMAIL:'e2e.owner@example.test',E2E_EMPLOYEE_PASSWORD:'not-a-real-password',
  E2E_OTHER_EMAIL:'e2e.other@example.test',E2E_OTHER_PASSWORD:'not-a-real-password'};
test('E2E refuses production even if explicitly put in project allowlist',()=>{
  assert.throws(()=>readEnvironment({...env,E2E_SUPABASE_URL:'https://ufkxbrzcmncwynvygaak.supabase.co',
    E2E_ALLOWED_PROJECT_REF:'ufkxbrzcmncwynvygaak'}),/Production DB/);
});
test('E2E fails closed for missing credentials and destination mismatch',()=>{
  assert.throws(()=>readEnvironment({}),/configuration missing/);
  assert.throws(()=>readEnvironment({...env,E2E_ALLOWED_PROJECT_REF:'different-project'}),/explicitly allowed/);
});
test('E2E refuses real employee emails and the same account in both roles',()=>{
  assert.throws(()=>readEnvironment({...env,E2E_EMPLOYEE_EMAIL:'employee@company.com'}),/Dedicated/);
  assert.throws(()=>readEnvironment({...env,E2E_OTHER_EMAIL:env.E2E_EMPLOYEE_EMAIL}),/distinct/);
});
test('E2E accepts dedicated accounts on the exact test project',()=>{
  assert.equal(readEnvironment(env).url,'https://test-only.supabase.co');
});
