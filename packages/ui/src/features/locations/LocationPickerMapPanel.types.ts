import type { Coordinates } from '@festgrid/shared-types';
import type { LocationSuggestion } from './LocationPickerField.types';

export interface LocationPickerMapPanelLabels {
  mapSearchPlaceholder?: string;
  mapSearchSearching?: string;
  mapSearchNoResults?: string;
  resolvingAddressLabel?: string;
  mapErrorLabel?: string;
  mapCancelLabel?: string;
  mapConfirmLabel?: string;
}

export interface LocationPickerMapPanelProps {
  apiKey: string;
  center: Coordinates;
  zoom: number;
  marker: Coordinates | null;
  onMarkerChange: (coords: Coordinates) => void;
  onViewStateChange: (viewState: { center: Coordinates; zoom: number }) => void;
  searchValue: string;
  onSearchInputChange: (val: string) => void;
  suggestions: LocationSuggestion[];
  isSuggestionsLoading: boolean;
  onSelectSuggestion: (placeId: string, description: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isConfirmDisabled?: boolean;
  labels?: LocationPickerMapPanelLabels;
}
