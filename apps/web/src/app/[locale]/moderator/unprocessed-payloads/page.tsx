import { Suspense } from "react"
import { RouteLoader } from "@festgrid/ui"
import { getTranslations } from "next-intl/server"
import { buildPageMetadata } from "@/lib/metadata"
import { UnprocessedPayloadsContent } from "./unprocessed-payloads-content"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const resolvedParams = await params
  const t = await getTranslations({ locale: resolvedParams.locale, namespace: "Metadata" })

  return buildPageMetadata({
    title: t("unprocessedPayloadsTitle"),
    description: t("unprocessedPayloadsDescription"),
  })
}

export default function UnprocessedPayloadsPage() {
  return (
    <Suspense fallback={<RouteLoader />}>
      <UnprocessedPayloadsContent />
    </Suspense>
  )
}
