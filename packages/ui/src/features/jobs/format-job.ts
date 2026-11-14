/** Story 10.4 Part B -- locale-aware duration and time text (Locale-Sensitive Data Rendering). */

function unit(locale: string, value: number, unitName: 'hour' | 'minute' | 'second'): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'unit', unit: unitName, unitDisplay: 'short' }).format(value);
  } catch {
    return `${value} ${unitName.charAt(0)}`;
  }
}

/** "1 min 20 s", "2 h 5 min", "0 s". Whole seconds; never negative. */
export function formatJobDuration(ms: number, locale: string): string {
  const total = Math.max(0, Math.floor((Number.isFinite(ms) ? ms : 0) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(unit(locale, hours, 'hour'));
  if (minutes > 0) parts.push(unit(locale, minutes, 'minute'));
  if (seconds > 0 || parts.length === 0) {
    // With hours shown, trailing seconds are noise.
    if (hours === 0) parts.push(unit(locale, seconds, 'second'));
  }
  return parts.join(' ');
}

function sameDay(a: Date, b: Date, timeZone?: string): boolean {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  return f.format(a) === f.format(b);
}

/** A clock time for today, date plus time for another day. Degrades without a timezone/locale instead of throwing. */
export function formatJobTime(iso: string, locale: string, now: Date = new Date(), timeZone?: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  let today: boolean;
  try {
    today = sameDay(date, now, timeZone);
  } catch {
    // An unusable timezone: compare in the runtime zone.
    today = sameDay(date, now);
    timeZone = undefined;
  }
  const options: Intl.DateTimeFormatOptions = today
    ? { hour: '2-digit', minute: '2-digit' }
    : { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  try {
    return new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(date);
  } catch {
    return new Intl.DateTimeFormat(undefined, options).format(date);
  }
}
