---
title: 'Local fake-auth fixture for apps/web e2e (user + moderator storage states)'
type: 'chore'
created: '2026-10-23'
status: 'done'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Authenticated and moderator-only UI (moderator tools tabs, the moderator view of event detail, favorites) can't be exercised by the UI validation routine: login is Google OAuth through Supabase, so every such spec skips unless a human saves a live session.

**Approach:** The backend only verifies a `Bearer` JWT against `${SUPABASE_URL}/auth/v1/.well-known/jwks.json` and the web app reads its session from the `sb-<host>-auth-token` cookie, so a localhost JWKS stub plus a cookie signed by it is a complete login. Ship that as opt-in (`E2E_FAKE_AUTH=1`) test tooling that writes a moderator and a user storage state using the already-seeded fixture users.

## Boundaries & Constraints

**Always:** Refuse to run unless `DATABASE_URL`, `SUPABASE_URL` and the base URL are loopback. Bind the stub to 127.0.0.1. Keep everything under `apps/web/test-support` + `e2e`, never imported by app code. Off by default.

**Never:** Change app, backend or `packages/*` source; create users in the DB (reuse `FIXTURE_USERS` from `seed.ts`); commit key material (`e2e/.auth` is gitignored).

</frozen-after-approval>

## Code Map

- `apps/web/test-support/fake-auth/local-guard.ts` -- loopback-only guard for every entry point
- `apps/web/test-support/fake-auth/fake-supabase.ts` -- JWKS stub, RS256 signing, `@supabase/ssr` cookie shape, storage state
- `apps/web/test-support/fake-auth/index.ts` -- `startFakeAuth`, server env, seeded moderator/user
- `apps/web/test-support/fake-auth/fake-auth.test.ts` -- vitest unit tests (guard, cookie, signature)
- `apps/web/e2e/global-setup.ts`, `apps/web/playwright.config.ts` -- opt-in wiring

## Tasks & Acceptance

**Execution:**
- [x] Guard, stub, session minting, storage states, wiring
- [x] Unit tests (12 pass)
- [x] Prove end to end: `E2E_FAKE_AUTH=1 playwright test e2e/moderator-accounts.spec.ts` logs in as the seeded moderator and reaches Moderator Tools

**Acceptance Criteria:**
- Given `E2E_FAKE_AUTH` is unset, when e2e runs, then behaviour is unchanged.
- Given any non-loopback `DATABASE_URL`/`SUPABASE_URL`/base URL, when fake auth starts, then it throws before opening a port.
- Given `E2E_FAKE_AUTH=1`, when a spec uses `E2E_AUTH_MODERATOR_STORAGE_STATE`, then the app renders as the seeded moderator.

## Design Notes

The private key is persisted to `e2e/.auth/fake-supabase-key.json` because the backend caches the JWKS it fetched; a fresh key per run would make a reused backend reject new tokens. Known follow-up: `moderator-accounts.spec.ts` queries `getByRole('button', { name: 'Accounts' })` but the tools page now renders `role=tab`, so that spec is stale independent of this fixture.

## Verification

- `cd apps/web && npx vitest run test-support` -- 12 pass
- `E2E_FAKE_AUTH=1 npx playwright test e2e/moderator-accounts.spec.ts` -- logs in, fails only on the stale `button` locator
