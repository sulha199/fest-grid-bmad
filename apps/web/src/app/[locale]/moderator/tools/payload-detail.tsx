"use client"

import React, { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { type UnprocessedScraperPayload } from "./types"
import { useParserVersionsQuery } from "./unprocessed-payloads-hooks"

interface PayloadDetailProps {
  payload: UnprocessedScraperPayload
  onReprocess: (payloadId: string, parserVersion: string) => Promise<void>
  isReprocessing: boolean
}

export function PayloadDetail({ payload, onReprocess, isReprocessing }: PayloadDetailProps) {
  const t = useTranslations("UnprocessedPayloadsPage")
  // Stored lowercase in the DB (see brightdata-record-mapper.ts/instagram-adapter.ts)
  // but the GraphQL enum and this query variable are uppercase.
  const normalizedSource = payload.context.source?.toUpperCase() as "APIFY" | "BRIGHTDATA" | "GEMINI" | undefined
  const { data: parserVersions, isLoading: isLoadingVersions } = useParserVersionsQuery(normalizedSource)

  const [selectedVersion, setSelectedVersion] = useState(payload.context.parserVersion)
  const [isProcessing, setIsProcessing] = useState(false)

  // Once the real options load, default to this payload's own parser version if it's
  // a valid, registered choice for its provider -- otherwise fall back to the first
  // available option rather than leaving a stale/unregistered value selected.
  useEffect(() => {
    if (!parserVersions || parserVersions.length === 0) return
    const stillValid = parserVersions.some((v) => v.version === selectedVersion)
    if (!stillValid) {
      setSelectedVersion(parserVersions[0].version)
    }
    // Only re-run when the loaded options change, not on every selectedVersion edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parserVersions])

  const handleReprocess = async () => {
    setIsProcessing(true)
    try {
      await onReprocess(payload.id, selectedVersion)
    } finally {
      setIsProcessing(false)
    }
  }

  // The `rawPayload` GraphQL field is a JSON scalar, so the server already sends it
  // parsed (object/array/primitive) rather than as a JSON-encoded string.
  let displayPayload: string
  if (typeof payload.rawPayload === "string") {
    try {
      displayPayload = JSON.stringify(JSON.parse(payload.rawPayload), null, 2)
    } catch (e) {
      displayPayload = payload.rawPayload
    }
  } else {
    displayPayload = JSON.stringify(payload.rawPayload, null, 2)
  }

  return (
    <div className="mt-6 space-y-6 border-t border-border pt-6">
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">{t("validationErrorLabel")}</h3>
        <div className="rounded-md bg-destructive/10 p-4 space-y-1">
          {payload.validationError.length > 0 ? (
            payload.validationError.map((error, idx) => (
              <div key={idx} className="text-sm font-medium text-destructive">
                {error.message}
              </div>
            ))
          ) : (
            <div className="text-sm font-medium text-destructive">Unknown validation error</div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">{t("rawJsonLabel")}</h3>
        <div className="overflow-x-auto rounded-md border border-border bg-muted">
          <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap break-words p-4 font-mono text-xs">
            {displayPayload}
          </pre>
        </div>
      </div>

      <div className="space-y-3">
        <label htmlFor="parserVersion" className="text-sm font-semibold">
          {t("parserVersionLabel")}
        </label>
        <div className="flex gap-3">
          <select
            id="parserVersion"
            value={selectedVersion}
            onChange={(e) => setSelectedVersion(e.target.value)}
            disabled={isLoadingVersions || !parserVersions || parserVersions.length === 0}
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            {isLoadingVersions && <option value={selectedVersion}>{t("loadingLabel")}</option>}
            {!isLoadingVersions && (!parserVersions || parserVersions.length === 0) && (
              <option value={selectedVersion}>{selectedVersion}</option>
            )}
            {parserVersions?.map((v) => (
              <option key={v.id} value={v.version}>
                {v.version}
                {v.version === payload.context.parserVersion ? ` ${t("currentVersionBadge")}` : ""}
                {v.description ? ` — ${v.description}` : ""}
              </option>
            ))}
          </select>
          <button
            onClick={handleReprocess}
            disabled={isProcessing || isReprocessing || isLoadingVersions || !parserVersions || parserVersions.length === 0}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isProcessing || isReprocessing ? t("reprocessingLabel") : t("reprocessButton")}
          </button>
        </div>
        {!isLoadingVersions && (!parserVersions || parserVersions.length === 0) && (
          <p className="text-xs text-muted-foreground">{t("noParserVersionsMessage")}</p>
        )}
      </div>
    </div>
  )
}
