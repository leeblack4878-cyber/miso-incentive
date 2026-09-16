# 미소페이 (MisoPay)

React + Vite PWA, Supabase 데이터·인증, GitHub main → Vercel 배포 구조입니다.
현재 운영 기준은 `PROJECT_CONTEXT.md`, 최근 상태는 `HANDOFF.md`, 변경 이력은 `CHANGELOG.md`를 확인하세요.

## 로컬 실행

Node.js 20 이상에서 `npm ci` 후 다음 공개 환경변수를 설정하고 `npm run dev`를 실행합니다.

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

서버 전용 키를 VITE 환경변수나 저장소에 넣지 않습니다. 검증에는 전용 테스트 DB를 사용합니다.

## 검증 종류

- `npm test`: 정책 숫자 사례, 저장 도우미 및 소스 계약 검사. 실제 로그인 테스트가 아닙니다.
- `npm run build`: 배포 빌드.
- `npx playwright install chromium` 후 `npm run test:ui`: 실제 브라우저에서 컴포넌트 오류 안내와 320/390px 화면 확인. API 응답은 모킹하므로 Auth/RLS 검증이 아닙니다.
- `tests/db/sale-integrity.sql`: 전용 스테이징에서 실행하는 실제 SQL/RLS 회귀. 기존 가상 E2E 직원 2명은 허용하며 가상 데이터·오류 주입 트리거·월 마감 설정은 모두 ROLLBACK합니다.
- `tests/db/permission-scopes.sql`: 지정 계정의 범위, 이름 변경, 동명이인, 역할/승인/활성 조건과 지원 판매 자격을 검증합니다. 전용 스테이징 외에는 실행하지 않으며 실제 로그인 브라우저 검증과 구분합니다.
- `npm run test:e2e`: 실제 Auth/브라우저/DB 홈 묶음 회귀. 자격증명과 안전 조건은 `tests/e2e/README.md` 참고.

가입 승인·관리 범위는 기존 DB 정책을 따릅니다. 사용자 생성 안내를 위해 예전 초기 설치 SQL을 운영 DB에 재실행하지 마세요.

## 배포

별도 브랜치와 PR에서 검증한 후 DB 마이그레이션을 먼저 적용하고 프런트엔드를 배포합니다.
이번 삭제·승인 개선은 `20260916130344_atomic_sale_delete_and_special_review.sql`에 의존합니다.
RPC가 없는 DB에 새 화면만 배포하면 삭제·승인이 실패하며, 부분 저장으로 돌아가는 우회 경로는 없습니다.

지정 관리자 ID 전환은 `sql/bind_permission_scopes_to_ids.sql`을 Supabase migration으로 적용합니다. 기존 직원 간 접근 결과를 전후 비교하여 한 건이라도 다르면 변경 전체를 롤백합니다. 화면의 ID 매핑과 DB 매핑을 함께 검토하고, 계정을 교체할 때 이름으로 자동 연결하지 않습니다.

정책 금액·적용월·권한 범위는 임의로 변경하지 않습니다. 10월부터 정책 미반영 월은 기본 입력 잠금입니다. 정책 반영·검증 후 기존 관리자 메뉴의 입력 열기를 실행하면 `policy_ready_months`에 해당 월만 기록됩니다. 계산 엔진에 새로운 지급정책을 임의로 만들지 않습니다.
