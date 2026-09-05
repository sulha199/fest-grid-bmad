---
baseline_commit: 4255f0df9c29b1fbd06867954801d351664a2c8d
---

# Story 3.6i: Classify-and-discard private contact info during AI extraction

## Story Details

- Epic: 3
- Story ID: 3.6i
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a subscriber,
I want the app to never store a private individual's raw contact detail,
so that FestDaily doesn't become a searchable directory of personal phone numbers/emails scraped from social posts.

## Acceptance Criteria

1. **Given** the AI extraction pipeline (Story 3.6) classifies a source post's contact information, **when** the contact is a business/official contact (a role-based email, an official venue/PT office number), **then** it is extracted and written to `EventInfo.contactInfo` as today. [epics.md AC1]
2. **Given** the contact is a private/individual contact (a personal phone number, personal email, or a `wa.me/<number>` link — treated identically to a raw phone number, never link-minimized), **when** extraction runs, **then** `EventInfo.hasPrivateContact` is set `true`, `contactInfo` is left `null`, and the raw contact value is discarded immediately after classification — never written to any column, never logged, never held beyond the classification step itself. [epics.md AC2]
3. **And** the event-detail UI, when `hasPrivateContact` is `true`, displays a message directing the user to the original source post for the contact detail (linking `Post.originalPostUrl`) rather than showing a stored value. **Scope clarification (confirmed via Gate 2/Freya during this story's creation):** `EventDetailView.tsx` currently renders `contactInfo` nowhere at all — not even the plain business-contact case (confirmed by direct code read; the frontend's `getEventBySlug` query already fetches `contactInfo` but `mapper.ts` silently drops it before it reaches props). AC3's fallback message is a *substitution* for a normal contact display that doesn't exist yet, so this story also builds the normal business-`contactInfo` display alongside the fallback — without it, AC3 would be unverifiable in isolation (there would be nothing for the fallback to visibly stand in for). See Dev Notes → Architecture & UX Gate Findings. [epics.md AC3, scope extended]
4. **And** this classification is verified with unit tests covering: business email, official venue phone, personal phone number, personal email, `wa.me` link, and a post with no contact info at all (`hasPrivateContact` stays `false`, `contactInfo` stays `null`). **Scope clarification:** the actual business-vs-private *classification* is Gemini's job (a live LLM call) and is not deterministically unit-testable in CI. These 6 cases instead unit-test the pipeline's deterministic handling of each classification *outcome* — synthetic `GeminiExtractionPayload` fixtures representing what Gemini would output for each category — proving the discard/pass-through logic is correct once a classification is made, not proving Gemini classifies correctly (that is a prompt-engineering/manual-eval concern, matching the same testability boundary Story 3.6j draws for its own "verify the live prompt" AC). [epics.md AC4, scope clarified]
5. **(New, confirmed via `AskUserQuestion` during this story's creation — not in epics.md's original AC text):** the same discard-at-classification enforcement (AC2) also applies to the AI-assisted correction preview path (Story 4.2a's `extractEventDataFromUrl` mutation → `mapExtractionPayloadToProposedCorrection`). This path reuses the exact same Gemini prompt/schema this story modifies, and its output can be submitted, unmodified, into `submitCorrection`'s apply step, which writes `proposedData.contactInfo` directly to `events.contactInfo` (`resolvers.ts` ~L1310) with no privacy filtering today. Without this AC, adding `hasPrivateContact` to the shared schema would leave a second, un-gated door for a raw private contact to reach permanent storage — undermining AC2's "never written to any column" guarantee. See Dev Notes → Scope Extension Decision.

## Tasks / Subtasks

- [x] **Task 1 (AC1, AC2) — Extend the Gemini extraction prompt and structured-output schema for contact classification:**
  - [x] In `apps/backend/src/lib/ai-processor/build-gemini-request.ts`'s `systemInstruction`, add explicit classification guidance after the existing "Extract the top-level location, organizerName, contactInfo, and description if present" instruction: contact information is business/official (a role-based email, an official venue/PT office phone number) → populate `contactInfo` as today; contact information is private/individual (a personal phone number, a personal email address, or a `wa.me/<number>` WhatsApp link — a `wa.me` link must be treated identically to a raw phone number, never minimized to a generic "link" description) → set `hasPrivateContact` to `true` and leave `contactInfo` absent/empty for that value. If no contact information is present at all, leave both fields absent (existing behavior, unchanged).
  - [x] Add `hasPrivateContact: { type: 'BOOLEAN' }` to `geminiExtractionResponseSchema`'s `properties` (not added to the top-level `required` array — absent/`false` means "no private contact detected," matching the existing optional treatment of `contactInfo`/`organizerName`/`description` in this same schema).
  - [x] Update `build-gemini-request.test.ts`: add an assertion that `result.request.systemInstruction` includes the new classification guidance (e.g. `.includes('wa.me')` or `.includes('hasPrivateContact')`), mirroring the existing `assert.ok(result.request.systemInstruction?.includes('PERFORMANCE'))` structural check.

- [x] **Task 2 (AC1, AC2) — Extend the pipeline's TypeScript types and AJV validation schema:**
  - [x] In `packages/domain/src/events/types.ts`, add `hasPrivateContact?: boolean` to `GeminiExtractionPayload`, `ExtractedEventMessage`, and `EventInsertValues` — mirrors exactly how `contactInfo?: string` already exists on all three interfaces.
  - [x] In `apps/backend/src/validation/extracted-event.schema.ts`, add `hasPrivateContact: { type: 'boolean', nullable: true }` to `extractedEventSchema`'s `properties` (not added to `required`) — this is the same AJV schema compiled as `validateExtractedEvent` in `resolvers.ts` (used by Story 4.2a's `extractEventDataFromUrl` mutation, Task 7 below) and as the validator inside `processAiJob` (`process-ai-job.ts`), so this one change covers both entry points.

- [x] **Task 3 (AC2) — Enforce the discard at the domain transform layer (defense-in-depth, not solely prompt-level):**
  - [x] In `packages/domain/src/events/transform-gemini-response-to-event-info.ts`'s `transformGeminiResponseToEventInfo`, when `payload.hasPrivateContact === true`, set the returned `contactInfo` to `undefined` **regardless of what `payload.contactInfo` holds** (do not trust the prompt/schema separation alone — if Gemini's response ever populates both fields against instructions, the code must still discard the raw value) and set `hasPrivateContact: true`. Otherwise, pass `contactInfo: payload.contactInfo` through unchanged (today's behavior) and set `hasPrivateContact: payload.hasPrivateContact` (passes through `false`/`undefined`).
  - [x] Update `transform-gemini-response-to-event-info.test.ts`: add cases proving (a) a business-contact payload (`hasPrivateContact: false`, `contactInfo` populated) passes `contactInfo` through unchanged; (b) a payload with `hasPrivateContact: true` **and** a populated `contactInfo` (simulating an imperfect Gemini response) still discards it — `result.contactInfo` is `undefined`, `result.hasPrivateContact` is `true`; (c) a payload with neither field set leaves both `undefined`/falsy on the result.

- [x] **Task 4 (AC1, AC2) — Map `hasPrivateContact` into the DB insert-values builder:**
  - [x] In `packages/domain/src/events/build-event-insert-values.ts`, add `hasPrivateContact: message.hasPrivateContact ?? false` to the returned `event: EventInsertValues` object (same optional-with-explicit-default pattern already used for `confidenceScore`/`organizerName` in this function — `EventInsertValues.hasPrivateContact` is a plain `boolean`, not nullable, since the DB column below is `NOT NULL DEFAULT false`).
  - [x] Update `build-event-insert-values.test.ts`: add an assertion for `event.hasPrivateContact` in both the `hasPrivateContact: true` and omitted-field cases.

- [x] **Task 5 (AC1, AC2) — Database schema and migration:**
  - [x] In `packages/database/schema.ts`, add `hasPrivateContact: boolean('has_private_contact').default(false).notNull()` to the `events` pgTable, immediately after the existing `contactInfo: text('contact_info')` field — mirrors Story 3.6g's `isImageStorageOptedIn` boolean-default-false-`notNull` column exactly.
  - [x] Run `pnpm --filter database run generate` (Drizzle-kit) to produce the next sequential migration file (`0044_*.sql`, following `0043_faulty_electro.sql`) per project-context.md's generated-migrations-only rule (AD-3). Commit the generated `.sql` file and its `meta/0044_snapshot.json` — do not hand-write the migration.

- [x] **Task 6 (AC1, AC2, AC3) — Expose `hasPrivateContact` on the `Event` GraphQL type:**
  - [x] In `apps/backend/src/schema/events.graphql`, add `hasPrivateContact: Boolean!` to `type Event`, alongside the existing `contactInfo: String` field.
  - [x] No resolver code is required in `resolvers.ts`: `buildOptimizedDrizzleSelect(events, info)` (already the standing pattern at every `events`-querying resolver site — `eventBySlug`, `event`, the paginated `events` list, `restoreEvent`, `Report.event`) auto-derives the Drizzle column selection from whatever fields a GraphQL query requests against the `events` table schema, and GraphQL's default resolver reads the same-named field off the parent row object — exactly how `contactInfo`/`organizerName` already resolve today with zero explicit entries in the `Event: {}` resolver map (confirmed by direct code read; verified fresh by this story's Gate 1 check).
  - [x] Run codegen (`pnpm --filter backend codegen` / the project's standard codegen script) to regenerate `apps/backend/src/generated/resolvers-types.ts` with the new field.

- [x] **Task 7 (AC5) — Close the parallel leak in the AI-assisted correction preview path:**
  - [x] In `packages/domain/src/events/map-extraction-payload-to-proposed-correction.ts`'s `mapExtractionPayloadToProposedCorrection`, apply the exact same discard rule as Task 3: when `payload.hasPrivateContact === true`, return `contactInfo: undefined` regardless of `payload.contactInfo`; otherwise pass `contactInfo: payload.contactInfo` through unchanged (today's behavior).
  - [x] Update `map-extraction-payload-to-proposed-correction.test.ts`: add a case with `hasPrivateContact: true` and a populated `contactInfo` in the input payload, asserting `result.contactInfo` is `undefined`.
  - [x] **Deliberately out of scope (do not do this):** do NOT add `hasPrivateContact` to `ProposedEventCorrection` (`types.ts`), `proposedEventCorrectionSchema` (AJV), `ProposedEventCorrectionInput`/`ProposedEventCorrectionData` (`corrections.graphql`/`extraction.graphql`), or the `submitCorrection` apply-to-`events` write in `resolvers.ts`. The discard at the mapper is sufficient by itself: once the raw private value is dropped before `ProposedEventCorrectionData` is returned to the client, it can never appear in what `CorrectionForm` pre-fills or what a user submits back via `submitCorrection` (a user manually *typing* a new contact value into the form afterward is legitimate human-authored data, not an AI-classification leak, and is intentionally not touched by this story). Threading a new `hasPrivateContact` field through the correction-submission round-trip was considered and explicitly declined during this story's creation (see Dev Notes → Scope Extension Decision) as scope beyond what closing the leak requires.

- [x] **Task 8 (AC3) — Frontend: display business `contactInfo` and the private-contact fallback message:**
  - [x] `apps/web/src/features/events/queries.graphql`: add `hasPrivateContact` to the existing `getEventBySlug` query's `eventBySlug { ... }` selection, immediately after the already-present `contactInfo` field.
  - [x] `packages/ui/src/features/events/EventDetailView.types.ts`: add `contactInfo?: string | null` and `hasPrivateContact?: boolean | null` to `EventDetailViewProps`; add `privateContactMessageLabel: string` to `EventDetailViewLabels`.
  - [x] `packages/ui/src/features/events/EventDetailView.tsx`: destructure the two new props. Add a new `<section>` between the existing Description and Schedules sections (this is event-level information, not per-schedule, so it does not belong inside the schedule `<li>` loop): if `hasPrivateContact` is true, render an icon + `labels.privateContactMessageLabel` as a link to `originalPostUrl` (falling back to `sourcePostUrl` if `originalPostUrl` is absent — mirrors the existing Attributions section's own original-preferred-else-source fallback a few lines below); else if `contactInfo` is present, render an icon + the `contactInfo` text (same plain icon+text pattern already used for `ticketPrice`/`performers`). Render nothing when neither is present (today's behavior, unchanged). Import a `Phone` icon from `lucide-react` for the business-contact row (reuse the existing `Instagram`/`ExternalLink` icons already imported for the private-contact link, matching the Attributions section's link styling).
  - [x] Update `EventDetailView.test.tsx`: add cases for (a) `contactInfo` set, `hasPrivateContact` false/absent → renders the contact text; (b) `hasPrivateContact` true, `originalPostUrl` set → renders the fallback message as a link to `originalPostUrl`; (c) `hasPrivateContact` true, `originalPostUrl` absent, `sourcePostUrl` set → link falls back to `sourcePostUrl`; (d) both absent → section renders nothing.
  - [x] `apps/web/src/features/events/mapper.ts`: in `mapGraphQLEventToDetailViewProps`, add `contactInfo: event.contactInfo` and `hasPrivateContact: event.hasPrivateContact` to the returned object (today `event.contactInfo` is already fetched by the query but silently dropped here — confirmed by direct code read, a pre-existing gap unrelated to any new backend work in this story).
  - [x] `apps/web/src/features/events/mapper.ts`'s `useEventDetailViewLabels`: add `privateContactMessageLabel: t('privateContactMessageLabel')`.
  - [x] `apps/web/locales/en.json` and `apps/web/locales/id.json`: add a new `privateContactMessageLabel` key under the existing `EventDetailsPage` namespace. English: `"Contact info isn't shown to protect the poster's privacy — see the original post for details."` Indonesian: `"Info kontak tidak ditampilkan untuk melindungi privasi pemosting — lihat postingan asli untuk detailnya."` (the link itself is a separate `<a>` wrapping this text, matching how `viewOriginalPostLabel` is already a standalone link label elsewhere in this same component, not an interpolated sentence).

- [x] **Task 9 (AC4) — Unit test coverage for all 6 classification-outcome categories:**
  - [ ] In `transform-gemini-response-to-event-info.test.ts`, add 6 cases against synthetic `GeminiExtractionPayload` fixtures (per AC4's scope clarification — these test the deterministic discard/pass-through logic per classification outcome, not live Gemini accuracy): (1) business email (`hasPrivateContact: false`, `contactInfo: 'events@venue.com'`) → passes through; (2) official venue/PT phone (`hasPrivateContact: false`, `contactInfo: '(021) 555-0100'`) → passes through; (3) personal phone number (`hasPrivateContact: true`, `contactInfo: '0812-3456-7890'`) → `contactInfo` discarded (`undefined`), `hasPrivateContact: true`; (4) personal email (`hasPrivateContact: true`, `contactInfo: 'someone@gmail.com'`) → discarded; (5) `wa.me` link (`hasPrivateContact: true`, `contactInfo: 'https://wa.me/6281234567890'`) → discarded, same as a raw phone number; (6) no contact info at all (`hasPrivateContact` and `contactInfo` both omitted) → `result.hasPrivateContact` falsy, `result.contactInfo` `undefined`.

- [x] **Task 10 — Full verification:** `pnpm --filter @festgrid/domain test` (Tasks 3, 4, 7, 9); `pnpm --filter backend test` (Tasks 1, 2, 6); `pnpm --filter web test` and `pnpm --filter ui test` (Task 8); `pnpm --filter database run generate` output committed (Task 5); `pnpm build`, `pnpm lint`, `pnpm test` at the repo root — no regressions elsewhere that reads `EventInfo.contactInfo`, `ProposedEventCorrection.contactInfo`, or `Event.contactInfo`.

## Dev Notes

- **This story's core mechanism is a discard-at-classification pattern, applied at two independent call sites that both consume the same shared Gemini schema/prompt.** The async extraction pipeline (Story 3.6, `process-ai-job.ts` → `transformGeminiResponseToEventInfo`, Task 3) and the AI-assisted correction preview (Story 4.2a, `extractEventDataFromUrl` → `mapExtractionPayloadToProposedCorrection`, Task 7) each get their own independent enforcement — deliberately not a single shared helper function, since the two functions have different return shapes (`ExtractedEventMessage` vs. `ProposedEventCorrection`) and centralizing a two-line conditional into a new shared utility would be a premature abstraction for this little logic.
- **Why the discard is enforced in code, not left to the prompt alone (AC2):** the prompt/schema separation (Task 1) is Gemini's *instruction*, not a guarantee — a model response is not contractually bound to follow it. AC2's "never written to any column" is a hard privacy invariant, so Tasks 3/7 re-check `hasPrivateContact` and forcibly discard `contactInfo` in code regardless of what value Gemini's response actually populated, rather than trusting the prompt/schema split to always hold.
- **Why `wa.me` links are treated as raw phone numbers, not as URLs:** a `wa.me/<number>` link directly encodes a personal WhatsApp-reachable phone number in its path — minimizing it to "a link was present" instead of discarding it the same way a raw phone number is discarded would create a loophole where the exact same personal contact detail survives simply because it's link-shaped instead of digit-shaped. The prompt (Task 1) and this story's AC2 both state this explicitly to close that loophole.

### Scope Extension Decision

During this story's creation, tracing every consumer of the shared `GeminiExtractionPayload`/`extractedEventSchema` (the same schema Task 1/2 modify) surfaced a second live call site: `extractEventDataFromUrl` (Story 4.2a) → `mapExtractionPayloadToProposedCorrection` → `ProposedEventCorrectionData` returned to the client → (if the user submits, unmodified, via `submitCorrection`) → `resolvers.ts` ~L1310's `contactInfo: proposedData.contactInfo || null` direct write to `events.contactInfo`. This is not a regression introduced by this story (that write is already unfiltered today, before `hasPrivateContact` exists at all) — but leaving it unfixed after this story ships would mean the shared schema now *carries* a private-contact signal that this second consumer silently ignores, while a raw private value can still reach permanent storage through it. This was presented to the user via `AskUserQuestion`; the user confirmed **extending this story's scope** to close it (AC5, Task 7), reasoning it is mechanically small (the identical one-line discard rule, applied at a second call site already being read for this story) and directly adjacent to files this story already modifies. The user was **not** asked to approve, and this story deliberately does **not** build, any new `hasPrivateContact` bookkeeping in the correction-submission round-trip itself (`ProposedEventCorrection`/`corrections` schema/GraphQL input types) — see Task 7's explicit "deliberately out of scope" note for why that's unnecessary to close the leak.

### Architecture & UX Gate Findings

Epic 3's readiness sweep (`epic-readiness/epic-3-readiness.md`, `swept: true`, dated 2026-08-09) predates this story (added 2026-09-02 via `bmad-correct-course`, same batch as siblings 3.6g/3.6h/3.6j/3.6k) and its `stories_covered` list does not include 3.6i — so per `story-split-gate.md`'s epic-level-sweep-mode fallback, all three gates were re-run fresh via `runSubagent`, matching the precedent already set by Stories 3.6g/3.6h's own creation.

- **Gate 1 (Architecture/Infrastructure Completeness, Winston persona) — No gap found.** All planned changes reuse already-built layers end-to-end: Story 3.6's extraction pipeline and Story 0.13's AI Gateway adapter (Task 1), the existing AJV validation call sites in both `process-ai-job.ts` and `resolvers.ts`'s `extractEventDataFromUrl` (Task 2), Story 0.4's Drizzle migration system (Task 5), Story 0.8's `buildOptimizedDrizzleSelect`/GraphQL codegen pipeline (Task 6, confirmed zero new resolver code needed — verified directly against `resolvers.ts` that `contactInfo`/`organizerName` already resolve with no explicit map entry). No new DB/ORM call from `apps/web`, no direct third-party call from the frontend, no new resolver/mutation, no auth/business logic added to UI code, no unprovisioned infrastructure.
- **Gate 2 (UI Complexity & Reusability, Freya persona) — No gap found; also resolved the AC3 scope question.** Checked both `design-artifacts/UX-festgrid-run-1/DESIGN.md` and `design-artifacts/UX-wizard-page-run-1/DESIGN.md` for any contact-info-display spec — zero mentions in either; no authoritative UX artifact addresses this feature. The planned UI addition (Task 8) is a single new same-file `<section>` in `EventDetailView.tsx`, following the exact non-reusable, single-consumer JSX pattern already used for the `ticketPrice`/`performers` rows and the Attributions section's link fallback — no new component, hook, or state, so no split is warranted. On the business-`contactInfo`-display gap specifically: Freya's explicit recommendation was to build it now, in this story, not as a follow-up — AC3's fallback message is a *substitution* ("rather than showing a stored value") that is unverifiable in isolation without a live normal-case sibling to substitute for. Reflected in AC3's scope clarification above and Task 8.
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness, Winston persona) — No gap found.** Every dependency in scope traces to an already-built Epic 0 foundation: `buildOptimizedDrizzleSelect` (Story 0.8, in active use across dozens of resolvers), Drizzle migrations (Story 0.4, Story 3.6g's `isImageStorageOptedIn` column-addition is a direct working template for Task 5), the next-intl i18n system (Story 0.6, `apps/web/locales/en.json` already has dozens of live `EventDetailsPage` keys). Duplication check: a repo-wide grep of `epics.md` confirmed Story 3.6i is the sole owner of `hasPrivateContact`/contact-classification — no other story claims this scope.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: new field, additive and backward-compatible throughout.** `hasPrivateContact` is introduced end-to-end as an optional/defaulted boolean at every layer — no existing field's type or semantics changes.
- **Impacted fields/contracts:**
  - `packages/domain/src/events/types.ts`: `GeminiExtractionPayload.hasPrivateContact?: boolean`, `ExtractedEventMessage.hasPrivateContact?: boolean`, `EventInsertValues.hasPrivateContact: boolean` (non-nullable here — always explicitly defaulted to `false` by Task 4, matching the DB column's `NOT NULL DEFAULT false`).
  - `apps/backend/src/validation/extracted-event.schema.ts`: `hasPrivateContact: { type: 'boolean', nullable: true }` added to `extractedEventSchema` (AJV).
  - `packages/database/schema.ts`: new `events.has_private_contact boolean NOT NULL DEFAULT false` column.
  - `apps/backend/src/schema/events.graphql`: new `Event.hasPrivateContact: Boolean!` field (non-null at the API layer, matching the DB column's `NOT NULL`).
  - `packages/ui/src/features/events/EventDetailView.types.ts`: new `EventDetailViewProps.contactInfo?: string | null` and `.hasPrivateContact?: boolean | null` (nullable here, matching how every other optional GraphQL-sourced prop on this interface is typed, e.g. `originalPostUrl?: string | null`).
- **Required DB migration:** one Drizzle-kit generated migration (Task 5) adding `has_private_contact boolean not null default false` to `events` — no backfill needed; all existing rows get `false` (correct: no pre-existing row was ever classified, so "no known private contact" is the accurate default, not an assumption of privacy risk).
- **Required TypeScript type changes:** listed above (Tasks 2, 4, 6, 8) — all additive, no existing type's shape narrows or becomes incompatible.
- **Backward compatibility and rollout notes:** Fully additive and safe to deploy in any order relative to the frontend — `Event.hasPrivateContact` defaults `false` for every event until the next AI extraction runs against it (existing events are not reclassified; see the explicit no-backfill note under Out of Scope), and the frontend gracefully renders nothing extra when both new fields are absent/false (today's exact behavior, unchanged) until `apps/web`'s query/mapper/component changes (Task 8) ship.
- **Verification checks:** Task 9's 6-category unit test suite (transform layer); Task 3/7's discard-enforcement unit tests; Task 4's insert-values mapping test; Task 8's 4 UI test cases; full `pnpm build`/`pnpm lint`/`pnpm test`.

### Project Structure Notes

- **New:** one migration file pair (`packages/database/migrations/0044_*.sql` + `meta/0044_snapshot.json`, Task 5) — no other new files.
- **Modified:** `apps/backend/src/lib/ai-processor/build-gemini-request.ts` + `.test.ts` (Task 1); `packages/domain/src/events/types.ts` (Task 2); `apps/backend/src/validation/extracted-event.schema.ts` (Task 2); `packages/domain/src/events/transform-gemini-response-to-event-info.ts` + `.test.ts` (Tasks 3, 9); `packages/domain/src/events/build-event-insert-values.ts` + `.test.ts` (Task 4); `packages/database/schema.ts` (Task 5); `apps/backend/src/schema/events.graphql` + `apps/backend/src/generated/resolvers-types.ts` (Task 6); `packages/domain/src/events/map-extraction-payload-to-proposed-correction.ts` + `.test.ts` (Task 7); `apps/web/src/features/events/queries.graphql`, `apps/web/src/generated/graphql.ts` (regenerated), `packages/ui/src/features/events/EventDetailView.types.ts`, `packages/ui/src/features/events/EventDetailView.tsx` + `.test.tsx`, `apps/web/src/features/events/mapper.ts`, `apps/web/locales/en.json`, `apps/web/locales/id.json` (Task 8).
- **Not modified:** `apps/backend/src/lib/ingestor/process-ingestion-job.ts` (confirmed by direct read — it passes `buildEventInsertValues`'s output straight to `db.insert(events).values(event)` with no field-specific logic, so Task 4's change flows through with zero changes here); `ProposedEventCorrection`/`proposedEventCorrectionSchema`/`corrections.graphql`/`extraction.graphql`'s input/output types beyond what's already covered (see Task 7's explicit out-of-scope note); `apps/web/src/features/events/correction-dialog.tsx`/`CorrectionForm.tsx` (no new UI for `hasPrivateContact` in the correction flow, per the Scope Extension Decision above).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.6i] — this story's own AC/Note.
- [Source: _bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md#4.1, #Security] — `EventInfo.contactInfo`/`hasPrivateContact` docstrings (already PRD-defined, not yet implemented in code — confirmed via repo-wide grep finding `hasPrivateContact` in zero source files before this story); Section 3.16 (Scraping & Display Data Minimization) and the Security NFR bullet naming this as an open, high-priority build item.
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-09-02.md] — the correct-course session that created this story and its five siblings (3.4n, 3.6g-3.6k, 3.7c-3.7d); confirmed via its own text that "no `hasPrivateContact` field existed anywhere in the schema or extraction logic before this pass."
- [Source: apps/backend/src/lib/ai-processor/build-gemini-request.ts, process-ai-job.ts] — read in full; confirmed the exact `geminiExtractionResponseSchema`/`systemInstruction` shape Task 1 extends, and the exact `processAiJob` pipeline (parse → AJV validate → `transformGeminiResponseToEventInfo` → enqueue) this story's discard enforcement sits inside.
- [Source: packages/domain/src/events/types.ts, transform-gemini-response-to-event-info.ts, build-event-insert-values.ts, map-extraction-payload-to-proposed-correction.ts, and each file's `.test.ts`] — read in full; confirmed current field shapes, existing test conventions (`node:test`/`node:assert`, `describe`/`it` in one file vs. bare `test()` in others — matched per-file in the Tasks above), and the exact pre-this-story pass-through behavior each Task's tests must extend rather than replace.
- [Source: apps/backend/src/validation/extracted-event.schema.ts, proposed-event-correction.schema.ts] — read in full; confirmed both AJV schemas' `additionalProperties: false` (so any new field must be explicitly declared, not just added to the TS interface) and that `validateExtractedEvent` (`resolvers.ts` L46) compiles the same `extractedEventSchema` Task 2 modifies, covering both the async pipeline and `extractEventDataFromUrl`.
- [Source: packages/database/schema.ts] — read the `events` pgTable in full; confirmed `contactInfo: text('contact_info')`'s exact position and Story 3.6g's `isImageStorageOptedIn: boolean(...).default(false).notNull()` column as the direct migration-shape precedent.
- [Source: packages/database/migrations/0043_faulty_electro.sql] — read as the most recent migration, confirming the next sequential file number (0044) and the generated-SQL style (`ALTER TABLE ... ADD COLUMN ... boolean DEFAULT false NOT NULL`).
- [Source: apps/backend/src/schema/events.graphql, resolvers.ts] — read the full `Event` type and grepped every `buildOptimizedDrizzleSelect(events, info)` call site (5 total) plus the `Event: {}` resolver map (L3406+); confirmed `contactInfo`/`organizerName` have zero explicit resolver entries, resolving via GraphQL's default parent-field lookup — the basis for Task 6's "no resolver code needed" claim.
- [Source: apps/backend/src/schema/resolvers.ts L1230-1524] — read the full `extractEventDataFromUrl` and `submitCorrection` mutation resolvers; confirmed `extractEventDataFromUrl` calls the same `buildGeminiExtractionRequest`/`validateExtractedEvent` (`extractedEventSchema`) as the async pipeline and returns `mapExtractionPayloadToProposedCorrection(payload)` directly (no persistence at preview time); confirmed `submitCorrection`'s apply-transaction writes `contactInfo: proposedData.contactInfo || null` directly to `events` from the client-supplied `proposedData` argument with no server-side re-derivation — the basis for the Scope Extension Decision (AC5, Task 7).
- [Source: apps/backend/src/schema/extraction.graphql, corrections.graphql] — read in full; confirmed `ProposedEventCorrectionData`/`ProposedEventCorrectionInput`'s current field lists (basis for Task 7's explicit "do not add `hasPrivateContact` here" note).
- [Source: apps/backend/src/schema/extraction.test.ts, corrections.test.ts] — read the existing `extractEventDataFromUrl`/`submitCorrection` integration test patterns (mocked `callGemini`, `yoga.fetch` GraphQL calls) these stories' own test suites already use; no new test case added to either file by this story (Task 7's fix is covered at the `packages/domain` unit level, consistent with `mapExtractionPayloadToProposedCorrection`'s own existing test file never having integration-level duplication).
- [Source: packages/ui/src/features/events/EventDetailView.tsx, EventDetailView.types.ts, EventDetailView.test.tsx] — read in full; confirmed `contactInfo`/`organizerName` are rendered nowhere today, confirmed the exact `ticketPrice`/`performers`/Attributions JSX patterns Task 8 mirrors, and confirmed the existing `originalPostUrl`-preferred-else-`sourcePostUrl` fallback pattern (L451-461) Task 8's private-contact link reuses.
- [Source: apps/web/src/features/events/queries.graphql, mapper.ts, EventDetailWrapper.tsx] — read in full; confirmed `getEventBySlug` already selects `contactInfo` but `mapGraphQLEventToDetailViewProps` silently drops it — a genuine pre-existing display gap, not introduced by this story.
- [Source: apps/web/locales/en.json, id.json] — read the full `EventDetailsPage` namespace (both locales); confirmed the existing key set and next-intl usage pattern Task 8's new `privateContactMessageLabel` key follows.
- [Source: _bmad-output/planning-artifacts/story-split-gate.md] — gate definitions and the epic-level-sweep-mode basis for re-running Gates 1/2/3 fresh here.
- [Source: _bmad-output/implementation-artifacts/3-6g-*.md, 3-6h-*.md, 3-4o-*.md] — sibling stories from the same 2026-09-02 correct-course batch; read for structural/testing precedent (boolean-column migration shape, `runSubagent`-based fresh Gate 1/2/3 re-runs, `node:test` conventions).

## Global Rules References

- [x] `_bmad-output/project-context.md` — Testing Rules (`packages/domain` unit coverage requirement, Tasks 3/4/7/9); Database Access via Drizzle only, generated migrations (AD-3, Task 5); Code Organization (no `packages/domain` DB/ORM coupling introduced — all new domain functions stay pure).
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order and status vocabulary followed by this file.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — this story implements PRD §3.16/§5's data-minimization requirement and the new `EventInfo.hasPrivateContact` field defined in PRD §4.1; no existing AD rule required amendment (this is new scope, not a correction to an existing AD).
- [x] `docs/infrastructure/index.md` — confirmed not applicable: no backend compute/queue/EventBridge/DB-provisioning change beyond an ordinary Drizzle column migration against already-provisioned Postgres infrastructure.

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - New: `packages/database/migrations/0044_*.sql` + `meta/0044_snapshot.json` (Task 5).
  - Modified: `apps/backend/src/lib/ai-processor/build-gemini-request.ts` + test (Task 1); `packages/domain/src/events/types.ts` (Task 2); `apps/backend/src/validation/extracted-event.schema.ts` (Task 2); `packages/domain/src/events/transform-gemini-response-to-event-info.ts` + test (Tasks 3, 9); `packages/domain/src/events/build-event-insert-values.ts` + test (Task 4); `packages/database/schema.ts` (Task 5); `apps/backend/src/schema/events.graphql` + generated resolver types (Task 6); `packages/domain/src/events/map-extraction-payload-to-proposed-correction.ts` + test (Task 7); `apps/web/src/features/events/queries.graphql`, generated `apps/web/src/generated/graphql.ts`, `packages/ui/src/features/events/EventDetailView.types.ts`, `EventDetailView.tsx` + test, `apps/web/src/features/events/mapper.ts`, `apps/web/locales/{en,id}.json` (Task 8).
- **Rule Mapping:**
  - PRD §3.16/§5, §4.1 `hasPrivateContact` → AC1/AC2, Tasks 1-5.
  - AD-3 (generated-migrations-only) → Task 5.
  - `packages/domain` unit coverage (project-context.md Testing Rules) → Tasks 3, 4, 7, 9.
  - Reuse over reinvention (`buildOptimizedDrizzleSelect`, existing JSX row patterns, existing fallback-link pattern) → Task 6, Task 8.
  - Story-split-gate discipline (fresh Gate 1/2/3, epic-level-sweep-mode fallback) → Dev Notes "Architecture & UX Gate Findings".
  - User-confirmed scope decision (`AskUserQuestion`) → AC5, Task 7, Dev Notes "Scope Extension Decision".
- **Verification Plan:**
  - `packages/domain`: `pnpm --filter @festgrid/domain test` — all updated/new cases in `transform-gemini-response-to-event-info.test.ts`, `build-event-insert-values.test.ts`, `map-extraction-payload-to-proposed-correction.test.ts` pass.
  - `apps/backend`: `pnpm --filter backend test` — updated `build-gemini-request.test.ts` passes; no regression in `process-ai-job.test.ts`/`extraction.test.ts`/`corrections.test.ts` (none of these test files require new cases per this story's Task list, but must still pass unchanged); `pnpm --filter backend build`/`lint` clean.
  - `apps/web`/`packages/ui`: `pnpm --filter web test`, `pnpm --filter ui test` — updated `EventDetailView.test.tsx` cases pass; `pnpm --filter web codegen` regenerates cleanly against the new `hasPrivateContact` GraphQL field.
  - `pnpm build`, `pnpm lint`, `pnpm test` (root) — full suite, no regressions elsewhere.

## Pre-Coding Approval Gate

- [x] Scope confirmation — one new DB column + GraphQL field (Tasks 5-6); prompt/schema/AJV extension (Tasks 1-2); discard enforcement at two independent call sites (Tasks 3, 7); one new frontend display section (Task 8); no new API surface, no new component/hook, no new i18n/analytics/app-shell foundation.
- [x] Architecture and boundary confirmation — all new domain functions (`transformGeminiResponseToEventInfo`, `buildEventInsertValues`, `mapExtractionPayloadToProposedCorrection`) stay pure `packages/domain` code with no DB/ORM coupling; the DB write and GraphQL resolution stay in `apps/backend`, matching the existing pattern for every other `EventInsertValues`/`Event` field.
- [x] Testing plan confirmation — `packages/domain` unit tests for the discard logic and all 6 AC4 classification-outcome categories (Tasks 3, 4, 7, 9); `apps/backend` prompt-content assertion (Task 1); `packages/ui` component tests for both display branches plus the empty state (Task 8).
- [x] Explicit human approval state — approved by shulha via `AskUserQuestion` on 2026-09-03.
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted — Gate 1: no gap (re-run fresh via `runSubagent`, Winston persona). Gate 2: no gap (re-run fresh via `runSubagent`, Freya persona — also resolved AC3's business-contactInfo-display scope question in favor of building both branches now). Gate 3: no gap (re-run fresh via `runSubagent`, Winston persona; confirmed no other story owns `hasPrivateContact`/contact-classification scope).
- [x] **Scope-extension decision confirmed via `AskUserQuestion` (see Dev Notes):** this story's scope includes closing the parallel correction-preview leak (AC5, Task 7), but explicitly does NOT extend to adding `hasPrivateContact` bookkeeping anywhere in the `submitCorrection`/`corrections` round-trip (`ProposedEventCorrection` type, its AJV schema, or either `.graphql` input/output type) — confirmed narrower boundary via `AskUserQuestion` on 2026-09-03.

## Testing Requirements

- [x] Unit tests (required, `packages/domain`): `transform-gemini-response-to-event-info.test.ts` — discard-enforcement cases (Task 3) plus all 6 AC4 classification-outcome categories (Task 9); `build-event-insert-values.test.ts` — `hasPrivateContact` mapping (Task 4); `map-extraction-payload-to-proposed-correction.test.ts` — discard-enforcement case (Task 7).
- [x] Unit test (required, `apps/backend`): `build-gemini-request.test.ts` — prompt-content assertion for the new classification guidance (Task 1).
- [x] Component tests (required, `packages/ui`): `EventDetailView.test.tsx` — business-contact display, private-contact fallback message + link (both `originalPostUrl` and `sourcePostUrl`-fallback variants), and the neither-present empty case (Task 8).
- [x] Integration tests: not required as new cases — `process-ai-job.test.ts`, `extraction.test.ts`, `corrections.test.ts` continue passing unchanged (confirmed via full `pnpm --filter backend test` run — 615/615 passing, no regressions).
- [x] E2E tests: not required — this is a data-classification/display-correctness story with no new interactive flow; the existing event-detail page E2E coverage (if any) is unaffected by an additive display section.

## Deliverables Checklist

- [x] Gemini prompt classifies business-vs-private contact info and treats `wa.me` links as raw phone numbers (AC1, AC2, Task 1).
- [x] `hasPrivateContact` threaded through `GeminiExtractionPayload` → AJV validation → `transformGeminiResponseToEventInfo`'s discard enforcement → `ExtractedEventMessage` → `EventInsertValues` → `events` DB column (AC1, AC2, Tasks 2-5).
- [x] `Event.hasPrivateContact` exposed on the GraphQL API with zero new resolver code (AC1, AC2, AC3, Task 6).
- [x] The same discard enforcement applied to the AI-assisted correction preview path, `ProposedEventCorrection`/`corrections` round-trip deliberately left untouched (AC5, Task 7).
- [x] `EventDetailView.tsx` displays business `contactInfo` and the private-contact fallback message (linking `originalPostUrl`/`sourcePostUrl`) (AC3, Task 8).
- [x] Unit tests covering all 6 AC4 classification-outcome categories, plus discard-enforcement and mapping tests at every touched `packages/domain` function (AC4, Tasks 3, 4, 7, 9).

## Out of Scope

- **Reclassifying/backfilling any already-stored `events.contactInfo` value.** This story only applies classification to new AI extractions (and new AI-assisted correction previews) going forward — no migration or batch job re-processes existing events. A pre-existing `events.contactInfo` value that happens to be a private contact (stored before this story existed, with no privacy classification applied at the time) is not retroactively nulled or flagged. A future dedicated cleanup story could revisit this, out of scope here (matches the same "no backfill" framing already established by Story 3.6h's AC6/AD-12 Rule 6).
- **Manual free-text entry of `contactInfo` in `CorrectionForm.tsx`.** A human moderator/user typing a contact value directly into the correction form (not sourced from AI extraction) is legitimate human-authored data and is not filtered by this story's classification logic — this story's scope is specifically AI-classification of scraped content, not general input validation on user-submitted corrections.
- **Adding `hasPrivateContact` to `ProposedEventCorrection`/`proposedEventCorrectionSchema`/`corrections.graphql`/`extraction.graphql`'s input/output types, or to the `submitCorrection` apply-to-`events` write.** Explicitly declined during this story's creation — see Dev Notes → Scope Extension Decision and Task 7's own out-of-scope note. Discarding the raw value at `mapExtractionPayloadToProposedCorrection` is sufficient to close the leak without this.
- **Story 3.6j (performer-contact/photo leakage verification)** and **Story 3.6k (children's-data keyword filter)** — separate, unrelated data-minimization concerns from the same 2026-09-02 correct-course batch, not touched here.
- **Stories 3.6g/3.6h (image-storage opt-in)** — a separate consent mechanism for post images, unrelated to this story's contact-info scope.

## Definition of Done

- [x] AC1-AC5 satisfied.
- [x] All required tests passing (`packages/domain` unit tests for discard enforcement + all 6 classification-outcome categories; `apps/backend` prompt-content assertion; `packages/ui` component tests for both display branches).
- [x] Lint and type checks passing for `packages/domain`, `apps/backend`, `apps/web`, `packages/ui`.
- [x] Migration `0044_*.sql` generated via `drizzle-kit generate` (not hand-written) and committed alongside its snapshot.
- [x] `apps/backend`/`apps/web` codegen regenerated and committed (`resolvers-types.ts`, `apps/web/src/generated/graphql.ts`).
- [x] No `hasPrivateContact` field added anywhere in the `ProposedEventCorrection`/`corrections` round-trip beyond the `mapExtractionPayloadToProposedCorrection` discard fix itself (per the confirmed scope boundary) — verified via direct code read, no such diff exists.

## Completion Status

- [x] complete

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (bmad-dev-story)

### Debug Log References

- The implementation for Tasks 1-9 was already committed (`5061e02` "feat(ai-extraction): classify and discard private contact info during extraction (Story 3.6i)") in a prior session, but this story file's own Tasks/Subtasks, Status, and Dev Agent Record bookkeeping were never updated to match — this session's work was to independently re-verify every task's code against the story's own spec line-by-line (not merely trust the prior commit message) and then complete the missing bookkeeping.
- Verified by direct code read against each Task's exact spec: `build-gemini-request.ts` classification guidance + `hasPrivateContact: { type: 'BOOLEAN' }` schema field (Task 1); `types.ts`/`extracted-event.schema.ts` (Task 2); `transformGeminiResponseToEventInfo`'s forced discard when `hasPrivateContact === true` (Task 3); `buildEventInsertValues`'s `?? false` default (Task 4); `schema.ts`'s `has_private_contact` column + generated migration `0044_same_silk_fever.sql` (Task 5); `events.graphql`'s `hasPrivateContact: Boolean!` + regenerated `resolvers-types.ts` (Task 6); `mapExtractionPayloadToProposedCorrection`'s identical discard rule, with `ProposedEventCorrection`/`corrections.graphql` confirmed untouched per the scope boundary (Task 7); `EventDetailView.tsx`'s new contact section (business `contactInfo` row vs. `hasPrivateContact` fallback link to `originalPostUrl`/`sourcePostUrl`), `mapper.ts`, `queries.graphql`, both locale files (Task 8).
- Ran `pnpm --filter @festgrid/domain test`: 215/215 passing, including all Task 3/4/7/9 cases (discard enforcement + all 6 AC4 classification-outcome categories).
- Ran `pnpm --filter backend test`: 615/615 passing, including Task 1's prompt-content assertion; `process-ai-job.test.ts`/`extraction.test.ts`/`corrections.test.ts` unaffected.
- Ran `pnpm --filter web test`: 305/305 passing.
- Ran `pnpm --filter ui test`: `EventDetailView.test.tsx` 37/37 passing (all Task 8 cases). One unrelated pre-existing failure surfaced in `EventCard.test.tsx` ("Masonry badge display behavior" — a `Today`/`Yesterday` off-by-one tied to the local run's clock/timezone at test time, in a component this story never touches); flagged to the user rather than fixed, as out of scope for 3.6i.
- Ran root `pnpm lint`: 0 errors (pre-existing `no-explicit-any`/etc. warnings only, unrelated to this story).
- Ran root `pnpm build`: initially failed on a pre-existing, unrelated TypeScript error in `apps/web/src/app/[locale]/posts/select/posts-select-content.tsx` (from Story 3.4n/3.4o's own commit `fd349bc`, not this story) — a `title` prop passed to three `lucide-react` icons (`Clock`, `Ban` ×2) where `LucideProps` has no `title` field, plus a `post.content: string | null` assigned to a `string`-typed field. Per user decision (asked via `AskUserQuestion`), fixed both: changed `title=` to `xlinkTitle=` on the three icons (matching the sibling `AlertCircle` icon already using that prop successfully two lines above), and changed `content: post.content` to `content: post.content ?? ''` (consistent with `PostCard`'s existing `post.content || contentPlaceholder` fallback rendering). Re-ran `pnpm build` (all 7 tasks green), `pnpm lint` (clean), and the affected `posts-select-content.test.tsx` (22/22 passing) to confirm no regression from this out-of-scope fix.
- Ran root `pnpm test` (full workspace suite) as the final Step 9 gate: 11/11 workspace test tasks successful, exit code 0 — including `packages/ui`, where the earlier `EventCard.test.tsx` "Masonry badge" failure did not recur, confirming it was the suspected clock/timezone-dependent flake rather than a real regression.

### Completion Notes List

- All 5 ACs implemented and verified against the current codebase state (not merely inferred from the prior commit's message): AC1/AC2's business-vs-private classification and discard-at-classification enforcement (Gemini prompt + schema + domain transform), AC3's `EventDetailView` business-contact display and private-contact fallback message, AC4's 6 classification-outcome unit tests, AC5's parallel discard fix in the AI-assisted correction preview path.
- This session did not write any new Story 3.6i implementation code — Tasks 1-9 were already complete and correct in the working tree from a prior session's commit (`5061e02`); this session's contribution was independent verification of each task against its exact spec, running the full test/lint/build verification plan, and completing the story file's own tracking (checkboxes, Status, Dev Agent Record, File List) which had been left out of sync with the actual code state.
- Fixed one pre-existing, out-of-scope build-blocking issue (unrelated to 3.6i, from Story 3.4n/3.4o's `posts-select-content.tsx`) after explicit user confirmation — see Debug Log and File List.
- Flagged one pre-existing, out-of-scope test failure (`EventCard.test.tsx`'s masonry badge "Today" test, timezone/clock-dependent) without fixing it, since it is unrelated to this story's component (`EventDetailView`, not `EventCard`) and touching it was not requested.
- Full verification plan (Task 10) executed: `pnpm --filter @festgrid/domain test` (215/215), `pnpm --filter backend test` (615/615), `pnpm --filter web test` (305/305), `pnpm --filter ui test` (368/369 on first run — 1 flaky unrelated failure, not reproduced on the final full-suite run, see below), root `pnpm lint` (0 errors), root `pnpm build` (clean after the out-of-scope fix), root `pnpm test` (11/11 workspace tasks, exit 0).

### File List

**Implemented in a prior session (commit `5061e02`), independently re-verified this session:**
- `apps/backend/src/lib/ai-processor/build-gemini-request.ts` (modified)
- `apps/backend/src/lib/ai-processor/build-gemini-request.test.ts` (modified)
- `apps/backend/src/validation/extracted-event.schema.ts` (modified)
- `apps/backend/src/schema/events.graphql` (modified)
- `apps/backend/src/generated/resolvers-types.ts` (regenerated)
- `packages/domain/src/events/types.ts` (modified)
- `packages/domain/src/events/transform-gemini-response-to-event-info.ts` (modified)
- `packages/domain/src/events/transform-gemini-response-to-event-info.test.ts` (modified)
- `packages/domain/src/events/build-event-insert-values.ts` (modified)
- `packages/domain/src/events/build-event-insert-values.test.ts` (modified)
- `packages/domain/src/events/map-extraction-payload-to-proposed-correction.ts` (modified)
- `packages/domain/src/events/map-extraction-payload-to-proposed-correction.test.ts` (modified)
- `packages/database/schema.ts` (modified)
- `packages/database/migrations/0044_same_silk_fever.sql` (generated)
- `packages/database/migrations/meta/0044_snapshot.json` (generated)
- `packages/database/migrations/meta/_journal.json` (modified)
- `apps/web/src/features/events/queries.graphql` (modified)
- `apps/web/src/features/events/mapper.ts` (modified)
- `apps/web/src/generated/graphql.ts` (regenerated)
- `apps/web/locales/en.json` (modified)
- `apps/web/locales/id.json` (modified)
- `packages/ui/src/features/events/EventDetailView.types.ts` (modified)
- `packages/ui/src/features/events/EventDetailView.tsx` (modified)
- `packages/ui/src/features/events/EventDetailView.test.tsx` (modified)

**Fixed this session (out-of-scope build blocker, user-confirmed):**
- `apps/web/src/app/[locale]/posts/select/posts-select-content.tsx` (modified — `title` → `xlinkTitle` on 3 lucide icons; `post.content ?? ''` null-coalesce)

**This story file:**
- `_bmad-output/implementation-artifacts/3-6i-classify-and-discard-private-contact-info-during-ai-extraction.md` (modified — Tasks/Subtasks, Status, Dev Agent Record, checklists)
