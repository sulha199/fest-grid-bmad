---
epic: 1
swept: true
date: 2026-07-31
stories_covered:
  - 1.1
  - 1.2
  - 1.3a
  - 1.3b
  - 1.3
  - 1.4
  - 1.5
  - 1.6a
  - 1.6
  - 1.7
  - 1.8
---

# Epic 1 Readiness Report — Core App and Event Discovery

## Scope

Epic 1's stories already had `bmad-create-story`'s per-story Gate 1/2/3 applied retroactively once (that pass produced the 1.3a/1.3b/1.6a splits and promoted Stories 0.6-0.8 into Epic 0). This sweep checks whether Epic 1's current story list still originates any shared/project-wide gap that other epics silently depend on.

## Gate 1 — Architecture / Infrastructure Completeness

**One gap found**, confirmed independently by both the Gate 1 and Gate 3 subagent passes:

- **No backend GraphQL authentication/session-verification layer.** Story 1.7 wires Supabase Auth into `apps/web` for identity/session only. Story 0.8's GraphQL Yoga server scaffold and Story 1.3a's resolver layer define query-depth/complexity protection and DSL-to-Drizzle resolution, but neither specifies a request-context shape, JWT/session verification, or how a resolver obtains an authenticated `userId`. Confirmed directly against `apps/backend`'s `server.ts` task in Story 0.8 (`createYoga({ schema, plugins })` — no `context:` factory) and against `packages/database/schema.ts` (no session/role linkage on `users` beyond `id`/`email`).
- Story 2.1 ("Favorite an event", Epic 2 — already has a created story file) states AC4 "only authenticated users can favorite or unfavorite events" and Dev Notes "Auth identity context is required for favorite ownership," citing no mechanism, because none exists yet.

No other Gate 1 violations found: 1.1–1.6/1.3b/1.6a/1.8 all route data access through 1.3a's GraphQL API with no frontend→DB bypass, reusable components correctly scoped to `packages/ui`, DSL logic scoped to `packages/domain`, no external services called directly from the frontend, no secrets/business rules leaked into frontend code.

## Gate 3 — Foundational / Cross-Cutting Dependency Completeness

**Same gap, confirmed cross-epic** (≥2 independent epics with hard AC-level dependencies, clearing Gate 3's promotion bar):

- Epic 2 (Story 2.1 AC4, Story 2.3, Story 2.9 — all inherently per-user).
- Epic 3 (Story 3.2 "subscribe... to MY account," Story 3.1 onboarding gating).
- Epic 4 (Stories 4.1, 4.3 "requires login," 4.6 "My Reports page").
- Epic 5 (per-subscription manual post selection screens).

A related, narrower sub-finding: the `users` table has no `role`/`moderator` column, needed by Epic 4's Story 4.7 ("Moderator Items page") and confirmed by the PRD ("For the MVP, moderator access levels will be assigned manually via the database," PRD §3.9.3). Evaluated on its own this is single-epic (Epic 4 only) and would not clear Gate 3's ≥2-epic bar — but it rides the identical resolver-context/`users`-table surface as the auth-context gap above, so it is folded into the same new story rather than spun off separately (mirrors Story 0.13's precedent of folding its own schema fields into the adapter story rather than a separate migration story).

Two subagent passes reached different placement recommendations for the auth-context gap: one favored a `1.7a` lettered suffix (tight coupling to Story 1.7's OAuth mechanics), the other favored promotion to Epic 0 (≥2-epic consumer set, same shape as Stories 0.13/0.15/0.16). **Resolved in favor of Epic 0**, consistent with this project's established precedent: Story 0.13 (AI Gateway adapter) forward-depends on Story 1.1 yet lives in Epic 0 precisely because its consumer set spans multiple later epics, not because of where its trigger originated.

No other Gate 3 gaps found. Analytics (Story 1.8) is independently confirmed already resolved — a real `@festgrid/analytics` workspace package exists with `PostHogProvider` wired into the root layout, matching architecture spine AD-5.

## New Prerequisite Stories Added

| Story | Title | Classification | Position |
|---|---|---|---|
| **0.17** | Set up GraphQL authenticated-context layer | Tooling/infrastructure gap (with a folded-in schema addition) → new Epic 0 story | Appended after Story 0.16, before Epic 1 |

Written as a full section (As a/I want/So that + Acceptance Criteria + `Note:` + `Depends on:`) into `epics.md`, and added as a `backlog` entry to `sprint-status.yaml` immediately before `epic-0-retrospective`.

## AC Corrections Applied to Existing Stories

None. Story 2.1's existing AC4 ("only authenticated users can favorite or unfavorite events") remains a valid business-level AC — it now has a backing story (0.17) rather than needing rewording. No epics.md story required narrowing.
