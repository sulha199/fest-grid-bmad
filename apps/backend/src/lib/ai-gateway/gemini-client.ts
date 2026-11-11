import { GoogleGenAI } from '@google/genai';
import { isTransientVendorFailure } from '@festgrid/domain';
import { loadBackendEnv } from '../../env.js';
import { callVendor } from '../vendor-gateway/guarded-call.js';

export interface GeminiCallRequest {
  contents: string | any;
  systemInstruction?: string;
  responseSchema?: any;
  responseMimeType?: string;
  // Story 3.6s (AC7) — explicit response-size cap, threaded into the SDK's `config` object.
  maxOutputTokens?: number;
  // Per-call model override; falls back to the shared GEMINI_MODEL when omitted.
  model?: string;
}

export interface GeminiCallResult {
  text: string;
  // AD-49 Rule 1 (cursor extraction, slice 1) -- additive and optional so callers and test mocks
  // that return only `text` keep working. `finishReason` is the first candidate's (STOP,
  // MAX_TOKENS, SAFETY, ...); `usage` comes from the SDK's usageMetadata.
  finishReason?: string;
  // Set when the prompt itself was blocked (no candidate, so no finishReason).
  blockReason?: string;
  usage?: GeminiUsage;
}

export interface GeminiUsage {
  promptTokens?: number;
  outputTokens?: number;
  thinkingTokens?: number;
}

export class GeminiRateLimitedError extends Error {
  constructor(message: string, public retryAfterSeconds?: number) {
    super(message);
    this.name = 'GeminiRateLimitedError';
  }
}

export class GeminiInvalidKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiInvalidKeyError';
  }
}

export class GeminiUnknownError extends Error {
  constructor(message: string, public originalError: any) {
    super(message);
    this.name = 'GeminiUnknownError';
  }
}

// Story 3.6s (Task 5.4) — the raw SDK call is its own swappable seam (same `let` + setter
// pattern as `callGeminiGenerateContent` itself), exclusively so unit tests can exercise the
// REAL AbortController timeout/maxOutputTokens wiring in `callGeminiGenerateContent` below
// without making a real network call or needing module-level mocking of `@google/genai` (no
// such mocking precedent exists elsewhere in this codebase). Production code never calls this
// setter -- it always goes through the real `GoogleGenAI` SDK.
export let generateContentSeam: (
  ai: GoogleGenAI,
  params: { model: string; contents: any; config: Record<string, any> }
) => Promise<{
  text?: string;
  candidates?: Array<{ finishReason?: unknown }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
  promptFeedback?: { blockReason?: unknown };
}> = (ai, params) => ai.models.generateContent(params);

export function setGenerateContentSeam(fn: typeof generateContentSeam) {
  generateContentSeam = fn;
}

export let callGeminiGenerateContent = async (
  apiKey: string,
  request: GeminiCallRequest,
  signal?: AbortSignal
): Promise<GeminiCallResult> => {
  const env = loadBackendEnv();
  const ai = new GoogleGenAI({ apiKey });

  const config: Record<string, any> = {
    systemInstruction: request.systemInstruction,
    responseSchema: request.responseSchema,
    responseMimeType: request.responseMimeType,
    maxOutputTokens: request.maxOutputTokens,
  };
  if (signal !== undefined) {
    config.abortSignal = signal;
  }

  try {
    const response = await generateContentSeam(ai, {
      model: request.model ?? env.geminiModel,
      contents: request.contents,
      config,
    });

    const finishReason = response.candidates?.[0]?.finishReason;
    const promptTokens = response.usageMetadata?.promptTokenCount;
    const outputTokens = response.usageMetadata?.candidatesTokenCount;
    const thinkingTokens = response.usageMetadata?.thoughtsTokenCount;
    const blockReason = response.promptFeedback?.blockReason;
    const result: GeminiCallResult = { text: response.text || '' };
    if (finishReason !== undefined && finishReason !== null) {
      result.finishReason = String(finishReason);
    }
    if (blockReason !== undefined && blockReason !== null) {
      result.blockReason = String(blockReason);
    }
    if (typeof promptTokens === 'number' || typeof outputTokens === 'number' || typeof thinkingTokens === 'number') {
      result.usage = {
        ...(typeof promptTokens === 'number' ? { promptTokens } : {}),
        ...(typeof outputTokens === 'number' ? { outputTokens } : {}),
        ...(typeof thinkingTokens === 'number' ? { thinkingTokens } : {}),
      };
    }
    return result;
  } catch (error: any) {
    const message = error?.message || String(error);
    const status = error?.status || error?.statusCode || error?.status_code;

    // Check status or message content for rate limiting (429 / RESOURCE_EXHAUSTED)
    if (status === 429 || message.includes('429') || message.toLowerCase().includes('resource_exhausted')) {
      let retryAfter: number | undefined = undefined;
      const headers = error?.response?.headers;
      if (headers) {
        const retryAfterHeader = headers.get?.('retry-after') || headers['retry-after'];
        if (retryAfterHeader) {
          const parsed = parseInt(retryAfterHeader, 10);
          if (!isNaN(parsed)) {
            retryAfter = parsed;
          }
        }
      }
      throw new GeminiRateLimitedError(message, retryAfter);
    }

    // Check status or message content for invalid keys (401 / 403 / API_KEY_INVALID)
    if (
      status === 401 ||
      status === 403 ||
      message.includes('401') ||
      message.includes('403') ||
      message.toLowerCase().includes('invalid_api_key') ||
      message.toLowerCase().includes('key_invalid') ||
      message.toLowerCase().includes('api key not valid') ||
      message.toLowerCase().includes('api_key_invalid')
    ) {
      throw new GeminiInvalidKeyError(message);
    }

    throw new GeminiUnknownError(message, error);
  }
};

// Story 0.i2c (AD-32 Rule 4) — transient-failure classification is the vendor adapter's
// responsibility, not callVendor's. Narrow and evidence-based (user-decided, 2026-10-06):
// only a GeminiUnknownError whose originalError looks like a network/5xx failure is transient.
// GeminiRateLimitedError/GeminiInvalidKeyError are never transient -- callGemini's own
// cross-key exclusion loop handles those exclusively, unchanged.
export function isGeminiErrorTransient(error: unknown): boolean {
  if (error instanceof GeminiRateLimitedError || error instanceof GeminiInvalidKeyError) {
    return false;
  }

  if (!(error instanceof GeminiUnknownError)) {
    return false;
  }

  // Story 10.2 (FIND-082): the rule is the shared `isTransientVendorFailure`; this reads the status and the code from the
  // wrapped SDK error.
  const originalError: any = error.originalError;
  return isTransientVendorFailure({
    statusCode: originalError?.status ?? originalError?.statusCode ?? originalError?.status_code,
    code: originalError?.code ?? originalError?.cause?.code,
  });
}

export function setCallGeminiGenerateContent(fn: typeof callGeminiGenerateContent) {
  callGeminiGenerateContent = fn;
}

// Story 0.i2b (AD-32 Rule 3) — the last of the three AD-32-named callGeminiGenerateContent
// entry points to adopt the guarded callVendor wrapper. lockKey is explicitly undefined: this
// is a named exception to per-key locking (0.i2a AC4) because the key under verification has
// no apiKeys.id yet (createApiKey calls this before insert), and nothing else can concurrently
// bill against a key not yet in the candidate pool. isGeminiErrorTransient/the signal-aware
// callGeminiGenerateContent third parameter are both reused as-is from Story 0.i2c -- no new
// classifier is introduced here.
export async function verifyGeminiApiKey(apiKey: string): Promise<boolean> {
  const env = loadBackendEnv();
  try {
    await callVendor('gemini', {
      lockKey: undefined,
      timeoutMs: env.geminiVerificationTimeoutMs,
      // Two full attempts' worth (20s with the 10s default): keeps attempts + backoff inside the
      // API Lambda's 25s limit so createApiKey gets a typed error, not a killed invocation.
      overallTimeoutMs: env.geminiVerificationTimeoutMs * 2,
      isTransient: isGeminiErrorTransient,
      call: (signal) => callGeminiGenerateContent(apiKey, { contents: 'ping' }, signal),
    });
    return true;
  } catch (error) {
    if (error instanceof GeminiInvalidKeyError) {
      return false;
    }
    throw error;
  }
}
