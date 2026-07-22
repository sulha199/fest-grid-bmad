---
project_name: 'festgrid'
user_name: 'shulha'
date: '2026-07-22T09:08:00Z'
status: 'complete'
rule_count: 19
optimized_for_llm: true
sections_completed:
  - 'technology_stack'
  - 'critical_implementation_rules'
  - 'code_quality_rules'
  - 'testing_rules'
  - 'development_workflow_rules'
  - 'critical_dont_miss_rules'
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

*   **Monorepo:** `pnpm` and `turbo`
*   **Language:** `TypeScript 5` (Strict mode enabled)
*   **Frontend:** `Next.js 14.2.3`, `React 18`
*   **Backend API:** `Express.js`, `pg` (PostgreSQL)
*   **Backend Scraper:** Node.js
*   **Shared Code:** Workspace packages (`@festgrid/shared-types`, `@festgrid/config`)
*   **Linting:** `ESLint` with `eslint-config-next`
*   **UI Component Library:** `Shadcn/ui` (built on Radix UI and Tailwind CSS)

## Critical Implementation Rules

### API & Data
1.  **API Style (GraphQL):** The backend API **must** use GraphQL for all client-server data fetching.
2.  **Data Schemas:** The Prisma schema and the PRD's TypeScript interfaces are the single source of truth for data structures.
3.  **End-to-End Type Safety:** Use `GraphQL Code Generator` to generate TypeScript types from the GraphQL schema, ensuring client and server are always in sync.
4.  **Runtime Schema Validation:** All data entering the system from external sources (APIs, scrapers) **must** be validated at the point of entry with `Zod` (frontend) or `AJV` (backend).

### Database & Performance
5.  **Database Access (Prisma):** All database access **must** be handled through the Prisma ORM.
6.  **Optimized DB Queries:** To prevent over-fetching from the database, GraphQL resolvers **must** use a generic, reusable utility function to translate the GraphQL `info` object into a Prisma `select` or `include` object.

### Security
7.  **API Key Security:** API keys **must** be loaded from environment variables and never be hardcoded.
8.  **Resilient External API Access:** All external API calls **must** go through a central gateway that implements queuing, rate-limiting, and exponential backoff.
9.  **Prevent GraphQL Abuse:** The GraphQL server **must** be configured with query depth and complexity limits to prevent DoS attacks.

### General Architecture
10. **TypeScript Strict Mode:** All code **must** be compliant with strict TypeScript.
11. **Path Aliases:** Use monorepo path aliases (e.g., `@festgrid/shared-types`) for all internal package imports.
12. **Adapter Pattern:** Use an adapter pattern for all external AI services (e.g., Gemini) to ensure modularity.
13. **Core Principle:** Internationalization is a foundational requirement, not an afterthought. All user-facing components and content must be developed with i18n in mind from the start.
14. **Framework:** Use the `next-intl` library for all i18n handling in the Next.js frontend.
15. **Locale Management:** Locales (e.g., `en`, `id`) will be managed via a dedicated `locales` directory, with separate JSON files for each language.
16. **Component Design:** All UI components must be designed to accommodate varying text lengths and support both LTR and RTL layouts to ensure future scalability to other languages.

### Code Quality & Style Rules

1.  **Code Organization:** Pure, framework-agnostic business logic **must** live in a dedicated `packages/domain` package. Within this package, logic should be organized into sub-folders by domain area (e.g., `/events`, `/users`, `/subscriptions`). UI components and API handlers should be lean and delegate complex logic to this package.

### Testing Rules

1.  **Unit Test Requirement:** All logic exported from `packages/domain` **must** have 100% unit test coverage. This is the *only* place where unit tests should be written.
2.  **Testing Philosophy:** For all other code (`apps/*`, etc.), employ a "testing trophy" approach. Prioritize integration tests with `Vitest` and `msw`, and use E2E tests (`Playwright`) for critical user flows only.
3.  **Definition of Done for Testing:** A feature is considered tested when:
    a. The primary E2E "happy path" test is passing.
    b. At least one integration test for the "unhappy path" (e.g., error handling, validation failure) exists for any new logic.
    c. The pull request does not decrease the overall project test coverage percentage.

### Development Workflow Rules

1.  **Pull Request Template:** The PR template **must** include a mandatory checklist item: "[ ] I have confirmed that any new complex business logic has been moved to the `packages/domain` package and is 100% unit tested."

---

## Usage Guidelines

**For AI Agents:**

- Read this file before implementing any code.
- Follow ALL rules exactly as documented.
- When in doubt, ask for clarification.

**For Humans:**

- Keep this file lean and focused on rules AI agents might miss.
- Update when the technology stack or core patterns change.
- Review quarterly to remove rules that have become obvious or obsolete.

_Last Updated: 2026-07-22T09:08:00Z_
