"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { BlockingLoader, useDebounce } from "@festgrid/ui"
import { graphqlClient } from "@/lib/graphql-client"
import {
  useCreateUserLocationMutation,
  useUpdateUserLocationMutation,
  useAddressAutocompleteQuery,
  GetMyLocationsDocument,
} from "@/generated/graphql"
import { toast } from "sonner"
import { Search } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"

// Simple type for UserLocation matching our query
export interface UserLocation {
  id: string
  name: string
  locationDetails: {
    formattedAddress: string
    placeName?: string | null
    coordinates: {
      lat: number
      lng: number
    }
  }
  radius: number
}

interface LocationFormDialogProps {
  isOpen: boolean
  onClose: () => void
  location?: UserLocation // undefined -> Add mode, present -> Edit mode
}

export function LocationFormDialog({ isOpen, onClose, location }: LocationFormDialogProps) {
  const t = useTranslations("SavedLocationsPage")
  const queryClient = useQueryClient()

  const [name, setName] = useState("")
  const [addressSearch, setAddressSearch] = useState("")
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null)
  const [selectedDescription, setSelectedDescription] = useState<string | null>(null)
  const [radiusKm, setRadiusKm] = useState(5) // default 5 km
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  const debouncedSearch = useDebounce(addressSearch, 300)

  // Autocomplete Query
  const { data: autocompleteData, isLoading: isAutocompleteLoading } = useAddressAutocompleteQuery(
    graphqlClient,
    { input: debouncedSearch },
    {
      enabled: isOpen && debouncedSearch.trim().length >= 3 && !selectedDescription,
    }
  )

  const { mutateAsync: createUserLocation, isPending: isCreating } = useCreateUserLocationMutation(graphqlClient)
  const { mutateAsync: updateUserLocation, isPending: isUpdating } = useUpdateUserLocationMutation(graphqlClient)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isSaving = isCreating || isUpdating || isSubmitting

  // Pre-populate if editing
  useEffect(() => {
    if (isOpen) {
      if (location) {
        setName(location.name)
        setAddressSearch(location.locationDetails.formattedAddress)
        setSelectedDescription(location.locationDetails.formattedAddress)
        setSelectedPlaceId(null) // no placeId needed if unchanged
        setRadiusKm(Math.round(location.radius / 1000))
      } else {
        setName("")
        setAddressSearch("")
        setSelectedPlaceId(null)
        setSelectedDescription(null)
        setRadiusKm(5)
      }
      setIsDropdownOpen(false)
    }
  }, [isOpen, location])

  // Open dropdown if we have predictions or are loading
  const suggestions = autocompleteData?.addressAutocomplete || []
  useEffect(() => {
    if (isOpen && (suggestions.length > 0 || isAutocompleteLoading) && addressSearch.length >= 3 && !selectedDescription) {
      setIsDropdownOpen(true)
    } else {
      setIsDropdownOpen(false)
    }
  }, [suggestions, addressSearch, selectedDescription, isOpen, isAutocompleteLoading])

  const handleAddressChange = (val: string) => {
    setAddressSearch(val)
    setSelectedPlaceId(null)
    setSelectedDescription(null)
  }

  const handleSelectSuggestion = (placeId: string, description: string) => {
    setSelectedPlaceId(placeId)
    setSelectedDescription(description)
    setAddressSearch(description)
    setIsDropdownOpen(false)
  }

  const isSaveDisabled =
    !name.trim() ||
    radiusKm < 1 ||
    radiusKm > 50 ||
    isSaving ||
    // In Add mode, a placeId must be selected
    (!location && !selectedPlaceId) ||
    // In Edit mode, must have either selected a new placeId or address remains untouched (same as description)
    (location && !selectedPlaceId && addressSearch !== location.locationDetails.formattedAddress)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSaveDisabled || isSubmitting) return
    setIsSubmitting(true)

    try {
      if (location) {
        // Edit mode
        await updateUserLocation({
          id: location.id,
          input: {
            name,
            radius: radiusKm * 1000,
            placeId: selectedPlaceId || undefined, // omit placeId if address is untouched
          },
        })
        toast.success(t("locationSavedAnnouncement"))
      } else {
        // Add mode
        const result = await createUserLocation({
          input: {
            name,
            placeId: selectedPlaceId!,
            radius: radiusKm * 1000,
          },
        })

        // Fire analytics event
        const posthog = (window as any).posthog
        if (posthog) {
          posthog.capture("saved_location_added", {
            locationId: result.createUserLocation.id,
            name: result.createUserLocation.name,
          })
        }
        toast.success(t("locationSavedAnnouncement"))
      }

      // Invalidate getMyLocations
      queryClient.invalidateQueries({ queryKey: ["getMyLocations"] })
      onClose()
    } catch (err) {
      console.error(err)
      toast.error(t("locationSaveErrorAnnouncement"))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <BlockingLoader isOpen={isSaving} label={t("savingAnnouncement")} />

      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{location ? t("editModalTitle") : t("addModalTitle")}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6 py-4">
            {/* Name Field */}
            <div className="space-y-2">
              <label htmlFor="location-name" className="text-sm font-medium leading-none">
                {t("nameLabel")}
              </label>
              <input
                id="location-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("namePlaceholder")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                maxLength={50}
                required
              />
            </div>

            {/* Address Field */}
            <div className="space-y-2 relative">
              <label htmlFor="location-address" className="text-sm font-medium leading-none">
                {t("addressLabel")}
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <input
                  id="location-address"
                  type="text"
                  value={addressSearch}
                  onChange={(e) => handleAddressChange(e.target.value)}
                  placeholder={t("addressPlaceholder")}
                  className="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  required
                />
              </div>

              {/* Suggestions Dropdown */}
              {isDropdownOpen && (
                <div className="absolute z-50 w-full mt-1 bg-popover text-popover-foreground border rounded-md shadow-md max-h-60 overflow-y-auto py-1">
                  {isAutocompleteLoading && (
                    <div className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground">
                      <span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                      {t("addressSearching")}
                    </div>
                  )}
                  {!isAutocompleteLoading && suggestions.length === 0 && (
                    <div className="px-4 py-2 text-sm text-muted-foreground">{t("addressNoResults")}</div>
                  )}
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion.placeId}
                      type="button"
                      onClick={() => handleSelectSuggestion(suggestion.placeId, suggestion.description)}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none"
                    >
                      {suggestion.description}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Radius Field */}
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm font-medium">
                <label htmlFor="location-radius">{t("radiusLabel")}</label>
                <span className="text-muted-foreground">{t("radiusUnit", { count: radiusKm })}</span>
              </div>
              <input
                id="location-radius"
                type="range"
                min="1"
                max="50"
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <p className="text-xs text-muted-foreground">
                {t("radiusHelperText")}
              </p>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
              >
                {t("cancelButtonLabel")}
              </button>
              <button
                type="submit"
                disabled={isSaveDisabled}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
              >
                {t("saveButtonLabel")}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
