"use client"

import { EventDetailSkeleton } from "@festgrid/ui"
import { useTranslations } from "next-intl"

/**
 * The event-detail loading state for route-level boundaries (the intercepted modal's
 * `@modal/loading.tsx` and the event pages' inline `<Suspense>` fallbacks): the shared
 * `EventDetailSkeleton` with its localized accessible name. Event detail uses a content-shaped
 * skeleton, not the generic `RouteLoader` logo -- see project-context.md, "Route-Level Suspense
 * Fallback" (event-detail exception).
 */
export function EventDetailLoading() {
  const t = useTranslations("EventDetailsPage")
  return <EventDetailSkeleton label={t("loadingText")} />
}
