import { GetEventBySlugQuery } from '@/generated/graphql';
import { EventDetailViewProps, ScheduleDetail, EventDetailViewLabels } from '@festgrid/ui';
import { useTranslations } from 'next-intl';

export function useEventDetailViewLabels(): EventDetailViewLabels {
  const t = useTranslations('EventDetailsPage');
  return {
    loadingText: t('loadingText'),
    errorText: t('errorText'),
    locationLabel: t('locationLabel'),
    performersLabel: t('performersLabel'),
    ticketPriceLabel: t('ticketPriceLabel'),
    noSchedulesLabel: t('noSchedulesLabel'),
    defaultScheduleTitle: t('defaultScheduleTitle'),
    favoriteButtonLabel: t('favoriteButtonLabel'),
    removeFavoriteButtonLabel: t('removeFavoriteButtonLabel'),
    addToCalendarButtonLabel: t('addToCalendarButtonLabel'),
  };
}

export function mapGraphQLEventToDetailViewProps(
  event: NonNullable<GetEventBySlugQuery['eventBySlug']>,
  labels: EventDetailViewLabels,
  locale: string
): Omit<EventDetailViewProps, 'labels'> & { labels: EventDetailViewLabels } {
  const mappedSchedules: ScheduleDetail[] = (event.schedules || []).map((s) => {
    let mapUrl: string | null = null;
    if (s.locationDetails?.coordinates) {
      const { lat, lng } = s.locationDetails.coordinates;
      mapUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    } else if (s.location) {
      mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.location)}`;
    }

    return {
      eventStartDate: s.eventStartDate,
      eventEndDate: s.eventEndDate,
      eventStartTime: s.eventStartTime,
      eventEndTime: s.eventEndTime,
      title: null,
      performers: s.performers?.join(', ') || null,
      location: s.location,
      ticketPrice: s.ticketPrice,
      mapUrl,
    };
  });

  return {
    eventName: event.eventName,
    description: event.description,
    schedules: mappedSchedules,
    location: event.location || '',
    types: event.types || [],
    categories: event.categories || [],
    imageUrl: event.imageUrl,
    imageAlt: event.eventName,
    originalPostUrl: event.originalPostUrl,
    sourcePostUrl: event.sourcePostUrl,
    locale,
    labels,
  };
}
