---
epic: 0
swept: true
date: 2026-08-21
stories_covered: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.10, 0.11]
---

# Epic 0 Readiness Sweep — AI Dev Orchestrator

Gate 1 and Gate 3, translated from `story-split-gate.md`'s festgrid-specific wording (Drizzle/GraphQL/apps-web-vs-backend) into this project's own hexagonal ports-and-adapters architecture — festgrid's `project-context.md`, `docs/infrastructure/`, and architecture spine were deliberately **not** used as evidence; they describe an unrelated product. Evidence used instead: `SPEC.md`, `stack.md`, `state-machines.md`, `ARCHITECTURE-SPINE.md` (AD-1..AD-10), and the full `epics.md` (all 6 epics, 32 stories at the time of the sweep).

Run via a Winston-persona subagent pass, findings independently verified against the source documents before being applied — none were taken on faith.

## Gate 1 — Architecture / Infrastructure Completeness

Two gaps found, both AC corrections to existing stories (no new story needed):

- **Story 0.3's `ExecPort` interface AC was stale** relative to Story 0.7's actual finalized signature — it named a generic `readFile`/`writeFile` pair instead of the real `readFile → { content, fingerprint }`, `writeIfUnchanged(path, content, fingerprint)`, `getWrittenPaths()`, `resetWrittenPaths()` set that Stories 1.1, 1.2, 1.8, and 4.1 actually call. As written, core would have been calling methods the interface never declared — the exact AD-1 violation this gate exists to catch. **Fixed**: Story 0.3's AC now declares the full, final signature set.
- **No AD-5 write-ownership violation found** — Epic 0 writes no target-project artifacts, so this dimension doesn't apply to it.

## Gate 3 — Foundational / Cross-Cutting Dependency Completeness

Four gaps found — three AC corrections, one new story:

- **No test-runner setup.** Story 0.1 never actually installed/configured `vitest` or wired `test`/`lint` scripts, despite every one of the other 31 stories writing a Vitest test. Needed by every later epic identically. **Fixed**: Story 0.1's AC now includes it.
- **`EXEC_TIMEOUT_MS` and `RESEND_API_KEY` had no named home.** Story 0.7's "configurable" timeout and Story 2.1's Resend key were never enumerated in Story 0.4's env surface or `stack.md`'s list, despite AD-7 requiring every env var validated centrally. **Fixed**: both named explicitly in Story 0.4, `stack.md`, and Story 0.7's cross-reference.
- **Fakes existed for only 2 of 4 ports.** Story 0.8 built `FakeLLMPort`/`FakeExecPort` only, but Story 2.3 needs a fake `NotifyPort` (to simulate a failing escalation send) and Stories 4.3/4.4 reference "the fake HITL adapter" by name — neither ever gets built anywhere. Needed independently by Epic 2 and Epic 4. **Fixed**: Story 0.8 now covers all four ports.
- **No dependency-injection pattern for nodes.** `GraphState` is frozen at six fields (SPEC.md Constraints), so it cannot carry port references, resolved target-project paths, or the audit logger — yet nothing ever specified how a node actually receives them. Every node-implementing story in Epics 1, 3, 4, and 5 would each have independently invented its own wiring. **Fixed**: new **Story 0.11** establishes a `NodeContext` object (ports + resolved paths + `runId` + logger + config) assembled once in `bootstrap.ts` and closed over by node-factory functions — also propagated back into `ARCHITECTURE-SPINE.md`'s Design Paradigm and Structural Seed, since the underlying architectural decision was missing there too, not just in the story slate.

## Prerequisite Stories Created

- **Story 0.11: Define the NodeContext dependency pattern** — tooling/infrastructure classification, appended sequentially after Epic 0's prior highest story (0.10), per the numbering rule.

## AC Corrections Applied Directly

- Story 0.1 (Vitest/lint setup)
- Story 0.3 (ExecPort interface signature sync)
- Story 0.4 (named `RESEND_API_KEY`, `EXEC_TIMEOUT_MS`)
- Story 0.7 (cross-reference to the named `EXEC_TIMEOUT_MS`)
- Story 0.8 (all four port fakes, not two)
- Story 0.10 (cross-reference to `NodeContext`)
- Story 1.9 (node-factory / `NodeContext` wiring made explicit)
- `epics.md`'s Additional Requirements section (stale `git add -A` line corrected to match AD-4's actual scoped-staging rule)

All fixes also propagated to `ARCHITECTURE-SPINE.md` and `stack.md` where the underlying decision lived there too, not just in the story text.
