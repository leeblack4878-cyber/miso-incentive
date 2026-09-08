begin;

-- Home writes span several ledgers. Keep the existing RLS/manager scope and make
-- the whole request fail together when any row is rejected or missing.
create or replace function public.save_home_bundle_atomic(
  p_user_id uuid,
  p_orders jsonb,
  p_sales jsonb,
  p_tasks jsonb default '[]'::jsonb,
  p_expenses jsonb default '[]'::jsonb,
  p_spot_claim jsonb default null,
  p_team_credit jsonb default null,
  p_replace_sale_ids uuid[] default '{}'::uuid[],
  p_replace_order_ids bigint[] default '{}'::bigint[],
  p_daily_record jsonb default null,
  p_work_date date default null
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_order_count integer;
  v_sale_count integer;
  v_expected_orders integer := jsonb_array_length(coalesce(p_orders, '[]'::jsonb));
  v_expected_sales integer := jsonb_array_length(coalesce(p_sales, '[]'::jsonb));
  v_index integer;
  v_order_id bigint;
  v_order_ids jsonb := '[]'::jsonb;
begin
  if auth.uid() is null or not (p_user_id = auth.uid() or public.can_write_target(p_user_id)) then
    raise exception 'HOME_WRITE_FORBIDDEN' using errcode = '42501';
  end if;
  if v_expected_orders = 0 or v_expected_orders <> v_expected_sales then
    raise exception 'HOME_BUNDLE_INVALID';
  end if;

  if cardinality(p_replace_sale_ids) > 0 then
    delete from public.customer_tasks where user_id = p_user_id and source_sale_id = any(p_replace_sale_ids);
    delete from public.sales_expenses where user_id = p_user_id and source_sale_id = any(p_replace_sale_ids);
    delete from public.customer_sales where user_id = p_user_id and id = any(p_replace_sale_ids);
    get diagnostics v_sale_count = row_count;
    if v_sale_count <> cardinality(p_replace_sale_ids) then raise exception 'HOME_REPLACE_SALES_MISMATCH'; end if;
  end if;
  if cardinality(p_replace_order_ids) > 0 then
    delete from public.home_orders where user_id = p_user_id and id = any(p_replace_order_ids);
    get diagnostics v_order_count = row_count;
    if v_order_count <> cardinality(p_replace_order_ids) then raise exception 'HOME_REPLACE_ORDERS_MISMATCH'; end if;
  end if;

  v_order_count:=0; v_sale_count:=0;
  for v_index in 0..v_expected_orders-1 loop
    insert into public.home_orders(user_id,customer_name,customer_id,product_type,network_type,sale_type,status,applied_at,completed_at,source_work_date,source_group,source_key,main_tv_plan,planned_install_date,actual_install_date,schema_version)
    select user_id,customer_name,customer_id,product_type,network_type,sale_type,status,applied_at,completed_at,source_work_date,source_group,source_key,main_tv_plan,planned_install_date,actual_install_date,schema_version
    from jsonb_to_record(p_orders->v_index) as x(user_id uuid,customer_name text,customer_id uuid,product_type text,network_type text,sale_type text,status text,applied_at timestamptz,completed_at timestamptz,source_work_date date,source_group text,source_key text,main_tv_plan text,planned_install_date date,actual_install_date date,schema_version integer)
    returning id into v_order_id;
    v_order_ids:=v_order_ids||to_jsonb(v_order_id::text); v_order_count:=v_order_count+1;
    insert into public.customer_sales(id,user_id,customer_id,sale_date,metric_label,source_type,source_ref,schema_version,source_meta)
    select id,user_id,customer_id,sale_date,metric_label,source_type,v_order_id::text,schema_version,source_meta
    from jsonb_to_record(p_sales->v_index) as x(id uuid,user_id uuid,customer_id uuid,sale_date date,metric_label text,source_type text,schema_version integer,source_meta jsonb);
    v_sale_count:=v_sale_count+1;
  end loop;
  if v_order_count <> v_expected_orders or v_sale_count <> v_expected_sales then raise exception 'HOME_INSERT_COUNT_MISMATCH'; end if;

  if jsonb_array_length(coalesce(p_tasks, '[]'::jsonb)) > 0 then
    insert into public.customer_tasks(user_id,customer_id,source_sale_id,task_type,title,base_date,due_date,status,task_meta)
    select user_id,customer_id,source_sale_id,task_type,title,base_date,due_date,status,task_meta
    from jsonb_to_recordset(p_tasks) as x(user_id uuid,customer_id uuid,source_sale_id uuid,task_type text,title text,base_date date,due_date date,status text,task_meta jsonb);
  end if;
  if jsonb_array_length(coalesce(p_expenses, '[]'::jsonb)) > 0 then
    insert into public.sales_expenses(user_id,source_sale_id,expense_date,amount,category,customer_name,memo)
    select user_id,source_sale_id,expense_date,amount,category,customer_name,memo
    from jsonb_to_recordset(p_expenses) as x(user_id uuid,source_sale_id uuid,expense_date date,amount numeric,category text,customer_name text,memo text);
  end if;
  if p_spot_claim is not null then
    insert into public.spot_claims(policy_id,user_id,claim_date,customer_name,status,source_context,direct_title,direct_amount,direct_memo)
    select policy_id,user_id,claim_date,customer_name,status,source_context,direct_title,direct_amount,direct_memo
    from jsonb_to_record(p_spot_claim) as x(policy_id uuid,user_id uuid,claim_date date,customer_name text,status text,source_context text,direct_title text,direct_amount numeric,direct_memo text);
  end if;
  if p_team_credit is not null then
    insert into public.team_sales_credits(seller_id,credited_store,sale_date,source_type,source_sale_id,source_refs,metrics,is_completed,note)
    select seller_id,credited_store,sale_date,source_type,source_sale_id,v_order_ids,metrics,is_completed,note
    from jsonb_to_record(p_team_credit) as x(seller_id uuid,credited_store text,sale_date date,source_type text,source_sale_id uuid,source_refs jsonb,metrics jsonb,is_completed boolean,note text);
  end if;
  if p_daily_record is not null then
    insert into public.daily_records(user_id, work_date, data) values(p_user_id, p_work_date, p_daily_record)
    on conflict(user_id, work_date) do update set data = excluded.data;
  end if;
  return jsonb_build_object('order_count',v_order_count,'sale_count',v_sale_count,
    'primary_sale_id',p_sales->0->>'id','order_ids',v_order_ids);
end;
$$;

create or replace function public.delete_home_bundle_atomic(p_user_id uuid, p_anchor_sale_id uuid)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare v_anchor public.customer_sales; v_sale_ids uuid[]; v_order_ids bigint[]; v_count integer; v_order record; v_current numeric;
begin
  if auth.uid() is null or not (p_user_id = auth.uid() or public.can_write_target(p_user_id)) then raise exception 'HOME_WRITE_FORBIDDEN' using errcode='42501'; end if;
  select * into v_anchor from public.customer_sales where id=p_anchor_sale_id and user_id=p_user_id and source_type='home_order' for update;
  if not found then raise exception 'HOME_ANCHOR_NOT_FOUND'; end if;
  select array_agg(id), array_agg(source_ref::bigint) filter(where source_ref is not null and source_ref<>'') into v_sale_ids,v_order_ids
    from public.customer_sales where user_id=p_user_id and sale_date=v_anchor.sale_date and customer_id=v_anchor.customer_id and source_type='home_order';
  for v_order in select * from public.home_orders where user_id=p_user_id and id=any(v_order_ids) for update loop
    if v_order.status='completed' and v_order.actual_install_date is not null and v_order.source_group is not null and v_order.source_key is not null
       and not exists(select 1 from public.team_sales_credits c where c.source_type='home' and c.source_refs ? v_order.id::text) then
      select coalesce((data #>> array['groups',v_order.source_group,v_order.source_key])::numeric,0) into v_current
      from public.daily_records where user_id=p_user_id and work_date=v_order.actual_install_date for update;
      update public.daily_records set data=jsonb_set(data,array['groups',v_order.source_group,v_order.source_key],to_jsonb(greatest(0,v_current-1)),true)
      where user_id=p_user_id and work_date=v_order.actual_install_date;
      if not found then raise exception 'HOME_DELETE_DAILY_RECORD_NOT_FOUND'; end if;
    end if;
  end loop;
  delete from public.customer_tasks where user_id=p_user_id and source_sale_id=any(v_sale_ids);
  delete from public.sales_expenses where user_id=p_user_id and source_sale_id=any(v_sale_ids);
  delete from public.customer_sales where user_id=p_user_id and id=any(v_sale_ids);
  get diagnostics v_count=row_count;
  if v_count<>cardinality(v_sale_ids) then raise exception 'HOME_DELETE_SALES_MISMATCH'; end if;
  if cardinality(v_order_ids)>0 then
    delete from public.home_orders where user_id=p_user_id and id=any(v_order_ids);
    get diagnostics v_count=row_count;
    if v_count<>cardinality(v_order_ids) then raise exception 'HOME_DELETE_ORDERS_MISMATCH'; end if;
  end if;
  return jsonb_build_object('sale_count',cardinality(v_sale_ids),'order_count',coalesce(cardinality(v_order_ids),0));
end; $$;

create or replace function public.set_home_orders_status_atomic(
  p_user_id uuid, p_order_ids bigint[], p_expected_status text, p_new_status text,
  p_actual_install_date date default null, p_daily_record jsonb default null, p_work_date date default null
) returns jsonb language plpgsql security invoker set search_path=public as $$
declare v_expected integer:=cardinality(p_order_ids); v_count integer;
begin
  if auth.uid() is null or not (p_user_id=auth.uid() or public.can_write_target(p_user_id)) then raise exception 'HOME_WRITE_FORBIDDEN' using errcode='42501'; end if;
  if v_expected is null or v_expected=0 or p_new_status not in ('pending','completed','cancelled') then raise exception 'HOME_STATUS_INVALID'; end if;
  perform 1 from public.home_orders where user_id=p_user_id and id=any(p_order_ids) and status=p_expected_status for update;
  get diagnostics v_count=row_count;
  if v_count<>v_expected then raise exception 'HOME_STATUS_SOURCE_MISMATCH'; end if;
  if p_daily_record is not null then
    if p_work_date is null then raise exception 'HOME_STATUS_WORK_DATE_REQUIRED'; end if;
    insert into public.daily_records(user_id,work_date,data) values(p_user_id,p_work_date,p_daily_record)
    on conflict(user_id,work_date) do update set data=excluded.data;
  end if;
  update public.home_orders set status=p_new_status,
    completed_at=case when p_new_status='completed' then (p_actual_install_date::text||' 12:00:00')::timestamptz else null end,
    actual_install_date=case when p_new_status='completed' then p_actual_install_date else null end,
    cancelled_at=case when p_new_status='cancelled' then now() else null end, updated_at=now()
  where user_id=p_user_id and id=any(p_order_ids) and status=p_expected_status;
  get diagnostics v_count=row_count;
  if v_count<>v_expected then raise exception 'HOME_STATUS_UPDATE_MISMATCH'; end if;
  return jsonb_build_object('updated_count',v_count,'status',p_new_status);
end; $$;

revoke all on function public.save_home_bundle_atomic(uuid,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,uuid[],bigint[],jsonb,date) from public, anon;
grant execute on function public.save_home_bundle_atomic(uuid,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,uuid[],bigint[],jsonb,date) to authenticated;
revoke all on function public.delete_home_bundle_atomic(uuid,uuid) from public, anon;
grant execute on function public.delete_home_bundle_atomic(uuid,uuid) to authenticated;
revoke all on function public.set_home_orders_status_atomic(uuid,bigint[],text,text,date,jsonb,date) from public, anon;
grant execute on function public.set_home_orders_status_atomic(uuid,bigint[],text,text,date,jsonb,date) to authenticated;

commit;
