# 홈 묶음 수정: 실제 브라우저 + DB 회귀 테스트

`npm run test:e2e`는 실제 Auth 로그인, 현재 React 앱, 실제 PostgREST/RPC/RLS를 사용한다.
DB 응답을 mock하지 않는다. 로컬 Vite 서버만 열고 테스트 전용 Supabase에 연결한다.
기존 `npm test`의 소스 계약 검사와 별도이며, 설정이 없으면 실패한다(skip/pass 아님).

## 현재 준비된 CI 환경

서울 `ahmvrflklvmdprolauuy`에 운영 스키마와 권한을 복제했으며 운영 업무 데이터는 복사하지 않았다.
GitHub Settings → Environments → `home-e2e` → Environment secrets에 **테스트 프로젝트의**
`E2E_SUPABASE_SERVICE_KEY` 하나만 등록한 뒤 Actions → Authenticated home bundle regression → Run workflow를 실행한다.
URL·프로젝트 ID·공개 키는 workflow에 설정되어 있다. 비밀 키는 코드·채팅에 기록하지 않는다.
`provision-ci.js`가 Auth Admin API로 테스트 직원 두 명을 생성하고 승인된 사원 fixture를 삽입한다.
이는 회원가입 승인 흐름 자체를 검증하는 테스트가 아니다. 기존 정책/트리거/RLS는 수정하지 않는다.
다음 실행부터는 서버 관리 fixture 표시와 프로필·업무 데이터 부재를 확인한 후 전용 비밀번호만 재생성한다.
비밀번호는 마스킹하고 runner 환경에만 전달한다. 계정은 테스트 후 유지된다.
상세 검증/제외 범위는 `staging-setup.md` 참고.

## 별도 환경 또는 로컬 실행 준비

1. 운영과 분리된 Supabase 프로젝트에 현재 운영 스키마·함수·RLS를 배포한다.
   운영 고객/판매 데이터는 복사하지 않는다. 이 저장소의 마이그레이션은 초기 전체 스키마를
   포함하지 않으므로 빈 DB에 파일만 실행해서는 준비가 끝나지 않는다.
   `save_home_bundle_atomic` 및 `home_orders_delete_own`을 포함해야 한다.
2. 테스트 전용 Auth 사용자 2개를 만든 뒤 기존 관리자 승인 절차로 승인한다.
   이메일은 `e2e.owner@example.test`, `e2e.other@example.test`와 같이 설정한다.
   profiles: `role=employee`, `position=사원`, `active=true`, `status=approved`,
   이름 `E2E_` 접두사, 매장명 `E2E_` 접두사, 관리 범위 없음, 임시 비밀번호 변경 완료.
   같은 테스트 매장에 두 직원을 두어 동료 접근도 차단되는지 확인하는 것을 권장한다.
   실제 관리자/직원은 그 매장에 두지 않는다(업무 알림 발송 방지).
3. 두 계정의 고객·판매·주문·약속·비용·일일 실적·월 상태는 비어 있어야 한다.
   DB의 기존 월 잠금/입력 차단이 테스트 날짜 2026-09-16에 적용되지 않는 테스트 환경을 준비한다.
   테스트 코드에서 권한/정책/잠금을 해제하지 않는다.
4. 아래 값을 로컬 환경 또는 CI의 `home-e2e` 환경 secrets에 넣는다. 저장소에 커밋하지 않는다.

```text
E2E_SUPABASE_URL=https://<test-project-ref>.supabase.co
E2E_ALLOWED_PROJECT_REF=<test-project-ref>
E2E_SUPABASE_PUBLIC_KEY=<test-publishable-or-anon-key>
E2E_SUPABASE_SERVICE_KEY=<test-server-secret-or-service-role-key>
E2E_EMPLOYEE_EMAIL=e2e.owner@example.test
E2E_EMPLOYEE_PASSWORD=<password>
E2E_OTHER_EMAIL=e2e.other@example.test
E2E_OTHER_PASSWORD=<password>
```

```sh
npm ci
npx playwright install --with-deps chromium
npm run test:e2e
```

`.env.e2e`를 사용하면 Node 20.6+에서:
`node --env-file=.env.e2e node_modules/@playwright/test/cli.js test`.
`npx playwright test --list`는 자격증명 없이 4개 시나리오를 열거한다.

## 검증 범위

| 시나리오 | 실패 판정 |
| --- | --- |
| 일반 직원: 기존 인터넷500+TV에 스마트홈 추가, 설치대기 | RPC 실패, 3행 불일치, 이전 행 잔존, 원장 연결 오류, 약속/비용 누락 |
| 같은 수정 + 즉시 완료 | 완료일/상태 오류, 일일 집계가 각 1이 아님 |
| 새로고침 후 같은 묶음 재저장 | 중복 행·중복 집계·고아 source_ref |
| 실제 DB FK 실패 후 재시도 | 23503 외 다른 실패, 기존 5개 테이블 변경, 폼 닫힘, 재시도 실패 |
| 타인 ID로 RPC/DELETE, 본인 주문 ID에 타인 ID 혼입 | 권한 우회 성공, RLS 삭제 행 반환, mismatch 이후 기존 데이터 손실 |

성공 검증에서 서비스 키는 DB 결과를 독립적으로 읽는 데만 사용한다. 저장/교체/권한검사는
일반 직원 JWT로 실행한다. 실패 유도는 기존 요청의 비용 source_sale_id만 존재하지 않는 UUID로
바꿔 실제 DB에 보낸다. 오류 응답을 가짜로 반환하거나 RLS/함수를 변경하지 않는다.

후처리는 검증된 테스트 계정 두 개의 업무 데이터만 지운다. 실패한 테스트도 후처리한다.
기존 업무 데이터가 있으면 시작 전에 실패하고 삭제하지 않는다. 실행 중 강제 종료로 후처리가
실패하면 다음 실행도 실패한다. 해당 테스트 계정 데이터만 별도로 검토·정리한다.
프로필과 Auth 계정은 유지한다. 감사 로그·접속/배지 등 부수 기록은 테스트 DB에 남을 수 있다.
다른 작업과 이 두 계정을 공유하지 않고 단일 worker로 실행한다.

네트워크 trace는 JWT/비밀번호 유출 방지를 위해 저장하지 않는다. 실패 스크린샷에는
테스트 계정 정보가 있을 수 있으므로 공개하지 않는다. CI artifact 자동 업로드도 하지 않는다.

## 실제 실행 상태

작성 시 `--list`, 환경 차단 단위 테스트, 기존 회귀 테스트 및 운영 빌드를 확인했다.
테스트 DB 자격증명 부재로 실제 인증 브라우저/DB 4개 시나리오는 아직 실행하지 못했다.
완료 후 이 문서와 HANDOFF.md에 실행 날짜·테스트 프로젝트·결과를 기록한다.

## 재발 감지 확인 (테스트 DB에서만)

`home_orders_delete_own`이 빠진 이전 스키마로 전용 DB를 준비해 첫 두 시나리오를 실행하면
`HOME_REPLACE_ORDERS_MISMATCH`와 함께 실패해야 한다. 현재 마이그레이션을 적용한 스키마에서는
통과해야 한다. 운영 정책을 삭제해서 이 검증을 수행하지 않는다.
