/**
 * AD-26 Rule 2 secondary/confirmatory signal: pixel screenshot diff against the source PNG.
 *
 * Review Follow-up (decision-needed item 3, RULING: wire the `imports/**\/*.png` diff now,
 * 2026-09-22): the original implementation named `toHaveScreenshot()` as the mechanism but never
 * actually read `reference.prototypePngPath` -- the committed baseline was self-captured from
 * the same mounted markup being checked, so the signal passed by construction. `toHaveScreenshot()`
 * manages its own snapshot directory and cannot be pointed at an arbitrary external PNG path
 * without custom `snapshotPathTemplate` plumbing, so this module instead does the comparison
 * directly: decode both images, resize the reference PNG (an arbitrary-DPI design export, not a
 * byte-for-byte capture of this exact render) to the rendered screenshot's own resolution, and
 * diff per-pixel.
 *
 * `pixelmatch`/`pngjs` are not resolvable in this monorepo's offline package store (no network
 * access at implementation time); `sharp` is used instead -- already present in `pnpm-lock.yaml`
 * as an existing transitive dependency (pulled in by `next`'s image optimization), pinned here
 * to the same already-resolved version so `pnpm install` needs no new registry fetch. The
 * per-pixel comparison itself (Euclidean RGB distance against a threshold) is hand-rolled rather
 * than pulled in from a second library, mirroring what `pixelmatch` does internally.
 */

import sharp from 'sharp';

export interface PixelDiffOptions {
  /** Fraction of pixels allowed to differ before the diff fails -- 2026 best practice per this
   * story's Dev Notes is a per-component ratio rather than one global tolerance. */
  maxDiffPixelRatio?: number;
  /** Per-pixel RGB-distance threshold (0..1) above which a pixel counts as "different". */
  threshold?: number;
}

export const DEFAULT_PIXEL_DIFF_OPTIONS: Required<PixelDiffOptions> = {
  maxDiffPixelRatio: 0.02,
  threshold: 0.2,
};

export interface PixelDiffResult {
  pass: boolean;
  diffPixelCount: number;
  totalPixels: number;
  diffRatio: number;
  message: string;
}

const MAX_RGB_DISTANCE = Math.sqrt(3 * 255 * 255);

/**
 * Diffs a rendered element/page screenshot against the real source-of-truth PNG on disk (the
 * manifest's `reference.prototypePngPath`). `referencePngPath` is an absolute filesystem path;
 * callers resolve it against `repoRoot` before calling this.
 */
export async function diffScreenshotAgainstReferencePng(
  screenshotBuffer: Buffer,
  referencePngPath: string,
  options: PixelDiffOptions = {}
): Promise<PixelDiffResult> {
  const threshold = options.threshold ?? DEFAULT_PIXEL_DIFF_OPTIONS.threshold;
  const maxDiffPixelRatio = options.maxDiffPixelRatio ?? DEFAULT_PIXEL_DIFF_OPTIONS.maxDiffPixelRatio;

  const actualSharp = sharp(screenshotBuffer).ensureAlpha();
  const { width, height } = await actualSharp.metadata();
  if (!width || !height) {
    throw new Error('Could not read rendered screenshot dimensions');
  }

  const [actualBuffer, referenceBuffer] = await Promise.all([
    actualSharp.raw().toBuffer(),
    sharp(referencePngPath).ensureAlpha().resize(width, height, { fit: 'fill' }).raw().toBuffer(),
  ]);

  let diffPixelCount = 0;
  const totalPixels = width * height;
  for (let i = 0; i < actualBuffer.length; i += 4) {
    const dr = actualBuffer[i] - referenceBuffer[i];
    const dg = actualBuffer[i + 1] - referenceBuffer[i + 1];
    const db = actualBuffer[i + 2] - referenceBuffer[i + 2];
    const distance = Math.sqrt(dr * dr + dg * dg + db * db) / MAX_RGB_DISTANCE;
    if (distance > threshold) diffPixelCount++;
  }

  const diffRatio = diffPixelCount / totalPixels;
  const pass = diffRatio <= maxDiffPixelRatio;
  return {
    pass,
    diffPixelCount,
    totalPixels,
    diffRatio,
    message: pass
      ? `Pixel diff ${(diffRatio * 100).toFixed(2)}% within ${(maxDiffPixelRatio * 100).toFixed(2)}% tolerance against ${referencePngPath}`
      : `Pixel diff ${(diffRatio * 100).toFixed(2)}% exceeds ${(maxDiffPixelRatio * 100).toFixed(2)}% tolerance against ${referencePngPath} (${diffPixelCount}/${totalPixels} px)`,
  };
}
