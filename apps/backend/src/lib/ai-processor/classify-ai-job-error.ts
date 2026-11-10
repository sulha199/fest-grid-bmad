import type { ClassifiedFailure } from '@festgrid/domain/retry';
import { AiGatewayBusyError, AiGatewayExhaustedError } from '../ai-gateway/adapter.js';
import { classifyGeminiError } from '../ai-gateway/gemini-situation.js';
import { VendorKeyBusyError } from '../vendor-gateway/guarded-call.js';

/**
 * AD-52 Rule 1: what a failure of the Gemini stage of an extraction job means for the retry policy. The gateway's
 * own errors carry no vendor text, so they are named here; everything else is the Gemini classifier's.
 */
export function classifyAiJobError(error: unknown): ClassifiedFailure {
  // Busy leases are contention, not a verdict on any key: a later attempt will find a free one.
  if (error instanceof AiGatewayBusyError || error instanceof VendorKeyBusyError) {
    return { situation: 'unavailable' };
  }
  // Every candidate key was rate limited, exhausted or invalid: nothing to do now, a later attempt may find one back.
  if (error instanceof AiGatewayExhaustedError) {
    return { situation: 'rate_limited' };
  }
  return classifyGeminiError(error);
}
