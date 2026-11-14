/*
 * Test support for the review tool: builds a fake bucket (a local directory laid out like the real one) from the SYNTHETIC
 * fixtures only. Never put a real caption, image, handle, phone number or post URL in a test.
 */
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export const SYNTHETIC_DIR = resolve(__dirname, '../../../scripts/fixtures/extraction-eval-synthetic');

export const tempDir = (name: string): string => mkdtempSync(join(tmpdir(), `${name}-`));

/** Draft ids used in tests. They look like the real ones (p- and eight characters) but are invented. */
export const DRAFT_IDS = { single: 'p-aaaaaaaa', multi: 'p-bbbbbbbb', notEvent: 'p-cccccccc' } as const;

const SOURCES: Array<[string, string, Record<string, unknown>]> = [
  [DRAFT_IDS.single, 'syn-single', { stratum: 'single-event', extractedEventCount: 1, extractionAuditRows: 1, imagesAvailable: 2, imagesFetched: 2, status: 'draft' }],
  [DRAFT_IDS.multi, 'syn-multi-date', { stratum: 'roundup', extractedEventCount: 1, extractionAuditRows: 2, extractedBeforeCursorPath: true, imagesAvailable: 3, imagesFetched: 3, status: 'draft' }],
  [DRAFT_IDS.notEvent, 'syn-not-event', { stratum: 'non-event', extractedEventCount: 0, extractionAuditRows: 1, imagesAvailable: 7, imagesFetched: 7, status: 'draft' }],
];

/**
 * A fake bucket with the three synthetic posts under the drafts prefix, relabelled with invented ids. `draft.json` carries an
 * invented post URL so tests can prove it is never uploaded.
 */
export function buildFakeBucket(): string {
  const bucket = tempDir('review-bucket');
  for (const [id, source, meta] of SOURCES) {
    const from = join(SYNTHETIC_DIR, source);
    const to = join(bucket, 'extraction-eval-drafts', id);
    mkdirSync(to, { recursive: true });
    const label = JSON.parse(readFileSync(join(from, 'label.json'), 'utf8')) as { images: string[]; postId: string };
    label.postId = id;
    // the not-event fixture has few images; pad to the stratum's count with copies of its first image
    const firstImage = join(from, label.images[0]!);
    const images = label.images.slice();
    while (images.length < Number(meta.imagesFetched)) images.push(`slide-${images.length + 1}.png`);
    label.images = images;
    for (const image of images) copyFileSync(firstImage, join(to, image));
    writeFileSync(join(to, 'label.json'), JSON.stringify(label, null, 2));
    writeFileSync(join(to, 'draft.json'), JSON.stringify({ ...meta, sourcePostId: `source-${id}`, postUrl: `https://example.invalid/post/${id}` }, null, 2));
  }
  return bucket;
}
