---
date: 2026-08-01
trigger_story: 1-6-view-event-details
scope: Moderate
status: approved
---

# Sprint Change Proposal — Source Post Attribution

## 1. Issue Summary

While regenerating Story 1.6 ("View event details") via `bmad-create-story`, the pre-existing draft of that story required links to "the original social media post" and a "proxy-platform post URL," but asserted (incorrectly, against the actual DB schema) that "full source URLs are not stored." Neither `epics.md`, the PRD, nor the authoritative UX scenario (`01.2-event-detail.md`) grounded this requirement, so it was dropped during the regeneration.

The user then confirmed this is a real product requirement: FestGrid's Instagram scraper is blocked from scraping Instagram directly and instead scrapes via a proxy/mirror site (`imginn.com`). Because `imginn.com` happens to preserve Instagram's own post ID/shortcode, the original Instagram URL is deterministically derivable from the scraped (proxy) URL for this specific adapter — but this derivation rule is adapter-specific, not a universal formula, since future scraper adapters for other platforms/proxies may not share this property.

## 2. Impact Analysis

- **Epic Impact:** Epic 1 (display: Stories 1.6, 1.6a) and Epic 3 (data capture: Story 1.2a's `posts` table, Story 3.4's scraping logic). No epic is invalidated or resequenced; both epics absorb an additive requirement.
- **Story Impact:**
  - Story 1.2a (`review` status, already implemented) — needs a new nullable `posts.original_post_url` column via a new migration, plus a matching `packages/shared-types` field. This is the one item in this change that touches already-implemented code.
  - Story 1.6 (created this session, `ready-for-dev`, not started) — needs its `eventBySlug` resolver/prop-mapper plan updated to expose both URLs.
  - Story 1.6a (`ready-for-dev`, not started) — needs two new optional, independently-omittable link props (mirroring its existing `mapUrl` decoupling pattern).
  - Story 3.4 ("Scrape new posts...", `backlog`, still high-level/placeholder) — annotated with the new requirement now, to be fully specified when Epic 3 gets its own `bmad-create-story`/readiness pass.
- **Artifact Conflicts:** PRD (§3.7 scraping approach, §4.7 `Post` interface, §4.1 `postId` doc comment, §3.4 event-details requirement), UX scenario (`01.2-event-detail.md`), `epics.md` (FR13, Story 1.6/1.6a ACs, Story 1.2a amendment, Story 3.4 note) — all updated as part of this proposal.
- **Technical Impact:** One real DB migration against an already-implemented table (`posts.original_post_url`, nullable — additive, non-breaking). No architecture-pattern change: this reuses the existing `events.postId → posts` join already established for `imageUrl` (Story 1.3a AC6).

## 3. Recommended Approach

**Option 1 — Direct Adjustment**, selected. Nothing has been implemented yet for Stories 1.6/1.6a (both `ready-for-dev`), so there is no rollback cost for those. Story 1.2a is `review`-status (implemented, not yet approved) — adding one nullable column via a new migration is low-risk and additive, not a redesign. MVP scope and goals are unaffected. Effort: Low-Medium (one migration + prop/field additions). Risk: Low (purely additive, nullable field, existing join pattern reused).

## 4. Detailed Change Proposals

### PRD (`prd.md`)
- §3.7: new bullet documenting the adapter-based, proxy-aware scraping approach.
- §3.4 (numbered 3.3.x in-doc): new bullet 3.3.3 "Source Attribution."
- §4.1: `EventInfo.postId` doc comment updated to mention source-link resolution.
- §4.7: `Post` interface — `postUrl`'s doc comment clarified (may be a proxy URL); new optional `originalPostUrl` field added.

### UX scenario (`01.2-event-detail.md`)
- Added a bullet to "Viewing Event Details" for the two source-attribution links.

### `epics.md`
- FR13 amended to include source attribution.
- Story 1.6a AC: new bullet for the two optional, independently-omittable link props.
- Story 1.6 AC: new bullet for fetching/exposing both URLs via GraphQL.
- Story 1.2a: new dated amendment adding the `original_post_url` migration requirement.
- Story 3.4: AC updated + a note flagging it still needs a full `bmad-create-story` pass for Epic 3.

### Story files (`_bmad-output/implementation-artifacts/`)
- `1-2a-create-posts-table-and-link-seeded-events-to-their-source-post.md` — new task/AC for the migration; status reconsidered (see Handoff).
- `1-6-view-event-details.md` — `eventBySlug` resolver plan and prop-mapper task updated to expose `postUrl`/`originalPostUrl`.
- `1-6a-build-the-reusable-event-detail-view-component.md` — new AC/props for the two optional attribution links.

## 5. Implementation Handoff

**Scope: Moderate** — backlog reorganization needed (Story 1.2a's status), plus multiple story-file edits, but no fundamental replan.

- **Product/planning artifacts (PRD, UX scenario, `epics.md`):** applied directly by this workflow run.
- **Story 1.2a:** status reconsidered from `review` → `in-progress` in `sprint-status.yaml`, since it now has required, unimplemented scope (the new migration) that a reviewer should not approve as complete. Developer agent implements the migration when picked back up.
- **Stories 1.6 / 1.6a:** patched directly by this workflow run (both still `ready-for-dev`, not started — no reviewer/rollback impact).
- **Story 3.4:** left as a flagged placeholder for Epic 3's own future `bmad-create-story`/readiness pass — not detailed further here, since Epic 3 hasn't been through that process yet.

## Success Criteria

- PRD/UX/epics.md consistently describe one requirement: attribution links to `Post.originalPostUrl` (when derivable) and `Post.postUrl` (always present), each independently optional to render.
- Story 1.2a's migration is implemented and reviewed before that story moves to `done`.
- Stories 1.6/1.6a's story files reflect the two-link contract before implementation begins.
