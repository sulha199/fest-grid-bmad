import { Suspense } from "react"
import { RouteLoader } from "@festgrid/ui"
import { getTranslations } from "next-intl/server"
import { buildPageMetadata } from "@/lib/metadata"
import { SubscriptionsContent } from "./subscriptions-content"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const resolvedParams = await params
  const t = await getTranslations({ locale: resolvedParams.locale, namespace: "Metadata" })

  return buildPageMetadata({
    title: t("subscriptionsTitle"),
    description: t("subscriptionsDescription"),
  })
}

export default function SubscriptionsPage() {
  return (
    <Suspense fallback={<RouteLoader />}>
      <SubscriptionsContent />
    </Suspense>
  )
}
