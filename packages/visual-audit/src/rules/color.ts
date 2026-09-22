/**
 * AD-26 Rule 6, color fidelity: primary signal is an exact computed-value match against the
 * element's resolved DESIGN.md/Tailwind token; the fallback signal (pixel diff, see
 * `compare/pixel-diff.ts`) is used only when no token is declared for that element.
 *
 * Pure logic -- comparing two already-extracted CSS color strings.
 */

export interface ColorCheckResult {
  pass: boolean;
  actual: string;
  expected: string;
  message: string;
}

/** Normalizes a CSS color string (e.g. `getComputedStyle`'s `rgb(30, 41, 59)`) for comparison,
 * collapsing whitespace differences. Does not attempt cross-color-space conversion -- both
 * sides must already be the same representation (this repo's tokens resolve to `rgb()`/`rgba()`
 * via Tailwind's compiled CSS, matching what `getComputedStyle` returns in Chromium). */
function normalize(color: string): string {
  return color.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function checkColorToken(actualComputedColor: string, expectedResolvedValue: string): ColorCheckResult {
  const actual = normalize(actualComputedColor);
  const expected = normalize(expectedResolvedValue);
  const pass = actual === expected;
  return {
    pass,
    actual,
    expected,
    message: pass
      ? `Computed color exactly matches token value ${expected}`
      : `Computed color "${actual}" does not exactly match token value "${expected}"`,
  };
}
