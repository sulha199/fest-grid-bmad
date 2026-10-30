# Prompt for the new session (paste as the first message), 2026-10-30

The new session cannot see the previous session's transcript. The prompt below carries the state itself, so it works even if this file is not reachable; the repo has the details.

Before using it: the branch `claude/ecstatic-shannon-e8eh9h` had 3 commits that were not pushed when this was written (`63d19a37`, `6ab7dee6`, `17520a7d`, all backlog and plan documents). If the new session runs on another machine or in the cloud, push them first.

```
You are taking over a long-running BMad Method session for FestGrid / FestDaily (an event-discovery app for Indonesia). The previous session ran on another Claude account and you cannot see its conversation. The owner reads on a phone: keep replies short, use small lists and tables, and give every story, backlog or architecture ID a short title.

SETUP
1. Repo sulha199/fest-grid-bmad, branch claude/ecstatic-shannon-e8eh9h (PR #87). On the owner's machine the folder is c:\projects\portfolio\festgrid\bmad. Run git status and git log. Confirm commit 17520a7d is on origin; if it is not, the owner has not pushed yet: say so and ask. The branch already contains master (nothing on master is missing from it as of 2026-10-30).
2. Read in this order: CLAUDE.md; _bmad-output/project-context.md; the PRD (sections 3.18 duplicates, 3.19 event groups, 3.20 place and area) at _bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md; _bmad-output/planning-artifacts/event-insight-poc/poc-status.md (the single source of truth for the POC; read its sections dated 2026-10-27 to 2026-10-29); _bmad-output/planning-artifacts/event-insight-poc/proposal-personalized-discovery.md (Revisions 10, 11, 12 and section 6.2); the backlog rows and detail files (_bmad-output/implementation-artifacts/backlog.yaml and backlog/) for IDEA-085, IDEA-105 to IDEA-114, FIND-109, CC-032, IDEA-094.
3. Then tell me in five lines what you understood, and propose which "next candidate" below to take. Wait for my choice.

WHERE THINGS STAND (2026-10-30)
Master, deployed: PR #102 event dedup. A mid-score pair is promoted to auto-link only when it shares a start date and its bracketed qualifiers do not contradict; two stubs of one event link by the stub-repeat rule; every ingestion decision logs an event_dedup_decision line; the backlog drain is apps/backend/src/drain-event-match-backlog.ts. Also #105 (a degraded scraper provider stays degraded) and #106 (Apify memory-cap wait).
Prod data: on 2026-10-28 the drain was applied: 46 suggestion merges and 92 stub merges, all journaled (event_merges, 138 rows from that evening; undo with undoEventMerge). Active events went 2212 to 2074. 283 pending match suggestions remain, 190 of them for events already over.
Branch (POC and documents only, no production code): audience prompt v3 (stated target areas; post_kind = announcement | report | mixed), label sheet columns, scorer, the merge-event-insight prototype, 416 POC tests passing.

SETTLED BY THE OWNER
- Target area is a set at mixed levels; the model reports only what the post states, code derives venue, hashtag and account areas; a never-classified account is treated as a curator (spec: target-area-spec-2026-10-27.md).
- post_kind is a three-way value; a report is attached to its event if one exists, else promoted to an event (IDEA-106). isEvent stays the outer gate.
- Category siblings (5K and 10K) are one event, tracks are a union (plan Revision 10).
- Price is stored per track in the ORIGINAL currency; the price bands are applied at read time per country (plan Revision 12, IDEA-114).
- A per-account cap in the default list is accepted (IDEA-112). Limits also at scraping: an alarm at a soft limit, a stop at a hard limit for the month (IDEA-113), filed under personalisation and the move from BYOK to a paid product (CC-032 cost-model decision, IDEA-094 open-core and entitlements). Limits are data (default, per plan, per-account override).

WAITING FOR THE OWNER'S ANSWERS
- Plan Revision 11 (an event described by several posts; prototype merge-event-insight.ts): do curator reposts count only when no organizer post exists; a report post adds nothing; store each post's insight on event_posts.
- IDEA-114: an event priced in another currency than the viewer's; which country's bands apply; the "free" filter for an event with a free and a paid category.
- IDEA-113: soft limit 200 and hard limit 600 posts (my assumption); calendar month or rolling 30 days; tell subscribers when an account is stopped; count posts for the stop and events for the display cap; confirm there is NO separate "repeat" flag (reminder posts are normal; a duplicate card is a dedup defect).
- IDEA-106: the matcher that lets "Hylo Open 2026 - Day 2" find "Hylo Open 2026"; how an attached report is shown; clean-up of the 52 remaining stub events of one results account.
- IDEA-111 (Erafone Run 2026 Yogyakarta, 12 live events with a proposed role each): open the unclear 2026-10-30 event; is "Erafone Run 2026" a series. The race is 2026-10-31: re-check afterwards with the ids in backlog/IDEA-111-erafone-snapshot-2026-10-28.json (the public API returns past events by id).
- Owner labelling not done: post_kind and the target-area columns on the label sheets; the 14-case probe sheet is not built.

NEXT CANDIDATES (take one only after the owner picks)
1. Read the first live ingestion decisions: event_dedup_decision log lines with promotedByRule = true, from the batches of 2026-10-29 and 2026-10-30 (03:13 UTC). Logs Insights queries are in docs/infrastructure/7-event-dedup.md. Needs the AWS CLI profile festdaily-dev, region us-east-1.
2. IDEA-085, the exact-repeat rule: also pair a stub with a full event and a roundup stub with its own account's post. Test set: 41 groups (90 events) of one account, identical name, shared start date, still shown more than once. This is production code: a master-based branch, never this one.
3. IDEA-107, a small script that closes pending suggestions whose events are over or dead.
4. IDEA-114 in the POC once the owner approves: price lines in the prompt and the label sheet (price_min, price_max, price_currency).
5. IDEA-106 production build (a story on a master-based branch).

RULES (the previous session's memory does not carry over)
- Decisions are the owner's. Put questions as short numbered items. Do not push, merge or deploy unless asked. Never call EnterWorktree on yourself. Never print or write credentials.
- Prod database: the read-only role readonly_2 returns 0 rows on every table since the row-level-security migration 0084 (2026-10-28); that is not data loss. The writer credential is the Secrets Manager secret festgrid-database-url-prod (us-east-1); use it only with the owner's explicit go-ahead for that session, read it inside the script that uses it, and never print it or save it. To read event data prefer the public GraphQL API, no login: https://jiepd4q9td.execute-api.us-east-1.amazonaws.com/prod/graphql (events, event(id), eventBySlug(slug)).
- The POC branch holds POC scripts and documents only. PRD edits made here should go through bmad-prd before the branch merges. Do not use bmad-create-epics-and-stories on an existing epic.
- No caption, hashtag or quote of a third-party post goes into a commit, report or chat message.
- Backlog: a note is one fact, at most 300 characters; detail goes in backlog/<ID>-slug.md; run python scripts/backlog-check.py after edits; backlog.yaml uses CRLF line endings. Report outcomes plainly: done, verified, left; say so when something failed.

TOOLING NOTES
- POC tests: cd apps/backend; export DATABASE_URL=postgres://u:p@localhost:5432/x; NODE_ENV=test npx tsx --test scripts/poc-event-insight/*.test.ts (416 pass). Strict type-check of the POC files needs --typeRoots pointing at node_modules/.pnpm/@types+node@*/node_modules/@types.
- Shell: multi-line heredocs with quotes or backslashes break; write scripts with the file-writing tool and run them. Git Bash: do not export MSYS_NO_PATHCONV when running pnpm. The local Postgres service is stopped (starting it needs admin), so backend database tests run only in CI.
- Git: the origin remote fails over SSH on the owner's machine; fetch and push over https://github.com/sulha199/fest-grid-bmad.git. The GitHub token cannot push workflow files. Merge PRs with a merge commit. The folder has about 36 untracked leftovers (batch plans, review diffs) that are not part of this work: never git add -A; add files by name.
```
