# Vendor role mapping — post publisher vs. coauthor vs. scraping source

Evidence for CAP-1 (vendor role normalization). Every claim below cites a real payload
already captured in this repo — no field name here is inferred from producer array order
or documentation; each is read directly off an actual scrape result.

## Role model

Every post has up to three distinct identity axes, which must never be conflated:

| Role | Meaning |
|---|---|
| **Scraping/subscription source** | The account whose subscription/scrape job triggered this fetch. Today this is the *only* identity captured (`posts.accountId`). |
| **Canonical publisher** | The account that actually posted the content. Usually equals the scraping source, but not always (a repost/collaboration can surface someone else's post under the scraped account's feed, or vice versa). |
| **Coauthor(s)** | Additional accounts the platform itself records as co-producers of the post (Instagram's native "Collab" feature), distinct from people merely *tagged in* the post. |

Association roles for the new post-account table (CAP-3): `PUBLISHER`, `COAUTHOR`,
`SCRAPING_SOURCE`, `PUBLISHER_UNKNOWN` (legacy-migration marker).

## Apify — `apify/instagram-post-scraper` (the actor actually wired into production)

This is `GET_POST_BY_URL_ACTOR` / `GET_NEWEST_POSTS_ACTOR` in
`apps/backend/src/lib/scraper/instagram-adapter.ts` (lines 122–124) — not a candidate,
the live actor. Evidence: two real captured runs against this exact actor,
`_bmad-output/implementation-artifacts/3-4d-task1c-runs/run-04-apify-instagram-post-scraper-scenario-a.md`
and `run-06-apify-instagram-post-scraper-scenario-c.md`.

Canonical publisher fields (already partially consumed — see "Current code state" below):

```json
{
  "ownerId": "2237970730",
  "ownerUsername": "pakuwonmall.jogja",
  "ownerFullName": "Pakuwon Mall Jogja"
}
```

Coauthor fields — a sibling array on the same post item, **never** consumed today:

```json
{
  "coauthorProducers": [
    {
      "id": "2237970730",
      "username": "pakuwonmall.jogja",
      "is_verified": true,
      "profile_pic_url": "https://..."
    }
  ]
}
```

Confirmed from real data:
- `coauthorProducers[]` entries carry a stable `id` (the same kind of value as `ownerId`)
  and `username`, but **no full-name/display-name field** — unlike `taggedUsers[]`
  (a different, unrelated concept: people/brands tagged *in* the post, which does carry
  `full_name`). See Assumption on displayName fallback.
- Multiple posts in `run-06` show different coauthor accounts across different posts from
  the same scraped account (`kopisikaya`, `andinni____`, `huttamydewy` all appear as
  `coauthorProducers` on separate posts), confirming this is real, per-post, per-account
  variable data — not a static or malformed field.
- `taggedUsers[]` must **not** be treated as a coauthor source; it is a materially
  different relationship (mentioned/tagged, not co-produced).

### Current code state (what's already there vs. the gap)

`apps/backend/src/lib/scraper/instagram-adapter.ts`'s `mapApifyItemToScrapedPost` already
reads `item.ownerFullName`/`item.ownerUsername` into `ScrapedPost.ownerDisplayName`/
`ownerUsername`, and `packages/database/schema.ts`'s `posts` table already has
`ownerDisplayName`/`ownerUsername` TEXT columns (not FKs, not linked to any profile row,
not used for filtering). `coauthorProducers` is read **nowhere** in the codebase today —
confirmed by direct grep of `apps/backend/src` and `packages/domain`. This is the concrete
gap CAP-1/CAP-2/CAP-3 close.

## Bright Data

Evidence: `backlog/FIND-022-coauthor-content-issues.md`'s own note, citing a fixture at
`D:\Downloads\sd_mtnt676r2fb2ouphzs.success.json` that **no longer exists on disk** (checked
during this spec run — file not found). The two Bright Data fixtures that *are* still
checked into the repo
(`_bmad-output/implementation-artifacts/backlog/brightdata-run-examples/*.json`) do not
contain a coauthor example.

What's known (paraphrased from the backlog note, not independently re-verified):
- `user_posted` (username) / `user_posted_id` — canonical publisher, confirmed present in
  the checked-in fixtures for the (non-coauthored) posts they contain.
- `coauthor_producers` — referenced only in the unrecoverable fixture; exact field names
  and whether a full-name-equivalent is present are **not verified**. Do not assume it
  mirrors Apify's shape.

This gap is tracked as an open question in `.memlog.md` — implementation of the Bright
Data side should capture a fresh real coauthored-post payload before writing adapter code,
rather than proceeding on the paraphrase alone.
