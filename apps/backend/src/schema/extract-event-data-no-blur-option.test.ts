import test from 'node:test';
import * as assert from 'node:assert';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Story 3.20 (Task 4.3, FIND-068) -- a source-scan guard confirming resolvers.ts's two
// `extractEventDataFromUrl` call sites still call `buildGeminiExtractionRequest(message)` with
// NO second argument. Manual extraction (Story 4.2a) runs inside the API Lambda, which has no
// image-processing runtime for the pre-AI blur -- threading the `blurFacesBeforeAi` option
// through here is explicitly deferred to Story 4.2b (the readiness-sweep's Finding 1/FIND-068,
// resolved by the user's own `AskUserQuestion` choice during this story's creation). This test is
// a point-in-time invariant for resolvers.ts specifically -- unlike
// `apps/backend/scripts/poc-ingestion-preview.ts` (also read, not touched, by Task 4, but which
// Task 9 of THIS SAME STORY deliberately gives a new `--blur-before-ai` flag/second argument), so
// poc-ingestion-preview.ts is intentionally NOT covered by this permanent guard.
const RESOLVERS_PATH = resolve(process.cwd(), 'src/schema/resolvers.ts');

test('resolvers.ts: both extractEventDataFromUrl call sites invoke buildGeminiExtractionRequest with a single argument (FIND-068, deferred to Story 4.2b)', () => {
  const content = readFileSync(RESOLVERS_PATH, 'utf8');

  // Matches the single-argument call shape used at both of resolvers.ts's call sites:
  // `buildGeminiExtractionRequest(message)` or `buildGeminiExtractionRequest(<identifier>)` --
  // NOT `buildGeminiExtractionRequest(message, { ... })` or any other second argument.
  const singleArgCallPattern = /buildGeminiExtractionRequest\(\s*[A-Za-z_$][\w$]*\s*\)/g;
  const anyCallPattern = /buildGeminiExtractionRequest\(/g;

  const anyCalls = content.match(anyCallPattern) ?? [];
  const singleArgCalls = content.match(singleArgCallPattern) ?? [];

  assert.strictEqual(anyCalls.length, 2, `expected exactly 2 buildGeminiExtractionRequest call sites in resolvers.ts, found ${anyCalls.length}`);
  assert.strictEqual(
    singleArgCalls.length,
    anyCalls.length,
    'expected every buildGeminiExtractionRequest call site in resolvers.ts to pass a single argument (no blurFacesBeforeAi option) -- ' +
      'threading it through here is Story 4.2b scope, not this story'
  );
});
