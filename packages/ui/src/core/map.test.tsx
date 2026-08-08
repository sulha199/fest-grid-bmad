import React from 'react';
import { render, fireEvent, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MapView } from './map';
import * as maplibregl from 'maplibre-gl';

// Mock maplibre-gl
const onHandlers: Record<string, Function[]> = {};
let mapInstance: any = null;
let markerInstance: any = null;

vi.mock('maplibre-gl', () => {
  class MockMap {
    container: any;
    style: string;
    center: [number, number];
    zoom: number;
    addControl = vi.fn();
    remove = vi.fn();
    setCenter = vi.fn();
    setZoom = vi.fn();

    constructor(options: any) {
      this.container = options.container;
      this.style = options.style;
      this.center = options.center || [0, 0];
      this.zoom = options.zoom || 12;
      mapInstance = this;
    }

    on(event: string, handler: Function) {
      if (!onHandlers[event]) {
        onHandlers[event] = [];
      }
      onHandlers[event].push(handler);
    }

    getCenter() {
      return { lat: this.center[1], lng: this.center[0] };
    }

    getZoom() {
      return this.zoom;
    }
  }

  class MockMarker {
    setLngLat = vi.fn().mockReturnThis();
    addTo = vi.fn().mockReturnThis();
    remove = vi.fn();

    constructor() {
      markerInstance = this;
    }
  }

  class MockNavigationControl {
    options: any;
    constructor(options: any) {
      this.options = options;
    }
  }

  return {
    Map: MockMap,
    Marker: MockMarker,
    NavigationControl: MockNavigationControl,
    setWorkerUrl: vi.fn(),
  };
});

function triggerEvent(event: string, data: any) {
  if (onHandlers[event]) {
    onHandlers[event].forEach((handler) => handler(data));
  }
}

describe('MapView Component', () => {
  beforeEach(() => {
    mapInstance = null;
    markerInstance = null;
    Object.keys(onHandlers).forEach((key) => {
      delete onHandlers[key];
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const defaultProps = {
    apiKey: 'test-api-key',
    center: { latitude: -6.2000, longitude: 106.8000 },
    zoom: 12,
    marker: null,
    onCoordinatesChange: vi.fn(),
  };

  it('renders loading overlay initially, and transitions to ready on load event', () => {
    const { getByTestId, queryByTestId, getByText } = render(<MapView {...defaultProps} />);

    // Initially loading
    expect(getByTestId('map-loading')).toBeInTheDocument();
    expect(getByText('Loading map…')).toBeInTheDocument();

    // Trigger load event
    act(() => {
      triggerEvent('load', {});
    });

    expect(queryByTestId('map-loading')).not.toBeInTheDocument();
  });

  it('renders error overlay when MapLibre fires error event', () => {
    const { getByTestId, getByText } = render(<MapView {...defaultProps} />);

    // Trigger error event
    act(() => {
      triggerEvent('error', new Error('API Key rejected'));
    });

    expect(getByTestId('map-error')).toBeInTheDocument();
    expect(getByText('Unable to load the map.')).toBeInTheDocument();
  });

  it('constructs correct style URL and initializes MapLibre Map instance', () => {
    render(<MapView {...defaultProps} mapStyle="dark-matter" />);

    expect(mapInstance).not.toBeNull();
    expect(mapInstance.style).toBe(
      'https://maps.geoapify.com/v1/styles/dark-matter/style.json?apiKey=test-api-key'
    );
    expect(mapInstance.center).toEqual([106.8000, -6.2000]);
    expect(mapInstance.zoom).toBe(12);
  });

  it('supports custom localized labels', () => {
    const { getByText, getByTestId } = render(
      <MapView
        {...defaultProps}
        labels={{
          loadingLabel: 'Memuat peta…',
          ariaLabel: 'Peta interaktif',
        }}
      />
    );

    expect(getByText('Memuat peta…')).toBeInTheDocument();
    expect(getByTestId('map-container')).toHaveAttribute('aria-label', 'Peta interaktif');
  });

  it('emits Coordinates on map click event', () => {
    const onCoordinatesChange = vi.fn();
    render(<MapView {...defaultProps} onCoordinatesChange={onCoordinatesChange} />);

    // Simulate map click
    act(() => {
      triggerEvent('click', {
        lngLat: { lat: -6.2100, lng: 106.8100 },
      });
    });

    expect(onCoordinatesChange).toHaveBeenCalledWith({
      latitude: -6.2100,
      longitude: 106.8100,
    });
  });

  it('creates, repositions, and removes Marker when marker prop changes', () => {
    const { rerender } = render(<MapView {...defaultProps} />);

    // Initially no marker
    expect(markerInstance).toBeNull();

    // Set marker prop
    rerender(<MapView {...defaultProps} marker={{ latitude: -6.2200, longitude: 106.8200 }} />);

    expect(markerInstance).not.toBeNull();
    expect(markerInstance.setLngLat).toHaveBeenCalledWith([106.8200, -6.2200]);
    expect(markerInstance.addTo).toHaveBeenCalledWith(mapInstance);

    // Update marker coordinates
    rerender(<MapView {...defaultProps} marker={{ latitude: -6.2300, longitude: 106.8300 }} />);
    expect(markerInstance.setLngLat).toHaveBeenLastCalledWith([106.8300, -6.2300]);

    // Clear marker
    rerender(<MapView {...defaultProps} marker={null} />);
    expect(markerInstance.remove).toHaveBeenCalled();
  });

  it('conditionally adds zoom NavigationControl when showZoomControl is true (default)', () => {
    render(<MapView {...defaultProps} />);

    expect(mapInstance.addControl).toHaveBeenCalledTimes(1);
    expect(mapInstance.addControl).toHaveBeenCalledWith(expect.any(Object), 'top-right');
  });

  it('does not add zoom NavigationControl when showZoomControl is false', () => {
    render(<MapView {...defaultProps} showZoomControl={false} />);

    expect(mapInstance.addControl).not.toHaveBeenCalled();
  });

  it('reports camera state changes (moveend/zoomend) and ignores programmatic camera updates', () => {
    const onViewStateChange = vi.fn();
    const { rerender } = render(<MapView {...defaultProps} onViewStateChange={onViewStateChange} />);

    // Simulate user-driven moveend
    mapInstance.center = [106.8500, -6.2500];
    mapInstance.zoom = 14;

    act(() => {
      triggerEvent('moveend', {});
    });

    expect(onViewStateChange).toHaveBeenCalledWith({
      center: { latitude: -6.2500, longitude: 106.8500 },
      zoom: 14,
    });

    // Reset mock counts
    onViewStateChange.mockClear();

    // Rerender with programmatic center change
    rerender(
      <MapView
        {...defaultProps}
        center={{ latitude: -6.3000, longitude: 106.9000 }}
        zoom={13}
        onViewStateChange={onViewStateChange}
      />
    );

    // Expect setCenter/setZoom were called programmatically with { programmatic: true }
    expect(mapInstance.setCenter).toHaveBeenCalledWith([106.9000, -6.3000], { programmatic: true });
    expect(mapInstance.setZoom).toHaveBeenCalledWith(13, { programmatic: true });

    // Simulate moveend event triggered programmatically
    act(() => {
      triggerEvent('moveend', { programmatic: true });
    });

    // onViewStateChange should NOT have been called due to programmatic flag
    expect(onViewStateChange).not.toHaveBeenCalled();
  });

  it('calls map.remove() on unmount to cleanup the MapLibre instance', () => {
    const { unmount } = render(<MapView {...defaultProps} />);
    expect(mapInstance).not.toBeNull();

    unmount();
    expect(mapInstance.remove).toHaveBeenCalled();
  });
});
