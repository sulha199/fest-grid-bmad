export interface SavedLocationOption {
  id: string;
  name: string;
  radiusKm: number; // UserLocation.radius converted to km by the caller
}

export interface LocationRadiusFilterProps {
  isAuthenticated: boolean;
  isLoadingLocations: boolean;
  locationsError: boolean;
  savedLocations: SavedLocationOption[];
  // 'off' = explicitly disabled, 'current' = ad-hoc browser geolocation, <uuid> = a saved location, null = undecided (auto-default not yet resolved)
  selectedValue: string | 'off' | 'current' | null;
  radiusKm: number;
  isCapturingCurrentLocation: boolean;
  currentLocationError: 'permission-denied' | 'timeout' | 'unavailable' | 'unknown' | null;
  onSelectLocation: (value: string | 'off' | 'current') => void;
  onRadiusChange: (radiusKm: number) => void;
  /**
   * `useNearbyFilter().isActiveFilterCoordPending` (Story 1.i1f review finding, `FIND-045`) —
   * a saved-location filter is selected but the `getMyLocations` query carrying its option is
   * still in flight, so `savedLocations` is empty *for now* rather than genuinely empty.
   * Distinct from `isLoadingLocations`, which is also true when no saved-location filter is
   * active at all. Callers that already receive the flag should pass it so this panel does not
   * claim the viewer has no saved locations while the selected one is still resolving.
   * Defaults to `false` (existing consumers keep their current rendering).
   */
  isSelectedLocationPending?: boolean;
  labels: {
    filterLabel: string;
    offOptionLabel: string;
    currentLocationOptionLabel: string;
    radiusLabel: string;
    radiusUnit: (count: number) => string;
    detectingLocationLabel: string;
    permissionDeniedLabel: string;
    unavailableLabel: string;
    locationsErrorLabel: string;
    noSavedLocationsHint: string;
  };
  className?: string;
}
