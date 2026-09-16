export function readEnvironment(env = process.env) {
  const names = ['E2E_SUPABASE_URL', 'E2E_SUPABASE_PUBLIC_KEY', 'E2E_SUPABASE_SERVICE_KEY',
    'E2E_ALLOWED_PROJECT_REF', 'E2E_EMPLOYEE_EMAIL', 'E2E_EMPLOYEE_PASSWORD',
    'E2E_OTHER_EMAIL', 'E2E_OTHER_PASSWORD'];
  const missing = names.filter(name => !env[name]);
  if (missing.length) throw new Error(`E2E configuration missing: ${missing.join(', ')}`);
  const url = new URL(env.E2E_SUPABASE_URL);
  if (url.hostname === 'ufkxbrzcmncwynvygaak.supabase.co') throw new Error('Production DB is forbidden for E2E');
  if (url.protocol !== 'https:' || url.hostname !== `${env.E2E_ALLOWED_PROJECT_REF}.supabase.co`)
    throw new Error('E2E URL must match the explicitly allowed test project');
  for (const key of ['E2E_EMPLOYEE_EMAIL', 'E2E_OTHER_EMAIL']) {
    if (!/^e2e[+._-].+@example\.test$/.test(env[key])) throw new Error('Dedicated e2e accounts required');
  }
  if (env.E2E_EMPLOYEE_EMAIL === env.E2E_OTHER_EMAIL) throw new Error('Two distinct employee accounts required');
  return { url: url.origin, publicKey: env.E2E_SUPABASE_PUBLIC_KEY, serviceKey: env.E2E_SUPABASE_SERVICE_KEY,
    employee: { email: env.E2E_EMPLOYEE_EMAIL, password: env.E2E_EMPLOYEE_PASSWORD },
    other: { email: env.E2E_OTHER_EMAIL, password: env.E2E_OTHER_PASSWORD } };
}
