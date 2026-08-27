"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { useInfiniteQuery, useQuery, InfiniteData } from "@tanstack/react-query"
import {
  EventListView,
  useInfiniteScroll,
  EventDiscoveryPanel,
  PageContainer,
} from "@festgrid/ui"
import { EventCategory, EventType } from "@festgrid/shared-types"
import {
  EventQueryConditionInput,
  GetEventsDocument,
  GetEventsQuery,
  GetFavoritedEventIdsDocument,
  GetFavoritedEventIdsQuery,
  useToggleFavoriteMutation,
  ToggleFavoriteDocument,
  ToggleFavoriteMutation,
} from "@/generated/graphql"
import { toast } from "sonner"
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
  const tNearby = useTranslations("NearbyFilter")
  const [q, setQ] = useQueryState("q", parseAsString.withDefault(""))
  const [types] = useQueryState("types", parseAsArrayOf(parseAsString).withDefault([]))
  const [categories] = useQueryState("categories", parseAsArrayOf(parseAsString).withDefault([]))
  const posthog = usePostHog()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { session, isLoading } = useAuthSession()
  const [unfavoritedIds, setUnfavoritedIds] = useState<Set<string>>(new Set())
  const { mutateAsync: toggleFavoriteAsync } = useToggleFavoriteMutation(graphqlClient)

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
      locationFilterLabels: {
        filterLabel: tNearby("filterLabel"),
        offOptionLabel: tNearby("offOptionLabel"),
        currentLocationOptionLabel: tNearby("currentLocationOptionLabel"),
        radiusLabel: tNearby("radiusLabel"),
        radiusUnit: (count: number) => tNearby("radiusUnit", { count }),
        detectingLocationLabel: tNearby("detectingLocationLabel"),
        permissionDeniedLabel: tNearby("permissionDeniedLabel"),
        unavailableLabel: tNearby("unavailableLabel"),
        locationsErrorLabel: tNearby("locationsErrorLabel"),
        noSavedLocationsHint: tNearby("noSavedLocationsHint"),
      },
    }),
    [tFilterHub, tNearby]
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
    setUnfavoritedIds(new Set())
  }, [snapshotQueryKey])

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
    <PageContainer>
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
      </div>

      <EventDiscoveryPanel
        query={q}
        onSearchSubmit={handleSearchSubmit}
        searchPlaceholder={t("searchPlaceholder")}
        searchClearLabel={t("searchClearLabel")}
        filterLabels={filterLabels}
        types={typesOptions}
        categories={categoriesOptions}
        isAuthenticated={false}
        isLoadingLocations={false}
        locationsError={false}
        savedLocations={[]}
        selectedValue="off"
        radiusKm={10}
        isCapturingCurrentLocation={false}
        currentLocationError={null}
        onSelectLocation={() => {}}
        onRadiusChange={() => {}}
        views={[
          {
            id: "card",
            label: "Card View",
            content: (
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
                getCardProps={(event) => {
                  const isOptimisticallyUnfavorited = unfavoritedIds.has(event.id)
                  const isCardFavorited = event.isFavorited && !isOptimisticallyUnfavorited
                  const isCardGreyedOut = !event.isFavorited || isOptimisticallyUnfavorited

                  const handleToggle = async (forceFavorited?: boolean) => {
                    const targetFavorited = forceFavorited !== undefined ? forceFavorited : isOptimisticallyUnfavorited

                    // Optimistic update
                    setUnfavoritedIds((prev) => {
                      const next = new Set(prev)
                      if (targetFavorited) {
                        next.delete(event.id)
                      } else {
                        next.add(event.id)
                      }
                      return next
                    })

                    try {
                      const mutation = await toggleFavoriteAsync({ eventId: event.id })
                      const isFavoritedOnServer = mutation.toggleFavorite.isFavorited
                      
                      posthog.capture(isFavoritedOnServer ? "event_favorited" : "event_unfavorited", {
                        eventId: event.id,
                        eventName: event.eventName,
                      })

                      // Align state with server
                      setUnfavoritedIds((prev) => {
                        const next = new Set(prev)
                        if (isFavoritedOnServer) {
                          next.delete(event.id)
                        } else {
                          next.add(event.id)
                        }
                        return next
                      })

                      if (!isFavoritedOnServer) {
                        toast(t("pendingRemovalToastMessage"), {
                          action: {
                            label: t("undoLabel"),
                            onClick: () => {
                              // Trigger re-favorite (force favorited)
                              handleToggle(true)
                            },
                          },
                        })
                      }
                    } catch (err) {
                      console.error("handleToggle caught error:", err)
                      // Rollback on error
                      setUnfavoritedIds((prev) => {
                        const next = new Set(prev)
                        if (targetFavorited) {
                          next.add(event.id)
                        } else {
                          next.delete(event.id)
                        }
                        return next
                      })
                      toast.error("Failed to update favorite status")
                    }
                  }

                  return {
                    isGreyedOut: isCardGreyedOut,
                    isFavorited: isCardFavorited,
                    favoriteCount: event.favoriteCount,
                    pendingRemoval: isOptimisticallyUnfavorited,
                    onFavoriteToggle: () => {
                      if (isOptimisticallyUnfavorited) {
                        handleToggle(true)
                      } else {
                        handleToggle()
                      }
                    },
                    onClick: () => {
                      const params = new URLSearchParams(searchParams.toString())
                      params.set("fromList", "favorites")
                      params.set("favoriteIds", frozenIds.join(","))
                      router.push(`/events/${event.slug}?${params.toString()}`)
                    },
                  }
                }}
                sentinelRef={sentinelRef}
                isFetchingNextPage={isFetchingNextPage}
                loadingMoreLabel={t("loadingMore")}
              />
            )
          }
        ]}
      />
    </PageContainer>
  )
}