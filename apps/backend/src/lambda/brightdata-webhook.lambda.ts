// BrightData webhook Lambda
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { loadBackendEnv } from '../../env.js';
import { getPendingJobBySnapshotId, deleteBrightDataPendingJob } from '../lib/scraper/brightdata-pending-jobs-store.js';
import { recordProviderUsage } from '../lib/scraper/usage-store.js';
import { verifySupabaseJwt } from '../lib/auth/verify-jwt.js';
import { BrightDataError } from '../lib/errors/brightdata-error.js';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const env = loadBackendEnv();

    // JWT validation
    const authHeader = event.headers['authorization'] ?? event.headers['Authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      return { statusCode: 401, body: 'Missing Authorization Bearer token' };
    }
    const token = authHeader.slice('Bearer '.length).trim();
    const payload = await verifySupabaseJwt(token);
    if (!payload) {
      return { statusCode: 401, body: 'Invalid JWT token' };
    }

    const body = JSON.parse(event.body ?? '{}');
    const { snapshotId, status, items } = body;
    if (!snapshotId) {
      return { statusCode: 400, body: 'Missing snapshotId' };
    }

    const pending = await getPendingJobBySnapshotId(snapshotId);
    if (!pending) {
      return { statusCode: 404, body: 'Pending job not found' };
    }

    if (status === 'COMPLETED') {
      await recordProviderUsage('brightdata', items ?? 0);
    }

    await deleteBrightDataPendingJob(pending.id);

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('BrightData webhook error', err);
    if (err instanceof BrightDataError) {
      return { statusCode: 400, body: err.message };
    }
    // Publish to dead‑letter queue if configured
    try {
      const env = loadBackendEnv();
      if (env.brightdataWebhookDlqArn) {
        const sns = new SNSClient({});
        await sns.send(new PublishCommand({
          TopicArn: env.brightdataWebhookDlqArn,
          Message: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
        }));
      }
    } catch (pubErr) {
      console.error('Failed to publish to DLQ', pubErr);
    }
    return { statusCode: 500, body: 'Internal server error' };
  }
};
