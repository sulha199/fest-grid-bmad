/**
 * Profile scraping as a swappable adapter (2026-10-31).
 *
 * A "profile scrape" turns a handle into a `ScrapedProfile` (the lookup behind subscribing to an account, and
 * the biography the account classifier reads). Each vendor is one `ProfileScraperAdapter`; callers never name a
 * vendor, they ask the chain, and the order the chain tries them in is configuration
 * (`PROFILE_SCRAPER_PROVIDER_ORDER`, e.g. `brightdata,apify`). Switching the first choice is an env change.
 *
 * The chain is time-aware because the vendors are very different: an Apify profile run answers in ~5-25 s, a
 * Bright Data profile snapshot in ~80 s. A adapter declares the smallest budget it can work in
 * (`minBudgetMs`), and the chain skips it when the caller's remaining budget is smaller instead of burning
 * that budget on a call that cannot finish. The API Lambda (28 s hard limit) therefore never waits on Bright
 * Data, while a caller with a long budget (the async-subscribe worker, AD-41; an admin script) does.
 *
 * Pure: no vendor SDK, no I/O of its own, so it lives in the domain package and is tested with fake adapters.
 */

export type ProfileScraperAdapterName = 'apify' | 'brightdata';

/** Why the profile is wanted: the lookup needs identity only, classification also needs the biography. */
export type ProfileScrapePurpose = 'lookup' | 'classification';

export interface ScrapedProfile {
  /** The platform's stable account id (Instagram's numeric id). */
  accountId: string;
  username: string;
  displayName: string;
  profileImageUrl?: string;
  /** Present for `classification`; a `lookup` adapter may leave it out. */
  biography?: string;
  businessCategoryName?: string | null;
}

export interface ProfileScrapeContext {
  purpose: ProfileScrapePurpose;
  /** The time this adapter may spend, never more than the caller's remaining budget. */
  budgetMs: number;
}

export interface ProfileScraperAdapter {
  readonly name: ProfileScraperAdapterName;
  /** The smallest budget this vendor can finish in. The chain skips the adapter below it. */
  readonly minBudgetMs: number;
  /**
   * `ScrapedProfile` when the vendor found it; `null` when the vendor says the profile does not exist (an
   * answer, so the chain stops). Anything that is not an answer (a timeout, a refusal, an empty or unreadable
   * result) must THROW so the chain moves on to the next adapter.
   */
  fetchProfile(handle: string, context: ProfileScrapeContext): Promise<ScrapedProfile | null>;
}

export const DEFAULT_PROFILE_SCRAPER_ORDER: readonly ProfileScraperAdapterName[] = ['apify', 'brightdata'];

const KNOWN_ADAPTERS: ReadonlySet<string> = new Set<ProfileScraperAdapterName>(['apify', 'brightdata']);

/**
 * Reads `PROFILE_SCRAPER_PROVIDER_ORDER` (comma separated, case-insensitive, first = first choice). Unknown names
 * are reported in `ignored` and dropped, a name given twice counts once, and an empty or all-unknown value falls
 * back to the default order, so a typo never leaves the app with no profile scraper.
 */
export function parseProfileScraperOrder(value: string | undefined | null): {
  order: ProfileScraperAdapterName[];
  ignored: string[];
} {
  const order: ProfileScraperAdapterName[] = [];
  const ignored: string[] = [];
  for (const raw of (value ?? '').split(',')) {
    const name = raw.trim().toLowerCase();
    if (!name) continue;
    if (!KNOWN_ADAPTERS.has(name)) {
      ignored.push(name);
      continue;
    }
    if (!order.includes(name as ProfileScraperAdapterName)) {
      order.push(name as ProfileScraperAdapterName);
    }
  }
  return { order: order.length > 0 ? order : [...DEFAULT_PROFILE_SCRAPER_ORDER], ignored };
}

export type ProfileAdapterAttempt =
  | { adapter: ProfileScraperAdapterName; outcome: 'skipped'; reason: string }
  | { adapter: ProfileScraperAdapterName; outcome: 'failed'; error: unknown; elapsedMs: number }
  | { adapter: ProfileScraperAdapterName; outcome: 'not-found'; elapsedMs: number }
  | { adapter: ProfileScraperAdapterName; outcome: 'found'; elapsedMs: number };

/** No adapter could be tried inside the budget, so nothing was asked of any vendor. */
export class ProfileScraperBudgetError extends Error {
  constructor(public readonly attempts: ProfileAdapterAttempt[], budgetMs: number) {
    super(
      `No profile scraper fits a ${budgetMs}ms budget (${attempts
        .map((a) => `${a.adapter}: ${a.outcome === 'skipped' ? a.reason : a.outcome}`)
        .join('; ')})`
    );
    this.name = 'ProfileScraperBudgetError';
  }
}

export interface ProfileChainResult {
  profile: ScrapedProfile | null;
  /** Every adapter the chain considered, in order, for the caller's log line. */
  attempts: ProfileAdapterAttempt[];
}

/**
 * Tries the adapters in order within one shared budget.
 *
 * - found, or `null` (not found): the chain stops and returns it;
 * - a adapter that throws is recorded and the next one is tried; if none answers, the FIRST adapter's error is
 *   rethrown unchanged, so existing handling of its error types keeps working;
 * - a adapter whose `minBudgetMs` exceeds the remaining budget is skipped; if every adapter is skipped the chain
 *   throws `ProfileScraperBudgetError`.
 */
export async function runProfileScraperChain(input: {
  adapters: readonly ProfileScraperAdapter[];
  handle: string;
  purpose: ProfileScrapePurpose;
  budgetMs: number;
  now?: () => number;
}): Promise<ProfileChainResult> {
  const { adapters, handle, purpose, budgetMs, now = Date.now } = input;
  const deadline = now() + budgetMs;
  const attempts: ProfileAdapterAttempt[] = [];
  let firstError: { error: unknown } | undefined;

  for (const adapter of adapters) {
    const remainingMs = deadline - now();
    if (remainingMs < adapter.minBudgetMs) {
      attempts.push({
        adapter: adapter.name,
        outcome: 'skipped',
        reason: `needs ${adapter.minBudgetMs}ms, ${Math.max(0, remainingMs)}ms left`,
      });
      continue;
    }

    const startedAt = now();
    try {
      const profile = await adapter.fetchProfile(handle, { purpose, budgetMs: remainingMs });
      const elapsedMs = now() - startedAt;
      if (profile === null) {
        attempts.push({ adapter: adapter.name, outcome: 'not-found', elapsedMs });
        return { profile: null, attempts };
      }
      attempts.push({ adapter: adapter.name, outcome: 'found', elapsedMs });
      return { profile, attempts };
    } catch (error) {
      attempts.push({ adapter: adapter.name, outcome: 'failed', error, elapsedMs: now() - startedAt });
      firstError ??= { error };
    }
  }

  if (firstError) {
    throw firstError.error;
  }
  throw new ProfileScraperBudgetError(attempts, budgetMs);
}
