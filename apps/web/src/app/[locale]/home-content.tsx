"use client"

import { useMemo } from "react"
import { useTranslations } from "next-intl"
import { useInfiniteQuery, InfiniteData } from "@tanstack/react-query"
import { EventCard, useInfiniteScroll, SearchBar, FilterHub } from "@festgrid/ui"
import { EventCategory, EventType } from "@festgrid/shared-types"
import { GetEventsDocument, GetEventsQuery, EventQueryConditionInput } from "@/generated/graphql"
import { graphqlClient } from "@/lib/graphql-client"
import { useQueryState, parseAsString, parseAsArrayOf } from "nuqs"
import { usePostHog } from "@festgrid/analytics"

function buildEventsQuery({ search, types, categories }: { search: string, types: string[], categories: string[] }): EventQueryConditionInput | undefined {
  const conditions: EventQueryConditionInput[] = []

  if (search.trim()) {
    conditions.push({
      operator: "or",
      conditions: [
        { field: "eventName", operator: "contains", value: search },
        { field: "performers", operator: "contains", value: search },
        { field: "location", operator: "contains", value: search },
      ]
    })
  }

  if (types.length > 0) {
    conditions.push({
      field: "types",
      operator: "in",
      value: types
    })
  }

  if (categories.length > 0) {
    conditions.push({
      field: "categories",
      operator: "in",
      value: categories
    })
  }

  if (conditions.length === 0) {
    return undefined
  }
  
  return {
    operator: "and",
    conditions
  }
}

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
  const [q, setQ] = useQueryState('q', parseAsString.withDefault(''))
  const [types] = useQueryState('types', parseAsArrayOf(parseAsString).withDefault([]))
  const [categories] = useQueryState('categories', parseAsArrayOf(parseAsString).withDefault([]))
  
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

  const posthog = usePostHog()

  const filterLabels = useMemo(() => ({
    typeLabel: tFilterHub('typeLabel'),
    categoryLabel: tFilterHub('categoryLabel'),
    clearLabel: tFilterHub('clearLabel'),
  }), [tFilterHub])

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

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    error
  } = useInfiniteQuery<GetEventsQuery, Error, InfiniteData<GetEventsQuery>, any[], number>({
    queryKey: ['events', { q, types, categories }],
    queryFn: async ({ pageParam }) => {
      return graphqlClient.request<GetEventsQuery>(GetEventsDocument, {
        limit: 10,
        offset: pageParam as number,
        query: buildEventsQuery({ search: q, types, categories })
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
    if (searchQuery.trim()) {
      posthog.capture('search_submitted', { query: searchQuery })
    }
  }, [setQ, posthog]);

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold">{t('title')}</h1>

      <div className="flex flex-col gap-6">
        <SearchBar
          query={q}
          onChange={() => {}} // Internal state only, URL updates on submit per AC1
          onSubmit={handleSearchSubmit}
          placeholder={t('searchPlaceholder')}
          clearLabel={t('searchClearLabel')}
        />

        <FilterHub
          labels={filterLabels}
          types={typesOptions}
          categories={categoriesOptions}
          onChange={handleFilterChange}
        />
      </div>

      {status === 'pending' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <EventCard
              key={i}
              eventName=""
              startDate=""
              loading={true}
            />
          ))}
        </div>
      )}

      {status === 'error' && (
        <div className="text-center py-10 text-destructive">
          <p>{t('errorState')}</p>
          <pre className="text-xs mt-4 text-left max-w-full overflow-auto bg-destructive/10 p-4 rounded text-destructive">
            {error?.message || JSON.stringify(error)}
          </pre>
        </div>
      )}

      {status === 'success' && events.length === 0 && (
        <div className="text-center py-10 text-muted-foreground">
          {q.trim() ? t('searchEmptyState') : t('emptyState')}
        </div>
      )}

      {status === 'success' && events.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event: EventItem) => {
              const mainSchedule = event.schedules.find((s: any) => s.isMainSchedule) || event.schedules[0]
              return (
                <EventCard
                  key={event.id}
                  eventName={event.eventName}
                  startDate={mainSchedule?.eventStartDate || ''}
                  imageUrl={event.imageUrl ?? undefined}
                  locationName={event.location ?? undefined}
                  categories={event.categories ?? []}
                  types={event.types ?? []}
                  priceFrom={mainSchedule?.ticketPrice ?? undefined}
                  labels={{ priceFrom: t('priceFrom'), categoryLabels, typeLabels }}
                />
              )
            })}
          </div>

          <div ref={sentinelRef} className="py-4 flex justify-center">
            {isFetchingNextPage && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                <span>{t('loadingMore')}</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
