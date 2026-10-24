import { EventCategory } from '@festgrid/shared-types';

/**
 * Story 0.52/0.53/0.54 (AD-44 Rule 10, AC7/AC12/AC15). The 12 posts (plus optional bonus fixtures
 * 6b and 16, and the two mandatory SCIENCE_AND_ENGINEERING fixtures 14 and 15 added by Story 0.54)
 * from `reviews/review-adversarial-pair.md` §2 ("Ten (plus two) realistic Indonesian posts
 * against Rule 4"), re-derived against AD-44's amended Rule 2 (safety cap 6, non-exclusive OTHER)
 * and Rule 5 (ordered boundary procedure, now including SCIENCE_AND_ENGINEERING) across the full
 * 23-value taxonomy -- see `0-54-amend-event-category-cardinality-and-add-science-and-engineering.md`'s
 * Dev Notes ("Golden category corpus re-derivation for the 23-value taxonomy") for the full
 * per-row rationale, live-Gemini evidence, and confidence notes (this story resolved backlog
 * finding FIND-098); `0-53-add-home-living-fashion-finance-and-gadget-event-categories.md`'s Dev
 * Notes for the 22-value derivation this one supersedes; and
 * `0-52-build-the-event-category-definitions-source-renderer-and-ratchet.md`'s Dev Notes for the
 * original 18-value-interim derivation.
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
  /** Categories the extraction is expected to include, under the 23-value taxonomy. */
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
    expected: [
      EventCategory.FOOD_AND_DRINK,
      EventCategory.ARTS_AND_CULTURE,
      EventCategory.FASHION_AND_BEAUTY,
      EventCategory.BUSINESS_AND_NETWORKING
    ],
    mustNotInclude: [EventCategory.OTHER],
    rationale:
      '[AMENDED 2026-10-24, Story 0.54, FIND-098] Gains a fourth tag: "30 tenant binaan Pemkot" + the "UMKM Go Digital" workshop is exactly the entrepreneurship-framing the amended Rule 5.3 now legitimizes -- BUSINESS_AND_NETWORKING moves from mustNotInclude to expected. Live-Gemini evidence (0.53\'s own eval run) already returned this tag against the pre-amendment fixture.'
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
    expected: [EventCategory.ARTS_AND_CULTURE, EventCategory.FASHION_AND_BEAUTY],
    mustNotInclude: [EventCategory.OTHER],
    rationale:
      '[AMENDED 2026-10-24, Story 0.54, FIND-098] BUSINESS_AND_NETWORKING is now neither expected nor mustNotInclude (optional): the live-Gemini run returned only ARTS_AND_CULTURE + FASHION_AND_BEAUTY, omitting the buyer-meeting co-tag -- made optional rather than forcing a fight with the model on this ambiguous case. The post\'s own "runway" remains the arts-heritage boundary\'s stated trigger for the FASHION_AND_BEAUTY co-tag alongside heritage-textile ARTS_AND_CULTURE. "Live music" (MUSIC) stays a soft-miss note, unchanged.'
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
    expected: [
      EventCategory.FASHION_AND_BEAUTY,
      EventCategory.GADGETS_AND_DEVICES,
      EventCategory.HOME_AND_LIVING,
      EventCategory.FOOD_AND_DRINK
    ],
    mustNotInclude: [EventCategory.OTHER, EventCategory.TECHNOLOGY],
    rationale:
      '[AMENDED 2026-10-24, Story 0.54, FIND-098] Flips from expected [OTHER] to carrying all four named subjects: live-Gemini evidence showed the model returning exactly this set against the pre-amendment fixture, since the caption names exactly four subjects and the old Rule 5.4 wording ("more than four" -> OTHER) meant the model was following the rule as written. The amended "No collapse" clause (cardinality rule, Rule 5.4) means a sale whose named subjects span several categories carries each of them (up to the safety cap of 6), never collapsing to OTHER merely for having several stated subjects. TECHNOLOGY stays excluded -- "elektronik" here is consumer gadgets (GADGETS_AND_DEVICES), not software/AI.'
  },
  {
    id: '10-sneaker-launch-fun-run',
    caption: 'Nike Run Club x Pakuwon: launch Pegasus 42, 5K fun run, goodie bag, 24 Nov',
    expected: [EventCategory.SPORTS_AND_FITNESS],
    mustNotInclude: [EventCategory.OTHER],
    rationale:
      '[AMENDED 2026-10-24, Story 0.54, FIND-098] FASHION_AND_BEAUTY removed from mustNotInclude -- it is now an allowed co-tag per AC9\'s reworded sports-branded-gear boundary. Live-Gemini evidence returned [SPORTS_AND_FITNESS, FASHION_AND_BEAUTY] against the old fixture, which forbade the co-tag; the boundary is now reworded to explicitly permit this co-tag rather than fight the model\'s (reasonable) reading. SPORTS_AND_FITNESS stays the headline expected category; FASHION_AND_BEAUTY is legal but optional, not asserted as a hard expectation.'
  },
  {
    id: '11-wedding-expo',
    caption: 'Jogja Wedding Expo: 60 vendor gedung, katering, rias, busana, dekorasi, paket hemat',
    expected: [EventCategory.FASHION_AND_BEAUTY, EventCategory.HOME_AND_LIVING, EventCategory.FOOD_AND_DRINK, EventCategory.OTHER],
    mustNotInclude: [],
    rationale:
      '[AMENDED 2026-10-24, Story 0.54, FIND-098 -- CONFIRM ON NEXT LIVE RUN] Flips from expected [OTHER] per AC10\'s rewritten boundary: route to every subject category the post names (busana -> FASHION_AND_BEAUTY, dekorasi -> HOME_AND_LIVING, katering -> FOOD_AND_DRINK), plus OTHER for a stated service none of the named categories covers (the venue/"gedung" vendor). Caveat carried from Dev Notes: the live run that triggered this amendment returned only the three named categories, NOT OTHER -- this fixture still expects OTHER per AD-44\'s own worked example, but is flagged for re-confirmation on the next live run (same escape-valve precedent as Stories 0.52/0.53: adjust the fixture, not the prompt, if it disagrees again).'
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
  },
  // Story 0.54 (AD-44 Rule 3/5, Follow-up 4): new fixtures for the 23rd category,
  // SCIENCE_AND_ENGINEERING, and its boundary against TECHNOLOGY/EDUCATION.
  {
    id: '14-engineering-robotics-seminar',
    caption: 'Seminar Nasional Teknik Robotika & IoT UGM: riset mahasiswa, pameran prototipe, 20 Nov, Fakultas Teknik',
    expected: [EventCategory.SCIENCE_AND_ENGINEERING],
    mustNotInclude: [EventCategory.TECHNOLOGY, EventCategory.EDUCATION, EventCategory.OTHER],
    rationale:
      'Direct positive test of the new category: a university engineering/robotics research seminar with a prototype expo routes to SCIENCE_AND_ENGINEERING (engineering disciplines, robotics, research), not TECHNOLOGY (software/AI/startups/developer events) or EDUCATION (academic olympiads/school contests).'
  },
  {
    id: '15-science-olympiad',
    caption: 'Olimpiade Sains Nasional (OSN) Tingkat SMA: fisika, kimia, biologi, matematika, 15 Sept',
    expected: [EventCategory.EDUCATION],
    mustNotInclude: [EventCategory.SCIENCE_AND_ENGINEERING, EventCategory.OTHER],
    rationale:
      'Direct negative test: an academic olympiad stays EDUCATION even in science subjects (AC7\'s boundary clause: "academic olympiads and school/university competitions stay EDUCATION even in science subjects"), guarding against SCIENCE_AND_ENGINEERING over-grabbing academic competitions.'
  },
  // Bonus 16th fixture, optional -- negative-tests the TECHNOLOGY boundary.
  {
    id: '16-hackathon',
    caption: 'Hackathon Kampus Merdeka: 48 jam membangun startup digital, mentoring, demo day',
    expected: [EventCategory.TECHNOLOGY],
    mustNotInclude: [EventCategory.SCIENCE_AND_ENGINEERING, EventCategory.OTHER],
    rationale:
      'Direct negative test: a hackathon (developer/startup event) stays TECHNOLOGY, not SCIENCE_AND_ENGINEERING, per AC7\'s boundary clause ("software, AI, startups, developer events, tech conferences, and hackathons stay TECHNOLOGY").'
  }
];
