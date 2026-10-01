import { useMemo, useEffect } from "react";
import { useQueryState, parseAsString, parseAsInteger } from "nuqs";
import { useGetMyLocationsQuery } from "@/generated/graphql";
import { graphqlClient } from "@/lib/graphql-client";
import { useViewerLocation } from "@/lib/hooks/useViewerLocation";
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

  // Story 0.39 — the shared viewer-location coordinate/permission source.
  // `coordinate` covers both this filter's own explicit "current location"
  // mode (AC10's captureExplicit) AND the ambient fallback for when no filter
  // is active at all (AC3's silent capture-when-granted path, AC7-8) — both
  // read the same underlying value, since the "viewer's current location" is
  // one concept regardless of which UI path populated it.
  const {
    coordinate,
    isCapturing: isCapturingCurrentLocation,
    error: currentLocationError,
    captureExplicit,
  } = useViewerLocation();

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
        await captureExplicit();
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
      if (!coordinate) return undefined;
      return {
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
        radiusKm: rad,
      };
    }

    return {
      locationPreferenceId: nearby,
      radiusKm: rad,
    };
  }, [session, nearby, nearbyRadiusKm, coordinate]);

  // Story 1.i1f review finding FIND-045 — one predicate decides whether a saved-location id
  // (never `off`, `current`, absent, or the empty string a bare `?nearby=` produces) is driving
  // the filter, so `activeSavedLocation`, `activeFilterCoord` and `isActiveFilterCoordPending`
  // cannot disagree about which location counts as "the active one". Previously one derived
  // value guarded with `!nearby` while the flag used three explicit comparisons, so `?nearby=`
  // read as "no filter" for one and "a pending saved location" for the other.
  const hasSavedLocationFilter = !!nearby && nearby !== "off" && nearby !== "current";

  const activeSavedLocation = useMemo(() => {
    if (!hasSavedLocationFilter) return undefined;
    return savedLocations.find((l) => l.id === nearby);
  }, [hasSavedLocationFilter, nearby, savedLocations]);

  const activeFilterCoord = useMemo(() => {
    if (!hasSavedLocationFilter) return coordinate ?? undefined;
    const loc = activeSavedLocation;
    if (loc?.latitude != null && loc?.longitude != null) {
      return { latitude: loc.latitude, longitude: loc.longitude };
    }
    return undefined;
  }, [hasSavedLocationFilter, coordinate, activeSavedLocation]);

  /**
   * Story 1.i1f review finding FIND-045 — distinguishes "the coordinate is not known yet"
   * from "confirmed absent". `activeFilterCoord` is `undefined` in both cases (the distance
   * badge is correctly omitted either way — `EventCardNearbyBadge` is "never a
   * disabled/placeholder state", Story 1.i1i AC1), so this flag is the only way a consumer can
   * tell them apart.
   *
   * It answers exactly one question — "is the selected saved location's coordinate still being
   * fetched?" — and deliberately not "does that location have a coordinate":
   *
   *  - `true` while a saved-location filter is selected AND its coordinate is unresolvable
   *    because the `getMyLocations` query that carries it is in flight — the transient window a
   *    hard load of a deep link (`?nearby=loc-1`) opens.
   *  - `false` once that query settles: a location with a coordinate resolves
   *    `activeFilterCoord` instead, and one genuinely without a coordinate (or one that no
   *    longer exists) is confirmed absent.
   *  - `false` when the query fails (`locationsError`) — nothing is in flight, so there is no
   *    pending state to report even though the coordinate is unknown.
   *  - `false` in `off`/`current` mode and for a bare `?nearby=`, all of which
   *    `hasSavedLocationFilter` treats as "no saved-location filter". `off`/`current` read
   *    `useViewerLocation().coordinate`, which never depends on this query.
   *  - `false` for an anonymous viewer, who never runs this query at all (`enabled: !!session`,
   *    so React Query v5's `isLoading` stays `false`) and has no filter UI either (AC7).
   *
   * Consumer: the location filter panel (`EventDiscoveryPanel` → `FilterHub` →
   * `LocationRadiusFilter`'s `isSelectedLocationPending` prop), which uses it to keep the
   * "no saved locations" hint from contradicting the loading line while a deep-linked filter is
   * still resolving.
   */
  const isActiveFilterCoordPending =
    hasSavedLocationFilter &&
    !locationsError &&
    isLoadingLocations &&
    (activeSavedLocation?.latitude == null || activeSavedLocation?.longitude == null);

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
    isActiveFilterCoordPending,
  };
}
