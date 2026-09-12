---
epic: 0.i7
swept: true
date: 2026-09-13
stories_covered:
  - 0.i7a
  - 0.i7b
  - 0.i7c
  - 0.i7d
  - 0.i7z
---

# Epic 0.i7 Readiness Sweep — Confidence-aware Geoapify location resolution

**Method:** `bmad-epic-readiness-check`, Gate 1 + Gate 3 (`story-split-gate.md` §5/§7), run once against the
epic's full story list. Evaluation dispatched to a single Winston (`bmad-agent-architect`) subagent pass
against inlined code evidence (not re-derived by the subagent).

**Evidence base:** `apps/backend/src/lib/geolocation/geoapify-client.ts`, `adapter.ts`, `cache-store.ts`;
`apps/backend/src/lib/ai-processor/resolve-account-and-locations.ts`; `packages/shared-types/src/index.ts`
(`LocationDetails`); `packages/database/schema.ts` (`socialMediaAccountProfiles`); all `resolveLocation(`
call sites in `apps/backend/src/schema/resolvers.ts`; `apps/web/src/features/events/mapper.ts`;
`events.graphql`/`geolocation.graphql`; `formatLocationDetails()`; `project-context.md`; Architecture
Spine AD-8.

---

## Gate 1 — Architecture / Infrastructure Completeness

**Four findings, all corrections to existing story AC text (no new story required for any of these four):**

1. **0.i7b unbuildable as scoped.** `geocodeAddress` requests `limit=1` and indexes `data.results[0]`;
   `getPlaceDetails` is a single-id lookup. Neither retains a candidate list, so 0.i7b's "re-rank by
   confidence, not position" AC has nothing to re-rank against. **Correction applied to Story 0.i7a**
   (which already owns these mappers): `geocodeAddress`'s search path now requests and retains the top 5
   candidates (matching the existing `getAddressPredictions` convention), each carrying `confidence`/
   `matchType`. 0.i7b's own text gained a Note cross-referencing this dependency.

2. **No-TTL, unversioned cache silently defeats the ratchet for every pre-existing row.**
   `cache-store.ts` has no TTL and no schema-version field; a cache HIT for anything resolved before this
   epic ships returns a `confidence`/`matchType`-less blob forever, and 0.i7z's CI check (which inspects
   code paths, not runtime cache contents) would pass green while production silently violates the
   invariant for most already-cached lookups. **Correction applied to Story 0.i7a**: existing
   `GeolocationCache` rows are evicted/replaced on this story shipping (AD-8 already treats this table as
   evict/replace-only, so no new architectural pattern is introduced).

3. **"Account's own country" bias has no data source.** Neither `socialMediaAccountProfiles` nor
   `LocationDetails` carries any country field today. **Correction applied to Story 0.i7a**: adds a
   `countryCode` field to `LocationDetails` (populated by all three mappers) and derives the bias from the
   account's own `defaultLocation.countryCode` when present, no bias otherwise. **Human decision:** user
   confirmed via AskUserQuestion that this graceful, self-healing degradation (most existing accounts will
   have no bias source until their `defaultLocation` is next re-resolved) is acceptable — not escalated
   further.

4. **0.i7c's AC omits the GraphQL SDL/codegen wiring `mapper.ts` needs to read `confidence` at all.**
   `events.graphql`'s `LocationDetails` type has no `confidence`/`matchType` field; `apps/web`'s generated
   types and query selection sets don't request them. `formatLocationDetails()` already spreads the whole
   resolved object through (no field whitelist blocking it), so the only two remaining gaps are the SDL
   declaration and the frontend query/codegen. **Split cleanly across two corrections:** Story 0.i7a now
   declares the new fields on the `LocationDetails` SDL type (data-layer, alongside its other schema
   changes); Story 0.i7c now includes the `apps/web` query-selection + codegen-regen AC so `mapper.ts` can
   actually read a real value from a query response.

## Gate 3 — Foundational / Cross-Cutting Dependency Completeness

**One finding — the epic's own invariant statement was broader than its enforcement surface.**

`resolveLocation()` (the sole non-test entry point into the confidence-bearing mappers) has 7 known call
sites, not the 2 originally named in 0.i7z: `resolve-account-and-locations.ts` and `mapper.ts`'s consumer
chain (both already in scope), plus 5 more in `apps/backend/src/schema/resolvers.ts` —
`setAccountDefaultLocation`, `editAccountDefaultLocation` (moderator correction), `createUserLocation`,
`updateUserLocation` (Story 2.3a saved locations), and the `previewLocation` query (Story 2.4b map-picker
preview). None were named in 0.i7z's CI-enforceable AC, even though the epic's invariant itself is
unqualified ("no consumer..."). A future reader of a green 0.i7z CI run would reasonably conclude full
coverage exists when it would not have.

**Human decision, via AskUserQuestion:** user chose to widen coverage to all 7 rather than carve out the
3 `userLocations` call sites as a different (user-supervised) trust model.

**Resolution:** since none of the 5 additional call sites had any story building confidence-aware
behavior into them, widening 0.i7z's AC alone would have made it police consumers nothing implements.
Added **new Story 0.i7d** (single-story split, epic-internal — this need is not shared by any other
epic) to expose `confidence`/`matchType` through all 5, explicitly scoped narrowly (exposure only, no new
UX gating — these are user-supervised flows, a different trust model from 0.i7b/0.i7c's AI-best-effort
matching). 0.i7z's AC and Depends-on updated to include all 7 consumers and Story 0.i7d.

---

## New prerequisite stories created

| Story | epics.md section | Classification |
|---|---|---|
| `0.i7d` | "Expose confidence/matchType through the remaining Geoapify-consuming mutations and the location-preview query" | Single-story split, epic-internal (Gate 3 finding) |

`sprint-status.yaml` entry `0-i7d-expose-confidence-matchtype-through-the-remaining-geoapify-consumers: backlog`
inserted between `0-i7c` and `0-i7z`.

## AC corrections applied directly to existing stories (no new story number)

| Story | Corrections |
|---|---|
| `0.i7a` | Multi-candidate retention for `geocodeAddress`'s search path; `countryCode` field + graceful-degradation bias; cache eviction on ship; SDL field declarations |
| `0.i7b` | Note cross-referencing its dependency on 0.i7a's candidate-retention amendment |
| `0.i7c` | AC added for `apps/web` query-selection + codegen regen |
| `0.i7z` | AC widened from 2 to 7 enforced call sites; `Depends on` extended to include `0.i7d` |

## Next step

Create Epic 0.i7's stories one at a time via `bmad-create-story`, in `epics.md` order (0.i7a → 0.i7b →
0.i7c → 0.i7d → 0.i7z). Each will skip Gate 1/Gate 3 (citing this report) and run only Gate 2.
