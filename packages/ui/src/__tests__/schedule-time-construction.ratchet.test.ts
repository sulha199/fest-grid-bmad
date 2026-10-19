/**
 * Ratchet: schedule wall-clock dates/times become instants in ONE place.
 *
 * An event's `eventStartDate` ("2026-10-19") and `eventStartTime` ("18:30:00") carry no timezone.
 * Turning them into a `Date` any other way than `combineDateTime(date, time, timezone)`
 * (`features/events/format-event-date.ts`) has repeatedly shipped the same family of bug, each only
 * visible off a UTC machine (see `combineDateTime`'s doc comment and the `*.timezone.test.*` suites):
 *
 *   1. `new Date('2026-10-19')` -- a bare date parses as UTC midnight, which is the PREVIOUS calendar
 *      day in every zone west of UTC ("Ended" for an event starting today).
 *   2. `new Date(`${date}T18:30:00`)` -- no trailing `Z`/offset, so it is built in the DEVICE's zone
 *      and then formatted in the app's (wrong time/day for every viewer outside the app zone).
 *   3. `.getFullYear()/.getMonth()/.getDate()/.getHours()/.getMinutes()/.getDay()` -- local getters
 *      read a calendar day off an instant in the device's zone (a noon-UTC calendar anchor rolls to
 *      the next day on a device at UTC+12 and beyond). Use the `getUTC*` getters, or
 *      `getLocalDateInTimezone(date, timezone)`.
 *
 * Like the AD-33 z-index ratchet next to it this is a plain source-text scan, not a runtime test. It
 * walks `packages/ui/src` and `apps/web/src`. `format-event-date.ts` is the sanctioned module and is
 * skipped. Any other legitimate use goes in ALLOWLIST with the reason it is safe; an entry that no
 * longer matches anything fails the test so the list can only shrink.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const EXCLUDED_SEGMENTS = ['__tests__', 'node_modules', 'generated'];
const EXCLUDED_FILENAME_MARKERS = ['.test.', '.spec.', '.stories.'];
const INCLUDED_EXTENSIONS = ['.ts', '.tsx'];

const UI_SRC_ROOT = path.resolve(__dirname, '..');
const WEB_SRC_ROOT = path.resolve(__dirname, '../../../../apps/web/src');
const REPO_ROOT = path.resolve(__dirname, '../../../..');

if (!fs.existsSync(WEB_SRC_ROOT)) {
  throw new Error(`schedule-time ratchet: apps/web/src not found at ${WEB_SRC_ROOT}; re-verify the relative climb.`);
}

/** The one module allowed to build instants from schedule wall-clock values. */
const SANCTIONED_FILE = path.resolve(UI_SRC_ROOT, 'features/events/format-event-date.ts');

type Rule = 'bare-date-parse' | 'device-local-datetime' | 'local-getter';

interface AllowlistEntry {
  /** Repo-relative path. */
  file: string;
  rules: Rule[];
  reason: string;
}

const ALLOWLIST: AllowlistEntry[] = [
  {
    file: 'apps/web/src/lib/validation/proposed-event-correction.schema.ts',
    rules: ['bare-date-parse'],
    reason:
      'Compares two bare dates that are parsed identically (both UTC midnight); no instant is ever formed or displayed, so the zone cancels out.',
  },
  {
    file: 'apps/web/src/lib/calendar/buildIcsCalendar.ts',
    rules: ['local-getter'],
    reason:
      'All-day ICS end date: pure calendar arithmetic (local Date built from Y/M/D, +1 day via setDate, read back with the same local getters). Never compared with or formatted as an instant.',
  },
  {
    file: 'packages/ui/src/core/WeekPicker.tsx',
    rules: ['local-getter'],
    reason:
      'react-day-picker hands back local-midnight Dates; the local getters recover exactly the calendar day the user clicked, which is then converted to a UTC-anchored ISO string.',
  },
  {
    file: 'packages/ui/src/features/events/WeeklyCalendarView.tsx',
    rules: ['local-getter'],
    reason:
      '`toISODateString` is "today on THIS device" (fallback when no timezone is given) and the legacy `weekStart: Date` prop is a local-calendar Date; both want local getters. Calendar-day anchors use `anchorToISODateString` (UTC getters).',
  },
];

function walk(root: string): string[] {
  const out: string[] = [];
  const visit = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!EXCLUDED_SEGMENTS.includes(entry.name)) visit(path.join(dir, entry.name));
      } else if (
        entry.isFile() &&
        INCLUDED_EXTENSIONS.some((ext) => entry.name.endsWith(ext)) &&
        !EXCLUDED_FILENAME_MARKERS.some((marker) => entry.name.includes(marker))
      ) {
        out.push(path.join(dir, entry.name));
      }
    }
  };
  visit(root);
  return out;
}

/** Blanks `//` and block comments (keeping line numbers) so prose that quotes a bad pattern is not flagged. */
export function stripComments(source: string): string {
  const blank = (text: string) => text.replace(/[^\n]/g, ' ');
  return source
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (match, lead: string) => lead + blank(match.slice(lead.length)));
}

interface Hit {
  file: string;
  line: number;
  rule: Rule;
  text: string;
}

/** Identifiers that hold a bare `YYYY-MM-DD` schedule date. */
const BARE_DATE_IDENTIFIER = '(?:eventStartDate|eventEndDate|startDate|endDate|startDateStr|endDateStr|dStr)';
const BARE_DATE_PARSE = new RegExp(`new Date\\(\\s*(?:[\\w$?]+\\.)*${BARE_DATE_IDENTIFIER}\\s*[,)]`, 'g');
const TEMPLATE_DATE = /new Date\(\s*`([^`]*)`/g;
const LOCAL_GETTER = /\.(?:getFullYear|getMonth|getDate|getHours|getMinutes|getDay)\(\)/g;

/** True when the template carries a time part (`T12:00`, `T${time}`) but pins no zone (`Z` / `+07:00`). */
function isZonelessDateTimeTemplate(template: string): boolean {
  const hasTimePart = /T(?:\d|\$\{)/.test(template);
  const pinsZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(template);
  return hasTimePart && !pinsZone;
}

export function scanSource(file: string, source: string): Hit[] {
  const code = stripComments(source);
  const hits: Hit[] = [];
  const lineOf = (index: number) => code.slice(0, index).split('\n').length;
  const textOf = (index: number) => source.split('\n')[lineOf(index) - 1].trim();

  for (const match of code.matchAll(BARE_DATE_PARSE)) {
    hits.push({ file, line: lineOf(match.index!), rule: 'bare-date-parse', text: textOf(match.index!) });
  }
  for (const match of code.matchAll(TEMPLATE_DATE)) {
    if (isZonelessDateTimeTemplate(match[1])) {
      hits.push({ file, line: lineOf(match.index!), rule: 'device-local-datetime', text: textOf(match.index!) });
    }
  }
  for (const match of code.matchAll(LOCAL_GETTER)) {
    hits.push({ file, line: lineOf(match.index!), rule: 'local-getter', text: textOf(match.index!) });
  }
  return hits;
}

function collectHits(): Hit[] {
  return [...walk(UI_SRC_ROOT), ...walk(WEB_SRC_ROOT)]
    .filter((file) => file !== SANCTIONED_FILE)
    .flatMap((file) => scanSource(file, fs.readFileSync(file, 'utf8')));
}

const rel = (file: string) => path.relative(REPO_ROOT, file).split(path.sep).join('/');
const isAllowed = (hit: Hit) =>
  ALLOWLIST.some((entry) => entry.file === rel(hit.file) && entry.rules.includes(hit.rule));

describe('schedule wall-clock -> instant ratchet', () => {
  const hits = collectHits();

  it('builds instants from schedule dates/times only through combineDateTime (no un-allowlisted hits)', () => {
    const violations = hits.filter((hit) => !isAllowed(hit));
    expect(
      violations.map((v) => `${rel(v.file)}:${v.line} [${v.rule}] ${v.text}`),
      'Use combineDateTime(date, time, timezone) / getLocalDateInTimezone(date, timezone) / getUTC* getters. ' +
        'If the use is genuinely safe, add it to ALLOWLIST in this file with the reason.'
    ).toEqual([]);
  });

  it('keeps ALLOWLIST honest: every entry still matches something', () => {
    const stale = ALLOWLIST.flatMap((entry) =>
      entry.rules
        .filter((rule) => !hits.some((hit) => rel(hit.file) === entry.file && hit.rule === rule))
        .map((rule) => `${entry.file} [${rule}]`)
    );
    expect(stale, 'These ALLOWLIST entries no longer match any code -- remove them.').toEqual([]);
  });
});

describe('scanSource (the ratchet\'s own detector)', () => {
  const scan = (source: string) => scanSource('x.ts', source).map((hit) => hit.rule);

  it('flags a bare schedule date parsed with new Date', () => {
    expect(scan('const d = new Date(schedule.eventStartDate);')).toEqual(['bare-date-parse']);
    expect(scan('const d = new Date(startDate)')).toEqual(['bare-date-parse']);
    expect(scan('const d = new Date(startDateStr, 1)')).toEqual(['bare-date-parse']);
  });

  it('flags a zoneless date-time template, but not one that pins UTC or an offset', () => {
    expect(scan('new Date(`${date}T${time}`)')).toEqual(['device-local-datetime']);
    expect(scan('new Date(`${date}T18:30:00`)')).toEqual(['device-local-datetime']);
    expect(scan('new Date(`${date}T12:00:00Z`)')).toEqual([]);
    expect(scan('new Date(`${date}T18:30:00+07:00`)')).toEqual([]);
  });

  it('flags local getters but not UTC getters', () => {
    expect(scan('d.getDate(); d.getHours();')).toEqual(['local-getter', 'local-getter']);
    expect(scan('d.getUTCDate(); d.getUTCHours();')).toEqual([]);
  });

  it('ignores prose in comments that quotes the bad pattern', () => {
    expect(scan("// new Date('2026-10-19T18:30:00') builds it in the device zone\nconst a = 1;")).toEqual([]);
    expect(scan('/* d.getDate() and new Date(startDate) */ const a = 1;')).toEqual([]);
  });

  it('does not treat a URL in a string as a comment', () => {
    expect(scan("const u = 'https://x.test'; d.getDate();")).toEqual(['local-getter']);
  });

  it('leaves unrelated new Date uses alone', () => {
    expect(scan('new Date(); new Date(Date.now()); new Date(row.createdAt); new Date(Date.UTC(y, m, d))')).toEqual([]);
  });
});
