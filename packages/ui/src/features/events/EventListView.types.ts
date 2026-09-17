import { ReactNode } from 'react';
import { EventCardLabels, EventCardProps } from './EventCard.types';

export interface EventListViewScheduleShape {
  isMainSchedule: boolean;
  eventStartDate: string;
  eventStartTime?: string | null;
  eventEndDate?: string | null;
  eventEndTime?: string | null;
  ticketPrice?: string | number | null;
  locationDetails?: { coordinates?: { lat: number; lng: number } | null } | null;
}

export interface EventListViewItem {
  id: string;
  slug: string;
  eventName: string;
  imageUrl?: string | null;
  durableImageUrl?: string | null;
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
