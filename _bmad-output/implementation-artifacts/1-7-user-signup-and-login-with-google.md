# Story 1.7: User Signup and Login with Google

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a new user,
I want to be able to sign up and log in using my Google account,
so that I can easily and securely access the application.

## Acceptance Criteria

1. **Given** I am on the login page, **When** I click the "Sign in with Google" button, **Then** I am redirected to the Google authentication page.
2. **And** after successful authentication, a new user account is created in the system if it doesn't exist.
3. **And** I am logged in to the application.
4. **And** I am redirected to the main page.
5. **And** localized user-facing auth text is rendered via `next-intl`.
6. **And** app data access after authentication remains GraphQL/Drizzle-based; Supabase Auth is used for identity/session only.
7. **And** session persistence across reloads is supported, with explicit logout behavior that clears session state and redirects as defined.
8. **And** first-login user provisioning is idempotent and does not create duplicate user records.

## Tasks / Subtasks

- [ ] Task 1: Setup Authentication Provider (AC: 1, 2)
  - [ ] Configure Supabase Auth for Google OAuth provider.
  - [ ] Set up environment variables for Google Client ID and Secret.
- [ ] Task 2: Create Login Page UI (AC: 1)
  - [ ] Create the `/login` route in the Next.js application.
  - [ ] Implement the "Sign in with Google" UI.
- [ ] Task 3: Implement Auth Flow (AC: 2, 3, 4, 7, 8)
  - [ ] Integrate Supabase auth client on the frontend to handle the Google sign-in.
  - [ ] Handle auth state changes and redirect the user to the main page upon successful authentication.
  - [ ] Ensure user record is synced or created in the `users` table upon first login with idempotent upsert behavior.
- [ ] Task 4: Enforce Data Access Boundaries (AC: 6)
  - [ ] Confirm no app domain data reads/writes are performed through Supabase client APIs.
  - [ ] Keep application data operations behind GraphQL resolvers backed by Drizzle.
- [ ] Task 5: Tests and Localization (AC: 5, 7, 8)
  - [ ] Add tests for auth callback success and idempotent user provisioning.
  - [ ] Verify localized auth microcopy and logout flow behavior.

## Dev Notes

- **UI Components (Loaders):** Create a reusable `BlockingLoader` component (full-screen semi-transparent overlay) inside `packages/ui` to use during the authentication redirect/processing.

- **UI Components:** This story requires creating a "Sign in with Google" button and standard login page layout. **Because this story requires UI components that should be reusable, these components must be created inside `packages/ui`** as per project rules.
- **Domain Logic:** Keep only framework-agnostic auth business rules/contracts in `packages/domain` (if needed). Do not place Supabase/browser SDK client code in `packages/domain`.
- **External Services:** Because this story requires a cloud or external service to be setup (Google OAuth / Supabase Auth), it will include updating steps in SETUP_WALKTHROUGH.md.
- **Analytics:** Because this story requires tracking user interactions or adding user-analytics, explicitly include adding PostHog analytics actions. Track a "User Signup" or "User Login" event and ensure you call `posthog.identify()` with the user's ID after successful authentication.
- **Relevant architecture patterns and constraints:**
  - Supabase is used as the backend. Use Supabase Auth for handling Google OAuth.
  - Ensure any new environment variables (e.g. Supabase Auth, Google OAuth credentials) are securely documented in `.env` instructions.
  - Use Shadcn/UI for any base UI components needed.

### Project Structure Notes

- Pure, framework-agnostic authentication rules and interfaces may be placed in `packages/domain/auth`.
- Supabase auth client integration, callback handling, and browser/session plumbing must live in `apps/web` (or infrastructure-facing app layer), not in `packages/domain`.
- The `packages/ui` workspace should be used for the Google Login button and associated UI components (e.g., `packages/ui/src/features/auth/GoogleLoginButton.tsx`).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 1.7`]
- [Source: `_bmad-output/project-context.md`]

## Testing Requirements
- Add integration tests for first-login provisioning idempotency.
- Add flow tests for login success redirect and logout/session-clear behavior.
- Verify localized strings are rendered on auth screens.

## Deliverables Checklist
- Google OAuth login route and UI.
- Auth callback and session persistence behavior.
- Idempotent user provisioning path.
- Explicit data-access boundary checks (GraphQL/Drizzle for app data).
- Tests covering auth success, provisioning idempotency, and logout.

## Out of Scope
- Role/permission administration.
- Non-Google auth providers.

## Definition of Done
- Login and logout behaviors satisfy AC.
- User provisioning is idempotent.
- Data-access boundary is respected (identity via Supabase Auth; app data via GraphQL/Drizzle).
- Lint and type checks pass for touched packages.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List