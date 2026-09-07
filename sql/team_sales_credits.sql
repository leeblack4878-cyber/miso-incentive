-- 담당/본사 지원 판매: 판매자 개인이 아닌 선택 매장의 팀 실적에만 합산합니다.
create table if not exists public.team_sales_credits (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  credited_store text not null,
  sale_date date not null,
  source_type text not null check (source_type in ('mobile', 'home')),
  source_sale_id uuid references public.customer_sales(id) on delete cascade,
  source_refs jsonb not null default '[]'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  is_completed boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_team_sales_credits_store_date
  on public.team_sales_credits (credited_store, sale_date);
create index if not exists idx_team_sales_credits_seller_date
  on public.team_sales_credits (seller_id, sale_date);

alter table public.team_sales_credits enable row level security;
grant select, insert, update, delete on public.team_sales_credits to authenticated;

drop policy if exists "team credits authenticated read" on public.team_sales_credits;
create policy "team credits authenticated read" on public.team_sales_credits
  for select to authenticated using ((select auth.uid()) is not null);

drop policy if exists "eligible users create team credits" on public.team_sales_credits;
create policy "eligible users create team credits" on public.team_sales_credits
  for insert to authenticated with check (
    seller_id = (select auth.uid()) and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.active is true
        and (p.position ilike '%담당%' or p.name in ('김솔이', '이강진', '김진문'))
    )
  );

drop policy if exists "owners or managers update team credits" on public.team_sales_credits;
create policy "owners or managers update team credits" on public.team_sales_credits
  for update to authenticated using (
    seller_id = (select auth.uid()) or exists (
      select 1 from public.profiles p where p.id = (select auth.uid()) and p.active is true
        and (p.role = 'admin' or (p.position in ('점장','부점장') and p.store_name = credited_store))
    )
  ) with check (
    seller_id = (select auth.uid()) or exists (
      select 1 from public.profiles p where p.id = (select auth.uid()) and p.active is true
        and (p.role = 'admin' or (p.position in ('점장','부점장') and p.store_name = credited_store))
    )
  );

drop policy if exists "owners or managers delete team credits" on public.team_sales_credits;
create policy "owners or managers delete team credits" on public.team_sales_credits
  for delete to authenticated using (
    seller_id = (select auth.uid()) or exists (
      select 1 from public.profiles p where p.id = (select auth.uid()) and p.active is true
        and (p.role = 'admin' or (p.position in ('점장','부점장') and p.store_name = credited_store))
    )
  );

create or replace function public.sync_team_home_credit_status()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  update public.team_sales_credits c
     set is_completed = not exists (
       select 1
       from jsonb_array_elements_text(c.source_refs) ref
       join public.home_orders h on h.id::text = ref
       where h.status <> 'completed'
     ),
     -- 청약월이 아니라 묶음의 최종 설치완료일이 속한 월에 팀 실적을 인정합니다.
     sale_date = case
       when not exists (
         select 1
         from jsonb_array_elements_text(c.source_refs) ref
         join public.home_orders h on h.id::text = ref
         where h.status <> 'completed'
       ) then coalesce(
         (select max(h.actual_install_date)
            from jsonb_array_elements_text(c.source_refs) ref
            join public.home_orders h on h.id::text = ref),
         new.actual_install_date,
         new.completed_at::date,
         c.sale_date
       )
       else c.sale_date
     end,
     updated_at = now()
   where c.source_type = 'home' and c.source_refs ? new.id::text;
  return new;
end;
$$;

drop trigger if exists sync_team_home_credit_status_trigger on public.home_orders;
create trigger sync_team_home_credit_status_trigger
after update of status on public.home_orders
for each row execute function public.sync_team_home_credit_status();
