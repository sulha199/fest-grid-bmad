import { cache } from "react"
import type { ScrapablePlatform } from "@festgrid/domain"
import { graphqlClient } from "@/lib/graphql-client"
import {
  GetSocialMediaAccountProfileByUsernameDocument,
  GetSocialMediaAccountProfileByUsernameQuery,
} from "@/generated/graphql"

export type AccountProfile = NonNullable<
  GetSocialMediaAccountProfileByUsernameQuery["socialMediaAccountProfileByUsername"]
>

/**
 * Architecture Spine AD-35 Rule 6 -- the one account-page lookup. `generateMetadata` and the page
 * body both call it, so they resolve the URL segment identically and agree on `notFound()`; React's
 * `cache()` keeps it to one backend request per pageview.
 *
 * `segment` is the raw URL segment: the backend matches the username first, then (for an
 * all-digit segment) the numeric `account_id`. Returns `null` when nothing matches; request errors
 * propagate so each caller keeps its own policy (metadata degrades, the page hits Next's error
 * boundary).
 */
export const getAccountProfileCached = cache(
  async (platform: ScrapablePlatform, segment: string): Promise<AccountProfile | null> => {
    const data = await graphqlClient.request<GetSocialMediaAccountProfileByUsernameQuery>(
      GetSocialMediaAccountProfileByUsernameDocument,
      { platform, username: segment }
    )
    return data?.socialMediaAccountProfileByUsername ?? null
  }
)
