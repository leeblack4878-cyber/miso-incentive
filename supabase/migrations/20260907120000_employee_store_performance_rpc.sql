-- 일반 직원 홈의 매장 탭에서 같은 매장 실적을 합산할 수 있도록,
-- 개인 식별자와 고객 상세를 제거한 일별 성과 데이터만 반환합니다.
create or replace function public.get_my_store_performance_days(p_month text)
returns table(work_date date, data jsonb)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  viewer_id uuid := auth.uid();
  viewer_store text;
  month_start date;
  month_end date;
begin
  if viewer_id is null then
    raise exception 'authentication required';
  end if;

  if p_month is null or p_month !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'invalid month';
  end if;

  select p.store_name
    into viewer_store
    from public.profiles p
   where p.id = viewer_id
     and p.active is true
     and p.status = 'approved';

  if viewer_store is null then
    raise exception 'approved active profile required';
  end if;

  month_start := (p_month || '-01')::date;
  month_end := month_start + interval '1 month';

  return query
  select d.work_date,
         jsonb_build_object(
           'matrix', coalesce(d.data -> 'matrix', '[]'::jsonb),
           'groups', coalesce(d.data -> 'groups', '{}'::jsonb),
           'custRegCount', coalesce(d.data -> 'custRegCount', '0'::jsonb),
           'tailoredCount', coalesce(d.data -> 'tailoredCount', '0'::jsonb),
           'tailoredAmount', coalesce(d.data -> 'tailoredAmount', '0'::jsonb),
           'specialMatrixOffset', coalesce(d.data -> 'specialMatrixOffset', '0'::jsonb),
           'specialVasOffset', coalesce(d.data -> 'specialVasOffset', '0'::jsonb),
           'specialReplacementPay', coalesce(d.data -> 'specialReplacementPay', '0'::jsonb),
           'bundleFreeOffset', coalesce(d.data -> 'bundleFreeOffset', '0'::jsonb),
           'bundleFreeVasOffset', coalesce(d.data -> 'bundleFreeVasOffset', '0'::jsonb),
           'renewSoloDiscountAmount', coalesce(d.data -> 'renewSoloDiscountAmount', '0'::jsonb),
           'householdRenewLegacyCounts', coalesce(d.data -> 'householdRenewLegacyCounts', '{}'::jsonb),
           'householdRenewals', case
             when jsonb_typeof(d.data -> 'householdRenewals') = 'array' then
               coalesce((
                 select jsonb_agg(jsonb_build_object('homeOnly', item ->> 'homeOnly' = 'true'))
                   from jsonb_array_elements(d.data -> 'householdRenewals') item
               ), '[]'::jsonb)
             else '[]'::jsonb
           end
         ) as data
    from public.daily_records d
    join public.profiles member on member.id = d.user_id
   where member.store_name = viewer_store
     and member.active is true
     and member.status = 'approved'
     and d.work_date >= month_start
     and d.work_date < month_end
   order by d.work_date;
end;
$$;

revoke all on function public.get_my_store_performance_days(text) from public;
revoke all on function public.get_my_store_performance_days(text) from anon;
grant execute on function public.get_my_store_performance_days(text) to authenticated;

comment on function public.get_my_store_performance_days(text) is
  'Returns de-identified same-store daily performance metrics for the authenticated approved employee.';
