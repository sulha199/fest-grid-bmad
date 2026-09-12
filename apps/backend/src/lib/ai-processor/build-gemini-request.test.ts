import test from 'node:test';
import * as assert from 'node:assert';
import { buildGeminiExtractionRequest, geminiExtractionResponseSchema } from './build-gemini-request.js';
import { type ProcessingJobMessage } from '@festgrid/domain/posts';

test('buildGeminiExtractionRequest unit tests', async (t) => {
  const originalFetch = globalThis.fetch;

  t.afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  await t.test('Case A: image-absent path uses text-only contents', async () => {
    const message: ProcessingJobMessage = {
      postId: 'post-1',
      accountId: 'account-1',
      content: 'This is an awesome concert on August 15th!',
      postUrl: 'https://test.com/post1',
      publishedAt: '2026-08-10T12:00:00Z'
    };

    const result = await buildGeminiExtractionRequest(message);

    assert.strictEqual(result.request.contents, message.content);
    assert.strictEqual(result.request.responseMimeType, 'application/json');
    assert.ok(result.request.systemInstruction?.includes('PERFORMANCE')); // verify systemInstruction exists and lists types
    assert.strictEqual(result.imageBytes, undefined);
    assert.strictEqual(result.imageContentType, undefined);
  });

  await t.test('Case B: image-present success path uses multi-part contents with base64 data', async () => {
    const message: ProcessingJobMessage = {
      postId: 'post-2',
      accountId: 'account-2',
      content: 'Multi-part event caption!',
      imageUrl: 'https://test.com/poster.png',
      postUrl: 'https://test.com/post2',
      publishedAt: '2026-08-10T12:00:00Z'
    };

    // Mock fetch
    globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
      return {
        ok: true,
        headers: {
          get: (name: string) => (name.toLowerCase() === 'content-type' ? 'image/png' : null)
        },
        arrayBuffer: async () => Buffer.from('fake-image-bytes')
      } as any;
    };

    const result = await buildGeminiExtractionRequest(message);

    assert.ok(Array.isArray(result.request.contents));
    assert.strictEqual(result.request.contents.length, 2);
    assert.strictEqual(result.request.contents[0].text, message.content);
    assert.strictEqual(result.request.contents[1].inlineData.mimeType, 'image/png');
    assert.strictEqual(result.request.contents[1].inlineData.data, Buffer.from('fake-image-bytes').toString('base64'));
    assert.deepEqual(result.imageBytes, Buffer.from('fake-image-bytes'));
    assert.strictEqual(result.imageContentType, 'image/png');
  });

  await t.test('Case C: image-fetch-failure path falls back to text-only contents', async () => {
    const message: ProcessingJobMessage = {
      postId: 'post-3',
      accountId: 'account-3',
      content: 'Failed fetch image caption!',
      imageUrl: 'https://test.com/broken.png',
      postUrl: 'https://test.com/post3',
      publishedAt: '2026-08-10T12:00:00Z'
    };

    // Mock fetch to return a failure status
    globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
      return {
        ok: false,
        status: 404
      } as any;
    };

    const result = await buildGeminiExtractionRequest(message);

    assert.strictEqual(result.request.contents, message.content);
    assert.strictEqual(result.imageBytes, undefined);
    assert.strictEqual(result.imageContentType, undefined);
  });

  await t.test('Case D: systemInstruction contains the publish-date anchor and instructions', async () => {
    const message: ProcessingJobMessage = {
      postId: 'post-4',
      accountId: 'account-4',
      content: 'Get up to 20% off all your beauty faves from 27-30 Aug.',
      postUrl: 'https://test.com/post4',
      publishedAt: '2026-08-27T15:30:00Z'
    };

    const result = await buildGeminiExtractionRequest(message);

    assert.ok(result.request.systemInstruction?.includes('2026-08-27'));
    assert.ok(result.request.systemInstruction?.includes('anchor for date and year inference'));
    assert.ok(result.request.systemInstruction?.includes('never infer a year that would place the event further in the past'));
  });

  await t.test('Case E: uses ownerDisplayName as account name metadata in prompt', async () => {
    const message: ProcessingJobMessage = {
      postId: 'post-5',
      accountId: 'account-5',
      content: 'Event announcement!',
      postUrl: 'https://test.com/post5',
      publishedAt: '2026-08-27T15:30:00Z',
      ownerDisplayName: 'Fest Daily Plaza',
      ownerUsername: 'fest.daily'
    };

    const result = await buildGeminiExtractionRequest(message);

    assert.strictEqual(
      result.request.contents,
      'Account Name Metadata: "Fest Daily Plaza"\nPost Content:\n"Event announcement!"'
    );
    assert.ok(result.request.systemInstruction?.includes('8. Use the provided account name metadata (if present) to help disambiguate'));
  });

  await t.test('Case F: uses ownerUsername as account name metadata fallback in prompt', async () => {
    const message: ProcessingJobMessage = {
      postId: 'post-6',
      accountId: 'account-6',
      content: 'Event announcement 2!',
      postUrl: 'https://test.com/post6',
      publishedAt: '2026-08-27T15:30:00Z',
      ownerUsername: 'fest.daily'
    };

    const result = await buildGeminiExtractionRequest(message);

    assert.strictEqual(
      result.request.contents,
      'Account Name Metadata: "fest.daily"\nPost Content:\n"Event announcement 2!"'
    );
  });

  await t.test('Case G: systemInstruction contains private-contact classification guidance', async () => {
    const message: ProcessingJobMessage = {
      postId: 'post-7',
      accountId: 'account-7',
      content: 'Call us at 0812-3456-7890 or wa.me/6281234567890 for details.',
      postUrl: 'https://test.com/post7',
      publishedAt: '2026-08-27T15:30:00Z'
    };

    const result = await buildGeminiExtractionRequest(message);

    assert.ok(result.request.systemInstruction?.includes('hasPrivateContact'));
    assert.ok(result.request.systemInstruction?.includes('wa.me'));
    assert.ok(result.request.systemInstruction?.includes('private/individual'));
  });

  await t.test('Case H: systemInstruction contains the performer-contact/photo exclusion instruction', async () => {
    const message: ProcessingJobMessage = {
      postId: 'post-8',
      accountId: 'account-8',
      content: 'Live music by DJ Nova! Book this artist via 0812-3456-7890.',
      postUrl: 'https://test.com/post8',
      publishedAt: '2026-08-27T15:30:00Z'
    };

    const result = await buildGeminiExtractionRequest(message);

    assert.ok(result.request.systemInstruction?.includes('performer'));
    assert.ok(result.request.systemInstruction?.includes('must never be copied'));
  });

  // ---- Story 3.6l: multi-image (carousel/Sidecar) cases --------------------------------
  // Real `laridijogja` carousel fixture from
  // _bmad-output/implementation-artifacts/backlog/IDEA-001-multislide-extraction.md:
  // cover displayUrl + the 4 `childPosts[].displayUrl` values (slide order, cover excluded).
  // fetch is mocked per-URL below; the exact signed URL text is quoted verbatim from the
  // fixture purely for authenticity (they are stale by now and never actually reach Instagram).
  const coverUrl =
    'https://scontent-muc2-1.cdninstagram.com/v/t51.82787-15/789539050_17942805267298448_1496147388261312974_n.heic?stp=dst-jpg_e35_tt6&_nc_cat=107&ig_cache_key=Mzk3NDM0MjMzMzg4OTc2OTQ3OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTQ0MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=0pGxhDZ-_aEQ7kNvwEhYfAp&_nc_oc=AdpuJYZFerQa4LpaLKVCykX7x9DDg3sGcVaGIEZLizD4rGfxdqhE_ms1f4nY5sOTQb0&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-muc2-1.cdninstagram.com&_nc_gid=B6Am7kzFYi1ecWTSFDOH7w&_nc_ss=7a22e&oh=00_AQJtm51W424JReIFFkFIkliPdyoaGGIm2jSC8pAd8enVCg&oe=6AAB0FE9';
  const slide1Url =
    'https://scontent-muc2-1.cdninstagram.com/v/t51.82787-15/787796386_17942805276298448_8231738632001946622_n.heic?stp=dst-jpg_e35_tt6&_nc_cat=107&ig_cache_key=Mzk3NDM0MjMzNjc4MzY2NDk0NA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTQ0MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=oySK5Z-24_EQ7kNvwHeZPjH&_nc_oc=Adr3TkZZUuXDwDgknKIDsKUAFDVDYFR6YhJjAQXc0CWSnAJd-8K3Ha4JxjcYPwTAeD0&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-muc2-1.cdninstagram.com&_nc_gid=B6Am7kzFYi1ecWTSFDOH7w&_nc_ss=7a22e&oh=00_AQKXGRGO3bDoY7KgWAtpKo8LWxFgETueEkmMtJIE1KNkPw&oe=6AAAF6F0';
  const slide2Url =
    'https://scontent-muc2-1.cdninstagram.com/v/t51.82787-15/789013093_17942805297298448_973683974847290570_n.heic?stp=dst-jpg_e35_tt6&_nc_cat=108&ig_cache_key=Mzk3NDM0MjMzODk1NjI2NTMzMA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTQ0MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=5tJlWCvvOWQQ7kNvwEJs8JG&_nc_oc=Ado9sC0ycYpI8pfPwxpoh29EXo4AWC7l9miyflHB-U4zY39AKVGSwOaYdo1Kk557NCQ&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-muc2-1.cdninstagram.com&_nc_gid=B6Am7kzFYi1ecWTSFDOH7w&_nc_ss=7a22e&oh=00_AQIbGwyRAt-tHCn5TLqnwG8Lo_jJNQ03CFwogYsP4IjVMQ&oe=6AAB0B73';
  const slide3Url =
    'https://scontent-muc2-1.cdninstagram.com/v/t51.82787-15/787957175_17942805306298448_6459946509376416934_n.heic?stp=dst-jpg_e35_tt6&_nc_cat=109&ig_cache_key=Mzk3NDM0MjM0MDk0NDQwMzYzOA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTQ0MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BUsykvq1aVoQ7kNvwH5uiiw&_nc_oc=Ado349ev2_N50SfKBtMrZXiVnnHWWhTcOPq47fSXVidO6R1aHUCn-5uctSWdAkZlKEw&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-muc2-1.cdninstagram.com&_nc_gid=B6Am7kzFYi1ecWTSFDOH7w&_nc_ss=7a22e&oh=00_AQJyBSxUKMCI9DwJj3VWPwnzj3P9S0mr2yYqI4CkEVWr1w&oe=6AAB1B8F';
  const slide4Url =
    'https://scontent-muc2-1.cdninstagram.com/v/t51.82787-15/788778670_17942805315298448_5687089647234921910_n.heic?stp=dst-jpg_e35_tt6&_nc_cat=102&ig_cache_key=Mzk3NDM0MjM0MzE3NTg4MzE4Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTQ0MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=GFfUkUWzd2MQ7kNvwF6NEif&_nc_oc=AdpeZpiCohdouJHFuPl9gcWyzFqPy6vLgq0fTkcfjx0Ox3BuY_zdtyvfMDYVGtuSPg4&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-muc2-1.cdninstagram.com&_nc_gid=B6Am7kzFYi1ecWTSFDOH7w&_nc_ss=7a22e&oh=00_AQKgm1mWPw6lCusnc8P_yPlKEa3EhlC2xm7X2FiFBdGh_Q&oe=6AAAF5A9';

  const multiImageMessage = (additionalImageUrls: string[]): ProcessingJobMessage => ({
    postId: 'post-carousel-1',
    accountId: 'account-carousel-1',
    content: 'Rangkuman event lari di Jogja 2026 (schedule on later slides)',
    imageUrl: coverUrl,
    postUrl: 'https://www.instagram.com/p/DcntzF0mB7z/',
    publishedAt: '2026-08-29T10:24:17Z',
    additionalImageUrls
  });

  // Ordered fetch mock over [cover, ...slides]; returns distinct bytes per call index so each
  // part is distinguishable, and can force a failure at a specific index (0=cover, 1..N=slides).
  const installOrderedFetchMock = (opts: { failIndex?: number; failAsThrow?: boolean } = {}) => {
    let callIndex = 0;
    globalThis.fetch = async () => {
      const cur = callIndex;
      callIndex++;
      if (cur === opts.failIndex) {
        if (opts.failAsThrow) throw new Error('slide fetch threw');
        return { ok: false, status: 403 } as any;
      }
      const contentType = cur === 0 ? 'image/png' : 'image/jpeg';
      return {
        ok: true,
        headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? contentType : null) },
        arrayBuffer: async () => Buffer.from(`carousel-bytes-${cur}`)
      } as any;
    };
    return () => callIndex;
  };

  await t.test('Case I: multi-image success batches cover + additional slides into one request (AC1)', async () => {
    installOrderedFetchMock();
    const msg = multiImageMessage([slide1Url, slide2Url, slide3Url, slide4Url]);
    const result = await buildGeminiExtractionRequest(msg);

    assert.ok(Array.isArray(result.request.contents));
    // [text, cover, slide1, slide2, slide3, slide4]
    assert.strictEqual(result.request.contents.length, 6);
    assert.strictEqual(result.request.contents[0].text, msg.content);
    assert.strictEqual(result.request.contents[1].inlineData.mimeType, 'image/png');
    assert.strictEqual(result.request.contents[1].inlineData.data, Buffer.from('carousel-bytes-0').toString('base64'));
    assert.strictEqual(result.request.contents[2].inlineData.mimeType, 'image/jpeg');
    assert.strictEqual(result.request.contents[2].inlineData.data, Buffer.from('carousel-bytes-1').toString('base64'));
    assert.strictEqual(result.request.contents[3].inlineData.data, Buffer.from('carousel-bytes-2').toString('base64'));
    assert.strictEqual(result.request.contents[4].inlineData.data, Buffer.from('carousel-bytes-3').toString('base64'));
    assert.strictEqual(result.request.contents[5].inlineData.data, Buffer.from('carousel-bytes-4').toString('base64'));
    // Task 6: return value still exposes ONLY the cover image's bytes/type — never a slide's.
    assert.deepStrictEqual(result.imageBytes, Buffer.from('carousel-bytes-0'));
    assert.strictEqual(result.imageContentType, 'image/png');
  });

  await t.test('Case J: more additional slides than MAX_CAROUSEL_IMAGES are capped in order (AC1)', async () => {
    const originalMaxCarouselImages = process.env.MAX_CAROUSEL_IMAGES;
    process.env.MAX_CAROUSEL_IMAGES = '2';
    try {
      const callCount = installOrderedFetchMock();
      const result = await buildGeminiExtractionRequest(multiImageMessage([slide1Url, slide2Url, slide3Url, slide4Url]));

      // text + cover + 2 capped slides
      assert.strictEqual(result.request.contents.length, 4);
      assert.strictEqual(result.request.contents[2].inlineData.data, Buffer.from('carousel-bytes-1').toString('base64'));
      assert.strictEqual(result.request.contents[3].inlineData.data, Buffer.from('carousel-bytes-2').toString('base64'));
      // Only cover + 2 slides were fetched (slide3/slide4 not fetched)
      assert.strictEqual(callCount(), 3);
    } finally {
      if (originalMaxCarouselImages === undefined) delete process.env.MAX_CAROUSEL_IMAGES;
      else process.env.MAX_CAROUSEL_IMAGES = originalMaxCarouselImages;
    }
  });

  await t.test('Case K: a failing middle slide is skipped, cover and other slides survive, no text-only fallback (AC2)', async () => {
    // failIndex 4 => cover=0, slide1=1, slide2=2, slide3=3, slide4=4 → the LAST slide fails.
    // This deterministically exercises the per-slide catch while keeping the cover intact.
    installOrderedFetchMock({ failIndex: 4 });
    const msg = multiImageMessage([slide1Url, slide2Url, slide3Url, slide4Url]);
    const result = await buildGeminiExtractionRequest(msg);

    // text + cover + slide1 + slide2 + slide3 (slide4 omitted); NOT text-only
    assert.strictEqual(result.request.contents.length, 5);
    assert.strictEqual(result.request.contents[0].text, msg.content);
    assert.strictEqual(result.request.contents[1].inlineData.data, Buffer.from('carousel-bytes-0').toString('base64'));
    assert.strictEqual(result.request.contents[2].inlineData.data, Buffer.from('carousel-bytes-1').toString('base64'));
    assert.strictEqual(result.request.contents[3].inlineData.data, Buffer.from('carousel-bytes-2').toString('base64'));
    assert.strictEqual(result.request.contents[4].inlineData.data, Buffer.from('carousel-bytes-3').toString('base64'));
    assert.deepStrictEqual(result.imageBytes, Buffer.from('carousel-bytes-0'));
  });

  await t.test('Case K-2: a THROWN slide fetch is also skipped without wiping the cover (AC2)', async () => {
    installOrderedFetchMock({ failIndex: 2, failAsThrow: true });
    const msg = multiImageMessage([slide1Url, slide2Url, slide3Url, slide4Url]);
    const result = await buildGeminiExtractionRequest(msg);

    // slide2 (index 2 fetch) threw → omitted; cover + slide1 + slide3 + slide4 remain
    assert.strictEqual(result.request.contents.length, 5);
    assert.strictEqual(result.request.contents[0].text, msg.content);
    assert.strictEqual(result.request.contents[1].inlineData.data, Buffer.from('carousel-bytes-0').toString('base64'));
    assert.strictEqual(result.request.contents[2].inlineData.data, Buffer.from('carousel-bytes-1').toString('base64'));
    assert.strictEqual(result.request.contents[3].inlineData.data, Buffer.from('carousel-bytes-3').toString('base64'));
  });

  await t.test('Case L: systemInstruction contains multi-slide sequential guidance and self-report fields (AC3)', async () => {
    installOrderedFetchMock();
    const result = await buildGeminiExtractionRequest(multiImageMessage([slide1Url]));

    assert.ok(result.request.systemInstruction?.includes('sequential slides'));
    assert.ok(result.request.systemInstruction?.includes('merge'));
    assert.ok(result.request.systemInstruction?.includes('minScheduleCount'));
    assert.ok(result.request.systemInstruction?.includes('expectedScheduleNames'));
  });

  await t.test('Case M: geminiExtractionResponseSchema declares the new fields but not as required (AC4)', async () => {
    assert.ok('minScheduleCount' in geminiExtractionResponseSchema.properties);
    assert.ok('expectedScheduleNames' in geminiExtractionResponseSchema.properties);
    assert.ok(!geminiExtractionResponseSchema.required.includes('minScheduleCount'));
    assert.ok(!geminiExtractionResponseSchema.required.includes('expectedScheduleNames'));
  });
});
