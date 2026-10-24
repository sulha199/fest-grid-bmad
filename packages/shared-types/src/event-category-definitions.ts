// Type-only import, deliberately: `index.ts` will re-export this module (AD-44 Rule 3's "Binds"
// clause names this file explicitly, rather than defining definitions beside the enum), which
// would create a runtime import cycle if this file imported `EventCategory` as a VALUE. A
// type-only import is erased entirely by the compiler/bundler, so there is no runtime edge here
// -- only a compile-time one, which is exactly what we want for the exhaustiveness check below.
import type { EventCategory } from './index';

/**
 * Story 0.52 (AD-44 Rule 3/4). This module is the ONE source of prose definitions for
 * `EventCategory`, consumed by `renderEventCategoryGlossary()` (apps/backend/src/lib/ai-gateway/)
 * to build both the extraction prompt and the AI-filter prompt. Every string here is LLM-facing
 * English text only -- it is NEVER rendered in any UI. User-facing enum labels still go through
 * next-intl locale files (see `project-context.md`'s "Locale-Sensitive Data Rendering" rule);
 * this file has no relationship to that pipeline.
 *
 * Scope: the 23-value taxonomy AD-44 adopted (Story 0.52's 18-value interim set, plus Story 0.53's
 * `HOME_AND_LIVING`, `FASHION_AND_BEAUTY`, `FINANCE_AND_INVESTMENT`, and `GADGETS_AND_DEVICES`,
 * plus Story 0.54's `SCIENCE_AND_ENGINEERING`). Story 0.54 (AD-44 Follow-up 4) also amended the
 * cardinality rule from cap-4/OTHER-exclusive to a safety cap of 6 real categories with
 * non-exclusive OTHER (kept and moved last, never dropped).
 * Only real `EventCategory`/`EventType` members may be named anywhere in this file -- not in a
 * definition, not in a boundary rule, not even in a comment like this one -- the ratchet test's
 * Check B fails loudly if any forward-reference token (or a typo of a real member) ever appears
 * in this file.
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
    definition: 'Trade, B2B, networking, and entrepreneurship events, defined by subject matter rather than audience.',
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
    definition: 'Software, apps, AI, startups, developer and tech-community events, hackathons, and tech conferences.',
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
  HOME_AND_LIVING: {
    definition: 'Furniture, appliances, decor, interior design, housewares, home-improvement products, and consumer or tradesperson tools.',
    aliases: ['rumah tangga', 'interior']
  },
  FASHION_AND_BEAUTY: {
    definition: 'Fashion, apparel, sneakers, barbershop and grooming, skincare, and cosmetics.',
    aliases: ['gaya', 'kecantikan']
  },
  FINANCE_AND_INVESTMENT: {
    definition:
      'Property and real-estate expos, KPR/mortgage events, and stock, mutual-fund, bond, gold, crypto, forex, or commodity trading or investing events.',
    aliases: ['investasi', 'keuangan']
  },
  GADGETS_AND_DEVICES: {
    definition: 'Consumer electronics, phones, laptops, audio, cameras, wearables, and gaming gear, including their launches, promos, and expos.',
    aliases: ['gadget', 'elektronik']
  },
  SCIENCE_AND_ENGINEERING: {
    definition:
      'Engineering disciplines and hardware (civil, mechanical, electrical, robotics, IoT), scientific research seminars and conferences, science and maker expos, and invention or innovation showcases.',
    aliases: ['teknik', 'rekayasa', 'riset', 'inovasi', 'sains']
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
      '[AMENDED 2026-10-24] Name every category whose subject the post states, headline subject first -- never collapse a multi-subject post into OTHER to save tags. OTHER is non-exclusive and may sit alongside real categories (added only for a stated subject none of them covers) or alone when nothing applies. Real categories beyond the first 6 named are dropped automatically, in listed order.'
  },
  {
    id: 'finance-investment-property-and-trading',
    rule:
      'Property/KPR-mortgage expos or seminars, and stock, mutual-fund, bond, gold, crypto, forex, or commodity trading-or-investing events, route to FINANCE_AND_INVESTMENT by subject, regardless of audience -- named routing wins over the subject-of-sale default.'
  },
  {
    id: 'finance-investment-home-expo-dual-tag',
    rule:
      'A home expo that also lists properties for sale may carry both HOME_AND_LIVING and FINANCE_AND_INVESTMENT, headline subject first; furniture, decor, and appliances stay HOME_AND_LIVING.'
  },
  {
    id: 'business-networking-machinery',
    rule: 'Machinery for factories or production lines routes to BUSINESS_AND_NETWORKING.'
  },
  {
    id: 'business-networking-umkm-exclusion',
    rule:
      '[AMENDED 2026-10-24] A bare "support local" or UMKM bazaar with no entrepreneurship or trade framing does not trigger BUSINESS_AND_NETWORKING. BUSINESS_AND_NETWORKING now also applies when the post frames entrepreneurship -- incubated tenants ("binaan"), UMKM business-skills or "go digital" workshops, or franchise or reseller recruitment -- alongside the product categories named, in addition to a stated trade, buyer, B2B, franchise, supplier, or business-matching purpose.'
  },
  {
    id: 'hobbies-esports',
    rule: 'Esports and gaming tournaments route to HOBBIES_AND_INTERESTS.'
  },
  {
    id: 'hobbies-plants',
    rule:
      'Plant collecting, contests, breeding, and gardening route to HOBBIES_AND_INTERESTS; tag the headline subject only when a plant fair mixes hobby framing with other framing; decorative planting sold as home decor routes to HOME_AND_LIVING instead.'
  },
  {
    id: 'arts-heritage',
    rule:
      'Batik, tenun, and wastra heritage textile events route to ARTS_AND_CULTURE, plus FASHION_AND_BEAUTY only when a runway or apparel sale is the headline.'
  },
  {
    id: 'health-clinical-aesthetic',
    rule: 'Clinical aesthetic or medical treatments (botox, laser, dermatology) route to HEALTH_AND_WELLNESS.'
  },
  {
    id: 'sports-branded-gear',
    rule:
      'A participatory sport event (fun run, tournament) keeps SPORTS_AND_FITNESS as the headline category even when branded gear or apparel is also launched at it -- FASHION_AND_BEAUTY is a valid co-tag when a shoe or apparel launch is explicitly stated.'
  },
  {
    id: 'other-no-single-subject',
    rule:
      'OTHER applies when there is no single subject (for example a mall-wide sale spanning many unrelated subjects with no single headline) or no valid value can be determined.'
  },
  {
    id: 'gadgets-and-devices',
    rule:
      'Consumer gadgets, phones, laptops, audio, cameras, wearables, and gaming gear route to GADGETS_AND_DEVICES; software, AI, startups, developer events, hackathons, and tech conferences stay TECHNOLOGY; a device-and-software launch may carry both, headline first.'
  },
  {
    id: 'home-living-tools-and-furniture',
    rule:
      'Furniture, appliances, decor, interior, housewares, home-improvement products, and tools sold to consumers or tradespeople (tukang, kontraktor) route to HOME_AND_LIVING.'
  },
  {
    id: 'fashion-and-beauty',
    rule:
      'Fashion, sneakers (including sport-branded), barbershop, grooming, skincare, and cosmetics route to FASHION_AND_BEAUTY; clinical aesthetic or medical treatments still route to HEALTH_AND_WELLNESS, and a participatory sport event still keeps SPORTS_AND_FITNESS.'
  },
  {
    id: 'automotive-unaffected',
    rule: 'Car and motorcycle fairs, exhibitions, accessories, and tools stay AUTOMOTIVE, unaffected by the newer categories.'
  },
  {
    id: 'wedding-services-expo',
    rule:
      '[AMENDED 2026-10-24] Wedding, bridal, and similar-services expos route to every subject category the post names (for example FASHION_AND_BEAUTY, HOME_AND_LIVING, FOOD_AND_DRINK), plus OTHER for a stated service none of the named categories covers (for example venues).'
  },
  {
    id: 'science-and-engineering',
    rule:
      'Engineering, research, maker, and invention content routes to SCIENCE_AND_ENGINEERING; software, AI, startups, developer events, tech conferences, and hackathons stay TECHNOLOGY; academic olympiads and school or university competitions stay EDUCATION even in science subjects; machinery sold to factories or production lines stays BUSINESS_AND_NETWORKING (see business-networking-machinery above).'
  }
];
