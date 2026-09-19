---
baseline_commit: b9d8f1fa6f9b471547a869aafdab3f283be8b72f
---

# Story 0.39: Build an ambient, consent-aware viewer-location capability

## Story Details

- Epic: 0
- Story ID: 0.39
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

<!--
Standalone Epic 0 story with its own epics.md section (Story 0.39, added 2026-09-17 via a
Gate 3 finding while drafting Story 1.i1f -- Architecture Spine AD-22's distance-priority
rule never designed how its "else, the viewer's current location" branch sources a
coordinate passively). A dedicated bmad-ux pass (2026-09-18, one day after this story's
epics.md section was written) fully designed the consent-banner UX for this capability --
see EXPERIENCE.md "Ambient Viewer-Location Consent" and DESIGN.md's ambient_location_banner
token -- resolving this story's own originally-open "explicit, documented policy for when
it may prompt" design question. This story's scope was widened during bmad-create-story
drafting (2026-09-19) to implement that full design, not just the bare coordinate-source
hook, per user confirmation (AskUserQuestion) after a Gate 2 finding.

DEPENDS ON Story 0.42 (`0-42-build-the-shared-ambient-capability-ask-banner-slot-primitive`,
split off THIS story's own drafting via Gate 2 -- see Architecture & UX Gate Findings
below): the generic priority-ordered, one-banner-at-a-time "Ambient Capability Ask" slot
mechanism (shared with Story 0.38's PWA install banner) does not exist anywhere yet, and
this story's own banner mounts into it rather than building a bespoke mount point. Tasks 1-4
(store, permission gating, storage helpers, 3-consumer migration) have no dependency on
0.42 and may be implemented first/in parallel; Task 5 (mounting the banner into the slot)
requires 0.42 to be done first. Story 0.38 was separately amended (2026-09-19) to consume
the same 0.42 slot instead of its own original bespoke-mount plan.
-->

## Story

As a developer building "distance from me" features across FestDaily (starting with the
nearby-distance badge on `EventCard`/the desktop calendar grid card, Story 1.i1f, which
today only implements the "active filter location" branch and omits itself otherwise),
I want one shared, app-level way to obtain the viewer's current geographic coordinate --
passively when the browser has already granted permission, and via a consent-aware ambient
banner when it hasn't -- with an explicit, designed policy for permission-prompt timing,
dismiss/cooldown state, and coordinate caching,
so that a page can consume "the viewer's current coordinate, if available and permitted"
without itself deciding consent timing, and so the three existing explicit "use my current
location" entry points stop each holding their own local, remount-resetting copy of the
same underlying browser capability.

## Acceptance Criteria

### Shared coordinate store and two-layer permission gating

1.  **Given** no global/app-shell "viewer location" context, provider, or persisted state
    exists anywhere in this codebase today (confirmed: only the imperative, one-shot
    `useCurrentLocationCapture()` wrapper around `navigator.geolocation.getCurrentPosition`,
    called independently by three explicit-action call sites: `use-nearby-filter.ts`'s
    "current location" dropdown mode, `set-default-location-dialog.tsx`, and
    `location-form-dialog.tsx` -- each keeping its own local `useState` coordinate that
    resets on every remount),
    **when** this story ships,
    **then** a new `apps/web`-only Zustand store (`apps/web/src/lib/state/viewer-location-store.ts`,
    `useViewerLocationStore`, interface-driven per AD-4 rule 3, mirroring Story 0.38a's
    `pwa-install-store.ts` shape/doc-comment style) holds: the last-captured
    `{ latitude, longitude }` coordinate (or `null`), its capture timestamp, and the
    browser's current `navigator.permissions` geolocation status
    (`'granted' | 'denied' | 'prompt' | 'unsupported'`) -- in-memory only, never persisted
    to `localStorage` (matching EXPERIENCE.md's "capture once per session" framing: a hard
    reload/new tab starts fresh).
2.  **Given** the store in AC1, **when** a new composed hook
    (`apps/web/src/lib/hooks/useViewerLocation.ts`, `useViewerLocation()`) is first used
    anywhere in the app, **then** it queries `navigator.permissions.query({ name:
    'geolocation' })` **exactly once** (module-level guard against duplicate queries across
    repeated hook calls/re-renders, mirroring Story 0.38a's `beforeinstallprompt`
    listener-guard pattern) and subscribes to that `PermissionStatus`'s own `change` event
    so the store's `permissionStatus` stays reactive to a later browser-level grant/revoke
    (e.g. via browser settings) without polling. If `navigator.permissions` is unavailable,
    or `.query({name:'geolocation'})` throws (some older Safari versions reject unsupported
    permission names), the status degrades to `'unsupported'` rather than throwing --
    treated identically to `'prompt'` for ask-eligibility purposes (AC5), since the real
    `getCurrentPosition` call remains the authoritative fallback signal either way.
3.  **Given** `permissionStatus === 'granted'` (the user said yes via any of the three
    existing explicit flows, or a prior ambient ask), **when** `useViewerLocation()` is
    first used in a session and no coordinate is cached yet, **then** it silently calls the
    existing `useCurrentLocationCapture()`'s capture path in the background (no banner,
    nothing to ask -- the capability is already available) and stores the result; a
    consumer reading `coordinate` before this resolves simply sees `null` (no loading state
    is exposed for the ambient path -- a consumer that needs a real coordinate reads
    `coordinate`, and if it is `null`, degrades to "no viewer coordinate," exactly like a
    denied/unavailable outcome, per epics.md's original AC).
4.  **Given** `permissionStatus === 'denied'`, **when** any part of the app calls
    `useViewerLocation()`, **then** `coordinate` is and remains `null`, `canShowAmbientAsk`
    (AC5) is permanently `false`, and no ambient banner is ever offered -- this is a real,
    web-verified browser fact (a real denial can never be re-prompted by any site), not a
    dismiss state this story tracks itself; distance-dependent features silently omit
    themselves, mirroring the nearby badge's existing "omit entirely, no placeholder"
    convention.
5.  **Given** `permissionStatus === 'prompt'` or `'unsupported'` (AC2), **when**
    `useViewerLocation()` computes `canShowAmbientAsk`, **then** it is `true` only when
    additionally: (a) this story's own dismiss state (AC9) is not active (not permanently
    dismissed, not in cooldown), matching Story 0.38a's `pwa-install-storage.ts` precedent
    exactly (own separate `localStorage` keys, own independent cooldown timer -- **not**
    Story 0.42's shared cross-slot session-gate, which is a distinct, separate flag owned
    entirely by that story; see Dev Notes' Gate 3 note). Whether it actually renders is
    Story 0.42's own further gating (priority + one-at-a-time + this-session-already-shown)
    -- `canShowAmbientAsk` only reports this capability's own eligibility as a participant,
    exactly the shape Story 0.42's `useAmbientCapabilityAskSlot()` expects (`{ id:
    'location', canShow }`).

### Ambient consent banner

6.  **Given** `canShowAmbientAsk` is `true` and Story 0.42's slot selects `'location'` as
    the winning participant, **when** `AppShellWrapper.tsx` renders the resolved banner,
    **then** a new presentational `AmbientLocationBanner` component
    (`packages/ui/src/core/AmbientLocationBanner.tsx`, a `core/` primitive per this
    codebase's established placement convention, props-only -- no `next-intl`/`zustand`
    import, matching `PwaInstallBanner`'s pattern) implements DESIGN.md's
    `ambient_location_banner` tokens exactly: `base` imported from Story 0.42's shared
    `ambient-capability-banner-tokens.ts` (not hardcoded), a primary action button
    (`primary_action`, `{components.button.primary}`, labeled "Enable nearby distances" --
    exact copy confirmed against the `en.json`/`id.json` keys this story adds, DESIGN.md's
    own "exact copy TBD at implementation" note resolved here), then the permanent "Not
    now" button (`dismiss_permanent`, same shared-token import as `PwaInstallBanner`) and
    the lower-weight "Remind me in 2 weeks" link (`dismiss_cooldown`, same shared-token
    import) -- reusing the identical shared chrome/button-order convention Story 0.42/0.38
    establish, not a bespoke layout.
7.  **Given** the banner's primary action is clicked, **when** it calls
    `useViewerLocation()`'s explicit capture path (AC8) -- the moment that actually
    triggers the browser's own native geolocation permission dialog for the first time --
    **then** the button enters a disabled, pending visual state (mirroring this design
    system's existing primary-button pending-state treatment used elsewhere in the app;
    confirm the exact pending visual against a current live instance at implementation
    time, same caveat pattern already used elsewhere in this codebase for
    to-be-confirmed-at-implementation icon/visual details) until the browser's permission
    decision resolves, and the banner unmounts itself entirely as soon as
    `permissionStatus` leaves `'prompt'`/`'unsupported'` (i.e. becomes `'granted'` or
    `'denied'`) -- **not** a bespoke in-banner error/success state, since a resolved
    permission status already removes this participant from Story 0.42's slot via
    `canShowAmbientAsk` turning `false`.
8.  **Given** the banner's two dismiss actions, **when** "Not now" or "Remind me in 2
    weeks" is clicked, **then** the handler calls **both** this story's own persisted
    dismissal (AC9's `dismissPermanently()`/`remindLater()`) **and** Story 0.42's shared
    `markDismissedThisSession()` action (required so the slot doesn't immediately reveal a
    different eligible ask -- e.g. the PWA install banner -- in the same session, per
    EXPERIENCE.md's explicit "dismissing an ask ends the slot's activity for that session"
    rule) -- mirroring the identical dual-call pattern Story 0.38's own amended AC11 now
    uses for its dismiss actions.
9.  **Given** a user calls `dismissPermanently()` ("Not now"), **when** the ask is later
    re-evaluated (same browser, same or a later session), **then** `canShowAmbientAsk`
    returns `false` unconditionally from then on, persisted via a `localStorage` key
    (`festdaily_viewer_location_dismissed = 'true'`) checked before any other eligibility
    computation -- survives a full reload, mirroring Story 0.38a's AC6 exactly. **Given** a
    user calls `remindLater()` ("Remind me in 2 weeks"), **when** the ask is later
    re-evaluated, **then** `canShowAmbientAsk` returns `false` until exactly 14 days have
    elapsed, persisted via `festdaily_viewer_location_remind_at` (an ISO-8601 expiry
    timestamp, not the click time) -- the identical 14-day duration Story 0.38a's PWA ask
    uses, per EXPERIENCE.md's explicit "no signal this capability needs a different
    window" note. Both actions are independent (calling one does not affect the other's own
    stored state), mirroring Story 0.38a's AC8. `localStorage` read/write failures degrade
    gracefully (treat as "not dismissed, not cooling down" on read failure; silent no-op on
    write failure), mirroring Story 0.38a's AC9 and this project's existing
    degrade-gracefully convention.

### Explicit capture and the three migrated consumers

10. **Given** `useViewerLocation()` exposes **two** distinct capture entry points --
    `captureAmbient()` (used internally by AC3's silent-when-granted path; returns the
    cached session coordinate if one already exists, never forces a fresh
    `getCurrentPosition` call) and `captureExplicit()` (always calls the real
    `useCurrentLocationCapture().capture()` unconditionally, regardless of any cached
    value, then updates the shared store's coordinate/timestamp so later ambient readers
    benefit from the fresher value too) -- **when** a user clicks any of the three existing
    "use my current location" entry points, **then** each calls `captureExplicit()`, not
    `captureAmbient()` -- a user who explicitly asks "use my location right now" must
    always get a fresh read, never a possibly-stale cached one from earlier in the session
    (a genuine correctness fix Gate 2 surfaced: naively wiring all three consumers onto a
    cached ambient read would make them silently stale/no-op for a user who has moved since
    the session's first capture).
11. **Given** the three existing consumers (`apps/web/src/app/[locale]/use-nearby-filter.ts`'s
    `handleSelectLocation`'s `"current"` branch, `set-default-location-dialog.tsx`'s
    `handleUseCurrentLocation`, `location-form-dialog.tsx`'s `handleUseCurrentLocation`),
    **when** this story ships, **then** each is migrated from its own local
    `useCurrentLocationCapture()` hook instantiation to `useViewerLocation()`'s
    `captureExplicit()` -- **their own UI (dropdown option, form buttons), local error
    handling (`GeolocationCaptureError` branching), and existing PostHog
    analytics/i18n-key usage are unchanged**, per EXPERIENCE.md's explicit "this pass does
    not redesign the nearby-filter dropdown or either location-picker dialog; it only
    redirects what they read from and write to" rule -- `captureExplicit()` preserves the
    exact same resolve/reject contract (`{ latitude, longitude }` / a
    `GeolocationCaptureError`-typed rejection) `useCurrentLocationCapture().capture()`
    already has, so each consumer's existing `try { await capture() } catch (err)` logic
    needs only its import/hook-call swapped, not rewritten.
12. **Given** the migration in AC11, **when** one entry point (e.g. the nearby filter)
    successfully captures a coordinate, **then** it is immediately available to
    `useViewerLocation()`'s shared store for the other two entry points (e.g. a
    location-picker form opened right after) -- fixing the pre-existing `adHocCoords`
    resets-on-remount duplication as a side effect of the migration, per EXPERIENCE.md's
    explicit callout, without this story needing its own dedicated bugfix AC.

### Layering, analytics, i18n

13. **Given** this codebase's `packages/ui` must stay framework-agnostic and importable by
    contexts that don't hold `apps/web`'s Zustand store, **when** `AmbientLocationBanner`
    is implemented, **then** it receives `platform`-equivalent state as plain props only
    (no `useViewerLocation()`/Zustand import inside `packages/ui`) -- `AppShellWrapper.tsx`
    is the sole owner of calling `useViewerLocation()` and Story 0.42's slot hook, wiring
    `onEnableClick`/`onDismissPermanent`/`onRemindLater` down as callbacks, mirroring the
    existing `AppShell`/`AppShellWrapper` split `PwaInstallBanner` already established.
14. **Given** AD-5's "any story introducing user-trackable interactions must explicitly
    list the new event name(s) and payload shape" rule, **when** a user interacts with this
    feature, **then** the following new events are captured via `@festgrid/analytics`'s
    existing `capturePostHogEvent`/`usePostHog().capture()` helper (never the PostHog SDK
    directly), `noun_verb` naming per AD-5 rule 1:
    - `viewer_location_ambient_banner_shown` -- fired once when the banner first becomes
      visible for a session (no payload beyond PostHog's implicit page context).
    - `viewer_location_ambient_consent_resolved` -- `{ outcome: 'granted' | 'denied' }`,
      fired once the primary action's triggered browser permission dialog resolves.
    - `viewer_location_ambient_dismissed_permanent` -- fired on "Not now".
    - `viewer_location_ambient_dismissed_cooldown` -- fired on "Remind me in 2 weeks".
    The three existing explicit-consumer entry points' own analytics (`nearby_filter_applied`,
    `nearby_geolocation_denied`, `subscription_default_location_set/edited`) are unchanged
    by this story (AC11).
15. **Given** AD-6's rule that any story introducing user-facing text must add message keys
    for all supported locales, **when** this story ships, **then** a new
    `AmbientLocationBanner` namespace (mirroring `PwaInstallPrompt`'s flat-key style from
    Story 0.38) is added to **both** `apps/web/locales/en.json` and
    `apps/web/locales/id.json` with keys for: the banner's message copy, `enableButtonLabel`
    ("Enable nearby distances"), `notNowButtonLabel` ("Not now"),
    `remindLaterButtonLabel` ("Remind me in 2 weeks"). No key is added to only one locale
    file.

## Tasks / Subtasks

- [ ] Task 1: Viewer-location Zustand store and permission-status tracking (AC: #1, #2)
  - [ ] 1.1 Create `apps/web/src/lib/state/viewer-location-store.ts` exporting
        `useViewerLocationStore` (AD-4-compliant interface: `{ coordinate:
        {latitude,longitude} | null; capturedAt: number | null; permissionStatus:
        'granted' | 'denied' | 'prompt' | 'unsupported'; setCoordinate: (...) => void;
        setPermissionStatus: (...) => void }`)
  - [ ] 1.2 Create `apps/web/src/lib/location/query-geolocation-permission.ts` exporting
        `queryGeolocationPermissionStatus()` -- wraps `navigator.permissions.query({name:
        'geolocation'})`, degrades to `'unsupported'` on throw/unavailable, and a
        `subscribeToGeolocationPermissionChanges(onChange)` helper wiring the returned
        `PermissionStatus`'s `change` event
  - [ ] 1.3 Add a module-level guard so the permission query + change-subscription happens
        at most once regardless of how many components call `useViewerLocation()` (Task 3)
  - [ ] 1.4 Add `query-geolocation-permission.test.ts`: covers granted/denied/prompt
        results, the unsupported/throw degrade path, and the change-event subscription
        firing a store update
- [ ] Task 2: Dismiss/cooldown localStorage helpers (AC: #9)
  - [ ] 2.1 Create `apps/web/src/lib/location/viewer-location-storage.ts` exporting
        `isPermanentlyDismissed()`, `dismissPermanently()`, `getRemindCooldownExpiry()`,
        `startRemindCooldown()` -- each wrapped in try/catch degrading per AC9, mirroring
        Story 0.38a's `pwa-install-storage.ts` structure exactly (same function shapes,
        same degrade contract)
  - [ ] 2.2 Add `viewer-location-storage.test.ts` covering every AC9 branch including the
        storage-throws degrade path via a mocked `localStorage` that throws
- [ ] Task 3: The composed `useViewerLocation()` hook (AC: #3, #4, #5, #10)
  - [ ] 3.1 Create `apps/web/src/lib/hooks/useViewerLocation.ts` composing Tasks 1-2 plus
        the existing `useCurrentLocationCapture()` (`@festgrid/ui`) into: `coordinate`,
        `permissionStatus`, `canShowAmbientAsk`, `captureAmbient()`, `captureExplicit()`,
        `dismissPermanently()`, `remindLater()`
  - [ ] 3.2 Implement AC3's silent-capture-when-granted path (`captureAmbient()` internal
        use) and AC10's `captureExplicit()` contract (always forces a fresh
        `getCurrentPosition` call, updates the shared store)
  - [ ] 3.3 Add `useViewerLocation.test.ts` using `@testing-library/react`'s `renderHook`
        (+ `act`), per this codebase's existing hook-testing convention (see
        `useCurrentLocationCapture.test.ts`, `usePwaInstallPrompt.test.ts`): cover
        granted/denied/prompt/unsupported branches, `captureAmbient()` vs
        `captureExplicit()`'s distinct cache-bypass behavior, and dismiss/cooldown wiring
- [ ] Task 4: Migrate the three existing consumers (AC: #10, #11, #12)
  - [ ] 4.1 `apps/web/src/app/[locale]/use-nearby-filter.ts`: replace the local
        `useCurrentLocationCapture()` call with `useViewerLocation()`'s `captureExplicit`
        in `handleSelectLocation`'s `"current"` branch; remove or reconcile the now-partly-
        redundant local `adHocCoords` state with the shared store per AC12 (confirm at
        implementation time whether `adHocCoords` can be fully removed in favor of reading
        `useViewerLocation().coordinate`, or must stay as this hook's own
        `nuqs`/URL-state-adjacent snapshot -- do not silently change `resolvedFilter`'s
        existing DSL-shape output)
  - [ ] 4.2 `set-default-location-dialog.tsx`: swap `useCurrentLocationCapture()` for
        `useViewerLocation()`'s `captureExplicit`; update
        `set-default-location-dialog.test.tsx`'s mock from `@festgrid/ui`'s
        `useCurrentLocationCapture` to the new `apps/web/src/lib/hooks/useViewerLocation`
        module
  - [ ] 4.3 `location-form-dialog.tsx`: same swap; update
        `location-form-dialog.test.tsx`'s mock identically
  - [ ] 4.4 Re-run all three consumers' existing test suites, confirming zero behavioral
        regression (same error branching, same disabled-state logic, same analytics calls)
- [ ] Task 5: `AmbientLocationBanner` component and slot wiring (AC: #6, #7, #8, #13) --
      **depends on Story 0.42 being done**
  - [ ] 5.1 Create `packages/ui/src/core/AmbientLocationBanner.tsx` implementing
        `ambient_location_banner` DESIGN.md tokens via Story 0.42's shared
        `ambient-capability-banner-tokens.ts`; props-only (`onEnableClick`,
        `onDismissPermanent`, `onRemindLater`, `isPending`, copy strings)
  - [ ] 5.2 Add `AmbientLocationBanner.test.tsx`: renders with correct button
        labels/order; each callback fires on its respective control; pending state
        disables the primary action; hidden entirely when not rendered by the parent
        (presentational only, per AC7)
  - [ ] 5.3 Wire `AppShellWrapper.tsx`: call `useViewerLocation()`, register `{ id:
        'location', canShow: canShowAmbientAsk }` with Story 0.42's
        `useAmbientCapabilityAskSlot()` at higher priority than the `'pwa-install'`
        participant (Story 0.38), and render `AmbientLocationBanner` when `'location'`
        wins, wiring `onEnableClick`→`captureExplicit()` (unmount handled by AC7's
        `permissionStatus` transition, not by this callback), `onDismissPermanent`/
        `onRemindLater`→the dual-call pattern from AC8
- [ ] Task 6: Analytics (AC: #14)
  - [ ] 6.1 Add the four new `capturePostHogEvent`/`posthog.capture` call sites listed in
        AC14 at the correct interaction points in `AppShellWrapper.tsx`
- [ ] Task 7: i18n (AC: #15)
  - [ ] 7.1 Add the new `AmbientLocationBanner` namespace with all required keys to both
        `apps/web/locales/en.json` and `apps/web/locales/id.json`
- [ ] Task 8: Full-suite verification (AC: #1-#15)
  - [ ] 8.1 Run `pnpm --filter web test` and `pnpm --filter ui test`; confirm no regression,
        including the three migrated consumers' existing suites (Task 4.4)
  - [ ] 8.2 Run `pnpm lint` and typecheck clean across `web`/`ui`
  - [ ] 8.3 Run `pnpm build` and confirm no build-time errors

## Dev Notes

- **Hard dependency on Story 0.42** for Task 5 only. Tasks 1-4 (store, permission gating,
  storage helpers, the composed hook, and all three consumer migrations) have zero
  dependency on 0.42 and should be implemented and merged first -- they are independently
  valuable (the `adHocCoords`-reset bug fix alone, AC12) even before any banner exists.
- **This story widened its own scope during drafting** (2026-09-19, via `AskUserQuestion`)
  from epics.md's original, narrower "just a coordinate-source hook" framing to the full
  EXPERIENCE.md/DESIGN.md-designed consent banner, because the UX pass that produced that
  design (2026-09-18) was explicitly done to resolve *this story's own* previously-open
  "explicit, documented policy for when it may prompt" question -- shipping only the hook
  and leaving the now-fully-designed banner for an undefined future story would leave that
  design question re-open in practice. See epics.md Story 0.42's own Note for the full
  three-way split rationale (0.42 = generic slot; 0.38 = PWA participant, amended; 0.39 =
  location participant, this story).
- **`captureAmbient()` vs `captureExplicit()` is a load-bearing distinction (Gate 2
  finding), not a naming nicety.** A consumer that wants "whatever we already know, don't
  bother the user again" (the ambient silent-capture-when-granted path, AC3) must use
  `captureAmbient()`; a consumer behind an explicit "use my current location" click (the
  three migrated consumers, AC10) must use `captureExplicit()`, which always forces a real
  `getCurrentPosition` call. Wiring an explicit-action button to the cached ambient value
  would silently return a stale coordinate to a user who has physically moved since the
  session's first capture -- confirmed as a real correctness gap by Gate 2's own review of
  this draft, not by the original epics.md AC text.
- **Gate 3's boundary note (see Architecture & UX Gate Findings) is a hard rule, not a
  suggestion:** this story's own `localStorage` dismiss/cooldown state (AC9,
  `viewer-location-storage.ts`) is scoped **only** to whether the *location-specific* ask
  itself is eligible. The cross-participant "one banner at a time, dismissing suppresses
  the slot for the rest of the session" behavior is Story 0.42's own separate, in-memory
  `dismissedThisSession` flag -- this story's dismiss handlers call **both** (AC8), but must
  never attempt to read or reimplement 0.42's session flag itself, or the two stories'
  independently-evolving state will drift and contradict each other.
- **State Management Architecture categorization (required by project convention):** the
  captured coordinate + permission status is **Client Global State (zustand)** -- ephemeral,
  crosses component boundaries (three consumer files + the ambient banner + any future
  distance feature), not server data, not URL-shareable. The dismiss/cooldown values are
  **not** React state of any tier -- direct `localStorage` reads/writes in plain functions,
  matching EXPERIENCE.md's "state lives in browser `localStorage`" framing (mirroring Story
  0.38a's identical categorization for its own dismiss/cooldown state) -- do not route
  either through `@tanstack/react-query` or `nuqs`.
- **Loader categorization:** the banner's primary-action pending state (AC7) is a
  **localized** treatment (a disabled button + inline pending indicator), not a
  Blocking full-screen overlay or a page-level Non-Blocking skeleton -- this is a
  lightweight, already-visible-content interaction confirmation, not an initial data load or
  a destructive/critical mutation, so neither of this project's two loader categories
  applies at the page level; it follows this design system's existing primary-button
  pending-state convention instead (confirm the exact visual against a current live
  instance at implementation time).
- **Package-boundary note:** `queryGeolocationPermissionStatus`/the Zustand store use
  `navigator.permissions`, a browser-only global -- correctly kept `apps/web`-only per
  project-context.md's `packages/domain` DOM-exclusion rule, mirroring Story 0.38a's
  identical `detectInstallPlatform` placement correction. No new correction needed here;
  called out for consistency with that precedent.
- **No cloud/external service setup required** -- `navigator.geolocation`/
  `navigator.permissions`/`localStorage` are native browser APIs with no new third-party
  integration; `SETUP_WALKTHROUGH.md` needs no update.
- **`computeDistanceKm` (AD-22, `packages/domain`) is explicitly out of scope here** -- that
  pure function and its adoption into the nearby badge belong to Story 1.i1f (already
  `ready-for-dev`) and any future consumer of this story's coordinate. This story supplies
  the coordinate *source* only; no existing nearby-badge consumer is retrofitted to read it
  by this story (Story 1.i1f's own badge continues to implement only the "active filter
  location" branch until a separate future story wires this one in -- an accepted,
  documented interim state, not a gap this story must close).

### Architecture & UX Gate Findings

- **Gate 1 — Architecture/Infrastructure Completeness (Winston):** No gap found. All five
  trigger heuristics clear: no database/ORM/domain-package call from the frontend (the only
  `packages/domain` touchpoint, `computeDistanceKm`, is explicitly out of scope, see Dev
  Notes); `navigator.geolocation`/`navigator.permissions`/`localStorage` are user-agent
  APIs, not third-party services requiring `apps/backend` mediation; no new GraphQL
  schema/resolver/mutation (the three migrated consumers keep their existing GraphQL paths
  untouched); no auth/business logic added client-side (the two-layer gate is browser
  consent state, not application authorization); no new infra/IaC. Two constraints carried
  into this story's ACs directly: (a) `packages/ui`'s `AmbientLocationBanner` must stay
  props-only, never importing the `apps/web` store directly (AC13); (b) reverse-geocoding a
  captured coordinate to a place name, if ever needed by a future consumer, is a
  backend-routed call and explicitly out of this story's scope (raw coordinates only).
- **Gate 2 — UI Complexity & Reusability (Freya):** **GAP FOUND** (the shared banner slot;
  already resolved via `AskUserQuestion` before this draft was finalized) -- **split into
  Story 0.42**, mirroring Story 0.38a's precedent for exactly this class of finding (a
  mechanism reused by >=2 structurally independent places, here two different *stories*
  rather than two components within one story). Beyond that already-acted-on split, a
  second Gate 2 pass over this story's *remaining* scope (the location-specific hook,
  banner content, and 3-consumer migration) found **no further split required** -- the
  `AmbientLocationBanner` has exactly one mount point (Story 0.42's slot) and supplies only
  icon/copy/primary-action, below the reuse threshold for its own split; the migration's
  three adopters are zero-UI-change call-site swaps, and keeping the store's build together
  with its first real adopters (rather than shipping it with only a synthetic test
  consumer) is itself the sounder sequencing. Gate 2 did surface two absorbable
  (non-splitting) gaps, both folded directly into this story's ACs rather than deferred:
  (a) explicit-click consumers silently inheriting a stale cached coordinate instead of
  forcing a fresh capture -- resolved via AC10's `captureAmbient()`/`captureExplicit()`
  split; (b) the banner's post-click transient state and exactly when it unmounts were
  unspecified in the original draft -- resolved via AC7.
- **Gate 3 — Foundational/Cross-Cutting Dependency Completeness (Winston):** No gap found.
  This story *is* itself the Epic 0 foundation other future "distance from me" features will
  consume, not a consumer of some other missing foundation. Zustand as the Client Global
  State pattern is already established (three precedents, including Story 0.38a's own
  `pwa-install-store.ts`); the `localStorage` dismiss/cooldown pattern and its
  degrade-gracefully convention are already established (Story 0.38a); i18n/PostHog/GraphQL
  are all consume-only here. AD-22 and project-context.md were both cross-checked directly
  against this story's remaining scope -- nothing referenced there needs a foundation
  beyond what already exists or is already covered by Story 0.42. **One binding boundary
  Gate 3 did flag, carried into AC5/Dev Notes above:** the cross-participant "session-gated
  reveal" state (dismissing any ask suppresses the slot for the rest of that session)
  belongs entirely to Story 0.42's own in-memory flag -- if this story's own dismiss/cooldown
  storage silently duplicated that session-gating logic instead of staying scoped to its
  own ask's eligibility, the two stories' state would drift and eventually contradict each
  other. AC5 and AC8 encode this boundary explicitly so it is not left implicit.
- No `epic-0-readiness.md` sweep citation applies -- that report is scoped only to Stories
  0.1-0.19 (confirmed directly, same gap already noted by Stories 0.34-0.41's own Dev
  Notes). All three gates were run fresh via subagent dispatch for this story's drafting.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** No mismatch -- this story touches no database, no GraphQL
  schema, and no shared cross-package type (`packages/shared-types`). All new types
  (`ViewerLocationState`/`ViewerLocationActions`, the permission-status union, the hook's
  return shape) are `apps/web`-local TypeScript; `AmbientLocationBanner`'s prop interface is
  `packages/ui`-local, matching `PwaInstallBanner`'s existing precedent.
- **Impacted fields/contracts:** None outside `apps/web`/`packages/ui`. This story's own
  `useViewerLocation()` return shape (`coordinate`, `permissionStatus`, `canShowAmbientAsk`,
  `captureAmbient`, `captureExplicit`, `dismissPermanently`, `remindLater`) is the one
  cross-file contract Task 5 and the three migrated consumers depend on -- if it changes,
  update every consumer in the same commit. Story 0.42's `useAmbientCapabilityAskSlot()`
  participant shape (`{ id, canShow }`) is the other cross-story contract this story must
  match exactly, not diverge from.
- **Required DB migration changes:** No changes required.
- **Required TypeScript type changes:** New local interfaces only (enumerated in Tasks
  1-3); no existing type is modified. `GeolocationCaptureError` (already exported from
  `@festgrid/ui`) is reused unchanged by `captureExplicit()`'s rejection contract (AC11) --
  not redefined.
- **Backward compatibility and rollout notes:** Additive for Tasks 1-3/5 (new files only).
  Tasks 4/4.2/4.3 modify three existing, already-shipped files and their test mocks --
  confirmed via AC11 that their public UI/behavior contract is unchanged, only the internal
  hook/import swaps, so no consumer of *those* three files (e.g. any page rendering
  `SetDefaultLocationDialog`) needs any change of its own.
- **Verification checks:** Unit tests per Tasks 1-3 (permission-status matrix, storage
  degrade-on-throw path, `captureAmbient`/`captureExplicit` cache-bypass distinction via
  `renderHook`); component tests for `AmbientLocationBanner` (Task 5.2); the three migrated
  consumers' existing test suites re-run with updated mocks and zero behavioral diff (Task
  4.4); lint + typecheck + build clean.

### Project Structure Notes

- New files: `apps/web/src/lib/state/viewer-location-store.ts` (+ test),
  `apps/web/src/lib/location/query-geolocation-permission.ts` (+ test),
  `apps/web/src/lib/location/viewer-location-storage.ts` (+ test),
  `apps/web/src/lib/hooks/useViewerLocation.ts` (+ test),
  `packages/ui/src/core/AmbientLocationBanner.tsx` (+ test).
  `apps/web/src/lib/hooks/` and `apps/web/src/lib/pwa/`-sibling `apps/web/src/lib/location/`
  both follow the directory convention Story 0.38a already established for this class of
  `apps/web`-only logic module.
- Updated files: `apps/web/src/app/[locale]/use-nearby-filter.ts`,
  `apps/web/src/app/[locale]/settings/account/set-default-location-dialog.tsx` (+ its
  `.test.tsx`), `apps/web/src/app/[locale]/settings/locations/location-form-dialog.tsx` (+
  its `.test.tsx`), `apps/web/src/components/layout/AppShellWrapper.tsx`,
  `apps/web/locales/en.json`, `apps/web/locales/id.json`.
- No conflicts detected against the unified project structure. The one placement question
  (whether `adHocCoords` in `use-nearby-filter.ts` can be fully removed vs. kept as a
  thin local snapshot, Task 4.1) is flagged as an implementation-time confirmation, not a
  structural conflict.

### References

- [Source: _bmad-output/implementation-artifacts/backlog.yaml#IDEA-040]
- [Source: _bmad-output/implementation-artifacts/backlog/IDEA-040-ambient-viewer-location.md]
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-22,#AD-4,#AD-5,#AD-6]
- [Source: design-artifacts/UX-festgrid-run-1/EXPERIENCE.md#Ambient-Viewer-Location-Consent,
  #Ambient-Capability-Ask-Shared-Banner-Slot]
- [Source: design-artifacts/UX-festgrid-run-1/DESIGN.md#ambient_location_banner,
  #ambient_capability_banner]
- [Source: packages/ui/src/hooks/useCurrentLocationCapture.ts,
  useCurrentLocationCapture.test.ts -- existing capture primitive and its test-mocking
  convention, both reused/extended unchanged]
- [Source: apps/web/src/app/[locale]/use-nearby-filter.ts,
  apps/web/src/app/[locale]/settings/account/set-default-location-dialog.tsx(+.test.tsx),
  apps/web/src/app/[locale]/settings/locations/location-form-dialog.tsx(+.test.tsx) --
  the three consumers being migrated]
- [Source: _bmad-output/implementation-artifacts/0-38a-build-the-pwa-install-eligibility-hook.md
  -- direct structural/naming precedent for this story's store/storage/hook split]
- [Source: _bmad-output/implementation-artifacts/0-42-build-the-shared-ambient-capability-ask-banner-slot-primitive.md
  -- hard dependency for Task 5]
- [Source: _bmad-output/project-context.md#State-Management-Architecture,
  #Code-Organization, #UI-Components-and-Scalability]
- [Source: _bmad-output/planning-artifacts/story-split-gate.md]
- [Source: Chrome for Developers, "Permissions API for the Web" -- web-verified
  never-re-prompt-after-denial constraint cited by EXPERIENCE.md]

## Global Rules References

- [ ] `_bmad-output/project-context.md` -- State Management Architecture (Client Global
      State/zustand categorization, `apps/web` isolation), Code Organization
      (`packages/domain` DOM-exclusion, N/A correction confirmed by precedent),
      UI Components & Scalability (`packages/ui/core` placement)
- [ ] `_bmad-output/planning-artifacts/story-content-structure.md` -- this story follows
      its canonical section order and status vocabulary
- [ ] Architecture spine (`_bmad-output/planning-artifacts/festgrid-architecture-spine.md`)
      -- AD-4 (state), AD-5 (analytics), AD-6 (i18n), AD-22 (this story supplies the
      "else" branch's coordinate source that rule's priority list depends on)
- [ ] Infrastructure docs (`docs/infrastructure/index.md`) -- no backend/SQS/Lambda/DB
      change; a pure frontend-state story needs only the index summary

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - New: `apps/web/src/lib/state/viewer-location-store.ts` (+ test),
    `apps/web/src/lib/location/query-geolocation-permission.ts` (+ test),
    `apps/web/src/lib/location/viewer-location-storage.ts` (+ test),
    `apps/web/src/lib/hooks/useViewerLocation.ts` (+ test),
    `packages/ui/src/core/AmbientLocationBanner.tsx` (+ test)
  - Update: `apps/web/src/app/[locale]/use-nearby-filter.ts`,
    `apps/web/src/app/[locale]/settings/account/set-default-location-dialog.tsx` (+ test),
    `apps/web/src/app/[locale]/settings/locations/location-form-dialog.tsx` (+ test),
    `apps/web/src/components/layout/AppShellWrapper.tsx`, `apps/web/locales/en.json`,
    `apps/web/locales/id.json`
- **Rule Mapping:**
  - Zustand store confined to `apps/web/src/lib/state/`, interface-driven → AD-4 rule 3 +
    project-context.md's package-dependency isolation rule (mirrors Story 0.38a).
  - `queryGeolocationPermissionStatus` kept out of `packages/domain` → the same DOM-global
    exclusion Story 0.38a's `detectInstallPlatform` correction already established.
  - `AmbientLocationBanner` in `packages/ui/src/core/`, props-only → project-context.md's
    UI-reusability rule + Gate 1's layering constraint (AC13).
  - Dismiss/cooldown as raw `localStorage`, not React Query/nuqs → EXPERIENCE.md's
    per-device state rule, mirroring Story 0.38a's identical categorization.
  - `captureAmbient()`/`captureExplicit()` split → Gate 2's correctness finding (AC10).
  - This story's dismiss storage scoped to its own ask only, never Story 0.42's session
    flag → Gate 3's boundary finding (AC5, AC8).
  - New PostHog events via `capturePostHogEvent`/`usePostHog()` only, `noun_verb` naming →
    AD-5.
  - New locale keys added to both `en.json` and `id.json` in the same commit → AD-6 rule 3.
- **Verification Plan:**
  - `query-geolocation-permission.test.ts`, `viewer-location-storage.test.ts`,
    `useViewerLocation.test.ts` (full permission-status matrix, cache-bypass distinction,
    dismiss/cooldown, degrade-on-throw paths).
  - `AmbientLocationBanner.test.tsx` (button order/labels, callback wiring, pending state,
    parent-controlled visibility).
  - `set-default-location-dialog.test.tsx`/`location-form-dialog.test.tsx` re-run with
    updated mocks, zero behavioral diff.
  - `pnpm --filter web test`, `pnpm --filter ui test`, `pnpm lint`, `pnpm build` all green.

## Pre-Coding Approval Gate

- [ ] Scope confirmation -- shared coordinate store + two-layer permission gating +
      ambient consent banner + 3-consumer migration (EXPERIENCE.md "Ambient
      Viewer-Location Consent"), explicitly excluding `computeDistanceKm`/nearby-badge
      adoption (Story 1.i1f's own scope) and reverse-geocoding (Gate 1, out of scope
      entirely).
- [ ] Architecture and boundary confirmation -- Gate 1/3 returned "No gap found" (two
      layering/scope constraints folded into ACs 13 and Dev Notes); Gate 2 returned "Gap
      found" for the shared slot (already resolved via `AskUserQuestion`, split into Story
      0.42) plus two absorbable correctness gaps folded into AC7/AC10 -- see Architecture &
      UX Gate Findings.
- [ ] Testing plan confirmation -- unit tests (store/storage/hook), component tests
      (`AmbientLocationBanner`), and the three migrated consumers' existing suites re-run,
      all agreed per Testing Requirements below.
- [ ] Explicit human approval state -- **pending approval.**
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted -- **Story 0.42 must be
      `done` before Task 5 begins.** Tasks 1-4 have no such prerequisite and may proceed
      immediately. Confirm 0.42's status before starting implementation past Task 4.

## Testing Requirements

- [ ] Unit tests: `query-geolocation-permission.test.ts` (permission-status matrix +
      unsupported/throw degrade + change-event subscription), `viewer-location-storage.test.ts`
      (dismiss/cooldown + throw-degrade), `useViewerLocation.test.ts` (composed behavior via
      `renderHook`, incl. `captureAmbient`/`captureExplicit` cache-bypass distinction and
      fake-timers cooldown expiry)
- [ ] Integration tests: `set-default-location-dialog.test.tsx`/`location-form-dialog.test.tsx`
      re-extended with the new mock target, confirming zero behavioral regression (Task 4.4)
- [ ] Component tests: `AmbientLocationBanner.test.tsx`
- [ ] E2E tests: none new -- no route/page is newly introduced by this story; the banner's
      real end-to-end mount is proven at the integration level via Story 0.42's own
      `AppShellWrapper.tsx` wiring test plus this story's component tests

## Deliverables Checklist

- [ ] `viewer-location-store.ts` (Zustand store, AD-4-compliant) implemented and tested
- [ ] `query-geolocation-permission.ts` implemented with full status-matrix + degrade-path
      test coverage
- [ ] `viewer-location-storage.ts` (dismiss/cooldown helpers) implemented and tested,
      including a throwing-`localStorage` degrade path
- [ ] `useViewerLocation.ts` composed hook implemented, matching this story's exact
      documented public surface, with `renderHook`-based tests
- [ ] `AmbientLocationBanner.tsx` implemented per DESIGN.md tokens (via Story 0.42's shared
      constants) and wired into `AppShellWrapper.tsx`/Story 0.42's slot
- [ ] All three existing consumers migrated with zero behavioral regression, own test
      suites green with updated mocks
- [ ] Four new PostHog events wired at the correct interaction points
- [ ] New `AmbientLocationBanner` locale namespace added to both `en.json`/`id.json`
- [ ] All new/extended tests passing; lint, typecheck, and build clean

## Out of Scope

- Any existing nearby-badge consumer (Story 1.i1f's `EventCard`/calendar-grid-item badge,
  or any future one) being retrofitted to actually read this story's `coordinate` -- that
  adoption is separate future work; this story ships only the coordinate source.
- `computeDistanceKm` (`packages/domain`, AD-22) itself -- decided and scoped to Story
  1.i1f, not built or touched here.
- Reverse-geocoding a captured coordinate to a place name for any consumer -- a
  backend-routed call per Gate 1, out of scope entirely (not deferred).
- Story 0.42's own generic slot/orchestration mechanism, `ambient-capability-banner-tokens.ts`,
  and its `useAmbientCapabilityAskSlot()` hook -- built in that prerequisite story, only
  consumed here.
- Story 0.38's PWA install banner and its own participant registration -- that story's own
  scope (amended separately, 2026-09-19, to also depend on Story 0.42).
- Any redesign of the three migrated consumers' own UI, error copy, or analytics -- AC11
  explicitly preserves them unchanged; only the state source moves.

## Definition of Done

- [ ] AC1-AC15 satisfied
- [ ] Story 0.42 is `done` before this story's Task 5 was implemented
- [ ] Required unit/component tests passing (store, storage, hook, banner, migrated
      consumers)
- [ ] Lint and type checks passing for the `web` and `ui` packages
- [ ] `pnpm build` succeeds

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
