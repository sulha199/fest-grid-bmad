import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  REEXTRACT_LOW_RESOLUTION_MAX_PX,
  countExpiredImageLinks,
  decideFreshImagesToSave,
  isLowResolutionImageUrl,
  readImageStpMaxSide,
  reextractRefreshReasons,
} from './reextract-image-refresh.js';

// Story 10.6 -- the refresh trigger and the save rule (PRD 3.9.3 FR125; design decisions 5 and 6).

const NOW = new Date('2026-11-12T10:00:00.000Z');
const hexOf = (d: Date) => Math.floor(d.getTime() / 1000).toString(16);
const inDays = (n: number) => new Date(NOW.getTime() + n * 86_400_000);
/** A fake signed link: `size` is the `stp` size token ('640' gives s640x640), `file` tells links apart. */
const link = (file: string, expires: Date | null, size?: number) => {
  const query = [size ? `stp=dst-jpg_e35_s${size}x${size}_sh0.08_tt6` : null, expires ? `oe=${hexOf(expires)}` : null].filter(Boolean).join('&');
  return `https://cdn.example.com/${file}.jpg${query ? `?${query}` : ''}`;
};

describe('readImageStpMaxSide / isLowResolutionImageUrl', () => {
  it('reads the larger side of the s<W>x<H> token of the stp query', () => {
    assert.equal(readImageStpMaxSide('https://x.example/a.jpg?stp=dst-jpg_e35_s640x640_sh0.08_tt6&oe=1'), 640);
    assert.equal(readImageStpMaxSide('https://x.example/a.jpg?stp=dst-jpg_s320x480'), 480);
    assert.equal(readImageStpMaxSide('https://x.example/a.jpg?stp=dst-jpg_e35_s1080x1080'), 1080);
  });

  it('returns null for no url, an unparseable url, no stp, or an stp with no size token', () => {
    assert.equal(readImageStpMaxSide(null), null);
    assert.equal(readImageStpMaxSide(undefined), null);
    assert.equal(readImageStpMaxSide(''), null);
    assert.equal(readImageStpMaxSide('not a url'), null);
    assert.equal(readImageStpMaxSide('https://x.example/a.jpg?oe=1'), null);
    assert.equal(readImageStpMaxSide('https://x.example/a.jpg?stp=dst-jpg_e35_p640x640'), null);
  });

  it('calls 640 px and smaller low resolution, a bigger or unmarked image not', () => {
    assert.equal(REEXTRACT_LOW_RESOLUTION_MAX_PX, 640);
    assert.equal(isLowResolutionImageUrl(link('a', null, 640)), true);
    assert.equal(isLowResolutionImageUrl(link('a', null, 320)), true);
    assert.equal(isLowResolutionImageUrl(link('a', null, 1080)), false);
    assert.equal(isLowResolutionImageUrl(link('a', null)), false);
    assert.equal(isLowResolutionImageUrl(null), false);
  });
});

describe('reextractRefreshReasons', () => {
  const settled = { platformPostType: 'p', additionalImageUrls: null };

  it('is empty when the cover and slides are valid and full size', () => {
    assert.deepEqual(reextractRefreshReasons({ ...settled, imageUrl: link('c', inDays(3)), additionalImageUrls: [link('s', inDays(3))] }, NOW), []);
    assert.deepEqual(reextractRefreshReasons({ ...settled, imageUrl: link('c', null) }, NOW), []);
  });

  it('is empty for a text-only post whose type is known', () => {
    assert.deepEqual(reextractRefreshReasons({ platformPostType: 'p', imageUrl: null, additionalImageUrls: [] }, NOW), []);
    assert.deepEqual(reextractRefreshReasons({ platformPostType: 'p', additionalImageUrls: null }, NOW), []);
  });

  it('names an expired cover, from its own link or the stored expiry', () => {
    assert.deepEqual(reextractRefreshReasons({ ...settled, imageUrl: link('c', inDays(-1)) }, NOW), ['COVER_EXPIRED']);
    assert.deepEqual(reextractRefreshReasons({ ...settled, imageUrl: link('c', null), imageUrlExpiresAt: inDays(-1) }, NOW), ['COVER_EXPIRED']);
  });

  it('names slides listed with no cover', () => {
    assert.deepEqual(reextractRefreshReasons({ ...settled, imageUrl: null, additionalImageUrls: [link('s', inDays(3))] }, NOW), ['COVER_MISSING']);
  });

  it('names an expired slide', () => {
    assert.deepEqual(
      reextractRefreshReasons({ ...settled, imageUrl: link('c', inDays(3)), additionalImageUrls: [link('s1', inDays(3)), link('s2', inDays(-2))] }, NOW),
      ['SLIDES_EXPIRED']
    );
  });

  it('names a low-resolution cover (s640x640 or smaller in stp)', () => {
    assert.deepEqual(reextractRefreshReasons({ ...settled, imageUrl: link('c', inDays(3), 640) }, NOW), ['COVER_LOW_RESOLUTION']);
  });

  it('names slides that are unknown: no post type and no slide list', () => {
    assert.deepEqual(reextractRefreshReasons({ platformPostType: null, imageUrl: link('c', inDays(3)), additionalImageUrls: null }, NOW), ['SLIDES_UNKNOWN']);
    assert.deepEqual(reextractRefreshReasons({ imageUrl: link('c', inDays(3)) }, NOW), ['SLIDES_UNKNOWN']);
  });

  it('does not call slides unknown when the post type or the slide list is stored', () => {
    assert.deepEqual(reextractRefreshReasons({ platformPostType: null, imageUrl: link('c', inDays(3)), additionalImageUrls: [] }, NOW), []);
    assert.deepEqual(reextractRefreshReasons({ platformPostType: 'reel', imageUrl: link('c', inDays(3)), additionalImageUrls: null }, NOW), []);
  });

  it('names a missing caption first when asked (a curator post, or a URL not in the database), whatever the images are', () => {
    assert.deepEqual(reextractRefreshReasons({ ...settled, imageUrl: link('c', inDays(3)) }, NOW, { captionMissing: true }), ['CAPTION_MISSING']);
    assert.deepEqual(
      reextractRefreshReasons({ ...settled, imageUrl: link('c', inDays(-1)) }, NOW, { captionMissing: true }),
      ['CAPTION_MISSING', 'COVER_EXPIRED']
    );
    assert.deepEqual(reextractRefreshReasons({}, NOW, { captionMissing: false }), ['SLIDES_UNKNOWN']);
  });

  it('reports every reason that applies, in a stable order', () => {
    assert.deepEqual(
      reextractRefreshReasons({ platformPostType: null, imageUrl: link('c', inDays(-1), 640), additionalImageUrls: null }, NOW),
      ['COVER_EXPIRED', 'COVER_LOW_RESOLUTION', 'SLIDES_UNKNOWN']
    );
    assert.deepEqual(
      reextractRefreshReasons({ ...settled, imageUrl: link('c', inDays(-1)), additionalImageUrls: [link('s', inDays(-1))] }, NOW),
      ['COVER_EXPIRED', 'SLIDES_EXPIRED']
    );
  });
});

describe('countExpiredImageLinks', () => {
  it('counts the expired cover and slides', () => {
    assert.equal(countExpiredImageLinks({ imageUrl: link('c', inDays(-1)), additionalImageUrls: [link('a', inDays(-1)), link('b', inDays(2))] }, NOW), 2);
    assert.equal(countExpiredImageLinks({ imageUrl: link('c', inDays(2)), additionalImageUrls: [link('a', inDays(2))] }, NOW), 0);
    assert.equal(countExpiredImageLinks({}, NOW), 0);
  });
});

describe('decideFreshImagesToSave', () => {
  const stored = { imageUrl: link('old-cover', inDays(-1)), additionalImageUrls: [link('old-1', inDays(-1))] };

  it('saves a fresh cover with its own expiry, and the fresh slides', () => {
    const freshCover = link('new-cover', inDays(4));
    const result = decideFreshImagesToSave({ stored, fresh: { imageUrl: freshCover, additionalImageUrls: [link('new-1', inDays(4)), link('new-2', inDays(4))] }, now: NOW });
    assert.deepEqual(result, {
      imageUrl: freshCover,
      imageUrlExpiresAt: inDays(4), // the link's own `oe` timestamp, whole seconds
      additionalImageUrls: [link('new-1', inDays(4)), link('new-2', inDays(4))],
    });
  });

  it('stores a null expiry for a fresh cover that carries none', () => {
    const result = decideFreshImagesToSave({ stored: {}, fresh: { imageUrl: link('c', null) }, now: NOW });
    assert.deepEqual(result, { imageUrl: link('c', null), imageUrlExpiresAt: null });
  });

  it('never saves an empty slide list over a non-empty one, or a missing cover', () => {
    assert.equal(decideFreshImagesToSave({ stored, fresh: { imageUrl: null, additionalImageUrls: [] }, now: NOW }), null);
    assert.equal(decideFreshImagesToSave({ stored, fresh: { imageUrl: '', additionalImageUrls: null } , now: NOW }), null);
    assert.equal(decideFreshImagesToSave({ stored, fresh: {}, now: NOW }), null);
    assert.equal(decideFreshImagesToSave({ stored, fresh: { additionalImageUrls: ['', ''] }, now: NOW }), null);
  });

  it('saves nothing when the fresh links are the stored ones', () => {
    const same = { imageUrl: link('c', inDays(3)), additionalImageUrls: [link('a', inDays(3)), link('b', inDays(3))] };
    assert.equal(decideFreshImagesToSave({ stored: same, fresh: { ...same }, now: NOW }), null);
  });

  it('does not save a cover that is already expired', () => {
    assert.equal(decideFreshImagesToSave({ stored: {}, fresh: { imageUrl: link('c', inDays(-1)) }, now: NOW }), null);
  });

  it('never replaces a valid full-size cover with a 640 px one', () => {
    const full = { imageUrl: link('full', inDays(3)) };
    assert.equal(decideFreshImagesToSave({ stored: full, fresh: { imageUrl: link('low', inDays(4), 640) }, now: NOW }), null);
    // an unmarked stored cover counts as full size too
    assert.equal(decideFreshImagesToSave({ stored: { imageUrl: link('unmarked', null) }, fresh: { imageUrl: link('low', inDays(4), 640) }, now: NOW }), null);
  });

  it('replaces an expired full-size cover with a 640 px one (nothing else is readable), and a 640 px one with another', () => {
    const lowFresh = link('low', inDays(4), 640);
    assert.equal(decideFreshImagesToSave({ stored: { imageUrl: link('dead-full', inDays(-1)) }, fresh: { imageUrl: lowFresh }, now: NOW })?.imageUrl, lowFresh);
    assert.equal(decideFreshImagesToSave({ stored: { imageUrl: link('valid-low', inDays(1), 640) }, fresh: { imageUrl: lowFresh }, now: NOW })?.imageUrl, lowFresh);
  });

  it('replaces a full-size cover with a full-size one, and a 640 px cover with a full-size one', () => {
    const fresh = link('fresh-full', inDays(4));
    assert.equal(decideFreshImagesToSave({ stored: { imageUrl: link('valid-full', inDays(3)) }, fresh: { imageUrl: fresh }, now: NOW })?.imageUrl, fresh);
    assert.equal(decideFreshImagesToSave({ stored: { imageUrl: link('valid-low', inDays(3), 640) }, fresh: { imageUrl: fresh }, now: NOW })?.imageUrl, fresh);
  });

  it('never replaces valid full-size slides with 640 px ones', () => {
    const fullSlides = { imageUrl: link('c', inDays(3)), additionalImageUrls: [link('f1', inDays(3)), link('f2', inDays(3))] };
    assert.equal(decideFreshImagesToSave({ stored: fullSlides, fresh: { additionalImageUrls: [link('l1', inDays(4), 640)] }, now: NOW }), null);
  });

  it('replaces expired or low-resolution stored slides with 640 px ones, and any slides when none are stored', () => {
    const lowFresh = [link('l1', inDays(4), 640)];
    assert.deepEqual(decideFreshImagesToSave({ stored: { additionalImageUrls: [link('dead', inDays(-1))] }, fresh: { additionalImageUrls: lowFresh }, now: NOW }), { additionalImageUrls: lowFresh });
    assert.deepEqual(decideFreshImagesToSave({ stored: { additionalImageUrls: [link('low', inDays(3), 640)] }, fresh: { additionalImageUrls: lowFresh }, now: NOW }), { additionalImageUrls: lowFresh });
    assert.deepEqual(decideFreshImagesToSave({ stored: { additionalImageUrls: null }, fresh: { additionalImageUrls: lowFresh }, now: NOW }), { additionalImageUrls: lowFresh });
    assert.deepEqual(decideFreshImagesToSave({ stored: { additionalImageUrls: [] }, fresh: { additionalImageUrls: lowFresh }, now: NOW }), { additionalImageUrls: lowFresh });
  });

  it('replaces valid full-size slides with different full-size ones', () => {
    const fresh = [link('n1', inDays(4)), link('n2', inDays(4))];
    assert.deepEqual(decideFreshImagesToSave({ stored: { additionalImageUrls: [link('o1', inDays(3))] }, fresh: { additionalImageUrls: fresh }, now: NOW }), { additionalImageUrls: fresh });
  });

  it('treats a same-length but different list as new', () => {
    const fresh = [link('n1', inDays(4))];
    assert.deepEqual(decideFreshImagesToSave({ stored: { additionalImageUrls: [link('o1', inDays(-1))] }, fresh: { additionalImageUrls: fresh }, now: NOW }), { additionalImageUrls: fresh });
  });

  it('never replaces a stored slide list with a SHORTER fresh one, even when the stored links are dead; an equal or longer list replaces', () => {
    const stored = { additionalImageUrls: [fx_a(1), fx_a(2), fx_a(3)] };
    function fx_a(n: number) { return link(`stored-${n}`, inDays(-1)); }
    assert.equal(decideFreshImagesToSave({ stored, fresh: { additionalImageUrls: [link('n1', inDays(4)), link('n2', inDays(4))] }, now: NOW }), null);
    const equal = [link('e1', inDays(4)), link('e2', inDays(4)), link('e3', inDays(4))];
    assert.deepEqual(decideFreshImagesToSave({ stored, fresh: { additionalImageUrls: equal }, now: NOW }), { additionalImageUrls: equal });
    const longer = [...equal, link('e4', inDays(4))];
    assert.deepEqual(decideFreshImagesToSave({ stored, fresh: { additionalImageUrls: longer }, now: NOW }), { additionalImageUrls: longer });
    // the cover is judged on its own: a shorter slide list does not stop a fresh cover from being saved
    const result = decideFreshImagesToSave({ stored: { imageUrl: link('dead', inDays(-1)), ...stored }, fresh: { imageUrl: link('new', inDays(4)), additionalImageUrls: [link('n1', inDays(4))] }, now: NOW });
    assert.deepEqual(Object.keys(result ?? {}).sort(), ['imageUrl', 'imageUrlExpiresAt']);
  });
});
