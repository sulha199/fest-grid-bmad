# Blind Hunter Review Prompt — scrape-limit & image-serving test fix

Invoke the `bmad-review-adversarial-general` skill on the changed files below, in a fresh session with no prior conversation context.

## Changed files
- `apps/backend/src/schema/resolvers.test.ts` — "Event image serving and consent gates (Story 3.6h)" test now derives `expiredDate`/`futureDate` as relative deltas from `Date.now()` instead of hardcoded absolute dates.
- `.env` (local, gitignored) — `SCRAPE_RESULTS_LIMIT` changed from `"10"` to `"30"` to match `.env.example` (30) and the `instagram-adapter.test.ts` `getNewestPosts` expectation.
- `_bmad-output/implementation-artifacts/spec-fix-scrape-limit-and-image-serving-test-dates.md` — one-shot spec documenting the fix.

## Context / acceptance
- Both previously failing backend tests now pass (`pnpm --filter backend test` → 673 pass, 0 fail).
- The image-consent Case 3 test relies on `futureDate` being in the future and `expiredDate` in the past relative to suite execution time; the resolver `resolveServedImageUrl` compares `imageUrlExpiresAt` against real current time.
- The `.env` change is a gitignored local file; the durable/canonical value (30) is already documented in `.env.example` and is the code default in `env.ts`.
