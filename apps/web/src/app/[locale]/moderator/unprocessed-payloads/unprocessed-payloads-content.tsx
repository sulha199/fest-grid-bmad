"use client"

import React, { useState } from "react"
import { useTranslations } from "next-intl"
import { RouteLoader, BlockingLoader } from "@festgrid/ui"
import { useRequireModerator } from "@/features/auth/use-require-moderator"
import { usePostHog } from "@festgrid/analytics"
import { toast } from "sonner"
import { useUnprocessedPayloadsQuery, useReprocessPayloadMutation, useDeleteUnprocessedPayloadMutation } from "./hooks"
import { PayloadListItem } from "./payload-list-item"
import { FilterPanel } from "./filter-panel"
import type { UnprocessedPayloadFilters } from "./types"

interface FilterState {
  source: string | null
  createdAfter: string | null
  createdBefore: string | null
  sortOrder: "newest" | "oldest"
}

export function UnprocessedPayloadsContent() {
  const t = useTranslations("UnprocessedPayloadsPage")
  const { status: authStatus } = useRequireModerator()
  const posthog = usePostHog()

  const [filters, setFilters] = useState<FilterState>({
    source: null,
    createdAfter: null,
    createdBefore: null,
    sortOrder: "newest",
  })

  const [cursor, setCursor] = useState<string | undefined>(undefined)

  const graphqlFilters: UnprocessedPayloadFilters = {
    source: filters.source,
    createdAfter: filters.createdAfter,
    createdBefore: filters.createdBefore,
  }

  // Query unprocessed payloads
  const { data: payloadsData, isLoading: isLoadingPayloads, error: payloadsError, refetch: refetchPayloads } = useUnprocessedPayloadsQuery(graphqlFilters, cursor, 20, authStatus === "authorized")

  // Mutations
  const { mutateAsync: reprocessPayload, isPending: isReprocessing } = useReprocessPayloadMutation()
  const { mutateAsync: deletePayload, isPending: isDeleting } = useDeleteUnprocessedPayloadMutation()

  if (authStatus === "loading" || authStatus === "unauthenticated" || authStatus === "unauthorized") {
    return <RouteLoader />
  }

  if (isLoadingPayloads) {
    return <RouteLoader />
  }

  const handleFilterChange = (newFilters: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }))
    setCursor(undefined)
    refetchPayloads()
  }

  const handleReprocess = async (payloadId: string, parserVersion: string) => {
    try {
      const result = await reprocessPayload({ payloadId, parserVersion })
      if (result.success) {
        toast.success(t("reprocessSuccessToast", { trackingId: payloadId }))
      } else {
        toast.error(t("reprocessErrorToast", { message: result.message || "Unknown error" }))
      }
    } catch (error) {
      toast.error(t("reprocessErrorToast", { message: error instanceof Error ? error.message : "Unknown error" }))
    }
  }

  const handleDelete = async (payloadId: string) => {
    try {
      const success = await deletePayload({ payloadId })
      if (success) {
        toast.success(t("deleteSuccessToast"), {
          action: {
            label: t("deleteUndoButton"),
            onClick: async () => {
              await refetchPayloads()
            },
          },
        })
        await refetchPayloads()
      } else {
        toast.error(t("deleteErrorToast"))
      }
    } catch (error) {
      toast.error(t("deleteErrorToast"))
    }
  }

  const queryResult = payloadsData?.queryUnprocessedPayloads
  const edges = queryResult?.edges || []
  const hasNextPage = queryResult?.pageInfo?.hasNextPage || false
  const isEmpty = edges.length === 0 && !cursor

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">{t("pageHeading")}</h1>
          <p className="mt-2 text-muted-foreground">{t("pageDescription")}</p>
        </div>

        <FilterPanel filters={filters} onFilterChange={handleFilterChange} />

        {payloadsError && (
          <div className="mt-8 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <div className="flex items-center gap-3">
              <div className="text-destructive">✕</div>
              <div>
                <h3 className="font-semibold">{t("errorHeadline")}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{(payloadsError as any)?.message || "An error occurred"}</p>
              </div>
            </div>
            <button onClick={() => refetchPayloads()} className="mt-4 text-sm font-medium text-primary hover:underline">
              {t("errorTryAgain")}
            </button>
          </div>
        )}

        {isEmpty && !payloadsError && (
          <div className="mt-12 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <svg className="h-6 w-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold">{t("emptyHeadline")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{t("emptyMessage")}</p>
          </div>
        )}

        {!isEmpty && (
          <div className="mt-8 space-y-4">
            {edges.map((edge) => (
              <PayloadListItem key={edge.node.id} payload={edge.node} onReprocess={handleReprocess} onDelete={handleDelete} isReprocessing={isReprocessing} isDeleting={isDeleting} />
            ))}

            {hasNextPage && (
              <button
                onClick={() => {
                  setCursor(queryResult?.pageInfo?.endCursor || undefined)
                  refetchPayloads()
                }}
                className="w-full py-3 text-center text-sm font-medium text-primary hover:underline"
              >
                Load more
              </button>
            )}
          </div>
        )}
      </div>

      <BlockingLoader active={isReprocessing || isDeleting} />
    </div>
  )
}
