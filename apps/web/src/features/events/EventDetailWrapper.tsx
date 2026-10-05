"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { useGetEventBySlugQuery, useGetInstagramEmbedBySlugQuery, useGetInstagramEmbedForEventQuery, useGetRelatedEventIdsQuery, useGetEventsQuery, useToggleFavoriteMutation, useToggleCalendarAdditionMutation, useResolveScheduleTimezoneMutation, useMeQuery, useGetMySubscriptionsQuery, useSubscribeToAccountMutation, useRemoveSubscriptionMutation, SoftDeleteAction } from "@/generated/graphql"
import { graphqlClient } from "@/lib/graphql-client"
import { useQueryClient } from "@tanstack/react-query"
import { useAuthSession } from "@/components/providers/auth-session-provider"
import { EventDetailView, PageContainer, useVisibleOnce, type EventDetailViewRelatedEvent, type EventDetailViewRelatedEventGroup } from "@festgrid/ui"
import { mapGraphQLEventToDetailViewProps, useEventDetailViewLabels, ResolvedInstagramEmbed } from "./mapper"
import { useListNavigationForEvent } from "./navigation-hook"
import { useRouter } from "@/i18n/navigation"
import { useSearchParams } from "next/navigation"
import { useTranslations, useLocale } from "next-intl"
import { usePostHog } from "@festgrid/analytics"
import { toast } from "sonner"
import { ChevronLeft, ChevronRight, Home, X } from "lucide-react"
import { CorrectionDialog } from "./correction-dialog"
import { ReportDialog } from "./report-dialog"
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext, type CarouselApi } from "@/components/ui/carousel"
import { EventPreviewCard } from "./event-preview-card"
import { getPlatformSlug } from "@festgrid/domain/scraper"
import { mapDaysOfWeekToDomain } from "@/lib/day-of-week-mapping"

interface EventDetailWrapperProps {
  slug: string
  isModal?: boolean
}

export const EventDetailWrapper: React.FC<EventDetailWrapperProps> = ({ slug, isModal = false }) => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { session } = useAuthSession()
  const [liveMessage, setLiveMessage] = useState("")
  const [isCorrectionDialogOpen, setIsCorrectionDialogOpen] = useState(false)
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false)
  const [isHiddenAfterReport, setIsHiddenAfterReport] = useState(false)
  const [emblaApi, setEmblaApi] = useState<CarouselApi>()
  const [pendingCoauthorAccountId, setPendingCoauthorAccountId] = useState<string | null>(null)
  const posthog = usePostHog()
  const t = useTranslations("EventDetailsPage")
  const labels = useEventDetailViewLabels()
  const locale = useLocale()
  const tType = useTranslations("EventType")
  const tCategory = useTranslations("EventCategory")
  const tMeta = useTranslations("Metadata")

  const { data, isPending, error } = useGetEventBySlugQuery(
    graphqlClient,
    { slug }
  )

  // Story 3.7i (AC1, AD-16 Rule 7) -- fires unconditionally in parallel with the primary
  // query above, no `enabled` gate. Cheap even for the overwhelmingly-common legacy-slug
  // case: Story 3.7h's `NOT_RESOLVABLE_FROM_SLUG` branch does no DB lookup/Meta call.
  const { data: embedBySlugData } = useGetInstagramEmbedBySlugQuery(
    graphqlClient,
    { slug }
  )

  // Story 3.7i (AC3) -- legacy-hex-slug fallback. Fires only once we know both the event's
  // id (from the primary query) and that the slug-based lookup (Story 3.7h) could not
  // resolve it -- never fired for a platform-prefixed slug, where the AVAILABLE/UNAVAILABLE
  // result from embedBySlugData is already authoritative.
  const { data: embedForEventData } = useGetInstagramEmbedForEventQuery(
    graphqlClient,
    { eventId: data?.eventBySlug?.id || "" },
    {
      enabled: !!data?.eventBySlug?.id && embedBySlugData?.instagramEmbedBySlug?.status === 'NOT_RESOLVABLE_FROM_SLUG',
    }
  )

  // Story 3.6u (Task 6, AC6) — Related Events, lazy-loaded near viewport. `sentinelRef` is
  // attached to EventDetailView's own Related Events section wrapper (always rendered, even
  // with no data yet, per that component's own comment) so this fires once the section nears
  // the viewport; never gates the primary `useGetEventBySlugQuery` above (AD-16 Rule 7, matching
  // the unconditional `useGetInstagramEmbedBySlugQuery` precedent just above).
  const { sentinelRef: relatedEventsSentinelRef, isVisible: isRelatedEventsSectionVisible } = useVisibleOnce()

  const relatedEventsSubjectEventId = data?.eventBySlug?.id || ""

  const { data: relatedEventIdsData, isPending: isRelatedEventIdsPending } = useGetRelatedEventIdsQuery(
    graphqlClient,
    { eventId: relatedEventsSubjectEventId },
    { enabled: isRelatedEventsSectionVisible && !!relatedEventsSubjectEventId }
  )

  const relatedEventIdGroups = useMemo(
    () => relatedEventIdsData?.relatedEventIds ?? [],
    [relatedEventIdsData]
  )

  // Flattened, deduplicated across every group -- a second step read reusing the existing
  // `Query.events({ filter: { id: { in: [...] } } })` DSL (AC6), not a new query/document.
  const allRelatedEventIds = useMemo(
    () => Array.from(new Set(relatedEventIdGroups.flatMap((group) => group.eventIds))),
    [relatedEventIdGroups]
  )

  const { data: relatedEventsListData, isPending: isRelatedEventsListPending } = useGetEventsQuery(
    graphqlClient,
    {
      limit: allRelatedEventIds.length,
      offset: 0,
      query: {
        operator: 'and',
        conditions: [{ field: 'id', operator: 'in', value: allRelatedEventIds }],
      },
    },
    { enabled: allRelatedEventIds.length > 0 }
  )

  const { data: meData } = useMeQuery(
    graphqlClient,
    undefined,
    {
      enabled: !!session,
    }
  )

  const { data: subscriptionsData, isPending: isSubscriptionsPending } = useGetMySubscriptionsQuery(
    graphqlClient,
    undefined,
    {
      // Story 1.6c (AC5, FIND-030) — narrowed from `!!session` alone: this query is only useful
      // when the event actually has a linked source account to subscribe to. Gating removes the
      // call entirely for the common case of an event with no linked account.
      // Story 0.i6g (AC11) — widened to also fire when the event has 1+ coauthors, so a
      // coauthor's subscription state is never silently stuck unresolved for an event with
      // coauthors but no single source account.
      enabled:
        !!session &&
        (!!data?.eventBySlug?.sourceSocialMediaAccountProfile ||
          (data?.eventBySlug?.coauthors?.length ?? 0) > 0),
    }
  )

  const isModerator = meData?.me?.role === "moderator"

  const { mutate: toggleFavorite } = useToggleFavoriteMutation(graphqlClient, {
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["getEventBySlug"] })
      const previousData = queryClient.getQueriesData({ queryKey: ["getEventBySlug"] })[0]?.[1]

      queryClient.setQueriesData({ queryKey: ["getEventBySlug"] }, (old: unknown) => {
        const typedOld = old as any
        if (!typedOld?.eventBySlug) return typedOld
        return {
          ...typedOld,
          eventBySlug: {
            ...typedOld.eventBySlug,
            isFavorited: !typedOld.eventBySlug.isFavorited,
          },
        }
      })

      return { previousData }
    },
    onError: (err, newTodo, context) => {
      if (context?.previousData) {
        queryClient.setQueriesData({ queryKey: ["getEventBySlug"] }, context.previousData)
      }
      setLiveMessage(t("favoriteErrorAnnouncement"))
    },
    onSuccess: (data, variables) => {
      if (!data?.toggleFavorite) {
        // Schema says this field is non-null, but a resolver/codegen mismatch could
        // still slip a null payload through with a 200 response. Throwing here (rather
        // than silently returning) routes this through the mutation's own onError
        // above -- rolling back the optimistic flip and announcing the failure -- via
        // TanStack Query's execute(), which calls onError for any error thrown out of
        // onSuccess (see @tanstack/query-core mutation.ts). toggleCalendarAddition's
        // equivalent guard below doesn't need its own console.error: its caller,
        // handleAddToCalendar, already logs the propagated rejection in its catch.
        console.error("toggleFavorite mutation returned no data", { eventId: variables.eventId })
        throw new Error("toggleFavorite mutation returned no data")
      }
      const cached = queryClient.getQueriesData({ queryKey: ["getEventBySlug"] })[0]?.[1] as unknown
      const typedCached = cached as any
      posthog.capture(data.toggleFavorite.isFavorited ? "event_favorited" : "event_unfavorited", {
        eventId: variables.eventId,
        eventName: data.toggleFavorite.eventId ? typedCached?.eventBySlug?.eventName || "" : "",
      })
      setLiveMessage(data.toggleFavorite.isFavorited ? t("favoriteSuccessAnnouncement") : t("unfavoriteSuccessAnnouncement"))
      
      queryClient.setQueriesData({ queryKey: ["getEventBySlug"] }, (old: unknown) => {
        const typedOld = old as any
        if (!typedOld?.eventBySlug) return typedOld
        return {
          ...typedOld,
          eventBySlug: {
            ...typedOld.eventBySlug,
            isFavorited: data.toggleFavorite.isFavorited,
            favoriteCount: data.toggleFavorite.favoriteCount,
          },
        }
      })

      // Sync whichever list (feed/home/favorites) the user opened this detail view
      // from -- each list owns its own react-query cache entry, and none of them
      // are otherwise touched by this mutation.
      const patchListCache = (queryKeyPrefix: unknown[]) => {
        queryClient.setQueriesData({ queryKey: queryKeyPrefix }, (old: unknown) => {
          const typedOld = old as any
          if (!typedOld?.pages) return typedOld
          return {
            ...typedOld,
            pages: typedOld.pages.map((page: any) => {
              if (!page?.events?.items) return page
              return {
                ...page,
                events: {
                  ...page.events,
                  items: page.events.items.map((item: any) => {
                    if (item.id !== variables.eventId) return item
                    return { ...item, isFavorited: data.toggleFavorite.isFavorited, favoriteCount: data.toggleFavorite.favoriteCount }
                  }),
                },
              }
            }),
          }
        })
      }

      // `setQueriesData` matches by key PREFIX (no `exact: true` given), so the
      // ["events"] filter already reaches both home's ["events", {...}] queries
      // AND feed's ["events", "feed", {...}] queries in one call -- patching
      // ["events", "feed"] separately would double-apply the favoriteCount
      // delta to the feed cache.
      patchListCache(["events"])
      patchListCache(["favoriteEvents"])
    },
  })

  const { mutateAsync: toggleCalendarAddition } = useToggleCalendarAdditionMutation(graphqlClient, {
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ["getEventBySlug"] })
      const previousData = queryClient.getQueriesData({ queryKey: ["getEventBySlug"] })[0]?.[1]

      queryClient.setQueriesData({ queryKey: ["getEventBySlug"] }, (old: unknown) => {
        const typedOld = old as any
        if (!typedOld?.eventBySlug) return typedOld
        return {
          ...typedOld,
          eventBySlug: {
            ...typedOld.eventBySlug,
            schedules: (typedOld.eventBySlug.schedules || []).map((s: any) => {
              if (s.id === variables.scheduleId) {
                return { ...s, isAddedToCalendar: !s.isAddedToCalendar }
              }
              return s
            }),
          },
        }
      })

      return { previousData }
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueriesData({ queryKey: ["getEventBySlug"] }, context.previousData)
      }
      setLiveMessage(t("calendarErrorAnnouncement"))
    },
    onSuccess: (data, variables) => {
      if (!data?.toggleCalendarAddition) {
        // Same reasoning as toggleFavorite's guard above: throw so this routes through
        // onError (rollback + announcement) and so the rejection propagates out of
        // mutateAsync, which handleAddToCalendar's try/catch below depends on to know
        // this schedule's toggle actually failed (it must not report success/download
        // the .ics file for a toggle that silently returned no data).
        throw new Error("toggleCalendarAddition mutation returned no data")
      }
      queryClient.setQueriesData({ queryKey: ["getEventBySlug"] }, (old: unknown) => {
        const typedOld = old as any
        if (!typedOld?.eventBySlug) return typedOld
        return {
          ...typedOld,
          eventBySlug: {
            ...typedOld.eventBySlug,
            schedules: (typedOld.eventBySlug.schedules || []).map((s: any) => {
              if (s.id === variables.scheduleId) {
                return { ...s, isAddedToCalendar: data.toggleCalendarAddition.isAddedToCalendar }
              }
              return s
            }),
          },
        }
      })

      posthog.capture(data.toggleCalendarAddition.isAddedToCalendar ? "event_added_to_calendar" : "event_removed_from_calendar", {
        eventId: variables.eventId,
        scheduleId: variables.scheduleId,
      })
    },
  })

  const { mutate: resolveScheduleTimezone } = useResolveScheduleTimezoneMutation(graphqlClient, {
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ["getEventBySlug"] })
      const previousData = queryClient.getQueriesData({ queryKey: ["getEventBySlug"] })[0]?.[1]

      queryClient.setQueriesData({ queryKey: ["getEventBySlug"] }, (old: unknown) => {
        const typedOld = old as any
        if (!typedOld?.eventBySlug) return typedOld
        return {
          ...typedOld,
          eventBySlug: {
            ...typedOld.eventBySlug,
            schedules: (typedOld.eventBySlug.schedules || []).map((s: any) => {
              if (s.id === variables.scheduleId) {
                return { ...s, timezone: variables.timezone, timezoneStatus: 'RESOLVED' }
              }
              return s
            }),
          },
        }
      })

      return { previousData }
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueriesData({ queryKey: ["getEventBySlug"] }, context.previousData)
      }
      setLiveMessage(t("timezoneSubmitErrorAnnouncement"))
    },
    onSuccess: () => {
      setLiveMessage(t("timezoneSubmitSuccessAnnouncement"))
    },
  })

  const { mutate: subscribeToAccount, isPending: isSubscribingToAccount } = useSubscribeToAccountMutation(graphqlClient, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["getMySubscriptions"] })
      setLiveMessage(t("subscribeSuccessAnnouncement"))
      posthog.capture("account_subscribed", {
        eventId,
        accountId: data?.eventBySlug?.sourceSocialMediaAccountProfile?.accountId,
      })
    },
    onError: () => {
      setLiveMessage(t("subscribeErrorAnnouncement"))
    }
  })

  const { mutate: unsubscribeFromAccount, isPending: isUnsubscribingFromAccount } = useRemoveSubscriptionMutation(graphqlClient, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["getMySubscriptions"] })
      setLiveMessage(t("unsubscribeSuccessAnnouncement"))
      posthog.capture("account_unsubscribed", {
        eventId,
        accountId: data?.eventBySlug?.sourceSocialMediaAccountProfile?.accountId,
      })
    },
    onError: () => {
      setLiveMessage(t("unsubscribeErrorAnnouncement"))
    }
  })

  // Story 0.i6g (AC5, AC6, AC8, AC9) — a second, distinct mutation pair for coauthor toggles.
  // Deliberately does not touch/reuse subscribeToAccount/unsubscribeFromAccount above, to keep
  // that already-shipped, already-tested single-source-account code path completely unchanged.
  // Confirm-then-refetch only (no onMutate optimistic flip) and no posthog.capture call (AC9) —
  // all analytics for this toggle are Story 3.19's scope.
  const { mutate: subscribeToCoauthor } = useSubscribeToAccountMutation(graphqlClient, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["getMySubscriptions"] })
      setLiveMessage(t("subscribeSuccessAnnouncement"))
    },
    onError: () => {
      setLiveMessage(t("subscribeErrorAnnouncement"))
    },
    onSettled: () => {
      setPendingCoauthorAccountId(null)
    },
  })

  const { mutate: unsubscribeFromCoauthor } = useRemoveSubscriptionMutation(graphqlClient, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["getMySubscriptions"] })
      setLiveMessage(t("unsubscribeSuccessAnnouncement"))
    },
    onError: () => {
      setLiveMessage(t("unsubscribeErrorAnnouncement"))
    },
    onSettled: () => {
      setPendingCoauthorAccountId(null)
    },
  })

  const handleSubscribeToCoauthor = (accountId: string) => {
    const coauthor = data?.eventBySlug?.coauthors?.find((c) => c.accountId === accountId)
    if (!coauthor?.platform || !coauthor.accountId || !coauthor.username || !coauthor.displayName) return
    setPendingCoauthorAccountId(accountId)
    subscribeToCoauthor({
      input: {
        platform: coauthor.platform,
        accountId: coauthor.accountId,
        username: coauthor.username,
        displayName: coauthor.displayName,
      },
    })
  }

  const handleUnsubscribeFromCoauthor = (accountId: string) => {
    const matched = subscriptionsData?.mySubscriptions?.find((s) => s.account.accountId === accountId)
    if (!matched?.id) return
    setPendingCoauthorAccountId(accountId)
    unsubscribeFromCoauthor({ id: matched.id, action: SoftDeleteAction.Delete })
  }

  const handleSubscribeToAccount = () => {
    if (!data?.eventBySlug?.sourceSocialMediaAccountProfile) return
    const { platform, accountId, username, displayName } = data.eventBySlug.sourceSocialMediaAccountProfile
    if (!platform || !accountId || !username || !displayName) return
    subscribeToAccount({
      input: { platform, accountId, username, displayName }
    })
  }

  const handleUnsubscribeFromAccount = () => {
    if (!matchedSubscription?.id) return
    unsubscribeFromAccount({ id: matchedSubscription.id, action: SoftDeleteAction.Delete })
  }

  const matchedSubscription = subscriptionsData?.mySubscriptions?.find(
    s => s.account.accountId === data?.eventBySlug?.sourceSocialMediaAccountProfile?.accountId
  )
  const isSubscribedToAccount = !!matchedSubscription
  const isSubscriptionStatusLoading = !!session && isSubscriptionsPending

  const eventId = data?.eventBySlug?.id || ""
  const nav = useListNavigationForEvent(eventId, isModal)

  // Story 3.7i (AC1, AC3, AC4) -- merge the two/three-hook embed result into the one
  // resolved shape mapGraphQLEventToDetailViewProps needs. A network error on either embed
  // hook, or both hooks still pending, leaves this `null` -- AC4's safe default, never a
  // crash or a guessed value.
  const embedBySlugStatus = embedBySlugData?.instagramEmbedBySlug?.status
  const resolvedInstagramEmbed: ResolvedInstagramEmbed | null =
    embedBySlugStatus === 'AVAILABLE' || embedBySlugStatus === 'UNAVAILABLE'
      ? {
          status: embedBySlugStatus,
          html: embedBySlugData!.instagramEmbedBySlug.html,
          durableImageUrl: embedBySlugData!.instagramEmbedBySlug.durableImageUrl,
        }
      : embedBySlugStatus === 'NOT_RESOLVABLE_FROM_SLUG' && embedForEventData?.event?.instagramEmbed
        ? {
            status: embedForEventData.event.instagramEmbed.status,
            html: embedForEventData.event.instagramEmbed.html,
            durableImageUrl: embedForEventData.event.instagramEmbed.durableImageUrl,
          }
        : null

  // Story 0.38 (AC1, AC2) — register the dedicated, locale-scoped Instagram
  // embed.js caching service worker. Deliberately NOT
  // `apps/web/public/firebase-messaging-sw.js` (stays root-scoped, unrelated
  // FCM push delivery) and NOT `apps/web/public/embed.js` (this project's own
  // same-origin widget-embedding script, Epic 6). Firing once per locale
  // actually visited (not eagerly for both locales) is a deliberate
  // implementation choice — see AC2.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return
    navigator.serviceWorker
      .register("/instagram-embed-cache-sw.js", { scope: `/${locale}/events/` })
      .catch((err) => {
        console.error("Failed to register instagram-embed-cache-sw.js", err)
      })
  }, [locale])

  // Fire analytics exactly once when details view is successfully opened with populated event data
  useEffect(() => {
    if (data?.eventBySlug) {
      posthog.capture("event_details_viewed", {
        eventId: data.eventBySlug.id,
        eventName: data.eventBySlug.eventName,
      })
    }
  }, [data?.eventBySlug, posthog])

  const handleNext = async () => {
    const target = await nav.requestNext()
    if (target?.item) {
      const paramsStr = searchParams.toString()
      router.replace(`/events/${target.item.slug}${paramsStr ? `?${paramsStr}` : ""}`)
    }
  }

  const handlePrevious = () => {
    if (nav.previous.target?.item) {
      const paramsStr = searchParams.toString()
      router.replace(`/events/${nav.previous.target.item.slug}${paramsStr ? `?${paramsStr}` : ""}`)
    }
  }

  const previousSlug = nav.previous.target?.item.slug
  const nextSlug = nav.next.target?.item.slug

  // Warm the RSC payload for both known adjacent targets as soon as they're
  // known, so a committed Next/Previous navigation resolves faster. On the
  // full-page route (no sibling loading.tsx there) this can warm the full
  // dynamic payload, including generateMetadata's own server-side fetch
  // (AC12). It does NOT do the same for the modal route — Next.js only
  // prefetches "down to and including loading.js" for a dynamic segment, so a
  // route WITH a loading.tsx never gets its actual dynamic content prefetched
  // this way. The modal route's RouteLoader flash on Next/Previous is instead
  // fixed by not having a loading.tsx there at all (removed — see
  // project-context.md's Route-Level Suspense Fallback rule addendum): that
  // file could only ever be reached via an in-app transition, never a genuine
  // cold/direct-URL open (interception never applies to those), so removing
  // it just lets Next.js's default "keep old content mounted during
  // transition" behavior take over instead of flashing a fallback.
  useEffect(() => {
    const paramsStr = searchParams.toString()
    const suffix = paramsStr ? `?${paramsStr}` : ""
    if (previousSlug) {
      router.prefetch(`/events/${previousSlug}${suffix}`)
    }
    if (nextSlug) {
      router.prefetch(`/events/${nextSlug}${suffix}`)
    }
  }, [router, searchParams, previousSlug, nextSlug])

  // The previous-peek CarouselItem only renders when a previous target exists, so
  // "current" sits at index 0 or 1 depending on whether that slide is present.
  const currentSlideIndex = nav.previous.disabled ? 0 : 1
  const currentSlideIndexRef = useRef(currentSlideIndex)
  currentSlideIndexRef.current = currentSlideIndex

  // handleNext/handlePrevious are redefined every render (not memoized), but the
  // swipe-commit listener below only subscribes to Embla once (see its own
  // [emblaApi]-only deps). Refs keep it calling the latest versions instead of a
  // stale closure — handlePrevious in particular reads nav.previous.target as a
  // plain synchronous snapshot (unlike handleNext's ref-backed nav.requestNext()),
  // so a stale closure would silently never navigate backward.
  const handleNextRef = useRef(handleNext)
  handleNextRef.current = handleNext
  const handlePreviousRef = useRef(handlePrevious)
  handlePreviousRef.current = handlePrevious

  // Snap back to the current slide (no animation) whenever the underlying event
  // changes or the window reshapes (previous/next availability changes) — this is
  // what returns the carousel to center after a committed swipe or button click.
  useEffect(() => {
    if (!emblaApi) return
    emblaApi.scrollTo(currentSlideIndex, true)
  }, [emblaApi, eventId, currentSlideIndex, nav.hasListContext])

  // Swipe-commit: Embla fires "select" once a drag crosses the snap threshold.
  // This is purely an alternate trigger for the same handleNext/handlePrevious
  // already wired to the arrow buttons — no separate navigation logic here.
  useEffect(() => {
    if (!emblaApi) return
    const onSelect = () => {
      const selected = emblaApi.selectedScrollSnap()
      if (selected === currentSlideIndexRef.current) return
      if (selected > currentSlideIndexRef.current) {
        handleNextRef.current()
      } else {
        handlePreviousRef.current()
      }
    }
    emblaApi.on("select", onSelect)
    return () => {
      emblaApi.off("select", onSelect)
    }
  }, [emblaApi])

  // Hidden After Report / Hidden For Current User view
  const isHidden = (data?.eventBySlug?.isHiddenForCurrentUser === true && !isModerator) || isHiddenAfterReport
  if (!isPending && !error && data?.eventBySlug && isHidden) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-background rounded-lg border border-gray-200 dark:border-gray-800 max-w-md mx-auto my-8 space-y-4">
        <h2 className="text-2xl font-bold text-foreground">{t("hiddenAfterReportTitle")}</h2>
        <p className="text-muted-foreground">{t("hiddenAfterReportBody")}</p>
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/95 transition-colors text-sm"
        >
          <Home className="w-4 h-4" />
          {t("backToHome")}
        </button>
      </div>
    )
  }

  // Not Found view
  if (!isPending && !error && !data?.eventBySlug) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-background rounded-lg border border-gray-200 dark:border-gray-800 max-w-md mx-auto my-8 space-y-4">
        <h2 className="text-2xl font-bold text-foreground">{t("notFoundTitle")}</h2>
        <p className="text-muted-foreground">{t("notFoundBody")}</p>
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/95 transition-colors text-sm"
        >
          <Home className="w-4 h-4" />
          {t("backToHome")}
        </button>
      </div>
    )
  }

  const handleAddToCalendar = async (selectedIds: string[]) => {
    if (!session) {
      router.push("/login")
      return
    }

    if (!eventId) return

    const changedIds: string[] = []
    const addedIds: string[] = []

    ;(data?.eventBySlug?.schedules || []).forEach((s) => {
      const isCurrentlyAdded = !!s.isAddedToCalendar
      const isNewlySelected = selectedIds.includes(s.id)
      if (isCurrentlyAdded !== isNewlySelected) {
        changedIds.push(s.id)
        if (isNewlySelected) {
          addedIds.push(s.id)
        }
      }
    })

    if (changedIds.length === 0) return

    const settled = await Promise.allSettled(
      changedIds.map((scheduleId) => toggleCalendarAddition({ eventId, scheduleId }))
    )

    const succeededIds: string[] = []
    const failedIds: string[] = []
    changedIds.forEach((scheduleId, index) => {
      if (settled[index]?.status === "fulfilled") {
        succeededIds.push(scheduleId)
      } else {
        failedIds.push(scheduleId)
      }
    })

    const downloadIds = addedIds.filter((id) => succeededIds.includes(id))

    if (downloadIds.length > 0) {
      const queryParams = new URLSearchParams()
      queryParams.set("eventId", eventId)
      downloadIds.forEach((id) => {
        queryParams.append("scheduleId", id)
      })
      window.location.assign(`/api/calendar/ics?${queryParams.toString()}`)

      posthog.capture("calendar_ics_downloaded", {
        eventId,
        scheduleIds: downloadIds,
      })
    }

    if (failedIds.length > 0) {
      // Do not toast success and re-throw so the dialog's awaited onConfirm knows
      // this confirm failed (at least partially) and keeps itself open instead of
      // closing on a false-success basis. Each failed schedule's own mutation
      // onError above already surfaced the user-visible calendarErrorAnnouncement
      // and rolled back its optimistic flip; succeeded schedules stick via the
      // cache update above and the dialog's own prop-resync effect.
      console.error("Failed to update calendar additions", { failedIds })
      throw new Error("Failed to update calendar additions")
    }

    toast.success(t("addToCalendarSuccessAnnouncement"))
  }

  // Story 3.6u (Task 6, AC6) — groups built from the already-loaded `sourcePosts` account data
  // (no second account fetch): each group's label is resolved by matching its `postId` back to
  // the matching `sourcePosts[i].account`, and the "See all N" href is built from that same
  // entry's `platformPostId`/`postType`/`account.platform` (AC6's documented future route).
  const relatedEventGroups: EventDetailViewRelatedEventGroup[] | undefined = isRelatedEventsSectionVisible
    ? relatedEventIdGroups.map((group) => {
        const sourcePost = data?.eventBySlug?.sourcePosts?.find((sp) => sp.postId === group.postId)
        const accountName = sourcePost?.account?.displayName || sourcePost?.account?.username || null
        const accountLabel = accountName
          ? t("relatedEventsGroupLabel", { account: accountName })
          : labels.unknownAccountLabel ?? ""

        const platformSlug = sourcePost?.account?.platform
          ? getPlatformSlug(sourcePost.account.platform as any)
          : null
        const seeAllHref =
          platformSlug && sourcePost?.postType && sourcePost?.platformPostId
            ? `/posts/${platformSlug}/${sourcePost.postType}/${sourcePost.platformPostId}/events`
            : null

        const events: EventDetailViewRelatedEvent[] = group.eventIds
          .map((id) => relatedEventsListData?.events.items.find((e) => e.id === id))
          .filter((e): e is NonNullable<typeof e> => !!e)
          .map((e) => {
            const mainSchedule = e.schedules.find((s) => s.isMainSchedule) ?? e.schedules[0]
            return {
              id: e.id,
              slug: e.slug,
              eventName: e.eventName,
              locationName: e.location || null,
              imageUrl: e.imageUrl,
              imageFallbackUrl: e.durableImageUrl,
              isFavorited: e.isFavorited,
              favoriteCount: e.favoriteCount,
              isMainSchedule: mainSchedule?.isMainSchedule ?? false,
              eventStartDate: mainSchedule?.eventStartDate ?? "",
              eventStartTime: mainSchedule?.eventStartTime,
              eventEndDate: mainSchedule?.eventEndDate,
              eventEndTime: mainSchedule?.eventEndTime,
              applicableDaysOfWeek: mapDaysOfWeekToDomain(mainSchedule?.applicableDaysOfWeek),
            }
          })

        return {
          postId: group.postId,
          accountLabel,
          events,
          totalCount: group.eventIds.length,
          seeAllHref,
          isLoading: isRelatedEventsListPending,
        }
      })
    : undefined

  const mappedProps = data?.eventBySlug
    ? {
        ...mapGraphQLEventToDetailViewProps(
          data.eventBySlug,
          labels,
          locale,
          tType,
          tCategory,
          resolvedInstagramEmbed,
          subscriptionsData?.mySubscriptions,
          pendingCoauthorAccountId
        ),
        isAuthenticated: !!session,
        onFavoriteToggle: () => {
          if (!session) {
            router.push("/login")
            return
          }
          if (eventId) {
            toggleFavorite({ eventId })
          }
        },
        onAddToCalendar: handleAddToCalendar,
        onCategoryClick: (value: string) => {
          router.push(`/?categories=${encodeURIComponent(value)}`)
        },
        onTypeClick: (value: string) => {
          router.push(`/?types=${encodeURIComponent(value)}`)
        },
        // Moderator-only: the timezone is inferred at ingestion (schedule location, then the
        // account's timezone); a still-unresolved schedule is a data issue for moderators to fix,
        // never a prompt shown to ordinary viewers.
        onResolveScheduleTimezone: isModerator
          ? (scheduleId: string, timezone: string) => {
              resolveScheduleTimezone({ scheduleId, timezone })
            }
          : undefined,
        onCorrectData: () => {
          if (!session) {
            router.push("/login")
            return
          }
          setIsCorrectionDialogOpen(true)
        },
        onReport: () => {
          if (!session) {
            router.push("/login")
            return
          }
          setIsReportDialogOpen(true)
        },
        isSubscribedToAccount: !!isSubscribedToAccount,
        isSubscribingToAccount: isSubscribingToAccount,
        onSubscribeToAccount: () => {
          if (!session) {
            router.push("/login")
            return
          }
          handleSubscribeToAccount()
        },
        isSubscriptionStatusLoading,
        isUnsubscribingFromAccount,
        onUnsubscribeFromAccount: () => {
          if (!session) {
            router.push("/login")
            return
          }
          handleUnsubscribeFromAccount()
        },
        onSubscribeToCoauthor: (accountId: string) => {
          if (!session) {
            router.push("/login")
            return
          }
          handleSubscribeToCoauthor(accountId)
        },
        onUnsubscribeFromCoauthor: (accountId: string) => {
          if (!session) {
            router.push("/login")
            return
          }
          handleUnsubscribeFromCoauthor(accountId)
        },
        relatedEventsSentinelRef,
        isRelatedEventsLoading: isRelatedEventsSectionVisible && isRelatedEventIdsPending,
        relatedEventGroups,
        onRelatedEventClick: (relatedEvent: EventDetailViewRelatedEvent) => {
          router.push(`/events/${relatedEvent.slug}`)
        },
      }
    : null

  const navigationHeader = (
    <div className="flex justify-between items-center mb-6 pb-3 border-b border-gray-100 dark:border-gray-800">
      <div className="flex gap-2">
        {nav.hasListContext ? (
          <>
            <CarouselPrevious
              disabled={nav.previous.disabled || nav.previous.loading}
              onClick={handlePrevious}
              aria-label={t("previous")}
              className="static translate-y-0 h-10 w-10 inline-flex items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">{t("previous")}</span>
            </CarouselPrevious>
            <CarouselNext
              disabled={nav.next.disabled || nav.next.loading}
              onClick={handleNext}
              aria-label={t("next")}
              className="static translate-y-0 h-10 w-10 inline-flex items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              {nav.next.loading ? (
                <span className="animate-spin inline-block h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <span className="sr-only">{t("next")}</span>
            </CarouselNext>
          </>
        ) : (
          !isModal && (
            <button
              onClick={() => router.push("/")}
              className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              {t("backToList") || "Back to Events"}
            </button>
          )
        )}
      </div>
      {isModal && (
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-100 hover:text-foreground dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300 dark:hover:bg-gray-800"
          aria-label={t("closeModal")}
        >
          <span className="sr-only">{t("closeModal")}</span>
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  )

  const currentSlide = (
    <CarouselItem>
      {isPending ? (
        <EventDetailView loading={true} labels={labels} eventName="" location="" schedules={[]} />
      ) : error ? (
        <EventDetailView error={{ message: (error as Error).message || "Unknown error" }} labels={labels} eventName="" location="" schedules={[]} />
      ) : mappedProps ? (
        <EventDetailView {...mappedProps} />
      ) : null}
    </CarouselItem>
  )

  const detailViewContent = (
    <Carousel className="w-full" setApi={setEmblaApi} opts={{ startIndex: currentSlideIndex }}>
      <div className="space-y-4">
        <div aria-live="polite" className="sr-only">
          {liveMessage}
        </div>
        {navigationHeader}
        <CarouselContent>
          {nav.hasListContext && !nav.previous.disabled && (
            <CarouselItem>
              <EventPreviewCard
                imageUrl={nav.previous.target?.item.imageUrl}
                imageAlt={nav.previous.target?.item.eventName ?? ""}
              />
            </CarouselItem>
          )}
          {currentSlide}
          {nav.hasListContext && !nav.next.disabled && (
            <CarouselItem>
              <EventPreviewCard
                imageUrl={nav.next.target?.item.imageUrl}
                imageAlt={nav.next.target?.item.eventName ?? ""}
              />
            </CarouselItem>
          )}
        </CarouselContent>
      </div>
    </Carousel>
  )

  if (isModal) {
    return (
      <>
        {detailViewContent}
        {isCorrectionDialogOpen && data?.eventBySlug && (
          <CorrectionDialog
            isOpen={isCorrectionDialogOpen}
            onClose={() => setIsCorrectionDialogOpen(false)}
            event={data.eventBySlug as any}
          />
        )}
        {isReportDialogOpen && eventId && (
          <ReportDialog
            isOpen={isReportDialogOpen}
            onClose={() => setIsReportDialogOpen(false)}
            eventId={eventId}
            onReported={() => setIsHiddenAfterReport(true)}
          />
        )}
      </>
    )
  }

  return (
    <PageContainer fullWidth={false} className="max-w-full lg:max-w-5xl mx-auto">
      <div className="bg-background border border-gray-100 dark:border-gray-800 rounded-xl my-6 shadow-sm">
        {detailViewContent}
        {isCorrectionDialogOpen && data?.eventBySlug && (
          <CorrectionDialog
            isOpen={isCorrectionDialogOpen}
            onClose={() => setIsCorrectionDialogOpen(false)}
            event={data.eventBySlug as any}
          />
        )}
        {isReportDialogOpen && eventId && (
          <ReportDialog
            isOpen={isReportDialogOpen}
            onClose={() => setIsReportDialogOpen(false)}
            eventId={eventId}
            onReported={() => setIsHiddenAfterReport(true)}
          />
        )}
      </div>
    </PageContainer>
  )
}
