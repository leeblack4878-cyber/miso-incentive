-- Preserve historical store performance and require a separate approver for reset.
create schema if not exists private;

create table public.performance_reset_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  month text not null check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  reason text not null check (length(btrim(reason)) between 3 and 1000),
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled','executed')),
  requested_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  review_note text,
  expires_at timestamptz,
  executed_at timestamptz,
  backup_id uuid references public.performance_reset_backups(id),
  check (reviewed_by is null or reviewed_by <> user_id)
);
create unique index performance_reset_one_open on public.performance_reset_requests(user_id,month) where status in ('pending','approved');
create index performance_reset_month_status on public.performance_reset_requests(month,status,requested_at desc);
alter table public.performance_reset_requests enable row level security;
revoke all on public.performance_reset_requests from public, anon, authenticated;
grant select on public.performance_reset_requests to authenticated;
create policy reset_request_read on public.performance_reset_requests for select to authenticated
 using (user_id=(select auth.uid()) or public.can_write_target(user_id));

create or replace function private.assert_reset_month(p_month text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and active is true and status='approved') then
    raise exception '활성화된 승인 계정이 필요합니다.';
  end if;
  if p_month is null or p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception '월 형식이 올바르지 않습니다.'; end if;
  if exists(select 1 from public.app_config where config_key in ('locked_months','policy_blocked_months') and value ? p_month)
    or (p_month >= '2026-10' and not exists(select 1 from public.app_config where config_key='policy_ready_months' and value ? p_month)) then
    raise exception '마감되었거나 정책 준비 중인 월은 초기화할 수 없습니다.';
  end if;
end;
$$;
revoke all on function private.assert_reset_month(text) from public,anon,authenticated;

create or replace function private.request_performance_reset(p_month text,p_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  perform private.assert_reset_month(p_month);
  if p_reason is null or length(btrim(p_reason)) not between 3 and 1000 then raise exception '초기화 사유를 3~1000자로 입력해주세요.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||p_month,0));
  update public.performance_reset_requests set status='cancelled'
    where user_id=auth.uid() and month=p_month and status='approved' and expires_at<=now();
  if exists(select 1 from public.performance_reset_requests where user_id=auth.uid() and month=p_month and status in ('pending','approved')) then
    raise exception '이미 진행 중인 초기화 요청이 있습니다.';
  end if;
  insert into public.performance_reset_requests(user_id,month,reason) values(auth.uid(),p_month,btrim(p_reason)) returning id into v_id;
  return v_id;
end;
$$;

create or replace function private.review_performance_reset(p_request_id uuid,p_approve boolean,p_note text) returns void
language plpgsql security definer set search_path='' as $$
declare r public.performance_reset_requests;
begin
  select * into r from public.performance_reset_requests where id=p_request_id for update;
  if not found or r.user_id=auth.uid() or not coalesce(public.can_write_target(r.user_id),false) then raise exception '본인 요청은 승인할 수 없으며, 담당 관리자 권한이 필요합니다.'; end if;
  perform private.assert_reset_month(r.month);
  if r.status<>'pending' then raise exception '이미 처리된 요청입니다.'; end if;
  if p_approve is null then raise exception '승인 또는 반려를 선택해주세요.'; end if;
  if length(coalesce(p_note,''))>1000 then raise exception '처리 메모는 1000자 이내로 입력해주세요.'; end if;
  update public.performance_reset_requests set status=case when p_approve then 'approved' else 'rejected' end,
    reviewed_by=auth.uid(),reviewed_at=now(),review_note=nullif(btrim(p_note),''),expires_at=case when p_approve then now()+interval '24 hours' else null end
    where id=r.id;
end;
$$;

create or replace function private.cancel_performance_reset(p_request_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  update public.performance_reset_requests set status='cancelled'
  where id=p_request_id and user_id=auth.uid() and status in ('pending','approved');
  if not found then raise exception '취소할 수 있는 본인 요청이 없습니다.'; end if;
end;
$$;

-- The old destructive body is callable only by the guarded function, never a client.
alter function public.reset_my_month_performance(text,text) set schema private;
alter function private.reset_my_month_performance(text,text) rename to reset_my_month_performance_unchecked;
alter function private.reset_my_month_performance_unchecked(text,text) set search_path='';
revoke all on function private.reset_my_month_performance_unchecked(text,text) from public,anon,authenticated;

create or replace function private.execute_approved_performance_reset(p_month text,p_confirm_phrase text) returns uuid
language plpgsql security definer set search_path='' as $$
declare r public.performance_reset_requests; v_backup uuid;
begin
  perform private.assert_reset_month(p_month);
  if p_confirm_phrase is distinct from '당월실적초기화' then raise exception '확인 문구가 일치하지 않습니다.'; end if;
  select * into r from public.performance_reset_requests
    where user_id=auth.uid() and month=p_month and status='approved' for update;
  if not found or r.reviewed_by is null or r.reviewed_by=auth.uid() or r.expires_at<=now() then
    raise exception '다른 관리자의 유효한 초기화 승인이 필요합니다. 승인 후 24시간 이내에 실행해주세요.';
  end if;
  if not exists(select 1 from public.profiles where id=r.reviewed_by and active is true and status='approved') then
    raise exception '승인 관리자 계정이 비활성화되었습니다. 다시 승인을 요청해주세요.';
  end if;
  v_backup := private.reset_my_month_performance_unchecked(p_month,p_confirm_phrase);
  update public.performance_reset_requests set status='executed',executed_at=now(),backup_id=v_backup where id=r.id;
  return v_backup;
end;
$$;

create or replace function public.request_performance_reset(p_month text,p_reason text) returns uuid language sql security invoker set search_path='' as $$ select private.request_performance_reset(p_month,p_reason); $$;
create or replace function public.review_performance_reset(p_request_id uuid,p_approve boolean,p_note text default '') returns void language sql security invoker set search_path='' as $$ select private.review_performance_reset(p_request_id,p_approve,p_note); $$;
create or replace function public.cancel_performance_reset(p_request_id uuid) returns void language sql security invoker set search_path='' as $$ select private.cancel_performance_reset(p_request_id); $$;
create or replace function public.reset_my_month_performance(p_month text,p_confirm_phrase text) returns uuid language sql security invoker set search_path='' as $$ select private.execute_approved_performance_reset(p_month,p_confirm_phrase); $$;

grant usage on schema private to authenticated;
revoke all on function private.request_performance_reset(text,text), private.review_performance_reset(uuid,boolean,text), private.cancel_performance_reset(uuid), private.execute_approved_performance_reset(text,text) from public,anon,authenticated;
grant execute on function private.request_performance_reset(text,text), private.review_performance_reset(uuid,boolean,text), private.cancel_performance_reset(uuid), private.execute_approved_performance_reset(text,text) to authenticated;
revoke all on function public.request_performance_reset(text,text), public.review_performance_reset(uuid,boolean,text), public.cancel_performance_reset(uuid), public.reset_my_month_performance(text,text) from public,anon,authenticated;
grant execute on function public.request_performance_reset(text,text), public.review_performance_reset(uuid,boolean,text), public.cancel_performance_reset(uuid), public.reset_my_month_performance(text,text) to authenticated;

-- Keep the active-viewer check and anonymized fields; retain inactive member sales.
CREATE OR REPLACE FUNCTION public.get_my_store_performance_days(p_month text)
 RETURNS TABLE(work_date date, data jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
     and member.status = 'approved'
     and d.work_date >= month_start
     and d.work_date < month_end
   order by d.work_date, d.id;
end;
$function$
;
