/**
 * POC (not production code): the "audience insight" an extraction call would attach to each
 * event — who the event is FOR and where its intended audience is, as opposed to what/when/where
 * it is (which `EventInfo` already carries).
 *
 * Everything here is a prototype of what would later become (a) fields on the Gemini response
 * schema in `build-gemini-request.ts`, (b) an AJV schema next to `extracted-event.schema.ts`, and
 * (c) a pure `packages/domain/src/events/` type. It lives under `scripts/` so nothing in the
 * production pipeline depends on it yet.
 */
import { loadBackendEnv } from '../../src/env.js';

export const GEO_SCOPES = ['venue_local', 'city', 'region', 'national', 'international', 'online', 'unspecified'] as const;
export const AREA_LEVELS = ['neighborhood', 'city', 'regency', 'province', 'country', 'continent'] as const;
export const ELIGIBILITY = ['open_to_public', 'restricted', 'unspecified'] as const;
export const SEGMENTS = [
  'kids', 'teens', 'young_adults', 'adults', 'seniors',
  'families', 'students', 'professionals', 'tourists_expats', 'community_members',
] as const;
export const GENDER_FOCUS = ['all', 'women', 'men'] as const;
export const PARTICIPATION_MODES = ['attend', 'participate', 'compete', 'volunteer', 'shop', 'learn', 'network'] as const;
export const COST_TIERS = ['free', 'low', 'medium', 'high', 'unspecified'] as const;
export const INFERABLE_FIELDS = ['geo', 'eligibility', 'segments', 'age', 'gender', 'interests', 'participation', 'cost'] as const;

export type GeoScope = (typeof GEO_SCOPES)[number];
export type AreaLevel = (typeof AREA_LEVELS)[number];
export type Eligibility = (typeof ELIGIBILITY)[number];
export type Segment = (typeof SEGMENTS)[number];
export type GenderFocus = (typeof GENDER_FOCUS)[number];
export type ParticipationMode = (typeof PARTICIPATION_MODES)[number];
export type CostTier = (typeof COST_TIERS)[number];

export interface EventInsight {
  geoScope: GeoScope;
  // How people attend (venues experiment, venues.ts). Optional so older recorded results still load.
  attendance?: 'onsite' | 'online' | 'hybrid' | 'unspecified';
  targetAreas: Array<{ name: string; level: AreaLevel }>;
  eligibility: Eligibility;
  restrictionNote?: string;
  segments: Segment[];
  ageMin?: number;
  ageMax?: number;
  genderFocus: GenderFocus;
  interests: string[];
  participationModes: ParticipationMode[];
  costTier: CostTier;
  languages: string[];
  // Field groups whose value is the model's inference rather than something the text states.
  inferredFields: Array<(typeof INFERABLE_FIELDS)[number]>;
  // Verbatim snippets from the source text backing the non-default claims above.
  evidence: string[];
  confidence: number;
}

const enumArray = (values: readonly string[]) => ({ type: 'ARRAY', items: { type: 'STRING', enum: [...values] } });

// Gemini-facing response schema for the insight object (same OBJECT/ARRAY/STRING dialect as
// build-gemini-request.ts). Deliberately NO `maxItems` anywhere: build-gemini-request.ts documents
// that a bounded array next to a large nested schema made the real API return 400 INVALID_ARGUMENT.
// Caps are stated in the prompt instead.
export const insightSchema = {
  type: 'OBJECT',
  properties: {
    geoScope: { type: 'STRING', enum: [...GEO_SCOPES] },
    targetAreas: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          level: { type: 'STRING', enum: [...AREA_LEVELS] },
        },
        required: ['name', 'level'],
      },
    },
    eligibility: { type: 'STRING', enum: [...ELIGIBILITY] },
    restrictionNote: { type: 'STRING' },
    segments: enumArray(SEGMENTS),
    ageMin: { type: 'NUMBER' },
    ageMax: { type: 'NUMBER' },
    genderFocus: { type: 'STRING', enum: [...GENDER_FOCUS] },
    interests: { type: 'ARRAY', items: { type: 'STRING' } },
    participationModes: enumArray(PARTICIPATION_MODES),
    costTier: { type: 'STRING', enum: [...COST_TIERS] },
    languages: { type: 'ARRAY', items: { type: 'STRING' } },
    inferredFields: enumArray(INFERABLE_FIELDS),
    evidence: { type: 'ARRAY', items: { type: 'STRING' } },
    confidence: { type: 'NUMBER' },
  },
  required: [
    'geoScope', 'targetAreas', 'eligibility', 'segments', 'genderFocus', 'interests',
    'participationModes', 'costTier', 'languages', 'inferredFields', 'evidence', 'confidence',
  ],
};

// The rules block shared by the standalone call (variant A) and the combined extraction call
// (variant B, appended to the production system instruction).
export const INSIGHT_RULES_V1 = `AUDIENCE INSIGHT. For each event, also report who the event is FOR and where its intended audience is, in the "insight" object. Report only what the post supports -- an empty array / "unspecified" / "all" is the correct answer when the post says nothing; do NOT guess to fill fields.

- geoScope: how wide the intended audience's catchment is. venue_local = people around the venue/neighbourhood; city = the venue's city or metro area; region = an explicitly named multi-city/province area; national = all of one country; international = several countries or a whole continent; online = remote participation open regardless of location; unspecified = the post gives no place and no online-only signal.
- targetAreas: the places the post says the audience is drawn from or invited from, or -- when the post is a plain local promotion -- the venue's own city. Give each as {name, level}. NEVER list a place only because performers, artists, brands or sellers come from there; the audience catchment is what matters. If geoScope is unspecified or online with no place, leave targetAreas empty.
- eligibility: open_to_public only if the post says so ("terbuka untuk umum", "open to all") or it is plainly a public-venue event with no restriction stated; restricted only if the post limits who may take part (members only, one institution, invitation/approval, women only, an age band); otherwise unspecified. Do not mark an event restricted just because it is organised by a school, campus or company.
- segments: from the allowed list only. kids = up to 12, teens = 13-17, young_adults = 18-30, adults, seniors = 60+. Add a segment only when the post's wording, vocabulary, activities or the stated levels (e.g. PAUD/TK/SD, "mahasiswa", "lansia", "keluarga") point to it; add it to inferredFields when it is your inference rather than a stated audience.
- ageMin / ageMax: ONLY numbers the text states (e.g. "usia 7-16 tahun", "60 tahun ke atas", "under 12" -> ageMax 11 or 12 as the text implies). A school level or a vibe is NOT a stated age: leave both absent.
- genderFocus: women or men only if the post restricts or explicitly dedicates the event to that gender; otherwise all. A sub-category named "putra"/"putri" inside a mixed event does not make the event single-gender.
- interests: up to 6 specific, lower-case English interest tags (e.g. "trail running", "traditional dance", "esports"), the things a person would have to like to want to go. Not generic words like "event" or "fun".
- participationModes: how a person takes part -- attend (watch/visit), participate (join an activity), compete (contest/tournament/race entry), volunteer, shop, learn (talk/workshop/class), network.
- costTier: from the cheapest stated fee a participant pays: free (explicitly free or no charge), low (under Rp100,000 or roughly US$6), medium (Rp100,000-500,000), high (above Rp500,000), unspecified (no price stated). Team fees count as stated fees.
- languages: ISO 639-1 codes of the language(s) the event itself is run or promoted in (e.g. id, en, jv).
- NEVER infer or output attendee religion, ethnicity, political affiliation, health condition or sexual orientation. (An event being religious in nature is already captured by its category.)
- evidence: up to 5 short VERBATIM snippets copied exactly from the post (each at most 100 characters) that support the non-default claims above (geo, eligibility, age, gender, segments, cost). If you cannot quote support for a claim, either drop the claim or list its field group in inferredFields.
- confidence: 0-1, your confidence in the insight as a whole.`;

// v2 = v1 plus clarifications aimed at the failure families v1 actually showed on the core set
// (audience reach vs. venue, "open to the public" read as geography, invented age numbers,
// over-eager "restricted", over-eager segments). Appended rather than rewritten so the v1 -> v2
// diff stays exactly these lines. NOTE: tuned after reading v1's misses on the core set, so v2's
// core-set numbers are optimistic — the held-out set is the fair comparison.
export const INSIGHT_RULES_V2 = `${INSIGHT_RULES_V1}

CLARIFICATIONS (these take precedence over anything above that seems to conflict):
- geoScope describes where the intended attendees are expected to come from, not only where the venue is. If the post explicitly invites people from a whole country or continent, or the contest/registration is online so anyone nationwide can enter (even if a final or ceremony is held in one city), use national / international / online accordingly and list the invited places in targetAreas. A plain local promotion at a venue stays city or venue_local.
- "Open to the public" (terbuka untuk umum, dibuka untuk UMUM, open to all) answers eligibility only. It says nothing about geography and must never by itself raise geoScope above the venue's own area.
- ageMin / ageMax: output a number only if that exact number (or, for "under N" / "over N", N-1 / N+1) is written in the post next to an age word such as usia, umur, tahun, age, years. Never invent the missing bound of a one-sided statement ("60 tahun ke atas" has no maximum). Never derive ages from school levels (PAUD, TK, SD, SMA) or from words like "kids" or "anak-anak" -- use segments for those.
- eligibility = restricted needs explicit limiting wording (khusus, hanya untuk, members only, invitation only, internal, women only, an explicit age band). Registration, a sign-up form, free admission, limited quota, a confirmation e-mail, or being organised by a campus or company do NOT make an event restricted.
- segments: at most 3, and only audiences the post names or clearly targets. Prefer an empty list to a guess. Do not add community_members merely because a community organises the event.`;

// Prompt versions. v1 is the first draft, frozen so later versions can be compared against it.
export const INSIGHT_RULES_BY_VERSION: Record<string, string> = { v1: INSIGHT_RULES_V1, v2: INSIGHT_RULES_V2 };

export function insightRules(version: string): string {
  const rules = INSIGHT_RULES_BY_VERSION[version];
  if (!rules) throw new Error(`Unknown prompt version "${version}" (have: ${Object.keys(INSIGHT_RULES_BY_VERSION).join(', ')})`);
  return rules;
}

export function standaloneSystemInstruction(version: string): string {
  return `You are an analyst for an event-discovery app. Given the text of one social media post that advertises a single event, report the audience insight for that event. The post may be in Indonesian, English, or a mix; always answer using the English enum values and English interest tags.

${insightRules(version)}

Strictly follow the JSON schema. The top-level JSON object IS the insight object (do not wrap it).`;
}

export function modelUnderTest(): string {
  return loadBackendEnv().geminiModel;
}
