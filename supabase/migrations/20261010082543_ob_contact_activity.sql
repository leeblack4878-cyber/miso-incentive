begin;
create schema if not exists private;
create table public.ob_contact_logs (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null,
 user_id uuid not null references public.profiles(id),
 employee_name text not null,
 store_name text not null,
 subscription_number text not null check(length(subscription_number) between 1 and 60 and subscription_number=upper(regexp_replace(subscription_number,'\s','','g'))),
 customer_name text not null check(length(btrim(customer_name)) between 1 and 80),
 phone text not null check(phone ~ '^[0-9]{8,15}$'),
 purpose text not null check(purpose in ('기변 권유','선약 안내','홈상품 권유','고객 케어','기타')),
 call_result text not null check(call_result in ('부재','선단절','통화 거절','통화 완료','기타')),
 reaction text check(reaction in ('거부','관심 없음','관심 있음','재연락 희망')),
 follow_up_date date,
 visit_at timestamptz,
 memo text not null default '' check(length(memo)<=2000),
 contacted_at timestamptz not null default now(),
 contact_date date not null default ((now() at time zone 'Asia/Seoul')::date),
 unique(user_id,request_id),
 check((call_result='통화 완료' and reaction is not null) or (call_result<>'통화 완료' and reaction is null))
);
create index ob_contact_user_time on public.ob_contact_logs(user_id,contacted_at desc,id desc);
create index ob_contact_store_date on public.ob_contact_logs(store_name,contact_date,contacted_at desc,id desc);
create index ob_contact_subscription_time on public.ob_contact_logs(subscription_number,contacted_at desc,id desc);
create index ob_contact_date on public.ob_contact_logs(contact_date,contacted_at desc,id desc);
alter table public.ob_contact_logs enable row level security;
revoke all on public.ob_contact_logs from public,anon,authenticated;
grant select on public.ob_contact_logs to authenticated;
-- Snapshot store boundaries stay fixed even if the caller or author transfers.
create or replace function private.can_read_ob(p_user uuid,p_store text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles v where v.id=auth.uid() and v.active is true and v.status='approved' and (
 v.id=p_user
 or (v.role in ('admin','super_admin') and v.id in ('a50a0979-acef-40b1-98b7-f05074f1c835'::uuid,'f0329992-ced4-4407-b71d-ed58c5d74aaf'::uuid))
 or (v.role in ('admin','super_admin') and v.id in ('6ba6651a-8e5b-4e21-a00d-1d2e0ff492bb'::uuid,'9d1db3e4-1292-49bf-89f7-6d04a439a7e2'::uuid) and p_user not in ('a50a0979-acef-40b1-98b7-f05074f1c835'::uuid,'f0329992-ced4-4407-b71d-ed58c5d74aaf'::uuid))
 or (v.role in ('admin','super_admin') and v.id='f2cc7718-b1f2-4cf1-8c5c-5b9ae6493da5'::uuid and p_store in ('본오3동_상록수역점','본오3동_주민센터점','월피동_성포역점','광정동_산본점','고잔동_법조타운점','본오1동_본오중학교점'))
 or (v.role in ('admin','super_admin') and v.id='471280af-a046-4d25-a27d-63a0c5978403'::uuid and p_store in ('신천동_삼미시장점','신천동_삼미시장2호점','대야동_롯데마트점','장곡동_장곡역점','거모동_도일시장점','월곶동_월곶점','은행동_은계사거리점'))
 or (v.role='manager' and v.position<>'담당' and v.store_name=p_store)
 ));
$$;
revoke all on function private.can_read_ob(uuid,text) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.can_read_ob(uuid,text) to authenticated;
create policy ob_read_scope on public.ob_contact_logs for select to authenticated using(private.can_read_ob(user_id,store_name));
-- Only this operation can append. Identity, name, store and timestamp are server derived.
create or replace function private.append_ob_contact(p_request_id uuid,p_customer_name text,p_subscription_number text,p_phone text,p_purpose text,p_call_result text,p_reaction text,p_follow_up_date date,p_visit_at timestamptz,p_memo text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v public.profiles%rowtype; r public.ob_contact_logs%rowtype; result_id uuid;
 key text:=upper(regexp_replace(btrim(p_subscription_number),'\s','','g'));
 digits text:=regexp_replace(p_phone,'[^0-9]','','g');
begin
 select * into v from public.profiles where id=auth.uid() and active is true and status='approved';
 if v.id is null or nullif(btrim(v.store_name),'') is null then raise exception 'approved active profile and store required'; end if;
 if p_request_id is null or nullif(btrim(p_customer_name),'') is null or nullif(key,'') is null or digits is null then raise exception 'required customer fields missing'; end if;
 if length(btrim(p_customer_name))>80 or length(key)>60 or digits !~ '^[0-9]{8,15}$' then raise exception 'invalid customer fields'; end if;
 if p_purpose is null or p_purpose not in ('기변 권유','선약 안내','홈상품 권유','고객 케어','기타') or p_call_result is null or p_call_result not in ('부재','선단절','통화 거절','통화 완료','기타') then raise exception 'invalid call classification'; end if;
 if p_call_result='통화 완료' and (p_reaction is null or p_reaction not in ('거부','관심 없음','관심 있음','재연락 희망')) then raise exception 'reaction required for completed call'; end if;
 if p_call_result<>'통화 완료' then p_reaction:=null; end if;
 if length(coalesce(p_memo,''))>2000 then raise exception 'memo too long'; end if;
 -- Serialize retries before checking the idempotency key.
 perform pg_advisory_xact_lock(hashtextextended(v.id::text||p_request_id::text,0));
 select * into r from public.ob_contact_logs where user_id=v.id and request_id=p_request_id;
 if r.id is not null then
  if row(r.customer_name,r.subscription_number,r.phone,r.purpose,r.call_result,r.reaction,r.follow_up_date,r.visit_at,r.memo) is distinct from row(btrim(p_customer_name),key,digits,p_purpose,p_call_result,p_reaction,p_follow_up_date,p_visit_at,btrim(coalesce(p_memo,''))) then raise exception 'request key conflict'; end if;
  return r.id;
 end if;
 insert into public.ob_contact_logs(request_id,user_id,employee_name,store_name,subscription_number,customer_name,phone,purpose,call_result,reaction,follow_up_date,visit_at,memo)
 values(p_request_id,v.id,v.name,v.store_name,key,btrim(p_customer_name),digits,p_purpose,p_call_result,p_reaction,p_follow_up_date,p_visit_at,btrim(coalesce(p_memo,''))) returning id into result_id;
 return result_id;
end;
$$;
revoke all on function private.append_ob_contact(uuid,text,text,text,text,text,text,date,timestamptz,text) from public,anon;
grant execute on function private.append_ob_contact(uuid,text,text,text,text,text,text,date,timestamptz,text) to authenticated;
create or replace function public.append_ob_contact(p_request_id uuid,p_customer_name text,p_subscription_number text,p_phone text,p_purpose text,p_call_result text,p_reaction text default null,p_follow_up_date date default null,p_visit_at timestamptz default null,p_memo text default '') returns uuid
language sql security invoker set search_path='' as $$select private.append_ob_contact(p_request_id,p_customer_name,p_subscription_number,p_phone,p_purpose,p_call_result,p_reaction,p_follow_up_date,p_visit_at,p_memo)$$;
revoke all on function public.append_ob_contact(uuid,text,text,text,text,text,text,date,timestamptz,text) from public,anon;
grant execute on function public.append_ob_contact(uuid,text,text,text,text,text,text,date,timestamptz,text) to authenticated;
comment on table public.ob_contact_logs is 'Append-only OB call activity. Completed calls alone count as connected. Customer grouping uses normalized subscription number within authorized read scope. Employee/store/date snapshots are server derived.';
notify pgrst,'reload schema';
commit;
