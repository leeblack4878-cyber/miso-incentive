import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../supabase/migrations/20260908090000_app_access_and_scoped_employee_goals.sql', import.meta.url), 'utf8');

test('records real app access before loading employee last-access rows', () => {
  const touch = app.indexOf("await supabase.rpc('touch_app_access')");
  const load = app.indexOf('const list = await loadEmployees()', touch);
  assert.ok(touch >= 0 && load > touch);
  assert.match(migration, /greatest\(a\.last_accessed_at, u\.last_sign_in_at\)/);
});

test('scoped goal RPC preserves existing profile visibility boundary', () => {
  assert.match(migration, /public\.is_admin\(\)/);
  assert.match(migration, /public\.can_view_profile\(p\.store_name\)/);
  assert.doesNotMatch(migration, /grant select on (table )?public\.monthly_goals/i);
});

test('manager employee list loads and renders monthly employee goals', () => {
  assert.match(app, /get_scoped_monthly_goals/);
  assert.match(app, /<EmployeeGoalSummary month=\{month\} entry=\{employeeGoalMap\[e\.id\]\}/);
  assert.match(app, /목표 새로고침/);
});
