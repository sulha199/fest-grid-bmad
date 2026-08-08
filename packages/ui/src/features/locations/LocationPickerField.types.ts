export interface LocationSuggestion {
  placeId: string;
  description: string;
}

export interface LocationPickerFieldLabels {
  addressLabel?: string;
  addressPlaceholder?: string;
  addressSearching?: string;
  addressNoResults?: string;
  useCurrentLocationLabel?: string;
  pickOnMapLabel?: string;
}

export interface LocationPickerFieldProps {
  value?: string;
  suggestions: LocationSuggestion[];
  isSuggestionsLoading: boolean;
  onSearchInputChange: (value: string) => void;
  onSelectSuggestion: (placeId: string, description: string) => void;
  onUseCurrentLocation: () => void;
  onPickOnMap: () => void;
  resolvedPreview?: {
    status: 'loading' | 'resolved' | 'error';
    text: string;
  } | null;
  error?: string | null;
  labels?: LocationPickerFieldLabels;
  isCurrentLocationDisabled?: boolean;
  isPickOnMapDisabled?: boolean;
  isGeoCapturing?: boolean;
}
