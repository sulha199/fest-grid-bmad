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
    const combined = withTZ('America/Los_Angeles', () => combineDateTime('2026-10-02', '07:00:00'));
    expect(combined.getFullYear()).toBe(2026);
    expect(combined.getMonth()).toBe(9); // October, 0-indexed
    expect(combined.getDate()).toBe(2);
    expect(combined.getHours()).toBe(7);
  });

  it('stays correct on a device timezone east of UTC too (Jakarta itself)', () => {
    const combined = withTZ('Asia/Jakarta', () => combineDateTime('2026-10-02', '07:00:00'));
    expect(combined.getFullYear()).toBe(2026);
    expect(combined.getMonth()).toBe(9);
    expect(combined.getDate()).toBe(2);
    expect(combined.getHours()).toBe(7);
  });

  it("still combines a real Date object with a time-of-day using the Date object's own local getters", () => {
    // Non-string input is unaffected by the fix -- its components already reflect whatever
    // local context constructed it, nothing to re-derive from a raw string.
    const combined = withTZ('America/Los_Angeles', () => combineDateTime(new Date(2026, 9, 2), '07:00:00'));
    expect(combined.getFullYear()).toBe(2026);
    expect(combined.getMonth()).toBe(9);
    expect(combined.getDate()).toBe(2);
    expect(combined.getHours()).toBe(7);
  });

  it('leaves the no-timeStr passthrough as the unmodified UTC-parsed instant (never buggy, must stay that way)', () => {
    const combined = withTZ('America/Los_Angeles', () => combineDateTime('2026-10-02'));
    expect(combined.getTime()).toBe(new Date('2026-10-02').getTime());
  });
});
