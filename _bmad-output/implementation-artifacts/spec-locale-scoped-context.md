---
title: 'Scoped locale/timezone context for packages/ui, wired into EventCard date formatting'
type: 'feature'
created: '2026-08-01'
status: 'done'
review_loop_iteration: 0
context: ['_bmad-output/project-context.md']
route: 'one-shot'
---

# Scoped locale/timezone context for packages/ui, wired into EventCard date formatting

## Intent

**Problem:** `EventCard`'s date formatting always fell back to a hardcoded `'en-US'` default because `apps/web/src/app/[locale]/page.tsx` never resolved the active route locale and never passed it down, so dates rendered identically regardless of whether the user was on `/en/` or `/id/` — a known gap logged in `deferred-work.md` from the prior enum-i18n fix.

**Approach:** Added a `ScopedLocaleProvider` + `useScopedLocale()`/`useScopedTimezone()` React context to `packages/ui` (deliberately named apart from `next-intl`'s own `useLocale`/`useTimeZone` to avoid import confusion) so components can resolve the active locale/timezone from the nearest ancestor provider — "if not defined, load from the nearest parent scope" — while an explicit prop always wins. Wired the app root (`layout.tsx`) to provide the resolved route locale (mapped to a region-qualified BCP-47 tag). `EventCard` now degrades gracefully (retries without timezone, then without locale) if given an invalid IANA timezone/locale instead of throwing.

## Suggested Review Order

**Scoped context primitive**

- Entry point: `ScopedLocaleProvider` merges a nested provider's timezone with its parent's when the nested provider only overrides `locale`, so ambient timezone isn't silently dropped.
  [`useScopedLocale.tsx:39-47`](../../packages/ui/src/hooks/useScopedLocale.tsx#L39-L47)
- `useScopedLocale()`/`useScopedTimezone()` resolve to the nearest ancestor provider, with explicit fallbacks (`'en-US'` / `undefined`).
  [`useScopedLocale.tsx:50-56`](../../packages/ui/src/hooks/useScopedLocale.tsx#L50-L56)

**EventCard wiring**

- Explicit `locale`/`timezone` props take precedence over context; `||` (not `??`) guards against an accidental empty-string prop.
  [`EventCard.tsx:87-92`](../../packages/ui/src/features/events/EventCard.tsx#L87-L92)
- `formatEventDate` degrades gracefully on an invalid timezone or locale instead of crashing the card.
  [`EventCard.tsx:22-38`](../../packages/ui/src/features/events/EventCard.tsx#L22-L38)
- New `timezone` prop and updated `locale` prop docs on the public contract.
  [`EventCard.types.ts:22-26`](../../packages/ui/src/features/events/EventCard.types.ts#L22-L26)

**App root wiring**

- Wraps `<AppShell>` in `<ScopedLocaleProvider>`, mapping the route's bare locale code to a region-qualified tag rather than passing it through raw.
  [`layout.tsx:29-34`](../../apps/web/src/app/%5Blocale%5D/layout.tsx#L29-L34), [`layout.tsx:69-71`](../../apps/web/src/app/%5Blocale%5D/layout.tsx#L69-L71)

**Rule documentation**

- "Scoped locale/timezone context" rule documenting the API, precedence, nesting/merge behavior, and the graceful-degradation requirement.
  [`project-context.md:108-112`](../project-context.md#L108-L112)

**Peripherals**

- Context primitive unit tests, including the parent-timezone-inheritance case.
  [`useScopedLocale.test.tsx`](../../packages/ui/src/hooks/useScopedLocale.test.tsx)
- `EventCard` tests: context fallback, prop override, timezone inheritance, and invalid-timezone graceful degradation — expected values computed via the same `Intl.DateTimeFormat` call rather than hardcoded ICU strings, to avoid environment-dependent flakiness.
  [`EventCard.test.tsx:35-89`](../../packages/ui/src/features/events/EventCard.test.tsx#L35-L89)
- Residual gaps logged rather than fixed here: no integration/E2E test proves the real `layout.tsx` → `page.tsx` → `EventCard` wiring end-to-end, and no app-wide timezone is sourced yet (SSR/hydration timezone-mismatch risk pre-existing, now more relevant).
  [`deferred-work.md`](./deferred-work.md)
