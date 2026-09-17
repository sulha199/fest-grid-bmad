---
backlog_id: BUG-032
title: "Hashtags not persisted into the posts table (investigate & fix)"
captured: 2026-09-15
investigated: 2026-09-17
---

# BUG-032 — Hashtags not persisted into the posts table

## Capture

User report via `bmad-help` (2026-09-15). Scraped posts' hashtags are not being
persisted into the `posts` table. Task: investigate the root cause and fix it.

## Investigation Results (2026-09-17)

### Conclusion: BRIGHT DATA PATH ONLY

**BUG-032 is a duplicate/confirmation of FIND-024's already-diagnosed Bright Data gap.**
The Apify path works correctly end-to-end. The Bright Data path has a two-layer
gap that prevents ANY hashtags (and other metadata) from reaching the database.

### Apify Path (WORKING CORRECTLY ✓)

**Evidence:**
1. `apps/backend/src/lib/scraper/instagram-adapter.ts:256-258` —
   `mapApifyItemToScrapedPost` extracts hashtags with lowercase normalization:
   ```typescript
   ...(Array.isArray(item.hashtags) && item.hashtags.length > 0 && {
     hashtags: item.hashtags.map((tag: string) => tag.toLowerCase()),
   }),
   ```

2. `apps/backend/src/lib/scraper/process-scrape-job.ts:36` —
   Call to `persistScrapedPost` forwards hashtags:
   ```typescript
   hashtags: post.hashtags || null,
   ```

3. `apps/backend/src/lib/posts/persist-scraped-post.ts:19,36,92` —
   Function accepts and persists hashtags:
   - Parameter (line 19): `hashtags?: string[] | null;`
   - Function arg (line 36): `hashtags,`
   - Insert (line 92): `hashtags,` in insertValues object

4. `packages/database/schema.ts:293,310` —
   Posts table has hashtags column (text array) and GIN index for search:
   ```typescript
   hashtags: text('hashtags').array(),
   hashtagsIdx: index('post_hashtags_idx').on(t.hashtags).using(sql`gin`),
   ```

**Result:** Hashtags from Apify reach the database correctly.

### Bright Data Path (BROKEN ✗)

**Layer 1 Gap: Mapper never extracts hashtags or related metadata**

`apps/backend/src/lib/scraper/brightdata-record-mapper.ts:63-72`:
`mapBrightDataRecordToScrapedPost` builds candidate object with ONLY:
- content
- postUrl
- publishedAt
- imageUrl (if present)
- videoUrl (if present)
- originalPostUrl

**Missing:** hashtags, locationName, ownerDisplayName, ownerUsername.

The comment at line 22-24 confirms field mapping was "confirmed against Bright
Data's Instagram Posts dataset schema," but only documents description/photos/videos.
**Unresolved:** Whether Bright Data's dataset actually includes hashtag data in
their schema (needs checking their public dataset docs, unconfirmed in code).

**Layer 2 Gap: Call site doesn't forward hashtags even if extracted**

`apps/backend/src/lib/scraper/process-brightdata-result.ts:20-33`:
Call to `persistScrapedPost` is MISSING the `hashtags` parameter:
```typescript
await persistScrapedPost({
  accountId: pendingJob.profileId,
  platform: 'instagram',
  postUrl: candidate.postUrl,
  imageUrl: candidate.imageUrl || null,
  videoUrl: candidate.videoUrl || null,
  originalPostUrl: candidate.originalPostUrl || null,
  content: candidate.content,
  publishedAt: candidate.publishedAt,
  scraperActorRunId,
  locationName: candidate.locationName || null,           // ← passes undefined as null
  ownerDisplayName: candidate.ownerDisplayName || null,  // ← passes undefined as null
  ownerUsername: candidate.ownerUsername || null,        // ← passes undefined as null
  // ↓ MISSING: hashtags parameter
});
```

The locationName/ownerDisplayName/ownerUsername fields are passed but undefined
(since the mapper never extracted them either), so they resolve to null.

## Related sibling: FIND-024

`FIND-024` (2026-09-12) documented this exact same Bright Data gap as part of a
Story 3.3e creation trace. This investigation confirms FIND-024's finding remains
accurate and complete.

## Fix Scope & Recommended Approach

**Phase 1: Mapper extraction** (Bright Data schema research + extraction logic)
- Research Bright Data's Instagram Posts dataset schema to confirm whether
  `hashtags`, `locationName`, `ownerDisplayName`, `ownerUsername` fields exist
- Extract all four fields in `mapBrightDataRecordToScrapedPost` if available
- Mirror Apify's hashtag lowercasing normalization
- Validation schema already accepts all fields (identical to Apify's ScrapedPost)

**Phase 2: Call site** (one-line fix once phase 1 done)
- Add `hashtags: candidate.hashtags || null,` to `process-brightdata-result.ts`'s
  persistScrapedPost call (mirrors line 36 in process-scrape-job.ts exactly)

**Phase 3: Regression test**
- Add a Bright Data mapper unit test that verifies hashtags are extracted and
  lowercased when present (similar to any existing Apify mapper tests)
- Verify persistScrapedPost call includes hashtags parameter

## Fix expectation

Once schema research confirms Bright Data's data availability, land the
persistence fix plus a regression test so hashtag search / hashtag display
(IDEA-030 item 3 → IDEA-037) has data to render.

## Fix Applied (2026-09-17)

Phase 1's schema question resolved by user-supplied evidence — a real Bright
Data record from a live scrape (`instagram.com/reel/DdS4MJ50EBV/`) confirming
`hashtags` **is** present in the raw payload, but **with a leading `#`**
(e.g. `"#frcc2026"`) — unlike Apify's already-bare tags.

- `brightdata-record-mapper.ts`: extracts `hashtags`, strips the leading `#`,
  lowercases (mirrors Apify's lowercasing but adds the `#`-strip Apify never
  needed — necessary so both scrape paths store the identical bare-tag
  convention `buildEventsQueryCondition.ts`'s keyword-search handler already
  assumes: it strips a user-typed leading `#` before matching).
- `process-brightdata-result.ts`: now forwards `hashtags` to
  `persistScrapedPost`.
- Regression tests added: `brightdata-record-mapper.test.ts` (extraction +
  `#`-strip + lowercase; an omitted-when-absent case) and
  `process-brightdata-result.test.ts` (end-to-end persistence using the real
  user-supplied record). Verified: lint/build green (backend filter), both
  touched test files 14/14 passing.

**Intentionally NOT touched**: `locationName`/`ownerDisplayName`/
`ownerUsername` (this row's other flagged Bright Data gaps) — no
user-supplied evidence yet confirms Bright Data's schema includes those
fields either. Scope stayed to what this row's own evidence confirmed
(hashtags only); those three remain open under `FIND-024`.
