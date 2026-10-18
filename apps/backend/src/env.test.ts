import test from 'node:test';
import * as assert from 'node:assert';
import { loadBackendEnv, parseBooleanDefaultOn } from './env.js';

// Story 3.20 (Task 1.1) -- BLUR_FACES_BEFORE_AI is the first default-ON boolean env var in this
// file (every other boolean here, e.g. DATA_INGESTION_INLINE_FALLBACK_ENABLED, defaults off via
// a plain `=== 'true'` check), so its parser gets its own unit tests.

test('parseBooleanDefaultOn defaults to true when the value is undefined (unset env var)', () => {
  assert.strictEqual(parseBooleanDefaultOn(undefined, 'BLUR_FACES_BEFORE_AI'), true);
});

test('parseBooleanDefaultOn returns true for an explicit "true"', () => {
  assert.strictEqual(parseBooleanDefaultOn('true', 'BLUR_FACES_BEFORE_AI'), true);
});

test('parseBooleanDefaultOn returns false for an explicit "false"', () => {
  assert.strictEqual(parseBooleanDefaultOn('false', 'BLUR_FACES_BEFORE_AI'), false);
});

test('parseBooleanDefaultOn returns false for "0"', () => {
  assert.strictEqual(parseBooleanDefaultOn('0', 'BLUR_FACES_BEFORE_AI'), false);
});

test('parseBooleanDefaultOn is case-insensitive for "false" and "0"', () => {
  assert.strictEqual(parseBooleanDefaultOn('FALSE', 'BLUR_FACES_BEFORE_AI'), false);
  assert.strictEqual(parseBooleanDefaultOn('False', 'BLUR_FACES_BEFORE_AI'), false);
});

test('parseBooleanDefaultOn trims whitespace before comparing', () => {
  assert.strictEqual(parseBooleanDefaultOn('  false  ', 'BLUR_FACES_BEFORE_AI'), false);
  assert.strictEqual(parseBooleanDefaultOn('  0  ', 'BLUR_FACES_BEFORE_AI'), false);
});

test('parseBooleanDefaultOn treats any other value as true (default-on, not a strict allowlist)', () => {
  assert.strictEqual(parseBooleanDefaultOn('nonsense', 'BLUR_FACES_BEFORE_AI'), true);
  assert.strictEqual(parseBooleanDefaultOn('1', 'BLUR_FACES_BEFORE_AI'), true);
  assert.strictEqual(parseBooleanDefaultOn('', 'BLUR_FACES_BEFORE_AI'), true);
});

// GEMINI_FILTER_MODEL is optional (dedicated model for resolvePromptToEventFilter): a deploy that
// never sets it must keep working, so every "no usable value" shape falls back to the default.
function withGeminiFilterModel<T>(value: string | undefined, run: () => T): T {
  const originalModel = process.env.GEMINI_FILTER_MODEL;
  const originalPort = process.env.BACKEND_PORT;
  process.env.BACKEND_PORT ??= '4001';
  if (value === undefined) delete process.env.GEMINI_FILTER_MODEL;
  else process.env.GEMINI_FILTER_MODEL = value;
  try {
    return run();
  } finally {
    if (originalModel === undefined) delete process.env.GEMINI_FILTER_MODEL;
    else process.env.GEMINI_FILTER_MODEL = originalModel;
    if (originalPort === undefined) delete process.env.BACKEND_PORT;
    else process.env.BACKEND_PORT = originalPort;
  }
}

test('loadBackendEnv defaults geminiFilterModel to gemini-3.5-flash when GEMINI_FILTER_MODEL is unset, without throwing', () => {
  assert.strictEqual(withGeminiFilterModel(undefined, () => loadBackendEnv().geminiFilterModel), 'gemini-3.5-flash');
});

test('loadBackendEnv defaults geminiFilterModel when GEMINI_FILTER_MODEL is empty or whitespace-only', () => {
  assert.strictEqual(withGeminiFilterModel('', () => loadBackendEnv().geminiFilterModel), 'gemini-3.5-flash');
  assert.strictEqual(withGeminiFilterModel('   ', () => loadBackendEnv().geminiFilterModel), 'gemini-3.5-flash');
});

test('loadBackendEnv uses (and trims) an explicit GEMINI_FILTER_MODEL', () => {
  assert.strictEqual(withGeminiFilterModel(' gemini-custom ', () => loadBackendEnv().geminiFilterModel), 'gemini-custom');
});
