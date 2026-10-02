import { type ProcessingJobMessage } from '@festgrid/domain/posts';
import { getActiveSubscriberUserIds } from '../subscriptions/get-active-subscriber-user-ids.js';
import { buildGeminiExtractionRequest } from './build-gemini-request.js';
import { callGemini as defaultCallGemini } from '../ai-gateway/adapter.js';
import { compileValidator } from '../../validation/validate.js';
import { extractedEventSchema } from '../../validation/extracted-event.schema.js';
import { type GeminiExtractionPayload, transformGeminiResponseToEventInfo, type ScrapedPost } from '@festgrid/domain';
import { resolveAccountAndLocations } from './resolve-account-and-locations.js';
import { resolveScheduleTimezones } from './resolve-schedule-timezones.js';
import { markPostExtracted as defaultMarkPostExtracted } from '../posts/mark-post-extracted.js';
import { sendSqsMessageWithRetry } from '../aws/send-sqs-message-with-retry.js';
import { processIngestionJob } from '../ingestor/process-ingestion-job.js';
import { loadBackendEnv } from '../../env.js';
import { rehostPostImage as defaultRehostPostImage } from './rehost-post-image.js';
import { backfillAccountProfileAndInferDefaultLocation } from '../accounts/backfill-account-profile-and-infer-location.js';
import { db } from '../../db/client.js';
import { eq } from 'drizzle-orm';
import { socialMediaAccountProfiles, posts } from '@festgrid/database';
import { assignExtractionOrdinals } from '@festgrid/domain';


export let callGeminiSeam = defaultCallGemini;
export function setCallGeminiSeam(fn: typeof defaultCallGemini) {
  callGeminiSeam = fn;
}

export let markPostExtractedSeam = defaultMarkPostExtracted;
export function setMarkPostExtractedSeam(fn: typeof defaultMarkPostExtracted) {
  markPostExtractedSeam = fn;
}

export let rehostPostImageSeam = defaultRehostPostImage;
export function setRehostPostImageSeam(fn: typeof defaultRehostPostImage) {
  rehostPostImageSeam = fn;
}

export let backfillAccountProfileAndInferDefaultLocationSeam = backfillAccountProfileAndInferDefaultLocation;
export function setBackfillAccountProfileAndInferDefaultLocationSeam(fn: typeof backfillAccountProfileAndInferDefaultLocation) {
  backfillAccountProfileAndInferDefaultLocationSeam = fn;
}

export async function processAiJob(message: ProcessingJobMessage): Promise<void> {
  const env = loadBackendEnv();

  // 1. Get active subscriber user IDs
  const subscriberUserIds = await getActiveSubscriberUserIds(message.accountId);

  const [accountRow] = await db
    .select({
      accountType: socialMediaAccountProfiles.accountType,
      isImageStorageOptedIn: socialMediaAccountProfiles.isImageStorageOptedIn,
    })
    .from(socialMediaAccountProfiles)
    .where(eq(socialMediaAccountProfiles.id, message.accountId))
    .limit(1);

  const isCuratorGuide = accountRow?.accountType === 'CURATOR_GUIDE';
  const isOptedIntoImageStorage = accountRow?.isImageStorageOptedIn === true;

  // 2. Build Gemini extraction request
  const { request, imageBytes, imageContentType } = await buildGeminiExtractionRequest(message);

  // 3. Call Gemini via AI Gateway
  const result = await callGeminiSeam({
    ...request,
    provider: 'gemini',
    subscriberUserIds
  });

  // 4. Parse & validate response with AJV
  let payload: GeminiExtractionPayload;
  try {
    payload = JSON.parse(result.text);
  } catch (err) {
    console.error(`Failed to parse Gemini response for post ${message.postId}. Raw response:`, result.text, err);
    // Return successfully without throwing/enqueueing/marking to skip/retry later (AC4/AC8)
    return;
  }

  const validate = compileValidator<GeminiExtractionPayload>(extractedEventSchema);
  const isValid = validate(payload);
  if (!isValid) {
    console.error(`Gemini response failed AJV validation for post ${message.postId}:`, validate.errors);
    // Return successfully without throwing/enqueueing/marking to skip/retry later (AC4/AC8)
    return;
  }

  // 5. If not an event, mark extracted and return
  if (payload.isEvent === false) {
    if (isCuratorGuide) {
      await db.update(posts).set({ content: null }).where(eq(posts.id, message.postId));
    }
    await markPostExtractedSeam(message.postId);
    return;
  }

  // 5.5. Defensive edge case (Task 7.1): the model reported isEvent: true but returned zero
  // events. Not expected in practice, but treated identically to isEvent === false since there
  // is nothing to extract.
  if (payload.events.length === 0) {
    console.warn(
      `[processAiJob] Gemini reported isEvent: true with zero events for post ${message.postId}; treating as a no-event post.`
    );
    if (isCuratorGuide) {
      await db.update(posts).set({ content: null }).where(eq(posts.id, message.postId));
    }
    await markPostExtractedSeam(message.postId);
    return;
  }

  // 5.6. Defensive truncation (Task 7.2/3.2/4.2): the AJV schema deliberately has no `maxItems`
  // on `events` (see extracted-event.schema.ts) -- the actual cap enforcement point is here,
  // keeping the first N entries and logging rather than discarding the whole payload.
  let events = payload.events;
  if (events.length > env.maxExtractedEventsPerPost) {
    console.warn(
      `[processAiJob] Post ${message.postId} returned ${events.length} events, ` +
        `truncating to the configured cap of ${env.maxExtractedEventsPerPost}.`
    );
    events = events.slice(0, env.maxExtractedEventsPerPost);
  }

  // 6-7. Per-event loop (Task 7.3/7.4, AC4): resolveAccountAndLocations/resolveScheduleTimezones
  // and transformGeminiResponseToEventInfo are unchanged functions -- calling them once per
  // event, each with that event's own schedules/location, is what makes AC4's "per event"
  // guards (timezone inference 3.6a, private-contact classification 3.6i, performer-leakage
  // guard 3.6j) genuinely run per event. This loop always runs for every event, regardless of
  // the final branch taken below (Task 7.5), so the guards are exercised and testable even for
  // the deferred multi-event case.
  const eventMessages: Awaited<ReturnType<typeof transformGeminiResponseToEventInfo>>[] = [];
  let defaultLocationForBackfill: Awaited<ReturnType<typeof resolveAccountAndLocations>>['defaultLocation'];

  for (let i = 0; i < events.length; i++) {
    const event = events[i];

    const {
      sourceSocialMediaAccountId,
      defaultLocation,
      resolvedScheduleLocations
    } = await resolveAccountAndLocations(message.accountId, event.schedules, event.location);

    const scheduleTimezoneResolutions = await resolveScheduleTimezones(
      event.schedules,
      resolvedScheduleLocations,
      subscriberUserIds
    );

    const eventMessage = transformGeminiResponseToEventInfo(event, {
      postId: message.postId,
      sourceSocialMediaAccountId,
      defaultLocation,
      resolvedScheduleLocations,
      scheduleTimezoneResolutions,
      sourcePostText: message.content
    });
    eventMessages.push(eventMessage);
    defaultLocationForBackfill = defaultLocation;

    // Per-event completeness logging signal (Story 3.6l, replaces the old single post-level
    // check). Logging-only -- no additional Gemini call, no automatic re-trigger.
    if (event.minScheduleCount !== undefined && event.schedules.length < event.minScheduleCount) {
      console.warn(
        `[processAiJob] Incomplete extraction for post ${message.postId}, event ${i}: ` +
          `minScheduleCount=${event.minScheduleCount}, actual schedules=${event.schedules.length}, ` +
          `expectedScheduleNames=${JSON.stringify(event.expectedScheduleNames ?? [])}`
      );
    }
  }

  // Post-level completeness logging signal (Task 7.4).
  if (payload.minEventCount !== undefined && events.length < payload.minEventCount) {
    console.warn(
      `[processAiJob] Post ${message.postId} may be incompletely grouped: ` +
        `minEventCount=${payload.minEventCount}, actual events=${events.length}`
    );
  }

  // 7.5. Persist post-level grouping facts (Task 5.1) -- the hidden prerequisite this story
  // must also do: posts.grouping_reason/extracted_event_count have existed since Story 3.6r
  // but nothing has written them until now. events.length here is the post-truncation count
  // (events actually kept and about to be ingested), not the model's raw count.
  await db
    .update(posts)
    .set({ groupingReason: payload.groupingReason ?? null, extractedEventCount: events.length })
    .where(eq(posts.id, message.postId));

  const defaultLocation = defaultLocationForBackfill;

  // 7.5a. Best-effort image rehosting to durable S3 -- post-level (one cover image per post,
  // Story 3.6e/3.6h/3.6l), runs unconditionally regardless of event count.
  const skipImageRehost = !isOptedIntoImageStorage;
  if (imageBytes && imageContentType && !skipImageRehost) {
    try {
      await rehostPostImageSeam(message.postId, imageBytes, imageContentType, env);
    } catch (rehostError) {
      console.error(
        `Post image re-hosting defensive wrapper caught an unexpected error for post ${message.postId}:`,
        rehostError
      );
    }
  }

  // 8. Assign deterministic extraction ordinals (Task 5.4/Task 2, AC7) -- by earliest schedule
  // start date, then normalized event name, then original index, never raw model-response
  // order, so a re-extraction that yields the same set of events produces the same ordinals.
  const orderedEventMessages = assignExtractionOrdinals(eventMessages);

  // 8.1. Enqueue to DataIngestionQueue (or process inline in local dev) -- one message per
  // event (AC1). Best-effort (AC7): attempts every event's send even after one fails, retrying
  // each failed send up to 2 more times with a short backoff before giving up on it, so a
  // transient SQS error does not cost a second Gemini call. Only if a send still fails after
  // its retries does this throw -- the post is NOT marked extracted below, and the whole post
  // re-extracts on AIProcessingQueue redelivery (already-enqueued ordinals from the failed
  // attempt are harmless idempotent no-ops next time, per AC1/AC6).
  if (env.dataIngestionQueueUrl) {
    const enqueueErrors: unknown[] = [];
    for (const eventMessage of orderedEventMessages) {
      try {
        await sendSqsMessageWithRetry(env.dataIngestionQueueUrl, JSON.stringify(eventMessage), {
          onAttemptFailed: (attempt, maxAttempts, err) =>
            console.warn(
              `[processAiJob] Enqueue attempt ${attempt}/${maxAttempts} failed for post ${message.postId}, ` +
                `ordinal ${eventMessage.extractionOrdinal}:`,
              err
            ),
        });
      } catch (err) {
        enqueueErrors.push(err);
      }
    }
    if (enqueueErrors.length > 0) {
      throw new Error(
        `[processAiJob] ${enqueueErrors.length}/${orderedEventMessages.length} event(s) failed to enqueue ` +
          `(after retries) for post ${message.postId}`
      );
    }
  } else if (env.dataIngestionInlineFallbackEnabled) {
    // No queue configured and inline fallback explicitly opted into (local dev only,
    // via DATA_INGESTION_INLINE_FALLBACK_ENABLED in a personal .env): process ingestion
    // inline instead of enqueuing, since there's no Lambda locally to drain the queue.
    // Fire-and-forget per event, mirroring the async decoupling of the real queue path above —
    // this is a local-dev-only convenience with no real queue to drain, not the production
    // failure surface AC7 is about, so no retry/best-effort bookkeeping is added here.
    for (const eventMessage of orderedEventMessages) {
      processIngestionJob(eventMessage).catch((err) => {
        console.error(
          `Failed to process ingestion job inline for post ${message.postId}, ordinal ${eventMessage.extractionOrdinal}:`,
          err
        );
      });
    }
  } else {
    throw new Error('DATA_INGESTION_QUEUE_URL is not configured');
  }

  // 8.5. If resolved defaultLocation is falsy, trigger location inference.
  // Runs after this post's events were already enqueued/ingested at step 8 using the
  // falsy defaultLocation resolved at step 6, so a successful inference here can only
  // benefit this account's *future* posts, never backfill the triggering event itself —
  // mirrors the same after-the-fact pattern already used in process-scrape-job.ts.
  if (!defaultLocation) {
    try {
      const post: ScrapedPost = {
        content: message.content,
        imageUrl: message.imageUrl,
        postUrl: message.postUrl,
        publishedAt: message.publishedAt,
        ownerDisplayName: message.ownerDisplayName,
        ownerUsername: message.ownerUsername,
      };
      await backfillAccountProfileAndInferDefaultLocationSeam(message.accountId, [post]);
    } catch (backfillErr) {
      console.warn(
        `[processAiJob] backfillAccountProfileAndInferDefaultLocation failed for ${message.accountId}:`,
        backfillErr
      );
    }
  }

  // 9. Mark post extracted only after every event's message was successfully enqueued (AC7) --
  // a thrown enqueue failure above skips this entirely (and skips nulling a CURATOR_GUIDE
  // caption: Story 3.4o's nulling is meant to run only once extraction has actually completed).
  if (isCuratorGuide) {
    await db.update(posts).set({ content: null }).where(eq(posts.id, message.postId));
  }
  await markPostExtractedSeam(message.postId);
}
