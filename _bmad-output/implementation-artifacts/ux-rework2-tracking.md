# ux-rework2 Tracking

Consolidated status of every item in `apps/ux-rework2.md`, cross-referenced against the batch specs and `deferred-work.md`. Built 2026-09-02 by reconstructing history from `spec-ux-rework2-batch{,-2..-11}.md` and `deferred-work.md`; not auto-generated, so it needs a manual update whenever a new batch ships or `apps/ux-rework2.md` changes.

**Patched 2026-09-06 (backlog/epics gap audit):** #11 and #12 were marked "no spec" below as of the 2026-09-02 build, but `epics.md`/`sprint-status.yaml` have since gained coverage for both (see their rows). #7, #9, #2, and #20 were confirmed to have no row in `backlog.yaml` or story in `epics.md` and were captured as `IDEA-008`, `IDEA-009`, `IDEA-010`, and `BUG-017` respectively.

**How to read this:** `apps/ux-rework2.md` itself has no done/pending markers and gets edited directly by the user, so it drifts from reality — this file exists specifically to stop needing to reconstruct that drift by hand each time. Line numbers below refer to `apps/ux-rework2.md`'s state as of commit `cd31195`.

## Legend

- ✅ Done — shipped and merged
- 🚫 Deferred — explicitly punted, with a recorded reason (not forgotten)
- ⏳ Not started — no spec exists yet
- ⚠️ Stale in tracking file — `ux-rework2.md` still lists it as open, but it's already fixed
- 🛠 Spec'd — a story/AC now exists (since this file's 2026-09-02 build) but isn't implemented yet

**Priority** reflects the *actual* triage recorded in specs/`deferred-work.md` (`spec-ux-rework2-batch-2.md`/`-3.md`'s "P0 items", and `deferred-work.md`'s "quick-dev planning of ux-rework2 P1 batch" section) — I'm not inventing a P2 tier that was never assigned. Items outside those two documented passes are marked **Untriaged**, meaning no priority was ever formally assigned, not that they don't matter.

**Needs bigger story?** flags items that don't fit a normal quick-dev batch as-is — either they need a scoping/architecture decision first, or they're genuinely feature-shaped (new backend rules, new UI flows, analytics) rather than a fix/polish item. Verified against real code/schema where I could, not guessed — see each row's reason.

## Current backlog (`apps/ux-rework2.md`'s present content)

Sorted by priority (P0 → P1 → Untriaged); `#` still refers to the item's position in the unsorted list / `ux-rework2.md`'s own line order, so it's stable across re-sorts.

| # | Item (`ux-rework2.md` line) | Priority | Status | Needs bigger story? | Closed by / reason |
|---|---|---|---|---|---|
| 13 | Favorite toggle from Event Detail syncs to list (L37) | P0 | ✅ | No | `spec-ux-rework2-batch-2.md` |
| 14 | Add to Calendar doesn't work (L38) | P0 | ✅ | No | `spec-ux-rework2-batch-2.md` |
| 15 | `/settings/subscriptions` dead link (L39) | P0 | ✅ | No | `spec-ux-rework2-batch-3.md` |
| 16 | General rule: always show endpoint error messages (L40) | P0 | ✅ (scoped) | No | `spec-ux-rework2-batch-3.md` fixed the 2 `createApiKey` call sites the user reported. `deferred-work.md` notes this is a *project-wide pattern gap* beyond those 2 sites — other call sites (`report-dialog.tsx`, `subscribe-account-dialog.tsx`) still show hand-picked generic strings rather than the real backend message. Not audited app-wide. |
| 22 | Calendar event-item: duplicate favorite icon (L48) | P0 | ⚠️ Stale | No | Already fixed in `spec-ux-rework2-batch-3.md`. Verified live in current code (`WeeklyCalendarView.tsx:878`'s count-line heart is guarded by `!schedule.isFavorited`, specifically to prevent showing two hearts). `ux-rework2.md` still lists this as open — safe to remove from your notes. |
| 1 | Shared subscribed-account inline-card component (L1-4) | P1 | ✅ | No | `spec-ux-rework2-batch-7.md` (component), `-8` (Event Detail wiring) |
| 1a | — Instagram icon fallback | P1 | ✅ | No | `AccountAvatar`, batch-7 |
| 1b | — Click image/name → account page | P1 | ✅ | No | `SubscribedAccountCard`'s `accountHref` link, batch-7 |
| 1c | — Reusable image subcomponent | P1 | ✅ | No | `AccountAvatar` (pre-existing, composed by `SubscribedAccountCard`) |
| 4 | Subscribed Accounts page: Instagram icon + reuse shared component (L9-10) | P1 | 🚫 | **Yes — design decision** | Deferred (`deferred-work.md`, "SubscribedAccountCard wiring" section) — blocked on an unresolved design question: the card has no unsubscribe affordance, need to decide whether the existing `SwipeToReveal`+delete stays external or the card gets a new `onUnsubscribe` prop. Small once decided — the "bigger" part is the decision, not the build. |
| 10 | Calendar "show more" per-day overflow + pagination investigation (L24-26) | P1 | 🚫 | **Yes** | Deferred, merged with #21 below (`deferred-work.md`, "quick-dev planning of ux-rework2 P1 batch") — investigation found the two items are architecturally entangled (see reason on #21) |
| 17 | Event Detail: subscribed-account card + favorite count (L41) | P1 (card) / Untriaged (count) | ✅ | No | Card: batch-8 (P1). Count: `spec-ux-rework2-batch-11.md` (added to the file later, never formally triaged) |
| 19 | Sticky FilterHub + collapse-on-scroll button (L44) | P1 | ✅ | No | `spec-ux-rework2-batch-6.md` (built), `-10` (fixed untranslated button + infinite flicker loop) |
| 21 | Calendar event-item: use mobile layout on both mobile & desktop (L47) | P1 | 🚫 | **Yes** | Deferred, merged with #10 above (`deferred-work.md`, "quick-dev planning of ux-rework2 P1 batch"). Investigation found desktop's grid+"+N more" popover system and mobile's uncapped list are fully separate render paths — "use mobile's layout everywhere" means deleting desktop's whole cap/popover mechanism, entangled with whether desktop needs its own cap for other reasons. Needs a scoping pass before it's batchable. |
| 23 | Calendar mobile collapsible days (L49-52) | P1 | ✅ | No | `spec-ux-rework2-batch-5.md` |
| 2 | Post Selection: check last scrape run (L6, dup. L18) | Untriaged | 🚫 | Maybe | Explicitly deferred by user during the original batch's planning ("put to deferred for better planning" — the user's own words), never re-triaged since. "Better planning" phrasing suggests it may need its own scoping pass (checking actor-run state, not just a display tweak), but unconfirmed. **Captured as `IDEA-010` in `backlog.yaml` (2026-09-06) — no row existed for it before then.** |
| 3 | Post Selection: Instagram icon fallback (L7) | Untriaged | ✅ | No | `spec-ux-rework2-batch-9.md` |
| 5 | Auto AI-extract location when account has no default (L12) | Untriaged (original batch) | ✅ | No | Original batch (`spec-ux-rework2-batch.md`) — wired `backfillAccountProfileAndInferDefaultLocationSeam` into the extraction pipeline |
| 6 | General rule: favorite icon shown → also show count + toggle (L17, dup. L18) | Untriaged | ✅ (Event Detail closed) | No | `EventCard`/`WeeklyCalendarView` already had it; Event Detail closed via `spec-ux-rework2-batch-11.md`. Not exhaustively audited elsewhere in the app. |
| 7 | Max 5 subscribed accounts (normal user), upgrade button + PostHog, moderator exempt (L19-21) | Untriaged | ⏳ | **Yes** | No spec. Verified: a `moderator` role already exists at the DB level (`user_role` enum, `packages/database/schema.ts`), so the role check itself is cheap — but this still needs a new server-side subscribe-count guard, a new "upgrade" UI flow (with a "coming soon" state), and PostHog event wiring. Real feature work, not polish. **Captured as `IDEA-008` in `backlog.yaml` (2026-09-06); also flags a conflict with PRD 8.2's own "e.g., 2" account cap.** |
| 8 | Subscribe button beside account name (L22) | Untriaged | ✅ (Event Detail) / ⏳ (elsewhere) | No | Satisfied on Event Detail by `SubscribedAccountCard` (batch-8). Not verified on other pages the item might also mean (e.g. search results) |
| 9 | Auto-extract on first subscribe (Gemini 500 RPD limit) + wizard→feed redirect (L23) | Untriaged | ⏳ | **Yes** | No spec. Touches the extraction-triggering pipeline (rate-limit-aware auto-triggering against a shared Gemini quota) and the onboarding wizard's routing — genuinely cross-cutting backend+frontend design, not a small fix. **Captured as `IDEA-009` in `backlog.yaml` (2026-09-06).** |
| 11 | AI filter button: list existing filters + "create new" (L27) | Untriaged | ✅ | No | **Was marked "no spec, frontend wiring only" as of 2026-09-02 — now stale.** Epic 7 (Stories 7.1a–7.5) shipped this in full: `myAIEventFilters` list, `resolvePromptToEventFilter`, `saveAIEventFilter`/`deleteAIEventFilter`, and Story 7.4's FilterHub prompt entry point are all `done` in `sprint-status.yaml` (verified 2026-09-06). |
| 12 | Short date format rule for upcoming/ongoing events (L28-36) | Untriaged | 🛠 Spec'd | No | **Was marked "no spec" as of 2026-09-02 — now stale.** Story 1.3b/1.3d gained AC14-18 (2026-09-06, `sprint-change-proposal-2026-09-04.md`/CC-019) covering an 8-state `formatEventStatus` badge + `TILL` badge — the same upcoming/ongoing distinction this item asks for, though as an 8-state model rather than the simpler 2-state rule drafted here. Status `review`; AC14-18 not yet implemented. |
| 18 | Event list: masonry-only, remove view toggle (L42-43) | Untriaged | ✅ | No | `spec-ux-rework2-batch-4.md` |
| 20 | Geoapify `rank.confidence` research (Pakuwon Mall Jogja mismatch) (L45) | Untriaged | ⏳ | No — research, not code | Investigation/research task, not yet started. Not "architecture," just needs an actual investigation pass before any fix is scoped. **Captured as `BUG-017` in `backlog.yaml` (2026-09-06).** |

## Original batch (pre-expansion `ux-rework2.md`, no longer present in the current file)

The file was substantially rewritten by the user after this batch shipped; these 8 items are done and were cleared from the backlog, not forgotten. None of these were individually P0/P1-tagged — the whole batch was accepted as one bundled unit (see the spec's own Intent: "User chose to keep all 8 in one quick-dev batch... rather than splitting into separate sessions").

| Item | Status | Needs bigger story? | Closed by |
|---|---|---|---|
| Masonry view: smaller gap, smaller title font, time/click only on today's card | ✅ | No | `spec-ux-rework2-batch.md` |
| Onboarding wizard: completion redirect race (data-delay bounce back to wizard) | ✅ | No | `spec-ux-rework2-batch.md` |
| User menu: moderator items count missing in desktop view | ✅ | No | `spec-ux-rework2-batch.md` |
| Discovery page: disable auto-redirect to nearby filter | ✅ | No | `spec-ux-rework2-batch.md` |
| Post Selection: Instagram icon fallback | ✅ | No | `spec-ux-rework2-batch.md` (later re-touched by batch-9 when the fallback was upgraded to `AccountAvatar`) |
| Subscribed Accounts: Instagram icon + click-through to account page | ✅ | No | `spec-ux-rework2-batch.md` |
| Auto AI-extract location when account has no default | ✅ | No | `spec-ux-rework2-batch.md` |
| Gemini API key validation on add (test call with least-cost model) | ✅ | No | `spec-ux-rework2-batch.md` |

Two items from this original batch were explicitly dropped rather than shipped: the "run ai-filter-creation from event list" button (superseded by backlog item #11 above — since shipped via Epic 7) and "check last scrape run" (superseded by backlog item #2 above, still deferred — now `IDEA-010`).

## Summary

**Updated 2026-09-06** against a `backlog.yaml`/`epics.md` gap audit — see the patch note at the top of this file.

- **Done: 16** of 23 current backlog items (some partially — see table for scoping notes), including #11 (AI filter button — Epic 7 shipped in full)
- **Deferred (reasoned, not forgotten): 3** (#2/duplicate, #4, #10/#21 merged pair) — all four now have `backlog.yaml` rows (#4→`FIND-012`, #2→`IDEA-010`, #10/#21→`FIND-010`)
- **Spec'd, pending implementation: 1** (#12 — Story 1.3b/1.3d AC14-18, status `review`)
- **Not started, now captured in `backlog.yaml`: 3** (#7→`IDEA-008`, #9→`IDEA-009`, #20→`BUG-017`)
- **Stale in your tracking file: 1** (#22 — already fixed, safe to delete from `ux-rework2.md`)

**By priority (as actually triaged, not inferred):** P0 — 5 items, all done except #22 (stale/already-fixed). P1 — 8 items/sub-items, all done except #4 and #10/#21 (both deferred, both need a decision/scoping pass first). **Untriaged — the rest** (roughly half the current backlog, including everything added to the file after the original two triage passes) — this isn't a gap in this doc, it reflects that those items genuinely never went through a P0/P1 sort.

**Needs a bigger story before it's batchable — 4 items:** #4 (design decision on the unsubscribe affordance), #7/`IDEA-008` (subscription limits — real feature, not polish, and conflicts with PRD 8.2's "e.g., 2" cap), #9/`IDEA-009` (auto-extract-on-subscribe — cross-cutting backend rate-limit design + wizard routing), #10/#21 (calendar layout — architecturally entangled, already confirmed by investigation). Everything else is either already done (#11), already spec'd (#12), or a research task (#20/`BUG-017`) — none of those three need a bigger story.

**Best next candidates**, roughly by size: #12 (short date format — already has AC14-18 written, status `review`, just needs implementation) is now the single best pickup. #7/#9 are the right next step only if you want to invest in a planning pass first; #4, #10/#21, and #20 each need that decision/investigation/scoping before anything else.
