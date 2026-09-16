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

set local role authenticated;
do $$
declare actor uuid; other_actor uuid; sid uuid:=gen_random_uuid(); result jsonb; children jsonb; task_id uuid; before_state jsonb; actual jsonb;
 meta jsonb:='{"ri":0,"ci":0,"vasKeys":[],"policySnapshot":{"version":"kept"}}';
 d0 jsonb:='{"matrix":[[1]],"groups":{}}'; d1 jsonb:='{"matrix":[[2]],"groups":{}}';
 tasks jsonb:='[{"task_type":"custom","title":"약속","base_date":"2026-09-16","due_date":"2026-09-20","task_meta":{"keep":true}}]';
begin
 select employee,other_employee into actor,other_actor from integrity_users;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 -- Invalid child is rejected after parent writes, and all parent writes roll back.
 begin
  perform public.save_sale_atomic(actor,sid,'SAVE_customer','2026-09-16','mobile','MNP',meta,tasks,'[{"amount":1000,"expense_date":null}]',null,null,null,d0,false,null,null);
  raise exception 'expected child failure';
 exception when not_null_violation then null; end;
 if exists(select 1 from public.customer_sales where id=sid) or exists(select 1 from public.customers where user_id=actor) or exists(select 1 from public.daily_records where user_id=actor) then raise exception 'partial parent persisted'; end if;
 result:=public.save_sale_atomic(actor,sid,'SAVE_customer','2026-09-16','mobile','MNP',meta,tasks,'[{"amount":1000,"expense_date":"2026-09-16","category":"케이스"}]',null,null,null,d0,false,null,null);
 if result->>'sale_count'<>'1' or result->'daily_data'<>d0 then raise exception 'save mismatch'; end if;
 select id into task_id from public.customer_tasks where source_sale_id=sid;
 update public.customer_tasks set status='completed',completed_at=now() where id=task_id;
 select jsonb_build_object('tasks',(select jsonb_agg(to_jsonb(t) order by id) from public.customer_tasks t where source_sale_id=sid),'expenses',(select jsonb_agg(to_jsonb(t) order by id) from public.sales_expenses t where source_sale_id=sid)) into children;
 result:=public.save_sale_atomic(actor,sid,'SAVE_customer','2026-09-16','mobile','MNP 수정',meta,'[]','[]',null,null,d0,d1,true,meta,children);
 if not exists(select 1 from public.customer_tasks where id=task_id and status='completed' and task_meta->>'keep'='true') then raise exception 'closed history lost'; end if;
 if exists(select 1 from public.sales_expenses where source_sale_id=sid) then raise exception 'expenses not replaced'; end if;
 begin
  perform public.save_sale_atomic(actor,sid,'SAVE_customer','2026-09-16','mobile','stale',meta,'[]','[]',null,null,d0,d1,true,meta,children);
  raise exception 'expected stale rejection';
 exception when others then if sqlerrm<>'SALE_STALE_DATA' then raise; end if; end;
 -- Old daily-tagged mobile sales remain editable without rewriting their origin.
 update public.customer_sales set source_type='daily' where id=sid;
 select jsonb_build_object('tasks',(select jsonb_agg(to_jsonb(t) order by id) from public.customer_tasks t where source_sale_id=sid),'expenses','[]'::jsonb) into children;
 result:=public.save_sale_atomic(actor,sid,'SAVE_customer','2026-09-16','daily','legacy edit',meta,'[]','[]',null,null,d1,d1,true,meta,children);
 if not exists(select 1 from public.customer_sales where id=sid and source_type='daily' and metric_label='legacy edit') then raise exception 'legacy edit failed'; end if;
 update public.customer_sales set source_type='mobile' where id=sid;
 -- Another employee cannot invoke writes for the first employee.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',other_actor,'role','authenticated')::text,true);
 begin
  perform public.save_sale_atomic(actor,gen_random_uuid(),'foreign','2026-09-16','mobile','foreign',meta,'[]','[]',null,null,d1,d1,false,null,null);
  raise exception 'expected foreign denial';
 exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 result:=public.delete_sale_atomic(actor,sid,meta,d1,d0);
 if exists(select 1 from public.customer_tasks where id=task_id) then raise exception 'undo cascade failed'; end if;
end $$;
rollback;
