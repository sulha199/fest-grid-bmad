// apps/backend/src/lib/scraper/__tests__/trigger-brightdata-for-target.test.ts
import { handler } from '../trigger-brightdata-for-target';
import * as pendingStore from '../brightdata-pending-jobs-store';
import * as brightdataClient from '../brightdata-client';
import * as usageStore from '../usage-store';
import { APIGatewayProxyEvent } from 'aws-lambda';

jest.mock('../brightdata-pending-jobs-store');
jest.mock('../brightdata-client');
jest.mock('../usage-store');

const mockEvent = {} as unknown as APIGatewayProxyEvent;

describe('trigger-brightdata-for-target handler', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (usageStore.recordProviderUsage as jest.Mock).mockResolvedValue(undefined);
    (pendingStore.createPendingJob as jest.Mock).mockResolvedValue({ id: 'job-1', webhookToken: 'token' });
    (brightdataClient.triggerBrightDataJob as jest.Mock).mockResolvedValue(undefined);
    (pendingStore.getBatchScrapeTargets as any) = jest.fn().mockResolvedValue([
      { accountId: 'acc1', profileId: 'prof1' },
    ]);
  });

  it('creates pending job and triggers BrightData', async () => {
    const result = await handler(mockEvent);
    expect(result.statusCode).toBe(200);
    expect(usageStore.recordProviderUsage).toHaveBeenCalledWith('brightdata', 0);
    expect(pendingStore.createPendingJob).toHaveBeenCalledWith({
      profileId: 'prof1',
      snapshotId: expect.stringContaining('acc1-'),
    });
    expect(brightdataClient.triggerBrightDataJob).toHaveBeenCalled();
  });
});
