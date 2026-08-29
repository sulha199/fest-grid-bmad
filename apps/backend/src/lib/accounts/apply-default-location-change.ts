import { db } from '../../db/client.js';
import { socialMediaAccountProfiles, defaultLocationChangeRequests, users } from '@festgrid/database';
import { eq, and, ne, isNull, inArray } from 'drizzle-orm';
import { sendTemplatedEmail } from '../email/adapter.js';
import { loadBackendEnv } from '../../env.js';
import { LocationDetails } from '@festgrid/shared-types';

const OPEN_STATUSES = ['PENDING_REVIEW', 'AWAITING_APPROVAL'] as const;

export async function applyDefaultLocationChange(params: {
  accountId: string;
  newLocation: LocationDetails;
  previousLocation: LocationDetails | null;
  changedByUserId: string | null;
  changeSource: 'USER' | 'AI_INFERENCE' | 'MODERATOR';
  /** Only meaningful when changeSource is 'AI_INFERENCE'; gates immediate-apply vs AWAITING_APPROVAL. */
  confidenceScore?: number;
  accountDisplayName: string;
  onlyIfCurrentlyNull?: boolean;
}): Promise<{ applied: boolean; awaitingApproval?: boolean }> {
  const {
    accountId,
    newLocation,
    previousLocation,
    changedByUserId,
    changeSource,
    confidenceScore,
    accountDisplayName,
    onlyIfCurrentlyNull = false,
  } = params;

  const requiresApproval =
    changeSource === 'AI_INFERENCE' &&
    typeof confidenceScore === 'number' &&
    confidenceScore < loadBackendEnv().locationInferenceConfidenceThreshold;

  const result = await db.transaction(async (tx) => {
    if (requiresApproval) {
      // Low-confidence AI inference: never touches socialMediaAccountProfiles.defaultLocation.
      // The account keeps whatever it had (unset or a prior value) until a moderator decides.
      const insertedRequests = await tx.insert(defaultLocationChangeRequests).values({
        accountId,
        changedByUserId,
        previousLocation,
        newLocation,
        status: 'AWAITING_APPROVAL' as any,
        changeSource: changeSource as any,
        confidenceScore,
      }).returning({ id: defaultLocationChangeRequests.id });

      const insertedId = insertedRequests[0]?.id;
      if (insertedId) {
        await tx.update(defaultLocationChangeRequests)
          .set({ status: 'SUPERSEDED' as any })
          .where(
            and(
              eq(defaultLocationChangeRequests.accountId, accountId),
              inArray(defaultLocationChangeRequests.status, [...OPEN_STATUSES]),
              ne(defaultLocationChangeRequests.id, insertedId)
            )
          );
      }

      return { applied: false, awaitingApproval: true };
    }

    const condition = onlyIfCurrentlyNull
      ? and(
          eq(socialMediaAccountProfiles.id, accountId),
          isNull(socialMediaAccountProfiles.defaultLocation)
        )
      : eq(socialMediaAccountProfiles.id, accountId);

    const updatedRows = await tx.update(socialMediaAccountProfiles)
      .set({
        defaultLocation: newLocation,
      })
      .where(condition)
      .returning({ id: socialMediaAccountProfiles.id });

    if (updatedRows.length === 0) {
      return { applied: false };
    }

    const isModerator = changeSource === 'MODERATOR';
    const requestStatus = isModerator ? 'ACCEPTED' : 'PENDING_REVIEW';

    const insertedRequests = await tx.insert(defaultLocationChangeRequests).values({
      accountId,
      changedByUserId,
      previousLocation,
      newLocation,
      status: requestStatus as any,
      changeSource: changeSource as any,
      confidenceScore,
      reviewedByModeratorId: isModerator ? changedByUserId : null,
      reviewedAt: isModerator ? new Date() : null,
    }).returning({ id: defaultLocationChangeRequests.id });

    const insertedId = insertedRequests[0]?.id;

    if (insertedId) {
      await tx.update(defaultLocationChangeRequests)
        .set({ status: 'SUPERSEDED' as any })
        .where(
          and(
            eq(defaultLocationChangeRequests.accountId, accountId),
            inArray(defaultLocationChangeRequests.status, [...OPEN_STATUSES]),
            ne(defaultLocationChangeRequests.id, insertedId)
          )
        );
    }

    return { applied: true };
  });

  const previousLocationText = previousLocation
    ? previousLocation.formattedAddress || previousLocation.placeName || 'Unknown'
    : 'None (Inferred by AI)';
  const newLocationText = newLocation.formattedAddress || newLocation.placeName || 'Unknown';
  const moderatorReviewUrl = `${loadBackendEnv().webAppBaseUrl}/moderator/items`;

  if (result.awaitingApproval) {
    try {
      const moderators = await db.select().from(users).where(eq(users.role, 'moderator'));
      if (moderators.length > 0) {
        const confidenceScorePercent = `${Math.round((confidenceScore ?? 0) * 100)}%`;
        Promise.allSettled(
          moderators.map((mod) =>
            sendTemplatedEmail(
              'DEFAULT_LOCATION_CHANGE_AWAITING_APPROVAL_ALERT',
              mod.email,
              {
                accountDisplayName,
                previousLocationText,
                newLocationText,
                confidenceScorePercent,
                moderatorReviewUrl,
              }
            )
          )
        ).catch((err) => {
          console.error('Failed sending moderator emails:', err);
        });
      }
    } catch (emailErr) {
      console.error('Failed loading moderators or triggering email send in helper:', emailErr);
    }
    return result;
  }

  if (!result.applied) {
    return { applied: false };
  }

  // Send notification emails to moderators (best effort, async, non-blocking)
  try {
    const moderators = await db.select().from(users).where(eq(users.role, 'moderator'));
    if (moderators.length > 0) {
      Promise.allSettled(
        moderators.map((mod) =>
          sendTemplatedEmail(
            'DEFAULT_LOCATION_CHANGE_MODERATOR_ALERT',
            mod.email,
            {
              accountDisplayName,
              previousLocationText,
              newLocationText,
              moderatorReviewUrl,
            }
          )
        )
      ).catch((err) => {
        console.error('Failed sending moderator emails:', err);
      });
    }
  } catch (emailErr) {
    console.error('Failed loading moderators or triggering email send in helper:', emailErr);
  }

  return { applied: true };
}
