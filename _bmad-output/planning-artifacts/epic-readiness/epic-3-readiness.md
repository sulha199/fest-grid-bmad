---
epic: 3
swept: true
date: 2026-09-11
stories_covered:
  - 3-1a
  - 3-1
  - 3-1b
  - 3-2
  - 3-3d
  - 3-3
  - 3-3a
  - 3-3b
  - 3-3c
  - 3-3e
  - 3-4
  - 3-4a
  - 3-4b
  - 3-4c
  - 3-4d
  - 3-4e
  - 3-4f
  - 3-4g
  - 3-4h
  - 3-4i
  - 3-4j
  - 3-4k
  - 3-4n
  - 3-4o
  - 3-4p
  - 3-4q
  - 3-4r
  - 3-4l
  - 3-4m
  - 3-5
  - 3-6
  - 3-6a
  - 3-6b
  - 3-6c
  - 3-6d
  - 3-6e
  - 3-6f
  - 3-6g
  - 3-6h
  - 3-6i
  - 3-6j
  - 3-6k
  - 3-6l
  - 3-7a
  - 3-7
  - 3-7b
  - 3-7c
  - 3-7d
  - 3-7e
  - 3-8
  - 3-9
  - 3-9a
  - 3-10
  - 3-11
  - 3-12
---

# Epic 3 Readiness Report — Social Media Event Integration

## Re-sweep Trigger

Re-run at the user's request (`bmad-epic-readiness-check on epic 3`, 2026-09-11). The prior sweep (`swept: true`, 2026-08-09) covered only ~21 of Epic 3's stories; the epic has since grown to ~53 story keys (3.1a through 3.12, spanning onboarding, subscriptions, default-location management, the scraper adapter pipeline, multi-vendor scraping (Apify/Bright Data), AJV validation, moderator anomaly/audit-trail tooling, account-type classification, AI extraction, timezone inference, image re-hosting, private-data redaction, carousel extraction, the feed UI, push/email notifications, and API key quota management), largely driven by real production-incident fixes (3.4e, 3.4f, 3.4p, 3.4q) discovered after the prior sweep. This report replaces the 2026-08-09 report in full.

---

## Gate 1 — Architecture / Infrastructure Completeness (epic-wide)

**No blocking layering gap found.** Across all ~53 stories: every DB write/read goes through `apps/backend` GraphQL resolvers (no direct Drizzle call from `apps/web`); every vendor call (Apify, Bright Data, Gemini) is confined to backend Lambdas behind the `ScraperAdapter` interface (Story 3.3c), never called from the frontend; every mutation/query has a backing resolver; and Lambda-timeout/IAM gaps found mid-epic (Story 3.4f) were fixed in place rather than left as workarounds. This reconfirms the prior sweep's verdict at the epic's now much larger scope.

**One confirmed gap — asymmetric vendor-outage alerting (Apify has none, Bright Data now does):**

Story 3.4q (`review`) added moderator-alert-email observability for **Bright Data** trigger failures persisting ≥N days, root-caused from a real production incident: Bright Data returned `401 Unauthorized` on 100% of attempts for 3+ consecutive days while Apify silently absorbed all scrape traffic, visible only via `console.error` that "nobody watches" (3.4q's own words).

No equivalent exists for **Apify**. Story 3.4's own AC5 (capacity-exhaustion skip) and AC7 (per-account failure catch) are `console.error`-only — the identical silent-failure shape 3.4q was written to close for Bright Data. Epic 0.i2 ("Guarded outbound vendor calls," still `backlog`) does not close this either — its invariant is per-key lock + timeout + retry backoff + DPA gate, not moderator alerting. Since Apify is both the sync-path primary (vote checks, subscribe-time account validation, Story 3.4d) and the batch-path fallback, and 3.4q's own incident proves either vendor can independently go dark for days, an Apify outage today — especially one overlapping a Bright Data outage, as recently happened — pages no one.

- **Affects:** Story 3.4 (the Apify failure paths), Story 3.4q (the alerting mechanism this should mirror).
- **Classification:** Single-story architecture split (no other epic calls these scraper vendors, so this doesn't clear Gate 3's cross-epic bar — it's a within-pipeline completeness gap, hence Gate 1).
- **New prerequisite story added:** `3-4r-fix-apify-failure-alerting-symmetric-to-brightdata`, inserted in `epics.md` directly after Story 3.4q, before Story 3.5. See `epics.md` for full ACs.

**Non-blocking documentation note (no story created):** `docs/infrastructure/high-level-overview.md`'s mermaid diagram shows `L_ApifyWebhook` but no Bright Data node or webhook-lambda edge, despite Story 3.4a (Bright Data async webhook pipeline, `review`) being the priority batch vendor. The actual CDK/webhook route was built directly inside 3.4a/3.4f's own scope (this project's established pattern of embedding infra changes in the feature story that needs them) — this is a stale-diagram gap, not a missing-IaC gap. Recommend a docs-only fix when convenient; not tracked as a backlog story.

**Non-blocking recordkeeping note (no story created):** Stories **3.4l**, **3.4m**, and **3.6f** are live dependencies of other Epic 3 stories (3.4n depends on 3.4m; 3.6h/3.7c/3.7d depend on 3.6e/3.6f) and are `review`/`done` in `sprint-status.yaml`, but none has a `### Story 3.x:` section in `epics.md` — only `sprint-status.yaml` comments and their own implementation-artifact files document their ACs. This is already self-acknowledged in the repo (3.6f's own status comment: "this story was never given an epics.md heading at all"; Story 3.12's note calls it "a tracking gap in the same family as Stories 3.3d/3.4m/0.29's"). `story-split-gate.md` treats `epics.md` as the authoritative source, so this remains a real gap worth closing — but it is a backfill of already-built stories, not a new prerequisite, so no backlog entry was created for it. Recommend a follow-up pass (outside this sweep) to write the missing `epics.md` sections from the existing implementation-artifact files.

---

## Gate 3 — Foundational / Cross-Cutting Dependency Completeness (epic-wide + cross-epic)

**No gap found.** All foundational tooling Epic 3 depends on — i18n, the GraphQL scaffold/Code Generator, the `activeOnly(table)` soft-delete helper, `buildOptimizedDrizzleSelect`, the auth context, the AI Gateway adapter, KMS/BYOK encryption — has an owning Epic 0 story and is consistently referenced by name (e.g. `activeOnly(table)` invoked explicitly in Stories 3.1a, 3.1b, 3.2, 3.3b rather than a hand-written `isNull(...)`).

Verified specifically for this re-sweep:

- **No table duplication between Story 3.4h and 3.4j:** `unprocessed_scraper_payloads` (3.4h) captures only AJV-validation *failures* for moderator reprocessing with parser versioning; `scraper_actor_runs` (3.4j) captures *every* actor run (success or failure, raw vendor I/O) as an immutable replay-by-run-ID audit trail, deliberately unified because the sync Apify tier never wrote to the pending-job tables at all. Cleanly distinct.
- **AD-8 soft-delete consistency holds:** `scraper_actor_runs` is explicitly excluded (immutable audit log, same rationale as `Schedule`/`Post`/`GeolocationCache`); `unprocessed_scraper_payloads` gets its own soft-delete mutation; the pending-job tables are system-coordination tables outside AD-8's scope, same logic as `GeolocationCache`.
- **Cross-epic split coherence (3.4n/3.4o → Epic 4's Story 4.7c):** Confirmed `4.7c` (review queue for pending account-type classifications) exists in `epics.md`; the split is coherent on both sides.
- **`posts.content` becoming nullable (Story 3.4o) has no unhandled ripple:** the only other direct consumer, Epic 4's AI-assisted correction (`extractEventDataFromUrl`), was already found and resolved by 3.4o's own 2026-09-03 amendment (guarded resolver, correction trigger hidden for `CURATOR_GUIDE`-sourced events). Epic 1's search and the `#`-hashtag search (operates on the separate `posts.hashtags` column) are unaffected — neither reads `posts.content`.
- **Cross-epic reuse of Epic-3-owned concepts is coherent on both sides:** `SocialMediaAccountProfile`/`defaultLocation` (Epic 4's `DefaultLocationChangeRequest`, Epic 6's `castVote`), `posts`/`AIProcessingQueue` (Epic 5's `selectPostsForExtraction`), `ScraperAdapter.lookupAccountProfile` (Epic 6's Story 6.1a, itself a prior Gate 3 finding already resolved via a Story 3.3c amendment), `mySubscriptions`/`isInactive` (Epic 5's Story 5.1a extends rather than rebuilds Story 3.2's query). No orphaned or duplicated ownership found.

No new prerequisite story is warranted under Gate 3.

---

## New Prerequisite Stories Added This Sweep

| Story Key | epics.md Section | Classification | Position |
|---|---|---|---|
| `3-4r` | Fix Apify failure alerting to match Bright Data's outage observability | Single-story architecture split (Gate 1) | Directly after Story 3.4q, before Story 3.5 |

`sprint-status.yaml` backlog entry added immediately after `3-4q-...: review`.

## AC Corrections Applied to Existing Stories

None — no existing story's AC required correction this sweep.

---

## Verdict & Next Steps

Epic 3 remains architecturally sound at its now much larger scope: 53 stories, no bypassed layers, no orphaned cross-cutting dependencies, and every cross-epic reuse of an Epic-3-owned table/adapter/queue has a coherent ownership note on both sides. The one real gap found — Apify's outage alerting lagging behind Bright Data's — is narrow, single-story, and already fully specified (`3-4r`) as a direct mirror of Story 3.4q's already-shipped mechanism.

**Next Action:** `bmad-create-story 3-4r` is ready to run (small, well-scoped, mirrors an existing pattern — a plausible `bmad-quick-dev` candidate at the implementer's discretion, matching Story 3.4q's own priority note). Otherwise, proceed with any remaining Epic 3 backlog story via `bmad-create-story`, citing this report to skip Gate 1/Gate 3 and run only Gate 2.

**Separately recommended, not blocking:** backfill missing `epics.md` headings for Stories 3.4l/3.4m/3.6f, and refresh `docs/infrastructure/high-level-overview.md`'s diagram to include Bright Data.
