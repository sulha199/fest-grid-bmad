import { GetEventBySlugQuery, GetMySubscriptionsQuery } from '@/generated/graphql';
import { EventDetailViewProps, ScheduleDetail, EventDetailViewLabels, EventDetailViewCoauthor, EventDetailViewSourcePost } from '@festgrid/ui';
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
    privateContactMessageLabel: t('privateContactMessageLabel'),
    contentNoLongerAvailableLabel: t('contentNoLongerAvailableLabel'),
    embedLoadingLabel: t('embedLoadingLabel'),
    embedRegionLabel: t('embedRegionLabel'),
    subscribeButtonLabel: t('subscribeButtonLabel'),
    unsubscribeButtonLabel: t('unsubscribeButtonLabel'),
    checkingSubscriptionLabel: t('checkingSubscriptionLabel'),
    unknownAccountLabel: t('unknownAccountLabel'),
    unsubscribeSuccessAnnouncement: t('unsubscribeSuccessAnnouncement'),
    unsubscribeErrorAnnouncement: t('unsubscribeErrorAnnouncement'),
    publishedLabel: t('publishedLabel'),
    today: t('today'),
    tomorrow: t('tomorrow'),
    yesterday: t('yesterday'),
    categoriesAndTypesAriaLabel: t('categoriesAndTypesAriaLabel'),
    coauthorsListAriaLabel: t('coauthorsListAriaLabel'),
    hashtagsListAriaLabel: t('hashtagsListAriaLabel'),
    sourcePostsPrimaryLabel: t('sourcePostsPrimaryLabel'),
    relatedEventsSeeAllLabel: (count: number) => t('relatedEventsSeeAllLabel', { count }),
    relatedEventsSectionAriaLabel: t('relatedEventsSectionAriaLabel'),
  };
}

export interface ResolvedInstagramEmbed {
  status: 'AVAILABLE' | 'UNAVAILABLE'
  html: string | null
  durableImageUrl: string | null
}

export function mapGraphQLEventToDetailViewProps(
  event: NonNullable<GetEventBySlugQuery['eventBySlug']>,
  labels: EventDetailViewLabels,
  locale: string,
  tType: (key: string) => string,
  tCategory: (key: string) => string,
  instagramEmbed?: ResolvedInstagramEmbed | null,
  mySubscriptions?: GetMySubscriptionsQuery['mySubscriptions'] | null,
  pendingCoauthorAccountId?: string | null
): Omit<EventDetailViewProps, 'labels'> & { labels: EventDetailViewLabels } {
  const mappedSchedules: ScheduleDetail[] = (event.schedules || []).map((s) => {
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
      locationDetails: s.locationDetails ?? null,
      isAddedToCalendar: !!s.isAddedToCalendar,
    };
  });

  const mappedTypes = event.types?.map((t) => ({
    value: t,
    label: (() => {
      try {
        return tType(t);
      } catch {
        return t;
      }
    })(),
  }));

  const mappedCoauthors: EventDetailViewCoauthor[] = (event.coauthors || []).map((coauthor) => ({
    accountId: coauthor.accountId,
    platform: coauthor.platform,
    displayName: coauthor.displayName,
    username: coauthor.username,
    profileImageUrl: coauthor.profileImageUrl,
    accountHref: `/${getPlatformSlug(coauthor.platform as any)}/${coauthor.accountId}`,
    isSubscribed: !!mySubscriptions?.find((s) => s.account.accountId === coauthor.accountId),
    isTogglePending: pendingCoauthorAccountId === coauthor.accountId,
  }));

  // Story 3.6u (AC1/AC2/AC5) — supersedes the flat `coauthors` field for the multi-post
  // rendering branch (Design Decision #1); every linked post, including the primary, maps its
  // own `coauthors` here rather than ever reading the flat field for that branch.
  const mappedSourcePosts: EventDetailViewSourcePost[] = (event.sourcePosts || []).map((sourcePost) => ({
    postId: sourcePost.postId,
    isPrimary: sourcePost.isPrimary,
    groupingReason: sourcePost.groupingReason,
    extractedEventCount: sourcePost.extractedEventCount,
    postedAt: sourcePost.postedAt,
    sourcePostUrl: sourcePost.sourcePostUrl,
    originalPostUrl: sourcePost.originalPostUrl,
    account: sourcePost.account
      ? {
          accountId: sourcePost.account.accountId,
          platform: sourcePost.account.platform,
          username: sourcePost.account.username,
          displayName: sourcePost.account.displayName,
          profileImageUrl: sourcePost.account.profileImageUrl,
          accountHref: `/${getPlatformSlug(sourcePost.account.platform as any)}/${sourcePost.account.accountId}`,
        }
      : null,
    coauthors: (sourcePost.coauthors || []).map((coauthor) => ({
      accountId: coauthor.accountId,
      platform: coauthor.platform,
      displayName: coauthor.displayName,
      username: coauthor.username,
      profileImageUrl: coauthor.profileImageUrl,
      accountHref: `/${getPlatformSlug(coauthor.platform as any)}/${coauthor.accountId}`,
      isSubscribed: !!mySubscriptions?.find((s) => s.account.accountId === coauthor.accountId),
      isTogglePending: pendingCoauthorAccountId === coauthor.accountId,
    })),
  }));

  const mappedCategories = event.categories?.map((c) => ({
    value: c,
    label: (() => {
      try {
        return tCategory(c);
      } catch {
        return c;
      }
    })(),
  }));

  return {
    eventName: event.eventName,
    description: event.description,
    schedules: mappedSchedules,
    location: event.location || '',
    types: mappedTypes,
    categories: mappedCategories,
    imageUrl: event.imageUrl,
    imageFallbackUrl: event.durableImageUrl || event.durableThumbnailUrl,
    imageAlt: event.eventName,
    instagramEmbedStatus: instagramEmbed?.status ?? null,
    instagramEmbedHtml: instagramEmbed?.html ?? null,
    instagramEmbedDurableImageUrl: instagramEmbed?.durableImageUrl ?? null,
    videoUrl: event.videoUrl,
    videoAlt: event.eventName,
    originalPostUrl: event.originalPostUrl,
    sourcePostUrl: event.sourcePostUrl,
    publishedAt: event.publishedAt,
    hashtags: event.hashtags,
    contactInfo: event.contactInfo,
    links: event.links?.map((link) => ({ url: link.url, label: link.label ?? undefined })) ?? null,
    hasPrivateContact: event.hasPrivateContact,
    isFavorited: event.isFavorited,
    favoriteCount: event.favoriteCount,
    isAddedToCalendar: mappedSchedules.some((s) => s.isAddedToCalendar),
    accountName: event.sourceSocialMediaAccountProfile?.displayName ?? null,
    accountUsername: event.sourceSocialMediaAccountProfile?.username ?? null,
    accountPlatform: event.sourceSocialMediaAccountProfile?.platform ?? null,
    accountId: event.sourceSocialMediaAccountProfile?.accountId ?? null,
    accountPlatformIconUrl: event.sourceSocialMediaAccountProfile?.profileImageUrl ?? null,
    accountHref: event.sourceSocialMediaAccountProfile
      ? `/${getPlatformSlug(event.sourceSocialMediaAccountProfile.platform as any)}/${event.sourceSocialMediaAccountProfile.accountId}`
      : null,
    accountLocation: (() => {
      const defaultLocation = event.sourceSocialMediaAccountProfile?.defaultLocation;
      if (!defaultLocation) {
        return null;
      }
      const name = defaultLocation.placeName || defaultLocation.formattedAddress || '';
      if (!name) {
        return null;
      }
      return {
        name,
        coordinates: defaultLocation.coordinates ?? null,
        confidence: defaultLocation.confidence ?? null,
        matchType: defaultLocation.matchType ?? null,
      };
    })(),
    coauthors: mappedCoauthors,
    sourcePosts: mappedSourcePosts,
    locale,
    labels,
  };
}
