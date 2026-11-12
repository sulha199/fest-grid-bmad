import type { ProcessingJobMessage, ReextractionPreviewResult } from '@festgrid/domain/posts';
import { db } from '../../db/client.js';
import { loadBackendEnv } from '../../env.js';
import type { callGemini as defaultCallGemini } from '../ai-gateway/adapter.js';
import { buildReextractionPreview } from './build-reextraction-preview.js';
import { extractEventsWithGemini } from './extract-events-with-gemini.js';
import { generateLocationKeywords } from './generate-location-keywords.js';

// AD-40 / Story 10.6 -- the moderator re-extract PREVIEW, from a message to a `ReextractionPreviewResult`: the Gemini extraction, the
// location keywords Apply will need (generated HERE so Apply, in the API Lambda's 28 s, never calls a model), and the dry-run of the
// ingestion dedup decision (`buildReextractionPreview`). Shared by `processManualExtractionJob` (the manual job) and the engine job's
// preview handler. Throws `ExtractionFailure` for an expected failure; writes nothing to `posts` or `events`.

export interface GenerateReextractionPreviewInput {
  message: ProcessingJobMessage;
  existingPostAccountId?: string;
  requestedByUserId: string;
  postStored: boolean;
  rescraped: boolean;
  getRemainingTimeInMillis?: () => number;
  callGemini: typeof defaultCallGemini;
}

export async function generateReextractionPreview(input: GenerateReextractionPreviewInput): Promise<ReextractionPreviewResult> {
  const env = loadBackendEnv();
  const { message } = input;
  const { payload, imagesAvailable, imagesSent, usedSubscriberUserIds } = await extractEventsWithGemini({
    message,
    existingPostAccountId: input.existingPostAccountId,
    requestedByUserId: input.requestedByUserId,
    isPreview: true,
    getRemainingTimeInMillis: input.getRemainingTimeInMillis,
    callGemini: input.callGemini,
  });

  // "Not an event" is a valid, informative preview (zero events), not a failure.
  const previewEvents = payload.isEvent === false || !Array.isArray(payload.events) ? [] : payload.events;
  // Search keywords for the geocoder and the map link: the preview's raw events carry them to Apply. Best-effort, never throws. Always
  // regenerated, never taken from the post's stored rows: a moderator who re-extracts because the keywords were wrong must get fresh ones.
  await generateLocationKeywords(previewEvents, {
    callGemini: input.callGemini,
    subscriberUserIds: usedSubscriberUserIds,
    sourceText: message.content,
    postId: message.postId,
  });
  return buildReextractionPreview({
    executor: db,
    payload: { events: previewEvents, groupingReason: payload.groupingReason, postTitle: payload.postTitle },
    message,
    postStored: input.postStored,
    rescraped: input.rescraped,
    maxEvents: env.maxExtractedEventsPerPost,
    imagesAvailable,
    imagesSent,
  });
}
