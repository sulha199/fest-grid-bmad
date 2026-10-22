// Shared discriminated result type for vendor async-trigger attempts (Story 3.4r).
// Single source of truth for whether a trigger attempt succeeded and, if not,
// which failure class it fell into -- so the daily batch tally can distinguish a
// real provider/API outage (TRIGGER_ERROR) from an expected, self-imposed
// capacity/budget skip (CAPACITY_EXHAUSTED) without re-inferring state downstream.
//
// Lives in apps/backend (not packages/domain): this is scraper-vendor-integration
// plumbing used only within apps/backend/src/lib/scraper/, not a reusable cross-entity
// domain concept.

// 'DPA_NOT_CONFIRMED' (Story 0.i2d, AD-32): a deliberate, self-imposed gate closure (the
// APIFY_SCRAPING_CONFIRMED/BRIGHTDATA_SCRAPING_CONFIRMED kill switch) -- not a real vendor
// outage. Kept distinct from TRIGGER_ERROR so scraper-provider-health-store.ts's alerting
// logic doesn't misreport a team-controlled flag flip as a provider/API failure.
//
// 'PROVIDER_DEGRADED' (BUG-074, IDEA-095): the provider's recent runs returned nothing or failed
// (see provider-run-health-store.ts), so the trigger was skipped on purpose and the next provider in
// the chain took the target. Not a trigger error: nothing was sent to the vendor.
export type ScraperTriggerFailureReason =
  | 'CAPACITY_EXHAUSTED'
  | 'TRIGGER_ERROR'
  | 'DPA_NOT_CONFIRMED'
  | 'PROVIDER_DEGRADED';

export type ScraperTriggerResult =
  | { success: true }
  | { success: false; failureReason: ScraperTriggerFailureReason };
