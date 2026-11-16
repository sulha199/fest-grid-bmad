---
title: 'Cursor extraction slice 7: moderator guards and the incomplete-list note'
type: 'feature'
created: '2026-11-10'
status: 'done'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A moderator's re-extract preview or Apply on a post whose stepped extraction is still running would race the chain (images, ordinals, grouping), and a visitor on a roundup page cannot tell that its list of events may be incomplete.

**Approach:** Slice 7 of `_bmad-output/specs/spec-cursor-extraction/build-slices.md` (AD-50, AD-51 Rule 4): preview and Apply refuse a post that holds a cursor (`CHAIN_IN_FLIGHT`); a successful Apply clears the post's partial flag; `RelatedEventGroup.extractionProgress` (COMPLETE, IN_PROGRESS, PARTIAL) is read from the post as its own small query, never joined into `Query.events` or `Query.eventBySlug` (AD-30 Rule 4), and the roundup page and the event page's related group show a short note for the two incomplete states. The sibling list itself already exists (the related-events group and the post's events page).

## Boundaries & Constraints

**Always:** The cursor and its image links are never exposed; the note shows only for IN_PROGRESS and PARTIAL; en and id strings; an ordinary event page is unchanged.

**Never:** New sibling queries, joins into the events list, notifications from stubs (AD-30 Rule 10 holds), turning the stepped path on.

## Tasks & Acceptance

- [x] `CHAIN_IN_FLIGHT` in preview and Apply (GraphQL enum, types, web non-retryable set); Apply clears `extraction_partial`; `postExtractionProgressByPostId`; `RelatedEventGroup.extractionProgress`; the note on the post events page and in the event page's related group; tests at each layer.

**Acceptance Criteria:**
- Given a post with a cursor, when a moderator starts a preview or applies one, then it is refused with CHAIN_IN_FLIGHT and nothing is written.
- Given a successful Apply, then the post's partial flag is false.
- Given a post that is PARTIAL or IN_PROGRESS, then its roundup page and its related group show the matching note; a complete post shows none.

## Spec Change Log

## Design Notes

The enum is named `PostEventsCompleteness` (a `PostExtractionProgress` type already exists in the schema) and the web's generated-types fix list (`fix-codegen.js`) gained the matching line. The Apply guard is a check before its transaction; a chain starting between the check and the commit is not excluded (rare, and Apply is moderator-driven).
