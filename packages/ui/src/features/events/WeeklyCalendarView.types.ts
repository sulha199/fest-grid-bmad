export interface WeeklyCalendarViewScheduleShape {
  id: string;
  eventSlug: string;
  eventName: string;
  isMainSchedule: boolean;
  eventStartDate: string;   // ISO date
  eventEndDate?: string | null;
  eventStartTime?: string | null;
  eventEndTime?: string | null;
}

export interface WeeklyCalendarViewLabels {
  /** aria-label for the previous-week navigation button */
  prevWeekLabel?: string;
  /** aria-label for the next-week navigation button */
  nextWeekLabel?: string;
  /** "Today" button label */
  todayLabel?: string;
  /**
   * "+N more" affordance text, invoked once per over-capacity day cell with
   * that day's own hidden-schedule count. A resolver FUNCTION, not a static
   * string, because the count is only known after this component's own
   * per-day capping logic runs — the caller (Story 1.3f's `CalendarView`)
   * wraps its next-intl ICU-plural message: `(count) => t('calendarMoreLabel', { count })`.
   * Falls back to a plain `+${count} more` if omitted.
   */
  moreLabel?: (count: number) => string;
  /** aria-label for the "+N more" popover's dismiss control */
  closePopoverLabel?: string;
  /** Shown while `status === 'loading'` (aria-label on the skeleton grid) */
  loadingText?: string;
}

export interface WeeklyCalendarViewProps<TSchedule extends WeeklyCalendarViewScheduleShape = WeeklyCalendarViewScheduleShape> {
  weekStart: Date | string;
  schedules: TSchedule[];
  /** Positive integer, or -1 for unlimited (matching DESIGN.md's discovery_view/personal_view split) */
  maxEventsPerDay: number;
  onToday: () => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onScheduleClick: (schedule: TSchedule) => void;
  status: 'loading' | 'error' | 'success';
  errorMessage?: string;
  errorDetail?: string;
  /** Optional explicit locale/timezone override — falls back to ScopedLocaleProvider context, matching EventCard */
  locale?: string;
  timezone?: string;
  labels?: WeeklyCalendarViewLabels;
  className?: string;
}
