# Epic formation report, 2026-11-02

**Pass:** `bmad-form-epics`, scoped by a seed from the 2026-10-31 re-extract investigation, with a full-board disposition. The reading pass (Step 2) and the re-scoring sweep (Step 6) ran inline on the driving model (Sonnet 5.5) by the owner's choice, not delegated to Opus; the checkpoint listed group counts so omissions could be argued.
**Result:** one feature epic formed, **Epic 10: Background vendor jobs: one engine, one Jobs page**. Epics.md, sprint-status and the board moved together. What sits outside the epic is tracked in `epic-10-outside-the-epic-2026-11-02.md`.

## 1. Frozen input

| | |
|---|---|
| Date | 2026-11-02 |
| Base | master `041a15e0` (PR #134) plus the board-repair commit `c1a09ce6` on branch `docs/board-repair-2026-11-02` |
| Rows | 307 (116 open: 90 `backlog`, 26 `triaged`); 7 more were added by this pass |
| Unstarted stories read | 23 (`backlog` / `ready-for-dev` in `sprint-status.yaml`) |
| Runner | exit 0 before this pass (it was 78 failures before the repair commit); exit 0 after |
| Check 13 | nothing due |

The repair commit fixed checks 1, 3, 5, 14 and 15 (58 over-long notes moved verbatim; five deferral rows FIND-114 to FIND-118 created; the IDEA-103 duplicate renumbered to IDEA-115) and changed the runner so a parent with an open child derives `promoted` (spec sections 5 and 6 contradicted each other for CC-028 and IDEA-026).

## 2. Candidates, per pass

- **Mechanical axes (all groups read):** tags 11 groups of 2 to 6 rows (8 below 3 rows fail criterion 1) and 12 too broad; 5 `parent` groups (2 to 5 rows); 7 `deferred-from` groups (2 to 4 rows); spine-AD none; cost-skipped FIND-075. (`--cluster` crashes on Windows without `PYTHONIOENCODING=utf-8`; tracked in the outside-the-epic file.)
- **Reading pass (shared repair shape):** 3 candidates: background jobs, event dedup, Epic 9 leftovers.
- **Feature pass (capability / journey):** 2 candidates: background jobs, event dedup.

## 3. Accepted: Epic 10 (feature epic)

**Capability:** a user or moderator who starts work that takes longer than a request sees it run in the background and can check its progress and result in one place; it finishes even when a vendor is slow, over quota or fails over, and starting it twice never costs twice.

**Criterion 3 (feature form): the user left with an incomplete outcome, per member**

| Member | Left incomplete |
|---|---|
| BUG-099 (Moderator re-extract preview drops carousel slides: expired ...) | a moderator sees "0 of 1 images" on a carousel roundup |
| IDEA-047 (AI-assisted correction should support re-scraping a post whe...) | a moderator cannot correct a post whose caption or images vanished |
| IDEA-115 (Profile lookup falls back to a background phase on timeout, ...) | a subscriber gets a generic toast and no progress when the lookup is slow |
| IDEA-008 (Max 5 subscribed accounts (normal user), upgrade-account 'co...) | concurrent background subscribes can push a user past the cap |
| IDEA-009 (Auto-extract posts on first subscribe (respecting Gemini's 5...) | a new subscriber sees no events until the daily batch |
| BUG-014 (Moderator payload reprocessing remains unbuilt after its fal...) | a moderator triggers a reprocess and nothing happens |

IDEA-008 is open and the cap is not in app source, so it joins and Story 10.3 builds it with the slot reservation (the owner's "extension"). IDEA-101 and IDEA-102 are `sweep` rows answered by Stories 10.2 and 10.5. They share a surface but a user gets the whole outcome without them, so they are not members (criterion 3).

**Stories:** 10.1a engine core (mechanism), 10.2 post-scraper chain, 10.3 admission control, 10.4 Jobs page, 10.5 late results, 10.6 re-extract, 10.7 subscribe and profile lookup, 10.8 first-subscribe auto-extract, 10.9 AI correction, 10.10 extract-by-URL, 10.11 refresh now, 10.12 admin batch jobs, 10.13 notifications, 10.14z ratchet. The gate allows one mechanism story; 10.1a is large and 10.2 to 10.5 are mechanism parts, so `bmad-epic-readiness-check` is expected to validate or split them.

**Spec reconciliation (gate section 6):**

| Row | Route |
|---|---|
| BUG-099 | PRD amendment (section 3.9.3); AD-12 and AD-40 amended in Story 10.6 |
| IDEA-115 | `bmad-ux` and an AD-41 extension (its planning doc section 6 decisions D1 to D4) |
| IDEA-008 | none (PRD section 6 already resolved the cap) |
| IDEA-009 | PRD section 3.11 amendment, `bmad-ux` |
| IDEA-047 | PRD section 3.9 amendment (narrows Story 3.4o's CURATOR_GUIDE hold) |
| BUG-014 | internal moderator tooling: none |
| IDEA-116 to IDEA-118 | PRD amendment where user-visible |
| IDEA-119 | notifying subscribers is a `bmad-prd` question; moderators go through Epic 0.i1 |
| Engine | a new `AD-n` written in Story 10.1a; PRD: a new Jobs capability section first (gate section 2) |

**Ratchet `z`:** optional for a feature epic, included because the epic exists to stop features forking the engine: an esbuild-metafile test that every Lambda entry reaching a vendor call also registers the adapters (red first against `lambdas/api.ts`), and a boundary test that no resolver imports a vendor client outside the engine.

## 4. Rows created at formation

- **Epic members:** IDEA-116 (extract-by-URL runs as a job), IDEA-117 ("refresh now" shows progress), IDEA-118 (CLI-only admin operations run as jobs), IDEA-119 (tell the user when a job finishes).
- **Fix ahead of the epic, not members:** BUG-100 (API Lambda registers no scraper adapters), FIND-119 (a rescrape failure with no vendor call starts the cooldown), BUG-101 (Apify slide list repeats the cover).
- **Stamped `epic: epic-10`:** BUG-099, IDEA-115, IDEA-047, IDEA-008, IDEA-009, BUG-014, IDEA-101, IDEA-102.

## 5. Unstarted stories read (23)

None absorbed, none superseded. Twenty-two belong to epics already formed (0.i1, 0.i3, 0.i4, 0.i5, 0.i6, 2.i1) or stand alone (0-24 wizard page primitive); they constrain Epic 10 rather than overlap it:

- `0-i1a-build-the-notifyallmoderators-helper-with-escaped-throttled-templates`: Story 10.13 depends on it.
- `0-i3b-add-the-lambda-timeout-check`, `0-i3c-add-the-iam-grant-check`: Story 10.1a's CDK change must pass them.
- `0-i5c`, `0-i5z`, `0-i6b`, `0-i6d`, `0-i6z`: Story 10.4 must adopt the shared list controller and `SubscribedAccountCard`, or those ratchets fail.
- `0-24-build-the-reusable-wizard-page-primitive`: Story 10.8 changes the wizard's redirect; read it first.
- `3-4b-byok-pooled-scraper-vendor-keys` (legally gated): not a rival design, but its AC6 (a contributed Apify token is never used for a moderator-initiated run) means chain credentials depend on the job type (Story 10.2).

## 6. Rejected candidates

| Candidate | Failing criterion | Routing |
|---|---|---|
| Tag `web:subscriptions` (BUG-059, BUG-081, FIND-022, IDEA-008, IDEA-009, IDEA-115) | 3: BUG-059, BUG-081, FIND-022 are account-identity defects, a different journey | those three to `promote` / `quick-dev` |
| Tag `cross:notifications` (BUG-003, FIND-117, IDEA-005, IDEA-054) | 2 and 3: different mechanisms | BUG-003 already in Epic 0.i1 |
| Parent CC-028 (FIND-066, FIND-067, IDEA-057, IDEA-058, IDEA-059) | 3: a privacy and data-terms journey, not jobs | dispositions below |
| Parents CC-014, CC-024, FIND-088 (2 rows each) | 1 | dispositions below |
| **Event dedup** (IDEA-062, IDEA-066, IDEA-067, IDEA-056, BUG-094, FIND-113, FIND-104, FIND-107, FIND-108, FIND-112) | not rejected on criteria: a plausible feature epic, **not formed** | FIND-104, FIND-107, FIND-108 and FIND-112 are already sequenced by `spec-ai-dedup-review-pipeline`; run a second pass if wanted (tracked) |
| **Epic 9 leftovers** (BUG-065, BUG-066, FIND-087, FIND-088, FIND-089, FIND-090) | gaps in an already-formed epic, not formed again | standalone dispositions below (tracked) |

## 7. Re-scoring sweep (gate section 9.1)

Read: every open row outside Epic 10 and the 4 `skipped` rows (IDEA-004 `value:`, IDEA-001 `value:`, IDEA-063 `value:`, FIND-075 `cost:`).

- **Joined and re-scored now:** IDEA-101 `s` -> `xs` and IDEA-102 `s` -> `xs` (post-mechanism effort: each is one acceptance criterion of Stories 10.2 and 10.5). The estimate is conditional on those stories; if readiness-check drops or reshapes them, re-examine both.
- **`reprice_on: epic-10`:** none. FIND-072 (async enqueue on first delivery only) and BUG-029 (queryActorRuns 502) were considered; their fixes are not the engine's mechanism.
- **Reopened:** none. FIND-075 is a `cost:` skip about `next/image` and is unrelated; the three `value:` skips never reopen on price (section 9.2).
- Rows whose retention or sweep finding joins Story 10.1a (FIND-086, FIND-111) are `carve-first`: split them before they are promoted.

## 8. Unclustered rows by disposition (110)

### adopt: epic-0-i1 (3)

- BUG-003 [user-visible/m] No email notification when a location change enters AWAITING_APPROVAL
- FIND-021 [user-visible/m] render-template.ts has no HTML-escaping; scraper-sourced content flows unescaped into moderator alert emails
- FIND-020 [internal/m] Scraper audit-trail alert lacks throttling/dedup, duplicates an existing moderator-notify pattern, and depends on the same DB it may be reporting on

### adopt: epic-0-i2 (1)

- BUG-011 [latent/m] Gemini/AI backend calls lack concurrency locking, backoff, and rate-limiting guardrails

### adopt: epic-0-i3 (2)

- FIND-015 [internal/m] Assorted process gaps: DB setup docs, an irreversible enum migration, disabled lint gate
- BUG-002 [latent/s] aiProcessorLambda and ingestorLambda share 3.4f's missing-timeout gap — never folded in or decided

### adopt: epic-0-i4 (3)

- FIND-001 [internal/xs] Story 3.1b AC4 and 3.4 AC3 prose never updated though the behaviour shipped
- FIND-002 [internal/xs] PRD favoriteCount text edit was proposed but never applied to prd.md
- FIND-003 [internal/xs] UX rework items #7/#8/#9 routed straight to bmad-create-story — landing never verified

### adopt: epic-0-i5 (1)

- BUG-020 [user-visible/m] Moderator tools tab-item pages lack previous-page navigation and total/page info in their simple pagination

### adopt: epic-0-i6 (1)

- FIND-008 [cosmetic/xs] AccountAvatar hardcodes border-slate-* instead of the semantic border-border token

### adopt: epic-0-i7 (1)

- IDEA-024 [cosmetic/s] Build the event-detail map-link's untrusted-confidence fallback from the fullest known location context (place text + city/province/country), not the bare ambiguous string

### adopt: epic-2-i1 (1)

- FIND-006 [internal/s] Two ux-rework2 fixes shipped without automated tests (favorite cache-sync, scroll-anchor)

### blocked (6)

- FIND-103 [user-visible/xs] Prod's Apify account is on the FREE plan ($5/month) and cannot carry the daily scrape load (~$19/month) -- owner decision: upgrade the Apify plan or keep Bright Data primary
- FIND-104 [user-visible/s] AI dedup review piece C: daily moderator-dedup-review skill, escalation issues and insight log -- FIND-107 on master first
- IDEA-103 [user-visible/m] Moderator Apply for re-extract: turn a post stored as one event into a roundup linked to several events -- a prod exercise of Apply after deploy
- FIND-107 [internal/m] AI dedup review piece B1: read-only export workflow, evidence contract and evidence hash -- Piece A (shared resolveSuggestedMatch)
- FIND-108 [internal/m] AI dedup review piece B2b-1: decision validator, floor and caps in packages/domain, and the apply script -- FIND-107 / the piece chain; blocks FIND-112
- FIND-112 [internal/m] AI dedup review piece B2b-2: apply workflow, credentials, kill switch, new AD, PRD amendment and runbook -- FIND-108 on master; the write-secret name is the owner call

### carve-first (2)

- FIND-086 [internal/s] Re-extract preview review deferrals: unclaimed-job caption sweep, invalid-JSON links aborting the candidate query, LIMIT 20 ordering, URL variants -- the unclaimed-job caption sweep joins Story 10.1a; the other findings stay
- FIND-111 [internal/s] Re-extract Apply: unapplied previews keep their extraction on the job row, and Apply has no drift check or stub-to-full path -- retention of unapplied previews joins Story 10.1a; drift check and stub-to-full stay

### promote (19)

- BUG-051 [user-visible/l] A post advertising multiple distinct events has its schedules incorrectly merged into one event
- BUG-059 [user-visible/m] A subscribed account and its scrape-discovered numeric-ID profile are two rows; posts land on the one nobody subscribed to
- BUG-065 [user-visible/m] Calendar tabs on Home and Feed ignore the active AI filter and expression
- BUG-066 [user-visible/m] Embed widget page never applies the widget's saved filters or expression
- BUG-097 [user-visible/m] TODAY/UPCOMING toggles and the next-upcoming sort key still use the UTC date, so 'Today' is UTC's yesterday for Jakarta's first 7 hours
- FIND-022 [user-visible/l] Repost/coauthor posts are misattributed to the subscribed (scraping) account instead of the original-owner account
- FIND-072 [user-visible/m] Async-scrape auto-enqueue only fires on a post's first delivery; a timeout or transient failure leaves it unextracted, and webhook Lambdas have no timeout headroom
- FIND-087 [user-visible/m] AI filter relative dates resolve in UTC: no caller passes the viewer timezone to the compiler
- FIND-089 [user-visible/m] A saved AI filter or widget that no longer validates is repaired silently: the degraded flag reaches no UI
- IDEA-006 [user-visible/l] Epic 8 — self-service account claim and ownership verification
- IDEA-056 [user-visible/m] LLM tie-break for mid-confidence cross-post event matches
- IDEA-062 [user-visible/m] Let a moderator manually pick any two arbitrary events to merge, not only matcher-flagged suggestions
- IDEA-066 [user-visible/m] Primary-post ordering: let an organizer's own post beat a venue's post of the same event
- FIND-041 [internal/m] pollAndDrainQueue's swallowed handleMessage failures never surface as a Lambda error/CloudWatch alarm signal
- FIND-078 [internal/m] Widen the EventDetailViewLabels locale-parity ratchet (Story 0.50) to the ~19 other *Labels interfaces across packages/ui, packages/domain, and apps/web
- FIND-092 [internal/m] Test-tooling blind spots from the responsive audit review: detector clip/RTL model, path-ambiguity ancestry, settle signature, duplicated lists, stub endpoints
- IDEA-057 [internal/l] Move face blur into its own queued stage ahead of the AI queue
- FIND-033 [latent/m] ux-rework2 remaining polish: unmanaged expand/collapse focus, unpruned dayOverrides map, loose test assertion, calendar-layout question
- IDEA-002 [cosmetic/m] Redesign the logomark — 2x2 grid icon is a visual pun on the retired 'Grid' name

### quick-dev (59)

- FIND-066 [compliance/s] Gemini key billing tier is never verified, so free-tier keys may let Google use submitted images
- FIND-067 [compliance/s] Moderator-set opt-ins now also authorize sending an account's images unblurred to the AI vendor
- FIND-079 [compliance/s] Public-accounts-only scope is not enforced: subscribe path never checks whether an Instagram account is private
- FIND-109 [compliance/s] Workflows with database or cloud secrets run dependency install scripts and tag-pinned third-party actions before the secret step
- BUG-029 [user-visible/s] queryActorRuns returns HTTP 502 in production (moderator Actor Runs browser)
- BUG-064 [user-visible/s] Extraction leaks the model's reasoning into events.organizer_name (ig_p_Deg9VTFFC90 holds 2,165 characters of 'Wait, let's ...')
- BUG-076 [user-visible/s] Daily batch fires every Apify trigger at once; the account's memory cap refuses most (402 actor-memory-limit-exceeded) and they are logged and classed as an outage
- BUG-077 [user-visible/s] Queue fallback drops an account silently when the Apify call exceeds 26s: no audit row, run not aborted, lastScrapedAt stamped, message deleted
- BUG-081 [user-visible/s] Profile backfill overwrites a subscribed username with a non-owner post's; the batch scrapes the wrong account
- BUG-082 [user-visible/xs] Provider health trusts a degraded provider again once probing leaves under 10 runs in 72h, so the next batch sends it every target
- BUG-083 [user-visible/xs] Queue-path Apify runs refused by the account memory cap (402) are recorded FAILED and burn SQS receives
- BUG-090 [user-visible/s] Discovery's default order has no tie-breaker, so paging repeats one event and skips another
- CC-030 [user-visible/s] Masonry Phase 2 layout defects: full-width column-0 items overlapping column 1, and no vertical gap
- FIND-039 [user-visible/s] Bright Data's coauthor_producers field shape is unverified -- its cited fixture no longer exists on disk
- FIND-113 [user-visible/s] undoEventMerge does not refuse when the winner or loser has a later live merge
- IDEA-054 [user-visible/s] Throttle or batch push-notification bursts when one post yields several events
- IDEA-067 [user-visible/s] Matching organizer signal: count the new post's own co-author/publisher associations, not only posts.accountId
- BUG-078 [internal/xs] scraper_batch_runs counts targets that fell back to the scraping queue as dispatched_failed, so a working fallback reads as an outage
- FIND-038 [internal/s] FIND-035 review findings: no DB seam/chunking/env-guard/interaction-test coverage around the new incremental-scrape query
- FIND-040 [internal/s] pollAndDrainQueue reprocesses a message if deleteSqsMessage throws after handleMessage already succeeded
- FIND-042 [internal/xs] Unconditional grantConsumeMessages 'harmless no-op duplicate' claim on dev/staging is untested
- FIND-043 [internal/s] queryModeratorAccountProfiles's unfiltered first:50 page makes resolvers.test.ts flaky as social_media_account_profiles grows
- FIND-044 [internal/s] posts-select-content.tsx test/coverage gaps found while removing the stale CURATOR_GUIDE gate: unscoped mock, no gate+minimization composition test, single sprawling gated-account it(), and pre-existing xlinkTitle (not title) on the 3 remaining gate icons
- FIND-046 [internal/s] prototypes/validation-log.md records rounds 1-4 only, so four of the rules shipped by Story 1.i1l have no screenshot re-validation record
- FIND-049 [internal/xs] assertFormattingFunctionExists's regex only matches export function declarations, false-throws on export const formatX = (...) =>-style formatters
- FIND-050 [internal/xs] count-badge-react-mount demo manifest's overflow rule is a trivially-passing single-element sibling cluster, enforces nothing
- FIND-051 [internal/s] event-card-date-box-overflow manifest fixture never mounts the shipped 'number' day-variant class path and only covers size='default' — no live fixture for compact-row word rendering
- FIND-055 [internal/s] BUG-046's fix leaves 4 hardening gaps: no regression test for a now-3x-recurring bug class, body-only scope, unaudited other-route/nested-scroll blast radius, and 4 overlapping overflow-anchor:none mechanisms with no consolidation plan
- FIND-056 [internal/xs] BUG-047 code review: min-w-[2ch] numeral-width assumption, and a latent date-vs-till-tag mismatch for an unreachable calendar input
- FIND-069 [internal/s] CC-028 review leftovers: blurred-branch upload time guard, audit-label granularity, CDK env normalisation, test gaps
- FIND-077 [internal/s] packages/visual-audit's vendor Tailwind config is a second, hand-maintained theme with nothing that checks it stays in sync with apps/web/tailwind.config.ts
- FIND-082 [internal/s] Story 0.i2d review deferrals: triplicated transient-error classifier; Apify webhook 20s cap covers dataset download
- FIND-084 [internal/s] BUG-059 story 1 review deferrals: cached 308 after a rename, no lower(username) index, removed query has no alias, metadata 404s on outage
- FIND-088 [internal/s] Epic 9 review deferrals: English-only domain caveats, NOT over dayOfWeek bounded to 90 days, eval environment binding
- FIND-090 [internal/s] Epic 9 re-review leftovers: syntactic drift signature, duplicated radius bound, month-span wording, FilterHub clamp heuristic, Save button hidden without a hint
- FIND-096 [internal/xs] No lint guard against event-category-definitions.ts's type-only EventCategory import silently reverting to a value import and reintroducing a runtime cycle
- FIND-097 [internal/xs] Golden-corpus fixture 11-wedding-expo hard-asserts a classification its own rationale calls genuinely contestable, with no soft-miss mechanism in the live-eval test
- FIND-100 [internal/s] Story 0.54 code review: fixture 11 empty mustNotInclude, ratchet Check D margin now 1-of-3
- FIND-102 [internal/s] With groupingReason required, the CC-024 roundup post returns 39 events (soft cap 10) in 4 of 9 live runs vs 0 of 9 when optional; code truncation still caps it
- FIND-105 [internal/xs] trigger-brightdata-for-target capacity test fails in the cloud sandbox (passes in CI)
- FIND-106 [internal/xs] scraper.test.ts daily-batch cutoff test fails in the cloud sandbox (passes in CI): cutoff one hour earlier than expected
- FIND-114 [internal/s] Sharp-isolation test checks the esbuild graph only, not execution or CDK's real esbuild options
- FIND-115 [internal/s] EventCard keeps dead props and a dead date helper after FIND-053; archive getCardProps is any-typed
- FIND-116 [internal/s] Scraper integration tests skip post_account_associations rows, clean up four ways and flaked once
- FIND-117 [internal/s] Awaited notification dispatch lacks a regression test and a prod guard; email failures go unchecked
- FIND-118 [internal/s] Wave 3 gate fixes leave the extraction-ordinal CHECK untested and 9 event fixtures unshared
- IDEA-051 [internal/s] Sample hasFaceImage=false posts through face-api.js to measure the pre-filter's real false-negative rate
- IDEA-052 [internal/s] Move useNavRailItemInteraction onto the shared useHoverFocusTooltip hook (three hand-rolled hover+focus tooltip copies exist)
- IDEA-058 [internal/s] Eyes-only face redaction for the AI input via the landmark model
- IDEA-071 [internal/s] Backfill LocationDetails.venueType: the geolocation cache never expires and existing schedules were geocoded before it was stored
- IDEA-097 [internal/xs] Scraper Lambda runs at the 128 MB default (Max Memory Used 124-128 MB, two poll-and-drain runs hit the full 300s): give it 512 MB
- IDEA-098 [internal/s] Bright Data diagnostic script (with and without start_date) and a per-provider 'every run returned zero items' alarm
- BUG-054 [latent/s] AI extraction never populates Schedule.applicableDaysOfWeek -- the field exists end-to-end but nothing sets it from scraped posters/captions
- BUG-094 [latent/s] Suggested-match merges outside resolveSuggestedMatch skip the row lock and pending guard, and event rows are never locked
- IDEA-064 [latent/s] Backfill isVerifiedForDiscovery=true for profiles that already have active votes from before Story 3.17's castVote flip
- FIND-057 [cosmetic/xs] CalendarOverflowDialog (VM8) still doesn't render a status badge -- EventCardCalendarGridItem's status-badge treatment (VM5/VM6) never reaches it
- FIND-058 [cosmetic/xs] MultiDaySpanningBar still missing isAddedToCalendar treatment (nearbyBadgeLabel gap since closed), and no browser/screenshot check of the new grid composition
- FIND-065 [cosmetic/s] SubscribedAccountCard still not wired into Post Selection
- FIND-073 [cosmetic/xs] EventCard masonry date-box status text clips at 80px for the happeningNow / In {n} hour(s) variants

### reprice_on: epic-0-i2 (1)

- FIND-018 [latent/s] Saved AI filter API needs a list limit, a per-user save quota and mapped DB errors

### spec-first (8)

- CC-032 [compliance/m] Decide the cost model: platform-paid vs user-paid (BYOK) vs hybrid, now that Apify allows contributed tokens within conditions -- product decision on the cost model (BYOK or platform-paid)
- IDEA-059 [compliance/l] Evaluate Vertex AI (own data terms) as the extraction path instead of the Gemini Developer API -- product decision on Vertex AI versus the Gemini Developer API
- BUG-080 [user-visible/m] Online events get the posting account's default location and a map pin; the product has no attendance-mode (in person / online / hybrid) concept -- PRD change via bmad-correct-course (attendance mode)
- IDEA-005 [user-visible/l] Push-notification-triggered image cache warming -- never scoped; needs scoping
- IDEA-027 [user-visible/m] No UI for a user to view/edit their own account profile settings (display name, timezone, locale, email/password) -- bmad-ux pass for the settings tab
- IDEA-070 [user-visible/m] Venue type design: closed indoor/outdoor + venue-kind vocabulary, Geoapify vs AI classification, NOT semantics, then re-enable it in the AI filter -- venue-type design decisions
- IDEA-072 [internal/m] AI-filter golden prompts that grow from real usage: production capture, human-gated promotion, drift mining -- privacy decision on logging prompts
- FIND-037 [latent/s] Profile deletion still fails one FK deeper: scraperActorRuns.id has no cascade/set-null from posts/unprocessedScraperPayloads/brightdataPendingJobs -- product decision: set null or cascade

### sweep: epic-10 (2)

- IDEA-101 [internal/s] Remember an exhausted Apify monthly cap for the rest of the usage cycle instead of trying every target -- answered by Story 10.2 (remember an exhausted Apify cap = the chain's quota skip); re-scored s -> xs
- IDEA-102 [internal/s] Bright Data snapshots can take hours; the 180-minute expiry sends them to a paid Apify fallback while the late result still arrives -- answered by Story 10.5 (a snapshot Bright Data still reports as running = the late-result sweep); re-scored s -> xs

**Balance:** 6 accepted members + 110 unclustered = 116 open rows read.

## 9. Coverage by impact

| Impact | Clustered | Open | Share |
|---|---|---|---|
| compliance | 0 | 6 | 0% |
| user-visible | 6 | 42 | 14% |
| internal | 0 | 53 | 0% |
| latent | 0 | 8 | 0% |
| cosmetic | 0 | 7 | 0% |

The 14% for `user-visible` is low because the pass was seeded on one capability. Of the 42 user-visible rows, 6 are Epic 10 members, 6 sit in the dedup cluster and 4 in the Epic 9 leftovers (neither formed), and 26 are standalone rows. Neither asymmetry is a criterion bias; both clusters are listed in the outside-the-epic file so the next pass can decide.

## 10. For the next pass

- `bmad-prd` for the Jobs capability comes before `bmad-epic-readiness-check` on Epic 10, then `bmad-create-story` in story order.
- Several `quick-dev` rows say "fix on its PR, set done once merged" (BUG-076, BUG-077, BUG-078, BUG-081, BUG-082, BUG-083, BUG-090, IDEA-097); their action is verify and close.
- Run the runner with `PYTHONIOENCODING=utf-8` for `--cluster` on Windows.
