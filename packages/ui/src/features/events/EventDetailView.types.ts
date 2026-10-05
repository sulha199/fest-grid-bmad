import type { Ref } from 'react';
import { EventLink } from '@festgrid/shared-types';
import type { DayOfWeek as DomainDayOfWeek } from '@festgrid/domain/events';

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
  locationDetails?: {
    coordinates?: { lat: number; lng: number } | null;
    confidence?: number | null;
    matchType?: string | null;
  } | null;
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
  coauthorsListAriaLabel?: string;

  // Multi-post Source Posts list + Related Events (Story 3.6u, AC5/AC6/AC8)
  /** Non-positional a11y cue on the one entry whose `isPrimary` is `true` (EXPERIENCE.md §1 accessibility-lens addendum). */
  sourcePostsPrimaryLabel?: string;
  /** Template resolver for the "See all N events" link beyond the first 5 inline cards -- a resolver function (matching `EventCardCompactProps.nearbyBadgeLabel`'s convention) rather than a plain string, since `packages/ui` has no next-intl/ICU interpolation of its own. */
  relatedEventsSeeAllLabel?: (count: number) => string;
  /** `aria-label` for the Related Events section's wrapper region. */
  relatedEventsSectionAriaLabel?: string;
}

/**
 * A single coauthor of the event's post (Story 0.i6g), rendered below the
 * existing original-post attribution link as its own SubscribedAccountCard row.
 */
export interface EventDetailViewCoauthor {
  accountId: string;
  platform?: string | null;
  displayName?: string | null;
  username?: string | null;
  profileImageUrl?: string | null;
  accountHref?: string | null;
  isSubscribed: boolean;
  isTogglePending: boolean;
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
 * A single post linked to this event (Story 3.6u, AD-30 Rule 11) -- every entry including the
 * primary one, primary-first-then-link-order (the order the caller must already supply this
 * array in; `EventDetailView` renders it as-given, it does not re-sort). Supersedes the flat
 * `EventDetailViewCoauthor[]`/Attributions data path once `sourcePosts.length > 1` (AC4/AC5,
 * Design Decision #1) -- `coauthors` on each entry here, never the flat `coauthors` prop, is
 * read for the multi-post branch, including for the primary entry.
 */
export interface EventDetailViewSourcePost {
  postId: string;
  isPrimary: boolean;
  groupingReason?: string | null;
  extractedEventCount?: number | null;
  postedAt?: string | null;
  sourcePostUrl?: string | null;
  originalPostUrl?: string | null;
  account?: {
    accountId: string;
    platform?: string | null;
    username?: string | null;
    displayName?: string | null;
    profileImageUrl?: string | null;
    accountHref?: string | null;
  } | null;
  coauthors: EventDetailViewCoauthor[];
}

/**
 * One event rendered inline inside a Related Events group as an `EventCardCompact` (Story
 * 3.6ua). Deliberately flat/raw (eventStartDate/eventEndDate/eventStartTime/eventEndTime,
 * isMainSchedule) rather than pre-computed date-box strings -- `EventDetailView` itself computes
 * the date box via the existing, unchanged `computeCalendarSegmentDateBoxContent`, passing
 * TODAY's date as `currentDayStr` (this is not a calendar surface, so there is no "current
 * visible day" to use instead -- see the story's Dev Notes/orchestrator guidance).
 */
export interface EventDetailViewRelatedEvent {
  id: string;
  slug: string;
  eventName: string;
  locationName?: string | null;
  imageUrl?: string | null;
  imageFallbackUrl?: string | null;
  isFavorited?: boolean;
  favoriteCount?: number;
  isAddedToCalendar?: boolean;
  isMainSchedule: boolean;
  eventStartDate: string;
  eventStartTime?: string | null;
  eventEndDate?: string | null;
  eventEndTime?: string | null;
  applicableDaysOfWeek?: DomainDayOfWeek[] | null;
}

/**
 * One Related Events group (Story 3.6u, AC6) -- one per post this event shares with other
 * events. `accountLabel` (the group heading) arrives already-resolved: the caller interpolates the
 * post-title template (`Events from {title}`) from `sourcePosts[].title`, falling back to the
 * account-name template when the post has no title -- never a second account fetch; `EventDetailView` just
 * renders it verbatim, since it has no next-intl/ICU interpolation of its own.
 */
export interface EventDetailViewRelatedEventGroup {
  postId: string;
  accountLabel: string;
  events: EventDetailViewRelatedEvent[];
  totalCount: number;
  seeAllHref?: string | null;
  isLoading?: boolean;
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
  accountLocation?: {
    name: string;
    coordinates?: { lat: number; lng: number } | null;
    confidence?: number | null;
    matchType?: string | null;
  } | null;
  isSubscribedToAccount?: boolean;
  onSubscribeToAccount?: () => void;
  isSubscribingToAccount?: boolean;
  isSubscriptionStatusLoading?: boolean;
  onUnsubscribeFromAccount?: () => void;
  isUnsubscribingFromAccount?: boolean;

  // Coauthor attribution (Story 0.i6g)
  coauthors?: EventDetailViewCoauthor[];
  onSubscribeToCoauthor?: (accountId: string) => void;
  onUnsubscribeFromCoauthor?: (accountId: string) => void;

  // Multi-post Source Posts list (Story 3.6u, AC1/AC4/AC5). `sourcePosts.length > 1` gates the
  // new per-post rendering branch; `<= 1` (or absent) keeps today's single-post Attributions +
  // flat-`coauthors` branch completely unchanged (AC4, Design Decision #1).
  sourcePosts?: EventDetailViewSourcePost[];

  // Related Events (Story 3.6u, AC6). `relatedEventsSentinelRef` is attached to the section's
  // own wrapper div so the caller's `useVisibleOnce` sentinel can observe it; the section fires
  // `isLoading`/skeleton rendering per-group rather than one global spinner, so a group that has
  // already resolved can render immediately even while a sibling group (if this ever becomes
  // possible) is still pending.
  relatedEventGroups?: EventDetailViewRelatedEventGroup[];
  isRelatedEventsLoading?: boolean;
  relatedEventsSentinelRef?: Ref<HTMLDivElement>;
  onRelatedEventClick?: (event: EventDetailViewRelatedEvent) => void;

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
