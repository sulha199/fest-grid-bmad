# Epic 1 Story Validation Report (Validate Story)

Date: 2026-07-28
Scope: Story files in `_bmad-output/implementation-artifacts` for Epic 1 (`1-1` through `1-8`)
Method: Validation against `epics.md`, `project-context.md`, PRD constraints, and create-story checklist quality criteria.

## Summary

- Stories reviewed: 8
- Critical issues: 6
- Enhancement issues: 13
- Optimization issues: 8

## Critical Issues (Must Fix)

1. Conflicting status in Story 1.8
- File: `_bmad-output/implementation-artifacts/1-8-setup-posthog-analytics.md`
- Issue: Header says `Status: ready-for-dev` while completion section says `Status: review`.
- Risk: Sprint routing confusion and incorrect workflow transitions.
- Required fix: Keep one authoritative status and align with `_bmad-output/implementation-artifacts/sprint-status.yaml`.

2. Story 1.7 violates architecture placement guidance
- File: `_bmad-output/implementation-artifacts/1-7-user-signup-and-login-with-google.md`
- Issue: Story directs auth mechanism into `packages/domain/auth` while also prescribing Supabase frontend auth flow.
- Risk: React/Supabase client coupling can leak into domain package despite project rule that domain remains framework-agnostic.
- Required fix: Keep domain package for pure auth business rules only; place Supabase/browser auth client integration in app/ui/infrastructure layer.

3. Story 1.3 includes external repo hard dependency path
- File: `_bmad-output/implementation-artifacts/1-3-display-a-list-of-events-on-the-main-page.md`
- Issue: References `C:\projects\portfolio\meta-api-benchmarker\...` as implementation source.
- Risk: Non-portable guidance and accidental coupling to unrelated repository.
- Required fix: Replace with internal architecture guidance and local implementation requirements only.

4. Missing explicit i18n acceptance criteria where user-facing UI is required (1.3-1.7)
- Files: `1-3` to `1-7`
- Issue: i18n appears in notes, but not reflected as testable AC in several UI stories.
- Risk: i18n skipped during implementation despite being a project invariant.
- Required fix: Add concrete AC assertions for localized labels and text rendering.

5. Missing explicit GraphQL-only enforcement in Story 1.7 task acceptance
- File: `_bmad-output/implementation-artifacts/1-7-user-signup-and-login-with-google.md`
- Issue: Story focuses on Supabase auth flow but does not set boundaries for data access APIs after auth.
- Risk: mixed data access paths (Supabase client reads/writes vs GraphQL + Drizzle rules).
- Required fix: Add constraints that app data access remains GraphQL/Drizzle; auth provider handles identity only.

6. Incomplete testability in stories 1.2-1.6
- Files: `1-2` to `1-6`
- Issue: Several stories lack concrete test tasks and measurable verification gates matching project testing rules.
- Risk: development marked complete without integration/E2E confidence.
- Required fix: Add explicit required test tasks and pass criteria per story.

## Enhancement Opportunities (Should Add)

1. Story 1.2 should include deterministic seed strategy
- Add deterministic seed IDs/slugs or stable random seed approach for repeatable tests.

2. Story 1.2 should define cleanup ordering and transaction strategy
- Prevent FK cleanup failures and partial seed states.

3. Story 1.3 should formalize pagination/infinite-scroll contract
- Include cursor/page-size fields and UI loading behavior AC.

4. Story 1.3 should split responsibilities clearly
- Query shape and filtering logic in domain/infrastructure; UI rendering in packages/ui.

5. Story 1.4 should standardize URL state via `nuqs`
- Current notes mention URL params but should explicitly require `nuqs` to align project context.

6. Story 1.5 should clarify multi-select query semantics
- Define OR-within-group and AND-across-groups behavior for type/category filters.

7. Story 1.5 should specify clear filter reset behavior
- AC for restoring default query, URL, and infinite list state.

8. Story 1.6 should include deep-link fallback behavior AC
- Explicit behavior when no list context exists (already in project context as exception).

9. Story 1.6 should define detail data shape required for modal and full page parity
- Ensure both routes render consistent fields and error states.

10. Story 1.7 should define session persistence and logout behavior
- Clarify post-login token/session and route protection expectations.

11. Story 1.7 should include first-login user provisioning contract
- Clarify idempotency and reconciliation when user exists.

12. Story 1.8 should require non-breaking local-dev behavior with missing keys
- Explicit AC for no-crash/no-op analytics mode.

13. Story 1.8 should include event naming conventions
- Add naming pattern and required properties schema for tracked events.

## Optimization Improvements (Nice to Have)

1. Normalize all stories to one structure template
- Consistent sections: Story, AC, Tasks/Subtasks, Dev Notes, Testing, File List.

2. Reduce repetitive global rule text
- Keep shared rules in reference section and keep story-specific deltas short.

3. Add an "Out of Scope" section for each story
- Limits creep and contradictory implementation choices.

4. Add "Do Not Modify" preservation notes for high-risk files
- Helps avoid regressions from unrelated refactors.

5. Include required deliverables checklist per story
- Example: schema update, migration, tests, docs update.

6. Add explicit "Definition of Done" block per story
- Must include tests and lint/type checks.

7. Standardize status vocabulary in story files
- Use exact set from sprint-status and maintain one status location in file.

8. Add trace links from each AC to task IDs
- Makes review and completion auditing easier.

## Per-Story Validation Verdict

- Story 1.1: PASS (implemented) with historical review notes present.
- Story 1.2: PASS WITH GAPS (testability and deterministic seeding details missing).
- Story 1.3: PASS WITH GAPS (external path dependency and missing measurable i18n/test AC).
- Story 1.4: PASS WITH GAPS (nuqs and explicit test gates not strict enough).
- Story 1.5: PASS WITH GAPS (filter semantics and reset behavior under-specified).
- Story 1.6: PASS WITH GAPS (deep-link fallback and parity constraints should be explicit).
- Story 1.7: NEEDS REVISION (layering conflict and API boundary ambiguity).
- Story 1.8: NEEDS REVISION (conflicting status fields).

## Suggested Execution Order for Fixes

1. Fix status conflicts and sprint alignment (1.8 first).
2. Fix architecture/layering constraints in 1.7.
3. Remove external repo coupling in 1.3.
4. Add explicit test and i18n AC blocks for 1.2-1.7.
5. Add semantics clarifications for filtering/search/detail navigation.
6. Normalize all Epic 1 stories to a common compact template.

## Validation Outcome

Epic 1 stories are broadly usable, but not yet quality-clean for dependable handoff. Apply critical fixes before continuing with `bmad-dev-story` for remaining ready-for-dev items.
