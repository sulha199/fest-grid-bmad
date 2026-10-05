import { ReactNode } from 'react';
import type { DayOfWeek as DomainDayOfWeek } from '@festgrid/domain/events';
import { EventCardLabels, EventCardProps } from './EventCard.types';

export interface EventListViewScheduleShape {
  isMainSchedule: boolean;
  eventStartDate: string;
  eventStartTime?: string | null;
  eventEndDate?: string | null;
  eventEndTime?: string | null;
  ticketPrice?: string | number | null;
  locationDetails?: { coordinates?: { lat: number; lng: number } | null } | null;
  /**
   * Story 1.3k (AC6) — the weekdays this schedule actually occurs on. Already mapped to
   * `packages/domain`'s own `DayOfWeek` enum by the caller (AD-19 Rule 2/3). Unset/empty means
   * the schedule occurs on every day of its span (legacy/default behavior).
   */
  applicableDaysOfWeek?: DomainDayOfWeek[] | null;
}

export interface EventListViewItem {
  id: string;
  slug: string;
  eventName: string;
  imageUrl?: string | null;
  durableImageUrl?: string | null;
  durableThumbnailUrl?: string | null;
  location?: string | null;
  categories?: string[] | null;
  types?: string[] | null;
  schedules: EventListViewScheduleShape[];
}

export interface EventListViewProps<TEvent extends EventListViewItem> {
  status: 'loading' | 'error' | 'success';
  events: TEvent[];
  errorMessage?: string;
  errorDetail?: string;
  emptyState: ReactNode;
  getCardProps: (event: TEvent) => Partial<EventCardProps>;
  cardLabels?: EventCardLabels;
  sentinelRef: (node: Element | null) => void;
  isFetchingNextPage: boolean;
  hasNextPage?: boolean; // whether there are more pages to load (BUG-031 fix: show end-of-list indicator)
  loadingMoreLabel: string;
  skeletonCount?: number; // default 6
  className?: string;
}
