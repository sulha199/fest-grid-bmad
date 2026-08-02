"use client"

import React, { useEffect } from "react"
import { useGetEventBySlugQuery } from "@/generated/graphql"
import { graphqlClient } from "@/lib/graphql-client"
import { EventDetailView } from "@festgrid/ui"
import { mapGraphQLEventToDetailViewProps, useEventDetailViewLabels } from "./mapper"
import { useListNavigationForEvent } from "./navigation-hook"
import { useRouter } from "@/i18n/navigation"
import { useSearchParams } from "next/navigation"
import { useTranslations, useLocale } from "next-intl"
import { usePostHog } from "@festgrid/analytics"
import { ChevronLeft, ChevronRight, Home } from "lucide-react"
import { Dialog, DialogContent } from "@/components/ui/dialog"

interface EventDetailWrapperProps {
  slug: string
  isModal?: boolean
}

export const EventDetailWrapper: React.FC<EventDetailWrapperProps> = ({ slug, isModal = false }) => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const posthog = usePostHog()
  const t = useTranslations("EventDetailsPage")
  const labels = useEventDetailViewLabels()
  const locale = useLocale()
  const tType = useTranslations("EventType")
  const tCategory = useTranslations("EventCategory")

  const { data, isPending, error } = useGetEventBySlugQuery(
    graphqlClient,
    { slug }
  )

  const eventId = data?.eventBySlug?.id || ""
  const nav = useListNavigationForEvent(eventId)

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
      router.push(`/events/${target.item.slug}${paramsStr ? `?${paramsStr}` : ""}`)
    }
  }

  const handlePrevious = () => {
    if (nav.previous.target?.item) {
      const paramsStr = searchParams.toString()
      router.push(`/events/${nav.previous.target.item.slug}${paramsStr ? `?${paramsStr}` : ""}`)
    }
  }

  // Not Found view
  if (!isPending && !error && !data?.eventBySlug) {
    const notFoundContent = (
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

    if (isModal) {
      return (
        <Dialog open={true} onOpenChange={(open) => { if (!open) router.back() }}>
          <DialogContent className="max-w-xl p-0 overflow-hidden bg-transparent border-none shadow-none">
            {notFoundContent}
          </DialogContent>
        </Dialog>
      )
    }

    return notFoundContent
  }

  const mappedProps = data?.eventBySlug
    ? mapGraphQLEventToDetailViewProps(data.eventBySlug, labels, locale, tType, tCategory)
    : null

  const navigationHeader = (
    <div className="flex justify-between items-center mb-6 pb-3 border-b border-gray-100 dark:border-gray-800">
      <div className="flex gap-2">
        {nav.hasListContext && (
          <>
            <button
              onClick={handlePrevious}
              disabled={nav.previous.disabled || nav.previous.loading}
              className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              {t("previous")}
            </button>
            <button
              onClick={handleNext}
              disabled={nav.next.disabled || nav.next.loading}
              className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              {nav.next.loading ? (
                <span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
              ) : (
                t("next")
              )}
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
      {isModal && (
        <button
          onClick={() => router.back()}
          className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
          aria-label={t("closeModal")}
        >
          {t("closeModal")}
        </button>
      )}
    </div>
  )

  const detailViewContent = (
    <div className="space-y-4">
      {navigationHeader}
      {isPending ? (
        <EventDetailView loading={true} labels={labels} eventName="" location="" schedules={[]} />
      ) : error ? (
        <EventDetailView error={{ message: (error as any).message || "Unknown error" }} labels={labels} eventName="" location="" schedules={[]} />
      ) : mappedProps ? (
        <EventDetailView {...mappedProps} />
      ) : null}
    </div>
  )

  if (isModal) {
    return (
      <Dialog open={true} onOpenChange={(open) => { if (!open) router.back() }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto p-6 rounded-xl">
          {detailViewContent}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-8 bg-background border border-gray-100 dark:border-gray-800 rounded-xl my-6 shadow-sm">
      {detailViewContent}
    </div>
  )
}
