// Prunes face-api model weight files this story doesn't use from aiProcessorLambda's
// bundled asset (Story 0.46, AC3/AC6). Only the SSD MobileNetV1 weights Story 3.6n's
// detector actually loads are needed; `@vladmandic/face-api`'s `model/` directory ships
// 6 OTHER models (age/gender, face recognition, two landmark variants, expressions,
// tiny-face-detector) that this story's scope never touches.
//
// NOTE on what this script deliberately does NOT do: an earlier version of this script
// also deleted @tensorflow/tfjs's unused sibling packages (tfjs-layers, tfjs-converter,
// tfjs-backend-webgl, tfjs-backend-cpu, tfjs-data), which `bundling.nodeModules`
// installs as part of `@tensorflow/tfjs`'s full declared dependency tree. That is UNSAFE
// and was reverted: `@tensorflow/tfjs`'s own main entry (dist/tf.node.js) unconditionally
// `require()`s every one of those siblings at module-load time (confirmed by inspecting
// the installed package), and `@vladmandic/face-api`'s node-wasm entry itself
// `require("@tensorflow/tfjs")` (not just tfjs-core), so deleting any of those siblings
// breaks the Lambda with MODULE_NOT_FOUND the moment face-api is required. This is why
// AC6's measured bundle size (345 MB unzipped, over Lambda's 250 MB limit) could not be
// fixed by trimming alone -- see this story's Dev Notes for the resulting decision.
//
// NOT part of any Lambda handler or production control flow (AC7) -- a build-time
// asset-trimming step only, wired in via aiProcessorLambda's
// `bundling.commandHooks.afterBundling`, the same CDK mechanism `apiLambda` already uses
// for copy-graphql-schema.cjs.
const fs = require('fs');
const path = require('path');

const [, , , outputDir] = process.argv;
if (!outputDir) {
  throw new Error('usage: node prune-ai-processor-assets.cjs <inputDir> <outputDir>');
}

const modelDir = path.join(outputDir, 'node_modules', '@vladmandic', 'face-api', 'model');
if (fs.existsSync(modelDir)) {
  const keep = new Set(['ssd_mobilenetv1_model.bin', 'ssd_mobilenetv1_model-weights_manifest.json']);
  for (const file of fs.readdirSync(modelDir)) {
    if (!keep.has(file)) {
      fs.rmSync(path.join(modelDir, file), { force: true });
    }
  }
}
