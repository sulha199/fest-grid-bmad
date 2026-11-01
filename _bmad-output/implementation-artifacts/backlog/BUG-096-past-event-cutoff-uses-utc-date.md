---
backlog_id: BUG-096
title: "Past-event cutoff uses the UTC date, so in Jakarta's first 7 hours the list still shows ended events"
captured: 2026-10-31
fixed: 2026-10-31
---

# BUG-096 — the list cut "past" at the UTC date, the cards judge "Ended" in the event's own timezone

Fixed 2026-10-31 (option A below). Found the same day while chasing BUG-095.

## What happened

The Discovery list decided which events are past with a `YYYY-MM-DD` threshold built from the **UTC** date (`computePastEventThreshold`), used by `buildDefaultEventVisibilityConditions`, `Query.events`' `isPastEvent` and `Event.isExpiredForCurrentUser` (Story 0.36). The card decides "Ended" with `isEventEnded`, which compares the calendar day in **the event's own timezone**.

Jakarta's day starts 7 hours before UTC's, so from 00:00 to 07:00 WIB an event that ended "yesterday" in Jakarta was still listed with an Ended card (43 events at 01:55 WIB on 2026-10-31). West of UTC it went the other way: at 21:00 in New York the UTC date is already tomorrow, so an event on its last day there was hidden while still live.

## Decision

Three options were put to the architect skill (Winston) on 2026-10-31 and the user chose **A, per-schedule timezone in SQL**, so the list hides an event exactly when its card says the day is over:

- **A (chosen)** each schedule's own zone, with the card's wall-clock rule: the zone counts only when `timezoneStatus` is `RESOLVED` (`resolveScheduleTimezone`), otherwise UTC, which is the behaviour before the change.
- B one app-wide zone (Asia/Jakarta): rejected. The app has no single zone (the layout's fallback is locale-derived: `/id` Jakarta, `/en` New York), so it would have been a third definition, and it would hide foreign-zone events early.
- C accept the gap: rejected, it shares its root cause with BUG-097.

## What changed

- Migration `0090_bug_096_schedule_past_cutoff_date`: SQL function `schedule_past_cutoff_date(instant, tz, tz_status, hide_after_days)`. It returns the date of `instant` in the zone, minus N days, and falls back to UTC for a NULL zone, a non-RESOLVED zone, or a zone name Postgres does not recognise (`AT TIME ZONE` raises 22023 for those, which would otherwise fail the whole list because of one row). About 0.3 microseconds per call, measured over 200k calls. A `pg_timezone_names` check instead cost 218 ms per query on the local server, so it was not used.
- `buildPastCutoffDateSql` (`packages/graphql-select/past-cutoff-sql.ts`) is the one SQL fragment for the cutoff. `overlaps` in `drizzle-where.ts` takes it as the window's lower bound when the condition carries a `pastCutoff` and the descriptor has the timezone columns; the weekday guard reads the same bound. `isPastEvent` and `Event.isExpiredForCurrentUser` call it directly, so the three stay complements.
- `buildDefaultEventVisibilityConditions` emits `pastCutoff: {instant, hidePastEventsAfterDays}` next to the UTC `from`. A malformed `pastCutoff` in a client-supplied condition is ignored (`readPastCutoff`).
- `resolveRequestNow` in `resolvers.ts`: `Event.isExpiredForCurrentUser` now honours the test-only pinned `context.now` like `Query.events` does.
- AD-20 amended, and the wall-clock rule in `project-context.md` extended.

No client change: `EventListView` already shows its empty state when a first page has no items, and `hasMore` is computed on the server from the filtered rows with offset pagination, so a shorter list scrolls the same way.

## Not changed (logged)

- BUG-097: the TODAY/UPCOMING toggles and the next-upcoming sort key still use the UTC date; the shared `ended-cases` fixture stays UTC-pinned.
- FIND-108: `isPastEvent` / `isExpiredForCurrentUser` have no weekday guard, unlike the default filter.
- The list still keeps an event that ended earlier today (its card says Ended) until its zone's midnight: the cutoff is date-granular, as before.

## Verified

Domain 1413/1413 at 100% coverage, `graphql-select` 59/59, database 22/22 (includes the journal-order ratchet), 17 new integration test cases against local Postgres (`events-past-cutoff-timezone.test.ts`), backend `tsc` and lint clean. Three mutants of the SQL function (UTC only, no invalid-zone handler, status ignored) each fail the new tests. Existing events suites: 158/160, the 2 failures are the known local-only `queryModeratorAccountProfiles` ones.

Not verified: `EXPLAIN` on the prod data volume (about 1,000 schedules, so small), and the live behaviour in the 00:00-07:00 WIB window after deploy.

## Board note (moved verbatim from backlog.yaml, 2026-11-02)

Fixed in PR #126 (option A of an architect review): the list's cutoff is now the date of the request's one `now` in each schedule's own timezone (RESOLVED only, else UTC), from one SQL function shared by default visibility, isPastEvent and isExpiredForCurrentUser. Verify after deploy in the 00:00-07:00 WIB window: no event that ended on the previous Jakarta day should be listed. The TODAY/UPCOMING toggles still use the UTC date (BUG-097).
