import { Suspense } from "react"
import { RouteLoader } from "@festgrid/ui"
import { HomeContent } from "./home-content"
import { getTranslations } from "next-intl/server"
import { buildPageMetadata } from "@/lib/metadata"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const resolvedParams = await params;
  const t = await getTranslations({ locale: resolvedParams.locale, namespace: 'Metadata' });

  return buildPageMetadata({
    title: t('discoveryTitle'),
    description: t('discoveryDescription'),
  });
}

export default function Home() {
  return (
    <Suspense fallback={<RouteLoader />}>
      <HomeContent />
    </Suspense>
  )
}
