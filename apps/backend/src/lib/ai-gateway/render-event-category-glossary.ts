import { EventCategory, EVENT_CATEGORY_DEFINITIONS, CATEGORY_BOUNDARIES } from '@festgrid/shared-types';

/**
 * Story 0.52 (AD-44 Rule 4). Renders `EVENT_CATEGORY_DEFINITIONS` + `CATEGORY_BOUNDARIES` into the
 * single glossary block embedded verbatim by both prompt builders (`build-gemini-request.ts`,
 * `build-filter-extraction-request.ts`) -- the one place that formats this content, so the two
 * prompts can never drift from each other or from the definitions source.
 *
 * Pure and deterministic: no dates, no randomness, stable across calls, and iterates
 * `Object.values(EventCategory)` in its fixed declaration order every time.
 *
 * Uses ASCII ` -- ` (not U+2014 em dash) to match this codebase's existing prompt-prose dash
 * convention (see `build-gemini-request.ts`'s "-- the most common real-world case").
 */
export function renderEventCategoryGlossary(): string {
  const categoryLines = Object.values(EventCategory).map((category) => {
    const { definition, aliases } = EVENT_CATEGORY_DEFINITIONS[category];
    return `  - ${category} -- ${definition} (also: ${aliases.join(', ')})`;
  });

  const boundaryLines = CATEGORY_BOUNDARIES.map((boundary) => `  - ${boundary.rule}`);

  return [...categoryLines, ...boundaryLines].join('\n');
}
