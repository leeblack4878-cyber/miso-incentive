-- AA targets are company-wide: store managers may read but never mutate them.
-- Keep store-confirmed input permissions in manager_eval_monthly unchanged.
drop policy if exists aa_impact_manager_only on public.aa_impact_monthly;
create policy aa_impact_approved_read on public.aa_impact_monthly
for select to authenticated using (
 exists (select 1 from public.profiles p where p.id=auth.uid()
  and p.active=true and p.status='approved' and p.role in ('manager','admin'))
);
create policy aa_impact_admin_write on public.aa_impact_monthly
for all to authenticated using (
 exists (select 1 from public.profiles p where p.id=auth.uid()
  and p.active=true and p.status='approved' and p.role='admin')
) with check (
 exists (select 1 from public.profiles p where p.id=auth.uid()
  and p.active=true and p.status='approved' and p.role='admin')
);

