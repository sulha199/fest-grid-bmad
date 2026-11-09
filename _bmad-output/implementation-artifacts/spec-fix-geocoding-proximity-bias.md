---
title: 'Fix wrong geocoding of schedule locations (proximity bias + minimum confidence)'
type: 'bugfix'
created: '2026-11-09'
status: 'draft'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Schedules "Pasar Porosjayan" / "Sunmor Stadion Maguwoharjo…" of a Sleman account were stored with a Palu pin (confidence 0, `full_match`, Asia/Makassar): `geocodeAddress` sends only a country bias and `selectBestCandidate` has no minimum, so a confidence-0 hit in the wrong province wins and also sets the wrong timezone.

**Approach:** Bias the Geoapify search toward the account default location's coordinates (combined with the country bias), reject ADDRESS candidates below a minimum confidence so the address stays unresolved (existing best-effort path), and fold the rounded anchor into the cache key.

## Boundaries & Constraints

**Always:** Proximity is a bias, never a filter (`bias=proximity:<lon>,<lat>|countrycode:<cc>`, lon first, per Geoapify docs). Minimum confidence is 0.5 (decided by the user; reuse `MIN_TRUSTWORTHY_CONFIDENCE` as a named constant); confidence 0 is always rejected; a candidate with no `rank` (confidence undefined) stays accepted (AD-14 fixtures/legacy). A rejection throws `GeolocationNotFoundError` before `setCached`, never cached. Cache key without an anchor stays byte-identical to today's.

**Ask First:** Any distance/country plausibility guard (user decided: none), a different threshold.

**Never:** Touch blur/extraction logic, schedule-count handling, roundup caps or the prompt; write to prod or run backfills; hard-filter by region.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Regression | Candidates: Palu (conf 0) + Sleman (conf ≥0.5) | Sleman chosen | N/A |
| Only junk | All candidates conf 0 or <0.5 | Unresolved; timezone falls back to account's | `GeolocationNotFoundError`, caught by schedule path, not cached |
| Anchor | defaultLocation has coordinates | URL has `bias=proximity:lon,lat%7Ccountrycode:cc`; key ends `\|near:lat2,lng2` | N/A |
| No anchor | No coordinates, or default location confidence <0.5 | Today's behavior and key | N/A |
| Two accounts | Same address, Sleman vs Jakarta anchor | Different cache keys | N/A |

</frozen-after-approval>

## Code Map

- `packages/domain/src/geolocation/types.ts` -- `GeolocationQuery` ADDRESS gains `proximityBias?: Coordinates`.
- `packages/domain/src/geolocation/select-best-candidate.ts` -- add min-confidence filter + constant.
- `packages/domain/src/geolocation/build-cache-key.ts` -- fold rounded anchor (2 decimals ≈1.1 km).
- `apps/backend/src/lib/geolocation/geoapify-client.ts` / `adapter.ts` -- bias param; filter then throw.
- `apps/backend/src/lib/ai-processor/resolve-account-and-locations.ts` -- pass anchor from `defaultLocation.coordinates`.
- `apps/backend/src/lib/ai-processor/resolve-schedule-timezones.ts` -- verified: tier 1 resolved tz, tier 2 account tz, tier 3 subscriber, tier 4 NEEDS_CLARIFICATION (no change).
- Other ADDRESS callers: `schema/resolvers.ts` (user/account location inputs), `accounts/backfill-account-profile-and-infer-location.ts` (no anchor; get the min-confidence gate).

## Tasks & Acceptance

**Execution:**
- [ ] `packages/domain/src/geolocation/*` -- types, `GEOCODE_MIN_CONFIDENCE`, `filterAcceptableCandidates`, `roundProximityAnchor`, cache-key segment, `proximityAnchorOf(location)` -- pure, testable
- [ ] `apps/backend/src/lib/geolocation/geoapify-client.ts` -- `proximityBias` option, combined `bias` value -- fix cause
- [ ] `apps/backend/src/lib/geolocation/adapter.ts` -- round anchor, filter, throw on empty, never cache rejection
- [ ] `apps/backend/src/lib/ai-processor/resolve-account-and-locations.ts` -- pass anchor
- [ ] Tests next to `build-cache-key`, `select-best-candidate`, `geoapify-client`, `adapter`, `resolve-account-and-locations`, plus `resolve-schedule-timezones` (no resolved location → account tz); Porosjayan fixture (Palu 0 + Sleman); cache cleanup per project-context
- [ ] `apps/backend/scripts/purge-zero-confidence-geocode-cache.ts` -- dry-run by default; `--apply` deletes GEOCODE cache rows with stored `confidence` = 0
- [ ] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` -- AD-14 rule 3 (proximity + min confidence); no docs/infrastructure change

**Acceptance Criteria:**
- Given the Porosjayan fixture, when resolved, then Palu is never chosen.
- Given Sleman and Jakarta anchors, when the same address resolves, then cache keys differ and a rejected lookup writes no row.
- Given no resolvable location, when timezones resolve, then the account's default timezone is used.

## Design Notes

Rejection reuses the existing "not found" path, so no caller changes. Side effect to review: user-typed addresses in resolvers now get "No geolocation match found" for <0.5 matches instead of a stored low-confidence pin. Existing poisoned cache rows stay until the script is run (by the owner).

## Verification

**Commands:**
- `pnpm --filter backend lint && pnpm --filter backend build` -- expected: success
- `cd apps/backend && TZ=UTC npx cross-env NODE_ENV=test tsx --test --test-concurrency=1 <files>` -- expected: pass
- `cd packages/domain && npx tsx --test src/geolocation/*.test.ts` -- expected: pass
