import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from 'aws-lambda';
import { findPendingJobByToken } from '../lib/scraper/brightdata-pending-jobs-store.js';
import { processBrightDataResult } from '../lib/scraper/process-brightdata-result.js';
import { recordActorRunResult } from '../lib/scraper/record-actor-run.js';
import { classifyBrightDataRun, describeBrightDataVendorFailure } from '../lib/scraper/classify-brightdata-run.js';
import { handleBrightDataFailedRun } from '../lib/scraper/handle-brightdata-failed-run.js';
import { reportBrightDataYield } from '../lib/scraper/run-yield-store.js';

export const handler = async (
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> => {
  console.log('Webhook received:', JSON.stringify(event, null, 2));

  try {
    const jobToken = event.queryStringParameters?.jobToken;

    if (!jobToken) {
      console.warn('Missing jobToken parameter');
      return { statusCode: 400, body: 'Missing jobToken' };
    }

    // Find matching pending job
    const pendingJob = await findPendingJobByToken(jobToken);

    if (!pendingJob) {
      console.warn(`No pending job found for token: ${jobToken}`);
      return { statusCode: 200, body: 'OK' }; // Don't retry
    }

    // COMPLETED means this delivery (or the sweep) already processed the snapshot: a duplicate.
    if (pendingJob.status === 'COMPLETED') {
      console.warn(`Job ${pendingJob.id} is already completed`);
      return { statusCode: 200, body: 'OK' };
    }

    // Parse webhook payload
    let records: unknown[] = [];
    if (event.body) {
      const parsed: unknown = JSON.parse(event.body);
      records = Array.isArray(parsed) ? parsed : [];
    }

    // A snapshot can finish long after the job's expiry: on 2026-10-29 Bright Data delivered 21 snapshots
    // 5-6 hours late, the sweep had already marked them EXPIRED and this handler dropped their ~190 records.
    // Results that arrive for an expired job are still real posts, so they are processed (the persist step
    // de-duplicates against the SQS fallback the expiry queued). An expired job with no records carries
    // nothing to process and was already recorded as failed by the sweep.
    const isLate = pendingJob.status === 'EXPIRED' || pendingJob.expiresAt < new Date();
    if (pendingJob.status === 'EXPIRED' && records.length === 0) {
      console.warn(`Job ${pendingJob.id} already expired and the delivery has no records`);
      return { statusCode: 200, body: 'OK' };
    }
    if (isLate) {
      console.warn(`Job ${pendingJob.id} delivered after its expiry (${pendingJob.expiresAt.toISOString()}); processing ${records.length} records`);
    }

    // A snapshot with no records is not necessarily a good run (BUG-074): tell an account with
    // nothing new from a vendor that returned nothing for everyone, and never store the latter as a
    // success. The classification is a free progress lookup, made only when records is empty.
    const { resultClass, progress } = await classifyBrightDataRun(pendingJob.snapshotId, records.length);

    if (resultClass === 'vendor_failure') {
      const reason = describeBrightDataVendorFailure(progress);
      console.error(`Bright Data vendor failure for snapshot ${pendingJob.snapshotId}: ${reason}`);
      await handleBrightDataFailedRun(pendingJob, {
        status: 'FAILED',
        rawOutput: records,
        itemCount: 0,
        errorMessage: reason,
      });
      return {
        statusCode: 200,
        body: JSON.stringify({ status: 'vendor_failure' }),
      };
    }

    // Record audit trail
    await recordActorRunResult({
      vendor: 'BRIGHTDATA',
      runId: pendingJob.snapshotId,
      status: 'SUCCEEDED',
      rawOutput: records,
      itemCount: records.length,
    });

    // Process results with the audit run ID
    await processBrightDataResult(pendingJob, records, pendingJob.scraperActorRunId ?? undefined);

    // What Bright Data itself reported for the snapshot (records, errors, error codes), after the posts are stored
    // so a slow or failed lookup costs nothing but the columns.
    await reportBrightDataYield(pendingJob.snapshotId, records.length, progress);

    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'processed' }),
    };
  } catch (error) {
    console.error('Error processing webhook:', error);
    return {
      statusCode: 200, // Still return 200 to prevent Bright Data retries
      body: 'OK',
    };
  }
};
