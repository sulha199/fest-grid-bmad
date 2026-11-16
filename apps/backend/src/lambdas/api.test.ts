import test from 'node:test';
import assert from 'node:assert';
import { isAdapterRegistered } from '@festgrid/domain';

// BUG-100 (2026-10-31 prod incident): the API Lambda's entry (api.ts) only imported
// `buildServer`. The scraper adapters are registered by lib/scraper/register-adapters.ts, which
// only local dev (src/index.ts) and the scraper Lambda (lambdas/scraper.ts) imported -- so a
// moderator re-extract rescrape (and the same registry's extract-by-URL resolver and
// lookupAccountProfile) threw `No scraper adapter registered for platform "instagram"` whenever
// it actually ran in the API Lambda. PR #133's tests register adapters themselves and local dev
// imports them directly, which is why nothing caught this before.
//
// This test deliberately imports ONLY the Lambda's own entry module -- never
// register-adapters.js directly -- so it exercises the exact module graph AWS loads on cold
// start. It must fail on the pre-fix code and pass once api.ts's dependency graph (directly or,
// preferably, via server.ts's shared buildServer path) registers the adapters.
test('API Lambda entry (lambdas/api.ts) registers scraper adapters on module load', async () => {
  await import('./api.js');

  for (const platform of ['instagram', 'twitter']) {
    assert.ok(
      isAdapterRegistered(platform),
      `expected importing lambdas/api.ts to register a scraper adapter for "${platform}", but none was found`
    );
  }
});
