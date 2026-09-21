---
title: 'Manual ingestion-preview POC script (scrape -> Gemini extraction, no DB writes)'
type: 'chore'
created: '2026-09-21'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: '6d30827e3ceab9d7f719903639f43d9075af94c9'
route: 'one-shot'
---

# Manual ingestion-preview POC script (scrape -> Gemini extraction, no DB writes)

## Intent

**Problem:** There was no way to manually run and iterate on the real ingestion pipeline's
prompt/data structure (`build-gemini-request.ts`) against a single Instagram post URL without
either standing up the full SQS/Lambda pipeline or burning Apify quota on every single retry.

**Approach:** A standalone terminal script (`apps/backend/scripts/poc-ingestion-preview.ts`,
run via `tsx`, matching the existing `apps/backend/scripts/*.ts` debug-script convention) that
calls the same real functions the production pipeline calls (`getScraperAdapter(...).getPostByUrl`,
`buildGeminiExtractionRequest`, `callGeminiGenerateContent`) directly, caches the scrape result
locally keyed by the post's own Instagram-CDN image expiry so repeated prompt edits don't
re-scrape, and never writes to the database — `--preview-insert` only prints what the real
insert would look like, as a dry run.

## Suggested Review Order

**Entry point**

- `main()` orchestrates the whole flow: parse args -> scrape (cached or live) -> Gemini extract -> validate -> optional dry-run preview.
  [`poc-ingestion-preview.ts:154`](../../apps/backend/scripts/poc-ingestion-preview.ts#L154)

**Local scrape cache (saves Apify quota across prompt iterations)**

- URL is normalized (strip query/hash/trailing slash) before hashing, so tracking params don't silently bypass the cache.
  [`poc-ingestion-preview.ts:125`](../../apps/backend/scripts/poc-ingestion-preview.ts#L125)

- Cache hit/miss is keyed off the post's own parsed Instagram-CDN image expiry, not a fixed TTL — matches AD-12's expiry handling.
  [`poc-ingestion-preview.ts:188`](../../apps/backend/scripts/poc-ingestion-preview.ts#L188)

**Live scrape + Gemini extraction (reuses the real pipeline's own functions)**

- Real scraper adapter call — no reimplementation, so it behaves exactly like the production path.
  [`poc-ingestion-preview.ts:200`](../../apps/backend/scripts/poc-ingestion-preview.ts#L200)

- `buildGeminiExtractionRequest`/`callGeminiGenerateContent` called directly with an explicit key, bypassing BYOK/KMS since this is a single-operator local tool.
  [`poc-ingestion-preview.ts:245`](../../apps/backend/scripts/poc-ingestion-preview.ts#L245)

- AJV validation against the real `extracted-event.schema.ts` is non-fatal (warns only), so an intentionally-changed data structure stays visible instead of aborting.
  [`poc-ingestion-preview.ts:265`](../../apps/backend/scripts/poc-ingestion-preview.ts#L265)

**Dry-run DB-insert preview (`--preview-insert`, never writes)**

- Mirrors `process-ai-job.ts`'s `isEvent === false` short-circuit so the preview can't fabricate an events row the real pipeline would never insert.
  [`poc-ingestion-preview.ts:276`](../../apps/backend/scripts/poc-ingestion-preview.ts#L276)

**Peripherals**

- New local cache directory excluded from version control.
  [`.gitignore:60`](../../.gitignore#L60)
