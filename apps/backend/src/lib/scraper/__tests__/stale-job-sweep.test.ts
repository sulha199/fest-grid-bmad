// apps/backend/src/lib/scraper/__tests__/stale-job-sweep.test.ts
import { handler } from '../stale-job-sweep';
import * as pendingStore from '../brightdata-pending-jobs-store';
import { APIGatewayProxyEvent } from 'aws-lambda';

jest.mock('../brightdata-pending-jobs-store');

const mockEvent = {} as unknown as APIGatewayProxyEvent;

describe('stale-job-sweep handler', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (pendingStore.findExpiredPendingJobs as jest.Mock).mockResolvedValue([
      { id: 'job-1', webhookToken: 't1' } as any,
      { id: 'job-2', webhookToken: 't2' } as any,
    ]);
    (pendingStore.deleteBrightDataPendingJob as jest.Mock).mockResolvedValue(undefined);
  });

  it('deletes all expired jobs and returns count', async () => {
    const result = await handler(mockEvent);
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.cleaned).toBe(2);
    expect(pendingStore.deleteBrightDataPendingJob).toHaveBeenCalledTimes(2);
  });
});
