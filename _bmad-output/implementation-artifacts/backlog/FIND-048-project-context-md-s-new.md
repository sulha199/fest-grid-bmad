---
backlog_id: FIND-048
title: "project-context.md's new Meta-Testing/Tooling Packages testing tier (Story 0.44) may need propagating into other spec/companion docs that restate testing rules"
captured: 2026-09-22
---

# FIND-048: project-context.md's new Meta-Testing/Tooling Packages testing tier (Story 0.44) may need propagating into other spec/companion docs that restate testing rules

## Board note (moved verbatim from backlog.yaml, 2026-11-02)

Scoping pass found exactly two real duplicates (only one project-context.md exists repo-wide; the 4 SPEC.md companions under _bmad-output/specs/ don't restate testing rules at all): (1) top-level README.md's own onboarding description of the tiered testing strategy, now amended to mention the third tier; (2) packages/testing-config/README.md's Testing Philosophy section, which never documented the tsx --test pattern packages/graphql-select already used (a pre-existing gap, not caused by Story 0.44) -- added as a fourth bullet, citing graphql-select as precedent and project-context.md's tier as the full rule. No other doc needed a change. Fixed directly, not deferred further.
