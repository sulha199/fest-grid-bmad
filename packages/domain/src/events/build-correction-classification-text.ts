import type { ProposedEventCorrection } from './types.js';

/**
 * Concatenates the free-text fields of a UGC correction submission that a
 * kids'-event keyword could plausibly appear in (Story 3.6k, AC2):
 * `eventName`, `description`, and each schedule's `title`/`location`.
 *
 * Kept as its own small pure function -- not inlined into the resolver --
 * so the "what counts as this correction's classifiable text" decision is
 * independently unit-tested and reusable.
 */
export function buildCorrectionClassificationText(data: ProposedEventCorrection): string {
  const parts: string[] = [data.eventName];

  if (data.description) {
    parts.push(data.description);
  }

  for (const schedule of data.schedules) {
    if (schedule.title) {
      parts.push(schedule.title);
    }
    if (schedule.location) {
      parts.push(schedule.location);
    }
  }

  return parts.join(' ');
}
