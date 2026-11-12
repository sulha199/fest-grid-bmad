import test from 'node:test';
import assert from 'node:assert/strict';
import { saveRefreshedPostImages } from './save-refreshed-post-images.js';
import { createReextractFixtures } from './reextract-test-support.js';

// Story 10.6 (AC4) -- the one writer of fresh image links to `posts`: the rule is the domain's (tested there), this proves the writes.

const fx = createReextractFixtures('save');
let accountId: string;

test.before(async () => {
  accountId = (await fx.makeAccount()).id;
});
test.after(() => fx.cleanup());

test('saves the cover, slides and expiry; the caption and everything else on the row stay as they were', async () => {
  const post = await fx.makePost(accountId, { imageUrl: fx.expiredUrl('c0'), additionalImageUrls: [fx.expiredUrl('s0')], content: 'caption kept as it is' });
  const result = await saveRefreshedPostImages({
    postId: post.id,
    scraped: { imageUrl: fx.freshUrl('c1'), additionalImageUrls: [fx.freshUrl('s1')] },
  });
  assert.deepEqual(result, { saved: true, postTypeFilled: false });
  const stored = await fx.readPost(post.id);
  assert.equal(stored.imageUrl, fx.freshUrl('c1'));
  assert.deepEqual(stored.additionalImageUrls, [fx.freshUrl('s1')]);
  assert.ok(stored.imageUrlExpiresAt && stored.imageUrlExpiresAt.getTime() > Date.now());
  assert.equal(stored.content, 'caption kept as it is');
  assert.equal(stored.postUrl, post.postUrl);
});

test('is idempotent: the same answer applied twice writes once and the second call reports nothing saved', async () => {
  const post = await fx.makePost(accountId, { imageUrl: fx.expiredUrl('c0') });
  const scraped = { imageUrl: fx.freshUrl('c2'), additionalImageUrls: [fx.freshUrl('s2')] };
  assert.equal((await saveRefreshedPostImages({ postId: post.id, scraped })).saved, true);
  const first = await fx.readPost(post.id);
  assert.equal((await saveRefreshedPostImages({ postId: post.id, scraped })).saved, false);
  assert.equal((await fx.readPost(post.id)).updatedAt.getTime(), first.updatedAt.getTime(), 'the second call wrote nothing');
});

test('a late 640 px answer never replaces links a refresh already saved at full size', async () => {
  const post = await fx.makePost(accountId, { imageUrl: fx.expiredUrl('c0'), additionalImageUrls: [fx.expiredUrl('s0')] });
  await saveRefreshedPostImages({ postId: post.id, scraped: { imageUrl: fx.freshUrl('full-c'), additionalImageUrls: [fx.freshUrl('full-s')] } });
  const late = await saveRefreshedPostImages({ postId: post.id, scraped: { imageUrl: fx.lowResUrl('low-c'), additionalImageUrls: [fx.lowResUrl('low-s')] } });
  assert.equal(late.saved, false);
  const stored = await fx.readPost(post.id);
  assert.equal(stored.imageUrl, fx.freshUrl('full-c'));
  assert.deepEqual(stored.additionalImageUrls, [fx.freshUrl('full-s')]);
});

test('an unknown post saves nothing and does not throw', async () => {
  const result = await saveRefreshedPostImages({ postId: '00000000-0000-4000-8000-0000000000bb', scraped: { imageUrl: fx.freshUrl('x') } });
  assert.deepEqual(result, { saved: false, postTypeFilled: false });
});

test('a null post type (and id) is filled from the post URL; a stored one is never replaced', async () => {
  const legacy = await fx.makePost(accountId, { platformPostType: null, platformPostId: null });
  assert.equal((await saveRefreshedPostImages({ postId: legacy.id, scraped: {} })).postTypeFilled, true);
  const filled = await fx.readPost(legacy.id);
  assert.equal(filled.platformPostType, 'p');
  assert.ok(filled.platformPostId && legacy.postUrl.includes(filled.platformPostId));

  const reel = await fx.makePost(accountId, { platformPostType: 'reel' });
  assert.equal((await saveRefreshedPostImages({ postId: reel.id, scraped: {} })).postTypeFilled, false);
  assert.equal((await fx.readPost(reel.id)).platformPostType, 'reel');
});

test('a post type that would clash with another post (the unique identity index) is left null, with no throw', async () => {
  const owner = await fx.makePost(accountId);
  const twin = await fx.makePost(accountId, { platformPostType: null, platformPostId: null, postUrl: `${owner.postUrl}?utm_source=twin`, originalPostUrl: null });
  const warnings: string[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => void warnings.push(String(args[0]));
  try {
    const result = await saveRefreshedPostImages({ postId: twin.id, scraped: { imageUrl: fx.freshUrl('twin') } });
    assert.deepEqual(result, { saved: true, postTypeFilled: false });
  } finally {
    console.warn = original;
  }
  assert.equal((await fx.readPost(twin.id)).platformPostType, null);
  assert.equal(warnings.length, 1);
  assert.doesNotMatch(warnings[0], /instagram\.com/, 'no URL in the log');
});

test('a post URL that does not name a post identity is left null', async () => {
  const post = await fx.makePost(accountId, { platformPostType: null, platformPostId: null, postUrl: `https://www.instagram.com/some-profile-${fx.suffix}/` });
  assert.equal((await saveRefreshedPostImages({ postId: post.id, scraped: {} })).postTypeFilled, false);
});

test('a post whose stored id disagrees with its URL is left alone', async () => {
  const post = await fx.makePost(accountId, { platformPostType: null, platformPostId: 'someOtherId' });
  assert.equal((await saveRefreshedPostImages({ postId: post.id, scraped: {} })).postTypeFilled, false);
});
