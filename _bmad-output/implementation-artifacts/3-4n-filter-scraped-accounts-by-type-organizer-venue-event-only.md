---
baseline_commit: d71e7ac
---
# Story 3.4n: Filter scraped accounts by type (organizer/venue/event only)

## Story Details

- Epic: 3
- Story ID: 3.4n
- Status: ready-for-dev

## Story

**As a** platform operator,
**I want** scraping to exclude personal attendee accounts and hold curator/local-guide accounts back until a minimization pipeline exists for them,
**so that** FestDaily never processes public posts from individuals outside the narrow "official event account" scope the platform's legitimate-interest legal position depends on.

**Depends on:** Story 3.2, Story 3.4, Story 3.4m (AI-inference trigger pattern), Story 0.13 (AI Gateway adapter), Story 4.7/4.7b (Moderator Items page — extended by sibling Story 4.7c for the review UI this story's `AWAITING_APPROVAL` state needs).

## Acceptance Criteria

1. **Given** a scrape trigger fires for an account — the scheduled batch (`getBatchScrapeTargets()`), the subscribe-time immediate scrape, the on-demand manual trigger (Story 5.6), or a Bright Data recovery-sweep retry — **when** the trigger evaluates whether to actually scrape, **then** it proceeds only if the account's `accountTypeStatus` is `NULL` (a legacy account that predates this story — see AC5) **or** ( `accountType = 'ORGANIZER_VENUE_EVENT'` **and** `accountTypeStatus = 'CONFIRMED'` ). Every other state (`PERSONAL`, `CURATOR_GUIDE`, `AWAITING_APPROVAL`) is excluded. The condition must distinguish "never classified" (`accountTypeStatus IS NULL`, allowed) from "classified but not cleared" (`accountTypeStatus = 'AWAITING_APPROVAL'`, excluded) — collapsing these into a single "no confirmed type" check would silently exclude legacy accounts, breaking AC5.

2. **And** classification runs exactly once, synchronously, inside `subscribeToAccount()` — after the new `SocialMediaAccountProfile` row is inserted, before the existing `triggerScrapeForAccount()` call — using **only pre-scrape signals**: the account's bio/biography, username, displayName, and Instagram's own `businessCategoryName` (fetched via a new dedicated Apify profile-lookup call, not the existing `lookupAccountProfile`/`castVote` path). Recent post captions are explicitly **not** a classification input at this gate, even though `epics.md`'s original draft of this AC suggested mirroring Story 3.4m's post-scrape-metadata trigger pattern — see Dev Notes "AC2/AC3 Tension, Resolved" for why that's structurally impossible for the subscribe-time immediate scrape specifically.

3. **And** `PERSONAL` accounts are permanently excluded from every scrape trigger. `CURATOR_GUIDE` accounts are excluded from every scrape trigger **for now** — held back exactly like `PERSONAL` — until Story 3.4o (the image/caption minimization pipeline this story splits off, see Dev Notes) ships and flips the gate; there must never be a window where a `CURATOR_GUIDE` account is scraped without those protections in place. Both `PERSONAL` and `CURATOR_GUIDE` accounts remain visible, subscribable `SocialMediaAccountProfile` rows — a subscriber can still add them — but the subscriber's UI shows an "excluded account" indicator, reusing Story 5.4's tab-icon-plus-message pattern (Gate 2 confirmed this is a trivial reuse, not a new component) with state-specific copy: `PERSONAL` ("this account can't be tracked"), `CURATOR_GUIDE` ("tracking for this account type is coming soon"), `AWAITING_APPROVAL` ("this account is pending review").

4. **And** a classification whose confidence score falls below a defined threshold, **or** a classification-step failure (the new Apify call errors/times out, the Gemini call errors/exhausts all keys, or the response fails to parse), sets `accountTypeStatus = 'AWAITING_APPROVAL'` rather than silently defaulting to inclusion or exclusion, and inserts one `accountTypeClassificationReviews` row (see Dev Notes for shape) recording the proposed type (if any), confidence score (if any), and failure reason (if the row exists because of a hard failure rather than low confidence). `subscribeToAccount()` itself must still succeed even when classification fails — the profile row and subscription are created regardless; only the scrape-trigger decision is affected — mirroring Story 3.4m AC10's catch-and-log-without-failing precedent. An `AWAITING_APPROVAL` account is excluded from scraping (AC1) until a moderator resolves it via Story 4.7c's new review surface (split off this story — see Dev Notes; not built here).

5. **And** a `SocialMediaAccountProfile` row that already exists before this story ships is **not** retroactively classified — `accountType`/`accountTypeStatus` stay `NULL`, and per AC1's condition this is treated as an **implicit allow**: a legacy account's scraping continues completely unchanged by this story. This is a deliberate, user-accepted gap, not an oversight — see Dev Notes "Legacy Accounts: Explicit Accepted Gap" for the alternative that was considered and rejected (a one-time backfill-classification job) and why.

## Tasks / Subtasks

- [ ] **Task 1 (AC2, AC4) — Data Type Compatibility: schema migration**
  - [ ] `packages/database/schema.ts`: add `accountTypeEnum = pgEnum('account_type', ['ORGANIZER_VENUE_EVENT', 'PERSONAL', 'CURATOR_GUIDE'])` and `accountTypeStatusEnum = pgEnum('account_type_status', ['CONFIRMED', 'AWAITING_APPROVAL'])`.
  - [ ] On `socialMediaAccountProfiles`: add `accountType: accountTypeEnum('account_type')` (nullable — legacy rows, AC5), `accountTypeStatus: accountTypeStatusEnum('account_type_status')` (nullable, same reason), `accountTypeConfidenceScore: doublePrecision('account_type_confidence_score')` (nullable).
  - [ ] Add new table `accountTypeClassificationReviews` (mirrors `defaultLocationChangeRequests`' shape — same moderator-accountability pattern, no revert/previous-value tracking since nothing is auto-applied pre-review):
    ```ts
    export const accountTypeClassificationReviews = pgTable('account_type_classification_reviews', {
      id: uuid('id').defaultRandom().primaryKey(),
      accountId: uuid('account_id').references(() => socialMediaAccountProfiles.id).notNull(),
      proposedAccountType: accountTypeEnum('proposed_account_type'), // null if the classification step failed before producing any answer
      confidenceScore: doublePrecision('confidence_score'),
      failureReason: text('failure_reason'), // populated only when AWAITING_APPROVAL is due to a hard failure, not low confidence
      resolvedAccountType: accountTypeEnum('resolved_account_type'), // set by the moderator on resolution (Story 4.7c)
      reviewedByModeratorId: uuid('reviewed_by_moderator_id').references(() => users.id),
      reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
      createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    }, (t) => ({
      accountIdx: index('idx_account_type_classification_reviews_account').on(t.accountId),
    }));
    ```
  - [ ] `pnpm --filter database run generate` — commit the generated migration (AD-3: generated migrations only).

- [ ] **Task 2 (AC2) — New Apify adapter method for pre-scrape profile lookup**
  - [ ] `apps/backend/src/lib/scraper/instagram-adapter.ts`: add a new actor constant `CLASSIFY_ACCOUNT_PROFILE_ACTOR = 'apify~instagram-profile-scraper'` — distinct from the existing `LOOKUP_ACCOUNT_PROFILE_ACTOR = 'apify/instagram-post-scraper'` (used only by `castVote`; do not touch that path). This actor was validated with a real smoke test today (`_bmad-output/implementation-artifacts/apify-runs/run-BIbGhsAYIVlbRe9JQ.infoeventjogja.md`, `run-4FnfXRoznAcWi1W0V.plazaambarrukmo.md`) — 2/2 clean, $0.0026/call, 3-9s, reliably returns `biography`/`fullName`/`username`/`businessCategoryName`. Two alternatives (`figue~instagram-profile-scraper`, `danek~instagram-profiles-scraper-ppr`) were also tested and ruled out (rate-limited / empty results).
  - [ ] Add a new `ActorRegistry` entry with input type `{ usernames: string[]; includeAboutSection: false }` (matches the validated smoke-test input shape) and an output item type carrying `biography?`, `fullName?`, `username?`, `businessCategoryName?`.
  - [ ] Add a new exported adapter method (naming to match the file's existing style, e.g. `getAccountClassificationProfile(username: string): Promise<{ biography: string; username: string; displayName: string; businessCategoryName: string | null } | null>`) that mirrors `lookupAccountProfile`'s existing capacity-check (`assertProviderCapacityAvailable('apify', ...)`) and `withTimeoutOrThrow`/`ApifyRequestTimeoutError` pattern (20s bound, same as the existing method) — do not modify `lookupAccountProfile` itself.
  - [ ] Unit/integration test coverage mirroring `instagram-adapter.test.ts`'s existing `lookupAccountProfile` tests (valid response, not-found item, timeout, capacity-exceeded).

- [ ] **Task 3 (AC2, AC4) — Pure classification prompt-builder in `packages/domain`**
  - [ ] Create `packages/domain/src/scraper/account-classification.ts` (mirrors `account-enrichment.ts`'s Story 3.4m pattern — pure, no DB/Node-only imports), exporting:
    - `accountClassificationResponseSchema` (Gemini `responseSchema`, OpenAPI-style): `{ type: 'OBJECT', properties: { accountType: { type: 'STRING', enum: ['ORGANIZER_VENUE_EVENT','PERSONAL','CURATOR_GUIDE'] }, confidenceScore: { type: 'NUMBER' } }, required: ['accountType', 'confidenceScore'] }`.
    - `buildAccountClassificationRequest(profile: { biography: string; username: string; displayName: string; businessCategoryName: string | null }): { systemInstruction: string; contents: string; responseMimeType: 'application/json'; responseSchema: typeof accountClassificationResponseSchema }` — system instruction scopes Gemini to classifying strictly from bio/username/displayName/businessCategoryName, explicitly instructed this is a legal-compliance gate (never guess confidently when signal is thin — a low score is the correct, expected output for an ambiguous account, not a failure).
    - `parseAccountClassificationResponse(rawText: string): { accountType: 'ORGANIZER_VENUE_EVENT'|'PERSONAL'|'CURATOR_GUIDE'; confidenceScore: number } | null` — never throws; returns `null` on parse failure or an out-of-enum value.
  - [ ] Add `export * from "./account-classification.js";` to `packages/domain/src/scraper/index.ts`.
  - [ ] `packages/domain/src/scraper/account-classification.test.ts` (`node:test`) — 100% coverage (project's non-negotiable rule for `packages/domain`): request-building with/without `businessCategoryName`, response parsing (valid, malformed JSON, out-of-enum value, missing `confidenceScore`).

- [ ] **Task 4 (AC2, AC4) — System-key Gemini fallback sibling function**
  - [ ] `apps/backend/src/lib/ai-gateway/system-key-adapter.ts`: add `callGeminiForAccountClassification`, mirroring the existing `callGeminiForLocationInference` exactly (calls `callGemini` first; on `AiGatewayExhaustedError`, falls back to `SYSTEM_GEMINI_API_KEY` per AD-10; any other error propagates unchanged). See Dev Notes "Why a System-Key Fallback Is Needed Here" for why this can't just rely on the subscribing user's own key.
  - [ ] Test coverage mirroring the existing `callGeminiForLocationInference` tests in the same file.

- [ ] **Task 5 (AC1-AC5) — Orchestration: `classifyAccountType` + wire into `subscribeToAccount()`**
  - [ ] Create `apps/backend/src/lib/accounts/classify-account-type.ts` exporting `classifyAccountType(params: { accountId: string; username: string; userId: string }): Promise<{ accountType: 'ORGANIZER_VENUE_EVENT'|'PERSONAL'|'CURATOR_GUIDE'|null; accountTypeStatus: 'CONFIRMED'|'AWAITING_APPROVAL' }>`:
    1. Call `getAccountClassificationProfile(username)` (Task 2). If it returns `null` or throws, treat as a hard failure (step 4 below).
    2. Call `buildAccountClassificationRequest(profile)` (Task 3), then `callGeminiForAccountClassification({ ...promptRequest, provider: 'gemini', subscriberUserIds: [userId] })` — **`[userId]` is the acting user passed in from the resolver, not derived from `getActiveSubscriberUserIds(accountId)`**. At this point in `subscribeToAccount()` the calling user's own `subscriptions` row has not been inserted yet (it's inserted later in the same function), so `getActiveSubscriberUserIds` would return an empty array here and `selectApiKey` would throw `AiGatewayExhaustedError` on **every** first-time subscribe, regardless of whether the user has a working key — this was caught during this story's own architecture review (Gate 1) and must not be silently reintroduced by copying Story 3.4m's `getActiveSubscriberUserIds` call verbatim.
    3. `parseAccountClassificationResponse(result.text)` (Task 3). If below the confidence threshold (config value, default TBD by dev — document the chosen default in Dev Agent Record), go to step 4 with the proposed type/score recorded (not a failure — a genuine low-confidence result).
    4. **On success above threshold:** `db.update(socialMediaAccountProfiles).set({ accountType, accountTypeStatus: 'CONFIRMED', accountTypeConfidenceScore: score }).where(eq(id, accountId))`. Return `{ accountType, accountTypeStatus: 'CONFIRMED' }`.
    5. **On low confidence or any failure (Apify/Gemini/parse):** `db.update(socialMediaAccountProfiles).set({ accountType: proposedTypeOrNull, accountTypeStatus: 'AWAITING_APPROVAL', accountTypeConfidenceScore: scoreOrNull })`, insert one `accountTypeClassificationReviews` row (`proposedAccountType`, `confidenceScore`, `failureReason` — populated only for a hard failure, not low confidence). Return `{ accountType: proposedTypeOrNull, accountTypeStatus: 'AWAITING_APPROVAL' }`. This entire function is wrapped so it **never throws** to its caller (mirrors 3.4m AC10 — catch, log with `accountId` for traceability, resolve to the `AWAITING_APPROVAL` outcome).
  - [ ] `apps/backend/src/lib/subscriptions/subscribe-to-account.ts`: after the profile insert/re-select (existing lines ~52-76) and before the existing `triggerScrapeForAccount` call (existing line ~88), call `const classification = await classifyAccountType({ accountId: accountProfile.id, username: accountProfile.username, userId })` (the resolver-level acting user, already a param of `subscribeToAccount`). Only call `triggerScrapeForAccount` if `classification.accountType === 'ORGANIZER_VENUE_EVENT' && classification.accountTypeStatus === 'CONFIRMED'`.
  - [ ] Test coverage: `classify-account-type.test.ts` (`node:test`, real local DB, Apify/Gemini seams mocked/injected) — success above threshold; low confidence; Apify failure; Gemini failure; malformed Gemini response; confirms `[userId]` (not `getActiveSubscriberUserIds`) is what's passed to the Gemini call.
  - [ ] Extend `apps/backend/src/lib/subscriptions/subscribe-to-account.test.ts`: a new subscription for an account classified `PERSONAL`/`CURATOR_GUIDE`/`AWAITING_APPROVAL` creates the profile+subscription rows but never calls `triggerScrapeForAccount`; `ORGANIZER_VENUE_EVENT`+`CONFIRMED` calls it exactly as today; a classification-step throw still results in a successful `subscribeToAccount()` return (AC4).

- [ ] **Task 6 (AC1) — Gate every other scrape-trigger call site**
  - [ ] `apps/backend/src/lib/scraper/get-scrape-targets.ts`: add `and(or(isNull(socialMediaAccountProfiles.accountTypeStatus), and(eq(socialMediaAccountProfiles.accountType, 'ORGANIZER_VENUE_EVENT'), eq(socialMediaAccountProfiles.accountTypeStatus, 'CONFIRMED'))))` to `getBatchScrapeTargets()`'s existing `where(...)` clause.
  - [ ] `apps/backend/src/schema/resolvers.ts` — the on-demand manual-trigger resolver (Story 5.6, ~line 573 `const profile = profileRows[0]`): immediately after fetching `profile`, add the same gate check; throw `GraphQLError('Account is excluded from scraping', { extensions: { code: 'ACCOUNT_TYPE_EXCLUDED' } })` if it fails, before the existing `isScrapeInProgress` check.
  - [ ] `apps/backend/src/lib/scraper/stale-job-sweep.ts` (Bright Data recovery sweep, Story 3.4a): **no change needed** — confirmed by direct reading that `runStaleJobSweep` only retries/fetches results for already-existing `brightdataPendingJobs`/Apify-pending-job rows, which only ever get created from `getBatchScrapeTargets()`'s already-gated output (Task 6's first bullet). It never independently selects new scrape targets, so there is no second gate to add here.
  - [ ] Extend `get-scrape-targets.ts`'s existing test file: an `ORGANIZER_VENUE_EVENT`+`CONFIRMED` account is included; `PERSONAL`/`CURATOR_GUIDE`/`AWAITING_APPROVAL` accounts are excluded; a legacy account (`accountTypeStatus IS NULL`) is included unchanged (AC5).

- [ ] **Task 7 (AC3) — Subscriber-facing "excluded account" indicator**
  - [ ] Extend the `mySubscriptions` GraphQL query (Story 3.2/5.1a) to expose `accountType`/`accountTypeStatus` on the subscription's account.
  - [ ] Reuse Story 5.4's existing tab-icon + tab-message component in `apps/web`'s Manual Post Selection screen (Gate 2 confirmed: same shape, different per-state copy — not a new component): render the icon/message for `PERSONAL`, `CURATOR_GUIDE`, and `AWAITING_APPROVAL` per the copy specified in AC3. Hide the "remove subscription" button specifically for `AWAITING_APPROVAL` (that account could still become eligible) — keep it visible for `PERSONAL`/`CURATOR_GUIDE` (mirrors Story 5.4's existing inactive-account affordance).
  - [ ] i18n: add the three new state-message strings to the relevant locale namespace (`en`, `id`) per project-context.md's i18n rule.

- [ ] **Task 8 — IaC verification**
  - [ ] Confirmed by this story's own Gate 1 review: `apiLambda` already has `apifyApiTokenSecret.grantRead` and `kmsKey.grantEncryptDecrypt` (`apps/infrastructure/lib/festgrid-backend-stack.ts:432,402`) — **no new IaC needed** for the new Apify/Gemini calls added by this story. `SYSTEM_GEMINI_API_KEY` (Task 4's fallback) is already provisioned on `ScraperLambda` by Story 3.4m; confirm (do not assume) it is also present on `apiLambda`'s environment — if not, add it there following Story 3.4m's exact `systemGeminiApiKeySecret` pattern (Task 8 of that story), scoped to `apiLambda` this time.
  - [ ] `cdk synth` confirms the stack synthesizes without error if any change was needed above.

- [ ] **Task 9 — Verification (AC1-AC5)**
  - [ ] `pnpm --filter domain exec tsx --test src/scraper/account-classification.test.ts` — 100% coverage.
  - [ ] `pnpm --filter backend exec tsx --test src/lib/scraper/instagram-adapter.test.ts src/lib/ai-gateway/system-key-adapter.test.ts src/lib/accounts/classify-account-type.test.ts src/lib/subscriptions/subscribe-to-account.test.ts src/lib/scraper/get-scrape-targets.test.ts` — all pass.
  - [ ] `pnpm --filter database run generate && pnpm --filter database run migrate` against local Postgres; `seed.ts` still runs without error.
  - [ ] `pnpm --filter backend run codegen` regenerates cleanly.
  - [ ] `pnpm build` and `pnpm lint` at the repo root are clean.

## Dev Notes

### Architecture & UX Gate Findings

Epic 3's readiness sweep (`epic-3-readiness.md`, `swept: true`, dated 2026-08-09) predates this story (created 2026-09-02 via `bmad-correct-course`) by three weeks and does not cover it — Gate 1, 2, and 3 were each run fresh via persona subagents.

- **Gate 1 (Winston/Architect) — pass, with one bug caught and fixed, one recommendation adopted.**
  - IaC: confirmed sufficient with zero new grants — `apiLambda` already has `apifyApiTokenSecret.grantRead` and `kmsKey.grantEncryptDecrypt`. A direct `callGemini` call from `subscribeToAccount()` (in `apiLambda`) mirrors the already-sanctioned Story 4.2a precedent of a resolver calling `callGemini` directly, not via SQS.
  - **Bug caught before it shipped:** the design initially planned to reuse Story 3.4m's `getActiveSubscriberUserIds(accountId)` to source the Gemini call's `subscriberUserIds`. Traced `subscribeToAccount()`'s actual control flow: the classification step runs inside the `if (!accountProfile)` branch, which fires only for a brand-new account — and at that point the calling user's own `subscriptions` row has **not yet been inserted** (that happens later in the same function). `getActiveSubscriberUserIds` would therefore return an empty array on exactly this path, and `selectApiKey`'s `fetchCandidateKeys('gemini', [])` would find nothing and throw `AiGatewayExhaustedError` on **every single first-time subscribe**, independent of whether the user has a working key — silently defeating the feature for its highest-volume case. Fixed in the design (Task 5): pass `[userId]` — the acting user from the resolver — directly, mirroring the existing precedent at `resolvers.ts:219,1390` of calling `fetchCandidateKeys('gemini', [authUser.userId])` directly.
  - **Recommendation adopted:** a lightweight `accountTypeClassificationReviews` table (Task 1) rather than either a bare status column with no audit trail, or the fuller revert-capable `defaultLocationChangeRequests` pattern. `defaultLocationChangeRequests` carries `reviewedByModeratorId` for moderator accountability independent of its revert/previous-value machinery; a bare column-only design would lose who-resolved-what history entirely, but the revert/previous-value fields don't apply here since nothing is auto-applied pre-review (unlike 3.4m's location inference).

### Why a System-Key Fallback Is Needed Here

Unlike Story 3.4m's location inference (which only fires for an account that already has ≥1 real subscriber with a settled relationship to the account), this story's classification fires at the exact moment of a user's **first** subscribe action — plausibly before that user has ever configured a working Gemini key via onboarding. Relying solely on the subscribing user's own key (no system-key fallback) would route every such case straight to `AWAITING_APPROVAL`, which — while not incorrect per AC4 — would make the feature far noisier than intended and swamp the Story 4.7c moderator queue with cases that have nothing to do with genuine classification ambiguity. `callGeminiForAccountClassification` (Task 4) reuses Story 3.4m/AD-10's exact sibling-function-with-system-key-fallback shape for this reason.

### AC2/AC3 Tension, Resolved

`epics.md`'s original Story 3.4n draft (AC2) said to mirror Story 3.4m's trigger pattern, which classifies using scraped **post** data inside `processScrapeJob` — i.e., after scraping has already happened. But the same draft's AC3 requires excluding an account from **every** scrape trigger, explicitly including the subscribe-time immediate scrape, which fires synchronously inside `subscribeToAccount()` **before any post has ever been scraped**. Literally following the AC2 draft would mean the first scrape always happens before classification can gate it — directly contradicting AC3's "permanently excluded... including subscribe-time immediate scrape," and the platform's stated legal position ("never scrape a personal account, not even once"). Resolved with the user (confirmed via `AskUserQuestion` during this story's creation): classify **before** the first scrape, using only bio/username/displayName/`businessCategoryName` — signals available with zero posts scraped. This is reflected in the AC2/AC3 text above, which supersedes the original `epics.md` draft language.

### Legacy Accounts: Explicit Accepted Gap

Considered and rejected during this story's creation (confirmed via `AskUserQuestion`): a one-time backfill-classification batch job running every pre-existing `SocialMediaAccountProfile` row through the same classifier. Rejected in favor of grandfathering (AC5) — ships faster, avoids a batch job's Apify/Gemini cost across every existing account. **This is a deliberate, explicitly accepted gap, not an oversight**: it leaves the exact legal exposure this story's own rationale describes (never scrape a personal account) open for every account subscribed before this story ships. If that exposure becomes unacceptable later, a follow-up backfill story can reuse `classifyAccountType` (Task 5) directly — it takes `accountId`/`username`/`userId` and needs no new logic, only a batch driver and a `userId` to attribute the classification calls to (unresolved by this story — a legacy account backfill has no single "the subscribing user," see Dev Notes for that future story to resolve, not this one).

### New Prerequisite Stories Split Off This Story

Two gaps surfaced during this story's own creation that this story deliberately does not build inline, per `story-split-gate.md`'s "do not silently absorb" rule — both confirmed via `AskUserQuestion` with the user, and both now have full sections in `epics.md`:

- **Story 3.4o** — the `CURATOR_GUIDE` minimization pipeline (no durable image storage, post captions used for extraction only and never displayed, captions deleted after extraction) this story's AC3 depends on before `CURATOR_GUIDE` accounts can ever be scraped. Interacts with Story 3.6e (image re-hosting) and Story 3.6g/3.6h (image-storage opt-in flag, not yet built). Lettered suffix directly off this story (`story-split-gate.md`'s "single-story split" numbering rule — this story's own creation is what surfaced the gap).
- **Story 4.7c** — the moderator-facing review surface for `AWAITING_APPROVAL` account-type classifications. Gate 2 (Freya/UX persona) confirmed `/moderator/items` (Story 4.7, extended by 4.7b) is not a generically pluggable review queue — it hard-codes exactly two list/resolve shapes (`reportedEvents`, `pendingDefaultLocationChanges`) with type-specific fields and actions; account-type classification review is a structurally distinct third type (proposed classification/confidence, not a location diff) with no existing slot to drop into. Positioned as a lettered suffix off **Story 4.7** (the story that owns `/moderator/items`'s query/mutation pattern), matching how FR94-96 already extended 4.7 itself for a second Default-Location sub-case rather than being built into the story that triggered that need.
- **The subscriber-facing tab badge itself (AC3) is NOT split off** — Gate 2 confirmed this is a trivial reuse of Story 5.4's existing pattern (different copy per state, same component), matching Story 3.4m's own Gate 2 precedent for a similarly simple case.

### Existing code this story reads and extends (confirmed by direct reading, not assumed)

- **`apps/backend/src/lib/subscriptions/subscribe-to-account.ts`** (full file read) — today, `subscribeToAccount()` never fetches a bio at all. `profile: ProfileInput` (`displayName`/`username`/`profileImageUrl?`/`description?`) comes straight from client input via the resolver (`resolvers.ts:485-512`); `description` is never populated. The insert-then-`triggerScrapeForAccount` sequence this story hooks into is exactly as described in Task 5.
- **`apps/backend/src/lib/scraper/instagram-adapter.ts`** — the existing `lookupAccountProfile()` (used only by `castVote`, confirmed via Story 3.4d's own investigation) uses a different actor (`apify/instagram-post-scraper`, `resultsType: 'details'`) whose exact input shape was never actually validated with real data in Story 3.4d's own Task 1b runs (which tested a different input mode for that actor) — it cannot be assumed to reliably return `biography`, and this story does not touch or rely on it. This story's new classification lookup (Task 2) uses a separately-validated actor instead.
- **`apps/backend/src/lib/scraper/get-scrape-targets.ts`** (full file read) — `getBatchScrapeTargets()` today has zero `accountType` filtering; its `where(and(activeOnly(subscriptions), or(isNull(lastScrapedAt), lt(lastScrapedAt, cutoffDate))))` gains this story's new condition (Task 6) additively.
- **`apps/backend/src/lib/scraper/stale-job-sweep.ts`** (read directly) — confirmed to only retry already-created pending-job rows, never independently select new scrape targets; no gate needed here (Task 6).
- **`packages/database/schema.ts`** — `defaultLocationChangeStatusEnum` already includes an `AWAITING_APPROVAL` value (alongside `PENDING_REVIEW`/`ACCEPTED`/`REJECTED`/`REVERTED`/`SUPERSEDED`) and `defaultLocationChangeRequests` already has a `confidenceScore` column with the exact comment "gates AWAITING_APPROVAL vs immediate apply" — this story's `accountTypeClassificationReviews` table (Task 1) deliberately mirrors that established shape rather than inventing a new one.

### Data Type Compatibility & Migration Requirements

- **Mismatch found.** No `accountType`/`accountTypeStatus`/`accountTypeConfidenceScore` columns exist on `socialMediaAccountProfiles` today, and no table exists for account-type moderator review.
- **Impacted fields/contracts:** `packages/database/schema.ts` (`socialMediaAccountProfiles` gains three nullable columns; new `accountTypeClassificationReviews` table); `apps/backend/src/schema/*.graphql` (new fields on the account/subscription type for AC3's subscriber-facing indicator — Task 7); `apps/backend/src/generated/resolvers-types.ts` (regenerated, never hand-edited).
- **Required DB migration:** `drizzle-kit generate`-produced migration (Task 1) — two new enum types, three new nullable columns on `social_media_account_profiles`, one new table. All new columns nullable with no default beyond what's specified — a pre-existing row is unaffected (AC5).
- **Required TypeScript changes:** Drizzle table definitions (compile-time inferred); GraphQL SDL + regenerated codegen output for Task 7's new exposed fields.
- **Backward compatibility:** purely additive — no existing column type changes, no existing query breaks. `getBatchScrapeTargets()`'s new condition (Task 6) is additive to its existing `where` clause.
- **Verification:** generated migration applies cleanly against local Postgres + `seed.ts` still succeeds (Task 9); `get-scrape-targets.test.ts`'s new legacy-account case (Task 6) proves AC5's grandfather behavior end-to-end.

### Package boundaries (project-context.md Code Organization rule)

- `packages/domain/src/scraper/account-classification.ts` (Task 3) is pure (no DB/SDK/Node-only imports) — correctly placed in `packages/domain`, 100%-unit-tested per the project's non-negotiable rule, mirroring `account-enrichment.ts`'s exact precedent.
- `classify-account-type.ts`, the new Apify adapter method, and `callGeminiForAccountClassification` are all DB/SDK-coupled orchestration — correctly placed in `apps/backend`, not `packages/domain`.

### State management / async loader / i18n / analytics categorization

- **State management:** the subscriber-facing indicator (Task 7) reads `accountType`/`accountTypeStatus` via the existing `mySubscriptions` React Query-backed query (Server State) — no new state category introduced.
- **Async loader:** not applicable to the new backend classification step (no UI awaits it directly — it runs inside the existing `subscribeToAccount` mutation, which already has its own blocking-loader treatment from Story 3.2).
- **i18n:** Task 7 adds three new locale-keyed strings (`en`, `id`) for the state-specific tab messages — per project-context.md's Locale-Sensitive Data Rendering rule, these must resolve through `next-intl`, not be hardcoded.
- **Analytics (PostHog/AD-5):** not applicable — no new user-initiated interaction is instrumented by this story (classification is fully automatic).
- **Unified Query DSL (AD-1/AD-2):** not applicable — `mySubscriptions` already exists and is unchanged in query shape; only its item shape gains fields (Task 7).

## Global Rules References

- [x] `_bmad-output/project-context.md` — Code Organization (`packages/domain` purity + 100% coverage), General Architecture (Adapter Pattern for Gemini), Locale-Sensitive Data Rendering (Task 7's new strings), Resilient Processing Pipeline (addressed by the Gate 1 finding above — this story's direct-`callGemini` shape is a confirmed-sanctioned exception, same as Story 4.2a).
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order/status vocabulary followed in this file.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-3 (generated-migrations-only), AD-10 (system-key fallback pattern, reused by Task 4).
- [x] `docs/infrastructure/2-backend.md`, `docs/infrastructure/index.md` — Lambda/queue architecture, referenced by the Gate 1 IaC finding.
- [x] `_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md` — this story's own rationale traces to the minimization doc referenced in its `epics.md` Note (`monetization-plans/scraping-extraction-display-rules-2026-09-02.md` §1.3, §2.8).
- [x] `_bmad-output/planning-artifacts/story-split-gate.md` — Gate 1/2/3 findings above; two new prerequisite stories (3.4o, 4.7c) registered per its numbering rule.

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - `packages/database/schema.ts` (new enums, columns, table) + generated migration
  - `packages/domain/src/scraper/account-classification.ts` + `.test.ts` (new), `index.ts` (export)
  - `apps/backend/src/lib/scraper/instagram-adapter.ts` (new actor constant, registry entry, adapter method) + test additions
  - `apps/backend/src/lib/ai-gateway/system-key-adapter.ts` (new sibling function) + test additions
  - `apps/backend/src/lib/accounts/classify-account-type.ts` + `.test.ts` (new)
  - `apps/backend/src/lib/subscriptions/subscribe-to-account.ts` (wire in classification call) + test additions
  - `apps/backend/src/lib/scraper/get-scrape-targets.ts` (gate condition) + test additions
  - `apps/backend/src/schema/resolvers.ts` (on-demand manual-trigger gate check)
  - `apps/backend/src/schema/*.graphql` + regenerated `resolvers-types.ts` (AC3's new exposed fields)
  - `apps/web` — Manual Post Selection tab indicator reuse (Task 7), locale files (`en`, `id`)
  - `apps/infrastructure/lib/festgrid-backend-stack.ts` — only if `SYSTEM_GEMINI_API_KEY` is confirmed absent from `apiLambda` (Task 8)
- **Rule Mapping:** `packages/domain` purity + coverage (Task 3) → Code Organization rule; Adapter Pattern (Tasks 2/4) → General Architecture rule; generated-migrations-only (Task 1) → AD-3; i18n (Task 7) → Locale-Sensitive Data Rendering rule.
- **Verification Plan:** Task 9's full test/build/lint sweep; the specific AC5 legacy-account test case in `get-scrape-targets.test.ts`; the specific `[userId]`-not-`getActiveSubscriberUserIds` assertion in `classify-account-type.test.ts` (regression guard for the Gate 1-caught bug).

## Pre-Coding Approval Gate

- [ ] Scope confirmation — AC1-AC5 above, as amended from `epics.md`'s original draft per the "AC2/AC3 Tension" and "Legacy Accounts" Dev Notes
- [ ] Architecture and boundary confirmation — Gate 1/2/3 findings above
- [ ] Testing plan confirmation — Task 9
- [ ] Explicit human approval state: **pending approval**
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted — Story 3.4o and Story 4.7c are new, `backlog`, not yet built; this story's own scope (AC1/AC3) already holds `CURATOR_GUIDE` and `AWAITING_APPROVAL` accounts back pending them, so their absence does not block starting this story, only `CURATOR_GUIDE`/`AWAITING_APPROVAL` accounts ever actually scraping. Legacy-account grandfathering (AC5) is a user-accepted gap, not a prerequisite.

## Testing Requirements

- [ ] Integration tests — per-task test files listed above (`node:test`, real local DB where DB-coupled, mocked Apify/Gemini seams)
- [ ] E2E tests — not required; this story has no new critical user-facing flow (the subscriber indicator, Task 7, is a read-only badge, not a flow)

## Deliverables Checklist

- [ ] Schema migration (Task 1) applied and committed
- [ ] New Apify adapter method + actor constant (Task 2)
- [ ] Pure classification prompt-builder, 100% covered (Task 3)
- [ ] System-key Gemini fallback sibling (Task 4)
- [ ] `classifyAccountType` orchestration wired into `subscribeToAccount()` (Task 5), with the `[userId]` fix in place
- [ ] All scrape-trigger call sites gated (Task 6)
- [ ] Subscriber-facing indicator (Task 7)
- [ ] `epics.md` Story 3.4o and Story 4.7c sections written; `sprint-status.yaml` backlog entries added

## Out of Scope

- **Story 3.4o** — `CURATOR_GUIDE` minimization pipeline (no image storage, caption suppression/deletion). New prerequisite story, `backlog`.
- **Story 4.7c** — moderator review UI for `AWAITING_APPROVAL` classifications. New prerequisite story, `backlog`. Until it ships, `AWAITING_APPROVAL` accounts have no way to be resolved except a manual DB/ops action — an accepted, temporary gap since this story's own AC4 already ensures they're excluded from scraping in the meantime (fails safe, not open).
- Legacy-account backfill classification — explicitly rejected (AC5, "Legacy Accounts: Explicit Accepted Gap").
- Any change to `castVote`'s existing `lookupAccountProfile` path — untouched, different actor, different purpose.

## Definition of Done

- [ ] AC1-AC5 satisfied
- [ ] All tests in Task 9 passing
- [ ] Lint and type checks passing for touched packages
- [ ] `epics.md` amended with this story's Note (AC2/AC3 resolution, CURATOR_GUIDE policy correction) and new Story 3.4o/4.7c sections
- [ ] `sprint-status.yaml` updated: this story → `ready-for-dev`; `3-4o-...` and `4-7c-...` added as new `backlog` entries

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (context-engineering pass, `bmad-create-story`)

### Debug Log References

### Completion Notes List

- Story creation surfaced and resolved a real AC2/AC3 contradiction in the original `epics.md` draft (subscribe-time exclusion vs. post-scrape-metadata classification trigger) via `AskUserQuestion` with the user.
- User's answer to the "review mechanism" question substantively changed the account-type policy from the original draft: `CURATOR_GUIDE` is no longer permanently excluded, only temporarily (pending Story 3.4o's minimization pipeline) — this required re-deriving AC3 rather than copying `epics.md` verbatim.
- Architecture review (Gate 1, via subagent) caught a concrete bug before implementation: reusing `getActiveSubscriberUserIds` for the Gemini call would break every first-time subscribe. Fixed in the design (Task 5).
- UX review (Gate 2, via subagent) found the moderator-review-surface half of AC4 needs its own story (4.7c) even though the subscriber-facing badge half (AC3) does not.

### File List

_(populated by `bmad-dev-story`)_
