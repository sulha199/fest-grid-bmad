export function computeProfileBackfillPatch(
  current: { displayName: string; username: string },
  scraped: { ownerDisplayName?: string; ownerUsername?: string }
): { displayName?: string; username?: string } | null {
  const patch: { displayName?: string; username?: string } = {};

  if (scraped.ownerDisplayName) {
    const trimmedDisplay = scraped.ownerDisplayName.trim();
    if (trimmedDisplay && trimmedDisplay !== current.displayName) {
      patch.displayName = trimmedDisplay;
    }
  }

  if (scraped.ownerUsername) {
    const trimmedUser = scraped.ownerUsername.trim();
    if (trimmedUser && trimmedUser !== current.username) {
      patch.username = trimmedUser;
    }
  }

  if (Object.keys(patch).length === 0) {
    return null;
  }

  return patch;
}

export const locationInferenceResponseSchema = {
  type: 'OBJECT',
  properties: {
    locationFound: { type: 'BOOLEAN' },
    placeDescription: { type: 'STRING' },
    confidence: { type: 'NUMBER' }
  },
  required: ['locationFound']
} as const;

export function buildLocationInferenceRequest(
  post: { locationName?: string; content?: string }
): {
  systemInstruction: string;
  contents: string;
  responseMimeType: 'application/json';
  responseSchema: typeof locationInferenceResponseSchema;
} | null {
  const locationNameTrimmed = post.locationName?.trim() || '';
  const contentTrimmed = post.content?.trim() || '';

  if (!locationNameTrimmed && !contentTrimmed) {
    return null;
  }

  const systemInstruction =
    `You are an AI assistant designed to extract or infer a general geographic location or venue description from a social media post.\n` +
    `Your goal is to identify a place, city, neighborhood, or specific venue where the post's events or activities take place.\n` +
    `CRITICAL INSTRUCTIONS:\n` +
    `1. Scrutinize the provided post content and location metadata carefully.\n` +
    `2. Infer a description of the venue or location based ONLY on clues, names, addresses, or references in the post. Do not fabricate any information.\n` +
    `3. If you can confidently identify or infer a location description, set 'locationFound' to true and provide the location in 'placeDescription'.\n` +
    `4. If the post content and metadata do not contain enough specific information to confidently identify or infer a location description, you MUST set 'locationFound' to false and omit 'placeDescription' (or set it to null).\n` +
    `5. When 'locationFound' is true, also set 'confidence' to a number from 0.0 to 1.0 reflecting how certain you are that 'placeDescription' correctly identifies the real-world venue -- lower it when the only signal is a generic or ambiguous term (e.g. a single common word with no city/region qualifier), and raise it when the post and location metadata agree on a specific, unambiguous place.\n` +
    `6. Return the result strictly in the JSON format matching the specified response schema.`;

  const contents = `Location Name Metadata: "${locationNameTrimmed}"\nPost Content text:\n"${contentTrimmed}"`;

  return {
    systemInstruction,
    contents,
    responseMimeType: 'application/json',
    responseSchema: locationInferenceResponseSchema
  };
}

export interface LocationInferenceResult {
  placeDescription: string;
  /**
   * The AI's confidence in this inference, 0.0-1.0. Defaults to 0 (treated as
   * low-confidence, gated to AWAITING_APPROVAL) when the model omits it,
   * rather than assuming a confident result it never actually claimed.
   */
  confidence: number;
}

export function parseLocationInferenceResponse(rawText: string): LocationInferenceResult | null {
  try {
    const parsed = JSON.parse(rawText);
    if (parsed && typeof parsed === 'object' && parsed.locationFound === true) {
      const place = parsed.placeDescription;
      if (typeof place === 'string') {
        const trimmed = place.trim();
        if (trimmed) {
          const confidence = typeof parsed.confidence === 'number' && Number.isFinite(parsed.confidence)
            ? Math.min(1, Math.max(0, parsed.confidence))
            : 0;
          return { placeDescription: trimmed, confidence };
        }
      }
    }
  } catch {
    // Gracefully handle parsing failures, never throw
  }
  return null;
}
