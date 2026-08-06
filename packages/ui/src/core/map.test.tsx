import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import React from 'react';
import { MapView } from './map';

// To inspect calls, we can set up global/shared arrays using variables prefixed with `mock`
const mockMapInstances: any[] = [];
const mockMarkerInstances: any[] = [];

vi.mock('maplibre-gl', () => {
  class MockMap {
    container: any;
    style: any;
    center: any;
    zoom: any;
    listeners: { [key: string]: Function[] } = {};

    constructor(options: any) {
      this.container = options.container;
      this.style = options.style;
      this.center = options.center;
      this.zoom = options.zoom;
      mockMapInstances.push(this);
    }

    on(event: string, callback: Function) {
      if (!this.listeners[event]) {
        this.listeners[event] = [];
      }
      this.listeners[event].push(callback);
    }

    remove = vi.fn();
    setCenter = vi.fn();
    setZoom = vi.fn();

    // Helper to trigger mocked events
    trigger(event: string, data?: any) {
      const list = this.listeners[event] || [];
      list.forEach((cb) => cb(data));
    }
  }

  class MockMarker {
    lngLat: any;
    map: any;

    constructor() {
      mockMarkerInstances.push(this);
    }

    setLngLat(lngLat: any) {
      this.lngLat = lngLat;
      return this;
    }

    addTo(map: any) {
      this.map = map;
      return this;
    }

    remove = vi.fn();
  }

  return {
    default: {
      Map: MockMap,
      Marker: MockMarker,
    },
  };
});

describe('MapView Component', () => {
  const defaultProps = {
    apiKey: 'test-key',
    center: { latitude: 37.7749, longitude: -122.4194 },
    zoom: 12,
    marker: null,
    onCoordinatesChange: vi.fn(),
  };

  beforeEach(() => {
    mockMapInstances.length = 0;
    mockMarkerInstances.length = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders loading state by default', () => {
    render(<MapView {...defaultProps} />);
    expect(screen.getByTestId('map-loading')).toBeInTheDocument();
    expect(screen.getByText('Loading map…')).toBeInTheDocument();
  });

  it('constructs correct style URL and instantiates MapLibre map on mount', () => {
    render(<MapView {...defaultProps} />);
    expect(mockMapInstances.length).toBe(1);

    const mapInstance = mockMapInstances[0];
    expect(mapInstance.style).toBe(
      'https://maps.geoapify.com/v1/styles/osm-bright/style.json?apiKey=test-key'
    );
    expect(mapInstance.center).toEqual([-122.4194, 37.7749]);
    expect(mapInstance.zoom).toBe(12);
  });

  it('constructs correct style URL when custom style is provided', () => {
    render(<MapView {...defaultProps} mapStyle="dark-matter" />);
    const mapInstance = mockMapInstances[0];
    expect(mapInstance.style).toBe(
      'https://maps.geoapify.com/v1/styles/dark-matter/style.json?apiKey=test-key'
    );
  });

  it('removes loading overlay when "load" event fires', () => {
    render(<MapView {...defaultProps} />);
    const mapInstance = mockMapInstances[0];

    act(() => {
      mapInstance.trigger('load');
    });

    expect(screen.queryByTestId('map-loading')).not.toBeInTheDocument();
  });

  it('shows error state when "error" event fires', () => {
    render(<MapView {...defaultProps} />);
    const mapInstance = mockMapInstances[0];

    act(() => {
      mapInstance.trigger('error', new Error('Failed to load tiles'));
    });

    expect(screen.queryByTestId('map-loading')).not.toBeInTheDocument();
    expect(screen.getByTestId('map-error')).toBeInTheDocument();
    expect(screen.getByText('Unable to load the map.')).toBeInTheDocument();
  });

  it('calls onCoordinatesChange when map surface is clicked', () => {
    const onCoordinatesChange = vi.fn();
    render(<MapView {...defaultProps} onCoordinatesChange={onCoordinatesChange} />);
    const mapInstance = mockMapInstances[0];

    act(() => {
      mapInstance.trigger('click', {
        lngLat: { lat: 37.7833, lng: -122.4167 },
      });
    });

    expect(onCoordinatesChange).toHaveBeenCalledTimes(1);
    expect(onCoordinatesChange).toHaveBeenCalledWith({
      latitude: 37.7833,
      longitude: -122.4167,
    });
  });

  it('updates center and zoom imperatively when props change', () => {
    const { rerender } = render(<MapView {...defaultProps} />);
    const mapInstance = mockMapInstances[0];

    rerender(
      <MapView
        {...defaultProps}
        center={{ latitude: 40.7128, longitude: -74.006 }}
        zoom={14}
      />
    );

    expect(mapInstance.setCenter).toHaveBeenCalledWith([-74.006, 40.7128]);
    expect(mapInstance.setZoom).toHaveBeenCalledWith(14);
  });

  it('creates and manages Marker based on controlled marker prop', () => {
    const { rerender } = render(<MapView {...defaultProps} marker={null} />);
    const mapInstance = mockMapInstances[0];

    // Marker should not be created if null
    expect(mockMarkerInstances.length).toBe(0);

    // Render with marker
    rerender(
      <MapView
        {...defaultProps}
        marker={{ latitude: 37.7833, longitude: -122.4167 }}
      />
    );

    // Let map finish loading so the marker effect binds
    act(() => {
      mapInstance.trigger('load');
    });

    expect(mockMarkerInstances.length).toBe(1);
    expect(mockMarkerInstances[0].lngLat).toEqual([-122.4167, 37.7833]);
    expect(mockMarkerInstances[0].map).toBe(mapInstance);

    // Update marker coordinates
    rerender(
      <MapView
        {...defaultProps}
        marker={{ latitude: 40.7128, longitude: -74.006 }}
      />
    );
    expect(mockMarkerInstances[0].lngLat).toEqual([-74.006, 40.7128]);

    // Remove marker
    rerender(<MapView {...defaultProps} marker={null} />);
    expect(mockMarkerInstances[0].remove).toHaveBeenCalled();
  });

  it('sets accessibility attributes on container', () => {
    render(<MapView {...defaultProps} />);
    const container = screen.getByTestId('map-container');
    expect(container).toHaveAttribute('tabIndex', '0');
    expect(container).toHaveAttribute('aria-label', 'Interactive map');
  });

  it('respects label overrides', () => {
    render(
      <MapView
        {...defaultProps}
        labels={{
          loadingLabel: 'Chargement...',
          errorLabel: 'Erreur',
          ariaLabel: 'Carte interactive',
        }}
      />
    );

    expect(screen.getByText('Chargement...')).toBeInTheDocument();
    const container = screen.getByTestId('map-container');
    expect(container).toHaveAttribute('aria-label', 'Carte interactive');

    const mapInstance = mockMapInstances[0];
    act(() => {
      mapInstance.trigger('error');
    });
    expect(screen.getByText('Erreur')).toBeInTheDocument();
  });

  it('calls map.remove on unmount', () => {
    const { unmount } = render(<MapView {...defaultProps} />);
    const mapInstance = mockMapInstances[0];

    unmount();

    expect(mapInstance.remove).toHaveBeenCalled();
  });
});
