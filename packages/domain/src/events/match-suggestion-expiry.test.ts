import test from 'node:test';
import * as assert from 'node:assert';
import { getSuggestionExpiryReason, type SuggestionExpiryEvent } from './match-suggestion-expiry.js';

const TODAY = '2026-10-30';

function event(overrides: Partial<SuggestionExpiryEvent> = {}): SuggestionExpiryEvent {
  return { deleted: false, merged: false, lastScheduleDay: '2026-11-15', ...overrides };
}

test('getSuggestionExpiryReason', async (t) => {
  await t.test('two live upcoming events keep the suggestion', () => {
    assert.strictEqual(getSuggestionExpiryReason(event(), event(), TODAY), null);
  });

  await t.test('a soft-deleted event on either side expires it', () => {
    assert.strictEqual(getSuggestionExpiryReason(event({ deleted: true }), event(), TODAY), 'event-deleted');
    assert.strictEqual(getSuggestionExpiryReason(event(), event({ deleted: true }), TODAY), 'event-deleted');
  });

  await t.test('a merged event on either side expires it', () => {
    assert.strictEqual(getSuggestionExpiryReason(event({ merged: true }), event(), TODAY), 'event-merged');
    assert.strictEqual(getSuggestionExpiryReason(event(), event({ merged: true }), TODAY), 'event-merged');
  });

  await t.test('deleted wins over merged and over both-over: the cause that holds whatever the dates', () => {
    const over = '2026-01-01';
    assert.strictEqual(
      getSuggestionExpiryReason(event({ deleted: true, merged: true, lastScheduleDay: over }), event({ lastScheduleDay: over }), TODAY),
      'event-deleted'
    );
    assert.strictEqual(
      getSuggestionExpiryReason(event({ merged: true, lastScheduleDay: over }), event({ lastScheduleDay: over }), TODAY),
      'event-merged'
    );
  });

  await t.test('both events over expires it', () => {
    assert.strictEqual(
      getSuggestionExpiryReason(event({ lastScheduleDay: '2026-10-01' }), event({ lastScheduleDay: '2026-10-29' }), TODAY),
      'both-over'
    );
  });

  await t.test('one event still upcoming keeps it, whichever side', () => {
    assert.strictEqual(getSuggestionExpiryReason(event({ lastScheduleDay: '2026-10-01' }), event(), TODAY), null);
    assert.strictEqual(getSuggestionExpiryReason(event(), event({ lastScheduleDay: '2026-10-01' }), TODAY), null);
  });

  await t.test('the day boundary: ending today is not over, ending yesterday is', () => {
    assert.strictEqual(
      getSuggestionExpiryReason(event({ lastScheduleDay: TODAY }), event({ lastScheduleDay: '2026-10-01' }), TODAY),
      null
    );
    assert.strictEqual(
      getSuggestionExpiryReason(event({ lastScheduleDay: '2026-10-29' }), event({ lastScheduleDay: '2026-10-29' }), TODAY),
      'both-over'
    );
  });

  await t.test('an event with no schedule is never over, so a pair holding one stays', () => {
    assert.strictEqual(getSuggestionExpiryReason(event({ lastScheduleDay: null }), event({ lastScheduleDay: '2026-10-01' }), TODAY), null);
    assert.strictEqual(getSuggestionExpiryReason(event({ lastScheduleDay: null }), event({ lastScheduleDay: null }), TODAY), null);
  });
});
