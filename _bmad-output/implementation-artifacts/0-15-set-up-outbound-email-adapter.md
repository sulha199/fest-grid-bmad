# Story 0.15: Set up outbound email adapter

## Story Details

- Epic: 0
- Story ID: 0.15
- Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a dedicated outbound email adapter that wraps a transactional email provider (AWS SES) behind a single interface, with templated messages and delivery via the backend only,
so that every feature that needs to notify a user or moderator by email (quota-exhaustion warnings, invalid-key-attempt alerts, dangerous-event moderator alerts) reuses the same sending mechanism instead of each feature integrating its own email client.

## Acceptance Criteria

1. **Given** the AWS IaC stack (Story 0.14) provisions the backend Lambdas, **when** a backend Lambda needs to notify a user or moderator by email, **then** it does so exclusively through this adapter's exposed interface — never a raw SMTP/provider SDK call from feature code. [epics.md AC1]
2. **And** the adapter's sending-service resource and IAM permissions are provisioned via IaC (Story 0.14). [epics.md AC2]
3. **And** the adapter supports templated messages so each consumer supplies only a template key and variables, not raw markup. [epics.md AC3]
4. **And** sending credentials/config are stored per the project's credential-management rules (`.env`, never hardcoded). [epics.md AC4]
5. **Given** no feature story yet calls this adapter (Story 3.10 "Email notifications for queued posts", FR35's invalid-API-key-attempt notification, and Story 4.5 "Handle Dangerous Event reports" are its first future consumers — all currently `backlog`), **when** this story ships, **then** the adapter is a reserved, ready-to-consume capability — no product/pipeline code invokes it in this story. This story proves the adapter end-to-end via 100%-covered unit tests of its pure template-rendering logic (`packages/domain`) plus a mocked-dependency integration test of the SES-calling orchestrator (`apps/backend`); a real send against a live, DNS-verified domain is explicitly deferred (see Dev Notes "SES Domain Verification & Sandbox Mode"). [Derived — mirrors the "reserved slot" pattern from Stories 0.7/0.8/0.9/0.12/0.13]
6. **Given** `docs/infrastructure/high-level-overview.md`'s architecture diagram and Story 0.14's IaC resource list currently contain no email-sending resource (confirmed by the Epic 0 readiness sweep's Gate 1 finding), **when** this story ships, **then** the diagram is updated to show `L_API` sending to an SES resource, and a new `docs/infrastructure/5-outbound-email.md` shard documents the service choice — mirroring the existing per-service shard convention already used by `4-push-notifications.md`. [Derived from `epic-0-readiness.md` Gate 1 finding #1]

## Tasks / Subtasks

- [ ] Task 1: Resolve the `packages/domain` scaffolding sequencing conflict before starting (AC: 3, 5)
  - [ ] Confirm whether Story 0.13 ("Set up the AI Gateway adapter layer for Gemini") has been implemented — check for a committed `packages/domain/package.json` (`git ls-files packages/domain`). As of this story's creation, `packages/domain` has **zero** committed files (confirmed) — Story 0.13, which owns its first scaffolding, is `ready-for-dev`, not `done`.
  - [ ] If Story 0.13 is already implemented: add a new `src/email/` subfolder alongside its existing `src/ai-gateway/` subfolder (per `project-context.md`'s "organized into sub-folders by domain area" rule) — do not touch `src/ai-gateway/`.
  - [ ] If Story 0.13 is **not** yet implemented (the current state): per the Pre-Coding Approval Gate sign-off, create the minimal `packages/domain` scaffold needed for this story's `src/email/` subfolder to exist and type-check — `package.json` (name `@festgrid/domain`, mirroring Story 0.13's planned shape exactly), `tsconfig.json` (extends `@festgrid/typescript-config/base.json`, `module`/`moduleResolution: "NodeNext"`), `eslint.config.mjs` (extends `@festgrid/eslint-config/base`). No React, no DOM libs, no SDK dependency of any kind — this package must stay importable by Node/Lambda backend code only, per `project-context.md`'s "CRITICAL RESTRICTION" against React in `packages/domain`. This mirrors Story 0.13's Task 1/2 resolution exactly (same recurring Epic 0 pattern as Stories 0.9-0.14).
- [ ] Task 2: Resolve the `apps/backend` scaffolding sequencing conflict before starting (AC: 1, 2, 4)
  - [ ] Confirm whether Story 0.8 ("Set up GraphQL server scaffold...") has been implemented — check for a committed `apps/backend/package.json` (`git ls-files apps/backend`). As of this story's creation, `apps/backend` has **zero** committed files (confirmed via `git ls-files apps/backend`; only untracked, gitignored `dist/`/`node_modules/` build leftovers exist locally) — Story 0.8 is `ready-for-dev`, not `done`.
  - [ ] If Story 0.8 (or Stories 0.12/0.13/0.14, whichever lands first) has already created `apps/backend`: add this story's dependency/env vars to the existing `apps/backend/package.json`/`src/env.ts`.
  - [ ] If **none** of those stories has landed yet: per the Pre-Coding Approval Gate sign-off, create only the minimal `apps/backend` scaffold needed for this story to function — `package.json` (unscoped name `backend`), `tsconfig.json` (extends `@festgrid/typescript-config/base.json`, `module`/`moduleResolution: "NodeNext"`, `outDir: "dist"`), `eslint.config.mjs` (extends `@festgrid/eslint-config/base`). Do **not** build any GraphQL/server/Lambda-handler code — that remains Story 0.8's/0.14's exclusive scope. Mirrors Story 0.12/0.13's Task 1 resolution exactly.
- [ ] Task 3: Build the pure, framework-agnostic email-template rendering logic in `packages/domain` (AC: 3, 5)
  - [ ] Create `packages/domain/src/email/types.ts` exporting `EmailTemplateKey = 'QUOTA_EXHAUSTION_WARNING' | 'INVALID_API_KEY_ALERT' | 'DANGEROUS_EVENT_MODERATOR_ALERT'`, a mapped `EmailTemplateVariables` type keying each `EmailTemplateKey` to its own required variable-name record (e.g. `QUOTA_EXHAUSTION_WARNING: { userName: string; queuedPostCount: number; queuedDays: number; apiKeyManagementUrl: string }`), and `RenderedEmail { subject: string; html: string; text: string }`. Deliberately local to `packages/domain` — not added to `@festgrid/shared-types`, since no frontend code consumes these types (this is a backend-only, Lambda-to-SES concern).
  - [ ] Create `packages/domain/src/email/templates.ts` exporting a `Record<EmailTemplateKey, { subject: string; html: string; text: string }>` (raw markup with `{{variableName}}` placeholders) for the three keys:
    - `QUOTA_EXHAUSTION_WARNING`: subject `"Action Required: Your FestGrid event extraction is paused"` and body copy explaining that `{{queuedPostCount}}` of the user's subscribed posts have been queued for `{{queuedDays}}` days due to Gemini API quota exhaustion, and suggesting they contribute an additional API key via `{{apiKeyManagementUrl}}` — sourced verbatim from `design-artifacts/C-UX-Scenarios/04-alex-extracts-events/04.7-email-notification-quota.md`, the only one of the three templates with an authoritative UX-scenario source.
    - `INVALID_API_KEY_ALERT`: subject `"Action Required: One of your FestGrid API keys is no longer working"` and body copy explaining that `{{invalidAttemptCount}}` consecutive extraction attempts using the user's API key have failed, that shared-subscription push notifications relying on this specific key have paused (PRD FR37), and a link (`{{apiKeyManagementUrl}}`) to review/replace the key — composed from PRD §3.4/FR35/FR37 (no dedicated UX scenario page exists for this alert; flagged in Dev Notes as a copy-content assumption).
    - `DANGEROUS_EVENT_MODERATOR_ALERT`: subject `"[FestGrid Moderation] Dangerous event reported: {{eventName}}"` and body copy stating a user reported `{{eventName}}` as dangerous, with a link (`{{moderatorReviewUrl}}`) to the Moderator Items page — composed from epics.md Story 4.5's AC (no dedicated UX-scenario page exists for this alert either; same flagged assumption).
  - [ ] Create `packages/domain/src/email/render-template.ts` exporting a pure `renderEmailTemplate<K extends EmailTemplateKey>(templateKey: K, variables: EmailTemplateVariables[K]): RenderedEmail` — looks up the template, substitutes every `{{variableName}}` occurrence in `subject`/`html`/`text` via a simple global regex replace, and throws a descriptive `Error` if any placeholder in the template has no corresponding key in `variables` (defense-in-depth: `templateKey`/`variables` may arrive from a less-strictly-typed boundary, e.g. deserialized from an SQS message, not just direct in-process TypeScript calls). No templating library dependency (`handlebars`, `mustache`, etc.) is introduced — the substitution need is simple enough that a dependency-free implementation avoids adding a new package-isolation surface for three static templates.
  - [ ] Create `packages/domain/src/email/render-template.test.ts` using `node:test`/`node:assert` via `tsx --test` (no test framework exists yet — Story 0.10 is still `ready-for-dev`; mirrors the `node:test` precedent Stories 0.8/0.11/0.12/0.13 already established). Achieve **100% coverage** per `project-context.md`'s "Unit Test Requirement", covering: correct substitution for all three template keys, multiple occurrences of the same placeholder within one template, and the missing-variable throw path for each template.
  - [ ] Add a `"test": "tsx --test src/**/*.test.ts"` script to `packages/domain/package.json` if one does not already exist (from Story 0.13).
- [ ] Task 4: Build the `apps/backend` SES orchestrator — the adapter's actual exposed interface (AC: 1, 2, 4)
  - [ ] Add `@aws-sdk/client-sesv2` (`^3.1100.x`) as a dependency of `apps/backend/package.json` only.
  - [ ] Create/extend `apps/backend/src/env.ts` (root-`.env`-loading convention, mirroring `packages/database/env.ts`) to load `SES_FROM_EMAIL_ADDRESS`.
  - [ ] Create `apps/backend/src/lib/email/ses-client.ts`: a lazy singleton `getSesClient()` (constructed on first use, not at import time — mirrors Story 0.12's Firebase Admin and Story 0.13's KMS lazy-init pattern so `apps/backend dev`/`build` don't crash without real AWS credentials locally) returning an `SESv2Client` (region resolved from the Lambda execution environment's built-in `AWS_REGION`, no explicit region config needed, mirroring `kms.ts`'s precedent).
  - [ ] Create `apps/backend/src/lib/email/adapter.ts`: the **sole exposed interface** (AC1) — exported `sendTemplatedEmail<K extends EmailTemplateKey>(templateKey: K, to: string, variables: EmailTemplateVariables[K]): Promise<string>`. Calls `renderEmailTemplate` (`packages/domain`) to get `{ subject, html, text }`, then `getSesClient().send(new SendEmailCommand({ FromEmailAddress: env.SES_FROM_EMAIL_ADDRESS, Destination: { ToAddresses: [to] }, Content: { Simple: { Subject: { Data: subject }, Body: { Html: { Data: html }, Text: { Data: text } } } } }))`, returning the response's `MessageId`. Propagates any thrown SES error to the caller rather than swallowing it — the caller (e.g. the future Story 3.10/4.5 Lambda code) decides retry/re-queue behavior, consistent with the three-queue architecture's own error-handling ownership.
  - [ ] Create `apps/backend/src/lib/email/adapter.test.ts` (`node:test`/`tsx --test`) with `SESv2Client` constructor-injected/module-mocked (no real AWS network calls) proving: each of the three template keys produces a `SendEmailCommand` with the correctly-rendered `Subject`/`Body.Html`/`Body.Text` and the correct `Destination.ToAddresses`; the resolved `MessageId` is returned; a rejected `send()` call propagates the error unmodified.
  - [ ] Add a `"test": "tsx --test src/**/*.test.ts"` script to `apps/backend/package.json` if none exists yet (mirrors Story 0.12/0.13's precedent).
- [ ] Task 5: Provision the SES sending-service resource + IAM permissions via IaC (AC: 2)
  - [ ] Confirm whether Story 0.14 ("Set up AWS IaC for Lambda, SQS, EventBridge, and KMS") has been implemented — check for a committed `apps/infrastructure/lib/festgrid-backend-stack.ts` (`git ls-files apps/infrastructure`). As of this story's creation, `apps/infrastructure` has **zero** committed files — Story 0.14 is `ready-for-dev`, not `done`. **Unlike** the trivial `apps/backend`/`packages/domain` scaffold-duplication tolerance used elsewhere in Epic 0, duplicating the *entire* CDK stack (Lambdas, SQS, KMS, API Gateway — all irrelevant to email) here is wasteful and risks two independently-deployed, conflicting stacks — see Pre-Coding Approval Gate for the recommended sequencing.
  - [ ] **Recommended path — Story 0.14 implemented first:** add a `ses.EmailIdentity` construct to `FestgridBackendStack` (domain identity, `dkimIdentity: ses.DkimIdentity.easyDkim()`, named per the `-${stageName}` convention matching 0.14's other resources), and grant `ses:SendEmail`/`ses:SendRawEmail` via an IAM policy statement scoped to that identity's ARN to `L_API`'s execution role **only** — mirrors the least-privilege KMS-grant-scope precedent from Story 0.14's own AC5 (no other Lambda sends email). Add a `CfnOutput` exposing the identity's DKIM tokens (needed for the DNS records documented in Task 9).
  - [ ] **Fallback path — this story implemented before Story 0.14, explicitly accepted via the Pre-Coding Approval Gate:** create the minimal `apps/infrastructure` scaffold (`package.json`/`tsconfig.json`/`eslint.config.mjs`/`cdk.json`/`bin/infrastructure.ts`) mirroring Story 0.14's own planned shape exactly, plus a standalone `apps/infrastructure/lib/email-identity-stack.ts` (`FestgridEmailStack extends cdk.Stack`) provisioning **only** the `ses.EmailIdentity` + its `CfnOutput`. Record a Completion Note flagging that whoever implements Story 0.14 second must reconcile the two stacks — either fold `FestgridEmailStack`'s identity into `FestgridBackendStack`, or grant `L_API`'s role cross-stack access to the existing identity — so exactly one SES identity resource exists per environment, never two.
  - [ ] In either branch, this story's own automated verification (Task 6) proves the identity + scoped IAM grant are wired correctly via `aws-cdk-lib/assertions`; a real send against a live, DNS-verified domain is deferred (Dev Notes "SES Domain Verification & Sandbox Mode").
- [ ] Task 6: Add/extend CDK infrastructure assertion tests (AC: 2)
  - [ ] Extend `apps/infrastructure/lib/festgrid-backend-stack.test.ts` (recommended path) or create `apps/infrastructure/lib/email-identity-stack.test.ts` (fallback path) using `aws-cdk-lib/assertions`'s `Template.fromStack(...)`. Assert: exactly 1 `AWS::SES::EmailIdentity` resource exists; the IAM policy attached to `L_API`'s execution role grants `ses:SendEmail`/`ses:SendRawEmail` scoped to that identity's ARN; no other Lambda execution role receives an SES-related IAM statement.
- [ ] Task 7: Close the architecture-diagram gap the Epic 0 readiness sweep flagged (AC: 6)
  - [ ] Create `docs/infrastructure/5-outbound-email.md` mirroring `4-push-notifications.md`'s format: **Service:** Amazon SES; **Description:** transactional email delivery for user/moderator notifications; **Reasoning:** consistent with the project's AWS-only, zero-extra-account philosophy (`docs/infrastructure/note-for-the-future.md`) — no third-party account (SendGrid/Postmark/etc.) is needed, and SES integrates directly with the same IAM/Lambda execution roles already used by `L_API`.
  - [ ] Update `docs/infrastructure/index.md`'s table of contents to add a link to the new "5. Outbound Email" section, renumbering the existing "Note for the Future" anchor reference if needed.
  - [ ] Update `docs/infrastructure/high-level-overview.md`'s mermaid diagram: add `SES[Amazon SES]` under the `External Services` subgraph and an `L_API -- sends to --> SES` edge, mirroring the existing `L_API -- sends to --> FCM` edge — this directly closes the gap `epic-0-readiness.md`'s Gate 1 finding #1 identified ("the `high-level-overview.md` architecture diagram... contain[s] no email-sending resource").
- [ ] Task 8: Wire environment variables (AC: 4)
  - [ ] Add to root `.env.example`: `SES_FROM_EMAIL_ADDRESS=` (backend-only, no `NEXT_PUBLIC_` prefix — never exposed to the browser; placeholder pending a real, DNS-verified sending domain, e.g. `notifications@festgrid.app`).
  - [ ] Do **not** add `SES_FROM_EMAIL_ADDRESS` to `turbo.json`'s `globalEnv`/task `env` arrays — mirrors the existing `DATABASE_URL`/`BYOK_KMS_KEY_ID` precedent: it is read lazily at first runtime call (`adapter.ts`), never at build time.
  - [ ] No `.github/workflows/ci.yml` changes needed — CI's `build`/`lint`/`test` steps do not require real AWS/SES credentials (the mocked-dependency unit/integration tests in Task 3/4 need none), mirroring Story 0.12/0.13's precedent.
- [ ] Task 9: Update `SETUP_WALKTHROUGH.md` with a new outbound-email section (persistent fact: cloud/external service setup)
  - [ ] Before writing, check the current highest `## N.` section number in `SETUP_WALKTHROUGH.md` (as of this story's creation it has sections 1-5; Story 0.13's own planned Task 6 or Story 0.16's planned setup task may have already claimed "6" if implemented first — **do not hardcode a section number**, append using whatever number is next available at implementation time).
  - [ ] Add the new section describing: creating/verifying a sending domain identity in the AWS SES console (Verified identities → Create identity → Domain), adding the returned DKIM CNAME records to the domain's DNS, and requesting SES **production access** (moving out of the default sandbox, which restricts sending to only pre-verified recipient addresses) via an AWS Support case — both are one-time, per-AWS-account manual prerequisites before this adapter can deliver real email to arbitrary recipients, distinct from this story's own automated CDK/code verification.
- [ ] Task 10: Verification (AC: 1-6)
  - [ ] `pnpm --filter domain exec tsx --test src/email/*.test.ts` (or the wired `test` script) passes with 100% coverage on `render-template.ts`.
  - [ ] `pnpm --filter backend exec tsx --test src/lib/email/adapter.test.ts` (or the wired `test` script) passes, proving the mocked-SES orchestration path in Task 4.
  - [ ] `pnpm --filter infrastructure exec cdk synth` succeeds (whichever branch of Task 5 applies) and `pnpm --filter infrastructure exec tsx --test lib/**/*.test.ts` passes, proving Task 6's resource/IAM-scope assertions.
  - [ ] Run `pnpm build` and `pnpm lint` at the repo root and confirm both are clean for `packages/domain`, `apps/backend`, `apps/infrastructure`.
  - [ ] Record in Completion Notes that a real SES send against a live, DNS-verified, production-access-granted domain is **not** performed as part of this story's automated verification (no AWS credentials or verified domain available in this development environment) — deferred until Story 3.10/FR35's owning story/Story 4.5 becomes the adapter's first real caller against a fully set-up AWS account.

## Dev Notes

- **This story is pure infrastructure/plumbing — no product UI ships, and no feature story calls it yet.** Stories 3.10, 4.5, and whichever story owns FR35's invalid-key-attempt notification (currently folded into Epic 3's narrative, no dedicated story yet — tracked as a watch item, not a Gate 3 gap, since Story 3.9's AC already narrows FR35's counting mechanics to Story 0.13's `invalid_attempts` column, leaving only "send the email" for a future story to wire up against this adapter) are this adapter's first real callers. This mirrors the "reserved slot, not implemented" pattern already established by Stories 0.7, 0.8, 0.9, 0.12, and 0.13.
- **Why the template-rendering logic lives in `packages/domain`, but the SES-SDK-calling code lives in `apps/backend`:** `renderEmailTemplate` is a pure function over plain strings (no I/O, no SDK, no network) — exactly the "framework-agnostic business logic" `packages/domain` exists for, and the persistent "reusable mechanism → `packages/domain`" project rule applies cleanly (same precedent as Story 0.13's `selectApiKey`/`isCycleElapsed`/`computeBackoffDelayMs`). The SES SDK call, `SESv2Client` construction, and env-var reads are all I/O- and SDK-coupled — these stay in `apps/backend`, consistent with that same precedent (and with Story 0.12's `firebase-admin` wrapper, Story 0.8's `buildOptimizedDrizzleSelect`, which stayed out of `packages/domain` for the identical reason).
- **`packages/domain`/`apps/backend` scaffolding sequencing conflicts — same recurring Epic 0 pattern as Stories 0.9-0.14.** As of this story's creation, neither `packages/domain` nor `apps/backend` has a committed `package.json` (`git ls-files` returns nothing for both — Stories 0.13 and 0.8/0.12/0.14 all still `ready-for-dev`). Tasks 1/2 handle both orderings explicitly, mirroring Story 0.13's Task 1/2 resolution.
- **SES IaC dependency is a *hard* sequencing gap, not a soft one (see Pre-Coding Approval Gate):** Unlike the trivial `package.json`/`tsconfig.json` duplication Stories 0.9-0.14 tolerate for `apps/backend`/`packages/domain` (cheap to create twice and reconcile), duplicating Story 0.14's entire CDK stack definition to add one SES resource would be wasteful and risks two independently-deployed stacks fighting over the same AWS account. This story's Task 5 therefore recommends implementing Story 0.14 first, with an explicit, flagged fallback (a standalone `FestgridEmailStack`) only if the user deliberately chooses to build this story first.
- **Template copy content — one of three sources, one assumption flagged for sign-off:** `QUOTA_EXHAUSTION_WARNING`'s copy is sourced verbatim from the authoritative UX scenario `design-artifacts/C-UX-Scenarios/04-alex-extracts-events/04.7-email-notification-quota.md` (subject line and body content explicitly specified there). `INVALID_API_KEY_ALERT` and `DANGEROUS_EVENT_MODERATOR_ALERT` have **no** dedicated UX-scenario page — their copy is composed directly from PRD §3.4/FR35/FR37 and epics.md Story 4.5's AC respectively. This is flagged as a Pre-Coding Approval Gate item since it is genuine MVP copy authored by this story, not transcribed from an existing spec, and is trivially revisable later (a `templates.ts` string edit) without any other story depending on the exact wording.
- **SES Domain Verification & Sandbox Mode (accepted forward dependency, not a Gate 1 gap):** Amazon SES requires (1) a verified sending domain (DNS DKIM records) and (2) an approved "production access" request before it can send to arbitrary, non-pre-verified recipients — neither is achievable inside this development environment (no real AWS account/domain access). This story's `ses-client.ts` is lazily initialized (mirrors Story 0.12/0.13's lazy-SDK-client pattern) so `apps/backend dev`/`build`/unit-tests all work without real SES access; the full real-send round trip is deferred until whichever consumer story (3.10/4.5/FR35's owner) runs against a fully set-up AWS account, the same way Story 0.12 deferred its full real-Firebase round trip and Story 0.13 deferred its full real-KMS+Gemini round trip.
- **Why no templating library (`handlebars`, `mustache`) is introduced:** Only three static templates exist today, each needing simple flat-variable substitution (no loops, no conditionals, no partials). A dependency-free regex-based `renderEmailTemplate` avoids adding a new package-isolation surface for a need this small — consistent with Story 0.13's own precedent of hand-rolling `backoff.ts` rather than pulling in an ESM-only `p-queue`. If a consumer story later needs richer templating (loops/conditionals), that is a scope change to `render-template.ts` at that time, not a reason to add the dependency speculatively now.
- **Package dependency isolation (project-context.md, persistent fact):** `@aws-sdk/client-sesv2` is added to `apps/backend` **only**. It is not added to `packages/domain` (which stays SDK-free) or any other shared package.
- **No `packages/ui` component is introduced.** No React component renders anything in this story — confirmed via a fresh Gate 2 check below (performed directly rather than via a full Freya subagent pass, mirroring Story 0.14's precedent for unambiguous zero-UI stories).
- **No Unified Query DSL (AD-1/AD-2) involvement** — this story never retrieves an event collection.
- **No PostHog/analytics events (AD-5)** — this story introduces no user-facing interaction to instrument; any "email sent"/"email opened" tracking (if ever wanted) belongs to whichever consumer story triggers the send.
- **No i18n strings (AD-6)** — the architecture spine explicitly scopes AD-6 to "all user-facing text... across **the frontend application**"; this story's templates render and send exclusively from `apps/backend` (Lambda), never through `next-intl`/the Next.js frontend. Mirrors Story 0.12's identical Dev Notes conclusion for `notification.title`/`body`. Template copy is English-only for MVP as a result — flagged as an accepted scope boundary, not a gap, in the Pre-Coding Approval Gate.
- **No state-management categorization applies** — this is backend-only infra; nothing is stored in Server State/URL State/Client Global State.
- **No async loader (blocking/non-blocking) categorization applies** — no UI renders a loading state for this story's resources.
- **No new database entity or migration is introduced** — see Data Type Compatibility section below.
- **Latest Tech Information:** `@aws-sdk/client-sesv2` latest stable is `3.1100.0` (npm, checked 2026-07-31), providing `SESv2Client`/`SendEmailCommand` with `Content.Simple` (raw rendered Subject/Body, used here) as an alternative to SES-side stored `Content.Template` (server-side Handlebars rendering via `CreateEmailTemplate` — deliberately not used here, since it would require an extra IaC/bootstrap step to keep SES-stored templates in sync with this repo's source-controlled copy, adding drift risk for only three static templates). AWS SES pricing (checked 2026-07-31): $0.10 per 1,000 emails sent (~$0.0001/email), well within negligible cost for this project's expected volume; new AWS accounts (created after 2025-07-15) receive $200 in free-tier credits applicable to SES rather than a dedicated per-month SES free tier. All SES accounts start in a sending "sandbox" restricted to verified recipients only, requiring a one-time AWS Support production-access request (Task 9).

### Architecture & UX Gate Findings

- **Gate 1 (Architecture/Infrastructure Completeness) & Gate 3 (Foundational/Cross-Cutting Dependency Completeness):** This story's entire existence *is* a Gate 1/3 finding from `_bmad-output/planning-artifacts/epic-readiness/epic-0-readiness.md` (`swept: true`) — the report's Gate 1/Gate 3 sections explicitly identify "No outbound email infrastructure" as a gap needed by Story 3.10 (Epic 3) and Story 4.5 (Epic 4), two independent epics, and lists `0.15` under "New Prerequisite Stories Added." No further Gate 1/3 subagent pass is re-run here per `story-split-gate.md`'s Epic-Level Sweep Mode — the report's own reasoning is cited directly instead of re-derived.
  - **Lightweight escape-hatch guard:** Re-checked this story's specific scope against the sweep for anything the epic-wide sweep (which reasons over `epics.md`'s *planned* ACs, not implementation detail) would not have anticipated at this granularity. One genuine wrinkle surfaced during drafting, handled within this story's own scope rather than as a new Gate 1/3 gap: the SES IaC resource has no existing owner in Story 0.14's AC (unlike the KMS key, which 0.14's own AC5 already scopes) — resolved directly above ("SES IaC dependency is a hard sequencing gap") and in Task 5, not a missing foundational *story*, since this story itself is that foundational story.
- **Gate 2 (UI Complexity & Reusability):** This story has **zero UI surface** — pure backend adapter code, IaC, and pure template-string logic; no React component, page, hook, or util. A grep of both authoritative UX artifact sets (`design-artifacts/UX-festgrid-run-1/{DESIGN,EXPERIENCE}.md`, `design-artifacts/UX-wizard-page-run-1/{DESIGN,EXPERIENCE}.md`) plus the full `design-artifacts/C-UX-Scenarios/` tree for "email"/"SES"/"template" surfaced only `04.7-email-notification-quota.md` (an *email-platform* scenario page describing the message a user receives, not an in-app UI) and unrelated matches (a generic API-key-deletion "Undo" button, moderator report filters) — no artifact describes any adapter-management, template-editing, or email-configuration UI for this story's scope. Given this unambiguous zero-UI scope (matching Story 0.14's precedent), this check was performed directly rather than via a full `wds-agent-freya-ux` subagent invocation. **Verdict: No gap found.**

### Data Type Compatibility & Migration Requirements

- Compatibility finding: **No changes required.** This story introduces no `packages/database` schema change, no migration, no `@festgrid/shared-types` change, and no GraphQL contract change. `packages/database/schema.ts` is untouched — `EmailTemplateKey`/`EmailTemplateVariables`/`RenderedEmail` are local, backend-only types in `packages/domain`, not persisted anywhere.
- Impacted fields/contracts: None.
- Required DB migration changes: None.
- Required TypeScript type changes: None (the three new `packages/domain/src/email/*.ts` types are new, additive, and package-local — not a modification to any existing shared type).
- Backward compatibility and rollout notes: N/A — greenfield addition, no existing consumer of email sending exists yet anywhere in the codebase.
- Verification checks: `packages/domain`'s 100%-covered unit tests proving `renderEmailTemplate` correctness (Task 3); `apps/backend`'s mocked-dependency `adapter.test.ts` proving the SES orchestration call shape (Task 4); `apps/infrastructure`'s CDK assertion tests proving the SES identity + scoped IAM grant (Task 6).

### Project Structure Notes

- New `packages/domain/src/email/{types,templates,render-template}.ts` + `render-template.test.ts`, following Story 0.13's established `src/<domain-area>/` sub-folder convention (mirrors `src/ai-gateway/`).
- New `apps/backend/src/lib/email/{ses-client,adapter}.ts` + `adapter.test.ts`, following the app's `src/lib/`-for-utilities convention (mirrors Story 0.12's `src/lib/firebase-admin.ts` and Story 0.13's `src/lib/ai-gateway/`).
- New (recommended path, extending Story 0.14) or New standalone (fallback path): SES `EmailIdentity` construct + IAM grant inside `apps/infrastructure/lib/festgrid-backend-stack.ts`, or a new `apps/infrastructure/lib/email-identity-stack.ts` if Story 0.14 hasn't landed yet.
- New `docs/infrastructure/5-outbound-email.md`; modified `docs/infrastructure/index.md` (TOC entry), `docs/infrastructure/high-level-overview.md` (mermaid diagram SES node/edge).
- Modified: root `.env.example` (`SES_FROM_EMAIL_ADDRESS` entry), `SETUP_WALKTHROUGH.md` (new numbered section — number determined at implementation time, see Task 9).
- Not modified: `packages/database`, `packages/graphql-select`, `packages/ui`, `@festgrid/shared-types`, `turbo.json`, `.github/workflows/ci.yml` (no new required CI secrets — mocked tests only).
- Detected conflicts or variances: `packages/domain`, `apps/backend`, and `apps/infrastructure` may or may not exist yet depending on execution order relative to Stories 0.8/0.12/0.13/0.14 — see Dev Notes sequencing callouts and Tasks 1/2/5's explicit, idempotent handling. `SETUP_WALKTHROUGH.md`'s next section number is likewise execution-order-dependent (Task 9).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 0.15] — story AC source and the epics.md `Note:`/`Depends on:` this story's Dev Notes address directly.
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-0-readiness.md] — Gate 1/3 sweep, `swept: true`, this story's own origin as one of its two new prerequisite-story findings.
- [Source: _bmad-output/planning-artifacts/story-split-gate.md] — gate definitions, execution protocol, numbering rule, epic-level sweep mode.
- [Source: _bmad-output/project-context.md#Technology-Stack, #Security, #General-Architecture, #Code-Quality-Style-Rules, #Testing-Rules] — Adapter Pattern mandate (by extension of the AI Gateway precedent), Credential Management rule, `packages/domain` restrictions and 100%-coverage rule, package-isolation rules.
- [Source: _bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md §3.4, FR22, FR35, FR37] — quota-exhaustion notification defaults (`X=3` posts, `Y=3` days), invalid-API-key-attempt threshold default (`N=5`), and the "cease push notifications for that key's shared subscriptions" behavior referenced in `INVALID_API_KEY_ALERT` copy.
- [Source: design-artifacts/C-UX-Scenarios/04-alex-extracts-events/04.7-email-notification-quota.md] — authoritative subject-line and body copy for `QUOTA_EXHAUSTION_WARNING`.
- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.5] — AC source for `DANGEROUS_EVENT_MODERATOR_ALERT`'s trigger and content.
- [Source: docs/infrastructure/high-level-overview.md, docs/infrastructure/4-push-notifications.md, docs/infrastructure/2-backend.md] — architecture diagram this story adds an SES node/edge to, and the per-service infra-shard convention this story's new `5-outbound-email.md` follows.
- [Source: _bmad-output/implementation-artifacts/0-12-set-up-firebase-cloud-messaging-foundation.md] — lazy-SDK-client-init pattern, `apps/backend` sequencing-conflict handling, and the AD-6-does-not-bind-backend-text precedent this story's Dev Notes cite directly.
- [Source: _bmad-output/implementation-artifacts/0-13-set-up-ai-gateway-adapter-layer-for-gemini.md] — `packages/domain`/`apps/backend` pure-logic-vs-SDK-coupled-code split precedent, `packages/domain` first-scaffold handling, hand-rolled-logic-over-new-dependency precedent (`backoff.ts`).
- [Source: _bmad-output/implementation-artifacts/0-14-set-up-aws-iac-for-lambda-sqs-eventbridge-and-kms.md] — the CDK stack (`FestgridBackendStack`) this story extends/forward-depends on, and its KMS least-privilege-grant-scope precedent mirrored here for the SES IAM grant.
- [Source: git ls-files packages/domain, apps/backend, apps/infrastructure] — confirmed all three empty (no committed workspace files) as of this story's creation.
- [Web research, 2026-07-31: npm] `@aws-sdk/client-sesv2` latest `3.1100.0`.
- [Web research, 2026-07-31] AWS SES pricing ($0.10/1,000 emails), sandbox-mode/production-access requirement, and stored-`Content.Template` vs. `Content.Simple` tradeoff informing this story's SES design choices.

## Global Rules References

- [ ] `_bmad-output/project-context.md` — Technology Stack, Security (Credential Management), Code Quality (`packages/domain` restrictions, 100% coverage), package-dependency-isolation rules.
- [ ] `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order/status vocabulary followed in this file.
- [ ] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — no dedicated AD exists for the outbound-email adapter or the Adapter Pattern generally (confirmed via grep); governed by `project-context.md`'s general Adapter Pattern rule and this story's own epics.md AC. AD-6 (i18n) explicitly scoped to "the frontend application" — confirmed not to bind this backend-only story.
- [ ] `docs/infrastructure/index.md`, `docs/infrastructure/high-level-overview.md`, `docs/infrastructure/4-push-notifications.md`, new `docs/infrastructure/5-outbound-email.md` — the architecture diagram this story updates and the per-service shard convention it follows.

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - New (or Modified, depending on Story 0.13's status) in `packages/domain`: `src/email/{types,templates,render-template}.ts` + `render-template.test.ts`.
  - New (or Modified, depending on Stories 0.8/0.12/0.13/0.14's status) in `apps/backend`: `src/lib/email/{ses-client,adapter}.ts`, `adapter.test.ts`, `package.json` (adds `@aws-sdk/client-sesv2`), `src/env.ts` (adds `SES_FROM_EMAIL_ADDRESS`).
  - New (recommended, extending Story 0.14) or New standalone (fallback) in `apps/infrastructure`: SES `EmailIdentity` + IAM grant in `lib/festgrid-backend-stack.ts`, or a new `lib/email-identity-stack.ts`; corresponding CDK assertion test additions.
  - New: `docs/infrastructure/5-outbound-email.md`. Modified: `docs/infrastructure/index.md`, `docs/infrastructure/high-level-overview.md`.
  - Modified: root `.env.example` (one new entry), `SETUP_WALKTHROUGH.md` (new numbered section).
  - Not modified: `packages/database`, `packages/graphql-select`, `packages/ui`, `@festgrid/shared-types`, `turbo.json`, `.github/workflows/ci.yml`.
- **Rule Mapping:**
  - Adapter Pattern, single exposed interface, never a raw SDK call from feature code → `project-context.md`/epics.md AC1 → `apps/backend/src/lib/email/adapter.ts`'s `sendTemplatedEmail` (AC1).
  - Pure logic → `packages/domain`, SDK/IO-coupled code → `apps/backend` → persistent "reusable mechanism → `packages/domain`" fact → `render-template.ts` vs. `ses-client.ts`/`adapter.ts` split (AC3).
  - Templated messages, template-key-and-variables-only interface → epics.md AC3 → `EmailTemplateKey`/`EmailTemplateVariables`/`renderEmailTemplate` (AC3).
  - Credential management (no hardcoded secrets) → `project-context.md` "Credential Management" rule → `SES_FROM_EMAIL_ADDRESS` sourced from `.env`, never hardcoded (Task 8).
  - IaC-provisioned sending resource + least-privilege IAM → epics.md AC2, mirroring Story 0.14's KMS-grant-scope precedent → Task 5's `ses.EmailIdentity` + scoped `L_API`-only grant.
  - Package isolation (`@aws-sdk/client-sesv2` confined to `apps/backend` only) → persistent package-dependency-isolation fact → Task 4.
  - Cloud/external-service setup → persistent fact → `SETUP_WALKTHROUGH.md` new section (Task 9).
  - Architecture-diagram/infra-doc gap closure → epic-0-readiness.md Gate 1 finding #1 → Task 7's new `5-outbound-email.md` shard + diagram update (AC6).
  - i18n/analytics/state-management/loader/reusable-UI-component categorization — all evaluated and found not applicable → Dev Notes.
- **Verification Plan:**
  - `packages/domain`'s `render-template.ts`: 100% `node:test` coverage (Task 3/Task 10), covering all three templates' substitution and missing-variable throw paths.
  - `apps/backend/adapter.test.ts`: mocked-SES orchestration proving correct `SendEmailCommand` shape per template key and error propagation (Task 4/Task 10).
  - `apps/infrastructure`'s CDK assertion tests: exactly 1 `AWS::SES::EmailIdentity`, IAM grant scoped to `L_API` only (Task 6/Task 10).
  - `cdk synth` succeeds for whichever Task 5 branch applies (Task 10).
  - `pnpm build`/`pnpm lint` clean at the repo root for `packages/domain`, `apps/backend`, `apps/infrastructure`.
  - Explicitly recorded as deferred (not a failure): a real SES send against a live, DNS-verified, production-access-granted domain — no such domain/credentials available in this development environment; verified for real once a consumer story (3.10/4.5/FR35's owner) runs against a fully set-up AWS account (Task 10).

## Pre-Coding Approval Gate

- [ ] Scope confirmation: build the outbound email adapter (`packages/domain`'s pure template-rendering logic + `apps/backend`'s SES-SDK orchestration + IaC-provisioned SES identity/IAM grant) as a reserved, ready-to-consume capability; no UI, no real caller yet (Stories 3.10/4.5/FR35's owner are future consumers).
- [ ] Architecture and boundary confirmation: pure logic confined to `packages/domain` (no SDK deps), SES-SDK/env code confined to `apps/backend`; `@aws-sdk/client-sesv2` isolated to `apps/backend` only; IAM `ses:SendEmail`/`ses:SendRawEmail` granted to `L_API`'s execution role only.
- [ ] Testing plan confirmation: `packages/domain` gets 100%-covered `node:test` unit tests (non-negotiable per project Testing Rules); `apps/backend`'s adapter gets mocked-dependency tests; `apps/infrastructure` gets CDK assertion tests; no live AWS/SES calls in automated tests; a full real-send round trip is explicitly deferred (see Dev Notes).
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted: Gate 1/3 sourced from swept `epic-0-readiness.md` (this story *is* one of its findings, no further gap); Gate 2 confirmed no-gap directly (zero UI surface, grep-verified against both UX artifact sets plus the full UX-scenario tree).
- [ ] **`packages/domain`/`apps/backend` sequencing conflicts accepted:** mirrors Stories 0.12/0.13's items exactly — confirm either (a) Stories 0.8/0.12/0.13/0.14 implement first, or (b) accept this story creating the minimal scaffolds itself where needed (Tasks 1/2).
- [ ] **SES IaC sequencing accepted (hard dependency, not a soft one):** confirm the recommended path — implement Story 0.14 first, then extend `FestgridBackendStack` with the SES identity/grant — OR explicitly accept the fallback standalone-stack approach (Task 5) knowing it requires a later reconciliation step once Story 0.14 lands.
- [ ] **AWS SES as the transactional email provider accepted:** confirm SES over any other provider (SendGrid, Postmark, Resend, etc.) — epics.md's own story description names SES with "e.g.", leaving room for a different choice; this story proceeds with SES for AWS-only-stack consistency (Dev Notes "Latest Tech Information") unless a different intended provider is provided instead.
- [ ] **`Content.Simple` (locally-rendered markup sent per-call) over SES-stored `Content.Template` accepted:** confirm this design choice (Dev Notes "Latest Tech Information") — or provide the intended real approach instead.
- [ ] **`INVALID_API_KEY_ALERT`/`DANGEROUS_EVENT_MODERATOR_ALERT` MVP copy accepted:** confirm this story's own authored subject/body text for these two templates (no dedicated UX-scenario page exists for either, unlike `QUOTA_EXHAUSTION_WARNING`) — or provide the intended real copy instead (Dev Notes "Template copy content").
- [ ] **English-only template copy (no i18n) accepted:** confirm AD-6 not applying to this backend-only story (Dev Notes), consistent with Story 0.12's identical precedent — or flag if backend email localization should be added as a future story.

## Testing Requirements

- [ ] Unit tests (required, not deferred): `packages/domain/src/email/render-template.test.ts` via `node:test`/`tsx --test`, 100% coverage (project Testing Rules — non-negotiable for `packages/domain`).
- [ ] Integration-style tests (required, mocked dependencies): `apps/backend/src/lib/email/adapter.test.ts`, proving correct `SendEmailCommand` shape and error propagation without real network calls.
- [ ] Infrastructure assertion tests (required): CDK `aws-cdk-lib/assertions` tests proving the SES identity resource and its scoped IAM grant (Task 6).
- [ ] Synth verification (required): `cdk synth` succeeds for whichever Task 5 branch applies.
- [ ] E2E tests: Not applicable — no UI in this story.
- [ ] Manual verification (deferred, tracked): a real SES send against a live, DNS-verified, production-access-granted domain, verified once a consumer story (3.10/4.5/FR35's owner) runs end-to-end against a fully set-up AWS account.

## Deliverables Checklist

- [ ] `packages/domain/src/email/{types,templates,render-template}.ts` scaffolded, 100%-covered by unit tests.
- [ ] `apps/backend/src/lib/email/{ses-client,adapter}.ts` implementing the sole `sendTemplatedEmail` adapter interface, with passing mocked-dependency tests.
- [ ] SES `EmailIdentity` + scoped `L_API`-only IAM grant provisioned via CDK (either extending `FestgridBackendStack` or as a standalone `FestgridEmailStack`), with passing assertion tests.
- [ ] `docs/infrastructure/5-outbound-email.md` added; `index.md` and `high-level-overview.md` updated to reflect the new SES resource.
- [ ] `SES_FROM_EMAIL_ADDRESS` documented in `.env.example`.
- [ ] `SETUP_WALKTHROUGH.md` updated with the new outbound-email setup section.
- [ ] `pnpm build`/`pnpm lint` pass at the repo root.

## Out of Scope

- Any actual caller of `sendTemplatedEmail` — Story 3.10 ("Email notifications for queued posts", `backlog`), Story 4.5 ("Handle 'Dangerous Event' reports", `backlog`), and whichever story ultimately implements FR35's invalid-API-key-attempt email trigger (not yet a dedicated story — tracked as a watch item, not a Gate 3 gap, per Dev Notes).
- Reconciling a standalone `FestgridEmailStack` into `FestgridBackendStack` if this story's fallback IaC path (Task 5) is exercised — deferred to whichever of Story 0.14/this story's own follow-up lands second.
- SES-stored `Content.Template`/`CreateEmailTemplate` server-side templating — this story uses locally-rendered `Content.Simple` instead (Dev Notes "Latest Tech Information").
- Localizing email copy into `id` (or any non-English locale) — AD-6 is scoped to the frontend only; this story ships English-only copy (Dev Notes).
- A real SES send against a live, DNS-verified, production-access-granted domain as part of this story's own automated verification — no AWS credentials/domain available in this development environment; deferred to whichever consumer story runs first against a fully set-up AWS account.
- Any bounce/complaint-handling, suppression-list management, or delivery-tracking (opens/clicks) infrastructure — not required by any current AC; would be a future story if a consumer story surfaces a hard need.

## Definition of Done

- [ ] AC 1-6 satisfied.
- [ ] `packages/domain` unit tests passing with 100% coverage (Task 3/Testing Requirements — non-negotiable).
- [ ] `apps/backend` mocked-dependency orchestration tests passing (Task 4/Testing Requirements).
- [ ] `apps/infrastructure` CDK assertion tests passing, `cdk synth` succeeding (Task 5/6/Testing Requirements).
- [ ] `pnpm lint` and `pnpm build` passing for `packages/domain`, `apps/backend`, `apps/infrastructure`.
- [ ] `docs/infrastructure/5-outbound-email.md` added and `index.md`/`high-level-overview.md` updated (Task 7).
- [ ] `SETUP_WALKTHROUGH.md` updated (Task 9).
- [ ] Pre-Coding Approval Gate explicitly approved by the user before implementation begins, including the sequencing items, the SES-provider/`Content.Simple` design choices, the two authored template-copy items, and the no-i18n acceptance.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
