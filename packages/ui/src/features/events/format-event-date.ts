export const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
};

export function formatEventDate(locale: string, timezone: string | undefined, dateObj: Date): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      ...DATE_FORMAT_OPTIONS,
      ...(timezone ? { timeZone: timezone } : {}),
    }).format(dateObj);
  } catch {
    try {
      return new Intl.DateTimeFormat(locale, DATE_FORMAT_OPTIONS).format(dateObj);
    } catch {
      return new Intl.DateTimeFormat('en-US', DATE_FORMAT_OPTIONS).format(dateObj);
    }
  }
}

export const TIME_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  hour: 'numeric',
  minute: '2-digit',
};

export function formatEventTime(locale: string, timezone: string | undefined, dateObj: Date): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      ...TIME_FORMAT_OPTIONS,
      ...(timezone ? { timeZone: timezone } : {}),
    }).format(dateObj);
  } catch {
    try {
      return new Intl.DateTimeFormat(locale, TIME_FORMAT_OPTIONS).format(dateObj);
    } catch {
      return new Intl.DateTimeFormat('en-US', TIME_FORMAT_OPTIONS).format(dateObj);
    }
  }
}

export function getLocalDateInTimezone(date: Date, timeZone: string | undefined): { year: number; month: number; day: number } {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      ...(timeZone ? { timeZone } : {}),
    });
    const parts = dtf.formatToParts(date);
    const year = parseInt(parts.find(p => p.type === 'year')?.value || '0', 10);
    const month = parseInt(parts.find(p => p.type === 'month')?.value || '0', 10);
    const day = parseInt(parts.find(p => p.type === 'day')?.value || '0', 10);
    return { year, month, day };
  } catch {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
    };
  }
}

export function getCalendarDayDifference(nowParts: { year: number; month: number; day: number }, eventParts: { year: number; month: number; day: number }): number {
  const utcNow = Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day);
  const utcEvent = Date.UTC(eventParts.year, eventParts.month - 1, eventParts.day);
  const diffMs = utcEvent - utcNow;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function formatWeekday(locale: string, timezone: string | undefined, dateObj: Date): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      ...(timezone ? { timeZone: timezone } : {}),
    }).format(dateObj);
  } catch {
    try {
      return new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(dateObj);
    } catch {
      return new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(dateObj);
    }
  }
}

export function getEventDayDiff(dateObj: Date, timezone: string | undefined): number {
  const now = new Date();
  const nowParts = getLocalDateInTimezone(now, timezone);
  const eventParts = getLocalDateInTimezone(dateObj, timezone);
  return getCalendarDayDifference(nowParts, eventParts);
}

export function formatRelativeDayOrDate(
  locale: string,
  timezone: string | undefined,
  dateObj: Date,
  labels?: { today?: string; tomorrow?: string },
  precomputedDayDiff?: number
): string {
  const dayDiff = precomputedDayDiff ?? getEventDayDiff(dateObj, timezone);

  if (dayDiff >= 0 && dayDiff <= 6) {
    if (dayDiff === 0) {
      return labels?.today || 'Today';
    }
    if (dayDiff === 1) {
      return labels?.tomorrow || 'Tomorrow';
    }
    return formatWeekday(locale, timezone, dateObj);
  }

  return formatEventDate(locale, timezone, dateObj);
}

export function formatShortEventDateTime(
  locale: string,
  timezone: string | undefined,
  dateObj: Date,
  hasTime: boolean,
  labels?: { today?: string; tomorrow?: string; yesterday?: string }
): string {
  const dayDiff = getEventDayDiff(dateObj, timezone);

  if (dayDiff === 0) {
    if (hasTime) {
      return formatEventTime(locale, timezone, dateObj);
    }
    return labels?.today ?? 'Today';
  } else if (dayDiff === 1) {
    return labels?.tomorrow ?? 'Tomorrow';
  } else if (dayDiff === -1) {
    return labels?.yesterday ?? 'Yesterday';
  } else {
    const now = new Date();
    const nowLocal = getLocalDateInTimezone(now, timezone);
    const dateLocal = getLocalDateInTimezone(dateObj, timezone);
    const sameYear = nowLocal.year === dateLocal.year;

    if (sameYear) {
      try {
        return new Intl.DateTimeFormat(locale, {
          day: 'numeric',
          month: 'short',
          ...(timezone ? { timeZone: timezone } : {}),
        }).format(dateObj);
      } catch {
        try {
          return new Intl.DateTimeFormat(locale, {
            day: 'numeric',
            month: 'short',
          }).format(dateObj);
        } catch {
          return new Intl.DateTimeFormat('en-US', {
            day: 'numeric',
            month: 'short',
          }).format(dateObj);
        }
      }
    } else {
      try {
        return new Intl.DateTimeFormat(locale, {
          day: 'numeric',
          month: 'short',
          year: '2-digit',
          ...(timezone ? { timeZone: timezone } : {}),
        }).format(dateObj);
      } catch {
        try {
          return new Intl.DateTimeFormat(locale, {
            day: 'numeric',
            month: 'short',
            year: '2-digit',
          }).format(dateObj);
        } catch {
          return new Intl.DateTimeFormat('en-US', {
            day: 'numeric',
            month: 'short',
            year: '2-digit',
          }).format(dateObj);
        }
      }
    }
  }
}
