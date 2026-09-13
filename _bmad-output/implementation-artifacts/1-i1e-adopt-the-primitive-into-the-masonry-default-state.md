# Story 1.i1e: Adopt the primitive into the masonry default state

## Story Details

- **Epic:** 1.i1 — One card primitive for every event-card image slot and badge
- **Story ID:** 1.i1e
- **Status:** ready-for-dev

## Story

**As a** developer,
**I want** `prominentPoster=false` to move its date box out of the poster overlay and beside a small thumbnail sized to the date box's own height, with the TILL badge repositioned and recolored,
**So that** an expired image degrades gracefully instead of leaving a broken overlay on an empty poster (IDEA-017).

## Acceptance Criteria

1. **Given** `EventCard` with `variant="masonry"` and `prominentPoster=false`,
   **When** it renders,
   **Then** the date box (`EventCardDateBox`) sits beside a thumbnail (`EventCardMediaSlot`, `layout="flex-fill"`) sized to the date box's own intrinsic height — both rendered via the shared `event_card_*` primitive, not local markup — and the thumbnail carries the same image/reserved-blank-fallback behavior already shipped by Story 1.i1a (no placeholder text/icon, no reflow on error).

2. **Given** `prominentPoster=true`,
   **When** it renders,
   **Then** the full-width-poster treatment (image aspect ratio, the `base` overlay date box, the outer top-right favorite button) is unchanged from what Story 1.3b/1.i1b/1.i1c already shipped — this story does not touch that branch's structure, only the TILL badge's shared styling (AC3).

3. **Given** an eligible TILL badge (the existing "started" gate and text rules from AC14 are unchanged — see AC6),
   **When** it renders,
   **Then** it anchors to the date box's top-left corner in the new solid-amber treatment (`bg-amber-700 text-white`, per `DESIGN.md`'s `event_card_till_badge.base`) — **in both `prominentPoster` states**, replacing the old bottom-center/neutral (`bg-foreground text-background`) styling everywhere it appears, not only on the new default-state composition. *(User-confirmed 2026-09-13 — see Dev Notes; DESIGN.md/EXPERIENCE.md specify this as one shared token used by both states, and no other story in the epic touches the TILL badge, so leaving `prominentPoster=true`'s badge on the old styling would be a permanent, untracked drift from the design spec.)*

4. **Given** `prominentPoster=false` and a favorite-toggle handler is provided,
   **When** the card renders,
   **Then** exactly one live, focusable favorite-toggle control exists on the card (`EventCardMediaSlot`'s corner or large-fallback badge, per Story 1.i1a) — the card's separate outer top-right favorite button (used by `standard` and `prominentPoster=true`) is **not** rendered for this state, satisfying AD-15 Rule 4 ("the favorite badge is always one live control... never an extra independent focus stop").

5. **Given** `prominentPoster=false`,
   **When** a user tabs through the card,
   **Then** the favorite-toggle control's position in the DOM/tab order relative to the card's click-to-navigate root matches today's existing convention (the favorite control is reached *before* the navigate-to-event control, exactly as the current outer top-right button already is for `standard`/`prominentPoster=true`) — no new/different tab-order rule is introduced by this state.

6. **Given** `prominentPoster=false`,
   **When** a user clicks anywhere on the thumbnail's image area (outside the favorite-toggle control itself),
   **Then** the card still navigates via `RootTag`'s existing `href`/`onClick` exactly as it does today for the full-width poster — the thumbnail remains part of the clickable/navigable region; it is not demoted to a non-interactive, unclickable sibling area.

7. **Given** the TILL badge's existing eligibility logic (AC14's "started" gate, the `endDayDiff` bare-"till"/`"till hh:mm"`/no-badge branching),
   **When** this story's restyle (AC3) is implemented,
   **Then** that gating/text logic is unchanged — only the badge's CSS classes (position + color) change, never its render-or-not condition or its text content rules.

8. **Given** the caption's `badge_row` (status badge, nearby badge) below the top row,
   **When** either `prominentPoster` state renders,
   **Then** `badge_row`'s position, tokens, and content are unaffected by this story's restructuring of the row above it.

## Tasks / Subtasks

- [ ] **Task 1: Extend `EventCardMediaSlot` additively so a caller can compose its own external favorite control** (AC4, AC6)
  - [ ] 1.1 Add optional `hideFavoriteBadge?: boolean` (default `false`) to `EventCardMediaSlotProps`. When `true`, suppress the slot's own internal `EventCardFavoriteBadge` rendering in **both** branches (image-present corner badge and reserved-blank-fallback large badge) — the slot renders only the image/blank content.
  - [ ] 1.2 Add optional `onImagePresenceChange?: (imagePresent: boolean) => void` to `EventCardMediaSlotProps`, invoked (e.g. via a `useEffect` keyed on the slot's internal `imagePresent = !!imageUrl && !imgError`) whenever that value changes — including the initial mount value — so an external caller composing its own favorite badge knows which scale (`'default'` vs `'large'`) applies.
  - [ ] 1.3 Update `EventCardMediaPrimitives.types.ts` with both new optional props and their doc comments (mirror the existing prop-doc style in that file).
  - [ ] 1.4 Extend `EventCardMediaPrimitives.test.tsx`: `hideFavoriteBadge` suppresses the internal badge in both branches even when `onFavoriteToggle` is provided; `onImagePresenceChange` fires `true` on mount with a valid `imageUrl`, `false` with no `imageUrl`, and flips to `false` after the `<img>`'s `onError` fires.
  - [ ] 1.5 Confirm every existing caller (this file's own tests, Story 1.i1d's `WeeklyCalendarView.tsx` adoption) is unaffected — both new props are optional and default to today's exact behavior when omitted.

- [ ] **Task 2: Restructure `EventCard.tsx`'s masonry branch for `prominentPoster=false`** (AC1, AC4, AC5, AC6, AC8)
  - [ ] 2.1 For `variant === 'masonry' && !prominentPoster` only, replace the current `aspect-[3/4]` image wrapper with the `top_row_default` composition: a `relative flex items-stretch gap-2` row (the `relative` preserves `statusBadge`'s existing absolute-overlay contract, AC8) containing `EventCardDateBox` (wrapping the existing `formatShortEventDateTime` + conditional Clock-icon content, unchanged logic) beside `EventCardMediaSlot layout="flex-fill" hideFavoriteBadge onImagePresenceChange={...}`.
  - [ ] 2.2 Track new local state (e.g. `defaultThumbnailImagePresent`), seeded from `!!imageUrl`, updated via `onImagePresenceChange` — local component state only, not Server/URL/Global (see Global Rules References).
  - [ ] 2.3 Render `EventCardFavoriteBadge` (imported standalone, exactly as Story 1.i1b already does for the icon-size token) as a **DOM sibling of `RootTag`**, gated on `onFavoriteToggle` exactly like today's outer button, at the **same DOM position** today's outer button occupies (a direct child of `<article>`, immediately before `RootTag` — this is what makes AC5's tab-order requirement hold with no new logic). See the "Favorite-Badge Sibling Positioning" guardrail below for the exact `scale`/positioning-class mechanics.
  - [ ] 2.4 Suppress today's existing outer top-right favorite `<button>` specifically when `variant === 'masonry' && !prominentPoster` — it must remain byte-for-byte unchanged for `standard` and for `masonry && prominentPoster`.
  - [ ] 2.5 Leave `prominentPoster=true`'s entire branch (full-width poster, `base` date-box overlay, outer top-right button) untouched except the TILL-badge restyle (Task 3).

- [ ] **Task 3: Restyle/reposition the TILL badge for both `prominentPoster` states** (AC3, AC7)
  - [ ] 3.1 Change the TILL badge's className from `absolute -bottom-1.5 left-1/2 -translate-x-1/2 z-20 px-1.5 py-0.5 rounded-full bg-foreground text-background text-[10px] font-semibold leading-none shadow-sm whitespace-nowrap` to `absolute -top-1.5 -left-1.5 z-20 px-1.5 py-0.5 rounded-full bg-amber-700 text-white text-[10px] font-semibold leading-none shadow-sm whitespace-nowrap` (`DESIGN.md` § `event_card_till_badge.base`) — apply via one shared fragment/constant consumed by both the `prominentPoster=true` `base` overlay and the new `base_default`/`EventCardDateBox` composition, rather than duplicating the class string by hand in two places (avoids future drift, mirrors how `formatShortEventDateTime`/Clock-icon content is already shared).
  - [ ] 3.2 Do **not** change `tillBadgeText`'s computation (the `started` gate, `endDayDiff` branching) — style/position only (AC7).
  - [ ] 3.3 Confirm the date box's container remains a valid positioning root for the badge's negative-offset corner anchor in both cases: `base` (prominentPoster=true) is itself `absolute`, already a containing block; `EventCardDateBox`'s primitive class already includes `relative` (see `EventCardMediaPrimitives.tsx`), so no additional class is needed there.

- [ ] **Task 4: Update `EventCard.test.tsx`** (all ACs)
  - [ ] 4.1 Rewrite `'renders a blank, correctly-sized fallback on masonry with prominentPoster=false'` (current ~line 202) for the new `top_row_default` + `EventCardMediaSlot` fallback shape: assert the large centered favorite badge renders in the thumbnail's reserved slot, no placeholder text/icon, and the row/thumbnail retain their layout classes on error (no reflow).
  - [ ] 4.2 Rewrite `'renders masonry variant with aspect-ratio image class and reduced caption'` (current ~line 295) — the image now renders inside the `flex-1 h-full min-w-0` thumbnail, not a full `aspect-[3/4]` container; update the container-class assertions accordingly.
  - [ ] 4.3 Rewrite `'keeps the default aspect-[3/4] poster treatment when prominentPoster is false/omitted'` (current ~line 688, inside `describe('Prominent poster (masonry, AC17)')`) — default state no longer has an `aspect-[3/4]` poster; replace with an assertion on the new flex-fill thumbnail shape. Leave the sibling `'uses the enlarged aspect-[2/3] poster treatment when prominentPoster is true'` test unchanged (AC2).
  - [ ] 4.4 Update the `describe('TILL badge (masonry, AC14)')` block (current ~line 541) to assert the new `bg-amber-700`/`-top-1.5 -left-1.5` classes (not the old `bg-foreground`/`-bottom-1.5` ones) — for **both** `prominentPoster` values (AC3), while keeping every existing eligibility/text assertion unchanged (AC7).
  - [ ] 4.5 Add: a test asserting exactly one focusable favorite-toggle element exists in the whole rendered card when `variant="masonry" prominentPoster={false}"` and `onFavoriteToggle` is provided (AC4); a test that clicking the sibling favorite badge calls `onFavoriteToggle` without invoking the card's own `onClick`/navigation (stopPropagation/preventDefault contract, already implemented by `EventCardFavoriteBadge`'s own `onClick`); a test that clicking the thumbnail's image area (not the favorite button) still fires the card's `onClick`/navigates via `href` (AC6); a DOM-order assertion that the favorite control still precedes the card's clickable root among `<article>`'s children (AC5).
  - [ ] 4.6 Add a masonry-default `prominentPoster={true}` TILL-badge case confirming the amber/corner styling now also applies there (AC3's both-states scope).

- [ ] **Task 5: Full verification pass** (all ACs)
  - [ ] 5.1 `pnpm exec vitest run src/features/events/EventCardMediaPrimitives.test.tsx` (from `packages/ui`)
  - [ ] 5.2 `pnpm exec vitest run src/features/events/EventCard.test.tsx`
  - [ ] 5.3 `pnpm exec vitest run src/features/events` (full folder — catches `EventListView.test.tsx`/`WeeklyCalendarView.test.tsx` for accidental coupling)
  - [ ] 5.4 `pnpm exec eslint` on every changed file — 0 errors/warnings
  - [ ] 5.5 `tsc --noEmit` on `packages/ui` — 0 new errors in changed files

## Dev Notes

### Architecture & UX Gate Findings

- **Gate 1 (Architecture/Infra Completeness) — No gap found.** Sourced from `_bmad-output/planning-artifacts/epic-readiness/epic-1-i1-readiness.md` (swept: true, 2026-09-13), which ran Gate 1 epic-wide: no DB/ORM/domain call from `apps/web`/a UI package, no external-service call from the frontend, no new API surface, no auth/secrets/business rules in frontend code, no infra requiring IaC. **Lightweight guard, applied fresh:** this story's actual scope — extending `EventCardMediaSlot`'s prop surface additively (two new optional callback/boolean props) and restructuring `EventCard.tsx`'s existing masonry JSX/CSS — introduces no new external service, data entity, or infra dependency the epic-wide sweep didn't anticipate. Still pure presentational `packages/ui` work; no fresh Gate 1 run warranted.
- **Gate 2 (UI Complexity & Reusability) — run fresh per story-split-gate.md's per-story requirement (epic readiness report directs only Gate 2 be re-run per story once swept).** Dispatched to a Freya-persona subagent against this story's full draft scope (the `top_row_default` restructuring, the TILL-badge restyle, and the nested-button-avoiding favorite-control composition). **Verdict: NO SPLIT.** Reasoning: every primitive used (`EventCardDateBox`, `EventCardMediaSlot`, `EventCardFavoriteBadge`) already exists, already had its own Gate 2 pass in Story 1.i1a, and is unchanged in its core layout/token behavior by this story — nothing novel is being designed, only a third call site composing pre-vetted primitives (the same shape Stories 1.i1b–1.i1d's own Gate 2 passes independently verdicted). The JSX/CSS restructuring (the `RootTag`-boundary-preserving favorite-control placement) is a variant of the pattern already decided and shipped in Story 1.i1d for `WeeklyCalendarView`, not a fresh design question. The subagent surfaced three concrete gaps, all folded into ACs above rather than left implicit: (1) an explicit AC that the outer top-right button is suppressed for this state (AC4) — otherwise a dev following only the literal original epics.md ACs could easily leave both controls rendered; (2) an explicit tab-order AC (AC5), since the favorite badge moving to a DOM-sibling position could otherwise silently diverge from visual reading order (WCAG 2.4.3); (3) an explicit AC that the TILL badge's existing eligibility/text logic carries forward unchanged (AC7), so the test rewrite in Task 4 doesn't accidentally assert it always renders. A fourth check — `badge_row`'s position given how much of the branch above it is moving — was confirmed **not** a gap (DESIGN.md places it below `top_row_default` reusing existing tokens as-is) but is still captured as a regression-guard AC (AC8) and test (Task 4.4/4.6 area) given the amount of code moving around it.
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness) — No gap found.** Sourced from the same swept `epic-1-i1-readiness.md`: no i18n/analytics/global-shell/codegen dependency is implicated. This story's new local `defaultThumbnailImagePresent` state (Task 2.2) is plain component state, not a new shared/foundational mechanism — no `packages/domain` or shared-hook extraction is warranted (see Project Structure Notes).

### User-Resolved Design Decisions (AskUserQuestion, 2026-09-13)

1. **TILL badge scope — apply the amber/corner treatment to both `prominentPoster` states.** epics.md's AC text places "the TILL badge renders... in the new amber treatment" as a trailing clause after a sentence establishing `prominentPoster=true` stays "unchanged," which reads ambiguously as either (a) scoped only to the `prominentPoster=false` case just described, or (b) a separate, state-independent requirement. `DESIGN.md`/`EXPERIENCE.md` are explicit and unambiguous that the new amber, top-left-corner treatment is the **same shared token** anchored to whichever date-box container is present in either state ("Anchored to the containing date box's top-left corner in both prominentPoster states... works against `base`... and against `base_default`"), and no other story in Epic 1.i1 (or anywhere else in `epics.md`) touches the TILL badge. **User confirmed:** apply the new styling to both states in this story — a small, low-risk diff inside the otherwise-fully-unchanged `prominentPoster=true` overlay block — rather than leave a permanent, untracked mismatch between shipped code and the design docs with no story anywhere positioned to fix it later. See AC3/AC7 and Task 3.
2. **Favorite-control nesting — keep the thumbnail fully clickable; move only the control, not the image, out of `RootTag`.** `EventCardMediaSlot`'s internal favorite button cannot end up nested inside `RootTag` when `RootTag` renders as `<a>`/`<button>` (the case whenever a masonry consumer passes `href`/`onClick`, which they do to navigate to the event) — a `<button>` nested inside an `<a>`/`<button>` is invalid HTML and breaks focus/click semantics, the same bug class Story 1.i1d fixed for `WeeklyCalendarView`. Two structural fixes were on the table: (a) pull the entire thumbnail out as a `RootTag`-external sibling (mirroring 1.i1d's exact fix, at the cost of the thumbnail losing click-to-navigate), or (b) keep the thumbnail's image/fallback content inside `RootTag` (fully clickable, unchanged from today) and instead pull only the **favorite-toggle button** out as an absolutely-positioned `RootTag` sibling — the same convention `EventCard.tsx` already uses for its current top-right button (a sibling of `RootTag`, absolutely positioned to visually overlay content that lives inside `RootTag`, with `e.preventDefault(); e.stopPropagation();` on its own click handler as belt-and-suspenders against triggering the parent's navigation). **User explicitly selected (b)**, in their own words: *"I want them positioned inside the card. If you make them as siblings, you should make the position absolute or something. Or you could also use something like preventEventPropagate to avoid triggering parent element,"* clarifying this must not sacrifice the thumbnail's click-to-navigate behavior. This is the option implemented by Task 1–2 and captured in the guardrail below. See AC4/AC6.

### Favorite-Badge Sibling Positioning (implementation guardrail — read before implementing Tasks 1–2)

`EventCardMediaSlot` is rendered **inside** `RootTag` (so the image/fallback area stays part of the clickable/navigable region, per the user's decision above), but with `hideFavoriteBadge` — it renders no button of its own. The actual favorite control is `EventCardFavoriteBadge`, rendered **outside** `RootTag` as a direct sibling, at the same DOM position (`<article>`'s first child, immediately before `RootTag`) that today's single outer button already occupies for `standard`/`prominentPoster=true`. This is not new plumbing — `EventCardFavoriteBadge` was already exported standalone in Story 1.i1a specifically for this kind of reuse ("Exported standalone so Story 1.i1b can import it directly to replace `EventCard`'s current inline corner-heart JSX").

Positioning math, since the sibling badge's `absolute` anchor is `<article>` (which wraps the *whole* row, date box included), not the thumbnail alone:

- **Small corner badge (`scale="default"`, image present):** trivial — no calculation needed. `top_row_default` has no padding before it (flush against the card edges, same as today's full-width image), and the thumbnail is the row's right-most, full-row-height flex item, so the thumbnail's own top-right corner *is* the row's (and therefore the card's) top-right corner. The existing `absolute top-1 right-1 z-10` class (already used internally by `EventCardMediaSlot` for this exact badge today) works unmodified when applied to `<article>` instead.
- **Large centered badge (`scale="large"`, image absent/errored):** genuinely harder — DESIGN.md requires it centered specifically *within the thumbnail's own box*, which does **not** span the full row (the date box occupies an unknown, content-dependent width to its left, since date text length varies by locale/date format). A naive "center within the whole row" would visually center the badge between the date box and thumbnail combined, landing it wrong. Recommended approach: give the outer row a CSS Grid (`grid-template-columns: auto 1fr`, matching the date box's `shrink-0` + thumbnail's `flex-1` today) and give `RootTag` `display: contents` so its two children (date box, thumbnail) participate directly in that grid; the sibling badge wrapper then places itself at the same second grid track (`grid-column: 2`) to land exactly over the thumbnail cell with no JS measurement. Verify `display: contents` preserves `RootTag`'s click/focus semantics in this project's supported browser matrix before relying on it (modern evergreen browsers handle it correctly; treat this as a spot-check, not a blocking risk). If that turns out not to hold up in practice, the fallback is a measured approach: a `ResizeObserver`/`useLayoutEffect` on the date box setting a CSS custom property (e.g. `--i1e-date-box-w`) that the badge's `left: calc(var(--i1e-date-box-w) + <gap>)` consumes. Confirm the final visual result against `imports/masonry-default-thumbnail-fallback-large-favorite-icon.png` at implementation time — this is exactly the kind of "confirm exact syntax/approach against the reference at implementation time" judgment call Story 1.i1a already made for its own icon-scale token.

### Data Type Compatibility & Migration Requirements

- Compatibility finding: No DB/GraphQL mismatch.
- Impacted fields/contracts: `EventCardMediaSlotProps` (`packages/ui/src/features/events/EventCardMediaPrimitives.types.ts`) gains two new **optional** fields — `hideFavoriteBadge?: boolean`, `onImagePresenceChange?: (imagePresent: boolean) => void`. Both are additive and default to today's exact behavior when omitted (`hideFavoriteBadge` defaults falsy — internal badge still renders; `onImagePresenceChange` is simply unused if not passed). No change to `EventCardProps`/`EventCardLabels` (`EventCard.types.ts`) — this story adds no new public prop to `EventCard` itself, only internal composition changes.
- Required DB migration changes: No changes required — purely presentational `packages/ui` work, no persistence layer touched.
- Required TypeScript type changes: As listed above — additive-only. Every existing caller of `EventCardMediaSlot` (Story 1.i1a's own tests, Story 1.i1d's `WeeklyCalendarView.tsx` adoption) continues to compile and behave identically without modification, since neither new prop is required.
- Backward compatibility and rollout notes: No consumer outside `EventCard.tsx`'s own masonry-default branch is affected. `WeeklyCalendarView.tsx` (1.i1d) does not need and does not receive either new prop.
- Verification checks: `EventCardMediaPrimitives.test.tsx`'s existing suite plus the new cases from Task 1.4 confirm the additive props behave correctly without regressing the slot's default (props-omitted) behavior; `EventCard.test.tsx`'s full suite (Task 4/5) confirms no coupling was introduced into the `standard`/`prominentPoster=true` paths.

### Project Structure Notes

- Alignment with unified project structure: All changes stay within `packages/ui/src/features/events/` (Domain Features per project-context.md's UI Components & Scalability rule) — no new files, no relocation, matching Stories 1.i1b–1.i1d's precedent.
- No `packages/domain` involvement: this story is pure presentational composition/restructuring (JSX, CSS classes, one piece of local `useState`) — nothing here is business logic, and nothing qualifies for or requires extraction into `packages/domain`.
- State Management categorization (project-context.md's State Management Architecture rule): the new `defaultThumbnailImagePresent` state (Task 2.2) is **local component state** (`useState`, scoped to a single `EventCard` render) — it is not Server State (no React Query/data fetching involved), not URL State (no `nuqs`/search-param involvement), and not Client Global State (no cross-component/global concern, no `zustand`) — it is the same category as the pre-existing `imgError` state already in this file. No new state-management scope is introduced.
- Detected conflicts or variances: None.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.i1e] (and sibling Stories 1.i1a–1.i1d, 1.i1z for shared epic context)
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-1-i1-readiness.md] (Gate 1 + Gate 3 sweep, swept: true)
- [Source: design-artifacts/UX-festgrid-run-1/DESIGN.md#event_card_masonry.top_row_default, #event_card_masonry.thumbnail_default, #event_card_masonry.thumbnail_default_fallback, #event_card_date_box.base_default, #event_card_till_badge, #event_card_favorite_count_badge_large] (all tokens this story implements; references `imports/masonry-default-ai-tech-summit-date-box-beside-thumbnail.png`, `imports/masonry-default-thumbnail-fallback-large-favorite-icon.png`, `imports/masonry-prominent-quantum-leap-symposium.png`)
- [Source: design-artifacts/UX-festgrid-run-1/EXPERIENCE.md#Masonry EventCard: Date Box, TILL Badge, and Status/Nearby Badge Row, #Masonry EventCard Badge Row] (composition rationale, both-states TILL-badge scope, reserved-space/no-reflow requirement, single-live-control requirement)
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-15] (Rules 1/2/4 this story satisfies on the masonry-default surface; Rule 3 icon-scale token already primitive-internal, inherited automatically)
- [Source: _bmad-output/implementation-artifacts/1-i1a-extend-the-shared-event-card-primitive-to-own-thumbnail-sizing-and-fallback.md] (the primitive this story adopts, including its own Gate 2 pass establishing `EventCardFavoriteBadge` as reusable standalone)
- [Source: _bmad-output/implementation-artifacts/1-i1c-replace-the-local-broken-image-placeholder-with-the-shared-fallback.md] (AD-15 Rule 2 scope note — confirms this story is where the "large favorite badge centered in the slot" half of Rule 2 finally lands on the masonry surface)
- [Source: _bmad-output/implementation-artifacts/1-i1d-adopt-the-primitive-into-weeklycalendarview-compact-row.md] (precedent for the nested-button DOM fix pattern this story adapts; precedent for documenting a User-Resolved Design Decision inline)
- [Source: packages/ui/src/features/events/EventCard.tsx] (lines ~176-198 — today's single outer favorite button this story's sibling badge replaces, for this state only; lines ~205-236 — the masonry image wrapper + date-box overlay this story restructures for `prominentPoster=false`; line 162 — `RootTag`/`interactiveProps` definition)
- [Source: packages/ui/src/features/events/EventCard.types.ts] (`EventCardProps` — unchanged by this story, confirmed no new public prop needed)
- [Source: packages/ui/src/features/events/EventCardMediaPrimitives.tsx, .types.ts] (`EventCardMediaSlot`/`EventCardFavoriteBadge`/`EventCardDateBox` — extended additively by Task 1)
- [Source: packages/ui/src/features/events/event-card-media-tokens.ts] (icon-scale token, unchanged, inherited via `EventCardFavoriteBadge`)
- [Source: packages/ui/src/features/events/EventCard.test.tsx] (existing masonry-default/TILL-badge/prominent-poster test blocks rewritten/extended by Task 4 — see exact line references in Task 4 above)
- [Source: packages/ui/src/features/events/EventListView.tsx] (confirms `prominentPoster: event.durableImageUrl != null` and `variant="masonry"` are already live-wired from `apps/web` today — this story's change is user-visible immediately upon merge, not shipped dark)

## Global Rules References

- [x] `_bmad-output/project-context.md` — UI Components & Scalability rule (Domain Features → `packages/ui/src/features/<domain>/`, unchanged placement); State Management rule (the new local `useState` is plain component state, not Server/URL/Global — explicitly categorized above, no `react-query`/`nuqs`/`zustand` involved); Locale-Sensitive Data Rendering rule (no date/time formatting logic changes — Task 3.2 explicitly preserves `formatEventTime`/`tillBadgeText` computation).
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — this file's section order/status vocabulary.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-15 (this story satisfies Rules 1/2/4 on the masonry-default surface, already named as a Binds-list consumer; no new AD needed).
- [x] `_bmad-output/planning-artifacts/story-split-gate.md` — Gate 1/3 sourced from the swept epic readiness report; Gate 2 run fresh this story (NO SPLIT, three gaps folded into ACs).
- [x] `docs/infrastructure/index.md` — consulted; not applicable, this story touches no backend compute, queues, EventBridge/cron, API Gateway, or database provisioning.

## Implementation Plan (Rule-Compliant)

### File Change Plan

- **Modified:** `packages/ui/src/features/events/EventCardMediaPrimitives.tsx` — add `hideFavoriteBadge`/`onImagePresenceChange` handling to `EventCardMediaSlot` (Task 1).
- **Modified:** `packages/ui/src/features/events/EventCardMediaPrimitives.types.ts` — add the two new optional props to `EventCardMediaSlotProps` (Task 1.3).
- **Modified:** `packages/ui/src/features/events/EventCardMediaPrimitives.test.tsx` — new coverage for the two additive props (Task 1.4).
- **Modified:** `packages/ui/src/features/events/EventCard.tsx` — restructure the `prominentPoster=false` masonry branch; restyle the TILL badge for both states; suppress the outer favorite button for this state (Tasks 2-3).
- **Modified:** `packages/ui/src/features/events/EventCard.test.tsx` — rewrite/extend the masonry-default, TILL-badge, and prominent-poster test blocks (Task 4).
- **Not touched:** `EventCard.types.ts` (no new public prop on `EventCard` itself), `WeeklyCalendarView.tsx`/`.types.ts` (Story 1.i1d's surface, unaffected), `event-card-media-tokens.ts` (icon-scale token unchanged), `festgrid-architecture-spine.md` (AD-15 already names this story as a consumer — no edit needed, matching Story 1.i1c/1.i1d precedent).

### Rule Mapping

- project-context.md's UI Components & Scalability rule → all changes confined to `packages/ui/src/features/events/`.
- AD-15 Rules 1/2/4 → satisfied on the masonry-default surface by Tasks 1-2 (Rule 3's icon-scale token is inherited automatically via `EventCardFavoriteBadge` reuse, no separate work needed).
- project-context.md's State Management rule → the one new piece of state (Task 2.2) is explicitly categorized as local component state, not one of the three managed scopes (see Dev Notes › Project Structure Notes).
- project-context.md's Locale-Sensitive Data Rendering rule → unaffected; Task 3.2 explicitly forbids touching the existing `formatEventTime`/`tillBadgeText` formatting logic.
- story-split-gate.md's Gate 1/2/3 → addressed in Dev Notes › Architecture & UX Gate Findings above.

### Verification Plan

1. `pnpm exec vitest run src/features/events/EventCardMediaPrimitives.test.tsx` (from `packages/ui`) — 0 failures, including new Task 1.4 cases.
2. `pnpm exec vitest run src/features/events/EventCard.test.tsx` — 0 failures, including rewritten/new Task 4 cases.
3. `pnpm exec vitest run src/features/events` (full folder) — 0 failures, confirming no coupling into `EventListView`/`WeeklyCalendarView` consumers.
4. `pnpm exec eslint` on every changed file — 0 errors/warnings.
5. `tsc --noEmit` on `packages/ui` — 0 new errors in changed files (pre-existing unrelated errors, if any, are out of scope per Story 1.i1a/1.i1c precedent).

## Pre-Coding Approval Gate

- [ ] **Scope confirmed:** adopt the existing `event_card_*` primitive into `EventCard`'s masonry `prominentPoster=false` state; extend `EventCardMediaSlot` additively (two new optional props); restyle the TILL badge for **both** `prominentPoster` states; suppress the duplicate favorite control for this state via a sibling-positioned `EventCardFavoriteBadge`.
- [ ] **Architecture/boundary confirmed:** Gate 1 and Gate 3 sourced from the swept `epic-1-i1-readiness.md` (no gap); Gate 2 run fresh for this story (NO SPLIT verdict, three gaps folded into AC4/AC5/AC7); no `packages/domain` involvement; no prerequisite story or `sprint-status.yaml`/`epics.md` addition required.
- [ ] **Design fidelity confirmed:** both open design questions resolved via `AskUserQuestion` on 2026-09-13 — TILL badge styling applies to both `prominentPoster` states (AC3); the favorite control is a `RootTag`-external sibling while the thumbnail image itself stays inside `RootTag` and fully clickable (AC4/AC6) — captured verbatim in Dev Notes › User-Resolved Design Decisions.
- [ ] **Testing plan confirmed:** Task 4 (test rewrites/additions) and Task 5 (full verification commands) above.
- [ ] **Human approval:** **PENDING** — default state per `story-content-structure.md`; awaiting explicit approval before implementation begins.

## Testing Requirements

Per `story-content-structure.md`'s Definition of Done for Testing:

a. **Primary "happy path":** covered by integration tests in `EventCard.test.tsx` (Task 4.1-4.3) asserting the new `top_row_default` composition renders correctly with an image present. No dedicated E2E test is added by this story — consistent with Stories 1.i1a/1.i1b/1.i1c/1.i1d, none of which added E2E coverage for this presentational-only primitive/adoption work; `packages/ui` has no Playwright suite of its own.
b. **"Unhappy path":** the image-error/missing-image fallback (Task 4.1) and the nested-button-avoidance click-propagation case (Task 4.5) both cover failure/edge behavior, not just the happy path.
c. **No coverage decrease:** Task 5's full-folder `vitest run src/features/events` run confirms no regression in sibling suites (`EventListView.test.tsx`, `WeeklyCalendarView.test.tsx`) from this story's changes.

## Deliverables Checklist

- [ ] `EventCardMediaPrimitives.tsx` — `hideFavoriteBadge`/`onImagePresenceChange` implemented on `EventCardMediaSlot`.
- [ ] `EventCardMediaPrimitives.types.ts` — new optional props documented.
- [ ] `EventCardMediaPrimitives.test.tsx` — new prop coverage passing.
- [ ] `EventCard.tsx` — `prominentPoster=false` masonry branch restructured; TILL badge restyled for both states; outer favorite button suppressed for this state only.
- [ ] `EventCard.test.tsx` — all rewritten/new tests passing; no unrelated test broken.
- [ ] Verification Plan (all 5 commands) executed and clean.

## Out of Scope

- Any structural change to `prominentPoster=true`'s full-width poster treatment beyond the TILL-badge restyle (AC2) — its image aspect ratio, `base` overlay date box, and outer favorite button stay exactly as shipped.
- `WeeklyCalendarView`'s compact row — already adopted by Story 1.i1d.
- Story 1.i1z's CI-wired ratchet test enforcing the invariant repo-wide — a separate, later story.
- Any change to `EventCardMediaSlot`'s core layout classes (`flex-fill`/`fixed-square` shapes) — only additive new props are introduced.
- A bespoke position spec for the generic `statusBadge` prop within the new `top_row_default` layout beyond "keep it rendering, don't break the contract" (AC8) — no current consumer passes `statusBadge` on a masonry card, and DESIGN.md does not define a new position for it in this composition, so none is invented here.

## Definition of Done

- [ ] All 8 Acceptance Criteria satisfied and verified by tests.
- [ ] Task 5's full verification pass (vitest × 3, eslint, tsc) is clean.
- [ ] No regression in `EventListView.test.tsx`/`WeeklyCalendarView.test.tsx` or any other existing suite.
- [ ] Gate 2's three folded-in gaps (AC4, AC5, AC7) are each covered by an explicit test, not just implied by the implementation.
- [ ] Story status updated to `review` in this file and in `sprint-status.yaml`.

## Completion Status

Ultimate context engine analysis completed — comprehensive developer guide created. Status: **ready-for-dev**.

## Dev Agent Record

### Agent Model Used

_To be filled by `bmad-dev-story`._

### Debug Log References

_To be filled by `bmad-dev-story`._

### Completion Notes List

_To be filled by `bmad-dev-story`._

### File List

_To be filled by `bmad-dev-story`._

## Change Log

- **2026-09-13 (bmad-create-story):** Initial story creation. Gate 1/3 sourced from the swept `epic-1-i1-readiness.md`; Gate 2 run fresh (NO SPLIT, 3 gaps folded into AC4/AC5/AC7). Two design decisions resolved via `AskUserQuestion`: TILL badge styling applies to both `prominentPoster` states; the favorite-toggle control is pulled out as a `RootTag`-external sibling while the thumbnail image itself stays inside `RootTag` and fully clickable, per the user's explicit "absolute sibling + stopPropagation" guidance.
