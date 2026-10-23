---
title: EventCategory gap review (home & living, gadget & lifestyle, tool)
date: 2026-10-23
status: final — owner decisions recorded 2026-10-23; distilled into Architecture Spine AD-44
altitude: cross-cutting taxonomy (shared-types, GraphQL, Gemini prompts, locales)
---

# EventCategory gap review

Request: three candidate categories look missing — **home and living**, **gadget and lifestyle**, **tool**. Analyse, run a review cycle, then finalise.

## 1. Facts established from the repo

| # | Fact | Source |
|---|------|--------|
| 1 | 18 categories today; `categories` is **multi-valued** (`EventCategory[]`), so overlap is tolerated by design. | `packages/shared-types/src/index.ts`, PRD `EventInfo` |
| 2 | Convention already in the repo: a category is a **subject domain and includes its product promos** (`TECHNOLOGY` = "tech product promos", `TRAVEL_AND_TOURISM` = "travel gear promos", `AUTOMOTIVE`). Form-of-event ("promotion", "market") lives on the separate `EventType` axis (`PROMOTION`, `MARKET`). | enum comments |
| 3 | Gemini sees **only enum names** (`Object.values(EventCategory).join(', ')`), never the code-comment definitions. Same for the AI-filter extractor. A new category with an ambiguous name will be tagged inconsistently. | `build-gemini-request.ts:199,223`, `build-filter-extraction-request.ts:19` |
| 4 | Unknown/empty categories fall back to `OTHER` (`transform-gemini-response-to-event-info.ts:28-31`). Home/gadget/tool posts today land in `OTHER` or a loosely-fitting category. | same |
| 5 | Real evidence of the gap in seed data: mall/brand promo posts (`pakuwonmall.jogja`): JETE gaming TWS 50% promo (gadget), Indonesia Shopping Festival, hotel wedding package. No fixture mentions home/furniture/tools. | `packages/database/seed.ts` FIXTURE_POSTS |
| 6 | `eventCategoryEnum` (pgEnum) is declared but **no column uses it** — `events.categories` is `text[]`. The "Postgres enum irreversibility" risk in `deferred-work.md` is nominal. The real one-way door is the **GraphQL enum + stored row values**: removing a value later makes any stored row carrying it fail GraphQL enum serialization. | `schema.ts:54,438` |
| 7 | Cross-source drift is already guarded by Story 0.34 tests (en.json keys, backend SDL vs shared-types). | story 0-34 |
| 8 | FilterHub renders categories as tap-to-toggle chips (no search). 18 → 20 chips is fine; revisit grouping near ~24. | `multi-select.tsx` |
| 9 | Golden-prompt fixtures contain no home/gadget/tool/fashion words, so none of their `expected` outputs change. | grep, `golden-prompt-fixtures.ts` |
| 10 | Marketplace verticals the candidates resemble: Shopee groups "Home & Living" and "Gadget & Electronics"; beauty and fashion are its top-selling verticals (2020 data, dated). Candidate names look like **e-commerce verticals**, i.e. the demand is brand/mall **product promos**. Eventbrite's list could not be verified via search — not relied on. | web search 2026-10-23 |

**Not available to me:** production data. No evidence yet of how many events currently sit in `OTHER`. See §5 evidence gate.

## 2. Evaluation criteria

C1 distinct subject a user would filter by · C2 demand evidence · C3 overlap with existing · C4 Gemini separability · C5 reversibility cost.

## 3. Review cycle

### Round 0 — draft (analyst pass)
Add all three: `HOME_AND_LIVING`, `GADGET_AND_LIFESTYLE`, `TOOL`.

### Round 1 — adversarial review (cynical pass)

| ID | Finding | Verdict |
|----|---------|---------|
| R1-1 | **"Lifestyle" is unbounded.** Every category is a lifestyle; Gemini will use it as a second `OTHER`, and a facet that matches everything filters nothing. | Reject the name. Real content hiding behind "lifestyle" is **fashion & beauty**. |
| R1-2 | **GADGET overlaps TECHNOLOGY** whose comment already claims "tech product promos". Two siblings, one scope → the same post tagged `TECHNOLOGY` on one run, `GADGET` on another; filter recall splits. | Don't add a sibling. Widen/relabel `TECHNOLOGY` (label-only, zero schema change). |
| R1-3 | Counter-argument to R1-2: buyers and builders are different audiences (gadget sale vs hackathon). | Already served: `EventType=PROMOTION` ∩ `TECHNOLOGY` answers "gadget promos"; AI filter handles the phrase. Keeps fact #2 convention. |
| R1-4 | **Bare `TOOL` is ambiguous**: software tool, power/hand tool, craft tool, industrial machine tool. A "productivity tool webinar" would be tagged `TOOL`. | Reject the name. |
| R1-5 | **TOOL has the weakest demand evidence** (fact #5: none) and consumer tool/hardware promos are mostly DIY/home-improvement; industrial trade shows are `BUSINESS_AND_NETWORKING`. | Defer as standalone; fold consumer tools into `HOME_AND_LIVING` definition; split when evidence trigger (§5) fires. |
| R1-6 | Asymmetry: adding an enum value later is cheap, removing one is not (fact #6). | Start narrower; add only on evidence. |
| R1-7 | A new category without a glossary is a drift generator (fact #3). | **Prerequisite**: shared category-glossary constant feeding both prompts + ratchet test that every `EventCategory` has an entry. |
| R1-8 | Existing events will not carry the new tag; the facet looks sparse at first. | Accept: events are short-lived and decay in weeks; no backfill (re-extraction costs Gemini calls). Note it in the story. |
| R1-9 | `FASHION_AND_BEAUTY` was not requested — scope creep? | It is the legitimate home of the "lifestyle" intent and a common event form (fashion weeks, beauty expos, mall fashion sales). Presented as owner's call (F-C). |

### Round 2 — edge-case hunt (boundary posts)

| Case | Result under proposal | Rule needed in glossary |
|------|----------------------|-------------------------|
| JETE gaming TWS 50% (seed) | `PROMOTION` + `TECHNOLOGY` (+`HOBBIES` optional) | `TECHNOLOGY` includes consumer gadgets & gaming gear |
| Home expo with furniture + appliances | `HOME_AND_LIVING` | — |
| Kitchen-appliance cooking demo | `HOME_AND_LIVING` + `FOOD_AND_DRINK` | multi-label allowed |
| Plant/flower exhibition | `HOBBIES_AND_INTERESTS` unless décor/home-focused | plants-as-hobby vs plants-as-décor boundary |
| Power-tool brand roadshow (consumer) | `HOME_AND_LIVING` (DIY/home improvement) | tools sentence in definition |
| Industrial machinery trade show | `BUSINESS_AND_NETWORKING` | exclude from HOME |
| Car-accessory/tool promo | `AUTOMOTIVE` | automotive wins |
| Property/real-estate expo | no home: `OTHER`/`BUSINESS` | **Open (F-D)** — `HOME_AND_LIVING` must explicitly exclude property or it will absorb it |
| Shopping festival (any product) | form = `PROMOTION`; subject = `OTHER` | **Open (F-D)** — `SHOPPING_AND_RETAIL` candidate |
| Hotel wedding package | `OTHER` | out of scope (services) |
| Fashion show with live music | `FASHION_AND_BEAUTY` + `MUSIC`/`ARTS_AND_CULTURE` | multi-label |
| Post yielding no valid category | falls to `OTHER` (existing behaviour) | none |

### Round 3 — convergence
No further blocking findings. Remaining items are owner decisions (§4).

## 4. Proposed final taxonomy (18 → 20)

| Action | Value | EN label | ID label | Definition (for glossary) |
|--------|-------|----------|----------|---------------------------|
| **ADD** | `HOME_AND_LIVING` | Home & Living | Rumah Tangga & Interior | Furniture, appliances, décor, interior, housewares, home improvement and consumer DIY/hardware tools, home expos. Excludes property/real estate and industrial machinery. |
| **ADD** (F-C) | `FASHION_AND_BEAUTY` | Fashion & Beauty | Fashion & Gaya | Fashion shows/weeks, apparel & accessories sales, beauty/cosmetics launches and expos, grooming. |
| **CLARIFY** (no enum change; **label unchanged by owner decision** — see §7) | `TECHNOLOGY` | Technology | Teknologi | Software/tech meetups, hackathons, conferences **and** consumer gadgets & electronics (phones, audio, laptops, gaming gear) incl. their promos. |
| **DEFER** | `TOOLS_AND_HARDWARE` | — | — | Split out of `HOME_AND_LIVING` only if the §5 trigger fires. |
| **REJECT** | `LIFESTYLE`, bare `TOOL`, `GADGET_AND_LIFESTYLE` | — | — | Unbounded / ambiguous / overlapping (R1-1, R1-4, R1-2). |
| **OPEN** | `SHOPPING_AND_RETAIL`, `PROPERTY` | — | — | Logged, not decided (F-D). |

## 5. Evidence gate (run before building; I have no prod access)

```sql
-- category distribution among live events
SELECT c AS category, count(*) AS n
FROM events, unnest(categories) AS c
WHERE deleted_at IS NULL
GROUP BY 1 ORDER BY 2 DESC;

-- OTHER-only events to sample by hand (~50): read eventName + source caption
SELECT e.event_name, e.types, p.content
FROM events e JOIN posts p ON p.id = e.post_id  -- events.postId is the PRIMARY-post pointer
WHERE e.deleted_at IS NULL AND e.categories = ARRAY['OTHER']
ORDER BY random() LIMIT 50;
```

Triggers (proposed, tune freely): add/keep `HOME_AND_LIVING` and `FASHION_AND_BEAUTY` if sampled `OTHER` events show ≥ ~5% in each; split `TOOLS_AND_HARDWARE` out of home if tool/hardware posts are ≥ ~2% of events or ≥ 3 distinct accounts.

## 6. Ripple checklist (for the implementing story, modelled on `spec-religion-and-spirituality-category.md`)

1. `packages/shared-types` enum (+ definition comments).
2. `apps/backend/src/schema/events.graphql` enum; regenerate codegen (web + backend `resolvers-types.ts`).
3. `packages/database/schema.ts` pgEnum + `ADD VALUE IF NOT EXISTS … BEFORE 'OTHER'` migration (cosmetic since column is `text[]`, kept for convention).
4. `apps/web/locales/en.json` + `id.json` (incl. `TECHNOLOGY` label change); 0.34 tests fail if missed.
5. **New**: category glossary constant, consumed by `build-gemini-request.ts` and `build-filter-extraction-request.ts`; ratchet test "every `EventCategory` has a glossary entry".
6. PRD `EventCategory` block + any Section 3 mentions; AD amendment (next free AD, ≥ AD-42) and `project-context.md` rule.
7. Seed: add fixtures for new categories so FilterHub e2e covers them.
8. No architecture-diagram change (no service/queue/provider change).
9. Correct `deferred-work.md`: pgEnum is unused by any column.

## 7. Owner decisions (2026-10-23)

- **F-A** Gadget: **keep the existing `TECHNOLOGY` as is** (name and label unchanged). Its definition widens to consumer gadgets (AD-44 Rules 2, 4); no new value, no relabel.
- **F-B** Tool: **fold** into `HOME_AND_LIVING`. `TOOLS_AND_HARDWARE` deferred behind an evidence trigger.
- **F-C** `FASHION_AND_BEAUTY`: **added**.
- **F-D** Owner asked whether `SHOPPING_AND_RETAIL` is needed given `EventType` already has `MARKET` and `PROMOTION`. Conclusion: **no** — shopping is a form/intent, not a subject; a many-product sale is `OTHER` + `PROMOTION`/`MARKET`. Property is investment-adjacent: routed to `BUSINESS_AND_NETWORKING` by definition, no new value (`FINANCE_AND_INVESTMENT` deferred behind a trigger).

## 8. Final taxonomy: 21 values

Existing 18 unchanged (`TECHNOLOGY` definition widened) + `HOME_AND_LIVING` + `FASHION_AND_BEAUTY` + `FINANCE_AND_INVESTMENT` (owner-directed 2026-10-23, property routed into it), all inserted before `OTHER`.

## 9. Coordination note

AD-42 (planning branch `claude/ecstatic-shannon-e8eh9h`, `[PROPOSED]`, not on master) says "the closed `EventCategory` (18 values) … stay as coarse facets" and lets interests name a parent category. Compatible; its "18" becomes 20 when both land. This decision took **AD-44** because AD-42 and AD-43 are taken on that branch.

## 10. Follow-up questions (2026-10-23)

- **Fashion & Beauty for male users:** yes by design. Categories are audience-neutral (the system has no user-gender concept; AD-42 models gender only as event `tracks`/`eligibility`). The definition now names menswear, streetwear, sneakers, barbershop and grooming explicitly. Resolved 2026-10-23 (owner): Indonesian label is "Fashion & Gaya" ("Kecantikan" read as female-coded).
- **Market/promo vs `BUSINESS_AND_NETWORKING`:** the name invites Gemini to tag any commercial event as business. AD-44 Rule 4 now limits it to a professional/trade audience; consumer bazaars, sales and promos take the subject of what is sold. Co-tagging is allowed only when a trade or business-matching purpose is stated. No repo data confirms the mis-tagging rate; the §5 query should also count `MARKET`/`PROMOTION` events carrying `BUSINESS_AND_NETWORKING`.

## 11. Review cycle on AD-44 (2026-10-23): four independent reviewers, dispositions

Reviews are in `reviews/`: `review-rubric-walker.md`, `review-reality-check.md`, `review-adversarial-pair.md`, `review-code-feasibility.md`. No critical finding survived verification as a defect in the *design*; several were defects in the AD's *wording* and are fixed. AD-44 was rewritten (10 Rules).

| Finding (reviewer) | Disposition |
|---|---|
| Rule 4 contradicts itself on property / trade-vs-public fairs / tool roadshows (walker H4, adversarial C-1) | **Fixed.** Ordered decision procedure; property is the one named exception (Rule 5). |
| Multi-label with no cap and a stale `OTHER` clause (adversarial C-2) | **Fixed, adjusted.** Cap 4 not 3 (the CC-024 festival has 4); `OTHER` exclusive; both enforced in the transform (Rule 2). |
| Ratchet unbuildable / only checks non-empty / blind to prose (walker H5, adversarial C-3, code H3) | **Fixed.** Render-and-assert on built prompts, one shared renderer, bounded definitions, aliases, negative controls (Rule 4). |
| "0.34 tests fail if any source is missed" is false (all four) | **Fixed.** Closed source register; new checks for codegen, locales (exact keys), seeds; hand-review list (Rule 6). |
| Unknown value "falls back to OTHER" is false; Ajv drops the whole extraction (reality M1) — **verified by me** at `process-ai-job.ts:158-164` | **Fixed** (Rule 2). |
| Removal failure mode mis-stated; store inventory incomplete (reality H2, adversarial M-6) | **Fixed.** Nulls the list not the row; widgets silently broaden; full store list (Rule 8). |
| Deploy order / rollback undecided (walker H3) | **Fixed.** Accepted bounded window; rollback needs row cleanup (Rules 7, 8). |
| pgEnum is dead; `drizzle-kit` emits plain `ADD VALUE` (reality M2) | **Decided: retire it** (`DROP TYPE IF EXISTS`, no cascade) rather than hand-edit a migration for a dead type (Rule 6). |
| S1/S2 coupled; S1 is a live behaviour change (code H5) | **Fixed.** S1 names only the 18; S2 amends; interim effect accepted (Follow-ups). |
| Four prose copies of definitions contradict the widened `TECHNOLOGY` (code H2) | **Fixed.** Comments become pointers (Rule 4). |
| Tagging quality unmeasured; evidence rule unmeasurable; "2% or 3 accounts" fires instantly (walker H6, adversarial H-3) | **Fixed.** AND of 50 events / 3 accounts / 2%, post-cutoff window, structured log lines, golden corpus (Rules 6, 10; Deferred). |
| Rule 7 "short-lived" contradicts Archive and re-extraction (walker, adversarial H-4) | **Fixed.** Premise dropped; sparse older facet accepted (Rule 7). |
| Esports, batik, aesthetics, services expos, sports apparel silent (adversarial H-6) | **Fixed** in the boundary table; esports→HOBBIES is a default the owner may flip. |
| "Rumah & Hunian" invites property expos into `HOME_AND_LIVING` (adversarial H-5) | **Fixed by me:** ID label is now "Rumah Tangga & Interior" (this label was my proposal, not the owner's). |
| "Fashion & Gaya" drifts toward the rejected "lifestyle" (adversarial H-5) | **Kept — owner's explicit choice.** Risk recorded in Rule 3; the definition governs tagging. |
| Property inside `BUSINESS_AND_NETWORKING` when it is a consumer sale (adversarial) | **Kept — owner-directed.** Earlier `FINANCE_AND_PROPERTY` split is a Deferred trigger. |
| Prompt version stamp / token cost (walker M, code) | **Deferred.** Nothing pins prompt text; ~+0.5–1.0K tokens/call (estimate). |
| Docs-side source register, 14-day deprecation clock, FilterHub empty-state hint, one-time reclassification, golden corpus as CI gate (adversarial) | **Rejected** as cost without measured need; the corpus runs live only manually/nightly. |
| project-context states future state as current; record stale; wrong SQL column (reality M5–M7) | **Fixed.** Rule marked plan-only; record corrected. |

Owner defaults to flip if wanted: cap 4 vs 3; esports → HOBBIES vs SPORTS; ID label for Home & Living.

## 12. Owner decision 2026-10-23: finance and investment

Added `FINANCE_AND_INVESTMENT` ("Finance & Investment" / "Keuangan & Investasi"). Property, KPR, stocks, funds, bonds, gold, crypto, forex and commodity trading route here; `BUSINESS_AND_NETWORKING` narrows to trade, B2B, networking, entrepreneurship. The name avoids "trading" (ambiguous with commerce). Story 0-52 keeps property/investment under `BUSINESS_AND_NETWORKING` as an interim (its ratchet forbids naming a value that does not exist yet); Story 0-53 moves them and is renamed to cover three values. Open: moderation posture for scam-prone finance events (not decided).
