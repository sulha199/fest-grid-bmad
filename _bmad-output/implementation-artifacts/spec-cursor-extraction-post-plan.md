---
title: 'Cursor extraction slice 4: the advisory post plan in the first request'
type: 'feature'
created: '2026-11-10'
status: 'done'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The continue decision (AD-46) is made in code but benefits from a few hints the model can give for free on the first request of a multi-slide post: the item count the post claims, the role of each slide, items per list slide, the date span, and whether more items likely continue.

**Approach:** Slice 4 of `_bmad-output/specs/spec-cursor-extraction/build-slices.md`: add five optional, flat root fields to the Gemini response schema, the consumer AJV schema and the payload type, ask for them once in the prompt, and log them as one `[post-plan]` line. The model's plan never decides anything (AD-46 Rule 3) and nothing is persisted; the first request keeps today's read window.

## Boundaries & Constraints

**Always:** Fields optional and flat (a bigger item schema once made Gemini reject whole requests with a 400); verified live before shipping; the AJV schema mirrors the model schema (it has `additionalProperties: false`); `slideRoles` values come from the closed set `POST_PLAN_SLIDE_ROLES`.

**Ask First:** Making any plan field required, or nesting them.

**Never:** Using the plan to make a decision in this slice, persisting it, changing the read window, or any cursor or step code.

## Tasks & Acceptance

- [x] Schema, prompt, AJV schema, payload type, `[post-plan]` log line, tests.
- [x] Live check on the 21-post sample with the production prompt and the .env key.

**Acceptance Criteria:**
- Given a real Gemini call with the new schema, then no 400 occurs and event counts stay within run-to-run noise of the previous prompt.
- Given a response with or without plan fields, then it validates and extracts as before, and a plan, when present, is logged on one line.

## Spec Change Log

## Design Notes

Live result (21 posts, one run each, `gemini-3.5-flash-lite`): no 400; events equal on 16 posts and within noise on the rest; `slideRoles` came back on 17 of 21 (roundups: intro then list slides, as expected); `claimedItemCount`, `itemsPerListSlide`, `dateRangeCovered` and `moreItemsLikely` were never returned (the model omits what it cannot judge), and the one post that states a total ("203 events") has expired images, so `claimedItemCount` could not be tested live. One response of the run (a 3-image post) came back unterminated at about 27,000 characters; 6 reruns of it parsed fine, and the same one-off happened once with the previous prompt, so it is the runaway generation AD-49 handles (the unparseable path), not a plan effect. The decision logic does not depend on these fields: window size comes from the density observed in each step.
