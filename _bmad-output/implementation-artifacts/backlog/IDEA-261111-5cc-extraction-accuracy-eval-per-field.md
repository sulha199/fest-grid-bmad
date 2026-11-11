---
backlog_id: IDEA-261111-5cc
title: "Per-field accuracy eval of event extraction against labelled posts"
captured: 2026-11-11
---

# IDEA-261111-5cc: Per-field accuracy eval of event extraction against labelled posts

## Capture

Nothing scores event extraction itself, field by field, against labelled data. The existing golden corpora cover only the event
categories (`event-category-golden-corpus.*`, manual, caption-only) and the AI-filter prompts (nightly workflow). Prompt changes
are therefore judged by one-off scripts on a handful of posts. The location-keywords work (2026-11-11) showed the cost: a prompt
rule folded a same-day 7-branch tournament post into one event with the location "Indonesia" in 6 of 6 live runs, and it was
found only because a fresh multi-place post happened to be picked and run repeatedly.

The idea is a labelled set of real posts (frozen images, hand-verified expected fields), scored per field (grouping, event count,
name, dates, times, location, price, categories) over repeated runs, compared with a stored baseline and a noise band, run on
extraction-affecting PRs (non-blocking), weekly for model drift, and before a model switch.

## Where it lives

Spec: `implementation-artifacts/spec-extraction-accuracy-eval.md` (draft, two slices). Precedent: AD-44 Rule 10, Story 9.7 and
`IDEA-072` (AI-filter golden prompts).
