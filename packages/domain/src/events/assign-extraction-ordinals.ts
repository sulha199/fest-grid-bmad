import { ExtractedEventMessage } from './types.js';

/**
 * Story 3.6t (AC7) — deterministic extraction-ordinal assignment, decided with the user via
 * `AskUserQuestion` during this story's creation. Given the same *set* of extracted events, a
 * re-extraction (the model's own response order is not stable between calls) must assign the
 * same ordinals, so ordinal assignment is sorted by data, never by raw model-response order.
 *
 * Sort key (in priority order):
 *   1. Each event's earliest `eventStartDate` across its own `schedules` (lexicographic string
 *      compare — fixtures confirm `YYYY-MM-DD`, safe to compare as strings). An event with an
 *      empty `schedules` array has no date and sorts last.
 *   2. The event's normalized name (`trim().toLowerCase()`, internal whitespace runs collapsed
 *      to one space), compared via `localeCompare`.
 *   3. The event's original (pre-sort) index in the input array — the final, stable tiebreak.
 *
 * Returns NEW objects (`{ ...message, extractionOrdinal }`), does not mutate the input array or
 * its elements, matching `buildEventInsertValues`'s own return-new-objects convention.
 *
 * Explicit limit (documented in this story's Dev Notes, not solved here): this guarantees
 * ordinal stability only when the *set* of events is unchanged across re-extractions. A
 * re-extraction that returns a different set of events (e.g. truncation keeping a different
 * model-order prefix) can still re-pair an old ordinal with a semantically different event.
 */
export function assignExtractionOrdinals(eventMessages: ExtractedEventMessage[]): ExtractedEventMessage[] {
  const withOriginalIndex = eventMessages.map((message, originalIndex) => ({ message, originalIndex }));

  withOriginalIndex.sort((a, b) => {
    const dateCompare = compareEarliestScheduleDate(a.message, b.message);
    if (dateCompare !== 0) {
      return dateCompare;
    }

    const nameCompare = normalizeEventName(a.message.eventName).localeCompare(normalizeEventName(b.message.eventName));
    if (nameCompare !== 0) {
      return nameCompare;
    }

    return a.originalIndex - b.originalIndex;
  });

  return withOriginalIndex.map(({ message }, ordinal) => ({ ...message, extractionOrdinal: ordinal }));
}

function normalizeEventName(eventName: string): string {
  return eventName.trim().toLowerCase().replace(/\s+/g, ' ');
}

// An event's earliest schedule start date, or undefined when it has no schedules at all
// ("no date", sorts last).
function earliestScheduleDate(message: ExtractedEventMessage): string | undefined {
  if (!message.schedules || message.schedules.length === 0) {
    return undefined;
  }

  let earliest: string | undefined;
  for (const schedule of message.schedules) {
    if (earliest === undefined || schedule.eventStartDate < earliest) {
      earliest = schedule.eventStartDate;
    }
  }
  return earliest;
}

function compareEarliestScheduleDate(a: ExtractedEventMessage, b: ExtractedEventMessage): number {
  const dateA = earliestScheduleDate(a);
  const dateB = earliestScheduleDate(b);

  if (dateA === undefined && dateB === undefined) {
    return 0;
  }
  if (dateA === undefined) {
    return 1; // no date sorts last
  }
  if (dateB === undefined) {
    return -1;
  }
  return dateA < dateB ? -1 : dateA > dateB ? 1 : 0;
}
