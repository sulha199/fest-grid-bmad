# Brief for the local Claude session — run the production checks (2026-10-19)

You are a Claude Code session running **on the product owner's own machine**, started from a shell in which they exported the variables named below. A *cloud* session (branch `claude/ecstatic-shannon-e8eh9h`) wrote the tooling and the analysis; it cannot reach the production database or read this machine's `.env`. **Your job is to run three prepared, read-only checks and hand the results back.** You do not decide anything, change any product code, or fix any bug.

## 1. Hard rules (any one of them overrides everything else in this brief)

1. **Never open, `cat`, grep, source or print any `.env` file, and never print the value of any environment variable.** You may test that a variable is set without showing it: `[ -n "$PROD_RO_DATABASE_URL" ] && echo set`. Only the variables named in §4 are yours to use. **Never use `DATABASE_URL`.**
2. **Read-only, always.** Only the commands in §4. No `INSERT/UPDATE/DELETE/DDL`, no schema or role changes, no migrations, and **do not run `01-create-readonly-role.sql` or `02-drop-readonly-role.sql`** (the owner runs those by hand).
3. **Stop at the first unexpected error and show it** instead of working around it. In particular if the pack says `REFUSING to run`, stop: do not try another role or URL.
4. **No product code changes** (planning-only repository, see `CLAUDE.md`), and **no commit or push until the owner says so** (§5).
5. Output may contain counts, ratios, plan text and event/venue names that are public in the app. It must contain no credentials, no host names beyond what the scripts mask, no captions and no user, favorite or token data. If you see any, say so and stop.

## 2. Context in ten lines

* The repo is a BMad planning/POC effort for **personalized Discovery** (ranking events per user, area filtering, partial AI-filter matches, freshness, "already seen"). Read `_bmad-output/planning-artifacts/event-insight-poc/prod-findings-review-2026-10-19.md` first (10 minutes) — it is the cloud session's latest work.
* On 2026-10-19 the owner ran queries on production with the existing `readonly_2` role (`results/prod-findings-and-event-groups-2026-10-19.md`): 1,394 events, 431 open, `jit` off, 1,460 pinned schedules of which **379 lie outside Indonesia** (BUG-066 seen live), matcher "recall" 23 of 446 (disputed, see below), `event_merges` empty, 147 duplicate candidates pending.
* The cloud session then **reproduced BUG-068**: every `jsonb` column written through Drizzle 0.30.10 + postgres.js is stored as a JSON string (not the pooler). It also corrected the production pack and wrote `recall-classes.sql`. None of these corrections has run against production yet — **that is what you do now.**
* The cloud session reviewed the owner's event-group plan (AD-36 in `_bmad-output/planning-artifacts/festgrid-architecture-spine.md`) and listed ten gaps. That review is not your task; it is why the numbers below matter.

## 3. Decisions already taken (do not re-open them)

N-minute profile-retry backoff (15 min, 1 h, 6 h, 1 d, 3 d) · stored captions are cleared at next re-extraction, no purge · PostHog plan approved (IDEA-079) · slow table scans are prevented proactively · a roundup's heading counts as a stated area · bulk-update of legacy curator accounts: yes · never-classified accounts that already have a location stay unchanged · an unresolved country is a geocoder *preference* plus a confidence floor, never a silent filter · a subscriber's country is the last-option tie-break.

**Still open (the owner decides, not you):** how BUG-068 is fixed (serializer line vs Drizzle upgrade), which AD-36 amendments are accepted, how the UI renders stub events, PostHog consent/region, and the filtering/scoring of an event that has a target area but no recorded location.

## 4. The three checks

Setup in the owner's shell **before** Claude started (not your job): `git checkout claude/ecstatic-shannon-e8eh9h && git pull && pnpm install`; the role script `prod-readonly/01-create-readonly-role.sql` re-applied by the owner (it gained two column grants); and these variables exported:

| Variable | Used by | Role |
|---|---|---|
| `PROD_RO_DATABASE_URL` | check 1 | `festgrid_poc_ro…` (the script refuses any other user name) |
| `PROD_RO2_DATABASE_URL` | check 2 | the owner's existing read-only role used for the 2026-10-19 report (`readonly_2`) |
| `GEOAPIFY_API_KEY` | check 3 (optional) | the owner's Geoapify key |

Before each check, ask the owner **one** question if you do not already know it: is the target a replica / branch / snapshot, or the primary? If it is the primary, say that check 1 runs two `EXPLAIN (ANALYZE)` statements (they execute the list query) and propose running off-peak or with `--no-explain`; wait for the owner's answer.

### Check 1 — the production pack (needs `PROD_RO_DATABASE_URL`)

From `apps/backend`:
```
npx tsx scripts/poc-event-insight/prod-readonly-check.ts --label "<replica | primary off-peak>" --out /tmp/prod-report.md
```
(add `--no-explain` if the owner chose that). Read `_bmad-output/planning-artifacts/event-insight-poc/prod-readonly/README.md` if anything is unclear. Show the full report. Then extract exactly these figures into a table: `jit`; events / soft-deleted / stubs; `events_per_event_post` **and** `events_without_post` (the owner's earlier 1.08 did not reconcile with 1,326 + 38 posts); open events; the **JSON encoding** table (for each of `schedules.location_details`, `social_media_account_profiles.default_location`, `events.links`, `posts.additional_image_urls`: type and row count — a blank type means every row is null); schedules / pinned / `pins_outside_indonesia_bbox` / `with_admin_area` / `with_venue_type` / `low_confidence_pins`; the country mix; accounts by classification (the legacy `(null)/(null)` row); and for each Discovery statement the plan-rule verdict (sequential scans, cost, JIT, rows scanned).

### Check 2 — how much of the "5% recall" is the matcher's miss (needs `PROD_RO2_DATABASE_URL`)

Counts only. From the repo root:
```
{ echo "BEGIN READ ONLY;"; echo "SET LOCAL statement_timeout = '60s';"; cat _bmad-output/planning-artifacts/event-insight-poc/results/prod-findings-review-2026-10-19-queries/recall-classes.sql; echo "ROLLBACK;"; } | psql "$PROD_RO2_DATABASE_URL" -X -v ON_ERROR_STOP=1 > /tmp/recall-classes.txt
```
If `psql` is not installed, stop and tell the owner; they can paste the file into their SQL editor instead. Show `/tmp/recall-classes.txt`. It has four rows: (1) same post, (2) created before the matcher's first candidate, (3) dates more than 2 days apart, (4) reachable by the matcher, each with `pairs` and `in_candidate_list`. Report **class 4: `in_candidate_list / pairs`** as the honest recall, and the share of the owner's 446 that each class holds. If it errors on a missing table or column (it needs `events.source_social_media_account_id`, `event_posts`, `schedules`, `event_match_candidates`), show the error and stop.

### Check 3 (optional, ask first) — which country does the geocoder pick (needs `GEOAPIFY_API_KEY`)

Calls the owner's Geoapify account: 14 place descriptions × 3 request modes = 42 requests. Ask the owner "go ahead?" first. From `apps/backend`:
```
npx tsx scripts/poc-event-insight/probe-geocode-country.ts --dry                       # shows the URLs with the key redacted: check it, then:
npx tsx scripts/poc-event-insight/probe-geocode-country.ts --country id --md /tmp/geocode-probe.md
```
Never print the key. Show the output and summarize, per description, the country answered under (a) no bias, (b) bias, (c) filter, and whether the confidence-only pick is outside Indonesia. This is the evidence for BUG-066 and for the unresolved confidence-floor value (the floor 0.5 in `location-policy.ts` is an uncalibrated placeholder): list the confidence of every wrong-country answer next to the confidence of the right one so the owner can see where a floor would separate them. Do not change any threshold.

## 5. Hand-back

1. Print, for the owner, a **summary block of at most 25 lines** with the figures listed in Check 1, Check 2 (the four classes) and Check 3, plus anything that looked wrong or surprising, plus any error you hit. Mark each figure as measured by you or copied from a report.
2. Tell the owner the three raw files and stop: `/tmp/prod-report.md`, `/tmp/recall-classes.txt`, `/tmp/geocode-probe.md`.
3. **Only if the owner says so**, copy them into `_bmad-output/planning-artifacts/event-insight-poc/results/` as `prod-readonly-report-2026-10-19.md`, `recall-classes-prod-2026-10-19.txt` and `geocode-probe-2026-10-19.md`, stage **only those files** (no `git add -A`), commit, and push to `claude/ecstatic-shannon-e8eh9h`. The commit message ends with the usual `Co-Authored-By` line. Production aggregates then live in the repository history; the owner may prefer to paste the summary block into the cloud session instead.
4. Then say: "Now tell the cloud session: *the results are in the chat* or *pull the branch*."

## 6. Out of scope here

Fixing BUG-068 or BUG-066, editing AD-36 or the PRD, running the Gemini extraction probes, running the role create/drop scripts, building the matcher replay, and the target-area filtering/scoring discussion. If the owner asks for any of these, say it belongs in the cloud session or a separate story.
