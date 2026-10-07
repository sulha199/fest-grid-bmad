import test from 'node:test';
import * as assert from 'node:assert';
import { eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { manualExtractionJobs, users } from '@festgrid/database';
import type { ManualExtractionRequestPayload, ProcessingJobMessage } from '@festgrid/domain/posts';
import {
  processManualExtractionJob,
  setCallGeminiForManualExtractionSeam,
  callGeminiForManualExtractionSeam,
} from './process-manual-extraction-job.js';
import { AiGatewayExhaustedError, AiGatewayBusyError } from '../ai-gateway/adapter.js';
import { setDetectAndBlurFacesSeam, detectAndBlurFacesSeam } from './detect-and-blur-faces.js';

// Story 4.2b -- real-DB tests (local Postgres, seeded user) for the AI-Lambda half of the manual
// "AI-Assisted Correction" extraction. Gemini and the face-blur primitive are seams.

const GOOD_PAYLOAD = {
  isEvent: true,
  events: [
    {
      eventName: 'Manual Extraction Event',
      types: ['PERFORMANCE'],
      categories: ['MUSIC'],
      schedules: [{ isMainSchedule: true, eventStartDate: '2026-10-25', title: 'Day 1' }],
      confidenceScore: 0.9,
    },
  ],
};

function baseMessage(overrides: Partial<ProcessingJobMessage> = {}): ProcessingJobMessage {
  return {
    postId: '00000000-0000-4000-8000-000000000001',
    accountId: '',
    content: 'Manual extraction caption',
    postUrl: 'https://www.instagram.com/p/manual-4-2b/',
    publishedAt: '2026-08-29T10:24:17Z',
    ...overrides,
  };
}

test('processManualExtractionJob (Story 4.2b)', async (t) => {
  const originalGemini = callGeminiForManualExtractionSeam;
  const originalDetect = detectAndBlurFacesSeam;
  const originalFetch = globalThis.fetch;
  const originalBlur = process.env.BLUR_FACES_BEFORE_AI;

  const [user] = await db.select().from(users).limit(1);
  assert.ok(user, 'Must have at least one seeded user');
  const createdJobIds: string[] = [];

  async function insertJob(payload: ManualExtractionRequestPayload): Promise<string> {
    const [row] = await db
      .insert(manualExtractionJobs)
      .values({ requestedByUserId: user.id, sourceUrl: payload.message.postUrl, requestPayload: payload })
      .returning();
    createdJobIds.push(row.id);
    return row.id;
  }
  async function readJob(id: string) {
    const [row] = await db.select().from(manualExtractionJobs).where(eq(manualExtractionJobs.id, id));
    return row;
  }

  t.beforeEach(() => {
    process.env.BLUR_FACES_BEFORE_AI = 'true';
    setCallGeminiForManualExtractionSeam(async () => ({ text: JSON.stringify(GOOD_PAYLOAD) }) as any);
    setDetectAndBlurFacesSeam(detectAndBlurFacesSeam);
    globalThis.fetch = originalFetch;
  });

  t.after(async () => {
    setCallGeminiForManualExtractionSeam(originalGemini);
    setDetectAndBlurFacesSeam(originalDetect);
    globalThis.fetch = originalFetch;
    if (originalBlur === undefined) delete process.env.BLUR_FACES_BEFORE_AI;
    else process.env.BLUR_FACES_BEFORE_AI = originalBlur;
    for (const id of createdJobIds) {
      await db.delete(manualExtractionJobs).where(eq(manualExtractionJobs.id, id));
    }
  });

  function mockImageFetch() {
    globalThis.fetch = (async () => ({
      ok: true,
      headers: { get: (n: string) => (n.toLowerCase() === 'content-type' ? 'image/jpeg' : null) },
      arrayBuffer: async () => Buffer.from('original-cover-bytes'),
    })) as any;
  }

  await t.test('success: PENDING -> SUCCEEDED with the mapped first event as resultData', async () => {
    const id = await insertJob({ message: baseMessage() });
    await processManualExtractionJob(id);
    const row = await readJob(id);
    assert.strictEqual(row.status, 'SUCCEEDED');
    assert.strictEqual((row.resultData as any).eventName, 'Manual Extraction Event');
    assert.strictEqual(row.errorCode, null);
    assert.ok(row.completedAt);
  });

  await t.test('blur: mode on -> the cover is blurred before Gemini, with no opt-in path (AC5)', async () => {
    mockImageFetch();
    let detectCalls = 0;
    setDetectAndBlurFacesSeam(async () => {
      detectCalls++;
      return { buffer: Buffer.from('blurred-cover-bytes'), faceCount: 1 };
    });
    let sentInline: string | undefined;
    setCallGeminiForManualExtractionSeam(async (req: any) => {
      sentInline = req.contents[1]?.inlineData?.data;
      return { text: JSON.stringify(GOOD_PAYLOAD) } as any;
    });
    const id = await insertJob({ message: baseMessage({ imageUrl: 'https://test.com/cover.jpg' }) });
    await processManualExtractionJob(id);
    assert.strictEqual((await readJob(id)).status, 'SUCCEEDED');
    assert.strictEqual(detectCalls, 1);
    assert.strictEqual(sentInline, Buffer.from('blurred-cover-bytes').toString('base64'));
  });

  await t.test('blur: BLUR_FACES_BEFORE_AI=false -> original bytes, detection never called', async () => {
    process.env.BLUR_FACES_BEFORE_AI = 'false';
    mockImageFetch();
    let detectCalls = 0;
    setDetectAndBlurFacesSeam(async () => {
      detectCalls++;
      return { buffer: Buffer.from('x'), faceCount: 0 };
    });
    let sentInline: string | undefined;
    setCallGeminiForManualExtractionSeam(async (req: any) => {
      sentInline = req.contents[1]?.inlineData?.data;
      return { text: JSON.stringify(GOOD_PAYLOAD) } as any;
    });
    const id = await insertJob({ message: baseMessage({ imageUrl: 'https://test.com/cover.jpg' }) });
    await processManualExtractionJob(id);
    assert.strictEqual(detectCalls, 0);
    assert.strictEqual(sentInline, Buffer.from('original-cover-bytes').toString('base64'));
  });

  await t.test('blur fail-closed: a throwing blur sends text-only, never the original (AC5)', async () => {
    mockImageFetch();
    setDetectAndBlurFacesSeam(async () => {
      throw new Error('blur exploded');
    });
    let contents: any;
    setCallGeminiForManualExtractionSeam(async (req: any) => {
      contents = req.contents;
      return { text: JSON.stringify(GOOD_PAYLOAD) } as any;
    });
    const id = await insertJob({ message: baseMessage({ imageUrl: 'https://test.com/cover.jpg' }) });
    await processManualExtractionJob(id);
    assert.strictEqual((await readJob(id)).status, 'SUCCEEDED');
    assert.strictEqual(typeof contents, 'string');
  });

  await t.test('claim: a second invocation for the same job is a no-op (no second Gemini call)', async () => {
    let calls = 0;
    setCallGeminiForManualExtractionSeam(async () => {
      calls++;
      return { text: JSON.stringify(GOOD_PAYLOAD) } as any;
    });
    const id = await insertJob({ message: baseMessage() });
    await Promise.all([processManualExtractionJob(id), processManualExtractionJob(id)]);
    assert.strictEqual(calls, 1);
    assert.strictEqual((await readJob(id)).status, 'SUCCEEDED');
  });

  await t.test('unknown job id: resolves without throwing', async () => {
    await processManualExtractionJob('00000000-0000-4000-8000-0000000000ff');
  });

  await t.test('QUOTA_EXHAUSTED: new-post branch (no fallback account) fails after one attempt', async () => {
    let calls = 0;
    setCallGeminiForManualExtractionSeam(async () => {
      calls++;
      throw new AiGatewayExhaustedError('none');
    });
    const id = await insertJob({ message: baseMessage() });
    await processManualExtractionJob(id);
    const row = await readJob(id);
    assert.strictEqual(row.status, 'FAILED');
    assert.strictEqual(row.errorCode, 'QUOTA_EXHAUSTED');
    assert.strictEqual(calls, 1);
  });

  await t.test('TIER_2: existing-post branch retries with the account subscribers and can succeed', async () => {
    let calls = 0;
    setCallGeminiForManualExtractionSeam(async () => {
      calls++;
      if (calls === 1) throw new AiGatewayExhaustedError('tier1 empty');
      return { text: JSON.stringify(GOOD_PAYLOAD) } as any;
    });
    const id = await insertJob({
      message: baseMessage(),
      existingPostAccountId: '00000000-0000-4000-8000-0000000000aa',
    });
    await processManualExtractionJob(id);
    assert.strictEqual(calls, 2);
    assert.strictEqual((await readJob(id)).status, 'SUCCEEDED');
  });

  await t.test('PR #57 review: temporary key contention is NOT reported as QUOTA_EXHAUSTED', async () => {
    let calls = 0;
    setCallGeminiForManualExtractionSeam(async () => {
      calls++;
      throw new AiGatewayBusyError('all keys busy');
    });
    const id = await insertJob({ message: baseMessage() });
    await processManualExtractionJob(id);
    const row = await readJob(id);
    assert.strictEqual(row.status, 'FAILED');
    assert.notStrictEqual(row.errorCode, 'QUOTA_EXHAUSTED');
    assert.strictEqual(row.errorCode, 'EXTRACTION_FAILED');
    assert.match(String(row.errorMessage), /temporarily busy/i);
    assert.strictEqual(calls, 1, 'no fallback attempt on the shared tier for a busy outcome on the first tier of a new post');
  });

  await t.test('PR #57 review: busy on the TIER_2 fallback is also reported truthfully', async () => {
    let calls = 0;
    setCallGeminiForManualExtractionSeam(async () => {
      calls++;
      if (calls === 1) throw new AiGatewayExhaustedError('tier1 empty');
      throw new AiGatewayBusyError('tier2 keys busy');
    });
    const id = await insertJob({
      message: baseMessage(),
      existingPostAccountId: '00000000-0000-4000-8000-0000000000aa',
    });
    await processManualExtractionJob(id);
    const row = await readJob(id);
    assert.strictEqual(row.errorCode, 'EXTRACTION_FAILED');
    assert.match(String(row.errorMessage), /temporarily busy/i);
  });

  await t.test('TIER_2 exhausted too -> QUOTA_EXHAUSTED', async () => {
    setCallGeminiForManualExtractionSeam(async () => {
      throw new AiGatewayExhaustedError('none');
    });
    const id = await insertJob({
      message: baseMessage(),
      existingPostAccountId: '00000000-0000-4000-8000-0000000000aa',
    });
    await processManualExtractionJob(id);
    assert.strictEqual((await readJob(id)).errorCode, 'QUOTA_EXHAUSTED');
  });

  await t.test('unparseable / invalid / non-event responses -> EXTRACTION_FAILED', async () => {
    for (const text of ['not json', JSON.stringify({ nope: true }), JSON.stringify({ isEvent: false, events: [] })]) {
      setCallGeminiForManualExtractionSeam(async () => ({ text }) as any);
      const id = await insertJob({ message: baseMessage() });
      await processManualExtractionJob(id);
      const row = await readJob(id);
      assert.strictEqual(row.status, 'FAILED', text);
      assert.strictEqual(row.errorCode, 'EXTRACTION_FAILED', text);
    }
  });

  await t.test('unexpected throw is recorded as FAILED/EXTRACTION_FAILED, never left PROCESSING', async () => {
    setCallGeminiForManualExtractionSeam(async () => {
      throw new Error('boom');
    });
    const id = await insertJob({ message: baseMessage() });
    await processManualExtractionJob(id);
    const row = await readJob(id);
    assert.strictEqual(row.status, 'FAILED');
    assert.strictEqual(row.errorCode, 'EXTRACTION_FAILED');
  });
});
