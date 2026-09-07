---
title: "Sprint Change Proposal: Carousel Multi-Image AI Extraction"
status: "approved"
created: "2026-09-03T00:00:00Z"
workflow: "bmad-correct-course"
worktree: "worktree-correct-course-carousel-extraction"
---

# Sprint Change Proposal: Carousel Multi-Image AI Extraction

## 1. Issue Summary

FestDaily's AI extraction pipeline only ever sees a carousel (Instagram Sidecar) post's **cover image**. Two independent gaps compound into total data loss for schedule information that lives on a later slide:

- **Story 3.3a / `instagram-adapter.ts:237`** — the scraper only captures `item.displayUrl` (the cover image) into `posts.image_url`. Apify's own `childPosts[]` array (every carousel slide) is fetched from the vendor and silently discarded at ingestion. No schema column exists to hold it.
- **Story 3.6 / `build-gemini-request.ts`** — sends exactly one image to Gemini, single-shot. No multi-image handling, no signal that extraction may be incomplete.

**Trigger evidence:** a real `laridijogja` Instagram post (`_bmad-output/implementation-artifacts/ai-extraction-improvement.md`) — a 6-image event-roundup carousel whose caption names five recommended events with no dates, where per-event schedule details plausibly live on slides 2–6. Confirmed via code trace (not assumption) that nothing in the pipeline today has a path to those slides.

**Category:** Gap in original requirements — PRD §3.7/§3.10 never anticipated multi-image posts at all; this is not a broken implementation relative to its spec, the spec itself never covered this case.

## 2. Impact Analysis

**Epic impact:** Epic 3 (Social Media Event Integration) — completable as originally planned, no epic-scope/AC rewrite. Two new lettered-suffix stories added, following this project's own established pattern (3.6a→3.6k) of never reopening an already `review`/`done` story.

**Story impact:**
- **New Story 3.3e** (persistence) — off Story 3.3a.
- **New Story 3.6l** (extraction) — off Story 3.6, depends on 3.3e.
- **Story 4.2a** (AI-assisted correction, `done`, shipped) calls `buildGeminiExtractionRequest` from `posts.imageUrl` directly — confirmed unaffected: the new capability is purely additive (new optional field), so this story's shipped code needs zero changes.
- **Story 3.4** (concrete Instagram adapter, `review`) — a cross-reference note added; Story 3.3e edits its `instagram-adapter.ts` additively.
- **In-flight Stories 3.6i/3.6j/3.6k** (privacy/contact-info filtering, same `build-gemini-request.ts` file) — flagged merge-order coordination risk, not a scope conflict.

**Artifact conflicts / updates made:**
- **PRD:** new `Post.additionalImageUrls?: string[]` field (§4.7, explicitly scoped extraction-time-only, never durable/displayed); new **FR104**; §3.7 addition describing carousel handling; §3.8 addition confirming multi-image extraction stays within one Gemini call (quota-safe by design, not by accounting change).
- **Architecture Spine:** new **AD-13** (Multi-Image Extraction Is Batched, Not Sequential) — binds the batched-request rule, the extraction-time-only/non-durable scope fence (distinguishing it from AD-12), and the completeness-signal-not-driver rule.
- **UI/UX:** none — fully backend/pipeline change.
- **IaC:** none required, conditional on the new story's hard image-count cap (`MAX_CAROUSEL_IMAGES`, default 5) keeping the AI Processor Lambda inside its existing 300s timeout — this exact bug class (unbounded async path vs. fixed Lambda timeout) already reached production once, in Story 3.4f.

**Open question resolved during design (not left open):** Section 3.10's "Selected Posts: 5/50" quota UI implicitly assumes 1 post = 1 Gemini call. The batched-single-request design (Section 3 below) means this stays true for carousel posts too — no quota-accounting change needed.

## 3. Recommended Approach — Design Research

**Question investigated:** is Gemini's free-tier quota request-based or token-based, and what does that mean for how the carousel fix should work?

**Finding:** both, simultaneously — Gemini's free tier enforces RPM (requests/minute), RPD (requests/day), *and* TPM (tokens/minute) at once; whichever is hit first throttles. Current gemini-2.5-flash free tier: ~10–15 RPM / 250–1,500 RPD / 250K–1M TPM (Google cut free-tier quotas 50–80% in a Dec-2025 pass).

**Design consequence:** a sequential "call Gemini again for image N+1, N+2…" loop is the worst pattern against RPM/RPD — each additional image burns a full extra request. Gemini already accepts multiple images in **one** request (multiple `inlineData` parts in a single `contents` array — `build-gemini-request.ts` already sends one such part). **Decision: batch all carousel slides (up to a configurable cap) into a single request**, using `minScheduleCount`/`expectedScheduleNames` as a post-hoc completeness *signal* (logged for moderator review) rather than a call-count *driver*. Same TPM cost as separate calls, a fraction of the RPM/RPD cost, faster (one round trip), and — as noted above — keeps quota accounting unchanged.

**Path forward selected:** Option 1, Direct Adjustment. Effort: Medium. Risk: Low.

## 4. Detailed Change Proposals

All applied directly to the planning artifacts in this worktree (`worktree-correct-course-carousel-extraction`):

| Artifact | Change |
|---|---|
| `prds/festgrid-prd-2026-07-10-2047/prd.md` | `Post.additionalImageUrls` field (§4.7); FR104; §3.7 + §3.8 additions |
| `epics.md` | FR104 in FR list + FR Coverage Map + Epic 3's FR-covered list; new Story 3.3e; new Story 3.6l; cross-reference note on Story 3.4 |
| `festgrid-architecture-spine.md` | New AD-13 |
| `implementation-artifacts/sprint-status.yaml` | `3-3e-...: backlog`, `3-6l-...: backlog`, both with provenance comments |

Full story text (AC, Notes, Depends-on) is in `epics.md` itself — not duplicated here per this project's existing convention (sprint-change-proposal docs reference epics.md rather than restate it).

## 5. Implementation Handoff

**Scope classification: Minor** — direct implementation by the Developer agent (`bmad-create-story` → `bmad-dev-story`), no PO/PM/Architect replan needed for this track.

**Build order:** Story 3.3e first (persistence), then Story 3.6l (depends on it). Whoever implements Story 3.6l should check whether Stories 3.6i/3.6j/3.6k have landed first and rebase the shared `build-gemini-request.ts` prompt/schema accordingly (flagged risk, Section 2).

**Success criteria:** the regression fixture in Story 3.6l's AC (a real multi-slide carousel with schedule info absent from the cover image/caption, present only on a later slide) extracts those schedules correctly, within `MAX_CAROUSEL_IMAGES` and the existing Lambda timeout.

## 6. Deferred / Out-of-Scope Items (raised during this session, not built here)

Two additional threads came up during this correct-course session and were deliberately **not** designed or built here — they were explicitly routed elsewhere by the user:

1. **Multi-provider AI Gateway fallback** (originally proposed to address BYOK quota exhaustion) — superseded by item 2 below; no longer needed once extraction is app-funded rather than per-subscriber BYOK.
2. **Drop BYOK entirely; move to app-funded paid Gemini for all extraction** — direction **decided** by the user during this session, driven by two research findings: (a) Gemini's free-tier ("Unpaid Services") terms state *"Do not submit sensitive, confidential, or personal information to the Unpaid Services"* and allow human review/training use of submitted content — a live compliance gap given the pipeline processes scraped personal data (the same category Stories 3.6i/3.6j/3.6k exist to classify-and-discard) through subscribers' free-tier keys today, independent of monetization; (b) the user's own monetization plan makes app-funded paid-tier viable, and moving to it structurally resolves finding (a) for free (a billing-enabled Cloud project gets Google's Paid-Service data terms). **Not scoped or impact-analyzed here** — grep-confirmed blast radius is large: 32 BYOK references in `epics.md`, 13 in the PRD, and four already-`done` shipped stories built specifically around BYOK (3.1b, 3.9, 3.9a, 5.3) plus the in-review onboarding wizard (3.1) and the PRD's entire two-phase monetization model (Section 6), which collapses once BYOK is no longer the day-one model. **Recommended next step: a dedicated `bmad-prd` session** to redefine the account/subscription/quota/monetization model — this is PRD-level MVP redefinition, not a correct-course story-suffix change.
   - Paid-provider landscape researched for that future session: Gemini 2.0/2.5 Flash remains cheapest-in-class multimodal ($0.075–0.30 in / $0.30–2.50 out per 1M tokens) and requires the smallest engineering delta (same adapter/schema); Qwen3.7 Flash is cheapest found overall ($0.03/$0.13) but unverified for Indonesia-market API access/support; GPT-5 Mini ($0.25/$2.00) as a mid-point; OpenAI ruled out as a *BYOK* option specifically (no genuine free tier) but remains viable paid.

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
