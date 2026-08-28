# AI Prompt-Based Event Filter — Forged Idea

## Scope
- v1: on-demand only — prompt → filter → results shown immediately. No push/digest.
- v2: recurring daily/weekly digest against saved filters (scheduler + quota fan-out — deferred).
- v1 prompts are single-shot. No conversation memory, no follow-up refinement, no chat UI.
- v1 vocabulary: account, type, category, keyword (existing) + date-range (new) + location: proximity or admin-area (new) + venueType (new). Price threshold deferred to v2.

## Filter storage
- Formalize a typed `EventFilterInput` (GraphQL input), extending Discovery/Widget's currently informal/untyped shape (Widget today stores `Record<string, unknown>` — a known weak point, not to be repeated). **Never given an explicit final yes** after the location tangent — every later lock builds on it, but confirm directly before spec.
- No edit UI for a saved AI filter, ever. Only way to change it: re-prompt.
- Resolved filter is described by a **deterministic, template-rendered summary** — not AI-generated, always a live render of current filter state (not a frozen caption). This is the entire transparency/trust layer replacing an edit UI.

## Date filter
- Closed structured grammar: `{anchor: TODAY|THIS_WEEK|THIS_MONTH, offsetAmount, offsetUnit: DAY|WEEK|MONTH}` — composable, resolved fresh at read time (never a frozen absolute date).
- Day-of-week recurrence ("every Thursday") is a separate field — different semantics (predicate, not a range), not folded into the grammar above.

## Location filter
- Proximity mode: existing coordinates+radius, unchanged.
- Region mode (new): capture admin-area (e.g. "Kabupaten Sleman" vs "Kota Yogyakarta") from the existing Geoapify response into `LocationDetails`; filter by indexed text match. **Rejected** true polygon/point-in-polygon (PostGIS) — new infra not justified by current use cases.
- Unverified before build: does Geoapify reliably separate Kota Yogyakarta from Kabupaten Sleman for Indonesian addresses? (quick API check, not a design task)
- Floor/wing/room detail ("Lantai 2") is not geocodable — stays in existing raw-text `Schedule.location`, shown but not filterable.

## Venue type
- Sourced from the Gemini extraction pipeline (one more field in the existing per-post schema, Story 0.13) — **not** the geolocation provider's POI database (unverified capability, weak for informal local venue names).
- Lives on `LocationDetails` (at `Schedule.locationDetails`) alongside adminArea, not a one-off per-post output. When a schedule falls back to the account's Default Location (§3.7), it must inherit the **entire** `LocationDetails` including venueType — otherwise venueType systematically fails on exactly the accounts that rely on the fallback (their own posts rarely restate their own venue type).

## Unsupported requests — one general rule
Any prompt fragment outside the locked vocabulary (price threshold, floor, off-topic chat) is **explicitly surfaced as a caveat in the summary** — never silently dropped, never fragile-parsed. Validated 3x independently (price, floor, off-topic chatbot) as one mechanism, not case-by-case handling.

## Chatbot scope
Not a general app-wide QnA assistant — a single-purpose prompt→filter extraction task (constrained system prompt, structured output only). Open-dialogue framing was **rejected**: it creates a BYOK abuse vector (users burning their own paid Gemini key as a free chat proxy through the app). Off-topic prompts reuse the degrade-caveat rule above, not a separate moderation layer.

## FilterHub UI
- **Rejected:** a full "AI mode" toggle that hides FilterHub entirely.
- **Chosen:** icon-only trigger (sparkle, no permanent label) opens the prompt as an overlay — zero added permanent width. Saved AI filters live on a separate "My AI Filters" list page (same pattern as Favorites/Subscriptions).
- When an AI filter is active, FilterHub's row is *replaced* by one collapsed summary line (live-rendered sentence + clear/expand) — never stacked alongside full manual controls. Always exactly one row tall.
- Manual FilterHub edits after loading an AI filter change only the session's query state, never the saved entity. Saved filter changes only via re-prompt.

## v2 backlog
- Recurring digest notifications against saved filters.
- Global numeric `ticketPrice` normalization (estimated, cross-currency), so thresholds like "under IDR 200K" can match non-IDR events. Requires extraction-schema change + cached FX-rate source.

## Open before spec
- Explicit confirm/reject on the shared `EventFilterInput` schema extension.
- Verify Geoapify admin-area granularity for Sleman/Kota Yogyakarta.
- Decide: is "free"/"gratis" exact-text match a cheap v1 exception to the price deferral? (raised, not resolved)
