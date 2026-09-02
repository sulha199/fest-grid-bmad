# ux-rework2 Tracking

Consolidated status of every item in `apps/ux-rework2.md`, cross-referenced against the batch specs and `deferred-work.md`. Built 2026-09-02 by reconstructing history from `spec-ux-rework2-batch{,-2..-11}.md` and `deferred-work.md`; not auto-generated, so it needs a manual update whenever a new batch ships or `apps/ux-rework2.md` changes.

**How to read this:** `apps/ux-rework2.md` itself has no done/pending markers and gets edited directly by the user, so it drifts from reality — this file exists specifically to stop needing to reconstruct that drift by hand each time. Line numbers below refer to `apps/ux-rework2.md`'s state as of commit `cd31195`.

## Legend

- ✅ Done — shipped and merged
- 🚫 Deferred — explicitly punted, with a recorded reason (not forgotten)
- ⏳ Not started — no spec exists yet
- ⚠️ Stale in tracking file — `ux-rework2.md` still lists it as open, but it's already fixed

## Current backlog (`apps/ux-rework2.md`'s present content)

| # | Item (`ux-rework2.md` line) | Status | Closed by / reason |
|---|---|---|---|
| 1 | Shared subscribed-account inline-card component (L1-4) | ✅ | `spec-ux-rework2-batch-7.md` (component), `-8` (Event Detail wiring) |
| 1a | — Instagram icon fallback | ✅ | `AccountAvatar`, batch-7 |
| 1b | — Click image/name → account page | ✅ | `SubscribedAccountCard`'s `accountHref` link, batch-7 |
| 1c | — Reusable image subcomponent | ✅ | `AccountAvatar` (pre-existing, composed by `SubscribedAccountCard`) |
| 2 | Post Selection: check last scrape run (L6, dup. L18) | 🚫 | Explicitly deferred by user during the original batch's planning (`spec-ux-rework2-batch.md`'s Problem statement) — not scheduled |
| 3 | Post Selection: Instagram icon fallback (L7) | ✅ | `spec-ux-rework2-batch-9.md` |
| 4 | Subscribed Accounts page: Instagram icon + reuse shared component (L9-10) | 🚫 | Deferred (`deferred-work.md`, "SubscribedAccountCard wiring" section) — blocked on an unresolved design question: the card has no unsubscribe affordance, need to decide whether the existing `SwipeToReveal`+delete stays external or the card gets a new `onUnsubscribe` prop |
| 5 | Auto AI-extract location when account has no default (L12) | ✅ | Original batch (`spec-ux-rework2-batch.md`) — wired `backfillAccountProfileAndInferDefaultLocationSeam` into the extraction pipeline |
| 6 | General rule: favorite icon shown → also show count + toggle (L17, dup. L18) | ✅ (Event Detail closed) | `EventCard`/`WeeklyCalendarView` already had it; Event Detail closed via `spec-ux-rework2-batch-11.md`. Not exhaustively audited elsewhere in the app. |
| 7 | Max 5 subscribed accounts (normal user), upgrade button + PostHog, moderator exempt (L19-21) | ⏳ | No spec. Reads as real feature work (limits + billing-adjacent UI + analytics), not UX polish — likely needs its own planning pass rather than a quick-dev batch |
| 8 | Subscribe button beside account name (L22) | ✅ (Event Detail) / ⏳ (elsewhere) | Satisfied on Event Detail by `SubscribedAccountCard` (batch-8). Not verified on other pages the item might also mean (e.g. search results) |
| 9 | Auto-extract on first subscribe (Gemini 500 RPD limit) + wizard→feed redirect (L23) | ⏳ | No spec |
| 10 | Calendar "show more" per-day overflow + pagination investigation (L24-26) | 🚫 | Deferred, merged with #14 below — investigation found the two items are architecturally entangled (see reason on #14) |
| 11 | AI filter button: list existing filters + "create new" (L27) | ⏳ | No spec |
| 12 | Short date format rule for upcoming/ongoing events (L28-36) | ⏳ | No spec. Fully specified already by the user (status computation, display rule, visual indicator, translation-key structure) — ready to batch as written |
| 13 | Favorite toggle from Event Detail syncs to list (L37) | ✅ | `spec-ux-rework2-batch-2.md` |
| 14 | Add to Calendar doesn't work (L38) | ✅ | `spec-ux-rework2-batch-2.md` |
| 15 | `/settings/subscriptions` dead link (L39) | ✅ | `spec-ux-rework2-batch-3.md` |
| 16 | General rule: always show endpoint error messages (L40) | ✅ (scoped) | `spec-ux-rework2-batch-3.md` fixed the 2 `createApiKey` call sites the user reported. `deferred-work.md` notes this is a *project-wide pattern gap* beyond those 2 sites — other call sites (`report-dialog.tsx`, `subscribe-account-dialog.tsx`) still show hand-picked generic strings rather than the real backend message. Not audited app-wide. |
| 17 | Event Detail: subscribed-account card + favorite count (L41) | ✅ | Card: batch-8. Count: `spec-ux-rework2-batch-11.md` |
| 18 | Event list: masonry-only, remove view toggle (L42-43) | ✅ | `spec-ux-rework2-batch-4.md` |
| 19 | Sticky FilterHub + collapse-on-scroll button (L44) | ✅ | `spec-ux-rework2-batch-6.md` (built), `-10` (fixed untranslated button + infinite flicker loop) |
| 20 | Geoapify `rank.confidence` research (Pakuwon Mall Jogja mismatch) (L45) | ⏳ | No spec — research task, not yet started |
| 21 | Calendar event-item: use mobile layout on both mobile & desktop (L47) | 🚫 | Deferred, merged with #10 above (`deferred-work.md`, "quick-dev planning of ux-rework2 P1 batch"). Investigation found desktop's grid+"+N more" popover system and mobile's uncapped list are fully separate render paths — "use mobile's layout everywhere" means deleting desktop's whole cap/popover mechanism, entangled with whether desktop needs its own cap for other reasons. Needs a scoping pass before it's batchable. |
| 22 | Calendar event-item: duplicate favorite icon (L48) | ⚠️ Stale | Already fixed in `spec-ux-rework2-batch-3.md`. Verified live in current code (`WeeklyCalendarView.tsx:878`'s count-line heart is guarded by `!schedule.isFavorited`, specifically to prevent showing two hearts). `ux-rework2.md` still lists this as open — safe to remove from your notes. |
| 23 | Calendar mobile collapsible days (L49-52) | ✅ | `spec-ux-rework2-batch-5.md` |

## Original batch (pre-expansion `ux-rework2.md`, no longer present in the current file)

The file was substantially rewritten by the user after this batch shipped; these 8 items are done and were cleared from the backlog, not forgotten:

| Item | Status | Closed by |
|---|---|---|
| Masonry view: smaller gap, smaller title font, time/click only on today's card | ✅ | `spec-ux-rework2-batch.md` |
| Onboarding wizard: completion redirect race (data-delay bounce back to wizard) | ✅ | `spec-ux-rework2-batch.md` |
| User menu: moderator items count missing in desktop view | ✅ | `spec-ux-rework2-batch.md` |
| Discovery page: disable auto-redirect to nearby filter | ✅ | `spec-ux-rework2-batch.md` |
| Post Selection: Instagram icon fallback | ✅ | `spec-ux-rework2-batch.md` (later re-touched by batch-9 when the fallback was upgraded to `AccountAvatar`) |
| Subscribed Accounts: Instagram icon + click-through to account page | ✅ | `spec-ux-rework2-batch.md` |
| Auto AI-extract location when account has no default | ✅ | `spec-ux-rework2-batch.md` |
| Gemini API key validation on add (test call with least-cost model) | ✅ | `spec-ux-rework2-batch.md` |

Two items from this original batch were explicitly dropped rather than shipped: the "run ai-filter-creation from event list" button (superseded by backlog item #11 above, still not started) and "check last scrape run" (superseded by backlog item #2 above, still deferred).

## Summary

- **Done: 15** of 23 current backlog items (some partially — see table for scoping notes)
- **Deferred (reasoned, not forgotten): 3** (#2/duplicate, #4, #10/#21 merged pair)
- **Not started: 5** (#7, #9, #11, #12, #20)
- **Stale in your tracking file: 1** (#22 — already fixed, safe to delete from `ux-rework2.md`)

**Best next candidates**, roughly by size: #12 (short date format — fully spec'd already, medium-sized: new domain logic + translation keys + `EventCard` visual change across several consumer pages) or #7/#9 (subscription limits + auto-extract-on-subscribe — bigger, feature-shaped, worth a planning pass before a quick-dev batch). #4, #10/#21, and #20 each need a decision or investigation before they're batchable at all.
