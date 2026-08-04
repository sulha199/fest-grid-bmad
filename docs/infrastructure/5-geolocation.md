# 5. Geolocation

**Service:** Geoapify (Geocoding, Reverse Geocoding, Place Details APIs)

**Description:** 
Provides backend-only address, place, and coordinate resolution along with inline timezone lookup. It is fronted by a Postgres-backed caching layer to avoid redundant external API calls and manage quota usage efficiently.

**Reasoning:** 
Geoapify was selected over Google Geolocation/Places (per Sprint Change Proposal 2026-08-03) because it offers permissive indefinite-storage/caching terms, native timezone-in-response, a single API key covering geocoding/reverse-geocoding/place-details/autocomplete, and a generous 3,000-credits/day free tier that comfortably covers this project's MVP scale.
