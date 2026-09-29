import { describe, it, expect } from 'vitest';
import { combineDateTime } from './format-event-date';

/**
 * Isolated in its own file, deliberately: these tests mutate `process.env.TZ` to reproduce a
 * device-timezone-dependent bug, but Node/V8's ICU implementation caches the resolved default
 * timezone the first time `Intl.DateTimeFormat()`/local `Date` getters are used without an
 * explicit `timeZone` — later `process.env.TZ` changes (even restoring the original value) do
 * NOT reliably take effect for the rest of the process after that first resolution. Verified
 * directly: `Intl.DateTimeFormat().resolvedOptions().timeZone` stayed pinned to a mutated value
 * even after `delete process.env.TZ`. Sharing a file/worker with `format-event-date.test.ts` (or
 * any other test relying on system-default timezone resolution) would silently poison all of
 * them once these tests ran first — that happened once during development of this fix (17
 * unrelated tests failed) and is why this file exists standalone: Vitest's default per-file
 * worker isolation contains the poisoning to just this file.
 */
describe('combineDateTime (BUG, 2026-09-28: mobile-only date-off-by-one)', () => {
  const withTZ = <T,>(tz: string, fn: () => T): T => {
    const hadTZ = 'TZ' in process.env;
    const originalTZ = process.env.TZ;
    process.env.TZ = tz;
    try {
      return fn();
    } finally {
      if (hadTZ) {
        process.env.TZ = originalTZ;
      } else {
        delete process.env.TZ;
      }
    }
  };

  it('keeps a date-only string + a time-of-day on its own calendar date on a device timezone west of UTC', () => {
    // Reproduces the exact production report: eventStartDate="2026-10-02" (a plain GraphQL Date
    // scalar, no time/timezone of its own) + eventStartTime="07:00:00", viewed on a device set
    // to a timezone behind UTC (Los Angeles, UTC-7/8 in October) -- before the fix,
    // `new Date("2026-10-02")` parsed as UTC midnight, and reading local getters off it on this
    // device timezone rolled the date back to Oct 1.
    //
    // The assertions run *inside* `withTZ`, not on its return value: `Date.prototype.getHours()`
    // (and friends) re-read the CURRENT ambient timezone at call time, not whatever was active
    // when the Date was constructed. Asserting after `withTZ` restores the original TZ compares
    // a LA-constructed instant against a different reader timezone -- which happened to still
    // read correctly on machines where the TZ mutation never really took hold (see the file
    // comment above), masking the mismatch locally while failing on any CI runner where the
    // mutation *does* take effect.
    withTZ('America/Los_Angeles', () => {
      const combined = combineDateTime('2026-10-02', '07:00:00');
      expect(combined.getFullYear()).toBe(2026);
      expect(combined.getMonth()).toBe(9); // October, 0-indexed
      expect(combined.getDate()).toBe(2);
      expect(combined.getHours()).toBe(7);
    });
  });

  it('stays correct on a device timezone east of UTC too (Jakarta itself)', () => {
    withTZ('Asia/Jakarta', () => {
      const combined = combineDateTime('2026-10-02', '07:00:00');
      expect(combined.getFullYear()).toBe(2026);
      expect(combined.getMonth()).toBe(9);
      expect(combined.getDate()).toBe(2);
      expect(combined.getHours()).toBe(7);
    });
  });

  it("still combines a real Date object with a time-of-day using the Date object's own local getters", () => {
    // Non-string input is unaffected by the fix -- its components already reflect whatever
    // local context constructed it, nothing to re-derive from a raw string.
    withTZ('America/Los_Angeles', () => {
      const combined = combineDateTime(new Date(2026, 9, 2), '07:00:00');
      expect(combined.getFullYear()).toBe(2026);
      expect(combined.getMonth()).toBe(9);
      expect(combined.getDate()).toBe(2);
      expect(combined.getHours()).toBe(7);
    });
  });

  it('leaves the no-timeStr passthrough as the unmodified UTC-parsed instant (never buggy, must stay that way)', () => {
    const combined = withTZ('America/Los_Angeles', () => combineDateTime('2026-10-02'));
    expect(combined.getTime()).toBe(new Date('2026-10-02').getTime());
  });

  // Fix 2 (2026-09-29): fix 1 above (extracting Y/M/D straight from the date-only string) was
  // real but incomplete -- it stopped there being read via the WRONG mechanism (local getters on
  // a UTC-parsed instant), but the corrected Y/M/D was still combined into an instant via
  // `new Date(year, month, day, h, m, s)`, which ALWAYS builds in the CALLING RUNTIME's own
  // ambient timezone. Every caller then reformats that instant via `Intl.DateTimeFormat` using an
  // EXPLICIT, often-DIFFERENT timezone (the masonry card has no per-schedule timezone threaded to
  // it, so it falls back to `ScopedLocaleProvider`'s fixed per-locale mapping -- `America/
  // New_York` for `/en/`). Building in the device's ambient zone and displaying in a different
  // fixed zone can shift the calendar date depending on the specific hour -- reproducing the same
  // "Oct 2 -> shows Oct 1" report even after fix 1, on a still-real device (still user-reported
  // after fix 1 shipped). These tests assert against the TARGET timezone's own displayed wall
  // clock (via `Intl.DateTimeFormat({ timeZone })`), never local getters -- local getters always
  // read the CURRENT ambient timezone, which is the exact thing that must no longer matter here.
  const displayInTimezone = (date: Date, timeZone: string) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const get = (type: string) => parts.find((p) => p.type === type)?.value;
    return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
  };

  it('produces the identical target-timezone display regardless of the calling device\'s own ambient timezone (the actual production bug)', () => {
    // Same event data ("10:00 on 2026-10-02, Asia/Jakarta"), same explicit display timezone
    // (America/New_York, what a masonry card on the /en/ locale actually uses with no
    // per-schedule timezone threaded to it) -- constructed under three wildly different DEVICE
    // ambient timezones. Before this fix, the ambient device timezone leaked into instant
    // construction, so these three could disagree (and did, for the reporter's own phone); after
    // the fix, all three must produce the byte-identical display, because the device's own
    // timezone is now irrelevant to the result.
    const fromJakarta = withTZ('Asia/Jakarta', () => combineDateTime('2026-10-02', '10:00:00', 'Asia/Jakarta'));
    const fromLA = withTZ('America/Los_Angeles', () => combineDateTime('2026-10-02', '10:00:00', 'Asia/Jakarta'));
    const fromUTC = withTZ('UTC', () => combineDateTime('2026-10-02', '10:00:00', 'Asia/Jakarta'));

    const displayJakarta = displayInTimezone(fromJakarta, 'Asia/Jakarta');
    const displayLA = displayInTimezone(fromLA, 'Asia/Jakarta');
    const displayUTC = displayInTimezone(fromUTC, 'Asia/Jakarta');

    expect(displayLA).toBe(displayJakarta);
    expect(displayUTC).toBe(displayJakarta);
    // The intuitive, correct result for the common case (an `id`-locale viewer, whose display
    // timezone matches the event's own Jakarta wall-clock time): shows Oct 2, 10:00, exactly as
    // authored -- not shifted by whatever timezone the viewer's own device happens to be set to.
    expect(displayJakarta).toBe('2026-10-02 10:00');
  });

  it('a masonry card with no per-schedule timezone (the real production shape) is at least device-independent, even though it displays the wrong wall clock', () => {
    // Reproduces the exact reported URL's shape: the /en/ locale's masonry card has no
    // per-schedule timezone threaded to it, so `ScopedLocaleProvider` supplies a fixed
    // `America/New_York` regardless of the event's own real Jakarta venue -- the raw "10:00:00"
    // wall-clock digits (authored relative to Jakarta) get constructed as if they were 10:00 IN
    // New York, not converted from Jakarta to New York (there is no Jakarta information here at
    // all for this card to convert FROM -- see the known-gap note below). That's still a real
    // product gap, but it's now at least DETERMINISTIC: constructing "10:00 America/New_York" and
    // then displaying it back in America/New_York trivially returns the same 10:00, regardless of
    // which device constructs it -- no device-dependent day/hour shift any more.
    const fromJakartaDevice = withTZ('Asia/Jakarta', () => combineDateTime('2026-10-02', '10:00:00', 'America/New_York'));
    const fromLADevice = withTZ('America/Los_Angeles', () => combineDateTime('2026-10-02', '10:00:00', 'America/New_York'));

    const displayed = displayInTimezone(fromJakartaDevice, 'America/New_York');
    expect(displayInTimezone(fromLADevice, 'America/New_York')).toBe(displayed);
    expect(displayed).toBe('2026-10-02 10:00');
  });
});

// KNOWN OPEN GAP (2026-09-29, not fixed by this pass): the masonry card's date-box has no
// per-schedule `timezone` field threaded to it at all (`EventCard.tsx` only ever receives
// `ScopedLocaleProvider`'s fixed per-locale mapping -- `America/New_York` for `/en/`, `Asia/
// Jakarta` for `/id/` -- never the actual event's own `schedule.timezone`). This session's fix
// makes that fixed display timezone finally apply CONSISTENTLY (device-independent), but an /en/
// locale viewer will still see a Jakarta-morning event's date/time shifted relative to its real
// Jakarta wall-clock time, because it's being displayed in New York's clock, not the event's own.
// Threading the schedule's real timezone through (when trustworthy -- some scraped schedules have
// clearly-wrong inferred timezones, e.g. "Europe/Paris" for a Yogyakarta venue, seen live in
// production) is a separate, larger fix than this file's scope.
