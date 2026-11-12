import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { EventCategory } from '@festgrid/shared-types';
import { startReviewServer, type RunningReview } from './review-server.js';
import { DirectoryStorage } from './storage.js';
import { buildFakeBucket, DRAFT_IDS, tempDir } from './review-test-support.js';
import { layoutOf } from './work-dir.js';

/** Parsed JSON from the server, left untyped on purpose: the tests assert on its shape. */
type Json = ReturnType<typeof JSON.parse>;

describe('review server (synthetic drafts, fake bucket, real HTTP on 127.0.0.1)', () => {
  const bucket = buildFakeBucket();
  const layout = layoutOf(tempDir('review-server-work'));
  const storage = new DirectoryStorage(bucket);
  let review: RunningReview;
  let base: string;
  let origin: string;

  before(async () => {
    await storage.downloadDrafts(layout.drafts);
    review = await startReviewServer({ layout, storage, categories: Object.values(EventCategory), token: 'tok123', now: () => new Date('2026-01-02T03:04:05.000Z') });
    base = review.url;
    origin = new URL(base).origin;
  });
  after(() => review.close());

  const call = async (method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<{ status: number; json: Json; res: Response }> => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.clone().text();
    let json: Json = {};
    try {
      json = JSON.parse(text);
    } catch {
      // not JSON (the page, an image)
    }
    return { status: res.status, json, res };
  };
  const post = async (id: string): Promise<Json> => (await call('GET', `api/post/${id}`)).json;

  test('the url is on 127.0.0.1 and starts with the secret token', () => {
    assert.match(base, /^http:\/\/127\.0\.0\.1:\d+\/tok123\/$/);
  });

  test('the page is served with a strict content security policy and no store; the script is allowed by hash, nothing external', async () => {
    const { status, res } = await call('GET', '');
    assert.equal(status, 200);
    const csp = res.headers.get('content-security-policy')!;
    assert.match(csp, /default-src 'none'/);
    assert.match(csp, /script-src 'sha256-/);
    assert.doesNotMatch(csp, /unsafe-inline|http/);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.match(await res.text(), /<title>Draft label review<\/title>/);
  });

  test('requests without the token, with the wrong token, or with an unexpected host are refused', async () => {
    assert.equal((await fetch(`${origin}/`)).status, 404);
    assert.equal((await fetch(`${origin}/wrong/api/drafts`)).status, 404);
    const status = await new Promise<number>((resolve, reject) => {
      const u = new URL(base);
      const req = request({ host: u.hostname, port: u.port, path: `${u.pathname}api/drafts`, headers: { host: 'evil.example' } }, (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      });
      req.on('error', reject);
      req.end();
    });
    assert.equal(status, 403);
  });

  test('writes refuse a foreign Origin and a body that is not JSON', async () => {
    const foreign = await call('POST', `api/post/${DRAFT_IDS.single}/status`, { status: 'skipped' }, { origin: 'http://evil.example' });
    assert.equal(foreign.status, 403);
    const sameOrigin = await call('POST', `api/post/${DRAFT_IDS.single}/status`, { status: 'pending' }, { origin });
    assert.equal(sameOrigin.status, 200);
    const wrongType = await fetch(`${base}api/post/${DRAFT_IDS.single}/status`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' });
    assert.equal(wrongType.status, 415);
    const badJson = await fetch(`${base}api/post/${DRAFT_IDS.single}/status`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{ nope' });
    assert.equal(badJson.status, 400);
    const huge = await fetch(`${base}api/post/${DRAFT_IDS.single}/status`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ note: 'x'.repeat(1_100_000) }) }).catch(() => undefined);
    assert.ok(huge === undefined || huge.status === 413);
  });

  test('config and list', async () => {
    const config = (await call('GET', 'api/config')).json;
    assert.match(config.storage, /local directory/);
    assert.deepEqual(config.groupingReasons, ['single-event', 'program-lineup', 'dependent-stages', 'separate-events', 'roundup']);
    assert.ok(config.categories.includes('MUSIC'));
    assert.ok(config.flagHelp.possible_miss);

    const list = (await call('GET', 'api/drafts')).json;
    assert.deepEqual(list.summary, { pending: 3, verified: 0, skipped: 0, flagged: 0 });
    const byId = Object.fromEntries(list.posts.map((p: Json) => [p.postId, p]));
    assert.equal(byId[DRAFT_IDS.single].stratum, 'single-event');
    assert.deepEqual(byId[DRAFT_IDS.multi].flags.map((f: Json) => f.flag).sort(), ['before_cursor_path', 'chain']);
    assert.deepEqual(byId[DRAFT_IDS.notEvent].flags.map((f: Json) => f.flag), ['possible_miss']);
    assert.equal(byId[DRAFT_IDS.notEvent].imageCount, 7);
    assert.deepEqual(list.unreadable, []);
  });

  test('a post: the draft label, its images, provenance and the next pending post; bad ids and unknown posts are refused', async () => {
    const data = await post(DRAFT_IDS.single);
    assert.equal(data.label.postId, DRAFT_IDS.single);
    assert.equal(data.label.groupingReason, 'single-event');
    assert.equal(data.images.length, 2);
    assert.equal(data.meta.stratum, 'single-event');
    assert.equal(data.status, 'pending');
    assert.equal(data.edited, false);
    assert.equal(data.next, DRAFT_IDS.multi);
    assert.equal((await call('GET', 'api/post/p-nothere')).status, 404);
    assert.equal((await call('GET', 'api/post/a%20b')).status, 400);
    assert.equal((await call('GET', 'api/post/%E0%A4%A')).status, 400);
    assert.equal((await call('GET', 'api/nothing')).status, 404);
    assert.equal((await call('DELETE', `api/drafts`)).status, 404);
  });

  test('images are served only if the draft names them, with the right type; nothing else can be read', async () => {
    const data = await post(DRAFT_IDS.single);
    const ok = await call('GET', `img/${DRAFT_IDS.single}/${data.images[0]}`);
    assert.equal(ok.status, 200);
    assert.equal(ok.res.headers.get('content-type'), 'image/png');
    assert.equal((await call('GET', `img/${DRAFT_IDS.single}/label.json`)).status, 404);
    assert.equal((await call('GET', `img/${DRAFT_IDS.single}/draft.json`)).status, 404);
    assert.equal((await call('GET', `img/${DRAFT_IDS.single}/..%2Flabel.json`)).status, 404);
    assert.equal((await call('GET', `img/p-nothere/cover.png`)).status, 404);
    assert.equal((await call('GET', `img/${DRAFT_IDS.single}`)).status, 404);
  });

  test('saving an edit keeps it on disk, returns the new flags, and reset goes back to the draft', async () => {
    const data = await post(DRAFT_IDS.single);
    const edited = { ...data.label, events: [{ ...data.label.events[0], eventName: 'Edited name' }] };
    const saved = await call('PUT', `api/post/${DRAFT_IDS.single}/edit`, { label: edited });
    assert.equal(saved.status, 200);
    assert.deepEqual(saved.json.flags, []);
    const again = await post(DRAFT_IDS.single);
    assert.equal(again.edited, true);
    assert.equal(again.label.events[0].eventName, 'Edited name');
    assert.equal((await call('PUT', `api/post/${DRAFT_IDS.single}/edit`, { nothing: true })).status, 400);
    assert.equal((await call('PUT', `api/post/${DRAFT_IDS.single}/edit`, [1])).status, 400);

    // the input fields cannot be changed through the edit: the page is shown the draft's own
    await call('PUT', `api/post/${DRAFT_IDS.single}/edit`, { label: { ...edited, caption: 'changed caption', images: ['x.png'], postId: 'p-zzz', publishedAt: '2000-01-01' } });
    const forced = await post(DRAFT_IDS.single);
    assert.equal(forced.label.caption, data.label.caption);
    assert.deepEqual(forced.label.images, data.label.images);
    assert.equal(forced.label.postId, DRAFT_IDS.single);

    assert.equal((await call('DELETE', `api/post/${DRAFT_IDS.single}/edit`)).status, 200);
    const reset = await post(DRAFT_IDS.single);
    assert.equal(reset.edited, false);
    assert.equal(reset.label.events[0].eventName, data.label.events[0].eventName);
  });

  test('skip and flag are recorded with a note; verified cannot be set that way; the record is on disk', async () => {
    assert.equal((await call('POST', `api/post/${DRAFT_IDS.notEvent}/status`, { status: 'skipped', note: ' look again ' })).status, 200);
    let list = (await call('GET', 'api/drafts')).json;
    const row = list.posts.find((p: Json) => p.postId === DRAFT_IDS.notEvent);
    assert.equal(row.status, 'skipped');
    assert.equal(row.note, 'look again');
    assert.equal((await post(DRAFT_IDS.notEvent)).next, DRAFT_IDS.single);
    assert.equal((await call('POST', `api/post/${DRAFT_IDS.notEvent}/status`, { status: 'flagged' })).status, 200);
    assert.equal((await call('POST', `api/post/${DRAFT_IDS.notEvent}/status`, { status: 'verified' })).status, 400);
    assert.equal((await call('POST', `api/post/${DRAFT_IDS.notEvent}/status`, [])).status, 400);
    list = (await call('GET', 'api/drafts')).json;
    assert.equal(list.summary.flagged, 1);
    const onDisk = JSON.parse(readFileSync(layout.progress, 'utf8'));
    assert.equal(onDisk[DRAFT_IDS.notEvent].status, 'flagged');
    assert.equal(onDisk[DRAFT_IDS.notEvent].at, '2026-01-02T03:04:05.000Z');
    await call('POST', `api/post/${DRAFT_IDS.notEvent}/status`, { status: 'pending' });
  });

  test('verify rechecks the label: an invalid one is refused with field names only and nothing is uploaded', async () => {
    const data = await post(DRAFT_IDS.single);
    const bad = await call('POST', `api/post/${DRAFT_IDS.single}/verify`, { label: { ...data.label, groupingReason: 'whatever', events: [{ eventName: 'SECRET NAME', schedules: [{ eventStartDate: 'not-a-date' }] }] } });
    assert.equal(bad.status, 400);
    assert.match(bad.json.error, /groupingReason must be one of/);
    assert.doesNotMatch(bad.json.error, /SECRET NAME|not-a-date/);
    const category = await call('POST', `api/post/${DRAFT_IDS.single}/verify`, { label: { ...data.label, events: [{ ...data.label.events[0], categories: ['NOT_A_CATEGORY'] }] } });
    assert.equal(category.status, 400);
    assert.match(category.json.error, /not production categories/);
    assert.equal((await call('POST', `api/post/${DRAFT_IDS.single}/verify`, 'nope')).status, 400);
    assert.ok(!existsSync(join(bucket, 'extraction-eval', DRAFT_IDS.single)));
    assert.equal((await post(DRAFT_IDS.single)).status, 'pending');
  });

  test('verify writes label.json and the images to the verified prefix (never draft.json), marks the post verified, and keeps the label', async () => {
    const data = await post(DRAFT_IDS.single);
    const label = { ...data.label, caption: 'ignored', events: [{ ...data.label.events[0], eventName: '  Verified Name  ', location: '' }] };
    const done = await call('POST', `api/post/${DRAFT_IDS.single}/verify`, { label });
    assert.equal(done.status, 200);
    const target = join(bucket, 'extraction-eval', DRAFT_IDS.single);
    assert.deepEqual(readdirSync(target).sort(), ['cover.png', 'label.json', 'slide-2.png']);
    const written = JSON.parse(readFileSync(join(target, 'label.json'), 'utf8'));
    assert.equal(written.events[0].eventName, 'Verified Name');
    assert.equal('location' in written.events[0], false);
    assert.equal(written.caption, data.label.caption);
    const after = await post(DRAFT_IDS.single);
    assert.equal(after.status, 'verified');
    assert.equal(after.label.events[0].eventName, 'Verified Name');
    assert.equal(after.next, DRAFT_IDS.multi);
  });

  test('an existing verified post is never overwritten without asking: 409 first, then only with overwrite', async () => {
    const data = await post(DRAFT_IDS.single);
    const changed = { ...data.label, events: [{ ...data.label.events[0], eventName: 'Second Version' }] };
    const refused = await call('POST', `api/post/${DRAFT_IDS.single}/verify`, { label: changed });
    assert.equal(refused.status, 409);
    const target = join(bucket, 'extraction-eval', DRAFT_IDS.single, 'label.json');
    assert.equal(JSON.parse(readFileSync(target, 'utf8')).events[0].eventName, 'Verified Name');
    // the reviewer's typing is kept even though the upload was refused
    assert.equal((await post(DRAFT_IDS.single)).label.events[0].eventName, 'Second Version');
    const confirmed = await call('POST', `api/post/${DRAFT_IDS.single}/verify`, { label: changed, overwrite: true });
    assert.equal(confirmed.status, 200);
    assert.equal(JSON.parse(readFileSync(target, 'utf8')).events[0].eventName, 'Second Version');
  });

  test('verify of a draft whose image file went missing is refused before anything is uploaded', async () => {
    const data = await post(DRAFT_IDS.multi);
    rmSync(join(layout.drafts, DRAFT_IDS.multi, data.images[0]));
    const refused = await call('POST', `api/post/${DRAFT_IDS.multi}/verify`, { label: data.label });
    assert.equal(refused.status, 400);
    assert.match(refused.json.error, /an image named in the label is missing/);
    assert.ok(!existsSync(join(bucket, 'extraction-eval', DRAFT_IDS.multi)));
  });

  test('a draft that cannot be read is reported in the list and refused on open, without hiding the others', async () => {
    writeFileSync(join(layout.drafts, DRAFT_IDS.notEvent, 'label.json'), '{ broken SECRET');
    const list = (await call('GET', 'api/drafts')).json;
    assert.deepEqual(list.unreadable, [{ postId: DRAFT_IDS.notEvent, problem: 'label.json is not readable as JSON' }]);
    assert.equal(list.posts.length, 2);
    const open = await call('GET', `api/post/${DRAFT_IDS.notEvent}`);
    assert.equal(open.status, 422);
    assert.doesNotMatch(open.json.error, /SECRET/);
  });
});
