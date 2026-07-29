# Deferred Work

This file tracks work deferred from development stories, code reviews, and planning sessions.

## Deferred from: code review of 0-1-initialize-pnpm-monorepo.md (2026-07-22)

- Missing next-intl integration vs. project i18n constraint — The app layout and page currently hardcode English text, directly violating project-context.md general architecture rules 14 & 15. Deferred: To address i18n setup in a dedicated workspace setup story

## Deferred from: code review of 1-1-create-initial-database-tables.md (2026-07-27)

- Vague local Postgres instance setup — deferred, pre-existing

## Deferred from: continuing 1-3-display-a-list-of-events-on-the-main-page.md / apps/backend extraction (2026-07-28)

- `buildOptimizedDrizzleSelect` not implemented — `apps/backend/src/events/query.ts` selects a fixed set of columns rather than dynamically building the Drizzle `select` from the requested GraphQL fields, as required by project-context.md. Deferred: needs a GraphQL AST → Drizzle column-selection helper, reused by all future resolvers.
- AWS deployment IaC missing — `apps/backend` now has a working Lambda handler (`src/handler.ts`) and local dev server, but there is still no `serverless.yml`/CDK/SAM stack to actually deploy it to API Gateway + Lambda. The CI `aws-backend-deploy-stub` job remains a placeholder.
- AD-4 (Multi-Tiered Strict State Management) not fully applied to the discovery page — `apps/web/src/app/page.tsx` still uses local `useState`/`fetch` for server state instead of `@tanstack/react-query` + `graphql-request` end-to-end (graphql-request is now used server-side in the `/api/events` proxy route, but the client component itself does not yet use react-query). Deferred: needs `@tanstack/react-query` + `GraphQL Code Generator` setup across the app, likely its own workspace-setup story.
- No frontend test tooling configured — `apps/web` has no Vitest/Playwright/MSW setup yet, so AC9's integration/E2E coverage for infinite-scroll append behavior at the UI layer is not yet automated (domain-level filtering/pagination logic is already 100% unit tested in `packages/domain`).
