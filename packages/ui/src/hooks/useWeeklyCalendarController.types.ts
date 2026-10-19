import type { WeeklyCalendarViewScheduleShape } from '../features/events/WeeklyCalendarView.types';

/**
 * The fields `mapCalendarSchedules` reads off each source event / schedule. Deliberately loose
 * (all optional, nullable) because the callers' GraphQL-generated `Event` types vary per query;
 * the mapper only forwards whatever is present.
 */
export interface CalendarSourceSchedule {
  id: string;
  isMainSchedule?: boolean;
  eventStartDate: string;
  eventEndDate?: string | null;
  eventStartTime?: string | null;
  eventEndTime?: string | null;
  isAddedToCalendar?: boolean | null;
  applicableDaysOfWeek?: unknown;
  timezone?: string | null;
  timezoneStatus?: string | null;
  locationDetails?: { coordinates?: { lat: number; lng: number } | null } | null;
}

export interface CalendarSourceEvent {
  id?: string;
  slug?: string;
  eventName?: string;
  isFavorited?: boolean | null;
  favoriteCount?: number;
  imageUrl?: string | null;
  durableImageUrl?: string | null;
  location?: string | null;
  schedules?: CalendarSourceSchedule[] | null;
}

export interface WeeklyCalendarControllerOptions<TEvent = CalendarSourceEvent> {
  week: string;
  setWeek: (week: string) => void | Promise<void>;
  todayStr: string;
  rawEvents: TEvent[] | null | undefined;
  queryStatus: 'pending' | 'success' | 'error' | string;
  queryError: unknown;
  onNavigate?: (direction: 'previous' | 'next' | 'today' | 'select', newWeek: string) => void;
  errorStateLabel?: string;
  /**
   * Story 1.i1f AC13-14: the viewer's coordinate for computing each schedule's
   * `distanceKm` (currently only the active nearby-filter's resolved coordinate,
   * per Architecture Spine AD-22 — see `CalendarView.tsx`). Omitted entirely by
   * `FeedCalendarView.tsx`/`AccountCalendarView.tsx`/`my-calendar-content.tsx`,
   * which have no nearby-filter plumbing today; `distanceKm` simply stays
   * `undefined` for their schedules.
   */
  viewerCoord?: { latitude: number; longitude: number };
}

export interface WeeklyCalendarControllerResult<TSchedule = WeeklyCalendarViewScheduleShape> {
  weekStart: string;
  weekEnd: string;
  schedules: TSchedule[];
  status: 'loading' | 'success' | 'error' | string;
  errorMessage: string;
  errorDetail: string | undefined;
  handlePrevWeek: () => void;
  handleNextWeek: () => void;
  handleSelectWeek: (dateStr: string) => void;
  handleToday: () => void;
  /** True when the currently-displayed week is today's week (or earlier) — the calendar never navigates further into the past. */
  isPrevWeekDisabled: boolean;
}
