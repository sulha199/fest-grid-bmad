import { db } from '../../db/client.js';
import { scraperActorRuns } from '@festgrid/database';
import {
  DEFAULT_PROVIDER_RUN_HEALTH_OPTIONS,
  evaluateProviderRunHealth,
  type ProviderRunHealth,
} from '@festgrid/domain';
import { and, desc, eq, isNotNull, ne } from 'drizzle-orm';

// Result-level provider health (BUG-074, IDEA-095). scraper-provider-health-store.ts counts days on
// which no *trigger* succeeded; a vendor that accepts every trigger and returns nothing (Bright Data,
// 2026-10-21) is invisible to it. This reads what the runs actually delivered, from scraper_actor_runs
// itself, so it needs no table of its own.

export type ScraperVendor = 'APIFY' | 'BRIGHTDATA';

/** How long a degraded provider is left alone before one more trigger is let through to test it. */
export const PROVIDER_PROBE_INTERVAL_MS = 6 * 60 * 60 * 1000;

export async function getProviderRunHealth(vendor: ScraperVendor): Promise<ProviderRunHealth> {
  const runs = await db
    .select({
      status: scraperActorRuns.status,
      itemCount: scraperActorRuns.itemCount,
      completedAt: scraperActorRuns.completedAt,
    })
    .from(scraperActorRuns)
    .where(
      and(
        eq(scraperActorRuns.vendor, vendor),
        ne(scraperActorRuns.status, 'PENDING'),
        isNotNull(scraperActorRuns.completedAt)
      )
    )
    .orderBy(desc(scraperActorRuns.completedAt))
    .limit(DEFAULT_PROVIDER_RUN_HEALTH_OPTIONS.sampleSize);

  return evaluateProviderRunHealth(runs);
}

/**
 * Providers that are degraded right now. A failed lookup reports none: scraping must never stop
 * because the health check could not run.
 */
export async function getDegradedProviders(): Promise<Set<ScraperVendor>> {
  const degraded = new Set<ScraperVendor>();
  for (const vendor of ['APIFY', 'BRIGHTDATA'] as const) {
    try {
      const health = await getProviderRunHealth(vendor);
      if (health.degraded) {
        degraded.add(vendor);
      }
    } catch (error) {
      console.error(`[Provider failover] Could not read run health for ${vendor}:`, error);
    }
  }
  return degraded;
}

// The way back from a degraded state is a probe: while a provider is degraded exactly one trigger per
// PROVIDER_PROBE_INTERVAL_MS gets through to it, the rest go to the next provider. The probe's own
// result then decides: a run that returns posts becomes the newest finished run and clears the flag
// (evaluateProviderRunHealth). The claim is per process -- a daily batch is one invocation, and an
// extra probe from another Lambda instance costs one small scrape.
const probeClaimedAt = new Map<ScraperVendor, number>();

function claimProviderProbe(vendor: ScraperVendor, now: number): boolean {
  const last = probeClaimedAt.get(vendor);
  if (last !== undefined && now - last < PROVIDER_PROBE_INTERVAL_MS) {
    return false;
  }
  probeClaimedAt.set(vendor, now);
  return true;
}

/** Test seam: forget which providers already sent their probe. */
export function resetProviderProbeClaimsForTests(): void {
  probeClaimedAt.clear();
}

/**
 * Whether a trigger for `vendor` should be skipped in favour of the next provider (IDEA-095): true
 * while the provider is degraded, except for the one probe per interval. Fails open -- an unreadable
 * health lookup never blocks a scrape.
 */
export async function shouldSkipDegradedProvider(vendor: ScraperVendor, now: number = Date.now()): Promise<boolean> {
  let health: ProviderRunHealth;
  try {
    health = await getProviderRunHealth(vendor);
  } catch (error) {
    console.error(`[Provider failover] Could not read run health for ${vendor}; not skipping it:`, error);
    return false;
  }

  if (!health.degraded) {
    return false;
  }

  if (claimProviderProbe(vendor, now)) {
    console.warn(
      `[Provider failover] ${vendor} is degraded (${health.reason}: ${health.failed} failed, ${health.empty} empty, ${health.ok} with posts of its last ${health.sampled} runs); sending one probe, the rest go to the next provider.`
    );
    return false;
  }
  return true;
}
