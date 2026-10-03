// Story 0.46 (AC3/AC6) + Story 3.6n (wires the real detection in): aiProcessorLambda's
// bundling.commandHooks.afterBundling step. Copies the non-JS assets the face-detection stage
// needs -- the SSD MobileNetV1 model weights and tfjs-backend-wasm's .wasm binaries -- into the
// SAME output directory as the Lambda's own index.js (ai-processor.ts's bundle).
//
// History: Story 0.46 originally ran a SEPARATE esbuild pass here too, bundling a dedicated,
// inert probe module (`ai-processor-face-detection-probe.cjs`) into a sibling
// `face-detection-runtime.js` file, specifically because `ai-processor.ts` did NOT yet import
// any face-api/tfjs code (that story's own AC7 -- no face-detection stage wired in). Story 3.6n
// now wires the REAL detection module (`apps/backend/src/lib/ai-processor/detect-and-blur-
// faces.ts`) directly into `process-ai-job.ts`, which `ai-processor.ts` imports -- so CDK's own
// PRIMARY esbuild bundling pass (which produces index.js) now reaches and inlines the real
// face-api/@tensorflow/tfjs/@tensorflow/tfjs-backend-wasm code on its own (none of those three
// packages are listed in `nodeModules` below, only `sharp` is, so esbuild treats them as
// ordinary bundleable JS and tree-shakes exactly like it did for the old probe -- same
// resulting size class, ~2-3 MB inlined). The separate probe-bundling esbuild pass above is
// therefore now redundant and has been removed; only the asset-copy step below remains needed,
// since esbuild never copies non-JS files (the model weights, the .wasm binaries) regardless of
// which file requires them.
const fs = require('fs');
const path = require('path');

const [, , , outputDir] = process.argv;
if (!outputDir) {
  throw new Error('usage: node bundle-ai-processor-face-detection-assets.cjs <inputDir> <outputDir>');
}

// This script lives at apps/infrastructure/scripts/; @vladmandic/face-api and
// @tensorflow/tfjs-backend-wasm are declared dependencies of apps/backend, not
// apps/infrastructure -- pnpm's strict per-package node_modules means they resolve from
// apps/backend's own node_modules, not this script's. Resolve everything off that directory
// explicitly rather than via bare `require.resolve()` (which would resolve against THIS
// script's own location and fail).
const projectRoot = path.resolve(__dirname, '..', '..', '..');
const backendNodeModules = path.join(projectRoot, 'apps', 'backend', 'node_modules');

// tfjs-backend-wasm's own dist/tf-backend-wasm.node.js resolves its .wasm files via
// `scriptDirectory = __dirname + "/"` (verified by inspection) -- once esbuild inlines that
// code into the Lambda's bundled index.js, `__dirname` at runtime IS the Lambda's deployment
// root (LAMBDA_TASK_ROOT), which is exactly this outputDir. No setWasmPaths() call is needed as
// long as the .wasm files land directly alongside index.js, not nested under node_modules.
const wasmSrcDir = path.join(backendNodeModules, '@tensorflow', 'tfjs-backend-wasm', 'dist');
for (const file of fs.readdirSync(wasmSrcDir)) {
  if (file.endsWith('.wasm')) {
    fs.copyFileSync(path.join(wasmSrcDir, file), path.join(outputDir, file));
  }
}

// Only the SSD MobileNetV1 weights + manifest (not face-api's other 6 models, which this
// story's detection module never loads). detect-and-blur-faces.ts's resolveModelDir() reads
// LAMBDA_TASK_ROOT and looks for a `model/` directory sibling to index.js -- matching where
// this copies them to.
const faceApiModelDir = path.join(backendNodeModules, '@vladmandic', 'face-api', 'model');
const outModelDir = path.join(outputDir, 'model');
fs.mkdirSync(outModelDir, { recursive: true });
for (const file of ['ssd_mobilenetv1_model.bin', 'ssd_mobilenetv1_model-weights_manifest.json']) {
  fs.copyFileSync(path.join(faceApiModelDir, file), path.join(outModelDir, file));
}
