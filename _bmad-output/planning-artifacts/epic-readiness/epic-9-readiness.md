---
epic: 9
swept: true
date: '2026-10-14'
stories_covered:
  - '9.1a'
  - '9.1b'
  - '9.2'
  - '9.3'
  - '9.4'
  - '9.5'
  - '9.6'
  - '9.7'
  - '9.8'
  - '9.9z'
---

# Epic 9 Readiness Report: Boolean, Nested and Richer Date AI Event Filters

Gate 1 (Architecture/Infrastructure Completeness) and Gate 3 (Foundational/Cross-Cutting Dependency Completeness) swept once, epic-wide, per `story-split-gate.md`'s Epic-Level Sweep Mode, against all ten stories formed by `planning-artifacts/epic-formation/formation-2026-10-14.md` from IDEA-069, FIND-082 and BUG-059. Evidence used: `epics.md`'s full Epic 9 and Epic 7 sections, `specs/spec-ai-prompt-event-filter/SPEC.md` + `filter-vocabulary.md` (CAP-6/CAP-7), `festgrid-architecture-spine.md`, `project-context.md`, and the as-built code under `apps/backend/src/schema/resolvers.ts`, `apps/backend/src/lib/ai-gateway/`, `apps/backend/src/lib/ai-event-filters/`, and `packages/domain/src/events/buildEventsQueryCondition.ts` (consulted directly, beyond the usual ACs-only sweep, because this epic is an *upgrade* to already-shipped Epic 7 code rather than greenfield work — the gaps that matter here are places the upgrade's stated scope and the real code diverge).

**Story 9.1a validated as the buildable mechanism:** it is pure `packages/domain` logic (FilterNode types + Zod schema + normalizer), has no dependencies (`Depends on: none`), introduces no new backend/API surface, and is the single shared validation point every other story in the epic (9.2's compiler, 9.3's resolvers, 9.4's Gemini transform) is required to route through — matching this project's existing "one shared Zod schema" convention (`project-context.md`'s Runtime Schema Validation rule) and the `packages/domain` purity restriction (no React, no DB/ORM coupling). Nothing blocks starting it first.

---

## Gate 1 — Architecture / Infrastructure Completeness (epic-wide)

**No epic-wide bypass found.** Every story in Epic 9 sits inside layers Epic 0 and Epic 7 already established and shipped:

- **GraphQL/resolver layer:** Story 0.8 (GraphQL scaffold + codegen) and Epic 7's Story 7.1a (`EventFilterInput`, `buildEventsQueryCondition`) are `done`. Story 9.3 extends the existing schema/resolvers rather than introducing a new API surface.
- **Auth:** Story 0.17's `requireAuth` context is already used by `resolvePromptToEventFilter` (verified in `resolvers.ts`) — Epic 9 adds no new auth logic.
- **AI vendor call path:** Story 0.13 (AI Gateway adapter) and Epic 0.i2's guarded vendor-call wrapper (`callVendor`, Stories 0.i2a/0.i2b/0.i2c — all `review`, meaning merged/implemented) are confirmed in code: `resolvers.ts`'s `resolvePromptToEventFilter` already calls `callGemini` (`apps/backend/src/lib/ai-gateway/adapter.ts`), which routes through `callVendor` (`apps/backend/src/lib/vendor-gateway/guarded-call.ts`). Story 9.4 (upgrading the Gemini transform to expression trees) rides this same, already-adopted call path — no new vendor-call plumbing needed.
- **No new infra:** no new Lambda, queue, or IaC is implied anywhere in the epic's stories. The upgrade is confined to `packages/domain` (types/schema/compiler), existing GraphQL resolvers, the existing Gemini transform, and existing UI (`FilterHub`).

**One gap found and corrected directly (not promoted to a new story):** Story 9.8 ("Rate-limit prompt resolution") specified a per-user limit on `resolvePromptToEventFilter` without saying where that counter is persisted. This stack has no Redis/in-memory layer durable across Lambda cold starts (`project-context.md`'s Technology Stack lists only Postgres/Drizzle for persistence), so a counter needs a real table + migration, not an in-process variable. **Applied directly to Story 9.8's AC in `epics.md`** (unambiguous, single-story-scoped fix) rather than spun into a new story — see the Correction section below.

---

## Gate 3 — Foundational / Cross-Cutting Dependency Completeness (epic-wide + cross-epic)

**No new Epic 0 (or cross-epic) dependency gap found.** Checked specifically:

- **Shared filter-expression mechanism (`FilterNode`):** owned entirely within Epic 9 (Story 9.1a is the mechanism story; 9.2/9.3/9.4/9.5 are its adopters). No other epic in `epics.md` defines or needs a competing expression/boolean-tree mechanism today — Widgets (Epic 6) and Feed/Favorites (Epic 1/2) consume `EventFilterInput` through the *same* compiler Story 9.2 builds, which is the intended single-path design, not a duplicate one.
- **`accountId` resolution (IDEA-065), cited by Story 9.4's AC:** verified already shipped — `resolveFilterAccountId` (`apps/backend/src/lib/ai-event-filters/resolve-filter-account-id.ts`) is live and called from `resolvePromptToEventFilter`. Not a phantom dependency.
- **Date-range fallback (90-day/epoch) cited by Story 9.1b's AC:** verified present in shipped code (`buildEventsQueryCondition.ts` line ~153's hardcoded 90-day window when `dayOfWeek` is set without `dateRange`). Story 9.1b's scope to replace it is grounded, not speculative.
- **Per-user rate limiting (Story 9.8), cross-checked against Epic 0.i2 (Guarded outbound vendor calls):** Epic 0.i2's Story 0.i2c explicitly lists `resolvePromptToEventFilter` as a call site adopted onto the guarded wrapper, and its own note for that story states "the missing rate limit (BUG-011) [is] closed by the same mechanism." Read literally, this looked like Story 9.8 might be re-solving a problem Epic 0.i2 already claims to close. **Verified against the as-built wrapper** (`guarded-call.ts`): `callVendor` provides a per-key concurrency lock + timeout + retry backoff + DPA gate — it has no request-volume/time-window quota concept at all. So Epic 0.i2's "rate limit" wording describes lock-based call serialization, not a true per-user quota; Story 9.8's per-user mutation-rate-limit is a genuinely distinct, not-yet-built concern. **Corrected Story 9.8's AC** to say this explicitly (additive, not a merge/replacement) so a future implementer doesn't collapse the two checks into one, and doesn't assume Epic 0.i2 already covers it.
- **Should the per-user rate limiter become a new generic Epic 0 utility instead of living in Story 9.8?** No — `resolvePromptToEventFilter` is the only mutation in `epics.md` today that needs a per-user, per-mutation volume quota (the existing "Selection exceeds remaining API quota" check in manual extraction, `resolvers.ts` line ~2194, is a different mechanism: a selection-count quota, not a request-rate limiter). This matches the project's own established precedent at Story 3.7e's Gate 3 note ("found no need to generalize this into a shared `EmbedAdapter` interface yet — only one consumer exists... deferring generalization until a second embed-needing platform story actually appears"). Generalizing now, with one consumer, would be premature; keeping it in Story 9.8 and recording the boundary explicitly is the lower-cost correct call. Revisit if a second BYOK-gated synchronous mutation needs the same guard.
- **i18n / analytics / testing / codegen foundations:** all pre-existing and already adopted by Epic 7's shipped stories; Epic 9 only adds translation keys and golden-prompt fixtures (Story 9.5, 9.7) within those existing systems, nothing foundational.

---

## New Prerequisite Stories Created

**None.** This sweep found no gap that rises to a new `epics.md` story (Epic 0 tooling, shared-data-ownership, or single-story split). The one finding (Story 9.8's persistence + boundary-vs-0.i2c ambiguity) was resolved as a direct AC correction to the existing story, per the numbering rule's allowance for unambiguous, non-epic-wide corrections.

No `sprint-status.yaml` changes were needed — Epic 9's ten stories (`epic-9` through `9-9z`) are already present as `backlog` entries, and this sweep added no new backlog keys.

## AC Corrections Applied Directly to `epics.md`

- **Story 9.8 (Rate-limit prompt resolution):** added two ACs — (1) the per-user counter persists in Postgres via Drizzle (new table + migration), not an in-process counter; (2) this limiter is explicitly additive to, never a merge/replacement of, the per-key lock/timeout/backoff `resolvePromptToEventFilter` already inherits via `callGemini` → `callVendor` (Story 0.i2a/0.i2c). A `Note:` citing this sweep (Gate 1 + Gate 3) was added immediately after the story's `Depends on:` line.

---

**Epic 9 Readiness Sweep Status: APPROVED & READY FOR DEV** — proceed to `bmad-create-story` for Story 9.1a first (validated buildable mechanism, no dependencies), then the remaining stories in `epics.md` order. Each will skip Gate 1/3 citing this report and run only Gate 2.
