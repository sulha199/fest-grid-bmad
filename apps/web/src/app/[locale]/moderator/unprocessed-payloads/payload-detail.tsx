"use client"

import React, { useState } from "react"
import { useTranslations } from "next-intl"
import { type UnprocessedScraperPayload } from "./types"

interface PayloadDetailProps {
  payload: UnprocessedScraperPayload
  onReprocess: (payloadId: string, parserVersion: string) => Promise<void>
  isReprocessing: boolean
}

export function PayloadDetail({ payload, onReprocess, isReprocessing }: PayloadDetailProps) {
  const t = useTranslations("UnprocessedPayloadsPage")
  const [selectedVersion, setSelectedVersion] = useState(payload.context.parserVersion)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleReprocess = async () => {
    setIsProcessing(true)
    try {
      await onReprocess(payload.id, selectedVersion)
    } finally {
      setIsProcessing(false)
    }
  }

  let parsedJson: Record<string, unknown> | null = null
  try {
    parsedJson = JSON.parse(payload.rawPayload)
  } catch (e) {
    // Keep as string if JSON parsing fails
  }

  return (
    <div className="mt-6 space-y-6 border-t border-border pt-6">
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">{t("validationErrorLabel")}</h3>
        <div className="rounded-md bg-destructive/10 p-4">
          <div className="text-sm font-medium text-destructive">{payload.validationError.message}</div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">{t("rawJsonLabel")}</h3>
        <div className="overflow-x-auto rounded-md border border-border bg-muted">
          <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap break-words p-4 font-mono text-xs">
            {typeof parsedJson === "object" && parsedJson !== null ? JSON.stringify(parsedJson, null, 2) : payload.rawPayload}
          </pre>
        </div>
      </div>

      <div className="space-y-3">
        <label htmlFor="parserVersion" className="text-sm font-semibold">
          {t("parserVersionLabel")}
        </label>
        <div className="flex gap-3">
          <input
            id="parserVersion"
            type="text"
            value={selectedVersion}
            onChange={(e) => setSelectedVersion(e.target.value)}
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="Enter parser version"
          />
          <button
            onClick={handleReprocess}
            disabled={isProcessing || isReprocessing}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isProcessing || isReprocessing ? t("reprocessingLabel") : t("reprocessButton")}
          </button>
        </div>
      </div>
    </div>
  )
}
