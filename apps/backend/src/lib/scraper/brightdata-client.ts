import { loadBackendEnv } from '../../env.js';
import { callVendor } from '../vendor-gateway/guarded-call.js';

// Story 0.i2d (AD-32 Rule 4) — mirrors apify's isApifyErrorTransient/Gemini's
// isGeminiErrorTransient exact shape: a 5xx BrightDataApiError, or a network-level error code
// on the error itself or its `cause` (the shape fetch's own TypeError('fetch failed') exposes),
// is transient. Never a default-transient fallback.
export class BrightDataApiError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'BrightDataApiError';
    this.statusCode = statusCode;
  }
}

const TRANSIENT_CONNECTION_CODES = new Set(['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EAI_AGAIN']);

export function isBrightDataErrorTransient(error: unknown): boolean {
  if (error instanceof BrightDataApiError) {
    return error.statusCode >= 500 && error.statusCode <= 599;
  }

  const code = (error as any)?.code ?? (error as any)?.cause?.code;
  if (typeof code === 'string' && TRANSIENT_CONNECTION_CODES.has(code)) {
    return true;
  }

  return false;
}

export interface BrightDataTriggerInput {
  url: string;
  numOfPosts: number;
  startDate: string; // MM-DD-YYYY format
}

export interface BrightDataTriggerResponse {
  snapshotId: string;
}

export interface BrightDataProgressResponse {
  status: 'scheduled' | 'building' | 'running' | 'ready' | 'failed';
  // Reported once a snapshot has finished. A zero-record snapshot is told apart as an empty account
  // (`error_codes.dead_page`) or a vendor failure (neither) from these (BUG-074,
  // classifyBrightDataResult in @festgrid/domain). Only present when Bright Data sent them.
  records?: number;
  errors?: number;
  errorCodes?: Record<string, number>;
  errorMessage?: string;
}

// Test seams for mocking in tests
let triggerBrightDataJobFn = _triggerBrightDataJob;
let getBrightDataProgressFn = _getBrightDataProgress;
let getBrightDataSnapshotFn = _getBrightDataSnapshot;
let scrapeBrightDataProfileFn = _scrapeBrightDataProfile;

export function setTriggerBrightDataJob(fn: typeof _triggerBrightDataJob) {
  triggerBrightDataJobFn = fn;
}

export function setGetBrightDataProgress(fn: typeof _getBrightDataProgress) {
  getBrightDataProgressFn = fn;
}

export function setGetBrightDataSnapshot(fn: typeof _getBrightDataSnapshot) {
  getBrightDataSnapshotFn = fn;
}

export function setScrapeBrightDataProfile(fn: typeof _scrapeBrightDataProfile) {
  scrapeBrightDataProfileFn = fn;
}

async function _triggerBrightDataJob(
  input: BrightDataTriggerInput,
  webhookUrl: string
): Promise<BrightDataTriggerResponse> {
  return callVendor('brightdata', {
    timeoutMs: 20_000,
    // maxAttempts: 1 -- the trigger POST creates a billed snapshot and is not idempotent:
    // retrying after a lost response could create a second job nobody tracks.
    maxAttempts: 1,
    isTransient: isBrightDataErrorTransient,
    call: async (signal) => {
      const env = loadBackendEnv();

      if (!env.brightdataApiToken) {
        throw new Error('BRIGHTDATA_API_TOKEN is not set');
      }

      if (!env.brightdataDatasetId) {
        throw new Error('BRIGHTDATA_DATASET_ID is not set');
      }

      const url = new URL('https://api.brightdata.com/datasets/v3/trigger');
      url.searchParams.set('dataset_id', env.brightdataDatasetId);
      url.searchParams.set('type', 'discover_new');
      url.searchParams.set('discover_by', 'url');
      url.searchParams.set('endpoint', webhookUrl);
      url.searchParams.set('format', 'json');

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.brightdataApiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: [
            {
              url: input.url,
              num_of_posts: input.numOfPosts,
              start_date: input.startDate,
            },
          ],
        }),
        signal,
      });

      if (!response.ok) {
        throw new BrightDataApiError(
          `Failed to trigger Bright Data job: ${response.status} ${response.statusText}`,
          response.status
        );
      }

      const data = (await response.json()) as { snapshot_id?: string };

      if (!data.snapshot_id) {
        throw new Error('Bright Data response missing snapshot_id');
      }

      return { snapshotId: data.snapshot_id };
    },
  });
}

// `error_codes` is a map of error code to count (`{"dead_page":1}`). Anything else -- an array, a
// string, a map with non-numeric values -- is not that, and is left out rather than read as one.
function parseErrorCodes(value: unknown): Record<string, number> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const entries = Object.entries(value).filter(([, count]) => typeof count === 'number');
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

async function _getBrightDataProgress(
  snapshotId: string
): Promise<BrightDataProgressResponse> {
  return callVendor('brightdata', {
    timeoutMs: 15_000,
    isTransient: isBrightDataErrorTransient,
    call: async (signal) => {
      const env = loadBackendEnv();

      if (!env.brightdataApiToken) {
        throw new Error('BRIGHTDATA_API_TOKEN is not set');
      }

      const url = new URL(
        `https://api.brightdata.com/datasets/v3/progress/${snapshotId}`
      );

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${env.brightdataApiToken}`,
        },
        signal,
      });

      if (!response.ok) {
        throw new BrightDataApiError(
          `Failed to get Bright Data progress: ${response.status} ${response.statusText}`,
          response.status
        );
      }

      const data = (await response.json()) as {
        status?: string;
        records?: number;
        errors?: number;
        error_codes?: Record<string, number>;
        error_message?: string;
      };

      return {
        status: (data.status || 'scheduled') as BrightDataProgressResponse['status'],
        ...(typeof data.records === 'number' && { records: data.records }),
        ...(typeof data.errors === 'number' && { errors: data.errors }),
        ...(parseErrorCodes(data.error_codes) && { errorCodes: parseErrorCodes(data.error_codes) }),
        ...(typeof data.error_message === 'string' && { errorMessage: data.error_message }),
      };
    },
  });
}

async function _getBrightDataSnapshot(snapshotId: string): Promise<unknown[]> {
  return callVendor('brightdata', {
    timeoutMs: 30_000,
    isTransient: isBrightDataErrorTransient,
    call: async (signal) => {
      const env = loadBackendEnv();

      if (!env.brightdataApiToken) {
        throw new Error('BRIGHTDATA_API_TOKEN is not set');
      }

      const url = new URL(
        `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}`
      );
      url.searchParams.set('format', 'json');

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${env.brightdataApiToken}`,
        },
        signal,
      });

      if (!response.ok) {
        throw new BrightDataApiError(
          `Failed to get Bright Data snapshot: ${response.status} ${response.statusText}`,
          response.status
        );
      }

      return response.json();
    },
  });
}

// How often a profile snapshot that outlived the synchronous call is polled.
export const BRIGHTDATA_PROFILE_POLL_INTERVAL_MS = 5_000;
// Bright Data's synchronous scrape answers 202 after ~60 s when the collection is still running.
const BRIGHTDATA_SYNC_SCRAPE_WAIT_MS = 65_000;

export type BrightDataProfileScrape =
  | { kind: 'records'; records: unknown[] }
  // The collection ended without a profile record for the input (an error record such as `dead_page`, or none at
  // all). `errorCode` is Bright Data's own code when it sent one.
  | { kind: 'no-records'; errorCode?: string; errorMessage?: string };

let sleepForBrightDataProfile: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function setSleepForBrightDataProfile(fn: typeof sleepForBrightDataProfile) {
  sleepForBrightDataProfile = fn;
}

function isErrorRecord(record: unknown): record is { error_code?: unknown; error?: unknown } {
  return !!record && typeof record === 'object' && 'error_code' in record;
}

function splitProfileRecords(records: unknown[]): BrightDataProfileScrape {
  const good = records.filter((record) => !isErrorRecord(record));
  if (good.length > 0) {
    return { kind: 'records', records: good };
  }
  const failed = records.find(isErrorRecord);
  return {
    kind: 'no-records',
    ...(typeof failed?.error_code === 'string' && { errorCode: failed.error_code }),
    ...(typeof failed?.error === 'string' && { errorMessage: failed.error }),
  };
}

/**
 * One Instagram profile through Bright Data's Instagram Profiles dataset (`brightdataProfileDatasetId`).
 *
 * Starts with the synchronous `/datasets/v3/scrape`, which answers in the same call when the collection finishes
 * within ~60 s. Observed 2026-10-31 it did not (HTTP 202 + `snapshot_id` at 61 s, ready at ~80 s), so the common
 * path is then to poll `/progress` and download the `/snapshot` until `budgetMs` runs out. The scrape is billed
 * and not idempotent, so it is never retried. Throws when the budget runs out first (the snapshot keeps running
 * at the vendor).
 */
async function _scrapeBrightDataProfile(profileUrl: string, budgetMs: number): Promise<BrightDataProfileScrape> {
  const startedAt = Date.now();
  const elapsed = () => Date.now() - startedAt;

  type SyncOutcome = { kind: 'done'; records: unknown[] } | { kind: 'pending'; snapshotId: string };
  const sync = await callVendor<SyncOutcome>('brightdata', {
    timeoutMs: Math.min(budgetMs, BRIGHTDATA_SYNC_SCRAPE_WAIT_MS),
    maxAttempts: 1,
    isTransient: isBrightDataErrorTransient,
    call: async (signal) => {
      const env = loadBackendEnv();
      if (!env.brightdataApiToken) {
        throw new Error('BRIGHTDATA_API_TOKEN is not set');
      }
      if (!env.brightdataProfileDatasetId) {
        throw new Error('BRIGHTDATA_PROFILE_DATASET_ID is not set');
      }
      const url = new URL('https://api.brightdata.com/datasets/v3/scrape');
      url.searchParams.set('dataset_id', env.brightdataProfileDatasetId);
      url.searchParams.set('format', 'json');
      url.searchParams.set('include_errors', 'true');

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.brightdataApiToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify([{ url: profileUrl }]),
        signal,
      });

      if (response.status === 202) {
        const data = (await response.json()) as { snapshot_id?: string };
        if (!data.snapshot_id) {
          throw new Error('Bright Data profile scrape returned 202 without a snapshot_id');
        }
        return { kind: 'pending', snapshotId: data.snapshot_id };
      }
      if (!response.ok) {
        throw new BrightDataApiError(
          `Failed to scrape Bright Data profile: ${response.status} ${response.statusText}`,
          response.status
        );
      }
      const data = await response.json();
      return { kind: 'done', records: Array.isArray(data) ? data : [] };
    },
  });

  if (sync.kind === 'done') {
    return splitProfileRecords(sync.records);
  }

  // Past the synchronous wait: poll the snapshot while there is budget left for another poll.
  for (;;) {
    const progress = await getBrightDataProgressFn(sync.snapshotId);
    if (progress.status === 'ready') {
      return splitProfileRecords(await getBrightDataSnapshotFn(sync.snapshotId));
    }
    if (progress.status === 'failed') {
      return { kind: 'no-records', errorMessage: progress.errorMessage ?? 'Bright Data reported the snapshot as failed' };
    }
    if (elapsed() + BRIGHTDATA_PROFILE_POLL_INTERVAL_MS >= budgetMs) {
      throw new Error(
        `Bright Data profile snapshot ${sync.snapshotId} was still ${progress.status} after ${elapsed()}ms (budget ${budgetMs}ms)`
      );
    }
    await sleepForBrightDataProfile(BRIGHTDATA_PROFILE_POLL_INTERVAL_MS);
  }
}

export async function scrapeBrightDataProfile(profileUrl: string, budgetMs: number): Promise<BrightDataProfileScrape> {
  return scrapeBrightDataProfileFn(profileUrl, budgetMs);
}

export async function triggerBrightDataJob(
  input: BrightDataTriggerInput,
  webhookUrl: string
): Promise<BrightDataTriggerResponse> {
  return triggerBrightDataJobFn(input, webhookUrl);
}

export async function getBrightDataProgress(
  snapshotId: string
): Promise<BrightDataProgressResponse> {
  return getBrightDataProgressFn(snapshotId);
}

export async function getBrightDataSnapshot(snapshotId: string): Promise<unknown[]> {
  return getBrightDataSnapshotFn(snapshotId);
}

export function mapBrightDataDateToStartDate(newerThan: string): string {
  const date = new Date(newerThan);
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${month}-${day}-${year}`;
}
