import { getTranslations } from "next-intl/server"
import { buildPageMetadata } from "@/lib/metadata"
import { graphqlClient } from "@/lib/graphql-client"
import { GetEventBySlugDocument, GetEventBySlugQuery } from "@/generated/graphql"
import { EventDetailWrapper } from "@/features/events/EventDetailWrapper"
import { Suspense } from "react"

interface PageProps {
  params: Promise<{ slug: string; locale: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const resolvedParams = await params
  const { slug, locale } = resolvedParams

  let title = "Event Details"
  let description = ""

  try {
    const data = await graphqlClient.request<GetEventBySlugQuery>(GetEventBySlugDocument, { slug })
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
  const { slug } = resolvedParams

  return (
    <Suspense>
      <EventDetailWrapper slug={slug} isModal={true} />
    </Suspense>
  )
}
