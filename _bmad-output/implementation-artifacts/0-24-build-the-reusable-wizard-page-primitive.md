---
baseline_commit: bc6c044b26689041a8ec7c6c9fba4dd36cda01db
---
# Story 0.24: Build the reusable Wizard page primitive

## Story Details

- Epic: 0
- Story ID: 0.24
- Story Key: 0-24-build-the-reusable-wizard-page-primitive
- Status: ready-for-dev (AC12 amendment; AC1-AC11 already delivered)

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a generic, reusable `/wizard/[wizardKey]/[stepSlug]` page mechanism — a typed wizard registry keyed by `wizardKey`, a `WizardStepSummary`/`WizardNavigation` chrome, and a `useWizardStep()` hook — driven by a per-wizard step configuration (not a URL-query-param-encoded steps array, so each wizard's step titles/descriptions can be sourced through next-intl and each step page can set its own locale-aware `generateMetadata`),
so that any current or future multi-step flow (Story 3.1's onboarding wizard now, Story 5.5's manual-post-selection step later, and the PRD §3.10 "guide the user through the wizard first" gate from the user menu) registers once and reuses the same generic chrome instead of each feature building its own step summary/navigation.

## Acceptance Criteria

1. **Given** `design-artifacts/UX-wizard-page-run-1/DESIGN.md`/`EXPERIENCE.md` (status: final), **when** a new wizard flow is needed, **then** it is added as one entry in a typed wizard registry (`apps/web/src/features/wizard/wizard-registry.ts`) keyed by a `wizardKey` string, each entry defining `key: string`, `defaultExitPath: string`, and an ordered `steps: WizardStepDefinition[]` array where each step is `{ slug: string; canSkipStep?: boolean; Component: React.ComponentType }`. This story ships the registry **empty** (`{}`) — zero real wizard entries, reserved-slot pattern mirroring Stories 0.7/0.8/0.13/0.23. The exact shape above must match Story 3.1's already-drafted registry entry example verbatim (`_bmad-output/implementation-artifacts/3-1-onboarding-wizard-for-api-key-and-subscriptions.md`, Task 4), since Story 3.1 is `ready-for-dev` and depends on this exact contract.
2. **And** the route `apps/web/src/app/[locale]/wizard/[wizardKey]/[stepSlug]/page.tsx` renders the wizard chrome (Step Summary + Navigation) around the matched step's content component, looked up from the registry; an unknown `wizardKey` or `stepSlug` (not present in the matched wizard's `steps` array) renders `notFound()`. The lookup/`notFound()` check runs independently in both `generateMetadata` (Server) and the page's default export (Server) — the page never renders wizard chrome for an invalid key/slug combination.
3. **And** Step Summary visually distinguishes **Completed** (checkmark, solid blue background — `#3B82F6`), **Current** (blue border), and **Upcoming** (disabled/grayed, `#6B7280`) states per `DESIGN.md`, derived purely from step index vs. current step index (`index < currentIndex` → Completed, `index === currentIndex` → Current, `index > currentIndex` → Upcoming — see Dev Notes for why no separate completion-tracking state is needed here). Connecting-line segments between steps render filled/blue when the segment lies fully behind the current step (`segment i, i.e. between step i and i+1, is filled when i < currentIndex`) and gray otherwise. Step Summary items are **non-interactive** (no click-to-navigate) — neither `DESIGN.md` nor `EXPERIENCE.md` specifies this affordance; only the Navigation buttons drive step transitions.
4. **And** Navigation renders `Previous Step` (secondary, disabled on the first step), `Next Step` (primary, disabled unless `isStepCompleted`, hidden on the last step), `Skip Step` (only rendered when the current step's `canSkipStep` is true **and** it is not the last step — there is no "next" for a last-step skip to advance to, and `Complete` already serves as the terminal action), and `Complete` (primary, rendered only on the last step, disabled unless `isStepCompleted`), matching `DESIGN.md`'s button states (disabled = reduced opacity + `cursor-not-allowed`). `WizardNavigation` is a presentational, framework-agnostic component (`packages/ui`) — it receives `onPrevious`/`onNext`/`onSkip`/`onComplete` callbacks and boolean/label props; it does not import `next/navigation` itself (mirrors the `packages/ui` precedent of framework-agnostic core primitives, e.g. `NavRailItem`'s `renderLink` prop, `useScopedLocale`'s explicit non-dependency on `next-intl`).
5. **And** a `useWizardStep()` hook, backed by a `WizardStepProvider` the chrome wraps each step's content in, returns `{ isStepCompleted, setStepCompleted }` per `EXPERIENCE.md`'s contract — the step's own content component calls `setStepCompleted(true)` once its step's action succeeds, which is what enables the Next/Complete button. `useWizardStep()` throws if called outside a `WizardStepProvider` (fail-fast, no silent default — there is no sensible fallback for "is this step complete"). No explicit reset logic is needed on step transitions: each `[stepSlug]` value is a distinct Next.js route, so navigating between steps naturally remounts `WizardStepProvider` with fresh `useState(false)` — see Dev Notes.
6. **And** the page a user should return to after completing the wizard is carried via a `redirect` search param (e.g. `?redirect=/settings/subscriptions`) set by whichever feature redirects the user into the wizard; `Complete` navigates to that value if present and validated as a safe same-origin relative path (see AC10), else the wizard's `defaultExitPath`. The `redirect` value is preserved (re-appended) across every Previous/Next/Skip navigation between steps, not just read once on the final step. A redirecting feature that needs to skip an already-satisfied step links directly to that step's `[stepSlug]` segment (e.g. `/wizard/onboarding/subscribe`) rather than a numeric `currentStep` query param.
7. **And** every wizard-chrome string (Previous/Next/Skip/Complete labels) is sourced through a shared `WizardChrome` next-intl namespace, and every step's title/description through a `Wizards.<wizardKey>.steps.<stepSlug>` namespace — both present in `apps/web/locales/en.json` and `apps/web/locales/id.json`, resolved dynamically via `useTranslations()` (no-namespace form) + interpolated key path, since `wizardKey`/`stepSlug` are runtime route params, not statically known namespace strings. This story adds the `WizardChrome` namespace (real content) but **not** a `Wizards` namespace (there are no registry entries yet to have titles/descriptions for) — the first real registry entry (Story 3.1) creates `Wizards` itself, exactly as Story 3.1's own Dev Notes already state ("create if Story 0.24 hasn't already").
8. **And** `page.tsx` sets the browser tab title/meta description via `generateMetadata` (next-intl server-side `getTranslations`, via `apps/web/src/lib/metadata.ts`'s `buildPageMetadata`) resolving `Metadata.wizard<WizardKeyPascalCase><StepSlugPascalCase>Title`/`...Description` — **one metadata key pair per step**, not one per wizard (this refines epics.md's AC wording, which omitted the step segment; Story 3.1's own already-drafted Task 4 confirms the per-step naming — `Metadata.wizardOnboardingApiKeyTitle`/`...Description` and `Metadata.wizardOnboardingSubscribeTitle`/`...Description` — since each `[stepSlug]` is its own route needing its own title). This story provides the naming-convention helper (`buildWizardMetadataKeys`); it adds no `Metadata` keys itself (there are no real steps yet to have titles for).
9. **And** the page's top-level `<Suspense>` boundary (required because the wizard content reads `useSearchParams()` for the `redirect` param) supplies `fallback={<RouteLoader />}` (`@festgrid/ui`, Story 0.26 — now `review`/implemented) per `project-context.md`'s Route-Level Suspense Fallback rule. No forward dependency: `RouteLoader` already exists in the codebase at this story's creation.
10. **And** the `redirect` search-param value is validated as a safe, same-origin relative path (starts with a single `/`, not `//`, and contains no `://`) before being used as a navigation target; an invalid/absent value falls back to the wizard's `defaultExitPath`. This guards against an open-redirect vector, since `redirect` is an attacker-influenceable, shareable URL query parameter — not part of epics.md's literal AC text, but a required security-correctness addition given the parameter's user-facing, unauthenticated exposure.
11. **And** this story registers the chrome/hook/route mechanism only, with zero wizard entries wired to a real consumer yet — the first real registry entry (`onboarding`, its steps, its i18n content) is Story 3.1's scope, mirroring the "reserved slot" pattern already used by Stories 0.7/0.8/0.13/0.23.
12. **AC12 — Wizard chrome never visually collides with the persistent sidenav rail (added 2026-08-24 via `bmad-create-story`, `ux-rework-2026-08-24.md` item #9):** And `WizardNavigation`'s bottom bar (and the rest of the wizard page's content column) never renders on top of, or visually overlapping, `AppShell`'s fixed sidenav rail (`packages/ui/src/core/app-shell/AppShell.tsx`) at any breakpoint where the rail is visible (the `md:flex`/768px+ tablet-rail and `xl:`/1280px+ expanded-rail tiers). See Dev Notes — this could not be conclusively root-caused by static code review alone; Task 1 below requires live browser reproduction before the fix is finalized.

## Tasks / Subtasks

- [x] **Task 1: `packages/ui` — `useWizardStep()` hook + `WizardStepProvider`** (AC: 5)
  - [x] Create `packages/ui/src/hooks/useWizardStep.tsx` (`'use client'`): a `WizardStepContext` (React Context) holding `{ isStepCompleted: boolean; setStepCompleted: (completed: boolean) => void }`; `WizardStepProvider({ children })` owns `useState(false)` and provides it; `useWizardStep()` reads the context and throws `Error('useWizardStep must be used within a WizardStepProvider')` if `undefined`. Mirror `packages/ui/src/hooks/useScopedLocale.tsx`'s Provider+hook-in-one-file structure and doc-comment style.
  - [x] Create `useWizardStep.test.tsx` (Vitest + Testing Library `renderHook`/`render`): `useWizardStep()` throws outside a provider; returns `isStepCompleted: false` initially inside a provider; `setStepCompleted(true)` updates the value seen by consumers; a fresh `WizardStepProvider` instance (i.e. remount) starts at `false` again regardless of a previous instance's state (proves no cross-instance leakage).
  - [x] Export from `packages/ui/src/hooks/index.ts` (`export * from './useWizardStep';`).
- [x] **Task 2: `packages/ui` — `WizardStepSummary` component** (AC: 3)
  - [x] Create `packages/ui/src/core/wizard/WizardStepSummary.types.ts`: `export interface WizardStepSummaryItem { slug: string; title: string }` and `export interface WizardStepSummaryProps { steps: WizardStepSummaryItem[]; currentStepSlug: string }`.
  - [x] Create `packages/ui/src/core/wizard/WizardStepSummary.tsx`: derives `currentIndex = steps.findIndex((s) => s.slug === currentStepSlug)`; renders a horizontal list (`role="list"`), each item's state (`completed`/`current`/`upcoming`) derived by index comparison per AC3; completed items render a checkmark (`lucide-react`, mirroring `blocking-loader.tsx`'s icon-import convention) + solid blue background; current item gets a blue border (`aria-current="step"`); upcoming items are grayed/disabled-styled; a connecting-line `<span>` between each adjacent pair, styled per AC3's fill rule. No click handlers — purely presentational (`role="list"`/`role="listitem"`, no `role="button"`/`tabIndex`).
  - [x] Create `WizardStepSummary.test.tsx`: renders 3 steps with the 2nd as current — asserts step 1 shows completed styling/checkmark, step 2 shows current styling/`aria-current="step"`, step 3 shows upcoming/disabled styling; asserts the two connecting segments render the correct filled/gray state; asserts no item is a clickable element.
- [x] **Task 3: `packages/ui` — `WizardNavigation` component** (AC: 4)
  - [x] Create `packages/ui/src/core/wizard/WizardNavigation.types.ts`: `export interface WizardNavigationLabels { previous: string; next: string; skip: string; complete: string }` and `export interface WizardNavigationProps { isFirstStep: boolean; isLastStep: boolean; isStepCompleted: boolean; canSkipStep: boolean; labels: WizardNavigationLabels; onPrevious: () => void; onNext: () => void; onSkip: () => void; onComplete: () => void }`.
  - [x] Create `packages/ui/src/core/wizard/WizardNavigation.tsx`: renders raw `<button>` elements styled with Tailwind per DESIGN.md's primary/secondary/disabled token classes (mirroring `NavRailItem.tsx`'s raw-`<button>`-with-Tailwind convention — this repo has no shared `Button` primitive inside `packages/ui` yet, only a local `apps/web/src/components/ui/button.tsx`, which `packages/ui` must not import per the monorepo's app→package dependency direction). `Previous Step`: secondary style, `disabled={isFirstStep}`, calls `onPrevious`. `Next Step`: primary style, rendered only when `!isLastStep`, `disabled={!isStepCompleted}`, calls `onNext`. `Skip Step`: rendered only when `canSkipStep && !isLastStep`, calls `onSkip`. `Complete`: primary style, rendered only when `isLastStep`, `disabled={!isStepCompleted}`, calls `onComplete`. Disabled buttons get reduced opacity + `cursor-not-allowed` classes per DESIGN.md.
  - [x] Create `WizardNavigation.test.tsx`: first-step case hides/disables Previous appropriately; last-step case shows Complete instead of Next and hides Skip even if `canSkipStep` is true; middle-step case with `canSkipStep: true` shows all of Previous/Next/Skip; `isStepCompleted: false` disables Next/Complete; each button's `onClick` calls its respective callback exactly once.
  - [x] Create `packages/ui/src/core/wizard/index.ts` exporting `WizardStepSummary`(+types) and `WizardNavigation`(+types); add `export * from './core/wizard';` to `packages/ui/src/index.ts`.
- [x] **Task 4: `apps/web` — wizard registry + metadata-key helper + redirect-safety helper** (AC: 1, 8, 10)
  - [x] Create `apps/web/src/features/wizard/wizard-registry.types.ts`: `export interface WizardStepDefinition { slug: string; canSkipStep?: boolean; Component: React.ComponentType }` and `export interface WizardDefinition { key: string; defaultExitPath: string; steps: WizardStepDefinition[] }`.
  - [x] Create `apps/web/src/features/wizard/wizard-registry.ts`: `export const wizardRegistry: Record<string, WizardDefinition> = {};` — intentionally empty; a code comment states the reserved-slot rationale and points to this story's epics.md entry so the first consumer (Story 3.1) understands the expected shape (matching the exact literal object shape in Story 3.1's Task 4).
  - [x] Create `apps/web/src/features/wizard/metadata-key.ts`: `export function buildWizardMetadataKeys(wizardKey: string, stepSlug: string): { titleKey: string; descriptionKey: string }` — converts each kebab-case segment to PascalCase (e.g. `'api-key'` → `'ApiKey'`) and returns `{ titleKey: `wizard${Pascal(wizardKey)}${Pascal(stepSlug)}Title`, descriptionKey: ...Description }`, centralizing the naming convention from AC8 so consumer stories don't hand-derive it inconsistently.
  - [x] Create `metadata-key.test.ts`: covers a single-word key (`'onboarding'`/`'subscribe'` → `wizardOnboardingSubscribeTitle`) and a hyphenated key (`'api-key'` → `...ApiKey...`).
  - [x] Create `apps/web/src/features/wizard/is-safe-redirect-path.ts`: `export function isSafeRedirectPath(path: string | null): path is string` — `true` only if `path` starts with `/`, does not start with `//`, and does not contain `://`.
  - [x] Create `is-safe-redirect-path.test.ts`: covers a valid relative path, `null`, an empty string, a protocol-relative `//evil.com` path, and an absolute `https://evil.com` URL.
- [x] **Task 5: `apps/web` — wizard route (`page.tsx` + client content)** (AC: 2, 6, 7, 8, 9, 10)
  - [x] Create `apps/web/src/app/[locale]/wizard/[wizardKey]/[stepSlug]/page.tsx` (Server Component, mirrors `events/[slug]/page.tsx`'s split): `generateMetadata({ params })` resolves `{ locale, wizardKey, stepSlug }`, looks up `wizardRegistry[wizardKey]`, finds the matching step; if either lookup fails, call `notFound()`; otherwise call `buildWizardMetadataKeys(wizardKey, stepSlug)` and `getTranslations({ locale, namespace: 'Metadata' })` to build `buildPageMetadata({ title, description })`. Default export does the same registry/step lookup, calls `notFound()` defensively if invalid, then renders `<Suspense fallback={<RouteLoader />}><WizardPageContent wizardKey={wizardKey} stepSlug={stepSlug} /></Suspense>`.
  - [x] Create `apps/web/src/app/[locale]/wizard/[wizardKey]/[stepSlug]/wizard-page-content.tsx` (`'use client'`, mirrors the `*-content.tsx` pattern of `favorites-content.tsx`/`notifications-content.tsx`): looks up `wizardRegistry[wizardKey]` and the current step by `stepSlug` (calls `notFound()` if invalid — defense in depth alongside the Server Component's own check); reads `redirect` via `useSearchParams()`, validated with `isSafeRedirectPath`; uses `useRouter()` (`next/navigation`) to build each Previous/Next/Skip target URL as `/wizard/${wizardKey}/${targetSlug}${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}` (AC6 — redirect propagated across every step transition); `onComplete` navigates to the validated `redirect` value or `wizardDef.defaultExitPath`. Renders `<WizardStepProvider>` wrapping `<WizardStepSummary steps={...} currentStepSlug={stepSlug} />`, the current step's `<Component />`, and `<WizardNavigation ... />`, with all step titles and the 4 chrome labels resolved via `useTranslations()` (no-namespace form) + interpolated key paths per AC7.
  - [x] Create `wizard-page-content.test.tsx` (Vitest + Testing Library, `NextIntlClientProvider` wrapper per `favorites-content.test.tsx`'s convention, a `next/navigation` mock for `useRouter`/`useSearchParams`, and a temporary in-test 2-entry fake registry — this story's real registry is empty, so tests must inject their own fixture entries rather than relying on `wizardRegistry`'s shipped content): renders Step Summary + Navigation + the current step's `Component`; clicking Next when `isStepCompleted` is true navigates to the next step's URL with `redirect` preserved; clicking Complete on the last step navigates to a validated `redirect` value, or to `defaultExitPath` when `redirect` is absent/unsafe; an unknown `wizardKey`/`stepSlug` triggers `notFound()`.
- [x] **Task 6: i18n — `WizardChrome` namespace** (AC: 7)
  - [x] Add a `WizardChrome` object to `apps/web/locales/en.json`: `{ "previousStepLabel": "Previous Step", "nextStepLabel": "Next Step", "skipStepLabel": "Skip Step", "completeLabel": "Complete" }`.
  - [x] Mirror into `apps/web/locales/id.json` with real Indonesian translations: `{ "previousStepLabel": "Langkah Sebelumnya", "nextStepLabel": "Langkah Berikutnya", "skipStepLabel": "Lewati Langkah", "completeLabel": "Selesai" }` — required by `project-context.md`'s i18n rule and enforced by `apps/web/locales/locales.test.ts`'s key-parity test.
- [x] **Task 7: Verification** (AC: all)
  - [x] `pnpm --filter ui test`, `pnpm --filter web test` pass, including all new test files, with no regression in existing suites (including `locales.test.ts`'s key-parity check).
  - [x] `pnpm build` and `pnpm lint` clean at the repo root.
  - [x] Manual smoke check (Completion Notes): with a temporary 2-step test entry added locally to `wizardRegistry` (removed before commit, or added via a throwaway dev-only registration), navigate `/wizard/<key>/<step1>` → confirm Step Summary/Navigation render correctly, `RouteLoader` flashes briefly on first paint, Next is disabled until the step's content calls `setStepCompleted(true)`, Previous/Next preserve an appended `?redirect=` param, and an unknown `wizardKey` 404s.
- [ ] **Task 8: Investigate wizard-chrome/sidenav-rail visual collision report (AC12)**
  - [x] **Live-verified 2026-08-24, NOT reproduced.** Ran the app (`pnpm --filter web dev`, port 3001) and drove real Chromium (Playwright) to `/wizard/onboarding/api-key` (unauthenticated, `Loading...` step-content state), screenshotting at four widths: 500px (mobile bottom-tab-bar tier), 768px (rail-boundary), 1024px (icon-only tablet rail), 1440px (expanded desktop rail). **No visual collision at any of the four** — `WizardNavigation`'s Previous/Next buttons sit cleanly clear of both the sidenav rail (all rail tiers) and the mobile bottom tab bar (with visible gap, consistent with `<main>`'s `pb-14` reservation at that tier). Screenshots and the throwaway driver script were not committed (verification artifacts only).
  - [ ] **Not closed — only the states above are ruled out.** Untested and still candidates: (a) an authenticated session past the `Loading...` state, where real step content (a longer form, validation errors) could change the content column's height; (b) the `subscribe` step (not just `api-key`); (c) the exact moment of a Previous/Next step transition, mid-`RouteLoader` flash, rather than settled post-navigation state; (d) a specific browser/OS combination if this is a rendering-engine-specific quirk, not a Chromium one. Before writing any fix, get more specific repro steps from whoever filed `ux-rework-2026-08-24.md` item #9 (exact viewport, browser, authenticated or not, which step) — do not spend further effort guessing at a fix for a bug that couldn't be reproduced across a reasonably thorough sweep of the obvious candidates.
  - [ ] If a future repro succeeds, identify the actual cause (candidates: a stacking-context side-effect from `transform`/`opacity`/`filter` on an ancestor of `WizardNavigation`; content overflow at a specific viewport; a genuine missing offset specific to some state not yet tested) and fix at the source, not with an arbitrarily higher rail `z-index`. Add a Playwright viewport-specific layout assertion once the repro is known (Vitest/jsdom can't assert real paint/layout bugs).

## Dev Notes

- **Reserved-slot pattern, no product UI ships from this story.** This story ships the wizard *mechanism* only — chrome, hook, empty registry, route — with zero real steps wired in. It mirrors Stories 0.7, 0.8, 0.9, 0.12, 0.13, 0.23's identical "build the reusable capability now, let the first real feature register into it" precedent. Story 3.1 (`ready-for-dev`) is the first real consumer and already dictates the exact registry entry shape this story must produce — read `_bmad-output/implementation-artifacts/3-1-onboarding-wizard-for-api-key-and-subscriptions.md` Task 4 in full before implementing Task 4 of this story; do not invent a different registry shape.
- **Why Step Summary needs no per-step persisted "was this step completed" state:** `useWizardStep()`'s `isStepCompleted` only ever tracks the *current* step (per `EXPERIENCE.md`'s literal contract). Step Summary still needs to show every *earlier* step as "Completed." This is resolved without any extra tracking: a step earlier than the current one **must** have been completed to reach the current step at all (`Next`/`Complete` are disabled until `isStepCompleted`, and step transitions are real Next.js route navigations, not client-only index changes) — so "Completed" is simply `index < currentIndex`, derived structurally from the route, never stored. `Skip Step` complicates this only cosmetically: a skipped step will still show a "Completed" checkmark once passed (there is no 4th "Skipped" visual state in `DESIGN.md` to render instead), which is an accepted, spec-consistent simplification, not a defect.
- **Why no explicit step-state reset logic is needed:** each `[stepSlug]` is a distinct dynamic route segment. Navigating from one step to the next is a real Next.js navigation to a different page instance, which naturally remounts `WizardStepProvider` (and its `useState(false)`) fresh — there is no client-side-only step index to accidentally leak stale `isStepCompleted` state across steps. Building explicit reset-on-`stepSlug`-change logic into the provider would be solving a problem that doesn't exist here (avoid over-engineering per the project's own "don't build for hypothetical needs" convention).
- **`packages/ui` vs. `apps/web` boundary:** the chrome (`WizardStepSummary`, `WizardNavigation`) and the hook (`useWizardStep`/`WizardStepProvider`) are generic, dependency-free of any specific wizard's content — they belong in `packages/ui` per `project-context.md`'s Code Organization rule (reusable components → `packages/ui/src/core/`, reusable hooks → `packages/ui/src/hooks/`). The registry (`wizard-registry.ts`) and the route itself must live in `apps/web`: the registry holds direct references to app-level Client Components (e.g. Story 3.1's `OnboardingApiKeyStep`), and `packages/ui` cannot import from `apps/web` without inverting the monorepo's app→package dependency direction. This split was confirmed during this story's own Gate 1/3 pass (see below) and is not optional/a matter of preference.
- **No shared `Button` primitive exists in `packages/ui` yet** (only a local, non-reusable `apps/web/src/components/ui/button.tsx` from an earlier Shadcn scaffold) — `WizardNavigation` uses raw `<button>` + Tailwind classes, exactly like the existing `NavRailItem.tsx` precedent, rather than importing the app-local Shadcn button (which would invert the dependency direction) or inventing a new shared Button component (out of scope — no other `packages/ui` core primitive does this today, and one apparent 2nd-need doesn't yet justify extracting it, per the project's own established bar, see Story 0.22's `activeOnly()` precedent: extract shared abstractions once ≥2 real call sites exist, not speculatively).
- **Open-redirect guard on the `redirect` search param (AC10):** `redirect` is a plain, unauthenticated, user/attacker-visible URL query parameter (e.g. shareable in a phishing link). Nothing in `epics.md`'s literal AC text calls for validating it, but using an unvalidated value as a client-side navigation target is a real, avoidable open-redirect exposure — `isSafeRedirectPath` (same-origin relative path only) closes it at negligible cost and matches how `redirect` is actually always used by every currently-known consumer (Story 3.1's own `redirect=/settings/subscriptions`). This is a security-correctness addition, not scope creep.
- **Desktop-only, no responsive/mobile requirement.** `EXPERIENCE.md`'s Foundation section states `Platform: Web (Desktop)` — this story does not implement or test a mobile/responsive layout for the wizard chrome; a future story would need to extend this scope explicitly if mobile support is later required.
- **AC12 addendum (2026-08-24) — this is exactly the gap the line above flagged, now surfaced as a real bug report.** This story was built and verified against the wizard chrome in isolation (per the manual smoke check in Task 7, which never mentions the app shell/sidenav rail at all) — it was never checked composed inside `AppShellWrapper`'s actual sidenav rail at any breakpoint, despite `[locale]/layout.tsx` wrapping every route (including `/wizard/...`) in that shell. The "Desktop-only" framing above turns out to have meant "no mobile *tab-bar* breakpoint considered," not "verified against the desktop *rail* breakpoints either." See AC12/Task 8.

### Architecture & UX Gate Findings

- **Gate 1 (Architecture/Infrastructure Completeness) — run fresh via a Winston-persona pass**, since `epic-0-readiness.md`'s `swept: true` report's `stories_covered` list stops at `0.19` and does not include this story (mirrors Story 0.23's identical situation and the `story-split-gate.md` escape-hatch guard). **Verdict: No gap.** This story is pure frontend — a registry, a Next.js route, a React hook/provider, and next-intl strings. No external service call, no new backend/API surface, no queue/IaC involvement, no bypass of the adapter pattern (not applicable here).
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness) — run fresh, same reason as Gate 1 above.** Initial pass surfaced a real, since-resolved gap: this story's route needs a `<Suspense>` boundary (its client content reads `useSearchParams()` for `redirect`), and `project-context.md`'s Route-Level Suspense Fallback rule mandates the fallback be `<RouteLoader />` (Story 0.26). At the time this gap was first identified, Story 0.26 was still `backlog` with no `RouteLoader` component in the codebase — a real forward-dependency question, presented to the user via `AskUserQuestion` (hard-dependency-on-0.26 vs. ship-with-temporary-fallback). **Before the user's answer was needed, re-verification showed Story 0.26 had since moved to `review` — `packages/ui/src/core/route-loader.tsx` and `LogoMark.tsx` are implemented and exported from `@festgrid/ui`'s public entry point** (confirmed via `git log`: commit `1b40a08` "Implement RouteLoader component and integrate into multiple routes"). **Resolved: no gap, no dependency needed.** This story uses `<RouteLoader />` directly from day one, same as every other route created after Story 0.26. `epics.md`'s existing `Depends on: Story 0.6, Story 0.7` line is left unchanged (Story 0.26 is not a real code dependency now that it's already implemented — same standing as any other already-shipped primitive this story happens to reuse).
  - A secondary Gate 3 finding (also resolved, not a gap requiring a new story): the `packages/ui`-vs-`apps/web` boundary for the chrome/hook/registry (see Dev Notes above) needed to be pinned down explicitly in this story rather than left for the implementer to guess — done above, not a missing foundational dependency, just a clarification this story's own drafting needed to make.
- **Gate 2 (UI Complexity & Reusability) — run fresh via a Freya-persona pass**, since this story is itself the product of a prior Gate 2 finding (split out of Story 3.1's own creation). The pass asked whether Story 0.24's own scope needs *further* internal splitting. **Verdict: No further split.** Step Summary, Navigation, and the `useWizardStep()`/`WizardStepProvider` pair are one cohesive primitive with three interdependent facets (none has standalone utility outside a wizard route, unlike the `EventCard`/`EventListView`/`EventDiscoveryPanel` precedent splits, where each half is independently consumed elsewhere) — bundling them in one story is correct, and the story's scope is comparable in size to several other single-story primitives (`1.6a`, `1.3e`). The pass surfaced two spec details this draft needed to make explicit (both resolved above/in the ACs): connecting-line fill rendering between steps (AC3), and confirming Step Summary is non-interactive since neither `DESIGN.md` nor `EXPERIENCE.md` specifies a click-to-navigate affordance (AC3).

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: No changes required.** This story introduces no database schema, no migration, and no new GraphQL contract — it is a pure frontend mechanism (a React Context/hook, two presentational components, an in-memory TypeScript registry object, and a Next.js route).
- **Impacted fields/contracts:** New, purely additive TypeScript types only: `WizardStepDefinition`/`WizardDefinition` (`apps/web/src/features/wizard/wizard-registry.types.ts`), `WizardStepSummaryProps`/`WizardNavigationProps` (`packages/ui/src/core/wizard/*.types.ts`). No existing type's shape changes.
- **AC12 amendment (2026-08-24):** no data/schema impact — a layout/CSS-only fix, exact file(s) TBD pending Task 8's live reproduction step.
- **AC12 amendment Gate note (lightweight guard only, no subagent — user-approved for this small batch, `sprint-change-proposal-2026-08-24-ux-rework-batch.md` companion story-creation pass):** a visual layout fix confined to existing, already-shipped chrome components — no new component, no new data flow. No gap found for Gates 1/3 (no backend/infra touch). Gate 2 is intentionally *not* waved through the same way — Task 8 itself requires live browser verification before the fix is written, which is a stronger check than a persona subagent would provide for a bug that static review couldn't fully diagnose.
- **Required DB migration changes:** None.
- **Required TypeScript type changes:** None beyond the new additive types above.
- **Backward compatibility and rollout notes:** Greenfield addition; `wizardRegistry` ships empty, so no existing route or component is affected by this story landing. Story 3.1 is the first to add a registry entry.
- **Verification checks:** `useWizardStep.test.tsx` (provider/hook contract, including the throws-outside-provider guard and fresh-instance-resets-state proof); `WizardStepSummary.test.tsx`/`WizardNavigation.test.tsx` (all visual/button states); `wizard-page-content.test.tsx` (route composition, notFound, redirect propagation/validation) using an in-test fixture registry since the shipped registry is empty; `metadata-key.test.ts`/`is-safe-redirect-path.test.ts` (100% coverage on both pure helpers per Testing Rules — see note below on their package placement).

### Project Structure Notes

- **New (`packages/ui`):** `src/hooks/useWizardStep.tsx` (+ `.test.tsx`), `src/core/wizard/{WizardStepSummary.tsx, WizardStepSummary.types.ts, WizardNavigation.tsx, WizardNavigation.types.ts, index.ts}` (+ `.test.tsx` files).
- **New (`apps/web`):** `src/features/wizard/{wizard-registry.ts, wizard-registry.types.ts, metadata-key.ts, is-safe-redirect-path.ts}` (+ `.test.ts` files); `src/app/[locale]/wizard/[wizardKey]/[stepSlug]/{page.tsx, wizard-page-content.tsx}` (+ `.test.tsx`).
- **Modified:** `packages/ui/src/index.ts` (new `export * from './core/wizard';`), `packages/ui/src/hooks/index.ts` (new `useWizardStep` export), `apps/web/locales/{en,id}.json` (new `WizardChrome` namespace).
- **Not modified:** `packages/database` (no schema change), `apps/backend` (no backend involvement), `apps/infrastructure` (no new AWS resource), `docs/infrastructure/*` (no new architecture-diagram node/edge — pure frontend mechanism), `packages/domain` (this story's helpers are UI/routing-specific — kebab→PascalCase metadata-key building and redirect-path validation — not portable cross-entity business logic, so they stay in `apps/web/src/features/wizard/` rather than `packages/domain`).
- **`metadata-key.ts`/`is-safe-redirect-path.ts` placement rationale:** both are small, pure, framework-agnostic functions, which might look like `packages/domain` candidates at first glance — but `packages/domain`'s Testing Rule (100% coverage, "only place unit tests should be written") is scoped to *portable business logic* reusable across `apps/web`/`apps/backend`; these two helpers are Next.js-routing/i18n-key-naming-specific with no backend use case, so they stay local to the feature that needs them (`apps/web/src/features/wizard/`), consistent with how Story 3.1's own `onboarding`-specific helpers stay local rather than in `packages/domain`.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 0.24`] — this story's authoritative AC text and `Note`/`Depends on` this story addresses directly.
- [Source: `_bmad-output/planning-artifacts/epics.md#Story 0.26`] — Route-Level Suspense Fallback's originating story; confirmed `review`/implemented, resolving this story's own Gate 3 finding.
- [Source: `_bmad-output/implementation-artifacts/3-1-onboarding-wizard-for-api-key-and-subscriptions.md`] — read in full; the authoritative, already-drafted (`ready-for-dev`) consumer contract this story's registry/metadata-key naming must match exactly (Task 4's registry entry example, the per-step `Metadata.wizard<Key><Slug>Title` naming, the `Wizards.<wizardKey>.steps.<slug>` i18n shape).
- [Source: `_bmad-output/implementation-artifacts/0-23-build-the-system-error-reporting-and-alerting-foundation.md`] — read for Dev Notes/Gate-Findings structure precedent and the `epic-0-readiness.md` `stories_covered` escape-hatch reasoning this story mirrors.
- [Source: `_bmad-output/implementation-artifacts/0-26-build-the-reusable-routeloader-component.md`, `packages/ui/src/core/route-loader.tsx`, `packages/ui/src/core/app-shell/LogoMark.tsx`, `packages/ui/src/index.ts`] — confirmed `RouteLoader`'s current, already-shipped, no-props implementation and its public export, resolving this story's Gate 3 finding.
- [Source: `_bmad-output/planning-artifacts/epic-readiness/epic-0-readiness.md`] — confirmed `swept: true` but `stories_covered` stops at `0.19`; basis for running Gate 1/3 fresh.
- [Source: `_bmad-output/planning-artifacts/story-split-gate.md`] — gate definitions, execution protocol, numbering rule, epic-level sweep mode, escape-hatch guard.
- [Source: `design-artifacts/UX-wizard-page-run-1/DESIGN.md`, `EXPERIENCE.md`] (status: final) — the authoritative Step Summary/Navigation visual spec and `useWizardStep()`/flow contract this story implements; the deliberate deviation from `EXPERIENCE.md`'s original URL-query-param `steps` design to a code-defined registry (per user decision recorded in Story 3.1's own creation) is already accepted and not re-litigated here.
- [Source: `packages/ui/src/hooks/useScopedLocale.tsx`] — read in full; the Provider+hook-in-one-file structure `useWizardStep.tsx` mirrors, including the fail-fast-vs-silent-default judgment call precedent.
- [Source: `packages/ui/src/core/app-shell/NavRailItem.tsx`, `packages/ui/src/core/blocking-loader.tsx`, `packages/ui/src/core/blocking-loader.types.ts`, `packages/ui/src/core/app-shell/index.ts`] — read in full; the raw-`<button>`-with-Tailwind convention (no shared `Button` primitive exists), the component/`.types.ts` file-pairing convention, and the subfolder-with-`index.ts` convention (`app-shell/`) this story's new `core/wizard/` folder mirrors.
- [Source: `apps/web/src/lib/metadata.ts`, `apps/web/src/app/[locale]/favorites/page.tsx`, `apps/web/src/app/[locale]/events/[slug]/page.tsx`, `apps/web/src/app/[locale]/layout.tsx`] — read in full; the `buildPageMetadata`/`generateMetadata` pattern, the Server `page.tsx` + Client `*-content.tsx` split convention, and the current (post-Story-0.26) `<Suspense fallback={<RouteLoader />}>` usage this story's route mirrors exactly.
- [Source: `apps/web/src/app/[locale]/favorites/favorites-content.test.tsx`, `packages/ui/src/hooks/useSoftDeleteWithUndo.test.ts`] — read in full; the `NextIntlClientProvider`-wrapped component test convention and the `renderHook`/`act` hook test convention this story's new test files follow.
- [Source: `apps/web/locales/en.json`, `apps/web/locales/id.json`, `apps/web/locales/locales.test.ts`] — read in full; confirmed the flat-namespace-object convention, real (non-placeholder) Indonesian translation requirement, and the automated key-parity test new namespaces must satisfy.
- [Source: `_bmad-output/project-context.md#Critical-Implementation-Rules, #Code-Quality-Style-Rules`] — Route-Level Suspense Fallback rule, Dynamic Page Title & Meta Tags rule, Code Organization (`packages/domain`/`packages/ui` split, hooks placement), i18n rules (`next-intl`, locale-sensitive rendering).

## Global Rules References

- `_bmad-output/project-context.md` — Route-Level Suspense Fallback (`<RouteLoader/>`), Dynamic Page Title & Meta Tags (`generateMetadata`, server-side `getTranslations`), Code Organization (`packages/ui` core/hooks split, `packages/domain` scope), i18n (`next-intl`, locale JSON parity).
- `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order/status vocabulary followed in this file.
- `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — no architecture-spine `AD-*` rule applies directly to this pure-frontend-UI-mechanism story (no data, auth, or query-DSL surface touched); confirmed via Gate 1/3 pass above.
- `docs/infrastructure/index.md` — confirmed no shard update needed; this story adds no backend compute, queue, or database resource.
- `_bmad-output/planning-artifacts/story-split-gate.md` — Gate 1/2/3 definitions and the escape-hatch guard invoked in this story's own creation.

## Implementation Plan (Rule-Compliant)

### File Change Plan

- **New (`packages/ui`):** `src/hooks/useWizardStep.tsx` + `.test.tsx`; `src/core/wizard/WizardStepSummary.tsx` + `.types.ts` + `.test.tsx`; `src/core/wizard/WizardNavigation.tsx` + `.types.ts` + `.test.tsx`; `src/core/wizard/index.ts`.
- **New (`apps/web`):** `src/features/wizard/wizard-registry.ts` + `.types.ts`; `src/features/wizard/metadata-key.ts` + `.test.ts`; `src/features/wizard/is-safe-redirect-path.ts` + `.test.ts`; `src/app/[locale]/wizard/[wizardKey]/[stepSlug]/page.tsx`; `src/app/[locale]/wizard/[wizardKey]/[stepSlug]/wizard-page-content.tsx` + `.test.tsx`.
- **AC12 amendment (2026-08-24):** file(s) to change determined by Task 8's live-reproduction step — likely one of `wizard-page-content.tsx`, `WizardNavigation.tsx`, or `AppShell.tsx`, not predetermined.
- **Modified:** `packages/ui/src/index.ts`; `packages/ui/src/hooks/index.ts`; `apps/web/locales/en.json`; `apps/web/locales/id.json`.

### Rule Mapping

- Route-Level Suspense Fallback rule → `<Suspense fallback={<RouteLoader />}>` in `page.tsx` (Task 5).
- Dynamic Page Title & Meta Tags rule → Server `generateMetadata` via `getTranslations`/`buildPageMetadata`, no client-side title mutation (Task 5).
- `packages/ui` core/hooks split rule → chrome components in `src/core/wizard/`, hook in `src/hooks/useWizardStep.tsx` (Tasks 1-3).
- `packages/domain` scope rule (why these helpers are NOT in `packages/domain`) → see Dev Notes → Project Structure Notes placement rationale (Task 4).
- i18n rule (no hardcoded strings, locale parity) → `WizardChrome` namespace in both `en.json`/`id.json` (Task 6), verified by `locales.test.ts`.
- Security correctness (open-redirect prevention, not an explicit epics.md AC but required by "don't introduce OWASP-class vulnerabilities") → `isSafeRedirectPath` (Task 4/5, AC10).
- Testing Rules (`packages/domain` 100% coverage doesn't apply here since no logic lives there; testing-trophy approach for `apps/web`/`packages/ui`) → integration tests per component/hook/route (Tasks 1-6).

### Verification Plan

- `pnpm --filter ui test` — new hook/component tests pass, no regression.
- `pnpm --filter web test` — new registry/route/helper tests pass, `locales.test.ts` still passes (WizardChrome key parity).
- `pnpm build && pnpm lint` clean at repo root.
- Manual smoke check per Task 7 (temporary local 2-step registry fixture, since the shipped registry is empty).

## Pre-Coding Approval Gate

- [ ] Scope confirmation: this story builds the wizard chrome (`WizardStepSummary`, `WizardNavigation`), the `useWizardStep()`/`WizardStepProvider` hook, an **empty** wizard registry, the `/wizard/[wizardKey]/[stepSlug]` route, and two small helper utilities (metadata-key naming, redirect-path safety) — it wires zero real wizard flows (that is Story 3.1's scope).
- [ ] Architecture and boundary confirmation: chrome/hook in `packages/ui` (core + hooks), registry/route/helpers in `apps/web` (per the Dev Notes boundary rationale) — confirmed, not left to implementer discretion.
- [ ] Testing plan confirmation: unit/integration coverage for the hook, both chrome components, both helpers, and the route's client content, per Task 1-6's test files above.
- [ ] Explicit human approval state (Default: **pending approval**).
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted: Gate 1 — no gap. Gate 3 — RouteLoader/Story 0.26 gap **resolved** (Story 0.26 is `review`/implemented, `RouteLoader` exists and is exported; no dependency needed, confirmed via `git log` re-verification during this story's own creation). Gate 2 — no further split; two spec ambiguities (connecting-line fill, Step Summary non-interactivity) resolved directly in the ACs above.

## Testing Requirements

- [ ] Unit: `useWizardStep.test.tsx` (provider/hook contract, throws-outside-provider, fresh-instance isolation).
- [ ] Unit: `WizardStepSummary.test.tsx`, `WizardNavigation.test.tsx` (all visual/button states from AC3/AC4).
- [ ] Unit: `metadata-key.test.ts`, `is-safe-redirect-path.test.ts` (kebab→PascalCase naming; safe-vs-unsafe redirect path cases including protocol-relative and absolute-URL attack vectors).
- [ ] Integration: `wizard-page-content.test.tsx` (registry lookup/`notFound`, chrome composition, redirect propagation/validation, Complete navigation) using an in-test fixture registry.
- [ ] E2E: not required as a dedicated flow — this story ships no real, user-reachable wizard flow yet (empty registry); Story 3.1's own E2E/manual-smoke coverage is the first meaningful end-to-end exercise of this mechanism, per the project's testing-trophy philosophy.

## Deliverables Checklist

- [ ] `useWizardStep()` hook + `WizardStepProvider` (`packages/ui/src/hooks/useWizardStep.tsx`), exported from `packages/ui`.
- [ ] `WizardStepSummary` and `WizardNavigation` components (`packages/ui/src/core/wizard/`), exported from `packages/ui`.
- [ ] Wizard chrome verified live against `AppShell`'s sidenav rail at both rail breakpoints (768–1279px, ≥1280px) with no visual overlap (AC12, added 2026-08-24).
- [ ] Empty, correctly-typed `wizardRegistry` (`apps/web/src/features/wizard/wizard-registry.ts`) matching Story 3.1's expected entry shape.
- [ ] `buildWizardMetadataKeys` and `isSafeRedirectPath` helpers with 100%-equivalent test coverage.
- [ ] `/wizard/[wizardKey]/[stepSlug]` route (`page.tsx` + `wizard-page-content.tsx`) with `generateMetadata`, `notFound()` handling, and `<RouteLoader />` Suspense fallback.
- [ ] `WizardChrome` i18n namespace in both `en.json`/`id.json`.
- [ ] All new/modified files pass `pnpm build`/`pnpm lint`/`pnpm test` at the repo root.

## Out of Scope

- Any real wizard registry entry (e.g. `onboarding`) and its step content components — Story 3.1's scope.
- Mobile/responsive layout for the wizard chrome — `EXPERIENCE.md`'s Foundation section scopes this story to Web (Desktop) only.
- A shared `packages/ui` `Button` primitive — `WizardNavigation` uses raw styled `<button>` elements per existing `NavRailItem` precedent; extracting a shared Button is not this story's concern and isn't yet justified by call-site count.
- Click-to-navigate on Step Summary items — not specified by `DESIGN.md`/`EXPERIENCE.md`; Step Summary is display-only in this story.
- A 4th "Skipped" visual state distinct from "Completed" — `DESIGN.md` defines only 3 states; a skipped step displays identically to a completed one once passed.

## Definition of Done

- [ ] AC1-AC11 satisfied.
- [ ] All tests listed under Testing Requirements passing, no regression in existing `packages/ui`/`apps/web` suites (including `locales.test.ts`).
- [ ] Lint and type checks passing for `packages/ui` and `apps/web`.
- [ ] `pnpm build` succeeds at the repo root.

## Completion Status

ready-for-dev

**2026-08-24 (`bmad-create-story`):** Reopened for AC12 only (wizard chrome vs. sidenav rail visual collision, `ux-rework-2026-08-24.md` item #9 — see `sprint-change-proposal-2026-08-24-ux-rework-batch.md`). AC1-AC11 remain as originally delivered. Unlike this batch's other three stories, the root cause could not be pinned down by static review alone.

**2026-08-24, later same day — live-verified, not reproduced.** Ran the app and screenshotted the wizard chrome at 4 viewport widths (500/768/1024/1440px) — no collision with the sidenav rail or mobile bottom tab bar at any of them. See Task 8. This story is not blocked, but AC12 cannot be implemented against a bug that doesn't reproduce in the states tested — needs more specific repro info before further work.

## Dev Agent Record

### Agent Model Used
- Claude 3.5 Sonnet

### Debug Log References
- Vitest UI and Web tests passed completely.
- Web production build compiled and verified successfully.

**Amended 2026-08-13:** the wizard page chrome now also renders a wizard-level title/description (`Wizards.${wizardKey}.title`/`description`), rendered once above `WizardStepSummary`, distinct from and in addition to the existing per-step `Wizards.${wizardKey}.steps.${stepSlug}.title`/`description` shown inside the step card. Added because Story 3.2's new `/settings/subscriptions` → wizard redirect (see below) can land a user in the wizard with no prior context; every wizard registry entry (currently just `onboarding`, Story 3.1) must supply both a wizard-level and per-step set of i18n keys going forward.

### Completion Notes List
- Built the entire wizard routing mechanism, wizard-registry, and helper utilities.
- Implemented `useWizardStep()` and `WizardStepProvider` to manage and share client-side step completion states.
- Implemented presentational components `WizardStepSummary` and `WizardNavigation` to render standard styled Wizard chrome.
- Implemented kebab-to-PascalCase metadata key generator helper and same-origin safe relative redirect path safety guard helper.
- Implemented the Next.js `/wizard/[wizardKey]/[stepSlug]` Sever page route and client router content wrapper to coordinate step navigation and redirect preservation.
- Sourced and populated translations for both English and Indonesian locales.

### File List
- `packages/ui/src/hooks/useWizardStep.tsx`
- `packages/ui/src/hooks/useWizardStep.test.tsx`
- `packages/ui/src/hooks/index.ts`
- `packages/ui/src/core/wizard/WizardStepSummary.types.ts`
- `packages/ui/src/core/wizard/WizardStepSummary.tsx`
- `packages/ui/src/core/wizard/WizardStepSummary.test.tsx`
- `packages/ui/src/core/wizard/WizardNavigation.types.ts`
- `packages/ui/src/core/wizard/WizardNavigation.tsx`
- `packages/ui/src/core/wizard/WizardNavigation.test.tsx`
- `packages/ui/src/core/wizard/index.ts`
- `packages/ui/src/index.ts`
- `apps/web/src/features/wizard/wizard-registry.types.ts`
- `apps/web/src/features/wizard/wizard-registry.ts`
- `apps/web/src/features/wizard/metadata-key.ts`
- `apps/web/src/features/wizard/metadata-key.test.ts`
- `apps/web/src/features/wizard/is-safe-redirect-path.ts`
- `apps/web/src/features/wizard/is-safe-redirect-path.test.ts`
- `apps/web/src/app/[locale]/wizard/[wizardKey]/[stepSlug]/page.tsx`
- `apps/web/src/app/[locale]/wizard/[wizardKey]/[stepSlug]/wizard-page-content.tsx`
- `apps/web/src/app/[locale]/wizard/[wizardKey]/[stepSlug]/wizard-page-content.test.tsx`
- `apps/web/locales/en.json`
- `apps/web/locales/id.json`
