import test from 'node:test';
import * as assert from 'node:assert';
import { claimPostUrlScrape, postUrlScrapeLockKey } from './post-url-scrape-lease.js';

// FIND-110 -- the lease key names the POST, so every spelling of one post's URL shares one lease.

test('postUrlScrapeLockKey', async (t) => {
  await t.test('spellings of one post share a key: trailing slash, www, tracking query, /p/ versus /reel/', () => {
    const keys = new Set([
      'https://www.instagram.com/p/Cx9uWttkSN/',
      'https://instagram.com/p/Cx9uWttkSN',
      'https://www.instagram.com/p/Cx9uWttkSN/?igsh=abc123',
      'https://www.instagram.com/reel/Cx9uWttkSN/',
      '  https://www.instagram.com/p/Cx9uWttkSN/  ',
    ].map(postUrlScrapeLockKey));
    assert.strictEqual(keys.size, 1);
    assert.match([...keys][0], /^post-url-scrape:instagram:Cx9uWttkSN$/);
  });

  await t.test('different posts get different keys', () => {
    assert.notStrictEqual(postUrlScrapeLockKey('https://www.instagram.com/p/AAA111/'), postUrlScrapeLockKey('https://www.instagram.com/p/BBB222/'));
  });

  await t.test('a URL with no readable post identity falls back to a hash of the trimmed URL', () => {
    const a = postUrlScrapeLockKey('https://example.com/some/post');
    assert.match(a, /^post-url-scrape:[0-9a-f]{32}$/);
    assert.strictEqual(a, postUrlScrapeLockKey('  https://example.com/some/post '));
    assert.notStrictEqual(a, postUrlScrapeLockKey('https://example.com/other/post'));
  });

  await t.test('claim: the second spelling of one post sees the first one busy; release frees it', async () => {
    const id = `LeaseT${Date.now()}`;
    const first = await claimPostUrlScrape(`https://www.instagram.com/p/${id}/`);
    assert.ok(first);
    assert.strictEqual(await claimPostUrlScrape(`https://instagram.com/p/${id}?igsh=x`), null, 'a different spelling of the same post is busy');
    await first.release();
    const again = await claimPostUrlScrape(`https://instagram.com/p/${id}`);
    assert.ok(again, 'released');
    await again.release();
  });
});
