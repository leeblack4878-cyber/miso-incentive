begin;

create or replace function public.can_write_target(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles v
    join public.profiles t on t.id = target_user_id
    where v.id = auth.uid()
      and v.active = true
      and v.status = 'approved'
      and (
        (v.role in ('admin', 'super_admin') and v.name in ('이강진', '김진문'))
        or (
          v.role in ('admin', 'super_admin')
          and v.name in ('정유미', '김솔이')
          and t.name not in ('이강진', '김진문')
        )
        or (
          v.role in ('admin', 'super_admin')
          and v.name = '김진백'
          and t.store_name in (
            '본오3동_상록수역점', '본오3동_주민센터점', '월피동_성포역점',
            '광정동_산본점', '고잔동_법조타운점', '본오1동_본오중학교점'
          )
        )
        or (
          v.role in ('admin', 'super_admin')
          and v.name = '임성준'
          and t.store_name in (
            '신천동_삼미시장점', '신천동_삼미시장2호점', '대야동_롯데마트점',
            '장곡동_장곡역점', '거모동_도일시장점', '월곶동_월곶점',
            '은행동_은계사거리점'
          )
        )
        or (
          v.role = 'manager'
          and v.position <> '담당'
          and v.store_name = t.store_name
        )
      )
  );
$$;

drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin on public.profiles
for select to authenticated
using (id = (select auth.uid()) or (select public.can_write_target(id)));

drop policy if exists customers_manager_read on public.customers;
create policy customers_manager_read on public.customers
for select to authenticated
using ((select public.can_write_target(user_id)));

drop policy if exists customer_sales_manager_read on public.customer_sales;
create policy customer_sales_manager_read on public.customer_sales
for select to authenticated
using ((select public.can_write_target(user_id)));

drop policy if exists customer_tasks_manager_read on public.customer_tasks;
create policy customer_tasks_manager_read on public.customer_tasks
for select to authenticated
using ((select public.can_write_target(user_id)));

drop policy if exists home_orders_read_own_or_manager on public.home_orders;
create policy home_orders_read_own_or_manager on public.home_orders
for select to authenticated
using (user_id = (select auth.uid()) or (select public.can_write_target(user_id)));

drop policy if exists sales_expenses_read_scope_v21_77 on public.sales_expenses;
create policy sales_expenses_read_scope_v21_77 on public.sales_expenses
for select to authenticated
using (user_id = (select auth.uid()) or (select public.can_write_target(user_id)));

drop policy if exists daily_select_own_or_admin on public.daily_records;
create policy daily_select_own_or_admin on public.daily_records
for select to authenticated
using (
  (user_id = (select auth.uid()) and (select public.is_approved()))
  or (select public.can_write_target(user_id))
);

drop policy if exists monthly_select_own_or_admin on public.monthly_status;
create policy monthly_select_own_or_admin on public.monthly_status
for select to authenticated
using (
  (user_id = (select auth.uid()) and (select public.is_approved()))
  or (select public.can_write_target(user_id))
);

comment on function public.can_write_target(uuid) is
  'Employee proxy scope: executives all; Kim Jinbaek/Im Seongjun assigned sales areas; Jeong Yumi/Kim Soli all except executives; store managers same store.';

commit;
