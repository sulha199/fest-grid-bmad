# Brief for the local Claude session — Round 4, five read-only queries (2026-10-21)

You are a Claude Code session on the product owner's own machine. The cloud session (branch `claude/ecstatic-shannon-e8eh9h`) wrote the queries and tested each on a scratch PostgreSQL 16 built from the repository's migrations, on a small rolled-back fixture. **Start with `git pull origin claude/ecstatic-shannon-e8eh9h`.** You run them and hand back the numbers. You do not fix, edit or interpret beyond one short paragraph per query.

## 1. Hard rules

All of §1 of `local-session-brief-2026-10-19.md` and §1 of `local-session-brief-2026-10-20.md` apply unchanged: never print or open `.env`; use only `PROD_RO2_DATABASE_URL` (the `readonly_2` role); read-only; stop at the first unexpected error and show it; no product-code changes; no commit or push until the owner says so; **no credentials, captions, user, favorite or token data in any output**. These five queries print counts, plus (query 1 only) at most 15 event names with place, dates and start time exactly as the app shows them. They never print an id, an email, a handle, a caption or a link.

## 2. The five runs

Run each exactly like Round 3, one file per command, from the repo root, files under `_bmad-output/planning-artifacts/event-insight-poc/results/prod-findings-review-2026-10-19-queries/`:

```
{ echo "BEGIN READ ONLY;"; echo "SET LOCAL statement_timeout = '60s';"; cat <FILE>; echo "ROLLBACK;"; } | psql "$PROD_RO2_DATABASE_URL" -X -v ON_ERROR_STOP=1 > /tmp/<OUT>
```

| # | `<FILE>` | `<OUT>` | What it answers | Why now |
|---|---|---|---|---|
| 1 | `exact-repeat-sizing.sql` (5 result sets) | `exact-repeat-sizing-prod-2026-10-21.txt` | the adopted exact-repeat rule (same poster, name, place, date range **and start time**) on the real rows: groups, events that would be soft-deleted, by account type, how many groups are blocked by a correction, report, shared post or rejected pair, the lenient-versus-identity pair split, and the 15 largest groups | AD-30 Rule 7; the owner reads result set 5 before the cap on the first sweep is lifted. The export-based figure (56 clusters, 150 events, about 94 deletes) had no start time |
| 2 | `recall-replay-stub-weight.sql` | `recall-replay-stub-weight-prod-2026-10-21.txt` | the matcher replay at same-poster stub weights 0.00, 0.10 and 0.20: how many of the stub pairs reach `mid`, and how many are exact repeats | Round 4 ask 1; decides the weight (arithmetic only today) |
| 3 | `place-fingerprint-open-events.sql` | `place-fingerprint-open-events-prod-2026-10-21.txt` | open events by account type and fingerprint class (`account_default`, `geocoded_from_text`, `legacy_unknown`): how many curator events lose a pin and become `unknown` | Round 4 ask 2; sizes AD-39 Rule 3 and the derive job |
| 4 | `foreign-pins-country-text.sql` (2 result sets) | `foreign-pins-country-text-prod-2026-10-21.txt` | of the pins outside Indonesia's box, how many have a country named in the schedule or event text, and how many name none | Round 4 ask 5; sizes who loses a map link under AD-14 Rule 4 (e) |
| 5 | `usage-counts.sql` (4 result sets) | `usage-counts-prod-2026-10-21.txt` | users, favorites and calendar additions: is the offline replay possible, is an A/B possible, and how many users follow several accounts | personalization measurement plan; notification suppression sizing |

If a file errors, show the error and stop; do not edit the SQL.

## 3. Hand-back

1. A summary block of at most 30 lines: the figures of each result set (copied, not rounded) and one short paragraph per query saying what the biggest rows look like. For query 1, say whether the identity group count differs from the export's 56 clusters and why you think so.
2. Raw outputs stay in `/tmp`. **Only if the owner says so**, copy them into `_bmad-output/planning-artifacts/event-insight-poc/results/` under the `<OUT>` names above, stage only those files, commit and push to `claude/ecstatic-shannon-e8eh9h` with the usual `Co-Authored-By` line.
3. Then say: "Now tell the cloud session: *pull the branch*."

## 4. Not for this run

- The held-out re-export of event names and hashtags (`event-names-for-series-score.sql`, `event-hashtags-for-series-score.sql`): wait about three weeks so the held-out set holds events the formula never saw, and keep the file unshared until the formula is frozen.
- The owner-run checks from `local-session-brief-2026-10-20.md` §4 (`owner-notification-checks.sql`, SES sandbox and sender address, the Lambda variable, Supabase auth settings): still the owner's checklist, not yours.
- Anything that needs a caption export (the audience and taxonomy labelled sets): the cloud session will brief that separately, with a privacy review first, because curator captions are cleared after extraction.
