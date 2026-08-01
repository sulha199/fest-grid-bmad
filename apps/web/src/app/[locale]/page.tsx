"use client"

import { useTranslations } from "next-intl"
import { useInfiniteQuery, InfiniteData } from "@tanstack/react-query"
import { EventCard, useInfiniteScroll } from "@festgrid/ui"
import { GetEventsDocument, GetEventsQuery } from "@/generated/graphql"
import { graphqlClient } from "@/lib/graphql-client"

export default function Home() {
  const t = useTranslations('DiscoveryPage')

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    error
  } = useInfiniteQuery<GetEventsQuery, Error, InfiniteData<GetEventsQuery>, string[], number>({
    queryKey: ['events'],
    queryFn: async ({ pageParam }) => {
      return graphqlClient.request<GetEventsQuery>(GetEventsDocument, {
        limit: 10,
        offset: pageParam as number
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

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold">{t('title')}</h1>

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
          {t('emptyState')}
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
