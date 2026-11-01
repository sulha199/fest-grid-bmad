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
- [ ] **FIND-119** (a rescrape failure that spent no vendor credit still starts the 10-minute cooldown) `xs`. Next action: `bmad-quick-dev`.
- [ ] **BUG-101** (Apify's slide list repeats the cover, so Gemini receives it twice) `xs`. Fix the adapter and de-duplicate by file name at
  read time in `build-gemini-request.ts` so the 354 stored Apify posts are covered without a backfill. Next action: `bmad-quick-dev`.

## 2. Gates before any Epic 10 story starts

- [ ] **`bmad-prd`** for the Jobs capability: a new section plus amendments to PRD sections 3.7, 3.9.3 and 3.11; settle IDEA-119's
  subscriber-notification question and the cap wording (IDEA-008). The gate puts this first for a feature epic.
- [ ] **`bmad-epic-readiness-check`** on epic-10: validates or splits Story 10.1a and the mechanism parts 10.2 to 10.5. If it drops or
  reshapes 10.2 or 10.5, re-examine the re-scoring of **IDEA-101** (remember an exhausted Apify cap) and **IDEA-102** (Bright Data
  snapshots take hours), both set to `xs` on the strength of those stories.
- [ ] **`bmad-ux`** for the Jobs page, and for **IDEA-115** (profile lookup falls back to a background phase) before Stories 10.4 and 10.7.

## 3. Decisions that are the owner's

- [ ] **FIND-103** (Apify is on the free plan, $5 a month, resets 2026-11-23): upgrade, or keep Bright Data primary? Decides the default
  chain order (`apify,brightdata` assumes Apify capacity) and interacts with the low-resolution rule, because Bright Data images are 640 px.
- [ ] **IDEA-115**'s four open decisions D1 to D4 (`profile-lookup-fallback-and-ux-2026-10-31.md` section 6).
- [ ] **CC-032** (decide the cost model: platform-paid, user-paid or hybrid): decides whose key a vendor call uses.
- [ ] **Story 3-4b** (BYOK pooled scraper vendor keys, legally gated): its AC6 (a contributed Apify token is never used for a
  moderator-initiated run) is already a constraint on Story 10.2's credential choice.
- [ ] **Notifying subscribing users** when a job finishes (IDEA-119): channel, throttling, consent. A PRD question.
- [ ] **Whether to migrate `manual_extraction_jobs`** onto the engine's table: recorded in Story 10.9, decide there.
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

- [ ] **BUG-076, BUG-077, BUG-078, BUG-081, BUG-082, BUG-083, BUG-090** and **IDEA-097**: each says "fix on its PR, set done once merged". Check the PR,
  set `done`. (BUG-077 blocks BUG-078.)
- [ ] **BUG-051** (a post advertising several events merges them into one): marked addressed by CC-024's stories; verify and close.

## 7. Pieces that join an epic story (their rows stay open until that story lands)

- [ ] **FIND-086** (re-extract preview review deferrals) and **FIND-111** (Apply keeps unapplied previews on the job row): `carve-first`. Split each so the
  retention/sweep finding joins Story 10.1a and the rest stays as its own row.
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
- [ ] **Branch state:** `docs/board-repair-2026-11-02` holds the board repair and this formation as local commits, unpushed. Decide push and PR.

## 9. Done (for the record)

- [x] Board repaired to a clean runner (checks 1, 3, 5, 14, 15; the check-5 versus check-6 contradiction resolved in the runner and spec section 5).
- [x] The duplicate `IDEA-103` renumbered: "Profile lookup falls back to a background phase" is now **IDEA-115**.
- [x] Epic 10 formed (14 stories), rows IDEA-116 to IDEA-119 and BUG-100, FIND-119, BUG-101 created, eight rows stamped `epic: epic-10`.
- [x] Spike: one single-post scrape per vendor; both return all 5 slides (numbers in the design notes).
