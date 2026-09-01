create table if not exists public.hq_structure_monthly_inputs (
  month text primary key check (month ~ '^\\d{4}-\\d{2}$'),
  change_support_ratio numeric(6,2) not null default 0 check (change_support_ratio between 0 and 100),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

alter table public.hq_structure_monthly_inputs enable row level security;
revoke all on table public.hq_structure_monthly_inputs from anon;
grant select, insert, update on table public.hq_structure_monthly_inputs to authenticated;

drop policy if exists "hq_structure_monthly_inputs_select" on public.hq_structure_monthly_inputs;
create policy "hq_structure_monthly_inputs_select" on public.hq_structure_monthly_inputs for select to authenticated
using (exists (select 1 from public.hq_structure_access a where a.user_id = (select auth.uid())));

drop policy if exists "hq_structure_monthly_inputs_insert_owner" on public.hq_structure_monthly_inputs;
create policy "hq_structure_monthly_inputs_insert_owner" on public.hq_structure_monthly_inputs for insert to authenticated
with check ((select auth.uid()) = 'a50a0979-acef-40b1-98b7-f05074f1c835'::uuid and updated_by = (select auth.uid()));

drop policy if exists "hq_structure_monthly_inputs_update_owner" on public.hq_structure_monthly_inputs;
create policy "hq_structure_monthly_inputs_update_owner" on public.hq_structure_monthly_inputs for update to authenticated
using ((select auth.uid()) = 'a50a0979-acef-40b1-98b7-f05074f1c835'::uuid)
with check ((select auth.uid()) = 'a50a0979-acef-40b1-98b7-f05074f1c835'::uuid and updated_by = (select auth.uid()));
