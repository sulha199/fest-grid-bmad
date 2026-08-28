---
id: SPEC-ai-prompt-event-filter
companions: ['filter-vocabulary.md', 'brownfield.md', '../../project-context.md']
sources: ['../../forge/ai-prompt-event-filter/forged-idea.md']
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability only — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# AI Prompt-Based Custom Event Filter (v1)

## Why

**An opportunity to capture.** FestDaily's existing filters (account, type, category, keyword, proximity) require a user to know and manually operate several discrete controls. A single free-text prompt — "free jazz events in Kota Yogyakarta this weekend" — lets a user express intent across several of those dimensions at once, including two the manual UI doesn't expose today (date range, admin-area/region, venue type). This is scoped as a narrow, single-shot extraction task on top of the existing Gemini adapter, not a new AI product surface: v1 is on-demand only, with a recurring digest against saved filters explicitly deferred to v2.

## Capabilities

- **CAP-1**
  - **intent:** User types a free-text prompt and immediately sees matching event results — no saved state or scheduling is created unless the user explicitly saves.
  - **success:** Submitting a prompt runs it through the extraction task and renders Discovery results filtered accordingly in the same session, with no follow-up turn, chat history, or refinement step available.

- **CAP-2**
  - **intent:** A prompt can express any combination of the locked v1 vocabulary — account, type, category, keyword, date-range or day-of-week recurrence, location (proximity or region), venueType, and isFree (see `filter-vocabulary.md`) — and anything outside that vocabulary is surfaced, not dropped or guessed at.
  - **success:** A prompt fragment matching a locked field populates that field in the resulting `EventFilterInput`; a fragment outside the locked vocabulary (e.g. a price threshold, a floor/room detail, off-topic chat) never populates a field and always produces a visible caveat in the rendered summary (CAP-4).

- **CAP-3**
  - **intent:** User can save a resulting filter for later reuse from a dedicated "My AI Filters" list page, and the only supported way to change a saved filter afterward is re-prompting.
  - **success:** A saved filter persists as a typed `EventFilterInput` row reachable from "My AI Filters" (same list pattern as Favorites/Subscriptions); no UI path exists to directly edit a saved filter's fields — the sole mutation path is creating a new resolved filter via re-prompt and saving over/alongside it.

- **CAP-4**
  - **intent:** Every AI filter, whether active in the current session or loaded from a save, is represented to the user only by a deterministic, always-current summary sentence describing its current state.
  - **success:** The summary is template-rendered from the filter's current field values (never an AI-generated or frozen caption) and re-renders identically given the same filter state; this sentence is the only transparency/trust surface — there is no separate edit UI at any point.

- **CAP-5**
  - **intent:** The AI filter entry point adds zero permanent width to FilterHub, and an active AI filter replaces FilterHub's manual controls with one collapsed line rather than stacking alongside them.
  - **success:** FilterHub shows only an icon-only trigger (no permanent label) when no AI filter is active, opening the prompt as an overlay; when an AI filter is active, FilterHub renders exactly one row — the live summary (CAP-4) plus clear/expand — never both the summary and the full manual control set at once; any manual FilterHub edit made after loading an AI filter changes only the session's query state and never mutates the saved filter entity.

## Constraints

- Prompts are single-shot: no conversation memory, no follow-up refinement turn, no chat UI. Not a general chatbot — a constrained system prompt with structured output only, reusing the existing Gemini adapter pattern. Off-topic prompts degrade via the same caveat mechanism as any unsupported fragment (CAP-2), not a separate moderation layer. **Rejected:** open-dialogue/general-QnA framing — it creates a BYOK abuse vector (a user's own paid Gemini key becoming a free chat proxy through the app).
- Date grammar is closed: `{anchor: TODAY|THIS_WEEK|THIS_MONTH, offsetAmount, offsetUnit: DAY|WEEK|MONTH}`, composable, resolved fresh at read time — never stored or matched as a frozen absolute date. Day-of-week recurrence ("every Thursday") is a separate predicate field with different semantics and is never folded into the anchor/offset grammar.
- Location proximity mode reuses existing coordinates+radius, unchanged. Region mode is an indexed text match against a normalized `adminArea` field on `LocationDetails`, sourced from Geoapify's `county` response field (fallback to `city` when `county` is absent) — **verified live against Geoapify (2026-08-28):** `county` reliably separates "Sleman Regency" from bare "Yogyakarta" for addresses solidly inside each area, but one boundary-adjacent Kota Yogyakarta address (Jalan Malioboro) returned an unrelated Sleman sub-district name, an OSM boundary-tagging artifact — accepted as a v1 data-quality limitation, not a blocker. **Rejected:** true polygon/point-in-polygon filtering via PostGIS — new infra not justified by current use cases. Floor/wing/room-level detail ("Lantai 2") is not geocodable and stays in `Schedule`'s existing raw-text `location` field — shown, never filterable.
- `venueType` is sourced from the existing Gemini per-post extraction pipeline (Story 0.13 schema), not the geolocation provider (unverified capability there, weak for informal local venue names). It lives on `LocationDetails.venueType` alongside `adminArea`. When a `Schedule` falls back to its account's Default Location (PRD §3.7), it must inherit the **entire** `LocationDetails` object, including `venueType` — a partial inherit would systematically break venueType filtering on exactly the accounts that rely on the fallback, since their own posts rarely restate their own venue type.
- Filter storage formalizes a shared, typed `EventFilterInput` GraphQL input used by Discovery, Widget, and the AI filter alike. `Widget.filters: Record<string, unknown>` (PRD §4.16) is replaced by this typed shape — this was proposed and built on throughout the forge session but left unconfirmed; confirmed for this spec because an AI-produced filter needs a schema to validate against (Zod/AJV) before it can be safely persisted at all.
- Price is fully deferred to v2 (numeric threshold + cross-currency normalization) except one cheap exception: `isFree`, a locked-vocabulary exact-text match against `Schedule.ticketPrice`'s existing free-form text (e.g. "free", "gratis") — no numeric parsing, no FX normalization, and explicitly not a stepping-stone toward the general threshold filter.
- Unsupported-request handling is one general mechanism, independently validated against three cases (price threshold, floor-level detail, off-topic chat): any out-of-vocabulary fragment is surfaced as an explicit caveat in the rendered summary (CAP-4) — never silently dropped, never handled by fragile per-case parsing.

## Non-goals

- Recurring digest/scheduled notifications evaluated against saved filters (v2 — needs a scheduler and quota fan-out).
- Global numeric `ticketPrice` normalization or cross-currency price-threshold filtering (v2 — needs an extraction-schema change and a cached FX-rate source).
- A full "AI mode" toggle that hides FilterHub entirely — explicitly rejected in favor of the icon-only trigger (CAP-5).
- An open-dialogue, general-purpose chatbot or app-wide QnA assistant — explicitly rejected (BYOK abuse vector).
- True polygon/point-in-polygon geographic filtering via PostGIS — explicitly rejected as unjustified new infra for current use cases.
- Any edit UI for a saved AI filter — explicitly rejected as a permanent design stance (not a deferral): the only way to change a saved filter is to re-prompt.

## Success signal

A user types a free-text prompt such as "free jazz events in Kota Yogyakarta this weekend" and immediately sees matching Discovery results, plus a live summary sentence stating exactly what was understood — including a visible caveat for any part of the prompt outside the locked vocabulary. They can save that filter, find it again later on "My AI Filters," and the only way to change it afterward is to re-prompt — never an edit form.

## Open Questions

- None outstanding for v1 — the three items flagged at the end of the forge session (EventFilterInput formalization, Geoapify admin-area granularity, free/gratis exception) were resolved during this spec pass; see the constraints above and `.memlog.md` for the record.
