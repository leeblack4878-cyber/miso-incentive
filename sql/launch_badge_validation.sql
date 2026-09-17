-- Automatic awards are calculated from a transaction snapshot by the private server function.
-- Existing achievements remain in history; unverified automatic rows are not counted as earned.
alter table public.user_achievements add column if not exists verified_at timestamptz;
alter policy achievements_insert_auto_or_manager on public.user_achievements with check (
  awarded_by=auth.uid() and verified_at is null
  and badge_key=any(array['special_growth','special_team','special_pick'])
  and exists(select 1 from public.profiles actor where actor.id=auth.uid() and actor.active=true and actor.status='approved'
    and (actor.role='admin' or actor.position='담당' or (actor.position in ('점장','부점장') and exists(
      select 1 from public.profiles target where target.id=user_achievements.user_id and target.store_name=actor.store_name))))
);
alter policy titles_insert_own on public.user_titles with check (auth.uid()=user_id and exists(
  select 1 from public.user_achievements a where a.user_id=user_titles.user_id and a.badge_key=user_titles.badge_key and (a.verified_at is not null or a.awarded_by is not null)));
alter policy titles_update_own on public.user_titles using(auth.uid()=user_id) with check (auth.uid()=user_id and exists(
  select 1 from public.user_achievements a where a.user_id=user_titles.user_id and a.badge_key=user_titles.badge_key and (a.verified_at is not null or a.awarded_by is not null)));

create or replace function public.badge_source_snapshot(p_user_id uuid,p_month text) returns jsonb
language plpgsql stable security invoker set search_path=public as $$
declare v_source jsonb; v_from date; v_to date;
begin
  if p_month !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$' or p_month>to_char(now() at time zone 'Asia/Seoul','YYYY-MM') then raise exception 'BADGE_MONTH_INVALID'; end if;
  if not exists(select 1 from public.profiles where id=p_user_id and active=true and status='approved') then raise exception 'BADGE_USER_UNAVAILABLE'; end if;
  v_from:=(p_month||'-01')::date; v_to:=v_from+interval '1 month';
  select jsonb_build_object(
    'config',(select coalesce(jsonb_agg(jsonb_build_object('key',config_key,'value',value) order by config_key),'[]') from public.app_config where config_key in ('config','policy_history_v1')),
    'profiles',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'position',position,'hire_date',hire_date,'store_name',store_name) order by id),'[]') from public.profiles where active=true and status='approved'),
    'monthly',(select coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'data',data,'activity_time_met',activity_time_met) order by user_id),'[]') from public.monthly_status where month=p_month),
    'daily',(select coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'work_date',work_date,'data',data) order by user_id,work_date),'[]') from public.daily_records where work_date>=v_from and work_date<v_to),
    'history',(select coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'work_date',work_date,'data',data) order by work_date),'[]') from public.daily_records where user_id=p_user_id and work_date<v_to),
    'home_orders',(select coalesce(jsonb_agg(to_jsonb(h) order by id),'[]') from public.home_orders h where (source_work_date>=v_from or actual_install_date>=v_from or user_id=p_user_id)),
    'home_links',(select coalesce(jsonb_agg(jsonb_build_object('source_ref',source_ref) order by id),'[]') from public.customer_sales where source_type='home_order'),
    'team_credits',(select coalesce(jsonb_agg(jsonb_build_object('source_refs',source_refs) order by id),'[]') from public.team_sales_credits where source_type='home'),
    'goals',(select coalesce(goals,'{}') from public.monthly_goals where user_id=p_user_id and month=p_month)
  ) into v_source;
  return jsonb_build_object('source',v_source,'fingerprint',md5(v_source::text));
end $$;
revoke all on function public.badge_source_snapshot(uuid,text) from public,anon,authenticated;
grant execute on function public.badge_source_snapshot(uuid,text) to service_role;

create or replace function public.commit_verified_badges(p_user_id uuid,p_month text,p_fingerprint text,p_badge_keys text[]) returns jsonb
language plpgsql security invoker set search_path=public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  if public.badge_source_snapshot(p_user_id,p_month)->>'fingerprint' is distinct from p_fingerprint then raise exception 'BADGE_SOURCE_CHANGED'; end if;
  insert into public.user_achievements(user_id,badge_key,awarded_by,verified_at)
  select p_user_id,k,null,now() from unnest(p_badge_keys) k
  on conflict(user_id,badge_key) do update set verified_at=excluded.verified_at where user_achievements.verified_at is null and user_achievements.awarded_by is null;
  return (select coalesce(jsonb_agg(jsonb_build_object('badge_key',badge_key,'earned_at',earned_at,'awarded_by',awarded_by,'verified_at',verified_at,'note',note) order by earned_at),'[]') from public.user_achievements where user_id=p_user_id);
end $$;
revoke all on function public.commit_verified_badges(uuid,text,text,text[]) from public,anon,authenticated;
grant execute on function public.commit_verified_badges(uuid,text,text,text[]) to service_role;
