create table if not exists public.hq_structure_access (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.hq_structure_access enable row level security;
revoke all on table public.hq_structure_access from anon;
grant select on table public.hq_structure_access to authenticated;

drop policy if exists "hq_structure_access_select_own" on public.hq_structure_access;
create policy "hq_structure_access_select_own"
on public.hq_structure_access
for select
to authenticated
using ((select auth.uid()) = user_id);

insert into public.hq_structure_access (user_id)
values
  ('a50a0979-acef-40b1-98b7-f05074f1c835'),
  ('f0329992-ced4-4407-b71d-ed58c5d74aaf')
on conflict (user_id) do nothing;
