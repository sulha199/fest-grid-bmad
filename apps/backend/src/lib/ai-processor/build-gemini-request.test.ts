import test from 'node:test';
import * as assert from 'node:assert';
import { buildGeminiExtractionRequest, geminiExtractionResponseSchema } from './build-gemini-request.js';
import { type ProcessingJobMessage } from '@festgrid/domain/posts';
import { setDetectAndBlurFacesSeam, detectAndBlurFacesSeam } from './detect-and-blur-faces.js';

// Story 3.20 (Task 6.1) -- BLUR_FACES_BEFORE_AI now defaults ON (env.ts), but this file's tests
// never pass options.blurFacesBeforeAi UNLESS a case below opts in explicitly (per Task 6.2),
// so the default-on env var is irrelevant here: shouldBlur in build-gemini-request.ts is gated
// on the OPTIONS argument being present, never on the env var directly (the env var only decides
// whether process-ai-job.ts passes the option at all -- see process-ai-job.face-blur-before-ai.test.ts).

test('buildGeminiExtractionRequest unit tests', async (t) => {
  const originalFetch = globalThis.fetch;
  const originalDetectAndBlurFacesSeam = detectAndBlurFacesSeam;

  t.afterEach(() => {
    globalThis.fetch = originalFetch;
    setDetectAndBlurFacesSeam(originalDetectAndBlurFacesSeam);
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
    assert.ok(result.request.systemInstruction?.includes('Use the provided account name metadata (if present) to help disambiguate'));
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
    // Story 3.6s — minScheduleCount/expectedScheduleNames moved onto the nested per-event item
    // schema (events.items.properties), not the post-level wrapper, since they are per-event
    // self-reported completeness signals.
    const eventItemSchema: any = (geminiExtractionResponseSchema.properties as any).events.items;
    assert.ok('minScheduleCount' in eventItemSchema.properties);
    assert.ok('expectedScheduleNames' in eventItemSchema.properties);
    assert.ok(!eventItemSchema.required.includes('minScheduleCount'));
    assert.ok(!eventItemSchema.required.includes('expectedScheduleNames'));
  });

  await t.test('Case N (Story 3.6s, AC1/AC2/AC3): geminiExtractionResponseSchema declares the events[] wrapper and post-level grouping fields', async () => {
    const props: any = geminiExtractionResponseSchema.properties;
    assert.ok('isEvent' in props);
    assert.ok('events' in props);
    assert.strictEqual(props.events.type, 'ARRAY');
    assert.ok(!('maxItems' in props.events), 'events must NOT carry a JSON-schema maxItems (breaks the real Gemini API, see Dev Notes)');
    assert.ok('groupingReason' in props);
    assert.ok('groupingRationale' in props);
    assert.ok('minEventCount' in props);
    assert.ok('skippedItems' in props);
    assert.deepStrictEqual(geminiExtractionResponseSchema.required, ['isEvent', 'events']);

    const eventItemSchema: any = props.events.items;
    assert.ok('organizerHandle' in eventItemSchema.properties);
    const scheduleItemSchema: any = eventItemSchema.properties.schedules.items;
    assert.ok('applicableDaysOfWeek' in scheduleItemSchema.properties);
  });

  await t.test('Case O (Story 3.6s, AC2): system prompt encodes the ordered grouping rules and roundup cap', async () => {
    const message: ProcessingJobMessage = {
      postId: 'post-grouping',
      accountId: 'account-grouping',
      content: 'Multi-event grouping prompt check',
      postUrl: 'https://test.com/post-grouping',
      publishedAt: '2026-08-10T12:00:00Z'
    };

    const result = await buildGeminiExtractionRequest(message);
    const prompt = result.request.systemInstruction ?? '';

    assert.ok(prompt.includes('GROUPING DECISION'));
    assert.ok(prompt.includes('program-lineup'));
    assert.ok(prompt.includes('dependent-stages'));
    assert.ok(prompt.includes('separate-events'));
    assert.ok(prompt.includes('ROUNDUP HANDLING'));
    assert.ok(prompt.includes('skippedItems'));
    assert.ok(prompt.includes('organizerHandle'));
    assert.ok(prompt.includes('applicableDaysOfWeek'));
  });

  await t.test('Case P (Story 3.6m, AC1/AC2): geminiExtractionResponseSchema declares hasFaceImage/faceImageCount at the root, optional, and the prompt self-reports both in the once-per-post block', async () => {
    const props: any = geminiExtractionResponseSchema.properties;
    assert.ok('hasFaceImage' in props);
    assert.ok('faceImageCount' in props);
    assert.strictEqual(props.hasFaceImage.type, 'BOOLEAN');
    assert.strictEqual(props.faceImageCount.type, 'NUMBER');
    assert.deepStrictEqual(geminiExtractionResponseSchema.required, ['isEvent', 'events']);
    assert.ok(!geminiExtractionResponseSchema.required.includes('hasFaceImage'));
    assert.ok(!geminiExtractionResponseSchema.required.includes('faceImageCount'));

    // Must NOT be nested per-event (that is where minScheduleCount/expectedScheduleNames live).
    const eventItemSchema: any = props.events.items;
    assert.ok(!('hasFaceImage' in eventItemSchema.properties));
    assert.ok(!('faceImageCount' in eventItemSchema.properties));

    const message: ProcessingJobMessage = {
      postId: 'post-face-signal',
      accountId: 'account-face-signal',
      content: 'Face signal prompt check',
      postUrl: 'https://test.com/post-face-signal',
      publishedAt: '2026-08-10T12:00:00Z'
    };
    const result = await buildGeminiExtractionRequest(message);
    const prompt = result.request.systemInstruction ?? '';

    assert.ok(prompt.includes('hasFaceImage'));
    assert.ok(prompt.includes('faceImageCount'));
    // Belongs in the "once for the whole post" block, not the per-event numbered list.
    const onceBlockIndex = prompt.indexOf('Also report, once for the whole post');
    const hasFaceImageIndex = prompt.indexOf('hasFaceImage', onceBlockIndex);
    assert.ok(onceBlockIndex !== -1 && hasFaceImageIndex > onceBlockIndex);
  });

  // Story 3.20 -- options.blurFacesBeforeAi tests (AC1/AC3/AC4/AC5/AC8).

  await t.test('Case Q: isOwnerOptedIn true -> detectAndBlurFacesSeam never called, byte-for-byte identical to no-options call (AC4)', async () => {
    let detectCalled = false;
    setDetectAndBlurFacesSeam(async () => {
      detectCalled = true;
      return { buffer: Buffer.from('should-never-be-used'), faceCount: 9 };
    });

    const message: ProcessingJobMessage = {
      postId: 'post-blur-optedin',
      accountId: 'account-blur-optedin',
      content: 'Opted-in owner caption',
      imageUrl: 'https://test.com/poster.png',
      postUrl: 'https://test.com/post-blur-optedin',
      publishedAt: '2026-08-10T12:00:00Z'
    };
    globalThis.fetch = async () =>
      ({
        ok: true,
        headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'image/png' : null) },
        arrayBuffer: async () => Buffer.from('fake-image-bytes')
      }) as any;

    const withoutOptions = await buildGeminiExtractionRequest(message);
    const withOptedInOption = await buildGeminiExtractionRequest(message, { blurFacesBeforeAi: { isOwnerOptedIn: true } });

    assert.strictEqual(detectCalled, false);
    assert.deepStrictEqual(withOptedInOption.request.contents, withoutOptions.request.contents);
    assert.deepStrictEqual(withOptedInOption.imageBytes, withoutOptions.imageBytes);
    assert.strictEqual(withOptedInOption.blurredCoverImageBytes, undefined);
    assert.strictEqual(withOptedInOption.coverFaceCount, undefined);
  });

  await t.test('Case R: isOwnerOptedIn false -> cover is blurred, blurred bytes used in the request, original bytes still in imageBytes (AC1/AC5)', async () => {
    setDetectAndBlurFacesSeam(async (buffer: Buffer) => {
      assert.deepStrictEqual(buffer, Buffer.from('fake-image-bytes'));
      return { buffer: Buffer.from('blurred-cover-bytes'), faceCount: 2 };
    });

    const message: ProcessingJobMessage = {
      postId: 'post-blur-cover',
      accountId: 'account-blur-cover',
      content: 'Cover blur caption',
      imageUrl: 'https://test.com/poster.png',
      postUrl: 'https://test.com/post-blur-cover',
      publishedAt: '2026-08-10T12:00:00Z'
    };
    globalThis.fetch = async () =>
      ({
        ok: true,
        headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'image/png' : null) },
        arrayBuffer: async () => Buffer.from('fake-image-bytes')
      }) as any;

    const result = await buildGeminiExtractionRequest(message, { blurFacesBeforeAi: { isOwnerOptedIn: false } });

    assert.strictEqual(result.request.contents[1].inlineData.data, Buffer.from('blurred-cover-bytes').toString('base64'));
    // AC4: imageBytes always carries the ORIGINAL, unblurred bytes, even when blur ran.
    assert.deepStrictEqual(result.imageBytes, Buffer.from('fake-image-bytes'));
    assert.deepStrictEqual(result.blurredCoverImageBytes, Buffer.from('blurred-cover-bytes'));
    assert.strictEqual(result.coverFaceCount, 2);
  });

  await t.test('Case S: cover blur throws -> fails closed to text-only, never the original bytes (AC3)', async () => {
    setDetectAndBlurFacesSeam(async () => {
      throw new Error('blur failed');
    });

    const message: ProcessingJobMessage = {
      postId: 'post-blur-cover-fail',
      accountId: 'account-blur-cover-fail',
      content: 'Cover blur failure caption',
      imageUrl: 'https://test.com/poster.png',
      postUrl: 'https://test.com/post-blur-cover-fail',
      publishedAt: '2026-08-10T12:00:00Z'
    };
    globalThis.fetch = async () =>
      ({
        ok: true,
        headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'image/png' : null) },
        arrayBuffer: async () => Buffer.from('fake-image-bytes')
      }) as any;

    const result = await buildGeminiExtractionRequest(message, { blurFacesBeforeAi: { isOwnerOptedIn: false } });

    assert.strictEqual(result.request.contents, message.content);
    assert.strictEqual(result.blurredCoverImageBytes, undefined);
    assert.strictEqual(result.coverFaceCount, undefined);
  });

  await t.test('Case T: remaining time below the floor before the cover -> fails closed to text-only without calling the seam (AC3)', async () => {
    let detectCalled = false;
    setDetectAndBlurFacesSeam(async () => {
      detectCalled = true;
      return { buffer: Buffer.from('should-never-be-used'), faceCount: 1 };
    });

    const message: ProcessingJobMessage = {
      postId: 'post-blur-budget',
      accountId: 'account-blur-budget',
      content: 'Low time budget caption',
      imageUrl: 'https://test.com/poster.png',
      postUrl: 'https://test.com/post-blur-budget',
      publishedAt: '2026-08-10T12:00:00Z'
    };
    globalThis.fetch = async () =>
      ({
        ok: true,
        headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'image/png' : null) },
        arrayBuffer: async () => Buffer.from('fake-image-bytes')
      }) as any;

    const result = await buildGeminiExtractionRequest(message, {
      blurFacesBeforeAi: { isOwnerOptedIn: false, getRemainingTimeInMillis: () => 1000 } // below the 60000ms default floor
    });

    assert.strictEqual(detectCalled, false);
    assert.strictEqual(result.request.contents, message.content);
  });

  await t.test('Case U: per-slide blur applied up to the carousel cap, sequentially (AC1/AC8)', async () => {
    installOrderedFetchMock();
    const msg = multiImageMessage([slide1Url, slide2Url]);
    let inFlight = 0;
    let maxInFlight = 0;
    const blurredDataByOriginal = new Map<string, string>();
    setDetectAndBlurFacesSeam(async (buffer: Buffer) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight--;
      const blurredTag = `blurred-${buffer.toString()}`;
      blurredDataByOriginal.set(buffer.toString(), blurredTag);
      return { buffer: Buffer.from(blurredTag), faceCount: 1 };
    });

    const result = await buildGeminiExtractionRequest(msg, { blurFacesBeforeAi: { isOwnerOptedIn: false } });

    // text + cover + slide1 + slide2, all blurred -- AC8: detection never runs on two images at
    // once (sequential, not parallel).
    assert.strictEqual(result.request.contents.length, 4);
    assert.strictEqual(maxInFlight, 1, 'expected detectAndBlurFacesSeam to never overlap across images');
    assert.strictEqual(result.request.contents[1].inlineData.data, Buffer.from('blurred-carousel-bytes-0').toString('base64'));
    assert.strictEqual(result.request.contents[2].inlineData.data, Buffer.from('blurred-carousel-bytes-1').toString('base64'));
    assert.strictEqual(result.request.contents[3].inlineData.data, Buffer.from('blurred-carousel-bytes-2').toString('base64'));
    assert.deepStrictEqual(result.imageBytes, Buffer.from('carousel-bytes-0'));
    assert.deepStrictEqual(result.blurredCoverImageBytes, Buffer.from('blurred-carousel-bytes-0'));
  });

  await t.test('Case V: a slide blur failure drops only that slide, cover and other slides survive (AC3)', async () => {
    installOrderedFetchMock();
    const msg = multiImageMessage([slide1Url, slide2Url]);
    // cover=index0 bytes "carousel-bytes-0", slide1=index1 "carousel-bytes-1", slide2=index2 "carousel-bytes-2"
    setDetectAndBlurFacesSeam(async (buffer: Buffer) => {
      if (buffer.toString() === 'carousel-bytes-1') {
        throw new Error('slide blur failed');
      }
      return { buffer: Buffer.from(`blurred-${buffer.toString()}`), faceCount: 0 };
    });

    const result = await buildGeminiExtractionRequest(msg, { blurFacesBeforeAi: { isOwnerOptedIn: false } });

    // text + cover + slide2 (slide1 dropped); NOT text-only
    assert.strictEqual(result.request.contents.length, 3);
    assert.strictEqual(result.request.contents[1].inlineData.data, Buffer.from('blurred-carousel-bytes-0').toString('base64'));
    assert.strictEqual(result.request.contents[2].inlineData.data, Buffer.from('blurred-carousel-bytes-2').toString('base64'));
  });

  await t.test('Case W: remaining time below the floor before a slide -> that slide is dropped without calling the seam for it (AC3)', async () => {
    installOrderedFetchMock();
    const msg = multiImageMessage([slide1Url, slide2Url]);
    const seamCallArgs: string[] = [];
    setDetectAndBlurFacesSeam(async (buffer: Buffer) => {
      seamCallArgs.push(buffer.toString());
      return { buffer: Buffer.from(`blurred-${buffer.toString()}`), faceCount: 0 };
    });

    // Budget allows the cover (call 1) but drops below the floor for every image after it.
    let remaining = 70000;
    const result = await buildGeminiExtractionRequest(msg, {
      blurFacesBeforeAi: {
        isOwnerOptedIn: false,
        getRemainingTimeInMillis: () => {
          const current = remaining;
          remaining -= 65000;
          return current;
        }
      }
    });

    // Cover blurred; both slides dropped due to the time floor, never reaching the seam for them.
    assert.strictEqual(result.request.contents.length, 2);
    assert.deepStrictEqual(seamCallArgs, ['carousel-bytes-0']);
    assert.strictEqual(result.request.contents[1].inlineData.data, Buffer.from('blurred-carousel-bytes-0').toString('base64'));
  });

  // ---- Story 3.21 (AC1/AC3): aiImageInput/totalFaceDetectionCount derivation -------------

  await t.test('Case X: no imageUrl at all -> aiImageInput is no_image_sent, totalFaceDetectionCount undefined', async () => {
    const message: ProcessingJobMessage = {
      postId: 'post-aii-no-image',
      accountId: 'account-aii-no-image',
      content: 'No image here',
      postUrl: 'https://test.com/post-aii-no-image',
      publishedAt: '2026-08-10T12:00:00Z'
    };

    const result = await buildGeminiExtractionRequest(message);

    assert.strictEqual(result.aiImageInput, 'no_image_sent');
    assert.strictEqual(result.totalFaceDetectionCount, undefined);
  });

  await t.test('Case Y: cover fetch fails -> aiImageInput is no_image_sent (not text_only_fail_closed)', async () => {
    const message: ProcessingJobMessage = {
      postId: 'post-aii-fetch-fail',
      accountId: 'account-aii-fetch-fail',
      content: 'Cover fetch fails',
      imageUrl: 'https://test.com/broken.png',
      postUrl: 'https://test.com/post-aii-fetch-fail',
      publishedAt: '2026-08-10T12:00:00Z'
    };
    globalThis.fetch = async () => ({ ok: false, status: 404 }) as any;

    const result = await buildGeminiExtractionRequest(message, { blurFacesBeforeAi: { isOwnerOptedIn: false } });

    assert.strictEqual(result.aiImageInput, 'no_image_sent');
    assert.strictEqual(result.totalFaceDetectionCount, undefined);
  });

  await t.test('Case Z: options.blurFacesBeforeAi absent (mode off) -> aiImageInput is original_mode_off', async () => {
    const message: ProcessingJobMessage = {
      postId: 'post-aii-mode-off',
      accountId: 'account-aii-mode-off',
      content: 'Mode off',
      imageUrl: 'https://test.com/poster.png',
      postUrl: 'https://test.com/post-aii-mode-off',
      publishedAt: '2026-08-10T12:00:00Z'
    };
    globalThis.fetch = async () =>
      ({
        ok: true,
        headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'image/png' : null) },
        arrayBuffer: async () => Buffer.from('fake-image-bytes')
      }) as any;

    const result = await buildGeminiExtractionRequest(message);

    assert.strictEqual(result.aiImageInput, 'original_mode_off');
    assert.strictEqual(result.totalFaceDetectionCount, undefined);
  });

  await t.test('Case AA: isOwnerOptedIn true -> aiImageInput is original_owner_opted_in', async () => {
    const message: ProcessingJobMessage = {
      postId: 'post-aii-opted-in',
      accountId: 'account-aii-opted-in',
      content: 'Owner opted in',
      imageUrl: 'https://test.com/poster.png',
      postUrl: 'https://test.com/post-aii-opted-in',
      publishedAt: '2026-08-10T12:00:00Z'
    };
    globalThis.fetch = async () =>
      ({
        ok: true,
        headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'image/png' : null) },
        arrayBuffer: async () => Buffer.from('fake-image-bytes')
      }) as any;

    const result = await buildGeminiExtractionRequest(message, { blurFacesBeforeAi: { isOwnerOptedIn: true } });

    assert.strictEqual(result.aiImageInput, 'original_owner_opted_in');
    assert.strictEqual(result.totalFaceDetectionCount, undefined);
  });

  await t.test('Case AB: cover blur throws -> aiImageInput is text_only_fail_closed, totalFaceDetectionCount undefined', async () => {
    setDetectAndBlurFacesSeam(async () => {
      throw new Error('blur failed');
    });
    const message: ProcessingJobMessage = {
      postId: 'post-aii-fail-closed',
      accountId: 'account-aii-fail-closed',
      content: 'Cover blur fails',
      imageUrl: 'https://test.com/poster.png',
      postUrl: 'https://test.com/post-aii-fail-closed',
      publishedAt: '2026-08-10T12:00:00Z'
    };
    globalThis.fetch = async () =>
      ({
        ok: true,
        headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'image/png' : null) },
        arrayBuffer: async () => Buffer.from('fake-image-bytes')
      }) as any;

    const result = await buildGeminiExtractionRequest(message, { blurFacesBeforeAi: { isOwnerOptedIn: false } });

    assert.strictEqual(result.aiImageInput, 'text_only_fail_closed');
    assert.strictEqual(result.totalFaceDetectionCount, undefined);
  });

  await t.test('Case AC: cover blurred successfully with zero faces -> aiImageInput blurred, totalFaceDetectionCount 0 (never undefined)', async () => {
    setDetectAndBlurFacesSeam(async () => ({ buffer: Buffer.from('blurred-cover-bytes'), faceCount: 0 }));
    const message: ProcessingJobMessage = {
      postId: 'post-aii-blurred-zero',
      accountId: 'account-aii-blurred-zero',
      content: 'Cover blurred, zero faces',
      imageUrl: 'https://test.com/poster.png',
      postUrl: 'https://test.com/post-aii-blurred-zero',
      publishedAt: '2026-08-10T12:00:00Z'
    };
    globalThis.fetch = async () =>
      ({
        ok: true,
        headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'image/png' : null) },
        arrayBuffer: async () => Buffer.from('fake-image-bytes')
      }) as any;

    const result = await buildGeminiExtractionRequest(message, { blurFacesBeforeAi: { isOwnerOptedIn: false } });

    assert.strictEqual(result.aiImageInput, 'blurred');
    assert.strictEqual(result.totalFaceDetectionCount, 0);
    assert.strictEqual(result.coverFaceCount, 0);
  });

  await t.test('Case AD: cover + slides blurred -> totalFaceDetectionCount sums across all surviving images, excluding a dropped slide', async () => {
    installOrderedFetchMock({ failIndex: 2 }); // cover=0 ok, slide1(idx1) ok, slide2(idx2) fails
    const msg = multiImageMessage([slide1Url, slide2Url]);
    const faceCountByOriginal = new Map<string, number>([
      ['carousel-bytes-0', 3], // cover
      ['carousel-bytes-1', 2] // slide1 (slide2 never reaches the seam -- its fetch fails)
    ]);
    setDetectAndBlurFacesSeam(async (buffer: Buffer) => {
      const key = buffer.toString();
      return { buffer: Buffer.from(`blurred-${key}`), faceCount: faceCountByOriginal.get(key) ?? 0 };
    });

    const result = await buildGeminiExtractionRequest(msg, { blurFacesBeforeAi: { isOwnerOptedIn: false } });

    assert.strictEqual(result.aiImageInput, 'blurred');
    // cover (3) + slide1 (2) = 5; slide2 dropped at fetch, contributes nothing.
    assert.strictEqual(result.totalFaceDetectionCount, 5);
    assert.strictEqual(result.coverFaceCount, 3);
  });
});
