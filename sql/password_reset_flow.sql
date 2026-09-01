alter table public.profiles add column if not exists must_change_password boolean not null default false;
create table if not exists public.password_reset_requests (
  id uuid primary key default gen_random_uuid(), target_user_id uuid not null references public.profiles(id) on delete cascade,
  requested_email text not null, status text not null default 'pending' check (status in ('pending','issued','rejected','completed')),
  requested_at timestamptz not null default now(), reviewed_by uuid references public.profiles(id), reviewed_at timestamptz, completed_at timestamptz
);
create index if not exists password_reset_requests_status_time_idx on public.password_reset_requests(status,requested_at desc);
alter table public.password_reset_requests enable row level security;
revoke all on table public.password_reset_requests from anon;
grant select on table public.password_reset_requests to authenticated;
drop policy if exists "password_reset_requests_admin_select" on public.password_reset_requests;
create policy "password_reset_requests_admin_select" on public.password_reset_requests for select to authenticated
using ((select auth.uid())='a50a0979-acef-40b1-98b7-f05074f1c835'::uuid);
