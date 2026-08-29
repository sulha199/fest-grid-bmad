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
import { sendSqsMessage } from '../aws/send-sqs-message.js';
import { processIngestionJob } from '../ingestor/process-ingestion-job.js';
import { loadBackendEnv } from '../../env.js';
import { rehostPostImage as defaultRehostPostImage } from './rehost-post-image.js';
import { backfillAccountProfileAndInferDefaultLocation } from '../accounts/backfill-account-profile-and-infer-location.js';

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
    await markPostExtractedSeam(message.postId);
    return;
  }

  // 6. Resolve account and locations
  const {
    sourceSocialMediaAccountId,
    defaultLocation,
    resolvedScheduleLocations
  } = await resolveAccountAndLocations(message.accountId, payload.schedules, payload.location);

  const scheduleTimezoneResolutions = await resolveScheduleTimezones(
    payload.schedules,
    resolvedScheduleLocations,
    subscriberUserIds
  );

  // 7. Transform Gemini response to ExtractedEventMessage
  const eventMessage = transformGeminiResponseToEventInfo(payload, {
    postId: message.postId,
    sourceSocialMediaAccountId,
    defaultLocation,
    resolvedScheduleLocations,
    scheduleTimezoneResolutions
  });

  // 7.5. Best-effort image rehosting to durable S3
  if (imageBytes && imageContentType) {
    try {
      await rehostPostImageSeam(message.postId, imageBytes, imageContentType, env);
    } catch (rehostError) {
      console.error(
        `Post image re-hosting defensive wrapper caught an unexpected error for post ${message.postId}:`,
        rehostError
      );
    }
  }

  // 8. Enqueue to DataIngestionQueue (or process inline in local dev)
  if (env.dataIngestionQueueUrl) {
    await sendSqsMessage(env.dataIngestionQueueUrl, JSON.stringify(eventMessage));
  } else if (env.dataIngestionInlineFallbackEnabled) {
    // No queue configured and inline fallback explicitly opted into (local dev only,
    // via DATA_INGESTION_INLINE_FALLBACK_ENABLED in a personal .env): process ingestion
    // inline instead of enqueuing, since there's no Lambda locally to drain the queue.
    // Fire-and-forget, mirroring the async decoupling of the real queue path below —
    // the post is marked extracted on successful hand-off, not on ingestion outcome.
    processIngestionJob(eventMessage).catch((err) => {
      console.error(`Failed to process ingestion job inline for post ${message.postId}:`, err);
    });
  } else {
    throw new Error('DATA_INGESTION_QUEUE_URL is not configured');
  }

  // 8.5. If resolved defaultLocation is falsy, trigger location inference
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

  // 9. Mark post extracted on successful enqueue
  await markPostExtractedSeam(message.postId);
}
