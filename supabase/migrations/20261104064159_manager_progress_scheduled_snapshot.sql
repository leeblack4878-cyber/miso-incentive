begin;

create table public.manager_progress_latest (
  month text primary key check (month = '2026-11'),
  slot_at timestamptz not null,
  rows jsonb not null check (jsonb_typeof(rows) = 'array')
);
alter table public.manager_progress_latest enable row level security;
revoke all on public.manager_progress_latest from public, anon, authenticated;
grant select on public.manager_progress_latest to service_role;

create function public.save_manager_progress_latest(p_month text, p_slot_at timestamptz, p_rows jsonb)
returns void language sql security definer set search_path='' as $$
  insert into public.manager_progress_latest as current_snapshot (month, slot_at, rows)
  values (p_month, p_slot_at, p_rows)
  on conflict (month) do update set slot_at=excluded.slot_at, rows=excluded.rows
    where current_snapshot.slot_at < excluded.slot_at;
$$;
revoke all on function public.save_manager_progress_latest(text,timestamptz,jsonb) from public, anon, authenticated;
grant execute on function public.save_manager_progress_latest(text,timestamptz,jsonb) to service_role;

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- KST 10:00, 15:00, 21:00. The credentials are provisioned separately in Vault.
select cron.schedule('manager-progress-2026-11', '0 1,6,12 * 11 *', $job$
  select net.http_post(
    url := project.decrypted_secret || '/functions/v1/monthly-ranking',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||credential.decrypted_secret),
    body := '{"view":"capture-manager-progress"}'::jsonb
  )
  from vault.decrypted_secrets project
  cross join vault.decrypted_secrets credential
  where project.name='manager_progress_project_url'
    and credential.name='manager_progress_service_role_key'
    and to_char(now() at time zone 'Asia/Seoul','YYYY-MM')='2026-11'
$job$);

notify pgrst,'reload schema';
commit;
