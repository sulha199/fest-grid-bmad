import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { transformGeminiResponseToEventFilter } from './transform-gemini-response-to-event-filter.js';

const dateRange = (overrides: Record<string, unknown>) => ({
  anchor: 'TODAY',
  offsetAmount: 1,
  offsetUnit: 'DAY',
  ...overrides,
});

describe('transformGeminiResponseToEventFilter dateRange parsing', () => {
  it('parses a numeric-string offsetAmount', () => {
    const result = transformGeminiResponseToEventFilter({ dateRange: dateRange({ offsetAmount: '3' }) });
    assert.deepEqual(result.dateRange, { anchor: 'TODAY', offsetAmount: 3, offsetUnit: 'DAY' });
  });

  it('drops the whole dateRange when offsetAmount is not a number', () => {
    assert.equal(transformGeminiResponseToEventFilter({ dateRange: dateRange({ offsetAmount: 'soon' }) }).dateRange, undefined);
  });

  it('drops the whole dateRange when offsetUnit is not a known unit', () => {
    assert.equal(transformGeminiResponseToEventFilter({ dateRange: dateRange({ offsetUnit: 'FORTNIGHT' }) }).dateRange, undefined);
  });

  it('keeps the base dateRange but omits an invalid span', () => {
    const result = transformGeminiResponseToEventFilter({
      dateRange: dateRange({ spanAmount: 0, spanUnit: 'WEEK' }),
    });
    assert.deepEqual(result.dateRange, { anchor: 'TODAY', offsetAmount: 1, offsetUnit: 'DAY' });
  });

  it('keeps a valid span, including a numeric-string spanAmount', () => {
    const result = transformGeminiResponseToEventFilter({
      dateRange: dateRange({ spanAmount: '2', spanUnit: 'WEEK' }),
    });
    assert.deepEqual(result.dateRange, { anchor: 'TODAY', offsetAmount: 1, offsetUnit: 'DAY', spanAmount: 2, spanUnit: 'WEEK' });
  });

  it('omits a span that exceeds the bound for its unit', () => {
    const result = transformGeminiResponseToEventFilter({
      dateRange: dateRange({ spanAmount: 53, spanUnit: 'WEEK' }),
    });
    assert.deepEqual(result.dateRange, { anchor: 'TODAY', offsetAmount: 1, offsetUnit: 'DAY' });
  });
});

describe('transformGeminiResponseToEventFilter location parsing', () => {
  it('parses string coordinates', () => {
    const result = transformGeminiResponseToEventFilter({ location: { coordinates: { lat: '1.5', lng: '2.5' } } });
    assert.deepEqual(result.location, { coordinates: { lat: 1.5, lng: 2.5 } });
  });

  it('drops coordinates that are not numeric', () => {
    assert.equal(
      transformGeminiResponseToEventFilter({ location: { coordinates: { lat: 'north', lng: '2' } } }).location,
      undefined
    );
    assert.equal(
      transformGeminiResponseToEventFilter({ location: { coordinates: { lat: '1', lng: 'east' } } }).location,
      undefined
    );
  });

  it('parses a numeric-string radiusMeters and ignores a non-numeric one', () => {
    assert.deepEqual(transformGeminiResponseToEventFilter({ location: { radiusMeters: '5000' } }).location, {
      radiusMeters: 5000,
    });
    assert.equal(transformGeminiResponseToEventFilter({ location: { radiusMeters: 'far' } }).location, undefined);
  });
});

describe('transformGeminiResponseToEventFilter keyword parsing', () => {
  it('keeps a non-blank keyword and drops a blank one', () => {
    assert.equal(transformGeminiResponseToEventFilter({ keyword: 'jazz' }).keyword, 'jazz');
    assert.equal(transformGeminiResponseToEventFilter({ keyword: '   ' }).keyword, undefined);
  });
});
