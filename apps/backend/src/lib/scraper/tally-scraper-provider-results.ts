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
  let sawDpaNotConfirmed = false;
  let sawProviderDegraded = false;

  for (const marker of markers) {
    if (!marker || !marker.attempted) {
      continue; // target where this vendor was never attempted
    }
    attempted += 1;
    if (marker.succeeded) {
      succeeded += 1;
    } else if (marker.failureReason === 'DPA_NOT_CONFIRMED') {
      sawDpaNotConfirmed = true;
    } else if (marker.failureReason === 'TRIGGER_ERROR') {
      sawTriggerError = true;
    } else if (marker.failureReason === 'PROVIDER_DEGRADED') {
      sawProviderDegraded = true;
    } else if (marker.failureReason === 'CAPACITY_EXHAUSTED') {
      sawCapacityExhausted = true;
    }
  }

  const tally: ScraperProviderTally = { attempted, succeeded };

  if (attempted > 0 && succeeded === 0) {
    // Dominant failure reason: DPA_NOT_CONFIRMED ranks highest -- a deliberate, deterministic,
    // 100%-of-calls gate closure (a flag the team itself controls) is the most actionable
    // signal for an operator, ranking above a possibly-sporadic real outage. A real
    // provider/API error (TRIGGER_ERROR) in turn takes priority over capacity noise. A provider
    // skipped for returning nothing (PROVIDER_DEGRADED) outranks a mere capacity skip: it is the
    // actionable one.
    if (sawDpaNotConfirmed) {
      tally.failureReason = 'DPA_NOT_CONFIRMED';
    } else if (sawTriggerError) {
      tally.failureReason = 'TRIGGER_ERROR';
    } else if (sawProviderDegraded) {
      tally.failureReason = 'PROVIDER_DEGRADED';
    } else if (sawCapacityExhausted) {
      tally.failureReason = 'CAPACITY_EXHAUSTED';
    }
  }

  return tally;
}

/**
 * A provider that was degraded when the batch started has had a full failure day, whatever its
 * triggers did (BUG-074, IDEA-095). A degraded provider is only sent a single probe, and a probe whose
 * trigger "succeeded" proves nothing about the results: they arrive after the batch, and decide
 * tomorrow's state. Without this, that one successful trigger would reset the provider's consecutive
 * failure days every day and the existing provider-down alert could never fire.
 *
 * A provider the batch never attempted stays unrecorded.
 */
export function applyProviderDegradation(
  tally: ScraperProviderTally,
  degradedAtBatchStart: boolean
): ScraperProviderTally {
  if (!degradedAtBatchStart || tally.attempted === 0) {
    return tally;
  }
  return { attempted: tally.attempted, succeeded: 0, failureReason: 'PROVIDER_DEGRADED' };
}
