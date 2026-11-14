import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, inArray, isNull, sql } from 'drizzle-orm';
import {
  apiKeys,
  events,
  posts,
  postAccountAssociations,
  favorites,
  accountTypeClassificationReviews,
  schedules,
  subscriptions,
  userLocations,
  users,
  socialMediaAccountProfiles,
  reports,
  jobs,
  jobAttempts,
  brightdataPendingJobs,
  apifyPendingJobs,
} from './schema';
import {
  FIXTURE_API_KEY_IDS,
  FIXTURE_COUNTS,
  FIXTURE_JOBS,
  FIXTURE_JOB_IDS,
  FIXTURE_USERS,
  FIXTURE_EVENTS,
  FIXTURE_EVENT_IDS,
  FIXTURE_EVENT_SLUGS,
  FIXTURE_POST_IDS,
  FIXTURE_SCHEDULE_IDS,
  FIXTURE_SCHEDULE_SLUGS,
  FIXTURE_SUBSCRIPTION_IDS,
  FIXTURE_USER_IDS,
  FIXTURE_USER_LOCATION_IDS,
  FIXTURE_SOCIAL_MEDIA_ACCOUNT_PROFILE_IDS,
  FIXTURE_REPORT_IDS,
  FIXTURE_POSTS,
  createSqlClient,
  seedDatabase,
} from './seed';
import { loadDatabaseEnv } from './env';

// The "No-Image Fallback" EventCard fixtures deliberately have a post without a poster.
const intentionallyImageless = new Set(FIXTURE_EVENTS.filter((e) => e.slug.includes('-noimage-')).map((e) => e.id));

let databaseUrl: string | null = null;
let databaseEnvError: Error | null = null;
try {
  databaseUrl = loadDatabaseEnv(__dirname).databaseUrl;
} catch (error) {
  databaseEnvError = error instanceof Error ? error : new Error('Unknown DATABASE_URL load error');
  databaseUrl = null;
}

test('seed is deterministic, relationally valid, and idempotent', async () => {
    assert.ok(
      databaseUrl,
      `DATABASE_URL is required for seed integration test. ${databaseEnvError?.message ?? ''}`,
    );
    const requiredDatabaseUrl = databaseUrl;

    await seedDatabase(requiredDatabaseUrl);

    const sqlClient = createSqlClient(requiredDatabaseUrl);
    const db = drizzle(sqlClient);

    try {
      const [userCount] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(users);
      const [userLocationCount] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(userLocations);
      const [profileCount] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(socialMediaAccountProfiles);
      const [subscriptionCount] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(subscriptions);
      const [apiKeyCount] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(apiKeys);
      const [postCount] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(posts);
      const [postAssociationCount] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(postAccountAssociations);
      const [favoriteCount] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(favorites);
      const [classificationReviewCount] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(accountTypeClassificationReviews);
      const [eventCount] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(events);
      const [scheduleCount] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(schedules);
      const [reportCount] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(reports);
      const [jobCount] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(jobs);
      const [jobAttemptCount] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(jobAttempts);

      assert.equal(userCount.count, FIXTURE_COUNTS.users);
      assert.equal(userLocationCount.count, FIXTURE_COUNTS.userLocations);
      assert.equal(profileCount.count, FIXTURE_COUNTS.socialMediaAccountProfiles);
      assert.equal(subscriptionCount.count, FIXTURE_COUNTS.subscriptions);
      assert.equal(apiKeyCount.count, FIXTURE_COUNTS.apiKeys);
      assert.equal(postCount.count, FIXTURE_COUNTS.posts);
      assert.equal(postAssociationCount.count, FIXTURE_COUNTS.postAccountAssociations);
      assert.equal(favoriteCount.count, FIXTURE_COUNTS.favorites);
      assert.equal(classificationReviewCount.count, FIXTURE_COUNTS.accountTypeClassificationReviews);
      assert.equal(eventCount.count, FIXTURE_COUNTS.events);
      assert.equal(scheduleCount.count, FIXTURE_COUNTS.schedules);
      assert.equal(reportCount.count, FIXTURE_COUNTS.reports);
      assert.equal(jobCount.count, FIXTURE_COUNTS.jobs);

      // Story 10.6a: the seeded finished previews must be young in the DATABASE (not only in the constants): the chip window and the Apply window are 30 minutes.
      const previewRows = await db
        .select({ id: jobs.id, finishedAt: jobs.finishedAt })
        .from(jobs)
        .where(inArray(jobs.id, [FIXTURE_JOB_IDS.moderatorPreviewLimits, FIXTURE_JOB_IDS.moderatorPreviewOverCap, FIXTURE_JOB_IDS.moderatorPreviewCooldown]));
      assert.equal(previewRows.length, 3);
      for (const row of previewRows) {
        assert.ok(row.finishedAt && Date.now() - row.finishedAt.getTime() < 10 * 60_000, `seeded job ${row.id} finished minutes ago`);
      }
      assert.equal(jobAttemptCount.count, FIXTURE_COUNTS.jobAttempts);

      // Guard new unique constraint on postUrl from being broken by duplicate seed data
      assert.equal(new Set(FIXTURE_POSTS.map(p => p.postUrl)).size, FIXTURE_POSTS.length);

      const eventPostJoins = await db
        .select({ eventId: events.id, imageUrl: posts.imageUrl })
        .from(events)
        .leftJoin(posts, eq(events.postId, posts.id));
      
      assert.equal(eventPostJoins.length, FIXTURE_COUNTS.events);
      eventPostJoins.forEach((row) => {
        if (intentionallyImageless.has(row.eventId)) return;
        assert.ok(row.imageUrl !== null && row.imageUrl !== undefined, `Event ${row.eventId} is missing linked post imageUrl`);
      });

      const orphanSchedules = await db
        .select({ scheduleId: schedules.id })
        .from(schedules)
        .leftJoin(events, eq(schedules.eventId, events.id))
        .where(isNull(events.id));

      const orphanUserLocations = await db
        .select({ userLocationId: userLocations.id })
        .from(userLocations)
        .leftJoin(users, eq(userLocations.userId, users.id))
        .where(isNull(users.id));

      const orphanSubscriptions = await db
        .select({ subscriptionId: subscriptions.id })
        .from(subscriptions)
        .leftJoin(users, eq(subscriptions.userId, users.id))
        .where(isNull(users.id));

      const orphanApiKeys = await db
        .select({ apiKeyId: apiKeys.id })
        .from(apiKeys)
        .leftJoin(users, eq(apiKeys.userId, users.id))
        .where(isNull(users.id));

      const orphanPostsToProfiles = await db
        .select({ postId: posts.id })
        .from(posts)
        .leftJoin(socialMediaAccountProfiles, eq(posts.accountId, socialMediaAccountProfiles.id))
        .where(isNull(socialMediaAccountProfiles.id));

      const orphanSubscriptionsToProfiles = await db
        .select({ subscriptionId: subscriptions.id })
        .from(subscriptions)
        .leftJoin(socialMediaAccountProfiles, eq(subscriptions.accountId, socialMediaAccountProfiles.id))
        .where(isNull(socialMediaAccountProfiles.id));

      assert.equal(orphanSchedules.length, 0);
      assert.equal(orphanUserLocations.length, 0);
      assert.equal(orphanSubscriptions.length, 0);
      assert.equal(orphanApiKeys.length, 0);
      assert.equal(orphanPostsToProfiles.length, 0);
      assert.equal(orphanSubscriptionsToProfiles.length, 0);

      const eventSlugRows = await db.select({ slug: events.slug }).from(events);
      const scheduleSlugRows = await db.select({ slug: schedules.slug }).from(schedules);
      const userIdRows = await db.select({ id: users.id }).from(users);
      const userLocationIdRows = await db.select({ id: userLocations.id }).from(userLocations);
      const profileIdRows = await db.select({ id: socialMediaAccountProfiles.id }).from(socialMediaAccountProfiles);
      const subscriptionIdRows = await db.select({ id: subscriptions.id }).from(subscriptions);
      const apiKeyIdRows = await db.select({ id: apiKeys.id }).from(apiKeys);
      const postIdRows = await db.select({ id: posts.id }).from(posts);
      const eventIdRows = await db.select({ id: events.id }).from(events);
      const scheduleIdRows = await db.select({ id: schedules.id }).from(schedules);
      const reportIdRows = await db.select({ id: reports.id }).from(reports);

      assert.deepEqual(
        userIdRows.map((row) => row.id).sort(),
        FIXTURE_USER_IDS,
      );
      assert.deepEqual(
        userLocationIdRows.map((row) => row.id).sort(),
        FIXTURE_USER_LOCATION_IDS,
      );
      assert.deepEqual(
        profileIdRows.map((row) => row.id).sort(),
        FIXTURE_SOCIAL_MEDIA_ACCOUNT_PROFILE_IDS,
      );
      assert.deepEqual(
        subscriptionIdRows.map((row) => row.id).sort(),
        FIXTURE_SUBSCRIPTION_IDS,
      );
      assert.deepEqual(
        apiKeyIdRows.map((row) => row.id).sort(),
        FIXTURE_API_KEY_IDS,
      );
      assert.deepEqual(
        postIdRows.map((row) => row.id).sort(),
        FIXTURE_POST_IDS,
      );
      assert.deepEqual(
        eventIdRows.map((row) => row.id).sort(),
        FIXTURE_EVENT_IDS,
      );
      assert.deepEqual(
        scheduleIdRows.map((row) => row.id).sort(),
        FIXTURE_SCHEDULE_IDS,
      );
      assert.deepEqual(
        reportIdRows.map((row) => row.id).sort(),
        FIXTURE_REPORT_IDS,
      );

      assert.deepEqual(
        eventSlugRows.map((row) => row.slug).sort(),
        FIXTURE_EVENT_SLUGS,
      );
      assert.deepEqual(
        scheduleSlugRows.map((row) => row.slug).sort(),
        FIXTURE_SCHEDULE_SLUGS,
      );

      const scheduleWindowRows = await db
        .select({
          slug: schedules.slug,
          startDate: schedules.eventStartDate,
          endDate: schedules.eventEndDate,
        })
        .from(schedules);

      const scheduleWindows = new Map(
        scheduleWindowRows.map((row) => [
          row.slug,
          { startDate: row.startDate, endDate: row.endDate },
        ]),
      );

      assert.deepEqual(scheduleWindows.get('past-jazz-night-2025-main-fixed'), {
        startDate: '2025-02-20',
        endDate: '2025-02-20',
      });
      assert.deepEqual(scheduleWindows.get('ongoing-culture-fest-opening-fixed'), {
        startDate: '2026-01-10',
        endDate: '2027-12-31',
      });
      assert.deepEqual(scheduleWindows.get('upcoming-family-workshop-main-fixed'), {
        startDate: '2027-11-15',
        endDate: '2027-11-15',
      });
    } finally {
      await sqlClient.end();
    }

    // Simulate app code (a real scraper webhook) creating pending-job rows that
    // reference a seeded profile between seed runs, reproducing the FK violation
    // this fixture guards against: rerunning seedDatabase() must not fail with
    // "brightdata_pending_jobs_profile_id_social_media_account_profiles_id_fk".
    const pendingJobsSqlClient = createSqlClient(requiredDatabaseUrl);
    const pendingJobsDb = drizzle(pendingJobsSqlClient);
    try {
      const seededProfileId = FIXTURE_SOCIAL_MEDIA_ACCOUNT_PROFILE_IDS[0];
      await pendingJobsDb.insert(brightdataPendingJobs).values({
        profileId: seededProfileId,
        snapshotId: 'integration-test-brightdata-snapshot',
        webhookToken: 'integration-test-brightdata-token',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });
      await pendingJobsDb.insert(apifyPendingJobs).values({
        profileId: seededProfileId,
        runId: 'integration-test-apify-run',
        webhookToken: 'integration-test-apify-token',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });
    } finally {
      await pendingJobsSqlClient.end();
    }

    await seedDatabase(requiredDatabaseUrl);

    const sqlClientAfterSecondRun = createSqlClient(requiredDatabaseUrl);
    const dbAfterSecondRun = drizzle(sqlClientAfterSecondRun);

    try {
      const [userCountSecondRun] = await dbAfterSecondRun
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(users);
      const [userLocationCountSecondRun] = await dbAfterSecondRun
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(userLocations);
      const [profileCountSecondRun] = await dbAfterSecondRun
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(socialMediaAccountProfiles);
      const [subscriptionCountSecondRun] = await dbAfterSecondRun
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(subscriptions);
      const [apiKeyCountSecondRun] = await dbAfterSecondRun
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(apiKeys);
      const [postCountSecondRun] = await dbAfterSecondRun
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(posts);
      const [eventCountSecondRun] = await dbAfterSecondRun
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(events);
      const [scheduleCountSecondRun] = await dbAfterSecondRun
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(schedules);
      const [reportCountSecondRun] = await dbAfterSecondRun
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(reports);
      // Story 10.4 Part C: the e2e job rows are re-created, never doubled.
      const [jobCountSecondRun] = await dbAfterSecondRun
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(jobs);

      assert.equal(userCountSecondRun.count, FIXTURE_COUNTS.users);
      assert.equal(userLocationCountSecondRun.count, FIXTURE_COUNTS.userLocations);
      assert.equal(profileCountSecondRun.count, FIXTURE_COUNTS.socialMediaAccountProfiles);
      assert.equal(subscriptionCountSecondRun.count, FIXTURE_COUNTS.subscriptions);
      assert.equal(apiKeyCountSecondRun.count, FIXTURE_COUNTS.apiKeys);
      assert.equal(postCountSecondRun.count, FIXTURE_COUNTS.posts);
      assert.equal(eventCountSecondRun.count, FIXTURE_COUNTS.events);
      assert.equal(scheduleCountSecondRun.count, FIXTURE_COUNTS.schedules);
      assert.equal(reportCountSecondRun.count, FIXTURE_COUNTS.reports);
      assert.equal(jobCountSecondRun.count, FIXTURE_COUNTS.jobs);

      const eventPostJoinsSecondRun = await dbAfterSecondRun
        .select({ eventId: events.id, imageUrl: posts.imageUrl })
        .from(events)
        .leftJoin(posts, eq(events.postId, posts.id));
      
      assert.equal(eventPostJoinsSecondRun.length, FIXTURE_COUNTS.events);
      eventPostJoinsSecondRun.forEach((row) => {
        if (intentionallyImageless.has(row.eventId)) return;
        assert.ok(row.imageUrl !== null && row.imageUrl !== undefined, `Event ${row.eventId} is missing linked post imageUrl`);
      });

      const userIdRowsSecondRun = await dbAfterSecondRun.select({ id: users.id }).from(users);
      const userLocationIdRowsSecondRun = await dbAfterSecondRun
        .select({ id: userLocations.id })
        .from(userLocations);
      const profileIdRowsSecondRun = await dbAfterSecondRun
        .select({ id: socialMediaAccountProfiles.id })
        .from(socialMediaAccountProfiles);
      const subscriptionIdRowsSecondRun = await dbAfterSecondRun
        .select({ id: subscriptions.id })
        .from(subscriptions);
      const apiKeyIdRowsSecondRun = await dbAfterSecondRun
        .select({ id: apiKeys.id })
        .from(apiKeys);
      const postIdRowsSecondRun = await dbAfterSecondRun
        .select({ id: posts.id })
        .from(posts);
      const eventIdRowsSecondRun = await dbAfterSecondRun.select({ id: events.id }).from(events);
      const scheduleIdRowsSecondRun = await dbAfterSecondRun
        .select({ id: schedules.id })
        .from(schedules);
      const reportIdRowsSecondRun = await dbAfterSecondRun
        .select({ id: reports.id })
        .from(reports);
      const eventSlugRowsSecondRun = await dbAfterSecondRun.select({ slug: events.slug }).from(events);
      const scheduleSlugRowsSecondRun = await dbAfterSecondRun
        .select({ slug: schedules.slug })
        .from(schedules);

      assert.deepEqual(
        userIdRowsSecondRun.map((row) => row.id).sort(),
        FIXTURE_USER_IDS,
      );
      assert.deepEqual(
        userLocationIdRowsSecondRun.map((row) => row.id).sort(),
        FIXTURE_USER_LOCATION_IDS,
      );
      assert.deepEqual(
        profileIdRowsSecondRun.map((row) => row.id).sort(),
        FIXTURE_SOCIAL_MEDIA_ACCOUNT_PROFILE_IDS,
      );
      assert.deepEqual(
        subscriptionIdRowsSecondRun.map((row) => row.id).sort(),
        FIXTURE_SUBSCRIPTION_IDS,
      );
      assert.deepEqual(
        apiKeyIdRowsSecondRun.map((row) => row.id).sort(),
        FIXTURE_API_KEY_IDS,
      );
      assert.deepEqual(
        postIdRowsSecondRun.map((row) => row.id).sort(),
        FIXTURE_POST_IDS,
      );
      assert.deepEqual(
        eventIdRowsSecondRun.map((row) => row.id).sort(),
        FIXTURE_EVENT_IDS,
      );
      assert.deepEqual(
        scheduleIdRowsSecondRun.map((row) => row.id).sort(),
        FIXTURE_SCHEDULE_IDS,
      );
      assert.deepEqual(
        reportIdRowsSecondRun.map((row) => row.id).sort(),
        FIXTURE_REPORT_IDS,
      );

      assert.deepEqual(
        eventSlugRowsSecondRun.map((row) => row.slug).sort(),
        FIXTURE_EVENT_SLUGS,
      );
      assert.deepEqual(
        scheduleSlugRowsSecondRun.map((row) => row.slug).sort(),
        FIXTURE_SCHEDULE_SLUGS,
      );

      // seedDatabase() clears brightdataPendingJobs/apifyPendingJobs rather than
      // reseeding them, so the rows inserted above must be gone, not just non-blocking.
      const [brightdataPendingJobCountSecondRun] = await dbAfterSecondRun
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(brightdataPendingJobs);
      const [apifyPendingJobCountSecondRun] = await dbAfterSecondRun
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(apifyPendingJobs);
      assert.equal(brightdataPendingJobCountSecondRun.count, 0);
      assert.equal(apifyPendingJobCountSecondRun.count, 0);
    } finally {
      await sqlClientAfterSecondRun.end();
    }
  },
);

// Story 10.6a (show the Re-extract progress, the missing-images banner and Retry): the Re-extract rows the e2e specs open. They are the moderator fixture
// user's own jobs for four fixture posts, hold a preview with the per-image list and no caption, no image link and no vendor name, and are never
// started again by a spec (no vendor call, no Lambda).
test('the seeded Re-extract preview jobs hold the per-image report and nothing that must not reach a screen', () => {
  const byId = new Map(FIXTURE_JOBS.map((job) => [job.id, job]));
  const ids = [FIXTURE_JOB_IDS.moderatorPreviewLimits, FIXTURE_JOB_IDS.moderatorPreviewOverCap, FIXTURE_JOB_IDS.moderatorPreviewCooldown, FIXTURE_JOB_IDS.moderatorRunning];
  const moderator = FIXTURE_USERS[0];
  assert.equal(moderator.role, 'moderator');
  for (const id of ids) {
    const job = byId.get(id);
    assert.ok(job, `job ${id} is seeded`);
    assert.equal(job.ownerUserId, moderator.id);
    assert.equal(job.type, 'reextract-post');
  }
  assert.equal(new Set(FIXTURE_JOBS.map((job) => job.id)).size, FIXTURE_JOBS.length);
  assert.equal(new Set(FIXTURE_JOBS.map((job) => job.inputKey)).size, FIXTURE_JOBS.length, 'every row has its own reuse key');
  // One post per row, so each source-post row finds exactly its own job (the newest one of the moderator for that post).
  assert.equal(new Set(ids.map((id) => (byId.get(id)?.input as { postId: string }).postId)).size, ids.length);

  for (const id of ids.slice(0, 3)) {
    const result = byId.get(id)?.resultData as unknown as { images: Array<{ position: number; role: string; state: string }>; imagesAvailable: number; imagesSent: number; imageCap: number; refresh: Record<string, unknown> };
    assert.equal(result.images.length, result.imagesAvailable, 'one entry per image');
    assert.equal(result.images.filter((image) => image.state === 'READ').length, result.imagesSent, 'READ entries equal imagesSent');
    assert.equal(result.images[0].position, 0);
    assert.equal(result.images[0].role, 'COVER');
    // Nothing that must not reach a screen or a log: no link, no caption, no vendor name (the leak canaries of the read tests, here on the seed).
    const text = JSON.stringify(result);
    assert.doesNotMatch(text, /https?:|cdninstagram|apify|brightdata|bright data|caption/i);
  }
  const limits = byId.get(FIXTURE_JOB_IDS.moderatorPreviewLimits);
  assert.equal(limits?.status, 'SUCCEEDED_WITH_LIMITS');
  assert.equal((limits?.resultData as unknown as { images: Array<{ state: string }> }).images.filter((image) => image.state === 'NOT_READ_EXPIRED').length, 4, 'the cover and slides 3 to 5');
  const overCap = byId.get(FIXTURE_JOB_IDS.moderatorPreviewOverCap)?.resultData as unknown as { images: Array<{ state: string }>; imageCap: number };
  assert.equal(overCap.images.filter((image) => image.state === 'NOT_SENT_OVER_CAP').length, 2);
  assert.equal(overCap.imageCap, 10);
  // Finished recently enough for the 30-minute chip window and the Apply window to be open when a spec runs soon after the seed.
  for (const id of ids.slice(0, 3)) {
    const job = byId.get(id);
    assert.ok(job?.finishedAt && Date.now() - job.finishedAt.getTime() < 10 * 60_000, `${id} finished minutes ago`);
  }
});
