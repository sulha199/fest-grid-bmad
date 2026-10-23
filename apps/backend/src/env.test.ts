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

// Epic 9 review (P12) + re-review: the prompt-filter rate-limit knobs must be whole numbers >= 1.
// `parseInt` alone read "1e3" as 1 and "10abc" as 10, so a typo silently became a different limit.
function withRateLimitEnv(name: string, value: string | undefined, run: () => unknown): unknown {
  const original = process.env[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
  try {
    return run();
  } finally {
    if (original === undefined) delete process.env[name];
    else process.env[name] = original;
  }
}

test('loadBackendEnv reads whole-number prompt-filter rate-limit knobs, trimmed', () => {
  assert.strictEqual(
    withRateLimitEnv('PROMPT_FILTER_RATE_LIMIT_MAX_REQUESTS', ' 7 ', () => loadBackendEnv().promptFilterRateLimitMaxRequests),
    7
  );
  assert.strictEqual(
    withRateLimitEnv('PROMPT_FILTER_RATE_LIMIT_WINDOW_MINUTES', '15', () => loadBackendEnv().promptFilterRateLimitWindowMinutes),
    15
  );
});

test('loadBackendEnv rejects a prompt-filter rate-limit knob that is not a plain positive integer', () => {
  for (const bad of ['0', '-3', '1e3', '10abc', '1.5', '0x10', 'abc', ' ']) {
    assert.throws(
      () => withRateLimitEnv('PROMPT_FILTER_RATE_LIMIT_MAX_REQUESTS', bad, () => loadBackendEnv()),
      /PROMPT_FILTER_RATE_LIMIT_MAX_REQUESTS must be a positive integer/,
      JSON.stringify(bad)
    );
  }
  assert.throws(
    () => withRateLimitEnv('PROMPT_FILTER_RATE_LIMIT_WINDOW_MINUTES', '99999999999999999999', () => loadBackendEnv()),
    /PROMPT_FILTER_RATE_LIMIT_WINDOW_MINUTES must be a positive integer/
  );
});
