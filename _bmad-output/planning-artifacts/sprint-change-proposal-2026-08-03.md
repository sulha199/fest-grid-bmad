---
title: "Sprint Change Proposal: Geolocation Provider Swap (Google -> Geoapify)"
status: "approved"
created: "2026-08-03T00:00:00Z"
---

# Sprint Change Proposal: Geolocation Provider Swap (Google → Geoapify)

## 1. Issue Summary

FestDaily's PRD and epics originally specified Google Geolocation/Places API for resolving `LocationDetails` (coordinates, place name, formatted address, timezone) used across saved locations, subscription default locations, and per-event/schedule locations.

A compliance review during this session found that Google's Maps Platform Terms of Service restrict long-term storage/caching of Places content — only `placeId` may be stored indefinitely; other returned fields (name, formatted address) fall under a general caching prohibition. This conflicts with FestDaily's design, which persists `LocationDetails` indefinitely in `UserLocationPreference` ("Home"/"Work") and `SocialMediaAccountProfile.defaultLocation` (PRD §4.5, §4.6).

A subsequent provider comparison (weighing storage/caching terms, cost, and Indonesia POI coverage) identified **Geoapify** as the preferred alternative:
- Explicitly permissive license — place data may be stored/cached indefinitely.
- Returns IANA timezone inline on the same geocode/reverse-geocode call (Google requires a separate Time Zone API call).
- Single API key covers geocoding, reverse geocoding, autocomplete, and POI/category search (Google splits Geocoding, Places, and Autocomplete into separate products with a session-token billing linkage between Autocomplete and Place Details).
- Generous free tier (~90k requests/month) comfortably covers MVP scale (PRD §5: 100 concurrent users, ~100 events/hour ingestion).

Discovered during planning, before any implementation — no shipped code touches Google Geolocation/Places (confirmed via `sprint-status.yaml` and the affected stories' own Dev Notes, which independently note no `apps/backend/src/lib/geolocation/` directory exists yet).

## 2. Impact Analysis

**Epic Impact:**
- **Epic 0:** Story 0.16 ("Set up Geolocation adapter with caching layer") is the epicenter — its `ready-for-dev` draft was deeply Google-specific (exact Geocoding/Places(New)/Time-Zone REST endpoints, `GOOGLE_MAPS_API_KEY`, a `google-maps-client.ts` filename, a Google Cloud billing dependency baked into its own Pre-Coding Approval Gate, and research citations on Google's SDK/pricing).
- **Epic 2:** Stories 2.3 and 2.3a reference the adapter only through its already-abstracted interface (`resolveLocation`, `GeolocationQuery`) — low impact, terminology only. Story 2.3b (undrafted, `backlog`) was built around Google's Autocomplete+Place-Details **session-token billing model**, which Geoapify has no equivalent of (single API key, no session-linkage) — a real (simplifying) content change, not just a rename.
- No epic added, removed, or resequenced. No epic becomes obsolete.

**Artifact Conflicts:**
- **PRD** (`prd.md` §5, External API Management): named Google Cloud Console and Google Geolocation specifically as if universal to every external API — updated to be provider-generic with Geoapify named alongside Gemini.
- **Architecture spine** (`festgrid-architecture-spine.md`): confirmed no AD names a geocoding vendor — **no change needed**.
- **UI/UX specs** (`design-artifacts/`): confirmed no map-tile/widget library (Google Maps JS, Leaflet, Mapbox, etc.) is referenced anywhere yet — Story 2.4 (map-pick UI) is still undrafted and its epics.md entry is already vendor-agnostic. **No change needed**; this proposal does not decide the separate map-display-widget question.
- **project-context.md**: confirmed no geolocation/geocoding vendor references (only an unrelated `GoogleLoginButton` for auth) — **no change needed**.
- **Other artifacts** (infra docs, `SETUP_WALKTHROUGH.md`, `.env.example`, CI): all Google-specific mentions here originate from Story 0.16's own scope — resolved by that story's regeneration, not a separate edit.

**Technical Impact:** None on shipped code — zero stories touching this are past `ready-for-dev`, and none have a corresponding implementation in the codebase.

## 3. Recommended Approach

**Selected: Option 1 — Direct Adjustment.** Effort: Low. Risk: Low (no shipped code affected). Rollback (Option 2) is inapplicable (nothing built yet); MVP/scope review (Option 3) is inapplicable (no scope or goal change — this is a provider substitution, not a feature change).

Story 0.16 specifically is treated as a **full regeneration** rather than a hand-patch: its draft was researched and written entirely around Google's exact API surface (endpoints, SDK, pricing, billing dependency), and hand-patching ~30 scattered references risked leaving stale Google-specific claims inconsistent with each other. Reset to `backlog` and to be regenerated via `bmad-create-story` against the updated `epics.md` text. User-selected approach (confirmed during this workflow).

Stories 2.3 and 2.3a, by contrast, only needed terminology patches — their mutation contracts, validation logic, and test plans were already written against the adapter's abstracted interface, not Google's raw shape.

## 4. Detailed Change Proposals

All edits below were presented incrementally and approved individually during this session.

### 4.1 PRD (`prd.md`, §5 External API Management)
- Replaced Google-Cloud-Console-specific API key restriction language with provider-generic wording naming each provider's actual mechanism (Google Cloud Console for Gemini; Geoapify's own dashboard domain/IP restrictions for geolocation).
- Replaced "(e.g., Google Gemini, Google Geolocation)" → "(e.g., Google Gemini, Geoapify)" and "external APIs like Google Geolocation" → "external APIs like Geoapify".
- Bumped frontmatter `updated` timestamp.

### 4.2 epics.md — Story 0.16
- Renamed provider throughout (Google Geolocation/Places → Geoapify Geocoding/Places/Reverse-Geocoding).
- Added a new AC: timezone resolution reuses the same Geoapify geocode/reverse-geocode response (`timezone.name`, IANA) rather than a separate Time Zone API call — a genuinely new fact vs. the Google-based design.
- Appended a note recording the provider change and pointing to this proposal.

### 4.3 epics.md — Story 2.3b
- Renamed Google's Places API (New) Autocomplete endpoint reference to Geoapify's Geocoding Autocomplete endpoint.
- **Removed** the client-generated session-token AC and the `sessionToken` parameter from both the adapter method signature and the `addressAutocomplete` GraphQL query — Geoapify has no session-token/billing-linkage concept between autocomplete and place-details calls, so carrying this forward would encode a Google-specific mechanic into a Geoapify-backed schema.

### 4.4 Story files — terminology-only patches (no contract change)
- `2-3a-build-the-saved-locations-backend-graphql-api-layer.md`: 6 literal "Google" references renamed to "Geoapify"/"the geolocation provider" across its AC, Dev Notes, and testing sections.
- `2-3-manage-saved-locations.md`: 1 literal "Google" reference renamed.

### 4.5 sprint-status.yaml
- `0-16-set-up-geolocation-adapter-with-caching-layer`: `ready-for-dev` → `backlog`, with an inline comment recording why and pointing at this proposal, pending regeneration via `bmad-create-story`.
- No epic-level changes — Epic 0 remains `in-progress` (other Epic 0 stories are unaffected and several are already past this point).

## 5. Implementation Handoff

**Scope classification: Minor.** No epic restructuring, no PRD scope change, zero shipped code affected — this is a planning-artifact correction plus one story regeneration.

- **Immediate next step:** Run `bmad-create-story` for Story 0.16 (delegated to a sub-agent per user's request) against the now-updated `epics.md` text, producing a fresh, internally-consistent story file (Geoapify endpoints, `GEOAPIFY_API_KEY` env var, matching Dev Notes/research citations, no residual Google-specific content).
- **Developer agent:** Once 0.16 is regenerated and `ready-for-dev`, proceeds with normal `bmad-dev-story` flow — no special handling needed beyond what any story requires.
- **Story 2.3b:** Remains `backlog`, undrafted — whoever eventually runs `bmad-create-story` for it will read the now-corrected epics.md text directly; no further action needed now.
- **Success criteria:** Story 0.16's regenerated file contains no references to Google/Google Maps Platform/Google Cloud Console; PRD/epics/story-file text is internally consistent (grep for "Google" across `_bmad-output/` should only match the unrelated `GoogleLoginButton`/"Sign in with Google" auth feature).

