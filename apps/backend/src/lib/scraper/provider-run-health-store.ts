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

// Only the newest sampleSize finished runs are read, of any age: evaluateProviderRunHealth applies the
// fresh window and the longer carry-over cap (BUG-082), so a degraded provider that is only probed a few
// times a day stays degraded until a probe returns posts.
export async function getProviderRunHealth(vendor: ScraperVendor, now: Date = new Date()): Promise<ProviderRunHealth> {
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

  return evaluateProviderRunHealth(runs, DEFAULT_PROVIDER_RUN_HEALTH_OPTIONS, now);
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

// The way back from a degraded state is a probe: while a provider is degraded only a few triggers per
// PROVIDER_PROBE_INTERVAL_MS get through to it, the rest go to the next provider. A probe's own result
// then decides (evaluateProviderRunHealth): it becomes the newest finished run and, if the vendor
// answered, clears the flag. Several probes, not one, because a single probe can land on an account with
// nothing new, which proves nothing about a provider that was degraded for returning no posts.
//
// The state is per process, on purpose and with its limit: a daily batch is one invocation, so it gets
// exactly its probes; another warm or cold Lambda instance can send a few more, each a small scrape.
// A probe whose trigger never reached the vendor gives its slot back (releaseProviderProbe), so a
// misconfigured or failing trigger cannot use up the interval and leave nothing to test with.
export const PROVIDER_PROBES_PER_INTERVAL = 3;

const probeWindows = new Map<ScraperVendor, { since: number; used: number }>();

function claimProviderProbe(vendor: ScraperVendor, now: number): boolean {
  const window = probeWindows.get(vendor);
  if (!window || now - window.since >= PROVIDER_PROBE_INTERVAL_MS) {
    probeWindows.set(vendor, { since: now, used: 1 });
    return true;
  }
  if (window.used < PROVIDER_PROBES_PER_INTERVAL) {
    window.used += 1;
    return true;
  }
  return false;
}

/** Gives back the probe slot of a trigger that failed before the vendor could produce a result. */
export function releaseProviderProbe(vendor: ScraperVendor): void {
  const window = probeWindows.get(vendor);
  if (window && window.used > 0) {
    window.used -= 1;
  }
}

/** Test seam: forget which providers already sent their probes. */
export function resetProviderProbeClaimsForTests(): void {
  probeWindows.clear();
}

/**
 * What a trigger should do about a provider's health (IDEA-095):
 * - `proceed`: the provider is healthy, or its health could not be read (fails open: an unreadable
 *   lookup never blocks a scrape);
 * - `probe`: the provider is degraded and this trigger is one of its few probes. If it fails before
 *   reaching the vendor the caller must `releaseProviderProbe`;
 * - `skip`: the provider is degraded and its probes are used up: take the next provider.
 */
export type DegradedProviderGate = 'proceed' | 'probe' | 'skip';

export async function gateDegradedProvider(vendor: ScraperVendor, now: number = Date.now()): Promise<DegradedProviderGate> {
  let health: ProviderRunHealth;
  try {
    health = await getProviderRunHealth(vendor, new Date(now));
  } catch (error) {
    console.error(`[Provider failover] Could not read run health for ${vendor}; not skipping it:`, error);
    return 'proceed';
  }

  if (!health.degraded) {
    return 'proceed';
  }

  if (claimProviderProbe(vendor, now)) {
    console.warn(
      `[Provider failover] ${vendor} is degraded (${health.reason}: ${health.failed} failed, ${health.empty} empty, ${health.ok} with posts of its last ${health.sampled} runs); this trigger is one of its probes, the rest go to the next provider.`
    );
    return 'probe';
  }
  return 'skip';
}
