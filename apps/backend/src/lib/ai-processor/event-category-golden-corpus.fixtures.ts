import { EventCategory } from '@festgrid/shared-types';

/**
 * Story 0.52 (AD-44 Rule 10, AC7). The 12 (plus one optional bonus) Indonesian-language posts
 * from `reviews/review-adversarial-pair.md` §2 ("Ten (plus two) realistic Indonesian posts
 * against Rule 4"), re-derived against AD-44's REWRITTEN Rule 5 (ordered boundary procedure,
 * cap-4, OTHER-exclusivity) and THIS STORY'S 18-value interim taxonomy -- see
 * `0-52-build-the-event-category-definitions-source-renderer-and-ratchet.md`'s Dev Notes
 * ("Golden category corpus derivation") for the full per-row rationale and confidence notes.
 *
 * Wherever the review's original table depended on `HOME_AND_LIVING`/`FASHION_AND_BEAUTY`/
 * `FINANCE_AND_INVESTMENT` (Story 0.53's values, not yet built), this story's interim `expected`
 * is `OTHER` instead -- an accepted, documented interim effect (AD-44 Follow-up 1), not a defect.
 *
 * Consumed only by the opt-in `event-category-golden-corpus.live-eval.test.ts` (gated by
 * RUN_LIVE_GEMINI_TESTS=true) -- never part of the default CI test run (AD-44 Rule 10: "a manual
 * or nightly step... never a CI gate").
 */

export interface EventCategoryGoldenFixture {
  /** Short, stable id for reporting (matches the review table's row number). */
  id: string;
  /** The post caption text, verbatim from the source review (or its sketch). */
  caption: string;
  /** Categories the extraction is expected to include, under this story's 18-value taxonomy. */
  expected: EventCategory[];
  /** Categories the extraction must NOT include. */
  mustNotInclude: EventCategory[];
  /** Which AD-44 Rule 5 clause this fixture tests, and why. */
  rationale: string;
}

export const EVENT_CATEGORY_GOLDEN_CORPUS: readonly EventCategoryGoldenFixture[] = [
  {
    id: '1-property-expo',
    caption: 'PAMERAN PROPERTI JOGJA 2026: KPR DP 0%, 40+ developer, bunga fix 3,5%, gratis masuk, JEC 14-17 Nov. Hadiah umroh!',
    expected: [EventCategory.BUSINESS_AND_NETWORKING],
    mustNotInclude: [EventCategory.OTHER],
    rationale: 'Rule 5: named routing wins -- property/KPR routes to BUSINESS_AND_NETWORKING regardless of audience.'
  },
  {
    id: '2-furniture-trade-fair',
    caption: 'Jogja Furniture & Craft Fair: Trade Day 12-13 Nov (buyer & eksportir), Public Day 14-16 Nov',
    expected: [EventCategory.OTHER],
    mustNotInclude: [],
    rationale:
      'Furniture has no category among the 18 (deferred to Story 0.53 as HOME_AND_LIVING); a retail/consumer fair with no qualifying category is OTHER. CONFIRM ON FIRST LIVE RUN -- a reading where the stated trade day alone triggers BUSINESS_AND_NETWORKING is also plausible.'
  },
  {
    id: '3-umkm-bazaar',
    caption:
      "Bazar UMKM Lebaran: kuliner, kriya, fashion muslim, 30 tenant binaan Pemkot, Atrium Hartono Mall, 12-20 Maret. Free workshop 'UMKM Go Digital' tiap Sabtu",
    expected: [EventCategory.FOOD_AND_DRINK, EventCategory.ARTS_AND_CULTURE],
    mustNotInclude: [EventCategory.BUSINESS_AND_NETWORKING, EventCategory.OTHER],
    rationale:
      'Rule 5.3: "UMKM"/a seller workshop alone does NOT trigger BUSINESS_AND_NETWORKING; subject-of-sale applies for the named subjects that do have a category (kuliner, kriya).'
  },
  {
    id: '4-gadget-roadshow-esports',
    caption:
      'Erafone x ASUS ROG Roadshow: laptop gaming s.d. 3jt, trade-in HP, mini turnamen Mobile Legends hadiah 5jt, Lippo Plaza',
    expected: [EventCategory.TECHNOLOGY, EventCategory.HOBBIES_AND_INTERESTS],
    mustNotInclude: [EventCategory.OTHER],
    rationale:
      'Consumer gadget promos stay under TECHNOLOGY (unchanged, unwidened -- Story 0.53 moves this to GADGETS_AND_DEVICES); esports routes to HOBBIES_AND_INTERESTS (owner default). SPORTS_AND_FITNESS appearing alongside is a soft miss, not a hard failure.'
  },
  {
    id: '5-fashion-week-heritage-textile',
    caption: "Jogja Fashion Week 'Wastra Nusantara': 40 desainer lokal, batik & tenun, runway, buyer meeting hari ke-2, live music",
    expected: [EventCategory.ARTS_AND_CULTURE, EventCategory.BUSINESS_AND_NETWORKING],
    mustNotInclude: [EventCategory.OTHER],
    rationale:
      'Batik/tenun heritage routes to ARTS_AND_CULTURE; the stated buyer meeting is a trade purpose -> BUSINESS_AND_NETWORKING. CONFIRM ON FIRST LIVE RUN -- "live music" is a minor incidental detail the model may or may not add (MUSIC); treat that alone as a soft miss.'
  },
  {
    id: '6-barbershop-grand-opening',
    caption: "Grand Opening Gentleman's Barbershop Sleman: potong + hairwash 25rb, free kopi, 1 minggu",
    expected: [EventCategory.OTHER],
    mustNotInclude: [],
    rationale: 'Barbershop/grooming has no category among the 18 (deferred to Story 0.53 as FASHION_AND_BEAUTY).'
  },
  {
    id: '7-power-tools-roadshow',
    caption:
      'Makita Power Tools Roadshow: demo bor, gerinda; diskon 30% untuk tukang & kontraktor; workshop pasang keramik; Toko Bangunan Jaya Abadi, Bantul',
    expected: [EventCategory.OTHER],
    mustNotInclude: [EventCategory.BUSINESS_AND_NETWORKING],
    rationale:
      'Consumer/tradesperson tools has no category among the 18 (deferred to Story 0.53 as HOME_AND_LIVING); a discount targeting a professional customer SEGMENT is not itself a stated trade/B2B/buyer/franchise/supplier/business-matching purpose (Rule 5.3) -- audience alone never triggers BUSINESS_AND_NETWORKING.'
  },
  {
    id: '8-plant-fair-contest',
    caption: 'Pameran Tanaman Hias & Kontes Aglaonema, Jogja Expo Center, jual tanaman, pot, media tanam, lomba kolektor, 3 hari',
    expected: [EventCategory.HOBBIES_AND_INTERESTS],
    mustNotInclude: [EventCategory.OTHER],
    rationale: 'Plants as collecting/contest route to HOBBIES_AND_INTERESTS; no decorative-as-decor co-tag (that needs HOME_AND_LIVING, deferred).'
  },
  {
    id: '9-mall-multi-brand-sale',
    caption: 'MID YEAR SALE Hartono Mall: diskon s.d. 70% fashion, elektronik, home living, kuliner, gratis parkir, 1-30 Juni',
    expected: [EventCategory.OTHER],
    mustNotInclude: [EventCategory.TECHNOLOGY, EventCategory.FOOD_AND_DRINK],
    rationale:
      'Rule 5.4: a sale spanning many unrelated subjects with no single headline is OTHER -- the direct test of the cap/OTHER-exclusivity fix against fragmenting a mall-wide sale into its named sub-parts.'
  },
  {
    id: '10-sneaker-launch-fun-run',
    caption: 'Nike Run Club x Pakuwon: launch Pegasus 42, 5K fun run, goodie bag, 24 Nov',
    expected: [EventCategory.SPORTS_AND_FITNESS],
    mustNotInclude: [EventCategory.OTHER],
    rationale: 'A participatory sport event keeps SPORTS_AND_FITNESS even when a shoe/apparel is launched at it (explicit exception, no FASHION_AND_BEAUTY needed).'
  },
  {
    id: '11-wedding-expo',
    caption: 'Jogja Wedding Expo: 60 vendor gedung, katering, rias, busana, dekorasi, paket hemat',
    expected: [EventCategory.OTHER],
    mustNotInclude: [EventCategory.FOOD_AND_DRINK],
    rationale:
      'A wedding/bridal expo with no single dominant subject among the 18 is OTHER -- tests that the model does not over-grab the one incidental existing category (catering) when the actually-dominant subjects (bridal wear, decor) have no category yet.'
  },
  {
    id: '12-cosmetics-launch-makeup-class',
    caption: 'Launching Wardah Colorfit di Jogja City Mall: meet & greet, makeup class, doorprize, 12 Okt',
    expected: [EventCategory.OTHER],
    mustNotInclude: [EventCategory.EDUCATION],
    rationale:
      'Cosmetics has no category among the 18 (deferred to Story 0.53 as FASHION_AND_BEAUTY); "class" here is a brand promo activity, not an academic competition (EDUCATION\'s actual scope).'
  },
  // Bonus 13th fixture, optional -- AD-44 Rule 10 names "twelve" as the official corpus.
  {
    id: '6b-bonus-aesthetic-clinic',
    caption: 'Promo Glow Up Clinic: facial, botox, laser rejuvenation 50%, 17-19 Agustus',
    expected: [EventCategory.HEALTH_AND_WELLNESS],
    mustNotInclude: [EventCategory.OTHER],
    rationale: 'Clinical aesthetic treatment routes to HEALTH_AND_WELLNESS (explicit exception, survives without FASHION_AND_BEAUTY existing).'
  }
];
