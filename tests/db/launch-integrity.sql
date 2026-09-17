-- Dedicated staging only; all fixture writes and temporary fault injection roll back.
begin;
do $$ begin
 if to_regclass('e2e_legacy.profiles') is null or (select count(*) from public.profiles)<>2 or exists(
 select 1 from public.profiles p left join auth.users u on u.id=p.id where p.store_name<>'E2E_HOME_REGRESSION' or u.raw_app_meta_data->>'e2e_fixture' is distinct from 'home-bundle-v1') then raise exception 'STAGING_ONLY'; end if;
end $$;
create function public.e2e_cancel_failure() returns trigger language plpgsql as $$ begin if old.memo='E2E fail' and new.voided_at is not null then raise exception 'E2E_CANCEL_FAILURE'; end if; return new; end $$;
create trigger e2e_cancel_failure before update on public.sales_expenses for each row execute function public.e2e_cancel_failure();
set local role authenticated;
do $$
declare actor uuid; other_actor uuid; cid uuid; oid bigint; oid2 bigint; sid uuid:=gen_random_uuid(); sid2 uuid:=gen_random_uuid(); saved jsonb; task_id uuid; closed_id uuid; expense_id uuid;
begin
 select id into actor from public.profiles order by id limit 1;
 -- Profiles RLS is not yet impersonated; use known test account IDs if hidden.
 actor:='8931b753-0fba-44e9-80cd-a0f57e860a68';other_actor:='522f6107-4e20-4e9c-899b-413781dc2d74';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 insert into public.customers(user_id,customer_name) values(actor,'E2E cancellation') returning id into cid;
 insert into public.home_orders(user_id,customer_id,customer_name,product_type,network_type,sale_type,status,source_work_date,source_group,source_key)
 values(actor,cid,'E2E cancellation','internet500','household','normal','pending','2026-09-16','homeFlat','home500Only') returning id into oid;
 insert into public.home_orders(user_id,customer_id,customer_name,product_type,network_type,sale_type,status,source_work_date)
 values(actor,cid,'E2E cancellation','smartHome','household','normal','pending','2026-09-16') returning id into oid2;
 insert into public.customer_sales(id,user_id,customer_id,sale_date,metric_label,source_type,source_ref) values(sid,actor,cid,'2026-09-16','E2E','home_order',oid::text),(sid2,actor,cid,'2026-09-16','E2E','home_order',oid2::text);
 insert into public.customer_tasks(user_id,customer_id,source_sale_id,task_type,title,base_date,due_date,status) values(actor,cid,sid,'custom','E2E pending','2026-09-16','2026-09-20','pending') returning id into task_id;
 insert into public.customer_tasks(user_id,customer_id,source_sale_id,task_type,title,base_date,due_date,status,completed_at) values(actor,cid,sid,'custom','E2E completed','2026-09-16','2026-09-20','completed',now()) returning id into closed_id;
 insert into public.sales_expenses(user_id,source_sale_id,expense_date,amount,category,memo) values(actor,sid,'2026-09-16',33000,'오퍼','E2E fail') returning id into expense_id;
 begin perform public.cancel_home_orders_atomic(actor,array[oid],null);raise exception 'missing choice allowed';exception when others then if sqlerrm<>'HOME_CANCEL_EXPENSE_CHOICE_REQUIRED' then raise;end if;end;
 begin perform public.set_home_orders_status_atomic(actor,array[oid],'pending','cancelled');raise exception 'old client allowed';exception when others then if sqlerrm<>'HOME_CANCEL_EXPENSE_CHOICE_REQUIRED' then raise;end if;end;
 begin perform public.cancel_home_orders_atomic(actor,array[oid,oid+1000000],'exclude');raise exception 'stale batch allowed';exception when others then if sqlerrm<>'HOME_STATUS_SOURCE_MISMATCH' then raise;end if;end;
 begin perform public.cancel_home_orders_atomic(actor,array[oid],'exclude');raise exception 'fault not injected';exception when others then if sqlerrm<>'E2E_CANCEL_FAILURE' then raise;end if;end;
 if not exists(select 1 from public.home_orders where id=oid and status='pending') or not exists(select 1 from public.customer_tasks where id=task_id and status='pending') or not exists(select 1 from public.sales_expenses where id=expense_id and voided_at is null) then raise exception 'partial cancellation persisted';end if;
 update public.sales_expenses set memo='E2E ready' where id=expense_id;

 perform set_config('request.jwt.claims',jsonb_build_object('sub',other_actor,'role','authenticated')::text,true);
 begin perform public.cancel_home_orders_atomic(actor,array[oid],'exclude');raise exception 'foreign write allowed';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 saved:=public.cancel_home_orders_atomic(actor,array[oid],'exclude');
 if saved->>'updated_count'<>'1' then raise exception 'count mismatch';end if;
 if not exists(select 1 from public.customer_tasks where id=task_id and status='cancelled' and task_meta->>'cancel_reason'='home_cancelled') or not exists(select 1 from public.customer_tasks where id=closed_id and status='completed') then raise exception 'task history mismatch';end if;
 if not exists(select 1 from public.home_orders where id=oid2 and status='pending') then raise exception 'unselected order changed';end if;
 if not exists(select 1 from public.sales_expenses where id=expense_id and amount=33000 and voided_at is not null) then raise exception 'expense audit lost';end if;
 if (select coalesce(sum(amount),0) from public.sales_expenses where user_id=actor and voided_at is null)<>0 then raise exception 'expense still counted';end if;
 perform public.set_home_orders_status_atomic(actor,array[oid],'cancelled','pending');
 if not exists(select 1 from public.customer_tasks where id=task_id and status='cancelled') then raise exception 'closed task resurrected';end if;
 insert into public.sales_expenses(user_id,source_sale_id,expense_date,amount,category) values(actor,sid2,'2026-09-16',12000,'오퍼');
 perform public.cancel_home_orders_atomic(actor,array[oid2],'keep');
 if (select coalesce(sum(amount),0) from public.sales_expenses where user_id=actor and voided_at is null)<>12000 then raise exception 'incurred cost removed';end if;
 begin insert into public.user_achievements(user_id,badge_key,awarded_by) values(actor,'hs_m100',null);raise exception 'unverified award allowed';exception when insufficient_privilege then null;end;
 begin perform public.badge_source_snapshot(actor,'2026-09');raise exception 'snapshot exposed';exception when insufficient_privilege then null;end;
 begin perform public.commit_verified_badges(actor,'2026-09','fake',array['hs_m100']);raise exception 'award RPC exposed';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'cancellation atomicity, expense choice, history, foreign user, badge forgery: PASS' as result;
rollback;
