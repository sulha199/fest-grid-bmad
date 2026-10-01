export interface WeeklyCalendarControllerOptions<TEvent = any> {
  week: string;
  setWeek: (week: string) => void | Promise<void>;
  todayStr: string;
  rawEvents: TEvent[] | null | undefined;
  queryStatus: 'pending' | 'success' | 'error' | string;
  queryError: any;
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

export interface WeeklyCalendarControllerResult<TSchedule = any> {
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
