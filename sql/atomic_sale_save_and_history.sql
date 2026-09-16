alter table public.spot_claims add column if not exists source_sale_id uuid references public.customer_sales(id) on delete cascade;
create index if not exists spot_claims_source_sale_idx on public.spot_claims(source_sale_id);
-- Existing RLS, policies and amounts remain authoritative. No grants on tables change.
create or replace function public.save_sale_atomic(
 p_user_id uuid,p_sale_id uuid,p_customer_name text,p_sale_date date,
 p_source_type text,p_metric_label text,p_meta jsonb,p_tasks jsonb,p_expenses jsonb,
 p_spot jsonb,p_credit jsonb,p_expected_day jsonb,p_next_day jsonb,p_edit boolean,
 p_expected_meta jsonb,p_expected_children jsonb
) returns jsonb language plpgsql security invoker set search_path=public as $$
declare
 v_sale public.customer_sales; v_customer uuid; v_day jsonb; v_count integer;
 v_children jsonb; v_closed_types text[]; v_team boolean:=coalesce((p_meta->>'teamOnly')::boolean,false);
begin
 if auth.uid() is null or not(p_user_id=auth.uid() or public.can_write_target(p_user_id)) then raise exception 'SALE_WRITE_FORBIDDEN' using errcode='42501'; end if;
 if p_sale_id is null or p_sale_date is null or nullif(trim(p_customer_name),'') is null or p_source_type not in ('mobile','extra') or jsonb_typeof(p_meta)<>'object' then raise exception 'SALE_INVALID_PAYLOAD'; end if;
 -- Serialize new records for the same seller/day as well as existing records.
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text||p_sale_date::text,0));
 if p_edit then
  select * into v_sale from public.customer_sales where id=p_sale_id and user_id=p_user_id for update;
  if not found then raise exception 'SALE_NOT_FOUND'; end if;
  if v_sale.source_meta is distinct from p_expected_meta or v_sale.sale_date<>p_sale_date or v_sale.source_type<>p_source_type then raise exception 'SALE_STALE_DATA'; end if;
  if coalesce((v_sale.source_meta->>'teamOnly')::boolean,false) or v_team then raise exception 'SALE_INVALID_PAYLOAD'; end if;
  perform 1 from public.customer_tasks where user_id=p_user_id and source_sale_id=p_sale_id order by id for update;
  perform 1 from public.sales_expenses where user_id=p_user_id and source_sale_id=p_sale_id order by id for update;
  select jsonb_build_object('tasks',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.customer_tasks t where user_id=p_user_id and source_sale_id=p_sale_id),'expenses',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.sales_expenses t where user_id=p_user_id and source_sale_id=p_sale_id)) into v_children;
  if v_children is distinct from p_expected_children then raise exception 'SALE_STALE_DATA'; end if;
 end if;
 if v_team then
  if p_next_day is not null or p_credit is null then raise exception 'SALE_INVALID_PAYLOAD'; end if;
 else
  if p_credit is not null or jsonb_typeof(p_next_day) is distinct from 'object' then raise exception 'SALE_INVALID_PAYLOAD'; end if;
  select data into v_day from public.daily_records where user_id=p_user_id and work_date=p_sale_date for update;
  if v_day is distinct from p_expected_day then raise exception 'SALE_STALE_DATA'; end if;
 end if;
 select id into v_customer from public.customers where user_id=p_user_id and customer_name=trim(p_customer_name);
 if v_customer is null then
  insert into public.customers(user_id,customer_name,first_sale_date,last_sale_date) values(p_user_id,trim(p_customer_name),p_sale_date,p_sale_date) returning id into v_customer;
 else
  update public.customers set last_sale_date=p_sale_date,updated_at=now() where id=v_customer and user_id=p_user_id;
  get diagnostics v_count=row_count; if v_count<>1 then raise exception 'SALE_CUSTOMER_MISMATCH'; end if;
 end if;
 if p_edit then
  update public.customer_sales set customer_id=v_customer,metric_label=p_metric_label,source_meta=p_meta,schema_version=3 where id=p_sale_id and user_id=p_user_id;
  get diagnostics v_count=row_count; if v_count<>1 then raise exception 'SALE_UPDATE_MISMATCH'; end if;
  -- Completed and cancelled history is immutable during sale editing.
  update public.customer_tasks set customer_id=v_customer where source_sale_id=p_sale_id and user_id=p_user_id;
  select array_agg(task_type) into v_closed_types from public.customer_tasks where source_sale_id=p_sale_id and user_id=p_user_id and status in ('completed','cancelled');
  delete from public.customer_tasks where source_sale_id=p_sale_id and user_id=p_user_id and status not in ('completed','cancelled');
  delete from public.sales_expenses where source_sale_id=p_sale_id and user_id=p_user_id;
 else
  insert into public.customer_sales(id,user_id,customer_id,sale_date,metric_label,source_type,source_meta,schema_version) values(p_sale_id,p_user_id,v_customer,p_sale_date,p_metric_label,p_source_type,p_meta,3);
 end if;
 insert into public.customer_tasks(user_id,customer_id,source_sale_id,task_type,title,base_date,retention_days,due_date,status,note,target_plan,task_meta)
 select p_user_id,v_customer,p_sale_id,task_type,title,base_date,retention_days,due_date,'pending',note,target_plan,coalesce(task_meta,'{}') from jsonb_to_recordset(coalesce(p_tasks,'[]')) as t(task_type text,title text,base_date date,retention_days integer,due_date date,note text,target_plan text,task_meta jsonb)
 where not(task_type like 'payment3_%' and task_type=any(coalesce(v_closed_types,'{}')));
 insert into public.sales_expenses(user_id,source_sale_id,expense_date,amount,category,customer_name,memo)
 select p_user_id,p_sale_id,expense_date,amount,category,p_customer_name,memo from jsonb_to_recordset(coalesce(p_expenses,'[]')) as e(expense_date date,amount numeric,category text,memo text);
 if p_spot is not null then
  if p_edit then raise exception 'SALE_INVALID_PAYLOAD'; end if;
  insert into public.spot_claims(source_sale_id,policy_id,user_id,claim_date,customer_name,status,source_context,direct_title,direct_amount,direct_memo)
  values(p_sale_id,(p_spot->>'policy_id')::uuid,p_user_id,p_sale_date,p_customer_name,'pending','mobile',p_spot->>'direct_title',(p_spot->>'direct_amount')::numeric,p_spot->>'direct_memo');
 end if;
 if v_team then
  insert into public.team_sales_credits(seller_id,credited_store,sale_date,source_type,source_sale_id,source_refs,metrics,is_completed,note)
  values(p_user_id,p_credit->>'credited_store',p_sale_date,'mobile',p_sale_id,'[]',p_credit->'metrics',true,p_credit->>'note');
 else
  insert into public.daily_records(user_id,work_date,data) values(p_user_id,p_sale_date,p_next_day)
  on conflict(user_id,work_date) do update set data=excluded.data,updated_at=now();
  get diagnostics v_count=row_count; if v_count<>1 then raise exception 'SALE_DAILY_WRITE_MISMATCH'; end if;
 end if;
 return jsonb_build_object('sale_count',1,'sale_id',p_sale_id,'customer_id',v_customer,'daily_data',p_next_day);
end; $$;
revoke all on function public.save_sale_atomic(uuid,uuid,text,date,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,boolean,jsonb,jsonb) from public,anon;
grant execute on function public.save_sale_atomic(uuid,uuid,text,date,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,boolean,jsonb,jsonb) to authenticated;
