import { callGemini, AiGatewayExhaustedError } from './adapter.js';
import { callGeminiGenerateContent, GeminiCallRequest, GeminiCallResult, isGeminiErrorTransient } from './gemini-client.js';
import { loadBackendEnv } from '../../env.js';
import { callVendor } from '../vendor-gateway/guarded-call.js';

export let callGeminiRef = callGemini;

export function setCallGemini(fn: typeof callGemini) {
  callGeminiRef = fn;
}

export async function callGeminiForLocationInference(
  request: GeminiCallRequest & { provider: 'gemini'; subscriberUserIds: string[] }
): Promise<GeminiCallResult> {
  try {
    return await callGeminiRef(request);
  } catch (error) {
    if (error instanceof AiGatewayExhaustedError) {
      const env = loadBackendEnv();
      if (!env.systemGeminiApiKey) {
        throw error;
      }
      return await callVendor('gemini', {
        lockKey: 'gemini:system',
        timeoutMs: env.geminiExtractionTimeoutMs,
        isTransient: isGeminiErrorTransient,
        call: (signal) => callGeminiGenerateContent(env.systemGeminiApiKey as string, request, signal),
      });
    }
    throw error;
  }
}

export async function callGeminiForAccountClassification(
  request: GeminiCallRequest & { provider: 'gemini'; subscriberUserIds: string[] }
): Promise<GeminiCallResult> {
  try {
    return await callGeminiRef(request);
  } catch (error) {
    if (error instanceof AiGatewayExhaustedError) {
      const env = loadBackendEnv();
      if (!env.systemGeminiApiKey) {
        throw error;
      }
      return await callVendor('gemini', {
        lockKey: 'gemini:system',
        timeoutMs: env.geminiExtractionTimeoutMs,
        isTransient: isGeminiErrorTransient,
        call: (signal) => callGeminiGenerateContent(env.systemGeminiApiKey as string, request, signal),
      });
    }
    throw error;
  }
}
