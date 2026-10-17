# AI Filter Vocabulary (v1 + expressions)

The locked set of fields the extraction task may populate on `EventFilterInput`. Anything a prompt expresses outside this table never populates a field — it always produces a caveat in the rendered summary (SPEC.md CAP-2, CAP-4).

| Field | Shape | Source of truth | Existing or new | Degrade behavior if unparseable |
|---|---|---|---|---|
| `account` | account ID reference | Existing manual filter | Existing | Caveat if prompt names an account that doesn't match any subscribed/known account. |
| `type` | enum (`EventType`) | Existing manual filter | Existing | Caveat if prompt implies a type outside the enum. |
| `category` | enum (`EventCategory`) | Existing manual filter | Existing | Caveat if prompt implies a category outside the enum. |
| `keyword` | free text, partial match | Existing manual filter (event name/performers/location text) | Existing | N/A — keyword is itself the catch-all free-text match, not a closed vocabulary. |
| `dateRange` | `{ anchor: TODAY \| THIS_WEEK \| THIS_MONTH, offsetAmount: int, offsetUnit: DAY \| WEEK \| MONTH, spanAmount?: int, spanUnit?: DAY \| WEEK \| MONTH }` (span widens the window: "next 7 days") | New — resolved fresh at read time, never a frozen absolute date | New | Caveat if the date expression can't map to this closed grammar (e.g. a specific named holiday). |
| `dayOfWeek` | one or more of `MON`..`SUN`, recurrence predicate (weekends = SAT+SUN, weekdays = MON–FRI) | New — separate field from `dateRange`, different semantics (predicate vs. range) | New | Caveat if recurrence phrasing is ambiguous (e.g. "on weekends" mapping to SAT+SUN is in scope; vaguer phrasing is not). |
| `location.proximity` | existing `{ coordinates, radiusMeters }` | Existing manual filter (Section 3.3) | Existing | Unchanged from manual filter behavior. |
| `location.adminArea` | normalized text, indexed match | New — derived from Geoapify `county` (fallback `city`) written to `LocationDetails.adminArea` | New | Caveat if the named place can't resolve to a known `adminArea` value, or if geocoding fails. Known limitation: Geoapify's OSM-sourced admin boundaries occasionally misattribute addresses near a regency/city border (verified 2026-08-28) — an accepted v1 data-quality gap, not a caveat-triggering case since it fails silently the same way any adminArea mismatch would (no distinct handling). |
| `venueType` | enum, extraction-pipeline-sourced | New — `LocationDetails.venueType`, populated by the existing Gemini per-post extraction (Story 0.13), not the geolocation provider | New | Caveat if the named venue type isn't in the extraction pipeline's known set. |
| `temporalFilter` | enum (`TODAY` \| `UPCOMING`) | Existing (AD-20) — "happening now" / "upcoming" | Existing, newly extractable | Caveat if status phrasing is outside the two values. |
| `isFree` | boolean, exact-text match | New — locked-vocabulary text match (`"free"`, `"gratis"`, etc.) against `Schedule.ticketPrice` | New | N/A within scope — any numeric price threshold ("under IDR 200K") is explicitly out of vocabulary and always produces a caveat; deferred to v2. |

## Explicitly out of vocabulary (always caveats, never parsed)

- Any numeric ticket-price threshold (e.g. "under IDR 200K") — deferred to v2 pending cross-currency normalization.
- Floor/wing/room-level location detail (e.g. "Lantai 2") — not geocodable; stays in `Schedule.location`'s raw text, shown but never filterable.
- Off-topic or open-ended chat content unrelated to filter extraction.

These three were independently validated as producing the same caveat mechanism, not three separate handlers.

## Expression operators (CAP-6)

Fields above are leaves. Leaves combine with `AND`, `OR`, `NOT`: depth ≤ 3, ≤ 12 nodes, `NOT` wraps a leaf or group only. `NOT` keeps events with no value for the negated field. Multiple locations are OR branches. Operators never introduce a new field; anything outside the table is still a caveat.

> **Field naming note (added 2026-10-15, FR98-FR103):** the `location.proximity`/`location.adminArea` dot-paths in the table above describe the **flat** `EventFilterInput.location` object (PRD §4.18). Inside a `FilterNode` expression leaf, these become two separate, mutually-exclusive leaf field names instead — `locationProximity` and `locationAdminArea` — so a single leaf can never represent both at once (the type-level guarantee behind "within one leaf the combination is a caveat, not an error," above). This is why multiple locations are expressed only as OR branches of separate leaves, never as one combined leaf.
