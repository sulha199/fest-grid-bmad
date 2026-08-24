# Sprint Change Proposal — 2026-08-24: UX Rework Batch (Redesign & Scope Track)

**Trigger:** [`ux-rework-2026-08-24.md`](ux-rework-2026-08-24.md) — a raw UX/product punch list, originally dropped at the project root and moved here (with a full item-by-item disposition table) once triage completed. Item #1 (main page container width) was missed by the initial triage pass and remains untracked — flagged in that file, not covered by this proposal. Items #7, #8, #9 (autocomplete/wizard-layout bugs) were routed directly to `bmad-create-story` and are out of scope here. Item #6 (mandatory default location) was explicitly dropped by the user in favor of item #14's AI-inference approach. This proposal covers the remaining **9 items**, pre-triaged and decided across two conversation passes with the user before this workflow started.
**Mode:** Batch
**Prepared by:** Amelia (Dev), via `bmad-correct-course`
**Scope classification:** **Major** — two items (the system-funded Gemini key, and the settings-IA restructuring) require PRD/architecture amendments and a short UX pass before stories are ready to build; the remaining seven are Moderate/Minor additive changes to existing epics.

---

## Section 1: Issue Summary

The user is past MVP feature-complete (Epics 1–6 all `review`/`done` in `sprint-status.yaml`) and is now working through a post-shipment UX punch list. Nine items require real product/architecture decisions rather than pure bug fixes, so they're being run through Correct Course rather than straight to story creation — matching this project's own precedent (`sprint-change-proposal-2026-08-13-discovery-detail-calendar-ux.md`, `...-08-16-detail-carousel-ux-fixes.md`).

**Decisions locked in prior discussion** (carried into this proposal as settled inputs, not re-litigated):

| # | Item | Decision |
|---|---|---|
| 12 | Disable Twitter | Hide from new subscriptions only; existing subscriptions keep running |
| 4/5 | Settings IA | Two separate tabbed shells (user settings vs. moderator tools), not one; Locations and Widgets stay standalone outside both |
| 10 | Card view mode | Add a 2-col Pinterest-style masonry mode, reference screenshot reviewed (native-aspect-ratio poster image as card body, relative-day pill, heart+count badge) |
| — | Date display | Same-week events show a relative-day label; >7 days out shows an absolute date |
| — | Like/favorite count | Show on all card views **and** calendar view; calendar items may grow to two lines to fit it |
| 3 | Wizard scope | Incorporate post selection (5.5) + push-notification opt-in (2.9), ending at `/feed` |
| 2 | Location filter | Compact inline variant inside the existing `FilterHub` |
| 11 | Mobile calendar | Vertical day list, skip empty days — multi-day-span rendering still **open**, not decided |

**Decisions made during this workflow run**, after checking them against the actual PRD/codebase (see findings below):

| Topic | Finding | Decision |
|---|---|---|
| Item #14 input data | PRD §5 has an explicit "Location Data Reuse Boundary" forbidding a user's saved location from being used to infer an unrelated entity's location — the literal reading of "based on the user profile" would have violated it | Resolved: Gemini is fed the **post/account's own scraped metadata** (`locationName`, `ownerFullName`, `ownerUsername` — already present in the raw Apify payload, see §2) — never the subscriber's `UserLocationPreference`. No PRD conflict. |
| Item #14 key fallback | "System key" doesn't exist in the codebase today — `selectApiKey` (Story 0.13) only rotates *subscribers'* own BYOK keys; a platform-funded key is a Phase 2 concept (PRD §6, not yet built) | User chose to pull this forward as a narrow, scoped exception — see §4.1. |
| Item #14 persistence | Should the inference write to `defaultLocation` or stay per-post? | Persist to `defaultLocation` — reuses the existing moderator notify/accept/revert flow (PRD §3.7) rather than inventing a new review mechanism. |
| Item #12 side effect | `SUPPORTED_PLATFORMS` (`packages/domain/src/subscriptions/platforms.ts`) gates both new subscriptions *and* new account votes (PRD §3.13 requires votable platforms to be scrapable) | Block both — single list, no new distinction introduced. |

**Pre-existing doc drift found, unrelated to this batch but touched by it:** `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md`'s Information Architecture list (lines 28–32) already omits `/settings/queue-status` and `/settings/widgets`, which exist in the shipped app and are registered in the User Menu section further down the same file. This proposal's IA rewrite (§4.2) corrects it as a side effect.

### Mandatory references used
- [`_bmad-output/project-context.md`](../project-context.md)
- [`prd.md`](prds/festgrid-prd-2026-07-10-2047/prd.md)
- [`festgrid-architecture-spine.md`](festgrid-architecture-spine.md)
- [`design-artifacts/UX-festgrid-run-1/EXPERIENCE.md`](../../design-artifacts/UX-festgrid-run-1/EXPERIENCE.md) + `DESIGN.md`
- [`design-artifacts/UX-wizard-page-run-1/EXPERIENCE.md`](../../design-artifacts/UX-wizard-page-run-1/EXPERIENCE.md) + `DESIGN.md`
- Codebase verification: `apps/backend/src/schema/resolvers.ts`, `apps/backend/src/lib/scraper/register-adapters.ts`, `packages/domain/src/subscriptions/platforms.ts`, `apps/web/src/app/[locale]/settings/**`, `apps/web/src/app/[locale]/moderator/**`, `_bmad-output/implementation-artifacts/apify-runs/run-fKvCBvXjZ7w9R9nFN.wanitatamajogja.md`, `0-13`/`3-4b` story files

---

## Section 2: Impact Analysis

### Epic Impact
- **Epic 0** (Foundation): +1 new reusable primitive (a `TabbedShell`, sibling to Story 0.24's wizard primitive) and an extension to Story 0.13's AI Gateway adapter (system-key tier). No epic replan.
- **Epic 1** (Discovery): Stories touched for masonry card mode, relative-day display, and favorite count on cards.
- **Epic 2** (Personalization): Story 2.1a (favorites backend) extended for count aggregation; Story 2.8 (User Menu) registry rewritten for the two-shell IA; Story 2.9 (notifications) becomes tab content, no logic change.
- **Epic 3** (Subscriptions): New story for scrape-time account backfill + AI location inference; Story 3.3c (scraper adapter interface) extended with new normalized fields; Stories 3.1b/3.2/3.9a become tab content or are dissolved (3.9a).
- **Epic 4** (Moderation): New moderator-tools tabbed shell wrapping the existing actor-runs/unprocessed-payloads pages.
- **Epic 5** (Manual post selection): Story 5.5 (wizard integration) extended; a real nested-tabs question surfaces (§4.2's Posts tab already has its own internal per-account tab bar per PRD §3.10 — this proposal flags it, doesn't resolve it).
- No epic is added, removed, or resequenced.

### Story Impact

| Story | Current status | Change |
|---|---|---|
| **0.13** — AI gateway adapter for Gemini | done | Reopened: `selectApiKey` gains a new final-fallback tier (platform-funded system key), scoped to the location-inference call only |
| **0.24** — Wizard page primitive | review | Referenced, not modified — sibling primitive built instead |
| *(new)* **0.29** — `TabbedShell` reusable primitive | — | New story, Epic 0 |
| **1.3b** — `EventCard` component | review | Reopened: masonry variant, relative-day badge, like-count badge |
| **1.3d** — `EventListView` component | review | Reopened: view-mode switcher (1-col / masonry) |
| **1.3g** — `WeeklyCalendarView` component | review | Reopened: like-count on calendar items, two-line item height |
| **2.1a** — Favorites backend GraphQL layer | review | Reopened: new `favoriteCount` field, aggregate query |
| **2.5** — Find nearby events | review | Reopened: compact inline `FilterHub` location-filter variant |
| **2.8** — User Menu | done | Reopened: registry rewritten for two-shell IA, dissolves Queue Status entry |
| **3.2** — Subscribe to a social media account | review | Reopened: remove `'twitter'` from `SUPPORTED_PLATFORMS`; becomes Account Settings tab content |
| **3.1b** — Manage/revoke API keys | review | Reopened: becomes Account Settings tab content, absorbs API-key-health banner from 3.9a |
| **3.3c** — Scraper adapter interface & platform registry | review | Reopened: normalized post shape gains optional `locationName`/`ownerDisplayName`/`ownerUsername` |
| *(new)* **3.4m** — Backfill account profile + AI-infer default location | — | New story, Epic 3, depends on 3.3c, 0.13, 0.16/2-4b |
| **3.9a** — In-app queue status & API key health | done | **Dissolved**: pending-count moves to Subscribed Accounts tab, key-health banner moves to API Keys tab; `/settings/queue-status` route removed |
| **4.7a** — Moderator route guard | review | Referenced, not modified — new shell reuses its guard |
| *(new)* — Moderator tools tabbed shell (actor-runs + unprocessed-payloads) | — | New story, Epic 4 |
| *(new)* — Account Settings tabbed shell (API Keys, Subscribed Accounts, Posts, Notifications) | — | New story, Epic 3 |
| **5.5** — Integrate manual post selection into wizard | review | Reopened: wizard extended with a notification-opt-in step, `exitPath` changes to `/feed` |
| **5.1** — Manual post selection screen | review | Referenced — its own internal per-account tabs now nest inside the new Posts tab (flagged, not resolved — see §4.2) |

### Artifact Conflicts

**PRD** — real changes needed:
- §3.7 (Social Media Account Subscription): add a subsection for scrape-time account backfill + AI-assisted default-location inference, including the narrow system-key exception (must be worded to *not* read as Phase 2 launching early — see §4.1).
- §4.5 (`SocialMediaAccountProfile`): doc-only note that `defaultLocation` may now be set by the AI inference path, not only by a human edit.
- §4.14 (`DefaultLocationChangeRequest`): **real schema gap** — `changedByUserId: string` assumes a human actor. An AI-driven backfill has no subscriber who "made the change" in the same sense. Needs an explicit decision (§4.1).
- §3.2/new: add `favoriteCount` as a schema field and a one-line requirement ("event cards and calendar items show an aggregate like count").
- §3.11 (Getting Started/Onboarding) or §3.10: note the wizard's extended scope (post selection + notification opt-in) and its `/feed` exit point.
- §3.13 (Vote list): no text change — "only platforms FestGrid can actually scrape are votable" already covers the Twitter decision as implemented, since the adapter itself stays registered.

**Architecture Spine** — one new decision needed: a short addendum (not necessarily a full new AD) documenting the system-key exception's storage (env var, per §5 Security's existing "API keys must be stored securely in environment variables" convention — no new pattern) and explicitly scoping it to this one call path, so it isn't mistaken for Phase 2 general availability.

**UX Design docs** — substantial rewrite:
- `EXPERIENCE.md` Information Architecture list and the full User Menu registry (lines 70–82) need rewriting for the two-shell structure — this is the authoritative doc Story 2.8 is built against, so drift here is exactly what has bitten this project before (see the file's own note about a prior Story 0.7/2.8 correction).
- `DESIGN.md` needs new component tokens: masonry card, relative-day pill, like-count badge, tabbed-shell chrome (can likely adapt the existing `nav.profile_menu`/wizard `Step Summary` tokens rather than inventing new ones from scratch).
- Item #11 (mobile calendar multi-day spanning) has no UX answer yet — recommend a dedicated `bmad-ux` pass before it becomes a story, not speccing it blind here.

**Technical Impact:** No destructive changes anywhere in this batch. New GraphQL: `favoriteCount` field, backfill mutation/service. New frontend route structure: `/settings/account` (or similar) replacing four of six current settings routes; `/moderator/tools` (or similar) wrapping two existing moderator routes. Existing route handlers for the absorbed pages are not deleted outright — their content becomes tab panels of the new shells.

---

## Section 3: Recommended Approach

**Selected: Option 1 — Direct Adjustment**, but two sub-tracks need different handoff (Section 5):

1. **Content/presentation items** (masonry view, favorite count, relative-day display, compact location filter, wizard extension) — straightforward additive work within existing epics. Effort: **Medium**. Risk: **Low** — no schema conflicts, reuses existing patterns (`buildOptimizedDrizzleSelect`-adjacent correlated-subquery pattern already used for `isFavorited`; existing view-switcher pattern from Story 1.3f).
2. **Structural items** (settings IA restructuring, AI location-inference + system key) — require PRD/architecture sign-off before story drafting because they touch shared, authoritative documents (`EXPERIENCE.md`'s User Menu registry, PRD §4.14's schema) and pull forward a roadmap item (system key). Effort: **High**. Risk: **Medium** — the `changedByUserId` schema gap (§4.1) and the nested-tabs question (§4.2) are real unknowns, not just extra work.

Rollback (Option 2) doesn't apply — nothing here reverts working code. MVP review (Option 3) doesn't apply to seven of the nine items; it applies narrowly to the system-key decision, which is a deliberate, user-approved scope pull-forward, not a scope reduction.

---

## Section 4: Detailed Change Proposals

### 4.1 Item #14 — Scrape-time account backfill + AI-assisted default location

**New Story 3.3c amendment** — extend the scraper adapter's normalized post shape:
```
ScrapedPost gains:
  locationName?: string    // from Apify's raw `locationName` (confirmed present, apify-runs/run-fKvCBvXjZ7w9R9nFN...md:52)
  ownerDisplayName?: string  // from `ownerFullName`
  ownerUsername?: string     // from `ownerUsername`
```
These fields exist in the raw scrape today but are currently discarded before reaching `Post`/`SocialMediaAccountProfile` — confirmed by grep, no production code path reads them.

**New Story 3.4m** — "Backfill account profile and AI-infer default location from scrape metadata" (Epic 3, depends on 3.3c, 0.13, 0.16/2-4b):
1. On every successful scrape, if `ownerDisplayName`/`ownerUsername` differ from the stored `SocialMediaAccountProfile.displayName`/`username`, update them (this part has no PRD conflict — it's normal data freshness, same fields already exist in §4.5).
2. If `SocialMediaAccountProfile.defaultLocation` is unset, call Gemini with the post's `locationName` (+ caption, already scraped) to produce a place description — never the subscriber's own `UserLocationPreference` (resolves the §5 conflict identified in Section 1).
3. Gemini's output is a **place description**, not verified coordinates — feed it through the **existing geolocation adapter** (Story 0.16/2-4b, already used for saved-location autocomplete) to resolve real `LocationDetails` (coordinates/placeId/formattedAddress/timezone), rather than trusting an LLM for precise geocoding.
4. Persist the result to `defaultLocation` — this **triggers the existing `DefaultLocationChangeRequest`/moderator notify-accept-revert flow** (PRD §3.7) unchanged, since it writes through the same field a human edit would.

**System key (0.13 amendment):** `selectApiKey`'s existing Tier 1/Tier 2 subscriber-key rotation is tried first; only when no subscriber of the account has a valid Gemini key does a new final fallback tier fire, using a platform-funded key read from an environment variable (consistent with PRD §5's existing "API keys must be stored securely in environment variables" rule — no new storage pattern). **Scope discipline required in the PRD amendment's wording:** this must read as a narrow, single-purpose exception for this one call path — not as Phase 2's general "managed pool of API keys" (PRD §6) launching early. Recommend an explicit sentence in the PRD amendment: *"This system key is used exclusively for default-location inference on accounts with no subscriber-contributed key; it does not extend to general post-extraction processing, which remains BYOK-only until Phase 2."*

**Schema decision (approved):** `DefaultLocationChangeRequest.changedByUserId: string` (PRD §4.14) has no natural value for an AI-driven change — there's no human "who made the change." Resolved as a nullable `changedByUserId` plus a new `changeSource: 'user' | 'ai_inference'` discriminator, surfaced in Moderator Tools so a moderator can tell an AI guess from a human edit at a glance (rejected alternative: attributing it to the post's subscriber whose key was used — misleading when it's the system key). This is a §4.14 PRD amendment, formalized by the PM handoff in Section 5.

### 4.2 Items #4/#5 — Two-shell settings IA

**New Story 0.29** — `TabbedShell` primitive (`packages/ui/src/core/`). **Correction to this proposal's original grounding:** `EXPERIENCE.md`'s wizard design section (URL-query-param `steps` array) is itself already stale — Story 0.24's actual Dev Notes record a deliberate, user-confirmed deviation to a **code-defined `wizardRegistry: Record<string, WizardDefinition>`** (`apps/web/src/features/wizard/wizard-registry.ts`) with typed `WizardStepDefinition { slug, canSkipStep?, Component }` entries, plus `WizardStepSummary`/`WizardNavigation` chrome in `packages/ui/src/core/wizard/` and a `useWizardStep()` completion-gate hook. `TabbedShell` should mirror *this* real pattern (a typed registry of `{ key, Component }` tab entries, reusing the `WizardStepSummary`-adjacent chrome conventions) rather than the URL-query-param model — but with **free navigation** (click any tab, no `isStepCompleted` gating): the wizard's linear step-gate hook does not apply here and should not be copied. Since this proposal's own §4.2 IA rewrite already has to touch `EXPERIENCE.md`, correcting its wizard section to match Story 0.24's as-built registry design should be folded into the same edit pass.

**Shell A — Account Settings** (new route, e.g. `/settings/account?tab=...`): API Keys, Subscribed Accounts, Posts, Notifications tabs. Content is the existing `api-keys-content.tsx`/`subscriptions-content.tsx`/`notifications-content.tsx` components remounted as tab panels — Story 3.1b's key-health banner and Story 3.9a's pending-extraction-count badge move in as described in Section 1's decision log; `/settings/queue-status` is removed as a standalone route.

**Resolved 2026-08-24:** the Posts tab's content (Story 5.1) already has its **own internal per-account tab bar** (PRD §3.10: "a tab-based layout where each tab corresponds to one of the user's subscribed social media accounts"), so nesting it inside Shell A's own tabs produces tabs-within-tabs. User confirmed this is acceptable as long as the two levels read as visually distinct — resolved directly rather than deferring to a separate `bmad-ux` pass, since the fix is scoped entirely to the already-shipped `posts-select-content.tsx` (Story 5.1) and needs no new primitive:

Current state (verified by direct code read, `posts-select-content.tsx:391-418`): the inner per-account row is literal underline buttons (`border-b-2`, primary-colored active border) — the same visual language a top-level `Tabs` bar uses, with no heading above it. Stacked directly under Shell A's outer tabs (which would plausibly use the same default underline style), the two rows would read as one continuous strip.

Fix, five changes to that one component, no new components:
1. **Shape differentiation** — inner row becomes rounded pill/chip buttons (filled background when active, no bottom border) instead of underline buttons, so it reads as a sub-selector rather than more page-level navigation.
2. **Avatars on the inner tabs** — `SocialMediaAccountProfile.profileImageUrl` is already fetched in this component (used a few lines down for `PostCard`'s `publisher` prop) but never rendered on the tab button itself; adding a small circular avatar per pill is a real, already-available signal distinct from Shell A's plain-text outer tabs.
3. **Section label** — a text heading ("Posts from:") added above the row; currently there is none, so nothing textually distinguishes it as a sub-navigation for sighted or screen-reader users.
4. **Visual containment** — the inner row + its content wrapped in the existing `card` token (`rounded-lg shadow-md p-4`, already defined in `DESIGN.md`) so it reads as a box inside the Posts tab panel, not a continuation of Shell A's page chrome.
5. **Mobile single-row scroll** — `flex-wrap` → `flex-nowrap overflow-x-auto` below the mobile breakpoint (`sm:flex-wrap sm:overflow-visible` above it, matching `project-context.md`'s existing screen-size density rule). A wrapped multi-row account list would grow tall enough to compete with Shell A's outer tab bar for vertical space; capping it to one scrollable row keeps a fixed, small footprint and the scrollability itself is a further "this is a secondary selector" cue Shell A's fixed 4-item outer tab set would never need.

Filed against Story 5.1's reopening (not a new story) — see `sprint-status.yaml`.

**Shell B — Moderator Tools** (new route under `/moderator`): wraps the existing `actor-runs` and `unprocessed-payloads` pages, reusing Story 4.7a's route guard as-is. **Decided:** `/moderator/items` (reports/dangerous-event review) stays a separate, standalone page — it does not join this shell. Filed as new Story 4.7b.

**Locations and Widgets** stay as standalone menu items per the user's decision — no change to Stories 2.3/6.5/6.6 beyond `EXPERIENCE.md`'s registry text.

**`EXPERIENCE.md` rewrite** (Information Architecture + User Menu registry, lines 28–34 and 70–82): replaces the six-route settings list with the two-shell structure, corrects the pre-existing queue-status/widgets omission noted in Section 1, and updates the User Menu item list (currently 10 items including a standalone "Queue Status" between "API Keys" and "Notifications") to reflect the collapsed entries.

### 4.3 Item #12 — Disable Twitter (subscriptions and voting)

Single change: remove `'twitter'` from `SUPPORTED_PLATFORMS` in `packages/domain/src/subscriptions/platforms.ts`. Per the user's decision, this is a single shared list — both `subscribeToAccount` and the account-vote validation path (`apps/backend/src/schema/resolvers.ts:1622`) read it, so both become Twitter-unavailable for new entries. `register-adapters.ts` is **not** touched — the Twitter adapter stays registered so existing subscriptions keep scraping. Story 3.2 reopened for this one-line change plus its test coverage (`platform-registry.test.ts`'s "one entry per `SUPPORTED_PLATFORMS` member" coverage guard needs updating too).

### 4.4 Item #10 — Masonry card view mode

Extend `EventCard` (Story 1.3b) with a `variant="masonry"` prop rather than a new component — reuses existing data-fetching/favorite-toggle logic, changes only layout/aspect-ratio handling (native poster aspect ratio instead of fixed height). `EventListView` (Story 1.3d) gains a view-mode switcher, following the same pattern as Story 1.3f's existing card/calendar switcher (currently there is no card-view-mode switcher at all — this is genuinely new state, not an extension of an existing toggle). Reference layout confirmed via user-provided screenshot: 2-col grid, relative-day pill top-left, heart+count badge top-right, title/venue caption below.

### 4.5 New item — Aggregate favorite count

Verified gap: `EventInfo` has no `favoriteCount` field today; the only existing count-aggregation precedent (`voteCount` on `account_votes`) is a different feature. Add a `favoriteCount` resolver field following the **exact pattern already used for `isFavorited`** — a correlated subquery scoped with `activeOnly(favorites)` (`resolvers.ts`, same six call sites listed in Architecture Spine AD-8), just `COUNT` instead of `EXISTS`. This keeps it inside the existing per-row computed-field convention rather than requiring a new batching mechanism. Consumed by `EventCard` (1.3b, both view modes) and `WeeklyCalendarView` (1.3g, confirmed acceptable as a second line per the user's decision).

### 4.6 Item #3 — Wizard extends to post selection + notification opt-in

Story 5.5 reopened: extend the wizard's `steps` array (per `UX-wizard-page-run-1/EXPERIENCE.md`'s existing `steps`/`exitPath` query-param contract — no primitive change needed, this is pure configuration) to add a notification-opt-in step reusing Story 2.9's existing toggle component, and change `exitPath` to `/feed`.

### 4.7 Item #2 — Compact inline location filter

Story 2.5 (Find nearby events) reopened: add a compact/inline presentation variant of the existing location filter inside `FilterHub`, following the same collapsed-trigger-with-popover pattern the 2026-08-13 proposal already established for the Type/Category facets (AC9/AC10 of Story 1.5) — reuse that pattern rather than inventing a third filter-chrome style.

### 4.8 Item #11 — Mobile calendar (partially deferred)

Vertical day list, skip empty days: straightforward `WeeklyCalendarView`/`useWeeklyCalendarController` (Story 1.3g/3.7a) mobile-breakpoint change. Multi-day-span rendering: **no design exists yet** — recommend a scoped `bmad-ux` pass before any story is written for this half of the item, rather than guessing at a layout.

### 4.9 Date display rule (cross-cutting)

Applies to Stories 1.3b (cards) and indirectly informs, but does not require changing, 1.3g's calendar date headers (calendar already positions items by absolute day column, so the relative-day rule is a card-view/list-view concern only). New shared formatting helper, following the project's existing `formatEventDate`/locale-aware formatting convention (`project-context.md`'s Locale-Sensitive Data Rendering rule) — same-week → relative label via `Intl.RelativeTimeFormat` or equivalent, >7 days → existing absolute-date formatter.

---

## Section 5: Implementation Handoff

**Scope:** Major overall, split by track:

- **Track A (PM/Architect first):** Items #14 (system key + `changedByUserId` schema gap) and #4/#5 (IA restructuring + nested-tabs question). Route to **Product Manager** (`bmad-prd`, to formally amend §3.7/§4.5/§4.14/§6) and **Architect** (`bmad-architecture`, for the system-key addendum), then a scoped **`bmad-ux`** pass for the Posts-tab nesting question and Item #11's multi-day spanning, before any of these become stories via `bmad-create-story`.
- **Track B (PO/Dev, ready once Track A's docs land):** Items #10, #12, #2, #3, #4.9 (date rule), and the favorite-count addition — additive, non-conflicting, can be drafted into stories immediately via `bmad-create-story` referencing the story IDs listed in Section 2's impact table.

**Deliverables:**
- PRD amendments: §3.7 (backfill + inference + system-key scope note), §4.5/§4.14 (schema notes + `changeSource` decision), §3.2/new (`favoriteCount`), §3.11 (wizard scope).
- Architecture Spine addendum: system-key storage/scope.
- `EXPERIENCE.md`/`DESIGN.md` rewrite: two-shell IA, User Menu registry, new component tokens.
- New/reopened stories per Section 2's table, filed under existing Epics 0/1/2/3/4 — no new epic number needed.
- `sprint-status.yaml` updated with the new story entries once the above docs are approved.

**Success criteria:** PRD/architecture amendments reviewed and approved by the user before Track A stories are drafted; Track B stories pass through the normal `bmad-create-story` → `bmad-dev-story` → `bmad-code-review` cycle unchanged; the resolved decisions (`changeSource` discriminator, moderator/items staying standalone, the Posts-tab nesting fix) are carried into the resulting story ACs verbatim, not re-litigated. No item remains open needing a separate `bmad-ux` pass — item #11's mobile multi-day-span calendar rendering (§4.8) is the only piece still without a design and is deferred to its own future pass, not part of Track A/B's current scope.

**Approved 2026-08-24:** user confirmed moderator/items stays separate, approved the recommended path for everything else (§4.1's `changeSource` discriminator, the Track A/Track B split), and confirmed the Posts-tab nesting resolution (pill-style inner tabs, avatars, label, card containment, mobile horizontal scroll). `sprint-status.yaml` has been updated with all new/reopened story entries per checklist item 6.4 — see `0-29`, `3-4m`, `3-12`, `4-7b` (new, `backlog`) and the reopened-comment trail on `0-13`, `1-3b`, `1-3d`, `1-3g`, `2-1a`, `2-5`, `2-8`, `3-1b`, `3-2`, `3-3c`, `3-9a` (dissolved), `5-1`, `5-5`.

---

## Addendum (2026-08-24, later same day): Item #1 expanded from a single container to a shared primitive

Track B's Story 1.3/AC9 was implemented narrowly first (a one-line `max-w-7xl` → `w-full` change on `home-content.tsx`, in worktree `story/1-3-ac9-full-width`, fully coded/tested/reviewed). Before merging, the user asked for a wider sweep, which found the identical `"p-4 sm:p-8 space-y-8 max-w-7xl mx-auto"` className copy-pasted verbatim across **7 pages** — home, favorites, feed, my-calendar, archive, the public account page, and manual post selection — with no minimum-width floor and no card-grid column-count scaling past `lg:` (1024px) on any of them.

**Resolution:** a new shared `PageContainer` primitive (**Story 0.30**, new, `packages/ui/src/core/`) replaces the duplicated string everywhere, and the rule is now codified in `project-context.md`'s new "Grid/Calendar Page Containers" invariant (and `DESIGN.md`'s `page_container`/`grid.base`/`grid.masonry` tokens) so future pages get it by construction:
- **Full width**, no `max-w-*` cap.
- **Responsive min-width**, paired to each breakpoint (`min-w-[320px] sm:min-w-[640px] md:min-w-[768px] lg:min-w-[1024px] xl:min-w-[1280px]`) rather than one flat value — a no-op in a normal viewport, a real floor against a flex-shrink context or the embeddable widget's iframe host (PRD §3.14).
- **Card-grid column count scales past `lg:`**: standard mode `1/2/3/4/5` (base/md/lg/xl/2xl), masonry/Pinterest mode (item #10, not yet built) one column ahead at every step (`2/3/4/5/6`), locked in now so that future work doesn't re-derive it.
- **Calendar views** adopt the container rule but not the column rule (`WeeklyCalendarView` stays a fixed 7-column days-of-week grid).

**Story 1.3's AC9 was revised in place** to consume `PageContainer` instead of its own narrow fix — the already-implemented `story/1-3-ac9-full-width` branch is **superseded, not merged**. New/amended stories: `0-30` (new primitive, `ready-for-dev`), `1-3d` (AC14, widen `EventListView`'s grid default — this is the single choke point behind 5 of the 7 pages), `2-2`/`2-6`/`3-7`/`3-11`/`4-8`/`5-1` (each gets a small "adopt `PageContainer`" AC), `5-1` additionally gets its 3 inline `PostCard` grids unified onto the standard progression (dropping its own slightly different `sm:`-stepped scheme). `5-1` also picked up a proper AC (AC11) for the Posts-tab nesting resolution from §4.2/Section 1 above — that work existed only as a `sprint-status.yaml` comment before this pass, never as a real AC in the story file itself; fixed while touching this story again.

All of Track B's remaining "adopt `PageContainer`" stories are blocked on Story 0.30 landing first — see `sprint-status.yaml`'s dependency notes on each.
