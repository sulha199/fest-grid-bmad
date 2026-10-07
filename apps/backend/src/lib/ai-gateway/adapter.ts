import { selectApiKey, determineSelectionTier, computeBackoffDelayMs } from '@festgrid/domain';
import { loadBackendEnv } from '../../env.js';
import { decryptApiKey } from './kms.js';
import {
  callGeminiGenerateContent,
  GeminiRateLimitedError,
  GeminiInvalidKeyError,
  GeminiCallRequest,
  GeminiCallResult,
  isGeminiErrorTransient,
} from './gemini-client.js';
import {
  fetchCandidateKeys,
  recordSuccessfulUsage,
  recordInvalidAttempt,
} from './usage-store.js';
import { db } from '../../db/client.js';
import { apiKeys } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { callVendor, VendorKeyBusyError } from '../vendor-gateway/guarded-call.js';

export class AiGatewayExhaustedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiGatewayExhaustedError';
  }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function callGemini(
  request: GeminiCallRequest & { provider: 'gemini'; subscriberUserIds: string[] }
): Promise<GeminiCallResult> {
  const env = loadBackendEnv();
  const threshold = env.apiKeyInvalidAttemptsThreshold;

  const candidates = await fetchCandidateKeys('gemini', request.subscriberUserIds);
  const tier = determineSelectionTier(request.subscriberUserIds);

  const excludedKeys = new Set<string>();
  let attempt = 0;
  let retryAfterSeconds: number | undefined = undefined;

  while (true) {
    const candidate = selectApiKey(candidates, tier, excludedKeys);
    if (!candidate) {
      throw new AiGatewayExhaustedError('All candidate API keys are exhausted, rate-limited, or invalid.');
    }

    // Fetch encrypted key from DB
    const [dbKey] = await db.select().from(apiKeys).where(eq(apiKeys.id, candidate.id));
    if (!dbKey) {
      // Key disappeared mid-flight, exclude and retry
      excludedKeys.add(candidate.id);
      continue;
    }

    try {
      const plaintextKey = await decryptApiKey(dbKey.keyEncrypted);

      // If we are retrying/backing off, wait
      if (attempt > 0) {
        const delay = computeBackoffDelayMs(attempt, retryAfterSeconds);
        // Do not actually sleep in tests unless instructed, but standard is to sleep
        await sleep(delay);
      }

      const result = await callVendor('gemini', {
        lockKey: `gemini:key:${candidate.id}`,
        timeoutMs: env.geminiExtractionTimeoutMs,
        isTransient: isGeminiErrorTransient,
        call: (signal) => callGeminiGenerateContent(plaintextKey, request, signal),
      });

      // On success, record usage
      await recordSuccessfulUsage(candidate.id);
      return result;
    } catch (error: any) {
      if (error instanceof GeminiRateLimitedError) {
        attempt++;
        retryAfterSeconds = error.retryAfterSeconds;
        // Skip/exclude this key for this orchestration cycle
        excludedKeys.add(candidate.id);
        continue;
      }

      if (error instanceof GeminiInvalidKeyError) {
        // Record invalid attempt (marks is_valid = false if threshold met)
        await recordInvalidAttempt(candidate.id, threshold);
        excludedKeys.add(candidate.id);
        continue;
      }

      // Story 0.i2c (AD-32 Rule 4) — VendorKeyBusyError means another concurrent call already
      // holds this key's lease. Treated exactly like this-key-only exhaustion: exclude and try
      // the next candidate immediately. A busy lock says nothing about key validity, so it is
      // never recorded via recordInvalidAttempt.
      if (error instanceof VendorKeyBusyError) {
        excludedKeys.add(candidate.id);
        continue;
      }

      // Story 0.i2c (AD-32 Binds) — VendorCallTimeoutError (the wrapper's own bound elapsing),
      // and any other error callVendor itself throws before/around the call() thunk (e.g. a
      // non-transient GeminiUnknownError that exhausted callVendor's own retry budget), must
      // take the exact same unretried, unexcluded path as any other unknown error: it says
      // nothing about whether the *key* was bad, only that *this specific call* failed. No
      // dedicated instanceof branch is needed -- the generic re-throw below already does this,
      // exactly as GeminiUnknownError's catch-all always has.

      // Re-throw unknown errors
      throw error;
    }
  }
}
