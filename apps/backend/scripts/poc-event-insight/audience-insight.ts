/**
 * POC (not production code): the model-facing half of the audience, language and taxonomy POC (event-insight-poc/audience-and-taxonomy-poc-plan-2026-10-21.md).
 *
 * One standalone Gemini call per post reports the fields the labellers labelled (labelling-guide-2026-10-21.md), in the guide's own vocabulary,
 * so the scorer can compare like with like. The model proposes; `guardAudienceInsight` verifies against the caption and degrades every claim it
 * cannot ground toward "no claim", counting each drop as an abstention (AD-42 Rule 3). The audience COUNTRY is not decided here: the model only
 * reports what the post states and where the event is, and `audience-country.ts` runs the ladder.
 *
 * Deliberate difference from `insight-schema.ts` INSIGHT_RULES_V2: the cost tiers follow the labelling guide (low under Rp 50,000, medium up to
 * Rp 250,000), not the older Rp 100,000 / Rp 500,000 cut-offs, because the labels are the answer key. AD-42 must pick one set before launch.
 */
import { ageNumberIsStated, RESTRICTION_CUE } from './guards.js';
import { hasNationwideWording } from './audience-areas.js';
import { quoteIsVerbatim, statedClaimHolds } from './audience-country.js';

export const POST_LANGUAGES = ['id', 'en', 'ms', 'mixed', 'other'] as const;
export const GEO_SCOPES = ['venue_local', 'city', 'region', 'national', 'international', 'online', 'unspecified'] as const;
export const AREA_LEVELS = ['neighborhood', 'city', 'regency', 'province', 'country', 'continent', 'none'] as const;
export const ELIGIBILITY = ['open_to_public', 'restricted', 'unspecified'] as const;
export const COST_TIERS = ['free', 'low', 'medium', 'high', 'unspecified'] as const;
export const SENSITIVE_TOPICS = ['none', 'religion', 'politics_civic', 'health_condition', 'sexuality', 'ethnicity'] as const;

export interface AudienceInsight {
  postLanguage: string;
  statedAudience?: { country: string; quote: string } | null;
  eventCountry?: string | null;
  geoScope: string;
  targetAreaLevel: string;
  eligibility: string;
  tracks: Array<{ label?: string; ageMin?: number; ageMax?: number }>;
  costTier: string;
  sensitiveTopic: string;
  interests: string[];
  evidence: string[];
}

export const audienceInsightSchema = {
  type: 'OBJECT',
  properties: {
    postLanguage: { type: 'STRING', enum: [...POST_LANGUAGES] },
    statedAudience: {
      type: 'OBJECT',
      properties: { country: { type: 'STRING' }, quote: { type: 'STRING' } },
      required: ['country', 'quote'],
    },
    eventCountry: { type: 'STRING' },
    geoScope: { type: 'STRING', enum: [...GEO_SCOPES] },
    targetAreaLevel: { type: 'STRING', enum: [...AREA_LEVELS] },
    eligibility: { type: 'STRING', enum: [...ELIGIBILITY] },
    tracks: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { label: { type: 'STRING' }, ageMin: { type: 'NUMBER' }, ageMax: { type: 'NUMBER' } },
      },
    },
    costTier: { type: 'STRING', enum: [...COST_TIERS] },
    sensitiveTopic: { type: 'STRING', enum: [...SENSITIVE_TOPICS] },
    interests: { type: 'ARRAY', items: { type: 'STRING' } },
    evidence: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['postLanguage', 'geoScope', 'targetAreaLevel', 'eligibility', 'tracks', 'costTier', 'sensitiveTopic', 'interests', 'evidence'],
};

export const AUDIENCE_INSIGHT_INSTRUCTION_V1 = `You are an analyst for an event-discovery app. Given the text of one social media post, report who it is for and what kind of event it is. The post may be Indonesian, Malay, English or a mix. Answer with the English enum values. Report only what the post supports; "unspecified", "none" or an empty list is the correct answer when the post says nothing. Do not guess.

- postLanguage: the language the caption is written in: id (Indonesian), ms (Malay), en (English), mixed (Indonesian and English in one caption), other. Indonesian and Malay look alike; use the words, not the account.
- statedAudience: ONLY if the post itself says who may take part or who it is for ("seluruh Indonesia", "se-ASEAN", "open worldwide", a named country). country = the lower-case two-letter code (id, my, sg, au, dk ...) or "international"; quote = the exact words from the post that state it. Leave it out if the post states nothing. A venue, a performer or a city is not a stated audience. "Open to the public" or "free entry" is not one either.
- eventCountry: the two-letter code of the country where the event takes place, if the post shows it. Leave it out otherwise.
- geoScope: venue_local (people around the venue's neighbourhood), city (one city or regency), region (a province, or several named areas), national (the post invites people from anywhere in the country; a contest at a local campus that invites the whole country is national), international (several countries or a continent), online (attendance is remote and open regardless of location), unspecified (the post gives no basis, or nobody is invited to attend, such as a result or follow-only post). A venue called "Galeri Nasional" is just a venue. "Open to the public" does not raise the scope.
- targetAreaLevel: the finest area the audience is drawn from, if the post names one: neighborhood, city, regency, province, country, continent, or none.
- eligibility: restricted ONLY if the post limits who may take part by membership (invitation only, one school, one company, members only). open_to_public if it says so; unspecified if it says nothing. Age and gender are not eligibility.
- tracks: one entry per separately qualifying category the post lists (for example "Kids Dash 6-10, 5K 12+, 10K 17+" is three). Empty if none. ageMin / ageMax ONLY if that exact number is written in the post next to an age word; never derive an age from a school level.
- costTier: the cheapest stated fee a participant pays: free (explicitly free), low (under about Rp 50,000), medium (up to about Rp 250,000), high (above that), or the equivalent in another currency. unspecified if no price is stated.
- sensitiveTopic: none, or the single topic the post is about if it is religion, politics_civic, health_condition, sexuality or ethnicity. A mosque's open iftar is religion; a fitness class is none; a diabetes screening is health_condition.
- interests: up to 6 lower-case English interest tags, the things a person would have to like to want to go. Not generic words such as "event" or "fun".
- evidence: up to 5 short VERBATIM snippets copied exactly from the post (each at most 100 characters) that support stated audience, ages, restriction and cost. If you cannot quote support for a claim, drop the claim.
Strictly follow the JSON schema.`;

export function audienceInsightContents(caption: string, account: string | null, dateIso: string | null): string {
  return `${account ? `Account Name Metadata: "${account}"\n` : ''}${dateIso ? `Post published: ${dateIso.slice(0, 10)}\n` : ''}Post text:\n"""\n${caption}\n"""`;
}

// ---- validation -------------------------------------------------------------------------------
const oneOf = (list: readonly string[], v: unknown) => typeof v === 'string' && list.includes(v);

export function validateAudienceInsight(raw: unknown): { ok: boolean; value?: AudienceInsight; errors: string[] } {
  const errors: string[] = [];
  const r = raw as any;
  if (typeof r !== 'object' || r === null) return { ok: false, errors: ['not an object'] };
  if (!oneOf(POST_LANGUAGES, r.postLanguage)) errors.push('postLanguage');
  if (!oneOf(GEO_SCOPES, r.geoScope)) errors.push('geoScope');
  if (!oneOf(AREA_LEVELS, r.targetAreaLevel)) errors.push('targetAreaLevel');
  if (!oneOf(ELIGIBILITY, r.eligibility)) errors.push('eligibility');
  if (!oneOf(COST_TIERS, r.costTier)) errors.push('costTier');
  if (!oneOf(SENSITIVE_TOPICS, r.sensitiveTopic)) errors.push('sensitiveTopic');
  if (!Array.isArray(r.tracks)) errors.push('tracks');
  else for (const t of r.tracks) for (const k of ['ageMin', 'ageMax']) if (t?.[k] != null && typeof t[k] !== 'number') errors.push(k);
  if (!Array.isArray(r.interests) || !r.interests.every((x: unknown) => typeof x === 'string')) errors.push('interests');
  if (!Array.isArray(r.evidence) || !r.evidence.every((x: unknown) => typeof x === 'string')) errors.push('evidence');
  if (r.statedAudience != null && (typeof r.statedAudience.country !== 'string' || typeof r.statedAudience.quote !== 'string')) errors.push('statedAudience');
  return errors.length ? { ok: false, errors } : { ok: true, value: r as AudienceInsight, errors };
}

// ---- guards -----------------------------------------------------------------------------------
export interface ClaimCounts {
  /** Claims the model made that a guard could check, and how many the guard dropped. Abstentions are reported apart from wrong claims. */
  proposed: number;
  dropped: number;
  /** Evidence quotes the model proposed that were not verbatim (they are dropped; a surviving one would be a critical error). */
  nonVerbatimQuotes: number;
  quotes: number;
}

export interface GuardOutcome { value: AudienceInsight; actions: string[]; claims: ClaimCounts }

/**
 * Applies the deterministic checks before the output would be persisted. Every guard moves toward "no claim":
 *   - evidence quotes must occur in the caption;
 *   - an age number survives only if it is grounded in a verbatim quote next to an age word, in the right role (guards.ts);
 *   - a stated audience survives only if its quote is verbatim and names the country (audience-country.ts);
 *   - `national` needs nationwide wording (AD-42 Rule 3e);
 *   - `restricted` needs restriction wording (AD-42 Rule 3d).
 */
export function guardAudienceInsight(input: AudienceInsight, caption: string): GuardOutcome {
  const value: AudienceInsight = { ...input, tracks: input.tracks.map((t) => ({ ...t })), evidence: [...input.evidence], interests: [...input.interests].slice(0, 6) };
  const actions: string[] = [];
  const claims: ClaimCounts = { proposed: 0, dropped: 0, nonVerbatimQuotes: 0, quotes: input.evidence.length };

  const verbatim = value.evidence.filter((q) => quoteIsVerbatim(q, caption));
  claims.nonVerbatimQuotes = value.evidence.length - verbatim.length;
  if (claims.nonVerbatimQuotes) actions.push(`dropped ${claims.nonVerbatimQuotes} non-verbatim evidence quote(s)`);
  value.evidence = verbatim;

  value.tracks.forEach((t, i) => {
    for (const key of ['ageMin', 'ageMax'] as const) {
      const n = t[key];
      if (n == null) continue;
      claims.proposed++;
      if (!ageNumberIsStated(n, verbatim, key === 'ageMin' ? 'min' : 'max')) {
        claims.dropped++;
        actions.push(`dropped track ${i + 1} ${key}=${n}: not grounded in a verbatim quote`);
        delete t[key];
      }
    }
  });

  if (value.statedAudience) {
    claims.proposed++;
    if (!statedClaimHolds(value.statedAudience, caption)) {
      claims.dropped++;
      actions.push(`dropped stated audience ${value.statedAudience.country}: quote not verbatim or does not name it`);
      value.statedAudience = null;
    }
  }

  if (value.geoScope === 'national') {
    claims.proposed++;
    if (!hasNationwideWording(caption)) {
      claims.dropped++;
      actions.push('national -> unspecified: no nationwide wording');
      value.geoScope = 'unspecified';
    }
  }

  if (value.eligibility === 'restricted') {
    claims.proposed++;
    if (!RESTRICTION_CUE.test(caption)) {
      claims.dropped++;
      actions.push('restricted -> unspecified: no restriction wording');
      value.eligibility = 'unspecified';
    }
  }

  return { value, actions, claims };
}

// ---- derived values the scorer compares with the labels --------------------------------------
export const trackCountOf = (v: AudienceInsight): number => v.tracks.length;
export const ageWrittenOf = (v: AudienceInsight): 'yes' | 'no' => (v.tracks.some((t) => t.ageMin != null || t.ageMax != null) ? 'yes' : 'no');

// ---- sensitive screen (AD-42 Rule 7: a deterministic list plus the model's flag) -------------
// Bilingual start list; the POC measures its recall and precision, so it is meant to be edited. Word boundaries keep "doa" from matching "adoable".
export const SENSITIVE_PATTERNS: Array<{ topic: Exclude<(typeof SENSITIVE_TOPICS)[number], 'none'>; re: RegExp }> = [
  { topic: 'religion', re: /\b(allah|tuhan|gereja|masjid|mushola|musholla|doa|berdoa|pengajian|kajian|ekaristi|novena|misa|ibadah|sholawat|shalawat|zakat|umrah|umroh|haji|manasik|iman|quran|al-?qur'?an|islam|islamic|kristen|katolik|nasrani|dakwah|hijrah|ramadan|ramadhan|lebaran|natal|christmas|easter|paskah|church|mosque|prayer|worship|jazakallah|barakallah|ukhuwah|sedekah|krisma|santo|paroki|romo)\b/i },
  { topic: 'politics_civic', re: /\b(pemilu|pilkada|pilpres|partai|presiden|politik|politic|political|election|korupsi|antikorupsi|anti-?korupsi|protest|demo|unjuk rasa|dprd|dpr|parlemen|greenpeace|activist|aktivis|kampanye calon)\b/i },
  { topic: 'health_condition', re: /\b(kanker|cancer|diabetes|depresi|depression|kesehatan mental|mental health|penyakit|disabilitas|disability|autis|autism|hiv|stroke|hipertensi|obesitas|skrining|screening|terapi|therapy)\b/i },
  { topic: 'sexuality', re: /\b(lgbt|lgbtq|gay|lesbian|queer|transgender|pride month|seksualitas|sexuality)\b/i },
  { topic: 'ethnicity', re: /\b(etnis|ethnic|ethnicity|suku bangsa|tionghoa|imlek|chinese new year|papua|dayak|batak|minang|sunda|jawa tengah)\b/i },
];

export function sensitiveScreen(caption: string, interests: string[] = []): { topic: string; matched: string } | undefined {
  const text = `${caption}\n${interests.join(' ')}`.normalize('NFKC');
  for (const { topic, re } of SENSITIVE_PATTERNS) {
    const m = re.exec(text);
    if (m) return { topic, matched: m[0].toLowerCase() };
  }
  return undefined;
}
