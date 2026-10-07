/**
 * CC-030 sibling-gap consistency: vertically stacked siblings (auto-clustered into columns by
 * horizontal overlap, the same clustering `sibling-dimension` uses for multi-instance renders)
 * must be separated by exactly the expected gap (default tolerance <=2px, matching Rule 5's other
 * absolute-px checks). Added after masonry Phase 2 shipped with absolutely positioned items that
 * silently ignored the grid's `row-gap`: no existing rule measured the space BETWEEN elements, so
 * the missing gap passed every check.
 *
 * A negative gap means the boxes overlap and always fails, whatever the tolerance. Pure logic --
 * no Playwright/DOM dependency, so it is unit-testable directly (Story 0.44's tier).
 */

import { DEFAULT_SIBLING_TOLERANCE_PX, type BoundingBox } from './sibling-dimension.js';

export interface SiblingGapCheckResult {
  pass: boolean;
  /** Number of vertically adjacent pairs measured (0 means nothing was stacked, nothing proven). */
  pairCount: number;
  /** Measured `next.top - prev.bottom`, one per adjacent pair, in top-to-bottom order. */
  gaps: number[];
  expectedPx: number;
  toleranceAbsolutePx: number;
  message: string;
}

/**
 * Checks one pre-clustered column of boxes: sorted by top edge, every consecutive pair must be
 * `expectedPx` apart within `toleranceAbsolutePx`.
 */
export function checkSiblingGap(
  boxes: BoundingBox[],
  expectedPx: number,
  toleranceAbsolutePx: number = DEFAULT_SIBLING_TOLERANCE_PX
): SiblingGapCheckResult {
  const sorted = [...boxes].sort((a, b) => a.y - b.y);
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    gaps.push(sorted[i].y - (prev.y + prev.height));
  }

  if (gaps.length === 0) {
    return {
      pass: true,
      pairCount: 0,
      gaps,
      expectedPx,
      toleranceAbsolutePx,
      message: 'No vertically stacked siblings to measure',
    };
  }

  const overlapping = gaps.some((g) => g < 0 - toleranceAbsolutePx);
  const maxDeltaPx = gaps.reduce((max, g) => Math.max(max, Math.abs(g - expectedPx)), 0);
  const pass = !overlapping && maxDeltaPx <= toleranceAbsolutePx;
  return {
    pass,
    pairCount: gaps.length,
    gaps,
    expectedPx,
    toleranceAbsolutePx,
    message: pass
      ? `All ${gaps.length} stacked pair(s) are ${expectedPx}px apart within ${toleranceAbsolutePx}px (gaps: ${gaps.map((g) => g.toFixed(1)).join(', ')})`
      : `Sibling gap mismatch: expected ${expectedPx}px +-${toleranceAbsolutePx}px, got ${gaps.map((g) => g.toFixed(1)).join(', ')}px${overlapping ? ' (negative gap = overlapping boxes)' : ''}`,
  };
}
