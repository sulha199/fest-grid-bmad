# 5. Geolocation

**Service:** Geoapify (Geocoding, Reverse Geocoding, Place Details APIs)

**Description:** 
Provides backend address, place, and coordinate resolution along with inline timezone lookup, as well as interactive map tiles for frontend display.

*   **Backend Layer:** Server-to-server geocoding and autocomplete. This layer uses the unrestricted backend `GEOAPIFY_API_KEY`, and is fronted by a Postgres-backed caching layer to avoid redundant external API calls and manage quota usage efficiently.
*   **Frontend Layer (Maps):** Web-based map tile rendering via MapLibre GL JS. This layer uses a separate, HTTP-referrer-restricted API key stored in `NEXT_PUBLIC_GEOAPIFY_MAPS_API_KEY`. It is restricted to the application's domain(s) in the Geoapify dashboard, preventing unauthorized use by third parties.

**Reasoning:** 
Geoapify was selected over Google Geolocation/Places (per Sprint Change Proposal 2026-08-03) because it offers permissive indefinite-storage/caching terms, native timezone-in-response, a single API key covering geocoding/reverse-geocoding/place-details/autocomplete, and a generous 3,000-credits/day free tier that comfortably covers this project's MVP scale.
