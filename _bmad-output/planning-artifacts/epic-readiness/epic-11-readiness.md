---
epic: 11
swept: true
date: 2026-11-27
stories_covered: [11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10, 11.11, 11.12, 11.13, 11.14, 11.15, 11.16, 11.18z, 11.19, 11.20, 11.21, 11.22]
---

# Epic 11 readiness: Extraction and honest dates

Gate 1 and Gate 3 from `story-split-gate.md` were run once for the whole epic. A single architect subagent (Winston persona) did the evaluation read only. The orchestrator then checked the key claims against the code on `claude/epic-11-readiness`.

The owner approved Sprint Change Proposal CC-261124-vjh, and this sweep does not reopen its decisions, scope or story order. Any finding that would change one of them is listed under "Questions for the owner".

Gate 2 (UI) stays per story, in `bmad-create-story`.

## Gate 1: architecture and infrastructure completeness

**No IaC gap.**
- The recompute step of 11.7 and the healing step of 11.12 run inside the existing 5-minute `job-engine-sweep`: `apps/infrastructure/lib/festgrid-backend-stack.ts` (around line 1059) and the step list in `run-job-engine-sweep.ts`.
- The merged call of 11.8 reuses the injected `callGemini`, which already goes through `callVendor` (AD-32).

**G1-1. No story owns the GraphQL fields for the new columns.** Affected stories: 11.7 (highlight composer), 11.13 (display flags and field map), 11.14 (grid card redesign), and 12.7 (price tiers) in Epic 12.
- The `Schedule` type in `apps/backend/src/schema/events.graphql` has no stage field, no display flag, no display dates and no highlight.
- `selectDisplaySchedule` runs on the client (`EventListView.tsx`, `home-content.tsx`), so it needs these fields from the API.
- AD-59 builds the detail highlight list at read time, which needs a resolver.
- *AC correction for `bmad-create-story`:*
  - 11.13 exposes the schedule's `stage`, `isDisplay`, `displayStartDate`, `displayEndDate` and `displayIsDummy`.
  - 11.7 exposes `Event.highlight` and a field for the detail list computed at read time, through the AD-17 field map.
  - 12.7 exposes the tiers and `fromPrice`.
  - `coreEventName` is never exposed (11.18z).

**G1-2. 11.22 (time dropdown and viewer's date): the server cannot learn the viewer's time zone.**
- `Query.events` computes "today" in UTC (`resolvers.ts`, around line 3625).
- `buildEventsQueryCondition` receives no time zone, and no GraphQL input carries one.
- *AC correction:* 11.22 names a new validated IANA time-zone argument on `Query.events` (and on the other list queries the four pages use), with the fallback order `users.timezone`, then the browser's zone, then `Asia/Jakarta`.
- Reason: the AC's "the pages pass a time zone to `resolveTodayISO`" does not reach the server condition.

**G1-3. 11.2 (replay gate): report item 4 and the 12.2 memory gate need the AI-processor Lambda's peak memory, but the existing replay harness runs locally.** The harness is `extraction-eval-run.ts` and `run-extraction-accuracy-eval.ts`. → Question Q1.

**G1-4. 11.21 (re-geocode of active schedules): the AC does not say which Gemini route the keywords call uses.**
- `generateLocationKeywords` needs an injected `callGemini` and subscriber ids, and a script has no subscriber.
- The POC called Gemini directly, which the AD-32 ratchet forbids.
- *AC correction:* the script calls the keywords step through the `callVendor` adapter with the system key, never directly.

**G1-5. 11.15 (layer-2 backfill in a local session): post images go to a model other than Gemini, outside the blur-before-AI path.**
- The blur-before-AI path is AD-28 Rule 10 in `build-gemini-request.ts`.
- The stored image links are expiring hotlinks.
- → Question Q2.

## Gate 3: foundational and cross-cutting dependencies

**G3-1. No story owns the "active event" selector or the data-script safety harness.** Tooling gap, so a new Epic 0 story.
- Consumers: 11.7 (recompute step), 11.11, 11.12, 11.15, 11.16 and 11.21, under the owner's backfill rule of 2026-11-26.
- The cutoff exists only inside the list query (`packages/graphql-select/past-cutoff-sql.ts`) and in the inline `isPastEvent` expression in the resolvers.
- The only backfill script (`apps/backend/scripts/backfill-overnight-end-dates.ts`) has `--apply` but no rollback copy.
- → **New Story 0.55** (below).

**G3-2. Two domain functions bound by AD-60 have no explicit builder.**
- The functions: the `core_event_name` / `activity_type` code rule (POC baseline only, `core-name-analyze.mjs`), and the splitter that turns stored price strings into tiers.
- The proposal (section 4, item 4) puts the code rule inside 11.11.
- The architect suggested splitting them out as 11.11a. That would change the story layout of the approved proposal, so it was not done. → Question Q4.

**Cross-epic checks:**
- 12.7 needs 11.8's tiers: covered, except for the GraphQL fields (G1-1).
- 12.2 needs 11.2: covered, except for the memory measurement (G1-3).
- Epic 10 is not affected: the stepped path keeps only the location call.

## New prerequisite stories

| Key | Section in `epics.md` | Classification | Why |
|---|---|---|---|
| `0-55-add-one-active-event-selector-and-one-data-script-harness-for-backfills-and-sweeps` (`backlog`) | Story 0.55, after Story 0.51 | tooling | One tested "active" rule built on the BUG-096 cutoff (`hide_after_days = 0`), plus one `--dry-run` / `--apply` / rollback harness, for the six Epic 11 data stories (G3-1). |

Stories 0.52 to 0.54 have no section in `epics.md` (they are standalone, see `sprint-status.yaml`), so 0.55 is the next free number.

## AC corrections

**Applied to `epics.md` now:**
- 11.5 (title rule v2) and 11.16 (clear online-only pins): the POC path is `_bmad-output/poc/registration-extraction/`, not `poc/...`.
- 11.11 (layer-1 backfill): Depends now includes 11.8, whose tier schema it uses. The story order already had 11.8 first.
- 11.7, 11.11, 11.12, 11.15, 11.16 and 11.21: Depends now includes Story 0.55.

**For `bmad-create-story`, to carry when each story is created:**
- **AC-1, 11.13 (display flags and field map).** The code facts are stale:
  - The three ORDER BY subqueries are raw SQL, not field-map reads (`resolvers.ts`, around lines 4174-4188).
  - Three more raw-date readers also have to move to the display columns, or the story must say why each one stays: the pinned-date keys (around lines 4145-4167), the weekly-calendar window (around lines 3904-3941), and `isPastEvent` / `isExpiredForCurrentUser`. BUG-096 needs these to stay exact complements of the list (`past-cutoff-sql.ts`).
  - `selectDisplaySchedule` uses UTC today.
- **AC-2, 11.9 (online-only skip) and 11.19 (default location inheritance).**
  - Today the event detail renders an ungated `LocationLink` (`packages/ui/src/core/LocationLink.tsx`, `EventDetailView.tsx` around line 579). The "0.i7c map-link gate" the AC names is not in this code (Story 0.i7c is `review`). The hide goes there.
  - Adding `online` and `account_default` to `LocationResolution` (`packages/shared-types`) must not widen `LocationLadderStepName` (`build-location-queries.ts`).
- **AC-4, 11.3 (new columns) and 11.10 (race-pack matching).**
  - The 11.3 migration adds a GIN trigram index on `core_event_name`. The dedup candidate search uses trigram `%` (`match-event-to-existing.ts`, index `idx_events_event_name_trgm`, migration 0065).
  - A wider race-pack window does not change the shared `DATE_WINDOW_DAYS = 2` (`match-scoring.ts`, also read by `drain-match-backlog.ts`).
- **AC-5, 11.6 (prizes, promos, free flag).**
  - A request-level `maxOutputTokens` already exists (`build-gemini-request.ts`), so the AC reads "re-size", not "add".
  - The story says whether `events.is_free` replaces the `ticketPrice ILIKE` free filter (`resolvers.ts`, around line 3752).
- **AC-6, 11.1 (prompt seam) and 11.2 (replay gate).**
  - Build on the existing eval harness (`extraction-eval-run.ts`, the domain `extraction-eval` scorer) and the schema-size check (`gemini-schema-complexity.ts`).
  - The gate must also replay 11.8's post-extraction call, which the eval does not score today.
- **AC-8, 11.7 (highlight recompute) and 11.12 (display-flag sweep).**
  - Cap the rows each run handles: both steps share the sweep Lambda's 300 s budget.
  - Say whether a null `highlight_rules_version` counts as older.
  - Add the infra-docs update to 11.7 as well (11.12 already has it).
- **Order:** no story depends on a story ordered after it. 11.13 reads `activityType` only "when present", so its link to 11.8 is soft.

## Questions for the owner (not applied)

- **Q1 (G1-3).** Where is peak memory measured for 11.2 report item 4 and the 12.2 gate?
  - *Recommendation:* replay through the dev-stage AI-processor Lambda, reading its PR #266 memory logs.
  - Either choice adds a step to 11.2.
- **Q2 (G1-5).** Does blur-before-AI apply to 11.15's local Claude session, and where do its images come from?
  - *Recommendation:* yes. Send only blurred images or the stored re-hosted copies, never live hotlinks, and record the answer in 11.15.
- **Q3 (G3-1).** Is Story 0.55 in Epic 0 acceptable, or should it sit in Epic 11 (for example as 11.16a)?
  - *Recommendation:* keep it in Epic 0. It is reusable tooling, and Epic 12's retention sweep (12.9) can use the same harness.
  - It must land before 11.16 and 11.21, which are early in the order.
- **Q4 (G3-2).** Should the core-name / activity-type code rule and the price-string splitter be split out of 11.11 as 11.11a?
  - *Recommendation:* no split. Add to 11.11's AC that both are `packages/domain` functions with 100% unit tests (AD-60), so the proposal's story layout stays as approved.
