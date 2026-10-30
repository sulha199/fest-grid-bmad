# Session handoff: personalized Discovery planning (2026-10-20)

Written so a fresh session, on another account and with none of the old transcript, can continue.
If this file and the spine or the memlog disagree, the spine and the memlog win and this file is stale.

Read in this order: `CLAUDE.md`, `_bmad-output/project-context.md`, the PRD
(`_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md`), this file, the memlog
(`.memlog.md` in this folder; its newest entries are the decision ledger), then the spine
(`_bmad-output/planning-artifacts/festgrid-architecture-spine.md`, AD-14, AD-30 and AD-36 to AD-41).

## 1. The owner and how they work

- The owner reviews in **coaching mode: logic first, UI/UX after**. They answer in short numbered
  replies and expect a direct answer to a direct question before anything else.
- Label every decision `[ADOPTED, user-directed]`, `[PROPOSED]` or `[ASSUMPTION]`. A `[PROPOSED]` item
  stays proposed until the owner says yes; do not build on it as settled.
- They think in production facts. When a claim can be checked against data, say what was measured, on
  how many rows, and what the sample cannot show.
- Do not ask questions you can answer from the repo or from sensible defaults. Ask only for decisions that
  are the owner's.

## 2. Repo, branch, rules

- Repo `sulha199/fest-grid-bmad`, branch `claude/ecstatic-shannon-e8eh9h`. The last commit when this was
  written merges master `da2c67c` into the branch. A second repo, `fest-grid-monetization`, is in scope
  but unused here.
- If your session was given a different branch name, start it from this branch and push only to your own:
  `git fetch origin claude/ecstatic-shannon-e8eh9h && git checkout -B <your-branch> origin/claude/ecstatic-shannon-e8eh9h`.
- **Planning isolation (CLAUDE.md section 3):** planning phases write under `_bmad-output/` only. The
  accepted exceptions are `docs/infrastructure/` when CLAUDE.md section 4 requires it, and the POC scripts
  under `apps/backend/scripts/poc-event-insight/`. Never edit `apps/` or `packages/` source.
- No pull requests unless the owner asks. Use your own session's commit trailers.
- Never `git stash` in the middle of a merge. Never print a token, cookie, JWT or env value.

## 3. Where the work stands

```
spine update (AD-14/30/36 amended; AD-37/38/39 new)        done
Reviewer Gate (4 reviewers) + triage                        done   reviews/triage.md
owner decisions 2026-10-20 (keys, notify, curator area)     done   memlog 96-101
groups revisited (SCH = programme, Wacoal = series)         done   PROPOSED, see 4b
local session ran Round 3 + notification/session probes     done   results landed, NOT yet analysed
master merged (AD-40/41 from master; backlog ids renumbered) done
--- next ---
1. analyse the landed results, calibrate pin trust, amend the spine   (section 5)
2. PRD update          skill bmad-prd, intent Update
3. UX                  skill bmad-ux (group surface, precision badge, partial lane, labels)
4. epics               skill bmad-form-epics
5. readiness           skill bmad-check-implementation-readiness
```

## 4. Decisions

### 4a. Adopted (details are in the spine; memlog entries 90-101 carry the dates)

- **AD-37 jsonb (BUG-068):** `customJsonb` on all 30 jsonb columns; row migration by runbook after the writer
  ships; the unwrap fragment guards on the first character.
- **AD-38 event identity:** an event is one activity at one place-set; schedules are the dates. A
  deterministic place normalizer runs before the per-event loop. `isSamePlace()` and `normalizeName()` are
  the only place and name comparisons. `siblingOrdinal(k, j) = k + 100*j`. Never split `dependent-stages` or
  `isRoute`. Split moves schedules and repoints `calendar_additions.event_id`; favorites are copied to all
  children. **Backfill re-extraction uses the keys of contributors who subscribe to the posting account
  only**; the system key stays fenced (AD-10).
- **AD-36 groups:** kinds `series | programme`, kind from a membership test. A programme's members are each
  promoted individually (no cap, "part of" chip). A series is capped to one cover. One writer
  (`group-membership.ts`). A grouped event notifies once per (group, source post) through
  `events.notify_due_at`, claimed by the ingestor's existing 5-minute drain (no SQS delay).
- **AD-39 place model:** pin, area and provenance are three independent facts. `pin_trust` is the only pin
  reader. `events.area_status` has an explicit `unknown`. Curators never use Geoapify for an account
  location; their area is the profile guess P validated by the first posts Q (N=5, M=3 are assumptions).
  Type confirmation and scraping never wait for the area.
- **Moderators:** they receive no email or push for queue items today (BUG-069). The owner decided the
  direction: a digest email and a push for pending items (IDEA-090).

### 4b. Proposed, waiting for the owner's yes or no

1. **Curator events with no resolved area are published** with `area_status = unknown` (default tier,
   ranking penalty, per-page cap) instead of held for review (AD-39 Rule 3).
2. **Wacoal-type promos (same activity, same time, several places) are a `series`**, not a third kind. Two
   derived facts, `place_count` and `concurrent`, drive the label "also at N other places"; the cover is
   the member nearest the user with its own Nearby badge (AD-36 Rules 12 and 13).
3. **Promos posted separately by each place's own account are not grouped** (the series key includes the
   organizer). Deferred until the landed item 15 numbers are read.
4. **Pin-trust floor and the `full_match` clause** (AD-14 Rule 4): data landed, decision open (section 5).
5. A **real-curator evaluation gate** for the audience-area guess (only one real curator was in the POC).

## 5. Landed results to analyse first

Commit `30154e2`, folder `_bmad-output/planning-artifacts/event-insight-poc/results/`. Start with
`notification-and-session-investigation-2026-10-20.md` (its section 1 is a 40-line summary), then:

| File | Answers |
|---|---|
| `pin-trust-labelled-prod-2026-10-19.csv` (87 rows, owner-labelled Y/C/N) | the pin-trust floor. Score with `apps/backend/scripts/poc-event-insight/score-pin-trust-labels.ts` |
| `geocode-compound-probe-2026-10-19.md` | whether a better query shape fixes wrong-country pins |
| `recall-replay-prod-2026-10-19.txt` | IDEA-085 stub-pair rule: how many reachable pairs the matcher misses |
| `events-place-quality-prod-2026-10-19.txt` | share of open events with a trusted pin, untrusted pin, text only, none |
| `events-multi-place-prod-2026-10-19.txt`, `concurrent-multi-place-prod-2026-10-20.txt`, `series-candidates-prod-2026-10-19.txt`, `tier1-group-members-prod-2026-10-20.txt` | how many events the place split touches, the GAP, the series/programme split on real names |
| `gemini-usage-prod-2026-10-19.txt` | quota headroom for the backfill |

The investigator's headline numbers (verify before using them): today's pin rule (0.50 plus `full_match`)
has 44% precision on the labelled sample; **all 42 pins outside the Indonesia box are wrong, including
those at 0.81 to 1.00 confidence**, so confidence alone cannot separate right from wrong (a
country-or-box leg is the likely fix); 38 of those 42 were stored after the Indonesia bias shipped
(2026-09-13); only 25 of 58 mid or high stub/full pairs are in the candidate list; SCH is not among the 19
tier-1 umbrellas; the notification probe ranks the likely causes (no `fcm_tokens` row, twin profile BUG-059,
stub/curator events never notify, `user_settings` row missing) and found e-mail to a subscriber is by design
absent. Amend AD-14 Rule 4, AD-30 Rule 7 (the stub-pair rule, IDEA-085), AD-36 (the GAP) and BUG-069 from
this, then log it in the memlog.

## 6. Numbering state (after the 2026-10-20 merge)

- Next free **AD-42**. The spine runs AD-1 to AD-41. AD-40 (re-extract preview) and AD-41 (async subscribe)
  belong to master's session.
- Backlog maxima: **BUG-071, IDEA-091, FIND-092, CC-032**. The next ids are BUG-072, IDEA-092, FIND-093.
  Master's rows were renumbered on merge (BUG-063 to BUG-070, BUG-064 to BUG-071, IDEA-073 to IDEA-091,
  FIND-086 to FIND-092); master's code comments still say BUG-063. Master's session must allocate above
  these maxima or the ids collide again.
- The memlog is shared with master's session: append only, never rewrite.

## 7. Tooling

```
# spine lint (copy the spine to <dir>/ARCHITECTURE-SPINE.md first); 7 pre-existing low findings expected
uv run --python 3.11 .claude/skills/bmad-architecture/scripts/lint_spine.py --workspace <dir>
# backlog checker: 70 failure lines expected, all older rows, none from rows 06x-09x
uv run --python 3.11 --with pyyaml scripts/backlog-check.py --quiet
# memlog (one entry per decision or event)
uv run --python 3.11 _bmad/scripts/memlog.py append --workspace _bmad-output/planning-artifacts/architecture/architecture-festgrid-2026-09-22 --type decision --text "..."
# POC tests (259 expected to pass)
cd apps/backend && BACKEND_PORT=4001 DATABASE_URL=postgres://x:x@127.0.0.1:1/x npx tsx --test scripts/poc-event-insight/*.test.ts
```

Backlog notes are one line, at most 300 characters; put detail in `backlog/<ID>-slug.md`. A scratch Postgres 16
is at `/usr/lib/postgresql/16/bin` (initdb under `/tmp/pg*`, run as `postgres`); migrations are
`packages/database/migrations/*.sql`. Read-only SQL for production is run by the owner or the local session
on `readonly_2`, never from here (see `event-insight-poc/prod-readonly/README.md`).

## 8. Owner-run or external, not blocking the planning

- Deploy the BUG-068 writer, then run the row migration runbook (owner).
- Run `results/prod-findings-review-2026-10-19-queries/owner-notification-checks.sql` and check SES
  (sandbox, `SES_FROM_EMAIL_ADDRESS`), the Lambda env and Supabase auth settings: BUG-069 / IDEA-090.
- `diagrams/event-dedup-flow.html` changes when the sweep ships (IDEA-085), not now.

## 9. Pending downstream edits (do after section 5)

- **PRD:** a grouped event notifies once per (group, source post), replacing "per event, not per post";
  favorites copy to split children; curator audience area; moderator queue notifications (IDEA-090).
- **UX:** group surface, programme chip, series cover with Nearby badge and "also at N other places", the
  precision badge, the partial lane for events whose area only covers the user's.
- **Epics:** `bmad-form-epics` clusters IDEA-084 to IDEA-090, BUG-064 to BUG-069 and their follow-ups; the
  AD-41 and AD-40 follow-ups are master's session's.
