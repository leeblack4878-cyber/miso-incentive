begin;

-- Auth의 last_sign_in_at은 기존 세션으로 앱을 다시 여는 경우 갱신되지 않으므로
-- 실제 앱 사용 시각을 별도 보관합니다.
create table if not exists public.app_user_access (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  last_accessed_at timestamptz not null default now()
);

alter table public.app_user_access enable row level security;
revoke all on table public.app_user_access from public, anon, authenticated;

create or replace function public.touch_app_access()
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  touched_at timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  insert into public.app_user_access(user_id, last_accessed_at)
  values (auth.uid(), touched_at)
  on conflict (user_id) do update
    set last_accessed_at = excluded.last_accessed_at;

  return touched_at;
end;
$$;

revoke all on function public.touch_app_access() from public, anon;
grant execute on function public.touch_app_access() to authenticated;

create or replace function public.get_last_sign_ins()
returns table(id uuid, last_sign_in_at timestamptz)
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select p.id,
         greatest(a.last_accessed_at, u.last_sign_in_at) as last_sign_in_at
    from public.profiles p
    left join public.app_user_access a on a.user_id = p.id
    left join auth.users u on u.id = p.id
   where auth.uid() is not null
     and p.active is true
     and public.is_admin()
     and (p.id = auth.uid() or public.can_view_profile(p.store_name));
$$;

revoke all on function public.get_last_sign_ins() from public, anon;
grant execute on function public.get_last_sign_ins() to authenticated;

-- 관리자에게도 기존 can_view_profile 범위만큼만 직원 개인 목표를 제공합니다.
create or replace function public.get_scoped_monthly_goals(target_month text)
returns table(user_id uuid, goals jsonb, updated_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select g.user_id, g.goals, g.updated_at
    from public.monthly_goals g
    join public.profiles p on p.id = g.user_id
   where auth.uid() is not null
     and public.is_admin()
     and p.active is true
     and g.month = target_month
     and (p.id = auth.uid() or public.can_view_profile(p.store_name));
$$;

revoke all on function public.get_scoped_monthly_goals(text) from public, anon;
grant execute on function public.get_scoped_monthly_goals(text) to authenticated;

comment on table public.app_user_access is
  'Tracks real app opens/resumes because auth.users.last_sign_in_at only changes on authentication.';
comment on function public.get_scoped_monthly_goals(text) is
  'Returns employee personal goals only inside the caller existing profile visibility scope.';

commit;
