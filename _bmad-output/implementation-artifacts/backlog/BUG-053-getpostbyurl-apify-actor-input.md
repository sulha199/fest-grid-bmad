# BUG-053 — `getPostByUrl` fails against the live `apify/instagram-post-scraper` actor

## Found

2026-10-01, running `poc-ingestion-preview.ts` against the live actor. Also hits the
GraphQL resolver's by-URL path (manual post-extraction mutation, `resolvers.ts:1522`),
since both call the same `instagramScraperAdapter.getPostByUrl()`.

Live error: `Input is not valid: Field input.username is required`.

## Root cause

`GetPostByUrlActorInput` in `apps/backend/src/lib/scraper/instagram-adapter.ts` was still
using the `apify/instagram-api-scraper` input shape (`directUrls`/`resultsType`/`resultsLimit`)
even though `GET_POST_BY_URL_ACTOR` points at `apify/instagram-post-scraper` — a different
actor with a different input contract. This was carried over when Story 3.4d switched the
sync path to `apify/instagram-post-scraper` but only updated `GetNewestPostsActorInput`,
not the by-URL input type.

## Fix (2026-10-02, bmad-quick-dev)

Changed `GetPostByUrlActorInput` to:

```ts
interface GetPostByUrlActorInput {
  username: string[];
  dataDetailLevel: 'basicData';
}
```

and `getPostByUrl()` now builds `{ username: [url], dataDetailLevel: 'basicData' }`
(no `resultsLimit`/`onlyPostsNewerThan` — the actor's own docs say these don't apply in
post-URL mode).

This is not a guess/workaround — it's confirmed empirically by Story 3.4d's own Task 1b
live-run evidence:
- `3-4d-task1b-runs/run-03-apify-instagram-post-scraper-getpostbyurl-valid.md` (input
  `{"username": ["https://www.instagram.com/p/Db9-oj1EaiF/"], "dataDetailLevel": "basicData"}`,
  returns the post)
- `3-4d-task1b-runs/run-04-...-getpostbyurl-invalid.md` (same shape, not-found post)

Fixing `instagram-adapter.ts` fixes both call sites named in this bug: `poc-ingestion-preview.ts`
calls `getScraperAdapter(platform).getPostByUrl(url)` directly, and the resolver's by-URL
path (`resolvers.ts:1522`) calls the same adapter method — neither builds its own actor input.

## Verification

- New regression test: `instagram-adapter.test.ts` — "getPostByUrl builds the actor input as
  username+dataDetailLevel, not directUrls (BUG-053 regression guard)". Full file: 33/33 pass.
- `tsc --noEmit` clean.
- **Not verified live** — `APIFY_API_TOKEN` is not set in this environment. A live re-scrape
  of the 4 CC-024 reference posts (needed for Story 3.6s fixtures) is still owed on a machine
  with the token configured, via `poc-ingestion-preview.ts --url <post-url>`.

## Related, out of scope

`LookupAccountProfileActorInput` (same file) still uses the old `directUrls`/`resultsType:
'details'` shape against the same `apify/instagram-post-scraper` actor and looks like the
same bug class — but it wasn't named in this bug report (no failing resolver path cited), and
Story 3.4d's own Task 1b evidence for that use case (`run-07`/`run-08`) suggests its real
input shape AND output mapping (the actor returns a post-shaped item with `ownerFullName`,
not a profile with `fullName`/`biography`) would need separate, deliberate verification. Left
untouched here to keep this fix single-goal; worth a new backlog row if confirmed.
