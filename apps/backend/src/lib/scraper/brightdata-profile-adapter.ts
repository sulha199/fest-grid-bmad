import type { ProfileScrapePurpose, ProfileScraperAdapter, ScrapedProfile } from '@festgrid/domain';
import { scrapeBrightDataProfile } from './brightdata-client.js';
import { assertProviderCapacityAvailable, recordProviderUsage } from './usage-store.js';

/**
 * Bright Data's Instagram Profiles dataset finishes in ~80 s (the synchronous call gives up with a 202 at 60 s),
 * so the chain only starts it for a caller with at least this much time. The API Lambda (28 s) never does.
 */
export const BRIGHTDATA_PROFILE_MIN_BUDGET_MS = 90_000;

/** Bright Data returned no usable profile and did not say the page is gone, so another provider may still answer. */
export class BrightDataProfileUnavailableError extends Error {
  constructor(detail: string) {
    super(`Bright Data returned no profile: ${detail}`);
    this.name = 'BrightDataProfileUnavailableError';
  }
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function idText(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return text(value);
}

/**
 * Maps one Instagram Profiles record (fields observed 2026-10-31: `account`, `id`, `full_name`, `profile_name`,
 * `biography`, `profile_image_link`, `business_category_name`, `category_name`, ...).
 *
 * Returns `null` when the record cannot serve the purpose, with the same rule the Apify classification path uses:
 * a classification needs a handle, a name and a biography, because an empty biography gives the classifier nothing
 * to decide on. Throws when the record has no handle or id at all (not a profile record).
 */
export function mapBrightDataProfileRecord(record: unknown, purpose: ProfileScrapePurpose): ScrapedProfile | null {
  const item = (record ?? {}) as Record<string, unknown>;
  const username = text(item.account);
  const accountId = idText(item.id);
  if (!username || !accountId) {
    throw new BrightDataProfileUnavailableError('the record has no account handle or id');
  }

  const displayName = text(item.full_name) ?? text(item.profile_name) ?? username;
  const profileImageUrl = text(item.profile_image_link);
  const biography = text(item.biography);
  const businessCategoryName = text(item.business_category_name) ?? text(item.category_name) ?? null;

  if (purpose === 'classification' && (!text(item.full_name) || !biography)) {
    return null;
  }
  return { accountId, username, displayName, profileImageUrl, biography, businessCategoryName };
}

function toProfileUrl(handle: string): string {
  if (/^https?:\/\//i.test(handle)) return handle;
  return `https://www.instagram.com/${handle.replace(/^@/, '')}/`;
}

export const brightDataProfileAdapter: ProfileScraperAdapter = {
  name: 'brightdata',
  minBudgetMs: BRIGHTDATA_PROFILE_MIN_BUDGET_MS,

  async fetchProfile(handle, { purpose, budgetMs }) {
    await assertProviderCapacityAvailable('brightdata', `profile ${handle}`);

    const scrape = await scrapeBrightDataProfile(toProfileUrl(handle), budgetMs);

    if (scrape.kind === 'no-records') {
      // `dead_page` is Bright Data saying the profile does not exist: an answer. Anything else (an empty result,
      // another error code) is the vendor not delivering, which is how its 2026-10-21 outage looked.
      if (scrape.errorCode === 'dead_page') {
        return null;
      }
      throw new BrightDataProfileUnavailableError(scrape.errorCode ?? scrape.errorMessage ?? 'an empty result');
    }

    await recordProviderUsage('brightdata', 1);
    return mapBrightDataProfileRecord(scrape.records[0], purpose);
  },
};
