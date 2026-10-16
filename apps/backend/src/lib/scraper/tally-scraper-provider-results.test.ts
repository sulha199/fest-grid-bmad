import test from 'node:test';
import assert from 'node:assert';
import { tallyScraperProviderResults } from './tally-scraper-provider-results.js';

test('tallyScraperProviderResults', async (t) => {
  await t.test('all succeeded: tallies attempts and successes, no failureReason', () => {
    const tally = tallyScraperProviderResults([
      { attempted: true, succeeded: true },
      { attempted: true, succeeded: true },
    ]);
    assert.deepStrictEqual(tally, { attempted: 2, succeeded: 2 });
  });

  await t.test('all failed with same reason: tallies and reports that reason', () => {
    const tally = tallyScraperProviderResults([
      { attempted: true, succeeded: false, failureReason: 'TRIGGER_ERROR' },
      { attempted: true, succeeded: false, failureReason: 'TRIGGER_ERROR' },
    ]);
    assert.deepStrictEqual(tally, { attempted: 2, succeeded: 0, failureReason: 'TRIGGER_ERROR' });
  });

  await t.test('mixed reasons: TRIGGER_ERROR wins as dominant', () => {
    const tally = tallyScraperProviderResults([
      { attempted: true, succeeded: false, failureReason: 'CAPACITY_EXHAUSTED' },
      { attempted: true, succeeded: false, failureReason: 'TRIGGER_ERROR' },
    ]);
    assert.deepStrictEqual(tally, { attempted: 2, succeeded: 0, failureReason: 'TRIGGER_ERROR' });
  });

  await t.test('zero attempted: empty tally, no failureReason', () => {
    const tally = tallyScraperProviderResults([]);
    assert.deepStrictEqual(tally, { attempted: 0, succeeded: 0 });
  });

  await t.test('undefined markers skipped (vendor never attempted for that target)', () => {
    const tally = tallyScraperProviderResults([undefined, { attempted: true, succeeded: true }, undefined]);
    assert.deepStrictEqual(tally, { attempted: 1, succeeded: 1 });
  });

  await t.test('only CAPACITY_EXHAUSTED failures: reports CAPACITY_EXHAUSTED', () => {
    const tally = tallyScraperProviderResults([
      { attempted: true, succeeded: false, failureReason: 'CAPACITY_EXHAUSTED' },
      { attempted: true, succeeded: false, failureReason: 'CAPACITY_EXHAUSTED' },
    ]);
    assert.deepStrictEqual(tally, { attempted: 2, succeeded: 0, failureReason: 'CAPACITY_EXHAUSTED' });
  });

  // Story 0.i2d (AC6) -- DPA_NOT_CONFIRMED wins dominance over a mixed TRIGGER_ERROR/
  // CAPACITY_EXHAUSTED day: a deliberate, deterministic, 100%-of-calls gate closure is the
  // most actionable signal for an operator, ranking above a possibly-sporadic real outage.
  await t.test('mixed DPA_NOT_CONFIRMED/TRIGGER_ERROR/CAPACITY_EXHAUSTED day: DPA_NOT_CONFIRMED wins as dominant', () => {
    const tally = tallyScraperProviderResults([
      { attempted: true, succeeded: false, failureReason: 'CAPACITY_EXHAUSTED' },
      { attempted: true, succeeded: false, failureReason: 'TRIGGER_ERROR' },
      { attempted: true, succeeded: false, failureReason: 'DPA_NOT_CONFIRMED' },
    ]);
    assert.deepStrictEqual(tally, { attempted: 3, succeeded: 0, failureReason: 'DPA_NOT_CONFIRMED' });
  });

  await t.test('all DPA_NOT_CONFIRMED failures: reports DPA_NOT_CONFIRMED', () => {
    const tally = tallyScraperProviderResults([
      { attempted: true, succeeded: false, failureReason: 'DPA_NOT_CONFIRMED' },
      { attempted: true, succeeded: false, failureReason: 'DPA_NOT_CONFIRMED' },
    ]);
    assert.deepStrictEqual(tally, { attempted: 2, succeeded: 0, failureReason: 'DPA_NOT_CONFIRMED' });
  });
});
