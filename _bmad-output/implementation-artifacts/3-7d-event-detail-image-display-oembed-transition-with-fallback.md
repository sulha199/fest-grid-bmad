---
baseline_commit: f6763c06103264e47f6aa3a3f5a5d00f24c34d89
---
# Story 3.7d: Event-detail image display — oEmbed transition with fallback

## Story Details

- Epic: 3
- Story ID: 3.7d
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user viewing an event's detail page,
I want the source Instagram post shown as a proper platform embed rather than a bare hotlinked image,
so that the display reads as clearly platform-sanctioned rather than presenting the image as FestDaily's own.

## Acceptance Criteria

1. **AC1 — Embed replaces hotlinked image (epics.md AC1):** Given an event's detail page renders its source post, when `Event.instagramEmbed.status === 'AVAILABLE'` (Story 3.7e's resolver field), then the media column renders the new `InstagramEmbed` component (rendering the embed `html` Story 3.7e supplies) instead of `EventImage`'s raw hotlinked `imageUrl`.
2. **AC2 — No regression for non-Instagram / no-embed-data events (regression guard, added during this story's creation):** Given `Event.instagramEmbed` is `null`/absent (non-Instagram source post, or Story 3.7e hasn't shipped/populated it yet), when `EventDetailView` renders, then the media column renders exactly the existing `EventImage` hotlink/video/fallback path (Story 1.6a), byte-for-byte unchanged — this story introduces no behavior change for any event whose source is not an available Instagram embed.
3. **AC3 — Lifecycle window unaffected (epics.md AC2):** This story does not change the existing 7-30 day Discovery→Archive display-window lifecycle for personal-data-bearing images (referenced in the minimization doc §3.3, not yet designed anywhere) — the embed is a retention/copyright display improvement, not a personal-data-exposure fix, and remains subject to that same bound whenever it's built. No AC/task in this story implements or blocks on that lifecycle mechanism.
4. **AC4 — Unavailable, non-opted-in → "content no longer available" (epics.md AC3):** Given the source post is deleted, the account is private, or the embed otherwise fails (`Event.instagramEmbed.status === 'UNAVAILABLE'`) for a NON-opted-in account (`Event.instagramEmbed` carries no `durableImageUrl`), when the detail page renders, then `InstagramEmbed` shows a defined "content no longer available" state — it does NOT fall back to a raw hotlinked `Post.imageUrl`, and does NOT render a broken-image icon.
5. **AC5 — Unavailable, opted-in → durableImageUrl fallback (epics.md AC4):** Given the same failure for an OPTED-IN account (`Event.instagramEmbed.status === 'UNAVAILABLE'` but a non-null `durableImageUrl` is present, per Story 3.7e's opt-in-aware resolver), when the detail page renders, then `InstagramEmbed` renders that `durableImageUrl` via the existing `EventImage` image path (composition, not reimplementation) — acceptable since storage was already consented to (Story 3.6g/3.6h).
6. **AC6 — profileImageUrl never independently rendered (epics.md AC5):** `SocialMediaAccountProfile.profileImageUrl` is never independently rendered by this story's new code, in either the embed or fallback state — confirmed as already true of `EventDetailView`'s existing account-attribution rendering (it renders `accountPlatformIconUrl` only inside `SubscribedAccountCard`, never a standalone `profileImageUrl` `<img>`), and this story must not introduce a new one. The oEmbed's own Instagram-chrome avatar (Instagram's UI, rendered inside the embed `html`, not FestDaily's) is not equivalent to FestDaily displaying the profile photo itself and is explicitly acceptable.
7. **AC7 — Layout-stable loading state (Gate 2 finding, UX-spec gap):** While the embed's `html` is loading/rendering (async script/iframe readiness), `InstagramEmbed` renders a skeleton placeholder matching `EventImage`'s existing media-slot dimensions (`max-h-[70vh] min-h-[200px]`, same container treatment) so no Cumulative Layout Shift occurs when the embed becomes ready — per this project's "Keep Skeletons in Sync With Their Real Component" and "Non-Blocking (Initial Load)" UI invariants (project-context.md). No authoritative `DESIGN.md`/`EXPERIENCE.md` content specifies this embed's visual treatment (confirmed absent by Gate 2's fresh check) — this AC is the escape-hatch default: reuse `EventImage`'s existing container/placeholder visual language (the same `bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden` treatment and `ImageIcon`-based empty state) for both the loading and "content no longer available" states, rather than inventing new iconography.
8. **AC8 — Accessible embed region (Gate 2 finding, a11y):** The rendered embed region is wrapped with an accessible label (e.g. `role="region"` + `aria-label`, sourced through the `labels` override prop per this component's i18n pattern) so assistive technology announces it as "embedded post" content rather than an unlabeled iframe; the "content no longer available" and loading states are likewise announced (e.g. `aria-live="polite"` on state transitions, `aria-busy` while loading, matching `EventDetailView`'s own established `aria-busy` convention from Story 1.6a AC8).
9. **AC9 — i18n-ready microcopy:** All new internally-rendered microcopy ("content no longer available" message, the loading-state accessible label, the embed-region `aria-label`) is exposed via optional fields on `InstagramEmbed`'s own `labels` prop (with sensible English defaults), following the exact `EventDetailViewLabels`/`EventImage` labels-prop precedent (AD-6) — no direct `next-intl` dependency inside `packages/ui`. New locale keys required at the `apps/web` call site (`EventDetailsPage` next-intl namespace, `locales/en.json` and `locales/id.json`): `contentNoLongerAvailableLabel`, `embedLoadingLabel`, `embedRegionLabel`.

## Tasks / Subtasks

- [ ] 1. **(AC1, AC2, AC5)** Create `packages/ui/src/features/events/InstagramEmbed.tsx` — a new dedicated component (not a branch bolted onto `EventImage.tsx`, per Gate 2's finding that this is a distinct rendering paradigm: third-party widget/iframe content vs. this project's self-rendered `<img>`/`<video>`) implementing a 4-state machine: `loading` (AC7), `available` (renders the embed `html`, AC1), `unavailable-with-fallback` (composes the existing `<EventImage imageUrl={durableImageUrl} .../>` internally, AC5 — reuse, not reimplementation), `unavailable-no-fallback` (AC4's "content no longer available" state, reusing `EventImage`'s placeholder visual language per AC7's escape-hatch).
- [ ] 2. **(AC1, AC5, AC9)** Define `InstagramEmbedProps`/`InstagramEmbedLabels` in `packages/ui/src/features/events/InstagramEmbed.types.ts`: `status: 'AVAILABLE' | 'UNAVAILABLE' | null | undefined`, `html?: string | null`, `durableImageUrl?: string | null`, `durableImageAlt?: string | null`, `eventName: string`, `labels?: InstagramEmbedLabels` (all label fields optional with English defaults).
- [ ] 3. **(AC1, AC8)** Render the embed `html` inside a labeled, `aria-busy`/`aria-live`-appropriate container (AC8); since the `html` string is Instagram's own oEmbed markup (trusted, backend-fetched from Meta's own API by Story 3.7e — not arbitrary user input), render it via a controlled `dangerouslySetInnerHTML` on a dedicated child element, and load Instagram's `embed.js` widget script (once per page, idempotent — guard against duplicate script tags across multiple embeds/navigations) so the injected `<blockquote class="instagram-media">`-style markup actually renders as the rich embed; call `window.instgrm?.Embeds?.process()` after the script loads and after `html` changes, mirroring the documented `embed.js` re-process pattern.
- [ ] 4. **(AC7)** Implement the `loading` state: shown from mount until the widget's embed actually becomes visually ready (there is no clean "embed ready" DOM event from `embed.js` — use a short, documented heuristic such as a `requestAnimationFrame`/timeout-based reveal after `Embeds.process()` resolves, or track the injected iframe's presence via a `MutationObserver` on the container — document whichever approach is implemented in Dev Agent Record, since this is a real implementation judgment call, not a spec'd behavior), using the same container dimensions/skeleton treatment as `EventImage`'s existing placeholder (no new skeleton component).
- [ ] 5. **(AC4, AC7)** Implement the `unavailable-no-fallback` state's "content no longer available" placeholder, reusing `EventImage`'s existing `ImageIcon`-in-centered-container visual pattern, with the AC9 `contentNoLongerAvailableLabel` message and AC8's accessible announcement.
- [ ] 6. **(AC1, AC2, AC4, AC5)** Update `packages/ui/src/features/events/EventDetailView.tsx`'s "Left Column: Media" block: add `instagramEmbedStatus?`, `instagramEmbedHtml?`, `instagramEmbedDurableImageUrl?` props to `EventDetailViewProps` (`EventDetailView.types.ts`); when `instagramEmbedStatus` is present (`'AVAILABLE'` or `'UNAVAILABLE'`), render `<InstagramEmbed status=... html=... durableImageUrl=... durableImageAlt={imageAlt} eventName={eventName} labels={...} />` in place of the existing `<EventImage .../>` call; when `instagramEmbedStatus` is `null`/`undefined`, render `<EventImage .../>` exactly as today (AC2 — no regression).
- [ ] 7. **(AC9)** Add `InstagramEmbedLabels`' three new keys to `EventDetailViewLabels` as pass-through optional fields (mirroring how `videoUnavailableLabel` was threaded through in Story 1.6a's amendment), so `apps/web`'s single `useEventDetailViewLabels()` hook can supply all of them from one next-intl namespace.
- [ ] 8. **(AC1-AC9)** Export `InstagramEmbed`/`InstagramEmbedProps`/`InstagramEmbedLabels` from `packages/ui/src/features/events/index.ts` and re-export via `packages/ui/src/index.ts`.
- [ ] 9. **(Testing)** Write `packages/ui/src/features/events/InstagramEmbed.test.tsx` (Vitest + `@testing-library/react`, `@festgrid/testing-config/vitest-react`): loading state renders with `aria-busy`/matching dimensions; `AVAILABLE` renders the embed container and calls the mocked `embed.js`/`instgrm.Embeds.process()` path; `UNAVAILABLE` + no `durableImageUrl` renders the "content no longer available" state with the correct label; `UNAVAILABLE` + `durableImageUrl` renders the composed `EventImage` fallback with the correct `imageUrl`; `labels` overrides are honored; the embed region carries the AC8 accessible attributes.
- [ ] 10. **(Testing, AC2)** Update `packages/ui/src/features/events/EventDetailView.test.tsx`: new test asserting `InstagramEmbed` renders (not `EventImage`) when `instagramEmbedStatus` is set; new test asserting `EventImage` renders unchanged when `instagramEmbedStatus` is absent (confirm existing image/video tests still pass unmodified — regression proof for AC2).
- [ ] 11. **(AC1, AC5, `apps/web` wiring — blocked on Story 3.7e's GraphQL field shipping)** Add `instagramEmbed { status html durableImageUrl }` to the `getEventBySlug` query in `apps/web/src/features/events/queries.graphql`; run `pnpm --filter web codegen` to regenerate `apps/web/src/generated/graphql.ts` against Story 3.7e's real schema.
- [ ] 12. **(AC1, AC5, `apps/web` wiring)** Update `apps/web/src/features/events/mapper.ts`'s `mapGraphQLEventToDetailViewProps` to map `event.instagramEmbed?.status`/`html`/`durableImageUrl` onto the new `EventDetailViewProps` fields (Task 6).
- [ ] 13. **(AC9, i18n)** Add `contentNoLongerAvailableLabel`, `embedLoadingLabel`, `embedRegionLabel` to the `EventDetailsPage` next-intl namespace in `apps/web/src/locales/en.json` and `apps/web/src/locales/id.json`, and wire them into `useEventDetailViewLabels()` (`apps/web/src/features/events/EventDetailWrapper.tsx`/`mapper.ts`).
- [ ] 14. **(Testing, `apps/web`)** Update or add an MSW-backed integration test covering `EventDetailWrapper`/the event-detail route rendering the `InstagramEmbed` path when `getEventBySlug`'s mocked response includes `instagramEmbed`, and the unchanged `EventImage` path when it doesn't.
- [ ] 15. **(Verification)** `pnpm --filter @festgrid/ui test`, `pnpm --filter @festgrid/ui lint`; `pnpm --filter web test`, `pnpm --filter web lint`, `pnpm --filter web build` (codegen must succeed against Story 3.7e's shipped schema); root `pnpm build`/`pnpm lint`/`pnpm test` for no regressions.

## Dev Notes

### Architecture & UX Gate Findings

Epic 3's readiness sweep (`epic-readiness/epic-3-readiness.md`, `swept: true`, dated 2026-08-09) predates this story — Stories 3.7c/3.7d were added 2026-09-02 via `bmad-correct-course` and were never covered by that sweep. Per `story-split-gate.md`'s lightweight guard (this story introduces a wholly new external-platform integration the sweep couldn't have anticipated), all three gates were re-run fresh via `runSubagent` during this story's creation.

- **Gate 1 (Architecture/Infrastructure Completeness) — GAP FOUND, resolved by splitting a new prerequisite story.** This story cannot be implemented frontend-only. AC4/AC5's opt-in-aware failure branching needs a typed success/error signal from Instagram's embed mechanism; the client-side `embed.js` widget alone provides no such signal (it renders or silently fails in the DOM with nothing the frontend can reliably branch on). A direct frontend call to Instagram's real oEmbed API is additionally a hard architectural violation independent of credentials: Instagram's Graph API responses carry a `Cross-Origin-Resource-Policy: same-origin` header that blocks direct browser `fetch` calls outright. **Live web research performed during this story's creation** (2026-09-04) found Meta reversed its October 2020 access-token requirement on **2026-06-15**: `GET https://graph.facebook.com/v25.0/instagram_oembed?url=<post_url>` now works **tokenless, no App Review**, for public posts — returning JSON with an `html` field on success, and a typed error for deleted/private posts ("private posts return an error no matter what you do"), at a documented ~1,000 requests/hour. Sources: [Meta oEmbed docs](https://developers.facebook.com/docs/instagram-platform/oembed/), [Spotlight WP writeup on the June 2026 change](https://spotlightwp.com/instagram-embed-wordpress/). This means **no Meta App credential/secret/IaC is needed at all** — only a backend-proxied adapter call. **Resolution, confirmed directly with the user:** split into new **Story 3.7e** ("Instagram oEmbed backend integration — adapter and resolver field"), scoped as a single combined story (adapter + `Event.instagramEmbed` resolver field + rate-limit-safe caching, no separate credential-provisioning story, since none is needed). This story (3.7d) depends on 3.7e and stays strictly frontend — see `## Out of Scope`.
- **Gate 2 (UI Complexity & Reusability) — GAP FOUND, folded into this story's own scope (not a separate story, single-consumer).** (a) The embed needs a genuinely new state machine (script-load lifecycle, a terminal "content no longer available" state distinct from `EventImage`'s existing `imageError` path, and a conditional opt-in-aware fallback) — bolting this onto `EventImage.tsx` would make one component own two unrelated rendering paradigms (self-rendered media vs. a delegated third-party widget), breaking the "one more branch of the same kind of state" precedent Story 1.6a's video amendment relied on to justify extending `EventImage.tsx` in place. **Resolution:** new dedicated `InstagramEmbed.tsx` component (Task 1), composing `EventImage` internally for its fallback-image sub-case rather than duplicating image-rendering logic. (b) Confirmed via a fresh grep of `design-artifacts/UX-festgrid-run-1/{DESIGN,EXPERIENCE}.md`: zero content specifies this embed's visual treatment, loading skeleton, or "content no longer available" placeholder (only an unrelated `/settings/widgets` route name matched "widget"). **Resolution:** AC7's escape-hatch — reuse `EventImage`'s existing container/placeholder visual language rather than invent new treatment, and dimension-match its media slot to avoid CLS. (c) A11y: the widget's own injected iframe needs an accessible wrapper region and a loading/`aria-busy` treatment consistent with `EventDetailView`'s existing `aria-busy` convention. **Resolution:** AC8.
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness) — No gap found for a shared `EmbedAdapter` abstraction; one real gap found (credential/infra), resolved as folded into Story 3.7e.** The project's scraper-adapter precedent (`ScraperAdapter`, Story 3.3c) generalizes because it has ≥2 concrete vendor consumers (Apify, Bright Data) driving its interface shape today. An Instagram-embed capability has exactly one consumer right now — sibling Story 3.7c stays hotlink-only with no embed concept at all — so a shared `EmbedAdapter` interface would be speculative abstraction with no second real shape to validate it against. **Decision:** implement `InstagramOEmbedAdapter` (Story 3.7e) as a single-purpose, plainly-named module, not a generic interface; the Dev Notes there flag that a second embed-needing platform story is the trigger for extracting a shared interface, not this story. The credential/infra gap Gate 3 initially flagged (Meta App provisioning) turned out to be **moot** once live research confirmed the tokenless 2026-06-15 endpoint — folded directly into Story 3.7e's scope rather than a separate Epic-0-style story, since there is no credential-provisioning work left to do.

### File/path expectations and architecture boundaries

- `packages/ui`'s established pattern (Story 1.3b/1.6a precedent) applies unchanged: plain Tailwind, native HTML elements where possible, `lucide-react` for icons, no Next.js-specific APIs, no `next-intl` — labels/data are passed in as already-resolved props by the `apps/web` caller.
- **New exception to "no next.js-specific APIs, no external script loading":** `InstagramEmbed.tsx` is the first `packages/ui` component to load a third-party script (`//www.instagram.com/embed.js`). This is unavoidable — it's how Instagram's oEmbed `html` actually renders as the rich embed rather than raw markup — but must be done defensively: idempotent script injection (check `document.querySelector` before appending), and must not throw if the script fails to load (falls back to the `unavailable` treatment, not a crash).
- `EventDetailView.tsx`'s existing "Left Column: Media" render call site (`~line 216-228`) is the single integration point (Task 6) — read in full before touching it (already done during this story's creation; see the exact prop list and surrounding JSX quoted in Tasks above).
- `apps/web/src/features/events/mapper.ts` (`mapGraphQLEventToDetailViewProps`, already read in full during this story's creation — confirmed its exact current field-mapping shape) and `apps/web/src/features/events/queries.graphql` (`getEventBySlug`, confirmed exact current field list) are the two `apps/web` files this story touches for wiring; `EventDetailWrapper.tsx` itself needs no structural change beyond what `mapper.ts`'s already-consumed return value provides.
- This story does **not** touch `apps/backend`, `packages/database`, or any `.graphql` **schema** file (only the `apps/web`-side query **document**) — that is Story 3.7e's exclusive scope. See `## Out of Scope`.

### State management categorization

This story introduces no Server State / URL State / Client Global State (React Query / nuqs / zustand) — the embed's `loading`/`ready`/`error` state machine is ephemeral, component-local UI state via plain `useState`/`useEffect` inside `InstagramEmbed.tsx`, exactly like `EventImage.tsx`'s existing `imageError`/`videoReady`/`videoError` local state. Not zustand-eligible (no cross-component sharing need).

### Loader categorization

The embed's async script-load/render lifecycle (AC7) is a **Non-Blocking (Initial Load)** case per project-context.md's UI invariants — a skeleton placeholder matching the real component's layout, not a full-screen blocking overlay (this is passive content loading within an already-rendered page, not a critical mutation).

### Analytics

No new PostHog event is required by this story's ACs — embed load/failure is a passive display state, not a tracked user interaction. If a future story wants embed-failure-rate observability, that is a separate, explicitly-scoped addition, not implied here.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.7d] and [#Story-3.7e] (new prerequisite, added this story's creation).
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-09-02.md] — this story's origin (minimization doc §3.3/§3.4).
- [Source: _bmad-output/planning-artifacts/story-split-gate.md] — Gate 1/2/3 definitions.
- [Source: _bmad-output/implementation-artifacts/1-6a-build-the-reusable-event-detail-view-component.md] — `EventDetailView`/`EventImage` precedent this story extends; the video-priority-display amendment's "extend in place vs. new component" reasoning this story's Gate 2 finding distinguishes itself from.
- [Source: _bmad-output/implementation-artifacts/3-6h-gate-image-re-hosting-and-serving-on-account-opt-in.md] — the `isImageStorageOptedIn` opt-in join/gate pattern Story 3.7e's resolver reuses.
- [Source: packages/ui/src/features/events/EventImage.tsx, EventDetailView.tsx] — read in full during this story's creation; confirmed current props, state machine, and exact render call sites quoted above.
- [Source: apps/web/src/features/events/mapper.ts, EventDetailWrapper.tsx, queries.graphql] — read in full during this story's creation; confirmed exact current field-mapping and query shape.
- [Source: apps/backend/src/schema/events.graphql] — confirmed current `Event` type shape; `instagramEmbed` field addition belongs to Story 3.7e, not this story.
- [Source: https://developers.facebook.com/docs/instagram-platform/oembed/] — Meta's official oEmbed documentation (endpoint, response shape, rate limit, unsupported cases), consulted live during this story's creation.
- [Source: https://spotlightwp.com/instagram-embed-wordpress/] — third-party writeup confirming the 2026-06-15 tokenless reversal and its practical caveats (profile embeds unreliable, private posts always error), consulted live during this story's creation.
- [Source: _bmad-output/project-context.md] — Adapter Pattern, UI Patterns & UX Invariants (skeletons, Keep Skeletons in Sync), i18n rules, State Management Architecture.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** A new GraphQL contract is required and is Story 3.7e's responsibility to ship, not this story's: a new `InstagramEmbedResult` type (`status: InstagramEmbedStatus!`, `html: String`, `durableImageUrl: String`) and enum `InstagramEmbedStatus { AVAILABLE UNAVAILABLE }`, plus a new `Event.instagramEmbed: InstagramEmbedResult` field. This story's own new TypeScript types (`InstagramEmbedProps`/`InstagramEmbedLabels` in `packages/ui`) are decoupled, locally-defined prop types — not a re-export of any `packages/shared-types`/generated GraphQL type — mirroring the exact decoupling precedent `EventDetailViewProps`/`ScheduleDetail` already established in Story 1.6a. This story does not take a compile-time dependency on Story 3.7e's GraphQL schema landing first for its `packages/ui` work (Tasks 1-10); only its `apps/web` wiring (Tasks 11-14) is blocked on 3.7e's schema/codegen.
- **Impacted fields/contracts:** `EventDetailViewProps` gains three new optional fields (`instagramEmbedStatus`, `instagramEmbedHtml`, `instagramEmbedDurableImageUrl`) — additive, non-breaking for existing callers/tests (all default to the unchanged `EventImage` path per AC2).
- **Required DB migration changes:** None — this story does not touch the database. (Story 3.7e also requires none — it's a pure external-API-proxying adapter + resolver, no new column.)
- **Required TypeScript type changes:** `packages/ui`'s new `InstagramEmbed.types.ts`/`EventDetailView.types.ts` additions only (this story); `apps/web/src/generated/graphql.ts` regeneration via `pnpm --filter web codegen` once Story 3.7e's `.graphql` schema change lands (Task 11) — no manual hand-edit of generated files.
- **Backward compatibility and rollout notes:** Additive-safe. Every event whose `Event.instagramEmbed` is absent (all events, until Story 3.7e ships and the resolver starts populating it for Instagram-sourced posts) renders exactly as it does today (AC2). No existing consumer/test breaks.
- **Verification checks:** Task 9/10's component tests (all four `InstagramEmbed` states plus the `EventDetailView` conditional-render split); Task 14's `apps/web` MSW integration test once 3.7e's schema exists.

## Global Rules References

- [x] `_bmad-output/project-context.md` — Adapter Pattern (informs why the embed fetch is backend-only, Story 3.7e), UI Patterns & UX Invariants (skeletons, Keep Skeletons in Sync, Non-Blocking loaders), i18n rules (labels-prop pattern, AD-6), State Management Architecture (this story introduces none of the three scoped state types — local component state only).
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — this file's structure.
- [x] `_bmad-output/planning-artifacts/story-split-gate.md` — Gate 1/2/3 definitions and the fresh-run rationale documented above.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-6 (i18n/locale strategy), AD-12 (image-serving/opt-in rules this story's fallback state respects, implemented server-side by Story 3.6h/3.7e).
- [x] `docs/infrastructure/index.md` — reviewed; not applicable (this story adds no backend compute/queue/EventBridge/DB-provisioning change — it is `apps/web`/`packages/ui`-only; Story 3.7e is the backend counterpart and needs no new infra either, per its own Dev Notes).

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - NEW `packages/ui/src/features/events/InstagramEmbed.tsx` — 4-state embed component (Task 1, 3-5).
  - NEW `packages/ui/src/features/events/InstagramEmbed.types.ts` — `InstagramEmbedProps`/`InstagramEmbedLabels` (Task 2).
  - NEW `packages/ui/src/features/events/InstagramEmbed.test.tsx` — component tests (Task 9).
  - UPDATE `packages/ui/src/features/events/EventDetailView.tsx` — conditional `InstagramEmbed`/`EventImage` render in the media column (Task 6).
  - UPDATE `packages/ui/src/features/events/EventDetailView.types.ts` — new optional `instagramEmbedStatus`/`instagramEmbedHtml`/`instagramEmbedDurableImageUrl` props; new label keys on `EventDetailViewLabels` (Task 6, 7).
  - UPDATE `packages/ui/src/features/events/EventDetailView.test.tsx` — new conditional-render tests (Task 10).
  - UPDATE `packages/ui/src/features/events/index.ts` and `packages/ui/src/index.ts` — export `InstagramEmbed` and its types (Task 8).
  - UPDATE `apps/web/src/features/events/queries.graphql` — add `instagramEmbed { status html durableImageUrl }` to `getEventBySlug` (Task 11, blocked on Story 3.7e's schema).
  - UPDATE `apps/web/src/generated/graphql.ts` — regenerated via `pnpm --filter web codegen`, not hand-edited (Task 11).
  - UPDATE `apps/web/src/features/events/mapper.ts` — map the three new `Event.instagramEmbed` sub-fields onto `EventDetailViewProps` (Task 12).
  - UPDATE `apps/web/src/features/events/EventDetailWrapper.tsx` (via `useEventDetailViewLabels()`) and `apps/web/src/locales/en.json`/`id.json` — new label keys (Task 13).
  - NOT MODIFIED: `apps/backend/**`, `packages/database/**`, any `.graphql` **schema** file — exclusively Story 3.7e's scope.
- **Rule Mapping:**
  - *Adapter Pattern / no frontend-to-external-service calls* → the embed fetch stays in Story 3.7e's backend adapter; this story only renders backend-supplied `html`/status.
  - *UI Components & Scalability (Domain Features)* → `InstagramEmbed.tsx` placed in `packages/ui/src/features/events/`.
  - *i18n foundational principle (AD-6)* → `labels` override prop pattern on `InstagramEmbed`, no direct `next-intl` dependency inside `packages/ui`.
  - *UI Patterns & UX Invariants (skeletons, Keep Skeletons in Sync, Non-Blocking loaders)* → AC7's dimension-matched loading state.
  - *Data Type Compatibility* → decoupled prop types, no premature dependency on Story 3.7e's schema for the `packages/ui`-only tasks.
  - *Testing Philosophy (testing trophy)* → integration-style component tests (Vitest + Testing Library) plus one `apps/web` MSW integration test.
- **Verification Plan:**
  - `pnpm --filter @festgrid/ui test` — `InstagramEmbed` 4-state coverage (Task 9) and `EventDetailView` conditional-render regression coverage (Task 10).
  - `pnpm --filter @festgrid/ui lint` and TypeScript strict-mode check.
  - `pnpm --filter web codegen` succeeds once Story 3.7e's schema lands (Task 11); `pnpm --filter web test` (MSW integration test, Task 14); `pnpm --filter web lint`/`build`.
  - No E2E test newly required — the existing event-detail-page E2E coverage (if any, from Story 1.6) exercises the page shell; this story's new states are covered at the component/integration level per the testing-trophy approach.

## Pre-Coding Approval Gate

- [ ] Scope confirmed: `packages/ui` gets a new `InstagramEmbed` component plus `EventDetailView` wiring (buildable/testable now against a mocked prop contract); `apps/web`'s query/mapper/label wiring (Tasks 11-14) is blocked on Story 3.7e's GraphQL field shipping. No `apps/backend`/database/GraphQL-schema change in this story.
- [ ] Architecture confirmed: embed data (`html`/status/fallback) is always backend-supplied (Story 3.7e) — this story never calls Instagram directly from the frontend, matching Gate 1's resolution above.
- [ ] Testing plan confirmed: `packages/ui` component tests for all 4 `InstagramEmbed` states plus the `EventDetailView` conditional-render split (buildable now); `apps/web` MSW integration test for the wired query (blocked on 3.7e).
- [ ] Gate 1/2/3 findings acknowledged: Gate 1 gap → split into Story 3.7e (this story depends on it for its `apps/web` wiring tasks only). Gate 2 gap → folded into this story's own AC7/AC8 and the new `InstagramEmbed` component (Task 1). Gate 3 → no shared-adapter generalization needed (single consumer); the credential/infra sub-gap resolved as moot (tokenless endpoint) and folded into Story 3.7e.
- [ ] **Prerequisite dependency confirmed:** Story 3.7e ("Instagram oEmbed backend integration — adapter and resolver field") is `backlog` as of this story's creation (2026-09-04) — NOT yet done. This story's `packages/ui` component work (Tasks 1-10) can proceed independently against the documented prop contract; its `apps/web` wiring (Tasks 11-14) must wait for 3.7e to ship its `Event.instagramEmbed` field. Do not mark this story `done` until either Story 3.7e is done and Tasks 11-14 are verified end-to-end, or the user has explicitly accepted shipping only the `packages/ui` component in isolation.
- [ ] Explicit human approval state (Default: **pending approval**)

## Testing Requirements

- [ ] `packages/ui` component tests (Vitest + `@testing-library/react`, via `@festgrid/testing-config/vitest-react`): `InstagramEmbed`'s 4 states (loading, available, unavailable-no-fallback, unavailable-with-fallback), label overrides, accessible-region attributes (Task 9); `EventDetailView`'s conditional render of `InstagramEmbed` vs. unchanged `EventImage` (Task 10).
- [ ] `apps/web` integration test (MSW-mocked `getEventBySlug` response): `InstagramEmbed` path renders when `instagramEmbedStatus` is present; unchanged `EventImage` path renders when absent (Task 14) — depends on Story 3.7e's schema for the mocked shape to be meaningful end-to-end, but can be authored against the documented contract in the meantime.
- [ ] No new E2E test required — no new critical user flow is introduced (the existing event-detail page flow is unchanged in shape, only its media rendering).
- [ ] 100% coverage is not mandated (no `packages/domain` code in this story) — `packages/ui`/`apps/web` follow the "testing trophy" integration-style approach.
- [ ] Note: use `@festgrid/testing-config/vitest-react` for `packages/ui` — do not create a parallel/ad hoc testing-config setup.

## Deliverables Checklist

- [ ] `InstagramEmbed` component implemented with all 4 states (`packages/ui/src/features/events/InstagramEmbed.tsx`).
- [ ] Strictly-typed `InstagramEmbedProps`/`InstagramEmbedLabels` (`InstagramEmbed.types.ts`).
- [ ] `EventDetailView` conditionally renders `InstagramEmbed` vs. unchanged `EventImage`, no regression to existing image/video paths (AC2).
- [ ] Layout-stable loading skeleton matching `EventImage`'s media-slot dimensions (AC7).
- [ ] "Content no longer available" state for non-opted-in unavailable embeds (AC4).
- [ ] `durableImageUrl` fallback for opted-in unavailable embeds, composed via `EventImage` (AC5).
- [ ] No independent `profileImageUrl` rendering introduced (AC6).
- [ ] Accessible embed region + state-transition announcements (AC8).
- [ ] `labels` override prop with English defaults; new locale keys added to `en.json`/`id.json` (AC9).
- [ ] Exported from `packages/ui`'s public entry point.
- [ ] `packages/ui` component tests written and passing.
- [ ] `apps/web` query/mapper/label wiring complete and tested (Tasks 11-14) — **blocked on Story 3.7e**.

## Out of Scope

- **The `InstagramOEmbedAdapter`, the `Event.instagramEmbed` GraphQL resolver field/type/enum, and any Meta/Instagram API call logic or rate-limit-safe caching** — Story 3.7e's exclusive scope, split out via this story's Gate 1 finding. This story only consumes that field once it exists.
- **Any Meta App credential/secret/IaC provisioning** — confirmed not needed at all (Meta's 2026-06-15 tokenless oEmbed reversal); not applicable to either this story or Story 3.7e.
- **A generic `EmbedAdapter` interface generalized across platforms** — explicitly deferred per this story's Gate 3 finding; revisit only if/when a second embed-needing platform story is actually drafted.
- **The 7-30 day Discovery→Archive display-window lifecycle mechanism** (minimization doc §3.3) — not designed anywhere yet; this story's display logic is written to not conflict with it once it exists, but does not implement it (AC3).
- **Sibling Story 3.7c's event-list/grid hotlink+prominent-card display** — a separate story with no embed concept at all; not touched here.
- **Embed-failure-rate analytics/observability** — not required by this story's ACs (see Dev Notes "Analytics"); a future story's concern if needed.
- **Manual embed interaction controls beyond what Instagram's own embed chrome provides** (e.g. a custom "view on Instagram" button duplicating the embed's own built-in link) — the embed's native chrome already provides this; not duplicated here.

## Definition of Done

- [ ] All Acceptance Criteria (AC1-AC9) are met.
- [ ] Required `packages/ui` component tests (Testing Requirements) are written and passing.
- [ ] Lint and TypeScript strict-mode checks pass for `packages/ui` and `apps/web`.
- [ ] `InstagramEmbed` is exported from `packages/ui`'s public entry point.
- [ ] `apps/web` wiring (Tasks 11-14) is complete and tested against Story 3.7e's real shipped `Event.instagramEmbed` field — OR the Pre-Coding Approval Gate's explicit user acceptance of a `packages/ui`-only partial ship is on record.
- [ ] Pre-Coding Approval Gate has moved from pending to explicitly approved before implementation began.

## Completion Status

- [ ] Not started. Ultimate context engine analysis completed - comprehensive developer guide created. Story split from a single-scope draft into this story (frontend) + new prerequisite Story 3.7e (backend) via Gate 1 finding during creation; Gate 2/Gate 3 findings folded directly into this story's AC7-AC9 and Dev Notes. See epics.md Story 3.7d Amendment and Story 3.7e for the full gate-finding record.

## Dev Agent Record

### Agent Model Used

_Not yet implemented._

### Debug Log References

_Not yet implemented._

### Completion Notes List

_Not yet implemented._

### File List

_Not yet implemented._
