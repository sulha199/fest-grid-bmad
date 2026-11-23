import test from 'node:test';
import * as assert from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { detectAndBlurFaces, FACE_DETECTION_MAX_EDGE } from './detect-and-blur-faces.js';

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
  // Privacy-relevant regression (a missed face is an unblurred face): real detection on a big
  // canvas must find the same face as at original size, mapped back inside the ORIGINAL bounds.
  // The fixture is upscaled 6x (a 2400x2400 photo region placed in the 4000x3000 canvas) so the
  // face is realistically large. A face that is tiny relative to a 12 MP frame (the 400 px
  // fixture pasted unscaled) is missed on master too -- the 512 px network input is the limit,
  // not the 1024 px detection copy -- so it is not a valid parity case.
  await t.test('a face fixture inside a 4000x3000 canvas is still detected (downscaled detection input) and blurred at original resolution', async () => {
    const faceBytes = readFileSync(path.join(__dirname, '__fixtures__/face-visible.jpg'));
    const baseline = await detectAndBlurFaces(faceBytes, 'image/jpeg');
    assert.ok(baseline.faceCount >= 1);

    const scale = 6;
    const canvasW = 4000;
    const canvasH = 3000;
    const offsetLeft = 800;
    const offsetTop = 300;
    assert.ok(canvasW > FACE_DETECTION_MAX_EDGE);
    const bigFace = await sharp(faceBytes).resize(400 * scale, 400 * scale).png().toBuffer();
    const png = await sharp({ create: { width: canvasW, height: canvasH, channels: 3, background: { r: 128, g: 128, b: 128 } } })
      .composite([{ input: bigFace, left: offsetLeft, top: offsetTop }])
      .png()
      .toBuffer();

    const result = await detectAndBlurFaces(png, 'image/png');

    assert.strictEqual(result.faceCount, baseline.faceCount, 'same face count at 4000x3000 as at original size');
    const meta = await sharp(result.buffer).metadata();
    assert.strictEqual(meta.width, canvasW, 'result stays at original resolution');
    assert.strictEqual(meta.height, canvasH, 'result stays at original resolution');

    // Bounding box of every pixel the blur changed: it must lie inside the original dimensions and
    // overlap the fixture's known face area (90,150 160x150, scaled and shifted), proving the
    // detection box was mapped back correctly. Nothing outside it may change (corner check).
    const beforeRaw = await sharp(png).removeAlpha().raw().toBuffer();
    const afterRaw = await sharp(result.buffer).removeAlpha().raw().toBuffer();
    let minX = canvasW, minY = canvasH, maxX = -1, maxY = -1;
    for (let y = 0; y < canvasH; y++) {
      for (let x = 0; x < canvasW; x++) {
        const i = (y * canvasW + x) * 3;
        if (beforeRaw[i] !== afterRaw[i] || beforeRaw[i + 1] !== afterRaw[i + 1] || beforeRaw[i + 2] !== afterRaw[i + 2]) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    assert.ok(maxX >= 0, 'some pixels were blurred');
    assert.ok(minX >= 0 && minY >= 0 && maxX < canvasW && maxY < canvasH, 'blurred area lies inside the original dimensions');
    const faceCenterX = offsetLeft + (90 + 80) * scale;
    const faceCenterY = offsetTop + (150 + 75) * scale;
    assert.ok(
      minX <= faceCenterX && faceCenterX <= maxX && minY <= faceCenterY && faceCenterY <= maxY,
      `blurred area (${minX},${minY})-(${maxX},${maxY}) must cover the face centre (${faceCenterX},${faceCenterY})`
    );
    // Far corner of the canvas (no face) is untouched.
    assert.ok(minX > 200 && minY > 200, 'blur stays near the face, not the whole image');
  });
});
