-- Scope manager evaluation writes using the existing employee-target scope.
create or replace function public.can_edit_manager_store(target_store text)
returns boolean language sql stable security invoker set search_path=public as $$
 select exists(select 1 from public.profiles v where v.id=auth.uid()
  and v.active=true and v.status='approved'
  and (v.role in ('admin','super_admin') or (v.role='manager' and v.position in ('점장','부점장') and v.store_name=target_store and v.store_name not in ('휴직','운영진','영업지원팀'))))
 and exists(select 1 from public.profiles t where t.store_name=target_store and public.can_write_target(t.id));
$$;
revoke all on function public.can_edit_manager_store(text) from public,anon;
grant execute on function public.can_edit_manager_store(text) to authenticated;
drop policy if exists manager_eval_manager_only on public.manager_eval_monthly;
create policy manager_eval_scoped_select on public.manager_eval_monthly for select to authenticated using(public.can_edit_manager_store(store_name));
create policy manager_eval_scoped_insert on public.manager_eval_monthly for insert to authenticated with check(public.can_edit_manager_store(store_name));
create policy manager_eval_scoped_update on public.manager_eval_monthly for update to authenticated using(public.can_edit_manager_store(store_name)) with check(public.can_edit_manager_store(store_name));
-- No delete policy: this UI only inserts/updates with optimistic concurrency.
create or replace function public.protect_manager_company_inputs()
returns trigger language plpgsql security invoker set search_path=public as $$
declare k text; before_value jsonb;
begin
 if exists(select 1 from public.profiles where id=auth.uid() and role in ('admin','super_admin') and active=true and status='approved') then return new; end if;
 if TG_OP='UPDATE' and (new.month<>old.month or new.store_name<>old.store_name) then raise exception '평가 월·매장은 변경할 수 없습니다.' using errcode='42501'; end if;
 foreach k in array array['companyNoExperienceRate','companyAixioRate','companyTailTagCount','companyNpsScore','companyAaScore','closing'] loop
  before_value:=case when TG_OP='UPDATE' then coalesce(old.external_inputs->k,'null'::jsonb) else 'null'::jsonb end;
  if coalesce(new.external_inputs->k,'null'::jsonb) is distinct from before_value then raise exception '회사 공통기준·마감은 전체 관리자만 수정할 수 있습니다.' using errcode='42501'; end if;
 end loop;
 return new;
end; $$;
revoke all on function public.protect_manager_company_inputs() from public,anon;
create trigger protect_manager_company_inputs before insert or update on public.manager_eval_monthly for each row execute function public.protect_manager_company_inputs();
