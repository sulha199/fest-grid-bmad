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
import { hasNationwideWording, textMentions } from './audience-areas.js';
import { quoteIsVerbatim, statedClaimHolds } from './audience-country.js';

export const POST_LANGUAGES = ['id', 'en', 'ms', 'mixed', 'other'] as const;
export const GEO_SCOPES = ['venue_local', 'city', 'region', 'national', 'international', 'online', 'unspecified'] as const;
export const AREA_LEVELS = ['neighborhood', 'city', 'regency', 'province', 'country', 'continent', 'none'] as const;
export const ELIGIBILITY = ['open_to_public', 'restricted', 'unspecified'] as const;
export const COST_TIERS = ['free', 'low', 'medium', 'high', 'unspecified'] as const;
export const SENSITIVE_TOPICS = ['none', 'religion', 'politics_civic', 'health_condition', 'sexuality', 'ethnicity'] as const;

export const AREA_ROLES = ['participant', 'attendee', 'both'] as const;
export const AREA_QUALIFIERS = ['only', 'and_surroundings', 'part_of', 'none'] as const;
/** `stated_poster`: only the poster image says it. The caption-only POC call cannot emit it; the production call, which sends the images, can. */
export const STATED_AREA_SOURCES = ['stated', 'stated_poster'] as const;

/** One audience area the post STATES (prompt v3). Implicit areas (venue, hashtags, account) are derived by code, not reported by the model. */
export interface StatedTargetArea {
  name: string;
  level: string;
  source: string;
  qualifier: string;
  role: string;
  /** Neighbourhood only: the kelurahan or desa the post names. */
  anchor?: string;
  /** The exact words that state it, copied from the caption or read from the poster. */
  quote: string;
}

export interface AudienceInsight {
  isEvent: boolean;
  postLanguage: string;
  statedAudience?: { country: string; quote: string } | null;
  eventCountry?: string | null;
  geoScope: string;
  /** Prompt v2 only: one level taken from the venue, hashtags and account. Replaced by `targetAreas` in v3. */
  targetAreaLevel?: string;
  /** Prompt v3: the areas the post states (possibly several, at mixed levels). Empty = the post states none. */
  targetAreas?: StatedTargetArea[];
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
    isEvent: { type: 'BOOLEAN' },
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
  required: ['isEvent', 'postLanguage', 'geoScope', 'targetAreaLevel', 'eligibility', 'tracks', 'costTier', 'sensitiveTopic', 'interests', 'evidence'],
};

export const AUDIENCE_INSIGHT_INSTRUCTION_V2 = `You are an analyst for an event-discovery app. Given the text of one social media post, report who it is for and what kind of event it is. The post may be Indonesian, Malay, English or a mix. Answer with the English enum values. Report only what the post supports; "unspecified", "none" or an empty list is the correct answer when the post says nothing. Do not guess.

- isEvent: true if the post advertises or reports on something with a date (an event that is coming up or running). false if it has no schedule: a recap or thank-you after the event, a repost of a personal vlog, news, a shop or restaurant promo, a quote or greeting. For a post that is not an event, still fill every field with your best answer.
- postLanguage: the language the caption is written in: id (Indonesian), ms (Malay), en (English), mixed (Indonesian and English in one caption), other. Indonesian and Malay look alike; use the words, not the account.
- statedAudience: ONLY if the post itself says who may take part or who it is for ("seluruh Indonesia", "se-ASEAN", "open worldwide", a named country). country = the lower-case two-letter code (id, my, sg, au, dk ...) or "international"; quote = the exact words from the post that state it. Leave it out if the post states nothing. A venue, a performer or a city is not a stated audience. "Open to the public" or "free entry" is not one either.
- eventCountry: the two-letter code of the country where the event takes place, if the post shows it. Leave it out otherwise.
- geoScope: venue_local (a venue is named: the people around it), city (only a city or regency is named, no venue), region (a province, or several named areas), national (the post invites people from anywhere in the country; a contest at a local campus that invites the whole country is national), international (several countries or a continent), online (attendance is remote and open regardless of location), unspecified (the post gives no basis, or nobody is invited to attend, such as a result or follow-only post). A venue called "Galeri Nasional" is just a venue. "Open to the public" does not raise the scope.
- targetAreaLevel: the finest area the audience is drawn from: neighborhood, city, regency, province, country, continent. Take it from the venue, then the hashtags, then what the posting account covers (its name and other cues). none only if nothing points to any area.
- eligibility: restricted ONLY if the post limits who may take part by membership (invitation only, one school, one company, members only). Otherwise open_to_public: an event with no restriction is open. unspecified only when the post is not an event. Age and gender are not eligibility.
- tracks: one entry per separately qualifying category the post lists (for example "Kids Dash 6-10, 5K 12+, 10K 17+" is three). If it lists none, return one entry with no ages (one tier open to everybody). Ticket packs and prices are not categories. ageMin / ageMax ONLY if that exact number is written in the post next to an age word; never derive an age from a school level.
- costTier: the cheapest stated fee a participant pays: free (explicitly free), low (under about Rp 50,000), medium (up to about Rp 250,000), high (above that), or the equivalent in another currency. unspecified if no price is stated.
- sensitiveTopic: none, or the single topic the post is about if it is religion, politics_civic, health_condition, sexuality or ethnicity. A mosque's open iftar is religion; a fitness class is none; a diabetes screening is health_condition.
- interests: up to 6 lower-case English interest tags, the things a person would have to like to want to go. Not generic words such as "event" or "fun".
- evidence: up to 5 short VERBATIM snippets copied exactly from the post (each at most 100 characters) that support stated audience, ages, restriction and cost. If you cannot quote support for a claim, drop the claim.
Strictly follow the JSON schema.`;

// ---- prompt v3: the model reports only what the post STATES; everything implicit is derived by code (target-areas.ts) ----------------
// The v2 line told the model to take the area "from the venue, then the hashtags, then what the posting account covers (its name and other cues)".
// That is code's job: the model cannot know the account type, its reach or the province policy, and an account NAME is not evidence of an audience.
// Owner decisions, 2026-10-27: a stated audience (caption or poster) wins over the venue, whether wider or narrower; participants who attend,
// register or compete count; where performers, exhibitors or vendors come from does not; a neighbourhood only from explicit wording.
const targetAreasLine = (withPoster: boolean): string =>
  `- targetAreas: the places the post says the event is FOR, as a list of {name, level, source, qualifier, role, anchor, quote}. Report ONLY what the post states. Do not use the venue, the hashtags or the posting account's name or location as an area: they are handled elsewhere. An empty list is the correct answer when the post states no audience area.
  * source "stated": the caption says who the event is for, open to, aimed at or invited from, including the people who attend, register or compete: "warga Jogja", "se-DIY", "mahasiswa se-Bantul", "peserta dari seluruh Indonesia", "khusus warga RW 05".${withPoster ? ' source "stated_poster": the same, but only the poster image says it (the caption does not).' : ''}
  * quote: the exact words that state it (at most 100 characters), copied from the ${withPoster ? 'caption or read from the poster' : 'caption'}.
  * NOT an audience: an address or "Tempat:" line; the venue's name; where performers, artists, exhibitors, vendors or guests come from ("sanggar tari se-yogyakarta" in an exhibition); a place inside a name ("Java Jazz"); "terbuka untuk umum" or "free entry".
  * level: neighborhood only when the post says RW, RT, kampung, dusun or lingkungan (put the kelurahan or desa in anchor if the post names it); otherwise city, regency, province, country or continent. If a name could be a city or its province (Jogja, Yogyakarta, Jakarta), give the wider one.
  * qualifier: "only" for "khusus", "hanya", "... saja" (residents only); "and_surroundings" for "dan sekitarnya"; "part_of" for "bagian selatan"; otherwise "none".
  * role: "participant" when the area is who may take part or register ("pendaftaran seluruh Indonesia"); "attendee" when it is who may come and watch; otherwise "both".
  * Several areas -> several entries (a tour lists each stop; "DIY dan Jawa Tengah" is two).`;

export const AUDIENCE_INSIGHT_INSTRUCTION_V3 = AUDIENCE_INSIGHT_INSTRUCTION_V2.replace(/- targetAreaLevel:[^\n]*/, targetAreasLine(false));
/** The production variant: the call also sends the poster image, so an area printed only on the poster counts (source stated_poster). */
export const AUDIENCE_INSIGHT_INSTRUCTION_V3_WITH_POSTER = AUDIENCE_INSIGHT_INSTRUCTION_V2.replace(/- targetAreaLevel:[^\n]*/, targetAreasLine(true));

const { targetAreaLevel: _dropLevel, ...schemaPropsV2 } = audienceInsightSchema.properties;
void _dropLevel;
export function audienceInsightSchemaV3(withPoster = false) {
  return {
    type: 'OBJECT',
    properties: {
      ...schemaPropsV2,
      targetAreas: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            name: { type: 'STRING' },
            level: { type: 'STRING', enum: AREA_LEVELS.filter((l) => l !== 'none') },
            source: { type: 'STRING', enum: withPoster ? [...STATED_AREA_SOURCES] : ['stated'] },
            qualifier: { type: 'STRING', enum: [...AREA_QUALIFIERS] },
            role: { type: 'STRING', enum: [...AREA_ROLES] },
            anchor: { type: 'STRING' },
            quote: { type: 'STRING' },
          },
          required: ['name', 'level', 'source', 'qualifier', 'role', 'quote'],
        },
      },
    },
    required: audienceInsightSchema.required.map((f) => (f === 'targetAreaLevel' ? 'targetAreas' : f)),
  };
}

export function audienceInsightContents(caption: string, account: string | null, dateIso: string | null): string {
  return `${account ? `Account Name Metadata: "${account}"\n` : ''}${dateIso ? `Post published: ${dateIso.slice(0, 10)}\n` : ''}Post text:\n"""\n${caption}\n"""`;
}

// ---- validation -------------------------------------------------------------------------------
const oneOf = (list: readonly string[], v: unknown) => typeof v === 'string' && list.includes(v);

/** The fields of one stated area that are missing or outside their vocabulary (empty = well formed). */
export function invalidStatedAreaFields(a: unknown): string[] {
  const r = a as Record<string, unknown> | null;
  if (typeof r !== 'object' || r === null) return ['(not an object)'];
  const bad: string[] = [];
  const text = (v: unknown) => typeof v === 'string' && v.trim().length > 0;
  if (!text(r.name)) bad.push('name');
  if (!(typeof r.level === 'string' && r.level !== 'none' && (AREA_LEVELS as readonly string[]).includes(r.level))) bad.push('level');
  if (!oneOf(STATED_AREA_SOURCES, r.source)) bad.push('source');
  if (!oneOf(AREA_QUALIFIERS, r.qualifier)) bad.push('qualifier');
  if (!oneOf(AREA_ROLES, r.role)) bad.push('role');
  if (!text(r.quote)) bad.push('quote');
  if (r.anchor !== undefined && typeof r.anchor !== 'string') bad.push('anchor');
  return bad;
}

export function validateAudienceInsight(raw: unknown): { ok: boolean; value?: AudienceInsight; errors: string[] } {
  const errors: string[] = [];
  const r = raw as any;
  if (typeof r !== 'object' || r === null) return { ok: false, errors: ['not an object'] };
  if (typeof r.isEvent !== 'boolean') errors.push('isEvent');
  if (!oneOf(POST_LANGUAGES, r.postLanguage)) errors.push('postLanguage');
  if (!oneOf(GEO_SCOPES, r.geoScope)) errors.push('geoScope');
  if (r.targetAreas !== undefined) {
    if (!Array.isArray(r.targetAreas)) errors.push('targetAreas');
    else r.targetAreas.forEach((a: unknown, i: number) => { for (const e of invalidStatedAreaFields(a)) errors.push(`targetAreas[${i}].${e}`); });
  } else if (!oneOf(AREA_LEVELS, r.targetAreaLevel)) errors.push('targetAreaLevel');
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
  const value: AudienceInsight = {
    ...input, tracks: input.tracks.map((t) => ({ ...t })), evidence: [...input.evidence], interests: [...input.interests].slice(0, 6),
    ...(input.targetAreas && { targetAreas: input.targetAreas.map((a) => ({ ...a })) }),
  };
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

  if (value.targetAreas) value.targetAreas = guardStatedAreas(value.targetAreas, caption, claims, actions);

  if (value.geoScope === 'national') {
    claims.proposed++;
    // the wording may be only on the poster: a stated_poster quote can carry it (it cannot be checked against the caption)
    const posterWording = (value.targetAreas ?? []).some((a) => a.source === 'stated_poster' && hasNationwideWording(a.quote));
    if (!hasNationwideWording(caption) && !posterWording) {
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

// ---- stated target areas (prompt v3) -----------------------------------------------------------------------------------------
/** Wording that makes a residents-only claim (qualifier "only") believable. Without it the qualifier is downgraded to "none". */
export const RESIDENTS_ONLY_CUE = /\b(khusus|hanya|saja|eksklusif|exclusive|only|residents?\s+only)\b/i;
/** Wording that makes a neighbourhood-level claim believable. Without it the level is widened to "city". */
export const NEIGHBOURHOOD_CUE = /\b(rw|rt|kampung|dusun|dukuh|padukuhan|lingkungan)\b/i;
export const MAX_AREA_QUOTE_LENGTH = 100;

/**
 * Applies the guards to the model's stated areas; every one moves toward "no claim":
 *   - `stated`: the quote must occur verbatim in the caption and the quote or caption must mention the area, else the area is dropped;
 *   - `stated_poster`: the quote cannot be checked against the caption; it is kept (counted separately in the actions) unless it is empty or too long;
 *   - qualifier `only` needs residents-only wording in the quote, else it becomes `none`;
 *   - level `neighborhood` needs RW / RT / kampung / dusun / lingkungan wording in the quote, else it is widened to `city`.
 */
export function guardStatedAreas(areas: StatedTargetArea[], caption: string, claims: ClaimCounts, actions: string[]): StatedTargetArea[] {
  const kept: StatedTargetArea[] = [];
  for (const a of areas) {
    claims.proposed++;
    const quote = a.quote.trim();
    if (!a.name.trim() || !quote || quote.length > MAX_AREA_QUOTE_LENGTH) {
      claims.dropped++;
      actions.push(`dropped area "${a.name}": empty or over-long quote`);
      continue;
    }
    if (a.source === 'stated') {
      if (!quoteIsVerbatim(quote, caption) || !(textMentions(caption, a.name) || textMentions(quote, a.name))) {
        claims.dropped++;
        actions.push(`dropped stated area "${a.name}": quote not verbatim in the caption or the area is not named`);
        continue;
      }
    } else {
      actions.push(`poster area "${a.name}": not checkable against the caption (kept)`);
    }
    const out: StatedTargetArea = { ...a, quote };
    if (out.qualifier === 'only') {
      claims.proposed++;
      if (!RESIDENTS_ONLY_CUE.test(quote)) {
        claims.dropped++;
        actions.push(`area "${a.name}": qualifier only -> none (no residents-only wording)`);
        out.qualifier = 'none';
      }
    }
    if (out.level === 'neighborhood') {
      claims.proposed++;
      if (!NEIGHBOURHOOD_CUE.test(quote)) {
        claims.dropped++;
        actions.push(`area "${a.name}": neighborhood -> city (no RW/RT/kampung/dusun wording)`);
        out.level = 'city';
        delete out.anchor;
      }
    }
    kept.push(out);
  }
  return kept;
}

/** Widest level first, for the single level the labellers recorded (`target_area_level`). */
const LEVEL_WIDTH = ['neighborhood', 'city', 'regency', 'province', 'country', 'continent'];

/** The single level the scorer compares with `target_area_level`: prompt v2's own value, or the widest level among the v3 stated areas (`none` if empty). */
export function targetAreaLevelOf(v: AudienceInsight): string {
  if (v.targetAreas === undefined) return v.targetAreaLevel ?? 'none';
  if (v.targetAreas.length === 0) return 'none';
  return v.targetAreas.reduce((widest, a) => (LEVEL_WIDTH.indexOf(a.level) > LEVEL_WIDTH.indexOf(widest) ? a.level : widest), v.targetAreas[0].level);
}

/** What `target_area_source` records: `stated` if the caption states an area, `stated_poster` if only the poster does, `none` otherwise. Prompt v2 has no source. */
export function targetAreaSourceOf(v: AudienceInsight): 'stated' | 'stated_poster' | 'none' | undefined {
  if (v.targetAreas === undefined) return undefined;
  if (v.targetAreas.some((a) => a.source === 'stated')) return 'stated';
  return v.targetAreas.length > 0 ? 'stated_poster' : 'none';
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
