# Brief: gather the POC posts on the owner's machine (2026-10-21)

For the owner, or a local Claude session working with the owner. Plan: `../audience-and-taxonomy-poc-plan-2026-10-21.md`. Script: `apps/backend/scripts/poc-event-insight/fetch-poc-posts.ts` (pure parts in `poc-posts-lib.ts`, 16 tests). Start with `git pull origin claude/ecstatic-shannon-e8eh9h` and `cd apps/backend`.

## Hard rules

All of §1 of `local-session-brief-2026-10-19.md` and `-20.md` still applies: never print or open `.env`; the database is touched only through `PROD_RO2_DATABASE_URL` (read only), never `DATABASE_URL`; no commit or push of anything in `scripts/poc-event-insight/local/`. Added for this script:

1. **No caption, hashtag or tagged place is ever pasted into a chat, a commit or an issue.** The script prints counts only. If something looks wrong, describe it in words.
2. **A new scrape costs money and is the owner's decision.** The script starts one only after the owner types the number of accounts; a local Claude session must not type it for them and must not pass `--confirm-scrape` unless the owner says the exact number.
3. A new scrape is triggered **without** the production webhook, so nothing is ingested into production, and its snapshot id is written to the run log before the script waits, so a re-run downloads it again instead of paying twice.
4. The vendor keys are read from the process environment or, for the whitelisted vendor keys only, from the nearest `.env` (`BRIGHTDATA_API_TOKEN`, `BRIGHTDATA_DATASET_ID`, `APIFY_API_TOKEN`, the two `*_SCRAPING_CONFIRMED` switches, `BRIGHTDATA_PRICE_PER_THOUSAND_ITEMS_USD`). Nothing else in `.env` is parsed. A vendor whose kill switch is false is not called.

## Run

```
cd apps/backend
PROD_RO2_DATABASE_URL='<the read-only readonly_2 URL>' npx tsx scripts/poc-event-insight/fetch-poc-posts.ts
```

It asks, in order: (1) which curator accounts (a numbered list from the database, newest scrapes first; Enter takes the first 8), (2) which venue accounts (Enter takes 6), (3) other accounts the database does not know, such as Malay-language accounts from Malaysia, Singapore or Brunei, and English-language expat accounts (handles or URLs), with a label, (4) after reading what is already stored, whether to start a new scrape for what is short, with the number of records and an estimated cost. Useful flags: `--since 2026-09-01`, `--per-account 15`, `--accounts a,b`, `--extra a,b --extra-label malay`, `--no-scrape`, `--out-dir`, `--help`.

Suggested selection (plan §3): 8 to 10 curators, including those that post foreign events (BWF, Allianz Malaysia, Denmark Open); about 6 venue accounts (Sleman City Hall, Plaza Ambarrukmo, Pakuwon, Galeria, JEC); 6 to 8 Malay-language accounts, 8 posts each; up to 10 English-language expat accounts, 5 posts each.

## What it writes (all in `apps/backend/scripts/poc-event-insight/local/`, git-ignored; the script refuses to write anywhere else inside a repository)

* `poc-accounts.local.json`: the chosen accounts, their stratum label, and whether they came from the database or were typed.
* `poc-posts.local.json`: the reduced posts, at most `--per-account` newest per account; re-runs merge by URL.
* `poc-run-log.local.json`: where each account's posts came from (`db-raw`, `vendor-refetch`, `new-scrape`), counts, and snapshot or run ids. No caption.

## Hand-back

The summary table the script prints (account, stratum, posts, posts with an empty caption, sources) and the count of posts per stratum. Posts with an empty caption mean the stored output no longer has the caption: say so, because for curators it decides whether a re-download or a new scrape is needed. Then label the posts locally (plan §3, two labellers). Delete the `local/` folder when the POC ends.

## Next: label sheets (`label-sheets.ts`, 9 tests)

After the posts are gathered. Everything stays in the git-ignored `local/` folder; the sheets contain captions so the labellers can read them, and the commands below print ids, label values and counts only.

```
npx tsx scripts/poc-event-insight/label-sheets.ts make --labeller owner --half all        # the owner labels every post
npx tsx scripts/poc-event-insight/label-sheets.ts make --labeller wife  --half heldout    # the second labeller: the held-out half only
npx tsx scripts/poc-event-insight/label-sheets.ts check --sheet local/label-sheet-owner.csv   # blanks and values that are not allowed
npx tsx scripts/poc-event-insight/label-sheets.ts compare --a local/label-sheet-owner.csv --b local/label-sheet-wife.csv
npx tsx scripts/poc-event-insight/label-sheets.ts freeze --sheet local/labels-final.csv       # prints the hash to commit; the labels stay local
```

* The held-out half is fixed by a hash of the post URL (so it is decided before any model output exists and never changes); the labelling guide is `labelling-guide-2026-10-21.md` (Indonesian: `.id.md`). Open the CSV in a spreadsheet, fill the blank label columns with the exact words of the guide, save as CSV (UTF-8).
* `compare` reports per field the agreement, Cohen's kappa and how many `unclear` answers were skipped, and writes `label-disagreements.local.csv` (post id, field, both answers, a blank `final` column) for the owner to settle once. Kappa is low when almost all answers are the same label even if agreement is high, so read the two numbers together.
* Not built yet, in this order: the extraction runner (three Gemini runs per labelled post with the owner's key, country and language fields added) and the scorer (the thresholds of plan section 5 on the held-out half).
