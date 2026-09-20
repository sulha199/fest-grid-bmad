import { useMemo, useState, useEffect } from "react";
import { useQueryState, parseAsString, parseAsInteger } from "nuqs";
import { useGetMyLocationsQuery } from "@/generated/graphql";
import { graphqlClient } from "@/lib/graphql-client";
import { useCurrentLocationCapture } from "@festgrid/ui";
import { useAuthSession } from "@/components/providers/auth-session-provider";
import { usePostHog } from "@festgrid/analytics";

export interface NearbyFilterInput {
  locationPreferenceId?: string;
  latitude?: number;
  longitude?: number;
  radiusKm: number;
}

export function useNearbyFilter() {
  const { session } = useAuthSession();
  const posthog = usePostHog();

  const [nearby, setNearby] = useQueryState("nearby", parseAsString);
  const [nearbyRadiusKm, setNearbyRadiusKm] = useQueryState("nearbyRadiusKm", parseAsInteger);

  const [adHocCoords, setAdHocCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  // Fetch locations
  const { data: locationsData, isLoading: isLoadingLocations, isError: locationsError, error: locationsQueryError } = useGetMyLocationsQuery(
    graphqlClient,
    {},
    { enabled: !!session }
  );

  useEffect(() => {
    if (locationsQueryError) {
      console.error("getMyLocations query failed:", locationsQueryError);
    }
  }, [locationsQueryError]);

  // Geolocation Hook
  const {
    isCapturing: isCapturingCurrentLocation,
    error: currentLocationError,
    capture,
    captureIfPermissionGranted,
  } = useCurrentLocationCapture();

  // Ambient fallback (interim step ahead of Story 0.39's explicit consent-banner
  // ask): when no nearby filter is active, silently reuse the viewer's current
  // location ONLY if the browser already reports geolocation permission as
  // granted (from some earlier explicit action, e.g. this filter's own "current
  // location" option or a location-picker form elsewhere) — never prompts on its
  // own. Session-gated so anonymous users are never queried (AC7).
  const [ambientCoord, setAmbientCoord] = useState<{ latitude: number; longitude: number } | undefined>(undefined);

  useEffect(() => {
    if (!session) {
      setAmbientCoord(undefined);
      return;
    }
    let cancelled = false;
    captureIfPermissionGranted().then((coord) => {
      if (!cancelled) setAmbientCoord(coord);
    });
    return () => {
      cancelled = true;
    };
  }, [session, captureIfPermissionGranted]);

  // Sort locations by createdAt ascending to identify primary
  const savedLocations = useMemo(() => {
    const list = locationsData?.myLocations || [];
    return [...list]
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map((loc) => ({
        id: loc.id,
        name: loc.name,
        radiusKm: Math.round(loc.radius / 1000),
        latitude: loc.locationDetails?.coordinates?.lat,
        longitude: loc.locationDetails?.coordinates?.lng,
      }));
  }, [locationsData]);

  // Wrap setters to fire analytics
  const handleSelectLocation = async (value: string | "off" | "current") => {
    if (value === "off") {
      await setNearby("off");
      await setNearbyRadiusKm(null);
      posthog.capture("nearby_filter_applied", { mode: "off" });
    } else if (value === "current") {
      try {
        const coords = await capture();
        setAdHocCoords(coords);
        await setNearby("current");
        const rad = nearbyRadiusKm || 5;
        await setNearbyRadiusKm(rad);
        posthog.capture("nearby_filter_applied", {
          mode: "current_location",
          radiusKm: rad,
        });
      } catch (err: any) {
        console.error("Manual geolocation capture failed:", err);
        const reason = err.message || "unknown";
        posthog.capture("nearby_geolocation_denied", { reason });
      }
    } else {
      const loc = savedLocations.find((l) => l.id === value);
      const rad = loc ? loc.radiusKm : 5;
      await setNearby(value);
      await setNearbyRadiusKm(rad);
      posthog.capture("nearby_filter_applied", {
        mode: "saved_location",
        locationId: value,
        radiusKm: rad,
      });
    }
  };

  const handleRadiusChange = async (radiusKm: number) => {
    await setNearbyRadiusKm(radiusKm);
    const mode = nearby === "current" ? "current_location" : nearby === "off" ? "off" : "saved_location";
    posthog.capture("nearby_filter_applied", {
      mode,
      locationId: nearby && nearby !== "current" && nearby !== "off" ? nearby : undefined,
      radiusKm,
    });
  };

  // Resolve the current selection into DSL query shape
  const resolvedFilter = useMemo(() => {
    if (!session || nearby === null || nearby === "off") {
      return undefined;
    }

    const rad = nearbyRadiusKm || 5;

    if (nearby === "current") {
      if (!adHocCoords) return undefined;
      return {
        latitude: adHocCoords.latitude,
        longitude: adHocCoords.longitude,
        radiusKm: rad,
      };
    }

    return {
      locationPreferenceId: nearby,
      radiusKm: rad,
    };
  }, [session, nearby, nearbyRadiusKm, adHocCoords]);

  const activeFilterCoord = useMemo(() => {
    if (nearby === "off" || !nearby) return ambientCoord;
    if (nearby === "current") return adHocCoords ?? undefined;
    const loc = savedLocations.find(l => l.id === nearby);
    if (loc?.latitude != null && loc?.longitude != null) {
      return { latitude: loc.latitude, longitude: loc.longitude };
    }
    return undefined;
  }, [nearby, adHocCoords, savedLocations, ambientCoord]);

  return {
    isAuthenticated: !!session,
    isLoadingLocations,
    locationsError: !!locationsError,
    savedLocations,
    selectedValue: nearby,
    radiusKm: nearbyRadiusKm || 5,
    isCapturingCurrentLocation,
    currentLocationError,
    onSelectLocation: handleSelectLocation,
    onRadiusChange: handleRadiusChange,
    resolvedFilter,
    activeFilterCoord,
  };
}
