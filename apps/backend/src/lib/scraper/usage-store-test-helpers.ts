import { db } from '../../db/client.js';
import { scraperProviderUsage } from '@festgrid/database';
import { eq } from 'drizzle-orm';

export const APIFY_TEST_PROVIDER = 'apify';

// A test file that exercises the real Apify capacity gate (directly or transitively) must call
// this both before its subtests run and after they finish: before, to self-heal if a prior run
// crashed/was interrupted before its own cleanup ran; after, so it doesn't leave a row behind
// for whichever test file runs next. See deferred-work.md, "quick-dev fix of
// scraper-provider-usage test pollution".
export async function clearApifyProviderUsage(): Promise<void> {
  await db.delete(scraperProviderUsage).where(eq(scraperProviderUsage.provider, APIFY_TEST_PROVIDER));
}
