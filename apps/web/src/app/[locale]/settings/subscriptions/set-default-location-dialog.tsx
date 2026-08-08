"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { BlockingLoader, useDebounce, useCurrentLocationCapture, type GeolocationCaptureError, LocationPickerField } from "@festgrid/ui"
import { graphqlClient } from "@/lib/graphql-client"
import {
  useSetAccountDefaultLocationMutation,
  useEditAccountDefaultLocationMutation,
  useAddressAutocompleteQuery,
  usePreviewLocationQuery,
} from "@/generated/graphql"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { MapPickerSheet } from "../locations/map-picker-sheet"
import type { Coordinates, LocationDetails } from "@festgrid/shared-types"
import { usePostHog } from "@festgrid/analytics"

interface SetDefaultLocationDialogProps {
  accountId: string | null
  isOpen: boolean
  onClose: () => void
  mode?: "set" | "edit"
  initialLocation?: LocationDetails
}

const DEFAULT_CENTER: Coordinates = {
  latitude: -6.2088,
  longitude: 106.8456,
}

export function SetDefaultLocationDialog({ accountId, isOpen, onClose, mode = "set", initialLocation }: SetDefaultLocationDialogProps) {
  const t = useTranslations("SubscriptionsPage")
  const queryClient = useQueryClient()
  const posthog = usePostHog()

  const [addressSearch, setAddressSearch] = useState("")
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null)
  const [selectedDescription, setSelectedDescription] = useState<string | null>(null)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  // Coordinate capture states
  const [pendingCoords, setPendingCoords] = useState<Coordinates | null>(null)
  const [isMapOpen, setIsMapOpen] = useState(false)
  const [geoErrorMsg, setGeoErrorMsg] = useState<string | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)

  // Shared map-picker continuity state
  const [mapViewState, setMapViewState] = useState<{
    center: Coordinates
    zoom: number
    marker: Coordinates | null
  } | null>(null)

  const debouncedSearch = useDebounce(addressSearch, 300)

  // Geolocation Hook
  const {
    isAvailable: isGeoAvailable,
    isCapturing: isGeoCapturing,
    capture: captureGeo,
  } = useCurrentLocationCapture()

  // Autocomplete Query
  const { data: autocompleteData, isLoading: isAutocompleteLoading } = useAddressAutocompleteQuery(
    graphqlClient,
    { input: debouncedSearch },
    {
      enabled: isOpen && debouncedSearch.trim().length >= 3 && !selectedDescription && !pendingCoords,
    }
  )

  // Preview Query
  const {
    data: previewData,
    isFetching: isPreviewLoading,
    isError: isPreviewError,
  } = usePreviewLocationQuery(
    graphqlClient,
    pendingCoords ?? { latitude: 0, longitude: 0 },
    {
      enabled: isOpen && !!pendingCoords && !isInitializing,
      retry: false,
    }
  )

  const { mutateAsync: setAccountDefaultLocation, isPending: isSetPending } = useSetAccountDefaultLocationMutation(graphqlClient)
  const { mutateAsync: editAccountDefaultLocation, isPending: isEditPending } = useEditAccountDefaultLocationMutation(graphqlClient)
  const isSaving = isSetPending || isEditPending

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setGeoErrorMsg(null)
      setIsInitializing(true)
      if (mode === "edit" && initialLocation) {
        setAddressSearch(initialLocation.formattedAddress || initialLocation.placeName || "")
        setSelectedPlaceId(initialLocation.placeId || null)
        const coords = {
          latitude: initialLocation.coordinates.latitude,
          longitude: initialLocation.coordinates.longitude,
        }
        setPendingCoords(coords)
        setMapViewState({
          center: coords,
          zoom: 15,
          marker: coords,
        })
      } else {
        setAddressSearch("")
        setSelectedPlaceId(null)
        setPendingCoords(null)
        setMapViewState(null)
      }
      setSelectedDescription(null)
      setIsDropdownOpen(false)
    }
  }, [isOpen, mode, initialLocation])

  // Handle preview query results
  useEffect(() => {
    if (pendingCoords) {
      if (isPreviewLoading) {
        setAddressSearch(t("resolvingAddressLabel") || "Resolving address...")
      } else if (previewData?.previewLocation) {
        setAddressSearch(previewData.previewLocation.formattedAddress || "")
      } else if (isPreviewError) {
        setAddressSearch(
          (t("addressPreviewErrorFallback") || "Coordinates: {lat}, {lng}")
            .replace("{lat}", pendingCoords.latitude.toFixed(4))
            .replace("{lng}", pendingCoords.longitude.toFixed(4))
        )
      }
    }
  }, [pendingCoords, previewData, isPreviewLoading, isPreviewError, t])

  // Open dropdown if we have predictions or are loading
  const suggestions = autocompleteData?.addressAutocomplete || []
  useEffect(() => {
    if (
      isOpen &&
      (suggestions.length > 0 || isAutocompleteLoading) &&
      addressSearch.length >= 3 &&
      !selectedDescription &&
      !pendingCoords
    ) {
      setIsDropdownOpen(true)
    } else {
      setIsDropdownOpen(false)
    }
  }, [suggestions, addressSearch, selectedDescription, isOpen, isAutocompleteLoading, pendingCoords])

  const handleAddressChange = (val: string) => {
    setAddressSearch(val)
    setSelectedPlaceId(null)
    setSelectedDescription(null)
    setPendingCoords(null)
    setGeoErrorMsg(null)
  }

  const handleSelectSuggestion = (placeId: string, description: string) => {
    setSelectedPlaceId(placeId)
    setSelectedDescription(description)
    setAddressSearch(description)
    setIsDropdownOpen(false)

    graphqlClient
      .request(
        `query previewLocation($placeId: String) {
          previewLocation(placeId: $placeId) {
            coordinates {
              lat
              lng
            }
          }
        }`,
        { placeId }
      )
      .then((res: any) => {
        if (res?.previewLocation?.coordinates) {
          const { lat, lng } = res.previewLocation.coordinates
          setMapViewState({
            center: { latitude: lat, longitude: lng },
            zoom: 15,
            marker: { latitude: lat, longitude: lng },
          })
        }
      })
      .catch((err) => {
        console.warn("Background previewLocation resolution failed:", err)
      })
  }

  const handleUseCurrentLocation = async () => {
    setGeoErrorMsg(null)
    try {
      const coords = await captureGeo()
      setSelectedPlaceId(null)
      setSelectedDescription(null)
      setPendingCoords(coords)
      setAddressSearch(t("resolvingAddressLabel") || "Resolving address...")

      setMapViewState({
        center: coords,
        zoom: 15,
        marker: coords,
      })
    } catch (err: any) {
      console.error("Geolocation capture failed:", err)
      const errType = err.message as GeolocationCaptureError
      if (errType === "permission-denied") {
        setGeoErrorMsg(t("geolocationPermissionDeniedError") || "Location permission denied")
      } else if (errType === "timeout") {
        setGeoErrorMsg(t("geolocationTimeoutError") || "Location detection timed out")
      } else if (errType === "unavailable") {
        setGeoErrorMsg(t("geolocationUnavailableError") || "Location service unavailable")
      } else {
        setGeoErrorMsg(t("defaultLocationErrorToast") || "Failed to acquire location")
      }
    }
  }

  const handleMapConfirm = (coords: Coordinates) => {
    setGeoErrorMsg(null)
    setSelectedPlaceId(null)
    setSelectedDescription(null)
    setIsInitializing(false)
    setPendingCoords(coords)
    setAddressSearch(t("resolvingAddressLabel") || "Resolving address...")

    setMapViewState((prev) => ({
      center: coords,
      zoom: prev?.zoom ?? 15,
      marker: coords,
    }))
  }

  const isCurrentLocationDisabled = !isGeoAvailable || isGeoCapturing || isMapOpen || isPreviewLoading || isSaving
  const isPickOnMapDisabled = isGeoCapturing || isMapOpen || isPreviewLoading || isSaving

  const hasCoordinates = !!pendingCoords
  const hasPlaceId = !!selectedPlaceId

  const isSaveDisabled =
    isSaving ||
    isPreviewLoading ||
    (!hasPlaceId && !hasCoordinates)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSaveDisabled || !accountId) return

    try {
      const input = {
        placeId: selectedPlaceId || undefined,
        latitude: selectedPlaceId ? undefined : pendingCoords?.latitude,
        longitude: selectedPlaceId ? undefined : pendingCoords?.longitude,
      }

      if (mode === "edit") {
        await editAccountDefaultLocation({ accountId, input })
        
        // Fire PostHog analytics event
        posthog.capture("subscription_default_location_edited", {
          accountId,
        })

        toast.success(t("defaultLocationEditedToast") || "Default location edited successfully, pending moderator review")
      } else {
        await setAccountDefaultLocation({ accountId, input })

        // Fire PostHog analytics event
        posthog.capture("subscription_default_location_set", {
          accountId,
        })

        toast.success(t("defaultLocationSetToast") || "Default location set successfully")
      }

      // Invalidate the getMySubscriptions cache
      queryClient.invalidateQueries({ queryKey: ["getMySubscriptions"] })

      onClose()
    } catch (err) {
      console.error("Failed to save default location:", err)
      toast.error(t("defaultLocationErrorToast") || "Failed to save default location")
    }
  }

  return (
    <>
      <BlockingLoader active={isSaving} label={t("savingAnnouncement") || "Saving..."} />

      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {mode === "edit"
                ? t("defaultLocationEditDialogTitle") || "Edit Default Location"
                : t("defaultLocationDialogTitle") || "Set Default Location"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6 py-4">
            <LocationPickerField
              value={addressSearch}
              suggestions={suggestions}
              isSuggestionsLoading={isAutocompleteLoading}
              onSearchInputChange={handleAddressChange}
              onSelectSuggestion={handleSelectSuggestion}
              onUseCurrentLocation={handleUseCurrentLocation}
              onPickOnMap={() => setIsMapOpen(true)}
              resolvedPreview={
                pendingCoords
                  ? {
                      status: isPreviewLoading ? "loading" : isPreviewError ? "error" : "resolved",
                      text: addressSearch,
                    }
                  : null
              }
              error={geoErrorMsg}
              isCurrentLocationDisabled={isCurrentLocationDisabled}
              isPickOnMapDisabled={isPickOnMapDisabled}
              isGeoCapturing={isGeoCapturing}
              labels={{
                addressLabel: t("addressLabel") || "Address",
                addressPlaceholder: t("addressPlaceholder") || "Search address...",
                addressSearching: t("addressSearching") || "Searching...",
                addressNoResults: t("addressNoResults") || "No results found",
                useCurrentLocationLabel: t("useCurrentLocationLabel") || "Use my current location",
                pickOnMapLabel: t("pickOnMapLabel") || "Pick on map",
              }}
            />

            <DialogFooter className="gap-2 sm:gap-0 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
              >
                {t("cancelButtonLabel") || "Cancel"}
              </button>
              <button
                type="submit"
                disabled={isSaveDisabled}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
              >
                {t("saveButtonLabel") || "Save"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <MapPickerSheet
        isOpen={isMapOpen}
        onClose={() => setIsMapOpen(false)}
        onConfirm={handleMapConfirm}
        center={mapViewState?.center || DEFAULT_CENTER}
        zoom={mapViewState?.zoom ?? 12}
        marker={mapViewState?.marker ?? null}
        onViewStateChange={(state) =>
          setMapViewState((prev) => ({
            ...prev,
            ...state,
            marker: prev?.marker ?? null,
          }))
        }
        onMarkerChange={(coords) =>
          setMapViewState((prev) => ({
            center: prev?.center || coords,
            zoom: prev?.zoom ?? 15,
            marker: coords,
          }))
        }
      />
    </>
  )
}
