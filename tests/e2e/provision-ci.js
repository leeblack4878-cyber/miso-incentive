// Dedicated staging fixtures only. Never provision real staff or production.
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { appendFileSync } from 'node:fs';

const ref = 'ahmvrflklvmdprolauuy';
if (process.env.E2E_ALLOWED_PROJECT_REF !== ref || process.env.E2E_SUPABASE_URL !== `https://${ref}.supabase.co`)
  throw new Error('Provisioning requires the dedicated staging project');
if (!process.env.E2E_SUPABASE_SERVICE_KEY || !process.env.GITHUB_ENV)
  throw new Error('Set E2E_SUPABASE_SERVICE_KEY in the home-e2e GitHub environment');
const admin = createClient(process.env.E2E_SUPABASE_URL, process.env.E2E_SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } });
async function ok(request) {
  const { data, error } = await request;
  if (error) throw new Error(`Fixture provisioning failed (${error.code || error.status || 'unknown'})`);
  return data;
}
const users = [];
for (let page = 1; ; page++) {
  const data = await ok(admin.auth.admin.listUsers({ page, perPage: 100 }));
  users.push(...data.users);
  if (data.users.length < 100) break;
}
for (const [suffix, prefix] of [['owner','E2E_EMPLOYEE'],['other','E2E_OTHER']]) {
  const email = `e2e.${suffix}@example.test`;
  const password = randomBytes(32).toString('base64url');
  // GitHub masks these values before any subsequent test process starts.
  process.stdout.write(`::add-mask::${password}\n`);
  let user = users.find(u => u.email === email);
  if (user) {
    if (user.app_metadata?.e2e_fixture !== 'home-bundle-v1') throw new Error('Existing account is not this dedicated fixture');
    const profile = await ok(admin.from('profiles').select('*').eq('id',user.id).single());
    if (profile.name !== `E2E_${suffix}` || profile.store_name !== 'E2E_HOME_REGRESSION' ||
        profile.role !== 'employee' || profile.position !== '사원' || !profile.active || profile.status !== 'approved' ||
        (profile.store_scope && profile.store_scope.length)) throw new Error('Existing fixture profile changed; manual review required');
    for (const table of ['customers','customer_sales','home_orders','customer_tasks','sales_expenses','daily_records','monthly_status']) {
      const rows = await ok(admin.from(table).select('id').eq('user_id',user.id).limit(1));
      if (rows.length) throw new Error('Fixture has leftover business data; manual review required');
    }
    await ok(admin.auth.admin.updateUserById(user.id,{ password }));
  } else {
    const created = await ok(admin.auth.admin.createUser({ email, password, email_confirm: true,
      app_metadata: { e2e_fixture: 'home-bundle-v1' },
      user_metadata: { name: `E2E_${suffix}`, store_name: 'E2E_HOME_REGRESSION', position: '사원' } }));
    user = created.user;
    // Fixture initialization, not an application approval flow test. The production
    // protection trigger rejects role/status UPDATE, so insert a fresh approved fixture.
    // Delete only this just-created profile; never disable its trigger or alter RLS.
    const initial = await ok(admin.from('profiles').select('id,name,role,status').eq('id',user.id).single());
    if (initial.name !== `E2E_${suffix}` || initial.role !== 'employee' || initial.status !== 'pending')
      throw new Error('Unexpected signup profile; manual review required');
    await ok(admin.from('profiles').delete().eq('id',user.id));
    await ok(admin.from('profiles').insert({ id:user.id,name:`E2E_${suffix}`,store_name:'E2E_HOME_REGRESSION',
      role:'employee',position:'사원',active:true,status:'approved',store_scope:[],must_change_password:false }));
  }
  appendFileSync(process.env.GITHUB_ENV, `${prefix}_EMAIL=${email}\n${prefix}_PASSWORD=${password}\n`);
}
console.log('Two dedicated staging employees are ready; credentials remain in the runner environment.');
