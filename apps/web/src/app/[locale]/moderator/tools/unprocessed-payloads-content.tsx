"use client"

import React, { useState } from "react"
import { useTranslations } from "next-intl"
import { RouteLoader, BlockingLoader, PaginationControls, useListPaginationController } from "@festgrid/ui"
import { useRequireModerator } from "@/features/auth/use-require-moderator"
import { usePostHog } from "@festgrid/analytics"
import { toast } from "sonner"
import { useUnprocessedPayloadsQuery, useReprocessPayloadMutation, useDeleteUnprocessedPayloadMutation } from "./unprocessed-payloads-hooks"
import { PayloadListItem } from "./payload-list-item"
import { FilterPanel } from "./filter-panel"
import type { UnprocessedPayloadFilters } from "./types"
import { usePaginationLabels } from "@/features/pagination/use-pagination-labels"
import { useReportConnectionPageMeta } from "@/features/pagination/use-report-connection-page-meta"
import { EmptyPageNotice } from "@/features/pagination/empty-page-notice"

const PAGE_SIZE = 20

interface FilterState {
  source: string | null
  createdAfter: string | null
  createdBefore: string | null
  sortOrder: "newest" | "oldest"
}

const DEFAULT_FILTERS: FilterState = {
  source: null,
  createdAfter: null,
  createdBefore: null,
  sortOrder: "newest",
}

export function UnprocessedPayloadsContent() {
  const t = useTranslations("UnprocessedPayloadsPage")
  const { status: authStatus } = useRequireModerator()
  const posthog = usePostHog()

  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)

  const graphqlFilters: UnprocessedPayloadFilters = {
    source: filters.source,
    createdAfter: filters.createdAfter,
    createdBefore: filters.createdBefore,
  }

  const pagination = useListPaginationController<UnprocessedPayloadFilters, string | undefined>({ filterKey: graphqlFilters, initialCursor: undefined })

  // Query unprocessed payloads
  const { data: payloadsData, isLoading: isLoadingPayloads, isPlaceholderData, error: payloadsError, refetch: refetchPayloads } = useUnprocessedPayloadsQuery(graphqlFilters, pagination.cursor, PAGE_SIZE, authStatus === "authorized")

  // Mutations
  const { mutateAsync: reprocessPayload, isPending: isReprocessing } = useReprocessPayloadMutation()
  const { mutateAsync: deletePayload, isPending: isDeleting } = useDeleteUnprocessedPayloadMutation()

  const queryResult = payloadsData?.queryUnprocessedPayloads
  // While the previous page is still on screen as placeholder data its numbers must not be reported for the new one.
  useReportConnectionPageMeta(pagination, isPlaceholderData ? undefined : queryResult)
  const paginationLabels = usePaginationLabels(pagination.pageIndex, pagination.totalCount, PAGE_SIZE)

  if (authStatus === "loading" || authStatus === "unauthenticated" || authStatus === "unauthorized") {
    return <RouteLoader />
  }

  if (isLoadingPayloads) {
    return <RouteLoader />
  }

  const handleFilterChange = (newFilters: Partial<FilterState>) => {
    // No refetch here: a changed filter changes the query key, so the query refetches by itself. A refetch called
    // from this handler still belongs to the OLD key (state updates after the handler returns), so it only
    // re-requested the page that was about to be replaced.
    setFilters((prev) => ({ ...prev, ...newFilters }))
  }

  const handleClearFilters = () => {
    setFilters(DEFAULT_FILTERS)
    // With no filter set the controller's filter key does not change, so it would not return to page 1 by itself.
    pagination.resetToFirstPage()
  }

  const handleReprocess = async (payloadId: string, parserVersion: string) => {
    try {
      const result = await reprocessPayload({ payloadId, parserVersion })
      if (result.success) {
        toast.success(t("reprocessSuccessToast", { trackingId: payloadId }))
        // A successful reprocess soft-deletes the payload row server-side (it's now
        // resolved as a real post), so refetch to drop it from the list like a delete would.
        refetchPayloads()
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

  const edges = queryResult?.edges || []
  const isEmpty = edges.length === 0 && !pagination.hasPrevPage
  const endCursor = queryResult?.pageInfo?.endCursor

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">{t("pageHeading")}</h1>
          <p className="mt-2 text-muted-foreground">{t("pageDescription")}</p>
        </div>

        <FilterPanel filters={filters} onFilterChange={handleFilterChange} onClear={handleClearFilters} />

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
          <div className={`mt-8 space-y-4${isPlaceholderData ? ' opacity-60 transition-opacity' : ''}`}>
            {edges.length === 0 && !payloadsError && <EmptyPageNotice />}
            {edges.map((edge) => (
              <PayloadListItem key={edge.node.id} payload={edge.node} onReprocess={handleReprocess} onDelete={handleDelete} isReprocessing={isReprocessing} isDeleting={isDeleting} />
            ))}

            <PaginationControls
              hasPrevPage={pagination.hasPrevPage}
              hasNextPage={pagination.hasNextPage && Boolean(endCursor)}
              onPrev={pagination.goToPrevPage}
              onNext={() => {
                if (endCursor) pagination.goToNextPage(endCursor)
              }}
              disabled={isPlaceholderData}
              labels={paginationLabels}
            />
          </div>
        )}
      </div>

      <BlockingLoader active={isReprocessing || isDeleting} />
    </div>
  )
}
