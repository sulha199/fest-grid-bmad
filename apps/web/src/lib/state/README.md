# State Management Framework (AD-4)

This application strictly follows a **Three-Tier State Architecture**. When introducing new state to a feature, refer to the following guide to ensure you pick the correct tier and library.

## Tier 1: Server State -> `@tanstack/react-query`
- **Rule of thumb:** Any data fetched from, or mutated on, the backend (e.g., database models, API responses).
- **Tooling:** React Query with `graphql-request` and strict Code-Generator types.
- **Why:** Handles caching, re-fetching, deduplication, and background updates automatically.

## Tier 2: URL State -> `nuqs`
- **Rule of thumb:** Any state that should survive a page reload or be shareable via a link (e.g., search queries, active filters, pagination, sort order).
- **Tooling:** `nuqs` (Next.js URL query state) with strict parsers.
- **Example Usage:**
  ```tsx
  import { useQueryState, parseAsStringEnum } from 'nuqs'

  enum SortOrder {
    Asc = 'asc',
    Desc = 'desc'
  }

  // Type-safe URL state that maps ?sort=asc in the URL to a typed React state
  const [sort, setSort] = useQueryState(
    'sort', 
    parseAsStringEnum<SortOrder>(Object.values(SortOrder)).withDefault(SortOrder.Asc)
  )
  ```

## Tier 3: Client Global State -> `zustand`
- **Rule of thumb:** Ephemeral, cross-component UI state that doesn't need to be in the URL and isn't tied to the server (e.g., multi-tab selections, wizard intermediate steps across different components).
- **Tooling:** `zustand`, using interface-driven stores.
- **Pattern:** See `example-ui-store.ts` for the required strictly-typed interface pattern.
- **Performance Tip:** Always use `useShallow` from `zustand/react/shallow` when selecting multiple properties from a store to prevent unnecessary re-renders.
