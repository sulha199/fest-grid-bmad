import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { findPendingJobByToken, markPendingJobExpired } from '../lib/scraper/apify-pending-jobs-store.js';
import { processApifyAsyncResult } from '../lib/scraper/process-apify-async-result.js';
import { getApifyClient } from '../lib/scraper/instagram-adapter.js';
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

    // Fetch the run to get its status and dataset ID
    const client = getApifyClient();
    const run = await client.run(pendingJob.runId).get();

    if (!run) {
      console.warn(`Apify webhook: run ${pendingJob.runId} not found`);
      await recordActorRunResult({
        vendor: 'apify',
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
          vendor: 'apify',
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

      // Fetch dataset items
      const { items } = await client.dataset(run.defaultDatasetId).listItems({ clean: true, limit: 1000 });

      // Record successful audit trail
      await recordActorRunResult({
        vendor: 'apify',
        runId: pendingJob.runId,
        status: 'SUCCEEDED',
        rawOutput: items,
        itemCount: items.length,
      });

      // Process results
      await processApifyAsyncResult(pendingJob, items as any[]);
    } else {
      // Job failed/timed out/aborted - record failure and mark as expired
      const statusMap: Record<string, 'FAILED' | 'TIMED_OUT' | 'ABORTED'> = {
        'FAILED': 'FAILED',
        'TIMED_OUT': 'TIMED_OUT',
        'ABORTED': 'ABORTED',
      };

      const recordedStatus = statusMap[run.status] || 'FAILED';

      await recordActorRunResult({
        vendor: 'apify',
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
