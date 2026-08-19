"use client"

import React, { useState } from "react"
import { useTranslations } from "next-intl"
import { type UnprocessedScraperPayload } from "./types"
import { PayloadDetail } from "./payload-detail"

interface PayloadListItemProps {
  payload: UnprocessedScraperPayload
  onReprocess: (payloadId: string, parserVersion: string) => Promise<void>
  onDelete: (payloadId: string) => Promise<void>
  isReprocessing: boolean
  isDeleting: boolean
}

export function PayloadListItem({ payload, onReprocess, onDelete, isReprocessing, isDeleting }: PayloadListItemProps) {
  const t = useTranslations("UnprocessedPayloadsPage")
  const [isExpanded, setIsExpanded] = useState(false)
  const [isDeleted, setIsDeleted] = useState(false)

  if (isDeleted) {
    return null
  }

  const sourceLabel =
    payload.context.source === "APIFY" ? t("sourceApify") : payload.context.source === "BRIGHT_DATA" ? t("sourceBrightData") : t("sourceGemini")

  const timestamp = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(payload.context.timestamp))

  const errorSummary = payload.validationError.message.substring(0, 80)
  const hasMoreError = payload.validationError.message.length > 80

  return (
    <div className={`rounded-lg border transition-opacity ${isDeleting ? "opacity-60 line-through" : "opacity-100"}`}>
      <div className="bg-card p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex-1 space-y-2">
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <div className="text-xs font-medium text-muted-foreground">{timestamp}</div>
              <div className="inline-flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs font-medium">{sourceLabel}</span>
                {payload.context.scraperVendor && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs font-medium">{payload.context.scraperVendor}</span>
                )}
              </div>
            </div>
            {payload.context.accountId && <div className="text-sm text-muted-foreground">{t("payloadAccountId")}: {payload.context.accountId}</div>}
            {payload.context.postUrl && (
              <div className="text-sm">
                <a href={payload.context.postUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
                  {payload.context.postUrl.substring(0, 60)}...
                </a>
              </div>
            )}
            <div className="text-sm text-muted-foreground">
              {errorSummary}
              {hasMoreError && "..."}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
              aria-expanded={isExpanded}
              aria-label={isExpanded ? t("collapseButtonLabel") : t("expandButtonLabel")}
            >
              {isExpanded ? t("collapseButtonLabel") : t("expandButtonLabel")}
            </button>
            <button
              onClick={() => {
                setIsDeleted(true)
                onDelete(payload.id)
              }}
              className="inline-flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/20"
              disabled={isDeleting}
            >
              {isDeleting ? t("deletingLabel") : t("deleteButton")}
            </button>
          </div>
        </div>

        {isExpanded && <PayloadDetail payload={payload} onReprocess={onReprocess} isReprocessing={isReprocessing} />}
      </div>
    </div>
  )
}
