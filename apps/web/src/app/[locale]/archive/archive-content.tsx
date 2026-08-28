"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { useInfiniteQuery, InfiniteData } from "@tanstack/react-query"
import {
  EventListView,
  useInfiniteScroll,
  StatusBadge,
  PageContainer,
  ViewModeToggle,
} from "@festgrid/ui"
import { EventCategory, EventType } from "@festgrid/shared-types"
import {
  GetArchivedEventsQuery,
  GetArchivedEventsDocument,
} from "@/generated/graphql"
import { graphqlClient } from "@/lib/graphql-client"
import { usePostHog } from "@festgrid/analytics"
import { useRouter } from "@/i18n/navigation"
import { useAuthSession } from "@/components/providers/auth-session-provider"
import { useQueryState, parseAsStringLiteral } from "nuqs"


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

export function ArchiveContent() {
  const t = useTranslations("ArchivePage")
  const tCategory = useTranslations("EventCategory")
  const tType = useTranslations("EventType")
  const posthog = usePostHog()
  const router = useRouter()
  const { session, isLoading } = useAuthSession()
  const [layout, setLayout] = useQueryState(
    "layout",
    parseAsStringLiteral(["list", "masonry"]).withDefault("list")
  )
  const [liveMessage, setLiveMessage] = useState("")

  useEffect(() => {
    if (layout) {
      const layoutLabel = layout === 'masonry' ? t('layoutSwitcherMasonryLabel') : t('layoutSwitcherListLabel')
      setLiveMessage(t('layoutSwitcherAnnouncement', { layout: layoutLabel }))
      posthog.capture('layout_switched', { layout })
    }
  }, [layout, t, posthog])

  const categoryLabels = useMemo(
    () => buildEnumLabels(Object.values(EventCategory), tCategory),
    [tCategory]
  )
  const typeLabels = useMemo(() => buildEnumLabels(Object.values(EventType), tType), [tType])

  // AC6: unauthenticated visitors are redirected to /login
  useEffect(() => {
    if (!isLoading && !session) {
      router.push("/login")
    }
  }, [isLoading, session, router])

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    error,
  } = useInfiniteQuery<GetArchivedEventsQuery, Error, InfiniteData<GetArchivedEventsQuery>, any[], number>({
    queryKey: ["archivedEvents"],
    queryFn: async ({ pageParam }) => {
      const offset = pageParam as number
      return graphqlClient.request<GetArchivedEventsQuery>(
        GetArchivedEventsDocument,
        {
          limit: PAGE_SIZE,
          offset,
        }
      )
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const totalCount = lastPage.events.totalCount
      const nextOffset = allPages.length * PAGE_SIZE
      return nextOffset < totalCount ? nextOffset : undefined
    },
    enabled: !!session && !isLoading,
  })

  const { sentinelRef } = useInfiniteScroll({
    hasNextPage: !!hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  })

  type EventItem = GetArchivedEventsQuery["events"]["items"][number]
  const events: EventItem[] = (data?.pages || []).flatMap((page: GetArchivedEventsQuery) => page.events.items) ?? []

  // Capture once per successful load
  const hasLoadedRef = useRef(false)
  useEffect(() => {
    if (status === "success" && !hasLoadedRef.current) {
      hasLoadedRef.current = true
      const totalCount = data?.pages[0]?.events.totalCount ?? 0
      posthog.capture("archive_page_viewed", {
        archivedCount: totalCount,
      })
    }
  }, [status, data, posthog])

  if (!session) {
    return null
  }

  const listStatus =
    isLoading || status === "pending"
      ? "loading"
      : status === "error"
      ? "error"
      : "success"

  return (
    <PageContainer>
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex justify-end">
          <ViewModeToggle
            viewMode={layout}
            onViewModeChange={setLayout}
            labels={{
              list: t('layoutSwitcherListLabel'),
              masonry: t('layoutSwitcherMasonryLabel'),
            }}
          />
        </div>
        <EventListView
          viewMode={layout}
          status={listStatus}
        events={events as any}
        errorMessage={t("errorState")}
        errorDetail={error?.message || "Unknown error"}
        emptyState={
          <div className="text-center py-10 text-muted-foreground">
            {t("emptyState")}
          </div>
        }
        cardLabels={{
          favoriteToggle: "", // not favoritable in Archive
          priceFrom: t("priceFrom"),
          categoryLabels,
          typeLabels,
        }}
        getCardProps={(event: any) => {
          // Priority order: moderation-removed > hidden-by-me > expired
          let badgeVariant: "removedByModeration" | "hiddenByMe" | "expired" | null = null
          let badgeLabel = ""

          if (event.deletedAt) {
            badgeVariant = "removedByModeration"
            badgeLabel = t("reasonRemoved")
          } else if (event.isHiddenForCurrentUser) {
            badgeVariant = "hiddenByMe"
            badgeLabel = t("reasonHiddenByMe")
          } else if (event.isExpiredForCurrentUser) {
            badgeVariant = "expired"
            badgeLabel = t("reasonExpired")
          }

          const statusBadge = badgeVariant ? (
            <StatusBadge variant={badgeVariant} label={badgeLabel} />
          ) : undefined

          return {
            statusBadge,
            onClick: () => {
              // Click goes to detail page
              router.push(`/events/${event.slug}`)
            },
          }
        }}
        sentinelRef={sentinelRef}
        isFetchingNextPage={isFetchingNextPage}
        loadingMoreLabel={t("loadingMore")}
      />
      </div>

      <div aria-live="polite" className="sr-only">
        {liveMessage}
      </div>
    </PageContainer>
  )
}
