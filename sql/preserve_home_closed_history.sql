-- Preserve existing RPC signature, ACL, RLS and amount rules.
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
  v_history_ids uuid[];
  v_voided_ids uuid[];
  v_history_count integer;
begin
  if auth.uid() is null or not (p_user_id = auth.uid() or public.can_write_target(p_user_id)) then
    raise exception 'HOME_WRITE_FORBIDDEN' using errcode = '42501';
  end if;
  if v_expected_orders = 0 or v_expected_orders <> v_expected_sales then
    raise exception 'HOME_BUNDLE_INVALID';
  end if;

  if cardinality(p_replace_sale_ids) > 0 then
    -- Preserve closed history IDs/timestamps/metadata while replacing sale IDs.
    perform 1 from public.customer_tasks where user_id=p_user_id and source_sale_id=any(p_replace_sale_ids) order by id for update;
    select array_agg(id) into v_history_ids from public.customer_tasks where user_id=p_user_id and source_sale_id=any(p_replace_sale_ids) and status in ('completed','cancelled');
  update public.customer_tasks set source_sale_id=null where user_id=p_user_id and id=any(v_history_ids);
    get diagnostics v_history_count=row_count;
    if v_history_count<>coalesce(cardinality(v_history_ids),0) then raise exception 'HOME_HISTORY_MISMATCH'; end if;
    delete from public.customer_tasks where user_id = p_user_id and source_sale_id = any(p_replace_sale_ids);
    perform 1 from public.sales_expenses where user_id=p_user_id and source_sale_id=any(p_replace_sale_ids) order by id for update;
    select array_agg(id) into v_voided_ids from public.sales_expenses where user_id=p_user_id and source_sale_id=any(p_replace_sale_ids) and voided_at is not null;
    update public.sales_expenses set source_sale_id=null where user_id=p_user_id and id=any(v_voided_ids);
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

  update public.customer_tasks set source_sale_id=(p_sales->0->>'id')::uuid,customer_id=(p_sales->0->>'customer_id')::uuid where user_id=p_user_id and id=any(v_history_ids);
  get diagnostics v_history_count=row_count;
  if v_history_count<>coalesce(cardinality(v_history_ids),0) then raise exception 'HOME_HISTORY_MISMATCH'; end if;

  update public.sales_expenses set source_sale_id=(p_sales->0->>'id')::uuid where user_id=p_user_id and id=any(v_voided_ids);

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
