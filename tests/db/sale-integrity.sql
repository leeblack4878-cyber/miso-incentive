-- Dedicated staging only. Real authenticated-role/RLS tests, NOT browser/Auth coverage.
begin;
do $$ begin
 if to_regclass('e2e_legacy.profiles') is null or exists(
  select 1 from public.profiles p left join auth.users u on u.id=p.id
  where p.store_name<>'E2E_HOME_REGRESSION' or u.raw_app_meta_data->>'e2e_fixture' is distinct from 'home-bundle-v1'
 ) or exists(select 1 from auth.users where id='f0329992-ced4-4407-b71d-ed58c5d74aaf') then
   raise exception 'Requires dedicated staging with only known E2E accounts';
 end if;
end $$;
-- Named scopes now bind to this existing principal ID, not the display name.
create temp table integrity_users as select gen_random_uuid() employee,gen_random_uuid() other_employee,'f0329992-ced4-4407-b71d-ed58c5d74aaf'::uuid admin;
grant select on integrity_users to authenticated;
insert into auth.users(id,email,raw_user_meta_data)
select employee,'integrity.owner@example.test','{}'::jsonb from integrity_users union all
select other_employee,'integrity.other@example.test','{}'::jsonb from integrity_users union all
select admin,'integrity.admin@example.test','{}'::jsonb from integrity_users;
delete from public.profiles where id in(select employee from integrity_users union select other_employee from integrity_users union select admin from integrity_users);
insert into public.profiles(id,name,store_name,position,role,active,status,must_change_password)
select employee,'INTEGRITY_owner','INTEGRITY_store','사원','employee',true,'approved',false from integrity_users union all
select other_employee,'INTEGRITY_other','INTEGRITY_store','사원','employee',true,'approved',false from integrity_users union all
select admin,'김진문','운영진','대표','admin',true,'approved',false from integrity_users;
create function pg_temp.integrity_failure() returns trigger language plpgsql as $$ begin
 if old.metric_label='INTEGRITY_fail' then raise exception 'INTEGRITY_INJECTED_FAILURE'; end if;
 return case when TG_OP='DELETE' then old else new end;
end $$;
create trigger integrity_failure before delete or update on public.customer_sales for each row execute function pg_temp.integrity_failure();
create function pg_temp.integrity_snapshot(actor uuid) returns jsonb language sql as $$
select jsonb_build_object(
 'daily',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.daily_records t where user_id=actor),
 'sales',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.customer_sales t where user_id=actor),
 'tasks',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.customer_tasks t where user_id=actor),
 'expenses',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.sales_expenses t where user_id=actor),
 'credits',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.team_sales_credits t where seller_id=actor));
$$;
set local role authenticated;
do $$
declare actor uuid; other_actor uuid; admin_actor uuid; customer uuid; sid uuid; other_sid uuid; before_state jsonb;
 meta jsonb:='{"ri":0,"ci":0}'; before_day jsonb:='{"matrix":[[2]],"specialReplacementPay":0}'; after_day jsonb:='{"matrix":[[1]],"specialReplacementPay":0}'; result jsonb;
begin
 select employee,other_employee,admin into actor,other_actor,admin_actor from integrity_users;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',other_actor,'role','authenticated')::text,true);
 insert into public.customers(user_id,customer_name) values(other_actor,'INTEGRITY_other') returning id into customer;
 insert into public.customer_sales(user_id,customer_id,sale_date,metric_label,source_type,source_meta)
 values(other_actor,customer,'2026-09-16','other','mobile',meta) returning id into other_sid;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 insert into public.customers(user_id,customer_name) values(actor,'INTEGRITY_owner') returning id into customer;
 insert into public.daily_records(user_id,work_date,data) values(actor,'2026-09-16',before_day);
 insert into public.customer_sales(user_id,customer_id,sale_date,metric_label,source_type,source_meta)
 values(actor,customer,'2026-09-16','INTEGRITY_fail','mobile',meta) returning id into sid;
 insert into public.customer_tasks(user_id,customer_id,source_sale_id,task_type,title,base_date,due_date,status)
 values(actor,customer,sid,'custom','integrity task','2026-09-16','2026-09-17','pending');
 insert into public.sales_expenses(user_id,source_sale_id,expense_date,amount,category) values(actor,sid,'2026-09-16',33000,'오퍼');
 before_state:=pg_temp.integrity_snapshot(actor);
 begin
  perform public.delete_sale_atomic(actor,sid,meta,before_day,after_day);
  raise exception 'expected injected delete failure';
 exception when others then if sqlerrm<>'INTEGRITY_INJECTED_FAILURE' then raise; end if; end;
 if pg_temp.integrity_snapshot(actor)<>before_state then raise exception 'partial delete persisted'; end if;
 begin
  perform public.delete_sale_atomic(actor,sid,meta,'{}',after_day);
  raise exception 'expected stale day failure';
 exception when others then if sqlerrm<>'SALE_STALE_DATA' then raise; end if; end;
 begin
  perform public.delete_sale_atomic(actor,sid,'{}',before_day,after_day);
  raise exception 'expected stale meta failure';
 exception when others then if sqlerrm<>'SALE_STALE_DATA' then raise; end if; end;
 begin
  perform public.delete_sale_atomic(other_actor,other_sid,meta,null,null);
  raise exception 'expected foreign delete denial';
 exception when insufficient_privilege then null; end;
 begin
  perform public.review_special_sale_atomic(sid,true);
  raise exception 'expected employee review denial';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
-- Remove only the failure trigger inside this rolled-back test transaction.
drop trigger integrity_failure on public.customer_sales;
set local role authenticated;
do $$
declare actor uuid; admin_actor uuid; sid uuid; result jsonb; before_state jsonb; day_data jsonb;
begin
 select employee,admin into actor,admin_actor from integrity_users;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 select id into sid from public.customer_sales where user_id=actor;
 result:=public.delete_sale_atomic(actor,sid,'{"ri":0,"ci":0}','{"matrix":[[2]],"specialReplacementPay":0}','{"matrix":[[1]],"specialReplacementPay":0}');
 if result->>'sale_count'<>'1' or exists(select 1 from public.customer_sales where id=sid) or exists(select 1 from public.customer_tasks where source_sale_id=sid) or exists(select 1 from public.sales_expenses where source_sale_id=sid) then raise exception 'incomplete cascade'; end if;
 if (select data->'matrix' from public.daily_records where user_id=actor)<>'[[1]]' then raise exception 'daily not decremented'; end if;
 before_state:=pg_temp.integrity_snapshot(actor);
 begin
  perform public.delete_sale_atomic(actor,sid,'{"ri":0,"ci":0}','{}','{}');
  raise exception 'expected repeat delete rejection';
 exception when others then if sqlerrm<>'SALE_NOT_FOUND' then raise; end if; end;
 if pg_temp.integrity_snapshot(actor)<>before_state then raise exception 'repeat delete changed daily'; end if;
 insert into public.customer_sales(user_id,customer_id,sale_date,metric_label,source_type,source_meta)
 select actor,id,'2026-09-16','approval','mobile','{"specialPolicy":{"exceptionStatus":"pending","exceptionRequestedAmount":50000,"replacementAmount":20000}}' from public.customers where user_id=actor returning id into sid;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_actor,'role','authenticated')::text,true);
 result:=public.review_special_sale_atomic(sid,true);
 if result->>'applied'<>'true' or result->>'amount'<>'50000' then raise exception 'wrong approval amount'; end if;
 before_state:=pg_temp.integrity_snapshot(actor);
 result:=public.review_special_sale_atomic(sid,true);
 if result->>'applied'<>'false' then raise exception 'repeat approval applied'; end if;
 result:=public.review_special_sale_atomic(sid,false);
 if result->>'applied'<>'false' then raise exception 'opposite repeat applied'; end if;
 if pg_temp.integrity_snapshot(actor)<>before_state then raise exception 'duplicate payout'; end if;
 insert into public.customer_sales(user_id,customer_id,sale_date,metric_label,source_type,source_meta)
 select actor,id,'2026-09-16','rejection','mobile','{"specialPolicy":{"exceptionStatus":"pending","exceptionRequestedAmount":50000,"replacementAmount":20000}}' from public.customers where user_id=actor returning id into sid;
 perform public.review_special_sale_atomic(sid,false);
 select data into day_data from public.daily_records where user_id=actor;
 if day_data->>'specialReplacementPay'<>'70000' or day_data->'matrix'<>'[[1]]' then raise exception 'base payout or unrelated data changed'; end if;
 -- Existing permissions still hide the other employee's data from a normal employee.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 if exists(select 1 from public.customer_sales where user_id<>actor) then raise exception 'employee isolation failed'; end if;
end $$;
reset role;
create trigger integrity_failure before delete or update on public.customer_sales for each row execute function pg_temp.integrity_failure();
set local role authenticated;
do $$
declare actor uuid; admin_actor uuid; sid uuid; before_state jsonb;
begin
 select employee,admin into actor,admin_actor from integrity_users;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_actor,'role','authenticated')::text,true);
 insert into public.customer_sales(user_id,customer_id,sale_date,metric_label,source_type,source_meta)
 select actor,id,'2026-09-16','INTEGRITY_fail','mobile','{"specialPolicy":{"exceptionStatus":"pending","exceptionRequestedAmount":50000}}' from public.customers where user_id=actor returning id into sid;
 before_state:=pg_temp.integrity_snapshot(actor);
 begin
  perform public.review_special_sale_atomic(sid,true);
  raise exception 'expected injected review failure';
 exception when others then if sqlerrm<>'INTEGRITY_INJECTED_FAILURE' then raise; end if; end;
 if pg_temp.integrity_snapshot(actor)<>before_state then raise exception 'partial approval persisted'; end if;
end $$;
reset role;
-- Preserve month-close enforcement; temporary config and fixture rows roll back.
insert into public.app_config(config_key,value) values('locked_months','["2026-09"]')
on conflict(config_key) do update set value='["2026-09"]';
set local role authenticated;
do $$
declare actor uuid; admin_actor uuid; sid uuid; before_state jsonb; meta jsonb; day_data jsonb;
begin
 select employee,admin into actor,admin_actor from integrity_users;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 select id,source_meta into sid,meta from public.customer_sales where user_id=actor and metric_label='approval';
 select data into day_data from public.daily_records where user_id=actor;
 before_state:=pg_temp.integrity_snapshot(actor);
 begin
  perform public.delete_sale_atomic(actor,sid,meta,day_data,day_data);
  raise exception 'expected month lock rejection';
 exception when insufficient_privilege then null; end;
 if pg_temp.integrity_snapshot(actor)<>before_state then raise exception 'locked delete changed data'; end if;
end $$;
reset role;
select 'PASS: delete atomicity/cascade/stale guard/repeat, review atomicity/idempotency/base payout, employee isolation' as result;
rollback;
