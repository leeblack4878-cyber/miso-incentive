-- 직원 알림 발송 범위 보완
-- 본인에게 발생한 자동 알림과 관리자/점장의 관리 범위 직원 알림만 허용한다.

alter table public.notifications enable row level security;

drop policy if exists notifications_insert_own_event on public.notifications;
create policy notifications_insert_own_event
on public.notifications
for insert
to authenticated
with check (
  actor_id = (select auth.uid())
  and recipient_id = (select auth.uid())
);

drop policy if exists notifications_insert_managed_employee on public.notifications;
create policy notifications_insert_managed_employee
on public.notifications
for insert
to authenticated
with check (
  actor_id = (select auth.uid())
  and exists (
    select 1
    from public.profiles actor
    join public.profiles recipient on recipient.id = recipient_id
    where actor.id = (select auth.uid())
      and actor.active is true
      and actor.status = 'approved'
      and recipient.active is true
      and recipient.status = 'approved'
      and (
        actor.role = 'admin'
        or actor.position in ('대표', '실장', '담당', '팀장', '전체관리자')
        or (
          actor.role = 'manager'
          and actor.position in ('점장', '부점장')
          and actor.store_name = recipient.store_name
        )
      )
  )
);
