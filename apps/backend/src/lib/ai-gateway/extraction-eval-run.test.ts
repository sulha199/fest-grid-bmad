import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { RecordedOutputs, RecordedRun } from '@festgrid/domain/extraction-eval';
import { generateContentSeam, setGenerateContentSeam } from './gemini-client.js';
import { EVAL_MAX_ATTEMPTS } from './eval-retry-policy.js';
import { hashPrompt, liveExitCode, loadLabelledPosts, parseLikePipeline, readJsonFile, recordLive, serveImages } from './extraction-eval-run.js';

/**
 * Tests of the eval runner's logic (the script is only argument parsing around it). No network and no key: the live loop is
 * driven through the real gateway client with its raw SDK call swapped for a stub, and the sleeping is injected.
 */
const FIXTURES = resolve(__dirname, '../../../scripts/fixtures/extraction-eval-synthetic');
const originalSeam = generateContentSeam;

const workDirs: string[] = [];
function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'extraction-eval-test-'));
  workDirs.push(dir);
  return dir;
}

test.after(() => {
  setGenerateContentSeam(originalSeam);
  for (const dir of workDirs) rmSync(dir, { recursive: true, force: true });
});

const label = (postId: string, images: string[]): string =>
  JSON.stringify({
    postId,
    caption: 'Invented caption',
    images,
    publishedAt: '2026-02-20T08:00:00Z',
    groupingReason: 'single-event',
    events: [{ eventName: 'Contoh', schedules: [{ eventStartDate: '2026-03-01' }] }],
  });

/** A labelled dir with one folder per post; `files` maps a post id to the image file names to copy next to its label. */
function makeSet(posts: Record<string, string[]>): string {
  const dir = tempDir();
  for (const [postId, images] of Object.entries(posts)) {
    mkdirSync(join(dir, postId));
    writeFileSync(join(dir, postId, 'label.json'), label(postId, images));
    for (const image of images) copyFileSync(join(FIXTURES, 'syn-single/cover.png'), join(dir, postId, image));
  }
  return dir;
}

const answer = (text = '{"events":[]}', finishReason = 'STOP') => ({ text, candidates: [{ finishReason }] });
const noRetryWait = { sleep: async () => {}, now: () => 0, log: () => {} };

test('readJsonFile: a malformed file fails with its name and never quotes its content', () => {
  const file = join(tempDir(), 'label.json');
  writeFileSync(file, '{"caption": "private caption text", "oops');
  assert.throws(() => readJsonFile(file), (err: Error) => err.message.includes(file) && !err.message.includes('private caption'));
  writeFileSync(file, '{"ok": 1}');
  assert.deepEqual(readJsonFile(file), { ok: 1 });
});

test('loadLabelledPosts: validates each label, needs its images and its folder name, and honours --only', () => {
  const dir = makeSet({ 'b-post': ['cover.png'], 'a-post': ['cover.png', 'slide.png'] });
  mkdirSync(join(dir, 'not-a-post'));
  const posts = loadLabelledPosts(dir, undefined);
  assert.deepEqual(posts.map((p) => p.post.postId), ['a-post', 'b-post']);
  assert.deepEqual(loadLabelledPosts(dir, 'b-post').map((p) => p.post.postId), ['b-post']);
  assert.throws(() => loadLabelledPosts(dir, 'nope'), /--only nope: no such post/);
  writeFileSync(join(dir, 'a-post', 'label.json'), label('other-id', ['cover.png']));
  assert.throws(() => loadLabelledPosts(dir, undefined), /postId "other-id" must equal its folder name "a-post"/);
  writeFileSync(join(dir, 'a-post', 'label.json'), label('a-post', ['missing.png']));
  assert.throws(() => loadLabelledPosts(dir, undefined), /image "missing\.png" is missing next to the label/);
  writeFileSync(join(dir, 'a-post', 'label.json'), '{"events": [');
  assert.throws(() => loadLabelledPosts(dir, undefined), (err: Error) => /not readable as JSON/.test(err.message) && !err.message.includes('events'));
  assert.deepEqual(loadLabelledPosts(tempDir(), undefined), []);
});

test('parseLikePipeline: the pipeline step: valid answers pass, broken JSON and invalid payloads do not', () => {
  const recorded = readJsonFile(join(FIXTURES, 'recorded.json')) as RecordedOutputs;
  const answered = recorded.runs.filter((r) => r.text !== undefined && r.finishReason !== 'MAX_TOKENS');
  assert.ok(answered.length > 0);
  for (const run of answered) assert.notEqual(parseLikePipeline(run.text!), undefined, `${run.postId} run ${run.runIndex}`);
  assert.equal(parseLikePipeline('{"events": [{"eventName": "cut off'), undefined);
  assert.equal(parseLikePipeline('not json at all'), undefined);
  assert.equal(parseLikePipeline('{"events": "should be a list"}'), undefined);
  assert.equal(parseLikePipeline('null'), undefined);
});

test('hashPrompt: the publish date does not change it, the prompt and the schema do', () => {
  const schema = { type: 'OBJECT' };
  const base = hashPrompt('Rules. The social media post was published on 2026-01-05. More rules.', schema);
  assert.match(base, /^[0-9a-f]{12}$/);
  assert.equal(hashPrompt('Rules. The social media post was published on 2027-12-31. More rules.', schema), base);
  assert.notEqual(hashPrompt('Other rules. The social media post was published on 2026-01-05. More rules.', schema), base);
  assert.notEqual(hashPrompt('Rules. The social media post was published on 2026-01-05. More rules.', { type: 'ARRAY' }), base);
  assert.equal(hashPrompt('x', undefined), hashPrompt('x', {}));
});

test('liveExitCode: a score is never a failure, a run with no answer at all is', () => {
  const run = (over: Partial<RecordedRun>): RecordedRun => ({ postId: 'p', runIndex: 0, ...over });
  assert.deepEqual(liveExitCode([run({ text: '{}' }), run({ unavailable: true })]), { code: 0, answered: 1 });
  assert.deepEqual(liveExitCode([run({ text: '{"cut', finishReason: 'MAX_TOKENS' })]), { code: 0, answered: 1 });
  assert.deepEqual(liveExitCode([run({ unavailable: true }), run({})]), { code: 1, answered: 0 });
  assert.deepEqual(liveExitCode([]), { code: 1, answered: 0 });
});

test('serveImages: serves the post images with their types, and 404 for anything else', async (t) => {
  const dir = makeSet({ p: ['cover.png'] });
  copyFileSync(join(dir, 'p', 'cover.png'), join(dir, 'p', 'a.WEBP'));
  copyFileSync(join(dir, 'p', 'cover.png'), join(dir, 'p', 'b.bmp'));
  const { server, base } = await serveImages(join(dir, 'p'));
  t.after(() => server.close());
  const png = await fetch(`${base}/cover.png`);
  assert.equal(png.status, 200);
  assert.equal(png.headers.get('content-type'), 'image/png');
  assert.equal((await png.arrayBuffer()).byteLength, readFileSync(join(dir, 'p', 'cover.png')).byteLength);
  assert.equal((await fetch(`${base}/a.WEBP`)).headers.get('content-type'), 'image/webp');
  assert.equal((await fetch(`${base}/b.bmp`)).headers.get('content-type'), 'application/octet-stream');
  assert.equal((await fetch(`${base}/nothing.png`)).status, 404);
});

test('recordLive: answers every run, saves after each one, and paces the calls', async () => {
  const dir = makeSet({ 'post-a': ['cover.png', 'slide.png'] });
  const recordPath = join(tempDir(), 'rec.json');
  let calls = 0;
  let sentImages = 0;
  setGenerateContentSeam(async (_ai, params) => {
    calls += 1;
    sentImages = (params.contents as Array<unknown>).length - 1;
    // The recording on disk already holds every run answered before this call.
    assert.equal(existsSync(recordPath) ? (JSON.parse(readFileSync(recordPath, 'utf8')) as RecordedOutputs).runs.length : 0, calls - 1);
    return answer(`{"events":[],"n":${calls}}`);
  });
  const sleeps: number[] = [];
  const logs: string[] = [];
  const clock = 1_000_000;
  const recorded = await recordLive(loadLabelledPosts(dir, undefined), 2, 'fake-key', {
    recordPath,
    intervalMs: 5000,
    sleep: async (ms) => void sleeps.push(ms),
    now: () => clock,
    log: (line) => void logs.push(line),
  });
  assert.equal(calls, 2);
  assert.equal(sentImages, 2, 'every labelled slide is sent');
  assert.deepEqual(recorded.runs.map((r) => [r.postId, r.runIndex, r.finishReason]), [['post-a', 0, 'STOP'], ['post-a', 1, 'STOP']]);
  assert.match(recorded.promptHash, /^[0-9a-f]{12}$/);
  assert.deepEqual(JSON.parse(readFileSync(recordPath, 'utf8')), JSON.parse(JSON.stringify(recorded)));
  // The clock never moves, so the second call waits the whole interval; the first call does not wait.
  assert.deepEqual(sleeps, [5000]);
  assert.deepEqual(logs, ['post-a run 1/2: STOP', 'post-a run 2/2: STOP']);
});

test('recordLive: a post whose images were not all sent makes no call and is unavailable', async () => {
  const dir = makeSet({ 'bad-image': ['cover.bmp'], good: ['cover.png'] });
  let calls = 0;
  setGenerateContentSeam(async () => {
    calls += 1;
    return answer();
  });
  const logs: string[] = [];
  const recorded = await recordLive(loadLabelledPosts(dir, undefined), 2, 'fake-key', { ...noRetryWait, intervalMs: 0, recordPath: join(tempDir(), 'rec.json'), log: (l) => void logs.push(l) });
  assert.equal(calls, 2, 'only the good post is called');
  assert.deepEqual(recorded.runs.filter((r) => r.postId === 'bad-image').map((r) => r.unavailable), [true, true]);
  assert.deepEqual(recorded.runs.filter((r) => r.postId === 'good').map((r) => r.unavailable), [undefined, undefined]);
  assert.ok(logs.some((l) => /bad-image: only 0 of 1 image\(s\) could be sent/.test(l)));
});

test('recordLive: a 429 and a 503 are retried after a wait, then answered', async () => {
  const dir = makeSet({ p: ['cover.png'] });
  const failures = ['429 RESOURCE_EXHAUSTED: Please retry in 2s', '503 UNAVAILABLE: model overloaded'];
  let calls = 0;
  setGenerateContentSeam(async () => {
    calls += 1;
    const failure = failures.shift();
    if (failure) throw new Error(failure);
    return answer();
  });
  const sleeps: number[] = [];
  const logs: string[] = [];
  const recorded = await recordLive(loadLabelledPosts(dir, undefined), 1, 'fake-key', { ...noRetryWait, intervalMs: 0, recordPath: join(tempDir(), 'rec.json'), sleep: async (ms) => void sleeps.push(ms), log: (l) => void logs.push(l) });
  assert.equal(calls, 3);
  assert.equal(recorded.runs[0]?.unavailable, undefined);
  assert.equal(recorded.runs[0]?.finishReason, 'STOP');
  assert.equal(sleeps.length, 2);
  assert.ok(sleeps[0]! >= 2000, `waited the 2 s hint, got ${sleeps[0]}`);
  assert.ok(logs.some((l) => /rate_limited, retry 1 in/.test(l)) && logs.some((l) => /unavailable, retry 2 in/.test(l)));
});

test('recordLive: after the retry cap the run is unavailable, not wrong, and the next run still tries', async () => {
  const dir = makeSet({ p: ['cover.png'] });
  let calls = 0;
  setGenerateContentSeam(async () => {
    calls += 1;
    throw new Error('503 UNAVAILABLE');
  });
  const recorded = await recordLive(loadLabelledPosts(dir, undefined), 2, 'fake-key', { ...noRetryWait, intervalMs: 0, recordPath: join(tempDir(), 'rec.json') });
  assert.deepEqual(recorded.runs.map((r) => r.unavailable), [true, true]);
  assert.equal(calls, 2 * EVAL_MAX_ATTEMPTS);
  assert.equal(liveExitCode(recorded.runs).code, 1);
});

test('recordLive: a spent daily quota stops the run: the rest is unavailable without further calls', async () => {
  const dir = makeSet({ 'a-post': ['cover.png'], 'b-post': ['cover.png'] });
  let calls = 0;
  setGenerateContentSeam(async () => {
    calls += 1;
    throw new Error('429 RESOURCE_EXHAUSTED: quota exceeded for GenerateRequestsPerDayPerProjectPerModel');
  });
  const recorded = await recordLive(loadLabelledPosts(dir, undefined), 2, 'fake-key', { ...noRetryWait, intervalMs: 0, recordPath: join(tempDir(), 'rec.json') });
  assert.equal(calls, 1);
  assert.equal(recorded.runs.length, 4);
  assert.ok(recorded.runs.every((r) => r.unavailable === true));
});

test('recordLive: a hard error keeps what was answered, names the file, and is rethrown', async (t) => {
  const dir = makeSet({ p: ['cover.png'] });
  const errors: string[] = [];
  t.mock.method(console, 'error', (line: string) => void errors.push(String(line)));
  let calls = 0;
  setGenerateContentSeam(async () => {
    calls += 1;
    if (calls === 2) throw new Error('400 INVALID_ARGUMENT: bad request');
    return answer();
  });
  const recordPath = join(tempDir(), 'rec.json');
  await assert.rejects(recordLive(loadLabelledPosts(dir, undefined), 3, 'fake-key', { ...noRetryWait, intervalMs: 0, recordPath }), /400 INVALID_ARGUMENT/);
  const saved = JSON.parse(readFileSync(recordPath, 'utf8')) as RecordedOutputs;
  assert.deepEqual(saved.runs.map((r) => r.runIndex), [0]);
  assert.ok(errors.some((e) => e.includes('Aborted after 1 recorded run(s)') && e.includes(recordPath)));
});

test('recordLive: an error before any run was recorded leaves no recording and says nothing about one', async (t) => {
  const dir = makeSet({ p: ['cover.png'] });
  const errors: string[] = [];
  t.mock.method(console, 'error', (line: string) => void errors.push(String(line)));
  setGenerateContentSeam(async () => {
    throw new Error('400 INVALID_ARGUMENT: bad request');
  });
  const recordPath = join(tempDir(), 'rec.json');
  await assert.rejects(recordLive(loadLabelledPosts(dir, undefined), 1, 'fake-key', { ...noRetryWait, intervalMs: 0, recordPath }), /400 INVALID_ARGUMENT/);
  assert.equal(existsSync(recordPath), false);
  assert.deepEqual(errors, []);
});
