import { Suspense } from "react"
import { RouteLoader } from "@festgrid/ui"
import { getTranslations } from "next-intl/server"
import { buildPageMetadata } from "@/lib/metadata"
import { ModeratorItemsContent } from "./moderator-items-content"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const resolvedParams = await params
  const t = await getTranslations({ locale: resolvedParams.locale, namespace: "Metadata" })

  return buildPageMetadata({
    title: t("moderatorItemsTitle"),
    description: t("moderatorItemsDescription"),
  })
}

export default function ModeratorItemsPage() {
  return (
    <Suspense fallback={<RouteLoader />}>
      <ModeratorItemsContent />
    </Suspense>
  )
}
