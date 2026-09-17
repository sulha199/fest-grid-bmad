# Bright Data run examples

Real Bright Data Instagram scrape output, user-supplied 2026-09-17, used as evidence for
`BUG-032`/`FIND-024` (hashtag persistence fix — see
`../BUG-032-hashtags-not-persisted-into-post-table.md`). Each file is a full run's raw JSON
array of post records, as returned by Bright Data before any of this project's own mapping
(`brightdata-record-mapper.ts`) runs on it.

## `run-slemancityhall-with-hashtags-and-location.json`

Account `slemancityhall`, image posts. Notable fields present on these records that the
current mapper does **not** yet extract:

- `hashtags: string[]` — **with a leading `#`** (e.g. `"#SlemanCityHall"`), confirming the
  fix already shipped (strips `#`, lowercases).
- `location: string[]` and `location_details: { pk, name, lat, lng, profile_pic_url,
  __typename }` — `location_details.name` (e.g. `"Sleman City Hall"`) plus real `lat`/`lng`
  directly evidence FIND-024's still-open `locationName` gap; not wired up yet.
- `user_posted` (account username) — potential `ownerUsername` source; not wired up yet.
- No field observed yet that maps cleanly to `ownerDisplayName` (the account's own display
  name, distinct from username) — `tagged_users[].full_name` is a different concept
  (people/brands tagged *in* the post, not the poster).

## `run-jogjacoffeeweek-reels-no-toplevel-hashtags.json`

Account `diamondprofessionalid` (via `jogjacoffeeweek.id` co-author), video/Reel posts.
Useful as a contrasting fixture: no top-level `hashtags` key on these records at all (absent,
not empty array) — confirms the mapper's existing `Array.isArray(...) && ... .length > 0`
guard already handles that shape correctly. Also has `location_details: { profile_pic_url:
null }` only — no `name`/`lat`/`lng` — showing `location_details` isn't always fully populated
even when present, another shape the eventual `locationName` fix needs to tolerate.

## Status

`hashtags` extraction is fixed and shipped (see the BUG-032 doc). `locationName`/
`ownerUsername` now have real confirming evidence in these files but are **not yet
implemented** — `ownerDisplayName` still has no confirmed source field. Not fixed here;
flagged for whoever picks this up next.
