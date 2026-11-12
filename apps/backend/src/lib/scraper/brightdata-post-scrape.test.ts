import test from 'node:test';
import assert from 'node:assert';
import {
  BRIGHTDATA_PROFILE_POLL_INTERVAL_MS,
  scrapeBrightDataPost,
  setGetBrightDataProgress,
  setGetBrightDataSnapshot,
  setSleepForBrightDataProfile,
  getBrightDataProgress,
  getBrightDataSnapshot,
  BrightDataSnapshotPendingError,
  type BrightDataProgressResponse,
} from './brightdata-client.js';

// Story 10.2 AC3: the synchronous /datasets/v3/scrape call for ONE POST goes to the posts dataset (BRIGHTDATA_DATASET_ID, not
// the profiles dataset), then polls the snapshot inside the budget, never retried. No vendor is called: fetch is replaced.

const postRecord = { url: 'https://www.instagram.com/p/AAA/', description: 'caption', photos: ['https://cdn.example/1.jpg'], date_posted: '2026-11-11T00:00:00.000Z' };

type Reply = { status: number; body: unknown };

function mockFetch(replies: Reply[]) {
  const original = global.fetch;
  const requests: { url: string; init?: RequestInit }[] = [];
  (global as any).fetch = async (url: string, init?: RequestInit) => {
    requests.push({ url: String(url), init });
    const reply = replies.shift();
    if (!reply) throw new Error('unexpected extra fetch');
    return { ok: reply.status >= 200 && reply.status < 300, status: reply.status, statusText: '', json: async () => reply.body } as any;
  };
  return { requests, restore: () => { global.fetch = original; } };
}

async function withEnv(fn: () => Promise<void>): Promise<void> {
  const saved = { token: process.env.BRIGHTDATA_API_TOKEN, posts: process.env.BRIGHTDATA_DATASET_ID, profiles: process.env.BRIGHTDATA_PROFILE_DATASET_ID };
  process.env.BRIGHTDATA_API_TOKEN = 'test-token';
  process.env.BRIGHTDATA_DATASET_ID = 'gd_posts_test';
  process.env.BRIGHTDATA_PROFILE_DATASET_ID = 'gd_profiles_test';
  try {
    await fn();
  } finally {
    for (const [key, value] of [['BRIGHTDATA_API_TOKEN', saved.token], ['BRIGHTDATA_DATASET_ID', saved.posts], ['BRIGHTDATA_PROFILE_DATASET_ID', saved.profiles]] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('scrapeBrightDataPost', async (t) => {
  const originalProgress = getBrightDataProgress;
  const originalSnapshot = getBrightDataSnapshot;
  let sleeps: number[];
  let progressReplies: BrightDataProgressResponse[];

  t.beforeEach(() => {
    sleeps = [];
    progressReplies = [];
    setSleepForBrightDataProfile(async (ms) => { sleeps.push(ms); });
    setGetBrightDataProgress(async () => progressReplies.shift() ?? { status: 'running' });
    setGetBrightDataSnapshot(async () => [postRecord]);
  });

  t.after(() => {
    setGetBrightDataProgress(originalProgress);
    setGetBrightDataSnapshot(originalSnapshot);
  });

  await t.test('posts the post url to the POSTS dataset, not the profiles dataset, and returns a synchronous answer', () =>
    withEnv(async () => {
      const fetchMock = mockFetch([{ status: 200, body: [postRecord] }]);
      try {
        const result = await scrapeBrightDataPost('https://www.instagram.com/p/AAA/', 100_000);
        assert.deepStrictEqual(result, { kind: 'records', records: [postRecord] });
        const [request] = fetchMock.requests;
        const url = new URL(request.url);
        assert.strictEqual(url.pathname, '/datasets/v3/scrape');
        assert.strictEqual(url.searchParams.get('dataset_id'), 'gd_posts_test');
        assert.deepStrictEqual(JSON.parse(String(request.init?.body)), [{ url: 'https://www.instagram.com/p/AAA/' }]);
      } finally {
        fetchMock.restore();
      }
    }));

  await t.test('a 202 is followed by polling the snapshot until ready, then downloading it; the scrape is sent once', () =>
    withEnv(async () => {
      progressReplies = [{ status: 'running' }, { status: 'ready' }];
      const fetchMock = mockFetch([{ status: 202, body: { snapshot_id: 's_post_1' } }]);
      try {
        const result = await scrapeBrightDataPost('https://www.instagram.com/p/AAA/', 200_000);
        assert.deepStrictEqual(result, { kind: 'records', records: [postRecord] });
        assert.strictEqual(fetchMock.requests.length, 1, 'billed and not idempotent: never retried');
        assert.deepStrictEqual(sleeps, [BRIGHTDATA_PROFILE_POLL_INTERVAL_MS]);
      } finally {
        fetchMock.restore();
      }
    }));

  await t.test('an error record (dead_page) comes back as no-records with its code, so the adapter can tell gone from unavailable', () =>
    withEnv(async () => {
      const fetchMock = mockFetch([{ status: 200, body: [{ url: 'https://www.instagram.com/p/GONE/', error: 'Page not found', error_code: 'dead_page' }] }]);
      try {
        const result = await scrapeBrightDataPost('https://www.instagram.com/p/GONE/', 100_000);
        assert.deepStrictEqual(result, { kind: 'no-records', errorCode: 'dead_page', errorMessage: 'Page not found' });
      } finally {
        fetchMock.restore();
      }
    }));

  await t.test('a budget that runs out while the snapshot is still running throws (the snapshot keeps running at the vendor)', () =>
    withEnv(async () => {
      const fetchMock = mockFetch([{ status: 202, body: { snapshot_id: 's_post_2' } }]);
      try {
        await assert.rejects(
          () => scrapeBrightDataPost('https://www.instagram.com/p/AAA/', 8_000),
          (e: unknown) => {
            // Story 10.5: the snapshot id travels with the error so a job can link it; the wording still reads as a timeout
            assert.ok(e instanceof BrightDataSnapshotPendingError);
            assert.strictEqual(e.snapshotId, 's_post_2');
            assert.match(e.message, /was still running/);
            assert.strictEqual(e.message.includes('instagram.com'), false, 'plain words: no URL');
            return true;
          }
        );
      } finally {
        fetchMock.restore();
      }
    }));
});
