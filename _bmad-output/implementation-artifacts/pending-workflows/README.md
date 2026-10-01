# Pending GitHub workflows (need a human push)

`backfill-post-media-keys.yml` belongs at `.github/workflows/backfill-post-media-keys.yml`
(Story 3.6q, Task 6). It is parked here because the automation token used by the
Claude Code session cannot push files under `.github/workflows/` (GitHub rejects it
without the `workflow` scope). To activate it, copy it to `.github/workflows/` with
credentials that have workflow scope, then delete this folder.
