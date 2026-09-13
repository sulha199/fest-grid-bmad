export interface WeeklyCalendarViewScheduleShape {
  id: string;
  eventSlug: string;
  eventName: string;
  isMainSchedule: boolean;
  eventStartDate: string;   // ISO date
  eventEndDate?: string | null;
  eventStartTime?: string | null;
  eventEndTime?: string | null;
  isFavorited?: boolean;
  isAddedToCalendar?: boolean;
  favoriteCount?: number;
  /** Parent event's id, mapped from the already-fetched `event.id` (Story 1.i1d AC3/AC7). */
  eventId?: string;
  /** Parent event's poster image URL, mapped from the already-fetched `event.imageUrl` (Story 1.i1d AC1/AC2). */
  imageUrl?: string;
}

export interface WeeklyCalendarViewLabels {
  /** aria-label for the previous-week navigation button */
  prevWeekLabel?: string;
  /** aria-label for the next-week navigation button */
  nextWeekLabel?: string;
  /** "Today" button label */
  todayLabel?: string;
  /** aria-label for the week selection trigger */
  selectWeekLabel?: string;
  /** aria-label for the date input or popover calendar */
  chooseWeekLabel?: string;
  /** aria-label for the favorited badge */
  favoritedBadgeLabel?: string;
  /** aria-label for the added to calendar badge */
  addedToCalendarBadgeLabel?: string;
  /** aria-label for the expand day button */
  expandDayLabel?: string;
  /** aria-label for the collapse day button */
  collapseDayLabel?: string;
  /**
   * "+N more" affordance text, invoked once per over-capacity day cell with
   * that day's own hidden-schedule count. A resolver FUNCTION, not a static
   * string, because the count is only known after this component's own
   * per-day capping logic runs — the caller (Story 1.3f's `CalendarView`)
   * wraps its next-intl ICU-plural message: `(count) => t('calendarMoreLabel', { count })`.
   * Falls back to a plain `+${count} more` if omitted.
   */
  moreLabel?: (count: number) => string;
  /**
   * Mobile list-view segment text for multi-day schedules, showing the day number and total days.
   * A resolver FUNCTION, not a static string, because the day offset and total days are only known
   * after this component's own day-segment logic runs — the caller (Story 1.3f's `CalendarView`)
   * wraps its next-intl translation message: `(dayNumber, totalDays) => t('calendarMultiDaySegmentLabel', { dayNumber, totalDays })`.
   * Falls back to `Day ${dayNumber} of ${totalDays}` if omitted.
   */
  multiDaySegmentLabel?: (dayNumber: number, totalDays: number) => string;
  /** aria-label for the "+N more" popover's dismiss control */
  closePopoverLabel?: string;
  /** Shown while `status === 'loading'` (aria-label on the skeleton grid) */
  loadingText?: string;
  /** Prefix text for the list-variant date box's till/end content (default "till", AC4/AC9). */
  tillLabel?: string;
  /** Accessible name for the list-variant thumbnail's favorite-toggle badge (default "Toggle favorite", AC3/AC9). */
  favoriteToggleLabel?: string;
}

export interface WeeklyCalendarViewProps<TSchedule extends WeeklyCalendarViewScheduleShape = WeeklyCalendarViewScheduleShape> {
  weekStart: Date | string;
  schedules: TSchedule[];
  /** Positive integer, or -1 for unlimited (matching DESIGN.md's discovery_view/personal_view split) */
  maxEventsPerDay: number;
  getWeekRange?: (date: Date) => { start: Date; end: Date };
  onToday: () => void;
  onPrevWeek: () => void;
  /** Disables the "Previous week" control — the calendar never navigates further into the past than today's week. */
  isPrevWeekDisabled?: boolean;
  onNextWeek: () => void;
  onSelectWeek?: (date: string) => void;
  onScheduleClick: (schedule: TSchedule) => void;
  /** Optional: fired with the exact schedule when its thumbnail favorite badge is toggled (AC3/AC7). */
  onFavoriteToggle?: (schedule: TSchedule) => void;
  status: 'loading' | 'error' | 'success';
  errorMessage?: string;
  errorDetail?: string;
  /** Optional explicit locale/timezone override — falls back to ScopedLocaleProvider context, matching EventCard */
  locale?: string;
  timezone?: string;
  labels?: WeeklyCalendarViewLabels;
  className?: string;
}
