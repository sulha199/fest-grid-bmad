---
baseline_commit: 95347c68995121d35cf913d2e00a3e1997045fd9
---

# Story 4.2: AI-assisted event data correction

## Story Details

- **Epic:** 4
- **Story ID:** 4.2
- **Status:** ready-for-dev

## Story

**As a** user with a BYOK key,
**I want** the system to be able to automatically extract corrected event information from a URL I provide,
**So that** I can more easily correct event data.

## Acceptance Criteria

1. **Given** I am correcting the data for an event (Story 4.1's correction dialog, Story 4.1b's `CorrectionForm`), **when** the dialog opens, **then** an "AI-Assisted Correction" button renders in `CorrectionForm`'s `headerActions` slot (Story 4.1b) — matching UX scenario 06.6's on-page interaction sequence exactly.
2. **And**, when I click "AI-Assisted Correction", **then** a URL text input and an "Extract" button appear beneath it (revealed in place, no new dialog/route).
3. **Given** I have provided my own Gemini API Key (BYOK) (Story 3.1b), **when** I paste a URL to a social media post and click "Extract", **then** the system calls the `extractEventDataFromUrl(url: String!)` mutation (Story 4.2a) — never a raw Gemini SDK/HTTP call, and never a direct scraper call, from `apps/web` — while a non-blocking, localized loading indicator ("Extracting…") shows within this panel only (Dev Notes "Loader Categorization"); the Extract button and URL input are disabled while in flight.
4. **And**, if the mutation returns `data` (a successful extraction), **then** the correction form's current field values are overwritten with the extracted fields, **except** the main schedule's `id` is preserved from the form's pre-extraction values, so approving the pre-fill still updates the event's existing main schedule row rather than inserting a duplicate one (Story 4.1a's `id`-present-means-update reconciliation; Dev Notes "Schedule ID Preservation").
5. **And**, if the mutation returns an `errorCode` instead of `data`, **then** an inline error message specific to that code is shown within this same panel (not a toast, not blocking the rest of the form) — `NOT_FOUND`/`SCRAPE_FAILED`/`UNSUPPORTED_PLATFORM`/`EXTRACTION_FAILED`/`QUOTA_EXHAUSTED` each render distinct copy (Dev Notes "i18n Keys"); `NO_API_KEY`'s message includes a link to `/settings/api-keys` (Story 3.1b), mirroring Story 3.9's existing "Invalid key" link pattern.
6. **And** I may still edit the form manually and submit without ever using or succeeding at extraction — this feature is a pre-fill convenience, not a requirement to submit a correction.
7. **And**, once I review the pre-filled (or manually edited) data and submit, **then** the same `submitCorrection` mutation (Story 4.1a) used by Story 4.1 is called, with `source: 'ai_assisted'` if extraction succeeded at least once during this correction-dialog session, otherwise `source: 'manual'` (Dev Notes "Source Attribution") — it is not written directly to the database.
8. **And**, on a successful extraction (`data` returned), a `event_correction_ai_extraction_succeeded` PostHog event fires with `{ eventId }` (Dev Notes "Analytics") — not fired on failed/errored attempts, matching Story 4.1's own "fire only on confirmed success" precedent.
9. **And** every label, button text, and error message introduced by this story is resolved via `next-intl` in both `en` and `id` (Dev Notes "i18n Keys") — no hardcoded strings.

## Tasks / Subtasks

- [ ] **Task 1 (AC3) — GraphQL operation for the mutation:** Extend `apps/web/src/features/events/corrections.graphql` (created by Story 4.1) with:
  ```graphql
  mutation extractEventDataFromUrl($url: String!) {
    extractEventDataFromUrl(url: $url) {
      data {
        eventName
        types
        categories
        location
        organizerName
        contactInfo
        description
        schedules {
          isMainSchedule
          eventStartDate
          eventEndDate
          eventStartTime
          eventEndTime
          title
          performers
          location
          ticketPrice
        }
      }
      errorCode
      errorMessage
    }
  }
  ```
  Run frontend codegen to generate `useExtractEventDataFromUrlMutation` (depends on Story 4.2a's schema — see Pre-Coding Approval Gate).
- [ ] **Task 2 (AC1, AC2, AC3, AC5) — `ai-assisted-correction-trigger.tsx`:** Create `apps/web/src/features/events/ai-assisted-correction-trigger.tsx` (`"use client"`, `apps/web` — GraphQL hook + i18n, not a `packages/ui` primitive, single consumer): renders the "AI-Assisted Correction" button; on click, reveals a URL `Input` (shadcn) + "Extract" button; on Extract, calls `useExtractEventDataFromUrlMutation` (Task 1); while pending, shows a small inline spinner + "Extracting…" text next to the Extract button (Dev Notes "Loader Categorization") and disables the input/button; on a response with `data`, calls the `onExtracted(data: ExtractEventDataFromUrlMutation['extractEventDataFromUrl']['data'])` prop; on a response with `errorCode`, renders the matching inline error string (Dev Notes "i18n Keys") beneath the input; all strings via a `labels` prop object, matching `CorrectionForm`'s own i18n-decoupling precedent (Story 4.1b).
- [ ] **Task 3 (AC1) — Wire into `correction-dialog.tsx`:** In `apps/web/src/features/events/correction-dialog.tsx` (Story 4.1), pass `headerActions={<AiAssistedCorrectionTrigger labels={...} onExtracted={handleExtracted} />}` to `<CorrectionForm>` (Story 4.1b's slot).
- [ ] **Task 4 (AC4, AC7) — Extraction merge + source attribution:** In `correction-dialog.tsx`, implement `handleExtracted(data)`:
  ```ts
  setFormValues((prev) => ({
    ...data,
    schedules: [{ ...data.schedules[0], id: prev.schedules[0]?.id }],
  }));
  setHasExtracted(true);
  setFormKey((k) => k + 1); // forces CorrectionForm to remount and re-initialize from the new initialValues
  ```
  Pass `key={formKey}` and `initialValues={formValues}` to `<CorrectionForm>`. `CorrectionForm`'s actual implementation (`packages/ui/src/features/events/CorrectionForm.tsx`, confirmed by direct read — now `review`) seeds every field's local state via `useState(initialValues.<field>)` **once, on mount only**, with no effect syncing later `initialValues` prop changes — so a post-mount pre-fill genuinely requires a remount, confirming the `key`-increment approach is necessary, not just defensive. The component's own `handleSubmit` already copies `mainSchedule.id` from `initialValues.schedules[0].id` onto the submitted payload whenever it's present (`CorrectionForm.tsx:100-102`) — so as long as Task 4's merge preserves that `id` in the `initialValues` passed to the remounted instance, `onSubmit`'s payload automatically carries it forward with no further action needed at submit time.
- [ ] **Task 5 (AC8) — Analytics:** In `handleExtracted` (Task 4), call `posthog.capture("event_correction_ai_extraction_succeeded", { eventId })`.
- [ ] **Task 6 (AC9) — i18n:** Add locale keys to `apps/web/locales/en.json`/`id.json` — see Dev Notes "i18n Keys" for the exact key list (new `AiAssistedCorrection` namespace).
- [ ] **Task 7 — Tests:**
  - [ ] `apps/web/src/features/events/ai-assisted-correction-trigger.test.tsx` (new, Vitest + Testing Library + `msw`): button reveals the URL input on click; Extract calls the mutation with the pasted URL; pending state disables input/button and shows the loading indicator; a mocked `data` response calls `onExtracted` with the returned fields; each `errorCode` (`NOT_FOUND`, `UNSUPPORTED_PLATFORM`, `NO_API_KEY`, `SCRAPE_FAILED`, `EXTRACTION_FAILED`, `QUOTA_EXHAUSTED`) renders its distinct inline message; `NO_API_KEY`'s message includes a working link to `/settings/api-keys`.
  - [ ] `apps/web/src/features/events/correction-dialog.test.tsx` (extend, Story 4.1): a mocked extraction success overwrites form fields except the main schedule's `id`; submitting after a successful extraction calls `submitCorrection` with `source: 'ai_assisted'` (regardless of any further manual edits made after extraction — see Dev Notes "Source Attribution"); submitting without ever extracting calls it with `source: 'manual'` (unchanged from Story 4.1's existing behavior).
  - [ ] E2E: extend `apps/web/e2e/event-correction.spec.ts` (Story 4.1) with an AI-assisted happy path — open the correction dialog, click "AI-Assisted Correction", paste a (mocked) URL, click Extract, assert the form fields are pre-filled, submit, assert the success toast.
- [ ] **Task 8 — Verification:** Frontend codegen regenerates cleanly against Story 4.2a's schema; `pnpm build`, `pnpm lint`, `pnpm test` (root) pass with no regressions.

## Dev Notes

### Architecture & UX Gate Findings

- **Gate 1 (Architecture/Infrastructure Completeness) — run fresh during this story's own creation, not sourced from the swept `epic-readiness/epic-4-readiness.md`:** the sweep confirmed the AI Gateway adapter (Story 0.13) exists and is anticipated by Epic 4, but predates the implementation-detail-level discovery (only surfaced while drafting this story) that no synchronous, single-arbitrary-URL, correction-shaped extraction capability exists anywhere — the AI Gateway adapter and `ScraperAdapter` (Story 3.3c) are real, reusable building blocks, but were, until now, always invoked only from the async, queue-driven Story 3.6 pipeline (account-centric batch scraping with `accountId`-scoped location/timezone resolution — a fundamentally different shape than "extract from one pasted URL, synchronously, in response to a click"). Confirmed via a Gate 1 subagent review (Winston persona) and four rounds of `AskUserQuestion` with the user: **split into new prerequisite Story 4.2a** rather than build the new `ScraperAdapter` method/platform-detection/resolver/domain-mapping inline in this story, since it spans a genuinely new capability (not the small, mechanical, single-consumer shape Story 4.1's Task 1 precedent covers). See `epics.md` Story 4.2a's Note for the full architecture writeup and all four `AskUserQuestion` decisions (split vs. inline; platform auto-detection vs. explicit user selection; synchronous-with-timeout vs. async job+polling; reuse-existing-`posts`-first vs. always-live-scrape, including the exact key-priority/fallback rules for the "existing post" vs. "new post" paths).
- **Gate 2 (UI Complexity & Reusability) — run fresh via a one-shot Freya-persona subagent review:** **No gap found.** The "AI-Assisted Correction" button, URL input, and Extract button are single-consumer (only inside `CorrectionForm`'s `headerActions` slot, Story 4.1b — no second usage site anywhere in the app), with no complex shared hook or non-trivial reusable util (a single mutation call with local loading/error state, comparable in shape to what Story 4.1 itself absorbed directly). The purpose-built `headerActions` extension point already exists specifically for this story (Story 4.1b's own Gate 2 finding), and the real backend complexity is already correctly isolated in Story 4.2a — nothing is left over to justify a further UI split.
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness) — cited from the swept `epic-readiness/epic-4-readiness.md`** (`swept: true`, `stories_covered` includes `4.2`): no foundational/cross-cutting dependency gap. `extractEventDataFromUrl` (Story 4.2a) has exactly one consumer (this story) and introduces no new shared table or cross-epic tooling dependency.

### Schedule ID Preservation

Story 4.2a's `ProposedEventCorrectionData.schedules` entries carry no `id` (freshly extracted data has no corresponding DB row). Overwriting the form's `schedules` array wholesale with the extracted one would lose the original main schedule's `id`, causing Story 4.1a's `submitCorrection` reconciliation (`id` present → update; `id` absent → insert) to **insert a duplicate schedule** instead of updating the existing one — a real correctness bug, not a stylistic choice. Task 4's merge explicitly re-attaches the pre-extraction `id` onto the extracted schedule object before it reaches `CorrectionForm`'s state. This did not require its own `AskUserQuestion` — it is a direct, non-discretionary consequence of Story 4.1a's already-established reconciliation contract, not an independent design tradeoff.

### Source Attribution

`submitCorrection`'s `source` argument (`manual` | `ai_assisted`, Story 4.1a AC1) is set to `'ai_assisted'` if extraction succeeded at least once during the correction-dialog session, and stays `'manual'` (Story 4.1's existing default) otherwise. This does **not** attempt to detect whether the user manually tweaked a field after a successful extraction and revert to `'manual'` in that case — `CorrectionForm`'s actual implementation (confirmed by direct read, Task 4) exposes no field-level change/dirty callback, only a single `onSubmit(data)` firing once at submit time with the form's final values; adding such tracking would require changing `CorrectionForm`'s already-implemented, already-in-review contract (Story 4.1b), which is out of scope for this story. A correction that started from an AI extraction and was then lightly hand-edited is still fairly described as `ai_assisted` in spirit, matching `epics.md`'s original AC wording ("approving the pre-filled form submits it... with `source: 'ai_assisted'`", with no edit-invalidates-it nuance in the source text) — this simplification was a direct, non-discretionary consequence of the already-shipped component's contract, not an independent tradeoff requiring its own `AskUserQuestion`.

### Loader Categorization

Extraction is **not** a data-mutating write to `events`/`schedules` (only the eventual `submitCorrection` call is) — it is a bounded, single, user-initiated async lookup, matching Story 2.4's `previewLocation` "resolving address…" precedent exactly (`_bmad-output/implementation-artifacts/2-4-set-location-by-current-location-or-map.md` AC9: "a non-blocking, localized... loading indicator"). It therefore uses the **Non-Blocking (localized)** pattern — a small spinner/disabled state scoped to the AI-assisted-correction panel — not `project-context.md`'s Blocking `BlockingLoader`, which is reserved for critical *mutations* (the example given verbatim is "submitting a report, saving a location," i.e. an actual write). The rest of the dialog (event name, other fields) remains interactive while extraction is in flight.

### Analytics (PostHog)

- **Event name:** `event_correction_ai_extraction_succeeded`
- **Fired:** only when the mutation returns `data` (a successful extraction) — not on any `errorCode` response, matching Story 4.1's "fire only on confirmed state changes" precedent (`event_favorited`, `subscription_default_location_set`, `event_correction_submitted`).
- **Payload:** `{ eventId: string }`
- Story 4.1's own `event_correction_submitted` event already carries `source: 'ai_assisted'` when applicable (Story 4.1 AC7) — this story adds no new field to that event, only this new, separate "extraction used" event, since "extraction succeeded" and "correction submitted" are distinct, independently-interesting funnel steps (a user may extract and then abandon without submitting).

### i18n Keys

New keys required in `apps/web/locales/en.json` and `id.json`, under a new `AiAssistedCorrection` namespace:

- `triggerButtonLabel` ("AI-Assisted Correction")
- `urlInputLabel` ("Social media post URL")
- `urlInputPlaceholder`
- `extractButtonLabel` ("Extract")
- `extractingAnnouncement` ("Extracting…" — the localized loading indicator's text/aria-live announcement)
- `errorNotFound` (mirrors `NOT_FOUND` — reserved for a future non-URL-shaped error; not currently returned by Story 4.2a's AC1–AC9, included for schema-completeness with `ExtractionErrorCode`)
- `errorUnsupportedPlatform` (`UNSUPPORTED_PLATFORM`)
- `errorNoApiKey` (`NO_API_KEY` — includes an inline link to `/settings/api-keys`, matching Story 3.9's existing "Invalid key" link-copy pattern)
- `errorScrapeFailed` (`SCRAPE_FAILED`)
- `errorExtractionFailed` (`EXTRACTION_FAILED` — covers both a Gemini/AJV failure and `payload.isEvent === false`)
- `errorQuotaExhausted` (`QUOTA_EXHAUSTED`)

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** one new GraphQL mutation + two new output types + one new enum, all owned by Story 4.2a (not this story); no DB migration from this story itself; no `packages/domain`/`packages/shared-types` change from this story itself.
- **Impacted fields/contracts:** `apps/web/src/generated/graphql.ts` regenerated via codegen (Task 1) to add `useExtractEventDataFromUrlMutation` and its result types, once Story 4.2a lands.
- **Required DB migration changes:** None (this story is entirely `apps/web`).
- **Required TypeScript type changes:** `apps/web` generated GraphQL types only (via codegen) — no manual edits to generated output.
- **Backward compatibility and rollout notes:** Purely additive; does not modify Story 4.1's existing `correction-dialog.tsx` submit path beyond the `source` attribution logic (Dev Notes "Source Attribution") and the new `headerActions` wiring (both additive).
- **Verification checks:** Task 7's integration tests confirm the merge/source-attribution/analytics behavior; codegen regenerates cleanly (Task 8).

### Package Boundaries

- **`apps/web`** (all of this story's scope): `ai-assisted-correction-trigger.tsx` + `.test.tsx` (new); `correction-dialog.tsx` + `.test.tsx` (extended, Story 4.1); `corrections.graphql` (extended, Story 4.1); locale files.
- **`packages/ui`**: no change — `CorrectionForm`'s `headerActions` slot (Story 4.1b) is consumed, not modified.
- **`apps/backend`**: no change from this story — Story 4.2a owns the entire backend surface (`extractEventDataFromUrl` resolver, `ScraperAdapter.getPostByUrl`, platform detection, the domain mapping function).

### Project Structure Notes

- **New:** `apps/web/src/features/events/ai-assisted-correction-trigger.tsx` + `.test.tsx`; `apps/web/e2e/event-correction.spec.ts` extended (not new — Story 4.1 creates the file).
- **Modified:** `apps/web/src/features/events/corrections.graphql` (new mutation operation); `apps/web/src/features/events/correction-dialog.tsx` + `.test.tsx` (Story 4.1 — `headerActions` wiring, extraction merge, source attribution); `apps/web/locales/en.json`/`id.json`; `apps/web` generated GraphQL types (codegen, not hand-edited).
- **Not modified:** `packages/database/schema.ts`; `packages/domain` (Story 4.2a's concern); `packages/shared-types`; `packages/ui` (consumes Story 4.1b's slot as-is); `apps/backend` (Story 4.2a's concern); `apps/infrastructure` (no new AWS resource — this story is `apps/web` only).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story-4.2`] — this story's authoritative AC/Note text, amended during this creation pass.
- [Source: `_bmad-output/planning-artifacts/epics.md#Story-4.2a`] — the split-off backend extraction API layer this story depends on; full Gate 1 architecture writeup and `AskUserQuestion` decision log.
- [Source: `_bmad-output/planning-artifacts/epics.md#Story-4.1b`] — `CorrectionForm`'s `headerActions` extension point, explicitly reserved for this story.
- [Source: `_bmad-output/implementation-artifacts/4-1-manually-correct-event-data.md`] — `correction-dialog.tsx`'s structure, `submitCorrection` wiring, and `BlockingLoader`/toast/cache-patch patterns this story extends rather than duplicates.
- [Source: `_bmad-output/implementation-artifacts/4-1a-build-the-corrections-backend-graphql-api-layer.md`] — `submitCorrection`'s `id`-present-means-update reconciliation (Dev Notes "Schedule ID Preservation"), `source: 'ai_assisted'` enum value.
- [Source: `_bmad-output/implementation-artifacts/2-4-set-location-by-current-location-or-map.md#AC9`] — the non-blocking, localized "resolving address…" loading-indicator precedent this story's loader categorization follows exactly.
- [Source: `design-artifacts/C-UX-Scenarios/06-data-quality/06.6-ai-assisted-correction.md`] — the authoritative (thin) UX scenario this story's AC1–AC4/AC7 implement.
- [Source: `_bmad-output/planning-artifacts/story-split-gate.md`] — Gate 1/2/3 definitions and the numbering rule (source of Story 4.2a's lettered-suffix placement).
- [Source: `_bmad-output/project-context.md#UI-Patterns-UX-Invariants`] — Blocking-loader rule scoped to critical mutations (Dev Notes "Loader Categorization"); i18n (`next-intl`, `en`/`id` locale keys); Code Organization (`apps/web` vs. `packages/ui` placement for single-consumer, GraphQL/i18n-coupled UI).

## Global Rules References

- [ ] `_bmad-output/project-context.md` — UI Patterns & UX Invariants (Non-Blocking localized loader for a non-mutating async lookup, per `previewLocation`'s precedent — not the Blocking pattern); API & Data (GraphQL Code Generator end-to-end type safety); i18n (next-intl, `en`/`id` locale keys); Code Organization (`apps/web` for GraphQL/i18n-coupled, single-consumer UI — no `packages/ui` component needed here).
- [ ] `story-content-structure.md` — canonical section order followed.
- [ ] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-7 (`requireAuth`, enforced by Story 4.2a's mutation; this story has no independent auth surface).
- [ ] `docs/infrastructure/index.md` — confirmed no infra shard read needed: this story is `apps/web`-only, consuming Story 4.2a's synchronous GraphQL mutation (no Lambda/SQS/EventBridge change on this story's own side).

## Implementation Plan (Rule-Compliant)

### File Change Plan

- **New:** `apps/web/src/features/events/ai-assisted-correction-trigger.tsx` + `.test.tsx`.
- **Modified:** `apps/web/src/features/events/corrections.graphql`; `apps/web/src/features/events/correction-dialog.tsx` + `.test.tsx`; `apps/web/e2e/event-correction.spec.ts`; `apps/web/locales/en.json`/`id.json`; generated GraphQL types (`apps/web`, via codegen).
- **Not modified:** `packages/database/schema.ts`; `packages/domain`; `packages/shared-types`; `packages/ui`; `apps/backend`; `apps/infrastructure`.

### Rule Mapping

- Story-split-gate discipline (Gate 1 run fresh, found a real new-capability gap → split to Story 4.2a; Gate 2 run fresh, no gap; Gate 3 cited from swept `epic-4-readiness.md`) → this workflow's Step 3.5 mandate → Dev Notes "Architecture & UX Gate Findings".
- "Leave the system working end-to-end, not just satisfy stated ACs" (the schedule-`id`-loss bug that a naive overwrite would introduce, and the `source` attribution question, were both surfaced and resolved rather than silently absorbed) → Dev Notes "Schedule ID Preservation", "Source Attribution".
- Code Organization (`apps/web` for GraphQL/i18n-coupled single-consumer UI, `packages/ui` untouched) → Task 2/Task 3, Dev Notes "Package Boundaries".
- API & Data (GraphQL Code Generator end-to-end type safety) → Task 1 (codegen).
- UI Patterns & UX Invariants (Non-Blocking localized loader for a non-mutating lookup) → Task 2, Dev Notes "Loader Categorization".
- i18n (next-intl, `en`/`id`) → Task 6, Dev Notes "i18n Keys".
- Reuse over reinvention (Story 4.1's `correction-dialog.tsx`/`submitCorrection` wiring; Story 2.4's `previewLocation` non-blocking-loader precedent; Story 4.1b's `headerActions` extension point built specifically for this story) → Task 3, Task 4, Dev Notes "Loader Categorization".

### Verification Plan

- `apps/web`: frontend codegen regenerates cleanly against Story 4.2a's schema; `pnpm --filter web test` — `ai-assisted-correction-trigger.test.tsx`, `correction-dialog.test.tsx` (extended) all pass; Playwright `event-correction.spec.ts`'s extended AI-assisted happy path passes.
- `pnpm build`, `pnpm lint`, `pnpm test` (root): full suite, no regressions.

## Pre-Coding Approval Gate

- [ ] Scope confirmation: this story implements only the "AI-Assisted Correction" trigger UI, the extraction-result merge (with schedule-`id` preservation), source attribution, and analytics — wired into Story 4.1's existing correction dialog. It does **not** implement Story 4.2a's backend mutation/scraper method/platform detection, or Story 4.1/4.1b's own scope — all three are separate stories/prerequisites.
- [ ] Architecture and boundary confirmation: all new code stays in `apps/web`; no `packages/ui`, `packages/domain`, or `apps/backend` change originates from this story.
- [ ] Testing plan confirmation: integration tests (Vitest + Testing Library + `msw`) cover the trigger's reveal/extract/loading/error states and the dialog's merge/source-attribution logic; one Playwright E2E extension covering the AI-assisted happy path.
- [ ] **Story 4.2a split accepted:** confirm Story 4.2a (new prerequisite, `backlog`) as the owner of the on-demand extraction backend capability, per the user's four-round `AskUserQuestion` decision during this story's creation (see Dev Notes "Architecture & UX Gate Findings" and `epics.md` Story 4.2a).
- [ ] **Schedule-ID-preservation merge behavior accepted:** confirm Task 4's `key`-remount + `id`-reattachment approach as the resolution to the potential duplicate-schedule bug (see Dev Notes "Schedule ID Preservation").
- [ ] **`source` attribution rule accepted:** confirm `source: 'ai_assisted'` is set whenever extraction succeeded at least once in the session, without attempting to detect/revert on later manual edits (see Dev Notes "Source Attribution").
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted: Gate 1 run fresh — real gap found and split to Story 4.2a (above). Gate 2 run fresh via subagent — no gap. Gate 3 sourced from swept `epic-4-readiness.md` (`4.2` explicitly in `stories_covered`; no gap).
- [ ] **Dependency statuses confirmed — sequencing blocker:** as of this story's creation, Story 4.1a (`submitCorrection` mutation) and Story 4.1b (`CorrectionForm`, confirmed by direct code read — its `headerActions` slot and `initialValues`-seeds-once-on-mount behavior are both implemented as this story's Dev Notes describe) are both `review` (real code exists, pending code review — safe to build against, though still subject to review-driven changes). Story 4.1 itself is `ready-for-dev` (not yet implemented — `correction-dialog.tsx`, the file this story extends, does not exist yet), and Story 4.2a is `backlog` (not yet created as its own story file). **This story cannot be implemented until both Story 4.1 and Story 4.2a exist as real code.** Explicit confirmation required before `bmad-dev-story` proceeds: either Story 4.1 and Story 4.2a are implemented first (recommended sequencing), or the user explicitly accepts building against Story 4.2a's contract ahead of its own implementation (higher risk of drift if it amends further — mirroring Story 4.1's own identical sequencing blocker note).
- [ ] Explicit human approval state (Default: **pending approval**).

## Testing Requirements

- [ ] `apps/web/src/features/events/ai-assisted-correction-trigger.test.tsx` (new): button reveals URL input on click; Extract calls the mutation with the pasted URL; pending state disables input/button, shows loading indicator; successful `data` response invokes `onExtracted`; every `errorCode` renders its distinct inline message; `NO_API_KEY` includes a working `/settings/api-keys` link.
- [ ] `apps/web/src/features/events/correction-dialog.test.tsx` (extend): successful extraction overwrites form fields except the main schedule's `id`; submit after a successful extraction sends `source: 'ai_assisted'`; submit without ever extracting sends `source: 'manual'` (Story 4.1's unchanged default behavior).
- [ ] E2E: `apps/web/e2e/event-correction.spec.ts` (extend) — AI-assisted happy path: open correction dialog, click "AI-Assisted Correction", paste a (mocked) URL, click Extract, assert pre-filled fields, submit, assert success toast.

## Deliverables Checklist

- [ ] `apps/web/src/features/events/corrections.graphql`: `extractEventDataFromUrl` operation added; frontend codegen regenerated.
- [ ] `apps/web/src/features/events/ai-assisted-correction-trigger.tsx`: implemented, integration-tested.
- [ ] `apps/web/src/features/events/correction-dialog.tsx`: `headerActions` wired, extraction-merge + source-attribution logic implemented, tested.
- [ ] `apps/web/locales/en.json`/`id.json`: all keys listed in Dev Notes "i18n Keys" added for both locales.
- [ ] `apps/web/e2e/event-correction.spec.ts`: AI-assisted happy-path extension passing.
- [ ] `pnpm build`, `pnpm lint`, `pnpm test` green at the repo root (excluding pre-existing, unrelated warnings/noise).

## Out of Scope

- **Story 4.2a's entire backend surface** (`extractEventDataFromUrl` resolver, `ScraperAdapter.getPostByUrl` + per-platform implementations, URL→platform detection, the `GeminiExtractionPayload`→`ProposedEventCorrectionData` domain mapping) — split off as its own prerequisite story per this story's Gate 1 finding; see `epics.md` Story 4.2a.
- **Persisting a newly-scraped "new post" into the `posts` table** — Story 4.2a's AC8 explicitly scopes the live-scrape path as a one-off extraction only (no `accountId`/account-profile resolution attempted). Forward note: if a future story wants to persist these for reuse/dedup (mirroring `persistScrapedPost`), it would need to resolve or create a `social_media_account_profiles` row for the post's author first — a real additional scope, not attempted here.
- **Twitter/X live-post extraction** — `twitterScraperAdapter` is an existing, pre-this-story stub (`getNewestPosts`/`lookupAccountProfile` both throw `'Twitter/X scraping is not yet implemented'`); Story 4.2a's `getPostByUrl` inherits the same limitation for Twitter/X URLs, surfaced to the user as `SCRAPE_FAILED`. Only Instagram URLs support the live-scrape ("new post") path until a future story implements the Twitter/X adapter.
- **Round-robin key fallback for brand-new (never-scraped) posts** — per the user's explicit design decision (Story 4.2a AC5), only the requesting user's own key is used for the new-post path; no fallback pool exists since a brand-new post has no known subscriber account.
- **Full multi-schedule extraction** — matches Story 4.1's own out-of-scope carve-out (Dev Notes "Main-Schedule-Only Scope Decision"); the AI extraction pre-fills only the one editable main schedule, consistent with `CorrectionForm`'s single-schedule editing scope (Story 4.1b).

## Definition of Done

- [ ] All 9 Acceptance Criteria satisfied.
- [ ] `ai-assisted-correction-trigger.test.tsx`, `correction-dialog.test.tsx` (extended) passing.
- [ ] `event-correction.spec.ts`'s AI-assisted E2E extension passing.
- [ ] `pnpm build`, `pnpm lint`, `pnpm test` pass at the repo root with no regressions.
- [ ] `apps/web` codegen regenerated and committed.
- [ ] `en.json`/`id.json` updated with every key listed in Dev Notes "i18n Keys".

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
