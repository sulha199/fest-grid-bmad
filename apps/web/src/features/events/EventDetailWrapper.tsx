"use client"

import React, { useEffect, useRef, useState } from "react"
import { useGetEventBySlugQuery, useToggleFavoriteMutation, useToggleCalendarAdditionMutation, useResolveScheduleTimezoneMutation, useMeQuery } from "@/generated/graphql"
import { graphqlClient } from "@/lib/graphql-client"
import { useQueryClient } from "@tanstack/react-query"
import { useAuthSession } from "@/components/providers/auth-session-provider"
import { EventDetailView, PageContainer } from "@festgrid/ui"
import { mapGraphQLEventToDetailViewProps, useEventDetailViewLabels } from "./mapper"
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

  const { data: meData } = useMeQuery(
    graphqlClient,
    undefined,
    {
      enabled: !!session,
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
          },
        }
      })
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
    },
    onSuccess: (data, variables) => {
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

  const eventId = data?.eventBySlug?.id || ""
  const nav = useListNavigationForEvent(eventId, isModal)

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

    try {
      await Promise.all(
        changedIds.map((scheduleId) => toggleCalendarAddition({ eventId, scheduleId }))
      )

      if (addedIds.length > 0) {
        const queryParams = new URLSearchParams()
        queryParams.set("eventId", eventId)
        addedIds.forEach((id) => {
          queryParams.append("scheduleId", id)
        })
        window.location.assign(`/api/calendar/ics?${queryParams.toString()}`)

        posthog.capture("calendar_ics_downloaded", {
          eventId,
          scheduleIds: addedIds,
        })
      }

      toast.success(t("addToCalendarSuccessAnnouncement"))
    } catch (e) {
      console.error("Failed to update calendar additions", e)
    }
  }

  const mappedProps = data?.eventBySlug
    ? {
        ...mapGraphQLEventToDetailViewProps(data.eventBySlug, labels, locale, tType, tCategory),
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
        onResolveScheduleTimezone: (scheduleId: string, timezone: string) => {
          if (!session) {
            router.push("/login")
            return
          }
          resolveScheduleTimezone({ scheduleId, timezone })
        },
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
        }
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
    <PageContainer fullWidth={true}>
      <div className="bg-background border border-gray-100 dark:border-gray-800 rounded-xl my-6 shadow-sm p-4 sm:p-8">
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
