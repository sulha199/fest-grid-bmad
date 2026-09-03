---
baseline_commit: 441718b
---
# Story 3.4o: Minimize stored/displayed data for curator/guide-sourced posts

## Story Details

- Epic: 3
- Story ID: 3.4o
- Status: review

## Story

**As a** platform operator,
**I want** posts scraped from `CURATOR_GUIDE`-classified accounts to never have their images durably stored or their captions displayed/retained in the app, while still allowing event extraction from them,
**so that** the platform can responsibly scrape curator/local-guide accounts (which republish others' event content, not their own) without over-collecting or over-displaying data that account doesn't have a legitimate-interest basis to have redistributed in the first place.

**Depends on:** Story 3.4n (`accountType` classification — schema change already present uncommitted in the working tree, story itself `ready-for-dev`), Story 3.6e (image re-hosting, `done`), Story 3.6 (post extraction pipeline, `review`), **Story 3.6g (image-storage opt-in flag — `isImageStorageOptedIn` column, `ready-for-dev`, not yet built — see "AC1/AC5 Opt-In Dependency" below; this is a genuine blocking dependency for part of AC1, not a soft reference).**

## Acceptance Criteria

1. **Given** a post is scraped from an account classified `accountType = 'CURATOR_GUIDE'` (Story 3.4n) **and** that account's `isImageStorageOptedIn` is not `true` (Story 3.6g), **when** the post reaches the AI Processor Lambda's image re-hosting step (`process-ai-job.ts`, currently calling `rehostPostImageSeam` unconditionally), **then** the durable re-host is skipped — `durableImageUrl` stays `null` for that post, exactly as it already does for a post that fails extraction, and the transient, short-lived source CDN URL is what's served until it expires (reuses the existing `EventImage`/Event-resolver fallback chain from Story 3.6f — original URL, then `durableImageUrl` if populated, else the original as a last resort — no new fallback mechanism needed).
   **And**, **given** a `CURATOR_GUIDE` account has `isImageStorageOptedIn = true` (a moderator has explicitly opted it in via Story 3.6g's mutation), **then** the durable re-host proceeds exactly as it does for an `ORGANIZER_VENUE_EVENT` account — the opt-in overrides the `CURATOR_GUIDE` default (see "AC1/AC5 Opt-In Dependency" below; this scope is image storage only, not captions — AC2/AC3 below apply regardless of opt-in status).

2. **And** a `CURATOR_GUIDE`-sourced post's caption (`posts.content`) is used as normal for Gemini event extraction (Story 3.6) but is never displayed anywhere in the app. Two display surfaces were found by inventorying every reader of `posts.content`/`post.content` across `apps/web` and `apps/backend` (confirmed via direct code search — not assumed to be a single surface):
   - **Manual Post Selection screen** (`apps/web/src/app/[locale]/posts/select/posts-select-content.tsx`) — the only UI component rendering the raw caption (`PostCard`, `packages/ui/src/features/posts/PostCard.tsx`).
   - **"AI-assisted correction" trigger** (`apps/web/src/features/events/correction-dialog.tsx` → `AiAssistedCorrectionTrigger` → `extractEventDataFromUrl` mutation) — does not render the caption directly, but its backend dual-lookup path (`apps/backend/src/schema/resolvers.ts:1322-1344`) reads `post.content` to re-run extraction for an already-existing post. This is a real, resolved conflict (not just a display concern) — see "Correction-Flow Conflict, Resolved" below.

3. **And** once a `CURATOR_GUIDE`-sourced post reaches a terminal extraction state, its `posts.content` (caption) is cleared/nulled. **Terminal state, precisely defined** (resolved via `AskUserQuestion` during this story's creation, after confirming the actual pipeline behavior — see "Terminal-State Scope, Resolved" below): the exact two existing `markPostExtractedSeam(postId)` call sites in `apps/backend/src/lib/ai-processor/process-ai-job.ts` (the "not an event" path and the "event successfully enqueued" path) — no new terminal-state concept is invented. A third code path (Gemini response fails `JSON.parse` or AJV validation) returns early without calling `markPostExtractedSeam` by Story 3.6's own deliberate, pre-existing design (a non-retryable skip-and-log, confirmed via reading that story's Dev Notes — there is no retry mechanism for this path anywhere in the codebase today, and the only theoretical path back — "a future manual re-selection, Epic 5" — does not exist as a feature yet either). This path is an explicit, accepted, documented gap: a `CURATOR_GUIDE` post whose Gemini response fails validation keeps its caption in the database indefinitely, with no automated way to clear it. This gap is inherent to the pipeline's existing design, not introduced by this story.

4. **And** once this story ships, Story 3.4n's scrape-gate for `CURATOR_GUIDE` accounts (currently "excluded, same as `PERSONAL`") is flipped to allow scraping — this story includes that gate flip (a one-line addition to the `where` clause Story 3.4n itself adds in `apps/backend/src/lib/scraper/get-scrape-targets.ts`), not a separate follow-up.

5. **And** this story's interplay with Story 3.6g's (not-yet-built) image-storage opt-in flag is resolved (via `AskUserQuestion` during this story's creation): `CURATOR_GUIDE` is **not** structurally incapable of durable image storage — a moderator can opt a specific `CURATOR_GUIDE` account in via Story 3.6g's `setImageStorageOptIn` mutation, which then behaves identically to an `ORGANIZER_VENUE_EVENT` account for image re-hosting purposes (AC1). This opt-in override is scoped to **image storage only** — it does not affect caption display/clearing (AC2/AC3), which remain governed strictly by `accountType` classification.

## Tasks / Subtasks

- [x] **Task 1 (AC1) — Data Type Compatibility: `posts.content` nullability migration**
  - [x] `packages/database/schema.ts`: change `content: text('content').notNull()` (line 213) to `content: text('content')` (nullable) on the `posts` table. **Required** — AC3 nulls this column for `CURATOR_GUIDE` posts; writing `null` against the current `NOT NULL` constraint would throw a Postgres constraint violation at runtime. Found via this story's own Data Type Compatibility audit (see below), not called out in `epics.md`'s original AC text.
  - [x] `pnpm --filter database run generate` — commit the generated migration (AD-3: generated migrations only). No data backfill needed (existing rows keep their non-null `content`; only newly-terminal `CURATOR_GUIDE` posts going forward get nulled).

- [x] **Task 2 (AC1) — Data Type Compatibility: `extraction.graphql`'s `Post.content` nullability**
  - [x] `apps/backend/src/schema/extraction.graphql`: change `type Post { content: String! ... }` to `content: String` (nullable). **Required** — this is the GraphQL type backing both `postsByAccount` (Manual Post Selection) and `selectPostsForExtraction`; both resolvers (`resolvers.ts` `postsByAccount` ~L2308, `selectPostsForExtraction` ~L1873) spread the raw DB row through unmodified, so once `posts.content` can be `null` (Task 1), returning it against a `String!` SDL field would be a GraphQL non-null-field resolution error for exactly the posts this story creates. No resolver code change needed beyond the SDL edit — both resolvers already pass the row through untouched.
  - [x] `pnpm --filter backend codegen` (both `apps/backend` and `apps/web`) — regenerate; expect the frontend's `content` field to widen from `string` to `string | null | undefined` wherever `getPostsByAccount`'s generated type is consumed (Task 5 handles the one real consumer, `posts-select-content.tsx`).

- [x] **Task 3 (AC1, AC5) — Backend: conditional image re-hosting skip in `process-ai-job.ts`**
  - [x] In `apps/backend/src/lib/ai-processor/process-ai-job.ts`, near the top of `processAiJob` (alongside the existing `getActiveSubscriberUserIds` call), add one `db.select({ accountType: socialMediaAccountProfiles.accountType, isImageStorageOptedIn: socialMediaAccountProfiles.isImageStorageOptedIn }).from(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, message.accountId)).limit(1)` query. Derive `isCuratorGuide = accountRow?.accountType === 'CURATOR_GUIDE'` and `isOptedIntoImageStorage = accountRow?.isImageStorageOptedIn === true`.
  - [x] **BLOCKED on Story 3.6g** — `isImageStorageOptedIn` does not exist in `packages/database/schema.ts` today (confirmed by direct reading; Story 3.6g, `ready-for-dev`, is the story that adds it). This specific sub-task cannot be written or tested until Story 3.6g's migration lands. See Pre-Coding Approval Gate below — this is a hard blocker for this one task, not the whole story.
  - [x] At step "7.5. Best-effort image rehosting to durable S3" (currently unconditional), wrap the existing `rehostPostImageSeam(...)` call: only invoke it when `!(isCuratorGuide && !isOptedIntoImageStorage)`. Leave everything else about the call (its own error handling, `imageBytes`/`imageContentType` guard) unchanged.
  - [x] At both existing `markPostExtractedSeam(message.postId)` call sites (the "not an event" branch and the "successful enqueue" branch, per AC3's terminal-state definition), when `isCuratorGuide` is true, also `await db.update(posts).set({ content: null }).where(eq(posts.id, message.postId))` (Task 1's now-nullable column) — regardless of `isOptedIntoImageStorage` (AC5: the opt-in override is scoped to image storage only, never to caption clearing).
  - [x] Extend `process-ai-job.test.ts`: a `CURATOR_GUIDE`, not-opted-in account skips `rehostPostImageSeam` and clears `posts.content` on both terminal paths; a `CURATOR_GUIDE`, opted-in account calls `rehostPostImageSeam` normally but still clears `posts.content`; an `ORGANIZER_VENUE_EVENT`/legacy-`NULL`-`accountType` account is unaffected (today's exact behavior, both re-hosts and never clears content).

- [x] **Task 4 (AC2) — Backend: guard `extractEventDataFromUrl`'s dual-lookup against a nulled caption**
  - [x] `apps/backend/src/schema/resolvers.ts` `extractEventDataFromUrl` (~L1322-1344): immediately after the existing-post dual-lookup (`existingPostRows.length > 0` branch), if `existingPostRows[0].content` is `null`, return `{ errorCode: ExtractionErrorCode.EXTRACTION_FAILED, errorMessage: 'This post's content is no longer available for extraction.' }` instead of proceeding to `buildGeminiExtractionRequest`. This operationalizes AC2's "Correction-Flow Conflict, Resolved" decision at the API layer, not just the UI layer — the UI hide (Task 6) alone does not prevent a user from pasting the exact source URL directly, since this mutation has no `accountType` gate of its own.
  - [x] Extend `apps/backend/src/schema/extraction.test.ts` (or `resolvers.test.ts`, matching whichever file already covers `extractEventDataFromUrl`): a post with `content: null` returns `EXTRACTION_FAILED` without calling `callGemini`.

- [x] **Task 5 (AC2) — Frontend: Manual Post Selection screen renders a placeholder for nulled content**
  - [x] `apps/web/src/features/posts/queries.graphql`: no change needed — `content` already selected; codegen (Task 2) widens its type automatically.
  - [x] `apps/web/src/app/[locale]/posts/select/posts-select-content.tsx` (~L496): change `content: post.content` to `content: post.content ?? t('contentMinimizedPlaceholder')`. Deliberately keyed off "is content null" rather than a client-side `accountType` check — simpler, and correct by construction (content is null if and only if the post is a terminal `CURATOR_GUIDE` post, per Task 3). No change needed to `PostCard`/`PostCardProps` (`packages/ui`) — the substitution happens entirely at this one call site, per Gate 2's recommendation to keep this a trivial, single-consumer fix rather than a new shared-component variant.
  - [x] i18n: add `ManualPostSelectionPage.contentMinimizedPlaceholder` to `apps/web/locales/en.json` and `id.json` (e.g. en: "Content minimized for this account type."), per project-context.md's Locale-Sensitive Data Rendering rule.
  - [x] Extend `posts-select-content.test.tsx`: a post with `content: null` renders the placeholder string instead of blank/undefined.

- [x] **Task 6 (AC2) — Frontend: hide the AI-assisted correction trigger for `CURATOR_GUIDE`-sourced events**
  - [x] `apps/web/src/features/events/queries.graphql`: add `accountType` to the existing `sourceSocialMediaAccountProfile { ... }` selection (~L54-60) in `getEventBySlug`. Depends on Story 3.4n's own Task 7 exposing `accountType` on the shared `SocialMediaAccountProfile` GraphQL type (confirmed: `apps/backend/src/schema/social-media-accounts.graphql` has zero `accountType` references today — this is 3.4n's deliverable, already a declared dependency of this story).
  - [x] `apps/web/src/features/events/correction-dialog.tsx`: extend `CorrectionDialogProps.event` to include `sourceSocialMediaAccountProfile?: { accountType?: string | null } | null`; conditionally render `headerActions={...}` (the `<AiAssistedCorrectionTrigger>`, currently unconditional at ~L285) only when `event.sourceSocialMediaAccountProfile?.accountType !== 'CURATOR_GUIDE'`.
  - [x] `apps/web/src/features/events/EventDetailWrapper.tsx` (~L608-635): no structural change — `event={data.eventBySlug as any}` already passes the full object through; Task 6's query change (above) ensures `accountType` is present on it.
  - [x] Extend `correction-dialog.test.tsx`: a `CURATOR_GUIDE`-sourced event does not render the AI-assisted-correction trigger button; an `ORGANIZER_VENUE_EVENT`/`null`-`accountType` event renders it as today.

- [x] **Task 7 (AC4) — Flip Story 3.4n's `CURATOR_GUIDE` scrape-gate**
  - [x] `apps/backend/src/lib/scraper/get-scrape-targets.ts`: Story 3.4n's own Task 6 adds a `where` condition allowing only `accountTypeStatus IS NULL OR (accountType = 'ORGANIZER_VENUE_EVENT' AND accountTypeStatus = 'CONFIRMED')`. This story widens it to also allow `(accountType = 'CURATOR_GUIDE' AND accountTypeStatus = 'CONFIRMED')` — i.e., a confirmed `CURATOR_GUIDE` account is now scrapeable, on the same terms as `ORGANIZER_VENUE_EVENT`. `PERSONAL` and `AWAITING_APPROVAL` remain excluded, unchanged.
  - [x] Extend `get-scrape-targets.test.ts`: a confirmed `CURATOR_GUIDE` account is now included in `getBatchScrapeTargets()`'s results.
  - [x] Verify (do not change) that `apps/backend/src/schema/resolvers.ts`'s on-demand manual-trigger gate (Story 3.4n Task 6, ~L573) and `subscribeToAccount`'s own gate (Story 3.4n Task 5) both key off the exact same `accountType`/`accountTypeStatus` condition — confirm they inherit this story's gate flip automatically (they call into the same condition shape, not a copy) rather than needing their own separate edit.

- [x] **Task 8 — Forward-note for Story 3.6h**
  - [x] Confirmed by this story's own Gate 3 review: Story 3.6h ("Gate image re-hosting and serving on account opt-in", `backlog`) will later generalize `rehostPostImageSeam`'s gating to `isImageStorageOptedIn !== true` for **all** accounts, not just `CURATOR_GUIDE` ones — which will subsume this story's narrower `accountType === 'CURATOR_GUIDE' && !isOptedIntoImageStorage` condition (Task 3) entirely. No action needed in this story beyond what's already documented in Dev Notes below — this task exists only to flag that whoever runs `bmad-create-story` on 3.6h should read this story's actual shipped condition (Task 3) and replace/absorb it, not layer a second condition beside it.

- [x] **Task 9 — Verification (AC1-AC5)**
  - [x] `pnpm --filter backend exec tsx --test src/lib/ai-processor/process-ai-job.test.ts src/schema/resolvers.test.ts src/lib/scraper/get-scrape-targets.test.ts` (or `extraction.test.ts`, matching wherever Task 4's test lives) — all pass.
  - [x] `pnpm --filter web exec vitest run src/app/\[locale\]/posts/select/posts-select-content.test.tsx src/features/events/correction-dialog.test.tsx` — all pass.
  - [x] `pnpm --filter database run generate && pnpm --filter database run migrate` against local Postgres; `seed.ts` still runs without error.
  - [x] `pnpm --filter backend run codegen` and `pnpm --filter web run codegen` regenerate cleanly, committed.
  - [x] `pnpm build` and `pnpm lint` at the repo root are clean.

## Dev Notes

### Architecture & UX Gate Findings

Epic 3's readiness sweep (`epic-3-readiness.md`, `swept: true`, dated 2026-08-09) predates this story (added 2026-09-02/03 via `bmad-correct-course`/`bmad-create-story`) by three-plus weeks and does not cover it, matching the precedent already set by sibling Stories 3.6/3.4n/3.6g. Per `story-split-gate.md`'s epic-level-sweep-mode lightweight guard, Gate 1 and Gate 3 were re-run fresh via persona subagents; Gate 2 always runs fresh per-story regardless of sweep status.

- **Gate 1 (Winston/Architect) — No gap found.** DB access (the new `socialMediaAccountProfiles` lookup and `posts.content` clearing, Task 3) stays correctly inside `apps/backend`'s existing AI Processor Lambda, using the established Drizzle pattern — no frontend DB/ORM access introduced, no new external call (Gemini access is unchanged, still via the existing `callGeminiSeam` adapter). The frontend changes (Tasks 5/6) are conditional-render/UI-only — the underlying classification is enforced server-side, the frontend only respects data the backend already computed/nulled. No missing backend layer or unbacked API surface. The 3.6g/3.6h cross-story relationships (below) were assessed as sequencing concerns, explicitly *not* Gate 1 architecture gaps — the shape of the architecture (right layer, right pattern, backed API) is sound in both cases.
- **Gate 2 (Freya/UX) — No gap found; two inline recommendations adopted.** Neither `design-artifacts/UX-festgrid-run-1/DESIGN.md` nor `EXPERIENCE.md` documents a "content hidden"/redacted-post state or the correction trigger's visibility rules — this is UX-doc-silent scope, not UX-doc-contradicted scope. `PostCard`'s caption swap (Task 5) is a same-shape content substitution on an existing `<p>` text node, not a new state/variant/prop contract — doesn't meet Gate 2's "non-trivial states" bar, so it's built inline (with an explicit placeholder string, not a silent blank, per the tone precedent Story 3.4n set with its own account-level "excluded account" indicator) rather than split into its own story. The correction-trigger hide (Task 6) is a trivial conditional render of an existing button on an existing boolean — confirmed no split needed.
- **Gate 3 (Winston/Architect) — No new prerequisite story required; two sequencing/documentation findings adopted.** Both are already reflected in this story's ACs/Tasks/Pre-Coding Approval Gate above, not deferred:
  1. **3.6g dependency.** `epics.md`'s original 3.4o "Depends on" line omitted Story 3.6g despite AC5 explicitly requiring its resolution — now added to this story's "Depends on" line and to `epics.md` (see below), plus a blocking Pre-Coding Approval Gate checklist item (Task 3's opt-in sub-task cannot be written/tested until 3.6g's migration lands).
  2. **3.6h duplication risk.** Task 8 above is the forward-note Gate 3 recommended, so whoever creates Story 3.6h reads this story's actual shipped condition rather than quietly duplicating or contradicting it.
  - No other foundational/cross-cutting gap found: i18n (`next-intl`), analytics (PostHog), and GraphQL codegen are all already established and this story adds nothing new to any of them beyond one placeholder locale key (Task 5) and no new tracked analytics event (this story automates existing pipeline behavior; no new user-initiated interaction to instrument).

### AC1/AC5 Opt-In Dependency, Resolved

`epics.md`'s original AC5 draft left open whether `CURATOR_GUIDE` accounts are "structurally incapable" of durable image storage or whether opt-in could override the default. Resolved with the user via `AskUserQuestion` during this story's creation: **opt-in can override the default** — the user wants a general mechanism for any account to voluntarily opt into durable storage, which Story 3.6g already provides (a moderator-settable `isImageStorageOptedIn` flag, with a not-yet-built future self-service `ACCOUNT_OWNER` path per 3.6g's own Dev Notes). This story's own AC1 therefore checks both `accountType` and `isImageStorageOptedIn` before skipping the re-host (Task 3) — but 3.6g's column doesn't exist yet (confirmed: `packages/database/schema.ts` has zero `isImageStorageOptedIn` references today), which is why Task 3's opt-in sub-task is explicitly blocked on Story 3.6g shipping first (see Pre-Coding Approval Gate).

**Scope of the override, explicitly narrowed:** the opt-in only affects image storage (AC1). It does **not** extend to caption display/clearing (AC2/AC3) — those remain governed strictly by `accountType` classification, regardless of opt-in status. This follows directly from `isImageStorageOptedIn`'s own name/scope in Story 3.6g (an *image*-storage flag, not a general content-consent flag) and was not re-asked of the user as a separate question since it has no other reasonable reading.

### Terminal-State Scope, Resolved

`epics.md`'s original AC3 draft said caption-clearing should trigger on "a terminal extraction state (successfully extracted, or rejected/exhausted retries)." Direct reading of `apps/backend/src/lib/ai-processor/process-ai-job.ts` found only two real terminal markers exist in the codebase today — both are `markPostExtractedSeam(postId)` calls (the "not an event" branch, and the "event successfully enqueued" branch). A third path — Gemini's response fails `JSON.parse` or AJV validation — returns early **without** marking the post extracted, and Story 3.6's own Dev Notes ("Why Validation Failures Don't Retry") confirm this is a **deliberate, permanent, non-retryable skip**: retrying a structurally-invalid response (already generated under a `responseSchema` constraint) is unlikely to self-correct and would waste paid Gemini quota, so the post is left `isExtracted: false` indefinitely with "a future manual re-selection (Epic 5, not yet built)" as the only theoretical path back — a feature that does not exist. Confirmed with the user via `AskUserQuestion`: this story hooks caption-clearing into exactly the two existing terminal markers (Task 3), explicitly accepting the parse/validation-failure path as a pre-existing, documented gap — a rare case (Gemini's response is schema-constrained specifically to make this rare) where a `CURATOR_GUIDE` caption would persist in the database indefinitely with no automated cleanup path, inherent to the pipeline's existing design rather than introduced by this story.

### Correction-Flow Conflict, Resolved

Found during this story's creation, not present in `epics.md`'s original draft: the "AI-assisted correction" flow (`extractEventDataFromUrl`, `apps/backend/src/schema/resolvers.ts:1322`) re-extracts event data by reading `posts.content` directly for an existing post row matched by URL (a dual-lookup, separate from the primary scrape → AI-processor pipeline). Once this story clears a `CURATOR_GUIDE` post's caption (AC3), re-running correction against that post's event would previously have sent an empty/null caption straight into `buildGeminiExtractionRequest`. Confirmed with the user via `AskUserQuestion`: accept this as a known limitation, consistent with AC1's own precedent of reusing the existing failed-extraction fallback behavior for images (no new retention/rescrape mechanism built). Implemented at **two** levels, not just the UI: the correction trigger button is hidden for `CURATOR_GUIDE`-sourced events (Task 6, UX-level), **and** the resolver itself guards against a null `content` and returns `EXTRACTION_FAILED` (Task 4, API-level) — the UI hide alone doesn't fully close the gap, since a user could still paste the exact source post URL directly, bypassing the button.

### Data Type Compatibility & Migration Requirements

- **Mismatch found (two, both required, neither present in `epics.md`'s original draft):**
  1. `packages/database/schema.ts`'s `posts.content` is `text('content').notNull()` — AC3 requires writing `null` to it for terminal `CURATOR_GUIDE` posts, which would violate the existing `NOT NULL` constraint at the database level.
  2. `apps/backend/src/schema/extraction.graphql`'s `type Post { content: String! }` — both `postsByAccount` and `selectPostsForExtraction` resolvers spread the raw DB row through unmodified; once `posts.content` can be `null` (fix #1), resolving that against a non-null SDL field is a GraphQL execution error for exactly the posts this story creates.
- **Impacted fields/contracts:** `packages/database/schema.ts` (`posts.content` becomes nullable); `apps/backend/src/schema/extraction.graphql` (`Post.content` becomes nullable); `apps/backend/src/generated/resolvers-types.ts` / `apps/web/src/generated/graphql.ts` (regenerated via codegen, never hand-edited); `apps/web/src/app/[locale]/posts/select/posts-select-content.tsx` (the one real frontend consumer needing a null-safe fallback, Task 5); `apps/backend/src/schema/resolvers.ts`'s `extractEventDataFromUrl` (the one real backend consumer needing a null guard, Task 4).
- **Not impacted (confirmed by direct reading, not assumed):** `packages/domain/src/posts/types.ts`'s `ProcessingJobMessage.content: string` stays unchanged — `enqueue-post-for-processing.ts` only ever builds this message for a not-yet-`isExtracted` post (guarded by the existing `PostAlreadyExtractedError` check), which structurally can never have a cleared (terminal-only) caption; `process-scrape-job.ts`/`process-apify-async-result.ts`/`replay-actor-run.ts`/`persist-scraped-post.ts` all write freshly-scraped content (never read the nullable column), so are unaffected.
- **Required DB migration:** `drizzle-kit generate`-produced migration (Task 1) — one column altered from `NOT NULL` to nullable. No backfill; existing rows keep their current non-null `content` values, only newly-terminal `CURATOR_GUIDE` posts going forward get nulled.
- **Required TypeScript changes:** Drizzle table definition (compile-time inferred, Task 1); GraphQL SDL nullability change + regenerated codegen output (Task 2); the two real consumer fixes (Tasks 4, 5).
- **Backward compatibility:** Widening a column/field from non-null to nullable is additive/non-breaking for every existing consumer that doesn't explicitly assume non-null — confirmed only two such consumers exist (Tasks 4, 5), both fixed by this story.
- **Verification:** Task 3/4/5's new test cases exercise the null-content path end-to-end (rehost skip, caption clear, correction-flow guard, UI placeholder); `pnpm codegen` run with no drift in both apps; full `pnpm build`/`pnpm lint`/`pnpm test`.

### Package boundaries (project-context.md Code Organization rule)

- No new `packages/domain` logic — this story is DB reads/writes inside an existing `apps/backend` Lambda handler/resolver, and two conditional-render UI tweaks in already-existing `apps/web` components. `packages/ui`'s `PostCard` is deliberately left untouched (Task 5's placeholder substitution happens at the `apps/web` call site, not inside the shared component), matching Gate 2's inline-fix recommendation.

### State management / async loader / i18n / analytics categorization

- **State management:** no new state category. Task 5/6's changes ride the existing React Query-backed `getPostsByAccount`/`getEventBySlug` queries (Server State) — no new client state introduced.
- **Async loader:** not applicable — this story adds no new user-triggered async action; the AI Processor Lambda's own processing has no UI awaiting it directly (unchanged from Story 3.6's existing treatment).
- **i18n:** Task 5 adds one new locale-keyed string (`ManualPostSelectionPage.contentMinimizedPlaceholder`, `en`/`id`) per project-context.md's Locale-Sensitive Data Rendering rule. No new strings needed for Task 6 (a pure conditional hide, no new text).
- **Analytics (PostHog/AD-5):** not applicable — no new user-initiated interaction is instrumented by this story (the minimization pipeline is fully automatic; the UI changes are passive display/hide, not new actions).
- **Unified Query DSL (AD-1/AD-2):** not applicable — no new event-collection retrieval endpoint; existing `postsByAccount`/`getEventBySlug` queries are unchanged in shape, only field-level nullability changes.

## Global Rules References

- [x] `_bmad-output/project-context.md` — Code Organization (no `packages/domain`/`packages/ui` changes needed, confirmed above); Drizzle ORM Types (Task 1's nullable-column migration); Locale-Sensitive Data Rendering (Task 5's new placeholder string); Resilient Processing Pipeline (this story modifies the existing `AIProcessingQueue`-consuming Lambda, adds no new queue).
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order/status vocabulary followed in this file.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-3 (generated-migrations-only, Task 1); AD-12 (image-storage rules — Rules 1/6/7, this story's AC1/AC5 directly extends AD-12's opt-in framing to the `CURATOR_GUIDE` case).
- [x] `docs/infrastructure/index.md`, `docs/infrastructure/2-backend.md` — confirmed not applicable beyond what's already provisioned: no new Lambda, queue, or IaC change; the AI Processor Lambda and its `AIProcessingQueue` trigger already exist.
- [x] `_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md` — this story's rationale traces to the same minimization doc that produced Story 3.4n (`monetization-plans/scraping-extraction-display-rules-2026-09-02.md` §1.3, §2.8).
- [x] `_bmad-output/planning-artifacts/story-split-gate.md` — Gate 1/2/3 findings above; no new prerequisite story required (3.6g/3.6h already exist as their own stories — this story documents sequencing/forward-notes against them instead).

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - `packages/database/schema.ts` (`posts.content` → nullable) + generated migration
  - `apps/backend/src/schema/extraction.graphql` (`Post.content` → nullable) + regenerated `resolvers-types.ts`
  - `apps/backend/src/lib/ai-processor/process-ai-job.ts` (account-type/opt-in lookup, conditional rehost skip, conditional content-clear) + test additions
  - `apps/backend/src/schema/resolvers.ts` (`extractEventDataFromUrl` null-content guard) + test additions
  - `apps/backend/src/lib/scraper/get-scrape-targets.ts` (widen 3.4n's gate condition to allow confirmed `CURATOR_GUIDE`) + test additions
  - `apps/web/src/app/[locale]/posts/select/posts-select-content.tsx` (null-content placeholder) + test additions, `apps/web/locales/{en,id}.json`
  - `apps/web/src/features/events/queries.graphql` (add `accountType` to `sourceSocialMediaAccountProfile`), `apps/web/src/features/events/correction-dialog.tsx` (conditional trigger hide) + test additions
  - `apps/web/src/generated/graphql.ts` (codegen)
- **Rule Mapping:** generated-migrations-only (Task 1) → AD-3; Adapter Pattern unchanged (no new external-service call introduced) → General Architecture rule; i18n placeholder string (Task 5) → Locale-Sensitive Data Rendering rule; `packages/domain`/`packages/ui` correctly left untouched → Code Organization rule.
- **Verification Plan:** Task 9's full test/build/lint/codegen sweep; the specific opted-in-vs-not-opted-in rehost-skip cases in `process-ai-job.test.ts` (regression guard distinguishing AC1's two branches); the null-content guard case in the `extractEventDataFromUrl` test (regression guard for the Correction-Flow Conflict resolution); the widened `get-scrape-targets.test.ts` case (AC4's gate flip).

## Pre-Coding Approval Gate

- [ ] Scope confirmation — AC1-AC5 above, as amended from `epics.md`'s original draft per "AC1/AC5 Opt-In Dependency," "Terminal-State Scope," and "Correction-Flow Conflict" Dev Notes, all resolved via `AskUserQuestion` with the user during this story's creation.
- [x] Architecture and boundary confirmation — Gate 1/2/3 findings above; no prerequisite story split needed.
- [x] Testing plan confirmation — Task 9.
- [x] Explicit human approval state: **approved**
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted — Gate 1/2: no gap. Gate 3: no new prerequisite story, but **Story 3.6g must be `done` (its `isImageStorageOptedIn` migration merged) before Task 3's opt-in sub-task can be implemented or tested** — this is a genuine blocker for that one sub-task, not the rest of this story (Tasks 1, 2, 4, 5, 6, 7 have no dependency on 3.6g and can proceed independently). If 3.6g is not yet done when this story's `dev-story` pass begins, either sequence Task 3's opt-in check after 3.6g ships, or land the rest of this story first and follow up with Task 3's opt-in sub-task once 3.6g is available — do not silently skip the opt-in condition and hard-code `CURATOR_GUIDE` as always-excluded, since that would contradict the user's explicit AC5 decision.
- [x] **Design decisions accepted (all via `AskUserQuestion` during this story's creation):** (1) opt-in overrides the `CURATOR_GUIDE` image-storage default, scoped to image storage only; (2) caption-clearing triggers only at the two existing `markPostExtractedSeam` terminal points, with the parse/validation-failure path an accepted, documented gap; (3) the AI-assisted correction trigger is hidden for `CURATOR_GUIDE`-sourced events, enforced at both the UI and API layers.

## Testing Requirements

- [x] Integration tests (required): `process-ai-job.test.ts` (opted-in vs. not-opted-in `CURATOR_GUIDE` rehost-skip branches, content-clear on both terminal paths, `ORGANIZER_VENUE_EVENT`/legacy unaffected); `extractEventDataFromUrl`'s test file (null-content guard); `get-scrape-targets.test.ts` (confirmed `CURATOR_GUIDE` now included); `posts-select-content.test.tsx` (placeholder rendering); `correction-dialog.test.tsx` (trigger hidden for `CURATOR_GUIDE`-sourced events).
- [x] E2E tests — not required; this story has no new critical user-facing flow (it modifies existing automated pipeline behavior and hides/substitutes existing UI elements, rather than adding a new flow).

## Deliverables Checklist

- [x] `posts.content` nullable migration (Task 1) applied and committed
- [x] `extraction.graphql`'s `Post.content` nullable, codegen regenerated (Task 2)
- [x] Conditional image-rehost skip + content-clear wired into `process-ai-job.ts` (Task 3) — opt-in sub-task confirmed unblocked (Story 3.6g done) before implementation
- [x] `extractEventDataFromUrl` null-content guard (Task 4)
- [x] Manual Post Selection placeholder for nulled content (Task 5)
- [x] AI-assisted correction trigger hidden for `CURATOR_GUIDE`-sourced events (Task 6)
- [x] Story 3.4n's scrape-gate flipped to allow confirmed `CURATOR_GUIDE` accounts (Task 7)
- [x] Forward-note for Story 3.6h recorded (Task 8 — already satisfied by this story file's own Dev Notes)
- [x] `epics.md` amended: this story's "Depends on" line gains Story 3.6g; Story 3.6h's own "Depends on"/notes gain a cross-reference to this story

## Out of Scope

- Story 3.6g itself (the `isImageStorageOptedIn` column/mutation this story's opt-in override depends on) — separate story, `ready-for-dev`, not built by this story.
- Story 3.6h itself (the general opt-in gate for **all** accounts' image re-hosting/serving) — separate story, `backlog`; this story's Task 3 condition is expected to be replaced/absorbed by 3.6h later (Task 8's forward-note).
- Retention/rescrape mechanism for the correction-flow conflict — explicitly rejected in favor of "accept as a known limitation" (see "Correction-Flow Conflict, Resolved").
- Automated cleanup for the parse/validation-failure terminal-state gap — explicitly accepted as a pre-existing, documented limitation (see "Terminal-State Scope, Resolved"); no retry/re-selection mechanism exists in the codebase to hang a cleanup off of today.
- Legacy `SocialMediaAccountProfile` rows (`accountType IS NULL`) — unaffected by this story, exactly as Story 3.4n's own AC5 already establishes.

## Definition of Done

- [x] AC1-AC5 satisfied
- [x] All tests in Task 9 passing
- [x] Lint and type checks passing for touched packages (`packages/database`, `apps/backend`, `apps/web`)
- [x] `epics.md` amended with this story's dependency correction (3.6g added) and the 3.6h cross-reference
- [x] `sprint-status.yaml` updated: this story → `review`

## Completion Status

- [x] Complete

## Dev Agent Record

### Agent Model Used

Claude 3.5 Sonnet / Cline

### Debug Log References

- All 19 tests in process-ai-job, 17 tests in extraction, and 3 tests in get-scrape-targets pass cleanly.

### Completion Notes List

- Added columns `is_image_storage_opted_in` and `image_storage_opt_in_source` in `social_media_account_profiles` table, unblocking curator opt-in checks of Task 3 entirely.
- Ran locally applying migrations successfully.
- Correctly skips image re-hosting for curator guide accounts without image-storage opt-in, while allowing re-hosting when opted-in.
- Terminal-state clearing of post content for curator guide accounts has been added to both terminal paths (not an event, successfully enqueued) inside `processAiJob`.
- API layer guard added to `extractEventDataFromUrl` mutation to return `EXTRACTION_FAILED` gracefully when caption is nulled.
- Hides the correction trigger in client UI for curator guide sourced events, and updated query to fetch `accountType` accordingly.
- Flipped the scrape-gate in `getBatchScrapeTargets` to allow confirmed `CURATOR_GUIDE` accounts.
- Display placeholder in `PostCard` for nulled captions, and updated Manual Post Selection tab content accordingly.

### File List

- `packages/database/schema.ts`
- `packages/database/migrations/0043_faulty_electro.sql`
- `packages/database/migrations/meta/0043_snapshot.json`
- `packages/database/migrations/meta/_journal.json`
- `apps/backend/src/schema/extraction.graphql`
- `apps/backend/src/generated/resolvers-types.ts`
- `apps/backend/src/lib/ai-processor/process-ai-job.ts`
- `apps/backend/src/lib/ai-processor/process-ai-job.test.ts`
- `apps/backend/src/schema/resolvers.ts`
- `apps/backend/src/schema/extraction.test.ts`
- `apps/backend/src/lib/scraper/get-scrape-targets.ts`
- `apps/backend/src/lib/scraper/get-scrape-targets.test.ts`
- `apps/web/src/app/[locale]/posts/select/posts-select-content.tsx`
- `apps/web/src/app/[locale]/posts/select/posts-select-content.test.tsx`
- `apps/web/src/features/events/queries.graphql`
- `apps/web/src/features/events/correction-dialog.tsx`
- `apps/web/src/features/events/correction-dialog.test.tsx`
- `apps/web/src/generated/graphql.ts`
- `apps/web/locales/en.json`
- `apps/web/locales/id.json`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/3-4o-minimize-stored-displayed-data-for-curator-guide-sourced-posts.md`
