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
    placeDescription: { type: 'STRING' }
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
    `5. Return the result strictly in the JSON format matching the specified response schema.`;

  const contents = `Location Name Metadata: "${locationNameTrimmed}"\nPost Content text:\n"${contentTrimmed}"`;

  return {
    systemInstruction,
    contents,
    responseMimeType: 'application/json',
    responseSchema: locationInferenceResponseSchema
  };
}

export function parseLocationInferenceResponse(rawText: string): string | null {
  try {
    const parsed = JSON.parse(rawText);
    if (parsed && typeof parsed === 'object' && parsed.locationFound === true) {
      const place = parsed.placeDescription;
      if (typeof place === 'string') {
        const trimmed = place.trim();
        if (trimmed) {
          return trimmed;
        }
      }
    }
  } catch {
    // Gracefully handle parsing failures, never throw
  }
  return null;
}
