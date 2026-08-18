import { handler } from '../../lambda/brightdata-webhook.lambda.js';
import { getPendingJobBySnapshotId, deleteBrightDataPendingJob } from './brightdata-pending-jobs-store.js';
import { recordProviderUsage } from './usage-store.js';
import { verifySupabaseJwt } from '../auth/verify-jwt.js';

jest.mock('./brightdata-pending-jobs-store.js');
jest.mock('./usage-store.js');
jest.mock('../auth/verify-jwt.js');

const mockGetPending = getPendingJobBySnapshotId as jest.Mock;
const mockDelete = deleteBrightDataPendingJob as jest.Mock;
const mockRecord = recordProviderUsage as jest.Mock;
const mockVerify = verifySupabaseJwt as jest.Mock;

describe('brightdata-webhook.lambda', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.BRIGHTDATA_WEBHOOK_SECRET = 'secret123';
  });

  it('rejects missing secret', async () => {
    const event = {
      headers: { authorization: 'Bearer token' },
      body: JSON.stringify({ snapshotId: 's1', status: 'COMPLETED', items: 10 }),
    } as any;
    const result = await handler(event);
    expect(result.statusCode).toBe(403);
  });

  it('rejects invalid JWT', async () => {
    const event = {
      headers: {
        authorization: 'Bearer token',
        'x-brightdata-secret': 'secret123',
      },
      body: JSON.stringify({ snapshotId: 's1', status: 'COMPLETED', items: 10 }),
    } as any;
    mockVerify.mockResolvedValue(null);
    const result = await handler(event);
    expect(result.statusCode).toBe(401);
  });

  it('processes successful webhook', async () => {
    const event = {
      headers: {
        authorization: 'Bearer token',
        'x-brightdata-secret': 'secret123',
      },
      body: JSON.stringify({ snapshotId: 's1', status: 'COMPLETED', items: 5 }),
    } as any;
    mockVerify.mockResolvedValue({ sub: 'user1' } as any);
    mockGetPending.mockResolvedValue({ id: 'job1' } as any);
    mockRecord.mockResolvedValue(undefined);
    mockDelete.mockResolvedValue(undefined);
    const result = await handler(event);
    expect(result.statusCode).toBe(200);
    expect(mockRecord).toHaveBeenCalledWith('brightdata', 5);
    expect(mockDelete).toHaveBeenCalledWith('job1');
  });
});
