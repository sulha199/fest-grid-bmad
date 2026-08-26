import React from "react";
import { LocationRadiusFilterProps } from "./LocationRadiusFilter.types.js";

export function LocationRadiusFilter({
  isAuthenticated,
  isLoadingLocations,
  locationsError,
  savedLocations,
  selectedValue,
  radiusKm,
  isCapturingCurrentLocation,
  currentLocationError,
  onSelectLocation,
  onRadiusChange,
  labels,
  className = "",
}: LocationRadiusFilterProps) {
  if (!isAuthenticated) {
    return null;
  }

  const showRadiusSlider = selectedValue !== "off" && selectedValue !== null;

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      <div className="flex flex-col gap-2">
        <label htmlFor="nearby-location-select" className="text-sm font-medium">
          {labels.filterLabel}
        </label>
        <select
          id="nearby-location-select"
          value={selectedValue || "off"}
          onChange={(e) => onSelectLocation(e.target.value)}
          disabled={isLoadingLocations}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="off">{labels.offOptionLabel}</option>
          {savedLocations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name}
            </option>
          ))}
          <option value="current">{labels.currentLocationOptionLabel}</option>
        </select>
        {isLoadingLocations && (
          <span className="text-xs text-muted-foreground animate-pulse">
            Loading...
          </span>
        )}
        {locationsError && (
          <span className="text-xs text-destructive" role="alert">
            {labels.locationsErrorLabel}
          </span>
        )}
        {savedLocations.length === 0 && (
          <p className="text-xs text-muted-foreground">
            {labels.noSavedLocationsHint}
          </p>
        )}
      </div>

      {showRadiusSlider && (
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center text-sm font-medium">
            <label htmlFor="nearby-radius-slider">{labels.radiusLabel}</label>
            <span className="text-muted-foreground">{labels.radiusUnit(radiusKm)}</span>
          </div>
          <input
            id="nearby-radius-slider"
            type="range"
            min="1"
            max="50"
            value={radiusKm}
            onChange={(e) => onRadiusChange(Number(e.target.value))}
            className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
          />
        </div>
      )}

      {/* Accessibility Polite Region */}
      <div aria-live="polite" className="text-xs">
        {isCapturingCurrentLocation && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="animate-spin inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full" />
            <span>{labels.detectingLocationLabel}</span>
          </div>
        )}
        {currentLocationError === "permission-denied" && (
          <p className="text-destructive">{labels.permissionDeniedLabel}</p>
        )}
        {currentLocationError && currentLocationError !== "permission-denied" && (
          <p className="text-destructive">{labels.unavailableLabel}</p>
        )}
      </div>
    </div>
  );
}
export * from "./LocationRadiusFilter.types";
