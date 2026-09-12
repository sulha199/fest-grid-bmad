import test from 'node:test';
import * as assert from 'node:assert';
import { buildGeminiExtractionRequest } from './build-gemini-request.js';
import { callGeminiGenerateContent } from '../ai-gateway/gemini-client.js';
import { type ProcessingJobMessage } from '@festgrid/domain/posts';

// Story 3.6l — Task 8: OPT-IN live smoke test against the real `laridijogja` carousel fixture
// (cover displayUrl + `childPosts[].displayUrl` values from
// _bmad-output/implementation-artifacts/backlog/IDEA-001-multislide-extraction.md).
//
// KNOWN CAVEAT (see the story's Task 8 / Out of Scope): the fixture's Instagram CDN image URLs
// are signed with an expiry (`oe=` query param) and were captured 2026-09-04 — they may already
// be expired by the time this test runs. If the image fetch itself fails (degrading to fewer
// images or text-only), the assertion error will surface the distinction between "images
// fetched but the model didn't find the schedules" and "images could not be fetched (fixture
// URLs likely stale — needs a fresh Apify capture)" below.
//
// This test is intentionally excluded from default `pnpm --filter backend test`/CI: it is
// non-deterministic (LLM output), consumes real Gemini quota, and depends on expiring external
// URLs. Run it explicitly with:
//   RUN_LIVE_GEMINI_TESTS=true SYSTEM_GEMINI_API_KEY=<key> pnpm --filter backend test
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

// Human-verified ground-truth event names at the bottom of the fixture (representative subset).
const GROUND_TRUTH_EVENT_NAMES = [
  'Pink Ribbon Run',
  'K24 Healthy Run',
  'Erafone Run',
  'Borobudur Marathon',
  'Kulon Progo Half-Marathon'
];

test('buildGeminiExtractionRequest live carousel smoke test (opt-in)', async (t) => {
  if (process.env.RUN_LIVE_GEMINI_TESTS !== 'true' || !process.env.SYSTEM_GEMINI_API_KEY) {
    t.skip('RUN_LIVE_GEMINI_TESTS/SYSTEM_GEMINI_API_KEY not set — live Gemini smoke test opted out');
    return;
  }

  const message: ProcessingJobMessage = {
    postId: 'post-carousel-live-1',
    accountId: 'account-carousel-live-1',
    content: 'Rangkuman event lari di Jogja 2026 — schedule info is on the later carousel slides',
    imageUrl: coverUrl,
    postUrl: 'https://www.instagram.com/p/DcntzF0mB7z/',
    publishedAt: '2026-08-29T10:24:17Z',
    additionalImageUrls: [slide1Url, slide2Url, slide3Url, slide4Url]
  };

  const { request, imageBytes } = await buildGeminiExtractionRequest(message);

  if (!imageBytes) {
    assert.fail(
      'Cover image could not be fetched — the fixture Instagram CDN URLs are likely stale ' +
        '(they were captured 2026-09-04 and are signed with an expiry). A fresh Apify capture of ' +
        'this post is required to keep this live test meaningful. This is distinct from the ' +
        'model simply not finding the schedules on successfully-fetched images.'
    );
  }

  let resultText = '';
  try {
    const result = await callGeminiGenerateContent(process.env.SYSTEM_GEMINI_API_KEY, request);
    resultText = result.text;
  } catch (err: any) {
    assert.fail(`Live Gemini call failed: ${err?.message || String(err)}`);
  }

  let payload: any;
  try {
    payload = JSON.parse(resultText);
  } catch {
    assert.fail(`Gemini response was not valid JSON: ${resultText}`);
  }

  assert.ok(payload && typeof payload === 'object', 'Payload must be an object');

  const scheduleTitles: string[] = Array.isArray(payload.schedules)
    ? payload.schedules
        .map((s: any) => String(s?.title || '').toLowerCase())
        .filter((title: string) => title.length > 0)
    : [];

  const normalizedGroundTruth = GROUND_TRUTH_EVENT_NAMES.map((name) => name.toLowerCase());
  const matched = scheduleTitles.some((title) =>
    normalizedGroundTruth.some((gt) => title.includes(gt) || gt.split(' ').some((part) => part.length > 3 && title.includes(part)))
  );

  assert.ok(
    matched,
    `Expected at least one returned schedule title to correspond to a ground-truth event ` +
      `(e.g. ${GROUND_TRUTH_EVENT_NAMES.join(', ')}), but the model returned: ${JSON.stringify(scheduleTitles)}. ` +
      `If images were fetched fine, this is a model/prompt gap — the new multi-slide prompt guidance did not ` +
      `surface the split schedule info. If the request degraded to fewer/no images instead, see the stale-URL note above.`
  );
});

