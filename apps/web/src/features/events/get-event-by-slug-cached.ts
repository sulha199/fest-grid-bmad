import { cache } from "react"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { graphqlClient } from "@/lib/graphql-client"
import { GetEventBySlugDocument, GetEventBySlugQuery } from "@/generated/graphql"

/**
 * Story 1.6c (AC2(a), AC2(b), Task 3) — shared, request-scoped, authenticated `eventBySlug`
 * fetcher for both `/events/[slug]/page.tsx` and its intercepted modal counterpart.
 *
 * - Deduped within one request via React's `cache()`: `generateMetadata` and the page body both
 *   call this function, but only one network request/backend resolver fan-out fires per
 *   pageview (Task 4/5).
 * - Authenticated: reads the visitor's session server-side (`createSupabaseServerClient()`) and
 *   forwards the access token as a per-call `Authorization` header on `graphqlClient.request()`
 *   — never `graphqlClient.setHeader()`, which mutates the shared module-level singleton and
 *   would race across concurrent requests from different users in the same Node process (see
 *   the story's Design Decision Dev Note). Anonymous visitors get no header, exactly as
 *   `generateMetadata`'s previous unauthenticated fetch behaved.
 * - Never throws: any failure (missing session/cookies, network error, GraphQL error) is
 *   swallowed and `null` is returned, so callers can distinguish "no data to hydrate" from
 *   "data present" and fall back to today's client-side fetch + existing not-found/error UI.
 */
export const getEventBySlugCached = cache(
  async (slug: string): Promise<GetEventBySlugQuery | null> => {
    let headers: Record<string, string> | undefined

    try {
      const supabase = await createSupabaseServerClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (session?.access_token) {
        headers = { Authorization: `Bearer ${session.access_token}` }
      }
    } catch {
      // Graceful degrade: fall back to an unauthenticated call rather than failing the request.
      headers = undefined
    }

    try {
      return await graphqlClient.request<GetEventBySlugQuery>(
        GetEventBySlugDocument,
        { slug },
        headers
      )
    } catch {
      return null
    }
  }
)
