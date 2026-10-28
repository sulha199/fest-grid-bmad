# Design review: curator repeated-post rule, checked against the code

Date 2026-10-25. Reviewer: the authoring session, run sequentially (no subagents were requested), four lenses: rubric walker, adversary ("two units that obey every AD and still diverge"), reality check against the code, edge-case sweep of the predicate. Spine lint: 0 findings.

Verdict: the shape is sound and fits the existing seams, but **three high findings would have produced wrong merges or dead code if built as drafted**. All three are fixed in the spine (below). Two questions remain for the owner.

## Findings

| # | Sev | Lens | Finding | Disposition |
| --- | --- | --- | --- | --- |
| F1 | High | Edge case | **Names normalize too loosely for a no-evidence rule.** `normalizeEventNameForMatch` deletes bracketed groups. "Yonex Open (Morning)" and "Yonex Open (Evening)" become equal; with the same start date and venue they would link, and the additive schedule merge pairs schedules by start date only, so the second session's times would be lost. | **Fixed (AD-2):** the stub rule compares names with bracket content kept (years and punctuation still stripped). New `normalizeEventNameStrict`. |
| F2 | High | Edge case | **Same name, date and venue can still be two shows.** A matinee and an evening show of one act, posted as two events by a curator, share all three. | **Fixed (AD-2):** when both matched schedules carry `eventStartTime`, the times must be equal. A missing time on either side does not block. |
| F3 | High | Reality check | **AD-4 "fill only where null" is undefined for this schema.** `events.location` is NOT NULL and holds the placeholder "Location not specified"; `types`/`categories` default to `[]`; `description` can be `''`. A literal null test would never fill those, and an overwrite would defeat the point. | **Fixed (AD-4):** an "unfilled" helper is specified: null, undefined, blank string, empty array, or the location placeholder. One implementation, shared with the schedule merge. |
| F4 | Med | Reality check | `findMatchingEvent` orders candidates by similarity only, with `LIMIT 20` on joined event x schedule rows. With ties (identical names) the SQL order is arbitrary, so the absorber varies. | **Covered by AD-5** (secondary `created_at`, `id` order). Test must assert it with 3 identical stubs. |
| F5 | Med | Reality check | The AD-40 preview treats an unstored post (`matchWithoutSourcePost`) as organizer-authored, never a stub, so it can never show a stub repeat for a URL not yet in the database. | **Documented (AD-3, Deferred):** a limitation, not a bug; a stored post previews correctly. |
| F6 | Med | Adversary | **Scan scale and cost.** "Find all pairs" over all active stubs is O(n^2) if written naively. | **Fixed (AD-6):** SQL pre-filter (stub, active, equal start date via schedules, `similarity > 0.8`), predicate in TypeScript, buckets in memory. |
| F7 | Med | Adversary | **Scan vs live ingestion race.** A post can link to an event a scan is merging away (read before the merge commits). The moderator accept has the same exposure today. | **Deferred (named):** operator runs the apply off-hours; revisit with the advisory-lock item. |
| F8 | Med | Rubric | **No rollout gate.** The ingestion rule is live on deploy; only the scan has a dry run. | **Fixed (AD-9):** before merge, run `--scan-stubs --evaluate-only` against prod read-only from the branch (no deploy needed) and attach the cluster list to the PR for a moderator spot-check. |
| F9 | Low | Rubric | AD-7 wording about "stubRepeat inputs" was garbled. | Fixed. |
| F10 | Low | Reality check | PR #102's mid-to-high promotion uses the same destructive enrichment (last-writer-wins fields, deletes unmatched schedules). | Already in Deferred; **reported to the owner** as a follow-up outside this design. |
| F11 | Low | Reality check | No new service, queue, Lambda or library: `architecture-diagram.md` unchanged. | Confirmed. |

## Checked and fine

- The rule needs an equal start date, so it can never fire for a candidate admitted only by the 90-day shared-link path, and the outside-window cap cannot conflict.
- The sibling-ordinal exclusion and the `(post, ordinal)` idempotency still guard multi-event posts and redelivery.
- `isStub` for the new item is already computed in `evaluateIngestionMatch` and equals the `detail_level` the row will get, so the scan (which reads `detail_level`) and ingestion agree.
- A candidate promoted to `full` drops out of the rule automatically.
- Stubs never notify (`becameOrganizerAuthored` stays false), so the in-place link sends nothing.
- The log line already carries ids only; `promotionRule` adds no PII.

## Owner answers (2026-10-25)

1. **Different-account reading: confirmed.** Name + date + venue on stub pairs links regardless of account.
2. **Name guard: yes** (at least two name tokens, AD-2). The owner also asked that same-name, same-date, different-venue events (several "Christmas" events) are treated as different: AD-2 now names that case as required tests, and AD-6's scan prints a near-miss list. A generic two-word name at one venue and day from two curators remains an accepted risk (Deferred).
