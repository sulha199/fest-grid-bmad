"use client";

import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import type { LocationPickerFieldProps } from './LocationPickerField.types';

export function LocationPickerField({
  value,
  suggestions,
  isSuggestionsLoading,
  onSearchInputChange,
  onSelectSuggestion,
  onUseCurrentLocation,
  onPickOnMap,
  resolvedPreview,
  error,
  labels,
  isCurrentLocationDisabled = false,
  isPickOnMapDisabled = false,
  isGeoCapturing = false,
}: LocationPickerFieldProps) {
  const [addressSearch, setAddressSearch] = useState(value ?? '');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Sync with value prop
  useEffect(() => {
    if (value !== undefined) {
      setAddressSearch(value);
    }
  }, [value]);

  // Labels fallbacks
  const addressLabel = labels?.addressLabel ?? 'Address';
  const addressPlaceholder = labels?.addressPlaceholder ?? 'Search for an address...';
  const addressSearching = labels?.addressSearching ?? 'Searching...';
  const addressNoResults = labels?.addressNoResults ?? 'No addresses found.';
  const useCurrentLocationLabel = labels?.useCurrentLocationLabel ?? 'Use my current location';
  const pickOnMapLabel = labels?.pickOnMapLabel ?? 'Pick on map';

  // State-swap display value
  const displayValue = resolvedPreview ? resolvedPreview.text : addressSearch;

  // Manage dropdown open condition
  useEffect(() => {
    if (
      !resolvedPreview &&
      addressSearch.length >= 3
    ) {
      setIsDropdownOpen(true);
    } else {
      setIsDropdownOpen(false);
    }
  }, [addressSearch, resolvedPreview]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setAddressSearch(val);
    onSearchInputChange(val);
  };

  const handleSelect = (placeId: string, description: string) => {
    onSelectSuggestion(placeId, description);
    setIsDropdownOpen(false);
  };

  return (
    <div className="space-y-2 relative">
      <label htmlFor="location-address" className="text-sm font-medium leading-none">
        {addressLabel}
      </label>
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <input
          id="location-address"
          type="text"
          value={displayValue}
          onChange={handleInputChange}
          placeholder={addressPlaceholder}
          className="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          required
        />
      </div>

      {/* Geo/Map Trigger Buttons */}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          id="use-current-location"
          disabled={isCurrentLocationDisabled}
          onClick={onUseCurrentLocation}
          className="inline-flex items-center gap-1.5 rounded border border-input bg-background px-2.5 py-1.5 text-xs font-semibold hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGeoCapturing ? (
            <span className="animate-spin inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full" />
          ) : null}
          {useCurrentLocationLabel}
        </button>
        <button
          type="button"
          id="pick-on-map"
          disabled={isPickOnMapDisabled}
          onClick={onPickOnMap}
          className="inline-flex items-center gap-1.5 rounded border border-input bg-background px-2.5 py-1.5 text-xs font-semibold hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pickOnMapLabel}
        </button>
      </div>

      {error && (
        <p className="text-xs text-destructive pt-1" data-testid="geolocation-error">
          {error}
        </p>
      )}

      {/* Suggestions Dropdown */}
      {isDropdownOpen && (
        <div className="absolute z-50 w-full mt-1 bg-popover text-popover-foreground border rounded-md shadow-md max-h-60 overflow-y-auto py-1">
          {isSuggestionsLoading && (
            <div className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground">
              <span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
              {addressSearching}
            </div>
          )}
          {!isSuggestionsLoading && suggestions.length === 0 && (
            <div className="px-4 py-2 text-sm text-muted-foreground">{addressNoResults}</div>
          )}
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.placeId}
              type="button"
              onClick={() => handleSelect(suggestion.placeId, suggestion.description)}
              className="w-full text-left px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none"
            >
              {suggestion.description}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
