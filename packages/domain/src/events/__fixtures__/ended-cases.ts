/**
 * Shared boundary-case fixture for the "!ended" mirror requirement (Story 0.i5d, AD-20 Rule 4).
 * Imported by BOTH:
 *  - `packages/ui/src/features/events/format-event-date.test.ts` (asserts `isEventEnded`
 *    produces `expectedEnded` for each case, with `timezone: undefined` -- deliberately, see
 *    that story's Dev Notes "Timezone scope of the `!ended` mirror"), and
 *  - `apps/backend/src/schema/resolvers.test.ts` (seeds a real `schedules` row per case and
 *    asserts the new `scheduleEndedBoundary`/`notEnded` SQL condition agrees).
 *
 * Every case is deliberately self-contained (its own `now`), and all dates/times are
 * interpreted with NO timezone conversion on either side -- naive UTC-based arithmetic,
 * matching every other date literal `buildEventsQueryCondition.ts` already produces.
 */
export interface EndedCaseFixture {
  description: string;
  startDate: string;
  startTime: string | null;
  endDate: string | null;
  endTime: string | null;
  now: string;
  expectedEnded: boolean;
}

export const ENDED_CASE_FIXTURES: EndedCaseFixture[] = [
  {
    description: 'no endTime, endDate present = today -> not ended (no time boundary to cross)',
    startDate: '2026-06-10',
    startTime: null,
    endDate: '2026-06-15',
    endTime: null,
    now: '2026-06-15T12:00:00Z',
    expectedEnded: false,
  },
  {
    description: 'no endTime, endDate present = yesterday -> ended',
    startDate: '2026-06-10',
    startTime: null,
    endDate: '2026-06-14',
    endTime: null,
    now: '2026-06-15T12:00:00Z',
    expectedEnded: true,
  },
  {
    description: 'no endTime, endDate present = tomorrow -> not ended',
    startDate: '2026-06-10',
    startTime: null,
    endDate: '2026-06-16',
    endTime: null,
    now: '2026-06-15T12:00:00Z',
    expectedEnded: false,
  },
  {
    description: 'no endTime, endDate absent (falls back to startDate) = today -> not ended',
    startDate: '2026-06-15',
    startTime: null,
    endDate: null,
    endTime: null,
    now: '2026-06-15T12:00:00Z',
    expectedEnded: false,
  },
  {
    description: 'no endTime, endDate absent (falls back to startDate) = yesterday -> ended',
    startDate: '2026-06-14',
    startTime: null,
    endDate: null,
    endTime: null,
    now: '2026-06-15T12:00:00Z',
    expectedEnded: true,
  },
  {
    description: 'endTime present, endDate today, now BEFORE the combined end instant -> not ended',
    startDate: '2026-06-15',
    startTime: '09:00:00',
    endDate: '2026-06-15',
    endTime: '18:00:00',
    now: '2026-06-15T12:00:00Z',
    expectedEnded: false,
  },
  {
    description: 'endTime present, endDate today, now EXACTLY AT the combined end instant -> ended',
    startDate: '2026-06-15',
    startTime: '09:00:00',
    endDate: '2026-06-15',
    endTime: '18:00:00',
    now: '2026-06-15T18:00:00Z',
    expectedEnded: true,
  },
  {
    description: 'endTime present, endDate today, now AFTER the combined end instant -> ended',
    startDate: '2026-06-15',
    startTime: '09:00:00',
    endDate: '2026-06-15',
    endTime: '18:00:00',
    now: '2026-06-15T19:00:00Z',
    expectedEnded: true,
  },
  {
    description: 'effective end date more than one day in the past -> ended',
    startDate: '2026-06-08',
    startTime: null,
    endDate: '2026-06-10',
    endTime: null,
    now: '2026-06-15T12:00:00Z',
    expectedEnded: true,
  },
  {
    description: 'effective end date more than one day in the future -> not ended',
    startDate: '2026-06-18',
    startTime: null,
    endDate: '2026-06-20',
    endTime: null,
    now: '2026-06-15T12:00:00Z',
    expectedEnded: false,
  },
];
