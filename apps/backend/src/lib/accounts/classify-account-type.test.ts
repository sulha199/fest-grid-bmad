import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../../db/client.js';
import { socialMediaAccountProfiles, accountTypeClassificationReviews } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import {
  classifyAccountType,
  setGetAccountClassificationProfileSeam,
  getAccountClassificationProfileSeam,
  setCallGeminiForAccountClassificationSeam,
  callGeminiForAccountClassificationSeam,
  setInsertAccountTypeClassificationReviewSeam,
  insertAccountTypeClassificationReviewSeam,
  ClassificationPersistenceFailedError
} from './classify-account-type.js';

// Captured once at module load, before any test can reassign the `let` export -- used to
// restore the real seam deterministically. (A plain-value import binding re-reads the live
// export, so re-passing the imported identifier itself would just reassign whatever the last
// test already set it to; capturing the reference up front avoids that.)
const realInsertAccountTypeClassificationReviewSeam = insertAccountTypeClassificationReviewSeam;

test('classifyAccountType orchestration tests', async (t) => {
  let testProfile: any;

  t.beforeEach(async () => {
    const [profile] = await db
      .insert(socialMediaAccountProfiles)
      .values({
        platform: 'instagram',
        accountId: 'test-classify-' + Math.random().toString(36).slice(2, 9),
        username: 'old_username',
        displayName: 'Old Display Name',
        accountType: null,
        accountTypeStatus: null,
        accountTypeConfidenceScore: null,
      })
      .returning();
    testProfile = profile;
  });

  t.afterEach(async () => {
    if (testProfile) {
      await db.delete(accountTypeClassificationReviews).where(eq(accountTypeClassificationReviews.accountId, testProfile.id));
      await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, testProfile.id));
    }
    setGetAccountClassificationProfileSeam(getAccountClassificationProfileSeam);
    setCallGeminiForAccountClassificationSeam(callGeminiForAccountClassificationSeam);
    setInsertAccountTypeClassificationReviewSeam(realInsertAccountTypeClassificationReviewSeam);
  });

  await t.test('1. Successful classification above threshold (ORGANIZER_VENUE_EVENT)', async () => {
    setGetAccountClassificationProfileSeam(async (username) => {
      return {
        username,
        displayName: 'Festival Organizer',
        biography: 'We host weekly open-air concerts',
        businessCategoryName: 'Event Organizer'
      };
    });

    let passedSubscriberIds: string[] = [];
    setCallGeminiForAccountClassificationSeam(async (req) => {
      passedSubscriberIds = req.subscriberUserIds;
      return {
        text: JSON.stringify({
          accountType: 'ORGANIZER_VENUE_EVENT',
          confidenceScore: 0.9
        })
      };
    });

    const result = await classifyAccountType({
      accountId: testProfile.id,
      username: 'fest_org',
      userId: 'user-id-abc'
    });

    assert.equal(result.accountType, 'ORGANIZER_VENUE_EVENT');
    assert.equal(result.accountTypeStatus, 'CONFIRMED');

    // Assert database updated
    const [updated] = await db.select().from(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, testProfile.id));
    assert.equal(updated.accountType, 'ORGANIZER_VENUE_EVENT');
    assert.equal(updated.accountTypeStatus, 'CONFIRMED');
    assert.equal(updated.accountTypeConfidenceScore, 0.9);

    // Confirm Winston fix: user-id-abc passed to Gemini, NOT derived active subscribers
    assert.deepEqual(passedSubscriberIds, ['user-id-abc']);

    // Check no review row created
    const reviews = await db.select().from(accountTypeClassificationReviews).where(eq(accountTypeClassificationReviews.accountId, testProfile.id));
    assert.equal(reviews.length, 0);
  });

  await t.test('2. Classification below threshold (Low Confidence)', async () => {
    setGetAccountClassificationProfileSeam(async (username) => {
      return {
        username,
        displayName: 'Ambiguous Account',
        biography: 'Vague bio about events in city',
        businessCategoryName: null
      };
    });

    setCallGeminiForAccountClassificationSeam(async () => {
      return {
        text: JSON.stringify({
          accountType: 'ORGANIZER_VENUE_EVENT',
          confidenceScore: 0.5 // below 0.7 threshold
        })
      };
    });

    const result = await classifyAccountType({
      accountId: testProfile.id,
      username: 'ambig_user',
      userId: 'user-id-abc'
    });

    assert.equal(result.accountType, 'ORGANIZER_VENUE_EVENT');
    assert.equal(result.accountTypeStatus, 'AWAITING_APPROVAL');

    // Assert database updated with AWAITING_APPROVAL
    const [updated] = await db.select().from(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, testProfile.id));
    assert.equal(updated.accountType, 'ORGANIZER_VENUE_EVENT');
    assert.equal(updated.accountTypeStatus, 'AWAITING_APPROVAL');
    assert.equal(updated.accountTypeConfidenceScore, 0.5);

    // Check review row is inserted with proposed account type and null failureReason
    const [review] = await db.select().from(accountTypeClassificationReviews).where(eq(accountTypeClassificationReviews.accountId, testProfile.id));
    assert.ok(review);
    assert.equal(review.proposedAccountType, 'ORGANIZER_VENUE_EVENT');
    assert.equal(review.confidenceScore, 0.5);
    assert.equal(review.failureReason, null);
  });

  await t.test('3. Apify lookup failure leads to hard failure handling', async () => {
    setGetAccountClassificationProfileSeam(async () => {
      throw new Error('Apify API rate limit');
    });

    const result = await classifyAccountType({
      accountId: testProfile.id,
      username: 'rate_limited',
      userId: 'user-id-abc'
    });

    assert.equal(result.accountType, null);
    assert.equal(result.accountTypeStatus, 'AWAITING_APPROVAL');

    // Assert database has null accountType and AWAITING_APPROVAL
    const [updated] = await db.select().from(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, testProfile.id));
    assert.equal(updated.accountType, null);
    assert.equal(updated.accountTypeStatus, 'AWAITING_APPROVAL');

    // Check review row has failureReason populated
    const [review] = await db.select().from(accountTypeClassificationReviews).where(eq(accountTypeClassificationReviews.accountId, testProfile.id));
    assert.ok(review);
    assert.equal(review.proposedAccountType, null);
    assert.equal(review.confidenceScore, null);
    assert.match(review.failureReason || '', /Apify lookup failed/);
  });

  await t.test('4. Gemini call failure leads to hard failure handling', async () => {
    setGetAccountClassificationProfileSeam(async (username) => {
      return {
        username,
        displayName: 'Fest',
        biography: 'Music',
        businessCategoryName: null
      };
    });

    setCallGeminiForAccountClassificationSeam(async () => {
      throw new Error('Gemini quota exhausted');
    });

    const result = await classifyAccountType({
      accountId: testProfile.id,
      username: 'gemini_err',
      userId: 'user-id-abc'
    });

    assert.equal(result.accountType, null);
    assert.equal(result.accountTypeStatus, 'AWAITING_APPROVAL');

    // Assert database updated
    const [updated] = await db.select().from(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, testProfile.id));
    assert.equal(updated.accountType, null);
    assert.equal(updated.accountTypeStatus, 'AWAITING_APPROVAL');

    // Check review row
    const [review] = await db.select().from(accountTypeClassificationReviews).where(eq(accountTypeClassificationReviews.accountId, testProfile.id));
    assert.ok(review);
    assert.equal(review.proposedAccountType, null);
    assert.match(review.failureReason || '', /Gemini call failed/);
  });

  await t.test('5. Malformed Gemini JSON leads to hard failure handling', async () => {
    setGetAccountClassificationProfileSeam(async (username) => {
      return {
        username,
        displayName: 'Fest',
        biography: 'Music',
        businessCategoryName: null
      };
    });

    setCallGeminiForAccountClassificationSeam(async () => {
      return { text: '{ invalid json }' };
    });

    const result = await classifyAccountType({
      accountId: testProfile.id,
      username: 'malformed_json',
      userId: 'user-id-abc'
    });

    assert.equal(result.accountType, null);
    assert.equal(result.accountTypeStatus, 'AWAITING_APPROVAL');

    // Assert database updated
    const [updated] = await db.select().from(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, testProfile.id));
    assert.equal(updated.accountType, null);
    assert.equal(updated.accountTypeStatus, 'AWAITING_APPROVAL');

    // Check review row
    const [review] = await db.select().from(accountTypeClassificationReviews).where(eq(accountTypeClassificationReviews.accountId, testProfile.id));
    assert.ok(review);
    assert.equal(review.proposedAccountType, null);
    assert.match(review.failureReason || '', /Failed to parse Gemini response/);
  });

  // Prod incident 2026-10-15/2026-10-20 (infokonsermusik): the profile UPDATE and the review-row
  // INSERT used to be two separate statements, so a kill or write error between them left the
  // profile AWAITING_APPROVAL with no open review row. These two tests simulate the review
  // insert failing in each failure path and assert the paired profile update rolled back with
  // it -- the profile must come out exactly as it went in.
  await t.test('6. Review-row insert failing during a hard failure leaves the profile unchanged (atomicity regression guard)', async () => {
    setGetAccountClassificationProfileSeam(async () => {
      throw new Error('Apify API rate limit');
    });
    setInsertAccountTypeClassificationReviewSeam(async () => {
      throw new Error('simulated review insert failure');
    });

    await assert.rejects(
      () => classifyAccountType({
        accountId: testProfile.id,
        username: 'atomic_hard_failure',
        userId: 'user-id-abc'
      }),
      (err: any) => {
        assert.ok(err instanceof ClassificationPersistenceFailedError);
        return true;
      }
    );

    const [unchanged] = await db.select().from(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, testProfile.id));
    assert.equal(unchanged.accountType, null);
    assert.equal(unchanged.accountTypeStatus, null);
    assert.equal(unchanged.accountTypeConfidenceScore, null);

    const reviews = await db.select().from(accountTypeClassificationReviews).where(eq(accountTypeClassificationReviews.accountId, testProfile.id));
    assert.equal(reviews.length, 0);
  });

  await t.test('7. Review-row insert failing on the low-confidence path leaves the profile unchanged (atomicity regression guard)', async () => {
    setGetAccountClassificationProfileSeam(async (username) => ({
      username,
      displayName: 'Ambiguous Account',
      biography: 'Vague bio about events in city',
      businessCategoryName: null
    }));
    setCallGeminiForAccountClassificationSeam(async () => ({
      text: JSON.stringify({ accountType: 'ORGANIZER_VENUE_EVENT', confidenceScore: 0.5 })
    }));
    setInsertAccountTypeClassificationReviewSeam(async () => {
      throw new Error('simulated review insert failure');
    });

    await assert.rejects(
      () => classifyAccountType({
        accountId: testProfile.id,
        username: 'atomic_low_conf',
        userId: 'user-id-abc'
      }),
      (err: any) => {
        assert.ok(err instanceof ClassificationPersistenceFailedError);
        return true;
      }
    );

    const [unchanged] = await db.select().from(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, testProfile.id));
    assert.equal(unchanged.accountType, null);
    assert.equal(unchanged.accountTypeStatus, null);
    assert.equal(unchanged.accountTypeConfidenceScore, null);

    const reviews = await db.select().from(accountTypeClassificationReviews).where(eq(accountTypeClassificationReviews.accountId, testProfile.id));
    assert.equal(reviews.length, 0);
  });
});
