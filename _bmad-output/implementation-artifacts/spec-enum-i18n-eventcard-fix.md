---
title: 'Translate EventCategory/EventType enum badges and price label on the Discovery page'
type: 'bugfix'
created: '2026-08-01'
status: 'done'
review_loop_iteration: 0
context: ['_bmad-output/project-context.md']
route: 'one-shot'
---

# Translate EventCategory/EventType enum badges and price label on the Discovery page

## Intent

**Problem:** `apps/web/src/app/[locale]/page.tsx` passed raw `EventCategory`/`EventType` enum strings (e.g. `"MUSIC"`, `"FESTIVAL"`) straight into `EventCard`, which rendered them unlocalized; `EventCard` also hardcoded the English `"From"` price label. This violated the newly-documented "Locale-Sensitive Data Rendering" rule in `project-context.md`.

**Approach:** Added `EventCategory`/`EventType` translation namespaces to `apps/web/locales/{en,id}.json`; extended `EventCardLabels` with `categoryLabels`/`typeLabels`/`priceFrom` so the framework-agnostic `EventCard` stays free of a `next-intl` dependency; wired `page.tsx` to resolve and memoize the label maps via `next-intl`, with a graceful raw-value fallback if a translation key is ever missing.

## Suggested Review Order

**Rule documentation**

- The rule this fix satisfies — enums/dates/numbers must never render raw; documents the date-locale gap as still open.
  [`project-context.md:104-108`](../project-context.md#L104-L108)

**Translation wiring (page.tsx)**

- Entry point: resolves and memoizes `EventCategory`/`EventType` label maps via `next-intl`, passes them to `EventCard`.
  [`page.tsx:28-36`](../../apps/web/src/app/%5Blocale%5D/page.tsx#L28-L36)
- Missing-key fallback so a locale/enum drift degrades to the raw value instead of throwing on every card.
  [`page.tsx:14-23`](../../apps/web/src/app/%5Blocale%5D/page.tsx#L14-L23)
- Label maps passed down to `EventCard` alongside the translated price-from label.
  [`page.tsx:117`](../../apps/web/src/app/%5Blocale%5D/page.tsx#L117)

**Rendering (EventCard)**

- Renders translated category/type labels with raw-value fallback.
  [`EventCard.tsx:154`](../../packages/ui/src/features/events/EventCard.tsx#L154), [`EventCard.tsx:162`](../../packages/ui/src/features/events/EventCard.tsx#L162)
- `defaultLabels` merge order fixed so an explicit `undefined` in `labels.typeLabels`/`categoryLabels` can't override the safe `{}` default.
  [`EventCard.tsx:49-52`](../../packages/ui/src/features/events/EventCard.tsx#L49-L52)
- New optional label fields on the props contract.
  [`EventCard.types.ts:3-13`](../../packages/ui/src/features/events/EventCard.types.ts#L3-L13)

**Translation content**

- New `EventCategory`/`EventType` namespaces + `priceFrom` key.
  [`en.json`](../../apps/web/locales/en.json), [`id.json`](../../apps/web/locales/id.json)

**Peripherals**

- en/id key-parity guard.
  [`locales.test.ts`](../../apps/web/locales/locales.test.ts)
- Page-level regression test asserting translated badges appear and raw enum strings don't.
  [`page.test.tsx`](../../apps/web/src/app/%5Blocale%5D/page.test.tsx)
- Unit test for translated-vs-fallback rendering in isolation.
  [`EventCard.test.tsx`](../../packages/ui/src/features/events/EventCard.test.tsx)
- Deferred pre-existing gaps surfaced by adversarial review (date-locale threading, dual enum sources, ticketPrice/price-label UX).
  [`deferred-work.md`](./deferred-work.md)
