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
| `eventName` | the normalized name equals the label's, or one is the other's whole words ("Turnamen Contoh" in "Turnamen Contoh Cabang 1", but "Fest" is not in "Festival"); a labelled event the model did not produce counts once as a miss |
| `startDate`, `endDate`, `startTime`, `endTime` | per labelled schedule, matched by start date; only fields the label states are scored |
| `location` | every word of the labelled place appears in the model's location (normalized text, no geocoding) |
| `ticket` | digits of the price match a schedule price; for `free: true`, every schedule is free: a price of 0, an explicit free word ("gratis", "free") or no price at all. Other text without a digit ("TBA", "Info via DM") is not free, and an event with no schedule cannot be free |
| `categoriesPrecision`, `categoriesRecall` | share of model categories that are right, and of labelled ones found |
| `performers` | share of labelled performers found |

Events are matched in three passes, each event used once: the same normalized name **and** earliest start date (so two events
called "Workshop" on different days pair correctly whatever order the model returns them in), then the same name alone, then the
same earliest start date alone (the model renamed the event). Names keep letters and digits of every script. Per-event fields are scored over matched events only, so a
fold of 7 labelled events into 1 reports `count_mismatch` (event count and grouping fail) instead of zero on everything.
Extra model events are reported, not scored. Location keywords are not scored (a separate call fills them).

Scope: the eval scores the **first** extraction call of a post, with every labelled slide sent. It does not replay the pipeline's
stepped extraction (AD-49: an at-risk answer is split in half and retried) or its per-call event cap, so a post the pipeline would
recover through a split shows up here as `truncated` or `count_mismatch`.

Outcomes that are not a wrong answer are reported apart and never lower a pass-rate: `truncated` (finish reason `MAX_TOKENS` or
unparseable/invalid JSON) and `unavailable` (429/503 after the retry cap, a spent daily quota, or a post whose labelled images
could not all be sent: the production builder falls back to a text-only request when an image fetch fails, so the runner makes
no call for that post and says so, instead of booking a harness fault as a wrong extraction).

An answer that fails JSON parsing or schema validation is classed as truncated, so it leaves every field pass-rate. To keep a
change that breaks the output visible, the baseline stores the **truncated rate** (truncated runs as a share of answered runs)
and the report flags a rise beyond the noise floor. A run with no scorable answer at all says "No field had data" instead of
"nothing dropped".

### Image blurring

The eval mirrors production's default (AD-28: faces are blurred before an image goes to the model). It follows the same switch,
`BLUR_FACES_BEFORE_AI` (on unless set to false), and passes `blurFacesBeforeAi` to the request builder exactly as the pipeline
does, so the model reads the same pixels as in production and a labelled photo of a real person is never sent unblurred.

- **Owner opt-in is not simulated.** Production looks it up in the database (`resolvePostPublisherOptIn`); the eval never opens a
  database, so every post is treated like one from an account that has **not** opted in, which is production's default and the
  stricter side.
- **It fails closed.** An image the blur cannot process is not sent. The post then makes no call and is reported `unavailable`
  (the same rule as an unreadable image), never scored on a text-only request.
- The blur runs in-process (a WASM face detector and `sharp`): no database and no AWS are needed.
- **The synthetic set has no faces** (blank placeholder images), so on it the blur finds nothing and changes nothing. It matters
  for the real labelled set (slice B).

## Reading the report

The table gives one pass-rate per field (mean over posts of the mean over answered runs). With a baseline it adds the baseline,
the delta in points, the noise band and a status:

- **noise band** = 2 x the standard deviation of the per-run aggregates (the repeats), never below 15 points and never above
  50. A field is `flagged` only when it fell by more than its band; one flipped run never flags. Flagged fields list the posts
  that changed. The numbers are a **starting value, to tune after the first real baseline**. The floor is the
  `--noise-floor <points>` flag (default 15, from `DEFAULT_NOISE_FLOOR`); the multiplier `NOISE_BAND_SIGMAS` (2) and the cap
  `MAX_NOISE_BAND` (0.5) are constants in `packages/domain/src/extraction-eval/aggregate.ts`. The cap exists because a band
  above 100 points could never be exceeded, so such a field would never be checked.
- **Posts present in both the run and the baseline** are the only ones whose pass-rates are compared. A post added since the
  baseline (reported as "New posts") or dropped from the set ("Posts in the baseline but not in this run") cannot move a field;
  the table's Pass-rate column is the whole run, Baseline and Delta are over the posts in both.
- With **one run per post** the spread is 0, so a drop cannot be told from noise: a field that fell beyond the floor shows as
  `single_run`, not `flagged`, and the report says to use `--runs 3` or more.
- The spread is measured only over posts that answered **every** run, and for a field only over posts that have a score for it
  in every run: a post that dropped out of some runs (truncated, quota)
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
`--interval-ms` (default 5000; a whole number of milliseconds, an empty variable counts as unset), `--runs N` (default 3), `--noise-floor <points>` (default 15), `--show-names`. Exit codes: a score, however low, exits 0. The eval exits **1** when it cannot run, so a typo is never read as a pass, and
writes one "did not run, this is not a pass" line to the job summary: no labelled directory configured, a directory that does not
exist, a directory with no `<postId>/label.json` (a nested bucket prefix, say), an unreadable label (the message names the file
and never quotes it), or a live run in which no call got an answer (quota spent, 429/503 on every call, unreadable images, as in
the golden-prompt eval). A live run with no Gemini key says so and exits 0. Replay of the synthetic set gives, by
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
| `BLUR_FACES_BEFORE_AI` | env | The production switch for blurring faces before the model sees an image; the eval follows it (on unless `false`) | Optional |
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

## Where the baseline lives

`--baseline <file>` defaults to `<labelled dir>/baseline.json`. For a real run the labelled dir is the private set, so the real
baseline is a file at the **root of the private set** (next to the `<postId>/` folders), written with `--write-baseline` after a
reviewed run. It is not committed to this repo; only the synthetic set's `baseline.json` is. Without a `baseline.json` in the set
the report has no comparison and says so.

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

## Code map

The logic is in `packages/domain/src/extraction-eval/` (pure: matcher, scorers, aggregation, baseline comparison, report) and
`apps/backend/src/lib/ai-gateway/extraction-eval-run.ts` (loading, the paced live loop, retries, the exit rule). The script
`apps/backend/scripts/run-extraction-accuracy-eval.ts` is argument parsing and the report around them. Both have unit tests; one
domain test loads the committed synthetic labels, recording and baseline and asserts the numbers above, so they cannot drift.

## CI

`.github/workflows/extraction-accuracy-eval.yml`: path-filtered `pull_request` (the request builder and everything it interpolates:
`packages/domain/src/posts/**` and `events/**`, the schema, the gateway, the env, shared types, and the eval itself), weekly
schedule, `workflow_dispatch`.

**A pull request never gets the live path.** The run executes the runner and the scorer from the PR's own code, and a same-repo
PR can read repository secrets, so a changed runner could print the Gemini key or the private labelled set into the log of a
public repo. The `pull_request` run only replays the synthetic set and says so in the summary; the live eval (fetch from the
private store, paced Gemini calls) runs on `schedule` and `workflow_dispatch` only, and only when the secrets exist. Without them
it replays the synthetic set and says in the summary that no real data was scored. Scorer unit tests run on every PR in the normal domain test job. The workflow has a `concurrency` group, so only one eval runs
at a time (all live runs share one paced Gemini key); a run is never cancelled half way, and a newer run waits.

## First live verification (what has only been tested against stubs)

Slice A was built and reviewed without a Gemini key, an S3 bucket or the merged workflow, so three things have never run for
real: a live Gemini call, the S3 fetch, and two overlapping workflow runs. Do them in this order. Each is cheap, and none needs
real (private) data until step 3 is finished.

| Step | Check | When | Cost |
|---|---|---|---|
| 1 | Live Gemini call | Before the merge, on your machine | 1 call, then 12 |
| 2 | The `concurrency` group | Right after the merge | 0 Gemini calls |
| 3 | The S3 fetch | After the merge: a rehearsal with the synthetic set first | 0 to 1 calls |

### 1. A live Gemini call (before the merge)

This is the one part of the runner that has not touched the real API. Run one post once, from the repo root, with the model key
(`EXTRACTION_EVAL_GEMINI_API_KEY`, or `SYSTEM_GEMINI_API_KEY` as a fallback). Use absolute paths: `pnpm --filter backend exec`
runs inside `apps/backend`.

```bash
EXTRACTION_EVAL_DIR=$PWD/apps/backend/scripts/fixtures/extraction-eval-synthetic \
EXTRACTION_EVAL_GEMINI_API_KEY=<your key> \
pnpm --filter backend exec tsx scripts/run-extraction-accuracy-eval.ts --only syn-single --runs 1 --record /tmp/extraction-eval-recorded.json
```

- **Good:** a line `syn-single run 1/1: STOP`, then "Recorded raw answers to ...", a report table and exit code 0.
- **The score means nothing here.** The images are blank placeholders; the check is that the request goes through, the answer
  parses and the recording is written.
- **A 401 or 400** is a bad key or request: the run stops, exits 1 and keeps what it recorded. **A 429** is the pacing limit: the
  runner waits and retries by itself. Do not lower `--interval-ms` for these runs: the system key returns 429 when called quickly.

When that works, run all four synthetic posts three times (12 calls, about a minute with the 5 s pacing) to get a real run to
compare with `recorded.json`. Do not commit a baseline from the synthetic set.

### 2. The concurrency group (right after the merge)

The manual trigger appears in the Actions tab only once the workflow file is on master. Then:

1. Actions, "Extraction Accuracy Eval", Run workflow, with `runs` set to 1. Do it again within a few seconds.
2. The second run should wait (pending) while the first runs, and neither should fail. Without secrets this is the replay path,
   so it makes no Gemini calls.
3. With a third dispatch while one run is going and one is waiting, GitHub cancels the waiting one and keeps only the newest
   (its concurrency rule). A weekly run could be dropped that way, but only if someone dispatches at the same moment.

### 3. The S3 fetch (after the merge)

Rehearse with the synthetic set first: it is not secret, so a mistake costs nothing.

1. **Bucket.** A private bucket with a prefix such as `s3://<bucket>/extraction-eval/`. Copy the four synthetic post folders there
   so `syn-single/label.json` sits directly under the prefix, with `baseline.json` at the same level. One folder too many (a
   nested prefix) gives "the labelled directory holds no `<postId>/label.json`".
2. **Access.** An IAM user that can only read that prefix:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       { "Effect": "Allow", "Action": "s3:ListBucket", "Resource": "arn:aws:s3:::<bucket>",
         "Condition": { "StringLike": { "s3:prefix": ["extraction-eval/", "extraction-eval/*"] } } },
       { "Effect": "Allow", "Action": "s3:GetObject", "Resource": "arn:aws:s3:::<bucket>/extraction-eval/*" }
     ]
   }
   ```

3. **Check the layout locally** (no GitHub involved) with the same credentials:

   ```bash
   aws s3 sync s3://<bucket>/extraction-eval/ /tmp/eval-labelled --only-show-errors
   ```

4. **Repository secrets:** `EXTRACTION_EVAL_S3_URI` (the `s3://...` prefix above), `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`,
   `AWS_REGION` and `EXTRACTION_EVAL_GEMINI_API_KEY`.
5. **Dispatch** the workflow with `runs` set to 1. On the run page the job summary should show a report with the `syn-...` post
   ids and no "Live eval skipped" line. This is also the first full live run in CI.
6. **Try the failure path once:** put a wrong prefix in `EXTRACTION_EVAL_S3_URI` and dispatch again. The summary should say
   "fetching the labelled set failed" in one line, and the log should show no file names.

When the rehearsal works, replace the synthetic copy with the real labelled set (slice B). The first real baseline then goes at
the root of that set (see "Where the baseline lives"). Pull requests never take the live path, so steps 2 and 3 can only be
exercised on `workflow_dispatch` or the weekly schedule.
