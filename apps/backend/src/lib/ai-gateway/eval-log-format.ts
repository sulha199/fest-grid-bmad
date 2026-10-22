/**
 * Formatting for the opt-in golden-prompt live eval's log (`scripts/run-golden-prompt-live-eval.ts`).
 * Pure so it is unit-testable; the script owns the printing.
 *
 * Collapses `text` (a Gemini error message or a raw model response, often pretty-printed JSON) to one
 * line and caps it at `maxLength` characters, saying how much was cut, so a drifted fixture or a
 * failed call stays diagnosable from the Actions log without flooding it.
 */
export function truncateForLog(text: string, maxLength: number): string {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  if (oneLine.length <= maxLength) {
    return oneLine;
  }
  return `${oneLine.slice(0, maxLength)}... (+${oneLine.length - maxLength} chars)`;
}
