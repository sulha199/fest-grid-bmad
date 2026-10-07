---
baseline_commit: 942fb168f9ecaa4fe3d1edc8418b7231e46cfe83
---

# Story 4.10: Add manual link editing to the Correct Data dialog

## Story Details

- Epic: 4
- Story ID: 4.10
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

<!--
Sourced from backlog.yaml's IDEA-036 (carved 2026-09-16 from IDEA-012 §Capture, itself carved via
Story 0.37 which shipped AI-extraction + read-only display of `links: {url, label?}[]` only).
User decision to promote to a story WITH a Gate 2 UX pass made 2026-10-06 (no "next backlog
story" lookup used -- this story targets IDEA-036 specifically, per explicit instruction).
Four design choices confirmed with the user via AskUserQuestion during this story's creation
(see Dev Notes "Design Decisions Confirmed With User"): (1) inline row layout (url+label+remove
side-by-side, stacks on mobile); (2) UI disables "Add link" at the existing MAX_LINKS=10 cap
rather than rejecting at submit; (3) an invalid/non-http(s) URL is rejected with an inline
per-row error (consistent with every other field in this form), not silently dropped like the
AI-extraction path; (4) the new repeatable field stays local to CorrectionForm.tsx, no generic
packages/ui/core primitive extracted (no second consumer exists today). Gate 2 (Freya persona)
run fresh this session for the UX pattern itself; Gate 1/3 not rerun (reasoning below) since the
epic-4 readiness sweep's scope exclusion is immaterial here -- this story introduces no new
external service, data entity, or infra dependency, only threads an already-existing `events.
links` column (migration 0058, Story 0.37) through an existing mutation/form. No DB migration.
-->

## Story

As a user correcting an event's data,
I want to add, edit, and remove the event's extra links (tickets, RSVP, merch, etc.) directly in the "Correct Data" dialog, the same way I can already correct the event name, location, or schedule,
so that I can fix or supplement an event's links myself instead of only ever seeing whatever AI extraction originally found (or nothing, if extraction found none) with no way to correct it.

## Acceptance Criteria

1. **Given** `packages/domain/src/events/types.ts`'s `ProposedEventCorrection` (Story 4.1a's shape),
   **When** this story ships,
   **Then** it gains a new optional `links?: EventLink[]` field (`EventLink` already exists in `@festgrid/shared-types`, unchanged) — additive, every existing caller of this type continues to compile and behave unchanged since the field is optional.
2. **And** `packages/domain/src/events/sanitize-event-links.ts`'s private `isAllowedHttpUrl()` helper (already proven on the AI-extraction path: parses as an absolute URL, restricts to `http:`/`https:` protocol, guarding against `javascript:`/`data:`/malformed values ever reaching a rendered `href`) is exported, and reused directly by both: (a) a new check in `packages/domain/src/events/validate-correction-consistency.ts`'s `validateCorrectionConsistency()` — for each entry in `data.links ?? []`, if its `url` fails `isAllowedHttpUrl`, push `{ field: 'links[${index}].url', message: 'Link URL must be a valid http(s) web address' }` (same field-naming convention as the function's existing `schedules[${index}].x` errors); and (b) the frontend Zod schema (AC8) — a single shared source of truth for "what counts as an acceptable link URL," not two independently-maintained protocol checks.
3. **And** `apps/backend/src/validation/proposed-event-correction.schema.ts` gains a new `proposedEventLinkCorrectionSchema: JSONSchemaType<EventLink>` (`url: { type: 'string', format: 'uri' }` — `ajv-formats` is already registered on this project's shared AJV instance, `apps/backend/src/validation/validate.ts` — plus `label: { type: 'string', nullable: true }`, `required: ['url']`, `additionalProperties: false`), and `proposedEventCorrectionSchema` gains `links: { type: 'array', items: proposedEventLinkCorrectionSchema, maxItems: 10, nullable: true }` (not in `required`, matching this file's existing convention for every other optional field like `organizerName`). AJV's `format: 'uri'` catches a structurally malformed/empty URL early; the http(s)-protocol-specific rejection from AC2(a) runs in the consistency pass immediately after, same two-stage pattern this resolver already uses for every other field.
4. **And** `apps/backend/src/schema/corrections.graphql` gains a new `input EventLinkInput { url: String! label: String }` (mirrors the existing output `type EventLink { url: String! label: String }` in `events.graphql` field-for-field — GraphQL forbids reusing an output type as an input type, same reason Story 4.2a introduced `ProposedEventCorrectionData` instead of reusing `ProposedEventCorrectionInput`), and `ProposedEventCorrectionInput` gains `links: [EventLinkInput!]`.
5. **And** `apps/backend/src/schema/resolvers.ts`'s `submitCorrection` resolver's existing `tx.update(events).set({...})` call (inside the "applied"/`awaiting_verification` branch) gains `links: sanitizeEventLinks(proposedData.links) ?? null,` — reusing the already-tested `sanitizeEventLinks()` pure function (packages/domain) as a final defense-in-depth pass (trims `label`, re-enforces the 10-cap, drops anything that still somehow fails the URL check) immediately before persisting, even though AC2/AC3's validation should already have rejected anything invalid before this point is ever reached. Submitting with no links at all (the user removed every row, or never had any) sends `links: undefined` (the field omitted from the mutation input, matching this form's existing "omit falsy optional fields" convention for `organizerName`/`contactInfo`/`description`) — `sanitizeEventLinks(undefined)` already returns `undefined` per its own documented contract, and `?? null` then clears the column, correctly supporting "clear all links back to none" as a real, reachable outcome of this story (not just add/edit).
6. **And** `packages/domain/src/events/map-extraction-payload-to-proposed-correction.ts` (Story 4.2a's AI-assisted-correction-preview mapper) is extended to also map `links: sanitizeEventLinks(payload.links)` into its returned `ProposedEventCorrection` — today it silently drops `payload.links` even though `GeminiEventPayload.links` has existed since Story 0.37. This closes the second half of this backlog row's explicitly stated scope ("both manual user edits and AI-assisted re-extraction correction previews can carry it") — without this, the "AI-Assisted Correction" extract button inside the Correct Data dialog would never pre-fill links even after AC1-AC5 ship.
7. **And**, for AC6's data to actually reach the client, `apps/backend/src/schema/extraction.graphql`'s `ProposedEventCorrectionData` type (the AI-assisted-correction-preview output type, distinct from `ProposedEventCorrectionInput`) gains `links: [EventLink!]` (reuses the existing output `EventLink` type unchanged), and `apps/web/src/features/events/corrections.graphql`'s `extractEventDataFromUrl` mutation's and `extractionJob` query's `data { ... }` selection sets both add `links { url label }` — mirroring the existing field-for-field selection list in both operations. (Confirmed via tracing the full call path: `manual-extraction-job.ts`'s `getManualExtractionJobStatus()` passes the DB's `resultData` jsonb straight through as `data` with no field-by-field reconstruction, so once the mapper (AC6) and the GraphQL type/selection both carry `links`, the existing polling flow (`ai-assisted-correction-trigger.tsx`, already typed `data: any`/`onExtracted: (data: any) => void`) needs no code change of its own.)
8. **And** `apps/web/src/lib/validation/proposed-event-correction.schema.ts` (the frontend Zod mirror of AC3) gains a `proposedEventLinkCorrectionSchema = z.object({ url: z.string().min(1, {message: "Link URL is required"}).refine(isAllowedHttpUrl, {message: "Link URL must be a valid http(s) web address"}), label: z.string().optional() })` (importing `isAllowedHttpUrl` from `@festgrid/domain/events`, per AC2's single-source-of-truth reuse — `packages/domain` is already imported directly by this exact file's sibling, `correction-dialog.tsx`, for `ProposedEventCorrection`/`ProposedScheduleCorrection`, so this is an established, safe cross-package import, not a new dependency), and `proposedEventCorrectionSchema` gains `links: z.array(proposedEventLinkCorrectionSchema).max(10, { message: "A maximum of 10 links is allowed" }).optional()`. `mapZodIssueToValidationError`'s existing generic array-index path-building (already handles `schedules[0].x`) needs no change — it produces `links[0].url` automatically for a Zod issue at path `['links', 0, 'url']`.
9. **And** `packages/ui/src/features/events/CorrectionForm.tsx`/`.types.ts` gain the new repeatable "Links" field, per Gate 2's (Freya) UX pass, confirmed with the user:
   - A new `<fieldset className="flex flex-col gap-3"><legend className="text-sm font-medium">{labels.linksLabel}</legend>...</fieldset>` section (placed after the Description field, before the schedule-section `<hr>`, since links are event-level metadata like organizer/contact, not schedule-level), seeded from `initialValues.links || []` as local `links: EventLink[]` state (plain `useState`, matching every other field in this file — this is local, single-form-instance UI state, not Server State/URL State/Client Global State in the project's three-tier sense, since it never crosses this component's own boundary; see Dev Notes "State Management Categorization").
   - Each row: an inline layout (`flex flex-col md:flex-row gap-2 md:items-start rounded-md border border-input p-3`) with the url input (`flex-1`, labelled `labels.linkUrlLabel(index + 1)`, id `links-url-${index}`), the label input (`w-full md:w-56`, labelled `labels.linkLabelLabel(index + 1)`, id `links-label-${index}`), and a trailing remove `<button type="button" aria-label={labels.removeLinkLabel(index + 1)}>` rendering lucide-react's `Trash2` icon (`text-muted-foreground hover:text-destructive transition-colors`, `self-end md:self-start md:mt-6 h-10 w-10`) — `labels.linkUrlLabel`/`linkLabelLabel`/`removeLinkLabel` are the three new function-typed (`(index: number) => string`) fields on `CorrectionFormLabels` needed because row count is dynamic (the existing flat-string `labels` shape can't express "Link 1 URL" vs "Link 2 URL" ahead of time); each row's `getFieldError([`links[${index}].url`])` renders inline exactly like every other field's error display.
   - An "Add link" button below the rows (`<Plus className="h-4 w-4" />` + `labels.addLinkButtonLabel`, outline/secondary styling, not full-width), disabled with `aria-disabled` plus `labels.maxLinksReachedLabel` helper text once `links.length === 10` (AC confirmed with user: proactive cap, not reject-at-submit). No distinct empty-state card when zero rows — the Add button itself is the empty state, matching this file's otherwise chrome-free style.
   - Focus management (confirmed with user via Freya's recommendation): after Add, focus moves to the new row's url input; after Remove, focus moves to the url input of the row now occupying that same index (the one that shifted up), or to the previous row's url input if the removed row was last, or to the Add button if the list is now empty.
   - `matchedFields`'s existing static-string-array `isMatchedField()` check is extended with a dynamic regex branch, `/^links\[\d+\]\.(url|label)$/`, alongside the existing `.includes()` check — the only way to recognize a variable-count field name at the per-row level.
   - `handleSubmit` adds `if (links.length > 0) { payload.links = links; }` to the assembled `ProposedEventCorrection`, mirroring the existing `if (organizerName) { payload.organizerName = organizerName; }`-style omit-when-empty convention (AC5 depends on this to correctly send "no links" as an omitted field, not `[]`).
10. **And** `apps/web/src/features/events/correction-dialog.tsx` is extended: the `CorrectionDialogProps.event` interface gains `links?: { url: string; label?: string | null }[] | null` (the `getEventBySlug` query, `apps/web/src/features/events/queries.graphql`, already selects `links { url label }` — confirmed already present, Story 0.37 — so no query change needed here, only the TS interface and the mapping); `eventInitialValues` gains `links: event.links?.map((l) => ({ url: l.url, label: l.label ?? undefined })) ?? []`; `handleSubmit`'s assembled `proposedData` gains `links: data.links && data.links.length > 0 ? data.links : undefined`; and both the "applied" and "awaiting_verification" `queryClient.setQueriesData` cache-patch blocks (which already rewrite `eventName`/`organizerName`/etc. on the cached `eventBySlug` object) gain `links: proposedData.links ?? null,` so the event detail view's cached data reflects the new links immediately without a refetch, consistent with every other field this dialog already patches on success.
11. **And** both `apps/web/locales/en.json` and `apps/web/locales/id.json` gain matching new keys under the existing `EventCorrectionForm` namespace (added to both files in the same change, per the locale-parity ratchet, Story 0.50): `linksLabel`, `linkUrlLabel` (ICU `{number}` placeholder, e.g. `"Link {number} URL"`), `linkLabelLabel` (`"Link {number} label (optional)"`), `removeLinkLabel` (`"Remove link {number}"`), `addLinkButtonLabel` (`"Add link"`), `maxLinksReachedLabel` (`"Maximum of 10 links reached"`), and `invalidLinkUrlError` (`"Link URL must be a valid web address"`) — the last one is added for naming-convention parity with this namespace's existing `requiredFieldError`/`endDateBeforeStartDateError`/`endTimeBeforeStartTimeError` keys, which this file confirms (grepped) are themselves never actually read via `t()` anywhere in the codebase today; Zod/AJV validation messages are rendered as the literal hardcoded English string already present on the `validationErrors` array, not translated, for every field including this one — a pre-existing gap across the whole form, not something this story introduces or is in scope to fix (see Dev Notes).
12. **And** `pnpm --filter backend codegen` and `pnpm --filter web codegen` are both re-run after the schema/query changes (AC3, AC4, AC7), and their diffs are limited to the new mutation-input/output-type/field additions (no unrelated regeneration noise beyond what codegen always touches in `resolvers-types.ts`/`apps/web/src/generated/graphql.ts`/`apps/web/src/gql/graphql.ts`).

## Tasks / Subtasks

- [ ] Task 1: packages/domain — thread `links` through the shared type and validators (AC1, AC2, AC6)
  - [ ] 1.1 Add `links?: EventLink[];` to `ProposedEventCorrection` in `types.ts`.
  - [ ] 1.2 Export `isAllowedHttpUrl` from `sanitize-event-links.ts` (change `function` → `export function`; no behavior change).
  - [ ] 1.3 In `validate-correction-consistency.ts`, import `isAllowedHttpUrl` and add a `data.links ?? []` loop pushing `{ field: `links[${index}].url`, message: 'Link URL must be a valid http(s) web address' }` for any entry whose `url` fails the check.
  - [ ] 1.4 In `map-extraction-payload-to-proposed-correction.ts`, import `sanitizeEventLinks` and add `links: sanitizeEventLinks(payload.links),` to the returned object.
  - [ ] 1.5 Extend `validate-correction-consistency.test.ts` with cases: a valid `https://` link produces no error; an invalid-protocol (`javascript:`/`ftp://`) or malformed link produces the `links[0].url` error; multiple link errors each get their own indexed field.
  - [ ] 1.6 Extend `map-extraction-payload-to-proposed-correction.test.ts` with a case asserting `payload.links` is sanitized and mapped onto the result's `links`.
- [ ] Task 2: apps/backend — AJV schema, GraphQL schema, and resolver persistence (AC3, AC4, AC5, AC7)
  - [ ] 2.1 Add `proposedEventLinkCorrectionSchema` and extend `proposedEventCorrectionSchema` with `links` in `proposed-event-correction.schema.ts`.
  - [ ] 2.2 Add `input EventLinkInput` and extend `ProposedEventCorrectionInput` in `corrections.graphql`.
  - [ ] 2.3 Add `links: [EventLink!]` to `ProposedEventCorrectionData` in `extraction.graphql`.
  - [ ] 2.4 In `resolvers.ts`, import `sanitizeEventLinks` from `@festgrid/domain/events` (alongside the existing `validateCorrectionConsistency`/etc. import) and add `links: sanitizeEventLinks(proposedData.links) ?? null,` to the `submitCorrection` resolver's `tx.update(events).set({...})` call.
  - [ ] 2.5 Run `pnpm --filter backend codegen`; confirm the diff to `apps/backend/src/generated/resolvers-types.ts` is limited to the new input/output type fields (AC12).
- [ ] Task 3: apps/web — Zod schema, dialog wiring, and extraction-preview query (AC8, AC10, AC7)
  - [ ] 3.1 Add `proposedEventLinkCorrectionSchema` (importing `isAllowedHttpUrl` from `@festgrid/domain/events`) and extend `proposedEventCorrectionSchema` with `links` in `apps/web/src/lib/validation/proposed-event-correction.schema.ts`.
  - [ ] 3.2 In `correction-dialog.tsx`: extend the `event` prop interface with `links`; extend `eventInitialValues` with the `links` mapping; extend `handleSubmit`'s `proposedData` with `links`; extend both cache-patch blocks (`applied`, `awaiting_verification`) with `links: proposedData.links ?? null,`; extend the `labels` object with the seven new `t(...)`/fallback-string entries from AC11 (plain strings for `linksLabel`/`addLinkButtonLabel`/`maxLinksReachedLabel`, and three small `(n: number) => t("linkUrlLabel", { number: n }) || `Link ${n} URL`` -style function wrappers for `linkUrlLabel`/`linkLabelLabel`/`removeLinkLabel`).
  - [ ] 3.3 In `apps/web/src/features/events/corrections.graphql`, add `links { url label }` to both the `extractEventDataFromUrl` mutation's and `extractionJob` query's `data { ... }` selection sets.
  - [ ] 3.4 Run `pnpm --filter web codegen`; confirm the diff to `apps/web/src/generated/graphql.ts`/`apps/web/src/gql/graphql.ts` is limited to these additions (AC12).
- [ ] Task 4: packages/ui — the repeatable Links field in `CorrectionForm` (AC9)
  - [ ] 4.1 Add the three function-typed labels (`linkUrlLabel`, `linkLabelLabel`, `removeLinkLabel`) plus three string labels (`linksLabel`, `addLinkButtonLabel`, `maxLinksReachedLabel`) to `CorrectionFormLabels` in `CorrectionForm.types.ts`.
  - [ ] 4.2 In `CorrectionForm.tsx`: add `links` local state seeded from `initialValues.links || []`; implement add-row (append `{ url: "", label: "" }`, focus the new row's url input, disabled once `links.length === 10`), remove-row (splice at index, move focus per AC9's rule), and per-row url/label change handlers; render the new `<fieldset>` section per AC9's layout; extend `isMatchedField`'s check with the `links[\d+].(url|label)` regex; add the `if (links.length > 0) { payload.links = links; }` line to `handleSubmit`.
  - [ ] 4.3 Add `lucide-react`'s `Plus` and `Trash2` imports (already a `packages/ui` dependency — confirmed via `platform-icon.tsx`'s existing `lucide-react` import; no `pnpm install` needed).
- [ ] Task 5: Tests (AC1-AC11)
  - [ ] 5.1 packages/domain: Task 1.5, 1.6's new test cases (`pnpm --filter @festgrid/domain test` — 100% coverage rule applies to all new branches).
  - [ ] 5.2 apps/backend: extend `corrections.test.ts` with cases — `submitCorrection` persists a valid `links` array; rejects an invalid-protocol link URL with a `links[0].url` validation error (status `rejected`, no DB write); accepts and sanitizes (trims label) a link on persist; submitting with no `links` field clears a previously-set `links` column back to `null`.
  - [ ] 5.3 packages/ui: extend `CorrectionForm.test.tsx` with cases — pre-fills existing `initialValues.links` as rows; "Add link" appends a row and moves focus to its url input; removing a row moves focus per AC9's rule (cover at least: removing a non-last row, and removing the last remaining row); "Add link" becomes disabled at 10 rows; a `links[0].url` validation error renders inline next to that row's url field; submitting with zero link rows omits `links` from the submitted payload (not `[]`).
  - [ ] 5.4 apps/web: extend `correction-dialog.test.tsx` with a case asserting `links` round-trips through `handleSubmit`'s built `proposedData` and the "applied"-path cache patch; extend `ai-assisted-correction-trigger.test.tsx` only if its existing mocked response fixture needs a `links` field added for type-shape parity (no behavior change expected there).
- [ ] Task 6: Verification pass (all ACs)
  - [ ] 6.1 `pnpm --filter @festgrid/domain test` and `pnpm --filter @festgrid/domain lint` (scoped, foreground).
  - [ ] 6.2 `pnpm --filter backend test` and `pnpm --filter backend lint` (scoped, foreground).
  - [ ] 6.3 `pnpm --filter @festgrid/ui test` and `pnpm --filter @festgrid/ui lint` (scoped, foreground).
  - [ ] 6.4 `pnpm --filter web test` and `pnpm --filter web lint` (scoped, foreground).
  - [ ] 6.5 Confirm `pnpm-lock.yaml` is unchanged (no new dependency added by this story).

## Dev Notes

- **Design Decisions Confirmed With User (2026-10-06, during story creation via `AskUserQuestion`, following Gate 2's Freya-persona UX pass):**
  1. **Row layout:** inline (url + label + remove button side-by-side, stacking vertically only below `md:`) over a stacked-per-field block — more compact and scannable for a list that can grow to 10 rows, and consistent with this file's existing `grid-cols-1 md:grid-cols-2` paired-field rhythm.
  2. **Cap enforcement:** the UI disables "Add link" once 10 rows are reached (reusing `sanitizeEventLinks`'s existing `MAX_LINKS` constant conceptually, not reject-at-submit) — the user can never get into an over-the-cap state, with helper text explaining why once reached.
  3. **Invalid-URL handling:** reject with an inline per-row error (AC2, AC3, AC8), consistent with how every other field in this exact form already behaves — not silently sanitize/drop like the AI-extraction path, which has no human in the loop to notice or fix a dropped link. The backend resolver (AC5) still runs `sanitizeEventLinks()` as a final defense-in-depth pass immediately before persisting, but nothing invalid should ever reach it, since validation already rejected it earlier in the request.
  4. **Reusable primitive vs. local:** keep the new repeatable-field implementation local to `CorrectionForm.tsx` (AC9) — no second array-of-objects form field exists anywhere in this codebase today, and the row shape (url+label, capped at 10, URL-specific validation) is event-link-specific enough that extracting a generic `packages/ui/core` primitive now would mean guessing a render-prop/slot API from one real shape. Revisit if/when a second such field appears, generalizing from two real cases instead of one speculative one.
- **Why this needed a fresh Gate 2 pass at all:** confirmed by grep across `packages/ui/src` and `apps/web/src` during this story's creation — no repeatable/array-of-objects controlled form field exists anywhere in the app. The closest precedent, `EmbedDomainsDialog.tsx` (a list of domain-pattern strings with per-item "Remove" buttons), is a *server-backed* list — each add/remove fires its own mutation immediately — structurally different from this field, which is a purely local, in-form array edited before one combined `onSubmit` call (same submit model as every other field in `CorrectionForm`). `MultiSelect` (the file's other reusable input) is a flat string-tag picker, not an array of multi-field objects. EXPERIENCE.md's Accessibility Floor section is explicitly scoped only to global navigation today (confirmed by reading it in full), so this story's ARIA/keyboard/focus-management design (AC9's `fieldset`/`legend` grouping, per-row accessible names via visible `<label>` text rather than bare `aria-label`, and the focus-after-add/-remove rules) establishes new precedent grounded in WAI-ARIA Authoring Practices for a dynamic/editable list of grouped inputs, not an existing documented pattern it could cite.
- **No DB migration (explicitly checked, per this story's own instructions, before concluding one wasn't needed):** `events.links` (`jsonb('links').$type<EventLink[]>()`) already exists — added by migration `0058_nice_liz_osborn.sql`, Story 0.37, which shipped AI-extraction + read-only display threading only. The latest migration in this repo as of this story's creation is `0075`; this story adds none, since it only threads an already-existing, already-nullable column through a write path (`submitCorrection`) that previously never touched it. Confirmed before writing this story, not asked to the user, since the answer is unambiguously "no migration" — nothing here changes a table shape.
- **State Management Categorization:** the new `links` array lives in `CorrectionForm`'s own local `useState`, exactly like every other field already in this component (`eventName`, `organizerName`, the schedule fields, etc.). It is none of this project's three named state tiers — not Server State (not cached/fetched via React Query; the whole form is a local draft until one `onSubmit`), not URL State, and not Client Global State (`zustand` is reserved for state crossing component boundaries; this never leaves the single mounted `CorrectionForm` instance, remounted fresh via `correction-dialog.tsx`'s existing `formKey` increment on every dialog open). This matches the pre-existing, unchanged categorization of every other field in this file — no new state-management pattern is introduced.
- **Asynchronous Process / Loader Categorization:** unchanged from today — `submitCorrection` remains a single mutation covered by `correction-dialog.tsx`'s existing `BlockingLoader active={isPending}` (Blocking, per project-context.md's "critical mutations" rule). Adding one more optional field to the same existing mutation introduces no new async process and needs no new loader treatment.
- **Pre-existing i18n gap, confirmed not in this story's scope to fix:** every one of this namespace's (`EventCorrectionForm`) existing validation-message locale keys (`requiredFieldError`, `endDateBeforeStartDateError`, `endTimeBeforeStartTimeError`) is present in both locale files but never actually read via `t()` anywhere in the codebase (confirmed by grep) — Zod/AJV `validationErrors[].message` strings are rendered as literal hardcoded English text directly, for every field, regardless of active locale. AC11's new `invalidLinkUrlError` key is added for naming-convention parity with this existing (if currently unused) pattern, not because this story fixes the underlying gap — doing so would mean rearchitecting how `validationErrors` messages flow from Zod/AJV into the UI for the whole form, well beyond this backlog row's stated scope (link editing specifically).
- **Full-replace semantics, not merge:** like every other field `CorrectionForm` edits, submitting the form sends the complete resulting `links` array (or omits the key entirely if empty) — there is no partial "only patch the links I touched" behavior, matching how `eventName`/`organizerName`/etc. already work on this exact mutation. A user who opens the dialog, adds one link, and submits sends back *all* of the event's links (pre-existing ones, unedited, plus the new one) — not a diff.

### Architecture & UX Gate Findings

- Epic 4's readiness report (`_bmad-output/planning-artifacts/epic-readiness/epic-4-readiness.md`, `swept: true`, dated 2026-08-11) covers only Stories 4.1a-4.8 and predates this backlog row (IDEA-036 carved 2026-09-16). Per the lightweight escape-hatch guard: this story introduces **no new external service, no new data entity, and no new infra/queue/EventBridge dependency** — it threads an already-existing `events.links` column (added by Story 0.37, migration 0058) through an already-existing mutation (`submitCorrection`) and an already-existing form component (`CorrectionForm`, Story 4.1b), reusing an already-existing, already-tested sanitizer (`sanitizeEventLinks`). Nothing here is the shape of thing the sweep's Gate 1/3 scope (backend/API-layer completeness, cross-cutting foundational dependencies) exists to catch that a mechanical field-threading change like this one would trip. **Gate 1 and Gate 3 were therefore not rerun fresh** — only Gate 2 (always run fresh per the workflow, and explicitly called for by this backlog row's own capture note) was dispatched this session.
- **Gate 2 (UI Complexity & Reusability, Freya lens, run fresh): design delivered, no split required.** Full design (reproduced into AC9 and the Design Decisions above): inline row layout; `fieldset`/`legend` grouping with visible per-row `<label>` text (not bare `aria-label`) for "Link N URL"/"Link N label"; `Plus`/`Trash2` icons (not `X`, which would misread as transient dismissal rather than deleting a data row); decisive focus-management rules for add/remove; and a clear "keep local, don't extract a generic primitive" recommendation (no second consumer exists today; the row shape is specific enough that a speculative generic `RepeatableFieldGroup<T>` would need to guess at an API from one real case). All four of Freya's flagged real tradeoffs (row layout, cap-enforcement timing, invalid-URL handling, and the reusable-primitive question) were confirmed with the user via `AskUserQuestion` rather than silently decided — see Design Decisions above. No UI complexity found that warrants splitting this into a prerequisite story; the new field is additive to one existing component, not a new page/flow.

### Data Type Compatibility & Migration Requirements

- Compatibility finding: **No DB migration required.** `events.links` (`jsonb('links').$type<EventLink[]>()`, nullable) already exists — added by migration `0058_nice_liz_osborn.sql` (Story 0.37). This story is pure threading: it makes an already-existing, already-correctly-typed column reachable from a write path (`submitCorrection`) that previously never set it, and from a second read/preview path (the AI-assisted-correction extraction preview, AC6-AC7) that previously silently dropped it.
- Impacted fields/contracts: `ProposedEventCorrection.links` (packages/domain, new optional field); `ProposedEventCorrectionInput.links`/new `EventLinkInput` (backend GraphQL input, AC4); `ProposedEventCorrectionData.links` (backend GraphQL output, AC7, reuses the existing `EventLink` output type); the backend AJV schema and frontend Zod schema (AC3, AC8, both new but structurally mirrored); `CorrectionFormLabels` (packages/ui, three new string + three new function-typed fields, AC9); `CorrectionDialogProps.event` (apps/web, new optional field, AC10).
- Required DB migration changes: None.
- Required TypeScript type changes: `ProposedEventCorrection.links?: EventLink[]` (packages/domain) — additive, optional, non-breaking for every existing caller (Story 4.1's manual-entry path, Story 4.2's AI-assisted path, and this story's own new UI). No change to any Drizzle-inferred type, since `events.links`'s Drizzle column type (`EventLink[]`, via `$type<>()`) is unchanged — only the write path that populates it (`submitCorrection`'s resolver) and a second mapper (`map-extraction-payload-to-proposed-correction.ts`) are extended to actually set it.
- Backward compatibility and rollout notes: Fully additive end to end. Every existing caller of `ProposedEventCorrection`, `ProposedEventCorrectionInput`, `ProposedEventCorrectionData`, `CorrectionFormLabels`, and `CorrectionDialogProps` continues to compile and behave unchanged (all new fields are optional, and `CorrectionForm`'s new "Links" section renders an empty list — just the Add button — when `initialValues.links` is absent, which is the exact state every event created before this story ships will be in). No existing GraphQL operation's response shape changes except by field addition.
- Verification checks: Task 5's new/extended tests (packages/domain unit tests for the new consistency check and mapper behavior; backend integration tests for persist/reject/sanitize/clear; packages/ui tests for the new field's rendering, add/remove/focus/cap behavior, and inline error display; apps/web test for the dialog's round-trip wiring) plus Task 6's scoped lint/type/test passes across `@festgrid/domain`, `backend`, `@festgrid/ui`, and `web` prove end-to-end alignment.

### Project Structure Notes

- `packages/domain` changes confined to `src/events/types.ts`, `sanitize-event-links.ts` (export change only), `validate-correction-consistency.ts`, and `map-extraction-payload-to-proposed-correction.ts` — no new files, same existing `/events` sub-folder every one of these already lives in.
- `apps/backend` changes confined to `src/validation/proposed-event-correction.schema.ts`, `src/schema/corrections.graphql`, `src/schema/extraction.graphql`, and `src/schema/resolvers.ts` (one new line in the existing `submitCorrection` resolver, alongside its sibling field-sets) — matches this project's existing one-resource-per-`.graphql`-file, flat-resolvers-map convention. No new files.
- `apps/web` changes confined to `src/lib/validation/proposed-event-correction.schema.ts`, `src/features/events/correction-dialog.tsx`, and `src/features/events/corrections.graphql` — no new files.
- `packages/ui` changes confined to `src/features/events/CorrectionForm.tsx`/`.types.ts`/`.test.tsx` — no new file, same existing `features/events/` placement (this story was explicitly evaluated for whether the new field should be promoted to `packages/ui/src/core/` as a generic primitive — see Gate 2 Findings above — and the answer is no, so it stays exactly where `CorrectionForm` itself already lives).
- No conflict with established structure conventions anywhere in this story's scope.

### References

- [Source: _bmad-output/implementation-artifacts/backlog/IDEA-036-correct-data-dialog-link-editing.md] — the backlog row this story promotes in full; its explicit "Needs a UX pass (Gate 2, Freya)" instruction and its explicit inclusion of the AI-assisted re-extraction preview path in scope (AC6, AC7) both come directly from this row's own capture text.
- [Source: _bmad-output/implementation-artifacts/0-37-extract-and-display-event-links.md] — the story that added `events.links` (migration 0058) and the AI-extraction half of `links` handling (`sanitizeEventLinks`, `GeminiEventPayload.links`, `EventInsertValues.links`) this story builds on without modifying.
- [Source: packages/domain/src/events/sanitize-event-links.ts,.test.ts] — existing pure sanitizer this story exports from (`isAllowedHttpUrl`) and reuses directly (resolver's defense-in-depth pass, AC5) and indirectly (mapper fix, AC6).
- [Source: packages/domain/src/events/validate-correction-consistency.ts,.test.ts, types.ts] — existing consistency-check function and `ProposedEventCorrection`/`ProposedScheduleCorrection` shapes this story extends.
- [Source: packages/domain/src/events/map-extraction-payload-to-proposed-correction.ts,.test.ts] — Story 4.2a's mapper, found (during this story's own "read every file being modified" pass) to already silently drop `payload.links`; fixed here (AC6).
- [Source: apps/backend/src/validation/proposed-event-correction.schema.ts, validate.ts] — existing AJV schema and the shared, `ajv-formats`-registered AJV instance this story's new schema reuses.
- [Source: apps/backend/src/schema/corrections.graphql, extraction.graphql, resolvers.ts#submitCorrection] — existing GraphQL types/resolver this story extends.
- [Source: apps/backend/src/lib/extraction/manual-extraction-job.ts#getManualExtractionJobStatus, apps/backend/src/lib/ai-processor/process-manual-extraction-job.ts] — traced during this story's creation to confirm the AI-assisted-preview `resultData` jsonb passthrough needs no resolver code change once the mapper (AC6) and GraphQL type/selection (AC7) both carry `links`.
- [Source: apps/web/src/lib/validation/proposed-event-correction.schema.ts] — existing frontend Zod mirror this story extends.
- [Source: apps/web/src/features/events/correction-dialog.tsx,.test.tsx, CorrectionForm.tsx,.types.ts,.test.tsx (packages/ui), ai-assisted-correction-trigger.tsx,.test.tsx, queries.graphql, corrections.graphql, mapper.ts] — existing files this story extends or whose existing behavior it was confirmed not to disturb (`mapper.ts` already maps `event.links` for the `getEventBySlug` query; `queries.graphql` already selects it; neither needs a change).
- [Source: apps/web/src/components/widgets/EmbedDomainsDialog.tsx] — closest (but structurally different, server-backed-list) existing precedent considered and distinguished during Gate 2's UX pass.
- [Source: design-artifacts/UX-festgrid-run-1/DESIGN.md, EXPERIENCE.md] — confirmed (full read, both files) to carry no existing token or documented pattern for a repeatable/array-of-objects form field, and that the Accessibility Floor section is explicitly scoped to global navigation only today — this story's new ARIA/keyboard/focus-management design establishes new precedent, not a cited existing one.
- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.1a, 4.1b, 4.1, 4.2a, 4.2] — originating `CorrectionForm`/`submitCorrection`/AI-assisted-correction stories this one extends.
- [Source: apps/web/locales/en.json, id.json#EventCorrectionForm] — existing namespace this story's new keys are added to; also where this story confirmed (grep) that this namespace's existing validation-message keys are already unused dead keys, a pre-existing gap this story doesn't fix.
- [Source: _bmad-output/project-context.md] — Runtime Schema Validation (Zod frontend / AJV backend at every entry point), Code Organization (packages/domain reuse), State Management Architecture (this story's categorization), UI Patterns (Blocking loader, unchanged).
- [Source: _bmad-output/planning-artifacts/story-split-gate.md] — Gate 1/2/3 definitions; Gate 2 executed fresh, Gate 1/3 reasoned not to be needed fresh (see Architecture & UX Gate Findings above).
- [Source: _bmad-output/planning-artifacts/story-content-structure.md] — canonical section order and status vocabulary this file follows.

## Global Rules References

- [x] `_bmad-output/project-context.md` — Runtime Schema Validation (Zod frontend/AJV backend, both extended with the new `links` shape, AC3/AC8), Code Organization (packages/domain reuse of `isAllowedHttpUrl`/`sanitizeEventLinks`, no DB/ORM-coupled dependency introduced), UI Components placement (`CorrectionForm` stays in `packages/ui/src/features/events/`, not promoted to `core/`), State Management (local `useState`, categorized in Dev Notes), i18n (next-intl, both locale files, AC11), UI Patterns (Blocking loader unchanged).
- [x] `_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md` — §3.9.1/§3.9.3 (manual correction system, FR38-FR40) and §3.1 (the original `links` extraction requirement this story's correction-path counterpart extends).
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — this file's section order/status vocabulary.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — no AD specifically governs this story's scope (confirmed: not a DB-schema-shape decision, not an AD-17/AD-18-style query/filter mechanism, not a soft-delete/moderator-override case); it follows Story 4.1a/4.1b/4.2a's own established patterns directly.
- [x] `docs/infrastructure/index.md` — not applicable; no backend compute/queue/EventBridge/API Gateway/DB-provisioning change, confirmed via the index summary (frontend + an existing GraphQL mutation/schema extension only).

## Implementation Plan (Rule-Compliant)

### File Change Plan

- `packages/domain/src/events/types.ts` — add `ProposedEventCorrection.links?: EventLink[]` (Task 1.1).
- `packages/domain/src/events/sanitize-event-links.ts` — export `isAllowedHttpUrl` (Task 1.2).
- `packages/domain/src/events/validate-correction-consistency.ts` — add the links URL-protocol check (Task 1.3).
- `packages/domain/src/events/map-extraction-payload-to-proposed-correction.ts` — map `links` (Task 1.4).
- `packages/domain/src/events/validate-correction-consistency.test.ts` — new cases (Task 1.5).
- `packages/domain/src/events/map-extraction-payload-to-proposed-correction.test.ts` — new case (Task 1.6).
- `apps/backend/src/validation/proposed-event-correction.schema.ts` — new link schema + `links` field (Task 2.1).
- `apps/backend/src/schema/corrections.graphql` — `EventLinkInput`, `ProposedEventCorrectionInput.links` (Task 2.2).
- `apps/backend/src/schema/extraction.graphql` — `ProposedEventCorrectionData.links` (Task 2.3).
- `apps/backend/src/schema/resolvers.ts` — `submitCorrection`'s event update gains `links` (Task 2.4).
- `apps/backend/src/generated/resolvers-types.ts` — regenerated (Task 2.5).
- `apps/backend/src/schema/corrections.test.ts` — new cases (Task 5.2).
- `apps/web/src/lib/validation/proposed-event-correction.schema.ts` — new link schema + `links` field (Task 3.1).
- `apps/web/src/features/events/correction-dialog.tsx` — `event` prop, `eventInitialValues`, `handleSubmit`, cache patches, `labels` (Task 3.2).
- `apps/web/src/features/events/corrections.graphql` — `links { url label }` on both extraction operations (Task 3.3).
- `apps/web/src/generated/graphql.ts`, `apps/web/src/gql/graphql.ts` — regenerated (Task 3.4).
- `apps/web/src/features/events/correction-dialog.test.tsx` — new case (Task 5.4).
- `apps/web/src/features/events/ai-assisted-correction-trigger.test.tsx` — fixture update only if needed (Task 5.4).
- `packages/ui/src/features/events/CorrectionForm.types.ts` — new label fields (Task 4.1).
- `packages/ui/src/features/events/CorrectionForm.tsx` — new Links field, state, handlers, submit wiring (Task 4.2, 4.3).
- `packages/ui/src/features/events/CorrectionForm.test.tsx` — new cases (Task 5.3).
- `apps/web/locales/en.json`, `apps/web/locales/id.json` — new `EventCorrectionForm` keys (AC11).

### Rule Mapping

- AC1 → Task 1.1.
- AC2 → Task 1.2, 1.3, 3.1 (shared `isAllowedHttpUrl` reuse, frontend+backend).
- AC3 → Task 2.1.
- AC4 → Task 2.2.
- AC5 → Task 2.4.
- AC6 → Task 1.4.
- AC7 → Task 2.3, 3.3.
- AC8 → Task 3.1.
- AC9 → Task 4.1, 4.2, 4.3.
- AC10 → Task 3.2.
- AC11 → locale key additions (AC11 itself, no separate numbered task — folded into Task 3.2's `labels` object plus the two locale files).
- AC12 → Task 2.5, 3.4.

### Verification Plan

- `pnpm --filter @festgrid/domain test` → new consistency-check and mapper test cases green, 100%-coverage rule holds for the new branches (AC1, AC2, AC6, Task 1.5, 1.6).
- `pnpm --filter @festgrid/domain lint` → clean.
- `pnpm --filter backend test` → new `corrections.test.ts` cases green (persist, reject, sanitize, clear) (AC3, AC4, AC5, Task 5.2).
- `pnpm --filter backend lint` → clean.
- `pnpm --filter @festgrid/ui test` → `CorrectionForm.test.tsx` new + existing cases green (AC9, Task 5.3).
- `pnpm --filter @festgrid/ui lint` → clean.
- `pnpm --filter web test` → `correction-dialog.test.tsx` new + existing cases green (AC8, AC10, Task 5.4).
- `pnpm --filter web lint` → clean.
- `git diff pnpm-lock.yaml` → empty (no new dependency; Task 6.5).
- All run in the foreground, package-scoped (`--filter @festgrid/domain`/`--filter backend`/`--filter @festgrid/ui`/`--filter web`), never a bare repo-wide `pnpm install`/`pnpm test`/`pnpm lint`.

## Pre-Coding Approval Gate

- [ ] Scope confirmation — thread `links` through `ProposedEventCorrection`/AJV/Zod/GraphQL/`submitCorrection` (manual path) and `map-extraction-payload-to-proposed-correction`/`ProposedEventCorrectionData` (AI-assisted-preview path), plus the new repeatable Links field in `CorrectionForm.tsx`; no change to `EventDetailView`'s read-only display (still out of scope, matching the backlog row's own stated boundary) and no DB migration.
- [ ] Architecture and boundary confirmation — Gate 2 (Freya) run fresh this session, design delivered (AC9), no split required; Gate 1/3 reasoned not needed fresh (no new external service/data entity/infra dependency — see Architecture & UX Gate Findings).
- [ ] Testing plan confirmation — packages/domain unit tests (new consistency-check + mapper branches), backend integration tests (persist/reject/sanitize/clear), packages/ui tests (field rendering, add/remove/focus/cap, inline error), apps/web test (dialog round-trip) — per Task 5.
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted — N/A, no gap found by Gate 2 (design delivered inline, no split); Gate 1/3 not rerun per the reasoning above, no prerequisite story/backlog entry required.

## Testing Requirements

- [ ] Unit tests: `packages/domain/src/events/validate-correction-consistency.test.ts`, `map-extraction-payload-to-proposed-correction.test.ts` — new cases per Task 1.5, 1.6 (100%-coverage rule).
- [ ] Integration tests: `apps/backend/src/schema/corrections.test.ts` — persist/reject/sanitize/clear cases per Task 5.2.
- [ ] Component/unit tests: `packages/ui/src/features/events/CorrectionForm.test.tsx` new cases (Task 5.3); `apps/web/src/features/events/correction-dialog.test.tsx` new case (Task 5.4).
- [ ] E2E: not required — this story's interactions are fully covered by the component/integration-level tests above, consistent with this exact form/dialog's existing test scope (no E2E layer exists for `CorrectionForm`/`CorrectionDialog` today, and this story isn't introducing one).

## Deliverables Checklist

- [ ] `ProposedEventCorrection.links?: EventLink[]` added; `isAllowedHttpUrl` exported and reused by both the backend consistency check and the frontend Zod schema.
- [ ] `map-extraction-payload-to-proposed-correction.ts` maps `links` (closing the AI-assisted-preview half of this backlog row's scope).
- [ ] Backend AJV schema, `corrections.graphql`'s `EventLinkInput`/`ProposedEventCorrectionInput.links`, and `extraction.graphql`'s `ProposedEventCorrectionData.links` all added; `submitCorrection` persists `links` via `sanitizeEventLinks(...) ?? null`.
- [ ] Frontend Zod schema mirrors the backend's link validation; `corrections.graphql`'s two extraction operations select `links { url label }`.
- [ ] `CorrectionForm` renders the new repeatable "Links" field per AC9 (inline rows, 10-row cap with disabled Add, inline per-row errors, add/remove focus management) — entirely local, no new `packages/ui/core` primitive.
- [ ] `correction-dialog.tsx` seeds, submits, and cache-patches `links` end to end.
- [ ] `en.json`/`id.json` both carry the seven new `EventCorrectionForm` keys.
- [ ] Backend/frontend codegen re-run, diffs limited to the new additions.
- [ ] All new/extended tests green; scoped lint/test clean across `@festgrid/domain`, `backend`, `@festgrid/ui`, `web`.

## Out of Scope

- Any read-only rendering of `event.links` in `EventDetailView` or anywhere else in the public-facing UI — Story 0.37 already maps `event.links` through `mapper.ts` and `queries.graphql` already selects it, but nothing renders it today, and this backlog row's own stated scope is the correction/edit path only, not display. Left untouched.
- Editing/adding non-main schedules, or anything schedule-level — unaffected; `links` is purely event-level, same tier as `organizerName`/`contactInfo`/`description`.
- A generic, reusable `packages/ui/core` array-of-objects form-field primitive — user-confirmed out of scope (Design Decision 4 above); revisit only if/when a second real consumer appears.
- Fixing the pre-existing, unrelated gap where this form's validation-message locale keys are never actually read via `t()` (every field, not just links) — flagged in Dev Notes, deliberately not fixed here; would require rearchitecting how `validationErrors[].message` flows into the UI, well beyond this backlog row.
- No Gate 2 split was found, and Gate 1/3 were not rerun fresh (reasoned unnecessary — see Architecture & UX Gate Findings), so no prerequisite story/backlog entry/additional `epics.md` story beyond this one was required.

## Definition of Done

- [ ] All Acceptance Criteria (1-12) satisfied.
- [ ] `pnpm --filter @festgrid/domain test` and `pnpm --filter @festgrid/domain lint` pass.
- [ ] `pnpm --filter backend test` and `pnpm --filter backend lint` pass.
- [ ] `pnpm --filter @festgrid/ui test` and `pnpm --filter @festgrid/ui lint` pass.
- [ ] `pnpm --filter web test` and `pnpm --filter web lint` pass.
- [ ] `pnpm-lock.yaml` unchanged.
- [ ] Both `en.json`/`id.json` carry matching new keys (locale-parity ratchet, Story 0.50, stays green).

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
