"use client";

import { useState, useEffect } from "react";

export type GeolocationCaptureError = "permission-denied" | "timeout" | "unavailable" | "unknown";

export interface UseCurrentLocationCaptureResult {
  isAvailable: boolean;
  isCapturing: boolean;
  error: GeolocationCaptureError | null;
  capture: () => Promise<{ latitude: number; longitude: number }>;
}

export function useCurrentLocationCapture(): UseCurrentLocationCaptureResult {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<GeolocationCaptureError | null>(null);

  useEffect(() => {
    setIsAvailable(typeof window !== "undefined" && !!window.navigator?.geolocation);
  }, []);

  const capture = (): Promise<{ latitude: number; longitude: number }> => {
    setError(null);
    setIsCapturing(true);

    return new Promise((resolve, reject) => {
      if (!isAvailable) {
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
  };

  return {
    isAvailable,
    isCapturing,
    error,
    capture,
  };
}
