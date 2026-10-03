#!/usr/bin/env node
/*
 * One-off LOCAL measurement harness for Story 0.46 (AC1, AC4, AC5).
 *
 * This script is NOT part of the production Lambda handler
 * (`src/lambdas/ai-processor.ts`) or `process-ai-job.ts`'s control flow, and is
 * never invoked by them (AC7). It exists purely to produce the measured numbers
 * this story's Dev Notes record: peak process memory and per-image detection
 * latency for the WASM-backed face-api SSD MobileNetV1 detector plus a sharp
 * Gaussian-blur + resize pass, run locally with Node 22 (the same major runtime
 * as the deployed Lambda, modulo OS/CPU architecture -- this script's own output
 * says exactly which).
 *
 * Fixtures: this story generates its own synthetic JPEG fixtures in-process
 * (see makeFixture below) rather than using a real photograph, because no real
 * photo fixture is committed at this story's scope (Story 3.6n owns the real
 * extraction fixtures used for its own grouping/accuracy tests). This is a valid
 * substitute for what THIS story needs to measure (peak memory + latency, not
 * detection accuracy): SSD MobileNetV1 always resizes its input to a fixed
 * network input size before inference, and sharp's blur/resize cost is a
 * function of pixel dimensions, not pixel content -- so compute cost and memory
 * footprint do not depend on whether a real face is present in the pixels.
 *
 * Usage: node apps/backend/scripts/measure-ai-processor-runtime.cjs
 */

const os = require('os');
const path = require('path');
const sharp = require('sharp');
const tf = require('@tensorflow/tfjs');
// Dedicated Node+WASM entry (AC4): requires only @tensorflow/tfjs and
// @tensorflow/tfjs-backend-wasm, never the native @tensorflow/tfjs-node addon
// pulled in by the package's default `main` field (dist/face-api.node.js).
// Verified by static inspection of the installed package: zero occurrences of
// "tfjs-node" in dist/face-api.node-wasm.js.
require('@tensorflow/tfjs-backend-wasm');
const faceapi = require('@vladmandic/face-api/dist/face-api.node-wasm.js');

const MODEL_DIR = path.join(
  path.dirname(require.resolve('@vladmandic/face-api/package.json')),
  'model'
);

function peakTracker() {
  let peak = 0;
  const sample = () => {
    const rss = process.memoryUsage().rss;
    if (rss > peak) peak = rss;
  };
  const timer = setInterval(sample, 20);
  sample();
  return {
    stop() {
      clearInterval(timer);
      sample();
      return peak;
    },
  };
}

async function makeFixture(width, height, label) {
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="${width}" height="${height}" fill="rgb(60,120,180)"/>
    <circle cx="${width / 2}" cy="${height / 2}" r="${Math.min(width, height) / 4}" fill="rgb(220,200,180)"/>
    <rect x="${width * 0.1}" y="${height * 0.1}" width="${width * 0.2}" height="${height * 0.2}" fill="rgb(250,250,100)"/>
  </svg>`;
  const buf = await sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer();
  console.log(`[fixture] ${label}: ${width}x${height} -> ${(buf.length / 1024).toFixed(1)} KB JPEG`);
  return buf;
}

async function detectOnce(jpegBuffer) {
  const { data, info } = await sharp(jpegBuffer)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const tensor = tf.tensor3d(new Uint8Array(data), [info.height, info.width, info.channels]);
  try {
    const t0 = Date.now();
    const detections = await faceapi.detectAllFaces(tensor, new faceapi.SsdMobilenetv1Options());
    return { ms: Date.now() - t0, count: detections.length };
  } finally {
    tensor.dispose();
  }
}

async function run() {
  await tf.setBackend('wasm');
  await tf.ready();
  console.log(`tfjs backend: ${tf.getBackend()}`);

  const memBeforeLoad = process.memoryUsage().rss;
  const tLoad0 = Date.now();
  await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODEL_DIR);
  const modelLoadMs = Date.now() - tLoad0;
  const memAfterLoad = process.memoryUsage().rss;

  const fixtures = [
    { label: 'typical ~1080px', width: 1080, height: 1080 },
    { label: 'large worst-case', width: 4000, height: 3000 },
  ];

  const results = [];
  for (const f of fixtures) {
    const jpegBuffer = await makeFixture(f.width, f.height, f.label);

    const tracker = peakTracker();
    const tStageStart = Date.now();

    const cold = await detectOnce(jpegBuffer);
    const warm = await detectOnce(jpegBuffer); // steady-state call, backend already warmed up

    const tBlurStart = Date.now();
    await sharp(jpegBuffer).blur(15).resize(480, 480, { fit: 'cover' }).jpeg({ quality: 82 }).toBuffer();
    const blurResizeMs = Date.now() - tBlurStart;

    const totalMs = Date.now() - tStageStart;
    const peakRss = tracker.stop();

    results.push({ label: f.label, cold, warm, blurResizeMs, totalMs, peakRss });
  }

  console.log('\n=== Story 0.46 measurement results ===');
  console.log(`Node: ${process.version}, platform: ${process.platform}/${process.arch}, CPUs: ${os.cpus().length}`);
  console.log(`Model load (cold, SSD MobileNetV1 from disk): ${modelLoadMs} ms`);
  console.log(
    `RSS before load: ${(memBeforeLoad / 1024 / 1024).toFixed(1)} MB, after load: ${(memAfterLoad / 1024 / 1024).toFixed(1)} MB`
  );
  for (const r of results) {
    console.log(
      `[${r.label}] cold detect: ${r.cold.ms} ms (faces=${r.cold.count}), warm detect: ${r.warm.ms} ms, ` +
        `blur+resize: ${r.blurResizeMs} ms, stage total: ${r.totalMs} ms, peak RSS during stage: ${(r.peakRss / 1024 / 1024).toFixed(1)} MB`
    );
  }
  const overallPeak = Math.max(memAfterLoad, ...results.map((r) => r.peakRss));
  console.log(`\nOverall peak RSS (model load + both fixtures): ${(overallPeak / 1024 / 1024).toFixed(1)} MB`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
