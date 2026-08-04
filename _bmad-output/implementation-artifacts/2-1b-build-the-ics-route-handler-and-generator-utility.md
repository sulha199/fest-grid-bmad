# Story 2.1b: Build the ICS route handler and generator utility

## Story Details

- Epic: 2
- Story ID: 2.1b
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a Next.js Route Handler and a shared, portable ICS generation utility,
so that the "Add to Calendar" MVP feature (FR11/FR12, PRD §3.3.1's one-way app-to-calendar integration) has a backing API surface to generate and deliver standard `.ics` files using event and schedule data, rather than the frontend assembling it ad hoc.

## Acceptance Criteria

1. **Given** a valid `eventId` query param (and, optionally, one or more `scheduleId` query params) is requested at `GET /api/calendar/ics`, **when** the event and the requested schedule(s) exist, **then** the response has `Content-Type: text/calendar; charset=utf-8` and `Content-Disposition: attachment; filename="<event-slug>.ics"` headers, and the body is a single valid RFC 5545 `VCALENDAR` string containing one `VEVENT` per requested schedule.
2. **Given** no `scheduleId` param is provided at all, **when** the endpoint resolves the event, **then** it defaults to including **all** of that event's schedules as separate `VEVENT`s in the one returned file (supports a plain "download this whole event" link, not just the future multi-select dialog).
3. **Given** a schedule has both `eventStartTime` and `eventEndTime` (and `eventEndDate` if the schedule spans multiple days), **when** its `VEVENT` is generated, **then** `DTSTART`/`DTEND` use those exact date-times.
4. **Given** a schedule has `eventStartTime` but no `eventEndTime`/`eventEndDate`, **when** its `VEVENT` is generated, **then** `DTEND` defaults to `DTSTART` + 2 hours (documented default single-session duration; PRD specifies no default).
5. **Given** a schedule has no `eventStartTime` at all, **when** its `VEVENT` is generated, **then** it is emitted as an all-day event (`VALUE=DATE`, no time component) spanning `eventStartDate` (through `eventEndDate` if present, otherwise just the start date).
6. **Given** a schedule has a resolvable IANA `timezone` (the `Schedule.timezone` field, already populated by the PRD §3.7 ingestion-time inference pipeline), **when** its `VEVENT` is generated, **then** `DTSTART`/`DTEND` are converted to UTC (`Z`-suffixed) reflecting that timezone's offset for the event's date/time.
7. **Given** a schedule has no `timezone` (null, or fails to resolve), **when** its `VEVENT` is generated, **then** `DTSTART`/`DTEND` are emitted as RFC 5545 "floating" local time (no `Z`, no `TZID`) using the literal wall-clock values from `eventStartDate`/`eventStartTime` — never silently defaulted to a guessed zone.
8. **Given** the same `scheduleId` is requested more than once (e.g. re-downloading the same event), **when** the `VEVENT`'s `UID` is generated, **then** it is stable and deterministic (derived from the schedule ID, not a random value per request), so calendar apps recognize a re-import as an update rather than a duplicate.
9. **Given** `eventId` is missing or not a syntactically valid ID, **when** the endpoint is called, **then** it returns HTTP 400 with a JSON error body — it never generates a malformed or empty `.ics` file.
10. **Given** `eventId` does not match any existing event, or none of the provided `scheduleId`(s) belong to the resolved event's schedules, **when** the endpoint is called, **then** it returns HTTP 404 with a JSON error body.
11. **Given** the ICS generation utility in `packages/domain/src/calendar`, **when** it is invoked directly with `Event`/`Schedule`-shaped data (independent of any HTTP/Next.js request/response object), **then** it returns a plain `.ics` string — decoupled from the HTTP layer so a future Node/Lambda context (e.g. Epic 3's reminder emails) can reuse it unmodified.

Note: This story is not user-facing (no UI is built here — see Out of Scope), so no i18n ACs apply per `story-content-structure.md`'s "when applicable" carve-out; JSON error bodies are developer/debugging-facing, not localized UI copy.

## Tasks / Subtasks

- [ ] Task 1: Build the portable ICS generation utility in `packages/domain` (AC: 3, 4, 5, 6, 7, 8, 11)
  - [ ] 1.1 Add `ics` (`^3.x`, MIT, zero runtime deps) and `date-fns-tz` (`^3.x`) to `packages/domain/package.json` dependencies; add a `"./calendar": "./src/calendar/index.ts"` entry to its `exports` map, matching the `./query`/`./geolocation` precedent.
  - [ ] 1.2 Define input types in `packages/domain/src/calendar/types.ts`: an `IcsEventInput` (eventName, slug, description, url) and `IcsScheduleInput` (id, eventStartDate, eventEndDate, eventStartTime, eventEndTime, timezone, location/locationDetails.formattedAddress) — a narrow, purpose-built shape, not a re-export of the full PRD `Schedule`/`EventInfo` interfaces (see Data Type Compatibility below for why).
  - [ ] 1.3 Implement `buildIcsCalendar(event: IcsEventInput, schedules: IcsScheduleInput[]): string` in `packages/domain/src/calendar/buildIcsCalendar.ts` using `ics`'s `createEvents()`:
    - One `EventAttributes` entry per schedule → one `VCALENDAR` with N `VEVENT`s (AC1, AC2).
    - `uid: \`${scheduleId}@festdaily.app\`` (AC8) — deterministic, RFC-822-style per `ics`'s UID convention; use "festdaily.app" per `project-context.md`'s app-name rule (FestDaily, not FestGrid).
    - No `eventStartTime` → 3-value `start`/`end` arrays (`[y, m, d]`), `end` = day after the last date, for an all-day event (AC5).
    - `eventStartTime` present, no `eventEndTime`/`eventEndDate` → pass `duration: { hours: 2 }` instead of `end` (AC4).
    - Known `timezone` → convert the local wall-clock start/end via `date-fns-tz`'s `fromZonedTime(localDateString, timezone)`, then build the UTC array from the resulting `Date`'s `getUTC*()` components; pass with `startInputType: 'utc'`/`endInputType: 'utc'` (`ics` default output is UTC/`Z`-suffixed) (AC6).
    - Missing/invalid `timezone` → pass the literal wall-clock `[y,m,d,h,mi]` array with `startOutputType: 'local'`/`endOutputType: 'local'` (RFC 5545 floating format, no `Z`/`TZID`) (AC7).
    - Map `title` ← `eventName` (+ schedule `title` if present), `description` ← event description, `location` ← schedule location/formattedAddress falling back to event location, `url` ← event detail page URL.
    - Throw a descriptive `Error` if `ics.createEvents()` returns `{ error }` (non-null) — let the Route Handler's catch block turn that into a 500, consistent with the existing GraphQL proxy route's error-handling pattern.
  - [ ] 1.4 Unit tests in `packages/domain/src/calendar/buildIcsCalendar.test.ts` (Node's built-in `node:test` + `node:assert/strict`, per `packages/domain/src/geolocation/build-cache-key.test.ts` precedent) achieving 100% coverage per the Testing Rules — cover: single schedule, multiple schedules → multiple VEVENTs, start+end present, start-only (2h default), no-start (all-day), known-timezone UTC conversion (assert exact `Z`-suffixed offset math for a fixed test case, e.g. `Asia/Jakarta` UTC+7), missing/invalid timezone (assert floating format, no `Z`), UID stability across two calls with the same schedule ID, and special-character escaping in title/description/location (commas, semicolons, newlines — `ics` handles this internally, but assert it round-trips correctly).
  - [ ] 1.5 Barrel-export `buildIcsCalendar` and the input types from `packages/domain/src/calendar/index.ts`.
- [ ] Task 2: Build the Next.js Route Handler (AC: 1, 2, 9, 10)
  - [ ] 2.1 Add a `getEventForIcsExport($id: ID!)` query to `apps/web/src/features/events/queries.graphql`, requesting `eventName`, `slug`, `description`, `location`, and `schedules { id eventStartDate eventEndDate eventStartTime eventEndTime timezone location locationDetails { formattedAddress } }` from the existing `event(id: ID!)` query (no new backend resolver/schema work — reuses Story 1.3a's query, satisfying AD-2's "no new single-purpose endpoint" for the *data fetch*; see Architecture & UX Gate Findings for why the file-delivery endpoint itself doesn't fall under AD-2's scope). Run `pnpm run codegen` (`apps/web`) to regenerate `src/generated/graphql.ts`, producing `GetEventForIcsExportDocument`/`GetEventForIcsExportQuery`.
  - [ ] 2.2 Add `"@festgrid/domain": "workspace:*"` to `apps/web/package.json` dependencies (not present today — verified via `apps/web/package.json`).
  - [ ] 2.3 Implement `GET` in `apps/web/src/app/api/calendar/ics/route.ts`:
    - Parse `eventId` from `req.nextUrl.searchParams.get('eventId')`; if missing/empty, return 400 JSON `{ error: 'eventId is required' }` (AC9).
    - Parse `scheduleId` via `req.nextUrl.searchParams.getAll('scheduleId')` (supports zero, one, or many repeated params).
    - Fetch via `graphqlClient.request(GetEventForIcsExportDocument, { id: eventId })` (reusing `apps/web/src/lib/graphql-client.ts`'s isomorphic client — server-side, it hits `BACKEND_GRAPHQL_URL` directly, same as the existing `/api/graphql` proxy and every other server-rendered query in this app). If the query returns a null `event`, return 404 JSON `{ error: 'Event not found' }` (AC10).
    - If `scheduleId` params were given, filter `event.schedules` to only the matching IDs; if the filtered list is empty (none matched), return 404 JSON `{ error: 'No matching schedules found' }` (AC10). If none were given, use all of `event.schedules` (AC2).
    - Map the GraphQL result into `IcsEventInput`/`IcsScheduleInput[]`, call `buildIcsCalendar(...)`, and return `new NextResponse(icsString, { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': \`attachment; filename="${event.slug}.ics"\` } })`.
    - Wrap in try/catch; on unexpected error, `console.error` and return 500 JSON `{ error: 'Internal Server Error' }`, mirroring `apps/web/src/app/api/graphql/route.ts`'s existing error-handling shape.
  - [ ] 2.4 Integration tests in `apps/web/src/app/api/calendar/ics/route.test.ts` (Vitest, mocking `graphqlClient.request` the same way `route.test.ts` for the auth callback mocks its dependencies) covering: 200 with correct headers + VCALENDAR body for a single schedule; 200 with multiple `VEVENT`s for multiple `scheduleId` params; 200 with all schedules when `scheduleId` is omitted; 400 for missing `eventId`; 404 for unknown `eventId`; 404 for a `scheduleId` that doesn't belong to the resolved event.
- [ ] Task 3: Verification (AC: all)
  - [ ] 3.1 Manually request the endpoint against local dev data (a real `eventId`/`scheduleId` from the seeded/dev DB) and open the downloaded `.ics` in a text editor to sanity-check `VCALENDAR`/`VEVENT` structure and that a calendar app (e.g. Google Calendar's "import" flow) accepts it without error.
  - [ ] 3.2 Run `pnpm build` (type-check) and `pnpm lint` for `packages/domain` and `apps/web`.
  - [ ] 3.3 Confirm `packages/domain`'s coverage remains 100% including the new `calendar/` files, per the Testing Rules.

## Dev Notes

- This story adds zero new backend resolvers/schema and zero DB/domain writes — it is purely a read-and-format pipeline: `apps/web` Route Handler → existing GraphQL `event(id)` query → `packages/domain`'s pure ICS formatter → HTTP response.
- Source tree: new `packages/domain/src/calendar/` module; new `apps/web/src/app/api/calendar/ics/route.ts`; one new query added to the existing `apps/web/src/features/events/queries.graphql`.
- Testing standard: `packages/domain` requires 100% unit coverage (Testing Rules); `apps/web` follows the testing-trophy approach — integration tests via Vitest for the route handler are this story's primary coverage, since there is no UI/E2E flow to exercise yet (see Architecture & UX Gate Findings).

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3 (Architecture/Infra + Foundational Dependency Completeness):** Sourced from `_bmad-output/planning-artifacts/epic-readiness/epic-2-readiness.md` (`swept: true`, `2.1b` listed in `stories_covered`). This story **is itself** the prerequisite story the sweep created to close two gaps: (a) Gate 1 — "no API surface exists to safely assemble and deliver `.ics` files" (ICS Download API Surface), and (b) Gate 3 — "no shared, decoupled utility exists to parse `EventInfo`/`Schedule` into ICS format, reusable by Epic 3's reminders" (ICS Generator Utility). Both are fully addressed by this story's two deliverables (Route Handler + `packages/domain/src/calendar`). No further prerequisite split needed.
- **Lightweight escape-hatch guard (no subagent, per Epic-Level Sweep Mode):** Re-checked this story's specific scope against the swept report for anything epic-wide sweep didn't anticipate. One nuance found and resolved without a new gate: AD-2 ("no new single-purpose endpoint for event *collections*") could be misread as forbidding this new route. It doesn't apply — AD-2 binds the retrieval of **event collections** (discovery/favorites/added-events lists); this endpoint fetches a single already-public event via the *existing* `event(id)` query and only adds a new **file-format delivery** surface (`.ics`, not JSON/GraphQL), which is exactly the kind of API surface Gate 1 itself identified as legitimately missing. No gap; documented here so `bmad-dev-story`/reviewers don't re-litigate it.
- **Gate 2 (UI Complexity & Reusability):** Run fresh via a one-shot subagent review (Freya's lens), since the epic-2 sweep intentionally excludes Gate 2. **No gap found.** This story builds zero React components/hooks/pages. The UX artifact (`01.2-event-detail.md`, "Adding to Calendar") describes a button + multi-select dialog + confirmation state — none of that is in scope here; it belongs to a future, not-yet-created story that will wire a UI trigger to this endpoint (see Out of Scope). Omitting UI this story never claimed to build is a scope boundary, not an under-specification.
- **Escape hatch note:** none invoked beyond the AD-2 clarification above — no gate raised a blocking gap requiring user override.

### Design Decisions (confirmed with user before drafting)

Four non-mechanical product/technical decisions were confirmed with the user (shulha) before this story was written, since no existing doc (PRD, architecture spine, epics.md) settled them:

1. **Multi-schedule scope:** The route/utility supports **multiple `scheduleId`s combined into one `.ics` file** (multiple `VEVENT`s in one `VCALENDAR`), matching the future "select multiple schedules, one Confirm tap" UX in `01.2-event-detail.md`, rather than being scoped to exactly one schedule per request as `epics.md`'s AC shorthand's singular wording might suggest.
2. **Timezone fallback:** When `Schedule.timezone` is null/unresolvable, emit **floating local time** (no `Z`/`TZID`) rather than guessing a fixed project-default zone (e.g. `Asia/Jakarta`) — guessing risks silently mislabeling an event that isn't actually in that zone, which is worse than admitting the timezone is unknown. This mirrors the codebase's existing "degrade gracefully rather than guess" pattern (`formatEventDate` in `EventCard.tsx`).
3. **Missing end time/date defaults:** No `eventStartTime` at all → all-day event (`VALUE=DATE`). `eventStartTime` present but no end → default to a **2-hour duration**. (Alternative considered and rejected: defaulting to end-of-day 23:59, which is a better fit for open-ended events like festivals/markets but a worse fit for the more common single-session case like a concert or talk.)
4. **ICS generation approach:** Use the **`ics` npm package** (adamgibbons/ics — ~575k weekly downloads, actively maintained, zero runtime dependencies, plain functional `createEvents()` API) rather than hand-writing RFC 5545 formatting (line-folding at 75 octets, text escaping, `DTSTAMP`, UID format) from scratch — the library already has years of bug-fixes for exactly the fiddly details this story would otherwise own.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** No mismatch found between the PRD's `EventInfo`/`Schedule` interfaces and what this story consumes — this story only *reads* existing fields (`eventStartDate`, `eventStartTime`, `eventEndDate`, `eventEndTime`, `timezone`, `locationDetails`) that already exist on the `Schedule` GraphQL type (`apps/backend/src/schema/events.graphql`) and were already exposed to `apps/web` via Story 1.3a's `event`/`eventBySlug` queries.
- **Impacted fields/contracts:** A new GraphQL *operation document* (`getEventForIcsExport`, `apps/web/src/features/events/queries.graphql`) and its codegen'd types (`apps/web/src/generated/graphql.ts`) — no schema/resolver/DB changes. A new, narrow `IcsEventInput`/`IcsScheduleInput` type pair local to `packages/domain/src/calendar/types.ts`.
- **Required DB migration changes:** None — this story adds no tables/columns.
- **Required TypeScript type changes:** `IcsEventInput`/`IcsScheduleInput` are deliberately **not** added to `packages/shared-types`. They are a narrow, purpose-built projection of just the fields the ICS formatter needs (not a general-purpose PRD entity like `EventInfo`/`Schedule`/`Favorite`/`CalendarEntry`), so they belong as an implementation-local type in `packages/domain/src/calendar`, consistent with how `packages/domain/src/geolocation/types.ts` keeps its own `GeolocationQuery` type local rather than promoting it to `shared-types`.
- **Backward compatibility and rollout notes:** Purely additive — one new GraphQL operation document (client-side only, no schema change), one new Route Handler, one new `packages/domain` subpackage. No existing behavior changes.
- **Verification checks:** `packages/domain`'s 100% coverage requirement proves the formatter's correctness in isolation (Task 1.4); the route handler's integration tests (Task 2.4) prove the GraphQL→domain→HTTP pipeline end-to-end; a type-check (`pnpm build`) proves the codegen'd `GetEventForIcsExportQuery` type and the `IcsEventInput`/`IcsScheduleInput` mapping agree with no `any`/type assertions needed.

### Package boundaries

- `packages/domain/src/calendar/` — pure, framework-agnostic ICS formatting logic. Depends only on `ics` and `date-fns-tz` (both plain JS libraries, no DB/ORM/Node-runtime-only APIs), satisfying the Code Organization rule's "dependency-free of DB/ORM/Node-only modules" restriction — this makes it safe for a *future* frontend import too, not just backend, though none is planned in this story.
- `apps/web` — owns the Route Handler (HTTP concerns: query param parsing, status codes, headers) and the GraphQL fetch (via the existing isomorphic `graphqlClient`). Gains a new `@festgrid/domain` dependency (not previously used by `apps/web`).
- No `apps/backend` changes — the existing `event(id)` query (Story 1.3a) already returns everything this story needs; no new resolver/schema field.
- No `packages/ui` changes — zero UI in this story (Gate 2 confirmed no gap).

### Architecture / technical constraints

- **AD-1/AD-2 (Unified Event Querying):** This story's data fetch reuses the existing `event(id: ID!)` query as-is — no new query condition, no new event-collection endpoint. See the AD-2 escape-hatch clarification above for why the new *file-delivery* route itself doesn't conflict with AD-2's "no new single-purpose endpoint" rule (that rule targets event-collection retrieval, not single-event file export).
- **AD-8 (Soft-Delete Convention):** `event(id)` already excludes soft-deleted rows by default (existing resolver behavior, Story 1.3a) — this story inherits that for free; a soft-deleted event's ID will 404 via this endpoint the same way it would via the GraphQL query directly.
- **No auth requirement:** `event(id)`/`eventBySlug` are already public, unauthenticated queries (confirmed by reading `apps/backend/src/schema/resolvers.ts` — neither calls `requireAuth`), matching Story 2.1's precedent that the event detail page itself is browsable without login. This endpoint inherits the same public accessibility; it performs no writes and exposes no data beyond what `event(id)` already exposes publicly.
- **GraphQL abuse prevention:** Already configured server-wide by Story 0.8 (`graphql-armor`, `maxDepth: 10`); this story's query adds no new nesting depth.
- **Analytics (AD-5):** No new tracked event in this story. Firing a `calendar_export_downloaded`-style event belongs to the future "Add to Calendar" button/UI story (the actual user-interaction trigger point), not this backend-only surface — noted so that story doesn't miss instrumenting it.
- **i18n (AD-6):** N/A — no user-facing UI copy in this story; JSON error bodies are developer-facing, not localized strings.
- **State management / Loader classification:** N/A — no React state, no async UI loading state; this story contains no client-side code.
- **Cloud/external service setup:** N/A — no new AWS resource or third-party service; `ics`/`date-fns-tz` are plain npm libraries, not external services. No `SETUP_WALKTHROUGH.md` changes needed.

### Previous/Sibling Story Intelligence (Stories 2.1a, 2.1)

- Story 2.1a established the `isAddedToCalendar` computed field and `toggleCalendarAddition` mutation (persisting a `calendar_additions` row) — **this story does not call or depend on either.** This story is a stateless "generate the file" utility; persisting a `CalendarEntry` row (marking a schedule as "added") is a separate concern that the future Add-to-Calendar UI story will handle (likely calling both `toggleCalendarAddition` *and* this ICS endpoint together, e.g. mutate-then-download).
- Story 2.1's Dev Notes flagged that `apps/web`'s `EventDetailWrapper.tsx`/`mapper.ts` already renders the event detail page (where an "Add to Calendar" trigger will eventually live) — this story adds no changes to those files; it is purely additive (a new route + a new domain subpackage) with no coupling to Story 2.1's favorite-toggle wiring.
- Both 2.1a and 2.1's Gate 2 reviews independently concluded that `EXPERIENCE.md`'s "Soft Delete with Undo" pattern doesn't apply to their scope; this story's Gate 2 review (above) reaches a parallel conclusion for a different reason (zero UI at all, not just a pattern mismatch).

### Git Intelligence Summary

Recent commits (`87223f7` docs: added Stories 2.1b/2.4a to epics.md; `39f40ad` Story 0.21 artifact; `e7e1781` Geolocation provider swap Google→Geoapify; `3b506cd` soft-delete-with-undo UI primitive; `626c4a1` explicit URL query param validation mandate) are documentation/planning and unrelated frontend-primitive work — no prior commit touches `apps/web/src/app/api/`, `packages/domain/src/`, or ICS/calendar functionality. `apps/web/src/app/api/graphql/route.ts` (the GraphQL proxy) and `apps/web/src/app/auth/callback/route.ts` (+ its `route.test.ts`) remain the only two existing Route Handlers in the codebase and are the correct structural/test precedents to follow.

### Latest Tech Information

- `ics` (adamgibbons/ics), latest stable `3.12.0` per npm as of this story's creation: `createEvents(events: EventAttributes[]): { error: Error | null, value: string | undefined }`. `start`/`end` accept a `[y, m, d, h, mi]` (or 3-value `[y, m, d]` for all-day) array or a Unix timestamp; `duration: { hours, minutes, ... }` is an alternative to `end` (exactly one of `end`/`duration` required); `startInputType`/`endInputType` (`'local'` default | `'utc'`) control how the input array is interpreted, `startOutputType`/`endOutputType` (`'utc'` default | `'local'`) control the emitted format (`'local'` output = RFC 5545 floating time, no `Z`/`TZID`). Verify this exact call shape against the installed version when implementing, since minor versions have shifted this API before (per Story 2.1a's own Drizzle partial-index caveat — same category of "verify against installed version" risk).
- `date-fns-tz` `^3.x`: use `fromZonedTime(dateString, timeZone)` (the current v3 name; the equivalent v1/v2 function was named `zonedTimeToUtc`) to convert a schedule's local wall-clock date/time string + IANA `timezone` into a UTC `Date`, then read `getUTCFullYear()`/`getUTCMonth()`/etc. to build the array `ics` needs for `startInputType: 'utc'`.
- Neither `ics` nor `date-fns-tz` is currently installed anywhere in this monorepo (verified via grep across all `package.json` files) — this story introduces both as new dependencies, scoped to `packages/domain` only.

## Global Rules References

- [x] `project-context.md` — Technology Stack (GraphQL-only data path, Code Organization/`packages/domain` purity rule, App Name = FestDaily), Critical Implementation Rules, Testing Rules (100% `packages/domain` coverage).
- [x] `story-content-structure.md` — canonical section order and status vocabulary followed in this file.
- [x] `festgrid-architecture-spine.md` — AD-1 (Unified Query DSL), AD-2 (Unified Event Querying), AD-8 (Soft-Delete Convention).
- [x] `docs/infrastructure/index.md` / `1-frontend.md` — this story is frontend-only (a Next.js Route Handler in `apps/web`, no new AWS/backend infra), so only the index-level summary applies; no new IaC/deployment step is introduced.

## Implementation Plan (Rule-Compliant)

### File Change Plan

- **NEW** `packages/domain/src/calendar/types.ts` — `IcsEventInput`/`IcsScheduleInput` types.
- **NEW** `packages/domain/src/calendar/buildIcsCalendar.ts` — the pure ICS generation function.
- **NEW** `packages/domain/src/calendar/buildIcsCalendar.test.ts` — unit tests, 100% coverage.
- **NEW** `packages/domain/src/calendar/index.ts` — barrel export.
- **UPDATE** `packages/domain/package.json` — add `ics`, `date-fns-tz` dependencies; add `./calendar` export.
- **UPDATE** `apps/web/package.json` — add `@festgrid/domain` dependency.
- **UPDATE** `apps/web/src/features/events/queries.graphql` — add `getEventForIcsExport` query.
- **REGENERATED** `apps/web/src/generated/graphql.ts` — via `pnpm run codegen`, not hand-edited.
- **NEW** `apps/web/src/app/api/calendar/ics/route.ts` — the `GET` Route Handler.
- **NEW** `apps/web/src/app/api/calendar/ics/route.test.ts` — integration tests.

### Rule Mapping

- Reusable, framework-agnostic mechanism → `packages/domain` (per activation persistent fact + Code Organization rule) — the ICS formatter is pure, DB/Node-runtime-dependency-free, satisfying the "backend-safe, potentially frontend-safe" bar.
- No React/UI in scope → confirmed via fresh Gate 2 review; no `packages/ui` changes.
- AD-2 compliance → data fetch reuses the existing `event(id)` query; new route only adds a file-format delivery surface, which is what Gate 1 itself identified as the missing piece (not a new event-collection endpoint).
- AD-8 compliance → inherited for free via the existing `event(id)` resolver's default soft-delete exclusion.
- No cloud/external service setup → N/A, no `SETUP_WALKTHROUGH.md` changes.
- No analytics/i18n/state-management/loader classification → all N/A per the persistent facts' own "if applicable" framing (no user interaction, no UI, no async loading state in this story's scope).
- Data-type compatibility → No changes required section completed per the mandatory template; new types stay local to `packages/domain/src/calendar`, not promoted to `packages/shared-types`, since they're an implementation-local projection, not a PRD entity.

### Verification Plan

- `packages/domain`: `pnpm --filter @festgrid/domain test` (Node's built-in test runner) — 100% coverage on the new `calendar/` files.
- `apps/web`: `pnpm --filter web test` (Vitest) — route handler integration tests covering 200 (single/multi/all-schedules), 400, 404 paths.
- `pnpm build` at the repo root (or scoped to `packages/domain`/`apps/web`) — type-check proving the codegen'd GraphQL types and the domain input types compose with no `any`/assertions.
- `pnpm lint` for both touched packages.
- Manual smoke test: request the endpoint against local dev data, open the resulting `.ics` file, and confirm it opens cleanly in a standard calendar app (Task 3.1).

## Pre-Coding Approval Gate

- [ ] Scope confirmation — Route Handler + `packages/domain/src/calendar` utility only; no UI, no `CalendarEntry` persistence, no analytics instrumentation (all explicitly deferred, see Out of Scope).
- [ ] Architecture and boundary confirmation — no new backend resolvers/schema, no `packages/ui` changes, `packages/domain/calendar` stays DB/Node-runtime-dependency-free.
- [ ] Testing plan confirmation — 100% `packages/domain` unit coverage + `apps/web` route-handler integration tests in lieu of E2E (no UI/user flow exists yet to E2E-test).
- [ ] Explicit human approval state (Default: **pending approval**).
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted — Gate 1/3 sourced from swept `epic-2-readiness.md` (this story **is** their resolution); Gate 2 run fresh, no gap found. The four Design Decisions above (multi-schedule scope, timezone fallback, missing-duration defaults, `ics` library choice) were explicitly confirmed with the user before this story was drafted.

## Testing Requirements

- [ ] Unit tests (`packages/domain/src/calendar/buildIcsCalendar.test.ts`) — 100% coverage, per Testing Rules: multi-schedule combination, start+end present, start-only default duration, no-start all-day, known-timezone UTC conversion, missing/invalid-timezone floating fallback, UID stability, special-character escaping.
- [ ] Integration tests (`apps/web/src/app/api/calendar/ics/route.test.ts`, Vitest) — 200/400/404 paths, header correctness, multi-`scheduleId` and no-`scheduleId` (all-schedules) handling, mocking `graphqlClient.request`.
- [ ] No Playwright E2E test in this story — there is no UI/user-facing flow yet to click through (the "Add to Calendar" button doesn't exist until a future story). This is a documented, intentional deviation from the default "primary E2E happy path" DoD item, substituted with the route-handler integration test as this story's happy-path proof, consistent with the Testing Philosophy's trophy model (integration over E2E) for non-critical-flow code.

## Deliverables Checklist

- [ ] `packages/domain/src/calendar/{types.ts,buildIcsCalendar.ts,buildIcsCalendar.test.ts,index.ts}` implemented with 100% coverage.
- [ ] `packages/domain/package.json` updated with `ics`/`date-fns-tz` deps and `./calendar` export.
- [ ] `apps/web/src/features/events/queries.graphql` has the new `getEventForIcsExport` query; `apps/web/src/generated/graphql.ts` regenerated.
- [ ] `apps/web/package.json` depends on `@festgrid/domain`.
- [ ] `apps/web/src/app/api/calendar/ics/route.ts` + `route.test.ts` implemented and passing.
- [ ] Manual smoke test performed against local dev data (Task 3.1) and noted in Completion Notes.

## Out of Scope

- **The "Add to Calendar" button, schedule-selection dialog, and confirmation-state UI** described in `01.2-event-detail.md` — no story currently exists for this UI wiring; a future story must create it (and should also decide whether it calls `toggleCalendarAddition` (Story 2.1a) alongside triggering this download). Flagged here for visibility, not created as a new backlog entry, since this is a known/accepted gap the Epic 2 readiness sweep already anticipated ("Anticipated Gate 2 note" in `epic-2-readiness.md`) rather than a gap this story's own gates newly discovered.
- **Persisting a `CalendarEntry` row** when a `.ics` is downloaded — this story is a stateless generator; Story 2.1a's `toggleCalendarAddition` mutation already exists for that and is not called from this route.
- **Analytics instrumentation** (e.g. a `calendar_export_downloaded` PostHog event) — belongs to the future UI trigger story, not this backend-only surface.
- **VALARM (reminder) blocks, recurrence rules, or `VTIMEZONE` component generation** — not required by any AC; the floating-time fallback (Design Decision #2) sidesteps the need for embedded `VTIMEZONE` blocks entirely for this story's scope.
- **Reusing this utility for Epic 3's reminder emails** — the utility is *built* to be reusable there (AC11), but wiring it into any Epic 3 feature is that epic's own future work, not this story's.

## Definition of Done

- [ ] AC1–AC11 satisfied and verified by the tests in Task 1.4/2.4.
- [ ] `packages/domain` unit tests passing with 100% coverage on new files; `apps/web` integration tests passing.
- [ ] Lint and type checks (`pnpm lint`, `pnpm build`) passing for `packages/domain` and `apps/web`.
- [ ] Manual smoke test (Task 3.1) performed and its outcome recorded in Completion Notes.
- [ ] No decrease in overall project test coverage.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
