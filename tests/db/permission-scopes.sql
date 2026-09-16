-- Dedicated staging only. Authenticated Postgres role/RLS; NOT browser/Auth E2E.
-- All identities, role variants and changes are rolled back.
begin;
do $$ begin
 if to_regclass('e2e_legacy.profiles') is null or exists (
  select 1 from public.profiles p left join auth.users u on u.id=p.id
  where p.store_name<>'E2E_HOME_REGRESSION' or u.raw_app_meta_data->>'e2e_fixture' is distinct from 'home-bundle-v1'
 ) then raise exception 'Requires dedicated staging with only known E2E accounts'; end if;
end $$;
create temp table scope_fixture(id uuid,name text,store_name text,position text,role text);
insert into scope_fixture values
 ('a50a0979-acef-40b1-98b7-f05074f1c835','이강진','운영진','실장','admin'),
 ('f0329992-ced4-4407-b71d-ed58c5d74aaf','김진문','운영진','대표','admin'),
 ('6ba6651a-8e5b-4e21-a00d-1d2e0ff492bb','정유미','영업지원팀','팀장','admin'),
 ('9d1db3e4-1292-49bf-89f7-6d04a439a7e2','김솔이','운영진','담당','admin'),
 ('f2cc7718-b1f2-4cf1-8c5c-5b9ae6493da5','김진백','운영진','담당','admin'),
 ('471280af-a046-4d25-a27d-63a0c5978403','임성준','운영진','담당','admin');
insert into scope_fixture
select gen_random_uuid(),'SCOPE_'||n,store,'사원','employee' from (values
 (1,'본오3동_상록수역점'),(2,'본오3동_주민센터점'),(3,'월피동_성포역점'),
 (4,'광정동_산본점'),(5,'고잔동_법조타운점'),(6,'본오1동_본오중학교점'),
 (7,'신천동_삼미시장점'),(8,'신천동_삼미시장2호점'),(9,'대야동_롯데마트점'),
 (10,'장곡동_장곡역점'),(11,'거모동_도일시장점'),(12,'월곶동_월곶점'),(13,'은행동_은계사거리점'),
 (14,'SCOPE_unrelated')) s(n,store);
insert into scope_fixture values
 (gen_random_uuid(),'SCOPE_store_manager','대야동_롯데마트점','점장','manager'),
 (gen_random_uuid(),'SCOPE_area_position','대야동_롯데마트점','담당','manager');
-- Never overwrite an existing identity, even on staging.
do $$ begin
 if exists(select 1 from auth.users u join scope_fixture f on f.id=u.id) then raise exception 'Fixture identity collision'; end if;
end $$;
insert into auth.users(id,email,raw_user_meta_data) select id,'scope.'||id||'@example.test','{}' from scope_fixture;
delete from public.profiles where id in(select id from scope_fixture);
insert into public.profiles(id,name,store_name,position,role,active,status,must_change_password)
select id,name,store_name,position,role,true,'approved',false from scope_fixture;

-- Independent legacy oracle, kept only in this rollback test.
create function pg_temp.legacy_scope(v public.profiles,t public.profiles) returns boolean language sql as $$
 select coalesce(v.active=true and v.status='approved' and (
  (v.role in ('admin','super_admin') and v.name in ('이강진','김진문')) or
  (v.role in ('admin','super_admin') and v.name in ('정유미','김솔이') and t.name not in ('이강진','김진문')) or
  (v.role in ('admin','super_admin') and v.name='김진백' and t.store_name in
   ('본오3동_상록수역점','본오3동_주민센터점','월피동_성포역점','광정동_산본점','고잔동_법조타운점','본오1동_본오중학교점')) or
  (v.role in ('admin','super_admin') and v.name='임성준' and t.store_name in
   ('신천동_삼미시장점','신천동_삼미시장2호점','대야동_롯데마트점','장곡동_장곡역점','거모동_도일시장점','월곶동_월곶점','은행동_은계사거리점')) or
  (v.role='manager' and v.position<>'담당' and v.store_name=t.store_name)),false);
$$;
create temp table expected_scope as select v.id viewer,t.id target,pg_temp.legacy_scope(v,t) allowed
 from public.profiles v cross join public.profiles t;
grant select on expected_scope,scope_fixture to authenticated;
create function pg_temp.assert_scope() returns void language plpgsql as $$
declare row record;
begin
 for row in select * from expected_scope loop
  perform set_config('request.jwt.claim.sub',row.viewer::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',row.viewer,'role','authenticated')::text,true);
  if public.can_write_target(row.target) is distinct from row.allowed then raise exception 'Scope mismatch: % -> %',row.viewer,row.target; end if;
 end loop;
end $$;
set local role authenticated;
select pg_temp.assert_scope();
reset role;

-- Real name changes must preserve both access and executive exclusion.
select set_config('request.jwt.claim.sub','a50a0979-acef-40b1-98b7-f05074f1c835',true);
update public.profiles set name='RENAMED_'||name where id in(select id from scope_fixture where role='admin');
set local role authenticated;
select pg_temp.assert_scope();
do $$ begin
 perform set_config('request.jwt.claim.sub','a50a0979-acef-40b1-98b7-f05074f1c835',true);
 if not public.is_permission_admin() then raise exception 'Renamed permission admin lost access'; end if;
end $$;
reset role;

-- Exhaust role/status/active combinations for all six principals. Delete/insert
-- temporary profiles rather than bypassing the production protection trigger.
do $$
declare f record; r text; s text; a boolean; t public.profiles; v public.profiles; expected boolean; n integer:=0;
begin
 for f in select * from scope_fixture where role='admin' loop
  -- profiles_role_check currently permits these three roles only.
  foreach r in array array['employee','manager','admin'] loop
   foreach s in array array['approved','pending','rejected'] loop
    foreach a in array array[true,false] loop
     delete from public.profiles where id=f.id;
     insert into public.profiles(id,name,store_name,position,role,active,status)
      values(f.id,f.name,f.store_name,f.position,r,a,s);
     select * into v from public.profiles where id=f.id;
     perform set_config('request.jwt.claim.sub',f.id::text,true);
     for t in select * from public.profiles loop
      -- Oracle target names use their original identity after rename test.
      t.name:=coalesce((select name from scope_fixture where id=t.id),t.name);
      expected:=pg_temp.legacy_scope(v,t);
      if public.can_write_target(t.id) is distinct from expected then raise exception 'Role/status/active scope changed'; end if;
      n:=n+1;
     end loop;
     expected:=f.id='a50a0979-acef-40b1-98b7-f05074f1c835'::uuid and r in ('admin','super_admin') and s='approved' and a;
     if public.is_permission_admin() is distinct from expected then raise exception 'Permission admin guard changed'; end if;
    end loop;
   end loop;
  end loop;
  delete from public.profiles where id=f.id;
  insert into public.profiles(id,name,store_name,position,role,active,status)
   values(f.id,'RENAMED_'||f.name,f.store_name,f.position,'admin',true,'approved');
 end loop;
 raise notice 'Role/status/active checks: %',n;
end $$;

-- All six same-name impostors, including an admin role, gain no named grant.
create temp table impostors as select gen_random_uuid() id,name from scope_fixture where role='admin';
grant select on impostors to authenticated;
insert into auth.users(id,email,raw_user_meta_data) select id,'impostor.'||id||'@example.test','{}' from impostors;
delete from public.profiles where id in(select id from impostors);
insert into public.profiles(id,name,store_name,position,role,active,status)
select id,name,'SCOPE_unrelated','사원','admin',true,'approved' from impostors;
set local role authenticated;
do $$ declare f record; p record; expression text; allowed boolean;
begin
 select with_check into strict expression from pg_policies where schemaname='public' and tablename='team_sales_credits' and policyname='eligible users create team credits';
 for f in select * from impostors loop
  perform set_config('request.jwt.claim.sub',f.id::text,true);
  if public.is_permission_admin() then raise exception 'Impostor permission admin'; end if;
  for p in select id from scope_fixture loop
   if public.can_write_target(p.id) then raise exception 'Impostor gained target access'; end if;
  end loop;
  execute 'select '||expression||' from (select $1::uuid as seller_id) subject' into allowed using f.id;
  if allowed then raise exception 'Impostor gained support-sale eligibility'; end if;
 end loop;
 -- Renamed named principals + position-based 담당 keep support-sale eligibility;
 -- inactive and another seller ID still fail the original policy.
 for f in select * from scope_fixture loop
  perform set_config('request.jwt.claim.sub',f.id::text,true);
  execute 'select '||expression||' from (select $1::uuid as seller_id) subject' into allowed using f.id;
  if allowed is distinct from (f.position ilike '%담당%' or f.name in ('이강진','김진문','김솔이')) then raise exception 'Support-sale eligibility changed'; end if;
  execute 'select '||expression||' from (select $1::uuid as seller_id) subject' into allowed using gen_random_uuid();
  if allowed then raise exception 'Foreign seller accepted'; end if;
 end loop;
end $$;
reset role;
select 'PASS: complete access matrix, rename, executive exclusion, role/status/active variants, same-name impersonation, support-sale policy' as result;
rollback;
