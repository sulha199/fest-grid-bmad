---
title: EventCategory gap review (home & living, gadget & lifestyle, tool)
date: 2026-10-23
status: proposed — awaiting owner confirmation of forks F-A..F-D
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
| **ADD** | `HOME_AND_LIVING` | Home & Living | Rumah & Hunian | Furniture, appliances, décor, interior, housewares, home improvement and consumer DIY/hardware tools, home expos. Excludes property/real estate and industrial machinery. |
| **ADD** (F-C) | `FASHION_AND_BEAUTY` | Fashion & Beauty | Fashion & Kecantikan | Fashion shows/weeks, apparel & accessories sales, beauty/cosmetics launches and expos, grooming. |
| **CLARIFY** (no enum change) | `TECHNOLOGY` | Technology & Gadgets | Teknologi & Gadget | Software/tech meetups, hackathons, conferences **and** consumer gadgets & electronics (phones, audio, laptops, gaming gear) incl. their promos. |
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
FROM events e JOIN posts p ON p.id = e.primary_post_id
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

## 7. Owner forks

- **F-A** Gadget: relabel `TECHNOLOGY` (recommended) vs new `GADGETS_AND_ELECTRONICS` enum value.
- **F-B** Tool: defer + fold into `HOME_AND_LIVING` (recommended) vs add `TOOLS_AND_HARDWARE` now.
- **F-C** Add `FASHION_AND_BEAUTY` as the replacement for "lifestyle" (recommended) vs skip.
- **F-D** Whether `SHOPPING_AND_RETAIL` / `PROPERTY` deserve their own review (recommended: later, after §5 data).
