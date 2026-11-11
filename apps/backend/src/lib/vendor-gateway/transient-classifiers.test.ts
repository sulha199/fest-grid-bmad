import test from 'node:test';
import assert from 'node:assert/strict';
import { ApifyApiError } from 'apify-client';
import { isTransientVendorFailure } from '@festgrid/domain';
import { isApifyErrorTransient } from '../scraper/instagram-adapter.js';
import { BrightDataApiError, isBrightDataErrorTransient } from '../scraper/brightdata-client.js';
import { GeminiRateLimitedError, GeminiInvalidKeyError, GeminiUnknownError, isGeminiErrorTransient } from '../ai-gateway/gemini-client.js';

// Story 10.2 AC8 (FIND-082): the three vendor clients share one transient rule. Every classifier must answer exactly what the
// shared rule says for the same status or code, and keep its own error-class behaviour.

const apify = (status: number) =>
  new ApifyApiError({ status, data: {}, config: { method: 'post', url: 'https://api.apify.com/v2/x' } } as any, 1);
const withCode = (code: string) => Object.assign(new Error('network'), { code });

const STATUSES = [400, 401, 402, 403, 404, 429, 499, 500, 502, 503, 599, 600];
const CODES = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EAI_AGAIN', 'ENOENT'];

test('every classifier agrees with the shared rule for each HTTP status', () => {
  for (const status of STATUSES) {
    const expected = isTransientVendorFailure({ statusCode: status });
    assert.equal(isApifyErrorTransient(apify(status)), expected, `apify ${status}`);
    assert.equal(isBrightDataErrorTransient(new BrightDataApiError('x', status)), expected, `brightdata ${status}`);
    assert.equal(isGeminiErrorTransient(new GeminiUnknownError('x', { status })), expected, `gemini ${status}`);
  }
});

test('every classifier agrees with the shared rule for each network error code, on the error and on its cause', () => {
  for (const code of CODES) {
    const expected = isTransientVendorFailure({ code });
    assert.equal(isApifyErrorTransient(withCode(code)), expected, `apify ${code}`);
    assert.equal(isBrightDataErrorTransient(withCode(code)), expected, `brightdata ${code}`);
    assert.equal(isGeminiErrorTransient(new GeminiUnknownError('x', { code })), expected, `gemini ${code}`);
    const viaCause = Object.assign(new Error('fetch failed'), { cause: { code } });
    assert.equal(isApifyErrorTransient(viaCause), expected, `apify cause ${code}`);
    assert.equal(isBrightDataErrorTransient(viaCause), expected, `brightdata cause ${code}`);
    assert.equal(isGeminiErrorTransient(new GeminiUnknownError('x', { cause: { code } })), expected, `gemini cause ${code}`);
  }
});

test('each classifier keeps its own error-class rules', () => {
  // A vendor API error is judged by its status only, never by a code it does not carry.
  assert.equal(isApifyErrorTransient(apify(404)), false);
  // Gemini: only a GeminiUnknownError can be transient; the key-rotation errors never are, and a plain Error never is.
  assert.equal(isGeminiErrorTransient(new GeminiRateLimitedError('x')), false);
  assert.equal(isGeminiErrorTransient(new GeminiInvalidKeyError('x')), false);
  assert.equal(isGeminiErrorTransient(new Error('x')), false);
  // Everything else is not transient (never a default-transient fallback).
  for (const value of [new Error('some other error'), 'not an Error', undefined, null, 42]) {
    assert.equal(isApifyErrorTransient(value), false);
    assert.equal(isBrightDataErrorTransient(value), false);
  }
  // Gemini's other status field spellings are still read.
  assert.equal(isGeminiErrorTransient(new GeminiUnknownError('x', { statusCode: 503 })), true);
  assert.equal(isGeminiErrorTransient(new GeminiUnknownError('x', { status_code: 503 })), true);
});
