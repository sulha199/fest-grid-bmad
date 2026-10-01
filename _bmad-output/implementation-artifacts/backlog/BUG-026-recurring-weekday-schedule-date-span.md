---
backlog_id: BUG-026
title: "Recurring single-day-of-week schedules extract as one contiguous date span, silently matching every weekday inside it (not just the stated day)"
captured: 2026-09-11
---

# BUG-026 — Recurring weekday schedules collapse into one contiguous span

## Capture

Reported by user via `bmad-help` against a real scraped event (Pakuwon Mall Jogja
"SEPTEMBER FEAST", IG `p/Dcx14Dak8zN`). Caption states the promo is "Valid only from Monday to
Wednesday during September 2026" with explicit per-day date lists (Mon: 7/14/21/28, Tue:
8/15/22/29, Wed: 9/16/23/30). Extraction correctly produced 3 named schedules
(Monday/Tuesday/Wednesday Special Feast) but each one's `eventStartDate`/`eventEndDate`
collapsed its 4 discrete occurrences into one contiguous span (e.g. Monday:
2026-09-07..2026-09-28) — so per the `Schedule` interface (PRD Section 4.4, prior to this fix)
and its DB/GraphQL representation (`packages/database/schema.ts:341-342`, a plain daterange
pair with no other qualifier), that schedule read as valid every single day Sep 7-28 inclusive,
Thu-Sun included, contradicting the caption's own terms.

## Root cause (confirmed in both layers)

1. The extraction prompt (`apps/backend/src/lib/ai-processor/build-gemini-request.ts:68`) tells
   the model only to fill `eventStartDate`/`eventEndDate` per schedule, with zero guidance for a
   repeating single-weekday pattern — `extracted-event.schema.ts:8-22` had no field to express
   one either.
2. This isn't cosmetic — it is already a live, shipped-feature correctness bug. The AI Event
   Filter's `dayOfWeek` matching
   (`packages/domain/src/events/buildEventsQueryCondition.ts:73-83`'s `getDays` + `:109-128`)
   enumerates every real calendar date matching a requested weekday in the active window and
   checks `scheduleDateRange overlaps {d,d}` per date
   (`packages/graphql-select/drizzle-where.ts:80-96`'s inclusive
   `daterange(startCol, COALESCE(endCol,startCol), '[]')`) — a pure contiguous-range overlap
   with no weekday awareness. So filtering for e.g. Friday events today already incorrectly
   returns this event's Monday-Special-Feast schedule (and any other multi-day-span schedule)
   for every Friday inside its span, not just actual Mondays. The gap predates this report and
   affects every existing multi-day schedule, not only ones extracted going forward.

## Resolved (schema decision only, 2026-09-11 via bmad-prd)

PRD amended — `Schedule` (Section 4.4) gained `applicableDaysOfWeek?: DayOfWeek[]`, reusing the
`DayOfWeek` enum already defined for `EventFilterInput.dayOfWeek` (Section 4.18/4.19), plus a
new Section 3.7 extraction-behavior bullet and an updated Calendar View Behavior clause (Section
3.3-area) describing how a schedule's occurrences narrow to only the matching weekdays within
its span. PRD status: final, updated 2026-09-11; decision record (array-vs-single-value,
default/legacy-data behavior for schedules with the field unset, and scope explicitly deferred
out of the PRD pass) is in that run's `.memlog.md`.

## Still open, deliberately deferred by the user rather than backfilled

1. The extraction prompt + `extracted-event.schema.ts`/`geminiExtractionResponseSchema` need to
   actually populate the new field.
2. `buildEventsQueryCondition.ts`'s `dayOfWeek` matching and `drizzle-where.ts`'s date-range
   overlap need the actual correctness fix so they respect `applicableDaysOfWeek` instead of the
   raw span.
3. `epics.md` has not been backfilled with this PRD change.

Next step: `bmad-create-story` against this item — the schema question that blocked it is
resolved, this is now a normal implementation story.
