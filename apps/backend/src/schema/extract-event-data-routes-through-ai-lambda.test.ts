import test from 'node:test';
import * as assert from 'node:assert';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Story 4.2b (replaces Story 3.20's Task 4.3 guard, FIND-068) -- source-scan invariants that keep
// the pre-AI face blur (Story 3.20) covering manual "AI-Assisted Correction" extraction.
//
//  1. resolvers.ts (API Lambda, no image-processing runtime) must never build a Gemini request
//     itself: that would send an unblurred cover image to the AI vendor again.
//  2. The only manual-extraction caller of buildGeminiExtractionRequest is
//     process-manual-extraction-job.ts (AI Lambda), and it must pass the blurFacesBeforeAi option
//     with isOwnerOptedIn: false (no opt-in exception for manual extraction, user decision).
//
// Paths resolve from __dirname so the test works from any working directory.
const RESOLVERS_PATH = resolve(__dirname, 'resolvers.ts');
const MANUAL_JOB_PATH = resolve(__dirname, '../lib/ai-processor/process-manual-extraction-job.ts');

test('resolvers.ts never builds a Gemini request or calls the builder (Story 4.2b, FIND-068)', () => {
  const content = readFileSync(RESOLVERS_PATH, 'utf8');
  assert.ok(!/buildGeminiExtractionRequest/.test(content), 'resolvers.ts must not reference buildGeminiExtractionRequest at all');
  assert.ok(!/build-gemini-request/.test(content), 'resolvers.ts must not import build-gemini-request (it statically pulls in the blur-adjacent runtime)');
});

test('process-manual-extraction-job.ts passes the blur option with no owner opt-in (Story 4.2b, FIND-068)', () => {
  const content = readFileSync(MANUAL_JOB_PATH, 'utf8');
  const calls = content.match(/buildGeminiExtractionRequest\(/g) ?? [];
  assert.strictEqual(calls.length, 1, 'expected exactly one buildGeminiExtractionRequest call in the manual job processor');
  assert.match(content, /blurFacesBeforeAi:\s*\{[\s\S]*?isOwnerOptedIn:\s*false/, 'the manual job must always pass isOwnerOptedIn: false');
});
