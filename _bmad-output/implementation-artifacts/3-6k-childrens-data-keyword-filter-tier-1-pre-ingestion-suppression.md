# Story 3.6k: Children's-data keyword filter (Tier 1 pre-ingestion suppression)

## Story Details

- **Epic:** 3
- **Story ID:** 3.6k
- **Status:** ready-for-dev

## Story

**As a** platform operator,
**I want** any scraped or user-submitted event text matching a kids'-event keyword filter to never have individual performer names written to the database,
**So that** FestDaily never stores a searchable record of a minor's name, satisfying the legal doc's "prevent the write, not just hide the display" requirement.

## Acceptance Criteria

1. **Given** scraped post text matches a kids'-event keyword filter (`anak`, `cilik`, `junior`, `TK`, `SD`, `sanggar`, `lomba tari anak`, etc. — an expanding heuristic list, not closed), **when** the async AI extraction pipeline (Story 3.6) processes that post, **then** `Schedule.performers` is suppressed entirely (not populated, not populated-then-hidden) for every schedule of the resulting event, while the event's other facts (name, venue, description, etc.) are stored normally.
2. **Given** a UGC correction submission (`submitCorrection`, Story 4.1a) matches the same keyword filter (checked against the submission's free-text fields: `eventName`, `description`, and each schedule's `title`/`location`), **when** the mutation processes it, **then** the correction's non-performer data is still applied to `events`/`schedules` immediately (matching AC1's "store normally, suppress only performers" behavior — there is no working Tier 2 reviewer yet, so holding the *entire* correction unapplied would leave it permanently stuck), `Schedule.performers` is set to suppressed/`null` for every schedule in that correction, and the `corrections` row is written with `status: 'awaiting_verification'` (a new, distinct `correction_status` enum value — not `'applied'`) rather than unlocking display of performer names.
3. **And** the correction result is clearly communicated back to the submitting user: when a submission resolves to `awaiting_verification`, the UI shows a visible, specific notice explaining that the correction was saved but performer names were withheld pending guardian verification (not a silent suppression, and not the generic success toast used for a normal `applied` result).
4. **And** UGC corrections already require a verified (logged-in) submitter (existing Story 4.1/4.2 behavior) — this story adds no new anonymous-submission path.
5. **And** a declaration checkbox ("I confirm I have parent/guardian permission if this includes a minor") is added to the correction form (`CorrectionForm.tsx`, Story 4.1b) as an audit-trail record only — it is persisted (`corrections.guardian_permission_confirmed`) but does **not** by itself unlock performer-name display or change the keyword-match outcome in AC2, since FestDaily cannot verify the submitter is actually the parent.
6. **And** Tier 2 (a school/studio's verified, manually-reviewed exception path) is explicitly out of scope for this story — noted here as a distinct future story, not self-service, requiring moderator-verified organizational identity.

## Tasks / Subtasks

- [ ] **Task 1: Build the shared keyword-filter primitive** (AC1, AC2)
  - [ ] Create `packages/domain/src/events/matches-childrens-data-keyword-filter.ts` exporting:
    - `CHILDRENS_DATA_KEYWORDS: string[]` — the initial heuristic list from the AC text (`anak`, `cilik`, `junior`, `TK`, `SD`, `sanggar`, `lomba tari anak`; add a few obvious siblings the AC's "etc." implies, e.g. `paud`, `balita` — keep the list small and clearly commented as "expanding, not closed" per AC1, so a future story can extend it without re-deriving intent).
    - `matchesChildrensDataKeywordFilter(text: string | undefined | null): boolean` — case-insensitive, **word-boundary** matching (`\b<keyword>\b` per keyword, not a bare substring test) to avoid false positives against short keywords like `SD`/`TK` colliding inside unrelated words (e.g. `USD`, `Monday`). Returns `false` for `undefined`/`null`/empty text.
  - [ ] Export from `packages/domain/src/events/index.ts` (`export * from './matches-childrens-data-keyword-filter.js';`).
  - [ ] Unit tests (`packages/domain`, required 100% coverage): one positive case per listed keyword (case-insensitivity included, e.g. `"Anak"`, `"CILIK"`), one word-boundary negative case proving `SD`/`TK` don't false-match inside `USD`/`Saturday`-style substrings, one whole-text negative case with no keyword present, and `undefined`/empty-string input handling.

- [ ] **Task 2: Extraction-side (Tier 1) suppression** (AC1)
  - [ ] Extend `transformGeminiResponseToEventInfo`'s `context` parameter (`packages/domain/src/events/transform-gemini-response-to-event-info.ts`) with an optional `sourcePostText?: string`.
  - [ ] Inside the function, compute `const childrensDataMatch = matchesChildrensDataKeywordFilter(context.sourcePostText);` once, and in the existing `schedules.map(...)` loop, set `performers: childrensDataMatch ? undefined : sch.performers` for **every** mapped schedule (not just the main one) — matching AC1's "suppressed entirely for that event."
  - [ ] Update `apps/backend/src/lib/ai-processor/process-ai-job.ts`'s existing call to `transformGeminiResponseToEventInfo` (step 7) to pass `sourcePostText: message.content` (the raw scraped caption already available on `ProcessingJobMessage` — no new data dependency).
  - [ ] Unit tests (`packages/domain`, `transform-gemini-response-to-event-info.test.ts`): a keyword-matching `sourcePostText` suppresses `performers` on a payload with multiple schedules while every other field (name, location, description, other schedule fields) passes through unchanged; a non-matching `sourcePostText` leaves `performers` unchanged (regression); an absent `sourcePostText` (existing callers/tests that don't pass it) behaves exactly as before (no suppression) — confirms this is a strictly additive, backward-compatible change.

- [ ] **Task 3: Correction-side classification text + keyword check** (AC2)
  - [ ] Create `packages/domain/src/events/build-correction-classification-text.ts` exporting `buildCorrectionClassificationText(data: ProposedEventCorrection): string` — concatenates `eventName`, `description`, and each schedule's `title` and `location` (the free-text fields a kids'-event keyword could plausibly appear in) into one string for keyword matching. Kept as its own small pure function (not inlined in the resolver) so the "what counts as this correction's classifiable text" decision is independently unit-tested and reusable, matching the project's `packages/domain` testing rule.
  - [ ] Export from `packages/domain/src/events/index.ts`.
  - [ ] Unit tests (`packages/domain`): confirms all four source fields are included, confirms schedule-array concatenation across multiple schedules, confirms missing/optional fields don't throw or add literal `"undefined"` into the output string.

- [ ] **Task 4: `corrections` schema migration** (AC2, AC5)
  - [ ] `packages/database/schema.ts`: add `'awaiting_verification'` to `correctionStatusEnum`'s value list (`pgEnum('correction_status', ['pending', 'applied', 'rejected', 'awaiting_verification'])`); add `guardianPermissionConfirmed: boolean('guardian_permission_confirmed').default(false).notNull()` to the `corrections` table definition.
  - [ ] Generate the migration via `drizzle-kit generate` (do not hand-write SQL) — expect a `0045_*.sql` (next sequential number after the existing `0044_same_silk_fever.sql`) containing an `ALTER TYPE "correction_status" ADD VALUE IF NOT EXISTS 'awaiting_verification';` statement (mirroring the exact `ADD VALUE` pattern already used by `0040_aspiring_mongoose.sql` for `default_location_change_status`) followed by an `ALTER TABLE "corrections" ADD COLUMN "guardian_permission_confirmed" boolean DEFAULT false NOT NULL;` statement, each on its own `--> statement-breakpoint`. Commit the migration file and its `meta/0045_snapshot.json` together.
  - [ ] No backfill needed — `guardian_permission_confirmed` defaults `false` for any pre-existing row (there are none with this concept before this story), and the new enum value has no existing rows to migrate.

- [ ] **Task 5: GraphQL SDL + codegen** (AC2, AC3, AC5)
  - [ ] `apps/backend/src/schema/corrections.graphql`: add `awaiting_verification` to the `CorrectionStatus` enum; add `guardianPermissionConfirmed: Boolean` as a new optional argument to `submitCorrection`; add `guardianPermissionConfirmed: Boolean!` to the `Correction` type (so the audit value round-trips to the client, matching the "audit-trail record" framing in AC5).
  - [ ] Regenerate `apps/backend/src/generated/resolvers-types.ts` and `apps/web/src/generated/graphql.ts` via the project's codegen command; commit both.

- [ ] **Task 6: `submitCorrection` resolver — keyword check, suppression, status branch** (AC2, AC5)
  - [ ] In `apps/backend/src/schema/resolvers.ts`'s `submitCorrection` (~line 1230), after the existing AJV/consistency/ownership validation passes (step 5, i.e. only for what would otherwise become `'applied'`), compute:
    ```
    const childrensDataMatch = matchesChildrensDataKeywordFilter(buildCorrectionClassificationText(proposedData));
    ```
  - [ ] Inside the existing apply transaction (step 6), when building each schedule's `fields` object, force `performers: childrensDataMatch ? null : (s.performers || null)`.
  - [ ] When inserting the `corrections` row inside the same transaction, set `status: childrensDataMatch ? 'awaiting_verification' : 'applied'` and `guardianPermissionConfirmed: guardianPermissionConfirmed ?? false` (new resolver argument, destructured from the mutation args alongside `eventId`/`proposedData`/`source`).
  - [ ] No change to the AJV/consistency/schedule-ownership validation steps themselves, and no change to the `'rejected'` branch — a correction that fails validation is rejected exactly as today regardless of keyword match (nothing is written, so there is nothing to suppress).
  - [ ] Integration tests (`apps/backend`, `corrections.test.ts`): a `submitCorrection` call whose `proposedData` matches the keyword filter (e.g. `eventName: "Lomba Tari Anak"`) results in `status: 'awaiting_verification'`, the written `schedules` row has `performers: null` regardless of what was submitted, and all non-performer fields wrote normally; a non-matching call behaves exactly as today (`status: 'applied'`, `performers` written as submitted) — explicit regression case; `guardianPermissionConfirmed: true` passed on the mutation persists to the `corrections` row and is returned on the `Correction` type.

- [ ] **Task 7: `CorrectionForm.tsx` — declaration checkbox** (AC5)
  - [ ] `packages/ui/src/features/events/CorrectionForm.types.ts`: extend `CorrectionFormProps` with `guardianPermissionConfirmed?: boolean` and `onGuardianPermissionConfirmedChange?: (checked: boolean) => void` (controlled, matching the rest of the form's controlled-input pattern); extend `CorrectionFormLabels` with `guardianPermissionCheckboxLabel: string`. Change the `onSubmit` prop's type to `(data: ProposedEventCorrection, guardianPermissionConfirmed: boolean) => void` so the checkbox value reaches the caller alongside the existing payload (the checkbox is submission metadata, not `ProposedEventCorrection` event/schedule data, so it must not be added to that domain type — see Dev Notes "Data Type Compatibility").
  - [ ] `CorrectionForm.tsx`: render a new checkbox row (reusing the existing `Checkbox` primitive, `packages/ui/src/core/checkbox.tsx` — no new component) below the schedule section, labeled via `labels.guardianPermissionCheckboxLabel`, controlled by the new prop pair (falling back to internal `useState` only if the caller doesn't pass the controlled prop, matching how the rest of the form already manages its own local state — simplest is to keep it as the form's own local `useState`, since nothing else in the form is externally controlled either); call `onSubmit(payload, guardianPermissionConfirmed)` instead of `onSubmit(payload)` in `handleSubmit`.
  - [ ] Update `CorrectionForm.test.tsx` for the new checkbox render/toggle and the new two-argument `onSubmit` call shape.

- [ ] **Task 8: `correction-dialog.tsx` — thread the checkbox, handle the new status** (AC2, AC3, AC5)
  - [ ] `apps/web/src/features/events/corrections.graphql`: add `$guardianPermissionConfirmed: Boolean` to the `submitCorrection` mutation document's variables and pass it through to the field call; add `guardianPermissionConfirmed` to the selection set.
  - [ ] `correction-dialog.tsx`'s `handleSubmit` now receives `(data, guardianPermissionConfirmed)` from `CorrectionForm`'s `onSubmit`; pass `guardianPermissionConfirmed` through to the `submitCorrection` mutation call alongside the existing `eventId`/`proposedData`/`source` variables.
  - [ ] Extend the post-submit branching (currently `status === "applied"` vs. else-treated-as-rejected) with an explicit third branch for `status === "awaiting_verification"`:
    - Patch the `getEventBySlug` query cache the same way as the `"applied"` branch (non-performer fields from `proposedData`), **except** the patched main schedule's `performers` must be set to `null` (what was actually persisted), never `propMain.performers` (what the user typed) — the cache must reflect real stored state, not submitted intent.
    - Show a distinct, specific toast/message (not the generic `successToast`, and not a validation-error state) explaining that the correction saved but performer names were withheld pending guardian verification — reusing the existing amber `pendingReview` status-badge/toast styling already defined in `design-artifacts/UX-festgrid-run-1/DESIGN.md` (confirmed by Gate 2 review during this story's creation) rather than inventing new styling.
    - Close the dialog the same as a successful `"applied"` submission (the correction did save; only the performer-name portion is withheld).
  - [ ] Update `correction-dialog.test.tsx` for the new `awaiting_verification` branch (mutation variables include `guardianPermissionConfirmed`, cache patch nulls `performers`, the distinct toast copy renders, not the generic success toast).

- [ ] **Task 9: i18n** (AC3, AC5)
  - [ ] `apps/web/locales/en.json` and `id.json`, `EventCorrectionForm` namespace: add `guardianPermissionCheckboxLabel` ("I confirm I have parent/guardian permission if this includes a minor" / Indonesian equivalent) and `awaitingVerificationToast` (explains performer names were withheld pending guardian verification / Indonesian equivalent). Follow the existing flat-key style already used in this namespace (see `successToast`/`errorToast` precedent) — no new namespace needed.

- [ ] **Task 10: Full verification pass**
  - [ ] `pnpm --filter @festgrid/domain test` — all new/updated cases from Tasks 1-3 pass, 100% coverage maintained.
  - [ ] `pnpm --filter backend test` — updated `corrections.test.ts` cases pass; `process-ai-job.test.ts`/`extraction.test.ts` continue passing unchanged (neither requires a new case per this story's scope, but must not regress); `pnpm --filter backend build`/`lint` clean.
  - [ ] `pnpm --filter web test`, `pnpm --filter ui test` — updated `CorrectionForm.test.tsx`/`correction-dialog.test.tsx` cases pass; `pnpm --filter web codegen` regenerates cleanly against the new `CorrectionStatus`/`Correction.guardianPermissionConfirmed`/mutation-argument GraphQL changes.
  - [ ] `pnpm build`, `pnpm lint`, `pnpm test` (root) — full suite, no regressions elsewhere.

## Dev Notes

- **This story's mechanism mirrors the "discard-at-classification" pattern already established by Stories 3.6i/3.6j** (private-contact classification, performer-contact/photo prompt exclusion): a deterministic check gates what gets written, enforced in code (not just documented as a rule), with a pure, 100%-unit-tested `packages/domain` function at the center. The key difference from 3.6i/3.6j: this filter is a **deterministic keyword match against raw/submitted text**, not an AI-classification signal from Gemini — so there is no prompt change on the extraction side, and no new Gemini schema field. `Schedule.performers` is suppressed by the pipeline itself, independent of whatever Gemini extracted.
- **Why the extraction-side check runs against `message.content` (the raw scraped caption), not Gemini's extracted `performers` array.** AC1's wording — "scraped post text... matches a kids'-event keyword filter" — ties the trigger to the source text, not to whether Gemini happened to extract any performer names for that post. This also means the check still suppresses correctly even for a post where Gemini didn't extract any performers at all (a no-op suppression, harmless) and for a post where the keyword appears in the caption but not verbatim in the extracted `performers` array (e.g. "Lomba Tari Anak Sanggar X" as the event name, individual dancer names as `performers`) — the AC's intent is "if the *content* signals a children's event, never extract individual names for it," not "only suppress names that literally repeat the keyword."
- **Why word-boundary matching, not substring matching.** Two of the example keywords (`TK`, `SD`) are two-letter tokens that are also common substrings of unrelated words (`USD`, `Saturday`, `TKO`, etc.). A plain `.includes()` check would produce frequent false positives for a heuristic list this short and this loosely specified ("etc. — an expanding heuristic list"). `\b<keyword>\b` regex matching is the standard mitigation and keeps this a purely mechanical implementation choice — no scope tradeoff, since the AC's own keyword list already assumes exact-token matching is intended (nobody reads "SD" as matching "USD").
- **Why the correction-side keyword check runs against a purpose-built concatenation (`buildCorrectionClassificationText`), not the raw post caption.** A UGC correction submission has no single "post text" — it's structured fields the user typed into `CorrectionForm`. `eventName`/`description`/each schedule's `title`/`location` are the free-text fields a kids'-event signal could plausibly appear in; `organizerName`/`contactInfo`/date/time/ticket-price fields are excluded as implausible carriers of this specific signal and to avoid needlessly widening the false-positive surface.
- **Why an `awaiting_verification` correction still writes its non-performer data immediately, rather than holding the whole correction unapplied (per the user's explicit decision during this story's creation, confirmed via `AskUserQuestion` on 2026-09-04).** Holding the entire correction (not just performers) unapplied would create a dead-end: no Tier 2 reviewer process exists yet (explicitly out of scope, AC6) to ever un-hold it, so a user's legitimate edits to venue/description/date would sit stuck indefinitely alongside the performer-name concern that's the actual reason for the hold. Mirrors AC1's extraction-side framing exactly ("suppressed entirely... while the event's other facts... are stored normally") — the suppression is scoped to `performers`, not to the correction as a whole.
- **Why `awaiting_verification` is a new, distinct `correction_status` enum value rather than reusing the existing-but-unused `'pending'` default (per the user's explicit decision, confirmed via `AskUserQuestion` on 2026-09-04).** `submitCorrection` never actually writes `'pending'` today (it only ever resolves to `'applied'` or `'rejected'`) — reusing it here would conflate "not yet processed" with "held specifically for guardian-verification reasons." This directly follows the precedent Story 4.3a already set in this codebase: it added a new, distinct `auto_resolved` report status rather than overload an existing one, specifically so the status reads unambiguously to a future reader. A DB migration is required either way (Task 4 already needs one for the new `guardian_permission_confirmed` column), so there is no migration-cost argument for reuse.
- **Why the guardian-permission checkbox value must NOT be added to `ProposedEventCorrection`/`proposedEventCorrectionSchema`/`ProposedEventCorrectionInput`.** That type represents the *event/schedule data itself* — the exact shape mirrored end-to-end from `EventInfo`/`Schedule` through Story 4.1a's AJV schema. A submission-metadata flag (who confirmed what, for audit purposes) is not part of that data shape; it belongs on the `corrections` row itself as a sibling column to `source`/`status`, mirroring how `reports.moderatorIgnored` sits beside `reports.status` as a separate audit/control flag rather than living inside `reports`' own subject-matter fields.
- **AC3 (the explicit UI-communication requirement) was added during this story's creation, not present in the original epics.md AC text** — the user explicitly required, alongside confirming the "write immediately, minus performers" design decision, that the UI must clearly and visibly explain to the submitting user *why* performer names were withheld, rather than silently suppressing them. This is reflected as its own numbered AC (AC3) and Tasks 8-9 above, and should be treated with the same weight as the epics.md-sourced ACs — do not treat it as optional polish.

### Architecture & UX Gate Findings

Epic 3's readiness sweep (`epic-readiness/epic-3-readiness.md`, `swept: true`, dated 2026-08-09) predates this story (added 2026-09-02 via `bmad-correct-course`, same batch as siblings 3.4n, 3.6g-3.6j, 3.7c-3.7d) and its `stories_covered` list does not include 3.6k — so per `story-split-gate.md`'s epic-level-sweep-mode fallback, all three gates were re-run fresh via `runSubagent`, matching the precedent set by every other sibling in this batch's own creation.

- **Gate 1 (Architecture/Infrastructure Completeness, Winston persona) — Gap found, resolved within this story's own scope (not a prerequisite split).** The extraction-side AC1 change (pure-function suppression inside `transformGeminiResponseToEventInfo`, entirely inside `packages/domain`) triggers no Gate 1 heuristic — same shape as 3.6i's own discard-at-classification precedent. The gap identified was on the correction-side ACs: `corrections.correctionStatusEnum` has no `AWAITING_VERIFICATION`-equivalent value, and no column exists to persist the guardian-permission checkbox — neither is owned by any of this story's dependency stories (3.6, 4.1, 4.2 all predate and never touch `corrections.status` semantics or add new columns). Winston's finding was explicit that this is a **scoping** gap, not a **missing-shared-infrastructure** gap in the Gate 1 sense (i18n foundation, GraphQL codegen pipeline, app shell, an adapter multiple features need) — it is this story's own natural DB/resolver/GraphQL/UI surface to build, the same way any other story that needs a new column or status value builds it as part of its own scope (e.g. Story 4.3a's own `auto_resolved` addition was built inside 4.3a itself, not split into a prerequisite). Resolution: Tasks 4-8 above explicitly claim this scope within Story 3.6k rather than assuming it was already covered — no prerequisite story was created.
- **Gate 2 (UI Complexity & Reusability, Freya persona) — No gap found.** Checked both `design-artifacts/UX-festgrid-run-1/` and `design-artifacts/UX-wizard-page-run-1/`'s `DESIGN.md`/`EXPERIENCE.md`: zero direct mentions of a children's-data consent checkbox, a keyword-filter/moderation UI, or an "awaiting verification" status screen. One reusable match found: `UX-festgrid-run-1/DESIGN.md` (lines 118-122) already defines a generic status-badge token set including an amber `pendingReview` variant — reused for the AC3 submitter-facing notice (Task 8) rather than inventing new styling. Adding one boolean checkbox to the already-reusable, already-two-consumer `CorrectionForm.tsx` is not itself a new reusable component with non-trivial states (no new interaction pattern, no second consumer to design beyond the two that already exist) — does not warrant a Gate 2 split. Extending `correction-dialog.tsx`'s binary applied/rejected branching with one more status branch is a copy+existing-token addition, not new UI architecture.
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness, Winston persona) — No gap found.** (1) The keyword list itself: grepped `epics.md`/PRD for "keyword"/"children"/"minor"/"kids" — no mention anywhere of a moderator-facing admin/config UI to manage the list; the AC's own "expanding heuristic list, not closed" phrasing and Tier 2's explicit deferral (AC6) confirm a hardcoded exported list in `packages/domain` (Task 1) is correctly scoped MVP, not a missing config-management foundation. (2) Reusable moderation/suppression pattern: this project's established convention is a per-feature status field modeled on `DefaultLocationChangeRequest` (`PENDING_REVIEW`/`AWAITING_APPROVAL`), already reused by other stories — 3.6k's `awaiting_verification` follows the same convention rather than inventing a new shared mechanism; `packages/domain/src/events/` (alongside `buildDefaultEventVisibilityConditions.ts`, `shouldSoftDeleteFromCancelledReports.ts`) is the correct feature-scoped location per project-context.md's placement rule, not a generic cross-entity subfolder (unlike, e.g., a query-DSL-shaped mechanism would be) — this filter is specific to event/schedule/correction content, not a generic reusable-across-unrelated-entities primitive. (3) The declaration checkbox requires no moderator-facing review screen — Tier 2 (which would need one) is explicitly out of scope (AC6); nothing here presupposes unbuilt shared moderator tooling beyond what already exists (`useRequireModerator()`, Story 4.7a).

### Data Type Compatibility & Migration Requirements

- **Extraction side (AC1): no new field, column, GraphQL type, or TypeScript interface.** `transformGeminiResponseToEventInfo`'s context gains one new *optional* parameter (`sourcePostText?: string`); `ExtractedEventMessage`/`EventInsertValues`/the `events`/`schedules` DB schema are all unchanged — the suppression is expressed purely by nulling an already-existing, already-nullable `performers` field. Fully backward-compatible: any existing caller that doesn't pass `sourcePostText` gets `matchesChildrensDataKeywordFilter(undefined)` → `false` → identical behavior to today.
- **Correction side (AC2, AC5): additive, backward-compatible changes across every layer.**
  - `packages/database/schema.ts`: `correctionStatusEnum` gains a new value `'awaiting_verification'` (additive to a Postgres enum — existing rows/values unaffected); `corrections` gains `guardianPermissionConfirmed: boolean(...).default(false).notNull()` (additive column, safe default for all pre-existing rows).
  - `apps/backend/src/schema/corrections.graphql`: `CorrectionStatus` enum gains `awaiting_verification`; `submitCorrection` gains an optional `guardianPermissionConfirmed: Boolean` argument (omitting it is valid — defaults to `false` server-side); `Correction` type gains `guardianPermissionConfirmed: Boolean!` (non-null at the API layer, matching the DB column's `NOT NULL`).
  - `packages/domain/src/events/types.ts`: **no changes** — `ProposedEventCorrection` deliberately does not gain a `guardianPermissionConfirmed` field (see Dev Notes above); the value travels as a sibling mutation argument, not inside the correction-data payload.
  - `packages/ui/src/features/events/CorrectionForm.types.ts`: `CorrectionFormProps.onSubmit` signature changes from `(data: ProposedEventCorrection) => void` to `(data: ProposedEventCorrection, guardianPermissionConfirmed: boolean) => void` — a breaking change to this prop's call signature, but `CorrectionForm` has exactly one production consumer (`correction-dialog.tsx`, Task 8 updates it in the same story) and its own test file (Task 7 updates it in the same story), so no other file is left broken.
- **Required DB migration:** one Drizzle-kit generated migration (Task 4, expected `0045_*.sql`) — `ALTER TYPE "correction_status" ADD VALUE IF NOT EXISTS 'awaiting_verification';` (mirroring `0040_aspiring_mongoose.sql`'s exact precedent for `default_location_change_status`) plus `ALTER TABLE "corrections" ADD COLUMN "guardian_permission_confirmed" boolean DEFAULT false NOT NULL;`. No backfill needed for either change.
- **Backward compatibility and rollout notes:** Safe to deploy in any order relative to the frontend. Before `apps/web`'s Task 7/8 changes ship, the backend accepting an optional `guardianPermissionConfirmed` argument that the old client never sends simply defaults it to `false` — no error. The new `awaiting_verification` status is only ever produced when the new keyword-match logic actually matches, so no existing correction flow changes behavior until this story's full stack (Tasks 1-9) ships together.
- **Verification checks:** Task 1-3's domain unit tests (100% coverage); Task 6's `corrections.test.ts` integration cases (both matching and non-matching, explicit regression case for the unchanged `'applied'` path); Task 7-8's UI/component tests; full `pnpm build`/`pnpm lint`/`pnpm test`.

### Project Structure Notes

- **New:**
  - `packages/domain/src/events/matches-childrens-data-keyword-filter.ts` + `.test.ts` (Task 1).
  - `packages/domain/src/events/build-correction-classification-text.ts` + `.test.ts` (Task 3).
  - `packages/database/migrations/0045_*.sql` + `meta/0045_snapshot.json` (Task 4).
- **Modified:**
  - `packages/domain/src/events/index.ts` (Task 1, 3 — new exports).
  - `packages/domain/src/events/transform-gemini-response-to-event-info.ts` + `.test.ts` (Task 2).
  - `apps/backend/src/lib/ai-processor/process-ai-job.ts` (Task 2 — one new argument to an existing call).
  - `packages/database/schema.ts` (Task 4).
  - `apps/backend/src/schema/corrections.graphql` + `apps/backend/src/generated/resolvers-types.ts` (Task 5).
  - `apps/backend/src/schema/resolvers.ts` (`submitCorrection`) + `apps/backend/src/schema/corrections.test.ts` (Task 6).
  - `packages/ui/src/features/events/CorrectionForm.tsx`, `CorrectionForm.types.ts`, `CorrectionForm.test.tsx` (Task 7).
  - `apps/web/src/features/events/corrections.graphql`, `apps/web/src/generated/graphql.ts` (regenerated), `apps/web/src/features/events/correction-dialog.tsx`, `correction-dialog.test.tsx` (Task 8).
  - `apps/web/locales/en.json`, `apps/web/locales/id.json` (Task 9).
- **Not modified:**
  - `apps/backend/src/lib/ai-processor/build-gemini-request.ts` — no prompt/schema change; this story's filter is deterministic, not AI-driven (see Dev Notes).
  - `apps/backend/src/validation/extracted-event.schema.ts`, `proposed-event-correction.schema.ts` — no field-shape change on either payload (see Data Type Compatibility above).
  - `packages/domain/src/events/build-event-insert-values.ts`, `apps/backend/src/lib/ingestor/process-ingestion-job.ts` — confirmed by direct read: `performers` is already nulled upstream (Task 2) before either of these run, so neither needs its own change.
  - `EventDetailView.tsx`/`EventDetailView.types.ts` — no display-side change: AC1's suppression is silent at write time for the automated extraction path (there is no "submitting user" to notify for a scraped post), and the AC3 notification requirement is scoped to the correction-submission flow only (Task 8), which the submitter sees inline in `correction-dialog.tsx`, not on the public event page.
  - `apps/backend/src/schema/events.graphql` — `Event.hasPrivateContact` (3.6i) and any other existing `Event`/`Schedule` fields are unaffected; this story touches only `Correction`/`CorrectionStatus`/`submitCorrection`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.6k] — this story's own AC/Note.
- [Source: _bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md, "Scraping & Display Data Minimization" section referenced by the sibling stories] — the "prevent the write, not just hide the display" framing this story implements.
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-09-02.md] — the correct-course session that created this story and its siblings (3.4n, 3.6g-3.6j, 3.7c-3.7d).
- [Source: _bmad-output/implementation-artifacts/3-6i-classify-and-discard-private-contact-info-during-ai-extraction.md, 3-6j-verify-and-guard-against-performer-contact-photo-leakage-in-extraction.md] — direct siblings from the same correct-course batch; read in full for structural precedent (discard-at-classification pattern, epic-level-sweep-mode fresh-gate rationale, Dev Notes/Global Rules/Implementation Plan shape this story mirrors).
- [Source: apps/backend/src/lib/ai-processor/process-ai-job.ts, build-gemini-request.ts] — read in full; confirmed the exact pipeline order (`buildGeminiExtractionRequest` → `callGemini` → AJV validate → `transformGeminiResponseToEventInfo` → enqueue) this story's Task 2 change sits inside, and confirmed `message.content` is the raw scraped caption text available at that point with no new data dependency.
- [Source: packages/domain/src/events/transform-gemini-response-to-event-info.ts, types.ts, build-event-insert-values.ts] — read in full; confirmed the current pass-through shape, the existing `hasPrivateContact` discard-at-classification precedent (Story 3.6i) this story's Task 2 mirrors, and confirmed `performers` is already nullable end-to-end so no schema widening is needed.
- [Source: apps/backend/src/schema/resolvers.ts L1230-1365] — read the full `submitCorrection` resolver; confirmed the exact validation → apply-transaction → `corrections` insert flow Task 6 extends, and confirmed `corrections.status` is only ever written as `'applied'` or `'rejected'` today (never `'pending'`) — the basis for the "reuse vs. new enum value" design decision.
- [Source: packages/database/schema.ts] — read the `corrections`/`correctionStatusEnum`/`reports`/`reportStatusEnum`/`defaultLocationChangeRequests` definitions in full; confirmed `reports.moderatorIgnored`'s sibling-audit-column precedent (basis for placing `guardianPermissionConfirmed` on `corrections` rather than inside `proposedData`), and confirmed Story 4.3a's `auto_resolved` addition as the precedent for adding a new enum value over reusing an existing one.
- [Source: packages/database/migrations/0040_aspiring_mongoose.sql, 0044_same_silk_fever.sql] — read as the precedent for an `ALTER TYPE ... ADD VALUE` migration's exact generated-SQL shape, and to confirm the next sequential migration number (0045).
- [Source: apps/backend/src/schema/corrections.graphql, apps/web/src/features/events/corrections.graphql] — read in full; confirmed the current `CorrectionStatus`/`ProposedEventCorrectionInput`/`Correction` SDL shapes and the client mutation document Task 5/8 extend.
- [Source: packages/ui/src/features/events/CorrectionForm.tsx, CorrectionForm.types.ts, CorrectionForm.test.tsx] — read in full; confirmed the form's fully-local-`useState` pattern (no externally-controlled fields today), the `labels`-prop i18n-decoupling convention, and the existing `Checkbox` core primitive (`packages/ui/src/core/checkbox.tsx`) available for reuse in Task 7 — no new component needed.
- [Source: apps/web/src/features/events/correction-dialog.tsx, correction-dialog.test.tsx] — read in full; confirmed the current binary `status === "applied"` vs. else branching, the exact query-cache-patch shape Task 8 extends with a `performers: null` override, and confirmed `CorrectionSource`/`useSubmitCorrectionMutation` codegen usage patterns.
- [Source: apps/web/locales/en.json, "EventCorrectionForm" namespace] — read the full existing key set; confirmed the flat-key, no-nesting convention Task 9's two new keys follow.
- [Source: design-artifacts/UX-festgrid-run-1/DESIGN.md, EXPERIENCE.md; design-artifacts/UX-wizard-page-run-1/DESIGN.md, EXPERIENCE.md] — checked (via Gate 2 subagent) for any children's-data-consent or awaiting-verification display spec; zero direct matches, but confirmed a reusable amber `pendingReview` status-badge/toast token (`UX-festgrid-run-1/DESIGN.md` lines 118-122) for Task 8 to reuse.
- [Source: _bmad-output/planning-artifacts/story-split-gate.md] — gate definitions and the epic-level-sweep-mode basis for re-running Gates 1/2/3 fresh here.
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-3-readiness.md] — confirmed `swept: true` (2026-08-09) but `stories_covered` predates and excludes 3.6k, triggering the fresh-gate fallback.
- User decisions confirmed via direct conversation on 2026-09-04 (not `AskUserQuestion` tool output, but an explicit user response to the same two-question format): (1) write immediately, minus performers, on an `awaiting_verification` match; (2) add a new `awaiting_verification` enum value rather than reuse `'pending'`; plus an explicit additional requirement that the UI must visibly explain to the submitting user why performers were withheld (reflected as AC3).

## Global Rules References

- [x] `_bmad-output/project-context.md` — Testing Rules (`packages/domain` 100% unit coverage, Tasks 1-3); Drizzle-generated-migrations-only (Task 4); Code Organization (all new domain functions in Tasks 1/3 stay pure, no DB/ORM coupling; `guardianPermissionConfirmed` correctly kept out of the pure `ProposedEventCorrection` domain type, see Dev Notes); UI component placement (`Checkbox` reused from `packages/ui/src/core/`, no new component).
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order and status vocabulary followed by this file.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — this story implements PRD's data-minimization requirement for children's/minors' data; no existing AD rule required amendment (new verification/suppression scope, not a correction to an existing AD).
- [x] `docs/infrastructure/index.md` — confirmed not applicable: no backend compute/queue/EventBridge/DB-provisioning change beyond an ordinary Drizzle column/enum-value migration against already-provisioned Postgres infrastructure; reuses the already-provisioned extraction pipeline (Story 3.6) and corrections mutation (Story 4.1a) unchanged in shape.

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - New: `packages/domain/src/events/matches-childrens-data-keyword-filter.ts` + test (Task 1); `packages/domain/src/events/build-correction-classification-text.ts` + test (Task 3); `packages/database/migrations/0045_*.sql` + snapshot (Task 4).
  - Modified: `packages/domain/src/events/index.ts`, `transform-gemini-response-to-event-info.ts` + test (Task 2); `apps/backend/src/lib/ai-processor/process-ai-job.ts` (Task 2); `packages/database/schema.ts` (Task 4); `apps/backend/src/schema/corrections.graphql` + generated resolver types (Task 5); `apps/backend/src/schema/resolvers.ts` + `corrections.test.ts` (Task 6); `packages/ui/src/features/events/CorrectionForm.tsx/.types.ts/.test.tsx` (Task 7); `apps/web/src/features/events/corrections.graphql`, generated `apps/web/src/generated/graphql.ts`, `correction-dialog.tsx` + test (Task 8); `apps/web/locales/{en,id}.json` (Task 9).
- **Rule Mapping:**
  - PRD data-minimization requirement ("prevent the write, not just hide the display") → AC1/AC2, Tasks 1-6.
  - AD-3-equivalent (generated-migrations-only) → Task 4.
  - `packages/domain` 100% unit coverage (project-context.md Testing Rules) → Tasks 1, 2, 3.
  - Discard-at-classification pattern reuse (Story 3.6i/3.6j precedent) → Task 2, Dev Notes.
  - Story-split-gate discipline (fresh Gate 1/2/3, epic-level-sweep-mode fallback, Gate 1 gap resolved within this story's own scope) → Dev Notes "Architecture & UX Gate Findings".
  - User-confirmed design decisions (`AskUserQuestion`-equivalent direct confirmation, 2026-09-04) → AC2, AC3, Dev Notes.
  - Sibling-audit-column precedent (`reports.moderatorIgnored`) → AC5, Task 4/6, Dev Notes "Data Type Compatibility".
  - New-enum-value-over-reuse precedent (Story 4.3a's `auto_resolved`) → AC2, Task 4, Dev Notes.
- **Verification Plan:**
  - `packages/domain`: `pnpm --filter @festgrid/domain test` — all new/updated cases in `matches-childrens-data-keyword-filter.test.ts`, `build-correction-classification-text.test.ts`, `transform-gemini-response-to-event-info.test.ts` pass; 100% coverage maintained.
  - `apps/backend`: `pnpm --filter backend test` — new `corrections.test.ts` cases (matching, non-matching regression, `guardianPermissionConfirmed` persistence) pass; `process-ai-job.test.ts`/`extraction.test.ts` continue passing unchanged; `pnpm --filter backend build`/`lint` clean.
  - `apps/web`/`packages/ui`: `pnpm --filter web test`, `pnpm --filter ui test` — updated `CorrectionForm.test.tsx`/`correction-dialog.test.tsx` cases pass; `pnpm --filter web codegen` regenerates cleanly against the new GraphQL SDL.
  - `pnpm build`, `pnpm lint`, `pnpm test` (root) — full suite, no regressions elsewhere.

## Pre-Coding Approval Gate

- [ ] Scope confirmation — one new DB column + one new enum value (Task 4); GraphQL SDL extension, no new query/mutation (Task 5); resolver logic extension to an existing mutation (Task 6); two new pure `packages/domain` functions (Tasks 1, 3); one existing domain function's context extended additively (Task 2); one existing form component's checkbox addition + `onSubmit` signature change (Task 7); one existing dialog's status-branch addition (Task 8); no new API surface, no new page, no new i18n/analytics/app-shell foundation.
- [ ] Architecture and boundary confirmation — all new domain functions (`matchesChildrensDataKeywordFilter`, `buildCorrectionClassificationText`) stay pure `packages/domain` code with no DB/ORM coupling; the DB write, keyword-check invocation, and GraphQL resolution stay in `apps/backend`; `guardianPermissionConfirmed` deliberately kept out of `ProposedEventCorrection` (submission metadata, not event data) per Dev Notes.
- [ ] Testing plan confirmation — `packages/domain` unit tests for both new pure functions and the extended `transform-gemini-response-to-event-info` (Tasks 1-3); `apps/backend` integration tests covering matched/unmatched/checkbox-persistence cases (Task 6); `packages/ui`/`apps/web` component tests for the checkbox and the new `awaiting_verification` branch (Tasks 7-8).
- [ ] Explicit human approval state — **pending.** Design decisions (apply-immediately-minus-performers; new `awaiting_verification` enum value; explicit AC3 UI-communication requirement) were confirmed by the user via direct response on 2026-09-04. Full story scope/task breakdown has not yet been separately re-confirmed — confirm before implementation begins.
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted — Gate 1: gap found and resolved within this story's own scope (correction-side migration/resolver/GraphQL/UI work explicitly claimed by Tasks 4-8, not split into a prerequisite — see Dev Notes for why this is scoping, not missing shared infrastructure). Gate 2: no gap (re-run fresh via `runSubagent`, Freya persona). Gate 3: no gap (re-run fresh via `runSubagent`, Winston persona).

## Testing Requirements

- [ ] Unit tests (required, `packages/domain`): `matches-childrens-data-keyword-filter.test.ts` (Task 1, 100% coverage — positive case per keyword, word-boundary negative cases, empty/undefined input); `build-correction-classification-text.test.ts` (Task 3); `transform-gemini-response-to-event-info.test.ts` — new cases for matched/unmatched/absent `sourcePostText` (Task 2).
- [ ] Integration tests (required, `apps/backend`): `corrections.test.ts` — matched-keyword case (`awaiting_verification`, `performers: null`, other fields written normally), non-matched regression case (`applied`, `performers` written as submitted), `guardianPermissionConfirmed` persistence case (Task 6).
- [ ] Component tests (required, `packages/ui`, `apps/web`): `CorrectionForm.test.tsx` — checkbox renders, toggles, and is included in the two-argument `onSubmit` call (Task 7); `correction-dialog.test.tsx` — mutation variables include `guardianPermissionConfirmed`, the `awaiting_verification` cache patch nulls `performers`, the distinct AC3 toast copy renders instead of the generic success toast (Task 8).
- [ ] E2E tests: not required as a new flow — this extends the existing correction-submission flow (already covered, if at all, by existing E2E coverage) with an additional server-side branch; no new page or navigation path is introduced.

## Deliverables Checklist

- [ ] `matchesChildrensDataKeywordFilter`/`CHILDRENS_DATA_KEYWORDS` built and unit tested in `packages/domain` (AC1, AC2, Task 1).
- [ ] Extraction pipeline suppresses `Schedule.performers` on every schedule of a matched post while storing other facts normally (AC1, Task 2).
- [ ] `buildCorrectionClassificationText` built and unit tested (AC2, Task 3).
- [ ] `corrections` migration: new `awaiting_verification` enum value + `guardian_permission_confirmed` column (AC2, AC5, Task 4).
- [ ] GraphQL SDL + codegen updated for `CorrectionStatus`, `submitCorrection`'s new argument, `Correction.guardianPermissionConfirmed` (Task 5).
- [ ] `submitCorrection` resolver applies non-performer correction data immediately on a keyword match, suppresses `performers`, writes `status: 'awaiting_verification'` and the persisted checkbox value (AC2, AC5, Task 6).
- [ ] `CorrectionForm.tsx` renders the declaration checkbox and threads its value to `onSubmit` (AC5, Task 7).
- [ ] `correction-dialog.tsx` threads the checkbox to the mutation and shows a distinct, specific notice explaining withheld performer names on an `awaiting_verification` result (AC3, AC5, Task 8).
- [ ] i18n keys added for the checkbox label and the awaiting-verification notice, English and Indonesian (AC3, AC5, Task 9).

## Out of Scope

- **Tier 2 (a school/studio's verified, manually-reviewed exception path).** Explicitly named out of scope by AC6 — a distinct future story requiring moderator-verified organizational identity, not self-service.
- **A moderator-facing admin/config UI to manage or expand the keyword list.** Confirmed by Gate 3 as not required by any AC/PRD text; `CHILDRENS_DATA_KEYWORDS` (Task 1) is a hardcoded, exported list for this story — "expanding" per the AC's own wording means future code changes to the list, not a runtime-editable config surface.
- **Reclassifying/backfilling any already-stored `events`/`schedules`/`corrections` row against the new keyword filter.** This story only applies the filter to new AI extractions and new correction submissions going forward — no migration or batch job re-processes existing data, matching the "no backfill" framing already established by sibling Stories 3.6h/3.6i.
- **A moderator review queue/page for `awaiting_verification` corrections.** No AC requires one (Tier 2, which would need it, is deferred per AC6); `awaiting_verification` is an audit-trail status value for now, not a queue with a consumer UI.
- **Stories 3.6i (private-contact classification) and 3.6j (performer-contact/photo leakage verification).** Separate, unrelated data-minimization concerns from the same 2026-09-02 correct-course batch, not touched here.
- **Stories 3.6g/3.6h (image-storage opt-in).** A separate consent mechanism for post images, unrelated to this story's text/keyword scope.

## Definition of Done

- [ ] AC1-AC6 satisfied.
- [ ] All required tests passing (`packages/domain` 100% coverage for new functions; `apps/backend` integration tests for matched/unmatched/checkbox cases; `packages/ui`/`apps/web` component tests for the checkbox and new status branch).
- [ ] Lint and type checks passing for `packages/domain`, `apps/backend`, `apps/web`, `packages/ui`.
- [ ] Migration `0045_*.sql` generated via `drizzle-kit generate` (not hand-written) and committed alongside its snapshot.
- [ ] `apps/backend`/`apps/web` codegen regenerated and committed (`resolvers-types.ts`, `apps/web/src/generated/graphql.ts`).
- [ ] No `guardianPermissionConfirmed` field added to `ProposedEventCorrection`/`proposedEventCorrectionSchema`/`ProposedEventCorrectionInput` (per the confirmed scope boundary in Dev Notes) — any diff there should be treated as scope creep and questioned.
- [ ] The AC3 submitter-facing notice is visibly distinct from the generic success toast (not just a copy change buried in the same toast) — reviewed against the actual rendered UI, not just the code diff.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

_To be filled in by the implementing agent._

### Debug Log References

_To be filled in by the implementing agent._

### Completion Notes List

_To be filled in by the implementing agent._

### File List

_To be filled in by the implementing agent._
