---
title: 'BUG-059 story 1: account page URL resolves by username'
type: 'bugfix'
created: '2026-10-18'
status: 'done'
baseline_commit: 'a530c55bd2c561af3306b4d81a9d9263d03b3f3a'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/festgrid-architecture-spine.md'
  - '{project-root}/_bmad-output/specs/spec-profile-identity-unification/DESIGN.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `account_id` now holds the platform's numeric ID, so every account link (`/ig/<accountId>`) and the account page route show a numeric, unfriendly URL.

**Approach:** Implement Architecture Spine AD-35. URLs carry the normalized username, built by one domain helper; one backend query resolves username first with an all-digit `account_id` fallback; the page redirects (308) any non-canonical segment to the username URL.

## Boundaries & Constraints

**Always:** Follow AD-35 Rules 1-7 exactly. One username normalizer (lower-case, trimmed, no leading `@`) lives in `packages/domain/src/scraper/`; the backend's existing `normalizeUsername` re-exports it. `packages/ui` is not changed: it renders the `accountHref` it is given (null allowed). `accountId` stays in GraphQL types for identity comparison only. `packages/domain` keeps 100% unit coverage.

**Ask First:** Any change to data, migrations or other GraphQL fields; keeping the old `socialMediaAccountProfileByAccountId` query if another consumer turns up.

**Never:** Touch BUG-059 stories 2-5 (resolver for creation paths, merge tool, CHECK constraint, rename/reuse). No numeric-ID fallback link. No `canonical` metadata, no old-username redirect history.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Username URL | `/en/ig/jktcity.events` | Page renders the profile | N/A |
| Numeric ID URL | `/en/ig/2237970730?view=list`, row exists with username `pakuwonmall.jogja` | 308 to `/en/ig/pakuwonmall.jogja?view=list` | N/A |
| Mixed-case URL | `/en/ig/JktCity.Events` | 308 to lower-case username URL | N/A |
| All-digit username | segment `123456` matches account A's username and account B's `account_id` | Account A (username wins) | N/A |
| Twin pair | handle row and numeric row share a username | The numeric-`account_id` row, then oldest `created_at` | N/A |
| Unknown segment | no username match, not all digits, or digits with no row | `notFound()` | N/A |
| Empty username | link input `''` or `null` | `buildAccountHref` returns `null`; card renders unlinked | N/A |
| Stored mixed-case username | row username `Foo` | Compared normalized; no redirect loop | N/A |

</frozen-after-approval>

## Code Map

- `packages/domain/src/scraper/platform-registry.ts` -- `getPlatformSlug` (slug is `ig`, not `instagram`); builder sits beside it
- `apps/backend/src/schema/social-media-accounts.graphql`, `resolvers.ts:2876` -- old by-`accountId` query
- `apps/backend/src/lib/accounts/find-profile-by-username.ts` -- existing `normalizeUsername` and username lookup (stopgap)
- `apps/web/src/features/accounts/queries.graphql` -- web document for the query (sole consumer is the account page)
- `apps/web/src/app/[locale]/[platformSlug]/[accountId]/{page,account-content}.tsx` (+ tests) -- the route
- `apps/web/src/features/events/mapper.ts:107,130,139,187` -- four `accountHref` builders; `mapper.test.ts:390` asserts the old form
- `apps/web/src/app/[locale]/settings/account/subscriptions-content.tsx:103` -- `router.push`; `.test.tsx:272` asserts `/ig/acc-1`
- `apps/web/src/features/onboarding/onboarding-subscribe-step.tsx:86` -- label falls back to `subscription.accountId`
- `apps/web/e2e/account-page.spec.ts`, `calendar-banner-alignment.spec.ts` -- navigate by `ig_jkt_events` (seed `account_id`; username is `jktcity.events`)

## Tasks & Acceptance

**Execution:**
- [x] `packages/domain/src/scraper/account-href.ts` (+ test, export from `index.ts`) -- `normalizeUsername`, `buildAccountHref(platform, username)` -> `/${slug}/${encodeURIComponent(normalized)}` or `null` -- AD-35 Rules 1-2
- [x] `apps/backend/src/schema/social-media-accounts.graphql`, `resolvers.ts` -- replace the old query with `socialMediaAccountProfileByUsername(platform, username)` via a new `lib/accounts/resolve-profile-by-username.ts`: username match (order numeric `account_id` first, then `created_at`), else all-digit `account_id` -- Rules 3-4
- [x] `apps/backend/src/lib/accounts/find-profile-by-username.ts` -- re-export `normalizeUsername` from domain
- [x] `apps/backend` -- tests for the resolver (username wins, digit fallback, tie-break, not found, normalization); run `pnpm --filter backend codegen`
- [x] `apps/web/src/features/accounts/queries.graphql` + `pnpm --filter web codegen` -- renamed document/query
- [x] route dir `[accountId]` -> `[username]`; `page.tsx` -- one `cache()`-wrapped lookup for `generateMetadata` and page; page reads `searchParams` and calls `permanentRedirect` to `/${locale}/${platformSlug}/${username}` with params preserved when the segment differs from the normalized username; drop the unused `accountId` prop of `AccountContent` -- Rules 5-6
- [x] `mapper.ts` (4 sites), `subscriptions-content.tsx` -- use `buildAccountHref`; `onboarding-subscribe-step.tsx` -- drop the `accountId` label fallback
- [x] web tests -- update `mapper.test.ts`, `subscriptions-content.test.tsx`, `account-content.test.tsx`; add page test (308 + params, notFound) and a source-scan ratchet failing on a template literal that interpolates `accountId` into a path under `apps/web/src`
- [x] e2e specs -- navigate to `/en/ig/jktcity.events`; add one redirect check for a numeric ID URL

**Acceptance Criteria:**
- Given any account link on the web app, when it is built, then its href is `/<slug>/<lower-case username>` and never contains `account_id`.
- Given a numeric-ID or mixed-case account URL, when opened, then the response is a 308 to the username URL with the query string intact.
- Given the old query name, when grepping `apps/` outside generated files, then no reference remains.

## Spec Change Log

## Design Notes

Resolver shape (two stages, one function): `lower(username) = normalized` ordered by `(account_id ~ '^[0-9]+$') DESC, created_at ASC LIMIT 1`; if empty and `/^[0-9]+$/.test(segment)`, `account_id = segment`. The tie-break is transitional (AD-35 Rule 4) and carries a comment pointing at BUG-059 story 4.

## Verification

**Commands:**
- `pnpm install --frozen-lockfile` -- expected: success (worktree has no `node_modules`)
- `pnpm --filter @festgrid/domain test` and `pnpm --filter @festgrid/domain lint` -- expected: pass
- `pnpm --filter backend test` (needs the local Postgres from `.env`) and `pnpm --filter backend lint` -- expected: pass
- `pnpm --filter web test`, `pnpm --filter web lint`, `pnpm --filter web build` -- expected: pass
- `pnpm --filter web test:e2e -- account-page` -- expected: pass if the e2e stack is available; otherwise report as not run

## Suggested Review Order

**Link building (AD-35 Rules 1-2)**

- One builder: normalized username in, `/<slug>/<username>` or `null` out; no numeric fallback.
  [`account-href.ts:16`](../../packages/domain/src/scraper/account-href.ts#L16)

- Event mapper's four link sites now call the builder instead of a template literal.
  [`mapper.ts:107`](../../apps/web/src/features/events/mapper.ts#L107)

- Source-account href, same builder, null when the username is empty.
  [`mapper.ts:187`](../../apps/web/src/features/events/mapper.ts#L187)

- Subscription row navigation uses the builder; logs instead of building a numeric URL.
  [`subscriptions-content.tsx:98`](../../apps/web/src/app/[locale]/settings/account/subscriptions-content.tsx#L98)

- Label no longer falls back to the numeric `accountId`.
  [`onboarding-subscribe-step.tsx:86`](../../apps/web/src/features/onboarding/onboarding-subscribe-step.tsx#L86)

**Resolution (AD-35 Rules 3-4)**

- Username first, all-digit `account_id` fallback, transitional twin tie-break.
  [`resolve-profile-by-username.ts:24`](../../apps/backend/src/lib/accounts/resolve-profile-by-username.ts#L24)

- New query replaces the by-`accountId` one in the schema.
  [`social-media-accounts.graphql:45`](../../apps/backend/src/schema/social-media-accounts.graphql#L45)

- Resolver keeps the requested-fields projection and delegates the lookup.
  [`resolvers.ts:2877`](../../apps/backend/src/schema/resolvers.ts#L2877)

**Canonical URL (AD-35 Rules 5-6)**

- One cached lookup shared by `generateMetadata` and the page.
  [`get-account-profile-cached.ts:23`](../../apps/web/src/features/accounts/get-account-profile-cached.ts#L23)

- 308 to the username URL, comparing the normalized value, query string kept.
  [`page.tsx:96`](../../apps/web/src/app/[locale]/[platformSlug]/[username]/page.tsx#L96)

**Tests and guards**

- Ratchet failing on any `accountId` interpolated into a path under `apps/web/src`.
  [`account-url-ratchet.test.ts:12`](../../apps/web/src/lib/account-url-ratchet.test.ts#L12)

- Resolver cases: username wins, digit fallback, twin tie-break, no cross-platform match.
  [`resolve-profile-by-username.test.ts:59`](../../apps/backend/src/lib/accounts/resolve-profile-by-username.test.ts#L59)

- Page redirect cases: numeric id, mixed case, no loop, preserved params.
  [`page.test.tsx:68`](../../apps/web/src/app/[locale]/[platformSlug]/[username]/page.test.tsx#L68)

- Builder unit tests.
  [`account-href.test.ts:15`](../../packages/domain/src/scraper/account-href.test.ts#L15)

- E2E redirect checks (written, not run).
  [`account-page.spec.ts:49`](../../apps/web/e2e/account-page.spec.ts#L49)
