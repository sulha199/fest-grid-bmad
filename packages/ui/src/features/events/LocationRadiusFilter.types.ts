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
