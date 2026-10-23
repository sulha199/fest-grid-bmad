import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { transformGeminiResponseToEventFilter } from './transform-gemini-response-to-event-filter.js';

describe('transformGeminiResponseToEventFilter numeric strings are parsed whole', () => {
  it('rejects a fractional or trailing-text offsetAmount string instead of truncating it', () => {
    for (const offsetAmount of ['2.7', '3 days', '', '  ']) {
      const result = transformGeminiResponseToEventFilter({
        dateRange: { anchor: 'TODAY', offsetAmount, offsetUnit: 'DAY' },
      });
      assert.equal(result.dateRange, undefined, JSON.stringify(offsetAmount));
    }
  });

  it('still accepts integer strings, with surrounding whitespace', () => {
    const result = transformGeminiResponseToEventFilter({
      dateRange: { anchor: 'TODAY', offsetAmount: ' 3 ', offsetUnit: 'DAY' },
    });
    assert.deepEqual(result.dateRange, { anchor: 'TODAY', offsetAmount: 3, offsetUnit: 'DAY' });
  });

  it('applies the same rule to spanAmount', () => {
    const result = transformGeminiResponseToEventFilter({
      dateRange: { anchor: 'TODAY', offsetAmount: 0, offsetUnit: 'DAY', spanAmount: '2.5', spanUnit: 'WEEK' },
    });
    assert.deepEqual(result.dateRange, { anchor: 'TODAY', offsetAmount: 0, offsetUnit: 'DAY' });
  });
});
