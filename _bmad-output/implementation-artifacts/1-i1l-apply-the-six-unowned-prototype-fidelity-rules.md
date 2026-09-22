---
baseline_commit: c80cd9bdbe342e5e99346a51365cd0e0f4a3de19
---

# Story 1.i1l: Apply the six unowned 2026-09-14 prototype-fidelity rules

## Story Details

- Epic: 1.i1
- Story ID: 1.i1l
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want the six prototype-fidelity rules that the 2026-09-14 `bmad-png-to-html` pass validated and wrote into `DESIGN.md`/`EXPERIENCE.md` but that no story or board row ever owned — the masonry card's 230px width cap, the prominent poster's `aspect-square` crop, the `happeningNow` label shortened to "Now", the TILL-conditional date/favorite pill positions, the badge size floor and font/padding harmonization, and the calendar compact row's 2-line title — applied to the code,
so that the three card families finally render what the validated prototypes show instead of the pre-2026-09-14 shape, and the two amendment notes that recorded this outstanding work (`IDEA-016`'s "3 prototyping corrections" and `IDEA-017`'s "7 prototyping refinements", both saying the work was "never folded into a story amendment") are finally closed out in code rather than carried forward as prose (backlog.yaml `IDEA-046`, renumbered from `IDEA-043`).

## Acceptance Criteria

1. **Rule 1 — masonry card max width.** **Given** `EventCard.tsx`'s card root (`:240`) and its skeleton (`:148`) both carry `w-full max-w-sm` unconditionally — a class that today also sizes the **non-masonry** `variant='standard'` card — **when** this story ships, **then** both sites render `max-w-[230px]` **only** when `variant === 'masonry'`, keeping `max-w-sm` for `variant='standard'`, per DESIGN.md `event_card_masonry.max_width` ("applies to ALL THREE masonry states … Implemented as a single class on the card's own root element … not a second nested wrapper"). The skeleton is included deliberately, per project-context.md's "Keep Skeletons in Sync With Their Real Component" rule — a skeleton that stays 384px wide while the real card renders at 230px reintroduces exactly the CLS the skeleton exists to prevent. **And** `packages/ui/src/features/posts/PostCard.tsx:95`/`:189`, which carry the byte-identical `w-full max-w-sm rounded-xl overflow-hidden shadow-sm border border-border bg-card` literal, are a **different card family and must not be touched** — no repo-wide find-and-replace.
2. **Rule 2 — prominent-poster crop.** **Given** `EventCard.tsx:348` renders `variant === 'masonry' ? 'aspect-[2/3]' : 'h-48'` (already correctly variant-gated), **when** this story ships, **then** the masonry branch renders `aspect-square`, per DESIGN.md `event_card_masonry.image_prominent` (`"w-full aspect-square object-cover"`, "REVISED 2026-09-14, user-directed — was aspect-[2/3]"). **And** the three shipped assertions that pin the old ratio — `EventCard.test.tsx:256`, `:930`, `:950` — are updated to the new one. **Note for the dev:** DESIGN.md puts `aspect-square` on the `<img>` while the code puts the aspect class on the wrapper `<div>` with the `<img>` filling it (`object-cover w-full h-full`); keeping it on the wrapper is equivalent and is the correct minimal change — do not restructure the wrapper/img relationship.
3. **Rule 3 — `happeningNow` label.** **Given** the default label string `'Happening Now'` exists at **three** sites today — `EventCard.tsx:99` (`defaultLabels.statusHappeningNow`), `WeeklyCalendarView.tsx:298` (the same default, added by Story 1.i1j), and `format-event-date.ts:188` (`formatEventStatus`'s own fallback) — **when** this story ships, **then** all three render `'Now'`, changed in lockstep, per DESIGN.md `event_card_status_badge` ("LABEL for the `happeningNow` state shortened to 'Now' … a single translatable word") and EXPERIENCE.md's matching entry. **And** the story explicitly acknowledges that because `format-event-date.ts` is re-exported wholesale by `packages/ui/src/features/events/index.ts:21` (`export * from './format-event-date'`), this default is a **package-level** default, slightly broader than DESIGN.md's own "scoped to the masonry/row/grid-item card families … not an app-wide i18n string-table change" hedge — accepted, because the only two real consumers in the repo are the two card families this pass covers (verified by grep: no `apps/web` consumer passes or overrides this label today). **And** the three shipped assertions touching the string — `format-event-date.test.ts:190` (the true default assertion), `EventCard.test.tsx:879` and `WeeklyCalendarView.test.tsx:1473` (both pass explicit label props, so they need the expected text updated, not the default) — are updated.
4. **Rule 4 — date-pill / TILL position mechanism (masonry `prominentPoster=true` only).** **Given** `EventCard.tsx`'s overlay branch renders the date pill at a static `absolute top-3 left-3 … px-2.5 py-1` (`:355`) and the favorite pill at a static `absolute top-3 right-3` (`:254`), and `EVENT_CARD_TILL_LABEL_CLASS` (`EventCardMediaPrimitives.tsx:48-49`) hardcodes a single `-top-1.5` offset for every context, **when** this story ships, **then**:
   - `EVENT_CARD_TILL_LABEL_CLASS` becomes a **context-keyed helper** (e.g. `eventCardTillLabelClass(context: 'default' | 'prominent')`) returning `-top-1.5` for `'default'` (masonry `base_default` and the compact row's `date_box`, both two-tier pills with enough vertical padding) and `-top-3` for `'prominent'` (the `prominentPoster=true` single-line chip), per DESIGN.md `event_card_till_badge`'s "OFFSET DIFFERS BY CONTEXT" block. All **three** current consumers are migrated: `EventCardDateBox`'s internal `tillLabel` slot (`EventCardMediaPrimitives.tsx:218`, serving both `size` variants → `'default'`) and `EventCard.tsx:39`'s `TILL_BADGE_CLASS` alias for the prominent-poster raw span (→ `'prominent'`). The exported constant's removal/replacement is part of this change — no call site keeps a frozen copy.
   - The prominent-poster **date pill** renders at `top-2` when no TILL badge is present and `top-5` when one is, and the prominent-poster **favorite pill** moves to the **same** `top-5` in lockstep, per DESIGN.md `event_card_date_box.base` ("this pill moves to `top-2` -> `top-5`, and `{components.event_card_masonry.favorite_pill}` moves to the SAME `top-5` to stay visually aligned with it").
   - Both pills also take their spec'd **horizontal** offsets, `left-2` (date) and `right-2` (favorite), replacing today's `left-3`/`right-3` — DESIGN.md's token literals and both validated prototype panels agree on `left-2`/`right-2`, and rule 4 as originally written in the board row covered only the vertical axis.
   - The date pill's padding becomes **uniform `p-1`** in both TILL states, per DESIGN.md's explicit "Padding stays uniform (`p-1`) — a padding trick (asymmetric top/bottom padding) was tried and explicitly rejected by the user as the wrong mechanism." **Recorded discrepancy:** the validated prototype's Panel B (no TILL) shows `px-2 py-1`, disagreeing with DESIGN.md's own token. DESIGN.md wins here — it is the token source of truth, and its prose states the uniform-padding decision as an explicit user ruling, while the prototype panel's value is incidental. Flagged rather than silently reconciled.
   - **All of the above is gated to `variant === 'masonry'`.** The favorite overlay at `:254` is gated `onFavoriteToggle && !isMasonryDefault`, which includes `variant='standard'`; applying `top-5`/`right-2` there would move the non-masonry card's favorite pill, which no rule asks for. The `variant='standard'` overlay keeps `top-3 right-3` unchanged.
5. **Rule 5 — badge size floor and font/padding harmonization.** **Given** EXPERIENCE.md's "Minimum badge text size" rule ("never render below **11px** text, across all three card families") and its "Favorite badge font-size >= TILL badge font-size" rule, **when** this story ships, **then**:
   - **The 11px floor applies to every badge on the three card families, not only the four the rule names** (user decision, 2026-09-21 — see Dev Notes). Concretely: `EVENT_CARD_TILL_LABEL_CLASS`'s `text-[10px]` (`EventCardMediaPrimitives.tsx:49`) and the calendar row's `multi-day-badge` `text-[10px]` (`WeeklyCalendarView.tsx:1103`) both come up to the floor; the row's `favorite-count-line` `text-[11px]` (`:1097`) is confirmed already at it; `EventCardStatusBadge` (`EventCardMediaPrimitives.tsx:246`) and `EventCardNearbyBadge` (`:282`) are confirmed already `text-xs` (12px) and need **no change**.
   - The TILL badge and the favorite badge render `text-xs` (12px) at the narrow card width and `text-sm` (14px) at the wide one, in all three masonry states, per DESIGN.md `event_card_till_badge`'s "FONT SIZE NO LONGER FIXED AT text-[11px]" block and EXPERIENCE.md's round-8 harmonization entry — **with both steps keyed to the card's own width, not the viewport** (user decision, 2026-09-21; see AC7 for the mechanism and Dev Notes for why the viewport is the wrong trigger once rule 1's cap lands).
   - The favorite corner pill's padding becomes `px-1.5 py-1` — "the exact looser value round 8 removed" (`px-2.5 py-1.5`) is replaced at **both** places it lives: the primitive `EventCardFavoriteBadge` (`EventCardMediaPrimitives.tsx:175`) **and** the un-migrated inline duplicate in `EventCard.tsx:255`, which carries the identical `px-2.5 py-1.5 gap-1.5` / `p-2` literal and serves the prominent-poster and non-masonry corner pill. Fixing only the primitive would leave the removed value shipping on the exact card the round-8 harmonization was about.
   - The favorite **count text** inherits the pill's responsive size rather than pinning its own, per DESIGN.md's "responsive font-size (`text-xs` mobile/`text-sm` desktop, **inherited by the count text**)". It is hardcoded `text-xs` at `EventCardMediaPrimitives.tsx:193` and `EventCard.tsx:266` today; both drop the fixed size so the pill's own size cascades.
   - A test asserts the "favorite badge font-size >= TILL badge font-size" invariant holds at both card widths, so the rule is ratcheted rather than only satisfied once.
6. **Rule 6 — calendar compact-row title wrap.** **Given** the compact row (`WeeklyCalendarView.tsx`'s `CalendarCard` `variant='list'`) renders its title with `truncate` at `:1094`, **when** this story ships, **then** the title wraps up to 2 lines (`line-clamp-2`), per DESIGN.md `event_card_compact.title` (`"text-sm font-bold line-clamp-2"` — "REVISED 2026-09-14, user-directed — was text-xs truncate (1 line)"). **And** the **parent** span at `:1087` (`flex items-center gap-1 w-full truncate text-left`) drops its own `truncate` — leaving it makes the `:1094` change a visual no-op, since the outer clip still forces one line. **And** that parent's `items-center` becomes `items-start` so the inline favorited / added-to-calendar icons pin to the title's first line instead of vertically centring against a 2-line block. **And** the near-identical block at `:1160`/`:1167` — the `variant='grid'` desktop day-cell pill, a different surface owned by Stories 1.i1f-h — is **left untouched**, and a test confirms `variant='grid'` is unaffected.
7. **Mechanism for rule 5's two font steps.** **Given** rule 1 caps every masonry card at 230px, so the card's rendered width no longer tracks the viewport (a 230px card on a wide desktop is the same width as a near-230px card on a narrow one), **when** rule 5's `text-xs`/`text-sm` pair is implemented, **then** the step is triggered by **the card's own width via a CSS container query**, not a viewport breakpoint. The card root declares `container-type: inline-size` and the badge font-size steps at the card width the prototypes were validated at. **And** the implementation is verified by asserting the generated CSS actually contains the `@container` rule — Tailwind silently emits nothing for a class-name candidate it cannot parse, which is the exact failure mode `packages/ui/eslint-rules/no-dynamic-tailwind-arbitrary-value.mjs` (Story 1.i1k) exists to catch; a container-query class that compiles to nothing would fail silently and look correct in JSDOM. **Mechanism is the dev's call between two candidates, in this order:** (a) Tailwind 3.4 arbitrary variants + arbitrary properties (`[container-type:inline-size]` on the root, `[@container(min-width:…)]:text-sm` on the badges) — preferred, because it adds no dependency and no change to `apps/web/tailwind.config.ts`; (b) if (a) does not compile, add the official `@tailwindcss/container-queries` plugin to `apps/web` and register it. **Neither has been empirically verified in this repo** — `node_modules` was not installed in the session that drafted this story, and the repo has no existing `@container` usage — so proving which one emits real CSS is Task 7's first job, not an assumption to build on.
8. **Shipped-AC reconciliation.** **And** Story 1.i1i's acceptance criterion in `epics.md` — which requires the shared badge component's label defaults to match `EventCard.tsx`'s `defaultLabels` "verbatim" and quotes "Happening Now" as the example — is amended in the same change to quote "Now", with a dated note saying this story superseded it. The AC's force is the *consistency invariant* between the shared component's defaults and `EventCard.tsx`'s, not the literal string; changing all three defaults in lockstep preserves that invariant, and leaving the stale quote would mislead the next reader into thinking 1.i1i and this story contradict each other.

## Tasks / Subtasks

- **Task 1 — Context-keyed TILL label class (AC4).** Prerequisite for Tasks 4 and 5; do it first.
  - 1.1 Replace `EVENT_CARD_TILL_LABEL_CLASS` (`EventCardMediaPrimitives.tsx:48-49`) with a context-keyed helper returning the `-top-1.5` (`'default'`) / `-top-3` (`'prominent'`) variants; keep every other class in the string identical for now (font-size changes land in Task 5).
  - 1.2 Migrate `EventCardDateBox`'s internal `tillLabel` slot (`:218`) to `'default'`.
  - 1.3 Migrate `EventCard.tsx:39`'s `TILL_BADGE_CLASS` alias to `'prominent'` and remove the now-dead alias.
  - 1.4 Confirm by grep that no other consumer imports the old constant (Story 1.i1k exported it precisely so a 3rd call site could not hand-copy it — that guarantee must survive this refactor).
- **Task 2 — Masonry width cap (AC1).**
  - 2.1 Gate `max-w-sm` → `max-w-[230px]` on `variant === 'masonry'` at `EventCard.tsx:240` (card root) and `:148` (skeleton).
  - 2.2 Leave `PostCard.tsx` untouched; confirm with a grep that the identical literal there is unchanged in the diff.
  - 2.3 Re-check the masonry-default reserved overlay: `EventCard.tsx` measures the date box via `dateBoxRef`/`dateBoxSize` and positions the overlay off `left: calc(${dateBoxSize.w}px + 0.5rem)` (`:290`) and `height: ${dateBoxSize.h}px` (`:293`). The 230px cap changes every measured value, so re-verify the overlay still lands correctly at the capped width — no rule names this, but the cap silently moves its inputs.
- **Task 3 — Prominent-poster crop (AC2).**
  - 3.1 `aspect-[2/3]` → `aspect-square` at `EventCard.tsx:348`.
  - 3.2 Update `EventCard.test.tsx:256`, `:930`, `:950`.
- **Task 4 — "Now" label (AC3, AC8).**
  - 4.1 Change the default at `EventCard.tsx:99`, `WeeklyCalendarView.tsx:298`, `format-event-date.ts:188`.
  - 4.2 Update `format-event-date.test.ts:190`, `EventCard.test.tsx:879`, `WeeklyCalendarView.test.tsx:1473`.
  - 4.3 Amend Story 1.i1i's AC quote in `epics.md` with a dated supersede note (AC8).
- **Task 5 — Pill positions and badge harmonization (AC4, AC5). Depends on Task 1.**
  - 5.1 Thread the TILL-present condition into the prominent-poster branch and apply `top-2`/`top-5` to the date pill (`EventCard.tsx:355`) and the favorite pill (`:254`), gated to `variant === 'masonry'`.
  - 5.2 Apply `left-2`/`right-2` and uniform `p-1` on the date pill.
  - 5.3 Bring TILL (`EventCardMediaPrimitives.tsx:49`) and the calendar row's `multi-day-badge` (`WeeklyCalendarView.tsx:1103`) up to the 11px floor; confirm `favorite-count-line` (`:1097`), `EventCardStatusBadge` (`:246`) and `EventCardNearbyBadge` (`:282`) need no change.
  - 5.4 Replace `px-2.5 py-1.5` with `px-1.5 py-1` at **both** `EventCardMediaPrimitives.tsx:175` and `EventCard.tsx:255`.
  - 5.5 Drop the hardcoded `text-xs` on the count text at `EventCardMediaPrimitives.tsx:193` and `EventCard.tsx:266` so the pill's size cascades.
  - **Implement and screenshot-validate 5.1-5.2 together with 5.3-5.5, in that order.** The `top-5`/`-top-3` offsets were validated in a prototype panel that hardcodes `text-[12px] p-1`; growing that pill to `text-sm` (14px) moves the geometry those offsets were tuned against, so validating the positions before the sizes land would validate the wrong thing.
- **Task 6 — Compact-row title wrap (AC6).**
  - 6.1 `truncate` → `line-clamp-2` at `WeeklyCalendarView.tsx:1094`.
  - 6.2 Remove the parent's `truncate` and switch `items-center` → `items-start` at `:1087`.
  - 6.3 Leave `:1160`/`:1167` (`variant='grid'`) untouched; add/confirm a test that `variant='grid'` is unaffected.
- **Task 7 — Container-query mechanism (AC7). Do 7.1 before writing any of Task 5's font classes.**
  - 7.1 Determine empirically which candidate emits real CSS in this repo (install deps, build, inspect the generated stylesheet for the `@container` at-rule). Start with the plugin-free arbitrary-variant form; fall back to the official plugin only if it produces nothing.
  - 7.2 Declare `container-type: inline-size` on the masonry card root.
  - 7.3 Apply the stepped badge font-size and add the assertion that the generated CSS contains the `@container` rule.
- **Task 8 — Tests (all ACs).**
  - 8.1 The updated assertions from Tasks 3, 4, 6.
  - 8.2 New: the "favorite badge font-size >= TILL badge font-size" invariant at both card widths (AC5).
  - 8.3 New: the TILL offset differs by context (`-top-1.5` vs `-top-3`) (AC4).
  - 8.4 New: `variant='standard'` keeps `max-w-sm`, `top-3`, `right-3` — the regression guard for AC1/AC4's variant gating.
- **Task 9 — Verification.** Full `packages/ui` test run, `lint`, `tsc --noEmit`; `git diff` confirming `PostCard.tsx`, `EventCardCalendarGridItem.tsx` and the `variant='grid'` block are untouched.

## Dev Notes

### Files read in full before drafting this story

Current-state summary, so `bmad-dev-story` does not re-derive it:

- `packages/ui/src/features/events/EventCard.tsx` — `variant` defaults to `'standard'` (`:63`); `prominentPoster` to `false` (`:87`); `isMasonryDefault = variant === 'masonry' && !prominentPoster` (`:114`). The `!isMasonryDefault` branches therefore serve **both** `masonry+prominentPoster` and `standard` — this is the single most common source of over-broad edits in this file and is why AC1 and AC4 both carry explicit variant gates.
- `packages/ui/src/features/events/EventCardMediaPrimitives.tsx` — `EventCardMediaSlot` (`:55-135`), `EventCardFavoriteBadge` (`:141-196`), `EventCardDateBox` (`:200-226`), `EventCardStatusBadge` (`:240-`), `EventCardNearbyBadge` (`:278-`). `EVENT_CARD_TILL_LABEL_CLASS` at `:48-49`.
- `packages/ui/src/features/events/WeeklyCalendarView.tsx` — `variant === 'list'` branch at `:1042-1135`; `variant === 'grid'` from `:1137`. The list branch already carries Story 1.i1j's status/nearby badges and Story 1.i1k's `size="compact"` date box.
- `packages/ui/src/features/events/event-card-media-tokens.ts` — AD-15 in full, including Story 1.i1k's `EVENT_CARD_BADGE_FONT_SIZE_BY_SIZE` / `badgeFontSizeStyleFor`.
- `packages/ui/src/features/events/index.ts` — confirms `export * from './format-event-date'` at `:21`, which is what makes rule 3's default a package-level default (AC3).
- `packages/ui/src/features/events/{EventCard,EventCardMediaPrimitives,WeeklyCalendarView,EventCardCalendarGridItem}.test.tsx`, `format-event-date.test.ts` — grepped for every assertion pinning a class string or label this story changes; the six named in AC2/AC3 are the complete set found.
- `design-artifacts/UX-festgrid-run-1/DESIGN.md` — `event_card_compact` (`:104-172`), `event_card_masonry` (`:298-357`), `event_card_date_box` (`:358-412`), `event_card_till_badge` (`:440-478`), `event_card_status_badge` (`:479-`) read in full.
- `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md` — "Masonry EventCard: Date Box, TILL Badge, and Status/Nearby Badge Row" (`:172-205`) and "Masonry EventCard Badge Row" (`:441-450`) read in full.
- `design-artifacts/UX-festgrid-run-1/prototypes/event-card-masonry/prominent-poster.html` (Panels A-D), `.../default-with-thumbnail.html`, `.../event-card-calendar-row/thumbnail-fallback.html` — read for the literal validated classes quoted throughout the ACs.
- `_bmad-output/implementation-artifacts/1-i1k-…md` — used as this story's structural template and for the AD-15 recalibration context.
- `_bmad-output/planning-artifacts/epic-readiness/epic-1-i1-readiness.md` — Gate 1/3 sweep, `swept: true`.

### Verification of the board row's own audit

`IDEA-046`'s capture is dated 2026-09-20 and explicitly says "Verify each row's code reference before drafting (this audit is a point-in-time check, and 1.i1i/1.i1j/1.i1k all touch these same components)." All seven were re-verified against `c80cd9b` (2026-09-21, after 1.i1i/1.i1j/1.i1k landed). **All seven still reproduce.** Two of the row's code references have moved or widened since the audit and are corrected in the ACs above:

- Rule 3 named two default sites; there are now **three** — Story 1.i1j added `WeeklyCalendarView.tsx:298`.
- Rule 5 named the primitive's favorite pill only; the identical `px-2.5 py-1.5` literal also survives inline at `EventCard.tsx:255`.

### HIL decisions made during this story's drafting

Recorded here, not silently decided. The first two were escalated to the user; the rest were judgment calls within this workflow's "routine mechanical choice" threshold.

1. **Both font steps kept, keyed to the card's own width (user decision, 2026-09-21).** Rule 5 specifies `text-xs` "mobile" / `text-sm` "desktop" at the real card width, but rule 1 caps every masonry card at 230px — after which the viewport no longer predicts the card's width, so a viewport breakpoint would grow the type on a card that did not actually get wider. Options put to the user were (a) keep both steps triggered by the card's own width, or (b) drop the desktop step and ship 12px everywhere. **User chose (a)**, which is also the spec-faithful reading: the prototypes demonstrate two genuinely different card widths, not two viewports. Mechanism is AC7.
2. **The 11px floor applies to every badge on the three card families (user decision, 2026-09-21).** EXPERIENCE.md states the floor as "a user-directed general rule … across all three card families", but names four badge families. Two badges on the same calendar row are outside the four: `multi-day-badge` at `text-[10px]` and `favorite-count-line` at `text-[11px]`. Options were (a) apply the floor to every badge on those cards, or (b) stick to the four named families and knowingly accept a 10px badge beside 12px siblings. **User chose (a).** Consequence: `WeeklyCalendarView.tsx:1103` is in scope; `:1097` is confirmed already at the floor.
3. **DESIGN.md wins over the prototype on the prominent date pill's padding.** DESIGN.md's token is `p-1` and its prose records uniform padding as an explicit user ruling ("a padding trick … was tried and explicitly rejected"); the prototype's Panel B shows `px-2 py-1`. Token source of truth wins; the discrepancy is recorded in AC4 rather than reconciled silently.
4. **`aspect-square` stays on the wrapper, not moved onto the `<img>`.** DESIGN.md's token reads `w-full aspect-square object-cover` as one image class; the code splits it (aspect on the wrapper, `object-cover w-full h-full` on the img). Equivalent rendering, and restructuring would touch the fallback branch this story has no business in.
5. **The TILL constant becomes a context-keyed helper inside this story, not a prerequisite story.** It is a genuine shared-util change with three call sites and does trip a Gate 2 trigger — but its only consumers are rules 4 and 5 themselves, so a prerequisite story would carry no independent value and would force the prominent-poster screenshot validation to be paid twice. It is Task 1 instead, with rules 4 and 5 stated as depending on it.

### Architecture & UX Gate Findings

`epic-1-i1-readiness.md` is `swept: true` for Epic 1.i1, so Gates 1 and 3 are cited from it rather than re-run. Its `stories_covered` frontmatter lists only 1.i1a-e/1.i1z (swept 2026-09-13, before 1.i1f-l existed) — narrower than this story — so the workflow's lightweight escape-hatch guard was applied.

- **Gate 1 — no gap**, cited from the sweep ("pure presentational `packages/ui` work end to end") and reconfirmed directly: this story touches no resolver, query, mutation, DB/ORM call, external service or new API surface. Sibling Stories 1.i1f/1.i1i/1.i1j/1.i1k all cite the same sweep on the same reasoning.
  - **Escape-hatch check:** the one thing the 2026-09-13 sweep could not have anticipated is AC7's container query — the repo's first. It was assessed as **not** a Gate 1 finding: candidate (a) adds no dependency and no shared-config change at all, and even candidate (b) is a single official Tailwind plugin registration in `apps/web/tailwind.config.ts`, not an infrastructure or deployment dependency. `packages/ui` has exactly one consumer (`apps/web`, confirmed by grep across every `package.json`), so the blast radius is contained. Noted here so a future reviewer sees it was considered rather than missed.
- **Gate 3 — no gap**, cited from the sweep and reconfirmed. No global shell, i18n foundation, analytics wiring or codegen dependency is implicated. Rule 3 changes an existing default string in `packages/ui`; the label props are already threaded but deliberately unwired to `next-intl`, a pre-existing cross-cutting gap this epic has consistently deferred (see Story 1.i1j's own Dev Notes). Grep confirms no `apps/web` file passes or overrides these labels today, so no locale JSON changes are required by this story.
- **Gate 2 — GAP FOUND, split applied (run fresh, Freya persona, 2026-09-21).** Rule 7 of `IDEA-046` (the calendar row's reserved-slot reversal) is **carved out of this story into sibling Story 1.i1m**. Three independent reasons, any one of which would have been enough:
  1. It forks the **contract of a shared primitive**. `EventCardMediaSlot` owns the reserved-blank fallback for masonry *and* the compact row; after rule 7 the two families diverge permanently (masonry keeps WCAG 2.4.3 reserved space, the row omits the element). That is a behavioural fork, not a class swap.
  2. It **contradicts a shipped acceptance criterion and two live CI ratchet tests.** Story 1.i1z's AC3 asserts that *every* card surface including the calendar compact row "renders reserved-but-blank on image error with no layout shift"; `WeeklyCalendarView.test.tsx` (~`:1189`, ~`:1221`) ratchets exactly that. Resolving it means amending a shipped AC and replacing those tests with inverted ratchets — governance work with its own reviewer, not a line change reviewed alongside six Tailwind swaps.
  3. Its "favorite control grows into the freed space" behaviour is **not expressible in AD-15**. `EventCardFavoriteBadge` has two fixed scales (ratios 2 and 5/3); the prototype demands a 36px icon at a 326px row and 56px at 655px. Worse, removing the slot removes the element that declares `--event-card-badge-font-size` (`EventCardMediaPrimitives.tsx:85`), so the badge silently falls through to `eventCardBadgeIconSizeStyle`'s inline `0.75rem` default and the icon *shrinks* from 28px to 24px — a regression that happens whether or not anyone notices.
  - Story 1.i1m is a **sibling, not a prerequisite** — no hard ordering. Doing this story first is mildly convenient (the badge padding/size work settles before the row's badge starts growing), but neither blocks the other.
  - **Nothing else was split.** The TILL-helper refactor was explicitly considered and kept inline (HIL decision 5 above).

### Residuals found during drafting that this story does NOT cover

Carved into **backlog row `IDEA-048`** (child of `IDEA-046`), not absorbed. Both sit in the same `event_card_compact` token block as rules 6 and 7, were user-directed in the same 2026-09-14 pass, and belong with Story 1.i1m's restructure of that row rather than with this story's class-level fixes:

- **`event_card_compact.venue` is not rendered at all.** DESIGN.md `:52` adds an explicit `venue: "text-xs text-muted-foreground truncate"` token, and `WeeklyCalendarViewScheduleShape.locationName` is already plumbed (Story 1.i1g). The compact row has no venue line today. Note that rule 6's own source text — 1.i1d's amendment, "(2) Title now wraps up to 2 lines (was truncate); venue stays 1 line" — presumes a venue line that was never built.
- **`event_card_compact.image_wrapper` / `favorite_badge` reversal.** DESIGN.md `:53-55` moves the favorite pill out of a corner overlay on the thumbnail into a vertical stack below it (`image_wrapper`, "REVERSES the prior corner-overlay composition"), with the glassmorphism dropped. Today `EventCardMediaSlot layout="fixed-square"` still corner-overlays it (`EventCardMediaPrimitives.tsx:96-104`). This is the **with-image** composition, the exact counterpart to rule 7's no-image one.

Also carved, into **`FIND-046`** (child of `IDEA-046`): `prototypes/validation-log.md` records rounds 1-4 only, while `DESIGN.md`/`EXPERIENCE.md` cite user-directed revisions through round 8 — so four of the six rules this story implements (1, 3's colour half, 4, 5) have **no screenshot re-validation record**. The file already carries a 2026-09-20 coverage note saying as much. This story implements to the written spec, which is unambiguous; re-establishing the fidelity record is separate work and is not a prerequisite.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: no mismatch found.**
- **Impacted contracts:** `EVENT_CARD_TILL_LABEL_CLASS` (an exported `packages/ui` string constant) becomes a context-keyed function — an internal `packages/ui` export with three in-repo consumers, all migrated in the same commit (Task 1). Not a GraphQL, DB or cross-package contract.
- **Required DB migration changes:** No changes required — no DB or GraphQL schema is touched.
- **Required TypeScript type changes:** none beyond the helper's own signature. No prop interface changes: every rule here is a class-string or default-string change.
- **Backward compatibility / rollout:** `packages/ui` has exactly one consumer (`apps/web`), and the changed export is not referenced outside `packages/ui/src/features/events/` (verify via Task 1.4's grep). No staged rollout needed.
- **Verification:** Task 8's suite plus Task 9's full `test`/`lint`/`tsc --noEmit`.

### Project Structure Notes

- **Modifies:** `packages/ui/src/features/events/EventCard.tsx`, `EventCardMediaPrimitives.tsx`, `WeeklyCalendarView.tsx`, `format-event-date.ts`, and the four test files named in the ACs; `_bmad-output/planning-artifacts/epics.md` (AC8's amendment plus this story's and 1.i1m's own sections); possibly `apps/web/tailwind.config.ts` + `apps/web/package.json` (only under AC7 candidate (b)).
- **New files:** none expected.
- **No `packages/domain` involvement** — pure presentational `packages/ui` work, matching this epic's established precedent. Nothing here is framework-agnostic business logic.
- **Explicitly not touched:** `packages/ui/src/features/posts/PostCard.tsx` (identical literal, different card family), `EventCardCalendarGridItem.tsx`, `EventDetailView.tsx`, and `WeeklyCalendarView.tsx`'s `variant='grid'` branch. Verify via `git diff` (Task 9).

### References

- `_bmad-output/implementation-artifacts/backlog/IDEA-046-prototype-fidelity-residuals.md` — the board row, including its prototype→story matrix and the full seven-residual table.
- `design-artifacts/UX-festgrid-run-1/DESIGN.md` — token source of truth for every class literal quoted in the ACs.
- `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md` — the badge-row general rules (11px floor, favorite ≥ TILL, reserved-space-masonry-only).
- `design-artifacts/UX-festgrid-run-1/prototypes/` — the validated HTML; `prominent-poster.html` Panels A-D are the reference for AC4.
- `_bmad-output/planning-artifacts/epic-readiness/epic-1-i1-readiness.md` — the Gate 1/3 sweep this story cites.
- `_bmad-output/implementation-artifacts/1-i1k-…md` — the immediately preceding story; its AD-15 recalibration is the mechanism AC7 extends.

## Global Rules References

- `_bmad-output/project-context.md` — Code Organization (`packages/ui` component placement, no React in `packages/domain`), UI Patterns & UX Invariants (notably "Keep Skeletons in Sync With Their Real Component", which is why AC1 includes the skeleton), Testing Rules (testing-trophy; unit tests only for `packages/domain`), i18n rules (locale-sensitive rendering; why rule 3 changes defaults only and adds no locale JSON).
- `_bmad-output/planning-artifacts/story-content-structure.md` — this file's section order and status vocabulary.
- `_bmad-output/planning-artifacts/story-split-gate.md` — the three gates; Gate 2's split into Story 1.i1m is recorded above.
- `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — **AD-15** (Event Card Media Primitive; the icon-scale custom property AC7 extends).
- `docs/infrastructure/index.md` — no shard read; this story touches no backend compute, queue, API Gateway or database layer.
- `_bmad-output/implementation-artifacts/backlog-spec.md` — §13 promotion mechanics, applied to `IDEA-046`.

## Implementation Plan (Rule-Compliant)

### File Change Plan

| File | Change |
|---|---|
| `packages/ui/src/features/events/EventCardMediaPrimitives.tsx` | Context-keyed TILL class helper (T1); TILL font to the floor + responsive pair (T5.3); favorite pill padding `:175` (T5.4); count text `:193` (T5.5) |
| `packages/ui/src/features/events/EventCard.tsx` | Variant-gated 230px cap `:148`,`:240` (T2); `aspect-square` `:348` (T3); "Now" default `:99` (T4); pill positions `:254`,`:355` (T5.1-5.2); inline pill padding `:255` (T5.4); count text `:266` (T5.5); container root (T7.2) |
| `packages/ui/src/features/events/WeeklyCalendarView.tsx` | "Now" default `:298` (T4); multi-day badge floor `:1103` (T5.3); title wrap `:1087`,`:1094` (T6) |
| `packages/ui/src/features/events/format-event-date.ts` | "Now" fallback `:188` (T4) |
| `EventCard.test.tsx`, `EventCardMediaPrimitives.test.tsx`, `WeeklyCalendarView.test.tsx`, `format-event-date.test.ts` | Updated + new assertions (T8) |
| `_bmad-output/planning-artifacts/epics.md` | Story 1.i1i AC quote amendment (T4.3 / AC8) |
| `apps/web/tailwind.config.ts`, `apps/web/package.json` | **Only** under AC7 candidate (b) |

### Rule Mapping

- *project-context.md* "Keep Skeletons in Sync With Their Real Component" → AC1 includes `EventCard.tsx:148`.
- *project-context.md* Code Organization → every change stays in `packages/ui/src/features/<domain>/`; nothing is a candidate for `packages/domain` (all presentational).
- *project-context.md* i18n → rule 3 changes `packages/ui` defaults only; no locale JSON, because no `apps/web` consumer passes these labels today (grep-verified).
- *Architecture Spine AD-15* → AC7's container query extends the existing CSS-custom-property mechanism rather than introducing a parallel JS-measurement one.
- *Story 1.i1k's `no-dynamic-tailwind-arbitrary-value` lint rule* → AC7's "verify the generated CSS actually contains the `@container` rule" exists because this codebase has already shipped a Tailwind class that compiled to nothing.
- *story-split-gate.md* Gate 2 → rule 7 split to Story 1.i1m; recorded in Dev Notes and Out of Scope.
- *backlog-spec.md §13* → `IDEA-046` promoted with both story keys; uncovered scope carved to `IDEA-048` and `FIND-046`.

### Verification Plan

1. `pnpm --filter @festgrid/ui test` — full suite green (Story 1.i1k's baseline: 48 files / 465 tests).
2. `pnpm --filter @festgrid/ui lint` and `tsc --noEmit` — zero errors in every touched file.
3. **Generated-CSS check (AC7):** build and confirm the stylesheet contains the `@container` at-rule and the stepped font-size declarations. A JSDOM assertion alone cannot catch a class that compiled to nothing.
4. **Visual check at both card widths**, per Task 5's ordering note — positions and sizes validated together, not separately.
5. `git diff --stat` — confirm `PostCard.tsx`, `EventCardCalendarGridItem.tsx`, `EventDetailView.tsx` and the `variant='grid'` block are absent from the diff.

## Pre-Coding Approval Gate

- [x] **Scope confirmed** — six rules (1-6 of `IDEA-046`); rule 7 is explicitly *not* here (Story 1.i1m).
- [x] **Gate 2 split accepted** — rule 7 carved to Story 1.i1m as a sibling. Story 1.i1m is **not** a prerequisite; this story can be implemented first.
- [x] **Carve-outs accepted** — the compact row's missing venue line and its favorite-pill stack reversal are tracked as `IDEA-048`, not built here; the validation-log fidelity gap is tracked as `FIND-046`.
- [x] **Shipped-AC amendment approved** — Story 1.i1i's `epics.md` AC quote changes from "Happening Now" to "Now" (AC8). This edits an already-shipped story's acceptance criterion.
- [x] **Architecture and boundary confirmed** — pure `packages/ui` presentational work; Gates 1/3 cited from `epic-1-i1-readiness.md`; the container query assessed as not a Gate 1 finding.
- [x] **AC7's mechanism — RESOLVED 2026-09-21 (Task 7.1).** Candidate (a), the plugin-free Tailwind 3.4 arbitrary-variant form, compiles. No plugin was added and `apps/web/tailwind.config.ts` is untouched. Evidence is in the Debug Log below. Original gate text:  neither container-query candidate has been proven to compile in this repo. Task 7.1 must settle it empirically **before** any font class is written. If neither works, stop and re-escalate rather than falling back to a viewport breakpoint, which the user explicitly did not choose.
- [x] **Testing plan confirmed** — six updated assertions, four new ones, plus the generated-CSS check.
- [x] **Human approval:** granted 2026-09-21 — the two open scope questions were answered directly ("Keep both stage" → both font steps stay, keyed to the card's own width; "Do recommended" → the 11px floor applies to every badge on the three card families). Implementation authorised on branch `claude/project-thread-ij9lsl`.

## Testing Requirements

- Per project-context.md's testing-trophy rule, these are component/integration tests in `packages/ui`, not unit tests — `packages/domain` is untouched, so its 100%-coverage rule does not apply here.
- **Updated (6):** `EventCard.test.tsx:256`, `:930`, `:950` (rule 2); `format-event-date.test.ts:190`, `EventCard.test.tsx:879`, `WeeklyCalendarView.test.tsx:1473` (rule 3).
- **New (4):** favorite-font-size ≥ TILL-font-size at both card widths; TILL offset differs by context; `variant='standard'` keeps `max-w-sm`/`top-3`/`right-3`; `variant='grid'` unaffected by rule 6.
- **Build-level (1):** the generated stylesheet contains the `@container` rule (AC7).
- No E2E test is warranted — no user flow changes, only rendered chrome.

## Deliverables Checklist

- [x] Task 1 — context-keyed TILL class helper, all three consumers migrated
- [x] Task 2 — variant-gated 230px cap, overlay geometry re-checked
- [x] Task 3 — `aspect-square` + three assertions
- [x] Task 4 — "Now" across three defaults + three assertions + the `epics.md` amendment
- [x] Task 5 — pill positions and badge harmonization, implemented and validated in the stated order
- [x] Task 6 — compact-row title wrap including the parent `truncate` removal
- [x] Task 7 — container-query mechanism, empirically verified
- [x] Task 8 — six updated + four new assertions
- [x] Task 9 — full test / lint / typecheck, and the untouched-files diff check

## Out of Scope

- **Rule 7 of `IDEA-046`** — the calendar row's reserved-slot reversal, the favorite control's growth into the freed space, the Story 1.i1z AC3 amendment and its two inverted ratchet tests. **Story 1.i1m** (Gate 2 split, sibling not prerequisite).
- **The compact row's missing venue line and its `image_wrapper`/`favorite_badge` stack reversal** — backlog `IDEA-048`, child of `IDEA-046`; belongs with Story 1.i1m's restructure of that same composition.
- **Re-establishing `validation-log.md`'s fidelity record for rounds 5-8** — backlog `FIND-046`, child of `IDEA-046`. Not a prerequisite; the written spec is unambiguous for all six rules here.
- **`packages/ui/src/features/posts/PostCard.tsx`** — carries the byte-identical `max-w-sm` literal but is a different card family, outside `IDEA-046`'s scope and outside this epic's invariant.
- **Wiring `next-intl` for any label in this file family** — a pre-existing, cross-cutting gap this epic has deferred consistently since Story 1.i1d.
- **`EventCardCalendarGridItem.tsx`** — already conditionally renders its image (`showImage`) and already has no reserved slot; nothing for this story to do there.

## Definition of Done

- [x] All eight ACs satisfied, each traceable to its DESIGN.md/EXPERIENCE.md token.
- [x] Full `packages/ui` test suite green — 57 files / 652 tests, up from the 638 at this story's baseline. The updated assertions and the new ones all pass; the new count came in at 14 rather than the planned 4 (see Completion Notes).
- [x] `lint` clean — `pnpm lint` at the repo root is 7/7 green and `packages/ui`'s own `eslint . --max-warnings 0` passes. **Qualified:** a bare `tsc --noEmit -p packages/ui/tsconfig.json` emits one `TS5101` (`baseUrl` deprecated in TypeScript 7.0). That is a pre-existing config deprecation in a file this story does not touch, not a type error in the change; the repo's real gates (`lint`, `build`) are both green.
- [x] AC7's generated-CSS check passing — the `@container` rule is present in the built stylesheet, not merely in the source.
- [x] `git diff` confirms no out-of-scope file was modified — 11 files, all under `packages/ui/src/features/events/`. `PostCard.tsx`, `EventCardCalendarGridItem.tsx` and `EventDetailView.tsx` are absent from the diff, and the `variant='grid'` block is untouched.
- [x] `epics.md`'s Story 1.i1i AC amendment applied and dated.
- [x] Story 1.i1m exists in `epics.md` and `sprint-status.yaml`; `IDEA-048` and `FIND-046` exist in `backlog.yaml`.

## Completion Status

Created 2026-09-21 via `bmad-create-story` from backlog row `IDEA-046` (renumbered from `IDEA-043`). Ultimate context engine analysis completed — comprehensive developer guide created. Status: `ready-for-dev`, pending the Pre-Coding Approval Gate above.

## Dev Agent Record

### Agent Model Used

Claude Code, running the `bmad-dev-story` skill. Implemented 2026-09-21 in one continuous pass on branch `claude/project-thread-ij9lsl`, from baseline `c80cd9b`.

### Debug Log References

**Task 7.1 — the container-query mechanism, settled empirically (this was the story's one open risk).**

Candidate (a), the plugin-free Tailwind 3.4 arbitrary-variant form, compiles and behaves correctly. No dependency was added; `apps/web/tailwind.config.ts` is untouched. Verified against the real `apps/web` production build output, not the source:

| what | where in the bundle | value |
| --- | --- | --- |
| base step | `.text-xs` @ byte 29169 | `font-size:.75rem` (12px) |
| stepped-up | `@container(min-width:200px){...text-sm}` @ byte 68942 | `font-size:.875rem` (14px) |
| the container itself | `.[container-type:inline-size]` | `container-type:inline-size` |

Both rules land in the same stylesheet (`apps/web/.next/static/css/0e5cfe86f4d4cd62.css`) with the `@container` block **after** the base rule in source order, so it wins by cascade position whenever it matches. This is the check AC7 demanded: a class Tailwind cannot parse emits nothing at all and would have looked correct in JSDOM.

Chromium behaviour at the three widths that matter:

- 175px container → 12px (below the query's threshold).
- 230px container → 14px (rule 1's capped masonry width).
- **No `container-type` ancestor at all → 12px.** This is the load-bearing case. It is what lets one shared token serve both families: the masonry card declares a container and gets the responsive pair, while the calendar compact row declares none and stays at a static 12px — comfortably above the 11px floor rule 5 sets.

**Environment issues hit along the way (neither is a defect in this change):**

1. First test run failed 11 files with `Failed to resolve import "@festgrid/domain/geolocation"`. `@festgrid/domain` publishes subpath exports out of `dist/`, which did not exist yet. Fixed by `pnpm --filter @festgrid/domain... build`.
2. `pnpm build` failed in `apps/web` with `SELF_SIGNED_CERT_IN_CHAIN` while `next/font` fetched Inter from Google Fonts — the sandbox's egress proxy, not the diff. Re-running with `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt` builds clean, and that build is what the AC7 evidence above was read from.

### Completion Notes List

**Corrections to the story's own predictions.** The story is a plan written before `node_modules` existed; three of its specifics were wrong and are recorded here rather than quietly fixed:

1. **The updated-assertion count was 6; the real count is 8.** Two were unforeseen. The story missed a third consumer of the prominent-poster crop — `EventListView.test.tsx:428` selects on `.aspect-[2/3]`, and rule 2 changes what that selector matches, so it moved to `.aspect-square` too. And rule 4's TILL-offset change invalidated a shipped assertion the story did not list (see the next note). Final breakdown: `EventCard.test.tsx` 5, `EventListView.test.tsx` 1, `WeeklyCalendarView.test.tsx` 1, `format-event-date.test.ts` 1.
2. **`EventCard.test.tsx` pins `-top-1.5` at two sites, not one.** Line 773 is the masonry-**default** TILL case and line 804 is the **prominentPoster** case. Only the second changes to `-top-3`; the first is exactly the `'default'` context rule 4 keeps at `-top-1.5`, so an unscoped replace would have destroyed the very distinction AC4 introduces. Caught by a test failure, not by reading.
3. **The new-assertion count was 4; the real count is 14.** Splitting the planned four into their actual independent claims produced 6 in `EventCardMediaPrimitives.test.tsx` (shared font-size token, round-8 padding, count inherits, TILL offset by context, the 11px floor, and literal-string pinning), 4 in `EventCard.test.tsx` (the 230px cap and container declared on masonry only, skeleton parity so the cap causes no CLS on swap, `variant='standard'` keeping `top-3 right-3`, and both masonry pills moving to `top-5` together only when a TILL tag is present) and 4 in `WeeklyCalendarView.test.tsx` (the title wrap together with the parent-clip removal that would otherwise no-op it, icon alignment, the 11px badge floor, and the `variant='grid'` guard).

**A JSDOM limit, and what the tests assert instead.** JSDOM does not evaluate container queries, so no unit test can sample a computed font size across the step. AC5's "favorite badge font-size >= TILL badge font-size at both widths" is therefore ratcheted **structurally**: both badges are asserted to resolve their size from the one shared `EVENT_CARD_BADGE_TEXT_SIZE_CLASS` token, and that token is asserted to be a complete literal string. Equal-by-construction is a stronger guarantee than two sampled numbers, and it cannot drift. The numeric side is covered by the build-level check in the Debug Log.

**A test-fixture trap worth recording.** The first `variant='grid'` guard failed because its fixture was multi-day. On desktop a multi-day schedule renders as a *spanning bar* built from `EventCardCalendarGridItem` — a different component with its own title styling — so `getAllByText(...)[0]` never reached the day-cell title at `WeeklyCalendarView.tsx:1173` at all. The day-cell title is only reachable through a **single-day** schedule. The guard now uses one, with a comment saying why.

**Task 2.3's silent-input check.** Rule 1's cap changes every value `dateBoxRef`/`dateBoxSize` measures, which feed the masonry-default overlay's `left: calc(${dateBoxSize.w}px + 0.5rem)` and `height: ${dateBoxSize.h}px`. No rule names this. The geometry is derived at runtime from the measured box rather than from the card width, so the cap moves the inputs without invalidating the formula, and the shipped overlay tests stay green.

**Rule 5's ordering note was followed.** Positions (5.1-5.2) and sizes (5.3-5.5) landed together, not in separate passes — growing the pill to 14px moves the geometry the `top-5`/`-top-3` offsets were tuned against, so validating positions first would have validated the wrong thing.

**Deliberately outside the 11px floor.** `WeeklyCalendarView.tsx:1192` and `:1360` are tooltip `<p>` text, not badges; `FilterHub.tsx:164` is not one of the three card families. None is touched.

### File List

**Source (6):**

- `packages/ui/src/features/events/EventCardMediaPrimitives.tsx` — the frozen `EVENT_CARD_TILL_LABEL_CLASS` replaced by three exports: `eventCardTillLabelClass(context)`, the shared `EVENT_CARD_BADGE_TEXT_SIZE_CLASS` token and `EVENT_CARD_CONTAINER_CLASS`; favorite badge padding to `px-1.5 py-1`; the count span drops its hardcoded `text-xs`.
- `packages/ui/src/features/events/EventCard.tsx` — rules 1-5: `isMasonry` hoisted to component scope, the 230px cap and container declaration on card root and skeleton, `aspect-square`, the TILL-conditional `top-2`/`top-5` on both pills with `left-2`/`right-2` and uniform `p-1`, and `statusHappeningNow: 'Now'`.
- `packages/ui/src/features/events/WeeklyCalendarView.tsx` — rules 3, 5, 6: `'Now'`, the `multi-day-badge` to `text-[11px]`, and the compact-row title to `line-clamp-2` with the parent's `truncate` removed and `items-center` → `items-start`.
- `packages/ui/src/features/events/format-event-date.ts` — `formatEventStatus`'s own `'Now'` fallback.
- `packages/ui/src/features/events/EventCard.types.ts` — doc comment for the changed default.
- `packages/ui/src/features/events/WeeklyCalendarView.types.ts` — same.

**Tests (5):**

- `packages/ui/src/features/events/EventCardMediaPrimitives.test.tsx` — 6 new.
- `packages/ui/src/features/events/EventCard.test.tsx` — 5 updated, 4 new.
- `packages/ui/src/features/events/WeeklyCalendarView.test.tsx` — 1 updated, 4 new.
- `packages/ui/src/features/events/EventListView.test.tsx` — 1 updated (the third crop consumer the story missed).
- `packages/ui/src/features/events/format-event-date.test.ts` — 1 updated.

**Planning artifacts (4):**

- `_bmad-output/implementation-artifacts/1-i1l-apply-the-six-unowned-prototype-fidelity-rules.md` — this story.
- `_bmad-output/planning-artifacts/epics.md` — Stories 1.i1l and 1.i1m added; Story 1.i1i's shipped AC amended and dated (AC8).
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — both new story keys.
- `_bmad-output/implementation-artifacts/backlog.yaml` — `IDEA-046` promoted; `IDEA-048` and `FIND-046` added.

## Change Log

| Date | Change |
| --- | --- |
| 2026-09-21 | Story drafted by `bmad-create-story` from backlog row `IDEA-046` (renumbered from the requested `IDEA-043`). Gate 2 carved rule 7 into sibling Story 1.i1m. Status `ready-for-dev`. |
| 2026-09-21 | Two scope questions answered by the user: both badge font steps kept and keyed to the card's own width; the 11px floor extended to every badge on the three card families. Pre-Coding Approval Gate cleared. |
| 2026-09-21 | `bmad-dev-story`: Tasks 1-9 implemented. AC7's mechanism settled empirically in favour of the plugin-free arbitrary-variant form and verified in the built stylesheet. 8 assertions updated, 14 added. Suite 652/652, lint 7/7, `apps/web` build clean. Status `in-progress` → `review`. |

## Status

**review** — all eight ACs satisfied and every task complete. Verification actually run: `pnpm --filter @festgrid/ui test` (57 files / 652 tests green), `pnpm lint` at the repo root (7/7, warnings all pre-existing and none in `packages/ui`), `packages/ui`'s own `eslint . --max-warnings 0`, `pnpm build` (7/7 with the proxy CA set), the AC7 generated-CSS grep against `apps/web/.next/static/css/`, and the `git diff --stat` out-of-scope check. The one qualification is the pre-existing `TS5101` `baseUrl` deprecation in `packages/ui/tsconfig.json`, recorded in the Definition of Done above.
