/**
 * POC (pure, no I/O): the audience-country ladder of AD-39 Rule 8 / AD-42 Rule 4, and the post-language resolver.
 *
 * The model PROPOSES (a stated audience with a quote, the post language, the event's country). This code decides, from cues it can
 * verify itself, in the order the labelling guide uses for the human labellers (labelling-guide-2026-10-21.md, "Audience country"):
 *
 *   1. stated    the post names who it is for, and the model's quote is verbatim and names that country (or an international scope)
 *   2. addressed who the post is written for: a strong cue in the caption (currency with an amount, phone code, time-zone
 *                abbreviation, country-code domain), else the posting account's country. Language alone is NOT enough: Indonesian and
 *                Malay are close, English is everywhere, so a shared language needs the second clue (guide step 3)
 *   3. online    an online event with no stated audience is international (guide step 4)
 *   4. place     only if nothing above helps, the country where the event takes place (guide step 5)
 *   5. none      `unclear`. The POC reports this apart so that abstention is never counted as a wrong answer
 *
 * Deterministic and explainable on purpose: it reuses `country-signals.ts` for the cues and the account's country.
 */
import { collectSignals, inferCountryFromSignals, type ProfileText } from './country-signals.js';

export type AudienceCountry = string; // lower-case ISO 3166-1 alpha-2, 'international' or 'unclear'
export type AudienceSource = 'stated' | 'cue' | 'account' | 'online' | 'place' | 'none';

export interface AudienceInput {
  /** The country (alpha-2) or `international` the model says the post states as its audience, with the quote it relies on. */
  stated?: { country: string; quote: string } | null;
  /** The language the post is written in, as the model reported it (id, en, ms, mixed, other). */
  postLanguage: string;
  /** The country (alpha-2) where the model says the event takes place. */
  eventCountry?: string | null;
  geoScope?: string;
  /** The caption text. Used for the cues and to check the stated quote; never stored. */
  caption: string;
  /** The posting account's country (alpha-2), resolved from its own posts by `accountCountryOf`, or undefined. */
  accountCountry?: string;
}

export interface AudienceResult { country: AudienceCountry; source: AudienceSource; note?: string }

const lc = (s: string) => s.toLowerCase();

// How each country is named in a post (English, Indonesian, Malay), plus its demonym. Used only to verify that a "stated" claim is stated.
const COUNTRY_WORDS: Record<string, RegExp> = {
  id: /\b(indonesia|indonesian|se-?\s?indonesia|nusantara)\b/i,
  my: /\b(malaysia|malaysian|se-?\s?malaysia)\b/i,
  sg: /\b(singapore|singapura|singaporean)\b/i,
  au: /\b(australia|australian)\b/i,
  th: /\b(thailand|thai)\b/i,
  jp: /\b(japan|jepang|jepun|japanese)\b/i,
  kr: /\b(korea|south korea|korea selatan|korean)\b/i,
  us: /\b(united states|usa|u\.s\.a?|amerika serikat|america|american)\b/i,
  gb: /\b(united kingdom|uk|britain|british|inggris|england)\b/i,
  in: /\b(india|indian)\b/i,
  ph: /\b(philippines|filipina|filipino|filipin)\b/i,
  vn: /\b(vietnam|vietnamese)\b/i,
  dk: /\b(denmark|denmark|danish|denmark open)\b/i,
  eg: /\b(egypt|mesir|egyptian)\b/i,
  bn: /\b(brunei)\b/i,
};

const INTERNATIONAL_WORDS = /\b(international|internasional|antarabangsa|worldwide|global|se-?\s?asean|asean|all countries|seluruh dunia|dunia|asia)\b/i;

const norm = (s: string) => s.normalize('NFKC').replace(/\s+/g, ' ').toLowerCase();

/** True when `quote` occurs verbatim (case, spacing and Unicode form aside) in `caption`. */
export function quoteIsVerbatim(quote: string, caption: string): boolean {
  const q = norm(quote).trim();
  return q.length >= 3 && norm(caption).includes(q);
}

/**
 * Verifies a stated-audience claim: the quote is verbatim, and it names the country (or an international scope). A claim for a country
 * this table does not know cannot be verified and is dropped, which the scorer counts as an abstention, not as a wrong claim.
 */
export function statedClaimHolds(stated: { country: string; quote: string }, caption: string): boolean {
  if (!quoteIsVerbatim(stated.quote, caption)) return false;
  const c = lc(stated.country);
  if (c === 'international') return INTERNATIONAL_WORDS.test(stated.quote);
  const re = COUNTRY_WORDS[c];
  return re ? re.test(stated.quote) : false;
}

/** Strong cues in one caption: country (lower-case) by kind. Weak signals (a place name, a country name) are not cues. */
export function captionCues(caption: string): Array<{ country: string; kind: string }> {
  const p: ProfileText = { username: '', displayName: '', biography: '', captions: [caption], locationNames: [] };
  return collectSignals(p).filter((s) => s.strength === 2).map((s) => ({ country: lc(s.country), kind: s.kind }));
}

/** The one country the caption's strong cues agree on, or undefined when there are none or they disagree. */
export function cueCountry(caption: string): string | undefined {
  const countries = new Set(captionCues(caption).map((c) => c.country));
  return countries.size === 1 ? [...countries][0] : undefined;
}

/**
 * The posting account's country, from what its own posts show (the same signals IDEA-075 would use at profile enrichment). Undefined when
 * the evidence is absent, weak or conflicting: an unresolved account never forces an answer.
 */
export function accountCountryOf(username: string, captions: string[], locationNames: string[] = []): string | undefined {
  const d = inferCountryFromSignals({ username, displayName: '', biography: '', captions, locationNames });
  return d.status === 'resolved' ? lc(d.country) : undefined;
}

/** The ladder. */
export function resolveAudienceCountry(i: AudienceInput): AudienceResult {
  if (i.stated && statedClaimHolds(i.stated, i.caption)) return { country: lc(i.stated.country), source: 'stated' };

  const cue = cueCountry(i.caption);
  if (cue) return { country: cue, source: 'cue' };

  if (i.accountCountry) return { country: lc(i.accountCountry), source: 'account' };

  if (i.geoScope === 'online') return { country: 'international', source: 'online' };

  if (i.eventCountry && /^[a-z]{2}$/i.test(i.eventCountry)) return { country: lc(i.eventCountry), source: 'place', note: 'event place only' };

  return { country: 'unclear', source: 'none' };
}

const MALAYSIA_BLOC = new Set(['my', 'sg', 'bn']);

/**
 * The post language with one extra cue. The model's `id` and `ms` are the pair that cannot be told apart by words alone; a currency, a phone
 * code or the account's country settles it. `en`, `mixed` and `other` pass through.
 */
export function resolvePostLanguage(model: string, caption: string, accountCountry?: string): { language: string; viaCue: boolean } {
  const l = lc(model);
  if (l !== 'id' && l !== 'ms') return { language: l, viaCue: false };
  const country = cueCountry(caption) ?? accountCountry;
  if (!country) return { language: l, viaCue: false };
  if (country === 'id') return { language: 'id', viaCue: l !== 'id' };
  if (MALAYSIA_BLOC.has(country)) return { language: 'ms', viaCue: l !== 'ms' };
  return { language: l, viaCue: false };
}
