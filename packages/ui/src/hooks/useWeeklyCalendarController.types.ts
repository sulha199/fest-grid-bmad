export interface WeeklyCalendarControllerOptions<TEvent = any> {
  week: string;
  setWeek: (week: string) => void | Promise<void>;
  todayStr: string;
  rawEvents: TEvent[] | null | undefined;
  queryStatus: 'pending' | 'success' | 'error' | string;
  queryError: any;
  onNavigate?: (direction: 'previous' | 'next' | 'today' | 'select', newWeek: string) => void;
  errorStateLabel?: string;
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
