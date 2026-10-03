// Story 3.6n (AD-28 Rules 1/3/4): real, production face detection + per-region Gaussian blur.
// Wires in the WASM-backed @vladmandic/face-api detector that Story 0.46 provisioned (memory,
// native/WASM-binary bundling, model weights) but deliberately left unreachable from
// `ai-processor.ts`'s real import graph (its own AC7). This module IS now reachable from that
// graph (via `process-ai-job.ts`), by design -- see `backfill-face-detection-audit-result.ts`
// and `process-ai-job.ts`'s new step-7.5b call site.
//
// Image-to-tensor bridging (Dev Notes' flagged technical risk): decode via `sharp`'s raw-pixel
// output, construct a `tf.tensor3d` directly, and pass that tensor to `faceapi.detectAllFaces()`
// (whose `TNetInput` type accepts a tensor) -- this avoids `node-canvas` (a native binary,
// exactly the Lambda-bundling problem Story 0.46 rejected for `tfjs-node`) and
// `tf.node.decodeImage()` (only available on the native `tfjs-node` backend, not WASM). This is
// the same bridging approach Story 0.46's own measurement harness/probe
// (`apps/backend/scripts/ai-processor-face-detection-probe.cjs`) already validated end-to-end;
// reused here rather than re-derived.
//
// Imports face-api's dedicated Node+WASM entry (`dist/face-api.node-wasm.js`), never the
// default `dist/face-api.node.js` Node entry, which `require`s the native `@tensorflow/tfjs-node`
// addon -- doing so would silently reintroduce the native-binary/bundle-size problem Story 0.46
// solved by choosing the WASM backend (AD-28 Rule 3).
import sharp from 'sharp';
import * as tf from '@tensorflow/tfjs';
// Side-effect import: registers the WASM backend with tf.
import '@tensorflow/tfjs-backend-wasm';
import path from 'node:path';

// No official TypeScript types ship for the `dist/face-api.node-wasm.js` subpath entry (only
// the package's root `types/face-api.d.ts` is published, matching the browser/ESM build) --
// matches Story 0.46's own probe module's precedent of consuming this entry untyped.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const faceapi: typeof import('@vladmandic/face-api') = require('@vladmandic/face-api/dist/face-api.node-wasm.js');

export interface DetectAndBlurFacesResult {
  buffer: Buffer;
  faceCount: number;
}

let backendReadyPromise: Promise<void> | null = null;
let modelLoadedPromise: Promise<void> | null = null;

/** Gaussian-blur sigma applied over each detected face's bounding box (AD-28 Rule 4). */
const FACE_BLUR_SIGMA = 15;

function resolveModelDir(): string {
  // Lambda runtime (AWS sets LAMBDA_TASK_ROOT automatically): the model weights are copied by
  // `apps/infrastructure/scripts/bundle-ai-processor-face-detection-assets.cjs` into a `model/`
  // directory sibling to the deployed `index.js` -- documented runtime path established by
  // Story 0.46's Dev Notes.
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  const taskRoot = process.env.LAMBDA_TASK_ROOT;
  if (taskRoot) {
    return path.join(taskRoot, 'model');
  }
  // Local dev/test fallback: the SAME model files already ship inside the installed
  // @vladmandic/face-api npm package itself (this is exactly the source directory Story 0.46's
  // bundling script copies FROM) -- no separate fixture/download needed to run real detection
  // locally or in CI. Derived from the already-resolved face-api entry file (not
  // require.resolve('@vladmandic/face-api/package.json') -- esbuild cannot safely bundle a
  // require.resolve() call targeting a non-JS file, and warns accordingly; this entry file is
  // already require()'d above, so resolving it a second time is bundle-safe).
  const faceApiEntryPath = require.resolve('@vladmandic/face-api/dist/face-api.node-wasm.js');
  const faceApiPackageRoot = path.dirname(path.dirname(faceApiEntryPath)); // .../face-api/dist/<file> -> .../face-api
  return path.join(faceApiPackageRoot, 'model');
}

async function ensureBackendAndModelReady(): Promise<void> {
  if (!backendReadyPromise) {
    backendReadyPromise = (async () => {
      await tf.setBackend('wasm');
      await tf.ready();
    })();
  }
  await backendReadyPromise;

  if (!modelLoadedPromise) {
    modelLoadedPromise = faceapi.nets.ssdMobilenetv1.loadFromDisk(resolveModelDir());
  }
  await modelLoadedPromise;
}

/**
 * Detects faces in `imageBytes` (WASM-backed SSD MobileNetV1), then returns the SAME image at
 * its ORIGINAL resolution with a Gaussian blur applied over each detected face's bounding box
 * only (AC3 -- never the whole image, and always before any resize/crop, since cropping first
 * would risk misaligned coordinates for a face partially outside the eventual crop). Resizing
 * to the final thumbnail dimensions happens separately (Task 3 / `upload-face-blur-thumbnail.ts`).
 *
 * Every intermediate tf.Tensor is explicitly disposed to avoid a WASM-backend memory leak across
 * repeated Lambda invocations in the same execution environment.
 */
export async function detectAndBlurFaces(
  imageBytes: Buffer,
  // imageContentType is accepted per this module's documented signature (Task 2) even though
  // sharp auto-detects the format from the bytes themselves -- kept for forward-compatibility
  // and symmetry with rehost-post-image.ts's sibling functions, all of which take it.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  imageContentType: string
): Promise<DetectAndBlurFacesResult> {
  await ensureBackendAndModelReady();

  const { data, info } = await sharp(imageBytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const tensor = tf.tensor3d(new Uint8Array(data), [info.height, info.width, info.channels]);
  let detections;
  try {
    // Cast to `any`: face-api's bundled @tensorflow/tfjs-core type declarations are a
    // structurally-different (nominally incompatible, due to a protected member) copy from
    // this file's own `@tensorflow/tfjs` import -- a type-only duplicate-package mismatch, not
    // a real runtime incompatibility (both resolve to the same WASM-backed tf.Tensor at
    // runtime; this exact bridging pattern is already validated end-to-end by Story 0.46's
    // probe module, which is untyped .cjs and never hit this TS-only issue).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    detections = await faceapi.detectAllFaces(tensor as any, new faceapi.SsdMobilenetv1Options());
  } finally {
    tensor.dispose();
  }

  const faceCount = detections.length;
  if (faceCount === 0) {
    // Nothing to blur -- return the original bytes unchanged rather than an unnecessary
    // decode/re-encode round trip through sharp.
    return { buffer: imageBytes, faceCount: 0 };
  }

  const composites: { input: Buffer; top: number; left: number }[] = [];
  for (const detection of detections) {
    const box = detection.box;
    const left = Math.max(0, Math.round(box.x));
    const top = Math.max(0, Math.round(box.y));
    const width = Math.min(info.width - left, Math.round(box.width));
    const height = Math.min(info.height - top, Math.round(box.height));
    if (width <= 0 || height <= 0) continue; // degenerate/out-of-bounds box, skip defensively

    const blurredRegion = await sharp(imageBytes)
      .extract({ left, top, width, height })
      .blur(FACE_BLUR_SIGMA)
      .toBuffer();
    composites.push({ input: blurredRegion, top, left });
  }

  if (composites.length === 0) {
    // Every detected box was degenerate -- nothing valid to composite back in.
    return { buffer: imageBytes, faceCount };
  }

  const buffer = await sharp(imageBytes).composite(composites).toBuffer();
  return { buffer, faceCount };
}

export let detectAndBlurFacesSeam = detectAndBlurFaces;
export function setDetectAndBlurFacesSeam(fn: typeof detectAndBlurFaces) {
  detectAndBlurFacesSeam = fn;
}
