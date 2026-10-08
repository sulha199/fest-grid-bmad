import { callGemini, AiGatewayExhaustedError, AiGatewayBusyError } from './adapter.js';
import { callGeminiGenerateContent, GeminiCallRequest, GeminiCallResult, isGeminiErrorTransient } from './gemini-client.js';
import { loadBackendEnv } from '../../env.js';
import { callVendor, VendorKeyBusyError } from '../vendor-gateway/guarded-call.js';

export let callGeminiRef = callGemini;

export function setCallGemini(fn: typeof callGemini) {
  callGeminiRef = fn;
}

// The single guarded call into the AD-10 system key. A busy `gemini:system` lease is temporary
// contention, not an unknown failure -- surface it as AiGatewayBusyError so callers can tell it
// apart from quota exhaustion.
async function callSystemKeyGuarded(
  env: ReturnType<typeof loadBackendEnv>,
  request: GeminiCallRequest & { provider: 'gemini'; subscriberUserIds: string[] }
): Promise<GeminiCallResult> {
  try {
    return await callVendor('gemini', {
      lockKey: 'gemini:system',
      timeoutMs: env.geminiExtractionTimeoutMs,
      // Two full attempts' worth: keeps attempts + backoff inside the 300s AI Processor Lambda.
      overallTimeoutMs: env.geminiExtractionTimeoutMs * 2,
      isTransient: isGeminiErrorTransient,
      call: (signal) => callGeminiGenerateContent(env.systemGeminiApiKey as string, request, signal),
    });
  } catch (error) {
    if (error instanceof VendorKeyBusyError) {
      throw new AiGatewayBusyError('The system API key is busy with another in-flight call; try again shortly.');
    }
    throw error;
  }
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
      return await callSystemKeyGuarded(env, request);
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
      return await callSystemKeyGuarded(env, request);
    }
    throw error;
  }
}
