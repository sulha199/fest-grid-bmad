import test from 'node:test';
import assert from 'node:assert';
import {
  BRIGHTDATA_PROFILE_POLL_INTERVAL_MS,
  scrapeBrightDataProfile,
  setGetBrightDataProgress,
  setGetBrightDataSnapshot,
  setSleepForBrightDataProfile,
  getBrightDataProgress,
  getBrightDataSnapshot,
  type BrightDataProgressResponse,
} from './brightdata-client.js';

// The synchronous /datasets/v3/scrape call for one Instagram profile, and what follows when it answers 202.
// Shapes observed on 2026-10-31 against the live API for a public profile: HTTP 202 with {snapshot_id, message}
// after ~61 s, the snapshot `ready` ~80 s in, one record in the downloaded array.

const profileRecord = {
  account: 'infoeventjogja',
  id: '2986602957',
  full_name: 'Info Event Jogja',
  biography: 'Konser, Event, Pameran',
  followers: 69409,
  profile_image_link: 'https://example.invalid/p.jpg',
  url: 'https://www.instagram.com/infoeventjogja/',
};

type Reply = { status: number; body: unknown };

function mockFetch(replies: Reply[]) {
  const original = global.fetch;
  const requests: { url: string; init?: RequestInit }[] = [];
  (global as any).fetch = async (url: string, init?: RequestInit) => {
    requests.push({ url: String(url), init });
    const reply = replies.shift();
    if (!reply) throw new Error('unexpected extra fetch');
    return {
      ok: reply.status >= 200 && reply.status < 300,
      status: reply.status,
      statusText: '',
      json: async () => reply.body,
    } as any;
  };
  return { requests, restore: () => { global.fetch = original; } };
}

async function withEnv(fn: () => Promise<void>): Promise<void> {
  const saved = {
    token: process.env.BRIGHTDATA_API_TOKEN,
    dataset: process.env.BRIGHTDATA_PROFILE_DATASET_ID,
    confirmed: process.env.BRIGHTDATA_SCRAPING_CONFIRMED,
  };
  process.env.BRIGHTDATA_API_TOKEN = 'test-token';
  process.env.BRIGHTDATA_PROFILE_DATASET_ID = 'gd_profiles_test';
  delete process.env.BRIGHTDATA_SCRAPING_CONFIRMED;
  try {
    await fn();
  } finally {
    for (const [key, value] of [
      ['BRIGHTDATA_API_TOKEN', saved.token],
      ['BRIGHTDATA_PROFILE_DATASET_ID', saved.dataset],
      ['BRIGHTDATA_SCRAPING_CONFIRMED', saved.confirmed],
    ] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('scrapeBrightDataProfile', async (t) => {
  const originalProgress = getBrightDataProgress;
  const originalSnapshot = getBrightDataSnapshot;
  let sleeps: number[];
  let progressReplies: BrightDataProgressResponse[];
  let snapshotCalls: string[];
  let snapshotBody: unknown[];

  t.beforeEach(() => {
    sleeps = [];
    snapshotCalls = [];
    snapshotBody = [profileRecord];
    progressReplies = [];
    setSleepForBrightDataProfile(async (ms) => { sleeps.push(ms); });
    setGetBrightDataProgress(async () => progressReplies.shift() ?? { status: 'running' });
    setGetBrightDataSnapshot(async (id) => { snapshotCalls.push(id); return snapshotBody; });
  });

  t.after(() => {
    setGetBrightDataProgress(originalProgress);
    setGetBrightDataSnapshot(originalSnapshot);
  });

  await t.test('posts the profile url to the profiles dataset and returns the records of a synchronous answer', () =>
    withEnv(async () => {
      const fetchMock = mockFetch([{ status: 200, body: [profileRecord] }]);
      try {
        const result = await scrapeBrightDataProfile('https://www.instagram.com/infoeventjogja/', 100_000);

        assert.deepStrictEqual(result, { kind: 'records', records: [profileRecord] });
        const [request] = fetchMock.requests;
        const url = new URL(request.url);
        assert.strictEqual(url.pathname, '/datasets/v3/scrape');
        assert.strictEqual(url.searchParams.get('dataset_id'), 'gd_profiles_test');
        assert.strictEqual(url.searchParams.get('include_errors'), 'true');
        assert.deepStrictEqual(JSON.parse(String(request.init?.body)), [{ url: 'https://www.instagram.com/infoeventjogja/' }]);
        assert.strictEqual((request.init?.headers as Record<string, string>).Authorization, 'Bearer test-token');
      } finally {
        fetchMock.restore();
      }
    }));

  await t.test('a 202 is followed by polling the snapshot until it is ready, then downloading it', () =>
    withEnv(async () => {
      const fetchMock = mockFetch([{ status: 202, body: { snapshot_id: 'sd_pending', message: 'still in progress' } }]);
      progressReplies = [{ status: 'running' }, { status: 'running' }, { status: 'ready', records: 1 }];
      try {
        const result = await scrapeBrightDataProfile('https://www.instagram.com/infoeventjogja/', 200_000);

        assert.deepStrictEqual(result, { kind: 'records', records: [profileRecord] });
        assert.deepStrictEqual(snapshotCalls, ['sd_pending']);
        assert.deepStrictEqual(sleeps, [BRIGHTDATA_PROFILE_POLL_INTERVAL_MS, BRIGHTDATA_PROFILE_POLL_INTERVAL_MS]);
        assert.strictEqual(fetchMock.requests.length, 1, 'the scrape itself is sent once, never retried');
      } finally {
        fetchMock.restore();
      }
    }));

  await t.test('an error record (dead_page) is reported as no records, with the vendor\'s own code', () =>
    withEnv(async () => {
      const fetchMock = mockFetch([
        { status: 200, body: [{ input: { url: 'x' }, error: 'dead page (404)', error_code: 'dead_page' }] },
      ]);
      try {
        const result = await scrapeBrightDataProfile('https://www.instagram.com/ghost/', 100_000);

        assert.deepStrictEqual(result, { kind: 'no-records', errorCode: 'dead_page', errorMessage: 'dead page (404)' });
      } finally {
        fetchMock.restore();
      }
    }));

  await t.test('an empty array is no records, without an error code', () =>
    withEnv(async () => {
      const fetchMock = mockFetch([{ status: 200, body: [] }]);
      try {
        assert.deepStrictEqual(await scrapeBrightDataProfile('https://www.instagram.com/x/', 100_000), { kind: 'no-records' });
      } finally {
        fetchMock.restore();
      }
    }));

  await t.test('a snapshot the vendor reports as failed is no records', () =>
    withEnv(async () => {
      const fetchMock = mockFetch([{ status: 202, body: { snapshot_id: 'sd_failed' } }]);
      progressReplies = [{ status: 'failed', errorMessage: 'collector crashed' }];
      try {
        assert.deepStrictEqual(await scrapeBrightDataProfile('https://www.instagram.com/x/', 100_000), {
          kind: 'no-records',
          errorMessage: 'collector crashed',
        });
        assert.deepStrictEqual(snapshotCalls, []);
      } finally {
        fetchMock.restore();
      }
    }));

  await t.test('a snapshot still running when the budget runs out throws instead of waiting on', () =>
    withEnv(async () => {
      const fetchMock = mockFetch([{ status: 202, body: { snapshot_id: 'sd_slow' } }]);
      try {
        // budget 8 s, poll interval 5 s: one poll fits, the next would overrun.
        await assert.rejects(
          () => scrapeBrightDataProfile('https://www.instagram.com/x/', 8_000),
          /sd_slow was still running/
        );
        assert.deepStrictEqual(snapshotCalls, []);
      } finally {
        fetchMock.restore();
      }
    }));

  await t.test('an HTTP error from the scrape call is a BrightDataApiError and is not retried', () =>
    withEnv(async () => {
      const fetchMock = mockFetch([{ status: 401, body: {} }]);
      try {
        await assert.rejects(
          () => scrapeBrightDataProfile('https://www.instagram.com/x/', 100_000),
          (err: unknown) => (err as { statusCode?: number }).statusCode === 401
        );
        assert.strictEqual(fetchMock.requests.length, 1);
      } finally {
        fetchMock.restore();
      }
    }));
});
