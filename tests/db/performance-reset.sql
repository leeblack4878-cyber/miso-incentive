-- Dedicated staging only; all fixtures and destructive effects roll back.
begin;
do $$ begin
 if to_regclass('e2e_legacy.profiles') is null then raise exception 'Dedicated staging required';end if;
end $$;
create temp table reset_test_users as select gen_random_uuid() employee,gen_random_uuid() inactive,gen_random_uuid() manager,gen_random_uuid() outsider;
grant select on reset_test_users to authenticated;
insert into auth.users(id,email,raw_user_meta_data)
select employee,'reset.owner@example.test','{}'::jsonb from reset_test_users union all
select inactive,'reset.inactive@example.test','{}'::jsonb from reset_test_users union all
select manager,'reset.manager@example.test','{}'::jsonb from reset_test_users union all
select outsider,'reset.outsider@example.test','{}'::jsonb from reset_test_users;
delete from public.profiles where id in(select employee from reset_test_users union select inactive from reset_test_users union select manager from reset_test_users union select outsider from reset_test_users);
insert into public.profiles(id,name,store_name,role,position,active,status)
select employee,'RESET_TEST','RESET_TEST_STORE','employee','사원',true,'approved' from reset_test_users union all
select inactive,'RESET_TEST_INACTIVE','RESET_TEST_STORE','employee','사원',false,'approved' from reset_test_users union all
select manager,'RESET_TEST_MANAGER','RESET_TEST_STORE','manager','점장',true,'approved' from reset_test_users union all
select outsider,'RESET_TEST_OUTSIDE','RESET_OTHER_STORE','manager','점장',true,'approved' from reset_test_users;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select manager from reset_test_users),'role','authenticated')::text,true);
insert into public.daily_records(user_id,work_date,data)
select employee,date '2026-09-03','{"custRegCount":5,"customerName":"PRIVATE"}'::jsonb from reset_test_users union all
select inactive,date '2026-09-04','{"custRegCount":3}'::jsonb from reset_test_users;
-- Isolated fixture month settings, also rolled back.
insert into public.app_config(config_key,value) values('locked_months','[]'),('policy_blocked_months','[]') on conflict(config_key) do update set value=excluded.value;
set local role authenticated;
do $$
declare u record; req uuid; own_req uuid; backup uuid; total integer;
begin
 select * into u from reset_test_users;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u.employee,'role','authenticated')::text,true);
 select sum((data->>'custRegCount')::integer) into total from public.get_my_store_performance_days('2026-09');
 if total<>8 then raise exception 'Inactive history missing: %',total;end if;
 if exists(select 1 from public.get_my_store_performance_days('2026-09') where data ? 'customerName') then raise exception 'PII leaked';end if;
 begin perform public.reset_my_month_performance('2026-09','당월실적초기화');raise exception 'MISSING_DENIAL';
 exception when others then if sqlerrm not like '다른 관리자의%' then raise;end if;end;
 begin perform private.reset_my_month_performance_unchecked('2026-09','당월실적초기화');raise exception 'MISSING_DENIAL';
 exception when insufficient_privilege then null;end;
 req:=public.request_performance_reset('2026-09','잘못 입력한 월 실적 수정');
 begin update public.performance_reset_requests set status='approved' where id=req;raise exception 'MISSING_DENIAL';
 exception when insufficient_privilege then null;end;
 begin perform public.request_performance_reset('2026-09','중복 요청 차단');raise exception 'MISSING_DENIAL';
 exception when others then if sqlerrm not like '이미 진행 중인%' then raise;end if;end;
 begin perform public.review_performance_reset(req,true,'self');raise exception 'MISSING_DENIAL';
 exception when others then if sqlerrm not like '본인 요청은%' then raise;end if;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u.outsider,'role','authenticated')::text,true);
 if exists(select 1 from public.performance_reset_requests where id=req) then raise exception 'Out of scope RLS leak';end if;
 begin perform public.review_performance_reset(req,true,'outside');raise exception 'MISSING_DENIAL';
 exception when others then if sqlerrm not like '본인 요청은%' then raise;end if;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u.manager,'role','authenticated')::text,true);
 own_req:=public.request_performance_reset('2026-09','관리자 본인 실적');
 begin perform public.review_performance_reset(own_req,true,'self');raise exception 'MISSING_DENIAL';
 exception when others then if sqlerrm not like '본인 요청은%' then raise;end if;end;
 perform public.cancel_performance_reset(own_req);
 perform public.review_performance_reset(req,false,'개별 수정 권장');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u.employee,'role','authenticated')::text,true);
 begin perform public.reset_my_month_performance('2026-09','당월실적초기화');raise exception 'MISSING_DENIAL';
 exception when others then if sqlerrm not like '다른 관리자의%' then raise;end if;end;
 req:=public.request_performance_reset('2026-09','다시 확인한 초기화 요청');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u.manager,'role','authenticated')::text,true);
 perform public.review_performance_reset(req,true,'확인 완료');
 if not exists(select 1 from public.daily_records where user_id=u.employee) then raise exception 'Approval deleted records';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u.employee,'role','authenticated')::text,true);
 begin perform public.reset_my_month_performance('2026-09',null);raise exception 'MISSING_DENIAL';
 exception when others then if sqlerrm not like '확인 문구%' then raise;end if;end;
 backup:=public.reset_my_month_performance('2026-09','당월실적초기화');
 if exists(select 1 from public.daily_records where user_id=u.employee and work_date='2026-09-03') then raise exception 'Reset failed';end if;
 if (select snapshot->'daily_records'->0->'data'->>'custRegCount' from public.performance_reset_backups where id=backup)<>'5' then raise exception 'Backup missing';end if;
 if not exists(select 1 from public.performance_reset_requests where id=req and status='executed' and backup_id=backup) then raise exception 'Audit missing';end if;
 begin perform public.reset_my_month_performance('2026-09','당월실적초기화');raise exception 'MISSING_DENIAL';
 exception when others then if sqlerrm not like '다른 관리자의%' then raise;end if;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u.manager,'role','authenticated')::text,true);
 if not exists(select 1 from public.daily_records where user_id=u.inactive) then raise exception 'Other employee data deleted';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u.inactive,'role','authenticated')::text,true);
 begin perform public.request_performance_reset('2026-09','비활성 요청 금지');raise exception 'MISSING_DENIAL';
 exception when others then if sqlerrm not like '활성화된%' then raise;end if;end;
end $$;
reset role;
update public.app_config set value='["2026-09"]' where config_key='locked_months';
set local role authenticated;
do $$ begin
 perform set_config('request.jwt.claims',jsonb_build_object('sub',(select employee from reset_test_users),'role','authenticated')::text,true);
 begin perform public.request_performance_reset('2026-09','마감 월 요청 금지');raise exception 'MISSING_DENIAL';
 exception when others then if sqlerrm not like '마감되었거나%' then raise;end if;end;
end $$;
rollback;
select 'PASS: inactive totals, privacy, scoped review, self review, duplicate, rejection, approval, backup, single-use, inactive and locked-month checks' as result;
