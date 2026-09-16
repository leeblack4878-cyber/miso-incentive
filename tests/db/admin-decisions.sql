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

create function pg_temp.fail_profile() returns trigger language plpgsql as $$ begin if new.name='FAIL_PROFILE' then raise exception 'INJECTED_PROFILE';end if;return new;end $$;
create trigger test_fail_profile before update on public.profiles for each row execute function pg_temp.fail_profile();
create function pg_temp.fail_career() returns trigger language plpgsql as $$ begin if new.quarter='2099-Q1' then raise exception 'INJECTED_CAREER';end if;return new;end $$;
create trigger test_fail_career before insert on public.career_eval_decisions for each row execute function pg_temp.fail_career();
set local role authenticated;
do $$
declare actor uuid; admin_actor uuid; req bigint; decision jsonb; result jsonb;
begin
 select employee,admin into actor,admin_actor from integrity_users;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 insert into public.profile_edit_requests(user_id,changes,status) values(actor,'{"name":"FAIL_PROFILE"}','pending') returning id into req;
 begin
  perform public.decide_profile_edit_atomic(req,true);raise exception 'expected employee approval denial';
 exception when others then if sqlerrm not in ('SALE_UPDATE_MISMATCH','SALE_NOT_FOUND') and sqlstate<>'42501' then raise;end if;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_actor,'role','authenticated')::text,true);
 begin
  perform public.decide_profile_edit_atomic(req,true);raise exception 'expected injected profile failure';
 exception when others then if sqlerrm<>'INJECTED_PROFILE' then raise;end if;end;
 if (select status from public.profile_edit_requests where id=req)<>'pending' then raise exception 'approval partially persisted';end if;
 result:=public.decide_profile_edit_atomic(req,false);
 if (select status from public.profile_edit_requests where id=req)<>'rejected' then raise exception 'rejection failed';end if;
 decision:=jsonb_build_object('user_id',actor,'quarter','2099-Q1','score',100,'result','PASS','action','promote_manager','consecutive_fail_count',0);
 begin
  perform public.save_career_decision_atomic(decision,'사원');raise exception 'expected career failure';
 exception when others then if sqlerrm<>'INJECTED_CAREER' then raise;end if;end;
 if (select position from public.profiles where id=actor)<>'사원' then raise exception 'position partially persisted';end if;
 decision:=jsonb_set(decision,'{quarter}','"2026-Q3"');
 result:=public.save_career_decision_atomic(decision,'사원');
 if (select position from public.profiles where id=actor)<>'매니저' or not exists(select 1 from public.career_eval_decisions where user_id=actor and quarter='2026-Q3') then raise exception 'final decision incomplete';end if;
 begin
  perform public.save_career_decision_atomic(decision,'사원');raise exception 'expected stale position denial';
 exception when others then if sqlerrm<>'SALE_STALE_DATA' then raise;end if;end;
end $$;
rollback;
