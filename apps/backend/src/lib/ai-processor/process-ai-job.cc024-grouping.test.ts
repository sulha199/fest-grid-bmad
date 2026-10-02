import test from 'node:test';
import * as assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileValidator } from '../../validation/validate.js';
import { extractedEventSchema } from '../../validation/extracted-event.schema.js';
import { type GeminiExtractionPayload, transformGeminiResponseToEventInfo } from '@festgrid/domain';
import { loadBackendEnv } from '../../env.js';

// Story 3.6s (AC5, AC9, Task 9.2) — fast, deterministic, CI-included regression test replaying
// the four committed one-time-captured real Gemini responses (Task 9.1) through AJV validation
// and the per-event transform pipeline. Zero network calls, zero cost, fully deterministic --
// part of the default `pnpm --filter backend test` run. This is the first of the two-tier
// regression-fixture strategy decided with the user (AskUserQuestion) during this story's
// creation; the second tier is the opt-in live test
// (build-gemini-request.live-cc024-regression.test.ts).
//
// resolveAccountAndLocations/resolveScheduleTimezones are intentionally NOT exercised here --
// both are DB-backed seams whose job is schedule location/timezone enrichment, not the per-event
// guards this test cares about (grouping correctness, private-contact discard). The guards this
// story's AC4 actually cares about (timezone-inference flagging, private-contact classification
// 3.6i, performer-leakage 3.6j) are enforced inside transformGeminiResponseToEventInfo itself,
// which is pure and needs no DB -- calling it directly per event (with an empty
// resolvedScheduleLocations map and no scheduleTimezoneResolutions, both handled gracefully per
// transform-gemini-response-to-event-info.test.ts's own "omitted" test cases) is this test's
// deliberate "stub" for those two DB-dependent seams, matching Task 9.2's "no real DB needed"
// requirement.

// This package compiles to CommonJS (no "type": "module" in package.json) -- __dirname is
// ambient there, matching the same defensive convention already used by env.ts/
// poc-ingestion-preview.ts rather than import.meta.dirname (ESM-only).
const fixtureDir = resolve(
  __dirname,
  '../../../../../_bmad-output/implementation-artifacts/cc-024-reference-posts'
);

interface FixtureCase {
  file: string;
  expectedGroupingReason: string;
  // Exact expected count for this captured fixture (not the model's general behavior -- the
  // recorded fixture itself is fixed, so this is an exact-count assertion against whatever was
  // actually captured in Task 9.1, per the story's own Task 9.2 note).
  expectedEventCount: number;
}

// Expected values per _bmad-output/implementation-artifacts/cc-024-reference-posts/README.md.
const FIXTURES: FixtureCase[] = [
  { file: '1-DdV_7Jsk6pw-sleman-city-hall-reborn.gemini-response.json', expectedGroupingReason: 'program-lineup', expectedEventCount: 1 },
  { file: '2-DdT1cgTlJ2k-smi-drum-contest.gemini-response.json', expectedGroupingReason: 'dependent-stages', expectedEventCount: 1 },
  { file: '3-DcntzF0mB7z-laridijogja-roundup.gemini-response.json', expectedGroupingReason: 'roundup', expectedEventCount: 10 },
  { file: '4-Ddi9wU6RCRQ-vifation-2026.gemini-response.json', expectedGroupingReason: 'separate-events', expectedEventCount: 3 },
];

function loadFixture(file: string): GeminiExtractionPayload {
  return JSON.parse(readFileSync(resolve(fixtureDir, file), 'utf-8'));
}

test('CC-024 reference-post regression fixtures (deterministic, Task 9.2)', async (t) => {
  const env = loadBackendEnv();

  for (const fixtureCase of FIXTURES) {
    await t.test(fixtureCase.file, () => {
      const payload = loadFixture(fixtureCase.file);

      // 1. AJV validation must pass -- proves the captured real response still matches this
      // story's restructured schema.
      const validate = compileValidator<GeminiExtractionPayload>(extractedEventSchema);
      const isValid = validate(payload);
      assert.strictEqual(isValid, true, `AJV validation failed for ${fixtureCase.file}: ${JSON.stringify(validate.errors)}`);

      assert.strictEqual(payload.isEvent, true, `${fixtureCase.file} should be isEvent: true`);

      // 2. groupingReason matches README.md's expected value per post.
      assert.strictEqual(
        payload.groupingReason,
        fixtureCase.expectedGroupingReason,
        `${fixtureCase.file}: expected groupingReason "${fixtureCase.expectedGroupingReason}", got "${payload.groupingReason}"`
      );

      // 3. events.length matches the expected count for this captured fixture. Post 3 (roundup)
      // also proves the per-post cap held (<= env.maxExtractedEventsPerPost), independent of the
      // exact captured count, since a future re-capture could legitimately return a different
      // (still-capped) count.
      assert.strictEqual(
        payload.events.length,
        fixtureCase.expectedEventCount,
        `${fixtureCase.file}: expected ${fixtureCase.expectedEventCount} events, got ${payload.events.length}`
      );
      assert.ok(
        payload.events.length <= env.maxExtractedEventsPerPost,
        `${fixtureCase.file}: events.length (${payload.events.length}) must never exceed the configured cap (${env.maxExtractedEventsPerPost})`
      );

      // 4. Per-event transform pipeline (Task 7.3's logic, DB-dependent seams stubbed away --
      // see file header) runs cleanly for every event in the fixture, exercising the same
      // guards (AC4) production would run per event.
      const transformed = payload.events.map((event) =>
        transformGeminiResponseToEventInfo(event, {
          postId: 'cc024-fixture-post',
          sourceSocialMediaAccountId: 'cc024-fixture-account',
          resolvedScheduleLocations: new Map()
        })
      );
      assert.strictEqual(transformed.length, payload.events.length);

      // 5. Post 4's private-contact discard: the two masked phone numbers noted in README.md
      // must never surface in any event's contactInfo (or anywhere else in the transformed
      // output), regardless of what hasPrivateContact the model reported.
      if (fixtureCase.file.startsWith('4-')) {
        for (const event of transformed) {
          if (event.hasPrivateContact) {
            assert.strictEqual(event.contactInfo, undefined, `${fixtureCase.file}: private contactInfo must be discarded`);
          }
          assert.ok(!event.contactInfo?.includes('+62'), `${fixtureCase.file}: no raw phone number should ever surface in contactInfo`);
        }
      }
    });
  }
});
