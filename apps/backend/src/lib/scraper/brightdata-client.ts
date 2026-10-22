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

export function setTriggerBrightDataJob(fn: typeof _triggerBrightDataJob) {
  triggerBrightDataJobFn = fn;
}

export function setGetBrightDataProgress(fn: typeof _getBrightDataProgress) {
  getBrightDataProgressFn = fn;
}

export function setGetBrightDataSnapshot(fn: typeof _getBrightDataSnapshot) {
  getBrightDataSnapshotFn = fn;
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
        ...(data.error_codes && typeof data.error_codes === 'object' && { errorCodes: data.error_codes }),
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
