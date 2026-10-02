# CC-024 reference posts (regression fixtures for Story 3.6s)

Four real Instagram posts used to check multi-event extraction and grouping. Story 3.6s runs each one
repeatedly; the grouping must match the expected value below on **every** run. In the prototype, post 4
once collapsed to a single event under the weaker "headliner" rule, which is why grouping rule A was chosen.

Each file is the `poc-ingestion-preview.ts` cache shape (`scrapedAt`, `imageUrlExpiresAt`, `scrapedPost`).

| # | File | Account | Published | Slides | Expected grouping |
|---|---|---|---|---|---|
| 1 | `1-DdV_7Jsk6pw-sleman-city-hall-reborn.json` | slemancityhall | 2026-09-16 | 0 | One event, several schedules (`program-lineup`) |
| 2 | `2-DdT1cgTlJ2k-smi-drum-contest.json` | infoeventjogja | 2026-09-15 | 2 | One event, dependent stages (`dependent-stages`) |
| 3 | `3-DcntzF0mB7z-laridijogja-roundup.json` | laridijogja (+5 coauthors) | 2026-08-29 | 5 | Several events (`roundup`); the slides produced 39 events in the model run, so the roundup cap applies |
| 4 | `4-Ddi9wU6RCRQ-vifation-2026.json` | infoeventjogja | 2026-09-21 | 0 | Three events: Billiard, PES, Futsal (`separate-events`) |

## Provenance

- Re-scraped live 2026-10-02 with `apps/backend/scripts/poc-ingestion-preview.ts --force` after the BUG-053 fix
  (by-URL actor input `{ username: [postUrl], dataDetailLevel: 'detailedData' }`). Captions are identical to the
  user's 2026-10-01 cache; the re-scrape adds `ownerId` and `coauthors` (Story 3.13).
- `basicData` was tried first and dropped the carousel slides and `locationName` — that is why the adapter uses
  `detailedData`.
- **Image URLs are signed CDN links and expire** (`imageUrlExpiresAt`, about 2026-10-06). Captions, owner and
  coauthor fields stay valid. Tests that need the images must re-scrape (`--force`) or use stored copies.
- Post 4's two contact-person phone numbers are masked (`+62 XXX-XXXX-XXXX`); grouping does not depend on them.
