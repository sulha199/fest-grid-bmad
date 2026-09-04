---
backlog_id: CC-018
---

# Sprint Change Proposal — 2026-09-02

**Trigger:** `monetization-plans/scraping-extraction-display-rules-2026-09-02.md` (the "minimization doc"), a legal/product spec consolidating Indonesia PDP Law / GDPR data-minimization rules for scraped Instagram content, plus two new UI display decisions (hotlink-only event list with an opted-in prominent card; oEmbed event detail).

**Mode:** Incremental (each edit reviewed and approved individually with the user before the next).

---

## 1. Issue Summary

The minimization doc formalizes rules that were decided in prior sessions but never written into any BMad artifact. Cross-checking it against the live codebase (not just citing its own claims) surfaced two things:

1. **A live legal-exposure gap in `master`, not a hypothetical one.** Story 3.6e (re-host extracted-event images to durable storage) is merged (`git show 610cd9b` confirms) and uploads a copy of every successfully-extracted post's image unconditionally — no account-owner opt-in check anywhere in its 12 ACs. Story 3.6f (serve original vs. durable image per request) is also merged (`e872e27`, confirmed via `git log`) and makes the Event resolver fall back to that durable copy on *every* query — including the event-list/grid view, not just the detail page — whenever the original Instagram URL has expired (~4-day lifetime). This is broader than the minimization doc's own §4 described: it's a display-side violation (§3.1's "hotlink only for event list, no durable fallback") on top of the storage-side one.
2. **sprint-status.yaml was stale on both stories** — both showed `review` despite being genuinely merged. Corrected as part of this proposal.
3. **The PRD has zero content on this topic.** No PDP Law/GDPR minimization language existed anywhere in Section 5 (Security) or Section 4 (Data Schema) before this pass.
4. **No account-claim/ownership-verification flow exists anywhere** in epics.md or the PRD, at any stage — the minimization doc's own recommended mechanism for the opt-in flag (§0.1 item 4) has no home to attach to.

## 2. Impact Analysis

**Epic impact:** Epic 3 (Social Media Event Integration), `in-progress`, is not invalidated but is incomplete — 8 new stories needed within it. No rollback of 3.6e/3.6f: their mechanics (bucket, CloudFront, expiry parsing, serving precedence) are correct per Architecture Spine AD-12; only the missing consent precondition is wrong.

**Artifact conflicts found and resolved:**
- **PRD:** Section 4.1 (`EventInfo`), 4.4 (`Schedule`), 4.5 (`SocialMediaAccountProfile`) gained new fields (`hasPrivateContact`, `isImageStorageOptedIn`/`imageStorageOptInSource`) and clarifying docstrings. New Section 3.16 (Scraping & Display Data Minimization). New Security NFR bullet.
- **Architecture Spine:** AD-12 Rules 1 and 3 amended to state their consent-gated form; new Rule 7 records the correction and its provenance.
- **Epics.md:** 8 new stories (3.4n, 3.6g–3.6k, 3.7c–3.7d), a new FR104–111 traceability block, and a new Epic 8 placeholder (account-claim flow, explicitly unbuilt).
- **sprint-status.yaml:** 3-6e/3-6f corrected `review` → `done`; 8 new stories added as `backlog`; Epic 8 added as `backlog`; one action item (vendor confirmation) added.

**Technical impact:** One new migration (`isImageStorageOptedIn`/`imageStorageOptInSource`/`accountType` columns across two stories), one new moderator-only GraphQL mutation, amendments to `process-ai-job.ts`'s re-hosting call and the `Event.imageUrl` resolver, new AI-extraction-prompt guardrails (private contact, performer leak, children's-data keyword filter), and two frontend display stories (event-list card, event-detail oEmbed).

## 3. Recommended Approach

**Option 1: Direct Adjustment** — new stories within Epic 3's existing structure, no rollback, no PRD MVP scope reduction. Effort: Medium. Risk: Low (every new story is additive and defaults to the safe/closed state — `isImageStorageOptedIn` defaults `false`, so nothing currently-shipped becomes *more* exposed while these stories are pending).

**Scoping decision (confirmed with user):** the opt-in flag ships now as **moderator-only** (Story 3.6g) rather than blocking on building full Instagram-ownership verification. The future self-service account-claim flow is captured as an explicit **Epic 8 placeholder** in epics.md (not spec'd, not built) so the thread isn't lost, per the user's direct instruction.

**Fallback behavior decision (confirmed with user):** a non-opted-in account's expired original image serves a defined placeholder — **never** `durableImageUrl` under any circumstance, even as a last-resort fallback. This is a strictly stricter reading of AD-12 Rule 3 than what 3.6f currently ships.

## 4. Detailed Change Proposals

All changes were applied incrementally and approved in-session. Summary by artifact:

### PRD (`_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md`)
- §4.1 `EventInfo`: `contactInfo` docstring clarified; new `hasPrivateContact?: boolean` field.
- §4.4 `Schedule`: `performers` docstring clarified (no cross-referencing, no photo/contact leakage).
- §4.5 `SocialMediaAccountProfile`: `profileImageUrl` docstring clarified; new `isImageStorageOptedIn: boolean` and `imageStorageOptInSource?: 'MODERATOR' | 'ACCOUNT_OWNER'` fields (the latter mirrors the existing `DefaultLocationChangeSource` provenance pattern, §4.14).
- New §3.16 "Scraping & Display Data Minimization" (event-list hotlink rule, opted-in prominent card, event-detail oEmbed rule, profile-photo absolute rule, account-type filter pointer).
- §5 Security: new bullet on PDP Law/GDPR scraped-content minimization, naming the two build items not yet enforced (children's-data filter, vendor confirmation).

### Architecture Spine (`_bmad-output/planning-artifacts/festgrid-architecture-spine.md`)
- AD-12 Rule 1: re-hosting now gated on `isImageStorageOptedIn = true`.
- AD-12 Rule 3: serving precedence now never falls back to `durableImageUrl` for a non-opted-in account.
- AD-12 new Rule 7: records the consent-gate correction and its provenance (this proposal).

### Epics (`_bmad-output/planning-artifacts/epics.md`)
- New FR104–FR111 traceability entries (all Epic 3).
- New Story 3.4n (account-type scraping filter).
- New Stories 3.6g (opt-in flag + moderator mutation), 3.6h (gate 3.6e/3.6f on it — closes the live gap), 3.6i (`hasPrivateContact` classify-and-discard), 3.6j (performer-leak-guard verification), 3.6k (children's-data keyword filter, Tier 1).
- New Stories 3.7c (event-list hotlink/placeholder/prominent-card), 3.7d (event-detail oEmbed transition + fallback).
- New Epic 8 placeholder (Account Claim & Image-Storage Self-Service Opt-In) — explicitly unbuilt.

### Sprint Status (`_bmad-output/implementation-artifacts/sprint-status.yaml`)
- `3-6e`/`3-6f`: `review` → `done` (stale-status correction, verified via git).
- 8 new stories added as `backlog`, `epic-8: backlog` added.
- New action item: get Apify/Bright Data written confirmation of logged-out scraping.

## 5. Implementation Handoff

**Scope classification: Moderate** — backlog reorganization plus new backend/frontend stories within an existing epic; no PM/Architect-level replan needed (PRD/Architecture updates were completed in this same session).

- **Developer agent (`bmad-dev-story`):** implement Stories 3.4n, 3.6g→3.6k, 3.7c/3.7d in the dependency order recorded in epics.md (3.6g before 3.6h; 3.6h before 3.7c/3.7d). Each should go through `bmad-create-story` first for full context-engine drafting — these are epics.md-level story stubs, not dev-ready story files yet.
- **Product Owner:** Story 3.7c's prominent-card visual design is intentionally left text-light — the user will supply reference card-layout images before that story is drafted for development.
- **Platform operator (not a dev task):** send the Apify/Bright Data vendor-confirmation request (sprint-status.yaml action item `correct-course-2026-09-02-1`).
- **Future (not this proposal):** Epic 8 (account-claim flow) needs its own `bmad-prd` pass before any stories are drafted for it.

## 6. Success Criteria

- No account's images are durably stored or served from FestDaily's own storage unless `isImageStorageOptedIn = true` (verified once 3.6h ships).
- PRD/Architecture Spine/epics.md all reflect the same minimization rules as the source-of-truth minimization doc, with no undocumented conflict remaining.
- sprint-status.yaml accurately reflects merged-vs-backlog state for every story touched in this session.
