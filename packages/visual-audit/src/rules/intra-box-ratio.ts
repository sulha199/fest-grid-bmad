/**
 * AD-26 Rule 5, intra-box ratio consistency: a named element pair is checked against an
 * expected ratio at a configurable relative tolerance (default +-8-10%). The expected ratio
 * can be sourced from an explicit token or derived once from a reference prototype's own
 * rendered ratio (AC8).
 *
 * Pure logic -- no Playwright/DOM dependency.
 */

export const DEFAULT_RATIO_TOLERANCE_RELATIVE = 0.09; // within the +-8-10% band

export interface IntraBoxRatioCheckResult {
  pass: boolean;
  actualRatio: number;
  expectedRatio: number;
  deltaRelative: number;
  toleranceRelative: number;
  message: string;
}

/** Derives the expected ratio once from a reference render's own two measured values. */
export function deriveRatioFromReference(valueA: number, valueB: number): number {
  if (valueB === 0) {
    throw new Error('Cannot derive a ratio: reference denominator value is 0');
  }
  return valueA / valueB;
}

export function checkIntraBoxRatio(
  valueA: number,
  valueB: number,
  expectedRatio: number,
  toleranceRelative: number = DEFAULT_RATIO_TOLERANCE_RELATIVE
): IntraBoxRatioCheckResult {
  const actualRatio = valueB === 0 ? Infinity : valueA / valueB;
  const deltaRelative = expectedRatio === 0 ? Math.abs(actualRatio) : Math.abs(actualRatio - expectedRatio) / Math.abs(expectedRatio);
  const pass = deltaRelative <= toleranceRelative;
  return {
    pass,
    actualRatio,
    expectedRatio,
    deltaRelative,
    toleranceRelative,
    message: pass
      ? `Ratio ${actualRatio.toFixed(3)} within ${(toleranceRelative * 100).toFixed(1)}% of expected ${expectedRatio.toFixed(3)}`
      : `Ratio ${actualRatio.toFixed(3)} deviates ${(deltaRelative * 100).toFixed(1)}% from expected ${expectedRatio.toFixed(3)}, exceeding tolerance ${(toleranceRelative * 100).toFixed(1)}%`,
  };
}
