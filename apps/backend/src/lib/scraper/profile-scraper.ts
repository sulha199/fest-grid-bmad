import {
  parseProfileScraperOrder,
  runProfileScraperChain,
  type ProfileAdapterAttempt,
  type ProfileScrapePurpose,
  type ProfileScraperAdapter,
  type ProfileScraperAdapterName,
  type ScrapedProfile,
} from '@festgrid/domain';
import { loadBackendEnv } from '../../env.js';
import { brightDataProfileAdapter } from './brightdata-profile-adapter.js';

/**
 * The profile-scraper registry and the one entry point callers use. The vendors are adapters
 * (`ProfileScraperAdapter`, @festgrid/domain); the order they are tried in is `PROFILE_SCRAPER_PROVIDER_ORDER`
 * (default `apify,brightdata`). To change the first choice, change that variable; to add a vendor, implement the
 * interface, register it here (or beside its own client, like Apify in `instagram-adapter.ts`), and add its name to
 * `ProfileScraperAdapterName`.
 *
 * Lives apart from `instagram-adapter.ts`, which registers the Apify adapter at load, so neither imports the other.
 */
const adapters = new Map<ProfileScraperAdapterName, ProfileScraperAdapter>([['brightdata', brightDataProfileAdapter]]);

export function registerProfileScraperAdapter(adapter: ProfileScraperAdapter): void {
  adapters.set(adapter.name, adapter);
}

/** The adapters in configured order; a configured name with no registered adapter is skipped with a warning. */
export function getProfileScraperAdapters(): ProfileScraperAdapter[] {
  const { order, ignored } = parseProfileScraperOrder(loadBackendEnv().profileScraperProviderOrder);
  if (ignored.length > 0) {
    console.warn(`PROFILE_SCRAPER_PROVIDER_ORDER names unknown provider(s) ${ignored.join(', ')}; ignored`);
  }
  const selected: ProfileScraperAdapter[] = [];
  for (const name of order) {
    const adapter = adapters.get(name);
    if (adapter) {
      selected.push(adapter);
    } else {
      console.warn(`Profile scraper "${name}" is configured but no adapter is registered for it; skipped`);
    }
  }
  return selected;
}

function describeAttempt(attempt: ProfileAdapterAttempt): string {
  switch (attempt.outcome) {
    case 'skipped':
      return `${attempt.adapter} skipped (${attempt.reason})`;
    case 'failed':
      return `${attempt.adapter} failed after ${attempt.elapsedMs}ms (${attempt.error instanceof Error ? attempt.error.message : String(attempt.error)})`;
    default:
      return `${attempt.adapter} ${attempt.outcome} in ${attempt.elapsedMs}ms`;
  }
}

/**
 * Fetches a profile through the configured adapters within `budgetMs`. `null` = the platform has no such profile.
 * One log line when more than one adapter was considered, so a fallback is visible in CloudWatch.
 */
export async function fetchScrapedProfile(
  handle: string,
  purpose: ProfileScrapePurpose,
  budgetMs: number
): Promise<ScrapedProfile | null> {
  const input = { adapters: getProfileScraperAdapters(), handle, purpose, budgetMs };
  try {
    const result = await runProfileScraperChain(input);
    if (result.attempts.length > 1) {
      console.log(`[profile-scraper] ${purpose} ${handle}: ${result.attempts.map(describeAttempt).join('; ')}`);
    }
    return result.profile;
  } catch (error) {
    console.warn(`[profile-scraper] ${purpose} ${handle} failed on every adapter tried`);
    throw error;
  }
}
