---
baseline_commit: 4b923e79824416a6f051eb2cb53861b9f6b9f5b5
---

# Story 0.42: Build the shared Ambient Capability Ask banner slot primitive

## Story Details

- Epic: 0
- Story ID: 0.42
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

<!--
Standalone Epic 0 story with its own epics.md section (Story 0.42, added 2026-09-19 via a
Gate 2 finding while drafting Story 0.39 -- EXPERIENCE.md's "Ambient Capability Ask: Shared
Banner Slot" section, added 2026-09-18 (one day after Story 0.38 was drafted), retroactively
generalized the already-drafted PWA install banner (Story 0.38) into the first of two
participants in one shared mechanism. Neither consuming story's own scope builds the actual
orchestration mechanism -- 0.38 predates the shared-slot UX pass; 0.39 only supplies its own
banner content. User confirmed the split via AskUserQuestion. See epics.md Story 0.42's own
Note and Story 0.39's Dev Notes for the full three-way split rationale (0.42 = this story,
the generic slot; 0.38 = PWA participant, amended in place; 0.39 = location participant).

This story has ZERO dependency on Story 0.38/0.38a/0.39 -- they depend on IT (0.38's Task
4.3/4.4 and 0.39's Task 5 both require this story `done` first). Neither 0.38a's
`pwa-install-store.ts` nor 0.39's `viewer-location-store.ts` exists in the codebase yet (both
`ready-for-dev`, unimplemented) -- this story cannot assume either file exists at
implementation time, and may well land before both. See Dev Notes for how this affects the
Zustand-store precedent this story follows.

Gates 1/2/3 run fresh for this story specifically (not skipped via `epic-0-readiness.md`,
which is scoped only to Stories 0.1-0.19, predating this class of story entirely -- confirmed
directly, same gap already noted by Stories 0.34-0.41's own Dev Notes). All three returned
"No gap found"; see Architecture & UX Gate Findings below for the absorbable refinements
folded into this story's ACs/Dev Notes as a result.
-->

## Story

As a FestDaily frontend developer building ambient, non-blocking "capability ask" banners
(starting with Story 0.38's PWA install prompt and Story 0.39's viewer-location consent ask),
I want one shared, app-level mount point and orchestration mechanism — a slot in `AppShell`,
a priority-ordered "who wins" hook, a session-scoped dismiss flag, and the shared banner
chrome style constants — that any current or future ambient ask plugs into,
so that Story 0.38's and Story 0.39's banners (and any future ambient ask) share one real
mechanism instead of each hardcoding its own placement, and the app can never literally stack
two ambient banners at once.

## Acceptance Criteria

### AppShell slot mount point

1.  **Given** `AppShell.tsx`'s `<main>` renders only `{children}` today, with no
    ambient-banner mount point anywhere in the codebase (confirmed by direct read:
    `packages/ui/src/core/app-shell/AppShell.tsx`'s `<main>` is
    `<main className="...">{children}</main>`, nothing else),
    **when** this story ships,
    **then** `AppShellProps` gains a new optional prop `ambientBanner?: ReactNode`, and
    `<main>` renders it as the **first child**, immediately before `{children}`
    (`<main ...>{ambientBanner}{children}</main>`) — below the global nav, across every
    route, since `<main>` is shared by the whole app tree.
2.  **Given** the new prop, **when** `AppShell` is rendered without it (every existing
    caller/test/story that doesn't pass it), **then** nothing new renders and existing
    behavior is byte-for-byte unchanged — matching `AppShellProps`'s existing
    optional-prop-defaults-to-hidden pattern (e.g. `moderatorPendingItemCount = 0`,
    `avatarUrl?`).
3.  **Given** `packages/ui` must stay framework-agnostic (project-context.md's Adapter
    Pattern / decoupling principle, already enforced elsewhere in `AppShell.tsx`),
    **when** this prop is added, **then** `AppShell.tsx` gains **no** new import of
    `next-intl`, `zustand`, or any `apps/web`-only module — it has zero knowledge of what
    capability produced the `ReactNode`, exactly like every other `ReactNode`/render-prop
    already accepted by this component (`children`, `renderLink`).

### Orchestration hook: priority, one-at-a-time, session-dismissal

4.  **Given** a new `apps/web`-only type `AmbientCapabilityAskParticipant = { id: string;
    canShow: boolean }` and a new hook `useAmbientCapabilityAskSlot(participants:
    AmbientCapabilityAskParticipant[]): string | null`
    (`apps/web/src/lib/hooks/useAmbientCapabilityAskSlot.ts`),
    **when** it is called with an ordered array of participants,
    **then** **list position is the priority order** — index 0 is highest priority — never a
    separate numeric priority field; a future third participant joins by its position in the
    array the caller passes, not a config change inside this hook.
5.  **Given** the priority order in AC4, **when** the hook resolves a winner,
    **then** it returns the `id` of the **first** (highest-priority) participant in the array
    whose `canShow` is `true`; if none has `canShow: true`, it returns `null`.
6.  **Given** the slot's own session-dismiss flag (AC8-9) is `true`,
    **when** the hook resolves a winner (regardless of AC5's outcome),
    **then** it returns `null` unconditionally — no participant wins for the rest of that
    session, even one with `canShow: true` and top priority. This check is evaluated
    **before** AC5's priority scan (a dismissed slot short-circuits; it never even needs to
    inspect `canShow` values once dismissed).
7.  **Given** the hook's return value must react to a participant's `canShow` changing
    mid-session (e.g. Story 0.39's `permissionStatus` flipping from `'granted'` to
    `'prompt'` is not a real scenario, but a dismiss/cooldown state resolving certainly is),
    **when** any input changes across re-renders,
    **then** the hook is **not** memoized against its own prior return value — it
    recomputes the winner from the current `participants` array and the current
    `dismissedThisSession` flag on every render, exactly like a plain derived-state
    selector (no internal caching that could return a stale winner). This is a one-way
    reactivity floor only: once `dismissedThisSession` becomes `true` (AC6), the recompute
    still always yields `null`, since that flag itself doesn't reset mid-session (AC8).

### Session-scoped dismiss store

8.  **Given** "session" for this slot means the current page/tab lifetime (EXPERIENCE.md:
    "the next eligible ask only appears on a later session/page load"), **when** a new
    `apps/web`-only Zustand store is created
    (`apps/web/src/lib/state/ambient-capability-ask-slot-store.ts`, `useAmbientCapabilityAskSlotStore`,
    AD-4-compliant — interface-driven states/actions, mirroring the one real existing
    precedent in this repo, `apps/web/src/lib/state/example-ui-store.ts`'s
    shape/doc-comment style, since neither Story 0.38a's `pwa-install-store.ts` nor Story
    0.39's `viewer-location-store.ts` exists in the codebase yet to mirror instead — see Dev
    Notes),
    **then** it holds exactly `{ dismissedThisSession: boolean; markDismissedThisSession: ()
    => void }`, initialized to `dismissedThisSession: false`, held **in-memory only** — no
    `localStorage`/`sessionStorage` persistence of any kind, so a hard reload or a new tab
    starts with a fresh, `false` flag.
9.  **Given** the store in AC8, **when** `markDismissedThisSession()` is called (by any
    participant's own dismiss action — each participant's "Not now"/"Remind me in 2 weeks"
    handler is responsible for calling both its own persisted dismissal and this action,
    per Dev Notes; this story itself never calls it, since it wires no real participant),
    **then** `dismissedThisSession` flips to `true` and stays `true` for the remainder of
    that page/tab's lifetime — there is no "un-dismiss" action; the only way it returns to
    `false` is a fresh reload/new tab re-initializing the store.
10. **Given** this store's single flag is deliberately about "did the *slot* show something
    and get dismissed this session," **when** compared to each participant's own persisted
    per-participant dismiss/cooldown state (Story 0.38a's `pwa-install-storage.ts`, Story
    0.39's `viewer-location-storage.ts` — both `localStorage`-persisted, participant-owned,
    surviving across sessions),
    **then** this story's store never reads, writes, or duplicates that per-participant
    state in any way — the two are structurally distinct concerns (this session-only,
    theirs multi-session-persisted) and must never be merged into one flag, or the two
    stories' independently-evolving state will drift and contradict each other (the same
    boundary Story 0.39's own Gate 3 finding already encodes from the other side).

### Shared banner chrome token module

11. **Given** DESIGN.md's `ambient_capability_banner` component tokens (`base`,
    `dismiss_permanent`, `dismiss_cooldown` — the base shape and dismiss-button pairing
    every ambient ask extends, per DESIGN.md's own comment: "one base shape, one
    dismiss-button pairing -- every ambient ask ... extends this rather than each restyling
    its own bar"), **when** a new `packages/ui/src/core/ambient-capability-banner-tokens.ts`
    module is created, **then** it exports a single `ambientCapabilityBannerTokens` object
    (plain data, no component/JSX, importable by both `apps/web` and any future `packages/ui`
    consumer) shaped as:
    ```ts
    export const ambientCapabilityBannerTokens = {
      base: 'w-full flex items-center justify-between gap-4 px-4 py-3 bg-violet-50 border-b border-violet-200 text-sm',
      dismissPermanent: 'py-2 px-4 rounded-md font-semibold bg-gray-200 text-gray-800',
      dismissCooldown: 'text-violet-700 underline text-xs font-medium',
    } as const;
    ```
    `base` and `dismissCooldown` are DESIGN.md's own literal, already-resolved Tailwind
    strings, copied verbatim. `dismissPermanent` resolves DESIGN.md's
    `{components.button.secondary}` reference by inlining DESIGN.md's own already-documented
    `components.button.base` (`"py-2 px-4 rounded-md font-semibold"`) +
    `components.button.secondary` (`"bg-gray-200 text-gray-800"`) strings, per DESIGN.md's
    own token-composition convention — **not** the live shadcn `Button` component's own
    `variant="secondary"` CVA output (`bg-secondary text-secondary-foreground`, a
    theme-variable-driven class that currently renders visually differently); see Dev Notes
    for why this divergence is deliberate and what it means for a future consumer.
12. **Given** the token module in AC11, **when** exported, **then** it is added to
    `packages/ui/src/index.ts`'s barrel (`export * from './core/ambient-capability-banner-tokens';`),
    matching every other `core/` primitive's export convention (`page-container`,
    `page-header`, `route-loader`, etc.).
13. **Given** DESIGN.md's tokens carry **no** transition/animation class for
    `ambient_capability_banner` (confirmed: `base`/`dismiss_permanent`/`dismiss_cooldown`
    are the complete token set, no `transition-*`/`animate-*` entry), **when** this story
    ships, **then** it introduces **no** enter/exit transition or animation of its own for
    the slot's content swap (mount, unmount, or winner change) — a deliberate,
    spec-consistent choice, not an oversight (see Architecture & UX Gate Findings). Any
    future animation is each rendered participant component's own concern (e.g. Story
    0.38's `PwaInstallBanner` wrapping itself in a transition), not this slot's.

### End-to-end wiring (no real participant yet)

14. **Given** `AppShellWrapper.tsx` is the sole real caller of `AppShell` today,
    **when** this story ships, **then** it is updated to call
    `useAmbientCapabilityAskSlot(participants)` with **whatever real participants exist at
    the time this story ships** — initially an **empty array**, since Story 0.38 and Story
    0.39 (the only two participants that will ever exist) both land after this story and
    each registers itself only once its own story is implemented — and to pass the
    resolved winner into `AppShell`'s new `ambientBanner` prop. Since there is no real
    participant yet, the resolved winner is always `null` and `ambientBanner` is always
    `undefined` at the end of this story — this is expected, not a bug: AC15's test harness
    is what actually exercises the hook's real logic; this wiring proves only that the
    plumbing compiles and runs end-to-end with zero participants, not that a real banner
    renders (no real banner exists yet to render).
15. **Given** this story wires no real participant, **when** it ships, **then** it
    additionally ships a minimal, isolated test harness / mock-participant test suite
    (unit/integration level, not a new page or route) proving the full contract in
    isolation: fixed priority by list position (AC4), highest-priority-`canShow`-wins
    (AC5), session-dismissal suppressing everyone (AC6), and per-render reactivity (AC7) —
    using two or three mock `{ id, canShow }` participants and directly driving
    `markDismissedThisSession()`, not real `PwaInstallBanner`/`AmbientLocationBanner`
    components (which don't exist yet).

## Tasks / Subtasks

- [x] Task 1: `AppShell` slot mount point (AC: #1, #2, #3)
  - [x] 1.1 Added `ambientBanner?: ReactNode` to `AppShellProps` in
        `packages/ui/src/core/app-shell/AppShell.tsx`; rendered as `<main>`'s first child,
        before `{children}`.
  - [x] 1.2 Created `AppShell.test.tsx` (first test file for this component): asserts
        `<main>` renders `ambientBanner` before `children` when provided, and renders
        unchanged (no extra node) when omitted. No new import was added beyond the
        already-imported `ReactNode` type (confirmed by inspection — zero new imports in
        the diff).
- [x] Task 2: Zustand session-dismiss store (AC: #8, #9, #10)
  - [x] 2.1 Created `apps/web/src/lib/state/ambient-capability-ask-slot-store.ts` exporting
        `useAmbientCapabilityAskSlotStore` (interface-driven per AD-4 rule 3, mirroring
        `example-ui-store.ts`'s shape/doc-comment style).
  - [x] 2.2 Added `ambient-capability-ask-slot-store.test.ts`: initial state is
        `dismissedThisSession: false`; `markDismissedThisSession()` flips it to `true` and
        it stays `true` across repeated reads.
- [x] Task 3: The orchestration hook (AC: #4, #5, #6, #7)
  - [x] 3.1 Created `apps/web/src/lib/hooks/useAmbientCapabilityAskSlot.ts` exporting the
        `AmbientCapabilityAskParticipant` type and the `useAmbientCapabilityAskSlot(participants)`
        hook, composing Task 2's store with a pure priority-scan over `participants`.
  - [x] 3.2 Added `useAmbientCapabilityAskSlot.test.ts` via `renderHook`: covers AC5
        (priority-by-position, highest-`canShow`-wins, all-`false`→`null`, empty array→`null`),
        AC6 (dismissed→`null` regardless of `canShow`/priority), AC7 (re-render with a
        changed `participants` array, and a mid-session dismiss, both yield an updated
        result — 7 tests total, doubling as AC15's mock-participant test harness.
- [x] Task 4: `AppShellWrapper.tsx` end-to-end wiring (AC: #14)
  - [x] 4.1 Updated `apps/web/src/components/layout/AppShellWrapper.tsx`: calls
        `useAmbientCapabilityAskSlot([])` (empty participants array), looks up the resolved
        winning `id` against a (currently empty) `Record<string, ReactNode>` mapping, and
        passes the result (always `undefined` today) into `AppShell`'s new `ambientBanner`
        prop. Structured so Story 0.38/0.39 each add one array entry + one mapping case.
  - [x] 4.2 Added `AppShellWrapper.test.tsx` (new — none existed): mocks `AppShell` to
        capture its received props, confirms the wrapper renders without error with the
        empty-participants wiring and that `AppShell` receives `ambientBanner={undefined}`.
- [x] Task 5: Shared token module (AC: #11, #12, #13)
  - [x] 5.1 Created `packages/ui/src/core/ambient-capability-banner-tokens.ts` exporting
        `ambientCapabilityBannerTokens` exactly per AC11.
  - [x] 5.2 Added `ambient-capability-banner-tokens.test.ts`: asserts the exported object's
        three string values match DESIGN.md's documented tokens verbatim.
  - [x] 5.3 Added the new module to `packages/ui/src/index.ts`'s barrel exports.
- [x] Task 6: Full-suite verification (AC: #1-#15)
  - [x] 6.1 `pnpm --filter web test` (405/405, 63 files) and `pnpm --filter ui test`
        (548/548, 54 files) — no regression.
  - [x] 6.2 `pnpm lint` clean (0 errors, repo-wide); `apps/web tsc --noEmit` shows only
        pre-existing baseline errors, none in any file this story touches.
  - [x] 6.3 `pnpm --filter web build` succeeds, no build-time errors.

## Dev Notes

- **This story is a pure prerequisite with zero real UI output.** After this story ships,
  the app visually looks identical to before it — no banner can render because no
  participant is registered yet (Task 4.1's array is empty). That is the expected, correct
  end state; do not "invent" a placeholder participant just to prove something renders. The
  proof of correctness is Task 3.2's hook-level test (real logic, mocked participants) plus
  Task 1.2/4.2 (real end-to-end wiring compiles and runs with zero participants).
- **Neither `pwa-install-store.ts` (Story 0.38a) nor `viewer-location-store.ts` (Story 0.39)
  exists in this codebase yet** — both stories are `ready-for-dev`, unimplemented, at the
  time this story was drafted. epics.md's own Story 0.42 section says to mirror
  `pwa-install-store.ts`'s shape, but that file doesn't exist to mirror. This story instead
  mirrors the one real, already-shipped precedent, `example-ui-store.ts`. Implementation
  order among 0.38a/0.39/0.42 is not fixed by any dependency (0.42 depends on neither; they
  depend on 0.42 only for their own later banner-mounting tasks) — if `pwa-install-store.ts`
  happens to land first, a human/dev-agent reviewing this story later should confirm this
  store's doc-comment/shape stayed consistent with it, but should **not** block on it.
- **`dismissPermanent`'s resolved class string deliberately does not match the live shadcn
  `Button` component's own `variant="secondary"` output** (`bg-secondary
  text-secondary-foreground`, theme-CSS-variable-driven — confirmed by reading
  `packages/ui/src/core/ui/button.tsx`'s `buttonVariants` CVA config). DESIGN.md's
  `components.button.secondary` token is documented as a flat, literal string
  (`bg-gray-200 text-gray-800`), not a reference to the installed Button component's actual
  variant classes, and the two currently render visibly differently. This story exports
  DESIGN.md's literal, documented value verbatim (least-surprise: matches what the design
  spec actually says, and this token module's whole purpose is to be DESIGN.md's source of
  truth in code) rather than silently substituting the live component's differently-themed
  secondary variant. **Consequence for Story 0.38/0.39's own implementation:** apply
  `ambientCapabilityBannerTokens.dismissPermanent` as a plain `className` on a bare
  `<button>` for "Not now" — do **not** pass it as `className` into the shared `<Button
  variant="secondary">` component, since that component's own internal CVA classes would
  partially override/conflict with this literal string rather than compose cleanly with it.
  If a future design pass reconciles DESIGN.md's token with the live Button component's
  real secondary styling, that reconciliation updates this token module's `dismissPermanent`
  value in one place — every consuming banner picks it up automatically.
- **No animation/transition (AC13) is a deliberate reading of a silent spec, not a gap left
  unresolved.** DESIGN.md's `ambient_capability_banner` token block has no transition class
  today, and EXPERIENCE.md's "share this slot's own container/animation" line describes an
  *intent* (a shared look-and-feel) rather than a concrete, specified animation this story
  could implement — there is nothing to build against. Recorded explicitly rather than left
  implicit, per Gate 2's finding (see Architecture & UX Gate Findings).
- **State Management Architecture categorization (required by project convention):** the
  session-dismiss flag is **Client Global State (zustand)** — ephemeral, crosses component
  boundaries (any current/future participant banner + `AppShellWrapper`), not server data,
  not URL-shareable, and explicitly *not* persisted (in-memory only), distinguishing it from
  every other `localStorage`-backed dismiss/cooldown value in this codebase (Story 0.38a's,
  Story 0.39's). The `useAmbientCapabilityAskSlot` hook itself holds no state of its own —
  it is a pure derived-value selector over its `participants` argument and the Zustand
  store.
- **Loader categorization:** N/A — this story has no async operation, data fetch, or
  mutation of any kind; the hook is a synchronous, pure priority computation.
- **No cloud/external service setup required** — no new third-party integration;
  `SETUP_WALKTHROUGH.md` needs no update.
- **No i18n (AD-6) required by this story.** This story renders no user-facing text of its
  own (per AC13/the "this story does not itself render any banner content" rule already in
  epics.md) — no locale keys are added to `en.json`/`id.json`. i18n for the actual banner
  copy is each participant story's own responsibility (Story 0.38, Story 0.39).
- **No analytics (AD-5) required by this story.** No user-trackable interaction exists here
  — `markDismissedThisSession()` is called only by a real participant's own dismiss action
  (Story 0.38/0.39's own scope), and neither exists yet. Those stories' own ACs already
  enumerate their PostHog events; this story adds none of its own.
- **Package-boundary note:** `useAmbientCapabilityAskSlot`/the Zustand store are correctly
  `apps/web`-only (Zustand strictly isolated to `apps/web` per project-context.md's State
  Management Architecture rule); `ambient-capability-banner-tokens.ts` is correctly
  `packages/ui`-only plain-data (no React, no framework import), consumable from
  `apps/web`/`packages/ui`/future contexts alike.
- **`apps/web/src/lib/hooks/` is a new subdirectory.** No existing custom hook file lives
  there yet (existing `apps/web` hooks — `use-nearby-filter.ts`,
  `use-require-moderator.ts`, `use-has-api-key.ts` — are kebab-case and colocated with their
  feature directory, not in a shared `lib/hooks/` folder). This story's hook file uses
  camelCase (`useAmbientCapabilityAskSlot.ts`) instead, deliberately matching — not
  contradicting — the exact directory and naming convention Story 0.38a's
  `usePwaInstallPrompt.ts` and Story 0.39's `useViewerLocation.ts` already committed to in
  their own (already-drafted, `ready-for-dev`) story files, since all three hooks are meant
  to live side-by-side in the same new directory and interoperate; diverging here would
  force one of the three to be renamed later. This is a direct interoperability constraint
  with two already-fixed sibling stories, not a fresh, un-precedented convention pick.

### Architecture & UX Gate Findings

- **Gate 1 — Architecture/Infrastructure Completeness (Winston):** No gap found. Every
  artifact in this story's scope is frontend-only, within existing package boundaries: the
  `AppShell.tsx` change is a pure `ReactNode` prop addition with zero new imports (no
  `zustand`/`next-intl` awareness, preserving `packages/ui`'s framework-agnostic
  constraint); the orchestration hook and Zustand store are correctly `apps/web`-only
  (AD-4); the new `packages/ui/src/core/` tokens module exports static style constants, not
  logic or state. No DB/ORM/Drizzle call, no third-party service call, no new GraphQL
  surface, no auth/business logic, no new infra. This is pure client-side wiring plumbing.
  Minor corrections from this pass, folded in above: explicit AD-5/AD-6 N/A notes (Dev
  Notes), the `example-ui-store.ts` mirroring correction (Dev Notes, since neither sibling
  store exists yet), and the flat `packages/ui/src/core/` placement (no subfolder needed —
  a single-file constants module, unlike `app-shell/`'s multi-file component cluster).
- **Gate 2 — UI Complexity & Reusability (Freya):** No split required. The orchestration
  hook is a pure priority-selector over an already-computed `canShow` list plus one boolean
  read from the session store — no data fetching, no side effects of its own (dismissal is
  explicitly participant-owned per AC10/AC14), single call site (`AppShellWrapper`); it does
  not fit Gate 2's "fetching + derived state + side effects" complexity trigger, so there is
  nothing left here to further decompose — the reusable piece (slot + hook + store + tokens)
  is already isolated as its own story, which **is** Gate 2's split remedy already applied
  (this story exists because of a Gate 2 finding on Story 0.39's draft). One real UX-spec
  coverage gap found and resolved: EXPERIENCE.md's "share this slot's own container/
  **animation**" line had no corresponding AC or DESIGN.md token — resolved via AC13
  (explicitly no animation, since DESIGN.md specifies none) rather than left silent. A
  second, non-blocking observation (the hook should recompute every render, not memoize)
  is folded into AC7 rather than left to implementation-time guesswork. The "ships with a
  mock-participant test harness rather than waiting for a real first consumer" sequencing
  (unlike Story 0.38a's precedent of shipping alongside its first two real consumers) was
  confirmed reasonable: Task 4's real end-to-end `AppShellWrapper` wiring (with a zero-length
  participants array) already catches prop-threading/integration issues early, and the
  `{ id, canShow }` contract is small enough that residual wrong-shaped-contract risk for
  Story 0.38/0.39 is low.
- **Gate 3 — Foundational/Cross-Cutting Dependency Completeness (Winston):** No gap found.
  This story *is* the correctly-identified foundational piece — it exists specifically
  because Stories 0.38 and 0.39 would otherwise each reinvent it, exactly what Gate 3 exists
  to catch elsewhere. It stands up nothing new and homeless: `AppShell`/`AppShellWrapper` are
  already-built, already-global (the only caller across every route), so this extends
  existing shared chrome rather than creating a new one; `packages/ui/src/core/` already
  exists as the prescribed home for domain-agnostic primitives; the `apps/web` Zustand
  pattern already exists (`example-ui-store.ts`). No i18n keys needed (this story renders no
  copy), no GraphQL/codegen touch, no new analytics foundation (no real interaction wired
  here). Correctly scoped as prerequisite-only, consumed by exactly the two stories already
  named in epics.md.
- No `epic-0-readiness.md` sweep citation applies — that report is scoped only to Stories
  0.1-0.19 (confirmed directly, same gap already noted by Stories 0.34-0.41's own Dev
  Notes). All three gates were run fresh via subagent dispatch for this story's drafting.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** No mismatch — this story touches no database, no GraphQL
  schema, and no shared cross-package type (`packages/shared-types`). All new types
  (`AmbientCapabilityAskParticipant`, the store's state/actions interface, the tokens
  object's shape) are local to `apps/web`/`packages/ui` respectively.
- **Impacted fields/contracts:** None outside `apps/web`/`packages/ui`. The
  `AmbientCapabilityAskParticipant = { id: string; canShow: boolean }` shape is the one
  cross-story contract Story 0.38 and Story 0.39 must match exactly when they later register
  their own participants (`{ id: 'pwa-install', canShow }` / `{ id: 'location', canShow }`
  respectively, per their own already-drafted ACs) — if this shape changes, both consuming
  stories' own drafts need a corresponding update.
- **Required DB migration changes:** No changes required.
- **Required TypeScript type changes:** New local types/interfaces only (enumerated in Tasks
  1-3, 5); no existing type is modified.
- **Backward compatibility and rollout notes:** Purely additive everywhere except
  `AppShell.tsx` and `AppShellWrapper.tsx`, and even there the change is a new optional prop
  defaulting to no-op (AC2) plus a new hook call resolving to an empty/no-op result (AC14) —
  no existing consumer of either file needs any change of its own.
- **Verification checks:** `AppShell.test.tsx` (new — prop-present vs. prop-omitted
  behavior); `ambient-capability-ask-slot-store.test.ts`; `useAmbientCapabilityAskSlot.test.ts`
  (full priority/dismissal/reactivity matrix via `renderHook`); `ambient-capability-banner-tokens.test.ts`
  (drift guard against DESIGN.md); `AppShellWrapper` empty-participants wiring test; lint +
  typecheck + build clean.

### Project Structure Notes

- New files: `apps/web/src/lib/state/ambient-capability-ask-slot-store.ts` (+ test),
  `apps/web/src/lib/hooks/useAmbientCapabilityAskSlot.ts` (+ test),
  `packages/ui/src/core/ambient-capability-banner-tokens.ts` (+ test),
  `packages/ui/src/core/app-shell/AppShell.test.tsx` (new — first test file for this
  component).
- Updated files: `packages/ui/src/core/app-shell/AppShell.tsx` (new `ambientBanner` prop),
  `apps/web/src/components/layout/AppShellWrapper.tsx` (hook wiring),
  `packages/ui/src/index.ts` (new barrel export).
- `apps/web/src/lib/hooks/` is a new directory (see Dev Notes) — created here, expected to
  be reused verbatim by Story 0.38a and Story 0.39.
- No conflicts detected against the unified project structure.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-0.42]
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-4,#AD-5,#AD-6]
- [Source: design-artifacts/UX-festgrid-run-1/EXPERIENCE.md#Ambient-Capability-Ask-Shared-Banner-Slot]
- [Source: design-artifacts/UX-festgrid-run-1/DESIGN.md#ambient_capability_banner,#button]
- [Source: packages/ui/src/core/app-shell/AppShell.tsx — current `<main>{children}</main>`
  state, read in full for this story]
- [Source: apps/web/src/components/layout/AppShellWrapper.tsx — current sole real caller,
  read in full for this story]
- [Source: apps/web/src/lib/state/example-ui-store.ts — Zustand store reference pattern
  actually mirrored (neither sibling store exists yet)]
- [Source: packages/ui/src/core/ui/button.tsx — live shadcn `Button` `buttonVariants` CVA
  config, cross-checked against DESIGN.md's `components.button.secondary` token]
- [Source: _bmad-output/implementation-artifacts/0-38-cache-embedjs-preconnect-and-pwa-install-prompt.md,
  0-38a-build-the-pwa-install-eligibility-hook.md,
  0-39-ambient-viewer-location-capability.md — the two dependent stories and their own
  amendment notes referencing this one]
- [Source: _bmad-output/project-context.md#State-Management-Architecture,
  #Code-Organization, #UI-Components-and-Scalability]
- [Source: _bmad-output/planning-artifacts/story-split-gate.md]

## Global Rules References

- [ ] `_bmad-output/project-context.md` — State Management Architecture (Client Global
      State/zustand categorization, `apps/web` isolation, in-memory-only distinction),
      UI Components & Scalability (`packages/ui/core` flat-file placement)
- [ ] `_bmad-output/planning-artifacts/story-content-structure.md` — this story follows its
      canonical section order and status vocabulary
- [ ] Architecture spine (`_bmad-output/planning-artifacts/festgrid-architecture-spine.md`)
      — AD-4 (state), AD-5/AD-6 both explicitly N/A for this story's own scope (see Dev
      Notes)
- [ ] Infrastructure docs (`docs/infrastructure/index.md`) — no backend/SQS/Lambda/DB
      change; a pure frontend-state-and-UI-primitive story needs only the index summary

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - New: `apps/web/src/lib/state/ambient-capability-ask-slot-store.ts` (+ test),
    `apps/web/src/lib/hooks/useAmbientCapabilityAskSlot.ts` (+ test),
    `packages/ui/src/core/ambient-capability-banner-tokens.ts` (+ test),
    `packages/ui/src/core/app-shell/AppShell.test.tsx`
  - Update: `packages/ui/src/core/app-shell/AppShell.tsx`,
    `apps/web/src/components/layout/AppShellWrapper.tsx`, `packages/ui/src/index.ts`
- **Rule Mapping:**
  - Zustand store confined to `apps/web/src/lib/state/`, interface-driven, in-memory-only →
    AD-4 rule 3 + project-context.md's package-dependency isolation rule.
  - `useAmbientCapabilityAskSlot` in `apps/web/src/lib/hooks/`, camelCase filename → direct
    interoperability with Story 0.38a's/0.39's already-fixed sibling filenames in the same
    new directory (Dev Notes).
  - `ambientCapabilityBannerTokens` in `packages/ui/src/core/`, plain data, no React import
    → project-context.md's UI-reusability + framework-agnostic-`packages/ui` rules.
  - `AppShell`'s new prop defaults to no-op when omitted → project-context.md's/this
    component's own existing optional-prop precedent + Data Type Compatibility's backward-
    compatibility finding.
  - No new locale keys, no new PostHog events → AD-5/AD-6 both explicitly N/A (Dev Notes),
    since this story renders no user-facing content or interaction of its own.
- **Verification Plan:**
  - `AppShell.test.tsx` (prop-present vs. prop-omitted rendering).
  - `ambient-capability-ask-slot-store.test.ts` (initial state, `markDismissedThisSession`
    persistence within the store instance).
  - `useAmbientCapabilityAskSlot.test.ts` via `renderHook` (priority-by-position,
    highest-`canShow`-wins, dismissed-suppresses-all, per-render reactivity).
  - `ambient-capability-banner-tokens.test.ts` (values match DESIGN.md verbatim).
  - `AppShellWrapper` wiring test/story (empty-participants path renders without error).
  - `pnpm --filter web test`, `pnpm --filter ui test`, `pnpm lint`, `pnpm build` all green.

## Pre-Coding Approval Gate

- [x] Scope confirmation — `AppShell` slot prop + priority/one-at-a-time/session-dismissal
      orchestration hook + session-only Zustand store + shared token module +
      zero-participant end-to-end wiring + isolated mock-participant test coverage
      (EXPERIENCE.md "Ambient Capability Ask: Shared Banner Slot"); explicitly excludes
      building or wiring any real banner content (Story 0.38's `PwaInstallBanner`, Story
      0.39's `AmbientLocationBanner`) and any animation/transition for the slot itself.
- [x] Architecture and boundary confirmation — Gate 1/2/3 all returned "No gap found" (see
      Architecture & UX Gate Findings); the `dismissPermanent` DESIGN.md-vs-live-Button
      divergence (Dev Notes) is understood and will be followed as documented (literal
      DESIGN.md string, applied to a bare `<button>`, not passed into the shared `<Button>`
      component).
- [x] Testing plan confirmation — component test (`AppShell`), store test, hook test (via
      `renderHook`, doubling as the required mock-participant harness), token-drift test,
      and an `AppShellWrapper` wiring test, all agreed per Testing Requirements below.
- [x] Explicit human approval state — approval to proceed with 0.42 (as the required
      prerequisite for 0.39/Task 5) was given explicitly by the user via `AskUserQuestion`
      when resuming Story 1.i1f's follow-on work ("Build 0.42 too, then all of 0.39").
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted — N/A: this story has no
      prerequisite of its own (it is the prerequisite Story 0.38 and Story 0.39 both depend
      on).

## Testing Requirements

- [x] Unit tests: `ambient-capability-ask-slot-store.test.ts` (initial state +
      `markDismissedThisSession` persistence), `useAmbientCapabilityAskSlot.test.ts`
      (full priority/dismissal/reactivity matrix via `renderHook`, doubling as AC15's
      required mock-participant test harness), `ambient-capability-banner-tokens.test.ts`
      (values match DESIGN.md verbatim)
- [x] Integration tests: `AppShellWrapper` wiring test confirming the empty-participants
      path renders without error and passes `ambientBanner={undefined}` through to
      `AppShell`
- [x] Component tests: `AppShell.test.tsx` (new prop present vs. omitted)
- [x] E2E tests: none new — no user-visible surface exists yet (no real banner renders
      until Story 0.38/0.39 land); nothing meaningful for Playwright to exercise here

## Deliverables Checklist

- [x] `AppShell.tsx` gains the `ambientBanner?: ReactNode` prop, rendered first inside
      `<main>`, with zero new framework-specific imports; `AppShell.test.tsx` covers both
      branches
- [x] `ambient-capability-ask-slot-store.ts` (Zustand, in-memory-only, AD-4-compliant)
      implemented and tested
- [x] `useAmbientCapabilityAskSlot.ts` implemented matching this story's exact documented
      contract (AC4-AC7), with `renderHook`-based tests covering the full matrix
- [x] `ambient-capability-banner-tokens.ts` implemented per AC11, exported from
      `packages/ui/src/index.ts`, with a DESIGN.md-drift-guard test
- [x] `AppShellWrapper.tsx` wired end-to-end with an empty participants array, structured so
      Story 0.38/0.39 each need only one array entry + one mapping case to add their own
      participant later
- [x] All new/extended tests passing; lint, typecheck, and build clean

## Out of Scope

- Building or wiring `PwaInstallBanner` (Story 0.38) or `AmbientLocationBanner` (Story
  0.39) — both are separate stories' own scope, each consuming this story's exports once
  implemented.
- Any animation/transition for the slot's content (mount, unmount, or winner change) — no
  DESIGN.md token specifies one (AC13); left to a future participant component's own
  concern if ever needed.
- Any PostHog analytics event or locale/i18n message key — this story renders no
  user-facing content or interaction of its own (Dev Notes' AD-5/AD-6 N/A findings).
- Reconciling DESIGN.md's literal `components.button.secondary` token value with the live
  shadcn `Button` component's own `variant="secondary"` CVA output — flagged as a real,
  pre-existing divergence in Dev Notes, not resolved or silently papered over by this
  story.

## Definition of Done

- [x] AC1-AC15 satisfied
- [x] Required unit/component/integration tests passing (store, hook/mock-participant
      harness, tokens, `AppShell`, `AppShellWrapper` wiring)
- [x] Lint and type checks passing for the `web` and `ui` packages
- [x] `pnpm build` succeeds

## Completion Status

- [x] Complete — ready for code review.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (`claude-sonnet-5`), via `bmad-dev-story`.

### Debug Log References

- Implemented as the explicit prerequisite for Story 0.39's Task 5 (the user requested "0.39
  and also wire the current location into story 1.i1f"; 0.39's own Pre-Coding Gate requires
  0.42 `done` first — confirmed via `AskUserQuestion` before starting).
- No deviations from the story's own ACs/Tasks. `AppShellWrapper.tsx`'s empty-participants
  wiring uses a plain `Record<string, ReactNode>` lookup keyed by the winning participant
  `id` (rather than a `switch`), matching Task 4.1's "one mapping case" framing literally —
  Story 0.39's own Task 5.3 adds the real `'location'` entry to both the `participants` array
  and this mapping object without touching any other line.

### Completion Notes List

- All 6 tasks complete. `AppShell.tsx` gained the `ambientBanner` slot (zero new imports);
  `useAmbientCapabilityAskSlotStore` (Zustand, in-memory-only) and
  `useAmbientCapabilityAskSlot()` (priority-scan orchestration hook) both implemented and
  unit-tested (10 new tests total); `ambientCapabilityBannerTokens` created and barrel-exported
  from `packages/ui`; `AppShellWrapper.tsx` wired end-to-end with an empty participants array.
  Verified: `packages/ui` 548/548 tests (+6), `apps/web` 405/405 tests (+10), `pnpm --filter
  web build` succeeds, repo-wide `pnpm lint` clean (0 errors), `tsc --noEmit` shows only
  pre-existing baseline errors untouched by this story.

### File List

**New:**
- `packages/ui/src/core/app-shell/AppShell.test.tsx`
- `packages/ui/src/core/ambient-capability-banner-tokens.ts`
- `packages/ui/src/core/ambient-capability-banner-tokens.test.ts`
- `apps/web/src/lib/state/ambient-capability-ask-slot-store.ts`
- `apps/web/src/lib/state/ambient-capability-ask-slot-store.test.ts`
- `apps/web/src/lib/hooks/useAmbientCapabilityAskSlot.ts`
- `apps/web/src/lib/hooks/useAmbientCapabilityAskSlot.test.ts`
- `apps/web/src/components/layout/AppShellWrapper.test.tsx`

**Modified:**
- `packages/ui/src/core/app-shell/AppShell.tsx`
- `packages/ui/src/index.ts`
- `apps/web/src/components/layout/AppShellWrapper.tsx`
