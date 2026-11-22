// POC helper: writes the exact system instruction the production builder produces (arm A) and the two POC variants (G-end, G-inline) to private/prompts/.
// No network call, no Gemini call. npx tsx dump-prompts.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { buildGeminiExtractionRequest } from '../../../apps/backend/src/lib/ai-processor/build-gemini-request.ts';
import { armRequest } from './arms-placement.ts';

const built = await buildGeminiExtractionRequest({ postId: 'dump', accountId: 'poc', content: 'caption goes here', postUrl: '', publishedAt: '2026-11-20T00:00:00.000Z' } as any);
mkdirSync('private/prompts', { recursive: true });
for (const arm of ['A', 'G-end', 'G-inline']) {
  const r = armRequest(arm, built.request) as any;
  writeFileSync(`private/prompts/${arm}.system.txt`, r.systemInstruction);
  writeFileSync(`private/prompts/${arm}.schema.json`, JSON.stringify(r.responseSchema, null, 1));
  console.log(arm, 'system chars', r.systemInstruction.length, 'schema chars', JSON.stringify(r.responseSchema).length);
}
