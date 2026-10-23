---
title: Adversarial pair review of AD-44 (EventCategory closed subject taxonomy)
date: 2026-10-23
reviewer: independent adversarial architecture reviewer (read-only, one review file)
subject: Architecture Spine AD-44, project-context.md "Event categories" rule, event-category-review-2026-10-23.md
method: "construct two units that obey every Rule to the letter and still build incompatibly"; 10 realistic Indonesian posts run against Rule 4; Rules 5, 6, 7 attacked
---

# Verdict

AD-44 picks the right taxonomy (subject domains, audience-neutral, no `LIFESTYLE`/bare `TOOL`) and the right single-source idea, but as written it does NOT deliver its own stated goal ("two units tagging the same post differently"). Its enforcement is an existence check (every value has a non-empty string); its boundary rules contradict each other on exactly the posts Indonesian Instagram produces most (property, trade-and-public expos, UMKM bazaars, mall multi-brand sales, tradesperson tool roadshows); and Rules 5-7 rest on a measurement that cannot be taken and a "no backfill" premise the repo already contradicts. Nine of the twelve boundary cases below get an ambiguous, contradictory or silent answer. Fixable with about one page of tightened wording plus a boundary table, an alias list in the constant, and a content-level ratchet. Proposed wording is under each finding and consolidated in section 8.

# Grounding (code actually read)

* `packages/shared-types/src/index.ts:32-51` enum = 18 values with inline `//` comments as the only definitions today.
* `apps/backend/src/lib/ai-processor/build-gemini-request.ts:27` (responseSchema `enum: Object.values(EventCategory)`), `:199` (`allowedCategories = Object.values(EventCategory).join(', ')`, interpolated into hand-written rule 3 of a ~12-rule system prompt).
* `apps/backend/src/lib/ai-event-filters/build-filter-extraction-request.ts:19` (prompt list) and `:82` (leaf schema enum); the prompt carries a hand-written "NOT FILTERABLE" paragraph and two few-shot examples.
* `apps/backend/src/validation/extracted-event.schema.ts:49`, `proposed-event-correction.schema.ts:47`, `packages/domain/src/ai-event-filters/filter-node-schema.ts:96` all derive from `Object.values(EventCategory)` (safe).
* `apps/web/src/lib/validation/proposed-event-correction.schema.ts:51` `categories: z.array(z.any()).min(1)` (no enum check at all).
* `packages/database/schema.ts:54-60` has its OWN hand-typed 18-value `pgEnum` list plus prose comments (not derived from shared-types).
* `packages/database/seed-volume.ts:99` hard-codes `CATEGORIES` = 8 values.
* `apps/web/src/features/events/correction-dialog.tsx:68` builds the correction options from the **generated** GraphQL `EventCategory` enum (`@/generated/graphql`), while `home-content.tsx:201` (FilterHub) builds from the shared-types enum. Two runtime enums in one web app. `apps/web/src/generated/graphql.ts` and `apps/backend/src/generated/resolvers-types.ts` are committed (git ls-files).
* `apps/web/locales/locales.test.ts:37-40` uses `expect(localeKeys).toEqual(expect.arrayContaining(enumMembers))` on `en.json` only (extras pass, empty-string label passes; `correction-dialog.tsx:70` then does `tCategory(val) || val` and silently shows the raw enum name).
* `apps/backend/src/schema/schema-consistency.test.ts` compares SDL vs shared-types only; nothing compares generated output, `schema.ts`, seed, PRD, migrations or the new constant.
* Re-extraction paths already exist: `lib/extraction/start-post-reextraction-preview.ts`, `manual-extraction-job.ts`, `map-extraction-payload-to-proposed-correction.ts:36` (maps `payload.categories` into a proposed correction).
* `transform-gemini-response-to-event-info.ts:28-31`: unknown/empty categories become `[OTHER]`; valid ones are kept alongside `OTHER` if the model emitted both.
* PRD `EventCategory` block (prd.md:358-376) carries its own prose comments (a further definitions copy).
* Golden-prompt fixtures: no gadget/fashion/home words, but `"pameran atau pasar di Sleman bulan ini"` (line 1620) shows the filter side must resolve "pameran" and "pasar" without any category, i.e. the query vocabulary is already a separate surface.

---

# 1. Findings

Severity: CRITICAL = the AD's goal fails while obeying it; HIGH = incompatible builds or wrong data likely; MEDIUM = drift or rework; LOW = hygiene.

## CRITICAL

### C-1. Rule 4 has no precedence between "route by subject" and "gate by audience"; three of its own clauses collide

Clauses in play: (a) "furniture, appliances, ... DIY/hardware tools -> HOME"; (b) "industrial machinery and trade shows, property and investment expos or seminars -> BUSINESS"; (c) "BUSINESS is for a professional or trade audience ... a consumer-facing market, bazaar, sale or promotion takes the subject of what is sold, not BUSINESS"; (d) "carries it as well only when a trade or business-matching purpose is stated in the post".

**Pair (property expo).** Post: "PAMERAN PROPERTI JOGJA, KPR DP 0%, 40 developer, gratis masuk, JEC". Story A (extraction prompt tuning, tracing clause b) tags `[BUSINESS_AND_NETWORKING]`. Story B (a FilterHub QA fixture, tracing clauses c + a: "consumer-facing sale takes the subject of what is sold", the subject sold is a house, "Rumah & Hunian") tags `[HOME_AND_LIVING]`. Both cite Rule 4 verbatim. Clause (b) names property expos unconditionally while clause (c) is audience-gated and a property expo is the textbook consumer-facing sale.

**Pair (trade-and-public furniture fair).** Post: "Furniture Fair: Trade Day 12-13 Nov (buyer & eksportir), Public Day 14-16 Nov". Clause (a) says HOME (furniture), clause (b) says "trade shows" -> BUSINESS, clause (d) says co-tag only if trade purpose stated (it is). Story A: `[HOME_AND_LIVING, BUSINESS_AND_NETWORKING]`; Story B reading (a) as winning: `[HOME_AND_LIVING]`.

**Pair (tukang power-tool roadshow).** "Makita Power Tools Roadshow, diskon 30% untuk tukang & kontraktor, workshop pasang keramik". Consumer DIY tools -> HOME, industrial machinery -> BUSINESS, professional audience -> BUSINESS. Tukang are tradespeople (professional audience) using hand-held (not industrial) tools. Silent.

**Fix.** Replace Rule 4's audience sentence with an ordered decision procedure (also in section 8):
> Resolve boundaries in this order and stop at the first match: (1) **Named routings win.** Property, real-estate and KPR/mortgage expos -> `BUSINESS_AND_NETWORKING` regardless of audience; this is the one named exception to the audience test. (2) **Subject of what is sold** decides every other consumer-facing sale, bazaar or promo (a trade/public split does not change the subject). (3) **Audience adds `BUSINESS_AND_NETWORKING`** only when the post itself states a trade, buyer, B2B, franchise, supplier or business-matching purpose (words such as "trade day", "buyer", "B2B", "business matching", "kemitraan", "peluang usaha"); "UMKM", "binaan", "support local" or a workshop for sellers alone do not count. (4) Professional-grade tools sold to tradespeople (tukang, kontraktor, bengkel) stay `HOME_AND_LIVING`; only machinery for factories/plants/production lines is `BUSINESS_AND_NETWORKING`.

### C-2. Multi-valued categories with no cardinality or `OTHER` rule make every boundary rule non-binding, and Rule 4's `OTHER` clause is now obsolete

Rule 1 says "categories stay multi-valued; a post may carry several". No cap, no primary, no statement on whether `OTHER` may co-occur (the transform keeps `OTHER` next to valid values), and the Rule 4 `OTHER` clause ("a sale spanning many unrelated products ... is `OTHER` with type PROMOTION or MARKET") was written when no fashion/home category existed.

**Pair (mall multi-brand sale).** "MID YEAR SALE Hartono Mall, diskon s.d. 70% fashion, elektronik, home living, kuliner, 1-30 Juni". Run/Story A emits `[OTHER]` + `PROMOTION` (Rule 4 verbatim). Run/Story B emits `[FASHION_AND_BEAUTY, TECHNOLOGY, HOME_AND_LIVING, FOOD_AND_DRINK]` (Rule 1: a post may carry several; every named subject now has a category, which is the more literal reading since the sentence's premise "no single subject" is arguably false when four subjects are named). Both compliant. Consequence: the mall sale appears under four chips, precision of every product chip collapses, and a user filtering `TECHNOLOGY` gets a mall sale.

**Pair (plant fair).** Boundary "plants as a pastime -> HOBBIES, plants as décor -> HOME" is satisfied by emitting both every time (multi-valued). A rule that is satisfied by both answers is not a rule.

**Fix.** Add to Rule 1 and Rule 4 (section 8): cap at **3** categories per event ordered most-specific first; `OTHER` is exclusive (never co-occurs with a real category; transform strips it when others are valid, and uses it only for "no single subject" or "no valid value"); a sale/bazaar/expo whose named subjects span **more than 3 categories or no one of them is the headline** is `[OTHER]`; boundary pairs (plants, esports, textiles) say "tag the headline only, not both" unless the post gives equal prominence to both.

### C-3. The ratchet proves existence, not consistency, and is blind to the channels where divergence will actually come from

Rule 3's ratchet: "(i) every member has a non-empty entry; (ii) neither prompt builds its category list from anything but this constant." Problems:

1. (ii) is not implementable as worded. Both files legitimately keep `Object.values(EventCategory)` (the `responseSchema` enum, `build-gemini-request.ts:27`, `build-filter-extraction-request.ts:82`), so a source grep for `Object.values(EventCategory)` cannot be banned, and "builds its list from" has no behavioural meaning. A test can only snapshot that the glossary lines appear, which says nothing about exclusivity.
2. The divergence channel is hand-written prose elsewhere in the prompt. The extraction prompt is a numbered rule list that already grows by amendment (rules 4a, 4b, 5a, 5b...). Nothing stops "3a. Prefer TECHNOLOGY for any product launch" or "gaming tournaments -> SPORTS_AND_FITNESS" being added by a later story. The ratchet passes.
3. Query side vs index side. The filter extractor maps *user phrases* to categories; the extractor maps *post text* to categories. Both render the same one-sentence definitions but each can add its own synonym guidance.

**Pair (property vocabulary split).** Story A (extraction) follows Rule 4: property -> BUSINESS. Story B (AI filter, the golden-prompt story) adds to the filter prompt, to improve recall of Indonesian phrases: "rumah, properti, KPR -> HOME_AND_LIVING" (it renders the glossary from the constant, so it passes the ratchet). The user types "pameran properti", the filter yields `categories:[HOME_AND_LIVING]`, the events are indexed `BUSINESS_AND_NETWORKING`. Zero results, both units "correct". Rule 8 (property is reached by keyword) does not settle which is right because the filter prompt has no rule for "category vs keyword" (see M-4).

**Fix.** (section 8, Rule 3) The constant also owns a per-value `aliases` list (Indonesian and English trigger terms) that BOTH prompts render; prompts may contain no other prose about categories. Ratchet becomes content-level: render each prompt, delete the one rendered glossary block, assert no `EventCategory` member name (and no alias token) remains outside it; assert both prompts' glossary blocks are byte-identical to `renderEventCategoryGlossary()`; assert every Rule 4 boundary is present in both endpoint definitions (H-1).

## HIGH

### H-1. Rule 3's constant is under-specified in shape, owner, language and renderer, so two stories can each satisfy it and not compose

Unspecified: export name, value shape (`Record<EventCategory,string>` vs object), file ("beside the enum" = same `index.ts` or a sibling), language of the sentence (English only, Indonesian, both), who writes the 18 existing entries, and where the render function lives.

**Pair.** Story A ("Definitions-source story") exports `EVENT_CATEGORY_DEFINITIONS: Record<EventCategory,string>` in English and a private `renderGlossary()` in `apps/backend/src/lib/ai-processor/`. Story B ("Taxonomy story", also a Rule 5 item: "the definitions constant") adds `HOME_AND_LIVING`/`FASHION_AND_BEAUTY` entries to a new `categoryDefinitions.ts` with `{label, definition, exclusions[]}` and a second renderer in `ai-event-filters/` joining with "; ". Rule 3 is met by each in isolation. Merge conflict at best, two constants at worst, and the ratchet "every member has a non-empty entry" passes against whichever one it imports.

Worse, Rule 4's boundaries are *between* categories, but Rule 3 says "one sentence per value, including its exclusions". The plant boundary spans `HOBBIES_AND_INTERESTS` and `HOME_AND_LIVING`; car tools span `AUTOMOTIVE` and `HOME_AND_LIVING`. Dev A writes the exclusion in `HOME` only; Dev B writes `HOBBIES` ("gardening, plant fairs, collectors") with no décor carve-out. The model now reads two sentences that disagree about plant fairs, and the ratchet passes both.

**Fix.** Specify: export `EVENT_CATEGORY_DEFINITIONS: Record<EventCategory, { definition: string; aliases: readonly string[] }>` and `renderEventCategoryGlossary(): string` from `packages/shared-types/src/event-category-definitions.ts`, re-exported from `index.ts`; `definition` is English prose with Indonesian trigger terms in `aliases` (Gemini reads Indonesian posts); `CATEGORY_BOUNDARIES` is a table of `{ id, between: [EventCategory, EventCategory], rule }` and `renderEventCategoryGlossary()` appends each rule to BOTH endpoints. Story ownership: the Definitions-source story writes all 20 entries and the boundary table; the Taxonomy story only adds enum members and *imports* (does not author) entries. This replaces "one sentence per value".

### H-2. The "0.34 tests fail if any source is missed" claim (Rule 5) is false for most of the listed sources

Rule 5 lists: shared-types, SDL, codegen, both locale files, definitions constant, PRD block, migration, seed fixture, and says "the 0.34 consistency tests must fail if any is missed". What the repo's tests actually compare: SDL vs shared-types, `en.json` keys vs shared-types (superset allowed). Not covered: generated web/backend output (committed, and `correction-dialog.tsx:68` iterates the *generated* enum), `id.json` content, empty-string labels, `packages/database/schema.ts` `pgEnum` literal list (absent from Rule 5's list, present in the record's checklist item 3), `seed.ts`, `seed-volume.ts` (8-value `CATEGORIES`), PRD block, golden fixtures, e2e (`filter.spec.ts`, `locale.spec.ts`), `explain-events-queries.ts`, `CorrectionForm.test.tsx`, `validate.test.ts`.

**Pair.** Dev A adds the two enum members, SDL, locales, constant; forgets `pnpm codegen`. Tests green (SDL vs shared-types, en.json). FilterHub shows the new chips (shared-types), the correction dialog does not (generated enum), so a corrector cannot recategorise to `HOME_AND_LIVING`; and the GraphQL server's own `resolvers-types.ts` lacks the value. Dev B adds a seed fixture to `seed.ts` only; the volume/perf e2e on `seed-volume.ts` never exercises the new chips.

Also: `apps/web/src/lib/validation/proposed-event-correction.schema.ts:51` is `z.any()`, so a typo'd value is accepted client-side and fails at GraphQL enum validation.

**Fix.** Rule 5 gets an explicit, closed *source register* (the list above, each marked derived/mirrored/hand-written), and the consistency test set is extended in the same story: generated-output vs SDL, `schema.ts` `pgEnum` (or derive it: `pgEnum('event_category', Object.values(EventCategory) as [string, ...string[]])`), exact-equality `en.json`/`id.json` keys with non-empty values, `seed-volume.ts` imports `Object.values(EventCategory)` instead of its own list, web correction schema `z.nativeEnum`. Wording in section 8.

### H-3. Rule 5/8 evidence gate and deferred triggers cannot be measured, and the sample is polluted by design

* "hand-read sample of `OTHER`-only events ... subject recurring across several accounts": "several", sample size, time window, reader and where the result is recorded are all unspecified. The record's §5 uses ~50 rows and "≥ ~5%"; the AD says the query "is a sanity check, not a veto"; the two documents disagree on whether the number gates anything.
* `OTHER`-only is a mixed bag: (1) real unclassified subjects, (2) Rule 4's by-design multi-product sales ("correct, not a gap"), (3) transform fallbacks for empty/invalid output (`transform-gemini-response-to-event-info.ts:28-31`), (4) services (wedding, hotel packages). Only (1) is evidence of a missing category. The query cannot separate them.
* Mis-tagged demand never reaches `OTHER`: tool posts hide in `HOME_AND_LIVING`, property in `BUSINESS_AND_NETWORKING`, esports in `HOBBIES_AND_INTERESTS`/`SPORTS`. The "2% of live events or three distinct accounts" trigger for `TOOLS_AND_HARDWARE` has no field to count: inside `HOME_AND_LIVING` tool posts are indistinguishable from sofa posts except by keyword regex nobody has specified. And "or three distinct accounts" is trivially true on day one (three hardware stores), so the trigger as an OR fires immediately.
* After the AD ships, the same query measures a population mixed from two tagging regimes (before and after definitions), see H-4.

**Pair.** Story A (analytics) counts `categories = {OTHER}`; Story B (the deferred-trigger check) counts keyword-regex matches inside `HOME_AND_LIVING`. They report different "tool share" for the same week and neither is wrong.

**Fix.** Rule 5/8: name the exact queries and cutoffs and store the result in the AD record; split `OTHER` into measurable parts by logging (`categoryFallbackReason: 'empty' | 'invalid' | 'model-other'` on extraction metadata, not the events table); define deferred triggers as AND (`>= 2% of live events AND >= 3 accounts`), measured by a stated keyword set over events extracted after the taxonomy cutoff; define "several accounts" = at least 3 distinct `owner_account_id` in a 28-day window, sample at least 50 `model-other` events.

### H-4. Rule 7 "no backfill" rests on premises the repo contradicts

* "Events are short-lived": archive (`archive-content.tsx`), favourites and month-long promos/exhibitions (the "Mid Year Sale 1-30 Juni" class) live for weeks to months; recurring schedules (`applicableDaysOfWeek`) persist.
* "Re-extraction is not run for a taxonomy change" says nothing about re-extraction run for other reasons, which exist (`start-post-reextraction-preview`, `manual-extraction-job`). Those re-runs now use the new definitions, so the population is *partially* migrated in an uncontrolled way, and `map-extraction-payload-to-proposed-correction.ts:36` turns every category change into a proposed-correction diff, so reviewers see AI-suggested category edits on every old event they re-extract (noise that either gets approved wholesale or trains reviewers to ignore the field).
* New chips show nothing for weeks: a user taps "Fashion & Gaya" in week 1, gets an empty or near-empty list although fashion sales are live (tagged `OTHER`/other). The AI filter ("diskon fashion") compiles to `categories:[FASHION_AND_BEAUTY]` and silently returns far too few results; the user is never told the facet is still filling.
* The widened `TECHNOLOGY` and the new boundary rules change tagging of the *existing* 18 values too (e.g. property posts now route to BUSINESS), not only the two new ones.

**Pair.** Story A (feed) ships the chips and relies on Rule 7. Story B (admin re-extraction preview) re-extracts one account's old posts; its events silently adopt the new definitions and the old/new boundary is now per-account, not per-date, so an analyst cannot reason about facet coverage.

**Fix.** Rule 7 rewritten (section 8): no mass re-extraction, but (a) record a `taxonomyEffectiveFrom` timestamp in the AD; (b) one-time *targeted reclassification* of events with `categories = {OTHER}` and end date >= today using the cheaper text-only classification call (bounded cost: this is exactly the set the evidence query samples); (c) re-extraction preview does not offer category-only diffs for events extracted before the cutoff unless the reviewer opts in; (d) any evidence/trigger query filters on events extracted at or after the cutoff.

### H-5. User-facing labels do not match the definitions, and one reintroduces the rejected "lifestyle"

* `HOME_AND_LIVING` -> "Rumah & Hunian". "Rumah" = house, "hunian" = dwelling/residence. A user looking for a house to buy taps it and gets sofas and blenders, while the definition (Rule 4) explicitly routes property to `BUSINESS_AND_NETWORKING`. Gemini also sees the enum name only plus definition, but a corrector choosing in the correction dialog sees only the Indonesian label, and will tag property expos "Rumah & Hunian". The user-facing label/definition mismatch makes the property boundary unenforceable in the human-correction path too.
* `FASHION_AND_BEAUTY` -> "Fashion & Gaya". "Gaya" = style/lifestyle; this is the catch-all word the review rejected in R1-1, and it removes "beauty" from the Indonesian UI, so a user looking for skincare/makeup launches does not see their category. (The owner chose it; the risk is that the chip semantics now differ per language.)

**Fix.** Label + definition are one decision. Either relabel (e.g. `HOME_AND_LIVING` -> "Perabot & Rumah Tangga" or "Rumah Tangga & Interior"; `FASHION_AND_BEAUTY` -> "Fashion & Kecantikan" or "Fashion, Grooming & Beauty") or keep and state in Rule 4 that the Indonesian label is *not* to be read as property, and surface a one-line hint in the correction dialog from the constant (M-5). Needs an owner decision; the AD should record that the previous "Kecantikan is female-coded" reason was weighed against "Gaya" being a catch-all.

### H-6. Rule 4 is silent on whole classes of common posts

See the post table (section 2): esports/gaming as an activity, traditional textiles (batik/tenun/wastra), sports apparel/gear versus "sneakers", medical aesthetics versus "skincare", services expos (wedding, education fair, hajj/umrah), bridal.

**Pair.** "Mobile Legends mini-tournament at an Erafone/ASUS roadshow": Story A -> `[TECHNOLOGY, HOBBIES_AND_INTERESTS]`, Story B -> `[TECHNOLOGY, SPORTS_AND_FITNESS]`. Rule 4 says gaming *gear and promos* -> TECHNOLOGY; competition is silent.

**Fix.** Add explicit entries to the boundary table (section 8, Rule 4-b): esports/gaming tournaments -> `HOBBIES_AND_INTERESTS` (owner may prefer SPORTS), batik/tenun/wastra heritage -> `ARTS_AND_CULTURE`, sneakers/apparel/fashion -> FASHION even when sport-branded, but a participatory sport event (fun run, tournament) -> `SPORTS_AND_FITNESS`, clinical aesthetic treatment -> `HEALTH_AND_WELLNESS`, services expos (wedding, travel agency) -> subject category if one exists (travel -> `TRAVEL_AND_TOURISM`), else `OTHER`.

## MEDIUM

### M-1. Rule 1's "audience-neutral" collides with Rule 4's audience-gated `BUSINESS_AND_NETWORKING`

Rule 1: "none is defined by gender, age or eligibility ... who an event is for is a separate axis". Rule 4: "BUSINESS_AND_NETWORKING is for a professional or trade audience". That is an audience-defined category in the same AD (as are `FAMILY_AND_KIDS`, `CAREER`). Also the audience is mostly implicit on Instagram, so the test is only decidable from explicit words. **Fix:** reword Rule 1 to "none is defined by gender, age, or eligibility; `BUSINESS_AND_NETWORKING` is defined by its *subject* (trade, B2B, networking, entrepreneurship, property/investment) and Rule 4 step 3 uses stated-purpose words, not inferred audience".

### M-2. The category rule leans on `EventType` (form) but `EventType` has no definitions source and is just as ambiguous

Rule 1 delegates form to `EventType`; Rule 4 states `OTHER` "with type PROMOTION or MARKET". For "pameran" (exhibition/fair) the model may choose `EXHIBITION` (comment: "Art shows, trade shows"), `MARKET` ("bazaars"), `PROMOTION` ("sales events") or `FESTIVAL`. So a mall multi-brand "pameran" with `EXHIBITION` falls outside Rule 4's stated pair. **Pair:** Story A renders a categories glossary but not a types glossary and writes tests asserting `types ∋ PROMOTION`; Story B's prompt iteration gets `EXHIBITION` for the same post and the test flakes. **Fix:** Rule 4 should say "with any `EventType`" (the category does not depend on the type), and the AD should add a follow-up: extend the same definitions mechanism to `EventType` (same constant style, same ratchet), at least for `EXHIBITION/MARKET/PROMOTION/FESTIVAL`.

### M-3. "One definitions source" survives only for the model; four prose copies remain

Enum inline comments (`index.ts:42-49`), `schema.ts` comments above `eventCategoryEnum`, PRD enum block comments (prd.md:358-376; the PRD is a mandatory reference in CLAUDE.md), `project-context.md`, plus `filter-vocabulary.md`. `TECHNOLOGY`'s comment "Tech product promos, hackathons, tech meetups" is now narrower than the new definition and nobody owns updating it. **Fix:** Rule 3: delete the per-value comments from `index.ts`/`schema.ts`/PRD and replace with "see `EVENT_CATEGORY_DEFINITIONS`"; a lint-level test greps for `//` comments inside the enum body.

### M-4. Category-versus-keyword choice in the AI filter is unspecified

Rule 8: "Tools, gadgets, property, plants ... are reached by keyword search today". But the filter extractor is told `categories` exists and now sees `TECHNOLOGY - consumer gadgets`. For "diskon gadget" does it emit `categories:[TECHNOLOGY]` (includes hackathons) or `keyword:"gadget"` (misses "laptop gaming")? Two golden-prompt authors will pin opposite expectations. `filter-vocabulary.md` row says only "Caveat if prompt implies a category outside the enum". **Fix:** Rule 3 addendum: the filter prompt maps a phrase to a category iff it matches the category's `aliases`; sub-category phrases in Rule 8's list (tools, plants, property, 'drone'...) emit `keyword` AND the parent category only when the alias list names them; add three golden fixtures per new category (en, id) before shipping.

### M-5. Correction form and UI may grow a second user-facing definitions source

The correction dialog shows only the label (`tCategory(val) || val`); to help correctors, one dev will add `EventCategory.help.*` keys in the two locale files (human-written, parity-tested only for key presence), another will read `EVENT_CATEGORY_DEFINITIONS`. **Fix:** Rule 3: user-facing category help text, if shown, is rendered from the same constant (add `labelHint?: {en,id}` later); no separate locale help keys.

### M-6. Rule 6 omits stores, the deploy-order hazard and definition-narrowing

Rule 6 lists `events.categories`, `widgets.filters`, saved AI filters. Missing: stored proposed corrections / correction payloads (`corrections.graphql:34`; `resolvers.ts:1508` stores `proposedData.categories`), stored extraction payloads (unprocessed payloads / re-extraction previews), notification or subscription filters (check `widgets.filters` and any `*_filters` jsonb), URL state (`nuqs` `categories` param in FilterHub and `use-ai-filter.ts` passes arbitrary strings to a GraphQL `[EventCategory!]` variable, so any shared/bookmarked/embedded URL with a removed value makes the whole events query fail validation, not just ignore the chip), in-flight queue messages and cached web bundles during deploy. Also `transform-gemini-response-to-event-info` silently coerces an unknown value from a stale job to `OTHER`, losing the subject. And Rule 6 covers remove/rename but not **narrowing a definition** (e.g. making `HOME` exclude property after launch): a semantic removal with no migration.

**Pair.** Dev A runs the data migration then deploys the SDL change; a cached web client sends the old value for ~hours and gets a validation error. Dev B ships SDL first and migrates after; stored rows fail serialization in between. Rule 6 ("migration first") is read by both as satisfied.

**Fix:** Rule 6 as in section 8: two-phase (deprecate = keep in SDL with `@deprecated` and accept-as-alias in the transform, migrate rows and stored JSON, then drop after N days), explicit store register, URL-param sanitiser, and "narrowing a definition is treated as removal for the narrowed subjects".

### M-7. Definition language and Indonesian trigger terms

Definitions are English one-sentences; posts are Indonesian ("bazar", "pameran", "perkakas", "tukang", "KPR", "hunian", "tanaman hias", "kuliner"). Two authors will translate differently (and the filter prompt's few-shot examples show Indonesian is the input side). Covered by H-1's `aliases`; listed separately because the ratchet currently tests nothing about it. Add a unit test that every definition's alias list contains at least one Indonesian token.

## LOW

### L-1. Record/AD inconsistencies
* AD Rule 5: query "a pre-build sanity check, not a veto"; record §5: "add/keep ... if sampled OTHER events show >= ~5% in each". Pick one.
* Record §6 item 3 lists `schema.ts` pgEnum; Rule 5 omits it (H-2).
* Record §1 fact 9 ("golden fixtures contain no home/gadget/tool/fashion words") is true but `pameran`/`pasar` appear and are exactly the words that now collide with the new boundary.
* AD "Revisit grouping the FilterHub chips if the set passes 24" while 20 chips + `OTHER` as an unfilterable-meaning chip is already the largest single-tap list; the record itself says "no search". Add a concrete UX trigger (chip row scroll height) rather than a count.
* `OTHER` as a user-facing chip is semantically "no single subject" per Rule 4 (not "misc"), but the locale label is unspecified; if it reads "Other/Lainnya" users treat it as a catch-all, which Rule 1 forbids for new names.

### L-2. Rule 5 "next free AD / project-context / PRD block" bookkeeping and the "18 values" wording in AD-42 are manual; add them to the source register so the 0.34-style test can read them (a markdown count is hard to test; consider dropping numeric counts from prose).

---

# 2. Ten (plus two) realistic Indonesian posts against Rule 4

"Plausible output" = what two reasonable Gemini runs, each given the Rule 4 glossary, would most likely produce. Rule 4 verdict: A = answered, AMB = ambiguous, CON = contradictory, SIL = silent.

| # | Post (caption sketch) | Rule 4 clauses engaged | Verdict | Most plausible outputs (run 1 / run 2) |
|---|---|---|---|---|
| 1 | **Property expo.** "PAMERAN PROPERTI JOGJA 2026: KPR DP 0%, 40+ developer, bunga fix 3,5%, gratis masuk, JEC 14-17 Nov. Hadiah umroh!" | property -> BUSINESS (named) vs "consumer-facing sale takes subject sold; BUSINESS is trade audience" | **CON** | `[BUSINESS_AND_NETWORKING]` / `[HOME_AND_LIVING, BUSINESS_AND_NETWORKING]` (label "Rumah & Hunian" pulls "rumah"); types `EXHIBITION`/`PROMOTION`. |
| 2 | **Trade+public furniture fair.** "Jogja Furniture & Craft Fair: Trade Day 12-13 Nov (buyer & eksportir), Public Day 14-16 Nov" | furniture -> HOME; trade shows -> BUSINESS; co-tag if trade purpose stated | **CON** (no precedence) | `[HOME_AND_LIVING, BUSINESS_AND_NETWORKING]` / `[HOME_AND_LIVING]`. |
| 3 | **UMKM bazaar in a mall.** "Bazar UMKM Lebaran: kuliner, kriya, fashion muslim, 30 tenant binaan Pemkot, Atrium Hartono Mall, 12-20 Maret. Free workshop 'UMKM Go Digital' tiap Sabtu" | consumer bazaar -> subject sold (mixed) ; UMKM business-matching -> BUSINESS ; many products -> OTHER | **AMB** ("UMKM" is in both lists; a workshop for sellers is not "business-matching" but reads as business purpose) | `[OTHER]` + `MARKET` / `[BUSINESS_AND_NETWORKING, FOOD_AND_DRINK, FASHION_AND_BEAUTY]`. |
| 4 | **Gadget roadshow + esports.** "Erafone x ASUS ROG Roadshow: laptop gaming s.d. 3jt, trade-in HP, mini turnamen Mobile Legends hadiah 5jt, Lippo Plaza" | gaming gear and promos -> TECHNOLOGY | **SIL** for the tournament | `[TECHNOLOGY, HOBBIES_AND_INTERESTS]` / `[TECHNOLOGY, SPORTS_AND_FITNESS]`; types `PROMOTION`+`COMPETITION`. |
| 5 | **Fashion week with heritage textile.** "Jogja Fashion Week 'Wastra Nusantara': 40 desainer lokal, batik & tenun, runway, buyer meeting hari ke-2, live music" | FASHION; buyer meeting = stated trade purpose -> BUSINESS co-tag | **AMB** (cap, textile heritage, trade co-tag) | `[FASHION_AND_BEAUTY, ARTS_AND_CULTURE, BUSINESS_AND_NETWORKING, MUSIC]` / `[FASHION_AND_BEAUTY]`. Four labels vs one; no cap rule. |
| 6 | **Barbershop promo.** "Grand Opening Gentleman's Barbershop Sleman: potong + hairwash 25rb, free kopi, 1 minggu" | barbershop/grooming -> FASHION | **A** (this is the rule working) | `[FASHION_AND_BEAUTY]` both; run 2 may add `FOOD_AND_DRINK` for the free coffee (cap rule would stop it). |
| 6b | **Aesthetic clinic.** "Promo Glow Up Clinic: facial, botox, laser rejuvenation 50%, 17-19 Agustus" | skincare/cosmetics -> FASHION | **AMB** (medical aesthetics vs "skincare") | `[FASHION_AND_BEAUTY]` / `[HEALTH_AND_WELLNESS, FASHION_AND_BEAUTY]`. |
| 7 | **Tool roadshow for tradespeople.** "Makita Power Tools Roadshow: demo bor, gerinda; diskon 30% untuk tukang & kontraktor; workshop pasang keramik; Toko Bangunan Jaya Abadi, Bantul" | consumer DIY/hardware -> HOME; industrial machinery -> BUSINESS; BUSINESS = professional/trade audience | **CON** | `[HOME_AND_LIVING]` / `[BUSINESS_AND_NETWORKING, HOME_AND_LIVING]`; some runs `AUTOMOTIVE` ("mesin") are possible but unlikely. |
| 8 | **Plant fair.** "Pameran Tanaman Hias & Kontes Aglaonema, Jogja Expo Center, jual tanaman, pot, media tanam, lomba kolektor, 3 hari" | plants as pastime -> HOBBIES; plants as décor -> HOME | **AMB** ("tanaman hias" literally = ornamental/decorative; "kolektor"/"kontes" = hobby) | `[HOBBIES_AND_INTERESTS, HOME_AND_LIVING]` almost always (multi-valued makes the boundary vacuous), occasionally `[HOBBIES_AND_INTERESTS]`. |
| 9 | **Mall multi-brand sale.** "MID YEAR SALE Hartono Mall: diskon s.d. 70% fashion, elektronik, home living, kuliner, gratis parkir, 1-30 Juni" | many unrelated products -> OTHER + PROMOTION/MARKET | **CON** (Rule 1 multi-valued vs Rule 4; the new categories now exist for every named subject) | `[OTHER]` / `[FASHION_AND_BEAUTY, TECHNOLOGY, HOME_AND_LIVING, FOOD_AND_DRINK]`; the second is the likelier output now. |
| 10 | **Sports-brand launch.** "Nike Run Club x Pakuwon: launch Pegasus 42, 5K fun run, goodie bag, 24 Nov" | sneakers -> FASHION (named) ; no sports-gear clause | **AMB** | `[SPORTS_AND_FITNESS]` / `[SPORTS_AND_FITNESS, FASHION_AND_BEAUTY]`. |
| 11 | **Wedding expo.** "Jogja Wedding Expo: 60 vendor gedung, katering, rias, busana, dekorasi, paket hemat" | none (record calls hotel wedding packages "out of scope (services)") | **SIL** | `[OTHER]` / `[FASHION_AND_BEAUTY, FOOD_AND_DRINK, HOME_AND_LIVING]` (décor) - systematically polluted `OTHER`. |
| 12 | **Brand launch with makeup class.** "Launching Wardah Colorfit di Jogja City Mall: meet & greet, makeup class, doorprize, 12 Okt" | FASHION (cosmetics) | **A** | `[FASHION_AND_BEAUTY]` both; run 2 may add `EDUCATION` for "class" (no cap/exclusion). |

Observation: 7 of 12 (rows 1, 2, 3, 7, 9 plus 5 and 8 on cardinality) fail on *precedence or cardinality*, not on missing categories; adding more category definitions would not fix them. Only rules 6, 12 are cleanly answered, and they are the easy ones.

---

# 3. Pair catalogue, compact (each obeys AD-44 to the letter)

| # | Unit 1 | Unit 2 | Why both comply | Closed by |
|---|---|---|---|---|
| P1 | Definitions story: `Record<EventCategory,string>` EN, renderer in ai-processor | Taxonomy story: `{definition,exclusions}` constant in new file, renderer in ai-event-filters | Rule 3 does not fix name/shape/renderer/language | H-1 shape + single renderer |
| P2 | Extraction prompt: property -> BUSINESS | Filter prompt: "rumah, properti, KPR" -> HOME | Rule 3 shares definitions, not aliases; ratchet sees only the list | C-3 aliases in constant + content ratchet |
| P3 | Feed story relies on Rule 7 (chips fill over time) | Admin re-extraction preview adopts new definitions per account | Rule 7 forbids re-extraction *for taxonomy change* only | H-4 cutoff + targeted reclass |
| P4 | Codegen forgotten; tests green | FilterHub shows new chips, correction dialog (generated enum) does not | 0.34 tests only compare SDL/en.json to shared-types | H-2 test set |
| P5 | `seed.ts` fixture for new categories | `seed-volume.ts` 8-value list untouched | Rule 5 says "a seed fixture" | H-2 derive from enum |
| P6 | Mall sale -> `[OTHER]`+PROMOTION | Mall sale -> four category tags | Rule 1 multi-valued vs Rule 4 OTHER clause | C-2 cap + exclusive OTHER |
| P7 | Property expo -> BUSINESS | Property expo -> HOME ("Rumah & Hunian", consumer sale) | Rule 4 clause b vs c | C-1 ordered procedure |
| P8 | `HOME` definition carries plants-as-décor | `HOBBIES` definition lists plant fairs, no exception | Rule 3 "one sentence per value including its exclusions" - each side written once | H-1 boundary table rendered on both endpoints |
| P9 | Deferred-trigger check = regex over `HOME_AND_LIVING` | Evidence gate = count of `{OTHER}` | Rule 5 and 8 name neither query | H-3 named queries |
| P10 | Hand-written note "prefer TECHNOLOGY for product launches" added to extraction prompt rule 3a | Glossary unchanged | Ratchet only checks where the *list* comes from | C-3 content-level ratchet |
| P11 | Help text in `en.json`/`id.json` `EventCategory.help.*` | Help text read from constant | Rule 3 binds prompts only | M-5 |
| P12 | Dev hand-writes `ADD VALUE ... BEFORE 'OTHER'` SQL | Dev edits `schema.ts` pgEnum and runs `drizzle-kit generate` | Rule 5 lists the migration but not `schema.ts`; snapshot `meta/*_snapshot.json` diverges | H-2 derive pgEnum or list it |

---

# 4. Places a category list is built that the ratchet would not catch

| Surface | Today | Caught by Rule 3 ratchet? | Caught by 0.34 tests? |
|---|---|---|---|
| `schema.ts:54` pgEnum literal list + comments | hand-typed, 18 | no | no |
| `seed-volume.ts:99` `CATEGORIES` | hand-typed, 8 | no | no |
| `seed.ts` fixtures | per-post arrays | no | no |
| generated `graphql.ts` / `resolvers-types.ts` | committed | no | no |
| `correction-dialog.tsx:68` | iterates generated enum | no | no |
| `apps/web/src/lib/validation/proposed-event-correction.schema.ts:51` | `z.any()` | no | no |
| prompt prose outside the list (extraction rules, filter few-shots, "NOT FILTERABLE") | hand-written | no | no |
| `golden-prompt-fixtures.ts` expected `categories` | hand-written | no | no |
| `explain-events-queries.ts:319` | `EventCategory.MUSIC` literal | no | no |
| e2e `filter.spec.ts`, `event-correction.spec.ts`, `locale.spec.ts` | string literals | no | no |
| `id.json` values (empty or placeholder) | key presence only (via en.json mirror) | no | partly (keys only; `arrayContaining` allows extras) |
| visual-audit manifests (`event-card-masonry-thumbnail-fallback.ts`) | category string in fixture | no | no |
| enum comments, PRD block, project-context, `filter-vocabulary.md` | prose | no | no |
| FilterHub option order/grouping | `Object.values` order | no | no |

---

# 5. Rule 5 (evidence) attacks, summary

1. Gate undefined (sample size, window, "several", where recorded); AD and record disagree (veto vs ~5%).
2. The measured set (`OTHER`-only) conflates real gaps, by-design `OTHER`, fallbacks and services.
3. Demand hidden inside mis-fit categories is never measured.
4. Triggers OR-ed with a trivially true condition (`or three distinct accounts`).
5. Population mixes two tagging regimes after launch.
6. The two adopted additions are exempt, and the evidence for their *removal* is never defined (what number would make us revert `FASHION_AND_BEAUTY`? Rule 6 makes removal a data migration, so the asymmetry R1-6 argued for means a wrong "yes" is expensive and there is no stated exit criterion).

# 6. Rule 6 (removal) attacks, summary

Store register incomplete; no deploy ordering or deprecation window; URL params and cached clients; in-flight jobs coerced to `OTHER`; rename (one-to-many or many-to-one mapping) undefined; definition narrowing not covered; `TECHNOLOGY` widening silently changes saved `NOT` filters.

# 7. Rule 7 (no backfill) attacks, summary

"Short-lived" is false for archive, favourites, month-long promos and recurring events; existing re-extraction paths cause uncontrolled partial migration and spurious correction diffs; empty chips with no user signal; evidence queries contaminated; the claim "re-extraction costs Gemini calls" ignores the cheap targeted option (text-only reclassification of live `{OTHER}` events only).

---

# 8. Proposed replacement / additional wording

**Rule 1 (add):** "An event carries at most **3** categories, most specific first. `OTHER` is exclusive: it never co-occurs with another category, and it means 'no single subject' or 'no valid value', never 'misc'. A category is defined by subject, not by audience or form; `BUSINESS_AND_NETWORKING` is defined by trade, B2B, networking, entrepreneurship and property/investment subject matter, and is added by Rule 4 step 3 only on stated words, never on inferred audience."

**Rule 3 (replace):** "One definitions source. `packages/shared-types/src/event-category-definitions.ts` exports `EVENT_CATEGORY_DEFINITIONS: Record<EventCategory, { definition: string; aliases: readonly string[] }>` (English prose; `aliases` are English and Indonesian trigger terms, at least one Indonesian per value), `CATEGORY_BOUNDARIES: readonly { id: string; between: readonly [EventCategory, EventCategory]; rule: string }[]`, and `renderEventCategoryGlossary(): string`, re-exported from `index.ts`. Both Gemini prompts embed `renderEventCategoryGlossary()` and contain no other prose about categories or category aliases; per-value comments in the enum, `schema.ts` and the PRD are replaced by a pointer. Ratchet (all must fail on violation): (a) every member has a non-empty definition and at least one Indonesian alias; (b) both rendered system instructions contain the glossary block exactly once; (c) removing that block leaves no `EventCategory` member name or alias in either rendered instruction (the `responseSchema` enums are exempt); (d) every `CATEGORY_BOUNDARIES` rule appears in the rendered definitions of both endpoints; (e) the golden category corpus in Rule 4-c passes in the live-eval script before any definitions change is merged."

**Rule 4 (replace the boundary sentence):**
> a. **Decision order** (stop at first match): 1. Named routings win: property, real-estate and KPR/mortgage expos or seminars -> `BUSINESS_AND_NETWORKING` regardless of audience (the single exception to the audience test). 2. Otherwise the **subject of what is sold or shown** decides consumer-facing sales, bazaars, expos and promos; a trade-day/public-day split does not change the subject. 3. Add `BUSINESS_AND_NETWORKING` only when the post states a trade, buyer, B2B, franchise, supplier or business-matching purpose; "UMKM", "binaan", "support local" or a seller workshop alone do not count. 4. A sale or expo whose named subjects span more than 3 categories, or where no subject is the headline, is `[OTHER]` (any `EventType`).
> b. **Boundary table** (each line rendered into both endpoints): consumer gadgets, electronics, gaming gear and their promos -> `TECHNOLOGY`; esports/gaming tournaments -> `HOBBIES_AND_INTERESTS`; furniture, appliances, décor, interior, housewares, home improvement and tools sold to consumers or tradespeople (tukang, kontraktor) -> `HOME_AND_LIVING`; machinery for factories or production lines -> `BUSINESS_AND_NETWORKING`; car and motorcycle accessories and tools -> `AUTOMOTIVE`; plants: headline is collecting, contests, breeding or gardening -> `HOBBIES_AND_INTERESTS`, headline is decorative planting for the home sold as décor -> `HOME_AND_LIVING`, tag the headline only; fashion, sneakers (including sport-branded), barbershop, grooming, skincare and cosmetics -> `FASHION_AND_BEAUTY`, but clinical aesthetic treatment -> `HEALTH_AND_WELLNESS`, and a participatory sport event (fun run, tournament) -> `SPORTS_AND_FITNESS` even when a shoe or apparel is launched; batik, tenun and wastra heritage events -> `ARTS_AND_CULTURE` (plus FASHION only when a runway or apparel sale is the headline); wedding, bridal and similar services expos -> the dominant subject category if one exists, else `[OTHER]`.
> c. **Golden category corpus**: the twelve posts in `reviews/review-adversarial-pair.md` section 2 (and any later addition) are committed as fixtures with `expected` and `mustNotInclude`, run by the live-eval script; a change to any definition or boundary line re-runs them.

**Rule 5 (replace):** "Adding a value touches the closed **source register** in `docs/infrastructure/` (or the story): shared-types enum, definitions constant and boundary table, `schema.ts` `pgEnum` (derived from the enum or edited in the same change), SDL, committed codegen output (web and backend), `en.json` and `id.json` (non-empty, exact key equality), seed fixtures in `seed.ts` and `seed-volume.ts` (the latter derives from the enum), golden corpus, PRD block, `project-context.md`, the `ADD VALUE` migration. The test set fails if any item is missing. Evidence for a *new* value: at least 50 `categoryFallbackReason = 'model-other'` events from the last 28 days, at least 3 distinct accounts, subject share at least 2%; evidence for a *deferred split* (e.g. `TOOLS_AND_HARDWARE`) is the same measured by a stated keyword set, joined with AND, on events extracted at or after `taxonomyEffectiveFrom`. The query text and result are stored in the AD record. Owner-adopted values record the exit criterion that would reverse them."

**Rule 6 (replace):** "Removing, renaming or *narrowing the definition of* a value is a two-phase change. Phase 1: keep the value in the SDL marked `@deprecated`, accept it as an alias in the transform, migrate `events.categories`, `widgets.filters`, saved AI filters, stored proposed corrections, stored extraction payloads and any `*_filters` JSON, and sanitise `categories` URL params in FilterHub / `use-ai-filter`. Phase 2, at least 14 days later: drop it from SDL, enum, locales. A rename defines its mapping (one-to-many or many-to-one) in the AD."

**Rule 7 (replace):** "No mass re-extraction. `taxonomyEffectiveFrom` is recorded in the AD. A one-time text-only reclassification is run on events with `categories = {OTHER}` and an end date today or later. Re-extraction preview does not surface category-only diffs for events extracted before the cutoff unless the reviewer opts in. FilterHub shows no empty-state hint change, but the AI-filter summary may note 'new category, fewer older events' for 28 days (UX decision). All evidence queries are restricted to events extracted at or after the cutoff."

**Open owner decisions this review creates:** esports -> HOBBIES vs SPORTS; label wording for `HOME_AND_LIVING` ("Rumah & Hunian") and `FASHION_AND_BEAUTY` ("Fashion & Gaya"); cap of 3; whether property should stay in `BUSINESS_AND_NETWORKING` given it is a consumer-facing sale (recommend adding `FINANCE_AND_PROPERTY` earlier than the deferred trigger if the property posts reach the same volume as home expos in the first sample).

---

# 9. What AD-44 gets right (so the fixes are minimal, not a redesign)

Form-vs-subject separation, audience-neutral categories, refusing `LIFESTYLE`/bare `TOOL`/`GADGET_AND_LIFESTYLE`, naming the single-source principle at all, discovering that the pgEnum is unused, and recording the adoption as owner-directed ahead of evidence. None of the findings above require changing the 20-value set; C-1, C-2 and C-3 are wording-plus-test changes; H-1 to H-4 are story-shaping; H-5 is an owner decision on labels.
