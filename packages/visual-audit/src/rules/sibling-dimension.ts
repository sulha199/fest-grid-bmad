/**
 * AD-26 Rule 5, sibling-dimension consistency: elements are auto-clustered into rows/columns by
 * bounding-box coordinate overlap, then clustered siblings expected to share a dimension are
 * checked at a configurable absolute tolerance (default <=2px).
 *
 * Pure logic -- no Playwright/DOM dependency, so it's unit-testable directly (Story 0.44's
 * "unit-test the pure comparison/tolerance/clustering logic" tier).
 */

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const DEFAULT_SIBLING_TOLERANCE_PX = 2;

/**
 * Clusters boxes into rows (grouped by vertical/`y` overlap) -- the shape needed for
 * "elements sharing a row should share a height" checks. Two boxes are in the same cluster
 * when their `[y, y+height)` ranges overlap by more than zero.
 */
export function clusterByRowOverlap(boxes: BoundingBox[]): BoundingBox[][] {
  const remaining = boxes.map((box, index) => ({ box, index }));
  const clusters: BoundingBox[][] = [];

  while (remaining.length > 0) {
    const seed = remaining.shift()!;
    const cluster = [seed];
    for (let i = remaining.length - 1; i >= 0; i -= 1) {
      const candidate = remaining[i];
      const overlapsAny = cluster.some((member) => verticalRangesOverlap(member.box, candidate.box));
      if (overlapsAny) {
        cluster.push(candidate);
        remaining.splice(i, 1);
      }
    }
    clusters.push(cluster.map((c) => c.box));
  }

  return clusters;
}

/**
 * Clusters boxes into columns (grouped by horizontal/`x` overlap) -- the shape AD-27's masonry
 * "columns share one width" invariant needs (multi-instance render scope, AC3/AC7).
 */
export function clusterByColumnOverlap(boxes: BoundingBox[]): BoundingBox[][] {
  const remaining = boxes.map((box, index) => ({ box, index }));
  const clusters: BoundingBox[][] = [];

  while (remaining.length > 0) {
    const seed = remaining.shift()!;
    const cluster = [seed];
    for (let i = remaining.length - 1; i >= 0; i -= 1) {
      const candidate = remaining[i];
      const overlapsAny = cluster.some((member) => horizontalRangesOverlap(member.box, candidate.box));
      if (overlapsAny) {
        cluster.push(candidate);
        remaining.splice(i, 1);
      }
    }
    clusters.push(cluster.map((c) => c.box));
  }

  return clusters;
}

function verticalRangesOverlap(a: BoundingBox, b: BoundingBox): boolean {
  return a.y < b.y + b.height && b.y < a.y + a.height;
}

function horizontalRangesOverlap(a: BoundingBox, b: BoundingBox): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width;
}

export interface SiblingDimensionCheckResult {
  pass: boolean;
  values: number[];
  maxDeltaPx: number;
  toleranceAbsolutePx: number;
  message: string;
}

/**
 * Checks that every box in a (pre-clustered) sibling set shares the given dimension within
 * `toleranceAbsolutePx` (default 2px) of the cluster's mean value.
 */
export function checkSiblingDimension(
  boxes: BoundingBox[],
  dimension: 'width' | 'height',
  toleranceAbsolutePx: number = DEFAULT_SIBLING_TOLERANCE_PX
): SiblingDimensionCheckResult {
  const values = boxes.map((box) => box[dimension]);
  if (values.length === 0) {
    return { pass: true, values, maxDeltaPx: 0, toleranceAbsolutePx, message: 'No elements to compare' };
  }
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const maxDeltaPx = values.reduce((max, v) => Math.max(max, Math.abs(v - mean)), 0);
  const pass = maxDeltaPx <= toleranceAbsolutePx;
  return {
    pass,
    values,
    maxDeltaPx,
    toleranceAbsolutePx,
    message: pass
      ? `All ${values.length} sibling(s) share ${dimension} within ${toleranceAbsolutePx}px (max delta ${maxDeltaPx.toFixed(2)}px)`
      : `Sibling ${dimension} mismatch: max delta ${maxDeltaPx.toFixed(2)}px exceeds tolerance ${toleranceAbsolutePx}px (values: ${values.join(', ')})`,
  };
}
