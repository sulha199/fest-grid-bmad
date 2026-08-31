import { GetEventBySlugQuery } from '@/generated/graphql';
import { EventDetailViewProps, ScheduleDetail, EventDetailViewLabels } from '@festgrid/ui';
import { useTranslations } from 'next-intl';
import { getPlatformSlug } from '@festgrid/domain/scraper';

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
    postedByLabel: t('postedByLabel'),
    viewOriginalPostLabel: t('viewOriginalPostLabel'),
    viewSourceLabel: t('viewSourceLabel'),
    addToCalendarDialogTitle: t('addToCalendarDialogTitle'),
    addToCalendarConfirmLabel: t('addToCalendarConfirmLabel'),
    addToCalendarCancelLabel: t('addToCalendarCancelLabel'),
    timezoneClarificationLabel: t('timezoneClarificationLabel'),
    timezoneSelectLabel: t('timezoneSelectLabel'),
    timezoneSelectPlaceholder: t('timezoneSelectPlaceholder'),
    timezoneSubmitLabel: t('timezoneSubmitLabel'),
    timezoneSubmitSuccessAnnouncement: t('timezoneSubmitSuccessAnnouncement'),
    timezoneSubmitErrorAnnouncement: t('timezoneSubmitErrorAnnouncement'),
    moreActionsButtonLabel: t('moreActionsButtonLabel'),
    correctDataMenuItemLabel: t('correctDataMenuItemLabel'),
    reportMenuItemLabel: t('reportMenuItemLabel'),
  };
}

export function mapGraphQLEventToDetailViewProps(
  event: NonNullable<GetEventBySlugQuery['eventBySlug']>,
  labels: EventDetailViewLabels,
  locale: string,
  tType: (key: string) => string,
  tCategory: (key: string) => string
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
      id: s.id,
      eventStartDate: s.eventStartDate,
      eventEndDate: s.eventEndDate,
      eventStartTime: s.eventStartTime,
      eventEndTime: s.eventEndTime,
      timezone: s.timezone,
      timezoneStatus: s.timezoneStatus,
      title: s.title ?? null,
      performers: s.performers?.join(', ') || null,
      location: s.location?.trim() ? s.location : null,
      ticketPrice: s.ticketPrice,
      mapUrl,
      isAddedToCalendar: !!s.isAddedToCalendar,
    };
  });

  const mappedTypes = (event.types || []).map((t) => {
    try {
      return tType(t);
    } catch {
      return t;
    }
  });

  const mappedCategories = (event.categories || []).map((c) => {
    try {
      return tCategory(c);
    } catch {
      return c;
    }
  });

  return {
    eventName: event.eventName,
    description: event.description,
    schedules: mappedSchedules,
    location: event.location || '',
    types: mappedTypes,
    categories: mappedCategories,
    imageUrl: event.imageUrl,
    imageFallbackUrl: event.durableImageUrl,
    imageAlt: event.eventName,
    videoUrl: event.videoUrl,
    videoAlt: event.eventName,
    originalPostUrl: event.originalPostUrl,
    sourcePostUrl: event.sourcePostUrl,
    isFavorited: event.isFavorited,
    isAddedToCalendar: mappedSchedules.some((s) => s.isAddedToCalendar),
    accountName: event.sourceSocialMediaAccountProfile?.displayName ?? null,
    accountUsername: event.sourceSocialMediaAccountProfile?.username ?? null,
    accountPlatform: event.sourceSocialMediaAccountProfile?.platform ?? null,
    accountId: event.sourceSocialMediaAccountProfile?.accountId ?? null,
    accountPlatformIconUrl: event.sourceSocialMediaAccountProfile?.profileImageUrl ?? null,
    accountHref: event.sourceSocialMediaAccountProfile
      ? `/${getPlatformSlug(event.sourceSocialMediaAccountProfile.platform as any)}/${event.sourceSocialMediaAccountProfile.accountId}`
      : null,
    locale,
    labels,
  };
}
