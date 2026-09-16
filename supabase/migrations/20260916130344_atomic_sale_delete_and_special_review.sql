-- No table grants or RLS policies change. Both RPCs run as the caller.
create or replace function public.delete_sale_atomic(
  p_user_id uuid, p_sale_id uuid, p_expected_meta jsonb,
  p_expected_day jsonb, p_next_day jsonb
) returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_sale public.customer_sales;
  v_day jsonb;
  v_count integer;
begin
  if auth.uid() is null or not (p_user_id=auth.uid() or public.can_write_target(p_user_id)) then
    raise exception 'SALE_WRITE_FORBIDDEN' using errcode='42501';
  end if;
  select * into v_sale from public.customer_sales where id=p_sale_id and user_id=p_user_id for update;
  if not found then raise exception 'SALE_NOT_FOUND'; end if;
  if v_sale.source_type not in ('mobile','extra') then raise exception 'SALE_UNSUPPORTED_SOURCE'; end if;
  if v_sale.source_meta is distinct from p_expected_meta then raise exception 'SALE_STALE_DATA'; end if;
  if coalesce((v_sale.source_meta->>'teamOnly')::boolean,false) then
    if p_next_day is not null then raise exception 'SALE_INVALID_PAYLOAD'; end if;
  else
    select data into v_day from public.daily_records where user_id=p_user_id and work_date=v_sale.sale_date for update;
    if not found then raise exception 'SALE_DAILY_NOT_FOUND'; end if;
    if v_day is distinct from p_expected_day then raise exception 'SALE_STALE_DATA'; end if;
    if p_next_day is null or jsonb_typeof(p_next_day)<>'object' then raise exception 'SALE_INVALID_PAYLOAD'; end if;
    update public.daily_records set data=p_next_day,updated_at=now() where user_id=p_user_id and work_date=v_sale.sale_date;
    get diagnostics v_count=row_count;
    if v_count<>1 then raise exception 'SALE_DAILY_WRITE_MISMATCH'; end if;
  end if;
  -- Existing FK cascades remove tasks, expenses and team credit in the same transaction.
  delete from public.customer_sales where id=p_sale_id and user_id=p_user_id;
  get diagnostics v_count=row_count;
  if v_count<>1 then raise exception 'SALE_DELETE_MISMATCH'; end if;
  return jsonb_build_object('sale_count',v_count,'daily_data',p_next_day);
end; $$;

create or replace function public.review_special_sale_atomic(p_sale_id uuid,p_approve boolean)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_sale public.customer_sales;
  v_policy jsonb;
  v_day jsonb;
  v_amount numeric;
  v_count integer;
  v_status text;
begin
  -- Mirrors the existing full-admin review screen; target access is still checked by RLS.
  if auth.uid() is null or not public.is_full_admin() then
    raise exception 'SALE_WRITE_FORBIDDEN' using errcode='42501';
  end if;
  if p_approve is null then raise exception 'SALE_INVALID_PAYLOAD'; end if;
  select * into v_sale from public.customer_sales where id=p_sale_id and source_type='mobile' for update;
  if not found then raise exception 'SALE_NOT_FOUND'; end if;
  v_policy:=v_sale.source_meta->'specialPolicy';
  if coalesce(v_policy->>'exceptionStatus','')<>'pending' then
    return jsonb_build_object('applied',false,'status',v_policy->>'exceptionStatus');
  end if;
  v_amount:=coalesce((v_policy->>case when p_approve then 'exceptionRequestedAmount' else 'replacementAmount' end)::numeric,0);
  if v_amount<0 or v_amount::text in ('NaN','Infinity','-Infinity') then raise exception 'SALE_INVALID_PAYLOAD'; end if;
  v_status:=case when p_approve then 'approved' else 'rejected' end;
  insert into public.daily_records(user_id,work_date,data) values(v_sale.user_id,v_sale.sale_date,'{}')
    on conflict(user_id,work_date) do nothing;
  select data into v_day from public.daily_records where user_id=v_sale.user_id and work_date=v_sale.sale_date for update;
  if not found then raise exception 'SALE_DAILY_NOT_FOUND'; end if;
  -- Preserve legacy matrix-array records and all unrelated daily fields.
  if jsonb_typeof(v_day)='array' then v_day:=jsonb_build_object('matrix',v_day); end if;
  v_day:=jsonb_set(coalesce(v_day,'{}'),'{specialReplacementPay}',to_jsonb(coalesce((v_day->>'specialReplacementPay')::numeric,0)+v_amount));
  update public.daily_records set data=v_day,updated_at=now() where user_id=v_sale.user_id and work_date=v_sale.sale_date;
  get diagnostics v_count=row_count;
  if v_count<>1 then raise exception 'SALE_DAILY_WRITE_MISMATCH'; end if;
  update public.customer_sales set source_meta=jsonb_set(source_meta,'{specialPolicy}',v_policy||jsonb_build_object(
    'exceptionStatus',v_status,'exceptionApprovedAmount',v_amount,'reviewedBy',auth.uid(),'reviewedAt',now())) where id=p_sale_id;
  get diagnostics v_count=row_count;
  if v_count<>1 then raise exception 'SALE_REVIEW_MISMATCH'; end if;
  return jsonb_build_object('applied',true,'status',v_status,'amount',v_amount);
end; $$;

revoke all on function public.delete_sale_atomic(uuid,uuid,jsonb,jsonb,jsonb) from public,anon;
revoke all on function public.review_special_sale_atomic(uuid,boolean) from public,anon;
grant execute on function public.delete_sale_atomic(uuid,uuid,jsonb,jsonb,jsonb) to authenticated;
grant execute on function public.review_special_sale_atomic(uuid,boolean) to authenticated;
