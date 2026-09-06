-- Store closeout totals are non-personal aggregate figures shown on employee/admin dashboards.
-- Writes remain admin-only; signed-in users only receive read access.
drop policy if exists head_office_store_performance_admin_select
  on public.head_office_store_performance;

create policy head_office_store_performance_authenticated_select
  on public.head_office_store_performance
  for select
  to authenticated
  using (true);

grant select on public.head_office_store_performance to authenticated;
