import { callGemini, AiGatewayExhaustedError } from './adapter.js';
import { callGeminiGenerateContent, GeminiCallRequest, GeminiCallResult } from './gemini-client.js';
import { loadBackendEnv } from '../../env.js';

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
      return await callGeminiGenerateContent(env.systemGeminiApiKey, request);
    }
    throw error;
  }
}
