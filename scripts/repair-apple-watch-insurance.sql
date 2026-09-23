-- One-time, idempotent repair. Existing audit triggers retain old and new rows.
-- Caller wraps this script in a transaction; daily rows and sales are locked.
DO $$
declare d record; amount numeric;
begin
  perform 1 from public.customer_sales s where s.sale_date between '2026-09-01' and '2026-09-30'
    and s.source_meta->'bundle2ndKeys' ? 'b_AppleWatch' for update;
  for d in select dr.* from public.daily_records dr where exists (
    select 1 from public.customer_sales s where s.user_id=dr.user_id and s.sale_date=dr.work_date
      and s.sale_date between '2026-09-01' and '2026-09-30'
      and s.source_meta->'bundle2ndKeys' ? 'b_AppleWatch'
      and s.source_meta->'bundleVasMap'->'b_AppleWatch' ? 'vasNone'
      and s.source_meta->>'ci'='0' and coalesce(s.source_meta->>'teamOnly','false')<>'true'
      and not (s.source_meta ? 'appleInsuranceRepair20260923')) for update
  loop
    select sum(case when s.source_meta->'bundleSaleTypeMap'->>'b_AppleWatch'='discount'
      then least(20000,coalesce((s.source_meta->'policySnapshot'->'bundleRates'->>'b_AppleWatch')::numeric,150000))
      else coalesce((s.source_meta->'policySnapshot'->'bundleRates'->>'b_AppleWatch')::numeric,150000) end)
    into amount from public.customer_sales s where s.user_id=d.user_id and s.sale_date=d.work_date
      and s.source_meta->'bundle2ndKeys' ? 'b_AppleWatch'
      and s.source_meta->'bundleVasMap'->'b_AppleWatch' ? 'vasNone'
      and s.source_meta->>'ci'='0' and coalesce(s.source_meta->>'teamOnly','false')<>'true'
      and not (s.source_meta ? 'appleInsuranceRepair20260923');
    if coalesce((d.data->>'bundleFreeOffset')::numeric,0)<amount then raise exception 'Apple repair offset mismatch'; end if;
    update public.daily_records set data=jsonb_set(data,'{bundleFreeOffset}',to_jsonb((data->>'bundleFreeOffset')::numeric-amount)) where id=d.id;
    update public.customer_sales s set source_meta=source_meta||jsonb_build_object('appleInsuranceRepair20260923',true)
    where s.user_id=d.user_id and s.sale_date=d.work_date
      and s.source_meta->'bundle2ndKeys' ? 'b_AppleWatch'
      and s.source_meta->'bundleVasMap'->'b_AppleWatch' ? 'vasNone'
      and s.source_meta->>'ci'='0' and coalesce(s.source_meta->>'teamOnly','false')<>'true'
      and not (s.source_meta ? 'appleInsuranceRepair20260923');
  end loop;
end $$;
