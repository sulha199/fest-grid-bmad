# Contributing to FestDaily

Thanks for taking a look. This project is built with the **[BMad Method](https://docs.bmad-method.org)** — every feature moves through the same disciplined pipeline (PRD → architecture → epics/stories → implementation → review) with each stage's output committed to the repo as a durable artifact, not a throwaway chat. This document is both an onboarding guide and a walkthrough of that process, since the process itself is a big part of what this repo demonstrates.

## Prerequisites

Get the app running locally first: **[SETUP_WALKTHROUGH.md](SETUP_WALKTHROUGH.md)** covers frontend, backend, database, push notifications, analytics, and geolocation setup.

## What is BMad?

BMad is an agentic, spec-driven development workflow. Instead of an AI agent improvising against a vague prompt, work flows through a sequence of specialized "agents" (personas backed by structured skills), each producing a specific artifact that the next stage reads and builds on:

```
Product Brief / PRFAQ
        │
        ▼
       PRD  ──────────────────►  _bmad-output/planning-artifacts/prds/
        │
        ▼
  Architecture Spine  ────────►  _bmad-output/planning-artifacts/festgrid-architecture-spine.md
        │
        ▼
  Epics & Stories  ───────────►  _bmad-output/planning-artifacts/epics.md
        │
        ▼
  Sprint Planning  ────────────►  _bmad-output/implementation-artifacts/sprint-status.yaml
        │
        ▼
  Story Creation (per story)  ─►  _bmad-output/implementation-artifacts/{epic}-{story}-*.md
        │
        ▼
  Dev → Code Review → (loop) → Done
        │
        ▼
  Retrospective (per epic, optional)
```

Nothing here is generated once and forgotten — the PRD, architecture spine, and epics/stories are all living documents that get revisited (see the `sprint-change-proposal-*.md` files in `_bmad-output/planning-artifacts/`) whenever a real change signal shows up.

## Repo Map

| Path | What lives there |
|---|---|
| `_bmad/` | BMad's own agent/workflow/skill definitions. Read, not edited, unless you're customizing BMad itself. |
| `_bmad-output/` | **All** generated planning, architecture, epic/story, and sprint artifacts. This is where the "why" behind the code lives. |
| `_bmad-output/project-context.md` | The single source of truth for tech stack, conventions, and critical implementation rules — read this before touching implementation code. |
| `_bmad-output/planning-artifacts/prds/.../prd.md` | The active PRD — required reading before implementing or modifying any feature. |
| `docs/infrastructure/` | Per-layer infrastructure design docs. |
| `design-artifacts/` | UX process artifacts — trigger map, scenarios, design system. |
| `apps/`, `packages/` | The actual application code. |

## The Workflow, Step by Step

Start any BMad session with `bmad-help` — it reads current project state and tells you exactly what phase you're in and what to do next. You don't need to memorize the sequence below; treat it as background for understanding *why* the repo looks the way it does.

1. **Analysis / Planning** (`bmad-prd`, `bmad-ux`) — discovery-driven creation of the PRD and UX specs. Nothing here touches application source code; output goes to `_bmad-output/` only.
2. **Solutioning** (`bmad-architecture`, `bmad-create-epics-and-stories`) — produces the architecture spine (the binding invariants every feature must respect) and breaks the PRD into epics and stories. `bmad-check-implementation-readiness` gates this phase — PRD, UX, architecture, and epics/stories must all be aligned before implementation starts.
3. **Sprint Planning** (`bmad-sprint-planning`) — turns the epics/stories list into `sprint-status.yaml`, the live tracker for every story's status.
4. **Per-story implementation cycle**:
   - `bmad-create-story` — drafts a story file with full context (acceptance criteria, relevant architecture rules, dependencies) so the dev step doesn't have to rediscover any of it.
   - `bmad-dev-story` — implements the story against that spec.
   - `bmad-code-review` — adversarial review; loops back to `bmad-dev-story` if issues are found, otherwise the story moves to the next one.
5. **Epic close-out** (`bmad-retrospective`, `bmad-epic-readiness-review`) — optional but used here: lessons learned get appended to `sprint-status.yaml`'s action items, and readiness is re-verified against what was actually built (not just what was planned).

Story status values you'll see in `sprint-status.yaml`: `backlog` → `ready-for-dev` → `in-progress` → `review` → `done`. Epics move `backlog` → `in-progress` (automatic, on first story creation) → `done` (manual, once every story is `done`).

## Conventions

- **Mandatory reading before any code change:** `_bmad-output/project-context.md` and the active PRD (see Repo Map above) — this is enforced by `CLAUDE.md` at the repo root for AI-assisted contributions, and is good practice for human contributors too.
- **Architectural decisions are binding, not suggestions.** If a change conflicts with one of the 8 decisions in the [architecture spine](_bmad-output/planning-artifacts/festgrid-architecture-spine.md) (e.g. introducing a new query endpoint instead of extending the Unified Query DSL), that's a signal to revisit the architecture doc via `bmad-correct-course`, not to route around it silently.
- **Runtime validation stays split at the boundary:** AJV/JSON Schema for external/untrusted data at the backend edge, Zod for the frontend edge. The two are never mixed inside a shared package.
- **Commits:** small, scoped to one story or one clearly-described fix; reference the story ID (e.g. `2.1a`) where applicable.

## Picking Up a Story

1. Run `bmad-sprint-status` to see what's `ready-for-dev`.
2. Run `bmad-create-story:validate` if a story file already exists but hasn't been validated, otherwise `bmad-create-story` to draft the next one.
3. Run `bmad-dev-story` against the validated story file.
4. Run `bmad-code-review` when implementation is ready — ideally in a fresh context window / different model than the one that wrote the code.

## Questions

Open an issue, or if you're working inside this repo with an AI agent, just ask `bmad-help` — it's aware of current project state and will point you in the right direction.
