---
backlog_id: BUG-095
title: "Past-event cutoff uses the UTC date, so in Jakarta's first 7 hours the list still shows ended events"
captured: 2026-10-31
---

# BUG-095 — the list cuts "past" at the UTC date, the cards judge "Ended" in the event's own timezone

Log only, no code. Found 2026-10-31 while chasing BUG-094; it is a smaller, separate gap.

## What happens

The Discovery list decides which events are past with a `YYYY-MM-DD` threshold built from the **UTC** date: `computePastEventThreshold` (`packages/domain/src/events/computePastEventThreshold.ts`), called by `buildDefaultEventVisibilityConditions` and by `Query.events`' own `isPastEvent` expression (Story 0.36). An event is kept while its date range overlaps that threshold.

The card decides "Ended" with `isEventEnded` (`packages/ui/src/features/events/format-event-date.ts`), which compares the calendar day in **the event's own timezone** (Asia/Jakarta, UTC+7 for almost every event here).

Jakarta's day starts 7 hours before UTC's does. From 00:00 to 07:00 WIB, the UTC date is still yesterday, so an event that ended "yesterday" in Jakarta is still listed (its end date overlaps the UTC date) and its card says Ended. Observed at 01:55 WIB on 2026-10-31: 43 listed events that had ended on 2026-10-30.

This is a few hours a day, not a week, and it shows an event the card itself labels ended, so it is milder than BUG-094. It still means "hidden as soon as it ends" is false for 7 of every 24 hours in Jakarta.

## Why it is not a one-line fix

The shared `ended-cases` fixture (`packages/domain/src/events/__fixtures__/ended-cases.ts`, Story 0.i5d, AD-20 Rule 4) is built around UTC: every `now` is a UTC instant, dates are read with no timezone conversion, and `packages/ui/vitest.config.ts` pins the test process to UTC for FIND-062 because `isEventEnded` falls back to the running process's timezone when it is given none. Both the card side and the SQL `notEnded` side are asserted against that one fixture.

Moving the list's cutoff to the event's (or the viewer's) timezone breaks the premise the fixture is built on, so a fix needs a decision first:

- Which timezone defines "today" for the cutoff: the event's own (needs a per-event value in SQL), the viewer's (`users.timezone` exists, logged-out viewers have none), or one app-wide zone (Asia/Jakarta)?
- Whether the fixture grows a timezone column, or the SQL side keeps UTC and the card is the one that changes.
- Whether the visible mismatch matters enough, given the cards already read right and only the first 7 hours of the Jakarta day list a stale card.

## Not touched here

Nothing in code. BUG-094 fixes the larger window (7 days for logged-in users) separately.
