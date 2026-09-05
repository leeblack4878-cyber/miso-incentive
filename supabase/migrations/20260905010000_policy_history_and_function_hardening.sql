begin;

-- 8월 기준 설정을 한 번 고정해 이후 app_config 변경이 과거월 정산을 바꾸지 않게 합니다.
insert into public.app_config (config_key, value)
select
  'policy_history_v1',
  jsonb_build_object(
    'schemaVersion', 1,
    'baseSnapshots', jsonb_build_object('2026-08-v1', coalesce(value, '{}'::jsonb)),
    'periods', jsonb_build_array(
      jsonb_build_object(
        'version', '2026-08-v1',
        'effectiveFrom', '0000-01-01',
        'strategy', 'snapshot',
        'baseVersion', '2026-08-v1'
      ),
      jsonb_build_object(
        'version', '2026-09-v1',
        'effectiveFrom', '2026-09-01',
        'strategy', 'september-v1',
        'baseVersion', '2026-08-v1'
      )
    )
  )
from public.app_config
where config_key = 'config'
on conflict (config_key) do nothing;

-- 갱신 트리거는 고정 search_path를 사용하고 API에서 직접 호출할 수 없게 합니다.
alter function public.set_updated_at() set search_path to public, pg_temp;

revoke all on function public.audit_customer_sales() from public, anon, authenticated;
revoke all on function public.audit_home_orders() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.log_daily_record_change() from public, anon, authenticated;
revoke all on function public.protect_profile_fields() from public, anon, authenticated;
revoke all on function public.protect_store_company_goals() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;

-- RLS 보조 함수는 로그인 사용자 정책 평가에만 필요합니다.
revoke all on function public.can_view_profile(text) from public, anon;
revoke all on function public.can_write_target(uuid) from public, anon;
revoke all on function public.is_admin() from public, anon;
revoke all on function public.is_approved() from public, anon;
revoke all on function public.is_full_admin() from public, anon;
revoke all on function public.is_month_locked(text) from public, anon;
grant execute on function public.can_view_profile(text) to authenticated;
grant execute on function public.can_write_target(uuid) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_approved() to authenticated;
grant execute on function public.is_full_admin() to authenticated;
grant execute on function public.is_month_locked(text) to authenticated;

-- 의도된 RPC만 필요한 역할에 한정합니다.
revoke all on function public.get_last_sign_ins() from public, anon;
grant execute on function public.get_last_sign_ins() to authenticated;
revoke all on function public.reset_my_month_performance(text, text) from public, anon;
grant execute on function public.reset_my_month_performance(text, text) to authenticated;
revoke all on function public.get_public_stores() from public;
grant execute on function public.get_public_stores() to anon, authenticated;

comment on function public.get_public_stores() is
  '로그인 화면의 매장 선택용 공개 RPC. 매장명 외 설정은 반환하지 않는다.';
comment on function public.get_last_sign_ins() is
  '관리자용 로그인 시각 조회 RPC. 함수 내부 is_admin() 조건으로 행을 제한한다.';
comment on function public.reset_my_month_performance(text, text) is
  '로그인 사용자의 본인 월 실적 초기화 RPC. 실행 전 복구용 스냅샷을 생성한다.';

commit;
