import { stripMalformedLocationKeywords } from '@festgrid/domain/events';
import type { ProcessingJobMessage, ReextractImageOutcomes } from '@festgrid/domain/posts';
import { loadBackendEnv } from '../../env.js';
import { compileValidator } from '../../validation/validate.js';
import { extractedEventSchema } from '../../validation/extracted-event.schema.js';
import { callGemini as defaultCallGemini, AiGatewayExhaustedError, AiGatewayBusyError } from '../ai-gateway/adapter.js';
import { getActiveSubscriberUserIds } from '../subscriptions/get-active-subscriber-user-ids.js';
import { buildGeminiExtractionRequest } from './build-gemini-request.js';

// Story 4.2b / AD-40 / Story 10.6 -- the Gemini half of a manual extraction, shared by its two callers: `processManualExtractionJob`
// (a correction, and a re-extract preview of a post with no stored caption or a URL not in the database) and the engine job's
// preview handler (`reextract-preview-handler.ts`). Behaviour is exactly what `processManualExtractionJob` did inline: build the
// request (always face-blurred, never a publisher opt-in), call Gemini with the moderator's own keys, fall back to the account's
// subscribers' keys for a stored post (TIER_2), parse and validate. It never touches `posts`, `events` or any job row.

const validateExtractedEvent = compileValidator<any>(extractedEventSchema);

export type ExtractionErrorCode = 'QUOTA_EXHAUSTED' | 'EXTRACTION_FAILED';

/** An expected failure with a plain message the moderator may read (never a raw vendor error). */
export class ExtractionFailure extends Error {
  constructor(
    readonly errorCode: ExtractionErrorCode,
    message: string
  ) {
    super(message);
  }
}

const BUSY_MESSAGE = 'Gemini is temporarily busy with other requests. Please try again in a moment.';
const NO_KEY_MESSAGE = 'No available Gemini API key to perform this extraction.';
const NOT_VALID_MESSAGE = 'The extracted content could not be validated.';

export interface ExtractEventsInput {
  message: ProcessingJobMessage;
  /** The stored post's account profile: enables the TIER_2 shared-key fallback. Absent for a URL not in the database. */
  existingPostAccountId?: string;
  requestedByUserId: string;
  /** A re-extract preview reads more slides and keeps trying them when the cover link has expired (BUG-099). */
  isPreview: boolean;
  getRemainingTimeInMillis?: () => number;
  /** The Gemini call (a seam in tests). Read at call time, so a test may swap it between runs. */
  callGemini: typeof defaultCallGemini;
}

export interface ExtractEventsResult {
  payload: any;
  imagesAvailable: number;
  imagesSent: number;
  /** Story 10.6a -- what became of each image (no URL). */
  imageOutcomes: ReextractImageOutcomes;
  /** The keys the extraction call actually ran on: a following keywords call uses the same ones. */
  usedSubscriberUserIds: string[];
}

export async function extractEventsWithGemini(input: ExtractEventsInput): Promise<ExtractEventsResult> {
  const env = loadBackendEnv();
  const { message, existingPostAccountId } = input;

  // Always blurred -- there is deliberately NO publisher opt-in path for manual extraction (user decision, Story 4.2b). The global
  // BLUR_FACES_BEFORE_AI switch is respected exactly as processAiJob does; fail-closed behavior is inherited from the builder.
  const requestOptions = {
    ...(env.blurFacesBeforeAi
      ? { blurFacesBeforeAi: { isOwnerOptedIn: false, getRemainingTimeInMillis: input.getRemainingTimeInMillis } }
      : {}),
    ...(input.isPreview ? { maxCarouselImages: env.maxReextractCarouselImages, slidesWhenCoverFails: true } : {}),
  };
  const { request, imagesAvailable, imagesSent, imageOutcomes } = await buildGeminiExtractionRequest(
    message,
    Object.keys(requestOptions).length > 0 ? requestOptions : undefined
  );

  let resultText: string;
  let usedSubscriberUserIds = [input.requestedByUserId];
  try {
    resultText = (await input.callGemini({ ...request, provider: 'gemini', subscriberUserIds: usedSubscriberUserIds })).text;
  } catch (err) {
    // Temporary key contention is not quota exhaustion: report it truthfully so the user knows to simply retry.
    if (err instanceof AiGatewayBusyError) {
      throw new ExtractionFailure('EXTRACTION_FAILED', BUSY_MESSAGE);
    }
    if (!(err instanceof AiGatewayExhaustedError)) throw err;
    if (!existingPostAccountId) {
      throw new ExtractionFailure('QUOTA_EXHAUSTED', NO_KEY_MESSAGE);
    }
    // TIER_2 shared round-robin fallback (existing-post branch only, as in Story 4.2a).
    const subscriberUserIds = await getActiveSubscriberUserIds(existingPostAccountId);
    usedSubscriberUserIds = subscriberUserIds;
    try {
      resultText = (await input.callGemini({ ...request, provider: 'gemini', subscriberUserIds })).text;
    } catch (fallbackErr) {
      if (fallbackErr instanceof AiGatewayBusyError) {
        throw new ExtractionFailure('EXTRACTION_FAILED', BUSY_MESSAGE);
      }
      if (fallbackErr instanceof AiGatewayExhaustedError) {
        throw new ExtractionFailure('QUOTA_EXHAUSTED', NO_KEY_MESSAGE);
      }
      throw fallbackErr;
    }
  }

  let payload: any;
  try {
    payload = JSON.parse(resultText);
  } catch {
    throw new ExtractionFailure('EXTRACTION_FAILED', NOT_VALID_MESSAGE);
  }
  // Optional, advisory fields must not fail the whole preview (the other two extraction paths do the same).
  stripMalformedLocationKeywords(payload);
  if (!validateExtractedEvent(payload)) {
    throw new ExtractionFailure('EXTRACTION_FAILED', NOT_VALID_MESSAGE);
  }
  return { payload, imagesAvailable, imagesSent, imageOutcomes, usedSubscriberUserIds };
}
