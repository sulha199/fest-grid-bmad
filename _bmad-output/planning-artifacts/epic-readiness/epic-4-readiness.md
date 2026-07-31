---
epic: 4
swept: true
date: 2026-07-31
stories_covered:
  - 4.1a
  - 4.1
  - 4.2
  - 4.3a
  - 4.3
  - 4.4a
  - 4.4
  - 4.5
  - 4.6
  - 4.7
---

# Epic 4 Readiness Report — Data Quality and Moderation

## Scope

Epic 4 (corrections, reporting, moderation) is the first consumer-facing epic to touch data ownership no prior epic established: nothing in `epics.md` before this sweep created a `corrections` table, a `reports` table, or a soft-delete concept on `events`. This sweep ran Gate 1 and Gate 3 once against Epic 4's full planned story list (4.1–4.7) to surface those gaps before any story is created individually.

## Gate 1 — Architecture / Infrastructure Completeness

**Gaps found — 3 new prerequisite stories:**

1. **No backend layer for event-data corrections.** Story 4.1 ("perform data inconsistency checks") and Story 4.2 (AI-assisted extraction) both submit corrections, but no table, mutation, or API surface existed anywhere for them. → **New Story 4.1a**, positioned before Story 4.1.
2. **No backend layer for reports, report status, or per-user "hidden" state.** No `reports` table existed. Story 4.3's "immediately hidden from my view" implied new per-user visibility state; Story 4.5's "ignore subsequent reports from the same user" needed a home; Story 4.6 needed a status-bearing query; Story 4.7 needed moderator-only queries/mutations. → **New Story 4.3a**, positioned before Story 4.3.
3. **No soft-delete schema or moderator restore/delete mutations.** Story 4.4's threshold-triggered soft-delete had no column on `events` (Story 1.1's schema has none) and no named trigger mechanism; Story 4.7's "restore"/"permanently delete" had no mutations. → **New Story 4.4a**, positioned before Story 4.4.

**Resolved as AC corrections only (backing infrastructure already exists, just not referenced):**

- **Story 4.2** — didn't state the Gemini call goes through the AI Gateway adapter (Story 0.13, which already names "correction later" as a consumer) or that results flow into 4.1a's mutation.
- **Story 4.5** — didn't state `Depends on: Story 0.15`, even though 0.15's own Note already names "dangerous-event moderator alerts" as a consumer.
- **Stories 4.1, 4.3, 4.6, 4.7** — needed "via backend mutation/query — not a direct database write" bullets, matching the Epic 1/3 phrasing convention.

No Gate 1 violation required new Epic 0 infrastructure — every adapter/context Epic 4 needs (AI Gateway, email, auth/role) was already built in Epic 0 in explicit anticipation of it (Stories 0.13, 0.15, 0.17 each already name Epic 4 stories as consumers in their own Notes).

## Gate 3 — Foundational / Cross-Cutting Dependency Completeness

**One cross-epic gap found**, homed inside Story 4.4a's scope: the new `events.status` (soft-delete) column redefines what "visible" means for every epic that already reads events through Story 1.3a's shared resolver — Epic 1's listing/search/filter, Epic 2's favorites (Story 2.1a), and Epic 3's feed (Story 3.7). Without a correction, those would resume showing soft-deleted events the moment Story 4.4 ships. **Resolved via a direct AC correction to Story 1.3a** (exclude `status='soft_deleted'` by default; moderator-scoped argument to include them) — no change needed to 2.1a or 3.7, since both already state they extend/reuse 1.3a's resolver and inherit the exclusion automatically.

**Checked and confirmed no other gap:** AI Gateway adapter (0.13), outbound email adapter (0.15), auth/role context (0.17), GraphQL scaffold/codegen/`buildOptimizedDrizzleSelect` (0.8), i18n/app-shell/analytics (0.6–0.8, 1.8) all already cover Epic 4's needs. The `corrections` and `reports` tables were evaluated against Gate 3's promotion bar (≥2 independent epics needing the same unbuilt thing) and do **not** qualify — no other epic in `epics.md` references corrections, reports, or moderator actions — so they correctly stay Epic-4-scoped (Gate 1 shared-data findings), not promoted to Epic 0. No new AWS infrastructure (Lambda/queue/IaC) is implied by any Epic 4 story either — corrections and reports are synchronous request/response GraphQL mutations, not a pipeline — so Story 0.14 is not a new dependency and no IaC story is warranted.

## New Prerequisite Stories Added

| Key | Position | Classification |
|---|---|---|
| **4.1a** — Build the corrections backend GraphQL API layer | Before Story 4.1 | Gate 1, shared data-ownership (Epic-4-lettered) — consumed by 4.1, 4.2 |
| **4.3a** — Build the reports backend GraphQL API layer and personal-visibility filtering | Before Story 4.3 | Gate 1, shared data-ownership (Epic-4-lettered) — consumed by 4.3, 4.5, 4.6, 4.7 |
| **4.4a** — Add soft-delete to the events table and extend the events resolver and moderator mutations | Before Story 4.4 | Gate 1 + Gate 3, shared data-ownership (Epic-4-lettered, cross-epic consumption via 1.3a) — consumed by 4.4, 4.7; read by Epics 1–3 |

Full sections (As a/I want/So that, Acceptance Criteria, Note, Depends on) written directly into `epics.md`.

## AC Corrections Applied Directly to `epics.md`

- **Story 1.3a** (Epic 1): added bullet excluding `status='soft_deleted'` events by default, with a moderator-scoped include argument (Gate 3 cross-epic correction).
- **Story 4.1:** added bullet routing submission through `submitCorrection` (Story 4.1a); added `Depends on: Story 4.1a`.
- **Story 4.2:** added bullets — Gemini call exclusively via the AI Gateway adapter (Story 0.13); extracted data submitted via 4.1a's mutation with `source='ai_assisted'`, not written directly; added `Depends on: Story 0.13, Story 4.1, Story 4.1a`.
- **Story 4.3:** added bullet routing submission through `submitReport` (Story 4.3a); clarified "hidden from my view" reads the `isHiddenForCurrentUser` field, not a client-side filter; added `Depends on: Story 4.3a`.
- **Story 4.4:** clarified the threshold check/soft-delete runs synchronously inside `submitReport` (Stories 4.3a/4.4a), not a scheduled job; restore uses 4.4a's `restoreEvent` mutation; added `Depends on: Story 4.3a, Story 4.4a`.
- **Story 4.5:** added bullet — notification sent exclusively via the outbound email adapter (Story 0.15); "ignore subsequent reports" persisted via 4.3a's mutation; added `Depends on: Story 0.15, Story 4.3a`.
- **Story 4.6:** added bullet routing the list through the `myReports` query (Story 4.3a); added `Depends on: Story 4.3a`.
- **Story 4.7:** added bullet routing the list through the moderator-only `reportedEvents` query and moderator mutations (Stories 4.3a, 4.4a); added `Depends on: Story 4.3a, Story 4.4a, Story 0.17`.

## `sprint-status.yaml` Changes

Appended three backlog entries, positioned to match `epics.md`:
- `4-1a-build-the-corrections-backend-graphql-api-layer` (before `4-1-manually-correct-event-data`)
- `4-3a-build-the-reports-backend-graphql-api-layer-and-personal-visibility-filtering` (before `4-3-report-an-event`)
- `4-4a-add-soft-delete-to-the-events-table-and-extend-the-events-resolver-and-moderator-mutations` (before `4-4-handle-event-cancelled-reports`)

No existing story's status was changed.
