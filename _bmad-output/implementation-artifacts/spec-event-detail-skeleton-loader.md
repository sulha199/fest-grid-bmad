---
title: 'Event-detail loader: skeleton inside the popup (replaces the RouteLoader logo)'
type: 'bugfix'
created: '2026-11-06'
status: 'done'
baseline_commit: '13ad197'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Opening an event's detail popup was slow to react, and its loader (the beating `RouteLoader` logo) rendered at the **bottom of the page**, below the fold, so it was usually never seen. Cause: Next.js applies `app/[locale]/loading.tsx` to every slot that layout renders, including `@modal`, so the modal slot's fallback landed in normal flow after `{children}` while the popup (which only exists once the modal page's server fetch returns) was not open yet. After that was fixed (PR #157, slot-root `@modal/loading.tsx`) the loader was still the generic logo, not a shape that matches the event it stands in for.

**Approach:** Event detail shows a content-shaped **skeleton** while loading, inside the popup. Extract the skeleton that `EventDetailView` already rendered for its own `loading` state into one shared `EventDetailSkeleton` (`packages/ui`), render it from `EventDetailView` and from every event-detail route-level fallback via a small localized wrapper (`EventDetailLoading`). One shape, one place.

## Boundaries & Constraints

**Always:**
- `EventDetailSkeleton` is the single source of truth for the event-detail loading shape; `EventDetailView`'s `loading` output must stay byte-identical to it (test-enforced).
- The slot-root `@modal/loading.tsx` stays at the slot root (its key does not change between events). Never add a `[slug]`-keyed `loading.tsx` under the modal route (flashes on Next/Previous; Story 1.6).
- The accessible label is localized (`EventDetailsPage.loadingText`), no hardcoded strings.

**Never:** change `RouteLoader` or any other route's fallback; change the loaded event-detail UI.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior |
|----------|--------------|----------------------------|
| Open event from a list, slow backend (production build) | click card, `eventBySlug` takes seconds | URL changes at once; popup opens with the skeleton inside it; no loader at the page bottom; skeleton swaps for the event when data arrives |
| Next/Previous inside the popup | swipe or arrow | no skeleton flash (existing content stays until the new one is ready) |
| Client-side fetch pending (`EventDetailView` `loading`) | `isPending` | same skeleton as above |
| Direct URL open of `/events/[slug]` | cold load | unchanged: inherited `[locale]/loading.tsx` `RouteLoader` while the server fetches (see Known Limits) |

</frozen-after-approval>

## Code Map

- `packages/ui/src/features/events/EventDetailSkeleton.tsx` -- new shared skeleton (+ `.test.tsx`: busy/labelled; identical to `EventDetailView`'s loading output).
- `packages/ui/src/features/events/EventDetailView.tsx` -- `loading` branch now renders `<EventDetailSkeleton label={labels.loadingText} />`.
- `apps/web/src/features/events/EventDetailLoading.tsx` -- client wrapper adding the localized label (+ test).
- `apps/web/src/app/[locale]/@modal/loading.tsx` -- slot-root boundary, renders `<EventDetailLoading />` (+ `loading.test.tsx`).
- `apps/web/src/app/[locale]/@modal/(.)events/[slug]/page.tsx`, `apps/web/src/app/[locale]/events/[slug]/page.tsx` -- inline `<Suspense>` fallbacks now `<EventDetailLoading />`.
- `_bmad-output/project-context.md` -- "Event-detail exception: skeleton, not `RouteLoader`" under Route-Level Suspense Fallback; slot-root exception note updated.

## Known Limits

- A direct-URL (cold) open of the full-page `/events/[slug]` still shows the generic `RouteLoader` from `app/[locale]/loading.tsx` while the server fetches. Giving it a skeleton needs a `[slug]`-keyed `loading.tsx`, which flashes on Next/Previous; a different mechanism would be needed. Not done here.
- The popup loader is only observable in a production build: `next dev` does not prefetch route data, so a dev navigation waits and shows nothing.

## Related

- PR #157 (merged 2026-11-06): the `@modal/loading.tsx` position fix, and the batched `setCalendarAdditions` mutation with always-download `.ics` -- recorded as the "Add-to-Calendar Writes Are Batched" convention in `project-context.md`.

## Verification

- `packages/ui`: `EventDetailSkeleton.test.tsx`, `EventDetailView.test.tsx`.
- `apps/web`: `EventDetailLoading.test.tsx`, `@modal/loading.test.tsx`, both event page tests, full `src/app` + `src/features/events` suites.
- Manual, production build with `getEventBySlug` held 4s by a delaying proxy: popup open with the skeleton inside and no heartbeat logo anywhere (see PR description).
