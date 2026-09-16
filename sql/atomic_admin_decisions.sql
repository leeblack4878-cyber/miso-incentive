-- Coupled administrative writes keep their existing RLS/role checks.
create or replace function public.decide_profile_edit_atomic(p_request_id bigint,p_approve boolean)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare r public.profile_edit_requests; n integer;
begin
 if auth.uid() is null or p_approve is null then raise exception 'SALE_WRITE_FORBIDDEN' using errcode='42501'; end if;
 select * into r from public.profile_edit_requests where id=p_request_id for update;
 if not found then raise exception 'SALE_NOT_FOUND'; end if;
 if r.status<>'pending' then raise exception 'SALE_STALE_DATA'; end if;
 -- Marking the request first verifies the caller's existing decision permission.
 update public.profile_edit_requests set status=case when p_approve then 'approved' else 'rejected' end,decided_at=now() where id=p_request_id and status='pending';
 get diagnostics n=row_count;if n<>1 then raise exception 'SALE_UPDATE_MISMATCH'; end if;
 if p_approve then
  if exists(select 1 from jsonb_object_keys(r.changes) k where k not in ('name','employee_code','hire_date')) then raise exception 'SALE_INVALID_PAYLOAD'; end if;
  update public.profiles set name=case when r.changes?'name' then r.changes->>'name' else name end,
   employee_code=case when r.changes?'employee_code' then r.changes->>'employee_code' else employee_code end,
   hire_date=case when r.changes?'hire_date' then r.changes->>'hire_date' else hire_date end where id=r.user_id;
  get diagnostics n=row_count;if n<>1 then raise exception 'SALE_UPDATE_MISMATCH'; end if;
 end if;
 return jsonb_build_object('updated_count',1);
end;$$;

create or replace function public.save_career_decision_atomic(p_payload jsonb,p_expected_position text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare actor uuid:=(p_payload->>'user_id')::uuid; action_name text:=p_payload->>'action'; current_position text; n integer;
begin
 if auth.uid() is null then raise exception 'SALE_WRITE_FORBIDDEN' using errcode='42501'; end if;
 if action_name is null or action_name not in ('reviewed','promote_manager','demote_employee','no_change') then raise exception 'SALE_INVALID_PAYLOAD'; end if;
 if action_name<>'reviewed' and not public.is_full_admin() then raise exception 'SALE_WRITE_FORBIDDEN' using errcode='42501'; end if;
 if action_name in ('promote_manager','demote_employee') then
  select position into current_position from public.profiles where id=actor for update;
  if not found or current_position is distinct from p_expected_position then raise exception 'SALE_STALE_DATA'; end if;
  update public.profiles set position=case when action_name='promote_manager' then '매니저' else '사원' end where id=actor;
  get diagnostics n=row_count;if n<>1 then raise exception 'SALE_UPDATE_MISMATCH'; end if;
 end if;
 insert into public.career_eval_decisions(quarter,user_id,score,result,action,consecutive_fail_count)
 values(p_payload->>'quarter',actor,(p_payload->>'score')::numeric,p_payload->>'result',action_name,(p_payload->>'consecutive_fail_count')::integer)
 on conflict(quarter,user_id) do update set score=excluded.score,result=excluded.result,action=excluded.action,consecutive_fail_count=excluded.consecutive_fail_count;
 get diagnostics n=row_count;if n<>1 then raise exception 'SALE_UPDATE_MISMATCH'; end if;
 return jsonb_build_object('updated_count',1);
end;$$;
revoke all on function public.decide_profile_edit_atomic(bigint,boolean) from public,anon;
revoke all on function public.save_career_decision_atomic(jsonb,text) from public,anon;
grant execute on function public.decide_profile_edit_atomic(bigint,boolean) to authenticated;
grant execute on function public.save_career_decision_atomic(jsonb,text) to authenticated;
