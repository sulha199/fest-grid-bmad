import '../src/lib/scraper/register-adapters.js';
import { db } from '../src/db/client.js';
import { posts, socialMediaAccountProfiles } from '@festgrid/database';
import { and, desc, eq } from 'drizzle-orm';
import { processScrapeJob } from '../src/lib/scraper/process-scrape-job.js';
import { ScrapablePlatform } from '@festgrid/domain';

const USERNAME = process.argv[2] ?? 'pakuwonmall.jogja';
const PLATFORM = (process.argv[3] ?? 'instagram') as ScrapablePlatform;

async function main() {
  const profile = await db
    .select()
    .from(socialMediaAccountProfiles)
    .where(
      and(
        eq(socialMediaAccountProfiles.platform, PLATFORM),
        eq(socialMediaAccountProfiles.username, USERNAME)
      )
    )
    .limit(1)
    .then((rows) => rows[0]);

  if (!profile) {
    console.error(`No socialMediaAccountProfiles row found for platform=${PLATFORM} username=${USERNAME}. Subscribe to it first so the profile row exists.`);
    process.exit(1);
  }

  console.log('--- Profile ---');
  console.log({ id: profile.id, accountId: profile.accountId, username: profile.username, lastScrapedAt: profile.lastScrapedAt });

  console.log('--- Calling processScrapeJob directly (bypassing SQS/Lambda) ---');
  await processScrapeJob({
    profileId: profile.id,
    platform: PLATFORM,
    accountId: profile.accountId,
    username: profile.username,
    isInitialNewSubscription: true,
  });

  const persistedPosts = await db
    .select()
    .from(posts)
    .where(eq(posts.accountId, profile.id))
    .orderBy(desc(posts.publishedAt))
    .limit(10);

  console.log(`--- Posts now in DB for this profile (${persistedPosts.length}) ---`);
  console.log(persistedPosts.map((p) => ({ id: p.id, postUrl: p.postUrl, publishedAt: p.publishedAt })));

  process.exit(0);
}

main();
