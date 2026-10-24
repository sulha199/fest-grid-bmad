import { EventCategory } from '@festgrid/shared-types';

/**
 * Story 0.52/0.53 (AD-44 Rule 10, AC7/AC12). The 12 (plus one optional bonus) Indonesian-language
 * posts from `reviews/review-adversarial-pair.md` §2 ("Ten (plus two) realistic Indonesian posts
 * against Rule 4"), re-derived against AD-44's REWRITTEN Rule 5 (ordered boundary procedure,
 * cap-4, OTHER-exclusivity) and the full 22-value taxonomy -- see
 * `0-53-add-home-living-fashion-finance-and-gadget-event-categories.md`'s Dev Notes ("Golden
 * category corpus re-derivation for the 22-value taxonomy") for the full per-row rationale and
 * confidence notes, and `0-52-build-the-event-category-definitions-source-renderer-and-ratchet.md`'s
 * Dev Notes for the original 18-value-interim derivation this one supersedes.
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
  /** Categories the extraction is expected to include, under the 22-value taxonomy. */
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
    expected: [EventCategory.FINANCE_AND_INVESTMENT],
    mustNotInclude: [EventCategory.BUSINESS_AND_NETWORKING, EventCategory.OTHER],
    rationale:
      'Rule 5: named routing wins -- property/KPR routes to FINANCE_AND_INVESTMENT regardless of audience. Flips from Story 0.52\'s interim BUSINESS_AND_NETWORKING routing, which is now an explicit mustNotInclude.'
  },
  {
    id: '2-furniture-trade-fair',
    caption: 'Jogja Furniture & Craft Fair: Trade Day 12-13 Nov (buyer & eksportir), Public Day 14-16 Nov',
    expected: [EventCategory.HOME_AND_LIVING, EventCategory.BUSINESS_AND_NETWORKING],
    mustNotInclude: [EventCategory.OTHER],
    rationale:
      'Furniture now routes to HOME_AND_LIVING; "Trade Day (buyer & eksportir)" is a directly stated buyer/exporter purpose, satisfying Rule 5.3\'s bar for BUSINESS_AND_NETWORKING. No longer OTHER/confirm-on-first-live-run -- HOME_AND_LIVING resolves the prior ambiguity.'
  },
  {
    id: '3-umkm-bazaar',
    caption:
      "Bazar UMKM Lebaran: kuliner, kriya, fashion muslim, 30 tenant binaan Pemkot, Atrium Hartono Mall, 12-20 Maret. Free workshop 'UMKM Go Digital' tiap Sabtu",
    expected: [EventCategory.FOOD_AND_DRINK, EventCategory.ARTS_AND_CULTURE, EventCategory.FASHION_AND_BEAUTY],
    mustNotInclude: [EventCategory.BUSINESS_AND_NETWORKING, EventCategory.OTHER],
    rationale:
      'Gains a third tag: "fashion muslim" now routes to FASHION_AND_BEAUTY. Rule 5.3: "UMKM"/a seller workshop alone still does NOT trigger BUSINESS_AND_NETWORKING, unaffected by this story.'
  },
  {
    id: '4-gadget-roadshow-esports',
    caption:
      'Erafone x ASUS ROG Roadshow: laptop gaming s.d. 3jt, trade-in HP, mini turnamen Mobile Legends hadiah 5jt, Lippo Plaza',
    expected: [EventCategory.GADGETS_AND_DEVICES, EventCategory.HOBBIES_AND_INTERESTS],
    mustNotInclude: [EventCategory.TECHNOLOGY, EventCategory.OTHER],
    rationale:
      'Flips TECHNOLOGY -> GADGETS_AND_DEVICES for the consumer-gadget content (laptop gaming, HP trade-in); esports stays HOBBIES_AND_INTERESTS. TECHNOLOGY moves from expected to mustNotInclude -- the sharpest test of the TECHNOLOGY-narrows / GADGETS_AND_DEVICES-launch boundary.'
  },
  {
    id: '5-fashion-week-heritage-textile',
    caption: "Jogja Fashion Week 'Wastra Nusantara': 40 desainer lokal, batik & tenun, runway, buyer meeting hari ke-2, live music",
    expected: [EventCategory.ARTS_AND_CULTURE, EventCategory.FASHION_AND_BEAUTY, EventCategory.BUSINESS_AND_NETWORKING],
    mustNotInclude: [EventCategory.OTHER],
    rationale:
      'Gains a tag: the post\'s own "runway" is the arts-heritage boundary\'s stated trigger for a FASHION_AND_BEAUTY co-tag alongside heritage-textile ARTS_AND_CULTURE; the buyer meeting still gives BUSINESS_AND_NETWORKING. 3 tags, within cap 4. "Live music" (MUSIC) stays a soft-miss note, unchanged.'
  },
  {
    id: '6-barbershop-grand-opening',
    caption: "Grand Opening Gentleman's Barbershop Sleman: potong + hairwash 25rb, free kopi, 1 minggu",
    expected: [EventCategory.FASHION_AND_BEAUTY],
    mustNotInclude: [EventCategory.OTHER],
    rationale: 'Flips from OTHER to FASHION_AND_BEAUTY -- barbershop/grooming is named explicitly in the new boundary entry.'
  },
  {
    id: '7-power-tools-roadshow',
    caption:
      'Makita Power Tools Roadshow: demo bor, gerinda; diskon 30% untuk tukang & kontraktor; workshop pasang keramik; Toko Bangunan Jaya Abadi, Bantul',
    expected: [EventCategory.HOME_AND_LIVING],
    mustNotInclude: [EventCategory.BUSINESS_AND_NETWORKING, EventCategory.OTHER],
    rationale:
      'Flips from OTHER to HOME_AND_LIVING -- tools sold to tradespeople (tukang, kontraktor) is named explicitly in the new boundary. BUSINESS_AND_NETWORKING stays excluded: a professional customer SEGMENT alone (not a stated trade/B2B purpose) never triggers it.'
  },
  {
    id: '8-plant-fair-contest',
    caption: 'Pameran Tanaman Hias & Kontes Aglaonema, Jogja Expo Center, jual tanaman, pot, media tanam, lomba kolektor, 3 hari',
    expected: [EventCategory.HOBBIES_AND_INTERESTS],
    mustNotInclude: [EventCategory.OTHER, EventCategory.HOME_AND_LIVING],
    rationale:
      'Unchanged expected (contest/collecting framing, not decor framing, keeps this at HOBBIES_AND_INTERESTS alone), but HOME_AND_LIVING is now an explicit mustNotInclude now that the decor exception exists and could tempt a co-tag.'
  },
  {
    id: '9-mall-multi-brand-sale',
    caption: 'MID YEAR SALE Hartono Mall: diskon s.d. 70% fashion, elektronik, home living, kuliner, gratis parkir, 1-30 Juni',
    expected: [EventCategory.OTHER],
    mustNotInclude: [
      EventCategory.TECHNOLOGY,
      EventCategory.FOOD_AND_DRINK,
      EventCategory.GADGETS_AND_DEVICES,
      EventCategory.HOME_AND_LIVING,
      EventCategory.FASHION_AND_BEAUTY
    ],
    rationale:
      'Rule 5.4: unchanged expected (OTHER -- no single headline subject), but now a much sharper test: the caption literally names "fashion," "elektronik," and "home living," each with a real category -- the single most important regression check for the cap/OTHER-exclusivity-for-no-headline rule.'
  },
  {
    id: '10-sneaker-launch-fun-run',
    caption: 'Nike Run Club x Pakuwon: launch Pegasus 42, 5K fun run, goodie bag, 24 Nov',
    expected: [EventCategory.SPORTS_AND_FITNESS],
    mustNotInclude: [EventCategory.OTHER, EventCategory.FASHION_AND_BEAUTY],
    rationale:
      'Unchanged expected, but FASHION_AND_BEAUTY is now an explicit mustNotInclude -- sneakers are named directly in the new boundary ("sneakers, also sport-branded"), the direct test that a participatory sport event keeps SPORTS_AND_FITNESS even though the launched product now has its own category.'
  },
  {
    id: '11-wedding-expo',
    caption: 'Jogja Wedding Expo: 60 vendor gedung, katering, rias, busana, dekorasi, paket hemat',
    expected: [EventCategory.OTHER],
    mustNotInclude: [EventCategory.FOOD_AND_DRINK, EventCategory.FASHION_AND_BEAUTY, EventCategory.HOME_AND_LIVING],
    rationale:
      'Unchanged expected, but promoted to CONFIRM ON FIRST LIVE RUN (was Firm pre-0.53): "busana"/"rias" and "dekorasi" now each have a real category, so the wedding-services-expo boundary\'s "dominant subject category if one clearly exists" clause is now genuinely contestable. If the live run disagrees, adjust the fixture, not the prompt.'
  },
  {
    id: '12-cosmetics-launch-makeup-class',
    caption: 'Launching Wardah Colorfit di Jogja City Mall: meet & greet, makeup class, doorprize, 12 Okt',
    expected: [EventCategory.FASHION_AND_BEAUTY],
    mustNotInclude: [EventCategory.OTHER, EventCategory.EDUCATION],
    rationale:
      'Flips from OTHER to FASHION_AND_BEAUTY -- cosmetics is named directly in the new boundary. EDUCATION stays excluded (the "class" is a brand promo activity, not an academic competition), unaffected by this story.'
  },
  // Bonus 13th fixture, optional -- AD-44 Rule 10 names "twelve" as the official corpus.
  {
    id: '6b-bonus-aesthetic-clinic',
    caption: 'Promo Glow Up Clinic: facial, botox, laser rejuvenation 50%, 17-19 Agustus',
    expected: [EventCategory.HEALTH_AND_WELLNESS],
    mustNotInclude: [EventCategory.OTHER, EventCategory.FASHION_AND_BEAUTY],
    rationale:
      'Unchanged expected, but FASHION_AND_BEAUTY is now an explicit mustNotInclude -- "facial" is skincare-adjacent and FASHION_AND_BEAUTY now exists, making the clinical-aesthetic exception (explicitly preserved in the new boundary entry) a sharper test than before.'
  }
];
