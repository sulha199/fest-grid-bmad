/**
 * Represents the details of a single schedule for an event.
 * All fields are optional except for the start date.
 */
export interface ScheduleDetail {
  id: string;
  eventStartDate: string;
  eventEndDate?: string | null;
  eventStartTime?: string | null;
  eventEndTime?: string | null;
  title?: string | null;
  performers?: string | null;
  location?: string | null;
  ticketPrice?: string | null;
  mapUrl?: string | null;
  isAddedToCalendar?: boolean;
}

/**
 * Override labels for internal microcopy.
 * Allows localization (e.g. via next-intl) without coupling the component to a framework.
 */
export interface EventDetailViewLabels {
  loadingText: string;
  errorText: string;
  locationLabel: string;
  performersLabel: string;
  ticketPriceLabel: string;
  noSchedulesLabel: string;
  defaultScheduleTitle: string;
  favoriteButtonLabel: string;
  removeFavoriteButtonLabel: string;
  addToCalendarButtonLabel: string;
  postedByLabel: string;
  viewOriginalPostLabel: string;
  viewSourceLabel: string;
  addToCalendarDialogTitle: string;
  addToCalendarConfirmLabel: string;
  addToCalendarCancelLabel: string;
  scheduleCheckboxLabel?: string;
  moreActionsButtonLabel: string;
  correctDataMenuItemLabel: string;
}

/**
 * Props for the EventDetailView component.
 * This is a presentation-only component designed to display event details.
 * It does not fetch data or know about its environment (modal vs full page).
 */
export interface EventDetailViewProps {
  // Base data
  eventName: string;
  description?: string | null;
  schedules: ScheduleDetail[];
  location: string;
  
  // Optional meta
  types?: string[];
  categories?: string[];
  imageUrl?: string | null;
  imageAlt?: string | null;

  // External URLs (AC15, AC16)
  originalPostUrl?: string | null;
  sourcePostUrl?: string | null;
  accountName?: string | null;
  accountPlatformIconUrl?: string | null;
  accountHref?: string | null;

  // State overrides
  loading?: boolean;
  error?: { message: string } | null;

  // Render options
  locale?: string;
  labels: EventDetailViewLabels;

  // Handlers (AC11)
  isFavorited?: boolean;
  onFavoriteToggle?: () => void;
  
  isAuthenticated?: boolean;
  isAddedToCalendar?: boolean;
  onAddToCalendar?: (selectedScheduleIds: string[]) => void;
  onCorrectData?: () => void;
}
