import { test } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as esbuild from 'esbuild';
import { LAMBDA_IMAGE_PROCESSING_EXTERNAL_MODULES } from './festgrid-backend-stack.js';

// Regression test for the 2026-10-04 prod incident: apiLambda/scraperLambda crashed at cold
// start with `Could not load the "sharp" module using the linux-x64 runtime`. Root cause: a
// static import chain (resolvers.ts/process-scrape-job.ts -> enqueue-post-for-processing.ts ->
// process-ai-job.ts -> detect-and-blur-faces.ts/upload-face-blur-thumbnail.ts, and separately
// build-gemini-request.ts -> detect-and-blur-faces.ts) pulled sharp/@tensorflow/tfjs/
// @vladmandic/face-api into both Lambdas' module-load path, even though neither Lambda ships
// sharp's native binary (only aiProcessorLambda does, via `nodeModules: ['sharp']` in
// festgrid-backend-stack.ts). The fix cut exactly the two edges that are statically reachable
// from apiLambda/scraperLambda's own entries (`enqueue-post-for-processing.ts` ->
// `process-ai-job.js`, and `build-gemini-request.ts` -> `detect-and-blur-faces.js`) to
// `await import(...)`, AND marked these packages `externalModules` on apiLambda/scraperLambda's
// esbuild bundling -- both halves are required (see festgrid-backend-stack.ts's comment on
// LAMBDA_IMAGE_PROCESSING_EXTERNAL_MODULES for why dynamic import alone does not keep esbuild
// from inlining the dependency). `process-ai-job.ts`'s OWN internal imports of
// detect-and-blur-faces.ts/upload-face-blur-thumbnail.ts deliberately stay STATIC: that file is
// only ever reachable from apiLambda/scraperLambda behind the already-cut
// enqueue-post-for-processing.ts edge (confirmed below -- cutting one edge is enough to keep the
// whole subtree beneath it un-executed), and making them dynamic too would buy nothing there
// while regressing aiProcessorLambda (the Lambda that actually runs this code every invocation):
// it would shift sharp/tfjs/face-api's module-load cost from Lambda init to the first real
// invocation, and would turn a future bundling regression there from a loud cold-start crash
// into a silently-caught error. (Caught during this fix's own adversarial/edge-case review.)

// This package compiles to CommonJS (no `"type": "module"`), so `__dirname` is already
// available as a CJS global -- no import.meta/fileURLToPath needed (TS1470 if attempted).
// apps/infrastructure/lib -> apps/infrastructure -> apps -> project root
const projectRoot = path.resolve(__dirname, '../../..');
const backendSrc = path.resolve(projectRoot, 'apps/backend/src');

const IMAGE_PROCESSING_PATH_PATTERN =
  /node_modules[\\/](sharp|@vladmandic[\\/]face-api|@tensorflow[\\/]tfjs)/;

async function bundleInputs(entry: string, external: string[]): Promise<string[]> {
  const result = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    write: false,
    metafile: true,
    logLevel: 'silent',
    external,
  });
  return Object.keys(result.metafile.inputs);
}

test('apiLambda entry (lambdas/api.ts) never bundles sharp/face-api/tfjs', async () => {
  const inputs = await bundleInputs(
    path.resolve(backendSrc, 'lambdas/api.ts'),
    LAMBDA_IMAGE_PROCESSING_EXTERNAL_MODULES
  );
  const offenders = inputs.filter((p) => IMAGE_PROCESSING_PATH_PATTERN.test(p));
  assert.deepStrictEqual(
    offenders,
    [],
    `apiLambda's bundle must never reach sharp/@vladmandic/face-api/@tensorflow/tfjs, found: ${offenders.join(', ')}`
  );
});

test('scraperLambda entry (lambdas/scraper.ts) never bundles sharp/face-api/tfjs', async () => {
  const inputs = await bundleInputs(
    path.resolve(backendSrc, 'lambdas/scraper.ts'),
    LAMBDA_IMAGE_PROCESSING_EXTERNAL_MODULES
  );
  const offenders = inputs.filter((p) => IMAGE_PROCESSING_PATH_PATTERN.test(p));
  assert.deepStrictEqual(
    offenders,
    [],
    `scraperLambda's bundle must never reach sharp/@vladmandic/face-api/@tensorflow/tfjs, found: ${offenders.join(', ')}`
  );
});

test('aiProcessorLambda entry (lambdas/ai-processor.ts) still DOES reach face-api/tfjs (sanity: proves the above isn\'t a false pass)', async () => {
  // No externalModules override here, deliberately -- aiProcessorLambda's real bundling config
  // (festgrid-backend-stack.ts) only externalizes `sharp` (via `nodeModules`, for its native
  // binary); face-api/tfjs are left to esbuild's default bundling. Building with zero externals
  // is a superset of that and is sufficient to prove reachability.
  const inputs = await bundleInputs(path.resolve(backendSrc, 'lambdas/ai-processor.ts'), []);
  const hasFaceApi = inputs.some((p) => p.includes('@vladmandic/face-api'));
  const hasTfjs = inputs.some((p) => p.includes('@tensorflow/tfjs'));
  const hasSharp = inputs.some((p) => /node_modules[\\/]sharp[\\/]/.test(p));
  assert.ok(hasFaceApi, 'expected aiProcessorLambda bundle to reach @vladmandic/face-api');
  assert.ok(hasTfjs, 'expected aiProcessorLambda bundle to reach @tensorflow/tfjs');
  assert.ok(hasSharp, 'expected aiProcessorLambda bundle to reach sharp');
});

// Complementary guard: the esbuild-metafile checks above pass purely because the three
// packages are marked `external` -- that normalizes a static top-level import and a dynamic
// `await import(...)` identically in the metafile (confirmed directly while building this fix).
// This second check catches a regression the metafile test alone cannot: someone reverting
// either of these two dynamic imports back to a static top-level import, which would still
// crash apiLambda/scraperLambda at runtime (`Cannot find module 'sharp'`) even with
// externalModules still in place, since a static import always executes at module load
// regardless of bundling.
const EDITED_FILES: { file: string; specifier: string }[] = [
  { file: 'lib/posts/enqueue-post-for-processing.ts', specifier: '../ai-processor/process-ai-job.js' },
  { file: 'lib/ai-processor/build-gemini-request.ts', specifier: './detect-and-blur-faces.js' },
];

test('enqueue-post-for-processing.ts / build-gemini-request.ts import their lazy module dynamically, not statically', () => {
  for (const { file, specifier } of EDITED_FILES) {
    const source = fs.readFileSync(path.resolve(backendSrc, file), 'utf8');
    const escapedSpecifier = specifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const staticImportPattern = new RegExp(`^import[^;]*from\\s+['"]${escapedSpecifier}['"]`, 'm');
    const dynamicImportPattern = new RegExp(`import\\(\\s*['"]${escapedSpecifier}['"]\\s*\\)`);
    assert.ok(
      !staticImportPattern.test(source),
      `${file} must not statically import '${specifier}' (would re-crash apiLambda/scraperLambda at cold start)`
    );
    assert.ok(
      dynamicImportPattern.test(source),
      `${file} must dynamically import '${specifier}' via await import(...)`
    );
  }
});

test('process-ai-job.ts keeps its own detect-and-blur-faces.js/upload-face-blur-thumbnail.js imports STATIC (by design -- see this file\'s top comment)', () => {
  const file = path.resolve(backendSrc, 'lib/ai-processor/process-ai-job.ts');
  const source = fs.readFileSync(file, 'utf8');
  for (const specifier of ['./detect-and-blur-faces.js', './upload-face-blur-thumbnail.js']) {
    const escapedSpecifier = specifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const staticImportPattern = new RegExp(`^import[^;]*from\\s+['"]${escapedSpecifier}['"]`, 'm');
    assert.ok(
      staticImportPattern.test(source),
      `process-ai-job.ts should statically import '${specifier}' -- making it dynamic buys nothing for ` +
        `apiLambda/scraperLambda (already unreachable behind enqueue-post-for-processing.ts's own dynamic ` +
        `import) but would regress aiProcessorLambda's module-load timing and error visibility`
    );
  }
});

test('apiLambda entry still reaches process-ai-job.ts/detect-and-blur-faces.ts as inert bundled code (sanity: proves cutting one edge is sufficient, not just a coincidence of this test\'s external list)', async () => {
  const inputs = await bundleInputs(
    path.resolve(backendSrc, 'lambdas/api.ts'),
    LAMBDA_IMAGE_PROCESSING_EXTERNAL_MODULES
  );
  const hasProcessAiJob = inputs.some((p) => p.includes('process-ai-job.ts'));
  const hasDetectAndBlur = inputs.some((p) => p.includes('detect-and-blur-faces.ts'));
  assert.ok(
    hasProcessAiJob && hasDetectAndBlur,
    'expected process-ai-job.ts and detect-and-blur-faces.ts to still be present as inert bundled ' +
      'code (reachable only via the dynamic import target, never executed in prod) -- their absence ' +
      'would mean the dynamic-import edge itself broke rather than just deferring execution'
  );
});
