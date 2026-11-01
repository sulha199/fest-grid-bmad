---
backlog_id: FIND-047
title: "project-context.md's Testing Rules section has no tier for a meta-testing/tooling package (packages/domain's 100%-unit-test rule and the apps/* testing-trophy/E2E-DoD rule are a closed partition that packages/visual-audit fits neither)"
captured: 2026-09-22
---

# FIND-047: project-context.md's Testing Rules section has no tier for a meta-testing/tooling package (packages/domain's 100%-unit-test rule and the apps/* testing-trophy/E2E-DoD rule are a closed partition that packages/visual-audit fits neither)

## Board note (moved verbatim from backlog.yaml, 2026-11-02)

Surfaced by bmad-create-story's mandatory Gate 3 (story-split-gate.md) while drafting Story 0.43 (2026-09-22): Story 0.43 is the first-of-a-kind dev-tooling/check-engine package, and its own future adopters (IDEA-050's masonry story, BUG-040's fix story) will inherit whatever testing/DoD convention it sets. Left undecided, that precedent gets set ad hoc by whichever story happens first instead of as a reusable, project-wide rule. Story 0.44 amends project-context.md's Testing Rules with an explicit third tier; Story 0.43 proceeds with its own scoped, documented DoD in the meantime (escape hatch accepted, not blocking).
