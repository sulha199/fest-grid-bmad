import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { findPendingJobByToken, markPendingJobExpired } from '../lib/scraper/apify-pending-jobs-store.js';
import { processApifyAsyncResult } from '../lib/scraper/process-apify-async-result.js';
import { getApifyClient } from '../lib/scraper/instagram-adapter.js';

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

    // Fetch the run to get dataset ID
    const client = getApifyClient();
    const run = await client.run(pendingJob.runId).get();

    if (!run || !run.defaultDatasetId) {
      console.warn(`Apify webhook: run ${pendingJob.runId} has no dataset`);
      await markPendingJobExpired(pendingJob.id);
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'No dataset available' }),
      };
    }

    // Fetch dataset items
    const { items } = await client.dataset(run.defaultDatasetId!).listItems({ clean: true, limit: 1000 });

    // Process results
    await processApifyAsyncResult(pendingJob, items as any[]);

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
