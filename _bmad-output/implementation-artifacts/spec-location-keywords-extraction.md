---
title: 'Location keywords, slice 1: generate (separate call), validate, store, expose'
type: 'feature'
created: '2026-11-10'
revised: '2026-11-11'
status: 'done'
review_loop_iteration: 0
baseline_commit: '6fa61eb0777bc124ab5e3a18e47f49a88ba40172'
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/festgrid-architecture-spine.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Gemini returns one free-text `location` per schedule and per event. For a flyer with a different place per date (Samsat Sleman, `ig_p_DfWWCCIzNw1`) it left schedule `location` empty and wrote the event-level one as "Berbagai lokasi di Kabupaten Sleman", which nothing can resolve (it caused a 502 on Apply, fixed for timeouts by PR #204). Geocoding the raw text is also weak: on 54 hand-labelled real locations production resolves 29 correctly, 9 wrongly, 16 not at all.

**Approach:** The main extraction call stays as it is, plus one prompt rule: each date's own place goes in that schedule's `location`, and the event-level `location` is the common area. (Asking the main call for keywords too made a one-event post with 20 dated places collapse into several events in 17-50% of live runs; this rule alone: 0 of 9.) Keywords come from a **separate, batched, text-only Gemini call per post**, made after the extraction is validated: `locationKeywords: string[]` (most specific first) and `countryCode` (ISO-2 or null) for every distinct location string. They are validated in code, stored in nullable columns and exposed on GraphQL. Nothing consumes them yet (slice 2: `spec-location-keywords-geocoding.md (2a) and spec-location-keywords-map-link.md (2b)`). On the POC a keywords ladder resolved 45 of 54 correctly (8 wrong, 1 not found).

## Boundaries & Constraints

**Always:** Keywords are optional everywhere; absent means today's behavior exactly. The call is best-effort: any failure, timeout, quota or busy error, unparseable or partial answer leaves that string's keywords `null`, never fails or delays the extraction beyond its own short timeout (proposed 10 s, no retry), and is logged (`location-keywords outcome=ok|partial|failed strings=N`). One call per post (or per chain step: that step's fresh events only), all distinct normalized strings batched (schedule `location`s and the event `location`s), text only. Input per string: the text, event name, hashtags; never the account's default location (defaults are wrong for many accounts: 8 of 16 non-Indonesian defaults on mostly-Indonesian posts). Normalization (the existing pure domain function): trim, drop empty, case-insensitive de-dupe keeping first, drop generic phrases ("berbagai lokasi", "various locations", "multiple locations", "lokasi", "tba", "tbc", "online"), each at most 80 chars, at most 5, empty result `null` (never `[]`); `countryCode` kept only when two letters, uppercased, else `null`; a string the model gave no code gets the code that more than half of the call's coded strings share (at least 2 coded strings), else none. No country is hard-coded in the prompt or the code: the prompt says "most places are in <`DEFAULT_COUNTRY_CODE`>" read from backend env (default "ID", empty = the sentence is left out). A keyword is one place name, never a sentence or a summary of several places; the instruction says so and says never to invent a place the text, event name or hashtags do not support. A correction that changes a row's `location` clears that row's keywords. The re-extract preview is where keywords are generated for the moderator flow; Apply never calls Gemini (it runs inside the 28 s API Lambda) and persists what the preview carried. The preview always regenerates: stored keywords are never reused, so a moderator who re-extracts because they were wrong gets fresh ones (user decision, see the Change Log).

**Ask First:** Raising `GEMINI_MAX_OUTPUT_TOKENS` or `PER_CALL_EVENT_CAP`: not expected (the main call gets smaller). Adding a cross-post keywords cache (see Design Notes): deferred, needs evidence.

**Never:** No keywords in the main call's response schema or prompt. No geocoder, link or UI change (slice 2). No backfill of existing rows. No keywords in `ProposedEventCorrection` types or the correction UI (the single-event correction preview is not enriched). No search index on keywords. No region taken from the account's default location.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Per-date places | Samsat flyer, one event, 20 dated rows | schedule `location` is its own place; event `location` "Kabupaten Sleman"; one keywords call; each schedule `["Pasar Porosjayan","Gamping","Sleman"]`, event `["Sleman"]`, `countryCode` "ID" | N/A |
| Foreign venue | "Doylestown, PA 18901, United States" | keywords `["Doylestown","Pennsylvania"]`, `countryCode` "US" | N/A |
| Generic phrase | model returns `["Berbagai lokasi","Sleman"]` | stored `["Sleman"]` | N/A |
| Messy list | 9 items, duplicates, padded, one 200-char string | trimmed, de-duped, over-long dropped, first 5 kept | N/A |
| Call fails / times out / busy | any gateway error | extraction continues; keywords `null`; log `failed` | never thrown to the caller |
| Partial answer | 3 of 5 ids returned | those 3 stored; the rest `null`; log `partial` | N/A |
| Same text re-extracted | preview text equals a stored row's text | keywords regenerated, never taken from stored rows (a moderator re-extracting because they were wrong gets fresh ones) | N/A |
| Correction edits text | moderator/user changes `location` | that row's `location_keywords` set `null` | N/A |
| Merge / enrichment | two events merged, or primary post replaced | keywords copied/enriched as `location` is | N/A |
| Re-extract Apply | preview carries keywords | Apply persists them on the new rows; no Gemini call | N/A |

</frozen-after-approval>

## Code Map

Already built in the working tree (uncommitted, branch `feat/location-keywords`) and kept: `packages/domain/src/events/normalize-location-keywords.ts` (+test), types (`events/types.ts`, `posts/types.ts`), `transform-gemini-response-to-event-info.ts`, `build-event-insert-values.ts`, `packages/database/schema.ts` + migration `0095_location_keywords` + snapshot + journal, `set-event-primary-post.ts`, `merge-events.ts`, `schema/resolvers.ts` (submitCorrection clearing), `events.graphql` + codegen, `extracted-event.schema.ts` (Ajv still accepts the field), `stripMalformedLocationKeywords` calls, and their tests.

Changes for this revision:
- `apps/backend/src/lib/ai-processor/build-gemini-request.ts` -- remove the keywords fields from both response schemas and every keywords mention from rules 4d/5 (keep the per-date-place and common-area wording)
- new `apps/backend/src/lib/ai-processor/generate-location-keywords.ts` -- collect distinct strings, one batched call, parse/validate, attach to the events
- call sites: `process-ai-job.ts` (before the per-event `buildExtractedEventMessage` loop, ~:505), `process-extraction-step.ts` (~:262, the step's `fresh` events), `process-manual-extraction-job.ts` (~:144, `REEXTRACT_PREVIEW` branch only, before `buildReextractionPreview`)
- `apps/backend/src/lib/ai-gateway/` -- precedent for a text-only call with subscriber keys then the system key: `callGeminiForLocationInference` in `system-key-adapter.ts`; reuse it (or a sibling with the same shape), do not add a new vendor path
- `packages/domain/src/events/` -- add `locationCountryCode` (transient, set by the generator, read by slice 2; not stored, not on the message) next to `locationKeywords` on the Gemini payload types, plus a small country-code normalizer beside the keywords one

## Tasks & Acceptance

**Execution:**
- [x] `build-gemini-request.ts` + test -- drop keywords from the main schema and prompt; keep "each date's own place in that schedule's `location`; event `location` is the common area, never 'various locations'"
- [x] `generate-location-keywords.ts` + test -- batched text-only call with its own response schema (`[{id, locationKeywords, countryCode}]`), 10 s timeout, no retry, normalize via the domain functions, drop unknown/duplicate ids, never throws, one log line
- [x] Wire the three call sites; the preview always regenerates (no reuse of stored keywords); the single-event correction preview and the non-preview manual path stay untouched
- [x] `packages/domain` -- country-code normalizer + transient field on the payload types; keep it out of `ExtractedEventMessage`/insert values
- [x] `apps/backend/src/env.ts` -- `DEFAULT_COUNTRY_CODE` (normalized, default "ID", validated like its siblings with the `turbo/no-undeclared-env-vars` disable comment); generator prompt and post-consensus fill read it / use it
- [x] Tests -- generator (ok, partial, failure, timeout, foreign code, duplicates), cursor step enriches only `fresh` events, preview carries keywords and Apply persists them with no Gemini call, stored keywords not reused in the preview, existing slice-1 tests still green

**Acceptance Criteria:**
- Given an extracted post, when it is ingested, then the schedule and event rows hold normalized keywords and GraphQL returns them.
- Given the keywords call fails or times out, when a post is extracted, then the events are ingested exactly as before with `null` keywords and the extraction is not retried because of it.
- Given a re-extract preview and Apply, when Apply runs, then no Gemini call is made and the preview's keywords are persisted.
- Given a multi-step chain, when later steps add events, then each step's keywords call covers only its fresh events.
- Given the main call's prompt and schema, when inspected, then neither mentions keywords, and a live A/B (below) shows no more event/schedule collapse than master.

## Spec Change Log

- 2026-11-11 (country, user decision): post consensus fills missing codes in the generator; the keywords prompt takes its "most places are in X" from `DEFAULT_COUNTRY_CODE` instead of naming Indonesia; account history is not a source.
- 2026-11-11 (revised after the POC, user approved the direction): keywords no longer come from the main extraction call (grouping collapse on multi-place posts); separate batched call, `countryCode` added, account default no longer an input, reuse of stored keywords. Earlier version approved at Checkpoint 1 was the in-main-call design.
- 2026-11-11 (user decision after review): the re-extract preview no longer reuses stored keywords; it always regenerates, so a moderator can fix bad keywords by re-extracting. The generator's `known` option and `load-known-location-keywords.ts` were deleted.
- 2026-11-11 (live A/B, user authorized prod read for post selection): the per-date-place rule (4d) alone made the model fold 7 same-day Sony Center branches into ONE event with 7 schedules and event location "Indonesia" in 6 of 6 runs (master: 7 events in 5 of 5). Fixed by a grouping rule a2 (parallel venues at once are separate events) and 4d kept as originally worded; moving the sentence into 4d instead weakened per-date places on the Kajian post, so it lives in rule 0a2.

## Design Notes

POC (60 real locations from prod, 54 labelled, Geoapify real client): today's text query 29/9/16 (correct/wrong/not found); code-cleaned ladder 38/12/4; Gemini keywords ladder 45/8/1. Scripts: `apps/backend/scripts/poc-location-keywords-oneoff{,2,3}.ts`. The POC prompt also gave the model an `authorRegion` hint from account defaults; this spec drops it, so the live check must replay the labelled rows without it and compare to 45.

Cost: about 160 tokens per location, one small call per post (about $0.0001); posts have 1.28 distinct location strings on average.

Caching, in order: (1) a re-extract preview always regenerates (reuse of stored keywords was dropped, see the Change Log); (2) a failure leaves `null` and slice 2 falls back to a code-cleaned ladder (slice 2). Deferred: (3) a cross-post cache keyed by normalized text (about 25% of per-post strings repeat exactly; revisit when the Gemini keywords call shows up in cost or latency; cache only strings that already name a city or region, since "Taman Budaya" alone depends on the post).

```
schedule: { title: "Pasar Porosjayan", eventStartDate: "2026-11-02",
            location: "Pasar Porosjayan, Gamping, Sleman",
            locationKeywords: ["Pasar Porosjayan", "Gamping", "Sleman"] }
event:    { location: "Kabupaten Sleman", locationKeywords: ["Sleman"] }
```

## Verification

**Commands:**
- Rebuild `@festgrid/domain` and `@festgrid/database` dist first; `pnpm --filter backend exec tsc --noEmit`; `pnpm --filter backend lint`; DB test files one at a time on a scratch DB (`DATABASE_URL` override); domain tests; `pnpm --filter web build` -- expected: green (known local-only failures also fail on master)
- `pnpm --filter backend exec tsx scripts/run-tests-with-row-count-ratchet.ts <file>` for files that touch the DB

**Manual checks:**
- Live A/B, interleaved, at least 6 runs per arm, on 3-4 fresh multi-place posts (the Samsat cover expired 2026-11-10 13:55 UTC, so it can no longer be replayed; the same prompt rule measured 0 of 9 collapses on it before expiry): event and schedule counts not below master's. `scripts/run-golden-prompt-live-eval.ts` evaluates the AI-filter prompts only, so it does not apply.
- Replay the 54 labelled locations through the new generator and then the slice 2 ladder (or the POC pass-3 script): at least 43 correct without the `authorRegion` hint, foreign venues (Raleigh, Kumamoto, Singapore, Doylestown) get a non-ID `countryCode`.
- `finishReason` is not `MAX_TOKENS` on a 20-schedule post and on a roundup chain step; the keywords call adds under 10 s to a step (the stepped path has a 45 s per-message budget).

## Suggested Review Order

**The keywords call (entry point)**

- One batched, text-only call; never throws; consensus fills missing countries; prompt takes the home country from env.
  [`generate-location-keywords.ts:155`](../../apps/backend/src/lib/ai-processor/generate-location-keywords.ts#L155)

- The prompt, built from the configured platform default instead of naming a country.
  [`generate-location-keywords.ts:36`](../../apps/backend/src/lib/ai-processor/generate-location-keywords.ts#L36)

- Post-level country consensus (at least two coded strings, more than half agree).
  [`generate-location-keywords.ts:112`](../../apps/backend/src/lib/ai-processor/generate-location-keywords.ts#L112)

**Where it runs (three call sites)**

- Normal extraction: once per post, after validation, before geocoding.
  [`process-ai-job.ts:466`](../../apps/backend/src/lib/ai-processor/process-ai-job.ts#L466)

- Cursor step: only the step's new (deduped) events.
  [`process-extraction-step.ts:261`](../../apps/backend/src/lib/ai-processor/process-extraction-step.ts#L261)

- Re-extract preview: generated here so Apply never calls Gemini; always regenerated, stored rows' keywords are not reused.
  [`process-manual-extraction-job.ts:152`](../../apps/backend/src/lib/ai-processor/process-manual-extraction-job.ts#L152)

**Validation and rules**

- Keyword and country-code normalization, shared by every path.
  [`normalize-location-keywords.ts:51`](../../packages/domain/src/events/normalize-location-keywords.ts#L51)
  [`normalize-location-keywords.ts:110`](../../packages/domain/src/events/normalize-location-keywords.ts#L110)

- Main prompt: per-date place and common-area event location, no keywords.
  [`build-gemini-request.ts:273`](../../apps/backend/src/lib/ai-processor/build-gemini-request.ts#L273)

- Platform default country, validated at startup.
  [`env.ts:351`](../../apps/backend/src/env.ts#L351)

**Storage and staying in step with the text**

- New nullable columns on events and schedules.
  [`0095_location_keywords.sql:1`](../../packages/database/migrations/0095_location_keywords.sql#L1)

- Enrichment keeps keywords unless the text really changed (case and spacing ignored).
  [`set-event-primary-post.ts:195`](../../apps/backend/src/lib/events/set-event-primary-post.ts#L195)

- Corrections clear keywords when the location text changes.
  [`resolvers.ts:1639`](../../apps/backend/src/schema/resolvers.ts#L1639)

**Tests**

- Generator: batching, failure, timeout, consensus, copies per row.
  [`generate-location-keywords.test.ts:1`](../../apps/backend/src/lib/ai-processor/generate-location-keywords.test.ts#L1)

- Preview carries keywords to Apply with no second Gemini call; failure never fails it.
  [`process-reextraction-preview.test.ts`](../../apps/backend/src/lib/ai-processor/process-reextraction-preview.test.ts)

## Live check results (2026-11-11)

- **Replay of the 54 labelled locations** (shipped generator, no `authorRegion` hint, one call per row, then the slice 2 ladder under the country hint): 48 correct / 6 wrong / 0 unresolved (POC with hint: 45/8/1; bar: at least 43). Foreign venues got US, JP, SG, US. 3 of 60 calls took over 10 s (max 10.9 s), about 5 % would time out in production and fall back to the text ladder. The system key returned 429 when called quickly: space live calls out.
- **A/B on 4 fresh prod posts** (master prompt vs current, interleaved, 6 runs per arm): event counts equal master on all 4 after fix a2 (5 roundup events x 3 schedules; 1 event x 4 dependent-stage schedules; 7 Sony Center branch events; 1 Kajian event x 5 schedules). The Kajian post keeps one distinct place per date in 5 of 6 runs (master 4 of 6 at 4-5 places). Cut-off JSON (output at the token cap) happened in 1 of 6 and 3 of 6 runs on the 7-branch post on the revised variant, and 1 of 5 on master: a pre-existing flake of that post, not the rule.
