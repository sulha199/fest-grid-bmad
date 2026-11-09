import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getImageUrlFileName, dedupeImageUrlsByFileName } from './image-url-file-name.js';

describe('getImageUrlFileName', () => {
  it('returns the last path segment, ignoring the query string', () => {
    assert.equal(getImageUrlFileName('https://cdn.example.com/v/t51/abc123_n.jpg?oe=6AAB0FE9&_nc_cid=0'), 'abc123_n.jpg');
  });

  it('returns null for a missing or unparseable URL', () => {
    assert.equal(getImageUrlFileName(null), null);
    assert.equal(getImageUrlFileName(undefined), null);
    assert.equal(getImageUrlFileName('not a url'), null);
  });

  it('returns null when the path has no segments', () => {
    assert.equal(getImageUrlFileName('https://cdn.example.com/'), null);
    assert.equal(getImageUrlFileName('https://cdn.example.com'), null);
  });
});

describe('dedupeImageUrlsByFileName', () => {
  it('drops a later URL whose file name repeats an earlier one, keeping the first occurrence', () => {
    const cover = 'https://cdn.example.com/p/abc123_n.heic?oe=111&sig=aaa';
    const repeatOfCover = 'https://cdn.example.com/p/abc123_n.heic?oe=222&sig=bbb'; // same file, different signed query
    const slide2 = 'https://cdn.example.com/p/def456_n.heic?oe=333&sig=ccc';

    assert.deepEqual(dedupeImageUrlsByFileName([cover, repeatOfCover, slide2]), [cover, slide2]);
  });

  it('never merges two genuinely different images that merely share a host (different file names kept)', () => {
    const slide1 = 'https://cdn.example.com/p/abc_n.heic?oe=111';
    const slide2 = 'https://cdn.example.com/p/def_n.heic?oe=222';

    assert.deepEqual(dedupeImageUrlsByFileName([slide1, slide2]), [slide1, slide2]);
  });

  it('skips null/undefined entries and preserves order of the rest', () => {
    const a = 'https://cdn.example.com/p/a.jpg';
    const b = 'https://cdn.example.com/p/b.jpg';
    assert.deepEqual(dedupeImageUrlsByFileName([a, null, undefined, b]), [a, b]);
  });

  it('falls back to comparing the full URL when a file name cannot be determined, never collapsing two unrelated unparseable values', () => {
    assert.deepEqual(dedupeImageUrlsByFileName(['not a url 1', 'not a url 2']), ['not a url 1', 'not a url 2']);
    assert.deepEqual(dedupeImageUrlsByFileName(['not a url', 'not a url']), ['not a url']);
  });
});
