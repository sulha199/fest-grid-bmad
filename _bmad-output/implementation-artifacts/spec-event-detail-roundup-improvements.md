---
title: 'Event detail: roundup related-events heading, card rule, sort, and location link'
type: 'feature'
created: '2026-10-05'
status: 'done'
baseline_commit: '3a1e609bd7b5a956164231cb078a21efb0a98208'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-bug-047-eventcarddatebox-unified-content-rule.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** On a roundup / multi-event post's event detail page, the Related Events group is headed `Events from {account}`, the compact cards always show a "till" corner tag and a calendar-day-context date (so ended or not-yet-started events look wrong), related events are unsorted, and a location with no `schedule.location` falls back to plain text with no map link.

**Approach:** Persist an AI-extracted post headline on `posts` and use it as the group heading (account label as fallback); drive the related cards' date box and till tag from the masonry `EventCard` rule (`now`-based, BUG-047 / Story 1.i1k AC14) via a shared helper; hide ended events and sort the rest happening-now (earliest end first) then upcoming (earliest start first); render each schedule's location (its own, else the event-level one) through `LocationLink`.

## Boundaries & Constraints

**Always:** Follow `project-context.md` (i18n en+id, no hardcoded strings, skeletons in sync, codegen for GraphQL, DB migration + TS types for the new column). Till tag shows only when the event has started AND its end day is after today (identical to `EventCard.tsx` AC14); otherwise `tillLabel` is empty. Date box shows end date when started and not yet ended, else start date (`computeEventCardDateBoxParts` semantics).

**Ask First:** none outstanding. Decided by human: ended related events are hidden (same as the app's event-list behavior); location fix applies inside each schedule block of the detail page.

**Never:** Do not modify `formatEventStatus`, `computeEventCardDateBoxParts`, or `computeCalendarSegmentDateBoxContent` (calendar still uses it). Do not nest a link inside `EventCardCompact`'s button. No backfill of headlines for already-extracted posts.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Heading with title | source post `title` = "Weekend Jazz Roundup" | `Events from Weekend Jazz Roundup` | N/A |
| Heading, no title | `title` null/blank | existing `Events from {account}` (unchanged), then unknown-account label | N/A |
| Happening now | started, end day > today | end date in box, "till" tag | N/A |
| Ends today / ended | end day = today, or already ended | no till tag; box per rule | N/A |
| Upcoming | not started | start date in box, no till tag | N/A |
| Sort | A ends Oct 8 (live), B ends Oct 6 (live), C starts Oct 7, D starts Oct 6 | B, A, D, C; ended events hidden | missing dates sort last |
| Location, no/low confidence | no coordinates or confidence < 0.5 or non-full_match | name + MapPin + Search icon; href query = encoded name | N/A |
| Ended | end date < today (day granularity, as the event list's `isPastEvent`) | not rendered; group omitted if none remain | N/A |
| Location, event-level only | `schedule.location` empty, `location` set | `LocationLink` inside that schedule block (text-search href) | N/A |

</frozen-after-approval>

## Code Map

- `packages/database/schema.ts` + `packages/database/migrations/` -- add nullable `posts.title`
- `apps/backend/src/validation/extracted-event.schema.ts`, `lib/ai-processor/build-gemini-request.ts` -- add nullable `postTitle` to Gemini schema/prompt (short headline, roundups especially)
- `apps/backend/src/lib/ai-processor/process-ai-job.ts` (step 7.5) -- persist `posts.title`
- `apps/backend/src/schema/events.graphql`, `resolvers.ts` (`sourcePosts`), generated types -- expose `EventSourcePost.title`
- `apps/web/src/features/events/queries.graphql`, `EventDetailWrapper.tsx`, `locales/en.json`, `locales/id.json` -- fetch title, new label key `relatedEventsGroupTitleLabel` ("Events from {title}")
- `packages/ui/src/features/events/format-event-date.ts` -- new `computeEventCardCompactDateBox`, `sortRelatedEventsByRecency`
- `packages/ui/src/features/events/EventDetailView.tsx` (+ `.types.ts`) -- use helpers in `RelatedEventsGroupSection`; wrap fallback `location` in `LocationLink`
- `packages/ui/src/core/LocationLink.tsx` -- already implements search-icon/name-query behavior; verify only

## Tasks & Acceptance

**Execution:**
- [x] `packages/database/schema.ts` + migration -- add `posts.title` text nullable -- headline storage
- [x] backend validation / gemini request / process-ai-job -- extract + persist `postTitle` -- AI headline
- [x] `events.graphql`, `resolvers.ts`, codegen -- expose `title` on `EventSourcePost`
- [x] web query, `EventDetailWrapper.tsx`, en/id locales -- title-based heading with account fallback
- [x] `format-event-date.ts` -- helpers per I/O matrix, with unit tests (rule + sort order)
- [x] `EventDetailView.tsx` -- apply helpers; `LocationLink` for fallback location; component tests
- [x] `sprint-status`/`backlog.yaml` -- register as done per repo conventions; register any deferral

**Acceptance Criteria:**
- Given a roundup post with a title, when viewing an event detail page, then the group heading reads `Events from {title}`.
- Given the I/O matrix states, when related cards render, then the till tag and date box match the table and cards appear in the specified order.
- Given a location with no trustworthy coordinates, when rendered, then the link text is the name, the icon is Search, and the URL's `query` is the encoded name.

## Design Notes

`EventCardCompact` already hides the tag when `dateBoxTillLabel` is falsy (`EventCardDateBox`), so the fix is caller-side. Ended = same predicate the event list uses to hide ended events (reuse it, do not redefine).

## Verification

**Commands:**
- `pnpm --filter @festgrid/ui test` -- expected: pass
- `pnpm --filter @festgrid/backend test` -- expected: pass (DB-dependent suites per repo notes)
- `pnpm -w lint && pnpm -w build` -- expected: clean
- `uv run --python 3.11 --with pyyaml scripts/backlog-check.py` -- expected: clean

## Suggested Review Order

**Card rule and ordering (entry point)**

- Masonry-equivalent `now`-based date box and till tag, replacing the calendar-day helper.
  [`format-event-date.ts:638`](../../packages/ui/src/features/events/format-event-date.ts#L638)

- Hide ended (day granularity), happening by earliest end, then upcoming by earliest start.
  [`format-event-date.ts:671`](../../packages/ui/src/features/events/format-event-date.ts#L671)

- Section applies both; overflow count uses the filtered list.
  [`EventDetailView.tsx:852`](../../packages/ui/src/features/events/EventDetailView.tsx#L852)

**Location link**

- Event-level fallback location now a `LocationLink` inside the schedule block.
  [`EventDetailView.tsx:575`](../../packages/ui/src/features/events/EventDetailView.tsx#L575)

**Post headline**

- Nullable `posts.title` column and migration.
  [`schema.ts:342`](../../packages/database/schema.ts#L342)

- Gemini response schema and prompt ask for `postTitle`.
  [`build-gemini-request.ts:124`](../../apps/backend/src/lib/ai-processor/build-gemini-request.ts#L124)

- Persisted trimmed and capped alongside grouping facts.
  [`process-ai-job.ts:329`](../../apps/backend/src/lib/ai-processor/process-ai-job.ts#L329)

- Heading uses title, falls back to account label.
  [`EventDetailWrapper.tsx:681`](../../apps/web/src/features/events/EventDetailWrapper.tsx#L681)

**Tests**

- Rule, sort, hidden-ended, and location tests.
  [`EventDetailView.test.tsx`](../../packages/ui/src/features/events/EventDetailView.test.tsx)
