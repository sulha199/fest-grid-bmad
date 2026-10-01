---
baseline_commit: 526a84cb7076f16f7db661a1a76d753b5b8568fd
---

# Story 0.37: Extract and Display Event Links

## Story Details

- Epic: 0
- Story ID: 0.37
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

<!--
Standalone Epic 0 story sourced directly from backlog.yaml's IDEA-012 (status: triaged,
impact: user-visible, effort: m). No formed epic covers a generic "links" field (checked
Epic 3's AI-extraction stories and Epic 4's correction-flow stories — both only ever
handle contactInfo, never a links array), and no `epics.md` section is added for this
story, mirroring the precedent of Stories 0.33/0.34/0.35/0.36 (all standalone,
backlog-sourced Epic 0 stories with no epics.md entry). Next available Epic 0 number
confirmed as 0.37 (highest existing: 0-36-harden-past-events-visibility-mechanism).
-->

## Story

As a FestDaily user viewing an event's detail page,
I want to see any additional links (ticketing, RSVP, merch, linktree, etc.) that were
mentioned in the event's original social media post,
so that I can follow through on information the organizer shared beyond what fits into
the structured event fields.

## Acceptance Criteria

1. Given a post's caption/image is sent to Gemini for event extraction, when the model
   identifies one or more explicit links in the source content, then the Gemini extraction
   response schema (`geminiExtractionResponseSchema` in `build-gemini-request.ts`) and the
   numbered system-instruction prompt (a new instruction, e.g. "6b") request a
   `links: {url, label?}[]` array, and the AJV validation schema (`extractedEventSchema` in
   `extracted-event.schema.ts`) declares a matching `links` property (nullable array, item
   shape `{url: string, label?: string}`, `additionalProperties: false`, capped at 10 items)
   so the field round-trips instead of being silently stripped by the schema's existing
   `additionalProperties: false`.
2. Given a raw Gemini `links` payload of 0+ entries, when `transformGeminiResponseToEventInfo`
   processes it, then each entry passes through a new pure domain function
   `sanitizeEventLinks` (`packages/domain/src/events/sanitize-event-links.ts`) that: drops any
   entry whose `url` does not parse as an absolute URL with an `http:`/`https:` protocol
   (guards against `javascript:`/`data:`/malformed values ever reaching a rendered `href`);
   trims `label` and treats an empty/whitespace-only label as absent; caps the result at the
   first 10 valid entries (source order); and returns `undefined` (not `[]`) when no valid
   entries remain, matching this file's existing absent-not-empty convention (see
   `contactInfo`'s discard-at-classification handling).
3. Given a sanitized `links` array (or `undefined`), when `buildEventInsertValues` builds the
   event insert row, then `EventInsertValues.links` is set to `message.links ?? null` and
   persisted to a new `events.links` jsonb column (`packages/database/schema.ts`:
   `links: jsonb('links').$type<EventLink[]>()`, nullable — mirroring the
   `locationDetails`/`proposedData` typed-jsonb pattern already used elsewhere in that same
   file, **not** `contactInfo`'s plain `text()` column, since `links` is an array of objects)
   via a drizzle-kit-generated migration file checked into `packages/database/migrations/`.
4. Given the GraphQL `Event` type, when a client requests the new `links` field, then
   `apps/backend/src/schema/events.graphql` exposes `type EventLink { url: String! label:
   String }` and `Event.links: [EventLink!]`, resolved with **zero new resolver code** via
   the existing `buildOptimizedDrizzleSelect(events, info)` passthrough (the GraphQL field
   name `links` matches the Drizzle column key `links` exactly — the same mechanism already
   serving `contactInfo` with no explicit field resolver).
5. Given an event whose `links` array is non-empty, when a user opens that event's detail
   view (`EventDetailView.tsx`, `packages/ui`), then a new links section renders **one row
   per link** (not a single row with inline-combined items), each styled as a clickable
   `<a href={url} target="_blank" rel="noopener noreferrer">` matching the existing
   private-contact Instagram-link markup pattern (`flex items-start gap-2 text-sm
   text-gray-600 dark:text-gray-400 hover:underline hover:text-primary`, a leading icon,
   `<span>{label || url}</span>`, trailing `ExternalLink` icon) — **not** the plain
   non-anchor `contactInfo` `<div>`, since links are actionable rather than display-only
   text. The section is entirely omitted (no empty-state placeholder) when `links` is
   absent or empty, matching the existing `(hasPrivateContact || contactInfo) &&` gating
   pattern already used on that same section of the page.
6. The links row requires **no new locale strings**: it mirrors `contactInfo`'s existing
   label-less icon+text row (confirmed: no `contactInfoLabel` key exists in the
   `EventDetailsPage` locale namespace of `apps/web/locales/en.json`/`id.json` — that key
   belongs to the unrelated `EventCorrectionForm` namespace). No `en.json`/`id.json` changes
   are required for AC5; this is an explicit non-requirement to prevent inventing an
   unnecessary label.
7. This story explicitly does **not** extend the "Correct Data" manual-correction flow
   (`CorrectionForm.tsx`, `correction-dialog.tsx`, `ProposedEventCorrection`,
   `corrections.graphql`, `proposed-event-correction.schema.ts` on both backend and
   frontend) to support manual link entry/editing — see Out of Scope and backlog item
   IDEA-036.

## Tasks / Subtasks

- [x] Task 1: Extend Gemini extraction schema & prompt (AC: #1)
  - [x] 1.1 Add a `links` ARRAY-of-OBJECT property (`{url: STRING, label: STRING}`) to
        `geminiExtractionResponseSchema` in `build-gemini-request.ts`
  - [x] 1.2 Add a new numbered prompt instruction (e.g. "6b", after the existing
        contactInfo instructions 6/6a) telling the model to extract any explicit
        additional links (ticketing/RSVP/merch/linktree/etc.) mentioned in the caption or
        visible in the image, with an optional short label when the source text names the
        link (e.g. "Tickets:", "RSVP here")
  - [x] 1.3 Add a matching `links` property to `extractedEventSchema` in
        `extracted-event.schema.ts`, mirroring `geminiScheduleSchema`'s nested
        array-of-objects pattern (not `contactInfo`'s flat string field): `type: 'array'`,
        `nullable: true`, `maxItems: 10`, items `{type: 'object', properties: {url:
        {type:'string'}, label: {type:'string', nullable:true}}, required: ['url'],
        additionalProperties: false}`
  - [x] 1.4 Add `EventLink { url: string; label?: string }` to
        `packages/shared-types/src/index.ts`, co-located near `LocationDetails` following
        its doc-comment style
  - [x] 1.5 Add `links?: EventLink[]` to `GeminiExtractionPayload` in
        `packages/domain/src/events/types.ts` (import `EventLink` alongside the existing
        `EventType, EventCategory, LocationDetails` import)
  - [x] 1.6 **Rebase-risk note:** `build-gemini-request.ts`'s prompt/response schema is
        also being edited by in-flight Stories 3.6i/3.6j/3.6k/3.6l (all `review` status
        per sprint-status.yaml, not yet merged) — confirmed by `epics.md` line ~2651's own
        cross-story warning. Whichever change lands second must rebase onto the other
        rather than silently reverting it; check current `main`/target-branch state of this
        file before editing.
- [x] Task 2: Domain sanitization (AC: #2)
  - [x] 2.1 Create `packages/domain/src/events/sanitize-event-links.ts` exporting
        `sanitizeEventLinks(links: EventLink[] | undefined): EventLink[] | undefined` per
        AC2's exact rules (protocol allowlist, label trim, cap at 10, undefined-not-empty)
  - [x] 2.2 Add `sanitize-event-links.test.ts` with 100% coverage (packages/domain Testing
        Rule): valid http/https kept; `javascript:`/`data:`/malformed URLs dropped;
        whitespace-only label treated as absent; >10 valid entries capped to first 10;
        `undefined`/empty-array input returns `undefined`
  - [x] 2.3 Add `links?: EventLink[]` to `ExtractedEventMessage` in `types.ts`; wire
        `sanitizeEventLinks(payload.links)` into `transform-gemini-response-to-event-info.ts`
        (as its own numbered step, alongside the existing contactInfo discard-at-classification
        step) and add/extend `transform-gemini-response-to-event-info.test.ts` coverage
- [x] Task 3: Storage (AC: #3)
  - [x] 3.1 Add `links?: EventLink[] | null` to `EventInsertValues` in `types.ts`; set
        `links: message.links ?? null` in `build-event-insert-values.ts`; extend
        `build-event-insert-values.test.ts`
  - [x] 3.2 Add `links: jsonb('links').$type<EventLink[]>()` to the `events` pgTable in
        `packages/database/schema.ts` (import `EventLink` from `@festgrid/shared-types`
        alongside the existing `LocationDetails`/`ProposedEventCorrection` type imports
        used for other `.$type<...>()` columns in this file)
  - [x] 3.3 Generate the migration: `pnpm --filter @festgrid/database generate`; review the
        generated `NNNN_<name>.sql` + snapshot + journal entry before committing (a plain
        nullable-column add should not need the hand-edit workaround AD-8's partial indexes
        require)
  - [x] 3.4 Check `packages/database/seed.ts` and any fixture/test data asserting a full
        `EventInsertValues`/events-row shape; add sample `links` data where it improves
        local-dev/test realism (optional, not AC-gating) — skipped: no existing seed
        fixture data needed updating for this to be locally testable/realistic.
- [x] Task 4: GraphQL (AC: #4)
  - [x] 4.1 Add `type EventLink { url: String! label: String }` (placed before `type Event`,
        mirroring `LocationDetails`'s placement before `type Schedule`) and `links:
        [EventLink!]` on `Event` in `apps/backend/src/schema/events.graphql`
  - [x] 4.2 Regenerate backend codegen (repo's backend `codegen` script) →
        `apps/backend/src/generated/resolvers-types.ts`; do not hand-edit generated output
  - [x] 4.3 Add `links { url label }` to the `getEventBySlug` selection set in
        `apps/web/src/features/events/queries.graphql`, alongside the existing
        `contactInfo` field
  - [x] 4.4 Regenerate frontend codegen (repo's web `codegen` script) →
        `apps/web/src/generated/graphql.ts`; do not hand-edit generated output
  - [x] 4.5 Confirm no new entry is needed in the `Event: {...}` resolver map in
        `apps/backend/src/schema/resolvers.ts` (verified: `buildOptimizedDrizzleSelect`
        passthrough is sufficient, same as `contactInfo` today)
- [x] Task 5: Frontend display (AC: #5, #6)
  - [x] 5.1 Add `links?: EventLink[] | null` to `EventDetailViewProps` in
        `EventDetailView.types.ts` (import `EventLink` from `@festgrid/shared-types`)
  - [x] 5.2 Add `links: event.links` to the object mapped in
        `apps/web/src/features/events/mapper.ts`, alongside the existing `contactInfo:
        event.contactInfo`
  - [x] 5.3 Add the links row(s) JSX to `EventDetailView.tsx`: import a `Link` icon from
        `lucide-react` (add to the existing import list at line 2 — confirmed safe, this
        file has no `next/link` import to collide with, since `packages/ui` is
        framework-agnostic); render one `<a>` row per entry per AC5, gated on `links &&
        links.length > 0`, positioned directly after the existing Contact Info section
  - [x] 5.4 Extend `EventDetailView.test.tsx` (0 links → section absent; 1 link with label;
        1 link without label falls back to rendering the raw url as text; N links → N
        distinct `<a>` rows; each row has `target="_blank"` and `rel="noopener noreferrer"`)
        and `mapper.test.ts` (links passthrough)
- [x] Task 6: Full-suite verification (AC: #1-#5)
  - [x] 6.1 Run domain, backend, web, ui package test suites; confirm no regression
  - [x] 6.2 Run lint + typecheck for every touched package (domain, shared-types, database,
        backend, web, ui)
  - [x] 6.3 Apply the new migration against local Postgres and confirm it runs cleanly

## Dev Notes

- This story re-threads an already-proven, fully-built vertical slice pattern
  (`contactInfo`'s DB → domain → GraphQL → frontend round trip) for a new field — it
  deliberately mirrors that pattern file-by-file rather than inventing a new mechanism.
- `links` is an **array of objects**, so its DB column, AJV schema, and Gemini-native
  schema must mirror the `locationDetails`/`proposedData`/`schedules` nested-array
  precedents in this codebase, not `contactInfo`'s flat-string precedent — do not
  accidentally copy the flat-string pattern for any of the three schema declarations.
- Confirmed via `packages/graphql-select/optimized-select.ts` (the actual
  `buildOptimizedDrizzleSelect` implementation, 50 lines): it matches GraphQL field names
  directly against Drizzle table column *keys* (`getTableColumns(table)` + a
  `fieldsByTypeName` walk) — a column named `links` in the Drizzle schema paired with a
  GraphQL field named `links` requires no other wiring. This was independently verified,
  not assumed.

### Architecture & UX Gate Findings

- **Gate 1 — Architecture/Infrastructure Completeness (Winston):** No gap found. The
  draft scope was checked against every Gate 1 trigger heuristic (DB/domain called
  directly from frontend, external service called directly from frontend, new unbacked
  API surface, auth/business-rules in frontend, undeployed infra dependency) and cleared
  all five — the story purely re-threads the existing `contactInfo` full-stack pattern,
  confirmed line-by-line against the real resolver/passthrough code.
- **Gate 2 — UI Complexity & Reusability (Freya, fallback lens):** No gap found for the
  reuse/complexity question — a single icon+text(+N-item) row inline in an existing
  component, structurally identical in complexity to the already-shipped `contactInfo`
  row it mirrors, does not warrant its own component/story. **However:** a thorough
  search of `design-artifacts/UX-festgrid-run-1/DESIGN.md` and `EXPERIENCE.md` found
  **zero coverage** of the Contact Info row, a links row, or any event-detail
  metadata-row pattern — this row (and its multi-link layout: one row per link vs. one
  combined row) is undocumented in the authoritative UX spec. Two genuine design
  tradeoffs were surfaced to the user via `AskUserQuestion` rather than silently
  decided, through the ritual-orchestrator's mailbox relay (this session's own direct
  `AskUserQuestion` calls hit a repeated "Stream closed" tool error, so both were
  answered through the relay instead — confirmed against the primary record, not
  assumed):
  - **"Correct Data" dialog scope** — answered **"Display-only now (Recommended)"**:
    matches IDEA-012's stated scope exactly and the `organizerName`/`contactInfo`
    precedent (display-only first, correction support added later as its own
    follow-on story once a real correction-quality gap shows up). This story's scope
    is therefore extraction + storage + GraphQL + read-only display only; manual
    link add/edit via "Correct Data" is deferred to **IDEA-036** (see Out of Scope).
  - **Multi-link layout** — answered **"One row per link (Recommended)"**: each link
    gets its own clickable row, matching the page's existing one-icon-per-row rhythm
    and scaling cleanly to any N, over a single combined/comma-separated row (AC5).
- **Gate 3 — Foundational/Cross-Cutting Dependency Completeness (Winston):** No gap
  found. Checked against all six trigger heuristics (global app shell, i18n foundation,
  analytics foundation, GraphQL scaffold/codegen, a named reusable utility needing a
  home, any project-context/architecture-spine dependency absent from `epics.md`) — this
  story is a pure consumer of five already-established foundations (GraphQL+codegen
  Story 0.8, AJV validation Story 0.11, AI Gateway/Gemini adapter Story 0.13, Drizzle+jsonb
  pattern Story 0.4, i18n Story 0.6, `buildOptimizedDrizzleSelect` also Story 0.8), adding
  one column/field/row through existing mechanisms with no new foundational tooling.
- No `epic-0-readiness.md` sweep citation applies — that report is scoped only to
  Stories 0.1–0.19, predating this class of ad-hoc backlog-sourced hardening/feature
  story (the same gap already noted by Story 0.36's own Dev Notes). All three gates were
  therefore run fresh via subagent dispatch, matching the 0.34/0.35/0.36 precedent, not
  skipped.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** New field, no pre-existing mismatch to fix. `links:
  {url: string; label?: string}[]` must be introduced **consistently** across: the AJV
  extraction-validation schema, the Gemini-native response schema, the domain TS
  interfaces (`GeminiExtractionPayload`, `ExtractedEventMessage`, `EventInsertValues` —
  deliberately **not** `ProposedEventCorrection`/`ProposedScheduleCorrection`, which are
  out of scope), the new `EventLink` shared-types interface, the Drizzle jsonb column,
  the GraphQL `EventLink` type + `Event.links` field, both sides' codegen output, and
  `EventDetailViewProps`.
- **Impacted fields/contracts:** `events.links` (new nullable jsonb column), GraphQL
  `Event.links` field + new `EventLink` type, `GeminiExtractionPayload.links` /
  `ExtractedEventMessage.links` / `EventInsertValues.links`, `EventDetailViewProps.links`.
- **Required DB migration changes:** one drizzle-kit-generated migration adding a
  nullable `links jsonb` column to `events`; no backfill needed (nullable, no existing
  rows carry this data); no partial-index `WHERE`-clause hand-edit expected (unlike
  AD-8's soft-delete indexes) since this is a plain column add — still review the
  generated SQL before committing rather than assuming.
- **Required TypeScript type changes:** enumerated in Task 1/2/3/5 above.
- **Backward compatibility and rollout notes:** purely additive and nullable at every
  layer (DB column, GraphQL field, TS properties) — no breaking change to any existing
  consumer. Existing events simply read `links: null`/absent until reprocessed; this
  story does not retroactively reprocess historical posts.
- **Verification checks:** `sanitize-event-links.test.ts` at 100% coverage;
  `build-event-insert-values.test.ts` and `transform-gemini-response-to-event-info.test.ts`
  extended for the new field; a real migration run against local Postgres; backend and
  frontend typecheck clean after codegen regeneration (no manual edits to generated
  files); `EventDetailView.test.tsx` covering 0/1(labeled)/1(unlabeled)/N-link rendering.

### Project Structure Notes

- Every touched file stays within its existing established layer/package — no new
  package boundary is crossed and no new top-level directory is introduced:
  `packages/domain/src/events/`, `packages/shared-types/src/`, `packages/database/`,
  `apps/backend/src/{schema,validation,lib/ai-processor}/`,
  `apps/web/src/features/events/`, `packages/ui/src/features/events/`.
- New file: `packages/domain/src/events/sanitize-event-links.ts` (+ colocated
  `sanitize-event-links.test.ts`), following this directory's existing
  one-pure-function-per-file convention (`build-event-insert-values.ts`,
  `transform-gemini-response-to-event-info.ts`,
  `matches-childrens-data-keyword-filter.ts`).
- No conflicts detected against the unified project structure.

### References

- [Source: _bmad-output/implementation-artifacts/backlog.yaml#IDEA-012]
- [Source: apps/backend/src/validation/extracted-event.schema.ts]
- [Source: apps/backend/src/lib/ai-processor/build-gemini-request.ts]
- [Source: packages/domain/src/events/types.ts]
- [Source: packages/domain/src/events/build-event-insert-values.ts]
- [Source: packages/domain/src/events/transform-gemini-response-to-event-info.ts]
- [Source: packages/database/schema.ts#events]
- [Source: apps/backend/src/schema/events.graphql]
- [Source: packages/graphql-select/optimized-select.ts]
- [Source: packages/ui/src/features/events/EventDetailView.tsx]
- [Source: packages/ui/src/features/events/EventDetailView.types.ts]
- [Source: apps/web/src/features/events/mapper.ts]
- [Source: apps/web/src/features/events/queries.graphql]
- [Source: apps/web/locales/en.json — EventDetailsPage / EventCorrectionForm namespaces]
- [Source: _bmad-output/project-context.md#Code-Organization, #Data-Schemas,
  #Locale-Sensitive-Data-Rendering]
- [Source: _bmad-output/planning-artifacts/story-split-gate.md]
- [Source: _bmad-output/implementation-artifacts/0-36-harden-past-events-visibility-mechanism.md
  — standalone Epic 0 backlog-sourced-story precedent]

### Backlog row history (IDEA-012, verbatim, moved from backlog.yaml 2026-09-18)

Reported by user via `bmad-help`. Two parts: (1) extend the AI extraction schema/prompt to
also return a `links: {url: string; label?: string}[]` field, threading it through
storage/GraphQL alongside the existing `contactInfo` field; (2) render it in
`EventDetailView.tsx` as a new "links" row styled identically to the existing Contact Info row
— and, per the user's requirement, both rows should only render when their field is
non-empty, matching `contactInfo`'s existing conditional pattern.

**PROMOTED 2026-09-16 via bmad-create-story (row id named directly):** this story (0.37)
covers extraction + storage + GraphQL + read-only display in full, mirroring the `contactInfo`
pattern end-to-end (jsonb column, not `text()` — links is an array of objects) with zero new
GraphQL resolver code (`buildOptimizedDrizzleSelect` passthrough). Manual link editing via the
"Correct Data" dialog was intentionally left uncovered — carved into child row IDEA-036.

**VERIFIED 2026-09-17 (ritual-orchestrator batch, pre-dispatch check):**
`event-pages-remaining-backlog-plan.md`'s Cluster A checkbox for this row was still unchecked
and a `bmad-create-story` dispatch was about to be run against it; caught before dispatch —
this story already `review` in sprint-status.yaml. No new dispatch run. Plan doc checkbox
corrected.

## Global Rules References

- [x] `_bmad-output/project-context.md` — Code Organization (domain/ui package
      boundaries), Data Schemas (DB/GraphQL/TS alignment), Locale-Sensitive Data
      Rendering (confirmed not applicable here — no new locale strings, AC6)
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — this story follows
      its canonical section order and status vocabulary
- [x] Architecture spine
      (`_bmad-output/planning-artifacts/festgrid-architecture-spine.md`) — no AD entry
      directly governs a `links` field; this story's jsonb-column and
      resolver-passthrough choices are consistent with the AD-8/AD-16/AD-17 patterns
      already established there
- [x] Infrastructure docs (`docs/infrastructure/index.md`) — no SQS/EventBridge/API
      Gateway/Lambda-provisioning change; a schema+GraphQL+frontend-only story needs only
      the index summary, no shard file read required

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - New: `packages/domain/src/events/sanitize-event-links.ts`,
    `packages/domain/src/events/sanitize-event-links.test.ts`,
    `packages/database/migrations/NNNN_<generated-name>.sql` (+ snapshot + journal entry)
  - Update: `apps/backend/src/lib/ai-processor/build-gemini-request.ts`,
    `apps/backend/src/validation/extracted-event.schema.ts`,
    `packages/shared-types/src/index.ts`,
    `packages/domain/src/events/types.ts`,
    `packages/domain/src/events/transform-gemini-response-to-event-info.ts`,
    `packages/domain/src/events/build-event-insert-values.ts`,
    `packages/database/schema.ts`,
    `apps/backend/src/schema/events.graphql`,
    `apps/backend/src/generated/resolvers-types.ts` (regenerated, not hand-edited),
    `apps/web/src/features/events/queries.graphql`,
    `apps/web/src/generated/graphql.ts` (regenerated, not hand-edited),
    `apps/web/src/features/events/mapper.ts`,
    `packages/ui/src/features/events/EventDetailView.types.ts`,
    `packages/ui/src/features/events/EventDetailView.tsx`,
    `packages/ui/src/features/events/EventDetailView.test.tsx`,
    `apps/web/src/features/events/mapper.test.ts`,
    `packages/domain/src/events/build-event-insert-values.test.ts`,
    `packages/domain/src/events/transform-gemini-response-to-event-info.test.ts`
- **Rule Mapping:**
  - `sanitize-event-links.ts` as a pure, dependency-free function in `packages/domain` →
    project-context.md's Code Organization rule (pure business logic in
    `packages/domain`, no React/DB/Node coupling) + Testing Rules (100% unit coverage
    requirement for `packages/domain` exports).
  - `links` as `jsonb(...).$type<EventLink[]>()`, not a re-declared ad hoc shape →
    project-context.md's Data Schemas rule (Drizzle schema + TS interfaces as single
    source of truth) and the existing `locationDetails`/`proposedData` precedent.
  - Zero new GraphQL resolver code → project-context.md's Optimized DB Queries rule
    (reuse `buildOptimizedDrizzleSelect` rather than a bespoke field resolver).
  - No new locale keys → project-context.md's Locale-Sensitive Data Rendering rule,
    satisfied by confirming this row needs no user-facing label text (AC6).
  - AJV validation with `additionalProperties: false` extended for `links` →
    project-context.md's Runtime Schema Validation rule (all externally-sourced data
    validated at the point of entry).
- **Verification Plan:**
  - `sanitize-event-links.test.ts` (100% coverage: protocol filtering, label
    trimming/absence, 10-item cap, undefined-vs-empty behavior).
  - Extended `build-event-insert-values.test.ts` and
    `transform-gemini-response-to-event-info.test.ts` covering `links` threading.
  - `pnpm --filter @festgrid/database generate` + a real local-Postgres migration run.
  - Backend + frontend `codegen` regeneration with a clean typecheck afterward (no
    manual edits to generated files).
  - Extended `EventDetailView.test.tsx` (0/1-labeled/1-unlabeled/N-link render cases,
    each verifying `<a href>`/`target`/`rel` attributes) and `mapper.test.ts`.
  - Full lint + typecheck pass across every touched package.

## Pre-Coding Approval Gate

- [x] Scope confirmation — read-only extraction + storage + GraphQL + display only;
      "Correct Data" manual editing of links explicitly deferred to IDEA-036 (see Out of
      Scope). Confirmed via `AskUserQuestion` through the ritual-orchestrator mailbox
      relay: **"Display-only now (Recommended)."**
- [x] Architecture and boundary confirmation — Gate 1/2/3 all returned "No gap found"
      (see Architecture & UX Gate Findings); no prerequisite story required.
- [x] Testing plan confirmation — unit (`packages/domain`, 100% coverage requirement),
      integration, and component test scope agreed per Testing Requirements below.
- [x] Explicit human approval state — **approved.** Both genuine design tradeoffs
      (correction-dialog scope, multi-link layout) confirmed via `AskUserQuestion`
      through the ritual-orchestrator mailbox relay (2026-09-16).
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted — N/A, all three gates
      returned "No gap found."
- [x] Multi-link layout confirmed via `AskUserQuestion`: **"One row per link
      (Recommended)"** (see Architecture & UX Gate Findings).

## Testing Requirements

- [x] Unit tests: `sanitize-event-links.ts` at 100% coverage (packages/domain rule)
- [x] Integration tests: `build-event-insert-values.test.ts`,
      `transform-gemini-response-to-event-info.test.ts` extended for `links`
- [x] Component tests: `EventDetailView.test.tsx` (0/1-labeled/1-unlabeled/N-link cases),
      `mapper.test.ts` (links passthrough)
- [x] E2E tests: none new required — this is not a new critical user flow per the
      project's "testing trophy"/Playwright-for-critical-flows-only philosophy; no
      existing event-detail-page E2E spec exercises this specific row, and none needed
      modification since `links` is purely additive.

## Deliverables Checklist

- [x] Gemini extraction response schema + prompt instruction updated for `links`
- [x] AJV `extractedEventSchema` updated for `links`
- [x] `EventLink` interface added to `packages/shared-types`
- [x] `sanitize-event-links.ts` implemented with 100%-covered unit tests
- [x] `GeminiExtractionPayload` / `ExtractedEventMessage` / `EventInsertValues` threaded
      with `links`
- [x] `events.links` jsonb column + migration committed
- [x] `EventLink` GraphQL type + `Event.links` field added; codegen regenerated both sides
- [x] `EventDetailViewProps.links` added; `mapper.ts` threaded
- [x] `EventDetailView.tsx` renders one row per link, correctly gated, no new locale keys
- [x] All new/extended tests passing; lint and typecheck clean across touched packages

## Out of Scope

- Manual link add/edit via the "Correct Data" dialog (`CorrectionForm.tsx`,
  `correction-dialog.tsx`) and threading `links` through `ProposedEventCorrection`,
  `corrections.graphql`, and `proposed-event-correction.schema.ts` (both backend AJV and
  frontend Zod) — deferred to **IDEA-036** (new backlog.yaml child row of IDEA-012,
  added by this story).
- Adding `links` to the legacy, confirmed-unused `EventInfo` interface in
  `packages/shared-types/src/index.ts` (zero runtime references found outside its own
  declaration).
- Retroactively reprocessing already-extracted historical posts to backfill `links` for
  existing events.
- Any analytics/click-tracking event for outbound link clicks — not requested by the
  backlog item; noted only as a possible future enhancement, not built here.

## Definition of Done

- [x] AC1–AC7 satisfied
- [x] Required unit/integration/component tests passing;
      `sanitize-event-links.ts` at 100% coverage
- [x] Lint and type checks passing for every touched package (domain, shared-types,
      database, backend, web, ui)
- [x] New migration applied cleanly against local Postgres
- [x] Codegen regenerated on both backend and frontend with no manual edits to generated
      output

## Completion Status

- [x] Complete — ready for review

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- `pnpm --filter @festgrid/domain test -- --run --coverage --coverage-include='src/events/sanitize-event-links.ts'` → 100% coverage confirmed for the new file (protocol allowlist, label trim, 10-item cap, undefined-vs-empty-array behavior all exercised).
- `pnpm --filter @festgrid/domain test` → full suite passing, including extended `build-event-insert-values.test.ts` and `transform-gemini-response-to-event-info.test.ts`.
- `pnpm --filter backend test` → all passing except the 2 pre-existing, unrelated failures already documented in Story 0.36's Dev Agent Record (`trigger-brightdata-for-target.test.ts`'s `returns CAPACITY_EXHAUSTED when capacity unavailable` and `trigger-brightdata-for-target` — a live network call to Bright Data getting 403 against this sandbox's fake credentials, not a defect; confirmed via `git log` that neither file has been touched by this story).
- `pnpm --filter web test` → full suite passing, including new `mapper.test.ts` links-passthrough cases.
- `pnpm --filter ui test` → full suite passing, including extended `EventDetailView.test.tsx` (0/1-labeled/1-unlabeled/N-link render cases).
- `pnpm lint` (repo root) → 6/6 tasks clean, zero errors.
- `pnpm build` (repo root) → first attempt failed on `web#build` with the same transient `SELF_SIGNED_CERT_IN_CHAIN` Google-Fonts-fetch error already documented in Stories 0.35/0.36's Dev Agent Records. Root-caused this occurrence one step further: `next/font`'s fetch (via `undici`) does not pick up this sandbox's proxy CA trust from `NODE_USE_ENV_PROXY=1` alone — confirmed via a direct `curl`/Node `https.get` test to `fonts.googleapis.com` (both succeeded, proving general network/proxy connectivity was fine) versus the Next.js build's own `undici`-based fetch (still failing) — adding `NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt` for the verification run made `pnpm build` pass cleanly (7/7 tasks). This is a **sandbox-local diagnostic step only**, not a code change: that path is specific to this sandbox's proxy CA bundle and would break other environments if hard-coded into the committed `apps/web/package.json` build script, so it was intentionally **not** added there — Story 0.36's existing `NODE_USE_ENV_PROXY=1` fix is left as the portable, committed mitigation, and this occurrence's extra flakiness is recorded here for whoever investigates this flake next.
- Migration `0058_nice_liz_osborn.sql` (`ALTER TABLE "events" ADD COLUMN "links" jsonb;`) applied cleanly against the local `festgrid_test` database via `pnpm --filter @festgrid/database migrate`; confirmed via `\d events` that the `links` column exists post-migration.
- This story's implementation was produced correctly across a session-limit interruption and a subsequent Monitor-timeout interruption in the ritual-orchestrator sandbox's dispatch tooling (both are known, previously-documented tooling issues in this batch — see Story 0.36's Dev Agent Record and the batch state file for the fuller pattern) — the second interruption killed the dev-story session specifically during this Dev Agent Record write-up, after all of Task 6's verification had already completed successfully within that same dispatch (lint, build, and the full domain/backend/web/ui test suites all passed before the kill). The ritual-orchestrator session completing this batch re-ran every one of those checks itself from a clean state (see entries above) before filling in this Dev Agent Record and committing. No implementation code was written by the orchestrator session for this recovery step — only this story file's documentation, and the commit.

### Completion Notes List

- Implemented AC1: `geminiExtractionResponseSchema` and the system-instruction prompt in `build-gemini-request.ts` now request a `links: {url, label?}[]` array (new instruction "6b", after the existing contactInfo instructions); `extractedEventSchema` in `extracted-event.schema.ts` declares a matching nullable, `additionalProperties: false`, `maxItems: 10` array-of-objects schema mirroring `geminiScheduleSchema`'s nested pattern (not `contactInfo`'s flat-string pattern). New `EventLink` interface added to `packages/shared-types/src/index.ts`; `GeminiExtractionPayload.links?: EventLink[]` added to `packages/domain/src/events/types.ts`.
- Implemented AC2: new `sanitizeEventLinks` in `packages/domain/src/events/sanitize-event-links.ts` drops non-`http:`/`https:` URLs, trims/blanks-out whitespace-only labels, caps at the first 10 valid entries, and returns `undefined` (not `[]`) when nothing valid remains — with 100%-covered unit tests. Wired into `transform-gemini-response-to-event-info.ts` as its own step alongside the existing `contactInfo` discard-at-classification logic.
- Implemented AC3: `EventInsertValues.links` set to `message.links ?? null` in `build-event-insert-values.ts`; new nullable `events.links jsonb` column (`links: jsonb('links').$type<EventLink[]>()`) added to `packages/database/schema.ts`, matching the `locationDetails`/`proposedData` typed-jsonb precedent (not `contactInfo`'s flat `text()` column, since `links` is an array of objects). Migration `0058_nice_liz_osborn.sql` generated via `drizzle-kit generate` (a plain column add — no hand-edit needed, unlike AD-8's partial-index precedent) and applied locally.
- Implemented AC4: `apps/backend/src/schema/events.graphql` gains `type EventLink { url: String! label: String }` and `Event.links: [EventLink!]`; both backend (`resolvers-types.ts`) and frontend (`graphql.ts`) codegen regenerated (not hand-edited); `apps/web/src/features/events/queries.graphql`'s `getEventBySlug` selection set extended with `links { url label }`. Zero new resolver code — confirmed `buildOptimizedDrizzleSelect`'s column-key-to-GraphQL-field-name passthrough is sufficient, same mechanism already serving `contactInfo`.
- Implemented AC5/AC6: `EventDetailViewProps.links?: EventLink[] | null` added; `apps/web/src/features/events/mapper.ts` threads `event.links` through (mapping a `null` label to `undefined` per the prop's shape); `EventDetailView.tsx` renders one clickable `<a target="_blank" rel="noopener noreferrer">` row per link (icon + `label || url` text + trailing `ExternalLink` icon), gated on `links && links.length > 0` with no empty-state placeholder, positioned directly after the existing Contact Info section. No new locale strings added (per AC6's explicit non-requirement).
- AC7 (no "Correct Data" dialog wiring): confirmed by scope — `CorrectionForm.tsx`, `correction-dialog.tsx`, `ProposedEventCorrection`, `corrections.graphql`, and `proposed-event-correction.schema.ts` (both backend AJV and frontend Zod) were not touched. New backlog child row `IDEA-036` added tracking this as deferred future work.
- Both genuine design tradeoffs flagged during story drafting (correction-dialog scope, multi-link layout) were confirmed by the user via `AskUserQuestion` through the ritual-orchestrator mailbox relay before implementation began — see the story's own Architecture & UX Gate Findings section for the full record and the exact answers.

### File List

- `apps/backend/src/lib/ai-processor/build-gemini-request.ts` (modified) — `links` added to the Gemini-native response schema + a new prompt instruction
- `apps/backend/src/validation/extracted-event.schema.ts` (modified) — matching AJV `links` schema
- `packages/shared-types/src/index.ts` (modified) — new `EventLink` interface
- `packages/domain/src/events/types.ts` (modified) — `links` added to `GeminiExtractionPayload`, `ExtractedEventMessage`, `EventInsertValues`
- `packages/domain/src/events/sanitize-event-links.ts` (new) — link sanitization/validation
- `packages/domain/src/events/sanitize-event-links.test.ts` (new) — 100%-covered unit tests
- `packages/domain/src/events/transform-gemini-response-to-event-info.ts` (modified) — wires `sanitizeEventLinks`
- `packages/domain/src/events/transform-gemini-response-to-event-info.test.ts` (modified) — extended coverage
- `packages/domain/src/events/build-event-insert-values.ts` (modified) — `links` threaded into insert values
- `packages/domain/src/events/build-event-insert-values.test.ts` (modified) — extended coverage
- `packages/domain/src/events/index.ts` (modified) — no functional change beyond what's already exported (verified during recovery — this file's diff is limited to what the barrel already needed)
- `packages/database/schema.ts` (modified) — new `events.links` jsonb column
- `packages/database/migrations/0058_nice_liz_osborn.sql` (new) — the migration
- `packages/database/migrations/meta/0058_snapshot.json` (new, generated)
- `packages/database/migrations/meta/_journal.json` (modified, generated)
- `apps/backend/src/schema/events.graphql` (modified) — new `EventLink` type + `Event.links` field
- `apps/backend/src/generated/resolvers-types.ts` (modified, regenerated)
- `apps/web/src/features/events/queries.graphql` (modified) — `links { url label }` added to `getEventBySlug`
- `apps/web/src/generated/graphql.ts` (modified, regenerated)
- `apps/web/src/features/events/mapper.ts` (modified) — `links` threaded through
- `apps/web/src/features/events/mapper.test.ts` (modified) — links-passthrough coverage
- `packages/ui/src/features/events/EventDetailView.types.ts` (modified) — `links` prop added
- `packages/ui/src/features/events/EventDetailView.tsx` (modified) — renders the links section
- `packages/ui/src/features/events/EventDetailView.test.tsx` (modified) — 0/1-labeled/1-unlabeled/N-link cases
- `_bmad-output/implementation-artifacts/0-37-extract-and-display-event-links.md` (modified) — this story file
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified) — status `ready-for-dev` → `in-progress` → `review`

## Change Log

- 2026-09-16: Implemented AC1-AC7 (Gemini extraction schema/prompt, domain sanitization, storage via a new jsonb column + migration, GraphQL type/field with zero new resolver code, read-only frontend display as one row per link). Verified `pnpm --filter domain/backend/web/ui test` (only 2 pre-existing unrelated failures, see Debug Log References), `pnpm lint` (0 errors), `pnpm build` (7/7, after a sandbox-local-only `NODE_EXTRA_CA_CERTS` diagnostic step for a transient font-fetch TLS flake — no code change) all green; status moved `ready-for-dev` → `review`.

### File List
