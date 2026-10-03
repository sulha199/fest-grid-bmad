// Story 0.46 (AC2/AC3/AC4/AC6): aiProcessorLambda's bundling.commandHooks.afterBundling
// step. Produces the non-JS/non-reachable assets the deployed Lambda package ships for
// Story 3.6n to use later, WITHOUT making esbuild's primary bundling of
// `ai-processor.ts` (the real, unchanged handler entry, AC7) reach any of this code:
//
//   1. Bundles `ai-processor-face-detection-probe.cjs` (sharp + face-api + tfjs +
//      tfjs-backend-wasm, real unmodified packages) via a SEPARATE esbuild invocation
//      into `<outputDir>/face-detection-runtime.js`. This is the fix for AC6's package-
//      size finding: `bundling.nodeModules`-installing these packages measured ~321 MB
//      unzipped (over Lambda's 250 MB limit) because the installed package trees carry
//      many unused pre-built variants + multi-MB sourcemaps; esbuild only resolves and
//      inlines the actually-reachable code from this probe's own `require()` calls.
//   2. Copies tfjs-backend-wasm's `.wasm` binaries into the SAME output directory as
//      the bundled file above (not nested under node_modules) -- its own `dist/tf-
//      backend-wasm.node.js` resolves them via `scriptDirectory = __dirname + "/"`
//      (verified by inspection), so once bundled, `__dirname` for
//      face-detection-runtime.js IS the Lambda's deployment root, matching exactly.
//   3. Copies only the SSD MobileNetV1 weights + manifest (not face-api's other 6
//      models, which this story's AC3 scope never uses) into `<outputDir>/model/`.
//
// `sharp` itself is NOT bundled here -- it stays in `bundling.nodeModules` (its native
// .node binary can't be inlined by esbuild at all), installed as a real file tree by
// CDK's own nodeModules mechanism, which this script leaves alone.
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const [, , , outputDir] = process.argv;
if (!outputDir) {
  throw new Error('usage: node bundle-ai-processor-face-detection-assets.cjs <inputDir> <outputDir>');
}

// This script lives at apps/infrastructure/scripts/; the probe module and its
// dependencies (sharp, @vladmandic/face-api, @tensorflow/tfjs, @tensorflow/tfjs-
// backend-wasm) are declared dependencies of apps/backend, not apps/infrastructure --
// pnpm's strict per-package node_modules means they resolve from apps/backend's own
// node_modules, not this script's. Resolve everything off that directory explicitly
// rather than via bare `require.resolve()` (which would resolve against THIS script's
// own location and fail).
const projectRoot = path.resolve(__dirname, '..', '..', '..');
const backendDir = path.join(projectRoot, 'apps', 'backend');
const backendNodeModules = path.join(backendDir, 'node_modules');

const probeEntry = path.join(backendDir, 'scripts', 'ai-processor-face-detection-probe.cjs');

esbuild.buildSync({
  entryPoints: [probeEntry],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  minify: true,
  external: ['sharp', '@tensorflow/tfjs-node'],
  outfile: path.join(outputDir, 'face-detection-runtime.js'),
  logLevel: 'warning',
  // Resolve the probe's `require()` calls (sharp, @tensorflow/tfjs, ...) against
  // apps/backend's own node_modules, matching how the probe resolves them when run
  // directly (unbundled) too.
  absWorkingDir: backendDir,
});

const wasmSrcDir = path.join(backendNodeModules, '@tensorflow', 'tfjs-backend-wasm', 'dist');
for (const file of fs.readdirSync(wasmSrcDir)) {
  if (file.endsWith('.wasm')) {
    fs.copyFileSync(path.join(wasmSrcDir, file), path.join(outputDir, file));
  }
}

const faceApiModelDir = path.join(backendNodeModules, '@vladmandic', 'face-api', 'model');
const outModelDir = path.join(outputDir, 'model');
fs.mkdirSync(outModelDir, { recursive: true });
for (const file of ['ssd_mobilenetv1_model.bin', 'ssd_mobilenetv1_model-weights_manifest.json']) {
  fs.copyFileSync(path.join(faceApiModelDir, file), path.join(outModelDir, file));
}
