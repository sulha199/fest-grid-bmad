import { getApifyClient } from './instagram-adapter.js';
import { getBrightDataProgress, getBrightDataSnapshot } from './brightdata-client.js';

export interface VendorRunOutput {
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'TIMED_OUT' | 'ABORTED' | 'unknown';
  items: unknown[];
}

/**
 * Fetch the output of a completed Apify run by its run ID.
 * Extracted from stale-job-sweep.ts to avoid duplication when replaying runs.
 */
export async function fetchApifyRunOutput(runId: string): Promise<VendorRunOutput> {
  const client = getApifyClient();

  try {
    const run = await client.run(runId).get();

    if (run.status === 'SUCCEEDED') {
      const { items } = await client.dataset(run.defaultDatasetId).listItems({
        clean: true,
        limit: 1000,
      });
      return {
        status: 'SUCCEEDED',
        items: items as unknown[],
      };
    }

    // Map Apify status to our enum
    const statusMap: Record<string, VendorRunOutput['status']> = {
      SUCCEEDED: 'SUCCEEDED',
      FAILED: 'FAILED',
      TIMED_OUT: 'TIMED_OUT',
      ABORTED: 'ABORTED',
    };

    return {
      status: statusMap[run.status] || 'unknown',
      items: [],
    };
  } catch (err) {
    console.error(`Failed to fetch Apify run output for run ${runId}:`, err);
    throw err;
  }
}

/**
 * Fetch the output of a completed Bright Data run by its snapshot ID.
 * Extracted from stale-job-sweep.ts to avoid duplication when replaying runs.
 */
export async function fetchBrightDataRunOutput(snapshotId: string): Promise<VendorRunOutput> {
  try {
    const progress = await getBrightDataProgress(snapshotId);

    if (progress.status === 'ready') {
      const items = await getBrightDataSnapshot(snapshotId);
      return {
        status: 'SUCCEEDED',
        items: items,
      };
    }

    // Map Bright Data status to our enum
    const statusMap: Record<string, VendorRunOutput['status']> = {
      scheduled: 'PENDING',
      building: 'PENDING',
      running: 'PENDING',
      ready: 'SUCCEEDED',
      failed: 'FAILED',
    };

    return {
      status: statusMap[progress.status] || 'unknown',
      items: [],
    };
  } catch (err) {
    console.error(`Failed to fetch Bright Data run output for snapshot ${snapshotId}:`, err);
    throw err;
  }
}
