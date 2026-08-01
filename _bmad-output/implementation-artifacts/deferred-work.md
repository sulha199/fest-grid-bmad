# Deferred Work

This file tracks work deferred from development stories, code reviews, and planning sessions.

## Deferred from: code review of 0-1-initialize-pnpm-monorepo.md (2026-07-22)

- Missing next-intl integration vs. project i18n constraint — The app layout and page currently hardcode English text, directly violating project-context.md general architecture rules 14 & 15. Deferred: To address i18n setup in a dedicated workspace setup story

## Deferred from: code review of 1-1-create-initial-database-tables.md (2026-07-27)

- Vague local Postgres instance setup — deferred, pre-existing

## Deferred from: quick-dev fix of enum i18n rendering (2026-08-01)

- source_spec: `_bmad-output/implementation-artifacts/spec-enum-i18n-eventcard-fix.md`
  summary: Discovery page (`apps/web/src/app/[locale]/page.tsx`) never resolves the active route locale and never passes it as the `locale` prop to `EventCard`, so dates always render formatted as `en-US` regardless of whether the user is on `/en/` or `/id/`.
  evidence: Pre-existing — `EventCard`'s `locale` prop and its `en-US` default predate this change; `page.tsx` never wired it up. Surfaced by adversarial review while fixing the related enum-translation bug and documenting the "Locale-Sensitive Data Rendering" rule in project-context.md, which now covers dates too.
- source_spec: `_bmad-output/implementation-artifacts/spec-enum-i18n-eventcard-fix.md`
  summary: `EventCategory`/`EventType` are hand-maintained in two independent places — `packages/shared-types/src/index.ts` and the GraphQL-codegen'd enum in `apps/web/src/generated/graphql.ts` — with nothing enforcing they stay in sync (a new enum member could silently fall back to raw display if `shared-types` lags codegen).
  evidence: Pre-existing architecture gap, unrelated to the translation-label fix itself; surfaced by adversarial review.
- source_spec: `_bmad-output/implementation-artifacts/spec-enum-i18n-eventcard-fix.md`
  summary: No mechanism (lint rule, codegen step, or test) keeps `EventCategory`/`EventType` members in sync across all four sources: `packages/shared-types`, `apps/web/locales/en.json`, `apps/web/locales/id.json`, and `generated/graphql.ts`. A new locale-parity test (`apps/web/locales/locales.test.ts`) now guards en.json↔id.json parity only.
  evidence: Broader than the current fix's scope; surfaced by adversarial review.
- source_spec: `_bmad-output/implementation-artifacts/spec-enum-i18n-eventcard-fix.md`
  summary: Pairing the translated "From"/"Mulai dari" price label with free-text `ticketPrice` values like `"Free"` (yielding "From  Free") was not reconsidered — may need a product decision on when to show/hide the price-from label based on value.
  evidence: Pre-existing UX question about `ticketPrice` display, not introduced by the label-translation fix; surfaced by adversarial review.
