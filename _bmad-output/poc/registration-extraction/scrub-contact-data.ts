// POC prototype of `scrubContactData` (handoff 7B.2). Strips contact data from the FREE-TEXT fields the model fills
// (highlight, eligibility, instruction, messageTemplate), so the phone column stays the only place a number lives (R7).
// Names are NOT scrubbed: nothing deterministic can find them; the prompt must not ask for them.
import { normalizeCaption } from './detect-phones.ts';

export const REMOVED = '[removed]';

const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/gu;
// wa.me links may carry spaces or dashes inside the number ("wa.me/+62 812-..."), so the number part is matched first.
const WA_URL = /(?:https?:\/\/)?(?:wa\.me\/+[+\d][\d \-+.]*(?:\?[^\s)]*)?|(?:api\.whatsapp\.com|web\.whatsapp\.com|chat\.whatsapp\.com)\/[^\s)]*)/giu;
// Indonesian mobile, any separator style, with or without +62/62/0.
const ID_MOBILE = /(?<![\p{L}\p{N}_+.])(?:\(?\+?[ ]?62\)?[ \-.]?|0)8\d(?:[ \-.()]?\d){6,11}(?![\p{N}])/gu;
// Any other long digit run (bank account, intl number): 9+ digits joined by space or dash only.
// A dot-grouped amount (50.000.000) is never matched because dots are not allowed as joiners here.
const LONG_DIGITS = /(?<![\p{L}\p{N}_+.,])\+?\d(?:[ \-]?\d){8,}(?![\p{N}])/gu;
const AT_HANDLE_WITH_DIGITS = /(?<![\p{L}\p{N}_])@\w*\d{6,}\w*/gu; // handles that embed a phone number

export function scrubContactData(input: string): { text: string; removed: number } {
  let removed = 0;
  const sub = (re: RegExp, s: string) => s.replace(re, () => { removed++; return REMOVED; });
  let s = normalizeCaption(input);
  s = sub(EMAIL, s);
  s = sub(WA_URL, s);
  s = sub(ID_MOBILE, s);
  s = sub(AT_HANDLE_WITH_DIGITS, s);
  s = sub(LONG_DIGITS, s);
  return { text: s, removed };
}
