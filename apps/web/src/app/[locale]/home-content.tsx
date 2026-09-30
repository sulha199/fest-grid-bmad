"use client"

import { useMemo, useState, useEffect } from "react"
import { useTranslations, useLocale } from "next-intl"
import { useInfiniteQuery, InfiniteData, useQueryClient } from "@tanstack/react-query"
import { EventListView, useInfiniteScroll, EventDiscoveryPanel, PageContainer, AIFilterOverlay, BlockingLoader, useListPaginationController, usePrefersReducedMotion, formatLocalizedNearbyBadgeDistance } from "@festgrid/ui"
import { EventCategory, EventType } from "@festgrid/shared-types"
import { GetEventsDocument, GetEventsQuery, EventQueryConditionInput, useToggleFavoriteMutation } from "@/generated/graphql"
import { graphqlClient } from "@/lib/graphql-client"
import { useQueryState, parseAsString, parseAsArrayOf, parseAsStringEnum } from "nuqs"
import { usePostHog } from "@festgrid/analytics"
import { useRouter } from "@/i18n/navigation"
import { useSearchParams } from "next/navigation"
import { useAuthSession } from "@/components/providers/auth-session-provider"
import { CalendarDays, LayoutGrid } from "lucide-react"
import { CalendarView } from "@/features/events/CalendarView"
import { buildEventsQueryCondition } from "@festgrid/domain/events"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { LoginContent } from "./login/login-content"
import { useNearbyFilter } from "./use-nearby-filter"
import { useAIFilter } from "@/features/events/use-ai-filter"
import { computeDistanceKm } from "@festgrid/domain/geolocation"
import { selectDisplaySchedule } from "@festgrid/domain/events"
import { mapDaysOfWeekToDomain } from "@/lib/day-of-week-mapping"
import { DayOfWeek as DomainDayOfWeek } from "@festgrid/domain/events"

// Falls back to the raw enum value if a translation key is missing, so a
// locale file drifting out of sync with the enum degrades gracefully instead
// of throwing on every render.
function buildEnumLabels(values: string[], translate: (key: string) => string) {
  return Object.fromEntries(
    values.map((value) => {
      try {
        return [value, translate(value)]
      } catch {
        return [value, value]
      }
    })
  )
}

const DEFAULT_NEARBY_BADGE_THRESHOLD_KM = 8

/**
 * Story 1.i1f review finding 7 — the previous
 * `Number(process.env.NEXT_PUBLIC_NEARBY_BADGE_DISTANCE_KM) || 8` silently
 * discarded an intentionally-configured `0` (falsy) and passed `NaN`/negative
 * values straight through into the badge gate. Parse explicitly instead:
 * absent, blank, non-numeric, non-finite or negative falls back to the default;
 * `0` is honoured as a real (if strict) override.
 */
export function parseNearbyBadgeThreshold(raw: string | undefined): number {
  if (raw == null || raw.trim() === '') return DEFAULT_NEARBY_BADGE_THRESHOLD_KM

  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_NEARBY_BADGE_THRESHOLD_KM

  return parsed
}

export function HomeContent() {
  const t = useTranslations('DiscoveryPage')
  const posthog = usePostHog()
  const tNearby = useTranslations('NearbyFilter')
  const { session } = useAuthSession()
  const nearbyFilter = useNearbyFilter()
  // Env-configurable nearby-badge threshold (km); NEXT_PUBLIC_ is required for
  // client-side availability in Next.js. Falls back to EventCard's own default (8)
  // when unset or invalid — see `parseNearbyBadgeThreshold`. Documented in the
  // repo-root `.env.example`.
  const nearbyBadgeThreshold = parseNearbyBadgeThreshold(
    process.env.NEXT_PUBLIC_NEARBY_BADGE_DISTANCE_KM
  )
  const aiFilter = useAIFilter()
  const [q, setQ] = useQueryState('q', parseAsString.withDefault(''))
  const [types] = useQueryState('types', parseAsArrayOf(parseAsString).withDefault([]))
  const [categories] = useQueryState('categories', parseAsArrayOf(parseAsString).withDefault([]))
  // No `.withDefault(...)` -- absent/null means "All" (AC7), matching the committed value's
  // own null-means-All contract used throughout `buildEventsQueryCondition`/`TemporalFilterToggle`.
  const [temporalFilter, setTemporalFilter] = useQueryState(
    'temporal',
    parseAsStringEnum<'TODAY' | 'UPCOMING'>(['TODAY', 'UPCOMING'])
  )
  const queryClient = useQueryClient()
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)

  const [view] = useQueryState('view', parseAsString.withDefault('card'))
  const [liveMessage, setLiveMessage] = useState("")

  useEffect(() => {
    if (view) {
      const viewLabel = view === 'calendar' ? t('viewSwitcherCalendarLabel') : t('viewSwitcherCardLabel')
      setLiveMessage(t('viewSwitcherAnnouncement', { view: viewLabel }))
      posthog.capture('view_switched', { view })
    }
  }, [view, t, posthog])

  const { mutate: toggleFavorite } = useToggleFavoriteMutation(graphqlClient, {
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ['events'] })
      // Snapshot every matched cache entry (not just the main list's) so `onError` can roll
      // back CalendarView's own query too — `['events']` matches both.
      const previousQueries = queryClient.getQueriesData({ queryKey: ['events'] })

      const toggleItem = (item: any) =>
        item.id === variables.eventId
          ? {
              ...item,
              isFavorited: !item.isFavorited,
              favoriteCount: Math.max(0, (item.favoriteCount ?? 0) + (item.isFavorited ? -1 : 1)),
            }
          : item

      queryClient.setQueriesData({ queryKey: ['events'] }, (old: any) => {
        // `['events']` also matches non-paginated cache entries under the same prefix
        // (e.g. CalendarView's `useGetEventsForCalendarQuery`, a plain `useQuery` returning
        // `{ events: { items } }` directly, not `{ pages: [...] }`) — handle both shapes so the
        // calendar view's own favorite icon updates optimistically too, not just the card list.
        if (old?.pages) {
          return {
            ...old,
            pages: old.pages.map((page: any) => ({
              ...page,
              events: { ...page.events, items: page.events.items.map(toggleItem) },
            })),
          }
        }
        if (old?.events?.items) {
          return { ...old, events: { ...old.events, items: old.events.items.map(toggleItem) } }
        }
        return old
      })

      return { previousQueries }
    },
    onError: (err, variables, context) => {
      context?.previousQueries?.forEach(([key, data]: any) => {
        queryClient.setQueryData(key, data)
      })
    },
    onSuccess: (data, variables) => {
      posthog.capture(data.toggleFavorite.isFavorited ? "event_favorited" : "event_unfavorited", {
        eventId: variables.eventId,
      })
    }
  })
  
  const tCategory = useTranslations('EventCategory')
  const tType = useTranslations('EventType')
  const tDayOfWeek = useTranslations('DayOfWeek')
  const tFilterHub = useTranslations('FilterHub')
  const tEventCard = useTranslations('EventCard')
  const locale = useLocale()

  const categoryLabels = useMemo(
    () => buildEnumLabels(Object.values(EventCategory), tCategory),
    [tCategory]
  )
  const typeLabels = useMemo(
    () => buildEnumLabels(Object.values(EventType), tType),
    [tType]
  )
  // Story 1.3k Task 8 (AC9) — DayOfWeek i18n namespace, passed through to EventListView/EventCard
  // as `dayOfWeekLabels`.
  const dayOfWeekLabels = useMemo(
    () => buildEnumLabels(Object.values(DomainDayOfWeek), tDayOfWeek),
    [tDayOfWeek]
  )

  const router = useRouter()
  const searchParams = useSearchParams()

  const filterLabels = useMemo(() => ({
    typeLabel: tFilterHub('typeLabel'),
    categoryLabel: tFilterHub('categoryLabel'),
    clearLabel: tFilterHub('clearLabel'),
    aiTriggerTooltip: tFilterHub('aiTriggerTooltip'),
    aiClearLabel: tFilterHub('aiClearLabel'),
    aiExpandLabel: tFilterHub('aiExpandLabel'),
    locationFilterLabels: {
      filterLabel: tNearby('filterLabel'),
      offOptionLabel: tNearby('offOptionLabel'),
      currentLocationOptionLabel: tNearby('currentLocationOptionLabel'),
      radiusLabel: tNearby('radiusLabel'),
      radiusUnit: (count: number) => tNearby('radiusUnit', { count }),
      detectingLocationLabel: tNearby('detectingLocationLabel'),
      permissionDeniedLabel: tNearby('permissionDeniedLabel'),
      unavailableLabel: tNearby('unavailableLabel'),
      locationsErrorLabel: tNearby('locationsErrorLabel'),
      noSavedLocationsHint: tNearby('noSavedLocationsHint'),
    }
  }), [tFilterHub, tNearby])

  const typesOptions = useMemo(() => Object.values(EventType).map(value => ({
    value,
    label: typeLabels[value] || value
  })), [typeLabels])

  const categoriesOptions = useMemo(() => Object.values(EventCategory).map(value => ({
    value,
    label: categoryLabels[value] || value
  })), [categoryLabels])

  const handleFilterChange = (newTypes: string[], newCategories: string[]) => {
    posthog.capture('filter_applied', { types: newTypes, categories: newCategories })
  }

  const resolvedNearby = nearbyFilter.resolvedFilter;

  const prefersReducedMotion = usePrefersReducedMotion();
  const pagination = useListPaginationController({
    filterKey: { q, types, categories, nearby: resolvedNearby, aiFilter: aiFilter.activeFilter, temporalFilter },
    initialCursor: 0,
    onReset: () => {
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
      }
    },
  });

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    error
  } = useInfiniteQuery<GetEventsQuery, Error, InfiniteData<GetEventsQuery>, any[], number>({
    queryKey: ['events', { q, types, categories, nearby: resolvedNearby, aiFilter: aiFilter.activeFilter, temporalFilter }, pagination.resetToken],
    queryFn: async ({ pageParam }) => {
      const condition = aiFilter.activeFilter
        ? buildEventsQueryCondition({ filter: { ...aiFilter.activeFilter, temporalFilter } })
        : buildEventsQueryCondition({ search: q, types, categories, nearby: resolvedNearby, temporalFilter });
      return graphqlClient.request<GetEventsQuery>(GetEventsDocument, {
        limit: 10,
        offset: pageParam as number,
        query: condition as EventQueryConditionInput | undefined
      })
    },
    initialPageParam: 0,
    // Story 1.3j (AC6, FIND-028) — cut refetch volume on remount/window-refocus without
    // materially staling Discovery data.
    staleTime: 30_000,
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.events.hasMore ? allPages.length * 10 : undefined
    }
  })

  const { sentinelRef } = useInfiniteScroll({
    hasNextPage: !!hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  })

  type EventItem = GetEventsQuery['events']['items'][number];
  // Story 1.3k Task 9 (AC2/AC3 end-to-end) — maps every schedule's GraphQL-typed
  // `applicableDaysOfWeek` to the domain enum `EventListView`/`EventCard` consume for the repeat
  // badge (AD-19 Rule 2/3 — never an implicit cast on the raw GQL enum array).
  const events = ((data?.pages || []).flatMap((page: GetEventsQuery) => page.events.items) ?? []).map(
    (event: EventItem) => ({
      ...event,
      schedules: (event.schedules ?? []).map((schedule) => ({
        ...schedule,
        applicableDaysOfWeek: mapDaysOfWeekToDomain(schedule.applicableDaysOfWeek),
      })),
    })
  )

  const handleSearchSubmit = useMemo(() => (searchQuery: string) => {
    setQ(searchQuery || '')
  }, [setQ]);

  const handleSearchEnter = useMemo(() => (searchQuery: string) => {
    if (searchQuery.trim()) {
      posthog.capture('search_submitted', { query: searchQuery })
    }
  }, [posthog]);

  const handleTemporalFilterChange = useMemo(() => (value: 'TODAY' | 'UPCOMING' | null) => {
    setTemporalFilter(value)
    posthog.capture('temporal_filter_changed', { value: value ?? 'ALL' })
  }, [setTemporalFilter, posthog]);

  const temporalFilterLabels = useMemo(() => ({
    today: t('temporalFilterTodayLabel'),
    upcoming: t('temporalFilterUpcomingLabel'),
    all: t('temporalFilterAllLabel'),
    groupLabel: t('temporalFilterGroupLabel'),
  }), [t]);

  return (
    <PageContainer>
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
      </div>

      <EventDiscoveryPanel
        query={q}
        onSearchSubmit={handleSearchSubmit}
        onSearchEnter={handleSearchEnter}
        searchPlaceholder={t('searchPlaceholder')}
        searchClearLabel={t('searchClearLabel')}
        showFiltersLabel={t('showFiltersLabel')}
        filterLabels={filterLabels}
        types={typesOptions}
        categories={categoriesOptions}
        onFilterChange={handleFilterChange}
        isAuthenticated={nearbyFilter.isAuthenticated}
        isLoadingLocations={nearbyFilter.isLoadingLocations}
        locationsError={nearbyFilter.locationsError}
        savedLocations={nearbyFilter.savedLocations}
        selectedValue={nearbyFilter.selectedValue}
        radiusKm={nearbyFilter.radiusKm}
        isCapturingCurrentLocation={nearbyFilter.isCapturingCurrentLocation}
        currentLocationError={nearbyFilter.currentLocationError}
        onSelectLocation={nearbyFilter.onSelectLocation}
        onRadiusChange={nearbyFilter.onRadiusChange}
        // FIND-045 — distinguishes "the selected saved location is still resolving" from
        // "you have no saved locations", so the panel's empty-state hint stays honest.
        isSelectedLocationPending={nearbyFilter.isActiveFilterCoordPending}
        showAITrigger={aiFilter.filterHubProps.showAITrigger}
        onAITriggerClick={aiFilter.filterHubProps.onAITriggerClick}
        aiFilterSummary={aiFilter.filterHubProps.aiFilterSummary}
        aiCaveatsText={aiFilter.filterHubProps.aiCaveatsText}
        onAIClear={aiFilter.filterHubProps.onAIClear}
        onAIExpand={aiFilter.filterHubProps.onAIExpand}
        temporalFilter={temporalFilter}
        onTemporalFilterChange={handleTemporalFilterChange}
        temporalFilterLabels={temporalFilterLabels}
        views={[
          {
            id: 'card',
            label: t('viewSwitcherCardLabel'),
            icon: <LayoutGrid className="w-4 h-4" />,
            content: (
              <EventListView
                status={status === 'pending' ? 'loading' : status}
                events={events}
                errorMessage={t('errorState')}
                errorDetail={error?.message || JSON.stringify(error)}
                emptyState={
                  <div className="text-center py-10 text-muted-foreground">
                    {q.trim() ? t('searchEmptyState') : t('emptyState')}
                  </div>
                }
                cardLabels={{
                  priceFrom: t('priceFrom'),
                  categoryLabels,
                  typeLabels,
                  dayOfWeekLabels,
                  favoriteToggle: tEventCard('favoriteToggle'),
                  tillLabel: tEventCard('tillLabel'),
                  statusEnded: tEventCard('statusEnded'),
                  statusHappeningNow: tEventCard('statusHappeningNow'),
                  statusEndsToday: tEventCard('statusEndsToday'),
                  statusEndsAt: tEventCard.raw('statusEndsAt'),
                  statusInHours: tEventCard.raw('statusInHours'),
                  statusInDays: tEventCard.raw('statusInDays'),
                  statusUpcoming: tEventCard('statusUpcoming'),
                  tomorrow: tEventCard('tomorrow'),
                  nearbyBadge: (distanceKm: number) => formatLocalizedNearbyBadgeDistance(locale, distanceKm),
                }}
                // Story 1.i1f AC5-9: distanceKm is computed only on this (Discovery) page.
                // feed-content.tsx/favorites-content.tsx are deliberately left unwired here —
                // both hardcode isAuthenticated={false}/savedLocations={[]} and never render
                // the Location filter button (pre-existing BUG-025, tracked separately).
                getCardProps={(event) => {
                  const displaySchedule = selectDisplaySchedule(event.schedules ?? []);
                  const coords = displaySchedule?.locationDetails?.coordinates;
                  let distanceKm: number | null = null;
                  if (coords && nearbyFilter.activeFilterCoord) {
                    distanceKm = computeDistanceKm(nearbyFilter.activeFilterCoord, {
                      latitude: coords.lat,
                      longitude: coords.lng,
                    });
                  }

                  return {
                    distanceKm,
                    nearbyBadgeThreshold,
                    isFavorited: event.isFavorited,
                    favoriteCount: event.favoriteCount,
                    onFavoriteToggle: () => {
                      if (!session) {
                        setIsLoginModalOpen(true)
                        return
                      }
                      toggleFavorite({ eventId: event.id })
                    },
                    onClick: () => {
                      const paramsStr = searchParams.toString()
                      const url = `/events/${event.slug}?fromList=true${paramsStr ? `&${paramsStr}` : ''}`
                      router.push(url)
                    },
                  };
                }}
                sentinelRef={sentinelRef}
                isFetchingNextPage={isFetchingNextPage}
                hasNextPage={hasNextPage}
                loadingMoreLabel={t('loadingMore')}
              />
            )
          },
          {
            id: 'calendar',
            label: t('viewSwitcherCalendarLabel'),
            icon: <CalendarDays className="w-4 h-4" />,
            content: <CalendarView q={q} types={types} categories={categories} nearby={resolvedNearby} viewerCoord={nearbyFilter.activeFilterCoord} nearbyBadgeThreshold={nearbyBadgeThreshold} onFavoriteToggle={(eventId) => {
              if (!session) {
                setIsLoginModalOpen(true);
                return;
              }
              toggleFavorite({ eventId });
            }} />
          }
        ]}
      />

      <div aria-live="polite" className="sr-only">
        {liveMessage}
      </div>

      <Dialog open={isLoginModalOpen} onOpenChange={setIsLoginModalOpen}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden">
          <LoginContent />
        </DialogContent>
      </Dialog>
      <AIFilterOverlay {...aiFilter.overlayProps} />
      <BlockingLoader active={aiFilter.isLoading} />

    </PageContainer>
  )
}
