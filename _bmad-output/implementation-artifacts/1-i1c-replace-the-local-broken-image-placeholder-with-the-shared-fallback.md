# Story 1.i1c: Replace the local broken-image placeholder with the shared fallback

## Story Details

- Epic: 1.i1 (One card primitive for every event-card image slot and badge)
- Story ID: 1.i1c
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want `EventCard`'s `!imgError && imageUrl` else-branch — today a muted box reading "No image available" — replaced by a reserved-but-blank fallback,
so that an expired hotlink shows nothing rather than placeholder text (FIND-023).

This is a **minimal, surgical fix confined to `EventCard.tsx`** (user-confirmed scope, 2026-09-13 — see Dev Notes). It does **not** import or adopt `EventCardMediaSlot`/`EventCardFavoriteBadge` from Story 1.i1a's primitive, does **not** move or resize the existing top-right favorite-toggle button, and does **not** touch `WeeklyCalendarView.tsx` (a separate component, `CalendarCard`, never renders `EventCard` — confirmed by repo-wide grep). Full primitive adoption for the masonry default state is Story 1.i1e's scope; the calendar row is Story 1.i1d's scope (a wholly new surface). This story only removes the placeholder text/icon from the one else-branch shared by every `EventCard` variant/state today.

## Acceptance Criteria

1. **Given** an event whose `imageUrl` is absent, or whose hotlinked image fails to load (`onError` fires) at any point after mount, **when** `EventCard` renders in `variant="standard"` (`h-48` footprint) or `variant="masonry"` (`aspect-[3/4]` when `prominentPoster` is false/omitted, `aspect-[2/3]` when true), **then** the image area renders with no placeholder text, no icon, and no fill distinct from the wrapper's existing `bg-muted` background — occupying its exact current footprint for that variant/`prominentPoster` combination, with no reflow when the image transitions from loaded to errored.
2. **Given** the fallback renders, **when** inspected, **then** no new focusable element or accessible-name node is introduced by the fallback branch itself — the card's existing favorite-toggle button (unchanged position/size, unaffected by this story) remains the only interactive element in that region. This is a decorative empty slot, consistent with AD-15 Rule 2's "reserved-blank, not placeholder" contract and Story 1.i1a's AC3 precedent (the primitive's own blank state introduces no separate label for the image area itself).
3. **Given** `EventCardLabels`/`EventCardProps`, **when** this story ships, **then** `imageFallbackAlt` is removed from the `EventCardLabels` interface and from `EventCard.tsx`'s `defaultLabels` merge (confirmed zero external consumers via repo-wide search — no `apps/web` locale key, no other component reads or overrides it), and the now-unused `fallbackAlt` local derivation (`const fallbackAlt = defaultLabels.imageFallbackAlt`) is removed from `EventCard.tsx`.
4. **Given** the existing `EventCard.test.tsx` suite, **when** this story ships, **then** the two tests currently asserting `getByText('No image available')` (`'handles image error fallback'`, `'renders no-imageUrl fallback immediately'`) are rewritten to assert that text's absence instead, and new test coverage is added for `variant="masonry"` under both `prominentPoster={true}` and `prominentPoster={false}` (or omitted), each confirming: no placeholder text/icon renders, and the wrapper `div`'s variant-appropriate sizing class (`aspect-[3/4]` / `aspect-[2/3]`) is still present and unchanged.

## Tasks / Subtasks

- [ ] Task 1 — Strip the placeholder fallback in `EventCard.tsx` (AC1, AC2, AC3)
  - [ ] 1.1 Replace the else-branch (currently `<div className="flex flex-col items-center justify-center text-muted-foreground"><span className="text-sm font-medium">{fallbackAlt}</span></div>`) with `null` — render nothing when `!imgError && imageUrl` is false. Leave the wrapper `div`'s own className (variant/`prominentPoster`-driven height/aspect classes, `bg-muted`, `flex items-center justify-center`) exactly as-is; it already reserves the correct footprint regardless of child content (AC1). The now-vestigial `flex items-center justify-center` centering classes on the wrapper need no change — they are harmless once the child is `null` and Story 1.i1e will replace this block wholesale when it restructures the masonry default state.
  - [ ] 1.2 Remove the `const fallbackAlt = defaultLabels.imageFallbackAlt;` line (dead once 1.1 lands) (AC3).
  - [ ] 1.3 Remove `imageFallbackAlt: 'No image available',` from the `defaultLabels` object literal (AC3).
  - [ ] 1.4 Do **not** touch: the favorite-toggle button block (lines ~178-201, `EventCard.tsx`'s current top-right absolute button — Story 1.i1b's scope, already shipped), the masonry date-badge overlay block, the `statusBadge` overlay slot, or any caption/badge-row content below the image wrapper.
- [ ] Task 2 — Remove the dead label from the type contract (AC3)
  - [ ] 2.1 Remove `imageFallbackAlt?: string;` from `EventCardLabels` in `EventCard.types.ts`.
- [ ] Task 3 — Update and extend `EventCard.test.tsx` (AC4)
  - [ ] 3.1 Rewrite `'handles image error fallback'`: after `fireEvent.error(img)`, assert `screen.queryByText('No image available')` is `null`/not in the document, assert no `img` role remains, and assert the wrapper `div` (query by its known class, e.g. via `container.querySelector`) still carries its original `h-48` class (using `defaultProps`, i.e. `variant="standard"` by default) — proving no reflow.
  - [ ] 3.2 Rewrite `'renders no-imageUrl fallback immediately'` the same way for the no-`imageUrl` case.
  - [ ] 3.3 Add `'renders a blank, correctly-sized fallback on masonry with prominentPoster=false'`: render with `variant="masonry"` and no `imageUrl`; assert no placeholder text/icon, and the wrapper carries `aspect-[3/4]`.
  - [ ] 3.4 Add `'renders a blank, correctly-sized fallback on masonry with prominentPoster=true'`: same, with `prominentPoster` true; assert the wrapper carries `aspect-[2/3]` instead.
  - [ ] 3.5 Confirm no test in the file still references `imageFallbackAlt` as a label override (grep the file after edits).
- [ ] Task 4 — Verification (all ACs)
  - [ ] 4.1 Run `pnpm --filter @festgrid/ui test`, `pnpm --filter @festgrid/ui lint`, `pnpm --filter @festgrid/ui build` (or `tsc --noEmit` equivalent) and record results in Dev Agent Record.
  - [ ] 4.2 Confirm the pre-existing `EventCardMediaPrimitives.test.tsx` suite (Story 1.i1a) and `EventCard.test.tsx`'s other, unrelated tests still pass unmodified — proving no accidental coupling.

## Dev Notes

### Architecture & UX Gate Findings

- **Gate 1 (Architecture/Infra Completeness) — No gap found.** Sourced from `_bmad-output/planning-artifacts/epic-readiness/epic-1-i1-readiness.md` (swept: true, 2026-09-13), which ran Gate 1 epic-wide across all of Epic 1.i1's stories: no DB/ORM/domain call from `apps/web`/a UI package, no external-service call from the frontend, no new API surface, no auth/secrets/business rules in frontend code, no infra requiring IaC. This story is an even narrower subset — deleting one JSX branch and one unused type field in `packages/ui`. Lightweight guard: nothing about this story's actual scope introduces a new external service, data entity, or infra dependency the epic-wide sweep didn't anticipate — no fresh Gate 1 run warranted.
- **Gate 2 (UI Complexity & Reusability) — run fresh per story-split-gate.md's per-story requirement.** Dispatched to a Freya-persona subagent against this story's exact draft scope and two candidate approaches: (A) minimal surgical strip of the placeholder text/icon only, leaving favorite-badge position and DOM shape untouched, vs. (B) importing/adopting `EventCardMediaSlot` now. **Verdict: no split — Option A.** `EventCardMediaSlot`'s two `layout` values (`flex-fill`, `fixed-square`) do not structurally match either of `EventCard`'s current wrapper shapes (self-sized `aspect-[2/3]`/`aspect-[3/4]`/`h-48`, not a flex-sized sibling of a date box); forcing literal adoption now would mean either faking a layout value that doesn't fit or pre-empting Story 1.i1e's restructuring — scope creep into work explicitly owned by 1.i1d/1.i1e. The subagent's flagged gaps (a11y treatment of the now-textless fallback; the dead `imageFallbackAlt` prop; missing masonry-variant test coverage; both are resolved by AC2/AC3/AC4 and Tasks 2-3 above) are folded into this story rather than left open.
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness) — No gap found.** Sourced from the same swept `epic-1-i1-readiness.md`: no i18n/analytics/global-shell/codegen dependency is implicated. Removing `imageFallbackAlt` actively *simplifies* the i18n surface (one fewer string to translate), matching the readiness report's own anticipation (item 4: "no new text strings requiring i18n... removing 'No image available' simplifies the i18n surface, if anything").

### User-Resolved Design Decisions (AskUserQuestion, 2026-09-13)

- **Scope: minimal surgical strip, confirmed.** Two paths were possible: (a) strip the placeholder text/icon only, touching nothing else in `EventCard.tsx`, or (b) go further now and adopt `EventCardMediaSlot`/reposition the favorite badge into the slot. **User selected (a)** — matching the Gate 2 subagent's independent recommendation. The favorite-badge repositioning ("large favorite badge centered in the blank slot") that `AD-15` Rule 2 and `DESIGN.md`'s `thumbnail_default_fallback`/`event_card_compact_thumbnail_fallback` describe remains explicitly deferred to Stories 1.i1e (masonry default state) and 1.i1d (calendar row) — see "AD-15 Rule 2 scope note" below for why this is not a partial/incomplete AD-15 implementation.
- **`imageFallbackAlt` removal, confirmed.** Repo-wide grep found zero consumers of `EventCardLabels.imageFallbackAlt` outside `EventCard.tsx` itself (no `apps/web` locale key, no other component override, no test relying on a custom value). **User selected removing it** from `EventCardLabels`/`EventCardProps` entirely (AC3/Task 2) rather than leaving it as harmless dead code, on the grounds of zero breakage risk and matching the readiness report's own framing that this change simplifies the i18n surface.

### AD-15 Rule 2 scope note (important — read before implementing)

`_bmad-output/planning-artifacts/festgrid-architecture-spine.md`'s `### AD-15: Event Card Media Primitive` (added by Story 1.i1a) lists this story under its "Binds" clause ("1.i1c replaces its broken-image fallback") and its Rule 2 describes the *primitive's* full fallback contract: "Fallback is reserved-blank, not a placeholder... Only the large favorite badge (rule 3) renders, centered in the slot's place." Rule 2's "Enforced by" line cites `EventCardMediaPrimitives.test.tsx` (Story 1.i1a's own test file) — **not** `EventCard.test.tsx` — confirming Rule 2 describes the primitive's shipped-dark contract, not a per-adopter requirement each consuming story must fully satisfy before its dependency chain finishes. This story (1.i1c) satisfies Rule 2's "no placeholder text/icon" half on `EventCard.tsx`'s surface; the "large favorite badge centered in the slot" half stays not-yet-adopted here — the existing top-right favorite button is untouched and stays exactly where it is regardless of image state, until Story 1.i1e (masonry) and Story 1.i1d (calendar row, a new surface) each adopt the primitive fully on their own surfaces. Full cross-surface compliance is what Story 1.i1z's CI ratchet ultimately enforces, not this story alone.

### Dependency Readiness Note

- This story depends on Story 1.i1a (per epics.md). `sprint-status.yaml` correctly shows `1-i1a-...: review` and `1-i1b-...: review` at the time this story was drafted, matching both story files' own `## Story Details` (`Status: review`) and confirmed merged via `git log` (`7bf9926` "implement Story 1.i1a...", `de9f3c6` "implement Story 1.i1b..."). `EventCardMediaPrimitives.tsx`, `EventCardMediaPrimitives.types.ts`, `event-card-media-tokens.ts` all exist in the tree today, and `EventCard.tsx` already imports `eventCardBadgeIconSizeClass` from Story 1.i1b's shipped change. This story is safe to implement against the current tree now. (Earlier in this same story-creation session, before 1.i1b's `bmad-code-review` pass landed, `sprint-status.yaml` transiently showed both as stale `backlog` — noted here only because it was directly observed mid-session, not because it still applies.)

### Technical Constraints

- Files touched: `packages/ui/src/features/events/EventCard.tsx`, `packages/ui/src/features/events/EventCard.types.ts`, `packages/ui/src/features/events/EventCard.test.tsx`. No other file in this story's scope is modified — in particular, **not** `EventCardMediaPrimitives.tsx`, `event-card-media-tokens.ts`, `WeeklyCalendarView.tsx`, or the architecture spine (AD-15 already fully describes this story's role; no edit needed).
- The wrapper `div`'s existing className (`relative ${variant==='masonry' ? (prominentPoster ? 'aspect-[2/3]' : 'aspect-[3/4]') : 'h-48'} w-full bg-muted overflow-hidden flex items-center justify-center`) already satisfies AD-15 Rule 1 ("slot dimensions come from the surrounding chrome, never the image") today — it does not depend on `EventCardMediaSlot`'s `layout` prop to do so, since its size is already variant/`prominentPoster`-driven and independent of image content.
- `PostCard.tsx`/`PostCard.types.ts` has its own separate, identically-named `imageFallbackAlt` convention (`packages/ui/src/features/posts/`) — a different component, different props type, explicitly out of scope here. Do not touch it.

### Data Type Compatibility & Migration Requirements

- Compatibility finding: No DB/GraphQL mismatch. One narrowing change to an existing frontend-only TypeScript interface: `imageFallbackAlt?: string` is removed from `EventCardLabels` (`packages/ui/src/features/events/EventCard.types.ts`).
- Impacted fields/contracts: `EventCardLabels`/`EventCardProps` (packages/ui, presentational only) — no DB columns, no GraphQL fields/resolvers/schema touched.
- Required DB migration changes: No changes required — no persistence layer touched.
- Required TypeScript type changes: Remove `imageFallbackAlt?: string;` from `EventCardLabels`. This is a narrowing (field removal) to an already-optional prop; repo-wide grep (see above) confirms zero call sites pass this key today, so no other file requires a corresponding update. `tsc --noEmit` across `packages/ui` and `apps/web` after the change is the verification that nothing else referenced it.
- Backward compatibility and rollout notes: Removing an optional prop that TypeScript call sites never populated is source-compatible for every existing caller (no caller will fail to compile) and behavior-compatible (the label was already only used to render text this story is deleting). No consumer-facing API surface outside this package is affected.
- Verification checks: `tsc --noEmit` (or `pnpm --filter @festgrid/ui build`) confirms no remaining reference to `imageFallbackAlt` anywhere in the monorepo; Task 3's rewritten/added tests confirm the rendered-output behavior end-to-end.

### Project Structure Notes

- Alignment with unified project structure: All changes stay within `packages/ui/src/features/events/` (Domain Features location, unchanged) — no new files, no relocation.
- No `packages/domain` involvement: pure presentational JSX/type removal, no business logic.
- Detected conflicts or variances: None.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.i1c] (and sibling Stories 1.i1a, 1.i1b, 1.i1d, 1.i1e, 1.i1z for shared epic context)
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-1-i1-readiness.md] (Gate 1 + Gate 3 sweep, swept: true)
- [Source: _bmad-output/implementation-artifacts/1-i1a-extend-the-shared-event-card-primitive-to-own-thumbnail-sizing-and-fallback.md] (primitive this story's fallback concept aligns with; AC3/AD-15 Rule 2 precedent for "no separate a11y label on a decorative blank slot")
- [Source: _bmad-output/implementation-artifacts/1-i1b-tie-the-favorite-icon-size-to-the-date-badge-token.md] (precedent for the surgical-swap-over-full-adoption scoping pattern, and for documenting a stale `sprint-status.yaml` dependency entry without correcting it as a side effect)
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-15] (Binds/Rule 2 — this story's exact role and the "not a per-adopter requirement yet" nuance)
- [Source: packages/ui/src/features/events/EventCard.tsx] (current broken-image fallback, lines ~230-241 — the exact block this story edits; current favorite-button block, lines ~178-201 — untouched)
- [Source: packages/ui/src/features/events/EventCard.types.ts] (`EventCardLabels.imageFallbackAlt`, line 4 — removed by this story)
- [Source: packages/ui/src/features/events/EventCard.test.tsx] (existing fallback tests, lines ~173-192 — rewritten by this story)
- [Source: design-artifacts/UX-festgrid-run-1/DESIGN.md#event_card_masonry.thumbnail_default_fallback, #event_card_compact_thumbnail_fallback] ("the same detection `EventCard.tsx`'s existing `!imgError && imageUrl` branch already does" — confirms this branch is the correct, already-identified target)
- [Source: design-artifacts/UX-festgrid-run-1/EXPERIENCE.md#Masonry EventCard Badge Row (Accessibility Floor)] ("Reserved space, not reflow" — AC1's no-reflow requirement)

## Global Rules References

- [x] `_bmad-output/project-context.md` — UI Components & Scalability rule (Domain Features → `packages/ui/src/features/<domain>/`, unchanged); Locale-Sensitive Data Rendering rule (not applicable — no new user-facing text is added, one is removed).
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — this file's section order/status vocabulary.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-15 (this story implements part of its Binds/Rule 2, no new AD needed; see AD-15 Rule 2 scope note above).
- [x] `docs/infrastructure/index.md` — consulted; not applicable, this story touches no backend compute, queues, EventBridge/cron, API Gateway, or database provisioning.

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - Modify: `packages/ui/src/features/events/EventCard.tsx` (strip placeholder fallback JSX; remove `fallbackAlt`/`imageFallbackAlt` default)
  - Modify: `packages/ui/src/features/events/EventCard.types.ts` (remove `imageFallbackAlt?: string;` from `EventCardLabels`)
  - Modify: `packages/ui/src/features/events/EventCard.test.tsx` (rewrite 2 existing tests, add 2 new masonry-variant tests)
  - **Not touched:** `EventCardMediaPrimitives.tsx`, `EventCardMediaPrimitives.types.ts`, `event-card-media-tokens.ts`, `WeeklyCalendarView.tsx`, `festgrid-architecture-spine.md` — reserved for Stories 1.i1d/1.i1e or already correct as shipped by 1.i1a.
- **Rule Mapping:**
  - AD-15 Rule 1 (chrome-driven sizing) → already satisfied by the untouched wrapper className; AC1.
  - AD-15 Rule 2 ("reserved-blank, not placeholder") → AC1/AC2, Task 1; partial-adoption nuance documented in Dev Notes.
  - i18n-surface simplification (readiness report item 4) → AC3, Task 2 (`imageFallbackAlt` removal).
  - Testing Philosophy (project-context.md — integration/component tests, testing-trophy approach) → AC4, Task 3.
- **Verification Plan:**
  - `pnpm --filter @festgrid/ui test` — rewritten/new `EventCard.test.tsx` cases pass; `EventCardMediaPrimitives.test.tsx` and all other existing `EventCard.test.tsx` cases remain green (proving no accidental coupling).
  - `pnpm --filter @festgrid/ui lint` — 0 errors.
  - `pnpm --filter @festgrid/ui build` (or `tsc --noEmit`) — clean, confirms no remaining reference to the removed `imageFallbackAlt` field anywhere in the monorepo.
  - Manual/visual spot-check (no automated visual regression exists in this repo): render `EventCard` with a broken `imageUrl` in `standard` and both masonry `prominentPoster` states; confirm a blank `bg-muted` box with no text/icon, matching FIND-023's intent.

## Pre-Coding Approval Gate

- [ ] Scope confirmation — minimal surgical fix confined to `EventCard.tsx`/`.types.ts`/`.test.tsx`; no primitive import, no favorite-badge repositioning, no `WeeklyCalendarView.tsx` changes (user-confirmed 2026-09-13).
- [ ] Architecture and boundary confirmation — stays within `packages/ui/src/features/events/`; AD-15 Rule 2's "large badge centered" half deliberately deferred to Stories 1.i1d/1.i1e (documented in Dev Notes, not silently dropped).
- [ ] Testing plan confirmation — Task 3's rewritten/new tests, plus lint/build per Task 4.
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted — Gate 1 & Gate 3: no gap (`epic-1-i1-readiness.md`, swept). Gate 2: no split; scope (surgical strip) and `imageFallbackAlt` removal both user-resolved via AskUserQuestion (2026-09-13).

## Testing Requirements

- [ ] Integration/component tests (Vitest + Testing Library) — `EventCard.test.tsx` rewritten/extended per Task 3, covering AC1-AC4.
- [ ] E2E tests — Not applicable. This is a presentational fallback-rendering change inside an already-shipped, already-E2E-exercised component; no new user flow is introduced. Existing E2E coverage of pages rendering `EventCard` (if any) is unaffected since the change only alters what renders inside an already-reserved image slot.

## Deliverables Checklist

- [ ] `EventCard.tsx` — placeholder fallback branch replaced with `null`; `fallbackAlt`/`imageFallbackAlt` default removed
- [ ] `EventCard.types.ts` — `imageFallbackAlt` removed from `EventCardLabels`
- [ ] `EventCard.test.tsx` — 2 existing tests rewritten, 2 new masonry-variant tests added

## Out of Scope

- Adopting `EventCardMediaSlot`/`EventCardFavoriteBadge` into `EventCard.tsx` (Story 1.i1e, masonry default state restructuring).
- Repositioning/resizing the favorite-toggle button, or introducing the large-centered favorite-badge fallback treatment (Story 1.i1e).
- `WeeklyCalendarView.tsx`'s compact-row thumbnail/fallback (Story 1.i1d) — a wholly separate component (`CalendarCard`), never `EventCard`.
- The repo-wide CI ratchet sweep test (Story 1.i1z).
- No Gate-1/3 deferred scope exists for this story (both reported no gap, per `epic-1-i1-readiness.md`).

## Definition of Done

- [ ] AC1-AC4 satisfied.
- [ ] `EventCard.test.tsx` passing (rewritten + new cases); `EventCardMediaPrimitives.test.tsx` and all other existing suites still passing unmodified.
- [ ] Lint and type checks passing for `packages/ui` (and `apps/web`, confirming no external `imageFallbackAlt` consumer was missed).
- [ ] No new placeholder text/icon anywhere in `EventCard.tsx`'s image-fallback path.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
