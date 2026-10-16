"use client"

import * as React from "react"
import type { PostExtractionStatus as GeneratedPostExtractionStatus } from "@/generated/graphql"

/** The status as its string value ("PENDING"), the form GraphQL variables and responses use. */
export type PostExtractionStatus = `${GeneratedPostExtractionStatus}`

/** Display order of the statuses, matching PRD 3.10. */
export const EXTRACTION_STATUS_ORDER = [
  "PENDING",
  "QUEUED",
  "EXTRACTING",
  "PROMOTED",
  "NOT_EVENT",
] as const satisfies readonly PostExtractionStatus[]

export interface ExtractionStatusFilterProps {
  /** The statuses currently shown. Never empty. */
  value: PostExtractionStatus[]
  onChange: (next: PostExtractionStatus[]) => void
  /** Accessible name of the whole group, e.g. "Filter by status". */
  groupLabel: string
  /** Visible text of each status chip. */
  labels: Record<PostExtractionStatus, string>
}

/**
 * Multi-select status filter for the manual extract screen (PRD 3.10). One toggle chip per status.
 * At least one status always stays selected: deselecting the last one is ignored, so the list is
 * never filtered down to "nothing" by accident.
 */
export function ExtractionStatusFilter({ value, onChange, groupLabel, labels }: ExtractionStatusFilterProps) {
  const toggle = (status: PostExtractionStatus) => {
    const isOn = value.includes(status)
    if (isOn && value.length === 1) {
      return
    }
    const next = isOn ? value.filter((s) => s !== status) : [...value, status]
    onChange(EXTRACTION_STATUS_ORDER.filter((s) => next.includes(s)))
  }

  return (
    <div role="group" aria-label={groupLabel} className="flex flex-wrap items-center gap-2">
      {EXTRACTION_STATUS_ORDER.map((status) => {
        const isOn = value.includes(status)
        return (
          <button
            key={status}
            type="button"
            aria-pressed={isOn}
            onClick={() => toggle(status)}
            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              isOn
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-input hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            {labels[status]}
          </button>
        )
      })}
    </div>
  )
}
