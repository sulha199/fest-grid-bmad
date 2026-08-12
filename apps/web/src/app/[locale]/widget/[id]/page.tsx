"use client"

import React, { useState, useMemo } from "react"
import { useWidgetByIdQuery, WidgetByIdQuery } from "@/generated/graphql"
import { graphqlClient } from "@/lib/graphql-client"
import { EventDiscoveryPanel } from "@festgrid/ui"
import { useTranslations } from "next-intl"

interface WidgetPageProps {
  params: {
    id: string
    locale: string
  }
}

export default function WidgetPage({ params }: WidgetPageProps) {
  const { id } = params
  const tNearby = useTranslations("NearbyFilter")

  const { data, isLoading } = useWidgetByIdQuery(
    graphqlClient,
    { id },
    { enabled: !!id }
  )

  const widget = data?.widgetById

  const [q, setQ] = useState("")

  const filterLabels = useMemo(
    () => ({
      typeLabel: "Type",
      categoryLabel: "Category",
      clearLabel: "Clear",
      locationFilterLabels: {
        filterLabel: tNearby("filterLabel") || "Proximity",
        offOptionLabel: tNearby("offOptionLabel") || "Off",
        currentLocationOptionLabel: tNearby("currentLocationOptionLabel") || "Current Location",
        radiusLabel: tNearby("radiusLabel") || "Radius",
        radiusUnit: (count: number) => tNearby("radiusUnit", { count }) || "km",
        detectingLocationLabel: tNearby("detectingLocationLabel") || "Detecting...",
        permissionDeniedLabel: tNearby("permissionDeniedLabel") || "Denied",
        unavailableLabel: tNearby("unavailableLabel") || "Unavailable",
        locationsErrorLabel: tNearby("locationsErrorLabel") || "Error",
        noSavedLocationsHint: "No saved locations found",
      },
    }),
    [tNearby]
  )

  // Report height on DOM height updates
  React.useEffect(() => {
    if (!id) return
    const reportHeight = () => {
      const height = document.documentElement.scrollHeight
      window.parent.postMessage(
        {
          type: "festdaily-widget-resize",
          widgetId: id,
          height,
        },
        "*"
      )
    }

    window.addEventListener("load", reportHeight)
    const observer = new ResizeObserver(reportHeight)
    observer.observe(document.body)

    return () => {
      window.removeEventListener("load", reportHeight)
      observer.disconnect()
    }
  }, [id, data])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-muted-foreground p-6 text-center animate-pulse text-sm">
        Loading widget...
      </div>
    )
  }

  if (!widget) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-muted-foreground p-6 text-center text-sm">
        Widget configuration not found or inactive.
      </div>
    )
  }

  const filters = widget.filters || {}
  const themeClass = widget.theme === "DARK" ? "dark bg-slate-950 text-slate-50" : "light bg-background text-foreground"

  return (
    <div className={`min-h-screen p-4 ${themeClass}`}>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between border-b pb-3 mb-6 border-muted">
          <div>
            <h2 className="font-bold text-lg tracking-tight">FestDaily Discovery</h2>
            <p className="text-xs text-muted-foreground">Embedded live event feed</p>
          </div>
        </div>

        <EventDiscoveryPanel
          query={q}
          onSearchSubmit={(val) => setQ(val)}
          searchPlaceholder="Search events..."
          searchClearLabel="Clear"
          filterLabels={filterLabels}
          types={[]}
          categories={[]}
          isAuthenticated={false}
          isLoadingLocations={false}
          locationsError={false}
          savedLocations={[]}
          selectedValue="off"
          radiusKm={10}
          isCapturingCurrentLocation={false}
          currentLocationError={null}
          onSelectLocation={() => {}}
          onRadiusChange={() => {}}
          views={[]}
        />
      </div>
    </div>
  )
}
