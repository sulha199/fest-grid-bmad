import { useMemo, useState, useEffect } from "react";
import { useQueryState, parseAsString, parseAsInteger } from "nuqs";
import { useGetMyLocationsQuery } from "@/generated/graphql";
import { graphqlClient } from "@/lib/graphql-client";
import { useCurrentLocationCapture } from "@festgrid/ui";
import { useAuthSession } from "@/components/providers/auth-session-provider";
import { usePostHog } from "@festgrid/analytics";
import { useSearchParams } from "next/navigation";

export interface NearbyFilterInput {
  locationPreferenceId?: string;
  latitude?: number;
  longitude?: number;
  radiusKm: number;
}

export function useNearbyFilter() {
  const { session } = useAuthSession();
  const posthog = usePostHog();
  const searchParams = useSearchParams();

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
  } = useCurrentLocationCapture();

  // Sort locations by createdAt ascending to identify primary
  const savedLocations = useMemo(() => {
    const list = locationsData?.myLocations || [];
    return [...list]
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map((loc) => ({
        id: loc.id,
        name: loc.name,
        radiusKm: Math.round(loc.radius / 1000),
      }));
  }, [locationsData]);

  // Handle auto-defaulting on first visit
  useEffect(() => {
    if (!session || isLoadingLocations) return;

    const hasNearbyParam = searchParams.has("nearby");
    if (!hasNearbyParam && nearby === null) {
      if (savedLocations.length > 0) {
        // AC4: earliest created
        const earliest = savedLocations[0];
        setNearby(earliest.id);
        setNearbyRadiusKm(earliest.radiusKm);
        posthog.capture("nearby_filter_applied", {
          mode: "saved_location",
          locationId: earliest.id,
          radiusKm: earliest.radiusKm,
        });
      } else {
        // AC5: Fallback geolocation
        const attempted = sessionStorage.getItem("festgrid.nearbyGeoAttempted");
        if (!attempted) {
          sessionStorage.setItem("festgrid.nearbyGeoAttempted", "true");
          capture()
            .then((coords) => {
              setAdHocCoords(coords);
              setNearby("current");
              setNearbyRadiusKm(5);
              posthog.capture("nearby_filter_applied", {
                mode: "current_location",
                radiusKm: 5,
              });
            })
            .catch((err: any) => {
              console.error("Auto geolocation capture failed:", err);
              const reason = err.message || "unknown";
              posthog.capture("nearby_geolocation_denied", { reason });
              setNearby("off");
              posthog.capture("nearby_filter_applied", { mode: "off" });
            });
        } else {
          setNearby("off");
          posthog.capture("nearby_filter_applied", { mode: "off" });
        }
      }
    }
  }, [session, isLoadingLocations, savedLocations, nearby, searchParams]);

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
  };
}
