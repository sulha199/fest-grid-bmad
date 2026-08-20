# Rubric Walk — ARCHITECTURE-SPINE.md (AI Dev Orchestrator)

Reviewer: rubric-walker
Reviewed: `ARCHITECTURE-SPINE.md` against SPEC.md, stack.md, state-machines.md, and `.memlog.md` (same dir as spine).
Context weighting: personal, single-user, local dev-tooling CLI — not a production/regulated system. Findings below are scoped accordingly; no enterprise-scale concerns manufactured.

## Verdict

Solid, appropriately-scoped spine for its altitude — 8 ADs each fix a real cross-unit divergence point with a concrete, checkable rule, the Capability→Architecture Map covers all 11 CAPs sensibly, the Stack table is internally consistent, and the Deployment & environments note is sufficient for a local-only v1 tool. Three real gaps found, all moderate (not blocking, but worth closing before epics/stories are drafted so two independently-built pieces don't silently diverge), plus one minor completeness nit.

## Checklist walk

### 1. Fixes real divergence points at initiative altitude — mostly yes, three gaps found

The 8 ADs correctly fix the load-bearing cross-cutting concerns: I/O boundary (AD-1), verdict enum (AD-2), retry ceiling (AD-3), commit timing (AD-4), state ownership (AD-5), model resolution (AD-6), config loading (AD-7), audit logging (AD-8). These are the right divergence points to nail down before parallel epics/stories get written. However:

**Finding A (moderate) — Crash-resume behavior is a recorded decision that never became an enforceable rule.**
`.memlog.md` line 10 states the SQLite checkpointer choice explicitly exists so the run "resumes mid-epic after a crash/kill instead of restarting." But AD-5's rule only says the checkpointer is "one `.db` per `TARGET_REPO_PATH` run, under `.checkpoints/`" — this phrasing is ambiguous between (a) one persistent db keyed by `TARGET_REPO_PATH`, reused across invocations (resume works by just re-running the CLI against the same repo), and (b) one fresh db per process invocation ("a run"), which would make resume impossible without an explicit resume flag. The CLI description (`cli.ts`: "`dev an epic <name>`, manual review command") never mentions a resume path or run-id argument either. Two implementers building the bootstrap/CLI story independently could reasonably build either interpretation, and only one of them delivers the capability the memlog says was the point of choosing SQLite checkpointing over the alternative. This should be a one-sentence fix to AD-5 ("db keyed by TARGET_REPO_PATH, persisted across invocations; re-invoking `dev an epic` against the same repo resumes from the last checkpoint automatically" or the deliberate alternative).

**Finding B (moderate) — Adapter/system-level error handling policy is silent beyond a naming convention.**
The Consistency Conventions table states "adapter errors are wrapped into a typed `OrchestratorError` before crossing back into core" — that's the only mention of error handling in the whole spine. It doesn't say what happens next: does an `OrchestratorError` abort the whole run, get surfaced to the Tester node as a classified failure (per CAP-4's "failures classified rather than raw log dumps"), or trigger HITL (per CAP-7's "blocking, unclassifiable failure")? This is a real dimension the architecture altitude should own (it's exactly the kind of cross-node contract AD-2's verdict enum exists for) and it is currently neither decided, deferred, nor flagged as an open question — just a type name. Given a multi-hour unattended epic run, an unhandled adapter fault (network blip to 9Router, git conflict, filesystem permission error) crashing the whole process versus being caught and routed to HITL is a meaningfully different experience, and two node implementations could diverge on which they do.

**Finding C (moderate) — AUTO_FIX patch-application ownership is ambiguous between SPEC and state-machines.md, and the spine doesn't reconcile it.**
SPEC.md's CAP-6 success criterion says an AUTO_FIX verdict results in "**the corresponding worker node** applying the recommended patch" — implying Speed Worker patches its own standard-tagged stories and Complex Worker patches its own complex-tagged stories. But state-machines.md's topology diagram only draws `ComplexWorker --> AUTO_FIX --> Tester` — there is no `SpeedWorker --> AUTO_FIX` edge, and the Complex Worker/Reviewer node is described (CAP-2) as the sole reviewer for *any* node's output, suggesting AUTO_FIX patches might always be applied by Complex Worker/Reviewer regardless of who wrote the original code. The spine's Structural Seed has no dedicated `auto-fix.ts` node file and its Capability→Architecture Map doesn't say which file owns patch-application for a story Speed Worker originally implemented. The spine states flatly that "Node topology... [is] already fixed in the spec's `state-machines.md` companion — inherited here, not re-derived," but the topology it inherited doesn't actually resolve this specific question. This is a genuine divergence point for the CAP-2/CAP-3/CAP-6 stories.

### 2. Every AD's Rule is enforceable and prevents its stated divergence — yes

All 8 ADs specify a concrete, checkable rule (file paths, a closed type union, a named env var with default, a specific node/edge behavior). None rely on vague language like "should" or "generally." AD-2's `ReviewVerdict` union is compiler-enforced; AD-3/AD-7's env-var defaults and fail-fast behavior are directly testable; AD-1's port boundary and AD-6's alias-indirection are review-enforceable even without an added lint rule (not required at this altitude for a solo project). No unenforceable ADs found.

### 3. Nothing under Deferred lets two independently-built units diverge in a way that matters — yes, correctly scoped

Walked all six Deferred items:
- Vertex AI provider verification — an operational pre-flight check, not a code divergence point. Fine.
- Sandbox→real-artifact integration (phase 2) — explicitly out of v1 scope per SPEC non-goals. Fine.
- Multi-repo/concurrent sessions — single-repo assumption is explicit; revisiting only if the assumption changes is the right call. Fine.
- CLI argument parsing library — doesn't affect any cross-unit contract (there's one CLI entry point). Fine.
- Exact JSONL schema beyond `{ts, runId, event}` — checked whether anything downstream parses these lines programmatically (resume logic, manual review, etc.) — nothing in SPEC/state-machines.md does; the audit log is human-facing record-keeping only, and AD-8 already mandates all writes go through "a dedicated audit logger" (a single shared function), so the three base fields are guaranteed consistent by construction regardless of what optional payload each event type adds. Correctly low-stakes to defer.
- HITL expand-command syntax — already fixed in state-machines.md, correctly not re-litigated as an architecture concern. Fine.

### 4. Named tech is verified-current and internally consistent — yes

Node 24 / TypeScript 6.0.3 / langgraph 1.4.12 / langgraph-checkpoint-sqlite 1.0.1 / openai 7.5.0 / resend 6.20.0 / vitest 4.1.11, per the task's stated web-verification. Cross-checked internal consistency against `.memlog.md`'s own reasoning: openai SDK 7.5.0 needs Node 22+ (Node 24 satisfies it), resend 6.20.0 needs Node 20+ (satisfied), TypeScript 6.x chosen over 7.0 explicitly for tooling-ecosystem maturity rather than compiler speed (a reasoned tradeoff, not an oversight). No version conflicts found. langgraph 1.4.12 paired with langgraph-checkpoint-sqlite 1.0.1 is a plausible independent-versioning pair for that ecosystem; nothing in the spine or companions suggests a peer-dependency mismatch.

### 5. Covers CAP-1 through CAP-11 — yes, complete, one minor gap in the "Governed by" column

All 11 CAPs appear in the Capability → Architecture Map with a sensible `Lives in` location. Spot-checked each mapping against SPEC intent/success text; all are coherent.

**Finding D (minor) — CAP-6's "Governed by" column is incomplete.** CAP-6 (manual review + patch apply) lists only AD-2, but state-machines.md's Entry Points section spells out two CAP-6-specific rules that live under other ADs: the AUTO_FIX loop is reused (AD-3's retry ceiling applies here too) and checkpoint commits must be deduplicated ("GitCheckpoint only fires if that story didn't already have one" — a real refinement of AD-4's simpler "exactly one commit per completed story" rule). Listing AD-3 and AD-4 alongside AD-2 would make the map accurately reflect what actually governs CAP-6. Low severity since the governing rules do exist in the companions and AD-4's text arguably already implies the dedup outcome — but the map's job is to save the level below a re-derivation, and here it doesn't fully.

### 6. Every dimension this altitude owns is decided/deferred/open — mostly yes; see Findings A and B above

Explicitly checked the three dimensions called out for special attention:
- **Deployment & environments** — sufficiently covered. The Structural Seed's note (no CI/CD, no container, no npm publish, no hosting target, invoked directly via `node`/`tsx`, one run at a time against one `TARGET_REPO_PATH`) is exactly right-sized for a local-only v1 personal tool. No over- or under-engineering here.
- **Infra/provider strategy** — covered. 9Router (external, pre-existing, non-goal to build it) and Resend (decided in memlog with an explicit rationale against SES) are both clearly pinned, with model-alias routing enforced by AD-6.
- **Operations** — mostly covered via AD-8 (audit logging). The one real gap is Finding B (adapter-fault handling policy) and, adjacent to it, Finding A (resume semantics) — both are "operations" in the sense of what happens when an unattended multi-hour run hits trouble, and both are worth a sentence each in the spine rather than left implicit.

No other dimension was found entirely silent — naming, data formats, state ownership, testing strategy (fakes-only per AD-1, vitest per stack table), and git policy are all decided.

## Summary of findings

| # | Severity | Finding |
|---|---|---|
| A | Moderate | AD-5's checkpoint-db-per-run phrasing doesn't unambiguously deliver the crash-resume capability recorded as the rationale for choosing SQLite checkpointing in `.memlog.md`; CLI section never mentions resume. |
| B | Moderate | Adapter-level error handling/recovery policy (abort vs. surface-to-Tester vs. trigger-HITL) is only a one-line type-wrapping convention, not decided/deferred/flagged open. |
| C | Moderate | AUTO_FIX patch-application ownership conflicts between SPEC.md ("the corresponding worker node") and state-machines.md's diagram (only a ComplexWorker→AUTO_FIX edge exists); the spine claims topology is "already fixed" but doesn't reconcile this, and has no node file to own it. |
| D | Minor | CAP-6's "Governed by" column omits AD-3 and AD-4, both of which state-machines.md shows are directly relevant to manual review's AUTO_FIX loop and checkpoint dedup. |

None of these are blocking for a personal local tool, but A, B, and C are the kind of gap that would let two independently-drafted stories (e.g., "implement bootstrap/CLI" and "implement Complex/Speed Worker AUTO_FIX handling") genuinely diverge from each other and from what `.memlog.md` already decided. Recommend closing them with one or two sentences each directly in the spine before epics/stories are created.
