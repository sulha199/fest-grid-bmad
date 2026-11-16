import type { ClassifiedFailure, RetrySituation } from '@festgrid/domain/retry';
import { GeminiInvalidKeyError, GeminiRateLimitedError, GeminiUnknownError, isGeminiErrorTransient } from './gemini-client.js';
import { VendorCallTimeoutError } from '../vendor-gateway/guarded-call.js';

// AD-52 Rule 1: the only Gemini-specific retry code. It maps raw errors and responses onto the closed
// situation set; `decideRetry` (packages/domain) decides what to do about each.

// A bare status number only counts when it is not part of a longer number ("403.5s", "4030").
const status = (codes: string) => `(?<![\\d.])(?:${codes})(?![\\d.])`;
const RATE_LIMITED = new RegExp(`${status('429')}|RESOURCE_EXHAUSTED`, 'i');
const DAILY_QUOTA = /PerDay|per day/i;
const RETRY_HINT = /retry in (\d+(?:\.\d+)?)s/i;
const INVALID_KEY = new RegExp(`api key not valid|api_key_invalid|invalid_api_key|key_invalid|${status('401|403')}`, 'i');
const UNAVAILABLE = new RegExp(`UNAVAILABLE|${status('50[0-4]')}|fetch failed|ECONNRESET|ETIMEDOUT|ECONNREFUSED|EAI_AGAIN`, 'i');
const BAD_REQUEST = new RegExp(`INVALID_ARGUMENT|${status('400')}`, 'i');

/** Seconds from a "Please retry in 42.4s" hint in a Gemini error message, when present. */
export function parseRetryHintSeconds(message: string): number | undefined {
  const match = RETRY_HINT.exec(message);
  const seconds = match ? Number(match[1]) : NaN;
  return Number.isFinite(seconds) ? seconds : undefined;
}

/** True when a rate-limit rejection names the per-DAY quota: nothing can succeed until it resets. */
export function isDailyQuotaMessage(message: string): boolean {
  return RATE_LIMITED.test(message) && DAILY_QUOTA.test(message);
}

/** Classifies a Gemini error by its message text (used where only a string is left, e.g. the eval script). */
export function classifyGeminiMessage(message: string): ClassifiedFailure {
  if (isDailyQuotaMessage(message)) {
    return { situation: 'quota_exhausted_daily' };
  }
  if (RATE_LIMITED.test(message)) {
    const retryAfterSeconds = parseRetryHintSeconds(message);
    return retryAfterSeconds === undefined ? { situation: 'rate_limited' } : { situation: 'rate_limited', retryAfterSeconds };
  }
  if (INVALID_KEY.test(message)) {
    return { situation: 'invalid_credential' };
  }
  if (UNAVAILABLE.test(message)) {
    return { situation: 'unavailable' };
  }
  if (BAD_REQUEST.test(message)) {
    return { situation: 'bad_request' };
  }
  return { situation: 'unknown' };
}

/** Classifies an error thrown by the Gemini client or the guarded wrapper. */
export function classifyGeminiError(error: unknown): ClassifiedFailure {
  if (error instanceof GeminiRateLimitedError) {
    if (isDailyQuotaMessage(error.message)) {
      return { situation: 'quota_exhausted_daily' };
    }
    const retryAfterSeconds = error.retryAfterSeconds ?? parseRetryHintSeconds(error.message);
    return retryAfterSeconds === undefined ? { situation: 'rate_limited' } : { situation: 'rate_limited', retryAfterSeconds };
  }
  if (error instanceof GeminiInvalidKeyError) {
    return { situation: 'invalid_credential' };
  }
  if (error instanceof VendorCallTimeoutError) {
    return { situation: 'timeout' };
  }
  if (error instanceof GeminiUnknownError && isGeminiErrorTransient(error)) {
    return { situation: 'unavailable' };
  }
  const message = error instanceof Error ? error.message : String(error);
  return classifyGeminiMessage(message);
}

// Finish reasons for which the provider refused to answer: a retry cannot succeed.
const BLOCKING_FINISH_REASONS = new Set(['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'RECITATION', 'IMAGE_SAFETY']);

/** Classifies a response whose text could not be used (AD-49): blocked, cut off, or just unparseable. */
export function classifyGeminiUnusableResponse(response: {
  finishReason?: string;
  blockReason?: string;
  /** Output (with thinking) reached the token cap, so the text was probably cut off (AD-49). */
  outputNearLimit?: boolean;
}): RetrySituation {
  if (response.blockReason !== undefined || (response.finishReason !== undefined && BLOCKING_FINISH_REASONS.has(response.finishReason))) {
    return 'blocked';
  }
  if (response.finishReason === 'MAX_TOKENS' || response.outputNearLimit === true) {
    return 'truncated';
  }
  return 'unparseable';
}
