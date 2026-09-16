import { EventLink } from '@festgrid/shared-types';

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
  timezone?: string | null;
  timezoneStatus?: 'RESOLVED' | 'NEEDS_CLARIFICATION' | null;
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
  viewOriginalPostLabel: string;
  viewSourceLabel: string;
  addToCalendarDialogTitle: string;
  addToCalendarConfirmLabel: string;
  addToCalendarCancelLabel: string;
  scheduleCheckboxLabel?: string;
  subscribeButtonLabel?: string;
  unsubscribeButtonLabel?: string;
  checkingSubscriptionLabel?: string;
  unknownAccountLabel?: string;
  unsubscribeSuccessAnnouncement?: string;
  unsubscribeErrorAnnouncement?: string;
  moreActionsButtonLabel: string;
  correctDataMenuItemLabel: string;
  reportMenuItemLabel?: string;
  timezoneClarificationLabel: string;
  timezoneSelectLabel: string;
  timezoneSelectPlaceholder: string;
  timezoneSubmitLabel: string;
  timezoneSubmitSuccessAnnouncement: string;
  timezoneSubmitErrorAnnouncement: string;
  videoUnavailableLabel?: string;
  privateContactMessageLabel: string;
  contentNoLongerAvailableLabel?: string;
  embedLoadingLabel?: string;
  embedRegionLabel?: string;
  publishedLabel: string;
  today?: string;
  tomorrow?: string;
  yesterday?: string;
  categoriesAndTypesAriaLabel: string;
}

/**
 * A category/type badge value paired with its already-translated display label
 * (Story 1.6f) -- the raw enum value drives navigation (e.g. Discovery's
 * `?categories=<value>` filter), the label is what renders.
 */
export interface EventDetailViewTagOption {
  value: string;
  label: string;
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
  types?: EventDetailViewTagOption[];
  categories?: EventDetailViewTagOption[];
  onTypeClick?: (value: string) => void;
  onCategoryClick?: (value: string) => void;
  imageUrl?: string | null;
  imageAlt?: string | null;
  videoUrl?: string | null;
  videoAlt?: string | null;
  imageFallbackUrl?: string | null;

  // Instagram oEmbed transition (Story 3.7d/3.7e)
  instagramEmbedStatus?: 'AVAILABLE' | 'UNAVAILABLE' | null;
  instagramEmbedHtml?: string | null;
  instagramEmbedDurableImageUrl?: string | null;

  // External URLs (AC15, AC16)
  originalPostUrl?: string | null;
  sourcePostUrl?: string | null;
  publishedAt?: string | null;

  // Contact info (Story 3.6i)
  contactInfo?: string | null;
  hasPrivateContact?: boolean | null;

  // Additional links (Story 0.37)
  links?: EventLink[] | null;
  accountName?: string | null;
  accountUsername?: string | null;
  accountPlatform?: string | null;
  accountId?: string | null;
  accountPlatformIconUrl?: string | null;
  accountHref?: string | null;
  isSubscribedToAccount?: boolean;
  onSubscribeToAccount?: () => void;
  isSubscribingToAccount?: boolean;
  isSubscriptionStatusLoading?: boolean;
  onUnsubscribeFromAccount?: () => void;
  isUnsubscribingFromAccount?: boolean;

  // State overrides
  loading?: boolean;
  error?: { message: string } | null;

  // Render options
  locale?: string;
  labels: EventDetailViewLabels;

  // Handlers (AC11)
  isFavorited?: boolean;
  favoriteCount?: number;
  onFavoriteToggle?: () => void;

  isAuthenticated?: boolean;
  isAddedToCalendar?: boolean;
  onAddToCalendar?: (selectedScheduleIds: string[]) => void | Promise<void>;
  onResolveScheduleTimezone?: (scheduleId: string, timezone: string) => void;
  onCorrectData?: () => void;
  onReport?: () => void;
}
