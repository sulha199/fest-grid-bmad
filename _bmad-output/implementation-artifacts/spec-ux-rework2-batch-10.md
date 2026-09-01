---
title: 'Fix FilterHub collapse: untranslated button + scroll-anchoring flicker loop'
type: 'bugfix'
created: '2026-09-01'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: '1d904e06776f31badeee983f1ed56fff2d5bd978'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Two bugs in the collapsible sticky `EventDiscoveryPanel` header (`spec-ux-rework2-batch-6.md`). (1) `showFiltersLabel?: string` was added to the component's prop type in batch-6 but no caller was ever wired to pass it — the "Show filters" button always falls through to the hardcoded English default (`EventDiscoveryPanel.tsx:73`, `showFiltersLabel || 'Show filters'`). (2) Once scrolled past the collapse threshold, the header continuously toggles collapsed/expanded in a tight loop (visible blinking) — root-caused empirically (isolated CSS repro via Playwright, independent of any app data/backend): collapsing the sticky header shrinks its own rendered height by ~200px; Chromium's CSS Scroll Anchoring feature then auto-adjusts `window.scrollY` to compensate for that layout shift, pulling it back below the collapse threshold, which flips the header back to expanded, re-triggering the same shift in reverse, forever. Confirmed via a minimal standalone repro (sticky header shrinking on a tall page, no bottom-of-page or app-specific involvement) that `overflow-anchor: none` — the browser's own sanctioned opt-out for this exact scenario — fully eliminates it when applied broadly enough (the anchor candidate isn't necessarily inside the header's own subtree; a repro applying the property only to the header and its descendants still oscillated, while applying it to the panel's outer wrapper + all descendants settled in one clean scroll event).

**Approach:** (1) Wire `showFiltersLabel={t('showFiltersLabel')}` in each of the 4 real app callers (`home-content.tsx`, `feed-content.tsx`, `favorites-content.tsx`, `account-content.tsx`), each already using `useTranslations()` with its own namespace, matching the existing `searchPlaceholder`/`searchClearLabel` pattern; add the key to both locale files. (2) Add `overflow-anchor: none` to `EventDiscoveryPanel`'s outer wrapper div and all its descendants (Tailwind arbitrary properties: `[overflow-anchor:none] [&_*]:[overflow-anchor:none]`), which is the entire subtree this shared component renders (the sticky header plus each page's `activeContent`).

## Boundaries & Constraints

**Always:** No change to `useCollapseHeaderOnScroll.ts`'s threshold logic — the oscillation is a pure CSS/browser-compensation artifact, not a JS state-machine bug (empirically proven: the exact same JS logic, unmodified, stops oscillating once scroll anchoring is disabled in its DOM subtree). Every one of the 4 real app pages must get the translated label — do not fix only one and leave the others on the fallback.

**Ask First:** None anticipated — CSS-only fix for the flicker, a prop-wiring + locale-key fix for the label, matching established patterns exactly.

**Never:** Do not touch `apps/web/src/app/[locale]/widget/[id]/page.tsx` — it already hardcodes `searchPlaceholder`/`searchClearLabel` as literal English strings (a separate, pre-existing, out-of-scope inconsistency for the embeddable widget context, not introduced or worsened here; log it to `deferred-work.md`, don't fix it in this batch). Do not disable `overflow-anchor` any more broadly than `EventDiscoveryPanel`'s own rendered subtree (e.g. not on `<html>`/`<body>`) — scroll anchoring remains a legitimate, useful browser behavior for unrelated parts of the app; the fix must be scoped to only the component that has the layout-shift problem.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Collapsed-state button render | Page scrolled past the collapse threshold, `id` locale active | Button reads "Tampilkan filter" (or the `id.json` equivalent), not the English fallback | N/A |
| Scroll past threshold | `window.scrollY` crosses the measured-height threshold | Header collapses exactly once and stays collapsed — no repeated toggling, no visible blink | N/A |
| Scroll back to top | User scrolls back above the threshold, or clicks "Show filters" | Header expands exactly once and stays expanded | N/A |

</frozen-after-approval>

## Code Map

- `packages/ui/src/features/events/EventDiscoveryPanel.tsx:56` -- outer wrapper `<div className="space-y-8 ${className}">`; add `[overflow-anchor:none] [&_*]:[overflow-anchor:none]` to its className, covering the sticky header and `{activeContent}` (both siblings inside this div)
- `apps/web/src/app/[locale]/home-content.tsx:39,210` -- `t = useTranslations('DiscoveryPage')`; add `showFiltersLabel={t('showFiltersLabel')}` alongside the existing `searchPlaceholder`/`searchClearLabel` props on `<EventDiscoveryPanel>`
- `apps/web/src/app/[locale]/feed/feed-content.tsx:33,236` -- `t = useTranslations("FeedPage")`; same wiring
- `apps/web/src/app/[locale]/favorites/favorites-content.tsx:75,308` -- `t = useTranslations("FavoritesPage")`; same wiring
- `apps/web/src/app/[locale]/[platformSlug]/[accountId]/account-content.tsx:47,233` -- `t = useTranslations("AccountPage")`; same wiring
- `apps/web/locales/en.json` -- add `"showFiltersLabel": "Show filters"` under `DiscoveryPage` (line ~246), `FeedPage` (~271), `FavoritesPage` (~297), `AccountPage` (~54)
- `apps/web/locales/id.json` -- add the Indonesian equivalent under the same 4 namespaces

## Tasks & Acceptance

**Execution:**
- [x] `packages/ui/src/features/events/EventDiscoveryPanel.tsx` -- added `overflow-anchor: none` (self + all descendants via `[&_*]`) to the outer wrapper div
- [x] `apps/web/src/app/[locale]/home-content.tsx` -- passes `showFiltersLabel={t('showFiltersLabel')}`
- [x] `apps/web/src/app/[locale]/feed/feed-content.tsx` -- passes `showFiltersLabel={t('showFiltersLabel')}`
- [x] `apps/web/src/app/[locale]/favorites/favorites-content.tsx` -- passes `showFiltersLabel={t('showFiltersLabel')}`
- [x] `apps/web/src/app/[locale]/[platformSlug]/[accountId]/account-content.tsx` -- passes `showFiltersLabel={t('showFiltersLabel')}`
- [x] `apps/web/locales/en.json` / `id.json` -- added `showFiltersLabel` under `DiscoveryPage`, `FeedPage`, `FavoritesPage`, `AccountPage`
- [x] `EventDiscoveryPanel.test.tsx` -- added a test asserting the collapsed button renders a passed `showFiltersLabel` rather than the literal fallback

**Acceptance Criteria:**
- Given the `id` locale, when a discovery-type page's header is collapsed by scroll, then the button text is the Indonesian translation, not "Show filters".
- Given any of the 4 real app pages scrolled past the collapse threshold, when the page settles, then the header's `hidden`/visible state stops changing (no continuous toggling) — verified by the CSS fix having eliminated the empirically-reproduced scroll-anchoring loop.
- Given the widget page (`widget/[id]/page.tsx`), when reviewed, then it is unchanged by this batch (still using its own pre-existing hardcoded strings, logged as out of scope).

## Suggested Review Order

- Entry point -- the CSS fix: [`EventDiscoveryPanel.tsx:56`](../../packages/ui/src/features/events/EventDiscoveryPanel.tsx#L56)
- The label wiring, identical pattern across 4 files: [`home-content.tsx:212`](../../apps/web/src/app/%5Blocale%5D/home-content.tsx#L212), [`feed-content.tsx:238`](../../apps/web/src/app/%5Blocale%5D/feed/feed-content.tsx#L238), [`favorites-content.tsx:310`](../../apps/web/src/app/%5Blocale%5D/favorites/favorites-content.tsx#L310), [`account-content.tsx:235`](../../apps/web/src/app/%5Blocale%5D/%5BplatformSlug%5D/%5BaccountId%5D/account-content.tsx#L235)
- Locale keys: [`en.json`](../../apps/web/locales/en.json), [`id.json`](../../apps/web/locales/id.json)
- Tests: [`EventDiscoveryPanel.test.tsx:279-291`](../../packages/ui/src/features/events/EventDiscoveryPanel.test.tsx#L279-L291)

## Spec Change Log

- `cline-cli` hung twice delegating this batch (once via `--worktree`, ~2h12m zero progress with a healthy hub; once via a manually-created worktree with an explicit `--timeout 600` that didn't actually enforce its cap, ~26 minutes over with zero progress). Implemented directly and performed the Blind Hunter / Edge Case Hunter review directly instead of delegating, per established precedent from batch-9's own cline outage. Logged to `deferred-work.md` and memory.
- Mid-batch, the user asked for a deterministic PowerShell script to handle worktree setup instead of leaving it to cline's own agent loop -- built and committed `scripts/cline-worktree.ps1` (tested end-to-end: create + remove) as a separate, immediately-useful deliverable alongside this batch's own fix.

## Design Notes

The flicker's root cause was verified empirically, not assumed: a minimal standalone HTML+JS repro (no React, no app dependencies) reproducing just the sticky-header-shrinks-on-scroll CSS pattern, driven via a throwaway Playwright script, logging every `scroll` event's `scrollY` alongside the collapse decision. This isolated the exact mechanism (CSS Scroll Anchoring, not a JS threshold bug, not bottom-of-page clamping) and validated the fix's correct scope before writing any real code — `overflow-anchor: none` on only the header (or only the header's own descendants) was empirically insufficient; the property had to cover the panel's full rendered subtree (header + content) to fully stop the loop, since `overflow-anchor` is not inherited and the browser's chosen anchor candidate was in the sibling content area, not the header itself.

## Verification

**Commands:**
- `pnpm --filter @festgrid/ui test EventDiscoveryPanel` -- 12/12 passed (11 existing + 1 new `showFiltersLabel` test)
- `pnpm --filter web test home-content feed-content favorites-content account-content` -- `home-content.tsx` has no dedicated test file (covered by `page.test.tsx`, separately run: 9/9 passed); `feed-content`/`favorites-content`/`account-content` -- 12/12 passed
- `pnpm --filter web test locales.test` -- 40/40 passed (en/id key-parity check, confirms the new `showFiltersLabel` key was added symmetrically to both locale files)
- `pnpm --filter web build` -- succeeded, no TypeScript errors
- `pnpm test` (full monorepo) -- 1 failure in `@festgrid/ui#test` (`WeeklyCalendarView.test.tsx`'s week-picker test, hardcoded `2026-08-10` vs the now-real `2026-09-10`) -- the same pre-existing, already-documented wall-clock-date-rollover flakiness found and root-caused during batch-9's verification (`deferred-work.md`), unrelated to this batch. All other packages, including `web`'s full suite, passed cleanly.

**Adversarial review:** Performed directly (Blind Hunter + Edge Case Hunter prompts/rigor, `cline-cli` was hung -- see Spec Change Log). No blocking issues found. One real, non-blocking gap logged to `deferred-work.md`: no automated regression test exists for the flicker fix itself, since jsdom has no real CSS Scroll Anchoring implementation to exercise it against.
