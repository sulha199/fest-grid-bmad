import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveDateRangeFilter } from './buildEventsQueryCondition.js';

const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);
const DAY_MS = 24 * 60 * 60 * 1000;
const dayNumber = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / DAY_MS;

describe('resolveDateRangeFilter THIS_WEEK window (Monday to Sunday)', () => {
  const thisWeek = (iso: string) => resolveDateRangeFilter('THIS_WEEK', 0, 'DAY', utc(iso));

  it('stays inside the month for a normal week', () => {
    assert.deepEqual(thisWeek('2026-06-10'), { from: '2026-06-08', to: '2026-06-14' });
  });

  it('crosses a month boundary (current date 2026-12-02)', () => {
    assert.deepEqual(thisWeek('2026-12-02'), { from: '2026-11-30', to: '2026-12-06' });
  });

  it('crosses a year boundary (current date 2027-01-01)', () => {
    assert.deepEqual(thisWeek('2027-01-01'), { from: '2026-12-28', to: '2027-01-03' });
  });

  it('uses Sunday as the last day when the current date is a Sunday', () => {
    assert.deepEqual(thisWeek('2026-11-29'), { from: '2026-11-23', to: '2026-11-29' });
    assert.deepEqual(thisWeek('2027-01-03'), { from: '2026-12-28', to: '2027-01-03' });
  });

  it('uses Monday as the first day when the current date is a Monday', () => {
    assert.deepEqual(thisWeek('2026-11-30'), { from: '2026-11-30', to: '2026-12-06' });
  });

  it('applies WEEK and DAY offsets across a boundary', () => {
    assert.deepEqual(resolveDateRangeFilter('THIS_WEEK', 1, 'WEEK', utc('2026-12-02')), { from: '2026-12-07', to: '2026-12-13' });
    assert.deepEqual(resolveDateRangeFilter('THIS_WEEK', -1, 'WEEK', utc('2027-01-05')), { from: '2026-12-28', to: '2027-01-03' });
    assert.deepEqual(resolveDateRangeFilter('THIS_WEEK', 3, 'DAY', utc('2026-12-02')), { from: '2026-12-03', to: '2026-12-09' });
  });

  it('property: every THIS_WEEK window without a span is 7 days, Monday to Sunday (2026-01-01 .. 2028-12-31)', () => {
    for (let n = dayNumber('2026-01-01'); n <= dayNumber('2028-12-31'); n++) {
      const current = new Date(n * DAY_MS);
      const { from, to } = thisWeek(current.toISOString().slice(0, 10));
      assert.equal(dayNumber(to) - dayNumber(from), 6, `window for ${current.toISOString()} is ${from}..${to}`);
      assert.equal(utc(from).getUTCDay(), 1, `from ${from} is not a Monday`);
      assert.equal(utc(to).getUTCDay(), 0, `to ${to} is not a Sunday`);
      assert.ok(dayNumber(from) <= n && n <= dayNumber(to), `${from}..${to} must contain the current date`);
    }
  });
});

describe('resolveDateRangeFilter neighbouring branches around month and year boundaries', () => {
  it('TODAY with DAY, WEEK and MONTH offsets stays one day wide', () => {
    assert.deepEqual(resolveDateRangeFilter('TODAY', 1, 'DAY', utc('2026-12-31')), { from: '2027-01-01', to: '2027-01-01' });
    assert.deepEqual(resolveDateRangeFilter('TODAY', 1, 'WEEK', utc('2026-12-30')), { from: '2027-01-06', to: '2027-01-06' });
    assert.deepEqual(resolveDateRangeFilter('TODAY', 1, 'MONTH', utc('2026-12-15')), { from: '2027-01-15', to: '2027-01-15' });
  });

  it('THIS_MONTH with DAY and WEEK offsets shifts the whole month window', () => {
    assert.deepEqual(resolveDateRangeFilter('THIS_MONTH', 0, 'DAY', utc('2026-12-02')), { from: '2026-12-01', to: '2026-12-31' });
    assert.deepEqual(resolveDateRangeFilter('THIS_MONTH', 1, 'WEEK', utc('2026-12-02')), { from: '2026-12-08', to: '2027-01-07' });
  });

  it('THIS_MONTH with MONTH offsets crosses the year and handles short months', () => {
    assert.deepEqual(resolveDateRangeFilter('THIS_MONTH', 1, 'MONTH', utc('2026-12-31')), { from: '2027-01-01', to: '2027-01-31' });
    assert.deepEqual(resolveDateRangeFilter('THIS_MONTH', 1, 'MONTH', utc('2026-01-31')), { from: '2026-02-01', to: '2026-02-28' });
    assert.deepEqual(resolveDateRangeFilter('THIS_MONTH', -1, 'MONTH', utc('2027-01-31')), { from: '2026-12-01', to: '2026-12-31' });
  });

  it('spans widen from the end of a window that crosses a boundary', () => {
    assert.deepEqual(
      resolveDateRangeFilter('THIS_WEEK', 0, 'DAY', utc('2026-12-02'), { spanAmount: 1, spanUnit: 'WEEK' }),
      { from: '2026-11-30', to: '2026-12-13' }
    );
    assert.deepEqual(
      resolveDateRangeFilter('THIS_WEEK', 0, 'DAY', utc('2026-12-31'), { spanAmount: 3, spanUnit: 'DAY' }),
      { from: '2026-12-28', to: '2027-01-06' }
    );
    assert.deepEqual(
      resolveDateRangeFilter('TODAY', 0, 'DAY', utc('2026-12-31'), { spanAmount: 2, spanUnit: 'MONTH' }),
      { from: '2026-12-31', to: '2027-01-31' }
    );
    assert.deepEqual(
      resolveDateRangeFilter('THIS_MONTH', 0, 'DAY', utc('2026-11-10'), { spanAmount: 2, spanUnit: 'MONTH' }),
      { from: '2026-11-01', to: '2026-12-31' }
    );
  });

  it('THIS_WEEK shifted by whole months keeps a 7-day window when the day-of-month overflows', () => {
    // Day-of-month overflow after the month shift used to squeeze or stretch the window.
    const check = (iso: string, months: number) => {
      const { from, to } = resolveDateRangeFilter('THIS_WEEK', months, 'MONTH', utc(iso));
      assert.equal(dayNumber(to) - dayNumber(from), 6, `${iso} +${months} MONTH gave ${from}..${to}`);
    };
    check('2027-01-27', 1); // Monday 01-25
    check('2026-12-30', 2); // Monday 12-28, Sunday 01-03
    check('2028-01-31', 1); // Monday 01-31, Sunday 02-06
  });
});
