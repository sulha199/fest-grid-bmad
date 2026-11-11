---
title: 'Per-field accuracy eval of event extraction against labelled posts'
type: 'feature'
created: '2026-11-11'
status: 'in-progress'
backlog: 'IDEA-261111-5cc'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/festgrid-architecture-spine.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Nothing scores event extraction itself, field by field, against labelled data. The only golden corpora cover event categories (`apps/backend/src/lib/ai-processor/event-category-golden-corpus.fixtures.ts`, manual, caption-only) and the AI-filter prompts (`.github/workflows/ai-filter-golden-prompt-nightly-eval.yml`). Prompt, schema or model changes are judged by one-off scripts on a handful of posts. Example (2026-11-11, location-keywords work): a per-date-place prompt rule made the model fold one tournament held the same day at 7 mall branches into ONE event with 7 schedules and location "Indonesia" in 6 of 6 live runs (master: 7 events in 5 of 5). It was found only because that post happened to be chosen and run repeatedly. A second finding of the same work: moving one sentence of a rule from one prompt section to another changed per-date places on another post (distinct places per date 5 of 6 runs vs 1 of 6), invisible on a single run.

**Approach:** A labelled set of real posts (frozen images, hand-verified expected fields) is run through the real extraction request builder and Gemini several times per post; a pure scorer reports accuracy per field (a field x pass-rate table), compared with a baseline stored in the repo and a noise band measured from the repeats. It runs (1) non-blocking on PRs that touch extraction-affecting paths, (2) weekly for model drift, (3) manually before a model switch, and its scoring code is unit-tested offline on every PR. Slice A is buildable without production data or API keys; slice B needs the maintainer.

## Boundaries & Constraints

**Always:** Reuse, do not fork, the production request path: `buildGeminiExtractionRequest` (build-gemini-request.ts), the gateway client `callGeminiGenerateContent` (gemini-client.ts, returns `finishReason` and `usage`), then the same validation/normalization the pipeline applies (`validateExtractedEvent`, `stripMalformedLocationKeywords`, domain transform). Scoring is a pure domain module with no I/O (`packages/domain`), tested on recorded outputs. Fields scored per post and per run: `groupingReason`, event count, per event (matched to labelled events by normalized name, then start date): `eventName`, per schedule `eventStartDate`, `eventEndDate`, `eventStartTime`, `eventEndTime`, schedule/event `location` (normalized text match; geocoded closeness is optional and lives in the runner, not the scorer), `ticketPrice`/free, `categories` (precision and recall), `performers`. Each post runs N times (default 3; configurable) because the model is non-deterministic: report a pass-rate per field per post, then aggregate. A baseline file (committed JSON: per-field pass-rate, run count, model name, prompt hash, date) is compared with the current run; a field is flagged only when it drops by more than the noise band (computed from the spread of the repeats, with a floor), never on a single run. Pace live calls (default 5 s between calls, retry 429/503 with growing waits): the system Gemini key returns 429 when called quickly (observed 2026-11-11). Count truncation (`finishReason` MAX_TOKENS / unparseable JSON) as its own reported outcome per post, not as a wrong field. Live runs are never a blocking CI gate (AD-44 Rule 10: non-deterministic, real quota): PR runs report, they do not fail the merge, unless a later decision changes that. Triggers: path-filtered PR run (extraction prompt/schema/model/gateway/normalizer paths), weekly schedule, `workflow_dispatch`; plus the offline scorer tests on every PR through the normal CI.

**Ask First:** Where the frozen images and labels live. The repo is PUBLIC: third-party Instagram images and anything personal in a post (a private phone number, a wa.me link, a face) must not be committed. Proposed: a private S3 bucket (the project already has one for DB backups) fetched by the workflow with AWS credentials, with only label JSON that contains no personal data in the repo; the maintainer decides. Also ask: whether moderator corrections in production may seed the labels (needs the maintainer to export; the cloud session has no production access), the first baseline run (needs `SYSTEM_GEMINI_API_KEY` and the labelled set), and whether the PR run should ever become blocking.

**Never:** No production database access or writes from the eval. No images, captions or labels with personal contact data in the repo. No change to the extraction prompt, schema or pipeline in this work (it measures them). No replacement of the category corpus or the AI-filter nightly eval; they stay as they are (the new runner may share their pacing/drift helpers). No live Gemini calls in unit tests or default CI.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Perfect run | model output equals labels | every field 100 % for that run | N/A |
| Event split vs fold | labelled 7 events, model returns 1 event x 7 schedules | event count and `groupingReason` fields fail; per-event fields unmatched, not scored as zero-everything | reported as `count_mismatch` |
| Event match | labelled event renamed slightly by the model | matched by normalized name then start date; unmatched labelled events count as misses | N/A |
| Truncated output | `finishReason` MAX_TOKENS or JSON parse error | post-run outcome `truncated`, excluded from field pass-rates and counted separately | not an exception |
| Quota | 429/503 | paced retry; after the cap the run is `unavailable`, never counted as wrong | reported, run continues |
| Noise | field flips 2 of 3 runs at baseline and now 1 of 3 | within the noise band: not flagged | N/A |
| Real drop | field pass-rate falls beyond the band | flagged in the report with the posts that changed | non-blocking |
| New labelled post | no baseline row | reported as new, not compared | N/A |
| Recorded replay | `--replay recorded.json`, no network | same scores as the live run that recorded it | N/A |

</frozen-after-approval>

## Code Map

- `apps/backend/src/lib/ai-processor/build-gemini-request.ts`, `apps/backend/src/lib/ai-gateway/gemini-client.ts` -- the request builder and client the runner reuses (read their signatures; `buildGeminiExtractionRequest(message, options?)`)
- `apps/backend/src/lib/ai-processor/event-category-golden-corpus.fixtures.ts`, `.live-eval.test.ts` -- precedent for opt-in live evals (env gate, pacing, fixture shape); do not change
- `apps/backend/scripts/run-golden-prompt-live-eval.ts`, `.github/workflows/ai-filter-golden-prompt-nightly-eval.yml`, `packages/domain/src/ai-event-filters/golden-prompts/` (`compute-golden-prompt-drift.ts`, `plan-golden-eval-window.ts`) -- scheduling, pacing and drift helpers to reuse or mirror
- `apps/backend/src/validation/extracted-event.schema.ts`, `packages/domain/src/events/` -- validation and normalizers applied after the model answers
- New: `packages/domain/src/extraction-eval/` (pure scorer, matcher, noise band, report builder, fixture/label types) with tests; `apps/backend/scripts/run-extraction-accuracy-eval.ts` (live runner + replay mode); `.github/workflows/extraction-accuracy-eval.yml`; a docs page `docs/infrastructure/extraction-accuracy-eval.md` (what it measures, how to add a labelled post, how to read the report)

## Tasks & Acceptance

**Execution (slice A, offline, no keys or production data needed):**
- [x] `packages/domain/src/extraction-eval/` -- label/fixture types (JSON schema or Ajv, validated at load), event matcher, per-field scorers, aggregate (per post, per field), noise band, baseline comparison, report (Markdown table plus JSON); each with unit tests on recorded model outputs, including the split-vs-fold, truncated, quota and noise rows of the matrix
- [x] `apps/backend/scripts/run-extraction-accuracy-eval.ts` -- loads labelled posts from a directory (path from an env var or flag), builds the request with the production builder, calls the gateway client with pacing and retries, records raw outputs to a JSON file, scores, prints the table; `--replay <recorded.json>` scores without network; `--runs N`, `--only <postId>`
- [x] `.github/workflows/extraction-accuracy-eval.yml` -- triggers: path-filtered `pull_request` (non-blocking, posts the report as a PR comment or job summary), weekly `schedule`, `workflow_dispatch`; fetches the labelled set from the private store only when the secrets exist, otherwise runs the offline scorer tests and says so; never uploads images or captions as artifacts
- [x] Offline scorer tests run in the existing CI test jobs; a ratchet or lint rule is not required
- [x] Docs page, backlog row updated, spec status
- [x] A small SYNTHETIC labelled fixture set (3-5 made-up posts with invented captions and generated placeholder images, no real data) so the runner and the workflow can be exercised end to end

**Execution (slice B, needs the maintainer; out of scope for an unattended session):**
- [ ] Decide the store for frozen images and labels (Ask First), export and hand-verify 40-60 labelled posts across: single event, program lineup, roundup, one event at many places on different dates, same occasion at several venues on one date, caption-less poster, foreign venue, multi-slide carousel
- [ ] First live baseline run, committed baseline JSON; incident regression cases (Samsat per-date places; Sony Center 7 branches; the 203-event roundup)

**Acceptance Criteria:**
- Given labelled posts and recorded model outputs, when the scorer runs, then it prints a per-field pass-rate table and the numbers equal a hand calculation on the synthetic fixtures.
- Given a recorded output that folds 7 labelled events into one event with 7 schedules, when scored, then event count and grouping fail and the report says `count_mismatch`.
- Given the same posts re-run with a field flipping within the noise band, when compared with the baseline, then nothing is flagged; given a drop beyond the band, then that field and the changed posts are listed.
- Given a truncated or unparseable answer, when scored, then it is reported as `truncated` and does not lower any field pass-rate.
- Given `--replay`, when run with no network or keys, then it completes and matches the recorded live run's scores.
- Given a PR that touches only docs, when CI runs, then the eval workflow does not run; given a PR touching the extraction prompt, then it runs non-blocking and never fails the merge on a score drop.
- Given the repo, when searched, then no real image, real caption or personal contact data was added.

## Spec Change Log

- 2026-11-11: owner review follow-up (item 8): the eval blurs faces before images reach the model, as production does by default (AD-28): it follows `BLUR_FACES_BEFORE_AI`, treats every post as an account that has not opted in (no database), and fails closed. Decided: keep the spec's date-only event match until the first real baseline.
- 2026-11-11: owner review of the slice A PR, applied: baseline comparison only over posts present on both sides (a new or removed post is reported, never flagged); the truncated rate is stored in the baseline and a rise is flagged; the live path never runs on `pull_request` (secrets); events match on name and start date together before name alone; a free label needs an explicit free word, a 0 price or no price; a missing or empty labelled directory exits 1; one run per post cannot flag a drop. Synthetic fixtures are now asserted by a domain test.
- 2026-11-11: decided on PR review: per-event scoring over matched events stays; the report lists unmatched labelled events and extra model events per post (names only with `--show-names`, the repo is public); noise band 2 sd / floor 15 points is a starting value with a `--noise-floor` flag; `GEMINI_MODEL` is not pinned and the gateway does not return the model version, so the configured string is recorded; a skipped S3 fetch writes a one-line reason to the job summary.
- 2026-11-11: decided on PR review: the slice A eval scores the first extraction call only (whole-chain scoring is the follow-up IDEA-261111-9ch); a live run saves its recording after every call and keeps it on a hard error.
- 2026-11-11: slice A implemented (scorer in `packages/domain/src/extraction-eval/`, runner with `--replay`, non-blocking workflow, synthetic set, docs page). Per-event fields are scored over matched events only; a missing labelled event counts once as an `eventName` miss. Slice B open.
- 2026-11-11: created from the location-keywords live checks (see the problem statement). Two slices: A offline and buildable unattended, B needs the maintainer (labelled data, keys, first baseline).

## Design Notes

Why repeated runs and a noise band: the model is non-deterministic and the effects that matter show only across repeats (6 of 6 vs 0 of 5; a per-date place count 5 of 6 vs 1 of 6). One run per post, or a hard threshold, would either miss them or flag noise.

Why the images must be frozen: signed Instagram image links expire about 4.5 days after scraping, so a corpus of URLs rots; a fresh-post A/B on 2026-11-11 needed production access just to find links that still worked.

Why not blocking: AD-44 Rule 10 and the free/limited Gemini quota (the system key returned 429 under 4 parallel workers; sequential with 5 s spacing worked; 60 posts x 3 runs is about 180 calls, 15-20 minutes). The weekly run exists because the model name may be an alias that changes behind the same string (check whether `GEMINI_MODEL` is pinned and record it in the baseline).

Scoring notes: match labelled events to model events by normalized name, then by earliest start date; unmatched events are misses and extras are reported, not scored. Location accuracy in the scorer is a normalized text/keyword match; the closeness-by-geocoder check from the location-keywords POC (a hit within N km of the labelled place) belongs in the runner as an optional extra because it needs a Geoapify key and the network.

Reference numbers from 2026-11-11 for sanity checks once a corpus exists: extraction of a 5-event roundup post returns 5 events x 3 schedules; a caption-less 4-date poster returns 1 event x 4 schedules (`dependent-stages`); output is about 2.3-2.4K tokens for those, and a 7-branch post sometimes runs to the token cap (cut-off JSON in about 1 of 5 runs on master).

## Verification

**Commands:**
- Rebuild `@festgrid/domain` dist; `pnpm --filter @festgrid/domain test`; backend `tsc --noEmit` and `lint`; `pnpm --filter backend exec tsx scripts/run-extraction-accuracy-eval.ts --replay <fixture>` on the synthetic set -- expected: green, table printed

**Manual checks (maintainer, slice B):**
- First live run on the labelled set; read the table with the maintainer; commit the baseline only after reviewing the per-post differences.
