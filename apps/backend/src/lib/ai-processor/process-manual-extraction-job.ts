import { and, eq } from 'drizzle-orm';
import { manualExtractionJobs } from '@festgrid/database';
import { mapExtractionPayloadToProposedCorrection } from '@festgrid/domain/events';
import { db } from '../../db/client.js';
import { loadBackendEnv } from '../../env.js';
import { compileValidator } from '../../validation/validate.js';
import { extractedEventSchema } from '../../validation/extracted-event.schema.js';
import { callGemini as defaultCallGemini, AiGatewayExhaustedError } from '../ai-gateway/adapter.js';
import { getActiveSubscriberUserIds } from '../subscriptions/get-active-subscriber-user-ids.js';
import { buildGeminiExtractionRequest } from './build-gemini-request.js';

// Story 4.2b -- runs inside the AI Lambda (the only Lambda with the image-processing runtime for
// Story 3.20's pre-AI face blur). Takes over the Gemini call + parse/validate/map half of Story
// 4.2a's `extractEventDataFromUrl`, which previously ran inline in the API Lambda. The
// synchronous pre-checks (dedup lookup, platform detection, key pre-check, scrape) stay in the
// resolver; this file never touches `posts`/`events` and writes no extraction_audit_logs row.

const validateExtractedEvent = compileValidator<any>(extractedEventSchema);

export let callGeminiForManualExtractionSeam = defaultCallGemini;
export function setCallGeminiForManualExtractionSeam(fn: typeof defaultCallGemini) {
  callGeminiForManualExtractionSeam = fn;
}

export interface ProcessManualExtractionJobDeps {
  // The Lambda Context's getRemainingTimeInMillis, same plumbing as ProcessAiJobDeps.
  getRemainingTimeInMillis?: () => number;
}

type ExtractionErrorCode = 'QUOTA_EXHAUSTED' | 'EXTRACTION_FAILED';

class ManualExtractionFailure extends Error {
  constructor(
    readonly errorCode: ExtractionErrorCode,
    message: string
  ) {
    super(message);
  }
}

async function markFailed(jobId: string, errorCode: ExtractionErrorCode, errorMessage: string): Promise<void> {
  await db
    .update(manualExtractionJobs)
    .set({ status: 'FAILED', errorCode, errorMessage, completedAt: new Date(), updatedAt: new Date() })
    .where(eq(manualExtractionJobs.id, jobId));
}

export async function processManualExtractionJob(jobId: string, deps?: ProcessManualExtractionJobDeps): Promise<void> {
  // Atomic claim: only the invocation that flips PENDING -> PROCESSING proceeds, so a duplicate
  // delivery of the async invoke can never run Gemini (and spend a key) twice.
  const [job] = await db
    .update(manualExtractionJobs)
    .set({ status: 'PROCESSING', updatedAt: new Date() })
    .where(and(eq(manualExtractionJobs.id, jobId), eq(manualExtractionJobs.status, 'PENDING')))
    .returning();

  if (!job) {
    console.warn(`[processManualExtractionJob] Job ${jobId} not found or not PENDING; skipping.`);
    return;
  }

  try {
    const env = loadBackendEnv();
    const { message, existingPostAccountId } = job.requestPayload;

    // Always blurred -- there is deliberately NO publisher opt-in path for manual extraction
    // (user decision, Story 4.2b). The global BLUR_FACES_BEFORE_AI switch is respected exactly as
    // processAiJob does; fail-closed behavior is inherited from the builder (Story 3.20).
    const { request } = await buildGeminiExtractionRequest(
      message,
      env.blurFacesBeforeAi
        ? {
            blurFacesBeforeAi: {
              isOwnerOptedIn: false,
              getRemainingTimeInMillis: deps?.getRemainingTimeInMillis,
            },
          }
        : undefined
    );

    let resultText: string;
    try {
      resultText = (
        await callGeminiForManualExtractionSeam({
          ...request,
          provider: 'gemini',
          subscriberUserIds: [job.requestedByUserId],
        })
      ).text;
    } catch (err) {
      if (!(err instanceof AiGatewayExhaustedError)) throw err;
      if (!existingPostAccountId) {
        throw new ManualExtractionFailure('QUOTA_EXHAUSTED', 'No available Gemini API key to perform this extraction.');
      }
      // TIER_2 shared round-robin fallback (existing-post branch only, as in Story 4.2a).
      const subscriberUserIds = await getActiveSubscriberUserIds(existingPostAccountId);
      try {
        resultText = (
          await callGeminiForManualExtractionSeam({ ...request, provider: 'gemini', subscriberUserIds })
        ).text;
      } catch (fallbackErr) {
        if (fallbackErr instanceof AiGatewayExhaustedError) {
          throw new ManualExtractionFailure('QUOTA_EXHAUSTED', 'No available Gemini API key to perform this extraction.');
        }
        throw fallbackErr;
      }
    }

    let payload: any;
    try {
      payload = JSON.parse(resultText);
    } catch {
      throw new ManualExtractionFailure('EXTRACTION_FAILED', 'The extracted content could not be validated.');
    }
    if (!validateExtractedEvent(payload)) {
      throw new ManualExtractionFailure('EXTRACTION_FAILED', 'The extracted content could not be validated.');
    }
    if (payload.isEvent === false || !Array.isArray(payload.events) || payload.events.length === 0) {
      throw new ManualExtractionFailure('EXTRACTION_FAILED', 'The linked post does not appear to describe an event.');
    }
    if (payload.events.length > 1) {
      console.warn(
        `[processManualExtractionJob] Gemini extraction returned ${payload.events.length} events ` +
          `for a single-event correction preview (job ${jobId}); using the first event only.`
      );
    }

    await db
      .update(manualExtractionJobs)
      .set({
        status: 'SUCCEEDED',
        resultData: mapExtractionPayloadToProposedCorrection(payload.events[0]),
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(manualExtractionJobs.id, jobId));
  } catch (err) {
    if (err instanceof ManualExtractionFailure) {
      await markFailed(jobId, err.errorCode, err.message);
      return;
    }
    console.error(`[processManualExtractionJob] Job ${jobId} failed unexpectedly:`, err);
    await markFailed(jobId, 'EXTRACTION_FAILED', 'The extraction could not be completed.');
  }
}
