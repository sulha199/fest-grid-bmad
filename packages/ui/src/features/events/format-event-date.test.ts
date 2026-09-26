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
  formatShortEventDateTimeParts,
  formatEventStatus,
  computeCalendarSegmentTillText,
  computeCalendarSegmentDateBoxContent,
  computeEventCardDateBoxParts,
  formatEventCardDateBoxLine,
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

  describe('formatEventStatus (Story 1.3b AC15, return shape extended by Story 1.i1i AC4)', () => {
    // Story 1.i1i AC4 — every assertion below pins BOTH halves of the new return shape, so a
    // regression in `isHappeningNow` fails explicitly instead of being masked by a text match.
    const notNow = (text: string) => ({ text, isHappeningNow: false });

    it('ended: endDayDiff < 0 (event ended days ago)', () => {
      const startDate = localDate(2026, 6, 5);
      const endDate = localDate(2026, 6, 10);
      expect(formatEventStatus('en-US', undefined, NOW, startDate, null, endDate, null)).toEqual(
        notNow('Ended')
      );
    });

    it('ended: endDayDiff === 0 with a known endTime already past', () => {
      const startDate = localDate(2026, 6, 14);
      const endDate = localDate(2026, 6, 15);
      // NOW is 10:00 local; 08:00 has already passed.
      expect(formatEventStatus('en-US', undefined, NOW, startDate, null, endDate, '08:00:00')).toEqual(
        notNow('Ended')
      );
    });

    it('endsToday: endDayDiff === 0 with a known endTime still in the future', () => {
      const startDate = localDate(2026, 6, 14);
      const endDate = localDate(2026, 6, 15);
      // NOW is 10:00 local; 18:00 is still ahead.
      expect(formatEventStatus('en-US', undefined, NOW, startDate, null, endDate, '18:00:00')).toEqual(
        notNow('Ends Today')
      );
    });

    it('endsToday: endDayDiff === 0 with NO known endTime (not yet "ended", exact end instant unknown)', () => {
      const startDate = localDate(2026, 6, 14);
      const endDate = localDate(2026, 6, 15);
      expect(formatEventStatus('en-US', undefined, NOW, startDate, null, endDate, null)).toEqual(
        notNow('Ends Today')
      );
    });

    it('happeningNow: started, multi-day event not ending today — the ONE isHappeningNow: true state', () => {
      const startDate = localDate(2026, 6, 13);
      const endDate = localDate(2026, 6, 17);
      expect(formatEventStatus('en-US', undefined, NOW, startDate, null, endDate, null)).toEqual({
        text: 'Now',
        isHappeningNow: true,
      });
    });

    it('absent endDate falls back to "ends same day as start" (matches AC14\'s identical fallback)', () => {
      const startDate = localDate(2026, 6, 12);
      // No endDate given -> effective end is startDate (June 12) -> endDayDiff = -3 -> ended.
      expect(formatEventStatus('en-US', undefined, NOW, startDate, null, undefined, null)).toEqual(
        notNow('Ended')
      );
    });

    it('inHours(n): starts later today, with a known startTime, n rounded up', () => {
      const startDate = localDate(2026, 6, 15); // date part only -- startTime supplies the actual hour
      // NOW is 10:00 local; a 14:00 local startTime is 4 hours out.
      expect(formatEventStatus('en-US', undefined, NOW, startDate, '14:00:00', null, null)).toEqual(
        notNow('In 4 hour(s)')
      );
    });

    it('inHours(n): starts later today with no known startTime falls back to n=0 (deferred edge case)', () => {
      const startDate = localDate(2026, 6, 15, 23, 59); // still today, later than NOW, but no explicit startTime override
      expect(formatEventStatus('en-US', undefined, NOW, startDate, null, null, null)).toEqual(
        notNow('In 0 hour(s)')
      );
    });

    it('tomorrow: startDayDiff === 1', () => {
      const startDate = localDate(2026, 6, 16);
      expect(formatEventStatus('en-US', undefined, NOW, startDate, null, null, null)).toEqual(
        notNow('Tomorrow')
      );
    });

    it('weekday name: startDayDiff === 2 (lower boundary of "same week")', () => {
      const startDate = localDate(2026, 6, 17);
      const expected = formatWeekday('en-US', undefined, startDate);
      expect(formatEventStatus('en-US', undefined, NOW, startDate, null, null, null)).toEqual(
        notNow(expected)
      );
    });

    it('weekday name: startDayDiff === 6 (upper boundary of "same week")', () => {
      const startDate = localDate(2026, 6, 21);
      const expected = formatWeekday('en-US', undefined, startDate);
      expect(formatEventStatus('en-US', undefined, NOW, startDate, null, null, null)).toEqual(
        notNow(expected)
      );
    });

    it('inDays(n): startDayDiff === 7 (lower boundary of "next week")', () => {
      const startDate = localDate(2026, 6, 22);
      expect(formatEventStatus('en-US', undefined, NOW, startDate, null, null, null)).toEqual(
        notNow('In 7 days')
      );
    });

    it('inDays(n): startDayDiff === 13 (upper boundary of "next week")', () => {
      const startDate = localDate(2026, 6, 28);
      expect(formatEventStatus('en-US', undefined, NOW, startDate, null, null, null)).toEqual(
        notNow('In 13 days')
      );
    });

    it('upcoming: startDayDiff === 14 (beyond "next week")', () => {
      const startDate = localDate(2026, 6, 29);
      expect(formatEventStatus('en-US', undefined, NOW, startDate, null, null, null)).toEqual(
        notNow('Upcoming')
      );
    });

    it('accepts label overrides for every parameterized/non-weekday state', () => {
      const startDate = localDate(2026, 6, 22);
      expect(
        formatEventStatus('en-US', undefined, NOW, startDate, null, null, null, { statusInDays: 'Dalam {n} hari' })
      ).toEqual(notNow('Dalam 7 hari'));
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

describe('formatShortEventDateTimeParts (Story 1.i1k Task 1.2)', () => {
  it('today WITH a startTime -> month empty, day = formatted time', () => {
    const today = new Date();
    const testDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 15, 45, 0);
    const result = formatShortEventDateTimeParts('en-US', undefined, testDate, true);
    expect(result).toEqual({ month: '', day: formatEventTime('en-US', undefined, testDate), dayVariant: 'word' });
  });

  it('today with NO startTime -> month empty, day = labels.today or Today', () => {
    const today = new Date();
    const testDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0);
    expect(formatShortEventDateTimeParts('en-US', undefined, testDate, false)).toEqual({ month: '', day: 'Today', dayVariant: 'word' });
    expect(
      formatShortEventDateTimeParts('en-US', undefined, testDate, false, { today: 'Hari Ini' })
    ).toEqual({ month: '', day: 'Hari Ini', dayVariant: 'word' });
  });

  it('tomorrow (dayDiff === 1) -> month empty, day = labels.tomorrow or Tomorrow', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(formatShortEventDateTimeParts('en-US', undefined, tomorrow, false)).toEqual({ month: '', day: 'Tomorrow', dayVariant: 'word' });
  });

  it('yesterday (dayDiff === -1) -> month empty, day = labels.yesterday or Yesterday', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(formatShortEventDateTimeParts('en-US', undefined, yesterday, false)).toEqual({ month: '', day: 'Yesterday', dayVariant: 'word' });
  });

  it('a real short date (3+ days out) -> month = short month abbrev, day = day number, no year', () => {
    const future = new Date();
    future.setDate(future.getDate() + 4);
    future.setFullYear(new Date().getFullYear());
    const expectedMonth = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(future);
    const expectedDay = new Intl.DateTimeFormat('en-US', { day: 'numeric' }).format(future);
    expect(formatShortEventDateTimeParts('en-US', undefined, future, false)).toEqual({
      month: expectedMonth,
      day: expectedDay,
      dayVariant: 'number',
    });
  });

  it('every dayDiff branch reports the correct dayVariant discriminant (Story 1.i1n AC1/AC4)', () => {
    const today = new Date();
    const testDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const future = new Date();
    future.setDate(future.getDate() + 4);

    expect(formatShortEventDateTimeParts('en-US', undefined, testDate, false).dayVariant).toBe('word');
    expect(formatShortEventDateTimeParts('en-US', undefined, testDate, true).dayVariant).toBe('word');
    expect(formatShortEventDateTimeParts('en-US', undefined, tomorrow, false).dayVariant).toBe('word');
    expect(formatShortEventDateTimeParts('en-US', undefined, yesterday, false).dayVariant).toBe('word');
    expect(formatShortEventDateTimeParts('en-US', undefined, future, false).dayVariant).toBe('number');
  });
});

describe('computeCalendarSegmentDateBoxContent (BUG-047 AC-DATE-1/2/3, rewritten)', () => {
  it('first day of a multi-day segment (not yet the last day): shows the real effective-end-date digits, tillLabel carries the bare till text', () => {
    const result = computeCalendarSegmentDateBoxContent(
      'en-US', undefined, '2026-08-05', '2026-08-05', '2026-08-07', '21:00:00', 'till'
    );
    expect(result).toEqual({ month: 'Aug', day: '7', tillLabel: 'till' });
  });

  it('last day of a multi-day segment (currentDayStr === effectiveEnd): month/day STILL show the real end-date digits (<= rule, not the old till/time overload), tillLabel carries "till {time}"', () => {
    const result = computeCalendarSegmentDateBoxContent(
      'en-US', undefined, '2026-08-07', '2026-08-05', '2026-08-07', '21:00:00', 'till'
    );
    expect(result).toEqual({ month: 'Aug', day: '7', tillLabel: 'till 9:00 PM' });
  });

  it('last day with an explicit end date but no end time: tillLabel is the bare label', () => {
    const result = computeCalendarSegmentDateBoxContent(
      'en-US', undefined, '2026-08-07', '2026-08-05', '2026-08-07', null, 'till'
    );
    expect(result).toEqual({ month: 'Aug', day: '7', tillLabel: 'till' });
  });

  it('no end information at all (single-day event): month/day show the start date (== effectiveEnd), bare tillLabel', () => {
    const result = computeCalendarSegmentDateBoxContent(
      'en-US', undefined, '2026-08-05', '2026-08-05', undefined, undefined, 'till'
    );
    expect(result).toEqual({ month: 'Aug', day: '5', tillLabel: 'till' });
  });

  it('honors a custom till label', () => {
    const result = computeCalendarSegmentDateBoxContent(
      'en-US', undefined, '2026-08-07', '2026-08-05', '2026-08-07', '21:00:00', 'bis'
    );
    expect(result).toEqual({ month: 'Aug', day: '7', tillLabel: 'bis 9:00 PM' });
  });

  it('day slot is never a word, weekday, or bare time string on any branch', () => {
    const cases: Array<[string, string, string | null, string | null]> = [
      ['2026-08-05', '2026-08-05', '2026-08-07', '21:00:00'], // first day
      ['2026-08-07', '2026-08-05', '2026-08-07', '21:00:00'], // last day
      ['2026-08-05', '2026-08-05', null, null], // single-day
    ];
    for (const [currentDayStr, startDate, endDate, endTime] of cases) {
      const result = computeCalendarSegmentDateBoxContent('en-US', undefined, currentDayStr, startDate, endDate, endTime, 'till');
      expect(result.day).toMatch(/^\d{1,2}$/);
    }
  });

  it('a calendar day BEFORE the event has started (should not normally occur, but the formula must not crash): falls to the "otherwise" branch, shows the start date', () => {
    const result = computeCalendarSegmentDateBoxContent(
      'en-US', undefined, '2026-08-01', '2026-08-05', '2026-08-07', '21:00:00', 'till'
    );
    expect(result).toEqual({ month: 'Aug', day: '5', tillLabel: 'till' });
  });

  it('a calendar day AFTER the event has already ended (should not normally occur -- WeeklyCalendarView only ever renders segments within the event\'s own date range -- but the formula must not crash): symmetric to the before-start case, falls to the "otherwise" branch and shows the start date (code-review finding, Edge Case Hunter)', () => {
    const result = computeCalendarSegmentDateBoxContent(
      'en-US', undefined, '2026-08-09', '2026-08-05', '2026-08-07', '21:00:00', 'till'
    );
    expect(result).toEqual({ month: 'Aug', day: '5', tillLabel: 'till 9:00 PM' });
  });
});

describe('computeEventCardDateBoxParts (BUG-047 AC-DATE-1/2/3, notYetEnded corrected in review loop 1)', () => {
  const startDateTime = localDate(2026, 8, 5, 18, 0);
  const endDateTime = localDate(2026, 8, 7, 21, 0);
  const KNOWN_END_TIME = '21:00:00';

  it('not started: shows the start date', () => {
    const now = localDate(2026, 8, 4, 12, 0);
    const result = computeEventCardDateBoxParts('en-US', undefined, now, startDateTime, endDateTime, KNOWN_END_TIME);
    expect(result).toEqual({ month: 'Aug', day: '5' });
  });

  it('started and not yet ended (ongoing, before the end day): shows the end date (fixes BUG-022)', () => {
    const now = localDate(2026, 8, 6, 12, 0);
    const result = computeEventCardDateBoxParts('en-US', undefined, now, startDateTime, endDateTime, KNOWN_END_TIME);
    expect(result).toEqual({ month: 'Aug', day: '7' });
  });

  it('exactly at the start instant: counts as started -- shows the end date', () => {
    const result = computeEventCardDateBoxParts('en-US', undefined, startDateTime, startDateTime, endDateTime, KNOWN_END_TIME);
    expect(result).toEqual({ month: 'Aug', day: '7' });
  });

  it('endTime known, exactly at the end instant: ended -- falls back to the start date', () => {
    const result = computeEventCardDateBoxParts('en-US', undefined, endDateTime, startDateTime, endDateTime, KNOWN_END_TIME);
    expect(result).toEqual({ month: 'Aug', day: '5' });
  });

  it('endTime known, already ended (past the end day): shows the start date', () => {
    const now = localDate(2026, 8, 9, 12, 0);
    const result = computeEventCardDateBoxParts('en-US', undefined, now, startDateTime, endDateTime, KNOWN_END_TIME);
    expect(result).toEqual({ month: 'Aug', day: '5' });
  });

  // Review loop 1 fix: the exact regression both reviewers found. A multi-day event with NO
  // precise endTime must stay "ongoing" (show the end date) for the ENTIRE calendar day it ends
  // on -- not just up until midnight, which is what `combineDateTime` collapses an absent endTime
  // to and what the original strict `now < endDateTime` rule was comparing against.
  describe('no known endTime (the BUG-022-recurrence scenario)', () => {
    it('afternoon of the actual last day: still shows the END date, not the start date', () => {
      const now = localDate(2026, 8, 7, 15, 0); // Aug 7, mid-afternoon -- same day endDateTime collapses to midnight of
      const result = computeEventCardDateBoxParts('en-US', undefined, now, startDateTime, endDateTime, null);
      expect(result).toEqual({ month: 'Aug', day: '7' });
    });

    it('very end of the actual last day (23:59): still shows the END date', () => {
      const now = localDate(2026, 8, 7, 23, 59);
      const result = computeEventCardDateBoxParts('en-US', undefined, now, startDateTime, endDateTime, undefined);
      expect(result).toEqual({ month: 'Aug', day: '7' });
    });

    it('the day AFTER the last day: correctly falls back to the start date (no known time to compare against, but the calendar day has passed)', () => {
      const now = localDate(2026, 8, 8, 1, 0);
      const result = computeEventCardDateBoxParts('en-US', undefined, now, startDateTime, endDateTime, null);
      expect(result).toEqual({ month: 'Aug', day: '5' });
    });
  });

  it('single-day event (start === end): every state shows the same digits', () => {
    const singleDayStart = localDate(2026, 8, 5, 9, 0);
    const singleDayEnd = localDate(2026, 8, 5, 23, 0);
    const ongoing = computeEventCardDateBoxParts('en-US', undefined, localDate(2026, 8, 5, 12, 0), singleDayStart, singleDayEnd, '23:00:00');
    expect(ongoing).toEqual({ month: 'Aug', day: '5' });
  });

  it('day is always a bare numeric string, never a word', () => {
    const now = localDate(2026, 8, 5, 12, 0); // "today" relative to itself
    const result = computeEventCardDateBoxParts('en-US', undefined, now, now, localDate(2026, 8, 5, 23, 0), '23:00:00');
    expect(result.day).toMatch(/^\d{1,2}$/);
  });
});

describe('formatEventCardDateBoxLine (BUG-047, VM1 single-line date-box text)', () => {
  const startDateTime = localDate(2026, 8, 5, 18, 0);
  const endDateTime = localDate(2026, 8, 7, 21, 0);
  const KNOWN_END_TIME = '21:00:00';

  it('resolves the same target (end date while started+ongoing) as computeEventCardDateBoxParts, as one locale-correct combined string', () => {
    const now = localDate(2026, 8, 6, 12, 0);
    const line = formatEventCardDateBoxLine('en-US', undefined, now, startDateTime, endDateTime, KNOWN_END_TIME);
    const parts = computeEventCardDateBoxParts('en-US', undefined, now, startDateTime, endDateTime, KNOWN_END_TIME);
    expect(line).toBe(`${parts.month} ${parts.day}`);
  });

  it('not started: shows the start date', () => {
    const now = localDate(2026, 8, 4, 12, 0);
    expect(formatEventCardDateBoxLine('en-US', undefined, now, startDateTime, endDateTime, KNOWN_END_TIME)).toBe('Aug 5');
  });

  it('already ended: shows the start date', () => {
    const now = localDate(2026, 8, 9, 12, 0);
    expect(formatEventCardDateBoxLine('en-US', undefined, now, startDateTime, endDateTime, KNOWN_END_TIME)).toBe('Aug 5');
  });

  it('no known endTime, afternoon of the actual last day: still shows the end date (same review-loop-1 fix as computeEventCardDateBoxParts)', () => {
    const now = localDate(2026, 8, 7, 15, 0);
    expect(formatEventCardDateBoxLine('en-US', undefined, now, startDateTime, endDateTime, null)).toBe('Aug 7');
  });

  it('degrades gracefully (no throw) on an invalid timezone, falling back to locale-only formatting (code-review finding: fallback chain had no coverage)', () => {
    const now = localDate(2026, 8, 6, 12, 0);
    expect(() =>
      formatEventCardDateBoxLine('en-US', 'Not/A_Real_Zone', now, startDateTime, endDateTime, KNOWN_END_TIME)
    ).not.toThrow();
    expect(formatEventCardDateBoxLine('en-US', 'Not/A_Real_Zone', now, startDateTime, endDateTime, KNOWN_END_TIME)).toBe('Aug 7');
  });
});

