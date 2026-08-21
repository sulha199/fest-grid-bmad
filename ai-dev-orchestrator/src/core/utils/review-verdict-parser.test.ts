import { describe, test, expect } from 'vitest';
import { parseReviewVerdict } from './review-verdict-parser.js';

describe('Review Verdict Parser', () => {
  test('handles exact valid matches', () => {
    expect(parseReviewVerdict('APPROVE')).toEqual({ verdict: 'APPROVE' });
    expect(parseReviewVerdict('AUTO_FIX')).toEqual({ verdict: 'AUTO_FIX' });
    expect(parseReviewVerdict('NEEDS_HUMAN')).toEqual({ verdict: 'NEEDS_HUMAN' });
  });

  test('handles case insensitivity', () => {
    expect(parseReviewVerdict('approve')).toEqual({ verdict: 'APPROVE' });
    expect(parseReviewVerdict('auto_fix')).toEqual({ verdict: 'AUTO_FIX' });
    expect(parseReviewVerdict('needs_human')).toEqual({ verdict: 'NEEDS_HUMAN' });
    expect(parseReviewVerdict('Needs_Human')).toEqual({ verdict: 'NEEDS_HUMAN' });
  });

  test('handles variations in spaces, underscores, and hyphens', () => {
    expect(parseReviewVerdict('auto-fix')).toEqual({ verdict: 'AUTO_FIX' });
    expect(parseReviewVerdict('auto fix')).toEqual({ verdict: 'AUTO_FIX' });
    expect(parseReviewVerdict('needs human')).toEqual({ verdict: 'NEEDS_HUMAN' });
    expect(parseReviewVerdict('needs-human')).toEqual({ verdict: 'NEEDS_HUMAN' });
  });

  test('handles punctuation', () => {
    expect(parseReviewVerdict('APPROVE!')).toEqual({ verdict: 'APPROVE' });
    expect(parseReviewVerdict('AUTO_FIX.')).toEqual({ verdict: 'AUTO_FIX' });
    expect(parseReviewVerdict('NEEDS_HUMAN?')).toEqual({ verdict: 'NEEDS_HUMAN' });
  });

  test('extracts verdict buried inside paragraphs/prose', () => {
    expect(parseReviewVerdict('The result is correct. Therefore, I will APPROVE this story.')).toEqual({ verdict: 'APPROVE' });
    expect(parseReviewVerdict('We found minor format issues. Let us run AUTO_FIX to resolve them.')).toEqual({ verdict: 'AUTO_FIX' });
    expect(parseReviewVerdict('The code has extensive errors. This clearly NEEDS_HUMAN intervention.')).toEqual({ verdict: 'NEEDS_HUMAN' });
  });

  test('returns fallback NEEDS_HUMAN for empty, null, or undefined response', () => {
    expect(parseReviewVerdict('')).toEqual({
      verdict: 'NEEDS_HUMAN',
      reason: 'could not parse review verdict',
    });
    expect(parseReviewVerdict(null)).toEqual({
      verdict: 'NEEDS_HUMAN',
      reason: 'could not parse review verdict',
    });
    expect(parseReviewVerdict(undefined)).toEqual({
      verdict: 'NEEDS_HUMAN',
      reason: 'could not parse review verdict',
    });
  });

  test('returns fallback NEEDS_HUMAN for completely invalid prose', () => {
    expect(parseReviewVerdict('hello world, this is a random review response')).toEqual({
      verdict: 'NEEDS_HUMAN',
      reason: 'could not parse review verdict',
    });
  });

  test('returns fallback NEEDS_HUMAN for ambiguous/multiple verdicts', () => {
    expect(parseReviewVerdict('First we tried to AUTO_FIX, but we realized we actually APPROVE.')).toEqual({
      verdict: 'NEEDS_HUMAN',
      reason: 'could not parse review verdict',
    });
  });
});
