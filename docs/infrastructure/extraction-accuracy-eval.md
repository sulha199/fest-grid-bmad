# Extraction accuracy eval

Scores event extraction field by field against hand-labelled posts, over repeated runs, with a baseline and a noise band.
Backlog: IDEA-261111-5cc. Spec: `_bmad-output/implementation-artifacts/spec-extraction-accuracy-eval.md`.

## What it measures

Each labelled post is sent through the production request builder (`buildGeminiExtractionRequest`) and gateway client, N times
(default 3), then through the same post-answer step as the pipeline (JSON parse, `stripMalformedLocationKeywords`, schema
validation). A pure scorer in `packages/domain/src/extraction-eval/` compares each answer with the label:

| Field | Pass when |
|---|---|
| `groupingReason` | equals the label (skipped for a non-event post) |
| `eventCount` | model event count equals the labelled count |
| `eventName` | normalized name equals or contains the label's (a labelled event the model did not produce counts once as a miss) |
| `startDate`, `endDate`, `startTime`, `endTime` | per labelled schedule, matched by start date; only fields the label states are scored |
| `location` | every word of the labelled place appears in the model's location (normalized text, no geocoding) |
| `ticket` | digits of the price match a schedule price, or (`free: true`) no schedule carries a price |
| `categoriesPrecision`, `categoriesRecall` | share of model categories that are right, and of labelled ones found |
| `performers` | share of labelled performers found |

Events are matched by normalized name, then by earliest start date. Per-event fields are scored over matched events only, so a
fold of 7 labelled events into 1 reports `count_mismatch` (event count and grouping fail) instead of zero on everything.
Extra model events are reported, not scored. Location keywords are not scored (a separate call fills them).

Scope: the eval scores the **first** extraction call of a post, with every labelled slide sent. It does not replay the pipeline's
stepped extraction (AD-49: an at-risk answer is split in half and retried) or its per-call event cap, so a post the pipeline would
recover through a split shows up here as `truncated` or `count_mismatch`.

Outcomes that are not a wrong answer are reported apart and never lower a pass-rate: `truncated` (finish reason `MAX_TOKENS` or
unparseable/invalid JSON) and `unavailable` (429/503 after the retry cap, a spent daily quota, or a post whose labelled images
could not all be sent: the production builder falls back to a text-only request when an image fetch fails, so the runner makes
no call for that post and says so, instead of booking a harness fault as a wrong extraction).

Read the `truncated` count as a signal too: an answer that fails JSON parsing or schema validation is classed as truncated, so a
change that makes the model return invalid output shows up there, not in the field pass-rates.

## Reading the report

The table gives one pass-rate per field (mean over posts of the mean over answered runs). With a baseline it adds the baseline,
the delta in points, the noise band and a status:

- **noise band** = 2 x the standard deviation of the per-run aggregates (the repeats), never below 15 points and never above
  50. A field is `flagged` only when it fell by more than its band; one flipped run never flags. Flagged fields list the posts
  that changed. The numbers are a **starting value, to tune after the first real baseline**. The floor is the
  `--noise-floor <points>` flag (default 15, from `DEFAULT_NOISE_FLOOR`); the multiplier `NOISE_BAND_SIGMAS` (2) and the cap
  `MAX_NOISE_BAND` (0.5) are constants in `packages/domain/src/extraction-eval/aggregate.ts`. The cap exists because a band
  above 100 points could never be exceeded, so such a field would never be checked.
- The spread is measured only over posts that answered **every** run: a post that dropped out of some runs (truncated, quota)
  would change the mix of posts between runs, and that change would be counted as model noise. Runs are lined up by their real
  run number. With no post complete, the band is the floor.
- `improved`, `ok`, `new` (field or post absent from the baseline), `no_data`.

**Outcomes and count_mismatch detail.** Under "Outcomes" each post with a truncated or unavailable run, a `count_mismatch`, a
labelled event the model never produced, or an extra model event is listed, because the per-field rates alone hide these (a
fold of 7 events into 1 shows `eventName` 14 %, not which six events went missing). The detail lines are:

- `Labelled events missing (runs missed of N)`: the labelled events with no model counterpart, by their position in the label
  (`#2`, `#4`), with the number of answered runs in which each was missed.
- `Extra model events (reported, not scored)`: how many events the model added that match no labelled event.

Event names are left out by default, because the report goes to the job summary of a public repo and the names come from the
private labelled set. Pass `--show-names` on a local run to print them (and to keep them in the `--json` file; without the flag
the JSON shows `(hidden)`).

The eval never fails a merge. Live runs are non-deterministic and use real quota (AD-44 Rule 10).

## Running it

```bash
# Offline: score recorded answers (no network, no key). The synthetic set:
F=apps/backend/scripts/fixtures/extraction-eval-synthetic
pnpm --filter backend exec tsx scripts/run-extraction-accuracy-eval.ts --dir $F --replay $F/recorded.json

# Live (needs a labelled dir and a key): records raw answers, then scores
EXTRACTION_EVAL_DIR=/path/to/labelled EXTRACTION_EVAL_GEMINI_API_KEY=... \
  pnpm --filter backend exec tsx scripts/run-extraction-accuracy-eval.ts --runs 3 --record recorded.json
```

Options: `--only <postId>`, `--baseline <file>` (default `<dir>/baseline.json`), `--write-baseline <file>`, `--json <file>`,
`--interval-ms` (default 5000; a whole number of milliseconds, an empty variable counts as unset), `--runs N` (default 3), `--noise-floor <points>` (default 15), `--show-names`. With no key or no dir the live path says so and exits 0. A live run in which no call got an answer (quota spent, 429/503 on
every call, unreadable images) exits 1, like the golden-prompt eval; any score, however low, exits 0. Replay of the synthetic set gives, by
hand calculation: groupingReason 83 %, eventCount 88 %, eventName 89 %, startDate/startTime/endTime/categories 100 %,
location 67 %, ticket 83 %, performers 75 %, endDate n/a; 10 scored runs, 1 truncated, 1 unavailable, 1 `count_mismatch`.

## Variables and secrets

| Name | Where | Purpose | Required |
|---|---|---|---|
| `EXTRACTION_EVAL_DIR` | env (runner) | Folder of `<postId>/label.json` posts; the same as `--dir` | One of the two for any run |
| `EXTRACTION_EVAL_GEMINI_API_KEY` | env / workflow secret | Gemini key for the live run | Live only (or `SYSTEM_GEMINI_API_KEY`) |
| `SYSTEM_GEMINI_API_KEY` | env | Fallback key when the line above is unset | Optional |
| `EXTRACTION_EVAL_MIN_INTERVAL_MS` | env | Pause between live calls, default 5000 (the system key returns 429 when called quickly) | Optional |
| `GEMINI_MODEL` | env | Model for the live run; default `gemini-3.5-flash-lite` (see below) | Optional |
| `GEMINI_MAX_OUTPUT_TOKENS` | env | Read by the production request builder, default 8192; set it like production when comparing | Optional |
| `EXTRACTION_EVAL_S3_URI` | workflow secret | `s3://bucket/prefix` of the private labelled set | Live path in CI only |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` | workflow secrets | Read access to that store | Live path in CI only |
| `GITHUB_STEP_SUMMARY` | set by GitHub Actions | The runner appends the report there | Automatic |
| `BACKEND_PORT`, `DATABASE_URL` | env (set by the workflow and the runner) | Placeholders: backend modules read them at load; the eval never queries a database | Automatic |

Without the CI secrets the workflow replays the synthetic set and writes the reason into the job summary. Where the labelled
set itself is stored (the private S3 bucket or another store) is still a maintainer decision (slice B); nothing from it may be
committed here.

### Which model is scored

`GEMINI_MODEL` is **not pinned** to a versioned release: `apps/backend/src/env.ts` defaults it to `gemini-3.5-flash-lite`, with
no date or version suffix, so the name may be an alias whose behaviour changes behind the same string. The gateway client does
not return the model version the API reports (the result carries only the text, finish reason, block reason and usage), so the
report and the baseline record the **configured** string. That is why the weekly run exists: it catches drift behind an
unchanged name. When a baseline moves with the same model string and the same prompt hash, suspect the alias first.

## Adding a labelled post

One folder per post, named by its `postId`: `<postId>/label.json` plus the image files it lists (file names only, no folders).
`label.json` is validated at load (`parseLabelledPost`):

```json
{
  "postId": "syn-single", "caption": "...", "images": ["cover.png"], "publishedAt": "2026-02-20T08:00:00Z",
  "ownerUsername": "optional", "groupingReason": "single-event",
  "events": [{ "eventName": "...", "location": "optional", "ticketPrice": "75000", "free": false,
               "categories": ["MUSIC"], "performers": ["..."],
               "schedules": [{ "eventStartDate": "2026-03-01", "eventStartTime": "19:00", "eventEndTime": "22:00" }] }]
}
```

Leave a field out to leave it unscored. `ticketPrice` must contain a digit (use `free: true` for a free event; leave it out
when the price is unknown). `events: []` marks a non-event post. Image files should be PNG, JPEG, WebP or GIF; any other
extension is served without an image type and the post is skipped as `unavailable`. Verify the label by hand against the images.

## The public-repo rule

This repository is public. Never commit real images, real captions, or anything with personal contact data (a phone number, a
`wa.me` link, an e-mail, a face). Only the SYNTHETIC set lives here (made-up captions, generated placeholder images, invented
labels). Real labelled sets belong in a private store; the workflow fetches one only when `EXTRACTION_EVAL_S3_URI` and AWS
credentials are configured, keeps it in the runner's temp directory, and never uploads images or captions as artifacts: the
report in the job summary holds scores and post ids only. The recorded raw answers of a real run are likewise kept out of the repo.

A live run rewrites its recording after every answered call. On a hard error (a bad key, a 400) it keeps what was recorded, prints
the file name and exits 1; score the partial file with `--replay`. The default recording `./extraction-eval-recorded.json` is
git-ignored.

## The prompt hash

The report and the baseline carry a hash of the extraction instruction and the response schema. The instruction embeds each
post's own publish date, so the date is masked before hashing: the hash identifies the prompt, not the first post.

## CI

`.github/workflows/extraction-accuracy-eval.yml`: path-filtered `pull_request` (prompt, schema, gateway, normalizers, the eval
itself), weekly schedule, `workflow_dispatch`. Without the secrets it replays the synthetic set and says in the summary that no
real data was scored. Scorer unit tests run on every PR in the normal domain test job. The workflow has a `concurrency` group, so only one eval runs
at a time (all live runs share one paced Gemini key); a run is never cancelled half way, and a newer run waits.
