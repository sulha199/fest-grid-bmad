import { type ProcessingJobMessage } from '@festgrid/domain/posts';
import { getActiveSubscriberUserIds } from '../subscriptions/get-active-subscriber-user-ids.js';
import { buildGeminiExtractionRequest } from './build-gemini-request.js';
import { callGemini as defaultCallGemini } from '../ai-gateway/adapter.js';
import { compileValidator } from '../../validation/validate.js';
import { extractedEventSchema } from '../../validation/extracted-event.schema.js';
import { type GeminiExtractionPayload, transformGeminiResponseToEventInfo } from '@festgrid/domain';
import { resolveAccountAndLocations } from './resolve-account-and-locations.js';
import { resolveScheduleTimezones } from './resolve-schedule-timezones.js';
import { markPostExtracted as defaultMarkPostExtracted } from '../posts/mark-post-extracted.js';
import { sendSqsMessage } from '../aws/send-sqs-message.js';
import { loadBackendEnv } from '../../env.js';

export let callGeminiSeam = defaultCallGemini;
export function setCallGeminiSeam(fn: typeof defaultCallGemini) {
  callGeminiSeam = fn;
}

export let markPostExtractedSeam = defaultMarkPostExtracted;
export function setMarkPostExtractedSeam(fn: typeof defaultMarkPostExtracted) {
  markPostExtractedSeam = fn;
}

export async function processAiJob(message: ProcessingJobMessage): Promise<void> {
  const env = loadBackendEnv();

  // 1. Get active subscriber user IDs
  const subscriberUserIds = await getActiveSubscriberUserIds(message.accountId);

  // 2. Build Gemini extraction request
  const request = await buildGeminiExtractionRequest(message);

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

  // 8. Enqueue to DataIngestionQueue
  const dataIngestionQueueUrl = (env as any).dataIngestionQueueUrl;
  if (!dataIngestionQueueUrl) {
    throw new Error('DATA_INGESTION_QUEUE_URL is not configured');
  }

  await sendSqsMessage(dataIngestionQueueUrl, JSON.stringify(eventMessage));

  // 9. Mark post extracted on successful enqueue
  await markPostExtractedSeam(message.postId);
}
