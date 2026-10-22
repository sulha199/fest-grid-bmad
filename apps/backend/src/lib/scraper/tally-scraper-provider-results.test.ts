import test from 'node:test';
import assert from 'node:assert';
import { applyProviderDegradation, countProviderDegradedSkips, tallyScraperProviderResults } from './tally-scraper-provider-results.js';

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

// BUG-074 / IDEA-095
test('tallyScraperProviderResults: PROVIDER_DEGRADED', async (t) => {
  await t.test('all skipped as degraded: reports PROVIDER_DEGRADED', () => {
    const tally = tallyScraperProviderResults([
      { attempted: true, succeeded: false, failureReason: 'PROVIDER_DEGRADED' },
      { attempted: true, succeeded: false, failureReason: 'PROVIDER_DEGRADED' },
    ]);
    assert.deepStrictEqual(tally, { attempted: 2, succeeded: 0, failureReason: 'PROVIDER_DEGRADED' });
  });

  await t.test('PROVIDER_DEGRADED outranks CAPACITY_EXHAUSTED but not TRIGGER_ERROR or DPA_NOT_CONFIRMED', () => {
    assert.strictEqual(
      tallyScraperProviderResults([
        { attempted: true, succeeded: false, failureReason: 'CAPACITY_EXHAUSTED' },
        { attempted: true, succeeded: false, failureReason: 'PROVIDER_DEGRADED' },
      ]).failureReason,
      'PROVIDER_DEGRADED'
    );
    assert.strictEqual(
      tallyScraperProviderResults([
        { attempted: true, succeeded: false, failureReason: 'PROVIDER_DEGRADED' },
        { attempted: true, succeeded: false, failureReason: 'TRIGGER_ERROR' },
      ]).failureReason,
      'TRIGGER_ERROR'
    );
    assert.strictEqual(
      tallyScraperProviderResults([
        { attempted: true, succeeded: false, failureReason: 'PROVIDER_DEGRADED' },
        { attempted: true, succeeded: false, failureReason: 'DPA_NOT_CONFIRMED' },
      ]).failureReason,
      'DPA_NOT_CONFIRMED'
    );
  });
});

test('applyProviderDegradation', async (t) => {
  await t.test('a provider degraded at the batch start has a full failure day even though its probe trigger succeeded', () => {
    assert.deepStrictEqual(applyProviderDegradation({ attempted: 38, succeeded: 1 }, true), {
      attempted: 38,
      succeeded: 0,
      failureReason: 'PROVIDER_DEGRADED',
    });
  });

  await t.test('a more specific failure reason keeps priority: a flag the team controls or a real error is not an outage', () => {
    assert.deepStrictEqual(
      applyProviderDegradation({ attempted: 38, succeeded: 0, failureReason: 'DPA_NOT_CONFIRMED' }, true),
      { attempted: 38, succeeded: 0, failureReason: 'DPA_NOT_CONFIRMED' }
    );
    assert.deepStrictEqual(
      applyProviderDegradation({ attempted: 38, succeeded: 0, failureReason: 'TRIGGER_ERROR' }, true),
      { attempted: 38, succeeded: 0, failureReason: 'TRIGGER_ERROR' }
    );
  });

  await t.test('capacity exhaustion and plain skips are relabelled: the provider being degraded is the actionable fact', () => {
    assert.deepStrictEqual(
      applyProviderDegradation({ attempted: 38, succeeded: 0, failureReason: 'CAPACITY_EXHAUSTED' }, true),
      { attempted: 38, succeeded: 0, failureReason: 'PROVIDER_DEGRADED' }
    );
    assert.deepStrictEqual(
      applyProviderDegradation({ attempted: 38, succeeded: 0, failureReason: 'PROVIDER_DEGRADED' }, true),
      { attempted: 38, succeeded: 0, failureReason: 'PROVIDER_DEGRADED' }
    );
  });

  await t.test('a healthy provider keeps its tally untouched', () => {
    const tally = { attempted: 38, succeeded: 36, failureReason: undefined };
    assert.strictEqual(applyProviderDegradation(tally, false), tally);
  });

  await t.test('a degraded provider the batch never attempted stays unrecorded', () => {
    const tally = { attempted: 0, succeeded: 0 };
    assert.strictEqual(applyProviderDegradation(tally, true), tally);
  });
});

test('countProviderDegradedSkips', async (t) => {
  await t.test('counts the targets that skipped the provider as degraded, and only those', () => {
    const count = countProviderDegradedSkips([
      { attempted: true, succeeded: true },
      { attempted: true, succeeded: false, failureReason: 'PROVIDER_DEGRADED' },
      { attempted: true, succeeded: false, failureReason: 'PROVIDER_DEGRADED' },
      { attempted: true, succeeded: false, failureReason: 'TRIGGER_ERROR' },
      { attempted: true, succeeded: false, failureReason: 'CAPACITY_EXHAUSTED' },
      { attempted: false },
      undefined,
    ]);
    assert.strictEqual(count, 2);
  });

  await t.test('is zero when nothing was skipped, or there are no markers', () => {
    assert.strictEqual(countProviderDegradedSkips([{ attempted: true, succeeded: true }]), 0);
    assert.strictEqual(countProviderDegradedSkips([]), 0);
  });
});
