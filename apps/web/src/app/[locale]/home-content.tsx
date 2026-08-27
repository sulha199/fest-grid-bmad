"use client"

import { useMemo, useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { useInfiniteQuery, InfiniteData, useQueryClient } from "@tanstack/react-query"
import { EventListView, useInfiniteScroll, EventDiscoveryPanel, PageContainer } from "@festgrid/ui"
import { EventCategory, EventType } from "@festgrid/shared-types"
import { GetEventsDocument, GetEventsQuery, EventQueryConditionInput, useToggleFavoriteMutation } from "@/generated/graphql"
import { graphqlClient } from "@/lib/graphql-client"
import { useQueryState, parseAsString, parseAsArrayOf } from "nuqs"
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

export function HomeContent() {
  const t = useTranslations('DiscoveryPage')
  const posthog = usePostHog()
  const tAuth = useTranslations('Auth')
  const tNearby = useTranslations('NearbyFilter')
  const { session, signOut } = useAuthSession()
  const nearbyFilter = useNearbyFilter()
  const [q, setQ] = useQueryState('q', parseAsString.withDefault(''))
  const [types] = useQueryState('types', parseAsArrayOf(parseAsString).withDefault([]))
  const [categories] = useQueryState('categories', parseAsArrayOf(parseAsString).withDefault([]))
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
      const previousData = queryClient.getQueryData(['events', { q, types, categories }])

      queryClient.setQueriesData({ queryKey: ['events'] }, (old: any) => {
        if (!old) return old
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            events: {
              ...page.events,
              items: page.events.items.map((item: any) =>
                item.id === variables.eventId
                  ? { ...item, isFavorited: !item.isFavorited }
                  : item
              ),
            },
          })),
        }
      })

      return { previousData }
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['events', { q, types, categories, nearby: resolvedNearby }], context.previousData)
      }
    },
    onSuccess: (data, variables) => {
      posthog.capture(data.toggleFavorite.isFavorited ? "event_favorited" : "event_unfavorited", {
        eventId: variables.eventId,
      })
    }
  })
  
  const tCategory = useTranslations('EventCategory')
  const tType = useTranslations('EventType')
  const tFilterHub = useTranslations('FilterHub')

  const categoryLabels = useMemo(
    () => buildEnumLabels(Object.values(EventCategory), tCategory),
    [tCategory]
  )
  const typeLabels = useMemo(
    () => buildEnumLabels(Object.values(EventType), tType),
    [tType]
  )

  const router = useRouter()
  const searchParams = useSearchParams()

  const filterLabels = useMemo(() => ({
    typeLabel: tFilterHub('typeLabel'),
    categoryLabel: tFilterHub('categoryLabel'),
    clearLabel: tFilterHub('clearLabel'),
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

  const handleSignOut = async () => {
    await signOut()
    alert(tAuth('logoutSuccess'))
    router.push('/')
  }

  const resolvedNearby = nearbyFilter.resolvedFilter;

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    error
  } = useInfiniteQuery<GetEventsQuery, Error, InfiniteData<GetEventsQuery>, any[], number>({
    queryKey: ['events', { q, types, categories, nearby: resolvedNearby }],
    queryFn: async ({ pageParam }) => {
      return graphqlClient.request<GetEventsQuery>(GetEventsDocument, {
        limit: 10,
        offset: pageParam as number,
        query: buildEventsQueryCondition({ search: q, types, categories, nearby: resolvedNearby }) as EventQueryConditionInput | undefined
      })
    },
    initialPageParam: 0,
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
  const events: EventItem[] = (data?.pages || []).flatMap((page: GetEventsQuery) => page.events.items) ?? []

  const handleSearchSubmit = useMemo(() => (searchQuery: string) => {
    setQ(searchQuery || '')
  }, [setQ]);

  const handleSearchEnter = useMemo(() => (searchQuery: string) => {
    if (searchQuery.trim()) {
      posthog.capture('search_submitted', { query: searchQuery })
    }
  }, [posthog]);

  return (
    <PageContainer>
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <div>
          {session && (
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {session.user.email}
              </span>
              <button
                onClick={handleSignOut}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors shadow-sm"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>

      <EventDiscoveryPanel
        query={q}
        onSearchSubmit={handleSearchSubmit}
        onSearchEnter={handleSearchEnter}
        searchPlaceholder={t('searchPlaceholder')}
        searchClearLabel={t('searchClearLabel')}
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
                cardLabels={{ priceFrom: t('priceFrom'), categoryLabels, typeLabels }}
                getCardProps={(event) => ({
                  isFavorited: event.isFavorited,
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
                })}
                sentinelRef={sentinelRef}
                isFetchingNextPage={isFetchingNextPage}
                loadingMoreLabel={t('loadingMore')}
              />
            )
          },
          {
            id: 'calendar',
            label: t('viewSwitcherCalendarLabel'),
            icon: <CalendarDays className="w-4 h-4" />,
            content: <CalendarView q={q} types={types} categories={categories} nearby={resolvedNearby} />
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
    </PageContainer>
  )
}
