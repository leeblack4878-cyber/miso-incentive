-- 관리자 홈에서 민감한 푸시 구독 키를 노출하지 않고
-- 관리 범위 직원의 설정 여부와 최근 전달 결과만 확인합니다.
create or replace function public.get_push_delivery_overview()
returns table(
  user_id uuid,
  has_active_subscription boolean,
  last_delivery_status text,
  last_delivery_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id,
         exists (
           select 1
             from public.push_subscriptions subscription
            where subscription.user_id = p.id
              and subscription.enabled is true
         ) as has_active_subscription,
         latest.status as last_delivery_status,
         latest.created_at as last_delivery_at
    from public.profiles p
    left join lateral (
      select delivery.status, delivery.created_at
        from public.push_delivery_log delivery
       where delivery.recipient_id = p.id
       order by delivery.created_at desc
       limit 1
    ) latest on true
   where auth.uid() is not null
     and p.active is true
     and p.status = 'approved'
     and (p.id = auth.uid() or public.can_view_profile(p.store_name));
$$;

revoke all on function public.get_push_delivery_overview() from public;
revoke all on function public.get_push_delivery_overview() from anon;
grant execute on function public.get_push_delivery_overview() to authenticated;

comment on function public.get_push_delivery_overview() is
  'Returns scoped push readiness and latest delivery status without subscription secrets.';
