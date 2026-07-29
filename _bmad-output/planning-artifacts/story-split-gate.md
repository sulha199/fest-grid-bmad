# Story Split Gate (bmad-create-story Extension)

Date: 2026-07-29
Scope: Applies to `bmad-create-story` for all epics/stories from this point forward.

## Why This Exists

Retrospective on Story 1.3 found two recurring failure modes that the original `bmad-create-story` → `bmad-quick-dev` pass did not catch, because nothing in the workflow explicitly checked for them:

1. **Missing reusable-component/complex-UI refinement.** `EventCard.tsx` was built without the event image, because the story bundled "build the reusable card" into a larger feature story instead of giving it its own focused refinement pass (props/variants, image handling, loading/empty/error states, a11y).
2. **Missing infra/architectural layer.** The frontend called the DB/domain layer directly instead of going through a backend + GraphQL serverless layer, because no story existed yet for that layer — the feature story quietly absorbed the missing layer instead of surfacing it as a prerequisite.

This document defines two mandatory gates that `bmad-create-story` must run before finalizing any story, so gaps like these are surfaced and split off *before* a story is written, not discovered after `bmad-quick-dev` ships it.

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

## Execution Protocol

1. Run these gates after architecture analysis (story creation Step 3) and before the story file is written (Step 5).
2. For each gate, use the `runSubagent` tool to adopt the owning persona and evaluate the draft story scope against that gate's trigger heuristics, using the loaded architecture/epics/UX content as evidence.
3. If a gate reports **no gap**, note "No gap found" and proceed normally.
4. If a gate reports a **gap**, do NOT silently absorb the missing layer/component into the current story's tasks. Instead:
   - Add an **"Architecture & UX Gate Findings"** subsection under `## Dev Notes` summarizing the gap, which gate raised it, and why.
   - List the deferred scope under `## Out of Scope` with a suggested prerequisite story key (e.g. `1-3a-eventcard-image-and-states`, `0-6-events-graphql-api-layer`).
   - Add a corresponding new `backlog` entry for the prerequisite story to `sprint-status.yaml` (do not overwrite existing entries; append).
   - Add a checklist item under `## Pre-Coding Approval Gate` confirming the prerequisite is either already done, or the user has explicitly accepted the gap and wants to proceed anyway.
5. Report all gate findings and any new prerequisite story keys in the final completion summary shown to the user.

## Escape Hatch

The user may explicitly override a gate finding (e.g. "ship it without the image for now"). If so, record that decision in the story's Dev Notes so `bmad-dev-story` and future reviews know it was a deliberate, accepted gap — not a missed one.
