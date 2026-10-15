import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { findPendingJobByToken, markPendingJobExpired } from '../lib/scraper/apify-pending-jobs-store.js';
import { processApifyAsyncResult } from '../lib/scraper/process-apify-async-result.js';
import { callApifyClient } from '../lib/scraper/instagram-adapter.js';
import { recordActorRunResult } from '../lib/scraper/record-actor-run.js';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Extract jobToken from query parameters
    const jobToken = event.queryStringParameters?.jobToken;

    if (!jobToken) {
      console.warn('Apify webhook received without jobToken query parameter');
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing jobToken parameter' }),
      };
    }

    // Find pending job by token
    const pendingJob = await findPendingJobByToken(jobToken);

    if (!pendingJob) {
      console.warn(`Apify webhook: no pending job found for token ${jobToken.substring(0, 8)}...`);
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Job not found' }),
      };
    }

    // Check if job is still pending and not expired
    if (pendingJob.status !== 'PENDING') {
      console.warn(`Apify webhook: job ${pendingJob.id} is already ${pendingJob.status}`);
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Job already processed' }),
      };
    }

    if (new Date() > pendingJob.expiresAt) {
      console.warn(`Apify webhook: job ${pendingJob.id} has expired`);
      await markPendingJobExpired(pendingJob.id);
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Job expired' }),
      };
    }

    // Fetch the run to get its status and dataset ID, routed through the shared guarded
    // wrapper (AD-32). timeoutMs: 20_000, maxAttempts: 1: this Lambda's CDK timeout is the
    // shared default 30s -- a 20s guarded call leaves ~10s margin for the subsequent
    // recordActorRunResult/processApifyAsyncResult/SQS-enqueue work; a second 20s attempt
    // could not fit. This handler's existing outer catch already returns HTTP 200
    // "not retrying" on any error (including a VendorDpaNotConfirmedError/VendorCallTimeoutError)
    // -- acceptable, no new branch needed here.
    const { run, items } = await callApifyClient({ timeoutMs: 20_000, maxAttempts: 1 }, async (client) => {
      const runResult = await client.run(pendingJob.runId).get();
      if (!runResult || runResult.status !== 'SUCCEEDED' || !runResult.defaultDatasetId) {
        return { run: runResult, items: [] as unknown[] };
      }
      const { items: datasetItems } = await client.dataset(runResult.defaultDatasetId).listItems({ clean: true, limit: 1000 });
      return { run: runResult, items: datasetItems };
    });

    if (!run) {
      console.warn(`Apify webhook: run ${pendingJob.runId} not found`);
      await recordActorRunResult({
        vendor: 'APIFY',
        runId: pendingJob.runId,
        status: 'FAILED',
        errorMessage: 'Run not found when processing webhook',
      });
      await markPendingJobExpired(pendingJob.id);
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Run not found' }),
      };
    }

    // Branch on run status: only process dataset for successful runs
    if (run.status === 'SUCCEEDED') {
      if (!run.defaultDatasetId) {
        console.warn(`Apify webhook: successful run ${pendingJob.runId} has no dataset`);
        await recordActorRunResult({
          vendor: 'APIFY',
          runId: pendingJob.runId,
          status: 'SUCCEEDED',
          rawOutput: [],
          itemCount: 0,
          errorMessage: 'No dataset available despite successful run',
        });
        await markPendingJobExpired(pendingJob.id);
        return {
          statusCode: 200,
          body: JSON.stringify({ message: 'No dataset available' }),
        };
      }

      // dataset items already fetched inside the guarded callApifyClient thunk above
      // Record successful audit trail
      await recordActorRunResult({
        vendor: 'APIFY',
        runId: pendingJob.runId,
        status: 'SUCCEEDED',
        rawOutput: items,
        itemCount: items.length,
      });

      // Process results with the audit run ID
      await processApifyAsyncResult(pendingJob, items as any[], pendingJob.scraperActorRunId ?? undefined);
    } else {
      // Job failed/timed out/aborted - record failure and mark as expired
      const statusMap: Record<string, 'FAILED' | 'TIMED_OUT' | 'ABORTED'> = {
        'FAILED': 'FAILED',
        'TIMED_OUT': 'TIMED_OUT',
        'ABORTED': 'ABORTED',
      };

      const recordedStatus = statusMap[run.status] || 'FAILED';

      await recordActorRunResult({
        vendor: 'APIFY',
        runId: pendingJob.runId,
        status: recordedStatus,
        errorMessage: `Run status: ${run.status}`,
      });

      await markPendingJobExpired(pendingJob.id);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Success' }),
    };
  } catch (error) {
    console.error('Error processing Apify webhook:', error);
    // Return 200 to avoid Apify retrying; errors are logged
    return {
      statusCode: 200,
      body: JSON.stringify({ error: 'Processing failed but not retrying' }),
    };
  }
};
