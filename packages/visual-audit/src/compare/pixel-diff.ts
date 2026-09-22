/**
 * AD-26 Rule 2 secondary/confirmatory signal: pixel screenshot diff against the source PNG via
 * Playwright's built-in `toHaveScreenshot()` (backed by `pixelmatch`) -- the current standard
 * approach per this story's Dev Notes web research; no separate diffing library needed.
 *
 * `toHaveScreenshot()` only works against Playwright's own `expect` inside a `@playwright/test`
 * test body (it manages the golden-snapshot directory itself), so this module's job is just to
 * name the convention the manifest-runner spec files use, plus the recommended per-check options
 * (component-level, not full-page; masked/disabled animations upstream) rather than re-implement
 * screenshot diffing here.
 */

export interface PixelDiffOptions {
  /** Forwarded to `toHaveScreenshot()`'s `maxDiffPixelRatio` -- 2026 best practice per Dev Notes
   * is a per-component ratio rather than one global tolerance. */
  maxDiffPixelRatio?: number;
  threshold?: number;
}

export const DEFAULT_PIXEL_DIFF_OPTIONS: PixelDiffOptions = {
  maxDiffPixelRatio: 0.02,
  threshold: 0.2,
};
