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
} from './format-event-date';

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
});
