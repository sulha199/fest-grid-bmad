import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  REEXTRACT_BANNER_CAUSES,
  REEXTRACT_IMAGE_ROLES,
  REEXTRACT_IMAGE_STATES,
  buildReextractImageReport,
  classifyUnreadImage,
  pickReextractBannerCauses,
  summarizeMissingImages,
  type ReextractBannerInput,
  type ReextractImageEntry,
} from './reextract-image-report.js';

// Story 10.6a -- the per-image report of a re-extract preview and the banner rules (PRD 3.9.3 FR125).

const NOW = new Date('2026-11-13T10:00:00.000Z');
const hexOf = (d: Date) => Math.floor(d.getTime() / 1000).toString(16);
const signed = (file: string, expires: Date) => `https://cdn.example.com/${file}.jpg?oe=${hexOf(expires)}`;

const slide = (position: number, state: ReextractImageEntry['state']): ReextractImageEntry => ({ position, role: 'SLIDE', state });
const cover = (state: ReextractImageEntry['state']): ReextractImageEntry => ({ position: 0, role: 'COVER', state });

describe('constants', () => {
  it('lists the four states, the two roles and the eleven cause keys', () => {
    assert.deepEqual([...REEXTRACT_IMAGE_STATES], ['READ', 'NOT_READ_EXPIRED', 'NOT_READ_UNAVAILABLE', 'NOT_SENT_OVER_CAP']);
    assert.deepEqual([...REEXTRACT_IMAGE_ROLES], ['COVER', 'SLIDE']);
    assert.equal(REEXTRACT_BANNER_CAUSES.length, 11);
  });
});

describe('classifyUnreadImage', () => {
  it('is expired only when the link carries an expiry that has passed', () => {
    assert.equal(classifyUnreadImage(signed('a', new Date(NOW.getTime() - 60_000)), NOW), 'NOT_READ_EXPIRED');
  });
  it('is unavailable for a link that is still valid', () => {
    assert.equal(classifyUnreadImage(signed('a', new Date(NOW.getTime() + 86_400_000)), NOW), 'NOT_READ_UNAVAILABLE');
  });
  it('is unavailable for a link with no readable expiry, and for a missing link', () => {
    assert.equal(classifyUnreadImage('https://cdn.example.com/a.jpg', NOW), 'NOT_READ_UNAVAILABLE');
    assert.equal(classifyUnreadImage(undefined, NOW), 'NOT_READ_UNAVAILABLE');
  });
});

describe('buildReextractImageReport', () => {
  it('puts the cover at position 0 and the slides from 1 in order, over-cap slides last', () => {
    const entries = buildReextractImageReport({ cover: 'READ', slides: ['READ', 'NOT_READ_EXPIRED'], overCapSlides: 2 });
    assert.deepEqual(entries, [
      cover('READ'),
      slide(1, 'READ'),
      slide(2, 'NOT_READ_EXPIRED'),
      slide(3, 'NOT_SENT_OVER_CAP'),
      slide(4, 'NOT_SENT_OVER_CAP'),
    ]);
  });
  it('has no position 0 entry for a post that lists slides but no cover', () => {
    assert.deepEqual(buildReextractImageReport({ cover: null, slides: ['NOT_READ_UNAVAILABLE'], overCapSlides: 0 }), [slide(1, 'NOT_READ_UNAVAILABLE')]);
  });
  it('is empty for a post with no images', () => {
    assert.deepEqual(buildReextractImageReport({ cover: null, slides: [], overCapSlides: 0 }), []);
  });
});

describe('summarizeMissingImages', () => {
  it('reports nothing when every image was read', () => {
    assert.deepEqual(summarizeMissingImages([cover('READ'), slide(1, 'READ')]), { coverMissing: false, slideRanges: [], overCapCount: 0, failedCount: 0 });
    assert.deepEqual(summarizeMissingImages([]), { coverMissing: false, slideRanges: [], overCapCount: 0, failedCount: 0 });
  });
  it('names the cover alone', () => {
    const summary = summarizeMissingImages([cover('NOT_READ_EXPIRED'), slide(1, 'READ')]);
    assert.deepEqual(summary, { coverMissing: true, slideRanges: [], overCapCount: 0, failedCount: 1 });
  });
  it('names a single slide as a one-position range', () => {
    assert.deepEqual(summarizeMissingImages([cover('READ'), slide(1, 'READ'), slide(2, 'NOT_READ_UNAVAILABLE')]).slideRanges, [{ from: 2, to: 2 }]);
  });
  it('joins consecutive slides into one range and keeps two runs apart', () => {
    const images = [cover('NOT_READ_EXPIRED'), slide(1, 'READ'), slide(2, 'NOT_READ_EXPIRED'), slide(3, 'NOT_READ_EXPIRED'), slide(4, 'READ'), slide(5, 'NOT_READ_UNAVAILABLE')];
    const summary = summarizeMissingImages(images);
    assert.deepEqual(summary.slideRanges, [{ from: 2, to: 3 }, { from: 5, to: 5 }]);
    assert.equal(summary.failedCount, 4);
  });
  it('sorts entries that arrive out of order', () => {
    assert.deepEqual(summarizeMissingImages([slide(4, 'NOT_READ_EXPIRED'), slide(3, 'NOT_READ_EXPIRED')]).slideRanges, [{ from: 3, to: 4 }]);
  });
  it('counts over-cap slides apart from failures', () => {
    const summary = summarizeMissingImages([cover('READ'), slide(1, 'READ'), slide(2, 'NOT_SENT_OVER_CAP'), slide(3, 'NOT_SENT_OVER_CAP')]);
    assert.deepEqual(summary, { coverMissing: false, slideRanges: [], overCapCount: 2, failedCount: 0 });
  });
});

describe('pickReextractBannerCauses', () => {
  const base: ReextractBannerInput = { outcome: 'NOT_NEEDED', saved: false, lateResultPending: false, expiredLinks: 0, images: [], imagesAvailable: 0, imagesRead: 0 };
  const pick = (patch: Partial<ReextractBannerInput>) => pickReextractBannerCauses({ ...base, ...patch });

  it('says the refresh is still running whatever the outcome', () => {
    assert.deepEqual(pick({ outcome: 'TIMED_OUT', lateResultPending: true }), ['causeRefreshRunning']);
  });
  it('joins the expired-links sentence to no provider reached only when links expired', () => {
    assert.deepEqual(pick({ outcome: 'NO_PROVIDER_REACHABLE', expiredLinks: 2 }), ['causeNoProvider', 'causeExpiredRefreshFailed']);
    assert.deepEqual(pick({ outcome: 'NO_PROVIDER_REACHABLE' }), ['causeNoProvider']);
  });
  it('maps every other refresh outcome to its own sentence', () => {
    assert.deepEqual(pick({ outcome: 'PROVIDER_OVER_QUOTA' }), ['causeOverQuota']);
    assert.deepEqual(pick({ outcome: 'TIMED_OUT' }), ['causeTimedOut']);
    assert.deepEqual(pick({ outcome: 'COOLDOWN' }), ['causeCooldown']);
    assert.deepEqual(pick({ outcome: 'NOT_SCRAPED' }), ['causeNotScraped']);
    assert.deepEqual(pick({ outcome: 'POST_UNAVAILABLE' }), ['causePostGone']);
    assert.deepEqual(pick({ outcome: 'IN_FLIGHT' }), ['causeInFlight']);
  });
  it('says the images did not heal when a provider answered, nothing was saved and links are still expired', () => {
    assert.deepEqual(pick({ outcome: 'REFRESHED', saved: false, expiredLinks: 1 }), ['causeNotHealed']);
  });
  it('says some images could not be loaded when nothing else explains an unread image', () => {
    const images = [cover('READ'), slide(1, 'NOT_READ_UNAVAILABLE')];
    assert.deepEqual(pick({ outcome: 'REFRESHED', saved: true, images, imagesAvailable: 2, imagesRead: 1 }), ['causeImagesUnavailable']);
    assert.deepEqual(pick({ images: [slide(1, 'NOT_READ_EXPIRED')] }), ['causeImagesUnavailable']);
  });
  it('falls back to the counts for a job with no image list', () => {
    assert.deepEqual(pick({ imagesAvailable: 3, imagesRead: 2 }), ['causeImagesUnavailable']);
    assert.deepEqual(pick({ imagesAvailable: 3, imagesRead: 3 }), []);
  });
  it('gives no cause when every image was read, or only over-cap slides are missing', () => {
    assert.deepEqual(pick({ images: [cover('READ'), slide(1, 'READ')], imagesAvailable: 2, imagesRead: 2 }), []);
    assert.deepEqual(pick({ images: [cover('READ'), slide(1, 'NOT_SENT_OVER_CAP')], imagesAvailable: 2, imagesRead: 1 }), []);
  });
});
