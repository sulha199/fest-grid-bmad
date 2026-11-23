// Prod measurement logging for the AI-processor Lambda's memory (OOM investigation, 2026-11-23).
// One structured single-line `console.log` per call, prefixed `face-blur-mem`, so CloudWatch Logs
// Insights can find it with:
//   fields @timestamp, @message | filter @message like /face-blur-mem/
// No PII: only a stage name, an optional post id, image dimensions and process memory figures.
// Must never throw -- a logging failure may not fail a blur or an extraction.

const BYTES_PER_MB = 1024 * 1024;

export interface MemorySnapshot {
  rssMb: number;
  externalMb: number;
  /** Process high-water RSS (what Lambda reports as Max Memory Used), so a transient peak inside a stage still shows. */
  maxRssMb: number;
}

export function memorySnapshot(): MemorySnapshot {
  const usage = process.memoryUsage();
  return {
    rssMb: Math.round(usage.rss / BYTES_PER_MB),
    externalMb: Math.round(usage.external / BYTES_PER_MB),
    maxRssMb: Math.round(process.resourceUsage().maxRSS / 1024), // kilobytes on Linux
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
