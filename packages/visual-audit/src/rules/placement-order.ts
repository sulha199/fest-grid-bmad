/**
 * Story 0.45 AC9(b): placement-order rule -- proves item placement order approximates today's
 * row-major left-to-right reading order (AD-27 Rule 1/4), not column-major. Complements
 * `sibling-dimension` (AC9(a), "columns share one width") -- together they're what AC9 requires
 * this story's own real `grid-container-masonry.ts` manifest entry to check.
 *
 * Pure logic -- no Playwright/DOM dependency, so it's unit-testable directly (mirrors
 * `sibling-dimension.ts`'s own split between pure clustering/comparison logic here and DOM
 * extraction in `engine.ts`).
 */

export interface PlacementOrderCheckResult {
  pass: boolean;
  actualLeadingIndices: number[];
  expectedLeadingIndices: number[];
  message: string;
}

/**
 * Checks that the first N items (N = number of columns) land one-per-column, in index order,
 * left to right -- i.e. column 0's topmost item is item 0, column 1's topmost item is item 1,
 * etc. `actualLeadingIndices[c]` is the item index found at the top of column `c` (columns
 * ordered left-to-right); a column with no items (or whose topmost item's index couldn't be
 * read) reports `-1`, which never matches its expected index and so fails the check.
 */
export function checkPlacementOrder(actualLeadingIndices: number[]): PlacementOrderCheckResult {
  const expectedLeadingIndices = actualLeadingIndices.map((_, i) => i);
  const pass = actualLeadingIndices.every((value, i) => value === expectedLeadingIndices[i]);
  return {
    pass,
    actualLeadingIndices,
    expectedLeadingIndices,
    message: pass
      ? `First ${actualLeadingIndices.length} item(s) land one-per-column in left-to-right index order: [${actualLeadingIndices.join(', ')}]`
      : `Placement order mismatch: expected leading items [${expectedLeadingIndices.join(', ')}] (one per column, left to right), got [${actualLeadingIndices.join(', ')}]`,
  };
}
