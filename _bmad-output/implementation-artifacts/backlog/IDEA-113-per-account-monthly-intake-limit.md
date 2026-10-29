---
backlog_id: IDEA-113
title: "Per-account monthly intake limit: ring an alarm at a soft limit and stop scraping the account at a hard limit"
captured: 2026-10-29
---

# IDEA-113 — A monthly limit on how many posts one account may bring in

## What the owner asked (2026-10-29)

A per-account cap in the default Discovery list is acceptable (IDEA-112). Limits should also apply at scraping: ring an alarm when an account has too many posts in a month, and stop scraping that account for the rest of that month if a hard limit is met.

## Why it is a separate mechanism from the display cap

| Protects | Display cap (IDEA-112) | Intake limit (this item) |
|---|---|---|
| users from a flooded list | yes | indirectly |
| money: scraping is paid per result (the default provider monthly budgets are $5 and $7.50, `usage-store.ts`) | no | yes |
| subscribers' Gemini quota: the extraction of every new post runs on the subscribers' own keys (BYOK, rate and daily limits) | no | yes |

A cap on cards cannot stop the spend; a stop on intake cannot clean a list that is already full. Both are needed.

## Data (read-only prod, 2026-10-29; posts ingested in the last 30 days, by `posts.created_at`)

- 518 accounts brought in 2,626 posts. Per account: median 1, 90th percentile 7, 99th percentile 96, maximum 318.
- Events produced per account in the same window (418 accounts): median 1, 90th percentile 6, 99th percentile 69, maximum 162.
- The busiest accounts are legitimate malls and curators: plazaambarrukmo 318 posts (162 events), pakuwonmall.jogja 209 (119), badminton.ina 138 (54), infoeventjogja 114 (103), lippoplazajogja_official 108 (44), slemancityhall 96 (91), jogjacitymall 85 (40), konserindonesia_ 76 (69).
- For the big accounts one post is about one event (posts per event 0.9 to 1.1). Only the results account (2.2) and the Erafone organizer (2.1, reminder posts) post an event repeatedly.
- 91% of events (1,965 of 2,155) have exactly one post; 9% have two or more.
- The scraper takes at most 30 posts per account per run (`SCRAPE_RESULTS_LIMIT`), once a day, so in normal operation one account can bring in at most about 900 posts a month.

Consequence: a flat limit at the 99th percentile (96) would stop the busiest legitimate accounts; a limit has to sit above the legitimate maximum (318) or be per account.

## What exists to build on

- A provider-level monthly budget guard (`isProviderCapacityAvailable`, `ScraperCapacityExceededError`): the precedent for "stop when the month's limit is met".
- The scrape gate (AD-34, `isScrapableAccountType`): one predicate that every scrape-starting entry point must call (`triggerAccountScrape`, the subscribe cascade, the moderator-resolution trigger, the daily batch, the failed-run re-queue). A hard stop belongs there, or in a sibling predicate next to it, so no entry point can bypass it.
- Alarm plumbing: the stack already turns structured log lines into CloudWatch metrics and alarms that publish to an SNS ops topic (`ProviderDegradedAlarm`). A soft-limit alarm can reuse it. Moderator notifications inside the app do not work yet (PRD 3.9.3), so this is the channel for now.

## Proposal (the numbers are `[ASSUMPTION]`, to decide with the owner)

1. **Count:** posts ingested per account in the calendar month (the owner said "in a month"). A rolling 30 days is the alternative.
2. **Soft limit (alarm):** 200 posts. Today two accounts would cross it (318, 209). The alarm is one structured log line per account per month, which the existing metric filter turns into an SNS message that names the account, its count, its events and its posts-per-event.
3. **Hard limit (stop):** 600 posts, about twice the busiest legitimate account. No account crosses it today. Over it, the scrape gate refuses the account until the next month or until a moderator lifts it; existing events and posts stay; subscribers see no new posts from it.
4. **Per-account override** set by a moderator (a mall that is legitimately busier), recorded with who and when.
5. Alternative to a flat number: a limit relative to the account's own history (for example three times its previous month, with a floor). More accurate for growing accounts, harder to explain.

## What "an account repeats itself" means (the owner asked)

| Case | Example | Harmful? | Handling |
|---|---|---|---|
| Reminder or update | "last call", "registration extended", one post per category | No: 9% of events have two or more posts; the Erafone organizer posts 2.1 per event | dedup links them to one card; never flagged |
| Duplicate card | the repeat created a second visible card | Yes, to users | a platform defect, not an account behaviour: measured as the share of upcoming events in a same-account identical-name same-date group (13% on 2026-10-29), fixed by IDEA-085 |
| Same offer on many dates | a tour with ten departures | Only if shown as ten cards | series collapse (PRD 3.19, IDEA-084) |
| Bump or flood | the same event posted 20 times in a week, or hundreds of different posts | Costs money and quota; harmless to users once collapsed | the intake limit above; the alarm message shows posts per event so a moderator can tell a flood from a busy mall |

Proposal: no separate "repeat" flag. A repeat is already collapsed by dedup, and flagging reminders would flag good organizers. Report the repeat rate inside the intake alarm instead.

## Open questions

1. Soft limit 200 and hard limit 600: right, or per account type (organizer, venue, curator)?
2. Calendar month or rolling 30 days?
3. When the hard limit stops an account, should its subscribers be told?
4. Count posts, or events produced? Posts measure the cost; events measure the user-facing flood. Proposal: posts for the stop, events for the display cap.

Related: IDEA-112 (display cap and repeats), IDEA-085 (exact-repeat merge), IDEA-084 (event groups), PRD 3.18, 3.19 and 3.8, AD-34, AD-43.
