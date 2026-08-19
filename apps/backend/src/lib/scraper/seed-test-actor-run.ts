import { db } from '../../db/client.js';
import { scraperActorRuns, socialMediaAccountProfiles, posts } from '@festgrid/database';

/**
 * Seed test data: a completed Apify actor run with output but no persisted posts.
 * Use this to test the replayActorRun mutation.
 */
export async function seedTestActorRun() {
  const runId = '3bBQrzitUR7L9ahiR';
  const username = 'chaanakyaekadanta_academy';

  // 1. Get or create the profile
  const profile = await db
    .select()
    .from(socialMediaAccountProfiles)
    .where((t) => t.username === username)
    .limit(1)
    .then((rows) => rows[0]);

  if (!profile) {
    throw new Error(`Profile ${username} not found. Create it first via Instagram adapter flow.`);
  }

  // 2. Check if actor run already exists
  const existing = await db
    .select()
    .from(scraperActorRuns)
    .where((t) => t.runId === runId && t.vendor === 'apify')
    .limit(1)
    .then((rows) => rows[0]);

  if (existing) {
    console.log(`✅ Actor run ${runId} already exists (ID: ${existing.id})`);
    return existing.id;
  }

  // 3. Insert the actor run with full output (simulating vendor returned data but app didn't persist posts)
  const rawInput = {
    username: [username],
    resultsType: 'posts',
    resultsLimit: 10,
    onlyPostsNewerThan: '2026-08-16T03:00:34.898Z',
    skipPinnedPosts: false,
    dataDetailLevel: 'detailedData',
  };

  const rawOutput = [
    {
      id: '3965509556804829373',
      type: 'Image',
      shortCode: 'DcIUe6GxMC9',
      caption:
        '*KOMPETISI NASIONAL*\n*(KOMNAS)*\n\n📍Rayon SLEMAN\n\n*——— O F F L I N E ———*\n\nUntuk...',
      url: 'https://www.instagram.com/p/DcIUe6GxMC9/',
      commentsCount: 5,
      likesCount: 37,
      timestamp: '2026-08-17T05:46:57.000Z',
      ownerUsername: 'chaanakyaekadanta_academy',
    },
    {
      id: '3966155251272898353',
      type: 'Image',
      shortCode: 'DcKnS_8K9cx',
      caption: 'BABAK PENYISIHAN CHAANAKYA EKADANTA OLYMPIAD KARTASURA...',
      url: 'https://www.instagram.com/p/DcKnS_8K9cx/',
      commentsCount: 0,
      likesCount: 4,
      timestamp: '2026-08-18T03:13:57.000Z',
      ownerUsername: 'chaanakyaekadantaolympiad',
    },
    {
      id: '3966156952331386969',
      type: 'Image',
      shortCode: 'DcKnrwLKIBZ',
      caption: 'BABAK PENYISIHAN CHAANAKYA EKADANTA OLYMPIAD KLATEN...',
      url: 'https://www.instagram.com/p/DcKnrwLKIBZ/',
      commentsCount: 2,
      likesCount: 6,
      timestamp: '2026-08-18T03:13:51.000Z',
      ownerUsername: 'chaanakyaekadantaolympiad',
    },
    {
      id: '3965507384959007232',
      type: 'Image',
      shortCode: 'DcIT_Taq3oA',
      caption: 'BABAK PENYISIHAN CHAANAKYA EKADANTA OLYMPIAD CILACAP...',
      url: 'https://www.instagram.com/p/DcIT_Taq3oA/',
      commentsCount: 1,
      likesCount: 4,
      timestamp: '2026-08-17T05:42:24.000Z',
      ownerUsername: 'chaanakyaekadantaolympiad',
    },
    {
      id: '3966158493788667791',
      type: 'Image',
      shortCode: 'DcKoCLxK_-P',
      caption: 'BABAK PENYISIHAN CHAANAKYA EKADANTA OLYMPIAD PURWAKARTA...',
      url: 'https://www.instagram.com/p/DcKoCLxK_-P/',
      commentsCount: 14,
      likesCount: 15,
      timestamp: '2026-08-18T03:16:56.000Z',
      ownerUsername: 'chaanakyaekadantaolympiad',
    },
  ];

  const actorRunId = await db
    .insert(scraperActorRuns)
    .values({
      vendor: 'apify',
      triggerMode: 'sync',
      profileId: profile.id,
      runId,
      status: 'SUCCEEDED',
      rawInput: JSON.stringify(rawInput),
      rawOutput: JSON.stringify(rawOutput),
      itemCount: rawOutput.length,
      startedAt: new Date('2026-08-19T10:00:00Z'),
      completedAt: new Date('2026-08-19T10:00:58Z'),
    })
    .returning((t) => t.id)
    .then((rows) => rows[0].id);

  console.log(`✅ Seeded actor run ${runId} (ID: ${actorRunId})`);
  console.log(`   Profile: ${profile.id}`);
  console.log(`   Items: ${rawOutput.length}`);
  console.log(`   Status: SUCCEEDED with stored rawOutput (no posts persisted yet)`);
  console.log(`\n📝 Test the replay mutation with: replayActorRun(actorRunId: "${actorRunId}")`);

  return actorRunId;
}

// Run if invoked directly: `npx tsx src/lib/scraper/seed-test-actor-run.ts`
if (import.meta.url === `file://${process.argv[1]}`) {
  seedTestActorRun()
    .then(() => {
      console.log('\n✅ Seed complete');
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n❌ Seed failed:', err.message);
      process.exit(1);
    });
}
