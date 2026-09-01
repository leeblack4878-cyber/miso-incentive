alter table public.customer_tasks
  add column if not exists task_meta jsonb not null default '{}'::jsonb;

comment on column public.customer_tasks.task_meta is
  '약속 유형별 진행 정보. 제휴카드의 카드명, 신청·수령 단계, 승인 및 자동이체 여부를 저장한다.';
