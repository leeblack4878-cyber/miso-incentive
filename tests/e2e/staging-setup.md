# Staging setup and verification — 2026-09-16

- Dedicated project: `ahmvrflklvmdprolauuy` (Seoul, Miso-incentive), ACTIVE_HEALTHY.
- Production `ufkxbrzcmncwynvygaak` was queried for schema metadata only; no business data copied or production writes performed.
- Legacy staging profile (1 row) moved intact to non-exposed `e2e_legacy.profiles`; its Auth user was preserved. Initial table inventory row estimates were inaccurate; exact count was checked before preservation.
- Copied current public definitions: 41 tables, 26 functions, 139 constraints, 35 non-constraint indexes, 107 RLS policies. Canonical metadata comparison matched production for every item.
- Effective table/sequence/function ACL entries: 1,461, all matched. Five profile-column UPDATE grants were also copied exactly.
- App triggers copied except `notifications_dispatch_web_push`, which calls the private external delivery function. No push credentials, subscriptions, cron jobs, edge functions or business data copied. External push delivery is outside this regression scope.
- Supabase security advisor checked. Existing function-execution and RLS-without-policy notices remain unchanged; no permissions were broadened to silence them.

## Actual database regression

`home-bundle-rollback.sql` creates temporary fixture users/profiles, then uses `SET LOCAL ROLE authenticated` and employee JWT claims to invoke real RPC/RLS. The complete run rolls back.

Passed on the dedicated staging DB:

- Existing Internet + TV bundle → add Smart Home, both pending and completed.
- Repeat replacement: exactly 3 orders/sales, 1 task, 1 expense and 1 daily record; no orphan order references.
- Actual expense FK failure after replacements: all five table snapshots unchanged.
- Mixed own/foreign order IDs: HOME_REPLACE_ORDERS_MISMATCH and full rollback.
- Other employee RPC write denied with HOME_WRITE_FORBIDDEN; direct delete affected 0 rows.
- Retry succeeds; other employee snapshot remains unchanged.

Negative control: within a staging-only transaction, temporarily omitted `home_orders_delete_own`; the same script failed with HOME_REPLACE_ORDERS_MISMATCH. The transaction rolled back. A separate query confirmed that the policy remained present and no test profiles/orders/Auth users persisted.

This is real database regression, **not authenticated browser regression**: SQL role/JWT setup does not test Auth token issuance, browser selectors or the actual form payload. Daily aggregation input in SQL is synthetic. The four Playwright cases are still required.

## Authenticated browser regression completed

2026-09-16: user registered the staging server key in `home-e2e`. Auth provisioning succeeded.
First run `35104258039` exposed a real pending-bundle promise loss on repeat edit (3/4 pass).
Commit `bb43389` fixes the first-sale-only lookup; tasks and expenses are seeded on different
sales so the regression cannot accidentally pass due to query order. Run `35104998203`:
**4/4 actual Auth/Chromium/PostgREST/DB scenarios passed**, including fixture cleanup.
Production browser/deployment confirmation is separate and is not implied by this result.

## Original credential setup notes (resolved)

The connected Supabase tool can run SQL and return public keys but cannot retrieve a server secret key or create Auth users via the Admin API. No credentials were extracted from internal DB settings.

The **staging-only** server secret/service-role key is registered as `E2E_SUPABASE_SERVICE_KEY` in GitHub environment `home-e2e`. The workflow provisions two dedicated Auth employees and runs all four Playwright cases. No secrets are stored in source or browser traces.
