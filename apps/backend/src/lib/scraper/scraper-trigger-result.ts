// Shared discriminated result type for vendor async-trigger attempts (Story 3.4r).
// Single source of truth for whether a trigger attempt succeeded and, if not,
// which failure class it fell into -- so the daily batch tally can distinguish a
// real provider/API outage (TRIGGER_ERROR) from an expected, self-imposed
// capacity/budget skip (CAPACITY_EXHAUSTED) without re-inferring state downstream.
//
// Lives in apps/backend (not packages/domain): this is scraper-vendor-integration
// plumbing used only within apps/backend/src/lib/scraper/, not a reusable cross-entity
// domain concept.

export type ScraperTriggerFailureReason = 'CAPACITY_EXHAUSTED' | 'TRIGGER_ERROR';

export type ScraperTriggerResult =
  | { success: true }
  | { success: false; failureReason: ScraperTriggerFailureReason };
