import { ReviewVerdict } from '../types.js';

export interface ParseVerdictResult {
  verdict: ReviewVerdict;
  reason?: string;
}

/**
 * Robustly parses a review verdict from LLM output.
 * Extracts 'APPROVE' | 'AUTO_FIX' | 'NEEDS_HUMAN' case-insensitively,
 * ignoring surrounding prose/whitespace and trailing punctuation.
 * 
 * If ambiguous, empty, or invalid, returns 'NEEDS_HUMAN' with a structured reason.
 */
export function parseReviewVerdict(response: string | null | undefined): ParseVerdictResult {
  if (!response || typeof response !== 'string') {
    return {
      verdict: 'NEEDS_HUMAN',
      reason: 'could not parse review verdict',
    };
  }

  const text = response.toUpperCase();

  // Look for boundaries around potential verdicts.
  // Using word boundaries and handling underscore/hyphen/space variations.
  const hasApprove = /\bAPPROVE\b/.test(text);
  const hasAutoFix = /\bAUTO[_\s-]?FIX\b/.test(text);
  const hasNeedsHuman = /\bNEEDS[_\s-]?HUMAN\b/.test(text);

  const matchedCount = (hasApprove ? 1 : 0) + (hasAutoFix ? 1 : 0) + (hasNeedsHuman ? 1 : 0);

  // If there's an ambiguity (more than one verdict present in the prose) or none matched
  if (matchedCount !== 1) {
    return {
      verdict: 'NEEDS_HUMAN',
      reason: 'could not parse review verdict',
    };
  }

  if (hasApprove) {
    return { verdict: 'APPROVE' };
  }
  if (hasAutoFix) {
    return { verdict: 'AUTO_FIX' };
  }
  return { verdict: 'NEEDS_HUMAN' };
}
