begin;
create schema if not exists private;
-- No historical store is inferred. Existing records intentionally remain NULL.
alter table public.customer_tasks add column calendar_store_name text;
alter table public.home_orders add column calendar_store_name text;
comment on column public.customer_tasks.calendar_store_name is 'Immutable calendar store for newly inserted records. NULL legacy rows have unknown historical store and are not shared with peer employees.';
comment on column public.home_orders.calendar_store_name is 'Immutable calendar store for newly inserted records. NULL legacy rows have unknown historical store and are not shared with peer employees.';

create table public.store_schedules (
 id uuid primary key default gen_random_uuid(), request_id uuid not null,
 assignee_id uuid not null references public.profiles(id), assignee_name text not null,
 store_name text not null, title text not null check(length(btrim(title)) between 1 and 160),
 note text not null default '' check(length(note)<=2000),
 event_date date not null, event_time time,
 kind text not null check(kind in ('recare','contact','visit','other')),
 status text not null default 'pending' check(status in ('pending','completed','cancelled')),
 created_by uuid not null references public.profiles(id), updated_by uuid not null references public.profiles(id),
 created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp(),
 completed_at timestamptz, cancelled_at timestamptz,
 unique(created_by,request_id)
);
create index store_schedule_date_idx on public.store_schedules(store_name,event_date,id);
create table public.store_calendar_history (
 id bigint generated always as identity primary key, source text not null, source_id text not null,
 store_name text, assignee_id uuid not null,
 actor_id uuid, actor_name text not null, actor_position text, actor_role text, is_proxy boolean not null default false, acted_at timestamptz not null default clock_timestamp(),
 action text not null, before_data jsonb, after_data jsonb
);
create index store_calendar_history_source_idx on public.store_calendar_history(source,source_id,id);
alter table public.store_schedules enable row level security;
alter table public.store_calendar_history enable row level security;
create policy store_schedules_no_direct_access on public.store_schedules for all to authenticated using(false) with check(false);
create policy store_calendar_history_no_direct_access on public.store_calendar_history for all to authenticated using(false) with check(false);
revoke all on public.store_schedules,public.store_calendar_history from public,anon,authenticated;
-- Narrow RPCs intentionally expose summaries rather than granting access to customer ledgers.

create function private.calendar_profile() returns public.profiles language plpgsql stable security definer set search_path='' as $$
declare v public.profiles; begin
 select * into v from public.profiles where id=auth.uid() and active is true and status='approved';
 if v.id is null or nullif(btrim(v.store_name),'') is null then raise exception 'CALENDAR_FORBIDDEN' using errcode='42501'; end if;
 return v;
end $$;
create function private.calendar_can_read(p_owner uuid,p_store text) returns boolean language plpgsql stable security definer set search_path='' as $$
declare v public.profiles; begin
 v:=private.calendar_profile();
 if p_store is not null then return p_store=v.store_name; end if;
 -- Unknown legacy attribution: existing owner/manager access, never peer sharing.
 return p_owner=v.id or (v.role='manager' and v.position='점장' and exists(select 1 from public.profiles p where p.id=p_owner and p.store_name=v.store_name) and public.can_write_target(p_owner));
end $$;
create function private.calendar_can_edit(p_owner uuid,p_store text) returns boolean language plpgsql stable security definer set search_path='' as $$
declare v public.profiles; begin
 v:=private.calendar_profile();
 if p_store is null then return p_owner=v.id or (v.role='manager' and v.position='점장' and exists(select 1 from public.profiles p where p.id=p_owner and p.store_name=v.store_name) and public.can_write_target(p_owner)); end if;
 return p_store=v.store_name and (v.id=p_owner or (v.role='manager' and v.position='점장'));
end $$;
create function private.calendar_mask(p_value text) returns text language sql immutable set search_path='' as $$
 select case when nullif(btrim(p_value),'') is null then '' when char_length(p_value)=1 then '*' else left(p_value,1)||repeat('*',greatest(1,least(6,char_length(p_value)-1))) end;
$$;
create function private.calendar_source_snapshot() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
  select p.store_name into new.calendar_store_name from public.profiles p where p.id=new.user_id;
 elsif new.calendar_store_name is distinct from old.calendar_store_name then
  raise exception 'CALENDAR_STORE_IMMUTABLE' using errcode='42501';
 end if;
 return new;
end $$;
create trigger calendar_task_store before insert or update on public.customer_tasks for each row execute function private.calendar_source_snapshot();
create trigger calendar_home_store before insert or update on public.home_orders for each row execute function private.calendar_source_snapshot();

create function private.calendar_audit() returns trigger language plpgsql security definer set search_path='' as $$
declare a jsonb; b jsonb; row_data jsonb; src text; st text; owner_id uuid; actor text; actor_position text; actor_role text; begin
 src:=case tg_table_name when 'store_schedules' then 'schedule' when 'customer_tasks' then 'customer_task' else 'home_order' end;
 if tg_op<>'INSERT' then b:=to_jsonb(old); end if;
 if tg_op<>'DELETE' then a:=to_jsonb(new); end if;
 if src='schedule' then
  select jsonb_object_agg(key,value) into b from jsonb_each(b) where key in ('title','note','event_date','event_time','kind','status','updated_at');
  select jsonb_object_agg(key,value) into a from jsonb_each(a) where key in ('title','note','event_date','event_time','kind','status','updated_at');
 elsif src='customer_task' then
  select jsonb_object_agg(key,value) into b from jsonb_each(b) where key in ('title','note','due_date','status','updated_at');
  select jsonb_object_agg(key,value) into a from jsonb_each(a) where key in ('title','note','due_date','status','updated_at');
 else
  select jsonb_object_agg(key,value) into b from jsonb_each(b) where key in ('planned_install_date','actual_install_date','status','updated_at');
  select jsonb_object_agg(key,value) into a from jsonb_each(a) where key in ('planned_install_date','actual_install_date','status','updated_at');
 end if;
 if tg_op='UPDATE' and (a-'updated_at')=(b-'updated_at') then return new; end if;
 row_data:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 st:=case src when 'schedule' then row_data->>'store_name' else row_data->>'calendar_store_name' end;
 owner_id:=(case src when 'schedule' then row_data->>'assignee_id' else row_data->>'user_id' end)::uuid;
 select name,position,role into actor,actor_position,actor_role from public.profiles where id=auth.uid();
 insert into public.store_calendar_history(source,source_id,store_name,assignee_id,actor_id,actor_name,actor_position,actor_role,is_proxy,action,before_data,after_data)
 values(src,row_data->>'id',st,owner_id,auth.uid(),coalesce(actor,'시스템'),actor_position,actor_role,coalesce(auth.uid()<>owner_id,false),lower(tg_op),b,a);
 if tg_op='DELETE' then return old; end if; return new;
end $$;
create trigger calendar_schedule_audit after insert or update or delete on public.store_schedules for each row execute function private.calendar_audit();
create trigger calendar_task_audit after insert or update or delete on public.customer_tasks for each row execute function private.calendar_audit();
create trigger calendar_home_audit after insert or update or delete on public.home_orders for each row execute function private.calendar_audit();

create function private.save_store_schedule(p_request_id uuid,p_id uuid,p_expected_updated_at timestamptz,p_title text,p_note text,p_date date,p_time time,p_kind text,p_status text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v public.profiles; r public.store_schedules; result_id uuid; begin
 v:=private.calendar_profile();
 if p_request_id is null or p_date is null or nullif(btrim(p_title),'') is null or length(btrim(p_title))>160 or length(coalesce(p_note,''))>2000 or p_kind is null or p_kind not in ('recare','contact','visit','other') or p_status is null or p_status not in ('pending','completed','cancelled') then raise exception 'CALENDAR_INVALID'; end if;
 if p_id is null then
  if p_status<>'pending' then raise exception 'CALENDAR_NEW_MUST_BE_PENDING'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v.id::text||p_request_id::text,0));
  select * into r from public.store_schedules where created_by=v.id and request_id=p_request_id;
  if found then
   if row(r.title,r.note,r.event_date,r.event_time,r.kind,r.store_name) is distinct from row(btrim(p_title),btrim(coalesce(p_note,'')),p_date,p_time,p_kind,v.store_name) then raise exception 'CALENDAR_REQUEST_CONFLICT'; end if;
   return r.id;
  end if;
  insert into public.store_schedules(request_id,assignee_id,assignee_name,store_name,title,note,event_date,event_time,kind,created_by,updated_by)
  values(p_request_id,v.id,v.name,v.store_name,btrim(p_title),btrim(coalesce(p_note,'')),p_date,p_time,p_kind,v.id,v.id) returning id into result_id;
 else
  select * into r from public.store_schedules where id=p_id for update;
  if not found or not private.calendar_can_edit(r.assignee_id,r.store_name) then raise exception 'CALENDAR_FORBIDDEN' using errcode='42501'; end if;
  if r.updated_at is distinct from p_expected_updated_at then raise exception 'CALENDAR_STALE'; end if;
  update public.store_schedules set title=btrim(p_title),note=btrim(coalesce(p_note,'')),event_date=p_date,event_time=p_time,kind=p_kind,status=p_status,
   updated_by=v.id,updated_at=clock_timestamp(),completed_at=case when p_status='completed' then coalesce(r.completed_at,clock_timestamp()) else null end,
   cancelled_at=case when p_status='cancelled' then coalesce(r.cancelled_at,clock_timestamp()) else null end
  where id=p_id returning id into result_id;
 end if;
 return result_id;
end $$;
create function public.save_store_schedule(p_request_id uuid,p_id uuid,p_expected_updated_at timestamptz,p_title text,p_note text,p_date date,p_time time,p_kind text,p_status text) returns uuid
language sql security invoker set search_path='' as $$select private.save_store_schedule(p_request_id,p_id,p_expected_updated_at,p_title,p_note,p_date,p_time,p_kind,p_status)$$;

create function private.update_calendar_promise(p_id uuid,p_expected_updated_at timestamptz,p_due_date date,p_note text,p_status text) returns uuid
language plpgsql security definer set search_path='' as $$
declare r public.customer_tasks; begin
 perform private.calendar_profile();
 select * into r from public.customer_tasks where id=p_id for update;
 if not found or not private.calendar_can_edit(r.user_id,r.calendar_store_name) then raise exception 'CALENDAR_FORBIDDEN' using errcode='42501'; end if;
 if r.task_type in ('usedPhone','affiliateCard') or coalesce(r.task_meta->>'cancel_reason','')='home_cancelled' then raise exception 'CALENDAR_USE_SPECIALIZED_EDITOR'; end if;
 if r.updated_at is distinct from p_expected_updated_at then raise exception 'CALENDAR_STALE'; end if;
 if p_due_date is null or length(coalesce(p_note,''))>2000 or p_status is null or p_status not in ('pending','completed','cancelled') then raise exception 'CALENDAR_INVALID'; end if;
 update public.customer_tasks set due_date=p_due_date,note=btrim(coalesce(p_note,'')),status=p_status,
 completed_at=case when p_status='completed' then coalesce(r.completed_at,clock_timestamp()) else null end,updated_at=clock_timestamp() where id=p_id;
 return p_id;
end $$;
create function public.update_calendar_promise(p_id uuid,p_expected_updated_at timestamptz,p_due_date date,p_note text,p_status text) returns uuid
language sql security invoker set search_path='' as $$select private.update_calendar_promise(p_id,p_expected_updated_at,p_due_date,p_note,p_status)$$;

-- An action overlay records handling of the latest OB due item, never a fictitious call.
create table public.store_calendar_ob_actions (
 log_id uuid not null references public.ob_contact_logs(id), kind text not null check(kind in ('ob_followup','ob_visit')),
 status text not null check(status in ('pending','completed','cancelled')), note text not null default '' check(length(note)<=2000),
 updated_by uuid not null references public.profiles(id),updated_at timestamptz not null default clock_timestamp(),
 primary key(log_id,kind)
);
alter table public.store_calendar_ob_actions enable row level security;
create policy store_calendar_ob_actions_no_direct_access on public.store_calendar_ob_actions for all to authenticated using(false) with check(false);
revoke all on public.store_calendar_ob_actions from public,anon,authenticated;
create function private.update_calendar_ob(p_id uuid,p_kind text,p_expected_updated_at timestamptz,p_note text,p_status text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v public.profiles; o public.ob_contact_logs; a public.store_calendar_ob_actions; version timestamptz; begin
 v:=private.calendar_profile();
 if p_kind is null or p_kind not in ('ob_followup','ob_visit') or p_status is null or p_status not in ('pending','completed','cancelled') or length(coalesce(p_note,''))>2000 then raise exception 'CALENDAR_INVALID'; end if;
 -- Serialize both first write and updates on this immutable source log.
 select * into o from public.ob_contact_logs where id=p_id for update;
 if not found or not private.calendar_can_edit(o.user_id,o.store_name) then raise exception 'CALENDAR_FORBIDDEN' using errcode='42501'; end if;
 if (p_kind='ob_followup' and o.follow_up_date is null) or (p_kind='ob_visit' and o.visit_at is null) then raise exception 'CALENDAR_INVALID'; end if;
 if exists(select 1 from public.ob_contact_logs n where n.store_name=o.store_name and n.user_id=o.user_id and n.subscription_number=o.subscription_number and (n.contacted_at,n.id)>(o.contacted_at,o.id)) then raise exception 'CALENDAR_STALE'; end if;
 select * into a from public.store_calendar_ob_actions where log_id=p_id and kind=p_kind;
 version:=coalesce(a.updated_at,o.contacted_at);
 if version is distinct from p_expected_updated_at then raise exception 'CALENDAR_STALE'; end if;
 insert into public.store_calendar_ob_actions(log_id,kind,status,note,updated_by) values(p_id,p_kind,p_status,btrim(coalesce(p_note,'')),v.id)
 on conflict(log_id,kind) do update set status=excluded.status,note=excluded.note,updated_by=v.id,updated_at=clock_timestamp();
 insert into public.store_calendar_history(source,source_id,store_name,assignee_id,actor_id,actor_name,actor_position,actor_role,is_proxy,action,before_data,after_data)
 values(p_kind,p_id::text,o.store_name,o.user_id,v.id,v.name,v.position,v.role,v.id<>o.user_id,'update',jsonb_build_object('status',coalesce(a.status,'unconfirmed'),'note',coalesce(a.note,o.memo),'updated_at',version),jsonb_build_object('status',p_status,'note',btrim(coalesce(p_note,'')),'updated_at',(select updated_at from public.store_calendar_ob_actions where log_id=p_id and kind=p_kind)));
 return p_id;
end $$;
create function public.update_calendar_ob(p_id uuid,p_kind text,p_expected_updated_at timestamptz,p_note text,p_status text) returns uuid language sql security invoker set search_path='' as $$select private.update_calendar_ob(p_id,p_kind,p_expected_updated_at,p_note,p_status)$$;
revoke all on function private.update_calendar_ob(uuid,text,timestamptz,text,text),public.update_calendar_ob(uuid,text,timestamptz,text,text) from public,anon;
grant execute on function private.update_calendar_ob(uuid,text,timestamptz,text,text),public.update_calendar_ob(uuid,text,timestamptz,text,text) to authenticated;

create function private.read_store_calendar(p_from date,p_to date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v public.profiles; events jsonb; roster jsonb; ob jsonb; today date:=(now() at time zone 'Asia/Seoul')::date; begin
 v:=private.calendar_profile();
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>62 then raise exception 'CALENDAR_DATE_RANGE'; end if;
 with latest_ob as (
  select distinct on(user_id,subscription_number) * from public.ob_contact_logs where store_name=v.store_name order by user_id,subscription_number,contacted_at desc,id desc
 ), e as (
  select 'schedule:'||s.id as id,'schedule'::text as source,s.id::text as source_id,s.kind,s.event_date,s.event_time::text,
  s.title,s.note,''::text as customer_name,s.assignee_id,s.assignee_name,s.status,private.calendar_can_edit(s.assignee_id,s.store_name) as can_edit,s.updated_at,false as legacy_store_basis,null::text as call_result,null::text as reaction
  from public.store_schedules s where s.store_name=v.store_name and s.event_date between p_from and p_to
  union all
  select 'customer_task:'||t.id,'customer_task',t.id::text,'promise',t.due_date,null,t.title,coalesce(t.note,''),private.calendar_mask(c.customer_name),t.user_id,coalesce(p.name,'담당자'),t.status,
   t.task_type not in ('usedPhone','affiliateCard') and coalesce(t.task_meta->>'cancel_reason','')<>'home_cancelled' and private.calendar_can_edit(t.user_id,t.calendar_store_name),t.updated_at,t.calendar_store_name is null,null,null
  from public.customer_tasks t left join public.customers c on c.id=t.customer_id and c.user_id=t.user_id left join public.profiles p on p.id=t.user_id
  where t.due_date between p_from and p_to and private.calendar_can_read(t.user_id,t.calendar_store_name)
  union all
  select 'home_order:'||h.id,'home_order',h.id::text,'installation',case when h.status='completed' then coalesce(h.actual_install_date,(h.completed_at at time zone 'Asia/Seoul')::date) else h.planned_install_date end,null,
  case h.product_type when 'homeOnly' then '홈 단독 설치' when 'homeTv' then 'TV(주) 설치' when 'internet1g' then '인터넷 1GB 설치' when 'internet500' then '인터넷 500MB 설치' when 'internet100' then '인터넷 100MB 설치' when 'subSetTop' then 'TV부셋탑 설치' when 'tvFree' then 'TV프리(부) 설치' when 'smartHome' then '스마트홈 설치' else '홈 설치 · '||h.product_type end,
  ''::text,private.calendar_mask(h.customer_name),h.user_id,coalesce(p.name,'담당자'),h.status,false,h.updated_at,h.calendar_store_name is null,null,null
  from public.home_orders h left join public.profiles p on p.id=h.user_id
  where h.product_type not in ('simulNewChange','simulMnp','simulUsedMnp') and (case when h.status='completed' then coalesce(h.actual_install_date,(h.completed_at at time zone 'Asia/Seoul')::date) else h.planned_install_date end) between p_from and p_to and private.calendar_can_read(h.user_id,h.calendar_store_name)
  union all
  select 'ob_contact:'||o.id||':call','ob_contact',o.id::text,'ob_call',o.contact_date,to_char(o.contacted_at at time zone 'Asia/Seoul','HH24:MI'),o.purpose||' · '||o.call_result,''::text,private.calendar_mask(o.customer_name),o.user_id,o.employee_name,'recorded',false,o.contacted_at,false,o.call_result,o.reaction
  from public.ob_contact_logs o where o.store_name=v.store_name and o.contact_date between p_from and p_to
  union all
  select 'ob_contact:'||o.id||':followup','ob_contact',o.id::text,'ob_followup',o.follow_up_date,null,'OB 재연락',coalesce(a.note,o.memo),private.calendar_mask(o.customer_name),o.user_id,o.employee_name,coalesce(a.status,'unconfirmed'),private.calendar_can_edit(o.user_id,o.store_name),coalesce(a.updated_at,o.contacted_at),false,o.call_result,o.reaction
  from latest_ob o left join public.store_calendar_ob_actions a on a.log_id=o.id and a.kind='ob_followup' where o.follow_up_date between p_from and p_to
  union all
  select 'ob_contact:'||o.id||':visit','ob_contact',o.id::text,'ob_visit',(o.visit_at at time zone 'Asia/Seoul')::date,to_char(o.visit_at at time zone 'Asia/Seoul','HH24:MI'),'OB 방문 약속',coalesce(a.note,o.memo),private.calendar_mask(o.customer_name),o.user_id,o.employee_name,coalesce(a.status,'unconfirmed'),private.calendar_can_edit(o.user_id,o.store_name),coalesce(a.updated_at,o.contacted_at),false,o.call_result,o.reaction
  from latest_ob o left join public.store_calendar_ob_actions a on a.log_id=o.id and a.kind='ob_visit' where (o.visit_at at time zone 'Asia/Seoul')::date between p_from and p_to
 ) select coalesce(jsonb_agg(to_jsonb(e) order by event_date,event_time nulls last,id),'[]') into events from e;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name) order by p.name,p.id),'[]') into roster from public.profiles p where p.store_name=v.store_name and p.active is true and p.status='approved';
 with people as (
  select p.id,p.name from public.profiles p where p.store_name=v.store_name and p.active is true and p.status='approved'
  union (select distinct on(o.user_id) o.user_id,o.employee_name from public.ob_contact_logs o where o.store_name=v.store_name and o.contact_date=today and not exists(select 1 from public.profiles p where p.id=o.user_id and p.store_name=v.store_name and p.active is true and p.status='approved') order by o.user_id,o.contacted_at desc,o.id desc)
 ), stats as (
 select p.id as user_id,p.name,count(o.id) as activity,count(o.id) filter(where o.call_result='통화 완료') as connected,
 count(o.id) filter(where o.call_result='통화 완료' and o.reaction='관심 있음') as interested,count(o.id) filter(where o.visit_at is not null) as visits
 from people p left join public.ob_contact_logs o on o.user_id=p.id and o.store_name=v.store_name and o.contact_date=today group by p.id,p.name
 ) select coalesce(jsonb_agg(to_jsonb(stats) order by name,user_id),'[]') into ob from stats;
 return jsonb_build_object('store_name',v.store_name,'is_store_manager',v.role='manager' and v.position='점장','can_create',true,'roster',roster,'events',events,'today_ob',ob,'today',today);
end $$;
create function public.read_store_calendar(p_from date,p_to date) returns jsonb language sql security invoker set search_path='' as $$select private.read_store_calendar(p_from,p_to)$$;

create function private.read_store_calendar_history(p_source text,p_source_id text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; begin
 perform private.calendar_profile();
 if p_source not in ('schedule','customer_task','home_order','ob_followup','ob_visit') or length(p_source_id)>80 then raise exception 'CALENDAR_INVALID'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',h.id,'actor_id',h.actor_id,'actor_name',h.actor_name,'actor_position',h.actor_position,'actor_role',h.actor_role,'assignee_id',h.assignee_id,'is_proxy',h.is_proxy,'acted_at',h.acted_at,'action',h.action,'before',h.before_data,'after',h.after_data) order by h.id desc),'[]') into result
 from public.store_calendar_history h where h.source=p_source and h.source_id=p_source_id and private.calendar_can_read(h.assignee_id,h.store_name);
 return result;
end $$;
create function public.read_store_calendar_history(p_source text,p_source_id text) returns jsonb language sql security invoker set search_path='' as $$select private.read_store_calendar_history(p_source,p_source_id)$$;

-- No PUBLIC execution; private implementation functions require an authenticated identity themselves.
revoke all on function private.calendar_profile(),private.calendar_can_read(uuid,text),private.calendar_can_edit(uuid,text),private.calendar_mask(text),private.calendar_source_snapshot(),private.calendar_audit() from public,anon,authenticated;
revoke all on function private.save_store_schedule(uuid,uuid,timestamptz,text,text,date,time,text,text),public.save_store_schedule(uuid,uuid,timestamptz,text,text,date,time,text,text),private.update_calendar_promise(uuid,timestamptz,date,text,text),public.update_calendar_promise(uuid,timestamptz,date,text,text),private.read_store_calendar(date,date),public.read_store_calendar(date,date),private.read_store_calendar_history(text,text),public.read_store_calendar_history(text,text) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.save_store_schedule(uuid,uuid,timestamptz,text,text,date,time,text,text),public.save_store_schedule(uuid,uuid,timestamptz,text,text,date,time,text,text),private.update_calendar_promise(uuid,timestamptz,date,text,text),public.update_calendar_promise(uuid,timestamptz,date,text,text),private.read_store_calendar(date,date),public.read_store_calendar(date,date),private.read_store_calendar_history(text,text),public.read_store_calendar_history(text,text) to authenticated;
notify pgrst,'reload schema';
commit;
