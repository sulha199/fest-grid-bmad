export const accountClassificationResponseSchema = {
  type: 'OBJECT',
  properties: {
    accountType: {
      type: 'STRING',
      enum: ['ORGANIZER_VENUE_EVENT', 'PERSONAL', 'CURATOR_GUIDE']
    },
    confidenceScore: {
      type: 'NUMBER'
    }
  },
  required: ['accountType', 'confidenceScore']
} as const;

export function buildAccountClassificationRequest(profile: {
  biography: string;
  username: string;
  displayName: string;
  businessCategoryName: string | null;
}): {
  systemInstruction: string;
  contents: string;
  responseMimeType: 'application/json';
  responseSchema: typeof accountClassificationResponseSchema;
} {
  const systemInstruction =
    `You are an AI assistant designed to classify a social media account's type based on its profile information.\n` +
    `Classify the account into one of the following types:\n` +
    `1. 'ORGANIZER_VENUE_EVENT': Official accounts representing an event organizer, a venue, a specific recurring or single event, or a business/community that hosts events.\n` +
    `2. 'PERSONAL': Private individual accounts, personal blogs, personal attendee accounts, or accounts of specific people.\n` +
    `3. 'CURATOR_GUIDE': Curators, city guides, regional listings directories, local recommendation feeds, or compilation accounts that gather event info from others but do not host/organize events themselves.\n\n` +
    `CRITICAL LEGAL COMPLIANCE GATES:\n` +
    `- This classification is a strict legal-compliance gate for user privacy and legitimate interest laws. We MUST NOT scrape personal accounts.\n` +
    `- NEVER guess confidently when the signal is thin or ambiguous. If there is any doubt or lack of strong clear signal that the account is an official organizer, venue, or event, assign a low 'confidenceScore' (e.g. less than 0.7) and/or classify as appropriate.\n` +
    `- A low confidence score is the correct and expected output for an ambiguous account, NOT a failure.\n\n` +
    `Your JSON response must strictly conform to the response schema, containing:\n` +
    `- 'accountType': string enum of 'ORGANIZER_VENUE_EVENT', 'PERSONAL', or 'CURATOR_GUIDE'.\n` +
    `- 'confidenceScore': number from 0.0 to 1.0 reflecting your certainty.`;

  const contents =
    `Username: "${profile.username}"\n` +
    `Display Name: "${profile.displayName}"\n` +
    `Biography/Bio: "${profile.biography}"\n` +
    `Business Category Name: "${profile.businessCategoryName || 'N/A'}"`;

  return {
    systemInstruction,
    contents,
    responseMimeType: 'application/json',
    responseSchema: accountClassificationResponseSchema,
  };
}

export function parseAccountClassificationResponse(
  rawText: string
): {
  accountType: 'ORGANIZER_VENUE_EVENT' | 'PERSONAL' | 'CURATOR_GUIDE';
  confidenceScore: number;
} | null {
  try {
    const parsed = JSON.parse(rawText);
    if (parsed && typeof parsed === 'object') {
      const type = parsed.accountType;
      const score = parsed.confidenceScore;
      if (
        (type === 'ORGANIZER_VENUE_EVENT' || type === 'PERSONAL' || type === 'CURATOR_GUIDE') &&
        typeof score === 'number' &&
        Number.isFinite(score)
      ) {
        return {
          accountType: type,
          confidenceScore: Math.min(1, Math.max(0, score)),
        };
      }
    }
  } catch {
    // Graceful error handling, never throw
  }
  return null;
}
