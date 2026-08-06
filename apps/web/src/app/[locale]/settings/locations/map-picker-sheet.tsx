"use client"

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { MapView } from "@/components/ui/map"
import { Search } from "lucide-react"
import { useDebounce } from "@festgrid/ui"
import { useAddressAutocompleteQuery, usePreviewLocationQuery } from "@/generated/graphql"
import { graphqlClient } from "@/lib/graphql-client"
import type { Coordinates } from "@festgrid/shared-types"

interface MapPickerSheetProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (coordinates: Coordinates) => void
  center: Coordinates
  zoom: number
  marker: Coordinates | null
  onViewStateChange: (viewState: { center: Coordinates; zoom: number }) => void
  onMarkerChange: (coords: Coordinates) => void
}

export function MapPickerSheet({
  isOpen,
  onClose,
  onConfirm,
  center,
  zoom,
  marker,
  onViewStateChange,
  onMarkerChange,
}: MapPickerSheetProps) {
  const t = useTranslations("SavedLocationsPage")
  const apiKey = process.env.NEXT_PUBLIC_GEOAPIFY_MAPS_API_KEY || ""

  // In-sheet search state
  const [mapSearch, setMapSearch] = useState("")
  const debouncedMapSearch = useDebounce(mapSearch, 300)
  const [isMapDropdownOpen, setIsMapDropdownOpen] = useState(false)
  const [searchPlaceId, setSearchPlaceId] = useState<string | null>(null)

  // Autocomplete query for in-sheet search
  const { data: autocompleteData, isLoading: isAutocompleteLoading } = useAddressAutocompleteQuery(
    graphqlClient,
    { input: debouncedMapSearch },
    {
      enabled: isOpen && debouncedMapSearch.trim().length >= 3,
    }
  )

  // Preview query to resolve selected in-sheet suggestion to coordinates
  const { data: searchPreviewData } = usePreviewLocationQuery(
    graphqlClient,
    { placeId: searchPlaceId || undefined },
    {
      enabled: isOpen && !!searchPlaceId,
      retry: false,
    }
  )

  // Handle resolving selected address suggestion
  useEffect(() => {
    if (searchPreviewData?.previewLocation?.coordinates) {
      const { lat, lng } = searchPreviewData.previewLocation.coordinates
      const newCoords = { latitude: lat, longitude: lng }
      onMarkerChange(newCoords)
      onViewStateChange({
        center: newCoords,
        zoom: 15,
      })
      setSearchPlaceId(null)
    }
  }, [searchPreviewData, onMarkerChange, onViewStateChange])

  const suggestions = autocompleteData?.addressAutocomplete || []

  useEffect(() => {
    if (isOpen && debouncedMapSearch.trim().length >= 3) {
      setIsMapDropdownOpen(true)
    } else {
      setIsMapDropdownOpen(false)
    }
  }, [isOpen, debouncedMapSearch, suggestions])

  // Reset local search state when sheet closes
  useEffect(() => {
    if (!isOpen) {
      setMapSearch("")
      setIsMapDropdownOpen(false)
      setSearchPlaceId(null)
    }
  }, [isOpen])

  const handleConfirm = () => {
    if (marker) {
      onConfirm(marker)
      onClose()
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-[90vh] flex flex-col p-0 gap-0 sm:max-w-none">
        <SheetHeader className="px-6 py-4 border-b flex-shrink-0">
          <SheetTitle>{t("mapSheetTitle")}</SheetTitle>
        </SheetHeader>

        {/* Map area */}
        <div className="flex-grow relative bg-muted" data-testid="map-picker-container">
          {/* Search Overlay */}
          <div className="absolute top-4 left-4 z-10 w-72 max-w-[calc(100vw-2rem)] space-y-1">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={mapSearch}
                onChange={(e) => setMapSearch(e.target.value)}
                placeholder={t("mapSearchPlaceholder")}
                className="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 shadow-md"
              />
            </div>

            {isMapDropdownOpen && (
              <div className="absolute z-50 w-full mt-1 bg-popover text-popover-foreground border rounded-md shadow-lg max-h-60 overflow-y-auto py-1">
                {isAutocompleteLoading && (
                  <div className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground">
                    <span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                    {t("mapSearchSearching")}
                  </div>
                )}
                {!isAutocompleteLoading && suggestions.length === 0 && (
                  <div className="px-4 py-2 text-sm text-muted-foreground">{t("mapSearchNoResults")}</div>
                )}
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion.placeId}
                    type="button"
                    onClick={() => {
                      setSearchPlaceId(suggestion.placeId)
                      setIsMapDropdownOpen(false)
                      setMapSearch("")
                    }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none"
                  >
                    {suggestion.description}
                  </button>
                ))}
              </div>
            )}
          </div>

          {isOpen && (
            <MapView
              apiKey={apiKey}
              center={center}
              zoom={zoom}
              marker={marker}
              onCoordinatesChange={onMarkerChange}
              onViewStateChange={onViewStateChange}
              showZoomControl={true}
              labels={{
                loadingLabel: t("resolvingAddressLabel"),
                errorLabel: t("mapErrorLabel"),
              }}
            />
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t flex gap-3 justify-end items-center bg-background flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
          >
            {t("mapCancelLabel")}
          </button>
          <button
            type="button"
            disabled={!marker}
            onClick={handleConfirm}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
          >
            {t("mapConfirmLabel")}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
