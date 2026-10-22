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

    if (pendingJob.status !== 'PENDING') {
      console.warn(
        `Job ${pendingJob.id} is no longer pending (status: ${pendingJob.status})`
      );
      return { statusCode: 200, body: 'OK' };
    }

    const now = new Date();
    if (pendingJob.expiresAt < now) {
      console.warn(`Job ${pendingJob.id} has already expired`);
      return { statusCode: 200, body: 'OK' };
    }

    // Parse webhook payload
    let records: unknown[] = [];
    if (event.body) {
      const parsed: unknown = JSON.parse(event.body);
      records = Array.isArray(parsed) ? parsed : [];
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
