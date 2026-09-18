---
baseline_commit: 758b0d73989def240c91d1047d94ffe6f12979e6
---

# Story 0.38: Cache embed.js, Add Instagram CDN Resource Hints, and Add a PWA Install Prompt

## Story Details

- Epic: 0
- Story ID: 0.38
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

<!--
Standalone Epic 0 story sourced directly from backlog.yaml's IDEA-020 (status: triaged,
impact: user-visible, effort: l). No formed epic covers Instagram-embed load speed or PWA
installability (checked epics.md for both — nothing matches), mirroring the precedent of
Stories 0.33/0.34/0.35/0.36/0.37 (standalone, backlog-sourced Epic 0 stories with no
epics.md entry). Next available Epic 0 whole number confirmed as 0.38 (highest existing:
0-37-extract-and-display-event-links).

Architecture (AD-21) and UX (EXPERIENCE.md "PWA Install Prompt") passes are both already
complete for this item — see backlog.yaml#IDEA-020's note for the full record. This story
implements both halves.

DEPENDS ON Story 0.38a (split off THIS story by a Gate 2 finding during drafting — see
Architecture & UX Gate Findings below): 0.38a must be done first. Both stories were
authored together in the same bmad-create-story dispatch.
-->

## Story

As a FestDaily user browsing an event's Instagram embed, and separately as a returning
user who might want the app on their home screen,
I want the Instagram embed's supporting script to load faster and the app to offer an
installable, dismissible install prompt with iOS-specific instructions,
so that the event-detail page feels faster on repeat visits and I have a low-friction,
non-intrusive path to install FestDaily as an app if I want to.

## Acceptance Criteria

### Embed.js caching (AD-21)

1. Given a user visits the event-detail page (full page `apps/web/src/app/[locale]/events/[slug]/page.tsx`
   or the intercepted modal `apps/web/src/app/[locale]/@modal/(.)events/[slug]/page.tsx` —
   both resolve to the same visible `/events/[slug]` URL per AD-16), when
   `EventDetailWrapper.tsx` (the shared client component both routes render) mounts, then
   it registers a **new, dedicated** service worker file (`apps/web/public/instagram-embed-cache-sw.js`
   — a name deliberately distinct from this repo's pre-existing, unrelated
   `apps/web/public/embed.js`, which is FestDaily's own widget-embedding script for a
   different feature (Epic 6) and must not be confused with or touched by this story) via
   `navigator.serviceWorker.register('/instagram-embed-cache-sw.js', { scope:
   `/${locale}/events/` })`, using the current route's `locale` (available via
   `useLocale()`, already imported in this file) — **not** `apps/web/public/firebase-messaging-sw.js`,
   which stays untouched at its existing root scope.
2. Given the registration in AC1, when the app is used under both supported locales over
   time (a user visits `/en/events/...` on one occasion and `/id/events/...` on another —
   or a moderator/tester exercises both), then the same physical script file ends up
   registered under **both** `scope: '/en/events/'` and `scope: '/id/events/'` (per AD-21
   rule 3) — this is a natural consequence of AC1's locale-parameterized registration call
   firing once per locale actually visited, not a requirement to eagerly register both
   scopes unconditionally on every load regardless of the current locale (an implementation
   judgment call, recorded here rather than escalated — the eager-both-scopes alternative
   was considered and rejected as wasted registration work for a locale the visitor may
   never use).
3. Given the new service worker's `fetch` handler, when a request's URL is exactly
   `https://www.instagram.com/embed.js` (hostname `www.instagram.com`, pathname
   `/embed.js` — matched defensively via `new URL(event.request.url)`, not a substring
   check, to avoid accidentally matching this repo's own unrelated `/embed.js` static file
   which is same-origin and would never reach this handler anyway, but the explicit
   hostname check documents the distinction for future readers), then it applies a
   stale-while-revalidate strategy: serve the cached response immediately if one exists
   (via the Cache API, a dedicated cache name e.g. `festdaily-instagram-embed-cache-v1`)
   while re-fetching in the background and updating the cache for next time; if no cached
   response exists yet, fetch from the network and cache the (successful) response before
   resolving.
4. Given any other request within the worker's scope (e.g. the event-detail page's own JS
   chunks, GraphQL calls, images), when the `fetch` event fires, then the handler does
   **not** call `event.respondWith(...)` for it at all — the browser's default network
   handling proceeds completely unaffected. This service worker must never become a
   blanket cache for its scope; it caches exactly one third-party script and nothing else.
5. Given `apps/web/e2e/event-details-instagram-csp.spec.ts` (the existing CSP e2e guard for
   `frame-src`/`child-src` allowlisting `instagram.com`), when this story's changes are
   complete, then that spec still passes unmodified — no change is made to `next.config.ts`'s
   CSP directives, and `embed.js`/its iframe continue to load from exactly the same origin
   as before (only *how fast* the script itself is fetched changes, never *where from*).

### Instagram CDN resource hints (AD-21)

6. Given the event-detail route (`source: '/:locale/events/:slug'`, the same matcher
   `next.config.ts`'s `headers()` function already uses for this route's CSP), when a
   response is served for that route, then the same `headers()` entry additionally returns
   an HTTP `Link` response header value of
   `<https://www.instagram.com>; rel=preconnect, <https://www.instagram.com>; rel=dns-prefetch`
   (the `Link`-header mechanism, not a JSX `<link>` tag — Next.js App Router's Metadata API
   has no dedicated preconnect field, and this project's existing route-scoped-headers
   pattern in `next.config.ts` is the established, idiomatic way to attach per-route HTTP
   hints here). `https://www.instagram.com` is preconnected/dns-prefetched because it is
   the iframe's own confirmed, fixed origin; a generic CDN-media-origin hint
   (`*.cdninstagram.com`) is deliberately **not** added, since Instagram's actual media
   host is a dynamically sharded subdomain (`scontent-<region>-<n>.cdninstagram.com`) that
   cannot be predicted ahead of the real request, so a guessed generic hint would provide
   no real connection-reuse benefit — recorded here as a considered-and-rejected option,
   not an oversight.
7. Given AC6's header applies only to `/:locale/events/:slug`, when any other route is
   requested, then no such `Link` header is present — this hint is deliberately scoped to
   the one page that actually renders the Instagram iframe.

### PWA installability foundation

8. Given no `manifest.json`/PWA manifest exists in this codebase today, when the app is
   built, then a new `apps/web/src/app/manifest.ts` (Next.js App Router's built-in manifest
   file convention, auto-served at `/manifest.webmanifest` and auto-linked into every
   page's `<head>`) exports a `MetadataRoute.Manifest` with at minimum: `name: 'FestDaily'`,
   `short_name: 'FestDaily'`, `start_url: '/'`, `display: 'standalone'`, a `theme_color`/
   `background_color` matching this app's existing brand palette (confirm against
   `packages/ui`'s Tailwind theme tokens rather than inventing new hex values), and an
   `icons` array satisfying Chrome's installability criteria: at least one icon
   `sizes: '192x192'` and one `sizes: '512x512'`, both real, valid PNG files (not
   placeholders) — this app has **zero** icon/favicon assets anywhere today (confirmed:
   `apps/web/public` has no `favicon.ico`/`icon-*.png` of any kind; `push-notifications.ts`'s
   FCM background-notification fallback already references a non-existent
   `/icon-192x192.png` — a pre-existing, unrelated gap this story does not need to fix, but
   may as well reuse the same real icon file for once both exist). Generate the actual PNG
   assets from the existing `packages/ui/src/core/app-shell/LogoMark.tsx` SVG (already the
   source of the app's icon-only mark elsewhere, e.g. `RouteLoader`) via a one-time
   rasterization step (a small Node script using an SVG-to-PNG library, or an equivalent
   build-time `next/og` `ImageResponse` route if that proves simpler) — the exact
   generation mechanism is an implementation detail left to this story, but the **output
   must be real, correctly-sized PNG files checked into `apps/web/public/icons/`**, verified
   by actually inspecting their dimensions (e.g. via `file`/`identify`), not merely present
   by filename.
9. Given AC8's manifest, when Chrome's installability criteria are otherwise met (HTTPS,
   the AC1-AC4 service worker exposing a `fetch` handler, valid manifest+icons), then no
   further manifest work is required by this story — a single, locale-agnostic manifest
   is a deliberate, proportionate choice (most real-world PWAs do not localize
   `name`/`short_name`), not a gap.

### PWA install banner (EXPERIENCE.md "PWA Install Prompt", DESIGN.md `pwa_install_banner`)

10. Given Story 0.38a's `usePwaInstallPrompt()` hook (a **hard dependency** — do not begin
    this section until 0.38a is done), when `canShow` is `true`, then a new
    `PwaInstallBanner` presentational component (`packages/ui/src/core/PwaInstallBanner.tsx`
    — a `core/` primitive per this codebase's established RouteLoader/PageContainer/
    GridContainer/PageHeader placement convention, since this banner is app-shell-level,
    not tied to the `events` domain) renders as the **first child inside** `AppShell.tsx`'s
    existing `<main>` element (i.e. immediately before `{children}`, so it sits below the
    global nav and above all page content on every route, per EXPERIENCE.md's explicit
    placement rule), implementing the `pwa_install_banner` DESIGN.md tokens exactly: `base`
    styling, and — reading left to right — a permanent "Not now" button
    (`dismiss_permanent`, `{components.button.secondary}`), then the lower-weight "Remind
    me in 2 weeks" link (`dismiss_cooldown`) positioned **between** the two real buttons,
    then the primary action button (`primary_action`, `{components.button.primary}`,
    labeled "Install" on Android/Chrome or "How to install" on iOS) — matching DESIGN.md's
    explicit "deliberately lower visual weight than the two real buttons either side of it"
    ordering, not an arbitrary layout. `PwaInstallBanner` receives all copy strings,
    `platform`, and the three callbacks (`onInstallClick`, `onDismissPermanent`,
    `onRemindLater`) as plain props — no `next-intl`/`zustand` import inside
    `packages/ui`, matching the existing `AppShell`/`AppShellWrapper` split.
11. Given `AppShellWrapper.tsx` (the `apps/web` owner of `AppShell`'s state, per the
    existing split), when it renders `AppShell`, then it calls Story 0.38a's
    `usePwaInstallPrompt()` and passes `canShow`/`platform` down, wiring
    `onDismissPermanent`→`dismissPermanently()`, `onRemindLater`→`remindLater()`, and
    `onInstallClick`→a handler that calls `promptInstall()` and, based on its resolved
    value (`'accepted' | 'dismissed' | 'ios-instructions' | 'unavailable'`), either does
    nothing further (`'accepted'`/`'dismissed'`, the native flow already completed) or
    opens `PwaInstallIosModal` (`'ios-instructions'`) — `'unavailable'` is a defensive
    no-op (should not occur if `canShow` gated the banner correctly, but must not throw
    if it does).
12. Given the UX spec's explicit "not part of onboarding" rule (Chrome's own
    `beforeinstallprompt` engagement gate — click/tap + 30s dwell + this story's own
    AC1-AC4 fetch-handling service worker — would not be satisfied that early in the user
    journey), when the onboarding wizard flow (`apps/web/src/app/[locale]/wizard/...`) is
    rendered, then `PwaInstallBanner` is **not** rendered there — it is wired only into the
    main `AppShell`/`AppShellWrapper` tree (`design-artifacts/UX-festgrid-run-1` scope, not
    the separate `UX-wizard-page-run-1` workspace), which the wizard route does not share
    (confirm at implementation time whether the wizard route renders under the same root
    `AppShellWrapper` at all — if it does, gate the banner render on `!isWizardRoute` via
    the current pathname rather than assuming route-tree separation alone excludes it).

### iOS install modal (DESIGN.md `pwa_install_ios_modal`)

13. Given `platform === 'ios'` and the primary action is triggered, when
    `PwaInstallIosModal` (`packages/ui/src/core/PwaInstallIosModal.tsx`, reusing this
    design system's existing shared `{components.modal}` dialog primitive per DESIGN.md's
    explicit "not inventing new modal chrome" note) opens, then it renders exactly two
    numbered steps per DESIGN.md's `step`/`step_number` tokens: (1) a Share icon (use
    `lucide-react`'s `Share` icon, consistent with this codebase's existing
    `lucide-react`-only icon convention — confirm the exact icon name against the
    installed `lucide-react` version at implementation time, same caveat already applied
    elsewhere in this design system, e.g. DESIGN.md's `day_of_week_recurring_badge` token)
    with instruction text "Tap the Share icon", then (2) a home-screen icon (e.g.
    `lucide-react`'s `PlusSquare` or `SquarePlus`, confirming the exact available name) with
    instruction text "Tap 'Add to Home Screen'". `PwaInstallIosModal` receives its step
    copy/icons and an `onClose` callback as props, matching `PwaInstallBanner`'s
    framework-agnostic pattern.
14. Given the modal is open, when the user dismisses it (close button, overlay click, or
    Escape), then it closes without altering any dismiss/cooldown `localStorage` state —
    closing the *instructions* modal is not the same user action as "Not now"/"Remind me
    in 2 weeks" on the banner itself; the banner (if still eligible) remains visible
    afterward.

### Settings fallback (EXPERIENCE.md "Settings fallback")

15. Given the existing Notifications settings tab
    (`apps/web/src/app/[locale]/settings/account/notifications-content.tsx`), when a user
    who has never seen, has dismissed, or is in cooldown on the banner visits that page,
    then a new, permanent "Install App" action (mirroring the same push-notification-toggle
    "device/browser capability" section styling already on that page — not a new tab) is
    always visible and calls the exact same `usePwaInstallPrompt()`-driven install logic
    described in AC11 (Android native prompt, or the iOS modal) — independent of whether
    the banner was ever shown, dismissed, or is cooling down, per EXPERIENCE.md's explicit
    rule.

### Analytics (AD-5)

16. Given AD-5's "any story that introduces user-trackable interactions must explicitly
    list the new event name(s) and payload shape" rule, when a user interacts with any part
    of this feature, then the following new events are captured via the existing
    `@festgrid/analytics` `capturePostHogEvent`/`usePostHog().capture` helper (never the
    PostHog SDK directly), each with a `source: 'banner' | 'settings'` payload field so
    banner-driven and Settings-driven interactions are distinguishable in the same funnel:
    - `pwa_install_banner_shown` — fired once when the banner first becomes visible for a
      session (no payload beyond the implicit page context PostHog auto-captures).
    - `pwa_install_prompt_dismissed_permanent` — `{ source: 'banner' }` ("Not now" clicked;
      Settings has no equivalent action, so this is banner-only).
    - `pwa_install_prompt_dismissed_cooldown` — `{ source: 'banner' }` ("Remind me in 2
      weeks" clicked; banner-only).
    - `pwa_install_prompt_accepted` — `{ source: 'banner' | 'settings', platform:
      'android' }` (native `beforeinstallprompt` flow resolved `'accepted'`).
    - `pwa_install_prompt_declined` — `{ source: 'banner' | 'settings', platform:
      'android' }` (native flow resolved `'dismissed'`).
    - `pwa_install_ios_modal_opened` — `{ source: 'banner' | 'settings' }`.

### i18n (AD-6)

17. Given AD-6's rule that any story introducing user-facing text must add message keys for
    **all** supported locales as part of its Definition of Done, when this story ships,
    then a new `PwaInstallPrompt` namespace (mirroring the existing `NotificationsSettingsPage`
    namespace's flat-key style) is added to **both** `apps/web/locales/en.json` and
    `apps/web/locales/id.json` with keys for: the banner's message text, `installButtonLabel`
    ("Install"), `howToInstallButtonLabel` ("How to install"), `notNowButtonLabel` ("Not
    now"), `remindLaterButtonLabel` ("Remind me in 2 weeks"), the iOS modal's title and its
    two step-instruction strings, and the Settings-tab `installAppButtonLabel`/description
    text. No key is added to only one locale file.

## Tasks / Subtasks

- [ ] Task 1: Embed.js caching service worker (AC: #1, #2, #3, #4, #5)
  - [ ] 1.1 Create `apps/web/public/instagram-embed-cache-sw.js`: `install`/`activate`
        lifecycle handlers (`skipWaiting`/`clients.claim`, mirroring
        `firebase-messaging-sw.js`'s existing pattern), and a `fetch` handler implementing
        stale-while-revalidate scoped to exactly `https://www.instagram.com/embed.js`
        (hostname+pathname check), passing through every other request untouched (no
        `respondWith` call for non-matching URLs)
  - [ ] 1.2 Add the registration call to `EventDetailWrapper.tsx` (already a `"use client"`
        component with `useLocale()` available) inside a `useEffect`, guarded by
        `'serviceWorker' in navigator`
  - [ ] 1.3 Verify (do not modify unless a real conflict is found) that
        `firebase-messaging-sw.js`'s existing root-scope registration
        (`push-notifications.ts:66`) has no page-controller/`fetch`-handler dependency that
        this narrower-scoped worker could shadow on event-detail pages — FCM's Web Push
        delivery is scope-independent (push messages are delivered to whichever SW
        registered the push subscription, regardless of which SW currently "controls" the
        page's `fetch`s), so this is expected to be a documentation-only verification, not
        a code change (Gate 1 finding, see Architecture & UX Gate Findings)
  - [ ] 1.4 Run `apps/web/e2e/event-details-instagram-csp.spec.ts` unmodified and confirm
        it still passes (AC5's regression constraint)
  - [ ] 1.5 Add a new e2e or integration test confirming: (a) the new SW registers with the
        correct locale-scoped `scope` on the event-detail route, (b) a repeat fetch of
        `embed.js` is served from cache while a background revalidation occurs (mockable via
        Playwright's service-worker/route interception, or a lower-level unit test against
        the SW file's fetch-handler logic in isolation if full e2e SW testing proves too
        flaky in CI)
- [ ] Task 2: Preconnect/dns-prefetch hints (AC: #6, #7)
  - [ ] 2.1 Extend the existing `/:locale/events/:slug` entry in `next.config.ts`'s
        `headers()` function with the `Link` header value from AC6, alongside (not
        replacing) the existing `Content-Security-Policy` header
  - [ ] 2.2 Add/extend an e2e or integration test asserting the response headers for
        `/en/events/:slug` include the expected `Link` header, and that an unrelated route
        (e.g. `/en/discover`) does not
- [ ] Task 3: PWA manifest + icons (AC: #8, #9)
  - [ ] 3.1 Generate real `192x192` and `512x512` PNG icons from
        `packages/ui/src/core/app-shell/LogoMark.tsx`, committed under
        `apps/web/public/icons/` — verify actual pixel dimensions after generation, not
        just filenames
  - [ ] 3.2 Create `apps/web/src/app/manifest.ts` per AC8's field list, importing the
        `name`/theme colors from this project's existing brand tokens rather than
        hand-guessing new hex values
  - [ ] 3.3 Manually verify (e.g. Chrome DevTools → Application → Manifest panel, or
        Lighthouse's PWA installability audit) that the manifest+icons+service-worker
        combination satisfies Chrome's installability criteria with no reported errors
- [ ] Task 4: PwaInstallBanner component (AC: #10, #12)
  - [ ] 4.1 Create `packages/ui/src/core/PwaInstallBanner.tsx` implementing the
        `pwa_install_banner` DESIGN.md tokens and the exact button-order rule from AC10;
        props-only, no `next-intl`/`zustand` import
  - [ ] 4.2 Add `PwaInstallBanner.test.tsx` (component tests): renders with correct button
        order/labels per platform (`'android'` → "Install"; `'ios'` → "How to install");
        each of the three callbacks fires on its respective control; hidden entirely when
        not rendered by the parent (a presentational component has no internal
        show/hide logic beyond what its parent chooses to render — confirm this is enforced
        by the parent, per AC11/AC12, not baked into the component itself)
  - [ ] 4.3 Wire `PwaInstallBanner` into `AppShell.tsx` as the first child of `<main>`
  - [ ] 4.4 Wire the actual state (Story 0.38a's `usePwaInstallPrompt()` hook,
        `capturePostHogEvent` calls per AC16, and the onboarding-route exclusion per AC12)
        into `AppShellWrapper.tsx`
- [ ] Task 5: PwaInstallIosModal component (AC: #13, #14)
  - [ ] 5.1 Create `packages/ui/src/core/PwaInstallIosModal.tsx` implementing the
        `pwa_install_ios_modal` DESIGN.md tokens, reusing the existing shared modal/dialog
        primitive
  - [ ] 5.2 Add `PwaInstallIosModal.test.tsx`: renders both steps with icon+text; closing
        (button/overlay/Escape) calls `onClose` and does not touch `localStorage`
  - [ ] 5.3 Wire the modal open/close state into `AppShellWrapper.tsx` (opened when
        `promptInstall()` resolves `'ios-instructions'`, per AC11)
- [ ] Task 6: Settings-tab fallback (AC: #15)
  - [ ] 6.1 Add the "Install App" action to `notifications-content.tsx`, calling
        `usePwaInstallPrompt()` directly (a second, independent consumer of Story 0.38a's
        hook) and opening `PwaInstallIosModal` locally on that page when needed
  - [ ] 6.2 Extend `notifications-content.test.tsx` to cover the new action's visibility
        and both platform branches
- [ ] Task 7: Analytics (AC: #16)
  - [ ] 7.1 Add the six new `capturePostHogEvent`/`posthog.capture` call sites listed in
        AC16, each at the correct interaction point across `AppShellWrapper.tsx` and
        `notifications-content.tsx`
- [ ] Task 8: i18n (AC: #17)
  - [ ] 8.1 Add the new `PwaInstallPrompt` namespace with all required keys to both
        `apps/web/locales/en.json` and `apps/web/locales/id.json`
- [ ] Task 9: Full-suite verification (AC: #1-#17)
  - [ ] 9.1 Run `pnpm --filter web test` and `pnpm --filter ui test`; confirm no regression
  - [ ] 9.2 Run `pnpm lint` and typecheck clean across `web`/`ui`
  - [ ] 9.3 Re-run `event-details-instagram-csp.spec.ts` and confirm it is unmodified and
        green
  - [ ] 9.4 Run `pnpm build` and confirm no build-time errors from the new `manifest.ts`/
        service worker/icon assets

## Dev Notes

- **Hard dependency on Story 0.38a.** Do not begin Tasks 4-6 (anything consuming
  `usePwaInstallPrompt()`) until 0.38a's hook, store, and platform-detection helper exist
  and are tested. Tasks 1-3 (SW caching, preconnect, manifest/icons) have no dependency on
  0.38a and may be implemented first/in parallel.
- **Do not confuse the two `embed.js` files.** `apps/web/public/embed.js` is this
  project's own FestDaily widget-embedding script (Epic 6, `/widget/[id]` iframes) — a
  completely unrelated, same-origin static file. This story's caching target is Instagram's
  third-party `https://www.instagram.com/embed.js`, loaded cross-origin by
  `packages/ui/src/features/events/InstagramEmbed.tsx`'s `loadInstagramEmbedScript`. Naming
  the new service worker `instagram-embed-cache-sw.js` (not `embed-cache-sw.js` or similar)
  is a deliberate disambiguation choice — do not rename it to something that could be
  confused with the existing file.
- **A page's service worker cannot cache anything inside the Instagram iframe itself**
  (AD-21's core, web-verified finding) — this story's caching scope is `embed.js` only.
  Do not attempt to intercept or cache Instagram CDN image/video requests; that is
  explicitly out of scope, not deferred (see Out of Scope).
- **`Link` header vs. JSX `<link>` tag:** Next.js App Router's Metadata API has no built-in
  preconnect/dns-prefetch field, and raw `<link>` elements rendered inside a Server
  Component's JSX body are not reliably hoisted into `<head>` the way Pages Router's
  `next/head` did — the HTTP `Link` response header (via the existing route-scoped
  `headers()` function in `next.config.ts`, the same mechanism already serving this route's
  CSP) is the correct, idiomatic mechanism here and requires no new file or dependency.
- **State Management Architecture categorization:** this story introduces no *new* state
  tier of its own — it consumes Story 0.38a's already-categorized Client Global State
  (zustand) hook. The iOS modal's open/closed boolean is local component state
  (`useState` in `AppShellWrapper.tsx`/`notifications-content.tsx`), not a candidate for
  any of the three global-state tiers (ephemeral, single-owner, no cross-boundary sharing
  need).
- **Loader categorization:** N/A — this story has no async data-fetching operation of its
  own that needs a Blocking/Non-Blocking loader; the service worker registration and
  `beforeinstallprompt` capture are fire-and-forget background operations with no loading
  UI, and the banner/modal render synchronously once `canShow`/`platform` are known.
- **Reusable UI components:** `PwaInstallBanner` and `PwaInstallIosModal` both belong in
  `packages/ui/src/core/` (domain-agnostic, app-shell-level primitives) per this project's
  UI-reusability convention — confirmed correct placement, not `packages/ui/src/features/events/`,
  since this feature has nothing to do with the `events` domain.
- **No cloud/external service setup required** — this story adds no new third-party
  service integration (Instagram's `embed.js`/oEmbed endpoint are pre-existing
  integrations, untouched here); `SETUP_WALKTHROUGH.md` needs no update.
- **Gate 1's FCM-scope-shadowing verification (Task 1.3) is a "confirm, don't necessarily
  change" item** — only touch `push-notifications.ts`/`firebase-messaging-sw.js` if the
  verification actually surfaces a real conflict, which is not expected (Web Push delivery
  is scope-independent).

### Architecture & UX Gate Findings

- **Gate 1 — Architecture/Infrastructure Completeness (Winston):** No gap found against
  the five trigger heuristics (frontend bypassing a backend/API layer, external service
  called directly from frontend that should route through `apps/backend`, new unbacked API
  surface, auth/business logic in frontend, infra lacking IaC). `navigator.serviceWorker`,
  the Cache API, `beforeinstallprompt`, and `localStorage` are native browser platform
  APIs, not backend-adjacent dependencies in the Gate 1 sense; `embed.js` is a public,
  unauthenticated script Instagram itself designed to be loaded and cached client-side, not
  a service call requiring backend mediation; the new static SW file and `manifest.ts` ride
  the same public-file deploy path already proven by `firebase-messaging-sw.js`, no new
  infra/IaC needed. One correction applied to the draft scope during Gate 1 evaluation:
  the platform-detection helper must **not** live in `packages/domain` (browser globals
  disqualify it — `packages/domain` must stay importable by `apps/backend`/Lambda, where
  `navigator` doesn't exist); this correction is now baked into Story 0.38a's own scope
  (that story owns this helper), not this story's. Gate 1 also flagged a non-blocking
  verification item (Task 1.3, FCM-scope coexistence) and a sizing observation (this is a
  wide story spanning SW/manifest/UI/analytics/i18n) — the sizing observation is addressed
  by the Gate 2 split below, not further fragmented, since Gate 1 itself returned no formal
  gap on this point.
- **Gate 2 — UI Complexity & Reusability (Freya):** **GAP FOUND**, acted on. The
  `beforeinstallprompt`-capture + `localStorage` dismiss/cooldown + iOS
  engagement-heuristic logic is a "complex hook (data fetching + derived state + side
  effects) that multiple components will depend on" (the trigger heuristic) — genuinely
  consumed by two structurally unrelated places (this story's `AppShellWrapper` banner and
  `notifications-content.tsx`'s Settings fallback), unlike the RouteLoader/PageContainer/
  GridContainer/PageHeader precedent (one shape, many mechanically-identical call sites).
  **Split into Story 0.38a** (`0-38a-build-the-pwa-install-eligibility-hook.md`), following
  this codebase's existing 0.7/0.7a precedent for exactly this class of finding. This
  story's own scope was narrowed accordingly: it consumes 0.38a's hook rather than
  building any capture/dismiss/platform-detection logic itself. Gate 2 additionally
  surfaced two UX-spec-vs-draft coverage gaps, both resolved directly in this story's ACs
  rather than deferred: (a) the iOS modal's Share-icon asset sourcing was unspecified in
  the original draft — resolved via AC13's explicit `lucide-react` icon choice; (b)
  DESIGN.md's "Remind me in 2 weeks" positioning ("deliberately lower visual weight than
  the two real buttons either side of it") was not called out as an explicit ordering
  requirement in the original draft — resolved via AC10's explicit left-to-right button
  order. Gate 2 confirmed **no `AskUserQuestion` was needed**: the UX spec's "exact
  [iOS engagement] threshold left to the implementation story" note is an intentional,
  documented judgment call, not an oversight — Story 0.38a's AC4 now makes that concrete
  decision (a 2-visit threshold) rather than leaving it open further.
- **Gate 3 — Foundational/Cross-Cutting Dependency Completeness (Winston):** No gap found.
  Evaluated against all six trigger heuristics: this is the *first* general-purpose
  asset-caching service worker and the *first* PWA-manifest/installability setup in this
  codebase, but Gate 3's actual test is "will other future stories/epics also need a
  *separate, generic* version of this," not "is this a first" — there is exactly one
  cacheable asset (`embed.js`) and Next.js supports exactly one `app/manifest.ts` per app
  (inherently a singleton, not a pattern other epics extend independently), and no
  epic/backlog evidence points to a second caching or installability need. i18n, analytics,
  GraphQL/codegen, the global app shell, and Zustand are all pre-established foundations
  this story only consumes, per project-context.md and the architecture spine. The
  zero-icon-assets gap is a real, concrete blocking *asset* dependency (Task 3.1) but not a
  missing *architectural mechanism* — folded into this story's own AC8/Task 3, not split
  into a separate Epic 0 story.
- No `epic-0-readiness.md` sweep citation applies — that report is scoped only to Stories
  0.1-0.19, predating this class of ad-hoc backlog-sourced story (the same gap already
  noted by Stories 0.34/0.35/0.36/0.37's own Dev Notes). All three gates were run fresh via
  subagent dispatch for this story's drafting.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** No mismatch — this story touches no database and no GraphQL
  schema. All new types are local to `apps/web`/`packages/ui` (component props, the
  manifest's `MetadataRoute.Manifest` shape from `next`'s own types).
- **Impacted fields/contracts:** None outside `apps/web`/`packages/ui`. Story 0.38a's
  `usePwaInstallPrompt()` return shape is the one cross-file contract this story consumes
  (see that story's AC10) — no divergence permitted between what 0.38a exports and what
  `AppShellWrapper.tsx`/`notifications-content.tsx` expect; if either changes, update the
  other in the same commit.
- **Required DB migration changes:** No changes required.
- **Required TypeScript type changes:** New local prop interfaces for `PwaInstallBanner`/
  `PwaInstallIosModal`; no existing shared type is modified.
- **Backward compatibility and rollout notes:** Purely additive. `AppShell.tsx`'s `<main>`
  gains a new optional first child — confirm `AppShellWrapper.tsx` (the only real caller)
  passes the new banner-related props without requiring every other `AppShell` consumer
  (e.g. any Storybook/test harness rendering `AppShell` directly) to supply them —
  default the new props to "banner hidden" behavior so `AppShell` remains usable without
  them.
- **Verification checks:** Component tests for `PwaInstallBanner`/`PwaInstallIosModal`;
  `notifications-content.test.tsx` extension; the CSP e2e regression re-run (AC5); a
  header-assertion test (AC6/AC7); manual Lighthouse/DevTools installability verification
  (Task 3.3); full lint/typecheck/build pass.

### Project Structure Notes

- New files: `apps/web/public/instagram-embed-cache-sw.js`,
  `apps/web/public/icons/icon-192.png`, `apps/web/public/icons/icon-512.png` (+ optional
  maskable variant), `apps/web/src/app/manifest.ts`,
  `packages/ui/src/core/PwaInstallBanner.tsx` (+ test),
  `packages/ui/src/core/PwaInstallIosModal.tsx` (+ test).
- Updated files: `apps/web/next.config.ts` (extend the existing `/:locale/events/:slug`
  `headers()` entry — do not create a second entry for the same route), `apps/web/src/features/events/EventDetailWrapper.tsx`
  (SW registration), `packages/ui/src/core/app-shell/AppShell.tsx` (mount point),
  `apps/web/src/components/layout/AppShellWrapper.tsx` (state wiring),
  `apps/web/src/app/[locale]/settings/account/notifications-content.tsx` (Settings
  fallback), `apps/web/locales/en.json`, `apps/web/locales/id.json`.
- No new top-level directory beyond `apps/web/public/icons/` (a natural, conventional
  subfolder for static icon assets — confirm no existing icons directory convention is
  being duplicated, since none exists yet).
- No conflicts detected against the unified project structure, beyond the deliberate,
  documented `packages/domain`-avoidance already resolved via the Story 0.38a split.

### References

- [Source: _bmad-output/implementation-artifacts/backlog.yaml#IDEA-020]
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-21,#AD-6,#AD-5,#AD-4]
- [Source: design-artifacts/UX-festgrid-run-1/EXPERIENCE.md#PWA-Install-Prompt]
- [Source: design-artifacts/UX-festgrid-run-1/DESIGN.md#pwa_install_banner,#pwa_install_ios_modal]
- [Source: apps/web/next.config.ts — existing route-scoped `headers()`/CSP pattern]
- [Source: apps/web/public/firebase-messaging-sw.js — existing SW lifecycle-handler pattern]
- [Source: apps/web/src/lib/push-notifications.ts — existing SW registration pattern]
- [Source: apps/web/src/features/events/EventDetailWrapper.tsx]
- [Source: apps/web/src/app/[locale]/events/[slug]/page.tsx,
  apps/web/src/app/[locale]/@modal/(.)events/[slug]/page.tsx — AD-16 same-URL precedent]
- [Source: packages/ui/src/core/app-shell/AppShell.tsx,
  apps/web/src/components/layout/AppShellWrapper.tsx — existing split pattern]
- [Source: apps/web/src/app/[locale]/settings/account/notifications-content.tsx]
- [Source: packages/ui/src/core/app-shell/LogoMark.tsx — icon-asset source]
- [Source: apps/web/e2e/event-details-instagram-csp.spec.ts — regression guard]
- [Source: _bmad-output/implementation-artifacts/0-38a-build-the-pwa-install-eligibility-hook.md
  — hard dependency]
- [Source: _bmad-output/project-context.md#UI-Components-and-Scalability,
  #Locale-Sensitive-Data-Rendering]
- [Source: _bmad-output/planning-artifacts/story-split-gate.md]
- [Source: Next.js docs, "Metadata Files: manifest.json" — `app/manifest.ts` convention]
- [Source: GitHub vercel/next.js discussion/issue #47399 — App Router preconnect/`Link`
  header migration pattern]
- [Source: web.dev, "Establish network connections early to improve perceived page speed"
  — preconnect/dns-prefetch semantics]

### Backlog row history (IDEA-020, verbatim, moved from backlog.yaml 2026-09-18)

Requested by user via `bmad-help`, as a 3-part improvement. Verified current architecture
first: `apps/backend/src/lib/instagram-oembed/adapter.ts`'s `resolveInstagramOEmbed()` calls
Meta's tokenless oEmbed endpoint server-side, cached 24h (`cache-store.ts`,
`INSTAGRAM_OEMBED_CACHE_TTL_MS`), and returns the raw oEmbed `html` string over GraphQL;
`packages/ui/src/features/events/InstagramEmbed.tsx` then `dangerouslySetInnerHTML`'s that HTML
client-side and separately injects Instagram's own `//www.instagram.com/embed.js` widget script
(`loadInstagramEmbedScript`), which is what actually replaces the blockquote with a real iframe
(watched via MutationObserver, 4s fallback timeout per `EMBED_READY_FALLBACK_TIMEOUT_MS`). The
perceived slowness is most likely embed.js's own script-load-then-iframe-fetch chain against
Instagram's CDN, not primarily the backend GraphQL round trip.

**(1) Frontend-generated embed code** — researched 2026-09-11 via `bmad-help`, conclusion:
don't drop the backend call. Confirmed Instagram's manual-embed pattern
(`blockquote.instagram-media` + `data-instgrm-permalink` + embed.js +
`instgrm.Embeds.process()`) works without ever calling Meta's oEmbed API — this repo's own
`apps/web/e2e/event-details-instagram-csp.spec.ts:43` already builds exactly that shape for its
CSP test, so it's proven to render here. BUT confirmed embed.js exposes no error/failure
callback for a deleted/private post — it just silently fails to hydrate, which is exactly the
gap `InstagramEmbed.tsx`'s existing MutationObserver+4s-timeout heuristic already works around
as a backup signal. Going fully client-side would make that heuristic the ONLY availability
signal instead of a backup to a deterministic backend check, directly weakening the
AVAILABLE/UNAVAILABLE branch that decides whether to show the embed, the `durableImageUrl`
fallback, or the "no longer available" placeholder (`resolveInstagramEmbedResult.ts`). Verdict:
keep the backend oEmbed call for its deterministic status; the actual fix for perceived
slowness is (2) below, not eliminating this call.

**(1b)** Real root cause found instead, and split out to its own ready-to-implement item — see
IDEA-022 (superseded by IDEA-028).

**(2) Caching embed.js + Instagram CDN images/reel video** per "Meta's best practice":
whoever picks this up should default to standard patterns (stale-while-revalidate for embed.js
itself, since it's a shared static script; cache-first with a bounded TTL for images/video,
since Instagram CDN URLs are typically signed and expire — this codebase already has separate
precedent for that exact problem via the durable-image re-hosting pipeline, see 3-6e/3-6f,
which may be a more relevant model here than browser caching of an expiring URL).

**AMENDED (2026-09-11, same session):** user supplied 3 citations (elfsight.com blog,
bluehost.com blog, developers.facebook.com oEmbed docs) — not independently
fetched/verified by this session, but cross-checked against this repo's actual code where a
concrete claim was checkable. Two of the three claims describe things this codebase already
does correctly, not gaps: (i) "short-lived HTML caching, TTL of a few hours to a day" —
`adapter.ts`'s `INSTAGRAM_OEMBED_CACHE_TTL_MS` is already 24h, already compliant; (ii) "load
embed.js exactly once on the frontend to render all active embeds" — `InstagramEmbed.tsx`'s
`loadInstagramEmbedScript` already dedups via `INSTAGRAM_EMBED_SCRIPT_SELECTOR` before
injecting a second copy, already compliant. The third claim IS a real, verified gap and was
small/independent enough to spin out on its own — see IDEA-021 (done). The "Meta does not
return thumbnail_url/author_name" claim is a documented oEmbed response-shape limitation, not
something to fix here — only relevant if/when (1) above (frontend-generated markup) is
attempted, since a hand-built blockquote can't source those fields from the endpoint either
way.

**(3) Service worker + PWA install button + iOS UX:** verified the repo already registers
exactly one service worker today — `apps/web/public/firebase-messaging-sw.js`, registered by
`apps/web/src/lib/push-notifications.ts:66`, scoped solely to Firebase Cloud Messaging push
notifications, not general asset caching. No `apps/web/public/manifest.json` (web app manifest)
existed at capture time, so the app was not installable as a PWA at all — new scope, not an
extension of existing infra. iOS Safari has no `beforeinstallprompt` event and no native
install-prompt UI, so the Android/Chrome install-button pattern doesn't transfer directly — the
standard workaround is a custom in-app banner/instructions directing users to Share → Add to
Home Screen, typically gated on `navigator.standalone`/the `display-mode: standalone` media
query.

Also flagged: `apps/web/next.config.ts` carries a narrow CSP (`frame-src`/`child-src`
allowlisting `https://www.instagram.com` only) specifically for the current embed.js/iframe
pattern, guarded by `e2e/event-details-instagram-csp.spec.ts` — any change to how/where
embed.js or its iframe loads from must keep that test green.

**ARCHITECTURE RESOLVED (bmad-architecture, 2026-09-17, Architecture Spine AD-21):**
web-verified a page's service worker cannot intercept a cross-origin iframe's own internal
fetches, so item (2)'s "cache Instagram CDN images/reel video" is infeasible for the current
oEmbed+iframe approach — not a design gap, a hard platform limitation. Re-scoped: cache
embed.js itself (stale-while-revalidate, since it IS fetched by our own page) + preconnect/
dns-prefetch resource hints to Instagram's CDN origins for the otherwise-uncacheable
iframe-internal fetch chain's connection latency. A separate dedicated service worker
(user-directed) is registered at locale-scoped paths (`/en/events/`, `/id/events/`) to coexist
with the existing root-scoped `firebase-messaging-sw.js`. PWA installability and iOS-specific
install UX were explicitly excluded from AD-21 — needed their own `bmad-ux` pass.

**UX RESOLVED (bmad-ux, 2026-09-17):** persistent dismissible banner at top of `<main>`, below
nav, every route; two dismiss actions (permanent "Not now" / 2-week-cooldown "Remind me in 2
weeks"), state in browser localStorage not a backend setting (installability is per-device);
permanent "Install App" fallback added to the existing Notifications settings tab;
Android/Chrome primary action calls the captured `beforeinstallprompt`'s `.prompt()` directly,
iOS opens a step-by-step Share-then-Add-to-Home-Screen modal instead. Not part of onboarding —
web-verified Chrome's own `beforeinstallprompt` engagement gate (click/tap + 30s dwell + a
fetch-handling SW) wouldn't be met that early. See EXPERIENCE.md "PWA Install Prompt" and
DESIGN.md `pwa_install_banner`/`pwa_install_ios_modal`.

**PROMOTED (2026-09-17 via bmad-create-story):** Gates 1/2/3 all ran fresh. Gate 1/3 returned no
gap (one placement correction: platform detection cannot live in `packages/domain` since it
needs `navigator`, unavailable to `apps/backend`/Lambda). Gate 2 found a real gap — the
`beforeinstallprompt`-capture + localStorage dismiss/cooldown + iOS-engagement-heuristic logic
is a complex hook genuinely shared by two unrelated consumers (the app-shell banner and the
Settings-tab fallback) — split into a prerequisite story per this repo's existing 0.7/0.7a
precedent: 0-38a (the eligibility hook, no UI) and this story, 0-38 (depends on 0-38a). No child
row carved out — every remaining actionable part of this item's original three-part scope is
covered by these two stories (item (2)'s CDN-media-caching half stays permanently out of scope
per AD-21's hard platform-limitation finding, not deferred; items (1)/(1b) were already
resolved/superseded before this promotion via IDEA-021/IDEA-022/IDEA-028).

## Global Rules References

- [ ] `_bmad-output/project-context.md` — UI Components & Scalability (`packages/ui/core`
      placement), Locale-Sensitive Data Rendering (n/a — no enum/date/number rendering
      introduced), App Name (FestDaily, used in the manifest)
- [ ] `_bmad-output/planning-artifacts/story-content-structure.md` — this story follows its
      canonical section order and status vocabulary
- [ ] Architecture spine
      (`_bmad-output/planning-artifacts/festgrid-architecture-spine.md`) — AD-21 (embed.js
      caching + preconnect + locale-scoped SW), AD-6 (i18n), AD-5 (analytics), AD-4 (state,
      via Story 0.38a's categorization)
- [ ] Infrastructure docs (`docs/infrastructure/index.md`) — no SQS/EventBridge/API
      Gateway/Lambda-provisioning change; a static-asset + frontend-only story needs only
      the index summary, no shard file read required

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - New: `apps/web/public/instagram-embed-cache-sw.js`,
    `apps/web/public/icons/icon-192.png`, `apps/web/public/icons/icon-512.png`,
    `apps/web/src/app/manifest.ts`, `packages/ui/src/core/PwaInstallBanner.tsx`,
    `packages/ui/src/core/PwaInstallBanner.test.tsx`,
    `packages/ui/src/core/PwaInstallIosModal.tsx`,
    `packages/ui/src/core/PwaInstallIosModal.test.tsx`
  - Update: `apps/web/next.config.ts`, `apps/web/src/features/events/EventDetailWrapper.tsx`,
    `packages/ui/src/core/app-shell/AppShell.tsx`,
    `apps/web/src/components/layout/AppShellWrapper.tsx`,
    `apps/web/src/app/[locale]/settings/account/notifications-content.tsx`,
    `apps/web/src/app/[locale]/settings/account/notifications-content.test.tsx`,
    `apps/web/locales/en.json`, `apps/web/locales/id.json`
- **Rule Mapping:**
  - `PwaInstallBanner`/`PwaInstallIosModal` in `packages/ui/src/core/` →
    project-context.md's UI-reusability rule (`core/` for domain-agnostic primitives).
  - `Link` HTTP header via the existing `headers()` function, not a new mechanism →
    reuses this project's own established route-scoped-header pattern rather than
    inventing a second one.
  - New PostHog events via `capturePostHogEvent`/`usePostHog()` only, `noun_verb` naming →
    AD-5.
  - New locale keys added to both `en.json` and `id.json` in the same commit → AD-6 rule 3.
  - Zero-touch to `next.config.ts`'s CSP directives and to
    `apps/web/public/firebase-messaging-sw.js` → AD-21 rule 4's regression constraint and
    the deliberate SW-separation decision.
- **Verification Plan:**
  - `event-details-instagram-csp.spec.ts` re-run unmodified, green (AC5).
  - New header-assertion test for the `Link` header on `/en/events/:slug` vs. an unrelated
    route (AC6/AC7).
  - `PwaInstallBanner.test.tsx`/`PwaInstallIosModal.test.tsx` (button order, platform
    labels, callback wiring, modal close behavior).
  - `notifications-content.test.tsx` extended for the new Settings action.
  - Manual Lighthouse/Chrome DevTools installability audit (Task 3.3) with no reported
    manifest/icon/SW errors.
  - `pnpm --filter web test`, `pnpm --filter ui test`, `pnpm lint`, `pnpm build` all green.

## Pre-Coding Approval Gate

- [ ] Scope confirmation — embed.js caching + preconnect hints (AD-21) + PWA manifest/icons
      + install banner/iOS modal/Settings fallback (EXPERIENCE.md), explicitly excluding
      Instagram CDN media caching inside the iframe (AD-21, infeasible) and any onboarding
      integration (EXPERIENCE.md, explicit non-requirement).
- [ ] Architecture and boundary confirmation — Gate 1/3 returned "No gap found" (with one
      placement correction folded into Story 0.38a); Gate 2 returned "Gap found," acted on
      via the Story 0.38a split (see Architecture & UX Gate Findings).
- [ ] Testing plan confirmation — component tests (`packages/ui`), integration/header
      tests, the CSP e2e regression re-run, and a manual installability audit all agreed
      per Testing Requirements below.
- [ ] Explicit human approval state — **pending approval.**
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted — **Story 0.38a must be
      `done` before Tasks 4-6 of this story begin.** Confirm 0.38a's status before starting
      implementation past Task 3.
- [ ] iOS modal icon names (`Share`/`PlusSquare` or `SquarePlus`) confirmed against the
      installed `lucide-react` version before implementation (AC13's own caveat).

## Testing Requirements

- [ ] Unit tests: none new beyond what Story 0.38a already covers for the hook itself; this
      story's logic is thin enough (wiring + a fetch-handler in a plain `.js` service
      worker file, not a TS module under a test runner) that its own coverage is via
      component/integration/e2e tests instead
- [ ] Integration tests: `notifications-content.test.tsx` extension (AC15); a header
      assertion test for AC6/AC7
- [ ] Component tests: `PwaInstallBanner.test.tsx`, `PwaInstallIosModal.test.tsx`
- [ ] E2E tests: `event-details-instagram-csp.spec.ts` (must stay green, unmodified); a new
      SW-registration-scope e2e/integration check (Task 1.5) — this is the first
      general-purpose caching SW in the codebase and its own registration correctness (the
      right script, the right scope, per locale) is exactly the kind of critical-path
      behavior this project's "E2E for critical flows only" testing-trophy philosophy
      exists to cover, even though it's new infrastructure rather than a user-facing flow
      per se

## Deliverables Checklist

- [ ] `instagram-embed-cache-sw.js` implemented (stale-while-revalidate for `embed.js`
      only, all other requests passed through) and registered per-locale from
      `EventDetailWrapper.tsx`
- [ ] `next.config.ts`'s event-detail route header extended with the preconnect/dns-prefetch
      `Link` header
- [ ] `apps/web/src/app/manifest.ts` + real 192/512 PNG icons committed; installability
      verified via Lighthouse/DevTools
- [ ] `PwaInstallBanner` implemented per DESIGN.md tokens (correct button order) and wired
      into `AppShell`/`AppShellWrapper`, excluded from onboarding
- [ ] `PwaInstallIosModal` implemented per DESIGN.md tokens and wired into the same flow
- [ ] Settings-tab "Install App" fallback added, independent of banner state
- [ ] All six new PostHog events wired at the correct interaction points
- [ ] New `PwaInstallPrompt` locale namespace added to both `en.json`/`id.json`
- [ ] `event-details-instagram-csp.spec.ts` confirmed still green and unmodified
- [ ] All new/extended tests passing; lint, typecheck, and build clean

## Out of Scope

- Caching Instagram CDN images/reel video inside the embed's own iframe — a verified hard
  platform limitation (AD-21), not a design gap or a deferred item.
- Any change to `next.config.ts`'s CSP directives or to where `embed.js`/its iframe loads
  from — the existing e2e guard must stay green with zero modification.
- Extending or restructuring `apps/web/public/firebase-messaging-sw.js` — the new caching
  worker is deliberately separate, per AD-21 rule 3 (user-directed).
- The PWA install banner/prompt appearing anywhere in the onboarding wizard flow —
  explicitly excluded per EXPERIENCE.md (Chrome's own engagement gate would not be
  satisfied that early).
- Localizing the web app manifest's `name`/`short_name` per-locale — a single,
  locale-agnostic manifest is the deliberate choice (AC9).
- Fixing `push-notifications.ts`'s pre-existing, unrelated reference to a non-existent
  `/icon-192x192.png` FCM-notification fallback icon — noted as a discovered adjacent gap,
  not this story's own scope (though the real icon file this story creates may coincidentally
  resolve it; not verified or claimed as a fix here).
- Story 0.38a's `usePwaInstallPrompt()` hook, its Zustand store, and its
  platform-detection/localStorage logic — built in that prerequisite story, only consumed
  here.

## Definition of Done

- [ ] AC1–AC17 satisfied
- [ ] Story 0.38a is `done` before this story's Tasks 4-6 were implemented
- [ ] Required component/integration tests passing
- [ ] `event-details-instagram-csp.spec.ts` passing, unmodified
- [ ] Lint and type checks passing for `web` and `ui` packages
- [ ] `pnpm build` succeeds with the new manifest/service-worker/icon assets in place
- [ ] Manual installability verification performed (Lighthouse or Chrome DevTools) with no
      reported errors

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
