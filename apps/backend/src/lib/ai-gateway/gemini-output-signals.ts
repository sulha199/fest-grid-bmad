// AD-49 Rule 2 (cursor extraction, slice 1): the one definition of an "at-risk" Gemini response,
// i.e. one that may have been cut off, so a later split-and-retry loop and today's log line agree.
// Pure: no SDK, no env.

/** Output at or above this share of the cap is treated as at risk even when finishReason says STOP. */
export const OUTPUT_NEAR_LIMIT_RATIO = 0.9;

export type GeminiAtRiskReason = 'max_tokens' | 'output_near_limit';

export interface GeminiOutputSignalInput {
  finishReason?: string;
  outputTokens?: number;
  // Thinking tokens are reported separately but count against maxOutputTokens, so they are added in.
  thinkingTokens?: number;
  maxOutputTokens?: number;
}

export function classifyGeminiOutput(input: GeminiOutputSignalInput): GeminiAtRiskReason[] {
  const reasons: GeminiAtRiskReason[] = [];
  if (input.finishReason === 'MAX_TOKENS') {
    reasons.push('max_tokens');
  }
  const { outputTokens, maxOutputTokens } = input;
  const used = typeof outputTokens === 'number' ? outputTokens + (input.thinkingTokens ?? 0) : undefined;
  if (
    typeof used === 'number' &&
    typeof maxOutputTokens === 'number' &&
    maxOutputTokens > 0 &&
    used >= maxOutputTokens * OUTPUT_NEAR_LIMIT_RATIO
  ) {
    reasons.push('output_near_limit');
  }
  return reasons;
}
