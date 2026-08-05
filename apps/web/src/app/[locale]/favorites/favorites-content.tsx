"use client"

import { useEffect, useMemo, useRef } from "react"
import { useTranslations } from "next-intl"
import { useInfiniteQuery, useQuery, InfiniteData } from "@tanstack/react-query"
import {
  EventListView,
  useInfiniteScroll,
  SearchBar,
  FilterHub,
  useSoftDeleteWithUndo,
} from "@festgrid/ui"
import { EventCategory, EventType } from "@festgrid/shared-types"
import {
  EventQueryConditionInput,
  GetEventsDocument,
  GetEventsQuery,
  GetFavoritedEventIdsDocument,
  GetFavoritedEventIdsQuery,
  useToggleFavoriteMutation,
} from "@/generated/graphql"
import { graphqlClient } from "@/lib/graphql-client"
import { useQueryState, parseAsString, parseAsArrayOf } from "nuqs"
import { usePostHog } from "@festgrid/analytics"
import { useRouter } from "@/i18n/navigation"
import { useSearchParams } from "next/navigation"
import { useAuthSession } from "@/components/providers/auth-session-provider"
import { buildEventsQueryCondition } from "@festgrid/domain/events"

const PAGE_SIZE = 10

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

function buildFavoritesQueryCondition(
  q: string,
  types: string[],
  categories: string[]
): EventQueryConditionInput {
  const dynamicQuery = buildEventsQueryCondition({ search: q, types, categories }) as
    | EventQueryConditionInput
    | undefined

  if (!dynamicQuery) {
    return {
      field: "isFavorited",
      operator: "eq",
      value: true,
    }
  }

  return {
    operator: "and",
    conditions: [
      {
        field: "isFavorited",
        operator: "eq",
        value: true,
      },
      dynamicQuery,
    ],
  }
}

export function FavoritesContent() {
  const t = useTranslations("FavoritesPage")
  const tCategory = useTranslations("EventCategory")
  const tType = useTranslations("EventType")
  const tFilterHub = useTranslations("FilterHub")
  const [q, setQ] = useQueryState("q", parseAsString.withDefault(""))
  const [types] = useQueryState("types", parseAsArrayOf(parseAsString).withDefault([]))
  const [categories] = useQueryState("categories", parseAsArrayOf(parseAsString).withDefault([]))
  const posthog = usePostHog()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { session, isLoading } = useAuthSession()
  const committedPendingIdsRef = useRef<Set<string>>(new Set())
  const softDelete = useSoftDeleteWithUndo<string>({
    defaultLabels: {
      message: t("pendingRemovalToastMessage"),
      undoLabel: t("undoLabel"),
    },
  })

  const categoryLabels = useMemo(
    () => buildEnumLabels(Object.values(EventCategory), tCategory),
    [tCategory]
  )
  const typeLabels = useMemo(() => buildEnumLabels(Object.values(EventType), tType), [tType])

  const filterLabels = useMemo(
    () => ({
      typeLabel: tFilterHub("typeLabel"),
      categoryLabel: tFilterHub("categoryLabel"),
      clearLabel: tFilterHub("clearLabel"),
    }),
    [tFilterHub]
  )

  const typesOptions = useMemo(
    () =>
      Object.values(EventType).map((value) => ({
        value,
        label: typeLabels[value] || value,
      })),
    [typeLabels]
  )

  const categoriesOptions = useMemo(
    () =>
      Object.values(EventCategory).map((value) => ({
        value,
        label: categoryLabels[value] || value,
      })),
    [categoryLabels]
  )

  const favoritesQuery = useMemo(
    () => buildFavoritesQueryCondition(q, types, categories),
    [q, types, categories]
  )

  // AC1: do not fetch any data if user is unauthenticated.
  useEffect(() => {
    if (!isLoading && !session) {
      router.push("/login")
    }
  }, [isLoading, session, router])

  const snapshotQueryKey = useMemo(
    () => JSON.stringify({ q, types, categories }),
    [q, types, categories]
  )
  const previousSnapshotKeyRef = useRef(snapshotQueryKey)

  useEffect(() => {
    if (previousSnapshotKeyRef.current === snapshotQueryKey) {
      return
    }

    previousSnapshotKeyRef.current = snapshotQueryKey
    for (const pendingId of softDelete.pendingIds) {
      softDelete.undo(pendingId)
    }
  }, [snapshotQueryKey, softDelete])

  const {
    data: idSnapshotData,
    status: idSnapshotStatus,
    error: idSnapshotError,
  } = useQuery<GetFavoritedEventIdsQuery, Error>({
    queryKey: ["favoriteIds", { q, types, categories }],
    queryFn: async () => {
      return graphqlClient.request<GetFavoritedEventIdsQuery>(GetFavoritedEventIdsDocument, {
        query: favoritesQuery,
      })
    },
    enabled: !!session && !isLoading,
    gcTime: 0,
  })

  const frozenIds = useMemo(
    () => idSnapshotData?.events.items.map((item) => item.id) ?? [],
    [idSnapshotData]
  )

  const reportedSnapshotRef = useRef<string>("")
  useEffect(() => {
    if (idSnapshotStatus !== "success") {
      return
    }

    const token = frozenIds.join(",")
    if (reportedSnapshotRef.current === token) {
      return
    }
    reportedSnapshotRef.current = token

    posthog.capture("favorites_page_viewed", {
      favoritedCount: idSnapshotData?.events.totalCount ?? frozenIds.length,
    })
  }, [idSnapshotStatus, frozenIds, idSnapshotData, posthog])

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    error,
  } = useInfiniteQuery<GetEventsQuery, Error, InfiniteData<GetEventsQuery>, any[], number>({
    queryKey: ["favoriteEvents", { ids: frozenIds, q, types, categories }],
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

      const conditions: EventQueryConditionInput[] = [{
        field: "id",
        operator: "in",
        value: batchIds,
      }]

      const filterCondition = buildEventsQueryCondition({ search: q, types, categories }) as
        | EventQueryConditionInput
        | undefined

      if (filterCondition) {
        conditions.push(filterCondition)
      }

      const response = await graphqlClient.request<GetEventsQuery>(GetEventsDocument, {
        limit: batchIds.length,
        offset: 0,
        query: {
          operator: "and",
          conditions,
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
    enabled: !!session && !isLoading && idSnapshotStatus === "success" && frozenIds.length > 0,
  })

  const { mutateAsync: toggleFavoriteAsync } = useToggleFavoriteMutation(graphqlClient)

  const { sentinelRef } = useInfiniteScroll({
    hasNextPage: !!hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  })

  type EventItem = GetEventsQuery["events"]["items"][number]
  const events: EventItem[] = (data?.pages || []).flatMap((page: GetEventsQuery) => page.events.items) ?? []

  const handleSearchSubmit = useMemo(
    () => (searchQuery: string) => {
      setQ(searchQuery || "")
    },
    [setQ]
  )

  if (!session) {
    return null
  }

  const listStatus =
    isLoading ||
    idSnapshotStatus === "pending" ||
    (idSnapshotStatus === "success" && frozenIds.length > 0 && status === "pending")
      ? "loading"
      : idSnapshotStatus === "error" || (frozenIds.length > 0 && status === "error")
      ? "error"
      : "success"

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
      </div>

      <div className="flex flex-col gap-6">
        <SearchBar
          query={q}
          onChange={() => {}}
          onSubmit={handleSearchSubmit}
          placeholder={t("searchPlaceholder")}
          clearLabel={t("searchClearLabel")}
        />

        <FilterHub labels={filterLabels} types={typesOptions} categories={categoriesOptions} />
      </div>

      <EventListView
        status={listStatus}
        events={events}
        errorMessage={t("errorState")}
        errorDetail={idSnapshotError?.message || error?.message || "Unknown error"}
        emptyState={
          <div className="text-center py-10 text-muted-foreground">
            {q.trim() || types.length > 0 || categories.length > 0
              ? t("searchEmptyState")
              : t("emptyState")}
          </div>
        }
        cardLabels={{
          favoriteToggle: t("favoriteButtonLabel"),
          priceFrom: t("priceFrom"),
          categoryLabels,
          typeLabels,
        }}
        getCardProps={(event) => ({
          isGreyedOut: !event.isFavorited || softDelete.isPending(event.id),
          isFavorited: event.isFavorited && !softDelete.isPending(event.id),
          pendingRemoval: softDelete.isPending(event.id),
          onFavoriteToggle: () => {
            if (softDelete.isPending(event.id)) {
              return
            }

            softDelete.markPending(event.id, async () => {
              if (committedPendingIdsRef.current.has(event.id)) {
                return
              }

              committedPendingIdsRef.current.add(event.id)

              try {
                const mutation = await toggleFavoriteAsync({ eventId: event.id })
                if (!mutation.toggleFavorite.isFavorited) {
                  posthog.capture("event_unfavorited", {
                    eventId: event.id,
                    eventName: event.eventName,
                  })
                }
              } catch (err) {
                committedPendingIdsRef.current.delete(event.id)
                throw err
              }
            })
          },
          onClick: () => {
            const params = new URLSearchParams(searchParams.toString())
            params.set("fromList", "favorites")
            params.set("favoriteIds", frozenIds.join(","))
            router.push(`/events/${event.slug}?${params.toString()}`)
          },
        })}
        sentinelRef={sentinelRef}
        isFetchingNextPage={isFetchingNextPage}
        loadingMoreLabel={t("loadingMore")}
      />
    </div>
  )
}