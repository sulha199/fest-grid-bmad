import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BACKOFF_SECONDS, INITIAL_STATE, MAX_EVIDENCE_PASSES, applyOutcome, classifyError, isDue, onNewEvidence, type EnrichmentState } from './profile-retry.js';

const t0 = new Date('2026-10-18T10:00:00Z');
const transient = { kind: 'transient' as const, reason: 'timeout' };

test('success finishes; a permanent failure goes straight to a human without spending more scrapes', () => {
  assert.equal(applyOutcome(INITIAL_STATE, { kind: 'ok' }, t0).status, 'DONE');
  const perm = applyOutcome(INITIAL_STATE, { kind: 'permanent', reason: 'profile not found' }, t0);
  assert.equal(perm.status, 'NEEDS_REVIEW'); assert.equal(perm.nextAttemptAt, null); assert.equal(perm.attempts, 0);
});

test('transient failures retry with the documented backoff and then give up to a human', () => {
  let s: EnrichmentState = INITIAL_STATE;
  const waits: number[] = [];
  for (let i = 0; i < BACKOFF_SECONDS.length; i++) {
    s = applyOutcome(s, transient, t0);
    assert.equal(s.status, 'PENDING');
    waits.push((s.nextAttemptAt!.getTime() - t0.getTime()) / 1000);
  }
  assert.deepEqual(waits, [...BACKOFF_SECONDS]);
  s = applyOutcome(s, transient, t0);
  assert.equal(s.status, 'NEEDS_REVIEW');
  assert.equal(s.nextAttemptAt, null);
  assert.match(s.lastReason ?? '', /gave up after 5 retries/);
});

test('a longer Retry-After than the backoff step is honoured; a shorter one is not used to retry sooner', () => {
  assert.equal((applyOutcome(INITIAL_STATE, { ...transient, retryAfterSeconds: 7200 }, t0).nextAttemptAt!.getTime() - t0.getTime()) / 1000, 7200);
  assert.equal((applyOutcome(INITIAL_STATE, { ...transient, retryAfterSeconds: 5 }, t0).nextAttemptAt!.getTime() - t0.getTime()) / 1000, BACKOFF_SECONDS[0]);
});

test('isDue: only PENDING profiles whose time has come', () => {
  const s = applyOutcome(INITIAL_STATE, transient, t0);
  assert.equal(isDue(s, t0), false);
  assert.equal(isDue(s, new Date(t0.getTime() + 899_000)), false);
  assert.equal(isDue(s, new Date(t0.getTime() + 900_000)), true);
  assert.equal(isDue(INITIAL_STATE, t0), true, 'never attempted');
  assert.equal(isDue({ ...s, status: 'NEEDS_REVIEW' }, new Date(t0.getTime() + 1e9)), false);
  assert.equal(isDue({ ...s, status: 'DONE' }, new Date(t0.getTime() + 1e9)), false);
});

test('a scrape that WORKED but showed no country waits for new evidence instead of re-scraping the profile', () => {
  let s: EnrichmentState = INITIAL_STATE;
  s = applyOutcome(s, { kind: 'country-unresolved' }, t0);
  assert.equal(s.status, 'AWAITING_EVIDENCE'); assert.equal(isDue(s, t0), false, 'the sweep must not re-scrape it'); assert.equal(onNewEvidence(s), true);
  for (let i = 1; i < MAX_EVIDENCE_PASSES - 1; i++) s = applyOutcome(s, { kind: 'country-unresolved' }, t0);
  assert.equal(s.status, 'AWAITING_EVIDENCE');
  s = applyOutcome(s, { kind: 'country-unresolved' }, t0);
  assert.equal(s.status, 'NEEDS_REVIEW');
  assert.equal(applyOutcome({ ...INITIAL_STATE, status: 'AWAITING_EVIDENCE', evidencePasses: 1 }, { kind: 'ok' }, t0).status, 'DONE', 'new evidence resolved it');
});

test('failed attempts and evidence passes are counted independently', () => {
  const s = applyOutcome(applyOutcome(INITIAL_STATE, transient, t0), { kind: 'country-unresolved' }, t0);
  assert.equal(s.attempts, 1); assert.equal(s.evidencePasses, 1);
});

test('applyOutcome never mutates its input', () => {
  const input: EnrichmentState = { ...INITIAL_STATE }; const before = JSON.stringify(input);
  applyOutcome(input, transient, t0);
  assert.equal(JSON.stringify(input), before);
});

test('classifyError: the real error classes and statuses map to transient / permanent', () => {
  for (const name of ['ApifyRequestTimeoutError', 'ScraperCapacityExceededError', 'AiGatewayExhaustedError', 'GeminiRateLimitedError']) {
    assert.equal(classifyError(Object.assign(new Error('x'), { name })).kind, 'transient', name);
  }
  assert.equal(classifyError({ status: 429, message: 'Too Many Requests' }).kind, 'transient');
  assert.equal(classifyError({ status: 503, message: 'high demand' }).kind, 'transient');
  assert.equal(classifyError(new Error('socket hang up')).kind, 'transient');
  assert.equal(classifyError(new Error('Apify profile not found')).kind, 'permanent');
  assert.equal(classifyError({ status: 404, message: 'x' }).kind, 'permanent');
  assert.equal(classifyError(new Error('This account is private')).kind, 'permanent');
  const key = classifyError(Object.assign(new Error('bad key'), { name: 'GeminiInvalidKeyError' }));
  assert.equal(key.kind, 'transient'); assert.equal(key.kind === 'transient' && key.retryAfterSeconds, 21_600, 'a key problem is for an operator: back off long');
  const unknown = classifyError(new Error('???'));
  assert.equal(unknown.kind, 'transient'); assert.match(unknown.kind === 'transient' ? unknown.reason : '', /unclassified/);
  assert.equal(classifyError(undefined).kind, 'transient');
});
