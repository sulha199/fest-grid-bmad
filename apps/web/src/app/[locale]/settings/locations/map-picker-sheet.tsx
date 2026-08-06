"use client"

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { MapView } from "@/components/ui/map"
import type { Coordinates } from "@festgrid/shared-types"

interface MapPickerSheetProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (coordinates: Coordinates) => void
  initialCenter?: Coordinates
}

const DEFAULT_CENTER: Coordinates = {
  latitude: -6.2088,
  longitude: 106.8456,
}

export function MapPickerSheet({ isOpen, onClose, onConfirm, initialCenter }: MapPickerSheetProps) {
  const t = useTranslations("SavedLocationsPage")
  const [marker, setMarker] = useState<Coordinates | null>(null)

  // Reset marker when sheet opens
  useEffect(() => {
    if (isOpen) {
      setMarker(initialCenter || null)
    }
  }, [isOpen, initialCenter])

  const handleConfirm = () => {
    if (marker) {
      onConfirm(marker)
      onClose()
    }
  }

  const center = initialCenter || DEFAULT_CENTER
  const apiKey = process.env.NEXT_PUBLIC_GEOAPIFY_MAPS_API_KEY || ""

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-[90vh] flex flex-col p-0 gap-0 sm:max-w-none">
        <SheetHeader className="px-6 py-4 border-b flex-shrink-0">
          <SheetTitle>{t("mapSheetTitle")}</SheetTitle>
        </SheetHeader>

        {/* Map area */}
        <div className="flex-grow relative bg-muted" data-testid="map-picker-container">
          {isOpen && (
            <MapView
              apiKey={apiKey}
              center={center}
              zoom={12}
              marker={marker}
              onCoordinatesChange={setMarker}
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
