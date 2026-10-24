import test from 'node:test';
import * as assert from 'node:assert';
import { randomUUID } from 'node:crypto';
import { buildGeminiExtractionRequest } from './build-gemini-request.js';
import { callGeminiGenerateContent } from '../ai-gateway/gemini-client.js';
import { type ProcessingJobMessage } from '@festgrid/domain/posts';
import { EVENT_CATEGORY_GOLDEN_CORPUS } from './event-category-golden-corpus.fixtures.js';

// Story 0.52 (AD-44 Rule 10, AC7) -- OPT-IN live regression test against the real Gemini API,
// gated exactly like the existing build-gemini-request.live-cc024-regression.test.ts precedent
// (RUN_LIVE_GEMINI_TESTS=true + a real SYSTEM_GEMINI_API_KEY, t.skip(...) otherwise). Excluded
// from CI and from default `pnpm --filter backend test` -- AD-44 Rule 10 states this corpus runs
// as "a manual or nightly step... never a CI gate" (non-deterministic LLM output, real quota).
//
// Run manually with:
//   RUN_LIVE_GEMINI_TESTS=true SYSTEM_GEMINI_API_KEY=<key> pnpm --filter backend test
//
// Story 0.54 re-derived the fixtures for the full 23-value taxonomy, including the amended
// cardinality rule (safety cap 6, non-exclusive OTHER) and three rewritten boundary rules (see
// event-category-golden-corpus.fixtures.ts's header and
// 0-54-amend-event-category-cardinality-and-add-science-and-engineering.md's Dev Notes --
// resolves backlog finding FIND-098). As of that re-derivation, fixture #11 (wedding-expo) is
// still the one flagged "CONFIRM ON NEXT LIVE RUN": the live run that triggered this amendment
// returned the three named subject categories but not OTHER, while this fixture still expects
// OTHER for the uncovered venue subject per AD-44's own worked example -- if the next live run
// disagrees with this story's derived expected/mustNotInclude for exactly that one, the fixture
// should be adjusted (not the prompt) -- any other mismatch should be investigated as a real
// prompt/boundary-text defect first.

test('EventCategory golden corpus (opt-in live Gemini eval, Story 0.52/0.53/0.54 AC7/AC12/AC15)', async (t) => {
  if (process.env.RUN_LIVE_GEMINI_TESTS !== 'true' || !process.env.SYSTEM_GEMINI_API_KEY) {
    t.skip('RUN_LIVE_GEMINI_TESTS/SYSTEM_GEMINI_API_KEY not set — live Gemini golden-corpus eval opted out');
    return;
  }

  const apiKey = process.env.SYSTEM_GEMINI_API_KEY;

  for (const fixture of EVENT_CATEGORY_GOLDEN_CORPUS) {
    await t.test(fixture.id, async () => {
      const message: ProcessingJobMessage = {
        postId: randomUUID(),
        accountId: 'golden-corpus-live-account',
        content: fixture.caption,
        postUrl: `https://test.com/golden-corpus/${fixture.id}`,
        publishedAt: new Date().toISOString()
      };

      const { request } = await buildGeminiExtractionRequest(message);

      const result = await callGeminiGenerateContent(apiKey, request);
      const payload: any = JSON.parse(result.text);

      const events: any[] = Array.isArray(payload.events) ? payload.events : [];
      assert.ok(events.length >= 1, `Expected at least one extracted event for fixture ${fixture.id}, got isEvent=${payload.isEvent}`);

      // Union of categories across every extracted event -- the fixture's expectations describe
      // the post's overall subject, not any single sub-event's.
      const actualCategories = new Set<string>();
      for (const event of events) {
        for (const category of event.categories ?? []) {
          actualCategories.add(category);
        }
      }

      for (const expected of fixture.expected) {
        assert.ok(
          actualCategories.has(expected),
          `Fixture ${fixture.id}: expected category ${expected} to be present, got [${[...actualCategories].join(', ')}]. Rationale: ${fixture.rationale}`
        );
      }

      for (const forbidden of fixture.mustNotInclude) {
        assert.ok(
          !actualCategories.has(forbidden),
          `Fixture ${fixture.id}: expected category ${forbidden} to be ABSENT, got [${[...actualCategories].join(', ')}]. Rationale: ${fixture.rationale}`
        );
      }
    });
  }
});
