// Prod measurement logging for the AI-processor Lambda's memory (OOM investigation, 2026-11-23).
// One structured single-line `console.log` per call, prefixed `face-blur-mem`, so CloudWatch Logs
// Insights can find it with:
//   fields @timestamp, @message | filter @message like /face-blur-mem/
// No PII: only a stage name, an optional post id, image dimensions and process memory figures.
// Must never throw -- a logging failure may not fail a blur or an extraction.

import sharp from 'sharp';

const BYTES_PER_MB = 1024 * 1024;

export interface MemorySnapshot {
  rssMb: number;
  externalMb: number;
  /** Process high-water RSS (what Lambda reports as Max Memory Used), so a transient peak inside a stage still shows. */
  maxRssMb: number;
  /** V8 JS heap in use / reserved: if heapUsedMb tracks rssMb the growth is JS heap (e.g. base64 strings). */
  heapUsedMb: number;
  heapTotalMb: number;
  /** ArrayBuffers (Buffers, WASM heap); a subset of externalMb. */
  arrayBuffersMb: number;
  /** sharp/libvips own accounting; omitted when sharp cannot be queried. */
  sharpCacheMb?: number;
  sharpCacheItems?: number;
  sharpQueue?: number;
  sharpProcess?: number;
}

function sharpSnapshot(): Pick<MemorySnapshot, 'sharpCacheMb' | 'sharpCacheItems' | 'sharpQueue' | 'sharpProcess'> {
  try {
    const cache = sharp.cache();
    const counters = sharp.counters();
    return {
      sharpCacheMb: Math.round(cache.memory.current / BYTES_PER_MB), // sharp reports cache memory in MB already
      sharpCacheItems: Math.round(cache.items.current),
      sharpQueue: Math.round(counters.queue),
      sharpProcess: Math.round(counters.process),
    };
  } catch {
    return {}; // sharp unavailable: keep the process figures
  }
}

export function memorySnapshot(): MemorySnapshot {
  const usage = process.memoryUsage();
  return {
    rssMb: Math.round(usage.rss / BYTES_PER_MB),
    externalMb: Math.round(usage.external / BYTES_PER_MB),
    maxRssMb: Math.round(process.resourceUsage().maxRSS / 1024), // kilobytes on Linux
    heapUsedMb: Math.round(usage.heapUsed / BYTES_PER_MB),
    heapTotalMb: Math.round(usage.heapTotal / BYTES_PER_MB),
    arrayBuffersMb: Math.round(usage.arrayBuffers / BYTES_PER_MB),
    ...sharpSnapshot(),
  };
}

/** Logs `face-blur-mem {json}`. `fields` are merged after `stage`; rss/external are added here. Never throws. */
export function logFaceBlurMem(stage: string, fields: Record<string, string | number | null | undefined> = {}): void {
  try {
    console.log(`face-blur-mem ${JSON.stringify({ stage, ...fields, ...memorySnapshot() })}`);
  } catch {
    // Swallowed on purpose: measurement logging must never affect processing.
  }
}
