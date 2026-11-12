import test from 'node:test';
import * as assert from 'node:assert';
import { eq } from 'drizzle-orm';
import { vendorCallLocks } from '@festgrid/database';
import { db } from '../../db/client.js';
import { POST_URL_SCRAPE_LEASE_TTL_MS, claimPostUrlScrape, postUrlScrapeLockKey } from './post-url-scrape-lease.js';

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

  await t.test('Story 10.6 review: a lease claimed with a longer ttl is still held after the default 60 s, one claimed with the default is not', async () => {
    const long = `https://www.instagram.com/p/LongLease${Date.now()}/`;
    const short = `https://www.instagram.com/p/ShortLease${Date.now()}/`;
    const longLease = await claimPostUrlScrape(long, 150_000);
    const shortLease = await claimPostUrlScrape(short);
    assert.ok(longLease && shortLease);
    // 61 seconds pass: move both rows' expiry back by that much (the claim reads the database clock, so this is the passage of time).
    for (const url of [long, short]) {
      await db.execute(sqlShift(postUrlScrapeLockKey(url), 61));
    }
    assert.strictEqual(await claimPostUrlScrape(long), null, 'the longer lease is still held at +61 s');
    const taken = await claimPostUrlScrape(short);
    assert.ok(taken, 'the default 60 s lease has lapsed at +61 s (the gap the engine\'s long refresh must not have)');
    assert.strictEqual(POST_URL_SCRAPE_LEASE_TTL_MS, 60_000, 'the default for the legacy callers is unchanged');
    for (const url of [long, short]) {
      await db.delete(vendorCallLocks).where(eq(vendorCallLocks.lockKey, postUrlScrapeLockKey(url)));
    }
  });
});

import { sql } from 'drizzle-orm';
function sqlShift(lockKey: string, seconds: number) {
  return sql`update vendor_call_locks set locked_until = locked_until - make_interval(secs => ${seconds}) where lock_key = ${lockKey}`;
}
