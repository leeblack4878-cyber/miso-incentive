begin;
create schema if not exists private;

-- Share only saved store totals. Keep the underlying snapshot RLS and write scope intact.
create function private.manager_policy_progress(p_month text)
returns table(store_name text, as_of_date text, confirmed boolean, has_input boolean, metrics jsonb)
language plpgsql stable security definer set search_path='' as $$
begin
  if not exists (
    select 1 from public.profiles v
    where v.id=auth.uid() and v.active is true and v.status='approved'
      and (v.role in ('admin','super_admin') or (
        v.role='manager' and v.position in ('점장','부점장')
        and public.can_edit_manager_store(v.store_name)
      ))
  ) then
    raise exception 'Manager progress access denied' using errcode='42501';
  end if;

  if p_month is distinct from '2026-11' then
    raise exception 'Unsupported manager policy month' using errcode='22023';
  end if;

  return query
    select e.store_name,
      case when e.external_inputs->>'companyAsOfDate' ~ '^2026-11-[0-9]{2}$'
        then e.external_inputs->>'companyAsOfDate' end,
      e.verified_at is not null,
      coalesce(t.totals <> '{}'::jsonb, false),
      coalesce(t.totals, '{}'::jsonb)
    from public.manager_eval_monthly e
    cross join lateral (
      select jsonb_object_agg(k, e.verified_metrics->k) as totals
      from unnest(array['hs','simMnp','secondTotal','home','tvFree','smartHome','tailoredCount']) as keys(k)
      where jsonb_typeof(e.verified_metrics->k) = 'number'
    ) t
    where e.month=p_month and e.store_name in (
      '신천동_삼미시장2호점', '본오3동_상록수역점', '대야동_롯데마트점',
      '본오3동_주민센터점', '장곡동_장곡역점', '거모동_도일시장점', '월곶동_월곶점',
      '월피동_성포역점', '광정동_산본점', '고잔동_법조타운점', '은행동_은계사거리점', '본오1동_본오중학교점'
    );
end;
$$;

revoke all on function private.manager_policy_progress(text) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.manager_policy_progress(text) to authenticated;

create function public.manager_policy_progress(p_month text)
returns table(store_name text, as_of_date text, confirmed boolean, has_input boolean, metrics jsonb)
language sql stable security invoker set search_path='' as $$
  select * from private.manager_policy_progress(p_month)
$$;

revoke all on function public.manager_policy_progress(text) from public,anon;
grant execute on function public.manager_policy_progress(text) to authenticated;
notify pgrst,'reload schema';
commit;
