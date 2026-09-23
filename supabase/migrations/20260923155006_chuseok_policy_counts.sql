-- Only scoped payout counts are returned. Store totals include inactive sellers
-- and are anonymous; no other seller or customer information is exposed.
create or replace function private.chuseok_policy_counts(p_month text)
returns table(user_id uuid,store_name text,mobile_count numeric,internet_count bigint,tv_count bigint,store_mobile numeric,store_internet numeric,store_tv numeric)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.profiles p where p.id=auth.uid() and p.active is true and p.status='approved') then
   raise exception 'approved active profile required'; end if;
 if p_month <> '2026-09' then return; end if;
 return query
 with mobile as (
   select d.user_id,sum(coalesce((cell.value #>> '{}')::numeric,0)) n
   from public.daily_records d
   cross join lateral jsonb_array_elements(coalesce(d.data->'matrix','[]'::jsonb)) with ordinality r(value,idx)
   cross join lateral jsonb_array_elements(r.value) cell
   where d.work_date between date '2026-09-22' and date '2026-09-28' and r.idx between 1 and 6
   group by d.user_id
 ), home_units as (
   select o.*,coalesce(t.credited_store,p.store_name) policy_store,t.id is not null team_only
   from public.home_orders o join public.profiles p on p.id=o.user_id
   left join public.team_sales_credits t on t.source_type='home' and t.source_refs ? o.id::text
   where o.status='completed'
    and o.source_work_date between date '2026-09-22' and date '2026-09-28'
    and o.actual_install_date between date '2026-09-01' and date '2026-09-30'
 ), homes as (
   select o.user_id,
    count(distinct (o.source_work_date,coalesce(o.customer_id::text,o.customer_name,o.id::text))) filter(where o.product_type in ('internet100','internet500','internet1g','homeOnly','homeTv')) internet_n,
    count(*) filter(where o.product_type='tvFree' and coalesce(o.network_type,'household')<>'soho') tv_n
   from home_units o where not o.team_only group by o.user_id
 ), store_homes as (
   select o.policy_store,
    count(distinct (o.user_id,o.source_work_date,coalesce(o.customer_id::text,o.customer_name,o.id::text))) filter(where o.product_type in ('internet100','internet500','internet1g','homeOnly','homeTv')) internet_n,
    count(*) filter(where o.product_type='tvFree' and coalesce(o.network_type,'household')<>'soho') tv_n
   from home_units o group by o.policy_store
 ), members as (
   select p.id,p.store_name,coalesce(m.n,0) mobile_n,coalesce(h.internet_n,0) internet_n,coalesce(h.tv_n,0) tv_n
   from public.profiles p left join mobile m on m.user_id=p.id left join homes h on h.user_id=p.id
   where p.status='approved'
 ), team as (
   select t.credited_store,sum(coalesce((cell.value #>> '{}')::numeric,0)) n
   from public.team_sales_credits t
   cross join lateral jsonb_array_elements(coalesce(t.metrics->'matrix','[]'::jsonb)) with ordinality r(value,idx)
   cross join lateral jsonb_array_elements(r.value) cell
   where t.sale_date between date '2026-09-22' and date '2026-09-28' and r.idx between 1 and 6
   group by t.credited_store
 ), totals as (
   select m.store_name,sum(m.mobile_n)+coalesce(max(t.n),0) mobile_n,coalesce(max(h.internet_n),0)::numeric internet_n,coalesce(max(h.tv_n),0)::numeric tv_n
   from members m left join team t on t.credited_store=m.store_name left join store_homes h on h.policy_store=m.store_name group by m.store_name
 )
 select m.id,m.store_name,m.mobile_n,m.internet_n,m.tv_n,t.mobile_n,t.internet_n,t.tv_n
 from members m join totals t on t.store_name=m.store_name
 where m.id=auth.uid() or public.can_view_profile(m.store_name);
end $$;
revoke all on function private.chuseok_policy_counts(text) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.chuseok_policy_counts(text) to authenticated;
create or replace function public.chuseok_policy_counts(p_month text)
returns table(user_id uuid,store_name text,mobile_count numeric,internet_count bigint,tv_count bigint,store_mobile numeric,store_internet numeric,store_tv numeric)
language sql stable security invoker set search_path='' as $$select * from private.chuseok_policy_counts(p_month)$$;
revoke all on function public.chuseok_policy_counts(text) from public,anon;
grant execute on function public.chuseok_policy_counts(text) to authenticated;
