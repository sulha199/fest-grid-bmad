"use client"

import React, { useState } from "react"
import { Link } from "@/i18n/navigation"
import { StatusBadge } from "@festgrid/ui"
import { useTranslations } from "next-intl"

export interface Report {
  id: string
  eventId: string
  reporterUserId: string
  reason: string
  details?: string | null
  status: string
  createdAt: string
  moderatorIgnored: boolean
  event: {
    id: string
    slug: string
    eventName: string
    imageUrl?: string | null
    deletedAt?: string | null
  }
}

interface ReportedEventGroupProps {
  eventId: string
  reports: Report[]
  onResolveReports: (eventId: string) => Promise<void>
  onDeletePermanently: (eventId: string) => Promise<void>
  onIgnoreReporter: (reportId: string) => Promise<void>
}

export function ReportedEventGroup({
  eventId,
  reports,
  onResolveReports,
  onDeletePermanently,
  onIgnoreReporter,
}: ReportedEventGroupProps) {
  const t = useTranslations("ModeratorItemsPage")
  const tReason = useTranslations("ReportReason")
  const tStatus = useTranslations("ReportStatus")
  const [confirmDelete, setConfirmDelete] = useState(false)

  const firstReport = reports[0]
  if (!firstReport) return null
  const event = firstReport.event

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    e.currentTarget.style.display = "none"
  }

  // Get dangerous reports that are NOT already moderatorIgnored
  const dangerousReports = reports.filter((r) => r.reason === "dangerous" && !r.moderatorIgnored)
  
  // Group dangerous reports by distinct reporterUserId to render the "Ignore" button exactly once per reporter
  const uniqueDangerousReporters: { [reporterUserId: string]: Report } = {}
  dangerousReports.forEach((r) => {
    if (!uniqueDangerousReporters[r.reporterUserId]) {
      uniqueDangerousReporters[r.reporterUserId] = r
    }
  })

  return (
    <div className="border rounded-lg bg-card shadow-sm overflow-hidden flex flex-col md:flex-row">
      {/* Event Image */}
      <div className="w-full md:w-48 h-32 md:h-auto relative shrink-0 border-b md:border-b-0 md:border-r bg-muted">
        {event.imageUrl ? (
          <img
            src={event.imageUrl}
            alt={event.eventName}
            onError={handleImageError}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs font-semibold">
            No Image
          </div>
        )}
      </div>

      {/* Group Content */}
      <div className="p-4 sm:p-6 flex-1 flex flex-col justify-between space-y-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-bold text-foreground">
              <Link href={`/events/${event.slug}`} className="hover:underline">
                {event.eventName}
              </Link>
            </h3>
            {event.deletedAt && (
              <span className="text-xs bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300 px-2 py-0.5 rounded font-semibold mt-1 inline-block">
                Soft-Deleted
              </span>
            )}
          </div>

          {/* List of reports */}
          <div className="border rounded-md divide-y overflow-hidden text-sm bg-muted/20">
            {reports.map((r) => (
              <div key={r.id} className="p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-foreground">
                      {tReason(r.reason as any) || r.reason}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t("byReporterLabel")} {r.reporterUserId.slice(0, 8)}...
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </span>
                    <StatusBadge variant={r.status as any} label={tStatus(r.status as any) || r.status} />
                  </div>
                </div>
                {r.details && (
                  <p className="text-xs text-muted-foreground italic pl-2 border-l-2 border-muted">
                    "{r.details}"
                  </p>
                )}
                {/* Nested Ignore future reports action */}
                {r.reason === "dangerous" && uniqueDangerousReporters[r.reporterUserId]?.id === r.id && (
                  <div className="pt-2">
                    <button
                      onClick={() => onIgnoreReporter(r.id)}
                      className="inline-flex items-center justify-center rounded-md text-xs font-medium transition-colors border border-input bg-background hover:bg-accent hover:text-accent-foreground h-7 px-3"
                    >
                      {t("buttonIgnoreFutureReports")}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Actions bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 pt-4 border-t">
          {confirmDelete ? (
            <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
              <span className="text-xs text-destructive font-medium text-center sm:text-right">
                {t("buttonDeletePermanentlyConfirm")}
              </span>
              <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                <button
                  onClick={() => {
                    onDeletePermanently(event.id)
                    setConfirmDelete(false)
                  }}
                  className="inline-flex items-center justify-center rounded-md text-xs font-medium transition-colors bg-red-600 text-white hover:bg-red-700 h-8 px-3"
                >
                  Yes, Delete
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="inline-flex items-center justify-center rounded-md text-xs font-medium transition-colors border border-input bg-background hover:bg-accent h-8 px-3"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center space-x-2 self-end">
              <button
                onClick={() => onResolveReports(event.id)}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-green-600 text-white hover:bg-green-700 h-9 px-4 py-2"
              >
                {event.deletedAt ? t("buttonRestore") : t("buttonMarkSafe")}
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-destructive text-destructive-foreground hover:bg-destructive/90 h-9 px-4 py-2"
              >
                {t("buttonDeletePermanently")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
