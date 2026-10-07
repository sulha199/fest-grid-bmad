---
baseline_commit: a9b7c904bab4e74ef85590313789f950f2600ec9
---

# Story 3.17: Demand-gated discovery for scrape-discovered profiles

## Story Details

- Epic: 3
- Story ID: 3.17
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want broad account autocomplete/ranked-discovery surfaces to exclude a verified scrape-discovered profile until a subscribe or vote signals real demand for it,
so that discovery surfaces aren't polluted by every coauthor incidentally surfaced by scraping, while that profile stays immediately subscribable in its originating context (FIND-022, CAP-5).

## Acceptance Criteria

1. **Given** a freshly created coauthor profile (`isVerifiedForDiscovery: false`, Story 3.14), **when** any broad account autocomplete/ranked-discovery surface queries candidate accounts, **then** the profile is excluded until at least one subscribe (Story 3.16, already shipped) or vote event exists for it, at which point `isVerifiedForDiscovery` flips to `true` and it becomes eligible. Concretely: the two existing GraphQL query resolvers confirmed (by fresh, full-codebase search) to be the only broad "browse many accounts" surfaces in this system — `rankedVoteAccounts` and `votedAccountSuggestions` (`apps/backend/src/schema/resolvers.ts`) — exclude any account whose `social_media_account_profiles.isVerifiedForDiscovery` is `false`; and the `castVote` mutation (same file) flips `isVerifiedForDiscovery` `false → true` the same way `subscribeToAccount` (Story 3.16) already does, via a new shared helper both call.
2. **And** this exclusion never blocks contextual subscription from the originating event/post detail surface (Story 3.16, Story 0.i6g) — the gate applies only to broad discovery, not direct/contextual access. Confirmed by inspection: neither Story 3.16's `subscribeToAccount` nor Story 0.i6g's UI calls `rankedVoteAccounts`/`votedAccountSuggestions`; this story adds no gate anywhere on that path.
3. **And** a profile a user subscribed to directly (the pre-existing, non-discovery-sourced path) defaults `isVerifiedForDiscovery: true` and is unaffected by this gate. Confirmed already true today via the column's own DB-level default (`true`, migration `0063_curvy_captain_cross.sql`) — only `getOrCreateDiscoveredAccountProfile` (Story 3.14's scrape-discovery insert path) explicitly overrides it to `false`. No code change needed for this AC; it is a read-only confirmation.

## Tasks / Subtasks

- [ ] **Task 1 — Extract a shared `verifyAccountProfileForDiscovery` helper (AC: 1)**
  - [ ] 1.1 Create `apps/backend/src/lib/accounts/verify-account-profile-for-discovery.ts`, exporting `verifyAccountProfileForDiscovery(profileId: string)`. Body is the exact `db.update(socialMediaAccountProfiles).set({ isVerifiedForDiscovery: true }).where(and(eq(socialMediaAccountProfiles.id, profileId), eq(socialMediaAccountProfiles.isVerifiedForDiscovery, false))).returning()` idiom already shipped inline in `subscribe-to-account.ts:164-178` — relocated, not reimplemented. Returns the updated row, or `undefined` if the profile was already `true` (idempotent no-op; the `WHERE ... = false` clause matches zero rows). Doc comment states: shared by `subscribeToAccount` (Story 3.16, AC4) and `castVote` (this story); the flip is one-way — nothing in this codebase ever sets `isVerifiedForDiscovery` back to `false`.
  - [ ] 1.2 Add `apps/backend/src/lib/accounts/verify-account-profile-for-discovery.test.ts` (plain `node:test` against the real local dev DB, matching this directory's existing convention — e.g. `classify-account-type.test.ts`): (a) a `false` profile flips to `true` and the update is returned; (b) an already-`true` profile is untouched and the function returns `undefined`; (c) a non-existent id returns `undefined` without throwing.
  - [ ] 1.3 Refactor `apps/backend/src/lib/subscriptions/subscribe-to-account.ts`: replace the inline block at lines 164-178 (step "1c") with `const verified = await verifyAccountProfileForDiscovery(accountProfile.id); if (verified) { accountProfile = verified; }`, importing the new helper (`import { verifyAccountProfileForDiscovery } from '../accounts/verify-account-profile-for-discovery.js';`). This is a pure relocation — no behavior change. Confirm `subscribe-to-account.test.ts`'s existing cases (i) ("`isVerifiedForDiscovery` flips from `false` to `true` on first subscribe") and (j) ("already-verified... no-op") still pass unmodified.

- [ ] **Task 2 — Wire the vote-event flip into `castVote` (AC: 1)**
  - [ ] 2.1 In `apps/backend/src/schema/resolvers.ts`'s `castVote` resolver, import `verifyAccountProfileForDiscovery` from `../lib/accounts/verify-account-profile-for-discovery.js` and call `await verifyAccountProfileForDiscovery(accountId);` immediately after `accountId` is resolved to a definite profile id (i.e. right after the `if (!accountId) { ... } else { ... }` block closes, around line 2191 — before the existing-vote lookup). Calling it unconditionally at this single point, before branching on new-vote/reactivate-withdrawn-vote/idempotent-no-op, correctly covers all three `castVote` outcomes with one call, exactly mirroring how `subscribeToAccount` places its flip independent of its own branches. The return value is not needed here (`castVote` returns the vote row, not the profile), so the call is fire-and-forget (`await` only, no reassignment).
  - [ ] 2.2 Extend `apps/backend/src/schema/account-votes.test.ts` with new cases: (a) casting a first-ever vote for a profile seeded with `isVerifiedForDiscovery: false` flips it to `true` (assert via a follow-up `db.select()` on `socialMediaAccountProfiles`); (b) casting a vote for an already-`isVerifiedForDiscovery: true` profile is a no-op on that column (regression guard); (c) withdrawing a vote (`withdrawVote`) and re-casting it re-confirms `true` (idempotent — exercises the "reactivate a soft-deleted vote" branch of `castVote`, lines ~2198-2206).

- [ ] **Task 3 — Gate `rankedVoteAccounts` and `votedAccountSuggestions` on `isVerifiedForDiscovery` (AC: 1)**
  - [ ] 3.1 `votedAccountSuggestions` (`resolvers.ts:2927-2981`): this resolver already `.innerJoin(socialMediaAccountProfiles, eq(accountVotes.accountId, socialMediaAccountProfiles.id))` inside its aggregate query. Push `eq(socialMediaAccountProfiles.isVerifiedForDiscovery, true)` into the existing `conditions` array (alongside `isNull(accountVotes.deletedAt)`) so it participates in the same `and(...conditions, ...profileConditions)` call — a one-line, already-joined addition.
  - [ ] 3.2 `rankedVoteAccounts` (`resolvers.ts:2790-2877`): this resolver does NOT join `socialMediaAccountProfiles` in its aggregate query (`accountVotes`-only, both the `nearMe` and non-`nearMe` branches) — it fetches each ranked account's profile afterward, one row at a time, in the existing `for (const row of rows) { const [profile] = await db.select()...; if (profile) { ...push... } }` loop (lines 2862-2875). Change the loop's existing `if (profile) {` guard to `if (profile && profile.isVerifiedForDiscovery) {` — deliberately NOT restructuring this resolver to join profiles into the SQL aggregate (Gate 1 confirmed: this resolver is outside AD-17's scope, operates at trivial scale today, and already has this same per-row-refetch shape independent of this story — matching its existing style is lower-risk than a structural rework this story doesn't need).
  - [ ] 3.3 Add a short code comment at `queryModeratorAccountProfiles` (`resolvers.ts`, moderator-only browse resolver) noting it is deliberately NOT gated on `isVerifiedForDiscovery` — moderators need full visibility into unverified rows, confirmed by Gate 1 — so a future reader doesn't "fix" this as an oversight.
  - [ ] 3.4 Extend `account-votes.test.ts`: (a) a profile with `isVerifiedForDiscovery: false` that has an active vote is excluded from both `rankedVoteAccounts` and `votedAccountSuggestions` results (covers the known transitional gap — see Dev Notes — and any future edge case); (b) a profile with `isVerifiedForDiscovery: true` and an active vote appears normally in both (regression guard against the new filter over-excluding); (c) confirm `queryModeratorAccountProfiles` is unaffected (still returns a seeded `isVerifiedForDiscovery: false` profile) — one assertion, not a new test file.

- [ ] **Task 4 — Confirm AC2/AC3 need no code change, by inspection (AC: 2, 3)**
  - [ ] 4.1 Confirm (already done during story creation, re-confirm during dev) that Story 3.16's `subscribeToAccount` and Story 0.i6g's event/post-detail subscribe-toggle UI never call `rankedVoteAccounts`/`votedAccountSuggestions` — contextual/direct subscription is entirely unaffected by Task 3's read-side filters (AC2).
  - [ ] 4.2 Confirm the `social_media_account_profiles.isVerifiedForDiscovery` column's DB-level default (`true`) is unchanged and no insert path besides `getOrCreateDiscoveredAccountProfile` (Story 3.14, untouched by this story) explicitly sets it `false` (AC3). No code change; record the confirmation in Dev Agent Record.

- [ ] **Task 5 — Run targeted, package-scoped tests and lint (AC: 1, 2, 3)**
  - [ ] 5.1 From `apps/backend`: `TZ=UTC NODE_ENV=test npx tsx --test --test-concurrency=1 "src/lib/accounts/verify-account-profile-for-discovery.test.ts" "src/lib/subscriptions/subscribe-to-account.test.ts" "src/schema/account-votes.test.ts"`.
  - [ ] 5.2 `pnpm --filter backend build` (tsc) and `eslint` on every touched/new file only. Full `apps/backend` suite and repo-wide `pnpm test`/`pnpm lint` are deliberately out of scope for this targeted pass (per this session's explicit instruction) — leave for `bmad-dev-story`'s own Definition-of-Done gate.

## Dev Notes

- **The actual gap this story closes.** `castVote` (`resolvers.ts:2138-2216`) never touches `isVerifiedForDiscovery` today — confirmed by a zero-hit grep across the whole file before this story was written. Story 3.16 already wrote the subscribe-side flip (its own AC4); its own "Out of Scope" section explicitly named this gap: *"Story 3.17's actual demand-gated discovery read-path... and its vote-event trigger... this story only writes the `isVerifiedForDiscovery` flip on the subscribe path (AC4); 3.17 reads/enforces it and adds the vote-event half."* This story is exactly that: the vote-event half of the flip, plus the read-side gate on the two broad-discovery resolvers.
- **The "vote" in this story's AC is not a new concept — it's the existing, fully-shipped `AccountVote`/`castVote` feature (Epic 6, status `review`).** PRD §3.13 "Vote for Social Media Accounts" and §4.15 `AccountVote` fully specify it; `account_votes` table, `castVote`/`withdrawVote` mutations, `rankedVoteAccounts`/`voteRegionBreakdown`/`votedAccountSuggestions` queries, and frontend (`apps/web/src/components/votes/`, `subscribe-account-dialog.tsx` via Story 6.4) all already exist. There is no second, competing "vote" concept anywhere in this codebase (confirmed by a full-repo grep) — favoriting an *event* (the `favorites` table) is an unrelated domain and was confirmed to have no hint of double-duty as account-demand signaling. This story adds no new entity.
- **The two gated resolvers are the complete inventory of "broad account autocomplete/ranked-discovery surfaces."** Confirmed by full-codebase search (no `accountSearch`/`discoverAccounts`/`rankedDiscovery`-named resolver exists anywhere): `rankedVoteAccounts` and `votedAccountSuggestions`. A third resolver, `queryModeratorAccountProfiles`, browses all profiles but is `requireModerator`-gated and deliberately excluded (moderators need full visibility into unverified rows — this is a visibility gate for end users, "explicitly not a new moderation system," per the epics.md Note on this story). `socialMediaAccountProfileByAccountId` and `castVote`'s own `lookupAccountProfile` are single-account lookups, not browse/discovery surfaces, and are out of scope.
- **A real wrinkle, worth naming explicitly: because both gated resolvers are built `FROM accountVotes` (requiring ≥1 active vote to appear at all), and because every *new* vote now flips `isVerifiedForDiscovery` via Task 2, the read-side filter in Task 3 is close to a no-op for all future votes.** Its actual value is (a) literal correctness against the AC's text (the read path should enforce the gate regardless of how the write side evolves later), and (b) covering a known transitional gap, below.
- **Transitional gap (accepted, not fixed by this story — user-confirmed decision).** Any `account_votes` row cast *before* this story's `castVote` flip existed, against a profile that was `isVerifiedForDiscovery: false` at vote time, is NOT retroactively flipped by this story — it has no migration, no backfill. Once Task 3's read-side filter ships, such a profile would (for the first time) actually disappear from `rankedVoteAccounts`/`votedAccountSuggestions`, even though it already has a real, pre-existing vote — i.e. demand it already demonstrated. This was surfaced to the user as a genuine design choice (data backfill vs. defer) before this story was finalized. **Decision: defer.** No backfill migration ships with this story; the gap is documented here and in Out of Scope as a known, accepted, transitional regression risk, to be swept up in a separate follow-up story if/when it's confirmed to matter against real data (dev DB has only 47 `social_media_account_profiles` rows and a handful of votes today — the actual blast radius is unknown and was the reason given for not building a production data-mutation migration speculatively). If a follow-up is written, the established pattern to reuse is `apps/backend/src/backfill-post-media-keys.ts` + `.github/workflows/backfill-post-media-keys.yml` (idempotent, dry-run-by-default, `workflow_dispatch`-only) — confirmed during Gate 3 as this codebase's existing convention for exactly this shape of one-time data correction, so a future backfill story needs no new mechanism, just a new script following that shape.
- **Why a shared helper, not a second inline copy (user-confirmed decision).** The alternative — duplicating `subscribe-to-account.ts`'s 4-line inline `UPDATE ... WHERE id = x AND isVerifiedForDiscovery = false` block directly into `castVote` — was considered and rejected per the architect's Gate 1 read: two independently-typed copies of a correctness-bearing WHERE clause is exactly what drifts silently when a third call site appears, or when one copy gets "simplified" during an unrelated change. **Decision: extract, and refactor the already-shipped Story 3.16 call site to use it too** (not just add the helper for `castVote`'s new call alone) — true deduplication, not a helper with only one real consumer. The helper lives in `apps/backend/src/lib/accounts/` (DB/Drizzle-coupled; per project-context.md's Code Organization rule it cannot live in `packages/domain`), not `packages/graphql-select` (that package is query-building/AST utilities like `buildOptimizedDrizzleSelect`, a different category of thing).
- **No DB migration in this story.** The `isVerifiedForDiscovery` column already exists (migration `0063_curvy_captain_cross.sql`, Story 3.14); this story adds no column, no index, and no data-mutation migration (see the deferred backfill above). The latest migration on disk is `0075_fat_mariko_yashida.sql` — this story does not add `0076`.
- **AD-17 does not bind this story's resolvers**, confirmed directly: AD-17 (`festgrid-architecture-spine.md`) binds only `Query.events`/`event`/`eventBySlug` and `buildOptimizedDrizzleSelect`. `rankedVoteAccounts`/`votedAccountSuggestions` are structurally separate, dedicated resolvers using plain `db.select()...groupBy()...orderBy()` chains with no `virtualFields`/`buildOptimizedDrizzleSelect` involvement at all — this story does not touch, and is not constrained by, AD-17's batching discipline.
- **Read in full before finalizing implementation:** `apps/backend/src/schema/resolvers.ts`'s `castVote`/`rankedVoteAccounts`/`votedAccountSuggestions`/`queryModeratorAccountProfiles` resolvers, `apps/backend/src/lib/subscriptions/subscribe-to-account.ts` (+ its test), `apps/backend/src/lib/accounts/get-or-create-discovered-account-profile.ts` (confirmed untouched), `apps/backend/src/schema/account-votes.graphql`, `apps/backend/src/schema/account-votes.test.ts`, `packages/database/schema.ts`'s `socialMediaAccountProfiles`/`accountVotes` tables, PRD §3.13/§4.5/§4.15, `epics.md`'s Story 3.14/3.16/3.17 sections, `_bmad-output/implementation-artifacts/3-16-immediate-coauthor-publisher-subscribability.md` (direct predecessor, same column, same flip idiom).

### Architecture & UX Gate Findings

**All three gates were run fresh for this story** — `epic-3-readiness.md` (`_bmad-output/planning-artifacts/epic-readiness/`) is dated 2026-09-11 and its `stories_covered` list runs only through Story 3.12; Story 3.17 (and its siblings 3.13-3.19) were added later via FIND-022/`bmad-correct-course` (2026-09-18), after that sweep, and are not covered by it — matching Story 3.16's own confirmed precedent ("no epic readiness report covers Story 3.16... all three gates run fresh").

- **Gate 1 (Architecture/Infrastructure Completeness) — No gap found.** Both the write-side flip and the read-side filter stay entirely inside `apps/backend`'s existing resolver/lib layer: no backend/API bypass, no frontend-to-DB or frontend-to-third-party call, no new unbacked GraphQL surface (zero new types/fields/resolvers — `rankedVoteAccounts`/`votedAccountSuggestions`/`castVote` all already exist), no auth/business logic pushed to the frontend, and no new infrastructure dependency (the column already exists; no new queue, Lambda, or compute resource). The architect additionally recommended: extract the flip into a shared helper rather than duplicate it (adopted, Task 1); treat a potential backfill migration as a separately-tracked, separately-risk-assessed item rather than folding it into this story (adopted — see Dev Notes); and skip adding an index on `isVerifiedForDiscovery` for now, since neither gated resolver is AD-17-bound, neither is a stated hot path, and a boolean-equality filter on an already-small aggregate isn't where cost lives at current or near-term scale (revisit only if profiling says otherwise).
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness) — No gap found.** This story introduces no new foundational concept and depends on nothing missing a story in `epics.md`: i18n, PostHog analytics (Story 3.19's separate scope), the GraphQL Code Generator pipeline (no schema shape change — `isVerifiedForDiscovery` is a server-side WHERE input, never exposed as a GraphQL field), `buildOptimizedDrizzleSelect`, and the global app shell are all confirmed out of scope. A potential data backfill was confirmed to have an existing, named, reusable convention already in this codebase (`backfill-post-media-keys.ts`'s dry-run/`workflow_dispatch` pattern, reused by Story 3.22) — so even if a follow-up backfill story is later written, it is not a missing-foundation gap, just a scope/sequencing decision (Gate 1/2 territory, not Gate 3). A plain `eq()` condition used at exactly two call sites (both edited together by this one story) does not warrant a new shared "visibility-gate utility" — that would be premature abstraction, not reuse discipline, per the precedent set by `activeOnly()` (which earned its place across dozens of call sites, not two).
- **Gate 2 (UI Complexity & Reusability) — No gap found.** Zero new components, zero new GraphQL fields reaching the frontend, zero React/JSX/TSX files touched. The existing frontend consumers (`apps/web/src/components/votes/RankedVoteList.tsx`, `CastVoteForm.tsx`, `subscribe-account-dialog.tsx`'s `useVotedAccountSuggestionsQuery`) are unmodified — they already have a generic "no results" empty state covering every zero-result case, and a scrape-discovered, zero-demand account filtering out of a result set is mechanically identical to any other reason a query returns fewer rows. Considered and rejected: differentiated UI copy distinguishing "filtered by the gate" from "genuinely nothing matches" — this would require surfacing that a specific hidden account exists, which is more information leakage than a feature explicitly scoped as "a visibility gate, not content review" (epics.md Note) was ever meant to expose. The existing generic empty state is the correct outcome, not a gap.
- **Lightweight guard — anything the gates plausibly didn't anticipate?** No. No new external service, no new data entity (reuses the already-existing `isVerifiedForDiscovery` column and `account_votes` table), no new infra dependency.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: no changes required.** No new column, no new table, no DDL. `isVerifiedForDiscovery: boolean('is_verified_for_discovery').default(true).notNull()` (`packages/database/schema.ts:196`) is unchanged by this story.
- **Impacted fields/contracts:** none at the schema/type level. The new `verifyAccountProfileForDiscovery` helper's signature (`(profileId: string) => Promise<SocialMediaAccountProfile | undefined>`) is new but internal to `apps/backend` — no GraphQL schema change, no `packages/database`/`packages/domain` export change.
- **Required DB migration changes:** none. This story does not add migration `0076` or any other migration file. (The deferred data-backfill discussed in Dev Notes, if ever built, would be a separate story's separate migration/script — explicitly not part of this story's scope or Definition of Done.)
- **Required TypeScript type changes:** none breaking. No GraphQL type gains or loses a field; `CastVoteInput`/`AccountVote`/`RankedAccountVote` (`account-votes.graphql`) are unchanged.
- **Backward compatibility and rollout notes:** Purely additive at the code level (a new helper + a tightened WHERE/filter on two existing resolvers + one new call site). The one deliberate, accepted behavior change is the transitional gap documented above: a pre-existing voted-but-never-flipped profile will disappear from `rankedVoteAccounts`/`votedAccountSuggestions` once this ships, until either a future backfill or a fresh vote/withdrawal-then-recast event on that same profile corrects it. No feature flag — this is a correctness fix for a brand-new feature’s own intended gate, not a risky behavior toggle.
- **Verification checks:** Task 1.2's new unit-style tests; Task 2.2/3.4's extended `account-votes.test.ts` cases; `subscribe-to-account.test.ts`'s existing (i)/(j) cases re-run unmodified as a regression guard on the refactor; `pnpm --filter backend build` (tsc) and lint on all touched files.

### Previous Story Intelligence (Story 3.16)

Story 3.16 (`3-16-immediate-coauthor-publisher-subscribability.md`, status `review`) is this story's direct predecessor on the exact same column. Key carry-forward facts, already folded into the Tasks/Dev Notes above:
- Its own Task 3.5 is the inline flip this story relocates into the new shared helper (Task 1.3) — a pure relocation, confirmed behavior-preserving.
- Its own "Design Decisions" section already resolved, back on 2026-10-03, that **3.16 writes the subscribe-side flip now, and 3.17 (this story) adds the read-side gate plus the vote-event half** — this story is executing exactly that previously-agreed division of labor, not re-litigating it.
- Its own Out of Scope explicitly named this story's two remaining pieces ("Story 3.17's actual demand-gated discovery read-path... and its vote-event trigger") almost word-for-word matching this story's Tasks 2-3.
- All three gates ran fresh for 3.16 too (no epic readiness report covered it either), all "No gap found" — the same clean result this story's fresh gate run reached independently.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.17: Demand-gated discovery for scrape-discovered profiles] — full AC text and Note
- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.14: Deduplicated, provenance-tracked subscribable profiles] and #Story 3.16: Immediate coauthor/publisher subscribability — the two stories this story's scope sits directly after
- [Source: _bmad-output/implementation-artifacts/3-16-immediate-coauthor-publisher-subscribability.md] — direct predecessor on the same column/flip idiom; its Out of Scope explicitly named this story's remaining work
- [Source: _bmad-output/specs/spec-post-coauthor-attribution/SPEC.md#CAP-5]
- [Source: _bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md §3.13 "Vote for Social Media Accounts", §4.5 "SocialMediaAccountProfile Interface", §4.15 "AccountVote Interface"]
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-17: Computed Event/Schedule Field Batching] — confirmed non-binding for this story's resolvers
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-3-readiness.md] — confirmed dated 2026-09-11, covers only through Story 3.12; does not cover this story
- [Source: apps/backend/src/schema/resolvers.ts (castVote, rankedVoteAccounts, votedAccountSuggestions, queryModeratorAccountProfiles), apps/backend/src/lib/subscriptions/subscribe-to-account.ts (+ test), apps/backend/src/lib/accounts/get-or-create-discovered-account-profile.ts, apps/backend/src/schema/account-votes.graphql, apps/backend/src/schema/account-votes.test.ts, packages/database/schema.ts, packages/database/migrations/0063_curvy_captain_cross.sql, apps/backend/src/backfill-post-media-keys.ts + .github/workflows/backfill-post-media-keys.yml] — all read in full or in relevant part for this story

## Global Rules References

- [x] `_bmad-output/project-context.md` — Database Access (Drizzle ORM only, no Supabase client); Drizzle ORM Types (pg-core types, unchanged); Code Organization (the new helper is DB/Drizzle-coupled and correctly placed in `apps/backend`, not `packages/domain`, per the explicit DB/ORM-coupling carve-out); Testing Rules (testing-trophy/integration-against-real-DB convention, matching this exact file's existing style, not `packages/domain`'s 100%-coverage rule since nothing moves there)
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — this file's canonical section order/status vocabulary
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-17 explicitly checked and confirmed non-binding for the two touched resolvers (see Dev Notes)
- [x] `docs/infrastructure/index.md` — reviewed; this story adds no new infrastructure resource (no new queue, Lambda, compute, or migration) — shard files not independently re-read in full, matching the 3.16 precedent for a no-new-infra, resolver-only change
- [x] `_bmad-output/planning-artifacts/story-split-gate.md` — all three gates run fresh this session (confirmed `epic-3-readiness.md` predates this story); see Architecture & UX Gate Findings

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  1. `apps/backend/src/lib/accounts/verify-account-profile-for-discovery.ts` (new) — shared flip helper.
  2. `apps/backend/src/lib/accounts/verify-account-profile-for-discovery.test.ts` (new) — its tests.
  3. `apps/backend/src/lib/subscriptions/subscribe-to-account.ts` (modified) — Task 1.3's relocation; no other change.
  4. `apps/backend/src/schema/resolvers.ts` (modified) — `castVote`'s new call (Task 2.1), `votedAccountSuggestions`'s and `rankedVoteAccounts`'s new filter conditions (Task 3.1/3.2), the `queryModeratorAccountProfiles` exclusion comment (Task 3.3), plus the new import.
  5. `apps/backend/src/schema/account-votes.test.ts` (modified) — new cases per Task 2.2/3.4.
  6. No other file is modified — no GraphQL schema file, no `packages/database`/`packages/domain` file, no frontend file, no migration.
- **Rule Mapping:**
  - AC1 (gate + flip) → Task 1 (shared helper) + Task 2 (castVote wiring) + Task 3 (read-side filters).
  - AC2 (contextual access unaffected) → Task 4.1 (confirmed by inspection, zero code change).
  - AC3 (direct-subscribe path unaffected) → Task 4.2 (confirmed by inspection, zero code change).
  - project-context.md's DB/ORM-coupling placement rule → Task 1.1's helper location (`apps/backend`, not `packages/domain`).
  - "No database changes" (this session's own rule) → confirmed no migration anywhere in this story's plan.
- **Verification Plan:** Task 5 in full — three targeted test files (new helper test, extended `subscribe-to-account.test.ts` regression, extended `account-votes.test.ts`), `pnpm --filter backend build` (tsc), lint on touched/new files only. Full `apps/backend` suite and repo-wide `pnpm test`/`pnpm lint` deferred to `bmad-dev-story`'s own Definition-of-Done gate, not run by this story-creation session.

## Pre-Coding Approval Gate

- [ ] Scope confirmation — a new shared backend helper (`verifyAccountProfileForDiscovery`) refactored into both `subscribeToAccount` (existing, reviewed code) and `castVote` (new call), plus a read-side `isVerifiedForDiscovery` filter added to `rankedVoteAccounts`/`votedAccountSuggestions`; explicitly no GraphQL schema change, no new resolver, no frontend file, no migration.
- [ ] Architecture and boundary confirmation — helper correctly placed in `apps/backend/src/lib/accounts/` (DB/Drizzle-coupled, not `packages/domain`); AD-17 confirmed non-binding; `queryModeratorAccountProfiles` deliberately left ungated.
- [ ] Testing plan confirmation — Task 1.2/2.2/3.4's new/extended cases cover the flip (new vote, reactivated vote, idempotent no-op) and the read-side gate (excluded-when-false, included-when-true, moderator view unaffected); `subscribe-to-account.test.ts`'s existing (i)/(j) cases re-run as a non-regression check on the Task 1.3 refactor.
- [x] Explicit human approval state (Default: pending approval) — **approved**. Both genuine design decisions below were resolved directly by the user before this story was finalized; implementation may proceed once a dev agent picks this story up.
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted — all three gates run fresh this session (no epic readiness report covers 3.17): No gap found on all three (see Architecture & UX Gate Findings).
- [x] Design decisions confirmed — both resolved directly by the user (see Dev Notes "Design Decisions" context above and the explicit call-outs inline): (1) extract a shared helper and refactor Story 3.16's already-shipped call site to use it too, rather than duplicate the inline flip; (2) defer the pre-existing-`account_votes`-row backfill to a separate follow-up rather than fold a data migration into this story, with the transitional gap documented as an accepted, known limitation.

## Testing Requirements

- [ ] Unit tests — not applicable in the `packages/domain` 100%-coverage sense (the new helper is DB-coupled and lives in `apps/backend`, which follows the testing-trophy convention below instead).
- [ ] Integration tests — `apps/backend/src/lib/accounts/verify-account-profile-for-discovery.test.ts` (new, `node:test` against the real local Postgres DB), `apps/backend/src/lib/subscriptions/subscribe-to-account.test.ts` (existing cases re-verified unmodified), `apps/backend/src/schema/account-votes.test.ts` (extended with the new flip and read-filter cases) — all matching this codebase's existing no-DB-mocking integration convention.
- [ ] E2E tests — not applicable; backend-only change with no new user-facing flow (the existing vote-list/subscribe-dialog UI is unmodified), per `project-context.md`'s testing-trophy guidance.

## Deliverables Checklist

- [ ] `verifyAccountProfileForDiscovery` helper created in `apps/backend/src/lib/accounts/`, with its own tests.
- [ ] `subscribeToAccount` refactored to call the shared helper (no behavior change; existing tests pass unmodified).
- [ ] `castVote` flips `isVerifiedForDiscovery` `false → true` via the same shared helper.
- [ ] `rankedVoteAccounts` and `votedAccountSuggestions` exclude any `isVerifiedForDiscovery: false` profile; `queryModeratorAccountProfiles` explicitly left ungated, with a comment explaining why.
- [ ] All new/extended test cases green; no regression in `subscribe-to-account.test.ts`'s or `account-votes.test.ts`'s pre-existing cases.
- [ ] `pnpm --filter backend build` (tsc) and lint on all touched/new files clean.
- [ ] No database migration added.

## Out of Scope

- **A data backfill for pre-existing `account_votes` rows cast before this story's `castVote` flip existed** — deferred by explicit user decision (see Dev Notes "Transitional gap"); if ever needed, follow the `backfill-post-media-keys.ts`/`.github/workflows/backfill-post-media-keys.yml` convention in a dedicated follow-up story, not folded in here.
- **An index on `isVerifiedForDiscovery`** — Gate 1 confirmed not warranted at current/near-term scale; revisit only if profiling says otherwise.
- **`queryModeratorAccountProfiles`** — deliberately not gated; moderators need full visibility into unverified profiles.
- **Story 3.19 (sanitized subscription-toggle analytics)** — a separate sibling story (FIND-022 CAP-8), not this story's scope.
- **Any GraphQL schema change, new resolver, or frontend/UI file** — this story is backend-only; the existing vote-list/subscribe-dialog components need no change (Gate 2: "No gap found").
- **`voteRegionBreakdown`** — operates on one already-known `accountId`, not a browse/discovery surface; out of scope.
- **Any restructuring of `rankedVoteAccounts`'s per-row profile-refetch loop into a joined aggregate query** — Task 3.2 deliberately keeps the existing shape; a structural rework is not this story's concern.

## Definition of Done

- [ ] AC1-AC3 satisfied exactly as specified above.
- [ ] All Task 1.2/2.2/3.4 tests passing, plus every pre-existing test in `subscribe-to-account.test.ts` and `account-votes.test.ts` (no regression).
- [ ] `pnpm --filter backend build` (tsc) clean; lint clean on all touched/new files.
- [ ] No file outside the File Change Plan touched; no migration added; no `packages/domain`/`packages/database` schema file modified.

## Completion Status

- [ ] Not yet implemented — story is `ready-for-dev`; awaiting a `bmad-dev-story` pass.

## Dev Agent Record

### Agent Model Used

_Not yet started — to be filled in by `bmad-dev-story`._

### Debug Log References

_Not yet started._

### Completion Notes List

_Not yet started._

### File List

_Not yet started._

## Change Log

- 2026-10-07 — Story created via `bmad-create-story` (FIND-022 CAP-5). Gates 1/2/3 run fresh (epic-3-readiness.md predates this story, confirmed). Two design decisions resolved directly by the user before finalizing: (1) extract a shared `verifyAccountProfileForDiscovery` helper used by both `castVote` and a refactored `subscribeToAccount`; (2) defer the pre-existing-vote-rows backfill to a separate follow-up, documented as an accepted transitional gap. No new migration.
