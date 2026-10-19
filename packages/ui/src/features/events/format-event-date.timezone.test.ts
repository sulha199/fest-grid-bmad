import { describe, it, expect } from 'vitest';
import {
  combineDateTime,
  formatEventStatus,
  isEventEnded,
  computeEventCardDateBoxParts,
  getLocalDateInTimezone,
} from './format-event-date';

/**
 * Timezone matrix for the masonry status badge (Ended / Ends Today / In n hours / Tomorrow /
 * weekday / In n days / Upcoming). Every case passes the viewing timezone EXPLICITLY (never the
 * process TZ), so it runs identically on any CI machine.
 *
 * Regression: a bare `YYYY-MM-DD` date with no time was anchored at UTC midnight, which is the
 * PREVIOUS calendar day in every zone west of UTC. In `America/New_York` (the `/en/` locale's
 * app-wide timezone) a one-day event starting today therefore read "Ended" for the whole
 * viewer's afternoon/evening, and an event tomorrow read "In 0 hours" instead of "Tomorrow".
 */
const ZONES = [
  'Pacific/Pago_Pago', // UTC-11
  'America/Los_Angeles', // UTC-7/8
  'America/New_York', // UTC-4/5 (the /en/ app-wide timezone)
  'UTC',
  'Europe/Paris', // UTC+1/2
  'Asia/Jakarta', // UTC+7 (the /id/ app-wide timezone)
  'Asia/Kolkata', // UTC+5:30
  'Pacific/Auckland', // UTC+12/13
  'Pacific/Kiritimati', // UTC+14
];

// Wall-clock offsets within the viewer's day, deliberately including both midnight edges.
const CLOCK_TIMES = ['00:00:00', '00:30:00', '07:00:00', '12:00:00', '18:59:00', '23:30:00', '23:59:00'];

const EVENT_DAY = '2026-10-19';

/** The UTC instant at which the wall clock in `tz` reads `date` `time`. */
const at = (date: string, time: string, tz: string) => combineDateTime(date, time, tz);

const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

describe.each(ZONES)('status badge in %s', (tz) => {
  describe('one-day event starting today, no times', () => {
    it.each(CLOCK_TIMES)('viewed at %s on the event day: Ends Today, never Ended', (time) => {
      const now = at(EVENT_DAY, time, tz);
      expect(isEventEnded(now, tz, EVENT_DAY, null, null, null)).toBe(false);
      const status = formatEventStatus('en-US', tz, now, EVENT_DAY, null, null, null);
      expect(status.state).toBe('endsToday');
    });

    it.each(CLOCK_TIMES)('viewed at %s the day after: Ended', (time) => {
      const now = at(addDays(EVENT_DAY, 1), time, tz);
      expect(formatEventStatus('en-US', tz, now, EVENT_DAY, null, null, null).state).toBe('ended');
    });

    it.each(CLOCK_TIMES)('viewed at %s the day before: Tomorrow', (time) => {
      const now = at(addDays(EVENT_DAY, -1), time, tz);
      expect(formatEventStatus('en-US', tz, now, EVENT_DAY, null, null, null).state).toBe('tomorrow');
    });
  });

  describe('one-day event starting today at 19:00, no end time', () => {
    it.each(['00:00:00', '07:00:00', '12:00:00', '18:59:00'])('viewed at %s: starts in n hours', (time) => {
      const now = at(EVENT_DAY, time, tz);
      expect(isEventEnded(now, tz, EVENT_DAY, '19:00:00', null, null)).toBe(false);
      expect(formatEventStatus('en-US', tz, now, EVENT_DAY, '19:00:00', null, null).state).toBe('inHours');
    });

    it.each(['19:00:00', '23:30:00', '23:59:00'])('viewed at %s: Ends Today (started, no end time)', (time) => {
      const now = at(EVENT_DAY, time, tz);
      expect(formatEventStatus('en-US', tz, now, EVENT_DAY, '19:00:00', null, null).state).toBe('endsToday');
    });
  });

  describe('one-day event 19:00-22:00 today', () => {
    it('before start: starts in n hours', () => {
      const now = at(EVENT_DAY, '10:00:00', tz);
      expect(formatEventStatus('en-US', tz, now, EVENT_DAY, '19:00:00', EVENT_DAY, '22:00:00').state).toBe('inHours');
    });
    it('during: Ends hh:mm', () => {
      const now = at(EVENT_DAY, '20:00:00', tz);
      expect(formatEventStatus('en-US', tz, now, EVENT_DAY, '19:00:00', EVENT_DAY, '22:00:00').state).toBe('endsAt');
    });
    it('after the end time: Ended', () => {
      const now = at(EVENT_DAY, '22:00:00', tz);
      expect(formatEventStatus('en-US', tz, now, EVENT_DAY, '19:00:00', EVENT_DAY, '22:00:00').state).toBe('ended');
    });
  });

  describe('upcoming ladder for a no-time event, viewed at midday', () => {
    it.each([
      [1, 'tomorrow'],
      [2, 'weekday'],
      [6, 'weekday'],
      [7, 'inDays'],
      [13, 'inDays'],
      [14, 'upcoming'],
      [90, 'upcoming'],
    ])('%i day(s) ahead: %s', (daysAhead, state) => {
      const now = at(addDays(EVENT_DAY, -daysAhead), '12:00:00', tz);
      expect(formatEventStatus('en-US', tz, now, EVENT_DAY, null, null, null).state).toBe(state);
    });

    it.each([
      [1, 'tomorrow'],
      [7, 'inDays'],
      [14, 'upcoming'],
    ])('%i day(s) ahead, viewed just after midnight and just before it: %s', (daysAhead, state) => {
      for (const time of ['00:00:00', '23:59:00']) {
        const now = at(addDays(EVENT_DAY, -daysAhead), time, tz);
        expect(formatEventStatus('en-US', tz, now, EVENT_DAY, null, null, null).state).toBe(state);
      }
    });
  });

  describe('multi-day event without times (Oct 19 - Oct 21)', () => {
    it('first day: happening now (ends later)', () => {
      const now = at('2026-10-19', '12:00:00', tz);
      expect(formatEventStatus('en-US', tz, now, '2026-10-19', null, '2026-10-21', null).state).toBe('happeningNow');
    });
    it('last day: Ends Today', () => {
      const now = at('2026-10-21', '15:00:00', tz);
      expect(formatEventStatus('en-US', tz, now, '2026-10-19', null, '2026-10-21', null).state).toBe('endsToday');
    });
    it('day after the last day: Ended', () => {
      const now = at('2026-10-22', '00:30:00', tz);
      expect(formatEventStatus('en-US', tz, now, '2026-10-19', null, '2026-10-21', null).state).toBe('ended');
    });
  });

  describe('combineDateTime / date box', () => {
    it('a bare date resolves to that same calendar day in the viewing timezone', () => {
      const parts = getLocalDateInTimezone(combineDateTime(EVENT_DAY, null, tz), tz);
      expect(parts).toEqual({ year: 2026, month: 10, day: 19 });
    });

    it('the card date box shows the event day for a no-time event', () => {
      const start = combineDateTime(EVENT_DAY, null, tz);
      const now = at(addDays(EVENT_DAY, -3), '12:00:00', tz);
      expect(computeEventCardDateBoxParts('en-US', tz, now, start, start, null)).toEqual({ month: 'Oct', day: '19' });
    });
  });
});
