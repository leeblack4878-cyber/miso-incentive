-- Existing principals only. No role, approval, store or payout policy changes.
-- Run through apply_migration in one transaction. The CLI was unavailable in
-- the authoring environment; this file is the canonical migration source.
-- Abort instead of changing any current viewer/target access result.
lock table public.profiles in share row exclusive mode;
create function pg_temp.permission_scope_snapshot()
returns table(viewer uuid,target uuid,can_write boolean,permission_admin boolean,team_insert boolean)
language plpgsql as $$
declare v uuid; expression text; team_allowed boolean; admin_allowed boolean;
 old_sub text:=current_setting('request.jwt.claim.sub',true);
 old_claims text:=current_setting('request.jwt.claims',true);
begin
 select with_check into strict expression from pg_policies
 where schemaname='public' and tablename='team_sales_credits' and policyname='eligible users create team credits';
 for v in select id from public.profiles loop
  perform set_config('request.jwt.claim.sub',v::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v,'role','authenticated')::text,true);
  execute 'select '||expression||' from (select $1::uuid as seller_id) subject' into team_allowed using v;
  admin_allowed:=public.is_permission_admin();
  return query select v,p.id,public.can_write_target(p.id),admin_allowed,team_allowed from public.profiles p;
 end loop;
 perform set_config('request.jwt.claim.sub',coalesce(old_sub,''),true);
 perform set_config('request.jwt.claims',coalesce(old_claims,''),true);
end $$;
create temp table permission_scope_before on commit drop as select * from pg_temp.permission_scope_snapshot();

create or replace function public.can_write_target(target_user_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
 select exists (
  select 1 from public.profiles v join public.profiles t on t.id=target_user_id
  where v.id=auth.uid() and v.active=true and v.status='approved' and (
   (v.role in ('admin','super_admin') and v.id in
    ('a50a0979-acef-40b1-98b7-f05074f1c835'::uuid,'f0329992-ced4-4407-b71d-ed58c5d74aaf'::uuid))
   or (v.role in ('admin','super_admin') and v.id in
    ('6ba6651a-8e5b-4e21-a00d-1d2e0ff492bb'::uuid,'9d1db3e4-1292-49bf-89f7-6d04a439a7e2'::uuid)
    and t.name is not null and t.id not in
    ('a50a0979-acef-40b1-98b7-f05074f1c835'::uuid,'f0329992-ced4-4407-b71d-ed58c5d74aaf'::uuid))
   or (v.role in ('admin','super_admin') and v.id='f2cc7718-b1f2-4cf1-8c5c-5b9ae6493da5'::uuid
    and t.store_name in ('본오3동_상록수역점','본오3동_주민센터점','월피동_성포역점',
     '광정동_산본점','고잔동_법조타운점','본오1동_본오중학교점'))
   or (v.role in ('admin','super_admin') and v.id='471280af-a046-4d25-a27d-63a0c5978403'::uuid
    and t.store_name in ('신천동_삼미시장점','신천동_삼미시장2호점','대야동_롯데마트점',
     '장곡동_장곡역점','거모동_도일시장점','월곶동_월곶점','은행동_은계사거리점'))
   or (v.role='manager' and v.position<>'담당' and v.store_name=t.store_name)
  )
 );
$$;
create or replace function public.is_permission_admin()
returns boolean language sql stable security definer set search_path to 'public' as $$
 select exists(select 1 from public.profiles p where p.id=auth.uid()
  and p.id='a50a0979-acef-40b1-98b7-f05074f1c835'::uuid
  and p.role in ('admin','super_admin') and p.active=true and p.status='approved');
$$;
alter policy "eligible users create team credits" on public.team_sales_credits
with check (seller_id=(select auth.uid()) and exists (
 select 1 from public.profiles p where p.id=(select auth.uid()) and p.active is true
 and (p.position ilike '%담당%' or p.id in
  ('9d1db3e4-1292-49bf-89f7-6d04a439a7e2'::uuid,'a50a0979-acef-40b1-98b7-f05074f1c835'::uuid,'f0329992-ced4-4407-b71d-ed58c5d74aaf'::uuid))
));

do $$
declare differences integer;
begin
 select count(*) into differences from (
  (select * from permission_scope_before except select * from pg_temp.permission_scope_snapshot())
  union all
  (select * from pg_temp.permission_scope_snapshot() except select * from permission_scope_before)
 ) changed;
 if differences<>0 then raise exception 'PERMISSION_SCOPE_CHANGED: % results; migration rolled back',differences; end if;
 raise notice 'Permission scope unchanged: % viewer/target pairs',(select count(*) from permission_scope_before);
end $$;
drop function pg_temp.permission_scope_snapshot();
