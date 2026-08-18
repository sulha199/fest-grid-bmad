import { loadBackendEnv } from '../../env.js';

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
  });

  if (!response.ok) {
    throw new Error(
      `Failed to trigger Bright Data job: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as { snapshot_id?: string };

  if (!data.snapshot_id) {
    throw new Error('Bright Data response missing snapshot_id');
  }

  return { snapshotId: data.snapshot_id };
}

async function _getBrightDataProgress(
  snapshotId: string
): Promise<BrightDataProgressResponse> {
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
  });

  if (!response.ok) {
    throw new Error(
      `Failed to get Bright Data progress: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as { status?: string };

  return {
    status: (data.status || 'scheduled') as BrightDataProgressResponse['status'],
  };
}

async function _getBrightDataSnapshot(snapshotId: string): Promise<unknown[]> {
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
  });

  if (!response.ok) {
    throw new Error(
      `Failed to get Bright Data snapshot: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
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
