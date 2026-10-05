import { getTranslations } from "next-intl/server"
import { redirect } from "next/navigation"
import { buildPageMetadata } from "@/lib/metadata"
import { getEventBySlugCached } from "@/features/events/get-event-by-slug-cached"
import { EventDetailWrapper } from "@/features/events/EventDetailWrapper"
import { Suspense } from "react"
import { RouteLoader } from "@festgrid/ui"
import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query"

interface PageProps {
  params: Promise<{ slug: string; locale: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const resolvedParams = await params
  const { slug, locale } = resolvedParams

  let title = "Event Details"
  let description = ""

  try {
    // Story 1.6c (AC2(a), Task 4) — shared, request-deduped, authenticated fetcher. Same call
    // as the page body below; React's `cache()` ensures only one backend fan-out per pageview.
    const data = await getEventBySlugCached(slug)
    if (data?.eventBySlug) {
      const eventName = data.eventBySlug.eventName
      const t = await getTranslations({ locale, namespace: "Metadata" })
      title = t("eventDetailTitle", { eventName })
      description = data.eventBySlug.description || t("eventDetailDescription", { eventName })
    }
  } catch (e) {
    // degrade gracefully on error
  }

  return buildPageMetadata({
    title,
    description,
  })
}

export default async function EventModalPage({ params }: PageProps) {
  const resolvedParams = await params
  const { slug, locale } = resolvedParams

  // Story 1.6c (AC2(a), AC2(c), AC2(d), Task 5) — same memoized call as `generateMetadata`
  // above (no second network request). Seed the per-request QueryClient only when the fetch
  // succeeded; on failure, dehydrate an empty state so the client's own `useGetEventBySlugQuery`
  // fetches fresh and hits its existing not-found/error UI branches (graceful degrade).
  const data = await getEventBySlugCached(slug)

  // Story 3.6v (AC5/AC6) — see the identical comment in the full-page route
  // (events/[slug]/page.tsx). A hard redirect() is never served as an interception (that only
  // applies to a client-side soft navigation), so this always targets the full, non-modal path
  // -- there is no separate "modal URL" a visitor could be redirected to.
  if (data?.eventBySlug && data.eventBySlug.slug !== slug) {
    redirect(`/${locale}/events/${data.eventBySlug.slug}`)
  }

  const queryClient = new QueryClient()
  if (data) {
    queryClient.setQueryData(["getEventBySlug", { slug }], data)
  }
  const dehydratedState = dehydrate(queryClient)

  return (
    <HydrationBoundary state={dehydratedState}>
      <Suspense fallback={<RouteLoader />}>
        <EventDetailWrapper slug={slug} isModal={true} />
      </Suspense>
    </HydrationBoundary>
  )
}
