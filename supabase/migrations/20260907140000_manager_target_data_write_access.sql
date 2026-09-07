-- Allow authorized managers to maintain the employee currently selected in the UI.
-- can_write_target() preserves the existing scope rules:
-- full admins -> all employees, 담당 -> all employees, other managers -> same store only.

drop policy if exists customers_manager_insert on public.customers;
create policy customers_manager_insert on public.customers
for insert to authenticated
with check ((select public.can_write_target(user_id)));

drop policy if exists customers_manager_update on public.customers;
create policy customers_manager_update on public.customers
for update to authenticated
using ((select public.can_write_target(user_id)))
with check ((select public.can_write_target(user_id)));

drop policy if exists customers_manager_delete on public.customers;
create policy customers_manager_delete on public.customers
for delete to authenticated
using ((select public.can_write_target(user_id)));

drop policy if exists customer_sales_manager_insert on public.customer_sales;
create policy customer_sales_manager_insert on public.customer_sales
for insert to authenticated
with check ((select public.can_write_target(user_id)));

drop policy if exists customer_sales_manager_update on public.customer_sales;
create policy customer_sales_manager_update on public.customer_sales
for update to authenticated
using ((select public.can_write_target(user_id)))
with check ((select public.can_write_target(user_id)));

drop policy if exists customer_sales_manager_delete on public.customer_sales;
create policy customer_sales_manager_delete on public.customer_sales
for delete to authenticated
using ((select public.can_write_target(user_id)));

drop policy if exists customer_tasks_manager_insert on public.customer_tasks;
create policy customer_tasks_manager_insert on public.customer_tasks
for insert to authenticated
with check ((select public.can_write_target(user_id)));

drop policy if exists customer_tasks_manager_update on public.customer_tasks;
create policy customer_tasks_manager_update on public.customer_tasks
for update to authenticated
using ((select public.can_write_target(user_id)))
with check ((select public.can_write_target(user_id)));

drop policy if exists customer_tasks_manager_delete on public.customer_tasks;
create policy customer_tasks_manager_delete on public.customer_tasks
for delete to authenticated
using ((select public.can_write_target(user_id)));

drop policy if exists home_orders_manager_insert on public.home_orders;
create policy home_orders_manager_insert on public.home_orders
for insert to authenticated
with check ((select public.can_write_target(user_id)));

drop policy if exists home_orders_manager_update on public.home_orders;
create policy home_orders_manager_update on public.home_orders
for update to authenticated
using ((select public.can_write_target(user_id)))
with check ((select public.can_write_target(user_id)));

drop policy if exists home_orders_manager_delete on public.home_orders;
create policy home_orders_manager_delete on public.home_orders
for delete to authenticated
using ((select public.can_write_target(user_id)));

drop policy if exists sales_expenses_manager_insert on public.sales_expenses;
create policy sales_expenses_manager_insert on public.sales_expenses
for insert to authenticated
with check ((select public.can_write_target(user_id)));

drop policy if exists sales_expenses_manager_update on public.sales_expenses;
create policy sales_expenses_manager_update on public.sales_expenses
for update to authenticated
using ((select public.can_write_target(user_id)))
with check ((select public.can_write_target(user_id)));

drop policy if exists sales_expenses_manager_delete on public.sales_expenses;
create policy sales_expenses_manager_delete on public.sales_expenses
for delete to authenticated
using ((select public.can_write_target(user_id)));

drop policy if exists spot_claims_manager_insert on public.spot_claims;
create policy spot_claims_manager_insert on public.spot_claims
for insert to authenticated
with check ((select public.can_write_target(user_id)));
