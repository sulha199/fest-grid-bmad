---
backlog_id: BUG-040
title: "EventCardDateBox's day slot overflows/clips on word or time content (Today/Tomorrow/Yesterday/a time string) instead of a numeric day — confirmed to overflow the entire 175px mobile masonry card by ~107px for \"Tomorrow\""
captured: 2026-09-22
---

# BUG-040: EventCardDateBox's day slot overflows/clips on word or time content (Today/Tomorrow/Yesterday/a time string) instead of a numeric day — confirmed to overflow the entire 175px mobile masonry card by ~107px for "Tomorrow"

## Board note (moved verbatim from backlog.yaml, 2026-11-02)

Story 1.i1n's fix (dayVariant='word' sizing) is superseded, not extended, by BUG-047 — the 2026-09-26 consolidation reverses course and removes word content from the date-box entirely (numeric-only, AC-DATE-1), making 1.i1n's word-safe sizing mechanism dead code once BUG-047 lands. 1.i1n itself stays `done` as a historical record of a real fix for its own narrower scope at the time.
