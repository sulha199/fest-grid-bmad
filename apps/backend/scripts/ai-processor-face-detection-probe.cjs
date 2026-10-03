// Story 0.46 (AC2/AC3/AC4/AC6): a self-contained, INERT module proving the image-
// processing runtime aiProcessorLambda's deployed asset actually ships works end to
// end -- WASM-backed face-api detection plus sharp blur/resize. Nothing in this file
// runs merely by being required: `detectAndBlurFaces` only executes when a future
// caller (Story 3.6n) actually calls it. This file is NOT required by
// `apps/backend/src/lambdas/ai-processor.ts` or `process-ai-job.ts` -- per AC7, no
// face-detection stage is wired into the real handler by this story. It ships inside
// the deployed asset (bundled by a second, separate esbuild pass -- see
// `bundle-ai-processor-face-detection-probe.cjs` -- wired into aiProcessorLambda's
// `bundling.commandHooks.afterBundling` in festgrid-backend-stack.ts) purely so 3.6n
// can `require('./face-detection-runtime.js')` later without any further CDK/bundling
// changes, and so this story's own infra tests (AC2/AC3) can prove the real
// synthesized asset actually contains working sharp + face-api + tfjs + tfjs-backend-
// wasm code, not just files sitting in node_modules.
//
// Why a second esbuild pass instead of `bundling.nodeModules` (this story's earlier
// approach, reverted -- see Dev Notes): installing the full npm packages measured at
// ~321 MB unzipped, over Lambda's 250 MB limit, driven by @tensorflow/tfjs's package
// directory shipping many redundant pre-built variants (browser/esm/cjs/min) and
// multi-MB sourcemaps per package that esbuild's own bundling never includes (it
// resolves exactly one code path per `require()` and drops dead code). Bundling the
// REAL, unmodified packages through this probe (not a hand-written stub -- a stub
// swapping `@tensorflow/tfjs` for `@tensorflow/tfjs-core` was tried and broke at
// runtime: `TypeError: i.as3D is not a function`, because the full `tfjs` package
// patches ~100 convenience methods onto Tensor.prototype that tfjs-core's own build
// doesn't have) brought the real measured bundle down to ~2.3 MB raw (see Dev Notes
// for the final in-asset number after the model weights/.wasm files are copied
// alongside it).
'use strict';

const path = require('path');
const sharp = require('sharp');
const tf = require('@tensorflow/tfjs');
// Dedicated Node+WASM entry (AC4): requires only @tensorflow/tfjs and
// @tensorflow/tfjs-backend-wasm, never the native @tensorflow/tfjs-node addon pulled
// in by the package's default `main` field (dist/face-api.node.js). Verified by
// static inspection of the installed package: zero occurrences of "tfjs-node" in
// dist/face-api.node-wasm.js.
require('@tensorflow/tfjs-backend-wasm');
const faceapi = require('@vladmandic/face-api/dist/face-api.node-wasm.js');

let backendReady = null;
let modelLoaded = null;

async function ensureBackendAndModel(modelDir) {
  if (!backendReady) {
    backendReady = (async () => {
      await tf.setBackend('wasm');
      await tf.ready();
    })();
  }
  await backendReady;

  if (!modelLoaded) {
    // Default path: sibling `model/` directory next to this bundled file (same
    // directory as the Lambda's deployed index.js, since commandHooks.afterBundling
    // copies both into the single output dir) -- documented runtime path for 3.6n.
    const dir = modelDir || path.join(__dirname, 'model');
    modelLoaded = faceapi.nets.ssdMobilenetv1.loadFromDisk(dir);
  }
  await modelLoaded;
}

/**
 * Detects faces in a JPEG/PNG buffer via the WASM-backed SSD MobileNetV1 detector,
 * then returns a Gaussian-blurred + resized JPEG (for the detected faces' host image).
 * NOT called by any production code path in this story -- a working, ready-to-use
 * building block for Story 3.6n's own pipeline wiring.
 *
 * @param {Buffer} imageBuffer
 * @param {{ modelDir?: string }} [options]
 */
async function detectAndBlurFaces(imageBuffer, options = {}) {
  await ensureBackendAndModel(options.modelDir);

  const { data, info } = await sharp(imageBuffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const tensor = tf.tensor3d(new Uint8Array(data), [info.height, info.width, info.channels]);
  let detections;
  try {
    detections = await faceapi.detectAllFaces(tensor, new faceapi.SsdMobilenetv1Options());
  } finally {
    tensor.dispose();
  }

  const blurred = await sharp(imageBuffer).blur(15).resize(480, 480, { fit: 'cover' }).jpeg({ quality: 82 }).toBuffer();

  return { faceCount: detections.length, detections, blurredJpeg: blurred };
}

module.exports = { detectAndBlurFaces, ensureBackendAndModel };
