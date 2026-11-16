import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { posts, socialMediaAccountProfiles } from '@festgrid/database';
import type { GeminiEventPayload, GeminiExtractionPayload } from '@festgrid/domain';
import { stripMalformedLocationKeywords } from '@festgrid/domain/events';
import type { ExtractionAuditEventCompleteness } from '@festgrid/domain/events';
import {
  PER_CALL_EVENT_CAP,
  canMakeRequest,
  decideNextStep,
  isAtRisk,
  newEventsByKey,
  parseExtractionCursor,
  reserveOrdinalRange,
  splitWindow,
  type AiImageInput,
  type ExtractionCursor,
  type NextStepDecision,
  type ProcessingJobMessage,
} from '@festgrid/domain/posts';
import { db } from '../../db/client.js';
import { loadBackendEnv } from '../../env.js';
import { compileValidator } from '../../validation/validate.js';
import { extractedEventSchema } from '../../validation/extracted-event.schema.js';
import { callGemini } from '../ai-gateway/adapter.js';
import { classifyGeminiOutput } from '../ai-gateway/gemini-output-signals.js';
import { sendSqsMessageWithRetry } from '../aws/send-sqs-message-with-retry.js';
import { isStoredPostAccountScrapable } from '../scraper/post-scrape-gate.js';
import { getActiveSubscriberUserIdsForPost } from '../subscriptions/get-active-subscriber-user-ids-for-post.js';
import {
  advanceExtractionCursor,
  finishExtractionChain,
  takeExtractionLease,
} from '../posts/extraction-cursor-store.js';
import { resolvePostPublisherOptIn } from '../posts/resolve-post-publisher-opt-in.js';
import { buildGeminiExtractionRequest } from './build-gemini-request.js';
import { buildExtractedEventMessage } from './build-extracted-event-message.js';
import { createGeocodeSession } from '../geolocation/geocode-session.js';
import { generateLocationKeywords } from './generate-location-keywords.js';
import { buildStepMessage, enqueueStepMessage } from './extraction-chain.js';
import { writeExtractionAuditLog } from './write-extraction-audit-log.js';

// AD-46..AD-51 -- one step of a stepped extraction. A step is one queue message carrying the cursor. It takes the lease,
// reads its window of slides, asks Gemini (splitting the window when the answer may have been cut off), reserves an
// ordinal range, enqueues the new events for ingestion, commits the cursor, and then either enqueues the next step or
// ends the chain. Every write of the cursor is a compare-and-set, so a duplicate or stale copy changes nothing.
//
// A step that fails after taking the lease is logged and dropped: its message copy is stale by then (the nonce moved),
// and the resume pass (a later slice) re-enqueues the chain from the persisted cursor.

export interface ProcessExtractionStepDeps {
  /** The Gemini call: the production gateway, or a test seam. */
  callGemini: typeof callGemini;
  getRemainingTimeInMillis?: () => number;
}

/** The chain cannot go on (the bound, or the lease was lost); the step ends without committing anything further. */
class ChainStop extends Error {
  constructor(public readonly reason: 'request_bound' | 'lease_lost' | 'unusable_response') {
    super(`extraction chain stop: ${reason}`);
    this.name = 'ChainStop';
  }
}

interface WindowRun {
  events: GeminiEventPayload[];
  /** The label the model gave this window, kept only to adopt when the first request had none (a post found empty at first). */
  groupingReason: GeminiExtractionPayload['groupingReason'] | null;
  leafTruncated: boolean;
  aiImageInput: AiImageInput;
  faceCount: number | undefined;
  promptTokens: number;
  outputTokens: number;
  finishReason: string | undefined;
  requests: number;
}

const validatePayload = compileValidator<GeminiExtractionPayload>(extractedEventSchema);

export async function processExtractionStep(message: ProcessingJobMessage, deps: ProcessExtractionStepDeps): Promise<void> {
  const env = loadBackendEnv();
  const claimed = parseExtractionCursor(message.cursor);
  if (claimed === null) {
    console.warn(`[extraction-step] post=${message.postId} message carries no valid cursor; dropped`);
    return;
  }
  const postId = message.postId;

  // The lease (AD-47 Rule 4): swap in a new nonce while the message's (step count, nonce) is still the stored one.
  const taken = await takeExtractionLease(postId, { stepCount: claimed.stepCount, leaseNonce: claimed.leaseNonce }, randomUUID());
  if (taken === null) {
    console.warn(`[extraction-step] post=${postId} step=${claimed.stepCount} is stale or the chain ended; dropped`);
    // A post that finished elsewhere must not keep a cursor (it would confuse the status and the resume pass): the lease
    // cannot be taken on an extracted post, so the cleanup happens here. Only touches extracted posts; idempotent.
    await db.update(posts).set({ extractionCursor: null }).where(and(eq(posts.id, postId), eq(posts.isExtracted, true)));
    return;
  }
  let cursor: ExtractionCursor = taken;
  const lease = () => ({ stepCount: cursor.stepCount, leaseNonce: cursor.leaseNonce });

  const [post] = await db
    .select({ id: posts.id, accountId: posts.accountId, content: posts.content, isExtracted: posts.isExtracted })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);
  const [account] = post
    ? await db
        .select({ accountType: socialMediaAccountProfiles.accountType })
        .from(socialMediaAccountProfiles)
        .where(eq(socialMediaAccountProfiles.id, post.accountId))
        .limit(1)
    : [];
  const isCuratorGuide = account?.accountType === 'CURATOR_GUIDE';

  /** The atomic stop of AD-47 Rule 5b: cursor null, extracted, the partial flag, a clean retry ledger; the caption is nulled. */
  const endChain = async (partial: boolean, why: string): Promise<void> => {
    const ended = await finishExtractionChain(postId, lease(), { partial });
    // The caption is nulled only after this copy really ended the chain: a stale copy must not blank a live chain's caption.
    if (ended && isCuratorGuide) {
      await db.update(posts).set({ content: null }).where(eq(posts.id, postId));
    }
    console.info(`[extraction-step] post=${postId} step=${cursor.stepCount} chain-ended partial=${partial} why=${why} ended=${ended}`);
  };

  if (!post || post.isExtracted) {
    console.warn(`[extraction-step] post=${postId} is gone or already extracted; chain dropped`);
    return;
  }
  if (!env.cursorExtractionEnabled) {
    await endChain(true, 'kill_switch_off');
    return;
  }
  // AD-34: a step never works for an account that may no longer be scraped.
  if (!(await isStoredPostAccountScrapable(post.accountId))) {
    await endChain(true, 'account_not_scrapable');
    return;
  }

  try {
    const subscriberUserIds = await getActiveSubscriberUserIdsForPost(postId, post.accountId);
    const isPublisherOptedIn = env.blurFacesBeforeAi ? await resolvePostPublisherOptIn(postId) : false;
    const caption = post.content ?? '';

    const windowUrls = cursor.unreadImageUrls.slice(0, Math.max(1, cursor.windowSize));

    // One window, with the split-and-retry safety net of AD-49 (an at-risk answer is split in half and retried, down to a
    // single slide). Every request counts toward the bound, persisted before the call (AD-51 Rule 1).
    const runWindow = async (urls: string[]): Promise<WindowRun> => {
      if (!canMakeRequest(cursor.requestsMade, cursor.unreadAtStart)) {
        throw new ChainStop('request_bound');
      }
      const counted: ExtractionCursor = { ...cursor, requestsMade: cursor.requestsMade + 1 };
      if (!(await advanceExtractionCursor(postId, lease(), counted))) {
        throw new ChainStop('lease_lost');
      }
      cursor = counted;

      const built = await buildGeminiExtractionRequest(
        {
          postId,
          accountId: post.accountId,
          content: caption,
          imageUrl: urls[0],
          additionalImageUrls: urls.slice(1),
          postUrl: message.postUrl,
          publishedAt: message.publishedAt,
          ownerDisplayName: message.ownerDisplayName,
          ownerUsername: message.ownerUsername,
        },
        {
          maxCarouselImages: Math.max(0, urls.length - 1),
          ...(env.blurFacesBeforeAi
            ? { blurFacesBeforeAi: { isOwnerOptedIn: isPublisherOptedIn, getRemainingTimeInMillis: deps.getRemainingTimeInMillis } }
            : {}),
        }
      );
      const result = await deps.callGemini({ ...built.request, provider: 'gemini', subscriberUserIds });
      const maxOutputTokens = built.request.maxOutputTokens ?? env.geminiMaxOutputTokens;
      const outputSignals = classifyGeminiOutput({
        finishReason: result.finishReason,
        outputTokens: result.usage?.outputTokens,
        thinkingTokens: result.usage?.thinkingTokens,
        maxOutputTokens,
      });
      const base = {
        aiImageInput: built.aiImageInput,
        faceCount: built.totalFaceDetectionCount,
        promptTokens: result.usage?.promptTokens ?? 0,
        outputTokens: result.usage?.outputTokens ?? 0,
        finishReason: result.finishReason,
        requests: 1,
      };

      let payload: GeminiExtractionPayload | undefined;
      try {
        const parsed = JSON.parse(typeof result.text === 'string' ? result.text : '');
        stripMalformedLocationKeywords(parsed);
        if (validatePayload(parsed)) {
          payload = parsed;
        }
      } catch {
        payload = undefined;
      }

      const halves = splitWindow({ start: 0, size: urls.length });
      const atRisk =
        payload === undefined ||
        isAtRisk({
          outputSignals,
          eventCount: payload.events.length,
          minEventCount: payload.minEventCount ?? null,
          skippedItemCount: payload.skippedItems?.length ?? 0,
        });
      if (atRisk && halves !== null) {
        // A half that cannot run (the bound, an unusable answer) must not discard the half that finished: it counts as a
        // truncated leaf, so the chain ends partial but keeps what was found.
        const runHalf = async (half: { start: number; size: number }): Promise<WindowRun> => {
          try {
            return await runWindow(urls.slice(half.start, half.start + half.size));
          } catch (halfError) {
            if (halfError instanceof ChainStop && halfError.reason !== 'lease_lost') {
              return { events: [], groupingReason: null, leafTruncated: true, aiImageInput: base.aiImageInput, faceCount: undefined, promptTokens: 0, outputTokens: 0, finishReason: undefined, requests: 0 };
            }
            throw halfError;
          }
        };
        const first = await runHalf(halves[0]);
        const second = await runHalf(halves[1]);
        return {
          events: [...first.events, ...second.events],
          groupingReason: first.groupingReason ?? second.groupingReason,
          leafTruncated: first.leafTruncated || second.leafTruncated,
          aiImageInput: second.aiImageInput,
          faceCount: (first.faceCount ?? 0) + (second.faceCount ?? 0) || undefined,
          promptTokens: base.promptTokens + first.promptTokens + second.promptTokens,
          outputTokens: base.outputTokens + first.outputTokens + second.outputTokens,
          finishReason: second.finishReason,
          requests: base.requests + first.requests + second.requests,
        };
      }
      if (payload === undefined) {
        // An unusable answer for a single slide: nothing more to split, so the chain cannot go on here.
        throw new ChainStop('unusable_response');
      }
      // A slide the builder could not read (a failed download, a blur that failed closed) was skipped, and it counts as
      // read: the chain is then partial, the same as a truncated leaf.
      const slideMissing = built.imagesSent < urls.length;
      return {
        ...base,
        events: payload.events.slice(0, PER_CALL_EVENT_CAP),
        groupingReason: payload.events.length > 0 ? (payload.groupingReason ?? null) : null,
        leafTruncated: atRisk || slideMissing,
      };
    };

    const run = await runWindow(windowUrls);

    // Dedupe against the events earlier steps found, then reserve this step's ordinal range BEFORE anything is enqueued
    // (AD-48 Rule 2): a replay of this step starts after the reserved range and can never reuse a slot.
    const { fresh, keys } = newEventsByKey(cursor.foundKeys, run.events);
    // Search keywords for this step's new events only (best-effort, never throws).
    await generateLocationKeywords(fresh, { callGemini: deps.callGemini, subscriberUserIds, sourceText: caption, postId });
    const eventsCompleteness: ExtractionAuditEventCompleteness[] = [];
    const builtMessages = [];
    // No budget here (the AI Lambda has time); the session still de-duplicates a place used by several of this step's events.
    const geocodeSession = createGeocodeSession();
    for (let i = 0; i < fresh.length; i++) {
      const { eventMessage } = await buildExtractedEventMessage(fresh[i], {
        postId,
        accountId: post.accountId,
        subscriberUserIds,
        sourcePostText: caption,
        geocodeSession,
      });
      builtMessages.push(eventMessage);
      eventsCompleteness.push({
        eventIndex: i,
        minScheduleCount: fresh[i].minScheduleCount ?? null,
        expectedScheduleNames: fresh[i].expectedScheduleNames ?? null,
        confidenceScore: fresh[i].confidenceScore,
        actualScheduleCount: fresh[i].schedules.length,
      });
    }
    const reserved = reserveOrdinalRange(cursor.nextOrdinal, builtMessages);
    if (reserved.events.length > 0) {
      const withRange: ExtractionCursor = { ...cursor, nextOrdinal: reserved.nextOrdinal };
      if (!(await advanceExtractionCursor(postId, lease(), withRange))) {
        throw new ChainStop('lease_lost');
      }
      cursor = withRange;

      if (!env.dataIngestionQueueUrl) {
        throw new Error('DATA_INGESTION_QUEUE_URL is not configured');
      }
      const errors: unknown[] = [];
      for (const eventMessage of reserved.events) {
        try {
          await sendSqsMessageWithRetry(env.dataIngestionQueueUrl, JSON.stringify(eventMessage));
        } catch (error) {
          errors.push(error);
        }
      }
      if (errors.length > 0) {
        throw new Error(`${errors.length}/${reserved.events.length} event(s) failed to enqueue for post ${postId}`);
      }
      await db
        .update(posts)
        .set({ extractedEventCount: sql`coalesce(${posts.extractedEventCount}, 0) + ${reserved.events.length}` })
        .where(and(eq(posts.id, postId), eq(posts.isExtracted, false)));
    }

    try {
      await writeExtractionAuditLog({
        postId,
        geminiModel: env.geminiModel,
        isEvent: true,
        hasFaceImage: null,
        faceImageCount: null,
        minEventCount: null,
        actualEventCount: fresh.length,
        groupingReason: cursor.groupingReason,
        eventsCompleteness,
        aiImageInput: run.aiImageInput,
        actualFaceDetectionCount: run.aiImageInput === 'blurred' ? (run.faceCount ?? 0) : null,
      });
    } catch (auditError) {
      console.error(`[extraction-step] post=${postId} could not write the audit row:`, auditError);
    }

    // The commit (AD-47 Rule 4a, step 5): progress, found keys and the decision's window in one compare-and-set.
    const slidesRead = windowUrls.length;
    const eventsFoundBefore = cursor.foundKeys.length;
    const itemsPerSlide = run.events.length > 0 ? run.events.length / slidesRead : cursor.itemsPerSlide;
    const advanced: ExtractionCursor = {
      ...cursor,
      // A first request that found nothing had no label worth keeping: the first label of a window that finds events decides.
      groupingReason: cursor.groupingReason ?? run.groupingReason ?? null,
      stepCount: cursor.stepCount + 1,
      nextSlide: cursor.nextSlide + slidesRead,
      unreadImageUrls: cursor.unreadImageUrls.slice(slidesRead),
      foundKeys: keys,
      emptySteps: keys.length === 0 ? cursor.emptySteps + 1 : cursor.emptySteps,
      itemsPerSlide,
    };
    const decision: NextStepDecision = decideNextStep({
      killSwitchOn: env.cursorExtractionEnabled,
      groupingReason: advanced.groupingReason,
      unreadSlides: advanced.unreadImageUrls.length,
      imagesRead: advanced.nextSlide,
      eventsFound: keys.length,
      lastStepNewEvents: keys.length - eventsFoundBefore,
      emptySteps: advanced.emptySteps,
      followUpMade: advanced.followUpMade,
      requestsMade: advanced.requestsMade,
      unreadAtStart: advanced.unreadAtStart,
      itemsPerSlide: advanced.itemsPerSlide,
      leafTruncated: run.leafTruncated,
    });
    const nextCursor: ExtractionCursor =
      decision.action === 'stop'
        ? advanced
        : { ...advanced, windowSize: decision.windowSize, followUpMade: decision.action === 'follow_up' ? true : advanced.followUpMade };

    if (!(await advanceExtractionCursor(postId, lease(), nextCursor))) {
      throw new ChainStop('lease_lost');
    }
    const previousStep = cursor.stepCount;
    cursor = nextCursor;

    console.info(
      `[extraction-step] post=${postId} step=${previousStep} slidesRead=${slidesRead} eventsAdded=${fresh.length} ` +
        `requests=${run.requests} inputTokens=${run.promptTokens} outputTokens=${run.outputTokens} ` +
        `finishReason=${run.finishReason ?? 'unknown'} leafTruncated=${run.leafTruncated} ` +
        `decision=${decision.action}:${decision.reason}`
    );

    if (decision.action === 'stop') {
      await endChain(decision.partial, decision.reason);
      return;
    }
    await enqueueStepMessage(
      buildStepMessage(
        {
          postId,
          accountId: post.accountId,
          postUrl: message.postUrl,
          publishedAt: message.publishedAt,
          ownerDisplayName: message.ownerDisplayName,
          ownerUsername: message.ownerUsername,
        },
        nextCursor
      )
    );
  } catch (error) {
    if (error instanceof ChainStop && error.reason === 'request_bound') {
      await endChain(true, 'request_bound');
      return;
    }
    if (error instanceof ChainStop && error.reason === 'lease_lost') {
      console.warn(`[extraction-step] post=${postId} lost the lease; this copy stops`);
      return;
    }
    if (error instanceof ChainStop && error.reason === 'unusable_response') {
      await endChain(true, 'unusable_response');
      return;
    }
    // Anything else (a Gemini or ingestion-queue failure): the chain is left as it is, with its cursor, for the resume pass.
    console.error(`[extraction-step] post=${postId} step failed; the cursor is kept for the resume pass:`, error);
  }
}
