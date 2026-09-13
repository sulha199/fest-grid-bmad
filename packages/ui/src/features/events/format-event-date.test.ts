import { describe, it, expect } from 'vitest';
import {
  getLocalDateInTimezone,
  getCalendarDayDifference,
  getEventDayDiff,
  formatWeekday,
  formatEventDate,
  formatEventTime,
  formatRelativeDayOrDate,
  formatShortEventDateTime,
  formatEventStatus,
  computeCalendarSegmentTillText,
} from './format-event-date';

// Fixed local reference instant used by formatEventStatus tests below, so every
// boundary is deterministic regardless of when the test suite actually runs
// (formatEventStatus takes `now` as an explicit param for exactly this reason, AC15).
function localDate(year: number, month1to12: number, day: number, hour = 12, minute = 0): Date {
  return new Date(year, month1to12 - 1, day, hour, minute, 0);
}
const NOW = localDate(2026, 6, 15, 10, 0); // 2026-06-15, 10:00 local

describe('format-event-date helpers', () => {
  describe('getLocalDateInTimezone', () => {
    it('returns the year, month, and day in the given timezone', () => {
      // 2026-08-15T01:00:00Z is 2026-08-14 in New York
      const d = new Date('2026-08-15T01:00:00Z');
      const parts = getLocalDateInTimezone(d, 'America/New_York');
      expect(parts.year).toBe(2026);
      expect(parts.month).toBe(8);
      expect(parts.day).toBe(14);
    });

    it('falls back gracefully to system time on invalid timezone', () => {
      const d = new Date('2026-08-15T01:00:00Z');
      const parts = getLocalDateInTimezone(d, 'Invalid/Timezone');
      expect(parts.year).toBe(d.getFullYear());
    });
  });

  describe('getCalendarDayDifference', () => {
    it('returns correct day differences including past and future', () => {
      const parts1 = { year: 2026, month: 8, day: 15 };
      const parts2 = { year: 2026, month: 8, day: 16 };
      expect(getCalendarDayDifference(parts1, parts2)).toBe(1);
      expect(getCalendarDayDifference(parts2, parts1)).toBe(-1);
    });
  });

  describe('getEventDayDiff', () => {
    it('returns day difference relative to now', () => {
      const now = new Date();
      const diff = getEventDayDiff(now, 'UTC');
      expect(diff).toBe(0);
    });
  });

  describe('formatWeekday', () => {
    it('formats day names correctly', () => {
      const d = new Date('2026-08-15T12:00:00Z'); // Saturday
      const formatted = formatWeekday('en-US', 'UTC', d);
      expect(formatted).toBe('Saturday');
    });
  });

  describe('formatEventDate', () => {
    it('formats a date absolute string', () => {
      const d = new Date('2026-08-15T12:00:00Z');
      const formatted = formatEventDate('en-US', 'UTC', d);
      expect(formatted).toContain('Aug 15, 2026');
    });
  });

  describe('formatEventTime', () => {
    it('formats time correctly', () => {
      const d = new Date('2026-08-15T18:30:00Z');
      const formatted = formatEventTime('en-US', 'UTC', d);
      expect(formatted).toContain('6:30 PM');
    });
  });

  describe('formatRelativeDayOrDate', () => {
    it('returns Today for today', () => {
      const d = new Date();
      expect(formatRelativeDayOrDate('en-US', 'UTC', d)).toBe('Today');
    });

    it('returns Tomorrow for tomorrow', () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      expect(formatRelativeDayOrDate('en-US', 'UTC', d)).toBe('Tomorrow');
    });
  });

  describe('formatShortEventDateTime', () => {
    it('1. Today WITH a startTime (hasTime === true) -> returns formatted time', () => {
      const today = new Date();
      const testDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 15, 45, 0);
      const result = formatShortEventDateTime('en-US', undefined, testDate, true);
      const expectedTime = formatEventTime('en-US', undefined, testDate);
      expect(result).toBe(expectedTime);
    });

    it('2. Today with NO startTime (hasTime === false) -> returns labels.today or Today', () => {
      const today = new Date();
      const testDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0);
      expect(formatShortEventDateTime('en-US', undefined, testDate, false)).toBe('Today');
      expect(formatShortEventDateTime('en-US', undefined, testDate, false, { today: 'Hari Ini' })).toBe('Hari Ini');
    });

    it('3. Tomorrow (dayDiff === 1) -> returns labels.tomorrow or Tomorrow', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(formatShortEventDateTime('en-US', undefined, tomorrow, false)).toBe('Tomorrow');
      expect(formatShortEventDateTime('en-US', undefined, tomorrow, false, { tomorrow: 'Besok' })).toBe('Besok');
    });

    it('4. Yesterday (dayDiff === -1) -> returns labels.yesterday or Yesterday', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(formatShortEventDateTime('en-US', undefined, yesterday, false)).toBe('Yesterday');
      expect(formatShortEventDateTime('en-US', undefined, yesterday, false, { yesterday: 'Kemarin' })).toBe('Kemarin');
    });

    it('5. A date 3+ days in the future, SAME calendar year -> returns day + short month without year', () => {
      const future = new Date();
      future.setDate(future.getDate() + 4);
      future.setFullYear(new Date().getFullYear()); // enforce same year
      
      const expected = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short' }).format(future);
      const result = formatShortEventDateTime('en-US', undefined, future, false);
      expect(result).toBe(expected);
    });

    it('6. A date in a DIFFERENT calendar year -> returns day + short month + 2-digit year', () => {
      const futureDiffYear = new Date();
      futureDiffYear.setFullYear(futureDiffYear.getFullYear() + 2);
      
      const expected = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short', year: '2-digit' }).format(futureDiffYear);
      const result = formatShortEventDateTime('en-US', undefined, futureDiffYear, false);
      expect(result).toBe(expected);
    });
  });

  describe('formatEventStatus (Story 1.3b AC15)', () => {
    it('ended: endDayDiff < 0 (event ended days ago)', () => {
      const startDate = localDate(2026, 6, 5);
      const endDate = localDate(2026, 6, 10);
      expect(formatEventStatus('en-US', undefined, NOW, startDate, null, endDate, null)).toBe('Ended');
    });

    it('ended: endDayDiff === 0 with a known endTime already past', () => {
      const startDate = localDate(2026, 6, 14);
      const endDate = localDate(2026, 6, 15);
      // NOW is 10:00 local; 08:00 has already passed.
      expect(formatEventStatus('en-US', undefined, NOW, startDate, null, endDate, '08:00:00')).toBe('Ended');
    });

    it('endsToday: endDayDiff === 0 with a known endTime still in the future', () => {
      const startDate = localDate(2026, 6, 14);
      const endDate = localDate(2026, 6, 15);
      // NOW is 10:00 local; 18:00 is still ahead.
      expect(formatEventStatus('en-US', undefined, NOW, startDate, null, endDate, '18:00:00')).toBe('Ends Today');
    });

    it('endsToday: endDayDiff === 0 with NO known endTime (not yet "ended", exact end instant unknown)', () => {
      const startDate = localDate(2026, 6, 14);
      const endDate = localDate(2026, 6, 15);
      expect(formatEventStatus('en-US', undefined, NOW, startDate, null, endDate, null)).toBe('Ends Today');
    });

    it('happeningNow: started, multi-day event not ending today', () => {
      const startDate = localDate(2026, 6, 13);
      const endDate = localDate(2026, 6, 17);
      expect(formatEventStatus('en-US', undefined, NOW, startDate, null, endDate, null)).toBe('Happening Now');
    });

    it('absent endDate falls back to "ends same day as start" (matches AC14\'s identical fallback)', () => {
      const startDate = localDate(2026, 6, 12);
      // No endDate given -> effective end is startDate (June 12) -> endDayDiff = -3 -> ended.
      expect(formatEventStatus('en-US', undefined, NOW, startDate, null, undefined, null)).toBe('Ended');
    });

    it('inHours(n): starts later today, with a known startTime, n rounded up', () => {
      const startDate = localDate(2026, 6, 15); // date part only -- startTime supplies the actual hour
      // NOW is 10:00 local; a 14:00 local startTime is 4 hours out.
      expect(formatEventStatus('en-US', undefined, NOW, startDate, '14:00:00', null, null)).toBe('In 4 hour(s)');
    });

    it('inHours(n): starts later today with no known startTime falls back to n=0 (deferred edge case)', () => {
      const startDate = localDate(2026, 6, 15, 23, 59); // still today, later than NOW, but no explicit startTime override
      expect(formatEventStatus('en-US', undefined, NOW, startDate, null, null, null)).toBe('In 0 hour(s)');
    });

    it('tomorrow: startDayDiff === 1', () => {
      const startDate = localDate(2026, 6, 16);
      expect(formatEventStatus('en-US', undefined, NOW, startDate, null, null, null)).toBe('Tomorrow');
    });

    it('weekday name: startDayDiff === 2 (lower boundary of "same week")', () => {
      const startDate = localDate(2026, 6, 17);
      const expected = formatWeekday('en-US', undefined, startDate);
      expect(formatEventStatus('en-US', undefined, NOW, startDate, null, null, null)).toBe(expected);
    });

    it('weekday name: startDayDiff === 6 (upper boundary of "same week")', () => {
      const startDate = localDate(2026, 6, 21);
      const expected = formatWeekday('en-US', undefined, startDate);
      expect(formatEventStatus('en-US', undefined, NOW, startDate, null, null, null)).toBe(expected);
    });

    it('inDays(n): startDayDiff === 7 (lower boundary of "next week")', () => {
      const startDate = localDate(2026, 6, 22);
      expect(formatEventStatus('en-US', undefined, NOW, startDate, null, null, null)).toBe('In 7 days');
    });

    it('inDays(n): startDayDiff === 13 (upper boundary of "next week")', () => {
      const startDate = localDate(2026, 6, 28);
      expect(formatEventStatus('en-US', undefined, NOW, startDate, null, null, null)).toBe('In 13 days');
    });

    it('upcoming: startDayDiff === 14 (beyond "next week")', () => {
      const startDate = localDate(2026, 6, 29);
      expect(formatEventStatus('en-US', undefined, NOW, startDate, null, null, null)).toBe('Upcoming');
    });

    it('accepts label overrides for every parameterized/non-weekday state', () => {
      const startDate = localDate(2026, 6, 22);
      expect(
        formatEventStatus('en-US', undefined, NOW, startDate, null, null, null, { statusInDays: 'Dalam {n} hari' })
      ).toBe('Dalam 7 hari');
    });
  });
});

describe('computeCalendarSegmentTillText (Story 1.i1d AC4)', () => {
  it('returns the bare till label for a continuing multi-day segment (its day is before the end day)', () => {
    expect(
      computeCalendarSegmentTillText('en-US', undefined, '2026-08-05', '2026-08-05', '2026-08-07', '21:00:00', 'till')
    ).toBe('till');
  });

  it('returns "till {formatted time}" on the segment\'s last day when an end time is known', () => {
    expect(
      computeCalendarSegmentTillText('en-US', undefined, '2026-08-07', '2026-08-05', '2026-08-07', '21:00:00', 'till')
    ).toBe('till 9:00 PM');
  });

  it('returns the bare till label on the last day with an explicit end date but no end time', () => {
    expect(
      computeCalendarSegmentTillText('en-US', undefined, '2026-08-07', '2026-08-05', '2026-08-07', null, 'till')
    ).toBe('till');
  });

  it('returns the bare till label when there is no end information at all (single-day)', () => {
    expect(
      computeCalendarSegmentTillText('en-US', undefined, '2026-08-05', '2026-08-05', undefined, undefined, 'till')
    ).toBe('till');
  });

  it('never repeats the event\'s own start date as the date box text', () => {
    const result = computeCalendarSegmentTillText('en-US', undefined, '2026-08-07', '2026-08-05', '2026-08-07', '21:00:00', 'till');
    expect(result).not.toContain('Aug 5');
    expect(result).not.toContain('2026');
  });

  it('honors a custom till label', () => {
    expect(
      computeCalendarSegmentTillText('en-US', undefined, '2026-08-07', '2026-08-05', '2026-08-07', '21:00:00', 'bis')
    ).toBe('bis 9:00 PM');
  });
});

