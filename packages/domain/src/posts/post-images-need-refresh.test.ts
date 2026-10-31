import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { IMAGE_URL_EXPIRY_MARGIN_MS, postImagesNeedRefresh } from './post-images-need-refresh.js';

const NOW = new Date('2026-10-31T10:00:00.000Z');
const hexOf = (d: Date) => Math.floor(d.getTime() / 1000).toString(16);
const url = (expires: Date | null) => `https://cdn.example.com/p.jpg${expires ? `?oe=${hexOf(expires)}&x=1` : ''}`;
const inDays = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

describe('postImagesNeedRefresh', () => {
  it('needs a refresh when slides are listed but the cover is missing', () => {
    assert.equal(postImagesNeedRefresh({ imageUrl: null, additionalImageUrls: [url(inDays(3))] }, NOW), true);
  });

  it('does not need one for a text-only post (no cover, no slides)', () => {
    assert.equal(postImagesNeedRefresh({}, NOW), false);
    assert.equal(postImagesNeedRefresh({ imageUrl: null, additionalImageUrls: [] }, NOW), false);
    assert.equal(postImagesNeedRefresh({ imageUrl: null, additionalImageUrls: null }, NOW), false);
  });

  it('does not need one when the cover and every slide are valid, or carry no expiry', () => {
    assert.equal(postImagesNeedRefresh({ imageUrl: url(inDays(3)), additionalImageUrls: [url(inDays(2)), url(null)] }, NOW), false);
    assert.equal(postImagesNeedRefresh({ imageUrl: url(null) }, NOW), false);
    assert.equal(postImagesNeedRefresh({ imageUrl: url(null), additionalImageUrls: null }, NOW), false);
  });

  it('needs one when the cover link has expired, from its URL', () => {
    assert.equal(postImagesNeedRefresh({ imageUrl: url(inDays(-1)) }, NOW), true);
  });

  it('prefers the stored cover expiry column over parsing the URL', () => {
    assert.equal(postImagesNeedRefresh({ imageUrl: url(inDays(3)), imageUrlExpiresAt: inDays(-1) }, NOW), true);
    assert.equal(postImagesNeedRefresh({ imageUrl: url(inDays(-1)), imageUrlExpiresAt: inDays(3) }, NOW), false);
  });

  it('needs one when only a later slide has expired', () => {
    assert.equal(postImagesNeedRefresh({ imageUrl: url(inDays(3)), additionalImageUrls: [url(inDays(3)), url(inDays(-2))] }, NOW), true);
  });

  it('treats a link expiring inside the safety margin as expired', () => {
    const justInside = new Date(NOW.getTime() + IMAGE_URL_EXPIRY_MARGIN_MS - 1000);
    const justOutside = new Date(NOW.getTime() + IMAGE_URL_EXPIRY_MARGIN_MS + 5000);
    assert.equal(postImagesNeedRefresh({ imageUrl: url(justInside) }, NOW), true);
    assert.equal(postImagesNeedRefresh({ imageUrl: url(justOutside) }, NOW), false);
  });
});
