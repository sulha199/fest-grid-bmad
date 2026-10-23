import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildKeywordCondition,
  buildLocationCondition,
  buildTemporalCondition,
  resolveDateRangeFilter,
  resolveTodayISO,
} from './buildEventsQueryCondition.js';

describe('resolveTodayISO', () => {
  it('falls back to the instant\'s UTC date when Intl cannot format with the zone', () => {
    const RealDateTimeFormat = Intl.DateTimeFormat;
    const spy = mock.method(Intl, 'DateTimeFormat', function (locale?: string | string[], options?: Intl.DateTimeFormatOptions) {
      // `isValidIanaTimezone` constructs with an undefined locale and must keep working; only the
      // en-CA formatter used to render the zoned date fails.
      if (locale === 'en-CA') throw new RangeError('boom');
      return new RealDateTimeFormat(locale, options);
    });
    try {
      assert.equal(resolveTodayISO(new Date('2026-06-01T23:30:00Z'), 'Asia/Jakarta'), '2026-06-01');
    } finally {
      spy.mock.restore();
    }
  });
});

describe('resolveDateRangeFilter month offsets', () => {
  const wednesday = new Date('2026-06-10T00:00:00Z');
  const sunday = new Date('2026-06-14T00:00:00Z');

  it('shifts a TODAY anchor by whole months', () => {
    assert.deepEqual(resolveDateRangeFilter('TODAY', 1, 'MONTH', wednesday), { from: '2026-07-10', to: '2026-07-10' });
  });

  it('shifts a THIS_WEEK anchor by whole months', () => {
    assert.deepEqual(resolveDateRangeFilter('THIS_WEEK', 1, 'MONTH', wednesday), { from: '2026-07-08', to: '2026-07-14' });
  });

  it('treats Sunday as the last day of its ISO week for a THIS_WEEK anchor', () => {
    assert.deepEqual(resolveDateRangeFilter('THIS_WEEK', 0, 'DAY', sunday), { from: '2026-06-08', to: '2026-06-14' });
  });
});

describe('buildTemporalCondition', () => {
  it('returns undefined for a temporal filter value it does not recognise', () => {
    assert.equal(buildTemporalCondition('SOMEDAY', new Date('2026-06-01T00:00:00Z')), undefined);
  });
});

describe('buildKeywordCondition', () => {
  it('returns undefined for a bare "#" with no tag', () => {
    assert.equal(buildKeywordCondition('#'), undefined);
    assert.equal(buildKeywordCondition('#   '), undefined);
  });

  it('returns undefined for a whitespace-only keyword', () => {
    assert.equal(buildKeywordCondition('   '), undefined);
  });
});

describe('buildLocationCondition', () => {
  it('returns undefined when the location carries neither coordinates nor an admin area', () => {
    assert.equal(buildLocationCondition({}), undefined);
  });

  it('defaults the radius to 10km when coordinates carry none', () => {
    assert.deepEqual(buildLocationCondition({ coordinates: { lat: 1, lng: 2 } }), {
      field: 'scheduleCoordinates',
      operator: 'withinRadius',
      value: { latitude: 1, longitude: 2, radiusKm: 10 },
    });
  });
});
