import test from 'node:test';
import * as assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { detectAndBlurFaces } from './detect-and-blur-faces.js';

// This package compiles to CommonJS (no "type": "module" in package.json) -- __dirname is the
// real ambient CJS global here, matching process-ai-job.cc024-grouping.test.ts's precedent.

// Real WASM-backed SSD MobileNetV1 detection -- no mocking of face-api/sharp/tfjs here, per
// this story's AC8 requirement that the fixture-based test confirm the thumbnail's face region
// is visibly blurred, not just that some function was called.
test('detectAndBlurFaces', async (t) => {
  await t.test('a fixture with a clearly visible face detects at least one face and blurs it', async () => {
    const imageBytes = readFileSync(path.join(__dirname, '__fixtures__/face-visible.jpg'));

    const result = await detectAndBlurFaces(imageBytes, 'image/jpeg');

    assert.ok(result.faceCount >= 1, `expected at least one detected face, got ${result.faceCount}`);
    assert.ok(Buffer.isBuffer(result.buffer));
    assert.notDeepStrictEqual(result.buffer, imageBytes, 'expected the returned bytes to differ from the input (face region blurred)');

    // Pixel-level check: the detected face region's pixel variance should drop sharply after
    // blurring (a Gaussian blur over a real face smooths out eyes/mouth/edges), while the
    // image's overall dimensions must stay at original resolution (AC3 -- blur happens BEFORE
    // any resize/crop).
    const originalMeta = await sharp(imageBytes).metadata();
    const blurredMeta = await sharp(result.buffer).metadata();
    assert.strictEqual(blurredMeta.width, originalMeta.width, 'blurred image must stay at original resolution');
    assert.strictEqual(blurredMeta.height, originalMeta.height, 'blurred image must stay at original resolution');

    // Sample a central region of the fixture's known face location (see Dev Notes -- the
    // fixture was cropped so the detected face sits roughly center-left) and confirm its pixel
    // variance (a proxy for high-frequency detail: eyes, mouth, edges) is substantially lower
    // after blurring than before.
    const region = { left: 90, top: 150, width: 160, height: 150 };
    const originalRegion = await sharp(imageBytes).extract(region).raw().toBuffer();
    const blurredRegion = await sharp(result.buffer).extract(region).raw().toBuffer();

    function variance(buf: Buffer): number {
      const mean = buf.reduce((sum, v) => sum + v, 0) / buf.length;
      return buf.reduce((sum, v) => sum + (v - mean) ** 2, 0) / buf.length;
    }

    const originalVariance = variance(originalRegion);
    const blurredVariance = variance(blurredRegion);
    assert.ok(
      blurredVariance < originalVariance * 0.6,
      `expected the detected face region's pixel variance to drop after blurring (original=${originalVariance.toFixed(1)}, blurred=${blurredVariance.toFixed(1)})`
    );
  });

  await t.test('a fixture with no people detects zero faces and returns bytes unchanged', async () => {
    const imageBytes = readFileSync(path.join(__dirname, '__fixtures__/no-face.jpg'));

    const result = await detectAndBlurFaces(imageBytes, 'image/jpeg');

    assert.strictEqual(result.faceCount, 0);
    assert.deepStrictEqual(result.buffer, imageBytes, 'expected the original bytes to be returned unchanged when no faces are detected');
  });
});
