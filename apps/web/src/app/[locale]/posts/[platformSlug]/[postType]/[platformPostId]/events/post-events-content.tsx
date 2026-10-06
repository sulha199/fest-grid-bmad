"use client"

import { useMemo } from "react"
import { useTranslations, useLocale } from "next-intl"
import { useInfiniteQuery, InfiniteData } from "@tanstack/react-query"
import {
  EventListView,
  PageContainer,
  PageHeader,
  useInfiniteScroll,
  useListPaginationController,
  formatLocalizedNearbyBadgeDistance,
} from "@festgrid/ui"
import {
  EventQueryConditionInput,
  GetEventsDocument,
  GetEventsQuery,
  GetRelatedEventIdsByPostQuery,
  useGetRelatedEventIdsByPostQuery,
} from "@/generated/graphql"
import { graphqlClient } from "@/lib/graphql-client"
import { useRouter } from "@/i18n/navigation"
import { useSearchParams } from "next/navigation"
import { mapDaysOfWeekToDomain } from "@/lib/day-of-week-mapping"

const PAGE_SIZE = 10

interface PostEventsContentProps {
  postId: string
  account: {
    accountId: string
    platform: string
    username: string
    displayName: string
    profileImageUrl?: string | null
  } | null
}

export default function PostEventsContent({ postId, account }: PostEventsContentProps) {
  // AC4/AC9 -- reuses EventDetailsPage's existing "Events from {account}" group-label convention
  // (Story 3.6u) for this page's own PageHeader heading, not a new copy string. errorState/
  // emptyState/loadingMore are this story's own new PostCollectionPage namespace keys.
  const t = useTranslations("EventDetailsPage")
  const tPage = useTranslations("PostCollectionPage")
  const tEventCard = useTranslations("EventCard")
  const locale = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()

  const accountName = account?.displayName || account?.username || null
  const title = accountName ? t("relatedEventsGroupLabel", { account: accountName }) : ""

  // AC4 -- filterKey scoped to the resolved postId; this page has no search/filter chrome, so the
  // controller's only job here is the reset-on-filter-change bookkeeping the resolved postId
  // value itself could in principle trigger (mirrors FavoritesContent's integration contract).
  useListPaginationController({
    filterKey: { postId },
    initialCursor: 0,
  })

  const { data: idSnapshotData, status: idSnapshotStatus, error: idSnapshotError } = useGetRelatedEventIdsByPostQuery<GetRelatedEventIdsByPostQuery, Error>(
    graphqlClient,
    { postId },
    { gcTime: 0 }
  )

  const frozenIds = useMemo(
    () => idSnapshotData?.relatedEventIds[0]?.eventIds ?? [],
    [idSnapshotData]
  )

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    error,
  } = useInfiniteQuery<GetEventsQuery, Error, InfiniteData<GetEventsQuery>, any[], number>({
    queryKey: ["post-events", { postId, ids: frozenIds }],
    queryFn: async ({ pageParam }) => {
      const start = pageParam as number
      const batchIds = frozenIds.slice(start, start + PAGE_SIZE)

      if (batchIds.length === 0) {
        return {
          events: {
            items: [],
            hasMore: false,
            totalCount: frozenIds.length,
          },
        } as GetEventsQuery
      }

      const response = await graphqlClient.request<GetEventsQuery>(GetEventsDocument, {
        limit: batchIds.length,
        offset: 0,
        query: {
          operator: "and",
          conditions: [{ field: "id", operator: "in", value: batchIds }] as EventQueryConditionInput[],
        },
      })

      const orderMap = new Map(batchIds.map((id, index) => [id, index]))
      const orderedItems = [...response.events.items].sort((a, b) => {
        const aIndex = orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER
        const bIndex = orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER
        return aIndex - bIndex
      })

      return {
        events: {
          ...response.events,
          items: orderedItems,
          hasMore: start + PAGE_SIZE < frozenIds.length,
          totalCount: frozenIds.length,
        },
      }
    },
    initialPageParam: 0,
    getNextPageParam: (_lastPage, allPages) => {
      const nextOffset = allPages.length * PAGE_SIZE
      return nextOffset < frozenIds.length ? nextOffset : undefined
    },
    enabled: idSnapshotStatus === "success" && frozenIds.length > 0,
  })

  const { sentinelRef } = useInfiniteScroll({
    hasNextPage: !!hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  })

  type EventItem = GetEventsQuery["events"]["items"][number]
  const events = ((data?.pages || []).flatMap((page: GetEventsQuery) => page.events.items) ?? []).map(
    (event: EventItem) => ({
      ...event,
      schedules: (event.schedules ?? []).map((schedule) => ({
        ...schedule,
        applicableDaysOfWeek: mapDaysOfWeekToDomain(schedule.applicableDaysOfWeek),
      })),
    })
  )

  const listStatus =
    idSnapshotStatus === "pending" || (idSnapshotStatus === "success" && frozenIds.length > 0 && status === "pending")
      ? "loading"
      : idSnapshotStatus === "error" || (frozenIds.length > 0 && status === "error")
      ? "error"
      : "success"

  return (
    <PageContainer>
      <PageHeader title={title} />

      <EventListView
        status={listStatus}
        events={events}
        errorMessage={tPage("errorState")}
        errorDetail={idSnapshotError?.message || error?.message || "Unknown error"}
        emptyState={
          <div className="text-center py-10 text-muted-foreground">{tPage("emptyState")}</div>
        }
        cardLabels={{
          // priceFrom intentionally omitted -- no PostCollectionPage/EventCard i18n key for it
          // exists (Task 8 names only errorState/emptyState/loadingMore); EventCardLabels'
          // own default ("From") applies, same as every other untranslated-priceFrom caller.
          tillLabel: tEventCard("tillLabel"),
          statusEnded: tEventCard("statusEnded"),
          statusHappeningNow: tEventCard("statusHappeningNow"),
          statusEndsToday: tEventCard("statusEndsToday"),
          statusEndsAt: tEventCard.raw("statusEndsAt"),
          statusInHours: tEventCard.raw("statusInHours"),
          statusInDays: tEventCard.raw("statusInDays"),
          statusUpcoming: tEventCard("statusUpcoming"),
          tomorrow: tEventCard("tomorrow"),
          nearbyBadge: (distanceKm: number) => formatLocalizedNearbyBadgeDistance(locale, distanceKm),
        }}
        getCardProps={(event) => ({
          onClick: () => {
            const params = new URLSearchParams(searchParams.toString())
            params.set("fromList", "post")
            params.set("postEventIds", frozenIds.join(","))
            router.push(`/events/${event.slug}?${params.toString()}`)
          },
        })}
        sentinelRef={sentinelRef}
        isFetchingNextPage={isFetchingNextPage}
        hasNextPage={hasNextPage}
        loadingMoreLabel={tPage("loadingMore")}
      />
    </PageContainer>
  )
}
