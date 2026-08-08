import test from 'node:test';
import assert from 'node:assert';
import { twitterScraperAdapter } from './twitter-adapter.js';

test('twitter-adapter tests', async (t) => {
  await t.test('getNewestPosts throws not implemented error', async () => {
    await assert.rejects(
      () => twitterScraperAdapter.getNewestPosts({ accountId: '123', username: 'twitter_user' }),
      /Twitter\/X scraping is not yet implemented/
    );
  });

  await t.test('lookupAccountProfile throws not implemented error', async () => {
    await assert.rejects(
      () => twitterScraperAdapter.lookupAccountProfile('twitter_user'),
      /Twitter\/X scraping is not yet implemented/
    );
  });
});
