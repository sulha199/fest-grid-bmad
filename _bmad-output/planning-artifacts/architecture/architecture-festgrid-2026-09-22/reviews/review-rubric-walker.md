---
title: AD-44 rubric-walker review
date: 2026-10-23
reviewer: independent architecture reviewer (rubric walker)
subject: AD-44 "EventCategory Is a Closed Subject Taxonomy With One Definitions Source" (festgrid-architecture-spine.md, line 2454 to next `---`)
inputs: project-context.md "Event categories" rule; event-category-review-2026-10-23.md; AD-1, AD-6 (master spine); AD-42 and AD-43 (origin/claude/ecstatic-shannon-e8eh9h); brownfield code (shared-types, build-gemini-request.ts, build-filter-extraction-request.ts, schema-consistency.test.ts, locales.test.ts, schema.ts, validation schemas, CI workflows)
verdict: NEEDS CHANGES. The decision itself (closed subject taxonomy, one definitions constant, no new sibling categories) is sound and ratifies the codebase, but most of its `Prevents` bullets rest on human judgement rather than a mechanical rule, Rule 5 overstates what Story 0.34's tests catch, and rollout/rollback, tagging-quality measurement and two boundary rules are left undecided or self-contradictory.
---

# AD-44 rubric-walker review

## Rubric scorecard

| Rubric item | Result |
|---|---|
| Fixes the real divergence points, misses none | Partial. Core points covered (definitions source, membership, boundaries). Missed: rollout order and rollback, prompt versioning, tagging-quality measurement, who authors the other 13 definitions, category count per event. See H3, H6, M1, M3, M4. |
| Rule is enforceable; each `Prevents` traceable to a mechanical Rule | Fail for 4 of 6 bullets. See H1. |
| Nothing under Deferred lets two units diverge | Mostly OK. Two triggers are unmeasurable or fire trivially. See M5. |
| Named tech/versions verified current | OK. AD-44 names no versions. `ALTER TYPE ... ADD VALUE IF NOT EXISTS` already used by migrations 0003 and 0038. The Gemini model in env.ts is `gemini-3.5-flash-lite` (lite tier), whose sensitivity to definition text is unmeasured (H6). |
| Ratifies brownfield rather than contradicting it | Mostly OK; project-context states future facts in the present tense. See M6, L2. Rule 5 mis-describes what exists. See H2. |
| No contradiction with AD-1, AD-6, AD-42 | AD-1: compatible, but saved-filter semantics shift is unaddressed (M2). AD-6: compatible, one boundary to state (L3). AD-42 Rule 7/8/10 and Rule 5 versions: unaddressed interactions (M1, M7). |
| Every owned dimension decided, deferred or open | Fails on migration/rollout, prompt versioning, API/enum compatibility, observability, and the Rule 5 evidence check. |
| Internal consistency | Several defects. See H4, M5, L1, L4. |

Counts and labels check: "20 values" (18 + `HOME_AND_LIVING` + `FASHION_AND_BEAUTY`) is correct in AD-44, project-context and the review record §8. Labels "Home & Living" / "Rumah & Hunian" and "Fashion & Beauty" / "Fashion & Gaya" are identical everywhere they appear. The one label inconsistency is in the review record, not the AD (L1).

---

## HIGH

### H1. Four of six `Prevents` bullets have no Rule that mechanically stops them, and AD-44 has no "Enforced by" section

Location: `Prevents` bullets 2 to 6 vs `Rule` 1, 2, 4, 6 (AD-42 has an `Enforced by` block; AD-44 does not).

What is wrong. Traceability of each bullet:

| Prevents bullet | Rule that addresses it | Mechanical? |
|---|---|---|
| Tagged differently because the model saw only names | Rule 3 | Partly. The ratchet only checks "non-empty entry", which does not make tagging consistent, and the AD says each sentence must include "its exclusions" without testing it. |
| Second `OTHER` under a vague name | Rule 1 | No. Pure prose. |
| Two siblings claiming one subject | Rules 2, 4 | No. Review judgement only. |
| Category named for a form | Rule 1 | No. |
| Bare ambiguous noun | Rule 1 | No. |
| Removing a value breaks serialization | Rule 6 | No. A process instruction, nothing fails if it is skipped. |

The only mechanisms that exist are Story 0.34's SDL/locale tests (which do not test any of the above) and the new Rule 3 ratchet.

Failure scenario. A later story adds `LIFESTYLE_AND_SHOPPING` or deletes `CAREER`. Story 0.34's tests pass if all sources are edited together (SDL and shared-types stay in sync; `locales.test.ts` uses `arrayContaining`, so stale keys also pass). Rule 1 and Rule 6 are only prose, and nobody reads AD-44 at story time unless the story template points to it. The deletion ships, and stored rows carrying `CAREER` then fail GraphQL serialization (`categories: [EventCategory!]` is non-null per item).

Proposed fix. Add an `Enforced by` block and make two additions to the Rule:

> **Rule 9. The taxonomy is frozen by a snapshot test.** A test in `packages/shared-types` compares `Object.values(EventCategory)` with a committed list `EVENT_CATEGORY_HISTORY` (append-only: every value that has ever shipped, never removed). It fails if (a) a member of the history is missing from the enum (removal or rename without Rule 6), or (b) the enum has a member not in the history (a new value must be added to the history in the same change, and the PR description cites the Rule 5 evidence). It also fails if a new member name matches `/^(LIFESTYLE|GENERAL|MISC|SHOPPING|PROMO|SALE|MARKET|TOOL)/`, which is a cheap guard for Rule 1.
> **Enforced by:** Story 0.34 (SDL and locale drift), Rule 3's ratchet, Rule 9's snapshot test, and the story template line "if the story touches `EventCategory`, link AD-44 and paste the Rule 5 evidence".

And reword `Prevents` so it claims only what a mechanism stops, moving the rest to "reviewed, not mechanically prevented".

### H2. Rule 5 claims "the 0.34 consistency tests must fail if any is missed"; they do not, for five of the nine listed sources

Location: Rule 5; project-context ("Story 0.34 tests catch drift").

What is wrong. Verified against the repo, Story 0.34 delivered exactly: (1) `apps/backend/src/schema/schema-consistency.test.ts`, exact set equality of SDL `EventCategory` vs shared-types; (2) `apps/web/locales/locales.test.ts`, `expect(localeKeys).toEqual(expect.arrayContaining(enumMembers))` on `en.json`, with `id.json` covered only transitively by an "id mirrors en" test; (3) a locale-switch Playwright test; (4) a runtime schema-build test. Not covered:

| Source named in Rule 5 | Covered by 0.34? |
|---|---|
| shared-types | Yes (is the reference) |
| GraphQL SDL | Yes |
| codegen output (`apps/web/src/generated/graphql.ts`, `apps/backend/src/generated/resolvers-types.ts`) | No. The story explicitly excluded it, and `ci.yml` has no codegen-freshness check. Impact is type-only (UI chips are built from shared-types), so low harm. |
| `en.json` / `id.json` | Yes for add; NOT for removal (`arrayContaining` ignores extra keys) |
| definitions constant | Only by the new Rule 3 ratchet |
| PRD `EventCategory` block | No test |
| `ADD VALUE IF NOT EXISTS` migration and `pgEnum` in `schema.ts` | No test. `eventCategoryEnum` is referenced by nothing but a comment (`schema.ts:437`). |
| seed fixture | No test |

Failure scenario. A developer adds a value, forgets the `pgEnum` and migration (the column is `text[]`, so nothing breaks), and nobody finds out. Months later someone treats `event_category` as authoritative (a CHECK, a reporting view, or a future column) and finds it 2 values short. Separately, a removal leaves stale locale keys with no failing test.

Proposed fix. Replace the sentence with an accurate one and add the missing mechanisms or drop the dead ones:

> "The 0.34 tests catch SDL and `en.json` omissions only. This AD adds: (a) the Rule 3 ratchet; (b) Rule 9's snapshot test; (c) a test that `eventCategoryEnum.enumValues` equals `Object.values(EventCategory)`, or, preferably, the pgEnum and its migrations convention are retired (see Deferred) so there is no dead source to keep in step. The PRD block and seed fixture are checklist items in the story, not test-enforced; the story's Definition of Done lists them."

Also change `locales.test.ts` guidance so locale keys are checked both ways (exact equality), which Rule 6 needs.

### H3. Rollout order and rollback are not decided, and Rule 6's migration list is incomplete

Location: Rule 5 ("one change"), Rule 6, Rule 7.

What is wrong. The backend is several independently deployed Lambdas (API, AI processor, Ingestor; `docs/infrastructure/architecture-diagram.md`). "One change across every source" describes the commit, not the deployment. A new value is written by the AI processor/Ingestor path and read by the API Lambda through the SDL. Nothing says deploy order or what happens during the window or on rollback. Rollback of a release that added `HOME_AND_LIVING` is, in effect, a removal, which Rule 6 forbids without a data migration, but a deploy rollback is an operational action not covered by it.

Failure scenario A (order). The AI processor Lambda deploys first and emits `HOME_AND_LIVING`; the Ingestor still has the old shared-types and `transformGeminiResponseToEventInfo` silently maps the unknown value to `OTHER` (data silently lost, no log). Scenario B (rollback). The release is rolled back after a day; the old API Lambda's SDL lacks the value; every `Query.events` page that contains one such event fails enum serialization on `categories: [EventCategory!]`, taking the Discovery page down, not just the one row. Scenario C (Rule 6 scope). Rule 6 lists `events.categories`, `widgets.filters`, saved AI filters, but the repo also stores categories in `corrections.proposed_data` (typed `ProposedEventCorrection`), `manual_extraction_jobs.request_payload` / `result_data`, `extraction_audit_logs`, and `unprocessed_scraper_payloads`; the moderator queue and correction apply path validate with `z.nativeEnum` / AJV enums (`proposed-event-correction.schema.ts`, `filter-node-schema.ts`) and would reject a stored value that was removed.

Proposed fix. Add to Rule 5 and Rule 6:

> "Deploy order for an added value: SDL and API first (accepts the value), then the Ingestor/AI processor (starts emitting it), then web. Rollback below the API release that added a value is forbidden once any row carries it; the pre-condition is `SELECT 1 FROM events WHERE 'X' = ANY(categories)` returning zero, or the rollback reads the value through a tolerant resolver. The API keeps a tolerant read: an `EventCategory` member unknown to the running SDL is mapped to `OTHER` at the resolver boundary rather than failing the page. Rule 6's stored-value inventory is: `events.categories`, `widgets.filters`, `ai_event_filters.resolved_filter`, `corrections.proposed_data`, `manual_extraction_jobs.request_payload/result_data`, and the `extraction_audit_logs` rows (read-only, left alone and listed so readers tolerate historical values)."

If the tolerant resolver is rejected, state that as an open question with an owner.

### H4. Rule 4 contradicts Rule 1 and the project-context rule on property, and defines a category by audience

Location: Rule 4 (property sentence, `BUSINESS_AND_NETWORKING` sentence) vs Rule 1 and project-context.

What is wrong. Two separate contradictions.

(a) Property. Rule 4 sends "property and investment expos or seminars" to `BUSINESS_AND_NETWORKING`, and project-context says "property/investment → BUSINESS_AND_NETWORKING" with no qualifier. Rule 4 then restricts `BUSINESS_AND_NETWORKING` to "a professional or trade audience" and says a consumer-facing sale or promotion "takes the subject of what is sold". A consumer housing or KPR (mortgage) fair, a very common Indonesian mall event, is both "property expo" and consumer-facing. The subject of what is sold is housing, which has no category; `HOME_AND_LIVING` ("home improvement", "interior") is the nearest and the review record explicitly said it "must explicitly exclude property or it will absorb it", but the AD's definition list does not carry that exclusion. Three correct readings (`BUSINESS_AND_NETWORKING`, `HOME_AND_LIVING`, `OTHER`) exist.

(b) Audience. Rule 1 says "Categories are audience-neutral: none is defined by gender, age or eligibility", yet Rule 4 defines `BUSINESS_AND_NETWORKING` by "professional or trade audience". The stated reason for audience-neutrality (AD-42 models audience as `tracks`/`eligibility`) is exactly what the Rule 4 sentence reintroduces for this category.

Failure scenario. Unit A tags a mall property fair `HOME_AND_LIVING`, unit B `BUSINESS_AND_NETWORKING`, a third `OTHER`; the facet splits, which is the exact thing the AD exists to prevent. A reviewer enforcing Rule 1 rejects the `BUSINESS_AND_NETWORKING` definition.

Proposed fix.

> Rule 4, property: "Property and real-estate fairs, housing and KPR expos, and investment seminars → `BUSINESS_AND_NETWORKING` regardless of audience (property is investment-adjacent, `[ADOPTED, user-directed]`). `HOME_AND_LIVING` explicitly excludes buying, selling or financing property. Consumer-facing sales of goods are classified by what is sold."
> Rule 1 / Rule 4, audience: replace "for a professional or trade audience" with "the subject is business activity itself (networking, entrepreneurship, B2B and trade expos, franchise and UMKM matching, investor seminars). This is a subject test, not an audience test: a consumer bazaar is not business activity merely because it sells things." Update project-context to the same wording.

### H5. The Rule 3 ratchet cannot be implemented as written and does not test what the Rule says definitions must contain

Location: Rule 3, last sentence.

What is wrong.
1. "fails ... if either prompt builds its category list from anything but this constant" is a source-scan. Both prompt files legitimately keep `Object.values(EventCategory)` for the `responseSchema` enum (`build-filter-extraction-request.ts:82`, `build-gemini-request.ts:27`), plus the validators. A naive grep either false-positives on those lines or is bypassed by renaming a variable. No specification of how to distinguish them.
2. The data check is "non-empty entry". Rule 3 says each sentence includes "its exclusions", and Rule 4 lists mandatory boundary statements, but nothing tests that `TECHNOLOGY` mentions gadgets or that `HOME_AND_LIVING` excludes property. `"TBD"` passes.
3. The rule says "both prompts" only. AD-42 adds an insight object to the same extraction call and says interests "may name a parent category"; any third prompt that lists categories (AD-42's, a moderator re-extract variant, the AI-assisted correction) is outside the Rule.

Failure scenario. A dev adds `LIFESTYLE` with the definition "Lifestyle events." The ratchet passes (non-empty), the prompt renders it, and the Rule 1 catch-all is now live. Another dev edits `buildFilterExtractionSystemInstruction` and inlines a hand-written category list; the source scan does not match its pattern and passes.

Proposed fix.

> "Rule 3 (replace last sentence): the constant is typed `Record<EventCategory, string>` so the compiler rejects a missing entry. One exported function `renderCategoryList()` returns the `NAME — definition` lines and is the only function allowed to produce category text for a prompt. Tests: (a) build each of the two prompts and assert that for every `EventCategory` the exact `NAME — definition` line occurs in it; (b) a unit test on the constant that each definition has 40 to 400 characters, contains no `TBD`, and, for the members named in Rule 4, contains the required boundary keywords (`TECHNOLOGY`: gadget; `HOME_AND_LIVING`: appliance, DIY, excludes property; `BUSINESS_AND_NETWORKING`: trade; `FASHION_AND_BEAUTY`: menswear; `AUTOMOTIVE`: car accessories); (c) a lint rule or test that no file under `apps/backend/src/lib/**/build-*-request.ts` calls `Object.values(EventCategory).join`. Any prompt that names categories uses `renderCategoryList()`, including future prompts (AD-42)."

### H6. Tagging quality is never measured, before or after, and the evidence gate in Rule 5 has no owner, method or place to run

Location: Rule 5 last two sentences; Rule 7; Deferred ("the production evidence query"); Follow-ups.

What is wrong.
1. The AD's purpose is consistent tagging, but there is no measurement: no extraction golden set for categories (the only golden set, `ai-filter-golden-prompt-nightly-eval.yml`, is for filter prompts), no `OTHER` share metric (`emit-metric.ts` / CloudWatch EMF exists and could carry it), no counter for the silent `OTHER` fallback in `transformGeminiResponseToEventInfo`, no way to learn whether the definitions changed model behaviour on the lite-tier `gemini-3.5-flash-lite`.
2. Rule 5's "evidence" condition for new values is unowned. "a hand-read sample ... showing the subject recurring across several accounts" has no sample size, no threshold ("several"), no reviewer, and no artefact where it is recorded. The record gives ~50 sampled `OTHER` events, ≥~5% (add) and ≥~2% or ≥3 accounts (split), but AD-44 itself says "several accounts" and the Deferred list says "roughly 2% ... or three or more distinct accounts". The record's SQL (`categories = ARRAY['OTHER']`) also (i) returns no account column, so "across several accounts" cannot be read from it, (ii) is saturated by correct `OTHER` results from Rule 4's many-product sales, and (iii) misses mis-tagged events sitting under a wrong category (a gadget promo tagged `HOBBIES_AND_INTERESTS`).
3. Rule 5 says the query is "a pre-build sanity check", Deferred lists "the production evidence query" as deferred, and no Follow-up contains it. A story author cannot tell whether to run it.
4. Nothing in AD-44 says how Rule 5's evidence requirement is checked at review time.

Failure scenario. The definitions ship, `OTHER` quietly goes up or down, and no one can tell whether the change helped. Six months later a contributor adds `GADGETS` citing "I read some posts", and Rule 5 is satisfied by assertion.

Proposed fix.

> "Rule 5a (evidence record). A new value requires a file `_bmad-output/planning-artifacts/architecture/.../category-evidence-YYYY-MM-DD.md` containing: the query, sample size (at least 50), the per-account counts, the share of the whole population, and a named human reviewer. The PR template for any change under `packages/shared-types/src/index.ts` requires that link. Thresholds: at least 5% of the `OTHER`-only sample, from at least 3 distinct accounts."
> "Rule 10 (observability). Emit one EMF metric per extraction: `category_other_only` (boolean) and `category_fallback_to_other` (the unknown-value fallback). A weekly report counts `OTHER`-only share, the `BUSINESS_AND_NETWORKING` share among `MARKET`/`PROMOTION` events (the record's own concern), and the top 20 accounts with `OTHER`-only events. Before story 1 ships, take a baseline from the Rule 5 query; after, compare. Add an extraction golden set of at least 30 labelled posts covering every Rule 4 boundary and run it nightly alongside the filter golden eval."
> Make the evidence query part of Follow-up 1's acceptance criteria and remove it from Deferred.

---

## MEDIUM

### M1. Prompt change has no version stamp, no cost number and no link to AD-42's gates

Location: Rule 3; Rule 7 ("Re-extraction is not run for a taxonomy change").

What is wrong. Adding 20 definition sentences to the system instruction of both Gemini calls adds input tokens on every post (and on every AI-filter request). AD-42 Rule 1 measured +931 input tokens as its marginal cost and Rule 11 decides whose key pays; AD-44 gives no figure. AD-42 stamps `insight_version` ("prompt plus schema") and its Rule 10 requires labels frozen before any run; changing the category text in the same system instruction mid-POC invalidates run-to-run comparisons unless the change is versioned. There is no prompt-version concept for categories at all today, so no event records which definitions tagged it.

Failure scenario. The POC runs three extraction runs per event, with the AD-44 change landing between runs 2 and 3; a "disagreement" is the prompt, not the model. Subscriber-key costs rise unannounced.

Proposed fix. Add: "Measure the added input tokens of `renderCategoryList()` (record the number in the AD, expected below 1k) and note that BYOK subscribers pay it. The rendered list has a content hash `categoryDefinitionsVersion`; it is written to `extraction_audit_logs` with each extraction, and AD-42's `insight_version` includes it. AD-44's prompt change lands before the AD-42 POC labelled set is frozen, or the POC is re-run on it. Order is stated as a dependency."

### M2. Widening `TECHNOLOGY` silently changes the meaning of saved filters, widgets and push subscriptions

Location: Rule 2 (definition widens); Rule 7.

What is wrong. AD-1 lets any client send `category in [TECHNOLOGY]`, and the repo persists such filters in `widgets.filters`, `ai_event_filters.resolved_filter`, and (AD-1 names) push notification filtering. Widening `TECHNOLOGY` to consumer gadgets and gaming promos makes every existing saved filter and widget start matching gadget sales for newly extracted events only (Rule 7), so old and new results of the same filter differ in kind. The user-visible label stays "Technology" (the owner declined "Technology & Gadgets"), so users get no signal.

Failure scenario. A developer-meetup widget embedded on a third-party site starts showing 50%-off earbuds.

Proposed fix. State it: "Widening `TECHNOLOGY` is a deliberate semantic change for new events. Known consumers (embed widgets, push filters) are not migrated; the release note says so. Open question for the owner: should existing widgets and push filters be offered a one-time notice?" Mark the decision `[ADOPTED, user-directed]` or `[OPEN]`.

### M3. Definitions for the other 13 existing values, and the maximum number of categories per event, are not decided

Location: Rule 3 ("one sentence per value"), Rule 1 ("a post may carry several").

What is wrong. Rule 3 requires an entry for all 20 values, but Rule 4 and the record supply text for only 7 or so. The remaining 13 would be written by the story author, from one-line code comments that are themselves inconsistent between `shared-types`, the SDL and `schema.ts` comments (and `MUSIC`, `HOLIDAY`, `FAMILY_AND_KIDS` have none). Neighbour overlaps that will actually occur are not stated: `FASHION_AND_BEAUTY` skincare/cosmetics vs `HEALTH_AND_WELLNESS` (aesthetic clinics, spa), wedding expos (the record leaves wedding as `OTHER` in a table row only), pet and baby products vs `HOBBIES` / `FAMILY_AND_KIDS`, esports vs `SPORTS_AND_FITNESS` vs `TECHNOLOGY` ("gaming gear" is stated, gaming events are not), supermarket and grocery promos vs `FOOD_AND_DRINK`. Rule 1 "may carry several" has no cap; the prompt currently says "select appropriate values", and more definitions invite more tags per post, which dilutes the facet.

Failure scenario. Two stories write definitions for the same neighbours independently, or the same fashion-and-grooming post gets 1 tag on one run and 5 on another.

Proposed fix. "Rule 3: every definition states its single nearest sibling and the tie-break (for example, `FASHION_AND_BEAUTY`: 'skincare and cosmetics as products; clinics and treatments are `HEALTH_AND_WELLNESS`'). The 13 untouched values keep their current scope; the story drafts them and the owner approves the set once. Rule 1: an event carries at most 3 categories, primary first; the prompt says so and the schema has `maxItems: 3`." If a cap is not wanted, record "no cap" as decided.

### M4. Rule 7 "events are short-lived" is contradicted by the product, and no backfill path is left for the curator case

Location: Rule 7.

What is wrong. The repo has an Archive page and favorites that keep past events visible (`archive-content.tsx`, `favorites-content.tsx`), so old events are not invisible. Separately, AD-42 Rule 5 plans to re-extract events when the insight version changes, which would re-tag only the subset whose caption still exists; Rule 7 says "re-extraction is not run for a taxonomy change", but a version-bump re-extraction under AD-42 would change categories as a side effect. The two ADs disagree on whether categories refresh.

Failure scenario. After AD-42's backfill, 30% of old events (those with captions) carry the new categories, 70% (curator events) do not. The facet shows different recall for the same filter by account type.

Proposed fix. Rewrite Rule 7: "No dedicated backfill. Events refresh only when extracted or re-extracted for another reason (AD-42 Rule 5 version bump); the facet is expected to be uneven for archived events and for curator events whose caption is cleared. Archive-page recall for the new categories is explicitly not guaranteed."

### M5. Deferred triggers are unmeasurable or fire immediately

Location: Deferred.

What is wrong. `TOOLS_AND_HARDWARE`: "roughly 2% of live events **or** three or more distinct accounts". Three accounts is trivially reached in any catalogue with hundreds of accounts, so the "or" makes the 2% test irrelevant. And "tool/hardware posts" have no tag: they are folded into `HOME_AND_LIVING` (Rule 4), so no query counts them; it would need a keyword scan over `HOME_AND_LIVING` events, which is not specified. `FINANCE_AND_INVESTMENT`: "if ... outgrow `BUSINESS_AND_NETWORKING`" has no number. "The 24-value grouping review" (Rule 8) has no owner and the filter UI is a tap-to-toggle chip list without search.

Failure scenario. Two units read the triggers differently, one adds `TOOLS_AND_HARDWARE` after three accounts, the other refuses; or no one ever checks.

Proposed fix. "Trigger: at least 2% of live events **and** at least 3 distinct accounts, counted by the keyword list in the evidence record (list attached) over `HOME_AND_LIVING` events. `FINANCE_AND_INVESTMENT`: investment or property seminars at least 15% of live `BUSINESS_AND_NETWORKING` events. The weekly report of Rule 10 prints these numbers; the review owner is the architect on call." Remove "or".

### M6. The AD describes tests and constants that do not exist yet in the present tense; the status of Rules 3 to 8 is unmarked

Location: project-context "Event categories" bullet; AD-44 rules without status tags.

What is wrong. project-context says "(20 values)", "every value needs an entry in the one definitions constant ... a ratchet test enforces it", "Story 0.34 tests catch drift". Today the enum has 18 values, no constant, and no ratchet; the story that creates them is not written. A developer reading project-context now will believe the constant exists. AD-44's Rule 2 is tagged `[ADOPTED, user-directed]`, but Rules 3 to 8 carry no tag, unlike AD-42 where every rule is `[ADOPTED]` / `[PROPOSED]` / `[ASSUMPTION]`.

Proposed fix. Tag each rule (for example Rule 3 `[ADOPTED, architect]`, Rule 7 `[ADOPTED, owner 2026-10-23]`, Rule 8 `[PROPOSED]`). In project-context change to "will be (target: 20 values; the constant and ratchet are created by the Definitions-source story)" or add "(planned, not yet in code)" until the story is done.

### M7. Interaction with AD-42 Rules 7, 8 and 5 is described but not decided

Location: `Binds` (last sentence), Rule 8, Deferred (last sentence).

What is wrong.
- AD-42 Rule 8: "Events in sensitive categories ... never enter what the profile learns". The sensitive category set is not defined anywhere in AD-42 beyond the interest list (religion, civic or political, health, sexuality, ethnicity). AD-44 adds two values and does not state their sensitivity, nor that the sensitive set is keyed by enum name and must be re-reviewed when a value is added. `FASHION_AND_BEAUTY` could touch the health or body-image grey zone; `BUSINESS_AND_NETWORKING` (property/investment) is not sensitive but the owner should say so.
- AD-42 is on an unmerged branch, and the repo already needed a renumbering (`chore/renumber-ad-36-37`). AD-44 cites "AD-42 Rule 7" and "Rule 7 ... 18 values" by number; if AD-42 is renumbered or its Rule 7 changes, the reference dangles and "becomes 20 when both land" has no owner. Both branches append at the end of the spine, so a textual merge conflict is likely.

Proposed fix. Add to Rule 8: "Neither `HOME_AND_LIVING` nor `FASHION_AND_BEAUTY` is a sensitive category for AD-42 Rule 8 `[OPEN: owner to confirm]`. A new value requires a sensitivity decision in the Rule 5a evidence record." Add a follow-up: "Whoever merges the second of AD-42 and AD-44 updates AD-42 Rule 7's '18' to '20' in the same merge; AD-44's references use AD title as well as number."

---

## LOW

### L1. The review record is internally stale (feeds Follow-up 1)

Location: `event-category-review-2026-10-23.md` §4 table and §6 item 4 vs §7 F-A and AD-44 Rule 2.

The record's §4 "CLARIFY" row for `TECHNOLOGY` still reads EN label "Technology & Gadgets" / ID "Teknologi & Gadget", and §6 item 4 says "incl. `TECHNOLOGY` label change". §7 F-A and AD-44 Rule 2 (and the actual `en.json`/`id.json`: "Technology" / "Teknologi") say the label is unchanged. Follow-up 1 says the taxonomy story is "modelled on" the ripple list, so an implementer may apply the label change. The record also quotes Shopee 2020 data as dated evidence; it is correctly not relied on. Fix: edit §4 and §6 to "label unchanged", or mark them superseded by §7.

### L2. Rule 5 asks to keep the `event_category` pgEnum "for convention", creating a permanent dead source

Location: Rule 5 migration item; `Binds` last sentence.

The type is unused by any column (`events.categories` is `text[]`); the AD asks to keep adding `ADD VALUE ... BEFORE 'OTHER'` migrations. This is a recurring cost and a trap (a reader assumes the DB enforces the set). It is decided in the AD but not weighed in Alternatives. Fix: add to Alternatives or Deferred "retire `eventCategoryEnum` and its migrations convention (needs a destructive `DROP TYPE` migration, which is safe because no column uses it) or keep it under the H2 test. Decision: keep for now `[OPEN]`." Also correct `deferred-work.md` as Follow-up 3 already says.

### L3. Definitions are model-facing English text, but nothing states they are never user-facing

Location: Rule 3; AD-6.

AD-6 requires every user-facing string to have `en` and `id` keys. The definitions constant is English, which is fine for the model, but a later story could surface it as a chip tooltip or in the moderator correction form (`CorrectionForm.tsx`, which today shows labels only, so human corrections lack the definitions the model had, a divergence source in the correction ground truth). Also, the posts are Indonesian, and the definitions carry no Indonesian keywords (perabot, rumah tangga, properti, kosmetik), which the record shows matter for matching. Fix: add "The definitions are model-facing and not user-visible; if shown to people they follow AD-6 and get `en`/`id` keys. Each definition includes the common Indonesian terms for its subject."

### L4. Minor consistency and ordering notes

- Rule 2 inserts both values "before `OTHER`"; `Object.values` order drives chip order in FilterHub, `CorrectionForm` and the prompt, so chip positions shift for users. State that the order of the 18 existing values is frozen and the new values are inserted in the order given by Rule 2 (home, fashion), to avoid two units ordering them differently.
- Rule 4 says "gaming gear and their promos → `TECHNOLOGY`" while the record's JETE example also allows `HOBBIES_AND_INTERESTS` (optional). The AD should say whether a second tag is permitted or discouraged (ties to M3's cap).
- Rule 3 renders `NAME — definition` while Gemini's `responseSchema` already enum-constrains the value, so echoing a definition into an output is not a risk (verified: `build-gemini-request.ts:27`, `build-filter-extraction-request.ts:82`); keep the schema enum untouched. Worth one sentence so a later dev does not "simplify" it.
- `Binds` omits `proposed-event-correction.schema.ts`, `extracted-event.schema.ts`, `filter-node-schema.ts`, `explain-events-queries.ts` and `golden-prompt-fixtures.ts`. They derive from `Object.values(EventCategory)` today, so no change is needed, but listing them as "must keep deriving from the enum" ratifies the brownfield. The nightly filter golden eval also needs to run once after the prompt change (the record's fact 9 shows expected outputs are unchanged, but the prompt text changes).
- AD-1's "formal list of queryable fields ... maintained in the API documentation" is not updated by AD-44; if the API docs list category values, add them to Rule 5's checklist.

---

## Items checked and found sound

- Core decision (closed subject taxonomy, no `GADGET_AND_LIFESTYLE` / `TOOL` / `SHOPPING_AND_RETAIL`, one definitions constant, no two-level tree) matches the review record's final owner decisions and is the lower-risk option given the one-way door.
- "Unknown or empty falls back to `OTHER`" matches `transform-gemini-response-to-event-info.ts:28-31`.
- `events.categories` is `text[]` and `event_category` is unused by any column: verified (`schema.ts:54`, `:438`).
- "Gemini sees only enum names today" is accurate (`build-gemini-request.ts:199`, `build-filter-extraction-request.ts:19`); the structured-output `responseSchema` already constrains values to the enum.
- AD-1: the DSL `category in / notIn` stays valid for added values; no AD-1 contradiction (see M2 for semantics, H3 for removals).
- AD-6: the `EventCategory` next-intl namespace requirement is respected (Rule 5 lists both locale files).
- `ADD VALUE IF NOT EXISTS ... BEFORE 'OTHER'` is valid and already used by migrations 0003 and 0038.
- No architecture-diagram change is needed (no service, queue, Lambda, scraper, DB, provider or major library changes), so CLAUDE.md §4 is not triggered.
