import test from 'node:test';
import * as assert from 'node:assert';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Story 4.2b (replaces Story 3.20's Task 4.3 guard, FIND-068) -- source-scan invariants that keep
// the pre-AI face blur (Story 3.20) covering manual "AI-Assisted Correction" extraction.
//
//  1. resolvers.ts (API Lambda, no image-processing runtime) must never build a Gemini request
//     itself: that would send an unblurred cover image to the AI vendor again.
//  2. The only manual-extraction caller of buildGeminiExtractionRequest is extract-events-with-gemini.ts
//     (AI Lambda; Story 10.6 moved it there from process-manual-extraction-job.ts so the manual job and the engine's
//     re-extract preview share one call), and it must pass the blurFacesBeforeAi option with isOwnerOptedIn: false
//     (no opt-in exception for manual extraction, user decision). Its two callers must go through it and never build a request.
//
// Paths resolve from __dirname so the test works from any working directory.
const RESOLVERS_PATH = resolve(__dirname, 'resolvers.ts');
const AI_DIR = resolve(__dirname, '../lib/ai-processor');
const MANUAL_JOB_PATH = resolve(AI_DIR, 'extract-events-with-gemini.ts');
const MANUAL_EXTRACTION_CALLERS = ['process-manual-extraction-job.ts', 'generate-reextraction-preview.ts', 'reextract-preview-handler.ts'];

test('resolvers.ts never builds a Gemini request or calls the builder (Story 4.2b, FIND-068)', () => {
  const content = readFileSync(RESOLVERS_PATH, 'utf8');
  assert.ok(!/buildGeminiExtractionRequest/.test(content), 'resolvers.ts must not reference buildGeminiExtractionRequest at all');
  assert.ok(!/build-gemini-request/.test(content), 'resolvers.ts must not import build-gemini-request (it statically pulls in the blur-adjacent runtime)');
});

test('the shared manual extraction call passes the blur option with no owner opt-in (Story 4.2b, FIND-068, Story 10.6)', () => {
  const content = readFileSync(MANUAL_JOB_PATH, 'utf8');
  const calls = content.match(/buildGeminiExtractionRequest\(/g) ?? [];
  assert.strictEqual(calls.length, 1, 'expected exactly one buildGeminiExtractionRequest call in the shared manual extraction module');
  assert.match(content, /blurFacesBeforeAi:\s*\{[\s\S]*?isOwnerOptedIn:\s*false/, 'the manual job must always pass isOwnerOptedIn: false');
});

test('every manual extraction caller goes through the shared module and never builds a Gemini request itself (Story 10.6)', () => {
  for (const file of MANUAL_EXTRACTION_CALLERS) {
    const content = readFileSync(resolve(AI_DIR, file), 'utf8');
    assert.ok(!/buildGeminiExtractionRequest/.test(content), `${file} must not reference buildGeminiExtractionRequest`);
    assert.match(content, /extractEventsWithGemini|generateReextractionPreview/, `${file} must reach Gemini through the shared module`);
  }
});
