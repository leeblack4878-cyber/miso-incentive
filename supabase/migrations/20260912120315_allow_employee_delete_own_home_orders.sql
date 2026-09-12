create policy home_orders_delete_own
on public.home_orders
for delete
to authenticated
using ((select auth.uid()) = user_id);
