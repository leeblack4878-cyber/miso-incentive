# MISO 인센티브 v8 - 중앙 DB 연결

## 이번 버전
- Supabase 로그인 사용자와 profiles 연결
- daily_records에 날짜별 일일 실적 중앙 저장
- monthly_status에 활동 시간 충족 및 월별 draft 중앙 저장
- 관리자/매니저만 관리자 화면 버튼 표시
- 일반 직원은 본인 profile/실적만 조회 (RLS)
- 관리자 계정은 RLS 정책에 따라 전체 직원 실적 조회 가능

## 먼저 실행할 SQL
`miso-v8-migration.sql`을 Supabase SQL Editor에서 한 번 실행하세요.

## Vercel 환경변수
- VITE_SUPABASE_URL
- VITE_SUPABASE_PUBLISHABLE_KEY

주의:
직원 계정 생성 자체는 아직 Supabase Authentication > Users에서 진행합니다.
다음 단계에서 관리자 화면의 직원 초대/계정 관리 기능을 연결할 예정입니다.
