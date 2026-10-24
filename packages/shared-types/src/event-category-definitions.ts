// Type-only import, deliberately: `index.ts` will re-export this module (AD-44 Rule 3's "Binds"
// clause names this file explicitly, rather than defining definitions beside the enum), which
// would create a runtime import cycle if this file imported `EventCategory` as a VALUE. A
// type-only import is erased entirely by the compiler/bundler, so there is no runtime edge here
// -- only a compile-time one, which is exactly what we want for the exhaustiveness check below.
import type { EventCategory } from './index.js';

/**
 * Story 0.52 (AD-44 Rule 3/4). This module is the ONE source of prose definitions for
 * `EventCategory`, consumed by `renderEventCategoryGlossary()` (apps/backend/src/lib/ai-gateway/)
 * to build both the extraction prompt and the AI-filter prompt. Every string here is LLM-facing
 * English text only -- it is NEVER rendered in any UI. User-facing enum labels still go through
 * next-intl locale files (see `project-context.md`'s "Locale-Sensitive Data Rendering" rule);
 * this file has no relationship to that pipeline.
 *
 * Scope: this story's 18-value interim taxonomy only. `HOME_AND_LIVING`, `FASHION_AND_BEAUTY`,
 * and `FINANCE_AND_INVESTMENT` are Story 0.53's job and are deliberately never named here (not in
 * a definition, not in a boundary rule, not in a comment) -- the ratchet test's Check B fails
 * loudly if any of them (or a typo) ever appears in this file.
 */

export interface EventCategoryDefinition {
  /** 1-2 sentences, non-empty, at most 280 characters, single-line. */
  definition: string;
  /** At least one Indonesian alias/synonym a real post caption might use for this subject. */
  aliases: readonly string[];
}

// `${EventCategory}` is the plain string-literal union of the enum's values (e.g. 'MUSIC' |
// 'ARTS_AND_CULTURE' | ...) -- a type-only construct, so it carries none of the runtime-cycle
// risk a direct `Record<EventCategory, ...>` keyed-by-enum-member object literal would. It is
// still fully exhaustive at compile time: deleting a property below, or adding an unrecognized
// one, is a `tsc` error (demonstrated once in this story's Completion Notes per Task 10).
type EventCategoryKey = `${EventCategory}`;

export const EVENT_CATEGORY_DEFINITIONS: Readonly<Record<EventCategoryKey, EventCategoryDefinition>> = {
  MUSIC: {
    definition: 'Concerts, gigs, live performances, and music festivals across any genre.',
    aliases: ['musik', 'konser']
  },
  ARTS_AND_CULTURE: {
    definition:
      'Visual and performing arts, theater, film screenings, cultural exhibitions, and heritage crafts such as batik, tenun, and wastra textile events.',
    aliases: ['seni', 'budaya']
  },
  FOOD_AND_DRINK: {
    definition: 'Culinary events such as food festivals, bazaars, pop-up dining, cafes, and beverage tastings or launches.',
    aliases: ['kuliner', 'makanan dan minuman']
  },
  SPORTS_AND_FITNESS: {
    definition:
      "Participatory and spectator sports, fitness classes, and athletic competitions; a fun run or tournament stays here even when branded gear or apparel is also launched at it.",
    aliases: ['olahraga', 'lari']
  },
  FAMILY_AND_KIDS: {
    definition:
      "Activities and events for families and children, such as kids' play areas, parenting workshops, and family-friendly festivals.",
    aliases: ['anak', 'keluarga']
  },
  HOBBIES_AND_INTERESTS: {
    definition:
      'Recreational hobby pursuits, including esports and gaming tournaments, and plant collecting, contests, breeding, and gardening.',
    aliases: ['hobi', 'komunitas hobi']
  },
  BUSINESS_AND_NETWORKING: {
    definition: 'Trade, B2B, networking, entrepreneurship, property, and investment events, defined by subject matter rather than audience.',
    aliases: ['bisnis', 'networking']
  },
  HEALTH_AND_WELLNESS: {
    definition:
      'Wellness retreats, mental-health programs, and clinical aesthetic or medical treatments such as botox, laser, and dermatology.',
    aliases: ['kesehatan', 'klinik kecantikan']
  },
  HOLIDAY: {
    definition: 'Seasonal and holiday celebrations such as New Year, Eid, Christmas, and other calendar-based festive events.',
    aliases: ['libur', 'hari raya']
  },
  CHARITY_AND_CAUSES: {
    definition: 'Fundraisers, charity drives, and non-profit cause-driven events.',
    aliases: ['donasi', 'amal']
  },
  CIVIC_AND_COMMUNITY: {
    definition: 'Town halls, local government sessions, community meetups, and volunteering drives.',
    aliases: ['komunitas', 'warga']
  },
  RELIGION_AND_SPIRITUALITY: {
    definition: 'Worship services, religious retreats, and interfaith gatherings.',
    aliases: ['agama', 'rohani']
  },
  TECHNOLOGY: {
    definition: 'Tech product promos, hackathons, and tech meetups or conferences.',
    aliases: ['teknologi', 'startup']
  },
  TRAVEL_AND_TOURISM: {
    definition: 'Travel gear promos, travel fairs, and tourism expos.',
    aliases: ['wisata', 'pariwisata']
  },
  EDUCATION: {
    definition: 'Academic olympiads, school or university competitions, and other formal academic contests.',
    aliases: ['pendidikan', 'lomba akademik']
  },
  CAREER: {
    definition: 'Job fairs, recruitment events, and career-development workshops.',
    aliases: ['karir', 'bursa kerja']
  },
  AUTOMOTIVE: {
    definition: 'Car and motorcycle fairs or exhibitions, plus car and motorcycle accessories and tools.',
    aliases: ['otomotif', 'motor']
  },
  OTHER: {
    definition: 'No single subject applies, or no valid value could be determined for this event.',
    aliases: ['lainnya', 'lain-lain']
  }
};

export interface CategoryBoundaryRule {
  id: string;
  rule: string;
}

/**
 * AD-44 Rule 4/5: ordered boundary clarifications rendered after the per-category glossary lines.
 * Each rule is self-contained prose naming only real `EventCategory`/`EventType` members (the
 * ratchet's Check B enforces this).
 */
export const CATEGORY_BOUNDARIES: readonly CategoryBoundaryRule[] = [
  {
    id: 'cardinality',
    rule:
      'Select at most 4 categories per event; never select OTHER together with another category -- choose OTHER alone only when no other category applies.'
  },
  {
    id: 'business-networking-property',
    rule:
      'Property/KPR-mortgage expos or seminars route to BUSINESS_AND_NETWORKING by subject, regardless of audience -- named routing wins over the subject-of-sale default.'
  },
  {
    id: 'business-networking-machinery',
    rule: 'Machinery for factories or production lines routes to BUSINESS_AND_NETWORKING.'
  },
  {
    id: 'business-networking-umkm-exclusion',
    rule:
      '"UMKM", "support local", or a seller workshop alone do not trigger BUSINESS_AND_NETWORKING -- a stated trade, buyer, B2B, franchise, supplier, or business-matching purpose is required.'
  },
  {
    id: 'hobbies-esports',
    rule: 'Esports and gaming tournaments route to HOBBIES_AND_INTERESTS.'
  },
  {
    id: 'hobbies-plants',
    rule:
      'Plant collecting, contests, breeding, and gardening route to HOBBIES_AND_INTERESTS; tag the headline subject only when a plant fair mixes hobby framing with other framing.'
  },
  {
    id: 'arts-heritage',
    rule: 'Batik, tenun, and wastra heritage textile events route to ARTS_AND_CULTURE.'
  },
  {
    id: 'health-clinical-aesthetic',
    rule: 'Clinical aesthetic or medical treatments (botox, laser, dermatology) route to HEALTH_AND_WELLNESS.'
  },
  {
    id: 'sports-branded-gear',
    rule: 'A participatory sport event (fun run, tournament) keeps SPORTS_AND_FITNESS even when branded gear or apparel is also launched at it.'
  },
  {
    id: 'other-no-single-subject',
    rule:
      'OTHER applies when there is no single subject (for example a mall-wide sale spanning many unrelated subjects with no single headline) or no valid value can be determined.'
  }
];
