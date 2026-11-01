# Epic 10: what sits outside the epic

**Created:** 2026-11-02, with the formation of Epic 10 (Background vendor jobs: one engine, one Jobs page).
**What this is:** one checklist for everything the investigation and the formation found that is *not* a story of the epic but still needs
someone to act, decide, verify or log. Rows live in `implementation-artifacts/backlog.yaml` (that file is the source of truth for a row);
this file is the single place to see what is open around the epic. Tick a box when it is done, and add new items at the bottom of the
right section. Every ID carries its title.

**Where the epic is:** `epics.md` Epic 10, `sprint-status.yaml` (`epic-10` and stories 10-1a to 10-14z), report `formation-2026-11-02.md`,
evidence and decisions `background-vendor-jobs-design-notes-2026-11-02.md`.

## 1. Fix before the epic starts (rows exist; each stands alone)

- [ ] **BUG-100** (API Lambda registers no scraper adapters, every API-side scrape throws) `xs`. Do first: it is the prod cause of the
  BUG-099 symptom. Next action: `bmad-quick-dev BUG-100`. Re-run the sharp-isolation test after. Still unverified after the fix: the
  20 s `getPostByUrl` cap inside the 28 s Lambda limit.
  **Code done 2026-11-02:** branch `fix/bug-100-api-lambda-registers-scraper-adapters`, commit `2fea660e`, local and not pushed, no PR yet. The
  regression test was red without the fix and green with it; the sharp-isolation test passed 8 of 8. Stays open until merged and deployed.
  Deploying it makes API-side rescrapes spend vendor credit, so ship FIND-119 with or before it (FIND-103: Apify is capped).
- [ ] **FIND-119** (a rescrape failure that spent no vendor credit still starts the 10-minute cooldown) `xs`.
  **Code done 2026-11-02:** branch `fix/find-119-no-cooldown-without-vendor-call`, commits `fb5b77d7` and `fec4e050`, local and not pushed. The
  follow-up commit added the Apify memory-cap and monthly-cap errors to the no-cooldown set (the free-plan cap is the live case) and restored the
  log line the missing-adapter path had lost. 31 of 31 tests in the file pass. Stays open until merged.
- [ ] **BUG-101** (Apify's slide list repeats the cover, so Gemini receives it twice) `xs`. Fix the adapter and de-duplicate by file name at
  read time in `build-gemini-request.ts` so the 354 stored Apify posts are covered without a backfill.
  **Code done 2026-11-02:** branch `fix/bug-101-apify-slide-list-repeats-cover`, commits `311a6b36` and `8e83d9cb`, local and not pushed. One shared
  file-name helper in `packages/domain` serves both the adapter and the read-time de-duplication. Adapter 40, request-builder 47 and helper 7 tests pass.
  Stays open until merged.

## 2. Gates before any Epic 10 story starts

- [x] **`bmad-prd`** for the Jobs capability: a new section plus amendments to PRD sections 3.7, 3.9.3 and 3.11; settle IDEA-119's
  subscriber-notification question and the cap wording (IDEA-008). The gate puts this first for a feature epic.
  **Done 2026-11-02:** new PRD section 3.18 (FR116 to FR124) and Job interface 4.21; amended 3.7, 3.9.1, 3.9.3, 3.10, 3.11, 3.12, 3.13, 3.16,
  4.9, section 5 (new Background Jobs NFR, public-only note), section 6 (reserved slots count) and section 7 (KPI); FR125 to FR128 sit in the
  sections they change. Open items OI-1 to OI-4 are in PRD 3.18 with owners (mapped in section 3 below).
  - [x] Follow-up: backfill FR116 to FR128 into `epics.md` (the requirements inventory, the FR coverage map and Epic 10's "FRs covered: none yet"
    line). Mapping: 10.1a = FR116, FR117; 10.2 = FR118; 10.3 = FR120, FR121, FR122; 10.4 = FR123; 10.5 = FR119; 10.6 = FR125; 10.7 = FR126;
    10.8 = FR127; 10.9 to 10.12 = FR128; 10.13 = FR124. Not done in the PRD pass (planning-only rule: PRD and this tracker).
    **Done 2026-11-02:** 13 inventory entries, 13 coverage-map entries and Epic 10's "FRs covered" line are in `epics.md` with exactly this mapping.
  - [x] Follow-up: Story 10.7 and AD-41 Rule 1 ("the subscription always succeeds") must be reconciled with PRD 3.7: a subscribe job that ends
    not found, private or with no provider leaves no subscription and releases its slot.
    **Done 2026-11-01 (`bmad-epic-readiness-check`):** Rule 1 is amended, not superseded, carried by Story 10.7 (AC added in `epics.md`); see
    `epic-readiness/epic-10-readiness.md`.
  - [ ] Follow-up: `project-context.md` loader rule gets one line when the engine's AD lands (a vendor-backed action that can exceed a few
    seconds is a job, never a blocking overlay); owned by Story 10.14z's documentation check.
- [x] **`bmad-epic-readiness-check`** on epic-10: validates or splits Story 10.1a and the mechanism parts 10.2 to 10.5. If it drops or
  reshapes 10.2 or 10.5, re-examine the re-scoring of **IDEA-101** (remember an exhausted Apify cap) and **IDEA-102** (Bright Data
  snapshots take hours), both set to `xs` on the strength of those stories.
  **Done 2026-11-01:** `epic-readiness/epic-10-readiness.md`. 10.1a validated as one story, AD embedded, not split (one new AC added:
  cross-Lambda phase hand-off). 10.2 to 10.5 validated as-is, not split or reshaped — IDEA-101/IDEA-102's `xs` re-scoring stands, no
  re-examination needed. AC corrections applied directly to 10.1a, 10.4, 10.7, 10.13, 10.14z; no new prerequisite story created.
- [ ] **`bmad-ux`** for the Jobs page, and for **IDEA-115** (profile lookup falls back to a background phase) before Stories 10.4 and 10.7.

## 3. Decisions that are the owner's

- [ ] **FIND-103** (Apify is on the free plan, $5 a month, resets 2026-11-23): upgrade, or keep Bright Data primary? Decides the default
  chain order (`apify,brightdata` assumes Apify capacity) and interacts with the low-resolution rule, because Bright Data images are 640 px.
  Written as open item OI-1 in PRD 3.18 (owner: product owner; revisit before Story 10.2 sets the default).
- [ ] **IDEA-115**'s four open decisions D1 to D4 (`profile-lookup-fallback-and-ux-2026-10-31.md` section 6). **D2 (channel) is answered
  2026-11-02** by PRD FR124 (in-app plus push through the existing push setting, no email). D1, D3 and D4 stay open as OI-2 in PRD 3.18
  (owner: product owner through `bmad-ux`; revisit before Stories 10.4 and 10.7).
- [ ] **CC-032** (decide the cost model: platform-paid, user-paid or hybrid): decides whose key a vendor call uses. Written as open item OI-3
  in PRD 3.18 (owner: product owner, legal gate; revisit when CC-032 is decided).
- [ ] **Story 3-4b** (BYOK pooled scraper vendor keys, legally gated): its AC6 (a contributed Apify token is never used for a
  moderator-initiated run) is already a constraint on Story 10.2's credential choice. Same open item, OI-3.
- [x] **Notifying subscribing users** when a job finishes (IDEA-119): channel, throttling, consent. **Closed 2026-11-02, PRD FR124:** in-app always
  (Jobs menu count) plus push through the existing FCM channel and the existing `pushNotificationsEnabled` setting (default on, no new consent
  screen); no email; one push per job, merged when several end within 10 minutes; the push names the job type and account handle only; sent only
  when the owner was not watching. Story 10.13 still has to check that Epic 0.i1's `notifyAllModerators` can address one moderator (the job's owner).
- [x] **IDEA-008 cap wording** (do in-flight subscriptions count): **closed 2026-11-02, PRD section 6 and FR122:** reserved slots count (active plus
  in-flight, at most 5), checked and reserved in one atomic server-side step per user account so other tabs, browsers, devices or parallel requests
  cannot exceed it; released on failure, expiry, cancel or removal; votes reserve nothing.
- [x] **Image-refresh failure visibility** (what the moderator sees): **closed 2026-11-02, PRD 3.9.3 and FR125:** a plain-words reason from a fixed list,
  images read of available, and a Retry button; Apply is unchanged (no extra warning or block).
- [ ] **Whether to migrate `manual_extraction_jobs`** onto the engine's table: recorded in Story 10.9, decide there. Open item OI-4 in PRD 3.18
  (owner: architect).
- [ ] **Durable image copies and consent:** see section 8, first item.

## 4. Dependencies the epic waits on (other work, not mine to build here)

- [ ] **Story 0-i1a** (notifyAllModerators helper, unstarted): Story 10.13 depends on it.
- [ ] **Stories 0-i3b and 0-i3c** (Lambda-timeout check, IAM-grant check, unstarted): Story 10.1a's CDK change has to pass them once they land.
- [ ] **Epic 0.i5 and 0.i6 ratchets** (stories 0-i5c, 0-i5z, 0-i6b, 0-i6d, 0-i6z, unstarted): Story 10.4's job list and account rows must use the
  shared list controller and `SubscribedAccountCard`, or those ratchets fail.
- [ ] **Story 0-24** (reusable wizard page primitive, unstarted): read it before Story 10.8 changes the wizard's redirect.
- [ ] **IDEA-103** (moderator Apply for re-extract, merged in PR #133): needs a prod exercise after deploy. It interacts with Story 10.6's
  persistence amendment (Apply is the one write in AD-40 today).

## 5. Clusters found but not formed (decide whether to run another pass)

- [ ] **Event dedup**, 10 rows: IDEA-062 (manual merge of any two events), IDEA-066 (organizer's post beats a venue's), IDEA-067 (organizer signal
  from the new post's associations), IDEA-056 (LLM tie-break for mid-confidence matches), BUG-094 (merges outside resolveSuggestedMatch skip
  the lock), FIND-113 (undoEventMerge does not refuse a later live merge), FIND-104 / FIND-107 / FIND-108 / FIND-112 (AI dedup review pieces C,
  B1, B2b-1, B2b-2, already sequenced by `spec-ai-dedup-review-pipeline`). A plausible feature epic; not formed because the last four are
  already one sequenced spec. Next action: run `bmad-form-epics` again scoped to these rows, or leave them to the spec.
- [ ] **Epic 9 leftovers**, 6 rows: BUG-065 (calendar tabs ignore the AI filter), BUG-066 (embed widget never applies saved filters), FIND-087 (relative
  dates resolve in UTC), FIND-089 (a repaired saved filter shows no degraded flag), FIND-088 and FIND-090 (review deferrals). Gaps in an
  already-formed epic. Next action: decide whether they join Epic 9's follow-up or stay `promote` / `quick-dev`.
- [ ] **Everything else** (110 rows minus the above): see the dispositions in `formation-2026-11-02.md` section 8.

## 6. Verify and close (probably already shipped)

- [x] **BUG-076, BUG-077, BUG-078, BUG-081, BUG-082, BUG-083, BUG-090** and **IDEA-097**: each said "fix on its PR, set done once merged". Checked
  against master and set `done` on 2026-11-02: PR #98 (BUG-076, BUG-077, BUG-078, IDEA-097), PR #104 (BUG-081, and its prod repair has applied), PR #105
  (BUG-082), PR #106 (BUG-083), PR #115 (BUG-090). BUG-077's satisfied `blocks: [BUG-078]` entry was cleared (check 9).
- [ ] **BUG-051** (a post advertising several events merges them into one): its stale note is corrected. CC-024 owns stories 3-6r, 3-6s, 3-6t, 3-6u and
  3-6x (all in review, code on master, and FIND-101's live run counted events correctly); the row stays open and closes once 3-6s and 3-6t are done.

## 7. Pieces that join an epic story (their rows stay open until that story lands)

- [ ] **FIND-086** (re-extract preview review deferrals) and **FIND-111** (Apply keeps unapplied previews on the job row): `carve-first`. Split each so the
  retention/sweep finding joins Story 10.1a and the rest stays as its own row. **Carve done** (bmad-create-story, 2026-11-02, Story 10.1a creation):
  FIND-086/FIND-111 set `promoted` with `stories: [10-1a-...]`; the leftover findings carved to new child rows FIND-120 (parent FIND-086) and FIND-121
  (parent FIND-111). This checkbox stays unchecked per this section's own header ("their rows stay open until that story lands") — the carve is done, the
  story itself is not.
- [ ] **IDEA-101** to Story 10.2, **IDEA-102** to Story 10.5, **FIND-082** (triplicated transient-error classifier) to Story 10.2,
  **FIND-119** and **BUG-101** to Stories 10.3 and 10.2 (their engine forms), **FIND-079** (public-accounts-only is not enforced) to Story 10.7
  (do it as `quick-dev` if 10.7 is not started).

## 8. Observed during the investigation but not on the board (say which to log)

- [ ] **Durable image copies without consent:** 37 posts hold a `durable_image_url` and all belong to accounts with `is_image_storage_opted_in = false`,
  although AD-12 Rule 1 stores none for them. Possibly legacy rehosts from before the opt-in gate, or opt-outs that were never purged. Compliance
  question; also decides whether a durable copy may ever be used as AI input. Query: `posts` joined to `social_media_account_profiles` on `id`,
  `durable_image_url is not null`.
- [ ] **Gemini returned 0 events, then 5, for the same stored input:** re-extract previews `6e64a903` (2026-10-31 14:32:27Z) and `6b7d2757` (14:32:47Z),
  both with the cover unreadable. The 0-event result was shown first. Output variance on identical input.
- [ ] **499 of 2,357 live events still carry a legacy 12-hex slug** (the event in the incident is one). `backfill-legacy-event-slugs.ts` exists (Story
  3.22, FIND-071); check whether it has been applied on prod.
- [ ] **The web domain in the incident report** (`fest-grid-bmad.vercel.app`) returned Vercel `DEPLOYMENT_NOT_FOUND`: confirm the prod domain in the docs.
- [ ] **`backlog-check.py --cluster` crashes on Windows** unless `PYTHONIOENCODING=utf-8` is set (it prints box-drawing characters). Fix the print encoding.
- [ ] **BUG-018** (infinite scroll does not keep position) is `promoted` again because its Story 0.i5b is still in `review`. If that story is really finished,
  flip the story in `sprint-status.yaml`; the row follows.
- [ ] **Prod read-only access is blind:** `readonly_2` has no `BYPASSRLS`, so every table reads as empty; investigations need `backup_ro` and a per-session
  go-ahead. Consider a documented read-only role that bypasses row-level security for investigations.
- [ ] **Full test suite not run on the three fix branches:** the runner's preflight refused it (C: had 12.1 GB free, the minimum is 15 GB, a guard added after
  Postgres crashed under write pressure). Lint and build passed on an integration of all three (8 of 8 tasks each); per-file tests passed on every branch. Free about
  3 GB and run `run-check.ts --kind test` on an integration of the branches, or rely on CI for each PR.
- [ ] **Branch state:** `docs/board-repair-2026-11-02` is on origin at `d454d905` with no PR; it has local commits since (the PRD amendment `c8341998`, then the board
  closures and FR backfill). The three fix branches (section 1) are local and cut from `d454d905`. Decide push and PRs: the docs PR first, then the fix PRs stacked on it.

## 9. Done (for the record)

- [x] Board repaired to a clean runner (checks 1, 3, 5, 14, 15; the check-5 versus check-6 contradiction resolved in the runner and spec section 5).
- [x] The duplicate `IDEA-103` renumbered: "Profile lookup falls back to a background phase" is now **IDEA-115**.
- [x] Epic 10 formed (14 stories), rows IDEA-116 to IDEA-119 and BUG-100, FIND-119, BUG-101 created, eight rows stamped `epic: epic-10`.
- [x] Spike: one single-post scrape per vendor; both return all 5 slides (numbers in the design notes).
- [x] PRD amended for the Jobs capability (commit `c8341998`): section 3.18, FR116 to FR128, open items OI-1 to OI-4.
- [x] FR116 to FR128 backfilled into `epics.md` (inventory, coverage map, Epic 10 "FRs covered").
- [x] Nine "fix on its PR" rows verified against master and closed or corrected (section 6).
- [x] Code for BUG-100, FIND-119 and BUG-101 committed on three local branches (section 1); lint and build green on their integration.
