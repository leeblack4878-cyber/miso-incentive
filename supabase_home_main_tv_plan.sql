alter table public.home_orders
  add column if not exists main_tv_plan text;

alter table public.home_orders
  drop constraint if exists home_orders_main_tv_plan_check;

alter table public.home_orders
  add constraint home_orders_main_tv_plan_check
  check (main_tv_plan is null or main_tv_plan in ('broadcastPass', 'premium', 'belowPremium'));

comment on column public.home_orders.main_tv_plan is
  'TV(주) 요금제 기준: broadcastPass=방송패스, premium=프리미엄, belowPremium=프리미엄 미만. 기존 NULL 행은 종전 정상 단가로 호환.';
