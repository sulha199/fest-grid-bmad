---
baseline_commit: 19f9043871496861bb8ca072d43433b21edf35ea
---

# Story 3.6n2: Expose the face-blurred thumbnail through the read path and widen the prominent-card trigger

## Story Details

- Epic: 3
- Story ID: 3.6n2
- Status: in-progress

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a subscriber,
I want FestDaily's event cards and detail page to actually use the blurred thumbnail Story 3.6n generates and stores,
so that an event sourced from a non-opted-in account still gets a prominent, photo-backed card once its original hotlinked image expires, instead of nothing — closing PRD §3.16's "sharp prominent vs. blurred prominent, not prominent vs. nothing" gap.

## Acceptance Criteria

1. **Given** Story 3.6n's `posts.durableThumbnailUrl` column (already shipped, `review` status), **when** this story ships, **then** `events.graphql`'s `Event` type gains `durableThumbnailUrl: String` (sibling to the existing `durableImageUrl: String`, line 123), resolved by a new `Event.durableThumbnailUrl` field resolver mirroring the existing raw-passthrough resolver exactly: `durableThumbnailUrl: (parent: any) => parent.durableThumbnailUrl || null` (beside `durableImageUrl`'s own resolver, `resolvers.ts` ~line 4257).
2. **And** `durableThumbnailUrl: posts.durableThumbnailUrl` is added to every one of the **6** existing `resolvers.ts` Drizzle select projections that already select `posts.durableImageUrl` the same way — confirmed by direct read, these are: `Mutation.restoreEvent` (~line 1695), `Query.events`'s windowed/`perDayLimit` branch (~line 3273), `Query.events`'s flat-items branch (~line 3361), `Query.event` (~line 3568), `Query.eventBySlug`'s shared `selectEventRow` helper (~line 3695), and `Report.event` (~line 4083) — so a thumbnail follows its post automatically wherever the primary-post relationship is read, including after a future event promotion (Story 3.6v). (The 7th `durableImageUrl` select site in `Query.instagramEmbedBySlug`, ~line 3816, is a distinct field on `InstagramEmbedBySlugStatus`/`InstagramEmbed`, not `Event.durableThumbnailUrl` — explicitly out of scope, see Out of Scope.)
3. **And**, given Architecture Spine AD-28 Rule 7's card-render precedence (`durableImageUrl` sharp > `durableThumbnailUrl` blurred > nothing) and the served-URL decision resolved with the user at Story 3.6n's creation (`AskUserQuestion`, 2026-10-03 — "thumbnail fills the gap only," **already decided, not reopened by this story**), **when** this story ships, **then** `resolveServedImageUrl` (`packages/domain/src/events/resolveServedImageUrl.ts`) gains an optional `durableThumbnailUrl` input and its precedence becomes:
   - (a) the raw original `imageUrl` while `imageUrlExpiresAt` is in the future — **unchanged**, independent of opt-in;
   - (b) else, if `isImageStorageOptedIn`, `durableImageUrl || imageUrl || null` — **unchanged**, and `durableThumbnailUrl` is **never** consulted on this branch even when `durableImageUrl` is null (opted-in accounts never see the blurred thumbnail — AD-28 Rule 6/7's sharp-vs-blurred distinction is keyed on opt-in, not on durable-image presence);
   - (c) else (not opted in, and the original has expired or has no expiry), `durableThumbnailUrl || null` — **new**, replacing today's unconditional `null` for this one case.
   Every branch (including the two sub-cases of (b) above) is covered by new lettered cases extending `resolveServedImageUrl.test.ts`'s existing a–l set (continuing from `m`).
4. **And**, given `EventListView.tsx`'s `prominentPoster` derivation (`!!event.durableImageUrl`, AD-28 Rule 7), **when** this story ships, **then** it widens to `!!(event.durableImageUrl || event.durableThumbnailUrl)` (`packages/ui/src/features/events/EventListView.tsx` line 101), so a non-opted-in account whose post has a thumbnail also qualifies for the prominent-card treatment (rendering whatever `event.imageUrl` resolved to per AC3 — no new `EventCard` prop or visual state; `image_prominent`'s existing styling, confirmed unchanged by this story's own Gate 2 pass, is untouched). `EventListViewItem` (`EventListView.types.ts`) gains a sibling `durableThumbnailUrl?: string | null` field next to its existing `durableImageUrl?: string | null`. `EventListView.tsx`'s own `imageFallbackUrl` prop (line 88, `event.durableImageUrl ?? undefined`) is **deliberately left unwidened** — see Dev Notes for why this is not a gap.
5. **And**, given `apps/web`'s 5 `durableImageUrl`-selecting GraphQL operations on the `Event` type (`queries.graphql`: `getEvents`, `getEventBySlug`, `getEventsForCalendar`, `getEventsForMyCalendar`, `getArchivedEvents` — confirmed by direct read; the two `InstagramEmbed`/`InstagramEmbedBySlug` operations that also mention `durableImageUrl` are a different field on a different type, out of scope) and `mapper.ts`'s event-detail mapping, **when** this story ships, **then** each of the 5 operations adds a sibling `durableThumbnailUrl` field (GraphQL Code Generator regenerated via `pnpm --filter web codegen`), and `mapper.ts`'s `imageFallbackUrl` (line 163) widens from `event.durableImageUrl` to `event.durableImageUrl || event.durableThumbnailUrl`, so the event-detail page's own BUG-042 retry-on-image-error chain can also fall back to the blurred thumbnail when no sharp durable copy exists.
6. **And** a regression test confirms: `resolveServedImageUrl`'s new precedence (unit, `packages/domain`, all new lettered branches above — including the two opted-in sub-cases of (b)); at least one `resolvers.ts` integration test confirming `durableThumbnailUrl` is selected and returned on the GraphQL `Event` type; and an `EventListView`-level test confirming `prominentPoster` becomes `true` when only `durableThumbnailUrl` (not `durableImageUrl`) is present on the item.

**Note:** Split off Story 3.6n at `bmad-create-story` time (2026-10-03) — flagged by the batch readiness sweep (`epic-readiness/batch-cc-023-face-blur-audit-readiness.md`) as a size-driven split candidate (pipeline vs. read path/UI); confirmed with the user via `AskUserQuestion`, mirroring this project's `1.3a`/`1.3b` backend-layer/UI-layer split precedent. The served-URL precedence (AC3) was also a reserved, user-confirmed privacy-trade-off decision at that same create-story session — see Gate 3 Finding 3 in the batch readiness report for the full option comparison this AC's chosen semantics were drawn from. **This create-story session (2026-10-05) re-confirmed via a fresh Gate 2 pass that no further split is needed** (see Architecture & UX Gate Findings below) and found the same scope independently matches backlog row **FIND-070** ("Frontend event list never loads durable_thumbnail_url") — a bug filed 2026-10-05 against this exact unbuilt read path, discovered during unrelated `bmad-quick-dev` work. This story closes both the planned `sprint-status.yaml` entry and FIND-070 in one build.

**Depends on:** Story 3.6n (`review` status — `posts.durableThumbnailUrl` already exists and is being populated; this story has nothing real to serve without it).

## Tasks / Subtasks

- [x] **Task 1 (AC1): Add the `Event.durableThumbnailUrl` GraphQL field**
  - [x] `apps/backend/src/schema/events.graphql`: add `durableThumbnailUrl: String` on the `Event` type, directly beside `durableImageUrl: String` (line 123).
  - [x] `apps/backend/src/schema/resolvers.ts`: add a new `Event.durableThumbnailUrl` field resolver beside the existing `durableImageUrl` one (~line 4257): `durableThumbnailUrl: (parent: any) => parent.durableThumbnailUrl || null,`. Also threaded `parent.durableThumbnailUrl` into the existing `Event.imageUrl` resolver's `resolveServedImageUrl(...)` call (necessary for AC3's new precedence branch to actually take effect end-to-end; implied by AC3/AC6's integration test, not a separate story task line).

- [x] **Task 2 (AC2): Select `posts.durableThumbnailUrl` at all 6 existing `durableImageUrl` select sites**
  - [x] `Mutation.restoreEvent` (~line 1695): add `durableThumbnailUrl: posts.durableThumbnailUrl,` beside `durableImageUrl: posts.durableImageUrl,`.
  - [x] `Query.events`'s windowed/`perDayLimit` branch (~line 3273): same addition.
  - [x] `Query.events`'s flat-items branch (~line 3361): same addition.
  - [x] `Query.event` (~line 3568): same addition.
  - [x] `Query.eventBySlug`'s shared `selectEventRow` helper (~line 3695) — covers both the direct slug hit and the alias-redirect fallback (Story 3.6v) in one place: same addition.
  - [x] `Report.event` (~line 4083): same addition.
  - [x] Confirm (read the diff) that `Query.instagramEmbedBySlug`'s own `durableImageUrl` select (~line 3816, feeds `InstagramEmbedBySlugStatus.durableImageUrl` / `resolveInstagramEmbedResult`, a structurally different field on a different GraphQL type) is **not** touched — it is out of scope (AC2 parenthetical, Out of Scope). Confirmed by grep: line is unchanged.

- [x] **Task 3 (AC3): Extend `resolveServedImageUrl`'s precedence**
  - [x] `packages/domain/src/events/resolveServedImageUrl.ts`: add `durableThumbnailUrl?: string | null` to `ResolveServedImageUrlInput`, destructured with a default of `durableThumbnailUrl = null` (mirroring `now = new Date()`'s existing optional-with-default pattern) so every one of the 12 existing call sites/tests that don't pass it keep compiling and behaving identically.
  - [x] Rewrite the function body to the 3-branch precedence AC3 specifies — functionally:
    ```ts
    const isOriginalStillValid = imageUrlExpiresAt != null && now < imageUrlExpiresAt;
    if (isOriginalStillValid && imageUrl) {
      return imageUrl;
    }
    if (isImageStorageOptedIn) {
      return durableImageUrl || imageUrl || null;
    }
    return durableThumbnailUrl || null;
    ```
    Confirm this produces byte-identical results to today's implementation for every existing lettered case (a)–(l) before adding new cases (the `isImageStorageOptedIn` branch's behavior is unchanged; only the final `else` arm changes from a bare `return null` to `return durableThumbnailUrl || null`).
  - [x] Extend `resolveServedImageUrl.test.ts` with new lettered cases continuing from `(m)`, covering (non-exhaustive — dev agent may add more): NOT opted-in + expired original + thumbnail present → thumbnail (was null pre-this-story); NOT opted-in + expired + thumbnail null → null (unchanged); NOT opted-in + no expiry + thumbnail present → thumbnail; NOT opted-in + no expiry + thumbnail null → null; NOT opted-in + original still valid + thumbnail present → original wins (thumbnail never overrides a valid original); opted-in + expired + durableImageUrl present + thumbnail also present → durableImageUrl wins, thumbnail never consulted; opted-in + durableImageUrl null + thumbnail present → falls through to bare `imageUrl` (not thumbnail) — confirms thumbnail is genuinely gated on `!isImageStorageOptedIn`, not merely on `durableImageUrl` being absent. Added cases (m)–(s), 8 new cases; all a–l unchanged and passing; 100% line/branch/function coverage confirmed via `tsx --test --experimental-test-coverage`.

- [x] **Task 4 (AC4): Widen `prominentPoster` in `EventListView.tsx`**
  - [x] `packages/ui/src/features/events/EventListView.types.ts`: add `durableThumbnailUrl?: string | null;` to `EventListViewItem`, beside `durableImageUrl`.
  - [x] `packages/ui/src/features/events/EventListView.tsx` line 101: widen `prominentPoster: !!event.durableImageUrl,` to `prominentPoster: !!(event.durableImageUrl || event.durableThumbnailUrl),`. Update the adjacent comment (lines 98–100) to reflect the new derivation.
  - [x] Do **not** touch line 88's `imageFallbackUrl: event.durableImageUrl ?? undefined,` — see Dev Notes "Why `EventListView`'s `imageFallbackUrl` stays unwidened" for the reasoning (not an oversight). Confirmed unchanged by grep.
  - [x] `packages/ui/src/features/events/EventListView.test.tsx`: added a new test beside the existing "(derives prominentPoster=true only when durableImageUrl is non-null)" one confirming `prominentPoster` is also `true` when the item has `durableThumbnailUrl` set and `durableImageUrl` unset/null, and confirming a third fixture with neither set stays non-prominent. 18/18 tests passing.

- [x] **Task 5 (AC5): Thread `durableThumbnailUrl` through `apps/web`'s queries/mapper/codegen**
  - [x] `apps/web/src/features/events/queries.graphql`: add `durableThumbnailUrl` as a sibling field to `durableImageUrl` in exactly the 5 confirmed Event-type operations: `getEvents` (line 11), `getEventBySlug` (line 56), `getEventsForCalendar` (line 208), `getEventsForMyCalendar` (line 243), `getArchivedEvents` (line 279). Do **not** add it to the two `InstagramEmbed`/`InstagramEmbedBySlug` fragments (lines 165, 174) — different field, different type, already covered by Story 3.6n/3.7e, out of scope here. Confirmed via grep: those 2 sites untouched.
  - [x] Run `pnpm --filter web codegen` (runs `graphql-codegen --config codegen.ts && node fix-codegen.js` per `apps/web/package.json`) to regenerate `apps/web/src/generated/graphql.ts`. Confirmed via `git diff`: exactly the expected new field added to the `Event` type and the 5 operations' result types/documents, no unexpected diff.
  - [x] `apps/web/src/features/events/mapper.ts` line 163: widen `imageFallbackUrl: event.durableImageUrl,` to `imageFallbackUrl: event.durableImageUrl || event.durableThumbnailUrl,`.
  - [x] Confirmed (read the diff, `pnpm --filter web build` green) that the 5 page/content files consuming `EventListView` via structural typing (`feed-content.tsx`, `favorites-content.tsx`, `archive-content.tsx`, `home-content.tsx`, `account-content.tsx`) needed no explicit per-file change — structural typing propagated the new field automatically; build compiled clean with no new errors.
  - [x] Confirmed (read the diff) that `apps/web/src/features/events/EventDetailWrapper.tsx` line 704's own inline `imageFallbackUrl: e.durableImageUrl,` (the "related events" mini-card mapping, a hand-rolled mapping distinct from `mapper.ts`) is **not** widened — same reasoning as Task 4's `EventListView.tsx` exclusion, see Dev Notes. Confirmed unchanged.

- [ ] **Task 6 (AC6): Regression tests**
  - [ ] `packages/domain`: Task 3's new lettered `resolveServedImageUrl.test.ts` cases (unit, `node:test`, 100% coverage rule for `packages/domain`).
  - [ ] `apps/backend/src/schema/resolvers.test.ts`: extend the existing `eventBySlug`/`durableImageUrl` test block (the pattern around lines 2698–2800, "Case 1/Case 2" opted-in/expired scenarios) with at least one new case: a non-opted-in account, an expired `imageUrlExpiresAt`, `durableImageUrl: null`, `durableThumbnailUrl` set on the post — assert `eventBySlug.durableThumbnailUrl` returns the raw value (AC1/AC2) and `eventBySlug.imageUrl` resolves to that same thumbnail URL (AC3's new branch, exercised end-to-end through the real resolver + DB select, not just the unit-tested pure function).
  - [ ] `packages/ui/src/features/events/EventListView.test.tsx`: Task 4's new `prominentPoster`-from-thumbnail-only test.
  - [ ] Full regression: confirm no existing `resolveServedImageUrl` call site (resolvers.ts's three usages: `Event.imageUrl`, `Report`/`instagramEmbedBySlug`'s indirect use via `resolveInstagramEmbedResult` — confirm by read whether that helper also calls `resolveServedImageUrl` or is independent before assuming it's affected) regresses — full `apps/backend` suite green.

- [ ] **Task 7: Verification pass (per user's stated test convention for this story: `TZ=UTC`, backend suite alone — not a full monorepo batch-end gate)**
  - [ ] `TZ=UTC pnpm --filter domain test` — `resolveServedImageUrl.test.ts` (all a–l plus new m+ cases) and the full existing domain suite green; confirm 100% line/branch coverage for the touched function via `tsx --test --experimental-test-coverage` targeted at that file.
  - [ ] `TZ=UTC pnpm --filter backend test` — Task 6's new integration case(s) plus the full existing `apps/backend` suite green (expect the same pre-existing, out-of-scope FIND-063 `system-key-adapter` failures already documented by Stories 3.6n/3.6o; confirm no *new* failures).
  - [ ] `pnpm --filter ui test` — `EventListView.test.tsx`'s new case plus the full existing `packages/ui` suite green.
  - [ ] `pnpm --filter web codegen` (Task 5) regenerates cleanly with no diff beyond the expected new field; `pnpm --filter web build` and any `apps/web` lint/typecheck for touched files clean.
  - [ ] `pnpm --filter backend lint` / `pnpm --filter domain lint` / `pnpm --filter ui lint` clean for touched files; `tsc`/build clean for `apps/backend`, `packages/domain`, `packages/ui`.
  - [ ] Manually confirm (read the diff) that no change lands in `apps/backend/src/lib/ai-processor/**` or `packages/database/schema.ts`/migrations — this story is read-path-only, Story 3.6n's pipeline is untouched.

- [ ] **Task 8 (optional, non-blocking — manual QA aid, not required for AC satisfaction): Seed fixture for the blurred-thumbnail-prominent state**
  - [ ] Consider adding one `packages/database/seed.ts` fixture (mirroring the existing `EVENT-CARD FIXTURE: masonry prominentPoster (VM1)` entries ~lines 533–551) for a non-opted-in account whose post has `durableThumbnailUrl` set, `durableImageUrl: null`, and an already-expired `imageUrlExpiresAt` — so the new blurred-thumbnail prominent-card state is visually inspectable in local dev without a real pipeline run. Not an AC; skip if time-constrained.

## Dev Notes

- **This is a read-path-only story.** Touches `apps/backend/src/schema/events.graphql` + `resolvers.ts` (field + 6 select sites), `packages/domain/src/events/resolveServedImageUrl.ts` (+ its test file), `packages/ui/src/features/events/EventListView.tsx`/`EventListView.types.ts` (+ its test file), and `apps/web/src/features/events/queries.graphql`/`mapper.ts` + generated codegen output. Zero changes to `apps/backend/src/lib/ai-processor/**` (Story 3.6n's pipeline, already shipped and populating the column this story reads) or `packages/database/schema.ts`/migrations (the column already exists).

- **FIND-070 is the same work, already filed.** Backlog row `FIND-070` ("Frontend event list never loads durable_thumbnail_url," filed 2026-10-05 from an unrelated `bmad-quick-dev` session) describes exactly this story's gap and cross-references this same `sprint-status.yaml` key in its own note. This story's `bmad-create-story` `on_complete` step is expected to promote that row and mark it `promoted` once this story file exists — see the final completion summary for confirmation.

- **Served-URL precedence is a decided, not reopened, question (2026-10-03, `AskUserQuestion`, recorded in full in Story 3.6n's own Dev Notes).** "Thumbnail fills the gap only": while the original hotlinked image is still valid, `Event.imageUrl` keeps serving it unchanged (any opt-in status, AD-28 Rule 7's framing is purely about the card's *render preference*, not the backend's *serving* decision — that distinction is exactly what Gate 3 Finding 3 in the batch readiness report flagged as needing an explicit, tested answer, which AC3 above is). Once the original expires: an opted-in account still gets `durableImageUrl` (sharp) as today; a non-opted-in account now gets `durableThumbnailUrl` (blurred) instead of `null`. This story's job is purely mechanical: wire that already-agreed precedence into the one pure function, the GraphQL surface, and the two consumers that read it. Do not re-litigate this decision or ask the user about it again.

- **Why `EventListView.tsx`'s `imageFallbackUrl` (line 88) stays unwidened — a deliberate scope boundary, not an oversight.** AC4/epics.md's AC3 widen only `prominentPoster`, not `imageFallbackUrl`, in `EventListView.tsx`. Reasoning worked through during this create-story session: `EventCard.tsx`'s retry chain only actually retries when `imageFallbackUrl !== posterImgSrc` (a real second URL to try). In the branch this story's AC3 change affects (non-opted-in, original expired), `event.imageUrl` *is already* `durableThumbnailUrl` (per the new `resolveServedImageUrl` precedence) and `event.durableImageUrl` is `null` for that same non-opted-in account — so `imageFallbackUrl` would stay `null` regardless, identical to today's pre-story behavior for that case (no regression, nothing to widen). This exactly mirrors the pre-existing opted-in case: when `imageUrl === durableImageUrl` already (today's existing expired+opted-in branch), the "fallback" is the identical URL and the retry is a structural no-op by the same `!==` guard. Widening `imageFallbackUrl` to also include `durableThumbnailUrl` would only matter if the thumbnail URL itself (served as `imageUrl`) then separately failed to load (e.g. a transient CDN error on our own hosted thumbnail) — a real but narrow edge case, already explicitly out-of-scope per `EVENT-CARD-DESIGN.md`'s `image_prominent_fallback` token note ("if a `durableImageUrl` load can still fail for other reasons... that is an existing, unrelated failure mode... revisit only if it turns out to matter in practice") applied by the same logic to the new thumbnail case. For the identical reason, `EventDetailWrapper.tsx` line 704's own separate "related events" mini-card mapping (`imageFallbackUrl: e.durableImageUrl`) is also left unwidened — consistent with, not inconsistent with, this story's own `EventListView.tsx` precedent. (`mapper.ts`'s own `imageFallbackUrl` widening, AC5, is a *different* call site — the event-detail page's own hero image — explicitly named in epics.md's AC4 and kept as specified.)

- **Files read in full before finalizing this design:** `apps/backend/src/schema/events.graphql` (`Event` type's existing `durableImageUrl: String` field, line 123); `apps/backend/src/schema/resolvers.ts` (all 6 confirmed `durableImageUrl` select sites plus the 7th, out-of-scope `instagramEmbedBySlug` one, and the existing `Event.imageUrl`/`Event.durableImageUrl` field resolvers, ~lines 4251–4257); `packages/domain/src/events/resolveServedImageUrl.ts` and its test file (current 3-line precedence, 12 lettered cases a–l); `packages/ui/src/features/events/EventListView.tsx`/`EventListView.types.ts`/`EventListView.test.tsx` (current `prominentPoster`/`imageFallbackUrl` derivation and the existing `durableImageUrl`-only prominent-card test); `apps/web/src/features/events/queries.graphql` (confirmed exactly 5 Event-type `durableImageUrl` selections plus 2 unrelated `InstagramEmbed`-type ones); `apps/web/src/features/events/mapper.ts` (current `imageFallbackUrl: event.durableImageUrl` mapping, line 163); `apps/web/src/features/events/EventDetailWrapper.tsx` (the separate related-events mini-card mapping, line 704, and confirmed it has no `prominentPoster` wiring at all); `apps/web/codegen.ts` (confirmed schema source is `../backend/src/schema/**/*.graphql`, documents `src/**/*.graphql`); Story 3.6n's full story file (as-built scope, the served-URL decision record, the Gate 1/2/3 findings it inherited and deferred to this story); `epics.md`'s Story 3.6n2 section (authoritative ACs this story is drafted from verbatim); Architecture Spine AD-28 (full text, especially Rules 6/7/8 and the 2026-10-03 "Served-URL clarification" sub-note); `epic-readiness/batch-cc-023-face-blur-audit-readiness.md` (Gate 1 Finding 2, Gate 3 Finding 3 — both named this story's exact scope and are cited, not re-derived, below).

### Architecture & UX Gate Findings

- **Gate 1 — cited from the batch readiness sweep, not re-run; no gap.** `epic-readiness/batch-cc-023-face-blur-audit-readiness.md` (`swept: true`, dated 2026-10-03, `gates: [1, 3]`) Finding 2 ("3.6n's read path is unowned") named exactly this story's scope: "The surface exists for `durableImageUrl`, so this is a missing field on existing types, not a new API layer." No new GraphQL type, no new resolver layer, no new infra — this story adds one field + one field resolver + 6 one-line select additions to an already-shipped, already-GraphQL-exposed `Event` type. No Gate 1 gap.
- **Gate 3 — cited from the same sweep; the one real finding is fully addressed by this story's own AC3, not deferred further.** Finding 3 ("`resolveServedImageUrl` is the named served-URL utility and 3.6n does not name it") is the exact reason this story's AC3 exists and was written with full precedence-table precision (including the two opted-in sub-cases) rather than a vague "extend the function" instruction. The served-URL privacy trade-off itself was already resolved as a user decision at Story 3.6n's creation (2026-10-03) — this story implements that decision, it does not make a new one. No other Gate 3 gap: no new foundational/cross-cutting dependency (i18n, analytics, app shell, GraphQL Code Generator pipeline) is touched or introduced — codegen is an existing, already-configured pipeline this story simply reruns.
- **Gate 2 — run fresh for this story's actual (post-split) scope, per the user's explicit instruction and `story-split-gate.md`'s "Gate 2 stays per-story" rule.** A one-shot Freya-persona evaluation was dispatched against this story's exact scope (GraphQL field exposure, the pure-function precedence extension, `EventListView.tsx`'s `prominentPoster` widening, `mapper.ts`'s `imageFallbackUrl` widening), with the full `EVENT-CARD-DESIGN.md` `event_card_masonry.image_prominent` token and `EXPERIENCE.md`'s "Masonry EventCard" `prominentPoster=true` composition pasted in as evidence. **Verdict: no gap.** No new component (EventCard's `image_prominent` slot/props are completely unchanged — only the upstream boolean's derivation widens); no new complex hook/util (`resolveServedImageUrl` is a pure function gaining one more candidate in already-tested precedence logic, with dedicated new test coverage already an explicit task, not left implicit); no UX-artifact-specified visual/interaction detail is missing from scope (`EVENT-CARD-DESIGN.md`/`EXPERIENCE.md` reserve no distinct "blurred" visual treatment — confirmed by a full-text grep of the Event-Card family token file for "blur"/"thumbnail"/"durableThumbnailUrl", no hits beyond this story's own planning references). This reconfirms the identical finding from the pre-split Gate 2 pass run at Story 3.6n's own creation (2026-10-03) against this same scope before the split.
  - Non-gating observation (carried forward for human UX awareness, not a split trigger): a blurred thumbnail and a full-quality `durableImageUrl` render through the visually identical `image_prominent` slot with no distinguishing badge/label — intentional per AD-28 Rule 7/8's own framing (the privacy mechanism is a backend concern, not a UI one), not an oversight.
- **No new prerequisite stories or further `sprint-status.yaml`/`epics.md` entries were added by this story.** The split itself (this story) and its dependency (Story 3.6n) already exist in both files from the 2026-10-03 session.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** No mismatch found. `posts.durable_thumbnail_url` (the underlying DB column) already exists, shipped by Story 3.6n (migration `0069_noisy_hairball.sql`, `review` status) — this story adds no DB migration of its own, only a GraphQL field + resolvers that read that already-existing column.
- **Impacted fields/contracts:** `events.graphql`'s `Event` type gains `durableThumbnailUrl: String` (nullable, matching the underlying nullable `text` column and the existing `durableImageUrl: String` field's own nullability). `packages/domain`'s `ResolveServedImageUrlInput` gains an optional `durableThumbnailUrl?: string | null` field. `apps/web`'s generated `graphql.ts` types gain `durableThumbnailUrl: string | null` wherever the 5 touched operations select it. `EventListViewItem` gains `durableThumbnailUrl?: string | null`.
- **Required DB migration changes:** None — the column already exists (Story 3.6n).
- **Required TypeScript type changes:** The ones listed above under "Impacted fields/contracts" — all additive (new optional fields/nullable GraphQL fields), no existing field's type narrows or changes shape.
- **Backward compatibility and rollout notes:** Purely additive at every layer. `resolveServedImageUrl`'s new input defaults to `null` when omitted, so all 12 pre-existing call sites/tests (which do not pass it) continue to compile and behave identically — confirmed as an explicit Task 3 verification step before any new test cases are added. The GraphQL field is nullable and additive — no existing query/mutation/field resolver changes shape or becomes non-nullable.
- **Verification checks:** Task 3's extended `resolveServedImageUrl.test.ts` (new lettered cases, full precedence table); Task 6's new `resolvers.test.ts` integration case (real DB, real resolver, confirming the field is actually wired end-to-end, not just the pure function in isolation); Task 6's new `EventListView.test.tsx` case; Task 7's full verification pass.

### Project Structure Notes

- Modified files (no new files): `apps/backend/src/schema/events.graphql`, `apps/backend/src/schema/resolvers.ts`, `packages/domain/src/events/resolveServedImageUrl.ts` (+ its `.test.ts`), `packages/ui/src/features/events/EventListView.tsx`, `packages/ui/src/features/events/EventListView.types.ts` (+ `EventListView.test.tsx`), `apps/web/src/features/events/queries.graphql`, `apps/web/src/features/events/mapper.ts`, `apps/web/src/generated/graphql.ts` (codegen output, regenerated not hand-edited). Optionally `packages/database/seed.ts` (Task 8, non-blocking).
- **Explicitly unchanged:** `packages/database/schema.ts` and every migration file (column already exists); `apps/backend/src/lib/ai-processor/**` (Story 3.6n's pipeline); `packages/ui/src/features/events/EventCard.tsx`/`EventCard.types.ts` (no new prop, confirmed by Gate 2); `apps/web/src/features/events/EventDetailWrapper.tsx` (its own separate related-events mapping, deliberately left unwidened — see Dev Notes); the 5 `apps/web` page/content files consuming `EventListView` (structural typing propagates the new field with no per-file change expected — confirmed, not assumed, per Task 5's own verification step).
- **Package boundary check:** no new package boundary question — every touched file already lives in its correct, established home (`apps/backend` for the GraphQL schema/resolvers, `packages/domain` for the pure precedence function, `packages/ui` for the shared list-view component, `apps/web` for the Next.js-specific query documents/mapper). No `packages/ui` component moves, no new `packages/domain` DB/Node coupling (this story's only `packages/domain` touch is a pure, framework-agnostic function gaining one more optional string input — no new dependency of any kind).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md`#Story 3.6n2] — authoritative ACs this story is drafted from verbatim.
- [Source: `_bmad-output/implementation-artifacts/3-6n-detect-and-blur-faces-in-extracted-post-images-generating-a-consent-independent-durable-thumbnail.md`] — full file read; the served-URL precedence decision record, the Gate 1/2/3 findings this story inherits/re-confirms, and confirmation that `posts.durableThumbnailUrl` is already populated and this story's only dependency.
- [Source: `_bmad-output/planning-artifacts/epic-readiness/batch-cc-023-face-blur-audit-readiness.md`] — `swept: true`; Finding 2 (Gate 1, cited, no gap) and Finding 3 (Gate 3, cited, addressed by AC3) quoted directly above.
- [Source: `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` AD-28] — full text (lines 1355–1491), especially Rule 7's card-render precedence and its 2026-10-03 "Served-URL clarification" sub-note, and Rule 6's consent-independence framing this story's resolver changes extend without altering.
- [Source: `_bmad-output/planning-artifacts/cc-024-multi-event-wave-plan.md`#Wave 4C] — batch sequencing context; confirms 3.6n2 is "the only Wave 4C story with frontend scope" and that Gate 2 stays per-story for this reason.
- [Source: `_bmad-output/implementation-artifacts/backlog.yaml`#FIND-070] — the independently-filed bug describing this exact gap, cross-referencing this same `sprint-status.yaml` key.
- [Source: `apps/backend/src/schema/events.graphql`, line 123] — the existing `durableImageUrl: String` field this story's new field sits beside.
- [Source: `apps/backend/src/schema/resolvers.ts`] — all 6 confirmed select sites (lines ~1695, ~3273, ~3361, ~3568, ~3695, ~4083) plus the 7th out-of-scope one (~3816) and the existing `Event.imageUrl`/`durableImageUrl` field resolvers (~4251–4257), confirmed by direct read, not by any story text.
- [Source: `packages/domain/src/events/resolveServedImageUrl.ts` + `.test.ts`] — current 3-line implementation and 12 lettered test cases (a–l), confirmed by direct read.
- [Source: `packages/ui/src/features/events/EventListView.tsx` (lines 84–101) + `EventListView.types.ts` + `EventListView.test.tsx` (line ~389)] — current `prominentPoster`/`imageFallbackUrl` derivation and existing durable-image-only prominent-card test, confirmed by direct read.
- [Source: `apps/web/src/features/events/queries.graphql`] — confirmed exactly 5 Event-type `durableImageUrl` selections (lines 11, 56, 208, 243, 279) and 2 unrelated `InstagramEmbed`-type ones (lines 165, 174).
- [Source: `apps/web/src/features/events/mapper.ts`, line 163; `EventDetailWrapper.tsx`, line 704] — the two `imageFallbackUrl` mapping sites, one in scope (AC5) and one deliberately out of scope (Dev Notes).
- [Source: `design-artifacts/UX-festgrid-run-1/EVENT-CARD-DESIGN.md` `event_card_masonry.image_prominent`; `EXPERIENCE.md` "Masonry EventCard" section] — full text loaded and passed to this story's own Gate 2 subagent pass; confirmed no distinct visual treatment exists or is specified for a thumbnail-driven vs. image-driven prominent card.

## Global Rules References

- [ ] `_bmad-output/project-context.md` — API Style (GraphQL, this story's only new surface is a field on an existing type); End-to-End Type Safety (GraphQL Code Generator regeneration, Task 5); Code Organization (`packages/domain`'s pure-function restriction — `resolveServedImageUrl`'s extension stays dependency-free, no DB/ORM/Node coupling added); `Query.events` per-row-cost discipline (AD-17 cross-reference — this story adds zero new per-row queries, only one more column in an already-batched select).
- [ ] `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order and status vocabulary followed.
- [ ] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-28 (this story's primary binding rule, specifically Rule 7's served-URL clarification, AC3); AD-12 (unchanged, `durableImageUrl`'s own behavior untouched).
- [ ] `docs/infrastructure/index.md` — no new infra; this story is pure application-layer GraphQL/resolver/frontend code, no new queue, Lambda, or infra resource.

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - `apps/backend/src/schema/events.graphql` (modify — new `durableThumbnailUrl: String` field)
  - `apps/backend/src/schema/resolvers.ts` (modify — new `Event.durableThumbnailUrl` field resolver; 6 select-site additions)
  - `packages/domain/src/events/resolveServedImageUrl.ts` (modify — new optional input, new precedence branch) + `resolveServedImageUrl.test.ts` (modify — new lettered cases)
  - `packages/ui/src/features/events/EventListView.tsx` (modify — `prominentPoster` widening) + `EventListView.types.ts` (modify — new optional field) + `EventListView.test.tsx` (modify — new test case)
  - `apps/web/src/features/events/queries.graphql` (modify — 5 operations gain the sibling field) + `apps/web/src/generated/graphql.ts` (regenerated, not hand-edited) + `mapper.ts` (modify — `imageFallbackUrl` widening)
  - `apps/backend/src/schema/resolvers.test.ts` (modify — new integration case)
  - Optional: `packages/database/seed.ts` (Task 8, non-blocking)
  - **Explicitly unchanged:** `packages/database/schema.ts`, every migration file, `apps/backend/src/lib/ai-processor/**`, `EventCard.tsx`/`EventCard.types.ts`, `EventDetailWrapper.tsx`, the 5 `apps/web` page/content files consuming `EventListView`.
- **Rule Mapping:**
  - AC1/AC2 (GraphQL field + 6 select sites) → Architecture Spine AD-28 Rule 7 (the field this story exposes); Gate 1 Finding 2 (cited, no gap — missing field on an existing type, not a new API layer).
  - AC3 (`resolveServedImageUrl` precedence) → Architecture Spine AD-28 Rule 7's served-URL clarification; Gate 3 Finding 3 (cited, addressed); the 2026-10-03 `AskUserQuestion` served-URL decision (implemented, not reopened).
  - AC4 (`EventListView.tsx` `prominentPoster` widening) → Architecture Spine AD-28 Rule 7; Gate 2 (run fresh this session, no gap).
  - AC5 (`apps/web` queries/mapper/codegen) → project-context.md's End-to-End Type Safety rule (GraphQL Code Generator).
  - AC6 (regression tests) → project-context.md's Testing Rules (100% coverage for the touched `packages/domain` function; testing-trophy integration coverage for `apps/backend`/`packages/ui`).
  - Data-type-compatibility persistent fact (mismatch/no-mismatch section always included) → Dev Notes "Data Type Compatibility & Migration Requirements" (no mismatch — column pre-exists).
  - `story-split-gate.md` Gate 1/2/3 discipline → Dev Notes "Architecture & UX Gate Findings" (Gate 1/3 cited from the batch sweep; Gate 2 run fresh this session via `runSubagent`, no gap).
  - `AskUserQuestion`-before-drafting persistent fact → no new, undecided, non-mechanical design tradeoff was found during this create-story session (the one real tradeoff, served-URL precedence, was already decided at Story 3.6n's creation and is explicitly not reopened here, per the user's own dispatch instructions); the `imageFallbackUrl`-widening-scope question was resolved by direct analysis (see Dev Notes), not left open, since it reduces to a provably-no-behavior-difference case rather than a genuine tradeoff.
- **Verification Plan:**
  - `TZ=UTC pnpm --filter domain test` — all `resolveServedImageUrl.test.ts` cases (a–l unchanged, m+ new) green; 100% coverage confirmed for the touched function.
  - `TZ=UTC pnpm --filter backend test` — Task 6's new integration case plus the full existing `apps/backend` suite green (same pre-existing FIND-063 failures expected, no new ones).
  - `pnpm --filter ui test` — `EventListView.test.tsx`'s new case plus full existing `packages/ui` suite green.
  - `pnpm --filter web codegen` regenerates cleanly; `pnpm --filter web build` clean.
  - `pnpm --filter backend lint` / `pnpm --filter domain lint` / `pnpm --filter ui lint` clean; builds clean for touched packages.
  - Manual diff review confirming no file outside this story's File Change Plan is touched (AC2's parenthetical scope boundary, the Dev Notes' deliberately-unwidened call sites).

## Pre-Coding Approval Gate

- [x] Scope confirmation — read-path only: GraphQL field + 6 resolver select sites + `Event` field resolver, `resolveServedImageUrl`'s extended precedence, `apps/web`'s mapper/codegen, `EventListView.tsx`'s `prominentPoster` widening. No pipeline, no DB migration, no new component, no new EventCard prop.
- [x] Architecture and boundary confirmation — all changes confined to `apps/backend` (schema/resolvers), `packages/domain` (pure function extension), `packages/ui` (existing shared component), `apps/web` (query documents/mapper/codegen); no package-boundary violation introduced.
- [x] Testing plan confirmation — unit tests for the new `resolveServedImageUrl` precedence branches; an integration test confirming the GraphQL field resolves end-to-end; a component-level test confirming `prominentPoster` widening; full regression on the pre-existing 12 `resolveServedImageUrl` call sites/tests.
- [x] Explicit human approval state — **approved** (AskUserQuestion, 2026-10-05, dev-story session). The served-URL precedence itself was already approved at Story 3.6n's creation (2026-10-03) and was not re-asked here; this story's own scope/plan was presented and approved before coding started.
- [x] Gate 1/2/3 prerequisites confirmed — Gate 1/3 cited from the swept batch readiness report (no gap); Gate 2 run fresh this session via `runSubagent` (no gap, two non-gating observations recorded). Story 3.6n (hard dependency) confirmed `review` status — built, its column populated — before this story was drafted.
- [x] Dependency confirmed done — Story 3.6n is `review` (not yet `done`, but per this project's standing rule — "Accept review-status prereqs" — a prerequisite at `review` with green tests/lint/build is safe to build against without waiting for `bmad-code-review`).

## Testing Requirements

- [ ] Unit tests (`packages/domain`, `node:test`, `TZ=UTC`): `resolveServedImageUrl.test.ts` — extend the existing 12-case (a–l) suite with new lettered cases (m+) covering every branch of the new 3-way precedence, including both opted-in sub-cases (durableImageUrl present vs. null) to confirm the thumbnail is never consulted on that branch.
- [ ] Integration tests (`apps/backend`, real DB, `TZ=UTC`): extend `resolvers.test.ts`'s existing `eventBySlug`/`durableImageUrl` test block with a non-opted-in + expired + thumbnail-only case, confirming both `durableThumbnailUrl` (raw) and `imageUrl` (resolved) return correctly end-to-end.
- [ ] Component test (`packages/ui`, Vitest): extend `EventListView.test.tsx` with a case confirming `prominentPoster` derives `true` from `durableThumbnailUrl` alone.
- [ ] Full regression: the existing `apps/backend`, `packages/domain`, and `packages/ui` suites stay green (per the user's test convention for this story: verify via `TZ=UTC`, scoped to these packages rather than a full monorepo batch-end gate).
- [ ] No E2E test required beyond the above — this is a data-plumbing change through already-covered UI surfaces, not a new user flow.

## Deliverables Checklist

- [ ] `events.graphql`'s `Event` type exposes `durableThumbnailUrl: String`, resolved correctly.
- [ ] All 6 confirmed `resolvers.ts` select sites project `posts.durableThumbnailUrl`.
- [ ] `resolveServedImageUrl` implements and tests the full 3-branch precedence (AC3), including both opted-in sub-cases.
- [ ] `EventListView.tsx`'s `prominentPoster` widens to include `durableThumbnailUrl`; `EventListView.types.ts` updated; new test added.
- [ ] `apps/web`'s 5 confirmed GraphQL operations select `durableThumbnailUrl`; codegen regenerated; `mapper.ts`'s `imageFallbackUrl` widened.
- [ ] Regression tests (domain, backend, ui) passing; no existing `resolveServedImageUrl` call site/test regresses.
- [ ] `git diff` confirms no file outside this story's File Change Plan is touched.

## Out of Scope

- `Query.instagramEmbedBySlug`'s own `durableImageUrl` select (~line 3816) and the `InstagramEmbed`/`InstagramEmbedBySlug` GraphQL types' `durableImageUrl` field — a structurally different field on a different type (Story 3.7e's scope), never `Event.durableThumbnailUrl`. Not touched by this story.
- `EventCard.tsx`/`EventCard.types.ts` — no new prop, no new variant; confirmed unchanged by this story's own Gate 2 pass.
- `EventDetailWrapper.tsx` line 704's own "related events" mini-card `imageFallbackUrl` mapping — deliberately left unwidened, same reasoning as `EventListView.tsx`'s own unwidened `imageFallbackUrl` (see Dev Notes).
- Any new visual/badge treatment distinguishing a blurred thumbnail from a sharp durable image in the `image_prominent` slot — explicitly not specified anywhere in `EVENT-CARD-DESIGN.md`/`EXPERIENCE.md`, confirmed by this story's Gate 2 pass; AD-28 Rule 7/8 frame this as an intentional backend-only concern.
- Story 3.6n's own pipeline scope (face detection, blur, resize, upload, the `posts.durableThumbnailUrl` migration, the once-per-post run point, the timeout guard, the `extraction_audit_logs` backfill) — already shipped, `review` status, this story's hard dependency, not re-touched.
- Story 3.6o's relevance/expiry skip gate and its `extraction_audit_logs` outcome — independent of this story, already shipped, `review` status.
- The optional `packages/database/seed.ts` fixture (Task 8) is non-blocking manual-QA scope, not required for AC/Definition-of-Done satisfaction.

## Definition of Done

- [ ] AC1–AC6 satisfied.
- [ ] Task 6's unit, integration, and component tests passing; full existing `packages/domain`, `apps/backend`, and `packages/ui` suites green (per this story's stated test convention — `TZ=UTC`, scoped to these packages).
- [ ] Lint and type checks passing for `apps/backend`, `packages/domain`, `packages/ui`, and the touched `apps/web` files.
- [ ] `pnpm --filter web codegen` regenerates cleanly with the expected new field, no unexpected diff.
- [ ] No regression in any of the 12 pre-existing `resolveServedImageUrl` call sites/tests.
- [ ] Dev Notes record the actual precedence implementation as shipped (confirming it matches AC3's 3-branch spec exactly) and any deviation explained.
- [ ] No file outside this story's File Change Plan touched (confirmed via `git diff`).

## Completion Status

- [ ] In progress

## Dev Agent Record

### Agent Model Used

_To be filled by the dev agent during implementation._

### Debug Log References

_To be filled by the dev agent during implementation._

### Completion Notes

_To be filled by the dev agent during implementation._

### File List

- `apps/backend/src/schema/events.graphql` (modified — `Event.durableThumbnailUrl: String`)
- `apps/backend/src/schema/resolvers.ts` (modified — new field resolver, 6 select-site additions, `Event.imageUrl` resolver now passes `durableThumbnailUrl` through)
- `packages/domain/src/events/resolveServedImageUrl.ts` (modified — new optional input, new 3-branch precedence)
- `packages/domain/src/events/resolveServedImageUrl.test.ts` (modified — new lettered cases (m)–(s))
- `packages/ui/src/features/events/EventListView.types.ts` (modified — `EventListViewItem.durableThumbnailUrl?`)
- `packages/ui/src/features/events/EventListView.tsx` (modified — `prominentPoster` widened)
- `packages/ui/src/features/events/EventListView.test.tsx` (modified — new thumbnail-only prominent-card test)
- `apps/web/src/features/events/queries.graphql` (modified — 5 Event-type operations gain sibling field)
- `apps/web/src/generated/graphql.ts` (regenerated via `pnpm --filter web codegen`, not hand-edited)
- `apps/web/src/features/events/mapper.ts` (modified — `imageFallbackUrl` widened)
