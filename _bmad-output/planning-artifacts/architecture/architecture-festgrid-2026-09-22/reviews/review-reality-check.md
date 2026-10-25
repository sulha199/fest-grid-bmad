---
title: Reality-check review of AD-44 (EventCategory closed taxonomy, one definitions source)
reviewer: independent architecture reviewer (reality-check role)
date: 2026-10-23
reviewed:
  - _bmad-output/planning-artifacts/festgrid-architecture-spine.md (AD-44, lines 2454-2535)
  - _bmad-output/project-context.md (line 86, "Event categories")
  - _bmad-output/planning-artifacts/architecture/architecture-festgrid-2026-09-22/event-category-review-2026-10-23.md
method: every claim checked against the repo at HEAD 5ff986fb, plus two empirical runs (graphql-yoga serialization, drizzle-kit generate) and the Gemini docs fetched 2026-10-23.
---

# Verdict

AD-44's core design is sound and most of its repo facts are true, but five statements in it are wrong or overstated when checked against the code: what the Story 0.34 tests enforce, what happens to stored rows if a value is removed, what happens to an unknown category from the model, what the migration step really involves, and the project-context rule that describes a not-yet-built state as current. None is critical. Two are high because the AD cites them as its enforcement and its safety net.

Nothing in the repo ties a version, hash or cache to the prompt text, so no bump is needed today (finding M3).

# Verification table (what was checked, and the result)

| # | Claim | Result | Evidence |
|---|-------|--------|----------|
| 1 | `events.categories` is `text[]`; Postgres `event_category` used by no column | CONFIRMED | `packages/database/schema.ts:54` (pgEnum), `:438` (`text('categories').array()`), `:472` (index on it). Snapshot `migrations/meta/0080_snapshot.json:4386` defines the type; the only `categories` column in the snapshot is `events.categories` (`:1676`) typed text[]. `CREATE TYPE` in `0000_cultured_ultragirl.sql:2`; `ADD VALUE` in `0003_strong_stark_industries.sql:1`, `0038_smooth_switch.sql:1-5`. No other `.sql` or snapshot column references the type. |
| 2 | `widgets.filters` and `ai_event_filters` store category values; nothing else | PARTLY WRONG (see H2) | More places store them: `corrections.proposed_data` (`schema.ts:919`), `manual_extraction_jobs.result_data` (`:1106`), PostHog `filter_applied` (`home-content.tsx:207`), and the URL `categories` param (`home-content.tsx:77`). No category values in `extraction_audit_logs` (`schema.ts:624-657`), `subscriptions` (`:254`), `fcm_tokens`, or any Gemini response cache (none exists). |
| 3 | Gemini sees only enum names | CONFIRMED | `build-gemini-request.ts:199` and `:223`; `build-filter-extraction-request.ts:19`. The `responseSchema` enums also carry names only (`build-gemini-request.ts:27`, `build-filter-extraction-request.ts:82`). No definition comment is sent anywhere. |
| 3b | "Two prompts" is the whole set | CONFIRMED | Manual correction (`process-manual-extraction-job.ts:10,76`), the post pipeline (`process-ai-job.ts:3,129`) and `scripts/poc-ingestion-preview.ts:79,301` all call the one `buildGeminiExtractionRequest`. `start-post-reextraction-preview.ts` only gates keys; `build-reextraction-preview.ts` only runs the transform. `build-correction-classification-text.ts` and `classify-account-type.ts` never mention categories. The filter prompt is the second and last. |
| 4 | Removing an enum value breaks serialization of stored rows | TRUE BUT IMPRECISE (see H2) | Run on the installed graphql 16.14.2 and graphql-yoga 5.21.2 (output below). |
| 5 | Per-value definitions must go in the prompt text, not the schema | CONFIRMED (see section "Gemini structured output") | |
| 6 | Changing prompt text needs a version bump | NOTHING TO BUMP TODAY (see M3) | |
| 7 | Migration `ADD VALUE IF NOT EXISTS ... BEFORE 'OTHER'` | TRUE BUT INCOMPLETE (see M2) | drizzle-kit generate was run on a scratch copy (output below). |
| - | `transformGeminiResponseToEventInfo` "unknown or empty falls back to OTHER" | MISLEADING (see M1) | `process-ai-job.ts:158-164`. |
| - | Named files and paths exist | ALL EXIST | `packages/shared-types/src/index.ts`, `apps/backend/src/schema/events.graphql`, `apps/web/locales/{en,id}.json`, `multi-select.tsx` (at `packages/ui/src/core/multi-select.tsx`), `spec-religion-and-spirituality-category.md`, `0-34-harden-eventcategory-eventtype-cross-source-consistency.md`, `deferred-work.md`, PRD `EventCategory` block (`prd.md:358`). Not on this branch: AD-42 and AD-43 (the spine here jumps AD-41 to AD-44; they exist on `origin/claude/ecstatic-shannon-e8eh9h`, see L1). |

# Findings

## Critical

None.

## High

### H1. Rule 5 says the Story 0.34 tests "must fail if any [source] is missed". They cover two of the nine sources.

Evidence:
- `apps/backend/src/schema/schema-consistency.test.ts:29-45` compares the GraphQL SDL enum with `Object.values(EventCategory)`, and nothing else.
- `apps/web/locales/locales.test.ts:30-42` checks `en.EventCategory` contains every member (`arrayContaining`); id.json is covered only through the existing "id mirrors en" tests.
- Story 0.34 AC5 (`0-34-...md`) states that the web codegen output was checked by hand once, and `deferred-work.md:237` records that nothing enforces `apps/web/src/generated/graphql.ts` against shared-types.

Not covered by any test: the pgEnum in `schema.ts:54` and its migration, the backend `resolvers-types.ts`, the web `generated/graphql.ts`, the PRD block (`prd.md:358`), a seed fixture for the new value, and the definitions constant (new).

Failure scenario: a developer adds `HOME_AND_LIVING` to shared-types, the SDL and en.json, and all existing tests pass. They forget the pgEnum, the PRD block, the seed fixture and the codegen run. The AD's "Enforced by" text says CI would have caught it. Rule 5 and the Story 1 acceptance criteria are then written against a safety net that is not there.

Proposed fix wording (Rule 5): "The Story 0.34 tests cover only the SDL and en.json. The taxonomy story extends them to also assert: (a) `eventCategoryEnum.enumValues` equals `Object.values(EventCategory)` in the same order, (b) the committed `generated/graphql.ts` and `resolvers-types.ts` enum members equal shared-types, (c) every member has an `EVENT_CATEGORY_DEFINITIONS` entry, (d) the seed contains at least one event per member. The PRD block is a manual checklist item, not a test." Say plainly in the AD that (a) and (b) are new tests, not existing ones.

### H2. Rule 6 / "Prevents" mis-describe how a removed value fails, and the list of stored locations is incomplete.

Empirical result, run in the scratch dir against `apps/backend/node_modules` (graphql 16.14.2, graphql-yoga 5.21.2), with `categories: [C!]` and a stored value that is no longer in the enum:

```
graphql-js : {"errors":[{"message":"Enum \"C\" cannot represent value: \"GONE\"","path":["events",1,"categories",1]}],
              "data":{"events":[{"id":"1","categories":["A"]},{"id":"2","categories":null}]}}
yoga (HTTP): {"errors":[{"message":"Unexpected error.","extensions":{"code":"INTERNAL_SERVER_ERROR"}, ...}],"data":{... same ...}}
```

So (a) the whole row does not fail: only that field nulls (the field is nullable, `events.graphql:118`, so propagation stops there), and the response carries an `errors` array that yoga masks to "Unexpected error."; (b) where the field is non-null the null climbs to the nearest nullable parent: `corrections.graphql:34` (`ProposedEventCorrectionData.categories: [EventCategory!]!`) and `extraction.graphql:27`. Clients that treat any `errors` as failure will show an error for the whole list query.

Second, the two places the AD names do not fail that way at all. `widgets.filters` and `ai_event_filters.resolved_filter` are read through `resolveStoredFilter` (`packages/domain/src/ai-event-filters/resolve-stored-filter.ts:29-65`, used at `resolvers.ts:4675-4680`). It validates with `z.nativeEnum(EventCategory)` (`filter-node-schema.ts:96`) and on failure silently drops the unusable leaf and flags `degraded`. A widget whose only condition was the removed category becomes an unfiltered widget on a third-party embed (`widget/[id]/page.tsx`), with no error anywhere.

Third, incomplete inventory of places that hold category values:
- `events.categories` (text[])
- `corrections.proposed_data` jsonb (`ProposedEventCorrection.categories`, `packages/domain/src/events/types.ts:228`)
- `manual_extraction_jobs.result_data` jsonb (short-lived)
- `widgets.filters` and `ai_event_filters.resolved_filter`, each in two shapes: legacy flat `{categories:[...]}` and v2 `{version:2, expression:<tree>}` where leaves are `{field:'category', value:[...]}` at up to three levels (`resolve-stored-filter.ts:30-39`, `filter-node-schema.ts:92-97`). A rewrite is a recursive jsonb rewrite, not a column update.
- PostHog `filter_applied` events carry the raw strings (`home-content.tsx:207`), so a rename splits analytics history.
- Bookmarked and shared URLs: `categories` is read as plain strings (`parseAsString`, `home-content.tsx:77`) and sent on as filter-node JSON, so a stale value is rejected by `FilterLeafSchema`, not by GraphQL.

Failure scenario: a future story removes `TECHNOLOGY` after "rewriting events.categories and widgets.filters" per Rule 6. Pending corrections still carry it, so the moderator corrections list errors out. Saved AI filters and embedded widgets quietly widen. Dashboards show a dead series.

Proposed fix wording (Rule 6): "Removing or renaming a value is a data migration first, and the migration must rewrite every location that stores one: `events.categories`; `corrections.proposed_data.categories`; `widgets.filters` and `ai_event_filters.resolved_filter` in both stored shapes (legacy flat and v2 tree, recursively); pending `manual_extraction_jobs.result_data` (or wait for expiry). Un-migrated stored values degrade differently by place: GraphQL returns a null field plus a masked error (and a non-null parent where the list is `[EventCategory!]!`), while stored filters silently drop the condition and broaden. Analytics and bookmarked URLs keep the old value; the web app maps it or ignores it. Prefer deprecating a value (stop offering it to the model and the facet, keep it in the enum) over removing it."

## Medium

### M1. "unknown ... falls back to OTHER" is not what happens to an unknown category on the main path.

Evidence: `process-ai-job.ts:158-164` validates the whole Gemini payload with `extractedEventSchema`, whose per-event `categories.items.enum` is `Object.values(EventCategory)` (`validation/extracted-event.schema.ts:47-50`). On any unknown value `isValid` is false and the function logs and returns: the post's entire extraction is dropped, not coerced. The same schema is used in `process-manual-extraction-job.ts:130`, which throws `EXTRACTION_FAILED`. The fallback in `transform-gemini-response-to-event-info.ts:26-31` is only reachable for an empty array (the schema does not require `minItems`) or a caller that skips Ajv.

In practice the Gemini `responseSchema` enum constrains the model (`build-gemini-request.ts:27`), so this is rare. But it matters for a taxonomy change: the Ajv enum, the Gemini enum, `proposed-event-correction.schema.ts:47`, `filter-node-schema.ts:96` and six web option lists all derive from `Object.values(EventCategory)`, and AD-44's "Binds" omits them. They follow automatically, which is also why any value in the enum that the prompt describes badly can never be rejected by the pipeline.

Proposed fix wording (Binds): replace "(unknown or empty falls back to `OTHER`)" with "(an empty list falls back to `OTHER`; an unknown value fails Ajv in `extractedEventSchema` and drops the post's extraction, which is why the Gemini `responseSchema` enum, the Ajv enum, the correction schema and the filter-node schema must all derive from `Object.values(EventCategory)`)". Add those four derived consumers to Binds so the taxonomy story's ripple list names them.

### M2. The migration is a generate-then-hand-edit step, the dead enum is kept alive for nothing, and the AD does not say either.

Empirical: in a scratch copy of `schema.ts` with `'HOME_AND_LIVING', 'FASHION_AND_BEAUTY'` inserted before `'OTHER'` in the pgEnum list, `drizzle-kit generate` (drizzle-kit 0.21.4, drizzle-orm 0.30.10, the repo's versions) produced exactly:

```
ALTER TYPE "event_category" ADD VALUE 'HOME_AND_LIVING';--> statement-breakpoint
ALTER TYPE "event_category" ADD VALUE 'FASHION_AND_BEAUTY';
```

No `IF NOT EXISTS` and no `BEFORE 'OTHER'`. It produced no other diff, so the snapshots are currently in sync. The precedent spec records the same thing: `spec-religion-and-spirituality-category.md:34` ("hand-adjusted after `drizzle-kit generate` ... `drizzle-kit`'s default output had neither"), and `0003_...sql` / `0038_...sql` are the hand-edited result. Rule 5 lists the end state but not the hand edit, and nothing tests it. Applying the unedited file would work (the column is text[]), so a missed edit is silent; it only leaves the physical order out of line with `schema.ts`.

More important: `ALTER TYPE ... ADD VALUE` on a type no column uses has no runtime effect. Rule 5 keeps it "for convention", which means every taxonomy change carries a hand-edited migration plus a snapshot, and leaves a latent trap: someone later binds a column to the type and inherits the one-way door that `deferred-work.md:255` describes.

Proposed fix wording (Rule 5): "The migration is produced by editing the `eventCategoryEnum` list in `schema.ts` (new values before `OTHER`), running `drizzle-kit generate`, then hand-editing the SQL to `ADD VALUE IF NOT EXISTS ... BEFORE 'OTHER'` (drizzle-kit 0.21.4 emits neither clause; see 0003 and 0038). Alternative the owner should decide once: retire the dead type (`DROP TYPE event_category` in a migration, delete `eventCategoryEnum`) so taxonomy changes stop touching Postgres; then Rule 5 loses the migration item and the 'irreversibility' note in `deferred-work.md` becomes moot." I recommend making that decision now rather than carrying the convention forward.

### M3. "Does anything depend on the prompt text?" Answer: nothing does today. The AD and record should say so, and flag the one future coupling.

Searched: prompt hash or version constants, `parser_version_registry`, response caches, golden-prompt drift, the live cc-024 tests, snapshot files.

- No prompt hash, no prompt version, no `__snapshots__` directory anywhere. No Gemini response cache (`gemini-client.ts:55-80` just calls the SDK). `scripts/poc-ingestion-preview.ts:146-163` caches scrape results keyed by a hash of the URL, not the prompt.
- `parser_version_registry` (`schema.ts:1061`) versions the scraper payload mappers (`APIFY_PARSER_VERSION = '3.13'` at `instagram-adapter.ts:138`, Bright Data `'3.4g'` at `brightdata-record-mapper.ts:62,124`) for reprocessing unprocessed scraper payloads (`resolvers.ts:2620-2660`). Its `GEMINI` source row exists only in `seed.ts:666-672` and names a file, `gemini-extractor.ts`, that does not exist. It does not track the extraction prompt.
- `extraction_audit_logs` stores `gemini_model` only (`schema.ts:627`), not a prompt identifier.
- Existing tests do not pin the category text: `build-gemini-request.test.ts` and `build-filter-extraction-request.test.ts` contain no "categor" assertion, and the cc-024 live regression (`build-gemini-request.live-cc024-regression.test.ts`, opt-in, `RUN_LIVE_GEMINI_TESTS`) asserts grouping and event counts, not categories.
- Golden-prompt fixtures: no gadget, home, tool, fashion or beauty vocabulary (grep empty), so no `expected` changes (record fact 9 confirmed). The nightly live eval (`.github/workflows/ai-filter-golden-prompt-nightly-eval.yml`) uses the live `buildFilterExtractionSystemInstruction()` and a ledger keyed by fixture, not by prompt, so a prompt edit does not reset it; it will only show drift gradually (20 fixtures a night).

So: nothing to bump now. Two things the AD should state:
1. Re-running the golden-prompt live eval once after the definitions land is the only available check on the filter prompt change; trigger it with `workflow_dispatch`.
2. AD-42 (`[PROPOSED]`, branch `claude/ecstatic-shannon-e8eh9h`, Rule 5) introduces `insight_version` ("prompt plus schema") stamped per event, with re-derivation on change. If AD-42 lands first, rendering definitions into the prompt is a prompt change and must bump `insight_version`; if AD-44 lands first, AD-42's story must fold the definitions text into the version.

Proposed fix wording (new Rule 3 sentence): "No prompt version, hash or response cache exists today, so changing the rendered category text needs no bump; once AD-42's `insight_version` exists, a change to the category list or any definition is a version change."

### M4. project-context.md states a future state as the present.

`project-context.md:86` says `EventCategory` "is a closed subject taxonomy (20 values)", "every value needs an entry in the one definitions constant beside the enum in `packages/shared-types` (both prompts render from it; a ratchet test enforces it)". At HEAD the enum has 18 values (`packages/shared-types/src/index.ts:32-51`), there is no definitions constant, no ratchet test, and both prompts still print bare names (verification table row 3). CLAUDE.md makes this file mandatory reading for every implementation task, so an implementing agent will search for a constant that does not exist, or treat `HOME_AND_LIVING` as present.

Proposed fix wording: prefix with "(`[PLANNED]` until the taxonomy and definitions stories merge; today: 18 values, prompts list bare names)" and have the closing story of the pair remove the tag. Keep "Gemini sees only enum names" only as the reason, in past tense after it ships.

### M5. The "ratchet test" in Rule 3 cannot be written as stated, and the definitions are authored for one task but reused for two.

(a) "fails if either prompt builds its category list from anything but this constant" is a static-analysis claim over template strings. The repo's ratchet tests (for example `events-postid-write-ratchet.test.ts`, `explicit-any.ratchet.test.ts`) are grep-based; a grep on `Object.values(EventCategory)` would also fire on the legitimate `responseSchema` enums at `build-gemini-request.ts:27` and `build-filter-extraction-request.ts:82`. Write it as a behaviour test instead: build both system instructions and assert, for every `EventCategory` member, that the output contains the exact line `${NAME} — ${EVENT_CATEGORY_DEFINITIONS[NAME]}`; and assert that the constant has no keys outside the enum.

(b) The definitions include extraction-side rules such as "a sale spanning many unrelated products is `OTHER`" (Rule 4). In the filter extractor the model maps a user's words ("shopping festival", "gadget sale") to a filter. Feeding it extraction-only boundary rules can make it emit `categories: ['OTHER']` for a query that should be a keyword. State whether the filter prompt gets the same definitions verbatim or a short form, and add 3 to 4 golden fixtures (en and id) for "gadget promo", "home expo", "streetwear sale", "property seminar" before the filter prompt change ships.

### M6. The record contradicts itself on the TECHNOLOGY label.

`event-category-review-2026-10-23.md` §4 table still lists `TECHNOLOGY` as "Technology & Gadgets" / "Teknologi & Gadget", and §6 item 4 says "(incl. `TECHNOLOGY` label change)". §7 F-A, §8 and AD-44 Rule 2 and "Alternatives considered" say the label is unchanged (current label: `en.json:546` "Technology"). The frontmatter says `status: final`, and §6 is explicitly the ripple checklist an implementing story copies from.

Proposed fix: edit §4 row 3 to "label unchanged ('Technology'); definition only", delete "(incl. TECHNOLOGY label change)" from §6.4, and add "Superseded by F-A" next to the old label if history is wanted.

### M7. The evidence-gate SQL in the record joins a column that does not exist.

`event-category-review-2026-10-23.md` §5 second query uses `JOIN posts p ON p.id = e.primary_post_id`. `events` has no `primary_post_id`; the primary-post pointer is `events.post_id` (`schema.ts:455`, comment at `:452-453`). The query errors out. The AD makes this query a "pre-build sanity check" (Rule 5), and AD-44 Rule 5 and the Deferred list both cite it. Also, `posts.content` (`schema.ts:308`) is cleared for curator accounts once extraction finishes (AD-42 notes PRD 3.16), so the sample will show empty captions for those events and the reader should fall back to `events.description`.

Proposed fix: `JOIN posts p ON p.id = e.post_id`, select `e.description` alongside `p.content`, and add `AND e.merged_into_event_id IS NULL` so merged duplicates are not sampled twice. The first query (category distribution) matches `schema.ts` as written.

## Low

### L1. AD-44 cites AD-42 and AD-43, which are not in the spine on this branch.
The spine on this branch runs AD-40, AD-41, AD-44 (`festgrid-architecture-spine.md:2229,2296,2454`). On `origin/claude/ecstatic-shannon-e8eh9h`, AD-42 is at line 4263 and does say "The closed `EventCategory` (18 values) and `EventType` (12) stay as coarse facets; interests ... may name a parent category" (Rule 7, confirmed) and defines `tracks`/`eligibility` (Rule 2/3 area, confirmed). The AD's "Rule 7" reference is therefore accurate. Fix: add "(on branch `claude/ecstatic-shannon-e8eh9h`, not yet merged)" at the first mention in the Binds line, not only in Deferred and the record.

### L2. Fact 5 misattributes a seed post.
The wedding-package post is `FIXTURE_POSTS` id `...0017`, account `...0004` (`seed.ts:350-358`), not `pakuwonmall.jogja`. The JETE gaming post (`...0012`, `:300-308`) and the shopping festival post (`:258`) are the mall ones. It does not change any decision.

### L3. Prompt size and bundle.
Twenty one-sentence definitions with exclusions add roughly 600 to 1,000 tokens to every extraction call and every AI-filter call. Acceptable, but the AD has no stated budget, and the filter eval runs on a free-tier key (`GOLDEN_EVAL_DAILY_BUDGET: 20`). Also `@festgrid/shared-types` is a single barrel (`package.json` `main: ./src/index.ts`), so a large constant beside the enum is imported by the web bundle unless the bundler tree-shakes it; name the export `EVENT_CATEGORY_DEFINITIONS` and note it is model-facing, not UI copy (UI labels stay in `next-intl`).

### L4. Fact 8 gives a bare filename.
`multi-select.tsx` is `packages/ui/src/core/multi-select.tsx`. Cite the full path in the record.

# Gemini structured output (item 5)

Checked 2026-10-23.

- Docs: https://ai.google.dev/gemini-api/docs/structured-output, page footer "Last updated 2026-10-21 UTC". It defines `enum` only as "Lists a specific set of possible strings for classification tasks" (and numeric values), puts `description` at the property level ("A longer and more detailed description of a property"), recommends "Use the `description` field to guide the model", and shows its enum example with one description on the whole property. It never describes a description for an individual enum value. It also warns that "Very large or deeply nested schemas may be rejected with a `400 INVALID_ARGUMENT` error" and lists "enums with many values" among the causes.
- SDK (what the repo actually calls): `@google/genai` 2.16.0 installed (package.json `^2.14.0`); `Schema.enum?: string[]` and `Schema.description?: string` at `apps/backend/node_modules/@google/genai/dist/genai.d.ts:12049-12051`. Enum members are bare strings.
- I could not read the REST `Schema` reference page (the fetch truncated before that section, and the caching page showed no Schema object), so the "strings only" statement rests on the SDK type plus the guide, not on the API reference.

Conclusion: per-value definitions cannot live in the schema; they must be in the `systemInstruction` text, which is what AD-44 Rule 3 does. A field-level `description` on `categories` could carry a one-line pointer, but not the definitions. Do not duplicate the definitions into the filter schema: `buildFilterExtractionResponseSchema` unrolls the leaf properties three times (`build-filter-extraction-request.ts:146-160`), so a description on `categories` would be tripled and moves the schema toward the documented size limit. Note the repo omits the SDK-documented `format: 'enum'` on its enum fields (`genai.d.ts:12050`); it works in production today, so leave it, but do not copy-paste the pattern into new fields without testing.

# Migration facts for the taxonomy story (item 7)

- Workflow: edit `eventCategoryEnum` in `packages/database/schema.ts:54-60`, `pnpm --filter database generate` (script `generate` = `drizzle-kit generate`, `package.json:15`), hand-edit the new `.sql`, `pnpm --filter database migrate` (`migrate.ts` calls drizzle's `migrate()` over `./migrations`, all pending files in one transaction). Latest migration is `0080_loving_doctor_octopus.sql`, so the next is `0081`.
- Several `ADD VALUE` statements in one file already shipped in `0038_smooth_switch.sql:1-5`, so the multiple-`ADD VALUE` case is proven in production.
- The generated snapshot reflects the `schema.ts` list order, so the pgEnum list must put both new values before `OTHER` in the order HOME_AND_LIVING, FASHION_AND_BEAUTY to match the hand-edited SQL.
- `TRUNCATE TABLE reports CASCADE` in the seed (`deferred-work.md:343`) is unrelated; no seed or integration test depends on the enum's physical order.

# Open items I could not confirm

- Production counts of events tagged `OTHER`: no prod access (the record says the same). The evidence-gate SQL is NOT runnable as written (see M7).
- Whether web clients treat a response with `errors` plus partial `data` as a failure: not traced. It decides how visible the removal failure in H2 is.
- The record's marketplace claims (fact 10) were not re-checked; the record already says they are not relied on.
