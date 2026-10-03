import type { GeminiEventPayload } from './types.js';

/**
 * Story 3.6o / Architecture Spine AD-28 Rule 2 -- computes the latest schedule end across a
 * post's (post-truncation) extracted events, for comparison against posts.imageUrlExpiresAt.
 * Pure, framework-agnostic: operates only on the already-parsed Gemini response shape, no
 * DB/Node dependency -- correctly placed in packages/domain per project-context.md's Code
 * Organization rule.
 *
 * Per schedule: end = eventEndDate ?? eventStartDate (date-only fallback, per AD-28 Rule 2's
 * literal text), combined with eventEndTime if present, else end-of-day ('23:59:59') -- a
 * schedule with no explicit end time is treated as lasting through the end of its last day,
 * the conservative (never-under-counts) choice. The combined string is interpreted as a
 * literal UTC instant (a trailing 'Z' is appended) rather than resolving each schedule's own
 * IANA timezone: this is a one-time, build-time *optimization* gate (AD-28 Rule 2
 * distinguishes it from a user-facing runtime visibility check), so the bounded imprecision
 * this introduces (at most the true timezone's UTC offset) only affects how much compute/
 * storage the gate saves -- it can never cause a privacy leak, since the original hotlinked
 * image (never blurred either way) is what is actually served until imageUrlExpiresAt passes,
 * regardless of this gate's outcome.
 *
 * A malformed/unparseable date-time string is skipped (does not throw, does not count toward
 * the max) rather than failing the whole computation -- Gemini's response is only
 * AJV-validated as `type: 'string'` with no date-format constraint
 * (extracted-event.schema.ts), so defensively tolerating garbage here matches this codebase's
 * established "best-effort, never let a logging/optimization concern break the pipeline"
 * convention (e.g. rehostPostImageSeam's outer try/catch, Story 3.6l's completeness
 * warnings).
 *
 * Returns null when no event has any schedule with a parseable end (including an empty
 * `events` array) -- callers must treat null as "unknown," never as "ends immediately": 3.6o's
 * own comparison fails open on null (an unknown end always means the pipeline runs, never
 * skips -- AC3).
 */
export function computeLatestScheduleEnd(events: GeminiEventPayload[]): Date | null {
  let latest: Date | null = null;

  for (const event of events) {
    for (const schedule of event.schedules) {
      const endDate = schedule.eventEndDate ?? schedule.eventStartDate;
      const endTime = schedule.eventEndTime ?? '23:59:59';
      const candidate = new Date(`${endDate}T${endTime}Z`);

      if (Number.isNaN(candidate.getTime())) {
        continue;
      }

      if (latest === null || candidate > latest) {
        latest = candidate;
      }
    }
  }

  return latest;
}
