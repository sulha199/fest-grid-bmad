import test from 'node:test';
import assert from 'node:assert/strict';
import {
  brightDataStartDate, buildBrightDataTrigger, capPerAccount, emptyRunLog, estimateCostUsd, inWindow, knownSnapshotIds, mergeByUrl,
  needsMore, parseAccountList, parseDotenvWhitelist, recordsFromRawOutput, reduceRecord, vendorAllowed, type PocPost, type RunLog,
} from './poc-posts-lib.js';

const post = (over: Partial<PocPost>): PocPost => ({
  url: 'https://www.instagram.com/p/a/', username: 'acct', datePosted: '2026-10-01T00:00:00.000Z', caption: 'c', hashtags: [], contentType: 'Post',
  locationName: null, photoCount: 1, ...over,
});

test('reduceRecord: Bright Data record keeps only the whitelisted fields', () => {
  const rec = {
    url: 'https://www.instagram.com/p/xyz/', user_posted: 'SleManCityHall', date_posted: '2026-10-05T10:00:00.000Z',
    description: 'Fun run 12 Oct', hashtags: ['#FunRun', 'sleman', '#funrun'], content_type: 'Carousel', location_details: { name: 'Sleman City Hall', lat: 1 },
    photos: ['a', 'b', 'c'],
    // none of these may survive
    comments: [{ user: 'someone', text: 'secret' }], user_tagged: ['x'], likes: 10, followers: 100, profile_image_link: 'http://x', latest_comments: ['y'],
  };
  const out = reduceRecord(rec);
  assert.deepEqual(out, {
    url: 'https://www.instagram.com/p/xyz/', username: 'slemancityhall', datePosted: '2026-10-05T10:00:00.000Z',
    caption: 'Fun run 12 Oct', hashtags: ['funrun', 'sleman'], contentType: 'Carousel', locationName: 'Sleman City Hall', photoCount: 3,
  });
  const text = JSON.stringify(out);
  for (const leak of ['secret', 'someone', 'followers', 'profile_image_link', 'likes']) assert.ok(!text.includes(leak), leak);
});

test('reduceRecord: Apify item', () => {
  const out = reduceRecord({ postUrl: 'https://www.instagram.com/p/q/', ownerUsername: 'Venue', timestamp: '2026-09-30T05:00:00Z', caption: 'Hello', type: 'Sidecar', childPosts: [{}, {}], locationName: 'JEC', hashtags: ['A'] });
  assert.equal(out?.username, 'venue');
  assert.equal(out?.photoCount, 2);
  assert.equal(out?.locationName, 'JEC');
  assert.deepEqual(out?.hashtags, ['a']);
  assert.equal(out?.contentType, 'Sidecar');
});

test('reduceRecord: no url, a non-object, a bad date', () => {
  assert.equal(reduceRecord({ description: 'x' }), null);
  assert.equal(reduceRecord(null), null);
  assert.equal(reduceRecord('x'), null);
  assert.equal(reduceRecord({ url: 'u', date_posted: 12345 })?.datePosted, null);
  assert.equal(reduceRecord({ url: 'u', date_posted: 'not a date' })?.datePosted, null);
  assert.equal(reduceRecord({ url: 'u' })?.caption, '');
});

test('recordsFromRawOutput: array, wrapped, double-encoded string, junk', () => {
  assert.deepEqual(recordsFromRawOutput([{ a: 1 }]), [{ a: 1 }]);
  assert.deepEqual(recordsFromRawOutput({ items: [{ a: 1 }] }), [{ a: 1 }]);
  assert.deepEqual(recordsFromRawOutput(JSON.stringify([{ a: 1 }])), [{ a: 1 }]);
  assert.deepEqual(recordsFromRawOutput('not json'), []);
  assert.deepEqual(recordsFromRawOutput(null), []);
  assert.deepEqual(recordsFromRawOutput({ other: [1] }), []);
});

test('inWindow: needs a date on or after the cut-off', () => {
  assert.equal(inWindow(post({ datePosted: '2026-10-01T00:00:00.000Z' }), '2026-09-01T00:00:00.000Z'), true);
  assert.equal(inWindow(post({ datePosted: '2026-08-31T23:59:59.000Z' }), '2026-09-01T00:00:00.000Z'), false);
  assert.equal(inWindow(post({ datePosted: null }), '2026-09-01T00:00:00.000Z'), false);
});

test('mergeByUrl keeps the first occurrence; a re-run adds nothing', () => {
  const a = [post({ url: 'u1', caption: 'first' })];
  const merged = mergeByUrl(a, [post({ url: 'u1', caption: 'second' }), post({ url: 'u2' })]);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].caption, 'first');
  assert.equal(mergeByUrl(merged, merged).length, 2);
});

test('capPerAccount keeps the newest n of each username', () => {
  const posts = [
    post({ url: '1', username: 'a', datePosted: '2026-10-01T00:00:00.000Z' }), post({ url: '2', username: 'a', datePosted: '2026-10-03T00:00:00.000Z' }),
    post({ url: '3', username: 'a', datePosted: '2026-10-02T00:00:00.000Z' }), post({ url: '4', username: 'b', datePosted: '2026-10-01T00:00:00.000Z' }),
  ];
  const out = capPerAccount(posts, 2);
  assert.deepEqual(out.filter((p) => p.username === 'a').map((p) => p.url).sort(), ['2', '3']);
  assert.equal(out.filter((p) => p.username === 'b').length, 1);
});

test('needsMore', () => {
  assert.equal(needsMore(3, 10), true);
  assert.equal(needsMore(10, 10), false);
});

test('parseAccountList: handles, urls, junk, duplicates', () => {
  const r = parseAccountList('@Sleman_City, instagram.com/plazaambarrukmo/ https://www.instagram.com/jec.jogja/?hl=en\nbad!name, plazaambarrukmo, instagram.com/p/AbC/');
  assert.deepEqual(r.valid, ['sleman_city', 'plazaambarrukmo', 'jec.jogja']);
  assert.ok(r.invalid.includes('bad!name'));
  assert.ok(r.invalid.some((x) => x.includes('/p/')));
  assert.deepEqual(parseAccountList('').valid, []);
});

test('parseDotenvWhitelist returns only whitelisted keys, never the database URL', () => {
  const env = [
    '# comment', 'DATABASE_URL=postgres://owner:secret@host/db', 'export BRIGHTDATA_API_TOKEN="tok123"', "APIFY_API_TOKEN='apf'",
    'BRIGHTDATA_DATASET_ID=gd_x # inline comment', 'GEMINI_API_KEY=zzz', 'BRIGHTDATA_SCRAPING_CONFIRMED=false', 'EMPTY=',
  ].join('\n');
  const out = parseDotenvWhitelist(env);
  assert.deepEqual(out, { BRIGHTDATA_API_TOKEN: 'tok123', APIFY_API_TOKEN: 'apf', BRIGHTDATA_DATASET_ID: 'gd_x', BRIGHTDATA_SCRAPING_CONFIRMED: 'false' });
  assert.ok(!JSON.stringify(out).includes('secret'));
});

test('vendorAllowed follows the application kill switch (unset = allowed)', () => {
  assert.equal(vendorAllowed(undefined), true);
  assert.equal(vendorAllowed('true'), true);
  assert.equal(vendorAllowed('false'), false);
  assert.equal(vendorAllowed(' 0 '), false);
});

test('buildBrightDataTrigger has no endpoint (it must never reach the production webhook)', () => {
  const req = buildBrightDataTrigger('gd_ds', 'someaccount', 15, '2026-09-01T00:00:00.000Z');
  const u = new URL(req.url);
  assert.equal(u.searchParams.get('dataset_id'), 'gd_ds');
  assert.equal(u.searchParams.get('type'), 'discover_new');
  assert.equal(u.searchParams.has('endpoint'), false);
  assert.ok(!req.url.includes('webhook'));
  assert.deepEqual(JSON.parse(req.body), { input: [{ url: 'https://www.instagram.com/someaccount/', num_of_posts: 15, start_date: '09-01-2026' }] });
});

test('brightDataStartDate pads and uses UTC', () => {
  assert.equal(brightDataStartDate('2026-01-05T23:30:00.000Z'), '01-05-2026');
});

test('estimateCostUsd', () => {
  assert.equal(estimateCostUsd(300, 1.5), 0.45);
  assert.equal(estimateCostUsd(0, 1.5), 0);
});

test('the run log reuses a paid snapshot instead of scraping again', () => {
  const log: RunLog = emptyRunLog();
  log.entries.push({ username: 'a', source: 'new-scrape', vendor: 'BRIGHTDATA', runId: 's_1', fetched: 10, inWindow: 10, kept: 10, at: 't' });
  log.entries.push({ username: 'a', source: 'db-raw', fetched: 3, inWindow: 3, kept: 3, at: 't' });
  log.entries.push({ username: 'b', source: 'new-scrape', vendor: 'BRIGHTDATA', runId: 's_2', fetched: 1, inWindow: 1, kept: 1, at: 't' });
  assert.deepEqual(knownSnapshotIds(log, 'a'), ['s_1']);
  assert.deepEqual(knownSnapshotIds(log, 'zzz'), []);
});

test('a run log built from counts holds no caption', () => {
  const p = reduceRecord({ url: 'https://www.instagram.com/p/z/', description: 'SECRET CAPTION', user_posted: 'a', date_posted: '2026-10-01T00:00:00Z' });
  assert.ok(p);
  const log = emptyRunLog();
  log.entries.push({ username: p!.username!, source: 'db-raw', fetched: 1, inWindow: 1, kept: 1, at: 'now' });
  assert.ok(!JSON.stringify(log).includes('SECRET'));
});
