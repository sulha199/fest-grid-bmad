"use client"

import * as React from "react"
import { useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

export function QueryProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
