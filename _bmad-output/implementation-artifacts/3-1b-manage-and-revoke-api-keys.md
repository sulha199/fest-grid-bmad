# Story 3.1b: Manage, add, and revoke API keys

## Story Details

- Epic: 3
- Story ID: 3.1b
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want a dedicated page to view my saved Gemini API keys (masked), add a new one, and revoke ones I no longer want to use,
so that I can control which of my BYOK keys the system is allowed to use for event extraction, both during and after onboarding.

## Acceptance Criteria

1. **Given** I am logged in and navigate to the `/settings/api-keys` page (UX-DR9), **when** the page loads, **then** I see my saved API keys, each shown masked (last 4 characters only, e.g. `••••1234` — never the decrypted value, never a key prefix), fetched via a `myApiKeys` query, scoped to `context.user` via `requireAuth` (Story 0.17) and filtered to active rows via `activeOnly(apiKeys)` (Story 0.22), not a hand-written `isNull(...)` clause. [epics.md AC1]
2. **And** while the list is loading, a skeleton matching the table layout is shown (non-blocking, per `project-context.md`'s Loaders rule); on error, an inline error state with a retry action is shown (matches `notifications-content.tsx`/`locations-content.tsx` precedent). [Derived]
3. **And** I can click an "Add API Key" action to open a modal (matching this app's established `/settings/*` add-item modal pattern — `LocationFormDialog` — rather than an inline editable table row) prompting for a provider (a single, pre-selected "Gemini" option — no other provider is selectable or supported at MVP) and the raw key value, with a "How to get a Gemini API key?" help link (a static external URL, not built by this story — a placeholder/TBD link is acceptable, matching how other stories leave non-blocking content links as configurable). [epics.md AC — Amendment, see Dev Notes]
4. **And** submitting the add-key form calls a `createApiKey(input: CreateApiKeyInput!): ApiKey!` mutation (Story 0.8 scaffold, Story 0.17 authenticated context) that: (a) validates `input.provider === "gemini"` server-side, throwing `GraphQLError` `BAD_REQUEST` for anything else (never trust client-side-only validation); (b) encrypts `input.key` via AWS KMS using Story 0.13's `encryptApiKey` (`apps/backend/src/lib/ai-gateway/kms.ts`), which itself requires Story 0.14's provisioned `BYOK_KMS_KEY_ID` — never stored in plaintext, never encrypted client-side; (c) computes and stores `keyLast4` (the input key's last 4 characters) as a small, non-sensitive plaintext column so the list view (AC1) never needs to decrypt on every read; (d) persists a new `api_keys` row with `isValid: true`, `invalidAttempts: 0`; (e) returns the new `ApiKey!` already masked. A success toast confirms and the new key is prepended to the list without a full refetch. This is the **same** mutation Story 3.1's onboarding wizard step 1 calls — not a separate/duplicate mutation (epics.md Story 3.1's Amendment note). [epics.md AC — Amendment]
5. **And** I can revoke a key, which calls a `deleteApiKey(id: ID!, action: SoftDeleteAction!)` mutation (AD-8 rule 4 — the `SoftDeleteAction` enum is reused from `apps/backend/src/schema/typeDefs.graphql`, never redeclared) that soft-deletes the key (never a hard delete) and returns the updated `ApiKey!`. [epics.md AC]
6. **And** attempting to revoke an already-revoked key (an invalid state transition) throws a `GraphQLError` with `extensions.code = 'INVALID_STATE_TRANSITION'` rather than silently no-op'ing; attempting to `RESTORE` an already-active key throws the same code. [epics.md AC]
7. **And** a revoked key is immediately excluded from the AI Gateway Adapter's (Story 0.13) key-selection pool for future extraction calls — enforced by Story 0.13's `fetchCandidateKeys` filtering via `activeOnly(apiKeys)`, a requirement this story adds to Story 0.13's task list (see Dev Notes → Architecture & UX Gate Findings). [epics.md AC]
8. **And** the revoke interaction on the frontend uses the reusable Soft-Delete-with-Undo primitive (`useSoftDeleteWithUndo`/`SoftDeleteToaster`, Story 0.18 — which explicitly named API Keys as an intended consumer): clicking "Revoke" calls `deleteApiKey(DELETE)` **immediately** (the commit already happened, per AD-8 rule 4's revised "commit-at-trigger" contract — not deferred to unmount), then the row greys out with an "Undo" toast; clicking "Undo" calls `deleteApiKey(RESTORE)` and reverts the row; letting the toast expire (`onExpire`) leaves the key revoked and splices it from the local React Query cache without a refetch — matching `locations-content.tsx`'s reference implementation exactly (`packages/ui/src/hooks/useSoftDeleteWithUndo.ts`). [epics.md AC]
9. **And** the page is a `/settings/api-keys` route composed inside the app shell (Story 0.7), matching the pattern of the other `/settings/*` pages — a server `page.tsx` with `generateMetadata` (next-intl `getTranslations`, `Metadata` namespace, via `apps/web/src/lib/metadata.ts`'s `buildPageMetadata`) rendering a client `api-keys-content.tsx`, mirroring `settings/notifications/page.tsx` and `settings/locations/page.tsx` exactly. [epics.md AC]
10. **And** all user-facing strings (page title, table headers, add-modal labels, toasts, error states) are sourced through next-intl from a new `ApiKeysSettingsPage` namespace (mirroring `SavedLocationsPage`/`NotificationsSettingsPage`), with entries added to both `apps/web/locales/en.json` and `apps/web/locales/id.json` — no hardcoded English strings in JSX. [project-context.md i18n rule, persistent fact]
11. **And** `api_key_added` (`{ provider }`) and `api_key_revoked` (`{ provider }`) PostHog analytics events fire on successful create and successful immediate-commit revoke respectively (mirrors `saved_location_deleted`'s pattern of firing on the immediate commit, not on toast-expiry/undo). [persistent fact — AD-5]

## Tasks / Subtasks

- [ ] Task 1: Database — add `keyLast4` column and the AD-8 partial active-rows index to `api_keys` (AC: 1, 4, 7)
  - [ ] Add `keyLast4: text('key_last4').notNull()` to the `apiKeys` table definition in `packages/database/schema.ts` (table is empty in every environment today — no story has ever written to it — so a `NOT NULL` add requires no backfill).
  - [ ] Add a partial index declaration on `apiKeys` scoped to `user_id` where `deleted_at IS NULL` (mirrors the `idx_favorites_active`/`idx_user_locations_active` precedent already in `schema.ts`).
  - [ ] Run `pnpm --filter database run generate` (drizzle-kit) to produce the migration SQL file (AD-3: schema changes must ship as generated migration files).
  - [ ] **Hand-edit the generated migration SQL** to append `WHERE deleted_at IS NULL` to the new index's `CREATE INDEX` statement (AD-8 rule 3's documented, currently-necessary workaround: the installed `drizzle-kit`/`drizzle-orm` versions silently drop the `WHERE` predicate for partial indexes — confirmed against `packages/database/migrations/0004_optimal_frog_thor.sql`). Add a comment in the migration file noting the hand-edit and linking the tracked upstream issues (`drizzle-orm#3349`, `drizzle-kit-mirror#461`), per the spine's existing convention.
  - [ ] Confirm `packages/database/seed.ts`'s `FIXTURE_API_KEYS` (if any) still seeds correctly with `keyLast4` populated — add it to any existing fixture rows if present.
- [ ] Task 2: Backend — `api_keys` GraphQL schema and resolvers (AC: 1, 4, 5, 6, 7)
  - [ ] Create `apps/backend/src/schema/api-keys.graphql` (mirrors `user-locations.graphql`'s per-resource file pattern — auto-merged by the existing `readdirSync('*.graphql')` schema-loading mechanism, no registration step needed):
    ```graphql
    type ApiKey {
      id: ID!
      provider: String!
      maskedKey: String!
      isValid: Boolean!
      createdAt: String!
      updatedAt: String!
    }

    input CreateApiKeyInput {
      provider: String!
      key: String!
    }

    extend type Query {
      myApiKeys: [ApiKey!]!
    }

    extend type Mutation {
      createApiKey(input: CreateApiKeyInput!): ApiKey!
      deleteApiKey(id: ID!, action: SoftDeleteAction!): ApiKey!
    }
    ```
    Deliberately **no** `keyEncrypted` field on the `ApiKey` GraphQL type — the encrypted ciphertext must never be queryable, not even by the owning user.
  - [ ] In `apps/backend/src/schema/resolvers.ts`: add `apiKeys` to the existing `@festgrid/database` import list (line 3); add a `formatApiKey(row)` helper (mirrors `formatLocationDetails`) that returns `{ ...row, maskedKey: '••••' + row.keyLast4, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() }` — never includes `keyEncrypted` or `keyLast4` raw in the returned shape beyond the composed `maskedKey`.
  - [ ] Add `myApiKeys` to the `Query` resolver map: `requireAuth(context)`, then `db.select().from(apiKeys).where(and(eq(apiKeys.userId, authUser.userId), activeOnly(apiKeys))).orderBy(desc(apiKeys.createdAt))`, mapped through `formatApiKey` — mirrors `myLocations`'s exact shape (already using `activeOnly`, confirming this is the established pattern, not a new one).
  - [ ] Add `createApiKey` to the `Mutation` resolver map: `requireAuth(context)`; validate `input.provider.toLowerCase() === 'gemini'` else throw `GraphQLError('Unsupported provider', { extensions: { code: 'BAD_REQUEST' } })`; import and call `encryptApiKey` from `apps/backend/src/lib/ai-gateway/kms.ts` (built by Story 0.13 — see Dev Notes on sequencing) to get `keyEncrypted`; compute `keyLast4 = input.key.slice(-4)`; insert `{ userId: authUser.userId, provider: input.provider.toLowerCase(), keyEncrypted, keyLast4, isValid: true, invalidAttempts: 0 }`; return `formatApiKey(inserted)`.
  - [ ] Add `deleteApiKey` to the `Mutation` resolver map, copying `deleteUserLocation`'s exact structure (AD-8's cited canonical rule-4 reference implementation, `resolvers.ts:133-173`): look up the row scoped to `id` + `authUser.userId`, `NOT_FOUND` if absent; for `action === 'DELETE'`, `INVALID_STATE_TRANSITION` if `deletedAt !== null` else `UPDATE ... SET deleted_at = now()`; for `action === 'RESTORE'`, `INVALID_STATE_TRANSITION` if `deletedAt === null` else `UPDATE ... SET deleted_at = null`; return `formatApiKey(updated)` in both branches.
  - [ ] Create `apps/backend/src/schema/api-keys.test.ts` (mirrors `user-locations.test.ts`'s structure and its `fs.readdirSync(schemaDir)`-based schema-composition check) covering: `myApiKeys` returns only the authenticated user's active keys, masked; `createApiKey` rejects a non-`gemini` provider; `createApiKey` persists `keyEncrypted` (via a mocked `encryptApiKey`) and never returns it; `deleteApiKey(DELETE)` soft-deletes and excludes the row from a subsequent `myApiKeys` call; `deleteApiKey(DELETE)` on an already-deleted row throws `INVALID_STATE_TRANSITION`; `deleteApiKey(RESTORE)` on an active row throws `INVALID_STATE_TRANSITION`; a user cannot revoke another user's key (`NOT_FOUND`).
- [ ] Task 3: Backend — confirm/build the KMS encrypt path this story depends on (AC: 4)
  - [ ] **Sequencing check (Pre-Coding Approval Gate item):** confirm whether Story 0.13 has been implemented yet. If `apps/backend/src/lib/ai-gateway/kms.ts` does not exist, this story cannot complete Task 2's `createApiKey` resolver as scoped — either implement Story 0.13 first, or (only with explicit user sign-off) build the minimal lazy-init `encryptApiKey`/`getKmsClient()` pair described in Story 0.13's own Task 3 directly in this story and let Story 0.13 adopt it when it lands, to avoid two independently-built KMS clients. Do not silently duplicate a second KMS client under a different path.
  - [ ] If building `kms.ts` as part of this story (per the fallback above): add `@aws-sdk/client-kms` (`^3.1058.x`, per Story 0.13's own already-researched pin) to `apps/backend/package.json`; add `byokKmsKeyId?: string` to `apps/backend/src/env.ts`'s `BackendEnv` (reading `process.env.BYOK_KMS_KEY_ID`); add `BYOK_KMS_KEY_ID=` to root `.env.example` (comment: real key provisioned by Story 0.14, lazily initialized so local dev/tests are unaffected — mirrors Story 0.13's own documented deferral).
- [ ] Task 4: Frontend — `Table` and `Select` shadcn primitives (AC: 1, 3)
  - [ ] Add `apps/web/src/components/ui/table.tsx` and `apps/web/src/components/ui/select.tsx` via the shadcn CLI (`npx shadcn add table select`) — neither exists in the repo yet (confirmed via directory listing during story creation); this repo's established convention keeps raw shadcn primitives local to `apps/web/src/components/ui/` (see `button.tsx`, `card.tsx`, `dialog.tsx`, `switch.tsx`), reserving `packages/ui/src/core/` for custom/composed components — do not attempt to "promote" these primitives to `packages/ui`.
- [ ] Task 5: Frontend — GraphQL operations and codegen (AC: 1, 4, 5, 6, 8)
  - [ ] Create `apps/web/src/features/settings/api-keys/queries.graphql` (`myApiKeys { id provider maskedKey isValid createdAt updatedAt }`) and `apps/web/src/features/settings/api-keys/mutations.graphql` (`createApiKey`, `deleteApiKey`), mirroring `features/locations/`'s per-sub-feature folder convention.
  - [ ] Run the GraphQL Code Generator (`pnpm codegen` or the repo's equivalent script) to regenerate `apps/web/src/generated/graphql.ts` (new `useGetMyApiKeysQuery`/`useCreateApiKeyMutation`/`useDeleteApiKeyMutation` hooks + `SoftDeleteAction` reuse) and `apps/backend/src/generated/resolvers-types.ts`.
- [ ] Task 6: Frontend — `/settings/api-keys` route (AC: 1, 2, 9, 10)
  - [ ] Create `apps/web/src/app/[locale]/settings/api-keys/page.tsx`: server component with `generateMetadata` (next-intl `getTranslations`, `Metadata` namespace's new `apiKeysTitle`/`apiKeysDescription` keys, via `buildPageMetadata`), rendering `<Suspense><ApiKeysContent /></Suspense>` — copy `settings/notifications/page.tsx`'s structure exactly (including `export const dynamic = 'force-dynamic'`).
  - [ ] Create `apps/web/src/app/[locale]/settings/api-keys/api-keys-content.tsx` (`"use client"`): auth-redirect-if-unauthenticated (mirrors `notifications-content.tsx`'s `useAuthSession`/`useRouter` pattern); `useGetMyApiKeysQuery` for the list; loading skeleton (non-blocking, table-shaped) and error+retry states (mirrors `notifications-content.tsx`); renders a Shadcn `Table` with columns Provider / Masked Key / Actions; an "Add API Key" button opens `ApiKeyFormDialog`; each row's "Revoke" button wired through `useSoftDeleteWithUndo` exactly as `locations-content.tsx`'s `handleDelete` (Task 2's AC8 wiring — call `deleteApiKey(DELETE)` immediately, fire `api_key_revoked` analytics, `markPending(id, async () => deleteApiKey(RESTORE), labels)`, `onExpire` splices the id from the `getMyApiKeys` React Query cache without refetch); `isPending(key.id)` greys out the row and swaps "Revoke" for the toast-driven undo (no separate in-row Undo button needed beyond the toast, matching the locations precedent).
  - [ ] Create `apps/web/src/app/[locale]/settings/api-keys/api-key-form-dialog.tsx` (`"use client"`): a `Dialog` (mirrors `LocationFormDialog`'s `isOpen`/`onClose` prop shape, add-only — no edit mode, unlike locations) with a `Select` fixed to "Gemini" (single option, disabled/pre-selected — no other provider), a password-style text input for the raw key, a static "How to get a Gemini API key?" link (external URL, `target="_blank"`), and a submit button wrapped in `BlockingLoader` (AC's key-creation is a critical/security-sensitive persisted mutation — matches `LocationFormDialog`'s own `BlockingLoader` usage for its submit, per `project-context.md`'s blocking-loader rule) calling `useCreateApiKeyMutation`; on success, fires `api_key_added` analytics, shows a success toast, prepends the new key to the `getMyApiKeys` cache via `queryClient.setQueryData` (no refetch, mirrors `GetMyLocationsDocument` cache-update precedent), and closes.
  - [ ] Create `.test.tsx` files for `api-keys-content.tsx` and `api-key-form-dialog.tsx` (Vitest + Testing Library + `msw`, "testing trophy" integration style, mirrors `notifications-content.test.tsx`/`location-form-dialog.test.tsx`): list renders masked keys; add-key happy path and an unhappy path (non-Gemini rejected server-side, or a network failure surfaced as an error toast); revoke happy path (immediate grey-out + toast) and undo path (row reverts, no second `deleteApiKey(DELETE)` call).
- [ ] Task 7: i18n — add the `ApiKeysSettingsPage` namespace and `Metadata` keys (AC: 3, 9, 10)
  - [ ] Add to `apps/web/locales/en.json`'s `Metadata` object: `apiKeysTitle`, `apiKeysDescription` (mirrors `locationsTitle`/`locationsDescription`).
  - [ ] Add a new `ApiKeysSettingsPage` object to `apps/web/locales/en.json` with (at minimum): `title`, `emptyState`, `errorState`, `retryButtonLabel`, `providerColumnLabel`, `keyColumnLabel`, `actionsColumnLabel`, `addButtonLabel`, `addModalTitle`, `providerLabel`, `keyLabel`, `keyPlaceholder`, `howToGetKeyLinkLabel`, `submitButtonLabel`, `addSuccessToast`, `addErrorToast`, `revokeButtonLabel`, `revokedToast`, `undoLabel`, `restoreErrorToast`.
  - [ ] Mirror every key into `apps/web/locales/id.json` with real Indonesian translations (not copy-pasted English) — required by `project-context.md`'s i18n rule; this story is user-facing and must not ship English-only strings.
- [ ] Task 8: Verification (AC: all)
  - [ ] `pnpm --filter backend run test` and `pnpm --filter web run test` pass, including all new test files, with no regression in existing suites (`user-locations.test.ts`, `resolvers.test.ts`, `locations-content.test.tsx`, etc.).
  - [ ] `pnpm build` and `pnpm lint` clean at the repo root, including the new generated GraphQL types.
  - [ ] Manual smoke check (Completion Notes): add a key, confirm it appears masked with the correct last-4 chars; revoke it, confirm the grey-out + toast + disappearance-on-navigate-back behavior; click Undo on a fresh revoke, confirm it reappears active; confirm a second revoke attempt on an already-revoked key (e.g. via GraphQL playground) returns `INVALID_STATE_TRANSITION`.

## Dev Notes

- **This story's scope was expanded during its own creation** (user decision, `AskUserQuestion`) to fold in key-*creation* (originally Story 3.1's sole territory), because a UX scenario doc showed it on the same page. `createApiKey` is now owned here; Story 3.1's onboarding wizard step 1 must call this exact mutation, not build its own. See `epics.md`'s Story 3.1 and Story 3.1b Amendment notes (2026-08-07) for the full cross-reference. **Consequence for implementation order:** this story now has a real code dependency on Story 0.13's `apps/backend/src/lib/ai-gateway/kms.ts` (for `encryptApiKey`), which is `ready-for-dev` but not yet implemented — see Task 3's sequencing check.
- **Masking convention:** last 4 characters only (`••••1234`), computed and stored server-side as `keyLast4` at creation time — never derived by decrypting on every list read (that would mean an unnecessary KMS `Decrypt` call, plus transiently holding plaintext, on every page load; `project-context.md`'s KMS rule says keys are decrypted "only when needed to make an external API call"). A UX scenario doc (`design-artifacts/C-UX-Scenarios/04-alex-manages-keys/04.1-manage-api-keys.md`) shows an alternative "first 5 characters, key-prefix" convention — explicitly **not** adopted; the epics.md AC's last-4 convention is more conservative and was confirmed as the correct choice during story creation.
- **`keyEncrypted` must never appear in any GraphQL response, log line, or error message** — this is the whole point of AD-8/the KMS security rule; the `ApiKey` GraphQL type deliberately omits it (Task 2).
- **Provider is single-option at MVP.** The UX scenario doc's "Provider" dropdown is forward-looking (implies future multi-provider support) but no other provider is wired anywhere in this codebase (`packages/domain/src/ai-gateway` only ever mentions Gemini). Server-side validation rejects anything but `"gemini"` (case-insensitive) rather than trusting a client-side-only single-option UI.

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3:** Sourced from the swept `epic-3-readiness.md` (`swept: true`, re-run 2026-08-07) — this story **is** that report's own identified Gate 3 gap (see its "New Prerequisite Stories Added" section). No fresh Gate 1/Gate 3 subagent pass was re-run for the story's original view+revoke scope, per this workflow's rule for already-swept epics.
  - **Lightweight guard (fresh, story-specific) — passed:** the epic-wide sweep did not (and could not) anticipate this story's own scope expansion (the add-key flow) or the resulting KMS/`kms.ts` sequencing dependency on Story 0.13, since that expansion was decided during this story's own creation, after the sweep ran. Reasoned through directly (not delegated to a fresh subagent, since it was a single, well-scoped correctness question, not a broad architecture sweep): confirmed `encryptApiKey` is already fully specified in Story 0.13's Task 3 (no new architecture invented here, just an ownership/sequencing correction) and that `fetchCandidateKeys` needed an explicit `activeOnly` filter addition to satisfy this story's AC7 — both corrected directly in Story 0.13's file (see its 2026-08-07 amendments) rather than absorbed into this story, consistent with `story-split-gate.md`'s "don't silently absorb a foundational gap" principle.
- **Gate 2 (UI Complexity & Reusability):** Run fresh via subagent persona Freya, evaluating the AC-scoped work (masked list + revoke) plus the newly-folded-in add-flow against `design-artifacts/UX-festgrid-run-1/DESIGN.md`/`EXPERIENCE.md` and the UX scenario doc. **Verdict: no new story split needed.** The revoke interaction needs only the already-built `useSoftDeleteWithUndo`/`SoftDeleteToaster` (Story 0.18, which explicitly named API Keys as an intended consumer) plus a standard Shadcn table — nothing novel. The add-flow, while not originally in this story's AC, is UI-low-complexity (reuses the existing `/settings/*` modal pattern, e.g. `LocationFormDialog`) and was folded in by user decision rather than split into a separate story — see the Amendment note in `epics.md`. The masking-format conflict (last-4 vs. first-5) was assessed as a documentation inconsistency, not a UI-complexity signal.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: mismatch found**, on two fronts:
  1. `packages/database/schema.ts`'s `apiKeys` table has no column to cheaply render a masked key without decrypting on every read — AC1 requires showing a masked value on every page load.
  2. `apiKeys` is bound by AD-8 (rule 1: `deletedAt` column already present — confirmed in `schema.ts`) but has no partial active-rows index (AD-8 rule 3), unlike `favorites`/`calendar_additions`/`subscriptions`/`user_locations`, which already have one; this story is the first to actually query `api_keys` filtered by `deletedAt`, making the gap concrete rather than theoretical.
- **Impacted fields/contracts:** `packages/database/schema.ts`'s `apiKeys` table (new `key_last4` column, new partial index); the new `ApiKey`/`CreateApiKeyInput` GraphQL types (`apps/backend/src/schema/api-keys.graphql`) and their generated TypeScript counterparts (`apps/backend/src/generated/resolvers-types.ts`, `apps/web/src/generated/graphql.ts`). No `@festgrid/shared-types` change — no `ApiKey` interface exists there today, and this story does not add one (matches Story 0.13's own prior finding that `ApiKey` has no shared-types presence).
- **Required DB migration changes:** a `drizzle-kit`-generated migration adding `key_last4 text NOT NULL` to `api_keys` (no backfill needed — the table has zero rows in every environment prior to this story) and a hand-edited partial index `CREATE INDEX idx_api_keys_active ON api_keys (user_id) WHERE deleted_at IS NULL;` (Task 1's documented hand-edit workaround, per AD-8 rule 3's known `drizzle-kit` limitation).
- **Required TypeScript type changes:** `packages/database/schema.ts`'s `apiKeys` Drizzle table gains a typed `keyLast4: text` column (compile-time inferred); new codegen-produced `ApiKey`/`CreateApiKeyInput` types on both the backend and frontend once Task 5's codegen run completes.
- **Backward compatibility and rollout notes:** purely additive — `api_keys` has never been written to by any shipped story, so there is no existing-row backfill risk and no breaking API change for any consumer (unlike `deleteUserLocation`'s in-place breaking migration, AD-8's other cited example).
- **Verification checks:** Task 2's integration tests assert `keyLast4` is correctly derived and persisted on `createApiKey`, and that `maskedKey` never exposes more than the stored last 4 characters; a migration dry-run/apply against local Postgres confirms the partial index carries its `WHERE` clause (not silently dropped, per the documented `drizzle-kit` bug).

### Project Structure Notes

- New backend: `apps/backend/src/schema/api-keys.graphql`, `apps/backend/src/schema/api-keys.test.ts`; modified `apps/backend/src/schema/resolvers.ts` (new import, `formatApiKey`, three new resolvers); possibly new `apps/backend/src/lib/ai-gateway/kms.ts`/`apps/backend/src/env.ts` changes if Task 3's fallback path is taken (Story 0.13 not yet implemented).
- New frontend: `apps/web/src/app/[locale]/settings/api-keys/{page.tsx, api-keys-content.tsx, api-key-form-dialog.tsx}` + their `.test.tsx` files; `apps/web/src/components/ui/{table.tsx, select.tsx}` (new shadcn primitives); `apps/web/src/features/settings/api-keys/{queries.graphql, mutations.graphql}`.
- Modified: `packages/database/schema.ts` (new column + index) and a new committed migration file; `apps/web/locales/{en,id}.json`; `apps/web/src/generated/graphql.ts` and `apps/backend/src/generated/resolvers-types.ts` (codegen output).
- No conflicts detected with the existing `/settings/*` route/feature layout — this story slots in exactly alongside `settings/locations` and `settings/notifications`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.1b] — this story's authoritative AC and Amendment note.
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-3-readiness.md] — the swept Gate 1/3 sweep that originated this story.
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-8] — Soft-Delete Convention, rule 4's canonical `deleteUserLocation` reference implementation.
- [Source: _bmad-output/project-context.md] — KMS/BYOK encryption Security rule, Loaders/State-Management/i18n rules, `packages/ui` vs. local shadcn-primitive convention.
- [Source: design-artifacts/C-UX-Scenarios/04-alex-manages-keys/04.1-manage-api-keys.md] — the UX scenario that surfaced the add-flow scope expansion and the (not-adopted) alternative masking convention.
- [Source: apps/web/src/app/[locale]/settings/locations/locations-content.tsx, location-form-dialog.tsx] — reference implementation for the soft-delete-with-undo revoke wiring and the add-modal pattern.
- [Source: apps/backend/src/schema/resolvers.ts, user-locations.graphql] — `myLocations`/`deleteUserLocation` reference resolvers this story's `myApiKeys`/`deleteApiKey` mirror.
- [Source: packages/ui/src/hooks/useSoftDeleteWithUndo.ts] — actual shipped hook implementation (supersedes some now-stale prose in Story 0.18's own markdown; the real code is the source of truth).
- [Source: _bmad-output/implementation-artifacts/0-13-set-up-ai-gateway-adapter-layer-for-gemini.md] — `encryptApiKey`/`kms.ts` contract this story depends on and cross-amended.
- [Source: packages/database/schema.ts] — existing `apiKeys` table shape this story extends.

## Global Rules References

- [x] `_bmad-output/project-context.md` — KMS/BYOK Security rules, Soft-Delete Convention (AD-8), Loaders, State Management, i18n, `packages/ui`-vs-local-primitive convention.
- [x] `story-content-structure.md` — canonical section order followed.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-8 (Soft-Delete), AD-3 (migrations must be generated files).
- [x] `docs/infrastructure/index.md` / `docs/infrastructure/2-backend.md` — KMS-encrypted BYOK storage, Lambda/API layer conventions.

## Implementation Plan (Rule-Compliant)

### File Change Plan

- **New:** `apps/backend/src/schema/api-keys.graphql`, `apps/backend/src/schema/api-keys.test.ts`, `apps/web/src/app/[locale]/settings/api-keys/{page.tsx, api-keys-content.tsx, api-keys-content.test.tsx, api-key-form-dialog.tsx, api-key-form-dialog.test.tsx}`, `apps/web/src/components/ui/{table.tsx, select.tsx}`, `apps/web/src/features/settings/api-keys/{queries.graphql, mutations.graphql}`, a new `packages/database/migrations/*.sql` file.
- **Modified:** `packages/database/schema.ts` (new `keyLast4` column + partial index), `apps/backend/src/schema/resolvers.ts` (new import + 3 resolvers + `formatApiKey`), `apps/web/locales/{en,id}.json`, `apps/web/src/generated/graphql.ts`, `apps/backend/src/generated/resolvers-types.ts` (both codegen output).
- **Conditionally new** (only if Story 0.13 is not yet implemented when this story starts — see Task 3): `apps/backend/src/lib/ai-gateway/kms.ts`, `@aws-sdk/client-kms` dependency, `apps/backend/src/env.ts` change, `.env.example` entry.

### Rule Mapping

- KMS-backed BYOK encryption, never plaintext/client-side → `project-context.md` "User API Key Encryption" → `createApiKey` resolver calling `encryptApiKey` (Task 2/3, AC4).
- Soft-delete, never hard delete, rule-4 mutation contract → Architecture Spine AD-8 → `deleteApiKey` mirroring `deleteUserLocation` exactly (Task 2, AC5/6).
- Active-rows-only query default via shared helper, not hand-written `isNull` → AD-8 rule 2 / Story 0.22 → `activeOnly(apiKeys)` in both `myApiKeys` and Story 0.13's `fetchCandidateKeys` (Task 2/AC7).
- Partial index scoped to active rows → AD-8 rule 3 → Task 1's hand-edited migration.
- Soft-delete-with-undo UI → Story 0.18's reusable primitive → Task 6's `api-keys-content.tsx` wiring (AC8).
- i18n, no hardcoded strings → `project-context.md` i18n rules → Task 7 (`ApiKeysSettingsPage` namespace, en+id).
- Non-blocking initial-load skeleton / blocking add-key submit → `project-context.md` Loaders rule → Task 6 (skeleton) / Task 6's `BlockingLoader` on submit.
- Shared raw shadcn primitives stay local to `apps/web`, not `packages/ui` → established repo convention (Dev Notes) → Task 4.
- PostHog analytics events named/payload-shaped explicitly → persistent fact (AD-5) → `api_key_added`/`api_key_revoked` (AC11).

### Verification Plan

- `apps/backend/src/schema/api-keys.test.ts`: myApiKeys scoping/masking/active-only filtering; createApiKey provider validation, encryption call, keyLast4 derivation, no keyEncrypted leakage; deleteApiKey DELETE/RESTORE + INVALID_STATE_TRANSITION + cross-user isolation.
- `apps/web/.../api-keys-content.test.tsx` + `api-key-form-dialog.test.tsx`: masked list render, add happy/unhappy paths, revoke immediate-commit + grey-out + undo-reverts + expire-splices-from-cache.
- Migration apply against local Postgres, confirming the partial index's `WHERE` clause survives (manual check, per AD-8 rule 3's known tooling gap).
- `pnpm build`, `pnpm lint`, full test suite at repo root — no regressions.

## Pre-Coding Approval Gate

- [ ] Scope confirmation: this story now covers add + view + revoke for `/settings/api-keys` (expanded from view+revoke-only during creation, per user decision) — confirm this expanded scope is still correct before implementation begins.
- [ ] Architecture and boundary confirmation: `createApiKey`/`deleteApiKey`/`myApiKeys` confined to `apps/backend`'s GraphQL layer; KMS/AWS SDK code confined to `apps/backend` (via Story 0.13's `kms.ts` or this story's fallback build of it); no direct DB access from `apps/web`; raw shadcn `Table`/`Select` primitives added locally to `apps/web/src/components/ui`, not `packages/ui`.
- [ ] **Sequencing confirmation (specific to this story):** confirm whether Story 0.13 (`apps/backend/src/lib/ai-gateway/kms.ts`) is implemented yet. If not, confirm whether to (a) implement Story 0.13 first, or (b) build the minimal `encryptApiKey`/`getKmsClient()` pair as part of this story per Task 3's fallback, before starting Task 2.
- [ ] Testing plan confirmation: backend integration tests (Task 2) and frontend integration tests (Task 6) as scoped above; no unit-test requirement beyond `packages/domain` (this story touches no `packages/domain` code).
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted: Gate 1/3 sourced from the swept `epic-3-readiness.md` plus this story's own lightweight-guard correction to Story 0.13 (both applied directly, no new prerequisite story needed); Gate 2 run fresh, no split needed.
- [ ] Explicit human approval state (Default: **pending approval**).

## Testing Requirements

- [ ] Backend integration tests (`api-keys.test.ts`): scoping, masking, active-only filtering, provider validation, encryption call (mocked), soft-delete state-transition enforcement, cross-user isolation.
- [ ] Frontend integration tests (`api-keys-content.test.tsx`, `api-key-form-dialog.test.tsx`): masked list render, add happy/unhappy paths, revoke immediate-commit/grey-out/undo/expire behavior.
- [ ] E2E: not required as a dedicated flow per `project-context.md`'s testing-trophy philosophy (this is not one of the PRD's headline critical user flows) — integration coverage above satisfies the Definition of Done.

## Deliverables Checklist

- [ ] `api_keys` migration: `key_last4` column + hand-edited partial active-rows index.
- [ ] `myApiKeys` / `createApiKey` / `deleteApiKey` GraphQL schema + resolvers, fully tested.
- [ ] `/settings/api-keys` route: list (masked, skeleton/error states), add modal, revoke-with-undo.
- [ ] `Table`/`Select` shadcn primitives added to `apps/web/src/components/ui/`.
- [ ] `ApiKeysSettingsPage` + `Metadata` i18n keys in both `en.json` and `id.json`.
- [ ] `api_key_added`/`api_key_revoked` PostHog events wired.
- [ ] Story 0.13's `fetchCandidateKeys` amendment (activeOnly filter) verified present if/when Story 0.13 is implemented.

## Out of Scope

- Multi-provider support beyond Gemini — the UX scenario's "Provider" dropdown is rendered as a single, non-editable Gemini option; no other provider is wired anywhere in this codebase.
- Nav/menu wiring linking to `/settings/api-keys` from the profile menu or a `/settings` index page — no such index page or menu link exists yet for the sibling `/settings/locations`/`/settings/notifications` pages either (confirmed via repo-wide search during story creation); consistent with that existing precedent, this story does not add one either.
- Provisioning the real AWS KMS key — Story 0.14 (`ready-for-dev`, not yet implemented); this story's KMS integration is lazily initialized and unverified against a real key until 0.14 lands, mirroring Story 0.13's own accepted deferral.
- API key quota/usage display (remaining quota, usage count) — Story 3.9 ("Implement API key quota management", `backlog`).
- Editing an existing key's value (only add/revoke are supported; to change a key, revoke the old one and add a new one) — not named anywhere in epics.md's AC or the UX scenario doc.

## Definition of Done

- [ ] AC1-11 satisfied and demonstrated via the tests in Testing Requirements.
- [ ] Backend and frontend integration test suites pass; no regression in existing suites.
- [ ] `pnpm build` and `pnpm lint` clean for all touched packages.
- [ ] Migration applied cleanly against local Postgres with the partial index's `WHERE` clause verified present.
- [ ] `en.json`/`id.json` both updated — no hardcoded user-facing strings.

## Completion Status

- [x] Complete

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
