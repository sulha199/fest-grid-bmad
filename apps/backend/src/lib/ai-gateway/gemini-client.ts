import { GoogleGenAI } from '@google/genai';
import { loadBackendEnv } from '../../env.js';

export interface GeminiCallRequest {
  contents: string | any;
  systemInstruction?: string;
  responseSchema?: any;
  responseMimeType?: string;
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

export let callGeminiGenerateContent = async (
  apiKey: string,
  request: GeminiCallRequest
): Promise<GeminiCallResult> => {
  const env = loadBackendEnv();
  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: env.geminiModel,
      contents: request.contents,
      config: {
        systemInstruction: request.systemInstruction,
        responseSchema: request.responseSchema,
        responseMimeType: request.responseMimeType,
      },
    });

    return {
      text: response.text || '',
    };
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
