import { GoogleGenAI } from '@google/genai';
import { loadBackendEnv } from '../../env.js';

export interface GeminiCallRequest {
  contents: string | any;
  systemInstruction?: string;
  responseSchema?: any;
  responseMimeType?: string;
  // Story 3.6s (AC7) — explicit response-size cap, threaded into the SDK's `config` object.
  maxOutputTokens?: number;
  // Story 3.6s (AC7) — AbortController-based request timeout, in milliseconds. When set, the
  // call is aborted and throws GeminiTimeoutError if it has not resolved within this window.
  // Confirmed via the installed @google/genai@2.16.0 SDK's own TypeScript types
  // (GenerateContentConfig.abortSignal) that generateContent's config accepts a real
  // AbortSignal -- the request is genuinely cancelled client-side, not merely raced.
  timeoutMs?: number;
}

export interface GeminiCallResult {
  text: string;
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

// Story 3.6s (AC7) — a timed-out extraction call. Deliberately NOT treated like
// GeminiRateLimitedError/GeminiInvalidKeyError (callGemini's retry-and-exclude-key loop must
// never catch this) -- a timeout says nothing about whether the *key* was bad, only that *this
// specific call* took too long. It must propagate unretried out of callGemini/processAiJob,
// surfacing as a natural, retryable SQS redelivery (the same unconditional re-throw path
// GeminiUnknownError already takes in adapter.ts).
export class GeminiTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiTimeoutError';
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
) => Promise<{ text?: string }> = (ai, params) => ai.models.generateContent(params);

export function setGenerateContentSeam(fn: typeof generateContentSeam) {
  generateContentSeam = fn;
}

export let callGeminiGenerateContent = async (
  apiKey: string,
  request: GeminiCallRequest
): Promise<GeminiCallResult> => {
  const env = loadBackendEnv();
  const ai = new GoogleGenAI({ apiKey });

  // Story 3.6s (AC7) — minimal inline AbortController-based timeout guard, a temporary
  // stand-in for Epic 0's not-yet-built guarded vendor-call wrapper (0.i2a-0.i2c). Confirmed the
  // installed @google/genai SDK's GenerateContentConfig.abortSignal accepts a real AbortSignal
  // (client-side cancellation of the underlying HTTP request), so no Promise.race fallback is
  // needed here.
  const controller = new AbortController();
  let timedOut = false;
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  if (request.timeoutMs !== undefined) {
    timeoutHandle = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, request.timeoutMs);
  }

  const config: Record<string, any> = {
    systemInstruction: request.systemInstruction,
    responseSchema: request.responseSchema,
    responseMimeType: request.responseMimeType,
    maxOutputTokens: request.maxOutputTokens,
  };
  if (request.timeoutMs !== undefined) {
    config.abortSignal = controller.signal;
  }

  try {
    const response = await generateContentSeam(ai, {
      model: env.geminiModel,
      contents: request.contents,
      config,
    });

    return {
      text: response.text || '',
    };
  } catch (error: any) {
    if (timedOut) {
      throw new GeminiTimeoutError(
        `Gemini extraction call timed out after ${request.timeoutMs}ms`
      );
    }

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
  } finally {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }
  }
};

export function setCallGeminiGenerateContent(fn: typeof callGeminiGenerateContent) {
  callGeminiGenerateContent = fn;
}

export async function verifyGeminiApiKey(apiKey: string): Promise<boolean> {
  try {
    await callGeminiGenerateContent(apiKey, { contents: 'ping' });
    return true;
  } catch (error) {
    if (error instanceof GeminiInvalidKeyError) {
      return false;
    }
    throw error;
  }
}
