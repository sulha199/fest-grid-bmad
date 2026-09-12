// Shared per-target/per-provider tally helper for the daily EventBridge batch loop
// (Story 3.4r). Extracts the genuinely-identical shape of the tally + dominant-failure-
// reason computation shared by Apify and Bright Data into a single pure function, so the
// two vendors' health-check recording stays symmetric instead of duplicated. The vendors'
// actual trigger control flow (fallback order) stays separate per platform branch in
// scraper.ts -- that part is materially different and not a candidate for abstraction.
import type { ScraperTriggerFailureReason } from './scraper-trigger-result.js';

export interface ScraperTargetProviderMarker {
  attempted: boolean;
  succeeded?: boolean;
  failureReason?: ScraperTriggerFailureReason;
}

export interface ScraperProviderTally {
  attempted: number;
  succeeded: number;
  failureReason?: ScraperTriggerFailureReason;
}

export function tallyScraperProviderResults(
  markers: (ScraperTargetProviderMarker | undefined)[]
): ScraperProviderTally {
  let attempted = 0;
  let succeeded = 0;
  let sawTriggerError = false;
  let sawCapacityExhausted = false;

  for (const marker of markers) {
    if (!marker || !marker.attempted) {
      continue; // target where this vendor was never attempted
    }
    attempted += 1;
    if (marker.succeeded) {
      succeeded += 1;
    } else if (marker.failureReason === 'TRIGGER_ERROR') {
      sawTriggerError = true;
    } else if (marker.failureReason === 'CAPACITY_EXHAUSTED') {
      sawCapacityExhausted = true;
    }
  }

  const tally: ScraperProviderTally = { attempted, succeeded };

  if (attempted > 0 && succeeded === 0) {
    // Dominant failure reason: a real provider/API error is the more actionable/alarming
    // condition and takes priority over capacity noise when a day mixes both.
    if (sawTriggerError) {
      tally.failureReason = 'TRIGGER_ERROR';
    } else if (sawCapacityExhausted) {
      tally.failureReason = 'CAPACITY_EXHAUSTED';
    }
  }

  return tally;
}
