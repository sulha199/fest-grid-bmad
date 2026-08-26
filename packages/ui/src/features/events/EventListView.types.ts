import { ReactNode } from 'react';
import { EventCardLabels, EventCardProps } from './EventCard.types';

export interface EventListViewScheduleShape {
  isMainSchedule: boolean;
  eventStartDate: string;
  ticketPrice?: string | number | null;
}

export interface EventListViewItem {
  id: string;
  slug: string;
  eventName: string;
  imageUrl?: string | null;
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
  loadingMoreLabel: string;
  skeletonCount?: number; // default 6
  className?: string;
  viewMode?: 'list' | 'masonry';
}
