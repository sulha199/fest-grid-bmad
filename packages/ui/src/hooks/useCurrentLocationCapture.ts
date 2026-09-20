"use client";

import { useState, useEffect, useCallback } from "react";

export type GeolocationCaptureError = "permission-denied" | "timeout" | "unavailable" | "unknown";

export interface UseCurrentLocationCaptureResult {
  isAvailable: boolean;
  isCapturing: boolean;
  error: GeolocationCaptureError | null;
  capture: () => Promise<{ latitude: number; longitude: number }>;
  /**
   * Silent, permission-gated capture: resolves a coordinate only when the
   * browser's Permissions API already reports geolocation as `granted` (from
   * some earlier explicit action elsewhere, e.g. `capture()` via a user click) —
   * never calls the browser's location API otherwise, so this can NEVER trigger
   * a new permission prompt on its own. Resolves `undefined` when permission is
   * `prompt`/`denied`, when the Permissions API isn't supported, or on any
   * capture error. See feature: ambient nearby-badge fallback (Story 1.i1f
   * revision) — the interim step before Story 0.39's explicit consent-banner ask.
   */
  captureIfPermissionGranted: () => Promise<{ latitude: number; longitude: number } | undefined>;
}

export function useCurrentLocationCapture(): UseCurrentLocationCaptureResult {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<GeolocationCaptureError | null>(null);

  useEffect(() => {
    setIsAvailable(typeof window !== "undefined" && !!window.navigator?.geolocation);
  }, []);

  const capture = useCallback((): Promise<{ latitude: number; longitude: number }> => {
    setError(null);
    setIsCapturing(true);

    return new Promise((resolve, reject) => {
      const available = typeof window !== "undefined" && !!window.navigator?.geolocation;
      if (!available) {
        const err: GeolocationCaptureError = "unavailable";
        setError(err);
        setIsCapturing(false);
        reject(new Error(err));
        return;
      }

      window.navigator.geolocation.getCurrentPosition(
        (position) => {
          setIsCapturing(false);
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (geoError) => {
          setIsCapturing(false);
          let err: GeolocationCaptureError = "unknown";

          if (geoError.code === geoError.PERMISSION_DENIED) {
            err = "permission-denied";
          } else if (geoError.code === geoError.POSITION_UNAVAILABLE) {
            err = "unavailable";
          } else if (geoError.code === geoError.TIMEOUT) {
            err = "timeout";
          }

          setError(err);
          reject(new Error(err));
        },
        {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });
  }, []);

  const captureIfPermissionGranted = useCallback(async (): Promise<
    { latitude: number; longitude: number } | undefined
  > => {
    if (typeof window === "undefined" || !window.navigator?.geolocation) return undefined;
    if (!window.navigator.permissions?.query) return undefined;

    try {
      const status = await window.navigator.permissions.query({ name: "geolocation" as PermissionName });
      if (status.state !== "granted") return undefined;
    } catch {
      return undefined;
    }

    try {
      return await capture();
    } catch {
      return undefined;
    }
  }, [capture]);

  return {
    isAvailable,
    isCapturing,
    error,
    capture,
    captureIfPermissionGranted,
  };
}
