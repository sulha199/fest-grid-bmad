/**
 * Escapes a value for use inside an HTML body or a quoted attribute (Story 0.i1a, FIND-021: render-template.ts
 * had no HTML-escaping). `&` goes first so the entities written for the other four characters are not
 * escaped a second time.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// C0 and C1 control characters, plus the Unicode line and paragraph separators.
// eslint-disable-next-line no-control-regex
const CONTROL_RUN = new RegExp('[\\u0000-\\u001f\\u007f-\\u009f\\u2028\\u2029]+', 'g');

/**
 * Makes a value safe to place in an e-mail subject (a header): every run of CR, LF and other control
 * characters becomes one space (mail header injection) and the result is trimmed. HTML-escaping is NOT done
 * here: a subject is plain text, so `&lt;` would show to the reader.
 */
export function sanitizeSubjectValue(value: string): string {
  return value.replace(CONTROL_RUN, ' ').trim();
}

/** The longest e-mail subject produced: a value from scraper or user text cannot make an unbounded header. */
export const MAX_SUBJECT_LENGTH = 200;

/** Caps a rendered subject at `MAX_SUBJECT_LENGTH` characters, trimmed, ending in an ellipsis when it was cut. */
export function capSubject(subject: string): string {
  if (subject.length <= MAX_SUBJECT_LENGTH) return subject;
  return `${subject.slice(0, MAX_SUBJECT_LENGTH - 1).trimEnd()}\u2026`;
}
