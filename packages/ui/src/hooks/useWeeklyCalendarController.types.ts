export interface WeeklyCalendarControllerOptions<TEvent = any> {
  week: string;
  setWeek: (week: string) => void | Promise<void>;
  todayStr: string;
  rawEvents: TEvent[] | null | undefined;
  queryStatus: 'pending' | 'success' | 'error' | string;
  queryError: any;
  onNavigate?: (direction: 'previous' | 'next' | 'today', newWeek: string) => void;
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
  handleToday: () => void;
}
