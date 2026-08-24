"use client"

import React, { useState, useEffect, useRef } from "react"
import { useTranslations } from "next-intl"
import { RouteLoader, BlockingLoader } from "@festgrid/ui"
import { useRequireModerator } from "@/features/auth/use-require-moderator"
import { graphqlClient } from "@/lib/graphql-client"
import { usePostHog } from "@festgrid/analytics"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { SetDefaultLocationDialog } from "../../settings/subscriptions/set-default-location-dialog"
import {
  useGetReportedEventsQuery,
  useResolveReportsForEventMutation,
  useDeleteEventPermanentlyMutation,
  useIgnoreSubsequentReportsMutation,
  useGetPendingDefaultLocationChangesQuery,
  useResolveDefaultLocationChangeMutation,
  ReportStatus,
  ReportReason,
  DefaultLocationChangeAction,
} from "@/generated/graphql"
import { ReportedEventGroup, type Report } from "./reported-event-group"
import { PendingLocationChangeRow, type PendingLocationChange } from "./pending-location-change-row"

export function ModeratorItemsContent() {
  const t = useTranslations("ModeratorItemsPage")
  const tStatus = useTranslations("ReportStatus")
  const tReason = useTranslations("ReportReason")
  const { status: authStatus } = useRequireModerator()
  const posthog = usePostHog()
  const queryClient = useQueryClient()

  const [editingChangeId, setEditingChangeId] = useState<string | null>(null)

  // Filters for reported events
  const [statusFilter, setStatusFilter] = useState<ReportStatus | "ALL">(ReportStatus.Pending)
  const [reasonFilter, setReasonFilter] = useState<ReportReason | "ALL">("ALL")

  // Query reported events
  const {
    data: reportsData,
    isLoading: reportsLoading,
    error: reportsError,
    refetch: refetchReports,
  } = useGetReportedEventsQuery(
    graphqlClient,
    {
      status: statusFilter === "ALL" ? undefined : statusFilter,
      reason: reasonFilter === "ALL" ? undefined : reasonFilter,
    },
    {
      enabled: authStatus === "authorized",
    }
  )

  // Query location changes
  const {
    data: changesData,
    isLoading: changesLoading,
    error: changesError,
    refetch: refetchChanges,
  } = useGetPendingDefaultLocationChangesQuery(
    graphqlClient,
    undefined,
    {
      enabled: authStatus === "authorized",
    }
  )

  // Mutations
  const { mutateAsync: resolveReports, isPending: isResolvingReports } = useResolveReportsForEventMutation(graphqlClient)
  const { mutateAsync: deleteEvent, isPending: isDeletingEvent } = useDeleteEventPermanentlyMutation(graphqlClient)
  const { mutateAsync: ignoreReporter, isPending: isIgnoringReporter } = useIgnoreSubsequentReportsMutation(graphqlClient)
  const { mutateAsync: resolveChange, isPending: isResolvingChange } = useResolveDefaultLocationChangeMutation(graphqlClient)

  // Analytics view track ref
  const hasTrackedView = useRef(false)

  useEffect(() => {
    if (authStatus === "authorized" && !reportsLoading && !changesLoading && reportsData && changesData && !hasTrackedView.current) {
      hasTrackedView.current = true
      posthog.capture("moderator_items_page_viewed", {
        pendingReportGroupCount: reportsData?.reportedEvents?.length || 0,
        pendingLocationChangeCount: changesData?.pendingDefaultLocationChanges?.length || 0,
      })
    }
  }, [authStatus, reportsLoading, changesLoading, reportsData, changesData, posthog])

  // Intercept edit mutation success on queryClient mutation cache to fire PostHog event & Toast
  useEffect(() => {
    const unsubscribe = queryClient.getMutationCache().subscribe((event) => {
      if (
        event.type === "updated" &&
        event.action.type === "success" &&
        event.mutation.options.mutationKey?.[0] === "editAccountDefaultLocation"
      ) {
        const variables = event.mutation.state.variables as { accountId: string } | undefined
        if (variables?.accountId) {
          const changesListLocal = (changesData?.pendingDefaultLocationChanges || []) as PendingLocationChange[]
          const supersededRequest = changesListLocal.find((c) => c.accountId === variables.accountId)
          if (supersededRequest) {
            posthog.capture("moderator_default_location_corrected", {
              accountId: variables.accountId,
              supersededRequestId: supersededRequest.id,
            })
            toast.success(t("moderatorLocationCorrectedToast"))
          }
        }
      }
    })
    return () => unsubscribe()
  }, [queryClient, changesData, posthog, t])

  if (authStatus === "loading" || authStatus === "unauthenticated" || authStatus === "unauthorized") {
    return <RouteLoader />
  }

  const isLoading = reportsLoading || changesLoading
  const error = reportsError || changesError

  const refetchAll = () => {
    refetchReports()
    refetchChanges()
  }

  if (isLoading) {
    return <RouteLoader />
  }

  if (error) {
    return (
      <div className="p-4 sm:p-8 max-w-4xl mx-auto text-center space-y-4">
        <h1 className="text-xl font-bold text-destructive">{t("errorTitle")}</h1>
        <p className="text-muted-foreground">{t("errorDescription")}</p>
        <button
          onClick={refetchAll}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
        >
          {t("retryBtn")}
        </button>
      </div>
    )
  }

  const reportsList = (reportsData?.reportedEvents || []) as Report[]
  const changesList = (changesData?.pendingDefaultLocationChanges || []) as PendingLocationChange[]

  // Group reported events by event.id
  const reportsByEventId: { [eventId: string]: Report[] } = {}
  reportsList.forEach((r) => {
    if (!reportsByEventId[r.eventId]) {
      reportsByEventId[r.eventId] = []
    }
    reportsByEventId[r.eventId].push(r)
  })

  // Handlers
  const handleResolveReports = async (eventId: string) => {
    try {
      const reportsInGroup = reportsByEventId[eventId] || []
      const result = await resolveReports({ eventId })
      const firstReport = reportsInGroup[0]
      const actionLabel = firstReport?.event?.deletedAt ? "restore" : "mark_safe"
      
      posthog.capture("moderator_report_resolved", {
        eventId,
        action: actionLabel,
        resolvedReportCount: reportsInGroup.length,
      })

      toast.success("Reports resolved successfully")
      refetchReports()
    } catch (err) {
      toast.error("Failed to resolve reports")
    }
  }

  const handleDeletePermanently = async (eventId: string) => {
    try {
      const reportsInGroup = reportsByEventId[eventId] || []
      await deleteEvent({ id: eventId })
      
      posthog.capture("moderator_report_resolved", {
        eventId,
        action: "delete_permanently",
        resolvedReportCount: reportsInGroup.length,
      })

      toast.success("Event permanently deleted")
      refetchReports()
    } catch (err) {
      toast.error("Failed to delete event permanently")
    }
  }

  const handleIgnoreReporter = async (reportId: string) => {
    try {
      await ignoreReporter({ reportId })
      
      posthog.capture("moderator_subsequent_reports_ignored", {
        reportId,
      })

      toast.success("Reporter subsequent reports will be ignored")
      refetchReports()
    } catch (err) {
      toast.error("Failed to ignore reporter")
    }
  }

  const handleResolveLocationChange = async (id: string, action: "ACCEPT" | "REVERT") => {
    try {
      if (editingChangeId === id) {
        setEditingChangeId(null)
      }
      const actionEnum = action === "ACCEPT" ? DefaultLocationChangeAction.Accept : DefaultLocationChangeAction.Revert
      await resolveChange({ id, action: actionEnum })
      
      posthog.capture("moderator_default_location_change_resolved", {
        requestId: id,
        action: action.toLowerCase() as "accept" | "revert",
      })

      toast.success(`Location change successfully ${action === "ACCEPT" ? "accepted" : "reverted"}`)
      refetchChanges()
    } catch (err) {
      toast.error("Failed to resolve location change")
    }
  }

  const mapToLocationDetails = (newLocation: PendingLocationChange["newLocation"]) => {
    return {
      formattedAddress: newLocation.formattedAddress ?? undefined,
      placeName: newLocation.placeName ?? undefined,
      placeId: newLocation.placeId ?? undefined,
      coordinates: {
        latitude: newLocation.coordinates.lat,
        longitude: newLocation.coordinates.lng,
      },
    }
  }

  const handleCloseEditDialog = () => {
    setEditingChangeId(null)
    refetchChanges()
  }

  const editingChange = changesList.find((c) => c.id === editingChangeId) ?? null

  const isMutating = isResolvingReports || isDeletingEvent || isIgnoringReporter || isResolvingChange

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-5xl mx-auto">
      <BlockingLoader active={isMutating} />

      <div>
        <h1 className="text-3xl font-bold">{t("pageTitle")}</h1>
        <p className="text-muted-foreground mt-2">{t("pageDescription")}</p>
      </div>

      {/* Reported Events Section */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
          <h2 className="text-2xl font-semibold">{t("reportedEventsSection")}</h2>
          
          {/* Filters */}
          <div className="flex flex-wrap gap-2 text-sm">
            <div className="flex items-center space-x-2">
              <label htmlFor="status-filter" className="text-muted-foreground font-medium">
                {t("filterStatusLabel")}
              </label>
              <select
                id="status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-background border rounded px-2 py-1"
              >
                <option value="ALL">{t("allOption")}</option>
                <option value={ReportStatus.Pending}>{tStatus("pending")}</option>
                <option value={ReportStatus.Upheld}>{tStatus("upheld")}</option>
                <option value={ReportStatus.Dismissed}>{tStatus("dismissed")}</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <label htmlFor="reason-filter" className="text-muted-foreground font-medium">
                {t("filterReasonLabel")}
              </label>
              <select
                id="reason-filter"
                value={reasonFilter}
                onChange={(e) => setReasonFilter(e.target.value as any)}
                className="bg-background border rounded px-2 py-1"
              >
                <option value="ALL">{t("allOption")}</option>
                <option value={ReportReason.Cancelled}>{tReason("cancelled")}</option>
                <option value={ReportReason.Dangerous}>{tReason("dangerous")}</option>
                <option value={ReportReason.Personal}>{tReason("personal")}</option>
              </select>
            </div>
          </div>
        </div>

        {Object.keys(reportsByEventId).length === 0 ? (
          <div className="border rounded-lg p-8 bg-card text-center text-muted-foreground text-sm shadow-sm">
            {t("emptyReportedEvents")}
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(reportsByEventId).map(([eventId, list]) => (
              <ReportedEventGroup
                key={eventId}
                eventId={eventId}
                reports={list}
                onResolveReports={handleResolveReports}
                onDeletePermanently={handleDeletePermanently}
                onIgnoreReporter={handleIgnoreReporter}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pending Location Changes Section */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold border-b pb-4">{t("pendingLocationChangesSection")}</h2>
        {changesList.length === 0 ? (
          <div className="border rounded-lg p-8 bg-card text-center text-muted-foreground text-sm shadow-sm">
            {t("emptyLocationChanges")}
          </div>
        ) : (
          <div className="space-y-4">
            {changesList.map((change) => (
              <PendingLocationChangeRow
                key={change.id}
                change={change}
                onResolve={handleResolveLocationChange}
                onEditRequest={setEditingChangeId}
              />
            ))}
          </div>
        )}
      </div>

      {/* Set Default Location Dialog */}
      {editingChange && (
        <SetDefaultLocationDialog
          accountId={editingChange.accountId}
          isOpen={!!editingChangeId}
          onClose={handleCloseEditDialog}
          mode="edit"
          initialLocation={mapToLocationDetails(editingChange.newLocation)}
        />
      )}
    </div>
  )
}
