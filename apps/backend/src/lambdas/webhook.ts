import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from 'aws-lambda';
import { findPendingJobByToken, markPendingJobCompleted } from '../lib/scraper/brightdata-pending-jobs-store.js';
import { processBrightDataResult } from '../lib/scraper/process-brightdata-result.js';
import { recordActorRunResult } from '../lib/scraper/record-actor-run.js';

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
      records = JSON.parse(event.body);
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
