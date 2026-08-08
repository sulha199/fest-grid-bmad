"use client"

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { LocationPickerMapPanel, useDebounce } from "@festgrid/ui"
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

        {isOpen && (
          <LocationPickerMapPanel
            apiKey={apiKey}
            center={center}
            zoom={zoom}
            marker={marker}
            onMarkerChange={onMarkerChange}
            onViewStateChange={onViewStateChange}
            searchValue={mapSearch}
            onSearchInputChange={setMapSearch}
            suggestions={suggestions}
            isSuggestionsLoading={isAutocompleteLoading}
            onSelectSuggestion={(placeId) => {
              setSearchPlaceId(placeId);
              setMapSearch("");
            }}
            onConfirm={handleConfirm}
            onCancel={onClose}
            isConfirmDisabled={!marker}
            labels={{
              mapSearchPlaceholder: t("mapSearchPlaceholder"),
              mapSearchSearching: t("mapSearchSearching"),
              mapSearchNoResults: t("mapSearchNoResults"),
              resolvingAddressLabel: t("resolvingAddressLabel"),
              mapErrorLabel: t("mapErrorLabel"),
              mapCancelLabel: t("mapCancelLabel"),
              mapConfirmLabel: t("mapConfirmLabel"),
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}
