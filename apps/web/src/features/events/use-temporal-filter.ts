"use client"

import { useMemo } from "react"
import { useQueryState, parseAsStringEnum } from "nuqs"
import { useTranslations } from "next-intl"
import { usePostHog } from "@festgrid/analytics"

export type TemporalFilterValue = "TODAY" | "UPCOMING"

/**
 * Shared Today / Upcoming / All toggle wiring for every event list that renders
 * `EventDiscoveryPanel` (URL state `?temporal=`, null = All; labels from the `DiscoveryPage`
 * namespace). Spread `panelProps` onto the panel and feed `temporalFilter` into the page's own
 * query condition / query key / pagination `filterKey`.
 */
export function useTemporalFilter() {
  const t = useTranslations("DiscoveryPage")
  const posthog = usePostHog()
  const [temporalFilter, setTemporalFilter] = useQueryState(
    "temporal",
    parseAsStringEnum<TemporalFilterValue>(["TODAY", "UPCOMING"])
  )

  const onTemporalFilterChange = useMemo(
    () => (value: TemporalFilterValue | null) => {
      setTemporalFilter(value)
      posthog.capture("temporal_filter_changed", { value: value ?? "ALL" })
    },
    [setTemporalFilter, posthog]
  )

  const temporalFilterLabels = useMemo(
    () => ({
      today: t("temporalFilterTodayLabel"),
      upcoming: t("temporalFilterUpcomingLabel"),
      all: t("temporalFilterAllLabel"),
      groupLabel: t("temporalFilterGroupLabel"),
    }),
    [t]
  )

  return {
    temporalFilter,
    panelProps: { temporalFilter, onTemporalFilterChange, temporalFilterLabels },
  }
}
