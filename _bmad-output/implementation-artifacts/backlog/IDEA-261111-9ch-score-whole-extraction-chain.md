---
backlog_id: IDEA-261111-9ch
title: "Score a whole extraction chain, not only the first call"
captured: 2026-11-11
---

# IDEA-261111-9ch: Score a whole extraction chain, not only the first call

## Capture

The per-field accuracy eval (IDEA-261111-5cc, slice A) sends each labelled post through one extraction call and scores that
answer. Production does not work that way for every post: a selected multi-slide post is extracted in steps with a cursor
(AD-46), an at-risk answer is split in half and retried (AD-49), and each call has an event cap. So the first-call scope cannot
measure completeness on a long roundup, for example the 203-event post: the eval shows only the first window, or `truncated`.

The idea is a second eval mode that drives the production chain (cursor, windows, split-and-retry, request bound) for a
labelled post and scores the merged event list against the label: event recall and precision across the whole post, per-field
accuracy on the matched events, and the number of requests used.

## Where it lives

Decided with the maintainer on 2026-11-11 during PR review of the slice A scaffold: slice A stays first-call only, this is the
follow-up. Spec: `implementation-artifacts/spec-extraction-accuracy-eval.md`. Chain code: `apps/backend/src/lib/ai-processor/process-extraction-step.ts`,
`extraction-chain.ts`. Needs the labelled roundup posts of slice B, and a way to run the chain without the database (the pipeline
step reads and writes the cursor in Postgres), which is the main design question.
