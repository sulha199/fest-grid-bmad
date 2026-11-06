import { RouteLoader } from "@festgrid/ui"

// Loading boundary for the intercepted event-detail modal, scoped to the @modal slot root so it
// sits INSIDE `@modal/layout.tsx`'s <DialogContent> (the loader shows in the popup).
//
// Why this file exists: Next.js applies a segment's `loading.tsx` to every slot its layout
// renders (`parentCacheNode.loading` in layout-router). Without a slot-level boundary, the
// modal slot inherits `app/[locale]/loading.tsx`, whose <RouteLoader /> lands in normal flow
// after `{children}` -- i.e. at the bottom of the page, usually below the fold -- while the
// modal page's server-side `eventBySlug` fetch is in flight and no dialog exists yet.
//
// Deliberately at the slot root and NOT at `@modal/(.)events/[slug]/loading.tsx` (removed in
// Story 1.6): a boundary keyed by the dynamic [slug] segment flashes on every Next/Previous
// swap. This boundary's key does not change between events, so it only shows on first open.
export default function ModalLoading() {
  return <RouteLoader />
}
