# Story 0.15a: Add a local-dev stub to the outbound email adapter

## Story Details

- Epic: 0
- Story ID: 0.15a
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want `sendTemplatedEmail` (Story 0.15's outbound email adapter, `apps/backend/src/lib/email/adapter.ts`) to bypass the real Amazon SES call and instead log the rendered email to the console when SES is unconfigured or the code is running under tests,
so that I can develop and test any feature that sends email (quota-exhaustion warnings, invalid-API-key alerts, dangerous-event moderator alerts) fully AWS-free, without provisioning real SES credentials — mirroring the local/test bypass already established for the BYOK KMS adapter (Story 0.13's `apps/backend/src/lib/ai-gateway/kms.ts`).

## Acceptance Criteria

1. **Given** Story 0.15's `sendTemplatedEmail<K>(templateKey, to, variables)` adapter exists and normally dispatches a `SendEmailCommand` via `getSesClient()` (`apps/backend/src/lib/email/ses-client.ts`), **when** `SES_FROM_EMAIL_ADDRESS` is unset **or** `process.env.NODE_ENV === 'test'`, **then** `sendTemplatedEmail` still renders the requested template via `renderEmailTemplate` as usual, but does not call `getSesClient()`/the SES SDK at all — it logs the recipient, template key, subject, and rendered text body to the console, and resolves with a locally-generated stub message ID matching `local-dev-<uuid>` (`node:crypto` `randomUUID()`), never throwing.
2. **And** when `SES_FROM_EMAIL_ADDRESS` is set and `NODE_ENV !== 'test'`, behavior is byte-for-byte unchanged from Story 0.15 — the real `SendEmailCommand` is built and dispatched via the `SESv2Client` returned by `getSesClient()`, and a missing `MessageId` in the SES response still throws (existing behavior, untouched).
3. **And** `sendTemplatedEmail`'s exported signature (`<K extends EmailTemplateKey>(templateKey: K, to: string, variables: EmailTemplateVariables[K]): Promise<string>`) and every existing call site are unchanged — only the internal local/no-credential branch changes.
4. **And** no local SMTP catcher (Mailpit/Maildev) or `nodemailer` dependency is introduced — this is a `console`/dev-log stub only, per the explicit scope decision recorded below (Dev Notes "Scope Decision: Console Stub, Not a Local SMTP Catcher").
5. **And** the two existing `apps/backend/src/lib/email/adapter.test.ts` tests that inject a mock `SESv2Client` via `setSesClient()` and assert on the real-send code path continue to pass unmodified in intent (still exercising the real `SendEmailCommand` path against the mock) — each must force `process.env.NODE_ENV` to a non-`'test'` value (e.g. `'development'`) for the duration of the test so the new bypass doesn't intercept them, restoring the original value afterward.
6. **And** the existing third test ("throws error if SES_FROM_EMAIL_ADDRESS is missing") is rewritten to assert the new stub behavior instead of a throw — unset config is no longer an error condition, it is the documented local-dev path.
7. **And** two new test cases cover the bypass's two independent trigger arms in isolation: (a) `SES_FROM_EMAIL_ADDRESS` unset with `NODE_ENV` forced to a non-`'test'` value still triggers the stub and never calls the injected mock client's `send`; (b) `SES_FROM_EMAIL_ADDRESS` set (valid) with `NODE_ENV === 'test'` still triggers the stub and never calls the injected mock client's `send`.
8. **And** `SETUP_WALKTHROUGH.md` §7 ("Outbound Email Adapter (Amazon SES)") gains a note — mirroring §8's existing KMS note verbatim in style — stating that sending in `adapter.ts` is skipped in favor of a console log when `SES_FROM_EMAIL_ADDRESS` is omitted or `NODE_ENV === 'test'`, so this section's setup steps are optional for local development.

## Tasks / Subtasks

- [ ] Task 1: Add the local/test stub bypass to `sendTemplatedEmail` (AC: 1, 2, 3, 4)
  - [ ] In `apps/backend/src/lib/email/adapter.ts`, after rendering the template (`renderEmailTemplate`) but before calling `getSesClient()`, add: `if (!fromEmail || process.env.NODE_ENV === 'test') { ... }`.
  - [ ] Inside the branch: generate a stub ID via `randomUUID()` from `node:crypto`, prefixed `local-dev-`; `console.info` (or `console.log`) a clearly-labeled block containing the trigger reason, `to`, `templateKey`, rendered `subject`, and rendered `text` body; `return` the stub ID. Do not call `getSesClient()` anywhere in this branch.
  - [ ] Remove the existing early `throw new Error('Outbound email sending failed: SES_FROM_EMAIL_ADDRESS environment variable is not defined.')` guard — the "unset config" case is now handled entirely by the new bypass branch, not by throwing.
  - [ ] Leave the real-send path (SES client construction, `SendEmailCommand`, `response.MessageId` throw-if-missing) completely unchanged below the bypass branch.
- [ ] Task 2: Update `apps/backend/src/lib/email/adapter.test.ts` (AC: 5, 6, 7)
  - [ ] In the first test ("sends QUOTA_EXHAUSTION_WARNING email via SESv2Client successfully") and the second test ("propagates SES send errors unmodified"), wrap the body in `try`/`finally`: save `process.env.NODE_ENV` before the test, set it to `'development'`, restore the saved value in `finally` — matching the existing save/restore pattern already used by the third test for `SES_FROM_EMAIL_ADDRESS`.
  - [ ] Rewrite the third test ("throws error if SES_FROM_EMAIL_ADDRESS is missing") to also force `NODE_ENV` to `'development'` (isolating the "unset config" trigger arm from the "test env" trigger arm), delete `SES_FROM_EMAIL_ADDRESS`, inject a mock `SESv2Client` whose `send` sets a `sendCalled` flag, call `sendTemplatedEmail`, and assert: the returned message ID matches `/^local-dev-/`, and `sendCalled` is `false`. Restore both `SES_FROM_EMAIL_ADDRESS` and `NODE_ENV` in `finally`.
  - [ ] Add a fourth test: set `SES_FROM_EMAIL_ADDRESS` to a valid value, force `NODE_ENV = 'test'` explicitly, inject a mock `SESv2Client` with a `sendCalled` flag, call `sendTemplatedEmail`, and assert the same two things (stub ID pattern, `sendCalled === false`) — proving the `NODE_ENV === 'test'` arm triggers the bypass independently of config presence.
- [ ] Task 3: Update `SETUP_WALKTHROUGH.md` (AC: 8) (persistent fact: cloud/external service setup)
  - [ ] Under `## 7. Outbound Email Adapter (Amazon SES)`, after the existing "Configure Environment Variables" step, add an italic note mirroring §8's KMS note verbatim in style: *"Note: Sending in `adapter.ts` is skipped in favor of a console log when `SES_FROM_EMAIL_ADDRESS` is omitted or when `NODE_ENV === 'test'` — this entire section's setup steps are optional for local development."*
- [ ] Task 4: Verification (AC: 1-8)
  - [ ] `pnpm --filter backend exec tsx --test src/lib/email/adapter.test.ts` passes, including the two rewritten/added stub-path tests.
  - [ ] `pnpm --filter backend test` (full backend suite) passes — confirms no other test relies on the removed throw-on-missing-config behavior.
  - [ ] `pnpm build` and `pnpm lint` clean at the repo root for `apps/backend`.

## Dev Notes

### Scope Decision: Console Stub, Not a Local SMTP Catcher

Decided directly with the user before this story was drafted: the local-dev bypass is a `console.log`/`console.info` stub, not a local SMTP catcher (Mailpit/Maildev) with real inbox preview. Rationale: the three templates in `packages/domain/src/email/templates.ts` (`QUOTA_EXHAUSTION_WARNING`, `INVALID_API_KEY_ALERT`, `DANGEROUS_EVENT_MODERATOR_ALERT`) are simple single-paragraph HTML, not complex layouts — a real inbox preview isn't worth the added Docker/`nodemailer` dependency at this stage. Do not introduce `nodemailer`, Mailpit, Maildev, or any Docker Compose service as part of this story.

### Bypass Trigger Condition (confirmed with user during story creation)

Two independent design questions were resolved directly with the user before drafting, because mechanically mirroring `kms.ts`'s exact condition would have silently broken already-passing tests:

1. **Trigger = `!fromEmail`, replacing the existing throw.** `kms.ts`'s primary bypass condition is "key unset" (`!env.byokKmsKeyId`). The direct analog for email is "`SES_FROM_EMAIL_ADDRESS` unset" — but `adapter.ts` currently *throws* on that exact condition, and the pre-existing `adapter.test.ts` asserted the throw. The user chose to change that behavior: missing config now triggers the stub instead of throwing (Task 1's guard removal, Task 2's third-test rewrite), since the whole point of this story is "no config needed to develop locally."
2. **`NODE_ENV === 'test'` is also included, exactly mirroring `kms.ts`'s second condition.** This requires the two existing tests that inject a mock `SESv2Client` and assert on the real-send code path (`sends QUOTA_EXHAUSTION_WARNING...`, `propagates SES send errors unmodified`) to force `NODE_ENV` to a non-`'test'` value for their duration (Task 2), since they intentionally exercise the real send path against a mock client and would otherwise always hit the new bypass instead. Confirmed: no test script or `turbo.json` task currently sets `NODE_ENV=test` for the backend `test` task (`apps/backend/package.json`'s `test` script is a bare `tsx --test src/**/*.test.ts`), so this condition does not fire ambiently today — the explicit force/restore in Task 2 makes the tests robust regardless of ambient `NODE_ENV`, matching the same latent fragility already present (and unaddressed) in `kms.ts`'s own condition.

### Architecture & UX Gate Findings

- **Gate 1 / Gate 3 — sourced from `epic-0-readiness.md` (`swept: true`), not re-run.** The swept report's `stories_covered` includes Story 0.15 as an already-provisioned adapter; this story only adds an internal local-dev branch to that adapter's existing, already-architecturally-approved interface — no new external service, API surface, or cross-cutting dependency is introduced. Lightweight escape-hatch guard applied: this story's scope (one `if` branch in one existing file, one env-var read already present in `env.ts`, no new package, no new infra resource) is fully anticipated by the existing sweep; nothing here plausibly falls outside it.
- **Gate 2 (UI Complexity & Reusability) — no gap, no subagent dispatched.** This story has zero UI surface: it touches only `apps/backend/src/lib/email/adapter.ts`, its test file, and `SETUP_WALKTHROUGH.md` documentation. No React component, page, hook, or util is added or modified. Given this unambiguous zero-UI scope, the check was performed directly rather than via a `wds-agent-freya-ux`/`bmad-agent-ux-designer` subagent invocation, mirroring the same justification recorded by prior backend-only stories (e.g. Story 0.25).

### Data Type Compatibility & Migration Requirements

- Compatibility finding: **No changes required.** This story adds an internal branch to an existing function's control flow — no Drizzle schema change, no `packages/database` migration, no `@festgrid/shared-types`/`@festgrid/domain` type change, and no GraphQL contract change.
- Impacted fields/contracts: None. `EmailTemplateKey`, `EmailTemplateVariables`, and `renderEmailTemplate`'s return shape (`{ subject, html, text }`) are all unchanged.
- Required DB migration changes: None.
- Required TypeScript type changes: None. `sendTemplatedEmail`'s exported signature is unchanged (AC3); `apps/backend/src/env.ts`'s `BackendEnv.sesFromEmailAddress?: string` already exists and is read as-is.
- Backward compatibility and rollout notes: The only externally-observable behavior change is that a deployment/run with `SES_FROM_EMAIL_ADDRESS` unset now silently stubs instead of throwing. In production this is a non-issue — Story 0.14's IaC always provisions the var (and Story 0.25 wires it into the deployed `L_API` Lambda's environment), so production can not land in the unset state as a side effect of this change. Locally, any script that previously relied on the throw-on-missing-config behavior as an error signal will instead see a console-logged stub and a `local-dev-*` message ID — none currently exist in this codebase (only `adapter.test.ts` asserted the throw, and this story explicitly rewrites that assertion per AC6/Task 2).
- Verification checks: Task 4's full `adapter.test.ts` run (rewritten/added cases) plus the full backend suite (`pnpm --filter backend test`) prove no other test depended on the removed throw.

### Project Structure Notes

- **Modified:** `apps/backend/src/lib/email/adapter.ts` (adds the bypass branch, removes the throw-on-missing-config guard), `apps/backend/src/lib/email/adapter.test.ts` (NODE_ENV force/restore on the two existing SES-mock tests, third test rewritten, fourth test added), `SETUP_WALKTHROUGH.md` (§7 note).
- **Not modified:** `apps/backend/src/lib/email/ses-client.ts` (`getSesClient`/`setSesClient` unchanged — the bypass branch simply never calls `getSesClient()`), `apps/backend/src/env.ts` (`sesFromEmailAddress` already exists and is read as-is, no new var), `packages/domain/src/email/*` (templates/types/render logic untouched), every existing `sendTemplatedEmail` call site (none change, per AC3).
- Detected conflicts or variances: None. Story 0.15 is `done`; this story is a pure follow-on to its already-shipped adapter with no dependency on any not-yet-implemented story.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 0.15a`] — this story's authoritative AC text, Note, and Depends-on this story addresses directly.
- [Source: `_bmad-output/planning-artifacts/epics.md#Story 0.15`] — the adapter this story extends; confirmed its exact current AC/Note/Depends-on before drafting the addendum.
- [Source: `apps/backend/src/lib/email/adapter.ts`] — read in full; the exact current implementation this story modifies (fromEmail throw guard, `SendEmailCommand` construction, `MessageId` throw-if-missing).
- [Source: `apps/backend/src/lib/email/ses-client.ts`] — read in full; confirmed `getSesClient`/`setSesClient` are unaffected by this story.
- [Source: `apps/backend/src/lib/email/adapter.test.ts`] — read in full; the exact three existing tests this story's Task 2 modifies/replaces, and the `setSesClient`-mock-injection pattern this story's new tests reuse.
- [Source: `apps/backend/src/lib/ai-gateway/kms.ts`] — read in full; the reference bypass pattern (`!env.byokKmsKeyId || process.env.NODE_ENV === 'test'`) this story mirrors for its trigger condition.
- [Source: `apps/backend/src/env.ts`] — read in full; confirmed `sesFromEmailAddress?: string` already exists in `BackendEnv` and requires no change.
- [Source: `packages/domain/src/email/types.ts`, `packages/domain/src/email/templates.ts`] — read in full; confirmed the current three-template `EmailTemplateKey` set and that no `SYSTEM_ERROR_ALERT` template exists yet (Story 0.23 is not yet implemented), consistent with this story's unchanged-templates scope.
- [Source: `apps/backend/package.json`] — confirmed the backend `test` script (`tsx --test src/**/*.test.ts`) does not itself set `NODE_ENV=test`, and no `turbo.json`/CI config does either — informs the "explicit force/restore, not reliance on ambient env" approach in Task 2.
- [Source: `SETUP_WALKTHROUGH.md` §§7-8] — read in full; §8's existing KMS bypass note (line 246) is the exact style/wording template Task 3 mirrors for §7.
- [Source: `_bmad-output/planning-artifacts/epic-readiness/epic-0-readiness.md`] — confirmed `swept: true`; basis for citing rather than re-running Gate 1/3.
- [Source: `_bmad-output/planning-artifacts/story-split-gate.md`] — gate definitions, execution protocol, numbering rule (single-story split → lettered suffix, applied as `0.15a`).
- [Source: `_bmad-output/project-context.md#Security`, `#General Architecture`] — Credential Management rule (no hardcoded/fallback credentials — the stub logs a placeholder reason, never a fabricated "from" credential) and the Adapter Pattern rule this story preserves (the bypass lives inside the existing adapter, no new integration point).

## Global Rules References

- `_bmad-output/project-context.md` — Security (Credential Management: no hardcoded/fallback credentials), General Architecture (Adapter Pattern for external services — this story preserves `sendTemplatedEmail` as the sole entry point).
- `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order/status vocabulary followed in this file.
- `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — no dedicated `AD-*` rule for outbound email exists (confirmed via grep); this story's approach is governed by `project-context.md`'s Adapter Pattern and Credential Management rules.
- `docs/infrastructure/index.md`, `docs/infrastructure/6-outbound-email.md` — no new architecture-diagram node/edge; this story adds a local-only code branch to the existing SES adapter, it does not change the provisioned service.

## Implementation Plan (Rule-Compliant)

### File Change Plan

- **Modified:** `apps/backend/src/lib/email/adapter.ts`, `apps/backend/src/lib/email/adapter.test.ts`, `SETUP_WALKTHROUGH.md`.
- **Not modified:** `apps/backend/src/lib/email/ses-client.ts`, `apps/backend/src/env.ts`, `packages/domain/src/email/*`, every existing `sendTemplatedEmail` call site.

### Rule Mapping

- Adapter Pattern rule (`project-context.md`) → `sendTemplatedEmail` remains the single entry point; the bypass is internal to the adapter, not a new call path for consumers (Task 1).
- Credential Management rule (no hardcoded/fallback credentials) → the stub never fabricates a real "from" address or credential; it logs the actual (possibly absent) configured value and a clear stub label (Task 1).
- Cloud/external-service setup → persistent fact → `SETUP_WALKTHROUGH.md` §7 note documenting the section is now optional for local dev (Task 3).
- Gate 1/2/3 — evaluated and resolved directly above (Architecture & UX Gate Findings); no new prerequisite story required.

### Verification Plan

- `pnpm --filter backend exec tsx --test src/lib/email/adapter.test.ts` — all four cases (two rewritten-for-NODE_ENV, one rewritten-to-stub, one new) passing (Task 4).
- `pnpm --filter backend test` — full backend suite green, confirming no other test depended on the removed throw-on-missing-config behavior (Task 4).
- `pnpm build`/`pnpm lint` clean at the repo root for `apps/backend` (Task 4).

## Pre-Coding Approval Gate

- [ ] Scope confirmation: add a local/test console-log stub bypass to `sendTemplatedEmail`, triggered when `SES_FROM_EMAIL_ADDRESS` is unset **or** `NODE_ENV === 'test'`; remove the existing throw-on-missing-config guard; no SMTP catcher, no `nodemailer`, no new dependency.
- [ ] Architecture and boundary confirmation: the bypass lives entirely inside `apps/backend/src/lib/email/adapter.ts` — `sendTemplatedEmail`'s signature and all call sites stay unchanged; `ses-client.ts` is untouched.
- [ ] Testing plan confirmation: `adapter.test.ts`'s two existing SES-mock tests get `NODE_ENV` forced to `'development'` for their duration; the "throws if missing" test is rewritten to assert stub behavior; a new fourth test proves the `NODE_ENV === 'test'` trigger arm in isolation.
- [ ] Explicit human approval state (Default: **pending approval**).
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted: Gate 1/3 — sourced from `epic-0-readiness.md` (`swept: true`), no fresh gap; Gate 2 — no gap (zero UI scope, confirmed directly, no subagent dispatched).
- [ ] **Behavior-change acceptance:** confirm that changing "missing `SES_FROM_EMAIL_ADDRESS` throws" to "missing `SES_FROM_EMAIL_ADDRESS` stubs" is the intended outcome (user already confirmed this during story creation — recorded in Dev Notes "Bypass Trigger Condition").
- [ ] **`NODE_ENV === 'test'` inclusion accepted:** confirm the two existing mock-client tests being modified to force a non-`'test'` `NODE_ENV` is acceptable (user already confirmed this during story creation).

## Testing Requirements

- [ ] Unit/integration tests (required): `apps/backend/src/lib/email/adapter.test.ts` via `node:test`/`tsx --test` — real-send path (2 tests, NODE_ENV-forced), missing-config stub path (1 rewritten test), `NODE_ENV==='test'` stub path (1 new test) (Task 2/4).
- [ ] Full backend suite (required): `pnpm --filter backend test` green, proving no regression elsewhere from the removed throw (Task 4).
- [ ] E2E tests: Not applicable — no UI in this story.
- [ ] Manual verification (optional, not blocking): running any backend flow that calls `sendTemplatedEmail` locally with no `SES_FROM_EMAIL_ADDRESS` configured and observing the console-logged stub output.

## Deliverables Checklist

- [ ] `sendTemplatedEmail` bypasses SES and logs to console + returns a `local-dev-*` stub ID when `SES_FROM_EMAIL_ADDRESS` is unset or `NODE_ENV === 'test'`.
- [ ] Real-send path (SES configured, non-test env) behaves identically to Story 0.15's original implementation.
- [ ] `adapter.test.ts` updated per Task 2 (4 passing cases covering both paths and both bypass trigger arms).
- [ ] `SETUP_WALKTHROUGH.md` §7 updated with the local-dev-optional note.
- [ ] `pnpm build`/`pnpm lint` pass at the repo root for `apps/backend`.

## Out of Scope

- A local SMTP catcher (Mailpit/Maildev) or any real inbox-preview mechanism — explicit scope decision (Dev Notes "Scope Decision: Console Stub, Not a Local SMTP Catcher").
- Adding `nodemailer` or any new email-sending dependency.
- Any change to `EmailTemplateKey`, `EmailTemplateVariables`, `renderEmailTemplate`, or the three existing templates in `packages/domain/src/email/templates.ts`.
- Any change to `sendTemplatedEmail`'s exported signature or any of its existing call sites.
- Story 0.23's `SYSTEM_ERROR_ALERT` template — not yet implemented, unrelated to this story's scope.
- Reconciling or otherwise touching Story 0.25's IaC/Secrets-Manager wiring for `SES_FROM_EMAIL_ADDRESS` — that story governs how the var is delivered in deployed environments; this story only changes local/test behavior when it is absent.

## Definition of Done

- [ ] AC 1-8 satisfied.
- [ ] `apps/backend/src/lib/email/adapter.test.ts` passing with all four cases (Task 2/4).
- [ ] `pnpm --filter backend test` passing (full suite, no regressions).
- [ ] `pnpm lint` and `pnpm build` passing for `apps/backend`.
- [ ] `SETUP_WALKTHROUGH.md` §7 updated (Task 3).
- [ ] Pre-Coding Approval Gate explicitly approved by the user before implementation begins, including the behavior-change and `NODE_ENV==='test'`-inclusion acceptance items.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
