# Story Split Gate (bmad-create-story Extension)

Date: 2026-07-29
Scope: Applies to `bmad-create-story` for all epics/stories from this point forward.

## Why This Exists

Retrospective on Story 1.3 found recurring failure modes that the original `bmad-create-story` → `bmad-quick-dev` pass did not catch, because nothing in the workflow explicitly checked for them:

1. **Missing reusable-component/complex-UI refinement.** `EventCard.tsx` was built without the event image, because the story bundled "build the reusable card" into a larger feature story instead of giving it its own focused refinement pass (props/variants, image handling, loading/empty/error states, a11y).
2. **Missing infra/architectural layer.** The frontend called the DB/domain layer directly instead of going through a backend + GraphQL serverless layer, because no story existed yet for that layer — the feature story quietly absorbed the missing layer instead of surfacing it as a prerequisite.
3. **Missing foundational/cross-cutting dependency.** i18n (next-intl) was flagged back on 2026-07-22 as needing its own dedicated setup story, but no such story was ever created — so i18n config, the global app shell/layout, the GraphQL Code Generator pipeline, and the mandated `buildOptimizedDrizzleSelect` utility all got built ad hoc (or not at all) as side effects of feature stories, instead of as their own reusable, one-time-built Epic 0 stories.

This document defines three mandatory gates that `bmad-create-story` must run before finalizing any story, so gaps like these are surfaced and split off *before* a story is written, not discovered after `bmad-quick-dev` ships it.

## Gate 1 — Architecture / Infrastructure Completeness

**Owner persona:** Winston (`bmad-agent-architect`)

**Trigger heuristics** — flag if the story-in-progress would require the target layer to:
- Call a database/ORM (e.g. Drizzle), domain package, or other backend-only dependency directly from `apps/web` or any UI package.
- Call an external/third-party service directly from the frontend instead of through `apps/backend`.
- Introduce a new API surface, resolver, query, or mutation that doesn't yet exist in `apps/backend` (GraphQL schema/resolvers).
- Add auth/authorization logic, secrets, or business rules in frontend code.
- Depend on infra that has no IaC/deploy story yet (per `_bmad-output/implementation-artifacts/deferred-work.md`).

**Required action when triggered:** Do not let the story implement the workaround. Treat the missing layer as its own prerequisite story.

## Gate 2 — UI Complexity & Reusability

**Owner persona:** Freya (`wds-agent-freya-ux`) — fallback Sally (`bmad-agent-ux-designer`) if no WDS design artifacts exist for the feature area.

**Trigger heuristics** — flag if the story's UI scope includes any of:
- A component intended for reuse across ≥2 places (e.g. a card, list item, modal) that has non-trivial states: images/media, loading/empty/error states, variants, or accessibility requirements.
- A complex hook (data fetching + derived state + side effects combined) or a non-trivial React util (formatting, sorting, debouncing, pagination logic) that multiple components will depend on.
- Visual/interaction details that are specified in the authoritative UX artifacts (see below) but not reflected in the current draft scope — e.g. an image, a specific empty state, a micro-interaction.

**Required action when triggered:** Split the reusable component/hook/util into its own story with dedicated acceptance criteria (props/variants, all states, a11y), instead of listing it as a subtask inside the feature story.

### UX Source-of-Truth Correction

The `bmad-create-story` input table only looks for `*ux*.md` under `{planning_artifacts}`. For this project, the actual authoritative UX specs live under `{project-root}/design-artifacts/<UX-*-run-*>/DESIGN.md` and `EXPERIENCE.md` (WDS module output), which that glob never matches. Gate 2 must always locate and read the relevant `DESIGN.md`/`EXPERIENCE.md` for the feature area in `design-artifacts/`, in addition to (not instead of) the `planning_artifacts` glob.

## Gate 3 — Foundational / Cross-Cutting Dependency Completeness

**Owner persona:** Winston (`bmad-agent-architect`)

Distinct from Gate 1 (which asks "does *this feature* need its own backend/API layer?"), Gate 3 asks "does this story quietly depend on shared, project-wide tooling/infrastructure that isn't built yet and that *other* future stories/epics will also need?" Feature-scoped gaps stay feature-scoped (Gate 1/2); cross-cutting gaps get split into their own foundational story, typically under Epic 0.

**Trigger heuristics** — flag if the story-in-progress would need to set up, configure, or first-introduce any of:
- A global app shell/layout (navigation, header/footer, responsive/mobile-first structure, RTL/LTR-ready containers) used across ≥2 routes/epics — not just this story's page.
- i18n foundation (routing, locale/message-file structure, provider wiring) — anything beyond adding strings to an existing, already-set-up i18n system.
- Analytics/observability foundation (provider wiring, event-taxonomy conventions) — anything beyond adding a new tracked event to an already-set-up system.
- The GraphQL server scaffold and/or GraphQL Code Generator pipeline, if not already established.
- A named, reusable utility explicitly mandated in `project-context.md`'s Technology Stack/Critical Implementation Rules (e.g. `buildOptimizedDrizzleSelect`) that has no home yet and is meant to be reused by resolvers/features beyond this one.
- Any dependency that is referenced in `project-context.md` or the architecture spine but has **no corresponding story anywhere in `epics.md`**.

**Required action when triggered:** Do not build the shared dependency as a byproduct of the feature story. Split it into its own foundational story (Epic 0 unless the architecture dictates otherwise), scoped as reusable, generic, and owned independently of any single feature.

## Execution Protocol

1. Run these gates after architecture analysis (story creation Step 3) and before the story file is written (Step 5).
2. For each gate, use the `runSubagent` tool to adopt the owning persona and evaluate the draft story scope against that gate's trigger heuristics, using the loaded architecture/epics/UX/project-context content as evidence.
3. If a gate reports **no gap**, note "No gap found" and proceed normally.
4. If a gate reports a **gap**, do NOT silently absorb the missing layer/component/dependency into the current story's tasks. Instead:
   - Add an **"Architecture & UX Gate Findings"** subsection under `## Dev Notes` summarizing the gap, which gate raised it, and why.
   - List the deferred scope under `## Out of Scope` with a suggested prerequisite story key (e.g. `1-3a-eventcard-image-and-states`, `0-6-events-graphql-api-layer`, `0-8-graphql-codegen-and-optimized-select`).
   - Write a **full section into `epics.md`** for the prerequisite story (As a/I want/So that, Acceptance Criteria, and a `Note:` explaining which gate and story surfaced it) — a `sprint-status.yaml` key alone is not sufficient, since `epics.md` is the authoritative source `bmad-create-story` reads requirements from. Classify and position it per the numbering rule below.
   - Add a corresponding new `backlog` entry for the prerequisite story to `sprint-status.yaml` (do not overwrite existing entries; append, positioned to match `epics.md`).
   - Add a checklist item under `## Pre-Coding Approval Gate` confirming the prerequisite is either already done, or the user has explicitly accepted the gap and wants to proceed anyway.
5. Report all gate findings and any new prerequisite story keys in the final completion summary shown to the user.

## Numbering Rule for New Prerequisite Stories

Every prerequisite story produced by a gate finding must map to exactly one of these placements. Never renumber an existing story to make room — only append (Epic 0) or insert a new lettered story.

- **Tooling/infrastructure gap** (an adapter, IaC, a scaffold/codegen pipeline, an i18n/analytics/testing/validation foundation — reusable across features by nature) → new Epic 0 story, numbered sequentially after Epic 0's current highest story, with a `Note:` mirroring the style of Stories 0.6-0.8.
- **Shared data-ownership gap** (a table this epic originates but other epics read) → lettered suffix within the *originating* epic, positioned before the first story that needs to write it — following the precedent of Story 1.1 scoping core tables to Epic 1 rather than Epic 0.
- **Single-story architecture/UI split** (a layer or component needed by exactly one story) → lettered suffix directly off that one story, matching the `1.3a`/`1.3b`/`1.6a` pattern.

## Epic-Level Sweep Mode

Gate 1 and Gate 3 findings are typically epic-wide (the same adapter/queue/schema gap tends to affect most stories in a pipeline epic), so running them fresh per story re-derives the same conclusion repeatedly at full cost. `bmad-epic-readiness-check` runs Gate 1 and Gate 3 **once** against an epic's full story list before any of its stories are created, producing `epic-{N}-readiness.md`.

When `bmad-create-story` finds that report marked `swept: true` for the epic in scope, it skips Gate 1 and Gate 3 for that individual story, citing the report's findings instead, and runs only Gate 2 (UI Complexity & Reusability, which stays per-story since UI scope is story-specific) plus a lightweight non-subagent check for anything the sweep didn't anticipate. If no swept report exists, `bmad-create-story` falls back to running all three gates per-story as described above.

## Escape Hatch

The user may explicitly override a gate finding (e.g. "ship it without the image for now"). If so, record that decision in the story's Dev Notes so `bmad-dev-story` and future reviews know it was a deliberate, accepted gap — not a missed one.
