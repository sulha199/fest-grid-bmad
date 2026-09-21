"use client";

import { useState, useEffect, useCallback } from "react";

export type GeolocationCaptureError = "permission-denied" | "timeout" | "unavailable" | "unknown";

/**
 * Story 1.i1f review finding 9 — the rejected value of `capture()`, carrying the
 * typed failure reason as `code` so a caller can distinguish "the viewer
 * declined" from "the attempt failed" (a timeout, an unavailable fix, no
 * Geolocation API at all) without string-matching an error message.
 * `apps/web/src/components/layout/AppShellWrapper.tsx`'s
 * `viewer_location_ambient_consent_resolved` outcome tagging is the call site
 * this exists for.
 */
export class GeolocationCaptureFailure extends Error {
  readonly code: GeolocationCaptureError;

  constructor(code: GeolocationCaptureError) {
    super(code);
    this.name = "GeolocationCaptureFailure";
    this.code = code;
  }
}

/** Narrows an `unknown` rejection value to the typed capture failure above. */
export function isGeolocationCaptureFailure(value: unknown): value is GeolocationCaptureFailure {
  return value instanceof GeolocationCaptureFailure;
}

export interface UseCurrentLocationCaptureResult {
  isAvailable: boolean;
  isCapturing: boolean;
  error: GeolocationCaptureError | null;
  /**
   * Rejects with a `GeolocationCaptureFailure` (never a bare `Error`) so callers
   * can read the typed `code` off the rejection.
   */
  capture: () => Promise<{ latitude: number; longitude: number }>;
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
        reject(new GeolocationCaptureFailure(err));
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
          reject(new GeolocationCaptureFailure(err));
        },
        {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });
  }, []);

  return {
    isAvailable,
    isCapturing,
    error,
    capture,
  };
}
