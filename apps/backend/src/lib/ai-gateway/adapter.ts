import { selectApiKey, computeBackoffDelayMs } from '@festgrid/domain';
import { loadBackendEnv } from '../../env.js';
import { decryptApiKey } from './kms.js';
import {
  callGeminiGenerateContent,
  GeminiRateLimitedError,
  GeminiInvalidKeyError,
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
  const tier = request.subscriberUserIds.length === 1 ? 'TIER_1_USER_SPECIFIC' : 'TIER_2_SHARED_ROUND_ROBIN';

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

      // Re-throw unknown errors
      throw error;
    }
  }
}
