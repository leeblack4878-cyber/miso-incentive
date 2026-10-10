-- Dedicated transaction-only fixtures. Never commits users or customer records.
begin;
select set_config('obtest.a',gen_random_uuid()::text,true),set_config('obtest.b',gen_random_uuid()::text,true),set_config('obtest.manager',gen_random_uuid()::text,true),set_config('obtest.pending',gen_random_uuid()::text,true);
insert into auth.users(id,email,raw_user_meta_data) select current_setting('obtest.'||key)::uuid,'ob-rls-'||current_setting('obtest.'||key)||'@example.test','{}'::jsonb from unnest(array['a','b','manager','pending']) key;
delete from public.profiles where id in (current_setting('obtest.a')::uuid,current_setting('obtest.b')::uuid,current_setting('obtest.manager')::uuid,current_setting('obtest.pending')::uuid);
insert into public.profiles(id,name,store_name,role,position,active,status) values
(current_setting('obtest.a')::uuid,'OB_TEST_A','OB_STORE_A','employee','사원',true,'approved'),
(current_setting('obtest.b')::uuid,'OB_TEST_B','OB_STORE_B','employee','사원',true,'approved'),
(current_setting('obtest.manager')::uuid,'OB_TEST_MANAGER','OB_STORE_A','manager','점장',true,'approved'),
(current_setting('obtest.pending')::uuid,'OB_TEST_PENDING','OB_STORE_A','employee','사원',true,'pending');
select set_config('request.jwt.claim.sub',current_setting('obtest.a'),true);
set local role authenticated;
do $$ declare r uuid; r2 uuid; key uuid:=gen_random_uuid(); begin
 r:=public.append_ob_contact(key,'테스트고객',' u 001 ','010-1234-5678','기변 권유','통화 완료','관심 있음',null,null,'첫 연락');
 r2:=public.append_ob_contact(key,'테스트고객','U001','01012345678','기변 권유','통화 완료','관심 있음',null,null,'첫 연락');
 if r<>r2 or (select count(*) from public.ob_contact_logs)<>1 then raise exception 'retry duplicated record'; end if;
 if not exists(select 1 from public.ob_contact_logs where id=r and user_id=auth.uid() and employee_name='OB_TEST_A' and store_name='OB_STORE_A' and subscription_number='U001' and contact_date=(now() at time zone 'Asia/Seoul')::date) then raise exception 'server snapshot mismatch'; end if;
 perform public.append_ob_contact(gen_random_uuid(),'테스트고객','U001','01012345678','선약 안내','기타','관심 있음',null,null,'두번째 연락');
 if (select count(*) from public.ob_contact_logs where subscription_number='U001')<>2 or (select count(*) from public.ob_contact_logs where reaction is null)<>1 then raise exception 'history or nonconnected reaction mismatch'; end if;
 begin perform public.append_ob_contact(gen_random_uuid(),'테스트고객','X','01012345678','기변 권유','통화 완료',null,null,null,'');raise exception 'unexpected success';exception when others then if sqlerrm='unexpected success' then raise;end if;end;
 begin insert into public.ob_contact_logs(request_id,user_id,employee_name,store_name,subscription_number,customer_name,phone,purpose,call_result) values(gen_random_uuid(),auth.uid(),'forged','forged','X','X','01012345678','기변 권유','부재');raise exception 'unexpected success';exception when insufficient_privilege then null;end;
 begin update public.ob_contact_logs set store_name='forged';raise exception 'unexpected success';exception when insufficient_privilege then null;end;
 begin delete from public.ob_contact_logs;raise exception 'unexpected success';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('obtest.b'),true);
set local role authenticated;
do $$ begin if (select count(*) from public.ob_contact_logs)<>0 then raise exception 'other employee leaked';end if;perform public.append_ob_contact(gen_random_uuid(),'다른고객','U001','01012345678','고객 케어','부재',null,null,null,'다른매장');end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('obtest.manager'),true);
set local role authenticated;
do $$ begin if (select count(*) from public.ob_contact_logs)<>2 or exists(select 1 from public.ob_contact_logs where store_name='OB_STORE_B') then raise exception 'manager store boundary failed';end if;end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('obtest.pending'),true);
set local role authenticated;
do $$ begin if (select count(*) from public.ob_contact_logs)<>0 then raise exception 'unapproved read leaked';end if;begin perform public.append_ob_contact(gen_random_uuid(),'X','X','01012345678','고객 케어','부재');raise exception 'unexpected success';exception when others then if sqlerrm='unexpected success' then raise;end if;end;end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$ begin begin perform count(*) from public.ob_contact_logs;raise exception 'unexpected success';exception when insufficient_privilege then null;end;begin perform public.append_ob_contact(gen_random_uuid(),'X','X','01012345678','고객 케어','부재');raise exception 'unexpected success';exception when insufficient_privilege then null;end;end $$;
reset role;
rollback;
select 'OB RLS, server snapshots, required fields, retry idempotency and history passed; all fixtures rolled back' as result;
