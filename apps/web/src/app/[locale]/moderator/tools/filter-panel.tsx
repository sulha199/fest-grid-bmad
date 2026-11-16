"use client"

import React from "react"
import { useTranslations } from "next-intl"

interface FilterPanelProps {
  filters: {
    source: string | null
    createdAfter: string | null
    createdBefore: string | null
    sortOrder: "newest" | "oldest"
  }
  onFilterChange: (filters: Partial<{ source: string | null; createdAfter: string | null; createdBefore: string | null; sortOrder: "newest" | "oldest" }>) => void
  /**
   * What "Clear all" does. A list that pages needs more than resetting the filter values: with no filter set the
   * paging controller's filter key does not change, so only the owner of the controller can return to page 1.
   * Without it, Clear reports the cleared values through `onFilterChange`.
   */
  onClear?: () => void
}

export function FilterPanel({ filters, onFilterChange, onClear }: FilterPanelProps) {
  const t = useTranslations("UnprocessedPayloadsPage")

  const handleClear = () => {
    if (onClear) {
      onClear()
      return
    }
    onFilterChange({
      source: null,
      createdAfter: null,
      createdBefore: null,
      sortOrder: "newest",
    })
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-2">
          <label htmlFor="source" className="text-sm font-medium">
            {t("filterSourceLabel")}
          </label>
          <select
            id="source"
            value={filters.source || ""}
            onChange={(e) => onFilterChange({ source: e.target.value || null })}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">All Sources</option>
            <option value="APIFY">{t("sourceApify")}</option>
            <option value="BRIGHTDATA">{t("sourceBrightData")}</option>
            <option value="GEMINI">{t("sourceGemini")}</option>
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="createdAfter" className="text-sm font-medium">
            {t("filterDateStartLabel")}
          </label>
          <input
            id="createdAfter"
            type="date"
            value={filters.createdAfter || ""}
            onChange={(e) => onFilterChange({ createdAfter: e.target.value || null })}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="createdBefore" className="text-sm font-medium">
            {t("filterDateEndLabel")}
          </label>
          <input
            id="createdBefore"
            type="date"
            value={filters.createdBefore || ""}
            onChange={(e) => onFilterChange({ createdBefore: e.target.value || null })}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="sortOrder" className="text-sm font-medium">
            {t("filterSortLabel")}
          </label>
          <select
            id="sortOrder"
            value={filters.sortOrder}
            onChange={(e) => onFilterChange({ sortOrder: e.target.value as "newest" | "oldest" })}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="newest">{t("filterSortNewest")}</option>
            <option value="oldest">{t("filterSortOldest")}</option>
          </select>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => {
            // Apply filters - handled by parent
          }}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {t("filterApplyButton")}
        </button>
        <button
          onClick={handleClear}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          {t("filterClearButton")}
        </button>
      </div>
    </div>
  )
}
