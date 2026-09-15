---
title: 'FIND-011: SubscribedAccountCard/EventDetailView unused-prop and unscaled-variant cruft'
type: 'chore'
created: '2026-09-15'
status: 'done'
route: 'one-shot'
review_loop_iteration: 0
context: []
---

# FIND-011: SubscribedAccountCard/EventDetailView unused-prop and unscaled-variant cruft

## Intent

**Problem:** `EventDetailViewLabels.postedByLabel` was declared and plumbed end-to-end (type, mapper, both locales) but never rendered anywhere in `EventDetailView.tsx` — dead cruft. Separately, `SubscribedAccountCard`'s `size="lg"` variant scaled the avatar but left the adjacent displayName/username text at a fixed size, an incomplete variant with no current caller to have caught it.

**Approach:** Removed `postedByLabel` from the labels contract, its i18n producer, both test fixtures, and both locale JSON files (verified via grep that no render code ever referenced it). Added size-driven text classes (`text-lg`/`text-base` for `lg`, unchanged `text-sm` default) to `SubscribedAccountCard`'s displayName/username spans, with test coverage for both the `lg` and explicit `sm` cases.

The `size="lg"` scaling item is a fractional overlap with epic Story 0.i6a (still `backlog`) — done here since it was trivial and zero-risk; 0.i6a's remaining scope is BUG-005's degenerate-input fallback only (see `epics.md` update note on that story).

## Suggested Review Order

**Text-scale fix (SubscribedAccountCard)**

- Size-driven class derivation for the `lg` variant — entry point for the visual fix.
  [`SubscribedAccountCard.tsx:15`](../../packages/ui/src/features/subscriptions/SubscribedAccountCard.tsx#L15)

- Classes applied to the displayName/username spans.
  [`SubscribedAccountCard.tsx:31`](../../packages/ui/src/features/subscriptions/SubscribedAccountCard.tsx#L31)

- New test covering `lg` vs explicit `sm` vs default.
  [`SubscribedAccountCard.test.tsx:119`](../../packages/ui/src/features/subscriptions/SubscribedAccountCard.test.tsx#L119)

**Dead-prop removal (postedByLabel)**

- Field dropped from the labels contract.
  [`EventDetailView.types.ts:35`](../../packages/ui/src/features/events/EventDetailView.types.ts#L35)

- i18n producer no longer supplies it.
  [`mapper.ts:19`](../../apps/web/src/features/events/mapper.ts#L19)

- Locale keys removed to match (en/id kept in parity).
  [`en.json:118`](../../apps/web/locales/en.json#L118)
  [`id.json:118`](../../apps/web/locales/id.json#L118)

**Bookkeeping**

- Finding closed; note documents the 0.i6a overlap resolution.
  [`backlog.yaml:493`](../../_bmad-output/implementation-artifacts/backlog.yaml#L493)

- Story 0.i6a annotated so it isn't redone.
  [`epics.md:4101`](../../_bmad-output/planning-artifacts/epics.md#L4101)

**Peripherals**

- Test fixtures updated to match the dropped field.
  [`EventDetailView.test.tsx:30`](../../packages/ui/src/features/events/EventDetailView.test.tsx#L30)
  [`mapper.test.ts:24`](../../apps/web/src/features/events/mapper.test.ts#L24)
