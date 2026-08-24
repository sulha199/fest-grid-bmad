"use client"

import * as React from "react"
import { useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

export function QueryProvider({
  children,
}: {
  children: React.ReactNode
}) {
  // Default staleTime is 0, so every remount/window-refocus/reconnect refetches even
  // queries that were fetched moments ago (e.g. me/myApiKeys, mounted once in the root
  // layout but re-triggered by focus/reconnect events during normal browsing). 30s
  // keeps that data reasonably fresh without refetching on every tab switch. Callers
  // that need tighter freshness already override this per-query (see
  // app/[locale]/moderator/actor-runs/hooks.ts's explicit staleTime: 0).
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
      },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
