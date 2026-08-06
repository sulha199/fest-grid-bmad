"use client";

import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { MapViewProps } from './map.types';

export type { MapViewProps, MapViewLabels } from './map.types';

/**
 * MapView is a presentation-only, domain-agnostic Map component.
 * It renders interactive map tiles using MapLibre GL JS and Geoapify styles.
 * It features a single controlled marker and coordinate emission on map click.
 *
 * NOTE ON ACCESSIBILITY:
 * Interactive pointer-based selection on canvas-rendered maps is pointer/tap-only.
 * Any component consuming MapView must provide a non-map keyboard-accessible
 * alternative (e.g. address autocomplete search field) for full WCAG compliance.
 */
export function MapView({
  apiKey,
  center,
  zoom = 12,
  marker,
  onCoordinatesChange,
  mapStyle = 'osm-bright',
  labels,
  className = '',
}: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [mapLoaded, setMapLoaded] = useState(false);

  const loadingText = labels?.loadingLabel ?? 'Loading map…';
  const errorText = labels?.errorLabel ?? 'Unable to load the map.';
  const ariaText = labels?.ariaLabel ?? 'Interactive map';

  // 1. Initialize map on mount or when API key/style changes
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const styleUrl = `https://maps.geoapify.com/v1/styles/${mapStyle}/style.json?apiKey=${apiKey}`;

    try {
      // See scripts/copy-maplibre-worker.mjs for why this is required under webpack.
      maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs');

      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: styleUrl,
        center: [center.longitude, center.latitude],
        zoom,
      });

      mapRef.current = map;

      map.on('load', () => {
        setStatus('ready');
        setMapLoaded(true);
      });

      map.on('error', (e) => {
        console.error('MapLibre error:', e);
        setStatus('error');
      });

      map.on('click', (e) => {
        onCoordinatesChange({
          latitude: e.lngLat.lat,
          longitude: e.lngLat.lng,
        });
      });

      return () => {
        map.remove();
        mapRef.current = null;
        setMapLoaded(false);
        if (markerRef.current) {
          markerRef.current.remove();
          markerRef.current = null;
        }
      };
    } catch (err) {
      console.error('Failed to initialize map:', err);
      setStatus('error');
    }
  }, [apiKey, mapStyle]);

  // 2. React to center and zoom changes imperatively
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    map.setCenter([center.longitude, center.latitude]);
  }, [center.latitude, center.longitude]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    map.setZoom(zoom);
  }, [zoom]);

  // 3. React to marker changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (marker) {
      if (markerRef.current) {
        markerRef.current.setLngLat([marker.longitude, marker.latitude]);
      } else {
        const newMarker = new maplibregl.Marker()
          .setLngLat([marker.longitude, marker.latitude])
          .addTo(map);
        markerRef.current = newMarker;
      }
    } else {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
    }
  }, [marker, mapLoaded]);

  return (
    <div className={`relative w-full h-full ${className}`}>
      {/* Map Container */}
      <div
        ref={mapContainerRef}
        style={{ width: '100%', height: '100%' }}
        tabIndex={0}
        aria-label={ariaText}
        data-testid="map-container"
      />

      {/* Loading Overlay */}
      {status === 'loading' && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-muted/80 backdrop-blur-[1px]"
          data-testid="map-loading"
        >
          <div className="flex flex-col items-center gap-2">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-sm font-medium text-muted-foreground">{loadingText}</span>
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {status === 'error' && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-destructive/10 backdrop-blur-[1px] p-4 text-center"
          data-testid="map-error"
        >
          <div className="flex flex-col items-center gap-2 max-w-[280px]">
            <span className="text-sm font-medium text-destructive">{errorText}</span>
          </div>
        </div>
      )}
    </div>
  );
}
