---
backlog_id: IDEA-074
title: "Personalized Discovery: extract each event's target audience (area first), order by it not the venue"
captured: 2026-10-18
---

# IDEA-074 — order by who the event is FOR

**Captured:** 2026-10-18 · **Status:** POC done, no product code. Full design and numbers:
`planning-artifacts/event-insight-poc/proposal-personalized-discovery.md` (rev 4) and `poc-report.md` (addenda 1–3).

## The decision (product owner, 2026-10-18)

Sort by the **target audience's area**, never the event's/venue's area. A national competition held on a Yogyakarta campus is not a Yogyakarta event; a Jakarta concert with a bus for Surabaya residents is a Surabaya event. Everything else in the order (merged local ladder, then anywhere, then other-local; sooner within a group) follows from that. So audience extraction is the foundation, and the account/venue location only enters as a **fallback** (BUG-065 for who may use it).

## Effective audience area (first match wins)

stated in the post → (national / international scope stops the fallbacks) → for an **online** event, only the organizer's own area and only when its reach is known to be local/regional → the venue's locality, for a plain local event → the account's location, confirmed organizers whose reach is not national only → none ("for anyone").

**Online is not a tier (decision 2026-10-18).** An online event is weighed by its audience exactly like an onsite one: a local government's Zoom briefing for Sleman residents is local for a Sleman user and *other-local* for a Jakarta user; a national company's webinar has no audience area and is "anywhere" for everyone. How an event is attended does not enter the order (a type-level test pins it). The reach of the organizer comes from IDEA-075.

## Measured (Gemini `gemini-3.5-flash-lite`, 3 runs per post, live; model confidence not used)

| set | prompt | fully correct | geoScope right | venue-derived area on a nationwide event | forbidden-area leak |
|---|---|--:|--:|--:|--:|
| 20 posts the prompt was written around (tuned-on) | v1 | 50/60 | 56/60 | 0 | 0 |
| same | v2 | 57/60 | 60/60 | 0 | 0 |
| 6 posts labelled before v2 existed (held out) | v1 | 12/18 | 15/18 | 0 | 0 |
| same | v2 | 18/18 | 18/18 | 0 | 0 |

Residual: a continent-level audience ("delegates from across Asia") is scoped `international` but its area is not always listed — harmless for ordering (international is "anywhere"). The 6-post holdout is small; do not read 18/18 as a rate. v1's one expensive family (a post naming no place read as `national`, which would block every fallback) is also removed deterministically by `guardAudienceAreas` (`poc-event-insight/audience-areas.ts`); that guard was written after seeing those failures.

## Story outline

1. IDEA-073 — canonical area ladder (prerequisite).
2. BUG-065 / BUG-066 / IDEA-075 — location policy, geocoder correctness, and the profile read that supplies country and reach (prerequisites for the account fallback).
3. Extraction: audience areas + scope (+ `attendance`, BUG-064) on the extraction response, AJV-validated, guards on write, nothing from model confidence.
4. Ordering: one `ORDER BY` expression `(areaTier, soonestMatchingDate, id)` (AD-17/AD-18: no per-row resolver), user area from the saved location.
5. Optional second stage: bounded relevance discount (interests/age tracks) — only after 1–4 are measured.

Related: IDEA-073, BUG-063, BUG-064, BUG-065, BUG-066, IDEA-071, IDEA-075, FIND-086.
