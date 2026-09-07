// Tier 1 (pre-ingestion) suppression keyword list for children's-data protection
// (Story 3.6k). This is an expanding heuristic list, NOT a closed/final set --
// a future story may extend it (e.g. via a config surface) without re-deriving
// the underlying intent: any of these tokens signals the surrounding text is
// plausibly about a children's/minors' event, and individual performer names
// must never be extracted/persisted for it (see AC1/AC2).
export const CHILDRENS_DATA_KEYWORDS: string[] = [
  'anak',
  'cilik',
  'junior',
  'TK',
  'SD',
  'sanggar',
  'lomba tari anak',
  'paud',
  'balita',
];

// Escape a string for safe inclusion inside a RegExp source.
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Case-insensitive, word-boundary keyword match against `CHILDRENS_DATA_KEYWORDS`.
 *
 * Word-boundary (`\b<keyword>\b`) matching -- not a bare substring test -- is
 * required because two of the example keywords (`TK`, `SD`) are short tokens
 * that are also common substrings of unrelated words (e.g. `USD`, `Saturday`).
 * A plain `.includes()` check would produce frequent false positives for a
 * heuristic list this short and this loosely specified.
 */
export function matchesChildrensDataKeywordFilter(text: string | undefined | null): boolean {
  if (!text) {
    return false;
  }

  return CHILDRENS_DATA_KEYWORDS.some((keyword) => {
    const pattern = new RegExp(`\\b${escapeRegExp(keyword)}\\b`, 'i');
    return pattern.test(text);
  });
}
