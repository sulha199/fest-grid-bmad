# Story 3.1: Onboarding wizard for API key and subscriptions

## Story Details

- Epic: 3
- Story ID: 3.1
- Story Key: 3-1-onboarding-wizard-for-api-key-and-subscriptions
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a new user,
I want to be guided through a wizard to add my Gemini API key and subscribe to my first social media account,
so that I can get started with the application easily.

## Acceptance Criteria

1. **Given** I am logged in and click the "Subscribed Accounts" entry in the User Menu (Story 2.8) without having any active API key, **when** the click is handled, **then** I am navigated to `/wizard/onboarding/api-key?redirect=%2Fsettings%2Fsubscriptions` instead of following the entry's plain `/settings/subscriptions` href — the entry's href is resolved through a new `resolveHref` hook point rather than a hardcoded conditional inside the menu itself. [epics.md AC, this story's concrete trigger — see Dev Notes → Architecture & UX Gate Findings for why `/settings/subscriptions` is used as the trigger despite Story 3.2 not existing yet]
2. **And** if I already have at least one active API key, clicking "Subscribed Accounts" follows the entry's plain href unchanged (no wizard redirect) — the gate checks key possession only, per the epics.md AC's literal "requires an API key" condition; it does not check subscription count. [epics.md AC, Derived]
3. **And** the wizard is built on Story 0.24's generic `/wizard/[wizardKey]/[stepSlug]` primitive: this story adds one `onboarding` entry to Story 0.24's wizard registry, with two steps in order — `api-key` and `subscribe` — and `defaultExitPath: '/'`. [epics.md AC — Amendment]
4. **And** the first step (`api-key`) renders a minimal form (a masked-style password input for the raw key, a "How to get a Gemini API key?" help link — same static/placeholder-link convention as Story 3.1b's) and, on submit, calls the **same** `createApiKey` mutation Story 3.1b builds and owns — this step does not reimplement key creation. The step's `isStepCompleted` (via `useWizardStep()`) is derived from Story 3.1b's `myApiKeys` query: `true` immediately on mount if the user already has ≥1 active key (so re-entering the wizard, or a user who added a key on `/settings/api-keys` directly, doesn't have to submit again), or set `true` only after a successful `createApiKey` call otherwise. [epics.md AC, Amendment]
5. **And** the second step (`subscribe`) renders a simple manual-entry form: a platform selector (a small hardcoded MVP list — `Instagram`, `Twitter/X` — from `packages/domain`'s `SUPPORTED_PLATFORMS`, not blocked on Story 3.3c's future platform-slug registry) and a text input for the account URL or handle. Submitting parses the input into a bare handle (via `packages/domain`'s `parseSocialMediaAccountHandle`) and calls this story's own `subscribeToAccount(input: SubscribeToAccountInput!): SubscribeToAccountResult!` mutation, using the parsed handle as both `accountId` and `username` and as the initial `displayName` — persisted via Story 3.1a's `subscribeToAccount()` lib function, not a direct database write from `apps/web`. `isStepCompleted` becomes `true` on a successful call. [epics.md AC, Amendment]
6. **And** no live scrape-based validation (account-exists check, empty-posts warning) is performed at submit time — accepted, documented gap; see Out of Scope and Story 3.4's Forward note. [Amendment, user decision]
7. **And** after the `subscribe` step's `Complete` button is clicked, I am redirected to the `redirect` search param captured in AC1 (`/settings/subscriptions` in this story's only wired trigger — a route that does not exist until Story 3.2 ships, so this is a reserved-slot consequence, not a defect of this story). [epics.md AC]
8. **And** all user-facing strings for both step forms (labels, placeholders, help link text, success/error toasts) are sourced through next-intl from a new `Wizards.onboarding.*` i18n namespace (step titles/descriptions live under the `Wizards.onboarding.steps.<slug>` shape Story 0.24's registry expects), with entries added to both `apps/web/locales/en.json` and `apps/web/locales/id.json` — no hardcoded English strings in JSX. [project-context.md i18n rule, persistent fact]
9. **And** the `createApiKey` submit uses `BlockingLoader` (critical/security-sensitive persisted mutation, matches Story 3.1b's own submit) and the `subscribeToAccount` submit likewise uses `BlockingLoader` (a critical persisted mutation creating a subscription), per `project-context.md`'s Loaders rule. [persistent fact]
10. **And** `wizard_api_key_step_completed` (no payload) and `wizard_subscribe_step_completed` (`{ platform }`) PostHog analytics events fire on each step's successful completion; `onboarding_wizard_completed` fires when `Complete` is clicked on the final step. [persistent fact — AD-5]

## Tasks / Subtasks

- [ ] **Task 1: Backend — reusable subscribe-flow domain helpers** (AC: 5)
  - [ ] Create `packages/domain/src/subscriptions/platforms.ts`: `export const SUPPORTED_PLATFORMS = ['instagram', 'twitter'] as const;` and `export type SupportedPlatform = (typeof SUPPORTED_PLATFORMS)[number];` — a pure, dependency-free constant, safe for both `apps/web` (populating the platform selector) and `apps/backend` (server-side validation) to import, per `project-context.md`'s `packages/domain` DB/Node-coupling restriction (this file has none).
  - [ ] Create `packages/domain/src/subscriptions/parse-account-handle.ts`: `export function parseSocialMediaAccountHandle(raw: string): string` — trims whitespace; if the input starts with `http`, takes the last non-empty path segment of the URL; strips a leading `@`; returns the resulting bare handle. Pure function, no framework/DB dependency.
  - [ ] Create `packages/domain/src/subscriptions/platforms.test.ts` and `parse-account-handle.test.ts` (Vitest) covering: platform list is non-empty and lowercase; handle parsing for a bare handle, an `@handle`, an `https://instagram.com/handle` URL, an `https://twitter.com/handle/` URL with a trailing slash, and leading/trailing whitespace. `packages/domain`'s 100%-coverage rule applies to both new files.
  - [ ] Export both new modules from `packages/domain/src/subscriptions/index.ts` (create if absent) and confirm `packages/domain`'s package-level export surface (`package.json`/root index, matching the existing `@festgrid/domain/query`, `@festgrid/domain/events` sub-path export precedent) exposes a `@festgrid/domain/subscriptions` sub-path.
- [ ] **Task 2: Backend — `subscribeToAccount` GraphQL schema and resolver** (AC: 5)
  - [ ] Create `apps/backend/src/schema/subscriptions.graphql` (mirrors `api-keys.graphql`'s per-resource file pattern):
    ```graphql
    type Subscription {
      id: ID!
      accountId: ID!
      isNewlyAdded: Boolean!
      createdAt: String!
    }

    input SubscribeToAccountInput {
      platform: String!
      accountId: String!
      username: String!
      displayName: String!
    }

    type SubscribeToAccountResult {
      subscription: Subscription!
      alreadySubscribed: Boolean!
    }

    extend type Mutation {
      subscribeToAccount(input: SubscribeToAccountInput!): SubscribeToAccountResult!
    }
    ```
    Note: the GraphQL type is named `Subscription`, matching `packages/shared-types`' interface of the same name (Story 3.1a, Task 6) — do not redeclare `SocialMediaAccountProfile` here (it already exists in `social-media-accounts.graphql`, Story 3.1a).
    **Cross-amended 2026-08-07 (`bmad-create-story`, while drafting Story 3.2 — which also returns this same `Subscription` type from its `mySubscriptions`/`removeSubscription` fields):** `apps/backend/src/schema/typeDefs.graphql` (Story 0.8's scaffold) currently has no explicit `schema { }` definition — per the GraphQL spec, `graphql-js`/`graphql-yoga` fall back to treating any type literally named `Subscription` as the schema's **root Subscription (real-time) operation type** whenever no explicit `schema` block exists. Before landing this task, add `schema { query: Query mutation: Mutation }` to the top of `typeDefs.graphql` (skip if Story 3.2 already added it) so this `Subscription` object type stays a plain type, not an accidental (and resolver-less) root subscription type.
  - [ ] In `apps/backend/src/schema/resolvers.ts`: import `SUPPORTED_PLATFORMS` from `@festgrid/domain/subscriptions` and `subscribeToAccount` (the lib function, aliased on import, e.g. `subscribeToAccountFn`) from `../lib/subscriptions/subscribe-to-account.js` (Story 3.1a's Task 7 deliverable); add a `formatSubscription(row)` helper (mirrors `formatApiKey`) returning `{ id: row.id, accountId: row.accountId, isNewlyAdded: row.isNewlyAdded, createdAt: row.createdAt.toISOString() }`.
  - [ ] Add `subscribeToAccount` to the `Mutation` resolver map: `requireAuth(context)`; validate `SUPPORTED_PLATFORMS.includes(input.platform.toLowerCase())`, else `GraphQLError('Unsupported platform', { extensions: { code: 'BAD_REQUEST' } })`; call `subscribeToAccountFn({ userId: authUser.userId, platform: input.platform.toLowerCase(), accountId: input.accountId, profile: { username: input.username, displayName: input.displayName } })`; return `{ subscription: formatSubscription(result.subscription), alreadySubscribed: result.alreadySubscribed }`.
  - [ ] Create `apps/backend/src/schema/subscriptions.test.ts` (mirrors `api-keys.test.ts`'s structure): `subscribeToAccount` rejects an unsupported platform with `BAD_REQUEST`; creates a new profile+subscription for a brand-new account (`alreadySubscribed: false`); reuses an existing profile and creates a new subscription for an already-profiled account the caller hasn't subscribed to; returns `alreadySubscribed: true` without a duplicate row when the caller is already actively subscribed; requires authentication (`requireAuth` throws for an unauthenticated context).
  - [ ] Run the backend's GraphQL Code Generator (`pnpm --filter backend run codegen`) to regenerate `apps/backend/src/generated/resolvers-types.ts`.
  - [ ] **Sequencing check (Pre-Coding Approval Gate item):** confirm Story 3.1a (`apps/backend/src/lib/subscriptions/subscribe-to-account.ts`, the `socialMediaAccountProfiles`/reshaped `subscriptions` schema) and Story 3.1b (`createApiKey`, `myApiKeys`) are implemented before starting this task — this story's resolver directly imports both.
- [ ] **Task 3: Frontend — GraphQL operations and codegen** (AC: 4, 5)
  - [ ] Create `apps/web/src/features/onboarding/mutations.graphql`: `subscribeToAccount(input: SubscribeToAccountInput!) { subscription { id accountId isNewlyAdded createdAt } alreadySubscribed }` — reuse Story 3.1b's already-generated `createApiKey`/`useCreateApiKeyMutation` and `myApiKeys`/`useGetMyApiKeysQuery` operations/hooks directly; do not redeclare them here.
  - [ ] Run the GraphQL Code Generator (`pnpm --filter web run codegen`) to regenerate `apps/web/src/generated/graphql.ts` (new `useSubscribeToAccountMutation` hook).
- [ ] **Task 4: Frontend — Story 0.24 wizard registry entry** (AC: 3, 4, 5, 8)
  - [ ] In Story 0.24's wizard registry (`apps/web/src/features/wizard/wizard-registry.ts`), add:
    ```ts
    onboarding: {
      key: 'onboarding',
      defaultExitPath: '/',
      steps: [
        { slug: 'api-key', canSkipStep: false, Component: OnboardingApiKeyStep },
        { slug: 'subscribe', canSkipStep: false, Component: OnboardingSubscribeStep },
      ],
    },
    ```
    importing `OnboardingApiKeyStep`/`OnboardingSubscribeStep` from `apps/web/src/features/onboarding/`.
  - [ ] Add `Metadata.wizardOnboardingApiKeyTitle`/`...Description` and `Metadata.wizardOnboardingSubscribeTitle`/`...Description` keys (one pair per step slug, per Story 0.24's per-step `generateMetadata` contract) to `en.json`/`id.json`.
- [ ] **Task 5: Frontend — `OnboardingApiKeyStep` component** (AC: 4, 6, 8, 9, 10)
  - [ ] Create `apps/web/src/features/onboarding/onboarding-api-key-step.tsx` (`"use client"`): calls `useGetMyApiKeysQuery` (Story 3.1b); a `useEffect` calls `setStepCompleted(true)` (from `useWizardStep()`, Story 0.24) when the query resolves with ≥1 active key. Renders a form (password-style input for the raw key value, a static "How to get a Gemini API key?" help link matching Story 3.1b's convention) wrapped in `BlockingLoader` on submit, calling `useCreateApiKeyMutation` with `provider: 'gemini'`; on success, fires `wizard_api_key_step_completed`, calls `setStepCompleted(true)`, and shows a success toast; on error, shows an error toast and leaves `isStepCompleted` unchanged. If the key-count query already shows ≥1 key, the form still renders but is optional — a short "You already have an API key" note is shown instead of blocking the step on a fresh submission.
  - [ ] Create `onboarding-api-key-step.test.tsx` (Vitest + Testing Library + `msw`): renders the form; submit happy path calls `createApiKey` and marks the step complete; submit failure path shows an error toast and does not mark the step complete; pre-existing-key path marks the step complete on mount without requiring a submission.
- [ ] **Task 6: Frontend — `OnboardingSubscribeStep` component** (AC: 5, 6, 8, 9, 10)
  - [ ] Create `apps/web/src/features/onboarding/onboarding-subscribe-step.tsx` (`"use client"`): a form with a `Select` (Story 3.1b's Task 4 shadcn `select.tsx` primitive) populated from `SUPPORTED_PLATFORMS` (`@festgrid/domain/subscriptions`) and a text input for the account URL/handle. On submit: parse the input via `parseSocialMediaAccountHandle`, call `useSubscribeToAccountMutation` with `{ platform, accountId: handle, username: handle, displayName: handle }`, wrapped in `BlockingLoader`; on success, fire `wizard_subscribe_step_completed` (`{ platform }`), call `setStepCompleted(true)` (`useWizardStep()`), show a success toast (a distinct, softer toast/message when `alreadySubscribed: true` — "You're already subscribed to this account" — still marks the step complete since the end-state, an active subscription, is satisfied either way); on error, show an error toast and leave the step incomplete.
  - [ ] Create `onboarding-subscribe-step.test.tsx` (Vitest + Testing Library + `msw`): submit happy path (new account) marks the step complete; submit happy path (`alreadySubscribed: true`) also marks the step complete with the softer message; submit failure path shows an error toast and does not mark the step complete; URL-form input is correctly parsed to a bare handle before the mutation call (covers at least one `https://...` case).
- [ ] **Task 7: Frontend — wire the "Subscribed Accounts" gate onto the User Menu** (AC: 1, 2)
  - [ ] In `packages/ui/src/core/app-shell/profile-menu-entries.ts`: add `requiresApiKey?: boolean;` to the `ProfileMenuEntry` interface, and set `requiresApiKey: true` on the `subscriptions` entry (id `'subscriptions'`) only.
  - [ ] In `packages/ui/src/core/app-shell/UserMenu.tsx`: add an optional `resolveHref?: (entry: ProfileMenuEntry) => string` prop to `UserMenuProps`; in the entries `.map(...)`, use `resolveHref ? resolveHref(entry) : (entry.href || '#')` as the `Link`'s `href` instead of the current `entry.href || '#'` (default to identity behavior when the prop is omitted — backward compatible with every other call site/test).
  - [ ] In `packages/ui/src/core/app-shell/AppShell.tsx`: add `resolveHref?: (entry: import('./profile-menu-entries').ProfileMenuEntry) => string;` to `AppShellProps` and thread it through to both `<UserMenu ... resolveHref={resolveHref} />` instantiations (mobile and desktop).
  - [ ] In `apps/web/src/components/layout/AppShellWrapper.tsx`: add a `useHasApiKey()` call (Task 8) and pass `resolveHref={(entry) => (entry.requiresApiKey && !hasApiKey ? `/wizard/onboarding/api-key?redirect=${encodeURIComponent(entry.href || '/')}` : entry.href || '/')}` to `<AppShell>`.
  - [ ] Update `packages/ui/src/core/app-shell/UserMenu.test.tsx` and any `AppShell.test.tsx`/`AppShellWrapper.test.tsx` coverage: a `requiresApiKey` entry without `resolveHref` still uses its plain `href` (backward compatibility); with `resolveHref` supplied, the entry's rendered `href` reflects the resolver's output.
- [ ] **Task 8: Frontend — `useHasApiKey()` reusable gate hook** (AC: 1, 2)
  - [ ] Create `apps/web/src/features/onboarding/use-has-api-key.ts`: `export function useHasApiKey(): boolean` — wraps `useGetMyApiKeysQuery` (Story 3.1b, `enabled: !!session` via `useAuthSession()`) and returns `(data?.myApiKeys.length ?? 0) > 0`. Documented as intentionally reusable beyond this story (e.g. by the future "Extract event from post(s)" menu item, PRD §3.10) — kept as a small hook per Gate 2's finding, not a dedicated story.
  - [ ] Create `use-has-api-key.test.ts`: returns `false` while loading/unauthenticated, `false` with zero keys, `true` with ≥1 key.
- [ ] **Task 9: i18n — `Wizards.onboarding` namespace and `Metadata` keys** (AC: 8)
  - [ ] Add to `apps/web/locales/en.json`'s `Metadata` object the four keys from Task 4.
  - [ ] Add a `Wizards` object (create if `Story 0.24` hasn't already; this story adds the `onboarding` key within it) to `apps/web/locales/en.json`:
    ```json
    "Wizards": {
      "onboarding": {
        "steps": {
          "api-key": { "title": "Add API Key", "description": "Add your Gemini API key to get started." },
          "subscribe": { "title": "Subscribe", "description": "Subscribe to your first social media account." }
        }
      }
    }
    ```
  - [ ] Add an `OnboardingWizard` object with (at minimum): `apiKeyLabel`, `apiKeyPlaceholder`, `howToGetKeyLinkLabel`, `apiKeySubmitLabel`, `apiKeyAlreadyHaveOne`, `apiKeySuccessToast`, `apiKeyErrorToast`, `platformLabel`, `accountLabel`, `accountPlaceholder`, `subscribeSubmitLabel`, `subscribeSuccessToast`, `alreadySubscribedToast`, `subscribeErrorToast`.
  - [ ] Mirror every new key into `apps/web/locales/id.json` with real Indonesian translations — required by `project-context.md`'s i18n rule.
- [ ] **Task 10: Verification** (AC: all)
  - [ ] `pnpm --filter domain test` (100% coverage on the two new files), `pnpm --filter backend run test`, `pnpm --filter web run test` pass, including all new test files, with no regression in existing suites.
  - [ ] `pnpm build` and `pnpm lint` clean at the repo root, including new generated GraphQL types.
  - [ ] Manual smoke check (Completion Notes): as a user with no API key, click "Subscribed Accounts" → land on `/wizard/onboarding/api-key?redirect=...`; submit a key → Next enabled → subscribe step → submit a handle → Complete → redirected to the captured `redirect` path (404 expected until Story 3.2 ships, per Out of Scope); as a user who already has a key, confirm "Subscribed Accounts" no longer redirects into the wizard.

## Dev Notes

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3:** Sourced from the swept `epic-3-readiness.md` (`swept: true`, re-run 2026-08-07, explicitly lists `3.1` in `stories_covered`) — no Gate 1 gap (this story writes exclusively through backend GraphQL mutations, never a direct DB/domain call from `apps/web`); Gate 3 found no gap specific to this story's originally-scoped 2-step form flow.
  - **Lightweight guard (fresh, story-specific) — triggered two real gaps the sweep could not have anticipated, since both are UI/design-artifact-shaped rather than backend-architecture-shaped, and the sweep's own scope doesn't cross into `design-artifacts/`:**
    1. **The generic `/wizard` page mechanism** (`design-artifacts/UX-wizard-page-run-1/DESIGN.md`/`EXPERIENCE.md`, status: final) has no owning story anywhere, and Story 5.5 (Epic 5) confirms cross-epic reuse of the *same* wizard instance this story creates. Confirmed via `AskUserQuestion` with the user (2026-08-07): split into new **Story 0.24** (`0-24-build-the-reusable-wizard-page-primitive`), this story now only registers its two steps into that primitive. The registry design itself was also revised, per user direction, from EXPERIENCE.md's original URL-query-param-encoded `steps` array to a typed, code-defined wizard registry keyed by `wizardKey` — the query-param design cannot cleanly support per-step, per-locale `generateMetadata`, conflicting with `project-context.md`'s Dynamic Page Title & Meta Tags rule.
    2. **UX-DR9's `/settings/subscriptions` route** (list/add/remove) has no story that builds the list/remove view — Story 3.2 only ever adds. A forward-note was added to Story 3.2's `epics.md` entry (not a new story — doesn't block this story, since this story only needs the "subscribe" action, which it now owns itself).
  - **A third, non-blocking finding:** Story 3.4 (the actual per-platform scraper) is still placeholder/undetailed, so the UX-scenario-implied "scrape on submit to validate the account" behavior (`design-artifacts/C-UX-Scenarios/03-alex-discovers-his-feed/03.3-adding-a-subscription.md`) cannot be built without inventing scraper-implementation scope this story doesn't own. Per user decision (`AskUserQuestion`, 2026-08-07): shipped as manual entry only, with a forward-note added to Story 3.4's `epics.md` entry (see Out of Scope).
- **Gate 2 (UI Complexity & Reusability):** Run fresh via subagent persona Freya against `design-artifacts/UX-wizard-page-run-1` plus the confirmed cross-epic reuse evidence (Story 5.5, PRD §3.10's menu-gating mention). **Verdict:** the wizard chrome itself (Step Summary's 3 visual states, Navigation's 4 button states, the `useWizardStep()` hook combining route-derived config with derived completion state) is non-trivial, reusable UI that must not be built ad hoc inside this story — this is what produced the Story 0.24 split above. Freya's secondary opinion: the "redirect into the wizard because a prerequisite is missing" gate check has 2 confirmed consumers (this story's own trigger + the PRD's future "Extract event from post(s)" menu item) and combines derived state with a redirect side effect, but carries no visual states of its own — built as a small reusable hook (`useHasApiKey()`, Task 8) rather than a dedicated story.
- **Why `/settings/subscriptions` (Story 3.2, not yet built) is this story's concrete trigger:** epics.md's own AC example ("e.g., 'Manage Subscriptions'") names this exact destination. Story 2.8 (User Menu, `done`) already ships a real "Subscribed Accounts" entry pointing at `/settings/subscriptions` in `packages/ui/src/core/app-shell/profile-menu-entries.ts` — the only concrete, already-built place in the codebase matching the AC's own example. This story wires its gate onto that existing entry (Task 7) rather than inventing a placeholder trigger. Until Story 3.2 ships, completing the wizard (or already having a key) still routes to a route that 404s — an accepted, temporary "reserved slot" consequence, the same pattern already used by Stories 0.7/0.8/0.13/0.23/0.24's own reserved capabilities.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: no new schema/migration required by this story.** This story's only new persisted state (`subscriptions` rows) is created entirely through Story 3.1a's already-migrated `subscriptions`/`social_media_account_profiles` tables and its `subscribeToAccount()` lib function — this story adds a GraphQL mutation wrapping that function, not new columns or tables.
- **Impacted contracts:** new GraphQL `Subscription`/`SubscribeToAccountInput`/`SubscribeToAccountResult` types (`apps/backend/src/schema/subscriptions.graphql`) and their generated TypeScript counterparts (`apps/backend/src/generated/resolvers-types.ts`, `apps/web/src/generated/graphql.ts`). The GraphQL `Subscription` type's shape (`id`, `accountId`, `isNewlyAdded`, `createdAt`) is a read-shaped subset of `packages/shared-types`' `Subscription` interface (Story 3.1a) — deliberately omits `userId`/`deletedAt`, neither of which any consumer of this mutation's result needs.
- **Required DB migration changes:** none.
- **Required TypeScript type changes:** none beyond the new codegen output above; no `packages/shared-types` change (this story reuses Story 3.1a's `Subscription` interface, doesn't add a new one).
- **Backward compatibility and rollout notes:** purely additive — a new mutation, no existing contract changes.
- **Verification checks:** Task 2's `subscriptions.test.ts` asserts `subscribeToAccount`'s platform validation, profile-reuse-vs-create branching (via Story 3.1a's already-tested lib function), and the `alreadySubscribed` flag's correctness.

### Project Structure Notes

- **This story depends on Story 0.24 for its route/chrome/hook, but also directly modifies files Story 0.24 creates** (`wizard-registry.ts`, the shared `Wizards`/`WizardChrome` locale sections) — implement Story 0.24 first, or coordinate sequencing carefully if built in parallel; do not let this story silently duplicate a second wizard-chrome implementation if 0.24 is not yet merged (mirrors Story 3.1b's own documented KMS/Story-0.13 sequencing caution).
- New backend: `apps/backend/src/schema/subscriptions.graphql`, `apps/backend/src/schema/subscriptions.test.ts`; modified `apps/backend/src/schema/resolvers.ts` (new imports, `formatSubscription`, one new resolver).
- New shared: `packages/domain/src/subscriptions/{platforms.ts, parse-account-handle.ts, index.ts}` + their `.test.ts` files.
- New frontend: `apps/web/src/features/onboarding/{onboarding-api-key-step.tsx, onboarding-subscribe-step.tsx, use-has-api-key.ts, mutations.graphql}` + `.test.tsx`/`.test.ts` files.
- Modified frontend: `apps/web/src/components/layout/AppShellWrapper.tsx` (new `useHasApiKey()` call, `resolveHref` prop); `packages/ui/src/core/app-shell/{profile-menu-entries.ts, UserMenu.tsx, AppShell.tsx}` (new optional `requiresApiKey`/`resolveHref` plumbing, backward compatible); Story 0.24's `apps/web/src/features/wizard/wizard-registry.ts` (new `onboarding` entry).
- Modified: `apps/web/locales/{en,id}.json`; `apps/web/src/generated/graphql.ts` and `apps/backend/src/generated/resolvers-types.ts` (codegen output).
- **No conflicts detected** with Story 3.1b's `/settings/api-keys` page or Story 3.1a's schema — this story only consumes both, doesn't modify their files.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.1] — this story's authoritative AC and both 2026-08-07 Amendment notes.
- [Source: _bmad-output/planning-artifacts/epics.md#Story-0.24] — the wizard primitive this story consumes and registers into.
- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.2, #Story-3.4] — forward-notes added during this story's creation.
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-3-readiness.md] — the swept Gate 1/3 sweep this story cites.
- [Source: design-artifacts/UX-wizard-page-run-1/DESIGN.md, EXPERIENCE.md] — the wizard chrome spec Story 0.24 implements and this story consumes.
- [Source: design-artifacts/C-UX-Scenarios/03-alex-discovers-his-feed/03.1.1-entry-points.md, 03.2-the-api-key-gate.md, 03.3-adding-a-subscription.md] — the gate/entry-point behavior this story's trigger and redirect/exit logic follow, and the richer (not-adopted) autocomplete/keyword-scan subscribe UX explicitly deferred.
- [Source: _bmad-output/implementation-artifacts/3-1a-create-social-media-account-profiles-table.md] — the `subscribeToAccount()` lib function contract this story's resolver wraps.
- [Source: _bmad-output/implementation-artifacts/3-1b-manage-and-revoke-api-keys.md] — `createApiKey`/`myApiKeys` contract this story's `api-key` step reuses; the `select.tsx` shadcn primitive this story's `subscribe` step reuses.
- [Source: apps/web/src/app/[locale]/settings/notifications/{page.tsx, notifications-content.tsx}] — reference pattern for `generateMetadata`, loading/error state shape, and `BlockingLoader`-wrapped submit.
- [Source: packages/ui/src/core/app-shell/{AppShell.tsx, UserMenu.tsx, profile-menu-entries.ts}] — the existing, already-shipped (Story 2.8) User Menu this story extends with the gate.
- [Source: apps/web/src/components/providers/auth-session-provider.tsx] — `useAuthSession()` contract used by `useHasApiKey()`.

## Global Rules References

- [x] `_bmad-output/project-context.md` — Loaders (BlockingLoader on critical mutations), State Management (Server State via React Query/codegen), i18n rules, `packages/domain` reusability/DB-coupling restriction, `packages/ui`-vs-local-primitive convention.
- [x] `story-content-structure.md` — canonical section order followed.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-1/AD-2 not implicated (no event query in this story); general GraphQL-mutation-layer convention.
- [x] `docs/infrastructure/index.md` — no infra/deployment change in this story (pure application-layer GraphQL + frontend).

## Implementation Plan (Rule-Compliant)

### File Change Plan

- **New:** `packages/domain/src/subscriptions/{platforms.ts, parse-account-handle.ts, index.ts, platforms.test.ts, parse-account-handle.test.ts}`; `apps/backend/src/schema/{subscriptions.graphql, subscriptions.test.ts}`; `apps/web/src/features/onboarding/{onboarding-api-key-step.tsx, onboarding-api-key-step.test.tsx, onboarding-subscribe-step.tsx, onboarding-subscribe-step.test.tsx, use-has-api-key.ts, use-has-api-key.test.ts, mutations.graphql}`.
- **Modified:** `apps/backend/src/schema/resolvers.ts` (new import + 1 resolver + `formatSubscription`); Story 0.24's `apps/web/src/features/wizard/wizard-registry.ts` (new `onboarding` entry); `packages/ui/src/core/app-shell/{profile-menu-entries.ts, UserMenu.tsx, AppShell.tsx}` (new optional `requiresApiKey`/`resolveHref`); `apps/web/src/components/layout/AppShellWrapper.tsx` (new `resolveHref` wiring); `apps/web/locales/{en,id}.json`; `apps/web/src/generated/graphql.ts` and `apps/backend/src/generated/resolvers-types.ts` (codegen output).
- **Not modified:** `packages/database/schema.ts` (no schema change); `packages/shared-types` (reuses Story 3.1a's `Subscription` interface).

### Rule Mapping

- Backend-only mutation layer, never a direct DB/domain write from `apps/web` → `story-split-gate.md` Gate 1 → `subscribeToAccount` resolver (Task 2), consumed only via the generated hook (Task 3/6).
- Reuse over reinvention (`createApiKey`, `select.tsx`) → epics.md's Story 3.1/3.1b Amendment notes → Tasks 5/6.
- Wizard chrome reuse, not ad hoc → Gate 2 finding → Story 0.24 dependency + registry entry (Task 4).
- `packages/domain` reusable, framework/DB-agnostic logic → `project-context.md` Code Organization rule → Task 1's `platforms.ts`/`parse-account-handle.ts`, 100%-unit-tested.
- Non-blocking-vs-blocking loaders → `project-context.md` Loaders rule → `BlockingLoader` on both step submits (Tasks 5/6).
- i18n, no hardcoded strings → `project-context.md` i18n rules → Task 9.
- PostHog analytics events named/payload-shaped explicitly → persistent fact (AD-5) → AC10/Tasks 5/6.

### Verification Plan

- `packages/domain`: `platforms.test.ts`/`parse-account-handle.test.ts`, 100% coverage.
- `apps/backend/src/schema/subscriptions.test.ts`: platform validation, create-vs-reuse-vs-already-subscribed branching, auth requirement.
- `apps/web/.../onboarding-api-key-step.test.tsx`, `onboarding-subscribe-step.test.tsx`, `use-has-api-key.test.ts`: happy/unhappy paths per Tasks 5/6/8.
- `packages/ui`'s `UserMenu.test.tsx`/`AppShell` coverage: `resolveHref` backward compatibility and gate-redirect behavior (Task 7).
- `pnpm build`, `pnpm lint`, full test suite at repo root — no regressions.

## Pre-Coding Approval Gate

- [ ] Scope confirmation: this story builds the `onboarding` wizard registry entry + its two step components, the `subscribeToAccount` mutation, `packages/domain`'s platform/handle-parsing helpers, and the User-Menu gate wiring — it does not build `/settings/subscriptions` itself (Story 3.2) or any real scraper validation (Story 3.4).
- [ ] Architecture and boundary confirmation: `subscribeToAccount` resolver confined to `apps/backend`'s GraphQL layer, wrapping Story 3.1a's lib function; no direct DB access from `apps/web`; `platforms.ts`/`parse-account-handle.ts` confirmed dependency-free before landing in `packages/domain`.
- [ ] **Sequencing confirmation (specific to this story):** confirm Story 0.24 (wizard primitive), Story 3.1a (`subscribeToAccount()` lib function, schema), and Story 3.1b (`createApiKey`/`myApiKeys`, `select.tsx`) are implemented before starting Tasks 2/4/5/6 — this story has real code dependencies on all three, none of which are `done` yet as of this story's creation.
- [ ] Testing plan confirmation: backend integration tests (Task 2), `packages/domain` unit tests (Task 1), frontend integration tests (Tasks 5/6/8) as scoped above.
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted: Gate 1/3 sourced from swept `epic-3-readiness.md` (no gap); lightweight guard found two real gaps, resolved by splitting Story 0.24 (approved) and forward-noting Story 3.2 (approved); Gate 2 run fresh (wizard-chrome split into 0.24; gate-check hook stays inline, approved); the "no live scrape validation" gap is an explicitly accepted, documented deferral (user decision) — confirm this is still acceptable before implementation begins.
- [ ] Explicit human approval state (Default: **pending approval**).

## Testing Requirements

- [ ] `packages/domain` unit tests: `platforms.test.ts`, `parse-account-handle.test.ts` — 100% coverage (project-context.md's `packages/domain` rule).
- [ ] Backend integration tests (`subscriptions.test.ts`): platform validation, create/reuse/already-subscribed branching, auth requirement.
- [ ] Frontend integration tests: `onboarding-api-key-step.test.tsx`, `onboarding-subscribe-step.test.tsx`, `use-has-api-key.test.ts`, plus `packages/ui`'s updated `UserMenu.test.tsx` coverage for `resolveHref`.
- [ ] E2E: not required as a dedicated flow per `project-context.md`'s testing-trophy philosophy — integration coverage above satisfies the Definition of Done; the manual smoke check in Task 10 substitutes for a scripted E2E given the wizard's several cross-story dependencies.

## Deliverables Checklist

- [ ] `subscribeToAccount` GraphQL mutation, fully tested, wrapping Story 3.1a's lib function.
- [ ] `packages/domain/src/subscriptions/{platforms.ts, parse-account-handle.ts}`, 100% unit tested.
- [ ] `onboarding` wizard registry entry (2 steps) registered into Story 0.24's primitive.
- [ ] `OnboardingApiKeyStep`/`OnboardingSubscribeStep` components, both `BlockingLoader`-wrapped, both integration tested.
- [ ] `useHasApiKey()` reusable gate hook, tested.
- [ ] User Menu's "Subscribed Accounts" entry gated via `resolveHref`, backward-compatible with every other entry.
- [ ] `Wizards.onboarding.*`/`OnboardingWizard`/new `Metadata` i18n keys in both `en.json` and `id.json`.
- [ ] `wizard_api_key_step_completed`/`wizard_subscribe_step_completed`/`onboarding_wizard_completed` PostHog events wired.

## Out of Scope

- The generic `/wizard/[wizardKey]/[stepSlug]` page chrome itself (Step Summary, Navigation, `useWizardStep()` hook, the wizard registry mechanism, `WizardChrome` i18n) — Story 0.24, split off during this story's own creation (Gate 3 lightweight-guard finding); this story only adds its own `onboarding` entry into that registry.
- The `/settings/subscriptions` page itself (list/view/remove subscriptions) — Story 3.2, scope-expansion forward-noted in `epics.md` during this story's creation.
- Live scrape-based account validation on subscribe submit (account-exists check, empty-posts warning) — requires a real per-platform scraper adapter; Story 3.3c only builds the interface, Story 3.4 (the concrete implementation) is still placeholder/undetailed. Forward-noted on Story 3.4.
- The richer subscribe UX from `design-artifacts/C-UX-Scenarios/03-alex-discovers-his-feed/03.3-adding-a-subscription.md` (autocomplete for existing shared accounts, an in-table "Add New" row editing pattern) — not reflected in epics.md's AC; this story's subscribe step is a plain manual-entry form/modal-equivalent, not a table row.
- Resolving a real platform-native `accountId` from a pasted URL/handle — this story uses the parsed handle as a stand-in for both `accountId` and `username`; superseded once Story 3.4's real scraper can resolve true platform identifiers.
- The `currentStep`/"skip already-satisfied step" routing behavior described in `03.2-the-api-key-gate.md` — this story's gate only checks API-key possession (matching epics.md's literal AC); the `api-key` step itself already self-skips via its own `isStepCompleted`-on-mount check (AC4) without needing route-level skip logic.
- Gating any entry point beyond the User Menu's "Subscribed Accounts" link (e.g. the future "Extract event from post(s)" menu item, PRD §3.10) — `useHasApiKey()` is built reusable for that future consumer, but wiring it there is out of this story's scope.

## Definition of Done

- [ ] AC1-10 satisfied and demonstrated via the tests in Testing Requirements.
- [ ] Backend, frontend, and `packages/domain` test suites pass; no regression in existing suites (including `packages/ui`'s `UserMenu.test.tsx`).
- [ ] `pnpm build` and `pnpm lint` clean for all touched packages.
- [ ] `en.json`/`id.json` both updated — no hardcoded user-facing strings.

## Completion Status

- [x] Completed

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
