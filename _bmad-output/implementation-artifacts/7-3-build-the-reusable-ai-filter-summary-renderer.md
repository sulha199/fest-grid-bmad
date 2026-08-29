# Story 7.3: Build the reusable AI filter summary renderer

## 1. Epic Context
**Epic 7:** AI Prompt-Based Custom Event Filter
A user with a saved Gemini API key can describe what they're looking for in a free-text prompt and immediately see matching Discovery results, as a faster alternative to FilterHub's manual controls.

## 2. User Story
**As a** developer,
**I want** a single, pure, deterministic function that renders an `EventFilterInput` + `caveats[]` into a localized summary sentence,
**So that** Story 7.4's live overlay result and Story 7.5's saved-filter list rows describe a filter identically, satisfying PRD §3.15's "summary is the only transparency layer" constraint from one implementation instead of two independently-drifting ones.

## 3. Acceptance Criteria
- [ ] **Given** an `EventFilterInput` value and a `caveats: string[]` array,
- [ ] **When** `renderAIFilterSummary(filter, caveats, labels)` is called,
- [ ] **Then** it returns a single human-readable sentence assembling whichever fields are populated (account, type/category, keyword, date range/day-of-week, admin-area or "near me", venue type, "free events only") in a fixed, readable order, using a `labels` prop object for every piece of static text (matching `EventDetailViewLabels`/`CorrectionForm`'s i18n-decoupling precedent — no embedded strings, `apps/web` resolves `labels` via `next-intl`) — never an AI-generated or cached caption, always re-derived live from the current field values.
- [ ] **And** when `caveats` is non-empty, the sentence is followed by a distinct, visually-separable caveat clause listing them verbatim — never merged into or paraphrasing the main summary sentence.
- [ ] **And** an all-fields-empty `EventFilterInput` with no caveats renders a defined "no filter" sentence rather than an empty string.
- [ ] **And** the function is pure (no network call, no React dependency beyond its return type being a plain string or a small serializable structure) so it is trivially unit-testable and usable from both a live-resolution result and a stored `AIEventFilter` row alike.

## 4. Developer Context & Guardrails
- **File Structure Requirements:**
  - Create the function inside `packages/domain/src/ai-event-filters/render-ai-filter-summary.ts`.
  - Create the corresponding test file `packages/domain/src/ai-event-filters/render-ai-filter-summary.test.ts`.
  - Export it via `packages/domain/src/ai-event-filters/index.ts` and `packages/domain/src/index.ts`.
- **Architecture Compliance:**
  - The function must be **pure**, containing no network calls and no React hooks or dependencies.
  - It must not import from any specific UI package but rather operate purely on input data structures (`EventFilterInput`, `caveats` array, and `labels` interface).
  - Define the `labels` interface (`AIFilterSummaryLabels` or similar) in the same file or a co-located types file to dictate the required i18n strings (e.g. `{ freeEvents: "Free events", nearMe: "near me", in: "in", emptyFilter: "All events" }`).
- **Data Type Compatibility Requirements:**
  - Do not invent a new filter-shape interface — `EventFilterInput` (plus `DateAnchor`/`DateOffsetUnit`/`DayOfWeek`/`LocationFilter`) is already defined in `packages/domain/src/events/buildEventsQueryCondition.ts` (Story 7.1a) and re-used as-is by Story 7.2a's `transformGeminiResponseToEventFilter` (`packages/domain/src/ai-event-filters/transform-gemini-response-to-event-filter.ts`) — import from there directly. No GraphQL-generated types are needed since this is a `packages/domain`-internal function operating on the same domain type its sibling functions already use.
  - No database migration or schema changes required for this story.
- **Testing Requirements:**
  - `packages/domain` requires **100% unit test coverage**.
  - Write test cases for: all fields empty, single fields populated, multiple fields populated, `caveats` empty, `caveats` non-empty (verifying visual separation, like a newline or specific separator symbol provided in labels), and "near me" radius cases versus specific `adminArea`.

## 5. Tasks
- [ ] 1. Define `AIFilterSummaryLabels` interface that captures all necessary static strings for building the sentence.
- [ ] 2. Import `EventFilterInput` (and `DateAnchor`/`DateOffsetUnit`/`DayOfWeek`) from `../events/buildEventsQueryCondition.js` — do not redefine the filter shape.
- [ ] 3. Implement `renderAIFilterSummary(filter, caveats, labels)` in `packages/domain/src/ai-event-filters/render-ai-filter-summary.ts`.
- [ ] 4. Implement formatting logic to chain clauses in the AC-specified order: account, type/category, keyword, date range/day-of-week, admin-area-or-"near me", venue type, then "free events only" (e.g. "[accountId] [Types] [Categories] about '[keyword]' [dateRange/dayOfWeek] [location] [venueType] [Free]").
- [ ] 5. Implement caveat appending logic (e.g. returning an object with `{ summary: string, caveatsText?: string }` or a formatted string block).
- [ ] 6. Write comprehensive unit tests in `render-ai-filter-summary.test.ts` covering all branching and empty states to achieve 100% coverage.
- [ ] 7. Export the function from `packages/domain/src/index.ts`.

## 6. Project Context Reference
- Consult `_bmad-output/project-context.md` for typescript strict rules, domain purity, and 100% test coverage rules for `packages/domain`.

## 7. Status Update
- Status: ready-for-dev
- Ultimate context engine analysis completed - comprehensive developer guide created.