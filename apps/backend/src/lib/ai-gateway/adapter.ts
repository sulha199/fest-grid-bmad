import { selectApiKey, determineSelectionTier, computeBackoffDelayMs } from '@festgrid/domain';
import { loadBackendEnv } from '../../env.js';
import { decryptApiKey } from './kms.js';
import {
  callGeminiGenerateContent,
  GeminiRateLimitedError,
  GeminiInvalidKeyError,
  GeminiTimeoutError,
  GeminiCallRequest,
  GeminiCallResult,
} from './gemini-client.js';
import {
  fetchCandidateKeys,
  recordSuccessfulUsage,
  recordInvalidAttempt,
} from './usage-store.js';
import { db } from '../../db/client.js';
import { apiKeys } from '@festgrid/database';
import { eq } from 'drizzle-orm';

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

      const result = await callGeminiGenerateContent(plaintextKey, request);
      
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

      // Story 3.6s (AC7) — GeminiTimeoutError must take the exact same unretried, unexcluded
      // path as any other unknown error: a timeout says nothing about whether the *key* was
      // bad, only that *this specific call* took too long. Retrying immediately with another
      // key would not fix a genuinely oversized/slow request and would burn a second key's
      // quota for no benefit. This explicit branch is a no-op (falls through to the same
      // re-throw below) -- it exists only to make the "never retried-with-another-key" contract
      // visible and protected against an accidental future regression.
      if (error instanceof GeminiTimeoutError) {
        throw error;
      }

      // Re-throw unknown errors
      throw error;
    }
  }
}
