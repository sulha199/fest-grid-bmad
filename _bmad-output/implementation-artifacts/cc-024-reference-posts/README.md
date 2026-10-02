# CC-024 reference posts (regression fixtures for Story 3.6s)

Four real Instagram posts used to check multi-event extraction and grouping. Story 3.6s runs each one
repeatedly; the grouping must match the expected value below on **every** run. In the prototype, post 4
once collapsed to a single event under the weaker "headliner" rule, which is why grouping rule A was chosen.

Each `<n>-<shortcode>.json` file is the `poc-ingestion-preview.ts` cache shape (`scrapedAt`, `imageUrlExpiresAt`,
`scrapedPost`) — the raw scrape, used by the opt-in live test (Task 9.3). Each
`<n>-<shortcode>.gemini-response.json` file (added by Story 3.6s, Task 9.1) is the raw, one-time-captured real
Gemini extraction response for that post (post-restructure `{ isEvent, events[], groupingReason, ... }` shape) —
used by the fast, deterministic CI test (Task 9.2), which replays it through AJV validation and the per-event
transform pipeline with zero network calls. Captured by running
`poc-ingestion-preview.ts --fixture <path> --preview-insert` against each `.json` scrape file and saving the
resulting parsed payload.

| # | File | Account | Published | Slides | Expected grouping |
|---|---|---|---|---|---|
| 1 | `1-DdV_7Jsk6pw-sleman-city-hall-reborn.json` | slemancityhall | 2026-09-16 | 0 | One event, several schedules (`program-lineup`) |
| 2 | `2-DdT1cgTlJ2k-smi-drum-contest.json` | infoeventjogja | 2026-09-15 | 2 | One event, dependent stages (`dependent-stages`) |
| 3 | `3-DcntzF0mB7z-laridijogja-roundup.json` | laridijogja (+5 coauthors) | 2026-08-29 | 5 | Several events (`roundup`); the slides produced up to 39 events in the model run, so the roundup cap applies |
| 4 | `4-Ddi9wU6RCRQ-vifation-2026.json` | infoeventjogja | 2026-09-21 | 0 | Three events: Billiard, PES, Futsal (`separate-events`) |

## Fixtures stable across runs (Story 3.6s, Task 9.1)

During this story's implementation, the extraction prompt initially misclassified two of the four posts on the
first real run: post 1 came back `single-event` instead of `program-lineup` (the prompt didn't clearly
distinguish "one event, many schedules under an umbrella" from the generic single-schedule fallback), and post 4
collapsed to one event instead of 3 `separate-events` — reproducing the exact "Vifation collapse" risk this
regression-fixture design exists to catch. Both were fixed by sharpening the grouping-decision prompt text (see
`apps/backend/src/lib/ai-processor/build-gemini-request.ts`'s Dev Notes/comments), after which all four posts
matched the table above consistently across multiple consecutive live runs, and the committed
`*.gemini-response.json` fixtures below reflect the corrected prompt's output.

## Provenance

- Re-scraped live 2026-10-02 with `apps/backend/scripts/poc-ingestion-preview.ts --force` after the BUG-053 fix
  (by-URL actor input `{ username: [postUrl], dataDetailLevel: 'detailedData' }`). Captions are identical to the
  user's 2026-10-01 cache; the re-scrape adds `ownerId` and `coauthors` (Story 3.13).
- `basicData` was tried first and dropped the carousel slides and `locationName` — that is why the adapter uses
  `detailedData`.
- **Image URLs are signed CDN links and expire** (`imageUrlExpiresAt`, about 2026-10-06). Captions, owner and
  coauthor fields stay valid. Tests that need the images must re-scrape (`--force`) or use stored copies.
- Post 4's two contact-person phone numbers are masked (`+62 XXX-XXXX-XXXX`); grouping does not depend on them.
- The `*.gemini-response.json` fixtures (Task 9.1) are a point-in-time capture of the model's output and are
  **not** affected by the `*.json` scrape files' image-URL expiry — they back the deterministic test (Task 9.2),
  which never re-fetches images. Only the opt-in live test (Task 9.3, `build-gemini-request.live-cc024-regression.test.ts`)
  depends on the scrape files' images still being fetchable; if run after the URLs expire, re-scrape the original
  post URL fresh with `poc-ingestion-preview.ts --url <original-post-url> --force` (BUG-053's `--force` re-scrape
  path, confirmed working as of this story), then overwrite the matching `*.json` fixture file with the new
  `.poc-cache/` entry before re-running the live test.
