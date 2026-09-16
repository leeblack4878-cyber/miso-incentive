-- Run only against the dedicated staging project. All fixtures roll back.
-- This tests real RPC/RLS as authenticated, but does not replace browser/Auth E2E.
BEGIN;
DO $$ BEGIN
 IF to_regclass('e2e_legacy.profiles') IS NULL OR EXISTS(SELECT 1 FROM public.profiles) THEN
  RAISE EXCEPTION 'Requires the empty dedicated staging schema before browser fixtures';
 END IF;
END $$;
CREATE TEMP TABLE e2e_context AS SELECT gen_random_uuid() AS employee, gen_random_uuid() AS other_employee;
GRANT SELECT ON e2e_context TO authenticated;
INSERT INTO auth.users(id,email,raw_user_meta_data)
SELECT employee,'e2e.sql.owner@example.test','{}'::jsonb FROM e2e_context
UNION ALL SELECT other_employee,'e2e.sql.other@example.test','{}'::jsonb FROM e2e_context;
-- Replace only the two new trigger-created fixture profiles; existing users are untouched.
DELETE FROM public.profiles WHERE id IN (SELECT employee FROM e2e_context UNION SELECT other_employee FROM e2e_context);
INSERT INTO public.profiles(id,name,store_name,position,role,active,status,must_change_password)
SELECT employee,'E2E_SQL_owner','E2E_SQL_store','사원','employee',true,'approved',false FROM e2e_context
UNION ALL SELECT other_employee,'E2E_SQL_other','E2E_SQL_store','사원','employee',true,'approved',false FROM e2e_context;

CREATE FUNCTION pg_temp.e2e_snapshot(actor uuid) RETURNS jsonb LANGUAGE sql AS $$
SELECT jsonb_build_object(
 'orders',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]') FROM public.home_orders t WHERE user_id=actor),
 'sales',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]') FROM public.customer_sales t WHERE user_id=actor),
 'tasks',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]') FROM public.customer_tasks t WHERE user_id=actor),
 'expenses',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]') FROM public.sales_expenses t WHERE user_id=actor),
 'daily',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]') FROM public.daily_records t WHERE user_id=actor));
$$;
CREATE FUNCTION pg_temp.e2e_save(actor uuid,customer uuid,smart boolean,completed boolean,bad_expense boolean DEFAULT false,foreign_order bigint DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
 orders jsonb := '[]'; sales jsonb := '[]'; sid uuid; primary_sale uuid;
 products text[] := ARRAY['homeTv','internet500']; product text;
 old_sales uuid[]; old_orders bigint[]; outcome jsonb;
BEGIN
 SELECT coalesce(array_agg(id),'{}') INTO old_sales FROM public.customer_sales WHERE user_id=actor;
 SELECT coalesce(array_agg(id),'{}') INTO old_orders FROM public.home_orders WHERE user_id=actor;
 IF foreign_order IS NOT NULL THEN old_orders:=array_append(old_orders,foreign_order); END IF;
 IF smart THEN products:=array_append(products,'smartHome'); END IF;
 FOREACH product IN ARRAY products LOOP
  sid:=gen_random_uuid(); primary_sale:=coalesce(primary_sale,sid);
  orders:=orders||jsonb_build_array(jsonb_build_object('user_id',actor,'customer_id',customer,'customer_name','E2E_SQL_customer',
   'product_type',product,'source_group',CASE WHEN product='homeTv' THEN 'homeBase' ELSE 'homeFlat' END,
   'source_key',CASE WHEN product='internet500' THEN 'home500Only' ELSE product END,
   'network_type','household','sale_type','normal','status',CASE WHEN completed THEN 'completed' ELSE 'pending' END,
   'applied_at','2026-09-16T03:00:00Z','source_work_date','2026-09-16',
   'completed_at',CASE WHEN completed THEN '2026-09-16T03:00:00Z' END,
   'actual_install_date',CASE WHEN completed THEN '2026-09-16' END,'schema_version',3));
  sales:=sales||jsonb_build_array(jsonb_build_object('id',sid,'user_id',actor,'customer_id',customer,'sale_date','2026-09-16',
   'metric_label',product,'source_type','home_order','schema_version',3,'source_meta','{}'::jsonb));
 END LOOP;
 outcome:=public.save_home_bundle_atomic(p_user_id=>actor,p_orders=>orders,p_sales=>sales,
  p_tasks=>jsonb_build_array(jsonb_build_object('user_id',actor,'customer_id',customer,'source_sale_id',primary_sale,
   'task_type','custom','title','E2E_SQL_task','base_date','2026-09-16','due_date','2026-09-20','status','pending','task_meta','{}'::jsonb)),
  p_expenses=>jsonb_build_array(jsonb_build_object('user_id',actor,'source_sale_id',CASE WHEN bad_expense THEN gen_random_uuid() ELSE primary_sale END,
   'expense_date','2026-09-16','amount',33000,'category','오퍼','customer_name','E2E_SQL_customer','memo','E2E_SQL_expense')),
  p_replace_sale_ids=>old_sales,p_replace_order_ids=>old_orders,
  p_daily_record=>jsonb_build_object('groups',jsonb_build_object('homeBase',jsonb_build_object('homeTv',CASE WHEN completed THEN 1 ELSE 0 END),
   'homeFlat',jsonb_build_object('home500Only',CASE WHEN completed THEN 1 ELSE 0 END,'smartHome',CASE WHEN completed AND smart THEN 1 ELSE 0 END))),
  p_work_date=>'2026-09-16');
 RETURN outcome;
END $$;
SET LOCAL ROLE authenticated;
DO $$
DECLARE actor uuid; other_actor uuid; customer uuid; other_customer uuid; foreign_id bigint;
 before_state jsonb; other_state jsonb; outcome jsonb; state boolean; deleted integer;
BEGIN
 SELECT employee,other_employee INTO actor,other_actor FROM e2e_context;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',other_actor,'role','authenticated')::text,true);
 INSERT INTO public.customers(user_id,customer_name) VALUES(other_actor,'E2E_SQL_other') RETURNING id INTO other_customer;
 PERFORM pg_temp.e2e_save(other_actor,other_customer,false,false);
 SELECT id INTO foreign_id FROM public.home_orders WHERE user_id=other_actor LIMIT 1;
 other_state:=pg_temp.e2e_snapshot(other_actor);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 INSERT INTO public.customers(user_id,customer_name) VALUES(actor,'E2E_SQL_owner') RETURNING id INTO customer;
 PERFORM pg_temp.e2e_save(actor,customer,false,false);
 FOREACH state IN ARRAY ARRAY[false,true] LOOP
  outcome:=pg_temp.e2e_save(actor,customer,true,state);
  IF (outcome->>'order_count')::integer<>3 OR (outcome->>'sale_count')::integer<>3 THEN RAISE EXCEPTION 'wrong insert counts'; END IF;
  PERFORM pg_temp.e2e_save(actor,customer,true,state);
  IF (SELECT count(*) FROM public.home_orders WHERE user_id=actor)<>3 OR
     (SELECT count(*) FROM public.customer_sales WHERE user_id=actor)<>3 OR
     (SELECT count(*) FROM public.customer_tasks WHERE user_id=actor)<>1 OR
     (SELECT count(*) FROM public.sales_expenses WHERE user_id=actor)<>1 OR
     (SELECT count(*) FROM public.daily_records WHERE user_id=actor)<>1 THEN RAISE EXCEPTION 'duplicate or missing rows'; END IF;
  IF EXISTS(SELECT 1 FROM public.home_orders WHERE user_id=actor AND (status<>CASE WHEN state THEN 'completed' ELSE 'pending' END OR actual_install_date IS DISTINCT FROM CASE WHEN state THEN '2026-09-16'::date END)) THEN RAISE EXCEPTION 'wrong status/date'; END IF;
  IF EXISTS(SELECT 1 FROM public.customer_sales s LEFT JOIN public.home_orders o ON o.id::text=s.source_ref WHERE s.user_id=actor AND o.id IS NULL) THEN RAISE EXCEPTION 'orphan sale'; END IF;
 END LOOP;
 before_state:=pg_temp.e2e_snapshot(actor);
 BEGIN
  PERFORM pg_temp.e2e_save(actor,customer,true,true,true);
  RAISE EXCEPTION 'expected FK failure';
 EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 IF pg_temp.e2e_snapshot(actor)<>before_state THEN RAISE EXCEPTION 'FK rollback failed'; END IF;
 BEGIN
  PERFORM pg_temp.e2e_save(actor,customer,true,true,false,foreign_id);
  RAISE EXCEPTION 'expected order mismatch';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'HOME_REPLACE_ORDERS_MISMATCH' THEN RAISE; END IF;
 END;
 IF pg_temp.e2e_snapshot(actor)<>before_state THEN RAISE EXCEPTION 'mismatch rollback failed'; END IF;
 DELETE FROM public.home_orders WHERE id=foreign_id;
 GET DIAGNOSTICS deleted=ROW_COUNT;
 IF deleted<>0 THEN RAISE EXCEPTION 'foreign delete allowed'; END IF;
 BEGIN
  PERFORM pg_temp.e2e_save(other_actor,other_customer,true,true);
  RAISE EXCEPTION 'expected forbidden';
 EXCEPTION WHEN insufficient_privilege THEN
  IF SQLERRM<>'HOME_WRITE_FORBIDDEN' THEN RAISE; END IF;
 END;
 PERFORM pg_temp.e2e_save(actor,customer,true,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',other_actor,'role','authenticated')::text,true);
 IF pg_temp.e2e_snapshot(other_actor)<>other_state THEN RAISE EXCEPTION 'other employee changed'; END IF;
END $$;
RESET ROLE;
SELECT 'PASS: pending/completed add, repeat save, FK rollback, mismatch rollback, foreign write/delete denied, retry' AS result;
ROLLBACK;
