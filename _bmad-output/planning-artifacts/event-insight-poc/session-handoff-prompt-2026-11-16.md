# Prompt for the new session (paste as the first message), 2026-11-16

Replaces `session-handoff-prompt-2026-10-30.md` (kept for history; its section numbers, backlog IDs and counts are out of date). The new session cannot see the previous session's transcript, so the prompt carries the state itself.

This branch is **long-lived and will not merge into master soon** (it carries a complex app upgrade). The standing goal is to keep it in sync with master with as little divergence as possible: `branch-sync-playbook.md` is the procedure.

Before using it: the branch `claude/ecstatic-shannon-e8eh9h` is 483 commits ahead of its origin and **not pushed** (the merge of master and two renumbering commits are local). If the new session runs on another machine or in the cloud, push first (see TOOLING NOTES for the https remote).

```
You are taking over a long-running BMad Method session for FestGrid / FestDaily (an event-discovery app for Indonesia). The previous session ran on another Claude account and you cannot see its conversation. The owner reads on a phone: keep replies short, use small lists and tables, and give every story, backlog or architecture ID a short title.

SETUP
1. Repo sulha199/fest-grid-bmad, branch claude/ecstatic-shannon-e8eh9h (PR #87). On the owner's machine the folder is c:\projects\portfolio\festgrid\bmad. Run git status and git log. The merge of master (tip ab5e72e2, 2026-11-16) is the commit "Merge master (ab5e72e2, 480 commits)"; the commit after it re-minted backlog IDs. If either is missing from your checkout, stop and ask: the owner has not pushed or you are on another copy.
2. Read in this order: CLAUDE.md; _bmad-output/project-context.md; the PRD at _bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md (3.18 is MASTER's Background Vendor Jobs; the dedup sections of this branch are 3.19 duplicates, 3.20 event groups, 3.21 place and area, 3.22 audience country, FR131-FR141, 4.22 EventGroup); _bmad-output/planning-artifacts/event-insight-poc/poc-status.md (single source of truth for the POC); _bmad-output/planning-artifacts/event-insight-poc/backlog-id-renumbering-2026-11-16.md (old to new IDs); _bmad-output/planning-artifacts/event-insight-poc/branch-sync-playbook.md (how to sync with master, rules, mistakes to avoid); _bmad-output/planning-artifacts/event-insight-poc/proposal-personalized-discovery.md (Revisions 10, 11, 12 and section 6.2); the backlog rows and detail files for IDEA-261029-hh4, IDEA-261029-hjq, IDEA-261029-s33, IDEA-261028-3ov, IDEA-261028-qa9, IDEA-261027-ugg, IDEA-261019-0i7, IDEA-261021-6dy and CC-032.
3. Then tell me in five lines what you understood, and propose which "next candidate" below to take. Wait for my choice.

WHAT CHANGED ON 2026-11-16 (master merged into the branch)
Number spaces that collided with master; master's numbers won and the branch's moved:
- PRD: dedup/groups/place/audience are now 3.19-3.22, FR131-FR141, 4.22 (they were 3.18-3.21, FR116-FR126, 4.21).
- Spine AD-14: the branch's pin-trust and geocode-input-hygiene rules are now Rules 7 and 8 (they were 4 and 5; older reviews and memlogs cite the old numbers). Master's Rules 3-6 (country filter, proximity bias, ...) stand. The branch's AD-36..39, AD-42, AD-43 and master's AD-40, AD-41, AD-44..54 did not collide.
- Backlog: numeric ID counters are FROZEN on master. New rows get `TYPE-YYMMDD-xxx` from `uv run --python 3.11 --with pyyaml scripts/backlog-new-id.py TYPE --date YYYY-MM-DD` (the row's `created` must equal the ID date). 57 branch rows were re-minted (examples: IDEA-105 is now IDEA-261027-ugg, IDEA-113 is IDEA-261029-hh4, IDEA-106 is IDEA-261028-3ov, IDEA-111 is IDEA-261028-qa9, IDEA-085 is IDEA-261019-0i7, FIND-109 is FIND-261028-3js). The branch's older copies of master rows were dropped in favour of master's rows; the table lists both. Text written before 2026-11-16 may still use the old IDs.
- Kept on purpose: BUG-073, BUG-074, BUG-075, IDEA-095, IDEA-096 keep their numeric IDs because master's code comments cite them; they are the only backlog-check 17 findings left.

WHERE THINGS STAND (2026-11-16)
Master (deployed): event dedup (PR #102 and the follow-ups #115-#117); IDEA-107 (expire stale suggestions) and IDEA-110 (venue spelling variants) are DONE on master, and the AI-assisted dedup review (AD-45, the moderator-dedup-review skill and apply workflow) is built; Epic 10 background vendor jobs (AD-53, AD-54); cursor-based stepped extraction (AD-46..52); the location keywords call (AD-14 Rules 3-6). The duplicate figure after the BUG-090 fix is 16 groups / 37 events of 663 (mostly venue spelling), not 41 / 90.
Prod data: 2026-10-28 drain applied (46 suggestion merges, 92 stub merges, journaled in event_merges, undo with undoEventMerge); later runs on 2026-10-30/31 are in the owner's memory notes, not in the repo. Check the event_merges journal before trusting any count.
Branch (POC and documents, plus the BUG-261019-ud2 jsonb fix in schema.ts): audience prompt v3 (stated target areas; post_kind = announcement | report | mixed), label sheet columns, scorer, the merge-event-insight prototype, 416 POC tests passing (last run before the merge; not re-run since).

OPEN AFTER THE MERGE (decide with the owner; do not fix silently)
1. DONE 2026-11-16: jsonb ratchet. Master's four plain jsonb() columns (posts.extraction_cursor, scraper_actor_runs.error_codes, jobs.input, jobs.result_data) are allow-listed in packages/database/jsonb-columns.test.ts, because master reads them safely in SQL (`#>> '{}'` unwrap, `::text::jsonb` writes). schema.ts keeps master's declarations, and its `jsonb` import was restored (the merge had dropped it). The ratchet test passes and `tsc --noEmit` is clean in packages/database; nothing else was type-checked.
2. EXPERIENCE.md: master's rule "a schedule location is always a map link" replaced the branch's precision-based plan (plain text for area-only events). Settle it in a bmad-ux pass; the target-area story is IDEA-261027-ugg.
3. Only the database package was checked after the merge (ratchet test and tsc). The backend, domain and web type-checks, lint, build and test suites were NOT run: rebuild packages/domain and packages/database dist, then run them before relying on the branch.
4. The merge changed 958 files; the PRD, spine, project-context, EXPERIENCE and schema.ts conflicts were resolved by hand. If something reads wrong, `git show <merge commit>` and compare with origin/master and a0ec8f43 (the branch before the merge).

SETTLED BY THE OWNER
- Target area is a set at mixed levels; the model reports only what the post states, code derives venue, hashtag and account areas; a never-classified account is treated as a curator (spec: target-area-spec-2026-10-27.md).
- post_kind is a three-way value; a report is attached to its event if one exists, else promoted to an event (IDEA-261028-3ov, event report vs announcement). isEvent stays the outer gate.
- Category siblings (5K and 10K) are one event, tracks are a union (plan Revision 10).
- Price is stored per track in the ORIGINAL currency; price bands are applied at read time per country (plan Revision 12, IDEA-261029-s33).
- A per-account cap in the default list is accepted (IDEA-261029-hjq, one account must not flood Discovery). Scraping limits: alarm at a soft limit, stop at a hard limit for the month (IDEA-261029-hh4), filed under personalisation and the move from BYOK to a paid product (CC-032 cost model, IDEA-261021-6dy open-core split). Limits are data (default, per plan, per-account override).

STILL WAITING FOR THE OWNER'S ANSWERS (unchanged since 2026-10-30)
- Plan Revision 11 (an event described by several posts; prototype merge-event-insight.ts): do curator reposts count only when no organizer post exists; a report post adds nothing; store each post's insight on event_posts.
- IDEA-261029-s33: an event priced in another currency than the viewer's; which country's bands apply; the "free" filter for an event with a free and a paid category.
- IDEA-261029-hh4: soft limit 200 and hard limit 600 posts (assumption); calendar month or rolling 30 days; tell subscribers when an account is stopped; count posts for the stop and events for the display cap; confirm there is NO separate "repeat" flag.
- IDEA-261028-3ov: the matcher that lets "Hylo Open 2026 - Day 2" find "Hylo Open 2026"; how an attached report is shown; clean-up of the 52 remaining stub events of one results account.
- IDEA-261028-qa9 (Erafone Run 2026 Yogyakarta): the race was 2026-10-31, so the re-check is now possible with the ids in backlog/IDEA-261028-qa9-erafone-snapshot-2026-10-28.json (public API returns past events by id). Open the unclear 2026-10-30 event; is "Erafone Run 2026" a series.
- Owner labelling not done: post_kind and the target-area columns on the label sheets; the 14-case probe sheet is not built.

NEXT CANDIDATES (take one only after the owner picks)
1. Close out the merge: the backend, domain and web type-checks, the POC tests and the suites that touch the merged areas; fix what the merge broke; settle the EXPERIENCE.md open item above. (Recommended first.)
2. Push the branch (https remote) once item 1 is green. Then sync with master regularly (playbook); the branch does not merge soon, so PR #87 stays open as the sync target.
3. Re-check Erafone (IDEA-261028-qa9) through the public API.
4. IDEA-261019-0i7 (duplicate sweep, exact-repeat rule, stub vs full event): production code, a master-based branch, never this one.
5. IDEA-261029-s33 price lines in the POC (price_min, price_max, price_currency in the prompt and label sheet) once the owner approves.
6. IDEA-261028-3ov production build (a story on a master-based branch).

RULES (the previous session's memory does not carry over)
- Decisions are the owner's. Put questions as short numbered items. Do not push, merge or deploy unless asked. Never call EnterWorktree on yourself. Never print or write credentials.
- Prod database: the read-only role readonly_2 returns 0 rows on every table since the row-level-security migration 0084 (2026-10-28); that is not data loss. The writer credential is the Secrets Manager secret festgrid-database-url-prod (us-east-1); use it only with the owner's explicit go-ahead for that session, read it inside the script that uses it, and never print it or save it. To read event data prefer the public GraphQL API, no login: https://jiepd4q9td.execute-api.us-east-1.amazonaws.com/prod/graphql (events, event(id), eventBySlug(slug)).
- The branch holds POC scripts and documents and some app-upgrade code (the jsonb fix so far). PRD edits made here should go through bmad-prd. Never edit a file only for tidiness if master also owns it: that makes the next sync conflict. Do not use bmad-create-epics-and-stories on an existing epic.
- No caption, hashtag or quote of a third-party post goes into a commit, report or chat message.
- Backlog: a note is one fact, at most 300 characters; detail goes in backlog/<ID>-slug.md, which starts with a `backlog_id: <ID>` line; run python scripts/backlog-check.py after edits. On Windows that script wrongly reports check 17 for every legacy ID (backslash board path); trust it only on Linux/CI, or call backlog_ids.check_ids with a forward-slash path. Report outcomes plainly: done, verified, left; say so when something failed.

TOOLING NOTES
- POC tests: cd apps/backend; export DATABASE_URL=postgres://u:p@localhost:5432/x; NODE_ENV=test npx tsx --test scripts/poc-event-insight/*.test.ts (416 passed before the merge). Strict type-check of the POC files needs --typeRoots pointing at node_modules/.pnpm/@types+node@*/node_modules/@types.
- Shell: multi-line heredocs with quotes or backslashes break; write scripts with the file-writing tool and run them. Git Bash: do not export MSYS_NO_PATHCONV when running pnpm. Local Postgres is the native Windows service postgresql-x64-18 (use .env's DATABASE_URL); backend database tests may also run only in CI.
- Git: the origin remote fails over SSH on the owner's machine; fetch and push over https://github.com/sulha199/fest-grid-bmad.git. The GitHub token cannot push workflow files. Merge PRs with a merge commit. Three untracked local files (two one-off A/B scripts under apps/backend/scripts and a batch snapshot) are not part of this work: never git add -A or a directory; add files by name.
```
