# Review — Version & Reality Check

**Target:** `ARCHITECTURE-SPINE.md` Stack table (AI Dev Orchestrator, created 2026-08-20)
**Companion checked:** `_bmad-output/specs/spec-ai-dev-orchestrator/stack.md`
**Method:** Adversarial fact-check — independently re-verified every pinned version and the 9Router claim against live web sources (npm registry direct fetches + web search), rather than trusting the document's assertions or my own training-data priors. "Today" = 2026-08-20.

---

## Verdict

Most pins are real packages and mutually installable, and the 9Router claim checks out in detail — but **two pins are stale relative to what's actually current today**, and there's an **unresolved internal contradiction** between the spine's Node 24 pin and stack.md's stated Node floor versus what the pinned `openai` SDK actually requires. This looks like it was checked against the registry at some point, but not fully re-verified as of the document's own stated date, and the two documents (spine vs. stack.md) drifted from each other.

---

## Findings

### 1. TypeScript 6.0.3 is not current — TypeScript 7.0 GA'd over a month before this doc's date (Medium-High)

The spine pins `TypeScript 6.0.3` with no qualifier, implying it's the current/intended version. Verified live:

- **npm registry `typescript` `latest` dist-tag = `7.0.2`** (direct `registry.npmjs.org/typescript/latest` fetch).
- TypeScript 7.0 — the Go-native compiler rewrite (formerly `tsgo`) — shipped GA on **July 8, 2026**, per multiple independent sources (InfoWorld, Visual Studio Magazine, Digital Applied), with a stated 8–12x full-build speedup.
- `6.0.3` does exist as a real, valid npm version (confirmed via `registry.npmjs.org/typescript/6.0.3` — published by `typescript-bot`, `engines.node >= 14.17`), and appears to be the last release on the 6.x line (per secondary source: released April 16, 2026). So the pin isn't fabricated — but it is **not "the current version"** the way an unqualified stack-table entry implies.
- There is a legitimate reason a project might deliberately stay on 6.x right now: **TypeScript 7.0 has no stable programmatic compiler API yet** (targeted for 7.1), which breaks `ts-node`, `ts-morph`, `typescript-eslint`, and template-checkers behind Vue/Svelte/Astro until they catch up. If that's the actual reasoning, it should be stated in the spine/stack.md as a deliberate compatibility decision — right now it reads as an unexamined "current version" claim that training data (which predates TS 7's GA) would produce by default.

**Recommendation:** Either bump to `7.0.2` and confirm no dependency in this project's toolchain needs the programmatic API, or keep `6.0.3` but add an explicit rationale line ("pinned to 6.x pending 7.1's stable API; see TS 7.0 GA constraints") so the pin reads as a decision, not a stale default.

### 2. `@langchain/langgraph-checkpoint-sqlite` pinned to 1.0.1 — registry latest is 1.0.4, and langgraph 1.4.12 itself tests against 1.0.4 (Medium)

- **npm registry `latest` dist-tag = `1.0.4`**, not `1.0.1` (direct fetch of `registry.npmjs.org/@langchain%2Flanggraph-checkpoint-sqlite/latest`).
- More telling: `@langchain/langgraph@1.4.12`'s own `package.json` lists `@langchain/langgraph-checkpoint-sqlite@1.0.4` as a **devDependency** — i.e., the version the langgraph maintainers actually build/test the checkpointer interface against at 1.4.12 — while the spine pins three patches behind that.
- Peer-dependency ranges technically resolve either way: checkpoint-sqlite 1.0.1 requires `@langchain/langgraph-checkpoint@^1.0.0`; langgraph 1.4.12 requires `@langchain/langgraph-checkpoint@^1.1.5`. npm can satisfy both simultaneously (anything ≥1.1.5 <2.0.0 satisfies `^1.0.0` too), so this **won't hard-fail at install** — but it means AD-5's SQLite checkpointer would run on an interface generation the current langgraph release doesn't itself validate against, which is exactly the kind of silent-drift risk AD-5 is trying to prevent architecturally.

**Recommendation:** Bump the pin to `1.0.4` to match what langgraph 1.4.12 actually tests against.

### 3. `resend` is one patch behind current (Low)

Spine pins `6.20.0`; direct registry fetch (`registry.npmjs.org/resend/latest`) shows current latest is `6.21.0`. Low risk (patch-level, fast-moving package), but confirms the versions weren't re-checked at the moment of writing — Resend ships frequently enough that "current as of today" has a short shelf life.

### 4. Internal contradiction: stack.md says "Node.js 20+", but the pinned `openai` SDK requires Node ≥22 (Medium)

- `stack.md` line 7 states **"Node.js 20+"** as the runtime floor.
- The spine's Stack table pins **Node 24 (Active LTS)** — fine on its own, and correctly verified: Node 24 entered Active LTS Oct 28, 2025 and is confirmed the Active LTS line as of Aug 2026 (multiple sources, incl. endoflife.date-derived summaries).
- But the pinned `openai` SDK `7.5.0` declares `"engines": {"node": ">=22.0.0"}` (direct registry fetch). So stack.md's "20+" floor is **not actually installable** with the openai SDK version the spine pins — anyone provisioning against stack.md's stated floor (Node 20 or 21) would fail on `npm install`/runtime engine checks. The two documents disagree with each other, and neither flags the gap.

**Recommendation:** Either raise stack.md's stated floor to Node 22+ (to match what openai 7.5.0 actually requires) or note explicitly that the Node 24 pin in the spine supersedes stack.md's "20+" language.

---

## Confirmed correct (no action needed)

| Claim | Verification |
|---|---|
| Node.js 24 = Active LTS as of 2026-08-20 | Confirmed via search: entered Active LTS 2025-10-28, remains Active LTS through Oct 2026 |
| `@langchain/langgraph` 1.4.12 is real and current | npm registry `latest` dist-tag = `1.4.12`; `engines.node >= 18` (compatible with Node 24 pin) |
| `openai` SDK 7.5.0 is real and current | npm registry `latest` dist-tag = `7.5.0`; supports custom `baseURL` (constructor option or `OPENAI_BASE_URL`) for OpenAI-compatible gateways — confirmed this is a documented, standard SDK feature, not a hack |
| `vitest` 4.1.11 is real and current | npm registry `latest` dist-tag = `4.1.11`; `engines.node` = `^20.0.0 \|\| ^22.0.0 \|\| >=24.0.0` (compatible with Node 24). Note: a `5.0.0-rc.2` prerelease already exists (2026-08-17) — not urgent, but the next major is already in flight |
| 9Router (github.com/decolua/9router) — real, self-hosted, OpenAI-compatible gateway | Confirmed via direct fetch of the GitHub repo: MIT-licensed, self-hosted, Next.js 16 + React 19, default port **20128**, base path **`/v1`**, auth = `Authorization: Bearer <key>` from its own dashboard, model IDs are provider-prefixed (e.g. `cc/claude-opus-4-7`, `glm/glm-5.1`). All four specific claims in stack.md (base URL, auth scheme, port, provider-prefixed model IDs) check out against the actual project, not just the README's marketing copy |

---

## Not independently re-verified (out of scope for this pass, flagged for completeness)

- **Vertex AI / Gemini availability through 9Router** and whether GCP service-account auth is already configured — the spec/spine already self-flag this as an open question under "Deferred," which is the correct posture; I did not attempt to re-verify current 9Router provider support for Gemini 3.1 Pro / 3.5 Flash specifically, since it's already marked as a pre-flight check rather than a settled architectural decision.
