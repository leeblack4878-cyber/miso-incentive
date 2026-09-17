alter table public.sales_expenses add column if not exists voided_at timestamptz;
alter table public.sales_expenses add column if not exists void_reason text;
alter table public.home_orders add column if not exists cancel_expense_action text check(cancel_expense_action in ('exclude','keep'));

-- Runs for RPCs and direct status updates alike, under the caller's existing RLS.
create or replace function public.cascade_home_cancellation() returns trigger
language plpgsql security invoker set search_path=public as $$
declare v_sale_ids uuid[];
begin
  if new.status='cancelled' and old.status is distinct from 'cancelled' then
    if old.status<>'pending' then raise exception 'HOME_CANCEL_PENDING_REQUIRED'; end if;
    if new.cancel_expense_action is null then raise exception 'HOME_CANCEL_EXPENSE_CHOICE_REQUIRED'; end if;
    select array_agg(id) into v_sale_ids from public.customer_sales where user_id=new.user_id and source_type='home_order' and source_ref=new.id::text;
    update public.customer_tasks set status='cancelled',task_meta=coalesce(task_meta,'{}')||jsonb_build_object('cancel_reason','home_cancelled','cancelled_at',now())
      where user_id=new.user_id and source_sale_id=any(v_sale_ids) and status='pending';
    if new.cancel_expense_action='exclude' then
      update public.sales_expenses set voided_at=now(),void_reason='home_cancelled' where user_id=new.user_id and source_sale_id=any(v_sale_ids) and voided_at is null;
    end if;
  elsif new.status<>'cancelled' then new.cancel_expense_action:=null;
  end if;
  return new;
end $$;
revoke all on function public.cascade_home_cancellation() from public,anon,authenticated;
create trigger home_cancel_dependents before update of status on public.home_orders for each row execute function public.cascade_home_cancellation();

create or replace function public.cancel_home_orders_atomic(p_user_id uuid,p_order_ids bigint[],p_expense_action text) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare v_count integer; v_expected integer:=cardinality(p_order_ids);
begin
  if auth.uid() is null or not(p_user_id=auth.uid() or public.can_write_target(p_user_id)) then raise exception 'HOME_WRITE_FORBIDDEN' using errcode='42501'; end if;
  if coalesce(v_expected,0)=0 or p_expense_action is null or p_expense_action not in ('exclude','keep') then raise exception 'HOME_CANCEL_EXPENSE_CHOICE_REQUIRED'; end if;
  perform 1 from public.home_orders where user_id=p_user_id and id=any(p_order_ids) and status='pending' order by id for update;
  get diagnostics v_count=row_count;
  if v_count<>v_expected then raise exception 'HOME_STATUS_SOURCE_MISMATCH'; end if;
  update public.home_orders set status='cancelled',cancel_expense_action=p_expense_action,cancelled_at=now(),updated_at=now()
    where user_id=p_user_id and id=any(p_order_ids) and status='pending';
  get diagnostics v_count=row_count;
  if v_count<>v_expected then raise exception 'HOME_STATUS_UPDATE_MISMATCH'; end if;
  return jsonb_build_object('updated_count',v_count,'status','cancelled','expense_action',p_expense_action);
end $$;
revoke all on function public.cancel_home_orders_atomic(uuid,bigint[],text) from public,anon;
grant execute on function public.cancel_home_orders_atomic(uuid,bigint[],text) to authenticated;
