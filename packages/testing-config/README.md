# @festgrid/testing-config

Shared testing configurations for the FestGrid monorepo.

## Testing Philosophy

Per the project's rules, we follow the "Testing Trophy" approach:

- **Vitest + MSW:** Used for unit and integration testing. This is the bulk of our testing layer. Integration tests run fast and mock external boundaries (HTTP) using MSW.
- **Playwright:** Used **strictly** in `apps/web` for critical-path End-to-End (E2E) testing. Playwright and its heavy browser dependencies are never added to shared packages.
- **packages/domain:** When this package is created, it will enforce a strict 100% unit-test coverage rule. It should use the `vitest-node` preset since it contains pure TypeScript logic.

## Exports

### `./vitest-node`

**When to use:** For Node.js or domain-agnostic packages that don't depend on React or the DOM (e.g., `packages/database`, `packages/domain`).

**How to use:**

```ts
// vitest.config.ts
import { defineConfig, mergeConfig } from 'vitest/config';
import nodeConfig from '@festgrid/testing-config/vitest-node';

export default mergeConfig(nodeConfig, defineConfig({}));
```

### `./vitest-react`

**When to use:** For React packages or applications that require a DOM environment (e.g., `apps/web`, `packages/analytics`, future `packages/ui`).

**What it includes:**
- `jsdom` environment
- `@testing-library/jest-dom/vitest` matchers automatically configured
- MSW node server started, reset, and closed automatically before/after tests

**How to use:**

```ts
// vitest.config.ts
import { defineConfig, mergeConfig } from 'vitest/config';
import reactConfig from '@festgrid/testing-config/vitest-react';
// import react from '@vitejs/plugin-react'; // if JSX transform is needed

export default mergeConfig(reactConfig, defineConfig({}));
```

### `./msw-handlers`

**When to use:** For extending the base Mock Service Worker HTTP handlers in your integration tests.

**How to use:**
Import the base handlers from `@festgrid/testing-config/msw-handlers` if you need to inspect or compose them, though the `vitest-react` preset already boots the server with them automatically.
