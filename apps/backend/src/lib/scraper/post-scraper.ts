import {
  getScraperAdapter,
  runPostScraperChain,
  type PostAdapterAttempt,
  type PostScrapeCredential,
  type ScrapablePlatform,
  type ScrapedPost,
} from '@festgrid/domain';
import { recordJobAttempt } from '../job-engine/record-job-attempt.js';
import './instagram-adapter.js'; // registers the Apify adapter in the registry (as the profile chain does)
import { getPostScraperAdapters } from './post-scraper-registry.js';
import { isProviderCapacityAvailable } from './usage-store.js';

/**
 * The one entry point callers use to fetch a post (Story 10.2, PRD 3.18 FR118), the twin of `profile-scraper.ts`. The vendors
 * are adapters (`PostScraperAdapter`, @festgrid/domain) kept in `post-scraper-registry.ts`; the order they are tried in is
 * `POST_SCRAPER_PROVIDER_ORDER` (default `brightdata,apify`, owner decision 2026-11-11, PRD OI-1).
 *
 * NO PRODUCTION CALLER USES THIS YET: `start-post-reextraction-preview.ts` and `resume-stalled-chains.ts` still call
 * `getPostByUrl`; Stories 10.5 to 10.10 adopt the chain.
 */

/**
 * Whether a provider's cap is known to be used up (Story 10.2 AC6): the usage store's answer, inverted. A test seam: the real
 * check reads the shared `apify` / `brightdata` usage rows, which a test must not write while other suites run in parallel.
 */
export let providerOverQuota: (provider: string) => Promise<boolean> = async (provider) => !(await isProviderCapacityAvailable(provider));

export function setProviderOverQuota(fn: typeof providerOverQuota): void {
  providerOverQuota = fn;
}

/** Whose credential a post scrape uses, by job type (PRD OI-3). Only the app-funded key exists until Story 3-4b. */
export function resolvePostScrapeCredential(_jobType: string | undefined, _ownerUserId: string | undefined): PostScrapeCredential {
  return { kind: 'app-funded' };
}

function describeAttempt(attempt: PostAdapterAttempt): string {
  switch (attempt.outcome) {
    case 'skipped':
      return `${attempt.adapter} skipped (${attempt.detail})`;
    case 'failed':
      return `${attempt.adapter} failed after ${attempt.elapsedMs}ms (${attempt.error instanceof Error ? attempt.error.name : 'error'})`;
    default:
      return `${attempt.adapter} ${attempt.outcome} in ${attempt.elapsedMs}ms`;
  }
}

/**
 * Fetches one post through the configured providers within `budgetMs`. `null` = the platform has no such post.
 * With a `jobId`, one `job_attempts` row is written per provider considered (also for the ones that fail or are skipped).
 * Only Instagram has a provider chain; any other platform falls through to its own adapter's `getPostByUrl`.
 * One log line when more than one provider was considered, so a fallback is visible in CloudWatch (no URL, no raw error).
 */
export async function fetchScrapedPost(input: {
  platform: ScrapablePlatform;
  url: string;
  budgetMs: number;
  credential?: PostScrapeCredential;
  jobId?: string;
}): Promise<ScrapedPost | null> {
  const { platform, url, budgetMs, jobId } = input;
  if (platform !== 'instagram') {
    return getScraperAdapter(platform).getPostByUrl(url);
  }
  try {
    const result = await runPostScraperChain({
      adapters: getPostScraperAdapters(),
      url,
      budgetMs,
      credential: input.credential ?? resolvePostScrapeCredential(undefined, undefined),
      // A provider whose cap is known to be used up (Story 10.2 AC6) is skipped with no call.
      isOverQuota: (name) => providerOverQuota(name),
      onAttempt: jobId ? (attempt) => recordJobAttempt({ jobId, attempt }) : undefined,
    });
    if (result.attempts.length > 1) {
      console.log(`[post-scraper] ${result.attempts.map(describeAttempt).join('; ')}`);
    }
    return result.post;
  } catch (error) {
    console.warn('[post-scraper] a post fetch failed on every provider tried');
    throw error;
  }
}
