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

Outcomes that are not a wrong answer are reported apart and never lower a pass-rate: `truncated` (finish reason `MAX_TOKENS` or
unparseable/invalid JSON) and `unavailable` (429/503 after the retry cap, or a spent daily quota).

## Reading the report

The table gives one pass-rate per field (mean over posts of the mean over answered runs). With a baseline it adds the baseline,
the delta in points, the noise band and a status:

- **noise band** = 2 x the standard deviation of the per-run aggregates (the repeats), never below 15 points. A field is
  `flagged` only when it fell by more than its band; one flipped run never flags. Flagged fields list the posts that changed.
- `improved`, `ok`, `new` (field or post absent from the baseline), `no_data`.

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
`--interval-ms` (default 5000). With no key or no dir the live path says so and exits 0. Replay of the synthetic set gives, by
hand calculation: groupingReason 83 %, eventCount 88 %, eventName 89 %, startDate/startTime/endTime/categories 100 %,
location 67 %, ticket 83 %, performers 75 %, endDate n/a; 10 scored runs, 1 truncated, 1 unavailable, 1 `count_mismatch`.

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

Leave a field out to leave it unscored. `events: []` marks a non-event post. Verify the label by hand against the images.

## The public-repo rule

This repository is public. Never commit real images, real captions, or anything with personal contact data (a phone number, a
`wa.me` link, an e-mail, a face). Only the SYNTHETIC set lives here (made-up captions, generated placeholder images, invented
labels). Real labelled sets belong in a private store; the workflow fetches one only when `EXTRACTION_EVAL_S3_URI` and AWS
credentials are configured, keeps it in the runner's temp directory, and never uploads images or captions as artifacts: the
report in the job summary holds scores and post ids only. The recorded raw answers of a real run are likewise kept out of the repo.

## CI

`.github/workflows/extraction-accuracy-eval.yml`: path-filtered `pull_request` (prompt, schema, gateway, normalizers, the eval
itself), weekly schedule, `workflow_dispatch`. Without the secrets it replays the synthetic set and says in the summary that no
real data was scored. Scorer unit tests run on every PR in the normal domain test job.
