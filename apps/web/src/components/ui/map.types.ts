import type { Coordinates } from '@festgrid/shared-types';

export interface MapViewLabels {
  loadingLabel?: string;
  errorLabel?: string;
  ariaLabel?: string;
}

export interface MapViewProps {
  /** Geoapify HTTP-referrer-restricted frontend API key */
  apiKey: string;
  /** Initial center coordinates of the map */
  center: Coordinates;
  /** Zoom level of the map (default: 12) */
  zoom?: number;
  /** A single controlled marker to render on the map. If null, no marker is shown. */
  marker: Coordinates | null;
  /** Callback fired when the user clicks or taps on the map surface */
  onCoordinatesChange: (coordinates: Coordinates) => void;
  /** Geoapify map style name (default: 'osm-bright') */
  mapStyle?: string;
  /** Customizable localized labels for accessibility and states */
  labels?: MapViewLabels;
  /** Optional custom CSS classes for the map container */
  className?: string;
}
