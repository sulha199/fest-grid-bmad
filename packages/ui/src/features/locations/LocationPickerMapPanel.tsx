"use client";

import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { MapView } from '../../core/map';
import type { LocationPickerMapPanelProps } from './LocationPickerMapPanel.types';

export function LocationPickerMapPanel({
  apiKey,
  center,
  zoom,
  marker,
  onMarkerChange,
  onViewStateChange,
  searchValue,
  onSearchInputChange,
  suggestions,
  isSuggestionsLoading,
  onSelectSuggestion,
  onConfirm,
  onCancel,
  isConfirmDisabled,
  labels,
}: LocationPickerMapPanelProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Labels fallbacks
  const mapSearchPlaceholder = labels?.mapSearchPlaceholder ?? 'Search address inside map...';
  const mapSearchSearching = labels?.mapSearchSearching ?? 'Searching...';
  const mapSearchNoResults = labels?.mapSearchNoResults ?? 'No addresses found.';
  const resolvingAddressLabel = labels?.resolvingAddressLabel ?? 'resolving address...';
  const mapErrorLabel = labels?.mapErrorLabel ?? 'Unable to load map.';
  const mapCancelLabel = labels?.mapCancelLabel ?? 'Cancel';
  const mapConfirmLabel = labels?.mapConfirmLabel ?? 'Confirm location';

  // Manage suggestions dropdown visibility
  useEffect(() => {
    if (searchValue.trim().length >= 3 && (isSuggestionsLoading || suggestions.length > 0)) {
      setIsDropdownOpen(true);
    } else {
      setIsDropdownOpen(false);
    }
  }, [searchValue, suggestions, isSuggestionsLoading]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSearchInputChange(e.target.value);
  };

  const handleSelect = (placeId: string, description: string) => {
    onSelectSuggestion(placeId, description);
    setIsDropdownOpen(false);
  };

  return (
    <div className="flex flex-col h-full w-full gap-0 relative">
      {/* Map area */}
      <div className="flex-grow relative bg-muted" data-testid="map-picker-container">
        {/* Search Overlay */}
        <div className="absolute top-4 left-4 z-10 w-72 max-w-[calc(100vw-2rem)] space-y-1">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchValue}
              onChange={handleInputChange}
              placeholder={mapSearchPlaceholder}
              className="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 shadow-md"
            />
          </div>

          {isDropdownOpen && (
            <div className="absolute z-50 w-full mt-1 bg-popover text-popover-foreground border rounded-md shadow-lg max-h-60 overflow-y-auto py-1">
              {isSuggestionsLoading && (
                <div className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground">
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                  {mapSearchSearching}
                </div>
              )}
              {!isSuggestionsLoading && suggestions.length === 0 && (
                <div className="px-4 py-2 text-sm text-muted-foreground">{mapSearchNoResults}</div>
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

        <MapView
          apiKey={apiKey}
          center={center}
          zoom={zoom}
          marker={marker}
          onCoordinatesChange={onMarkerChange}
          onViewStateChange={onViewStateChange}
          showZoomControl={true}
          labels={{
            loadingLabel: resolvingAddressLabel,
            errorLabel: mapErrorLabel,
          }}
        />
      </div>

      {/* Footer actions */}
      <div className="p-4 border-t flex gap-3 justify-end items-center bg-background flex-shrink-0">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
        >
          {mapCancelLabel}
        </button>
        <button
          type="button"
          disabled={isConfirmDisabled ?? !marker}
          onClick={onConfirm}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
        >
          {mapConfirmLabel}
        </button>
      </div>
    </div>
  );
}
